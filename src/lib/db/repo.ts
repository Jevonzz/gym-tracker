/**
 * Write operations. This module (plus queries.ts) is the only place that knows
 * about the storage engine. To add cloud sync later (e.g. Supabase), keep
 * IndexedDB as the local source of truth and push/pull changes from here.
 */
import { db } from "./dexie";
import { SEED_EXERCISES, seedId } from "./seed";
import {
  DEFAULT_SETTINGS,
  emptyDailyLog,
  type BackupFile,
  type DailyLog,
  type Equipment,
  type Food,
  type MuscleGroup,
  type SetEntry,
  type Settings,
  type Workout,
} from "./types";
import { addDays, dayKey, e1rm, uid } from "@/lib/utils";
import { getPreviousSets } from "./queries";

let seeding: Promise<void> | null = null;

export function ensureSeeded() {
  seeding ??= (async () => {
    const done = await db.kv.get("seeded");
    if (done) return;
    const now = Date.now();
    await db.exercises.bulkPut(
      SEED_EXERCISES.map(([name, muscleGroup, equipment]) => ({
        id: seedId(name),
        name,
        muscleGroup,
        equipment,
        custom: false,
        createdAt: now,
      })),
    );
    await db.kv.put({ key: "seeded", value: true });
  })();
  return seeding;
}

/* ---------------------------------- settings --------------------------------- */

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get("settings");
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function updateSettings(patch: Partial<Settings>) {
  const current = await getSettings();
  const gainerChanged =
    (patch.gainerKcal !== undefined && patch.gainerKcal !== current.gainerKcal) ||
    (patch.gainerProtein !== undefined && patch.gainerProtein !== current.gainerProtein);
  await db.transaction("rw", [db.kv, db.dailyLogs], async () => {
    // Freeze the old gainer values onto past days first, so a new brand only counts from now on.
    // Skipped when no values were set before, so shakes logged at 0 kcal pick up the first real values.
    if (gainerChanged && (current.gainerKcal > 0 || current.gainerProtein > 0)) await snapshotGainer(current, (l) => l.gainerKcal === undefined && l.gainer > 0);
    await db.kv.put({ key: "settings", value: { ...current, ...patch } });
  });
}

/** Stores the given per-serving gainer values on matching days. */
async function snapshotGainer(settings: Settings, match: (l: DailyLog) => boolean) {
  await db.dailyLogs.filter(match).modify((l) => {
    l.gainerKcal = settings.gainerKcal;
    l.gainerProtein = settings.gainerProtein;
  });
}

const KG_PER_LB = 0.45359237;

/** Switches kg/lb and converts every stored weight (sets, weigh-ins, goal) so the numbers stay true. */
export async function changeUnit(unit: Settings["unit"]) {
  const settings = await getSettings();
  if (settings.unit === unit) return;
  const factor = unit === "lb" ? 1 / KG_PER_LB : KG_PER_LB;
  const convert = (w: number) => Math.round(w * factor * 100) / 100;
  await db.transaction("rw", [db.sets, db.dailyLogs, db.kv], async () => {
    await db.sets
      .filter((s) => !!s.weight)
      .modify((s) => {
        s.weight = convert(s.weight!);
      });
    await db.dailyLogs
      .filter((l) => !!l.weight)
      .modify((l) => {
        l.weight = convert(l.weight!);
      });
    await db.kv.put({
      key: "settings",
      value: { ...settings, unit, goalWeight: settings.goalWeight == null ? null : convert(settings.goalWeight) },
    });
  });
}

/* ---------------------------------- workouts --------------------------------- */

function defaultWorkoutName(date = new Date()) {
  const h = date.getHours();
  const part = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  return `${part} Workout`;
}

export async function startWorkout(opts: { routineId?: string } = {}) {
  const active = await db.workouts.filter((w) => w.endedAt === null).first();
  if (active) return active.id;

  const routine = opts.routineId ? await db.routines.get(opts.routineId) : undefined;
  const workout: Workout = {
    id: uid(),
    name: routine?.name ?? defaultWorkoutName(),
    startedAt: Date.now(),
    endedAt: null,
    routineId: routine?.id,
  };
  await db.transaction("rw", [db.workouts, db.workoutExercises, db.sets], async () => {
    await db.workouts.add(workout);
  });
  for (const exerciseId of routine?.exerciseIds ?? []) {
    await addExerciseToWorkout(workout.id, exerciseId);
  }
  return workout.id;
}

