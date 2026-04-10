import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const priceId = process.env.STRIPE_PRICE_ID!;

  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  const checkoutSession = await createCheckoutSession(
    userId,
    priceId,
    `${origin}/dashboard?checkout=success`,
    `${origin}/dashboard?checkout=canceled`
  );

  return NextResponse.json({ url: checkoutSession.url });
}
