/** Read models. Each function is a plain async query, wrapped by hooks in `hooks/use-data.ts`. */
import { db } from "./dexie";
import type { Exercise, SetEntry, Workout, WorkoutExercise } from "./types";
import { e1rm, startOfWeek } from "@/lib/utils";

export async function getActiveWorkout() {
  return (await db.workouts.filter((w) => w.endedAt === null).first()) ?? null;
}

/** Completed sets from the most recent *finished* workout that included this exercise. */
export async function getPreviousSets(exerciseId: string, excludeWorkoutId?: string) {
  const sets = await db.sets
    .where("exerciseId")
    .equals(exerciseId)
    .filter((s) => s.completed && s.workoutId !== excludeWorkoutId)
    .toArray();
  if (!sets.length) return [];
  const lastWorkoutId = sets.reduce((a, b) => ((a.completedAt ?? 0) > (b.completedAt ?? 0) ? a : b)).workoutId;
  return sets.filter((s) => s.workoutId === lastWorkoutId).sort((a, b) => a.position - b.position);
}

export interface WorkoutDetail {
  workout: Workout;
  items: { we: WorkoutExercise; exercise: Exercise | undefined; sets: SetEntry[]; previous: SetEntry[] }[];
}

export async function getWorkoutDetail(workoutId: string): Promise<WorkoutDetail | null> {
  const workout = await db.workouts.get(workoutId);
  if (!workout) return null;
  const wes = await db.workoutExercises.where("workoutId").equals(workoutId).sortBy("position");
  const sets = await db.sets.where("workoutId").equals(workoutId).toArray();
  const exercises = await db.exercises.bulkGet(wes.map((w) => w.exerciseId));
  const items = await Promise.all(
    wes.map(async (we, i) => ({
      we,
      exercise: exercises[i],
      sets: sets.filter((s) => s.workoutExerciseId === we.id).sort((a, b) => a.position - b.position),
      previous: workout.endedAt === null ? await getPreviousSets(we.exerciseId, workoutId) : [],
    })),
  );
  return { workout, items };
}

export interface WorkoutSummary {
  workout: Workout;
  duration: number;
  volume: number;
  setCount: number;
  prCount: number;
  exercises: { name: string; sets: number; best: SetEntry | undefined }[];
}

export async function getWorkoutSummaries(limit?: number): Promise<WorkoutSummary[]> {
  let coll = db.workouts
    .orderBy("startedAt")
    .reverse()
    .filter((w) => w.endedAt !== null);
  if (limit) coll = coll.limit(limit);
  const workouts = await coll.toArray();
  const ids = workouts.map((w) => w.id);
  const [sets, wes, exercises] = await Promise.all([
    db.sets.where("workoutId").anyOf(ids).toArray(),
    db.workoutExercises.where("workoutId").anyOf(ids).toArray(),
    db.exercises.toArray(),
  ]);
  const exById = new Map(exercises.map((e) => [e.id, e]));
  return workouts.map((workout) => {
    const ws = sets.filter((s) => s.workoutId === workout.id && s.completed);
    const items = wes
      .filter((we) => we.workoutId === workout.id)
      .sort((a, b) => a.position - b.position)
      .map((we) => {
        const es = ws.filter((s) => s.workoutExerciseId === we.id);
        const best = es.reduce<SetEntry | undefined>(
          (b, s) => (!b || e1rm(s.weight ?? 0, s.reps ?? 0) > e1rm(b.weight ?? 0, b.reps ?? 0) ? s : b),
          undefined,
        );
        return { name: exById.get(we.exerciseId)?.name ?? "Unknown", sets: es.length, best };
      });
    return {
      workout,
      duration: (workout.endedAt ?? Date.now()) - workout.startedAt,
      volume: ws.reduce((v, s) => v + (s.weight ?? 0) * (s.reps ?? 0), 0),
      setCount: ws.length,
      prCount: ws.filter((s) => s.isPR).length,
      exercises: items,
    };
  });
}

export async function getDashboardStats() {
  const weekStart = startOfWeek().getTime();
  const finished = await db.workouts.filter((w) => w.endedAt !== null).toArray();
  const thisWeek = finished.filter((w) => w.startedAt >= weekStart);
  const weekSets = await db.sets
    .where("workoutId")
    .anyOf(thisWeek.map((w) => w.id))
    .filter((s) => s.completed)
    .toArray();

  // Weekly streak: consecutive weeks (ending this or last week) with at least one workout.
  const weeks = new Set(finished.map((w) => startOfWeek(new Date(w.startedAt)).getTime()));
  let streak = 0;
  const cursor = startOfWeek();
  if (!weeks.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 7);
  while (weeks.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }

  // Last 7 days, Monday-first, for the activity strip.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const next = d.getTime() + 86400000;
    return { date: d, trained: finished.some((w) => w.startedAt >= d.getTime() && w.startedAt < next) };
  });

  return {
    total: finished.length,
    weekCount: thisWeek.length,
    weekVolume: weekSets.reduce((v, s) => v + (s.weight ?? 0) * (s.reps ?? 0), 0),
    weekSets: weekSets.length,
    streak,
    days,
  };
}

