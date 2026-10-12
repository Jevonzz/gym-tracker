"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { RestTimerProvider } from "@/components/rest-timer";
import { ensureSeeded } from "@/lib/db/repo";

export function Providers({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    ensureSeeded();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    // Ask the browser not to evict our IndexedDB data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <RestTimerProvider>
        {children}
        <Toaster />
      </RestTimerProvider>
    </ThemeProvider>
  );
}
