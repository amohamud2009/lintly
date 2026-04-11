import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canUseFeature } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as Record<string, unknown>).id as string;

  const [reviews, scans, chat] = await Promise.all([
    canUseFeature(userId, "reviews"),
    canUseFeature(userId, "securityScans"),
    canUseFeature(userId, "chatMessages"),
  ]);

  return NextResponse.json({
    allowed: reviews.allowed,
    used: reviews.used,
    limit: reviews.limit,
    plan: reviews.plan,
    scansUsed: scans.used,
    scansLimit: scans.limit,
    chatUsed: chat.used,
    chatLimit: chat.limit,
  });
}
