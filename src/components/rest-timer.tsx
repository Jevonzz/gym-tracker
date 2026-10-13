"use client";

import * as React from "react";
import { Minus, Plus, Timer, X } from "lucide-react";

import { useNow } from "@/hooks/use-now";
import { cn, formatDuration } from "@/lib/utils";

interface RestTimerState {
  endsAt: number | null;
  total: number;
  start: (seconds: number) => void;
  adjust: (seconds: number) => void;
  stop: () => void;
}

const RestTimerContext = React.createContext<RestTimerState | null>(null);

export function useRestTimer() {
  const ctx = React.useContext(RestTimerContext);
  if (!ctx) throw new Error("useRestTimer must be used inside RestTimerProvider");
  return ctx;
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    });
  } catch {}
  navigator.vibrate?.([200, 100, 200]);
}

const STORAGE_KEY = "lift-rest-timer";

/** Shows a system notification when rest ends while the app is in the background (needs permission). */
async function notifyRestOver() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || document.visibilityState === "visible") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const options = { body: "Time for your next set.", tag: "rest-timer", icon: "/icons/icon-192.png" };
    if (reg) await reg.showNotification("Rest over", options);
    else new Notification("Rest over", options);
  } catch {}
}

function loadSaved(): { endsAt: number; total: number } | null {
  try {
    if (typeof window === "undefined") return null;
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { endsAt: number; total: number } | null;
    return saved && saved.endsAt > Date.now() ? saved : null;
  } catch {
    return null;
  }
}

export function RestTimerProvider({ children }: { children: React.ReactNode }) {
  // Survive the app being closed or reloaded mid-rest. Nothing renders from this until the clock ticks, so hydration stays stable.
  const [saved] = React.useState(loadSaved);
  const [endsAt, setEndsAt] = React.useState<number | null>(saved?.endsAt ?? null);
  const [total, setTotal] = React.useState(saved?.total ?? 0);
  React.useEffect(() => {
    try {
      if (endsAt) localStorage.setItem(STORAGE_KEY, JSON.stringify({ endsAt, total }));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [endsAt, total]);

  // A real timeout as well as the on-screen tick, so the alert fires on time even if rendering is paused.
  React.useEffect(() => {
    if (!endsAt) return;
    const t = setTimeout(notifyRestOver, Math.max(0, endsAt - Date.now()));
    return () => clearTimeout(t);
  }, [endsAt]);

  const value = React.useMemo<RestTimerState>(
    () => ({
      endsAt,
      total,
      start: (s) => {
        setTotal(s);
        setEndsAt(Date.now() + s * 1000);
      },
      adjust: (s) => {
        setEndsAt((e) => (e ? Math.max(Date.now(), e + s * 1000) : e));
        setTotal((t) => Math.max(1, t + s));
      },
      stop: () => setEndsAt(null),
    }),
    [endsAt, total],
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

/** Floating countdown that sits above the bottom navigation. */
export function RestTimerBar() {
  const { endsAt, total, adjust, stop } = useRestTimer();
  const now = useNow(250, !!endsAt);

  React.useEffect(() => {
    if (endsAt && now >= endsAt) {
      beep();
      stop();
    }
  }, [now, endsAt, stop]);

  if (!endsAt || !now) return null;
  const remaining = Math.max(0, endsAt - now);
  const pct = total ? Math.min(100, (remaining / (total * 1000)) * 100) : 0;

  return (
    <>
      {/* In-flow spacer so the bar never hides the end of the page. */}
      <div aria-hidden className="h-20" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
        <div className="pointer-events-auto relative flex w-full max-w-md items-center gap-2 overflow-hidden rounded-2xl border border-border/60 bg-popover/95 p-2 pl-4 shadow-2xl backdrop-blur animate-in slide-in-from-bottom-4 fade-in">
          <div className="absolute inset-y-0 left-0 bg-primary/12 transition-[width] duration-300" style={{ width: `${pct}%` }} />
          <Timer className="relative size-5 text-primary" />
          <div className="relative flex-1">
            <div className="text-xs text-muted-foreground">Rest</div>
            <div className="text-xl font-bold tabular leading-none">{formatDuration(remaining)}</div>
          </div>
          <RoundButton label="Subtract 15 seconds" onClick={() => adjust(-15)}>
            <Minus />
          </RoundButton>
          <RoundButton label="Add 15 seconds" onClick={() => adjust(15)}>
            <Plus />
          </RoundButton>
          <RoundButton label="Skip rest" onClick={stop} className="bg-primary text-primary-foreground">
            <X />
          </RoundButton>
        </div>
      </div>
    </>
  );
}

function RoundButton({ className, label, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      aria-label={label}
      className={cn(
        "relative flex size-10 items-center justify-center rounded-xl bg-secondary text-sm active:scale-95 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
