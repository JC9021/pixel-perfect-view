export type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "custom";

export interface Chore {
  id: string;
  household_id: string;
  name: string;
  room: string | null;
  icon: string | null;
  frequency: Frequency;
  custom_days: number | null;
  estimated_minutes: number;
  difficulty: number;
  recurring: boolean;
  deadline: string | null;
  active: boolean;
}

export interface Member {
  id: string;
  user_id: string;
  color: string;
  display_name: string;
  avatar_url: string | null;
}

export interface Assignment {
  id: string;
  household_id: string;
  chore_id: string;
  user_id: string;
  week_start: string;
  due_date: string;
  points: number;
  completed_at: string | null;
}

/** How much harder a chore feels. Tunable in Settings later. */
export const DIFFICULTY_MULTIPLIER: Record<number, number> = {
  1: 1,
  2: 1.35,
  3: 1.75,
};

export const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Easy",
  2: "Medium",
  3: "Hard",
};

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  custom: "Custom",
};

/** Times this chore happens in a single week. */
export function timesPerWeek(chore: Pick<Chore, "frequency" | "custom_days">): number {
  switch (chore.frequency) {
    case "daily":
      return 7;
    case "weekly":
      return 1;
    case "biweekly":
      return 0.5;
    case "monthly":
      return 0.25;
    case "custom":
      return 7 / Math.max(1, chore.custom_days ?? 7);
    default:
      return 1;
  }
}

/** Points for ONE occurrence of the chore. */
export function occurrencePoints(chore: Pick<Chore, "estimated_minutes" | "difficulty">): number {
  const mult = DIFFICULTY_MULTIPLIER[chore.difficulty] ?? 1;
  return Math.round(chore.estimated_minutes * mult);
}

/** Average weekly workload of a chore: time x difficulty x frequency. */
export function weeklyPoints(chore: Chore): number {
  return Math.round(occurrencePoints(chore) * timesPerWeek(chore));
}

/* ---------- dates ---------- */

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday of the week containing `d`. */
export function startOfWeek(d = new Date()): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function weekIndex(weekStart: Date): number {
  const epoch = Date.UTC(2024, 0, 1);
  return Math.floor((Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()) - epoch) / 604800000);
}

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function friendlyDay(iso: string): string {
  const today = toISO(new Date());
  const tomorrow = toISO(addDays(new Date(), 1));
  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  const [y, m, d] = iso.split("-").map(Number);
  return DAY_NAMES[(new Date(y!, m! - 1, d!).getDay() + 6) % 7]!;
}

/* ---------- assignment generation ---------- */

export interface PlannedAssignment {
  chore_id: string;
  user_id: string;
  due_date: string;
  points: number;
}

interface Occurrence {
  chore: Chore;
  due: string;
  points: number;
}

/** Which occurrences of each chore fall inside this week, and on which day. */
function occurrencesForWeek(chores: Chore[], weekStart: Date): Occurrence[] {
  const idx = weekIndex(weekStart);
  const out: Occurrence[] = [];

  chores.forEach((chore, i) => {
    if (!chore.active) return;
    const pts = occurrencePoints(chore);

    if (chore.frequency === "daily") {
      for (let d = 0; d < 7; d++) out.push({ chore, due: toISO(addDays(weekStart, d)), points: pts });
      return;
    }
    if (chore.frequency === "custom") {
      const every = Math.max(1, chore.custom_days ?? 7);
      for (let d = 0; d < 7; d++) {
        const dayNumber = idx * 7 + d;
        if (dayNumber % every === 0) out.push({ chore, due: toISO(addDays(weekStart, d)), points: pts });
      }
      return;
    }
    if (chore.frequency === "biweekly" && idx % 2 !== 0) return;
    if (chore.frequency === "monthly" && idx % 4 !== 0) return;

    // spread one-per-week chores across the week so no single day is stacked
    const day = (i * 2) % 7;
    out.push({ chore, due: toISO(addDays(weekStart, day)), points: pts });
  });

  return out;
}

function shuffled<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Greedy "longest processing time first" split: heaviest chores go to whoever
 * currently carries the least. Rotation shifts who gets first pick each week so
 * nobody is stuck with the same chore forever.
 */
