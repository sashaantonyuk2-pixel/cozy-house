/* ===== storefront (index.html) ===== */
const EMBED=JSON.parse(document.getElementById("store-data").textContent||"null");

/* ===== data: embedded snapshot + live database ===== */
function save(){} /* storefront keeps cart/favs in the browser; Seller Central syncs to the database */
async function load(){
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
/* options (variants): p.options=[{name:"Color",values:["Sage","Oat"]}], cart line {id,qty,opt:{Color:"Sage"}} */
function cartLines(){return cart.map(l=>({...l,k:lkey(l),p:prod(l.id)})).filter(l=>l.p&&l.p.active&&optOk(l,l.p))}
function lineMax(l){const p=prod(l.id);if(!p)return 0;const k=lkey(l);return Math.max(0,p.stock-cart.filter(x=>x.id===l.id&&lkey(x)!==k).reduce((s,x)=>s+x.qty,0))}
const lineByKey=k=>cart.find(x=>lkey(x)===k);
/* "Buy now": checkout of a single item without touching the cart */
let buyNow=LS.get("buynow",null);
const isBuyNow=()=>/[?&]buy=1/.test(location.hash)&&!!buyNow&&!!prod(buyNow.id);
function coLines(){return isBuyNow()?[{...buyNow,k:lkey(buyNow),p:prod(buyNow.id)}].filter(l=>l.p&&l.p.active&&optOk(l,l.p)):cartLines()}
const coTotal=()=>coLines().reduce((s,l)=>s+l.p.price*l.qty,0);
function startBuyNow(id,q,opt){const p=prod(id);if(!p||p.stock<=0)return;Trk.cart(id,q);buyNow={id,qty:Math.max(1,Math.min(p.stock,q||1)),...(opt?{opt}:{})};LS.set("buynow",buyNow);closeLayers(true);location.hash="#/checkout?buy=1"}
function cartTotal(){return cartLines().reduce((s,l)=>s+l.p.price*l.qty,0)}
function setCart(c){cart=c;LS.set("cart",cart);badges()}
function addToCart(id,q=1,opt=null){const p=prod(id);if(!p||p.stock<=0)return;
 if(optList(p).length&&!opt){closeLayers(true);location.hash="#/product/"+id;toast("Please choose "+optList(p).map(o=>o.name.toLowerCase()).join(" and "));return}
 Trk.cart(id,q);
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
function toggleFav(id){const on=!favs.includes(id);favs=on?[...favs,id]:favs.filter(x=>x!==id);LS.set("favs",favs);badges();favRemote(id,on);document.querySelectorAll(`[data-act="fav"][data-id="${id}"]`).forEach(b=>b.classList.toggle("on",favs.includes(id)))}
function badges(){$("#cartCount").textContent=cart.reduce((s,l)=>s+(prod(l.id)?l.qty:0),0)||"";$("#favCount").textContent=favs.filter(prod).length||""}

/* ===== search (Amazon-style) ===== */
const norm=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const tokens=q=>norm(q).split(/[^a-z0-9\u0400-\u04ff]+/).filter(Boolean);
const stem=w=>w.length>4&&/(ches|shes|xes|sses)$/.test(w)?w.slice(0,-2):w.length>3&&/[^s]s$/.test(w)?w.slice(0,-1):w;
function near(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,e=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++e>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++}}return e+(a.length-i)+(b.length-j)<=1}
function scoreOf(p,toks){
 const c=catOf(p.cat),name=norm(p.name),cat=norm(c?catLabel(c):""),rest=norm([p.short,p.desc,p.sku,...(p.specs||[]).flat()].join(" "));
 const nw=name.split(/[^a-z0-9\u0400-\u04ff]+/).filter(Boolean),aw=(cat+" "+rest).split(/[^a-z0-9\u0400-\u04ff]+/).filter(Boolean);
 let s=0;
 for(const t of toks){let b=0;
  const st=stem(t);
  if(nw.some(w=>w.startsWith(t)||stem(w)===st))b=10;else if(name.includes(t))b=7;else if(cat.includes(t))b=6;else if(aw.some(w=>w.startsWith(t)))b=4;
  else if(aw.some(w=>stem(w)===st))b=4;
  else if(t.length>=4&&nw.concat(cat.split(/[^a-z0-9\u0400-\u04ff]+/)).some(w=>w.length>=4&&((st.length>=4&&near(st,stem(w)))||near(t,w)||near(t,w.slice(0,t.length)))))b=2;
  if(!b)return 0;s+=b}
 if(name.startsWith(toks.join(" ")))s+=5;if(p.stock>0)s+=1;if(p.featured)s+=.5;return s}
function searchProducts(q,cat){const toks=tokens(q);if(!toks.length)return[];return visible().filter(p=>inCat(p,cat)).map(p=>[p,scoreOf(p,toks)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).map(x=>x[0])}
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
 hsCat().innerHTML=`<option value="">${t("allShort")}</option>`+topCats().map(c=>`<option value="${c.id}">${esc(c.name)}</option>`+subCats(c.id).map(x=>`<option value="${x.id}">\u00a0\u00a0${esc(x.name)}</option>`).join("")).join("");
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

/* ===== footer: accepted payment methods (drawn badges, no external images).
   Cards are shown when card payment is offered; Apple Pay / Google Pay only with Stripe on; bank transfer if listed in settings ===== */
const PAY_SVG={
 visa:`<svg viewBox="0 0 38 24" role="img" aria-label="Visa"><rect width="38" height="24" rx="4" fill="#fff"/><text x="19" y="16.2" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="10.5" font-weight="900" font-style="italic" fill="#1a1f71" letter-spacing=".3">VISA</text></svg>`,
 mastercard:`<svg viewBox="0 0 38 24" role="img" aria-label="Mastercard"><rect width="38" height="24" rx="4" fill="#fff"/><circle cx="15.5" cy="12" r="6.6" fill="#eb001b"/><circle cx="22.5" cy="12" r="6.6" fill="#f79e1b"/><path d="M19 6.4a6.6 6.6 0 0 1 0 11.2 6.6 6.6 0 0 1 0-11.2z" fill="#ff5f00"/></svg>`,
 amex:`<svg viewBox="0 0 38 24" role="img" aria-label="American Express"><rect width="38" height="24" rx="4" fill="#1f72cd"/><text x="19" y="15.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="8.6" font-weight="900" fill="#fff" letter-spacing=".4">AMEX</text></svg>`,
 discover:`<svg viewBox="0 0 38 24" role="img" aria-label="Discover"><rect width="38" height="24" rx="4" fill="#fff"/><text x="4" y="14.6" font-family="Arial,Helvetica,sans-serif" font-size="6.4" font-weight="800" fill="#231f20">DISC</text><circle cx="24.3" cy="12.4" r="3.3" fill="#f48120"/><text x="28" y="14.6" font-family="Arial,Helvetica,sans-serif" font-size="6.4" font-weight="800" fill="#231f20">VER</text></svg>`,
 applepay:`<svg viewBox="0 0 38 24" role="img" aria-label="Apple Pay"><rect width="38" height="24" rx="4" fill="#000"/><path fill="#fff" d="M11.1 8.4c.4-.5.7-1.2.6-1.9-.6 0-1.3.4-1.8.9-.4.4-.7 1.1-.6 1.8.7.1 1.4-.3 1.8-.8zm.6 1c-1 0-1.8.6-2.3.6s-1.2-.5-2-.5c-1 0-2 .6-2.5 1.5-1.1 1.9-.3 4.6.8 6.1.5.7 1.1 1.5 1.9 1.5.8 0 1-.5 2-.5s1.2.5 2 .5 1.3-.7 1.8-1.5c.6-.8.8-1.6.8-1.7 0 0-1.6-.6-1.6-2.4 0-1.5 1.2-2.2 1.3-2.3-.7-1-1.8-1.1-2.2-1.1z"/><text x="16" y="16.3" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="9.6" font-weight="600" fill="#fff">Pay</text></svg>`,
 googlepay:`<svg viewBox="0 0 38 24" role="img" aria-label="Google Pay"><rect width="38" height="24" rx="4" fill="#fff"/><path d="M13.6 12.2c0-.4 0-.8-.1-1.1H9v2.1h2.6c-.1.6-.5 1.1-1 1.5v1.2h1.6c.9-.9 1.4-2.2 1.4-3.7z" fill="#4285f4"/><path d="M9 16.8c1.3 0 2.4-.4 3.2-1.2l-1.6-1.2c-.4.3-1 .5-1.6.5-1.3 0-2.3-.8-2.7-2H4.7v1.3c.8 1.6 2.4 2.6 4.3 2.6z" fill="#34a853"/><path d="M6.3 12.9c-.2-.6-.2-1.2 0-1.8V9.8H4.7a4.8 4.8 0 0 0 0 4.4l1.6-1.3z" fill="#fbbc04"/><path d="M9 9.1c.7 0 1.3.2 1.8.7l1.4-1.4A4.8 4.8 0 0 0 4.7 9.8l1.6 1.3c.4-1.2 1.4-2 2.7-2z" fill="#ea4335"/><text x="16" y="15.8" font-family="Arial,Helvetica,sans-serif" font-size="8.8" font-weight="600" fill="#5f6368">Pay</text></svg>`,
 bank:`<svg viewBox="0 0 38 24" role="img" aria-label="Bank transfer"><rect width="38" height="24" rx="4" fill="#fff"/><path d="M19 4.6 11.2 8.4v1.3h15.6V8.4z M12.6 10.8h1.8v5.6h-1.8z m3.5 0h1.8v5.6h-1.8z m3.9 0h1.8v5.6H20z m3.5 0h1.8v5.6h-1.8z M11.2 17.4h15.6v1.8H11.2z" fill="#385a46"/></svg>`};
function payIcons(){const c=shipCfg(),opts=String(S.settings.paymentOptions||"");
 const card=c.pay||/card|visa|mastercard|stripe/i.test(opts),L=[];
 if(card)L.push("visa","mastercard","amex","discover");
 if(c.pay)L.push("applepay","googlepay");
 if(!c.pay&&/bank|transfer|wire|ach/i.test(opts))L.push("bank");
 return L.length?`<span class="payicons" aria-label="Accepted payment methods">${L.map(k=>`<span class="payic" title="${k==="bank"?"Bank transfer":""}">${PAY_SVG[k]}</span>`).join("")}</span>`:""}
/* ===== chrome ===== */
function chrome(){
 const st=S.settings;document.title=st.name+(st.tagline?" — "+st.tagline:"");
 $("#promo").textContent=st.promo||"";$("#brandName").textContent=st.name;$("#brandTag").textContent=st.tagline||"";
 $("#nav").innerHTML=[["#/",t("home")],["#/shop","All products"]].map(([h,l])=>`<a href="${h}">${esc(l)}</a>`).join("")+topCats().map(c=>{const subs=subCats(c.id);if(!subs.length)return `<a href="#/shop?cat=${c.id}">${esc(c.name)}</a>`;
  return `<div class="navitem"><a href="#/shop?cat=${c.id}" class="navpar" aria-haspopup="true">${esc(c.name)}<span class="navcaret" aria-hidden="true"></span></a><button type="button" class="navexp" data-act="navexp" aria-expanded="false" aria-label="${esc(c.name)}: subcategories"></button>
  <div class="navsubs"><a href="#/shop?cat=${c.id}" class="navall">All ${esc(c.name)}</a>${subs.map(x=>`<a href="#/shop?cat=${x.id}">${esc(x.name)}</a>`).join("")}</div></div>`}).join("")+`<a href="#/account" class="navacct" id="navAcct">${user?"My account":"Sign in / Register"}</a>`;
 const c=S.settings;
 const logo=($(".brand img")||{}).src||"";
 $("#footer").innerHTML=`<div class="shell foot"><div><a class="footlogo" href="#/">${logo?`<img src="${esc(logo)}" alt="" width="48" height="48">`:""}<span>${esc(c.name)}</span></a><p>${esc(c.tagline)}</p>${c.hours?`<p>${esc(c.hours)}</p>`:""}</div>
 <div><h4>${t("shop")}</h4><a href="#/shop">${t("allCats")}</a>${topCats().slice(0,6).map(x=>`<a href="#/shop?cat=${x.id}">${esc(x.name)}</a>`).join("")}</div>
 <div><h4>${t("contacts")}</h4>${c.address?`<p class="footaddr">${esc(c.address).replace(/\n/g,"<br>")}</p>`:""}${c.phone?`<a href="tel:${esc(c.phone.replace(/[^+\d]/g,""))}">${esc(c.phone)}</a>`:""}${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:""}${c.telegram?`<a href="https://t.me/${esc(c.telegram.replace(/^@/,""))}" target="_blank" rel="noopener">Telegram</a>`:""}${c.instagram?`<a href="https://instagram.com/${esc(c.instagram.replace(/^@/,""))}" target="_blank" rel="noopener">Instagram</a>`:""}<a href="#/contacts">Contact us</a></div>
 <div><h4>Help</h4><a href="#/track">Track your order</a><a href="#/delivery">${t("delivery")}</a><a href="#/returns">Returns &amp; refunds</a><a href="#/privacy">Privacy policy</a><a href="#/terms">Terms of service</a><a href="#/about">Our story</a></div></div>
 <div class="shell copy"><span>© ${new Date().getFullYear()} ${esc(c.name)}. ${t("rights")}.</span>${payIcons()}</div>`;
 hsSetup();badges();acctBadge();
}
function markNav(path){const full=(location.hash.slice(1)||"/"),cat=new URLSearchParams(full.split("?")[1]||"").get("cat");document.querySelectorAll("#nav a").forEach(a=>{const h=a.getAttribute("href").slice(1);const on=h==="/"?path==="/":h.includes("?cat=")?path==="/shop"&&(h.endsWith("="+cat)||a.classList.contains("navpar")&&!!cat&&(catOf(cat)||{}).parent===h.split("=")[1]):h==="/shop"?path==="/shop"&&!cat:path.startsWith(h);a.classList.toggle("active",on)});$("#nav").classList.remove("open");NavDrop.hide(0)}

/* ===== header: subcategory dropdown (desktop). The list is copied from .navsubs into one floating box ===== */
const NavDrop={el:null,t:null,cur:null,
 box(){if(this.el)return this.el;const d=this.el=document.createElement("div");d.className="navdrop";d.setAttribute("role","menu");document.body.appendChild(d);
  d.addEventListener("mouseenter",()=>clearTimeout(this.t));d.addEventListener("mouseleave",()=>this.hide(180));d.addEventListener("click",e=>{if(e.target.closest("a"))this.hide(0)});
  d.addEventListener("focusout",e=>{if(!d.contains(e.relatedTarget)&&!(this.cur&&this.cur.contains(e.relatedTarget)))this.hide(0)});return d},
 show(it){if(matchMedia("(max-width:860px)").matches||!it)return;clearTimeout(this.t);const d=this.box();
  if(this.cur!==it||!d.classList.contains("on")){d.innerHTML=it.querySelector(".navsubs").innerHTML;this.cur=it;
   const cat=new URLSearchParams((location.hash.split("?")[1])||"").get("cat");d.querySelectorAll("a").forEach(a=>a.classList.toggle("active",!a.classList.contains("navall")&&a.getAttribute("href").endsWith("="+cat)))}
  d.classList.add("on");it.classList.add("hover");const r=it.getBoundingClientRect(),bar=it.closest(".navbar")||it,b=bar.getBoundingClientRect().bottom;
  d.style.top=Math.round(b)+"px";d.style.left=Math.round(Math.max(8,Math.min(r.left-14,innerWidth-d.offsetWidth-8)))+"px"},
 hide(ms){clearTimeout(this.t);this.t=setTimeout(()=>{if(this.el)this.el.classList.remove("on");if(this.cur)this.cur.classList.remove("hover")},ms)}};
document.addEventListener("mouseover",e=>{const it=e.target.closest&&e.target.closest("#nav .navitem");if(it)NavDrop.show(it)});
document.addEventListener("mouseout",e=>{const it=e.target.closest&&e.target.closest("#nav .navitem");if(it&&!it.contains(e.relatedTarget)&&!(NavDrop.el&&NavDrop.el.contains(e.relatedTarget)))NavDrop.hide(180)});
document.addEventListener("focusin",e=>{const it=e.target.closest&&e.target.closest("#nav .navitem");if(it&&e.target.classList.contains("navpar"))NavDrop.show(it);else if(!(NavDrop.el&&NavDrop.el.contains(e.target)))NavDrop.hide(0)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&NavDrop.el&&NavDrop.el.classList.contains("on")){const it=NavDrop.cur;NavDrop.hide(0);it&&it.querySelector(".navpar").focus()}
 else if(e.key==="ArrowDown"&&e.target.classList&&e.target.classList.contains("navpar")&&NavDrop.el&&NavDrop.el.classList.contains("on")){e.preventDefault();const a=NavDrop.el.querySelector("a");a&&a.focus()}});
