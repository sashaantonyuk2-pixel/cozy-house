// POST {customer, items, return_url} → {url, id}: prices the cart on the server and opens a Stripe Checkout page.
// The order itself is created only after payment (see payments-webhook).
import { admin, ALLOWED_ORIGINS, cents, CORS, json, stripe, stripeReady } from "../_shared/pay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  if (!stripeReady()) return json({ error: "PAYMENTS_NOT_CONFIGURED" }, 503);
  const db = admin();
  const { data: st } = await db.from("store_settings").select("data").eq("id", 1).single();
  if (!(st?.data?.paymentsOn === true || st?.data?.paymentsOn === "1")) return json({ error: "PAYMENTS_OFF" }, 503);

  let body: { customer?: Record<string, unknown>; items?: unknown[]; return_url?: string };
  try { body = await req.json(); } catch { return json({ error: "BAD_JSON" }, 400); }
  let ret: URL;
  try { ret = new URL(String(body.return_url || "")); } catch { return json({ error: "BAD_RETURN_URL" }, 400); }
  if (!ALLOWED_ORIGINS.includes(ret.origin)) return json({ error: "BAD_RETURN_URL" }, 400);
  const base = ret.origin + ret.pathname;

  // optional signed-in customer (guest checkout works without it)
  let userId: string | null = null;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (token) { const { data } = await db.auth.getUser(token); userId = data?.user?.id ?? null; }

  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 100).map((i) => {
    const x = i as Record<string, unknown>;
    return { id: String(x.id ?? ""), qty: Number(x.qty), ...(x.opt && typeof x.opt === "object" ? { opt: x.opt } : {}) };
  });
  const { data: quote, error: qe } = await db.rpc("checkout_quote", { c: body.customer ?? {}, items });
  if (qe) return json({ error: qe.message }, 400);

  const { data: cs, error: ie } = await db.from("checkout_sessions")
    .insert({ user_id: userId, customer: quote.customer, items: quote.items, quote }).select("id").single();
  if (ie) return json({ error: "SAVE_FAILED" }, 500);

  const c = quote.customer as Record<string, string>;
  const line_items: Record<string, unknown>[] = (quote.items as Record<string, unknown>[]).map((i) => ({
    quantity: i.qty,
    price_data: { currency: "usd", unit_amount: cents(Number(i.price)),
      product_data: { name: String(i.name) + (i.opt ? " (" + Object.entries(i.opt as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join(", ") + ")" : "") } },
  }));
  if (Number(quote.shipping) > 0) line_items.push({ quantity: 1, price_data: { currency: "usd", unit_amount: cents(quote.shipping), product_data: { name: c.delivery || "Shipping" } } });
  if (Number(quote.tax) > 0) line_items.push({ quantity: 1, price_data: { currency: "usd", unit_amount: cents(quote.tax), product_data: { name: `Sales tax (${c.state} ${Number(quote.tax_rate)}%)` } } });

  try {
    const s = await stripe("checkout/sessions", {
      mode: "payment", line_items, customer_email: c.email, client_reference_id: cs.id,
      metadata: { checkout_id: cs.id }, payment_intent_data: { metadata: { checkout_id: cs.id } },
      success_url: `${base}#/order?paid=${cs.id}`, cancel_url: `${base}#/checkout?canceled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    }, "POST", `checkout-${cs.id}`);
    await db.from("checkout_sessions").update({ stripe_session_id: s.id }).eq("id", cs.id);
    return json({ url: s.url, id: cs.id });
  } catch (e) {
    await db.from("checkout_sessions").update({ status: "failed", error: String((e as Error).message).slice(0, 500) }).eq("id", cs.id);
    return json({ error: "STRIPE_ERROR" }, 502);
  }
});
