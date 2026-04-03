-- RISX soft-launch hardening migration
-- Goals:
-- 1) Authoritative economic tables for payments/runs/claims/token consumption/audit/idempotency
-- 2) Strong uniqueness + status checks
-- 3) Deny browser-role writes (anon/authenticated) to authoritative tables

begin;

create extension if not exists pgcrypto;

create or replace function public.risx_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------
-- payments
-- -----------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_id text,
  order_id text not null,
  wallet_address text default '',
  email text default '',
  tier text not null,
  intent text not null default 'entry',
  status text not null default 'pending',
  amount_usd numeric(18, 6),
  pay_amount numeric(36, 18),
  pay_currency text,
  provider text not null default 'nowpayments',
  provider_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments add column if not exists payment_id text;
alter table public.payments add column if not exists order_id text;
alter table public.payments add column if not exists wallet_address text default '';
alter table public.payments add column if not exists email text default '';
alter table public.payments add column if not exists tier text;
alter table public.payments add column if not exists intent text default 'entry';
alter table public.payments add column if not exists status text default 'pending';
alter table public.payments add column if not exists amount_usd numeric(18, 6);
alter table public.payments add column if not exists pay_amount numeric(36, 18);
alter table public.payments add column if not exists pay_currency text;
alter table public.payments add column if not exists provider text default 'nowpayments';
alter table public.payments add column if not exists provider_payload jsonb not null default '{}'::jsonb;
alter table public.payments add column if not exists paid_at timestamptz;
alter table public.payments add column if not exists created_at timestamptz not null default now();
alter table public.payments add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_payment_id_key'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments add constraint payments_payment_id_key unique (payment_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_order_id_key'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments add constraint payments_order_id_key unique (order_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_status_check'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_status_check
      check (lower(status) in ('pending', 'paid', 'expired', 'cancelled', 'failed')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_intent_check'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_intent_check
      check (lower(intent) in ('entry', 'restart')) not valid;
  end if;
end $$;

create index if not exists idx_payments_created_at on public.payments (created_at desc);
create index if not exists idx_payments_status on public.payments (status);
create index if not exists idx_payments_wallet on public.payments (wallet_address);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_payments_set_updated_at'
      and tgrelid = 'public.payments'::regclass
  ) then
    create trigger trg_payments_set_updated_at
      before update on public.payments
      for each row
      execute function public.risx_set_updated_at();
  end if;
end $$;

-- -----------------------------
-- runs
-- -----------------------------
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  wallet_address text default '',
  tier text not null,
  status text not null default 'created',
  payment_id text,
  result text,
  pnl numeric(18, 6),
  started_at timestamptz,
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.runs add column if not exists run_id text;
alter table public.runs add column if not exists wallet_address text default '';
alter table public.runs add column if not exists tier text;
alter table public.runs add column if not exists status text default 'created';
alter table public.runs add column if not exists payment_id text;
alter table public.runs add column if not exists result text;
alter table public.runs add column if not exists pnl numeric(18, 6);
alter table public.runs add column if not exists started_at timestamptz;
alter table public.runs add column if not exists ended_at timestamptz;
alter table public.runs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.runs add column if not exists created_at timestamptz not null default now();
alter table public.runs add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'runs_run_id_key'
      and conrelid = 'public.runs'::regclass
  ) then
    alter table public.runs add constraint runs_run_id_key unique (run_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'runs_status_check'
      and conrelid = 'public.runs'::regclass
  ) then
    alter table public.runs
      add constraint runs_status_check
      check (lower(status) in ('created', 'ready', 'active', 'resumed', 'failed', 'won', 'claimed', 'paid', 'void')) not valid;
  end if;
end $$;

create unique index if not exists idx_runs_payment_id_unique
  on public.runs (payment_id)
  where payment_id is not null and length(trim(payment_id)) > 0;

create index if not exists idx_runs_created_at on public.runs (created_at desc);
create index if not exists idx_runs_wallet on public.runs (wallet_address);
create index if not exists idx_runs_status on public.runs (status);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_runs_set_updated_at'
      and tgrelid = 'public.runs'::regclass
  ) then
    create trigger trg_runs_set_updated_at
      before update on public.runs
      for each row
      execute function public.risx_set_updated_at();
  end if;
end $$;

-- -----------------------------
-- claims
-- -----------------------------
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  claim_id text not null,
  run_id text not null,
  payment_id text,
  wallet_address text default '',
  email text default '',
  tier text,
  amount_usd numeric(18, 6),
  payout jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  txid text default '',
  admin_notes text default '',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.claims add column if not exists claim_id text;
