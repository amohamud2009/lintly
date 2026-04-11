"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";

interface UsageData {
  plan: string;
  reviews: { used: number; limit: number };
  scans: { used: number; limit: number };
  chat: { used: number; limit: number };
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  if (limit === 0) return null;
  const isInfinite = !isFinite(limit);
  const pct = isInfinite ? 0 : Math.min((used / limit) * 100, 100);
  const isNear = !isInfinite && used >= limit * 0.8;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-white/25 w-12 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isNear ? "bg-amber-400/60" : "bg-white/20"}`}
          style={{ width: isInfinite ? "0%" : `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-white/20 tabular-nums w-14 text-right shrink-0">
        {isInfinite ? `${used}` : `${used}/${limit}`}
      </span>
    </div>
  );
}

const navItems = [
  {
    label: "Reviews",
    href: "/dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" />
        <path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" />
      </svg>
    ),
  },
  {
    label: "Repos",
    href: "/dashboard/repos",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: "Insights",
    href: "/dashboard/insights",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    label: "Ask Lintly",
    href: "/dashboard/chat",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: "Team",
    href: "/dashboard/settings/team",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      if (!res.ok) return;
      const data = await res.json();
      setUsage({
        plan: data.plan ?? "free",
        reviews: { used: data.used ?? 0, limit: data.limit ?? 10 },
        scans: { used: data.scansUsed ?? 0, limit: data.scansLimit ?? 0 },
        chat: { used: data.chatUsed ?? 0, limit: data.chatLimit ?? 0 },
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (session) fetchUsage();
  }, [session, fetchUsage]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="h-5 w-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-[#000000] text-white font-[family-name:var(--font-geist-sans)] flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-56 bg-[#0a0a0a] border-r border-white/[0.04] flex flex-col transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-2.5">
          <button onClick={() => router.push("/")} className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/[0.12] border border-emerald-500/[0.15] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v6c0 5.25 3.75 9.74 9 11 5.25-1.26 9-5.75 9-11V7l-9-5z" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400/80" fill="none" />
                <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400" />
              </svg>
            </div>
            <span className="text-[15px] font-medium tracking-tight text-white/90">Lintly</span>
          </button>
        </div>

        {/* Active indicator */}
        <div className="px-5 mb-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/[0.08]">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400/70 font-medium">Lintly is active</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  active
                    ? "bg-white/[0.06] text-white/80"
                    : "text-white/30 hover:text-white/50 hover:bg-white/[0.03]"
                }`}
              >
                <span className={active ? "text-white/60" : "text-white/20"}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}

          {/* Usage section */}
          {usage && (
            <div className="pt-4 mt-3 border-t border-white/[0.04] px-1 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-white/20 uppercase tracking-widest font-medium">Usage</span>
                <span className="text-[10px] text-white/15 capitalize">{usage.plan} plan</span>
              </div>
              <UsageMeter label="Reviews" used={usage.reviews.used} limit={usage.reviews.limit} />
              <UsageMeter label="Scans" used={usage.scans.used} limit={usage.scans.limit} />
              <UsageMeter label="Chat" used={usage.chat.used} limit={usage.chat.limit} />
            </div>
          )}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/[0.04]">
          <div className="flex items-center gap-3">
            {session?.user?.image && (
              <Image src={session.user.image} alt="" width={28} height={28} className="rounded-full ring-1 ring-white/10" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white/50 truncate">{session?.user?.name}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-white/20 hover:text-white/50 transition-colors"
              title="Sign out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-56">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 glass px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-white/40 hover:text-white/70 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-white/30 font-medium">Active</span>
          </div>
          {session?.user?.image && (
            <Image src={session.user.image} alt="" width={24} height={24} className="rounded-full ring-1 ring-white/10" />
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
