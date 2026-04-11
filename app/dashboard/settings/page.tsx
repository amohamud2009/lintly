"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useMemo } from "react";

type Threshold = "all" | "warning" | "critical";
type ReportFrequency = "daily" | "weekly" | "biweekly" | "monthly";

const thresholds: { value: Threshold; label: string; desc: string }[] = [
  { value: "all", label: "All", desc: "Show suggestions, warnings, and critical issues" },
  { value: "warning", label: "Warning+", desc: "Only show warnings and critical issues" },
  { value: "critical", label: "Critical only", desc: "Only flag critical security and bug issues" },
];

interface SeatData {
  totalSeats: number;
  extraSeats: number;
  baseSeats: number;
  maxSeats: number;
  reviewLimit: number;
  monthlyTotal: number;
  basePrice: number;
  extraSeatPrice: number;
  billingInterval: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [threshold, setThreshold] = useState<Threshold>("all");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiCodeMode, setAiCodeMode] = useState(false);

  const [seatData, setSeatData] = useState<SeatData | null>(null);
  const [seatInput, setSeatInput] = useState(4);
  const [seatSaving, setSeatSaving] = useState(false);
  const [seatSaved, setSeatSaved] = useState(false);
  const [seatError, setSeatError] = useState("");

  const [reportEnabled, setReportEnabled] = useState(true);
  const [reportFrequency, setReportFrequency] = useState<ReportFrequency>("weekly");
  const [reportDayOfWeek, setReportDayOfWeek] = useState(1);
  const [reportDayOfMonth, setReportDayOfMonth] = useState(1);
  const [reportHour, setReportHour] = useState(8);
  const [reportMinute, setReportMinute] = useState(0);
  const [reportTimezone, setReportTimezone] = useState("America/New_York");
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const previewPrice = seatData
    ? seatData.basePrice + Math.max(0, seatInput - seatData.baseSeats) * seatData.extraSeatPrice
    : 0;
  const previewReviews = seatData
    ? (seatData.billingInterval === "year" ? 550 : 500) + Math.max(0, seatInput - seatData.baseSeats) * 125
    : 0;

  const loadSeats = useCallback(async () => {
    try {
      const res = await fetch("/api/seats");
      if (res.ok) {
        const data = await res.json();
        setSeatData(data);
        setSeatInput(data.totalSeats);
      }
    } catch { /* not a team plan */ }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setThreshold(data.severity_threshold);
          setInstructions(data.custom_instructions);
          setAiCodeMode(data.ai_code_mode ?? false);
        }
      } finally {
        setLoading(false);
      }
    }
    async function loadReport() {
      try {
        const res = await fetch("/api/report-preferences");
        if (res.ok) {
          const data = await res.json();
          setReportEnabled(data.report_enabled ?? true);
          setReportFrequency(data.report_frequency ?? "weekly");
          setReportDayOfWeek(data.report_day_of_week ?? 1);
          setReportDayOfMonth(data.report_day_of_month ?? 1);
          setReportHour(data.report_hour ?? 8);
          setReportMinute(data.report_minute ?? 0);
          setReportTimezone(data.report_timezone ?? "America/New_York");
          setShowReport(true);
        }
      } catch { /* not team */ }
    }
    if (session) {
      load();
      loadSeats();
      loadReport();
    }
  }, [session, loadSeats]);

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const frequencyLabels: Record<string, string> = { daily: "Daily", weekly: "Weekly", biweekly: "Every two weeks", monthly: "Monthly" };

  const nextReportPreview = useMemo(() => {
    if (!reportEnabled) return "Reports are paused";
    const now = new Date();
    const timeStr = `${reportHour === 0 ? 12 : reportHour > 12 ? reportHour - 12 : reportHour}:${reportMinute === 0 ? "00" : "30"} ${reportHour >= 12 ? "PM" : "AM"}`;
    const tzShort = reportTimezone.replace(/_/g, " ").split("/").pop() ?? reportTimezone;
    if (reportFrequency === "daily") return `Your next report will be sent tomorrow at ${timeStr} ${tzShort}`;
    if (reportFrequency === "weekly") return `Your next report will be sent on ${dayNames[reportDayOfWeek]} at ${timeStr} ${tzShort}`;
    if (reportFrequency === "biweekly") return `Your next report will be sent on ${dayNames[reportDayOfWeek]} (every 2 weeks) at ${timeStr} ${tzShort}`;
    if (reportFrequency === "monthly") return `Your next report will be sent on the ${reportDayOfMonth}${reportDayOfMonth === 1 ? "st" : reportDayOfMonth === 2 ? "nd" : reportDayOfMonth === 3 ? "rd" : "th"} at ${timeStr} ${tzShort}`;
    return "";
  }, [reportEnabled, reportFrequency, reportDayOfWeek, reportDayOfMonth, reportHour, reportMinute, reportTimezone]);

  async function handleReportSave() {
    setReportSaving(true);
    setReportSaved(false);
    try {
      await fetch("/api/report-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_enabled: reportEnabled,
          report_frequency: reportFrequency,
          report_day_of_week: reportDayOfWeek,
          report_day_of_month: reportDayOfMonth,
          report_hour: reportHour,
          report_minute: reportMinute,
          report_timezone: reportTimezone,
        }),
      });
      setReportSaved(true);
      setTimeout(() => setReportSaved(false), 3000);
    } finally {
      setReportSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          severity_threshold: threshold,
          custom_instructions: instructions,
          ai_code_mode: aiCodeMode,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSeatUpdate() {
    if (!seatData) return;
    setSeatSaving(true);
    setSeatSaved(false);
    setSeatError("");
    try {
      const res = await fetch("/api/seats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalSeats: seatInput }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSeatError(data.error || "Failed to update seats");
        return;
      }
      setSeatSaved(true);
      setTimeout(() => setSeatSaved(false), 3000);
      await loadSeats();
    } catch {
      setSeatError("Network error");
    } finally {
      setSeatSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-40">
        <div className="h-5 w-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <div className="animate-fade-in mb-10">
        <p className="text-[13px] text-white/20 tracking-widest uppercase mb-3 font-medium">Dashboard</p>
        <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight leading-tight">Settings</h1>
      </div>

      <div className="animate-fade-in stagger-1 space-y-8">
        {seatData && (
          <div className="glass rounded-2xl p-6">
            <h2 className="text-[15px] font-semibold text-white/80 mb-1">Team seat management</h2>
            <p className="text-[13px] text-white/30 mb-5">
              Your plan includes {seatData.baseSeats} seats and {seatData.billingInterval === "year" ? "550" : "500"} reviews/month.
              Each additional seat adds 125 reviews at ${seatData.extraSeatPrice}/seat/month.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-[12px] text-white/30 uppercase tracking-wider mb-1">Current seats</p>
                <p className="text-[24px] font-semibold text-white/80">{seatData.totalSeats}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-[12px] text-white/30 uppercase tracking-wider mb-1">Review limit</p>
                <p className="text-[24px] font-semibold text-white/80">{seatData.reviewLimit.toLocaleString()}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-[12px] text-white/30 uppercase tracking-wider mb-1">Monthly total</p>
                <p className="text-[24px] font-semibold text-white/80">${seatData.monthlyTotal.toFixed(2)}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-[12px] text-white/30 uppercase tracking-wider mb-1">Breakdown</p>
                <p className="text-[13px] text-white/50">
                  ${seatData.basePrice} base{seatData.extraSeats > 0 ? ` + ${seatData.extraSeats} × $${seatData.extraSeatPrice}` : ""}
                </p>
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-6">
              <p className="text-[14px] text-white/60 font-medium mb-3">Change seat count</p>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSeatInput(Math.max(seatData.baseSeats, seatInput - 1))}
                    className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.08] flex items-center justify-center transition-all text-[18px]"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={seatInput}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || seatData.baseSeats;
                      setSeatInput(Math.max(seatData.baseSeats, Math.min(seatData.maxSeats, v)));
                    }}
                    min={seatData.baseSeats}
                    max={seatData.maxSeats}
                    className="w-20 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-center text-[16px] font-semibold text-white/80 focus:outline-none focus:border-white/[0.12] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setSeatInput(Math.min(seatData.maxSeats, seatInput + 1))}
                    className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.08] flex items-center justify-center transition-all text-[18px]"
                  >
                    +
                  </button>
                </div>
                <span className="text-[13px] text-white/30">seats</span>
              </div>

              {seatInput > seatData.maxSeats - 5 && (
                <p className="text-[12px] text-amber-400/70 mb-3">
                  Need more than {seatData.maxSeats} seats? Contact <a href={`mailto:hello@lintly.dev`} className="underline">hello@lintly.dev</a> for Enterprise pricing.
                </p>
              )}

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-4">
                <div className="flex justify-between text-[13px] mb-2">
                  <span className="text-white/40">New monthly total</span>
                  <span className="text-white/70 font-semibold">${previewPrice.toFixed(2)}/mo</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-white/40">New review limit</span>
                  <span className="text-white/70 font-semibold">{previewReviews.toLocaleString()} reviews/mo</span>
                </div>
                {seatInput > seatData.baseSeats && (
                  <p className="text-[11px] text-white/25 mt-2">
                    ${seatData.basePrice} base + {seatInput - seatData.baseSeats} extra seat{seatInput - seatData.baseSeats > 1 ? "s" : ""} × ${seatData.extraSeatPrice}
                  </p>
                )}
              </div>

              {seatError && <p className="text-[13px] text-red-400/70 mb-3">{seatError}</p>}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSeatUpdate}
                  disabled={seatSaving || seatInput === seatData.totalSeats}
                  className="bg-white text-black px-6 py-2.5 rounded-full text-[14px] font-medium hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {seatSaving ? "Updating..." : "Update seats"}
                </button>
                {seatSaved && (
                  <span className="text-[13px] text-emerald-400/70 animate-fade-in">Seats updated</span>
                )}
              </div>
            </div>
          </div>
        )}

        {showReport && (
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-semibold text-white/80 mb-1">Team report schedule</h2>
                <p className="text-[13px] text-white/30">Configure when you receive your team code quality report</p>
              </div>
              <button
                onClick={() => setReportEnabled(!reportEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${reportEnabled ? "bg-emerald-500/60" : "bg-white/10"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${reportEnabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </button>
            </div>

            {reportEnabled && (
              <div className="space-y-5 mt-5">
                <div>
                  <label className="text-[13px] text-white/40 block mb-2">Frequency</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["daily", "weekly", "biweekly", "monthly"] as ReportFrequency[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setReportFrequency(f)}
                        className={`py-2 rounded-lg text-[13px] font-medium transition-all ${reportFrequency === f ? "bg-white/[0.08] border border-white/[0.12] text-white/80" : "border border-transparent text-white/30 hover:text-white/50 hover:bg-white/[0.02]"}`}
                      >
                        {frequencyLabels[f]}
                      </button>
                    ))}
                  </div>
                </div>

                {(reportFrequency === "weekly" || reportFrequency === "biweekly") && (
                  <div>
                    <label className="text-[13px] text-white/40 block mb-2">Day of the week</label>
                    <div className="grid grid-cols-7 gap-1">
                      {dayNames.map((d, i) => (
                        <button
                          key={d}
                          onClick={() => setReportDayOfWeek(i)}
                          className={`py-2 rounded-lg text-[12px] font-medium transition-all ${reportDayOfWeek === i ? "bg-white/[0.08] border border-white/[0.12] text-white/80" : "border border-transparent text-white/30 hover:text-white/50"}`}
                        >
                          {d.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {reportFrequency === "monthly" && (
                  <div>
                    <label className="text-[13px] text-white/40 block mb-2">Day of the month</label>
                    <div className="relative">
                      <select
                        value={reportDayOfMonth}
                        onChange={(e) => setReportDayOfMonth(Number(e.target.value))}
                        className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-[14px] text-white/70 focus:outline-none focus:border-white/[0.15] w-full cursor-pointer"
                        style={{ colorScheme: "dark" }}
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            {d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20"><polyline points="6 9 12 15 18 9" /></svg>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[13px] text-white/40 block mb-2">Time</label>
                    <div className="relative">
                      <select
                        value={`${reportHour}:${reportMinute}`}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(":").map(Number);
                          setReportHour(h);
                          setReportMinute(m);
                        }}
                        className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-[14px] text-white/70 focus:outline-none focus:border-white/[0.15] w-full cursor-pointer"
                        style={{ colorScheme: "dark" }}
                      >
                        {Array.from({ length: 48 }, (_, i) => {
                          const h = Math.floor(i / 2);
                          const m = i % 2 === 0 ? 0 : 30;
                          const label = `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${m === 0 ? "00" : "30"} ${h >= 12 ? "PM" : "AM"}`;
                          return (
                            <option key={i} value={`${h}:${m}`}>{label}</option>
                          );
                        })}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20"><polyline points="6 9 12 15 18 9" /></svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[13px] text-white/40 block mb-2">Timezone</label>
                    <div className="relative">
                      <select
                        value={reportTimezone}
                        onChange={(e) => setReportTimezone(e.target.value)}
                        className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-[14px] text-white/70 focus:outline-none focus:border-white/[0.15] w-full cursor-pointer"
                        style={{ colorScheme: "dark" }}
                      >
                        {[
                          "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
                          "America/Anchorage", "Pacific/Honolulu", "America/Toronto", "America/Vancouver",
                          "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Amsterdam",
                          "Europe/Stockholm", "Europe/Helsinki", "Europe/Istanbul",
                          "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Asia/Shanghai",
                          "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland",
                          "America/Sao_Paulo", "Africa/Cairo", "Africa/Lagos",
                        ].map((tz) => (
                          <option key={tz} value={tz}>
                            {tz.replace(/_/g, " ").split("/").pop()}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20"><polyline points="6 9 12 15 18 9" /></svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-500/[0.06] border border-emerald-500/[0.1] rounded-xl px-4 py-3">
                  <p className="text-[13px] text-emerald-400/70">{nextReportPreview}</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReportSave}
                    disabled={reportSaving}
                    className="bg-white text-black px-6 py-2.5 rounded-full text-[14px] font-medium hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-300 disabled:opacity-50"
                  >
                    {reportSaving ? "Saving..." : "Save schedule"}
                  </button>
                  {reportSaved && (
                    <span className="text-[13px] text-emerald-400/70 animate-fade-in">Schedule updated</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/[0.1] border border-violet-500/[0.15] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400">
                  <path d="M12 2a4 4 0 0 1 4 4v1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1v3l3 3v2H6v-2l3-3v-3H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2V6a4 4 0 0 1 4-4z" />
                  <circle cx="9" cy="7" r="1" fill="currentColor" />
                  <circle cx="15" cy="7" r="1" fill="currentColor" />
                </svg>
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-white/80">AI Code Mode</h2>
                <p className="text-[12px] text-white/30">Enhanced review for AI-generated code</p>
              </div>
            </div>
            <button
              onClick={() => setAiCodeMode(!aiCodeMode)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${aiCodeMode ? "bg-violet-500/60" : "bg-white/10"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${aiCodeMode ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </div>
          <p className="text-[13px] text-white/40 leading-relaxed mb-4">
            Flags hallucinated APIs, missing edge cases, security shortcuts, and patterns commonly introduced by AI tools like Copilot, Cursor, and ChatGPT.
          </p>
          {aiCodeMode && (
            <div className="bg-violet-500/[0.06] border border-violet-500/[0.1] rounded-xl px-4 py-3">
              <p className="text-[13px] text-violet-400/80">AI-specific patterns will be flagged in all future reviews</p>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-[15px] font-semibold text-white/80 mb-1">Severity threshold</h2>
          <p className="text-[13px] text-white/30 mb-5">Choose which types of issues Lintly reports on your PRs</p>
          <div className="space-y-2">
            {thresholds.map((t) => (
              <button
                key={t.value}
                onClick={() => setThreshold(t.value)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 ${
                  threshold === t.value
                    ? "bg-white/[0.06] border border-white/[0.1]"
                    : "border border-transparent hover:bg-white/[0.02]"
                }`}
              >
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  threshold === t.value ? "border-white/60" : "border-white/15"
                }`}>
                  {threshold === t.value && <div className="h-2 w-2 rounded-full bg-white/60" />}
                </div>
                <div>
                  <p className="text-[14px] font-medium text-white/70">{t.label}</p>
                  <p className="text-[12px] text-white/30">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-[15px] font-semibold text-white/80 mb-1">Custom instructions</h2>
          <p className="text-[13px] text-white/30 mb-5">Add specific instructions for the AI reviewer (e.g. &ldquo;Focus on TypeScript best practices&rdquo; or &ldquo;Ignore styling issues&rdquo;)</p>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Enter custom review instructions..."
            rows={4}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-[14px] text-white/70 placeholder-white/15 focus:outline-none focus:border-white/[0.12] resize-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-white text-black px-6 py-2.5 rounded-full text-[14px] font-medium hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-300 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {saved && (
            <span className="text-[13px] text-emerald-400/70 animate-fade-in">Saved</span>
          )}
        </div>
      </div>
    </main>
  );
}
