/* ===== Supabase connection (shared). The publishable key is public by design; data is protected by RLS in the database. ===== */
const SB_URL="https://wkbrbrykqjdyovtdxflo.supabase.co",SB_KEY="sb_publishable_UZiqJFbTofapMmGhPmkDeg_t_bBxD0m";
const SITE_URL="https://sashaantonyuk2-pixel.github.io/cozy-house/";
let sb=null;
const authErr=e=>{const m=(e&&e.message)||String(e);
 if(/Invalid login/i.test(m))return"Wrong email or password.";
 if(/already registered|already exists/i.test(m))return"An account with this email already exists. Try signing in.";
 if(/Email not confirmed/i.test(m))return"Please confirm your email first — check your inbox.";
 if(/not authorized|Error sending|sending.*email/i.test(m))return"We couldn’t send an email right now. Please contact us and we’ll help.";
 if(/rate limit|too many/i.test(m))return"Too many attempts. Please wait a minute and try again.";
 if(/Password should/i.test(m))return"Password must be at least 8 characters.";
 if(/Failed to fetch|NetworkError/i.test(m))return"Can’t reach the server. Check your connection and try again.";
 return m};
