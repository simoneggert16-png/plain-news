-- ---------------------------------------------------------------------------
-- Article search.
--
-- The site used to scan every article file for a search term. That works, but
-- it reads the whole archive on every keystroke. This adds the text of an
-- article to the database with a trigram index and a function the site can
-- call: rpc/search_articles {q, lim}.
--
-- The text is filled by a trigger, so the mirror in scripts/sync-content.mjs
-- does not have to know about it.
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm;

-- Every string inside a jsonb value, joined by spaces. The article payload
-- holds the same fields in nine languages, and their names differ, so the
-- text is collected by walking the structure instead of naming every field.
create or replace function public.jsonb_flatten(p_value jsonb)
returns text
language plpgsql
immutable
as $$
declare
  parts text[] := '{}';
  item jsonb;
begin
  case jsonb_typeof(p_value)
    when 'string' then
      return p_value #>> '{}';
    when 'object' then
      for item in select value from jsonb_each(p_value) loop
        parts := parts || public.jsonb_flatten(item);
      end loop;
    when 'array' then
      for item in select value from jsonb_array_elements(p_value) loop
        parts := parts || public.jsonb_flatten(item);
      end loop;
    else
      return '';
  end case;
  return array_to_string(parts, ' ');
end;
$$;

create or replace function public.article_search_text(p_data jsonb)
returns text
language sql
stable
as $$
  select lower(
    coalesce(public.jsonb_flatten(p_data->'locales'), '') || ' ' ||
    coalesce(p_data->>'category', '') || ' ' ||
    coalesce(p_data->>'slug', '')
  );
$$;

alter table public.articles
  add column if not exists search_text text;

create or replace function public.articles_search_text_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_text := public.article_search_text(new.data);
  return new;
end;
$$;

drop trigger if exists articles_search_text_trg on public.articles;
create trigger articles_search_text_trg
  before insert or update of data on public.articles
  for each row execute function public.articles_search_text_trigger();

-- The rows that are already there.
update public.articles
set search_text = public.article_search_text(data)
where search_text is null;

create index if not exists articles_search_trgm
  on public.articles using gin (search_text gin_trgm_ops);

-- The function the site calls: rpc/search_articles with {q, lim}.
create or replace function public.search_articles(q text, lim integer default 40)
returns table (slug text)
language sql
stable
security definer
set search_path = public
as $$
  select a.slug
  from public.articles a
  where a.search_text like '%' || lower(q) || '%'
  order by a.published_at desc nulls last
  limit greatest(1, least(coalesce(lim, 40), 100));
$$;

grant execute on function public.search_articles(text, integer) to anon, authenticated, service_role;
