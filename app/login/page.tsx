// app/login/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseclient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debugStatus, setDebugStatus] = useState<string>("Idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setDebugStatus("Starting login…");

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      setDebugStatus("Missing email or password.");
      return;
    }

    setSubmitting(true);

    try {
      // ✅ Check if supabase.auth.signInWithPassword actually exists
      const canSignIn =
        (supabase as any)?.auth &&
        typeof (supabase as any).auth.signInWithPassword === "function";

      if (!canSignIn) {
        setDebugStatus("Supabase auth client is not available.");
        setErrorMessage(
          "Supabase auth client is not available. Check supabaseclient.ts and env vars."
        );
        return;
      }

      setDebugStatus("Calling supabase.auth.signInWithPassword…");

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error);
        setErrorMessage(error.message || "Login failed.");
        setDebugStatus(`Login error: ${error.message || "Unknown error"}`);
        return;
      }

      console.log("Login success, user:", data.user);
      setDebugStatus("Login success. Redirecting to dashboard…");

      // Success → go to dashboard (or /pro if you prefer while testing)
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Unexpected login error:", err);
      setErrorMessage("Unexpected error during login.");
      setDebugStatus(
        `Unexpected error: ${err?.message ?? String(err ?? "Unknown")}`
      );
    } finally {
      // ✅ Ensure the button is not stuck on "Signing in..."
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-slate-50">
            Welcome back
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Log in to your MoneyControl dashboard.
          </p>
        </header>

        {/* Debug info */}
        <p className="mb-2 text-[11px] text-slate-500">
          Debug: <span className="text-slate-300">{debugStatus}</span>
        </p>

        {errorMessage && (
          <div className="mb-4 bg-red-500/10 border border-red-500 text-red-200 text-xs rounded-lg px-3 py-2">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block mb-1 text-slate-300" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block mb-1 text-slate-300" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed py-2 text-sm font-medium"
          >
            {submitting ? "Signing in..." : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-slate-400">
          Don&apos;t have an account?{" "}
          <a
            href="/signup"
            className="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline"
          >
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}
