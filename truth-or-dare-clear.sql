-- Truth or dare, for Clear all data. Safe to run more than once.
--
-- The seen-card record (td_draws) can't be read or deleted by the app, on
-- purpose, and the app has no delete rights on td_turns. These two
-- functions let Clear all data wipe both for the two of us, and count what
-- is left afterwards, without opening either table up. The card deck
-- (td_cards) is never touched.

-- Wipes every turn and every seen card for me and my partner, so the decks
-- are full again for both of us.
create or replace function public.td_clear_ours()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  us uuid[];
begin
  if me is null then raise exception 'not signed in'; end if;
  us := array_remove(array[me, public.td_my_partner()], null);
  delete from public.td_draws where user_id = any (us);
  delete from public.td_turns
  where player = any (us) or partner = any (us) or drawn_by = any (us);
end;
$$;

-- How many seen cards the two of us still have on record. A count only:
-- which cards they are stays hidden.
create or replace function public.td_seen_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.td_draws
  where user_id = any (array_remove(array[auth.uid(), public.td_my_partner()], null))
$$;

revoke all on function public.td_clear_ours() from public, anon;
revoke all on function public.td_seen_count() from public, anon;
grant execute on function public.td_clear_ours() to authenticated;
grant execute on function public.td_seen_count() to authenticated;

notify pgrst, 'reload schema';
