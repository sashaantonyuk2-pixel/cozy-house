/* ===== Seller Central · Покупці ===== */
Object.assign(Admin,{
customers(){setTimeout(()=>this.fillCust(),0);
 return `<div class="ahead"><h1>Покупці</h1></div><div class="shopbar"><label class="search">${ICON.search}<input id="custSearch" placeholder="Пошук: ім’я, email, телефон, місто" autocomplete="off"></label></div><div id="custList"><p class="muted">Завантаження…</p></div>
 <p class="help">Покупці з акаунтом і гості, які замовляли (об’єднані за email або телефоном). Сума — без скасованих і повернених замовлень.</p>`},
custData:[],
async fillCust(){const{data,error}=await sb.rpc("seller_customers");const box=$("#custList");if(!box)return;if(error){box.innerHTML=`<div class="note">${esc(error.message)}</div>`;return}
 this.custData=data;this.renderCust();const i=$("#custSearch");if(i&&!i.dataset.ready){i.dataset.ready=1;i.addEventListener("input",()=>this.renderCust())}},
renderCust(){const box=$("#custList");if(!box)return;const term=(($("#custSearch")||{}).value||"").trim().toLowerCase();
 const d=this.custData.filter(c=>!term||[c.name,c.email,c.phone,c.city].some(v=>String(v||"").toLowerCase().includes(term)));
 const tot=d.reduce((s,c)=>s+(+c.spent||0),0);
 box.innerHTML=d.length?`<div class="stats" style="grid-template-columns:repeat(3,1fr)"><div class="stat"><b>${d.length}</b><span>покупців</span></div><div class="stat"><b>${d.filter(c=>c.has_account).length}</b><span>з акаунтом</span></div><div class="stat"><b>${d.filter(c=>+c.orders_count>1).length}</b><span>купували повторно</span></div></div>
 <div class="tablewrap"><table class="t"><thead><tr><th>Покупець</th><th>Контакти</th><th>Місто</th><th>Замовлень</th><th>Сума</th><th>Останнє замовлення</th><th></th></tr></thead><tbody>${d.map(c=>`<tr>
 <td><b>${esc(c.name||"—")}</b><br><small class="muted">${c.has_account?"акаунт"+(c.joined?" з "+new Date(c.joined).toLocaleDateString("uk-UA"):""):"гість"}</small></td>
 <td class="small">${c.email?esc(c.email)+"<br>":""}${c.phone?esc(c.phone):""}</td><td class="small">${esc(c.city||"")}</td>
 <td>${c.orders_count}${+c.orders_count>1?' <span class="ostat s-completed">постійний</span>':""}</td><td><b>${money(c.spent)}</b></td>
 <td class="small">${c.last_order?new Date(c.last_order).toLocaleDateString("uk-UA"):"—"}</td>
 <td>${+c.orders_count?`<button class="btn sm" data-act="a:custOrders" data-q="${esc(c.email||c.phone||c.name||"")}">Замовлення</button>`:""}</td></tr>`).join("")}</tbody></table></div><p class="help">Разом: ${money(tot)}</p>`:`<div class="empty"><b>${term?"Нічого не знайдено":"Покупців поки немає"}</b></div>`},
});
