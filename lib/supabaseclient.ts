import { createClient } from "@supabase/supabase-js";

// Read from env (works on Vercel + local)
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("supabaseUrl is required.");
if (!supabaseAnonKey) throw new Error("supabaseAnonKey is required.");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
