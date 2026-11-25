/* ===== customer accounts (Supabase Auth, storefront only) ===== */
let user=null,profile=null,authReady=false;
function sbInit(){
 try{if(!window.supabase||!window.supabase.createClient)return;
  sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{flowType:"pkce",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  sb.auth.onAuthStateChange((ev,session)=>{const was=user&&user.id;user=session?session.user:null;if(!user)profile=null;
   setTimeout(()=>{acctBadge();
    if(ev==="PASSWORD_RECOVERY"){location.hash="#/account/reset";return}
    if((was||null)!==(user&&user.id||null)&&/^#\/(account|checkout|orders)/.test(location.hash))render()},0)});
  sb.auth.getSession().then(({data})=>{user=data.session?data.session.user:null;authReady=true;acctBadge();
   if(/[?&]code=|[?&]error/.test(location.search))history.replaceState(null,"",location.pathname+(location.hash||"#/account"));
   if(/^#\/(account|checkout|orders)/.test(location.hash))render()});
 }catch(e){sb=null}}
function acctBadge(){const b=$("#acctBtn");if(!b)return;b.classList.toggle("on",!!user);
 const nm=user&&((profile&&profile.full_name)||(user.user_metadata&&user.user_metadata.full_name)||"").split(" ")[0];
 const l=$("#acctLbl");if(l)l.innerHTML=`<small>${user?`Hi${nm?", "+esc(nm):""}`:"Hello, sign in"}</small><b>Account <i class="chev"></i></b>`;
 const m=$("#navAcct");if(m)m.textContent=user?"My account":"Sign in / Register";
 const mu=$("#acctMenu");if(!mu)return;
 const links=`<a role="menuitem" href="#/account/orders">${ICON.bag.replace("<svg",'<svg width="18" height="18"')} My orders</a><a role="menuitem" href="#/account">${ICON.user.replace("<svg",'<svg width="18" height="18"')} My details</a><a role="menuitem" href="#/favorites">${ICON.heart.replace("<svg",'<svg width="18" height="18"')} Wishlist</a>`;
 mu.innerHTML=user?`<div class="amhead"><b>${esc(nm||"Your account")}</b><span>${esc(user.email)}</span></div><div class="amlinks">${links}</div><button class="btn block sm" data-act="signout" role="menuitem">Sign out</button>`
  :`<a class="btn primary block" href="#/account" role="menuitem">Sign in</a><p class="amnew">New customer? <a href="#/account/register" role="menuitem">Start here</a></p><div class="amlinks">${links}</div>`}
function closeAcct(){const w=$("#acctWrap");if(w){w.classList.remove("open");$("#acctBtn").setAttribute("aria-expanded","false")}}
async function loadProfile(){if(!sb||!user)return null;if(profile)return profile;const{data}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();profile=data||{id:user.id};return profile}
function authShell(title,sub,body){return `<div class="shell section"><div class="authbox"><div class="authhead"><span class="authicon">${ICON.user}</span><h1>${title}</h1>${sub?`<p class="muted">${sub}</p>`:""}</div>${body}</div></div>`}
function notReady(){return authShell("Account","",`<div class="note">${sb?"Loading…":"Accounts are unavailable right now. You can still place orders as a guest."}</div>`)}
function viewAccount(parts){
 const sub=parts[1]||"";
 if(!sb)return notReady();
 if(!authReady){return authShell("Account","",`<p class="muted" style="text-align:center">Loading…</p>`)}
 if(sub==="reset")return authShell("Set a new password","Choose a new password for your account.",`<form class="stack" data-form="acReset" novalidate><div><label class="lbl">New password</label><input class="field" name="password" type="password" autocomplete="new-password" minlength="8" required></div><div id="acMsg"></div><button class="btn primary block">Save password</button></form>`);
 if(!user){
  if(sub==="register")return authShell("Create account","Save your details for faster checkout and see your orders in one place.",`<form class="stack" data-form="acRegister" novalidate>
   <div><label class="lbl">Full name</label><input class="field" name="full_name" autocomplete="name" maxlength="120" required></div>
   <div><label class="lbl">Email</label><input class="field" name="email" type="email" autocomplete="email" required></div>
   <div><label class="lbl">Password</label><div class="pw"><input class="field" name="password" type="password" autocomplete="new-password" minlength="8" required><button type="button" class="pwtoggle" data-act="pw">Show</button></div><div class="help">At least 8 characters.</div></div>
   <div id="acMsg"></div><button class="btn primary block">Create account</button>
   <p class="muted small" style="text-align:center">Already have an account? <a class="textlink" href="#/account">Sign in</a></p></form>`);
  if(sub==="forgot")return authShell("Reset password","Enter your email and we’ll send you a link to set a new password.",`<form class="stack" data-form="acForgot" novalidate><div><label class="lbl">Email</label><input class="field" name="email" type="email" autocomplete="email" required></div><div id="acMsg"></div><button class="btn primary block">Send reset link</button><p class="muted small" style="text-align:center"><a class="textlink" href="#/account">← Back to sign in</a></p></form>`);
  return authShell("Sign in","Welcome back to CozyHouseVibe.",`<form class="stack" data-form="acLogin" novalidate>
   <div><label class="lbl">Email</label><input class="field" name="email" type="email" autocomplete="email" required></div>
   <div><label class="lbl" style="display:flex;justify-content:space-between">Password <a class="textlink small" href="#/account/forgot">Forgot password?</a></label><div class="pw"><input class="field" name="password" type="password" autocomplete="current-password" required><button type="button" class="pwtoggle" data-act="pw">Show</button></div></div>
   <div id="acMsg"></div><button class="btn primary block">Sign in</button>
   <div class="author"><span>New here?</span></div><a class="btn block" href="#/account/register">Create an account</a></form>`);
 }
 const el=`<div class="shell section"><div class="acct"><div class="acctside"><div class="authicon">${ICON.user}</div><b id="acName">${esc((user.user_metadata&&user.user_metadata.full_name)||"")}</b><span class="muted small">${esc(user.email)}</span>
  <nav><a href="#/account" class="${sub===""?"on":""}">My details</a><a href="#/account/orders" class="${sub==="orders"?"on":""}">My orders</a><a href="#/favorites">Wishlist</a></nav><button class="btn block" data-act="signout">Sign out</button></div>
  <div id="acMain"><p class="muted">Loading…</p></div></div></div>`;
 setTimeout(()=>sub==="orders"?fillOrders():fillProfile(),0);
 return el}
async function fillProfile(){const box=$("#acMain");if(!box)return;const p=await loadProfile()||{};
 const f=(k,l,o={})=>`<div class="${o.full?"full":""}"><label>${l}</label><input class="field" name="${k}" value="${esc(p[k]||"")}" autocomplete="${o.ac||"off"}" maxlength="${o.max||100}" ${o.type?`type="${o.type}"`:""}></div>`;
 box.innerHTML=`<form class="panel" data-form="acProfile"><h2>My details</h2><div class="form">${f("full_name","Full name",{full:true,ac:"name",max:120})}${f("phone","Phone",{ac:"tel",type:"tel",max:40})}<div><label>Email</label><input class="field" value="${esc(user.email)}" disabled></div>
  ${f("address_line","Street address",{full:true,ac:"street-address",max:200})}${f("city","City",{ac:"address-level2"})}${f("state","State",{ac:"address-level1",max:60})}${f("zip","ZIP code",{ac:"postal-code",max:20})}</div>
  <p class="help">We’ll fill these in for you at checkout.</p><div id="acMsg"></div><button class="btn primary" style="margin-top:8px">Save details</button></form>`}
async function fillOrders(){const box=$("#acMain");if(!box)return;
 const{data,error}=await sb.from("orders").select("order_no,status,items,total,created_at,carrier,tracking_number,shipped_at,customer,delivery_eta,delivered_at,payment_status").order("created_at",{ascending:false}).limit(50);
 if(error){box.innerHTML=`<div class="note">${esc(authErr(error))}</div>`;return}
 box.innerHTML=`<div class="panel"><h2>My orders</h2>${data.length?data.map(o=>`<div class="oblock"><div class="ohead"><div><b>${esc(o.order_no)}</b><span class="muted small"> · ${fmtDate(o.created_at)} · ${o.items.reduce((s,i)=>s+(+i.qty||0),0)} items</span></div><b>${money(o.total)}</b></div>
 ${orderTracker(o)}<details class="oitems"><summary>Items${o.customer&&o.customer.address?" & shipping address":""}</summary>${o.items.map(i=>`<div class="row small"><span>${esc(i.name)}${i.opt?` <span class="muted">(${esc(optStr(i.opt,prod(i.id)))})</span>`:""} × ${+i.qty||0}${i.sku?` <span class="muted">· Item # ${esc(i.sku)}</span>`:""}</span><span>${money((+i.price||0)*(+i.qty||0))}</span></div>`).join("")}${o.customer&&o.customer.address?`<p class="small muted" style="margin:8px 0 0">Ship to: ${esc([o.customer.name,o.customer.address,o.customer.city,[o.customer.state,o.customer.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "))}</p>`:""}</details></div>`).join(""):`<div class="empty" style="border:0;padding:30px 0"><b>No orders yet</b>Your orders will show up here.<br><br><a class="btn primary" href="#/shop">${t("shopNow")} →</a></div>`}</div>`}
function acMsg(html,ok){const m=$("#acMsg");if(m)m.innerHTML=`<div class="${ok?"okbox":"note"}" style="margin-bottom:4px">${html}</div>`}
async function acSubmit(k,f){
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
 if(k==="acProfile"){busy(true);const row={id:user.id};["full_name","phone","address_line","city","state","zip"].forEach(x=>row[x]=String(fd[x]||"").trim()||null);
  const{data,error}=await sb.from("profiles").upsert(row).select().maybeSingle();busy(false);if(error)return acMsg(esc(authErr(error)));profile=data;
  if(row.full_name)sb.auth.updateUser({data:{full_name:row.full_name}}).catch(()=>{});const n=$("#acName");if(n)n.textContent=row.full_name||"";acMsg("Saved ✓",true);return}
 }catch(e){busy(false);acMsg(esc(authErr(e)))}}
async function saveOrderToDb(o){
 if(!sb)return{ok:false};const c=o.c;
 const customer={name:c.name,phone:c.phone,email:c.email||null,delivery:c.delivery,city:c.city,state:c.state||null,zip:c.zip||null,address:c.address||null,payment:c.payment,comment:c.comment||null};
 for(let i=0;i<3;i++){
  const row={order_no:o.no,customer,items:o.lines.map(l=>({id:l.id,name:l.name,sku:l.sku||null,price:l.price,qty:l.qty,...(l.opt?{opt:l.opt}:{})})),total:o.total,currency:"USD",user_id:user?user.id:null};
  const{error}=await sb.from("orders").insert(row);
  if(!error)return{ok:true};
  const m=error.message||"";
  if(/duplicate|unique/i.test(m)){o.no=o.no.slice(0,-4)+Math.floor(1000+Math.random()*9000);continue}
  let r=m.match(/OUT_OF_STOCK:(.+):(\d+)/);if(r)return{ok:false,stock:true,msg:+r[2]>0?`Only ${r[2]} left of “${r[1]}”. Please update the quantity in your cart.`:`“${r[1]}” just sold out. Please remove it from your cart.`};
  r=m.match(/BAD_FIELD:(\w+)/);if(r)return{ok:false,stock:true,msg:`Please check your ${{name:"name",email:"email address",phone:"phone number",address:"street address",city:"city",state:"state",zip:"ZIP code"}[r[1]]||"details"}.`};
  r=m.match(/OPTION_REQUIRED:(.+):[^:]+$/);if(r)return{ok:false,stock:true,msg:`The options for “${r[1]}” have changed. Please remove it from your cart and add it again.`};
  r=m.match(/UNAVAILABLE:(.+)/);if(r)return{ok:false,stock:true,msg:`“${r[1]}” is no longer available. Please remove it from your cart.`};
  console.warn("order save failed",m);return{ok:false}}
 return{ok:false}}

async function sendContact(f){
 const fd=Object.fromEntries(new FormData(f)),btn=f.querySelector("button.primary"),msg=$("#ctMsg");
 if(fd.website)return; // honeypot
 const name=String(fd.name||"").trim(),email=String(fd.email||"").trim(),body=String(fd.body||"").trim(),order_no=String(fd.order_no||"").trim()||null;
 if(!name||!/^\S+@\S+\.\S+$/.test(email)||body.length<2){msg.innerHTML=`<div class="note">Please enter your name, a valid email and a message.</div>`;return}
 if(!sb){msg.innerHTML=`<div class="note">Can’t send right now. Please email us instead.</div>`;return}
 btn.disabled=true;const{error}=await sb.from("messages").insert({name,email,body,order_no});btn.disabled=false;
 if(error){msg.innerHTML=`<div class="note">${/TOO_MANY/.test(error.message)?"You’ve sent several messages already. We’ll get back to you soon.":"Couldn’t send your message. Please try again or email us."}</div>`;return}
 LS.set("ctName",name);LS.set("ctEmail",email);
 f.innerHTML=`<div class="okbox">Thanks, ${esc(name.split(" ")[0])}! Your message was sent. We usually reply within one business day.</div>`}
