// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

// Use the same URL as your main client, but inline it so
// it never depends on env during build.
const supabaseUrl = "https://kfxrgchdltnmpimdnirr.supabase.co";

// Service role key MUST come from the server env (Vercel only, never public)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey as string
);
