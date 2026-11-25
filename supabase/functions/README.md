# Payment module (Stripe) — Supabase Edge Functions

Deployed, but **inactive** until both secrets are set in Supabase → Edge Functions → Secrets and the seller turns on
Seller Central → Налаштування → «💳 Онлайн-оплата». Until then checkout works as before (order without online payment).

| Function | JWT | What it does |
|---|---|---|
| `payments-checkout` | no (checks user token itself) | prices the cart on the server (`checkout_quote` → `private.quote_order`), saves it in `checkout_sessions`, opens Stripe Checkout |
| `payments-webhook` | no (Stripe signature) | on payment creates the order (already paid) + `payments` row; on refund updates the order; sold-out → automatic refund |
| `payments-status` | no | thank-you page polling by checkout id; `?ping=1` → `{configured, on}` |
| `payments-refund` | yes (admin with 2FA via `am_i_admin`) | refund from Seller Central order page |

Secrets: `STRIPE_SECRET_KEY` (sk_test_… first), `STRIPE_WEBHOOK_SECRET` (whsec_…), optional `SITE_ORIGINS`.
Webhook URL: `https://wkbrbrykqjdyovtdxflo.supabase.co/functions/v1/payments-webhook` — events: checkout.session.completed,
checkout.session.async_payment_succeeded, checkout.session.expired, charge.refunded.
Note: when deploying, the import path `../_shared/pay.ts` was packaged as `./_shared/pay.ts`.
