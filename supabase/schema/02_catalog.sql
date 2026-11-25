-- =====================================================================
-- 02 · Catalog: categories, products (variants, SEO, stock), product photos
-- =====================================================================

create table if not exists public.categories (
  id text not null,
  name text not null,
  image text,
  "position" integer default 0 not null,
  updated_at timestamp with time zone default now() not null,
  constraint categories_pkey primary key (id),
  constraint categories_id_check check ((id ~ '^[a-z0-9-]{1,40}$'::text)),
  constraint categories_image_check check ((char_length(image) <= 500000)),
  constraint categories_name_check check (((char_length(name) >= 1) and (char_length(name) <= 80)))
);
alter table public.categories enable row level security;
create policy "Admins add categories" on public.categories as permissive for insert to authenticated
  with check (( select private.is_admin() as is_admin));
create policy "Admins delete categories" on public.categories as permissive for delete to authenticated
  using (( select private.is_admin() as is_admin));
create policy "Admins edit categories" on public.categories as permissive for update to authenticated
  using (( select private.is_admin() as is_admin))
  with check (( select private.is_admin() as is_admin));
create policy "Anyone can read categories" on public.categories as permissive for select to anon, authenticated
  using (true);
create trigger audit_categories after insert or delete or update on public.categories for each row execute function public.log_change();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();

create table if not exists public.products (
  id text not null,
  name text not null,
  sku text,
  category_id text,
  price numeric(10,2) not null,
  old_price numeric(10,2),
  stock integer default 0 not null,
  active boolean default true not null,
  featured boolean default false not null,
  short_description text,
  description text,
  specs jsonb default '[]'::jsonb not null,        -- [{"k":"Material","v":"Ceramic"}]
  images jsonb default '[]'::jsonb not null,       -- ["https://…", …]
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  options jsonb default '[]'::jsonb not null,      -- variants: [{"name":"Color","values":["Sage","Oat"]}]
  "position" integer default 0 not null,           -- manual order on the storefront
  seo_title text,
  seo_description text,
  image_alt text,
  constraint products_pkey primary key (id),
  constraint products_category_id_fkey foreign key (category_id) references public.categories(id) on update cascade on delete set null,
  constraint products_description_check check ((char_length(description) <= 20000)),
  constraint products_id_check check ((id ~ '^[A-Za-z0-9_-]{1,40}$'::text)),
  constraint products_images_check check (((jsonb_typeof(images) = 'array'::text) and (pg_column_size(images) < 2000000))),
  constraint products_name_check check (((char_length(name) >= 1) and (char_length(name) <= 200))),
  constraint products_old_price_check check (((old_price is null) or (old_price >= (0)::numeric))),
  constraint products_options_check check (((jsonb_typeof(options) = 'array'::text) and (jsonb_array_length(options) <= 5) and (pg_column_size(options) < 4000))),
  constraint products_position_check check (((("position" >= 0) and ("position" < 1000000)))),
  constraint products_price_check check ((price >= (0)::numeric)),
  constraint products_seo_check check ((((seo_title is null) or (char_length(seo_title) <= 120)) and ((seo_description is null) or (char_length(seo_description) <= 320)) and ((image_alt is null) or (char_length(image_alt) <= 200)))),
  constraint products_short_description_check check ((char_length(short_description) <= 300)),
  constraint products_sku_check check ((char_length(sku) <= 60)),
  constraint products_specs_check check ((jsonb_typeof(specs) = 'array'::text)),
  constraint products_stock_check check ((stock >= 0))
);
create index if not exists products_category_idx on public.products using btree (category_id);
alter table public.products enable row level security;
create policy "Admins add products" on public.products as permissive for insert to authenticated
  with check (( select private.is_admin() as is_admin));
create policy "Admins delete products" on public.products as permissive for delete to authenticated
  using (( select private.is_admin() as is_admin));
create policy "Admins edit products" on public.products as permissive for update to authenticated
  using (( select private.is_admin() as is_admin))
  with check (( select private.is_admin() as is_admin));
create policy "Anyone can read active products" on public.products as permissive for select to anon, authenticated
  using ((active or ( select private.is_admin() as is_admin)));
create trigger audit_products after insert or delete or update on public.products for each row execute function public.log_change();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
-- low-stock Telegram alert trigger: see 07_notifications.sql

-- ---------- Product photos (Storage bucket) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "Admins upload product images" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'product-images'::text) and ( select private.is_admin() as is_admin)));
create policy "Admins update product images" on storage.objects as permissive for update to authenticated
  using (((bucket_id = 'product-images'::text) and ( select private.is_admin() as is_admin)));
create policy "Admins delete product images" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'product-images'::text) and ( select private.is_admin() as is_admin)));
