// Shared helpers for the CozyHouseVibe payment module (Stripe). Secrets live only in Supabase:
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET  (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY provided by Supabase)
//   SITE_ORIGINS (optional) — comma-separated origins allowed for return URLs
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export const env = (k: string) => Deno.env.get(k) ?? "";
export const stripeReady = () => env("STRIPE_SECRET_KEY").startsWith("sk_");
export const admin = (): SupabaseClient =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

export const ALLOWED_ORIGINS = (env("SITE_ORIGINS") || "https://sashaantonyuk2-pixel.github.io")
  .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);

export const cents = (n: number) => Math.round(Number(n) * 100);

/** Flatten nested params into Stripe's form encoding: a[b][0][c]=v */
function form(params: Record<string, unknown>): URLSearchParams {
  const out = new URLSearchParams();
  const walk = (v: unknown, key: string) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${key}[${i}]`));
    else if (typeof v === "object") Object.entries(v as Record<string, unknown>).forEach(([k, x]) => walk(x, key ? `${key}[${k}]` : k));
    else out.append(key, String(v));
  };
  walk(params, "");
  return out;
}

export async function stripe(path: string, params?: Record<string, unknown>, method = "POST", idempotencyKey?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}` };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  let url = `https://api.stripe.com/v1/${path}`, body: BodyInit | undefined;
  if (method === "GET") { if (params) url += "?" + form(params); }
  else { headers["Content-Type"] = "application/x-www-form-urlencoded"; body = params ? form(params) : undefined; }
  const r = await fetch(url, { method, headers, body });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Stripe error ${r.status}`);
  return data;
}

/** Verifies the Stripe-Signature header (HMAC-SHA256 over "t.payload", 5-minute tolerance). */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

/** CHV-YYMMDD-NNNN in New York time */
export function newOrderNo(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const p = (n: number) => String(n).padStart(2, "0");
  return `CHV-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${1000 + Math.floor(Math.random() * 9000)}`;
}
