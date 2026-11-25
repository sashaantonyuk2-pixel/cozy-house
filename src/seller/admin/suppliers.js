/* ===== Seller Central · Постачальники (directory; admin-only table public.suppliers) =====
   Supplier-level details live here once; each product keeps only its supplier SKU, cost price and link. */
Object.assign(Admin,{
supById(id){return (S.suppliers||[]).find(x=>x.id===id)},
supName(id){const s=id&&this.supById(id);return s?s.name:""},
SUP:{status:[["active","Активний"],["paused","Призупинено"],["archived","Архів"]],
 kind:[["wholesaler","Оптовик"],["manufacturer","Виробник"],["dropship","Дропшипінг"],["marketplace","Маркетплейс"],["handmade","Handmade-майстер"]],
 currency:[["USD","USD"],["EUR","EUR"],["UAH","UAH"],["CNY","CNY"],["GBP","GBP"]],
 payment_method:[["bank","Банківський переказ"],["card","Картка"],["paypal","PayPal"],["other","Інше"]],
 shipping:[["free","Безкоштовно"],["fixed","Фіксована сума"],["weight","За вагою"]],
 defect_returns:[["yes","Так"],["partial","Частково"],["no","Ні"]],
 terms:["Передоплата 100%","50/50","Net 15","Net 30","Після отримання"],
 countries:["США","Китай","Україна","Польща","Литва","Туреччина","Індія","Велика Британія","Канада","Мексика"]},
supLbl(k,v){const o=(this.SUP[k]||[]).find(x=>x[0]===v);return o?o[1]:""},
supLead(s){const a=s.lead_days_min,b=s.lead_days_max;return a!=null&&b!=null?(a===b?a:a+"–"+b)+" дн.":a!=null?"від "+a+" дн.":b!=null?"до "+b+" дн.":(s.lead_time||"")},
supStars(n){n=+n||0;return n?`<span class="supstars" title="${n} з 5">${"★".repeat(n)}<span>${"★".repeat(5-n)}</span></span>`:`<span class="muted">—</span>`},
supStats(id){const P=S.products.filter(p=>p.supplierId===id),t=this.lowN(),M=P.filter(p=>p.cost!=null&&+p.price>0);
 return{n:P.length,active:P.filter(p=>p.active).length,units:P.reduce((s,p)=>s+(+p.stock||0),0),value:P.reduce((s,p)=>s+(p.cost==null?0:+p.cost*(+p.stock||0)),0),noCost:P.filter(p=>p.cost==null).length,
  low:P.filter(p=>p.active&&p.stock<=t).length,margin:M.length?Math.round(M.reduce((s,p)=>s+(p.price-p.cost)/p.price,0)/M.length*100):null}},
suppliers(q){const L=S.suppliers||[],term=(q.get("q")||"").trim().toLowerCase(),stf=q.get("st")||"",view=q.get("view")||LS.get("supView","list");LS.set("supView",view);
 const sort=q.get("sort")||"name",dir=q.get("dir")==="desc"?-1:1;
 const R=L.map(s=>({s,st:this.supStats(s.id)}));
 const F=R.filter(({s})=>(!stf?s.status!=="archived":s.status===stf)&&(!term||[s.name,s.contact_name,s.email,s.phone,s.notes,s.country].some(v=>String(v||"").toLowerCase().includes(term))));
 const key={name:x=>x.s.name.toLowerCase(),n:x=>x.st.n,units:x=>x.st.units,value:x=>x.st.value,margin:x=>x.st.margin??-1,lead:x=>x.s.lead_days_max??x.s.lead_days_min??9999,rating:x=>+x.s.rating||0}[sort]||(x=>x.s.name.toLowerCase());
 F.sort((a,b)=>{const A=key(a),B=key(b);return(A<B?-1:A>B?1:0)*dir});
 const qs=o=>{const n=new URLSearchParams();const v={q:q.get("q")||"",st:stf,sort,dir:dir<0?"desc":"",view,...o};Object.entries(v).forEach(([k,x])=>x&&!(k==="sort"&&x==="name")&&n.set(k,x));const t=n.toString();return "#/admin/suppliers"+(t?"?"+t:"")};
 const th=(k,l)=>`<th><a class="supsort ${sort===k?"on":""}" href="${qs({sort:k,dir:sort===k&&dir>0?"desc":""})}">${l} ${sort===k?(dir>0?"▲":"▼"):"↕"}</a></th>`;
 const act=R.filter(x=>x.s.status==="active"),none=S.products.filter(p=>!p.supplierId).length;
 const tot={n:R.reduce((a,x)=>a+x.st.n,0),value:R.reduce((a,x)=>a+x.st.value,0),low:R.reduce((a,x)=>a+x.st.low,0)};
 const cnt=k=>R.filter(x=>x.s.status===k).length;
 const pill=s=>`<span class="suppill sp-${esc(s.status||"active")}">${this.supLbl("status",s.status||"active")}</span>`;
 const sub=s=>[s.country,s.payment_terms,s.currency].filter(Boolean).map(esc).join(" · ");
 const contact=s=>`${esc(s.contact_name||"")}${s.phone?`<br><a class="textlink small" href="tel:${esc(s.phone.replace(/[^+\d]/g,""))}">${esc(s.phone)}</a>`:s.email?`<br><a class="textlink small" href="mailto:${esc(s.email)}">${esc(s.email)}</a>`:""}`||`<span class="muted">—</span>`;
 const lowTxt=st=>st.low?`<br><a class="small supwarn" href="#/admin/products?sup=${"{id}"}&sort=stock">${st.low} закінчуються</a>`:"";
 const table=`<div class="tablewrap"><table class="t suptable"><thead><tr>${th("name","Назва")}<th>Статус</th><th>Тип</th><th>Контакт</th>${th("n","Товарів")}${th("value","Склад")}${th("margin","Маржа")}${th("lead","Поставка")}${th("rating","Рейтинг")}</tr></thead><tbody>
  ${F.map(({s,st})=>`<tr class="${s.status==="archived"?"suparch":""}"><td><a href="#/admin/supplier/${s.id}"><b>${esc(s.name)}</b></a>${sub(s)?`<br><small class="muted">${sub(s)}</small>`:""}</td><td>${pill(s)}</td><td>${this.supLbl("kind",s.kind)||`<span class="muted">—</span>`}</td><td class="small">${contact(s)}</td>
   <td><a class="textlink" href="#/admin/products?sup=${s.id}">${st.n}</a>${lowTxt(st).replace("{id}",s.id)}</td><td>${st.units} шт.<br><small class="muted">${money(st.value)}</small></td><td>${st.margin==null?`<span class="muted">—</span>`:st.margin+"%"}</td><td>${esc(this.supLead(s))||`<span class="muted">—</span>`}</td><td>${this.supStars(s.rating)}</td></tr>`).join("")}</tbody></table></div>`;
 const cards=`<div class="supgrid">${F.map(({s,st})=>`<div class="panel supcard"><div class="supcard-h"><a href="#/admin/supplier/${s.id}"><b>${esc(s.name)}</b></a>${pill(s)}</div>
  <div class="small supmeta">${sub(s)?`<div class="muted">${sub(s)}</div>`:""}${s.contact_name?`<div>👤 ${esc(s.contact_name)}</div>`:""}${s.email?`<div>✉️ <a class="textlink" href="mailto:${esc(s.email)}">${esc(s.email)}</a></div>`:""}${s.phone?`<div>📞 <a class="textlink" href="tel:${esc(s.phone.replace(/[^+\d]/g,""))}">${esc(s.phone)}</a></div>`:""}${s.website?`<div>🌐 <a class="textlink" href="${esc(s.website)}" target="_blank" rel="noopener">${esc(s.website.replace(/^https?:\/\//,"").replace(/\/$/,""))}</a></div>`:""}
  ${this.supLead(s)?`<div>⏱ Поставка: ${esc(this.supLead(s))}</div>`:""}${s.min_order?`<div>📦 Мін. замовлення: ${esc(s.min_order)}</div>`:""}${s.rating?`<div>${this.supStars(s.rating)}</div>`:""}</div>
  <div class="supstats"><a href="#/admin/products?sup=${s.id}"><b>${st.n}</b> товарів →</a><span>на складі <b>${st.units}</b> шт.</span><span>за закупкою <b>${money(st.value)}</b>${st.noCost?` <span class="muted">(${st.noCost} без ціни)</span>`:""}</span>${st.low?`<a class="supwarn" href="#/admin/products?sup=${s.id}&sort=stock">${st.low} закінчуються</a>`:""}</div></div>`).join("")}</div>`;
 return `<div class="ahead"><h1>Постачальники <span class="muted" style="font-size:18px">${L.length}</span></h1><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${L.length?`<div class="seg"><button class="${view==="list"?"on":""}" onclick="location.hash='${qs({view:"list"})}'">☰ Список</button><button class="${view==="cards"?"on":""}" onclick="location.hash='${qs({view:"cards"})}'">▦ Картки</button></div>`:""}<a class="btn primary" href="#/admin/supplier/new">${ICON.plus.replace("<svg",'<svg width="15"')} Додати постачальника</a></div></div>
 <p class="help" style="margin-top:-8px">Контакти й умови кожного постачальника. У товарі обираєте постачальника й вписуєте його SKU та закупівельну ціну. Покупці цих даних не бачать.</p>
 ${L.length?`<div class="stats"><div class="stat"><b>${act.length}</b>Активних</div><div class="stat"><b>${tot.n}</b>Товарів від постачальників</div><div class="stat"><b>${money(tot.value)}</b>Склад за закупкою</div><a class="stat link ${tot.low?"warnstat":""}" href="#/admin/products?sort=stock"><b>${tot.low}</b>Пора дозамовити</a></div>
 <form class="shopbar supbar" data-base="${qs({q:""})}" onsubmit="event.preventDefault();const b=this.dataset.base,v=this.q.value.trim();location.hash=b+(v?(b.includes('?')?'&':'?')+'q='+encodeURIComponent(v):'')"><label class="search">${ICON.search}<input name="q" value="${esc(q.get("q")||"")}" placeholder="Пошук: назва, контакт, email, країна, нотатки"></label>
  <div class="supchips">${[["","Усі робочі",R.length-cnt("archived")],["active","Активні",cnt("active")],["paused","Призупинені",cnt("paused")],["archived","Архів",cnt("archived")]].map(([k,l,n])=>`<a class="chip ${stf===k?"on":""}" href="${qs({st:k})}">${l} <span class="supn">${n}</span></a>`).join("")}</div></form>
 ${F.length?(view==="cards"?cards:table):`<div class="empty"><b>Нічого не знайдено</b></div>`}
 <p class="help">${view==="list"?"Натисніть на заголовок колонки, щоб відсортувати. ":""}Архівні постачальники не показуються у виборі постачальника в товарі.</p>`
 :`<div class="empty"><b>Постачальників ще немає</b>Додайте першого — назву, контакти й умови співпраці.<br><br><a class="btn primary" href="#/admin/supplier/new">Додати постачальника</a></div>`}
 ${none&&L.length?`<p class="help"><a class="textlink" href="#/admin/products?sup=none">${none} товарів без постачальника →</a></p>`:""}`},
supplierEdit(id){const isNew=id==="new",s=isNew?{status:"active"}:this.supById(id);if(!s)return `<div class="empty"><b>Постачальника не знайдено</b><a class="textlink" href="#/admin/suppliers">← Постачальники</a></div>`;
 const f=(k,l,o={})=>`<div class="${o.full?"full":""}"><label>${l}${o.req?' <span class="req">*</span>':""}</label>${o.area?`<textarea class="field" name="${k}" maxlength="${o.max||4000}" style="min-height:${o.h||90}px">${esc(s[k]||"")}</textarea>`:`<input class="field" name="${k}" type="${o.type||"text"}" maxlength="${o.max||200}" value="${esc(s[k]||"")}" placeholder="${esc(o.ph||"")}" ${o.req?"required":""} ${o.list?`list="${o.list}"`:""}>`}${o.help?`<div class="help">${o.help}</div>`:""}</div>`;
 const sel=(k,l,o={})=>`<div><label>${l}</label><select class="field" name="${k}">${o.req?"":`<option value="">— не вказано —</option>`}${this.SUP[k].map(([v,t])=>`<option value="${v}" ${s[k]===v?"selected":""}>${t}</option>`).join("")}</select>${o.help?`<div class="help">${o.help}</div>`:""}</div>`;
 const T=this.SUP.terms,pt=s.payment_terms||"",ptOther=pt&&!T.includes(pt);
 const st=isNew?null:this.supStats(id),P=isNew?[]:S.products.filter(p=>p.supplierId===id);
 return `<div class="ahead"><div><div class="crumbs"><a href="#/admin/suppliers">← Постачальники</a></div><h1>${isNew?"Новий постачальник":esc(s.name)}</h1></div></div>
 <form class="stack" data-form="supplier" data-id="${isNew?"":esc(id)}" novalidate><div class="panel"><h2>Контакти</h2><div class="form">
 ${f("name","Назва",{req:true,max:80,ph:"Напр.: Home Goods Wholesale"})}${f("contact_name","Контактна особа",{max:120})}${f("email","Email",{type:"email"})}${f("phone","Телефон",{type:"tel",max:40})}${f("website","Сайт",{type:"url",max:300,ph:"https://…"})}${f("country","Країна",{max:60,list:"supCountries",ph:"Оберіть або впишіть"})}<datalist id="supCountries">${this.SUP.countries.map(c=>`<option value="${esc(c)}">`).join("")}</datalist>${f("address","Адреса",{full:true,max:300})}</div></div>
 <div class="panel"><h2>Статус і тип</h2><div class="form">${sel("status","Статус",{req:true,help:"«Архів» — постачальник зникає зі списку в товарі, але історія лишається."})}${sel("kind","Тип постачальника")}
  <div><label>Рейтинг (для себе)</label><div class="suprate">${[1,2,3,4,5].map(n=>`<label title="${n} з 5"><input type="radio" name="rating" value="${n}" ${+s.rating===n?"checked":""}><span>★</span></label>`).join("")}<label class="small muted"><input type="radio" name="rating" value="" ${s.rating?"":"checked"}> без оцінки</label></div></div></div></div>
 <div class="panel"><h2>Умови співпраці</h2><div class="form">
  <div><label>Умови оплати</label><select class="field" name="pt_sel" onchange="this.form.pt_other.style.display=this.value==='other'?'':'none';if(this.value==='other')this.form.pt_other.focus()"><option value="">— не вказано —</option>${T.map(t=>`<option ${pt===t?"selected":""}>${esc(t)}</option>`).join("")}<option value="other" ${ptOther?"selected":""}>Інше…</option></select><input class="field" name="pt_other" maxlength="200" placeholder="Опишіть умови оплати" value="${ptOther?esc(pt):""}" style="margin-top:6px${ptOther?"":";display:none"}"></div>
  ${sel("payment_method","Спосіб оплати")}${sel("currency","Валюта закупки")}
  <div><label>Строк поставки, днів</label><div class="suplead"><input class="field" name="lead_days_min" type="number" min="0" max="365" step="1" placeholder="від" value="${s.lead_days_min??""}"><span>–</span><input class="field" name="lead_days_max" type="number" min="0" max="365" step="1" placeholder="до" value="${s.lead_days_max??""}"></div>${s.lead_time&&s.lead_days_min==null&&s.lead_days_max==null?`<div class="help">Було вказано: «${esc(s.lead_time)}»</div>`:""}</div>
  ${sel("shipping","Доставка від постачальника")}${sel("defect_returns","Повернення браку")}
  ${f("min_order","Мінімальне замовлення",{max:100,ph:"Напр.: $300 або 12 шт."})}${f("notes","Нотатки",{full:true,area:true,ph:"Знижки, домовленості, менеджер, як замовляти…"})}</div></div>
 <div id="supErr"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary">${isNew?"Створити постачальника":"Зберегти"}</button><a class="btn" href="#/admin/suppliers">Скасувати</a>${isNew?"":`<button type="button" class="btn danger" data-act="a:supDel" data-id="${esc(id)}" style="margin-left:auto">Видалити</button>`}</div></form>
 ${isNew?"":`<div class="panel" style="margin-top:20px"><h2>Товари цього постачальника <span class="muted" style="font-size:16px">${st.n}</span></h2>${P.length?`<div class="tablewrap"><table class="t"><thead><tr><th>Товар</th><th>SKU постачальника</th><th>Закупка</th><th>Ціна</th><th>Маржа</th><th>Залишок</th></tr></thead><tbody>${P.map(p=>`<tr><td><a href="#/admin/product/${p.id}"><b>${esc(p.name)}</b></a><br><small class="muted">${esc(p.sku||"")}</small></td><td>${esc(p.supplierSku||"—")}${p.supplierUrl?` <a class="textlink small" href="${esc(p.supplierUrl)}" target="_blank" rel="noopener">↗</a>`:""}</td><td>${p.cost==null?"—":money(p.cost)}</td><td>${money(p.price)}</td><td>${p.cost==null||!+p.price?"—":Math.round((p.price-p.cost)/p.price*100)+"%"}</td><td>${p.stock}</td></tr>`).join("")}</tbody></table></div><p class="help">На складі ${st.units} шт. на ${money(st.value)} за закупівельною ціною.${st.margin!=null?` Середня маржа ${st.margin}%.`:""}</p>`:`<p class="muted">Поки немає товарів. Оберіть цього постачальника в товарі (блок «🏭 Постачальник») або додайте товар за SKU на сторінці «Товари».</p>`}</div>`}`},
async supplierSave(f){const fd=Object.fromEntries(new FormData(f)),id=f.dataset.id,err=m=>{$("#supErr").innerHTML=`<div class="note" style="margin-bottom:10px">${m}</div>`};
 const row={};["name","contact_name","email","phone","website","address","country","min_order","notes","status","kind","currency","payment_method","shipping","defect_returns"].forEach(k=>{const v=String(fd[k]||"").trim();row[k]=v||null});
 row.status=row.status||"active";
 row.payment_terms=fd.pt_sel==="other"?(String(fd.pt_other||"").trim()||null):(fd.pt_sel||null);
 row.rating=fd.rating?+fd.rating:null;
 const day=k=>{const v=String(fd[k]||"").trim();return v===""?null:Math.round(+v)};row.lead_days_min=day("lead_days_min");row.lead_days_max=day("lead_days_max");
 if(!row.name){f.name.focus();return err("Вкажіть назву постачальника")}
 if(row.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))return err("Перевірте email");
 if([row.lead_days_min,row.lead_days_max].some(v=>v!=null&&(isNaN(v)||v<0||v>365)))return err("Строк поставки — від 0 до 365 днів");
 if(row.lead_days_min!=null&&row.lead_days_max!=null&&row.lead_days_min>row.lead_days_max)return err("Строк поставки: «від» має бути не більшим за «до»");
 if(row.lead_days_min!=null||row.lead_days_max!=null)row.lead_time=null;
 if(row.website&&!/^https?:\/\//i.test(row.website))row.website="https://"+row.website;
 if((S.suppliers||[]).some(x=>x.id!==id&&x.name.trim().toLowerCase()===row.name.toLowerCase()))return err("Постачальник з такою назвою вже є");
 const btn=f.querySelector("button.primary");btn.disabled=true;
 const q=id?sb.from("suppliers").update(row).eq("id",id).select().single():sb.from("suppliers").insert(row).select().single();
 const{data,error}=await q;btn.disabled=false;
 if(error)return err("Не вдалося зберегти: "+esc(error.message));
 S.suppliers=[...(S.suppliers||[]).filter(x=>x.id!==data.id),data].sort((a,b)=>a.name.localeCompare(b.name));
 toast(id?"Збережено ✓":"Постачальника додано ✓");location.hash=id?"#/admin/suppliers":"#/admin/supplier/"+data.id},
async supplierDelete(id){const s=this.supById(id);if(!s)return;const n=S.products.filter(p=>p.supplierId===id).length;
 if(!confirm(`Видалити постачальника «${s.name}»?`+(n?`\n${n} товарів залишаться, але без постачальника (SKU постачальника й закупівельна ціна збережуться).`:"")))return;
 const{error}=await sb.from("suppliers").delete().eq("id",id);if(error)return toast("⚠️ "+error.message);
 S.suppliers=S.suppliers.filter(x=>x.id!==id);S.products.forEach(p=>{if(p.supplierId===id){p.supplierId="";/* the database already set supplier_id = null (on delete set null) */const prev=Seller.synced&&Seller.synced.sp[p.id];if(prev){const r=JSON.parse(prev);r.supplier_id=null;Seller.synced.sp[p.id]=JSON.stringify(r)}}});toast("Постачальника видалено");location.hash="#/admin/suppliers"},
async supNewInline(){const name=(prompt("Назва нового постачальника:")||"").trim().slice(0,80);if(!name)return;
 let s=(S.suppliers||[]).find(x=>x.name.trim().toLowerCase()===name.toLowerCase());
 if(!s){const{data,error}=await sb.from("suppliers").insert({name}).select().single();if(error)return toast("⚠️ "+error.message);s=data;S.suppliers=[...(S.suppliers||[]),s].sort((a,b)=>a.name.localeCompare(b.name))}
 const sel=$("#supSel");if(sel){if(![...sel.options].some(o=>o.value===s.id))sel.add(new Option(s.name,s.id));sel.value=s.id}toast("Постачальника додано ✓ — контакти можна заповнити в розділі «Постачальники»")},
});
