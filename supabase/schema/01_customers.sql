-- =====================================================================
-- 01 · Customers: profiles (accounts live in auth.users), seller customer list
-- =====================================================================

create table if not exists public.profiles (
  id uuid not null,
  full_name text,
  phone text,
  address_line text,
  city text,
  state text,
  zip text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade,
  constraint profiles_address_line_check check ((char_length(address_line) <= 200)),
  constraint profiles_city_check check ((char_length(city) <= 100)),
  constraint profiles_full_name_check check ((char_length(full_name) <= 120)),
  constraint profiles_phone_check check ((char_length(phone) <= 40)),
  constraint profiles_state_check check ((char_length(state) <= 60)),
  constraint profiles_zip_check check ((char_length(zip) <= 20))
);
alter table public.profiles enable row level security;
create policy "Customers can create their own profile" on public.profiles as permissive for insert to authenticated
  with check ((( select auth.uid() as uid) = id));
create policy "Customers can read their own profile" on public.profiles as permissive for select to authenticated
  using ((( select auth.uid() as uid) = id));
create policy "Customers can update their own profile" on public.profiles as permissive for update to authenticated
  using ((( select auth.uid() as uid) = id))
  with check ((( select auth.uid() as uid) = id));
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- New sign-up → empty profile with the name from the registration form
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120));
  return new;
end; $function$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Seller Central → Покупці (+ Excel export): accounts + guest buyers grouped by email/phone, with last known address (needs 01 and 04)
create or replace function public.seller_customers()
 returns table(ckey text, name text, email text, phone text, address text, city text, state text, zip text, has_account boolean, orders_count bigint, spent numeric, last_order timestamp with time zone, joined timestamp with time zone)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not private.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  return query
  with ord as (
    select coalesce(lower(u.email), nullif(lower(btrim(o.customer->>'email')), ''),
                    'tel:' || regexp_replace(coalesce(o.customer->>'phone', ''), '\D', '', 'g')) as k,
           o.customer as c, o.total, o.status, o.created_at
      from public.orders o left join auth.users u on u.id = o.user_id),
  agg as (
    select k,
      count(*) filter (where status not in ('cancelled','returned')) as n,
      coalesce(sum(total) filter (where status not in ('cancelled','returned')), 0) as spent,
      max(created_at) as last_at,
      (array_agg(c->>'name' order by created_at desc))[1] as nm,
      (array_agg(c->>'phone' order by created_at desc))[1] as ph,
      (array_agg(c->>'address' order by created_at desc))[1] as ad,
      (array_agg(c->>'city' order by created_at desc))[1] as ct,
      (array_agg(c->>'state' order by created_at desc))[1] as stt,
      (array_agg(c->>'zip' order by created_at desc))[1] as zp,
      (array_agg(nullif(c->>'email', '') order by created_at desc))[1] as em
    from ord group by k),
  acc as (
    select lower(u.email) as k, p.full_name, p.phone, p.address_line, p.city, p.state, p.zip, u.created_at
      from auth.users u left join public.profiles p on p.id = u.id)
  select coalesce(agg.k, acc.k),
         coalesce(nullif(acc.full_name, ''), agg.nm),
         coalesce(acc.k, agg.em, case when agg.k like 'tel:%' then null else agg.k end),
         coalesce(nullif(acc.phone, ''), agg.ph),
         coalesce(agg.ad, nullif(acc.address_line, '')),
         coalesce(agg.ct, nullif(acc.city, '')),
         coalesce(agg.stt, nullif(acc.state, '')),
         coalesce(agg.zp, nullif(acc.zip, '')),
         acc.k is not null,
         coalesce(agg.n, 0), coalesce(agg.spent, 0), agg.last_at, acc.created_at
    from agg full outer join acc on acc.k = agg.k
   order by coalesce(agg.spent, 0) desc, agg.last_at desc nulls last;
end; $function$;
revoke execute on function public.seller_customers() from public, anon;
grant execute on function public.seller_customers() to authenticated;
