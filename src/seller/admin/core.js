/* ===== Seller Central · Seller Central core: menu, router, stock helpers, event handlers =====
   Each section lives in its own file in this folder and adds its methods to Admin. */
const Admin={draft:null,sel:new Set(),
nav(cur){const L=[["","📊","Дашборд"],["orders","🧾","Замовлення"],["chat","💬","Чат"],["messages","✉️","Повідомлення"],["customers","👥","Покупці"],["returns","🔁","Повернення"],["reviews","⭐","Відгуки"],["products","📦","Товари"],["suppliers","🏭","Постачальники"],["seo","🔎","SEO"],["categories","🗂","Категорії"],["settings","⚙️","Налаштування"],["log","🛡","Журнал дій"],["backup","💾","Резервні копії"]];
 return `<nav class="aside" id="adminNav"><button type="button" class="navhide" data-act="a:navToggle" title="Сховати меню" aria-label="Сховати меню">«<span> Сховати меню</span></button>${L.map(([k,i,n])=>`<a href="#/admin${k?"/"+k:""}" class="${cur===k?"on":""}">${i} ${n}${k==="messages"?`<span class="navbadge" id="msgBadge"></span>`:k==="reviews"?`<span class="navbadge" id="revBadge"></span>`:k==="returns"?`<span class="navbadge" id="retBadge"></span>`:k==="chat"?`<span class="navbadge" id="chatBadge"></span>`:k==="products"?(()=>{const n=Admin.lowList().length;return n?`<span class="navbadge warn" title="Закінчуються або немає">${n}</span>`:""})():""}</a>`).join("")}<hr><a href="${SITE_URL}" target="_blank" rel="noopener">🏠 Відкрити магазин ↗</a><a href="#" data-act="a:signout">🚪 Вийти</a></nav>`},
wrap(cur,html){return `<div class="shell admin ${LS.get("navOff",false)?"navoff":""}">${this.nav(cur)}<div class="navrail"><button type="button" data-act="a:navToggle" title="Показати меню" aria-label="Показати меню" aria-controls="adminNav">☰</button></div><div>${html}</div></div>`},
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
 if(k==="returns")return this.wrap("returns",this.returns(q));
 if(k==="suppliers")return this.wrap("suppliers",this.suppliers(q));
 if(k==="supplier")return this.wrap("suppliers",this.supplierEdit(parts[2]));
 return this.wrap("",this.dash())},