alter table public.claims add column if not exists run_id text;
alter table public.claims add column if not exists payment_id text;
alter table public.claims add column if not exists wallet_address text default '';
alter table public.claims add column if not exists email text default '';
alter table public.claims add column if not exists tier text;
alter table public.claims add column if not exists amount_usd numeric(18, 6);
alter table public.claims add column if not exists payout jsonb not null default '{}'::jsonb;
alter table public.claims add column if not exists status text default 'pending';
alter table public.claims add column if not exists txid text default '';
alter table public.claims add column if not exists admin_notes text default '';
alter table public.claims add column if not exists submitted_at timestamptz not null default now();
alter table public.claims add column if not exists reviewed_at timestamptz;
alter table public.claims add column if not exists paid_at timestamptz;
alter table public.claims add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.claims add column if not exists created_at timestamptz not null default now();
alter table public.claims add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'claims_claim_id_key'
      and conrelid = 'public.claims'::regclass
  ) then
    alter table public.claims add constraint claims_claim_id_key unique (claim_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'claims_run_id_key'
      and conrelid = 'public.claims'::regclass
  ) then
    alter table public.claims add constraint claims_run_id_key unique (run_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'claims_status_check'
      and conrelid = 'public.claims'::regclass
  ) then
    alter table public.claims
      add constraint claims_status_check
      check (lower(status) in ('pending', 'approved', 'paid', 'void')) not valid;
  end if;
end $$;

create index if not exists idx_claims_created_at on public.claims (created_at desc);
create index if not exists idx_claims_status on public.claims (status);
create index if not exists idx_claims_wallet on public.claims (wallet_address);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_claims_set_updated_at'
      and tgrelid = 'public.claims'::regclass
  ) then
    create trigger trg_claims_set_updated_at
      before update on public.claims
      for each row
      execute function public.risx_set_updated_at();
  end if;
end $$;

-- -----------------------------
-- unlock_tokens (one-time consumption ledger)
-- -----------------------------
create table if not exists public.unlock_tokens (
  id uuid primary key default gen_random_uuid(),
  jti text not null,
  token_hash text not null,
  run_id text,
  payment_id text,
  tier text,
  intent text default 'entry',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.unlock_tokens add column if not exists jti text;
alter table public.unlock_tokens add column if not exists token_hash text;
alter table public.unlock_tokens add column if not exists run_id text;
alter table public.unlock_tokens add column if not exists payment_id text;
alter table public.unlock_tokens add column if not exists tier text;
alter table public.unlock_tokens add column if not exists intent text default 'entry';
alter table public.unlock_tokens add column if not exists expires_at timestamptz;
alter table public.unlock_tokens add column if not exists consumed_at timestamptz;
alter table public.unlock_tokens add column if not exists consumed_by text;
alter table public.unlock_tokens add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.unlock_tokens add column if not exists created_at timestamptz not null default now();
alter table public.unlock_tokens add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'unlock_tokens_jti_key'
      and conrelid = 'public.unlock_tokens'::regclass
  ) then
    alter table public.unlock_tokens add constraint unlock_tokens_jti_key unique (jti);
  end if;
end $$;

create unique index if not exists idx_unlock_tokens_token_hash_unique on public.unlock_tokens (token_hash);
create index if not exists idx_unlock_tokens_expires_at on public.unlock_tokens (expires_at);
create index if not exists idx_unlock_tokens_consumed_at on public.unlock_tokens (consumed_at);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_unlock_tokens_set_updated_at'
      and tgrelid = 'public.unlock_tokens'::regclass
  ) then
    create trigger trg_unlock_tokens_set_updated_at
      before update on public.unlock_tokens
      for each row
      execute function public.risx_set_updated_at();
  end if;
end $$;

-- -----------------------------
-- admin audit log (immutable append-only in app logic)
-- -----------------------------
create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  request_id text,
  ip text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit add column if not exists event_id text;
alter table public.admin_audit add column if not exists actor text;
alter table public.admin_audit add column if not exists action text;
alter table public.admin_audit add column if not exists entity text;
alter table public.admin_audit add column if not exists entity_id text;
alter table public.admin_audit add column if not exists request_id text;
alter table public.admin_audit add column if not exists ip text;
alter table public.admin_audit add column if not exists before_state jsonb;
alter table public.admin_audit add column if not exists after_state jsonb;
alter table public.admin_audit add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.admin_audit add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_audit_event_id_key'
      and conrelid = 'public.admin_audit'::regclass
  ) then
    alter table public.admin_audit add constraint admin_audit_event_id_key unique (event_id);
  end if;
end $$;

