"use client";

import { useLiveQuery } from "dexie-react-hooks";

import * as q from "@/lib/db/queries";
import { getSettings } from "@/lib/db/repo";
import { DEFAULT_SETTINGS } from "@/lib/db/types";

/** Live (auto-updating) views over the local database. `undefined` means still loading. */
export const useActiveWorkout = () => useLiveQuery(q.getActiveWorkout);
export const useWorkoutDetail = (id: string | null | undefined) => useLiveQuery(() => (id ? q.getWorkoutDetail(id) : null), [id]);
export const useWorkoutSummaries = (limit?: number) => useLiveQuery(() => q.getWorkoutSummaries(limit), [limit]);
export const useDashboardStats = () => useLiveQuery(q.getDashboardStats);
export const useExercises = () => useLiveQuery(q.getExercisesWithUsage);
export const useExerciseHistory = (id: string | null) => useLiveQuery(() => (id ? q.getExerciseHistory(id) : null), [id]);
export const useWeeklyVolume = (weeks = 8) => useLiveQuery(() => q.getWeeklyVolume(weeks), [weeks]);
export const useRecentPRs = (limit = 8) => useLiveQuery(() => q.getRecentPRs(limit), [limit]);
export const useTrainedExercises = () => useLiveQuery(q.getTrainedExercises);
export const useRoutines = () => useLiveQuery(q.getRoutines);
export const useSettings = () => useLiveQuery(getSettings) ?? DEFAULT_SETTINGS;
