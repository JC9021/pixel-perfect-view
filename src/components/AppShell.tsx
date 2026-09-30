import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHousehold } from "@/hooks/useChoreMate";
import { PersonAvatar } from "@/components/PersonAvatar";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/my-chores", label: "My Chores" },
  { to: "/household", label: "Household" },
  { to: "/fairness", label: "Fairness" },
  { to: "/settings", label: "Settings" },
] as const;

function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute -top-24 -left-24 size-[420px] rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute top-1/3 -right-32 size-[460px] rounded-full bg-teal/20 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 size-[380px] rounded-full bg-amber/20 blur-3xl" />
    </div>
  );
}

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Backdrop />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}

export function LoadingScreen({ label = "Loading the board…" }: { label?: string }) {
  return (
    <PageFrame>
      <div className="grid min-h-screen place-items-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      </div>
    </PageFrame>
  );
}

/**
 * Wraps every signed-in page: sends visitors to sign-in, and people without a
 * household to the setup flow.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data, isLoading } = useHousehold();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user && !isLoading && data && !data.household) navigate({ to: "/setup" });
  }, [user, isLoading, data, navigate]);

  if (loading || !user || isLoading || !data?.household) return <LoadingScreen />;

  const me = data.members.find((m) => m.user_id === user.id) ?? {
    display_name: user.email ?? "You",
    color: "teal",
    avatar_url: null,
  };

  return (
    <PageFrame>
      <header className="sticky top-0 z-30 -mx-4 mb-6 sm:-mx-6 lg:-mx-8">
        <div className="frost mx-4 mt-4 sm:mx-6 lg:mx-8">
          <div className="flex items-center justify-between px-4 py-3 sm:px-5">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-2xl bg-accent font-display text-lg font-bold text-primary-foreground shadow-sm">
                C
              </span>
              <span className="font-display text-xl font-bold tracking-tight">ChoreMate</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className="rounded-full px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  activeProps={{ className: "bg-foreground text-background font-bold hover:text-background" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <span className="hidden text-right font-mono text-xs text-muted-foreground sm:block">
                {data.household.name}
              </span>
              <PersonAvatar member={me} size="md" className="ring-2 ring-white" />
            </div>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto px-3 pb-3 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                activeProps={{ className: "bg-foreground text-background font-bold" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="pb-10">{children}</main>

      <footer className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p className="font-mono">ChoreMate · a calmer way to split the house</p>
        <button
          className="font-mono underline-offset-4 hover:underline"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          Sign out
        </button>
      </footer>
    </PageFrame>
  );
}
