create table users (
  id uuid primary key default gen_random_uuid(),
  github_id text unique not null,
  email text,
  name text,
  avatar_url text,
  created_at timestamp default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text default 'free',
  status text default 'active',
  billing_interval text default 'month',
  extra_seats int default 0,
  created_at timestamp default now()
);

create table user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null,
  severity_threshold text default 'all',
  custom_instructions text default '',
  ai_code_mode boolean default false,
  report_enabled boolean default true,
  report_frequency text default 'weekly',
  report_day_of_week int default 1,
  report_day_of_month int default 1,
  report_hour int default 8,
  report_minute int default 0,
  report_timezone text default 'America/New_York',
  report_last_sent_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  repo text not null,
  pr_number int not null,
  status text default 'completed',
  comments_posted int default 0,
  score int,
  summary text,
  ai_comments jsonb,
  pr_author text,
  created_at timestamp default now()
);

create table security_scans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  repo text not null,
  commit_sha text,
  branch text,
  issues_found int default 0,
  scan_results jsonb default '[]',
  created_at timestamp default now()
);

create table patterns (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  pattern_name text,
  description text,
  recommendation text,
  occurrence_count int default 1,
  dismissed boolean default false,
  detected_at timestamp default now()
);

create table chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text default 'New chat',
  archived boolean default false,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references chat_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  actions jsonb,
  created_at timestamp default now()
);

create index idx_chat_conversations_user on chat_conversations(user_id, updated_at desc);
create index idx_chat_messages_conv on chat_messages(conversation_id, created_at asc);

-- Migration SQL (run in Supabase SQL Editor if tables already exist):
-- ALTER TABLE reviews ADD COLUMN IF NOT EXISTS pr_author text;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_enabled boolean DEFAULT true;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS unsubscribe_token text;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_messages_used int DEFAULT 0;

-- Atomic increment function for chat messages (avoids race condition)
CREATE OR REPLACE FUNCTION increment_chat_messages(gid text)
RETURNS void AS $$
  UPDATE users SET chat_messages_used = COALESCE(chat_messages_used, 0) + 1 WHERE github_id = gid;
$$ LANGUAGE sql;

-- Stripe event deduplication table
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id text PRIMARY KEY,
  processed_at timestamp DEFAULT now()
);

-- Organizations for team support
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

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_reviews_user_created ON reviews(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_user_created ON security_scans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subs_stripe_sub ON subscriptions(stripe_subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patterns_user_name ON patterns(user_id, pattern_name);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);
