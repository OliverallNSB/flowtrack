// app/api/stripe/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log("Stripe checkout called, but Stripe is not configured yet.");
  return NextResponse.json(
    { error: "Stripe is not configured yet in this environment." },
    { status: 500 }
  );
}
