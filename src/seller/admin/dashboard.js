/* ===== Seller Central · Дашборд =====
   Amazon-style home (layout of the approved mockup): what needs doing (Дії), latest customer contacts (Комунікації),
   one «Огляд показників» block with 12 tiles for the chosen period, sales chart, returns statistics.
   No product list here on purpose — products live in «Товари». */
Object.assign(Admin,{
DPRESETS:[["today","Сьогодні"],["7","7 днів"],["30","30 днів"],["90","90 днів"],["custom","Свій період"]],
/* selected period → {from,to,prevFrom,label,days,byHour} (local time) */
dRange(){const p=sessionStorage.getItem("dashP")||"30",now=new Date(),sod=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
 let from,to=now,label;
 if(p==="custom"){const f=sessionStorage.getItem("dashFrom"),t=sessionStorage.getItem("dashTo");
  const pf=f?new Date(f+"T00:00:00"):null,pt=t?new Date(t+"T23:59:59.999"):null;
  if(pf&&pt&&!isNaN(pf)&&!isNaN(pt)&&pf<=pt){from=pf;to=pt>now?now:pt;label=this.dFmt(pf)+" — "+this.dFmt(pt)}}
 if(!from){const n=p==="today"?1:p==="custom"?30:(+p||30);from=sod(now);from.setDate(from.getDate()-(n-1));label=p==="today"?"сьогодні":"останні "+n+" дн."}
 const span=to-from,days=Math.max(1,Math.round((sod(to)-sod(from))/86400000)+1);
 return{p,from,to,prevFrom:new Date(from-span-1),label,days,byHour:days===1}},
dFmt(d){return new Date(d).toLocaleDateString("uk-UA",{day:"numeric",month:"short",year:new Date(d).getFullYear()!==new Date().getFullYear()?"numeric":undefined})},
dISO(d){const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")},
ago(at){const s=(Date.now()-Date.parse(at))/1000;if(isNaN(s))return"";if(s<3600)return Math.max(1,Math.round(s/60))+" хв тому";if(s<86400)return Math.round(s/3600)+" год тому";if(s<172800)return"вчора";return this.dFmt(at)},
dash(){const R=this.dRange(),h=new Date().getHours(),hi=h<5?"Доброї ночі":h<12?"Доброго ранку":h<18?"Добрий день":"Добрий вечір";
 setTimeout(()=>this.fillDash(),0);
 const tile=(id,l,sm)=>`<div class="dbt${sm?" sm":""}" id="${id}"><div class="dbl">${l}</div><div class="dbv">…</div></div>`;
 return `<div class="dbhead"><h1>${hi}! Стан магазину:</h1><span class="dbhealth" id="dbHealth">…</span><span class="dbhint" id="dbHint"></span>
 <div class="dbper"><div class="seg">${this.DPRESETS.map(([k,v])=>`<button class="${R.p===k?"on":""}" data-act="a:dashP" data-p="${k}">${v}</button>`).join("")}</div>
 <a class="btn primary sm" href="#/admin/product/new">${ICON.plus.replace("<svg",'<svg width="15"')} Додати товар</a></div></div>
 <form class="dbrange" data-form="dashrange" ${R.p==="custom"?"":"hidden"}><label>З <input class="field" type="date" name="from" value="${this.dISO(R.from)}" max="${this.dISO(new Date())}" required></label><label>по <input class="field" type="date" name="to" value="${this.dISO(R.to)}" max="${this.dISO(new Date())}" required></label><button class="btn sm primary">Показати</button></form>
 <div class="dbgrid"><div class="dbside">
  <section class="dbcard"><h2>Дії <span class="dbn" id="dbActN">…</span></h2><div class="dbacts" id="dbActs"><p class="muted small">Завантаження…</p></div></section>
  <section class="dbcard"><h2>Комунікації</h2><div class="dbcomm" id="dbComm"><p class="muted small">Завантаження…</p></div></section>
 </div><div class="dbmain">
  <section class="dbcard"><h2>Огляд показників <small>· ${esc(R.label)}</small></h2><div class="dbtiles six">
   ${tile("tSum","Продажі")}${tile("tOpen","Відкриті замовлення")}${tile("tMsg","Повідомлення покупців")}${tile("tRev","Відгуки")}${tile("tPay","Оплати")}${tile("tStock","Склад")}
   ${tile("tOrd","Замовлення",1)}${tile("tUnits","Продано товарів",1)}${tile("tAvg","Середній чек",1)}${tile("tRet","Повернення",1)}${tile("tCancel","Скасовано",1)}${tile("tTg","Telegram",1)}</div></section>
  <section class="dbcard"><h2>Продажі по днях <small>· наведіть на стовпчик, щоб побачити суму</small></h2><div class="dbchart chart" id="dbChart"><p class="muted small">Завантаження…</p></div></section>
  <section class="dbcard"><h2>Статистика повернень <small>· ${esc(R.label)}</small><a class="dblink" href="#/admin/orders?status=returned">Усі повернення →</a></h2><div class="dbtiles four">
   ${tile("rN","Повернень")}${tile("rUnits","Повернено товарів")}${tile("rSum","Сума повернених замовлень")}${tile("rRate","Частка повернень")}</div>
   <div class="dbreasons" id="dbReasons"></div></section>
 </div></div>`},
async fillDash(){const R=this.dRange(),pf=R.prevFrom.toISOString(),to=R.to.toISOString();
 const[O,RT,OP,UP,MN,ML,CT,RV,TG,RQ]=await Promise.all([
  sb.from("orders").select("created_at,total,status,items,payment_status,paid_amount").gte("created_at",pf).lte("created_at",to).order("created_at").limit(5000),
  sb.from("orders").select("returned_at,refunded_at,total,items,status,return_reason,refund_amount").or(`returned_at.gte.${pf},refunded_at.gte.${pf}`).limit(2000),
  sb.from("orders").select("status,created_at").in("status",["new","confirmed","shipped"]).limit(2000),
  sb.from("orders").select("total,created_at").eq("payment_status","unpaid").not("status","in","(cancelled,returned)").limit(2000),
  sb.from("messages").select("id",{count:"exact",head:true}).eq("status","new"),
  sb.from("messages").select("name,body,created_at,status").in("status",["new","read"]).order("created_at",{ascending:false}).limit(3),
  sb.from("chat_threads").select("id,name,email,last_preview,last_at,last_customer_at,admin_seen_at").order("last_at",{ascending:false}).limit(50),
  sb.from("reviews").select("id,name,rating,body,created_at").eq("status","pending").order("created_at",{ascending:false}).limit(50),
  sb.rpc("seller_telegram_status").then(r=>r,()=>({data:null})),
  sb.from("return_requests").select("id",{count:"exact",head:true}).eq("status","requested")]);
 if(!$("#tSum"))return;
 const err=[O,RT,OP,UP].find(x=>x.error);if(err){$("#dbActs").innerHTML=`<div class="note">Не вдалося завантажити: ${esc(err.error.message)}</div>`;return}
 const set=(id,v,s="",x="")=>{const e=$("#"+id);if(!e)return;e.querySelector(".dbv").innerHTML=v;e.querySelectorAll(".dbs,.dbrows,.dbd,.spark").forEach(n=>n.remove());e.insertAdjacentHTML("beforeend",(s?`<div class="dbs">${s}</div>`:"")+x)};
 const delta=(v,p,inv,short)=>{if(!p)return v&&!short?`<div class="dbd">попереднього періоду немає</div>`:"";const c=Math.round((v-p)/p*100);const good=inv?c<=0:c>=0;return `<div class="dbd ${c===0?"":good?"up":"down"}">${c>0?"▲":c<0?"▼":"="} ${Math.abs(c)}%${short?"":" до попер. періоду"}</div>`};
 const t0=+R.from,inCur=d=>{const x=Date.parse(d);return x>=t0&&x<=+R.to},inPrev=d=>{const x=Date.parse(d);return x>=+R.prevFrom&&x<t0};
 const units=a=>a.reduce((s,o)=>s+(o.items||[]).reduce((x,i)=>x+(+i.qty||0),0),0),sum=(a,k="total")=>a.reduce((s,o)=>s+(+o[k]||0),0);
 /* --- sales (orders placed in the period, except cancelled) --- */
 const ord=O.data||[],live=o=>o.status!=="cancelled",cur=ord.filter(o=>live(o)&&inCur(o.created_at)),prev=ord.filter(o=>live(o)&&inPrev(o.created_at));
 const cs=sum(cur),ps=sum(prev),cu=units(cur),pu=units(prev);
 /* chart buckets: by hour for one day, by day up to 92 days, otherwise by week */
 const wk=R.days>92,nB=R.byHour?24:wk?Math.ceil(R.days/7):R.days,d0=new Date(R.from.getFullYear(),R.from.getMonth(),R.from.getDate()),B=[];
 for(let i=0;i<nB;i++)B.push({st:R.byHour?new Date(+R.from+i*3600000):new Date(d0.getFullYear(),d0.getMonth(),d0.getDate()+(wk?i*7:i)),v:0,n:0,u:0});
 const key=d=>{const x=new Date(d);if(R.byHour)return x.getHours();const di=Math.round((new Date(x.getFullYear(),x.getMonth(),x.getDate())-d0)/86400000);return wk?Math.floor(di/7):di};
 cur.forEach(o=>{const b=B[key(o.created_at)];if(b){b.v+=+o.total||0;b.n++;b.u+=units([o])}});
 const mx=Math.max(1,...B.map(b=>b.v)),bl=b=>R.byHour?String(b.st.getHours()).padStart(2,"0")+":00":wk?"тиждень з "+this.dFmt(b.st):this.dFmt(b.st);
 const sod=new Date();sod.setHours(0,0,0,0);const today=R.to>=sod?sum(cur.filter(o=>Date.parse(o.created_at)>=+sod)):null;
 const spark=B.length>1?`<svg class="spark" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="#385a46" stroke-width="2" vector-effect="non-scaling-stroke" points="${B.map((b,i)=>(i/(B.length-1)*120).toFixed(1)+","+(28-b.v/mx*26).toFixed(1)).join(" ")}"/></svg>`:"";
 set("tSum",money(cs),today!==null&&!R.byHour?"сьогодні "+money(today):"",delta(cs,ps)+spark);
 set("tOrd",String(cur.length),"",delta(cur.length,prev.length,false,1));
 set("tUnits",cu+" шт.","",delta(cu,pu,false,1));
 set("tAvg",money(cur.length?cs/cur.length:0),"",delta(cur.length?cs/cur.length:0,prev.length?ps/prev.length:0,false,1));
 const canc=ord.filter(o=>o.status==="cancelled"&&inCur(o.created_at));set("tCancel",String(canc.length),canc.length?"на "+money(sum(canc)):"");
 $("#dbChart").innerHTML=cur.length?`<div class="bars">${B.map(b=>`<div class="cbar" title="${bl(b)}: ${money(b.v)} · ${b.n} замовл. · ${b.u} шт."><i style="height:${b.v?Math.max(3,Math.round(b.v/mx*100)):0}%"></i></div>`).join("")}</div><div class="barlbl"><span>${bl(B[0])}</span><span>макс. ${money(mx)} за ${R.byHour?"годину":wk?"тиждень":"день"}</span><span>${bl(B[B.length-1])}</span></div>`
  :`<div class="empty" style="padding:24px"><b>За цей період замовлень немає</b>Щойно з’являться замовлення, тут буде графік.</div>`;
 /* --- live status --- */
 const op=OP.data||[],cnt=s=>op.filter(o=>o.status===s).length;
 set("tOpen",String(cnt("new")+cnt("confirmed")),"",`<div class="dbrows"><a href="#/admin/orders?status=new"><span>Нові</span><b>${cnt("new")}</b></a><a href="#/admin/orders?status=confirmed"><span>Підтверджені</span><b>${cnt("confirmed")}</b></a><a href="#/admin/orders?status=shipped"><span>У дорозі</span><b>${cnt("shipped")}</b></a></div>`);
 const up=UP.data||[],paidCur=ord.filter(o=>live(o)&&inCur(o.created_at)&&["paid","partially_refunded"].includes(o.payment_status));
 set("tPay",money(sum(paidCur,"paid_amount")),"отримано за період",`<div class="dbrows"><a href="#/admin/orders?status=unpaid"><span>Очікує оплати</span><b>${up.length?money(sum(up)):"—"}</b></a></div>`);
 const act=S.products.filter(p=>p.active),thr=this.lowN(),out=act.filter(p=>p.stock<=0).length,low=act.filter(p=>p.stock>0&&p.stock<=thr).length;
 set("tStock",String(act.length),"товарів на сайті",`<div class="dbrows"><a href="#/admin/products?stock=low"><span>Закінчуються</span><b class="${low?"warn":""}">${low}</b></a><a href="#/admin/products?stock=out"><span>Немає</span><b class="${out?"bad":""}">${out}</b></a></div>`);
 const rv=S.reviews||[],avg=rv.length?rv.reduce((s,r)=>s+(+r.rating||0),0)/rv.length:0,pend=(RV.data||[]).length;
 set("tRev",rv.length?`<span class="dbstars">${"★".repeat(Math.round(avg))}${"☆".repeat(5-Math.round(avg))}</span> ${avg.toFixed(1)}`:"—",rv.length+" відгуків"+(pend?` · <a href="#/admin/reviews">${pend} чекає модерації</a>`:""));
 const th=CT.data||[],unread=th.filter(t=>this.chatUnread(t)),nm=MN.count||0;
 set("tMsg",String(unread.length+nm),"потребують відповіді",`<div class="dbrows"><a href="#/admin/chat"><span>Чат</span><b>${unread.length}</b></a><a href="#/admin/messages"><span>Форма</span><b>${nm}</b></a></div>`);
 const tg=TG&&TG.data;set("tTg",tg&&tg.enabled?`<span class="dbok">● Підключено</span>`:`<span class="dboff">○ Вимкнено</span>`,tg&&tg.enabled?"сповіщення працюють":`<a href="#/admin/settings">підключити</a>`);
 /* --- returns (counted by the date the return was registered) --- */
 const rt=RT.data||[],isRet=o=>o.returned_at&&o.status==="returned",rc=rt.filter(o=>isRet(o)&&inCur(o.returned_at)),rp=rt.filter(o=>isRet(o)&&inPrev(o.returned_at));
 const refAmt=sum(rt.filter(o=>o.refunded_at&&inCur(o.refunded_at)),"refund_amount");
 set("tRet",String(rc.length),rc.length?money(sum(rc)):"");
 set("rN",String(rc.length),"",delta(rc.length,rp.length,true));set("rUnits",units(rc)+" шт.",cu?"з "+cu+" проданих за період":"");
 set("rSum",money(sum(rc)),"відшкодовано покупцям: "+money(refAmt));
 const rate=cur.length?rc.length/cur.length*100:0,prate=prev.length?rp.length/prev.length*100:0;
 set("rRate",cur.length?rate.toFixed(1)+"%":"—",cur.length?rc.length+" з "+cur.length+" замовл.":"немає замовлень за період",cur.length&&prev.length&&rate!==prate?`<div class="dbd ${rate<prate?"up":"down"}">${rate<prate?"▼":"▲"} ${Math.abs(rate-prate).toFixed(1)} п.п. до попер. періоду</div>`:"");
 const RS={};rc.forEach(o=>{const k=String(o.return_reason||"Без причини").split(":")[0].trim()||"Без причини";RS[k]=(RS[k]||0)+1});
 const rs=Object.entries(RS).sort((a,b)=>b[1]-a[1]),rm=Math.max(1,...rs.map(x=>x[1]));
 $("#dbReasons").innerHTML=rs.length?`<h3>Причини повернень</h3>${rs.map(([k,n])=>`<div class="dbreason"><span>${esc(k)}</span><div class="tbar"><i style="width:${Math.round(n/rm*100)}%"></i></div><b>${n}</b></div>`).join("")}`:`<p class="muted small" style="margin:4px 0 0">За цей період повернень немає 👍</p>`;
 /* --- actions --- */
 const ship=cnt("new")+cnt("confirmed"),A=[];
 if(ship)A.push(["hot","Відправити замовлення",`${ship} ${ship===1?"замовлення чекає":"замовлень чекають"} підтвердження або відправлення`,"#/admin/orders"]);
 if(unread.length)A.push(["hot","Відповісти в чаті",`${unread.length} ${unread.length===1?"розмова":"розмов"} без відповіді`,"#/admin/chat"]);
 const rq=(RQ&&RQ.count)||0;if(rq)A.push(["hot","Заявки на повернення",`${rq} ${rq===1?"нова заявка":"нових заявок"} — перегляньте фото й вирішіть`,"#/admin/returns"]);
 if(nm)A.push(["","Нові повідомлення",`${nm} з форми «Contact us»`,"#/admin/messages"]);
 if(up.length)A.push(["warn","Очікує оплати",`${up.length} замовл. на ${money(sum(up))}`,"#/admin/orders?status=unpaid"]);
 if(pend)A.push(["","Відгуки на модерації",`${pend} ${pend===1?"новий відгук":"нових відгуків"}`,"#/admin/reviews"]);
 if(low+out)A.push(["warn","Поповнити склад",`${low} закінчуються · ${out} немає в наявності`,"#/admin/products?stock=low"]);
 $("#dbActN").textContent=A.length;
 $("#dbActs").innerHTML=A.length?A.map(([c,t,s,h])=>`<a class="dbact ${c}" href="${h}"><b>${t}</b><span>${s}</span></a>`).join(""):`<div class="dbdone">✓ Усе зроблено — нових задач немає</div>`;
 /* --- health --- */
 const old=(d,h)=>Date.now()-Date.parse(d)>h*3600000,issues=[];
 const lateShip=op.filter(o=>["new","confirmed"].includes(o.status)&&old(o.created_at,48)).length;if(lateShip)issues.push(lateShip+" замовл. не відправлено понад 2 дні");
 const lateChat=unread.filter(t=>old(t.last_customer_at,24)).length;if(lateChat)issues.push(lateChat+" чат без відповіді понад добу");
 if(out)issues.push(out+" товарів немає в наявності");
 const hb=$("#dbHealth");if(hb){hb.className="dbhealth "+(issues.length?"warn":"ok");hb.textContent=issues.length?"Потребує уваги":"Добрий"}
 const hn=$("#dbHint");if(hn)hn.textContent=issues.length?issues.join(" · "):"нічого не прострочено";
 /* --- communications --- */
 const C=[...th.filter(t=>t.last_preview).slice(0,3).map(t=>({at:t.last_at,i:"💬",n:t.name||t.email||"Відвідувач",b:t.last_preview,s:"Чат"+(this.chatUnread(t)?" · без відповіді":""),h:"#/admin/chat?t="+t.id})),
  ...(ML.data||[]).map(m=>({at:m.created_at,i:"✉️",n:m.name,b:m.body,s:"Форма"+(m.status==="new"?" · нове":""),h:"#/admin/messages"})),
  ...(RV.data||[]).slice(0,3).map(r=>({at:r.created_at,i:"⭐",n:r.name+" · "+"★".repeat(+r.rating||0),b:r.body,s:"Відгук на модерації",h:"#/admin/reviews"}))].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,5);
 $("#dbComm").innerHTML=C.length?C.map(c=>`<a class="dbcm" href="${c.h}"><b>${c.i} ${esc(c.n)}</b><p>${esc(String(c.b||"").slice(0,90))}</p><small>${c.s} · ${this.ago(c.at)}</small></a>`).join("")+`<a class="dblink" href="#/admin/messages">Усі повідомлення →</a>`:`<p class="muted small">Поки що тихо.</p>`;
},
dashRange(f){const a=f.from.value,b=f.to.value;if(!a||!b)return toast("Вкажіть обидві дати");const[x,y]=a<=b?[a,b]:[b,a];
 sessionStorage.setItem("dashP","custom");sessionStorage.setItem("dashFrom",x);sessionStorage.setItem("dashTo",y);render()},
});
