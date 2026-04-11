import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabase } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const { data, error } = await getSupabase()
    .from("reviews")
    .select("repo, created_at, comments_posted, score")
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const repoMap = new Map<string, { count: number; comments: number; lastReview: string; scores: number[] }>();

  for (const row of data ?? []) {
    const existing = repoMap.get(row.repo);
    if (existing) {
      existing.count++;
      existing.comments += row.comments_posted ?? 0;
      if (row.score !== null) existing.scores.push(row.score);
      if (row.created_at > existing.lastReview) {
        existing.lastReview = row.created_at;
      }
    } else {
      repoMap.set(row.repo, {
        count: 1,
        comments: row.comments_posted ?? 0,
        scores: row.score !== null ? [row.score] : [],
        lastReview: row.created_at,
      });
    }
  }

  const repos = Array.from(repoMap.entries()).map(([name, stats]) => ({
    name,
    reviewCount: stats.count,
    commentCount: stats.comments,
    avgScore: stats.scores.length > 0 ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length) : null,
    lastReview: stats.lastReview,
  }));

  repos.sort((a, b) => new Date(b.lastReview).getTime() - new Date(a.lastReview).getTime());

  return NextResponse.json(repos);
}
