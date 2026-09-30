import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ChoreRow } from "@/components/ChoreRow";
import {
  useAssignments,
  useChores,
  useHousehold,
} from "@/hooks/useChoreMate";
import { useAuth } from "@/hooks/useAuth";
import { startOfWeek } from "@/lib/chore-logic";

export const Route = createFileRoute("/my-chores")({
  component: MyChoresPage,
});

function MyChoresPage() {
  return (
    <AppShell>
      <MyChores />
    </AppShell>
  );
}

function MyChores() {
  const { user } = useAuth();
  const { data: hhData } = useHousehold();
  const weekStart = startOfWeek();
  const { data: chores = [] } = useChores(hhData?.household?.id);
  const { data: assignments = [] } = useAssignments(
    hhData?.household?.id,
    weekStart,
  );

  const mine = assignments.filter((a) => a.user_id === user!.id);
  const done = mine.filter((a) => a.completed_at);
  const pending = mine.filter((a) => !a.completed_at);
  const me = hhData?.members.find((m) => m.user_id === user!.id);

  return (
    <div className="space-y-6 animate-rise">
      <div className="frost p-5">
        <h2 className="font-display text-2xl font-bold">My chores</h2>
        <p className="font-mono text-xs text-muted-foreground">
          {done.length}/{mine.length} done this week
        </p>
      </div>

      {pending.length === 0 && mine.length > 0 && (
        <div className="tile p-6 text-center text-muted-foreground">
          All caught up. Nice work.
        </div>
      )}

      {pending.map((a) => (
        <ChoreRow
          key={a.id}
          assignment={a}
          chore={chores.find((c) => c.id === a.chore_id)}
          member={me}
          currentUserId={user!.id}
          showDay
        />
      ))}

      {done.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display font-semibold text-muted-foreground">
            Completed
          </h3>
          {done.map((a) => (
            <ChoreRow
              key={a.id}
              assignment={a}
              chore={chores.find((c) => c.id === a.chore_id)}
              member={me}
              currentUserId={user!.id}
              showDay
            />
          ))}
        </section>
      )}
    </div>
  );
}
