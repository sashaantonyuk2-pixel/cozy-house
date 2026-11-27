-- =====================================================================
-- 14 · Team (needs 00–13). Several users in Seller Central with roles.
--   admins.role     owner | manager | warehouse   (the first admin is the owner)
--   owner     — everything: team, store settings, money (payment marks, refunds incl. Stripe), Telegram
--   manager   — orders, returns, chat, messages, reviews, catalog, suppliers, analytics (no team, settings page, money)
--   warehouse — orders and returns only (no catalog / settings / suppliers / reviews writes, no money)
--   team_invites — one-time invite code (7 days) for one email; accepted by public.team_join() when the person
--                  is signed in with that (confirmed) email. Link: <site>/seller/#/join?code=<code>
-- Migration: seller_team_roles (27.11.2026). Also revokes TRUNCATE/TRIGGER/REFERENCES on public tables from API roles.
-- =====================================================================
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t);
  end loop;
end $$;

alter table public.admins add column if not exists role text not null default 'owner';
alter table public.admins add column if not exists added_by uuid;
alter table public.admins add constraint admins_role_check check (role in ('owner','manager','warehouse'));

create table if not exists public.team_invites (
  code text primary key,
  email text not null,
  role text not null check (role in ('owner','manager','warehouse')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  created_by uuid
);
alter table public.team_invites enable row level security;
revoke all on public.team_invites from anon, authenticated;   -- only through the functions below

-- role of the signed-in user (2FA required); private.is_admin() stays "any team member"
create or replace function private.admin_role() returns text
language sql stable security definer set search_path to '' as $$
  select a.role from public.admins a where a.user_id = (select auth.uid())
     and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;
create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path to '' as $$ select coalesce(private.admin_role() = 'owner', false); $$;
create or replace function private.can_catalog() returns boolean
language sql stable security definer set search_path to '' as $$ select coalesce(private.admin_role() in ('owner','manager'), false); $$;

-- catalog, settings, suppliers, reviews, product photos: write policies use private.can_catalog() instead of private.is_admin()
-- (products, categories, store_settings, product_suppliers, suppliers, product_images, reviews; supplier reads too;
--  storage «Admins upload/update/delete product images»)
do $$ declare r record; q text; c text; begin
  for r in select * from pg_policies where
      (schemaname='public' and tablename in ('products','categories','store_settings','product_suppliers','suppliers','product_images','reviews') and cmd <> 'SELECT')
   or (schemaname='public' and tablename in ('product_suppliers','suppliers') and cmd = 'SELECT')
   or (schemaname='storage' and policyname in ('Admins upload product images','Admins update product images','Admins delete product images'))
  loop
    q := replace(r.qual, 'private.is_admin()', 'private.can_catalog()');
    c := replace(r.with_check, 'private.is_admin()', 'private.can_catalog()');
    execute format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename)
      || case when q is not null then format(' using (%s)', q) else '' end
      || case when c is not null then format(' with check (%s)', c) else '' end;
  end loop;
end $$;

-- money fields on orders: only the owner (service role / webhooks are not affected)
create or replace function private.order_money_guard() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if (select auth.uid()) is not null and private.admin_role() is distinct from 'owner'
     and (new.payment_status, new.paid_amount, new.paid_at, new.payment_method, new.payment_ref, new.refund_amount, new.refunded_at)
         is distinct from
         (old.payment_status, old.paid_amount, old.paid_at, old.payment_method, old.payment_ref, old.refund_amount, old.refunded_at) then
    raise exception 'OWNER_ONLY';
  end if;
  return new;
end $$;
create trigger orders_money_guard before update on public.orders for each row execute function private.order_money_guard();

-- Stripe refunds (edge function payments-refund calls am_i_admin) and Telegram setup: owner only
create or replace function public.am_i_admin() returns boolean
language sql stable security definer set search_path to '' as $$ select private.is_owner(); $$;
-- seller_telegram_status / seller_disable_telegram / seller_set_telegram_token / seller_link_telegram:
-- the check «private.is_admin()» was replaced with «private.is_owner()» (see 00_base.sql for their bodies).

create or replace function public.my_team_role() returns text
language sql stable security definer set search_path to '' as $$ select a.role from public.admins a where a.user_id = (select auth.uid()); $$;

create or replace function private.team_log(p_action text, p_row text, p_details jsonb) returns void
language sql security definer set search_path to '' as $$
  insert into public.audit_log(actor, actor_email, table_name, action, row_id, details)
  values ((select auth.uid()), (select email from auth.users where id = (select auth.uid())), 'team', p_action, p_row, p_details);
