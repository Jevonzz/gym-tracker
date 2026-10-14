"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Dumbbell, Flame, Scale, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { TrainingPicker } from "@/components/training-picker";
import { WorkoutCard } from "@/components/workout-card";
import { useActiveWorkout, useBulkOverview, useDashboardStats, useSettings, useWorkoutSummaries } from "@/hooks/use-data";
import { toggleTrainingType } from "@/lib/db/repo";
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
  const recent = useWorkoutSummaries(3);
  const { unit } = useSettings();
  const hello = greeting(useNow(60_000));

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle={hello}
        title="Today"
        action={
          <Button asChild variant="secondary" size="icon" aria-label="Settings">
            <Link href="/settings">
              <Settings />
            </Link>
          </Button>
        }
      />

      {active && <ActiveBanner startedAt={active.startedAt} name={active.name} />}

      <BulkBanner />

      <TrainedToday />

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
          <div className="mt-4 text-center text-sm text-muted-foreground tabular">
            <span className="font-semibold text-foreground">{stats?.weekTrainedDays ?? 0}</span> of 7 days trained
          </div>
        </div>
      </Card>

      {!!recent?.length && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Recent workouts</SectionTitle>
            <Link href="/history" className="flex items-center text-sm font-medium text-primary">
              See all <ChevronRight className="size-4" />
            </Link>
          </div>
          {recent.map((s) => (
            <WorkoutCard key={s.workout.id} summary={s} unit={unit} onClick={() => router.push(`/history?w=${s.workout.id}`)} />
          ))}
        </section>
      )}
    </div>
  );
}

/** One-tap training log for today: tick what you did, no sets needed. */
function TrainedToday() {
  const bulk = useBulkOverview();
  if (!bulk) return null;
  const today = bulk.today;
  const types = today.trainedAs ?? [];
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Trained today?</SectionTitle>
        <span className={cn("text-sm text-muted-foreground", today.isTrainingDay && "font-semibold text-primary")}>
          {today.isTrainingDay ? (
            <span className="flex items-center gap-1">
              <Check className="size-4" /> {today.workouts > 0 && !types.length ? "Workout logged" : "Done"}
            </span>
          ) : (
            "Rest day"
          )}
        </span>
      </div>
      <TrainingPicker value={types} onToggle={(t) => toggleTrainingType(today.date, t)} />
      <Link href="/workout" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Dumbbell className="size-3.5" /> Want to track sets and weights? Start a full workout
        <ChevronRight className="size-3.5" />
      </Link>
    </Card>
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

function BulkBanner() {
  const bulk = useBulkOverview();
  const { goalWeight, unit } = useSettings();
  if (!bulk) return null;
  const current = bulk.currentWeight;
  const toGo = current == null || goalWeight == null ? null : goalWeight - current;
  return (
    <Link href="/bulk" className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 active:bg-accent/60">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Scale className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground">
          {goalWeight == null ? "Bulk" : `Bulk to ${formatNumber(goalWeight, 1)} ${unit}`}
        </div>
        <div className="truncate font-semibold tabular">
          {current == null
            ? "Log your first weigh-in"
            : toGo == null
              ? `${formatNumber(current, 1)} ${unit} · set a goal`
              : `${formatNumber(current, 1)} ${unit} · ${toGo <= 0 ? "goal reached" : `${formatNumber(toGo, 1)} to go`}`}
        </div>
      </div>
      <div className="text-right text-xs text-muted-foreground tabular">
        {formatNumber(bulk.today.totalProtein)} / {formatNumber(bulk.targets.protein)} g
        <br />
        {bulk.today.totalKcal > 0 ? `${formatNumber(bulk.today.totalKcal)} kcal` : `${formatNumber(bulk.today.gainer, 1)} gainer`}
      </div>
      <ChevronRight className="size-5 text-muted-foreground" />
    </Link>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight">{children}</h2>;
}
