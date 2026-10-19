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
