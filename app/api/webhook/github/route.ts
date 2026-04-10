import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, getInstallationAccessToken } from "@/lib/github";
import { inngest } from "@/inngest/review";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-hub-signature-256") ?? "";
    const event = req.headers.get("x-github-event") ?? "";

    const secret = process.env.GITHUB_WEBHOOK_SECRET!;

    if (!verifyWebhookSignature(body, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body);

    if (event === "pull_request" && payload.action === "opened") {
      const pr = payload.pull_request;
      const repo = payload.repository;
      const installationId = payload.installation?.id;

      if (!installationId) {
        console.error("No installation ID in webhook payload");
        return NextResponse.json({ status: "ok" });
      }

      const installationToken =
        await getInstallationAccessToken(installationId);

      await inngest.send({
        name: "pr/opened",
        data: {
          owner: repo.owner.login,
          repo: repo.name,
          pullNumber: pr.number,
          headSha: pr.head.sha,
          installationToken,
          userId: String(payload.sender.id),
        },
      });

      return NextResponse.json({ status: "review queued" });
    }

    return NextResponse.json({ status: "ignored" });
  } catch (error) {
    console.error("GitHub webhook error:", error);
    return NextResponse.json({ status: "ok" });
  }
}
