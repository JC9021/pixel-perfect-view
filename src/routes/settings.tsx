import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useHousehold } from "@/hooks/useChoreMate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell>
      <Settings />
    </AppShell>
  );
}

function Settings() {
  const { user } = useAuth();
  const { data: hhData, refetch } = useHousehold();
  const navigate = useNavigate();
  const [name, setName] = useState(
    (user?.user_metadata?.display_name as string) ?? "",
  );
  const [saving, setSaving] = useState(false);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error: authErr } = await supabase.auth.updateUser({
      data: { display_name: name },
    });
    if (authErr) {
      toast.error(authErr.message);
    } else {
      await supabase.from("profiles").upsert({
        id: user!.id,
        display_name: name,
        updated_at: new Date().toISOString(),
      });
      await refetch();
      toast.success("Profile updated");
    }
    setSaving(false);
  };

  const toggleRotation = async (checked: boolean) => {
    if (!hhData?.household) return;
    const { error } = await supabase
      .from("households")
      .update({ rotation_enabled: checked })
      .eq("id", hhData.household.id);
    if (error) {
      toast.error(error.message);
    } else {
      await refetch();
      toast.success(checked ? "Rotation on" : "Rotation off");
    }
  };

  return (
    <div className="space-y-6 animate-rise">
      <div className="frost p-5">
        <h2 className="font-display text-2xl font-bold">Settings</h2>
      </div>

      <form onSubmit={updateProfile} className="tile space-y-4 p-5">
        <h3 className="font-display font-semibold">Your profile</h3>
        <div className="space-y-1">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save name"}
        </Button>
      </form>

      <div className="tile space-y-4 p-5">
        <h3 className="font-display font-semibold">Household</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Rotate chores weekly</p>
            <p className="font-mono text-xs text-muted-foreground">
              Changes who gets first pick each week
            </p>
          </div>
          <Switch
            checked={hhData?.household?.rotation_enabled ?? true}
            onCheckedChange={toggleRotation}
          />
        </div>
      </div>

      <div className="tile p-5">
        <Button
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
