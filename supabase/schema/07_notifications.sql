-- =====================================================================
-- 07 · Telegram notifications: new orders, contact messages, chat, low stock
-- The bot token is NOT here: it is saved from Seller Central → Налаштування
-- into Supabase Vault (secret name 'telegram_bot_token').
-- timeout_milliseconds := 15000 — pg_net's default 5 s is sometimes too short for api.telegram.org.
-- =====================================================================

create table if not exists private.notify_settings (
  id integer default 1 not null,
  telegram_chat_id text,
  telegram_chat_name text,
  enabled boolean default false not null,
  updated_at timestamp with time zone default now() not null,
  constraint notify_settings_pkey primary key (id),
  constraint notify_settings_id_check check ((id = 1))
);
revoke all on private.notify_settings from anon, authenticated;
insert into private.notify_settings (id) values (1) on conflict (id) do nothing;

-- ---------- Seller Central → Налаштування → Telegram ----------
create or replace function public.seller_set_telegram_token(token text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare sid uuid; cur text;
begin
  if not private.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  token := btrim(coalesce(token, ''));
  if token !~ '^[0-9]{5,15}:[A-Za-z0-9_-]{30,60}$' then raise exception 'BAD_TOKEN'; end if;
  select id into sid from vault.secrets where name = 'telegram_bot_token';
  select decrypted_secret into cur from vault.decrypted_secrets where name = 'telegram_bot_token';
  if cur = token then return 'same'; end if;  -- re-saving the same token keeps the existing connection
  if sid is null then perform vault.create_secret(token, 'telegram_bot_token', 'CozyHouseVibe order notifications bot');
  else perform vault.update_secret(sid, token); end if;
  update private.notify_settings set enabled = false, telegram_chat_id = null, telegram_chat_name = null, updated_at = now() where id = 1;
  return 'ok';
end; $function$;

create or replace function public.seller_link_telegram()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare tok text; resp record; body jsonb; cid text; cname text;
begin
  if not private.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token';
  if tok is null then raise exception 'NO_TOKEN'; end if;
  -- default timeout of the http extension is 1 s, too short for api.telegram.org
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS', '10000');
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '15000');
  select * into resp from extensions.http_get('https://api.telegram.org/bot' || tok || '/getUpdates?limit=50');
  if resp.status <> 200 then raise exception 'TELEGRAM_ERROR:%', resp.status; end if;
  body := resp.content::jsonb;
  select u->'message'->'chat'->>'id',
         coalesce(u->'message'->'chat'->>'username', u->'message'->'chat'->>'first_name', u->'message'->'chat'->>'title')
    into cid, cname
    from jsonb_array_elements(body->'result') u
   where u ? 'message'
   order by (u->>'update_id')::bigint desc limit 1;
  if cid is null then raise exception 'NO_MESSAGE'; end if;
  update private.notify_settings set telegram_chat_id = cid, telegram_chat_name = cname, enabled = true, updated_at = now() where id = 1;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
    body := jsonb_build_object('chat_id', cid, 'text', '✅ CozyHouseVibe: сповіщення підключено. Сюди приходитимуть нові замовлення, повідомлення з форми «Contact us» і з чату на сайті.'),
    headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 15000);
  return jsonb_build_object('chat', cname);
end; $function$;

create or replace function public.seller_telegram_status()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare s record;
begin
  if not private.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  select * into s from private.notify_settings where id = 1;
  return jsonb_build_object(
    'token_set', exists (select 1 from vault.secrets where name = 'telegram_bot_token'),
    'enabled', coalesce(s.enabled, false), 'chat', s.telegram_chat_name);
end; $function$;

create or replace function public.seller_disable_telegram()
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not private.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  update private.notify_settings set enabled = false, updated_at = now() where id = 1;
  return 'ok';
end; $function$;

revoke execute on function public.seller_set_telegram_token(text), public.seller_link_telegram(), public.seller_telegram_status(), public.seller_disable_telegram() from public, anon;
grant execute on function public.seller_set_telegram_token(text), public.seller_link_telegram(), public.seller_telegram_status(), public.seller_disable_telegram() to authenticated;

-- ---------- 🛒 New order ----------
create or replace function private.notify_new_order()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare s record; tok text; msg text; lines text;
begin
  select * into s from private.notify_settings where id = 1;
  if not coalesce(s.enabled, false) or s.telegram_chat_id is null then return new; end if;
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token';
  if tok is null then return new; end if;
  select string_agg('• ' || (i->>'name')
           || coalesce(' (' || (select string_agg(k || ': ' || v, ', ') from jsonb_each_text(i->'opt') as e(k, v)) || ')', '')
           || ' × ' || (i->>'qty'), E'\n')
    into lines from jsonb_array_elements(new.items) i;
  msg := '🛒 Нове замовлення ' || new.order_no || E'\n\n' || coalesce(lines, '') ||
         E'\n\nРазом: $' || to_char(new.total, 'FM999999990.00') ||
         E'\n' || coalesce(new.customer->>'name', '') || ', ' || coalesce(new.customer->>'phone', '') ||
         E'\n' || coalesce(new.customer->>'delivery', '') ||
         E'\n\nhttps://sashaantonyuk2-pixel.github.io/cozy-house/seller/#/admin/orders';
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
    body := jsonb_build_object('chat_id', s.telegram_chat_id, 'text', msg, 'disable_web_page_preview', true),
    headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 15000);
  return new;
