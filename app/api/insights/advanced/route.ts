import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabase } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as Record<string, unknown>).id as string;
  const userName = (session.user as Record<string, unknown>).name as string | undefined;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

  const [{ data: recentReviews }, { data: recentScans }] = await Promise.all([
    getSupabase()
      .from("reviews")
      .select("score, ai_comments, pr_author, created_at, comments_posted, repo")
      .eq("user_id", userId)
      .gte("created_at", sixtyDaysAgo.toISOString())
      .order("created_at", { ascending: false }),
    getSupabase()
      .from("security_scans")
      .select("issues_found, scan_results, created_at, repo")
      .eq("user_id", userId)
      .gte("created_at", sixtyDaysAgo.toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const all = recentReviews ?? [];
  const scans = recentScans ?? [];
  const thisMonth = all.filter((r) => r.created_at >= thirtyDaysAgo.toISOString());
  const thisWeek = all.filter((r) => r.created_at >= sevenDaysAgo.toISOString());
  const lastWeek = all.filter(
    (r) =>
      r.created_at >= fourteenDaysAgo.toISOString() &&
      r.created_at < sevenDaysAgo.toISOString()
  );
  const scansThisMonth = scans.filter((s) => s.created_at >= thirtyDaysAgo.toISOString());
  const scansThisWeek = scans.filter((s) => s.created_at >= sevenDaysAgo.toISOString());

  const distribution = { "0-49": 0, "50-69": 0, "70-89": 0, "90-100": 0 };
  for (const r of thisMonth) {
    if (r.score === null) continue;
    if (r.score >= 90) distribution["90-100"]++;
    else if (r.score >= 70) distribution["70-89"]++;
    else if (r.score >= 50) distribution["50-69"]++;
    else distribution["0-49"]++;
  }

  const issueTypes: Record<string, number> = {};
  for (const r of thisMonth) {
    const comments = r.ai_comments as { severity?: string }[] | null;
    if (!Array.isArray(comments)) continue;
    for (const c of comments) {
      const type = c.severity ?? "suggestion";
      issueTypes[type] = (issueTypes[type] ?? 0) + 1;
    }
  }

  const issueList = Object.entries(issueTypes)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const authorMap = new Map<string, { scores: number[]; issues: Record<string, number>; reviewCount: number }>();
  for (const r of thisMonth) {
    let author = r.pr_author ?? "unknown";
    if (author === "unknown" && userName) author = userName;
    if (!authorMap.has(author)) authorMap.set(author, { scores: [], issues: {}, reviewCount: 0 });
    const entry = authorMap.get(author)!;
    entry.reviewCount++;
    if (r.score !== null) entry.scores.push(r.score);
    const comments = r.ai_comments as { severity?: string }[] | null;
    if (Array.isArray(comments)) {
      for (const c of comments) {
        const sev = c.severity ?? "suggestion";
        entry.issues[sev] = (entry.issues[sev] ?? 0) + 1;
      }
    }
  }
  const prevMonth = all.filter(
    (r) => r.created_at >= sixtyDaysAgo.toISOString() && r.created_at < thirtyDaysAgo.toISOString()
  );
  const prevAuthorMap = new Map<string, number[]>();
  for (const r of prevMonth) {
    let author = r.pr_author ?? "unknown";
    if (author === "unknown" && userName) author = userName;
    if (!prevAuthorMap.has(author)) prevAuthorMap.set(author, []);
    if (r.score !== null) prevAuthorMap.get(author)!.push(r.score);
  }

  const authors = Array.from(authorMap.entries())
    .map(([name, data]) => {
      const avgScore =
        data.scores.length > 0
          ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
          : null;
      const prevScores = prevAuthorMap.get(name) ?? [];
      const prevAvgScore = prevScores.length > 0
        ? Math.round(prevScores.reduce((a, b) => a + b, 0) / prevScores.length)
        : null;
      const topIssue = Object.entries(data.issues).sort((a, b) => b[1] - a[1])[0];
      return {
        name,
        avgScore,
        prevAvgScore,
        reviewCount: data.reviewCount,
        topIssue: topIssue ? topIssue[0] : null,
      };
    })
    .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));

  const thisWeekScored = thisWeek.filter((r) => r.score !== null);
  const lastWeekScored = lastWeek.filter((r) => r.score !== null);
  const thisWeekAvg =
    thisWeekScored.length > 0
      ? Math.round(thisWeekScored.reduce((s, r) => s + r.score, 0) / thisWeekScored.length)
      : null;
  const lastWeekAvg =
    lastWeekScored.length > 0
      ? Math.round(lastWeekScored.reduce((s, r) => s + r.score, 0) / lastWeekScored.length)
      : null;

  const thisMonthScored = thisMonth.filter((r) => r.score !== null);
  const avgScoreAllTime =
    thisMonthScored.length > 0
      ? Math.round(thisMonthScored.reduce((s, r) => s + r.score, 0) / thisMonthScored.length)
      : null;

  const thisWeekCritical = thisWeek.reduce((sum, r) => {
    const comments = r.ai_comments as { severity?: string }[] | null;
    if (!Array.isArray(comments)) return sum;
    return sum + comments.filter((c) => c.severity === "critical").length;
  }, 0);

  const totalVulnerabilities = scansThisMonth.reduce((s, sc) => s + (sc.issues_found ?? 0), 0);

  const securityIssueTypes: Record<string, number> = {};
  for (const sc of scansThisMonth) {
    const results = sc.scan_results as { type?: string; severity?: string }[] | null;
    if (!Array.isArray(results)) continue;
    for (const issue of results) {
      const type = issue.type ?? "unknown";
      securityIssueTypes[type] = (securityIssueTypes[type] ?? 0) + 1;
    }
  }

  const actionableInsights: string[] = [];

  if (avgScoreAllTime !== null) {
    if (avgScoreAllTime >= 80)
      actionableInsights.push("Your code quality is strong — keep it up.");
    else if (avgScoreAllTime >= 50)
      actionableInsights.push("Code quality is moderate. Focus on the critical issues flagged in reviews.");
    else
      actionableInsights.push("Code quality needs attention. Review the critical and warning issues below.");
  }

  if (totalVulnerabilities > 0) {
    actionableInsights.push(
      `${totalVulnerabilities} security vulnerabilit${totalVulnerabilities === 1 ? "y" : "ies"} found across ${scansThisMonth.length} scan${scansThisMonth.length !== 1 ? "s" : ""} this month.`
    );
  } else if (scansThisMonth.length > 0) {
    actionableInsights.push("No security vulnerabilities detected — your codebase looks clean.");
  }

  if (thisMonth.length > 0 && Object.keys(issueTypes).length === 0) {
    actionableInsights.push("Reviews ran but no specific issues were flagged. Your code is looking solid.");
  }

  const topSecurityIssues = Object.entries(securityIssueTypes)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (topSecurityIssues.length > 0) {
    actionableInsights.push(
      `Most common vulnerability: ${topSecurityIssues[0].type.replace(/_/g, " ")} (${topSecurityIssues[0].count}×).`
    );
  }

  return NextResponse.json({
    distribution,
    issueTypes,
    topIssues: issueList,
    authors,
    weeklyComparison: {
      thisWeekReviews: thisWeek.length,
      lastWeekReviews: lastWeek.length,
      thisWeekAvg,
      lastWeekAvg,
      criticalIssues: thisWeekCritical,
      avgScore30d: avgScoreAllTime,
    },
    security: {
      scansThisMonth: scansThisMonth.length,
      scansThisWeek: scansThisWeek.length,
      totalVulnerabilities,
      topIssues: topSecurityIssues,
      issueTypes: securityIssueTypes,
    },
    actionableInsights,
  });
}
