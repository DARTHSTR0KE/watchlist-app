-- One-off. Run this BEFORE truth-or-dare.sql if you ran the other
-- version of the schema (td_seen, and td_turns with from_user/to_user).
--
-- It removes that version so truth-or-dare.sql can set things up the way
-- the app expects. It only does so while those tables are empty: if any
-- of them has rows it stops with an error and changes nothing.

do $$
declare
  n bigint;
begin
  if to_regclass('public.td_turns') is not null then
    execute 'select count(*) from public.td_turns' into n;
    if n > 0 then raise exception 'td_turns has % rows: stopping, nothing changed', n; end if;
  end if;
  if to_regclass('public.td_seen') is not null then
    execute 'select count(*) from public.td_seen' into n;
    if n > 0 then raise exception 'td_seen has % rows: stopping, nothing changed', n; end if;
  end if;
  -- Left behind if truth-or-dare.sql was tried first and stopped partway.
  if to_regclass('public.td_draws') is not null then
    execute 'select count(*) from public.td_draws' into n;
    if n > 0 then raise exception 'td_draws has % rows: stopping, nothing changed', n; end if;
  end if;
  if to_regclass('public.td_cards') is not null then
    execute 'select count(*) from public.td_cards' into n;
    if n > 0 then raise exception 'td_cards has % rows: stopping, nothing changed', n; end if;
  end if;
end $$;

-- The other version's functions. reset_deck returned void there; the app's
-- returns how many cards came back, and a return type can't be replaced.
drop function if exists public.draw_card(text, text, boolean);
drop function if exists public.reset_deck(text, text);

-- The other version's tables (their policies go with them), and anything
-- a partial run of truth-or-dare.sql left behind. td_cards is
-- dropped too, so truth-or-dare.sql recreates it with the unique body the
-- seed needs and the rule that only a dare can be in person only.
drop table if exists public.td_draws;
drop table if exists public.td_turns;
drop table if exists public.td_seen;
drop table if exists public.td_cards;

notify pgrst, 'reload schema';
