import { inngest } from "@/inngest/review";
import { getSupabase } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildTeamReportHtml } from "@/lib/email-templates/team-report";

interface ReportSettings {
  user_id: string;
  report_enabled: boolean;
  report_frequency: string;
  report_day_of_week: number;
  report_day_of_month: number;
  report_hour: number;
  report_minute: number;
  report_timezone: string;
  report_last_sent_at: string | null;
}

function isScheduledNow(settings: ReportSettings): boolean {
  const now = new Date();

  let userTimeStr: string;
  try {
    userTimeStr = now.toLocaleString("en-US", { timeZone: settings.report_timezone });
  } catch {
    userTimeStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  }
  const userNow = new Date(userTimeStr);

  const hour = userNow.getHours();
  const minute = userNow.getMinutes();
  const dayOfWeek = userNow.getDay();
  const dayOfMonth = userNow.getDate();

  const halfHourSlot = hour * 2 + (minute >= 30 ? 1 : 0);
  const targetSlot = settings.report_hour * 2 + (settings.report_minute >= 30 ? 1 : 0);
  if (halfHourSlot !== targetSlot) return false;

  switch (settings.report_frequency) {
    case "daily":
      return true;
    case "weekly":
      return dayOfWeek === settings.report_day_of_week;
    case "biweekly": {
      if (dayOfWeek !== settings.report_day_of_week) return false;
      const epoch = new Date("2024-01-01");
      const weeksSinceEpoch = Math.floor((userNow.getTime() - epoch.getTime()) / (7 * 86400000));
      return weeksSinceEpoch % 2 === 0;
    }
    case "monthly":
      return dayOfMonth === settings.report_day_of_month;
    default:
      return false;
  }
}

function wasAlreadySentThisSlot(settings: ReportSettings): boolean {
  if (!settings.report_last_sent_at) return false;
  const lastSent = new Date(settings.report_last_sent_at);
  const now = new Date();
  return (now.getTime() - lastSent.getTime()) < 25 * 60 * 1000;
}

function getPeriodRange(frequency: string): { start: Date; end: Date; label: string } {
  const end = new Date();
  const start = new Date();

  switch (frequency) {
    case "daily":
      start.setDate(start.getDate() - 1);
      return { start, end, label: "Daily Report" };
    case "weekly":
      start.setDate(start.getDate() - 7);
      return { start, end, label: "Weekly Report" };
    case "biweekly":
      start.setDate(start.getDate() - 14);
      return { start, end, label: "Bi-Weekly Report" };
    case "monthly":
      start.setMonth(start.getMonth() - 1);
      return { start, end, label: "Monthly Report" };
    default:
      start.setDate(start.getDate() - 7);
      return { start, end, label: "Report" };
  }
}

export const sendTeamReports = inngest.createFunction(
  { id: "send-team-reports", triggers: [{ cron: "*/30 * * * *" }] },
  async ({ step }) => {
    const eligibleUsers = await step.run("find-scheduled-users", async () => {
      const sb = getSupabase();
      const { data: teamSubs } = await sb
        .from("subscriptions")
        .select("user_id")
        .eq("plan", "team")
        .eq("status", "active");

      if (!teamSubs || teamSubs.length === 0) return [];

      const userIds = teamSubs.map((s) => s.user_id);
      const { data: settings } = await sb
        .from("user_settings")
        .select("user_id, report_enabled, report_frequency, report_day_of_week, report_day_of_month, report_hour, report_minute, report_timezone, report_last_sent_at")
        .in("user_id", userIds)
        .eq("report_enabled", true);

      return (settings ?? []).filter(
        (s) => isScheduledNow(s as ReportSettings) && !wasAlreadySentThisSlot(s as ReportSettings)
      ) as ReportSettings[];
    });

    if (eligibleUsers.length === 0) return { sent: 0 };

    await step.run("fan-out-reports", async () => {
      const events = eligibleUsers.map((u) => ({
        name: "team-report/send-user" as const,
        data: {
          userId: u.user_id,
          frequency: u.report_frequency,
        },
      }));
      await inngest.send(events);
    });

    return { fanOut: eligibleUsers.length };
  }
);

