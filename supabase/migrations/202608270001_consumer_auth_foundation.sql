-- Phase 1: additive consumer identity foundation. Apply manually after review.

alter table public.session_results
  add column if not exists user_id uuid null
  references auth.users(id) on delete set null;

create index if not exists session_results_user_id_created_at_idx
  on public.session_results (user_id, created_at desc);

create table if not exists public.consumer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consumer_accounts enable row level security;

revoke all on table public.consumer_accounts from anon, authenticated;
grant select on table public.consumer_accounts to authenticated;

drop policy if exists "consumer_accounts_select_own" on public.consumer_accounts;
create policy "consumer_accounts_select_own"
  on public.consumer_accounts
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function public.ensure_consumer_account()
returns public.consumer_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  account public.consumer_accounts;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.consumer_accounts (user_id)
  values (caller_id)
  on conflict (user_id) do nothing;

  select * into account
  from public.consumer_accounts
  where user_id = caller_id;

  return account;
end;
$$;

revoke all on function public.ensure_consumer_account() from public, anon;
grant execute on function public.ensure_consumer_account() to authenticated;

-- Preserve legacy anonymous INSERTs while preventing this permissive policy
-- from applying to authenticated users. Its existing WITH CHECK (true)
-- expression remains unchanged.
alter policy "Allow anon inserts"
  on public.session_results
  to anon;

grant insert on table public.session_results to anon;

revoke update, delete on table public.session_results from authenticated;
grant select, insert on table public.session_results to authenticated;

drop policy if exists "session_results_select_own" on public.session_results;
create policy "session_results_select_own"
  on public.session_results
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "session_results_insert_own" on public.session_results;
create policy "session_results_insert_own"
  on public.session_results
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

comment on column public.session_results.user_id is
  'Nullable owner for authenticated RESET sessions; legacy anonymous rows remain NULL.';
comment on table public.consumer_accounts is
  'Minimal Phase-1 consumer account record. Trial and billing fields are intentionally deferred.';
