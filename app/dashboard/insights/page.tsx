"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

interface SecurityData {
  scansThisMonth: number;
  scansThisWeek: number;
  totalVulnerabilities: number;
  topIssues: { type: string; count: number }[];
  issueTypes: Record<string, number>;
}

interface InsightsData {
  distribution: Record<string, number>;
  issueTypes: Record<string, number>;
  topIssues: { type: string; count: number }[];
  authors: { name: string; avgScore: number | null; prevAvgScore: number | null; reviewCount: number; topIssue: string | null }[];
  weeklyComparison: {
    thisWeekReviews: number;
    lastWeekReviews: number;
    thisWeekAvg: number | null;
    lastWeekAvg: number | null;
    criticalIssues: number;
    avgScore30d: number | null;
  };
  security: SecurityData;
  actionableInsights: string[];
}

const PIE_COLORS = ["#f87171", "#fbbf24", "#60a5fa", "#34d399"];
const SEVERITY_LABELS: Record<string, string> = { critical: "Critical", warning: "Warning", suggestion: "Suggestion", praise: "Praise" };

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number) {
  if (score >= 80) return "bg-emerald-500/10 border-emerald-500/10";
  if (score >= 50) return "bg-amber-500/10 border-amber-500/10";
  return "bg-red-500/10 border-red-500/10";
}