export async function getExercisesWithUsage() {
  const [exercises, sets] = await Promise.all([db.exercises.orderBy("name").toArray(), db.sets.filter((s) => s.completed).toArray()]);
  const usage = new Map<string, { count: number; last: number }>();
  for (const s of sets) {
    const u = usage.get(s.exerciseId) ?? { count: 0, last: 0 };
    u.count++;
    u.last = Math.max(u.last, s.completedAt ?? 0);
    usage.set(s.exerciseId, u);
  }
  return exercises.map((e) => ({ ...e, setCount: usage.get(e.id)?.count ?? 0, lastUsed: usage.get(e.id)?.last ?? 0 }));
}

export interface ExerciseSession {
  workoutId: string;
  date: number;
  bestE1rm: number;
  maxWeight: number;
  volume: number;
  sets: SetEntry[];
}

export async function getExerciseHistory(exerciseId: string) {
  const exercise = await db.exercises.get(exerciseId);
  const sets = await db.sets
    .where("exerciseId")
    .equals(exerciseId)
    .filter((s) => s.completed)
    .toArray();
  const byWorkout = new Map<string, SetEntry[]>();
  for (const s of sets) byWorkout.set(s.workoutId, [...(byWorkout.get(s.workoutId) ?? []), s]);
  const workouts = await db.workouts.bulkGet([...byWorkout.keys()]);
  const sessions: ExerciseSession[] = workouts
    .filter((w): w is Workout => !!w)
    .map((w) => {
      const ss = byWorkout.get(w.id)!.sort((a, b) => a.position - b.position);
      return {
        workoutId: w.id,
        date: w.startedAt,
        bestE1rm: Math.max(...ss.map((s) => e1rm(s.weight ?? 0, s.reps ?? 0))),
        maxWeight: Math.max(...ss.map((s) => s.weight ?? 0)),
        volume: ss.reduce((v, s) => v + (s.weight ?? 0) * (s.reps ?? 0), 0),
        sets: ss,
      };
    })
    .sort((a, b) => a.date - b.date);

  const best = (f: (s: SetEntry) => number) => sets.reduce<SetEntry | undefined>((b, s) => (!b || f(s) > f(b) ? s : b), undefined);
  return {
    exercise,
    sessions,
    records: {
      heaviest: best((s) => s.weight ?? 0),
      bestE1rm: best((s) => e1rm(s.weight ?? 0, s.reps ?? 0)),
      mostReps: best((s) => s.reps ?? 0),
      bestVolumeSession: sessions.reduce<ExerciseSession | undefined>((b, s) => (!b || s.volume > b.volume ? s : b), undefined),
    },
  };
}

export async function getWeeklyVolume(weeks = 8) {
  const start = startOfWeek();
  start.setDate(start.getDate() - 7 * (weeks - 1));
  const workouts = await db.workouts
    .where("startedAt")
    .aboveOrEqual(start.getTime())
    .filter((w) => w.endedAt !== null)
    .toArray();
  const sets = await db.sets
    .where("workoutId")
    .anyOf(workouts.map((w) => w.id))
    .filter((s) => s.completed)
    .toArray();
  const wById = new Map(workouts.map((w) => [w.id, w]));
  return Array.from({ length: weeks }, (_, i) => {
    const from = new Date(start);
    from.setDate(from.getDate() + i * 7);
    const to = from.getTime() + 7 * 86400000;
    const inWeek = sets.filter((s) => {
      const t = wById.get(s.workoutId)!.startedAt;
      return t >= from.getTime() && t < to;
    });
    return {
      label: from.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      volume: Math.round(inWeek.reduce((v, s) => v + (s.weight ?? 0) * (s.reps ?? 0), 0)),
      workouts: workouts.filter((w) => w.startedAt >= from.getTime() && w.startedAt < to).length,
    };
  });
}

export async function getRecentPRs(limit = 8) {
  const prs = await db.sets.filter((s) => !!s.isPR && s.completed).toArray();
  prs.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  // Keep only the latest PR per exercise.
  const seen = new Set<string>();
  const latest = prs.filter((s) => (seen.has(s.exerciseId) ? false : (seen.add(s.exerciseId), true))).slice(0, limit);
  const exercises = await db.exercises.bulkGet(latest.map((s) => s.exerciseId));
  return latest.map((s, i) => ({ set: s, exercise: exercises[i] }));
}

export async function getTrainedExercises() {
  const sets = await db.sets.filter((s) => s.completed).toArray();
  const counts = new Map<string, number>();
  for (const s of sets) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
  const exercises = await db.exercises.bulkGet([...counts.keys()]);
  return exercises.filter((e): e is Exercise => !!e).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
}

export async function getRoutines() {
  const [routines, exercises] = await Promise.all([db.routines.orderBy("name").toArray(), db.exercises.toArray()]);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  return routines.map((r) => ({ ...r, exercises: r.exerciseIds.map((id) => byId.get(id)).filter((e): e is Exercise => !!e) }));
}
