"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Check, Dumbbell, EllipsisVertical, Play, Plus, Timer, Trash2, Trophy, X } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ExerciseAvatar, ExercisePicker } from "@/components/exercise-picker";
import { useRestTimer } from "@/components/rest-timer";
import { useActiveWorkout, useRoutines, useSettings, useWorkoutDetail } from "@/hooks/use-data";
import type { WorkoutDetail } from "@/lib/db/queries";
import * as repo from "@/lib/db/repo";
import type { SetEntry, Unit } from "@/lib/db/types";
import { useNow } from "@/hooks/use-now";
import { cn, formatDuration, formatNumber } from "@/lib/utils";

export function WorkoutScreen() {
  const active = useActiveWorkout();
  const detail = useWorkoutDetail(active?.id);

  if (active === undefined) return null;
  if (!active) return <NoActiveWorkout />;
  if (!detail) return null;
  return <ActiveWorkout detail={detail} />;
}

function NoActiveWorkout() {
  const routines = useRoutines();
  return (
    <div className="space-y-5">
      <PageHeader title="Workout" subtitle="Nothing in progress" />
      <EmptyState icon={<Dumbbell />} title="Ready when you are">
        Start an empty workout and add exercises as you go, or pick a routine.
      </EmptyState>
      <Button size="lg" className="h-14 w-full rounded-2xl text-base" onClick={() => repo.startWorkout()}>
        <Plus className="size-5" /> Start empty workout
      </Button>
      {routines?.map((r) => (
        <Card key={r.id} className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{r.name}</div>
            <div className="truncate text-xs text-muted-foreground">{r.exercises.map((e) => e.name).join(" · ")}</div>
          </div>
          <Button size="icon" variant="secondary" aria-label={`Start ${r.name}`} onClick={() => repo.startWorkout({ routineId: r.id })}>
            <Play />
          </Button>
        </Card>
      ))}
    </div>
  );
}

function ActiveWorkout({ detail }: { detail: WorkoutDetail }) {
  const router = useRouter();
  const { workout, items } = detail;
  const { unit } = useSettings();
  const [picker, setPicker] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"finish" | "discard" | null>(null);
  const [routineOpen, setRoutineOpen] = React.useState(false);
  const now = useNow();

  const allSets = items.flatMap((i) => i.sets);
  const done = allSets.filter((s) => s.completed);
  const volume = done.reduce((v, s) => v + (s.weight ?? 0) * (s.reps ?? 0), 0);

  async function finish() {
    const kept = await repo.finishWorkout(workout.id);
    if (kept) {
      toast.success("Workout saved 💪", { description: `${done.length} sets · ${formatNumber(volume)} ${unit}` });
      router.push(`/history?w=${workout.id}`);
    } else {
      toast("Workout discarded", { description: "No completed sets to save." });
      router.push("/");
    }
  }

  async function discard() {
    await repo.deleteWorkout(workout.id);
    toast("Workout discarded");
    router.push("/");
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/85 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <input
              aria-label="Workout name"
              defaultValue={workout.name}
              onBlur={(e) => e.target.value.trim() && repo.renameWorkout(workout.id, e.target.value.trim())}
              className="w-full truncate bg-transparent text-xl font-bold tracking-tight outline-none"
            />
            <div className="flex items-center gap-3 text-xs text-muted-foreground tabular">
              <span className="flex items-center gap-1 font-semibold text-primary">
                <Timer className="size-3.5" />
                {now ? formatDuration(now - workout.startedAt) : "0:00"}
              </span>
              <span>
                {done.length}/{allSets.length} sets
              </span>
              <span>
                {formatNumber(volume)} {unit}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Workout options">
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!items.length} onSelect={() => setRoutineOpen(true)}>
                <BookmarkPlus /> Save as routine
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("discard")}>
                <Trash2 /> Discard workout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setConfirm("finish")}>Finish</Button>
        </div>
      </div>

      {items.length === 0 && (
        <EmptyState icon={<Dumbbell />} title="Add your first exercise">
          Pick from the library or create your own.
        </EmptyState>
      )}

      {items.map((item) => (
        <ExerciseBlock key={item.we.id} item={item} unit={unit} />
      ))}

      <Button variant="secondary" size="lg" className="w-full rounded-2xl" onClick={() => setPicker(true)}>
        <Plus className="size-5" /> Add exercise
      </Button>

      <ExercisePicker
        open={picker}
        onOpenChange={setPicker}
        onPick={async (ids) => {
          for (const id of ids) await repo.addExerciseToWorkout(workout.id, id);
        }}
      />

      <SaveRoutineDrawer open={routineOpen} onOpenChange={setRoutineOpen} workoutId={workout.id} defaultName={workout.name} />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "finish" ? "Finish workout?" : "Discard workout?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "finish"
                ? done.length < allSets.length
                  ? `${allSets.length - done.length} unchecked set(s) will be removed. Only completed sets are saved.`
                  : `Nice work! ${done.length} sets and ${formatNumber(volume)} ${unit} lifted.`
                : "This workout and all its sets will be deleted. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction destructive={confirm === "discard"} onClick={confirm === "finish" ? finish : discard}>
              {confirm === "finish" ? "Finish" : "Discard"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExerciseBlock({ item, unit }: { item: WorkoutDetail["items"][number]; unit: Unit }) {
  const { we, exercise, sets, previous } = item;
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-3 p-3 pb-2">
        <ExerciseAvatar name={exercise?.name ?? "?"} className="size-9" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-primary">{exercise?.name ?? "Unknown exercise"}</div>
          <div className="text-xs text-muted-foreground">
            {exercise?.muscleGroup} · {exercise?.equipment}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Exercise options">
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={() => repo.removeWorkoutExercise(we.id)}>
              <Trash2 /> Remove exercise
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid grid-cols-[2rem_1fr_4.5rem_4.5rem_2.75rem] items-center gap-2 px-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span className="text-center">Set</span>
        <span>Previous</span>
        <span className="text-center">{unit}</span>
        <span className="text-center">Reps</span>
        <span />
      </div>
      <div className="mt-1">
        {sets.map((s, i) => (
          <SetRow key={s.id} set={s} index={i} previous={previous[i]} />
        ))}
      </div>
      <button
        onClick={() => repo.addSet(we.id)}
        className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 py-2.5 text-sm font-medium text-muted-foreground active:bg-accent"
      >
        <Plus className="size-4" /> Add set
      </button>
    </Card>
  );
}

