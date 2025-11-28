import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log("Stripe webhook hit, but Stripe is not configured yet.");
  return NextResponse.json({ received: true });
}
