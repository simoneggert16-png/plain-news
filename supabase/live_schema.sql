-- PLAIN. — Live ticker storage
--
-- Live tickers are the only content type that must appear on the site within
-- seconds (e.g. "Israel election: 62% counted"). Articles are git-based and
-- therefore only change on deploy, so ticker state lives in Supabase and the
-- page reads it per request. The bot still commits content/live/*.json as an
-- archive and as the fallback when Supabase is not configured.
--
-- Run this once in the Supabase SQL editor (it is idempotent).

create table if not exists public.live_tickers (
  slug text primary key,
  status text not null default 'live' check (status in ('live', 'ended')),
  category text not null default 'world',
  article_slug text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.live_tickers
  add column if not exists article_slug text;

create index if not exists live_tickers_status_updated_idx
  on public.live_tickers (status, updated_at desc);

create index if not exists live_tickers_article_idx
  on public.live_tickers (article_slug);

alter table public.live_tickers enable row level security;

-- Public read so the site and crawlers can fetch tickers without a key.
drop policy if exists "live tickers are public" on public.live_tickers;
create policy "live tickers are public"
  on public.live_tickers for select
  using (true);

-- Writes happen only from the newsroom bot with the service-role key, which
-- bypasses RLS. No insert/update/delete policy is granted to anon.
revoke insert, update, delete on public.live_tickers from anon, authenticated;
