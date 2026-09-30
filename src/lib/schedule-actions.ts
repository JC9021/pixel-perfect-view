import { supabase } from "@/integrations/supabase/client";
import { buildAssignments, toISO, type Chore, type Member } from "@/lib/chore-logic";

/**
 * Rebuilds the week's schedule. Chores already ticked off stay put; everything
 * still outstanding is redistributed as evenly as possible.
 */
export async function regenerateWeek(options: {
  householdId: string;
  chores: Chore[];
  members: Member[];
  weekStart: Date;
  rotate: boolean;
  shuffle?: boolean;
}) {
  const { householdId, chores, members, weekStart, rotate, shuffle } = options;
  const week = toISO(weekStart);

  const { data: existing, error: readError } = await supabase
    .from("assignments")
    .select("id, chore_id, due_date, completed_at")
    .eq("household_id", householdId)
    .eq("week_start", week);
  if (readError) throw readError;

  const done = (existing ?? []).filter((a) => a.completed_at);
  const doneKeys = new Set(done.map((a) => `${a.chore_id}|${a.due_date}`));
  const staleIds = (existing ?? []).filter((a) => !a.completed_at).map((a) => a.id);

  if (staleIds.length) {
    const { error } = await supabase.from("assignments").delete().in("id", staleIds);
    if (error) throw error;
  }

  const plan = buildAssignments({
    chores,
    members,
    weekStart,
    rotate,
    ...(shuffle ? { seed: Math.floor(Math.random() * 1_000_000) + 1 } : {}),
  }).filter((p) => !doneKeys.has(`${p.chore_id}|${p.due_date}`));

  if (plan.length) {
    const { error } = await supabase.from("assignments").insert(
      plan.map((p) => ({
        household_id: householdId,
        chore_id: p.chore_id,
        user_id: p.user_id,
        week_start: week,
        due_date: p.due_date,
        points: p.points,
      })),
    );
    if (error) throw error;
  }

  return plan.length;
}
