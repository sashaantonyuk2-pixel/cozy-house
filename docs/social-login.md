# Sign in with Google / Facebook — setup

The buttons are already on the site (Sign in and Create account pages). They appear automatically as soon as a
provider is switched on in Supabase. Callback URL for both providers:

`https://wkbrbrykqjdyovtdxflo.supabase.co/auth/v1/callback`

## Google
1. console.cloud.google.com → new project "CozyHouseVibe".
2. APIs & Services → OAuth consent screen → External; app name CozyHouseVibe, support email, logo, links to the
   Privacy Policy (`https://sashaantonyuk2-pixel.github.io/cozy-house/#/privacy`) and Terms (`…/#/terms`). Publish the app.
3. Credentials → Create credentials → OAuth client ID → Web application.
   Authorized redirect URI: the callback URL above.
4. Supabase → Authentication → Providers → Google → enable, paste Client ID and Client secret → Save.

## Facebook
1. developers.facebook.com → My Apps → Create app → "Authenticate and request data from users with Facebook Login".
2. Facebook Login → Settings → Valid OAuth Redirect URIs: the callback URL above.
3. App settings → Basic: Privacy Policy URL, Terms URL, app icon, category; switch the app to **Live**.
4. Supabase → Authentication → Providers → Facebook → enable, paste App ID and App secret → Save.

## Supabase URL settings (once)
Authentication → URL Configuration: Site URL `https://sashaantonyuk2-pixel.github.io/cozy-house/`,
Redirect URLs include the same address (add your own domain later).

Never send client secrets / app secrets to anyone — paste them only into Supabase.
