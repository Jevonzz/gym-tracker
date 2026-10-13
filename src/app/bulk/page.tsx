import type { Metadata } from "next";

import { BulkScreen } from "@/components/screens/bulk-screen";

export const metadata: Metadata = { title: "Bulk" };

export default function Page() {
  return <BulkScreen />;
}