$$;

create or replace function public.team_list() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
begin
  if not private.is_owner() then raise exception 'NOT_ALLOWED'; end if;
  return jsonb_build_object(
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', a.user_id, 'email', u.email, 'role', a.role, 'added', a.created_at,
                  'last_sign_in', u.last_sign_in_at, 'me', a.user_id = (select auth.uid())) order by a.created_at), '[]')
                from public.admins a join auth.users u on u.id = a.user_id),
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('code', i.code, 'email', i.email, 'role', i.role, 'created', i.created_at, 'expires', i.expires_at) order by i.created_at desc), '[]')
                from public.team_invites i where i.expires_at > now()));
end $$;

create or replace function public.team_invite(p_email text, p_role text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare em text := lower(btrim(coalesce(p_email, ''))); c text;
begin
  if not private.is_owner() then raise exception 'NOT_ALLOWED'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(em) > 200 then raise exception 'BAD_EMAIL'; end if;
  if p_role not in ('owner','manager','warehouse') then raise exception 'BAD_ROLE'; end if;
  if exists (select 1 from public.admins a join auth.users u on u.id = a.user_id where lower(u.email) = em) then raise exception 'ALREADY_MEMBER'; end if;
  delete from public.team_invites where lower(email) = em or expires_at < now();
  c := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.team_invites(code, email, role, created_by) values (c, em, p_role, (select auth.uid()));
  perform private.team_log('invite', em, jsonb_build_object('role', p_role));
  return jsonb_build_object('code', c, 'email', em, 'role', p_role);
end $$;

create or replace function public.team_cancel_invite(p_code text) returns void
language plpgsql security definer set search_path to '' as $$
declare em text;
begin
  if not private.is_owner() then raise exception 'NOT_ALLOWED'; end if;
  delete from public.team_invites where code = p_code returning email into em;
  if em is not null then perform private.team_log('invite_cancel', em, '{}'::jsonb); end if;
end $$;

create or replace function public.team_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path to '' as $$
declare old text;
begin
  if not private.is_owner() then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('owner','manager','warehouse') then raise exception 'BAD_ROLE'; end if;
  if p_user = (select auth.uid()) then raise exception 'NOT_SELF'; end if;
  select role into old from public.admins where user_id = p_user for update;
  if old is null then raise exception 'NOT_FOUND'; end if;
  update public.admins set role = p_role where user_id = p_user;
  perform private.team_log('role', p_user::text, jsonb_build_object('old', old, 'role', p_role));
end $$;

create or replace function public.team_remove(p_user uuid) returns void
language plpgsql security definer set search_path to '' as $$
begin
  if not private.is_owner() then raise exception 'NOT_ALLOWED'; end if;
  if p_user = (select auth.uid()) then raise exception 'NOT_SELF'; end if;
  delete from public.admins where user_id = p_user;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform private.team_log('remove', p_user::text, '{}'::jsonb);
end $$;

create or replace function public.team_join(p_code text) returns text
language plpgsql security definer set search_path to '' as $$
declare i record; uid uuid := (select auth.uid()); em text;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  select lower(email) into em from auth.users where id = uid and email_confirmed_at is not null;
  if em is null then raise exception 'EMAIL_NOT_CONFIRMED'; end if;
  select * into i from public.team_invites where code = btrim(coalesce(p_code, '')) for update;
  if not found or i.expires_at < now() then raise exception 'BAD_CODE'; end if;
  if lower(i.email) <> em then raise exception 'WRONG_EMAIL'; end if;
  insert into public.admins(user_id, role, added_by) values (uid, i.role, i.created_by)
    on conflict (user_id) do update set role = excluded.role;
  delete from public.team_invites where code = i.code;
  insert into public.audit_log(actor, actor_email, table_name, action, row_id, details) values (uid, em, 'team', 'join', uid::text, jsonb_build_object('role', i.role));
  return i.role;
end $$;

revoke all on function public.my_team_role() from public, anon;
grant execute on function public.my_team_role() to authenticated;
do $$ declare f text; begin
  foreach f in array array['public.team_list()','public.team_invite(text,text)','public.team_cancel_invite(text)','public.team_set_role(uuid,text)','public.team_remove(uuid)','public.team_join(text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke all on function private.team_log(text,text,jsonb) from public, anon, authenticated;
