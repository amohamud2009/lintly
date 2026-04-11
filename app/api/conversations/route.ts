import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabase } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as Record<string, unknown>).id as string;

  const { data } = await getSupabase()
    .from("chat_conversations")
    .select("id, title, archived, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await req.json();

  const conversationId = body.conversationId as string | undefined;
  const messages = body.messages as
    | { role: string; content: string; actions?: unknown }[]
    | undefined;
  const title = body.title as string | undefined;

  if (conversationId) {
    const sb = getSupabase();

    const { data: owned } = await sb
      .from("chat_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .single();

    if (!owned)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (messages && messages.length > 0) {
      const rows = messages.map((m) => ({
        conversation_id: conversationId,
        role: m.role,
        content: m.content,
        actions: m.actions ?? null,
      }));
      await sb.from("chat_messages").insert(rows);
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (title) updates.title = title;
    await sb
      .from("chat_conversations")
      .update(updates)
      .eq("id", conversationId)
      .eq("user_id", userId);

    return NextResponse.json({ id: conversationId });
  }

  const autoTitle =
    title ??
    (messages?.[0]?.content
      ? messages[0].content.slice(0, 60) +
        (messages[0].content.length > 60 ? "..." : "")
      : "New chat");

  const { data: conv, error } = await getSupabase()
    .from("chat_conversations")
    .insert({ user_id: userId, title: autoTitle })
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: "Failed to create chat" }, { status: 500 });

  if (messages && messages.length > 0) {
    const rows = messages.map((m) => ({
      conversation_id: conv.id,
      role: m.role,
      content: m.content,
      actions: m.actions ?? null,
    }));
    await getSupabase().from("chat_messages").insert(rows);
  }

  return NextResponse.json({ id: conv.id, title: autoTitle });
}
