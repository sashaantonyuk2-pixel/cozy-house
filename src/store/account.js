/* ===== My account (signed-in customer): account router and Profile =====
   Sign-in / registration screens are in auth.js; orders, invoices, returns and cancellation in orders.js. */
function viewAccount(parts){
 const sub=parts[1]||"";
 const a=viewAuth(sub);if(a)return a;
 if(sub==="invoice"){setTimeout(()=>fillInvoice(parts[2]),0);return `<div class="shell section invpage"><div id="invBox"><p class="muted">Loading invoice…</p></div></div>`}
 const el=`<div class="shell section"><div class="acct"><div class="acctside"><div class="authicon">${ICON.user}</div><b id="acName">${esc((user.user_metadata&&user.user_metadata.full_name)||"")}</b><span class="muted small">${esc(user.email)}</span>
  <nav><a href="#/account" class="${sub===""?"on":""}">Profile</a><a href="#/account/orders" class="${sub==="orders"?"on":""}">My orders</a><a href="#/favorites">Wishlist</a></nav><button class="btn block" data-act="signout">Sign out</button></div>
  <div id="acMain"><p class="muted">Loading…</p></div></div></div>`;
 setTimeout(()=>sub==="orders"?fillOrders():fillProfile(),0);
 return el}
async function fillProfile(){const box=$("#acMain");if(!box)return;const p=await loadProfile()||{};
 const f=(k,l,o={})=>`<div class="${o.full?"full":""}"><label>${l}</label><input class="field" name="${k}" value="${esc(p[k]||"")}" autocomplete="${o.ac||"off"}" maxlength="${o.max||100}" ${o.type?`type="${o.type}"`:""}></div>`;
 box.innerHTML=`<form class="panel" data-form="acProfile"><h2>Profile</h2><div class="form">${f("full_name","Full name",{full:true,ac:"name",max:120})}${f("phone","Phone",{ac:"tel",type:"tel",max:40})}<div><label>Email</label><input class="field" value="${esc(user.email)}" disabled></div>
  ${f("address_line","Street address",{full:true,ac:"street-address",max:200})}${f("city","City",{ac:"address-level2"})}${f("state","State",{ac:"address-level1",max:60})}${f("zip","ZIP code",{ac:"postal-code",max:20})}</div>
  <p class="help">We’ll fill these in for you at checkout.</p><div id="acMsg"></div><button class="btn primary" style="margin-top:8px">Save changes</button></form>
  <div class="panel dangerzone"><h2>Delete account</h2><p class="small" style="margin:0 0 10px">Permanently delete your account, saved details and wishlist. Past orders stay in our records for tax and accounting, but will no longer be linked to you. This can’t be undone.</p>
  <button class="btn danger sm" data-act="delacct">Delete my account</button>
  <form class="stack" data-form="delacct" hidden style="margin-top:12px"><label class="lbl">Type <b>DELETE</b> to confirm</label><input class="field" name="confirm" autocomplete="off" placeholder="DELETE" style="max-width:220px"><div class="delmsg"></div><div><button class="btn danger">Permanently delete account</button></div></form></div>`}
/* ===== wishlist saved in the account (same list on every device) ===== */
async function syncFavs(){if(!sb||!user)return;try{
 const{data,error}=await sb.from("wishlists").select("product_id");if(error)throw error;
 const remote=data.map(r=>r.product_id),local=favs.filter(id=>!remote.includes(id)&&prod(id));
 if(local.length)await sb.from("wishlists").insert(local.map(product_id=>({product_id})));
 favs=[...new Set([...remote,...local])];LS.set("favs",favs);badges();
 document.querySelectorAll('[data-act="fav"]').forEach(b=>b.classList.toggle("on",favs.includes(b.dataset.id)));if(location.hash.startsWith("#/favorites"))render()}catch(e){console.warn("wishlist sync failed",e&&e.message)}}
function favRemote(id,on){if(!sb||!user)return;(on?sb.from("wishlists").insert({product_id:id}):sb.from("wishlists").delete().eq("product_id",id)).then(({error})=>{if(error&&!/duplicate/i.test(error.message))console.warn("wishlist save failed",error.message)})}
/* ===== delete my account ===== */
async function deleteAccount(f){const msg=f.querySelector(".delmsg"),btn=f.querySelector("button");msg.innerHTML="";
 if(f.confirm.value.trim()!=="DELETE"){msg.innerHTML=`<div class="note">Please type DELETE to confirm.</div>`;return}
 btn.disabled=true;const{error}=await sb.rpc("delete_my_account",{p_confirm:"DELETE"});btn.disabled=false;
 if(error){const m=error.message||"",n=(m.match(/:(\d+)/)||[])[1];
  msg.innerHTML=`<div class="note">${/OPEN_ORDERS/.test(m)?`You have ${n} order${n==="1"?"":"s"} in progress. You can delete your account once ${n==="1"?"it’s":"they’re"} delivered or cancelled.`:/OPEN_RETURNS/.test(m)?"You have a return in progress. You can delete your account once it’s completed.":/ADMIN_ACCOUNT/.test(m)?"This account manages the shop and can’t be deleted here.":"Couldn’t delete the account. Please try again or contact us."}</div>`;return}
 try{await sb.auth.signOut({scope:"local"})}catch(e){}
 user=null;profile=null;favs=[];LS.set("favs",favs);LS.set("buyer",{});badges();acctBadge();toast("Your account has been deleted");location.hash="#/"}
async function acSubmit(k,f){
 if(k!=="acProfile")return authSubmit(k,f);
 const fd=Object.fromEntries(new FormData(f)),btn=f.querySelector("button.primary");const busy=b=>{btn.disabled=b};
 try{
 if(k==="acProfile"){busy(true);const row={id:user.id};["full_name","phone","address_line","city","state","zip"].forEach(x=>row[x]=String(fd[x]||"").trim()||null);
  const{data,error}=await sb.from("profiles").upsert(row).select().maybeSingle();busy(false);if(error)return acMsg(esc(authErr(error)));profile=data;
  if(row.full_name)sb.auth.updateUser({data:{full_name:row.full_name}}).catch(()=>{});const n=$("#acName");if(n)n.textContent=row.full_name||"";acMsg("Saved ✓",true);return}
 }catch(e){busy(false);acMsg(esc(authErr(e)))}}
