import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Source-content assertions, following this repo's convention of not
// fabricating a rendered-component test where no component-test harness
// exists (see login/mfa-challenge page.test.ts).
const source = readFileSync(join(__dirname, "./page.tsx"), "utf-8");

function sliceFn(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("signup page: signUp() is called with a same-origin confirmation redirect", () => {
  it("passes emailRedirectTo built from window.location.origin, not a static/attacker-controlled string", () => {
    const submitBody = sliceFn(
      "async function handleSubmit",
      "async function handleResend"
    );
    expect(submitBody).toMatch(
      /emailRedirectTo:\s*`\$\{window\.location\.origin\}\/auth\/confirm`/
    );
  });

  it("points the redirect at the new /auth/confirm route", () => {
    expect(source).toContain("/auth/confirm");
  });
});

describe("signup page: branches on the actual signUp() result", () => {
  it("checks for an error before checking for a session", () => {
    const submitBody = sliceFn(
      "async function handleSubmit",
      "async function handleResend"
    );
    const errorCheckIndex = submitBody.indexOf("if (error) {");
    const sessionCheckIndex = submitBody.indexOf("if (data.session) {");
    expect(errorCheckIndex).toBeGreaterThan(-1);
    expect(sessionCheckIndex).toBeGreaterThan(-1);
    expect(errorCheckIndex).toBeLessThan(sessionCheckIndex);
  });

  it("preserves current behavior: an active session still goes straight to /dashboard", () => {
    const submitBody = sliceFn(
      "async function handleSubmit",
      "async function handleResend"
    );
    const sessionBlock = submitBody.slice(
      submitBody.indexOf("if (data.session) {"),
      submitBody.indexOf("// Confirm Email ON")
    );
    expect(sessionBlock).toMatch(/router\.push\("\/dashboard"\)/);
  });

  it("shows the check-your-email state (not /dashboard) when no session is returned", () => {
    const submitBody = sliceFn(
      "async function handleSubmit",
      "async function handleResend"
    );
    const pendingBlock = submitBody.slice(
      submitBody.indexOf("// Confirm Email ON")
    );
    expect(pendingBlock).toContain("setPendingConfirmationEmail(email)");
    expect(pendingBlock).not.toContain('router.push("/dashboard")');
  });

  it("never renders Supabase's raw error.message on signUp failure", () => {
    const submitBody = sliceFn(
      "async function handleSubmit",
      "async function handleResend"
    );
    const errorBlock = submitBody.slice(
      submitBody.indexOf("if (error) {"),
      submitBody.indexOf("if (data.session) {")
    );
    expect(errorBlock).not.toMatch(/setErrorMessage\(error\.message/);
    expect(errorBlock).toContain("setErrorMessage(GENERIC_SIGNUP_ERROR)");
  });

  it("logs the real error client-side only, matching the login page's existing convention", () => {
    const submitBody = sliceFn(
      "async function handleSubmit",
      "async function handleResend"
    );
    const errorBlock = submitBody.slice(
      submitBody.indexOf("if (error) {"),
      submitBody.indexOf("if (data.session) {")
    );
    expect(errorBlock).toMatch(/console\.error\(["']Signup error:["'],\s*error\)/);
  });

  it("defines one generic, non-revealing signup error constant", () => {
    expect(source).toMatch(
      /const GENERIC_SIGNUP_ERROR = "We couldn't create your account right now\. Please try again\."/
    );
  });
});

describe("signup page: check-your-email UI", () => {
  it("renders the 'Check your email' title and interpolates the submitted address", () => {
    expect(source).toMatch(/<h1[^>]*>Check your email<\/h1>/);
    expect(source).toContain("{pendingConfirmationEmail}");
  });

  it("includes spam/junk folder guidance", () => {
    expect(source).toMatch(/spam or junk folder/i);
  });

  it("never claims the email was delivered, only that it was sent/initiated", () => {
    expect(source).not.toMatch(/has been delivered/i);
    expect(source).not.toMatch(/successfully delivered/i);
  });

  it("provides a way back to login and a way to correct the email via signup", () => {
    const pendingUiBlock = sliceFn(
      "if (pendingConfirmationEmail) {",
      "Create your account</h1>"
    );
    expect(pendingUiBlock).toContain('href="/login"');
    expect(pendingUiBlock).toContain("handleUseDifferentEmail");
  });

  it("never reveals whether the account was new or already existed", () => {
    const pendingUiBlock = sliceFn(
      "if (pendingConfirmationEmail) {",
      "Already have an account?"
    );
    expect(pendingUiBlock).not.toMatch(/already (have|registered|exists)/i);
    expect(pendingUiBlock).not.toMatch(/new account/i);
  });
});

describe("signup page: resend confirmation control", () => {
  it("sets a cooldown of at least 60 seconds, matching Supabase's documented default interval", () => {
    const match = source.match(/const RESEND_COOLDOWN_SECONDS = (\d+);/);
    expect(match).not.toBeNull();
    const seconds = Number(match?.[1]);
    expect(seconds).toBeGreaterThanOrEqual(60);
  });

  it("uses the installed package's documented resend() API with type 'signup'", () => {
    const resendBody = sliceFn(
      "async function handleResend",
      "function handleUseDifferentEmail"
    );
    expect(resendBody).toMatch(/supabase\.auth\.resend\(\{/);
    expect(resendBody).toMatch(/type:\s*"signup"/);
    expect(resendBody).toContain("email: pendingConfirmationEmail");
  });

  it("reuses the same same-origin emailRedirectTo as the initial signup", () => {
    const resendBody = sliceFn(
      "async function handleResend",
      "function handleUseDifferentEmail"
    );
    expect(resendBody).toMatch(
      /emailRedirectTo:\s*`\$\{window\.location\.origin\}\/auth\/confirm`/
    );
  });

  it("is a no-op while a cooldown is active or a send is already in flight", () => {
    const resendBody = sliceFn(
      "async function handleResend",
      "function handleUseDifferentEmail"
    );
    expect(resendBody).toMatch(/if \(resendCooldown > 0 \|\| resendStatus === "sending"\) return;/);
  });

  it("disables the button while submitting/cooling down, not just visually", () => {
    expect(source).toMatch(
      /disabled=\{resendCooldown > 0 \|\| resendStatus === "sending"\}/
    );
  });

  it("restarts the cooldown after every resend attempt, success or failure", () => {
    const resendBody = sliceFn(
      "async function handleResend",
      "function handleUseDifferentEmail"
    );
    expect(resendBody).toContain("setResendCooldown(RESEND_COOLDOWN_SECONDS)");
  });

  it("shows generic success/error wording, never error.message", () => {
    const resendBody = sliceFn(
      "async function handleResend",
      "function handleUseDifferentEmail"
    );
    expect(resendBody).not.toMatch(/error\.message/);
    expect(source).toMatch(/we&apos;ve sent another link/i);
    expect(source).toMatch(/couldn&apos;t resend the confirmation email/i);
  });

  it("also sets an initial cooldown as soon as the check-your-email state appears", () => {
    const submitBody = sliceFn(
      "async function handleSubmit",
      "async function handleResend"
    );
    const pendingBlock = submitBody.slice(submitBody.indexOf("setPendingConfirmationEmail"));
    expect(pendingBlock).toContain("setResendCooldown(RESEND_COOLDOWN_SECONDS)");
  });
});

describe("signup page: no lifecycle-email/cron/database infrastructure introduced", () => {
  it("does not call any custom API route for sending email", () => {
    expect(source).not.toMatch(/fetch\(["'`]\/api\//);
  });

  it("does not reference Resend, cron, or a lifecycle-email table", () => {
    expect(source).not.toMatch(/resend\.emails|RESEND_API_KEY|cron|lifecycle_email/i);
  });

  it("only uses supabase.auth methods for email delivery, never a raw HTTP client", () => {
    expect(source).toMatch(/supabase\.auth\.signUp/);
    expect(source).toMatch(/supabase\.auth\.resend/);
  });
});

describe("signup page: useSearchParams-free — no Suspense boundary needed", () => {
  it("does not read next/navigation's useSearchParams (this page has no ?next handling)", () => {
    expect(source).not.toContain("useSearchParams");
  });
});
