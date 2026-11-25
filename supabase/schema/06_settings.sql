-- =====================================================================
-- 06 · Store settings: one row (id = 1) with all settings as JSON
-- (name, email, address, banner, shipping texts, legal pages, SEO, lowStock …)
-- Shipping & tax keys read by private.prepare_order: shipStandard (12), freeFrom (100), expressOn (false), shipExpress (25),
-- taxRates ({"FL": 7} — percent by state), taxShipping (false); returnDays (14) is read by private.return_guard.
-- =====================================================================

create table if not exists public.store_settings (
  id integer default 1 not null,
  data jsonb default '{}'::jsonb not null,
  updated_at timestamp with time zone default now() not null,
  constraint store_settings_pkey primary key (id),
  constraint store_settings_data_check check (((jsonb_typeof(data) = 'object'::text) and (pg_column_size(data) < 3000000))),
  constraint store_settings_id_check check ((id = 1))
);
alter table public.store_settings enable row level security;
create policy "Admins edit settings" on public.store_settings as permissive for update to authenticated
  using (( select private.is_admin() as is_admin))
  with check (( select private.is_admin() as is_admin));
create policy "Anyone can read store settings" on public.store_settings as permissive for select to anon, authenticated
  using (true);
create trigger audit_settings after update on public.store_settings for each row execute function public.log_change();
create trigger settings_updated_at before update on public.store_settings for each row execute function public.set_updated_at();

insert into public.store_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
