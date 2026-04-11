import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserUuid, getOrganizationForUser, getOrgMembers } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const githubId = (session.user as Record<string, unknown>).id as string;
  const uuid = await getUserUuid(githubId);
  if (!uuid) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const org = await getOrganizationForUser(uuid);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const members = await getOrgMembers(org.id);
  return NextResponse.json(members);
}
