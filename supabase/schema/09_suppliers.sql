-- =====================================================================
-- 09 · Suppliers: supplier, supplier SKU, cost price and link per product (needs 00, 02)
-- Seller Central only — admin-only RLS, never readable by customers or visitors
-- (kept out of public.products on purpose: products is readable by everyone).
-- =====================================================================

create table if not exists public.product_suppliers (
  product_id text not null,
  supplier text,
  supplier_sku text,
  cost_price numeric(10,2),
  supplier_url text,
  updated_at timestamp with time zone default now() not null,
  constraint product_suppliers_pkey primary key (product_id),
  constraint product_suppliers_product_id_fkey foreign key (product_id) references public.products(id) on update cascade on delete cascade,
  constraint product_suppliers_supplier_check check (supplier is null or char_length(supplier) <= 80),
  constraint product_suppliers_sku_check check (supplier_sku is null or char_length(supplier_sku) <= 80),
  constraint product_suppliers_cost_check check (cost_price is null or (cost_price >= 0 and cost_price < 1000000)),
  constraint product_suppliers_url_check check (supplier_url is null or (char_length(supplier_url) <= 500 and supplier_url ~* '^https?://'))
);
create index if not exists product_suppliers_sku_idx on public.product_suppliers using btree (lower(supplier_sku));
alter table public.product_suppliers enable row level security;
create policy "Admins read suppliers" on public.product_suppliers as permissive for select to authenticated
  using (( select private.is_admin() as is_admin));
create policy "Admins add suppliers" on public.product_suppliers as permissive for insert to authenticated
  with check (( select private.is_admin() as is_admin));
create policy "Admins edit suppliers" on public.product_suppliers as permissive for update to authenticated
  using (( select private.is_admin() as is_admin))
  with check (( select private.is_admin() as is_admin));
create policy "Admins delete suppliers" on public.product_suppliers as permissive for delete to authenticated
  using (( select private.is_admin() as is_admin));
revoke all on public.product_suppliers from anon, authenticated;
grant select, insert, update, delete on public.product_suppliers to authenticated;
create trigger product_suppliers_updated_at before update on public.product_suppliers for each row execute function public.set_updated_at();
