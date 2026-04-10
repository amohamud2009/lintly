"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col font-[family-name:var(--font-geist-sans)] overflow-x-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass px-6 lg:px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center text-white/90 text-xs font-semibold">
            L
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
          <button
            onClick={() => signIn("github")}
            disabled={status === "loading"}
            className="bg-white/10 hover:bg-white/[0.15] text-white/90 px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300 disabled:opacity-50 border border-white/[0.08]"
          >
            Get started
          </button>
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
            Automated code review
          </p>

          <h1 className="animate-fade-in stagger-1 text-[clamp(2.8rem,7vw,5.5rem)] font-semibold leading-[1.05] tracking-tighter max-w-3xl mb-8">
            <span className="shimmer-text">
              Every pull request,
            </span>
            <br />
            <span className="text-gradient">
              reviewed in seconds.
            </span>
          </h1>

          <p className="animate-fade-in stagger-2 text-[17px] sm:text-lg text-white/40 max-w-md mb-12 leading-relaxed">
            Lintly finds bugs, security issues, and code smells the moment you
            open a PR. Your team reviews what matters.
          </p>

          <div className="animate-fade-in stagger-3 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => signIn("github")}
              className="group relative bg-white text-black px-8 py-3.5 rounded-full text-[15px] font-medium transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)]"
            >
              <span className="relative z-10">Start free with GitHub</span>
            </button>
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
        <section id="how-it-works" className="px-6 pb-40 max-w-4xl mx-auto">
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
        <section id="features" className="px-6 pb-40">
          <div className="max-w-4xl mx-auto">
            <p className="text-[13px] text-white/20 tracking-widest uppercase text-center mb-4 font-medium">
              Capabilities
            </p>
            <h2 className="text-3xl sm:text-[42px] font-semibold tracking-tight text-center mb-24 leading-tight">
              Built for how
              <span className="text-white/30"> you already work.</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                {
                  icon: <IconCode />,
                  title: "Deep analysis",
                  desc: "Reads every line of your diff and surfaces real issues — not just lint warnings.",
                },
                {
                  icon: <IconBolt />,
                  title: "Instant feedback",
                  desc: "Reviews post as PR comments within seconds. No waiting for teammates.",
                },
                {
                  icon: <IconShield />,
                  title: "Security first",
                  desc: "Catches vulnerabilities, injection risks, and auth issues before they ship.",
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

        {/* Bottom CTA */}
        <section className="px-6 pb-40">
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
              onClick={() => signIn("github")}
              className="relative bg-white text-black px-8 py-3.5 rounded-full text-[15px] font-medium transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,255,255,0.12)]"
            >
              Get started with GitHub
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
