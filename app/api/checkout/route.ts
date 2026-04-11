import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";
import { getSupabase, getOrganizationForUser } from "@/lib/db";

const priceMap: Record<string, string | undefined> = {
  "pro-month": process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
  "pro-year": process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  "team-month": process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
  "team-year": process.env.STRIPE_TEAM_YEARLY_PRICE_ID,
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const githubId = (session.user as Record<string, unknown>).id as string;

  const { data: user } = await getSupabase()
    .from("users")
    .select("id")
    .eq("github_id", githubId)
    .single();

  const userId = user?.id ?? githubId;

  let plan = "pro";
  let interval = "month";
  let extraSeats = 0;
  try {
    const body = await req.json();
    if (body.plan === "team") plan = "team";
    if (body.interval === "year") interval = "year";
    if (typeof body.extraSeats === "number" && body.extraSeats > 0) {
      extraSeats = body.extraSeats;
    }
  } catch {
    /* default to pro monthly */
  }

  const key = `${plan}-${interval}`;
  const priceId = priceMap[key];

  if (!priceId) {
    return NextResponse.json(
      { error: `No price configured for ${plan} ${interval}. Set the STRIPE_${plan.toUpperCase()}_${interval === "year" ? "YEARLY" : "MONTHLY"}_PRICE_ID env var.` },
      { status: 400 }
    );
  }

  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  let orgId: string | undefined;
  if (plan === "team" && user?.id) {
    const org = await getOrganizationForUser(user.id);
    orgId = org?.id;
  }

  const lineItems: { price: string; quantity: number }[] = [
    { price: priceId, quantity: 1 },
  ];

  if (plan === "team" && extraSeats > 0) {
    const extraSeatPriceId = interval === "year"
      ? process.env.STRIPE_TEAM_EXTRA_SEAT_YEARLY_PRICE_ID
      : process.env.STRIPE_TEAM_EXTRA_SEAT_MONTHLY_PRICE_ID;

    if (extraSeatPriceId) {
      lineItems.push({ price: extraSeatPriceId, quantity: extraSeats });
    }
  }

  const checkoutSession = await createCheckoutSession(
    userId,
    lineItems,
    `${origin}/dashboard?checkout=success`,
    `${origin}/dashboard?checkout=canceled`,
    { orgId }
  );

  return NextResponse.json({ url: checkoutSession.url });
}
