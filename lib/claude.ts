import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface ReviewComment {
  path: string;
  line: number;
  body: string;
  severity: "critical" | "warning" | "suggestion" | "praise";
  suggestedFix?: string;
  fixExplanation?: string;
  category?: string;
}

export interface ReviewResult {
  summary: string;
  topFix: string;
  praise: string;
  comments: ReviewComment[];
  score: number;
}

const AI_CODE_MODE_PROMPT = `You are reviewing code that may have been generated or heavily assisted by AI tools (Copilot, Cursor, Claude, ChatGPT, etc). AI-generated code often looks clean but contains specific classes of errors. Apply extra scrutiny to these patterns:

1. HALLUCINATED APIs — Methods, functions, or parameters that don't exist in the library being used. AI models frequently invent plausible-looking API calls.
2. OVERCONFIDENT ERROR HANDLING — try/catch blocks that swallow errors silently, or .catch(() => {}) patterns that hide failures.
3. MISSING EDGE CASES — Null/undefined checks, empty array handling, off-by-one errors, race conditions in async code.
4. SECURITY SHORTCUTS — Hardcoded credentials, disabled CORS, eval() usage, unsanitized user input, SQL injection via string interpolation.
5. WRONG ASSUMPTIONS — Business logic that seems plausible but makes incorrect assumptions about how the system actually works.
6. STALE PATTERNS — Deprecated API usage, outdated library patterns, or approaches that were correct in older versions but are wrong now.

When you find these patterns, tag the comment with category "ai-risk" and explicitly state: "This pattern is commonly introduced by AI code generation" in your explanation.
Flag confidence: if something looks AI-generated, say so in the comment.`;

export async function reviewDiff(
  diff: string,
  options?: { customInstructions?: string; severityThreshold?: string; aiCodeMode?: boolean }
): Promise<ReviewResult> {
  const extraInstructions: string[] = [];

  if (options?.aiCodeMode) {
    extraInstructions.push(AI_CODE_MODE_PROMPT);
  }

  if (options?.severityThreshold === "warning") {
    extraInstructions.push("Only report issues with severity 'warning' or 'critical'. Skip suggestions and praise.");
  } else if (options?.severityThreshold === "critical") {
    extraInstructions.push("Only report issues with severity 'critical'. Skip suggestions, praise, and warnings.");
  }

  if (options?.customInstructions) {
    extraInstructions.push(`Additional instructions from the user:\n${options.customInstructions}`);
  }

  const categoryList = options?.aiCodeMode
    ? "One of: security, performance, bug, readability, best-practice, style, ai-risk"
    : "One of: security, performance, bug, readability, best-practice, style";

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are Lintly, an expert code reviewer. Review the following PR diff and provide actionable feedback.

Diff:
\`\`\`
${diff}
\`\`\`

${extraInstructions.length > 0 ? extraInstructions.join("\n\n") + "\n\n" : ""}Respond with JSON in this exact format:
{
  "summary": "A brief overall summary of the PR quality",
  "topFix": "The single most important fix the developer should make in this PR. Be specific — reference the file and what needs to change.",
  "praise": "Something specific the developer did well in this PR. Always find something positive even for low scoring code — mention a good pattern, clean naming, or correct approach.",
  "comments": [
    {
      "path": "file path",
      "line": line_number,
      "body": "Your review comment explaining the issue clearly",
      "severity": "critical | warning | suggestion | praise",
      "suggestedFix": "The exact corrected code ready to copy and paste. Not a description — actual working code. For security issues always show the safe version. Leave empty string for praise comments.",
      "fixExplanation": "One sentence explaining why this fix is better than the original.",
      "category": "${categoryList}"
    }
  ],
  "score": 0-100
}

Rules:
- Every non-praise comment MUST include a suggestedFix with actual working code, never just a description like "use X instead"
- Every non-praise comment MUST include a fixExplanation
- Every comment MUST include a category
- Always include at least one praise comment if there is anything positive
- Focus on: bugs, security issues, performance, readability, and best practices
- Only comment on meaningful issues — skip trivial style nits`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const raw = content.text.trim();

  try {
    return JSON.parse(raw) as ReviewResult;
  } catch {
    // Claude may wrap JSON in markdown fences
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as ReviewResult;
    } catch {
      // fall through
    }
  }

  throw new Error(
    `Failed to parse Claude response as JSON: ${raw.slice(0, 500)}`
  );
}
