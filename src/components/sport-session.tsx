"use client";

import * as React from "react";
import { Clock, Flame, MapPin, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWorkoutDate } from "@/components/workout-card";
import { useSportSession } from "@/hooks/use-data";
import { deleteSportSession, saveSportSession } from "@/lib/db/repo";
import type { SportSession } from "@/lib/db/types";
import { EFFORT_LABELS, getSport, ratio, SPORTS, statKey, type SportDef } from "@/lib/sports";
import { cn, formatDurationShort, formatNumber } from "@/lib/utils";

export const sportSessionName = (s: SportSession) => s.title || s.kind || getSport(s.sport).name;

/** Short stat lines for a session, e.g. "Free throws 18/25 · 72%" or "Points 14". */
function statLines(s: SportSession, sport: SportDef) {
  return sport.stats.flatMap((stat) => {
    if (stat.type === "ratio") {
      const r = ratio(s.stats, stat);
      return r ? [{ label: stat.label, value: `${r.made}/${r.total} · ${r.pct}%` }] : [];
    }
    const v = s.stats[statKey(stat)];
    return v == null ? [] : [{ label: stat.label, value: formatNumber(v) }];
  });
}

export function SportCard({ session, onClick }: { session: SportSession; onClick?: () => void }) {
  const sport = getSport(session.sport);
  const lines = statLines(session, sport);
  const name = sportSessionName(session);
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={cn("p-4 transition-colors", onClick && "cursor-pointer active:bg-accent/60")}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-400/15 text-xl" aria-hidden>
          {sport.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{name}</div>
          <div className="text-xs text-muted-foreground">
            {name !== sport.name && `${sport.name} · `}
            {formatWorkoutDate(session.startedAt)} ·{" "}
            {new Date(session.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </div>
        </div>
        {session.effort != null && <Badge variant="outline">{EFFORT_LABELS[session.effort - 1]}</Badge>}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" /> {formatDurationShort(session.durationMin * 60000)}
        </span>
        {session.distance != null && (
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" /> {formatNumber(session.distance, 2)} {sport.distance}
          </span>
        )}
        {session.drills.length > 0 && (
          <span className="flex items-center gap-1">
            <Flame className="size-3.5" /> {session.drills.length} drill{session.drills.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {(lines.length > 0 || session.drills.length > 0) && (
        <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-sm">
          {lines.slice(0, 4).map((l) => (
            <div key={l.label} className="flex justify-between gap-3">
              <span className="truncate">{l.label}</span>
              <span className="shrink-0 text-muted-foreground tabular">{l.value}</span>
            </div>
          ))}
          {lines.length === 0 && <div className="line-clamp-2 text-muted-foreground">{session.drills.join(" · ")}</div>}
        </div>
      )}
    </Card>
  );
}

/** `target` opens the drawer: a sport id to log a new session, or an existing session's id to edit it. */
export type SportTarget = { sport: string } | { id: string } | null;

export function SportSessionDrawer({ target, onClose }: { target: SportTarget; onClose: () => void }) {
  const editId = target && "id" in target ? target.id : null;
  const existing = useSportSession(editId);
  const ready = !!target && (!editId || existing !== undefined);
  return (
    <Drawer open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        {ready && (
          <SportForm
            key={editId ?? (target && "sport" in target ? target.sport : "")}
            session={existing ?? null}
            initialSport={target && "sport" in target ? target.sport : undefined}
            onDone={onClose}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

const DURATIONS = [30, 45, 60, 90, 120];

/** "YYYY-MM-DDTHH:mm" in local time, for a datetime-local input. */
function toLocalInput(ts: number) {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function parseNum(text: string) {
  const n = parseFloat(text.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function SportForm({ session, initialSport, onDone }: { session: SportSession | null; initialSport?: string; onDone: () => void }) {
  const [sportId, setSportId] = React.useState(session?.sport ?? initialSport ?? SPORTS[0].id);
  const sport = getSport(sportId);
  const [kind, setKind] = React.useState<string | null>(session?.kind ?? sport.kinds[0] ?? null);
  const [title, setTitle] = React.useState(session?.title ?? "");
  // Default to a session that just finished: an hour ago, for an hour.
  const [when, setWhen] = React.useState(() => toLocalInput(session?.startedAt ?? Date.now() - 3600000));
  const [duration, setDuration] = React.useState(String(session?.durationMin ?? 60));
  const [effort, setEffort] = React.useState<number | null>(session?.effort ?? null);
  const [distance, setDistance] = React.useState(session?.distance == null ? "" : String(session.distance));
  const [drills, setDrills] = React.useState<string[]>(session?.drills ?? []);
  const [customDrill, setCustomDrill] = React.useState("");
  const [stats, setStats] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(session?.stats ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [notes, setNotes] = React.useState(session?.notes ?? "");

  function pickSport(id: string) {
    if (id === sportId) return;
    const next = getSport(id);
    setSportId(id);
    setKind(next.kinds[0] ?? null);
    setDrills([]);
    setStats({});
  }

  const toggleDrill = (d: string) => setDrills((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]));
  const drillOptions = [...sport.drills, ...drills.filter((d) => !sport.drills.includes(d))];

  async function save() {
    const mins = parseNum(duration);
    const startedAt = new Date(when).getTime();
    if (!mins) return toast.error("Add how long the session was");
    if (!Number.isFinite(startedAt)) return toast.error("Pick when the session was");
    const parsed: Record<string, number> = {};
    for (const [k, v] of Object.entries(stats)) {
      const n = parseNum(v);
      if (n != null) parsed[k] = n;
    }
    for (const stat of sport.stats) {
      if (stat.type !== "ratio") continue;
      const made = parsed[statKey(stat, stat.parts[0])];
      const total = parsed[statKey(stat, stat.parts[1])];
      if (made != null && total != null && made > total) return toast.error(`${stat.label}: ${stat.parts[0]} can't be more than ${stat.parts[1]}`);
    }
    await saveSportSession(
      {
        sport: sportId,
        kind,
        title: sportId === "other" || session?.title ? title : undefined,
        startedAt,
        durationMin: Math.round(mins),
        effort,
        distance: sport.distance ? parseNum(distance) : null,
        drills,
        stats: parsed,
        notes,
      },
      session?.id,
    );
    toast.success(session ? "Session updated" : `${sport.name} session logged`);
    onDone();
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{session ? "Edit session" : "Log a session"}</DrawerTitle>
        <DrawerDescription>Training, practice or a game. Only the time is needed, the rest is optional.</DrawerDescription>
      </DrawerHeader>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {SPORTS.map((s) => (
            <Chip key={s.id} selected={s.id === sportId} onClick={() => pickSport(s.id)}>
              <span aria-hidden>{s.emoji}</span> {s.name}
            </Chip>
          ))}
        </div>

        {sportId === "other" && (
          <Field label="Activity" htmlFor="sport-title">
            <Input id="sport-title" placeholder="e.g. Volleyball, hiking" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        )}

        {sport.kinds.length > 0 && (
          <Field label="Type">
            <div className="flex flex-wrap gap-2">
              {sport.kinds.map((k) => (
                <Chip key={k} selected={k === kind} onClick={() => setKind(k === kind ? null : k)}>
                  {k}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Started" htmlFor="sport-when">
            <Input id="sport-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="text-sm" />
          </Field>
          <Field label="Minutes" htmlFor="sport-mins">
            <Input id="sport-mins" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
        </div>
        <div className="-mt-2 flex gap-2">
          {DURATIONS.map((m) => (
            <Chip key={m} small selected={duration === String(m)} onClick={() => setDuration(String(m))}>
              {m < 60 ? `${m}m` : `${m / 60}h`}
            </Chip>
          ))}
        </div>

        {sport.distance && (
          <Field label={`Distance (${sport.distance})`} htmlFor="sport-distance">
            <Input
              id="sport-distance"
              inputMode="decimal"
              placeholder={sport.distance === "km" ? "e.g. 5.2" : "e.g. 1500"}
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </Field>
        )}

        <Field label="Effort">
          <div className="grid grid-cols-5 gap-1.5">
            {EFFORT_LABELS.map((l, i) => (
              <Chip key={l} small selected={effort === i + 1} onClick={() => setEffort(effort === i + 1 ? null : i + 1)}>
                {l}
              </Chip>
            ))}
          </div>
        </Field>

        {sport.stats.length > 0 && (
          <Field label="Stats">
            <div className="divide-y divide-border/60 rounded-xl bg-muted/50">
              {sport.stats.map((stat) => (
                <div key={stat.key} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="flex-1">{stat.label}</span>
                  {stat.type === "ratio" ? (
                    <>
                      <StatInput stat={statKey(stat, stat.parts[0])} label={`${stat.label} ${stat.parts[0]}`} stats={stats} setStats={setStats} />
                      <span className="text-muted-foreground">/</span>
                      <StatInput stat={statKey(stat, stat.parts[1])} label={`${stat.label} ${stat.parts[1]}`} stats={stats} setStats={setStats} />
                    </>
                  ) : (
                    <StatInput stat={statKey(stat)} label={stat.label} stats={stats} setStats={setStats} />
                  )}
                </div>
              ))}
            </div>
            {sport.stats.some((s) => s.type === "ratio") && (
              <p className="mt-1.5 text-xs text-muted-foreground">Made / attempted. Fill in only what you tracked.</p>
            )}
          </Field>
        )}

        <Field label="Drills">
          <div className="flex flex-wrap gap-2">
            {drillOptions.map((d) => (
              <Chip key={d} small selected={drills.includes(d)} onClick={() => toggleDrill(d)}>
                {d}
              </Chip>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const d = customDrill.trim();
              if (d && !drills.includes(d)) setDrills([...drills, d]);
              setCustomDrill("");
            }}
          >
            <Input placeholder="Add your own drill" value={customDrill} onChange={(e) => setCustomDrill(e.target.value)} />
            <Button type="submit" variant="outline" size="icon" aria-label="Add drill" disabled={!customDrill.trim()}>
              <Plus />
            </Button>
          </form>
        </Field>

        <Field label="Notes" htmlFor="sport-notes">
          <textarea
            id="sport-notes"
            rows={3}
            placeholder="What went well, what to work on"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 md:text-sm"
          />
        </Field>
      </div>
      <DrawerFooter className="flex-row">
        {session && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete session"
            className="text-destructive"
            onClick={async () => {
              await deleteSportSession(session.id);
              toast("Session deleted");
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

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Chip({
  selected,
  small,
  onClick,
  children,
}: {
  selected: boolean;
  small?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-transparent font-medium whitespace-nowrap text-muted-foreground transition-colors active:scale-[0.97]",
        small ? "h-8 px-3 text-xs" : "h-9 px-3.5 text-sm",
        selected && "border-primary bg-primary text-primary-foreground",
      )}
    >
      {children}
    </button>
  );
}

function StatInput({
  stat,
  label,
  stats,
  setStats,
}: {
  stat: string;
  label: string;
  stats: Record<string, string>;
  setStats: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const value = stats[stat] ?? "";
  const set = (v: string) => setStats((s) => ({ ...s, [stat]: v }));
  const step = (d: number) => set(String(Math.max(0, (parseNum(value) ?? 0) + d)));
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Less ${label}`} className="size-7" onClick={() => step(-1)}>
        <Minus />
      </Button>
      <input
        aria-label={label}
        inputMode="numeric"
        placeholder="–"
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => /^\d*$/.test(e.target.value) && set(e.target.value)}
        className="h-8 w-11 rounded-lg bg-background text-center font-semibold tabular outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`More ${label}`} className="size-7" onClick={() => step(1)}>
        <Plus />
      </Button>
    </div>
  );
}
