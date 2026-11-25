/* ===== Seller Central · Аналітика =====
   Anonymous visit statistics collected by the storefront (store/track.js → public.track → table analytics_events).
   One report per period comes from public.analytics_report() (admins only). Period = the same switch as on the dashboard. */
Object.assign(Admin,{
AN_SRC:{direct:"Прямі заходи",google:"Google",bing:"Bing",duckduckgo:"DuckDuckGo",yahoo:"Yahoo",instagram:"Instagram",facebook:"Facebook",pinterest:"Pinterest",tiktok:"TikTok",youtube:"YouTube",twitter:"X (Twitter)",telegram:"Telegram",etsy:"Etsy",chatgpt:"ChatGPT"},
AN_BLOCK:{hero:"Головний банер",perks:"Переваги (доставка, оплата…)",categories:"Категорії",featured:"Обирають найчастіше",new:"Щойно надійшли"},
AN_DEV:{mobile:"📱 Телефон",tablet:"📟 Планшет",desktop:"💻 Комп’ютер"},
anPct(a,b){return b?Math.round(a/b*1000)/10+"%":"—"},
anSrc(s){return this.AN_SRC[s]||esc(s)},
analytics(){const R=this.dRange();setTimeout(()=>this.fillAn(),0);
 return `<div class="dbhead"><h1>📈 Аналітика</h1><span class="dbhint">${esc(R.label)}</span>
 <div class="dbper"><div class="seg">${this.DPRESETS.map(([k,v])=>`<button class="${R.p===k?"on":""}" data-act="a:dashP" data-p="${k}">${v}</button>`).join("")}</div></div></div>
 <form class="dbrange" data-form="dashrange" ${R.p==="custom"?"":"hidden"}><label>З <input class="field" type="date" name="from" value="${this.dISO(R.from)}" max="${this.dISO(new Date())}" required></label><label>по <input class="field" type="date" name="to" value="${this.dISO(R.to)}" max="${this.dISO(new Date())}" required></label><button class="btn sm primary">Показати</button></form>
 <p class="help" style="margin:-4px 0 14px">Анонімна статистика відвідувань магазину: без cookies і без персональних даних. Ваші власні візити не рахуються на пристроях, де ви входили в кабінет. Період — той самий, що на дашборді.</p>
 <div id="anBox"><div class="dbcard"><p class="muted small" style="padding:16px">Завантаження…</p></div></div>`},
async fillAn(){const R=this.dRange(),tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
 const[a,b]=await Promise.all([sb.rpc("analytics_report",{p_from:R.from.toISOString(),p_to:R.to.toISOString(),p_tz:tz}),sb.rpc("analytics_report",{p_from:R.prevFrom.toISOString(),p_to:new Date(+R.from-1).toISOString(),p_tz:tz})]);
 const box=$("#anBox");if(!box)return;
 if(a.error)return box.innerHTML=`<div class="note">Не вдалося завантажити аналітику: ${esc(a.error.message)}</div>`;
 box.innerHTML=this.anView(a.data||{},b.error?null:b.data,R)},
anView(d,p,R){const V=+d.visits||0,since=d.first_event?this.dFmt(d.first_event):null;
 if(!V)return `<div class="empty"><b>За цей період відвідувань ще немає</b>${since?`Статистика збирається з ${esc(since)}. Спробуйте інший період.`:"Статистика почне збиратися, щойно хтось відкриє магазин. Перші дані з’являться тут за кілька хвилин."}</div>`;
 const delta=(v,pv,pct)=>{if(!p||pv==null)return"";if(!pv)return v?`<div class="dbd">попереднього періоду немає</div>`:"";const c=pct?Math.round((v-pv)*10)/10:Math.round((v-pv)/pv*100);if(!isFinite(c))return"";
  return `<div class="dbd ${c>0?"up":c<0?"down":""}">${c>0?"▲":c<0?"▼":"="} ${Math.abs(c)}${pct?" п.п.":"%"} до попер. періоду</div>`};
 const conv=V?(+d.bought||0)/V*100:0,pconv=p&&+p.visits?(+p.bought||0)/p.visits*100:null;
 const tile=(l,v,s,x="")=>`<div class="dbt sm"><div class="dbl">${l}</div><div class="dbv">${v}</div>${s?`<div class="dbs">${s}</div>`:""}${x}</div>`;
 const tiles=`<section class="dbcard"><h2>Огляд <small>· ${esc(R.label)}</small></h2><div class="dbtiles six">
  ${tile("Відвідування",V,`${d.pages||0} переглядів сторінок`,delta(V,p&&p.visits))}
  ${tile("Переглянули товар",d.viewed||0,this.anPct(d.viewed,V)+" відвідувань",delta(+d.viewed||0,p&&p.viewed))}
  ${tile("Додали в кошик",d.carted||0,this.anPct(d.carted,V)+" відвідувань",delta(+d.carted||0,p&&p.carted))}
  ${tile("Замовлення",d.purchases||0,"з відвідувань сайту",delta(+d.purchases||0,p&&p.purchases))}
  ${tile("Конверсія",Math.round(conv*10)/10+"%","відвідування → замовлення",pconv==null?"":delta(Math.round(conv*10)/10,Math.round(pconv*10)/10,1))}
  ${tile("Виручка з сайту",money(+d.revenue||0),"замовлення, що відстежено",delta(+d.revenue||0,p&&+p.revenue))}</div></section>`;
 /* funnel */
 const F=[["Відвідування",V],["Переглянули товар",+d.viewed||0],["Додали в кошик",+d.carted||0],["Почали оформлення",+d.checkout||0],["Замовили",+d.bought||0]];
 const funnel=`<section class="dbcard"><h2>Воронка продажів <small>· на якому кроці відпадають покупці</small></h2><div class="anfun">${F.map(([l,n],i)=>`<div class="anstep"><span>${l}</span><div class="anbar"><i style="width:${V?Math.max(n?2:0,Math.round(n/V*100)):0}%"></i></div><b>${n}</b><small>${i?`${this.anPct(n,F[i-1][1])} від попереднього`:"100%"}</small></div>`).join("")}</div>
  ${this.anHint(F)}</section>`;
 /* daily chart */
 const days=[],d0=new Date(R.from.getFullYear(),R.from.getMonth(),R.from.getDate()),M={};(d.daily||[]).forEach(x=>M[x.d]=x);
 for(let i=0;i<Math.min(R.days,400);i++){const x=new Date(d0);x.setDate(d0.getDate()+i);const k=this.dISO(x);days.push({k,v:M[k]?+M[k].visits:0,b:M[k]?+M[k].bought:0})}
 let B=days;if(days.length>92){B=[];for(let i=0;i<days.length;i+=7){const w=days.slice(i,i+7);B.push({k:w[0].k+" — "+w[w.length-1].k,v:w.reduce((s,x)=>s+x.v,0),b:w.reduce((s,x)=>s+x.b,0)})}}
 const mx=Math.max(1,...B.map(x=>x.v)),lbl=k=>this.dFmt(k.split(" — ")[0]);
 const chart=`<section class="dbcard"><h2>Відвідування ${days.length>92?"по тижнях":"по днях"} <small>· наведіть на стовпчик</small></h2><div class="dbchart chart">${B.length>1?`<div class="bars">${B.map(x=>`<div class="cbar" title="${esc(x.k)}: ${x.v} відвідувань · ${x.b} із замовленням"><i style="height:${x.v?Math.max(3,Math.round(x.v/mx*100)):0}%"></i></div>`).join("")}</div><div class="barlbl"><span>${lbl(B[0].k)}</span><span>макс. ${mx} за ${days.length>92?"тиждень":"день"}</span><span>${lbl(B[B.length-1].k)}</span></div>`:`<p class="muted small">За один день графік не будується — оберіть довший період.</p>`}</div></section>`;
 /* tables */
 const T=(head,rows,empty)=>rows.length?`<div class="tablewrap antable"><table class="t"><thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`:`<p class="muted small" style="padding:14px 16px">${empty}</p>`;
 const src=T(["Джерело","Відвідування","Кошик","Замовлення","Конверсія","Виручка"],(d.sources||[]).map(s=>`<tr><td class="ansrc"><b>${this.anSrc(s.source)}</b></td><td>${s.visits} <small class="muted">${this.anPct(s.visits,V)}</small></td><td>${s.carted}</td><td>${s.bought}</td><td>${this.anPct(s.bought,s.visits)}</td><td>${money(+s.revenue||0)}</td></tr>`),"Немає даних");
 const dev=T(["Пристрій","Відвідування","Замовлення","Конверсія"],(d.devices||[]).map(s=>`<tr><td><b>${this.AN_DEV[s.device]||esc(s.device)}</b></td><td>${s.visits} <small class="muted">${this.anPct(s.visits,V)}</small></td><td>${s.bought}</td><td>${this.anPct(s.bought,s.visits)}</td></tr>`),"Немає даних");
 const HV=+d.home_visits||0,bl=d.blocks||[],seen=new Set(bl.map(x=>x.block));
 const blocks=T(["Блок головної","Кліків","Відвідувань із кліком","Частка відвідувачів головної"],bl.map(s=>`<tr><td><b>${this.AN_BLOCK[s.block]||esc(s.block)}</b></td><td>${s.clicks}</td><td>${s.visits}</td><td>${this.anPct(s.visits,HV)}</td></tr>`).concat(Object.keys(this.AN_BLOCK).filter(k=>!seen.has(k)).map(k=>`<tr class="anzero"><td>${this.AN_BLOCK[k]}</td><td>0</td><td>0</td><td>—</td></tr>`)),"Немає даних");
 const camp=(d.campaigns||[]).length?`<section class="dbcard"><h2>Рекламні кампанії (UTM)</h2>${T(["Кампанія","Канал","Відвідування","Замовлення","Конверсія","Виручка"],d.campaigns.map(s=>`<tr><td><b>${esc(s.campaign)}</b></td><td>${esc(s.medium||"—")}</td><td>${s.visits}</td><td>${s.bought}</td><td>${this.anPct(s.bought,s.visits)}</td><td>${money(+s.revenue||0)}</td></tr>`),"")}</section>`:"";
 const sold={};(d.sales||[]).forEach(x=>sold[x.id]=+x.qty||0);
 const pname=id=>{const x=S.products.find(p=>String(p.id)===String(id));return x?`<a href="#/admin/product/${esc(x.id)}"><b>${esc(x.name)}</b></a>`:`<span class="muted">${esc(id)} (видалено)</span>`};
 const prods=T(["Товар","Переглядів","Відвідувачів","Додали в кошик","Продано, шт.","Перегляд → кошик",""],(d.products||[]).slice(0,25).map(s=>{const c=s.viewers?s.carts/s.viewers:0,flag=s.viewers>=10&&c<0.05;return `<tr><td>${pname(s.id)}</td><td>${s.views}</td><td>${s.viewers}</td><td>${s.carts}</td><td>${sold[s.id]||0}</td><td>${s.viewers?Math.round(c*100)+"%":"—"}</td><td>${flag?`<span class="anflag" title="Багато переглядів, але майже не додають у кошик — перевірте ціну, фото й опис">дивляться, але не купують</span>`:""}</td></tr>`}),"Товари ще не переглядали");
 const srch=T(["Запит","Шукали (відвідувань)","Знайдено товарів"],(d.searches||[]).map(s=>`<tr><td><b>${esc(s.q)}</b></td><td>${s.n}</td><td>${+s.results?s.results:`<span class="anflag">нічого не знайдено</span>`}</td></tr>`),"Пошуком ще не користувалися");
 const land=T(["Сторінка входу","Відвідування","Замовлення"],(d.landing||[]).map(s=>`<tr><td><b>${esc(this.anPage(s.path))}</b></td><td>${s.visits}</td><td>${s.bought}</td></tr>`),"Немає даних");
 return `${tiles}<div class="angrid">${funnel}${chart}</div>
 <section class="dbcard"><h2>Звідки приходять <small>· які джерела приводять покупців, а не лише відвідувачів</small></h2>${src}</section>
 <div class="angrid"><section class="dbcard"><h2>Пристрої</h2>${dev}</section><section class="dbcard"><h2>Сторінки входу <small>· з чого починають</small></h2>${land}</section></div>
 ${camp}
 <section class="dbcard"><h2>Головна сторінка <small>· ${HV} відвідувань головної · які блоки клікають</small></h2>${blocks}</section>
 <section class="dbcard"><h2>Товари <small>· перегляди, кошик і продажі за період</small></h2>${prods}</section>
 <section class="dbcard"><h2>Пошук на сайті <small>· що шукають покупці</small></h2>${srch}${(d.searches||[]).some(s=>!+s.results)?`<p class="help" style="padding:0 16px 12px">«Нічого не знайдено» — підказка, які товари додати або які слова вписати в назви й описи.</p>`:""}</section>
 <section class="dbcard anhow"><h2>Як позначати посилання для реклами (UTM)</h2><div style="padding:12px 16px">Додайте в кінець посилання на магазин, наприклад для Instagram-історії: <code>?utm_source=instagram&utm_medium=social&utm_campaign=black-friday</code>. Тоді в таблиці «Рекламні кампанії» буде видно, скільки відвідувань і замовлень дала саме ця публікація.</div></section>`},
anPage(p){const k=(p||"/").split("/")[1]||"";return{"":"Головна","shop":"Каталог / пошук","product":"Сторінка товару","cart":"Кошик","checkout":"Оформлення","about":"Про нас","contacts":"Контакти","favorites":"Обране","account":"Акаунт","track":"Відстеження замовлення","order":"Замовлення"}[k]||p},
anHint(F){const[v,pv,c,co,b]=F.map(x=>x[1]);if(v<20)return `<p class="help" style="padding:0 16px 12px">Поки замало відвідувань для висновків — дивіться на воронку, коли їх буде хоча б кілька десятків.</p>`;
 const r=[pv/v,c/(pv||1),co/(c||1),b/(co||1)],names=["відкривають товари","додають у кошик","переходять до оформлення","завершують замовлення"],tips=["Головна й каталог не зацікавлюють — перевірте банер, фото й ціни на картках.","Товар дивляться, але не беруть — ціна, фото, опис, відгуки чи вартість доставки.","Кошик не доходить до оформлення — можливо, лякає доставка чи податок у кошику.","Оформлення кидають — перевірте форму й оплату на телефоні."];
 const i=r.indexOf(Math.min(...r));return `<p class="help" style="padding:0 16px 12px">Найбільше відпадає на кроці «${names[i]}» (${Math.round(r[i]*100)}%). ${tips[i]}</p>`},
/* small summary for the dashboard */
async fillDashAn(R){const e=$("#dbAn");if(!e)return;const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
 const{data,error}=await sb.rpc("analytics_report",{p_from:R.from.toISOString(),p_to:R.to.toISOString(),p_tz:tz});if(!$("#dbAn"))return;
 if(error||!data)return e.innerHTML=`<p class="muted small">Аналітика недоступна</p>`;
 const V=+data.visits||0,top=(data.sources||[])[0];
 e.innerHTML=V?`<div class="dbrows"><a href="#/admin/analytics"><span>Відвідування</span><b>${V}</b></a><a href="#/admin/analytics"><span>Додали в кошик</span><b>${data.carted||0}</b></a><a href="#/admin/analytics"><span>Конверсія в замовлення</span><b>${this.anPct(data.bought,V)}</b></a>${top?`<a href="#/admin/analytics"><span>Головне джерело</span><b>${this.anSrc(top.source)}</b></a>`:""}</div><a class="dblink" href="#/admin/analytics" style="display:inline-block;margin-top:8px">Уся аналітика →</a>`
  :`<p class="muted small" style="margin:0">Відвідувань за період ще немає. <a class="dblink" href="#/admin/analytics">Аналітика →</a></p>`},
});
