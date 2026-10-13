"use client";

import * as React from "react";

import { dayKey } from "@/lib/utils";

/** Current time, re-rendered every `intervalMs`. Starts at 0 so prerendering stays deterministic. */
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [intervalMs, enabled]);
  return now;
}

/**
 * Today's local "YYYY-MM-DD", or null before mount. Rolls over at midnight and when the
 * app returns to the foreground, so a PWA left open overnight doesn't log to yesterday.
 */
export function useToday() {
  const [today, setToday] = React.useState<string | null>(null);
  React.useEffect(() => {
    const check = () => setToday(dayKey());
    const first = setTimeout(check, 0);
    const t = setInterval(check, 30_000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return today;
}
