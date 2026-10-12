/**
 * Write operations. This module (plus queries.ts) is the only place that knows
 * about the storage engine. To add cloud sync later (e.g. Supabase), keep
 * IndexedDB as the local source of truth and push/pull changes from here.
 */
import { db } from "./dexie";
import { SEED_EXERCISES, seedId } from "./seed";
import { DEFAULT_SETTINGS, type BackupFile, type Equipment, type MuscleGroup, type SetEntry, type Settings, type Workout } from "./types";
import { e1rm, uid } from "@/lib/utils";
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
  await db.kv.put({ key: "settings", value: { ...current, ...patch } });
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

export async function updateSet(id: string, patch: Partial<Pick<SetEntry, "weight" | "reps">>) {
  await db.sets.update(id, patch);
}

export async function removeSet(id: string) {
  await db.sets.delete(id);
}

/** Toggles a set; returns whether it is a new personal record (by estimated 1RM). */
export async function toggleSetComplete(id: string): Promise<{ completed: boolean; isPR: boolean }> {
  const set = await db.sets.get(id);
  if (!set) return { completed: false, isPR: false };
  if (set.completed) {
    await db.sets.update(id, { completed: false, completedAt: null, isPR: false });
    return { completed: false, isPR: false };
  }
  const score = e1rm(set.weight ?? 0, set.reps ?? 0);
  const others = await db.sets
    .where("exerciseId")
    .equals(set.exerciseId)
    .filter((s) => s.completed && s.id !== id)
    .toArray();
  const best = others.reduce((m, s) => Math.max(m, e1rm(s.weight ?? 0, s.reps ?? 0)), 0);
  const isPR = score > 0 && others.length > 0 && score > best;
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
  await db.transaction("rw", [db.workouts, db.workoutExercises, db.sets], async () => {
    await db.sets.where("workoutId").equals(id).delete();
    await db.workoutExercises.where("workoutId").equals(id).delete();
    await db.workouts.delete(id);
  });
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

/* ------------------------------- backup & reset ------------------------------- */

export async function exportData(): Promise<BackupFile> {
  return {
    app: "gym-tracker",
    version: 1,
    exportedAt: Date.now(),
    exercises: await db.exercises.toArray(),
    workouts: await db.workouts.toArray(),
    workoutExercises: await db.workoutExercises.toArray(),
    sets: await db.sets.toArray(),
    routines: await db.routines.toArray(),
    settings: await getSettings(),
  };
}

export async function importData(data: BackupFile) {
  if (data?.app !== "gym-tracker" || data.version !== 1) throw new Error("Not a Gym Tracker backup file.");
  await db.transaction("rw", [db.exercises, db.workouts, db.workoutExercises, db.sets, db.routines, db.kv], async () => {
    await Promise.all([db.exercises.clear(), db.workouts.clear(), db.workoutExercises.clear(), db.sets.clear(), db.routines.clear()]);
    await db.exercises.bulkPut(data.exercises);
    await db.workouts.bulkPut(data.workouts);
    await db.workoutExercises.bulkPut(data.workoutExercises);
    await db.sets.bulkPut(data.sets);
    await db.routines.bulkPut(data.routines);
    await db.kv.put({ key: "settings", value: data.settings });
    await db.kv.put({ key: "seeded", value: true });
  });
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
        const prior = await db.sets.where("exerciseId").equals(exerciseId).toArray();
        const best = prior.reduce((m, x) => Math.max(m, e1rm(x.weight ?? 0, x.reps ?? 0)), 0);
        const score = e1rm(weight, r);
        await db.sets.add({
          id: uid(),
          workoutId,
          workoutExerciseId: weId,
          exerciseId,
          position: s,
          weight,
          reps: base === 0 ? r + progress : r,
          completed: true,
          completedAt: startedAt + (pos * 12 + s * 3) * 60000,
          isPR: prior.length > 0 && score > best,
        });
      }
    }
  }
}
