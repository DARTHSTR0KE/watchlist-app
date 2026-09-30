-- Clear all data for both accounts, the master account, and resetting ac's
-- walkthrough. Safe to run more than once. Replace the email on the first
-- line of the do block with the one you sign in with, if it differs.

-- The master account, fixed by its id. Looked up once here from the email
-- and written into the function, so no table holds it and nothing in the
-- app can change it.
do $do$
declare
  master uuid;
begin
  select id into master from auth.users where lower(email) = lower('YOUR-SIGN-IN-EMAIL');
  if master is null then raise exception 'No account with that email: put in the one you sign in with.'; end if;
  execute format($f$
    create or replace function public.is_master() returns boolean
    language sql stable security definer set search_path = public
    as $b$ select auth.uid() is not null and auth.uid() = %L::uuid $b$
  $f$, master);
end
$do$;

-- Me and my partner, but only when each of us names the other. A partner
-- id set on one side alone reaches nobody else's rows.
create or replace function public.pair_ids() returns uuid[]
language sql stable security definer set search_path = public
as $$
  select array_remove(array[auth.uid(), (
    select p.id from public.profiles p
    where p.id = (select partner_id from public.profiles where id = auth.uid())
      and p.partner_id = auth.uid()
  )], null)
$$;

-- Everything either of us made, on both accounts, from the master account
-- only. Returns how many rows went from each table. onboarded_at is never
-- touched.
create or replace function public.clear_pair_data() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  us uuid[] := public.pair_ids();
  gone jsonb := '{}';
  n int;
begin
  if not public.is_master() then raise exception 'only the master account can clear all data'; end if;
  delete from custom_wheel_items where wheel_id in (select id from custom_wheels where user_id = any (us));
  get diagnostics n = row_count; gone := gone || jsonb_build_object('wheelItems', n);
  delete from custom_wheels where user_id = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('wheels', n);
  delete from watchlist_items where user_id = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('watchlist', n);
  delete from watched where user_id = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('watched', n);
  delete from spins where user_id = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('spins', n);
  delete from filter_presets where user_id = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('presets', n);
  delete from imports where user_id = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('imports', n);
  delete from shared_list_items where added_by = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('sharedList', n);
  delete from recommendations where from_user = any (us) or to_user = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('recommendations', n);
  delete from nudges where from_user = any (us) or to_user = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('nudges', n);
  delete from splash_lines where from_user = any (us) or to_user = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('splashLines', n);
  delete from events where user_id = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('events', n);
  delete from milestones where user_id = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('milestones', n);
  delete from game_scores where user_id = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('gameScores', n);
  delete from game_record_notices where to_user = any (us) or by_user = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('recordNotices', n);
  delete from td_draws where user_id = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('seenCards', n);
  delete from td_turns where player = any (us) or partner = any (us) or drawn_by = any (us); get diagnostics n = row_count; gone := gone || jsonb_build_object('truthOrDareTurns', n);
  update profiles set reunion_date = null where id = any (us) and reunion_date is not null;
  get diagnostics n = row_count; gone := gone || jsonb_build_object('reunionDates', n);
  return gone;
end;
$$;

-- What is left on both accounts, counted past the policies. The same keys
-- as clear_pair_data, so the confirmation and the re-count see what the
-- wipe sees.
create or replace function public.pair_data_counts() returns jsonb
language sql stable security definer set search_path = public
as $$
  with us as (select public.pair_ids() as ids)
  select jsonb_build_object(
    'wheelItems', (select count(*) from custom_wheel_items where wheel_id in (select id from custom_wheels, us where user_id = any (us.ids))),
    'wheels', (select count(*) from custom_wheels, us where user_id = any (us.ids)),
    'watchlist', (select count(*) from watchlist_items, us where user_id = any (us.ids)),
    'watched', (select count(*) from watched, us where user_id = any (us.ids)),
    'spins', (select count(*) from spins, us where user_id = any (us.ids)),
    'presets', (select count(*) from filter_presets, us where user_id = any (us.ids)),
    'imports', (select count(*) from imports, us where user_id = any (us.ids)),
    'sharedList', (select count(*) from shared_list_items, us where added_by = any (us.ids)),
    'recommendations', (select count(*) from recommendations, us where from_user = any (us.ids) or to_user = any (us.ids)),
    'nudges', (select count(*) from nudges, us where from_user = any (us.ids) or to_user = any (us.ids)),
    'splashLines', (select count(*) from splash_lines, us where from_user = any (us.ids) or to_user = any (us.ids)),
    'events', (select count(*) from events, us where user_id = any (us.ids)),
    'milestones', (select count(*) from milestones, us where user_id = any (us.ids)),
    'gameScores', (select count(*) from game_scores, us where user_id = any (us.ids)),
    'recordNotices', (select count(*) from game_record_notices, us where to_user = any (us.ids) or by_user = any (us.ids)),
    'seenCards', (select count(*) from td_draws, us where user_id = any (us.ids)),
    'truthOrDareTurns', (select count(*) from td_turns, us where player = any (us.ids) or partner = any (us.ids) or drawn_by = any (us.ids)),
    'reunionDates', (select count(*) from profiles, us where id = any (us.ids) and reunion_date is not null)
  )
$$;

-- The master account only: ac's walkthrough runs again on her next open.
-- Her onboarded_at alone; never the master's own.
create or replace function public.reset_partner_walkthrough() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  partner uuid := (public.pair_ids())[2];
  was timestamptz;
begin
  if not public.is_master() then raise exception 'only the master account can do this'; end if;
  if partner is null or partner = auth.uid() then raise exception 'no partner linked'; end if;
  select onboarded_at into was from profiles where id = partner;
  update profiles set onboarded_at = null where id = partner;
  return jsonb_build_object('partner', partner, 'was', was);
end;
$$;

revoke all on function public.is_master() from public, anon;
revoke all on function public.pair_ids() from public, anon;
revoke all on function public.clear_pair_data() from public, anon;
revoke all on function public.pair_data_counts() from public, anon;
revoke all on function public.reset_partner_walkthrough() from public, anon;
grant execute on function public.is_master() to authenticated;
grant execute on function public.pair_ids() to authenticated;
grant execute on function public.clear_pair_data() to authenticated;
grant execute on function public.pair_data_counts() to authenticated;
grant execute on function public.reset_partner_walkthrough() to authenticated;

notify pgrst, 'reload schema';
