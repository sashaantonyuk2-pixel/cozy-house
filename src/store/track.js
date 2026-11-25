/* ===== Anonymous visit statistics → public.track() → Seller Central «Аналітика» =====
   No cookies and no personal data: a random visit id (localStorage, new after 30 min idle), the page path,
   product ids, home-page block names, search words, traffic source (utm/referrer) and device type.
   Skipped for the shop owner (set when signing in to Seller Central), with ?notrack=1, and for automated browsers. */
const Trk={q:[],timer:null,lastPath:null,once:new Set(),
 off(){try{return LS.get("noTrack",false)||/[?&]notrack=1/.test(location.search+location.hash)||navigator.webdriver===true}catch(e){return true}},
 rid(){const a=new Uint8Array(8);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,"0")).join("")},
 source(){const u=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.split("?")[1]||""),g=k=>(u.get(k)||h.get(k)||"").trim();
  let source=g("utm_source").toLowerCase(),medium=g("utm_medium").toLowerCase(),campaign=g("utm_campaign");
  if(!source&&g("gclid")){source="google";medium=medium||"cpc"}
  if(!source&&g("fbclid"))source="facebook";
  if(!source){let host="";try{host=document.referrer?new URL(document.referrer).hostname.replace(/^(www|m|l|lm)\./,""):""}catch(e){}
   if(host&&host!==location.hostname&&!/stripe\.com$/.test(host)){
    const M=[["google","google"],["bing","bing"],["duckduckgo","duckduckgo"],["yahoo","yahoo"],["instagram","instagram"],["facebook","facebook"],["fb.","facebook"],["pinterest","pinterest"],["pin.it","pinterest"],["tiktok","tiktok"],["youtube","youtube"],["t.co","twitter"],["twitter","twitter"],["x.com","twitter"],["t.me","telegram"],["telegram","telegram"],["etsy","etsy"],["chatgpt","chatgpt"],["openai","chatgpt"]];
    const m=M.find(([k])=>host.includes(k));source=m?m[1]:host;
    medium=medium||(/^(google|bing|duckduckgo|yahoo)$/.test(source)?"organic":/^(instagram|facebook|pinterest|tiktok|youtube|twitter|telegram)$/.test(source)?"social":"referral")}}
  return{source:source||"direct",medium,campaign}},
 device(){const ua=navigator.userAgent||"",w=Math.min(screen.width||innerWidth,innerWidth);
  return /iPad|Tablet/i.test(ua)||(navigator.maxTouchPoints>1&&/Macintosh/.test(ua))?"tablet":/Mobi|Android|iPhone/i.test(ua)||w<700?"mobile":"desktop"},
 visit(path){const now=Date.now(),s=this.source();let v=LS.get("visit",null);
  const fresh=!v||!v.id||now-v.last>30*60000||(s.campaign&&s.campaign!==v.c);
  if(fresh){v={id:this.rid(),c:s.campaign||""};this.once.clear();this.q.push({visit:v.id,type:"visit",path,source:s.source,medium:s.medium||null,campaign:s.campaign||null,device:this.device()})}
  v.last=now;LS.set("visit",v);return v.id},
 path(){const p=(location.hash.slice(1)||"/").split("?")[0].split("/").filter(Boolean);
  return "/"+(p[0]==="product"||p[0]==="account"&&p[1]!=="invoice"?p.slice(0,2):p.slice(0,1)).join("/")},
 ev(type,o={}){if(this.off())return;try{const id=this.visit(this.path());this.q.push({visit:id,type,...o});clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),1500)}catch(e){}},
 one(key,type,o){if(this.once.has(key))return;this.once.add(key);this.ev(type,o)},
 flush(){clearTimeout(this.timer);while(this.q.length){const events=this.q.splice(0,30);
  try{fetch(SB_URL+"/rest/v1/rpc/track",{method:"POST",keepalive:true,headers:{"Content-Type":"application/json",apikey:SB_KEY},body:JSON.stringify({events})}).catch(()=>{})}catch(e){}}},
 /* called by the router after every render */
 page(parts){const path=this.path();if(path===this.lastPath)return;this.lastPath=path;
  this.ev("page",{path});
  if(parts[0]==="product"&&parts[1])this.ev("product",{product_id:String(parts[1]).slice(0,80),path});
  if(parts[0]==="checkout")this.ev("checkout",{path})},
 product(id){this.ev("product",{product_id:String(id).slice(0,80),path:this.path()})},
 cart(id,qty){this.ev("cart",{product_id:String(id).slice(0,80),value:Math.max(1,+qty||1)})},
 search(q,n){const s=String(q||"").trim().toLowerCase().slice(0,120);if(s)this.one("s:"+s,"search",{label:s,value:+n||0})},
 purchase(no,total){if(!no)return;this.one("o:"+no,"purchase",{label:String(no).slice(0,120),value:total==null?null:Math.round(+total*100)/100});this.flush()}};
document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest("a,button");const b=a&&a.closest("[data-track]");if(b)Trk.ev("click",{label:b.dataset.track})},true);
document.addEventListener("visibilitychange",()=>{if(document.hidden)Trk.flush()});
addEventListener("pagehide",()=>Trk.flush());
