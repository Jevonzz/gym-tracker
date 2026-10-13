"use client";

import * as React from "react";
import { Beef, Check, CupSoda, Dumbbell, Minus, Plus, Scale, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState, PageHeader } from "@/components/page-header";
import { BodyweightChart } from "@/components/charts";
import { useBulkOverview, useSettings } from "@/hooks/use-data";
import type { BulkDay, BulkOverview } from "@/lib/db/queries";
import { addIntake, deleteDailyLog, updateDailyLog, updateSettings } from "@/lib/db/repo";
import type { Settings } from "@/lib/db/types";
import { cn, formatNumber, parseDayKey } from "@/lib/utils";

const PROTEIN_STEP = 25;

export function BulkScreen() {
  const overview = useBulkOverview();
  const settings = useSettings();
  const [editing, setEditing] = React.useState<BulkDay | null>(null);
  const [editingGoal, setEditingGoal] = React.useState(false);
  const { goalWeight, unit } = settings;

  return (
    <div className="space-y-5">
      <PageHeader
        subtitle={goalWeight == null ? "Weight, intake and training" : `Goal ${formatNumber(goalWeight, 1)} ${unit}`}
        title="Bulk"
        action={
          <Button variant="secondary" size="sm" onClick={() => setEditingGoal(true)}>
            <Target /> {goalWeight == null ? "Set goal" : "Goal"}
          </Button>
        }
      />
      {overview && (
        <>
          <GoalCard overview={overview} settings={settings} onSetGoal={() => setEditingGoal(true)} />
          <TodayCard day={overview.today} settings={settings} onEdit={() => setEditing(overview.today)} />
          <WeekCard week={overview.week} settings={settings} onEdit={setEditing} />
          <TrendCard overview={overview} settings={settings} />
          <HistoryList history={overview.history} settings={settings} onEdit={setEditing} />
        </>
      )}
      <DayEditor day={editing} settings={settings} onClose={() => setEditing(null)} />
      <GoalEditor
        open={editingGoal}
        settings={settings}
        suggested={overview?.currentWeight ?? null}
        onClose={() => setEditingGoal(false)}
      />
    </div>
  );
}

