// Lovable cloud auth integration disabled; the app now runs without Supabase.
import type { OAuthProvider } from "@lovable.dev/cloud-auth-js";

export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: OAuthProvider, _opts?: any) => ({
      error: new Error("OAuth sign-in is disabled in this build."),
    }),
  },
};
