import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSubscription } from "@/lib/db";
import { createPortalSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const sub = await getSubscription(userId);

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  const portalSession = await createPortalSession(
    sub.stripe_customer_id,
    `${origin}/dashboard`
  );

  return NextResponse.json({ url: portalSession.url });
}
