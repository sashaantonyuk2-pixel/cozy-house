-- =====================================================================
-- 11 · Product photos (needs 00, 02). Files live in Storage bucket product-images (02_catalog.sql);
-- this table is the catalog: one row per photo — product, position, url, storage path, caption (alt).
-- Kept in sync automatically from products.images, captions survive reordering (matched by url).
-- =====================================================================

create table if not exists public.product_images (
  id bigint generated always as identity not null,
  product_id text not null,
  position integer not null,
  url text not null,
  storage_path text,              -- path inside bucket product-images, null if the file is elsewhere
  alt text,
  created_at timestamp with time zone default now() not null,
  constraint product_images_pkey primary key (id),
  constraint product_images_product_id_fkey foreign key (product_id) references public.products(id) on update cascade on delete cascade,
  constraint product_images_pos_key unique (product_id, position),
  constraint product_images_url_check check (char_length(url) <= 1000 and url ~* '^(https?://|images/)'),
  constraint product_images_alt_check check (alt is null or char_length(alt) <= 200)
);
create index if not exists product_images_path_idx on public.product_images using btree (storage_path);
alter table public.product_images enable row level security;
create policy "Anyone can see product photos" on public.product_images as permissive for select to anon, authenticated using (true);
create policy "Admins edit photo captions" on public.product_images as permissive for update to authenticated
  using (( select private.is_admin() as is_admin)) with check (( select private.is_admin() as is_admin));
revoke all on public.product_images from anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant update (alt) on public.product_images to authenticated;

create or replace function private.sync_product_images()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare alts jsonb;
begin
  if tg_op = 'UPDATE' and new.images is not distinct from old.images then return new; end if;
  select coalesce(jsonb_object_agg(url, alt), '{}'::jsonb) into alts from public.product_images where product_id = new.id and alt is not null;
  delete from public.product_images where product_id = new.id;
  insert into public.product_images (product_id, position, url, storage_path, alt)
  select new.id, x.n::int, x.u,
         nullif(substring(x.u from '/storage/v1/object/public/product-images/(.+)$'), ''),
         alts->>x.u
    from jsonb_array_elements_text(coalesce(new.images, '[]'::jsonb)) with ordinality as x(u, n)
   where x.u ~* '^(https?://|images/)' and char_length(x.u) <= 1000;
  return new;
end; $function$;
revoke execute on function private.sync_product_images() from public;
create trigger products_sync_images after insert or update of images on public.products for each row execute function private.sync_product_images();