/** Adds an exercise and pre-fills sets from the last time it was performed. */
export async function addExerciseToWorkout(workoutId: string, exerciseId: string) {
  const position = await db.workoutExercises.where("workoutId").equals(workoutId).count();
  const weId = uid();
  const previous = await getPreviousSets(exerciseId, workoutId);
  const template = previous.length ? previous : [{ weight: null, reps: null }];
  await db.transaction("rw", [db.workoutExercises, db.sets], async () => {
    await db.workoutExercises.add({ id: weId, workoutId, exerciseId, position });
    await db.sets.bulkAdd(
      template.map((p, i) => ({
        id: uid(),
        workoutId,
        workoutExerciseId: weId,
        exerciseId,
        position: i,
        weight: p.weight,
        reps: p.reps,
        completed: false,
        completedAt: null,
      })),
    );
  });
  return weId;
}

export async function removeWorkoutExercise(workoutExerciseId: string) {
  await db.transaction("rw", [db.workoutExercises, db.sets], async () => {
    await db.sets.where("workoutExerciseId").equals(workoutExerciseId).delete();
    await db.workoutExercises.delete(workoutExerciseId);
  });
}

export async function addSet(workoutExerciseId: string) {
  const we = await db.workoutExercises.get(workoutExerciseId);
  if (!we) return;
  const sets = await db.sets.where("workoutExerciseId").equals(workoutExerciseId).sortBy("position");
  const last = sets.at(-1);
  await db.sets.add({
    id: uid(),
    workoutId: we.workoutId,
    workoutExerciseId,
    exerciseId: we.exerciseId,
    position: (last?.position ?? -1) + 1,
    weight: last?.weight ?? null,
    reps: last?.reps ?? null,
    completed: false,
    completedAt: null,
  });
}

/** Adds a set to an exercise in a finished workout, copying the last set. */
export async function addLoggedSet(workoutExerciseId: string) {
  const we = await db.workoutExercises.get(workoutExerciseId);
  if (!we) return;
  const sets = await db.sets.where("workoutExerciseId").equals(workoutExerciseId).sortBy("position");
  const last = sets.at(-1);
  await db.sets.add({
    id: uid(),
    workoutId: we.workoutId,
    workoutExerciseId,
    exerciseId: we.exerciseId,
    position: (last?.position ?? -1) + 1,
    weight: last?.weight ?? 0,
    reps: last?.reps ?? 1,
    completed: true,
    completedAt: (last?.completedAt ?? Date.now()) + 1,
  });
}

/**
 * Re-flags personal records for an exercise in the order the sets were done,
 * after a past workout was edited. Same rules as `toggleSetComplete`.
 */
export async function recomputePRs(exerciseId: string) {
  await db.transaction("rw", db.sets, async () => {
    const sets = await db.sets
      .where("exerciseId")
      .equals(exerciseId)
      .filter((s) => s.completed)
      .toArray();
    sets.sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
    const best = { weighted: 0, bodyweight: 0, seenWeighted: false, seenBodyweight: false };
    for (const s of sets) {
      let isPR: boolean;
      if (s.weight) {
        const score = e1rm(s.weight, s.reps ?? 0);
        isPR = best.seenWeighted && score > best.weighted;
        best.weighted = Math.max(best.weighted, score);
        best.seenWeighted = true;
      } else {
        const score = s.reps ?? 0;
        isPR = best.seenBodyweight && score > best.bodyweight;
        best.bodyweight = Math.max(best.bodyweight, score);
        best.seenBodyweight = true;
      }
      if (!!s.isPR !== isPR) await db.sets.update(s.id, { isPR });
    }
  });
}

/** Removes a set from a finished workout, and the exercise too if it was its last set. */
export async function removeLoggedSet(id: string) {
  await db.transaction("rw", [db.sets, db.workoutExercises], async () => {
    const set = await db.sets.get(id);
    if (!set) return;
    await db.sets.delete(id);
    const left = await db.sets.where("workoutExerciseId").equals(set.workoutExerciseId).count();
    if (left === 0) await db.workoutExercises.delete(set.workoutExerciseId);
  });
}

export async function updateSet(id: string, patch: Partial<Pick<SetEntry, "weight" | "reps">>) {
  await db.sets.update(id, patch);
}

export async function removeSet(id: string) {
  await db.sets.delete(id);
}

