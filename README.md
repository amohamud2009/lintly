# Lintly

**The review layer for the AI code era.**

AI writes the code. Lintly catches the hallucinated APIs, missing edge cases, and security shortcuts before they reach production.

## What Lintly Does

Lintly is a GitHub App that automatically reviews every pull request with AI. It posts inline comments on your PR with a quality score, severity ratings, and actionable fix suggestions.

### Key Features

- **AI Code Review** — Claude-powered review on every PR, with inline comments and a quality score
- **AI Code Mode** — Flags patterns AI tools commonly get wrong: hallucinated APIs, missing null checks, overconfident error handling, hardcoded credentials
- **Security Scanner** — Real-time vulnerability detection across your codebase
- **Agentic Fix System** — One-click apply for suggested fixes, or walk-through explanations for complex issues
- **Ask Lintly Chat** — Agentic AI assistant that can run scans, review PRs, read files, and create GitHub issues
- **Team Management** — Invite members, assign roles, track PR velocity and team insights
- **Insights Dashboard** — Score trends, recurring patterns, severity breakdowns, and actionable recommendations
- **Daily Digest Emails** — Automated codebase health reports delivered to your inbox

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | NextAuth.js + GitHub OAuth |
| Database | Supabase (PostgreSQL) |
| AI | Anthropic Claude |
| Payments | Stripe (4-tier billing) |
| Background Jobs | Inngest |
| Email | Resend |

## Getting Started

### Prerequisites

- Node.js 18+
- A GitHub App (for webhook integration)
- Supabase project
- Anthropic API key
- Stripe account (for billing)

### Setup

```bash
git clone https://github.com/amohamud2009/lintly.git
cd lintly
npm install
```

Copy the environment template and fill in your keys:

```bash
cp .env.example .env.local
```

Run the database migrations in your Supabase SQL editor using `supabase/schema.sql`.

Start the dev server:

```bash
npm run dev
```

### Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `GITHUB_APP_ID` | Your GitHub App ID |
| `GITHUB_PRIVATE_KEY` | GitHub App private key (base64) |
| `GITHUB_WEBHOOK_SECRET` | Webhook signature secret |
| `NEXTAUTH_SECRET` | NextAuth encryption secret |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `ANTHROPIC_API_KEY` | Claude API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend email API key |

## Plans

| Plan | Price | Reviews | Features |
|------|-------|---------|----------|
| Free | $0 | 10/mo | Basic AI review |
| Pro | $19.99/mo | 100/mo | Security scans, chat, patterns |
| Team | $49.99/mo | 500/mo | Team management, reports, seats |
| Enterprise | Custom | Unlimited | Everything + priority support |

## Architecture

```
lintly/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/                # REST endpoints
│   │   ├── chat/           # Agentic AI chat (SSE streaming)
│   │   ├── fix/            # Apply/explain fix endpoints
│   │   ├── webhook/        # GitHub & Stripe webhooks
│   │   └── ...
│   └── dashboard/          # Dashboard pages
│       ├── chat/           # Ask Lintly chat UI
│       ├── insights/       # Analytics & insights
│       ├── repos/          # Repository management
│       ├── review/[id]/    # Review detail with comments
│       └── settings/       # Settings & team management
├── inngest/                # Background job functions
│   ├── review.ts           # PR review pipeline
│   ├── security-scan.ts    # Vulnerability scanner
│   ├── digest.ts           # Daily digest emails
│   └── patterns.ts         # Recurring pattern detection
├── lib/                    # Shared utilities
│   ├── claude.ts           # Anthropic Claude integration
│   ├── github.ts           # GitHub App + API helpers
│   ├── db.ts               # Supabase client & queries
│   ├── stripe.ts           # Stripe billing helpers
│   └── plans.ts            # Plan definitions & limits
└── supabase/               # Database schema & migrations
```

## Contributing

Open an issue or PR — Lintly will review your code automatically.

Lintly dogfoods itself — every PR to this repo is reviewed by Lintly.

## License

MIT
