-- Chhobidam: align the database to what the app's code reads and writes.
-- Run once in the Supabase SQL editor. Safe to run more than once.
--
-- It never drops a table, a column or a row. It:
--   1. creates any of the five tables that don't exist yet;
--   2. renames a column to the name the code uses when the code's name is
--      missing and a known alternative is present (milestones.kind -> key);
--   3. adds any column the code uses that is still missing;
--   4. sets the defaults the code relies on (it leaves these columns out
--      of its inserts);
--   5. relaxes NOT NULL on columns the code never writes, so its inserts
--      aren't refused for leaving them empty;
--   6. adds the unique indexes the code's upserts name as conflict targets.
-- Every rename and relaxation is printed as a NOTICE in the output.
--
-- All or nothing: if any step fails, nothing is changed. Send me the error.

begin;

-- Helpers for this script only; they vanish when the session ends.
create or replace function pg_temp.has_col(t text, c text) returns boolean
language sql stable as $$
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = t and column_name = c)
$$;

create or replace function pg_temp.adopt(t text, wanted text, aliases text[]) returns void
language plpgsql as $$
declare
  alias text;
begin
  if pg_temp.has_col(t, wanted) then return; end if;
  foreach alias in array aliases loop
    if pg_temp.has_col(t, alias) then
      execute format('alter table public.%I rename column %I to %I', t, alias, wanted);
      raise notice 'renamed %.% to %', t, alias, wanted;
      return;
    end if;
  end loop;
end $$;

-- 1. Tables that don't exist yet, exactly as the code expects them. ------

create table if not exists public.events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type       text not null,
  film_id    text references public.films(id) on delete set null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.milestones (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key        text not null,
  reached_at timestamptz not null,
  detail     jsonb,
  seen_at    timestamptz,
  primary key (user_id, key)
);

create table if not exists public.splash_lines (
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user   uuid not null references auth.users(id) on delete cascade,
  line      text not null check (char_length(line) between 1 and 60),
  set_at    timestamptz not null default now(),
  primary key (from_user, to_user)
);

create table if not exists public.wrapped_gifts (
  from_user    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  to_user      uuid not null references auth.users(id) on delete cascade,
  year         int  not null,
  track_path   text,
  track_title  text,
  track_at     timestamptz,
  message_path text,
  message_at   timestamptz
);

create table if not exists public.nudges (
  from_user  uuid primary key references public.profiles(id) on delete cascade,
  to_user    uuid not null references public.profiles(id) on delete cascade,
  message    text not null,
  dismissed  boolean not null default false,
  on_splash  boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. Renames: only where the code's name is missing and an alternative is
--    present. Your milestones table has `kind`; this makes it `key`.

select pg_temp.adopt('events', 'type',       array['kind', 'event', 'event_type', 'name']);
select pg_temp.adopt('events', 'detail',     array['details', 'data', 'meta', 'payload']);
select pg_temp.adopt('events', 'created_at', array['occurred_at', 'logged_at', 'at']);

select pg_temp.adopt('milestones', 'key',        array['kind', 'milestone', 'name', 'type']);
select pg_temp.adopt('milestones', 'reached_at', array['achieved_at', 'occurred_at', 'at']);
select pg_temp.adopt('milestones', 'detail',     array['details', 'data', 'meta', 'payload']);
select pg_temp.adopt('milestones', 'seen_at',    array['shown_at', 'surfaced_at', 'acknowledged_at']);

select pg_temp.adopt('splash_lines', 'line',   array['message', 'text', 'body', 'content', 'tagline']);
select pg_temp.adopt('splash_lines', 'set_at', array['updated_at', 'changed_at', 'created_at']);

select pg_temp.adopt('wrapped_gifts', 'year',         array['gift_year', 'yr']);
select pg_temp.adopt('wrapped_gifts', 'track_path',   array['song_path', 'audio_path', 'track']);
select pg_temp.adopt('wrapped_gifts', 'track_title',  array['song_title', 'track_name', 'song_name']);
select pg_temp.adopt('wrapped_gifts', 'track_at',     array['song_at', 'track_uploaded_at']);
select pg_temp.adopt('wrapped_gifts', 'message_path', array['video_path', 'message_video']);
select pg_temp.adopt('wrapped_gifts', 'message_at',   array['message_sent_at', 'video_at', 'sent_at']);

select pg_temp.adopt('nudges', 'message', array['text', 'body', 'content']);

-- 3. Any column the code uses that is still missing. ---------------------

alter table public.events
  add column if not exists user_id    uuid default auth.uid(),
  add column if not exists type       text,
  add column if not exists film_id    text,
  add column if not exists detail     jsonb,
  add column if not exists created_at timestamptz default now();
-- The code counts events by id.
alter table public.events add column if not exists id bigint generated by default as identity;

alter table public.milestones
  add column if not exists user_id    uuid default auth.uid(),
  add column if not exists key        text,
  add column if not exists reached_at timestamptz,
  add column if not exists detail     jsonb,
  add column if not exists seen_at    timestamptz;

alter table public.splash_lines
  add column if not exists from_user uuid,
  add column if not exists to_user   uuid,
  add column if not exists line      text,
  add column if not exists set_at    timestamptz default now();

alter table public.wrapped_gifts
  add column if not exists from_user    uuid default auth.uid(),
  add column if not exists to_user      uuid,
  add column if not exists year         int,
  add column if not exists track_path   text,
  add column if not exists track_title  text,
  add column if not exists track_at     timestamptz,
  add column if not exists message_path text,
  add column if not exists message_at   timestamptz;

alter table public.nudges
  add column if not exists from_user  uuid,
  add column if not exists to_user    uuid,
  add column if not exists message    text,
  add column if not exists dismissed  boolean default false,
  add column if not exists on_splash  boolean default false,
  add column if not exists created_at timestamptz default now();

alter table public.profiles add column if not exists last_open_at timestamptz;

-- 4. Defaults the code relies on: it leaves these out of its inserts. ----

alter table public.events       alter column user_id    set default auth.uid();
alter table public.events       alter column created_at set default now();
alter table public.milestones   alter column user_id    set default auth.uid();
alter table public.splash_lines alter column set_at     set default now();
alter table public.nudges       alter column dismissed  set default false;
alter table public.nudges       alter column on_splash  set default false;
alter table public.nudges       alter column created_at set default now();

-- 5. Columns the code never writes can't be required, or its inserts are
--    refused. Only NOT NULL columns with no default are touched; each one
--    is printed. A column that can't be relaxed (say, part of a primary
--    key) is reported and left as it is.

