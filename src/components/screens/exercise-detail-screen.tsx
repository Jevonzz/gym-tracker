"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/page-header";
import { TrendChart } from "@/components/charts";
import { useExerciseHistory, useSettings } from "@/hooks/use-data";
import { deleteExercise } from "@/lib/db/repo";
import { e1rm, formatNumber } from "@/lib/utils";
import { formatWorkoutDate } from "@/components/workout-card";

type Metric = "e1rm" | "weight" | "volume";

export function ExerciseDetailScreen() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const data = useExerciseHistory(id);
  const { unit } = useSettings();
  const [metric, setMetric] = React.useState<Metric>("e1rm");

  if (data === undefined) return null;
  if (!data?.exercise) {
    return (
      <div className="pt-10">
        <EmptyState icon={<Trophy />} title="Exercise not found">
          <Link href="/exercises" className="text-primary">
            Back to library
          </Link>
        </EmptyState>
      </div>
    );
  }

  const { exercise, sessions, records } = data;
  const chartData = sessions.map((s) => ({
    label: new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value: metric === "e1rm" ? Math.round(s.bestE1rm * 10) / 10 : metric === "weight" ? s.maxWeight : s.volume,
  }));

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => router.back()}>
          <ChevronLeft className="size-6" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{exercise.name}</h1>
          <p className="text-sm text-muted-foreground">
            {exercise.muscleGroup} · {exercise.equipment}
          </p>
        </div>
        {exercise.custom && sessions.length === 0 && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete exercise"
            onClick={async () => {
              try {
                await deleteExercise(exercise.id);
                toast("Exercise deleted");
                router.replace("/exercises");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Trash2 />
          </Button>
        )}
      </header>

      {sessions.length === 0 ? (
        <EmptyState icon={<Trophy />} title="No sets logged yet">
          Add {exercise.name} to a workout to start tracking records and progress.
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Record
              label="Est. 1RM"
              value={records.bestE1rm && e1rm(records.bestE1rm.weight ?? 0, records.bestE1rm.reps ?? 0)}
              unit={unit}
              sub={records.bestE1rm && `${formatNumber(records.bestE1rm.weight ?? 0, 1)} × ${records.bestE1rm.reps}`}
              highlight
            />
            <Record
              label="Heaviest"
              value={records.heaviest?.weight}
              unit={unit}
              sub={records.heaviest && `× ${records.heaviest.reps} reps`}
            />
            <Record
              label="Most reps"
              value={records.mostReps?.reps}
              unit="reps"
              sub={records.mostReps && `at ${formatNumber(records.mostReps.weight ?? 0, 1)} ${unit}`}
            />
            <Record label="Best session" value={records.bestVolumeSession?.volume} unit={unit} sub="total volume" />
          </div>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="font-semibold">Progress</div>
              <Segmented
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "e1rm", label: "1RM" },
                  { value: "weight", label: "Weight" },
                  { value: "volume", label: "Volume" },
                ]}
              />
            </div>
            <TrendChart data={chartData} unit={unit} />
          </Card>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">History</h2>
            {[...sessions].reverse().map((s) => (
              <Card key={s.workoutId} className="p-3">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">{formatWorkoutDate(s.date)}</span>
                  <span className="text-muted-foreground tabular">1RM ≈ {formatNumber(s.bestE1rm, 1)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.sets.map((set) => (
                    <span key={set.id} className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-medium tabular">
                      {set.isPR && <Trophy className="size-3 text-amber-400" />}
                      {set.weight ? `${formatNumber(set.weight, 1)} × ` : ""}
                      {set.reps}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function Record({
  label,
  value,
  unit,
  sub,
  highlight,
}: {
  label: string;
  value?: number | 0 | null;
  unit: string;
  sub?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/10 p-4" : "p-4"}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular">
        {value ? formatNumber(value, 1) : "—"} <span className="text-sm font-medium text-muted-foreground">{unit}</span>
      </div>
      {sub && <div className="text-xs text-muted-foreground tabular">{sub}</div>}
    </Card>
  );
}
