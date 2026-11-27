-- =====================================================================
-- 15 · Chat attachments (needs 05, 07). Photos and PDF in the site chat, both directions.
--   bucket chat-media (private, 10 MB, images + PDF). Paths: c/<visitor key>/<uuid>.<ext> (customer), s/<thread id>/<uuid>.<ext> (seller)
--   Customers have no storage access at all: the edge function chat-files (supabase/functions/chat-files) gives them a
--   one-time signed upload URL into their own folder and signed read URLs (1 hour) only for files of their own conversation.
--   chat_messages.files = [{path, name, type, size}] (max 5); a message may have only files (empty text).
-- Migration: chat_attachments (28.11.2026)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins view chat media" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and (select private.is_admin()));
create policy "Admins upload chat media" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = 's' and (select private.is_admin()));
create policy "Admins delete chat media" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and (select private.is_admin()));

alter table public.chat_messages add column if not exists files jsonb not null default '[]'::jsonb;
alter table public.chat_messages drop constraint if exists chat_messages_body_check;
alter table public.chat_messages add constraint chat_messages_body_check
  check (char_length(btrim(body)) <= 2000 and (char_length(btrim(body)) >= 1 or jsonb_array_length(files) > 0));
alter table public.chat_messages add constraint chat_messages_files_check
  check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 5);
grant insert (files) on public.chat_messages to authenticated;

-- attachments must be in the sender's own folder, of an allowed type, and already uploaded
create or replace function private.chat_files_ok(p_files jsonb, p_prefix text) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare f jsonb; out jsonb := '[]'::jsonb; p text;
begin
  if p_files is null or jsonb_typeof(p_files) <> 'array' then return '[]'::jsonb; end if;
  if jsonb_array_length(p_files) > 5 then raise exception 'TOO_MANY_FILES'; end if;
  for f in select * from jsonb_array_elements(p_files) loop
    p := f->>'path';
    if p is null or left(p, length(p_prefix)) <> p_prefix
       or p !~ '^[cs]/[0-9a-f-]+/[0-9a-f-]{36}\.(jpg|png|webp|gif|heic|heif|pdf)$' then raise exception 'BAD_FILE'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'chat-media' and o.name = p) then raise exception 'BAD_FILE'; end if;
    out := out || jsonb_build_array(jsonb_build_object('path', p, 'name', left(coalesce(f->>'name', 'file'), 120),
             'type', left(coalesce(f->>'type', ''), 60), 'size', case when (f->>'size') ~ '^\d{1,9}$' then (f->>'size')::int end));
  end loop;
  return out;
end $$;
revoke all on function private.chat_files_ok(jsonb, text) from public, anon, authenticated;

create or replace function private.chat_seller_files() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if new.sender = 'seller' and jsonb_array_length(coalesce(new.files, '[]'::jsonb)) > 0 and (select auth.uid()) is not null then
    new.files := private.chat_files_ok(new.files, 's/' || new.thread_id || '/');
  end if;
  return new;
end $$;
create trigger chat_messages_files before insert on public.chat_messages for each row execute function private.chat_seller_files();

drop function if exists public.chat_send(uuid, text, text, text, text);
create or replace function public.chat_send(p_key uuid, p_body text, p_name text default null, p_email text default null, p_page text default null, p_files jsonb default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare th public.chat_threads%rowtype; b text := btrim(coalesce(p_body, '')); m bigint; fl jsonb;
        nm text := nullif(left(btrim(coalesce(p_name, '')), 80), ''); em text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if p_key is null then raise exception 'BAD_KEY'; end if;
  fl := private.chat_files_ok(p_files, 'c/' || p_key::text || '/');
  if char_length(b) > 2000 or (char_length(b) < 1 and jsonb_array_length(fl) = 0) then raise exception 'BAD_BODY'; end if;
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
  insert into public.chat_messages (thread_id, sender, body, files) values (th.id, 'customer', b, fl) returning id into m;
  return jsonb_build_object('id', m);
end $$;
revoke execute on function public.chat_send(uuid, text, text, text, text, jsonb) from public;
grant execute on function public.chat_send(uuid, text, text, text, text, jsonb) to anon, authenticated;

create or replace function public.chat_fetch(p_key uuid, p_after bigint default 0) returns jsonb
language sql stable security definer set search_path to '' as $$
  select coalesce((
    select jsonb_build_object(
      'status', t.status,
      'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body, 'files', m.files, 'at', m.created_at) order by m.id)
                            from public.chat_messages m where m.thread_id = t.id and m.id > coalesce(p_after, 0)), '[]'::jsonb))
    from public.chat_threads t where t.visitor_key = p_key), jsonb_build_object('status', 'none', 'messages', '[]'::jsonb));
$$;
-- private.chat_after_message(): last_preview = '📎 Фото / файл' for a message with only files;
-- private.notify_chat(): the Telegram text adds «📎 Файлів: N».
