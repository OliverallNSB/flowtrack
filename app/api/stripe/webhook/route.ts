import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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
      return NextResponse.json({ received: true, missingUserId: true });
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, plan: "pro" }, { onConflict: "id" });

    if (error) {
      return NextResponse.json(
        { error: `Supabase update failed: ${error.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
