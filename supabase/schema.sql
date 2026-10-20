create table if not exists public.newsletter_subscribers (
  email text primary key,
  locale text not null default 'de',
  topics jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  last_sent_at timestamptz
);

alter table public.newsletter_subscribers enable row level security;

revoke all on public.newsletter_subscribers from anon, authenticated;

create table if not exists public.community_comments (
  id text primary key,
  article_slug text not null,
  author text not null,
  content text not null,
  parent_id text,
  created_at timestamptz not null default now(),
  verified boolean not null default true
);

alter table public.community_comments
  add column if not exists parent_id text;

create index if not exists community_comments_article_created_idx
  on public.community_comments (article_slug, created_at desc);

create index if not exists community_comments_parent_created_idx
  on public.community_comments (parent_id, created_at asc)
  where parent_id is not null;

create table if not exists public.community_submissions (
  id text primary key,
  title text not null,
  source_url text not null,
  summary text not null,
  author text not null,
  created_at timestamptz not null default now(),
  verified boolean not null default true
);

create index if not exists community_submissions_created_idx
  on public.community_submissions (created_at desc);

create table if not exists public.community_chat_messages (
  id text primary key,
  username text not null,
  content text not null,
  created_at timestamptz not null default now(),
  verified boolean not null default true
);

create index if not exists community_chat_created_idx
  on public.community_chat_messages (created_at desc);

alter table public.community_comments enable row level security;
alter table public.community_submissions enable row level security;
alter table public.community_chat_messages enable row level security;

revoke all on public.community_comments from anon, authenticated;
revoke all on public.community_submissions from anon, authenticated;
revoke all on public.community_chat_messages from anon, authenticated;
grant all on public.community_comments to service_role;
grant all on public.community_submissions to service_role;
grant all on public.community_chat_messages to service_role;