create index if not exists idx_admin_audit_created_at on public.admin_audit (created_at desc);
create index if not exists idx_admin_audit_entity on public.admin_audit (entity, entity_id);
create index if not exists idx_admin_audit_action on public.admin_audit (action);

-- -----------------------------
-- idempotency keys
-- -----------------------------
create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  key_hash text not null,
  response_code integer,
  response_body jsonb,
  request_hash text,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.idempotency_keys add column if not exists scope text;
alter table public.idempotency_keys add column if not exists key_hash text;
alter table public.idempotency_keys add column if not exists response_code integer;
alter table public.idempotency_keys add column if not exists response_body jsonb;
alter table public.idempotency_keys add column if not exists request_hash text;
alter table public.idempotency_keys add column if not exists locked_until timestamptz;
alter table public.idempotency_keys add column if not exists created_at timestamptz not null default now();
alter table public.idempotency_keys add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'idempotency_keys_scope_key_hash_key'
      and conrelid = 'public.idempotency_keys'::regclass
  ) then
    alter table public.idempotency_keys
      add constraint idempotency_keys_scope_key_hash_key
      unique (scope, key_hash);
  end if;
end $$;

create index if not exists idx_idempotency_keys_created_at on public.idempotency_keys (created_at desc);
create index if not exists idx_idempotency_keys_locked_until on public.idempotency_keys (locked_until);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_idempotency_keys_set_updated_at'
      and tgrelid = 'public.idempotency_keys'::regclass
  ) then
    create trigger trg_idempotency_keys_set_updated_at
      before update on public.idempotency_keys
      for each row
      execute function public.risx_set_updated_at();
  end if;
end $$;

-- -----------------------------
-- RLS + privilege hardening
-- -----------------------------
alter table public.payments enable row level security;
alter table public.runs enable row level security;
alter table public.claims enable row level security;
alter table public.unlock_tokens enable row level security;
alter table public.admin_audit enable row level security;
alter table public.idempotency_keys enable row level security;

alter table public.payments force row level security;
alter table public.runs force row level security;
alter table public.claims force row level security;
alter table public.unlock_tokens force row level security;
alter table public.admin_audit force row level security;
alter table public.idempotency_keys force row level security;

-- Ensure browser roles cannot mutate authoritative tables.
revoke insert, update, delete, truncate on table public.payments from anon, authenticated;
revoke insert, update, delete, truncate on table public.runs from anon, authenticated;
revoke insert, update, delete, truncate on table public.claims from anon, authenticated;
revoke insert, update, delete, truncate on table public.unlock_tokens from anon, authenticated;
revoke insert, update, delete, truncate on table public.admin_audit from anon, authenticated;
revoke insert, update, delete, truncate on table public.idempotency_keys from anon, authenticated;

-- Explicit deny policies for browser roles (defense in depth).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payments' and policyname = 'deny_anon_all_payments') then
    create policy deny_anon_all_payments on public.payments for all to anon using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'runs' and policyname = 'deny_anon_all_runs') then
    create policy deny_anon_all_runs on public.runs for all to anon using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'claims' and policyname = 'deny_anon_all_claims') then
    create policy deny_anon_all_claims on public.claims for all to anon using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'unlock_tokens' and policyname = 'deny_anon_all_unlock_tokens') then
    create policy deny_anon_all_unlock_tokens on public.unlock_tokens for all to anon using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_audit' and policyname = 'deny_anon_all_admin_audit') then
    create policy deny_anon_all_admin_audit on public.admin_audit for all to anon using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'idempotency_keys' and policyname = 'deny_anon_all_idempotency_keys') then
    create policy deny_anon_all_idempotency_keys on public.idempotency_keys for all to anon using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payments' and policyname = 'deny_authenticated_all_payments') then
    create policy deny_authenticated_all_payments on public.payments for all to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'runs' and policyname = 'deny_authenticated_all_runs') then
    create policy deny_authenticated_all_runs on public.runs for all to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'claims' and policyname = 'deny_authenticated_all_claims') then
    create policy deny_authenticated_all_claims on public.claims for all to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'unlock_tokens' and policyname = 'deny_authenticated_all_unlock_tokens') then
    create policy deny_authenticated_all_unlock_tokens on public.unlock_tokens for all to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_audit' and policyname = 'deny_authenticated_all_admin_audit') then
    create policy deny_authenticated_all_admin_audit on public.admin_audit for all to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'idempotency_keys' and policyname = 'deny_authenticated_all_idempotency_keys') then
    create policy deny_authenticated_all_idempotency_keys on public.idempotency_keys for all to authenticated using (false) with check (false);
  end if;
end $$;

commit;
