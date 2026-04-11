import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/github";
import { inngest } from "@/inngest/review";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const event = req.headers.get("x-github-event") ?? "";

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("GITHUB_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (!verifyWebhookSignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (event === "pull_request" && (payload.action === "opened" || payload.action === "synchronize")) {
      const pr = payload.pull_request as Record<string, unknown>;
      const repo = payload.repository as Record<string, unknown>;
      const installation = payload.installation as Record<string, unknown> | undefined;
      const installationId = installation?.id as number | undefined;

      if (!installationId) {
        return NextResponse.json({ error: "No installation ID" }, { status: 400 });
      }

      const sender = payload.sender as Record<string, unknown>;
      const prUser = pr.user as Record<string, unknown> | undefined;
      const repoOwner = (repo.owner as Record<string, unknown>)?.login as string;
      const head = pr.head as Record<string, unknown>;

      await inngest.send({
        name: "pr/opened",
        data: {
          owner: repoOwner,
          repo: repo.name as string,
          pullNumber: pr.number as number,
          headSha: head.sha as string,
          installationId,
          userId: String(sender.id),
          prAuthor: (prUser?.login as string) ?? (sender.login as string),
        },
      });

      return NextResponse.json({ status: "review queued" });
    }

    if (event === "push") {
      const repoData = payload.repository as Record<string, unknown>;
      const installation = payload.installation as Record<string, unknown> | undefined;
      const installationId = installation?.id as number | undefined;

      if (!installationId) {
        return NextResponse.json({ error: "No installation ID" }, { status: 400 });
      }

      const sender = payload.sender as Record<string, unknown>;
      const pusher = payload.pusher as Record<string, unknown> | undefined;
      const owner = repoData.owner as Record<string, unknown>;
      const headCommit = payload.head_commit as Record<string, unknown> | undefined;

      await inngest.send({
        name: "push/received",
        data: {
          owner: (owner.login ?? owner.name) as string,
          repo: repoData.name as string,
          branch: (payload.ref as string).replace("refs/heads/", ""),
          headSha: (headCommit?.id ?? payload.after) as string,
          beforeSha: payload.before as string,
          installationId,
          userId: String(sender.id),
          pusherEmail: pusher?.email as string | undefined,
        },
      });

      return NextResponse.json({ status: "scan queued" });
    }

    return NextResponse.json({ status: "ignored" });
  } catch (error) {
    console.error("GitHub webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal processing error" },
      { status: 500 }
    );
  }
}
