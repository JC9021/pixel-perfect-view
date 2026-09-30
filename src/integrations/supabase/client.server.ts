// Supabase has been removed from this project.
// This server-side client is kept as a no-op compatibility shim.
import { from } from "@/lib/local-db";
import type { Database } from "./types";

export const supabaseAdmin = {
  from: <T extends keyof Database["public"]["Tables"]>(table: T) =>
    from(table as string) as any,
};
