/* ===== Seller Central: sign-in with 2FA + database sync ===== */
const IDLE_MIN=30;
const Seller={state:"loading",email:"",factorId:null,enroll:null,synced:null,syncing:false,again:false,dirty:false,lastAct:Date.now(),
boot(){
 {const m=location.hash.match(/^#\/join\?code=([0-9a-f]{20,64})/i);if(m){sessionStorage.setItem("teamCode",m[1]);history.replaceState(null,"",location.pathname+location.search+"#/admin")}}
 ["mousemove","keydown","click","touchstart","scroll"].forEach(ev=>document.addEventListener(ev,()=>{this.lastAct=Date.now()},{passive:true}));
 setInterval(()=>{if(this.state!=="login"&&this.state!=="loading"&&Date.now()-this.lastAct>IDLE_MIN*60000){this.signOut("Ви вийшли автоматично після 30 хвилин бездіяльності.")}},30000);
 window.addEventListener("beforeunload",e=>{if(this.dirty||this.syncing){e.preventDefault();e.returnValue=""}});
 this.check()},
onAuth(ev){if(ev==="SIGNED_OUT"){this.state="login";this.render0()}},
async check(msg){
 if(!sb){this.state="nosb";return this.render0()}
 const{data}=await sb.auth.getSession();const s=data.session;
 if(!s){this.state="login";this.msg=msg||"";return this.render0()}
 this.email=s.user.email;
 let{data:adm,error}=await sb.from("admins").select("user_id,role").eq("user_id",s.user.id).maybeSingle();
 const code=sessionStorage.getItem("teamCode");
 if(!error&&!adm&&code){const j=await sb.rpc("team_join",{p_code:code});sessionStorage.removeItem("teamCode");
  if(j.error){this.state="noaccess";this.msg=/WRONG_EMAIL/.test(j.error.message)?"Запрошення створене для іншого email. Увійдіть тим email, на який вас запросили.":/EMAIL_NOT_CONFIRMED/.test(j.error.message)?"Спершу підтвердьте email (лист від магазину), потім знову відкрийте посилання із запрошення.":"Посилання-запрошення недійсне або застаріло (діє 7 днів і лише один раз). Попросіть нове.";return this.render0()}
  ({data:adm,error}=await sb.from("admins").select("user_id,role").eq("user_id",s.user.id).maybeSingle())}
 if(error||!adm){this.state="noaccess";this.msg="";return this.render0()}
 sessionStorage.removeItem("teamCode");this.role=adm.role||"owner";
 const{data:aal}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
 if(aal&&aal.currentLevel==="aal2"){
  try{S=await this.loadSup(await fetchCatalog());this.snapshot();this.state="ready";LS.set("noTrack",true);this.chrome();if(!/^#\/admin/.test(location.hash))location.hash="#/admin";else render()}
  catch(e){this.state="error";this.msg=e.message;this.render0()}
  return}
 const{data:f}=await sb.auth.mfa.listFactors();
 const verified=(f&&f.totp||[]).filter(x=>x.status==="verified");
 if(verified.length){this.factorId=verified[0].id;this.state="challenge"}else{this.state="enroll";this.enroll=null}
 this.render0()},
chrome(){
 const r=$("#sellerRight");if(!r)return;
 r.innerHTML=this.state==="ready"?`<span class="syncpill" id="syncPill">✓ Усі зміни збережено</span><span class="muted small hide-sm">${esc(this.email)}</span><button class="btn sm" data-act="a:signout">Вийти</button>`:"";
 document.title="Seller Central — CozyHouseVibe"},
render(parts,q){
 if(this.state!=="ready")return this.render0();
 if(parts[0]!=="admin"){location.hash="#/admin";return}
 const html=Admin.view(parts,q);if(html)app.innerHTML=html;Admin.after(parts);window.scrollTo(0,0);if(!parts[1]||parts[1]==="products")this.refresh();Admin.msgBadge()},
box(title,sub,body){return `<div class="shell section"><div class="authbox"><div class="authhead"><span class="authicon">🔒</span><h1>${title}</h1>${sub?`<p class="muted">${sub}</p>`:""}</div>${body}</div></div>`},
render0(){this.chrome();let h="";
 if(this.state==="loading")h=this.box("Seller Central","",`<p class="muted" style="text-align:center">Перевірка…</p>`);
 else if(this.state==="nosb")h=this.box("Seller Central","",`<div class="note">Не вдалося підключитися до сервера. Перевірте інтернет і оновіть сторінку.</div>`);
 else if(this.state==="error")h=this.box("Помилка","",`<div class="note">${esc(this.msg||"")}</div><button class="btn block" style="margin-top:12px" onclick="location.reload()">Оновити</button>`);
 else if(this.state==="login")h=this.box("Seller Central",sessionStorage.getItem("teamCode")?"Вас запросили в команду магазину. Увійдіть з email, на який прийшло запрошення.":"Вхід для команди магазину",`${this.msg?`<div class="okbox" style="margin-bottom:12px">${esc(this.msg)}</div>`:""}<form class="stack" data-form="s:login" novalidate>
  <div><label class="lbl">Email</label><input class="field" name="email" type="email" autocomplete="username" required></div>
  <div><label class="lbl">Пароль</label><div class="pw"><input class="field" name="password" type="password" autocomplete="current-password" required><button type="button" class="pwtoggle" data-act="pw">Show</button></div></div>
  <div id="sMsg"></div><button class="btn primary block">Далі</button></form>${sessionStorage.getItem("teamCode")?`<p class="small muted" style="margin:12px 0 0">Немає акаунта? <a class="textlink" href="${esc(SITE_URL)}#/account" target="_blank" rel="noopener">Створіть його на сайті</a> цим email, підтвердьте email, а потім знову відкрийте посилання із запрошення.</p>`:""}`);
 else if(this.state==="noaccess")h=this.box("Немає доступу","",`<div class="note">${this.msg?esc(this.msg):`Акаунт <b>${esc(this.email)}</b> не має доступу до кабінету продавця. Якщо вас запросили в команду — відкрийте посилання із запрошення.`}</div><button class="btn block" style="margin-top:12px" data-act="a:signout">Вийти</button>`);
 else if(this.state==="challenge")h=this.box("Код підтвердження","Відкрийте застосунок-автентифікатор і введіть 6-значний код для CozyHouseVibe.",`<form class="stack" data-form="s:verify" novalidate>
  <input class="field otp" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required autofocus>
  <div id="sMsg"></div><button class="btn primary block">Підтвердити</button><button type="button" class="btn ghost block" data-act="a:signout">Скасувати</button></form>`);
 else if(this.state==="enroll"){
  if(!this.enroll){setTimeout(()=>this.startEnroll(),0);h=this.box("Налаштування 2FA","",`<p class="muted" style="text-align:center">Готуємо QR-код…</p>`)}
  else h=this.box("Увімкніть двофакторний вхід","Це потрібно зробити один раз. Далі при кожному вході після пароля ви вводитимете код із телефону.",`<ol class="steps" style="font-size:14px">
   <li>Встановіть на телефон <b>Google Authenticator</b>, <b>Microsoft Authenticator</b> або <b>Authy</b>.</li>
   <li>У застосунку натисніть «+» → «Сканувати QR-код» і наведіть камеру:</li></ol>
   <div class="qr"><img src="${esc(this.enroll.qr)}" alt="QR-код для автентифікатора"></div>
   <details class="small" style="margin:6px 0 14px"><summary>Не виходить сканувати? Введіть ключ вручну</summary><code class="secret">${esc(this.enroll.secret)}</code></details>
   <form class="stack" data-form="s:enroll" novalidate><label class="lbl">3. Введіть 6-значний код із застосунку</label><input class="field otp" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required>
   <div id="sMsg"></div><button class="btn primary block">Увімкнути й увійти</button></form>`)}
 app.innerHTML=h;const i=app.querySelector(".otp");if(i)i.focus()},
async startEnroll(){
 try{const{data:f}=await sb.auth.mfa.listFactors();for(const x of (f&&f.all||[]).filter(x=>x.status==="unverified"))await sb.auth.mfa.unenroll({factorId:x.id});
  const{data,error}=await sb.auth.mfa.enroll({factorType:"totp",friendlyName:"CozyHouseVibe "+new Date().toISOString().slice(0,10),issuer:"CozyHouseVibe Seller"});
  if(error)throw error;this.factorId=data.id;let qr=String(data.totp.qr_code||""),raw=qr;while(raw.startsWith("data:"))raw=raw.slice(raw.indexOf(",")+1);if(raw.trim().startsWith("<"))qr="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(raw.trim());this.enroll={qr,secret:data.totp.secret};this.render0()}
 catch(e){this.state="error";this.msg="Не вдалося налаштувати 2FA: "+e.message;this.render0()}},
sMsg(t){const m=$("#sMsg");if(m)m.innerHTML=`<div class="note">${t}</div>`},
async submit(k,f){const fd=Object.fromEntries(new FormData(f)),btn=f.querySelector("button.primary");btn.disabled=true;
 try{
 if(k==="login"){const email=String(fd.email||"").trim().toLowerCase();if(!email||!fd.password){btn.disabled=false;return this.sMsg("Введіть email і пароль.")}
  const{error}=await sb.auth.signInWithPassword({email,password:fd.password});btn.disabled=false;
  if(error)return this.sMsg(/Invalid login/i.test(error.message)?"Невірний email або пароль.":esc(authErr(error)));
  return this.check()}
 if(k==="verify"||k==="enroll"){const code=String(fd.code||"").replace(/\D/g,"");if(code.length!==6){btn.disabled=false;return this.sMsg("Введіть 6 цифр.")}
  const{error}=await sb.auth.mfa.challengeAndVerify({factorId:this.factorId,code});btn.disabled=false;
  if(error)return this.sMsg(/invalid|expired/i.test(error.message)?"Невірний або застарілий код. Спробуйте наступний код із застосунку.":esc(error.message));
  this.enroll=null;return this.check()}
 }catch(e){btn.disabled=false;this.sMsg(esc(e.message))}},
async signOut(msg){
 if(this.dirty||this.syncing){try{await this.flush()}catch(e){}}
 try{await sb.auth.signOut()}catch(e){}S=normalize(demoState());this.state="login";this.msg=typeof msg==="string"?msg:"";this.synced=null;location.hash="#/";this.render0()},
/* ---- sync S → database ---- */
snapshot(){this.synced={sp:Object.fromEntries(S.products.map(p=>[p.id,JSON.stringify(supRow(p))])),p:Object.fromEntries(S.products.map(p=>[p.id,JSON.stringify(toRow(p))])),c:Object.fromEntries(S.categories.map((c,i)=>[c.id,JSON.stringify({id:c.id,name:c.name,image:c.image||null,position:i,parent_id:c.parent||null})])),s:JSON.stringify(S.settings)}},
pill(t,cls){const p=$("#syncPill");if(p){p.textContent=t;p.className="syncpill "+(cls||"")}},
/* supplier data lives in its own admin-only table (product_suppliers) and is merged into S.products here */
async loadSup(st){let m={};st.suppliers=[];try{const[a,b]=await Promise.all([sb.from("product_suppliers").select("product_id,supplier_id,supplier_sku,cost_price,supplier_url"),sb.from("suppliers").select("*").order("name")]);if(a.error)throw a.error;if(b.error)throw b.error;(a.data||[]).forEach(r=>m[r.product_id]=r);st.suppliers=b.data||[]}catch(e){console.warn("suppliers load failed",e&&e.message)}
 st.products.forEach(p=>{const r=m[p.id]||{};p.supplierId=r.supplier_id||"";p.supplierSku=r.supplier_sku||"";p.cost=r.cost_price==null?null:+r.cost_price;p.supplierUrl=r.supplier_url||""});return st},
queueSync(){if(this.state!=="ready")return;this.dirty=true;this.pill("Збереження…","busy");clearTimeout(this.tm);this.tm=setTimeout(()=>this.flush(),500)},
async upload(dataUrl,prefix){
 const blob=await (await fetch(dataUrl)).blob();const ext=blob.type==="image/png"?"png":blob.type==="image/webp"?"webp":"jpg";
 const path=`${prefix}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
 const{error}=await sb.storage.from("product-images").upload(path,blob,{contentType:blob.type||"image/jpeg",cacheControl:"31536000",upsert:false});
 if(error)throw error;return sb.storage.from("product-images").getPublicUrl(path).data.publicUrl},
async flush(){
 if(this.syncing){this.again=true;return}
 this.syncing=true;this.dirty=false;
 try{
  for(const p of S.products)for(let i=0;i<(p.images||[]).length;i++)if(String(p.images[i]).startsWith("data:"))p.images[i]=await this.upload(p.images[i],"products/"+p.id);
  for(const c of S.categories)if(String(c.image||"").startsWith("data:"))c.image=await this.upload(c.image,"categories");
  if(String(S.settings.heroImage||"").startsWith("data:"))S.settings.heroImage=await this.upload(S.settings.heroImage,"site");
  if(String(S.settings.heroImageMobile||"").startsWith("data:"))S.settings.heroImageMobile=await this.upload(S.settings.heroImageMobile,"site");
  const cats=S.categories.map((c,i)=>({id:c.id,name:c.name,image:c.image||null,position:i,parent_id:c.parent||null}));
  const cUp=cats.filter(c=>this.synced.c[c.id]!==JSON.stringify(c));
  if(cUp.length){const{error}=await sb.from("categories").upsert(cUp);if(error)throw error}
  const rows=S.products.map(toRow);
  const pNew=rows.filter(r=>!this.synced.p[r.id]);
  if(pNew.length){const{error}=await sb.from("products").insert(pNew);if(error)throw error}
  for(const r of rows){const prev=this.synced.p[r.id];if(!prev||prev===JSON.stringify(r))continue;
   const was=JSON.parse(prev),ch={};for(const k in r)if(JSON.stringify(r[k])!==JSON.stringify(was[k]))ch[k]=r[k];
   if(Object.keys(ch).length){const{error}=await sb.from("products").update(ch).eq("id",r.id);if(error)throw error}}
  const sUp=S.products.map(supRow).filter(r=>{const prev=this.synced.sp[r.product_id];return prev!==JSON.stringify(r)&&(hasSup(r)||(prev&&hasSup(JSON.parse(prev))))});
  if(sUp.length){const{error}=await sb.from("product_suppliers").upsert(sUp);if(error)throw error}
  const pDel=Object.keys(this.synced.p).filter(id=>!S.products.some(p=>p.id===id));
  if(pDel.length){const{error}=await sb.from("products").delete().in("id",pDel);if(error)throw error}
  const cDel=Object.keys(this.synced.c).filter(id=>!S.categories.some(c=>c.id===id));
  if(cDel.length){const{error}=await sb.from("categories").delete().in("id",cDel);if(error)throw error}
  if(JSON.stringify(S.settings)!==this.synced.s){const{error}=await sb.from("store_settings").update({data:S.settings}).eq("id",1);if(error)throw error}
  this.snapshot();this.pill("✓ Усі зміни збережено","ok");
 }catch(e){this.dirty=true;this.pill("⚠ Не збережено — повтор…","err");toast("⚠️ Не вдалося зберегти: "+(e.message||e));
  if(/JWT|aal|row-level|permission/i.test(e.message||"")){this.syncing=false;return this.check()}
  clearTimeout(this.tm);this.tm=setTimeout(()=>this.flush(),5000)}
 finally{this.syncing=false;if(this.again){this.again=false;this.flush()}}}
};
Seller.refresh=async function(){
 if(this.state!=="ready"||this.dirty||this.syncing||(window.Admin&&Admin.pendIds&&Admin.pendIds().length))return;
 try{const st=await this.loadSup(await fetchCatalog());if(this.dirty||this.syncing)return;const changed=JSON.stringify(st)!==JSON.stringify(S);S=st;this.snapshot();
  if(changed&&/^#\/admin(\/products|\/categories)?\/?(\?.*)?$/.test(location.hash)&&!document.activeElement.matches("input,textarea,select"))render()}catch(e){}};
const supRow=p=>({product_id:p.id,supplier_id:p.supplierId||null,supplier_sku:String(p.supplierSku||"").trim()||null,cost_price:p.cost==null||p.cost===""||isNaN(+p.cost)?null:Math.round(+p.cost*100)/100,supplier_url:String(p.supplierUrl||"").trim()||null});
const hasSup=r=>!!(r.supplier_id||r.supplier_sku||r.cost_price!=null||r.supplier_url);
window.Seller=Seller;
addEventListener("beforeunload",e=>{if(window.Admin&&((Admin.pendIds&&Admin.pendIds().length)||(Admin.edDirty&&document.querySelector('[data-form="product"]')))){e.preventDefault();e.returnValue=""}});
function refreshAdminCatalog(){setTimeout(()=>Seller.refresh(),400)}
setInterval(()=>{if(document.visibilityState==="visible")Seller.refresh()},60000);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")Seller.refresh()});
