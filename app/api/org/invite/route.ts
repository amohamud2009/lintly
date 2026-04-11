import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getUserUuid,
  getOrganizationForUser,
  getOrgMemberRole,
  getOrgMembers,
  getSupabase,
  getSubscription,
} from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const githubId = (session.user as Record<string, unknown>).id as string;
  const uuid = await getUserUuid(githubId);
  if (!uuid) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const org = await getOrganizationForUser(uuid);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const role = await getOrgMemberRole(org.id, uuid);
  if (!role || role === "member")
    return NextResponse.json({ error: "Only owners and admins can invite" }, { status: 403 });

  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const memberRole = body.role === "admin" ? "admin" : "member";

  if (!email || !email.includes("@"))
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });

  const members = await getOrgMembers(org.id);

  // Check user's own subscription first, then fall back to org-level subscription
  let sub = await getSubscription(githubId);
  if (!sub || (sub.plan !== "team" && sub.plan !== "enterprise")) {
    const { data: orgSub } = await getSupabase()
      .from("subscriptions")
      .select("*")
      .eq("org_id", org.id)
      .eq("status", "active")
      .single();
    if (orgSub) sub = orgSub;
  }

  const plan = sub?.plan ?? "free";
  const extraSeats = (sub?.extra_seats as number) ?? 0;

  let seatLimit: number;
  if (plan === "team") {
    seatLimit = PLANS.team.baseSeats + extraSeats;
  } else if (plan === "enterprise") {
    seatLimit = Infinity;
  } else {
    seatLimit = 1;
  }

  if (members.length >= seatLimit) {
    const msg = plan === "team"
      ? `Seat limit reached (${members.length}/${seatLimit}). Add more seats in Settings to invite more members.`
      : `Your ${plan === "free" ? "Free" : "Pro"} plan only supports 1 seat. Upgrade to the Team plan to invite up to 4 members.`;
    return NextResponse.json({ error: msg, needsUpgrade: plan !== "team" }, { status: 403 });
  }

  const alreadyMember = members.find(
    (m) => m.invited_email === email || m.user?.email === email
  );
  if (alreadyMember)
    return NextResponse.json({ error: "Already a member or invited" }, { status: 409 });

  const inviteToken = randomBytes(32).toString("hex");

  const { error } = await getSupabase().from("organization_members").insert({
    org_id: org.id,
    user_id: null as unknown as string,
    role: memberRole,
    invited_email: email,
    invite_token: inviteToken,
    invite_status: "pending",
  });

  if (error)
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const inviteUrl = `${baseUrl}/api/org/invite/accept?token=${inviteToken}`;

  try {
    await sendEmail({
      to: email,
      subject: `You've been invited to join ${org.name} on Lintly`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:48px 24px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;width:40px;height:40px;border-radius:12px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.2);line-height:40px;text-align:center;color:#34d399;font-size:16px;font-weight:700;">L</div>
  </div>
  <h1 style="color:#e5e5e5;font-size:22px;font-weight:600;margin:0 0 12px;text-align:center;">You're invited to ${org.name}</h1>
  <p style="color:rgba(255,255,255,0.4);font-size:15px;text-align:center;margin:0 0 32px;line-height:1.6;">
    You've been invited to join <strong style="color:rgba(255,255,255,0.7);">${org.name}</strong> on Lintly as a <strong style="color:rgba(255,255,255,0.7);">${memberRole}</strong>. Lintly is an AI-powered code review platform that helps teams ship better code.
  </p>
  <div style="text-align:center;margin-bottom:32px;">
    <a href="${inviteUrl}" style="display:inline-block;background:#34d399;color:#000;font-size:14px;font-weight:600;padding:14px 36px;border-radius:999px;text-decoration:none;">Accept Invitation</a>
  </div>
  <p style="color:rgba(255,255,255,0.15);font-size:12px;text-align:center;">If you didn't expect this invitation, you can safely ignore this email.</p>
</div>
</body></html>`,
    });
  } catch (emailErr) {
    console.error("Failed to send invite email:", emailErr);
  }

  return NextResponse.json({
    invited: true,
    email,
    inviteUrl,
  });
}
