import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  useAssignments,
  useChores,
  useHousehold,
} from "@/hooks/useChoreMate";
import { PersonAvatar } from "@/components/PersonAvatar";
import { startOfWeek, fairnessRows, fairnessVerdict } from "@/lib/chore-logic";

export const Route = createFileRoute("/fairness")({
  component: FairnessPage,
});

function FairnessPage() {
  return (
    <AppShell>
      <Fairness />
    </AppShell>
  );
}

function Fairness() {
  const { data: hhData } = useHousehold();
  const weekStart = startOfWeek();
  const { data: chores = [] } = useChores(hhData?.household?.id);
  const { data: assignments = [] } = useAssignments(
    hhData?.household?.id,
    weekStart,
  );

  const rows = fairnessRows(hhData?.members ?? [], assignments, chores);
  const verdict = fairnessVerdict(rows);

  return (
    <div className="space-y-6 animate-rise">
      <div className="frost p-5">
        <h2 className="font-display text-2xl font-bold">Fairness</h2>
        <p className="font-mono text-xs text-muted-foreground">
          {verdict.headline}
        </p>
      </div>

      <div className="tile p-5">
        <p className="text-sm">{verdict.detail}</p>
      </div>

      <div className="grid gap-4">
        {rows.map((r) => (
          <div
            key={r.member.id}
            className="tile flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <PersonAvatar member={r.member} size="sm" />
              <div>
                <p className="font-semibold">{r.member.display_name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {r.chores} chores · {r.minutes} min
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-xl font-bold">{r.points}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {Math.round(r.share * 100)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