function SetRow({ set, index, previous }: { set: SetEntry; index: number; previous?: SetEntry }) {
  const { start } = useRestTimer();
  const { restSeconds, autoRest } = useSettings();

  async function toggle() {
    // Empty fields fall back to what you did last time (shown as the placeholder).
    if (!set.completed && (set.weight === null || set.reps === null)) {
      const weight = set.weight ?? previous?.weight ?? null;
      const reps = set.reps ?? previous?.reps ?? null;
      if (reps === null) {
        toast.error("Enter reps first");
        return;
      }
      await repo.updateSet(set.id, { weight: weight ?? 0, reps });
    }
    const res = await repo.toggleSetComplete(set.id);
    if (res.completed) {
      navigator.vibrate?.(30);
      if (autoRest) start(restSeconds);
      if (res.isPR) toast("New personal record! 🏆", { description: "Your best set yet for this exercise." });
    }
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[2rem_1fr_4.5rem_4.5rem_2.75rem] items-center gap-2 px-3 py-1.5 transition-colors",
        set.completed && "bg-primary/10",
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-8 items-center justify-center rounded-lg bg-muted text-sm font-bold tabular"
            aria-label={`Set ${index + 1} options`}
          >
            {set.isPR ? <Trophy className="size-3.5 text-amber-400" /> : index + 1}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem variant="destructive" onSelect={() => repo.removeSet(set.id)}>
            <X /> Delete set
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        className="truncate text-left text-sm text-muted-foreground tabular"
        disabled={!previous || set.completed}
        onClick={() => previous && repo.updateSet(set.id, { weight: previous.weight, reps: previous.reps })}
      >
        {previous ? `${formatNumber(previous.weight ?? 0, 1)} × ${previous.reps}` : "—"}
      </button>
      <NumberCell
        value={set.weight}
        placeholder={previous?.weight != null ? formatNumber(previous.weight, 1) : "0"}
        decimal
        disabled={set.completed}
        onChange={(weight) => repo.updateSet(set.id, { weight })}
        label={`Set ${index + 1} weight`}
      />
      <NumberCell
        value={set.reps}
        placeholder={previous?.reps != null ? String(previous.reps) : "0"}
        disabled={set.completed}
        onChange={(reps) => repo.updateSet(set.id, { reps })}
        label={`Set ${index + 1} reps`}
      />
      <button
        onClick={toggle}
        aria-label={set.completed ? "Mark set as not done" : "Complete set"}
        aria-pressed={set.completed}
        className={cn(
          "flex size-9 items-center justify-center justify-self-end rounded-lg bg-muted text-muted-foreground transition-all active:scale-90",
          set.completed && "bg-primary text-primary-foreground",
        )}
      >
        <Check className="size-5" strokeWidth={3} />
      </button>
    </div>
  );
}

export function NumberCell({
  value,
  placeholder,
  decimal,
  disabled,
  onChange,
  label,
}: {
  value: number | null;
  placeholder: string;
  decimal?: boolean;
  disabled?: boolean;
  onChange: (v: number | null) => void;
  label: string;
}) {
  const [text, setText] = React.useState(value === null ? "" : String(value));
  const focused = React.useRef(false);

  // Sync from the database when the value changes elsewhere (e.g. "previous" tap).
  React.useEffect(() => {
    if (!focused.current) setText(value === null ? "" : String(value));
  }, [value]);

  return (
    <input
      aria-label={label}
      inputMode={decimal ? "decimal" : "numeric"}
      enterKeyHint="next"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onBlur={() => (focused.current = false)}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        if (!/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        const n = raw === "" || raw === "." ? null : Number(raw);
        onChange(n === null ? null : decimal ? n : Math.round(n));
      }}
      className="h-9 w-full rounded-lg bg-muted text-center text-base font-semibold tabular outline-none placeholder:font-normal placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary disabled:bg-transparent disabled:opacity-100"
    />
  );
}

function SaveRoutineDrawer({
  open,
  onOpenChange,
  workoutId,
  defaultName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workoutId: string;
  defaultName: string;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {open && <SaveRoutineForm workoutId={workoutId} defaultName={defaultName} onDone={() => onOpenChange(false)} />}
      </DrawerContent>
    </Drawer>
  );
}

function SaveRoutineForm({ workoutId, defaultName, onDone }: { workoutId: string; defaultName: string; onDone: () => void }) {
  const [name, setName] = React.useState(defaultName);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await repo.saveWorkoutAsRoutine(workoutId, name || defaultName);
        toast.success("Routine saved", { description: "Start it any time from Home." });
        onDone();
      }}
    >
      <DrawerHeader>
        <DrawerTitle>Save as routine</DrawerTitle>
        <DrawerDescription>Reuse this exercise list next time with one tap.</DrawerDescription>
      </DrawerHeader>
      <div className="px-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Routine name" autoFocus />
      </div>
      <DrawerFooter>
        <Button type="submit" size="lg">
          Save routine
        </Button>
      </DrawerFooter>
    </form>
  );
}
