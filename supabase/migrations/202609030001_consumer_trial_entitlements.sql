-- Phase 3: database-controlled consumer trial entitlements.
-- Prepare and review locally before applying manually.

alter table public.consumer_accounts
  add column trial_started_at timestamptz null,
  add column trial_ends_at timestamptz null,
  add column entitlement_status text not null default 'trial';

alter table public.consumer_accounts
  add constraint consumer_accounts_entitlement_status_check
    check (entitlement_status in ('trial', 'subscribed', 'revoked')),
  add constraint consumer_accounts_trial_timestamps_check
    check (
      (trial_started_at is null and trial_ends_at is null)
      or
      (
        trial_started_at is not null
        and trial_ends_at is not null
        and trial_ends_at > trial_started_at
      )
    );

comment on column public.consumer_accounts.trial_started_at is
  'Database-generated start of the consumer trial; initialized once on first Phase-3 authenticated account initialization.';
comment on column public.consumer_accounts.trial_ends_at is
  'Fixed database-generated end of the consumer trial, seven days after trial_started_at.';
comment on column public.consumer_accounts.entitlement_status is
  'Persisted entitlement category: trial, subscribed, or revoked. Effective access is evaluated using database time.';

create or replace function public.ensure_consumer_account()
returns public.consumer_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  initialized_at timestamptz := statement_timestamp();
  account public.consumer_accounts;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.consumer_accounts (
    user_id,
    trial_started_at,
    trial_ends_at,
    entitlement_status
  )
  values (
    caller_id,
    initialized_at,
    initialized_at + interval '7 days',
    'trial'
  )
  on conflict (user_id) do update
    set trial_started_at = excluded.trial_started_at,
        trial_ends_at = excluded.trial_ends_at,
        updated_at = initialized_at
    where public.consumer_accounts.trial_started_at is null
      and public.consumer_accounts.trial_ends_at is null;

  select * into account
  from public.consumer_accounts
  where user_id = caller_id;

  return account;
end;
$$;

revoke all on function public.ensure_consumer_account() from public, anon;
grant execute on function public.ensure_consumer_account() to authenticated;

create or replace function public.consumer_has_active_entitlement()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.consumer_accounts as account
    where account.user_id = (select auth.uid())
      and (
        account.entitlement_status = 'subscribed'
        or (
          account.entitlement_status = 'trial'
          and account.trial_started_at is not null
          and account.trial_ends_at is not null
          and statement_timestamp() < account.trial_ends_at
        )
      )
  );
$$;

revoke all on function public.consumer_has_active_entitlement() from public, anon;
grant execute on function public.consumer_has_active_entitlement() to authenticated;

create or replace function public.get_current_consumer_entitlement()
returns table (
  user_id uuid,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  entitlement_status text,
  effective_status text,
  has_access boolean,
  server_now timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  evaluated_at timestamptz := statement_timestamp();
  account public.consumer_accounts;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into account
  from public.consumer_accounts
  where public.consumer_accounts.user_id = caller_id;

  if not found then
    return query
    select
      caller_id,
      null::timestamptz,
      null::timestamptz,
      null::text,
      'unavailable'::text,
      false,
      evaluated_at;
    return;
  end if;

  return query
  select
    account.user_id,
    account.trial_started_at,
    account.trial_ends_at,
    account.entitlement_status,
    case
      when account.entitlement_status = 'subscribed'
        then 'active_subscription'
      when account.entitlement_status = 'revoked'
        then 'access_revoked'
      when account.entitlement_status = 'trial'
        and account.trial_started_at is not null
        and account.trial_ends_at is not null
        and evaluated_at < account.trial_ends_at
        then 'active_trial'
      when account.entitlement_status = 'trial'
        and account.trial_started_at is not null
        and account.trial_ends_at is not null
        and evaluated_at >= account.trial_ends_at
        then 'trial_expired'
      else 'unavailable'
    end,
    case
      when account.entitlement_status = 'subscribed' then true
      when account.entitlement_status = 'trial'
        and account.trial_started_at is not null
        and account.trial_ends_at is not null
        and evaluated_at < account.trial_ends_at
        then true
      else false
    end,
    evaluated_at;
end;
$$;

revoke all on function public.get_current_consumer_entitlement() from public, anon;
grant execute on function public.get_current_consumer_entitlement() to authenticated;

-- Replace only the authenticated INSERT policy. The anonymous INSERT policy,
-- authenticated own-history SELECT policy, grants, and legacy NULL-owned rows
-- remain unchanged.
drop policy if exists "session_results_insert_own" on public.session_results;
create policy "session_results_insert_own"
  on public.session_results
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and (select public.consumer_has_active_entitlement())
  );
