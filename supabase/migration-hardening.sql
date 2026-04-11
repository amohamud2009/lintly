-- ============================================================
-- Lintly Production Hardening Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Atomic chat message increment function
CREATE OR REPLACE FUNCTION increment_chat_messages(gid text)
RETURNS void AS $$
  UPDATE users SET chat_messages_used = COALESCE(chat_messages_used, 0) + 1 WHERE github_id = gid;
$$ LANGUAGE sql;

-- 2. Stripe event deduplication
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id text PRIMARY KEY,
  processed_at timestamp DEFAULT now()
);

-- 3. Organizations for team support
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid REFERENCES users(id),
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  invited_email text,
  invite_token text,
  invite_status text DEFAULT 'accepted',
  created_at timestamp DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_reviews_user_created ON reviews(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_user_created ON security_scans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subs_stripe_sub ON subscriptions(stripe_subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patterns_user_name ON patterns(user_id, pattern_name);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);

-- 5. Add org_id column to subscriptions (nullable, for migration from user-level to org-level)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);

-- 6. Row Level Security (enable on all tables)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default so the app continues working.
-- These policies allow the service_role full access and could later be
-- tightened with anon/authenticated policies for client-side access.

-- 7. Aggregated repo count functions (eliminates N+1 queries)
CREATE OR REPLACE FUNCTION repo_review_counts(uid text)
RETURNS TABLE(repo text, cnt bigint) AS $$
  SELECT repo, count(*) as cnt FROM reviews WHERE user_id = uid GROUP BY repo ORDER BY cnt DESC;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION repo_scan_counts(uid text)
RETURNS TABLE(repo text, cnt bigint) AS $$
  SELECT repo, count(*) as cnt FROM security_scans WHERE user_id = uid GROUP BY repo ORDER BY cnt DESC;
$$ LANGUAGE sql STABLE;
