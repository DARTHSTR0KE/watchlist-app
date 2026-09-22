-- Chhobidam: the nudges table. Run this in the Supabase SQL editor.
-- One pending nudge per sender, replaced on send.

create table public.nudges (
  from_user  uuid primary key references public.profiles (id) on delete cascade,
  to_user    uuid not null references public.profiles (id) on delete cascade,
  message    text not null check (char_length(message) between 1 and 140),
  dismissed  boolean not null default false,
  -- Short ones can be spoken by the sender's animal on the splash.
  on_splash  boolean not null default false,
  created_at timestamptz not null default now()
);

create index nudges_to_user_idx on public.nudges (to_user) where dismissed = false;

alter table public.nudges enable row level security;

-- Send: only as yourself.
create policy nudges_insert on public.nudges
  for insert to authenticated
  with check (from_user = auth.uid());

-- Replace your own (the upsert's update half).
create policy nudges_update_own on public.nudges
  for update to authenticated
  using (from_user = auth.uid())
  with check (from_user = auth.uid());

-- Dismiss: the recipient marks it read.
create policy nudges_dismiss on public.nudges
  for update to authenticated
  using (to_user = auth.uid())
  with check (to_user = auth.uid());

-- Read: either side of it.
create policy nudges_select on public.nudges
  for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- Clearing all data removes them.
create policy nudges_delete on public.nudges
  for delete to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- If the table already existed, this is the only part that is new. Safe to
-- run on its own, and safe to run twice.
alter table public.nudges add column if not exists on_splash boolean not null default false;

-- PostgREST will not see a table or column created after it started until
-- its schema cache reloads. Without this the client gets PGRST205 and the
-- send looks like a policy problem when it isn't.
notify pgrst, 'reload schema';
