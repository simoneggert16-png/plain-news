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

-- ---------------------------------------------------------------------------
-- Visitor log (/[locale]/admin/visits)
-- Only written by the Next.js middleware via the service-role key.
-- No policies => anon/authenticated cannot read or write.
-- ---------------------------------------------------------------------------
create table if not exists public.visits (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  ip text,
  ip_masked text,
  ip_hash text,
  country text,
  region text,
  city text,
  path text,
  referrer text,
  ua text
);

create index if not exists visits_ts_idx on public.visits (ts desc);
create index if not exists visits_hash_idx on public.visits (ip_hash, ts desc);
create index if not exists visits_country_idx on public.visits (country, ts desc);

alter table public.visits enable row level security;
revoke all on public.visits from anon, authenticated;
grant all on public.visits to service_role;

-- ---------------------------------------------------------------------------
-- Editorial content mirror (read by the website, written by
-- scripts/sync-content.mjs with the service-role key).
-- Keeps ~25 MB of article JSON out of every Vercel deployment.
-- Content is public by definition, so anon may SELECT; writes stay service-role.
-- ---------------------------------------------------------------------------
create table if not exists public.articles (
  slug text primary key,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  data jsonb not null
);

create index if not exists articles_published_idx on public.articles (published_at desc);

create table if not exists public.content_blobs (
  key text primary key,
  updated_at timestamptz not null default now(),
  data jsonb not null
);

alter table public.articles enable row level security;
alter table public.content_blobs enable row level security;

revoke all on public.articles from anon, authenticated;
revoke all on public.content_blobs from anon, authenticated;

grant select on public.articles to anon;
grant select on public.content_blobs to anon;
grant all on public.articles to service_role;
grant all on public.content_blobs to service_role;

drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles for select using (true);

drop policy if exists content_blobs_public_read on public.content_blobs;
create policy content_blobs_public_read on public.content_blobs for select using (true);
