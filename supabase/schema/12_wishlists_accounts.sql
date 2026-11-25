-- =====================================================================
-- 12 · Customer account extras (needs 00, 01, 02, 04, 08): wishlist in the account, "Delete my account"
-- =====================================================================

-- Wishlist saved in the customer's account (same list on every device)
create table if not exists public.wishlists (
  user_id uuid not null default auth.uid(),
  product_id text not null,
  created_at timestamp with time zone default now() not null,
  constraint wishlists_pkey primary key (user_id, product_id),
  constraint wishlists_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint wishlists_product_id_fkey foreign key (product_id) references public.products(id) on update cascade on delete cascade
);
alter table public.wishlists enable row level security;
create policy "Customers see own wishlist" on public.wishlists as permissive for select to authenticated using (user_id = (select auth.uid()));
create policy "Customers add to own wishlist" on public.wishlists as permissive for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Customers remove from own wishlist" on public.wishlists as permissive for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.wishlists from anon, authenticated;
grant select, delete on public.wishlists to authenticated;
grant insert (product_id) on public.wishlists to authenticated;

-- Customer deletes their own account (CCPA "right to delete").
-- Login, profile and wishlist are erased; past orders stay for tax/accounting records but are no longer
-- linked to any account (orders.user_id → null). Refused while an order or return is in progress, and for shop admins.
create or replace function public.delete_my_account(p_confirm text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if coalesce(p_confirm, '') <> 'DELETE' then raise exception 'NOT_CONFIRMED'; end if;
  if exists (select 1 from public.admins where user_id = uid) then raise exception 'ADMIN_ACCOUNT'; end if;
  select count(*) into n from public.orders where user_id = uid and status in ('new', 'confirmed', 'shipped');
  if n > 0 then raise exception 'OPEN_ORDERS:%', n; end if;
  select count(*) into n from public.return_requests where user_id = uid and status in ('requested', 'approved', 'received');
  if n > 0 then raise exception 'OPEN_RETURNS:%', n; end if;
  insert into public.audit_log (table_name, action, row_id, details)
  values ('accounts', 'delete', uid::text, jsonb_build_object('by', 'customer'));
  delete from auth.users where id = uid;
  return jsonb_build_object('deleted', true);
end; $function$;
revoke execute on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
