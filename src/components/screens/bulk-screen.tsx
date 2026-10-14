"use client";

import * as React from "react";
import { Beef, Check, ChevronLeft, CupSoda, Dumbbell, Flame, Minus, Plus, Scale, Search, Target, Trash2, Utensils, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { EmptyState, PageHeader } from "@/components/page-header";
import { BodyweightChart } from "@/components/charts";
import { TrainingPicker } from "@/components/training-picker";
import { useBulkOverview, useFoods, useSettings } from "@/hooks/use-data";
import { autoTargets, type BulkDay, type BulkOverview, type DailyTargets } from "@/lib/db/queries";
import { addIntake, deleteDailyLog, deleteFood, deleteFoodEntry, logFood, saveFood, updateDailyLog, updateSettings } from "@/lib/db/repo";
import type { FoodEntry, Settings } from "@/lib/db/types";
import { FOOD_PRESETS } from "@/lib/food-data";
import { cn, formatNumber, parseDayKey } from "@/lib/utils";

const PROTEIN_STEP = 25;

export function BulkScreen() {
  const overview = useBulkOverview();
  const settings = useSettings();
  const [editing, setEditing] = React.useState<BulkDay | null>(null);
  const [editingGoal, setEditingGoal] = React.useState(false);
  const [addingFoodFor, setAddingFoodFor] = React.useState<string | null>(null);
  const [addingGainer, setAddingGainer] = React.useState(false);
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
          <TodayCard
            day={overview.today}
            settings={settings}
            targets={overview.targets}
            onEdit={() => setEditing(overview.today)}
            onAddFood={() => setAddingFoodFor(overview.today.date)}
            onAddGainer={() => setAddingGainer(true)}
          />
          <WeekCard week={overview.week} proteinTarget={overview.targets.protein} onEdit={setEditing} />
          <TrendCard overview={overview} settings={settings} />
          <HistoryList history={overview.history} settings={settings} onEdit={setEditing} />
        </>
      )}
      <DayEditor
        day={editing && overview ? (overview.history.find((d) => d.date === editing.date) ?? editing) : editing}
        settings={settings}
        onClose={() => setEditing(null)}
        onAddFood={(date) => {
          setEditing(null);
          setAddingFoodFor(date);
        }}
      />
      <FoodDrawer date={addingFoodFor} onClose={() => setAddingFoodFor(null)} />
      <GainerDrawer
        date={addingGainer ? (overview?.today.date ?? null) : null}
        settings={settings}
        onClose={() => setAddingGainer(false)}
      />
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

function TodayCard({
  day,
  settings,
  targets,
  onEdit,
  onAddFood,
  onAddGainer,
}: {
  day: BulkDay;
  settings: Settings;
  targets: DailyTargets;
  onEdit: () => void;
  onAddFood: () => void;
  onAddGainer: () => void;
}) {
  const { unit, gainerTarget } = settings;
  const { protein: proteinTarget, kcal: calorieTarget } = targets;
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
          value={day.trainedAs?.length ? day.trainedAs.join(", ") : day.workouts > 0 ? "Workout logged" : day.trained ? "Trained" : "Rest day"}
          done={day.isTrainingDay}
          onClick={day.workouts > 0 ? undefined : () => updateDailyLog(day.date, day.trained ? { trained: false, trainedAs: [] } : { trained: true })}
        />
        <Tile
          icon={<Flame />}
          label="Calories"
          value={
            calorieTarget == null
              ? `${formatNumber(day.totalKcal)} kcal`
              : `${formatNumber(day.totalKcal)} / ${formatNumber(calorieTarget)}`
          }
          done={calorieTarget != null && day.totalKcal >= calorieTarget}
          progress={calorieTarget == null ? undefined : day.totalKcal / calorieTarget}
        />
        <Tile
          icon={<Beef />}
          label="Protein"
          value={`${formatNumber(day.totalProtein)} / ${formatNumber(proteinTarget)} g`}
          done={day.totalProtein >= proteinTarget}
          progress={day.totalProtein / proteinTarget}
        />
        <Tile
          className="col-span-2"
          icon={<CupSoda />}
          label={settings.gainerName || "Mass gainer"}
          value={
            `${formatNumber(day.gainer, 2)} / ${formatNumber(gainerTarget, 2)} servings` +
            (gainerSetUp(settings) ? ` · ${formatNumber(day.gainer * settings.gainerKcal)} kcal` : " · tap to set calories")
          }
          done={day.gainer >= gainerTarget}
          progress={day.gainer / gainerTarget}
          onClick={onAddGainer}
        />
      </div>
      {targets.auto && (
        <p className="text-[11px] text-muted-foreground">
          Targets worked out from your bodyweight{settings.goalWeight == null ? "" : " and goal"}. Change this in Settings.
        </p>
      )}
      <Button className="w-full" onClick={onAddFood}>
        <Utensils /> Add food
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => addIntake(day.date, { protein: PROTEIN_STEP })}>
          <Plus /> {PROTEIN_STEP} g protein
        </Button>
        <Button variant="outline" onClick={onAddGainer}>
          <Plus /> Gainer shake
        </Button>
      </div>
      <FoodEntryList entries={day.entries} />
    </Card>
  );
}

