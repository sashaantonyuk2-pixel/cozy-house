-- =====================================================================
-- 03 · Reviews: star ratings, moderation, "verified purchase"
-- =====================================================================

create table if not exists public.reviews (
  id bigint generated always as identity not null,
  product_id text not null,
  user_id uuid default auth.uid(),
  name text not null,
  rating smallint not null,
  title text,
  body text not null,
  verified boolean default false not null,
  status text default 'pending'::text not null,   -- pending → approved / rejected (seller moderates)
  created_at timestamp with time zone default now() not null,
  constraint reviews_product_id_user_id_key unique (product_id, user_id),
  constraint reviews_pkey primary key (id),
  constraint reviews_product_id_fkey foreign key (product_id) references public.products(id) on delete cascade,
  constraint reviews_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null,
  constraint reviews_body_check check (((char_length(btrim(body)) >= 10) and (char_length(btrim(body)) <= 3000))),
  constraint reviews_name_check check (((char_length(btrim(name)) >= 1) and (char_length(btrim(name)) <= 60))),
  constraint reviews_rating_check check (((rating >= 1) and (rating <= 5))),
  constraint reviews_status_check check ((status = any (array['pending'::text, 'approved'::text, 'rejected'::text]))),
  constraint reviews_title_check check (((title is null) or (char_length(title) <= 120)))
);
create index if not exists reviews_product_idx on public.reviews using btree (product_id, status);
alter table public.reviews enable row level security;
create policy "Admins delete reviews" on public.reviews as permissive for delete to authenticated
  using (( select private.is_admin() as is_admin));
create policy "Admins moderate reviews" on public.reviews as permissive for update to authenticated
  using (( select private.is_admin() as is_admin))
  with check (( select private.is_admin() as is_admin));
create policy "Anyone reads approved reviews" on public.reviews as permissive for select to anon, authenticated
  using (((status = 'approved'::text) or (user_id = ( select auth.uid() as uid)) or ( select private.is_admin() as is_admin)));
create policy "Signed-in customers write a review" on public.reviews as permissive for insert to authenticated
  with check (((user_id = ( select auth.uid() as uid)) and (status = 'pending'::text)));
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant delete on public.reviews to authenticated;
grant insert (product_id, name, rating, title, body) on public.reviews to authenticated;
grant update (status) on public.reviews to authenticated;

-- max 5 reviews/day per customer; marks "verified" if the customer ordered this product
create or replace function private.review_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.reviews r where r.user_id = new.user_id and r.created_at > now() - interval '1 day') >= 5 then
      raise exception 'TOO_MANY_REVIEWS';
    end if;
    new.status := 'pending';
    new.created_at := now();
    new.name := btrim(new.name);
    new.verified := exists (
      select 1 from public.orders o, jsonb_array_elements(o.items) i
       where o.user_id = new.user_id and o.status not in ('cancelled')
         and i->>'id' = new.product_id);
  end if;
  return new;
end; $function$;
create trigger reviews_guard before insert on public.reviews for each row execute function private.review_guard();
create trigger audit_reviews after delete or update on public.reviews for each row execute function public.log_change();
