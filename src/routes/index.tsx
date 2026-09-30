import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ChoreRow } from "@/components/ChoreRow";
import {
  useAssignments,
  useChores,
  useHousehold,
} from "@/hooks/useChoreMate";
import { useAuth } from "@/hooks/useAuth";
import { startOfWeek, toISO, friendlyDay } from "@/lib/chore-logic";
import { regenerateWeek } from "@/lib/schedule-actions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function Dashboard() {
  const { user } = useAuth();
  const { data: hhData } = useHousehold();
  const weekStart = startOfWeek();
  const { data: chores = [] } = useChores(hhData?.household?.id);
  const { data: assignments = [] } = useAssignments(
    hhData?.household?.id,
    weekStart,
  );
  const queryClient = useQueryClient();

  const regenerate = useMutation({
    mutationFn: () =>
      regenerateWeek({
        householdId: hhData!.household!.id,
        chores,
        members: hhData!.members,
        weekStart,
        rotate: hhData!.household!.rotation_enabled,
      }),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast.success(count ? `Assigned ${count} chores` : "Week up to date");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const days = DAY_NAMES.map((_, i) => {
    const iso = toISO(new Date(weekStart.getTime() + i * DAY_MS));
    return {
      iso,
      label: friendlyDay(iso),
      items: assignments.filter((a) => a.due_date === iso),
    };
  });

  return (
    <div className="space-y-6 animate-rise">
      <div className="frost flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">This week</h2>
          <p className="font-mono text-xs text-muted-foreground">
            {toISO(weekStart)}
          </p>
        </div>
        <Button
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending || !hhData?.household}
        >
          {regenerate.isPending ? "Generating…" : "Generate week"}
        </Button>
      </div>

      {assignments.length === 0 && (
        <div className="tile p-6 text-center text-muted-foreground">
          No chores assigned yet. Tap “Generate week” to get started.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {days.map((day) => (
          <section key={day.iso} className="tile space-y-3 p-4">
            <h3 className="font-display font-semibold">
              {day.label}{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {day.iso}
              </span>
            </h3>
            {day.items.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing due.</p>
            )}
            {day.items.map((a) => (
              <ChoreRow
                key={a.id}
                assignment={a}
                chore={chores.find((c) => c.id === a.chore_id)}
                member={hhData?.members.find((m) => m.user_id === a.user_id)}
                currentUserId={user!.id}
                showDay={false}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
