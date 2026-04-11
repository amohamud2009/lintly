import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserUuid, getSupabase } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    const signInUrl = new URL("/", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signInUrl);
  }

  const githubId = (session.user as Record<string, unknown>).id as string;
  const uuid = await getUserUuid(githubId);
  if (!uuid)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const sb = getSupabase();

  const { data: invite } = await sb
    .from("organization_members")
    .select("id, org_id, invite_status")
    .eq("invite_token", token)
    .single();

  if (!invite)
    return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });

  if (invite.invite_status === "accepted")
    return NextResponse.redirect(new URL("/dashboard", req.url));

  const { data: existing } = await sb
    .from("organization_members")
    .select("id")
    .eq("org_id", invite.org_id)
    .eq("user_id", uuid)
    .single();

  if (existing) {
    await sb.from("organization_members").delete().eq("id", invite.id);
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  await sb
    .from("organization_members")
    .update({
      user_id: uuid,
      invite_status: "accepted",
      invite_token: null,
    })
    .eq("id", invite.id);

  return NextResponse.redirect(new URL("/dashboard?joined=true", req.url));
}
