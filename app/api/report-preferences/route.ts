import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabase } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const githubId = (session.user as Record<string, unknown>).id as string;

  const { data } = await getSupabase()
    .from("user_settings")
    .select("report_enabled, report_frequency, report_day_of_week, report_day_of_month, report_hour, report_minute, report_timezone")
    .eq("user_id", githubId)
    .single();

  return NextResponse.json(data ?? {
    report_enabled: true,
    report_frequency: "weekly",
    report_day_of_week: 1,
    report_day_of_month: 1,
    report_hour: 8,
    report_minute: 0,
    report_timezone: "America/New_York",
  });
}

const validFrequencies = ["daily", "weekly", "biweekly", "monthly"];

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const githubId = (session.user as Record<string, unknown>).id as string;
  const body = await req.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.report_enabled === "boolean") {
    updates.report_enabled = body.report_enabled;
  }
  if (typeof body.report_frequency === "string" && validFrequencies.includes(body.report_frequency)) {
    updates.report_frequency = body.report_frequency;
  }
  if (typeof body.report_day_of_week === "number" && body.report_day_of_week >= 0 && body.report_day_of_week <= 6) {
    updates.report_day_of_week = body.report_day_of_week;
  }
  if (typeof body.report_day_of_month === "number" && body.report_day_of_month >= 1 && body.report_day_of_month <= 28) {
    updates.report_day_of_month = body.report_day_of_month;
  }
  if (typeof body.report_hour === "number" && body.report_hour >= 0 && body.report_hour <= 23) {
    updates.report_hour = body.report_hour;
  }
  if (typeof body.report_minute === "number" && (body.report_minute === 0 || body.report_minute === 30)) {
    updates.report_minute = body.report_minute;
  }
  if (typeof body.report_timezone === "string" && body.report_timezone.length > 0 && body.report_timezone.length < 100) {
    updates.report_timezone = body.report_timezone;
  }

  await getSupabase()
    .from("user_settings")
    .upsert(
      { user_id: githubId, ...updates },
      { onConflict: "user_id" }
    );

  return NextResponse.json({ ok: true });
}
