"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

interface Review {
  id: string;
  repo: string;
  pr_number: number;
  status: string;
  comments_posted: number;
  score: number | null;
  summary: string | null;
  ai_comments: { severity?: string }[] | null;
  created_at: string;
}

interface Usage {
  allowed: boolean;
  used: number;
  limit: number;
  plan: string;
}

interface Insights {
  avgScore: number | null;
  avgScorePrev: number | null;
  totalComments: number;
  totalCommentsPrev: number;
  topRepo: { name: string; count: number } | null;
  severity: Record<string, number>;
}

interface ScorePoint {
  date: string;
  score: number;
}

interface Pattern {
  id: string;
  pattern_name: string;
  description: string;
  recommendation: string;
  occurrence_count: number;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function MiniScoreRing({ score, size = 28 }: { score: number; size?: number }) {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const stroke = score >= 80 ? "stroke-emerald-400" : score >= 50 ? "stroke-amber-400" : "stroke-red-400";
  const bg = score >= 80 ? "stroke-emerald-400/20" : score >= 50 ? "stroke-amber-400/20" : "stroke-red-400/20";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" className={bg} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3"
          className={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums ${scoreColor(score)}`}>
        {score}
      </span>
    </div>
  );
}

function DeltaArrow({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return <span className="text-[11px] text-white/15">--</span>;
  const diff = current - previous;
  if (diff === 0) return <span className="text-[11px] text-white/30">--</span>;
  const up = diff > 0;
  return (
    <span className={`text-[11px] font-medium flex items-center gap-0.5 ${up ? "text-emerald-400/70" : "text-red-400/70"}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className={up ? "" : "rotate-180"}>
        <path d="M5 2L8.5 7H1.5L5 2Z" />
      </svg>
      {Math.abs(diff)}
    </span>
  );
}

function severityCounts(comments: { severity?: string }[] | null) {
  const counts: Record<string, number> = { critical: 0, warning: 0, suggestion: 0, praise: 0 };
  if (!Array.isArray(comments)) return counts;
  for (const c of comments) {
    const key = c.severity ?? "suggestion";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

const sevPillConfig: Record<string, { bg: string; text: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-400" },
  warning: { bg: "bg-amber-500/10", text: "text-amber-400" },
  suggestion: { bg: "bg-blue-500/10", text: "text-blue-400" },
  praise: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
};

const planLabels: Record<string, string> = { free: "Free", pro: "Pro", team: "Team", enterprise: "Enterprise" };
const upgradeTargets: Record<string, string | null> = { free: "pro", pro: "team", team: null, enterprise: null };

function HeroMetrics({ insights, usage }: { insights: Insights | null; usage: Usage | null }) {
  const isFinitePlan = usage && usage.limit !== Infinity && usage.limit > 0;
  const pct = isFinitePlan ? Math.min((usage.used / usage.limit) * 100, 100) : 0;
  const isNearLimit = isFinitePlan && usage.used >= usage.limit * 0.8;
  const nextPlan = usage ? (upgradeTargets[usage.plan] ?? null) : null;

  async function handleUpgrade(plan: string) {
    const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, interval: "month" }) });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }
  async function handleManage() {
    const res = await fetch("/api/billing", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Avg Score */}
      <div className="glass rounded-2xl p-5 group hover:bg-white/[0.03] transition-all duration-500">
        <div className="flex items-center gap-1.5 mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <p className="text-[12px] text-white/25 font-medium">Avg Score</p>
        </div>
        <div className="flex items-end gap-2">
          <span className={`text-[32px] font-semibold tracking-tight leading-none ${insights?.avgScore !== null ? scoreColor(insights?.avgScore ?? 0) : "text-white/20"}`}>
            {insights?.avgScore ?? "--"}
          </span>
          {insights && <DeltaArrow current={insights.avgScore} previous={insights.avgScorePrev} />}
        </div>
        <p className="text-[11px] text-white/15 mt-1">vs last month</p>
      </div>

      {/* Reviews This Month */}
      <div className="glass rounded-2xl p-5 group hover:bg-white/[0.03] transition-all duration-500">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
              <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" />
              <path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" />
            </svg>
            <p className="text-[12px] text-white/25 font-medium">{planLabels[usage?.plan ?? "free"]} plan</p>
          </div>
          {nextPlan ? (
            <button onClick={() => handleUpgrade(nextPlan)} className="text-[11px] text-white/30 hover:text-white/60 transition-colors font-medium">
              Upgrade
            </button>
          ) : usage && usage.plan !== "free" ? (
            <button onClick={handleManage} className="text-[11px] text-white/30 hover:text-white/60 transition-colors font-medium">
              Manage
            </button>
          ) : null}
        </div>
        <span className="text-[32px] font-semibold tracking-tight leading-none text-white/90">
          {usage?.used ?? 0}
        </span>
        {isFinitePlan && (
          <>
            <span className="text-[14px] text-white/20 ml-1">/ {usage.limit}</span>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mt-2">
              <div className={`h-full rounded-full transition-all duration-500 ${isNearLimit ? "bg-amber-400/60" : "bg-white/20"}`} style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
        {!isFinitePlan && usage && usage.plan !== "free" && (
          <p className="text-[11px] text-white/15 mt-1">Unlimited</p>
        )}
      </div>

      {/* Issues Found */}
      <div className="glass rounded-2xl p-5 group hover:bg-white/[0.03] transition-all duration-500">
        <div className="flex items-center gap-1.5 mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-[12px] text-white/25 font-medium">Issues Found</p>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-[32px] font-semibold tracking-tight leading-none text-white/90">
            {insights?.totalComments ?? 0}
          </span>
          {insights && <DeltaArrow current={insights.totalComments} previous={insights.totalCommentsPrev} />}
        </div>
        <p className="text-[11px] text-white/15 mt-1">this month</p>
      </div>

      {/* Top Repo */}
      <div className="glass rounded-2xl p-5 group hover:bg-white/[0.03] transition-all duration-500">
        <div className="flex items-center gap-1.5 mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-[12px] text-white/25 font-medium">Top Repo</p>
        </div>
        {insights?.topRepo ? (
          <>
            <a
              href={`https://github.com/${insights.topRepo.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] font-medium text-white/60 hover:text-white/80 transition-colors font-[family-name:var(--font-geist-mono)] truncate block"
            >
              {insights.topRepo.name.split("/").pop()}
            </a>
            <p className="text-[11px] text-white/15 mt-1">{insights.topRepo.count} reviews this month</p>
          </>
        ) : (
          <span className="text-[14px] text-white/20">--</span>
        )}
      </div>
    </div>
  );
}

function aggregateScores(points: ScorePoint[]) {
  const map = new Map<string, { total: number; count: number }>();
  for (const p of points) {
    const existing = map.get(p.date);
    if (existing) { existing.total += p.score; existing.count++; }
    else map.set(p.date, { total: p.score, count: 1 });
  }
  return Array.from(map.entries()).map(([date, { total, count }]) => ({
    date,
    score: Math.round(total / count),
  }));
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [scores, setScores] = useState<ScorePoint[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [revRes, usageRes, scoresRes, insightsRes, patternsRes] = await Promise.all([
          fetch("/api/reviews"),
          fetch("/api/usage"),
          fetch("/api/scores"),
          fetch("/api/insights"),
          fetch("/api/patterns"),
        ]);
        if (revRes.ok) setReviews(await revRes.json());
        if (usageRes.ok) setUsage(await usageRes.json());
        if (scoresRes.ok) setScores(await scoresRes.json());
        if (insightsRes.ok) setInsights(await insightsRes.json());
        if (patternsRes.ok) setPatterns(await patternsRes.json());
      } finally {
        setLoading(false);
      }
    }
    if (session) fetchData();

    if (!session) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [session]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 pt-16 pb-20">
        <div className="mb-10">
          <div className="h-4 w-24 bg-white/[0.04] rounded animate-pulse mb-3" />
          <div className="h-10 w-64 bg-white/[0.04] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map((i) => <div key={i} className="glass rounded-2xl p-5 h-28 animate-pulse" />)}
        </div>
        <div className="glass rounded-2xl h-52 mb-8 animate-pulse" />
        <div className="glass rounded-2xl h-64 animate-pulse" />
      </main>
    );
  }

  const aggregated = aggregateScores(scores);
  const avgLine = aggregated.length > 0
    ? Math.round(aggregated.reduce((s, p) => s + p.score, 0) / aggregated.length)
    : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const userName = session?.user?.name?.split(" ")[0] ?? "";

  return (
    <main className="max-w-5xl mx-auto px-6 pt-16 pb-20">
      <div className="animate-fade-in mb-10">
        <p className="text-[13px] text-white/20 tracking-widest uppercase mb-3 font-medium">Dashboard</p>
        <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight leading-tight">
          {greeting}{userName ? `, ${userName}` : ""}
        </h1>
      </div>

      {/* Hero Metrics */}
      <div className="animate-fade-in stagger-1 mb-8">
        <HeroMetrics insights={insights} usage={usage} />
      </div>

      {/* Score Chart */}
      {aggregated.length > 0 && (
        <div className="animate-fade-in stagger-1 glass rounded-2xl p-6 mb-8">
          <p className="text-[13px] text-white/30 font-medium mb-4">Score trend (last 30 days)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={aggregated}>
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#fff" }} />
              <ReferenceLine y={avgLine} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" label={{ value: `avg ${avgLine}`, position: "right", fill: "rgba(255,255,255,0.2)", fontSize: 10 }} />
              <Line type="monotone" dataKey="score" stroke="rgba(52,211,153,0.7)" strokeWidth={2}
                dot={{ fill: "rgba(52,211,153,0.7)", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#34d399" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Activity / Empty State */}
      <div className="animate-fade-in stagger-2">
        {reviews.length === 0 ? (
          <div className="glass rounded-2xl p-10">
            <p className="text-[13px] text-white/20 tracking-widest uppercase mb-6 font-medium text-center">Get started</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  step: "01",
                  title: "Install the GitHub App",
                  desc: "Connect Lintly to your repositories so it can read pull request diffs.",
                  link: "https://github.com/apps/lintly-dev",
                  cta: "Install App",
                },
                {
                  step: "02",
                  title: "Open a pull request",
                  desc: "Push a branch and open a PR on any connected repo. Lintly activates automatically.",
                  link: null,
                  cta: null,
                },
                {
                  step: "03",
                  title: "See your review here",
                  desc: "Lintly posts inline comments on the PR and your score appears on this dashboard.",
                  link: null,
                  cta: null,
                },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <span className="text-[40px] font-bold tracking-tight text-white/[0.06] block leading-none mb-3">{s.step}</span>
                  <p className="text-[15px] text-white/60 font-medium mb-2">{s.title}</p>
                  <p className="text-[13px] text-white/25 leading-relaxed mb-4">{s.desc}</p>
                  {s.link && (
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 rounded-full text-[12px] font-medium bg-white text-black hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-300"
                    >
                      {s.cta}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="glass-strong rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <p className="text-[13px] text-white/30 font-medium">Recent activity</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {reviews.map((review) => {
                const sev = severityCounts(review.ai_comments);
                const ghUrl = `https://github.com/${review.repo}/pull/${review.pr_number}`;
                return (
                  <button
                    key={review.id}
                    onClick={() => router.push(`/dashboard/review/${review.id}`)}
                    className="w-full px-6 py-5 flex items-start gap-4 hover:bg-white/[0.02] transition-colors duration-300 text-left cursor-pointer"
                  >
                    {/* Score ring or icon */}
                    <div className="pt-0.5 shrink-0">
                      {review.score !== null ? (
                        <MiniScoreRing score={review.score} />
                      ) : (
                        <div className="h-7 w-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/20">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" /></svg>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-medium text-white/70 font-[family-name:var(--font-geist-mono)] truncate">
                          {review.repo}
                        </span>
                        <span className="text-[13px] text-white/25">#{review.pr_number}</span>
                        {review.status === "limit_reached" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/10">
                            limit
                          </span>
                        )}
                      </div>
                      {review.summary && (
                        <p className="text-[13px] text-white/30 leading-relaxed line-clamp-1 mb-1.5">
                          {review.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {(["critical", "warning", "suggestion", "praise"] as const).map((key) => {
                          const count = sev[key];
                          if (!count) return null;
                          const cfg = sevPillConfig[key];
                          return (
                            <span key={key} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${cfg.bg} ${cfg.text}`}>
                              {count} {key}
                            </span>
                          );
                        })}
                        {!review.ai_comments?.length && review.comments_posted > 0 && (
                          <span className="text-[11px] text-white/20">{review.comments_posted} comment{review.comments_posted !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>

                    {/* Right — GitHub link + time */}
                    <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                      <a
                        href={ghUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-all text-[11px] font-medium"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                        View PR
                      </a>
                      <span className="text-[11px] text-white/15 tabular-nums">{relativeTime(review.created_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recurring Patterns */}
      {patterns.length > 0 && (
        <div className="animate-fade-in stagger-2 glass-strong rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <p className="text-[13px] text-white/30 font-medium">Recurring patterns</p>
            <p className="text-[11px] text-white/15">{patterns.length} detected</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {patterns.slice(0, 3).map((p) => (
              <div key={p.id} className="px-6 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] text-white/70 font-medium">{p.pattern_name}</span>
                    <span className="text-[11px] text-white/20 tabular-nums">{p.occurrence_count}×</span>
                  </div>
                  <p className="text-[13px] text-white/30 line-clamp-2 mb-1">{p.description}</p>
                  <p className="text-[12px] text-emerald-400/50">→ {p.recommendation}</p>
                </div>
                <button
                  onClick={async () => {
                    await fetch("/api/patterns", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: p.id }),
                    });
                    setPatterns((prev) => prev.filter((x) => x.id !== p.id));
                  }}
                  className="shrink-0 text-white/15 hover:text-white/40 transition-colors mt-1"
                  title="Dismiss"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
