import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PersonAvatar } from "@/components/PersonAvatar";
import type { Assignment, Chore, Member } from "@/lib/chore-logic";
import { friendlyDay, toISO } from "@/lib/chore-logic";
import { cn } from "@/lib/utils";

export function ChoreRow({
  assignment,
  chore,
  member,
  currentUserId,
  showDay = false,
}: {
  assignment: Assignment;
  chore: Chore | undefined;
  member: Member | undefined;
  currentUserId: string;
  showDay?: boolean;
}) {
  const queryClient = useQueryClient();
  const done = !!assignment.completed_at;
  const overdue = !done && assignment.due_date < toISO(new Date());

  const toggle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("assignments")
        .update(
          done
            ? { completed_at: null, completed_by: null }
            : { completed_at: new Date().toISOString(), completed_by: currentUserId },
        )
        .eq("id", assignment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      if (!done) toast.success("Nice one — that's done.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="tile flex items-center gap-3 px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5">
      <button
        aria-label={done ? "Mark as not done" : "Mark as done"}
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full border-2 text-sm transition-colors",
          done
            ? "animate-pop border-accent bg-accent text-primary-foreground"
            : "border-line bg-card text-transparent hover:border-accent",
        )}
      >
        ✓
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[15px] font-semibold",
            done && "text-muted-foreground line-through decoration-accent/60 decoration-2",
          )}
        >
          {chore?.icon ? `${chore.icon} ` : ""}
          {chore?.name ?? "Chore"}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {chore?.estimated_minutes ?? 0} min
          {chore?.room ? ` · ${chore.room}` : ""}
          {showDay ? ` · ${friendlyDay(assignment.due_date)}` : ""}
          {overdue ? " · overdue" : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{Number(assignment.points)}</span>
        {member ? <PersonAvatar member={member} size="sm" /> : null}
      </div>
    </div>
  );
}
