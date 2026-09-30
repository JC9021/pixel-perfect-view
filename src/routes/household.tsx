import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useHousehold, useChores } from "@/hooks/useChoreMate";
import { PersonAvatar } from "@/components/PersonAvatar";
import { Copy, Check } from "lucide-react";
import { FREQUENCY_LABEL } from "@/lib/chore-logic";

export const Route = createFileRoute("/household")({
  component: HouseholdPage,
});

function HouseholdPage() {
  return (
    <AppShell>
      <Household />
    </AppShell>
  );
}

function Household() {
  const { data: hhData } = useHousehold();
  const { data: chores = [] } = useChores(hhData?.household?.id);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (!hhData?.household?.invite_code) return;
    navigator.clipboard.writeText(hhData.household.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6 animate-rise">
      <div className="frost p-5">
        <h2 className="font-display text-2xl font-bold">
          {hhData?.household?.name}
        </h2>
        <button
          onClick={copyCode}
          className="mt-2 inline-flex items-center gap-2 font-mono text-sm text-muted-foreground hover:text-foreground"
        >
          Invite code: {hhData?.household?.invite_code}
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      <section className="tile space-y-3 p-5">
        <h3 className="font-display font-semibold">Members</h3>
        <div className="flex flex-wrap gap-3">
          {hhData?.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5"
            >
              <PersonAvatar member={m} size="sm" />
              <span className="text-sm font-semibold">{m.display_name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="tile space-y-3 p-5">
        <h3 className="font-display font-semibold">Chores ({chores.length})</h3>
        {chores.length === 0 && (
          <p className="text-sm text-muted-foreground">No chores yet.</p>
        )}
        <ul className="space-y-2">
          {chores.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2"
            >
              <span className="font-medium">
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {c.estimated_minutes}m · {FREQUENCY_LABEL[c.frequency]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