after(parts){
 {const pf=document.querySelector('[data-form="product"]');if(pf){const u=()=>this.marginInfo();pf.cost&&pf.cost.addEventListener("input",u);pf.price&&pf.price.addEventListener("input",u);u()}}
 const dz=$("#drop");if(dz){const fi=$("#imgFile");dz.addEventListener("dragover",e=>{e.preventDefault();dz.classList.add("over")});dz.addEventListener("dragleave",()=>dz.classList.remove("over"));dz.addEventListener("drop",e=>{e.preventDefault();dz.classList.remove("over");this.addFiles(e.dataTransfer.files)});fi.addEventListener("change",()=>{this.addFiles(fi.files);fi.value=""})}
 document.querySelectorAll("input[type=file][data-up]").forEach(inp=>inp.addEventListener("change",async()=>{const f=inp.files[0];if(!f)return;const up=inp.dataset.up,url=await toDataURL(f,up==="hero"?2400:up==="heroMobile"?1200:900);if(up==="hero")S.settings.heroImage=url;else if(up==="heroMobile")S.settings.heroImageMobile=url;else{const c=catOf(inp.dataset.up);if(c)c.image=url}save();render();toast("Фото оновлено")}));
 const imp=$("#importFile");if(imp)imp.addEventListener("change",()=>this.importFile(imp.files[0]));
},
/* ---- stock alerts ---- */
lowN(){const v=parseInt(S.settings.lowStock);return isNaN(v)?3:Math.max(0,v)},
stockCls(p){return p.stock<=0?"st-out":p.stock<=this.lowN()?"st-low":""},
lowList(){const t=this.lowN();return S.products.filter(p=>p.active&&p.stock<=t)},
/* ---- handlers ---- */
change(el){const k=el.dataset.ach,id=el.dataset.id,p=id&&prod(id);
 if(k==="sku"&&p){const v=el.value.trim().slice(0,60);if(v&&S.products.some(x=>x!==p&&(x.sku||"").toLowerCase()===v.toLowerCase())){el.value=p.sku||"";return toast("⚠️ Код "+v+" уже є в іншого товару")}p.sku=v;save();toast("Код збережено ✓")}
 else if(["price","oldPrice","stock"].includes(k)&&p){let v=el.value===""?null:Number(el.value);if(k==="price"&&(v==null||v<0)){el.value=p.price;return toast("Ціна не може бути порожньою")}if(k==="stock")v=Math.max(0,Math.round(v||0));p[k]=v;save();toast("Збережено ✓")}
 else if((k==="active"||k==="featured")&&p){p[k]=el.checked;save();toast(el.checked?(k==="active"?"Показано на сайті":"Додано в хіти"):(k==="active"?"Приховано":"Прибрано з хітів"))}
 else if(k==="sel"){el.checked?this.sel.add(id):this.sel.delete(id);$("#selN").textContent="Вибрано: "+this.sel.size}
 else if(k==="selall"){document.querySelectorAll('[data-ach="sel"]').forEach(c=>{c.checked=el.checked;el.checked?this.sel.add(c.dataset.id):this.sel.delete(c.dataset.id)});$("#selN").textContent="Вибрано: "+this.sel.size}
 else if(k==="filtercat"){const f=el.form;const n=new URLSearchParams();const fd=new FormData(f);fd.get("q")&&n.set("q",fd.get("q"));fd.get("cat")&&n.set("cat",fd.get("cat"));fd.get("sup")&&n.set("sup",fd.get("sup"));const cs=new URLSearchParams(location.hash.split("?")[1]||"").get("stock");cs&&n.set("stock",cs);const so=fd.get("sort");so&&so!==(cs?"stock":"new")&&n.set("sort",so);location.hash="#/admin/products"+(n.toString()?"?"+n:"")}
 else if(k==="ostatus"){const v=el.value;el.disabled=true;sb.from("orders").update({status:v}).eq("id",+id).then(({error})=>{el.disabled=false;toast(error?"⚠️ "+error.message:"Статус: "+Admin.ST[v]+(v==="cancelled"?" · товари повернено на склад":""));if(!error){const o=Admin.ordersData.find(x=>x.id===+id);if(o)o.status=v;refreshAdminCatalog();if($("#ordPage"))Admin.fillOrder(+id)}})}
 else if(k==="carrierpick"){const o=el.form.carrier_other;o.hidden=el.value!=="Other";if(!o.hidden)o.focus()}
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
 navToggle:()=>{const w=el.closest(".admin");if(!w)return;const off=!w.classList.contains("navoff");w.classList.toggle("navoff",off);LS.set("navOff",off);const f=w.querySelector(off?".navrail button":".navhide");f&&f.focus({preventScroll:true})},
 moveStorage:()=>Admin.moveToStorage(el),
 supNewInline:()=>{e.preventDefault();Admin.supNewInline()},
 supDel:()=>Admin.supplierDelete(id),
 retSet:()=>Admin.retSet(id,el.dataset.v,el),
 reloadReturns:()=>Admin.fillReturns(new URLSearchParams(location.hash.split("?")[1]||"").get("status")||"requested"),
 custExport:()=>Admin.custExport(),
 dashP:()=>{const p=el.dataset.p;sessionStorage.setItem("dashP",p);if(p==="custom"&&!sessionStorage.getItem("dashFrom")){const d=new Date();sessionStorage.setItem("dashTo",Admin.dISO(d));d.setDate(d.getDate()-29);sessionStorage.setItem("dashFrom",Admin.dISO(d))}render()},
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
 if(k==="dashrange")return this.dashRange(f);
 if(k==="supadd")return this.supAdd(f);
 if(k==="supplier")return this.supplierSave(f);
 if(k==="opay"||k==="orefund"||k==="onote"||k==="oaddr")return this.orderSubmit(k,f);
 if(k==="chatreply"){const body=f.body.value.trim(),id=f.dataset.id;if(!body)return;const b=f.querySelector("button.primary");b.disabled=true;
  sb.from("chat_messages").insert({thread_id:id,sender:"seller",body}).then(({error})=>{b.disabled=false;if(error)return toast("⚠️ "+error.message);f.body.value="";this.chatSig="";this.fillChat(id)});return}
 if(k==="ret"){const id=+f.dataset.id,reason=f.reason.value+(f.note.value.trim()?": "+f.note.value.trim():"");const b=f.querySelector("button.primary");b.disabled=true;
  sb.from("orders").update({status:"returned",return_reason:reason}).eq("id",id).then(({error})=>{b.disabled=false;if(error)return toast("⚠️ "+error.message);toast("Повернення оформлено · товари повернено на склад");refreshAdminCatalog();this.afterOrderChange(id)});return}
 if(k==="ship"){const id=+f.dataset.id,other=f.carrier.value==="Other",carrier=other?(f.carrier_other.value.trim()||"Other"):f.carrier.value,tracking=f.tracking.value.trim(),eta=f.eta.value||null;
  if(other&&!f.carrier_other.value.trim()){f.carrier_other.focus();return toast("Вкажіть назву служби доставки")}
  if(/[А-Яа-яІіЇїЄєҐґ]/.test(carrier)){f.carrier_other.focus();return toast("Назву служби напишіть англійською — її бачить покупець")}
  const b=f.querySelector("button.primary");b.disabled=true;
  sb.from("orders").update({status:"shipped",carrier,tracking_number:tracking||null,delivery_eta:eta}).eq("id",id).then(({error})=>{b.disabled=false;if(error)return toast("⚠️ "+error.message);toast("Позначено відправленим"+(tracking?" · трек "+tracking:"")+(eta?" · доставка "+Admin.day(eta):""));this.afterOrderChange(id)});return}
 if(k==="tgToken"){const tok=f.token.value.trim();const b=f.querySelector("button");b.disabled=true;sb.rpc("seller_set_telegram_token",{token:tok}).then(({data,error})=>{b.disabled=false;if(!error&&data==="same"){f.reset();toast("Цей токен уже збережено — підключення не змінилось");Admin.tgStatus();return}if(error)return toast(/BAD_TOKEN/.test(error.message)?"⚠️ Це не схоже на токен бота. Скопіюйте його з @BotFather повністю.":"⚠️ "+error.message);f.reset();toast("Токен збережено. Тепер крок 3.");Admin.tgStatus()});return}
 if(k==="aprodfilter"){const fd=new FormData(f),n=new URLSearchParams();fd.get("q")&&n.set("q",fd.get("q"));fd.get("cat")&&n.set("cat",fd.get("cat"));fd.get("sup")&&n.set("sup",fd.get("sup"));const cs=new URLSearchParams(location.hash.split("?")[1]||"").get("stock");cs&&n.set("stock",cs);const so=fd.get("sort");so&&so!==(cs?"stock":"new")&&n.set("sort",so);location.hash="#/admin/products"+(n.toString()?"?"+n:"");return}
 if(k==="catadd"){const n=f.name.value.trim();if(!n)return;let id=translit(n)||uid();if(catOf(id))id+="-"+uid().slice(0,3);S.categories.push({id,name:n,image:""});save();chrome();render();toast("Категорію додано");return}
 if(k==="settings"){delete S.settings.freeFrom;const fd=new FormData(f),NUM={shipStandard:12,shipExpress:25,returnDays:14},R={};let bad="";
  String(fd.get("taxRatesText")||"").split(/[\n;]+/).map(x=>x.trim()).filter(Boolean).forEach(x=>{const m=x.toUpperCase().match(/^([A-Z]{2})\s*[=:\s]\s*(\d+(?:[.,]\d+)?)\s*%?$/);const r=m&&+m[2].replace(",",".");if(!m||r>20)bad=bad||x;else R[m[1]]=r});
  if(bad){const t=f.querySelector("[name=taxRatesText]");t&&t.focus();return toast("⚠️ Не зрозумів рядок податку «"+bad+"». Формат: FL=7 (до 20%). Нічого не збережено.")}
  for(const[key,v]of fd.entries()){if(key==="taxRatesText")continue;if(key in NUM){const n=Number(String(v).replace(",","."));S.settings[key]=v===""||isNaN(n)||n<0?NUM[key]:n}else if(key==="expressOn"||key==="taxShipping"||key==="paymentsOn")S.settings[key]=v==="1";else S.settings[key]=String(v)}
  S.settings.taxRates=R;save();chrome();toast("Налаштування збережено ✓");return}
 if(k==="product"){const fd=new FormData(f);const name=String(fd.get("name")).trim(),price=fd.get("price");
  f.name.style.borderColor=name?"":"#c0563a";f.price.style.borderColor=price!==""?"":"#c0563a";
  if(!name||price===""){$("#pErr").innerHTML='<div class="note" style="margin-bottom:10px">Вкажіть назву й ціну</div>';return}
  const sk=fd.getAll("sk"),sv=fd.getAll("sv"),on=fd.getAll("on"),ov=fd.getAll("ov");
  const options=on.map((n,i)=>({name:n.trim().slice(0,40),values:[...new Set(String(ov[i]||"").split(",").map(x=>x.trim().slice(0,40)).filter(Boolean))].slice(0,20)})).filter(o=>o.name&&o.values.length).slice(0,5);
  if(new Set(options.map(o=>o.name.toLowerCase())).size!==options.length){$("#pErr").innerHTML='<div class="note" style="margin-bottom:10px">Назви параметрів варіантів мають бути різними</div>';return}
  const data={name,short:String(fd.get("short")).trim(),desc:String(fd.get("desc")).trim(),price:Number(price),oldPrice:fd.get("oldPrice")?Number(fd.get("oldPrice")):null,stock:Math.max(0,parseInt(fd.get("stock"))||0),sku:String(fd.get("sku")).trim(),cat:fd.get("cat"),active:!!fd.get("active"),featured:!!fd.get("featured"),supplierId:String(fd.get("supplierId")||""),supplierSku:String(fd.get("supplierSku")||"").trim().slice(0,80),cost:fd.get("cost")===""||fd.get("cost")==null?null:Math.max(0,Math.round(Number(fd.get("cost"))*100)/100),supplierUrl:String(fd.get("supplierUrl")||"").trim().slice(0,500),images:[...this.draft.images],specs:sk.map((x,i)=>[x.trim(),(sv[i]||"").trim()]).filter(s=>s[0]||s[1]),options};
  if(data.supplierUrl&&!/^https?:\/\//i.test(data.supplierUrl)){$("#pErr").innerHTML='<div class="note" style="margin-bottom:10px">Посилання на постачальника має починатися з https://</div>';return}
  if(data.supplierSku){const dup=S.products.find(x=>x.id!==this.draft._for&&(x.supplierSku||"").toLowerCase()===data.supplierSku.toLowerCase()&&(x.supplierId||"")===data.supplierId);if(dup&&!confirm(`SKU постачальника «${data.supplierSku}» уже є в товарі «${dup.name}». Все одно зберегти?`))return}
  const id=this.draft._for;if(id==="new"){S.products.push({id:uid(),created:Date.now(),...data})}else Object.assign(prod(id),data);
  this.draft=null;save();toast(id==="new"?"Товар створено ✓":"Зміни збережено ✓");location.hash="#/admin/products"}},
};
function toDataURL(file,max){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{let w=im.naturalWidth,h=im.naturalHeight;const k=Math.min(1,max/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);res(c.toDataURL("image/jpeg",.84))};im.src=r.result};r.readAsDataURL(file)})}
function download(name,text,type){const b=new Blob([text],{type});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function translit(s){const m={а:"a",б:"b",в:"v",г:"h",ґ:"g",д:"d",е:"e",є:"ie",ж:"zh",з:"z",и:"y",і:"i",ї:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ь:"",ю:"iu",я:"ia","'":"","’":""};return s.toLowerCase().split("").map(c=>m[c]??c).join("").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,30)}

document.addEventListener("keydown",e=>{const f=e.target.closest&&e.target.closest('[data-form="chatreply"]');if(f&&e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();f.requestSubmit()}});
