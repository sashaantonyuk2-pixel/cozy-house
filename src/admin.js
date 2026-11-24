/* ===== owner admin panel (working file only) ===== */
const Admin={draft:null,sel:new Set(),
nav(cur){const L=[["","📊","Огляд"],["orders","🧾","Замовлення"],["chat","💬","Чат"],["messages","✉️","Повідомлення"],["customers","👥","Покупці"],["reviews","⭐","Відгуки"],["products","📦","Товари"],["seo","🔎","SEO"],["categories","🗂","Категорії"],["settings","⚙️","Налаштування"],["log","🛡","Журнал дій"],["backup","💾","Резервні копії"]];
 return `<nav class="aside">${L.map(([k,i,n])=>`<a href="#/admin${k?"/"+k:""}" class="${cur===k?"on":""}">${i} ${n}${k==="messages"?`<span class="navbadge" id="msgBadge"></span>`:k==="reviews"?`<span class="navbadge" id="revBadge"></span>`:k==="chat"?`<span class="navbadge" id="chatBadge"></span>`:k==="products"?(()=>{const n=Admin.lowList().length;return n?`<span class="navbadge warn" title="Закінчуються або немає">${n}</span>`:""})():""}</a>`).join("")}<hr><a href="${SITE_URL}" target="_blank" rel="noopener">🏠 Відкрити магазин ↗</a><a href="#" data-act="a:signout">🚪 Вийти</a></nav>`},
wrap(cur,html){return `<div class="shell admin">${this.nav(cur)}<div>${html}</div></div>`},
view(parts,q){const k=parts[1]||"";
 if(k==="products")return this.wrap("products",this.products(q));
 if(k==="product")return this.wrap("products",this.editor(parts[2]));
 if(k==="categories")return this.wrap("categories",this.categories());
 if(k==="settings")return this.wrap("settings",this.settings());
 if(k==="backup")return this.wrap("backup",this.backup());
 if(k==="orders")return this.wrap("orders",this.orders(q));
 if(k==="order")return this.wrap("orders",this.orderPage(parts[2]));
 if(k==="log")return this.wrap("log",this.log());
 if(k==="messages")return this.wrap("messages",this.messages(q));
 if(k==="customers")return this.wrap("customers",this.customers());
 if(k==="reviews")return this.wrap("reviews",this.reviews(q));
 if(k==="seo")return this.wrap("seo",this.seo(q));
 if(k==="chat")return this.wrap("chat",this.chat(q));
 return this.wrap("",this.dash())},
after(parts){
 const dz=$("#drop");if(dz){const fi=$("#imgFile");dz.addEventListener("dragover",e=>{e.preventDefault();dz.classList.add("over")});dz.addEventListener("dragleave",()=>dz.classList.remove("over"));dz.addEventListener("drop",e=>{e.preventDefault();dz.classList.remove("over");this.addFiles(e.dataTransfer.files)});fi.addEventListener("change",()=>{this.addFiles(fi.files);fi.value=""})}
 document.querySelectorAll("input[type=file][data-up]").forEach(inp=>inp.addEventListener("change",async()=>{const f=inp.files[0];if(!f)return;const up=inp.dataset.up,url=await toDataURL(f,up==="hero"?2400:up==="heroMobile"?1200:900);if(up==="hero")S.settings.heroImage=url;else if(up==="heroMobile")S.settings.heroImageMobile=url;else{const c=catOf(inp.dataset.up);if(c)c.image=url}save();render();toast("Фото оновлено")}));
 const imp=$("#importFile");if(imp)imp.addEventListener("change",()=>this.importFile(imp.files[0]));
},
/* ---- dashboard ---- */
dash(){const P=S.products,act=P.filter(p=>p.active),out=act.filter(p=>p.stock<=0),low=act.filter(p=>p.stock>0&&p.stock<=this.lowN());
 const days=+(sessionStorage.getItem("dashDays")||30);
 setTimeout(()=>this.fillDash(days),0);
 return `<div class="ahead"><h1>Огляд магазину</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><div class="seg">${[7,30,90].map(d=>`<button class="${d===days?"on":""}" data-act="a:dashDays" data-d="${d}">${d} днів</button>`).join("")}</div><a class="btn primary sm" href="#/admin/product/new">${ICON.plus.replace("<svg",'<svg width="15"')} Додати товар</a></div></div>
 <div class="stats" id="kpis">${["Продажі","Замовлення","Середній чек","Продано одиниць"].map(l=>`<div class="stat"><b>…</b><span>${l}</span></div>`).join("")}</div>
 <div class="stats" style="grid-template-columns:repeat(4,1fr)"><a class="stat link" href="#/admin/orders"><b id="needShip">…</b><span>чекають відправлення</span></a><a class="stat link" href="#/admin/messages"><b id="newMsgs">…</b><span>нових повідомлень</span></a><div class="stat"><b>${act.length}</b><span>товарів на сайті</span></div><a class="stat link ${out.length+low.length?"warnstat":""}" href="#/admin/products?stock=low"><b>${out.length+low.length}</b><span>закінчуються / немає</span></a></div>
 <div class="panel" style="margin-bottom:20px"><h2>Продажі по днях</h2><div id="salesChart" class="chart"><p class="muted">Завантаження…</p></div></div>
 <div class="dashgrid"><div class="panel"><h2>Топ товарів</h2><div id="topProducts"><p class="muted">…</p></div></div>
 <div class="panel"><h2>Без продажів за ${days} днів</h2><p class="help" style="margin-top:-8px">Товари в наявності, яких ніхто не купив. Можливо, варто оновити фото чи опис.</p><div id="deadStock"><p class="muted">…</p></div></div></div>
 ${low.length||out.length?`<div class="panel" style="margin-top:20px"><h2>Потребують поповнення</h2>${[...out,...low].map(p=>`<div class="row" style="border-bottom:1px solid var(--line);padding:10px 0"><a href="#/admin/product/${p.id}"><b>${esc(p.name)}</b></a><span class="stock ${stockState(p)}">${p.stock<=0?"немає":"залишилось "+p.stock}</span></div>`).join("")}</div>`:""}`},
async fillDash(days){
 const since=new Date(Date.now()-2*days*86400000).toISOString();
 const[{data:ord,error},nm,ns]=await Promise.all([sb.from("orders").select("created_at,total,status,items").gte("created_at",since).order("created_at"),
  sb.from("messages").select("id",{count:"exact",head:true}).eq("status","new"),
  sb.from("orders").select("id",{count:"exact",head:true}).in("status",["new","confirmed"])]);
 const set=(id,v)=>{const e=$("#"+id);if(e)e.textContent=v};set("newMsgs",nm.count??"—");set("needShip",ns.count??"—");
 if(error||!$("#kpis"))return;
 const cut=Date.now()-days*86400000,good=o=>!["cancelled","returned"].includes(o.status);
 const cur=ord.filter(o=>good(o)&&Date.parse(o.created_at)>=cut),prev=ord.filter(o=>good(o)&&Date.parse(o.created_at)<cut);
 const sum=a=>a.reduce((s,o)=>s+(+o.total||0),0),units=a=>a.reduce((s,o)=>s+(o.items||[]).reduce((x,i)=>x+(+i.qty||0),0),0);
 const k=[[sum(cur),sum(prev),money],[cur.length,prev.length,String],[cur.length?sum(cur)/cur.length:0,prev.length?sum(prev)/prev.length:0,money],[units(cur),units(prev),String]];
 const lbl=["Продажі","Замовлення","Середній чек","Продано одиниць"];
 $("#kpis").innerHTML=k.map(([v,p,f],i)=>{const ch=p?Math.round((v-p)/p*100):null;return `<div class="stat"><b>${f(Math.round(v*100)/100)}</b><span>${lbl[i]}</span>${ch===null?`<em class="delta">— попередніх ${days} дн. немає</em>`:`<em class="delta ${ch>=0?"up":"down"}">${ch>=0?"▲":"▼"} ${Math.abs(ch)}% до попередніх ${days} дн.</em>`}</div>`}).join("");
 // daily chart
 const byDay={};for(let d=days-1;d>=0;d--){const k2=new Date(Date.now()-d*86400000).toISOString().slice(0,10);byDay[k2]={v:0,n:0}}
 cur.forEach(o=>{const d=o.created_at.slice(0,10);if(byDay[d]){byDay[d].v+=+o.total||0;byDay[d].n++}});
 const ent=Object.entries(byDay),mx=Math.max(1,...ent.map(([,x])=>x.v));
 $("#salesChart").innerHTML=cur.length?`<div class="bars">${ent.map(([d,x])=>`<div class="cbar" title="${new Date(d).toLocaleDateString("uk-UA",{day:"numeric",month:"short"})}: ${money(x.v)} · ${x.n} замовл."><i style="height:${Math.max(x.v?4:0,Math.round(x.v/mx*100))}%"></i></div>`).join("")}</div><div class="barlbl"><span>${new Date(ent[0][0]).toLocaleDateString("uk-UA",{day:"numeric",month:"short"})}</span><span>макс. ${money(mx)} за день</span><span>сьогодні</span></div>`:`<div class="empty" style="padding:30px"><b>Продажів за ${days} днів ще немає</b>Щойно з’являться замовлення, тут буде графік.</div>`;
 // top products
 const tp={};cur.forEach(o=>(o.items||[]).forEach(i=>{const t=tp[i.id]||(tp[i.id]={name:i.name,q:0,r:0});t.q+=+i.qty||0;t.r+=(+i.qty||0)*(+i.price||0)}));
 const top=Object.entries(tp).sort((a,b)=>b[1].r-a[1].r).slice(0,8);const mr=Math.max(1,...top.map(([,x])=>x.r));
 $("#topProducts").innerHTML=top.length?top.map(([id,x],i)=>`<div class="toprow"><span class="rank">${i+1}</span><div style="flex:1;min-width:0"><a href="#/admin/product/${esc(id)}"><b>${esc(x.name)}</b></a><div class="tbar"><i style="width:${Math.round(x.r/mr*100)}%"></i></div></div><div style="text-align:right;white-space:nowrap"><b>${money(x.r)}</b><br><span class="small muted">${x.q} шт.</span></div></div>`).join(""):`<p class="muted">Поки немає продажів.</p>`;
 const sold=new Set(Object.keys(tp));const dead=S.products.filter(p=>p.active&&p.stock>0&&!sold.has(p.id));
 $("#deadStock").innerHTML=dead.length?dead.slice(0,10).map(p=>`<div class="row" style="border-bottom:1px solid var(--line);padding:8px 0"><a href="#/admin/product/${p.id}">${esc(p.name)}</a><span class="muted small">залишок ${p.stock}</span></div>`).join("")+(dead.length>10?`<p class="help">…і ще ${dead.length-10}</p>`:""):`<p class="muted">Усі товари в наявності мали продажі 👍</p>`},
/* ---- products list ---- */
products(q){const term=(q.get("q")||"").toLowerCase(),cat=q.get("cat")||"",sf=q.get("stock")||"",thr=this.lowN();
 const L=S.products.filter(p=>(!cat||p.cat===cat)&&(!term||(p.name+" "+p.sku).toLowerCase().includes(term))&&(!sf||(sf==="out"?p.stock<=0:p.stock>0&&p.stock<=thr))).sort(this.PSORT[q.get("sort")||(sf?"stock":"new")]||this.PSORT.new);const so=q.get("sort")||(sf?"stock":"new");
 const nLow=S.products.filter(p=>p.stock>0&&p.stock<=thr).length,nOut=S.products.filter(p=>p.stock<=0).length;
 const sl=v=>{const n=new URLSearchParams(q);v?n.set("stock",v):n.delete("stock");return "#/admin/products"+(n.toString()?"?"+n:"")};
 this.sel=new Set([...this.sel].filter(id=>prod(id)));
 return `<div class="ahead"><h1>Товари <span class="muted" style="font-size:18px">${S.products.length}</span></h1><div class="acts"><button class="btn" data-act="a:xlsExport" title="Завантажити всі товари в Excel">⬇ Експорт в Excel</button><button class="btn" data-act="a:xlsImportOpen" title="Завантажити товари з Excel або CSV">⬆ Імпорт з Excel</button><a class="btn primary" href="#/admin/product/new">${ICON.plus.replace("<svg",'<svg width="17"')} Додати товар</a></div></div>
 <div id="impBox"></div>
 <div class="acts" style="margin:0 0 12px"><a class="btn sm ${!sf?"primary":""}" href="${sl("")}">Усі (${S.products.length})</a><a class="btn sm ${sf==="low"?"primary":""} ${nLow?"warnbtn":""}" href="${sl("low")}">⚠️ Закінчуються (${nLow})</a><a class="btn sm ${sf==="out"?"primary":""} ${nOut?"dangerbtn":""}" href="${sl("out")}">❌ Немає (${nOut})</a><span class="help" style="margin:0 0 0 6px;align-self:center">«Закінчуються» — залишок ${thr} шт. або менше (змінити: Налаштування → Магазин).</span></div>
 <form class="shopbar" data-form="aprodfilter"><label class="search">${ICON.search}<input name="q" value="${esc(q.get("q")||"")}" placeholder="Пошук: назва або код товару (SKU)"></label><select name="sort" data-ach="filtercat" title="Сортування">${[["manual","Мій порядок на сайті"],["new","Спочатку нові"],["stock","Залишок: менше → більше"],["stockdesc","Залишок: більше → менше"],["name","Назва А→Я"],["price","Ціна: дешевші"],["pricedesc","Ціна: дорожчі"],["sku","Код (SKU)"]].map(([v,l])=>`<option value="${v}" ${so===v?"selected":""}>${l}</option>`).join("")}</select><select name="cat" data-ach="filtercat"><option value="">Усі категорії</option>${S.categories.map(c=>`<option value="${c.id}" ${cat===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></form>
 <div class="bulk"><b id="selN">Вибрано: ${this.sel.size}</b><span class="muted">|</span>Змінити ціну на <input class="field" id="pct" type="number" value="10" style="width:80px;display:inline-block;padding:7px"> % <button class="btn sm" data-act="a:pct" data-s="1">↑ Підняти</button><button class="btn sm" data-act="a:pct" data-s="-1">↓ Знизити</button><span class="muted">|</span><button class="btn sm" data-act="a:vis" data-v="1">Показати</button><button class="btn sm" data-act="a:vis" data-v="0">Приховати</button><button class="btn sm danger" data-act="a:bulkdel">Видалити</button></div>
 <div class="tablewrap"><table class="t"><thead><tr><th><input type="checkbox" data-ach="selall" ${L.length&&L.every(p=>this.sel.has(p.id))?"checked":""}></th><th></th><th>Назва</th><th>Код (SKU)</th><th>Ціна, ${esc(S.settings.currency)}</th><th>Стара ціна</th><th>Залишок</th><th>На сайті</th><th>Хіт</th><th></th></tr></thead><tbody>
 ${L.map(p=>`<tr class="${this.stockCls(p)}"><td>${so==="manual"?`<div class="posbtns"><button class="btn sm" data-act="a:posmv" data-id="${p.id}" data-d="-1" title="Вище">↑</button><b>${p.position>0?p.position:"—"}</b><button class="btn sm" data-act="a:posmv" data-id="${p.id}" data-d="1" title="Нижче">↓</button></div>`:""}<input type="checkbox" data-ach="sel" data-id="${p.id}" ${this.sel.has(p.id)?"checked":""}></td><td><img src="${esc(img0(p))}" alt=""></td>
 <td class="nm"><a href="#/admin/product/${p.id}"><b>${esc(p.name)}</b></a><small>${esc((catOf(p.cat)||{}).name||"без категорії")}</small></td>
 <td><input class="mini sku" value="${esc(p.sku||"")}" maxlength="60" placeholder="—" data-ach="sku" data-id="${p.id}" title="Код товару (артикул) — видно покупцям як «Item #»"></td>
 <td><input class="mini" type="number" min="0" step="0.01" value="${p.price}" data-ach="price" data-id="${p.id}"></td>
 <td><input class="mini" type="number" min="0" step="0.01" value="${p.oldPrice||""}" placeholder="—" data-ach="oldPrice" data-id="${p.id}"></td>
 <td><input class="mini s" type="number" min="0" step="1" value="${p.stock}" data-ach="stock" data-id="${p.id}">${p.stock<=0?`<span class="stk out">немає</span>`:p.stock<=thr?`<span class="stk low">мало</span>`:""}</td>
 <td><label class="switch"><input type="checkbox" data-ach="active" data-id="${p.id}" ${p.active?"checked":""}><span></span></label></td>
 <td><label class="switch"><input type="checkbox" data-ach="featured" data-id="${p.id}" ${p.featured?"checked":""}><span></span></label></td>
 <td><div class="acts"><a class="btn sm" href="#/admin/product/${p.id}">Редагувати</a><button class="btn sm" data-act="a:dup" data-id="${p.id}" title="Дублювати">⧉</button><button class="btn sm danger" data-act="a:del" data-id="${p.id}" title="Видалити">✕</button></div></td></tr>`).join("")||`<tr><td colspan="10" class="muted" style="text-align:center;padding:30px">Товарів не знайдено</td></tr>`}
 </tbody></table></div><p class="help">Ціну, стару ціну (для знижки) та залишок можна змінювати прямо в таблиці — зберігається автоматично. «Стара ціна» показується перекресленою, з відсотком знижки.</p>`},


/* ---- single order page ---- */
PAY:{unpaid:"Не оплачено",paid:"Оплачено",partially_refunded:"Частково повернено",refunded:"Кошти повернено"},
PMETHODS:["Payoneer (посилання на оплату)","Western Bid","PayPal","Банківський переказ","Готівка","Інше"],
payPill(o){const k=o.payment_status||"unpaid";return `<span class="paypill p-${k}">${k==="paid"?"💳 ":""}${this.PAY[k]}</span>`},
afterOrderChange(id){if($("#ordPage"))this.fillOrder(id);else{const st=new URLSearchParams(location.hash.split("?")[1]||"").get("status")||"ship";this.fillOrders(st)}},
orderPage(id){setTimeout(()=>this.fillOrder(id),0);return `<div class="crumbs" style="margin-bottom:8px"><a href="#/admin/orders">← Замовлення</a></div><div id="ordPage"><p class="muted">Завантаження…</p></div>`},
addrText(c){return [c.name,c.address,[c.city,[c.state,c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),"United States"].filter(Boolean).join("\n")},
async fillOrder(id){
 const{data:o,error}=await sb.from("orders").select("*").eq("id",+id).maybeSingle();const box=$("#ordPage");if(!box)return;
 if(error||!o){box.innerHTML=`<div class="empty"><b>Замовлення не знайдено</b>${error?esc(error.message):""}</div>`;return}
 const i=this.ordersData.findIndex(x=>x.id===o.id);if(i>=0)this.ordersData[i]=o;else this.ordersData.push(o);
 const{data:hist}=await sb.from("audit_log").select("at,actor_email,details").eq("table_name","orders").eq("row_id",String(o.id)).order("at",{ascending:true}).limit(200);
 const c=o.customer||{},items=o.items||[],sub=items.reduce((s,x)=>s+(+x.price||0)*(+x.qty||0),0),addr=this.addrText(c),tu=trackUrl(o.carrier,o.tracking_number);
 const dt=d=>new Date(d).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
 const today=new Date().toISOString().slice(0,10),ps=o.payment_status||"unpaid",canShip=o.status==="new"||o.status==="confirmed",canRet=o.status==="shipped"||o.status==="completed";
 const ev=[{at:o.created_at,t:"🛒 Замовлення оформлено на сайті"+(o.user_id?" (покупець з акаунтом)":" (гість)")}];
 (hist||[]).forEach(h=>{const d=h.details||{},who=h.actor_email?` · ${esc(h.actor_email)}`:"";
  if(d.old_status&&d.status!==d.old_status)ev.push({at:h.at,t:`🔄 Статус: ${this.ST[d.old_status]||d.old_status} → <b>${this.ST[d.status]||d.status}</b>${d.tracking?` · трек ${esc(d.tracking)}`:""}${who}`});
  else if(d.tracking&&!d.payment&&!d.customer_changed)ev.push({at:h.at,t:`📦 Трек-номер: ${esc(d.tracking)}${who}`});
  if(d.payment)ev.push({at:h.at,t:`💳 Оплата: ${this.PAY[d.old_payment]||d.old_payment||"—"} → <b>${this.PAY[d.payment]||d.payment}</b>${d.paid_amount!=null&&d.payment==="paid"?` · ${money(d.paid_amount)}`:""}${d.refund_amount?` · повернено ${money(d.refund_amount)}`:""}${d.method?` · ${esc(d.method)}`:""}${who}`});
  if(d.customer_changed)ev.push({at:h.at,t:`✏️ Змінено контакти / адресу${who}`})});
 if(o.shipped_at&&!ev.some(e=>/Відправлене/.test(e.t)))ev.push({at:o.shipped_at,t:"📦 Відправлено"});
 ev.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 box.innerHTML=`<div class="ahead" style="align-items:flex-start"><div><h1 style="margin:0">${esc(o.order_no)}</h1><div class="muted small" style="margin-top:4px">${dt(o.created_at)} · ${items.reduce((s,x)=>s+(+x.qty||0),0)} шт. · <b>${money(o.total)}</b></div><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><span class="ostat s-${esc(o.status)}">${this.ST[o.status]||o.status}</span>${this.payPill(o)}</div></div>
 <div class="acts"><button class="btn sm" data-act="a:slip" data-id="${o.id}">🖨 Пакувальний лист</button></div></div>
 <div class="ordgrid"><div class="stack">
 <div class="panel"><h2>Товари</h2>${items.map(x=>{const p=prod(x.id);return `<div class="oline"><img src="${esc(p?img0(p):"")}" alt=""><div><b>${p?`<a class="textlink" href="#/admin/product/${p.id}">${esc(x.name)}</a>`:esc(x.name)}</b>${x.opt?`<div class="small">${esc(optStr(x.opt,p))}</div>`:""}<div class="small muted">${x.sku?"SKU "+esc(x.sku):""}</div></div><div class="small">${+x.qty||0} × ${money(x.price)}</div><b>${money((+x.price||0)*(+x.qty||0))}</b></div>`}).join("")}
  <div class="row" style="margin-top:10px"><span>Разом за товари</span><b>${money(sub)}</b></div><div class="row"><span>Доставка</span><span class="muted">${esc(c.delivery||"")}</span></div><div class="row total"><span>До оплати</span><span>${money(o.total)}</span></div></div>
 <div class="panel"><h2>💳 Оплата</h2>
  ${ps==="unpaid"?`<div class="note" style="margin-bottom:12px">Оплату ще не отримано. Надішліть покупцю посилання на оплату й позначте замовлення оплаченим, коли гроші надійдуть.</div><div class="acts" style="margin-bottom:12px"><button class="btn primary sm" data-act="a:opaid" data-id="${o.id}">✓ Оплачено ${money(o.total)}</button><button class="btn sm" data-act="a:omail" data-t="pay" data-id="${o.id}">✉️ Лист із посиланням на оплату</button></div>`
  :`<div class="okbox" style="margin-bottom:12px">${this.PAY[ps]}${o.paid_amount!=null?`: ${money(o.paid_amount)}`:""}${o.payment_method?` · ${esc(o.payment_method)}`:""}${o.paid_at?` · ${dt(o.paid_at)}`:""}${o.payment_ref?`<br><span class="small">ID платежу: ${esc(o.payment_ref)}</span>`:""}${o.refund_amount?`<br><span class="small">Повернено: ${money(o.refund_amount)}${o.refunded_at?" · "+dt(o.refunded_at):""}</span>`:""}</div>`}
  <form class="form" data-form="opay" data-id="${o.id}"><div><label>Статус оплати</label><select class="field" name="status">${Object.entries(this.PAY).map(([k,v])=>`<option value="${k}" ${ps===k?"selected":""}>${v}</option>`).join("")}</select></div>
  <div><label>Спосіб</label><select class="field" name="method"><option value="">—</option>${this.PMETHODS.map(m=>`<option ${o.payment_method===m?"selected":""}>${m}</option>`).join("")}</select></div>
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
 <div class="panel"><h2>Доставка</h2><div class="small" style="line-height:1.8">🚚 ${esc(c.delivery||"—")}<br>Статус: <select class="field" style="display:inline-block;width:auto;padding:6px 10px" data-ach="ostatus" data-id="${o.id}">${Object.entries(this.ST).filter(([k])=>k!=="returned"||o.status==="returned").map(([k,v])=>`<option value="${k}" ${o.status===k?"selected":""}>${v}</option>`).join("")}</select>
  ${o.carrier||o.tracking_number?`<br>${esc(o.carrier||"")}${o.tracking_number?` · ${tu?`<a class="textlink" href="${esc(tu)}" target="_blank" rel="noopener">${esc(o.tracking_number)} ↗</a>`:esc(o.tracking_number)+' <span class="muted">(не відстежується)</span>'}`:""}`:""}
  ${o.delivered_at?`<br>✓ Доставлено ${this.day(o.delivered_at)}`:o.delivery_eta?`<br>📅 Очікувана доставка: <b>${this.day(o.delivery_eta)}</b>`:""}</div>
  ${["confirmed","shipped"].includes(o.status)?`<label class="small etarow" style="margin-top:8px">📅 Очікувана доставка<input type="date" class="field" value="${esc(o.delivery_eta||"")}" min="${today}" data-ach="oeta" data-id="${o.id}"></label>`:""}
  <div class="acts" style="margin-top:12px">${canShip?`<button class="btn sm primary" data-act="a:shipForm" data-id="${o.id}">📦 Відправити</button>`:""}${canRet?`<button class="btn sm" data-act="a:retForm" data-id="${o.id}">↩ Повернення товару</button>`:""}</div>
  <div id="ship-${o.id}" hidden><form class="shipform stack" data-form="ship" data-id="${o.id}" style="margin-top:12px"><select class="field" name="carrier" data-ach="carrierpick">${this.CARRIERS.map(x=>`<option ${o.carrier===x||(x==="Інший"&&o.carrier&&!this.CARRIERS.includes(o.carrier))?"selected":""}>${x}</option>`).join("")}</select><input class="field" name="carrier_other" placeholder="Назва служби доставки" value="${esc(o.carrier&&!this.CARRIERS.includes(o.carrier)?o.carrier:"")}" maxlength="40" ${o.carrier&&!this.CARRIERS.includes(o.carrier)?"":"hidden"}><input class="field" name="tracking" placeholder="Трек-номер (або внутрішній номер)" value="${esc(o.tracking_number||"")}" maxlength="80" autocomplete="off"><label class="small etarow">📅 Очікувана дата доставки<input class="field" type="date" name="eta" value="${esc(o.delivery_eta||this.etaDefault(o))}" min="${today}"></label><button class="btn primary sm">Позначити відправленим</button></form></div>
  <div id="ret-${o.id}" hidden><form class="shipform stack" data-form="ret" data-id="${o.id}" style="margin-top:12px"><select class="field" name="reason">${this.RREASONS.map(x=>`<option>${x}</option>`).join("")}</select><input class="field" name="note" placeholder="Коментар (необов’язково)" maxlength="200"><button class="btn primary sm">Оформити повернення</button><span class="help">Товари повернуться на склад. Гроші — окремо, у блоці «Оплата».</span></form></div></div>
 <div class="panel"><h2>📝 Нотатки</h2><p class="help" style="margin-top:-6px">Бачите лише ви, покупцю не показуються.</p><form data-form="onote" data-id="${o.id}"><textarea class="field" name="note" maxlength="4000" style="min-height:90px" placeholder="Напр.: попросив без цін у посилці">${esc(o.admin_note||"")}</textarea><button class="btn sm" style="margin-top:8px">Зберегти нотатку</button></form></div>
 <div class="panel"><h2>✉️ Лист покупцю</h2><p class="help" style="margin-top:-6px">Відкриває вашу пошту з готовим текстом англійською — перевірте й надішліть.</p><div class="stack" style="gap:6px">${[["pay","Посилання на оплату"],["confirm","Оплату отримано, готуємо"],["ship","Замовлення відправлено"],["review","Попросити відгук"]].map(([k,l])=>`<button class="btn sm block" data-act="a:omail" data-t="${k}" data-id="${o.id}" ${!c.email?"disabled":""}>${l}</button>`).join("")}${!c.email?`<span class="help">У замовленні немає email.</span>`:""}</div></div>
 </div></div>`},
mailFor(o,t){const c=o.customer||{},st=S.settings,first=String(c.name||"").split(" ")[0]||"there",items=(o.items||[]).map(x=>`- ${x.name}${x.opt?" ("+optStr(x.opt,prod(x.id))+")":""} x ${x.qty}`).join("\n"),track=SITE_URL+"#/track?no="+encodeURIComponent(o.order_no),tu=trackUrl(o.carrier,o.tracking_number),sig=`\n\nWarm regards,\n${st.name}\n${SITE_URL}`;
 const fmtEta=s=>{if(!s)return"";const[y,m,d]=String(s).split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})};
 const T={pay:[`Your ${st.name} order ${o.order_no} — payment link`,`Hi ${first},\n\nThank you for your order ${o.order_no}!\n\n${items}\n\nTotal: ${money(o.total)}\n\nYou can pay securely here:\n[PASTE PAYMENT LINK]\n\nAs soon as the payment goes through, we'll pack your order — it ships within 1–2 business days.${sig}`],
  confirm:[`We received your payment — order ${o.order_no}`,`Hi ${first},\n\nWe've received your payment for order ${o.order_no} — thank you!\n\nWe're preparing your items now. Your order ships within 1–2 business days, and we'll email you the tracking number.\n\nYou can check your order status anytime: ${track}${sig}`],
  ship:[`Your order ${o.order_no} has shipped`,`Hi ${first},\n\nGood news — your order ${o.order_no} is on its way!\n\n${o.carrier?"Carrier: "+o.carrier+"\n":""}${o.tracking_number?"Tracking number: "+o.tracking_number+"\n":""}${tu?"Track your package: "+tu+"\n":""}${o.delivery_eta?"Estimated delivery: "+fmtEta(o.delivery_eta)+"\n":""}\nOrder status: ${track}${sig}`],
  review:[`How do you like your order from ${st.name}?`,`Hi ${first},\n\nWe hope you're enjoying your new things from ${st.name}!\n\nIf you have a minute, we'd be grateful for a short review — it really helps a small shop like ours:\n${(o.items||[]).map(x=>"- "+x.name+": "+SITE_URL+"#/product/"+x.id).join("\n")}\n\n(Sign in with the email you used for your order to leave a review.)${sig}`]};
 const[sj,b]=T[t]||T.pay;return `mailto:${encodeURIComponent(c.email||"")}?subject=${encodeURIComponent(sj)}&body=${encodeURIComponent(b)}`},
async orderUpdate(id,patch,msg){const{error}=await sb.from("orders").update(patch).eq("id",id);if(error){toast("⚠️ "+error.message);return false}toast(msg||"Збережено ✓");this.afterOrderChange(id);return true},
orderSubmit(k,f){const id=+f.dataset.id,o=this.ordersData.find(x=>x.id===id);if(!o)return;
 if(k==="opay"){const st=f.status.value,amt=f.amount.value===""?null:Math.round(+f.amount.value*100)/100;const patch={payment_status:st,payment_method:f.method.value||null,payment_ref:f.ref.value.trim()||null};
  if(st==="unpaid"){patch.paid_amount=null;patch.paid_at=null;patch.refund_amount=null;patch.refunded_at=null}else{patch.paid_amount=amt??+o.total;patch.paid_at=f.date.value?new Date(f.date.value+"T12:00:00").toISOString():new Date().toISOString()}
  if(st==="paid"&&amt!=null&&amt<+o.total&&!confirm(`Отримано ${money(amt)} — менше за суму замовлення ${money(o.total)}. Все одно позначити оплаченим?`))return;
  return this.orderUpdate(id,patch,"Оплату збережено ✓")}
 if(k==="orefund"){const amt=Math.round(+f.amount.value*100)/100,paid=+(o.paid_amount??o.total);if(!(amt>0))return toast("Вкажіть суму повернення");if(amt>paid)return toast("Сума більша за оплачену ("+money(paid)+")");
  const total=Math.round(((+o.refund_amount||0)+amt)*100)/100;if(total>paid)return toast("Разом повернень більше, ніж оплачено");
  if(!confirm(`Позначити повернення ${money(amt)} покупцю?`))return;
  const note=f.note.value.trim();return this.orderUpdate(id,{payment_status:total>=paid?"refunded":"partially_refunded",refund_amount:total,refunded_at:new Date().toISOString(),payment_ref:note?((o.payment_ref?o.payment_ref+" · ":"")+"Refund: "+note).slice(0,120):o.payment_ref},"Повернення коштів позначено")}
 if(k==="onote")return this.orderUpdate(id,{admin_note:f.note.value.trim()||null},"Нотатку збережено ✓");
 if(k==="oaddr"){const fd=Object.fromEntries(new FormData(f));const st=String(fd.state||"").trim().toUpperCase(),zip=String(fd.zip||"").trim();
  if(st&&!/^[A-Z]{2}$/.test(st))return toast("Штат — 2 літери, напр. TX");if(zip&&!/^\d{5}(-\d{4})?$/.test(zip))return toast("ZIP — 5 цифр");
  const c={...(o.customer||{}),name:String(fd.name).trim(),email:String(fd.email).trim().toLowerCase(),phone:String(fd.phone).trim(),address:String(fd.address).trim(),city:String(fd.city).trim(),state:st,zip};
  return this.orderUpdate(id,{customer:c},"Адресу оновлено ✓")}},
PSORT:{manual:(a,b)=>((a.position>0?a.position:1e9)-(b.position>0?b.position:1e9))||((b.created||0)-(a.created||0)),new:(a,b)=>(b.created||0)-(a.created||0),stock:(a,b)=>a.stock-b.stock||a.name.localeCompare(b.name),stockdesc:(a,b)=>b.stock-a.stock,name:(a,b)=>a.name.localeCompare(b.name),price:(a,b)=>a.price-b.price,pricedesc:(a,b)=>b.price-a.price,sku:(a,b)=>(a.sku||"").localeCompare(b.sku||"",undefined,{numeric:true})},
/* ---- SEO ---- */
seoScore(p){const t=(p.seoTitle||"").length,d=(p.seoDesc||"").length;let n=0;if(t>=20&&t<=65)n++;if(d>=70&&d<=160)n++;if((p.imgAlt||"").length>=5)n++;if((p.desc||"").length>=150)n++;return n},
seoSnippet(title,desc,url){return `<div class="serp"><div class="serp-url">${esc(url)}</div><div class="serp-t">${esc(title.length>62?title.slice(0,61)+"…":title)}</div><div class="serp-d">${desc?esc(desc.length>158?desc.slice(0,157)+"…":desc):'<span class="muted">Опис не заповнено — Google візьме текст зі сторінки.</span>'}</div></div>`},
cnt(id,max){return `<span class="cnt" data-cnt="${id}" data-max="${max}"></span>`},
seo(q){const sf=q.get("f")||"",st=S.settings,base=st.name||"CozyHouseVibe",host=SITE_URL.replace(/^https?:\/\//,"");
 const L=S.products.slice().sort((a,b)=>this.seoScore(a)-this.seoScore(b)||a.name.localeCompare(b.name)).filter(p=>sf!=="todo"||this.seoScore(p)<4);
 const done=S.products.filter(p=>this.seoScore(p)===4).length;setTimeout(()=>this.seoCounters(),0);
 return `<div class="ahead"><h1>SEO</h1></div><p class="muted" style="margin-top:-8px">Як магазин і товари виглядають у Google. Заголовок — до 60 символів, опис — 120–160, англійською, з ключовими словами, які шукають покупці (напр. «ceramic vase», «linen throw pillow»). Порожні поля заповнюються автоматично з назви й опису товару.</p>
 <div class="panel"><h2>Головна сторінка</h2><form class="form" data-form="seosite"><div class="full"><label>SEO-заголовок ${this.cnt("st",60)}</label><input class="field" name="t" maxlength="120" value="${esc(st.seoTitle||"")}" placeholder="${esc(base+(st.tagline?" — "+st.tagline:""))}" data-c="st"></div><div class="full"><label>Мета-опис ${this.cnt("sd",160)}</label><textarea class="field" name="d" maxlength="320" style="min-height:70px" placeholder="${esc(st.heroText||"")}" data-c="sd">${esc(st.seoDescription||"")}</textarea></div><div class="full">${this.seoSnippet(st.seoTitle||base+(st.tagline?" — "+st.tagline:""),st.seoDescription||st.heroText||"",host)}</div><div class="full"><button class="btn sm primary">Зберегти</button></div></form></div>
 <div class="ahead" style="margin-top:22px"><h2 style="margin:0">Товари <span class="muted" style="font-size:15px">готово ${done} з ${S.products.length}</span></h2><div class="acts"><a class="btn sm ${!sf?"primary":""}" href="#/admin/seo">Усі</a><a class="btn sm ${sf==="todo"?"primary":""}" href="#/admin/seo?f=todo">Потребують уваги (${S.products.length-done})</a></div></div>
 <div class="tablewrap"><table class="t"><thead><tr><th></th><th>Товар</th><th>Оцінка</th><th>Як у Google</th><th></th></tr></thead><tbody>${L.map(p=>{const sc=this.seoScore(p),tt=p.seoTitle||p.name+" | "+base,dd=p.seoDesc||p.short||p.desc||"";
 return `<tr><td><img src="${esc(img0(p))}" alt=""></td><td class="nm"><b>${esc(p.name)}</b><small>${esc(p.sku||"")}</small></td>
 <td><span class="seoscore s${sc}">${sc}/4</span><div class="small muted" style="margin-top:4px;line-height:1.5">${[[(p.seoTitle||"").length>=20&&(p.seoTitle||"").length<=65,"заголовок"],[(p.seoDesc||"").length>=70&&(p.seoDesc||"").length<=160,"опис"],[(p.imgAlt||"").length>=5,"alt фото"],[(p.desc||"").length>=150,"текст товару"]].map(([ok,l])=>`${ok?"✓":"✗"} ${l}`).join("<br>")}</div></td>
 <td style="min-width:280px">${this.seoSnippet(tt,dd,host+"#/product/"+p.id)}</td><td><button class="btn sm" data-act="a:seoopen" data-id="${p.id}">Редагувати</button></td></tr>
 <tr id="seo-${p.id}" hidden><td colspan="5"><form class="form seoform" data-form="seoprod" data-id="${p.id}"><div class="full"><label>SEO-заголовок ${this.cnt("t"+p.id,60)}</label><input class="field" name="t" maxlength="120" value="${esc(p.seoTitle||"")}" placeholder="${esc(p.name+" | "+base)}" data-c="t${p.id}"></div><div class="full"><label>Мета-опис ${this.cnt("d"+p.id,160)}</label><textarea class="field" name="d" maxlength="320" style="min-height:64px" placeholder="${esc((p.short||"").slice(0,160))}" data-c="d${p.id}">${esc(p.seoDesc||"")}</textarea></div><div class="full"><label>Підпис до фото (alt) ${this.cnt("a"+p.id,125)}</label><input class="field" name="a" maxlength="200" value="${esc(p.imgAlt||"")}" placeholder="Напр. Handmade terracotta ceramic vase with dried flowers" data-c="a${p.id}"><div class="help">Опис того, що на фото — для Google Картинок і людей з читачами екрана.</div></div><div class="full acts"><button class="btn sm primary">Зберегти SEO</button><a class="btn sm" href="#/admin/product/${p.id}">Редагувати опис товару</a></div></form></td></tr>`}).join("")}</tbody></table></div>`},
seoCounters(){document.querySelectorAll("[data-c]").forEach(i=>{const u=()=>{const c=document.querySelector(`[data-cnt="${i.dataset.c}"]`);if(!c)return;const n=i.value.length,m=+c.dataset.max;c.textContent=n+" / "+m;c.className="cnt"+(n>m?" over":n>=m*0.5?" ok":"")};u();if(!i.dataset.cb){i.dataset.cb=1;i.addEventListener("input",u)}})},
/* ---- stock alerts ---- */
lowN(){const v=parseInt(S.settings.lowStock);return isNaN(v)?3:Math.max(0,v)},
stockCls(p){return p.stock<=0?"st-out":p.stock<=this.lowN()?"st-low":""},
lowList(){const t=this.lowN();return S.products.filter(p=>p.active&&p.stock<=t)},
/* ---- Excel import / export (SheetJS, loaded only when needed) ---- */
XCOLS:["ID","SKU","Name","Category","Price","Old price","Stock","Active","Featured","Short description","Description","Specs","Options","Images"],
loadXLSX(){if(window.XLSX)return Promise.resolve(window.XLSX);return new Promise((res,rej)=>{const sc=document.createElement("script");sc.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";sc.integrity="sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw";sc.crossOrigin="anonymous";sc.onload=()=>res(window.XLSX);sc.onerror=()=>rej(new Error("Не вдалося завантажити модуль Excel. Перевірте інтернет."));document.head.appendChild(sc)})},
xRow(p){const c=catOf(p.cat);return{"ID":p.id,"SKU":p.sku||"","Name":p.name,"Category":c?c.name:"","Price":+p.price||0,"Old price":p.oldPrice==null?"":+p.oldPrice,"Stock":+p.stock||0,"Active":p.active?"yes":"no","Featured":p.featured?"yes":"no","Short description":p.short||"","Description":p.desc||"","Specs":(p.specs||[]).filter(x=>x[0]||x[1]).map(x=>x[0]+": "+x[1]).join("; "),"Options":(p.options||[]).map(o=>o.name+": "+(o.values||[]).join(", ")).join(" | "),"Images":(p.images||[]).filter(u=>!String(u).startsWith("data:")).join(" ")}},
xWidths(){return [10,12,34,18,9,10,8,8,9,40,60,45,40,60].map(w=>({wch:w}))},
async xlsExport(){try{toast("Готую файл…");const X=await this.loadXLSX();const ws=X.utils.json_to_sheet(S.products.map(p=>this.xRow(p)),{header:this.XCOLS});ws["!cols"]=this.xWidths();const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,"Products");X.writeFile(wb,"cozyhousevibe-products-"+new Date().toISOString().slice(0,10)+".xlsx");toast("Файл завантажено ✓")}catch(e){toast("⚠️ "+e.message)}},
async xlsTemplate(){try{const X=await this.loadXLSX();const ex={"ID":"","SKU":"CHV-200","Name":"Linen Table Runner 14×72\"","Category":"Textiles","Price":34,"Old price":"","Stock":12,"Active":"yes","Featured":"no","Short description":"Stonewashed linen, soft and textured.","Description":"A natural linen runner that softens any table.","Specs":"Material: 100% linen; Size: 14 × 72 in; Care: Machine wash cold","Options":"Color: Natural, Sage, Terracotta","Images":"https://example.com/runner-1.jpg https://example.com/runner-2.jpg"};
 const ws=X.utils.json_to_sheet([ex],{header:this.XCOLS});ws["!cols"]=this.xWidths();
 const help=[["Колонка","Що вписувати"],["ID","Залиште порожнім для нових товарів. Для оновлення — не змінюйте (береться з експорту)."],["SKU","Артикул. Якщо ID порожній, товар шукається за артикулом; не знайдено — створюється новий."],["Name","Назва англійською. Обов'язково для нових."],["Category","Назва категорії, напр. Textiles. Якщо такої немає — буде створена."],["Price","Ціна в $, напр. 34 або 34.99. Обов'язково для нових."],["Old price","Стара ціна для знижки або порожньо."],["Stock","Залишок, шт."],["Active","yes / no — показувати на сайті (для нових за замовчуванням yes)."],["Featured","yes / no — хіт продажів на головній."],["Short description","Один рядок під назвою."],["Description","Повний опис."],["Specs","Характеристики через «;» у форматі Назва: значення. Напр.: Material: Ceramic; Height: 9.5 in"],["Options","Варіанти через «|», значення через кому. Напр.: Color: Sage, Oat | Size: S, M"],["Images","Посилання на фото (https://…) через пробіл. Перше — головне. Фото з комп'ютера додавайте в редакторі товару."],["",""],["Порожня клітинка","Для існуючих товарів порожня клітинка = не змінювати це поле."]];
 const ws2=X.utils.aoa_to_sheet(help);ws2["!cols"]=[{wch:20},{wch:110}];const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,"Products");X.utils.book_append_sheet(wb,ws2,"Інструкція");X.writeFile(wb,"cozyhousevibe-template.xlsx")}catch(e){toast("⚠️ "+e.message)}},
impHelp(){const b=$("#impBox");if(b&&!this.impPlan)b.innerHTML=`<div class="panel impbox"><b>Імпорт товарів з Excel</b><p class="small" style="margin:6px 0 10px">Підходять файли .xlsx, .xls, .csv (Excel, Google Таблиці, Numbers). Найпростіше: зробіть «⬇ Експорт в Excel», змініть ціни чи залишки й завантажте файл назад. Для нових товарів — <button class="linkbtn" data-act="a:xlsTemplate">завантажте шаблон</button>. Перед збереженням ви побачите, що саме зміниться.</p><button class="btn sm ghost" data-act="a:impCancel">Закрити</button></div>`},
async xlsImport(file){const box=$("#impBox");box.innerHTML=`<div class="panel impbox"><p class="muted">Читаю файл «${esc(file.name)}»…</p></div>`;
 try{if(file.size>8*1024*1024)throw new Error("Файл завеликий (більше 8 МБ).");const X=await this.loadXLSX();const wb=X.read(await file.arrayBuffer(),{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const rows=X.utils.sheet_to_json(ws,{defval:"",raw:true});
  if(!rows.length)throw new Error("У першому аркуші немає рядків з товарами.");this.impPlan=this.impBuild(rows);this.impShow(file.name)}
 catch(e){this.impPlan=null;box.innerHTML=`<div class="panel impbox"><div class="note">⚠️ ${esc(e.message||String(e))}</div><button class="btn sm" data-act="a:impCancel" style="margin-top:10px">Закрити</button></div>`}},
impBuild(rows){
 const A={id:["id"],sku:["sku","артикул"],name:["name","назва","title"],cat:["category","категорія","категория"],price:["price","ціна","цена"],oldPrice:["old price","oldprice","стара ціна","compare at price"],stock:["stock","залишок","кількість","qty","quantity"],active:["active","на сайті","visible","показувати"],featured:["featured","хіт","bestseller"],short:["short description","короткий опис","short"],desc:["description","опис","повний опис"],specs:["specs","характеристики","specifications"],options:["options","варіанти","variants"],images:["images","фото","image","photos"]};
 const keys=Object.keys(rows[0]),col={};for(const f in A){const k=keys.find(h=>A[f].includes(String(h).trim().toLowerCase()));if(k!==undefined)col[f]=k}
 if(!col.name&&!col.sku&&!col.id)throw new Error("Не знайдено колонок Name / SKU / ID. Використайте шаблон або файл експорту.");
 const txt=v=>String(v??"").trim(),num=v=>{const s=txt(v).replace(/\s/g,"").replace(",",".").replace(/[^0-9.\-]/g,"");return s===""?null:Number(s)},bool=v=>{const s=txt(v).toLowerCase();if(!s)return undefined;if(["yes","y","так","true","1","+","да"].includes(s))return true;if(["no","n","ні","false","0","-","нет"].includes(s))return false;return undefined};
 const plan={create:[],update:[],errors:[],newCats:[],skipped:0},catByName=n=>{n=n.toLowerCase();return S.categories.find(c=>c.name.toLowerCase()===n||c.id===n)||plan.newCats.find(c=>c.name.toLowerCase()===n)};
 const seen=new Set();
 rows.forEach((r,i)=>{const line=i+2,g=f=>col[f]!==undefined?r[col[f]]:"";
  if(Object.values(r).every(v=>txt(v)==="")){plan.skipped++;return}
  const id=txt(g("id")),sku=txt(g("sku"));let p=id?prod(id):null;if(!p&&sku)p=S.products.find(x=>(x.sku||"").toLowerCase()===sku.toLowerCase());
  const key=p?p.id:"sku:"+sku.toLowerCase()+":"+line;if(p&&seen.has(p.id)){plan.errors.push(`Рядок ${line}: товар «${p.name}» уже є вище у файлі — рядок пропущено.`);return}if(p)seen.add(p.id);
  const d={},err=[];
  if(txt(g("name")))d.name=txt(g("name")).slice(0,200);
  if(sku)d.sku=sku.slice(0,60);
  const pr=num(g("price"));if(txt(g("price"))!==""){if(pr==null||isNaN(pr)||pr<0)err.push("неправильна ціна");else d.price=Math.round(pr*100)/100}
  if(txt(g("oldPrice"))!==""){const op=num(g("oldPrice"));if(op==null||isNaN(op)||op<0)err.push("неправильна стара ціна");else d.oldPrice=Math.round(op*100)/100}
  if(txt(g("stock"))!==""){const st=num(g("stock"));if(st==null||isNaN(st)||st<0)err.push("неправильний залишок");else d.stock=Math.round(st)}
  const ac=bool(g("active"));if(ac!==undefined)d.active=ac;const fe=bool(g("featured"));if(fe!==undefined)d.featured=fe;
  if(txt(g("short")))d.short=txt(g("short")).slice(0,180);if(txt(g("desc")))d.desc=txt(g("desc")).slice(0,20000);
  if(txt(g("specs")))d.specs=txt(g("specs")).split(/[;\n]+/).map(x=>{const k=x.indexOf(":");return k<0?[x.trim(),""]:[x.slice(0,k).trim(),x.slice(k+1).trim()]}).filter(x=>x[0]||x[1]).slice(0,30);
  if(txt(g("options")))d.options=txt(g("options")).split(/[|\n]+/).map(x=>{const k=x.indexOf(":");if(k<0)return null;return{name:x.slice(0,k).trim().slice(0,40),values:[...new Set(x.slice(k+1).split(",").map(v=>v.trim().slice(0,40)).filter(Boolean))].slice(0,20)}}).filter(o=>o&&o.name&&o.values.length).slice(0,5);
  if(txt(g("images")))d.images=txt(g("images")).split(/[\s,]+/).filter(u=>/^(https?:\/\/|images\/)/.test(u)).slice(0,12);
  const cn=txt(g("cat"));if(cn){let c=catByName(cn);if(!c){let cid=translit(cn)||uid();if(catOf(cid)||plan.newCats.some(x=>x.id===cid))cid+="-"+uid().slice(0,3);c={id:cid,name:cn.slice(0,80),image:""};plan.newCats.push(c)}d.cat=c.id}
  if(!p){if(!d.name)err.push("немає назви (Name)");if(d.price==null)err.push("немає ціни (Price)")}
  if(err.length){plan.errors.push(`Рядок ${line}${d.name||p?` («${esc(d.name||p.name)}»)`:""}: ${err.join(", ")} — рядок пропущено.`);return}
  if(p){const ch=Object.keys(d).filter(k=>JSON.stringify(d[k])!==JSON.stringify(p[k]));if(ch.length)plan.update.push({id:p.id,line,data:Object.fromEntries(ch.map(k=>[k,d[k]])),name:p.name});else plan.skipped++}
  else plan.create.push({line,data:d})});
 plan.newCats=plan.newCats.filter(c=>plan.create.some(x=>x.data.cat===c.id)||plan.update.some(x=>x.data.cat===c.id));
 return plan},
impShow(fname){const P=this.impPlan,L={name:"назва",sku:"артикул",price:"ціна",oldPrice:"стара ціна",stock:"залишок",active:"на сайті",featured:"хіт",short:"короткий опис",desc:"опис",specs:"характеристики",options:"варіанти",images:"фото",cat:"категорія"};
 const fmt=(k,v)=>k==="price"||k==="oldPrice"?(v==null?"—":money(v)):k==="active"||k==="featured"?(v?"так":"ні"):k==="cat"?esc((catOf(v)||P.newCats.find(c=>c.id===v)||{}).name||v):k==="specs"||k==="options"||k==="images"?(v.length+" шт."):esc(String(v).slice(0,40));
 const ok=P.create.length+P.update.length;
 $("#impBox").innerHTML=`<div class="panel impbox"><h2 style="margin:0 0 6px">Перевірка імпорту: ${esc(fname)}</h2>
 <div class="impstats"><span class="okc">➕ Нових товарів: <b>${P.create.length}</b></span><span>✏️ Оновлень: <b>${P.update.length}</b></span>${P.newCats.length?`<span>🗂 Нових категорій: <b>${P.newCats.length}</b> (${P.newCats.map(c=>esc(c.name)).join(", ")})</span>`:""}<span class="muted">Без змін: ${P.skipped}</span>${P.errors.length?`<span class="errc">⚠️ Помилок: <b>${P.errors.length}</b></span>`:""}</div>
 ${P.errors.length?`<div class="note" style="margin:10px 0"><b>Ці рядки не будуть імпортовані:</b><br>${P.errors.slice(0,30).join("<br>")}${P.errors.length>30?"<br>…":""}</div>`:""}
 ${ok?`<div class="tablewrap" style="max-height:340px;overflow:auto;margin:10px 0"><table class="t"><thead><tr><th>Рядок</th><th>Дія</th><th>Товар</th><th>Що зміниться</th></tr></thead><tbody>
 ${P.create.slice(0,200).map(x=>`<tr><td>${x.line}</td><td><span class="stk newp">новий</span></td><td><b>${esc(x.data.name)}</b></td><td class="small">${money(x.data.price)}${x.data.stock!=null?` · ${x.data.stock} шт.`:""}${x.data.cat?" · "+fmt("cat",x.data.cat):""}</td></tr>`).join("")}
 ${P.update.slice(0,300).map(x=>{const p=prod(x.id);return `<tr><td>${x.line}</td><td><span class="stk upd">оновити</span></td><td><b>${esc(x.name)}</b></td><td class="small">${Object.keys(x.data).map(k=>`${L[k]||k}: ${["specs","options","images","desc","short"].includes(k)?fmt(k,x.data[k]):`${fmt(k,p[k])} → <b>${fmt(k,x.data[k])}</b>`}`).join("<br>")}</td></tr>`}).join("")}
 </tbody></table></div>`:`<p class="muted">Немає змін для збереження.</p>`}
 <div class="acts">${ok?`<button class="btn primary" data-act="a:impApply">Зберегти ${ok} ${ok===1?"зміну":"змін"}</button>`:""}<button class="btn" data-act="a:impCancel">Скасувати</button></div></div>`},
impApply(){const P=this.impPlan;if(!P)return;
 P.newCats.forEach(c=>{if(!catOf(c.id))S.categories.push(c)});
 P.create.forEach(x=>S.products.push({id:uid(),created:Date.now(),sku:"",cat:"",oldPrice:null,stock:0,active:true,featured:false,short:"",desc:"",specs:[],options:[],images:[],...x.data}));
 P.update.forEach(x=>{const p=prod(x.id);if(p)Object.assign(p,x.data)});
 const n=P.create.length+P.update.length;this.impPlan=null;save();chrome();render();toast(`Імпортовано: ${n}. Зберігаю в базу…`)},
/* ---- product editor ---- */
editor(id){
 const isNew=id==="new",p=isNew?null:prod(id);if(!isNew&&!p)return `<div class="empty"><b>Товар не знайдено</b></div>`;
 if(!this.draft||this.draft._for!==id)this.draft={_for:id,images:p?[...(p.images||[])]:[]};
 const v=p||{name:"",sku:"CHV-"+(100+S.products.length+Math.floor(Math.random()*90)),cat:(S.categories[0]||{}).id||"",price:"",oldPrice:"",stock:10,active:true,featured:false,short:"",desc:"",specs:[["",""]]};
 return `<div class="ahead"><div><div class="crumbs"><a href="#/admin/products">← Товари</a></div><h1>${isNew?"Новий товар":esc(p.name)}</h1></div>${isNew?"":`<a class="btn" href="#/product/${p.id}">Переглянути на сайті ↗</a>`}</div>
 <form data-form="product" class="editor" novalidate><div>
 <div class="panel"><h2>Основне</h2><div class="form">
 <div class="full"><label>Назва товару <span class="req">*</span></label><input class="field" name="name" value="${esc(v.name)}" required></div>
 <div class="full"><label>Короткий опис</label><input class="field" name="short" value="${esc(v.short)}" maxlength="180"><div class="help">Один рядок під назвою товару.</div></div>
 <div class="full"><label>Повний опис</label><textarea class="field" name="desc" style="min-height:160px">${esc(v.desc)}</textarea><div class="help">Порожній рядок — новий абзац.</div></div></div></div>
 <div class="panel"><h2>Фото</h2><div id="imgs">${this.imgsHtml()}</div>
 <label class="drop" id="drop"><input type="file" id="imgFile" accept="image/*" multiple hidden>📷 <b>Натисніть або перетягніть фото сюди</b><br><span class="small">JPG, PNG, WebP · можна кілька одразу · фото автоматично зменшуються</span></label>
 <div style="display:flex;gap:8px;margin-top:10px"><input class="field" id="imgUrl" placeholder="…або вставте посилання на фото (https://…)"><button class="btn" type="button" data-act="a:imgurl">Додати</button></div></div>
 <div class="panel"><h2>Варіанти (колір, розмір)</h2><p class="help" style="margin-top:-6px">Покупець обов’язково обирає кожен параметр перед покупкою. Значення — через кому. Залишок спільний для всіх варіантів.</p><div id="opts">${(p&&p.options||[]).map(o=>this.optRow(o)).join("")}</div><button class="btn sm" type="button" data-act="a:optadd">+ Додати параметр</button></div>
 <div class="panel"><h2>Характеристики</h2><div id="specs">${(v.specs&&v.specs.length?v.specs:[["",""]]).map(s=>this.specRow(s)).join("")}</div><button class="btn sm" type="button" data-act="a:specadd">+ Додати рядок</button></div></div>
 <div><div class="panel"><h2>Ціна й наявність</h2><div class="stack">
 <div><label class="lbl">Ціна, ${esc(S.settings.currency)} <span class="req">*</span></label><input class="field" name="price" type="number" min="0" step="0.01" value="${v.price}" required></div>
 <div><label class="lbl">Стара ціна (для знижки)</label><input class="field" name="oldPrice" type="number" min="0" step="0.01" value="${v.oldPrice||""}" placeholder="Залиште порожнім, якщо знижки немає"></div>
 <div><label class="lbl">Залишок, шт.</label><input class="field" name="stock" type="number" min="0" step="1" value="${v.stock}"><div class="help">0 — «Немає в наявності», купити не можна.</div></div>
 <div><label class="lbl">Код товару (SKU)</label><input class="field" name="sku" value="${esc(v.sku||"")}"></div>
 <div><label class="lbl">Категорія</label><select class="field" name="cat"><option value="">— без категорії —</option>${S.categories.map(c=>`<option value="${c.id}" ${v.cat===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div>
 <label class="check"><input type="checkbox" name="active" ${v.active?"checked":""}> Показувати на сайті</label>
 <label class="check"><input type="checkbox" name="featured" ${v.featured?"checked":""}> Хіт продажів (на головній)</label></div></div>
 <div class="panel"><div id="pErr"></div><button class="btn primary block">${isNew?"Створити товар":"Зберегти зміни"}</button>${isNew?"":`<button type="button" class="btn danger block" style="margin-top:8px" data-act="a:del" data-id="${p.id}">Видалити товар</button>`}<a class="btn ghost block" style="margin-top:8px" href="#/admin/products">Скасувати</a></div></div></form>`},
imgsHtml(){const I=this.draft.images;return I.length?`<div class="imgs">${I.map((s,i)=>`<div class="imgbox"><img src="${esc(s)}" alt="">${i?"":`<span class="main-l">Головне</span>`}<div class="tools"><span><button type="button" data-act="a:imgmv" data-i="${i}" data-d="-1" title="Лівіше">←</button> <button type="button" data-act="a:imgmv" data-i="${i}" data-d="1" title="Правіше">→</button></span><button type="button" data-act="a:imgdel" data-i="${i}" title="Видалити">✕</button></div></div>`).join("")}</div><p class="help" style="margin-top:-4px">Перше фото — головне (показується в каталозі). Стрілками змінюйте порядок.</p>`:`<p class="muted small">Фото ще немає.</p>`},
optRow(o){return `<div class="specrow"><input class="field" name="on" value="${esc(o.name)}" placeholder="Напр.: Color" style="max-width:160px"><input class="field" name="ov" value="${esc((o.values||[]).join(", "))}" placeholder="Напр.: Sage, Oat, Terracotta"><button type="button" class="btn sm" data-act="a:optdel">✕</button></div>`},
specRow(s){return `<div class="specrow"><input class="field" name="sk" value="${esc(s[0])}" placeholder="Напр.: Матеріал"><input class="field" name="sv" value="${esc(s[1])}" placeholder="Напр.: Кераміка"><button type="button" class="btn sm" data-act="a:specdel">✕</button></div>`},
async addFiles(files){const arr=[...files].filter(f=>f.type.startsWith("image/"));if(!arr.length)return;toast("Обробка фото…");for(const f of arr){try{this.draft.images.push(await toDataURL(f,1400))}catch(e){toast("Не вдалося відкрити "+f.name)}}$("#imgs").innerHTML=this.imgsHtml();toast("Фото додано: "+arr.length)},
/* ---- categories ---- */
categories(){return `<div class="ahead"><h1>Категорії</h1></div>
 <form class="panel" data-form="catadd" style="display:flex;gap:10px;margin-bottom:18px;padding:16px"><input class="field" name="name" placeholder="Назва нової категорії" required><button class="btn primary">Додати</button></form>
 <div class="tablewrap"><table class="t" style="min-width:600px"><thead><tr><th>Фото</th><th>Назва</th><th>Товарів</th><th></th></tr></thead><tbody>
 ${S.categories.map((c,i)=>`<tr><td><img src="${esc(catImg(c))}" alt=""></td><td><input class="field" value="${esc(c.name)}" data-ach="catname" data-id="${c.id}"></td><td>${S.products.filter(p=>p.cat===c.id).length}</td>
 <td><div class="acts"><button class="btn sm" data-act="a:catmv" data-i="${i}" data-d="-1" title="Вище">↑</button><button class="btn sm" data-act="a:catmv" data-i="${i}" data-d="1" title="Нижче">↓</button><label class="btn sm">Фото<input type="file" accept="image/*" hidden data-up="${c.id}"></label>${c.image?`<button class="btn sm" data-act="a:catimgdel" data-id="${c.id}">Скинути фото</button>`:""}<button class="btn sm danger" data-act="a:catdel" data-id="${c.id}">✕</button></div></td></tr>`).join("")}
 </tbody></table></div><p class="help">Якщо фото категорії не задано, береться фото першого товару з неї. Порядок тут = порядок на сайті.</p>`},
/* ---- settings ---- */
tgPanel(){setTimeout(()=>this.tgStatus(),0);return `<div class="panel" id="tgPanel"><h2>🔔 Сповіщення про нові замовлення в Telegram</h2><div id="tgState" class="muted">Перевірка…</div>
 <ol class="steps" style="margin-top:14px">
 <li>У Telegram відкрийте <b>@BotFather</b> → надішліть <code>/newbot</code> → придумайте назву (напр. «CozyHouseVibe Orders») і username, що закінчується на <code>bot</code>. BotFather надішле <b>токен</b> — довгий рядок вигляду <code>123456789:AA…</code>.</li>
 <li>Вставте токен сюди й збережіть. Він зберігається зашифрованим у базі й більше ніде не показується.
 <form data-form="tgToken" style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap" autocomplete="off"><input class="field" name="token" type="password" placeholder="123456789:AA…" style="flex:1;min-width:220px" autocomplete="off"><button class="btn">Зберегти токен</button></form></li>
 <li>Відкрийте свого нового бота в Telegram і надішліть йому будь-яке повідомлення, напр. <code>/start</code>.</li>
 <li>Натисніть <button class="btn sm primary" data-act="a:tgLink">Підключити</button> — бот надішле вам тестове повідомлення.</li></ol></div>`},
async tgStatus(){const el=$("#tgState");if(!el)return;const{data,error}=await sb.rpc("seller_telegram_status");if(!$("#tgState"))return;
 if(error){el.innerHTML=`<span class="note">${esc(error.message)}</span>`;return}
 el.innerHTML=data.enabled?`<span class="okbox" style="display:inline-block">✅ Підключено${data.chat?` — чат <b>${esc(data.chat)}</b>`:""}. Кожне нове замовлення приходитиме в Telegram.</span> <button class="btn sm" data-act="a:tgOff">Вимкнути</button>`:data.token_set?`Токен збережено. Залишились кроки 3 і 4.`:`Не підключено.`},
settings(){const s=S.settings;const f=(k,l,o={})=>`<div class="${o.full?"full":""}"><label>${l}</label>${o.area?`<textarea class="field" name="${k}" style="min-height:${o.h||110}px">${esc(s[k])}</textarea>`:`<input class="field" name="${k}" type="${o.type||"text"}" value="${esc(s[k])}" placeholder="${esc(o.ph||"")}">`}${o.help?`<div class="help">${o.help}</div>`:""}</div>`;
 return `<div class="ahead"><h1>Налаштування</h1></div>${this.tgPanel()}<div style="height:20px"></div><form data-form="settings" class="stack">
 <div class="panel"><h2>Магазин</h2><div class="form">${f("name","Назва магазину")}${f("tagline","Підзаголовок")}${f("currency","Символ валюти",{ph:"₴ або $"})}
 <div><label>Позиція валюти</label><select class="field" name="currencyPos"><option value="after" ${s.currencyPos!=="before"?"selected":""}>Після суми: 890 ₴</option><option value="before" ${s.currencyPos==="before"?"selected":""}>Перед сумою: $890</option></select></div>
</div>
 ${f("freeFrom","Безкоштовна доставка від (сума)",{type:"number",help:"0 — не показувати."})}${f("lowStock","Поріг «закінчується», шт.",{type:"number",ph:"3",help:"Товари з таким або меншим залишком підсвічуються, а в Telegram приходить сповіщення."})}${f("promo","Текст у верхній смузі",{full:true,help:"Порожньо — смуга прихована."})}</div></div>
 <div class="panel"><h2>Головна сторінка</h2><div class="form">${f("heroEyebrow","Надпис над заголовком",{full:true})}${f("heroTitle","Великий заголовок",{full:true})}${f("heroText","Текст під заголовком",{full:true,area:true,h:80})}
 <div class="full"><input type="hidden" name="heroButtons" value=""><label class="check"><input type="checkbox" name="heroButtons" value="1" ${s.heroButtons==="1"?"checked":""}> Показувати кнопки на банері</label><div class="help">Без кнопок увесь банер клікабельний і веде туди, куди вказано нижче.</div></div>${f("heroBtnText","Текст кнопки",{ph:"Shop now"})}<div><label>Куди веде кнопка</label><select class="field" name="heroBtnLink"><option value="#/shop">Усі товари</option>${S.categories.map(c=>`<option value="#/shop?cat=${c.id}" ${s.heroBtnLink==="#/shop?cat="+c.id?"selected":""}>Категорія: ${esc(c.name)}</option>`).join("")}<option value="#/shop?sort=new" ${s.heroBtnLink==="#/shop?sort=new"?"selected":""}>Новинки</option><option value="#/about" ${s.heroBtnLink==="#/about"?"selected":""}>Our story</option></select></div>
 <div class="full"><label>Фото банера для комп'ютера</label><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><img src="${esc(s.heroImage||PHOTO.hero)}" style="width:200px;height:90px;object-fit:cover;border-radius:10px;object-position:${esc(s.heroFocus||"center")}"><label class="btn sm">Завантажити фото<input type="file" accept="image/*" hidden data-up="hero"></label>${s.heroImage?`<button type="button" class="btn sm" data-act="a:herodel">Прибрати</button>`:""}</div><div class="help">Широке горизонтальне фото, найкраще 2400×1200 px або більше. Ліва частина фото буде під текстом — там має бути спокійний фон.</div></div>
 <div class="full"><label>Фото банера для телефона (необов'язково)</label><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><img src="${esc(s.heroImageMobile||s.heroImage||PHOTO.hero)}" style="width:70px;height:90px;object-fit:cover;border-radius:10px"><label class="btn sm">Завантажити фото<input type="file" accept="image/*" hidden data-up="heroMobile"></label>${s.heroImageMobile?`<button type="button" class="btn sm" data-act="a:heromdel">Прибрати</button>`:""}</div><div class="help">Вертикальне фото (наприклад, 1080×1350). Якщо не завантажити — на телефоні буде фото для комп'ютера.</div></div>
 <div><label>Головна точка фото</label><select class="field" name="heroFocus">${[["center","По центру"],["left center","Ліва частина"],["right center","Права частина"],["center top","Верх"],["center bottom","Низ"]].map(([v,l])=>`<option value="${v}" ${(s.heroFocus||"center")===v?"selected":""}>${l}</option>`).join("")}</select><div class="help">Яку частину фото не обрізати на різних екранах.</div></div></div></div>
 <div class="panel"><h2>Контакти</h2><div class="form">${f("phone","Телефон")}${f("address","Адреса (у футері й на сторінці Contacts)",{full:true,area:true,h:70})}${f("email","Email для замовлень")}${f("telegram","Telegram (username)",{ph:"@yourshop"})}${f("viber","Viber (номер)",{ph:"+380…"})}${f("instagram","Instagram",{ph:"@yourshop"})}${f("hours","Графік роботи",{full:true,help:"Показується внизу сайту й на сторінці «Контакти»."})}</div></div>
 <div class="panel"><h2>Замовлення</h2><div class="form">${f("deliveryOptions","Способи доставки",{area:true,help:"Кожен з нового рядка."})}${f("paymentOptions","Способи оплати",{area:true,help:"Кожен з нового рядка."})}
 ${f("formEndpoint","Автоматичне надсилання замовлень (необов'язково)",{full:true,ph:"https://formspree.io/f/xxxxxxx",help:"Без цього покупець після оформлення сам надсилає вам готовий текст замовлення в Telegram / на email. Якщо створити безкоштовну форму на formspree.io і вставити сюди її адресу — замовлення приходитимуть вам на пошту автоматично."})}</div></div>
 <div class="panel"><h2>Сторінки</h2><div class="form">${f("deliveryText","«Shipping & payment» (доставка й оплата)",{full:true,area:true,h:180})}</div></div>
 <div class="panel"><h2>Історія бренду (сторінка «Our story»)</h2><div class="form">${f("aboutTitle","Заголовок",{full:true})}${f("aboutIntro","Вступ під заголовком",{full:true,area:true,h:70})}${f("aboutStory","Історія",{full:true,area:true,h:220,help:"Порожній рядок — новий абзац."})}${f("aboutValues","Цінності (блоки з іконками)",{full:true,area:true,h:130,help:"Кожен з нового рядка у форматі: іконка | заголовок | текст"})}${f("aboutCta","Заклик внизу сторінки",{full:true})}</div></div>
 <div class="panel"><h2>Юридичні сторінки</h2><div class="note" style="margin-bottom:12px">Це шаблони для США. Замініть <b>[Business legal name]</b> і <b>[State]</b> на свої дані й за можливості покажіть тексти юристу. <b>{store}</b>, <b>{email}</b> і <b>{address}</b> підставляються автоматично (назва магазину, email і адреса з «Контактів»).</div><div class="form">${f("returnsText","Returns & Refunds (повернення)",{full:true,area:true,h:220})}${f("privacyText","Privacy Policy (конфіденційність)",{full:true,area:true,h:220})}${f("termsText","Terms of Service (умови)",{full:true,area:true,h:220})}<div class="full help">Форматування: рядок «## Заголовок» — підзаголовок, рядки з «- » — список, **текст** — жирний.</div></div></div>
 <div style="position:sticky;bottom:12px"><button class="btn primary" style="padding:14px 26px;box-shadow:var(--shadow)">Зберегти налаштування</button></div></form>`},
/* ---- publish & backup ---- */
backup(){return `<div class="ahead"><h1>Резервні копії</h1></div>
 <div class="panel" style="margin-bottom:20px"><h2>💾 Зберегти копію</h2><p>Усі товари, категорії й налаштування в одному файлі (.json). Корисно мати копію перед великими змінами.</p><button class="btn" data-act="a:export">⬇ Завантажити копію (.json)</button></div>
 <div class="panel"><h2>⬆ Відновити з копії</h2><p class="muted">Замінить поточні товари, категорії й налаштування даними з файлу. Замовлення не зачіпаються.</p><label class="btn">Вибрати файл…<input type="file" id="importFile" accept=".json,application/json" hidden></label></div>`},
orders(q){const st=q.get("status")||"ship";
 const chips=[["ship","📦 Потребують відправлення"],["unpaid","💳 Не оплачені"],["","Усі"],...Object.entries(Admin.ST)];
 setTimeout(()=>this.fillOrders(st),0);
 return `<div class="ahead"><h1>Замовлення</h1><button class="btn sm" data-act="a:reloadOrders">↻ Оновити</button></div>
 <div class="chips">${chips.map(([k,v])=>`<a class="chip ${st===k?"on":""}" href="#/admin/orders${k===""?"?status=all":k==="ship"?"":"?status="+k}">${v}</a>`).join("")}</div>
 <div class="shopbar"><label class="search">${ICON.search}<input id="ordSearch" placeholder="Пошук: номер, ім’я, телефон, email або код товару" autocomplete="off"></label></div>
 <div id="ordList"><p class="muted">Завантаження…</p></div>`},
ST:{new:"Нове",confirmed:"Підтверджене",shipped:"Відправлене",completed:"Виконане",cancelled:"Скасоване",returned:"Повернення"},
RREASONS:["Пошкоджено при доставці","Не той товар","Не відповідає опису","Передумав(ла)","Інше"],
CARRIERS:["USPS","UPS","FedEx","DHL","Інший"],
etaDefault(o){const c=o.customer||{},n=/express/i.test(c.delivery||"")?2:5,d=new Date();let k=0;while(k<n){d.setDate(d.getDate()+1);if(d.getDay()%6)k++}return d.toISOString().slice(0,10)},
day(s){if(!s)return"";const[y,m,d]=String(s).slice(0,10).split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("uk-UA",{weekday:"short",day:"2-digit",month:"2-digit"})},
ordersData:[],
async fillOrders(st){const box=$("#ordList");if(!box)return;
 let qq=sb.from("orders").select("*").order("created_at",{ascending:false}).limit(500);
 if(st==="unpaid")qq=qq.eq("payment_status","unpaid").not("status","in","(cancelled,returned)");else if(st==="ship")qq=qq.in("status",["new","confirmed"]);else if(st&&st!=="all")qq=qq.eq("status",st);
 const{data,error}=await qq;if(error){box.innerHTML=`<div class="note">Не вдалося завантажити: ${esc(error.message)}</div>`;return}
 this.ordersData=data;this.renderOrders();
 const inp=$("#ordSearch");if(inp&&!inp.dataset.ready){inp.dataset.ready=1;inp.addEventListener("input",()=>this.renderOrders());const pq=sessionStorage.getItem("ordQ");if(pq){sessionStorage.removeItem("ordQ");inp.value=pq;this.renderOrders()}}},
renderOrders(){const box=$("#ordList");if(!box)return;
 const term=(($("#ordSearch")||{}).value||"").trim().toLowerCase();
 const data=this.ordersData.filter(o=>{if(!term)return true;const c=o.customer||{};return [o.order_no,c.name,c.phone,c.email,String(c.phone||"").replace(/\D/g,""),...(o.items||[]).map(i=>i.sku)].some(v=>String(v||"").toLowerCase().includes(term))});
 if(!data.length){box.innerHTML=`<div class="empty"><b>${term?"Нічого не знайдено":"Тут порожньо"}</b>${term?"Спробуйте інший запит.":"Немає замовлень із таким статусом."}</div>`;return}
 box.innerHTML=`<div class="tablewrap"><table class="t"><thead><tr><th>Номер</th><th>Дата</th><th>Покупець</th><th>Товари</th><th>Сума</th><th>Статус</th><th></th></tr></thead><tbody>${data.map(o=>{const c=o.customer||{};const canShip=o.status==="new"||o.status==="confirmed",canRet=o.status==="shipped"||o.status==="completed";return `<tr>
 <td><a class="textlink" href="#/admin/order/${o.id}"><b>${esc(o.order_no)}</b></a><br><small class="muted">${o.user_id?"з акаунтом":"гість"}</small><br>${Admin.payPill(o)}${o.admin_note?` <span title="${esc(o.admin_note)}">📝</span>`:""}</td>
 <td class="small">${new Date(o.created_at).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td>
 <td><details><summary><b>${esc(c.name||"—")}</b></summary><div class="small" style="margin-top:6px;line-height:1.6">${c.phone?`📞 <a href="tel:${esc(String(c.phone).replace(/[^+\d]/g,""))}">${esc(c.phone)}</a><br>`:""}${c.email?`✉️ ${esc(c.email)}<br>`:""}🚚 ${esc(c.delivery||"")}<br>📍 ${esc([c.address,c.city,c.state,c.zip].filter(Boolean).join(", "))}<br>💳 ${esc(c.payment||"")}${c.comment?`<br>💬 ${esc(c.comment)}`:""}</div></details></td>
 <td class="small">${(o.items||[]).map(i=>`${esc(i.name)}${i.opt?` <span class="muted">(${esc(optStr(i.opt,prod(i.id)))})</span>`:""} × ${+i.qty||0}`).join("<br>")}</td>
 <td><b>${money(o.total)}</b></td>
 <td><select class="field" style="min-width:140px" data-ach="ostatus" data-id="${o.id}">${Object.entries(Admin.ST).filter(([k])=>k!=="returned"||o.status==="returned").map(([k,v])=>`<option value="${k}" ${o.status===k?"selected":""}>${v}</option>`).join("")}</select>${o.status==="returned"&&o.return_reason?`<div class="small" style="margin-top:4px;color:#9a3d2a">↩ ${esc(o.return_reason)}</div>`:""}${o.tracking_number||o.carrier?`<div class="small" style="margin-top:4px">${esc(o.carrier||"")}${o.tracking_number?` · ${trackUrl(o.carrier,o.tracking_number)?`<a class="textlink" href="${esc(trackUrl(o.carrier,o.tracking_number))}" target="_blank" rel="noopener">${esc(o.tracking_number)}</a>`:esc(o.tracking_number)+' <span class="muted">(не відстежується)</span>'}`:""}</div>`:""}
 ${o.status==="completed"&&o.delivered_at?`<div class="small" style="margin-top:4px;color:#3f7a4d">✓ Доставлено ${Admin.day(o.delivered_at)}</div>`:""}
 ${["confirmed","shipped"].includes(o.status)||o.delivery_eta&&o.status!=="completed"?`<label class="small etarow" style="margin-top:6px">📅 Очікувана доставка<input type="date" class="field" value="${esc(o.delivery_eta||"")}" min="${new Date().toISOString().slice(0,10)}" data-ach="oeta" data-id="${o.id}"></label>`:""}</td>
 <td><div class="acts">${canShip?`<button class="btn sm primary" data-act="a:shipForm" data-id="${o.id}">📦 Відправити</button>`:""}${canRet?`<button class="btn sm" data-act="a:retForm" data-id="${o.id}">↩ Повернення</button>`:""}<button class="btn sm" data-act="a:slip" data-id="${o.id}" title="Пакувальний лист">🖨</button></div></td></tr>
 <tr class="shiprow" id="ship-${o.id}" hidden><td colspan="7"><form class="shipform" data-form="ship" data-id="${o.id}"><b>Відправлення ${esc(o.order_no)}</b>
 <select class="field" name="carrier" data-ach="carrierpick">${Admin.CARRIERS.map(x=>`<option ${o.carrier===x||(x==="Інший"&&o.carrier&&!Admin.CARRIERS.includes(o.carrier))?"selected":""}>${x}</option>`).join("")}</select>
 <input class="field" name="carrier_other" placeholder="Назва служби доставки" value="${esc(o.carrier&&!Admin.CARRIERS.includes(o.carrier)?o.carrier:"")}" maxlength="40" autocomplete="off" ${o.carrier&&!Admin.CARRIERS.includes(o.carrier)?"":"hidden"}>
 <input class="field" name="tracking" placeholder="Трек-номер (або внутрішній номер)" value="${esc(o.tracking_number||"")}" maxlength="80" autocomplete="off">
 <label class="small etarow">📅 Очікувана дата доставки<input class="field" type="date" name="eta" value="${esc(o.delivery_eta||Admin.etaDefault(o))}" min="${new Date().toISOString().slice(0,10)}"></label>
 <button class="btn primary sm">Позначити відправленим</button><button type="button" class="btn sm ghost" data-act="a:shipCancel" data-id="${o.id}">Скасувати</button>
 <span class="help">Покупець побачить службу, номер і очікувану дату доставки в «My orders» і на сторінці «Track your order». Для USPS/UPS/FedEx/DHL також з'явиться кнопка відстеження. Для іншої служби — лише номер і дата.</span></form></td></tr>
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
messages(q){const st=q.get("status")||"inbox";setTimeout(()=>this.fillMsgs(st),0);
 return `<div class="ahead"><h1>Повідомлення від покупців</h1><button class="btn sm" data-act="a:reloadMsgs">↻ Оновити</button></div>
 <div class="chips">${[["inbox","Вхідні"],["new","Нові"],["replied","Відповіли"],["archived","Архів"]].map(([k,v])=>`<a class="chip ${st===k?"on":""}" href="#/admin/messages${k==="inbox"?"":"?status="+k}">${v}</a>`).join("")}</div>
 <div id="msgList"><p class="muted">Завантаження…</p></div><p class="help">Повідомлення надходять із форми «Contact us» на сайті. Відповідайте зі своєї пошти — кнопка «Відповісти» відкриє лист.</p>`},
msgData:[],
async fillMsgs(st){let qq=sb.from("messages").select("*").order("created_at",{ascending:false}).limit(300);
 if(st==="inbox")qq=qq.in("status",["new","read"]);else qq=qq.eq("status",st);
 const{data,error}=await qq;const box=$("#msgList");if(!box)return;if(error){box.innerHTML=`<div class="note">${esc(error.message)}</div>`;return}
 this.msgData=data;this.renderMsgs();this.msgBadge()},
renderMsgs(){const box=$("#msgList");if(!box)return;const d=this.msgData;
 if(!d.length){box.innerHTML=`<div class="empty"><b>Тут порожньо</b>Нові повідомлення з’являться тут.</div>`;return}
 const SL={new:"Нове",read:"Прочитане",replied:"Відповіли",archived:"Архів"};
 box.innerHTML=d.map(m=>`<details class="msg ${m.status==="new"?"unread":""}" ${m.status==="new"?"":""}><summary><span class="mfrom"><b>${esc(m.name)}</b> <span class="muted small">${esc(m.email)}</span></span><span class="mprev">${esc(m.body.slice(0,90))}${m.body.length>90?"…":""}</span><span class="mmeta"><span class="ostat s-${m.status==="new"?"new":"completed"}">${SL[m.status]}</span><span class="small muted">${new Date(m.created_at).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span></span></summary>
 <div class="mbody">${m.order_no?`<p class="small">Замовлення: <b>${esc(m.order_no)}</b></p>`:""}<p style="white-space:pre-line">${esc(m.body)}</p>
 <div class="acts" style="justify-content:flex-start"><a class="btn sm primary" href="mailto:${esc(m.email)}?subject=${encodeURIComponent("Re: your message to "+S.settings.name)}" data-act="a:msgStatus" data-id="${m.id}" data-v="replied">✉ Відповісти</a>${m.status==="new"?`<button class="btn sm" data-act="a:msgStatus" data-id="${m.id}" data-v="read">Прочитано</button>`:""}${m.status!=="archived"?`<button class="btn sm" data-act="a:msgStatus" data-id="${m.id}" data-v="archived">В архів</button>`:`<button class="btn sm" data-act="a:msgStatus" data-id="${m.id}" data-v="read">Повернути</button>`}<span class="small muted">${esc(m.email)}</span></div></div></details>`).join("")},
async msgBadge(){const{count}=await sb.from("messages").select("id",{count:"exact",head:true}).eq("status","new");const b=$("#msgBadge");if(b)b.textContent=count||"";this.revBadge();this.chatBadge()},
chatUnread:t=>!!t.last_customer_at&&(!t.admin_seen_at||Date.parse(t.last_customer_at)>Date.parse(t.admin_seen_at)),
async chatBadge(){const{data}=await sb.from("chat_threads").select("id,last_customer_at,admin_seen_at").order("last_at",{ascending:false}).limit(300);const b=$("#chatBadge");if(b&&data)b.textContent=data.filter(this.chatUnread).length||""},
/* ---- live chat inbox ---- */
chat(q){const tid=q.get("t")||"";this.chatSig="";setTimeout(()=>this.fillChat(tid),0);clearInterval(this.chatTimer);
 this.chatTimer=setInterval(()=>{if(!location.hash.startsWith("#/admin/chat")){clearInterval(this.chatTimer);return}if(document.visibilityState==="visible")this.fillChat(new URLSearchParams(location.hash.split("?")[1]||"").get("t")||"",true)},8000);
 return `<div class="ahead"><h1>Чат</h1></div><p class="muted" style="margin-top:-8px">Розмови з чату на сайті. Якщо покупець ще на сайті, він побачить вашу відповідь одразу. Якщо вже пішов, відповідайте листом (кнопка «✉️ Відповісти листом»). Нові повідомлення приходять і в Telegram, якщо сповіщення підключено. Пишіть покупцям англійською.</p>
 <div class="chatadm"><div class="chatlistadm" id="chatAdmList"><p class="muted" style="padding:14px">Завантаження…</p></div><div class="chatconv" id="chatConv"><div class="empty" style="border:0;margin:auto">Оберіть розмову зліва</div></div></div>`},
async fillChat(tid,silent){
 const{data:th,error}=await sb.from("chat_threads").select("id,name,email,page,status,created_at,last_at,last_customer_at,admin_seen_at,last_preview").order("last_at",{ascending:false}).limit(300);
 const L=$("#chatAdmList");if(!L)return;if(error){L.innerHTML=`<div class="note" style="margin:12px">${esc(error.message)}</div>`;return}
 const when=d=>{const x=new Date(d);return x.toDateString()===new Date().toDateString()?x.toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"}):x.toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit"})};
 L.innerHTML=th.length?th.map(t=>`<a class="chatitem ${t.id===tid?"on":""} ${this.chatUnread(t)?"unread":""}" href="#/admin/chat?t=${t.id}"><b>${esc(t.name||t.email||"Відвідувач")}</b><span class="small muted">${esc(t.last_preview||"")}</span><small>${when(t.last_at)}${t.status==="closed"?" · закрито":""}</small></a>`).join(""):`<div class="empty" style="border:0">Ще немає розмов</div>`;
 const b=$("#chatBadge");if(b)b.textContent=th.filter(this.chatUnread).length||"";
 if(!tid)return;const t=th.find(x=>x.id===tid),C=$("#chatConv");if(!C)return;if(!t){C.innerHTML='<div class="empty" style="border:0;margin:auto">Розмову не знайдено</div>';return}
 const{data:ms,error:e2}=await sb.from("chat_messages").select("id,sender,body,created_at").eq("thread_id",tid).order("id").limit(500);if(e2){C.innerHTML=`<div class="note" style="margin:12px">${esc(e2.message)}</div>`;return}
 const sig=tid+":"+ms.length+":"+t.status;if(silent&&this.chatSig===sig)return;this.chatSig=sig;
 const old=C.querySelector("textarea"),draft=old&&old.dataset.t===tid?old.value:"";
 const tm=d=>new Date(d).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
 C.innerHTML=`<div class="chathd"><div><b>${esc(t.name||"Відвідувач")}</b><div class="small muted">${t.email?esc(t.email):"email не вказано"}${t.page?` · був на сторінці <a class="textlink" href="${SITE_URL}${esc(t.page)}" target="_blank" rel="noopener">${esc(t.page)}</a>`:""}</div></div>
 <div class="acts">${t.email?`<a class="btn sm" href="mailto:${esc(t.email)}?subject=${encodeURIComponent("Re: your message to "+S.settings.name)}">✉️ Відповісти листом</a>`:""}<button class="btn sm" data-act="a:chatstatus" data-id="${t.id}" data-v="${t.status==="open"?"closed":"open"}">${t.status==="open"?"✓ Закрити":"Відкрити знову"}</button><button class="btn sm danger" data-act="a:chatdel" data-id="${t.id}">Видалити</button></div></div>
 <div class="chatmsgs" id="chatMsgs">${ms.map(m=>`<div class="cmsg ${m.sender==="seller"?"them":"me"}"><div class="cb">${esc(m.body)}</div><small>${m.sender==="seller"?"Ви · ":""}${tm(m.created_at)}</small></div>`).join("")}</div>
 <form class="chatreply" data-form="chatreply" data-id="${t.id}"><textarea class="field" name="body" maxlength="2000" data-t="${t.id}" placeholder="Відповідь англійською… (Enter — надіслати, Shift+Enter — новий рядок)"></textarea><button class="btn primary">Надіслати</button></form>`;
 const ta=C.querySelector("textarea");ta.value=draft;if(!silent)ta.focus({preventScroll:true});const M=$("#chatMsgs");M.scrollTop=M.scrollHeight;
 if(this.chatUnread(t)){const{error:e3}=await sb.from("chat_threads").update({admin_seen_at:t.last_customer_at}).eq("id",tid);if(!e3){t.admin_seen_at=t.last_customer_at;const it=L.querySelector(`[href$="${tid}"]`);it&&it.classList.remove("unread");if(b)b.textContent=th.filter(this.chatUnread).length||""}}},
async revBadge(){const{count}=await sb.from("reviews").select("id",{count:"exact",head:true}).eq("status","pending");const b=$("#revBadge");if(b)b.textContent=count||""},
/* ---- reviews moderation ---- */
reviews(q){const st=q.get("status")||"pending";setTimeout(()=>this.fillRevs(st),0);
 return `<div class="ahead"><h1>Відгуки</h1></div><p class="muted" style="margin-top:-8px">Покупці з акаунтом пишуть відгуки на сторінці товару. На сайті відгук з’являється лише після того, як ви його опублікуєте. Позначка «✓ Verified purchase» ставиться автоматично, якщо покупець замовляв цей товар.</p>
 <div class="acts" style="margin:14px 0">${[["pending","🆕 Нові"],["approved","✓ Опубліковані"],["rejected","✕ Відхилені"]].map(([k,l])=>`<a class="btn sm ${st===k?"primary":""}" href="#/admin/reviews?status=${k}">${l}</a>`).join("")}</div>
 <div id="revList"><p class="muted">Завантаження…</p></div>
 <p class="help">Правило FTC (США): не можна публікувати вигадані відгуки, писати відгуки від імені покупців чи приховувати лише негативні. Відхиляйте тільки спам, образи, особисті дані або відгуки не про товар.</p>`},
async fillRevs(st){const{data,error}=await sb.from("reviews").select("*").eq("status",st).order("created_at",{ascending:false}).limit(300);const box=$("#revList");if(!box)return;
 if(error){box.innerHTML=`<div class="note">${esc(error.message)}</div>`;return}
 if(!data.length){box.innerHTML=`<div class="empty"><b>Тут порожньо</b>${st==="pending"?"Нових відгуків немає.":"Немає відгуків із цим статусом."}</div>`;return}
 box.innerHTML=data.map(r=>{const p=prod(r.product_id);return `<div class="panel revadm"><div><span class="starsline">${"★".repeat(r.rating)}<span>${"★".repeat(5-r.rating)}</span></span> ${r.title?`<b>${esc(r.title)}</b>`:""}</div>
 <div class="small muted" style="margin:4px 0 8px">${esc(r.name)} · ${r.verified?"✓ покупку підтверджено":"покупку не підтверджено"} · ${new Date(r.created_at).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})} · товар: ${p?`<a class="textlink" href="${SITE_URL}#/product/${p.id}" target="_blank" rel="noopener">${esc(p.name)} ↗</a>`:esc(r.product_id)}</div>
 <p style="white-space:pre-line;margin:0 0 12px">${esc(r.body)}</p>
 <div class="acts">${st!=="approved"?`<button class="btn sm primary" data-act="a:revset" data-id="${r.id}" data-v="approved">✓ Опублікувати</button>`:`<button class="btn sm" data-act="a:revset" data-id="${r.id}" data-v="pending">Зняти з публікації</button>`}${st==="pending"?`<button class="btn sm" data-act="a:revset" data-id="${r.id}" data-v="rejected">✕ Відхилити</button>`:""}<button class="btn sm danger" data-act="a:revdel" data-id="${r.id}">Видалити</button></div></div>`}).join("")},
customers(){setTimeout(()=>this.fillCust(),0);
 return `<div class="ahead"><h1>Покупці</h1></div><div class="shopbar"><label class="search">${ICON.search}<input id="custSearch" placeholder="Пошук: ім’я, email, телефон, місто" autocomplete="off"></label></div><div id="custList"><p class="muted">Завантаження…</p></div>
 <p class="help">Покупці з акаунтом і гості, які замовляли (об’єднані за email або телефоном). Сума — без скасованих і повернених замовлень.</p>`},
custData:[],
async fillCust(){const{data,error}=await sb.rpc("seller_customers");const box=$("#custList");if(!box)return;if(error){box.innerHTML=`<div class="note">${esc(error.message)}</div>`;return}
 this.custData=data;this.renderCust();const i=$("#custSearch");if(i&&!i.dataset.ready){i.dataset.ready=1;i.addEventListener("input",()=>this.renderCust())}},
renderCust(){const box=$("#custList");if(!box)return;const term=(($("#custSearch")||{}).value||"").trim().toLowerCase();
 const d=this.custData.filter(c=>!term||[c.name,c.email,c.phone,c.city].some(v=>String(v||"").toLowerCase().includes(term)));
 const tot=d.reduce((s,c)=>s+(+c.spent||0),0);
 box.innerHTML=d.length?`<div class="stats" style="grid-template-columns:repeat(3,1fr)"><div class="stat"><b>${d.length}</b><span>покупців</span></div><div class="stat"><b>${d.filter(c=>c.has_account).length}</b><span>з акаунтом</span></div><div class="stat"><b>${d.filter(c=>+c.orders_count>1).length}</b><span>купували повторно</span></div></div>
 <div class="tablewrap"><table class="t"><thead><tr><th>Покупець</th><th>Контакти</th><th>Місто</th><th>Замовлень</th><th>Сума</th><th>Останнє замовлення</th><th></th></tr></thead><tbody>${d.map(c=>`<tr>
 <td><b>${esc(c.name||"—")}</b><br><small class="muted">${c.has_account?"акаунт"+(c.joined?" з "+new Date(c.joined).toLocaleDateString("uk-UA"):""):"гість"}</small></td>
 <td class="small">${c.email?esc(c.email)+"<br>":""}${c.phone?esc(c.phone):""}</td><td class="small">${esc(c.city||"")}</td>
 <td>${c.orders_count}${+c.orders_count>1?' <span class="ostat s-completed">постійний</span>':""}</td><td><b>${money(c.spent)}</b></td>
 <td class="small">${c.last_order?new Date(c.last_order).toLocaleDateString("uk-UA"):"—"}</td>
 <td>${+c.orders_count?`<button class="btn sm" data-act="a:custOrders" data-q="${esc(c.email||c.phone||c.name||"")}">Замовлення</button>`:""}</td></tr>`).join("")}</tbody></table></div><p class="help">Разом: ${money(tot)}</p>`:`<div class="empty"><b>${term?"Нічого не знайдено":"Покупців поки немає"}</b></div>`},
log(){setTimeout(()=>this.fillLog(),0);return `<div class="ahead"><h1>Журнал дій</h1></div><p class="muted">Кожна зміна товарів, категорій, налаштувань і статусів замовлень: хто, коли й що змінив. Журнал не можна змінити чи видалити.</p><div id="logList"><p class="muted">Завантаження…</p></div>`},
async fillLog(){const box=$("#logList");if(!box)return;const{data,error}=await sb.from("audit_log").select("*").order("at",{ascending:false}).limit(150);
 if(error){box.innerHTML=`<div class="note">${esc(error.message)}</div>`;return}
 const T={products:"Товар",categories:"Категорія",store_settings:"Налаштування",orders:"Замовлення"},A={insert:"додано",update:"змінено",delete:"видалено"};
 box.innerHTML=data.length?`<div class="tablewrap"><table class="t" style="min-width:640px"><thead><tr><th>Коли</th><th>Хто</th><th>Що</th><th>Деталі</th></tr></thead><tbody>${data.map(l=>{const d=l.details||{};const det=l.table_name==="orders"?`${esc(d.order_no||"")}: ${esc(Admin.ST[d.old_status]||d.old_status||"")} → ${esc(Admin.ST[d.status]||d.status||"")}`:l.table_name==="products"&&d.price!=null?`${esc(d.name||"")} · ${money(d.price)}${d.old_price_value!=null&&+d.old_price_value!==+d.price?` (було ${money(d.old_price_value)})`:""} · залишок ${d.stock}`:esc(d.name||"");return `<tr><td class="small">${new Date(l.at).toLocaleString("uk-UA")}</td><td class="small">${esc(l.actor_email||"система")}</td><td>${T[l.table_name]||esc(l.table_name)} ${A[l.action]||esc(l.action)}</td><td class="small">${det}</td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty"><b>Поки порожньо</b></div>`},
/* ---- handlers ---- */
change(el){const k=el.dataset.ach,id=el.dataset.id,p=id&&prod(id);
 if(k==="sku"&&p){const v=el.value.trim().slice(0,60);if(v&&S.products.some(x=>x!==p&&(x.sku||"").toLowerCase()===v.toLowerCase())){el.value=p.sku||"";return toast("⚠️ Код "+v+" уже є в іншого товару")}p.sku=v;save();toast("Код збережено ✓")}
 else if(["price","oldPrice","stock"].includes(k)&&p){let v=el.value===""?null:Number(el.value);if(k==="price"&&(v==null||v<0)){el.value=p.price;return toast("Ціна не може бути порожньою")}if(k==="stock")v=Math.max(0,Math.round(v||0));p[k]=v;save();toast("Збережено ✓")}
 else if((k==="active"||k==="featured")&&p){p[k]=el.checked;save();toast(el.checked?(k==="active"?"Показано на сайті":"Додано в хіти"):(k==="active"?"Приховано":"Прибрано з хітів"))}
 else if(k==="sel"){el.checked?this.sel.add(id):this.sel.delete(id);$("#selN").textContent="Вибрано: "+this.sel.size}
 else if(k==="selall"){document.querySelectorAll('[data-ach="sel"]').forEach(c=>{c.checked=el.checked;el.checked?this.sel.add(c.dataset.id):this.sel.delete(c.dataset.id)});$("#selN").textContent="Вибрано: "+this.sel.size}
 else if(k==="filtercat"){const f=el.form;const n=new URLSearchParams();const fd=new FormData(f);fd.get("q")&&n.set("q",fd.get("q"));fd.get("cat")&&n.set("cat",fd.get("cat"));const cs=new URLSearchParams(location.hash.split("?")[1]||"").get("stock");cs&&n.set("stock",cs);const so=fd.get("sort");so&&so!==(cs?"stock":"new")&&n.set("sort",so);location.hash="#/admin/products"+(n.toString()?"?"+n:"")}
 else if(k==="ostatus"){const v=el.value;el.disabled=true;sb.from("orders").update({status:v}).eq("id",+id).then(({error})=>{el.disabled=false;toast(error?"⚠️ "+error.message:"Статус: "+Admin.ST[v]+(v==="cancelled"?" · товари повернено на склад":""));if(!error){const o=Admin.ordersData.find(x=>x.id===+id);if(o)o.status=v;refreshAdminCatalog();if($("#ordPage"))Admin.fillOrder(+id)}})}
 else if(k==="carrierpick"){const o=el.form.carrier_other;o.hidden=el.value!=="Інший";if(!o.hidden)o.focus()}
 else if(k==="oeta"){const v=el.value||null;el.disabled=true;sb.from("orders").update({delivery_eta:v}).eq("id",+id).then(({error})=>{el.disabled=false;if(error)return toast("⚠️ "+error.message);const o=Admin.ordersData.find(x=>x.id===+id);if(o)o.delivery_eta=v;toast(v?"Очікувана доставка: "+Admin.day(v):"Дату доставки прибрано")})}
 else if(k==="catname"){const c=catOf(id);if(c&&el.value.trim()){c.name=el.value.trim();save();chrome();toast("Збережено ✓")}}},
click(a,el,e){const id=el.dataset.id;const need=()=>{if(!this.sel.size){toast("Спочатку виберіть товари галочками");return false}return true};
 const H={
 del:()=>{const p=prod(id);if(confirm(`Видалити «${p.name}»? Це не можна скасувати.`)){S.products=S.products.filter(x=>x.id!==id);save();toast("Товар видалено");location.hash="#/admin/products";render()}},
 dup:()=>{const p=prod(id);const c=JSON.parse(JSON.stringify(p));c.id=uid();c.name=p.name+" (копія)";c.active=false;c.created=Date.now();S.products.push(c);save();toast("Створено копію (прихована)");render()},
 pct:()=>{if(!need())return;const pc=Number($("#pct").value)||0,s=+el.dataset.s;if(!pc)return;if(!confirm(`${s>0?"Підняти":"Знизити"} ціну на ${pc}% для ${this.sel.size} товарів?`))return;this.sel.forEach(i=>{const p=prod(i);p.price=Math.max(0,Math.round(p.price*(1+s*pc/100)))});save();toast("Ціни оновлено");render()},
 vis:()=>{if(!need())return;this.sel.forEach(i=>prod(i).active=el.dataset.v==="1");save();render();toast("Готово")},
 bulkdel:()=>{if(!need())return;if(confirm(`Видалити ${this.sel.size} товарів? Це не можна скасувати.`)){S.products=S.products.filter(p=>!this.sel.has(p.id));this.sel.clear();save();render();toast("Видалено")}},
 imgmv:()=>{const I=this.draft.images,i=+el.dataset.i,j=i+ +el.dataset.d;if(j<0||j>=I.length)return;[I[i],I[j]]=[I[j],I[i]];$("#imgs").innerHTML=this.imgsHtml()},
 imgdel:()=>{this.draft.images.splice(+el.dataset.i,1);$("#imgs").innerHTML=this.imgsHtml()},
 imgurl:()=>{const u=$("#imgUrl").value.trim();if(!/^https?:\/\//.test(u))return toast("Вставте посилання, що починається з https://");this.draft.images.push(u);$("#imgUrl").value="";$("#imgs").innerHTML=this.imgsHtml()},
 posmv:()=>{const L=S.products.slice().sort(this.PSORT.manual);L.forEach((x,i)=>x.position=i+1);const i=L.findIndex(x=>x.id===id),j=i+ +el.dataset.d;if(j<0||j>=L.length)return;[L[i].position,L[j].position]=[L[j].position,L[i].position];save();render()},
 seoopen:()=>{const r=$("#seo-"+id);if(r){r.hidden=!r.hidden;if(!r.hidden)r.querySelector("input").focus()}},
 xlsExport:()=>this.xlsExport(),
 xlsTemplate:()=>this.xlsTemplate(),
 xlsImportOpen:()=>{let i=$("#xlsFile");if(!i){i=document.createElement("input");i.type="file";i.id="xlsFile";i.accept=".xlsx,.xls,.csv,.ods,.tsv";i.hidden=true;document.body.appendChild(i);i.addEventListener("change",()=>{const f=i.files[0];i.value="";if(f)this.xlsImport(f)})}this.impHelp();i.click()},
 impApply:()=>this.impApply(),
 impCancel:()=>{this.impPlan=null;$("#impBox").innerHTML=""},
 specadd:()=>$("#specs").insertAdjacentHTML("beforeend",this.specRow(["",""])),
 optadd:()=>{if(document.querySelectorAll("#opts .specrow").length>=5)return toast("Максимум 5 параметрів");$("#opts").insertAdjacentHTML("beforeend",this.optRow({name:"",values:[]}))},
 optdel:()=>el.closest(".specrow").remove(),
 chatstatus:()=>{const v=el.dataset.v;sb.from("chat_threads").update({status:v}).eq("id",id).then(({error})=>{if(error)return toast("⚠️ "+error.message);toast(v==="closed"?"Розмову закрито":"Розмову відкрито");this.chatSig="";this.fillChat(id)})},
 chatdel:()=>{if(!confirm("Видалити розмову разом з усіма повідомленнями? Це не можна скасувати."))return;sb.from("chat_threads").delete().eq("id",id).then(({error})=>{if(error)return toast("⚠️ "+error.message);toast("Розмову видалено");location.hash="#/admin/chat"})},
 opaid:()=>{const o=this.ordersData.find(x=>x.id===+id);if(!o)return;this.orderUpdate(+id,{payment_status:"paid",paid_amount:+o.total,paid_at:new Date().toISOString(),payment_method:o.payment_method||null},"Позначено оплаченим ✓")},
 oaddrEdit:()=>{const f=$('[data-form="oaddr"]');if(f){f.hidden=!f.hidden;if(!f.hidden)f.querySelector("input").focus()}},
 orefundOpen:()=>{const f=$('[data-form="orefund"]');if(f){f.hidden=!f.hidden;if(!f.hidden)f.querySelector("input").focus()}},
 ocopy:()=>copy(el.dataset.text||""),
 omail:()=>{const o=this.ordersData.find(x=>x.id===+id);if(o)location.href=this.mailFor(o,el.dataset.t)},
 revset:()=>{const v=el.dataset.v;el.disabled=true;sb.from("reviews").update({status:v}).eq("id",+id).then(({error})=>{if(error){el.disabled=false;return toast("⚠️ "+error.message)}toast(v==="approved"?"Відгук опубліковано ✓":v==="rejected"?"Відгук відхилено":"Відгук знято з публікації");const st=new URLSearchParams(location.hash.split("?")[1]||"").get("status")||"pending";this.fillRevs(st);this.revBadge()})},
 revdel:()=>{if(!confirm("Видалити відгук назавжди? Це не можна скасувати."))return;sb.from("reviews").delete().eq("id",+id).then(({error})=>{if(error)return toast("⚠️ "+error.message);toast("Відгук видалено");const st=new URLSearchParams(location.hash.split("?")[1]||"").get("status")||"pending";this.fillRevs(st);this.revBadge()})},
 specdel:()=>{const r=el.closest(".specrow");if($("#specs").children.length>1)r.remove();else r.querySelectorAll("input").forEach(i=>i.value="")},
 catdel:()=>{const c=catOf(id),n=S.products.filter(p=>p.cat===id).length;if(!confirm(`Видалити категорію «${c.name}»?`+(n?`\n${n} товарів залишаться без категорії.`:"")))return;S.categories=S.categories.filter(x=>x.id!==id);S.products.forEach(p=>{if(p.cat===id)p.cat=""});save();chrome();render()},
 catmv:()=>{const C=S.categories,i=+el.dataset.i,j=i+ +el.dataset.d;if(j<0||j>=C.length)return;[C[i],C[j]]=[C[j],C[i]];save();chrome();render()},
 catimgdel:()=>{catOf(id).image="";save();render()},
 herodel:()=>{S.settings.heroImage="";save();render()},
 heromdel:()=>{S.settings.heroImageMobile="";save();render()},
 export:()=>{download(`cozyhousevibe-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(S),"application/json");toast("Копію збережено")},
 signout:()=>{e.preventDefault();Seller.signOut()},
 tgLink:async()=>{el.disabled=true;const{data,error}=await sb.rpc("seller_link_telegram");el.disabled=false;
  if(error)return toast(/NO_MESSAGE/.test(error.message)?"⚠️ Бот ще не отримав повідомлення. Надішліть йому /start і спробуйте знову.":/NO_TOKEN/.test(error.message)?"⚠️ Спочатку збережіть токен (крок 2).":/TELEGRAM_ERROR:401/.test(error.message)?"⚠️ Telegram не прийняв токен. Перевірте його в @BotFather.":"⚠️ "+error.message);
  toast("Підключено! Перевірте Telegram — там тестове повідомлення.");this.tgStatus()},
 tgOff:async()=>{await sb.rpc("seller_disable_telegram");toast("Сповіщення вимкнено");this.tgStatus()},
 reloadMsgs:()=>{const st=new URLSearchParams(location.hash.split("?")[1]||"").get("status")||"inbox";this.fillMsgs(st)},
 custOrders:()=>{sessionStorage.setItem("ordQ",el.dataset.q);location.hash="#/admin/orders?status=all"},
 retForm:()=>{const r=$("#ret-"+id);if(r)r.hidden=!r.hidden},
 retCancel:()=>{const r=$("#ret-"+id);if(r)r.hidden=true},
 dashDays:()=>{sessionStorage.setItem("dashDays",el.dataset.d);render()},
 msgStatus:()=>{const v=el.dataset.v;sb.from("messages").update({status:v}).eq("id",+id).then(({error})=>{if(error)return toast("⚠️ "+error.message);const m=Admin.msgData.find(x=>x.id===+id);if(m)m.status=v;Admin.renderMsgs();Admin.msgBadge()})},
 shipForm:()=>{const r=$("#ship-"+id);if(r){r.hidden=!r.hidden;if(!r.hidden)r.querySelector("[name=tracking]").focus()}},
 shipCancel:()=>{const r=$("#ship-"+id);if(r)r.hidden=true},
 slip:()=>this.slip(id),
 print:()=>window.print(),
 slipClose:()=>{document.body.classList.remove("printing");const p=$("#printArea");if(p)p.innerHTML=""},
 reloadOrders:()=>{this.afterOrderChange(id)},
 };H[a]&&H[a]()},
submit(k,f){
 if(k==="seoprod"){const p=prod(f.dataset.id);if(!p)return;p.seoTitle=f.t.value.trim();p.seoDesc=f.d.value.trim();p.imgAlt=f.a.value.trim();save();toast("SEO збережено ✓");render();return}
 if(k==="seosite"){S.settings.seoTitle=f.t.value.trim();S.settings.seoDescription=f.d.value.trim();save();toast("SEO головної збережено ✓");render();return}
 if(k==="opay"||k==="orefund"||k==="onote"||k==="oaddr")return this.orderSubmit(k,f);
 if(k==="chatreply"){const body=f.body.value.trim(),id=f.dataset.id;if(!body)return;const b=f.querySelector("button.primary");b.disabled=true;
  sb.from("chat_messages").insert({thread_id:id,sender:"seller",body}).then(({error})=>{b.disabled=false;if(error)return toast("⚠️ "+error.message);f.body.value="";this.chatSig="";this.fillChat(id)});return}
 if(k==="ret"){const id=+f.dataset.id,reason=f.reason.value+(f.note.value.trim()?": "+f.note.value.trim():"");const b=f.querySelector("button.primary");b.disabled=true;
  sb.from("orders").update({status:"returned",return_reason:reason}).eq("id",id).then(({error})=>{b.disabled=false;if(error)return toast("⚠️ "+error.message);toast("Повернення оформлено · товари повернено на склад");refreshAdminCatalog();this.afterOrderChange(id)});return}
 if(k==="ship"){const id=+f.dataset.id,other=f.carrier.value==="Інший",carrier=other?(f.carrier_other.value.trim()||"Інший"):f.carrier.value,tracking=f.tracking.value.trim(),eta=f.eta.value||null;
  if(other&&!f.carrier_other.value.trim()){f.carrier_other.focus();return toast("Вкажіть назву служби доставки")}
  const b=f.querySelector("button.primary");b.disabled=true;
  sb.from("orders").update({status:"shipped",carrier,tracking_number:tracking||null,delivery_eta:eta}).eq("id",id).then(({error})=>{b.disabled=false;if(error)return toast("⚠️ "+error.message);toast("Позначено відправленим"+(tracking?" · трек "+tracking:"")+(eta?" · доставка "+Admin.day(eta):""));this.afterOrderChange(id)});return}
 if(k==="tgToken"){const tok=f.token.value.trim();const b=f.querySelector("button");b.disabled=true;sb.rpc("seller_set_telegram_token",{token:tok}).then(({data,error})=>{b.disabled=false;if(!error&&data==="same"){f.reset();toast("Цей токен уже збережено — підключення не змінилось");Admin.tgStatus();return}if(error)return toast(/BAD_TOKEN/.test(error.message)?"⚠️ Це не схоже на токен бота. Скопіюйте його з @BotFather повністю.":"⚠️ "+error.message);f.reset();toast("Токен збережено. Тепер крок 3.");Admin.tgStatus()});return}
 if(k==="aprodfilter"){const fd=new FormData(f),n=new URLSearchParams();fd.get("q")&&n.set("q",fd.get("q"));fd.get("cat")&&n.set("cat",fd.get("cat"));const cs=new URLSearchParams(location.hash.split("?")[1]||"").get("stock");cs&&n.set("stock",cs);const so=fd.get("sort");so&&so!==(cs?"stock":"new")&&n.set("sort",so);location.hash="#/admin/products"+(n.toString()?"?"+n:"");return}
 if(k==="catadd"){const n=f.name.value.trim();if(!n)return;let id=translit(n)||uid();if(catOf(id))id+="-"+uid().slice(0,3);S.categories.push({id,name:n,image:""});save();chrome();render();toast("Категорію додано");return}
 if(k==="settings"){const fd=new FormData(f);for(const[key,v]of fd.entries())S.settings[key]=key==="freeFrom"?Number(v)||0:String(v);save();chrome();toast("Налаштування збережено ✓");return}
 if(k==="product"){const fd=new FormData(f);const name=String(fd.get("name")).trim(),price=fd.get("price");
  f.name.style.borderColor=name?"":"#c0563a";f.price.style.borderColor=price!==""?"":"#c0563a";
  if(!name||price===""){$("#pErr").innerHTML='<div class="note" style="margin-bottom:10px">Вкажіть назву й ціну</div>';return}
  const sk=fd.getAll("sk"),sv=fd.getAll("sv"),on=fd.getAll("on"),ov=fd.getAll("ov");
  const options=on.map((n,i)=>({name:n.trim().slice(0,40),values:[...new Set(String(ov[i]||"").split(",").map(x=>x.trim().slice(0,40)).filter(Boolean))].slice(0,20)})).filter(o=>o.name&&o.values.length).slice(0,5);
  if(new Set(options.map(o=>o.name.toLowerCase())).size!==options.length){$("#pErr").innerHTML='<div class="note" style="margin-bottom:10px">Назви параметрів варіантів мають бути різними</div>';return}
  const data={name,short:String(fd.get("short")).trim(),desc:String(fd.get("desc")).trim(),price:Number(price),oldPrice:fd.get("oldPrice")?Number(fd.get("oldPrice")):null,stock:Math.max(0,parseInt(fd.get("stock"))||0),sku:String(fd.get("sku")).trim(),cat:fd.get("cat"),active:!!fd.get("active"),featured:!!fd.get("featured"),images:[...this.draft.images],specs:sk.map((x,i)=>[x.trim(),(sv[i]||"").trim()]).filter(s=>s[0]||s[1]),options};
  const id=this.draft._for;if(id==="new"){S.products.push({id:uid(),created:Date.now(),...data})}else Object.assign(prod(id),data);
  this.draft=null;save();toast(id==="new"?"Товар створено ✓":"Зміни збережено ✓");location.hash="#/admin/products"}},
importFile(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d||!Array.isArray(d.products)||!Array.isArray(d.categories))throw 0;if(!confirm(`Відновити копію: ${d.products.length} товарів, ${d.categories.length} категорій?\nПоточні дані буде замінено.`))return;S=normalize({version:3,settings:d.settings||{},categories:d.categories,products:d.products});save();chrome();render();toast("Відновлюю… зачекайте на «Збережено ✓»")}catch(e){toast("Це не схоже на файл копії магазину")}};r.readAsText(file)}
};
function toDataURL(file,max){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{let w=im.naturalWidth,h=im.naturalHeight;const k=Math.min(1,max/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);res(c.toDataURL("image/jpeg",.84))};im.src=r.result};r.readAsDataURL(file)})}
function download(name,text,type){const b=new Blob([text],{type});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function translit(s){const m={а:"a",б:"b",в:"v",г:"h",ґ:"g",д:"d",е:"e",є:"ie",ж:"zh",з:"z",и:"y",і:"i",ї:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ь:"",ю:"iu",я:"ia","'":"","’":""};return s.toLowerCase().split("").map(c=>m[c]??c).join("").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,30)}

document.addEventListener("keydown",e=>{const f=e.target.closest&&e.target.closest('[data-form="chatreply"]');if(f&&e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();f.requestSubmit()}});
