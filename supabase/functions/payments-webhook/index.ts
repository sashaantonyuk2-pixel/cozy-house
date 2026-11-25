// Stripe → POST events. Verifies the signature, then:
//  checkout.session.completed / async_payment_succeeded → creates the order (already paid) + payment record
//  checkout.session.expired → marks the cart as expired
//  charge.refunded → updates refund amount and payment status on the order
import { admin, env, newOrderNo, stripe, verifyStripeSignature } from "../_shared/pay.ts";

const ok = (msg = "ok") => new Response(msg, { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get("stripe-signature"), env("STRIPE_WEBHOOK_SECRET"))))
    return new Response("bad signature", { status: 400 });
  const event = JSON.parse(payload);
  const db = admin();
  const obj = event.data?.object ?? {};

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (obj.payment_status !== "paid") return ok("not paid yet");
    const id = obj.metadata?.checkout_id || obj.client_reference_id;
    const { data: cs } = await db.from("checkout_sessions").select("*").eq("id", id).maybeSingle();
    if (!cs) return ok("unknown checkout");
    if (cs.status === "paid" && cs.order_id) return ok("already done");
    const amount = Number(obj.amount_total || 0) / 100, pi = String(obj.payment_intent || "");

    let order: { id: number; order_no: string; total: number } | null = null, err = "";
    for (let i = 0; i < 4 && !order; i++) {
      const { data, error } = await db.from("orders").insert({
        order_no: newOrderNo(), customer: { ...cs.customer, payment: "Card (Stripe)" },
        items: cs.items, total: 0, currency: "USD", user_id: cs.user_id,
      }).select("id, order_no, total").single();
      if (!error) order = data; else { err = error.message; if (!/duplicate|unique/i.test(err)) break; }
    }
    if (!order) {
      // e.g. sold out between payment page and payment: refund automatically
      try { if (pi) await stripe("refunds", { payment_intent: pi, reason: "requested_by_customer" }, "POST", `fail-${cs.id}`); } catch (_) { /* seller will see it in Stripe */ }
      await db.from("checkout_sessions").update({ status: "failed", error: ("ORDER_FAILED: " + err).slice(0, 500) }).eq("id", cs.id);
      return ok("order failed, refunded");
    }
    await db.from("orders").update({
      payment_status: "paid", payment_method: "Card (Stripe)", payment_ref: pi || obj.id,
      paid_amount: amount, paid_at: new Date().toISOString(),
      admin_note: Math.abs(amount - Number(order.total)) > 0.009 ? `Stripe charged $${amount.toFixed(2)} (order total $${Number(order.total).toFixed(2)})` : null,
    }).eq("id", order.id);
    await db.from("payments").upsert({ order_id: order.id, checkout_id: cs.id, provider: "stripe", provider_ref: pi || obj.id, amount, currency: "USD", status: "succeeded" }, { onConflict: "provider_ref" });
    await db.from("checkout_sessions").update({ status: "paid", order_id: order.id, error: null }).eq("id", cs.id);
    return ok();
  }

  if (event.type === "checkout.session.expired") {
    const id = obj.metadata?.checkout_id || obj.client_reference_id;
    if (id) await db.from("checkout_sessions").update({ status: "expired" }).eq("id", id).eq("status", "open");
    return ok();
  }

  if (event.type === "charge.refunded") {
    const pi = String(obj.payment_intent || ""), refunded = Number(obj.amount_refunded || 0) / 100, total = Number(obj.amount || 0) / 100;
    const { data: p } = await db.from("payments").select("id, order_id").eq("provider_ref", pi).maybeSingle();
    if (!p) return ok("unknown payment");
    const status = refunded >= total ? "refunded" : "partially_refunded";
    await db.from("payments").update({ refunded_amount: refunded, status }).eq("id", p.id);
    if (p.order_id) await db.from("orders").update({ refund_amount: refunded, refunded_at: new Date().toISOString(), payment_status: status }).eq("id", p.order_id);
    return ok();
  }
  return ok("ignored");
});
