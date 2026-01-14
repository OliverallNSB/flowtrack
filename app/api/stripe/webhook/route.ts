import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSubscriptionIdFromInvoice(invoice: any): string | null {
  const sub = invoice?.subscription;
  if (!sub) return null;
  if (typeof sub === "string") return sub;
  if (typeof sub === "object" && typeof sub.id === "string") return sub.id;
  return null;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err?.message}` },
      { status: 400 }
    );
  }

  // ✅ Upgrade on checkout completion
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId = session.metadata?.userId;
    if (!userId) {
      // Don’t fail the webhook; just report missing mapping
      return NextResponse.json({ received: true, missingUserId: true });
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null;

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id ?? null;

    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          plan: "pro",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        },
        { onConflict: "id" }
      );

    if (error) {
      return NextResponse.json(
        { error: `Supabase update failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      received: true,
      updated: true,
      userId,
      customerId,
      subscriptionId,
    });
  }

  // ✅ Handle subscription.created so it never 500s
  // (We don’t require userId here unless you explicitly set subscription metadata.)
  if (event.type === "customer.subscription.created") {
    const sub = event.data.object as Stripe.Subscription;

    const customerId =
      typeof sub.customer === "string"
        ? sub.customer
        : sub.customer && "id" in sub.customer
        ? sub.customer.id
        : null;

    const userId = sub.metadata?.userId;

    // If no userId in subscription metadata, do NOT fail.
    // We'll rely on checkout.session.completed (which should have metadata.userId).
    if (!userId) {
      return NextResponse.json({ received: true, missingUserId: true });
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plan: "pro",
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        stripe_subscription_status: sub.status,
      })
      .eq("id", userId);

    if (error) {
      return NextResponse.json(
        { error: `Supabase update failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true, updated: true, userId });
  }

  // ✅ Downgrade to free when subscription is canceled
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;

    const userId = sub.metadata?.userId;
    if (!userId) {
      return NextResponse.json({ received: true, missingUserId: true });
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plan: "free",
        stripe_subscription_id: null,
        stripe_subscription_status: sub.status,
        pro_grace_until: null,
      })
      .eq("id", userId);

    if (error) {
      return NextResponse.json(
        { error: `Supabase downgrade failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true, downgraded: true, userId });
  }

  // ✅ Start grace window on payment failure (3 days)
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;

    const subscriptionId = getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) return NextResponse.json({ received: true });

    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    const userId = sub.metadata?.userId;
    if (!userId) {
      return NextResponse.json({ received: true, missingUserId: true });
    }

    const graceUntil = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        stripe_subscription_id: sub.id,
        stripe_subscription_status: sub.status,
        pro_grace_until: graceUntil,
      })
      .eq("id", userId);

    if (error) {
      return NextResponse.json(
        { error: `Grace update failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true, graceUntil });
  }

  // ✅ Clear grace window when payment succeeds
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;

    const subscriptionId = getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) return NextResponse.json({ received: true });

    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    const userId = sub.metadata?.userId;
    if (!userId) {
      return NextResponse.json({ received: true, missingUserId: true });
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plan: "pro",
        stripe_subscription_id: sub.id,
        stripe_subscription_status: sub.status,
        pro_grace_until: null,
      })
      .eq("id", userId);

    if (error) {
      return NextResponse.json(
        { error: `Recovery update failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true, recovered: true });
  }

  // ✅ Always return 200 so Stripe stops retrying for unhandled events
  return NextResponse.json({ received: true, type: event.type });
}
