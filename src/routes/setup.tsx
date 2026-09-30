import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHORE_TEMPLATES, makeInviteCode } from "@/lib/chore-logic";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

function SetupPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">Loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center">
        Please{" "}
        <a href="/auth" className="underline">
          sign in
        </a>{" "}
        first.
      </div>
    );
  }

  const updateName = async () => {
    if (!displayName.trim()) return;
    await supabase.from("profiles").upsert({
      id: user.id,
      display_name: displayName.trim(),
      updated_at: new Date().toISOString(),
    });
  };

  const createHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateName();

      const { data: hh, error: hhErr } = await supabase
        .from("households")
        .insert({
          name: householdName.trim(),
          invite_code: makeInviteCode(),
          created_by: user.id,
        })
        .select("id")
        .single();
      if (hhErr) throw hhErr;

      const { error: memberErr } = await supabase
        .from("household_members")
        .insert({
          household_id: hh.id,
          user_id: user.id,
          color: "teal",
        });
      if (memberErr) throw memberErr;

      const chores = CHORE_TEMPLATES.map((t) => ({
        ...t,
        household_id: hh.id,
      }));
      const { error: choresErr } = await supabase.from("chores").insert(chores);
      if (choresErr) throw choresErr;

      navigate({ to: "/" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const joinHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateName();
      const { error } = await supabase.rpc("join_household_by_code", {
        _code: inviteCode.trim(),
      });
      if (error) throw error;
      navigate({ to: "/" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "#fcfbf8" }}
    >
      <div className="tile w-full max-w-md space-y-4 p-6">
        <h1 className="font-display text-2xl font-bold">
          Set up your household
        </h1>

        <div className="flex gap-2">
          <Button
            variant={tab === "create" ? "default" : "outline"}
            onClick={() => setTab("create")}
          >
            Create
          </Button>
          <Button
            variant={tab === "join" ? "default" : "outline"}
            onClick={() => setTab("join")}
          >
            Join
          </Button>
        </div>

        <div className="space-y-1">
          <Label htmlFor="displayName">Your name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Alex"
          />
        </div>

        {tab === "create" ? (
          <form onSubmit={createHousehold} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="householdName">Household name</Label>
              <Input
                id="householdName"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="The Treehouse"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Creating…" : "Create household"}
            </Button>
          </form>
        ) : (
          <form onSubmit={joinHousehold} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="inviteCode">Invite code</Label>
              <Input
                id="inviteCode"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="ABC123"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Joining…" : "Join household"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
