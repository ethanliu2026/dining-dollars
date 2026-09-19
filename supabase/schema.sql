create table if not exists public.meal_tracker_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  version bigint not null default 1 check (version > 0)
);

alter table public.meal_tracker_states enable row level security;

revoke all on public.meal_tracker_states from anon;
grant select, insert, update, delete on public.meal_tracker_states to authenticated;

drop policy if exists "Read own meal history" on public.meal_tracker_states;
create policy "Read own meal history" on public.meal_tracker_states
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Create own meal history" on public.meal_tracker_states;
create policy "Create own meal history" on public.meal_tracker_states
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Update own meal history" on public.meal_tracker_states;
create policy "Update own meal history" on public.meal_tracker_states
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Delete own meal history" on public.meal_tracker_states;
create policy "Delete own meal history" on public.meal_tracker_states
  for delete to authenticated using ((select auth.uid()) = user_id);
