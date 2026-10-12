import { Suspense } from "react";
import type { Metadata } from "next";

import { HistoryScreen } from "@/components/screens/history-screen";

export const metadata: Metadata = { title: "History" };

export default function Page() {
  return (
    <Suspense>
      <HistoryScreen />
    </Suspense>
  );
}
