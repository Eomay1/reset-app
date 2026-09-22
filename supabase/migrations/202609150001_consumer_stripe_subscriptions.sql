-- Phase 4: server-controlled Stripe subscription state for consumer entitlements.
-- Prepare and review locally before applying manually. This migration does not
-- create Stripe trials; the existing database-controlled seven-day trial remains.

alter table public.consumer_accounts
  add column stripe_customer_id text null,
  add column stripe_subscription_id text null,
  add column stripe_subscription_status text null,
  add column stripe_price_id text null,
  add column stripe_current_period_end timestamptz null,
  add column stripe_cancel_at_period_end boolean not null default false,
  add column stripe_event_created_at timestamptz null,
  add column stripe_last_event_type text null;

create unique index consumer_accounts_stripe_customer_id_uidx
  on public.consumer_accounts (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index consumer_accounts_stripe_subscription_id_uidx
  on public.consumer_accounts (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.consumer_accounts.stripe_customer_id is
  'Stripe Customer ID written only by the server-side verified webhook flow.';
comment on column public.consumer_accounts.stripe_subscription_id is
  'Current Stripe Subscription ID written only by the server-side verified webhook flow.';
comment on column public.consumer_accounts.stripe_subscription_status is
  'Last verified Stripe subscription status. Active/trialing grants paid access; other states do not.';
comment on column public.consumer_accounts.stripe_current_period_end is
  'Last period end reported by Stripe. cancel_at_period_end subscriptions retain access while Stripe status remains active.';

create table public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  event_created_at timestamptz not null,
  processed_at timestamptz not null default statement_timestamp()
);

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;

comment on table public.stripe_webhook_events is
  'Server-only Stripe event receipt ledger used for transactional idempotency.';

create or replace function public.process_stripe_subscription_event(
  p_event_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_subscription_status text,
  p_stripe_price_id text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  inserted_count integer;
begin
  if p_event_id is null or btrim(p_event_id) = ''
    or p_event_type not in (
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted'
    )
    or p_event_created_at is null
    or p_stripe_customer_id is null or btrim(p_stripe_customer_id) = ''
    or p_stripe_subscription_id is null or btrim(p_stripe_subscription_id) = ''
    or p_subscription_status is null or btrim(p_subscription_status) = ''
  then
    raise exception 'Invalid Stripe subscription event payload' using errcode = '22023';
  end if;

  insert into public.stripe_webhook_events (event_id, event_type, event_created_at)
  values (p_event_id, p_event_type, p_event_created_at)
  on conflict (event_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    return false;
  end if;

  select account.user_id into target_user_id
  from public.consumer_accounts as account
  where account.stripe_customer_id = p_stripe_customer_id
    or account.stripe_subscription_id = p_stripe_subscription_id
  limit 1;

  if target_user_id is not null and p_user_id is not null and target_user_id <> p_user_id then
    raise exception 'Stripe identifiers do not match event account metadata'
      using errcode = '22023';
  end if;

  if target_user_id is null and p_user_id is not null then
    select account.user_id into target_user_id
    from public.consumer_accounts as account
    where account.user_id = p_user_id;
  end if;

  if target_user_id is null then
    raise exception 'No consumer account matches Stripe event %', p_event_id
      using errcode = 'P0002';
  end if;

  update public.consumer_accounts as account
  set stripe_customer_id = p_stripe_customer_id,
      stripe_subscription_id = p_stripe_subscription_id,
      stripe_subscription_status = p_subscription_status,
      stripe_price_id = p_stripe_price_id,
      stripe_current_period_end = p_current_period_end,
      stripe_cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
      stripe_event_created_at = p_event_created_at,
      stripe_last_event_type = p_event_type,
      entitlement_status = case
        when account.entitlement_status = 'revoked' then 'revoked'
        when p_subscription_status in ('active', 'trialing') then 'subscribed'
        else 'trial'
      end,
      updated_at = statement_timestamp()
  where account.user_id = target_user_id
    and (
      account.stripe_event_created_at is null
      or account.stripe_event_created_at < p_event_created_at
      or (
        account.stripe_event_created_at = p_event_created_at
        and account.stripe_last_event_type <> 'customer.subscription.deleted'
      )
    );

  return true;
end;
$$;

revoke all on function public.process_stripe_subscription_event(
  text, text, timestamptz, uuid, text, text, text, text, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.process_stripe_subscription_event(
  text, text, timestamptz, uuid, text, text, text, text, timestamptz, boolean
) to service_role;

comment on function public.process_stripe_subscription_event(
  text, text, timestamptz, uuid, text, text, text, text, timestamptz, boolean
) is
  'Atomically records a verified Stripe event and updates paid entitlement. Server/service-role only.';

-- consumer_accounts remains SELECT-only for authenticated clients. No client
-- UPDATE/INSERT grant or policy is added, so Stripe and entitlement fields cannot
-- be modified directly from the browser.
