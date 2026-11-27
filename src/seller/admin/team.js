/* ===== Seller Central · Команда: користувачі кабінету та їхні ролі =====
   Ролі (перевіряються і на сервері — public.admins.role, private.admin_role()):
   owner — усе; manager — усе, крім команди, налаштувань магазину, резервних копій і грошей (оплата, повернення коштів);
   warehouse — лише замовлення й повернення товарів.
   Запрошення: власник вводить email і роль → одноразове посилання (7 днів). Людина входить цим email (або спершу
   реєструється на сайті) і відкриває посилання → public.team_join() додає її до команди. */
Object.assign(Admin,{
ROLES:{owner:"Власник",manager:"Менеджер",warehouse:"Склад"},
ROLE_HELP:{owner:"усе, включно з командою, налаштуваннями та грошима",manager:"замовлення, повернення, чат, товари, категорії, відгуки, аналітика — без налаштувань магазину, команди й грошей",warehouse:"лише замовлення (підтвердити, відправити, трек-номер, пакувальний лист) і повернення товарів"},
role(){return Seller.role||"owner"},
isOwner(){return this.role()==="owner"},
canPage(k){const r=this.role();if(r==="owner")return true;if(r==="warehouse")return ["orders","order","returns"].includes(k);return !["team","settings","backup"].includes(k)},
noAccess(){return `<div class="empty"><b>Немає доступу</b>Цей розділ доступний іншій ролі. Ваша роль: ${esc(this.ROLES[this.role()]||this.role())}.</div>`},
joinUrl(code){return SITE_URL.replace(/\/?$/,"/")+"seller/#/join?code="+encodeURIComponent(code)},
team(){setTimeout(()=>this.fillTeam(),0);
 return `<div class="ahead"><div><h1>Команда</h1><p class="muted" style="margin:4px 0 0">Хто ще може входити в Seller Central і що їм дозволено.</p></div></div>
 <form class="panel teaminv" data-form="teaminv" novalidate><h2 style="margin-top:0">Запросити користувача</h2>
  <div class="teamrow"><input class="field" name="email" type="email" placeholder="email@example.com" maxlength="200" autocomplete="off" required aria-label="Email">
  <select class="field" name="role" aria-label="Роль">${Object.entries(this.ROLES).reverse().map(([k,v])=>`<option value="${k}" ${k==="manager"?"selected":""}>${v}</option>`).join("")}</select>
  <button class="btn primary">Створити запрошення</button></div>
  <div class="help" style="margin-top:8px">Ви отримаєте посилання — надішліть його людині. Вона входить у кабінет <b>саме цим email</b> (якщо акаунта ще немає — спершу реєструється на сайті через «Create account» і підтверджує email), відкриває посилання й налаштовує код із телефону (2FA). Посилання діє 7 днів і спрацьовує один раз.</div>
  <div id="teamLink"></div></form>
 <div class="panel"><h2 style="margin-top:0">Учасники</h2><div id="teamList"><p class="muted">Завантаження…</p></div></div>
 <div class="panel"><h2 style="margin-top:0">Ролі</h2><ul class="teamroles">${Object.entries(this.ROLES).map(([k,v])=>`<li><b>${v}</b> — ${this.ROLE_HELP[k]}</li>`).join("")}</ul><p class="help">Усі дії учасників записуються в «Журнал дій» з їхнім email.</p></div>`},
async fillTeam(){const box=$("#teamList");if(!box)return;const{data,error}=await sb.rpc("team_list");if(!$("#teamList"))return;
 if(error){box.innerHTML=`<div class="note">Не вдалося завантажити: ${esc(error.message)}</div>`;return}
 const dt=d=>d?new Date(d).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—",M=data.members||[],I=data.invites||[];
 box.innerHTML=`<div class="tablewrap"><table class="t teamtable"><thead><tr><th>Email</th><th>Роль</th><th>Додано</th><th>Останній вхід</th><th></th></tr></thead><tbody>
 ${M.map(m=>`<tr><td><b>${esc(m.email||"")}</b>${m.me?' <span class="tag">це ви</span>':""}</td>
  <td>${m.me?esc(this.ROLES[m.role]||m.role):`<select class="field teamrole" data-uid="${esc(m.user_id)}" data-old="${esc(m.role)}" aria-label="Роль ${esc(m.email||"")}">${Object.entries(this.ROLES).map(([k,v])=>`<option value="${k}" ${m.role===k?"selected":""}>${v}</option>`).join("")}</select>`}</td>
  <td class="small">${dt(m.added)}</td><td class="small">${dt(m.last_sign_in)}</td>
  <td>${m.me?"":`<button class="btn sm danger" data-tact="remove" data-uid="${esc(m.user_id)}" data-email="${esc(m.email||"")}">Забрати доступ</button>`}</td></tr>`).join("")}
 ${I.map(i=>`<tr class="teaminvrow"><td>${esc(i.email)} <span class="tag">запрошено</span></td><td>${esc(this.ROLES[i.role]||i.role)}</td><td class="small">${dt(i.created)}</td><td class="small muted">діє до ${dt(i.expires)}</td>
  <td><div class="acts"><button class="btn sm" data-tact="copy" data-code="${esc(i.code)}">📋 Посилання</button><button class="btn sm ghost" data-tact="cancel" data-code="${esc(i.code)}" data-email="${esc(i.email)}">Скасувати</button></div></td></tr>`).join("")}
 </tbody></table></div>`},
linkBox(inv){const url=this.joinUrl(inv.code),st=S.settings,body=`Hi,\n\nYou've been invited to the ${st.name} Seller Central team (${this.ROLES[inv.role]||inv.role}).\n\n1. Sign in with this email (${inv.email}). No account yet? Create one at ${SITE_URL}#/account and confirm your email.\n2. Open this link: ${url}\n3. Set up the 6-digit code from an authenticator app (Google Authenticator, Authy).\n\nThe link works once and expires in 7 days.`;
 return `<div class="okbox teamlink"><div><b>Запрошення для ${esc(inv.email)} (${esc(this.ROLES[inv.role])})</b> — надішліть це посилання:</div><input class="field" readonly value="${esc(url)}" onclick="this.select()" aria-label="Посилання-запрошення">
  <div class="acts"><button type="button" class="btn sm primary" data-tact="copy" data-code="${esc(inv.code)}">📋 Скопіювати</button><a class="btn sm" href="mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent("Invitation to "+st.name+" Seller Central")}&body=${encodeURIComponent(body)}">✉️ Надіслати листом</a></div></div>`},
async teamInvite(f){const email=f.email.value.trim().toLowerCase(),role=f.role.value;if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){f.email.focus();return toast("Вкажіть правильний email")}
 if(role==="owner"&&!confirm(`Роль «Власник» дає повний доступ, включно з командою та грошима. Запросити ${email} власником?`))return;
 const b=f.querySelector("button.primary");b.disabled=true;const{data,error}=await sb.rpc("team_invite",{p_email:email,p_role:role});b.disabled=false;
 if(error)return toast("⚠️ "+(/ALREADY_MEMBER/.test(error.message)?"Цей email уже в команді":/BAD_EMAIL/.test(error.message)?"Неправильний email":error.message));
 $("#teamLink").innerHTML=this.linkBox(data);f.email.value="";toast("Запрошення створено ✓");this.fillTeam()},
async teamAct(el){const a=el.dataset.tact;
 if(a==="copy"){const url=this.joinUrl(el.dataset.code);try{await navigator.clipboard.writeText(url);toast("Посилання скопійовано ✓")}catch(e){prompt("Скопіюйте посилання:",url)}return}
 if(a==="cancel"){if(!confirm(`Скасувати запрошення для ${el.dataset.email}? Посилання перестане працювати.`))return;const{error}=await sb.rpc("team_cancel_invite",{p_code:el.dataset.code});if(error)return toast("⚠️ "+error.message);toast("Запрошення скасовано");return this.fillTeam()}
 if(a==="remove"){if(!confirm(`Забрати доступ до кабінету в ${el.dataset.email}?\nАкаунт покупця на сайті залишиться, але в Seller Central людина більше не ввійде.`))return;el.disabled=true;
  const{error}=await sb.rpc("team_remove",{p_user:el.dataset.uid});el.disabled=false;if(error)return toast("⚠️ "+error.message);toast("Доступ забрано");return this.fillTeam()}},
async teamRole(sel){const v=sel.value,old=sel.dataset.old,em=sel.closest("tr").querySelector("b").textContent;
 if(!confirm(`Змінити роль ${em}: ${this.ROLES[old]} → ${this.ROLES[v]}?${v==="owner"?"\n\nВласник має повний доступ, включно з командою та грошима.":""}`)){sel.value=old;return}
 sel.disabled=true;const{error}=await sb.rpc("team_set_role",{p_user:sel.dataset.uid,p_role:v});sel.disabled=false;if(error){sel.value=old;return toast("⚠️ "+error.message)}sel.dataset.old=v;toast("Роль змінено ✓")},
});
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-tact]");if(b){e.preventDefault();Admin.teamAct(b)}});
document.addEventListener("change",e=>{if(e.target.classList&&e.target.classList.contains("teamrole"))Admin.teamRole(e.target)});
