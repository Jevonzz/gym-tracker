"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ChevronLeft, Database, Download, HardDrive, RotateCcw, Sparkles, Upload } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/use-data";
import { exportData, importData, loadDemoData, resetAllData, updateSettings } from "@/lib/db/repo";
import type { BackupFile, Unit } from "@/lib/db/types";

export function SettingsScreen() {
  const router = useRouter();
  const settings = useSettings();
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [usage, setUsage] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.usage != null && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB`));
  }, []);

  async function doExport() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gym-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  async function doImport(file: File) {
    try {
      await importData(JSON.parse(await file.text()) as BackupFile);
      toast.success("Backup restored");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't read that file");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => router.back()}>
          <ChevronLeft className="size-6" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </header>

      <Group title="Workout">
        <Row label="Weight unit" hint="Label only, values are not converted">
          <Segmented<Unit>
            value={settings.unit}
            onChange={(unit) => updateSettings({ unit })}
            options={[
              { value: "kg", label: "kg" },
              { value: "lb", label: "lb" },
            ]}
          />
        </Row>
        <Row label="Auto-start rest timer" hint="After you tick off a set">
          <Switch checked={settings.autoRest} onCheckedChange={(autoRest) => updateSettings({ autoRest })} />
        </Row>
        <Row label="Rest duration">
          <Segmented
            value={String(settings.restSeconds)}
            onChange={(v) => updateSettings({ restSeconds: Number(v) })}
            options={["60", "90", "120", "180"].map((v) => ({ value: v, label: `${Number(v) / 60}m`.replace("1.5m", "1:30") }))}
          />
        </Row>
      </Group>

      <Group title="Bulk">
        <Row label="Goal bodyweight" hint={`${settings.unit}, leave empty for no goal`}>
          <NumberField
            value={settings.goalWeight}
            step={0.5}
            placeholder="None"
            onCommit={(goalWeight) => updateSettings({ goalWeight })}
            onClear={() => updateSettings({ goalWeight: null })}
          />
        </Row>
        <Row label="Daily protein target" hint="grams">
          <NumberField value={settings.proteinTarget} step={5} onCommit={(proteinTarget) => updateSettings({ proteinTarget })} />
        </Row>
        <Row label="Daily mass gainer" hint="servings">
          <NumberField value={settings.gainerTarget} step={0.5} onCommit={(gainerTarget) => updateSettings({ gainerTarget })} />
        </Row>
      </Group>

      <Group title="Appearance">
        <Row label="Theme">
          {mounted && (
            <Segmented
              value={theme ?? "dark"}
              onChange={setTheme}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
                { value: "system", label: "Auto" },
              ]}
            />
          )}
        </Row>
      </Group>

      <Group title="Your data">
        <div className="flex gap-3 p-4 text-sm text-muted-foreground">
          <HardDrive className="mt-0.5 size-4 shrink-0" />
          <p>
            Everything is stored on this device and works offline{usage ? ` (${usage} used)` : ""}. Export a backup now and then, since
            clearing browser data removes it.
          </p>
        </div>
        <ActionRow icon={<Download />} label="Export backup" onClick={doExport} />
        <ActionRow icon={<Upload />} label="Import backup" onClick={() => fileRef.current?.click()} />
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = "";
          }}
        />
        <ActionRow
          icon={<Sparkles />}
          label="Load sample data"
          onClick={async () => {
            await loadDemoData();
            toast.success("Sample workouts added");
          }}
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <ActionRow icon={<RotateCcw />} label="Erase all data" destructive />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Erase everything?</AlertDialogTitle>
              <AlertDialogDescription>
                All workouts, custom exercises, routines and your bulk log on this device will be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                destructive
                onClick={async () => {
                  await resetAllData();
                  toast("All data erased");
                }}
              >
                Erase
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Group>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Database className="size-3.5" /> Lift · local-first · v0.1
      </p>
    </div>
  );
}

const noop = () => () => {};

/** Numeric input that saves on blur / enter. Emptying it calls `onClear` if given, otherwise it is ignored. */
function NumberField({
  value,
  step,
  placeholder,
  onCommit,
  onClear,
}: {
  value: number | null;
  step: number;
  placeholder?: string;
  onCommit: (v: number) => void;
  onClear?: () => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  function commit() {
    if (draft === null) return;
    const v = parseFloat(draft.replace(",", "."));
    if (Number.isFinite(v) && v > 0 && v !== value) onCommit(v);
    else if (draft.trim() === "" && value != null) onClear?.();
    setDraft(null);
  }
  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      min={0}
      className="w-24 text-right tabular"
      placeholder={placeholder}
      value={draft ?? (value == null ? "" : String(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-semibold text-muted-foreground">{title}</h2>
      <Card className="divide-y divide-border/60">{children}</Card>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function ActionRow({
  icon,
  label,
  destructive,
  ...props
}: React.ComponentProps<"button"> & { icon: React.ReactNode; label: string; destructive?: boolean }) {
  return (
    <button
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium active:bg-accent [&_svg]:size-4 ${destructive ? "text-destructive" : ""}`}
      {...props}
    >
      {icon}
      {label}
    </button>
  );
}
