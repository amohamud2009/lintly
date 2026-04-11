import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabase, getSubscription } from "@/lib/db";
import { PLANS, getTeamReviewLimit, getTeamMonthlyPrice } from "@/lib/plans";
import Stripe from "stripe";

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-03-25.dahlia",
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const githubId = (session.user as Record<string, unknown>).id as string;
  const sub = await getSubscription(githubId);

  if (!sub || sub.plan !== "team") {
    return NextResponse.json({ error: "Team plan required" }, { status: 403 });
  }

  const extraSeats = sub.extra_seats ?? 0;
  const totalSeats = PLANS.team.baseSeats + extraSeats;
  const reviewLimit = getTeamReviewLimit(totalSeats, sub.billing_interval);
  const monthlyTotal = getTeamMonthlyPrice(totalSeats);

  return NextResponse.json({
    totalSeats,
    extraSeats,
    baseSeats: PLANS.team.baseSeats,
    maxSeats: PLANS.team.maxSeats,
    reviewLimit,
    monthlyTotal,
    basePrice: PLANS.team.monthlyPrice,
    extraSeatPrice: PLANS.team.extraSeatPrice,
    billingInterval: sub.billing_interval,
    stripeSubscriptionId: sub.stripe_subscription_id,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const githubId = (session.user as Record<string, unknown>).id as string;
  const sub = await getSubscription(githubId);

  if (!sub || sub.plan !== "team") {
    return NextResponse.json({ error: "Team plan required" }, { status: 403 });
  }

  const { totalSeats } = await req.json();
  if (typeof totalSeats !== "number" || totalSeats < PLANS.team.baseSeats) {
    return NextResponse.json({ error: `Minimum ${PLANS.team.baseSeats} seats` }, { status: 400 });
  }
  if (totalSeats > PLANS.team.maxSeats) {
    return NextResponse.json({
      error: `Maximum ${PLANS.team.maxSeats} seats. Contact ${PLANS.enterprise.contactEmail} for Enterprise pricing.`,
    }, { status: 400 });
  }

  const newExtraSeats = totalSeats - PLANS.team.baseSeats;
  const stripeSubId = sub.stripe_subscription_id;
  const extraPriceId = process.env.STRIPE_EXTRA_SEAT_PRICE_ID || process.env.STRIPE_TEAM_EXTRA_SEAT_MONTHLY_PRICE_ID;

  if (stripeSubId && extraPriceId) {
    const stripe = getStripe();
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
    const items = stripeSub.items.data;

    const extraSeatItem = items.find((i) => i.price.id === extraPriceId);

    if (newExtraSeats === 0 && extraSeatItem) {
      await stripe.subscriptionItems.del(extraSeatItem.id);
    } else if (newExtraSeats > 0 && extraSeatItem) {
      await stripe.subscriptionItems.update(extraSeatItem.id, {
        quantity: newExtraSeats,
      });
    } else if (newExtraSeats > 0 && !extraSeatItem) {
      await stripe.subscriptionItems.create({
        subscription: stripeSubId,
        price: extraPriceId,
        quantity: newExtraSeats,
      });
    }
  }

  await getSupabase()
    .from("subscriptions")
    .update({ extra_seats: newExtraSeats })
    .eq("user_id", sub.user_id);

  const reviewLimit = getTeamReviewLimit(totalSeats, sub.billing_interval);
  const monthlyTotal = getTeamMonthlyPrice(totalSeats);

  return NextResponse.json({
    totalSeats,
    extraSeats: newExtraSeats,
    reviewLimit,
    monthlyTotal,
  });
}
