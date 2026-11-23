# Source

The site is built from these parts into two single-file pages:

- `index.html` (storefront): head.html + style.css + body.html + i18n.js, photos.js, demo.js, account.js, app.js
- `seller/index.html` (Seller Central): seller_head.html + style.css + seller_body.html + i18n.js, photos.js, demo.js, admin.js, account.js, seller.js, app.js

Build: `cd src && python3 build.py` (Python 3 + Node.js). Then commit `index.html`, `seller/index.html` and add an entry to `CHANGELOG.md`.

Backend: Supabase project `wkbrbrykqjdyovtdxflo` (tables, RLS policies, triggers live in the database).
