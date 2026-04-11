import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabase } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as Record<string, unknown>).id as string;
  const sb = getSupabase();

  const { data: conv } = await sb
    .from("chat_conversations")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (!conv)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages } = await sb
    .from("chat_messages")
    .select("id, role, content, actions, created_at")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ ...conv, messages: messages ?? [] });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as Record<string, unknown>).id as string;

  await getSupabase()
    .from("chat_conversations")
    .delete()
    .eq("id", params.id)
    .eq("user_id", userId);

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.archived === "boolean") updates.archived = body.archived;
  if (typeof body.title === "string") updates.title = body.title;

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  await getSupabase()
    .from("chat_conversations")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