do $$
declare
  expected constant jsonb := '{
    "events":        ["id", "user_id", "type", "film_id", "detail", "created_at"],
    "milestones":    ["user_id", "key", "reached_at", "detail", "seen_at"],
    "splash_lines":  ["from_user", "to_user", "line", "set_at"],
    "wrapped_gifts": ["from_user", "to_user", "year", "track_path", "track_title",
                      "track_at", "message_path", "message_at"],
    "nudges":        ["from_user", "to_user", "message", "dismissed", "on_splash", "created_at"]
  }';
  r record;
begin
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('events', 'milestones', 'splash_lines', 'wrapped_gifts', 'nudges')
      and is_nullable = 'NO'
      and column_default is null
      and is_identity = 'NO'
      and is_generated = 'NEVER'
      and not ((expected -> table_name) ? column_name)
  loop
    begin
      execute format('alter table public.%I alter column %I drop not null', r.table_name, r.column_name);
      raise notice 'no longer required: %.% (the app never writes it)', r.table_name, r.column_name;
    exception when others then
      raise notice 'left as it is: %.% — %', r.table_name, r.column_name, sqlerrm;
    end;
  end loop;
end $$;

-- 6. The conflict targets the code's upserts name. -----------------------

create unique index if not exists milestones_user_key      on public.milestones    (user_id, key);
create unique index if not exists splash_lines_from_to     on public.splash_lines  (from_user, to_user);
create unique index if not exists wrapped_gifts_from_year  on public.wrapped_gifts (from_user, year);
create unique index if not exists nudges_from_user         on public.nudges        (from_user);

commit;

-- Check: every column the code uses, and whether the database now agrees.
-- Anything other than 'ok' in the last column, send me the row.
with expected(table_name, column_name, wanted_type) as (
  values
    ('events', 'id', 'bigint'), ('events', 'user_id', 'uuid'), ('events', 'type', 'text'),
    ('events', 'film_id', 'text'), ('events', 'detail', 'jsonb'),
    ('events', 'created_at', 'timestamp with time zone'),
    ('milestones', 'user_id', 'uuid'), ('milestones', 'key', 'text'),
    ('milestones', 'reached_at', 'timestamp with time zone'), ('milestones', 'detail', 'jsonb'),
    ('milestones', 'seen_at', 'timestamp with time zone'),
    ('splash_lines', 'from_user', 'uuid'), ('splash_lines', 'to_user', 'uuid'),
    ('splash_lines', 'line', 'text'), ('splash_lines', 'set_at', 'timestamp with time zone'),
    ('wrapped_gifts', 'from_user', 'uuid'), ('wrapped_gifts', 'to_user', 'uuid'),
    ('wrapped_gifts', 'year', 'integer'), ('wrapped_gifts', 'track_path', 'text'),
    ('wrapped_gifts', 'track_title', 'text'),
    ('wrapped_gifts', 'track_at', 'timestamp with time zone'),
    ('wrapped_gifts', 'message_path', 'text'),
    ('wrapped_gifts', 'message_at', 'timestamp with time zone'),
    ('nudges', 'from_user', 'uuid'), ('nudges', 'to_user', 'uuid'), ('nudges', 'message', 'text'),
    ('nudges', 'dismissed', 'boolean'), ('nudges', 'on_splash', 'boolean'),
    ('nudges', 'created_at', 'timestamp with time zone'),
    ('profiles', 'last_open_at', 'timestamp with time zone')
)
select e.table_name, e.column_name, e.wanted_type, c.data_type as actual_type,
  case
    when c.column_name is null then 'MISSING'
    when c.data_type = e.wanted_type then 'ok'
    -- The code only counts events by id, so any integer or uuid will do.
    when e.table_name = 'events' and e.column_name = 'id'
      and c.data_type in ('integer', 'bigint', 'uuid') then 'ok'
    -- Timestamps without a zone still work, but read back without one.
    when e.wanted_type = 'timestamp with time zone'
      and c.data_type = 'timestamp without time zone' then 'ok (no time zone)'
    else 'type differs'
  end as status
from expected e
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = e.table_name and c.column_name = e.column_name
order by e.table_name, e.column_name;

-- And the functions the code calls.
select fn, exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = fn) as present
from unnest(array['touch_last_open', 'gift_waiting', 'partner_has_watched']) as fn;
