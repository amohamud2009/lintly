import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getUserUuid,
  getOrganizationForUser,
  getOrgMemberRole,
  getSupabase,
} from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params;
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
    return NextResponse.json({ error: "Only owners and admins can remove members" }, { status: 403 });

  const sb = getSupabase();
  const { data: target } = await sb
    .from("organization_members")
    .select("role, user_id")
    .eq("id", memberId)
    .eq("org_id", org.id)
    .single();

  if (!target)
    return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (target.role === "owner")
    return NextResponse.json({ error: "Cannot remove the owner" }, { status: 403 });

  await sb.from("organization_members").delete().eq("id", memberId);
  return NextResponse.json({ deleted: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const githubId = (session.user as Record<string, unknown>).id as string;
  const uuid = await getUserUuid(githubId);
  if (!uuid) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const org = await getOrganizationForUser(uuid);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const callerRole = await getOrgMemberRole(org.id, uuid);
  if (callerRole !== "owner")
    return NextResponse.json({ error: "Only the owner can change roles" }, { status: 403 });

  const body = await req.json();
  const newRole = String(body.role);
  if (!["admin", "member"].includes(newRole))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const sb = getSupabase();
  const { data: target } = await sb
    .from("organization_members")
    .select("role")
    .eq("id", memberId)
    .eq("org_id", org.id)
    .single();

  if (!target)
    return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (target.role === "owner")
    return NextResponse.json({ error: "Cannot change owner role" }, { status: 403 });

  await sb
    .from("organization_members")
    .update({ role: newRole })
    .eq("id", memberId);

  return NextResponse.json({ updated: true, role: newRole });
}
