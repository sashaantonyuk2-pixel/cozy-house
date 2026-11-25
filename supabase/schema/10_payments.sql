-- =====================================================================
-- 10 · Online payments (Stripe) — needs 00, 04. Used by the Edge Functions in supabase/functions/.
-- Inactive until STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are set and store_settings.data.paymentsOn = true.
-- =====================================================================

-- Server-side price check for the payment module (service role only)
create or replace function public.checkout_quote(c jsonb, items jsonb)
 returns jsonb language sql stable security definer set search_path to ''
as $function$ select private.quote_order(c, items); $function$;
revoke execute on function public.checkout_quote(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.checkout_quote(jsonb, jsonb) to service_role;

-- "Am I the shop admin (with 2FA)?" — used by payments-refund
create or replace function public.am_i_admin()
 returns boolean language sql stable security definer set search_path to ''
as $function$ select private.is_admin(); $function$;
revoke execute on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

-- Cart waiting for payment (only the server functions can read/write it)
create table if not exists public.checkout_sessions (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  status text default 'open'::text not null,
  user_id uuid,
  customer jsonb not null,
  items jsonb not null,
  quote jsonb not null,
  stripe_session_id text,
  order_id bigint,
  error text,
  constraint checkout_sessions_pkey primary key (id),
  constraint checkout_sessions_stripe_key unique (stripe_session_id),
  constraint checkout_sessions_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null,
  constraint checkout_sessions_order_id_fkey foreign key (order_id) references public.orders(id) on delete set null,
  constraint checkout_sessions_status_check check (status = any (array['open','paid','failed','expired'])),
  constraint checkout_sessions_size_check check (pg_column_size(customer) < 4000 and pg_column_size(items) < 20000 and pg_column_size(quote) < 30000)
);
alter table public.checkout_sessions enable row level security;   -- no policies: service role only
revoke all on public.checkout_sessions from anon, authenticated;
create trigger checkout_sessions_updated_at before update on public.checkout_sessions for each row execute function public.set_updated_at();

-- Payment history (admin can read; written only by the server functions)
create table if not exists public.payments (
  id bigint generated always as identity not null,
  order_id bigint,
  checkout_id uuid,
  provider text default 'stripe'::text not null,
  provider_ref text,
  amount numeric(10,2) not null,
  currency text default 'USD'::text not null,
  status text default 'succeeded'::text not null,
  refunded_amount numeric(10,2) default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint payments_pkey primary key (id),
  constraint payments_provider_ref_key unique (provider_ref),
  constraint payments_order_id_fkey foreign key (order_id) references public.orders(id) on delete set null,
  constraint payments_checkout_id_fkey foreign key (checkout_id) references public.checkout_sessions(id) on delete set null,
  constraint payments_status_check check (status = any (array['succeeded','partially_refunded','refunded'])),
  constraint payments_amount_check check (amount >= 0 and amount < 1000000 and refunded_amount >= 0 and refunded_amount <= amount)
);
create index if not exists payments_order_idx on public.payments using btree (order_id);
alter table public.payments enable row level security;
create policy "Admins read payments" on public.payments as permissive for select to authenticated using (( select private.is_admin() as is_admin));
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
