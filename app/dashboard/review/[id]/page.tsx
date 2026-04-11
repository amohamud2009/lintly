"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface AIComment {
  path: string;
  line: number;
  body: string;
  severity: "critical" | "warning" | "suggestion" | "praise";
  suggestedFix?: string;
  fixExplanation?: string;
  category?: string;
  fixApplied?: boolean;
  fixCommitSha?: string;
}

interface ReviewDetail {
  id: string;
  repo: string;
  pr_number: number;
  status: string;
  comments_posted: number;
  score: number | null;
  summary: string | null;
  ai_comments: AIComment[] | null;
  created_at: string;
}

const severityConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  critical: { label: "Critical", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/10" },
  warning: { label: "Warning", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/10" },
  suggestion: { label: "Suggestion", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/10" },
  praise: { label: "Praise", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/10" },
};

const categoryConfig: Record<string, { bg: string; text: string; icon?: string }> = {
  "ai-risk": { bg: "bg-violet-500/10", text: "text-violet-400/80", icon: "\u{1F916}" },
  security: { bg: "bg-red-500/5", text: "text-red-400/60" },
  performance: { bg: "bg-amber-500/5", text: "text-amber-400/60" },
  bug: { bg: "bg-red-500/5", text: "text-red-400/60" },
  readability: { bg: "bg-blue-500/5", text: "text-blue-400/60" },
  "best-practice": { bg: "bg-purple-500/5", text: "text-purple-400/60" },
  style: { bg: "bg-white/[0.03]", text: "text-white/30" },
};

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  const ringColor =
    score >= 80 ? "stroke-emerald-400/30" : score >= 50 ? "stroke-amber-400/30" : "stroke-red-400/30";
  const fillColor =
    score >= 80 ? "stroke-emerald-400" : score >= 50 ? "stroke-amber-400" : "stroke-red-400";

  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" strokeWidth="8" className={ringColor} />
        <circle
          cx="60" cy="60" r="54" fill="none" strokeWidth="8"
          className={fillColor}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold tracking-tight ${color}`}>{score}</span>
        <span className="text-[11px] text-white/30 uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

function CommentCard({ comment, commentIndex, repo, reviewId, prNumber }: {
  comment: AIComment; commentIndex: number; repo: string; reviewId: string; prNumber: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(comment.fixApplied ?? false);
  const [applyError, setApplyError] = useState("");
  const [commitUrl, setCommitUrl] = useState<string | null>(null);
  const [walkthrough, setWalkthrough] = useState<string | null>(null);
  const [walkthroughLoading, setWalkthroughLoading] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  const sev = severityConfig[comment.severity] ?? severityConfig.suggestion;
  const cat = comment.category ? categoryConfig[comment.category] ?? categoryConfig.style : null;
  const ghUrl = `https://github.com/${repo}/blob/HEAD/${comment.path}#L${comment.line}`;
  const hasFix = comment.suggestedFix && comment.severity !== "praise";

  async function copyCode() {
    if (!comment.suggestedFix) return;
    try {
      await navigator.clipboard.writeText(comment.suggestedFix);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  }

  async function handleApplyFix() {
    if (!comment.suggestedFix) return;
    setApplying(true);
    setApplyError("");
    try {
      const res = await fetch("/api/fix/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId,
          commentIndex,
          repo,
          filePath: comment.path,
          suggestedFix: comment.suggestedFix,
          prNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApplyError(data.error || "Failed to apply fix");
      } else {
        setApplied(true);
        setCommitUrl(data.commitUrl || null);
      }
    } catch {
      setApplyError("Network error");
    } finally {
      setApplying(false);
    }
  }

  async function handleWalkthrough() {
    setShowWalkthrough(!showWalkthrough);
    if (walkthrough || walkthroughLoading) return;
    setWalkthroughLoading(true);
    try {
      const res = await fetch("/api/fix/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueBody: comment.body,
          suggestedFix: comment.suggestedFix,
          fixExplanation: comment.fixExplanation,
          category: comment.category,
          severity: comment.severity,
          filePath: comment.path,
        }),
      });
      const data = await res.json();
      setWalkthrough(data.walkthrough || "Could not generate walkthrough.");
    } catch {
      setWalkthrough("Failed to load walkthrough.");
    } finally {
      setWalkthroughLoading(false);
    }
  }

  return (
    <div className="glass rounded-xl p-5 hover:bg-white/[0.02] transition-colors duration-300">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase ${sev.bg} ${sev.text} border ${sev.border}`}>
          {sev.label}
        </span>
        {cat && comment.category && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium tracking-wider uppercase ${cat.bg} ${cat.text} ${comment.category === "ai-risk" ? "border border-violet-500/15" : ""}`}>
            {cat.icon ? `${cat.icon} ` : ""}{comment.category === "ai-risk" ? "AI Risk" : comment.category}
          </span>
        )}
        <span className="text-[12px] text-white/20 font-[family-name:var(--font-geist-mono)]">
          {comment.path}:{comment.line}
        </span>
        <a
          href={ghUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[11px] text-white/15 hover:text-white/40 transition-colors flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          GitHub
        </a>
      </div>

      <p className="text-[14px] text-white/60 leading-relaxed whitespace-pre-wrap">{comment.body}</p>

      {hasFix && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-[12px] text-white/30 hover:text-white/50 transition-colors group"
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="font-medium">Suggested fix</span>
          </button>

          {expanded && (
            <div className="mt-3 relative">
              <div className="bg-[#0d1117] border border-white/[0.06] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-[11px] text-white/20 font-[family-name:var(--font-geist-mono)]">
                    {comment.path}
                  </span>
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-white/60 transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="text-emerald-400/70">Copied</span>
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="px-4 py-3 text-[13px] text-emerald-400/80 font-[family-name:var(--font-geist-mono)] overflow-x-auto leading-relaxed">
                  <code>{comment.suggestedFix}</code>
                </pre>
              </div>
              {comment.fixExplanation && (
                <p className="text-[12px] text-white/30 mt-2 italic leading-relaxed">
                  {comment.fixExplanation}
                </p>
              )}

              {/* Agentic action buttons */}
              <div className="flex items-center gap-2 mt-4">
                {applied ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/10">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      Fix applied
                    </span>
                    {commitUrl && (
                      <a href={commitUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-white/25 hover:text-white/50 underline transition-colors">
                        View commit
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleApplyFix}
                    disabled={applying}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/10 hover:bg-emerald-500/15 hover:text-emerald-400 transition-all disabled:opacity-50"
                  >
                    {applying ? (
                      <>
                        <div className="h-3 w-3 border border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        Apply fix
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={handleWalkthrough}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${
                    showWalkthrough
                      ? "bg-blue-500/10 text-blue-400/80 border-blue-500/10"
                      : "bg-white/[0.03] text-white/35 border-white/[0.06] hover:bg-white/[0.05] hover:text-white/50"
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  Walk me through it
                </button>
              </div>

              {applyError && (
                <p className="text-[12px] text-red-400/70 mt-2">{applyError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Walkthrough panel */}
      {showWalkthrough && (
        <div className="mt-4 bg-blue-500/[0.04] border border-blue-500/[0.08] rounded-xl p-5">
          {walkthroughLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 border border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
              <span className="text-[13px] text-blue-400/60">Generating walkthrough...</span>
            </div>
          ) : walkthrough ? (
            <div className="text-[13px] text-white/50 leading-relaxed prose prose-invert prose-sm max-w-none [&_h1]:text-[14px] [&_h1]:font-semibold [&_h1]:text-white/60 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-white/60 [&_h3]:text-[13px] [&_h3]:font-medium [&_h3]:text-white/50 [&_strong]:text-white/60 [&_code]:text-emerald-400/70 [&_code]:bg-white/[0.04] [&_code]:px-1 [&_code]:rounded [&_ul]:space-y-1 [&_ol]:space-y-1 [&_li]:text-white/45">
              {walkthrough.split("\n").map((line, i) => {
                if (line.startsWith("## ")) return <h2 key={i} className="mt-3 mb-1">{line.slice(3)}</h2>;
                if (line.startsWith("### ")) return <h3 key={i} className="mt-2 mb-1">{line.slice(4)}</h3>;
                if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-white/60 mt-2">{line.slice(2, -2)}</p>;
                if (line.startsWith("- ")) return <p key={i} className="pl-3 border-l-2 border-white/[0.06] ml-1">{line.slice(2)}</p>;
                if (line.startsWith("```")) return null;
                if (line.trim() === "") return <div key={i} className="h-2" />;
                return <p key={i}>{line}</p>;
              })}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function ReviewDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/reviews/${params.id}`);
        if (res.ok) setReview(await res.json());
        else router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    if (session && params.id) load();
  }, [session, params.id, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-40">
        <div className="h-5 w-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!review) return null;

  const comments = review.ai_comments ?? [];

  return (
    <main className="max-w-3xl mx-auto px-6 pt-12 pb-20">
        <div className="animate-fade-in mb-10">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-[13px] text-white/30 hover:text-white/50 transition-colors mb-6 block"
          >
            &larr; All reviews
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight font-[family-name:var(--font-geist-mono)]">
                <a
                  href={`https://github.com/${review.repo}/pull/${review.pr_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white/70 transition-colors"
                >
                  {review.repo} #{review.pr_number}
                </a>
              </h1>
              <p className="text-[14px] text-white/30 mt-1">
                {new Date(review.created_at).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            {review.status === "limit_reached" ? (
              <span className="px-3 py-1 rounded-full text-[12px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/10">
                Limit reached
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-[12px] font-medium bg-white/[0.04] text-white/40 border border-white/[0.06]">
                {review.status}
              </span>
            )}
          </div>
        </div>

        {review.score !== null ? (
          <div className="animate-fade-in stagger-1 glass rounded-2xl p-8 mb-8 text-center">
            <ScoreGauge score={review.score} />
            {review.summary && (
              <p className="text-[15px] text-white/50 leading-relaxed mt-6 max-w-lg mx-auto">
                {review.summary}
              </p>
            )}
          </div>
        ) : review.status === "completed" ? (
          <div className="animate-fade-in stagger-1 glass rounded-2xl p-8 mb-8 text-center">
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
              <span className="text-[40px] font-semibold tracking-tight text-white/15">N/A</span>
            </div>
            <p className="text-[15px] text-white/40 mt-2">Score not available for this review</p>
            {review.summary && (
              <p className="text-[14px] text-white/30 leading-relaxed mt-4 max-w-lg mx-auto">
                {review.summary}
              </p>
            )}
            <a
              href={`https://github.com/${review.repo}/pull/${review.pr_number}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 text-[13px] text-emerald-400/60 hover:text-emerald-400/80 transition-colors"
            >
              View PR on GitHub &rarr;
            </a>
          </div>
        ) : null}

        {comments.length > 0 ? (
          <div className="animate-fade-in stagger-2 space-y-3">
            <p className="text-[13px] text-white/20 tracking-widest uppercase font-medium mb-4">
              {comments.length} comment{comments.length !== 1 ? "s" : ""}
            </p>
            {comments.map((c, i) => (
              <CommentCard key={i} comment={c} commentIndex={i} repo={review.repo} reviewId={review.id} prNumber={review.pr_number} />
            ))}
          </div>
        ) : review.status !== "limit_reached" && review.comments_posted > 0 && (
          <div className="animate-fade-in stagger-2 glass rounded-2xl p-8 text-center">
            <p className="text-[15px] text-white/40 mb-3">Comments were posted directly to your PR on GitHub</p>
            <a
              href={`https://github.com/${review.repo}/pull/${review.pr_number}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] text-emerald-400/60 hover:text-emerald-400/80 transition-colors"
            >
              View PR on GitHub →
            </a>
          </div>
        )}

        {review.status === "limit_reached" && (
          <div className="animate-fade-in glass rounded-2xl p-8 text-center">
            <p className="text-[17px] text-white/50 mb-4">
              This PR was not reviewed because you hit your plan limit.
            </p>
            <button
              onClick={async () => {
                const usageRes = await fetch("/api/usage");
                const usage = usageRes.ok ? await usageRes.json() : null;
                const plan = usage?.plan === "free" ? "pro" : usage?.plan === "pro" ? "team" : null;
                if (!plan) return;
                const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, interval: "month" }) });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              }}
              className="bg-white text-black px-6 py-2.5 rounded-full text-[14px] font-medium hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-300"
            >
              Upgrade now
            </button>
          </div>
        )}
    </main>
  );
}
