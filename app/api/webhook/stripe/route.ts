import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhook } from "@/lib/stripe";
import { getSupabase } from "@/lib/db";

function resolvePlanFromPrice(priceId: string | undefined): { plan: string; billing_interval: string } | null {
  if (!priceId) return null;

  if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID) return { plan: "pro", billing_interval: "month" };
  if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) return { plan: "pro", billing_interval: "year" };
  if (priceId === process.env.STRIPE_TEAM_MONTHLY_PRICE_ID) return { plan: "team", billing_interval: "month" };
  if (priceId === process.env.STRIPE_TEAM_YEARLY_PRICE_ID) return { plan: "team", billing_interval: "year" };

  return null;
}

function extractPriceId(obj: unknown): string | undefined {
  const record = obj as Record<string, unknown>;
  const lineItems = record?.line_items as { data?: { price?: { id?: string } }[] } | undefined;
  if (lineItems?.data?.[0]?.price?.id) return lineItems.data[0].price.id;

  const items = record?.items as { data?: { price?: { id?: string } }[] } | undefined;
  return items?.data?.[0]?.price?.id;
}

function extractExtraSeats(obj: unknown): number {
  const record = obj as Record<string, unknown>;
  const extraPriceId = process.env.STRIPE_EXTRA_SEAT_PRICE_ID;
  if (!extraPriceId) return 0;

  const lineItems = record?.line_items as { data?: { price?: { id?: string }; quantity?: number }[] } | undefined;
  const items = record?.items as { data?: { price?: { id?: string }; quantity?: number }[] } | undefined;
  const allItems = [...(lineItems?.data ?? []), ...(items?.data ?? [])];

  for (const item of allItems) {
    if (item.price?.id === extraPriceId) return item.quantity ?? 0;
  }
  return 0;
}

async function isEventProcessed(eventId: string): Promise<boolean> {
  const sb = getSupabase();
  const { data } = await sb
    .from("stripe_events")
    .select("event_id")
    .eq("event_id", eventId)
    .single();
  return !!data;
}

async function markEventProcessed(eventId: string): Promise<void> {
  await getSupabase()
    .from("stripe_events")
    .upsert({ event_id: eventId, processed_at: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event;
  try {
    event = verifyStripeWebhook(body, signature);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (await isEventProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const orgId = session.metadata?.orgId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const priceId = extractPriceId(session);
        const resolved = resolvePlanFromPrice(priceId);

        if (!resolved) {
          console.error(`Unknown Stripe price ID: ${priceId}`);
          return NextResponse.json({ error: "Unknown price ID" }, { status: 400 });
        }

        if (userId) {
          const extraSeats = extractExtraSeats(session);
          const upsertData: Record<string, unknown> = {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: "active",
            plan: resolved.plan,
            billing_interval: resolved.billing_interval,
            extra_seats: extraSeats,
          };
          if (orgId) upsertData.org_id = orgId;

          const { error } = await getSupabase()
            .from("subscriptions")
            .upsert(upsertData, { onConflict: "user_id" });
          if (error) {
            console.error("Subscription upsert failed:", error);
            return NextResponse.json({ error: "DB error" }, { status: 500 });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const priceId = extractPriceId(subscription);
        const resolved = resolvePlanFromPrice(priceId);

        const updateData: Record<string, unknown> = { status: subscription.status };
        if (resolved) {
          updateData.plan = resolved.plan;
          updateData.billing_interval = resolved.billing_interval;
        }

        const { error } = await getSupabase()
          .from("subscriptions")
          .update(updateData)
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          console.error("Subscription update failed:", error);
          return NextResponse.json({ error: "DB error" }, { status: 500 });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const { error } = await getSupabase()
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          console.error("Subscription cancel failed:", error);
          return NextResponse.json({ error: "DB error" }, { status: 500 });
        }
        break;
      }
    }

    await markEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
