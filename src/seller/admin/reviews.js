/* ===== Seller Central · Відгуки: модерація ===== */
Object.assign(Admin,{
async revBadge(){const{count}=await sb.from("reviews").select("id",{count:"exact",head:true}).eq("status","pending");const b=$("#revBadge");if(b)b.textContent=count||""},
/* ---- reviews moderation ---- */
reviews(q){const st=q.get("status")||"pending";setTimeout(()=>this.fillRevs(st),0);
 return `<div class="ahead"><h1>Відгуки</h1></div><p class="muted" style="margin-top:-8px">Покупці з акаунтом пишуть відгуки на сторінці товару. На сайті відгук з’являється лише після того, як ви його опублікуєте. Позначка «✓ Verified purchase» ставиться автоматично, якщо покупець замовляв цей товар.</p>
 <div class="acts" style="margin:14px 0">${[["pending","🆕 Нові"],["approved","✓ Опубліковані"],["rejected","✕ Відхилені"]].map(([k,l])=>`<a class="btn sm ${st===k?"primary":""}" href="#/admin/reviews?status=${k}">${l}</a>`).join("")}</div>
 <div id="revList"><p class="muted">Завантаження…</p></div>
 <p class="help">Правило FTC (США): не можна публікувати вигадані відгуки, писати відгуки від імені покупців чи приховувати лише негативні. Відхиляйте тільки спам, образи, особисті дані або відгуки не про товар.</p>`},
async fillRevs(st){const{data,error}=await sb.from("reviews").select("*").eq("status",st).order("created_at",{ascending:false}).limit(300);const box=$("#revList");if(!box)return;
 if(error){box.innerHTML=`<div class="note">${esc(error.message)}</div>`;return}
 if(!data.length){box.innerHTML=`<div class="empty"><b>Тут порожньо</b>${st==="pending"?"Нових відгуків немає.":"Немає відгуків із цим статусом."}</div>`;return}
 box.innerHTML=data.map(r=>{const p=prod(r.product_id);return `<div class="panel revadm"><div><span class="starsline">${"★".repeat(r.rating)}<span>${"★".repeat(5-r.rating)}</span></span> ${r.title?`<b>${esc(r.title)}</b>`:""}</div>
 <div class="small muted" style="margin:4px 0 8px">${esc(r.name)} · ${r.verified?"✓ покупку підтверджено":"покупку не підтверджено"} · ${new Date(r.created_at).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})} · товар: ${p?`<a class="textlink" href="${SITE_URL}#/product/${p.id}" target="_blank" rel="noopener">${esc(p.name)} ↗</a>`:esc(r.product_id)}</div>
 <p style="white-space:pre-line;margin:0 0 12px">${esc(r.body)}</p>
 <div class="acts">${st!=="approved"?`<button class="btn sm primary" data-act="a:revset" data-id="${r.id}" data-v="approved">✓ Опублікувати</button>`:`<button class="btn sm" data-act="a:revset" data-id="${r.id}" data-v="pending">Зняти з публікації</button>`}${st==="pending"?`<button class="btn sm" data-act="a:revset" data-id="${r.id}" data-v="rejected">✕ Відхилити</button>`:""}<button class="btn sm danger" data-act="a:revdel" data-id="${r.id}">Видалити</button></div></div>`}).join("")},
});
