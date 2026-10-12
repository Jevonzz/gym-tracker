"use client";

import { Clock, Trophy, Weight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { WorkoutSummary } from "@/lib/db/queries";
import type { Unit } from "@/lib/db/types";
import { cn, formatDurationShort, formatNumber } from "@/lib/utils";

export function formatWorkoutDate(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function WorkoutCard({
  summary,
  unit,
  onClick,
  className,
}: {
  summary: WorkoutSummary;
  unit: Unit;
  onClick?: () => void;
  className?: string;
}) {
  const { workout, duration, volume, prCount, exercises } = summary;
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={cn("p-4 transition-colors", onClick && "cursor-pointer active:bg-accent/60", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{workout.name}</div>
          <div className="text-xs text-muted-foreground">
            {formatWorkoutDate(workout.startedAt)} ·{" "}
            {new Date(workout.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </div>
        </div>
        {prCount > 0 && (
          <Badge variant="pr">
            <Trophy /> {prCount} PR{prCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" /> {formatDurationShort(duration)}
        </span>
        <span className="flex items-center gap-1">
          <Weight className="size-3.5" /> {formatNumber(volume)} {unit}
        </span>
      </div>
      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
        {exercises.slice(0, 4).map((e, i) => (
          <div key={i} className="flex justify-between gap-3 text-sm">
            <span className="truncate">
              <span className="text-muted-foreground tabular">{e.sets} × </span>
              {e.name}
            </span>
            {e.best && (
              <span className="shrink-0 text-muted-foreground tabular">
                {e.best.weight ? `${formatNumber(e.best.weight, 1)} ${unit} × ` : ""}
                {e.best.reps}
              </span>
            )}
          </div>
        ))}
        {exercises.length > 4 && <div className="text-xs text-muted-foreground">+{exercises.length - 4} more</div>}
      </div>
    </Card>
  );
}
