import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Assignment, Chore, Member } from "@/lib/chore-logic";
import { startOfWeek, toISO } from "@/lib/chore-logic";

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  rotation_enabled: boolean;
  created_by: string;
}

export function useHousehold() {
  const { user, loading } = useAuth();

  return useQuery({
    queryKey: ["household", user?.id],
    enabled: !loading && !!user,
    queryFn: async (): Promise<{ household: Household | null; members: Member[] }> => {
      const { data: memberRow, error: memberError } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user!.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (memberError) throw memberError;
      if (!memberRow) return { household: null, members: [] };

      const { data: household, error: hhError } = await supabase
        .from("households")
        .select("id, name, invite_code, rotation_enabled, created_by")
        .eq("id", memberRow.household_id)
        .maybeSingle();
      if (hhError) throw hhError;
      if (!household) return { household: null, members: [] };

      const { data: memberRows, error: membersError } = await supabase
        .from("household_members")
        .select("id, user_id, color")
        .eq("household_id", household.id)
        .order("joined_at", { ascending: true });
      if (membersError) throw membersError;

      const ids = (memberRows ?? []).map((m) => m.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      if (profileError) throw profileError;

      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      const members: Member[] = (memberRows ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        color: m.color,
        display_name: byId.get(m.user_id)?.display_name ?? "Roommate",
        avatar_url: byId.get(m.user_id)?.avatar_url ?? null,
      }));

      return { household: household as Household, members };
    },
  });
}

export function useChores(householdId: string | undefined) {
  return useQuery({
    queryKey: ["chores", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<Chore[]> => {
      const { data, error } = await supabase
        .from("chores")
        .select("*")
        .eq("household_id", householdId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Chore[];
    },
  });
}

export function useAssignments(householdId: string | undefined, weekStart: Date = startOfWeek()) {
  const week = toISO(weekStart);
  return useQuery({
    queryKey: ["assignments", householdId, week],
    enabled: !!householdId,
    queryFn: async (): Promise<Assignment[]> => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("household_id", householdId!)
        .eq("week_start", week)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Assignment[];
    },
  });
}

export interface SwapRequest {
  id: string;
  household_id: string;
  requester_id: string;
  target_id: string;
  requester_assignment_id: string;
  target_assignment_id: string;
  status: string;
  created_at: string;
}

export function useSwaps(householdId: string | undefined) {
  return useQuery({
    queryKey: ["swaps", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<SwapRequest[]> => {
      const { data, error } = await supabase
        .from("swap_requests")
        .select("*")
        .eq("household_id", householdId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SwapRequest[];
    },
  });
}
