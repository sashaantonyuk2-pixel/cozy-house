/* ===== Seller Central · Замовлення з кількома товарами: скасування товарів, яких немає, і кілька посилок з окремими трек-номерами =====
   items[i].cancelled_qty / cancel_reason — скасовано (public.seller_cancel_items перераховує суму й повертає товар на склад)
   orders.shipments [{n, items:[{i,qty}], carrier, tracking, eta, shipped_at}] — посилки (public.seller_ship_package) */
Object.assign(Admin,{
CREASONS:[["Out of stock","Немає в наявності"],["Damaged in stock","Пошкоджено на складі"],["Discontinued","Знято з продажу"]],/* saved in English — the customer sees it */
creasonUa(r){const m=this.CREASONS.find(x=>x[0]===r);return m?m[1]:r||"Немає в наявності"},
liveQ(x){return Math.max((+x.qty||0)-(+x.cancelled_qty||0),0)},
shipQ(o,i){return (o.shipments||[]).reduce((s,p)=>s+(p.items||[]).filter(l=>+l.i===i).reduce((a,l)=>a+(+l.qty||0),0),0)},
remQ(o,i){const x=(o.items||[])[i];return x?Math.max(this.liveQ(x)-this.shipQ(o,i),0):0},
remLines(o){return (o.items||[]).map((x,i)=>({i,qty:this.remQ(o,i)})).filter(l=>l.qty>0)},
multi(o){const r=this.remLines(o);return r.length>1||r.some(l=>l.qty>1)},
isPartial(o){return o.status==="confirmed"&&(o.shipments||[]).length>0},
hasCancelled(o){return (o.items||[]).some(x=>+x.cancelled_qty>0)},
lineName(x){return esc(x.name)+(x.opt?` <span class="muted">(${esc(optStr(x.opt,prod(x.id)))})</span>`:"")},
/* order page «Товари»: checkboxes for the items that are not shipped yet → «✕ Скасувати вибрані» */
itemsPanel(o){const items=o.items||[],sel=["new","confirmed"].includes(o.status)&&this.multi(o),c=o.customer||{};
 const sub=items.reduce((s,x)=>s+(+x.price||0)*this.liveQ(x),0);
 const rows=items.map((x,i)=>{const p=prod(x.id),live=this.liveQ(x),cq=+x.cancelled_qty||0,sq=this.shipQ(o,i),rem=this.remQ(o,i),pk=(o.shipments||[]).filter(s=>(s.items||[]).some(l=>+l.i===i)).map(s=>s.n);
  return `<div class="oline ${sel?"osel":""} ${live===0?"ocanc":""}">${sel?`<span class="ocheck">${rem?`<input type="checkbox" name="ci" value="${i}" data-ach="ocisel" aria-label="Вибрати «${esc(x.name)}»">`:""}</span>`:""}
  <img src="${esc(p?img0(p):"")}" alt=""><div><b>${p?`<a class="textlink" href="#/admin/product/${p.id}">${esc(x.name)}</a>`:esc(x.name)}</b>${x.opt?`<div class="small">${esc(optStr(x.opt,p))}</div>`:""}
  <div class="small muted">${x.sku?"SKU "+esc(x.sku)+" · ":""}на складі: ${p&&p.stock!=null?+p.stock:"—"}</div>
  ${cq?`<div class="small ocnote">✕ Скасовано ${cq} шт. · ${esc(this.creasonUa(x.cancel_reason))}</div>`:""}
  ${pk.length?`<div class="small opkg">📦 ${pk.map(n=>"посилка "+n).join(", ")}${sq<live?` · відправлено ${sq} з ${live}`:""}</div>`:""}
  ${sel&&rem>1?`<label class="small ociq">Скасувати шт.: <input type="number" class="field" name="cq_${i}" min="1" max="${rem}" value="${rem}"></label>`:""}</div>
  <div class="small">${live?`${live} × ${money(x.price)}${cq?` <s class="muted" title="Було замовлено">${+x.qty}</s>`:""}`:`<s class="muted">${+x.qty} × ${money(x.price)}</s>`}</div><b>${money((+x.price||0)*live)}</b></div>`}).join("");
 const totals=`<div class="row" style="margin-top:10px"><span>Разом за товари</span><b>${money(sub)}</b></div><div class="row"><span>Доставка <span class="muted small">· ${esc(c.delivery||"")}</span></span><span>${+o.shipping?money(o.shipping):"безкоштовно"}</span></div><div class="row"><span>Податок з продажів${+o.tax_rate?` <span class="muted small">(${esc(c.state||"")} ${+o.tax_rate}%)</span>`:""}</span><span>${money(o.tax||0)}</span></div><div class="row total"><span>До оплати</span><span>${money(o.total)}</span></div>`;
 if(!sel)return `<div class="panel"><h2>Товари</h2>${rows}${totals}</div>`;
 return `<div class="panel"><h2>Товари</h2><form data-form="ocitems" data-id="${o.id}" novalidate>${rows}
  <div class="ocibar"><span class="small muted">Чогось немає в наявності? Позначте товар і скасуйте лише його — сума перерахується.</span>
  <select class="field" name="reason" aria-label="Причина (бачить покупець)">${this.CREASONS.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select>
  <button class="btn sm danger" disabled>✕ Скасувати вибрані</button></div></form>${totals}</div>`},
async ocitemsSubmit(f){const id=+f.dataset.id,o=this.ordersData.find(x=>x.id===id);if(!o)return;
 const lines=[...f.querySelectorAll("[name=ci]:checked")].map(c=>{const i=+c.value,inp=f.querySelector(`[name="cq_${i}"]`);return{i,qty:inp?Math.round(+inp.value):this.remQ(o,i)}});
 if(!lines.length)return toast("Позначте товари, яких немає");
 const bad=lines.find(l=>!(l.qty>=1&&l.qty<=this.remQ(o,l.i)));if(bad)return toast(`Кількість для «${o.items[bad.i].name}» — від 1 до ${this.remQ(o,bad.i)}`);
 const rem=this.remLines(o),all=!(o.shipments||[]).length&&rem.every(r=>(lines.find(l=>l.i===r.i)||{}).qty===r.qty),paid=["paid","partially_refunded"].includes(o.payment_status),reason=f.reason.value;
 if(!confirm(`Скасувати в замовленні ${o.order_no}:\n${lines.map(l=>`• ${o.items[l.i].name} × ${l.qty}`).join("\n")}\n\nПричина (бачить покупець): ${reason}\nТовари повернуться на склад, сума замовлення перерахується.${all?"\n\n⚠️ Це всі товари — замовлення буде скасоване повністю.":""}${paid?"\n\nЗамовлення оплачене — після цього поверніть різницю покупцю (блок «Оплата»).":""}`))return;
 const b=f.querySelector("button.danger");b.disabled=true;
 const{data,error}=await sb.rpc("seller_cancel_items",{p_order:id,p_lines:lines,p_reason:reason});b.disabled=false;
 if(error)return toast("⚠️ "+(/TOO_MANY/.test(error.message)?"Стільки товару в замовленні вже немає — оновіть сторінку":/NOT_CANCELLABLE/.test(error.message)?"Це замовлення вже не можна змінити":error.message));
 refreshAdminCatalog();
 toast(data.cancelled_all?"Замовлення скасовано повністю":`Скасовано · нова сума ${money(data.total)}`+(+data.refund_due>0?` · поверніть покупцю ${money(data.refund_due)}`:""));
 await this.fillOrder(id);
 const o2=this.ordersData.find(x=>x.id===id);if(o2&&(o2.customer||{}).email&&confirm("Відкрити лист покупцю про скасовані товари?"))location.href=this.mailFor(o2,"cancel")},
/* ship form (list row and order page): one parcel with everything left, or pick items for this parcel */
shipFormHtml(o,inList){const multi=this.multi(o),n=(o.shipments||[]).length,today=new Date().toISOString().slice(0,10),rem=this.remLines(o),C=this.CARRIERS,own=o.carrier&&!C.includes(o.carrier);
 return `<form class="shipform ${inList?"":"stack"}" data-form="ship" data-id="${o.id}" ${inList?"":'style="margin-top:12px"'}><b>${n?`Посилка ${n+1} · ${esc(o.order_no)}`:inList?`Відправлення ${esc(o.order_no)}`:"Відправлення"}</b>
 ${multi?`<div class="shipmode" role="radiogroup" aria-label="Як відправити"><label class="chip2 on"><input type="radio" name="smode" value="all" checked data-ach="shipmode"> ${n?"Усе, що залишилось,":"Усе"} однією посилкою (${rem.reduce((s,l)=>s+l.qty,0)} шт.)</label><label class="chip2"><input type="radio" name="smode" value="pick" data-ach="shipmode"> Кілька посилок — вибрати товари</label></div>
 <div class="shiplines" hidden>${rem.map(l=>{const x=o.items[l.i];return `<label class="shipline"><input type="checkbox" name="si" value="${l.i}"> <span>${this.lineName(x)}</span>${l.qty>1?`<input type="number" class="field" name="sq_${l.i}" min="1" max="${l.qty}" value="${l.qty}" aria-label="Кількість у цій посилці"> <span class="muted small">з ${l.qty}</span>`:`<span class="muted small">× 1</span>`}</label>`}).join("")}</div>`:""}
 <select class="field" name="carrier" data-ach="carrierpick">${C.map(x=>`<option value="${x}" ${o.carrier===x||(x==="Other"&&own)?"selected":""}>${x==="Other"?"Власна доставка":x}</option>`).join("")}</select>
 <input class="field" name="carrier_other" placeholder="Назва служби англійською (її бачить покупець)" value="${esc(own?o.carrier:"")}" maxlength="40" autocomplete="off" ${own?"":"hidden"}>
 <input class="field" name="tracking" placeholder="${own?"Номер відправлення (необов’язково)":"Трек-номер "+(o.carrier&&C.includes(o.carrier)&&o.carrier!=="Other"?o.carrier:"USPS")+" (обов’язково)"}" value="${n?"":esc(o.tracking_number||"")}" maxlength="80" autocomplete="off" oninput="this.classList.remove('invalid')">
 <label class="small etarow">📅 Очікувана дата доставки<input class="field" type="date" name="eta" value="${esc(n?this.etaDefault(o):o.delivery_eta||this.etaDefault(o))}" min="${today}"></label>
 <button class="btn primary sm">${n||multi?"Відправити посилку":"Позначити відправленим"}</button>${inList?`<button type="button" class="btn sm ghost" data-act="a:shipCancel" data-id="${o.id}">Скасувати</button>`:""}
 <span class="help">Кожна посилка має свій трек-номер — покупець побачить усі посилки в «My orders» і на «Track your order». Для USPS/UPS/FedEx/DHL трек-номер обов’язковий, для «Власна доставка» — ні. Замовлення стане «Відправлене», коли поїде остання посилка.</span></form>`},
async shipSubmit(f){const id=+f.dataset.id,o=this.ordersData.find(x=>x.id===id);if(!o)return;
 const other=f.carrier.value==="Other",carrier=other?f.carrier_other.value.trim():f.carrier.value,tracking=f.tracking.value.trim(),eta=f.eta.value||null;
 if(other&&!carrier){f.carrier_other.focus();return toast("Вкажіть назву служби доставки")}
 if(!other&&!tracking){f.tracking.classList.add("invalid");f.tracking.focus();return toast(`Вкажіть трек-номер ${carrier} — без нього покупець не зможе відстежити посилку`)}
 if(/[А-Яа-яІіЇїЄєҐґ]/.test(carrier)){f.carrier_other.focus();return toast("Назву служби напишіть англійською — її бачить покупець")}
 const mode=(f.querySelector("[name=smode]:checked")||{}).value||"all",rem=this.remLines(o);let lines=rem;
 if(mode==="pick"){lines=[...f.querySelectorAll("[name=si]:checked")].map(c=>{const i=+c.value,inp=f.querySelector(`[name="sq_${i}"]`);return{i,qty:inp?Math.round(+inp.value):1}});
  if(!lines.length)return toast("Позначте товари, які їдуть у цій посилці");
  const bad=lines.find(l=>!(l.qty>=1&&l.qty<=this.remQ(o,l.i)));if(bad)return toast(`Кількість для «${o.items[bad.i].name}» — від 1 до ${this.remQ(o,bad.i)}`)}
 if(!lines.length)return toast("Усі товари вже відправлені");
 const b=f.querySelector("button.primary");b.disabled=true;
 const{data,error}=await sb.rpc("seller_ship_package",{p_order:id,p_lines:lines,p_carrier:carrier,p_tracking:tracking||null,p_eta:eta});b.disabled=false;
 if(error)return toast("⚠️ "+(/TRACKING_REQUIRED/.test(error.message)?"Вкажіть трек-номер":/TOO_MANY/.test(error.message)?"Цей товар уже відправлено — оновіть сторінку":/NOT_SHIPPABLE/.test(error.message)?"Спочатку підтвердіть замовлення":error.message));
 toast(data.all_shipped?"Відправлено"+(data.package>1?` · усі ${data.package} посилки`:"")+(tracking?" · трек "+tracking:""):`Посилку ${data.package} відправлено · решту відправте окремо`);
 this.afterOrderChange(id)},
/* order page: action bar under the header — confirm (with the confirm-by deadline) and move the delivery date */
ordTopBar(o){const s=o.status,t=this.nyToday();if(!["new","confirmed","shipped","completed"].includes(s))return"";
 const e=this.estDelivery(o);let info="";
 if(s==="new"){const cb=this.confirmBy(o),late=cb<t;info=`<span class="odl ${late?"late":cb===t?"soon":""}">⏳ Підтвердіть до <b>${this.day(cb)}</b>${late?" · прострочено":cb===t?" · сьогодні":""}</span>`}
 const dl=s==="completed"?(o.delivered_at?`<span class="odl ok">✓ Доставлено ${this.day(o.delivered_at)}</span>`:""):`<span class="odl">🚚 Доставка: <b>${e.est?"~":""}${this.day(e.d)}</b>${e.est?` <span class="muted">(орієнтовно)</span>`:""}</span>`;
 return `<div class="panel otopbar"><div class="otopinfo">${info}${dl}</div><div class="acts">${this.actSelect(o,true)}</div>
  ${s==="completed"?"":s==="shipped"?`<div id="delay-${o.id}" hidden style="margin-top:12px">${this.delayForm(o)}</div>`:`<form class="shipform" id="etamove-${o.id}" data-form="oetamove" data-id="${o.id}" hidden style="margin-top:12px"><label class="small etarow">📅 Нова очікувана дата доставки<input class="field" type="date" name="eta" value="${esc(o.delivery_eta||e.d)}" min="${esc(this.addDays(t,1))}" required></label><button class="btn primary sm">Зберегти дату</button><button type="button" class="btn sm ghost" data-act="a:etaMove" data-id="${o.id}">Скасувати</button><span class="help">Покупець побачить нову дату в «My orders» і на «Track your order». Якщо посилка вже в дорозі й запізнюється — після відправки скористайтеся «⏰ Перенести дату доставки» з причиною.</span></form>`}</div>`},
etaMoveSubmit(f){const id=+f.dataset.id,o=this.ordersData.find(x=>x.id===id),v=f.eta.value;if(!o)return;if(!v)return toast("Вкажіть дату");if(v<=this.nyToday())return toast("Дата має бути пізніше сьогоднішньої");
 if(!confirm(`Перенести очікувану доставку ${o.order_no} на ${this.day(v)}?`))return;return this.orderUpdate(id,{delivery_eta:v},"Дату доставки змінено ✓")},
async ordBadge(){const{count}=await sb.from("orders").select("id",{count:"exact",head:true}).eq("status","new");const b=$("#ordBadge");if(b){b.textContent=count||"";b.title=count?`Нових непідтверджених замовлень: ${count}`:""}},
/* «Оплата»: information only (orders will be created after a successful payment). Money goes back only with a return
   (full or partial), or for a paid order that was cancelled / had items cancelled. */
payLeft(o){return Math.round(((+(o.paid_amount??o.total))-(+o.refund_amount||0))*100)/100},
isPaidO(o){return ["paid","partially_refunded"].includes(o.payment_status)},
refundChoice(o,inRet){if(!this.isPaidO(o))return"";const left=this.payLeft(o);if(left<=0.004)return"";
 const diff=Math.round((left-(+o.total))*100)/100,part=!inRet&&o.status!=="cancelled"&&o.status!=="returned"&&diff>0.004,def=part?diff:left,n="rm"+o.id+(inRet?"r":"p");
 return `<fieldset class="refchoice"><legend class="small"><b>Повернення коштів</b> <span class="muted">· можна повернути до ${money(left)}</span></legend>
  <label class="check small"><input type="radio" name="rmode" value="full" data-ach="refmode" ${part?"":"checked"}> Повне — ${money(left)}</label>
  <label class="check small"><input type="radio" name="rmode" value="part" data-ach="refmode" ${part?"checked":""}> Часткове — <input class="field" name="amount" type="number" min="0.01" step="0.01" max="${left}" value="${def}" data-left="${left}" ${part?"":"disabled"} aria-label="Сума часткового повернення"> $</label>
  ${inRet?`<label class="check small"><input type="radio" name="rmode" value="none" data-ach="refmode"> Без повернення коштів зараз</label>`:""}
  <input class="field" name="rnote" maxlength="120" placeholder="Примітка до повернення коштів (необов’язково)"></fieldset>`},
payPanel(o){const ps=o.payment_status||"unpaid",dt=d=>new Date(d).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}),left=this.payLeft(o),diff=Math.round((left-(+o.total))*100)/100;
 const info=ps==="unpaid"?`<div class="note">Очікує оплати.${o.status!=="cancelled"?` <button type="button" class="linkbtn textlink" data-act="a:opaid" data-id="${o.id}">Позначити оплаченим вручну</button> <span class="muted small">(тимчасово, поки не підключено оплату на сайті)</span>`:""}</div>`
  :`<div class="okbox">${this.PAY[ps]}${o.paid_amount!=null?`: ${money(o.paid_amount)}`:""}${o.payment_method?` · ${esc(o.payment_method)}`:""}${o.paid_at?` · ${dt(o.paid_at)}`:""}${o.payment_ref?`<br><span class="small">ID платежу: ${esc(o.payment_ref)}</span>`:""}${o.refund_amount?`<br><span class="small">Повернено: ${money(o.refund_amount)}${o.refunded_at?" · "+dt(o.refunded_at):""}</span>`:""}</div>`;
 const can=this.isPaidO(o)&&left>0.004&&(o.status==="returned"||o.status==="cancelled"||diff>0.004);
 const why=o.status==="returned"?"Замовлення повернено — поверніть покупцю кошти (повністю або частково).":o.status==="cancelled"?"Замовлення скасовано — поверніть покупцю кошти.":`Частину товарів скасовано — сума замовлення тепер ${money(o.total)}, поверніть різницю <b>${money(diff)}</b>.`;
 return `<div class="panel"><h2>💳 Оплата</h2>${info}
  ${can?`<form class="refundform stack" data-form="orefund" data-id="${o.id}" style="margin-top:12px"><div class="note">⚠️ ${why}</div>${this.refundChoice(o,false)}<div class="acts"><button class="btn sm danger">↩ Повернути кошти</button><span class="help" style="margin:0">${String(o.payment_ref||"").startsWith("pi_")?"Кошти повернуться на картку покупця через Stripe.":"Самі гроші повертаєте в платіжній системі — тут лише позначка."}</span></div></form>`
  :this.isPaidO(o)&&left>0.004?`<p class="help" style="margin:10px 0 0">Повернення коштів стане доступним, коли оформите повернення товару («Виберіть дію…» → «↩ Оформити повернення») — повне або часткове.</p>`:""}</div>`},
