/* ===== Seller Central · Повернення (заявки покупців з фото / відео) =====
   requested → approved / rejected → received (stock goes back) → refunded */
Object.assign(Admin,{
RR:{better_price:"Краща ціна",poor_condition:"Товар у поганому стані",defective:"Бракований товар",not_as_expected:"Товарний вигляд (не як на фото)"},
RST:{requested:"Нова заявка",approved:"Схвалено",rejected:"Відхилено",received:"Товар отримано",refunded:"Кошти повернено"},
retData:[],
async retBadge(){const{count}=await sb.from("return_requests").select("id",{count:"exact",head:true}).eq("status","requested");const b=$("#retBadge");if(b)b.textContent=count||""},
returns(q){const st=q.get("status")||"requested";setTimeout(()=>this.fillReturns(st),0);
 const chips=[["requested","🆕 Нові"],["approved","✓ Схвалені"],["received","📦 Отримані"],["refunded","💳 Кошти повернено"],["rejected","Відхилені"],["all","Усі"]];
 return `<div class="ahead"><h1>Повернення</h1><button class="btn sm" data-act="a:reloadReturns">↻ Оновити</button></div>
 <div class="chips">${chips.map(([k,v])=>`<a class="chip ${st===k?"on":""}" href="#/admin/returns${k==="requested"?"":"?status="+k}">${v}</a>`).join("")}</div>
 <div class="note" style="margin-bottom:14px">Брак або товар у поганому стані — повернення безкоштовне (ви надсилаєте покупцю оплачену етикетку). Краща ціна або «не як на фото» — доставку повернення оплачує покупець. Строк — ${parseInt(S.settings.returnDays)||14} днів від доставки.</div>
 <div id="retList"><p class="muted">Завантаження…</p></div>`},
async fillReturns(st){const box=$("#retList");if(!box)return;
 let qq=sb.from("return_requests").select("*,orders(id,order_no,customer,items,subtotal,shipping,tax,total,status,payment_status,paid_amount,refund_amount)").order("created_at",{ascending:false}).limit(200);
 if(st!=="all")qq=qq.eq("status",st);
 const{data,error}=await qq;if(!$("#retList"))return;if(error){box.innerHTML=`<div class="note">Не вдалося завантажити: ${esc(error.message)}</div>`;return}
 this.retData=data||[];this.retBadge();
 if(!this.retData.length){box.innerHTML=`<div class="empty"><b>Тут порожньо</b>${st==="requested"?"Нових заявок на повернення немає.":"Немає заявок з цим статусом."}</div>`;return}
 const paths=[...new Set(this.retData.flatMap(r=>r.media||[]))],U={};
 if(paths.length){const{data:sg}=await sb.storage.from("return-media").createSignedUrls(paths,3600);(sg||[]).forEach(x=>{if(x.signedUrl)U[x.path]=x.signedUrl})}
 box.innerHTML=this.retData.map(r=>this.retCard(r,U)).join("")},
retRefund(r){const o=r.orders||{},items=r.items||[],its=items.reduce((s,i)=>s+(+i.price||0)*(+i.qty||0),0),sub=+o.subtotal||its||1;
 const full=this.retFull(r),tax=Math.round((+o.tax||0)*Math.min(1,its/sub)*100)/100,ship=r.free_return&&full?+o.shipping||0:0;
 return{its,tax,ship,total:Math.round((its+tax+ship)*100)/100}},
retFull(r){const o=r.orders||{},oi=o.items||[];return oi.length>0&&oi.every((x,k)=>{const it=(r.items||[]).find(i=>+i.i===k);return it&&+it.qty>=+x.qty})},
retCard(r,U){const o=r.orders||{},c=o.customer||{},R=this.retRefund(r),dt=x=>new Date(x).toLocaleString("uk-UA",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
 const media=(r.media||[]).map(p=>{const u=U[p];if(!u)return `<span class="muted small">файл недоступний</span>`;return /\.(mp4|mov|webm|m4v)$/i.test(p)?`<video src="${esc(u)}" controls preload="metadata"></video>`:`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Фото від покупця" loading="lazy"></a>`}).join("");
 const act=r.status==="requested"?`<textarea class="field" id="rnote-${r.id}" placeholder="Коментар для покупця (необов’язково) — буде видно в його кабінеті" maxlength="2000">${esc(r.seller_note||"")}</textarea>
  <div class="retacts"><button class="btn primary sm" data-act="a:retSet" data-id="${r.id}" data-v="approved">✓ Схвалити</button><button class="btn sm" data-act="a:retSet" data-id="${r.id}" data-v="rejected">✕ Відхилити</button></div>`
  :r.status==="approved"?`<div class="retacts"><button class="btn primary sm" data-act="a:retSet" data-id="${r.id}" data-v="received">📦 Товар отримано</button><span class="help">${this.retFull(r)?"Замовлення отримає статус «Повернене», залишок товару повернеться на склад.":"Часткове повернення: залишок повернених товарів додасться на склад."}</span></div>`
  :r.status==="received"?`<div class="retacts"><a class="btn sm" href="#/admin/order/${o.id}">💳 Повернути кошти на сторінці замовлення</a><button class="btn primary sm" data-act="a:retSet" data-id="${r.id}" data-v="refunded">Позначити: кошти повернено</button></div>`:"";
 return `<div class="panel retcard"><div class="retcard-h"><div><a href="#/admin/order/${o.id}"><b>${esc(o.order_no||"")}</b></a> <span class="muted small">· заявка ${dt(r.created_at)}</span><br><span class="small">${esc(c.name||"")} · ${esc(c.email||"")}</span></div><span class="ostat s-${r.status==="rejected"?"cancelled":r.status==="requested"?"new":"completed"}">${this.RST[r.status]||r.status}</span></div>
 <div class="retgrid"><div><div class="small"><b>Причина:</b> ${esc(this.RR[r.reason]||r.reason)} <span class="paypill ${r.free_return?"p-paid":"p-unpaid"}">${r.free_return?"доставка повернення — за наш рахунок":"доставку оплачує покупець"}</span></div>
  ${r.details?`<p class="small" style="margin:8px 0;white-space:pre-wrap">${esc(r.details)}</p>`:""}
  <div class="small" style="margin-top:8px"><b>Товари:</b>${(r.items||[]).map(i=>`<div class="row"><span>${esc(i.name)}${i.opt?` <span class="muted">(${esc(optStr(i.opt))})</span>`:""}${i.sku?` <span class="muted">· ${esc(i.sku)}</span>`:""} × ${i.qty}</span><span>${money((+i.price||0)*(+i.qty||0))}</span></div>`).join("")}</div>
  <div class="small muted" style="margin-top:6px">Орієнтовна сума повернення: <b>${money(R.total)}</b> (товари ${money(R.its)} + податок ${money(R.tax)}${R.ship?" + доставка "+money(R.ship):""})</div>
  ${r.seller_note&&r.status!=="requested"?`<p class="small" style="margin:8px 0 0"><b>Ваш коментар:</b> ${esc(r.seller_note)}</p>`:""}</div>
  <div class="retmedia">${media||'<span class="muted small">Без фото</span>'}</div></div>
 ${act}${c.email?`<div class="retmail">✉️ Лист покупцю: ${r.status==="requested"?"":""}<a class="textlink" href="${esc(this.retMail(r,"approved"))}">схвалено</a> · <a class="textlink" href="${esc(this.retMail(r,"rejected"))}">відмова</a> · <a class="textlink" href="${esc(this.retMail(r,"refunded"))}">кошти повернено</a></div>`:""}</div>`},
retMail(r,kind){const o=r.orders||{},c=o.customer||{},st=S.settings,first=String(c.name||"").split(" ")[0]||"there",R=this.retRefund(r),note=r.seller_note||(($("#rnote-"+r.id)||{}).value||"");
 const items=(r.items||[]).map(i=>`- ${i.name} × ${i.qty}`).join("\n"),addr=String(st.address||"").trim();
 const T={approved:[`Your return for order ${o.order_no} is approved`,`Hi ${first},\n\nGood news — your return for order ${o.order_no} is approved:\n${items}\n\n`+(r.free_return?`Since the item was ${r.reason==="defective"?"defective":"not in good condition"}, the return is free. We'll send you a prepaid return label in a separate email shortly.`:`Please ship the item(s) to:\n${addr||"[return address]"}\n\nReturn shipping is paid by you. Please keep your tracking number.`)+`\n\nPlease pack the items in their original packaging with all tags and parts. Once we receive and check them, we'll refund ${money(R.total)} to your original payment method within 5 business days.${note?"\n\n"+note:""}\n\nThank you,\n${st.name}`],
  rejected:[`About your return request for order ${o.order_no}`,`Hi ${first},\n\nThank you for your request. Unfortunately we can't accept the return for order ${o.order_no}${note?":\n\n"+note:"."}\n\nIf you have any questions, just reply to this email.\n\nThank you,\n${st.name}`],
  refunded:[`Your refund for order ${o.order_no}`,`Hi ${first},\n\nWe've received your return and issued a refund of ${money(R.total)} to your original payment method. It can take 5–10 business days to appear on your statement.\n\nThank you,\n${st.name}`]}[kind];
 return `mailto:${c.email}?subject=${encodeURIComponent(T[0])}&body=${encodeURIComponent(T[1])}`},
async retSet(id,v,el){const r=this.retData.find(x=>x.id===+id);if(!r)return;const note=($("#rnote-"+id)||{}).value;
 if(v==="rejected"&&!String(note||"").trim()&&!confirm("Відхилити без коментаря? Покупець побачить лише «заявку відхилено»."))return;
 el.disabled=true;const patch={status:v};if(note!==undefined)patch.seller_note=String(note).trim()||null;
 const{error}=await sb.from("return_requests").update(patch).eq("id",+id);
 if(error){el.disabled=false;return toast("⚠️ "+error.message)}
 if(v==="received"){const o=r.orders||{};
  if(this.retFull(r)){const{error:e2}=await sb.from("orders").update({status:"returned",return_reason:(this.RR[r.reason]||"Інше")+(r.details?": "+r.details.slice(0,200):"")}).eq("id",o.id);toast(e2?"⚠️ Статус замовлення не змінено: "+e2.message:"Отримано ✓ · замовлення «Повернене», товар повернувся на склад");if(!e2&&Seller.refresh)Seller.refresh()}
  else{(r.items||[]).forEach(i=>{const p=prod(i.id);if(p)p.stock=(+p.stock||0)+(+i.qty||0)});save();toast("Отримано ✓ · повернені товари додано на склад")}}
 else toast(v==="approved"?"Схвалено ✓ — надішліть покупцю лист з інструкцією":v==="rejected"?"Заявку відхилено":"Збережено ✓");
 this.fillReturns(new URLSearchParams(location.hash.split("?")[1]||"").get("status")||"requested")},
});
