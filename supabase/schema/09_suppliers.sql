-- =====================================================================
-- 09 · Suppliers (needs 00, 02). Seller Central only — admin-only RLS, never readable by customers or visitors.
--   suppliers          — directory: contacts and terms, one row per supplier
--   product_suppliers  — per product: link to supplier, supplier SKU, cost price, link to the item
-- (kept out of public.products on purpose: products is readable by everyone)
-- =====================================================================

create table if not exists public.suppliers (
  id uuid default gen_random_uuid() not null,
  name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  address text,
  payment_terms text,
  lead_time text,
  min_order text,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint suppliers_pkey primary key (id),
  constraint suppliers_name_check check (char_length(btrim(name)) between 1 and 80),
  constraint suppliers_email_check check (email is null or (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  constraint suppliers_website_check check (website is null or (char_length(website) <= 300 and website ~* '^https?://')),
  constraint suppliers_text_check check (coalesce(char_length(contact_name),0) <= 120 and coalesce(char_length(phone),0) <= 40 and coalesce(char_length(address),0) <= 300
    and coalesce(char_length(payment_terms),0) <= 200 and coalesce(char_length(lead_time),0) <= 100 and coalesce(char_length(min_order),0) <= 100 and coalesce(char_length(notes),0) <= 4000)
);
create unique index if not exists suppliers_name_key on public.suppliers using btree (lower(btrim(name)));
alter table public.suppliers enable row level security;
create policy "Admins read supplier directory" on public.suppliers as permissive for select to authenticated using (( select private.is_admin() as is_admin));
create policy "Admins add to supplier directory" on public.suppliers as permissive for insert to authenticated with check (( select private.is_admin() as is_admin));
create policy "Admins edit supplier directory" on public.suppliers as permissive for update to authenticated using (( select private.is_admin() as is_admin)) with check (( select private.is_admin() as is_admin));
create policy "Admins delete from supplier directory" on public.suppliers as permissive for delete to authenticated using (( select private.is_admin() as is_admin));
revoke all on public.suppliers from anon, authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;
create trigger suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger audit_suppliers after insert or delete or update on public.suppliers for each row execute function public.log_change();
-- list fields (status, type, fixed choices for terms) — migration suppliers_list_fields, 25.11.2026
alter table public.suppliers
  add column if not exists status text not null default 'active',
  add column if not exists kind text,
  add column if not exists country text,
  add column if not exists currency text,
  add column if not exists payment_method text,
  add column if not exists lead_days_min smallint,
  add column if not exists lead_days_max smallint,
  add column if not exists shipping text,
  add column if not exists defect_returns text,
  add column if not exists rating smallint;
alter table public.suppliers
  add constraint suppliers_status_check check (status in ('active','paused','archived')),
  add constraint suppliers_kind_check check (kind is null or kind in ('manufacturer','wholesaler','dropship','marketplace','handmade')),
  add constraint suppliers_country_check check (country is null or char_length(country) <= 60),
  add constraint suppliers_currency_check check (currency is null or currency in ('USD','EUR','UAH','CNY','GBP')),
  add constraint suppliers_payment_method_check check (payment_method is null or payment_method in ('bank','card','paypal','other')),
  add constraint suppliers_lead_days_check check ((lead_days_min is null or lead_days_min between 0 and 365) and (lead_days_max is null or lead_days_max between 0 and 365) and (lead_days_min is null or lead_days_max is null or lead_days_min <= lead_days_max)),
  add constraint suppliers_shipping_check check (shipping is null or shipping in ('free','fixed','weight')),
  add constraint suppliers_defect_returns_check check (defect_returns is null or defect_returns in ('yes','partial','no')),
  add constraint suppliers_rating_check check (rating is null or rating between 1 and 5);

create table if not exists public.product_suppliers (
  product_id text not null,
  supplier_sku text,
  cost_price numeric(10,2),
  supplier_url text,
  updated_at timestamp with time zone default now() not null,
  supplier_id uuid,
  constraint product_suppliers_pkey primary key (product_id),
  constraint product_suppliers_product_id_fkey foreign key (product_id) references public.products(id) on update cascade on delete cascade,
  constraint product_suppliers_supplier_id_fkey foreign key (supplier_id) references public.suppliers(id) on delete set null,
  constraint product_suppliers_sku_check check (supplier_sku is null or char_length(supplier_sku) <= 80),
  constraint product_suppliers_cost_check check (cost_price is null or (cost_price >= 0 and cost_price < 1000000)),
  constraint product_suppliers_url_check check (supplier_url is null or (char_length(supplier_url) <= 500 and supplier_url ~* '^https?://'))
);
create index if not exists product_suppliers_sku_idx on public.product_suppliers using btree (lower(supplier_sku));
create index if not exists product_suppliers_supplier_idx on public.product_suppliers using btree (supplier_id);
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
