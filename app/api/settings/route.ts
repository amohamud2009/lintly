import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserSettings, updateUserSettings } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const settings = await getUserSettings(userId);

  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validSeverities = ["all", "warning", "critical"];
  const severity = String(body.severity_threshold ?? "all");
  if (!validSeverities.includes(severity)) {
    return NextResponse.json({ error: "Invalid severity_threshold" }, { status: 400 });
  }

  const instructions = String(body.custom_instructions ?? "").slice(0, 2000);
  const aiCodeMode = body.ai_code_mode === true;

  await updateUserSettings(userId, {
    severity_threshold: severity as "all" | "warning" | "critical",
    custom_instructions: instructions,
    ai_code_mode: aiCodeMode,
  });

  return NextResponse.json({ success: true });
}
