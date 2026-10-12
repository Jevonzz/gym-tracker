"use client";

import * as React from "react";

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
