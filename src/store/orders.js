/* ===== Orders (storefront): saving a new order, My orders, cancel before shipping, returns, invoice ===== */
async function saveOrderToDb(o){
 if(!sb)return{ok:false};const c=o.c;
 const customer={name:c.name,phone:c.phone,email:c.email||null,delivery:c.delivery,city:c.city,state:c.state||null,zip:c.zip||null,address:c.address||null,payment:c.payment,comment:c.comment||null};
 for(let i=0;i<3;i++){
  const row={order_no:o.no,customer,items:o.lines.map(l=>({id:l.id,name:l.name,sku:l.sku||null,price:l.price,qty:l.qty,...(l.opt?{opt:l.opt}:{})})),total:o.total,currency:"USD",user_id:user?user.id:null};
  const{error}=await sb.from("orders").insert(row);
  if(!error){Trk.purchase(o.no,o.total);return{ok:true}}
  const m=error.message||"";
  if(/duplicate|unique/i.test(m)){o.no=o.no.slice(0,-4)+Math.floor(1000+Math.random()*9000);continue}
  let r=m.match(/OUT_OF_STOCK:(.+):(\d+)/);if(r)return{ok:false,stock:true,msg:+r[2]>0?`Only ${r[2]} left of “${r[1]}”. Please update the quantity in your cart.`:`“${r[1]}” just sold out. Please remove it from your cart.`};
  r=m.match(/BAD_FIELD:(\w+)/);if(r)return{ok:false,stock:true,msg:`Please check your ${{name:"name",email:"email address",phone:"phone number",address:"street address (house number and street)",city:"city",state:"state",zip:"ZIP code"}[r[1]]||"details"}.`};
  r=m.match(/OPTION_REQUIRED:(.+):[^:]+$/);if(r)return{ok:false,stock:true,msg:`The options for “${r[1]}” have changed. Please remove it from your cart and add it again.`};
  r=m.match(/UNAVAILABLE:(.+)/);if(r)return{ok:false,stock:true,msg:`“${r[1]}” is no longer available. Please remove it from your cart.`};
  console.warn("order save failed",m);return{ok:false}}
 return{ok:false}}

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
let MY_ORDERS={},MY_RETURNS={};
/* ===== My orders: list (Amazon-style cards with product photos) and one order's page (#/account/orders/<order no>) =====
   The list shows only a short status; the step tracker, tracking number and all actions are on the order page. */
const oItemImg=i=>{const p=prod(i.id);return p?img0(p):art("basket","#efece4","#e4ddd0")};
const oItemLink=i=>{const p=prod(i.id);return p&&p.active?"#/product/"+encodeURIComponent(p.id):""};
const oUrl=(o,act)=>"#/account/orders/"+encodeURIComponent(o.order_no)+(act?"?act="+act:"");
const RET_SHORT={requested:"Return requested",approved:"Return approved",received:"Return received",refunded:"Refund issued"};
function oStatus(o){
 if(o.status==="cancelled")return{k:"off",pill:"Cancelled",head:"Order cancelled"};
 if(o.status==="returned")return{k:"off",pill:"Returned",head:"Order returned"};
 if(o.status==="completed")return{k:"del",pill:"Delivered",head:o.delivered_at?fmtDate(o.delivered_at):"Delivered",sub:canReturn(o)?"Returns open until "+fmtDate(retWindow(o).until):""};
 if(o.status==="shipped")return{k:"ship",pill:"Shipped",head:o.delivery_eta?"Arriving "+fmtDay(o.delivery_eta):"On its way"};
 if(o.payment_status==="unpaid")return{k:"new",pill:"Awaiting payment",head:"We’ll email you a secure payment link"};
 if(o.status==="confirmed")return{k:"new",pill:"Confirmed",head:o.delivery_eta?"Arriving "+fmtDay(o.delivery_eta):"Preparing to ship"};
 return{k:"new",pill:"Order placed",head:"Preparing your order"}}
