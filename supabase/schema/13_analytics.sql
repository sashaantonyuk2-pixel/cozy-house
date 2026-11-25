-- =====================================================================
-- 13 · Analytics (needs 00, 04). Anonymous visit statistics for Seller Central → «Аналітика».
--   analytics_events   — one row per event from the storefront (store/track.js); no cookies, no personal data
--   track(events)      — the only way to write: anonymous batch insert (max 30), validated and trimmed
--   analytics_report() — one JSON report for a period, admins only
-- Migrations: analytics_events, analytics_report_order_totals, analytics_retention_and_privacy (25.11.2026)
-- =====================================================================

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  visit text not null,
  type text not null,
  path text, product_id text, label text, value numeric,
  source text, medium text, campaign text, device text,
  constraint analytics_events_type_check check (type in ('visit','page','product','cart','checkout','purchase','search','click')),
  constraint analytics_events_visit_check check (visit ~ '^[a-z0-9]{8,32}$'),
  constraint analytics_events_len_check check (coalesce(char_length(path),0)<=200 and coalesce(char_length(product_id),0)<=80 and coalesce(char_length(label),0)<=120
    and coalesce(char_length(source),0)<=60 and coalesce(char_length(medium),0)<=60 and coalesce(char_length(campaign),0)<=100),
  constraint analytics_events_device_check check (device is null or device in ('mobile','tablet','desktop'))
);
create index if not exists analytics_events_at_idx on public.analytics_events (at);
create index if not exists analytics_events_visit_idx on public.analytics_events (visit);
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
create policy "Admins read analytics" on public.analytics_events for select to authenticated using ((select private.is_admin()));

