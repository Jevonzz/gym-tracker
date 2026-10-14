/**
 * Sports you can log next to gym workouts. Each sport is plain config, so adding
 * one (or a stat to an existing one) is a change here and nowhere else.
 */

export type SportStat =
  /** A single number, e.g. points or goals */
  | { key: string; label: string; type: "count" }
  /** A made / attempted pair, shown as a percentage, e.g. free throws */
  | { key: string; label: string; type: "ratio"; parts: [string, string] };

export interface SportDef {
  id: string;
  name: string;
  emoji: string;
  /** Session types, e.g. practice, training, match */
  kinds: string[];
  /** Suggested drills to tick off. Custom drills can be typed in too. */
  drills: string[];
  stats: SportStat[];
  /** Ask for distance, in this unit */
  distance?: "km" | "m";
}

export const SPORTS: SportDef[] = [
  {
    id: "basketball",
    name: "Basketball",
    emoji: "🏀",
    kinds: ["Shooting practice", "Skills training", "Conditioning", "Team practice", "Pickup game", "Match"],
    drills: [
      "Form shooting",
      "Free throws",
      "Mid-range",
      "Three-pointers",
      "Layups",
      "Mikan drill",
      "Ball handling",
      "Crossovers",
      "Footwork",
      "Defensive slides",
      "Rebounding",
      "Passing",
      "Suicides",
      "Scrimmage",
    ],
    stats: [
      { key: "ft", label: "Free throws", type: "ratio", parts: ["made", "attempted"] },
      { key: "fg2", label: "2-pointers", type: "ratio", parts: ["made", "attempted"] },
      { key: "fg3", label: "3-pointers", type: "ratio", parts: ["made", "attempted"] },
      { key: "points", label: "Points", type: "count" },
      { key: "rebounds", label: "Rebounds", type: "count" },
      { key: "assists", label: "Assists", type: "count" },
    ],
  },
  {
    id: "running",
    name: "Running",
    emoji: "🏃",
    kinds: ["Easy run", "Tempo", "Intervals", "Long run", "Race"],
    drills: ["Warm-up", "Strides", "Hill repeats", "Cool-down"],
    stats: [],
    distance: "km",
  },
  {
    id: "badminton",
    name: "Badminton",
    emoji: "🏸",
    kinds: ["Training", "Social game", "Match"],
    drills: ["Footwork", "Clears", "Smashes", "Drops", "Net play", "Serves", "Multi-shuttle"],
    stats: [{ key: "games", label: "Games won", type: "ratio", parts: ["won", "played"] }],
  },
  {
    id: "futsal",
    name: "Futsal",
    emoji: "⚽",
    kinds: ["Training", "Friendly", "Match"],
    drills: ["Passing", "Dribbling", "Shooting", "Rondo", "Small-sided game"],
    stats: [
      { key: "goals", label: "Goals", type: "count" },
      { key: "assists", label: "Assists", type: "count" },
    ],
  },
  {
    id: "swimming",
    name: "Swimming",
    emoji: "🏊",
    kinds: ["Technique", "Endurance", "Sprints"],
    drills: ["Freestyle", "Breaststroke", "Backstroke", "Kick sets", "Pull sets"],
    stats: [{ key: "laps", label: "Laps", type: "count" }],
    distance: "m",
  },
  {
    id: "cycling",
    name: "Cycling",
    emoji: "🚴",
    kinds: ["Commute", "Endurance", "Intervals"],
    drills: [],
    stats: [],
    distance: "km",
  },
  {
    id: "other",
    name: "Other",
    emoji: "🎯",
    kinds: ["Training", "Game"],
    drills: [],
    stats: [],
  },
];

export const DEFAULT_SPORT = "basketball";

export const getSport = (id: string) => SPORTS.find((s) => s.id === id) ?? SPORTS[SPORTS.length - 1];

/** Stat values are stored flat: `points`, or `ft.made` / `ft.attempted` for a ratio. */
export const statKey = (stat: SportStat, part?: string) => (part ? `${stat.key}.${part}` : stat.key);

export function ratio(stats: Record<string, number>, stat: Extract<SportStat, { type: "ratio" }>) {
  const made = stats[statKey(stat, stat.parts[0])];
  const total = stats[statKey(stat, stat.parts[1])];
  if (made == null || !total) return null;
  return { made, total, pct: Math.round((made / total) * 100) };
}

export const EFFORT_LABELS = ["Easy", "Moderate", "Hard", "Very hard", "Max"];
