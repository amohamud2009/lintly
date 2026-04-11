import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getUserUuid,
  createOrganization,
  getOrganizationForUser,
} from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const githubId = (session.user as Record<string, unknown>).id as string;
  const uuid = await getUserUuid(githubId);
  if (!uuid)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const org = await getOrganizationForUser(uuid);
  return NextResponse.json(org);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const githubId = (session.user as Record<string, unknown>).id as string;
  const uuid = await getUserUuid(githubId);
  if (!uuid)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await getOrganizationForUser(uuid);
  if (existing)
    return NextResponse.json({ error: "Already in an organization" }, { status: 409 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 100)
    return NextResponse.json({ error: "Name required (max 100 chars)" }, { status: 400 });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  if (!slug)
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });

  try {
    const org = await createOrganization(name, slug, uuid);
    return NextResponse.json(org, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("duplicate")) {
      return NextResponse.json({ error: "Organization name already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }
}
