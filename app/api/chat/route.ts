import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getSupabase,
  canUseFeature,
  incrementChatMessages,
  logSecurityScan,
} from "@/lib/db";
import {
  createOctokit,
  getInstallationForRepo,
  getInstallationAccessToken,
} from "@/lib/github";
import { rateLimit } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const claudeTools: Anthropic.Tool[] = [
  {
    name: "run_security_scan",
    description:
      "Run an on-demand security scan on a repository. Analyzes the latest commit diff for vulnerabilities like hardcoded secrets, SQL injection, XSS, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Full repo name like 'owner/repo'",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "get_security_scans",
    description:
      "Fetch the user's recent security scan results with full details — issues found, severity, file paths, and recommendations.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Filter by repo like 'owner/repo' (optional)",
        },
        limit: {
          type: "number",
          description: "Number of scans to return (default 10)",
        },
      },
    },
  },
  {
    name: "get_reviews",
    description:
      "Fetch PR code review results with scores, summaries, AI comments, and severity breakdown.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Filter by repo (optional)",
        },
        limit: {
          type: "number",
          description: "Number of reviews to return (default 10)",
        },
      },
    },
  },
  {
    name: "get_review_detail",
    description:
      "Fetch the full detail of a single code review including every AI comment with severity, file path, and line number.",
    input_schema: {
      type: "object" as const,
      properties: {
        review_id: {
          type: "string",
          description: "UUID of the review to fetch",
        },
      },
      required: ["review_id"],
    },
  },
  {
    name: "get_patterns",
    description:
      "Fetch recurring code patterns Lintly has detected — anti-patterns, common bugs, style issues, etc.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_repos",
    description:
      "List the user's repositories with review count and security scan count per repo.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_usage",
    description:
      "Check the user's current plan, usage limits for reviews, security scans, and chat messages, and how much has been used this month.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "trigger_pr_review",
    description:
      "Queue an on-demand AI code review for a specific PR number on a repo. Returns immediately — the review runs asynchronously.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Full repo name like 'owner/repo'" },
        pr_number: { type: "number", description: "Pull request number" },
      },
      required: ["repo", "pr_number"],
    },
  },
  {
    name: "get_pr_diff",
    description:
      "Fetch and return the diff of a pull request from GitHub. Useful when the user asks about code changes in a PR.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Full repo name like 'owner/repo'" },
        pr_number: { type: "number", description: "Pull request number" },
      },
      required: ["repo", "pr_number"],
    },
  },
  {
    name: "create_github_issue",
    description:
      "Create a new GitHub issue on a repository. Use when the user wants to file an issue based on review findings or security vulnerabilities.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Full repo name like 'owner/repo'" },
        title: { type: "string", description: "Issue title" },
        body: { type: "string", description: "Issue body in markdown" },
        labels: { type: "array", items: { type: "string" }, description: "Labels to add (optional)" },
      },
      required: ["repo", "title", "body"],
    },
  },
  {
    name: "get_file_contents",
    description:
      "Read a specific file from a GitHub repository. Use when the user asks about a particular file's contents.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Full repo name like 'owner/repo'" },
        path: { type: "string", description: "File path within the repo, e.g. 'src/index.ts'" },
        ref: { type: "string", description: "Branch or commit ref (default: main)" },
      },
      required: ["repo", "path"],
    },
  },
  {
    name: "generate_report",
    description:
      "Generate a comprehensive markdown report of the user's code quality and security posture across all repos.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of days to include in the report (default 30)" },
      },
    },
  },
];

function getToolLabel(name: string): string {
  const labels: Record<string, string> = {
    run_security_scan: "Running security scan",
    get_security_scans: "Fetching security scans",
    get_reviews: "Fetching code reviews",
    get_review_detail: "Loading review details",
    get_patterns: "Checking code patterns",
    get_repos: "Loading repositories",
    get_usage: "Checking plan usage",
    trigger_pr_review: "Queuing PR review",
    get_pr_diff: "Fetching PR diff",
    create_github_issue: "Creating GitHub issue",
    get_file_contents: "Reading file",
    generate_report: "Generating report",
  };
  return labels[name] ?? "Working";
}