exception when others then
  return new;
end; $function$;
revoke execute on function private.notify_new_order() from public;
create trigger orders_notify after insert on public.orders for each row execute function private.notify_new_order();

-- ---------- ✉️ Contact form message ----------
create or replace function private.notify_new_message()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare s record; tok text;
begin
  select * into s from private.notify_settings where id = 1;
  if not coalesce(s.enabled, false) or s.telegram_chat_id is null then return new; end if;
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token';
  if tok is null then return new; end if;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
    body := jsonb_build_object('chat_id', s.telegram_chat_id, 'disable_web_page_preview', true,
      'text', '✉️ Нове повідомлення від ' || new.name || ' <' || new.email || '>' ||
              coalesce(E'\nЗамовлення: ' || new.order_no, '') || E'\n\n' || left(new.body, 1500) ||
              E'\n\nhttps://sashaantonyuk2-pixel.github.io/cozy-house/seller/#/admin/messages'),
    headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 15000);
  return new;
exception when others then return new;
end; $function$;
revoke execute on function private.notify_new_message() from public;
create trigger messages_notify after insert on public.messages for each row execute function private.notify_new_message();

-- ---------- 💬 Chat (skips quick follow-ups until the seller replies) ----------
create or replace function private.notify_chat()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare s record; tok text; th record; prev record; replied boolean;
begin
  if new.sender <> 'customer' then return new; end if;
  -- skip only a quick follow-up: previous customer message < 10 min ago AND the seller hasn't replied since
  select id, created_at into prev from public.chat_messages
   where thread_id = new.thread_id and sender = 'customer' and id < new.id order by id desc limit 1;
  if prev.id is not null and prev.created_at > now() - interval '10 minutes' then
    select exists (select 1 from public.chat_messages where thread_id = new.thread_id and sender = 'seller' and id > prev.id) into replied;
    if not replied then return new; end if;
  end if;
  select * into s from private.notify_settings where id = 1;
  if not coalesce(s.enabled, false) or s.telegram_chat_id is null then return new; end if;
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token';
  if tok is null then return new; end if;
  select name, email into th from public.chat_threads where id = new.thread_id;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
    body := jsonb_build_object('chat_id', s.telegram_chat_id, 'disable_web_page_preview', true,
      'text', '💬 Чат на сайті: ' || coalesce(th.name, 'Відвідувач') || coalesce(' <' || th.email || '>', '') ||
              E'\n\n' || left(new.body, 1500) ||
              E'\n\nВідповісти: https://sashaantonyuk2-pixel.github.io/cozy-house/seller/#/admin/chat?t=' || new.thread_id),
    headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 15000);
  return new;
exception when others then return new;
end; $function$;
create trigger chat_messages_notify after insert on public.chat_messages for each row execute function private.notify_chat();

-- ---------- ⚠️ Low stock / ❌ out of stock ----------
create or replace function private.notify_low_stock()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare s record; tok text; thr int; v text; msg text;
begin
  if not new.active or new.stock >= old.stock then return new; end if;
  select data->>'lowStock' into v from public.store_settings where id = 1;
  thr := coalesce(case when v ~ '^\d+$' then v::int end, 3);
  -- alert only when the stock crosses the threshold (or hits zero), not on every sale
  if not ((old.stock > thr and new.stock <= thr) or (old.stock > 0 and new.stock = 0)) then return new; end if;
  select * into s from private.notify_settings where id = 1;
  if not coalesce(s.enabled, false) or s.telegram_chat_id is null then return new; end if;
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token';
  if tok is null then return new; end if;
  msg := case when new.stock = 0
              then '❌ Закінчився товар: ' || new.name || coalesce(' (' || nullif(new.sku, '') || ')', '') || E'\nНа сайті він тепер «Out of stock».'
              else '⚠️ Закінчується: ' || new.name || coalesce(' (' || nullif(new.sku, '') || ')', '') || E'\nЗалишилось: ' || new.stock || ' шт.' end
         || E'\n\nhttps://sashaantonyuk2-pixel.github.io/cozy-house/seller/#/admin/product/' || new.id;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
    body := jsonb_build_object('chat_id', s.telegram_chat_id, 'text', msg, 'disable_web_page_preview', true),
    headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 15000);
  return new;
exception when others then return new;
end; $function$;
create trigger products_low_stock after update of stock on public.products for each row execute function private.notify_low_stock();
