export const MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Full body", "Cardio"] as const;
export const EQUIPMENT = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Kettlebell", "Other"] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
export type Equipment = (typeof EQUIPMENT)[number];
export type Unit = "kg" | "lb";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  custom: boolean;
  createdAt: number;
}

export interface Workout {
  id: string;
  name: string;
  startedAt: number;
  /** null while the workout is in progress */
  endedAt: number | null;
  notes?: string;
  routineId?: string;
}

/** An exercise slot inside a workout. */
export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  position: number;
}

export interface SetEntry {
  id: string;
  workoutId: string;
  workoutExerciseId: string;
  exerciseId: string;
  position: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
  completedAt: number | null;
  isPR?: boolean;
}

export interface Routine {
  id: string;
  name: string;
  exerciseIds: string[];
  createdAt: number;
}

/** One row per calendar day (local time) for the bulking log. */
export interface DailyLog {
  /** "YYYY-MM-DD" */
  date: string;
  /** Morning bodyweight, null if not weighed that day */
  weight: number | null;
  /** Grams of protein eaten */
  protein: number;
  /** Mass gainer servings */
  gainer: number;
  /** Marked as a training day by hand (days with a logged workout count automatically) */
  trained: boolean;
  updatedAt: number;
}

export const emptyDailyLog = (date: string): DailyLog => ({ date, weight: null, protein: 0, gainer: 0, trained: false, updatedAt: 0 });

export interface Settings {
  unit: Unit;
  restSeconds: number;
  autoRest: boolean;
  /** Bulking goal bodyweight */
  goalWeight: number;
  /** Daily protein target in grams */
  proteinTarget: number;
  /** Daily mass gainer servings target */
  gainerTarget: number;
}

export const DEFAULT_SETTINGS: Settings = {
  unit: "kg",
  restSeconds: 90,
  autoRest: true,
  goalWeight: 80,
  proteinTarget: 160,
  gainerTarget: 1,
};

export interface BackupFile {
  app: "gym-tracker";
  version: 1 | 2;
  exportedAt: number;
  exercises: Exercise[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  sets: SetEntry[];
  routines: Routine[];
  /** Added in version 2 */
  dailyLogs?: DailyLog[];
  settings: Settings;
}
