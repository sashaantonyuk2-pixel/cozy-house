-- =====================================================================
-- 08 · Returns: customer return requests with photos / video (needs 00, 04, 06, 07)
-- Flow: requested → approved / rejected → received (stock back) → refunded
-- Free return shipping for "defective" and "poor_condition"; the customer pays for the others.
-- =====================================================================

create table if not exists public.return_requests (
  id bigint generated always as identity not null,
  order_id bigint not null,
  user_id uuid default auth.uid(),
  reason text not null,                           -- better_price | poor_condition | defective | not_as_expected
  details text,
  items jsonb default '[]'::jsonb not null,      -- [{i, id, name, sku, price, qty, opt}] — filled by the database from the order
  media jsonb default '[]'::jsonb not null,      -- storage paths in bucket return-media: "<user id>/<file>"
  free_return boolean default false not null,     -- true for defective / poor condition: the shop pays return shipping
  status text default 'requested'::text not null,
  seller_note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint return_requests_pkey primary key (id),
  constraint return_requests_order_id_fkey foreign key (order_id) references public.orders(id) on delete cascade,
  constraint return_requests_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null,
  constraint return_requests_reason_check check (reason = any (array['better_price','poor_condition','defective','not_as_expected'])),
  constraint return_requests_details_check check (details is null or char_length(details) <= 2000),
  constraint return_requests_items_check check (jsonb_typeof(items) = 'array' and pg_column_size(items) < 20000),
  constraint return_requests_media_check check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 8),
  constraint return_requests_status_check check (status = any (array['requested','approved','rejected','received','refunded'])),
  constraint return_requests_note_check check (seller_note is null or char_length(seller_note) <= 2000)
);
create index if not exists return_requests_order_idx on public.return_requests using btree (order_id);
create index if not exists return_requests_status_idx on public.return_requests using btree (status, created_at desc);
alter table public.return_requests enable row level security;
create policy "Customers read own return requests, admins read all" on public.return_requests as permissive for select to authenticated
  using (((user_id = ( select auth.uid() as uid)) or ( select private.is_admin() as is_admin)));
create policy "Customers request a return" on public.return_requests as permissive for insert to authenticated
  with check (((user_id = ( select auth.uid() as uid)) and (status = 'requested'::text)));
create policy "Admins handle return requests" on public.return_requests as permissive for update to authenticated
  using (( select private.is_admin() as is_admin))
  with check (( select private.is_admin() as is_admin));
revoke all on public.return_requests from anon, authenticated;
grant select on public.return_requests to authenticated;
grant insert (order_id, reason, details, items, media) on public.return_requests to authenticated;
grant update (status, seller_note) on public.return_requests to authenticated;

