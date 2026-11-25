# CozyHouseVibe

### 🌐 [Open the store → sashaantonyuk2-pixel.github.io/cozy-house](https://sashaantonyuk2-pixel.github.io/cozy-house/)

Online store for cozy home goods: ceramics, textiles, lighting and décor.

- `index.html` — the live storefront (English). Served by GitHub Pages.
- `seller/` — Seller Central (admin panel, sign-in with 2FA, hidden from search engines).
- `src/` — source code (`shared/`, `store/`, `seller/`), built with `src/build.py`.
- `supabase/` — database structure (tables, access rules, triggers), split by area. No data, no secrets.

## Як оновлювати сайт

Товари, ціни, фото й тексти змінюються в кабінеті продавця (окремий сайт із входом за паролем і кодом 2FA). Зміни одразу з'являються в магазині — файли в цьому репозиторії оновлювати не потрібно.

## Журнал змін

Усі зміни сайту з описом — у [CHANGELOG.md](CHANGELOG.md). Якщо зміну залили без запису в журнал, GitHub за хвилину додасть її туди сам (назва й опис коміту + змінені файли).

## Хостинг

Settings → Pages → Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)`.
