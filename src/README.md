# Source

The site is built into two single-file pages from three folders:

- `shared/` — used by both: `supabase.js` (connection), `core.js` (state, helpers, catalog mapping), `i18n.js`, `photos.js`, `demo.js`, `style.css`
- `store/` — storefront only (`index.html`): `head.html`, `body.html`, `auth.js` (sign-in & registration: email, Google, Facebook, password reset, session), `account.js` (My account: router, My details), `orders.js` (saving orders, My orders, cancel, returns, invoice PDF), `chat.js`, `store.js` (views, cart, checkout, contact form, router, events)
- `seller/` — Seller Central only (`seller/index.html`): `head.html`, `body.html`, `admin/` (one file per section: `core.js` = menu, router and event handlers; `dashboard.js`, `orders.js`, `products.js`, `excel.js`, `categories.js`, `customers.js`, `support.js`, `reviews.js`, `seo.js`, `settings.js`, `system.js`), `seller.js` (sign-in + 2FA, sync), `main.js` (router, events, boot)

Rule: code needed by both goes to `shared/`; never reference storefront code from `seller/` or the other way round.

Build: `cd src && python3 build.py` (Python 3 + Node.js, or macOS built-in JavaScriptCore if Node.js is not installed). Then commit `index.html`, `seller/index.html` and add an entry to `CHANGELOG.md`.

Backend: Supabase project `wkbrbrykqjdyovtdxflo` (tables, RLS policies, triggers live in the database).
