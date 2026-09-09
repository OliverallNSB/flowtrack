// app/auth/confirm/page.tsx
//
// Landing page for Supabase's email confirmation link. This project's
// Supabase client (lib/supabaseclient.ts) is a plain browser client with no
// server-side session/cookie architecture (no @supabase/ssr, no
// middleware.ts), so — matching every other auth surface in this app
// (login, mfa-challenge, update-password) — this is a client page that
// calls supabase.auth directly, not a route handler.
//
// This route is reached only once Alberto configures the Supabase Dashboard
// "Confirm signup" email template to link here. Because the signup/resend
// calls in app/signup/page.tsx already pass the complete callback URL
// (`${window.location.origin}/auth/confirm`) via `emailRedirectTo`, the
// template must reuse that value through Supabase's `{{ .RedirectTo }}`
// variable rather than `{{ .SiteURL }}` (which is a different,
// project-level value and would not necessarily point here), and must NOT
// append "/auth/confirm" again — `{{ .RedirectTo }}` already contains it.
// The exact template link Alberto must configure is:
//
//   {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email
//
// The complete production callback URL (https://www.appflowtrack.com/auth/confirm)
// must also be present in the Supabase project's Redirect URLs allowlist,
// or `emailRedirectTo` will be rejected. Until this Dashboard configuration
// is done, and with Confirm Email OFF, nothing links to this page in
// production.
"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseclient";

const GENERIC_INVALID_MESSAGE =
  "This confirmation link is invalid or has expired.";

// Only the two EmailOtpType values relevant to account confirmation are
// accepted here — magiclink/recovery/invite/email_change are different
// flows this page isn't built to handle, and this page must not become a
// generic OTP-verification endpoint for arbitrary query-param input.
type ConfirmOtpType = "signup" | "email";
const ALLOWED_TYPES = new Set<string>(["signup", "email"]);

function isAllowedType(value: string | null): value is ConfirmOtpType {
  return value !== null && ALLOWED_TYPES.has(value);
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmailForm />
    </Suspense>
  );
}

function ConfirmEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"verifying" | "invalid">("verifying");

  useEffect(() => {
    let cancelled = false;

    // Covers three of the required cases at once: a link opened while
    // already authenticated, a duplicate/reused (already-consumed) link
    // clicked again by a still-signed-in user, and a page refresh after a
    // token_hash has already been consumed by an earlier successful run —
    // in all three, the user already has a valid session and should simply
    // continue, not see an error.
    async function continueWithExistingSessionOrShowInvalid() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (data?.session) {
        router.replace("/dashboard");
        return;
      }

      setStatus("invalid");
    }

    async function run() {
      const tokenHash = searchParams?.get("token_hash");
      const type = searchParams?.get("type");

      // Scrub the confirmation secret from the visible URL immediately —
      // before any asynchronous work — so token_hash never lingers in the
      // address bar, browser history, or a later back/forward navigation.
      // A single-use token is safe to have already read into the local
      // consts above; nothing below needs it to still be in the URL.
      if (window.location.search) {
        window.history.replaceState(null, "", window.location.pathname);
      }

      // Missing/malformed callback parameters.
      if (!tokenHash || !isAllowedType(type)) {
        await continueWithExistingSessionOrShowInvalid();
        return;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (cancelled) return;

      // Expired/invalid/already-used token, or any other Supabase error —
      // never surface the underlying error text, which could contain
      // internal detail.
      if (error || !data.session) {
        await continueWithExistingSessionOrShowInvalid();
        return;
      }

      router.replace("/dashboard");
    }

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "verifying") {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <p className="text-sm text-slate-400">Confirming your email...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg text-center">
        <h1 className="text-xl font-semibold text-slate-50">
          Link invalid or expired
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          {GENERIC_INVALID_MESSAGE} You can request a new one from the sign up
          page, or log in if you already confirmed your account.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <a
            href="/signup"
            className="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline text-sm"
          >
            Return to sign up
          </a>
          <a
            href="/login"
            className="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline text-sm"
          >
            Return to login
          </a>
        </div>
      </div>
    </main>
  );
}
