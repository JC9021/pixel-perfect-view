import { colorClasses, type Member } from "@/lib/chore-logic";
import { cn } from "@/lib/utils";

const SIZES: Record<string, string> = {
  xs: "size-7 text-xs",
  sm: "size-8 text-sm",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
};

export function PersonAvatar({
  member,
  size = "sm",
  className,
}: {
  member: Pick<Member, "display_name" | "color" | "avatar_url">;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initial = (member.display_name ?? "?").trim().charAt(0).toUpperCase() || "?";

  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.display_name}
        className={cn("shrink-0 rounded-full object-cover", SIZES[size], className)}
      />
    );
  }

  return (
    <span
      title={member.display_name}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold text-primary-foreground",
        colorClasses(member.color),
        SIZES[size],
        className,
      )}
    >
      {initial}
    </span>
  );
}