export const sendUserTeamReport = inngest.createFunction(
  { id: "send-user-team-report", triggers: [{ event: "team-report/send-user" }] },
  async ({ event, step }) => {
    const { userId, frequency } = event.data;

    const reportData = await step.run("gather-data", async () => {
      const sb = getSupabase();
      const { start, end, label } = getPeriodRange(frequency);

      const { data: user } = await sb
        .from("users")
        .select("name, email, unsubscribe_token, github_id")
        .eq("id", userId)
        .single();

      if (!user?.email) return null;

      const githubId = user.github_id;

      const { data: reviews } = await sb
        .from("reviews")
        .select("score, ai_comments, repo, comments_posted")
        .eq("user_id", githubId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      const allReviews = reviews ?? [];
      const scored = allReviews.filter((r) => r.score !== null);
      const avgScore = scored.length > 0
        ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length)
        : null;

      const prevStart = new Date(start);
      const diff = end.getTime() - start.getTime();
      prevStart.setTime(prevStart.getTime() - diff);
      const { data: prevReviews } = await sb
        .from("reviews")
        .select("score")
        .eq("user_id", githubId)
        .gte("created_at", prevStart.toISOString())
        .lt("created_at", start.toISOString());
      const prevScored = (prevReviews ?? []).filter((r) => r.score !== null);
      const avgScorePrev = prevScored.length > 0
        ? Math.round(prevScored.reduce((s, r) => s + r.score, 0) / prevScored.length)
        : null;

      const totalIssues = allReviews.reduce((s, r) => s + (r.comments_posted ?? 0), 0);

      const repoCount = new Map<string, number>();
      for (const r of allReviews) {
        repoCount.set(r.repo, (repoCount.get(r.repo) ?? 0) + 1);
      }
      let mostActiveRepo: string | null = null;
      let maxCount = 0;
      repoCount.forEach((count, repo) => {
        if (count > maxCount) { maxCount = count; mostActiveRepo = repo; }
      });

      const categoryCount = new Map<string, number>();
      for (const r of allReviews) {
        const comments = r.ai_comments as { category?: string }[] | null;
        if (!Array.isArray(comments)) continue;
        for (const c of comments) {
          const cat = c.category ?? "other";
          categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
        }
      }
      const topCategories = Array.from(categoryCount.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      return {
        userName: user.name ?? "there",
        email: user.email,
        unsubscribeToken: user.unsubscribe_token,
        periodLabel: label,
        avgScore,
        avgScorePrev,
        totalPRs: allReviews.length,
        totalIssues,
        mostActiveRepo,
        topCategories,
      };
    });

    if (!reportData) return { skipped: true, reason: "no_user" };

    await step.run("send-email", async () => {
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

      const html = buildTeamReportHtml({
        userName: reportData.userName,
        periodLabel: reportData.periodLabel,
        avgScore: reportData.avgScore,
        avgScorePrev: reportData.avgScorePrev,
        totalPRs: reportData.totalPRs,
        totalIssues: reportData.totalIssues,
        mostActiveRepo: reportData.mostActiveRepo,
        topCategories: reportData.topCategories,
        unsubscribeUrl: reportData.unsubscribeToken
          ? `${baseUrl}/dashboard/settings`
          : `${baseUrl}/dashboard/settings`,
        dashboardUrl: `${baseUrl}/dashboard`,
      });

      await sendEmail({
        to: reportData.email,
        subject: `Lintly ${reportData.periodLabel} — Score: ${reportData.avgScore ?? "N/A"}/100`,
        html,
      });
    });

    await step.run("mark-sent", async () => {
      await getSupabase()
        .from("user_settings")
        .update({ report_last_sent_at: new Date().toISOString() })
        .eq("user_id", userId);
    });

    return { sent: true };
  }
);
