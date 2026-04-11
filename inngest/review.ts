import { Inngest } from "inngest";
import { createOctokit, getPullRequestDiff, getPullRequestFiles, postReviewComment, postReviewSummary, postCommitStatus, getInstallationAccessToken } from "@/lib/github";
import { reviewDiff, type ReviewComment } from "@/lib/claude";
import { logReview, canRunReview, getUserSettings, getSupabase } from "@/lib/db";

export const inngest = new Inngest({ id: "lintly" });

function formatCommentBody(comment: ReviewComment): string {
  const severityEmoji: Record<string, string> = {
    critical: "\u{1F6A8}",
    warning: "\u26A0\uFE0F",
    suggestion: "\u{1F4A1}",
    praise: "\u{2728}",
  };

  const isAiRisk = comment.category === "ai-risk";
  const emoji = isAiRisk ? "\u{1F916}" : (severityEmoji[comment.severity] ?? "");
  const categoryBadge = isAiRisk
    ? " `\u{1F916} AI Risk`"
    : comment.category ? ` \`${comment.category}\`` : "";
  let body = `${emoji} **${comment.severity.toUpperCase()}**${categoryBadge}\n\n${comment.body}`;

  if (comment.suggestedFix && comment.severity !== "praise") {
    body += `\n\n<details>\n<summary>Suggested fix</summary>\n\n\`\`\`suggestion\n${comment.suggestedFix}\n\`\`\`\n\n${comment.fixExplanation ? `> ${comment.fixExplanation}` : ""}\n</details>`;
  }

  return body;
}

async function getHighRiskFiles(
  repoFullName: string,
  changedFiles: string[]
): Promise<{ path: string; criticalCount: number }[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentReviews } = await getSupabase()
    .from("reviews")
    .select("ai_comments")
    .eq("repo", repoFullName)
    .gte("created_at", thirtyDaysAgo.toISOString());

  if (!recentReviews || recentReviews.length === 0) return [];

  const fileCriticalCounts = new Map<string, number>();
  for (const review of recentReviews) {
    const comments = review.ai_comments as { path?: string; severity?: string }[] | null;
    if (!Array.isArray(comments)) continue;
    for (const c of comments) {
      if (c.severity === "critical" && c.path) {
        fileCriticalCounts.set(c.path, (fileCriticalCounts.get(c.path) ?? 0) + 1);
      }
    }
  }

  const highRisk: { path: string; criticalCount: number }[] = [];
  for (const file of changedFiles) {
    const count = fileCriticalCounts.get(file) ?? 0;
    if (count >= 3) {
      highRisk.push({ path: file, criticalCount: count });
    }
  }

  return highRisk.sort((a, b) => b.criticalCount - a.criticalCount);
}

function buildSummaryBody(
  score: number,
  summary: string,
  commentCount: number,
  topFix: string,
  praise: string,
  highRiskFiles?: { path: string; criticalCount: number }[],
  aiRiskComments?: ReviewComment[]
): string {
  const emoji = score >= 80 ? "\u2705" : score >= 50 ? "\u26A0\uFE0F" : "\u{1F6A8}";
  let body = `## ${emoji} Lintly Review — Score: ${score}/100\n\n`;

  if (highRiskFiles && highRiskFiles.length > 0) {
    body += `### \u26A0\uFE0F High risk files\nThese files have had multiple critical issues recently. Proceed with extra care.\n\n`;
    for (const f of highRiskFiles) {
      body += `- **\`${f.path}\`** — ${f.criticalCount} critical issues in the past 30 days\n`;
    }
    body += "\n";
  }

  if (aiRiskComments && aiRiskComments.length > 0) {
    body += `### \u{1F916} AI-Generated Code Risks\nLintly detected **${aiRiskComments.length}** pattern${aiRiskComments.length !== 1 ? "s" : ""} commonly introduced by AI code generation:\n\n`;
    for (const c of aiRiskComments) {
      body += `- **\`${c.path}\`** (line ${c.line}) — ${c.body.split("\n")[0]}\n`;
    }
    body += "\n";
  }

  body += `${summary}\n\n`;

  if (topFix) {
    body += `### \u{1F527} Most important fix\n${topFix}\n\n`;
  }

  if (praise) {
    body += `### \u{1F31F} What you did well\n${praise}\n\n`;
  }

  body += `_${commentCount} comment${commentCount !== 1 ? "s" : ""} posted_`;
  return body;
}

