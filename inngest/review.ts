import { Inngest } from "inngest";
import { createOctokit, getPullRequestDiff, postReviewComment, postReviewSummary } from "@/lib/github";
import { reviewDiff } from "@/lib/claude";
import { logReview } from "@/lib/db";

export const inngest = new Inngest({ id: "lintly" });

export const reviewPullRequest = inngest.createFunction(
  { id: "review-pull-request", triggers: [{ event: "pr/opened" }] },
  async ({ event, step }) => {
    const { owner, repo, pullNumber, headSha, installationToken, userId } = event.data;

    const octokit = createOctokit(installationToken);

    const diff = await step.run("fetch-diff", async () => {
      return getPullRequestDiff(octokit, owner, repo, pullNumber);
    });

    const review = await step.run("ai-review", async () => {
      return reviewDiff(diff);
    });

    await step.run("post-comments", async () => {
      for (const comment of review.comments) {
        try {
          await postReviewComment(
            octokit,
            owner,
            repo,
            pullNumber,
            `**${comment.severity.toUpperCase()}**: ${comment.body}`,
            headSha,
            comment.path,
            comment.line
          );
        } catch {
          // line may not be part of the diff — skip gracefully
        }
      }

      const emoji =
        review.score >= 80 ? "✅" : review.score >= 50 ? "⚠️" : "🚨";

      await postReviewSummary(
        octokit,
        owner,
        repo,
        pullNumber,
        `## ${emoji} Lintly Review — Score: ${review.score}/100\n\n${review.summary}\n\n_${review.comments.length} comments posted_`
      );
    });

    await step.run("log-review", async () => {
      await logReview({
        user_id: userId,
        repo: `${owner}/${repo}`,
        pr_number: pullNumber,
        status: "completed",
        comments_posted: review.comments.length,
      });
    });

    return { score: review.score, comments: review.comments.length };
  }
);
