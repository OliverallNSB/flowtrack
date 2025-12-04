import { createClient } from "@supabase/supabase-js";

// These values come from your Supabase project
// (same ones you had in .env.local)
const supabaseUrl = "https://kfxrgchdltnmpimdnirr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmeHJnY2hkbHRubXBpbWRuaXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjAwNTksImV4cCI6MjA3OTY5NjA1OX0.IvffSopPLbWMU0W_b2QcBAv0BiT6LNu1W-iMugwQDlI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
