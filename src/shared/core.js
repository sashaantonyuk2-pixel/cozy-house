/* ===== shared core (storefront + Seller Central): state, helpers, catalog mapping ===== */
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

function normalize(st){const d=demoState().settings;st.settings={...d,...(st.settings||{}),lang:"en"};return st}
const fromRow=r=>({id:r.id,name:r.name,sku:r.sku||"",cat:r.category_id||"",price:+r.price,oldPrice:r.old_price==null?null:+r.old_price,stock:r.stock,active:r.active,featured:r.featured,short:r.short_description||"",desc:r.description||"",specs:Array.isArray(r.specs)?r.specs:[],images:Array.isArray(r.images)?r.images:[],options:Array.isArray(r.options)?r.options:[],position:+r.position||0,seoTitle:r.seo_title||"",seoDesc:r.seo_description||"",imgAlt:r.image_alt||"",created:Date.parse(r.created_at)||Date.now()});
const toRow=p=>({id:p.id,name:p.name,sku:p.sku||null,category_id:p.cat||null,price:+p.price||0,old_price:p.oldPrice==null||p.oldPrice===""?null:+p.oldPrice,stock:Math.max(0,parseInt(p.stock)||0),active:!!p.active,featured:!!p.featured,short_description:p.short||null,description:p.desc||null,specs:p.specs||[],images:p.images||[],options:p.options||[],position:Math.max(0,parseInt(p.position)||0),seo_title:(p.seoTitle||"").trim()||null,seo_description:(p.seoDesc||"").trim()||null,image_alt:(p.imgAlt||"").trim()||null});
async function fetchCatalog(){
 const[c,p,s,rv]=await Promise.all([sb.from("categories").select("*").order("position"),sb.from("products").select("*").order("created_at",{ascending:false}),sb.from("store_settings").select("data").eq("id",1).maybeSingle(),sb.from("reviews").select("id,product_id,name,rating,title,body,verified,created_at").eq("status","approved").order("created_at",{ascending:false}).limit(1000)]);
 const err=c.error||p.error||s.error;if(err)throw err;
 return normalize({version:3,settings:(s.data&&s.data.data)||{},categories:c.data.map(x=>({id:x.id,name:x.name,image:x.image||"",parent:x.parent_id||""})),products:p.data.map(fromRow),reviews:rv&&!rv.error&&Array.isArray(rv.data)?rv.data:[]})}

const prod=id=>S.products.find(p=>p.id===id);
const catOf=id=>S.categories.find(c=>c.id===id);
/* subcategories: two levels only. A category's "parent" is "" for top-level ones */
const catParent=c=>c&&c.parent&&catOf(c.parent)?catOf(c.parent):null;
const topCats=()=>S.categories.filter(c=>!catParent(c));
const subCats=id=>S.categories.filter(c=>c.parent===id&&id);
const inCat=(p,id)=>!id||p.cat===id||((catOf(p.cat)||{}).parent===id&&!!id);
const catLabel=c=>c?(catParent(c)?catParent(c).name+" › ":"")+c.name:"";
const visible=()=>S.products.filter(p=>p.active);

const optList=p=>(p&&Array.isArray(p.options)?p.options:[]).filter(o=>o&&o.name&&Array.isArray(o.values)&&o.values.length);
const lkey=l=>l.id+"|"+(l.opt?Object.keys(l.opt).sort().map(k=>k+"="+l.opt[k]).join("&"):"");
const optStr=(opt,p)=>{if(!opt||typeof opt!=="object")return"";const ks=p?optList(p).map(o=>o.name).filter(k=>k in opt):Object.keys(opt);return(ks.length?ks:Object.keys(opt)).map(k=>k+": "+opt[k]).join(" · ")};
const optOk=(l,p)=>optList(p).every(o=>l.opt&&o.values.includes(l.opt[o.name]));

const fmtDate=d=>new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
let toastT;function toast(msg,extra=""){const el=$("#toast");el.innerHTML="<span>"+esc(msg)+"</span>"+extra;el.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove("show"),2800)}
const img0=p=>p.images&&p.images[0]||art("vase","#efece4","#e4ddd0");
function stockState(p){return p.stock<=0?"out":p.stock<=3?"low":"in"}
const nItems=n=>{if(lang==="en")return n+" "+(n===1?"item":"items");const m=n%10,h=n%100;return n+" "+(m===1&&h!==11?"товар":m>=2&&m<=4&&(h<12||h>14)?"товари":"товарів")};
const isNew=p=>Date.now()-(p.created||0)<14*86400000&&!p.oldPrice;

const X='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

function catImg(c){if(c.image)return c.image;const p=visible().find(p=>inCat(p,c.id)&&p.images&&p.images[0]);return p?p.images[0]:art("basket","#efece4","#e4ddd0")}

function copy(s){(navigator.clipboard?navigator.clipboard.writeText(s):Promise.reject()).then(()=>toast(t("copied"))).catch(()=>{const tmp=document.createElement("textarea");tmp.value=s;document.body.appendChild(tmp);tmp.select();try{document.execCommand("copy");toast(t("copied"))}catch(_){}tmp.remove()})}
/* values saved by the seller that customers see (old orders may have Ukrainian ones) */
const EN_VAL={"Інший":"Other","Інше":"Other","Банківський переказ":"Bank transfer","Готівка":"Cash","Payoneer (посилання на оплату)":"Payoneer (payment link)"};
const enVal=v=>{v=String(v??"");return EN_VAL[v]||(/[А-Яа-яІіЇїЄєҐґ]/.test(v)?"Other":v)};
/* carrier tracking links (used by customer orders and the seller order page) */
function trackUrl(c,n){n=encodeURIComponent(String(n||"").trim());if(!n)return"";c=String(c||"").toLowerCase();
 if(c.includes("usps"))return"https://tools.usps.com/go/TrackConfirmAction?tLabels="+n;if(c.includes("ups"))return"https://www.ups.com/track?tracknum="+n;
 if(c.includes("fedex"))return"https://www.fedex.com/fedextrack/?trknbr="+n;if(c.includes("dhl"))return"https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id="+n;return""}
