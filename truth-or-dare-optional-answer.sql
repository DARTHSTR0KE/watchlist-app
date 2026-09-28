-- Truth or dare: answering needs no words and no photo. Safe to run more than once.
-- A card can be marked answered as it is (said out loud, or done in person).
-- Words and a photo stay optional; a truth still can't carry a photo.
create or replace function public.answer_turn(p_turn uuid, p_text text, p_photo text default null)
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
  if turn.kind = 'truth' and p_photo is not null then raise exception 'a truth has no photo'; end if;
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

revoke all on function public.answer_turn(uuid, text, text) from public, anon;
grant execute on function public.answer_turn(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