function getToolDoneLabel(name: string, result: unknown): string {
  const r = result as Record<string, unknown>;
  if (r?.error) return `Error: ${String(r.error).slice(0, 80)}`;
  switch (name) {
    case "run_security_scan":
      return `Scan complete — ${r?.total ?? 0} issue${(r?.total as number) !== 1 ? "s" : ""} found`;
    case "get_security_scans":
      return `${Array.isArray(result) ? result.length : 0} scans loaded`;
    case "get_reviews":
      return `${Array.isArray(result) ? result.length : 0} reviews loaded`;
    case "get_review_detail":
      return r ? "Review loaded" : "Review not found";
    case "get_patterns":
      return `${Array.isArray(result) ? result.length : 0} patterns found`;
    case "get_repos":
      return `${Array.isArray(result) ? result.length : 0} repos found`;
    case "get_usage":
      return "Plan info loaded";
    case "trigger_pr_review":
      return "Review queued";
    case "get_pr_diff":
      return typeof result === "string" ? `${result.length} chars loaded` : "Diff loaded";
    case "create_github_issue":
      return r?.url ? `Issue created` : "Issue created";
    case "get_file_contents":
      return typeof result === "string" ? `${result.split("\n").length} lines loaded` : "File loaded";
    case "generate_report":
      return "Report generated";
    default:
      return "Done";
  }
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const sb = getSupabase();

  switch (name) {
    case "get_security_scans": {
      let query = sb
        .from("security_scans")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit((input.limit as number) ?? 10);
      if (input.repo) query = query.eq("repo", input.repo as string);
      const { data } = await query;
      return data ?? [];
    }

    case "get_reviews": {
      let query = sb
        .from("reviews")
        .select(
          "id, repo, pr_number, score, summary, ai_comments, pr_author, status, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit((input.limit as number) ?? 10);
      if (input.repo) query = query.eq("repo", input.repo as string);
      const { data } = await query;
      return data ?? [];
    }

    case "get_review_detail": {
      const { data } = await sb
        .from("reviews")
        .select("*")
        .eq("id", input.review_id as string)
        .eq("user_id", userId)
        .single();
      return data;
    }

    case "get_patterns": {
      const { data } = await sb
        .from("patterns")
        .select("*")
        .eq("user_id", userId)
        .eq("dismissed", false);
      return data ?? [];
    }

    case "get_repos": {
      const [{ data: reviewCounts }, { data: scanCounts }] = await Promise.all([
        sb.rpc("repo_review_counts", { uid: userId }),
        sb.rpc("repo_scan_counts", { uid: userId }),
      ]).catch(() => [{ data: null }, { data: null }]);

      if (reviewCounts) {
        const scanMap = new Map(
          ((scanCounts ?? []) as { repo: string; cnt: number }[]).map(
            (s) => [s.repo, s.cnt]
          )
        );
        return ((reviewCounts ?? []) as { repo: string; cnt: number }[]).map(
          (r) => ({
            repo: r.repo,
            reviews: r.cnt,
            securityScans: scanMap.get(r.repo) ?? 0,
          })
        );
      }

      const { data } = await sb
        .from("reviews")
        .select("repo")
        .eq("user_id", userId);
      const repoSet = new Set((data ?? []).map((r: { repo: string }) => r.repo));
      const repos = Array.from(repoSet);
      const stats = await Promise.all(
        repos.map(async (repo) => {
          const [{ count: reviews }, { count: scans }] = await Promise.all([
            sb.from("reviews").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("repo", repo),
            sb.from("security_scans").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("repo", repo),
          ]);
          return { repo, reviews: reviews ?? 0, securityScans: scans ?? 0 };
        })
      );
      return stats;
    }

    case "get_usage": {
      const [reviewUsage, scanUsage, chatUsage] = await Promise.all([
        canUseFeature(userId, "reviews"),
        canUseFeature(userId, "securityScans"),
        canUseFeature(userId, "chatMessages"),
      ]);
      return {
        plan: reviewUsage.plan,
        reviews: { used: reviewUsage.used, limit: reviewUsage.limit },
        securityScans: { used: scanUsage.used, limit: scanUsage.limit },
        chatMessages: { used: chatUsage.used, limit: chatUsage.limit },
      };
    }

    case "run_security_scan": {
      const repoStr = input.repo as string;
      const parts = repoStr.split("/");
      if (parts.length !== 2)
        return { error: "Invalid repo format. Use 'owner/repo'." };
      const [owner, repo] = parts;

      const usage = await canUseFeature(userId, "securityScans");
      if (!usage.allowed) {
        return {
          error: `Security scan limit reached (${usage.used}/${usage.limit} this month). Upgrade for more.`,
        };
      }

      const installationId = await getInstallationForRepo(owner, repo);
      if (!installationId) {
        return {
          error: `Lintly GitHub App is not installed on ${owner}/${repo}. Install it first at https://github.com/apps/your-lintly-app.`,
        };
      }

      const token = await getInstallationAccessToken(installationId);
      const octokit = createOctokit(token);

      const { data: commits } = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: 2,
      });
      if (commits.length < 2) {
        return { error: "Not enough commits to generate a diff." };
      }

      let diff = "";
      try {
        const { data } = await octokit.repos.compareCommits({
          owner,
          repo,
          base: commits[1].sha,
          head: commits[0].sha,
          mediaType: { format: "diff" as never },
        });
        diff = data as unknown as string;
      } catch {
        return { error: "Failed to fetch commit diff." };
      }

      if (!diff || typeof diff !== "string" || diff.length < 10) {
        return {
          scanned: true,
          issues: [],
          total: 0,
          message: "No meaningful code changes to scan in the latest commit.",
        };
      }

      const scanResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `You are a security scanner. Analyze this code diff for security vulnerabilities ONLY.

Look for: exposed API keys, hardcoded passwords, SQL injection, XSS, insecure authentication, sensitive data in logs, insecure crypto, path traversal.

Diff:
\`\`\`
${diff.slice(0, 15000)}
\`\`\`

Respond with JSON only:
{
  "hasIssues": boolean,
  "issues": [
    {
      "severity": "critical" | "high" | "medium",
      "type": "string",
      "file": "file path",
      "line": number,
      "description": "what the issue is",
      "recommendation": "how to fix it"
    }
  ]
}

If no security issues, return { "hasIssues": false, "issues": [] }.`,
          },
        ],
      });

      let scanResult: { hasIssues: boolean; issues: unknown[] } = {
        hasIssues: false,
        issues: [],
      };
      const content = scanResponse.content[0];
      if (content.type === "text") {
        try {
          scanResult = JSON.parse(content.text.trim());
        } catch {
          const match = content.text.match(/\{[\s\S]*\}/);
          if (match)
            try {
              scanResult = JSON.parse(match[0]);
            } catch {
              /* keep default */
            }
        }
      }

      await logSecurityScan({
        user_id: userId,
        repo: `${owner}/${repo}`,
        commit_sha: commits[0].sha,
        branch: "latest",
        issues_found: scanResult.issues.length,
        scan_results: scanResult.issues,
      });

      return {
        scanned: true,
        repo: `${owner}/${repo}`,
        commit: commits[0].sha.slice(0, 7),
        issues: scanResult.issues,
        total: scanResult.issues.length,
      };
    }

    case "trigger_pr_review": {
      const repoStr = input.repo as string;
      const prNumber = input.pr_number as number;
      const parts = repoStr.split("/");
      if (parts.length !== 2) return { error: "Invalid repo format. Use 'owner/repo'." };
      const [owner, repo] = parts;

      const usage = await canUseFeature(userId, "reviews");
      if (!usage.allowed) return { error: `Review limit reached (${usage.used}/${usage.limit}).` };

      const installationId = await getInstallationForRepo(owner, repo);
      if (!installationId) return { error: `Lintly is not installed on ${repoStr}.` };

      const { inngest: inngestClient } = await import("@/inngest/review");
      const token = await getInstallationAccessToken(installationId);
      const octokit = createOctokit(token);

      let headSha: string;
      try {
        const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
        headSha = pr.head.sha;
      } catch {
        return { error: `PR #${prNumber} not found on ${repoStr}.` };
      }

      await inngestClient.send({
        name: "pr/opened",
        data: { owner, repo, pullNumber: prNumber, headSha, installationId, userId, prAuthor: "on-demand" },
      });

      return { queued: true, repo: repoStr, pr_number: prNumber };
    }

    case "get_pr_diff": {
      const repoStr = input.repo as string;
      const prNumber = input.pr_number as number;
      const parts = repoStr.split("/");
      if (parts.length !== 2) return { error: "Invalid repo format." };
      const [owner, repo] = parts;

      const installationId = await getInstallationForRepo(owner, repo);
      if (!installationId) return { error: `Lintly is not installed on ${repoStr}.` };

      const token = await getInstallationAccessToken(installationId);
      const octokit = createOctokit(token);

      try {
        const { data } = await octokit.pulls.get({
          owner, repo, pull_number: prNumber,
          mediaType: { format: "diff" },
        });
        const diff = data as unknown as string;
        return typeof diff === "string" ? diff.slice(0, 20000) : "Could not retrieve diff.";
      } catch {
        return { error: `Could not fetch PR #${prNumber} diff.` };
      }
    }

    case "create_github_issue": {
      const repoStr = input.repo as string;
      const parts = repoStr.split("/");
      if (parts.length !== 2) return { error: "Invalid repo format." };
      const [owner, repo] = parts;

      const installationId = await getInstallationForRepo(owner, repo);
      if (!installationId) return { error: `Lintly is not installed on ${repoStr}.` };

      const token = await getInstallationAccessToken(installationId);
      const octokit = createOctokit(token);

      try {
        const issueData: Record<string, unknown> = {
          owner, repo,
          title: input.title as string,
          body: input.body as string,
        };
        if (Array.isArray(input.labels) && input.labels.length > 0) {
          issueData.labels = input.labels;
        }
        const { data } = await octokit.issues.create(issueData as Parameters<typeof octokit.issues.create>[0]);
        return { created: true, number: data.number, url: data.html_url };
      } catch (e) {
        return { error: `Failed to create issue: ${e instanceof Error ? e.message : "unknown error"}` };
      }
    }

    case "get_file_contents": {
      const repoStr = input.repo as string;
      const filePath = input.path as string;
      const ref = (input.ref as string) || undefined;
      const parts = repoStr.split("/");
      if (parts.length !== 2) return { error: "Invalid repo format." };
      const [owner, repo] = parts;

      const installationId = await getInstallationForRepo(owner, repo);
      if (!installationId) return { error: `Lintly is not installed on ${repoStr}.` };

      const token = await getInstallationAccessToken(installationId);
      const octokit = createOctokit(token);

      try {
        const params: Record<string, unknown> = { owner, repo, path: filePath };
        if (ref) params.ref = ref;
        const { data } = await octokit.repos.getContent(params as Parameters<typeof octokit.repos.getContent>[0]);
        const file = data as { content?: string; encoding?: string; size?: number; type?: string };
        if (file.type !== "file" || !file.content) return { error: "Not a file or empty." };
        if ((file.size ?? 0) > 500000) return { error: "File too large to display." };
        return Buffer.from(file.content, (file.encoding as BufferEncoding) ?? "base64").toString("utf-8");
      } catch {
        return { error: `File not found: ${filePath}` };
      }
    }

    case "generate_report": {
      const days = (input.days as number) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const [{ data: reviews }, { data: scans }, { data: patterns }] = await Promise.all([
        sb.from("reviews").select("repo, score, summary, pr_author, created_at").eq("user_id", userId).gte("created_at", since.toISOString()).order("created_at", { ascending: false }),
        sb.from("security_scans").select("repo, issues_found, scan_results, created_at").eq("user_id", userId).gte("created_at", since.toISOString()).order("created_at", { ascending: false }),
        sb.from("patterns").select("pattern_name, description, occurrence_count").eq("user_id", userId).eq("dismissed", false),
      ]);

      const allReviews = reviews ?? [];
      const allScans = scans ?? [];
      const allPatterns = patterns ?? [];

      const scored = allReviews.filter((r) => r.score !== null);
      const avgScore = scored.length > 0
        ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length)
        : null;

      const totalVulns = allScans.reduce((s, sc) => s + (sc.issues_found ?? 0), 0);
      const repoSet = new Set([...allReviews.map((r) => r.repo), ...allScans.map((s) => s.repo)]);

      return {
        period: `Last ${days} days`,
        repos: Array.from(repoSet),
        totalReviews: allReviews.length,
        averageScore: avgScore,
        totalSecurityScans: allScans.length,
        totalVulnerabilities: totalVulns,
        recurringPatterns: allPatterns.slice(0, 5),
        topReviewedRepos: Object.entries(
          allReviews.reduce((acc, r) => { acc[r.repo] = (acc[r.repo] ?? 0) + 1; return acc; }, {} as Record<string, number>)
        ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([repo, count]) => ({ repo, count })),
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const rl = rateLimit(`chat:${userId}`, 30, 60_000);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment." }),
      { status: 429 }
    );
  }

  const usage = await canUseFeature(userId, "chatMessages");
  if (!usage.allowed) {
    const msg =
      usage.limit === 0
        ? "AI chat is available on Pro and Team plans. Upgrade to start chatting with your codebase."
        : `You've used all ${usage.limit} chat messages this month. Upgrade your plan for more.`;
    return new Response(JSON.stringify({ error: msg, upgrade: true }), {
      status: 429,
    });
  }

  const body = await req.json();
  const chatMessages: { role: string; content: string }[] = body.messages ?? [
    { role: "user", content: body.message },
  ];

  if (!chatMessages.length) {
    return new Response(JSON.stringify({ error: "Message required" }), {
      status: 400,
    });
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [reviewsRes, scansRes, patternsRes] = await Promise.all([
    getSupabase()
      .from("reviews")
      .select("repo, pr_number, score, summary, pr_author, created_at")
      .eq("user_id", userId)
      .gte("created_at", ninetyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(30),
    getSupabase()
      .from("security_scans")
      .select("repo, branch, issues_found, created_at")
      .eq("user_id", userId)
      .gte("created_at", ninetyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(10),
    getSupabase()
      .from("patterns")
      .select("pattern_name, description, occurrence_count")
      .eq("user_id", userId)
      .eq("dismissed", false),
  ]);

  const contextParts: string[] = [];
  const reviews = reviewsRes.data ?? [];
  const scans = scansRes.data ?? [];
  const patterns = patternsRes.data ?? [];

  if (reviews.length > 0)
    contextParts.push(
      `Recent reviews (${reviews.length}): ${reviews
        .slice(0, 10)
        .map(
          (r) =>
            `${r.repo}#${r.pr_number} score:${r.score ?? "?"} by:${r.pr_author ?? "?"}`
        )
        .join("; ")}`
    );
  if (scans.length > 0)
    contextParts.push(
      `Recent scans (${scans.length}): ${scans
        .slice(0, 5)
        .map((s) => `${s.repo}/${s.branch} issues:${s.issues_found}`)
        .join("; ")}`
    );
  if (patterns.length > 0)
    contextParts.push(
      `Patterns: ${patterns.map((p) => `${p.pattern_name} (${p.occurrence_count}×)`).join(", ")}`
    );

  const systemPrompt = `You are Lintly, an AI codebase assistant with real-time access to this developer's code intelligence data.

You have tools to:
• Run on-demand security scans on any repo
• Trigger on-demand PR code reviews
• Fetch PR diffs from GitHub
• Read specific files from their repos
• Create GitHub issues from findings
• Generate comprehensive quality/security reports
• Fetch detailed security scan history
• Pull code review history with scores and AI comments
• Check recurring code patterns and anti-patterns
• Look up plan usage and limits
• List their repos

BEHAVIOR:
- When the user asks you to DO something (run a scan, review a PR, read a file, create an issue), USE your tools immediately. Don't guess — fetch real data.
- When you use a tool, briefly tell the user what you're about to do.
- Present results clearly with formatting — use tables, bullet lists, and bold for severity.
- Be specific: reference actual repo names, file paths, line numbers, and scores.
- If the user asks about something you can look up, look it up even if you have summary context.
- Be conversational but concise. You're a technical assistant, not a chatbot.
- When reporting security issues, suggest creating a GitHub issue for critical/high findings.
- After generating a report, highlight the most actionable insights first.

CONTEXT SUMMARY (use tools for full details):
${contextParts.length > 0 ? contextParts.join("\n") : "No data yet — help them get started with Lintly."}`;

  const claudeMessages: Anthropic.MessageParam[] = chatMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        let allMessages = [...claudeMessages];
        let iterations = 0;
        const MAX_ITERATIONS = 6;

        while (iterations++ < MAX_ITERATIONS) {
          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: systemPrompt,
            tools: claudeTools,
            messages: allMessages,
          });

          const toolBlocks: {
            id: string;
            name: string;
            input: Record<string, unknown>;
          }[] = [];
          let currentToolId = "";
          let currentToolName = "";
          let currentToolInput = "";

          for await (const event of stream) {
            if (
              event.type === "content_block_start" &&
              "content_block" in event
            ) {
              const block = event.content_block as unknown as Record<string, unknown>;
              if (block.type === "tool_use") {
                currentToolId = block.id as string;
                currentToolName = block.name as string;
                currentToolInput = "";
              }
            } else if (event.type === "content_block_delta" && "delta" in event) {
              const delta = event.delta as unknown as Record<string, unknown>;
              if (delta.type === "text_delta" && typeof delta.text === "string") {
                controller.enqueue(encoder.encode(delta.text));
              } else if (
                delta.type === "input_json_delta" &&
                typeof delta.partial_json === "string"
              ) {
                currentToolInput += delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              if (currentToolId) {
                let parsed: Record<string, unknown> = {};
                try {
                  parsed = JSON.parse(currentToolInput || "{}");
                } catch {
                  /* empty */
                }
                toolBlocks.push({
                  id: currentToolId,
                  name: currentToolName,
                  input: parsed,
                });
                currentToolId = "";
                currentToolInput = "";
              }
            }
          }

          const finalMessage = await stream.finalMessage();

          if (
            finalMessage.stop_reason !== "tool_use" ||
            toolBlocks.length === 0
          ) {
            break;
          }

          allMessages.push({
            role: "assistant",
            content: finalMessage.content,
          });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const tool of toolBlocks) {
            controller.enqueue(
              encoder.encode(
                `\n<<ACTION>>${JSON.stringify({
                  tool: tool.name,
                  status: "running",
                  label: getToolLabel(tool.name),
                })}\n`
              )
            );

            const result = await executeTool(tool.name, tool.input, userId);

            controller.enqueue(
              encoder.encode(
                `<<ACTION>>${JSON.stringify({
                  tool: tool.name,
                  status: "done",
                  label: getToolDoneLabel(tool.name, result),
                })}\n`
              )
            );

            toolResults.push({
              type: "tool_result",
              tool_use_id: tool.id,
              content: JSON.stringify(result),
            });
          }

          allMessages.push({ role: "user", content: toolResults });
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Something went wrong";
        controller.enqueue(encoder.encode(`\n\n_Error: ${msg}_`));
      } finally {
        await incrementChatMessages(userId).catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
