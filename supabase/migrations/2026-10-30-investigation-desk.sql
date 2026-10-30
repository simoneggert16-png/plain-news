-- ---------------------------------------------------------------------------
-- The tables of the investigative desk.
--
-- The code has been talking to these three tables all along
-- (lib/investigationStore.mjs), but they were never part of the schema:
-- reader wishes, the dossier list and the mail queue of the desk had
-- nothing to talk to. Run this in the Supabase SQL editor.
--
-- They hold unpublished work and reader addresses, so only the service role
-- may read or write them.
-- ---------------------------------------------------------------------------

-- What readers ask the desk to investigate.
create table if not exists public.investigation_requests (
  id bigserial primary key,
  user_id text not null,
  email text not null,
  topic text not null,
  why text,
  region text,
  hints text,
  week_key text not null,
  status text not null default 'new',
  investigation_slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists investigation_requests_week_idx
  on public.investigation_requests (week_key, status);
create index if not exists investigation_requests_email_idx
  on public.investigation_requests (email, created_at desc);

-- The state of every dossier. The bot writes it, the editor changes the
-- status, and the bot reads that decision back on its next shift.
create table if not exists public.investigations (
  slug text primary key,
  title text,
  angle text,
  category text,
  status text not null default 'pitch',
  priority integer not null default 2,
  origin text,
  request_id text,
  source_count integer not null default 0,
  verified_claims integer not null default 0,
  open_questions integer not null default 0,
  outreach_pending integer not null default 0,
  outreach_sent integer not null default 0,
  next_step text,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists investigations_status_idx
  on public.investigations (status, updated_at desc);

-- The desk's mail queue. A letter is written by the bot, approved by the
-- editor, and only then sent.
create table if not exists public.investigation_outreach (
  id bigserial primary key,
  slug text not null,
  to_email text not null,
  org text,
  contact_name text,
  subject text,
  body text,
  status text not null default 'draft',
  approved_by text,
  approved_at timestamptz,
  sent_at timestamptz,
  error text,
  reply_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists investigation_outreach_slug_idx
  on public.investigation_outreach (slug, status, created_at desc);
create index if not exists investigation_outreach_status_idx
  on public.investigation_outreach (status, created_at desc);

alter table public.investigation_requests enable row level security;
alter table public.investigations enable row level security;
alter table public.investigation_outreach enable row level security;

revoke all on public.investigation_requests from anon, authenticated;
revoke all on public.investigations from anon, authenticated;
revoke all on public.investigation_outreach from anon, authenticated;

grant all on public.investigation_requests to service_role;
grant all on public.investigations to service_role;
grant all on public.investigation_outreach to service_role;
