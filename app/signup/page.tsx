// app/signup/page.tsx
"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseclient";

// At least 60s, matching Supabase's documented default minimum interval
// between email-type OTP requests for the same address.
const RESEND_COOLDOWN_SECONDS = 60;

const GENERIC_SIGNUP_ERROR = "We couldn't create your account right now. Please try again.";

export default function SignupPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  // Set only when signUp() succeeds without returning a session — i.e.
  // Confirm Email is ON and this address must be verified before the
  // account is usable. Null in every other case (including while Confirm
  // Email is OFF, where signUp() returns an active session immediately).
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<
    string | null
  >(null);

  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  // Ticks the resend cooldown down once a second while active. Starts
  // immediately when the "check your email" state appears (signUp() itself
  // already sent one email) and again after every resend click, so the
  // control can't be used to trigger a burst of confirmation emails.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // REAL Supabase signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
        // Same-origin, hardcoded destination — never derived from user
        // input — matching the existing redirectTo pattern already used by
        // the password-reset flow in app/login/page.tsx.
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      // Matches the existing client-side error-logging convention used by
      // app/login/page.tsx (console.error the real error for debugging, but
      // never render Supabase's raw message to the user).
      console.error("Signup error:", error);
      setErrorMessage(GENERIC_SIGNUP_ERROR);
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      // Confirm Email OFF (current production state): signUp() already
      // returned an active session. Preserve existing behavior exactly —
      // continue straight into the app.
      router.push("/dashboard");
      return;
    }

    // Confirm Email ON (future state): the account was created but no
    // session was returned, meaning the address must be confirmed first.
    // Supabase deliberately returns this same shape whether the email is
    // brand new or already registered, so showing this state here never
    // reveals which case occurred.
    setPendingConfirmationEmail(email);
    setResendStatus("idle");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setIsSubmitting(false);
  }

  async function handleResend() {
    if (!pendingConfirmationEmail) return;
    if (resendCooldown > 0 || resendStatus === "sending") return;

    setResendStatus("sending");

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingConfirmationEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    setResendStatus(error ? "error" : "sent");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  }

  function handleUseDifferentEmail() {
    setPendingConfirmationEmail(null);
    setResendStatus("idle");
    setResendCooldown(0);
    setErrorMessage(null);
  }

  if (pendingConfirmationEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
        <div className="w-full max-w-md px-6 py-8 bg-slate-800 rounded-2xl shadow-lg border border-slate-700 text-center">
          <h1 className="text-xl font-semibold mb-2">Check your email</h1>
          <p className="text-sm text-slate-300">
            We sent a confirmation link to{" "}
            <span className="font-medium text-slate-100">
              {pendingConfirmationEmail}
            </span>
            . Open that link to finish creating your FlowTrack account.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            If you don&apos;t see it, check your spam or junk folder.
          </p>

          {resendStatus === "sent" && (
            <p className="mt-4 text-xs text-emerald-400">
              If that address needs confirming, we&apos;ve sent another link.
            </p>
          )}
          {resendStatus === "error" && (
            <p className="mt-4 text-xs text-red-400">
              We couldn&apos;t resend the confirmation email right now.
              Please try again in a moment.
            </p>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resendStatus === "sending"}
            className="mt-6 w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed py-2.5 text-sm font-medium transition"
          >
            {resendStatus === "sending"
              ? "Resending..."
              : resendCooldown > 0
              ? `Resend link (${resendCooldown}s)`
              : "Resend confirmation link"}
          </button>

          <button
            type="button"
            onClick={handleUseDifferentEmail}
            className="mt-3 w-full text-xs text-slate-400 hover:text-slate-300 underline underline-offset-2"
          >
            Use a different email
          </button>

          <p className="mt-4 text-xs text-slate-400">
            Already confirmed?{" "}
            <Link href="/login" className="text-emerald-400 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
      <div className="w-full max-w-md px-6 py-8 bg-slate-800 rounded-2xl shadow-lg border border-slate-700">
        <h1 className="text-xl font-semibold mb-2">Create your account</h1>
        <p className="text-sm text-slate-300 mb-6">
          Start your 30-day free trial. No credit card required (for now).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              minLength={6}
              required
            />
          </div>

          {errorMessage && (
            <p className="text-xs text-red-400">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed py-2.5 text-sm font-medium transition"
          >
            {isSubmitting ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-400 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
