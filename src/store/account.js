/* ===== My account (signed-in customer): account router and My details =====
   Sign-in / registration screens are in auth.js; orders, invoices, returns and cancellation in orders.js. */
function viewAccount(parts){
 const sub=parts[1]||"";
 const a=viewAuth(sub);if(a)return a;
 if(sub==="invoice"){setTimeout(()=>fillInvoice(parts[2]),0);return `<div class="shell section invpage"><div id="invBox"><p class="muted">Loading invoice…</p></div></div>`}
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
async function acSubmit(k,f){
 if(k!=="acProfile")return authSubmit(k,f);
 const fd=Object.fromEntries(new FormData(f)),btn=f.querySelector("button.primary");const busy=b=>{btn.disabled=b};
 try{
 if(k==="acProfile"){busy(true);const row={id:user.id};["full_name","phone","address_line","city","state","zip"].forEach(x=>row[x]=String(fd[x]||"").trim()||null);
  const{data,error}=await sb.from("profiles").upsert(row).select().maybeSingle();busy(false);if(error)return acMsg(esc(authErr(error)));profile=data;
  if(row.full_name)sb.auth.updateUser({data:{full_name:row.full_name}}).catch(()=>{});const n=$("#acName");if(n)n.textContent=row.full_name||"";acMsg("Saved ✓",true);return}
 }catch(e){busy(false);acMsg(esc(authErr(e)))}}