refundPatch(o,amt,note){const paid=+(o.paid_amount??o.total),total=Math.round(((+o.refund_amount||0)+amt)*100)/100;
 return{payment_status:total>=paid-0.004?"refunded":"partially_refunded",refund_amount:total,refunded_at:new Date().toISOString(),payment_ref:note?((o.payment_ref?o.payment_ref+" · ":"")+"Refund: "+note).slice(0,120):o.payment_ref}},
refundAmt(f,o){const m=(f.querySelector("[name=rmode]:checked")||{}).value;if(!m||m==="none")return 0;const left=this.payLeft(o);
 const a=m==="full"?left:Math.round(+f.amount.value*100)/100;if(!(a>0)){f.amount.focus();toast("Вкажіть суму повернення");return null}if(a>left+0.004){f.amount.focus();toast("Сума більша за оплачену ("+money(left)+")");return null}return a},
/* parcels list (order page «Доставка», list expand row) */
pkgList(o,compact){const P=o.shipments||[];if(!P.length)return"";
 return `<div class="pkglist">${P.map(s=>{const tu=trackUrl(s.carrier,s.tracking);return `<div class="pkg"><b>📦 Посилка ${s.n}</b> <span class="muted small">${s.shipped_at?"відпр. "+this.day(s.shipped_at):""}</span>
  <div class="small">${esc(s.carrier||"")}${s.tracking?` · ${tu?`<a class="textlink" href="${esc(tu)}" target="_blank" rel="noopener">${esc(s.tracking)} ↗</a>`:esc(s.tracking)}`:` <span class="muted">· без трек-номера</span>`}${s.eta?` · 📅 ${this.day(s.eta)}`:""}</div>
  ${compact?"":`<div class="small muted">${(s.items||[]).map(l=>`${this.lineName((o.items||[])[l.i]||{name:"?"})} × ${l.qty}`).join(", ")}</div>`}</div>`}).join("")}
 ${this.isPartial(o)?`<div class="small owarn" style="margin-top:6px">Залишилось відправити: ${this.remLines(o).map(l=>`${esc(o.items[l.i].name)} × ${l.qty}`).join(", ")}</div>`:""}</div>`},
});
document.addEventListener("change",e=>{const t=e.target;if(!t.closest)return;
 if(t.matches('[data-ach="ocisel"]')){const f=t.form,b=f&&f.querySelector("button.danger");if(b)b.disabled=!f.querySelector("[name=ci]:checked")}
 if(t.matches('[data-ach="shipmode"]')){const f=t.form,pick=t.value==="pick";f.querySelectorAll(".shipmode .chip2").forEach(l=>l.classList.toggle("on",l.querySelector("input").checked));const L=f.querySelector(".shiplines");if(L)L.hidden=!pick}});
document.addEventListener("change",e=>{const t=e.target;if(!t.matches||!t.matches('[data-ach="refmode"]'))return;const fs=t.closest(".refchoice"),a=fs&&fs.querySelector("[name=amount]");if(a){a.disabled=t.value!=="part";if(t.value==="part")a.focus()}});
