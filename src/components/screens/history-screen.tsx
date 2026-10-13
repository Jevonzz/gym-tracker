"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Clock, Pencil, Plus, Trash2, Trophy, Weight, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { EmptyState, PageHeader } from "@/components/page-header";
import { WorkoutCard } from "@/components/workout-card";
import { useSettings, useWorkoutDetail, useWorkoutSummaries } from "@/hooks/use-data";
import { NumberCell } from "@/components/screens/workout-screen";
import { addLoggedSet, deleteWorkout, recomputePRs, removeLoggedSet, updateSet } from "@/lib/db/repo";
import { e1rm, formatDurationShort, formatNumber } from "@/lib/utils";

export function HistoryScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("w");
  const summaries = useWorkoutSummaries();
  const { unit } = useSettings();

  const groups = React.useMemo(() => {
    const map = new Map<string, NonNullable<typeof summaries>>();
    for (const s of summaries ?? []) {
      const key = new Date(s.workout.startedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [summaries]);

  const setOpen = (id: string | null) => router.replace(id ? `/history?w=${id}` : "/history", { scroll: false });

  return (
    <div className="space-y-5">
      <PageHeader title="History" subtitle={summaries ? `${summaries.length} workouts logged` : " "} />
      {summaries?.length === 0 && (
        <EmptyState icon={<CalendarDays />} title="No workouts yet">
          Finished workouts show up here.
        </EmptyState>
      )}
      {groups.map(([month, items]) => (
        <section key={month} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{month}</h2>
          {items.map((s) => (
            <WorkoutCard key={s.workout.id} summary={s} unit={unit} onClick={() => setOpen(s.workout.id)} />
          ))}
        </section>
      ))}
      <WorkoutDetailDrawer id={openId} onClose={() => setOpen(null)} />
    </div>
  );
}

function WorkoutDetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useWorkoutDetail(id);
  const { unit } = useSettings();
  const open = !!id && !!detail;
  const [editing, setEditing] = React.useState(false);
  const touched = React.useRef(new Set<string>());

  async function finishEditing() {
    setEditing(false);
    // Edits can change which sets are records, so re-check the exercises that were touched.
    for (const exerciseId of touched.current) await recomputePRs(exerciseId);
    touched.current.clear();
  }

  function close() {
    if (editing) finishEditing();
    onClose();
  }

  const sets = detail?.items.flatMap((i) => i.sets) ?? [];
  const volume = sets.reduce((v, s) => v + (s.weight ?? 0) * (s.reps ?? 0), 0);

  return (
    <Drawer open={open} onOpenChange={(o) => !o && close()}>
      <DrawerContent>
        {detail && (
          <>
            <DrawerHeader>
              <DrawerTitle>{detail.workout.name}</DrawerTitle>
              <DrawerDescription>
                {new Date(detail.workout.startedAt).toLocaleString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </DrawerDescription>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <Pill
                  icon={<Clock />}
                  value={formatDurationShort((detail.workout.endedAt ?? detail.workout.startedAt) - detail.workout.startedAt)}
                />
                <Pill icon={<Weight />} value={`${formatNumber(volume)} ${unit}`} />
                <Pill icon={<Trophy />} value={`${sets.filter((s) => s.isPR).length} PRs`} />
              </div>
            </DrawerHeader>
            <div className="flex-1 space-y-4 overflow-y-auto px-4">
              {detail.items.map(({ we, exercise, sets }) => (
                <div key={we.id}>
                  <div className="mb-1.5 font-semibold text-primary">{exercise?.name}</div>
                  <div className="divide-y divide-border/60 rounded-xl bg-muted/50">
                    {sets.map((s, i) =>
                      editing ? (
                        <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm tabular">
                          <span className="w-6 text-muted-foreground">{i + 1}</span>
                          <div className="w-20">
                            <NumberCell
                              value={s.weight}
                              placeholder="0"
                              decimal
                              label={`${exercise?.name} set ${i + 1} weight`}
                              onChange={(weight) => {
                                touched.current.add(s.exerciseId);
                                updateSet(s.id, { weight });
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{unit} ×</span>
                          <div className="w-16">
                            <NumberCell
                              value={s.reps}
                              placeholder="0"
                              label={`${exercise?.name} set ${i + 1} reps`}
                              onChange={(reps) => {
                                touched.current.add(s.exerciseId);
                                updateSet(s.id, { reps });
                              }}
                            />
                          </div>
                          <span className="flex-1 text-xs text-muted-foreground">reps</span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete set ${i + 1}`}
                            onClick={() => {
                              touched.current.add(s.exerciseId);
                              removeLoggedSet(s.id);
                            }}
                          >
                            <X />
                          </Button>
                        </div>
                      ) : (
                        <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm tabular">
                          <span className="w-8 text-muted-foreground">{i + 1}</span>
                          <span className="flex-1 font-medium">
                            {s.weight ? `${formatNumber(s.weight, 1)} ${unit} × ` : ""}
                            {s.reps} reps
                          </span>
                          {s.isPR && <Trophy className="mr-2 size-4 text-amber-400" />}
                          <span className="text-xs text-muted-foreground">
                            {s.weight ? `1RM ≈ ${formatNumber(e1rm(s.weight, s.reps ?? 0), 1)}` : ""}
                          </span>
                        </div>
                      ),
                    )}
                    {editing && (
                      <button
                        className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-muted-foreground active:bg-accent"
                        onClick={() => {
                          touched.current.add(we.exerciseId);
                          addLoggedSet(we.id);
                        }}
                      >
                        <Plus className="size-4" /> Add set
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <DrawerFooter>
              <Button size="lg" variant={editing ? "default" : "secondary"} onClick={() => (editing ? finishEditing() : setEditing(true))}>
                {editing ? (
                  "Done"
                ) : (
                  <>
                    <Pencil /> Edit sets
                  </>
                )}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive">
                    <Trash2 /> Delete workout
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this workout?</AlertDialogTitle>
                    <AlertDialogDescription>All of its sets will be removed from your history and progress.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      destructive
                      onClick={async () => {
                        await deleteWorkout(detail.workout.id);
                        onClose();
                        toast("Workout deleted");
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function Pill({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-xl bg-muted py-2 text-xs font-semibold tabular [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
      {icon}
      {value}
    </div>
  );
}
