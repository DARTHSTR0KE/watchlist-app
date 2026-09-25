-- Truth or dare. Run this first, then the four truth-or-dare-seed-*.sql files.
--
-- Safe to run more than once.
--
-- td_cards is never readable through the API: no policy grants a select,
-- and anon/authenticated hold no privileges on it at all. A card leaves
-- the table only through draw_card, one at a time, to whoever drew it.
--
-- td_draws records which cards each of us has drawn, so a deck runs out
-- per person and reset_deck reshuffles it for that person alone. Also
-- unreadable.
--
-- td_turns is the history: every card drawn, with the prompt copied onto
-- the turn, and how it was answered. Both of us can read it; nobody
-- writes to it except through the functions below.

create extension if not exists pgcrypto;

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

create table if not exists public.td_cards (
  id uuid primary key default gen_random_uuid(),
  deck text not null check (deck in ('serious', 'funny', 'flirty', 'spicy')),
  kind text not null check (kind in ('truth', 'dare')),
  body text not null unique,
  in_person_only boolean not null default false,
  created_at timestamptz not null default now(),
  -- Only a dare can need the same room.
  check (kind = 'dare' or not in_person_only)
);

create index if not exists td_cards_deck_kind on public.td_cards (deck, kind);

create table if not exists public.td_draws (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.td_cards (id) on delete cascade,
  drawn_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table if not exists public.td_turns (
  id uuid primary key default gen_random_uuid(),
  -- The account that drew it. In person that is the phone's owner, for
  -- either of us; virtual, always the player.
  drawn_by uuid not null references auth.users (id) on delete cascade,
  -- Whose turn it was, and the other of us.
  player uuid not null references auth.users (id) on delete cascade,
  partner uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('in_person', 'virtual')),
  deck text not null check (deck in ('serious', 'funny', 'flirty', 'spicy')),
  kind text not null check (kind in ('truth', 'dare')),
  card_id uuid references public.td_cards (id) on delete set null,
  prompt text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'passed')),
  answer_text text,
  -- A path in the private truth-or-dare bucket, under the drawer's folder.
  answer_photo text,
  answered_at timestamptz,
  -- Virtual only: the other of us, afterwards.
  reaction text check (char_length(reaction) <= 280),
  reacted_at timestamptz,
  seen_at timestamptz,
  -- The real clock, not the transaction's: turn order is read from this,
  -- and two turns must never tie.
  created_at timestamptz not null default clock_timestamp()
);

alter table public.td_turns alter column created_at set default clock_timestamp();

create index if not exists td_turns_pair_created on public.td_turns (player, partner, created_at desc);

/* ------------------------------------------------------------------ */
/* Who can see what                                                    */
/* ------------------------------------------------------------------ */

alter table public.td_cards enable row level security;
alter table public.td_draws enable row level security;
alter table public.td_turns enable row level security;

-- No policies on the first two, and no privileges either: not readable.
revoke all on public.td_cards from anon, authenticated;
revoke all on public.td_draws from anon, authenticated;

-- The history: readable by the two of us, written only by the functions.
revoke all on public.td_turns from anon, authenticated;
grant select on public.td_turns to authenticated;

drop policy if exists td_turns_ours on public.td_turns;
create policy td_turns_ours on public.td_turns
  for select to authenticated
  using (auth.uid() = player or auth.uid() = partner);

/* ------------------------------------------------------------------ */
/* Functions                                                           */
/* ------------------------------------------------------------------ */

create or replace function public.td_my_partner()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select partner_id from public.profiles where id = auth.uid()
$$;

-- Draws one card I haven't drawn since my last reset of that deck and
-- kind. Returns the new turn, or no row at all when the deck has run out.
-- p_player is whose turn it is: in person either of us, virtual only me.
create or replace function public.draw_card(
  p_deck text,
  p_kind text,
  p_mode text,
  p_player uuid default null
)
returns setof public.td_turns
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  them uuid := public.td_my_partner();
  who uuid := coalesce(p_player, me);
  other uuid;
  last_turn public.td_turns;
  card public.td_cards;
begin
  if me is null then raise exception 'not signed in'; end if;
  if them is null then raise exception 'no partner is linked'; end if;
  if p_deck not in ('serious', 'funny', 'flirty', 'spicy') then raise exception 'unknown deck'; end if;
  if p_kind not in ('truth', 'dare') then raise exception 'unknown kind'; end if;
  if p_mode not in ('in_person', 'virtual') then raise exception 'unknown mode'; end if;
  if who <> me and who <> them then raise exception 'not one of us'; end if;
  if p_mode = 'virtual' and who <> me then raise exception 'virtual turns are your own'; end if;
  other := case when who = me then them else me end;

  -- One open turn at a time: finish or pass the one in front of you first.
  if p_mode = 'in_person' then
    if exists (
      select 1 from public.td_turns
      where drawn_by = me and mode = 'in_person' and status = 'open'
    ) then
      raise exception 'finish the open turn first';
    end if;
  else
    if exists (
      select 1 from public.td_turns
      where player = me and mode = 'virtual' and status = 'open'
    ) then
      raise exception 'finish the open turn first';
    end if;
    -- Turns alternate: mine only once theirs is done.
    select * into last_turn from public.td_turns
    where mode = 'virtual'
      and ((player = me and partner = them) or (player = them and partner = me))
    order by created_at desc
    limit 1;
    if found and (last_turn.player = me or last_turn.status = 'open') then
      raise exception 'not your turn';
    end if;
  end if;

  select c.* into card
  from public.td_cards c
  where c.deck = p_deck
    and c.kind = p_kind
    and (p_mode = 'in_person' or not c.in_person_only)
    and not exists (
      select 1 from public.td_draws d where d.user_id = me and d.card_id = c.id
    )
  order by random()
  limit 1;

  if not found then
    return;
  end if;

  insert into public.td_draws (user_id, card_id) values (me, card.id)
  on conflict do nothing;

  return query
  insert into public.td_turns (drawn_by, player, partner, mode, deck, kind, card_id, prompt)
  values (me, who, other, p_mode, p_deck, p_kind, card.id, card.body)
  returning *;
