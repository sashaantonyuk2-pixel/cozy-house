/* ===== Seller Central · Постачальники (directory; admin-only table public.suppliers) =====
   Supplier-level details live here once; each product keeps only its supplier SKU, cost price and link. */
Object.assign(Admin,{
supById(id){return (S.suppliers||[]).find(x=>x.id===id)},
supName(id){const s=id&&this.supById(id);return s?s.name:""},
supStats(id){const P=S.products.filter(p=>p.supplierId===id);return{n:P.length,active:P.filter(p=>p.active).length,units:P.reduce((s,p)=>s+(+p.stock||0),0),value:P.reduce((s,p)=>s+(p.cost==null?0:+p.cost*(+p.stock||0)),0),noCost:P.filter(p=>p.cost==null).length}},
suppliers(q){const L=S.suppliers||[],term=(q.get("q")||"").trim().toLowerCase(),F=L.filter(s=>!term||[s.name,s.contact_name,s.email,s.phone,s.notes].some(v=>String(v||"").toLowerCase().includes(term)));
 const none=S.products.filter(p=>!p.supplierId).length;
 return `<div class="ahead"><h1>Постачальники <span class="muted" style="font-size:18px">${L.length}</span></h1><a class="btn primary" href="#/admin/supplier/new">${ICON.plus.replace("<svg",'<svg width="15"')} Додати постачальника</a></div>
 <p class="help" style="margin-top:-8px">Контакти й умови кожного постачальника. У товарі обираєте постачальника й вписуєте його SKU та закупівельну ціну. Покупці цих даних не бачать.</p>
 ${L.length?`<form class="shopbar" onsubmit="event.preventDefault();location.hash='#/admin/suppliers'+(this.q.value.trim()?'?q='+encodeURIComponent(this.q.value.trim()):'')"><label class="search">${ICON.search}<input name="q" value="${esc(q.get("q")||"")}" placeholder="Пошук: назва, контакт, email, телефон, нотатки"></label></form>
 <div class="supgrid">${F.map(s=>{const st=this.supStats(s.id);return `<div class="panel supcard"><div class="supcard-h"><a href="#/admin/supplier/${s.id}"><b>${esc(s.name)}</b></a><a class="btn sm" href="#/admin/supplier/${s.id}">Редагувати</a></div>
  <div class="small supmeta">${s.contact_name?`<div>👤 ${esc(s.contact_name)}</div>`:""}${s.email?`<div>✉️ <a class="textlink" href="mailto:${esc(s.email)}">${esc(s.email)}</a></div>`:""}${s.phone?`<div>📞 <a class="textlink" href="tel:${esc(s.phone.replace(/[^+\d]/g,""))}">${esc(s.phone)}</a></div>`:""}${s.website?`<div>🌐 <a class="textlink" href="${esc(s.website)}" target="_blank" rel="noopener">${esc(s.website.replace(/^https?:\/\//,"").replace(/\/$/,""))}</a></div>`:""}
  ${s.payment_terms?`<div>💳 ${esc(s.payment_terms)}</div>`:""}${s.lead_time?`<div>⏱ Поставка: ${esc(s.lead_time)}</div>`:""}${s.min_order?`<div>📦 Мін. замовлення: ${esc(s.min_order)}</div>`:""}</div>
  <div class="supstats"><a href="#/admin/products?sup=${s.id}"><b>${st.n}</b> товарів →</a><span>на складі <b>${st.units}</b> шт.</span><span>за закупкою <b>${money(st.value)}</b>${st.noCost?` <span class="muted">(${st.noCost} без ціни)</span>`:""}</span></div></div>`}).join("")||`<div class="empty"><b>Нічого не знайдено</b></div>`}</div>`
 :`<div class="empty"><b>Постачальників ще немає</b>Додайте першого — назву, контакти й умови співпраці.<br><br><a class="btn primary" href="#/admin/supplier/new">Додати постачальника</a></div>`}
 ${none&&L.length?`<p class="help"><a class="textlink" href="#/admin/products?sup=none">${none} товарів без постачальника →</a></p>`:""}`},
supplierEdit(id){const isNew=id==="new",s=isNew?{}:this.supById(id);if(!s)return `<div class="empty"><b>Постачальника не знайдено</b><a class="textlink" href="#/admin/suppliers">← Постачальники</a></div>`;
 const f=(k,l,o={})=>`<div class="${o.full?"full":""}"><label>${l}${o.req?' <span class="req">*</span>':""}</label>${o.area?`<textarea class="field" name="${k}" maxlength="${o.max||4000}" style="min-height:${o.h||90}px">${esc(s[k]||"")}</textarea>`:`<input class="field" name="${k}" type="${o.type||"text"}" maxlength="${o.max||200}" value="${esc(s[k]||"")}" placeholder="${esc(o.ph||"")}" ${o.req?"required":""}>`}${o.help?`<div class="help">${o.help}</div>`:""}</div>`;
 const st=isNew?null:this.supStats(id),P=isNew?[]:S.products.filter(p=>p.supplierId===id);
 return `<div class="ahead"><div><div class="crumbs"><a href="#/admin/suppliers">← Постачальники</a></div><h1>${isNew?"Новий постачальник":esc(s.name)}</h1></div></div>
 <form class="stack" data-form="supplier" data-id="${isNew?"":esc(id)}" novalidate><div class="panel"><h2>Контакти</h2><div class="form">
 ${f("name","Назва",{req:true,max:80,ph:"Напр.: Home Goods Wholesale"})}${f("contact_name","Контактна особа",{max:120})}${f("email","Email",{type:"email"})}${f("phone","Телефон",{type:"tel",max:40})}${f("website","Сайт",{type:"url",max:300,ph:"https://…"})}${f("address","Адреса",{full:true,max:300})}</div></div>
 <div class="panel"><h2>Умови співпраці</h2><div class="form">${f("payment_terms","Умови оплати",{ph:"Напр.: передоплата 100% / Net 30"})}${f("lead_time","Строк поставки",{max:100,ph:"Напр.: 5–7 днів"})}${f("min_order","Мінімальне замовлення",{max:100,ph:"Напр.: $300 або 12 шт."})}${f("notes","Нотатки",{full:true,area:true,ph:"Знижки, домовленості, менеджер, як замовляти…"})}</div></div>
 <div id="supErr"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary">${isNew?"Створити постачальника":"Зберегти"}</button><a class="btn" href="#/admin/suppliers">Скасувати</a>${isNew?"":`<button type="button" class="btn danger" data-act="a:supDel" data-id="${esc(id)}" style="margin-left:auto">Видалити</button>`}</div></form>
 ${isNew?"":`<div class="panel" style="margin-top:20px"><h2>Товари цього постачальника <span class="muted" style="font-size:16px">${st.n}</span></h2>${P.length?`<div class="tablewrap"><table class="t"><thead><tr><th>Товар</th><th>SKU постачальника</th><th>Закупка</th><th>Ціна</th><th>Маржа</th><th>Залишок</th></tr></thead><tbody>${P.map(p=>`<tr><td><a href="#/admin/product/${p.id}"><b>${esc(p.name)}</b></a><br><small class="muted">${esc(p.sku||"")}</small></td><td>${esc(p.supplierSku||"—")}${p.supplierUrl?` <a class="textlink small" href="${esc(p.supplierUrl)}" target="_blank" rel="noopener">↗</a>`:""}</td><td>${p.cost==null?"—":money(p.cost)}</td><td>${money(p.price)}</td><td>${p.cost==null||!+p.price?"—":Math.round((p.price-p.cost)/p.price*100)+"%"}</td><td>${p.stock}</td></tr>`).join("")}</tbody></table></div><p class="help">На складі ${st.units} шт. на ${money(st.value)} за закупівельною ціною.</p>`:`<p class="muted">Поки немає товарів. Оберіть цього постачальника в товарі (блок «🏭 Постачальник») або додайте товар за SKU на сторінці «Товари».</p>`}</div>`}`},
async supplierSave(f){const fd=Object.fromEntries(new FormData(f)),id=f.dataset.id,err=m=>{$("#supErr").innerHTML=`<div class="note" style="margin-bottom:10px">${m}</div>`};
 const row={};["name","contact_name","email","phone","website","address","payment_terms","lead_time","min_order","notes"].forEach(k=>{const v=String(fd[k]||"").trim();row[k]=v||null});
 if(!row.name){f.name.focus();return err("Вкажіть назву постачальника")}
 if(row.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))return err("Перевірте email");
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
