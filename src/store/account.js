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
/* ===== My orders: totals, invoice, returns ===== */
const RET_REASONS={better_price:["Found a better price",0],poor_condition:["Item arrived in poor condition",1],defective:["Defective item",1],not_as_expected:["Doesn’t look as expected",0]};
const RET_MAX_FILES=6,RET_MAX_MB=50;
function retWindow(o){const days=shipCfg().days,base=o.delivered_at?Date.parse(o.delivered_at):Date.now();return{until:base+days*864e5,days}}
function canReturn(o){return o.status==="completed"&&Date.now()<=retWindow(o).until}
function canCancel(o){return["new","confirmed"].includes(o.status)}
const CANCEL_REASONS=["Ordered by mistake","Changed my mind","Found a better price","Delivery takes too long","Other"];
function cancelForm(o,guestEmail){return `<form class="cancelform" data-form="cancelord" data-no="${esc(o.order_no)}" ${guestEmail?`data-email="${esc(guestEmail)}"`:""} hidden><b>Cancel order ${esc(o.order_no)}?</b><p class="small muted" style="margin:0">You can cancel until the order ships. ${["paid","partially_refunded"].includes(o.payment_status)?"Your payment will be refunded to the original payment method within 5 business days.":"Nothing will be charged."}</p><select class="field" name="reason" aria-label="Reason">${CANCEL_REASONS.map(r=>`<option>${r}</option>`).join("")}</select><div class="cancelmsg"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn danger">Yes, cancel order</button><button type="button" class="btn" data-act="cancelopen" data-no="${esc(o.order_no)}">Keep order</button></div></form>`}
async function submitCancel(f){const msg=f.querySelector(".cancelmsg"),btn=f.querySelector("button.danger");btn.disabled=true;
 const{data,error}=await sb.rpc("cancel_order",{p_no:f.dataset.no,p_email:f.dataset.email||null,p_reason:f.reason.value});btn.disabled=false;
 if(error){const m=error.message||"";msg.innerHTML=`<div class="note">${/ALREADY_SHIPPED/.test(m)?"This order has already shipped, so it can’t be cancelled. Once it’s delivered you can request a return.":/ALREADY_CANCELLED/.test(m)?"This order is already cancelled.":"Couldn’t cancel the order. Please try again or contact us."}</div>`;return}
 toast("Order "+data.order_no+" cancelled");if(f.dataset.email){const tf=$('[data-form="track"]');tf&&tf.requestSubmit()}else fillOrders()}
function retStatus(r){const free=r.free_return,note=r.seller_note?`<br><span class="muted">Note from us: ${esc(r.seller_note)}</span>`:"";
 const M={requested:`↩ Return requested on ${fmtDate(r.created_at)}. We’ll review it and reply by email within 1–2 business days.`,
  approved:`✓ Return approved. ${free?"We’ll email you a prepaid return label — return shipping is free.":"Please ship the item(s) to the address in our email. Return shipping is paid by you."} Pack the items in their original packaging.`,
  rejected:`Your return request was declined.`,received:`📦 We’ve received your return. Your refund is being processed.`,refunded:`💳 Your refund has been issued. It can take 5–10 business days to appear.`};
 return `<div class="retstat r-${r.status}">${M[r.status]||esc(r.status)}${note}</div>`}
function retForm(o){const w=retWindow(o);return `<form class="retform" data-form="retreq" data-id="${o.id}" data-no="${esc(o.order_no)}" hidden novalidate>
 <h4>Return items <span class="muted small">· within ${w.days} days of delivery (until ${fmtDate(w.until)})</span></h4>
 <fieldset><legend>Which items?</legend>${o.items.map((i,k)=>`<label class="retitem"><input type="checkbox" name="ri" value="${k}" ${o.items.length===1?"checked":""}><span>${esc(i.name)}${i.opt?` <span class="muted">(${esc(optStr(i.opt,prod(i.id)))})</span>`:""}</span>${+i.qty>1?`<select class="field" name="rq${k}" aria-label="Quantity">${Array.from({length:+i.qty},(_,n)=>`<option value="${n+1}" ${n+1===+i.qty?"selected":""}>${n+1}</option>`).join("")}</select>`:`<input type="hidden" name="rq${k}" value="1">`}</label>`).join("")}</fieldset>
 <fieldset><legend>Reason</legend>${Object.entries(RET_REASONS).map(([k,[l,free]])=>`<label class="retreason"><input type="radio" name="reason" value="${k}"><span><b>${l}</b><small>${free?"Free return — we send you a prepaid label":"Return shipping is paid by you"}</small></span></label>`).join("")}</fieldset>
 <label class="lbl">Tell us more <span class="muted small">(optional)</span></label><textarea class="field" name="details" maxlength="2000" placeholder="What happened? For a defect, please describe it."></textarea>
 <label class="lbl">Photos or video of the item <span class="req">*</span></label><label class="filepick"><input type="file" name="media" accept="image/*,video/mp4,video/quicktime,video/webm" multiple><span class="btn sm">📎 Choose photos or video</span><span class="filenames">No files selected</span></label>
 <div class="help">Up to ${RET_MAX_FILES} files, ${RET_MAX_MB} MB each. Show the item, its condition and the packaging${"; for a defect — the defect itself"}.</div>
 <label class="check"><input type="checkbox" name="agree" value="1"> I confirm the item is unused and kept in its original condition and packaging (except for the reported defect).</label>
 <div class="retmsg"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary">Send return request</button><button type="button" class="btn" data-act="retopen" data-id="${o.id}">Cancel</button></div>
 <p class="small muted" style="margin:0">See our <a class="textlink" href="#/returns" target="_blank">Return policy</a>.</p></form>`}
