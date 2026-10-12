"use client";

import * as React from "react";
import Link from "next/link";
import { ChartLine, Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/page-header";
import { TrendChart, VolumeChart } from "@/components/charts";
import { formatWorkoutDate } from "@/components/workout-card";
import { useExerciseHistory, useRecentPRs, useSettings, useTrainedExercises, useWeeklyVolume } from "@/hooks/use-data";
import { formatNumber } from "@/lib/utils";

export function ProgressScreen() {
  const { unit } = useSettings();
  const weekly = useWeeklyVolume(8);
  const prs = useRecentPRs(6);
  const trained = useTrainedExercises();
  const [exerciseId, setExerciseId] = React.useState<string | null>(null);
  const selected = exerciseId ?? trained?.[0]?.id ?? null;
  const history = useExerciseHistory(selected);

  if (trained?.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="Progress" subtitle="Your trends" />
        <EmptyState icon={<ChartLine />} title="Nothing to chart yet">
          Log a couple of workouts and your volume, strength trends and PRs appear here.
        </EmptyState>
      </div>
    );
  }

  const totalVolume = weekly?.reduce((v, w) => v + w.volume, 0) ?? 0;
  const totalWorkouts = weekly?.reduce((v, w) => v + w.workouts, 0) ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Progress" subtitle="Last 8 weeks" />

      <Card className="p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Weekly volume</div>
            <div className="text-2xl font-bold tabular">
              {formatNumber(totalVolume)} <span className="text-sm font-medium text-muted-foreground">{unit}</span>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground tabular">
            {totalWorkouts} workouts
            <br />
            {formatNumber(totalWorkouts / 8, 1)} / week
          </div>
        </div>
        <div className="mt-3">
          <VolumeChart data={weekly ?? []} unit={unit} height={180} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">Estimated 1RM</div>
            <div className="text-2xl font-bold tabular">
              {history?.records.bestE1rm ? formatNumber(Math.max(...history.sessions.map((s) => s.bestE1rm)), 1) : "—"}{" "}
              <span className="text-sm font-medium text-muted-foreground">{unit}</span>
            </div>
          </div>
          <Select value={selected ?? undefined} onValueChange={setExerciseId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Exercise" />
            </SelectTrigger>
            <SelectContent>
              {trained?.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TrendChart
          data={(history?.sessions ?? []).map((s) => ({
            label: new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            value: Math.round(s.bestE1rm * 10) / 10,
          }))}
          unit={unit}
          height={180}
        />
      </Card>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Recent PRs</h2>
        {prs?.length === 0 && <p className="text-sm text-muted-foreground">Beat a previous best to set a PR.</p>}
        {prs?.map(({ set, exercise }) => (
          <Link key={set.id} href={`/exercises/detail?id=${set.exerciseId}`}>
            <Card className="mb-2 flex items-center gap-3 p-3 active:bg-accent/60">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
                <Trophy className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{exercise?.name}</div>
                <div className="text-xs text-muted-foreground">{formatWorkoutDate(set.completedAt ?? 0)}</div>
              </div>
              <div className="text-right font-semibold tabular">
                {formatNumber(set.weight ?? 0, 1)} {unit} × {set.reps}
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
