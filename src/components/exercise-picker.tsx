"use client";

import * as React from "react";
import { Check, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExercises } from "@/hooks/use-data";
import { createExercise } from "@/lib/db/repo";
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type MuscleGroup } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export function MuscleChips({
  value,
  onChange,
  className,
}: {
  value: MuscleGroup | "All";
  onChange: (v: MuscleGroup | "All") => void;
  className?: string;
}) {
  return (
    <div className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]", className)}>
      {(["All", ...MUSCLE_GROUPS] as const).map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          className={cn(
            "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
            value === g && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

export function useFilteredExercises(query: string, group: MuscleGroup | "All") {
  const exercises = useExercises();
  return React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (exercises ?? []).filter((e) => (group === "All" || e.muscleGroup === group) && (!q || e.name.toLowerCase().includes(q)));
  }, [exercises, query, group]);
}

/** Bottom sheet for choosing one or more exercises to add to a workout. */
export function ExercisePicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (ids: string[]) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState<MuscleGroup | "All">("All");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [creating, setCreating] = React.useState(false);
  const list = useFilteredExercises(query, group);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setSelected([]);
            setQuery("");
          }
          onOpenChange(o);
        }}
        repositionInputs={false}
      >
        <DrawerContent className="h-[88dvh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle>Add exercises</DrawerTitle>
            <DrawerDescription className="sr-only">Search the exercise library</DrawerDescription>
            <div className="relative mt-2">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
            </div>
            <MuscleChips value={group} onChange={setGroup} className="mt-2" />
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-2">
            {list.map((e) => {
              const isSel = selected.includes(e.id);
              return (
                <button
                  key={e.id}
                  onClick={() => toggle(e.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors active:bg-accent",
                    isSel && "bg-primary/10",
                  )}
                >
                  <ExerciseAvatar name={e.name} active={isSel} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.muscleGroup} · {e.equipment}
                    </div>
                  </div>
                  {isSel && <Check className="size-5 text-primary" />}
                </button>
              );
            })}
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-primary active:bg-accent"
            >
              <span className="flex size-10 items-center justify-center rounded-xl border border-dashed border-primary/50">
                <Plus className="size-5" />
              </span>
              <span className="font-medium">{query ? `Create “${query}”` : "Create custom exercise"}</span>
            </button>
          </div>
          <DrawerFooter className="border-t border-border/60">
            <Button
              size="lg"
              disabled={!selected.length}
              onClick={() => {
                onPick(selected);
                setSelected([]);
                setQuery("");
                onOpenChange(false);
              }}
            >
              {selected.length ? `Add ${selected.length} exercise${selected.length > 1 ? "s" : ""}` : "Select exercises"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <CreateExerciseDrawer
        open={creating}
        onOpenChange={setCreating}
        initialName={query}
        onCreated={(id) => setSelected((s) => [...s, id])}
      />
    </>
  );
}

export function CreateExerciseDrawer({
  open,
  onOpenChange,
  initialName = "",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated?: (id: string) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} nested>
      <DrawerContent>
        {open && <CreateExerciseForm initialName={initialName} onDone={(id) => (onCreated?.(id), onOpenChange(false))} />}
      </DrawerContent>
    </Drawer>
  );
}

function CreateExerciseForm({ initialName, onDone }: { initialName: string; onDone: (id: string) => void }) {
  const [name, setName] = React.useState(initialName);
  const [muscle, setMuscle] = React.useState<MuscleGroup>("Chest");
  const [equipment, setEquipment] = React.useState<Equipment>("Barbell");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const id = await createExercise({ name, muscleGroup: muscle, equipment });
    toast.success(`${name.trim()} added to your library`);
    onDone(id);
  }

  return (
    <form onSubmit={submit}>
      <DrawerHeader>
        <DrawerTitle>New exercise</DrawerTitle>
        <DrawerDescription>Custom exercises are saved to your library.</DrawerDescription>
      </DrawerHeader>
      <div className="space-y-4 px-4">
        <div className="space-y-2">
          <Label htmlFor="ex-name">Name</Label>
          <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cable Lateral Raise" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Muscle group</Label>
            <Select value={muscle} onValueChange={(v) => setMuscle(v as MuscleGroup)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MUSCLE_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Equipment</Label>
            <Select value={equipment} onValueChange={(v) => setEquipment(v as Equipment)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DrawerFooter>
        <Button type="submit" size="lg" disabled={!name.trim()}>
          Save exercise
        </Button>
      </DrawerFooter>
    </form>
  );
}

export function ExerciseAvatar({ name, active, className }: { name: string; active?: boolean; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w[0]))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold text-muted-foreground",
        active && "bg-primary text-primary-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}
