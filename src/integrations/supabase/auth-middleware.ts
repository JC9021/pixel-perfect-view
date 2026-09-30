// Supabase has been removed from this project.
// Auth middleware is kept as a no-op pass-through for compatibility.
import { createMiddleware } from "@tanstack/react-start";
import { getDemoUserId } from "@/lib/local-db";
import { supabaseAdmin } from "./client.server";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    return next({
      context: {
        supabase: supabaseAdmin,
        userId: getDemoUserId(),
        claims: { sub: getDemoUserId() },
      },
    });
  },
);
