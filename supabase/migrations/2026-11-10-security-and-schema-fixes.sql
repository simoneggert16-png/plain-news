-- ---------------------------------------------------------------------------
-- 2026-11-10: Security & Schema Fixes
--
-- 1. Add missing optional visitor-metadata columns on community_comments so
--    server-side abuse tracking works without PGRST204 schema errors.
-- 2. Harden public.search_articles(q, lim) by capping q to 120 chars and
--    escaping LIKE wildcards (%, _, \) to prevent CPU timeout DoS.
-- 3. Index investigation_outreach(to_email, sent_at desc) for inbound thread
--    matching when press offices reply without +slug subaddressing.
-- ---------------------------------------------------------------------------

alter table public.community_comments
  add column if not exists ip text,
  add column if not exists ip_masked text,
  add column if not exists ip_hash text,
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists ua text;

alter table public.articles
  add column if not exists search_text text;

create or replace function public.search_articles(q text, lim integer default 40)
returns table (slug text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_clean text := lower(left(trim(coalesce(q, '')), 120));
  v_escaped text;
  v_limit integer := greatest(1, least(coalesce(lim, 40), 100));
begin
  if length(v_clean) < 2 then
    return;
  end if;

  v_escaped := replace(replace(replace(v_clean, '\', '\\'), '%', '\%'), '_', '\_');

  return query
    select a.slug
    from public.articles a
    where a.search_text like '%' || v_escaped || '%' escape '\'
    order by a.published_at desc nulls last
    limit v_limit;
end;
$$;

grant execute on function public.search_articles(text, integer) to anon, authenticated, service_role;

do $$
begin
  if to_regclass('public.investigation_outreach') is not null then
    execute 'create index if not exists investigation_outreach_to_email_idx on public.investigation_outreach (to_email, sent_at desc)';
  end if;
end
$$;
