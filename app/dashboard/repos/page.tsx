"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Repo {
  name: string;
  reviewCount: number;
  commentCount: number;
  avgScore: number | null;
  lastReview: string;
}

interface RepoReview {
  id: string;
  pr_number: number;
  status: string;
  score: number | null;
  summary: string | null;
  created_at: string;
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

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[11px] text-white/15">--</span>;
  const color =
    score >= 80
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/10"
      : score >= 50
        ? "bg-amber-500/10 text-amber-400 border-amber-500/10"
        : "bg-red-500/10 text-red-400 border-red-500/10";
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums border ${color}`}>
      {score}
    </span>
  );
}

function MiniScoreRing({ score, size = 24 }: { score: number; size?: number }) {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const stroke = score >= 80 ? "stroke-emerald-400" : score >= 50 ? "stroke-amber-400" : "stroke-red-400";
  const bg = score >= 80 ? "stroke-emerald-400/20" : score >= 50 ? "stroke-amber-400/20" : "stroke-red-400/20";
  const color = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" className={bg} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3"
          className={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[8px] font-bold tabular-nums ${color}`}>
        {score}
      </span>
    </div>
  );
}

function RepoCard({ repo }: { repo: Repo }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [reviews, setReviews] = useState<RepoReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function toggle() {
    setExpanded((prev) => !prev);
    if (!loaded) {
      setLoadingReviews(true);
      try {
        const res = await fetch(`/api/reviews?repo=${encodeURIComponent(repo.name)}`);
        if (res.ok) setReviews(await res.json());
      } finally {
        setLoadingReviews(false);
        setLoaded(true);
      }
    }
  }

  return (
    <div className="border-b border-white/[0.04] last:border-b-0">
      <button
        onClick={toggle}
        className="w-full text-left px-6 py-5 hover:bg-white/[0.02] transition-colors duration-300"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20 shrink-0">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-[15px] font-medium text-white/70 font-[family-name:var(--font-geist-mono)]">
              {repo.name}
            </span>
            <ScorePill score={repo.avgScore} />
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`https://github.com/${repo.name}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/25 hover:text-white/50 transition-all text-[11px] font-medium"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              className={`text-white/20 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[12px] text-white/25">
          <span>{repo.reviewCount} review{repo.reviewCount !== 1 ? "s" : ""}</span>
          <span>{repo.commentCount} comment{repo.commentCount !== 1 ? "s" : ""}</span>
          <span>Last review {relativeTime(repo.lastReview)}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-5">
          {loadingReviews ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-4 w-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[13px] text-white/20">No reviews yet for this repo</p>
            </div>
          ) : (
            <div className="glass rounded-xl overflow-hidden divide-y divide-white/[0.04]">
              {reviews.map((review) => (
                <button
                  key={review.id}
                  onClick={() => router.push(`/dashboard/review/${review.id}`)}
                  className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="shrink-0">
                    {review.score !== null ? (
                      <MiniScoreRing score={review.score} />
                    ) : (
                      <div className="h-6 w-6 rounded-md bg-white/[0.04] flex items-center justify-center text-white/15">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" /></svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-white/60 font-medium">
                        PR #{review.pr_number}
                      </span>
                      {review.status === "limit_reached" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400">limit</span>
                      )}
                    </div>
                    {review.summary && (
                      <p className="text-[12px] text-white/25 truncate mt-0.5">{review.summary}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-white/15 tabular-nums shrink-0">{relativeTime(review.created_at)}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/10 shrink-0">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReposPage() {
  const { data: session } = useSession();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRepos() {
      try {
        const res = await fetch("/api/repos");
        if (res.ok) setRepos(await res.json());
      } finally {
        setLoading(false);
      }
    }
    if (session) fetchRepos();
  }, [session]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-40">
        <div className="h-5 w-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-6 pt-16 pb-20">
      <div className="animate-fade-in mb-10">
        <p className="text-[13px] text-white/20 tracking-widest uppercase mb-3 font-medium">Dashboard</p>
        <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight leading-tight">Repositories</h1>
      </div>

      <div className="animate-fade-in stagger-1">
        {repos.length === 0 ? (
          <div className="glass rounded-2xl py-24 text-center">
            <div className="h-12 w-12 rounded-2xl bg-white/[0.04] flex items-center justify-center text-white/20 mx-auto mb-5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-[17px] text-white/50 font-medium mb-2">No repos yet</p>
            <p className="text-[14px] text-white/25 max-w-sm mx-auto leading-relaxed">
              Install Lintly on a GitHub repository and open a pull request to see it here.
            </p>
          </div>
        ) : (
          <div className="glass-strong rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <p className="text-[13px] text-white/30 font-medium">{repos.length} connected repo{repos.length !== 1 ? "s" : ""}</p>
            </div>
            {repos.map((repo) => (
              <RepoCard key={repo.name} repo={repo} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
