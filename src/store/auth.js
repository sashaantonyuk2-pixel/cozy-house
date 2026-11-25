/* ===== Customer sign-in & registration (Supabase Auth) — storefront only =====
   Session state, header account menu, Sign in / Create account / Forgot / Reset password screens,
   Sign in with Google / Facebook. Profile is in account.js; orders, invoices and returns in orders.js. */
let user=null,profile=null,authReady=false;
function sbInit(){
 try{if(!window.supabase||!window.supabase.createClient)return;
  sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{flowType:"pkce",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  sb.auth.onAuthStateChange((ev,session)=>{const was=user&&user.id;user=session?session.user:null;if(!user)profile=null;
   setTimeout(()=>{acctBadge();if(user&&(was||null)!==user.id)syncFavs();
    if(ev==="PASSWORD_RECOVERY"){location.hash="#/account/reset";return}
    if((was||null)!==(user&&user.id||null)&&/^#\/(account|checkout|orders)/.test(location.hash))render()},0)});
  sb.auth.getSession().then(({data})=>{user=data.session?data.session.user:null;authReady=true;acctBadge();if(user)syncFavs();
   if(/[?&]code=|[?&]error/.test(location.search)){const next=(location.hash&&location.hash!=="#/"?location.hash:"")||LS.get("afterLogin","")||"#/account";LS.set("afterLogin","");history.replaceState(null,"",location.pathname+next);if(user)setTimeout(()=>{toast("Signed in");if(location.hash!==next)location.hash=next;else render()},0)}
   if(/^#\/(account|checkout|orders)/.test(location.hash))render()});
 }catch(e){sb=null}}
function acctBadge(){const b=$("#acctBtn");if(!b)return;b.classList.toggle("on",!!user);
 const nm=user&&((profile&&profile.full_name)||(user.user_metadata&&user.user_metadata.full_name)||"").split(" ")[0];
 const l=$("#acctLbl");if(l)l.innerHTML=`<small>${user?`Hi${nm?", "+esc(nm):""}`:"Hello, sign in"}</small><b>Account <i class="chev"></i></b>`;
 const m=$("#navAcct");if(m)m.textContent=user?"My account":"Sign in / Register";
 const mu=$("#acctMenu");if(!mu)return;
 const links=`<a role="menuitem" href="#/account/orders">${ICON.bag.replace("<svg",'<svg width="18" height="18"')} My orders</a><a role="menuitem" href="#/account">${ICON.user.replace("<svg",'<svg width="18" height="18"')} Profile</a><a role="menuitem" href="#/favorites">${ICON.heart.replace("<svg",'<svg width="18" height="18"')} Wishlist</a>`;
 mu.innerHTML=user?`<div class="amhead"><b>${esc(nm||"Your account")}</b><span>${esc(user.email)}</span></div><div class="amlinks">${links}</div><button class="btn block sm" data-act="signout" role="menuitem">Sign out</button>`
  :`<a class="btn primary block" href="#/account" role="menuitem">Sign in</a><p class="amnew">New customer? <a href="#/account/register" role="menuitem">Start here</a></p><div class="amlinks">${links}</div>`}
function closeAcct(){const w=$("#acctWrap");if(w){w.classList.remove("open");$("#acctBtn").setAttribute("aria-expanded","false")}}
async function loadProfile(){if(!sb||!user)return null;if(profile)return profile;const{data}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();profile=data||{id:user.id};return profile}
function authShell(title,sub,body){return `<div class="shell section"><div class="authbox"><div class="authhead"><span class="authicon">${ICON.user}</span><h1>${title}</h1>${sub?`<p class="muted">${sub}</p>`:""}</div>${body}</div></div>`}
function notReady(){return authShell("Account","",`<div class="note">${sb?"Loading…":"Accounts are unavailable right now. You can still place orders as a guest."}</div>`)}
/* auth screens: the page for a visitor who is not signed in (or while loading), otherwise null */
function viewAuth(sub){
 if(!sb)return notReady();
 if(!authReady){return authShell("Account","",`<p class="muted" style="text-align:center">Loading…</p>`)}
 if(sub==="reset")return authShell("Set a new password","Choose a new password for your account.",`<form class="stack" data-form="acReset" novalidate><div><label class="lbl">New password</label><input class="field" name="password" type="password" autocomplete="new-password" minlength="8" required></div><div id="acMsg"></div><button class="btn primary block">Save password</button></form>`);
 if(!user){
  if(sub==="register")return authShell("Create account","Save your details for faster checkout and see your orders in one place.",`${socialHtml("Sign up")}<form class="stack" data-form="acRegister" novalidate>
   <div><label class="lbl">Full name</label><input class="field" name="full_name" autocomplete="name" maxlength="120" required></div>
   <div><label class="lbl">Email</label><input class="field" name="email" type="email" autocomplete="email" required></div>
   <div><label class="lbl">Password</label><div class="pw"><input class="field" name="password" type="password" autocomplete="new-password" minlength="8" required><button type="button" class="pwtoggle" data-act="pw">Show</button></div><div class="help">At least 8 characters.</div></div>
   <div id="acMsg"></div><button class="btn primary block">Create account</button>
   <p class="muted small" style="text-align:center">Already have an account? <a class="textlink" href="#/account">Sign in</a></p></form>`);
  if(sub==="forgot")return authShell("Reset password","Enter your email and we’ll send you a link to set a new password.",`<form class="stack" data-form="acForgot" novalidate><div><label class="lbl">Email</label><input class="field" name="email" type="email" autocomplete="email" required></div><div id="acMsg"></div><button class="btn primary block">Send reset link</button><p class="muted small" style="text-align:center"><a class="textlink" href="#/account">← Back to sign in</a></p></form>`);
  return authShell("Sign in","Welcome back to CozyHouseVibe.",`${socialHtml("Continue")}<form class="stack" data-form="acLogin" novalidate>
   <div><label class="lbl">Email</label><input class="field" name="email" type="email" autocomplete="email" required></div>
   <div><label class="lbl" style="display:flex;justify-content:space-between">Password <a class="textlink small" href="#/account/forgot">Forgot password?</a></label><div class="pw"><input class="field" name="password" type="password" autocomplete="current-password" required><button type="button" class="pwtoggle" data-act="pw">Show</button></div></div>
   <div id="acMsg"></div><button class="btn primary block">Sign in</button>
   <div class="author"><span>New here?</span></div><a class="btn block" href="#/account/register">Create an account</a></form>`);
 }
 return null}
/* ===== Sign in with Google / Facebook (buttons appear only for providers switched on in Supabase → Authentication → Providers) ===== */
let SOCIAL=null;
const SOCIAL_ICON={google:'<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',facebook:'<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>'};
async function loadSocial(){if(SOCIAL)return SOCIAL;try{const r=await fetch(SB_URL+"/auth/v1/settings",{headers:{apikey:SB_KEY}});const d=await r.json();SOCIAL=["google","facebook"].filter(p=>d.external&&d.external[p])}catch(e){SOCIAL=[]}return SOCIAL}
function socialHtml(verb){setTimeout(async()=>{const L=await loadSocial(),box=$("#socialBox");if(!box)return;
  box.innerHTML=L.length?L.map(p=>`<button type="button" class="btn block socialbtn" data-act="oauth" data-p="${p}">${SOCIAL_ICON[p]} ${verb} with ${p==="google"?"Google":"Facebook"}</button>`).join("")+`<div class="author"><span>or use email</span></div>`:"";box.hidden=!L.length},0);
 return `<div id="socialBox" class="socialbox" hidden></div>`}
async function oauthLogin(p){const next=LS.get("afterLogin",null)||"#/account";LS.set("afterLogin",next);
 const{error}=await sb.auth.signInWithOAuth({provider:p,options:{redirectTo:SITE_URL,...(p==="google"?{queryParams:{prompt:"select_account"}}:{})}});
 if(error)acMsg(esc(authErr(error)))}
function acMsg(html,ok){const m=$("#acMsg");if(m)m.innerHTML=`<div class="${ok?"okbox":"note"}" style="margin-bottom:4px">${html}</div>`}
async function authSubmit(k,f){
 const fd=Object.fromEntries(new FormData(f)),btn=f.querySelector("button.primary");const busy=b=>{btn.disabled=b};
 const email=String(fd.email||"").trim().toLowerCase();
 try{
 if(k==="acLogin"){if(!email||!fd.password)return acMsg("Enter your email and password.");busy(true);
  const{error}=await sb.auth.signInWithPassword({email,password:fd.password});busy(false);if(error)return acMsg(esc(authErr(error)));
  toast("Signed in");location.hash=LS.get("afterLogin","")||"#/account";LS.set("afterLogin","");return}
 if(k==="acRegister"){const name=String(fd.full_name||"").trim();
  if(!name||!/^\S+@\S+\.\S+$/.test(email))return acMsg("Enter your name and a valid email.");if(String(fd.password).length<8)return acMsg("Password must be at least 8 characters.");
  busy(true);const{data,error}=await sb.auth.signUp({email,password:fd.password,options:{data:{full_name:name},emailRedirectTo:SITE_URL}});busy(false);
  if(error)return acMsg(esc(authErr(error)));
  if(data.user&&Array.isArray(data.user.identities)&&!data.user.identities.length)return acMsg("An account with this email already exists. <a class='textlink' href='#/account'>Sign in</a>");
  if(!data.session){f.innerHTML=`<div class="okbox">Almost done! We sent a confirmation link to <b>${esc(email)}</b>. Open it to activate your account.</div>`;return}
  toast("Account created");location.hash=LS.get("afterLogin","")||"#/account";LS.set("afterLogin","");return}
 if(k==="acForgot"){if(!/^\S+@\S+\.\S+$/.test(email))return acMsg("Enter a valid email.");busy(true);
  const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:SITE_URL});busy(false);if(error)return acMsg(esc(authErr(error)));
  f.innerHTML=`<div class="okbox">If an account exists for <b>${esc(email)}</b>, a reset link is on its way.</div>`;return}
 if(k==="acReset"){if(String(fd.password).length<8)return acMsg("Password must be at least 8 characters.");busy(true);
  const{error}=await sb.auth.updateUser({password:fd.password});busy(false);if(error)return acMsg(esc(authErr(error)));toast("Password updated");location.hash="#/account";return}
 }catch(e){busy(false);acMsg(esc(authErr(e)))}}