/** Toggles a set; returns whether it is a new personal record (estimated 1RM, or reps for bodyweight sets). */
export async function toggleSetComplete(id: string): Promise<{ completed: boolean; isPR: boolean }> {
  const set = await db.sets.get(id);
  if (!set) return { completed: false, isPR: false };
  if (set.completed) {
    await db.sets.update(id, { completed: false, completedAt: null, isPR: false });
    return { completed: false, isPR: false };
  }
  // Weighted sets compete on estimated 1RM; bodyweight sets (no added weight) compete on reps.
  const bodyweight = !set.weight;
  const score = (s: SetEntry) => (bodyweight ? (s.reps ?? 0) : e1rm(s.weight ?? 0, s.reps ?? 0));
  const others = await db.sets
    .where("exerciseId")
    .equals(set.exerciseId)
    .filter((s) => s.completed && s.id !== id && !s.weight === bodyweight)
    .toArray();
  const best = others.reduce((m, s) => Math.max(m, score(s)), 0);
  const isPR = score(set) > 0 && others.length > 0 && score(set) > best;
  await db.sets.update(id, { completed: true, completedAt: Date.now(), isPR });
  return { completed: true, isPR };
}

export async function renameWorkout(id: string, name: string) {
  await db.workouts.update(id, { name });
}

/** Ends the workout, dropping unfinished sets. Returns false if nothing was logged (workout discarded). */
export async function finishWorkout(id: string) {
  return db.transaction("rw", [db.workouts, db.workoutExercises, db.sets], async () => {
    await db.sets
      .where("workoutId")
      .equals(id)
      .filter((s) => !s.completed)
      .delete();
    const remaining = await db.sets.where("workoutId").equals(id).toArray();
    const keep = new Set(remaining.map((s) => s.workoutExerciseId));
    await db.workoutExercises
      .where("workoutId")
      .equals(id)
      .filter((we) => !keep.has(we.id))
      .delete();
    if (remaining.length === 0) {
      await db.workouts.delete(id);
      return false;
    }
    await db.workouts.update(id, { endedAt: Date.now() });
    return true;
  });
}

export async function deleteWorkout(id: string) {
  const exerciseIds = new Set((await db.sets.where("workoutId").equals(id).toArray()).map((s) => s.exerciseId));
  await db.transaction("rw", [db.workouts, db.workoutExercises, db.sets], async () => {
    await db.sets.where("workoutId").equals(id).delete();
    await db.workoutExercises.where("workoutId").equals(id).delete();
    await db.workouts.delete(id);
  });
  for (const exerciseId of exerciseIds) await recomputePRs(exerciseId);
}

/* ---------------------------------- exercises -------------------------------- */

export async function createExercise(input: { name: string; muscleGroup: MuscleGroup; equipment: Equipment }) {
  const id = uid();
  await db.exercises.add({ id, ...input, name: input.name.trim(), custom: true, createdAt: Date.now() });
  return id;
}

export async function deleteExercise(id: string) {
  const used = await db.sets.where("exerciseId").equals(id).count();
  if (used > 0) throw new Error("This exercise has logged sets and can't be deleted.");
  await db.exercises.delete(id);
}

/* ---------------------------------- routines --------------------------------- */

export async function saveWorkoutAsRoutine(workoutId: string, name: string) {
  const wes = await db.workoutExercises.where("workoutId").equals(workoutId).sortBy("position");
  const id = uid();
  await db.routines.add({ id, name: name.trim(), exerciseIds: wes.map((w) => w.exerciseId), createdAt: Date.now() });
  return id;
}

export async function createRoutine(name: string, exerciseIds: string[]) {
  const id = uid();
  await db.routines.add({ id, name: name.trim(), exerciseIds, createdAt: Date.now() });
  return id;
}

export async function deleteRoutine(id: string) {
  await db.routines.delete(id);
}

/* ---------------------------------- bulk log --------------------------------- */

export type DailyLogPatch = Partial<Pick<DailyLog, "weight" | "protein" | "gainer" | "trained" | "trainedAs">>;

export async function updateDailyLog(date: string, patch: DailyLogPatch) {
  const settings = await getSettings();
  await db.transaction("rw", db.dailyLogs, async () => {
    const current = (await db.dailyLogs.get(date)) ?? emptyDailyLog(date);
    const next = { ...current, ...patch, date, updatedAt: Date.now() };
    // A day's first gainer takes today's per-serving values with it.
    if (next.gainer > 0 && next.gainerKcal === undefined) {
      next.gainerKcal = settings.gainerKcal;
      next.gainerProtein = settings.gainerProtein;
    }
    await db.dailyLogs.put(next);
  });
}

/** One-tap training log: ticks a type (e.g. "Push") on or off for the day. The day counts as trained while any type is ticked. */
export async function toggleTrainingType(date: string, type: string) {
  await db.transaction("rw", db.dailyLogs, async () => {
    const current = (await db.dailyLogs.get(date)) ?? emptyDailyLog(date);
    const list = current.trainedAs ?? [];
    const trainedAs = list.includes(type) ? list.filter((t) => t !== type) : [...list, type];
    await db.dailyLogs.put({ ...current, trainedAs, trained: trainedAs.length > 0, updatedAt: Date.now() });
  });
}

