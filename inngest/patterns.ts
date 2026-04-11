import { inngest } from "@/inngest/review";
import { getSupabase } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const detectPatterns = inngest.createFunction(
  { id: "detect-patterns", triggers: [{ event: "review/completed" }] },
  async ({ event, step }) => {
    const { userId } = event.data;

    const shouldRun = await step.run("check-threshold", async () => {
      const { count } = await getSupabase()
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      return (count ?? 0) % 10 === 0 && (count ?? 0) > 0;
    });

    if (!shouldRun) return { skipped: true, reason: "not_10th_review" };

    const comments = await step.run("fetch-comments", async () => {
      const { data } = await getSupabase()
        .from("reviews")
        .select("ai_comments")
        .eq("user_id", userId)
        .not("ai_comments", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      const allComments: { severity: string; body: string; path: string }[] = [];
      for (const row of data ?? []) {
        const comments = row.ai_comments as { severity?: string; body?: string; path?: string }[] | null;
        if (!Array.isArray(comments)) continue;
        for (const c of comments) {
          allComments.push({
            severity: c.severity ?? "suggestion",
            body: c.body ?? "",
            path: c.path ?? "",
          });
        }
      }
      return allComments;
    });

    if (comments.length < 5) return { skipped: true, reason: "too_few_comments" };

    const patterns = await step.run("ai-pattern-analysis", async () => {
      const sample = comments.slice(0, 100).map((c) => `[${c.severity}] ${c.path}: ${c.body.slice(0, 200)}`).join("\n");

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: `Analyze these code review comments and identify the top 3 recurring patterns.

Comments:
${sample}

Return JSON array:
[
  {
    "pattern_name": "short name",
    "description": "what the pattern is",
    "recommendation": "how to fix it",
    "occurrence_count": number
  }
]`,
        }],
      });

      const content = message.content[0];
      if (content.type !== "text") return [];
      const raw = content.text.trim();
      try { return JSON.parse(raw); } catch { /* fallback */ }
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) try { return JSON.parse(match[0]); } catch { /* fallback */ }
      return [];
    });

    await step.run("save-patterns", async () => {
      for (const p of patterns) {
        await getSupabase()
          .from("patterns")
          .upsert(
            {
              user_id: userId,
              pattern_name: p.pattern_name,
              description: p.description,
              recommendation: p.recommendation,
              occurrence_count: p.occurrence_count ?? 1,
              dismissed: false,
              detected_at: new Date().toISOString(),
            },
            { onConflict: "user_id,pattern_name", ignoreDuplicates: false }
          );
      }
    });

    return { patterns: patterns.length };
  }
);