function FoodEntryList({ entries }: { entries: FoodEntry[] }) {
  if (!entries.length) return null;
  return (
    <ul className="divide-y divide-border/60 rounded-xl bg-muted/40">
      {entries.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-2 pr-1 pl-3">
          <span className="min-w-0 flex-1 truncate text-sm">{e.name}</span>
          <span className="text-xs text-muted-foreground tabular">
            {formatNumber(e.kcal)} kcal · {formatNumber(e.protein)} g
          </span>
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${e.name}`} onClick={() => deleteFoodEntry(e.id)}>
            <X />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Tile({
  icon,
  label,
  value,
  done,
  progress,
  onClick,
  className,
}: {
  className?: string;
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
        className,
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

function WeekCard({ week, proteinTarget, onEdit }: { week: BulkDay[]; proteinTarget: number; onEdit: (d: BulkDay) => void }) {
  const trainingDays = week.filter((d) => d.isTrainingDay).length;
  const avgProtein = week.reduce((a, d) => a + d.totalProtein, 0) / week.length;
  const avgKcal = week.reduce((a, d) => a + d.totalKcal, 0) / week.length;
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
                className={cn("size-1.5 rounded-full bg-transparent", d.totalProtein >= proteinTarget && "bg-chart-2")}
                aria-label={d.totalProtein >= proteinTarget ? "Protein target hit" : undefined}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 divide-x divide-border/60 rounded-xl bg-muted/40 py-3 text-center">
        <Stat label="Training days" value={trainingDays} />
        <Stat label="Avg protein (g)" value={formatNumber(avgProtein)} />
        {avgKcal > 0 ? (
          <Stat label="Avg kcal" value={formatNumber(avgKcal)} />
        ) : (
          <Stat label="Gainer shakes" value={formatNumber(shakes, 1)} />
        )}
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
              {d.totalKcal > 0 && `${formatNumber(d.totalKcal)} kcal · `}
              {formatNumber(d.totalProtein)} g protein · {formatNumber(d.gainer, 1)} gainer
              {d.isTrainingDay && <span className="ml-1.5 text-primary">· {d.trainedAs?.length ? d.trainedAs.join(", ") : "trained"}</span>}
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

function DayEditor({
  day,
  settings,
  onClose,
  onAddFood,
}: {
  day: BulkDay | null;
  settings: Settings;
  onClose: () => void;
  onAddFood: (date: string) => void;
}) {
  return (
    <Drawer open={!!day} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        {day && <DayForm key={day.date} day={day} settings={settings} onDone={onClose} onAddFood={() => onAddFood(day.date)} />}
      </DrawerContent>
    </Drawer>
  );
}

function DayForm({ day, settings, onDone, onAddFood }: { day: BulkDay; settings: Settings; onDone: () => void; onAddFood: () => void }) {
  const [weight, setWeight] = React.useState(day.weight == null ? "" : String(day.weight));
  const [protein, setProtein] = React.useState(String(day.protein || ""));
  const [gainer, setGainer] = React.useState(day.gainer);
  const [trained, setTrained] = React.useState(day.trained);
  const [trainedAs, setTrainedAs] = React.useState(day.trainedAs ?? []);

  async function save() {
    const w = parseFloat(weight.replace(",", "."));
    const p = parseFloat(protein);
    await updateDailyLog(day.date, {
      weight: Number.isFinite(w) && w > 0 ? Math.round(w * 10) / 10 : null,
      protein: Number.isFinite(p) && p > 0 ? Math.round(p) : 0,
      gainer,
      trained: trained || trainedAs.length > 0,
      trainedAs: trained ? trainedAs : [],
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
          <Label htmlFor="protein">Extra protein (g)</Label>
          <div className="flex gap-2">
            <Input id="protein" inputMode="numeric" placeholder="0" value={protein} onChange={(e) => setProtein(e.target.value)} />
            <Button variant="outline" onClick={() => setProtein(String((parseFloat(protein) || 0) + PROTEIN_STEP))}>
              +{PROTEIN_STEP}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Food · {formatNumber(day.entries.reduce((a, e) => a + e.kcal, 0))} kcal</Label>
            <Button variant="outline" size="sm" onClick={onAddFood}>
              <Utensils /> Add food
            </Button>
          </div>
          <FoodEntryList entries={day.entries} />
        </div>
        <div className="flex items-center justify-between">
          <Label>{settings.gainerName || "Mass gainer"} servings</Label>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="icon-sm" aria-label="Less" onClick={() => setGainer((g) => Math.max(0, g - 0.25))}>
              <Minus />
            </Button>
            <span className="w-10 text-center font-semibold tabular">{formatNumber(gainer, 2)}</span>
            <Button variant="secondary" size="icon-sm" aria-label="More" onClick={() => setGainer((g) => g + 0.25)}>
              <Plus />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="trained">Training day</Label>
            {day.workouts > 0 && <div className="text-xs text-muted-foreground">A workout is logged, so this day counts already</div>}
          </div>
          <Switch id="trained" checked={trained || day.workouts > 0} disabled={day.workouts > 0}
            onCheckedChange={(on) => {
              setTrained(on);
              if (!on) setTrainedAs([]);
            }}
          />
        </div>
        <TrainingPicker
          value={trainedAs}
          onToggle={(t) => {
            const next = trainedAs.includes(t) ? trainedAs.filter((x) => x !== t) : [...trainedAs, t];
            setTrainedAs(next);
            if (next.length) setTrained(true);
          }}
        />
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

  const g = parseFloat(goal.replace(",", "."));
  const parsed = Number.isFinite(g) && g > 0 ? Math.round(g * 10) / 10 : null;
  const preview = settings.autoTargets && suggested != null ? autoTargets(suggested, parsed, settings.unit) : null;

  async function save() {
    await updateSettings({ goalWeight: parsed });
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
        {preview && (
          <p className="pt-1 text-sm text-muted-foreground tabular">
            Daily target: <span className="font-semibold text-foreground">{formatNumber(preview.kcal)} kcal</span> and{" "}
            <span className="font-semibold text-foreground">{formatNumber(preview.protein)} g protein</span>
          </p>
        )}
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

function FoodDrawer({ date, onClose }: { date: string | null; onClose: () => void }) {
  return (
    <Drawer open={!!date} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>{date && <FoodForm date={date} onDone={onClose} />}</DrawerContent>
    </Drawer>
  );
}

const PORTIONS = [0.5, 1, 1.5, 2];

interface FoodPick {
  name: string;
  serving?: string;
  kcal: number;
  protein: number;
  foodId?: string;
}

function FoodForm({ date, onDone }: { date: string; onDone: () => void }) {
  const foods = useFoods();
  const [tab, setTab] = React.useState<"search" | "quick">("search");
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<FoodPick | null>(null);
  const [portion, setPortion] = React.useState(1);
  const [name, setName] = React.useState("");
  const [kcal, setKcal] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [remember, setRemember] = React.useState(true);

  const q = query.trim().toLowerCase();
  const matches = (n: string) => !q || q.split(/\s+/).every((w) => n.toLowerCase().includes(w));
  const mine = (foods ?? []).filter((f) => matches(f.name));
  const presets = FOOD_PRESETS.filter((f) => matches(f.name));

  async function quickAdd() {
    const k = Math.max(0, Math.round(parseFloat(kcal) || 0));
    const p = Math.max(0, Math.round(parseFloat(protein) || 0));
    if (!k && !p) {
      toast.error("Enter calories or protein");
      return;
    }
    const label = name.trim();
    await logFood(date, { name: label, kcal: k, protein: p });
    if (remember && label) await saveFood({ name: label, kcal: k, protein: p });
    toast.success(`Added ${label || "food"}`);
    onDone();
  }

  async function addPicked() {
    if (!picked) return;
    const label = portion === 1 ? picked.name : `${picked.name} ×${formatNumber(portion, 1)}`;
    await logFood(date, {
      name: label,
      kcal: Math.round(picked.kcal * portion),
      protein: Math.round(picked.protein * portion),
      foodId: picked.foodId,
    });
    toast.success(`Added ${label}`);
    onDone();
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Add food</DrawerTitle>
        <DrawerDescription>
          {parseDayKey(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </DrawerDescription>
      </DrawerHeader>
      <div className="px-4">
        <Segmented
          className="w-full"
          value={tab}
          onChange={(t) => {
            setTab(t);
            setPicked(null);
          }}
          options={[
            { value: "search", label: "Find food" },
            { value: "quick", label: "Quick add" },
          ]}
        />
      </div>
      {tab === "search" && picked ? (
        <div className="mt-3 space-y-4 px-4">
          <button className="flex items-center gap-1 text-sm text-muted-foreground" onClick={() => setPicked(null)}>
            <ChevronLeft className="size-4" /> Back to list
          </button>
          <div>
            <div className="text-lg font-semibold">{picked.name}</div>
            {picked.serving && <div className="text-sm text-muted-foreground">Per {picked.serving}</div>}
          </div>
          <div className="space-y-1.5">
            <Label>Portion</Label>
            <Segmented
              className="w-full"
              value={String(portion)}
              onChange={(v) => setPortion(Number(v))}
              options={PORTIONS.map((p) => ({ value: String(p), label: `×${formatNumber(p, 1)}` }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Tile icon={<Flame />} label="Calories" value={`${formatNumber(picked.kcal * portion)} kcal`} />
            <Tile icon={<Beef />} label="Protein" value={`${formatNumber(picked.protein * portion)} g`} />
          </div>
        </div>
      ) : tab === "search" ? (
        <div className="mt-3 px-4">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search food"
              placeholder="Search, e.g. nasi lemak"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <ul className="mt-2 max-h-[45dvh] divide-y divide-border/60 overflow-y-auto">
            {mine.length > 0 && <li className="pt-2 pb-1 text-xs font-semibold text-muted-foreground">My foods</li>}
            {mine.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <FoodRow
                  name={f.name}
                  kcal={f.kcal}
                  protein={f.protein}
                  onClick={() => {
                    setPortion(1);
                    setPicked({ name: f.name, kcal: f.kcal, protein: f.protein, foodId: f.id });
                  }}
                />
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${f.name}`} onClick={() => deleteFood(f.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
            {presets.length > 0 && <li className="pt-3 pb-1 text-xs font-semibold text-muted-foreground">Common foods</li>}
            {presets.map((f) => (
              <li key={f.name}>
                <FoodRow
                  name={f.name}
                  serving={f.serving}
                  kcal={f.kcal}
                  protein={f.protein}
                  onClick={() => {
                    setPortion(1);
                    setPicked(f);
                  }}
                />
              </li>
            ))}
            {!mine.length && !presets.length && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                Nothing found.{" "}
                <button
                  className="font-medium text-primary"
                  onClick={() => {
                    setName(query.trim());
                    setTab("quick");
                  }}
                >
                  Add it yourself
                </button>
              </li>
            )}
          </ul>
        </div>
      ) : (
        <div className="mt-3 space-y-3 px-4">
          <div className="space-y-1.5">
            <Label htmlFor="food-name">Name</Label>
            <Input id="food-name" placeholder="e.g. Chicken rice" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="food-kcal">Calories (kcal)</Label>
              <Input id="food-kcal" inputMode="numeric" placeholder="0" value={kcal} onChange={(e) => setKcal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="food-protein">Protein (g)</Label>
              <Input id="food-protein" inputMode="numeric" placeholder="0" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="remember">Save to My foods</Label>
            <Switch id="remember" checked={remember} onCheckedChange={setRemember} />
          </div>
          <p className="text-xs text-muted-foreground">Not sure of the numbers? Use Find food to pick something close.</p>
        </div>
      )}
      <DrawerFooter>
        {tab === "quick" ? (
          <Button size="lg" onClick={quickAdd}>
            Add
          </Button>
        ) : picked ? (
          <Button size="lg" onClick={addPicked}>
            Add {formatNumber(picked.kcal * portion)} kcal
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Calories are typical estimates; portions vary.</p>
        )}
      </DrawerFooter>
    </>
  );
}

