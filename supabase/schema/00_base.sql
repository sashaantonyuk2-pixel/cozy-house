-- =====================================================================
-- 00 · Base: extensions, private schema, admins, shared helpers, audit log
-- Snapshot of the live Supabase structure (project cozyhousevibe), 25.11.2026.
-- No data and no secrets. Run files 00 → 09 in order on an empty project.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists http with schema extensions;      -- Telegram link check (seller_link_telegram)
create extension if not exists pg_net;                            -- async Telegram notifications (net.http_post)
create extension if not exists supabase_vault;                    -- stores the Telegram bot token (vault.secrets)

-- Functions that must not be callable through the public API live here
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ---------- Admins (who can open Seller Central) ----------
create table if not exists public.admins (
  user_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint admins_pkey primary key (user_id),
  constraint admins_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
create policy "Users can see whether they are an admin" on public.admins as permissive for select to authenticated
  using ((user_id = ( select auth.uid() as uid)));
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

-- Admin = listed in admins AND signed in with 2FA (aal2)
create or replace function private.is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
     and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$function$;
revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin new.updated_at = now(); return new; end; $function$;

-- ---------- Audit log (every change by the seller) ----------
create table if not exists public.audit_log (
  id bigint generated always as identity not null,
  at timestamp with time zone default now() not null,
  actor uuid default auth.uid(),
  actor_email text default (auth.jwt() ->> 'email'::text),
  table_name text not null,
  action text not null,
  row_id text,
  details jsonb,
  constraint audit_log_pkey primary key (id)
);
alter table public.audit_log enable row level security;
create policy "Admins can read the audit log" on public.audit_log as permissive for select to authenticated
  using (( select private.is_admin() as is_admin));
revoke insert, update, delete on public.audit_log from anon, authenticated;

create or replace function public.log_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare rid text; det jsonb;
begin
  if tg_table_name = 'products' and current_setting('app.order_ctx', true) = '1' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then rid := old.id::text; det := jsonb_build_object('name', to_jsonb(old) ->> 'name');
  else rid := new.id::text;
    if tg_table_name = 'orders' then
      det := jsonb_build_object('order_no', new.order_no, 'status', new.status,
               'old_status', case when tg_op = 'UPDATE' then old.status end, 'tracking', new.tracking_number);
      if tg_op = 'UPDATE' then
        if new.payment_status is distinct from old.payment_status or new.paid_amount is distinct from old.paid_amount or new.refund_amount is distinct from old.refund_amount then
          det := det || jsonb_build_object('payment', new.payment_status, 'old_payment', old.payment_status,
                   'paid_amount', new.paid_amount, 'refund_amount', new.refund_amount, 'method', new.payment_method);
        end if;
        if new.customer is distinct from old.customer then det := det || jsonb_build_object('customer_changed', true); end if;
      end if;
    elsif tg_table_name = 'products' then det := jsonb_build_object('name', new.name, 'price', new.price, 'stock', new.stock, 'active', new.active,
           'old_price_value', case when tg_op = 'UPDATE' then old.price end);
    else det := jsonb_build_object('name', to_jsonb(new) ->> 'name'); end if;
  end if;
  insert into public.audit_log (table_name, action, row_id, details) values (tg_table_name, lower(tg_op), rid, det);
  return coalesce(new, old);
end; $function$;
revoke execute on function public.log_change() from public, anon, authenticated;
