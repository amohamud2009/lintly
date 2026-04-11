import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabase } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as Record<string, unknown>).id as string;

  const { data } = await getSupabase()
    .from("patterns")
    .select("*")
    .eq("user_id", userId)
    .eq("dismissed", false)
    .order("occurrence_count", { ascending: false })
    .limit(10);

  return NextResponse.json(data ?? []);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as Record<string, unknown>).id as string;
  const { id } = await req.json();

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await getSupabase()
    .from("patterns")
    .update({ dismissed: true })
    .eq("id", id)
    .eq("user_id", userId);

  return NextResponse.json({ success: true });
}
