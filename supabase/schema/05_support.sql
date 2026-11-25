-- =====================================================================
-- 05 · Customer support: contact form messages + live chat
-- =====================================================================

-- ---------- Contact form ("Contact us") ----------
create table if not exists public.messages (
  id bigint generated always as identity not null,
  created_at timestamp with time zone default now() not null,
  user_id uuid default auth.uid(),
  name text not null,
  email text not null,
  order_no text,
  body text not null,
  status text default 'new'::text not null,
  constraint messages_pkey primary key (id),
  constraint messages_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null,
  constraint messages_body_check check (((char_length(btrim(body)) >= 2) and (char_length(btrim(body)) <= 5000))),
  constraint messages_email_check check (((char_length(email) <= 200) and (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text))),
  constraint messages_name_check check (((char_length(btrim(name)) >= 1) and (char_length(btrim(name)) <= 120))),
  constraint messages_order_no_check check ((char_length(order_no) <= 40)),
  constraint messages_status_check check ((status = any (array['new'::text, 'read'::text, 'replied'::text, 'archived'::text])))
);
create index if not exists messages_created_idx on public.messages using btree (created_at desc);
alter table public.messages enable row level security;
create policy "Admins read messages" on public.messages as permissive for select to authenticated
  using (( select private.is_admin() as is_admin));
create policy "Admins update messages" on public.messages as permissive for update to authenticated
  using (( select private.is_admin() as is_admin))
  with check (( select private.is_admin() as is_admin));
create policy "Anyone can send a message" on public.messages as permissive for insert to anon, authenticated
  with check (((status = 'new'::text) and (not (user_id is distinct from ( select auth.uid() as uid)))));
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (name, email, order_no, body) on public.messages to anon, authenticated;
grant update (status) on public.messages to authenticated;

