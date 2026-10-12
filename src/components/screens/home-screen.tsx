"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Flame, Play, Plus, Settings, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/page-header";
import { WorkoutCard } from "@/components/workout-card";
import { useActiveWorkout, useDashboardStats, useRoutines, useSettings, useWorkoutSummaries } from "@/hooks/use-data";
import { loadDemoData, startWorkout } from "@/lib/db/repo";
import { useNow } from "@/hooks/use-now";
import { cn, formatDuration, formatNumber } from "@/lib/utils";

function greeting(now: number) {
  if (!now) return "Welcome back";
  const h = new Date(now).getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function HomeScreen() {
  const router = useRouter();
  const active = useActiveWorkout();
  const stats = useDashboardStats();
  const routines = useRoutines();
  const recent = useWorkoutSummaries(3);
  const { unit } = useSettings();
  const hello = greeting(useNow(60_000));

  async function start(routineId?: string) {
    await startWorkout({ routineId });
    router.push("/workout");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle={hello}
        title="Let's train"
        action={
          <Button asChild variant="secondary" size="icon" aria-label="Settings">
            <Link href="/settings">
              <Settings />
            </Link>
          </Button>
        }
      />

      {active && <ActiveBanner startedAt={active.startedAt} name={active.name} />}

      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-primary/15 via-transparent to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">This week</div>
            <div className="flex items-center gap-1 text-sm font-semibold text-orange-400">
              <Flame className="size-4" /> {stats?.streak ?? 0} week streak
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {(stats?.days ?? []).map(({ date, trained }) => {
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div key={date.getTime()} className="flex flex-col items-center gap-1.5">
                  <span className={cn("text-[11px] text-muted-foreground", isToday && "font-bold text-foreground")}>
                    {date.toLocaleDateString(undefined, { weekday: "narrow" })}
                  </span>
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full bg-muted text-xs tabular text-muted-foreground",
                      trained && "bg-primary font-bold text-primary-foreground",
                      isToday && !trained && "ring-2 ring-primary/50",
                    )}
                  >
                    {date.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-border/60 rounded-xl bg-background/40 py-3 text-center">
            <Stat label="Workouts" value={stats?.weekCount ?? 0} />
            <Stat label={`Volume (${unit})`} value={formatNumber(stats?.weekVolume ?? 0)} />
            <Stat label="Sets" value={stats?.weekSets ?? 0} />
          </div>
        </div>
      </Card>

      <section className="space-y-3">
        <SectionTitle>Start a workout</SectionTitle>
        {!active && (
          <Button size="lg" className="h-14 w-full rounded-2xl text-base" onClick={() => start()}>
            <Plus className="size-5" /> Start empty workout
          </Button>
        )}
        {routines && routines.length > 0 && (
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {routines.map((r) => (
              <Card key={r.id} className="flex w-56 shrink-0 snap-start flex-col gap-3 p-4">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.exercises.map((e) => e.name).join(" · ")}</div>
                </div>
                <Button variant="secondary" size="sm" className="mt-auto" disabled={!!active} onClick={() => start(r.id)}>
                  <Play /> Start routine
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Recent workouts</SectionTitle>
          {!!recent?.length && (
            <Link href="/history" className="flex items-center text-sm font-medium text-primary">
              See all <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
        {recent?.length === 0 && stats?.total === 0 && (
          <EmptyState icon={<Sparkles />} title="No workouts yet">
            <p>Start your first workout above, or load sample data to explore the app.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={async () => {
                await loadDemoData();
                toast.success("Sample workouts added");
              }}
            >
              Load sample data
            </Button>
          </EmptyState>
        )}
        {recent?.map((s) => (
          <WorkoutCard key={s.workout.id} summary={s} unit={unit} onClick={() => router.push(`/history?w=${s.workout.id}`)} />
        ))}
      </section>
    </div>
  );
}

function ActiveBanner({ startedAt, name }: { startedAt: number; name: string }) {
  const now = useNow();
  return (
    <Link
      href="/workout"
      className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.99]"
    >
      <span className="relative flex size-3">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground/60" />
        <span className="relative inline-flex size-3 rounded-full bg-primary-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium opacity-80">In progress</div>
        <div className="truncate font-semibold">{name}</div>
      </div>
      <div className="text-lg font-bold tabular">{now ? formatDuration(now - startedAt) : ""}</div>
      <ChevronRight className="size-5" />
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xl font-bold tabular">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight">{children}</h2>;
}
