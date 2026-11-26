/* ===== Seller Central · Характеристики (фільтри каталогу) =====
   Kept in S.settings.filters: [{id, name, values:[{v, c?}], cats:[category ids — empty = all], filter:false — hide from shop filters}].
   Product values live in product.attrs {filterId:[values]} and are picked in the product editor. Nothing is saved until «Зберегти». */
Object.assign(Admin,{
attrUsage(f,v){return S.products.filter(p=>pAttr(p,f.id).includes(v)).length},
attrCatsHtml(f,pref){const on=id=>(f.cats||[]).includes(id);
 return `<div class="attrcats"><label class="check small"><input type="checkbox" name="${pref}all" ${!(f.cats||[]).length?"checked":""} data-ach="attrall"> <b>Усі категорії</b></label>
 ${topCats().map(c=>`<label class="check small"><input type="checkbox" name="${pref}cat" value="${c.id}" ${on(c.id)?"checked":""}> ${esc(c.name)}</label>${subCats(c.id).map(s=>`<label class="check small attrsub"><input type="checkbox" name="${pref}cat" value="${s.id}" ${on(s.id)?"checked":""}> └ ${esc(s.name)}</label>`).join("")}`).join("")}</div>`},
attrValsText(f){return (f.values||[]).map(o=>o.v+(o.c?" "+o.c:"")).join("\n")},
attrForm(f,isNew){const id=isNew?"new":f.id;
 return `<form class="attrform" data-form="attrsave" data-id="${id}" novalidate>
 <div class="attrgrid"><div><label class="lbl">Назва (англійською — її бачать покупці)</label><input class="field" name="name" maxlength="40" value="${esc(f.name||"")}" placeholder="Напр.: Color, Material, Pet size" required></div>
 <div><label class="lbl">Значення — кожне з нового рядка</label><textarea class="field" name="values" rows="5" placeholder="Beige #e8dcc7&#10;White #ffffff&#10;Green #7c9a78">${esc(this.attrValsText(f))}</textarea><div class="help">Для кольору можна додати код кольору після назви (#e8dcc7) — на сайті з'явиться кружечок.</div></div>
 <div><label class="lbl">Для яких категорій</label>${this.attrCatsHtml(f,"")}<label class="check small" style="margin-top:8px"><input type="checkbox" name="filter" ${f.filter===false?"":"checked"}> Показувати як фільтр у каталозі на сайті</label></div></div>
 <div class="acts" style="margin-top:10px"><button class="btn primary sm">${isNew?"Створити характеристику":"Зберегти"}</button>${isNew?`<button type="button" class="btn sm" data-act="a:attrNew">Скасувати</button>`:`<button type="button" class="btn sm" data-act="a:attrEdit" data-id="${f.id}">Скасувати</button><button type="button" class="btn sm danger" data-act="a:attrDel" data-id="${f.id}">Видалити характеристику</button>`}</div></form>`},
attrs(){const F=FILTERS(),catN=f=>!(f.cats||[]).length?`<span class="tag c">Усі категорії</span>`:(f.cats||[]).map(id=>catOf(id)?`<span class="tag c">${esc(catLabel(catOf(id)))}</span>`:"").join("");
 return `<div class="ahead"><div><h1>Характеристики</h1><p class="muted" style="margin:4px 0 0">Колір, матеріал, розмір тощо. Значення вибираються в редакторі товару, а покупці фільтрують за ними каталог.</p></div><button class="btn primary" data-act="a:attrNew">＋ Нова характеристика</button></div>
 <div id="attrNewBox" hidden class="panel">${this.attrForm({name:"",values:[],cats:[]},true)}</div>
 ${F.length?`<div class="panel attrlist">${F.map(f=>{const used=S.products.filter(p=>pAttr(p,f.id).length).length;return `<div class="attrrow" id="attr-${f.id}"><div class="attrsum">
  <div class="attrname"><b>${esc(f.name)}</b>${f.filter===false?`<span class="tag">не фільтр</span>`:""}<small class="muted">заповнено в ${used} ${used===1?"товарі":"товарах"}</small></div>
  <div class="attrvals">${(f.values||[]).map(o=>`<span class="tag">${o.c&&swColor(o.c)?`<span class="swatch" style="background:${swColor(o.c)}"></span>`:""}${esc(o.v)}</span>`).join("")}</div>
  <div class="attrc">${catN(f)}</div><div><button class="btn sm" data-act="a:attrEdit" data-id="${f.id}">Змінити</button></div></div>
  <div class="attredit" hidden>${this.attrForm(f,false)}</div></div>`}).join("")}</div>`:`<div class="empty"><b>Характеристик ще немає</b>Створіть першу — наприклад, Color або Material.</div>`}
 <p class="help">Порада: тримайте значення короткими й однаковими (Beige, а не «beige color»). Видалення значення прибирає його з усіх товарів — кабінет попередить, скільки товарів це зачепить.</p>`},
attrParse(f){const name=f.name.value.trim().slice(0,40),vals=[];
 String(f.values.value).split(/\n+/).map(x=>x.trim()).filter(Boolean).forEach(line=>{const m=line.match(/^(.*?)\s+(#[0-9a-f]{3,8}|conic-gradient\([#0-9a-f,\s]+\))$/i);const v=(m?m[1]:line).trim().slice(0,40),c=m?m[2]:"";
  if(v&&!vals.some(o=>o.v.toLowerCase()===v.toLowerCase()))vals.push(c?{v,c}:{v})});
 const all=f.all.checked,cats=all?[]:[...f.querySelectorAll('[name=cat]:checked')].map(x=>x.value);
 return{name,values:vals.slice(0,60),cats,filter:f.filter.checked}},
attrSubmit(f){const id=f.dataset.id,d=this.attrParse(f);
 if(!d.name){f.name.focus();return toast("Вкажіть назву характеристики")}
 if(!d.values.length){f.values.focus();return toast("Додайте хоча б одне значення")}
 if(!f.all.checked&&!d.cats.length)return toast("Виберіть категорії або «Усі категорії»");
 const F=FILTERS().slice();
 if(F.some(x=>x.id!==id&&x.name.toLowerCase()===d.name.toLowerCase()))return toast("Характеристика з такою назвою вже є");
 if(id==="new"){let nid=translit(d.name)||uid();while(F.some(x=>x.id===nid))nid+="-"+uid().slice(0,3);
  if(!confirm(`Створити характеристику «${d.name}» (${d.values.length} значень)?`))return;
  F.push({id:nid,...d});S.settings.filters=F;save();toast("Характеристику створено ✓");render();return}
 const old=F.find(x=>x.id===id);if(!old)return;
 const removed=(old.values||[]).map(o=>o.v).filter(v=>!d.values.some(o=>o.v===v)),hit=S.products.filter(p=>pAttr(p,id).some(v=>removed.includes(v)));
 const lines=[];if(old.name!==d.name)lines.push(`Назва: ${old.name} → ${d.name}`);
 const added=d.values.map(o=>o.v).filter(v=>!(old.values||[]).some(o=>o.v===v));if(added.length)lines.push("Нові значення: "+added.join(", "));if(removed.length)lines.push("Прибрано значення: "+removed.join(", ")+(hit.length?` (зникнуть із ${hit.length} товарів)`:""));
 if(JSON.stringify(old.cats||[])!==JSON.stringify(d.cats))lines.push("Змінено категорії");if((old.filter!==false)!==d.filter)lines.push(d.filter?"Показувати як фільтр: так":"Показувати як фільтр: ні");
 if(JSON.stringify((old.values||[]).map(o=>o.c||""))!==JSON.stringify(d.values.map(o=>o.c||""))&&!added.length&&!removed.length)lines.push("Змінено кольори або порядок значень");
 if(!lines.length)return toast("Змін немає — нічого не збережено");
 if(!confirm(`Зберегти зміни в «${old.name}»?\n\n${lines.map(x=>"• "+x).join("\n")}`))return;
 hit.forEach(p=>{p.attrs={...p.attrs,[id]:pAttr(p,id).filter(v=>!removed.includes(v))};if(!p.attrs[id].length)delete p.attrs[id]});
 Object.assign(old,d);S.settings.filters=F;save();toast("Збережено ✓");render()},
attrDelete(id){const F=FILTERS(),f=F.find(x=>x.id===id);if(!f)return;const hit=S.products.filter(p=>pAttr(p,id).length);
 if(!confirm(`Видалити характеристику «${f.name}»?${hit.length?`\nЇї значення зникнуть із ${hit.length} товарів.`:""}\nЦе не можна скасувати.`))return;
 hit.forEach(p=>{const a={...p.attrs};delete a[id];p.attrs=a});S.settings.filters=F.filter(x=>x.id!==id);save();toast("Характеристику видалено");render()},
/* product editor: checkboxes for the characteristics of the chosen category */
attrBlock(catId,attrs){const L=filtFor(catId);if(!L.length)return `<p class="help" style="margin:0">Для цієї категорії ще немає характеристик. Додайте їх у розділі <a class="textlink" href="#/admin/attrs">Характеристики</a>.</p>`;
 return L.map(f=>{const cur=Array.isArray(attrs[f.id])?attrs[f.id]:[];return `<div class="attrpick"><b>${esc(f.name)}${f.filter===false?` <span class="muted small">(не фільтр)</span>`:""}</b><div>${(f.values||[]).map(o=>`<label class="chip2 ${cur.includes(o.v)?"on":""}"><input type="checkbox" name="fa_${f.id}" value="${esc(o.v)}" ${cur.includes(o.v)?"checked":""}>${o.c&&swColor(o.c)?`<span class="swatch" style="background:${swColor(o.c)}"></span>`:""}${esc(o.v)}</label>`).join("")}</div></div>`}).join("")+`<p class="help" style="margin:4px 0 0">Можна вибрати кілька значень. Нове значення додається в розділі <a class="textlink" href="#/admin/attrs">Характеристики</a>.</p>`},
attrCollect(form){const cat=form.cat.value,o={};filtFor(cat).forEach(f=>{const v=[...form.querySelectorAll(`[name="fa_${f.id}"]:checked`)].map(x=>x.value);if(v.length)o[f.id]=v});return o},
});
document.addEventListener("change",e=>{const t=e.target;if(!t.closest)return;
 if(t.matches('[data-form="product"] [name=cat]')){const box=$("#attrBox");if(box){const keep=Admin.attrCollect(t.form);box.innerHTML=Admin.attrBlock(t.value,keep)}}
 if(t.matches('.attrpick input[type=checkbox]'))t.closest("label").classList.toggle("on",t.checked);
 if(t.matches('[data-ach="attrall"]')){t.closest(".attrcats").querySelectorAll('[name=cat]').forEach(c=>{if(t.checked)c.checked=false})}
 if(t.matches('.attrcats [name=cat]')&&t.checked){const a=t.closest(".attrcats").querySelector('[name=all]');if(a)a.checked=false}});