export const reviewPullRequest = inngest.createFunction(
  { id: "review-pull-request", triggers: [{ event: "pr/opened" }] },
  async ({ event, step }) => {
    const { owner, repo, pullNumber, headSha, installationId, userId, prAuthor } = event.data;

    const installationToken = await step.run("get-token", async () => {
      return getInstallationAccessToken(installationId);
    });

    const octokit = createOctokit(installationToken);

    const usage = await step.run("check-usage", async () => {
      return canRunReview(userId);
    });

    if (!usage.allowed) {
      await step.run("post-limit-message", async () => {
        await postReviewSummary(
          octokit,
          owner,
          repo,
          pullNumber,
          `## Lintly — Review limit reached\n\nYou've used **${usage.used}/${usage.limit}** reviews on your **${usage.plan}** plan this month.${usage.plan === "free" ? " Upgrade to **Pro** ($19.99/mo) for 200 reviews/month." : usage.plan === "pro" ? " Upgrade to **Team** ($49.99/mo) for 500 reviews/month and 4 seats." : ""}\n\n[View plans](${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/#pricing)`
        );
      });

      await step.run("log-skipped", async () => {
        await logReview({
          user_id: userId,
          repo: `${owner}/${repo}`,
          pr_number: pullNumber,
          status: "limit_reached",
          comments_posted: 0,
          pr_author: prAuthor,
        });
      });

      return { skipped: true, reason: "limit_reached" };
    }

    const diff = await step.run("fetch-diff", async () => {
      return getPullRequestDiff(octokit, owner, repo, pullNumber);
    });

    const settings = await step.run("fetch-settings", async () => {
      return getUserSettings(userId);
    });

    const prFiles = await step.run("fetch-pr-files", async () => {
      const files = await getPullRequestFiles(octokit, owner, repo, pullNumber);
      return files.map((f) => f.filename);
    });

    const highRiskFiles = await step.run("check-high-risk", async () => {
      return getHighRiskFiles(`${owner}/${repo}`, prFiles);
    });

    const review = await step.run("ai-review", async () => {
      return reviewDiff(diff, {
        customInstructions: settings.custom_instructions,
        severityThreshold: settings.severity_threshold,
        aiCodeMode: settings.ai_code_mode,
      });
    });

    await step.run("post-comments", async () => {
      for (const comment of review.comments) {
        try {
          await postReviewComment(
            octokit,
            owner,
            repo,
            pullNumber,
            formatCommentBody(comment),
            headSha,
            comment.path,
            comment.line
          );
        } catch {
          // line may not be part of the diff — skip gracefully
        }
      }

      const aiRiskComments = review.comments.filter((c) => c.category === "ai-risk");

      await postReviewSummary(
        octokit,
        owner,
        repo,
        pullNumber,
        buildSummaryBody(
          review.score,
          review.summary,
          review.comments.length,
          review.topFix ?? "",
          review.praise ?? "",
          highRiskFiles,
          aiRiskComments.length > 0 ? aiRiskComments : undefined
        )
      );
    });

    await step.run("post-status-check", async () => {
      try {
        await postCommitStatus(
          octokit,
          owner,
          repo,
          headSha,
          review.score,
          review.summary
        );
      } catch {
        // Non-critical — status check permission may not be granted
      }
    });

    await step.run("log-review", async () => {
      await logReview({
        user_id: userId,
        repo: `${owner}/${repo}`,
        pr_number: pullNumber,
        status: "completed",
        comments_posted: review.comments.length,
        score: review.score,
        summary: review.summary,
        ai_comments: review.comments,
        pr_author: prAuthor,
      });
    });

    await step.run("trigger-pattern-check", async () => {
      await inngest.send({ name: "review/completed", data: { userId } });
    });

    return { score: review.score, comments: review.comments.length };
  }
);
