-- Inbox for the investigative desk (see supabase/schema.sql for the rationale).
create table if not exists public.investigation_messages (
  id bigserial primary key,
  slug text,
  direction text not null default 'in',
  from_email text not null,
  to_email text,
  subject text,
  body text,
  message_id text,
  in_reply_to text,
  status text not null default 'new',
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists investigation_messages_slug_idx
  on public.investigation_messages (slug, status, received_at desc);
create index if not exists investigation_messages_sender_idx
  on public.investigation_messages (from_email, received_at desc);

alter table public.investigation_messages enable row level security;
revoke all on public.investigation_messages from anon, authenticated;
grant all on public.investigation_messages to service_role;
