"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

export default function ProPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  
  const isPro = profile?.plan === "pro";
  const [loadingCheckout, setLoadingCheckout] = useState(false);

async function handleUpgradeClick() {
  setLoadingCheckout(true);

  // For now, no real Stripe – just a message
  alert(
    "Upgrade with Stripe will be available once billing is connected. For now this is just a preview of the Pro flow."
  );

  setLoadingCheckout(false);
}


  // If not logged in, send to login
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || (!user && !profile)) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-300">Checking your plan…</p>
      </main>
    );
  }

  // In case the redirect hasn't happened yet
  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {isPro ? "Pro plan active" : "Upgrade to Pro"}
            </h1>
            <p className="text-xs text-slate-400">
              Signed in as{" "}
              <span className="font-medium text-slate-200">
                {user.email}
              </span>
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="px-3 py-1.5 rounded-full text-[11px] font-medium border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100"
          >
            Back to dashboard
          </button>
        </div>

        {isPro ? (
          <>
            <div className="mb-4 rounded-xl border border-emerald-600/70 bg-emerald-500/10 px-4 py-3 text-sm">
              <p className="font-medium text-emerald-300">
                🎉 You already have Pro.
              </p>
              <p className="mt-1 text-slate-200 text-xs">
                Your account is currently tracking the last{" "}
                <span className="font-semibold text-emerald-300">
                  90 days
                </span>{" "}
                of activity with advanced dashboards.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p className="font-medium text-slate-100 mb-1">
                What Pro gives you today:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>90-day history window instead of 30 days.</li>
                <li>Detailed preliminary report on the right sidebar.</li>
                <li>Budgets per category with progress bars.</li>
                <li>Spending vs income donut overview.</li>
              </ul>
              <p className="mt-2 text-slate-400">
                As we add new Pro features (reports, exports, trends),
                they&apos;ll automatically appear in your account.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-amber-500/70 bg-amber-500/10 px-4 py-3 text-sm">
              <p className="font-medium text-amber-300">
                Pro is coming soon.
              </p>
              <p className="mt-1 text-slate-200 text-xs">
                You&apos;re currently on the Free plan, which tracks the last{" "}
                <span className="font-semibold">30 days</span> only.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p className="font-medium text-slate-100 mb-1">
                Planned Pro features:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>90-day history window.</li>
                <li>Advanced reports with trends and charts.</li>
                <li>Exportable summaries (CSV / PDF).</li>
                <li>Smarter insights on spending patterns.</li>
              </ul>
              <p className="mt-2 text-slate-400">
                For now this page is just a preview. When we connect
                payments (Stripe), this is where the real upgrade button
                will live.
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <button
              type="button"
              onClick={handleUpgradeClick}
              disabled={loadingCheckout}
              className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[11px] font-medium text-slate-900 border border-emerald-400 disabled:opacity-60"
             >
              {loadingCheckout ? "Redirecting…" : "Upgrade with Stripe"}
              </button>
            

            </div>
          </>
        )}
      </div>
    </main>
  );
}