function GoalCard({ overview, settings, onSetGoal }: { overview: BulkOverview; settings: Settings; onSetGoal: () => void }) {
  const { startWeight, currentWeight, latestWeight, ratePerWeek } = overview;
  const { goalWeight: goal, unit } = settings;

  if (currentWeight == null || startWeight == null) {
    return (
      <EmptyState icon={<Scale />} title="Weigh in to start tracking">
        Log your bodyweight below. Weigh in most mornings and your trend
        {goal == null ? "" : ` toward ${formatNumber(goal, 1)} ${unit}`} shows up here.
      </EmptyState>
    );
  }

  const toGo = goal == null ? null : goal - currentWeight;
  const reached = toGo != null && toGo <= 0;
  const span = goal == null ? 0 : goal - startWeight;
  const pct = reached ? 100 : span > 0 ? Math.min(100, Math.max(0, ((currentWeight - startWeight) / span) * 100)) : 0;
  const weeksLeft = toGo != null && !reached && ratePerWeek && ratePerWeek > 0.02 ? toGo / ratePerWeek : null;
  const eta = weeksLeft != null ? new Date(parseDayKey(overview.weighIns.at(-1)!.date).getTime() + weeksLeft * 7 * 86400000) : null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-primary/15 via-transparent to-transparent p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Bodyweight (7-day avg)</div>
            <div className="text-4xl font-bold tracking-tight tabular">
              {formatNumber(currentWeight, 1)} <span className="text-base font-medium text-muted-foreground">{unit}</span>
            </div>
            {latestWeight != null && (
              <div className="text-xs text-muted-foreground tabular">
                Last weigh-in {formatNumber(latestWeight, 1)} {unit}
              </div>
            )}
          </div>
          <div className="text-right">
            {toGo == null ? (
              <button className="flex items-center justify-end gap-1 text-sm font-semibold text-primary" onClick={onSetGoal}>
                <Target className="size-4" /> Set a goal
              </button>
            ) : (
              <div className="flex items-center justify-end gap-1 text-sm font-semibold text-primary">
                <Target className="size-4" /> {reached ? "Goal reached" : `${formatNumber(toGo, 1)} ${unit} to go`}
              </div>
            )}
            <div className="mt-1 text-xs text-muted-foreground tabular">
              {ratePerWeek == null
                ? "Need more weigh-ins for a rate"
                : `${ratePerWeek >= 0 ? "+" : ""}${formatNumber(ratePerWeek, 2)} ${unit}/week`}
            </div>
            {eta && (
              <div className="text-xs text-muted-foreground">
                On pace for {eta.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
        {goal != null && (
          <div className="mt-4">
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular">
              <span>
                Start {formatNumber(startWeight, 1)} {unit}
              </span>
              <span>
                Goal {formatNumber(goal, 1)} {unit}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function TodayCard({ day, settings, onEdit }: { day: BulkDay; settings: Settings; onEdit: () => void }) {
  const { unit, proteinTarget, gainerTarget } = settings;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Today</h2>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          <Scale /> {day.weight == null ? "Log weight" : "Edit"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Tile icon={<Scale />} label="Weight" value={day.weight == null ? "—" : `${formatNumber(day.weight, 1)} ${unit}`} />
        <Tile
          icon={<Dumbbell />}
          label="Training"
          value={day.workouts > 0 ? "Workout logged" : day.trained ? "Trained" : "Rest day"}
          done={day.isTrainingDay}
          onClick={day.workouts > 0 ? undefined : () => updateDailyLog(day.date, { trained: !day.trained })}
        />
        <Tile
          icon={<Beef />}
          label="Protein"
          value={`${formatNumber(day.protein)} / ${formatNumber(proteinTarget)} g`}
          done={day.protein >= proteinTarget}
          progress={day.protein / proteinTarget}
        />
        <Tile
          icon={<CupSoda />}
          label="Mass gainer"
          value={`${formatNumber(day.gainer, 1)} / ${formatNumber(gainerTarget, 1)}`}
          done={day.gainer >= gainerTarget}
          progress={day.gainer / gainerTarget}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => addIntake(day.date, { protein: PROTEIN_STEP })}>
          <Plus /> {PROTEIN_STEP} g protein
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            await addIntake(day.date, { gainer: 1 });
            toast.success("Mass gainer logged");
          }}
        >
          <Plus /> 1 gainer shake
        </Button>
      </div>
    </Card>
  );
}

function Tile({
  icon,
  label,
  value,
  done,
  progress,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  done?: boolean;
  progress?: number;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl bg-muted/60 p-3 text-left [&_svg]:size-4",
        onClick && "active:bg-accent",
        done && "bg-primary/15",
      )}
    >
      {progress != null && !done && (
        <span className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${Math.min(1, progress) * 100}%` }} />
      )}
      <span className="relative flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
        {done && <Check className="ml-auto text-primary" />}
      </span>
      <span className="relative mt-1 block text-sm font-semibold tabular">{value}</span>
    </Comp>
  );
}

function WeekCard({ week, settings, onEdit }: { week: BulkDay[]; settings: Settings; onEdit: (d: BulkDay) => void }) {
  const trainingDays = week.filter((d) => d.isTrainingDay).length;
  const avgProtein = week.reduce((a, d) => a + d.protein, 0) / week.length;
  const shakes = week.reduce((a, d) => a + d.gainer, 0);
  return (
    <Card className="p-4">
      <div className="text-sm font-medium text-muted-foreground">Last 7 days</div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {week.map((d) => {
          const date = parseDayKey(d.date);
          return (
            <button key={d.date} className="flex flex-col items-center gap-1.5" onClick={() => onEdit(d)}>
              <span className="text-[11px] text-muted-foreground">{date.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full bg-muted text-xs tabular text-muted-foreground",
                  d.isTrainingDay && "bg-primary font-bold text-primary-foreground",
                )}
              >
                {date.getDate()}
              </span>
              <span
                className={cn("size-1.5 rounded-full bg-transparent", d.protein >= settings.proteinTarget && "bg-chart-2")}
                aria-label={d.protein >= settings.proteinTarget ? "Protein target hit" : undefined}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 divide-x divide-border/60 rounded-xl bg-muted/40 py-3 text-center">
        <Stat label="Training days" value={trainingDays} />
        <Stat label="Avg protein (g)" value={formatNumber(avgProtein)} />
        <Stat label="Gainer shakes" value={formatNumber(shakes, 1)} />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Filled days are training days. A blue dot means the protein target was hit.</p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xl font-bold tabular">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function TrendCard({ overview, settings }: { overview: BulkOverview; settings: Settings }) {
  if (overview.weighIns.length < 2) return null;
  const data = overview.weighIns.slice(-90).map((w) => ({
    label: parseDayKey(w.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    weight: w.weight,
    avg: w.avg,
  }));
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{settings.goalWeight == null ? "Bodyweight trend" : "Trend vs goal"}</div>
      <div className="mt-3">
        <BodyweightChart data={data} goal={settings.goalWeight} unit={settings.unit} />
      </div>
    </Card>
  );
}

function HistoryList({ history, settings, onEdit }: { history: BulkDay[]; settings: Settings; onEdit: (d: BulkDay) => void }) {
  const [limit, setLimit] = React.useState(14);
  if (!history.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">Log</h2>
      <Card className="divide-y divide-border/60">
        {history.slice(0, limit).map((d) => (
          <button key={d.date} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-accent" onClick={() => onEdit(d)}>
            <div className="w-20 shrink-0 text-sm font-medium">
              {parseDayKey(d.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
            </div>
            <div className="flex-1 text-xs text-muted-foreground tabular">
              {formatNumber(d.protein)} g protein · {formatNumber(d.gainer, 1)} gainer
              {d.isTrainingDay && <span className="ml-1.5 text-primary">· trained</span>}
            </div>
            <div className="text-sm font-semibold tabular">{d.weight == null ? "—" : `${formatNumber(d.weight, 1)} ${settings.unit}`}</div>
          </button>
        ))}
      </Card>
      {history.length > limit && (
        <Button variant="ghost" className="w-full" onClick={() => setLimit((l) => l + 30)}>
          Show more
        </Button>
      )}
    </section>
  );
}

function DayEditor({ day, settings, onClose }: { day: BulkDay | null; settings: Settings; onClose: () => void }) {
  return (
    <Drawer open={!!day} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>{day && <DayForm key={day.date} day={day} settings={settings} onDone={onClose} />}</DrawerContent>
    </Drawer>
  );
}

function DayForm({ day, settings, onDone }: { day: BulkDay; settings: Settings; onDone: () => void }) {
  const [weight, setWeight] = React.useState(day.weight == null ? "" : String(day.weight));
  const [protein, setProtein] = React.useState(String(day.protein || ""));
  const [gainer, setGainer] = React.useState(day.gainer);
  const [trained, setTrained] = React.useState(day.trained);

  async function save() {
    const w = parseFloat(weight.replace(",", "."));
    const p = parseFloat(protein);
    await updateDailyLog(day.date, {
      weight: Number.isFinite(w) && w > 0 ? Math.round(w * 10) / 10 : null,
      protein: Number.isFinite(p) && p > 0 ? Math.round(p) : 0,
      gainer,
      trained,
    });
    toast.success("Saved");
    onDone();
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{parseDayKey(day.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</DrawerTitle>
        <DrawerDescription>Bodyweight, intake and training for this day.</DrawerDescription>
      </DrawerHeader>
      <div className="space-y-4 px-4">
        <div className="space-y-1.5">
          <Label htmlFor="bw">Bodyweight ({settings.unit})</Label>
          <Input
            id="bw"
            inputMode="decimal"
            placeholder="e.g. 72.4"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="h-12 text-lg"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="protein">Protein (g)</Label>
          <div className="flex gap-2">
            <Input id="protein" inputMode="numeric" placeholder="0" value={protein} onChange={(e) => setProtein(e.target.value)} />
            <Button variant="outline" onClick={() => setProtein(String((parseFloat(protein) || 0) + PROTEIN_STEP))}>
              +{PROTEIN_STEP}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label>Mass gainer servings</Label>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="icon-sm" aria-label="Less" onClick={() => setGainer((g) => Math.max(0, g - 0.5))}>
              <Minus />
            </Button>
            <span className="w-8 text-center font-semibold tabular">{formatNumber(gainer, 1)}</span>
            <Button variant="secondary" size="icon-sm" aria-label="More" onClick={() => setGainer((g) => g + 0.5)}>
              <Plus />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="trained">Training day</Label>
            {day.workouts > 0 && <div className="text-xs text-muted-foreground">A workout is logged, so this day counts already</div>}
          </div>
          <Switch id="trained" checked={trained || day.workouts > 0} disabled={day.workouts > 0} onCheckedChange={setTrained} />
        </div>
      </div>
      <DrawerFooter className="flex-row">
        {day.updatedAt > 0 && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete entry"
            className="text-destructive"
            onClick={async () => {
              await deleteDailyLog(day.date);
              toast("Entry deleted");
              onDone();
            }}
          >
            <Trash2 />
          </Button>
        )}
        <Button size="lg" className="flex-1" onClick={save}>
          Save
        </Button>
      </DrawerFooter>
    </>
  );
}

function GoalEditor({
  open,
  settings,
  suggested,
  onClose,
}: {
  open: boolean;
  settings: Settings;
  suggested: number | null;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>{open && <GoalForm settings={settings} suggested={suggested} onDone={onClose} />}</DrawerContent>
    </Drawer>
  );
}

function GoalForm({ settings, suggested, onDone }: { settings: Settings; suggested: number | null; onDone: () => void }) {
  const [goal, setGoal] = React.useState(settings.goalWeight == null ? "" : String(settings.goalWeight));

  async function save() {
    const g = parseFloat(goal.replace(",", "."));
    await updateSettings({ goalWeight: Number.isFinite(g) && g > 0 ? Math.round(g * 10) / 10 : null });
    onDone();
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Goal bodyweight</DrawerTitle>
        <DrawerDescription>The weight you are working toward. Leave it empty to just track your trend.</DrawerDescription>
      </DrawerHeader>
      <div className="space-y-1.5 px-4">
        <Label htmlFor="goal">Goal ({settings.unit})</Label>
        <Input
          id="goal"
          inputMode="decimal"
          placeholder={suggested == null ? "e.g. 75" : `Now ${formatNumber(suggested, 1)}`}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="h-12 text-lg"
        />
      </div>
      <DrawerFooter className="flex-row">
        {settings.goalWeight != null && (
          <Button
            variant="ghost"
            onClick={async () => {
              await updateSettings({ goalWeight: null });
              onDone();
            }}
          >
            Remove goal
          </Button>
        )}
        <Button size="lg" className="flex-1" onClick={save}>
          Save
        </Button>
      </DrawerFooter>
    </>
  );
}
