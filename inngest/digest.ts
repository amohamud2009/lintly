import { inngest } from "@/inngest/review";
import { getSupabase, canUseFeature } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildDigestHtml } from "@/lib/email-templates/digest";

export const sendDailyDigest = inngest.createFunction(
  { id: "send-daily-digest", triggers: [{ cron: "0 9 * * *" }] },
  async ({ step }) => {
    const users = await step.run("fetch-eligible-users", async () => {
      const { data } = await getSupabase()
        .from("users")
        .select("github_id, email")
        .eq("digest_enabled", true);
      return (data ?? []).filter((u) => !!u.email);
    });

    if (users.length === 0) return { sent: 0, total: 0 };

    await step.run("fan-out-digests", async () => {
      const events = users.map((u) => ({
        name: "digest/send-user" as const,
        data: { githubId: u.github_id, email: u.email },
      }));
      await inngest.send(events);
    });

    return { fanOut: users.length };
  }
);

export const sendUserDigest = inngest.createFunction(
  { id: "send-user-digest", triggers: [{ event: "digest/send-user" }] },
  async ({ event, step }) => {
    const { githubId, email } = event.data;

    const usage = await step.run("check-limit", async () => {
      return canUseFeature(githubId, "digestEmails");
    });

    if (!usage.allowed) return { skipped: true };

    const digestData = await step.run("gather-data", async () => {
      const sb = getSupabase();
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const weekAgo = new Date(now.getTime() - 7 * 86400000);

      const [{ data: user }, { data: recentReviews }, { data: scans }, { count: weeklyCount }] = await Promise.all([
        sb.from("users").select("name, unsubscribe_token").eq("github_id", githubId).single(),
        sb.from("reviews").select("score, ai_comments, comments_posted").eq("user_id", githubId).gte("created_at", yesterday.toISOString()),
        sb.from("security_scans").select("issues_found").eq("user_id", githubId).gte("created_at", yesterday.toISOString()),
        sb.from("reviews").select("*", { count: "exact", head: true }).eq("user_id", githubId).gte("created_at", weekAgo.toISOString()),
      ]);

      const reviews = recentReviews ?? [];
      const scored = reviews.filter((r) => r.score !== null);
      const avgScore = scored.length > 0
        ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length)
        : null;

      const prevDay = new Date(yesterday.getTime() - 86400000);
      const { data: prevReviews } = await sb
        .from("reviews")
        .select("score")
        .eq("user_id", githubId)
        .gte("created_at", prevDay.toISOString())
        .lt("created_at", yesterday.toISOString());
      const prevScored = (prevReviews ?? []).filter((r) => r.score !== null);
      const avgScorePrev = prevScored.length > 0
        ? Math.round(prevScored.reduce((s, r) => s + r.score, 0) / prevScored.length)
        : null;

      const securityScansRun = scans?.length ?? 0;
      const securityIssuesFound = (scans ?? []).reduce((s, r) => s + (r.issues_found ?? 0), 0);

      const typeCount = new Map<string, number>();
      for (const r of reviews) {
        const comments = r.ai_comments as { severity?: string }[] | null;
        if (!Array.isArray(comments)) continue;
        for (const c of comments) {
          const sev = c.severity ?? "suggestion";
          typeCount.set(sev, (typeCount.get(sev) ?? 0) + 1);
        }
      }
      const topIssueTypes = Array.from(typeCount.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      return {
        userName: user?.name ?? "there",
        unsubscribeToken: user?.unsubscribe_token,
        reviewsYesterday: reviews.length,
        avgScore,
        avgScorePrev,
        securityScansRun,
        securityIssuesFound,
        topIssueTypes,
        weeklyIssuesCaught: weeklyCount ?? 0,
      };
    });

    await step.run("send-email", async () => {
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      if (!digestData.unsubscribeToken) return;

      const html = buildDigestHtml({
        userName: digestData.userName,
        reviewsYesterday: digestData.reviewsYesterday,
        avgScore: digestData.avgScore,
        avgScorePrev: digestData.avgScorePrev,
        securityScansRun: digestData.securityScansRun,
        securityIssuesFound: digestData.securityIssuesFound,
        topIssueTypes: digestData.topIssueTypes,
        weeklyIssuesCaught: digestData.weeklyIssuesCaught,
        unsubscribeUrl: `${baseUrl}/api/unsubscribe?token=${digestData.unsubscribeToken}`,
      });

      await sendEmail({
        to: email,
        subject: `Lintly Daily Digest — ${digestData.reviewsYesterday} PR${digestData.reviewsYesterday !== 1 ? "s" : ""} reviewed`,
        html,
      });
    });

    return { sent: true };
  }
);
