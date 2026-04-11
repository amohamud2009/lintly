import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import crypto from "crypto";

export function createOctokit(token: string) {
  return new Octokit({ auth: token });
}

export async function getInstallationForRepo(
  owner: string,
  repo: string
): Promise<number | null> {
  try {
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey: Buffer.from(
          process.env.GITHUB_PRIVATE_KEY!,
          "base64"
        ).toString("utf-8"),
      },
    });
    const { data } = await appOctokit.apps.getRepoInstallation({ owner, repo });
    return data.id;
  } catch {
    return null;
  }
}

export async function getInstallationAccessToken(
  installationId: number
): Promise<string> {
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_APP_ID!,
      privateKey: Buffer.from(
        process.env.GITHUB_PRIVATE_KEY!,
        "base64"
      ).toString("utf-8"),
      installationId,
    },
  });

  const { data } = await octokit.apps.createInstallationAccessToken({
    installation_id: installationId,
  });

  return data.token;
}

export async function getPullRequestDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
) {
  const { data } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    mediaType: { format: "diff" },
  });

  return data as unknown as string;
}

export async function getPullRequestFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
) {
  const { data } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return data;
}

export async function postReviewComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
  commitId: string,
  path: string,
  line: number
) {
  await octokit.pulls.createReviewComment({
    owner,
    repo,
    pull_number: pullNumber,
    body,
    commit_id: commitId,
    path,
    line,
  });
}

export async function postReviewSummary(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string
) {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body,
  });
}

export async function postCommitStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
  score: number,
  summary: string
) {
  const state: "success" | "pending" | "failure" =
    score >= 80 ? "success" : score >= 60 ? "pending" : "failure";

  const truncated = summary.length > 140 ? summary.slice(0, 137) + "..." : summary;
  const description = `Score: ${score}/100 — ${truncated}`;

  await octokit.repos.createCommitStatus({
    owner,
    repo,
    sha,
    state,
    description: description.slice(0, 140),
    context: "Lintly / Code Review",
  });
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = Buffer.from(
    `sha256=${hmac.update(payload).digest("hex")}`
  );
  const sig = Buffer.from(signature);

  if (digest.length !== sig.length) {
    return false;
  }

  return crypto.timingSafeEqual(digest, sig);
}