-- checks a customer's request: own order, shipped/delivered, inside the return window, items from the order, own photos
create or replace function private.return_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare o record; base timestamptz; days int; num text; it jsonb; oi jsonb; idx int; q int; out_items jsonb := '[]'::jsonb; m jsonb;
begin
  select * into o from public.orders where id = new.order_id;
  if not found or o.user_id is null or o.user_id is distinct from auth.uid() then raise exception 'NOT_YOUR_ORDER'; end if;
  if o.status not in ('shipped', 'completed') then raise exception 'NOT_RETURNABLE'; end if;
  select s.data->>'returnDays' into num from public.store_settings s where s.id = 1;
  days := case when num ~ '^\d{1,3}$' then num::int else 14 end;
  base := coalesce(o.delivered_at, o.shipped_at + interval '7 days', o.created_at + interval '10 days');
  if now() > base + make_interval(days => days) then raise exception 'RETURN_WINDOW_CLOSED'; end if;
  if exists (select 1 from public.return_requests r where r.order_id = new.order_id and r.status <> 'rejected') then raise exception 'ALREADY_REQUESTED'; end if;
  if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) = 0 then raise exception 'NO_ITEMS'; end if;
  for it in select * from jsonb_array_elements(new.items) loop
    begin idx := (it->>'i')::int; q := (it->>'qty')::int; exception when others then raise exception 'BAD_ITEM'; end;
    oi := o.items->idx;
    if oi is null or q is null or q < 1 or q > coalesce((oi->>'qty')::int, 0) then raise exception 'BAD_ITEM'; end if;
    out_items := out_items || jsonb_build_array(jsonb_build_object('i', idx, 'id', oi->>'id', 'name', oi->>'name', 'sku', oi->>'sku', 'price', oi->'price', 'qty', q)
                 || case when oi ? 'opt' then jsonb_build_object('opt', oi->'opt') else '{}'::jsonb end);
  end loop;
  if jsonb_typeof(new.media) <> 'array' or jsonb_array_length(new.media) < 1 then raise exception 'NO_MEDIA'; end if;
  for m in select * from jsonb_array_elements(new.media) loop
    if jsonb_typeof(m) <> 'string' or left(m #>> '{}', 37) <> auth.uid()::text || '/' or char_length(m #>> '{}') > 200 then raise exception 'BAD_MEDIA'; end if;
  end loop;
  new.items := out_items; new.user_id := auth.uid(); new.status := 'requested'; new.seller_note := null; new.created_at := now(); new.updated_at := now();
  new.free_return := new.reason in ('defective', 'poor_condition');
  new.details := nullif(btrim(coalesce(new.details, '')), '');
  return new;
end; $function$;
revoke execute on function private.return_guard() from public;
create trigger return_requests_guard before insert on public.return_requests for each row execute function private.return_guard();
create trigger return_requests_updated_at before update on public.return_requests for each row execute function public.set_updated_at();

-- 🔁 Telegram alert for a new return request
create or replace function private.notify_return_request()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare s record; tok text; ono text; lines text;
begin
  select * into s from private.notify_settings where id = 1;
  if not coalesce(s.enabled, false) or s.telegram_chat_id is null then return new; end if;
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token';
  if tok is null then return new; end if;
  select order_no into ono from public.orders where id = new.order_id;
  select string_agg('• ' || (i->>'name') || ' × ' || (i->>'qty'), E'\n') into lines from jsonb_array_elements(new.items) i;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
    body := jsonb_build_object('chat_id', s.telegram_chat_id, 'disable_web_page_preview', true,
      'text', '🔁 Заявка на повернення ' || coalesce(ono, '') || E'\n' ||
              'Причина: ' || case new.reason when 'better_price' then 'Краща ціна' when 'poor_condition' then 'Товар у поганому стані'
                                             when 'defective' then 'Бракований товар' else 'Товарний вигляд (не як на фото)' end ||
              case when new.free_return then ' · доставка за наш рахунок' else ' · доставку оплачує покупець' end ||
              E'\n' || coalesce(lines, '') || coalesce(E'\n\n' || left(new.details, 800), '') ||
              E'\n\nhttps://sashaantonyuk2-pixel.github.io/cozy-house/seller/#/admin/returns'),
    headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 15000);
  return new;
exception when others then return new;
end; $function$;
revoke execute on function private.notify_return_request() from public;
create trigger return_requests_notify after insert on public.return_requests for each row execute function private.notify_return_request();
create trigger audit_return_requests after update on public.return_requests for each row execute function public.log_change();

-- private bucket for return photos / videos (customer writes only into their own folder; links for the seller are signed, 1 hour)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('return-media', 'return-media', false, 52428800, array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do nothing;
create policy "Customers upload return media" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'return-media'::text) and ((storage.foldername(name))[1] = (( select auth.uid() as uid))::text)));
create policy "Customers and admins view return media" on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'return-media'::text) and (((storage.foldername(name))[1] = (( select auth.uid() as uid))::text) or ( select private.is_admin() as is_admin))));
create policy "Admins delete return media" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'return-media'::text) and ( select private.is_admin() as is_admin)));