addEventListener("scroll",()=>{if(NavDrop.el&&NavDrop.el.classList.contains("on"))NavDrop.hide(0)},{passive:true});
addEventListener("resize",()=>NavDrop.hide(0));

/* ===== layers: mini cart, quick view, filter drawer ===== */
let lastFocus=null;
function openLayer(id){closeLayers(true);lastFocus=document.activeElement;const el=$("#"+id);el.classList.add(id==="qv"?"show":"open");$("#overlay").classList.add("show");document.body.classList.add("locked");setTimeout(()=>{const f=el.querySelector("[data-autofocus]")||el.querySelector("button,a,input");f&&f.focus({preventScroll:true})},60)}
function closeLayers(silent){["cartDrawer","filters"].forEach(i=>{const e=document.getElementById(i);e&&e.classList.remove("open")});const q=$("#qv");q&&q.classList.remove("show");$("#overlay").classList.remove("show");document.body.classList.remove("locked");if(!silent&&lastFocus&&lastFocus.focus)try{lastFocus.focus({preventScroll:true})}catch(e){}}
function renderMini(){
 const L=cartLines(),tot=cartTotal(),n=L.reduce((s,l)=>s+l.qty,0);
 $("#cartDrawer").innerHTML=`<div class="dhead"><h3>${t("yourCart")} <span class="muted">(${n})</span></h3><button class="iconbtn" data-act="closeall" aria-label="${t("close")}" data-autofocus>${X}</button></div>
 ${L.length?`<div class="dbody">
 ${L.map(l=>`<div class="mline"><a href="#/product/${l.p.id}"><img src="${esc(img0(l.p))}" alt=""></a><div class="mi"><a href="#/product/${l.p.id}" class="mn">${esc(l.p.name)}</a>${l.opt?`<span class="optline">${esc(optStr(l.opt,l.p))}</span>`:""}${l.p.sku?`<span class="optline">Item # ${esc(l.p.sku)}</span>`:""}<span class="muted small">${money(l.p.price)}</span>
 <div class="mrow"><div class="qty sm"><button data-act="mq" data-d="-1" data-k="${esc(l.k)}" aria-label="−">−</button><span>${l.qty}</span><button data-act="mq" data-d="1" data-k="${esc(l.k)}" aria-label="+" ${l.qty>=lineMax(l)?"disabled":""}>+</button></div><button class="linkbtn" data-act="mrm" data-k="${esc(l.k)}">${t("remove")}</button></div></div><b class="mt">${money(l.p.price*l.qty)}</b></div>`).join("")}</div>
 <div class="dfoot"><div class="row total" style="margin:0 0 4px;border:0;padding-top:0"><span>${t("subtotal")}</span><span>${money(tot)}</span></div><p class="muted small" style="margin:0 0 14px">${t("shipping")}: ${money(shipCost(tot,false))} · tax calculated at checkout</p>
 <a class="btn primary block" href="#/checkout">${t("checkout")} →</a><a class="btn block" style="margin-top:8px" href="#/cart">${t("viewCart")}</a></div>`
 :`<div class="dbody"><div class="empty" style="border:0;padding:50px 10px"><b>${t("cartEmpty")}</b>${t("cartEmptyS")}<br><br><a class="btn primary" href="#/shop">${t("shopNow")} →</a></div></div>`}`}
function openCart(){renderMini();openLayer("cartDrawer")}
function quickView(id){
 const p=prod(id);if(!p)return;Trk.product(id);const c=catOf(p.cat),st=stockState(p),imgs=p.images&&p.images.length?p.images:[img0(p)];
 $("#qv").innerHTML=`<div class="box"><button class="iconbtn qvx" data-act="closeall" aria-label="${t("close")}">${X}</button>
 <div class="qvg">${carouselHtml(imgs,p.name,"qv",{thumbs:true})}</div>
 <div class="qvi"><span class="catname">${esc(c?c.name:"")}</span><h2>${esc(p.name)}</h2>${p.sku?`<span class="skuline">Item # ${esc(p.sku)}</span>`:""}<span class="stock ${st}">${st==="out"?t("out"):st==="low"?t("low"):t("inStock")}</span>
 ${(()=>{const r=rating(p.id);return r?`<div class="crate">${stars(r.avg)}<span>${r.avg.toFixed(1)} (${r.n})</span></div>`:`<div class="crate none">${stars(0)}<span>No reviews yet</span></div>`})()}<div class="pricebox"><span class="price">${money(p.price)}</span></div>${p.short?`<p class="lead">${esc(p.short)}</p>`:""}
 ${optsHtml(p,"qv")}<div class="buyrow"><div class="qty"><button data-act="qvq" data-d="-1" aria-label="−">−</button><input id="qvq" type="number" min="1" max="${Math.max(1,p.stock)}" value="1" aria-label="${t("qty")}"><button data-act="qvq" data-d="1" aria-label="+">+</button></div>
 <button class="btn primary" style="flex:1" data-act="qvadd" data-id="${p.id}" ${st==="out"?"disabled":""} data-autofocus>${st==="out"?t("notAvail"):t("addToCart")}</button>
 <button class="btn ${favs.includes(p.id)?"fav-inline on":"fav-inline"}" data-act="fav" data-id="${p.id}" aria-label="${t("favorites")}" style="padding:11px 13px">${ICON.heart.replace("<svg",'<svg width="20" height="20"')}</button></div>
 <button class="btn buynow block" data-act="buynow" data-id="${p.id}" data-scope="qv" ${st==="out"?"hidden":""}>Buy now</button>
 <a class="textlink" href="#/product/${p.id}">${t("viewDetails")} →</a></div></div>`;
 openLayer("qv")}

/* ===== photo carousel (product page, quick view, fullscreen) ===== */
function carouselHtml(imgs,alt,id,o={}){const n=imgs.length;
 return `<div class="car${n>1?" multi":""}" data-car="${id}" data-alt="${esc(alt)}"><div class="cartrack" tabindex="${n>1?0:-1}" aria-roledescription="carousel" aria-label="${esc(alt)} — photos">${imgs.map((s,i)=>`<div class="carslide" role="group" aria-roledescription="slide" aria-label="${i+1} of ${n}"><img src="${esc(s)}" alt="${esc(alt)}${n>1?` — photo ${i+1}`:""}" ${i?'loading="lazy"':""} draggable="false"${o.zoom?` data-act="lbopen" data-i="${i}"`:""}></div>`).join("")}</div>
 ${o.zoom?`<button class="carzoom" data-act="lbopen" data-i="0" aria-label="View photos full screen"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>`:""}
 ${n>1?`<button class="carbtn prev" data-act="carmove" data-d="-1" aria-label="Previous photo"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg></button><button class="carbtn next" data-act="carmove" data-d="1" aria-label="Next photo"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>
 <div class="carcount" aria-live="polite"><span>1</span> / ${n}</div><div class="cardots" aria-hidden="true">${imgs.map((_,i)=>`<i class="${i?"":"on"}"></i>`).join("")}</div>`:""}</div>
 ${o.thumbs&&n>1?`<div class="thumbs" data-for="${id}">${imgs.map((s,i)=>`<button class="${i?"":"on"}" data-act="cargo" data-car="${id}" data-i="${i}" aria-label="Show photo ${i+1}"><img src="${esc(s)}" alt="" loading="lazy"></button>`).join("")}</div>`:""}`}
const carIdx=c=>{const t=c&&c.querySelector(".cartrack");return t&&t.clientWidth?Math.round(t.scrollLeft/t.clientWidth):0};
function carGo(c,i,instant){if(!c)return;const t=c.querySelector(".cartrack"),n=t.children.length;i=(i+n)%n;t.scrollTo({left:i*t.clientWidth,behavior:instant?"auto":"smooth"});carSync(c,i)}
function carMove(c,d){carGo(c,carIdx(c)+d)}
function carSync(c,i){if(!c)return;if(i===undefined)i=carIdx(c);const n=c.querySelector(".cartrack").children.length;
 const cnt=c.querySelector(".carcount span");if(cnt)cnt.textContent=i+1;c.querySelectorAll(".cardots i").forEach((d,k)=>d.classList.toggle("on",k===i));
 const z=c.querySelector(".carzoom");if(z)z.dataset.i=i;
 document.querySelectorAll(`.thumbs[data-for="${c.dataset.car}"] button`).forEach((b,k)=>{b.classList.toggle("on",k===i);if(k===i&&b.parentNode.scrollWidth>b.parentNode.clientWidth)b.scrollIntoView({block:"nearest",inline:"nearest"})})}
let carT;document.addEventListener("scroll",e=>{const t=e.target;if(!t.classList||!t.classList.contains("cartrack"))return;clearTimeout(carT);carT=setTimeout(()=>carSync(t.closest(".car")),60)},true);
document.addEventListener("keydown",e=>{const lb=$("#lb");
 if(lb&&!lb.hidden){if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();closeLightbox()}else if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();carMove(lb.querySelector(".car"),e.key==="ArrowLeft"?-1:1)}return}
 const t=e.target;if(t.classList&&t.classList.contains("cartrack")&&(e.key==="ArrowLeft"||e.key==="ArrowRight")){e.preventDefault();carMove(t.closest(".car"),e.key==="ArrowLeft"?-1:1)}},true);
window.addEventListener("resize",()=>document.querySelectorAll(".car").forEach(c=>{const i=+((c.querySelector(".carcount span")||{}).textContent||1)-1;c.querySelector(".cartrack").scrollLeft=i*c.querySelector(".cartrack").clientWidth}));
let lbFocus=null;
function lightbox(imgs,i,alt){if(!imgs.length)return;lbFocus=document.activeElement;let lb=$("#lb");if(!lb){lb=document.createElement("div");lb.id="lb";lb.className="lb";lb.setAttribute("role","dialog");lb.setAttribute("aria-modal","true");lb.setAttribute("aria-label","Photo viewer");document.body.appendChild(lb)}
 lb.innerHTML=`<button class="lbx iconbtn" data-act="lbclose" aria-label="Close">${X}</button>${carouselHtml(imgs,alt,"lb",{thumbs:true})}`;lb.hidden=false;document.body.classList.add("lbopen");
 requestAnimationFrame(()=>{carGo(lb.querySelector(".car"),i||0,true);lb.querySelector(".lbx").focus()})}
function closeLightbox(){const lb=$("#lb");if(!lb||lb.hidden)return;lb.hidden=true;lb.innerHTML="";document.body.classList.remove("lbopen");if(lbFocus&&lbFocus.focus)try{lbFocus.focus({preventScroll:true})}catch(_){}}
/* ===== storefront views ===== */
function card(p){
 const c=catOf(p.cat),st=stockState(p);
 return `<article class="card"><div class="labels">${p.oldPrice>p.price?`<span class="label sale">−${Math.round(100-p.price/p.oldPrice*100)}%</span>`:""}${st==="out"?`<span class="label out">${t("out")}</span>`:""}${isNew(p)?`<span class="label new">${t("newL")}</span>`:""}</div>
 <button class="fav ${favs.includes(p.id)?"on":""}" data-act="fav" data-id="${p.id}" aria-label="${t("favorites")}">${ICON.heart}</button>
 <div class="phw"><a class="ph" href="#/product/${p.id}"><img src="${esc(img0(p))}" alt="${esc(p.name)}" loading="lazy">${p.images&&p.images[1]?`<img class="alt" src="${esc(p.images[1])}" alt="" loading="lazy" aria-hidden="true">`:""}${p.images&&p.images.length>1?`<span class="nphotos" aria-label="${p.images.length} photos">${p.images.length} photos</span>`:""}</a><button class="qvbtn" data-act="qv" data-id="${p.id}">${t("quickView")}</button></div>
 <div class="body"><span class="catname">${esc(c?c.name:"")}</span><h3><a href="#/product/${p.id}">${esc(p.name)}</a></h3>${(()=>{const r=rating(p.id);return r?`<div class="crate">${stars(r.avg)}<span>(${r.n})</span></div>`:`<div class="crate none">${stars(0)}<span>(0)</span></div>`})()}
 <div class="bottom"><div><span class="price ${p.oldPrice>p.price?"sale":""}">${money(p.price)}</span>${p.oldPrice>p.price?`<span class="old">${money(p.oldPrice)}</span>`:""}</div>
 <button class="addbtn" data-act="add" data-id="${p.id}" ${st==="out"?"disabled":""} aria-label="${t("addToCart")}">${ICON.bag}</button></div></div></article>`}
function viewHome(){
 const st=S.settings,vis=visible();
 let feat=vis.filter(p=>p.featured);if(feat.length<4)feat=feat.concat(vis.filter(p=>!p.featured)).slice(0,4);
 const shown=new Set(feat.slice(0,4).map(p=>p.id));let fresh=[...vis].sort((a,b)=>(b.created||0)-(a.created||0));fresh=fresh.filter(p=>!shown.has(p.id)).concat(fresh.filter(p=>shown.has(p.id))).slice(0,4);
 const heroImg=st.heroImage||PHOTO.hero;
 const heroMob=st.heroImageMobile||heroImg,pos=st.heroFocus||"center",link=st.heroBtnLink||"#/shop";
 return `<section class="hero2" data-track="hero" aria-label="${esc(st.heroTitle||st.name)}"><picture>${st.heroImageMobile?`<source media="(max-width:700px)" srcset="${esc(heroMob)}">`:""}<img src="${esc(heroImg)}" alt="" fetchpriority="high" style="object-position:${esc(pos)}"></picture>
 <div class="shell hero2-in"><div class="hero2-box">${st.heroEyebrow?`<span class="eyebrow">${esc(st.heroEyebrow)}</span>`:""}<h1>${esc(st.heroTitle)}</h1>${st.heroText?`<p>${esc(st.heroText)}</p>`:""}
 ${st.heroButtons==="1"?`<div class="hero-cta"><a class="btn hero-btn" href="${esc(link)}">${esc(st.heroBtnText||t("shopNow"))} →</a><a class="btn hero-btn2" href="#/about">Our story</a></div>`:""}</div></div>${st.heroButtons==="1"?"":`<a class="hero2-link" href="${esc(link)}" aria-label="${esc(st.heroBtnText||t("shopNow"))}"></a>`}</section>
 <div class="shell perks" data-track="perks">${[["🚚","perk1"],["💳","perk2"],["↺","perk3"],["💬","perk4"]].map(([i,k])=>`<div class="perk"><i>${i}</i><span><b>${t(k)}</b>${t(k+"s")}</span></div>`).join("")}</div>
 <section class="section" style="padding-top:20px" data-track="categories"><div class="shell"><div class="section-head"><div><span class="eyebrow">${t("categories")}</span><h2>${lang==="en"?"Shop by category":"Оберіть категорію"}</h2></div><a class="textlink" href="#/shop">${t("viewAll")}</a></div>
 <div class="grid cats">${topCats().map(c=>`<a class="cat" href="#/shop?cat=${c.id}"><div class="ph"><img src="${esc(catImg(c))}" alt="" loading="lazy"></div><b>${esc(c.name)}</b><small>${nItems(vis.filter(p=>inCat(p,c.id)).length)}</small></a>`).join("")}</div></div></section>
 <section class="section alt" data-track="featured"><div class="shell"><div class="section-head"><div><span class="eyebrow">${lang==="en"?"Our favourites":"Обирають найчастіше"}</span><h2>${t("featured")}</h2></div><a class="textlink" href="#/shop">${t("viewAll")}</a></div><div class="grid">${feat.slice(0,4).map(card).join("")}</div></div></section>
 <section class="section" data-track="new"><div class="shell"><div class="section-head"><div><span class="eyebrow">${lang==="en"?"Just in":"Щойно надійшли"}</span><h2>${t("newArrivals")}</h2></div><a class="textlink" href="#/shop?sort=new">${t("viewAll")}</a></div><div class="grid">${fresh.map(card).join("")}</div></div></section>`}
let shopShown=12,shopKey="";
function viewShop(q){
 const cat=q.get("cat")||"",raw=(q.get("q")||"").trim(),stock=q.get("stock")==="1",sort=q.get("sort")||(raw?"rel":"pop");
 const min=q.get("min")!==null&&q.get("min")!==""?+q.get("min"):null,max=q.get("max")!==null&&q.get("max")!==""?+q.get("max"):null;
 const key=[...q.entries()].filter(([k])=>k!=="sort").join("&");if(key!==shopKey){shopKey=key;shopShown=12}
 const base=raw?searchProducts(raw,""):visible();
 const fPrice=p=>(min===null||p.price>=min)&&(max===null||p.price<=max),fStock=p=>!stock||p.stock>0,fCat=p=>inCat(p,cat);
 let list=base.filter(p=>fCat(p)&&fPrice(p)&&fStock(p));
 if(raw)Trk.search(raw,base.length);
 const mpos=p=>p.position>0?p.position:1e9;const by={pop:(a,b)=>(mpos(a)-mpos(b))||((b.stock>0)-(a.stock>0))||(b.featured-a.featured)||((b.created||0)-(a.created||0)),new:(a,b)=>(b.created||0)-(a.created||0),cheap:(a,b)=>a.price-b.price,exp:(a,b)=>b.price-a.price,name:(a,b)=>a.name.localeCompare(b.name)};
 if(sort!=="rel"||!raw)list.sort(by[sort]||by.pop);
 const c=catOf(cat),par=catParent(c),topC=par||c,subs=topC?subCats(topC.id):[];
 const link=o=>{const n=new URLSearchParams(q);Object.entries(o).forEach(([k,v])=>v!==""&&v!=null?n.set(k,v):n.delete(k));const s=n.toString();return"#/shop"+(s?"?"+s:"")};
 const sorts=(raw?[["rel","bestMatch"]]:[]).concat([["pop","sortPop"],["new","sortNew"],["cheap","sortCheap"],["exp","sortExp"],["name","sortName"]]);
 const title=raw?`${t("resultsFor")} “${esc(raw)}”`:esc(c?c.name:t("shop"));
 const popular=visible().filter(p=>p.featured&&p.stock>0).slice(0,4);
 // facet counts (each ignores its own filter)
 const catCount=id=>base.filter(p=>inCat(p,id)&&fPrice(p)&&fStock(p)).length;
 const stockCount=base.filter(p=>fCat(p)&&fPrice(p)&&p.stock>0).length;
 const prices=visible().map(p=>p.price),top=Math.max(0,...prices);
 const step=top>400?100:top>150?50:top>60?20:10;const bands=[[null,step],[step,step*2],[step*2,step*4],[step*4,null]].filter(([a,b])=>visible().some(p=>(a===null||p.price>=a)&&(b===null||p.price<=b)));
 const bandLabel=([a,b])=>a===null?`${t("under")} ${money(b)}`:b===null?`${t("over")} ${money(a)}`:`${money(a)} – ${money(b)}`;
 const bandCount=([a,b])=>base.filter(p=>fCat(p)&&fStock(p)&&(a===null||p.price>=a)&&(b===null||p.price<=b)).length;
 const active=[];
 if(raw)active.push([`“${esc(raw)}”`,link({q:""})]);if(c)active.push([esc(catLabel(c)),link({cat:""})]);
 if(min!==null||max!==null)active.push([min!==null&&max!==null?`${money(min)} – ${money(max)}`:min!==null?`${t("over")} ${money(min)}`:`${t("under")} ${money(max)}`,link({min:"",max:""})]);
 if(stock)active.push([t("inStockOnly"),link({stock:""})]);
 const shown=list.slice(0,shopShown);
 return `<div class="page-head"><div class="shell"><div class="crumbs"><a href="#/">${t("home")}</a> / <a href="#/shop">${t("shop")}</a>${par?` / <a href="${link({cat:par.id})}">${esc(par.name)}</a>`:""}${c?" / "+esc(c.name):""}</div><h1>${title}</h1><p>${nItems(list.length)}${raw&&c?` ${t("inCat")} ${esc(c.name)}`:""}</p>
 ${subs.length?`<nav class="subchips" aria-label="${esc(topC.name)}: subcategories"><a class="subchip ${cat===topC.id?"on":""}" href="${link({cat:topC.id})}">All</a>${subs.map(x=>{const n=catCount(x.id);return `<a class="subchip ${cat===x.id?"on":""} ${n?"":"dim"}" href="${link({cat:x.id})}">${esc(x.name)} <small>${n}</small></a>`}).join("")}</nav>`:""}</div></div>
 <div class="shell shoplayout"><aside class="filters" id="filters" aria-label="${t("filters")}"><div class="fhead"><h3>${t("filters")}</h3><button class="iconbtn mob" data-act="closeall" aria-label="${t("close")}">${X}</button></div>
 <div class="fgroup"><h4>${t("category")}</h4><a class="fopt ${!cat?"on":""}" href="${link({cat:""})}"><span>${t("allCats")}</span><small>${catCount("")}</small></a>${topCats().map(x=>{const n=catCount(x.id),row=(y,sub,n)=>`<a class="fopt ${sub?"fsub":""} ${cat===y.id?"on":""} ${n?"":"dim"}" href="${link({cat:y.id})}"><span>${esc(y.name)}</span><small>${n}</small></a>`;
  return row(x,false,n)+(topC&&topC.id===x.id?subCats(x.id).map(y=>row(y,true,catCount(y.id))).join(""):"")}).join("")}</div>
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
 const c=catOf(p.cat),cp=catParent(c),st=stockState(p),imgs=p.images&&p.images.length?p.images:[img0(p)];
 const rel=visible().filter(x=>x.cat===p.cat&&x.id!==p.id).slice(0,4);
 const specs=(p.specs||[]).filter(s=>s[0]||s[1]);
 return `<div class="shell"><div class="pdp"><div class="gallery">${carouselHtml(imgs,p.imgAlt||p.name,"pdp",{thumbs:true,zoom:true})}</div>
 <div><div class="crumbs"><a href="#/">${t("home")}</a> / <a href="#/shop">${t("shop")}</a>${cp?` / <a href="#/shop?cat=${cp.id}">${esc(cp.name)}</a>`:""}${c?` / <a href="#/shop?cat=${c.id}">${esc(c.name)}</a>`:""}</div>
 ${!p.active?`<div class="note">Hidden product — customers can’t see it.</div>`:""}
 <h1>${esc(p.name)}</h1>${(()=>{const r=rating(p.id);return r?`<button class="crate rlink" data-act="toreviews">${stars(r.avg,17)}<span>${r.avg.toFixed(1)} · ${r.n} ${r.n===1?"review":"reviews"}</span></button>`:`<button class="crate rlink none" data-act="toreviews">${stars(0,17)}<span>No reviews yet · Write a review</span></button>`})()}<span class="stock ${st}">${st==="out"?t("out"):st==="low"?t("low"):t("inStock")}</span>${p.sku?` <span class="muted small" style="margin-left:12px">Item # <b>${esc(p.sku)}</b></span>`:""}
 <div class="pricebox"><span class="price ${p.oldPrice>p.price?"sale":""}">${money(p.price)}</span>${p.oldPrice>p.price?`<span class="old">${money(p.oldPrice)}</span><span class="label sale">−${Math.round(100-p.price/p.oldPrice*100)}%</span>`:""}</div>
 ${p.short?`<p class="lead">${esc(p.short)}</p>`:""}
 ${optsHtml(p,"pdp")}<div class="buyrow"><div class="qty"><button data-act="q-" aria-label="-">−</button><input id="pq" type="number" min="1" max="${Math.max(1,p.stock)}" value="1" aria-label="${t("qty")}"><button data-act="q+" aria-label="+">+</button></div>
 <button class="btn primary" style="flex:1" data-act="addq" data-id="${p.id}" ${st==="out"?"disabled":""}>${ICON.bag.replace("<svg",'<svg width="18" height="18"')} ${st==="out"?t("notAvail"):t("addToCart")}</button>
 <button class="btn fav-inline ${favs.includes(p.id)?"on":""}" data-act="fav" data-id="${p.id}" aria-label="${t("favorites")}" style="padding:11px 13px">${ICON.heart.replace("<svg",'<svg width="20" height="20"')}</button></div>
 <button class="btn buynow block" data-act="buynow" data-id="${p.id}" data-scope="pdp" ${st==="out"?"hidden":""}>Buy now</button>
 <div class="infobox"><b>🚚 ${t("deliveryInfo")}</b>${esc(shipNote())}<span class="retnote">↺ Easy returns within ${shipCfg().days} days · <a class="textlink" href="#/returns">Return policy</a></span></div></div></div>
 <div class="tabsec">${p.desc?`<div><h2>${t("description")}</h2><div class="desc">${esc(p.desc)}</div></div>`:"<div></div>"}${specs.length?`<div><h2>${t("specs")}</h2><table class="specs">${specs.map(s=>`<tr><td>${esc(s[0])}</td><td>${esc(s[1])}</td></tr>`).join("")}</table></div>`:""}</div>
 ${reviewsHtml(p)}
 ${rel.length?`<section class="section" style="padding-top:10px"><div class="section-head"><h2>${t("related")}</h2></div><div class="grid">${rel.map(card).join("")}</div></section>`:""}</div>`}
function viewCart(){
 const L=cartLines();
 if(!L.length)return `<div class="page-head"><div class="shell"><h1>${t("cart")}</h1></div></div><div class="shell section"><div class="empty"><b>${t("cartEmpty")}</b>${t("cartEmptyS")}<br><br><a class="btn primary" href="#/shop">${t("shopNow")} →</a></div></div>`;
 return `<div class="page-head"><div class="shell"><h1>${t("cart")}</h1></div></div><div class="shell cartgrid"><div>${L.map(l=>`<div class="line"><a href="#/product/${l.p.id}"><img src="${esc(img0(l.p))}" alt=""></a><div><h3><a href="#/product/${l.p.id}">${esc(l.p.name)}</a></h3>${l.opt?`<div class="optline">${esc(optStr(l.opt,l.p))}</div>`:""}${l.p.sku?`<div class="optline">Item # ${esc(l.p.sku)}</div>`:""}<div class="unit">${money(l.p.price)} / ${t("pcs")}</div><button class="linkbtn" data-act="rm" data-k="${esc(l.k)}">${t("remove")}</button></div>
 <div class="right"><div class="qty"><button data-act="cq" data-d="-1" data-k="${esc(l.k)}">−</button><input type="number" value="${l.qty}" min="1" max="${lineMax(l)}" data-act="cqi" data-k="${esc(l.k)}" aria-label="${t("qty")}"><button data-act="cq" data-d="1" data-k="${esc(l.k)}">+</button></div><b>${money(l.p.price*l.qty)}</b></div></div>`).join("")}
 <a class="textlink" href="#/shop">← ${t("continueShop")}</a></div>${summary(true)}</div>`}
/* ===== shipping & sales tax (same rules as private.prepare_order in the database) ===== */
function shipCfg(){const s=S.settings,n=(v,d)=>{const x=parseFloat(v);return isNaN(x)?d:x},on=v=>v===true||v==="1"||v==="true";
 return{std:n(s.shipStandard,12),exp:n(s.shipExpress,25),expOn:on(s.expressOn),pay:on(s.paymentsOn),rates:s.taxRates&&typeof s.taxRates==="object"?s.taxRates:{},taxShip:on(s.taxShipping),days:n(s.returnDays,14)}}
function deliveryOpts(){const c=shipCfg(),L=[{k:"standard",label:"Standard shipping (3–5 business days)",price:c.std}];if(c.expOn)L.push({k:"express",label:"Express shipping (1–2 business days)",price:c.exp});return L}
function shipCost(sub,express){const c=shipCfg();return express&&c.expOn?c.exp:c.std}
function taxRate(st){const r=parseFloat(shipCfg().rates[st]);return isNaN(r)?0:Math.min(20,Math.max(0,r))}
function calcTotals(sub,express,st){const c=shipCfg(),ship=shipCost(sub,express),rate=st?taxRate(st):0,tax=Math.round((sub+(c.taxShip?ship:0))*rate+1e-9)/100;
 return{sub,ship,rate,tax,total:Math.round((sub+ship+tax)*100)/100,express:!!(express&&c.expOn)}}
function shipNote(){const c=shipCfg();return `Standard (3–5 business days) — ${money(c.std)}${c.expOn?` · Express (1–2 business days) — ${money(c.exp)}`:""}`}
function summary(withBtn,st,express){
 const sub=withBtn?cartTotal():coTotal(),T=calcTotals(sub,express,st);
 return `<aside class="summary" id="coSum"><h3>${t("yourOrder")}</h3>${withBtn?"":coLines().map(l=>`<div class="row small"><span>${esc(l.p.name)}${l.opt?` <span class="muted">(${esc(optStr(l.opt,l.p))})</span>`:""} × ${l.qty}${l.p.sku?`<br><span class="muted">Item # ${esc(l.p.sku)}</span>`:""}</span><span>${money(l.p.price*l.qty)}</span></div>`).join("")}
 <div class="row"><span>${t("subtotal")}</span><b>${money(sub)}</b></div><div class="row"><span>${t("shipping")}${T.express?" (Express)":""}</span><span>${money(T.ship)}</span></div>
 <div class="row"><span>Estimated sales tax${!withBtn&&st?` <span class="muted small">(${T.rate?esc(st)+" "+(+T.rate.toFixed(3))+"%":"no sales tax in "+esc(st)})</span>`:""}</span><span${withBtn||!st?' class="muted small"':""}>${withBtn?"Calculated at checkout":st?money(T.tax):"Select your state"}</span></div>
 <div class="row total"><span>${withBtn?"Estimated total":t("total")}</span><span>${money(withBtn?T.sub+T.ship:T.total)}</span></div>${withBtn?`<a class="btn primary block" style="margin-top:14px" href="#/checkout">${t("checkout")} →</a>`:`<p class="small muted" style="margin:10px 0 0">Sales tax is based on your shipping state.</p>`}</aside>`}
function viewCheckout(){
 if(!coLines().length){location.hash=/[?&]buy=1/.test(location.hash)?"#/":"#/cart";return""}
 const o=s=>(s||"").split("\n").map(x=>x.trim()).filter(Boolean);let d=LS.get("buyer",{});
 if(user&&!profile){loadProfile().then(()=>{if(location.hash.startsWith("#/checkout"))render()})}
 if(user&&profile)d={...d,name:profile.full_name||d.name,phone:profile.phone||d.phone,email:user.email,city:profile.city||d.city,address:profile.address_line||d.address,address2:profile.address_line?(profile.address_line2||""):d.address2,state:profile.state||d.state,zip:profile.zip||d.zip};
 return `<div class="page-head"><div class="shell"><div class="crumbs"><a href="#/cart">${t("cart")}</a> / ${t("checkout")}</div><h1>${t("checkoutT")}</h1></div></div>
 <div class="shell cartgrid"><form class="stack" data-form="checkout" novalidate>${isBuyNow()?`<div class="signhint buynowbar">⚡ <b>Buy now:</b> you’re checking out just this item.${cartLines().length?` Your cart (${cartLines().reduce((s,l)=>s+l.qty,0)}) is saved — <a class="textlink" href="#/cart">go to cart</a>.`:""}</div>`:""}${sb&&!user?`<div class="signhint">Have an account? <a class="textlink" href="#/account" data-act="cologin">Sign in</a> for faster checkout — or continue as a guest.</div>`:""}<div class="panel"><h2>${t("contactsT")}</h2><div class="form">
 <div class="full"><label>Full name <span class="req">*</span></label><input class="field" name="name" autocomplete="name" maxlength="120" value="${esc(d.name)}" required></div>
 <div><label>${t("email")} <span class="req">*</span></label><input class="field" name="email" type="email" autocomplete="email" maxlength="200" value="${esc(d.email)}" required><div class="ferr" data-for="email"></div></div>
 <div><label>${t("phone")} <span class="req">*</span></label><input class="field" name="phone" type="tel" autocomplete="tel" maxlength="40" value="${esc(d.phone)}" placeholder="(555) 123-4567" required><div class="ferr" data-for="phone"></div></div>
 <p class="full help" style="margin:0">We’ll email your order confirmation and tracking number. Your phone is only used by the carrier for delivery.</p></div></div>
 <div class="panel"><h2>${t("deliveryM")}</h2><div class="radio">${deliveryOpts().map((x,i)=>{return `<label class="shipopt"><input type="radio" name="delivery" value="${esc(x.label)}" ${i?"":"checked"}><span>${esc(x.label)}</span><b>${money(x.price)}</b></label>`}).join("")}</div>
 <h3 style="margin:20px 0 4px;font-size:16px">Shipping address</h3><div class="form" style="margin-top:10px"><div class="full"><label>Street address (house number and street) <span class="req">*</span></label><input class="field" name="address" autocomplete="address-line1" maxlength="150" value="${esc(d.address)}" placeholder="123 Main St" required><div class="ferr" data-for="address"></div></div>
 <div class="full"><label>Apartment, suite, unit, floor <span class="muted small">(optional)</span></label><input class="field" name="address2" autocomplete="address-line2" maxlength="60" placeholder="Apt 4B" value="${esc(d.address2||"")}"></div>
 <div><label>${t("city")} <span class="req">*</span></label><input class="field" name="city" autocomplete="address-level2" maxlength="100" value="${esc(d.city)}" required></div>
 <div><label>State <span class="req">*</span></label><select class="field" name="state" autocomplete="address-level1" required><option value="">Select state</option>${US_STATES.map(([c,n])=>`<option value="${c}" ${stateCode(d.state)===c?"selected":""}>${n}</option>`).join("")}</select></div>
 <div><label>ZIP code <span class="req">*</span></label><input class="field" name="zip" autocomplete="postal-code" inputmode="numeric" maxlength="10" value="${esc(d.zip)}" placeholder="12345" required><div class="ferr" data-for="zip"></div></div>
 <div><label>Country</label><input class="field" value="United States" disabled></div></div></div>
 <div class="panel"><h2>${t("paymentM")}</h2>${shipCfg().pay?`<div class="paysecure">🔒 <div><b>Pay securely by card, Apple Pay or Google Pay</b><br><span class="small muted">You’ll complete payment on a secure Stripe page. Your order is placed as soon as the payment goes through.</span></div></div><input type="hidden" name="payment" value="Card (Stripe)">`:`<div class="radio">${o(S.settings.paymentOptions).map((x,i)=>`<label><input type="radio" name="payment" value="${esc(x)}" ${i?"":"checked"}>${esc(x)}</label>`).join("")}</div>`}
 <div style="margin-top:14px"><label class="lbl">${t("comment")}</label><textarea class="field" name="comment"></textarea></div></div>
 <div id="coErr">${/[?&]canceled=1/.test(location.hash)?`<div class="note">Payment was cancelled — nothing was charged. Your cart is saved, you can try again.</div>`:""}</div><p class="small muted" style="margin:0">By placing your order, you agree to our <a class="textlink" href="#/terms" target="_blank">Terms of Service</a> and <a class="textlink" href="#/privacy" target="_blank">Privacy Policy</a>.</p><button class="btn primary block" style="padding:15px">${shipCfg().pay?"Continue to payment":t("placeOrder")} →</button></form>${summary(false,stateCode(d.state),false)}</div>`}
function orderText(o){
 const L=o.lines.map(l=>`• ${l.name}${l.opt?" — "+optStr(l.opt,prod(l.id)):""}${l.sku?" ("+l.sku+")":""} × ${l.qty} = ${money(l.price*l.qty)}`).join("\n");
 return `${lang==="en"?"New order":"Нове замовлення"} ${o.no}\n\n${L}\n\n${o.sub!=null?`${t("subtotal")}: ${money(o.sub)}\n${t("shipping")}: ${o.ship?money(o.ship):t("free")}\nSales tax: ${money(o.tax||0)}\n`:""}${t("total")}: ${money(o.total)}\n\n${t("name")}: ${o.c.name}\n${t("phone")}: ${o.c.phone}${o.c.email?"\n"+t("email")+": "+o.c.email:""}\n${t("deliveryM")}: ${o.c.delivery}\n${t("city")}: ${o.c.city}${o.c.address?", "+o.c.address:""}\n${t("paymentM")}: ${o.c.payment}${o.c.comment?"\n"+t("comment")+": "+o.c.comment:""}`}
function checkoutErrors(fd){
 const e={};["name","email","phone","address","city","state","zip"].forEach(k=>{if(!String(fd[k]||"").trim())e[k]="Required"});
 if(!e.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(fd.email).trim()))e.email="Please enter a valid email, e.g. name@example.com";
 if(!e.phone&&String(fd.phone).replace(/\D/g,"").length<10)e.phone="Please enter a 10-digit phone number";
 if(!e.zip&&!/^\d{5}(-\d{4})?$/.test(String(fd.zip).trim()))e.zip="ZIP code must be 5 digits";
 if(!e.address&&!(/\d/.test(fd.address)&&/[a-z]/i.test(fd.address)))e.address="Please include the house number and street, e.g. 123 Main St";
 return e}
async function placeOrder(f){
 const fd=Object.fromEntries(new FormData(f));["name","email","phone","address","address2","city","zip"].forEach(k=>fd[k]=String(fd[k]||"").trim());
 const errs=checkoutErrors(fd),bad=Object.keys(errs);
 f.querySelectorAll(".field").forEach(i=>i.classList.toggle("bad",bad.includes(i.name)));
 f.querySelectorAll(".ferr").forEach(x=>{const m=errs[x.dataset.for];x.textContent=m&&m!=="Required"?m:""});
 if(bad.length){$("#coErr").innerHTML=`<div class="note">${t("required")}</div>`;const first=f.querySelector(".field.bad");first&&first.focus();return}
 $("#coErr").innerHTML="";fd.address=fd.address+(fd.address2?", "+fd.address2:"");
 const btn=f.querySelector("button:last-child");btn.disabled=true;
 if(shipCfg().pay){const r=await startPayment(fd);if(!r.ok){btn.disabled=false;$("#coErr").innerHTML=`<div class="note">${r.msg}</div>`;if(r.stock)refreshCatalog()}return}
 const d=new Date(),no="CHV-"+String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0")+"-"+Math.floor(1000+Math.random()*9000);
 const o={no,date:d.toISOString(),lines:coLines().map(l=>({id:l.p.id,name:l.p.name,sku:l.p.sku,price:l.p.price,qty:l.qty,...(l.opt?{opt:l.opt}:{})})),c:fd,sent:false};
 const T=calcTotals(coTotal(),/express/i.test(fd.delivery||""),fd.state);Object.assign(o,{sub:T.sub,ship:T.ship,tax:T.tax,rate:T.rate,total:T.total});const bn=!!isBuyNow();
 LS.set("buyer",{name:fd.name,phone:fd.phone,email:fd.email,city:fd.city,address:fd.address.replace(", "+fd.address2,"").replace(/, $/,""),address2:fd.address2,state:fd.state,zip:fd.zip});
 let res={ok:false};try{res=await saveOrderToDb(o)}catch(e){}
 if(res.stock){$("#coErr").innerHTML=`<div class="note">${esc(res.msg)} <a class="textlink" href="#/cart">Go to cart →</a></div>`;btn.disabled=false;refreshCatalog();return}
 o.sent=res.ok;o.db=res.ok;o.mine=!!(res.ok&&user);if(res.ok)setTimeout(refreshCatalog,800);
 const ep=(S.settings.formEndpoint||"").trim();
 if(ep&&!o.sent){try{const r=await fetch(ep,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({order:o.no,total:o.total,message:orderText(o),email:fd.email||undefined,_subject:"New order "+o.no})});o.sent=r.ok}catch(e){o.sent=false}}
 LS.set("lastOrder",o);if(bn){buyNow=null;LS.set("buynow",null)}else setCart([]);location.hash="#/order";}
function viewOrder(q){
 if(q&&q.get("paid"))return viewPaid(q.get("paid"));
 const o=LS.get("lastOrder",null);if(!o)return notFound();const st=S.settings,txt=orderText(o);
 const tg=(st.telegram||"").replace(/^@/,""),vb=(st.viber||"").replace(/[^\d+]/g,"");
 return `<div class="shell section" style="max-width:760px"><div class="panel"><span class="eyebrow">${t("orderNo")}: ${esc(o.no)}</span><h1 style="font-size:36px;margin:8px 0 14px">${t("orderT")}</h1>
 ${o.sent?`<div class="okbox">${t("orderSent")}</div>${o.mine?`<p style="margin-top:14px"><a class="textlink" href="#/account/orders">View your orders →</a></p>`:""}`:`<p>${t("orderSend")}</p><textarea class="field" id="otext" readonly style="min-height:220px;font-size:13px">${esc(txt)}</textarea>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${tg?`<button class="btn primary" data-act="tg" data-u="${esc(tg)}">${t("sendTg")}</button>`:""}${st.email?`<a class="btn ${tg?"":"primary"}" href="mailto:${esc(st.email)}?subject=${encodeURIComponent((lang==="en"?"Order ":"Замовлення ")+o.no)}&body=${encodeURIComponent(txt)}">${t("sendEmail")}</a>`:""}${vb?`<a class="btn" href="viber://chat?number=${encodeURIComponent(vb)}" data-act="copyorder">${t("sendViber")}</a>`:""}<button class="btn" data-act="copyorder">${t("copy")}</button>${st.phone?`<a class="btn ghost" href="tel:${esc(st.phone.replace(/[^+\d]/g,""))}">${t("call")} ${esc(st.phone)}</a>`:""}</div>`}
 <p style="margin-top:16px"><a class="btn" href="#/track?no=${encodeURIComponent(o.no)}">📦 Track your order</a></p><br><a class="textlink" href="#/">← ${t("backHome")}</a></div></div>`}
/* ===== online payment (Stripe) — module is switched on in Seller Central → Settings ===== */
const PAY_FN=SB_URL+"/functions/v1/";
async function startPayment(fd){
 const items=coLines().map(l=>({id:l.p.id,qty:l.qty,...(l.opt?{opt:l.opt}:{})}));
 const customer={name:fd.name,phone:fd.phone,email:fd.email,delivery:fd.delivery,city:fd.city,state:fd.state,zip:fd.zip,address:fd.address,address2:fd.address2||null,comment:fd.comment||null,payment:"Card (Stripe)"};
 let token=SB_KEY;try{const{data}=await sb.auth.getSession();if(data&&data.session)token=data.session.access_token}catch(e){}
 try{const r=await fetch(PAY_FN+"payments-checkout",{method:"POST",headers:{"Content-Type":"application/json",apikey:SB_KEY,Authorization:"Bearer "+token},body:JSON.stringify({customer,items,return_url:location.origin+location.pathname})});
  const d=await r.json().catch(()=>({}));
  if(r.ok&&d.url){LS.set("pendingPay",{id:d.id,buyNow:!!isBuyNow(),at:Date.now()});location.href=d.url;return{ok:true}}
  const m=String(d.error||"");let x=m.match(/OUT_OF_STOCK:(.+):(\d+)/);if(x)return{ok:false,stock:true,msg:esc(+x[2]>0?`Only ${x[2]} left of “${x[1]}”. Please update the quantity in your cart.`:`“${x[1]}” just sold out. Please remove it from your cart.`)};
  x=m.match(/BAD_FIELD:(\w+)/);if(x)return{ok:false,msg:`Please check your ${esc(x[1])}.`};
  x=m.match(/UNAVAILABLE:(.+)/);if(x)return{ok:false,stock:true,msg:esc(`“${x[1]}” is no longer available. Please remove it from your cart.`)};
  if(/OPTION_REQUIRED/.test(m))return{ok:false,stock:true,msg:"The options for one of the items have changed. Please remove it from your cart and add it again."};
  return{ok:false,msg:`Online payment is temporarily unavailable. Please try again in a few minutes or <a class="textlink" href="#/contacts">contact us</a>.`}}
 catch(e){return{ok:false,msg:"Can’t reach the payment page. Check your connection and try again."}}}
function viewPaid(id){setTimeout(()=>pollPaid(id,0),0);
 return `<div class="shell section" style="max-width:760px"><div class="panel" id="paidBox"><span class="eyebrow">Payment</span><h1 style="font-size:32px;margin:8px 0 14px">Thank you! Confirming your payment…</h1><p class="muted">This usually takes a few seconds. Please don’t close this page.</p></div></div>`}
async function pollPaid(id,n){const box=$("#paidBox");if(!box)return;let d={};
 try{const r=await fetch(PAY_FN+"payments-status?id="+encodeURIComponent(id),{headers:{apikey:SB_KEY}});d=await r.json()}catch(e){}
 if(d.status==="paid"&&d.order_no){Trk.purchase(d.order_no,null);const p=LS.get("pendingPay",null);if(p&&p.id===id){if(p.buyNow){buyNow=null;LS.set("buynow",null)}else setCart([]);LS.set("pendingPay",null)}
  box.innerHTML=`<span class="eyebrow">Order ${esc(d.order_no)}</span><h1 style="font-size:34px;margin:8px 0 14px">Thank you — your order is confirmed!</h1><div class="okbox">💳 Payment received. We’ll email you when your order ships.</div><p style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><a class="btn primary" href="#/track?no=${encodeURIComponent(d.order_no)}">📦 Track your order</a>${user?`<a class="btn" href="#/account/orders">My orders & invoice</a>`:""}<a class="btn ghost" href="#/">${t("backHome")}</a></p>`;setTimeout(refreshCatalog,800);return}
 if(d.status==="failed"){box.innerHTML=`<h1 style="font-size:30px;margin:0 0 12px">We couldn’t complete your order</h1><div class="note">An item sold out while you were paying, so we refunded your payment in full. It can take 5–10 business days to appear.</div><p style="margin-top:14px"><a class="btn" href="#/cart">Back to cart</a> <a class="btn ghost" href="#/contacts">Contact us</a></p>`;return}
 if(n<40)setTimeout(()=>pollPaid(id,n+1),n<10?1500:3000);
 else box.innerHTML=`<h1 style="font-size:30px;margin:0 0 12px">Payment received — we’re finishing your order</h1><p>It’s taking a little longer than usual. You’ll get an email confirmation shortly${user?`, and the order will appear in <a class="textlink" href="#/account/orders">My orders</a>`:""}.</p><p class="small muted">Reference: ${esc(id)}</p>`}
function viewFavs(){const L=favs.map(prod).filter(p=>p&&p.active);return `<div class="page-head"><div class="shell"><h1>${t("favorites")}</h1></div></div><div class="shell section">${L.length?`<div class="grid">${L.map(card).join("")}</div>`:`<div class="empty"><b>${t("favEmpty")}</b>${t("favEmptyS")}</div>`}</div>`}
function viewText(title,text){return `<div class="page-head"><div class="shell"><h1>${esc(title)}</h1></div></div><div class="shell section"><div class="prose">${esc(text)}</div></div>`}
function viewContacts(){const c=S.settings;const r=(l,v,h)=>v?`<div class="row" style="padding:12px 0;border-bottom:1px solid var(--line)"><span class="muted">${l}</span>${h?`<a class="textlink" href="${h}">${esc(v)}</a>`:`<b>${esc(v)}</b>`}</div>`:"";
 const nm=(user&&((profile&&profile.full_name)||(user.user_metadata&&user.user_metadata.full_name)))||LS.get("ctName",""),em=(user&&user.email)||LS.get("ctEmail","");
 return `<div class="page-head"><div class="shell"><h1>${t("contacts")}</h1><p>Questions about an order or a product? Send us a message.</p></div></div><div class="shell section contactgrid">
 <div class="panel"><h2>Contact us</h2><form class="stack" data-form="contact" novalidate><div class="form"><div><label>Name <span class="req">*</span></label><input class="field" name="name" autocomplete="name" maxlength="120" value="${esc(nm)}" required></div><div><label>Email <span class="req">*</span></label><input class="field" name="email" type="email" autocomplete="email" maxlength="200" value="${esc(em)}" required></div><div class="full"><label>Order number (optional)</label><input class="field" name="order_no" maxlength="40" placeholder="CHV-…"></div><div class="full"><label>Message <span class="req">*</span></label><textarea class="field" name="body" maxlength="5000" required style="min-height:140px"></textarea></div></div><input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"><div id="ctMsg"></div><button class="btn primary">Send message</button></form></div>
 <div class="panel"><h2>Other ways to reach us</h2>${r(t("phone"),c.phone,"tel:"+(c.phone||"").replace(/[^+\d]/g,""))}${r(t("email"),c.email,"mailto:"+c.email)}${r("Instagram",c.instagram,"https://instagram.com/"+(c.instagram||"").replace(/^@/,""))}${r(t("hours"),c.hours)}${c.address?`<div class="row" style="padding:12px 0;border-bottom:1px solid var(--line);align-items:flex-start"><span class="muted">Address</span><span style="text-align:right">${esc(c.address).replace(/\n/g,"<br>")}</span></div>`:""}</div></div>`}

/* ===== checkout helpers ===== */
const US_STATES=[["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],["PR","Puerto Rico"]];
function stateCode(v){v=String(v||"").trim();if(!v)return"";const u=v.toUpperCase();const f=US_STATES.find(([c,n])=>c===u||n.toUpperCase()===u);return f?f[0]:""}

/* ===== order tracking ===== */
const fmtDay=s=>{if(!s)return"";const[y,m,d]=String(s).slice(0,10).split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})};
function payLine(o){const k=o.payment_status;if(!k||o.status==="cancelled")return"";return k==="unpaid"?`<div class="otrk-pay unpaid">💳 Awaiting payment — we’ll email you a secure payment link. Questions? <a class="textlink" href="#/contacts">Contact us</a>.</div>`:k==="paid"?`<div class="otrk-pay paid">💳 Payment received — thank you!</div>`:`<div class="otrk-pay">💳 ${k==="refunded"?"Refunded":"Partially refunded"}. Refunds can take 5–10 business days to appear.</div>`}
function orderTracker(o){
 if(o.status==="cancelled"||o.status==="returned")return payLine(o)+ `<div class="otrk-off">${o.status==="cancelled"?"This order was cancelled."+(["paid","partially_refunded"].includes(o.payment_status)?" Your payment will be refunded to the original payment method within 5 business days.":""):"This order was returned."}${o.status==="returned"?" Your refund is being processed.":""}</div>`;
 const steps=[["new","Order placed"],["confirmed","Confirmed"],["shipped","Shipped"],["completed","Delivered"]],idx=Math.max(0,steps.findIndex(s=>s[0]===o.status));
 const tu=o.tracking_number?trackUrl(o.carrier,o.tracking_number):"";
 return payLine(o)+`<ol class="otrk" aria-label="Order progress">${steps.map(([k,l],i)=>`<li class="${i<idx?"done":i===idx?"cur":""}"${i===idx?' aria-current="step"':""}><span class="dot" aria-hidden="true">${i<idx||(i===idx&&k==="completed")?"✓":""}</span><b>${l}</b>${k==="new"&&o.created_at?`<small>${fmtDate(o.created_at)}</small>`:k==="shipped"&&o.shipped_at?`<small>${fmtDate(o.shipped_at)}</small>`:k==="completed"&&o.delivered_at?`<small>${fmtDate(o.delivered_at)}</small>`:k==="completed"&&o.delivery_eta?`<small>Expected ${fmtDay(o.delivery_eta)}</small>`:""}</li>`).join("")}</ol>
 ${o.status!=="completed"&&o.delivery_eta?`<div class="otrk-eta">📅 Estimated delivery: <b>${fmtDay(o.delivery_eta)}</b></div>`:o.status==="completed"&&o.delivered_at?`<div class="otrk-eta">✓ Delivered on <b>${fmtDate(o.delivered_at)}</b></div>`:""}
 ${o.tracking_number||o.carrier&&idx>=2?`<div class="otrk-num">${o.carrier?`Shipped with <b>${esc(enVal(o.carrier))}</b>`:"Tracking number"}${o.tracking_number?`${o.carrier?" · ":": "}<b>${esc(o.tracking_number)}</b>`:""}${tu?` <a class="btn sm" href="${esc(tu)}" target="_blank" rel="noopener">Track package ↗</a>`:""}</div>${!tu&&idx<3?`<p class="small muted" style="margin:6px 0 0">This delivery service doesn’t offer online tracking. We’ll update the status here once it’s delivered.</p>`:""}`:idx<2?`<p class="small muted" style="margin:8px 0 0">We’ll add a tracking number here as soon as your order ships (usually within 1–2 business days).</p>`:""}`}
function viewTrack(q){
 const lo=LS.get("lastOrder",null),no=q.get("no")||"",em=(lo&&lo.no===no&&lo.c&&lo.c.email)||(user&&user.email)||"";
 if(no&&em)setTimeout(()=>{const f=$('[data-form="track"]');f&&f.requestSubmit()},0);
 return `<div class="page-head"><div class="shell"><div class="crumbs"><a href="#/">${t("home")}</a> / Track your order</div><h1>Track your order</h1><p>Enter your order number and the email you used at checkout.</p></div></div>
 <div class="shell section" style="max-width:760px"><form class="panel stack" data-form="track" novalidate><div class="form"><div><label>Order number <span class="req">*</span></label><input class="field" name="no" placeholder="CHV-261124-1234" value="${esc(no)}" autocomplete="off" required></div><div><label>${t("email")} <span class="req">*</span></label><input class="field" name="email" type="email" autocomplete="email" value="${esc(em)}" required></div></div>
 <button class="btn primary">Find my order</button>${user?`<p class="small muted" style="margin:0">Signed in? All your orders are in <a class="textlink" href="#/account/orders">My orders</a>.</p>`:""}</form><div id="trackRes"></div></div>`}
async function trackSubmit(f){
 const no=String(f.no.value||"").trim(),email=String(f.email.value||"").trim(),box=$("#trackRes");
 if(!no||!email){box.innerHTML=`<div class="note" style="margin-top:14px">Please enter your order number and email.</div>`;return}
 if(!sb){box.innerHTML=`<div class="note" style="margin-top:14px">Tracking is unavailable right now. Please contact us.</div>`;return}
 const b=f.querySelector("button.primary");b.disabled=true;const{data,error}=await sb.rpc("track_order",{p_no:no,p_email:email});b.disabled=false;
 if(error||!data){box.innerHTML=`<div class="note" style="margin-top:14px">We couldn’t find an order with that number and email. Please check both — the order number is in your confirmation and starts with CHV-.</div>`;return}
 box.innerHTML=`<div class="panel" style="margin-top:16px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><span class="eyebrow">Order ${esc(data.order_no)}</span><div class="muted small">Placed ${fmtDate(data.created_at)}${data.delivery?" · "+esc(data.delivery):""}</div></div><b>${money(data.total)}</b></div>
 ${orderTracker(data)}<div class="otrk-items">${(data.items||[]).map(i=>`<div class="row small"><span>${esc(i.name)}${i.opt?` <span class="muted">(${esc(optStr(i.opt,prod(i.id)))})</span>`:""} × ${+i.qty||0}${(prod(i.id)||{}).sku?` <span class="muted">· Item # ${esc(prod(i.id).sku)}</span>`:""}</span><span>${money((+i.price||0)*(+i.qty||0))}</span></div>`).join("")}</div>
 ${canCancel(data)?`<div class="oacts"><button class="btn sm" data-act="cancelopen" data-no="${esc(data.order_no)}">✕ Cancel order</button></div>${cancelForm(data,email)}`:data.status==="shipped"?`<p class="small muted" style="margin:10px 0 0">Returns can be requested after delivery, within ${shipCfg().days} days.</p>`:""}
 <p class="small muted" style="margin:12px 0 0">Questions about this order? <a class="textlink" href="#/contacts">Contact us</a> and include your order number.</p></div>`}
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
function fillTokens(txt){const s=S.settings;return String(txt||"").replace(/\{store\}/g,s.name||"").replace(/\{email\}/g,s.email||"").replace(/\{address\}/g,String(s.address||"[Business address]").replace(/\s*\n\s*/g,", ")).replace(/\{site\}/g,(typeof SITE_URL!=="undefined"?SITE_URL:location.origin))}
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
/* ===== SEO tags (title, description, social preview, product data for Google) ===== */
function setMetaTag(attr,key,val){let m=document.head.querySelector(`meta[${attr}="${key}"]`);if(!m){m=document.createElement("meta");m.setAttribute(attr,key);document.head.appendChild(m)}m.setAttribute("content",val||"")}
function applySeo(parts,q){const st=S.settings,base=st.name||"CozyHouseVibe",clip=(x,n)=>{x=String(x||"").replace(/\s+/g," ").trim();return x.length>n?x.slice(0,n-1).trim()+"…":x};
 let title=st.seoTitle||base+(st.tagline?" — "+st.tagline:""),desc=st.seoDescription||st.heroText||"",img=st.heroImage||"",ld=null;const pg=parts[0]||"";
 if(pg==="product"){const p=prod(parts[1]);if(p&&p.active){title=p.seoTitle||p.name+" | "+base;desc=p.seoDesc||p.short||p.desc||"";img=img0(p);const r=rating(p.id);
  ld={"@context":"https://schema.org","@type":"Product",name:p.name,sku:p.sku||undefined,description:clip(p.desc||p.short,500),image:(p.images||[]).filter(u=>/^https?:/.test(u)).slice(0,5),brand:{"@type":"Brand",name:base},offers:{"@type":"Offer",priceCurrency:"USD",price:String(p.price),availability:"https://schema.org/"+(p.stock>0?"InStock":"OutOfStock"),url:location.href},...(r?{aggregateRating:{"@type":"AggregateRating",ratingValue:r.avg.toFixed(1),reviewCount:r.n}}:{})}}}
 else if(pg==="shop"){const c=catOf(q.get("cat"));title=(c?c.name:"All products")+" | "+base;desc=c?`Shop ${c.name.toLowerCase()} at ${base}: ${clip(desc,110)}`:desc}
 else if(pg){const T={about:"Our story",contacts:"Contact us",delivery:"Shipping & payment",returns:"Returns & refunds",privacy:"Privacy policy",terms:"Terms of service",track:"Track your order"};if(T[pg])title=T[pg]+" | "+base}
 document.title=clip(title,70);desc=clip(desc,160);setMetaTag("name","description",desc);setMetaTag("property","og:title",document.title);setMetaTag("property","og:description",desc);setMetaTag("property","og:type",pg==="product"?"product":"website");if(/^https?:/.test(img))setMetaTag("property","og:image",img);
 let s=document.getElementById("ldjson");if(ld){if(!s){s=document.createElement("script");s.type="application/ld+json";s.id="ldjson";document.head.appendChild(s)}s.textContent=JSON.stringify(ld).replace(/</g,"\\u003c")}else if(s)s.remove()}
function notFound(){return `<div class="shell section"><div class="empty"><b>404</b>${lang==="en"?"Page not found.":"Сторінку не знайдено."}<br><br><a class="btn" href="#/">${t("backHome")}</a></div></div>`}

/* ===== contact form ===== */
async function sendContact(f){
 const fd=Object.fromEntries(new FormData(f)),btn=f.querySelector("button.primary"),msg=$("#ctMsg");
 if(fd.website)return; // honeypot
 const name=String(fd.name||"").trim(),email=String(fd.email||"").trim(),body=String(fd.body||"").trim(),order_no=String(fd.order_no||"").trim()||null;
 if(!name||!/^\S+@\S+\.\S+$/.test(email)||body.length<2){msg.innerHTML=`<div class="note">Please enter your name, a valid email and a message.</div>`;return}
 if(!sb){msg.innerHTML=`<div class="note">Can’t send right now. Please email us instead.</div>`;return}
 btn.disabled=true;const{error}=await sb.from("messages").insert({name,email,body,order_no});btn.disabled=false;
 if(error){msg.innerHTML=`<div class="note">${/TOO_MANY/.test(error.message)?"You’ve sent several messages already. We’ll get back to you soon.":"Couldn’t send your message. Please try again or email us."}</div>`;return}
 LS.set("ctName",name);LS.set("ctEmail",email);
 f.innerHTML=`<div class="okbox">Thanks, ${esc(name.split(" ")[0])}! Your message was sent. We usually reply within one business day.</div>`}

/* ===== router ===== */
let lastPath="";
function render(){
 const h=location.hash.slice(1)||"/";const[path,qs]=h.split("?");const q=new URLSearchParams(qs||"");const parts=path.split("/").filter(Boolean);
 document.body.classList.toggle("invoice-mode",path.startsWith("/account/invoice"));markNav(path);hsClose();hsSync(path,q);let html;
 html=({"":()=>viewHome(),shop:()=>viewShop(q),product:()=>viewProduct(parts[1]),cart:viewCart,checkout:viewCheckout,order:()=>viewOrder(q),favorites:viewFavs,account:()=>viewAccount(parts),delivery:()=>viewText(t("delivery"),S.settings.deliveryText),about:viewAbout,contacts:viewContacts,track:()=>viewTrack(q),privacy:()=>viewLegal("privacy"),terms:()=>viewLegal("terms"),returns:()=>viewLegal("returns")}[parts[0]||""]||notFound)();
 if(html!==undefined&&html!=="")app.innerHTML=html;
 if(path!==lastPath)window.scrollTo(0,0);lastPath=path;applySeo(parts,q);Trk.page(parts);
}

/* ===== events ===== */
document.addEventListener("click",e=>{
 if(e.target.id==="qv"){closeLayers();return}
 if((!e.target.closest("#acctWrap")||e.target.closest("#acctMenu a")))closeAcct();
 const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act,id=el.dataset.id;
 const H={
  menu:()=>$("#nav").classList.toggle("open"),
  navexp:()=>{const it=el.closest(".navitem"),on=it.classList.toggle("open");el.setAttribute("aria-expanded",on)},
  lang:()=>{lang=lang==="en"?"uk":"en";LS.set("lang",lang);document.documentElement.lang=lang==="en"?"en":"uk";chrome();render()},
  fav:()=>{e.preventDefault();toggleFav(id)},add:()=>{e.preventDefault();addToCart(id)},
  addq:()=>{const r=readOpts(prod(id),"pdp");if(r.ok)addToCart(id,Math.max(1,parseInt($("#pq").value)||1),r.opt)},
  carmove:()=>{e.preventDefault();carMove(el.closest(".car"),+el.dataset.d)},
  cargo:()=>{e.preventDefault();const c=el.closest(".car")||document.querySelector(`.car[data-car="${el.dataset.car}"]`);carGo(c,+el.dataset.i)},
  lbopen:()=>{const c=el.closest(".car");lightbox([...c.querySelectorAll(".carslide img")].map(i=>i.getAttribute("src")),+el.dataset.i,c.dataset.alt||"")},
  lbclose:()=>closeLightbox(),
  buynow:()=>{const sc=el.dataset.scope,r=readOpts(prod(id),sc);if(!r.ok)return;const q=parseInt(($(sc==="qv"?"#qvq":"#pq")||{}).value)||1;startBuyNow(id,q,r.opt)},
  toreviews:()=>{const r=$("#reviews");r&&r.scrollIntoView({behavior:"smooth"})},
  revopen:()=>{const f=$('[data-form="review"]');if(f){f.hidden=false;el.hidden=true;const s=f.querySelector("input");s&&s.focus()}},
  revlogin:()=>{LS.set("afterLogin","#/product/"+id)},
  "q-":()=>{const i=$("#pq");i.value=Math.max(1,(+i.value||1)-1)},"q+":()=>{const i=$("#pq");i.value=Math.min(+i.max||99,(+i.value||1)+1)},
  rm:()=>{const k=el.dataset.k;setCart(cart.filter(l=>lkey(l)!==k));render()},
  cq:()=>{const l=lineByKey(el.dataset.k);if(!l)return;l.qty=Math.max(1,Math.min(lineMax(l),l.qty+ +el.dataset.d));setCart(cart);render()},
  hsclear:()=>{e.preventDefault();LS.set("recent",[]);hsClose();hsIn().focus()},
  cart:()=>{e.preventDefault();openCart()},
  acctmenu:()=>{e.preventDefault();const w=$("#acctWrap"),o=!w.classList.contains("open");w.classList.toggle("open",o);el.setAttribute("aria-expanded",String(o))},
  pw:()=>{const i=el.parentNode.querySelector("input");i.type=i.type==="password"?"text":"password";el.textContent=i.type==="password"?"Show":"Hide"},
  signout:async()=>{await sb.auth.signOut();profile=null;favs=[];LS.set("favs",favs);badges();toast("Signed out");location.hash="#/account"},
  cologin:()=>{LS.set("afterLogin","#/checkout")},
  filters:()=>openLayer("filters"),
  more:()=>{shopShown+=12;render()},
  closeall:()=>{e.preventDefault();closeLayers()},
  qv:()=>{e.preventDefault();quickView(id)},
  qvq:()=>{const i=$("#qvq");i.value=Math.max(1,Math.min(+i.max||99,(+i.value||1)+ +el.dataset.d))},
  qvadd:()=>{const r=readOpts(prod(id),"qv");if(r.ok)addToCart(id,Math.max(1,parseInt($("#qvq").value)||1),r.opt)},
  mq:()=>{const l=lineByKey(el.dataset.k);if(!l)return;const mx=lineMax(l);l.qty+=+el.dataset.d;if(l.qty<1)cart=cart.filter(x=>x!==l);else l.qty=Math.min(mx,l.qty);setCart(cart);renderMini();if(/^#\/(cart|checkout)/.test(location.hash))render()},
  mrm:()=>{const k=el.dataset.k;setCart(cart.filter(l=>lkey(l)!==k));renderMini();if(/^#\/(cart|checkout)/.test(location.hash))render()},
  copyorder:()=>{copy($("#otext").value)},
  cancelopen:()=>{const f=document.querySelector(`[data-form="cancelord"][data-no="${el.dataset.no}"]`);if(f){f.hidden=!f.hidden;if(!f.hidden)f.querySelector("select").focus()}},
  retopen:()=>{const f=document.querySelector(`[data-form="retreq"][data-id="${id}"]`);if(f){f.hidden=!f.hidden;if(!f.hidden)f.querySelector("input").focus()}},
  invprint:()=>window.print(),
  buyagain:()=>buyAgain(+id),
  delacct:()=>{const f=$('[data-form="delacct"]');if(f){f.hidden=!f.hidden;if(!f.hidden)f.querySelector("input").focus()}},
  oauth:()=>oauthLogin(el.dataset.p),
  invpdf:()=>downloadInvoice(el),
  tg:()=>{copy($("#otext").value);window.open("https://t.me/"+el.dataset.u,"_blank")},
 };
 if(H[a])H[a]();
});
document.addEventListener("change",e=>{
 if(e.target.matches&&e.target.matches(".filepick input[type=file]")){const n=[...e.target.files].map(x=>x.name),s=e.target.parentNode.querySelector(".filenames");if(s)s.textContent=n.length?(n.length===1?n[0]:n.length+" files: "+n.join(", ")):"No files selected"}
 {const f=e.target.form;if(f&&f.dataset.form==="checkout"&&(e.target.name==="state"||e.target.name==="delivery")){const sm=$("#coSum");if(sm)sm.outerHTML=summary(false,f.state.value,/express/i.test((f.querySelector("[name=delivery]:checked")||{}).value||""))}}
 const el=e.target;
 if(el.dataset.act==="sortchange"){const f=el.form;go(f)}
 else if(el.dataset.act==="fsort"){const raw=new URLSearchParams(location.hash.split("?")[1]||"").get("q");setParams({sort:el.value===(raw?"rel":"pop")?"":el.value})}
 else if(el.dataset.act==="fstock"){closeLayers(true);setParams({stock:el.checked?"1":""})}
 else if(el.dataset.act==="cqi"){const l=lineByKey(el.dataset.k);if(!l)return;l.qty=Math.max(1,Math.min(lineMax(l),parseInt(el.value)||1));setCart(cart);render()}
 else if(el.dataset.act==="optpick"){const fs=el.closest(".optset");if(fs)fs.querySelector(".optval").textContent=el.value;const b=el.closest(".opts");b&&b.classList.remove("need")}
});
document.addEventListener("submit",e=>{const f=e.target;const k=f.dataset.form;if(!k)return;e.preventDefault();
 if(k==="shopsearch")go(f);else if(k==="price"){const mn=f.min.value.trim(),mx=f.max.value.trim();let lo=mn===""?"":Math.max(0,+mn),hi=mx===""?"":Math.max(0,+mx);if(lo!==""&&hi!==""&&lo>hi)[lo,hi]=[hi,lo];closeLayers(true);setParams({min:lo,max:hi})}else if(k==="checkout")placeOrder(f);else if(k==="contact")sendContact(f);else if(k==="review")submitReview(f);else if(k==="track")trackSubmit(f);else if(k==="retreq")submitReturn(f);else if(k==="cancelord")submitCancel(f);else if(k==="delacct")deleteAccount(f);else if(k.startsWith("ac"))acSubmit(k,f)});
function go(f){const cur=new URLSearchParams((location.hash.split("?")[1])||"");const n=new URLSearchParams();if(cur.get("cat"))n.set("cat",cur.get("cat"));const fd=new FormData(f);if(fd.get("q"))n.set("q",fd.get("q"));const sv=fd.get("sort"),def=fd.get("q")?"rel":"pop";if(sv&&sv!==def)n.set("sort",sv);if(fd.get("stock"))n.set("stock","1");location.hash="#/shop"+(n.toString()?"?"+n:"")}
window.addEventListener("hashchange",()=>{closeLayers(true);closeAcct();closeLightbox();render()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeAcct();if(e.key==="Escape"&&$("#overlay").classList.contains("show"))closeLayers()});

(async()=>{sbInit();await load();document.documentElement.lang="en";chrome();render()})();
