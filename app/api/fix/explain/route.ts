import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { issueBody, suggestedFix, fixExplanation, category, severity, filePath } = body;

  if (!issueBody)
    return NextResponse.json({ error: "Missing issue body" }, { status: 400 });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `You are Lintly, helping a developer understand a code issue. Write a clear, step-by-step walkthrough that explains:

1. **What's wrong** — what the issue is and why it matters, in plain language
2. **Why it happens** — the root cause (if this is an AI-risk pattern, explain why AI tools generate this mistake)
3. **How to fix it** — concrete steps, not just code. Walk them through the thinking.
4. **How to prevent it** — what to check for in future code to avoid this class of issue

Context:
- File: ${filePath || "unknown"}
- Severity: ${severity || "unknown"}
- Category: ${category || "unknown"}
- Issue: ${issueBody}
${suggestedFix ? `- Suggested fix code: ${suggestedFix}` : ""}
${fixExplanation ? `- Fix explanation: ${fixExplanation}` : ""}

Keep it concise (under 300 words). Use markdown formatting. Be direct — no filler. Write like you're explaining to a smart developer who just needs context, not a tutorial.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text")
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });

  return NextResponse.json({ walkthrough: content.text });
}
