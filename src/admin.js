/* ===== owner admin panel (working file only) ===== */
const Admin={draft:null,sel:new Set(),
nav(cur){const L=[["","📊","Огляд"],["orders","🧾","Замовлення"],["chat","💬","Чат"],["messages","✉️","Повідомлення"],["customers","👥","Покупці"],["reviews","⭐","Відгуки"],["products","📦","Товари"],["categories","🗂","Категорії"],["settings","⚙️","Налаштування"],["log","🛡","Журнал дій"],["backup","💾","Резервні копії"]];
 return `<nav class="aside">${L.map(([k,i,n])=>`<a href="#/admin${k?"/"+k:""}" class="${cur===k?"on":""}">${i} ${n}${k==="messages"?`<span class="navbadge" id="msgBadge"></span>`:k==="reviews"?`<span class="navbadge" id="revBadge"></span>`:k==="chat"?`<span class="navbadge" id="chatBadge"></span>`:""}</a>`).join("")}<hr><a href="${SITE_URL}" target="_blank" rel="noopener">🏠 Відкрити магазин ↗</a><a href="#" data-act="a:signout">🚪 Вийти</a></nav>`},
wrap(cur,html){return `<div class="shell admin">${this.nav(cur)}<div>${html}</div></div>`},
view(parts,q){const k=parts[1]||"";
 if(k==="products")return this.wrap("products",this.products(q));
 if(k==="product")return this.wrap("products",this.editor(parts[2]));
 if(k==="categories")return this.wrap("categories",this.categories());
 if(k==="settings")return this.wrap("settings",this.settings());
 if(k==="backup")return this.wrap("backup",this.backup());
 if(k==="orders")return this.wrap("orders",this.orders(q));
 if(k==="log")return this.wrap("log",this.log());
 if(k==="messages")return this.wrap("messages",this.messages(q));
 if(k==="customers")return this.wrap("customers",this.customers());
 if(k==="reviews")return this.wrap("reviews",this.reviews(q));
 if(k==="chat")return this.wrap("chat",this.chat(q));
 return this.wrap("",this.dash())},
after(parts){
 const dz=$("#drop");if(dz){const fi=$("#imgFile");dz.addEventListener("dragover",e=>{e.preventDefault();dz.classList.add("over")});dz.addEventListener("dragleave",()=>dz.classList.remove("over"));dz.addEventListener("drop",e=>{e.preventDefault();dz.classList.remove("over");this.addFiles(e.dataTransfer.files)});fi.addEventListener("change",()=>{this.addFiles(fi.files);fi.value=""})}
 document.querySelectorAll("input[type=file][data-up]").forEach(inp=>inp.addEventListener("change",async()=>{const f=inp.files[0];if(!f)return;const url=await toDataURL(f,inp.dataset.up==="hero"?1600:900);if(inp.dataset.up==="hero")S.settings.heroImage=url;else{const c=catOf(inp.dataset.up);if(c)c.image=url}save();render();toast("Фото оновлено")}));
 const imp=$("#importFile");if(imp)imp.addEventListener("change",()=>this.importFile(imp.files[0]));
},
/* ---- dashboard ---- */
dash(){const P=S.products,act=P.filter(p=>p.active),out=act.filter(p=>p.stock<=0),low=act.filter(p=>p.stock>0&&p.stock<=3);
 const days=+(sessionStorage.getItem("dashDays")||30);
 setTimeout(()=>this.fillDash(days),0);
 return `<div class="ahead"><h1>Огляд магазину</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><div class="seg">${[7,30,90].map(d=>`<button class="${d===days?"on":""}" data-act="a:dashDays" data-d="${d}">${d} днів</button>`).join("")}</div><a class="btn primary sm" href="#/admin/product/new">${ICON.plus.replace("<svg",'<svg width="15"')} Додати товар</a></div></div>
 <div class="stats" id="kpis">${["Продажі","Замовлення","Середній чек","Продано одиниць"].map(l=>`<div class="stat"><b>…</b><span>${l}</span></div>`).join("")}</div>
 <div class="stats" style="grid-template-columns:repeat(4,1fr)"><a class="stat link" href="#/admin/orders"><b id="needShip">…</b><span>чекають відправлення</span></a><a class="stat link" href="#/admin/messages"><b id="newMsgs">…</b><span>нових повідомлень</span></a><div class="stat"><b>${act.length}</b><span>товарів на сайті</span></div><div class="stat"><b>${out.length+low.length}</b><span>закінчуються / немає</span></div></div>
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
products(q){const term=(q.get("q")||"").toLowerCase(),cat=q.get("cat")||"";
 const L=S.products.filter(p=>(!cat||p.cat===cat)&&(!term||(p.name+" "+p.sku).toLowerCase().includes(term))).sort((a,b)=>(b.created||0)-(a.created||0));
 this.sel=new Set([...this.sel].filter(id=>prod(id)));
 return `<div class="ahead"><h1>Товари <span class="muted" style="font-size:18px">${S.products.length}</span></h1><a class="btn primary" href="#/admin/product/new">${ICON.plus.replace("<svg",'<svg width="17"')} Додати товар</a></div>
 <form class="shopbar" data-form="aprodfilter"><label class="search">${ICON.search}<input name="q" value="${esc(q.get("q")||"")}" placeholder="Пошук за назвою або артикулом"></label><select name="cat" data-ach="filtercat"><option value="">Усі категорії</option>${S.categories.map(c=>`<option value="${c.id}" ${cat===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></form>
 <div class="bulk"><b id="selN">Вибрано: ${this.sel.size}</b><span class="muted">|</span>Змінити ціну на <input class="field" id="pct" type="number" value="10" style="width:80px;display:inline-block;padding:7px"> % <button class="btn sm" data-act="a:pct" data-s="1">↑ Підняти</button><button class="btn sm" data-act="a:pct" data-s="-1">↓ Знизити</button><span class="muted">|</span><button class="btn sm" data-act="a:vis" data-v="1">Показати</button><button class="btn sm" data-act="a:vis" data-v="0">Приховати</button><button class="btn sm danger" data-act="a:bulkdel">Видалити</button></div>
 <div class="tablewrap"><table class="t"><thead><tr><th><input type="checkbox" data-ach="selall" ${L.length&&L.every(p=>this.sel.has(p.id))?"checked":""}></th><th></th><th>Назва</th><th>Ціна, ${esc(S.settings.currency)}</th><th>Стара ціна</th><th>Залишок</th><th>На сайті</th><th>Хіт</th><th></th></tr></thead><tbody>
 ${L.map(p=>`<tr><td><input type="checkbox" data-ach="sel" data-id="${p.id}" ${this.sel.has(p.id)?"checked":""}></td><td><img src="${esc(img0(p))}" alt=""></td>
 <td class="nm"><a href="#/admin/product/${p.id}"><b>${esc(p.name)}</b></a><small>${esc(p.sku||"")} · ${esc((catOf(p.cat)||{}).name||"без категорії")}</small></td>
 <td><input class="mini" type="number" min="0" step="0.01" value="${p.price}" data-ach="price" data-id="${p.id}"></td>
 <td><input class="mini" type="number" min="0" step="0.01" value="${p.oldPrice||""}" placeholder="—" data-ach="oldPrice" data-id="${p.id}"></td>
 <td><input class="mini s" type="number" min="0" step="1" value="${p.stock}" data-ach="stock" data-id="${p.id}"></td>
 <td><label class="switch"><input type="checkbox" data-ach="active" data-id="${p.id}" ${p.active?"checked":""}><span></span></label></td>
 <td><label class="switch"><input type="checkbox" data-ach="featured" data-id="${p.id}" ${p.featured?"checked":""}><span></span></label></td>
 <td><div class="acts"><a class="btn sm" href="#/admin/product/${p.id}">Редагувати</a><button class="btn sm" data-act="a:dup" data-id="${p.id}" title="Дублювати">⧉</button><button class="btn sm danger" data-act="a:del" data-id="${p.id}" title="Видалити">✕</button></div></td></tr>`).join("")||`<tr><td colspan="9" class="muted" style="text-align:center;padding:30px">Товарів не знайдено</td></tr>`}
 </tbody></table></div><p class="help">Ціну, стару ціну (для знижки) та залишок можна змінювати прямо в таблиці — зберігається автоматично. «Стара ціна» показується перекресленою, з відсотком знижки.</p>`},
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
 <div><label class="lbl">Артикул</label><input class="field" name="sku" value="${esc(v.sku||"")}"></div>
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
 ${f("freeFrom","Безкоштовна доставка від (сума)",{type:"number",help:"0 — не показувати."})}${f("promo","Текст у верхній смузі",{full:true,help:"Порожньо — смуга прихована."})}</div></div>
 <div class="panel"><h2>Головна сторінка</h2><div class="form">${f("heroEyebrow","Надпис над заголовком",{full:true})}${f("heroTitle","Великий заголовок",{full:true})}${f("heroText","Текст під заголовком",{full:true,area:true,h:80})}
 <div class="full"><label>Головне фото</label><div style="display:flex;gap:12px;align-items:center"><img src="${esc(s.heroImage||PHOTO.hero)}" style="width:120px;height:90px;object-fit:cover;border-radius:10px"><label class="btn sm">Завантажити фото<input type="file" accept="image/*" hidden data-up="hero"></label>${s.heroImage?`<button type="button" class="btn sm" data-act="a:herodel">Повернути ілюстрацію</button>`:""}</div></div></div></div>
 <div class="panel"><h2>Контакти</h2><div class="form">${f("phone","Телефон")}${f("email","Email для замовлень")}${f("telegram","Telegram (username)",{ph:"@yourshop"})}${f("viber","Viber (номер)",{ph:"+380…"})}${f("instagram","Instagram",{ph:"@yourshop"})}${f("hours","Графік роботи",{full:true,help:"Показується внизу сайту й на сторінці «Контакти»."})}</div></div>
 <div class="panel"><h2>Замовлення</h2><div class="form">${f("deliveryOptions","Способи доставки",{area:true,help:"Кожен з нового рядка."})}${f("paymentOptions","Способи оплати",{area:true,help:"Кожен з нового рядка."})}
 ${f("formEndpoint","Автоматичне надсилання замовлень (необов'язково)",{full:true,ph:"https://formspree.io/f/xxxxxxx",help:"Без цього покупець після оформлення сам надсилає вам готовий текст замовлення в Telegram / на email. Якщо створити безкоштовну форму на formspree.io і вставити сюди її адресу — замовлення приходитимуть вам на пошту автоматично."})}</div></div>
 <div class="panel"><h2>Сторінки</h2><div class="form">${f("deliveryText","«Shipping & payment» (доставка й оплата)",{full:true,area:true,h:180})}</div></div>
 <div class="panel"><h2>Історія бренду (сторінка «Our story»)</h2><div class="form">${f("aboutTitle","Заголовок",{full:true})}${f("aboutIntro","Вступ під заголовком",{full:true,area:true,h:70})}${f("aboutStory","Історія",{full:true,area:true,h:220,help:"Порожній рядок — новий абзац."})}${f("aboutValues","Цінності (блоки з іконками)",{full:true,area:true,h:130,help:"Кожен з нового рядка у форматі: іконка | заголовок | текст"})}${f("aboutCta","Заклик внизу сторінки",{full:true})}</div></div>
 <div class="panel"><h2>Юридичні сторінки</h2><div class="note" style="margin-bottom:12px">Це шаблони для США. Замініть <b>[Business legal name]</b>, <b>[Business address]</b> і <b>[State]</b> на свої дані й за можливості покажіть тексти юристу. <b>{store}</b> і <b>{email}</b> підставляються автоматично (назва магазину й email з «Контактів»).</div><div class="form">${f("returnsText","Returns & Refunds (повернення)",{full:true,area:true,h:220})}${f("privacyText","Privacy Policy (конфіденційність)",{full:true,area:true,h:220})}${f("termsText","Terms of Service (умови)",{full:true,area:true,h:220})}<div class="full help">Форматування: рядок «## Заголовок» — підзаголовок, рядки з «- » — список, **текст** — жирний.</div></div></div>
 <div style="position:sticky;bottom:12px"><button class="btn primary" style="padding:14px 26px;box-shadow:var(--shadow)">Зберегти налаштування</button></div></form>`},
/* ---- publish & backup ---- */
backup(){return `<div class="ahead"><h1>Резервні копії</h1></div>
 <div class="panel" style="margin-bottom:20px"><h2>💾 Зберегти копію</h2><p>Усі товари, категорії й налаштування в одному файлі (.json). Корисно мати копію перед великими змінами.</p><button class="btn" data-act="a:export">⬇ Завантажити копію (.json)</button></div>
 <div class="panel"><h2>⬆ Відновити з копії</h2><p class="muted">Замінить поточні товари, категорії й налаштування даними з файлу. Замовлення не зачіпаються.</p><label class="btn">Вибрати файл…<input type="file" id="importFile" accept=".json,application/json" hidden></label></div>`},
orders(q){const st=q.get("status")||"ship";
 const chips=[["ship","📦 Потребують відправлення"],["","Усі"],...Object.entries(Admin.ST)];
 setTimeout(()=>this.fillOrders(st),0);
 return `<div class="ahead"><h1>Замовлення</h1><button class="btn sm" data-act="a:reloadOrders">↻ Оновити</button></div>
 <div class="chips">${chips.map(([k,v])=>`<a class="chip ${st===k?"on":""}" href="#/admin/orders${k===""?"?status=all":k==="ship"?"":"?status="+k}">${v}</a>`).join("")}</div>
 <div class="shopbar"><label class="search">${ICON.search}<input id="ordSearch" placeholder="Пошук: номер, ім’я, телефон або email" autocomplete="off"></label></div>
 <div id="ordList"><p class="muted">Завантаження…</p></div>`},
ST:{new:"Нове",confirmed:"Підтверджене",shipped:"Відправлене",completed:"Виконане",cancelled:"Скасоване",returned:"Повернення"},
RREASONS:["Пошкоджено при доставці","Не той товар","Не відповідає опису","Передумав(ла)","Інше"],
CARRIERS:["USPS","UPS","FedEx","DHL","Інший"],
ordersData:[],
async fillOrders(st){const box=$("#ordList");if(!box)return;
 let qq=sb.from("orders").select("id,order_no,status,customer,items,total,currency,created_at,user_id,carrier,tracking_number,shipped_at,return_reason,returned_at").order("created_at",{ascending:false}).limit(500);
 if(st==="ship")qq=qq.in("status",["new","confirmed"]);else if(st&&st!=="all")qq=qq.eq("status",st);
 const{data,error}=await qq;if(error){box.innerHTML=`<div class="note">Не вдалося завантажити: ${esc(error.message)}</div>`;return}
 this.ordersData=data;this.renderOrders();
 const inp=$("#ordSearch");if(inp&&!inp.dataset.ready){inp.dataset.ready=1;inp.addEventListener("input",()=>this.renderOrders());const pq=sessionStorage.getItem("ordQ");if(pq){sessionStorage.removeItem("ordQ");inp.value=pq;this.renderOrders()}}},
renderOrders(){const box=$("#ordList");if(!box)return;
 const term=(($("#ordSearch")||{}).value||"").trim().toLowerCase();
 const data=this.ordersData.filter(o=>{if(!term)return true;const c=o.customer||{};return [o.order_no,c.name,c.phone,c.email,String(c.phone||"").replace(/\D/g,"")].some(v=>String(v||"").toLowerCase().includes(term))});
 if(!data.length){box.innerHTML=`<div class="empty"><b>${term?"Нічого не знайдено":"Тут порожньо"}</b>${term?"Спробуйте інший запит.":"Немає замовлень із таким статусом."}</div>`;return}
 box.innerHTML=`<div class="tablewrap"><table class="t"><thead><tr><th>Номер</th><th>Дата</th><th>Покупець</th><th>Товари</th><th>Сума</th><th>Статус</th><th></th></tr></thead><tbody>${data.map(o=>{const c=o.customer||{};const canShip=o.status==="new"||o.status==="confirmed",canRet=o.status==="shipped"||o.status==="completed";return `<tr>
 <td><b>${esc(o.order_no)}</b><br><small class="muted">${o.user_id?"з акаунтом":"гість"}</small></td>
 <td class="small">${new Date(o.created_at).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td>
 <td><details><summary><b>${esc(c.name||"—")}</b></summary><div class="small" style="margin-top:6px;line-height:1.6">${c.phone?`📞 <a href="tel:${esc(String(c.phone).replace(/[^+\d]/g,""))}">${esc(c.phone)}</a><br>`:""}${c.email?`✉️ ${esc(c.email)}<br>`:""}🚚 ${esc(c.delivery||"")}<br>📍 ${esc([c.address,c.city,c.state,c.zip].filter(Boolean).join(", "))}<br>💳 ${esc(c.payment||"")}${c.comment?`<br>💬 ${esc(c.comment)}`:""}</div></details></td>
 <td class="small">${(o.items||[]).map(i=>`${esc(i.name)}${i.opt?` <span class="muted">(${esc(optStr(i.opt,prod(i.id)))})</span>`:""} × ${+i.qty||0}`).join("<br>")}</td>
 <td><b>${money(o.total)}</b></td>
 <td><select class="field" style="min-width:140px" data-ach="ostatus" data-id="${o.id}">${Object.entries(Admin.ST).filter(([k])=>k!=="returned"||o.status==="returned").map(([k,v])=>`<option value="${k}" ${o.status===k?"selected":""}>${v}</option>`).join("")}</select>${o.status==="returned"&&o.return_reason?`<div class="small" style="margin-top:4px;color:#9a3d2a">↩ ${esc(o.return_reason)}</div>`:""}${o.tracking_number?`<div class="small" style="margin-top:4px">${esc(o.carrier||"")} · ${trackUrl(o.carrier,o.tracking_number)?`<a class="textlink" href="${esc(trackUrl(o.carrier,o.tracking_number))}" target="_blank" rel="noopener">${esc(o.tracking_number)}</a>`:esc(o.tracking_number)}</div>`:""}</td>
 <td><div class="acts">${canShip?`<button class="btn sm primary" data-act="a:shipForm" data-id="${o.id}">📦 Відправити</button>`:""}${canRet?`<button class="btn sm" data-act="a:retForm" data-id="${o.id}">↩ Повернення</button>`:""}<button class="btn sm" data-act="a:slip" data-id="${o.id}" title="Пакувальний лист">🖨</button></div></td></tr>
 <tr class="shiprow" id="ship-${o.id}" hidden><td colspan="7"><form class="shipform" data-form="ship" data-id="${o.id}"><b>Відправлення ${esc(o.order_no)}</b>
 <select class="field" name="carrier">${Admin.CARRIERS.map(x=>`<option ${o.carrier===x?"selected":""}>${x}</option>`).join("")}</select>
 <input class="field" name="tracking" placeholder="Трек-номер" value="${esc(o.tracking_number||"")}" maxlength="80" autocomplete="off">
 <button class="btn primary sm">Позначити відправленим</button><button type="button" class="btn sm ghost" data-act="a:shipCancel" data-id="${o.id}">Скасувати</button>
 <span class="help">Покупець побачить трек-номер і посилання для відстеження у своєму кабінеті.</span></form></td></tr>
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
 if(["price","oldPrice","stock"].includes(k)&&p){let v=el.value===""?null:Number(el.value);if(k==="price"&&(v==null||v<0)){el.value=p.price;return toast("Ціна не може бути порожньою")}if(k==="stock")v=Math.max(0,Math.round(v||0));p[k]=v;save();toast("Збережено ✓")}
 else if((k==="active"||k==="featured")&&p){p[k]=el.checked;save();toast(el.checked?(k==="active"?"Показано на сайті":"Додано в хіти"):(k==="active"?"Приховано":"Прибрано з хітів"))}
 else if(k==="sel"){el.checked?this.sel.add(id):this.sel.delete(id);$("#selN").textContent="Вибрано: "+this.sel.size}
 else if(k==="selall"){document.querySelectorAll('[data-ach="sel"]').forEach(c=>{c.checked=el.checked;el.checked?this.sel.add(c.dataset.id):this.sel.delete(c.dataset.id)});$("#selN").textContent="Вибрано: "+this.sel.size}
 else if(k==="filtercat"){const f=el.form;const n=new URLSearchParams();const fd=new FormData(f);fd.get("q")&&n.set("q",fd.get("q"));fd.get("cat")&&n.set("cat",fd.get("cat"));location.hash="#/admin/products"+(n.toString()?"?"+n:"")}
 else if(k==="ostatus"){const v=el.value;el.disabled=true;sb.from("orders").update({status:v}).eq("id",+id).then(({error})=>{el.disabled=false;toast(error?"⚠️ "+error.message:"Статус: "+Admin.ST[v]+(v==="cancelled"?" · товари повернено на склад":""));if(!error){const o=Admin.ordersData.find(x=>x.id===+id);if(o)o.status=v;refreshAdminCatalog()}})}
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
 specadd:()=>$("#specs").insertAdjacentHTML("beforeend",this.specRow(["",""])),
 optadd:()=>{if(document.querySelectorAll("#opts .specrow").length>=5)return toast("Максимум 5 параметрів");$("#opts").insertAdjacentHTML("beforeend",this.optRow({name:"",values:[]}))},
 optdel:()=>el.closest(".specrow").remove(),
 chatstatus:()=>{const v=el.dataset.v;sb.from("chat_threads").update({status:v}).eq("id",id).then(({error})=>{if(error)return toast("⚠️ "+error.message);toast(v==="closed"?"Розмову закрито":"Розмову відкрито");this.chatSig="";this.fillChat(id)})},
 chatdel:()=>{if(!confirm("Видалити розмову разом з усіма повідомленнями? Це не можна скасувати."))return;sb.from("chat_threads").delete().eq("id",id).then(({error})=>{if(error)return toast("⚠️ "+error.message);toast("Розмову видалено");location.hash="#/admin/chat"})},
 revset:()=>{const v=el.dataset.v;el.disabled=true;sb.from("reviews").update({status:v}).eq("id",+id).then(({error})=>{if(error){el.disabled=false;return toast("⚠️ "+error.message)}toast(v==="approved"?"Відгук опубліковано ✓":v==="rejected"?"Відгук відхилено":"Відгук знято з публікації");const st=new URLSearchParams(location.hash.split("?")[1]||"").get("status")||"pending";this.fillRevs(st);this.revBadge()})},
 revdel:()=>{if(!confirm("Видалити відгук назавжди? Це не можна скасувати."))return;sb.from("reviews").delete().eq("id",+id).then(({error})=>{if(error)return toast("⚠️ "+error.message);toast("Відгук видалено");const st=new URLSearchParams(location.hash.split("?")[1]||"").get("status")||"pending";this.fillRevs(st);this.revBadge()})},
 specdel:()=>{const r=el.closest(".specrow");if($("#specs").children.length>1)r.remove();else r.querySelectorAll("input").forEach(i=>i.value="")},
 catdel:()=>{const c=catOf(id),n=S.products.filter(p=>p.cat===id).length;if(!confirm(`Видалити категорію «${c.name}»?`+(n?`\n${n} товарів залишаться без категорії.`:"")))return;S.categories=S.categories.filter(x=>x.id!==id);S.products.forEach(p=>{if(p.cat===id)p.cat=""});save();chrome();render()},
 catmv:()=>{const C=S.categories,i=+el.dataset.i,j=i+ +el.dataset.d;if(j<0||j>=C.length)return;[C[i],C[j]]=[C[j],C[i]];save();chrome();render()},
 catimgdel:()=>{catOf(id).image="";save();render()},
 herodel:()=>{S.settings.heroImage="";save();render()},
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
 reloadOrders:()=>{const st=new URLSearchParams(location.hash.split("?")[1]||"").get("status")||"ship";this.fillOrders(st)},
 };H[a]&&H[a]()},
submit(k,f){
 if(k==="chatreply"){const body=f.body.value.trim(),id=f.dataset.id;if(!body)return;const b=f.querySelector("button.primary");b.disabled=true;
  sb.from("chat_messages").insert({thread_id:id,sender:"seller",body}).then(({error})=>{b.disabled=false;if(error)return toast("⚠️ "+error.message);f.body.value="";this.chatSig="";this.fillChat(id)});return}
 if(k==="ret"){const id=+f.dataset.id,reason=f.reason.value+(f.note.value.trim()?": "+f.note.value.trim():"");const b=f.querySelector("button.primary");b.disabled=true;
  sb.from("orders").update({status:"returned",return_reason:reason}).eq("id",id).then(({error})=>{b.disabled=false;if(error)return toast("⚠️ "+error.message);toast("Повернення оформлено · товари повернено на склад");refreshAdminCatalog();const st=new URLSearchParams(location.hash.split("?")[1]||"").get("status")||"ship";this.fillOrders(st)});return}
 if(k==="ship"){const id=+f.dataset.id,carrier=f.carrier.value,tracking=f.tracking.value.trim();const b=f.querySelector("button.primary");b.disabled=true;
  sb.from("orders").update({status:"shipped",carrier,tracking_number:tracking||null}).eq("id",id).then(({error})=>{b.disabled=false;if(error)return toast("⚠️ "+error.message);toast("Позначено відправленим"+(tracking?" · трек "+tracking:""));const st=new URLSearchParams(location.hash.split("?")[1]||"").get("status")||"ship";this.fillOrders(st)});return}
 if(k==="tgToken"){const tok=f.token.value.trim();const b=f.querySelector("button");b.disabled=true;sb.rpc("seller_set_telegram_token",{token:tok}).then(({data,error})=>{b.disabled=false;if(!error&&data==="same"){f.reset();toast("Цей токен уже збережено — підключення не змінилось");Admin.tgStatus();return}if(error)return toast(/BAD_TOKEN/.test(error.message)?"⚠️ Це не схоже на токен бота. Скопіюйте його з @BotFather повністю.":"⚠️ "+error.message);f.reset();toast("Токен збережено. Тепер крок 3.");Admin.tgStatus()});return}
 if(k==="aprodfilter"){const fd=new FormData(f),n=new URLSearchParams();fd.get("q")&&n.set("q",fd.get("q"));fd.get("cat")&&n.set("cat",fd.get("cat"));location.hash="#/admin/products"+(n.toString()?"?"+n:"");return}
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
