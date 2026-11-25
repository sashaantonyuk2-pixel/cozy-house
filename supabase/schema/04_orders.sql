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

-- Checkout: required fields (street address must have a house number), real prices from products, variants,
-- stock check and reservation, shipping (Standard / Express price from settings, no free-shipping threshold) and sales tax by state (settings.taxRates)
create or replace function private.prepare_order()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare it jsonb; pr record; out_items jsonb := '[]'::jsonb; tot numeric := 0; q int;
        o jsonb; chosen jsonb; pick text; opt_out jsonb; line jsonb; c jsonb;
        st jsonb; num text; v_std numeric; v_exp numeric; exp_on boolean; is_exp boolean;
        ship numeric; rate numeric; taxable numeric; dlabel text;
begin
  perform set_config('app.order_ctx', '1', true);
  c := new.customer;
  if coalesce(btrim(c->>'name'), '') = '' then raise exception 'BAD_FIELD:name'; end if;
  if coalesce(c->>'email', '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'BAD_FIELD:email'; end if;
  if char_length(regexp_replace(coalesce(c->>'phone', ''), '\D', '', 'g')) < 10 then raise exception 'BAD_FIELD:phone'; end if;
  -- street address must have a house number and a street name
  if coalesce(btrim(c->>'address'), '') !~ '[0-9]' or coalesce(c->>'address', '') !~ '[A-Za-z]' then raise exception 'BAD_FIELD:address'; end if;
  if coalesce(btrim(c->>'city'), '') = '' then raise exception 'BAD_FIELD:city'; end if;
  if coalesce(c->>'state', '') !~ '^[A-Z]{2}$' then raise exception 'BAD_FIELD:state'; end if;
  if coalesce(c->>'zip', '') !~ '^\d{5}(-\d{4})?$' then raise exception 'BAD_FIELD:zip'; end if;
  if char_length(coalesce(c->>'address2', '')) > 100 then raise exception 'BAD_FIELD:address2'; end if;
  new.customer := c || jsonb_build_object('email', lower(btrim(c->>'email')));

  for it in select * from jsonb_array_elements(new.items) loop
    begin q := (it->>'qty')::int; exception when others then q := null; end;
    if q is null or q < 1 or q > 999 then raise exception 'BAD_QTY'; end if;
    select p.id, p.name, p.sku, p.price, p.stock, p.active, p.options into pr from public.products p where p.id = it->>'id' for update;
    if not found or not pr.active then raise exception 'UNAVAILABLE:%', left(coalesce(it->>'name', 'item'), 120); end if;
    chosen := case when jsonb_typeof(it->'opt') = 'object' then it->'opt' else '{}'::jsonb end;
    opt_out := '{}'::jsonb;
    for o in select * from jsonb_array_elements(coalesce(pr.options, '[]'::jsonb)) loop
      if jsonb_array_length(coalesce(o->'values', '[]'::jsonb)) = 0 then continue; end if;
      pick := chosen->>(o->>'name');
      if pick is null or not (o->'values') ? pick then
        raise exception 'OPTION_REQUIRED:%:%', pr.name, o->>'name';
      end if;
      opt_out := opt_out || jsonb_build_object(o->>'name', pick);
    end loop;
    if pr.stock < q then raise exception 'OUT_OF_STOCK:%:%', pr.name, pr.stock; end if;
    update public.products set stock = stock - q where id = pr.id;
    line := jsonb_build_object('id', pr.id, 'name', pr.name, 'sku', pr.sku, 'price', pr.price, 'qty', q);
    if opt_out <> '{}'::jsonb then line := line || jsonb_build_object('opt', opt_out); end if;
    out_items := out_items || jsonb_build_array(line);
    tot := tot + pr.price * q;
  end loop;

  -- shipping & tax from Seller Central settings (store_settings.data)
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
  new.customer := new.customer || jsonb_build_object('delivery', dlabel);
  new.items := out_items; new.subtotal := tot; new.shipping := ship; new.tax_rate := rate;
  new.tax := round(taxable * rate / 100, 2); new.total := tot + ship + new.tax; new.status := 'new';
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
