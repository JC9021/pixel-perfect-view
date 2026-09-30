// Supabase has been removed from this project.
// This file is kept as a compatibility shim so existing imports still work,
// but all data is stored in localStorage via src/lib/local-db.ts.
import { from, getDemoUserId, resetDemoData } from "@/lib/local-db";
import type { Database } from "./types";

const DEMO_EMAIL = "demo@choremate.local";

function createDemoUser() {
  return {
    id: getDemoUserId(),
    email: DEMO_EMAIL,
    user_metadata: { display_name: "Demo User" },
    app_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };
}

const demoSession = {
  access_token: "demo-token",
  refresh_token: "demo-refresh",
  expires_in: 3600,
  token_type: "bearer",
  user: createDemoUser(),
};

const auth = {
  getSession: async () => ({ data: { session: demoSession }, error: null }),
  onAuthStateChange: (cb: any) => {
    cb("INITIAL_SESSION", demoSession);
    return { subscription: { unsubscribe: () => {} } };
  },
  signInWithPassword: async () => ({ data: { user: createDemoUser(), session: demoSession }, error: null }),
  signUp: async () => ({ data: { user: createDemoUser(), session: demoSession }, error: null }),
  signOut: async () => {
    resetDemoData();
    return { error: null };
  },
  updateUser: async (attrs: { data?: Record<string, any> }) => {
    if (attrs.data?.display_name) {
      await from("profiles").upsert({
        id: getDemoUserId(),
        display_name: attrs.data.display_name,
        updated_at: new Date().toISOString(),
      });
    }
    return { data: { user: createDemoUser() }, error: null };
  },
  setSession: async () => ({ error: null }),
};

export const supabase = {
  auth,
  from: <T extends keyof Database["public"]["Tables"]>(table: T) =>
    from(table as string) as any,
  rpc: (fn: string, params?: Record<string, any>) => from("").rpc(fn, params),
};
