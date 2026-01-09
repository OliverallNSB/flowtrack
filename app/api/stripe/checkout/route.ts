export const runtime = "nodejs";
console.log("🔥 CHECKOUT ROUTE FILE LOADED 🔥");


import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return NextResponse.json({ error: "Missing userId/email" }, { status: 400 });
    }

    const priceId = process.env.STRIPE_PRICE_ID_PRO!;
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    if (!priceId) {
      return NextResponse.json({ error: "Missing STRIPE_PRICE_ID_PRO" }, { status: 500 });
    }
    if (!appUrl) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_URL" }, { status: 500 });
    }
console.log("🔥 CHECKOUT POST HIT 🔥");

console.log("STRIPE_SECRET_KEY present:", !!process.env.STRIPE_SECRET_KEY);
console.log("STRIPE_PRICE_ID_PRO:", process.env.STRIPE_PRICE_ID_PRO);
console.log("NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL);
console.log("CHECKOUT ENV", {
  hasSecret: !!process.env.STRIPE_SECRET_KEY,
  price: process.env.STRIPE_PRICE_ID_PRO,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
});

console.log("✅ USING CHECKOUT ROUTE:", __filename);
console.log("✅ SUCCESS URL WILL BE:", `${appUrl}/dashboard?upgraded=1`);


    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgraded=1`,
      cancel_url: `${appUrl}/dashboard?canceled=1`,
      metadata: { userId },
    

      // ✅ add this (subscription metadata)
  subscription_data: {
    metadata: { userId },
  },

  // (optional but helpful)
  client_reference_id: userId,
});

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Stripe error" }, { status: 500 });
  }
}
