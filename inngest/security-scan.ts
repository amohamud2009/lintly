import { inngest } from "@/inngest/review";
import { createOctokit, getInstallationAccessToken } from "@/lib/github";
import { canUseFeature, logSecurityScan, getSupabase } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface SecurityIssue {
  severity: "critical" | "high" | "medium";
  type: string;
  file: string;
  line: number;
  description: string;
  recommendation: string;
}

interface ScanResult {
  hasIssues: boolean;
  issues: SecurityIssue[];
}

export const scanPush = inngest.createFunction(
  { id: "scan-push", triggers: [{ event: "push/received" }] },
  async ({ event, step }) => {
    const { owner, repo, branch, headSha, beforeSha, installationId, userId, pusherEmail } = event.data;

    const installationToken = await step.run("get-token", async () => {
      return getInstallationAccessToken(installationId);
    });

    const usage = await step.run("check-security-limit", async () => {
      return canUseFeature(userId, "securityScans");
    });

    if (!usage.allowed) {
      return { skipped: true, reason: "security_scan_limit" };
    }

    const diff = await step.run("fetch-push-diff", async () => {
      const octokit = createOctokit(installationToken);
      try {
        const { data } = await octokit.repos.compareCommits({
          owner,
          repo,
          base: beforeSha,
          head: headSha,
          mediaType: { format: "diff" as never },
        });
        return data as unknown as string;
      } catch {
        return "";
      }
    });

    if (!diff || typeof diff !== "string" || diff.length < 10) {
      return { skipped: true, reason: "no_diff" };
    }

    const scanResult = await step.run("ai-security-scan", async () => {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: `You are a security scanner. Analyze this code diff for security vulnerabilities ONLY.

Look for: exposed API keys, hardcoded passwords, SQL injection, XSS, insecure authentication, sensitive data in logs, insecure crypto, path traversal.

Diff:
\`\`\`
${diff.slice(0, 15000)}
\`\`\`

Respond with JSON:
{
  "hasIssues": boolean,
  "issues": [
    {
      "severity": "critical" | "high" | "medium",
      "type": "exposed_secret" | "sql_injection" | "xss" | "hardcoded_password" | "insecure_auth" | "sensitive_log",
      "file": "file path",
      "line": line_number,
      "description": "what the issue is",
      "recommendation": "how to fix it"
    }
  ]
}

If no security issues, return { "hasIssues": false, "issues": [] }.`,
        }],
      });

      const content = message.content[0];
      if (content.type !== "text") return { hasIssues: false, issues: [] };
      const raw = content.text.trim();
      try { return JSON.parse(raw) as ScanResult; } catch { /* fallback */ }
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) try { return JSON.parse(match[0]) as ScanResult; } catch { /* fallback */ }
      return { hasIssues: false, issues: [] } as ScanResult;
    });

    await step.run("log-scan", async () => {
      await logSecurityScan({
        user_id: userId,
        repo: `${owner}/${repo}`,
        commit_sha: headSha,
        branch,
        issues_found: scanResult.issues.length,
        scan_results: scanResult.issues,
      });
    });

    const criticalIssues = scanResult.issues.filter((i) => i.severity === "critical");

    if (criticalIssues.length > 0) {
      await step.run("post-commit-comment", async () => {
        const octokit = createOctokit(installationToken);
        const body = `## 🚨 Lintly Security Alert\n\n**${criticalIssues.length} critical issue${criticalIssues.length !== 1 ? "s" : ""} detected**\n\n${criticalIssues.map((i) => `- **${i.type}** in \`${i.file}:${i.line}\`: ${i.description}\n  → ${i.recommendation}`).join("\n\n")}`;
        try {
          await octokit.repos.createCommitComment({ owner, repo, commit_sha: headSha, body });
        } catch {
          // commit may not exist yet in some edge cases
        }
      });

      if (pusherEmail) {
        await step.run("send-alert-email", async () => {
          const { data: user } = await getSupabase()
            .from("users")
            .select("email")
            .eq("github_id", userId)
            .single();
          const email = user?.email ?? pusherEmail;
          if (!email) return;
          await sendEmail({
            to: email,
            subject: `🚨 Critical security issue detected in ${owner}/${repo}`,
            html: `<div style="font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;padding:32px;border-radius:12px;max-width:600px;">
              <h2 style="color:#f87171;margin:0 0 16px;">Security Alert — ${owner}/${repo}</h2>
              <p style="color:#a3a3a3;">Lintly detected <strong style="color:#f87171;">${criticalIssues.length} critical</strong> issue${criticalIssues.length !== 1 ? "s" : ""} on branch <code style="background:#1a1a1a;padding:2px 6px;border-radius:4px;">${branch}</code></p>
              ${criticalIssues.map((i) => `<div style="background:#1a1a1a;padding:16px;border-radius:8px;margin:12px 0;border-left:3px solid #f87171;">
                <p style="margin:0 0 4px;color:#f87171;font-weight:600;">${i.type}</p>
                <p style="margin:0 0 4px;color:#a3a3a3;font-size:13px;"><code>${i.file}:${i.line}</code></p>
                <p style="margin:0 0 8px;color:#d4d4d4;">${i.description}</p>
                <p style="margin:0;color:#34d399;font-size:13px;">→ ${i.recommendation}</p>
              </div>`).join("")}
              <p style="color:#525252;font-size:12px;margin-top:24px;">— Lintly, your codebase's immune system</p>
            </div>`,
          });
        });
      }
    }

    return { issues: scanResult.issues.length, critical: criticalIssues.length };
  }
);
