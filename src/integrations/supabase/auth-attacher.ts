// Supabase has been removed from this project.
// This middleware is kept as a no-op compatibility shim.
import { createMiddleware } from "@tanstack/react-start";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => next({ headers: {} }),
);
