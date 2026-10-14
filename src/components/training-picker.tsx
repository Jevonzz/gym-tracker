"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { useSettings } from "@/hooks/use-data";
import { addTrainingType } from "@/lib/db/repo";
import { cn } from "@/lib/utils";

/** Tap-to-tick chips for what you trained. Options come from Settings, and "+" adds your own. */
export function TrainingPicker({ value, onToggle }: { value: string[]; onToggle: (type: string) => void }) {
  const { trainingTypes } = useSettings();
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const options = [...trainingTypes, ...value.filter((t) => !trainingTypes.includes(t))];

  const done = React.useRef(false);

  async function add() {
    // Enter submits and the input then blurs; only handle the first.
    if (done.current) return;
    done.current = true;
    const type = name.trim();
    setAdding(false);
    setName("");
    if (!type) return;
    await addTrainingType(type);
    if (!value.includes(type)) onToggle(type);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={value.includes(t)}
          onClick={() => onToggle(t)}
          className={cn(
            "h-9 rounded-full border border-border px-3.5 text-sm font-medium text-muted-foreground transition-colors active:scale-[0.97]",
            value.includes(t) && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {t}
        </button>
      ))}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            autoFocus
            aria-label="New training type"
            placeholder="e.g. Futsal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={add}
            className="h-9 w-32 rounded-full border border-ring bg-transparent px-3.5 text-base outline-none md:text-sm"
          />
        </form>
      ) : (
        <button
          type="button"
          aria-label="Add a training type"
          onClick={() => {
            done.current = false;
            setAdding(true);
          }}
          className="flex size-9 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground active:scale-[0.97]"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}
