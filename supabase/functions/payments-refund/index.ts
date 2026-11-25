// POST {order_id, amount} (Seller Central, admin with 2FA only) → refunds through Stripe.
// The webhook (charge.refunded) also records it; this updates the order right away too.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { admin, cents, CORS, env, json, stripe, stripeReady } from "../_shared/pay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  if (!stripeReady()) return json({ error: "PAYMENTS_NOT_CONFIGURED" }, 503);
  const auth = req.headers.get("authorization") || "";
  const asUser = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: isAdmin } = await asUser.rpc("am_i_admin");
  if (isAdmin !== true) return json({ error: "NOT_ALLOWED" }, 403);

  let body: { order_id?: number; amount?: number };
  try { body = await req.json(); } catch { return json({ error: "BAD_JSON" }, 400); }
  const db = admin();
  const { data: p } = await db.from("payments").select("*").eq("order_id", Number(body.order_id)).eq("provider", "stripe").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!p) return json({ error: "NO_STRIPE_PAYMENT" }, 404);
  const left = Math.round((Number(p.amount) - Number(p.refunded_amount)) * 100) / 100;
  const amount = Math.round(Number(body.amount) * 100) / 100;
  if (!(amount > 0) || amount > left) return json({ error: "BAD_AMOUNT", left }, 400);
  try {
    await stripe("refunds", { payment_intent: p.provider_ref, amount: cents(amount) }, "POST", `refund-${p.id}-${cents(p.refunded_amount)}-${cents(amount)}`);
  } catch (e) { return json({ error: "STRIPE_ERROR", message: (e as Error).message }, 502); }
  const refunded = Math.round((Number(p.refunded_amount) + amount) * 100) / 100, status = refunded >= Number(p.amount) ? "refunded" : "partially_refunded";
  await db.from("payments").update({ refunded_amount: refunded, status }).eq("id", p.id);
  await db.from("orders").update({ refund_amount: refunded, refunded_at: new Date().toISOString(), payment_status: status }).eq("id", p.order_id);
  return json({ ok: true, refunded, status });
});