export function buildAssignments(options: {
  chores: Chore[];
  members: Member[];
  weekStart: Date;
  rotate: boolean;
  seed?: number;
}): PlannedAssignment[] {
  const { chores, members, weekStart, rotate, seed } = options;
  if (members.length === 0) return [];

  const idx = weekIndex(weekStart);
  let order = [...members].sort((a, b) => a.user_id.localeCompare(b.user_id));
  if (seed !== undefined) order = shuffled(order, seed);
  else if (rotate) {
    const shift = idx % order.length;
    order = [...order.slice(shift), ...order.slice(0, shift)];
  }

  const load = new Map<string, number>(order.map((m) => [m.user_id, 0]));
  const occurrences = occurrencesForWeek(chores, weekStart).sort((a, b) => b.points - a.points);

  return occurrences.map((occ) => {
    let best = order[0]!;
    for (const m of order) {
      if ((load.get(m.user_id) ?? 0) < (load.get(best.user_id) ?? 0)) best = m;
    }
    load.set(best.user_id, (load.get(best.user_id) ?? 0) + occ.points);
    return {
      chore_id: occ.chore.id,
      user_id: best.user_id,
      due_date: occ.due,
      points: occ.points,
    };
  });
}

/* ---------- fairness ---------- */

export interface FairnessRow {
  member: Member;
  points: number;
  chores: number;
  minutes: number;
  share: number;
}

export function fairnessRows(members: Member[], assignments: Assignment[], chores: Chore[]): FairnessRow[] {
  const choreById = new Map(chores.map((c) => [c.id, c]));
  const total = assignments.reduce((sum, a) => sum + Number(a.points), 0) || 1;

  return members.map((member) => {
    const mine = assignments.filter((a) => a.user_id === member.user_id);
    const points = mine.reduce((sum, a) => sum + Number(a.points), 0);
    const minutes = mine.reduce((sum, a) => sum + (choreById.get(a.chore_id)?.estimated_minutes ?? 0), 0);
    return { member, points, chores: mine.length, minutes, share: points / total };
  });
}

export function fairnessVerdict(rows: FairnessRow[]): { headline: string; detail: string; balanced: boolean } {
  const active = rows.filter((r) => r.points > 0);
  if (active.length < 2) {
    return {
      headline: "Nothing to compare yet",
      detail: "Add roommates and generate a schedule to see how the workload is split.",
      balanced: true,
    };
  }
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  const top = sorted[0]!;
  const bottom = sorted[sorted.length - 1]!;
  const gap = top.points - bottom.points;
  const pct = bottom.points > 0 ? Math.round((gap / bottom.points) * 100) : 100;

  if (pct <= 15) {
    return {
      headline: "Well balanced",
      detail: `Everyone is within ${pct}% of each other — the heaviest load is ${top.points} points and the lightest is ${bottom.points}.`,
      balanced: true,
    };
  }
  return {
    headline: "Slightly uneven",
    detail: `${top.member.display_name} has about ${pct}% more workload than ${bottom.member.display_name} (${top.points} vs ${bottom.points} points). A shuffle would even it out.`,
    balanced: false,
  };
}

/* ---------- starter chores ---------- */

export interface ChoreTemplate {
  name: string;
  room: string;
  icon: string;
  frequency: Frequency;
  estimated_minutes: number;
  difficulty: number;
}

export const CHORE_TEMPLATES: ChoreTemplate[] = [
  { name: "Take out trash", room: "Entry", icon: "🗑️", frequency: "daily", estimated_minutes: 5, difficulty: 1 },
  { name: "Wash dishes", room: "Kitchen", icon: "🍽️", frequency: "daily", estimated_minutes: 20, difficulty: 2 },
  { name: "Clean kitchen", room: "Kitchen", icon: "🧽", frequency: "weekly", estimated_minutes: 35, difficulty: 3 },
  { name: "Vacuum", room: "Common", icon: "🧹", frequency: "weekly", estimated_minutes: 25, difficulty: 2 },
  { name: "Mop floors", room: "Common", icon: "🪣", frequency: "biweekly", estimated_minutes: 30, difficulty: 3 },
  { name: "Clean bathroom", room: "Bathroom", icon: "🚿", frequency: "weekly", estimated_minutes: 30, difficulty: 3 },
  { name: "Do laundry", room: "Laundry", icon: "🧺", frequency: "weekly", estimated_minutes: 40, difficulty: 2 },
  { name: "Buy groceries", room: "Out", icon: "🛒", frequency: "weekly", estimated_minutes: 45, difficulty: 2 },
  { name: "Clean common areas", room: "Living room", icon: "🛋️", frequency: "weekly", estimated_minutes: 20, difficulty: 1 },
  { name: "Change bedsheets", room: "Bedrooms", icon: "🛏️", frequency: "monthly", estimated_minutes: 15, difficulty: 1 },
];

export const MEMBER_COLORS = ["teal", "amber", "plum", "rose", "accent"] as const;

export function colorClasses(color: string): string {
  switch (color) {
    case "amber":
      return "bg-amber";
    case "plum":
      return "bg-plum";
    case "rose":
      return "bg-rose";
    case "accent":
      return "bg-accent";
    default:
      return "bg-teal";
  }
}

export function makeInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
