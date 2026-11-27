/* ===== Seller Central · Підтримка: повідомлення з форми й чат ===== */
Object.assign(Admin,{
messages(q){const st=q.get("status")||"inbox";setTimeout(()=>this.fillMsgs(st),0);
 return `<div class="ahead"><h1>Повідомлення від покупців</h1><button class="btn sm" data-act="a:reloadMsgs">↻ Оновити</button></div>
 <div class="chips">${[["inbox","Вхідні"],["new","Нові"],["replied","Відповіли"],["archived","Архів"]].map(([k,v])=>`<a class="chip ${st===k?"on":""}" href="#/admin/messages${k==="inbox"?"":"?status="+k}">${v}</a>`).join("")}</div>
 <div id="msgList"><p class="muted">Завантаження…</p></div><p class="help">Повідомлення надходять із форми «Contact us» на сайті. Відповідайте зі своєї пошти — кнопка «Відповісти» відкриє лист.</p>`},
msgData:[],
async fillMsgs(st){let qq=sb.from("messages").select("*").order("created_at",{ascending:false}).limit(300);
 if(st==="inbox")qq=qq.in("status",["new","read"]);else qq=qq.eq("status",st);
 const{data,error}=await qq;const box=$("#msgList");if(!box)return;if(error){box.innerHTML=`<div class="note">${esc(error.message)}</div>`;return}
 this.msgData=data;this.renderMsgs();this.msgBadge()},
renderMsgs(){const box=$("#msgList");if(!box)return;const d=this.msgData;
 if(!d.length){box.innerHTML=`<div class="empty"><b>Тут порожньо</b>Нові повідомлення з’являться тут.</div>`;return}
 const SL={new:"Нове",read:"Прочитане",replied:"Відповіли",archived:"Архів"};
 box.innerHTML=d.map(m=>`<details class="msg ${m.status==="new"?"unread":""}" ${m.status==="new"?"":""}><summary><span class="mfrom"><b>${esc(m.name)}</b> <span class="muted small">${esc(m.email)}</span></span><span class="mprev">${esc(m.body.slice(0,90))}${m.body.length>90?"…":""}</span><span class="mmeta"><span class="ostat s-${m.status==="new"?"new":"completed"}">${SL[m.status]}</span><span class="small muted">${new Date(m.created_at).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span></span></summary>
 <div class="mbody">${m.order_no?`<p class="small">Замовлення: <b>${esc(m.order_no)}</b></p>`:""}<p style="white-space:pre-line">${esc(m.body)}</p>
 <div class="acts" style="justify-content:flex-start"><a class="btn sm primary" href="mailto:${esc(m.email)}?subject=${encodeURIComponent("Re: your message to "+S.settings.name)}" data-act="a:msgStatus" data-id="${m.id}" data-v="replied">✉ Відповісти</a>${m.status==="new"?`<button class="btn sm" data-act="a:msgStatus" data-id="${m.id}" data-v="read">Прочитано</button>`:""}${m.status!=="archived"?`<button class="btn sm" data-act="a:msgStatus" data-id="${m.id}" data-v="archived">В архів</button>`:`<button class="btn sm" data-act="a:msgStatus" data-id="${m.id}" data-v="read">Повернути</button>`}<span class="small muted">${esc(m.email)}</span></div></div></details>`).join("")},
/* menu counters refresh every minute while the tab is open (new orders, chats, messages, returns, reviews) */
badgeTick(){if(this.badgeT)return;this.badgeT=setInterval(()=>{if(!document.hidden&&$("#adminNav"))this.msgBadge()},60000);document.addEventListener("visibilitychange",()=>{if(!document.hidden&&$("#adminNav"))this.msgBadge()})},
async msgBadge(){this.badgeTick();const{count}=await sb.from("messages").select("id",{count:"exact",head:true}).eq("status","new");const b=$("#msgBadge");if(b){b.textContent=count||"";b.title=count?`Нових повідомлень: ${count}`:""}this.revBadge();this.chatBadge();this.retBadge();this.ordBadge()},
chatUnread:t=>!!t.last_customer_at&&(!t.admin_seen_at||Date.parse(t.last_customer_at)>Date.parse(t.admin_seen_at)),
async chatBadge(){const{data}=await sb.from("chat_threads").select("id,last_customer_at,admin_seen_at").order("last_at",{ascending:false}).limit(300);const b=$("#chatBadge");if(b&&data){const n=data.filter(this.chatUnread).length;b.textContent=n||"";b.title=n?`Непрочитаних чатів: ${n}`:""}},
/* ---- live chat inbox ---- */
chatUrls:{},chatPend:{},
chatMsgsHtml(ms){const tm=d=>new Date(d).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
 return ms.map(m=>`<div class="cmsg ${m.sender==="seller"?"them":"me"}">${String(m.body||"").trim()?`<div class="cb">${esc(m.body)}</div>`:""}${chatFilesHtml(m.files,this.chatUrls)}<small>${m.sender==="seller"?"Ви · ":""}${tm(m.created_at)}</small></div>`).join("")},
async chatLoadUrls(ms){const need=[...new Set(ms.flatMap(m=>(m.files||[]).map(f=>f.path)))].filter(p=>!this.chatUrls[p]);if(!need.length)return;
 const{data}=await sb.storage.from("chat-media").createSignedUrls(need,3600);(data||[]).forEach(x=>{if(x.signedUrl)this.chatUrls[x.path]=x.signedUrl});
 const M=$("#chatMsgs");if(M&&this.chatMs===ms){const at=M.scrollHeight-M.scrollTop-M.clientHeight<40;M.innerHTML=this.chatMsgsHtml(ms);if(at){M.scrollTop=M.scrollHeight;M.querySelectorAll("img").forEach(i=>i.addEventListener("load",()=>{M.scrollTop=M.scrollHeight},{once:true}))}}},
chatAdmDrawPend(tid){const b=$("#chatAdmPend"),P=this.chatPend[tid]||[];if(!b)return;b.hidden=!P.length;
 b.innerHTML=P.map((x,i)=>`<span class="cpend">${x.thumb?`<img src="${esc(x.thumb)}" alt="">`:"📄"}<span>${esc(x.file.name)}</span><button type="button" data-chatadmrm="${i}" aria-label="Прибрати">×</button></span>`).join("")},
chatAdmPick(input){const f=input.closest("form"),tid=f.dataset.id,P=this.chatPend[tid]=this.chatPend[tid]||[],c=chatPickCheck(input.files,P.length);input.value="";
 c.ok.forEach(x=>P.push({file:x,thumb:/^image\/(jpeg|png|webp|gif)$/.test(x.type)?URL.createObjectURL(x):""}));
 if(c.bad.length)toast("Не додано: "+c.bad.join("; "));else if(c.over)toast("Не більше "+CHAT_FILES+" файлів в одному повідомленні");this.chatAdmDrawPend(tid)},
async chatAdmUpload(tid){const out=[];for(const x of this.chatPend[tid]||[]){const{blob,type}=await shrinkImage(x.file);if(blob.size>CHAT_MAX)throw new Error("Файл завеликий (до 10 МБ): "+x.file.name);
  const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","image/heic":"heic","image/heif":"heif","application/pdf":"pdf"}[type];if(!ext)throw new Error("Лише фото або PDF: "+x.file.name);
  const path=`s/${tid}/${crypto.randomUUID()}.${ext}`;const{error}=await sb.storage.from("chat-media").upload(path,blob,{contentType:type,upsert:false});if(error)throw error;
  out.push({path,name:x.file.name.slice(0,120),type,size:blob.size})}return out},
chat(q){const tid=q.get("t")||"";this.chatSig="";setTimeout(()=>this.fillChat(tid),0);clearInterval(this.chatTimer);
 this.chatTimer=setInterval(()=>{if(!location.hash.startsWith("#/admin/chat")){clearInterval(this.chatTimer);return}if(document.visibilityState==="visible")this.fillChat(new URLSearchParams(location.hash.split("?")[1]||"").get("t")||"",true)},8000);
 return `<div class="ahead"><h1>Чат</h1></div><p class="muted" style="margin-top:-8px">Розмови з чату на сайті. Якщо покупець ще на сайті, він побачить вашу відповідь одразу. Якщо вже пішов, відповідайте листом (кнопка «✉️ Відповісти листом»). Нові повідомлення приходять і в Telegram, якщо сповіщення підключено. Пишіть покупцям англійською.</p>
 <div class="chatadm"><div class="chatlistadm" id="chatAdmList"><p class="muted" style="padding:14px">Завантаження…</p></div><div class="chatconv" id="chatConv"><div class="empty" style="border:0;margin:auto">Оберіть розмову зліва</div></div></div>`},
async fillChat(tid,silent){
 const{data:th,error}=await sb.from("chat_threads").select("id,name,email,page,status,created_at,last_at,last_customer_at,admin_seen_at,last_preview").order("last_at",{ascending:false}).limit(300);
 const L=$("#chatAdmList");if(!L)return;if(error){L.innerHTML=`<div class="note" style="margin:12px">${esc(error.message)}</div>`;return}
 const when=d=>{const x=new Date(d);return x.toDateString()===new Date().toDateString()?x.toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"}):x.toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit"})};
 L.innerHTML=th.length?th.map(t=>`<a class="chatitem ${t.id===tid?"on":""} ${this.chatUnread(t)?"unread":""}" href="#/admin/chat?t=${t.id}"><b>${esc(t.name||t.email||"Відвідувач")}</b><span class="small muted">${esc(t.last_preview||"")}</span><small>${when(t.last_at)}${t.status==="closed"?" · закрито":""}</small></a>`).join(""):`<div class="empty" style="border:0">Ще немає розмов</div>`;
 const b=$("#chatBadge");if(b)b.textContent=th.filter(this.chatUnread).length||"";
 if(!tid)return;const t=th.find(x=>x.id===tid),C=$("#chatConv");if(!C)return;if(!t){C.innerHTML='<div class="empty" style="border:0;margin:auto">Розмову не знайдено</div>';return}
 const{data:ms,error:e2}=await sb.from("chat_messages").select("id,sender,body,files,created_at").eq("thread_id",tid).order("id").limit(500);if(e2){C.innerHTML=`<div class="note" style="margin:12px">${esc(e2.message)}</div>`;return}
 const sig=tid+":"+ms.length+":"+t.status;if(silent&&this.chatSig===sig)return;this.chatSig=sig;
 const old=C.querySelector("textarea"),draft=old&&old.dataset.t===tid?old.value:"";
 const tm=d=>new Date(d).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
 C.innerHTML=`<div class="chathd"><div><b>${esc(t.name||"Відвідувач")}</b><div class="small muted">${t.email?esc(t.email):"email не вказано"}${t.page?` · був на сторінці <a class="textlink" href="${SITE_URL}${esc(t.page)}" target="_blank" rel="noopener">${esc(t.page)}</a>`:""}</div></div>
 <div class="acts">${t.email?`<a class="btn sm" href="mailto:${esc(t.email)}?subject=${encodeURIComponent("Re: your message to "+S.settings.name)}">✉️ Відповісти листом</a>`:""}<button class="btn sm" data-act="a:chatstatus" data-id="${t.id}" data-v="${t.status==="open"?"closed":"open"}">${t.status==="open"?"✓ Закрити":"Відкрити знову"}</button><button class="btn sm danger" data-act="a:chatdel" data-id="${t.id}">Видалити</button></div></div>
 <div class="chatmsgs" id="chatMsgs">${this.chatMsgsHtml(ms)}</div>
 <form class="chatreply" data-form="chatreply" data-id="${t.id}"><div class="cpends" id="chatAdmPend" hidden></div><label class="cattach" title="Додати фото або PDF"><input type="file" accept="image/*,application/pdf" multiple hidden data-chatadmfile>📎</label><textarea class="field" name="body" maxlength="2000" data-t="${t.id}" placeholder="Відповідь англійською… (Enter — надіслати, Shift+Enter — новий рядок)"></textarea><button class="btn primary">Надіслати</button></form>`;
 this.chatMs=ms;this.chatAdmDrawPend(tid);this.chatLoadUrls(ms);
 const ta=C.querySelector("textarea");ta.value=draft;if(!silent)ta.focus({preventScroll:true});const M=$("#chatMsgs");M.scrollTop=M.scrollHeight;
 if(this.chatUnread(t)){const{error:e3}=await sb.from("chat_threads").update({admin_seen_at:t.last_customer_at}).eq("id",tid);if(!e3){t.admin_seen_at=t.last_customer_at;const it=L.querySelector(`[href$="${tid}"]`);it&&it.classList.remove("unread");if(b)b.textContent=th.filter(this.chatUnread).length||""}}},
});
document.addEventListener("change",e=>{if(e.target.matches&&e.target.matches("[data-chatadmfile]"))Admin.chatAdmPick(e.target)});
document.addEventListener("click",e=>{const rm=e.target.closest&&e.target.closest("[data-chatadmrm]");if(!rm)return;const tid=rm.closest("form").dataset.id,P=Admin.chatPend[tid]||[],x=P.splice(+rm.dataset.chatadmrm,1)[0];if(x&&x.thumb)URL.revokeObjectURL(x.thumb);Admin.chatAdmDrawPend(tid)});
document.addEventListener("paste",e=>{const f=e.target.closest&&e.target.closest('[data-form="chatreply"]'),fs=[...(e.clipboardData&&e.clipboardData.files||[])];if(f&&fs.length){e.preventDefault();Admin.chatAdmPick({files:fs,closest:()=>f,set value(v){}})}});
