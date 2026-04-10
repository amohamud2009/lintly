import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface ReviewComment {
  path: string;
  line: number;
  body: string;
  severity: "critical" | "warning" | "suggestion" | "praise";
}

interface ReviewResult {
  summary: string;
  comments: ReviewComment[];
  score: number;
}

export async function reviewDiff(
  diff: string,
  context?: string
): Promise<ReviewResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are Lintly, an expert code reviewer. Review the following PR diff and provide actionable feedback.

${context ? `Context: ${context}\n\n` : ""}Diff:
\`\`\`
${diff}
\`\`\`

Respond with JSON in this exact format:
{
  "summary": "A brief overall summary of the PR quality",
  "comments": [
    {
      "path": "file path",
      "line": line_number,
      "body": "Your review comment in markdown",
      "severity": "critical | warning | suggestion | praise"
    }
  ],
  "score": 0-100
}

Focus on: bugs, security issues, performance, readability, and best practices.
Only comment on meaningful issues — skip trivial style nits.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  let raw = content.text.trim();

  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    raw = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(raw) as ReviewResult;
  } catch {
    throw new Error(
      `Failed to parse Claude response as JSON: ${raw.slice(0, 200)}`
    );
  }
}