-- storefront: anonymous batch insert (no direct table access); max 30 events per call, values trimmed and validated
create or replace function public.track(events jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  if jsonb_typeof(events) <> 'array' or jsonb_array_length(events) > 30 then return; end if;
  for e in select * from jsonb_array_elements(events) loop
    if (e->>'visit') !~ '^[a-z0-9]{8,32}$' or (e->>'type') not in ('visit','page','product','cart','checkout','purchase','search','click') then continue; end if;
    insert into public.analytics_events(visit,type,path,product_id,label,value,source,medium,campaign,device)
    values (e->>'visit', e->>'type', left(e->>'path',200), left(e->>'product_id',80), left(e->>'label',120),
      case when (e->>'value') ~ '^-?\d{1,9}(\.\d{1,2})?$' then (e->>'value')::numeric end,
      left(lower(e->>'source'),60), left(lower(e->>'medium'),60), left(e->>'campaign',100),
      case when e->>'device' in ('mobile','tablet','desktop') then e->>'device' end);
  end loop;
  -- retention: visit statistics are kept for 2 years (cleanup runs on roughly 1 in 500 calls)
  if random() < 0.002 then delete from public.analytics_events where at < now() - interval '2 years'; end if;
end $$;
revoke all on function public.track(jsonb) from public;
grant execute on function public.track(jsonb) to anon, authenticated;

-- Seller Central: one report for a period (admins only). Purchase revenue comes from public.orders by order number
-- (cancelled orders count as 0), the event value is only a fallback.
create or replace function public.analytics_report(p_from timestamptz, p_to timestamptz, p_tz text default 'UTC') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb; tz text := case when exists(select 1 from pg_timezone_names where name = p_tz) then p_tz else 'UTC' end;
begin
  if not (select private.is_admin()) then raise exception 'not allowed'; end if;
  with ev as (select * from public.analytics_events where at >= p_from and at <= p_to),
  pur as (select distinct on (e.label) e.visit, e.label,
            case when o.status = 'cancelled' then 0 else coalesce(o.total, e.value, 0) end as val
          from ev e left join public.orders o on o.order_no = e.label
          where e.type = 'purchase' and e.label is not null order by e.label, e.at),
  v as (select e.visit, min(e.at) as first_at,
          (array_agg(e.source order by e.at) filter (where e.type='visit'))[1] as source,
          (array_agg(e.medium order by e.at) filter (where e.type='visit'))[1] as medium,
          (array_agg(e.campaign order by e.at) filter (where e.type='visit'))[1] as campaign,
          (array_agg(e.device order by e.at) filter (where e.type='visit'))[1] as device,
          (array_agg(e.path order by e.at) filter (where e.type in ('visit','page')))[1] as landing,
          bool_or(e.type='product') as viewed, bool_or(e.type='cart') as carted, bool_or(e.type='checkout') as checkout,
          bool_or(e.type='purchase') as bought,
          count(*) filter (where e.type='page') as pages
        from ev e group by e.visit),
  vr as (select v.*, coalesce((select sum(val) from pur where pur.visit = v.visit),0) as revenue from v)
  select jsonb_build_object(
    'visits', (select count(*) from vr),
    'viewed', (select count(*) from vr where viewed),
    'carted', (select count(*) from vr where carted),
    'checkout', (select count(*) from vr where checkout),
    'bought', (select count(*) from vr where bought),
    'purchases', (select count(*) from pur),
    'revenue', (select coalesce(sum(val),0) from pur),
    'pages', (select count(*) from ev where type='page'),
    'bounce', (select count(*) from vr where pages <= 1 and not viewed and not carted),
    'first_event', (select min(at) from public.analytics_events),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d',d,'visits',n,'bought',b) order by d),'[]') from
       (select to_char(first_at at time zone tz,'YYYY-MM-DD') d, count(*) n, count(*) filter (where bought) b from vr group by 1) x),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('source',s,'visits',n,'carted',c,'bought',b,'revenue',rv) order by n desc),'[]') from
       (select coalesce(nullif(source,''),'direct') s, count(*) n, count(*) filter (where carted) c, count(*) filter (where bought) b, sum(revenue) rv from vr group by 1 order by 2 desc limit 15) x),
    'campaigns', (select coalesce(jsonb_agg(jsonb_build_object('campaign',s,'medium',m,'visits',n,'bought',b,'revenue',rv) order by n desc),'[]') from
       (select campaign s, max(medium) m, count(*) n, count(*) filter (where bought) b, sum(revenue) rv from vr where campaign is not null group by 1 order by 3 desc limit 15) x),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('device',s,'visits',n,'bought',b) order by n desc),'[]') from
       (select coalesce(device,'desktop') s, count(*) n, count(*) filter (where bought) b from vr group by 1) x),
    'landing', (select coalesce(jsonb_agg(jsonb_build_object('path',s,'visits',n,'bought',b) order by n desc),'[]') from
       (select coalesce(landing,'/') s, count(*) n, count(*) filter (where bought) b from vr group by 1 order by 2 desc limit 10) x),
    'blocks', (select coalesce(jsonb_agg(jsonb_build_object('block',s,'clicks',n,'visits',u) order by n desc),'[]') from
       (select label s, count(*) n, count(distinct visit) u from ev where type='click' and label is not null group by 1 order by 2 desc limit 30) x),
    'home_visits', (select count(distinct visit) from ev where type='page' and path='/'),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('id',s,'views',vw,'viewers',u,'carts',c) order by vw desc),'[]') from
       (select product_id s, count(*) filter (where type='product') vw, count(distinct visit) filter (where type='product') u, count(distinct visit) filter (where type='cart') c
          from ev where product_id is not null and type in ('product','cart') group by 1 order by 2 desc limit 50) x),
    'sales', (select coalesce(jsonb_agg(jsonb_build_object('id',s,'qty',q)),'[]') from
       (select it->>'id' s, sum(coalesce((it->>'qty')::numeric,0)) q from public.orders o, jsonb_array_elements(o.items) it
          where o.created_at >= p_from and o.created_at <= p_to and o.status <> 'cancelled' group by 1) x),
    'searches', (select coalesce(jsonb_agg(jsonb_build_object('q',s,'n',n,'results',rs) order by n desc),'[]') from
       (select lower(btrim(label)) s, count(distinct visit) n, min(value) rs from ev where type='search' and label is not null group by 1 order by 2 desc limit 40) x)
  ) into r;
  return r;
end $$;
revoke all on function public.analytics_report(timestamptz,timestamptz,text) from public, anon;
grant execute on function public.analytics_report(timestamptz,timestamptz,text) to authenticated;
