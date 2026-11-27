// Chat attachments for storefront visitors (no account needed). The visitor proves ownership with the secret chat key.
//   POST {action:"upload", key, type, size} → one-time signed upload URL for c/<key>/<uuid>.<ext> (private bucket chat-media)
//   POST {action:"read", key, paths[]}       → signed read URLs (1 hour) for files that belong to this visitor's conversation
// Limits: images (jpeg/png/webp/gif/heic/heif) and PDF, up to 10 MB (bucket limits), 15 uploads per key per 10 minutes.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) ?? "";
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 10 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  let b: { action?: string; key?: string; type?: string; size?: number; paths?: string[] };
  try { b = await req.json(); } catch { return json({ error: "BAD_JSON" }, 400); }
  const key = String(b.key || "").toLowerCase();
  if (!UUID.test(key)) return json({ error: "BAD_KEY" }, 400);
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const bucket = db.storage.from("chat-media");

  if (b.action === "upload") {
    const ext = EXT[String(b.type || "")];
    if (!ext) return json({ error: "BAD_TYPE" }, 400);
    if (!(Number(b.size) > 0) || Number(b.size) > MAX) return json({ error: "TOO_BIG" }, 400);
    const { data: list } = await bucket.list("c/" + key, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    const recent = (list || []).filter((f) => f.created_at && Date.now() - Date.parse(f.created_at) < 10 * 60 * 1000).length;
    if (recent >= 15) return json({ error: "TOO_MANY" }, 429);
    const path = `c/${key}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await bucket.createSignedUploadUrl(path);
    if (error || !data) return json({ error: "UPLOAD_FAILED" }, 500);
    return json({ path, token: data.token });
  }

  if (b.action === "read") {
    const want = (Array.isArray(b.paths) ? b.paths : []).map(String).slice(0, 50);
    if (!want.length) return json({ urls: {} });
    const { data: th } = await db.from("chat_threads").select("id").eq("visitor_key", key).maybeSingle();
    if (!th) return json({ urls: {} });
    const { data: msgs } = await db.from("chat_messages").select("files").eq("thread_id", th.id).neq("files", "[]").limit(500);
    const mine = new Set<string>();
    (msgs || []).forEach((m: { files: { path: string }[] }) => (m.files || []).forEach((f) => mine.add(f.path)));
    const ok = want.filter((p) => mine.has(p));
    if (!ok.length) return json({ urls: {} });
    const { data } = await bucket.createSignedUrls(ok, 3600);
    const urls: Record<string, string> = {};
    (data || []).forEach((x) => { if (x.signedUrl && x.path) urls[x.path] = x.signedUrl; });
    return json({ urls });
  }
  return json({ error: "BAD_ACTION" }, 400);
});