function orderTotals(o){const sub=o.subtotal!=null?+o.subtotal:+o.total;return `<div class="ototals"><div class="row small"><span>${t("subtotal")}</span><span>${money(sub)}</span></div><div class="row small"><span>${t("shipping")}</span><span>${+o.shipping?money(o.shipping):t("free")}</span></div><div class="row small"><span>Sales tax${+o.tax_rate?` (${esc(o.customer&&o.customer.state||"")} ${+o.tax_rate}%)`:""}</span><span>${money(o.tax||0)}</span></div><div class="row small"><b>${t("total")}</b><b>${money(o.total)}</b></div></div>`}
async function fillOrders(){const box=$("#acMain");if(!box)return;
 const[{data,error},rr]=await Promise.all([sb.from("orders").select("id,order_no,status,items,total,subtotal,shipping,tax,tax_rate,created_at,carrier,tracking_number,shipped_at,customer,delivery_eta,delivered_at,payment_status").order("created_at",{ascending:false}).limit(50),
  sb.from("return_requests").select("id,order_id,status,reason,free_return,created_at,seller_note").order("created_at",{ascending:false})]);
 if(error){box.innerHTML=`<div class="note">${esc(authErr(error))}</div>`;return}
 const R={};(rr.data||[]).forEach(r=>{if(!R[r.order_id]||R[r.order_id].status==="rejected")R[r.order_id]=r});
 box.innerHTML=`<div class="panel"><h2>My orders</h2>${data.length?data.map(o=>{const r=R[o.id],paid=o.status!=="cancelled",canRet=canReturn(o)&&(!r||r.status==="rejected");
  return `<div class="oblock"><div class="ohead"><div><b>${esc(o.order_no)}</b><span class="muted small"> · ${fmtDate(o.created_at)} · ${o.items.reduce((s,i)=>s+(+i.qty||0),0)} items</span></div><b>${money(o.total)}</b></div>
 ${orderTracker(o)}${r?retStatus(r):""}
 <div class="oacts">${paid?`<a class="btn sm" href="#/account/invoice/${encodeURIComponent(o.order_no)}">🧾 Invoice</a>`:""}${canRet?`<button class="btn sm" data-act="retopen" data-id="${o.id}">↩ Return items</button>`:""}${canCancel(o)?`<button class="btn sm" data-act="cancelopen" data-no="${esc(o.order_no)}">✕ Cancel order</button>`:""}</div>${canRet?retForm(o):""}${canCancel(o)?cancelForm(o):""}${o.status==="shipped"?`<p class="small muted" style="margin:8px 0 0">Returns can be requested after delivery, within ${shipCfg().days} days.</p>`:""}
 <details class="oitems"><summary>Items${o.customer&&o.customer.address?" & shipping address":""}</summary>${o.items.map(i=>`<div class="row small"><span>${esc(i.name)}${i.opt?` <span class="muted">(${esc(optStr(i.opt,prod(i.id)))})</span>`:""} × ${+i.qty||0}${i.sku?` <span class="muted">· Item # ${esc(i.sku)}</span>`:""}</span><span>${money((+i.price||0)*(+i.qty||0))}</span></div>`).join("")}${orderTotals(o)}${o.customer&&o.customer.address?`<p class="small muted" style="margin:8px 0 0">Ship to: ${esc([o.customer.name,o.customer.address,o.customer.city,[o.customer.state,o.customer.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "))}</p>`:""}</details></div>`}).join(""):`<div class="empty" style="border:0;padding:30px 0"><b>No orders yet</b>Your orders will show up here.<br><br><a class="btn primary" href="#/shop">${t("shopNow")} →</a></div>`}</div>`}
async function submitReturn(f){const msg=f.querySelector(".retmsg"),err=h=>{msg.innerHTML=`<div class="note">${h}</div>`};msg.innerHTML="";
 const idx=[...f.querySelectorAll("[name=ri]:checked")].map(x=>+x.value);if(!idx.length)return err("Please choose the item(s) you’d like to return.");
 const reason=(f.querySelector("[name=reason]:checked")||{}).value;if(!reason)return err("Please choose a reason.");
 const files=[...f.media.files];if(!files.length)return err("Please add at least one photo or video of the item.");
 if(files.length>RET_MAX_FILES)return err(`Please add up to ${RET_MAX_FILES} files.`);
 if(files.some(x=>x.size>RET_MAX_MB*1048576))return err(`Each file must be under ${RET_MAX_MB} MB.`);
 if(files.some(x=>!/^(image|video)\//.test(x.type||"")&&!/\.(heic|heif)$/i.test(x.name)))return err("Please add photos or videos only.");
 if(!f.agree.checked)return err("Please confirm the condition of the item.");
 const btn=f.querySelector("button.primary");btn.disabled=true;btn.textContent="Uploading…";
 try{const paths=[];for(let k=0;k<files.length;k++){const x=files[k],ext=((x.name.match(/\.([a-z0-9]{2,5})$/i)||[])[1]||"bin").toLowerCase(),p=`${user.id}/${f.dataset.no}-${Date.now()}-${k}.${ext}`;
   const{error}=await sb.storage.from("return-media").upload(p,x,{contentType:x.type||undefined,upsert:false});if(error)throw error;paths.push(p)}
  const items=idx.map(i=>({i,qty:+((f.querySelector(`[name=rq${i}]`)||{}).value||1)}));
  const{error}=await sb.from("return_requests").insert({order_id:+f.dataset.id,reason,details:f.details.value.trim()||null,items,media:paths});
  if(error)throw error;toast("Return request sent ✓");fillOrders()}
 catch(e){const m=(e&&e.message)||"";btn.disabled=false;btn.textContent="Send return request";
  err(/RETURN_WINDOW_CLOSED/.test(m)?"The return window for this order has closed.":/ALREADY_REQUESTED/.test(m)?"A return for this order has already been requested.":/NOT_RETURNABLE/.test(m)?"This order can’t be returned yet — it hasn’t shipped.":/mime|type/i.test(m)?"This file type isn’t supported. Please use JPG, PNG, HEIC or MP4/MOV video.":/size|large/i.test(m)?`A file is too large (max ${RET_MAX_MB} MB).`:"Couldn’t send your request. Please try again or contact us.")}}
/* ===== Invoice (download as PDF / print) ===== */
function loadHtml2pdf(){if(window.html2pdf)return Promise.resolve(window.html2pdf);return new Promise((res,rej)=>{const s=document.createElement("script");
 s.src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";s.integrity="sha512-GsLlZN/3F2ErC5ifS5QtgpiJtWd43JWSuIgh7mbzZ8zBps+dvLusV+eNQATqgA/HdeKFVgA5v3S/cIrLF7QnIg==";s.crossOrigin="anonymous";s.referrerPolicy="no-referrer";
 s.onload=()=>window.html2pdf?res(window.html2pdf):rej(new Error("PDF library failed to load"));s.onerror=()=>rej(new Error("PDF library failed to load"));document.head.appendChild(s)})}
async function downloadInvoice(btn){const el=$(".invoice");if(!el)return;const no=btn.dataset.no||"invoice",txt=btn.textContent;btn.disabled=true;btn.textContent="Preparing PDF…";
 try{const h=await loadHtml2pdf();el.classList.add("pdfmode");
  await h().set({margin:[10,10,12,10],filename:`CozyHouseVibe-Invoice-${no}.pdf`,image:{type:"jpeg",quality:.96},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff"},jsPDF:{unit:"mm",format:"letter",orientation:"portrait"},pagebreak:{mode:["css","legacy"]}}).from(el).save();
  toast("Invoice downloaded ✓")}catch(e){toast("Couldn’t create the PDF — use Print → Save as PDF instead.")}
 finally{el.classList.remove("pdfmode");btn.disabled=false;btn.textContent=txt}}
async function fillInvoice(no){const box=$("#invBox");if(!box)return;
 const{data:o,error}=await sb.from("orders").select("*").eq("order_no",decodeURIComponent(no||"")).maybeSingle();if(!$("#invBox"))return;
 if(error||!o){box.innerHTML=`<div class="empty"><b>Invoice not found</b><a class="textlink" href="#/account/orders">← My orders</a></div>`;return}
 if(o.status==="cancelled"){box.innerHTML=`<div class="empty"><b>This order was cancelled</b><a class="textlink" href="#/account/orders">← My orders</a></div>`;return}
 const isPaid=["paid","partially_refunded","refunded"].includes(o.payment_status),paidAmt=isPaid?+(o.paid_amount??o.total):0;
 const st=S.settings,c=o.customer||{},logo=($(".brand img")||{}).src||"",sub=o.subtotal!=null?+o.subtotal:+o.total,d=x=>x?fmtDate(x):"—";
 const PAY={unpaid:"Awaiting payment",paid:"Paid",partially_refunded:"Paid · partially refunded",refunded:"Refunded"};
 box.innerHTML=`<div class="invbar noprint"><a class="textlink" href="#/account/orders">← My orders</a><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="invpdf" data-no="${esc(o.order_no)}">⬇ Download PDF</button><button class="btn" data-act="invprint">🖨 Print</button></span></div>
 <article class="invoice"><div class="invh"><div class="invfrom">${logo?`<img src="${esc(logo)}" alt="" width="54" height="54">`:""}<div><b class="invname">${esc(st.name)}</b><p>${esc(st.address||"").replace(/\n/g,"<br>")}${st.email?`<br>${esc(st.email)}`:""}<br>${esc(SITE_URL.replace(/^https?:\/\//,"").replace(/\/$/,""))}</p></div></div>
 <div class="invmeta"><h1>Invoice</h1><table><tr><th>Invoice #</th><td>INV-${esc(o.order_no)}</td></tr><tr><th>Invoice date</th><td>${d(o.created_at)}</td></tr><tr><th>Order #</th><td>${esc(o.order_no)}</td></tr><tr><th>Order date</th><td>${d(o.created_at)}</td></tr><tr><th>Payment</th><td>${PAY[o.payment_status]||"Awaiting payment"}${o.payment_method?" · "+esc(enVal(o.payment_method)):""}</td></tr></table></div></div>
 <section class="invparties"><div><h3>Bill from</h3><p><b>${esc(st.name)}</b><br>${esc(st.address||"").replace(/\n/g,"<br>")}<br>United States${st.email?`<br>${esc(st.email)}`:""}</p></div><div><h3>Bill to</h3><p>${esc(c.name||"")}<br>${esc(c.email||"")}${c.phone?`<br>${esc(c.phone)}`:""}</p></div><div><h3>Ship to</h3><p>${esc(c.name||"")}<br>${esc(c.address||"")}<br>${esc([c.city,[c.state,c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "))}<br>United States</p></div><div><h3>Shipping method</h3><p>${esc(enVal(c.delivery||"Standard shipping"))}</p></div></section>
 <table class="invitems"><thead><tr><th>Item</th><th>SKU</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead><tbody>${(o.items||[]).map(i=>`<tr><td>${esc(i.name)}${i.opt?`<br><small>${esc(optStr(i.opt))}</small>`:""}</td><td>${esc(i.sku||"—")}</td><td class="num">${+i.qty||0}</td><td class="num">${money(i.price)}</td><td class="num">${money((+i.price||0)*(+i.qty||0))}</td></tr>`).join("")}</tbody></table>
 <table class="invtot"><tr><th>Subtotal</th><td>${money(sub)}</td></tr><tr><th>Shipping</th><td>${+o.shipping?money(o.shipping):"Free"}</td></tr><tr><th>Sales tax${+o.tax_rate?` (${esc(c.state||"")} ${+o.tax_rate}%)`:""}</th><td>${money(o.tax||0)}</td></tr><tr class="grand"><th>Total (USD)</th><td>${money(o.total)}</td></tr>
 ${isPaid?`<tr><th>Paid${o.paid_at?" "+d(o.paid_at):""}</th><td>${money(paidAmt)}</td></tr>`:""}${+o.refund_amount?`<tr><th>Refunded${o.refunded_at?" "+d(o.refunded_at):""}</th><td>−${money(o.refund_amount)}</td></tr>`:""}<tr class="${isPaid?"":"due"}"><th>Balance due</th><td>${money(Math.max(0,Math.round(((+o.total)-paidAmt)*100)/100))}</td></tr></table>${isPaid?"":`<p class="invnote">Payment is due upon receipt. We’ll email you a secure payment link — please include the order number ${esc(o.order_no)} with your payment.</p>`}
 <div class="invfoot">Thank you for shopping with ${esc(st.name)}! Returns are accepted within ${shipCfg().days} days of delivery — see ${esc(SITE_URL.replace(/^https?:\/\//,""))}#/returns. Questions? ${esc(st.email||"")}</div></article>`}
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
  r=m.match(/BAD_FIELD:(\w+)/);if(r)return{ok:false,stock:true,msg:`Please check your ${{name:"name",email:"email address",phone:"phone number",address:"street address (house number and street)",city:"city",state:"state",zip:"ZIP code"}[r[1]]||"details"}.`};
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
