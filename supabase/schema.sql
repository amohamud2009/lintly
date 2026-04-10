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
  created_at timestamp default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  repo text not null,
  pr_number int not null,
  status text default 'completed',
  comments_posted int default 0,
  created_at timestamp default now()
);
