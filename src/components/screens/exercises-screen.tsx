"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { CreateExerciseDrawer, ExerciseAvatar, MuscleChips, useFilteredExercises } from "@/components/exercise-picker";
import type { MuscleGroup } from "@/lib/db/types";

export function ExercisesScreen() {
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState<MuscleGroup | "All">("All");
  const [creating, setCreating] = React.useState(false);
  const list = useFilteredExercises(query, group);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Exercises"
        subtitle="Your library"
        action={
          <Button size="icon" aria-label="New exercise" onClick={() => setCreating(true)}>
            <Plus />
          </Button>
        }
      />
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>
      <MuscleChips value={group} onChange={setGroup} />
      <div className="-mx-2">
        {list.map((e) => (
          <Link
            key={e.id}
            href={`/exercises/detail?id=${e.id}`}
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors active:bg-accent"
          >
            <ExerciseAvatar name={e.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{e.name}</span>
                {e.custom && <Badge variant="outline">Custom</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {e.muscleGroup} · {e.equipment}
                {e.setCount > 0 && ` · ${e.setCount} sets logged`}
              </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
        {list.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No matches.{" "}
            <button className="font-medium text-primary" onClick={() => setCreating(true)}>
              Create “{query}”
            </button>
          </div>
        )}
      </div>
      <CreateExerciseDrawer open={creating} onOpenChange={setCreating} initialName={query} />
    </div>
  );
}