function FoodRow({
  name,
  serving,
  kcal,
  protein,
  onClick,
}: {
  name: string;
  serving?: string;
  kcal: number;
  protein: number;
  onClick: () => void;
}) {
  return (
    <button className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left active:opacity-70" onClick={onClick}>
      <Plus className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name}</span>
        {serving && <span className="block text-xs text-muted-foreground">{serving}</span>}
      </span>
      <span className="shrink-0 text-right text-xs text-muted-foreground tabular">
        {formatNumber(kcal)} kcal
        <br />
        {formatNumber(protein)} g protein
      </span>
    </button>
  );
}

const gainerSetUp = (s: Settings) => s.gainerKcal > 0 || s.gainerProtein > 0;

const GAINER_PORTIONS = [
  { value: 0.25, label: "¼" },
  { value: 0.5, label: "½" },
  { value: 0.75, label: "¾" },
  { value: 1, label: "1" },
  { value: 1.5, label: "1½" },
  { value: 2, label: "2" },
];

function GainerDrawer({ date, settings, onClose }: { date: string | null; settings: Settings; onClose: () => void }) {
  return (
    <Drawer open={!!date} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>{date && <GainerForm date={date} settings={settings} onDone={onClose} />}</DrawerContent>
    </Drawer>
  );
}

