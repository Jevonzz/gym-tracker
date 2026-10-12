import Dexie, { type EntityTable } from "dexie";

import type { Exercise, Routine, SetEntry, Workout, WorkoutExercise } from "./types";

export interface KV {
  key: string;
  value: unknown;
}

/**
 * Local-first storage. Everything lives in IndexedDB on the device, so the app
 * works fully offline. Only `repo.ts` and `queries.ts` should touch this.
 */
export const db = new Dexie("gym-tracker") as Dexie & {
  exercises: EntityTable<Exercise, "id">;
  workouts: EntityTable<Workout, "id">;
  workoutExercises: EntityTable<WorkoutExercise, "id">;
  sets: EntityTable<SetEntry, "id">;
  routines: EntityTable<Routine, "id">;
  kv: EntityTable<KV, "key">;
};

db.version(1).stores({
  exercises: "id, name, muscleGroup",
  workouts: "id, startedAt",
  workoutExercises: "id, workoutId, exerciseId",
  sets: "id, workoutId, workoutExerciseId, exerciseId",
  routines: "id, name",
  kv: "key",
});
