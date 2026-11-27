/* ===== Seller Central · Замовлення: список, сторінка замовлення, оплата, доставка, повернення ===== */
Object.assign(Admin,{
/* ---- single order page ---- */
PAY:{unpaid:"Не оплачено",paid:"Оплачено",partially_refunded:"Частково повернено",refunded:"Кошти повернено"},
PMETHODS:["Payoneer (payment link)","Western Bid","PayPal","Bank transfer","Cash","Other"],/* saved in English — the customer sees it on the invoice */
PMLABEL:{"Payoneer (payment link)":"Payoneer (посилання на оплату)","Bank transfer":"Банківський переказ","Cash":"Готівка","Other":"Інше"},
payPill(o){const k=o.payment_status||"unpaid";return `<span class="paypill p-${k}">${k==="paid"?"💳 ":""}${this.PAY[k]}</span>`},
afterOrderChange(id){if($("#ordPage"))this.fillOrder(id);else this.fillOrders()},
orderPage(id){setTimeout(()=>this.fillOrder(id),0);return `<div class="crumbs" style="margin-bottom:8px"><a href="#/admin/orders">← Замовлення</a></div><div id="ordPage"><p class="muted">Завантаження…</p></div>`},
addrText(c){return [c.name,c.address,[c.city,[c.state,c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),"United States"].filter(Boolean).join("\n")},
async fillOrder(id){
 const{data:o,error}=await sb.from("orders").select("*").eq("id",+id).maybeSingle();const box=$("#ordPage");if(!box)return;
 if(error||!o){box.innerHTML=`<div class="empty"><b>Замовлення не знайдено</b>${error?esc(error.message):""}</div>`;return}
 const i=this.ordersData.findIndex(x=>x.id===o.id);if(i>=0)this.ordersData[i]=o;else this.ordersData.push(o);
 const{data:hist}=await sb.from("audit_log").select("at,actor_email,details").eq("table_name","orders").eq("row_id",String(o.id)).order("at",{ascending:true}).limit(200);
 const c=o.customer||{},items=o.items||[],sub=items.reduce((s,x)=>s+(+x.price||0)*(+x.qty||0),0),addr=this.addrText(c),tu=trackUrl(o.carrier,o.tracking_number);
 const dt=d=>new Date(d).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
 const today=new Date().toISOString().slice(0,10),ps=o.payment_status||"unpaid",canShip=o.status==="confirmed",canRet=o.status==="shipped"||o.status==="completed";
 const ev=[{at:o.created_at,t:"🛒 Замовлення оформлено на сайті"+(o.user_id?" (покупець з акаунтом)":" (гість)")}];
 (hist||[]).forEach(h=>{const d=h.details||{},who=h.actor_email?` · ${esc(h.actor_email)}`:"";
  if(d.old_status&&d.status!==d.old_status)ev.push({at:h.at,t:`🔄 Статус: ${this.ST[d.old_status]||d.old_status} → <b>${this.ST[d.status]||d.status}</b>${d.tracking?` · трек ${esc(d.tracking)}`:""}${who}`});
  else if(d.tracking&&!d.payment&&!d.customer_changed)ev.push({at:h.at,t:`📦 Трек-номер: ${esc(d.tracking)}${who}`});
  if(d.payment)ev.push({at:h.at,t:`💳 Оплата: ${this.PAY[d.old_payment]||d.old_payment||"—"} → <b>${this.PAY[d.payment]||d.payment}</b>${d.paid_amount!=null&&d.payment==="paid"?` · ${money(d.paid_amount)}`:""}${d.refund_amount?` · повернено ${money(d.refund_amount)}`:""}${d.method?` · ${esc(d.method)}`:""}${who}`});
  if(d.customer_changed)ev.push({at:h.at,t:`✏️ Змінено контакти / адресу${who}`})});
 if(o.shipped_at&&!ev.some(e=>/Відправлене/.test(e.t)))ev.push({at:o.shipped_at,t:"📦 Відправлено"});
 ev.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 box.innerHTML=`<div class="ahead" style="align-items:flex-start"><div><h1 style="margin:0">${esc(o.order_no)}</h1><div class="muted small" style="margin-top:4px">${dt(o.created_at)} · ${items.reduce((s,x)=>s+(+x.qty||0),0)} шт. · <b>${money(o.total)}</b></div><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><span class="ostat s-${esc(o.status)}">${this.ST[o.status]||o.status}</span>${this.payPill(o)}</div></div>
 <div class="acts"><button class="btn sm primary" data-act="a:ocontact" data-id="${o.id}" aria-expanded="false" aria-controls="ocontact">💬 Зв’язатися з покупцем</button></div></div>
 ${this.contactPanel(o)}
 <div class="ordgrid"><div class="stack">
 <div class="panel"><h2>Товари</h2>${items.map(x=>{const p=prod(x.id);return `<div class="oline"><img src="${esc(p?img0(p):"")}" alt=""><div><b>${p?`<a class="textlink" href="#/admin/product/${p.id}">${esc(x.name)}</a>`:esc(x.name)}</b>${x.opt?`<div class="small">${esc(optStr(x.opt,p))}</div>`:""}<div class="small muted">${x.sku?"SKU "+esc(x.sku):""}</div></div><div class="small">${+x.qty||0} × ${money(x.price)}</div><b>${money((+x.price||0)*(+x.qty||0))}</b></div>`}).join("")}
  <div class="row" style="margin-top:10px"><span>Разом за товари</span><b>${money(sub)}</b></div><div class="row"><span>Доставка <span class="muted small">· ${esc(c.delivery||"")}</span></span><span>${+o.shipping?money(o.shipping):"безкоштовно"}</span></div><div class="row"><span>Податок з продажів${+o.tax_rate?` <span class="muted small">(${esc(c.state||"")} ${+o.tax_rate}%)</span>`:""}</span><span>${money(o.tax||0)}</span></div><div class="row total"><span>До оплати</span><span>${money(o.total)}</span></div></div>
 <div class="panel"><h2>💳 Оплата</h2>
  ${ps==="unpaid"?`<div class="note" style="margin-bottom:12px">Оплату ще не отримано. Надішліть покупцю посилання на оплату й позначте замовлення оплаченим, коли гроші надійдуть.</div><div class="acts" style="margin-bottom:12px"><button class="btn primary sm" data-act="a:opaid" data-id="${o.id}">✓ Оплачено ${money(o.total)}</button><button class="btn sm" data-act="a:omail" data-t="pay" data-id="${o.id}">✉️ Лист із посиланням на оплату</button></div>`
  :`<div class="okbox" style="margin-bottom:12px">${this.PAY[ps]}${o.paid_amount!=null?`: ${money(o.paid_amount)}`:""}${o.payment_method?` · ${esc(o.payment_method)}`:""}${o.paid_at?` · ${dt(o.paid_at)}`:""}${o.payment_ref?`<br><span class="small">ID платежу: ${esc(o.payment_ref)}</span>`:""}${o.refund_amount?`<br><span class="small">Повернено: ${money(o.refund_amount)}${o.refunded_at?" · "+dt(o.refunded_at):""}</span>`:""}</div>`}
  <form class="form" data-form="opay" data-id="${o.id}"><div><label>Статус оплати</label><select class="field" name="status">${Object.entries(this.PAY).map(([k,v])=>`<option value="${k}" ${ps===k?"selected":""}>${v}</option>`).join("")}</select></div>
  <div><label>Спосіб</label><select class="field" name="method"><option value="">—</option>${this.PMETHODS.map(m=>`<option value="${m}" ${o.payment_method===m||o.payment_method===this.PMLABEL[m]?"selected":""}>${this.PMLABEL[m]||m}</option>`).join("")}</select></div>
  <div><label>Отримано, $</label><input class="field" name="amount" type="number" min="0" step="0.01" value="${o.paid_amount??o.total}"></div><div><label>Дата оплати</label><input class="field" name="date" type="date" value="${(o.paid_at||"").slice(0,10)||today}" max="${today}"></div>
  <div class="full"><label>ID платежу / примітка</label><input class="field" name="ref" maxlength="120" value="${esc(o.payment_ref||"")}" placeholder="Напр. номер транзакції Payoneer"></div>
  <div class="full acts"><button class="btn sm primary">Зберегти оплату</button>${ps==="paid"||ps==="partially_refunded"?`<button type="button" class="btn sm" data-act="a:orefundOpen">↩ Повернути кошти</button>`:""}</div></form>
  <form class="form refundform" data-form="orefund" data-id="${o.id}" hidden><div><label>Сума повернення, $</label><input class="field" name="amount" type="number" min="0.01" step="0.01" max="${o.paid_amount??o.total}" value="${o.paid_amount??o.total}"></div><div><label>Причина / примітка</label><input class="field" name="note" maxlength="120" placeholder="Напр. пошкоджено при доставці"></div><div class="full acts"><button class="btn sm danger">Оформити повернення коштів</button><span class="help">Самі гроші повертаєте в платіжній системі — тут лише позначка.</span></div></form></div>
 <div class="panel"><h2>Історія</h2><ol class="ohist">${ev.map(e=>`<li><span class="muted small">${dt(e.at)}</span><div>${e.t}</div></li>`).join("")}</ol></div></div>
 <div class="stack">
 <div class="panel"><h2>Покупець</h2><b>${esc(c.name||"—")}</b> <span class="muted small">${o.user_id?"· з акаунтом":"· гість"}</span>
  <div class="small" style="line-height:1.9;margin-top:6px">${c.email?`✉️ <a class="textlink" href="mailto:${esc(c.email)}">${esc(c.email)}</a> <button class="linkbtn" data-act="a:ocopy" data-text="${esc(c.email)}">копіювати</button><br>`:""}${c.phone?`📞 <a class="textlink" href="tel:${esc(String(c.phone).replace(/[^+\d]/g,""))}">${esc(c.phone)}</a> <button class="linkbtn" data-act="a:ocopy" data-text="${esc(c.phone)}">копіювати</button>`:""}</div>
  <h3 class="ordh3">Адреса доставки</h3><pre class="addrbox">${esc(addr)}</pre><div class="acts"><button class="btn sm" data-act="a:ocopy" data-text="${esc(addr)}">📋 Скопіювати адресу</button><button class="btn sm" data-act="a:oaddrEdit">✏️ Виправити</button></div>
  <form class="form" data-form="oaddr" data-id="${o.id}" hidden style="margin-top:12px"><div class="full"><label>Ім'я</label><input class="field" name="name" value="${esc(c.name||"")}" maxlength="120"></div><div><label>Email</label><input class="field" name="email" type="email" value="${esc(c.email||"")}" maxlength="200"></div><div><label>Телефон</label><input class="field" name="phone" value="${esc(c.phone||"")}" maxlength="40"></div><div class="full"><label>Адреса</label><input class="field" name="address" value="${esc(c.address||"")}" maxlength="200"></div><div><label>Місто</label><input class="field" name="city" value="${esc(c.city||"")}" maxlength="100"></div><div><label>Штат</label><input class="field" name="state" value="${esc(c.state||"")}" maxlength="2" placeholder="TX"></div><div><label>ZIP</label><input class="field" name="zip" value="${esc(c.zip||"")}" maxlength="10"></div><div class="full"><button class="btn sm primary">Зберегти адресу</button></div></form>
  ${c.comment?`<h3 class="ordh3">Коментар покупця</h3><div class="small">${esc(c.comment)}</div>`:""}</div>
 <div class="panel"><h2>Доставка</h2><div class="small" style="line-height:1.8">🚚 ${esc(c.delivery||"—")}<br>Статус: ${this.statusBadge(o)}
  ${o.carrier||o.tracking_number?`<br>${esc(o.carrier||"")}${o.tracking_number?` · ${tu?`<a class="textlink" href="${esc(tu)}" target="_blank" rel="noopener">${esc(o.tracking_number)} ↗</a>`:esc(o.tracking_number)+' <span class="muted">(не відстежується)</span>'}`:""}`:""}
  ${o.delivered_at?`<br>✓ Доставлено ${this.day(o.delivered_at)}`:o.delivery_eta?`<br>📅 Очікувана доставка: <b>${this.day(o.delivery_eta)}</b>`:""}</div>
  ${this.delivNote(o)}
  ${["confirmed","shipped"].includes(o.status)?`<label class="small etarow" style="margin-top:8px">📅 Очікувана доставка<input type="date" class="field" value="${esc(o.delivery_eta||"")}" min="${today}" data-ach="oeta" data-id="${o.id}"></label>`:""}
  <p class="small" style="margin:10px 0 0"><button type="button" class="linkbtn textlink" data-act="a:slip" data-id="${o.id}">🖨 Пакувальний лист</button> <span class="muted">— якщо постачальнику потрібен аркуш у посилку</span></p>
  <div class="acts" style="margin-top:12px">${o.status==="new"?this.flowBtns(o).split("</button>")[0]+"</button>":""}${canShip?`<button class="btn sm primary" data-act="a:shipForm" data-id="${o.id}">📦 Відправити</button>`:""}${this.delivBtns(o)}${(o.status==="new"||o.status==="confirmed")?`<button class="btn sm" data-act="a:ocancel" data-id="${o.id}">✕ Скасувати</button>`:""}${canRet?`<button class="btn sm" data-act="a:retForm" data-id="${o.id}">↩ Повернення товару</button>`:""}</div>
  <div id="ship-${o.id}" hidden><form class="shipform stack" data-form="ship" data-id="${o.id}" style="margin-top:12px"><select class="field" name="carrier" data-ach="carrierpick">${this.CARRIERS.map(x=>`<option value="${x}" ${o.carrier===x||(x==="Other"&&o.carrier&&!this.CARRIERS.includes(o.carrier))?"selected":""}>${x==="Other"?"Інший":x}</option>`).join("")}</select><input class="field" name="carrier_other" placeholder="Назва служби англійською (її бачить покупець)" value="${esc(o.carrier&&!this.CARRIERS.includes(o.carrier)?o.carrier:"")}" maxlength="40" ${o.carrier&&!this.CARRIERS.includes(o.carrier)?"":"hidden"}><input class="field" name="tracking" placeholder="${o.carrier&&!this.CARRIERS.includes(o.carrier)?"Номер відправлення (необов’язково)":"Трек-номер "+(o.carrier&&this.CARRIERS.includes(o.carrier)&&o.carrier!=="Other"?o.carrier:"USPS")+" (обов’язково)"}" value="${esc(o.tracking_number||"")}" maxlength="80" autocomplete="off" oninput="this.classList.remove('invalid')"><label class="small etarow">📅 Очікувана дата доставки<input class="field" type="date" name="eta" value="${esc(o.delivery_eta||this.etaDefault(o))}" min="${today}"></label><button class="btn primary sm">Позначити відправленим</button></form></div>
  ${o.status==="shipped"?`<div id="delay-${o.id}" hidden style="margin-top:12px">${this.delayForm(o)}</div>`:""}
  <div id="ret-${o.id}" hidden><form class="shipform stack" data-form="ret" data-id="${o.id}" style="margin-top:12px"><select class="field" name="reason">${this.RREASONS.map(x=>`<option>${x}</option>`).join("")}</select><input class="field" name="note" placeholder="Коментар (необов’язково)" maxlength="200"><button class="btn primary sm">Оформити повернення</button><span class="help">Товари повернуться на склад. Гроші — окремо, у блоці «Оплата».</span></form></div></div>

 <div class="panel"><h2>✉️ Лист покупцю</h2><p class="help" style="margin-top:-6px">Відкриває вашу пошту з готовим текстом англійською — перевірте й надішліть.</p><div class="stack" style="gap:6px">${[["pay","Посилання на оплату"],["confirm","Оплату отримано, готуємо"],["ship","Замовлення відправлено"],...(o.delayed_at&&o.status==="shipped"?[["delay","Затримка доставки"]]:[]),["review","Попросити відгук"]].map(([k,l])=>`<button class="btn sm block" data-act="a:omail" data-t="${k}" data-id="${o.id}" ${!c.email?"disabled":""}>${l}</button>`).join("")}${!c.email?`<span class="help">У замовленні немає email.</span>`:""}</div></div>
 </div></div>`},
mailFor(o,t){const[sj,b]=this.mailText(o,t),c=o.customer||{};return `mailto:${encodeURIComponent(c.email||"")}?subject=${encodeURIComponent(sj)}&body=${encodeURIComponent(b)}`},
mailText(o,t){const c=o.customer||{},st=S.settings,first=String(c.name||"").split(" ")[0]||"there",items=(o.items||[]).map(x=>`- ${x.name}${x.opt?" ("+optStr(x.opt,prod(x.id))+")":""} x ${x.qty}`).join("\n"),track=SITE_URL+"#/track?no="+encodeURIComponent(o.order_no),tu=trackUrl(o.carrier,o.tracking_number),sig=`\n\nWarm regards,\n${st.name}\n${SITE_URL}`;
 const fmtEta=s=>{if(!s)return"";const[y,m,d]=String(s).split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})};
 const T={pay:[`Your ${st.name} order ${o.order_no} — payment link`,`Hi ${first},\n\nThank you for your order ${o.order_no}!\n\n${items}\n\nTotal: ${money(o.total)}\n\nYou can pay securely here:\n[PASTE PAYMENT LINK]\n\nAs soon as the payment goes through, we'll pack your order — it ships within 1–2 business days.${sig}`],
  confirm:[`We received your payment — order ${o.order_no}`,`Hi ${first},\n\nWe've received your payment for order ${o.order_no} — thank you!\n\nWe're preparing your items now. Your order ships within 1–2 business days, and we'll email you the tracking number.\n\nYou can check your order status anytime: ${track}${sig}`],
  ship:[`Your order ${o.order_no} has shipped`,`Hi ${first},\n\nGood news — your order ${o.order_no} is on its way!\n\n${o.carrier?"Carrier: "+o.carrier+"\n":""}${o.tracking_number?"Tracking number: "+o.tracking_number+"\n":""}${tu?"Track your package: "+tu+"\n":""}${o.delivery_eta?"Estimated delivery: "+fmtEta(o.delivery_eta)+"\n":""}\nOrder status: ${track}${sig}`],
  delay:[`Update on your order ${o.order_no} — new delivery date`,`Hi ${first},\n\nWe're sorry — your order ${o.order_no} is running a little late${o.delay_reason?" ("+o.delay_reason.toLowerCase()+")":""}.\n\n${o.delivery_eta?"New estimated delivery: "+fmtEta(o.delivery_eta)+"\n":""}${o.carrier?"Carrier: "+o.carrier+"\n":""}${tu?"Track your package: "+tu+"\n":""}\nOrder status: ${track}\n\nThank you for your patience — if you have any questions, just reply to this email.${sig}`],
  review:[`How do you like your order from ${st.name}?`,`Hi ${first},\n\nWe hope you're enjoying your new things from ${st.name}!\n\nIf you have a minute, we'd be grateful for a short review — it really helps a small shop like ours:\n${(o.items||[]).map(x=>"- "+x.name+": "+SITE_URL+"#/product/"+x.id).join("\n")}\n\n(Sign in with the email you used for your order to leave a review.)${sig}`]};
 T.blank=[`About your order ${o.order_no}`,`Hi ${first},\n\n\n\nOrder: ${o.order_no}\nOrder status: ${track}${sig}`];
 return T[t]||T.pay},
async orderUpdate(id,patch,msg){const{error}=await sb.from("orders").update(patch).eq("id",id);if(error){toast("⚠️ "+error.message);return false}toast(msg||"Збережено ✓");this.afterOrderChange(id);return true},
orderSubmit(k,f){const id=+f.dataset.id,o=this.ordersData.find(x=>x.id===id);if(!o)return;
 if(k==="odelay"){const eta=f.eta.value,other=f.reason.value==="__other",reason=(other?f.reason_other.value.trim():f.reason.value).slice(0,200);
  if(!eta)return toast("Вкажіть нову дату доставки");if(eta<=this.nyToday())return toast("Нова дата має бути пізніше сьогоднішньої");if(!reason){f.reason_other.focus();return toast("Вкажіть причину затримки")}
  const mail=f.mail&&f.mail.checked;return this.orderUpdate(id,{delivery_eta:eta,delay_reason:reason,delayed_at:new Date().toISOString()},"Затримку збережено ✓").then(ok=>{if(ok&&mail){const o2={...o,delivery_eta:eta,delay_reason:reason,delayed_at:1};location.href=this.mailFor(o2,"delay")}})}
 if(k==="opay"){const st=f.status.value,amt=f.amount.value===""?null:Math.round(+f.amount.value*100)/100;const patch={payment_status:st,payment_method:f.method.value||null,payment_ref:f.ref.value.trim()||null};
  if(st==="unpaid"){patch.paid_amount=null;patch.paid_at=null;patch.refund_amount=null;patch.refunded_at=null}else{patch.paid_amount=amt??+o.total;patch.paid_at=f.date.value?new Date(f.date.value+"T12:00:00").toISOString():new Date().toISOString()}
  if(st==="paid"&&o.status==="new")patch.status="confirmed";
  if(st==="paid"&&amt!=null&&amt<+o.total&&!confirm(`Отримано ${money(amt)} — менше за суму замовлення ${money(o.total)}. Все одно позначити оплаченим?`))return;
  return this.orderUpdate(id,patch,"Оплату збережено ✓")}
 if(k==="orefund"){const amt=Math.round(+f.amount.value*100)/100,paid=+(o.paid_amount??o.total);if(!(amt>0))return toast("Вкажіть суму повернення");if(amt>paid)return toast("Сума більша за оплачену ("+money(paid)+")");
  if(String(o.payment_ref||"").startsWith("pi_")){if(!confirm(`Повернути ${money(amt)} покупцю на картку через Stripe?`))return;return this.stripeRefund(id,amt,f)}
  const total=Math.round(((+o.refund_amount||0)+amt)*100)/100;if(total>paid)return toast("Разом повернень більше, ніж оплачено");
  if(!confirm(`Позначити повернення ${money(amt)} покупцю?`))return;
  const note=f.note.value.trim();return this.orderUpdate(id,{payment_status:total>=paid?"refunded":"partially_refunded",refund_amount:total,refunded_at:new Date().toISOString(),payment_ref:note?((o.payment_ref?o.payment_ref+" · ":"")+"Refund: "+note).slice(0,120):o.payment_ref},"Повернення коштів позначено")}
 if(k==="oaddr"){const fd=Object.fromEntries(new FormData(f));const st=String(fd.state||"").trim().toUpperCase(),zip=String(fd.zip||"").trim();
  if(st&&!/^[A-Z]{2}$/.test(st))return toast("Штат — 2 літери, напр. TX");if(zip&&!/^\d{5}(-\d{4})?$/.test(zip))return toast("ZIP — 5 цифр");
  const c={...(o.customer||{}),name:String(fd.name).trim(),email:String(fd.email).trim().toLowerCase(),phone:String(fd.phone).trim(),address:String(fd.address).trim(),city:String(fd.city).trim(),state:st,zip};
  return this.orderUpdate(id,{customer:c},"Адресу оновлено ✓")}},
/* ---- orders list: server pages of 20, period, status filter with counts, sort, search; rows coloured by status ---- */
ORD_PER:20,
ordQ(){return new URLSearchParams((location.hash.split("?")[1])||"")},
ordHref(o){const q=this.ordQ();Object.entries(o).forEach(([k,v])=>v===""||v==null?q.delete(k):q.set(k,v));const s=q.toString();return "#/admin/orders"+(s?"?"+s:"")},
ordRange(q){const per=q.get("period")||"all",now=new Date(),ago=d=>new Date(now.getTime()-d*864e5).toISOString();
 if(per==="today"){const d=new Date();d.setHours(0,0,0,0);return[d.toISOString(),null]}
 if(per==="7d")return[ago(7),null];if(per==="30d")return[ago(30),null];if(per==="3m")return[ago(91),null];if(per==="6m")return[ago(182),null];
 if(/^\d{4}$/.test(per))return[new Date(+per,0,1).toISOString(),new Date(+per+1,0,1).toISOString()];
 if(per==="custom"){const ok=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||""),f=q.get("from"),t=q.get("to");return[ok(f)?new Date(f+"T00:00:00").toISOString():null,ok(t)?new Date(new Date(t+"T00:00:00").getTime()+864e5).toISOString():null]}
 return[null,null]},
