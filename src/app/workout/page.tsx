import type { Metadata } from "next";

import { WorkoutScreen } from "@/components/screens/workout-screen";

export const metadata: Metadata = { title: "Workout" };

export default function Page() {
  return <WorkoutScreen />;
}