/** Log a gainer shake by portion. The shake's calories and protein per serving are editable here, since every brand differs. */
function GainerForm({ date, settings, onDone }: { date: string; settings: Settings; onDone: () => void }) {
  const [portion, setPortion] = React.useState(1);
  const [editing, setEditing] = React.useState(!gainerSetUp(settings));
  const [name, setName] = React.useState(settings.gainerName);
  const [kcal, setKcal] = React.useState(settings.gainerKcal ? String(settings.gainerKcal) : "");
  const [protein, setProtein] = React.useState(settings.gainerProtein ? String(settings.gainerProtein) : "");
  const k = Math.max(0, parseFloat(kcal) || 0);
  const p = Math.max(0, parseFloat(protein.replace(",", ".")) || 0);
  const label = name.trim() || "Mass gainer";

  async function log() {
    if (k !== settings.gainerKcal || p !== settings.gainerProtein || name.trim() !== settings.gainerName) {
      await updateSettings({ gainerKcal: Math.round(k), gainerProtein: Math.round(p * 10) / 10, gainerName: name.trim() });
    }
    await addIntake(date, { gainer: portion });
    toast.success(`${GAINER_PORTIONS.find((x) => x.value === portion)?.label ?? portion} ${label} logged`, {
      description: k || p ? `${formatNumber(k * portion)} kcal · ${formatNumber(p * portion)} g protein` : undefined,
    });
    onDone();
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{label}</DrawerTitle>
        <DrawerDescription>
          {k || p ? `${formatNumber(k)} kcal · ${formatNumber(p, 1)} g protein per serving` : "Add your shake's calories and protein so they count toward today."}
        </DrawerDescription>
      </DrawerHeader>
      <div className="space-y-4 px-4">
        <div className="space-y-1.5">
          <Label>How much?</Label>
          <div className="grid grid-cols-6 gap-1.5">
            {GAINER_PORTIONS.map((x) => (
              <button
                key={x.value}
                type="button"
                aria-pressed={portion === x.value}
                onClick={() => setPortion(x.value)}
                className={cn(
                  "h-11 rounded-xl border border-border text-base font-semibold text-muted-foreground active:scale-[0.97]",
                  portion === x.value && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Servings. One serving is what your tub&apos;s label says.</p>
        </div>
        {editing ? (
          <div className="space-y-3 rounded-xl bg-muted/50 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-name">Name</Label>
              <Input id="g-name" placeholder="e.g. Serious Mass" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-kcal">kcal per serving</Label>
                <Input id="g-kcal" inputMode="numeric" placeholder="e.g. 1250" value={kcal} onChange={(e) => setKcal(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-protein">Protein (g)</Label>
                <Input id="g-protein" inputMode="decimal" placeholder="e.g. 50" value={protein} onChange={(e) => setProtein(e.target.value)} />
              </div>
            </div>
          </div>
        ) : (
          <button type="button" className="text-sm font-medium text-primary" onClick={() => setEditing(true)}>
            Change shake or values
          </button>
        )}
      </div>
      <DrawerFooter>
        <Button size="lg" onClick={log}>
          Log {formatNumber(k * portion)} kcal · {formatNumber(p * portion)} g protein
        </Button>
      </DrawerFooter>
    </>
  );
}