/** Adds a custom option to the one-tap training log. */
export async function addTrainingType(type: string) {
  const name = type.trim();
  const { trainingTypes } = await getSettings();
  if (!name || trainingTypes.some((t) => t.toLowerCase() === name.toLowerCase())) return;
  await updateSettings({ trainingTypes: [...trainingTypes, name] });
}

/** Adds to today's (or another day's) protein / gainer totals, never going below zero. */
export async function addIntake(date: string, add: { protein?: number; gainer?: number }) {
  const settings = await getSettings();
  await db.transaction("rw", db.dailyLogs, async () => {
    const current = (await db.dailyLogs.get(date)) ?? emptyDailyLog(date);
    await db.dailyLogs.put({
      ...current,
      protein: Math.max(0, current.protein + (add.protein ?? 0)),
      gainer: Math.max(0, current.gainer + (add.gainer ?? 0)),
      // Logging a shake uses the gainer as set right now for the whole day.
      ...(add.gainer ? { gainerKcal: settings.gainerKcal, gainerProtein: settings.gainerProtein } : {}),
      updatedAt: Date.now(),
    });
  });
}

export async function deleteDailyLog(date: string) {
  await db.dailyLogs.delete(date);
}

/* ------------------------------------ food ----------------------------------- */

export type FoodInput = Pick<Food, "name" | "kcal" | "protein">;

/** Saves a food to My foods. A food with the same name (ignoring case) is updated instead of duplicated. */
export async function saveFood(input: FoodInput) {
  const name = input.name.trim();
  return db.transaction("rw", db.foods, async () => {
    const existing = await db.foods.filter((f) => f.name.trim().toLowerCase() === name.toLowerCase()).first();
    if (existing) {
      await db.foods.update(existing.id, { kcal: input.kcal, protein: input.protein });
      return existing.id;
    }
    const id = uid();
    await db.foods.add({ id, name, kcal: input.kcal, protein: input.protein, createdAt: Date.now() });
    return id;
  });
}

export async function deleteFood(id: string) {
  await db.foods.delete(id);
}

export async function logFood(date: string, input: FoodInput & { foodId?: string }) {
  await db.foodEntries.add({
    id: uid(),
    date,
    name: input.name.trim() || "Quick add",
    kcal: input.kcal,
    protein: input.protein,
    foodId: input.foodId,
    createdAt: Date.now(),
  });
}

export async function deleteFoodEntry(id: string) {
  await db.foodEntries.delete(id);
}

/** Remembers when the last backup was made, shown in Settings. */
export async function markBackedUp() {
  await db.kv.put({ key: "lastBackup", value: Date.now() });
}

export async function getLastBackup() {
  return ((await db.kv.get("lastBackup"))?.value as number | undefined) ?? null;
}

/* ------------------------------- backup & reset ------------------------------- */

export async function exportData(): Promise<BackupFile> {
  return {
    app: "gym-tracker",
    version: 3,
    exportedAt: Date.now(),
    exercises: await db.exercises.toArray(),
    workouts: await db.workouts.toArray(),
    workoutExercises: await db.workoutExercises.toArray(),
    sets: await db.sets.toArray(),
    routines: await db.routines.toArray(),
    dailyLogs: await db.dailyLogs.toArray(),
    foods: await db.foods.toArray(),
    foodEntries: await db.foodEntries.toArray(),
    settings: await getSettings(),
  };
}

export async function importData(data: BackupFile) {
  if (data?.app !== "gym-tracker" || ![1, 2, 3].includes(data.version)) throw new Error("Not a Gym Tracker backup file.");
  await db.transaction(
    "rw",
    [db.exercises, db.workouts, db.workoutExercises, db.sets, db.routines, db.dailyLogs, db.foods, db.foodEntries, db.kv],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.workouts.clear(),
        db.workoutExercises.clear(),
        db.sets.clear(),
        db.routines.clear(),
        db.dailyLogs.clear(),
        db.foods.clear(),
        db.foodEntries.clear(),
      ]);
      await db.exercises.bulkPut(data.exercises);
      await db.workouts.bulkPut(data.workouts);
      await db.workoutExercises.bulkPut(data.workoutExercises);
      await db.sets.bulkPut(data.sets);
      await db.routines.bulkPut(data.routines);
      await db.dailyLogs.bulkPut(data.dailyLogs ?? []);
      await db.foods.bulkPut(data.foods ?? []);
      await db.foodEntries.bulkPut(data.foodEntries ?? []);
      await db.kv.put({ key: "settings", value: data.settings });
      await db.kv.put({ key: "seeded", value: true });
    },
  );
}

