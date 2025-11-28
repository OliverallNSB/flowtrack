// app/signup/page.tsx
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseclient";

export default function SignupPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    // Success → go to dashboard
    router.push("/dashboard");
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
