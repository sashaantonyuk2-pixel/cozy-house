// GET ?id=<checkout id> → {status, order_no}   (the id is a random UUID the customer got back from Stripe)
// GET ?ping=1           → {configured, on}      (for Seller Central and the checkout page)
import { admin, CORS, json, stripeReady } from "../_shared/pay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url), db = admin();
  if (u.searchParams.get("ping")) {
    const { data } = await db.from("store_settings").select("data").eq("id", 1).single();
    return json({ configured: stripeReady(), on: data?.data?.paymentsOn === true || data?.data?.paymentsOn === "1" });
  }
  const id = u.searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "BAD_ID" }, 400);
  const { data: cs } = await db.from("checkout_sessions").select("status, order_id, error").eq("id", id).maybeSingle();
  if (!cs) return json({ status: "unknown" }, 404);
  let order_no: string | null = null;
  if (cs.order_id) { const { data: o } = await db.from("orders").select("order_no").eq("id", cs.order_id).maybeSingle(); order_no = o?.order_no ?? null; }
  return json({ status: cs.status, order_no, refunded: cs.status === "failed" });
});
