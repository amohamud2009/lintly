# Lintly — Setup Checklist

Fill in every value in `.env.local` before running the app. Here's where to get each one.

---

## NextAuth

| Variable | Where to get it |
|---|---|
| `NEXTAUTH_URL` | Set to `http://localhost:3000` for local dev, or your production URL when deployed. |
| `NEXTAUTH_SECRET` | Generate by running `openssl rand -base64 32` in your terminal. |

## GitHub OAuth App

Create one at **https://github.com/settings/developers** → "New OAuth App".
Set the callback URL to `http://localhost:3000/api/auth/callback/github`.

| Variable | Where to get it |
|---|---|
| `GITHUB_CLIENT_ID` | Shown on the OAuth App page after creation at https://github.com/settings/developers. |
| `GITHUB_CLIENT_SECRET` | Click "Generate a new client secret" on the same OAuth App page. |

## GitHub App / Webhooks

Create a GitHub App at **https://github.com/settings/apps/new**.
Set the webhook URL to your ngrok URL + `/api/webhook/github`.

| Variable | Where to get it |
|---|---|
| `GITHUB_APP_TOKEN` | Generate a private key on your GitHub App page, then exchange it for an installation token. |
| `GITHUB_WEBHOOK_SECRET` | Enter any strong random string when creating the GitHub App — use `openssl rand -hex 20`. |

## Anthropic (Claude)

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | Create an API key at https://console.anthropic.com/settings/keys. |

## Supabase

Create a project at **https://supabase.com/dashboard/projects** → "New Project".
Then run `supabase/schema.sql` in the SQL Editor at **https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql/new**.

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Found at https://supabase.com/dashboard/project/YOUR_PROJECT_REF/settings/api under "Project URL". |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page, under "service_role" in the "Project API keys" section. Keep this secret. |

## Stripe

Create an account at **https://dashboard.stripe.com** and toggle to Test Mode.

| Variable | Where to get it |
|---|---|
| `STRIPE_SECRET_KEY` | Found at https://dashboard.stripe.com/test/apikeys under "Secret key". |
| `STRIPE_WEBHOOK_SECRET` | Create a webhook at https://dashboard.stripe.com/test/webhooks pointing to your ngrok URL + `/api/webhook/stripe`. The signing secret is shown after creation. |
| `STRIPE_PRICE_ID` | Create a product + price at https://dashboard.stripe.com/test/products, then copy the price ID (starts with `price_`). |

---

## Quick Start

```bash
# 1. Fill in .env.local with all the values above

# 2. Run the Supabase schema (paste into the SQL Editor in your Supabase dashboard)

# 3. Start the dev server
npm run dev

# 4. Expose to the internet for webhooks
ngrok http 3000

# 5. Update GITHUB_WEBHOOK_SECRET and Stripe webhook URLs with your ngrok URL
```