/* applies period + search (+ optional status filter) to a query */
ordFilter(qq,q,st){const[from,to]=this.ordRange(q);if(from)qq=qq.gte("created_at",from);if(to)qq=qq.lt("created_at",to);
 const term=String(this.ordTerm||"").trim().replace(/[%,()*"]/g," ").trim();
 if(term){const t=`*${term}*`,dig=term.replace(/\D/g,"");qq=qq.or([`order_no.ilike.${t}`,`customer->>name.ilike.${t}`,`customer->>email.ilike.${t}`,`customer->>phone.ilike.${t}`,...(dig.length>=4?[`customer->>phone.ilike.*${dig.split("").join("*")}*`]:[])].join(","))}
 if(st==="unpaid")qq=qq.eq("payment_status","unpaid").not("status","in","(cancelled,returned)");else if(st==="ship")qq=qq.in("status",["new","confirmed"]);else if(st&&st!=="all")qq=qq.eq("status",st);
 return qq},
OSTAT:[["all","Усі",""],["new","Нові / не підтверджені","s-new"],["confirmed","Підтверджені","s-confirmed"],["shipped","Відправлені","s-shipped"],["completed","Доставлені","s-completed"],["returned","Повернення","s-returned"],["cancelled","Скасовані","s-cancelled"]],
orders(q){const st=q.get("status")||"all",per=q.get("period")||"all",so=q.get("sort")||"new";
 if(this.ordTerm==null)this.ordTerm="";const pq=sessionStorage.getItem("ordQ");if(pq){sessionStorage.removeItem("ordQ");this.ordTerm=pq}
 setTimeout(()=>this.fillOrders(),0);
 const y0=new Date().getFullYear(),years=[y0,y0-1,y0-2].map(String);
 const pers=[["all","Увесь час"],["today","Сьогодні"],["7d","Останні 7 днів"],["30d","Останні 30 днів"],["3m","Останні 3 місяці"],["6m","Останні 6 місяців"],...years.map(y=>[y,y+" рік"]),["custom","Свої дати…"]];
 return `<div class="ahead"><h1>Замовлення</h1><button class="btn sm" data-act="a:reloadOrders">↻ Оновити</button></div>
 <div class="ostchips" id="ostChips">${this.OSTAT.map(([k,l,c])=>`<a class="ostchip ${c} ${st===k?"on":""}" href="${this.ordHref({status:k==="all"?"":k,page:""})}">${l} <b data-cnt="${k}">·</b></a>`).join("")}
  <span class="ostsep"></span><a class="ostchip ${st==="ship"?"on":""}" href="${this.ordHref({status:"ship",page:""})}">📦 Потребують відправлення <b data-cnt="ship">·</b></a><a class="ostchip ${st==="unpaid"?"on":""}" href="${this.ordHref({status:"unpaid",page:""})}">💳 Не оплачені <b data-cnt="unpaid">·</b></a></div>
 <form class="shopbar ordbar" data-form="ordbar"><label class="search">${ICON.search}<input id="ordSearch" value="${esc(this.ordTerm)}" placeholder="Пошук: номер, ім’я, телефон або email" autocomplete="off"></label>
  <label class="ordsel"><span>Період</span><select class="field" name="period" data-ach="ordper">${pers.map(([v,l])=>`<option value="${v}" ${per===v?"selected":""}>${l}</option>`).join("")}</select></label>
  <span class="ordcustom" ${per==="custom"?"":"hidden"}><input class="field" type="date" name="from" value="${esc(q.get("from")||"")}" aria-label="Від"><span>–</span><input class="field" type="date" name="to" value="${esc(q.get("to")||"")}" aria-label="До"><button class="btn sm primary">Показати</button></span>
  <label class="ordsel"><span>Сортування</span><select class="field" name="sort" data-ach="ordsort">${[["new","Спочатку нові"],["old","Спочатку старі"],["sumdesc","Сума: більша → менша"],["sum","Сума: менша → більша"]].map(([v,l])=>`<option value="${v}" ${so===v?"selected":""}>${l}</option>`).join("")}</select></label></form>
 <div class="ostlegend">${this.OSTAT.slice(1).map(([k,l,c])=>`<span class="${c}"><i></i>${l}</span>`).join("")}</div>
 <div id="ordList"><p class="muted">Завантаження…</p></div><div id="ordPager"></div>`},
ST:{new:"Нове",confirmed:"Підтверджене",shipped:"Відправлене",completed:"Доставлене",cancelled:"Скасоване",returned:"Повернення"},
/* status list for the select: «Доставлене» is not picked by hand (button «✓ Доставлено» or automatically the morning after the delivery date) */
statusOpts(o){return Object.entries(this.ST).filter(([k])=>!["returned","completed"].includes(k)||o.status===k).map(([k,v])=>`<option value="${k}" ${o.status===k?"selected":""}>${v}</option>`).join("")},
DREASONS:["Carrier delay","Weather conditions","High holiday volume","Address issue","Item restocking"],
nyToday(){return new Date().toLocaleDateString("en-CA",{timeZone:"America/New_York"})},
addDays(s,n){const[y,m,d]=String(s).slice(0,10).split("-").map(Number),x=new Date(Date.UTC(y,m-1,d+n));return x.toISOString().slice(0,10)},
/* delay info + warnings for orders on the way */
delivNote(o,ic){if(o.status!=="shipped")return"";const t=this.nyToday();let h="";
 if(o.delayed_at)h+=ic?`<span class="oicon odelay" title="Затримка${o.delivery_eta?" → "+this.day(o.delivery_eta):""}${o.delay_reason?" · "+esc(o.delay_reason):""}">⏰</span>`:`<div class="small odelay" title="${esc(o.delay_reason||"")}">⏰ Затримка${o.delivery_eta?` → <b>${this.day(o.delivery_eta)}</b>`:""}</div>`;
 if(!o.delivery_eta)h+=`<div class="small owarn" title="Без дати замовлення не стане «Доставлене» автоматично. Вкажіть очікувану дату доставки.">⚠ Немає дати доставки</div>`;
 else if(o.delivery_eta<t)h+=`<div class="small owarn" title="Найближчого ранку замовлення стане «Доставлене». Якщо посилка запізнюється — натисніть «⏰ Затримка».">⚠ Дата доставки минула</div>`;
 else if(o.delivery_eta===t)h+=`<div class="small owarn" title="Перевірте трекінг. Якщо посилка запізнюється — натисніть «⏰ Затримка».">📦 Доставка сьогодні</div>`;
 return ic?h.replace(/<div class="small (owarn)" title="([^"]*)">(\S+)[^<]*<\/div>/g,'<span class="oicon $1" title="$3 $2">$3</span>'):h},
/* order page: «Зв’язатися з покупцем» — email with a ready template, call / SMS, site chat and earlier messages */
contactPanel(o){const c=o.customer||{},ph=String(c.phone||"").replace(/[^+\d]/g,""),tpl=[["blank","Свій текст"],["confirm","Оплату отримано"],["ship","Відправлено"],...(o.delayed_at?[["delay","Затримка доставки"]]:[]),["pay","Посилання на оплату"],["review","Попросити відгук"]];
 return `<div class="panel ocontact" id="ocontact" hidden><div class="occh">
  ${c.email?`<a class="btn sm" href="mailto:${esc(c.email)}">✉️ ${esc(c.email)}</a>`:`<span class="muted small">Email не вказано</span>`}
  <span id="ocChat" class="muted small">Чат на сайті: перевіряю…</span><span id="ocMsgs"></span></div>
  <form class="ocform" data-form="ocmail" data-id="${o.id}">
  <div class="ocvia" role="radiogroup" aria-label="Як написати"><label class="chip2 ocv-chat" title="Перевіряю, чи є чат…"><input type="radio" name="via" value="chat" disabled> 💬 Чат на сайті</label><label class="chip2 ${c.email?"on":""}"><input type="radio" name="via" value="email" ${c.email?"checked":"disabled"}> ✉️ Email</label><span class="muted small ocvianote"></span></div>
  <div class="octpl"><span class="muted small">Шаблон:</span>${tpl.map(([k,l],i)=>`<button type="button" class="chip2 ${i?"":"on"}" data-act="a:octpl" data-t="${k}" data-id="${o.id}">${l}</button>`).join("")}</div>
  <input class="field" name="subject" maxlength="200" value="${esc(this.mailText(o,"blank")[0])}" aria-label="Тема листа">
  <textarea class="field" name="body" rows="8" aria-label="Текст листа">${esc(this.mailText(o,"blank")[1])}</textarea>
  <div class="acts"><button class="btn primary sm ocsend">✉️ Відкрити лист у пошті</button><span class="help ochelp" style="margin:0">Пишіть англійською — покупець з США. Лист відкриється у вашій пошті з адресою покупця, номером замовлення й підписом магазину.</span></div></form></div>`},
ocVia(f){const v=(f.querySelector("[name=via]:checked")||{}).value||"email";f.querySelectorAll(".ocvia .chip2").forEach(l=>l.classList.toggle("on",l.querySelector("input").checked));
 f.subject.hidden=v==="chat";f.querySelector(".ocsend").textContent=v==="chat"?"💬 Надіслати в чат":"✉️ Відкрити лист у пошті";
 f.querySelector(".ochelp").textContent=v==="chat"?"Повідомлення одразу з’явиться в чаті покупця на сайті (з номером замовлення) і в розділі «Чат». Пишіть англійською.":"Пишіть англійською — покупець з США. Лист відкриється у вашій пошті з адресою покупця, номером замовлення й підписом магазину."},
async contactExtras(o){const c=o.customer||{},em=String(c.email||"").trim().toLowerCase(),box=$("#ocChat"),mb=$("#ocMsgs");if(!box)return;
 const ors=[];if(em)ors.push(`email.ilike.${em.replace(/[,()*]/g,"")}`);if(o.user_id)ors.push(`user_id.eq.${o.user_id}`);
 const[th,ms]=await Promise.all([ors.length?sb.from("chat_threads").select("id,last_at").or(ors.join(",")).order("last_at",{ascending:false}).limit(1):Promise.resolve({data:[]}),
  sb.from("messages").select("id",{count:"exact",head:true}).or([...(em?[`email.ilike.${em.replace(/[,()*]/g,"")}`]:[]),`order_no.eq.${o.order_no}`].join(","))]);
 const t=(th.data||[])[0],f=document.querySelector('[data-form="ocmail"]');
 if(f){const r=f.querySelector('[name=via][value=chat]'),lab=r.closest("label"),note=f.querySelector(".ocvianote");
  if(t){r.disabled=false;f.dataset.thread=t.id;lab.title="Написати в чат покупця на сайті";if(!c.email){r.checked=true}note.textContent=""}
  else{lab.title="Покупець ще не писав у чат на сайті";note.textContent=c.email?"Чат недоступний — покупець ще не писав у «Chat with us». Можна написати поштою.":"Немає ні чату, ні email покупця."}
  this.ocVia(f)}
 if(box)box.innerHTML=t?`<a class="btn sm" href="#/admin/chat?t=${esc(String(t.id))}">💬 Відкрити чат з покупцем</a>`:`<span class="muted small" title="Чат з’явиться, коли покупець напише в «Chat with us» на сайті">Чату на сайті ще немає</span>`;
 if(mb)mb.innerHTML=ms&&ms.count?`<a class="btn sm" href="#/admin/messages">✉️ Повідомлення з форми: ${ms.count}</a>`:""},
/* orders list: one dropdown «Виберіть дію…» — the chosen action asks for confirmation (or opens its form) */
OACTS:{oconfirm:"✓ Підтвердити замовлення",shipForm:"📦 Відправити",odeliver:"✓ Позначити доставленим",delayForm:"⏰ Затримка доставки",retForm:"↩ Оформити повернення",ocancel:"✕ Скасувати замовлення",slip:"🖨 Пакувальний лист",open:"Відкрити замовлення →"},
actSelect(o){const s=o.status,L=[];
 if(s==="new")L.push("oconfirm");if(s==="confirmed")L.push("shipForm");if(s==="shipped")L.push("odeliver","delayForm");if(s==="shipped"||s==="completed")L.push("retForm");if(s==="new"||s==="confirmed")L.push("ocancel");L.push("open");
 return `<select class="field actsel" data-ach="oact" data-id="${o.id}" aria-label="Дія із замовленням ${esc(o.order_no)}"><option value="">Виберіть дію…</option>${L.map(k=>`<option value="${k}">${this.OACTS[k]}</option>`).join("")}</select>`},
/* orders list: one main button + «Дії ▾» menu with every action allowed for this status */
mainAct(o){return o.status==="new"?`<button class="btn sm primary" data-act="a:oconfirm" data-id="${o.id}">✓ Підтвердити</button>`:o.status==="confirmed"?`<button class="btn sm primary" data-act="a:shipForm" data-id="${o.id}">📦 Відправити</button>`:o.status==="shipped"?`<button class="btn sm" data-act="a:odeliver" data-id="${o.id}">✓ Доставлено</button>`:""},
actMenu(o){const it=[],s=o.status,a=(act,l,cls)=>it.push(`<button type="button" class="${cls||""}" data-act="a:${act}" data-id="${o.id}">${l}</button>`);
 if(s==="new")a("oconfirm","✓ Підтвердити замовлення");
 if(s==="confirmed")a("shipForm","📦 Відправити");
 if(s==="shipped"){a("odeliver","✓ Позначити доставленим");a("delayForm","⏰ Затримка доставки")}
 if(s==="shipped"||s==="completed")a("retForm","↩ Оформити повернення");
 if(s==="new"||s==="confirmed")a("ocancel","✕ Скасувати замовлення","danger");
 a("slip","🖨 Пакувальний лист");it.push(`<a href="#/admin/order/${o.id}">Відкрити замовлення →</a>`);
 return `<details class="actmenu"><summary class="btn sm">Дії ▾</summary><div class="actlist" role="menu">${it.join("")}</div></details>`},
/* status is never picked by hand: it changes only through actions (confirm, ship, deliver, return, cancel) */
statusBadge(o){return `<span class="ostbadge s-${esc(o.status)}">${esc(this.ST[o.status]||o.status)}</span>`},
flowBtns(o,ic){const b=[];
 if(o.status==="new")b.push(`<button class="btn sm primary" data-act="a:oconfirm" data-id="${o.id}" title="Підтвердити замовлення">✓ Підтвердити</button>`);
 if(o.status==="new"||o.status==="confirmed")b.push(ic?`<button class="btn sm ib" data-act="a:ocancel" data-id="${o.id}" title="Скасувати замовлення">✕</button>`:`<button class="btn sm" data-act="a:ocancel" data-id="${o.id}">✕ Скасувати</button>`);
 return b.join("")},
delivBtns(o,ic){return o.status==="shipped"?(ic?`<button class="btn sm ib" data-act="a:odeliver" data-id="${o.id}" title="Позначити доставленим">✓</button><button class="btn sm ib" data-act="a:delayForm" data-id="${o.id}" title="Затримка доставки">⏰</button>`:`<button class="btn sm" data-act="a:odeliver" data-id="${o.id}">✓ Доставлено</button><button class="btn sm" data-act="a:delayForm" data-id="${o.id}">⏰ Затримка</button>`):""},
delayForm(o){const t=this.nyToday(),base=o.delivery_eta&&o.delivery_eta>t?o.delivery_eta:t,def=this.addDays(base,3),known=this.DREASONS.includes(o.delay_reason||"");
 return `<form class="shipform" data-form="odelay" data-id="${o.id}"><b>Затримка доставки ${esc(o.order_no)}</b>
 <label class="small etarow">📅 Нова очікувана дата<input class="field" type="date" name="eta" value="${esc(def)}" min="${esc(this.addDays(t,1))}" required></label>
 <select class="field" name="reason" data-ach="delayreason">${this.DREASONS.map(x=>`<option ${o.delay_reason===x?"selected":""}>${x}</option>`).join("")}<option value="__other" ${o.delay_reason&&!known?"selected":""}>Інша причина…</option></select>
 <input class="field" name="reason_other" placeholder="Причина англійською (її бачить покупець)" maxlength="200" value="${esc(o.delay_reason&&!known?o.delay_reason:"")}" ${o.delay_reason&&!known?"":"hidden"}>
 <label class="check small"><input type="checkbox" name="mail" value="1" ${(o.customer||{}).email?"checked":"disabled"}> Відкрити лист покупцю з новою датою</label>
 <button class="btn primary sm">Зберегти затримку</button><button type="button" class="btn sm ghost" data-act="a:delayForm" data-id="${o.id}">Скасувати</button>
 <span class="help">Покупець побачить «Delayed», нову дату й причину в «My orders» і на «Track your order». Замовлення стане «Доставлене» вже після нової дати.</span></form>`},
RREASONS:["Краща ціна","Товар у поганому стані","Бракований товар","Товарний вигляд (не як на фото)","Інше"],
CARRIERS:["USPS","UPS","FedEx","DHL","Other"],/* saved in English — the customer sees it */
etaDefault(o){const c=o.customer||{},n=/express/i.test(c.delivery||"")?2:5,d=new Date();let k=0;while(k<n){d.setDate(d.getDate()+1);if(d.getDay()%6)k++}return d.toISOString().slice(0,10)},
day(s){if(!s)return"";const[y,m,d]=String(s).slice(0,10).split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("uk-UA",{weekday:"short",day:"2-digit",month:"2-digit"})},
ordersData:[],
async fillOrders(){const box=$("#ordList");if(!box)return;const q=this.ordQ(),st=q.get("status")||"all",so=q.get("sort")||"new",page=Math.max(1,parseInt(q.get("page"))||1),seq=(this.ordSeq=(this.ordSeq||0)+1);
 const order=so==="old"?["created_at",true]:so==="sum"?["total",true]:so==="sumdesc"?["total",false]:["created_at",false];
 const list=this.ordFilter(sb.from("orders").select("*",{count:"exact"}),q,st).order(order[0],{ascending:order[1]}).order("id",{ascending:false}).range((page-1)*this.ORD_PER,page*this.ORD_PER-1);
 const keys=[...this.OSTAT.map(x=>x[0]),"ship","unpaid"],counts=keys.map(k=>this.ordFilter(sb.from("orders").select("id",{count:"exact",head:true}),q,k));
 const[res,...cs]=await Promise.all([list,...counts]);if(seq!==this.ordSeq||!$("#ordList"))return;
 cs.forEach((r,i)=>{const b=document.querySelector(`#ostChips [data-cnt="${keys[i]}"]`);if(b)b.textContent=r&&r.count!=null?r.count:"·"});
 if(res.error){box.innerHTML=`<div class="note">Не вдалося завантажити: ${esc(res.error.message)}</div>`;$("#ordPager").innerHTML="";return}
 this.ordersData=res.data||[];this.ordTotal=res.count||0;this.renderOrders();
 const pages=Math.max(1,Math.ceil(this.ordTotal/this.ORD_PER)),pg=$("#ordPager");
 if(pg)pg.innerHTML=pages>1?`<nav class="opager" aria-label="Сторінки замовлень">${page>1?`<a class="btn sm" href="${this.ordHref({page:page-1})}">← Назад</a>`:`<span class="btn sm" aria-disabled="true">← Назад</span>`}
  <span class="opnums">${Array.from({length:pages},(_,i)=>i+1).filter(n=>pages<=9||n===1||n===pages||Math.abs(n-page)<=2).map((n,i,a)=>(i&&n-a[i-1]>1?'<span class="muted">…</span>':"")+(n===page?`<b aria-current="page">${n}</b>`:`<a href="${this.ordHref({page:n})}">${n}</a>`)).join("")}</span>
  ${page<pages?`<a class="btn sm" href="${this.ordHref({page:page+1})}">Далі →</a>`:`<span class="btn sm" aria-disabled="true">Далі →</span>`}<span class="muted small">${(page-1)*this.ORD_PER+1}–${Math.min(page*this.ORD_PER,this.ordTotal)} з ${this.ordTotal}</span></nav>`:this.ordTotal?`<p class="muted small" style="text-align:center">${this.ordTotal} замовл.</p>`:"";
 const inp=$("#ordSearch");if(inp&&!inp.dataset.ready){inp.dataset.ready=1;inp.addEventListener("input",()=>{clearTimeout(this.ordT);this.ordT=setTimeout(()=>{this.ordTerm=inp.value;if((parseInt(this.ordQ().get("page"))||1)>1){location.hash=this.ordHref({page:""})}else this.fillOrders()},350)})}},
renderOrders(){const box=$("#ordList");if(!box)return;
 const term=String(this.ordTerm||"").trim(),data=this.ordersData||[];
 if(!data.length){box.innerHTML=`<div class="empty"><b>${term?"Нічого не знайдено":"Тут порожньо"}</b>${term?"Спробуйте інший запит.":"Немає замовлень із таким статусом за цей період."}</div>`;return}
 box.innerHTML=`<div class="tablewrap"><table class="t"><thead><tr><th>Номер</th><th>Дата</th><th>Покупець</th><th>Товари</th><th>Сума</th><th>Статус</th><th></th></tr></thead><tbody>${data.map(o=>{const c=o.customer||{};const canShip=o.status==="confirmed",canRet=o.status==="shipped"||o.status==="completed";return `<tr class="ordrow s-${esc(o.status)}">
 <td class="onocell"><a class="textlink" href="#/admin/order/${o.id}" title="${o.user_id?"Покупець з акаунтом":"Гість (без акаунта)"}"><b>${esc(o.order_no)}</b></a>${o.user_id?' <span class="oacc" title="Покупець з акаунтом">👤</span>':""}<div class="opay">${Admin.payPill(o)}</div></td>
 <td class="small">${new Date(o.created_at).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td>
 <td><details><summary><b>${esc(c.name||"—")}</b></summary><div class="small" style="margin-top:6px;line-height:1.6">${c.phone?`📞 <a href="tel:${esc(String(c.phone).replace(/[^+\d]/g,""))}">${esc(c.phone)}</a><br>`:""}${c.email?`✉️ ${esc(c.email)}<br>`:""}🚚 ${esc(c.delivery||"")}<br>📍 ${esc([c.address,c.city,c.state,c.zip].filter(Boolean).join(", "))}<br>💳 ${esc(c.payment||"")}${c.comment?`<br>💬 ${esc(c.comment)}`:""}</div></details></td>
 <td class="small oitemscell" title="${esc((o.items||[]).map(i=>`${i.name} × ${+i.qty||0}`).join("\n"))}">${(o.items||[]).map(i=>`${esc(i.name)}${i.opt?` <span class="muted">(${esc(optStr(i.opt,prod(i.id)))})</span>`:""} × ${+i.qty||0}`).join(", ")}</td>
 <td><b>${money(o.total)}</b></td>
 <td>${Admin.statusBadge(o)}${o.status==="returned"&&o.return_reason?`<div class="small" style="margin-top:4px;color:#9a3d2a">↩ ${esc(o.return_reason)}</div>`:""}${o.tracking_number||o.carrier?`<div class="small" style="margin-top:4px">${esc(o.carrier||"")}${o.tracking_number?` · ${trackUrl(o.carrier,o.tracking_number)?`<a class="textlink" href="${esc(trackUrl(o.carrier,o.tracking_number))}" target="_blank" rel="noopener">${esc(o.tracking_number)}</a>`:esc(o.tracking_number)+' <span class="muted">(не відстежується)</span>'}`:""}</div>`:""}
 ${o.status==="completed"&&o.delivered_at?`<div class="small" style="margin-top:4px;color:#3f7a4d">✓ Доставлено ${Admin.day(o.delivered_at)}</div>`:""}${Admin.delivNote(o,true)}
 ${["confirmed","shipped"].includes(o.status)?`<span class="oeta" title="Очікувана доставка${o.delivery_eta?"":" не вказана — вкажіть на сторінці замовлення або при відправці"}">📅 ${o.delivery_eta?Admin.day(o.delivery_eta):"—"}</span>`:""}</td>
 <td><div class="acts">${Admin.actSelect(o)}</div></td></tr>
 <tr class="shiprow" id="ship-${o.id}" hidden><td colspan="7"><form class="shipform" data-form="ship" data-id="${o.id}"><b>Відправлення ${esc(o.order_no)}</b>
 <select class="field" name="carrier" data-ach="carrierpick">${Admin.CARRIERS.map(x=>`<option value="${x}" ${o.carrier===x||(x==="Other"&&o.carrier&&!Admin.CARRIERS.includes(o.carrier))?"selected":""}>${x==="Other"?"Інший":x}</option>`).join("")}</select>
 <input class="field" name="carrier_other" placeholder="Назва служби англійською (її бачить покупець)" value="${esc(o.carrier&&!Admin.CARRIERS.includes(o.carrier)?o.carrier:"")}" maxlength="40" autocomplete="off" ${o.carrier&&!Admin.CARRIERS.includes(o.carrier)?"":"hidden"}>
 <input class="field" name="tracking" placeholder="${o.carrier&&!this.CARRIERS.includes(o.carrier)?"Номер відправлення (необов’язково)":"Трек-номер "+(o.carrier&&this.CARRIERS.includes(o.carrier)&&o.carrier!=="Other"?o.carrier:"USPS")+" (обов’язково)"}" value="${esc(o.tracking_number||"")}" maxlength="80" autocomplete="off" oninput="this.classList.remove('invalid')">
 <label class="small etarow">📅 Очікувана дата доставки<input class="field" type="date" name="eta" value="${esc(o.delivery_eta||Admin.etaDefault(o))}" min="${new Date().toISOString().slice(0,10)}"></label>
 <button class="btn primary sm">Позначити відправленим</button><button type="button" class="btn sm ghost" data-act="a:shipCancel" data-id="${o.id}">Скасувати</button>
 <span class="help">Покупець побачить службу, номер і очікувану дату доставки в «My orders» і на сторінці «Track your order». Для USPS/UPS/FedEx/DHL трек-номер обов’язковий — у покупця з’явиться кнопка відстеження. Для «Інший» (власна чи внутрішня доставка) номер необов’язковий.</span></form></td></tr>
 ${o.status==="shipped"?`<tr class="shiprow" id="delay-${o.id}" hidden><td colspan="7">${Admin.delayForm(o)}</td></tr>`:""}
 <tr class="shiprow" id="ret-${o.id}" hidden><td colspan="7"><form class="shipform" data-form="ret" data-id="${o.id}"><b>Повернення ${esc(o.order_no)}</b>
 <select class="field" name="reason">${Admin.RREASONS.map(x=>`<option>${x}</option>`).join("")}</select>
 <input class="field" name="note" placeholder="Коментар (необов’язково)" maxlength="200" autocomplete="off">
 <button class="btn primary sm">Оформити повернення</button><button type="button" class="btn sm ghost" data-act="a:retCancel" data-id="${o.id}">Скасувати</button>
 <span class="help">Товари з цього замовлення автоматично повернуться на склад.</span></form></td></tr>`}).join("")}</tbody></table></div><p class="help">Натисніть на ім’я покупця, щоб побачити контакти й адресу. 🖨 — пакувальний лист.</p>`},
slip(id){const o=this.ordersData.find(x=>x.id===+id);if(!o)return;const c=o.customer||{},st=S.settings;
 let el=$("#printArea");if(!el){el=document.createElement("div");el.id="printArea";document.body.appendChild(el)}
 el.innerHTML=`<div class="slipwrap"><div class="slipbar noprint"><b>Пакувальний лист</b><span><button class="btn primary sm" data-act="a:print">🖨 Друкувати</button> <button class="btn sm" data-act="a:slipClose">Закрити</button></span></div>
 <div class="slip"><div class="sliphead"><div><div class="sliplogo">${esc(st.name)}</div><div class="muted small">${esc(st.tagline||"")}</div></div><div style="text-align:right"><b>Packing slip</b><br>Order ${esc(o.order_no)}<br><span class="small">${new Date(o.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span></div></div>
 <div class="slipcols"><div><div class="small muted">SHIP TO</div><b>${esc(c.name||"")}</b><br>${esc(c.address||"")}<br>${esc([c.city,c.state,c.zip].filter(Boolean).join(", "))}<br>${esc(c.phone||"")}</div><div><div class="small muted">SHIPPING</div>${esc(c.delivery||"")}${o.tracking_number?`<br>${esc(o.carrier||"")} ${esc(o.tracking_number)}`:""}</div></div>
 <table class="sliptable"><thead><tr><th>Item</th><th>SKU</th><th style="text-align:right">Qty</th><th style="text-align:center">✓</th></tr></thead><tbody>${(o.items||[]).map(i=>`<tr><td>${esc(i.name)}${i.opt?`<br><small>${esc(optStr(i.opt,prod(i.id)))}</small>`:""}</td><td>${esc(i.sku||"")}</td><td style="text-align:right"><b>${+i.qty||0}</b></td><td style="text-align:center">☐</td></tr>`).join("")}</tbody></table>
 <p class="small">Items: ${(o.items||[]).reduce((s,i)=>s+(+i.qty||0),0)}${c.comment?` · Note: ${esc(c.comment)}`:""}</p>
 <p class="slipthanks">Thank you for shopping with ${esc(st.name)}!${st.email?` Questions? ${esc(st.email)}`:""}</p></div></div>`;
 document.body.classList.add("printing")},
async stripeRefund(id,amt,f){const b=f&&f.querySelector("button.primary,button");if(b)b.disabled=true;
 try{const{data:ss}=await sb.auth.getSession();const r=await fetch(SB_URL+"/functions/v1/payments-refund",{method:"POST",headers:{"Content-Type":"application/json",apikey:SB_KEY,Authorization:"Bearer "+(ss&&ss.session?ss.session.access_token:"")},body:JSON.stringify({order_id:id,amount:amt})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error==="BAD_AMOUNT"?"Можна повернути щонайбільше "+money(d.left):d.error==="NOT_ALLOWED"?"Немає доступу (увійдіть знову з 2FA)":d.message||d.error||("помилка "+r.status));
  toast("Кошти повернено через Stripe ✓ ("+money(amt)+")");this.afterOrderChange(id)}
 catch(e){toast("⚠️ Stripe: "+(e.message||e))}finally{if(b)b.disabled=false}},
});
