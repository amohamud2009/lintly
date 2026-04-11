import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabase } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as Record<string, unknown>).id as string;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const [{ data: allReviews }, { data: allScans }] = await Promise.all([
    getSupabase()
      .from("reviews")
      .select("repo, score, comments_posted, ai_comments, created_at")
      .eq("user_id", userId)
      .gte("created_at", startOfPrevMonth)
      .order("created_at", { ascending: false }),
    getSupabase()
      .from("security_scans")
      .select("repo, issues_found, created_at")
      .eq("user_id", userId)
      .gte("created_at", startOfPrevMonth),
  ]);

  const rows = allReviews ?? [];
  const scans = allScans ?? [];
  const thisMonth = rows.filter((r) => r.created_at >= startOfMonth);
  const prevMonth = rows.filter((r) => r.created_at >= startOfPrevMonth && r.created_at < startOfMonth);
  const scansThisMonth = scans.filter((s) => s.created_at >= startOfMonth);

  const scored = thisMonth.filter((r) => r.score !== null);
  const scoredPrev = prevMonth.filter((r) => r.score !== null);

  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length)
    : null;
  const avgScorePrev = scoredPrev.length > 0
    ? Math.round(scoredPrev.reduce((s, r) => s + r.score, 0) / scoredPrev.length)
    : null;

  const totalComments = thisMonth.reduce((s, r) => s + (r.comments_posted ?? 0), 0);
  const totalCommentsPrev = prevMonth.reduce((s, r) => s + (r.comments_posted ?? 0), 0);

  const repoCount = new Map<string, number>();
  for (const r of thisMonth) {
    repoCount.set(r.repo, (repoCount.get(r.repo) ?? 0) + 1);
  }
  let topRepo: { name: string; count: number } | null = null;
  repoCount.forEach((count, name) => {
    if (!topRepo || count > topRepo.count) topRepo = { name, count };
  });

  const severity: Record<string, number> = { critical: 0, warning: 0, suggestion: 0, praise: 0 };
  for (const r of thisMonth) {
    const comments = r.ai_comments as { severity?: string }[] | null;
    if (!Array.isArray(comments)) continue;
    for (const c of comments) {
      const key = c.severity ?? "suggestion";
      severity[key] = (severity[key] ?? 0) + 1;
    }
  }

  const totalVulnerabilities = scansThisMonth.reduce((s, sc) => s + (sc.issues_found ?? 0), 0);

  return NextResponse.json({
    avgScore,
    avgScorePrev,
    totalComments,
    totalCommentsPrev,
    topRepo,
    severity,
    scansThisMonth: scansThisMonth.length,
    totalVulnerabilities,
  });
}