-- max 5 messages/hour per email
create or replace function private.message_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if (select count(*) from public.messages m where lower(m.email) = lower(new.email) and m.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'TOO_MANY_MESSAGES';
  end if;
  new.status := 'new';
  return new;
end; $function$;
revoke execute on function private.message_guard() from public;
create trigger messages_guard before insert on public.messages for each row execute function private.message_guard();

-- ---------- Live chat ----------
-- A visitor has a secret random key (in their browser); they read/write only through chat_send / chat_fetch.
create table if not exists public.chat_threads (
  id uuid default gen_random_uuid() not null,
  visitor_key uuid not null,
  user_id uuid,
  name text,
  email text,
  page text,
  status text default 'open'::text not null,
  created_at timestamp with time zone default now() not null,
  last_at timestamp with time zone default now() not null,
  last_customer_at timestamp with time zone,
  admin_seen_at timestamp with time zone,
  last_preview text,
  constraint chat_threads_visitor_key_key unique (visitor_key),
  constraint chat_threads_pkey primary key (id),
  constraint chat_threads_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null,
  constraint chat_threads_email_check check (((email is null) or ((char_length(email) <= 200) and (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)))),
  constraint chat_threads_name_check check (((name is null) or (char_length(name) <= 80))),
  constraint chat_threads_page_check check (((page is null) or (char_length(page) <= 300))),
  constraint chat_threads_status_check check ((status = any (array['open'::text, 'closed'::text])))
);
create index if not exists chat_threads_last_idx on public.chat_threads using btree (last_at desc);
alter table public.chat_threads enable row level security;
create policy "Admins delete chats" on public.chat_threads as permissive for delete to authenticated
  using (( select private.is_admin() as is_admin));
create policy "Admins read chats" on public.chat_threads as permissive for select to authenticated
  using (( select private.is_admin() as is_admin));
create policy "Admins update chats" on public.chat_threads as permissive for update to authenticated
  using (( select private.is_admin() as is_admin))
  with check (( select private.is_admin() as is_admin));
revoke all on public.chat_threads from anon, authenticated;
grant select, delete on public.chat_threads to authenticated;
grant update (status, admin_seen_at) on public.chat_threads to authenticated;

create table if not exists public.chat_messages (
  id bigint generated always as identity not null,
  thread_id uuid not null,
  sender text not null,
  body text not null,
  created_at timestamp with time zone default now() not null,
  constraint chat_messages_pkey primary key (id),
  constraint chat_messages_thread_id_fkey foreign key (thread_id) references public.chat_threads(id) on delete cascade,
  constraint chat_messages_body_check check (((char_length(btrim(body)) >= 1) and (char_length(btrim(body)) <= 2000))),
  constraint chat_messages_sender_check check ((sender = any (array['customer'::text, 'seller'::text])))
);
create index if not exists chat_messages_thread_idx on public.chat_messages using btree (thread_id, id);
alter table public.chat_messages enable row level security;
create policy "Admins read chat messages" on public.chat_messages as permissive for select to authenticated
  using (( select private.is_admin() as is_admin));
create policy "Admins reply in chat" on public.chat_messages as permissive for insert to authenticated
  with check ((( select private.is_admin() as is_admin) and (sender = 'seller'::text)));
revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;
grant insert (thread_id, sender, body) on public.chat_messages to authenticated;

-- keeps the thread preview / unread markers up to date
create or replace function private.chat_after_message()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  update public.chat_threads
     set last_at = new.created_at,
         last_preview = left(new.body, 140),
         last_customer_at = case when new.sender = 'customer' then new.created_at else last_customer_at end,
         admin_seen_at = case when new.sender = 'seller' then new.created_at else admin_seen_at end,
         status = case when new.sender = 'customer' then 'open' else status end
   where id = new.thread_id;
  return new;
end; $function$;
create trigger chat_messages_after after insert on public.chat_messages for each row execute function private.chat_after_message();
-- chat Telegram trigger: see 07_notifications.sql

create or replace function public.chat_send(p_key uuid, p_body text, p_name text default null::text, p_email text default null::text, p_page text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare th public.chat_threads%rowtype; b text := btrim(coalesce(p_body, '')); m bigint;
        nm text := nullif(left(btrim(coalesce(p_name, '')), 80), ''); em text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if p_key is null then raise exception 'BAD_KEY'; end if;
  if char_length(b) < 1 or char_length(b) > 2000 then raise exception 'BAD_BODY'; end if;
  if em is not null and (char_length(em) > 200 or em !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'BAD_EMAIL'; end if;
  select * into th from public.chat_threads where visitor_key = p_key for update;
  if not found then
    if (select count(*) from public.chat_threads where created_at > now() - interval '10 minutes') >= 30 then raise exception 'TOO_MANY'; end if;
    insert into public.chat_threads (visitor_key, user_id, name, email, page)
    values (p_key, auth.uid(), nm, em, left(p_page, 300)) returning * into th;
  else
    if (select count(*) from public.chat_messages where thread_id = th.id and sender = 'customer' and created_at > now() - interval '10 minutes') >= 20 then
      raise exception 'TOO_MANY';
    end if;
    update public.chat_threads set name = coalesce(nm, name), email = coalesce(em, email), user_id = coalesce(user_id, auth.uid())
     where id = th.id;
  end if;
  insert into public.chat_messages (thread_id, sender, body) values (th.id, 'customer', b) returning id into m;
  return jsonb_build_object('id', m);
end; $function$;
revoke execute on function public.chat_send(uuid, text, text, text, text) from public;
grant execute on function public.chat_send(uuid, text, text, text, text) to anon, authenticated;

create or replace function public.chat_fetch(p_key uuid, p_after bigint default 0)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce((
    select jsonb_build_object(
      'status', t.status,
      'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body, 'at', m.created_at) order by m.id)
                            from public.chat_messages m where m.thread_id = t.id and m.id > coalesce(p_after, 0)), '[]'::jsonb))
    from public.chat_threads t where t.visitor_key = p_key), jsonb_build_object('status', 'none', 'messages', '[]'::jsonb));
$function$;
revoke execute on function public.chat_fetch(uuid, bigint) from public;
grant execute on function public.chat_fetch(uuid, bigint) to anon, authenticated;
