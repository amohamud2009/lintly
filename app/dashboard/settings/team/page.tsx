"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

interface Member {
  id: string;
  org_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  invited_email: string | null;
  invite_status: "pending" | "accepted";
  user?: {
    name: string;
    email: string;
    avatar_url: string;
    github_id: string;
  };
}

const roleBadgeColors: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-400/80 border-amber-500/10",
  admin: "bg-blue-500/10 text-blue-400/80 border-blue-500/10",
  member: "bg-white/[0.04] text-white/40 border-white/[0.06]",
};

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/org/members");
      if (res.ok) setMembers(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchOrg = useCallback(async () => {
    setLoadingOrg(true);
    try {
      const res = await fetch("/api/org");
      if (res.ok) {
        const data = await res.json();
        setOrg(data);
        if (data?.id) fetchMembers();
      }
    } catch { /* ignore */ }
    setLoadingOrg(false);
  }, [fetchMembers]);

  useEffect(() => {
    if (session) fetchOrg();
  }, [session, fetchOrg]);

  async function createOrg() {
    if (!orgName.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim() }),
      });
      if (res.ok) {
        setShowCreate(false);
        setOrgName("");
        await fetchOrg();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to create organization");
      }
    } catch {
      setError("Network error");
    }
    setCreating(false);
  }

  async function inviteMember() {
    if (!inviteEmail.trim() || inviting) return;
    setInviting(true);
    setError(null);
    setInviteUrl(null);
    try {
      const res = await fetch("/api/org/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteUrl(data.inviteUrl);
        setInviteEmail("");
        setNeedsUpgrade(false);
        fetchMembers();
      } else {
        setError(data.error ?? "Failed to invite");
        setNeedsUpgrade(data.needsUpgrade ?? false);
      }
    } catch {
      setError("Network error");
    }
    setInviting(false);
  }

  async function removeMember(memberId: string) {
    await fetch(`/api/org/members/${memberId}`, { method: "DELETE" });
    fetchMembers();
  }

  async function changeRole(memberId: string, role: string) {
    await fetch(`/api/org/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    fetchMembers();
  }

  if (loadingOrg) {
    return (
      <main className="max-w-2xl mx-auto px-6 pt-16 pb-20">
        <div className="animate-fade-in mb-10">
          <div className="h-4 w-20 bg-white/[0.04] rounded animate-pulse mb-3" />
          <div className="h-10 w-40 bg-white/[0.04] rounded animate-pulse" />
        </div>
      </main>
    );
  }

  if (!org) {
    return (
      <main className="max-w-2xl mx-auto px-6 pt-16 pb-20">
        <div className="animate-fade-in mb-10">
          <p className="text-[13px] text-white/20 tracking-widest uppercase mb-3 font-medium">Dashboard</p>
          <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight leading-tight">Team</h1>
        </div>

        {!showCreate ? (
          <div className="animate-fade-in stagger-1">
            <div className="glass rounded-2xl p-10 text-center">
              <div className="h-12 w-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
              </div>
              <p className="text-[16px] text-white/50 font-medium mb-2">No team yet</p>
              <p className="text-[14px] text-white/25 mb-8 max-w-sm mx-auto">Create an organization to start collaborating with your team. You can invite members after setup.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="bg-white text-black px-6 py-2.5 rounded-full text-[14px] font-medium hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-300"
              >
                Create organization
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in stagger-1 glass rounded-2xl p-6">
            <h3 className="text-[15px] text-white/70 font-semibold mb-4">Create your organization</h3>
            <label className="block text-[13px] text-white/30 mb-2">Organization name</label>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createOrg()}
              placeholder="Acme Inc."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-[14px] text-white/80 placeholder:text-white/15 outline-none focus:border-white/[0.15] transition-colors mb-4"
              autoFocus
            />
            {error && <p className="text-[13px] text-red-400/70 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={createOrg}
                disabled={creating || !orgName.trim()}
                className="bg-white text-black px-6 py-2.5 rounded-full text-[14px] font-medium disabled:opacity-30 transition-all"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => { setShowCreate(false); setError(null); }}
                className="px-5 py-2.5 rounded-full text-[14px] text-white/40 hover:text-white/60 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <div className="animate-fade-in mb-10">
        <p className="text-[13px] text-white/20 tracking-widest uppercase mb-3 font-medium">Dashboard</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight leading-tight">{org.name}</h1>
            <p className="text-[14px] text-white/25 mt-1">{members.length} member{members.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => { setShowInvite(true); setError(null); setInviteUrl(null); }}
            className="bg-white text-black px-5 py-2.5 rounded-full text-[13px] font-medium hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-300"
          >
            Invite member
          </button>
        </div>
      </div>

      <div className="animate-fade-in stagger-1 space-y-6">
        {showInvite && (
          <div className="glass rounded-2xl p-6">
            <h3 className="text-[15px] text-white/70 font-semibold mb-4">Invite a team member</h3>
            <div className="flex gap-3 mb-4">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && inviteMember()}
                placeholder="name@company.com"
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-[14px] text-white/80 placeholder:text-white/15 outline-none focus:border-white/[0.15] transition-colors"
                autoFocus
              />
              <div className="relative">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                  className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 pr-9 text-[13px] text-white/60 outline-none focus:border-white/[0.15] cursor-pointer h-full"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </div>
            </div>

            {error && (
              <div className={`rounded-xl px-4 py-3 mb-4 ${needsUpgrade ? "bg-amber-500/[0.06] border border-amber-500/[0.1]" : ""}`}>
                <p className={`text-[13px] ${needsUpgrade ? "text-amber-400/80" : "text-red-400/70"}`}>{error}</p>
                {needsUpgrade && (
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/checkout", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ plan: "team", interval: "month" }),
                      });
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                    }}
                    className="mt-3 bg-white text-black px-5 py-2 rounded-full text-[13px] font-medium hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all"
                  >
                    Upgrade to Team — $49.99/mo
                  </button>
                )}
              </div>
            )}

            {inviteUrl && (
              <div className="bg-emerald-500/[0.06] border border-emerald-500/[0.1] rounded-xl p-4 mb-4">
                <p className="text-[12px] text-emerald-400/60 mb-2">Invite link — share with your teammate:</p>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] text-white/50 bg-white/[0.03] rounded-lg px-3 py-2 flex-1 break-all select-all font-[family-name:var(--font-geist-mono)]">{inviteUrl}</code>
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(inviteUrl); } catch { /* fallback */ }
                    }}
                    className="shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/40 hover:text-white/60 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={inviteMember}
                disabled={inviting || !inviteEmail.includes("@")}
                className="bg-white text-black px-6 py-2.5 rounded-full text-[13px] font-medium disabled:opacity-30 transition-all"
              >
                {inviting ? "Sending..." : "Send invite"}
              </button>
              <button
                onClick={() => { setShowInvite(false); setError(null); setInviteUrl(null); }}
                className="px-5 py-2.5 rounded-full text-[13px] text-white/40 hover:text-white/60 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Members list */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <p className="text-[13px] text-white/30 uppercase tracking-widest font-medium">Members</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {members.map((m) => (
              <div key={m.id} className="px-6 py-4 flex items-center gap-4">
                {m.user?.avatar_url ? (
                  <img src={m.user.avatar_url} alt="" className="h-9 w-9 rounded-full ring-1 ring-white/[0.06]" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[13px] text-white/20 font-medium">
                    {(m.invited_email ?? "?")[0].toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {m.invite_status === "pending" ? (
                    <div>
                      <p className="text-[14px] text-white/40 truncate">{m.invited_email}</p>
                      <p className="text-[11px] text-amber-400/50">Invitation pending</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[14px] text-white/70 font-medium truncate">{m.user?.name ?? "Unknown"}</p>
                      <p className="text-[12px] text-white/25 truncate">{m.user?.email}</p>
                    </div>
                  )}
                </div>

                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider border ${roleBadgeColors[m.role] ?? roleBadgeColors.member}`}>
                  {m.role}
                </span>

                {m.role !== "owner" && (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value)}
                        className="appearance-none bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 pr-7 text-[12px] text-white/40 outline-none cursor-pointer"
                        style={{ colorScheme: "dark" }}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/15"><polyline points="6 9 12 15 18 9" /></svg>
                      </div>
                    </div>
                    <button
                      onClick={() => removeMember(m.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/15 hover:text-red-400/60 transition-colors"
                      title="Remove member"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
