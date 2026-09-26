-- Truth or dare: the deck is picked at random on every draw, never chosen.
-- Safe to run more than once. Same function signatures as before, so
-- nothing else needs to change in the database.
--
-- draw_card: pass null for p_deck and it picks a deck at random among the
-- decks that still have a card for you of that kind (and, playing apart,
-- one you can do apart). No row back now means every deck has run out.
--
-- reset_deck: pass null for p_deck to reshuffle that kind across all four
-- decks, for you alone.

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
  chosen text;
  card public.td_cards;
begin
  if me is null then raise exception 'not signed in'; end if;
  if them is null then raise exception 'no partner is linked'; end if;
  if p_deck is not null and p_deck not in ('serious', 'funny', 'flirty', 'spicy') then
    raise exception 'unknown deck';
  end if;
  if p_kind not in ('truth', 'dare') then raise exception 'unknown kind'; end if;
  if p_mode not in ('in_person', 'virtual') then raise exception 'unknown mode'; end if;
  if who <> me and who <> them then raise exception 'not one of us'; end if;
  if p_mode = 'virtual' and who <> me then raise exception 'virtual turns are your own'; end if;
  other := case when who = me then them else me end;

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
    select * into last_turn from public.td_turns
    where mode = 'virtual'
      and ((player = me and partner = them) or (player = them and partner = me))
    order by created_at desc
    limit 1;
    if found and (last_turn.player = me or last_turn.status = 'open') then
      raise exception 'not your turn';
    end if;
  end if;

  -- The deck: each one that still has a card for me is equally likely,
  -- however many cards it has left.
  if p_deck is null then
    select c.deck into chosen
    from public.td_cards c
    where c.kind = p_kind
      and (p_mode = 'in_person' or not c.in_person_only)
      and not exists (
        select 1 from public.td_draws d where d.user_id = me and d.card_id = c.id
      )
    group by c.deck
    order by random()
    limit 1;
    if not found then
      return;
    end if;
  else
    chosen := p_deck;
  end if;

  select c.* into card
  from public.td_cards c
  where c.deck = chosen
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
  values (me, who, other, p_mode, card.deck, p_kind, card.id, card.body)
  returning *;
end;
$$;

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
  where d.card_id = c.id
    and d.user_id = auth.uid()
    and c.kind = p_kind
    and (p_deck is null or c.deck = p_deck);
  get diagnostics back = row_count;
  return back;
end;
$$;

revoke all on function public.draw_card(text, text, text, uuid) from public, anon;
revoke all on function public.reset_deck(text, text) from public, anon;
grant execute on function public.draw_card(text, text, text, uuid) to authenticated;
grant execute on function public.reset_deck(text, text) to authenticated;

notify pgrst, 'reload schema';
