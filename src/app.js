/* ===== core ===== */
const EMBED=JSON.parse(document.getElementById("store-data").textContent||"null");
const SELLER=!!window.SELLER_MODE;
const $=s=>document.querySelector(s);
const app=$("#app");
let S=null; // store state
const LS={get(k,d){try{const v=localStorage.getItem("chv_"+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem("chv_"+k,JSON.stringify(v))}catch(e){}}};
let lang="en";
const t=k=>(I18N[lang]||I18N.uk)[k]??I18N.uk[k]??k;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const money=n=>{n=Number(n)||0;const v=n.toLocaleString(lang==="en"?"en-US":"uk-UA",{maximumFractionDigits:2});const c=S.settings.currency||"";return S.settings.currencyPos==="before"?c+v:v+" "+c};
const ICON={
bag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1 13H5z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>',
heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20s-7-4.4-9-9.2C1.7 7.4 4 4 7.4 4c2 0 3.6 1.2 4.6 2.8C13 5.2 14.6 4 16.6 4 20 4 22.3 7.4 21 10.8 19 15.6 12 20 12 20z"/></svg>',
plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'};

/* ===== data: embedded snapshot + live database ===== */
function save(){if(SELLER&&window.Seller)Seller.queueSync()}
function normalize(st){const d=demoState().settings;st.settings={...d,...(st.settings||{}),lang:"en"};return st}
const fromRow=r=>({id:r.id,name:r.name,sku:r.sku||"",cat:r.category_id||"",price:+r.price,oldPrice:r.old_price==null?null:+r.old_price,stock:r.stock,active:r.active,featured:r.featured,short:r.short_description||"",desc:r.description||"",specs:Array.isArray(r.specs)?r.specs:[],images:Array.isArray(r.images)?r.images:[],options:Array.isArray(r.options)?r.options:[],created:Date.parse(r.created_at)||Date.now()});
const toRow=p=>({id:p.id,name:p.name,sku:p.sku||null,category_id:p.cat||null,price:+p.price||0,old_price:p.oldPrice==null||p.oldPrice===""?null:+p.oldPrice,stock:Math.max(0,parseInt(p.stock)||0),active:!!p.active,featured:!!p.featured,short_description:p.short||null,description:p.desc||null,specs:p.specs||[],images:p.images||[],options:p.options||[]});
async function fetchCatalog(){
 const[c,p,s,rv]=await Promise.all([sb.from("categories").select("*").order("position"),sb.from("products").select("*").order("created_at",{ascending:false}),sb.from("store_settings").select("data").eq("id",1).maybeSingle(),sb.from("reviews").select("id,product_id,name,rating,title,body,verified,created_at").eq("status","approved").order("created_at",{ascending:false}).limit(1000)]);
 const err=c.error||p.error||s.error;if(err)throw err;
 return normalize({version:3,settings:(s.data&&s.data.data)||{},categories:c.data.map(x=>({id:x.id,name:x.name,image:x.image||""})),products:p.data.map(fromRow),reviews:rv&&!rv.error&&Array.isArray(rv.data)?rv.data:[]})}
async function load(){
 if(SELLER){S=normalize(demoState());return}
 const cached=LS.get("catalog",null);
 S=normalize(cached&&cached.products?cached:(EMBED?JSON.parse(JSON.stringify(EMBED)):demoState()));
 S.products.forEach(p=>{p.images=(p.images||[]).map(u=>String(u).startsWith("photo:")?PHOTO[u.slice(6)]||"":u)});
 refreshCatalog();
}
async function refreshCatalog(){
 if(!sb)return;
 try{const st=await fetchCatalog();const changed=JSON.stringify(st)!==JSON.stringify(S);S=st;LS.set("catalog",st);
  if(changed){chrome();if(!/^#\/(checkout|account|order)/.test(location.hash))render()}}
 catch(e){console.warn("catalog load failed",e&&e.message)}}

/* ===== visitor state ===== */
let cart=LS.get("cart",[]),favs=LS.get("favs",[]);
const prod=id=>S.products.find(p=>p.id===id);
const catOf=id=>S.categories.find(c=>c.id===id);
const visible=()=>S.products.filter(p=>p.active);
/* options (variants): p.options=[{name:"Color",values:["Sage","Oat"]}], cart line {id,qty,opt:{Color:"Sage"}} */
const optList=p=>(p&&Array.isArray(p.options)?p.options:[]).filter(o=>o&&o.name&&Array.isArray(o.values)&&o.values.length);
const lkey=l=>l.id+"|"+(l.opt?Object.keys(l.opt).sort().map(k=>k+"="+l.opt[k]).join("&"):"");
const optStr=(opt,p)=>{if(!opt||typeof opt!=="object")return"";const ks=p?optList(p).map(o=>o.name).filter(k=>k in opt):Object.keys(opt);return(ks.length?ks:Object.keys(opt)).map(k=>k+": "+opt[k]).join(" · ")};
const optOk=(l,p)=>optList(p).every(o=>l.opt&&o.values.includes(l.opt[o.name]));
function cartLines(){return cart.map(l=>({...l,k:lkey(l),p:prod(l.id)})).filter(l=>l.p&&l.p.active&&optOk(l,l.p))}
function lineMax(l){const p=prod(l.id);if(!p)return 0;const k=lkey(l);return Math.max(0,p.stock-cart.filter(x=>x.id===l.id&&lkey(x)!==k).reduce((s,x)=>s+x.qty,0))}
const lineByKey=k=>cart.find(x=>lkey(x)===k);
function cartTotal(){return cartLines().reduce((s,l)=>s+l.p.price*l.qty,0)}
function setCart(c){cart=c;LS.set("cart",cart);badges()}
function addToCart(id,q=1,opt=null){const p=prod(id);if(!p||p.stock<=0)return;
 if(optList(p).length&&!opt){closeLayers(true);location.hash="#/product/"+id;toast("Please choose "+optList(p).map(o=>o.name.toLowerCase()).join(" and "));return}
 const nl={id,qty:0,...(opt?{opt}:{})},k=lkey(nl);let l=lineByKey(k);if(!l){l=nl;cart.push(l)}
 const max=lineMax(l);if(max<=l.qty){if(!l.qty)cart=cart.filter(x=>x!==l);toast(max?"You already have all "+max+" in your cart":"No more in stock");return}
 l.qty=Math.min(max,l.qty+q);setCart(cart);openCart()}
function optsHtml(p,scope){const L=optList(p);if(!L.length)return"";
 return `<div class="opts" data-scope="${scope}">${L.map((o,i)=>`<fieldset class="optset"><legend>${esc(o.name)}: <b class="optval"></b></legend><div class="optchips">${o.values.map(v=>`<label class="optchip"><input type="radio" name="${scope}-o${i}" value="${esc(v)}" data-oname="${esc(o.name)}" data-act="optpick"><span>${esc(v)}</span></label>`).join("")}</div></fieldset>`).join("")}</div>`}
function readOpts(p,scope){const L=optList(p);if(!L.length)return{ok:true,opt:null};const box=document.querySelector(`.opts[data-scope="${scope}"]`),opt={};
 for(const o of L){const c=box&&[...box.querySelectorAll("input:checked")].find(i=>i.dataset.oname===o.name);if(!c){if(box){box.classList.add("need");const fs=[...box.querySelectorAll(".optset")].find(f=>f.querySelector(`[data-oname="${CSS.escape(o.name)}"]`));fs&&fs.scrollIntoView({block:"center",behavior:"smooth"})}toast("Please choose "+o.name.toLowerCase());return{ok:false}}opt[o.name]=c.value}
 return{ok:true,opt}}

/* reviews */
const revsOf=id=>(S.reviews||[]).filter(r=>r.product_id===id);
function rating(id){const R=revsOf(id);return R.length?{avg:R.reduce((s,r)=>s+(+r.rating||0),0)/R.length,n:R.length}:null}
function stars(v,size){const pct=Math.max(0,Math.min(100,v/5*100));return `<span class="stars" role="img" aria-label="${(+v).toFixed(1)} out of 5 stars"${size?` style="font-size:${size}px"`:""}><span class="s-bg" aria-hidden="true">★★★★★</span><span class="s-fg" aria-hidden="true" style="width:${pct}%">★★★★★</span></span>`}
const fmtDate=d=>new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
function toggleFav(id){favs=favs.includes(id)?favs.filter(x=>x!==id):[...favs,id];LS.set("favs",favs);badges();document.querySelectorAll(`[data-act="fav"][data-id="${id}"]`).forEach(b=>b.classList.toggle("on",favs.includes(id)))}
function badges(){$("#cartCount").textContent=cart.reduce((s,l)=>s+(prod(l.id)?l.qty:0),0)||"";$("#favCount").textContent=favs.filter(prod).length||""}
let toastT;function toast(msg,extra=""){const el=$("#toast");el.innerHTML="<span>"+esc(msg)+"</span>"+extra;el.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove("show"),2800)}
const img0=p=>p.images&&p.images[0]||art("vase","#efece4","#e4ddd0");
function stockState(p){return p.stock<=0?"out":p.stock<=3?"low":"in"}
const nItems=n=>{if(lang==="en")return n+" "+(n===1?"item":"items");const m=n%10,h=n%100;return n+" "+(m===1&&h!==11?"товар":m>=2&&m<=4&&(h<12||h>14)?"товари":"товарів")};
const isNew=p=>Date.now()-(p.created||0)<14*86400000&&!p.oldPrice;


/* ===== search (Amazon-style) ===== */
const norm=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const tokens=q=>norm(q).split(/[^a-z0-9\u0400-\u04ff]+/).filter(Boolean);
const stem=w=>w.length>4&&/(ches|shes|xes|sses)$/.test(w)?w.slice(0,-2):w.length>3&&/[^s]s$/.test(w)?w.slice(0,-1):w;
function near(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,e=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++e>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++}}return e+(a.length-i)+(b.length-j)<=1}
function scoreOf(p,toks){
 const c=catOf(p.cat),name=norm(p.name),cat=norm(c?c.name:""),rest=norm([p.short,p.desc,p.sku,...(p.specs||[]).flat()].join(" "));
 const nw=name.split(/[^a-z0-9\u0400-\u04ff]+/).filter(Boolean),aw=(cat+" "+rest).split(/[^a-z0-9\u0400-\u04ff]+/).filter(Boolean);
 let s=0;
 for(const t of toks){let b=0;
  const st=stem(t);
  if(nw.some(w=>w.startsWith(t)||stem(w)===st))b=10;else if(name.includes(t))b=7;else if(cat.includes(t))b=6;else if(aw.some(w=>w.startsWith(t)))b=4;
  else if(aw.some(w=>stem(w)===st))b=4;
  else if(t.length>=4&&nw.concat(cat.split(/[^a-z0-9\u0400-\u04ff]+/)).some(w=>w.length>=4&&((st.length>=4&&near(st,stem(w)))||near(t,w)||near(t,w.slice(0,t.length)))))b=2;
  if(!b)return 0;s+=b}
 if(name.startsWith(toks.join(" ")))s+=5;if(p.stock>0)s+=1;if(p.featured)s+=.5;return s}
function searchProducts(q,cat){const toks=tokens(q);if(!toks.length)return[];return visible().filter(p=>!cat||p.cat===cat).map(p=>[p,scoreOf(p,toks)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).map(x=>x[0])}
function hl(text,toks){let h=esc(text);toks.filter(t=>t.length>1).forEach(t=>{h=h.replace(new RegExp("("+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig"),"\u0001$1\u0002")});return h.replace(/\u0001/g,"<mark>").replace(/\u0002/g,"</mark>")}
const shopLink=(q,cat)=>{const n=new URLSearchParams();if(q)n.set("q",q);if(cat)n.set("cat",cat);return"#/shop"+(n.toString()?"?"+n:"")};
const HS={i:-1,items:[]};
const hsIn=()=>$("#hsInput"),hsCat=()=>$("#hsCat"),hsList=()=>$("#hsList");
function hsOpen(html){const l=hsList();l.innerHTML=html;l.hidden=false;hsIn().setAttribute("aria-expanded","true")}
function hsClose(){const l=hsList();if(!l)return;l.hidden=true;l.innerHTML="";HS.i=-1;HS.items=[];hsIn().setAttribute("aria-expanded","false")}
function hsRender(){
 const q=hsIn().value.trim(),cat=hsCat().value;HS.i=-1;HS.items=[];
 const ic='<span class="ic">'+ICON.search+'</span>';
 if(!q){const rec=LS.get("recent",[]);if(!rec.length)return hsClose();
  HS.items=rec.map(r=>shopLink(r,""));
  return hsOpen(`<div class="hs-label"><span>${t("recent")}</span><button type="button" data-act="hsclear">${t("clear")}</button></div>`+rec.map((r,i)=>`<div class="hs-item q" role="option" data-i="${i}">${ic}<span class="tx">${esc(r)}</span><span></span></div>`).join(""))}
 const toks=tokens(q),res=searchProducts(q,cat),top=res.slice(0,6);
 const catIds=[...new Set(res.map(p=>p.cat).filter(Boolean))].filter(id=>id!==cat).slice(0,2);
 let html=`<div class="hs-item q" role="option" data-i="0">${ic}<span class="tx">${t("searchFor")} “<em>${esc(q)}</em>”${cat&&catOf(cat)?` ${t("inCat")} ${esc(catOf(cat).name)}`:""}</span><span></span></div>`;HS.items.push(shopLink(q,cat));
 catIds.forEach(id=>{HS.items.push(shopLink(q,id));html+=`<div class="hs-item q" role="option" data-i="${HS.items.length-1}">${ic}<span class="tx">${esc(q)} <small style="display:inline">${t("inCat")}</small> <em>${esc(catOf(id).name)}</em></span><span></span></div>`});
 if(top.length){html+=`<div class="hs-sep"></div><div class="hs-label"><span>${t("products")}</span></div>`;top.forEach(p=>{HS.items.push("#/product/"+p.id);const c=catOf(p.cat);html+=`<div class="hs-item" role="option" data-i="${HS.items.length-1}"><img src="${esc(img0(p))}" alt=""><span class="tx">${hl(p.name,toks)}<small>${esc(c?c.name:"")}${p.stock<=0?" · "+t("out"):""}</small></span><span class="pr ${p.oldPrice>p.price?"sale":""}">${money(p.price)}</span></div>`})}
 else html+=`<div class="hs-empty">${t("noMatch")} “${esc(q)}”</div>`;
 hsOpen(html)}
function hsMove(d){const els=[...hsList().querySelectorAll(".hs-item")];if(!els.length)return;HS.i=(HS.i+d+els.length)%els.length;els.forEach((e,i)=>e.classList.toggle("on",i===HS.i));els[HS.i].scrollIntoView({block:"nearest"})}
function hsGo(href,q){if(q){const r=[q,...LS.get("recent",[]).filter(x=>norm(x)!==norm(q))].slice(0,6);LS.set("recent",r)}hsClose();hsIn().blur();if(location.hash===href)render();else location.hash=href}
function hsSetup(){
 const inp=hsIn(),f=$("#hsearch");
 hsCat().innerHTML=`<option value="">${t("allShort")}</option>`+S.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 inp.placeholder=t("searchPh");
 if(f.dataset.ready)return;f.dataset.ready=1;
 inp.addEventListener("input",hsRender);inp.addEventListener("focus",hsRender);
 hsCat().addEventListener("change",()=>{if(inp.value.trim())hsRender()});
 inp.addEventListener("keydown",e=>{if(hsList().hidden&&e.key!=="Enter"){if(e.key==="ArrowDown")hsRender();return}
  if(e.key==="ArrowDown"){e.preventDefault();hsMove(1)}else if(e.key==="ArrowUp"){e.preventDefault();hsMove(-1)}else if(e.key==="Escape"){hsClose()}
  else if(e.key==="Enter"&&HS.i>=0){e.preventDefault();const href=HS.items[HS.i];hsGo(href,href.startsWith("#/shop")?new URLSearchParams(href.split("?")[1]).get("q"):"")}});
 f.addEventListener("submit",e=>{e.preventDefault();const q=inp.value.trim();if(!q&&!hsCat().value)return;hsGo(shopLink(q,hsCat().value),q)});
 hsList().addEventListener("mousedown",e=>{const it=e.target.closest(".hs-item");if(!it)return;e.preventDefault();const href=HS.items[+it.dataset.i];hsGo(href,href.startsWith("#/shop")?new URLSearchParams(href.split("?")[1]).get("q"):"")});
 document.addEventListener("mousedown",e=>{if(!e.target.closest("#hsearch"))hsClose()});
}
function hsSync(path,q){if(path==="/shop"){hsIn().value=q.get("q")||"";hsCat().value=q.get("cat")||""}else if(path==="/"){hsIn().value="";hsCat().value=""}}

/* ===== chrome ===== */
function chrome(){
 if(SELLER)return Seller.chrome();
 const st=S.settings;document.title=st.name+(st.tagline?" — "+st.tagline:"");
 $("#promo").textContent=st.promo||"";$("#brandName").textContent=st.name;$("#brandTag").textContent=st.tagline||"";
 $("#nav").innerHTML=[["#/",t("home")],["#/shop",t("shop")],["#/delivery",t("delivery")],["#/about","Our story"],["#/contacts",t("contacts")]].map(([h,l])=>`<a href="${h}">${esc(l)}</a>`).join("")+`<a href="#/account" class="navacct" id="navAcct">${user?"My account":"Sign in / Register"}</a>`;
 const c=S.settings;
 const logo=($(".brand img")||{}).src||"";
 $("#footer").innerHTML=`<div class="shell foot"><div><a class="footlogo" href="#/">${logo?`<img src="${esc(logo)}" alt="" width="48" height="48">`:""}<span>${esc(c.name)}</span></a><p>${esc(c.tagline)}</p>${c.hours?`<p>${esc(c.hours)}</p>`:""}</div>
 <div><h4>${t("shop")}</h4><a href="#/shop">${t("allCats")}</a>${S.categories.slice(0,6).map(x=>`<a href="#/shop?cat=${x.id}">${esc(x.name)}</a>`).join("")}</div>
 <div><h4>${t("contacts")}</h4>${c.phone?`<a href="tel:${esc(c.phone.replace(/[^+\d]/g,""))}">${esc(c.phone)}</a>`:""}${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:""}${c.telegram?`<a href="https://t.me/${esc(c.telegram.replace(/^@/,""))}" target="_blank" rel="noopener">Telegram</a>`:""}${c.instagram?`<a href="https://instagram.com/${esc(c.instagram.replace(/^@/,""))}" target="_blank" rel="noopener">Instagram</a>`:""}<a href="#/contacts">Contact us</a></div>
 <div><h4>Help</h4><a href="#/delivery">${t("delivery")}</a><a href="#/returns">Returns &amp; refunds</a><a href="#/privacy">Privacy policy</a><a href="#/terms">Terms of service</a><a href="#/about">Our story</a></div></div>
 <div class="shell copy"><span>© ${new Date().getFullYear()} ${esc(c.name)}. ${t("rights")}.</span></div>`;
 hsSetup();badges();acctBadge();
}
function markNav(path){document.querySelectorAll("#nav a").forEach(a=>{const h=a.getAttribute("href").slice(1);a.classList.toggle("active",h==="/"?path==="/":path.startsWith(h))});$("#nav").classList.remove("open")}


/* ===== layers: mini cart, quick view, filter drawer ===== */
const X='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
let lastFocus=null;
function openLayer(id){closeLayers(true);lastFocus=document.activeElement;const el=$("#"+id);el.classList.add(id==="qv"?"show":"open");$("#overlay").classList.add("show");document.body.classList.add("locked");setTimeout(()=>{const f=el.querySelector("[data-autofocus]")||el.querySelector("button,a,input");f&&f.focus({preventScroll:true})},60)}
function closeLayers(silent){["cartDrawer","filters"].forEach(i=>{const e=document.getElementById(i);e&&e.classList.remove("open")});const q=$("#qv");q&&q.classList.remove("show");$("#overlay").classList.remove("show");document.body.classList.remove("locked");if(!silent&&lastFocus&&lastFocus.focus)try{lastFocus.focus({preventScroll:true})}catch(e){}}
function renderMini(){
 const L=cartLines(),tot=cartTotal(),ff=+S.settings.freeFrom||0,n=L.reduce((s,l)=>s+l.qty,0);
 $("#cartDrawer").innerHTML=`<div class="dhead"><h3>${t("yourCart")} <span class="muted">(${n})</span></h3><button class="iconbtn" data-act="closeall" aria-label="${t("close")}" data-autofocus>${X}</button></div>
 ${L.length?`<div class="dbody">${ff?`<div class="ship"><div>${tot>=ff?t("freeOk"):t("freeLeft")+"<b>"+money(ff-tot)+"</b>"}</div><div class="bar"><i style="width:${Math.min(100,Math.round(tot/ff*100))}%"></i></div></div>`:""}
 ${L.map(l=>`<div class="mline"><a href="#/product/${l.p.id}"><img src="${esc(img0(l.p))}" alt=""></a><div class="mi"><a href="#/product/${l.p.id}" class="mn">${esc(l.p.name)}</a>${l.opt?`<span class="optline">${esc(optStr(l.opt,l.p))}</span>`:""}<span class="muted small">${money(l.p.price)}</span>
 <div class="mrow"><div class="qty sm"><button data-act="mq" data-d="-1" data-k="${esc(l.k)}" aria-label="−">−</button><span>${l.qty}</span><button data-act="mq" data-d="1" data-k="${esc(l.k)}" aria-label="+" ${l.qty>=lineMax(l)?"disabled":""}>+</button></div><button class="linkbtn" data-act="mrm" data-k="${esc(l.k)}">${t("remove")}</button></div></div><b class="mt">${money(l.p.price*l.qty)}</b></div>`).join("")}</div>
 <div class="dfoot"><div class="row total" style="margin:0 0 4px;border:0;padding-top:0"><span>${t("subtotal")}</span><span>${money(tot)}</span></div><p class="muted small" style="margin:0 0 14px">${t("shipping")}: ${ff&&tot>=ff?t("free"):t("shipCarrier")}</p>
 <a class="btn primary block" href="#/checkout">${t("checkout")} →</a><a class="btn block" style="margin-top:8px" href="#/cart">${t("viewCart")}</a></div>`
 :`<div class="dbody"><div class="empty" style="border:0;padding:50px 10px"><b>${t("cartEmpty")}</b>${t("cartEmptyS")}<br><br><a class="btn primary" href="#/shop">${t("shopNow")} →</a></div></div>`}`}
function openCart(){renderMini();openLayer("cartDrawer")}
function quickView(id){
 const p=prod(id);if(!p)return;const c=catOf(p.cat),st=stockState(p),imgs=p.images&&p.images.length?p.images:[img0(p)];
 $("#qv").innerHTML=`<div class="box"><button class="iconbtn qvx" data-act="closeall" aria-label="${t("close")}">${X}</button>
 <div class="qvg"><div class="main"><img id="qvImg" src="${esc(imgs[0])}" alt="${esc(p.name)}"></div>${imgs.length>1?`<div class="thumbs">${imgs.map((s,i)=>`<button class="${i?"":"on"}" data-act="qvthumb" data-i="${i}" data-id="${p.id}"><img src="${esc(s)}" alt=""></button>`).join("")}</div>`:""}</div>
 <div class="qvi"><span class="catname">${esc(c?c.name:"")}</span><h2>${esc(p.name)}</h2><span class="stock ${st}">${st==="out"?t("out"):st==="low"?t("low"):t("inStock")}</span>
 ${(()=>{const r=rating(p.id);return r?`<div class="crate">${stars(r.avg)}<span>${r.avg.toFixed(1)} (${r.n})</span></div>`:""})()}<div class="pricebox"><span class="price">${money(p.price)}</span></div>${p.short?`<p class="lead">${esc(p.short)}</p>`:""}
 ${optsHtml(p,"qv")}<div class="buyrow"><div class="qty"><button data-act="qvq" data-d="-1" aria-label="−">−</button><input id="qvq" type="number" min="1" max="${Math.max(1,p.stock)}" value="1" aria-label="${t("qty")}"><button data-act="qvq" data-d="1" aria-label="+">+</button></div>
 <button class="btn primary" style="flex:1" data-act="qvadd" data-id="${p.id}" ${st==="out"?"disabled":""} data-autofocus>${st==="out"?t("notAvail"):t("addToCart")}</button>
 <button class="btn ${favs.includes(p.id)?"fav-inline on":"fav-inline"}" data-act="fav" data-id="${p.id}" aria-label="${t("favorites")}" style="padding:11px 13px">${ICON.heart.replace("<svg",'<svg width="20" height="20"')}</button></div>
 <a class="textlink" href="#/product/${p.id}">${t("viewDetails")} →</a></div></div>`;
 openLayer("qv")}

/* ===== storefront views ===== */
function card(p){
 const c=catOf(p.cat),st=stockState(p);
 return `<article class="card"><div class="labels">${p.oldPrice>p.price?`<span class="label sale">−${Math.round(100-p.price/p.oldPrice*100)}%</span>`:""}${st==="out"?`<span class="label out">${t("out")}</span>`:""}${isNew(p)?`<span class="label new">${t("newL")}</span>`:""}</div>
 <button class="fav ${favs.includes(p.id)?"on":""}" data-act="fav" data-id="${p.id}" aria-label="${t("favorites")}">${ICON.heart}</button>
 <div class="phw"><a class="ph" href="#/product/${p.id}"><img src="${esc(img0(p))}" alt="${esc(p.name)}" loading="lazy"></a><button class="qvbtn" data-act="qv" data-id="${p.id}">${t("quickView")}</button></div>
 <div class="body"><span class="catname">${esc(c?c.name:"")}</span><h3><a href="#/product/${p.id}">${esc(p.name)}</a></h3>${(()=>{const r=rating(p.id);return r?`<div class="crate">${stars(r.avg)}<span>(${r.n})</span></div>`:""})()}
 <div class="bottom"><div><span class="price ${p.oldPrice>p.price?"sale":""}">${money(p.price)}</span>${p.oldPrice>p.price?`<span class="old">${money(p.oldPrice)}</span>`:""}</div>
 <button class="addbtn" data-act="add" data-id="${p.id}" ${st==="out"?"disabled":""} aria-label="${t("addToCart")}">${ICON.bag}</button></div></div></article>`}
function catImg(c){if(c.image)return c.image;const p=visible().find(p=>p.cat===c.id&&p.images&&p.images[0]);return p?p.images[0]:art("basket","#efece4","#e4ddd0")}
function viewHome(){
 const st=S.settings,vis=visible();
 let feat=vis.filter(p=>p.featured);if(feat.length<4)feat=feat.concat(vis.filter(p=>!p.featured)).slice(0,4);
 const shown=new Set(feat.slice(0,4).map(p=>p.id));let fresh=[...vis].sort((a,b)=>(b.created||0)-(a.created||0));fresh=fresh.filter(p=>!shown.has(p.id)).concat(fresh.filter(p=>shown.has(p.id))).slice(0,4);
 const heroImg=st.heroImage||PHOTO.hero;
 return `<section class="hero"><div class="shell hero-grid"><div><span class="eyebrow">${esc(st.heroEyebrow)}</span><h1>${esc(st.heroTitle)}</h1><p>${esc(st.heroText)}</p>
 <div class="hero-cta"><a class="btn primary" href="#/shop">${t("shopNow")} →</a><a class="btn" href="#/about">${t("learnMore")}</a></div></div>
 <div class="hero-art"><img src="${esc(heroImg)}" alt="">${st.freeFrom?`<div class="hero-note"><b>${t("freeOk").replace(" ✓","")}</b>${lang==="en"?"on orders over":"від"} ${money(st.freeFrom)}</div>`:""}</div></div></section>
 <div class="shell perks">${[["🚚","perk1"],["💳","perk2"],["↺","perk3"],["💬","perk4"]].map(([i,k])=>`<div class="perk"><i>${i}</i><span><b>${t(k)}</b>${t(k+"s")}</span></div>`).join("")}</div>
 <section class="section" style="padding-top:20px"><div class="shell"><div class="section-head"><div><span class="eyebrow">${t("categories")}</span><h2>${lang==="en"?"Shop by category":"Оберіть категорію"}</h2></div><a class="textlink" href="#/shop">${t("viewAll")}</a></div>
 <div class="grid cats">${S.categories.map(c=>`<a class="cat" href="#/shop?cat=${c.id}"><div class="ph"><img src="${esc(catImg(c))}" alt="" loading="lazy"></div><b>${esc(c.name)}</b><small>${nItems(vis.filter(p=>p.cat===c.id).length)}</small></a>`).join("")}</div></div></section>
 <section class="section alt"><div class="shell"><div class="section-head"><div><span class="eyebrow">${lang==="en"?"Our favourites":"Обирають найчастіше"}</span><h2>${t("featured")}</h2></div><a class="textlink" href="#/shop">${t("viewAll")}</a></div><div class="grid">${feat.slice(0,4).map(card).join("")}</div></div></section>
 <section class="section"><div class="shell"><div class="section-head"><div><span class="eyebrow">${lang==="en"?"Just in":"Щойно надійшли"}</span><h2>${t("newArrivals")}</h2></div><a class="textlink" href="#/shop?sort=new">${t("viewAll")}</a></div><div class="grid">${fresh.map(card).join("")}</div></div></section>`}
let shopShown=12,shopKey="";
function viewShop(q){
 const cat=q.get("cat")||"",raw=(q.get("q")||"").trim(),stock=q.get("stock")==="1",sort=q.get("sort")||(raw?"rel":"pop");
 const min=q.get("min")!==null&&q.get("min")!==""?+q.get("min"):null,max=q.get("max")!==null&&q.get("max")!==""?+q.get("max"):null;
 const key=[...q.entries()].filter(([k])=>k!=="sort").join("&");if(key!==shopKey){shopKey=key;shopShown=12}
 const base=raw?searchProducts(raw,""):visible();
 const fPrice=p=>(min===null||p.price>=min)&&(max===null||p.price<=max),fStock=p=>!stock||p.stock>0,fCat=p=>!cat||p.cat===cat;
 let list=base.filter(p=>fCat(p)&&fPrice(p)&&fStock(p));
 const by={pop:(a,b)=>(b.featured-a.featured)||((b.stock>0)-(a.stock>0)),new:(a,b)=>(b.created||0)-(a.created||0),cheap:(a,b)=>a.price-b.price,exp:(a,b)=>b.price-a.price,name:(a,b)=>a.name.localeCompare(b.name)};
 if(sort!=="rel"||!raw)list.sort(by[sort]||by.pop);
 const c=catOf(cat);
 const link=o=>{const n=new URLSearchParams(q);Object.entries(o).forEach(([k,v])=>v!==""&&v!=null?n.set(k,v):n.delete(k));const s=n.toString();return"#/shop"+(s?"?"+s:"")};
 const sorts=(raw?[["rel","bestMatch"]]:[]).concat([["pop","sortPop"],["new","sortNew"],["cheap","sortCheap"],["exp","sortExp"],["name","sortName"]]);
 const title=raw?`${t("resultsFor")} “${esc(raw)}”`:esc(c?c.name:t("shop"));
 const popular=visible().filter(p=>p.featured&&p.stock>0).slice(0,4);
 // facet counts (each ignores its own filter)
 const catCount=id=>base.filter(p=>(!id||p.cat===id)&&fPrice(p)&&fStock(p)).length;
 const stockCount=base.filter(p=>fCat(p)&&fPrice(p)&&p.stock>0).length;
 const prices=visible().map(p=>p.price),top=Math.max(0,...prices);
 const step=top>400?100:top>150?50:top>60?20:10;const bands=[[null,step],[step,step*2],[step*2,step*4],[step*4,null]].filter(([a,b])=>visible().some(p=>(a===null||p.price>=a)&&(b===null||p.price<=b)));
 const bandLabel=([a,b])=>a===null?`${t("under")} ${money(b)}`:b===null?`${t("over")} ${money(a)}`:`${money(a)} – ${money(b)}`;
 const bandCount=([a,b])=>base.filter(p=>fCat(p)&&fStock(p)&&(a===null||p.price>=a)&&(b===null||p.price<=b)).length;
 const active=[];
 if(raw)active.push([`“${esc(raw)}”`,link({q:""})]);if(c)active.push([esc(c.name),link({cat:""})]);
 if(min!==null||max!==null)active.push([min!==null&&max!==null?`${money(min)} – ${money(max)}`:min!==null?`${t("over")} ${money(min)}`:`${t("under")} ${money(max)}`,link({min:"",max:""})]);
 if(stock)active.push([t("inStockOnly"),link({stock:""})]);
 const shown=list.slice(0,shopShown);
 return `<div class="page-head"><div class="shell"><div class="crumbs"><a href="#/">${t("home")}</a> / <a href="#/shop">${t("shop")}</a>${c?" / "+esc(c.name):""}</div><h1>${title}</h1><p>${nItems(list.length)}${raw&&c?` ${t("inCat")} ${esc(c.name)}`:""}</p></div></div>
 <div class="shell shoplayout"><aside class="filters" id="filters" aria-label="${t("filters")}"><div class="fhead"><h3>${t("filters")}</h3><button class="iconbtn mob" data-act="closeall" aria-label="${t("close")}">${X}</button></div>
 <div class="fgroup"><h4>${t("category")}</h4><a class="fopt ${!cat?"on":""}" href="${link({cat:""})}"><span>${t("allCats")}</span><small>${catCount("")}</small></a>${S.categories.map(x=>{const n=catCount(x.id);return `<a class="fopt ${cat===x.id?"on":""} ${n?"":"dim"}" href="${link({cat:x.id})}"><span>${esc(x.name)}</span><small>${n}</small></a>`}).join("")}</div>
 <div class="fgroup"><h4>${t("price")}</h4>${bands.map(bd=>{const on=min===bd[0]&&max===bd[1];return `<a class="fopt ${on?"on":""}" href="${on?link({min:"",max:""}):link({min:bd[0]??"",max:bd[1]??""})}"><span>${bandLabel(bd)}</span><small>${bandCount(bd)}</small></a>`}).join("")}
 <form class="prange" data-form="price"><input class="field" name="min" type="number" min="0" inputmode="decimal" placeholder="${t("min")}" value="${min??""}" aria-label="${t("min")}"><span>–</span><input class="field" name="max" type="number" min="0" inputmode="decimal" placeholder="${t("max")}" value="${max??""}" aria-label="${t("max")}"><button class="btn sm">${t("apply")}</button></form></div>
 <div class="fgroup"><h4>${t("availability")}</h4><label class="check"><input type="checkbox" data-act="fstock" ${stock?"checked":""}>${t("inStockOnly")} <small class="muted">(${stockCount})</small></label></div>
 ${active.length?`<a class="btn block" href="${raw?"#/shop?q="+encodeURIComponent(raw):"#/shop"}">${t("clearAll")}</a>`:""}
 <button class="btn primary block mob" data-act="closeall" style="margin-top:10px">${t("showResults")} (${list.length})</button></aside>
 <div class="shopmain"><div class="toolbar"><button class="btn sm mob" data-act="filters">⚙ ${t("filters")}${active.length?` <span class="badge-in">${active.length}</span>`:""}</button><span class="muted small dsk">${list.length?`${t("showing")} ${shown.length} ${t("of")} ${list.length}`:""}</span>
 <label class="sortsel"><span class="muted small">${t("sort")}:</span><select data-act="fsort" aria-label="${t("sort")}">${sorts.map(([v,k])=>`<option value="${v}" ${sort===v?"selected":""}>${t(k)}</option>`).join("")}</select></label></div>
 ${active.length?`<div class="achips">${active.map(([l,h])=>`<a class="achip" href="${h}">${l} <span aria-hidden="true">×</span></a>`).join("")}</div>`:""}
 ${list.length?`<div class="grid g3">${shown.map(card).join("")}</div>${list.length>shown.length?`<div class="more"><p class="muted small">${t("showing")} ${shown.length} ${t("of")} ${list.length}</p><button class="btn" data-act="more">${t("showMore")}</button></div>`:""}`
 :`<div class="empty"><b>${raw?t("noMatch")+" “"+esc(raw)+"”":t("noResults")}</b>${t("noResultsS")}<br><br><a class="btn" href="${raw?"#/shop?q="+encodeURIComponent(raw):"#/shop"}">${t("resetFilters")}</a></div>${popular.length?`<div class="section-head" style="margin-top:40px"><h2>${t("popularNow")}</h2></div><div class="grid g3">${popular.map(card).join("")}</div>`:""}`}</div></div>`}
function setParams(o){const cur=new URLSearchParams(location.hash.split("?")[1]||"");Object.entries(o).forEach(([k,v])=>v!==""&&v!=null?cur.set(k,v):cur.delete(k));const s=cur.toString();location.hash="#/shop"+(s?"?"+s:"")}
function viewProduct(id){
 const p=prod(id);if(!p||!p.active)return notFound();
 const c=catOf(p.cat),st=stockState(p),imgs=p.images&&p.images.length?p.images:[img0(p)];
 const rel=visible().filter(x=>x.cat===p.cat&&x.id!==p.id).slice(0,4);
 const specs=(p.specs||[]).filter(s=>s[0]||s[1]);
 return `<div class="shell"><div class="pdp"><div class="gallery"><div class="main"><img id="mainImg" src="${esc(imgs[0])}" alt="${esc(p.name)}"></div>${imgs.length>1?`<div class="thumbs">${imgs.map((s,i)=>`<button class="${i?"":"on"}" data-act="thumb" data-i="${i}"><img src="${esc(s)}" alt=""></button>`).join("")}</div>`:""}</div>
 <div><div class="crumbs"><a href="#/">${t("home")}</a> / <a href="#/shop">${t("shop")}</a>${c?` / <a href="#/shop?cat=${c.id}">${esc(c.name)}</a>`:""}</div>
 ${!p.active?`<div class="note">Hidden product — customers can’t see it.</div>`:""}
 <h1>${esc(p.name)}</h1>${(()=>{const r=rating(p.id);return r?`<button class="crate rlink" data-act="toreviews">${stars(r.avg,17)}<span>${r.avg.toFixed(1)} · ${r.n} ${r.n===1?"review":"reviews"}</span></button>`:""})()}<span class="stock ${st}">${st==="out"?t("out"):st==="low"?t("low"):t("inStock")}</span>${p.sku?` <span class="muted small" style="margin-left:12px">${t("sku")}: ${esc(p.sku)}</span>`:""}
 <div class="pricebox"><span class="price ${p.oldPrice>p.price?"sale":""}">${money(p.price)}</span>${p.oldPrice>p.price?`<span class="old">${money(p.oldPrice)}</span><span class="label sale">−${Math.round(100-p.price/p.oldPrice*100)}%</span>`:""}</div>
 ${p.short?`<p class="lead">${esc(p.short)}</p>`:""}
 ${optsHtml(p,"pdp")}<div class="buyrow"><div class="qty"><button data-act="q-" aria-label="-">−</button><input id="pq" type="number" min="1" max="${Math.max(1,p.stock)}" value="1" aria-label="${t("qty")}"><button data-act="q+" aria-label="+">+</button></div>
 <button class="btn primary" style="flex:1" data-act="addq" data-id="${p.id}" ${st==="out"?"disabled":""}>${ICON.bag.replace("<svg",'<svg width="18" height="18"')} ${st==="out"?t("notAvail"):t("addToCart")}</button>
 <button class="btn fav-inline ${favs.includes(p.id)?"on":""}" data-act="fav" data-id="${p.id}" aria-label="${t("favorites")}" style="padding:11px 13px">${ICON.heart.replace("<svg",'<svg width="20" height="20"')}</button></div>
 <div class="infobox"><b>🚚 ${t("deliveryInfo")}</b>${esc((S.settings.deliveryOptions||"").split("\n").filter(Boolean).join(" · "))}${S.settings.freeFrom?`\n${t("freeOk").replace(" ✓","")} ${lang==="en"?"over":"від"} ${money(S.settings.freeFrom)}`:""}<span class="retnote">↺ Easy returns within 14 days · <a class="textlink" href="#/returns">Return policy</a></span></div></div></div>
 <div class="tabsec">${p.desc?`<div><h2>${t("description")}</h2><div class="desc">${esc(p.desc)}</div></div>`:"<div></div>"}${specs.length?`<div><h2>${t("specs")}</h2><table class="specs">${specs.map(s=>`<tr><td>${esc(s[0])}</td><td>${esc(s[1])}</td></tr>`).join("")}</table></div>`:""}</div>
 ${reviewsHtml(p)}
 ${rel.length?`<section class="section" style="padding-top:10px"><div class="section-head"><h2>${t("related")}</h2></div><div class="grid">${rel.map(card).join("")}</div></section>`:""}</div>`}
function viewCart(){
 const L=cartLines();
 if(!L.length)return `<div class="page-head"><div class="shell"><h1>${t("cart")}</h1></div></div><div class="shell section"><div class="empty"><b>${t("cartEmpty")}</b>${t("cartEmptyS")}<br><br><a class="btn primary" href="#/shop">${t("shopNow")} →</a></div></div>`;
 return `<div class="page-head"><div class="shell"><h1>${t("cart")}</h1></div></div><div class="shell cartgrid"><div>${L.map(l=>`<div class="line"><a href="#/product/${l.p.id}"><img src="${esc(img0(l.p))}" alt=""></a><div><h3><a href="#/product/${l.p.id}">${esc(l.p.name)}</a></h3>${l.opt?`<div class="optline">${esc(optStr(l.opt,l.p))}</div>`:""}<div class="unit">${money(l.p.price)} / ${t("pcs")}</div><button class="linkbtn" data-act="rm" data-k="${esc(l.k)}">${t("remove")}</button></div>
 <div class="right"><div class="qty"><button data-act="cq" data-d="-1" data-k="${esc(l.k)}">−</button><input type="number" value="${l.qty}" min="1" max="${lineMax(l)}" data-act="cqi" data-k="${esc(l.k)}" aria-label="${t("qty")}"><button data-act="cq" data-d="1" data-k="${esc(l.k)}">+</button></div><b>${money(l.p.price*l.qty)}</b></div></div>`).join("")}
 <a class="textlink" href="#/shop">← ${t("continueShop")}</a></div>${summary(true)}</div>`}
function summary(withBtn){
 const tot=cartTotal(),ff=+S.settings.freeFrom||0;
 return `<aside class="summary"><h3>${t("yourOrder")}</h3>${withBtn?"":cartLines().map(l=>`<div class="row small"><span>${esc(l.p.name)}${l.opt?` <span class="muted">(${esc(optStr(l.opt,l.p))})</span>`:""} × ${l.qty}</span><span>${money(l.p.price*l.qty)}</span></div>`).join("")}
 <div class="row"><span>${t("subtotal")}</span><b>${money(tot)}</b></div><div class="row"><span>${t("shipping")}</span><span class="muted">${ff&&tot>=ff?t("free"):t("shipCarrier")}</span></div>
 ${ff?`<div class="small" style="margin:6px 0;color:${tot>=ff?"#3f7a4d":"#8a5a45"}">${tot>=ff?t("freeOk"):t("freeLeft")+money(ff-tot)}</div>`:""}
 <div class="row total"><span>${t("total")}</span><span>${money(tot)}</span></div>${withBtn?`<a class="btn primary block" style="margin-top:14px" href="#/checkout">${t("checkout")} →</a>`:""}</aside>`}
function viewCheckout(){
 if(!cartLines().length){location.hash="#/cart";return""}
 const o=s=>(s||"").split("\n").map(x=>x.trim()).filter(Boolean);let d=LS.get("buyer",{});
 if(user&&!profile){loadProfile().then(()=>{if(location.hash.startsWith("#/checkout"))render()})}
 if(user&&profile)d={...d,name:profile.full_name||d.name,phone:profile.phone||d.phone,email:user.email,city:profile.city||d.city,address:profile.address_line||d.address,state:profile.state||d.state,zip:profile.zip||d.zip};
 return `<div class="page-head"><div class="shell"><div class="crumbs"><a href="#/cart">${t("cart")}</a> / ${t("checkout")}</div><h1>${t("checkoutT")}</h1></div></div>
 <div class="shell cartgrid"><form class="stack" data-form="checkout" novalidate>${sb&&!user?`<div class="signhint">Have an account? <a class="textlink" href="#/account" data-act="cologin">Sign in</a> for faster checkout — or continue as a guest.</div>`:""}<div class="panel"><h2>${t("contactsT")}</h2><div class="form">
 <div class="full"><label>${t("name")} <span class="req">*</span></label><input class="field" name="name" autocomplete="name" value="${esc(d.name)}" required></div>
 <div><label>${t("phone")} <span class="req">*</span></label><input class="field" name="phone" type="tel" autocomplete="tel" value="${esc(d.phone)}" required></div>
 <div><label>${t("email")}</label><input class="field" name="email" type="email" autocomplete="email" value="${esc(d.email)}"></div></div></div>
 <div class="panel"><h2>${t("deliveryM")}</h2><div class="radio">${o(S.settings.deliveryOptions).map((x,i)=>`<label><input type="radio" name="delivery" value="${esc(x)}" ${i?"":"checked"}>${esc(x)}</label>`).join("")}</div>
 <div class="form" style="margin-top:14px"><div><label>${t("city")} <span class="req">*</span></label><input class="field" name="city" value="${esc(d.city)}" required></div><div><label>${t("address")}</label><input class="field" name="address" autocomplete="street-address" value="${esc(d.address)}"></div><div><label>State</label><input class="field" name="state" autocomplete="address-level1" value="${esc(d.state)}"></div><div><label>ZIP code</label><input class="field" name="zip" autocomplete="postal-code" inputmode="numeric" value="${esc(d.zip)}"></div></div></div>
 <div class="panel"><h2>${t("paymentM")}</h2><div class="radio">${o(S.settings.paymentOptions).map((x,i)=>`<label><input type="radio" name="payment" value="${esc(x)}" ${i?"":"checked"}>${esc(x)}</label>`).join("")}</div>
 <div style="margin-top:14px"><label class="lbl">${t("comment")}</label><textarea class="field" name="comment"></textarea></div></div>
 <div id="coErr"></div><p class="small muted" style="margin:0">By placing your order, you agree to our <a class="textlink" href="#/terms" target="_blank">Terms of Service</a> and <a class="textlink" href="#/privacy" target="_blank">Privacy Policy</a>.</p><button class="btn primary block" style="padding:15px">${t("placeOrder")} →</button></form>${summary(false)}</div>`}
function orderText(o){
 const L=o.lines.map(l=>`• ${l.name}${l.opt?" — "+optStr(l.opt,prod(l.id)):""}${l.sku?" ("+l.sku+")":""} × ${l.qty} = ${money(l.price*l.qty)}`).join("\n");
 return `${lang==="en"?"New order":"Нове замовлення"} ${o.no}\n\n${L}\n\n${t("total")}: ${money(o.total)}\n\n${t("name")}: ${o.c.name}\n${t("phone")}: ${o.c.phone}${o.c.email?"\n"+t("email")+": "+o.c.email:""}\n${t("deliveryM")}: ${o.c.delivery}\n${t("city")}: ${o.c.city}${o.c.address?", "+o.c.address:""}\n${t("paymentM")}: ${o.c.payment}${o.c.comment?"\n"+t("comment")+": "+o.c.comment:""}`}
async function placeOrder(f){
 const fd=Object.fromEntries(new FormData(f));const bad=["name","phone","city"].filter(k=>!String(fd[k]||"").trim());
 f.querySelectorAll(".field").forEach(i=>i.style.borderColor=bad.includes(i.name)?"#c0563a":"");
 if(bad.length||String(fd.phone).replace(/\D/g,"").length<9){$("#coErr").innerHTML=`<div class="note">${t("required")}</div>`;return}
 const btn=f.querySelector("button:last-child");btn.disabled=true;
 const d=new Date(),no="CHV-"+String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0")+"-"+Math.floor(1000+Math.random()*9000);
 const o={no,date:d.toISOString(),lines:cartLines().map(l=>({id:l.p.id,name:l.p.name,sku:l.p.sku,price:l.p.price,qty:l.qty,...(l.opt?{opt:l.opt}:{})})),total:cartTotal(),c:fd,sent:false};
 LS.set("buyer",{name:fd.name,phone:fd.phone,email:fd.email,city:fd.city,address:fd.address,state:fd.state,zip:fd.zip});
 let res={ok:false};try{res=await saveOrderToDb(o)}catch(e){}
 if(res.stock){$("#coErr").innerHTML=`<div class="note">${esc(res.msg)} <a class="textlink" href="#/cart">Go to cart →</a></div>`;btn.disabled=false;refreshCatalog();return}
 o.sent=res.ok;o.db=res.ok;o.mine=!!(res.ok&&user);if(res.ok)setTimeout(refreshCatalog,800);
 const ep=(S.settings.formEndpoint||"").trim();
 if(ep&&!o.sent){try{const r=await fetch(ep,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({order:o.no,total:o.total,message:orderText(o),email:fd.email||undefined,_subject:"New order "+o.no})});o.sent=r.ok}catch(e){o.sent=false}}
 LS.set("lastOrder",o);setCart([]);location.hash="#/order";}
function viewOrder(){
 const o=LS.get("lastOrder",null);if(!o)return notFound();const st=S.settings,txt=orderText(o);
 const tg=(st.telegram||"").replace(/^@/,""),vb=(st.viber||"").replace(/[^\d+]/g,"");
 return `<div class="shell section" style="max-width:760px"><div class="panel"><span class="eyebrow">${t("orderNo")}: ${esc(o.no)}</span><h1 style="font-size:36px;margin:8px 0 14px">${t("orderT")}</h1>
 ${o.sent?`<div class="okbox">${t("orderSent")}</div>${o.mine?`<p style="margin-top:14px"><a class="textlink" href="#/account/orders">View your orders →</a></p>`:""}`:`<p>${t("orderSend")}</p><textarea class="field" id="otext" readonly style="min-height:220px;font-size:13px">${esc(txt)}</textarea>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${tg?`<button class="btn primary" data-act="tg" data-u="${esc(tg)}">${t("sendTg")}</button>`:""}${st.email?`<a class="btn ${tg?"":"primary"}" href="mailto:${esc(st.email)}?subject=${encodeURIComponent((lang==="en"?"Order ":"Замовлення ")+o.no)}&body=${encodeURIComponent(txt)}">${t("sendEmail")}</a>`:""}${vb?`<a class="btn" href="viber://chat?number=${encodeURIComponent(vb)}" data-act="copyorder">${t("sendViber")}</a>`:""}<button class="btn" data-act="copyorder">${t("copy")}</button>${st.phone?`<a class="btn ghost" href="tel:${esc(st.phone.replace(/[^+\d]/g,""))}">${t("call")} ${esc(st.phone)}</a>`:""}</div>`}
 <br><a class="textlink" href="#/">← ${t("backHome")}</a></div></div>`}
function viewFavs(){const L=favs.map(prod).filter(p=>p&&p.active);return `<div class="page-head"><div class="shell"><h1>${t("favorites")}</h1></div></div><div class="shell section">${L.length?`<div class="grid">${L.map(card).join("")}</div>`:`<div class="empty"><b>${t("favEmpty")}</b>${t("favEmptyS")}</div>`}</div>`}
function viewText(title,text){return `<div class="page-head"><div class="shell"><h1>${esc(title)}</h1></div></div><div class="shell section"><div class="prose">${esc(text)}</div></div>`}
function viewContacts(){const c=S.settings;const r=(l,v,h)=>v?`<div class="row" style="padding:12px 0;border-bottom:1px solid var(--line)"><span class="muted">${l}</span>${h?`<a class="textlink" href="${h}">${esc(v)}</a>`:`<b>${esc(v)}</b>`}</div>`:"";
 const nm=(user&&((profile&&profile.full_name)||(user.user_metadata&&user.user_metadata.full_name)))||LS.get("ctName",""),em=(user&&user.email)||LS.get("ctEmail","");
 return `<div class="page-head"><div class="shell"><h1>${t("contacts")}</h1><p>Questions about an order or a product? Send us a message.</p></div></div><div class="shell section contactgrid">
 <div class="panel"><h2>Contact us</h2><form class="stack" data-form="contact" novalidate><div class="form"><div><label>Name <span class="req">*</span></label><input class="field" name="name" autocomplete="name" maxlength="120" value="${esc(nm)}" required></div><div><label>Email <span class="req">*</span></label><input class="field" name="email" type="email" autocomplete="email" maxlength="200" value="${esc(em)}" required></div><div class="full"><label>Order number (optional)</label><input class="field" name="order_no" maxlength="40" placeholder="CHV-…"></div><div class="full"><label>Message <span class="req">*</span></label><textarea class="field" name="body" maxlength="5000" required style="min-height:140px"></textarea></div></div><input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"><div id="ctMsg"></div><button class="btn primary">Send message</button></form></div>
 <div class="panel"><h2>Other ways to reach us</h2>${r(t("phone"),c.phone,"tel:"+(c.phone||"").replace(/[^+\d]/g,""))}${r(t("email"),c.email,"mailto:"+c.email)}${r("Instagram",c.instagram,"https://instagram.com/"+(c.instagram||"").replace(/^@/,""))}${r(t("hours"),c.hours)}</div></div>`}

/* ===== reviews on the product page ===== */
function reviewsHtml(p){
 const R=revsOf(p.id).slice().sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)),r=rating(p.id);
 const dist=[5,4,3,2,1].map(s=>[s,R.filter(x=>+x.rating===s).length]);
 return `<section class="reviews" id="reviews"><h2>Customer reviews</h2><div class="revgrid"><div class="revsum">${r?`<div class="revbig">${r.avg.toFixed(1)}<small> out of 5</small></div>${stars(r.avg,22)}<p class="muted small">${r.n} ${r.n===1?"review":"reviews"}</p>${dist.map(([s,n])=>`<div class="distrow"><span>${s} star</span><div class="bar"><i style="width:${r.n?Math.round(n/r.n*100):0}%"></i></div><span class="muted">${r.n?Math.round(n/r.n*100):0}%</span></div>`).join("")}`:`<p class="muted" style="margin-top:0">No reviews yet.</p>`}
 <div class="revcta"><h3>Review this product</h3>${revFormHtml(p)}</div></div>
 <div class="revlist">${R.length?R.map(x=>`<article class="rev"><div class="rtop">${stars(+x.rating,15)}${x.title?`<b class="rt">${esc(x.title)}</b>`:""}</div><div class="rmeta">${esc(x.name)}${x.verified?` · <span class="verified">✓ Verified purchase</span>`:""} · ${fmtDate(x.created_at)}</div><p>${esc(x.body)}</p></article>`).join(""):`<div class="empty" style="padding:34px 20px"><b>Be the first to review this product</b>Share what you think with other shoppers.</div>`}</div></div></section>`}
function revFormHtml(p){
 if(!sb)return `<p class="small muted">Reviews are unavailable right now.</p>`;
 if(!user)return `<p class="small">Share your thoughts with other customers.</p><a class="btn block" href="#/account" data-act="revlogin" data-id="${p.id}">Sign in to write a review</a>`;
 const nm=(profile&&profile.full_name)||(user.user_metadata&&user.user_metadata.full_name)||"";
 return `<p class="small">Share your thoughts with other customers.</p><button class="btn block" data-act="revopen">Write a review</button><form class="revform stack" data-form="review" data-id="${p.id}" hidden novalidate>
 <div><label class="lbl">Your rating <span class="req">*</span></label><div class="starpick" role="radiogroup" aria-label="Your rating">${[5,4,3,2,1].map(i=>`<label title="${i} star${i>1?"s":""}"><input type="radio" name="rating" value="${i}"><span aria-hidden="true">★</span><b class="sr">${i} star${i>1?"s":""}</b></label>`).join("")}</div></div>
 <div><label class="lbl">Headline</label><input class="field" name="title" maxlength="120" placeholder="What’s most important to know?"></div>
 <div><label class="lbl">Your review <span class="req">*</span></label><textarea class="field" name="body" maxlength="3000" placeholder="What did you like or dislike? How do you use it?"></textarea></div>
 <div><label class="lbl">Name shown with your review <span class="req">*</span></label><input class="field" name="name" maxlength="60" value="${esc(nm)}" autocomplete="given-name"></div>
 <div id="revMsg"></div><button class="btn primary block">Submit review</button><p class="help" style="margin:0">Reviews appear after a quick check. Please don’t share personal information.</p></form>`}
async function submitReview(f){
 const fd=Object.fromEntries(new FormData(f)),m=$("#revMsg"),rating=+fd.rating,body=String(fd.body||"").trim(),name=String(fd.name||"").trim(),title=String(fd.title||"").trim()||null;
 const err=x=>{m.innerHTML=`<div class="note">${x}</div>`};
 if(!rating)return err("Please choose a star rating.");if(body.length<10)return err("Please write a few more words (at least 10 characters).");if(!name)return err("Please enter the name to show with your review.");
 const b=f.querySelector("button.primary");b.disabled=true;
 const{error}=await sb.from("reviews").insert({product_id:f.dataset.id,rating,title,body,name});b.disabled=false;
 if(error)return err(/duplicate|unique/i.test(error.message)?"You’ve already reviewed this product — thank you!":/TOO_MANY/.test(error.message)?"You’ve posted several reviews today. Please try again tomorrow.":"Couldn’t send your review. Please try again.");
 f.outerHTML=`<div class="okbox">Thank you, ${esc(name.split(" ")[0])}! Your review was sent and will appear here after a quick check.</div>`}

/* ===== legal pages & brand story ===== */
function fillTokens(txt){const s=S.settings;return String(txt||"").replace(/\{store\}/g,s.name||"").replace(/\{email\}/g,s.email||"").replace(/\{site\}/g,(typeof SITE_URL!=="undefined"?SITE_URL:location.origin))}
function richText(txt){
 const blocks=fillTokens(txt).replace(/\r/g,"").split(/\n\s*\n/).map(b=>b.trim()).filter(Boolean);
 const inline=x=>esc(x).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g,'<a class="textlink" href="mailto:$1">$1</a>');
 const one=b=>{if(!b)return"";if(b.startsWith("## ")){const i=b.indexOf("\n");return `<h2>${inline(i<0?b.slice(3):b.slice(3,i))}</h2>`+(i<0?"":one(b.slice(i+1).trim()))}const L=b.split("\n");if(L.every(l=>/^- /.test(l)))return `<ul>${L.map(l=>`<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;return `<p>${L.map(inline).join("<br>")}</p>`};
 return blocks.map(one).join("")}
function viewLegal(k){const T={privacy:["Privacy Policy","privacyText"],terms:["Terms of Service","termsText"],returns:["Returns & Refunds","returnsText"]}[k];
 return `<div class="page-head"><div class="shell"><div class="crumbs"><a href="#/">${t("home")}</a> / ${esc(T[0])}</div><h1>${esc(T[0])}</h1></div></div><div class="shell section"><div class="legal">${richText(S.settings[T[1]])}</div><p class="small muted" style="margin-top:30px">Other policies: ${[["returns","Returns & refunds"],["privacy","Privacy policy"],["terms","Terms of service"],["delivery","Shipping & payment"]].filter(x=>x[0]!==k).map(([h,l])=>`<a class="textlink" href="#/${h}">${l}</a>`).join(" · ")}</p></div>`}
function viewAbout(){
 const s=S.settings,paras=String(s.aboutStory||s.aboutText||"").replace(/\r/g,"").split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 const vals=String(s.aboutValues||"").split("\n").map(x=>x.split("|").map(y=>y.trim())).filter(x=>x.length>=2&&x[1]);
 const img=s.aboutImage||s.heroImage||PHOTO.hero;
 return `<section class="about-hero"><div class="shell about-grid"><div><span class="eyebrow">Our story</span><h1>${esc(s.aboutTitle||"About us")}</h1>${s.aboutIntro?`<p class="lead">${esc(s.aboutIntro)}</p>`:""}<div class="hero-cta"><a class="btn primary" href="#/shop">Shop the collection →</a><a class="btn" href="#/contacts">Say hello</a></div></div><div class="about-img"><img src="${esc(img)}" alt=""></div></div></section>
 ${paras.length?`<section class="section"><div class="shell about-story">${paras.map((p,i)=>i===0?`<p class="first">${esc(p)}</p>`:`<p>${esc(p)}</p>`).join("")}</div></section>`:""}
 ${vals.length?`<section class="section alt"><div class="shell"><div class="section-head"><div><span class="eyebrow">What we care about</span><h2>Our promise to you</h2></div></div><div class="values">${vals.map(([i,ti,tx])=>`<div class="value"><i aria-hidden="true">${esc(i)}</i><b>${esc(ti||"")}</b><p>${esc(tx||"")}</p></div>`).join("")}</div></div></section>`:""}
 <section class="section"><div class="shell about-cta"><h2>${esc(s.aboutCta||"Make your home a little cozier")}</h2><p>Have a question about a product or an order? We read every message — <a class="textlink" href="#/contacts">get in touch</a>.</p><a class="btn primary" href="#/shop">Browse all products →</a></div></section>`}
function notFound(){return `<div class="shell section"><div class="empty"><b>404</b>${lang==="en"?"Page not found.":"Сторінку не знайдено."}<br><br><a class="btn" href="#/">${t("backHome")}</a></div></div>`}

/* ===== router ===== */
let lastPath="";
function render(){
 const h=location.hash.slice(1)||"/";const[path,qs]=h.split("?");const q=new URLSearchParams(qs||"");const parts=path.split("/").filter(Boolean);
 if(SELLER){Seller.render(parts,q,path);return}
 markNav(path);hsClose();hsSync(path,q);let html;
 html=({"":()=>viewHome(),shop:()=>viewShop(q),product:()=>viewProduct(parts[1]),cart:viewCart,checkout:viewCheckout,order:viewOrder,favorites:viewFavs,account:()=>viewAccount(parts),delivery:()=>viewText(t("delivery"),S.settings.deliveryText),about:viewAbout,contacts:viewContacts,privacy:()=>viewLegal("privacy"),terms:()=>viewLegal("terms"),returns:()=>viewLegal("returns")}[parts[0]||""]||notFound)();
 if(html!==undefined&&html!=="")app.innerHTML=html;
 if(path!==lastPath)window.scrollTo(0,0);lastPath=path;
}

/* ===== events ===== */
document.addEventListener("click",e=>{
 if(e.target.id==="qv"){closeLayers();return}
 if(!SELLER&&(!e.target.closest("#acctWrap")||e.target.closest("#acctMenu a")))closeAcct();
 const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act,id=el.dataset.id;
 const H={
  menu:()=>$("#nav").classList.toggle("open"),
  lang:()=>{lang=lang==="en"?"uk":"en";LS.set("lang",lang);document.documentElement.lang=lang==="en"?"en":"uk";chrome();render()},
  fav:()=>{e.preventDefault();toggleFav(id)},add:()=>{e.preventDefault();addToCart(id)},
  addq:()=>{const r=readOpts(prod(id),"pdp");if(r.ok)addToCart(id,Math.max(1,parseInt($("#pq").value)||1),r.opt)},
  toreviews:()=>{const r=$("#reviews");r&&r.scrollIntoView({behavior:"smooth"})},
  revopen:()=>{const f=$('[data-form="review"]');if(f){f.hidden=false;el.hidden=true;const s=f.querySelector("input");s&&s.focus()}},
  revlogin:()=>{LS.set("afterLogin","#/product/"+id)},
  "q-":()=>{const i=$("#pq");i.value=Math.max(1,(+i.value||1)-1)},"q+":()=>{const i=$("#pq");i.value=Math.min(+i.max||99,(+i.value||1)+1)},
  thumb:()=>{const p=prod(location.hash.split("/")[2]);$("#mainImg").src=(p.images||[])[+el.dataset.i];document.querySelectorAll(".thumbs button").forEach(b=>b.classList.toggle("on",b===el))},
  rm:()=>{const k=el.dataset.k;setCart(cart.filter(l=>lkey(l)!==k));render()},
  cq:()=>{const l=lineByKey(el.dataset.k);if(!l)return;l.qty=Math.max(1,Math.min(lineMax(l),l.qty+ +el.dataset.d));setCart(cart);render()},
  hsclear:()=>{e.preventDefault();LS.set("recent",[]);hsClose();hsIn().focus()},
  cart:()=>{e.preventDefault();openCart()},
  acctmenu:()=>{e.preventDefault();const w=$("#acctWrap"),o=!w.classList.contains("open");w.classList.toggle("open",o);el.setAttribute("aria-expanded",String(o))},
  pw:()=>{const i=el.parentNode.querySelector("input");i.type=i.type==="password"?"text":"password";el.textContent=i.type==="password"?"Show":"Hide"},
  signout:async()=>{await sb.auth.signOut();profile=null;toast("Signed out");location.hash="#/account"},
  cologin:()=>{LS.set("afterLogin","#/checkout")},
  filters:()=>openLayer("filters"),
  more:()=>{shopShown+=12;render()},
  closeall:()=>{e.preventDefault();closeLayers()},
  qv:()=>{e.preventDefault();quickView(id)},
  qvthumb:()=>{const p=prod(id);$("#qvImg").src=p.images[+el.dataset.i];el.parentNode.querySelectorAll("button").forEach(b=>b.classList.toggle("on",b===el))},
  qvq:()=>{const i=$("#qvq");i.value=Math.max(1,Math.min(+i.max||99,(+i.value||1)+ +el.dataset.d))},
  qvadd:()=>{const r=readOpts(prod(id),"qv");if(r.ok)addToCart(id,Math.max(1,parseInt($("#qvq").value)||1),r.opt)},
  mq:()=>{const l=lineByKey(el.dataset.k);if(!l)return;const mx=lineMax(l);l.qty+=+el.dataset.d;if(l.qty<1)cart=cart.filter(x=>x!==l);else l.qty=Math.min(mx,l.qty);setCart(cart);renderMini();if(/^#\/(cart|checkout)/.test(location.hash))render()},
  mrm:()=>{const k=el.dataset.k;setCart(cart.filter(l=>lkey(l)!==k));renderMini();if(/^#\/(cart|checkout)/.test(location.hash))render()},
  copyorder:()=>{copy($("#otext").value)},
  tg:()=>{copy($("#otext").value);window.open("https://t.me/"+el.dataset.u,"_blank")},
 };
 if(H[a])H[a]();else if(a.startsWith("a:")&&typeof Admin!=="undefined")Admin.click(a.slice(2),el,e);
});
document.addEventListener("change",e=>{
 const el=e.target;
 if(el.dataset.act==="sortchange"){const f=el.form;go(f)}
 else if(el.dataset.act==="fsort"){const raw=new URLSearchParams(location.hash.split("?")[1]||"").get("q");setParams({sort:el.value===(raw?"rel":"pop")?"":el.value})}
 else if(el.dataset.act==="fstock"){closeLayers(true);setParams({stock:el.checked?"1":""})}
 else if(el.dataset.act==="cqi"){const l=lineByKey(el.dataset.k);if(!l)return;l.qty=Math.max(1,Math.min(lineMax(l),parseInt(el.value)||1));setCart(cart);render()}
 else if(el.dataset.act==="optpick"){const fs=el.closest(".optset");if(fs)fs.querySelector(".optval").textContent=el.value;const b=el.closest(".opts");b&&b.classList.remove("need")}
 else if(el.dataset.ach&&typeof Admin!=="undefined")Admin.change(el);
});
document.addEventListener("submit",e=>{const f=e.target;const k=f.dataset.form;if(!k)return;e.preventDefault();
 if(k==="shopsearch")go(f);else if(k==="price"){const mn=f.min.value.trim(),mx=f.max.value.trim();let lo=mn===""?"":Math.max(0,+mn),hi=mx===""?"":Math.max(0,+mx);if(lo!==""&&hi!==""&&lo>hi)[lo,hi]=[hi,lo];closeLayers(true);setParams({min:lo,max:hi})}else if(k==="checkout")placeOrder(f);else if(k==="contact")sendContact(f);else if(k==="review")submitReview(f);else if(k.startsWith("ac"))acSubmit(k,f);else if(k.startsWith("s:")&&window.Seller)Seller.submit(k.slice(2),f);else if(typeof Admin!=="undefined")Admin.submit(k,f)});
function go(f){const cur=new URLSearchParams((location.hash.split("?")[1])||"");const n=new URLSearchParams();if(cur.get("cat"))n.set("cat",cur.get("cat"));const fd=new FormData(f);if(fd.get("q"))n.set("q",fd.get("q"));const sv=fd.get("sort"),def=fd.get("q")?"rel":"pop";if(sv&&sv!==def)n.set("sort",sv);if(fd.get("stock"))n.set("stock","1");location.hash="#/shop"+(n.toString()?"?"+n:"")}
function copy(s){(navigator.clipboard?navigator.clipboard.writeText(s):Promise.reject()).then(()=>toast(t("copied"))).catch(()=>{const tmp=document.createElement("textarea");tmp.value=s;document.body.appendChild(tmp);tmp.select();try{document.execCommand("copy");toast(t("copied"))}catch(_){}tmp.remove()})}
window.addEventListener("hashchange",()=>{if(!SELLER){closeLayers(true);closeAcct()}render()});
document.addEventListener("keydown",e=>{if(SELLER)return;if(e.key==="Escape")closeAcct();if(e.key==="Escape"&&$("#overlay").classList.contains("show"))closeLayers()});

(async()=>{sbInit();await load();document.documentElement.lang=SELLER?"uk":"en";chrome();if(SELLER)Seller.boot();else render()})();
