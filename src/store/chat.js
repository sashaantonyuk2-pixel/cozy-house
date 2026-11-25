/* ===== live chat widget (storefront) =====
   The visitor gets a secret random key (kept in this browser). Messages go through the database
   functions chat_send / chat_fetch, so nobody can read another visitor's conversation. */
const Chat={key:null,msgs:[],last:0,seen:0,isOpen:false,timer:null,busy:false,
 icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4.5"/></svg>',
 init(){
  if(!sb||$("#chatBtn"))return;
  this.key=LS.get("chatKey",null);this.msgs=LS.get("chatMsgs",[]);this.last=this.msgs.reduce((m,x)=>Math.max(m,x.id||0),0);this.seen=LS.get("chatSeen",0);
  const b=document.createElement("button");b.id="chatBtn";b.className="chatbtn";b.type="button";b.setAttribute("aria-label","Chat with us");b.setAttribute("aria-expanded","false");b.setAttribute("aria-controls","chatPanel");
  b.innerHTML=this.icon+'<span class="chatlbl">Chat with us</span><span class="chatdot" id="chatDot" hidden></span>';b.addEventListener("click",()=>this.toggle());document.body.appendChild(b);
  const p=document.createElement("section");p.id="chatPanel";p.className="chatpanel";p.setAttribute("role","dialog");p.setAttribute("aria-label","Chat");p.hidden=true;document.body.appendChild(p);
  p.addEventListener("submit",e=>{e.preventDefault();e.stopPropagation();this.send(e.target)});
  p.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&e.target.name==="body"&&!e.isComposing){e.preventDefault();e.target.form.requestSubmit()}if(e.key==="Escape")this.toggle(false)});
  p.addEventListener("click",e=>{if(e.target.closest("[data-chatclose]"))this.toggle(false)});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&this.key)this.poll()});
  this.badge();if(this.key)this.poll()},
 toggle(v){this.isOpen=v===undefined?!this.isOpen:v;const p=$("#chatPanel"),b=$("#chatBtn");p.hidden=!this.isOpen;b.classList.toggle("on",this.isOpen);b.setAttribute("aria-expanded",String(this.isOpen));
  if(this.isOpen){this.render();this.markSeen();if(this.key)this.poll();setTimeout(()=>{const t=p.querySelector("textarea, input");t&&t.focus({preventScroll:true})},50)}else{b.focus({preventScroll:true});this.schedule()}},
 schedule(){clearTimeout(this.timer);if(!this.key)return;this.timer=setTimeout(()=>this.poll(),document.hidden?120000:this.isOpen?4000:40000)},
 async poll(){clearTimeout(this.timer);if(!this.key||!sb)return;
  try{const{data,error}=await sb.rpc("chat_fetch",{p_key:this.key,p_after:this.last});
   if(!error&&data){const n=(data.messages||[]).filter(m=>!this.msgs.some(x=>x.id===m.id));
    if(data.status==="none"&&!n.length&&this.msgs.length){/* conversation was deleted by the shop */this.key=null;this.msgs=[];this.last=0;LS.set("chatKey",null);LS.set("chatMsgs",[]);if(this.isOpen)this.render();this.badge();return}
    if(n.length){this.msgs=this.msgs.concat(n).slice(-150);this.last=this.msgs.reduce((m,x)=>Math.max(m,x.id||0),0);LS.set("chatMsgs",this.msgs);if(this.isOpen){this.drawList();this.markSeen()}this.badge()}}}catch(e){}
  this.schedule()},
 markSeen(){const s=this.msgs.filter(m=>m.sender==="seller").reduce((m,x)=>Math.max(m,x.id),0);if(s>this.seen){this.seen=s;LS.set("chatSeen",s)}this.badge()},
 badge(){const n=this.msgs.filter(m=>m.sender==="seller"&&m.id>this.seen).length,d=$("#chatDot");if(d){d.hidden=!n||this.isOpen;d.textContent=n||""}},
 time(at){const d=new Date(at);return isNaN(d)?"":d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})},
 bubbles(){return this.msgs.map(m=>`<div class="cmsg ${m.sender==="seller"?"them":"me"}"><div class="cb">${esc(m.body)}</div><small>${m.sender==="seller"?esc(S.settings.name)+" · ":""}${this.time(m.at)}</small></div>`).join("")},
 drawList(){const L=$("#chatList");if(!L)return;L.innerHTML=this.welcome()+this.bubbles()+(this.msgs.length&&!this.msgs.some(m=>m.sender==="seller")?`<p class="cnote">Thanks! We’ll reply right here${this.email()?" — and by email if you’ve left the site":""}.</p>`:"");L.scrollTop=L.scrollHeight},
 email(){return LS.get("chatEmail","")},
 welcome(){return `<div class="cmsg them"><div class="cb">Hi there! 👋 Questions about a product, shipping or your order? Send us a message and we’ll get back to you.</div></div>`},
 render(){const p=$("#chatPanel");if(!p)return;const st=S.settings,first=!this.msgs.length,logo=($(".brand img")||{}).src||"";
  const nm=LS.get("chatName","")||(typeof profile!=="undefined"&&profile&&profile.full_name)||"",em=this.email()||(typeof user!=="undefined"&&user&&user.email)||"";
  p.innerHTML=`<header class="chead">${logo?`<img src="${esc(logo)}" alt="">`:""}<div><b>${esc(st.name)}</b><small>${st.hours?"We reply "+esc(st.hours):"We usually reply within a few hours"}</small></div><button type="button" class="iconbtn" data-chatclose aria-label="Close chat">${X}</button></header>
  <div class="clist" id="chatList" aria-live="polite"></div>
  <form class="cform" novalidate>${first?`<div class="cfields"><input class="field" name="name" maxlength="80" placeholder="Your name" autocomplete="name" value="${esc(nm)}"><input class="field" name="email" type="email" maxlength="200" placeholder="Email (so we can reply if you leave)" autocomplete="email" value="${esc(em)}"></div>`:""}
  <div class="crow"><textarea class="field" name="body" rows="1" maxlength="2000" placeholder="Type your message…" aria-label="Message"></textarea><button class="btn primary" aria-label="Send">Send</button></div><div class="cerr" id="chatErr"></div></form>`;
  this.drawList()},
 async send(f){if(this.busy)return;const fd=Object.fromEntries(new FormData(f)),body=String(fd.body||"").trim(),err=$("#chatErr");err.textContent="";
  if(!body)return;const email=String(fd.email||"").trim(),name=String(fd.name||"").trim();
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){err.textContent="Please check your email address.";return}
  if(!this.key){this.key=(crypto.randomUUID?crypto.randomUUID():"10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));LS.set("chatKey",this.key)}
  this.busy=true;const btn=f.querySelector("button.primary");btn.disabled=true;
  const{error}=await sb.rpc("chat_send",{p_key:this.key,p_body:body,p_name:name||null,p_email:email||null,p_page:location.hash.slice(0,300)||"#/"});
  this.busy=false;btn.disabled=false;
  if(error){err.textContent=/TOO_MANY/.test(error.message)?"You’re sending messages too fast. Please wait a few minutes.":/BAD_EMAIL/.test(error.message)?"Please check your email address.":"Couldn’t send. Please try again or email "+(S.settings.email||"us")+".";return}
  if(name)LS.set("chatName",name);if(email)LS.set("chatEmail",email);
  const wasFirst=!this.msgs.length;await this.poll();if(wasFirst)this.render();else{f.body.value="";f.body.style.height=""}
  const t=$("#chatPanel textarea");t&&t.focus({preventScroll:true})}
};
document.addEventListener("input",e=>{if(e.target.closest&&e.target.closest("#chatPanel")&&e.target.tagName==="TEXTAREA"){const t=e.target;t.style.height="auto";t.style.height=Math.min(120,t.scrollHeight)+"px"}});
setTimeout(()=>Chat.init(),0);