export async function resetAllData() {
  await db.delete();
  await db.open();
  seeding = null;
  await ensureSeeded();
}

/** Fills the app with ~6 weeks of realistic training so every screen has something to show. */
export async function loadDemoData() {
  await ensureSeeded();
  const plans: { name: string; lifts: [string, number, number][] }[] = [
    {
      name: "Push Day",
      lifts: [
        ["Bench Press", 60, 8],
        ["Overhead Press", 37.5, 8],
        ["Incline Dumbbell Press", 22, 10],
        ["Triceps Pushdown", 25, 12],
      ],
    },
    {
      name: "Pull Day",
      lifts: [
        ["Deadlift", 100, 5],
        ["Pull-up", 0, 8],
        ["Barbell Row", 55, 8],
        ["Dumbbell Curl", 12, 12],
      ],
    },
    {
      name: "Leg Day",
      lifts: [
        ["Back Squat", 80, 6],
        ["Romanian Deadlift", 70, 8],
        ["Leg Press", 140, 10],
        ["Calf Raise", 60, 12],
      ],
    },
  ];
  for (const p of plans) {
    const exists = await db.routines.filter((r) => r.name === p.name).first();
    if (!exists)
      await createRoutine(
        p.name,
        p.lifts.map(([n]) => seedId(n)),
      );
  }

  const day = 86400000;
  const last = Date.now() - 3 * 3600000; // most recent session finished earlier today
  const sessions = 18;
  for (let i = 0; i < sessions; i++) {
    const plan = plans[i % plans.length];
    const progress = Math.floor(i / plans.length); // one step per rotation
    const startedAt = Math.round(last - (sessions - 1 - i) * 2.3 * day);
    const workoutId = uid();
    const workout: Workout = { id: workoutId, name: plan.name, startedAt, endedAt: startedAt + (50 + (i % 4) * 7) * 60000 };
    await db.workouts.add(workout);
    let pos = 0;
    for (const [name, base, reps] of plan.lifts) {
      const exerciseId = seedId(name);
      const weId = uid();
      await db.workoutExercises.add({ id: weId, workoutId, exerciseId, position: pos++ });
      const weight = base === 0 ? 0 : Math.round((base + progress * base * 0.035) / 2.5) * 2.5;
      for (let s = 0; s < 3; s++) {
        const r = Math.max(1, reps + (progress % 2) - (s === 2 ? 1 : 0));
        const setReps = base === 0 ? r + progress : r;
        const prior = await db.sets.where("exerciseId").equals(exerciseId).toArray();
        const value = (w: number, n: number) => (base === 0 ? n : e1rm(w, n));
        const best = prior.reduce((m, x) => Math.max(m, value(x.weight ?? 0, x.reps ?? 0)), 0);
        const score = value(weight, setReps);
        await db.sets.add({
          id: uid(),
          workoutId,
          workoutExerciseId: weId,
          exerciseId,
          position: s,
          weight,
          reps: setReps,
          completed: true,
          completedAt: startedAt + (pos * 12 + s * 3) * 60000,
          isPR: prior.length > 0 && score > best,
        });
      }
    }
  }

  // Bulk log: weigh-ins creeping up from ~72 kg, daily protein and gainer, workouts count as training days.
  const today = dayKey();
  const existing = new Set(await db.dailyLogs.toCollection().primaryKeys());
  const logs: DailyLog[] = [];
  for (let i = 41; i >= 0; i--) {
    const date = addDays(today, -i);
    if (existing.has(date)) continue;
    const t = 41 - i;
    const noise = Math.sin(t * 2.1) * 0.35 + Math.cos(t * 0.7) * 0.2;
    logs.push({
      date,
      weight: t % 3 === 2 ? null : Math.round((72 + t * 0.06 + noise) * 10) / 10,
      protein: 120 + ((t * 37) % 70),
      gainer: t % 5 === 4 ? 0 : 1 + (t % 4 === 0 ? 1 : 0),
      trained: false,
      updatedAt: Date.now(),
    });
  }
  await db.dailyLogs.bulkPut(logs);

  // A few saved foods so the food picker has something in it.
  if ((await db.foods.count()) === 0) {
    for (const f of [
      { name: "Chicken rice", kcal: 650, protein: 35 },
      { name: "Protein shake", kcal: 130, protein: 25 },
      { name: "Oats with milk", kcal: 400, protein: 18 },
      { name: "4 eggs", kcal: 290, protein: 25 },
    ])
      await saveFood(f);
  }
}
