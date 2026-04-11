"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, className: visible ? "animate-fade-in" : "scroll-hidden" };
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen(!open)} className="w-full text-left glass rounded-xl p-5 transition-all duration-300 hover:bg-white/[0.02]">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[15px] font-medium text-white/70">{q}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          className={`text-white/20 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-40 mt-3" : "max-h-0"}`}>
        <p className="text-[14px] text-white/35 leading-relaxed">{a}</p>
      </div>
    </button>
  );
}

function IconCode() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const faqs = [
  { q: "Does Lintly work with AI-generated code?", a: "Yes — it's built for it. Enable AI Code Mode in your settings and Lintly applies targeted scrutiny to patterns AI models commonly get wrong: hallucinated APIs, overconfident error handling, missing edge cases, and security shortcuts. It flags these as 'AI Risk' so your team knows exactly what to double-check." },
  { q: "How does Lintly access my code?", a: "Lintly installs as a GitHub App with read-only access to your pull request diffs. We never clone your repo or store your source code." },
  { q: "What languages does Lintly support?", a: "Lintly reviews any language — JavaScript, TypeScript, Python, Go, Rust, Java, and more. It understands code context, not just syntax." },
  { q: "Can I customize what Lintly looks for?", a: "Yes. On Pro and above, you can set a severity threshold and add custom instructions. For example, tell Lintly to focus on TypeScript best practices or ignore styling issues." },
  { q: "How fast are the reviews?", a: "Most reviews complete in under 15 seconds. Lintly posts inline comments directly on your PR as soon as the analysis finishes." },
  { q: "What happens when I hit the free limit?", a: "Lintly posts a friendly message on your PR letting you know you've reached the limit, with a one-click link to upgrade." },
  { q: "Can I use Lintly for private repos?", a: "Private repository support is available on all paid plans starting at $19.99/month." },
  { q: "Is there a discount for annual billing?", a: "Yes — save 20% when you choose yearly billing on Pro or Team plans." },
];

const trustLogos = ["Vercel", "Supabase", "Linear", "Railway", "Resend"];

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className ?? "text-white/20 shrink-0"}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PricingSection({ isSignedIn, sectionRef, className, router }: {
  isSignedIn: boolean;
  sectionRef: React.Ref<HTMLDivElement>;
  className: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [yearly, setYearly] = useState(false);

  async function handleCheckout(plan: string, interval: string) {
    if (!isSignedIn) { signIn("github"); return; }
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, interval }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  return (
    <div id="pricing" ref={sectionRef} className={`px-6 pb-40 ${className}`}>
      <div className="max-w-6xl mx-auto">
        <p className="text-[13px] text-white/20 tracking-widest uppercase text-center mb-4 font-medium">
          Pricing
        </p>
        <h2 className="text-3xl sm:text-[42px] font-semibold tracking-tight text-center mb-10 leading-tight">
          Simple,
          <span className="text-white/30"> transparent pricing.</span>
        </h2>

        {/* Monthly / Yearly toggle */}
        <div className="flex items-center justify-center gap-3 mb-16">
          <span className={`text-[14px] font-medium transition-colors ${!yearly ? "text-white/80" : "text-white/30"}`}>Monthly</span>
          <button
            onClick={() => setYearly(!yearly)}
            className="relative h-7 w-12 rounded-full bg-white/[0.08] border border-white/[0.06] transition-colors"
          >
            <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all duration-300 ${yearly ? "left-[22px]" : "left-0.5"}`} />
          </button>
          <span className={`text-[14px] font-medium transition-colors ${yearly ? "text-white/80" : "text-white/30"}`}>Yearly</span>
          {yearly && <span className="text-[12px] text-emerald-400/70 font-medium ml-1">Save 20%</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Free */}
          <div className="glass rounded-2xl p-7 flex flex-col">
            <p className="text-[13px] text-white/30 tracking-widest uppercase font-medium mb-2">Free</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[42px] font-semibold tracking-tight leading-none text-white/90">$0</span>
            </div>
            <p className="text-[13px] text-white/20 mb-1">No credit card required</p>
            <p className="text-[14px] text-white/30 mb-7">For individual developers</p>
            <ul className="space-y-2.5 text-[13px] text-white/50 mb-8 flex-1">
              {["10 reviews / month", "1 seat", "Public repos only", "Inline PR comments", "Quality score", "No security scans", "No daily digest", "No AI chat"].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckIcon className={`shrink-0 ${item.startsWith("No") ? "text-white/10" : "text-white/20"}`} />
                  <span className={item.startsWith("No") ? "text-white/20" : ""}>{item}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => isSignedIn ? router.push("/dashboard") : signIn("github")}
              className="w-full py-2.5 rounded-full text-[13px] font-medium border border-white/[0.08] text-white/60 hover:bg-white/[0.04] hover:text-white/80 transition-all duration-300"
            >
              {isSignedIn ? "Current plan" : "Start free"}
            </button>
          </div>

          {/* Pro */}
          <div className="glass-strong rounded-2xl p-7 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[13px] text-white/30 tracking-widest uppercase font-medium">Pro</p>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider uppercase bg-white/10 text-white/60 border border-white/[0.08]">Most popular</span>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              {yearly ? (
                <>
                  <span className="text-[42px] font-semibold tracking-tight leading-none text-white/90">$191.99</span>
                  <span className="text-[14px] text-white/20">/year</span>
                </>
              ) : (
                <>
                  <span className="text-[42px] font-semibold tracking-tight leading-none text-white/90">$19.99</span>
                  <span className="text-[14px] text-white/20">/month</span>
                </>
              )}
            </div>
            {yearly && (
              <p className="text-[12px] text-emerald-400/60 mb-1">
                Instead of $239.88 — saving $47.89 (20% off)
              </p>
            )}
            <p className="text-[14px] text-white/30 mb-7">For developers shipping production code</p>
            <ul className="space-y-2.5 text-[13px] text-white/50 mb-8 flex-1">
              {["200 reviews / month", "1 seat", "Public + private repos", "100 security scans / month", "50 daily digest emails", "100 AI chat messages", "Custom review instructions"].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckIcon className="text-emerald-400/50 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout("pro", yearly ? "year" : "month")}
              className="w-full py-2.5 rounded-full text-[13px] font-medium bg-white text-black hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-300"
            >
              Upgrade to Pro
            </button>
          </div>

          {/* Team */}
          <div className="glass rounded-2xl p-7 flex flex-col">
            <p className="text-[13px] text-white/30 tracking-widest uppercase font-medium mb-2">Team</p>
            <div className="flex items-baseline gap-1 mb-1">
              {yearly ? (
                <>
                  <span className="text-[42px] font-semibold tracking-tight leading-none text-white/90">$479.99</span>
                  <span className="text-[14px] text-white/20">/year</span>
                </>
              ) : (
                <>
                  <span className="text-[42px] font-semibold tracking-tight leading-none text-white/90">$49.99</span>
                  <span className="text-[14px] text-white/20">/month</span>
                </>
              )}
            </div>
            {yearly ? (
              <p className="text-[12px] text-emerald-400/60 mb-1">
                Pay $479.99/year instead of $599.88 — you are saving $119.89 which is 20% off
              </p>
            ) : (
              <p className="text-[12px] text-white/25 mb-1">For up to 4 seats &amp; 500 reviews</p>
            )}
            <p className="text-[14px] text-white/30 mb-4">For teams that ship together</p>
            <p className="text-[12px] text-white/40 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 mb-5">
              Need more teammates? Add seats at <span className="text-white/60 font-medium">$12.99/seat</span> — each seat adds 125 reviews
            </p>
            <ul className="space-y-2.5 text-[13px] text-white/50 mb-8 flex-1">
              {[
                yearly ? "550 reviews / month (annual bonus)" : "500 reviews / month",
                "Up to 4 seats included",
                ...(yearly ? ["Yearly members get 550 reviews instead of 500"] : []),
                "200 security scans / month",
                "50 daily digest emails",
                "200 AI chat messages",
                "Everything in Pro",
                "Priority support",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckIcon className="text-emerald-400/50 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout("team", yearly ? "year" : "month")}
              className="w-full py-2.5 rounded-full text-[13px] font-medium border border-white/[0.08] text-white/60 hover:bg-white/[0.04] hover:text-white/80 transition-all duration-300"
            >
              Upgrade to Team
            </button>
          </div>

          {/* Enterprise */}
          <div className="glass rounded-2xl p-7 flex flex-col">
            <p className="text-[13px] text-white/30 tracking-widest uppercase font-medium mb-2">Enterprise</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[42px] font-semibold tracking-tight leading-none text-white/90">Custom</span>
            </div>
            <p className="text-[13px] text-white/20 mb-1">Tailored to your organization</p>
            <p className="text-[14px] text-white/30 mb-7">For large teams with custom needs</p>
            <ul className="space-y-2.5 text-[13px] text-white/50 mb-8 flex-1">
              {["Unlimited reviews", "Unlimited seats", "Custom integrations", "Dedicated onboarding", "SLA and support"].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckIcon className="text-emerald-400/50 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="mailto:hello@lintly.dev"
              className="w-full py-2.5 rounded-full text-[13px] font-medium border border-white/[0.08] text-white/60 hover:bg-white/[0.04] hover:text-white/80 transition-all duration-300 text-center block"
            >
              Email us
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isSignedIn = status === "authenticated" && !!session;

  const howItWorks = useScrollReveal();
  const features = useScrollReveal();
  const trust = useScrollReveal();
  const pricing = useScrollReveal();
  const faqSection = useScrollReveal();
  const bottomCta = useScrollReveal();

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col font-[family-name:var(--font-geist-sans)] overflow-x-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass px-6 lg:px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/[0.12] border border-emerald-500/[0.15] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v6c0 5.25 3.75 9.74 9 11 5.25-1.26 9-5.75 9-11V7l-9-5z" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400/80" fill="none" />
              <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400" />
            </svg>
          </div>
          <span className="text-[15px] font-medium tracking-tight text-white/90">
            Lintly
          </span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="#how-it-works"
            className="text-[13px] text-white/40 hover:text-white/80 transition-colors duration-300 hidden sm:block"
          >
            How it works
          </a>
          <a
            href="#features"
            className="text-[13px] text-white/40 hover:text-white/80 transition-colors duration-300 hidden sm:block"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="text-[13px] text-white/40 hover:text-white/80 transition-colors duration-300 hidden sm:block"
          >
            Pricing
          </a>
          {isSignedIn ? (
            <div className="flex items-center gap-3">
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              )}
              <button
                onClick={() => router.push("/dashboard")}
                className="bg-white text-black px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Dashboard
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-[13px] text-white/30 hover:text-white/60 transition-colors duration-300"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("github")}
              disabled={status === "loading"}
              className="bg-white/10 hover:bg-white/[0.15] text-white/90 px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300 disabled:opacity-50 border border-white/[0.08]"
            >
              Get started
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none">
          <div className="absolute inset-0 bg-gradient-radial from-white/[0.03] to-transparent rounded-full blur-3xl animate-glow-pulse" />
        </div>

        {/* Hero */}
        <section className="relative flex flex-col items-center text-center px-6 pt-32 sm:pt-44 pb-20">
          <p className="animate-fade-in text-[13px] text-white/30 tracking-widest uppercase mb-8 font-medium">
            The review layer for the AI code era
          </p>

          <h1 className="animate-fade-in stagger-1 text-[clamp(2.8rem,7vw,5.5rem)] font-semibold leading-[1.05] tracking-tighter max-w-3xl mb-8">
            <span className="shimmer-text">
              AI writes the code.
            </span>
            <br />
            <span className="text-gradient">
              Lintly makes sure it ships.
            </span>
          </h1>

          <p className="animate-fade-in stagger-2 text-[17px] sm:text-lg text-white/40 max-w-xl mb-12 leading-relaxed">
            Every AI tool writes confident code. Lintly catches the hallucinated APIs,
            the missing edge cases, and the security shortcuts before they reach production.
          </p>

          <div className="animate-fade-in stagger-3 flex flex-col sm:flex-row gap-3">
            {isSignedIn ? (
              <button
                onClick={() => router.push("/dashboard")}
                className="group relative bg-white text-black px-8 py-3.5 rounded-full text-[15px] font-medium transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)]"
              >
                <span className="relative z-10">Go to Dashboard</span>
              </button>
            ) : (
              <button
                onClick={() => signIn("github")}
                className="group relative bg-white text-black px-8 py-3.5 rounded-full text-[15px] font-medium transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)]"
              >
                <span className="relative z-10">Start free with GitHub</span>
              </button>
            )}
            <a
              href="#how-it-works"
              className="text-white/50 hover:text-white/80 px-8 py-3.5 rounded-full text-[15px] font-medium transition-all duration-300 border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.03]"
            >
              See how it works
            </a>
          </div>
        </section>

        {/* Social proof */}
        <section className="animate-fade-in stagger-4 flex justify-center px-6 pb-32">
          <div className="glass rounded-full px-6 py-2.5 flex items-center gap-3">
            <div className="flex -space-x-2">
              {["A", "S", "J", "M", "D"].map((letter, i) => (
                <div
                  key={letter}
                  className="h-6 w-6 rounded-full bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-[10px] text-white/40 font-medium"
                  style={{ zIndex: 5 - i }}
                >
                  {letter}
                </div>
              ))}
            </div>
            <div className="h-3 w-px bg-white/10" />
            <p className="text-[13px] text-white/30">
              Reviewing PRs across 200+ repos
            </p>
          </div>
        </section>

        {/* Live Demo */}
        <section className="animate-fade-in stagger-5 px-6 pb-40">
          <div className="max-w-2xl mx-auto">
            <div className="glass-strong rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(255,255,255,0.02)]">
              {/* Header bar */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
                </div>
                <span className="text-[12px] text-white/20 font-mono ml-2">
                  pull request #142 — review
                </span>
              </div>
              {/* Comment */}
              <div className="px-6 py-5">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-white/[0.06] flex items-center justify-center text-white/50 text-[11px] font-semibold shrink-0 mt-0.5">
                    L
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[13px] font-semibold text-white/70">
                        lintly-bot
                      </span>
                      <span className="text-[11px] text-white/20">
                        just now
                      </span>
                      <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-red-500/10 text-red-400/80 border border-red-500/10">
                        Critical
                      </span>
                    </div>
                    <p className="text-[14px] text-white/50 leading-relaxed mb-4">
                      <span className="text-white/80 font-medium">
                        SQL injection vulnerability.
                      </span>{" "}
                      User input is interpolated directly into the query string.
                      Use parameterized queries instead.
                    </p>
                    <div className="bg-black/40 rounded-xl px-5 py-4 font-[family-name:var(--font-geist-mono)] text-[13px] leading-loose border border-white/[0.04]">
                      <div className="text-red-400/60">
                        <span className="text-white/20 select-none mr-3">
                          7
                        </span>
                        {"- "}const query = {"`"}SELECT * FROM users WHERE id ={" "}
                        {"${id}"}{"`"};
                      </div>
                      <div className="text-emerald-400/60">
                        <span className="text-white/20 select-none mr-3">
                          7
                        </span>
                        {"+ "}const query = {"`"}SELECT * FROM users WHERE id ={" "}
                        $1{"`"};
                      </div>
                      <div className="text-emerald-400/60">
                        <span className="text-white/20 select-none mr-3">
                          8
                        </span>
                        {"+ "}return db.execute(query, [id]);
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" ref={howItWorks.ref} className={`px-6 pb-40 max-w-4xl mx-auto ${howItWorks.className}`}>
          <p className="text-[13px] text-white/20 tracking-widest uppercase text-center mb-4 font-medium">
            How it works
          </p>
          <h2 className="text-3xl sm:text-[42px] font-semibold tracking-tight text-center mb-24 leading-tight">
            Three steps.
            <span className="text-white/30"> Zero config.</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/[0.04] rounded-2xl overflow-hidden">
            {[
              {
                num: "01",
                title: "Install on your repo",
                desc: "Add the Lintly GitHub App to any repository. Two clicks, no config files.",
              },
              {
                num: "02",
                title: "Open a pull request",
                desc: "Push code and open a PR like you normally would. Lintly picks it up automatically.",
              },
              {
                num: "03",
                title: "Get your review",
                desc: "Inline comments and a quality score appear directly on the PR within seconds.",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="bg-[#000000] p-8 sm:p-10 group hover:bg-white/[0.02] transition-colors duration-500"
              >
                <div className="text-[56px] font-bold leading-none text-white/[0.06] mb-6 font-[family-name:var(--font-geist-mono)] group-hover:text-white/[0.1] transition-colors duration-500">
                  {step.num}
                </div>
                <h3 className="text-[17px] font-semibold text-white/80 mb-3">
                  {step.title}
                </h3>
                <p className="text-[15px] text-white/30 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" ref={features.ref} className={`px-6 pb-40 ${features.className}`}>
          <div className="max-w-5xl mx-auto">
            <p className="text-[13px] text-white/20 tracking-widest uppercase text-center mb-4 font-medium">
              Capabilities
            </p>
            <h2 className="text-3xl sm:text-[42px] font-semibold tracking-tight text-center mb-24 leading-tight">
              The last line of defense
              <span className="text-white/30"> for AI-generated code.</span>
            </h2>

            {/* Hero feature — full width */}
            <div className="glass-strong rounded-2xl p-8 sm:p-10 mb-5 group hover:bg-white/[0.04] transition-all duration-500 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/20 to-transparent" />
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="h-12 w-12 rounded-xl bg-violet-500/[0.08] border border-violet-500/[0.1] flex items-center justify-center text-violet-400/60 shrink-0 group-hover:text-violet-400/80 transition-all duration-500">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2a4 4 0 0 1 4 4v1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1v3l3 3v2H6v-2l3-3v-3H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2V6a4 4 0 0 1 4-4z" />
                    <circle cx="9" cy="7" r="1" fill="currentColor" />
                    <circle cx="15" cy="7" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[20px] font-semibold text-white/80 mb-2">
                    Built for AI-generated code
                  </h3>
                  <p className="text-[15px] text-white/40 leading-relaxed max-w-2xl">
                    AI assistants write plausible code that compiles and passes tests — but misses edge cases, hallucinates APIs, and takes security shortcuts. Lintly&apos;s AI Code Mode applies targeted scrutiny to the patterns AI models get wrong.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[
                {
                  icon: <IconShield />,
                  title: "Real-time security scanning",
                  desc: "Catches exposed secrets, SQL injection, and vulnerabilities on every push — especially critical when AI tools generate code with training-data credentials or disabled security.",
                },
                {
                  icon: <IconBolt />,
                  title: "Daily health digest",
                  desc: "Every morning get a summary of your codebase health, score trends, and issues found delivered to your inbox.",
                },
                {
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  ),
                  title: "AI codebase chat",
                  desc: "Ask Lintly anything about your codebase. It knows your patterns, your history, and where your risks are.",
                },
                {
                  icon: <IconCode />,
                  title: "Team insights",
                  desc: "Track PR velocity, score trends, and recurring issues across your whole team — enforce consistency across Cursor, Copilot, and Claude outputs.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="glass rounded-2xl p-7 group hover:bg-white/[0.04] transition-all duration-500"
                >
                  <div className="h-10 w-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-white/30 mb-6 group-hover:text-white/50 group-hover:bg-white/[0.06] transition-all duration-500">
                    {feature.icon}
                  </div>
                  <h3 className="text-[17px] font-semibold text-white/80 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-[15px] text-white/30 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust logos */}
        <section ref={trust.ref} className={`px-6 pb-40 ${trust.className}`}>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[13px] text-white/15 tracking-widest uppercase mb-8 font-medium">
              Trusted by developers at
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {trustLogos.map((name) => (
                <span key={name} className="text-[15px] font-medium text-white/10 tracking-wide">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <PricingSection isSignedIn={isSignedIn} sectionRef={pricing.ref} className={pricing.className} router={router} />

        {/* FAQ */}
        <section ref={faqSection.ref} className={`px-6 pb-40 ${faqSection.className}`}>
          <div className="max-w-2xl mx-auto">
            <p className="text-[13px] text-white/20 tracking-widest uppercase text-center mb-4 font-medium">
              FAQ
            </p>
            <h2 className="text-3xl sm:text-[42px] font-semibold tracking-tight text-center mb-16 leading-tight">
              Got questions?
            </h2>
            <div className="space-y-3">
              {faqs.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section ref={bottomCta.ref} className={`px-6 pb-40 ${bottomCta.className}`}>
          <div className="max-w-xl mx-auto text-center relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-white/[0.02] rounded-full blur-[100px] pointer-events-none" />
            <h2 className="relative text-3xl sm:text-[44px] font-semibold tracking-tight leading-[1.1] mb-5">
              Start reviewing
              <br />
              smarter today.
            </h2>
            <p className="relative text-[17px] text-white/30 mb-10 leading-relaxed">
              Free for open source. Set up in under a minute.
            </p>
            <button
              onClick={() =>
                isSignedIn ? router.push("/dashboard") : signIn("github")
              }
              className="relative bg-white text-black px-8 py-3.5 rounded-full text-[15px] font-medium transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,255,255,0.12)]"
            >
              {isSignedIn ? "Go to Dashboard" : "Get started with GitHub"}
            </button>
          </div>
        </section>
      </main>

      <footer className="glass px-6 lg:px-10 py-5 flex items-center justify-between">
        <span className="text-[12px] text-white/20">
          &copy; {new Date().getFullYear()} Lintly
        </span>
        <div className="flex gap-5">
          <a
            href="#"
            className="text-[12px] text-white/20 hover:text-white/40 transition-colors duration-300"
          >
            Privacy
          </a>
          <a
            href="#"
            className="text-[12px] text-white/20 hover:text-white/40 transition-colors duration-300"
          >
            Terms
          </a>
        </div>
      </footer>
    </div>
  );
}
