import { Suspense } from "react";
import type { Metadata } from "next";

import { ExerciseDetailScreen } from "@/components/screens/exercise-detail-screen";

export const metadata: Metadata = { title: "Exercise" };

export default function Page() {
  return (
    <Suspense>
      <ExerciseDetailScreen />
    </Suspense>
  );
}
