import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getInstallationForRepo,
  getInstallationAccessToken,
  createOctokit,
} from "@/lib/github";
import { getSupabase } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { reviewId, commentIndex, repo, filePath, suggestedFix, prNumber } = body;

  if (!repo || !filePath || !suggestedFix || prNumber === undefined)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName)
    return NextResponse.json({ error: "Invalid repo format" }, { status: 400 });

  try {
    const installationId = await getInstallationForRepo(owner, repoName);
    if (!installationId)
      return NextResponse.json(
        { error: "Lintly is not installed on this repository. Install the GitHub App first." },
        { status: 403 }
      );

    const token = await getInstallationAccessToken(installationId);
    const octokit = createOctokit(token);

    const { data: pr } = await octokit.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
    });

    const branch = pr.head.ref;
    const headSha = pr.head.sha;

    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path: filePath,
      ref: branch,
    });

    if (Array.isArray(fileData) || fileData.type !== "file")
      return NextResponse.json({ error: "Path is not a file" }, { status: 400 });

    const currentContent = Buffer.from(fileData.content, "base64").toString("utf-8");
    const lines = currentContent.split("\n");

    const { data: commit } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: filePath,
      message: `fix: apply Lintly suggestion for ${filePath}\n\nAuto-applied fix from Lintly code review.`,
      content: Buffer.from(suggestedFix).toString("base64"),
      sha: fileData.sha,
      branch,
    });

    if (reviewId) {
      const { data: review } = await getSupabase()
        .from("reviews")
        .select("ai_comments")
        .eq("id", reviewId)
        .single();

      if (review?.ai_comments && Array.isArray(review.ai_comments)) {
        const comments = [...review.ai_comments] as Record<string, unknown>[];
        if (comments[commentIndex]) {
          comments[commentIndex].fixApplied = true;
          comments[commentIndex].fixCommitSha = commit.commit?.sha;
          await getSupabase()
            .from("reviews")
            .update({ ai_comments: comments })
            .eq("id", reviewId);
        }
      }
    }

    return NextResponse.json({
      success: true,
      commitSha: commit.commit?.sha,
      commitUrl: commit.commit?.html_url,
      message: `Fix applied to ${filePath} on branch ${branch}`,
    });
  } catch (err) {
    console.error("Fix apply error:", err);
    const message = err instanceof Error ? err.message : "Failed to apply fix";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
