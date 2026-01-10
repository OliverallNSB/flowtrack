"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

export default function ProPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // If not logged in (after auth finishes), send to login
  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/login");
  }, [loading, user, router]);

  // While checking auth
  if (loading || !user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-300">Checking your account...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h1 className="text-xl font-semibold">FlowTrack Pro</h1>
        <p className="mt-2 text-sm text-slate-300">
          You’re signed in. If you don’t see Pro features yet, go back to the dashboard and use the
          “Upgrade” flow.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Go to Dashboard
          </button>

          <button
            onClick={() => router.push("/")}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Home
          </button>
        </div>
      </div>
    </main>
  );
}
