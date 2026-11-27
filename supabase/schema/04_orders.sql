-- =====================================================================
-- 04 · Orders: checkout validation, stock, statuses, payment, tracking
-- The cart itself is NOT in the database: it lives in the customer's browser
-- (localStorage) until checkout, when it becomes orders.items.
-- =====================================================================

create table if not exists public.orders (
  id bigint generated always as identity not null,
  order_no text not null,                          -- CHV-YYMMDD-NNNN
  user_id uuid default auth.uid(),                 -- null for guest checkout
  status text default 'new'::text not null,
  customer jsonb not null,                         -- name, email, phone, address, city, state, zip, delivery, note
  items jsonb not null,                            -- [{id, name, sku, price, qty, opt}] — prices filled by the database
  total numeric(10,2) not null,
  currency text default 'USD'::text not null,
  created_at timestamp with time zone default now() not null,
  carrier text,
  tracking_number text,
  shipped_at timestamp with time zone,
  return_reason text,
  returned_at timestamp with time zone,
  delivery_eta date,
  delivered_at timestamp with time zone,
  payment_status text default 'unpaid'::text not null,
  payment_method text,
  payment_ref text,
  paid_amount numeric,
  paid_at timestamp with time zone,
  refund_amount numeric,
  refunded_at timestamp with time zone,
  admin_note text,
  subtotal numeric(10,2),                          -- items only
  shipping numeric(10,2) default 0 not null,       -- Standard / Express price from settings
  tax numeric(10,2) default 0 not null,            -- sales tax by shipping state (settings.taxRates)
  tax_rate numeric(6,3) default 0 not null,        -- percent used for this order
  constraint orders_order_no_key unique (order_no),
  constraint orders_pkey primary key (id),
  constraint orders_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null,
  constraint orders_carrier_check check ((char_length(carrier) <= 40)),
  constraint orders_currency_check check ((char_length(currency) <= 8)),
  constraint orders_customer_check check (((jsonb_typeof(customer) = 'object'::text) and (pg_column_size(customer) < 4000))),
  constraint orders_delivery_eta_check check (((delivery_eta is null) or ((delivery_eta >= '2024-01-01'::date) and (delivery_eta <= '2100-01-01'::date)))),
  constraint orders_items_check check (((jsonb_typeof(items) = 'array'::text) and ((jsonb_array_length(items) >= 1) and (jsonb_array_length(items) <= 100)) and (pg_column_size(items) < 20000))),
  constraint orders_order_no_check check ((order_no ~ '^CHV-[0-9]{6}-[0-9]{4}$'::text)),
  constraint orders_payment_check check (((payment_status = any (array['unpaid'::text, 'paid'::text, 'partially_refunded'::text, 'refunded'::text])) and ((payment_method is null) or (char_length(payment_method) <= 40)) and ((payment_ref is null) or (char_length(payment_ref) <= 120)) and ((paid_amount is null) or ((paid_amount >= (0)::numeric) and (paid_amount < (1000000)::numeric))) and ((refund_amount is null) or ((refund_amount >= (0)::numeric) and (refund_amount < (1000000)::numeric))) and ((admin_note is null) or (char_length(admin_note) <= 4000)))),
  constraint orders_return_reason_check check ((char_length(return_reason) <= 300)),
  constraint orders_status_check check ((status = any (array['new'::text, 'confirmed'::text, 'shipped'::text, 'completed'::text, 'cancelled'::text, 'returned'::text]))),
  constraint orders_total_check check (((total >= (0)::numeric) and (total < (1000000)::numeric))),
  constraint orders_tracking_number_check check ((char_length(tracking_number) <= 80)),
  constraint orders_amounts_check check (((subtotal is null) or ((subtotal >= (0)::numeric) and (subtotal < (1000000)::numeric))) and (shipping >= (0)::numeric) and (shipping < (10000)::numeric) and (tax >= (0)::numeric) and (tax < (100000)::numeric) and (tax_rate >= (0)::numeric) and (tax_rate <= (20)::numeric))
);
create index if not exists orders_user_id_idx on public.orders using btree (user_id);
alter table public.orders enable row level security;
create policy "Admins can update orders" on public.orders as permissive for update to authenticated
  using (( select private.is_admin() as is_admin))
  with check (( select private.is_admin() as is_admin));
