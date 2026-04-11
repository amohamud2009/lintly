"use client";

import { useSession } from "next-auth/react";
import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface ActionEvent {
  tool: string;
  status: "running" | "done";
  label: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: ActionEvent[];
}

interface Conversation {
  id: string;
  title: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

const suggestions = [
  "Run a security scan on my repo",
  "Review PR #1 on my repo",
  "Generate a code quality report",
  "Show me my recent review scores",
  "What patterns keep showing up in my code?",
  "Read my package.json and check for issues",
];

function ToolIcon({ tool }: { tool: string }) {
  const icons: Record<string, React.ReactNode> = {
    run_security_scan: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
    ),
    get_security_scans: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
    ),
    get_reviews: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
    ),
    get_review_detail: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
    ),
    get_patterns: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
    ),
    get_repos: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
    ),
    get_usage: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20" /></svg>
    ),
    trigger_pr_review: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
    ),
    get_pr_diff: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
    ),
    create_github_issue: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
    ),
    get_file_contents: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
    ),
    generate_report: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
    ),
  };
  return <span className="text-emerald-400/60">{icons[tool] ?? icons.get_reviews}</span>;
}

function ActionPill({ action }: { action: ActionEvent }) {
  const running = action.status === "running";
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-300 ${
      running
        ? "bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/10"
        : "bg-white/[0.04] text-white/40 border border-white/[0.06]"
    }`}>
      {running ? (
        <div className="h-3 w-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
      ) : (
        <ToolIcon tool={action.tool} />
      )}
      <span>{action.label}</span>
      {!running && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400/50"><polyline points="20 6 9 17 4 12" /></svg>
      )}
    </div>
  );
}

function parseStream(raw: string): { text: string; actions: ActionEvent[] } {
  const actions: ActionEvent[] = [];
  let text = "";
  let remaining = raw;

  while (remaining.length > 0) {
    const idx = remaining.indexOf("<<ACTION>>");
    if (idx === -1) { text += remaining; break; }
    text += remaining.slice(0, idx);
    remaining = remaining.slice(idx + "<<ACTION>>".length);
    const nl = remaining.indexOf("\n");
    if (nl === -1) break;
    try {
      const action = JSON.parse(remaining.slice(0, nl)) as ActionEvent;
      const existing = actions.findIndex((a) => a.tool === action.tool && a.status === "running");
      if (action.status === "done" && existing !== -1) actions[existing] = action;
      else if (action.status === "running") actions.push(action);
    } catch { /* skip */ }
    remaining = remaining.slice(nl + 1);
  }

  return { text: text.replace(/^\n+/, ""), actions };
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ChatPage() {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchConversations();
    checkPlan();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }

  async function checkPlan() {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan ?? "free");
        if (data.plan === "free") setNeedsUpgrade(true);
      }
    } catch { /* ignore */ }
  }

  async function fetchConversations() {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) setConversations(await res.json());
    } catch { /* ignore */ }
  }

  async function loadConversation(id: string) {
    setActiveConvId(id);
    setMessages([]);
    setError(null);
    setSidebarOpen(false);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        const msgs: ChatMessage[] = (data.messages ?? []).map((m: { role: string; content: string; actions?: ActionEvent[] }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          actions: m.actions ?? undefined,
        }));
        setMessages(msgs);
      }
    } catch { /* ignore */ }
    textareaRef.current?.focus();
  }

  function startNewChat() {
    setActiveConvId(null);
    setMessages([]);
    setError(null);
    setNeedsUpgrade(plan === "free");
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }

  async function deleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) startNewChat();
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
  }

  async function archiveConversation(id: string, archived: boolean) {
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, archived } : c));
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    setMenuOpenId(null);
  }

  async function saveMessages(convId: string, msgs: ChatMessage[]) {
    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: convId, messages: msgs }),
    });
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  function retryLastMessage() {
    if (loading) return;
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const actualIdx = messages.length - 1 - lastUserIdx;
    const userMsg = messages[actualIdx];
    const truncated = messages.slice(0, actualIdx);
    setMessages(truncated);
    send(userMsg.content, truncated);
  }

  async function send(text: string, existingMessages?: ChatMessage[]) {
    if (!text.trim() || loading) return;
    setError(null);
    setNeedsUpgrade(false);

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const base = existingMessages ?? messages;
    const allMessages = [...base, userMsg];
    setMessages(allMessages);
    setInput("");
    setLoading(true);
    setSidebarOpen(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let convId = activeConvId;
      if (!convId) {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: text.trim() }] }),
          signal: controller.signal,
        });
        const data = await res.json();
        convId = data.id;
        setActiveConvId(convId);
      } else {
        await saveMessages(convId, [userMsg]);
      }

      const apiMessages = allMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.upgrade) setNeedsUpgrade(true);
        setError(err.error ?? "Something went wrong");
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setLoading(false); return; }
      const decoder = new TextDecoder();
      let accumulated = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "", actions: [] }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const parsed = parseStream(accumulated);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: parsed.text, actions: parsed.actions };
          return updated;
        });
      }

      const finalParsed = parseStream(accumulated);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: finalParsed.text,
        actions: finalParsed.actions.length > 0 ? finalParsed.actions : undefined,
      };

      if (convId) {
        await saveMessages(convId, [assistantMsg]);
      }

      fetchConversations();
      textareaRef.current?.focus();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Failed to get response");
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  const lastMsgIsAssistant = messages.length > 0 && messages[messages.length - 1].role === "assistant";
  const firstName = session?.user?.name?.split(" ")[0];
  const activeConvs = conversations.filter((c) => !c.archived);
  const archivedConvs = conversations.filter((c) => c.archived);

  return (
    <main className="flex h-[calc(100vh-65px)] lg:h-screen overflow-hidden">
      {/* Conversation sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#080808] border-r border-white/[0.04] flex flex-col transition-transform duration-300 lg:static lg:w-64 lg:shrink-0 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-3 border-b border-white/[0.04]">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-[13px] text-white/60 font-medium transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeConvs.length === 0 && archivedConvs.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-[12px] text-white/15">No conversations yet</p>
            </div>
          )}

          {activeConvs.length > 0 && (
            <div className="py-2">
              {activeConvs.map((conv) => (
                <div key={conv.id} className="group relative">
                  <button
                    onClick={() => loadConversation(conv.id)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/[0.03] transition-colors ${
                      activeConvId === conv.id ? "bg-white/[0.05]" : ""
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15 mt-0.5 shrink-0">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white/50 truncate leading-snug">{conv.title}</p>
                      <p className="text-[11px] text-white/15 mt-0.5">{relativeTime(conv.updated_at)}</p>
                    </div>
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === conv.id ? null : conv.id); }}
                    className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/[0.06] transition-all text-white/20 hover:text-white/40"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
                  </button>

                  {menuOpenId === conv.id && (
                    <div className="absolute right-2 top-10 z-10 w-36 bg-[#141414] border border-white/[0.08] rounded-xl shadow-xl overflow-hidden">
                      <button
                        onClick={() => archiveConversation(conv.id, true)}
                        className="w-full text-left px-3.5 py-2.5 text-[12px] text-white/40 hover:bg-white/[0.04] hover:text-white/60 transition-colors flex items-center gap-2"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></svg>
                        Archive
                      </button>
                      <button
                        onClick={() => { deleteConversation(conv.id); setMenuOpenId(null); }}
                        className="w-full text-left px-3.5 py-2.5 text-[12px] text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors flex items-center gap-2"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {archivedConvs.length > 0 && (
            <div className="border-t border-white/[0.04] py-2">
              <p className="px-4 py-2 text-[11px] text-white/15 uppercase tracking-widest font-medium">Archived</p>
              {archivedConvs.map((conv) => (
                <div key={conv.id} className="group relative">
                  <button
                    onClick={() => loadConversation(conv.id)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.03] transition-colors opacity-50 ${
                      activeConvId === conv.id ? "bg-white/[0.05] opacity-100" : ""
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15 shrink-0">
                      <path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" />
                    </svg>
                    <p className="text-[12px] text-white/30 truncate flex-1">{conv.title}</p>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); archiveConversation(conv.id, false); }}
                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/[0.06] transition-all text-white/20 hover:text-white/40"
                    title="Unarchive"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => { setSidebarOpen(false); setMenuOpenId(null); }} />
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-6" onClick={() => setMenuOpenId(null)}>
        <div className="pt-6 pb-3 shrink-0 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-white/30 hover:text-white/60 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-white/20 tracking-widest uppercase font-medium">Ask Lintly</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4 min-h-0">
          {messages.length === 0 && plan === "free" && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-16">
              <div className="h-16 w-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </div>
              <div className="text-center max-w-sm">
                <p className="text-[18px] text-white/70 font-semibold mb-2">AI Chat is a Pro feature</p>
                <p className="text-[14px] text-white/30 leading-relaxed mb-6">Ask Lintly anything — run security scans, review PRs, read files, create issues, and more.</p>
                <button
                  onClick={async () => {
                    const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "pro", interval: "month" }) });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  }}
                  className="bg-white text-black px-6 py-2.5 rounded-full text-[14px] font-medium hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-300"
                >
                  Upgrade to Pro — $19.99/mo
                </button>
              </div>
            </div>
          )}

          {messages.length === 0 && plan !== "free" && plan !== null && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-16">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center">
                <span className="text-emerald-400 text-2xl font-bold">L</span>
              </div>
              <div className="text-center">
                <p className="text-[16px] text-white/50 font-medium mb-1">I can do more than just chat</p>
                <p className="text-[13px] text-white/20">Run scans, review PRs, read files, create issues, generate reports</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="px-3.5 py-2.5 rounded-xl text-[13px] text-white/40 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/60 transition-all duration-200 text-left leading-snug">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""} animate-fade-in`}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-emerald-400 text-[11px] font-bold">L</span>
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                  msg.role === "user" ? "bg-white/[0.08] text-white/80" : "text-white/60"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="chat-markdown">
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {msg.actions.map((action, ai) => (
                            <ActionPill key={`${action.tool}-${ai}`} action={action} />
                          ))}
                        </div>
                      )}
                      {msg.content ? (
                        <ReactMarkdown components={{
                          p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                          strong: ({ children }) => <strong className="text-white/80 font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="text-white/50 italic">{children}</em>,
                          ul: ({ children }) => <ul className="mb-3 last:mb-0 space-y-1.5 ml-1">{children}</ul>,
                          ol: ({ children }) => <ol className="mb-3 last:mb-0 space-y-1.5 ml-1 list-decimal list-inside">{children}</ol>,
                          li: ({ children }) => <li className="flex gap-2 text-white/50"><span className="text-emerald-400/40 mt-0.5 shrink-0">•</span><span>{children}</span></li>,
                          code: ({ className, children }) => {
                            const isBlock = className?.includes("language-");
                            return isBlock ? (
                              <pre className="my-3 bg-black/40 border border-white/[0.06] rounded-xl p-4 overflow-x-auto">
                                <code className="text-[13px] font-[family-name:var(--font-geist-mono)] text-emerald-300/70">{children}</code>
                              </pre>
                            ) : (
                              <code className="text-[13px] font-[family-name:var(--font-geist-mono)] text-emerald-300/60 bg-white/[0.04] px-1.5 py-0.5 rounded-md">{children}</code>
                            );
                          },
                          pre: ({ children }) => <>{children}</>,
                          h1: ({ children }) => <h3 className="text-[16px] font-semibold text-white/70 mb-2 mt-4 first:mt-0">{children}</h3>,
                          h2: ({ children }) => <h3 className="text-[15px] font-semibold text-white/70 mb-2 mt-4 first:mt-0">{children}</h3>,
                          h3: ({ children }) => <h4 className="text-[14px] font-semibold text-white/60 mb-2 mt-3 first:mt-0">{children}</h4>,
                          blockquote: ({ children }) => <blockquote className="border-l-2 border-emerald-400/20 pl-4 my-3 text-white/40 italic">{children}</blockquote>,
                          hr: () => <hr className="border-white/[0.06] my-4" />,
                          table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full text-[13px] border-collapse">{children}</table></div>,
                          thead: ({ children }) => <thead className="border-b border-white/[0.08]">{children}</thead>,
                          th: ({ children }) => <th className="text-left py-2 px-3 text-white/50 font-medium">{children}</th>,
                          td: ({ children }) => <td className="py-2 px-3 text-white/40 border-b border-white/[0.04]">{children}</td>,
                        }}>{msg.content}</ReactMarkdown>
                      ) : loading && i === messages.length - 1 ? (
                        <div className="flex items-center gap-2">
                          {(!msg.actions || msg.actions.length === 0) && (
                            <>
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                            </>
                          )}
                        </div>
                      ) : null}
                      {loading && i === messages.length - 1 && msg.content && (
                        <span className="inline-block w-0.5 h-4 bg-emerald-400/50 animate-pulse ml-0.5 align-middle" />
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && !needsUpgrade && (
            <div className="flex justify-center mt-4 gap-2 items-center">
              <p className="text-[13px] text-red-400/70 bg-red-500/10 border border-red-500/10 rounded-xl px-4 py-2">{error}</p>
              {lastMsgIsAssistant && (
                <button
                  onClick={retryLastMessage}
                  className="text-[12px] text-white/30 hover:text-white/60 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {error && needsUpgrade && messages.length > 0 && (
            <div className="flex justify-center mt-4">
              <div className="glass rounded-2xl p-5 max-w-sm text-center">
                <p className="text-[14px] text-white/50 mb-3">{error}</p>
                <button
                  onClick={async () => {
                    const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "pro", interval: "month" }) });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  }}
                  className="bg-white text-black px-5 py-2 rounded-full text-[13px] font-medium hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all"
                >
                  Upgrade now
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        {plan !== "free" && (
          <div className="pb-6 pt-3 shrink-0">
            <div className="glass rounded-2xl flex items-end gap-3 p-3">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={firstName ? `Ask Lintly, ${firstName}...` : "Ask Lintly..."}
                className="flex-1 bg-transparent text-[14px] text-white/80 placeholder:text-white/20 outline-none px-2 resize-none max-h-40 leading-relaxed"
                disabled={loading}
              />
              <div className="flex items-center gap-1.5 shrink-0">
                {!loading && lastMsgIsAssistant && messages.length > 0 && (
                  <button
                    onClick={retryLastMessage}
                    title="Retry last message"
                    className="h-9 w-9 rounded-xl bg-white/[0.04] text-white/30 flex items-center justify-center hover:bg-white/[0.08] hover:text-white/50 transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                  </button>
                )}
                {loading ? (
                  <button
                    onClick={stopGeneration}
                    className="h-9 w-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-all shrink-0"
                    title="Stop generation"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  </button>
                ) : (
                  <button
                    onClick={() => send(input)}
                    disabled={!input.trim()}
                    className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/30 transition-all disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  </button>
                )}
              </div>
            </div>
            <p className="text-center text-[11px] text-white/10 mt-2">Shift+Enter for new line</p>
          </div>
        )}
      </div>
    </main>
  );
}