end;
$$;

-- A truth is answered in text; a dare in text, a photo, or both.
create or replace function public.answer_turn(
  p_turn uuid,
  p_text text,
  p_photo text default null
)
returns public.td_turns
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  turn public.td_turns;
  words text := nullif(btrim(coalesce(p_text, '')), '');
begin
  select * into turn from public.td_turns where id = p_turn for update;
  if not found or turn.drawn_by <> me then raise exception 'no such turn'; end if;
  if turn.status <> 'open' then raise exception 'already answered'; end if;
  if turn.kind = 'truth' and (words is null or p_photo is not null) then
    raise exception 'a truth is answered in words';
  end if;
  if words is null and p_photo is null then raise exception 'nothing to answer with'; end if;
  if p_photo is not null and p_photo not like me::text || '/%' then
    raise exception 'that photo is not yours';
  end if;

  update public.td_turns
  set status = 'answered', answer_text = words, answer_photo = p_photo, answered_at = now()
  where id = p_turn
  returning * into turn;
  return turn;
end;
$$;

-- Three passes each in any seven days, counted for whoever's turn it is.
create or replace function public.pass_turn(p_turn uuid)
returns public.td_turns
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  turn public.td_turns;
  used int;
begin
  select * into turn from public.td_turns where id = p_turn for update;
  if not found or turn.drawn_by <> me then raise exception 'no such turn'; end if;
  if turn.status <> 'open' then raise exception 'already answered'; end if;

  select count(*) into used from public.td_turns
  where player = turn.player and status = 'passed' and answered_at > now() - interval '7 days';
  if used >= 3 then raise exception 'no passes left this week'; end if;

  update public.td_turns
  set status = 'passed', answered_at = now()
  where id = p_turn
  returning * into turn;
  return turn;
end;
$$;

-- The other of us, on a virtual turn that has been answered or passed.
create or replace function public.react_turn(p_turn uuid, p_reaction text)
returns public.td_turns
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  turn public.td_turns;
  said text := nullif(btrim(coalesce(p_reaction, '')), '');
begin
  select * into turn from public.td_turns where id = p_turn for update;
  if not found or turn.partner <> me or turn.mode <> 'virtual' then raise exception 'no such turn'; end if;
  if turn.status = 'open' then raise exception 'not answered yet'; end if;
  if said is null then raise exception 'nothing to react with'; end if;

  update public.td_turns
  set reaction = left(said, 280), reacted_at = now(), seen_at = coalesce(seen_at, now())
  where id = p_turn
  returning * into turn;
  return turn;
end;
$$;

-- Marks their virtual turns as seen by me, so the app stops pointing me
-- at them.
create or replace function public.td_mark_seen(p_turns uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.td_turns
  set seen_at = now()
  where id = any (p_turns) and partner = auth.uid() and mode = 'virtual'
    and status <> 'open' and seen_at is null
$$;

-- Reshuffles one deck and kind for me alone. Returns how many came back.
create or replace function public.reset_deck(p_deck text, p_kind text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  back int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.td_draws d
  using public.td_cards c
  where d.card_id = c.id and d.user_id = auth.uid() and c.deck = p_deck and c.kind = p_kind;
  get diagnostics back = row_count;
  return back;
end;
$$;

revoke all on function public.td_my_partner() from public, anon;
revoke all on function public.draw_card(text, text, text, uuid) from public, anon;
revoke all on function public.answer_turn(uuid, text, text) from public, anon;
revoke all on function public.pass_turn(uuid) from public, anon;
revoke all on function public.react_turn(uuid, text) from public, anon;
revoke all on function public.td_mark_seen(uuid[]) from public, anon;
revoke all on function public.reset_deck(text, text) from public, anon;
-- Only ever my own partner's id; the photo policy below needs it.
grant execute on function public.td_my_partner() to authenticated;
grant execute on function public.draw_card(text, text, text, uuid) to authenticated;
grant execute on function public.answer_turn(uuid, text, text) to authenticated;
grant execute on function public.pass_turn(uuid) to authenticated;
grant execute on function public.react_turn(uuid, text) to authenticated;
grant execute on function public.td_mark_seen(uuid[]) to authenticated;
grant execute on function public.reset_deck(text, text) to authenticated;

/* ------------------------------------------------------------------ */
/* Photos: a private bucket, each of us writing only to our own folder */
/* and both of us reading both folders.                                */
/* ------------------------------------------------------------------ */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('truth-or-dare', 'truth-or-dare', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists td_photos_write_own on storage.objects;
create policy td_photos_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'truth-or-dare'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists td_photos_read_ours on storage.objects;
create policy td_photos_read_ours on storage.objects
  for select to authenticated
  using (
    bucket_id = 'truth-or-dare'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] = public.td_my_partner()::text
    )
  );

drop policy if exists td_photos_delete_own on storage.objects;
create policy td_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'truth-or-dare'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- So the API sees the new functions straight away.
notify pgrst, 'reload schema';