function oBar(o,inList){const c=o.customer||{};return `<div class="ocbar"><div><small>Order placed</small>${fmtDate(o.created_at)}</div><div><small>Total</small>${money(o.total)}</div>
 ${c.name?`<div class="ocship"><small>Ship to</small><details class="ocaddr"><summary>${esc(c.name)}</summary><div>${esc(c.name)}<br>${esc(c.address||"")}<br>${esc([c.city,[c.state,c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "))}<br>United States</div></details></div>`:"<div></div>"}
 <div class="ocno"><small>Order # ${esc(o.order_no)}</small>${inList?`<a href="${oUrl(o)}">View order details</a>`:""}${inList&&o.status!=="cancelled"?`<span aria-hidden="true"> · </span><a href="#/account/invoice/${encodeURIComponent(o.order_no)}">Invoice</a>`:""}</div></div>`}
function oCard(o){const r=MY_RETURNS[o.id],st=oStatus(o),items=o.items||[],shown=items.slice(0,3),canRet=canReturn(o)&&(!r||r.status==="rejected");
 const acts=[`<a class="btn primary sm" href="${oUrl(o)}">View order</a>`];
 if(o.status==="completed")acts.push(`<a class="btn sm" href="${oUrl(o,"review")}">Write a review</a>`);
 if(canRet)acts.push(`<a class="btn sm" href="${oUrl(o,"return")}">Return items</a>`);
 else if(canCancel(o))acts.push(`<a class="btn sm" href="${oUrl(o,"cancel")}">Cancel order</a>`);
 if(acts.length<3&&["completed","shipped","cancelled","returned"].includes(o.status))acts.push(`<button class="btn sm" data-act="buyagain" data-id="${o.id}">Buy it again</button>`);
 return `<article class="ocard">${oBar(o,true)}<div class="ocbody"><div class="ocmain">
 <div class="ocstat"><span class="opill o-${st.k}">${st.pill}</span><b>${esc(st.head)}</b>${st.sub&&!(r&&RET_SHORT[r.status])?`<span class="muted small">${esc(st.sub)}</span>`:""}${r&&RET_SHORT[r.status]?`<span class="opill o-ret">${RET_SHORT[r.status]}</span>`:""}</div>
 ${shown.map(i=>{const h=oItemLink(i);return `<div class="ocitem">${h?`<a href="${h}" tabindex="-1">`:"<span>"}<img src="${esc(oItemImg(i))}" alt="" loading="lazy">${h?"</a>":"</span>"}<div>${h?`<a class="ocname" href="${h}">${esc(i.name)}</a>`:`<span class="ocname">${esc(i.name)}</span>`}<span class="muted small">${i.opt?esc(optStr(i.opt,prod(i.id)))+" · ":""}Qty ${+i.qty||1}</span></div></div>`}).join("")}
 ${items.length>shown.length?`<a class="textlink small" href="${oUrl(o)}">+ ${items.length-shown.length} more item${items.length-shown.length===1?"":"s"}</a>`:""}
 </div><div class="ocacts">${acts.join("")}</div></div></article>`}
function oDetail(o){const r=MY_RETURNS[o.id],c=o.customer||{},canRet=canReturn(o)&&(!r||r.status==="rejected"),n=(o.items||[]).reduce((s,i)=>s+(+i.qty||0),0);
 const again=["completed","shipped","cancelled","returned"].includes(o.status);
 return `<div class="crumbs odcrumbs"><a href="#/account">My account</a> › <a href="#/account/orders">My orders</a> › ${esc(o.order_no)}</div>
 <div class="odhead"><div><h2>Order ${esc(o.order_no)}</h2><span class="muted small">Placed ${fmtDate(o.created_at)} · ${n} item${n===1?"":"s"}</span></div>
 <div class="odtop">${o.status!=="cancelled"?`<a class="btn sm" href="#/account/invoice/${encodeURIComponent(o.order_no)}">🧾 Invoice</a>`:""}<a class="btn sm" href="#/contacts">Contact us</a></div></div>
 <article class="ocard">${oBar(o,false)}<div class="odtrack">${orderTracker(o)}${r?retStatus(r):""}</div></article>
 <div class="odgrid"><div class="panel oditems"><h3>Items</h3>${(o.items||[]).map((i,ix)=>{const h=oItemLink(i),p=prod(i.id);return `<div class="oditem">${h?`<a href="${h}" tabindex="-1">`:"<span>"}<img src="${esc(oItemImg(i))}" alt="" loading="lazy">${h?"</a>":"</span>"}
  <div class="odinfo">${h?`<a class="ocname" href="${h}">${esc(i.name)}</a>`:`<span class="ocname">${esc(i.name)}</span>`}<span class="muted small">${i.opt?esc(optStr(i.opt,p))+" · ":""}${i.sku?`Item # ${esc(i.sku)} · `:""}Qty ${+i.qty||1} · ${money(+i.price||0)} each</span>
  <div class="odbtns">${again&&h?`<button class="btn sm" data-act="buyagain" data-id="${o.id}" data-ix="${ix}">Buy it again</button>`:""}${h?`<a class="btn sm" href="${h}">View item</a>`:`<span class="muted small">No longer available</span>`}${o.status==="completed"&&h?`<a class="btn sm" href="${h}?review=1">Write a review</a>`:""}</div></div>
  <b class="odprice">${money((+i.price||0)*(+i.qty||0))}</b></div>`}).join("")}</div>
 <aside class="odside"><div class="panel"><h3>Ship to</h3><p class="small" style="margin:0;line-height:1.6">${esc(c.name||"")}<br>${esc(c.address||"")}<br>${esc([c.city,[c.state,c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "))}<br>United States${c.phone?`<br><span class="muted">${esc(c.phone)}</span>`:""}</p>${c.delivery?`<p class="small muted" style="margin:8px 0 0">${esc(c.delivery)}</p>`:""}</div>
 <div class="panel"><h3>Order summary</h3>${orderTotals(o)}${o.payment_status==="paid"?`<p class="small" style="margin:8px 0 0;color:#2f6b37">✓ Paid</p>`:o.payment_status==="unpaid"&&o.status!=="cancelled"?`<p class="small" style="margin:8px 0 0;color:#8a5a0b">Awaiting payment</p>`:""}</div>
 ${canRet||canCancel(o)||again?`<div class="panel odacts">${canRet?`<button class="btn block" data-act="retopen" data-id="${o.id}">↩ Return items</button>`:""}${canCancel(o)?`<button class="btn block" data-act="cancelopen" data-no="${esc(o.order_no)}">✕ Cancel order</button>`:""}${again?`<button class="btn block" data-act="buyagain" data-id="${o.id}">🔁 Buy whole order again</button>`:""}
 ${o.status==="shipped"?`<p class="small muted" style="margin:0">Returns can be requested after delivery, within ${shipCfg().days} days.</p>`:""}</div>`:""}</aside></div>
 ${canRet?retForm(o):""}${canCancel(o)?cancelForm(o):""}`}
async function fillOrders(){const box=$("#acMain");if(!box)return;
 const h=location.hash.slice(1).split("?"),no=decodeURIComponent((h[0].split("/")[3])||""),act=new URLSearchParams(h[1]||"").get("act");
 const[{data,error},rr]=await Promise.all([sb.from("orders").select("id,order_no,status,items,total,subtotal,shipping,tax,tax_rate,created_at,carrier,tracking_number,shipped_at,customer,delivery_eta,delivered_at,payment_status").order("created_at",{ascending:false}).limit(50),
  sb.from("return_requests").select("id,order_id,status,reason,free_return,created_at,seller_note").order("created_at",{ascending:false})]);
 if(!$("#acMain"))return;
 if(error){box.innerHTML=`<div class="note">${esc(authErr(error))}</div>`;return}
 MY_ORDERS={};MY_RETURNS={};(data||[]).forEach(o=>MY_ORDERS[o.id]=o);
 (rr.data||[]).forEach(r=>{if(!MY_RETURNS[r.order_id]||MY_RETURNS[r.order_id].status==="rejected")MY_RETURNS[r.order_id]=r});
 if(no){const o=(data||[]).find(x=>x.order_no===no);
  if(!o){box.innerHTML=`<div class="panel"><div class="empty" style="border:0;padding:30px 0"><b>Order not found</b>We couldn’t find order ${esc(no)} in your account.<br><br><a class="btn" href="#/account/orders">← My orders</a></div></div>`;return}
  box.innerHTML=oDetail(o);
  if(act==="return"||act==="cancel"){const f=act==="return"?$(`[data-form="retreq"][data-id="${o.id}"]`):$(`[data-form="cancelord"][data-no="${o.order_no}"]`);if(f){f.hidden=false;setTimeout(()=>{f.scrollIntoView({block:"center"});const x=f.querySelector("input,select");x&&x.focus({preventScroll:true})},60)}}
  else if(act==="review"){const it=$(".oditems");it&&setTimeout(()=>it.scrollIntoView({block:"start"}),60)}
  return}
 box.innerHTML=`<div class="odhead" style="margin-bottom:14px"><h2 style="margin:0">My orders</h2>${data.length?`<span class="muted small">${data.length} order${data.length===1?"":"s"}</span>`:""}</div>
 ${data.length?data.map(oCard).join(""):`<div class="panel"><div class="empty" style="border:0;padding:30px 0"><b>No orders yet</b>Your orders will show up here.<br><br><a class="btn primary" href="#/shop">${t("shopNow")} →</a></div></div>`}`}
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
/* ===== Buy again: adds the order's items that are still available and in stock ===== */
function buyAgain(id,ix){const o=MY_ORDERS[id];if(!o)return;let added=0;const miss=[];
 (o.items||[]).filter((_,k)=>ix==null||k===ix).forEach(i=>{const p=prod(i.id),nm=i.name||"An item";
  if(!p||!p.active)return miss.push(nm+" (no longer available)");
  if(p.stock<=0)return miss.push(nm+" (out of stock)");
  let opt=null;if(optList(p).length){opt=i.opt&&typeof i.opt==="object"?i.opt:null;if(!opt||!optOk({opt},p))return miss.push(nm+" (options changed — please choose again)")}
  const line={id:p.id,qty:0,...(opt?{opt}:{})},k=lkey(line);let l=lineByKey(k);if(!l){l=line;cart.push(l)}
  const can=Math.min(+i.qty||1,lineMax(l));if(can<=0){if(!l.qty)cart=cart.filter(x=>x!==l);return miss.push(nm+" (no more in stock)")}
  l.qty+=can;added+=can;if(can<(+i.qty||1))miss.push(`${nm} (only ${can} added)`)});
 setCart(cart);
 if(!added){toast(miss.length?"These items aren’t available right now":"Nothing to add");return}
 openCart();const d=$("#cartDrawer .dbody");if(d&&miss.length)d.insertAdjacentHTML("afterbegin",`<div class="note small" style="margin-bottom:10px">Added ${added} item${added===1?"":"s"} from order ${esc(o.order_no)}. Not added: ${miss.map(esc).join("; ")}.</div>`);
 toast(`Added ${added} item${added===1?"":"s"} to your cart`)}