create policy "Anyone can place a new order" on public.orders as permissive for insert to anon, authenticated
  with check (((status = 'new'::text) and (not (user_id is distinct from ( select auth.uid() as uid)))));
create policy "Customers read own orders, admins read all" on public.orders as permissive for select to authenticated
  using (((user_id = ( select auth.uid() as uid)) or ( select private.is_admin() as is_admin)));
revoke update, delete on public.orders from anon, authenticated;
grant update (status, customer, carrier, tracking_number, shipped_at, return_reason, delivery_eta, payment_status, payment_method, payment_ref, paid_amount, paid_at, refund_amount, refunded_at, admin_note) on public.orders to authenticated;

-- One place that validates and prices an order: required fields (street address must have a house number),
-- real prices from products, variants, stock check, shipping (Standard / Express from settings) and sales tax by state.
-- Used by the checkout trigger below and by the payment module (public.checkout_quote → Edge Function payments-checkout).
create or replace function private.quote_order(c jsonb, items jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare it jsonb; pr record; out_items jsonb := '[]'::jsonb; tot numeric := 0; q int;
        o jsonb; chosen jsonb; pick text; opt_out jsonb; line jsonb;
        st jsonb; num text; v_std numeric; v_exp numeric; exp_on boolean; is_exp boolean;
        ship numeric; rate numeric; taxable numeric; dlabel text; tax numeric;
begin
  c := coalesce(c, '{}'::jsonb);
  if coalesce(btrim(c->>'name'), '') = '' then raise exception 'BAD_FIELD:name'; end if;
  if coalesce(c->>'email', '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'BAD_FIELD:email'; end if;
  if char_length(regexp_replace(coalesce(c->>'phone', ''), '\D', '', 'g')) < 10 then raise exception 'BAD_FIELD:phone'; end if;
  if coalesce(btrim(c->>'address'), '') !~ '[0-9]' or coalesce(c->>'address', '') !~ '[A-Za-z]' then raise exception 'BAD_FIELD:address'; end if;
  if coalesce(btrim(c->>'city'), '') = '' then raise exception 'BAD_FIELD:city'; end if;
  if coalesce(c->>'state', '') !~ '^[A-Z]{2}$' then raise exception 'BAD_FIELD:state'; end if;
  if coalesce(c->>'zip', '') !~ '^\d{5}(-\d{4})?$' then raise exception 'BAD_FIELD:zip'; end if;
  if char_length(coalesce(c->>'address2', '')) > 100 then raise exception 'BAD_FIELD:address2'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 100 then raise exception 'BAD_ITEMS'; end if;
  c := c || jsonb_build_object('email', lower(btrim(c->>'email')));

  for it in select * from jsonb_array_elements(items) loop
    begin q := (it->>'qty')::int; exception when others then q := null; end;
    if q is null or q < 1 or q > 999 then raise exception 'BAD_QTY'; end if;
    select p.id, p.name, p.sku, p.price, p.stock, p.active, p.options into pr from public.products p where p.id = it->>'id';
    if not found or not pr.active then raise exception 'UNAVAILABLE:%', left(coalesce(it->>'name', 'item'), 120); end if;
    chosen := case when jsonb_typeof(it->'opt') = 'object' then it->'opt' else '{}'::jsonb end;
    opt_out := '{}'::jsonb;
    for o in select * from jsonb_array_elements(coalesce(pr.options, '[]'::jsonb)) loop
      if jsonb_array_length(coalesce(o->'values', '[]'::jsonb)) = 0 then continue; end if;
      pick := chosen->>(o->>'name');
      if pick is null or not (o->'values') ? pick then raise exception 'OPTION_REQUIRED:%:%', pr.name, o->>'name'; end if;
      opt_out := opt_out || jsonb_build_object(o->>'name', pick);
    end loop;
    if pr.stock < q then raise exception 'OUT_OF_STOCK:%:%', pr.name, pr.stock; end if;
    line := jsonb_build_object('id', pr.id, 'name', pr.name, 'sku', pr.sku, 'price', pr.price, 'qty', q);
    if opt_out <> '{}'::jsonb then line := line || jsonb_build_object('opt', opt_out); end if;
    out_items := out_items || jsonb_build_array(line);
    tot := tot + pr.price * q;
  end loop;

  select coalesce(s.data, '{}'::jsonb) into st from public.store_settings s where s.id = 1;
  st := coalesce(st, '{}'::jsonb);
  num := st->>'shipStandard'; v_std := case when num ~ '^\d+(\.\d+)?$' then num::numeric else 12 end;
  num := st->>'shipExpress';  v_exp := case when num ~ '^\d+(\.\d+)?$' then num::numeric else 25 end;
  exp_on := coalesce(st->>'expressOn', '') in ('true', '1');
  is_exp := exp_on and coalesce(c->>'delivery', '') ~* 'express';
  if is_exp then ship := v_exp; dlabel := 'Express shipping (1–2 business days)';
  else ship := v_std; dlabel := 'Standard shipping (3–5 business days)'; end if;
  num := st->'taxRates'->>(c->>'state');
  rate := case when num ~ '^\d+(\.\d+)?$' then least(num::numeric, 20) else 0 end;
  taxable := tot + case when coalesce(st->>'taxShipping', '') in ('true', '1') then ship else 0 end;
  tax := round(taxable * rate / 100, 2);
  return jsonb_build_object('customer', c || jsonb_build_object('delivery', dlabel), 'items', out_items,
    'subtotal', tot, 'shipping', ship, 'tax_rate', rate, 'tax', tax, 'total', tot + ship + tax, 'currency', 'USD');
end; $function$;
revoke execute on function private.quote_order(jsonb, jsonb) from public;

-- Checkout trigger: shared calculation, then reserves stock (atomic: never sells more than in stock)
create or replace function private.prepare_order()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare q jsonb; it jsonb; left_qty int;
begin
  perform set_config('app.order_ctx', '1', true);
  q := private.quote_order(new.customer, new.items);
  for it in select * from jsonb_array_elements(q->'items') loop
    update public.products set stock = stock - (it->>'qty')::int where id = it->>'id' and stock >= (it->>'qty')::int;
    if not found then
      select stock into left_qty from public.products where id = it->>'id';
      raise exception 'OUT_OF_STOCK:%:%', it->>'name', coalesce(left_qty, 0);
    end if;
  end loop;
  new.customer := q->'customer'; new.items := q->'items';
  new.subtotal := (q->>'subtotal')::numeric; new.shipping := (q->>'shipping')::numeric;
  new.tax_rate := (q->>'tax_rate')::numeric; new.tax := (q->>'tax')::numeric; new.total := (q->>'total')::numeric;
  new.status := 'new';
  new.carrier := null; new.tracking_number := null; new.shipped_at := null; new.delivery_eta := null; new.delivered_at := null; new.payment_status := 'unpaid'; new.payment_method := null; new.payment_ref := null; new.paid_amount := null; new.paid_at := null; new.refund_amount := null; new.refunded_at := null; new.admin_note := null;
  return new;
end; $function$;
revoke execute on function private.prepare_order() from public;
create trigger orders_prepare before insert on public.orders for each row execute function private.prepare_order();

-- Status change: return stock on cancel/return, set shipped/delivered/returned dates
create or replace function private.order_status_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare it jsonb; was_out boolean; now_out boolean;
begin
  if new.status is distinct from old.status then
    perform set_config('app.order_ctx', '1', true);
    was_out := old.status in ('cancelled','returned');
    now_out := new.status in ('cancelled','returned');
    if now_out and not was_out then
      for it in select * from jsonb_array_elements(new.items) loop
        update public.products set stock = stock + coalesce((it->>'qty')::int, 0) where id = it->>'id';
      end loop;
    elsif was_out and not now_out then
      for it in select * from jsonb_array_elements(new.items) loop
        update public.products set stock = greatest(stock - coalesce((it->>'qty')::int, 0), 0) where id = it->>'id';
      end loop;
    end if;
    if new.status = 'shipped' and new.shipped_at is null then new.shipped_at := now(); end if;
    if new.status = 'completed' then new.delivered_at := coalesce(new.delivered_at, now());
    elsif old.status = 'completed' then new.delivered_at := null; end if;
    if new.status = 'returned' then new.returned_at := now(); elsif old.status = 'returned' then new.returned_at := null; new.return_reason := null; end if;
  end if;
  return new;
end; $function$;
revoke execute on function private.order_status_change() from public;
create trigger orders_status_change before update on public.orders for each row execute function private.order_status_change();
create trigger audit_orders_status after update of status, tracking_number, payment_status, paid_amount, refund_amount, customer on public.orders for each row execute function public.log_change();
-- new-order Telegram trigger: see 07_notifications.sql

-- Guest order tracking (#/track): order number + email
create or replace function public.track_order(p_no text, p_email text)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'created_at', o.created_at, 'total', o.total,
    'carrier', o.carrier, 'tracking_number', o.tracking_number, 'shipped_at', o.shipped_at,
    'delivery_eta', o.delivery_eta, 'delivered_at', o.delivered_at, 'payment_status', o.payment_status,
    'delay_reason', o.delay_reason, 'delayed_at', o.delayed_at,
    'delivery', o.customer->>'delivery',
    'items', (select jsonb_agg(jsonb_build_object('id', i->>'id', 'name', i->>'name', 'qty', (i->>'qty')::int, 'price', i->'price', 'opt', i->'opt'))
              from jsonb_array_elements(o.items) i))
  from public.orders o
  where o.order_no = upper(btrim(coalesce(p_no, '')))
    and lower(btrim(coalesce(o.customer->>'email', ''))) = lower(btrim(coalesce(p_email, '')))
    and btrim(coalesce(p_email, '')) <> ''
  limit 1;
$function$;
revoke execute on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- Customer cancels an order before it ships (signed-in owner, or guest with order number + email).
-- Stock goes back via private.order_status_change; the seller gets a Telegram alert (refund reminder if it was paid).
create or replace function public.cancel_order(p_no text, p_email text default null, p_reason text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare o public.orders%rowtype; uid uuid := auth.uid(); why text; s record; tok text; paid boolean;
begin
  select * into o from public.orders where order_no = upper(btrim(coalesce(p_no, ''))) for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not ((uid is not null and o.user_id = uid)
          or (btrim(coalesce(p_email, '')) <> '' and lower(btrim(coalesce(o.customer->>'email', ''))) = lower(btrim(p_email)))) then
    raise exception 'NOT_FOUND';
  end if;
  if o.status = 'cancelled' then raise exception 'ALREADY_CANCELLED'; end if;
  if o.status not in ('new', 'confirmed') then raise exception 'ALREADY_SHIPPED'; end if;
  why := nullif(left(btrim(coalesce(p_reason, '')), 200), '');
  paid := o.payment_status in ('paid', 'partially_refunded');
  update public.orders
     set status = 'cancelled',
         admin_note = left(concat_ws(E'\n', nullif(admin_note, ''), 'Cancelled by customer ' || to_char(now() at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI') || coalesce(': ' || why, '')), 4000)
   where id = o.id;
  begin
    select * into s from private.notify_settings where id = 1;
    select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token';
    if coalesce(s.enabled, false) and s.telegram_chat_id is not null and tok is not null then
      perform net.http_post(
        url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
        body := jsonb_build_object('chat_id', s.telegram_chat_id, 'disable_web_page_preview', true,
          'text', '❌ Покупець скасував замовлення ' || o.order_no || ' ($' || to_char(o.total, 'FM999999990.00') || ')' ||
                  coalesce(E'\nПричина: ' || why, '') ||
                  case when paid then E'\n💳 Замовлення було оплачене — поверніть кошти покупцю.' else '' end ||
                  E'\nТовар повернувся на склад.' ||
                  E'\n\nhttps://sashaantonyuk2-pixel.github.io/cozy-house/seller/#/admin/order/' || o.id),
        headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 15000);
    end if;
  exception when others then null;
  end;
  return jsonb_build_object('order_no', o.order_no, 'status', 'cancelled', 'refund_due', paid);
end; $function$;
revoke execute on function public.cancel_order(text, text, text) from public;
grant execute on function public.cancel_order(text, text, text) to anon, authenticated;

-- Delivery delay + automatic delivery (migration orders_delay_and_auto_deliver, 26.11.2026)
--   delay_reason / delayed_at: set by the seller («⏰ Затримка»), together with a new delivery_eta
--   Shipped orders become «completed» (delivered) the morning after delivery_eta (US Eastern), via pg_cron at 11:00 UTC.
alter table public.orders add column if not exists delay_reason text;
alter table public.orders add column if not exists delayed_at timestamp with time zone;
alter table public.orders add constraint orders_delay_reason_check check (char_length(delay_reason) <= 200);
grant select (delay_reason, delayed_at) on public.orders to authenticated;
grant update (delay_reason, delayed_at) on public.orders to authenticated;
create or replace function private.auto_deliver_orders() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.orders
     set status = 'completed',
         delivered_at = ((delivery_eta::timestamp + time '18:00') at time zone 'America/New_York')
   where status = 'shipped'
     and delivery_eta is not null
     and delivery_eta < (now() at time zone 'America/New_York')::date;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function private.auto_deliver_orders() from public;
create extension if not exists pg_cron;
select cron.schedule('auto-deliver-orders', '0 11 * * *', 'select private.auto_deliver_orders()');

-- Partial orders: cancel out-of-stock items, ship in several packages, each with its own tracking number
-- (migrations orders_cancel_items_and_packages, orders_cancel_items_fix_names, orders_insert_reset_new_fields,
--  orders_block_cancel_partly_shipped, 27.11.2026)
--   items[i].cancelled_qty / cancel_reason — items removed by the seller (stock goes back, totals are recalculated)
--   shipments — [{n, items:[{i,qty}], carrier, tracking, eta, shipped_at}], written only by seller_ship_package()
--   The order becomes «shipped» when the last package goes out; delivery_eta = the latest package ETA.
--   An order with packages on the way can't be cancelled as a whole (ALREADY_SHIPPED) — only its remaining items.
alter table public.orders add column if not exists shipments jsonb not null default '[]'::jsonb;
alter table public.orders add constraint orders_shipments_check check (jsonb_typeof(shipments) = 'array' and jsonb_array_length(shipments) <= 20);

create or replace function private.order_insert_reset() returns trigger
language plpgsql set search_path to '' as $$
begin
  new.shipments := '[]'::jsonb; new.delay_reason := null; new.delayed_at := null;
  return new;
end $$;
create trigger orders_reset_new before insert on public.orders for each row execute function private.order_insert_reset();

create or replace function private.order_shipped_qty(p_ship jsonb, p_idx integer) returns integer
language sql immutable set search_path to '' as $$
  select coalesce(sum((l->>'qty')::int), 0)::int
    from jsonb_array_elements(coalesce(p_ship, '[]'::jsonb)) s, jsonb_array_elements(s->'items') l
   where (l->>'i')::int = p_idx;
$$;

-- order_status_change(): stock moves use qty - cancelled_qty; whole-order cancel blocked once a package shipped
create or replace function private.order_status_change() returns trigger
language plpgsql security definer set search_path to '' as $$
declare it jsonb; was_out boolean; now_out boolean; q int;
begin
  if new.status is distinct from old.status then
    if new.status = 'cancelled' and jsonb_array_length(coalesce(old.shipments, '[]'::jsonb)) > 0 then
      raise exception 'ALREADY_SHIPPED';
    end if;
    perform set_config('app.order_ctx', '1', true);
    was_out := old.status in ('cancelled','returned');
    now_out := new.status in ('cancelled','returned');
    if now_out and not was_out then
      for it in select * from jsonb_array_elements(new.items) loop
        q := greatest(coalesce((it->>'qty')::int, 0) - coalesce((it->>'cancelled_qty')::int, 0), 0);
        update public.products set stock = stock + q where id = it->>'id';
      end loop;
    elsif was_out and not now_out then
      for it in select * from jsonb_array_elements(new.items) loop
        q := greatest(coalesce((it->>'qty')::int, 0) - coalesce((it->>'cancelled_qty')::int, 0), 0);
        update public.products set stock = greatest(stock - q, 0) where id = it->>'id';
      end loop;
    end if;
    if new.status = 'shipped' and new.shipped_at is null then new.shipped_at := now(); end if;
    if new.status = 'completed' then new.delivered_at := coalesce(new.delivered_at, now());
    elsif old.status = 'completed' then new.delivered_at := null; end if;
    if new.status = 'returned' then new.returned_at := now(); elsif old.status = 'returned' then new.returned_at := null; new.return_reason := null; end if;
  end if;
  return new;
end $$;

-- Seller Central: cancel some items (new/confirmed orders). Recalculates subtotal/shipping/tax/total (tax_rate of the order,
-- taxShipping setting); everything cancelled → order cancelled; the rest already shipped → «shipped». Returns {total, old_total, cancelled_all, refund_due}.
create or replace function public.seller_cancel_items(p_order bigint, p_lines jsonb, p_reason text default 'Out of stock') returns jsonb
language plpgsql security definer set search_path to '' as $$
declare o record; v_items jsonb; l jsonb; idx int; q int; it jsonb; rem int; v_sub numeric := 0; v_ship numeric; v_taxable numeric; v_tax numeric; st jsonb; old_total numeric; all_gone boolean; v_done boolean;
begin
  if not private.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status not in ('new','confirmed') then raise exception 'NOT_CANCELLABLE'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'NO_ITEMS'; end if;
  v_items := o.items; old_total := o.total;
  for l in select * from jsonb_array_elements(p_lines) loop
    begin idx := (l->>'i')::int; q := (l->>'qty')::int; exception when others then raise exception 'BAD_ITEM'; end;
    it := v_items->idx;
    if it is null or q is null or q < 1 then raise exception 'BAD_ITEM'; end if;
    rem := coalesce((it->>'qty')::int, 0) - coalesce((it->>'cancelled_qty')::int, 0) - private.order_shipped_qty(o.shipments, idx);
    if q > rem then raise exception 'TOO_MANY:%', it->>'name'; end if;
    it := it || jsonb_build_object('cancelled_qty', coalesce((it->>'cancelled_qty')::int, 0) + q, 'cancel_reason', left(coalesce(nullif(btrim(p_reason), ''), 'Out of stock'), 120));
    v_items := jsonb_set(v_items, array[idx::text], it);
    update public.products set stock = stock + q where id = it->>'id';
  end loop;
  select coalesce(sum((x->>'price')::numeric * greatest((x->>'qty')::int - coalesce((x->>'cancelled_qty')::int, 0), 0)), 0) into v_sub from jsonb_array_elements(v_items) x;
  all_gone := v_sub = 0;
  select coalesce(s.data, '{}'::jsonb) into st from public.store_settings s where s.id = 1;
  v_ship := case when all_gone then 0 else coalesce(o.shipping, 0) end;
  v_taxable := v_sub + case when coalesce(st->>'taxShipping', '') in ('true','1') then v_ship else 0 end;
  v_tax := round(v_taxable * coalesce(o.tax_rate, 0) / 100, 2);
  v_done := jsonb_array_length(o.shipments) > 0 and not exists (select 1 from jsonb_array_elements(v_items) with ordinality e(x, n)
              where (x->>'qty')::int - coalesce((x->>'cancelled_qty')::int, 0) - private.order_shipped_qty(o.shipments, (n - 1)::int) > 0);
  update public.orders as t set items = v_items, subtotal = v_sub, shipping = v_ship, tax = v_tax, total = v_sub + v_ship + v_tax,
         status = case when all_gone then 'cancelled' when v_done then 'shipped' else t.status end
   where t.id = p_order;
  return jsonb_build_object('total', v_sub + v_ship + v_tax, 'old_total', old_total, 'cancelled_all', all_gone,
    'refund_due', case when o.payment_status in ('paid','partially_refunded') then greatest(old_total - (v_sub + v_ship + v_tax), 0) else 0 end);
end $$;
revoke execute on function public.seller_cancel_items(bigint, jsonb, text) from public, anon;
grant execute on function public.seller_cancel_items(bigint, jsonb, text) to authenticated;

-- Seller Central: ship one package (confirmed orders). Tracking is required for USPS/UPS/FedEx/DHL.
create or replace function public.seller_ship_package(p_order bigint, p_lines jsonb, p_carrier text, p_tracking text, p_eta date) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare o record; l jsonb; idx int; q int; it jsonb; rem int; pkg jsonb := '[]'::jsonb; ships jsonb; done boolean; car text := left(btrim(coalesce(p_carrier, '')), 40); trk text := nullif(left(btrim(coalesce(p_tracking, '')), 80), '');
begin
  if not private.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status <> 'confirmed' then raise exception 'NOT_SHIPPABLE'; end if;
  if car = '' then raise exception 'NO_CARRIER'; end if;
  if car in ('USPS','UPS','FedEx','DHL') and trk is null then raise exception 'TRACKING_REQUIRED'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'NO_ITEMS'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    begin idx := (l->>'i')::int; q := (l->>'qty')::int; exception when others then raise exception 'BAD_ITEM'; end;
    it := o.items->idx;
    if it is null or q is null or q < 1 then raise exception 'BAD_ITEM'; end if;
    rem := coalesce((it->>'qty')::int, 0) - coalesce((it->>'cancelled_qty')::int, 0) - private.order_shipped_qty(o.shipments, idx);
    if q > rem then raise exception 'TOO_MANY:%', it->>'name'; end if;
    pkg := pkg || jsonb_build_array(jsonb_build_object('i', idx, 'qty', q));
  end loop;
  ships := o.shipments || jsonb_build_array(jsonb_build_object('n', jsonb_array_length(o.shipments) + 1, 'items', pkg, 'carrier', car,
             'tracking', trk, 'eta', p_eta, 'shipped_at', now()));
  done := not exists (select 1 from jsonb_array_elements(o.items) with ordinality e(x, n)
                       where (x->>'qty')::int - coalesce((x->>'cancelled_qty')::int, 0) - private.order_shipped_qty(ships, (n - 1)::int) > 0);
  update public.orders set shipments = ships, carrier = car, tracking_number = trk,
         delivery_eta = (select max((s->>'eta')::date) from jsonb_array_elements(ships) s),
         status = case when done then 'shipped' else status end
   where id = p_order;
  return jsonb_build_object('package', jsonb_array_length(ships), 'all_shipped', done);
end $$;
revoke execute on function public.seller_ship_package(bigint, jsonb, text, text, date) from public, anon;
grant execute on function public.seller_ship_package(bigint, jsonb, text, text, date) to authenticated;
-- track_order() also returns 'shipments' and, per item, 'cancelled_qty' / 'cancel_reason'.