export default function InsightsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/insights/advanced");
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    }
    if (session) load();
  }, [session]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 pt-16 pb-20">
        <div className="mb-10">
          <div className="h-4 w-24 bg-white/[0.04] rounded animate-pulse mb-3" />
          <div className="h-10 w-48 bg-white/[0.04] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map((i) => <div key={i} className="glass rounded-2xl p-5 h-28 animate-pulse" />)}
        </div>
        <div className="glass rounded-2xl h-48 animate-pulse" />
      </main>
    );
  }

  if (!data) return null;

  const { weeklyComparison: wc, security: sec } = data;
  const reviewDelta = wc.thisWeekReviews - wc.lastWeekReviews;

  const distData = Object.entries(data.distribution).map(([range, count]) => ({ range, count }));
  const hasDistData = distData.some((d) => d.count > 0);

  const pieData = Object.entries(data.issueTypes).map(([name, value]) => ({
    name: SEVERITY_LABELS[name] ?? name,
    value,
  })).filter((d) => d.value > 0);

  const hasAnyData = wc.thisWeekReviews > 0 || sec.scansThisMonth > 0;

  return (
    <main className="max-w-5xl mx-auto px-6 pt-16 pb-20">
      <div className="animate-fade-in mb-10">
        <p className="text-[13px] text-white/20 tracking-widest uppercase mb-3 font-medium">Dashboard</p>
        <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight leading-tight">Insights</h1>
      </div>

      {/* Actionable insights — each with a clear next step */}
      {(data.actionableInsights.length > 0 || wc.criticalIssues > 0 || sec.totalVulnerabilities > 0) && (
        <div className="animate-fade-in space-y-3 mb-8">
          <p className="text-[13px] text-white/20 uppercase tracking-widest font-medium mb-1">Action items</p>

          {wc.criticalIssues > 0 && (
            <div className="glass rounded-xl p-4 flex items-center justify-between gap-4 border border-red-500/[0.08]">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </div>
                <div>
                  <p className="text-[14px] text-white/70 font-medium">{wc.criticalIssues} critical issue{wc.criticalIssues !== 1 ? "s" : ""} this week</p>
                  <p className="text-[12px] text-white/30">Review and fix these before merging</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/dashboard")}
                className="shrink-0 px-4 py-2 rounded-lg text-[12px] font-medium bg-red-500/10 text-red-400/80 border border-red-500/10 hover:bg-red-500/15 transition-all"
              >
                Review PRs
              </button>
            </div>
          )}

          {sec.totalVulnerabilities > 0 && (
            <div className="glass rounded-xl p-4 flex items-center justify-between gap-4 border border-amber-500/[0.08]">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <div>
                  <p className="text-[14px] text-white/70 font-medium">{sec.totalVulnerabilities} securit{sec.totalVulnerabilities !== 1 ? "ies" : "y"} found</p>
                  <p className="text-[12px] text-white/30">Security vulnerabilities detected in recent scans</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const el = document.getElementById("security-section");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="shrink-0 px-4 py-2 rounded-lg text-[12px] font-medium bg-amber-500/10 text-amber-400/80 border border-amber-500/10 hover:bg-amber-500/15 transition-all"
              >
                View details
              </button>
            </div>
          )}

          {wc.avgScore30d !== null && wc.avgScore30d < 70 && (
            <div className="glass rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                </div>
                <div>
                  <p className="text-[14px] text-white/70 font-medium">Average score is {wc.avgScore30d}/100</p>
                  <p className="text-[12px] text-white/30">Consider enabling AI Code Mode to catch more patterns</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/dashboard/settings")}
                className="shrink-0 px-4 py-2 rounded-lg text-[12px] font-medium bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/60 transition-all"
              >
                Settings
              </button>
            </div>
          )}

          {data.actionableInsights.map((insight, i) => (
            <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              </div>
              <p className="text-[13px] text-white/50 leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
      )}

      {/* Summary row */}
      <div className="animate-fade-in stagger-1 grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button onClick={() => router.push("/dashboard")} className="glass rounded-2xl p-5 text-left hover:bg-white/[0.03] transition-colors group">
          <p className="text-[12px] text-white/25 font-medium mb-2 flex items-center justify-between">
            Reviews this week
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10 group-hover:text-white/30 transition-colors"><polyline points="9 18 15 12 9 6" /></svg>
          </p>
          <div className="flex items-end gap-2">
            <span className="text-[28px] font-semibold tracking-tight text-white/90">{wc.thisWeekReviews}</span>
            {reviewDelta !== 0 && (
              <span className={`text-[12px] font-medium ${reviewDelta > 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
                {reviewDelta > 0 ? "+" : ""}{reviewDelta} vs last
              </span>
            )}
          </div>
        </button>

        <button onClick={() => router.push("/dashboard/settings")} className="glass rounded-2xl p-5 text-left hover:bg-white/[0.03] transition-colors group">
          <p className="text-[12px] text-white/25 font-medium mb-2 flex items-center justify-between">
            Avg score (30d)
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10 group-hover:text-white/30 transition-colors"><polyline points="9 18 15 12 9 6" /></svg>
          </p>
          <div className="flex items-end gap-2">
            {wc.avgScore30d !== null ? (
              <span className={`text-[28px] font-semibold tracking-tight ${scoreColor(wc.avgScore30d)}`}>
                {wc.avgScore30d}
                <span className="text-[14px] text-white/20">/100</span>
              </span>
            ) : (
              <div>
                <span className="text-[28px] font-semibold tracking-tight text-white/20">N/A</span>
                <p className="text-[11px] text-white/15 mt-0.5">No scored reviews yet</p>
              </div>
            )}
          </div>
        </button>

        <div className="glass rounded-2xl p-5">
          <p className="text-[12px] text-white/25 font-medium mb-2">Security scans</p>
          <div className="flex items-end gap-2">
            <span className="text-[28px] font-semibold tracking-tight text-white/90">{sec.scansThisMonth}</span>
            <span className="text-[12px] text-white/20">this month</span>
          </div>
          {sec.totalVulnerabilities > 0 && (
            <p className="text-[11px] text-red-400/60 mt-1">{sec.totalVulnerabilities} vulnerabilit{sec.totalVulnerabilities !== 1 ? "ies" : "y"} found</p>
          )}
        </div>

        <button onClick={() => router.push("/dashboard")} className="glass rounded-2xl p-5 text-left hover:bg-white/[0.03] transition-colors group">
          <p className="text-[12px] text-white/25 font-medium mb-2 flex items-center justify-between">
            Critical issues
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10 group-hover:text-white/30 transition-colors"><polyline points="9 18 15 12 9 6" /></svg>
          </p>
          <span className={`text-[28px] font-semibold tracking-tight ${wc.criticalIssues > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {wc.criticalIssues}
          </span>
          <p className="text-[11px] text-white/15 mt-0.5">{wc.criticalIssues === 0 ? "Clean this week" : "this week — review now"}</p>
        </button>
      </div>

      {/* Security vulnerabilities */}
      {sec.topIssues.length > 0 && (
        <div id="security-section" className="animate-fade-in stagger-2 glass rounded-2xl p-6 mb-8">
          <p className="text-[13px] text-white/30 font-medium mb-4">Security vulnerabilities detected (30d)</p>
          <div className="space-y-3">
            {sec.topIssues.map((issue) => (
              <div key={issue.type} className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3">
                  <div className="h-6 w-6 rounded-md bg-red-500/10 flex items-center justify-center shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  </div>
                  <span className="text-[14px] text-white/60 capitalize">{issue.type.replace(/_/g, " ")}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums ${
                  issue.count >= 3 ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                }`}>
                  {issue.count}×
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts row */}
      {hasAnyData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {hasDistData ? (
            <div className="animate-fade-in stagger-2 glass rounded-2xl p-6">
              <p className="text-[13px] text-white/30 font-medium mb-4">Score distribution (30d)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={distData}>
                  <XAxis dataKey="range" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 11 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#fff" }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="rgba(52,211,153,0.5)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="animate-fade-in stagger-2 glass rounded-2xl p-6 flex flex-col items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/10 mb-3"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12h18" /><path d="M12 3v18" /></svg>
              <p className="text-[13px] text-white/20">Score distribution will appear after scored reviews</p>
            </div>
          )}

          {pieData.length > 0 ? (
            <div className="animate-fade-in stagger-2 glass rounded-2xl p-6">
              <p className="text-[13px] text-white/30 font-medium mb-4">Issue types (30d)</p>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.6} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length], opacity: 0.6 }} />
                      <span className="text-[12px] text-white/40">{d.name}</span>
                      <span className="text-[12px] text-white/20">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in stagger-2 glass rounded-2xl p-6 flex flex-col items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/10 mb-3"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              <p className="text-[13px] text-white/20">Issue breakdown will appear after detailed reviews</p>
            </div>
          )}
        </div>
      )}

      {/* Top issues from reviews */}
      {data.topIssues.length > 0 && (
        <div className="animate-fade-in stagger-2 glass rounded-2xl p-6 mb-8">
          <p className="text-[13px] text-white/30 font-medium mb-4">Top review issue types</p>
          <div className="space-y-3">
            {data.topIssues.map((issue) => (
              <div key={issue.type} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {issue.type === "critical" && <div className="h-2 w-2 rounded-full bg-red-400" />}
                  {issue.type === "warning" && <div className="h-2 w-2 rounded-full bg-amber-400" />}
                  {issue.type === "suggestion" && <div className="h-2 w-2 rounded-full bg-blue-400" />}
                  {issue.type === "praise" && <div className="h-2 w-2 rounded-full bg-emerald-400" />}
                  <span className="text-[14px] text-white/60 capitalize">{issue.type}</span>
                </div>
                <span className="text-[13px] text-white/25 tabular-nums">{issue.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Leaderboard */}
      {data.authors.length > 1 ? (
        <div className="animate-fade-in stagger-2 glass-strong rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <p className="text-[13px] text-white/30 font-medium tracking-wider uppercase">Team Leaderboard</p>
            <p className="text-[11px] text-white/15">This month</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {data.authors.map((author, index) => {
              const isCurrentUser = author.name === ((session?.user as Record<string, unknown>)?.name ?? "");
              const scoreDelta = author.avgScore !== null && author.prevAvgScore !== null
                ? author.avgScore - author.prevAvgScore
                : null;
              return (
                <div key={author.name} className={`px-6 py-4 flex items-center justify-between transition-colors ${isCurrentUser ? "bg-white/[0.02]" : ""}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-7 text-center">
                      {index === 0 ? (
                        <span className="text-[18px]" title="Top contributor">{"\u{1F451}"}</span>
                      ) : (
                        <span className="text-[14px] text-white/20 font-semibold tabular-nums">#{index + 1}</span>
                      )}
                    </div>
                    <div className="h-8 w-8 rounded-full bg-white/[0.06] flex items-center justify-center text-[12px] text-white/40 font-medium">
                      {author.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] text-white/70 font-medium">{author.name}</p>
                        {isCurrentUser && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/10 uppercase tracking-wider">You</span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/25">
                        {author.reviewCount} PR{author.reviewCount !== 1 ? "s" : ""} reviewed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {scoreDelta !== null && scoreDelta !== 0 && (
                      <span className={`text-[11px] font-medium ${scoreDelta > 0 ? "text-emerald-400/60" : "text-red-400/60"}`}>
                        {scoreDelta > 0 ? "\u2191" : "\u2193"}{Math.abs(scoreDelta)}
                      </span>
                    )}
                    {author.avgScore !== null ? (
                      <span className={`px-3 py-1 rounded-lg text-[15px] font-semibold tabular-nums border ${scoreBg(author.avgScore)} ${scoreColor(author.avgScore)}`}>
                        {author.avgScore}
                      </span>
                    ) : (
                      <span className="text-[13px] text-white/15">&mdash;</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : data.authors.length === 1 ? (
        <div className="animate-fade-in stagger-2 glass rounded-2xl p-6 mb-8 text-center">
          <p className="text-[14px] text-white/40 mb-2">You&rsquo;re the only contributor so far</p>
          <p className="text-[13px] text-white/25">Invite teammates by adding seats in <a href="/dashboard/settings" className="text-emerald-400/60 hover:text-emerald-400/80 underline">Settings</a>.</p>
        </div>
      ) : null}

      {/* Empty state */}
      {!hasAnyData && (
        <div className="animate-fade-in glass rounded-2xl p-10 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/10 mx-auto mb-4"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          <p className="text-[16px] text-white/40 font-medium mb-2">No insights yet</p>
          <p className="text-[13px] text-white/20 max-w-sm mx-auto">
            Insights populate as Lintly reviews your PRs and scans your code. Open a pull request or push code to get started.
          </p>
        </div>
      )}
    </main>
  );
}
