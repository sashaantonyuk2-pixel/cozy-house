/* ===== Seller Central · Категорії і підкатегорії (два рівні) ===== */
Object.assign(Admin,{
/* <option>s for a category <select>: top-level categories, their subcategories indented under them */
catOptions(sel){return topCats().map(c=>`<option value="${c.id}" ${sel===c.id?"selected":""}>${esc(c.name)}</option>`+subCats(c.id).map(s=>`<option value="${s.id}" ${sel===s.id?"selected":""}>   └ ${esc(s.name)}</option>`).join("")).join("")},
catRow(c,sub,i,n){const cnt=S.products.filter(p=>inCat(p,c.id)).length,subs=sub?[]:subCats(c.id);
 return `<tr class="${sub?"catsub":"cattop"}"><td><img src="${esc(catImg(c))}" alt=""></td>
 <td><div class="catname">${sub?`<span class="catbranch" aria-hidden="true">└</span>`:""}<input class="field" value="${esc(c.name)}" maxlength="80" data-ach="catname" data-id="${c.id}" aria-label="${sub?"Назва підкатегорії":"Назва категорії"}"></div>${!sub&&subs.length?`<small class="muted">${subs.length} ${subs.length===1?"підкатегорія":subs.length<5?"підкатегорії":"підкатегорій"}</small>`:""}</td>
 <td>${cnt}</td>
 <td><div class="acts">${sub?"":`<button class="btn sm catplus" data-act="a:catsub" data-id="${c.id}">+ Підкатегорія</button>`}<button class="btn sm" data-act="a:catmv" data-id="${c.id}" data-d="-1" title="Вище" ${i===0?"disabled":""}>↑</button><button class="btn sm" data-act="a:catmv" data-id="${c.id}" data-d="1" title="Нижче" ${i===n-1?"disabled":""}>↓</button><label class="btn sm">Фото<input type="file" accept="image/*" hidden data-up="${c.id}"></label>${c.image?`<button class="btn sm" data-act="a:catimgdel" data-id="${c.id}">Скинути фото</button>`:""}<button class="btn sm danger" data-act="a:catdel" data-id="${c.id}" title="Видалити">✕</button></div></td></tr>`},
categories(){const T=topCats();return `<div class="ahead"><h1>Категорії</h1></div>
 <form class="panel" data-form="catadd" style="display:flex;gap:10px;margin-bottom:18px;padding:16px"><input class="field" name="name" placeholder="Назва нової категорії" maxlength="80" required><button class="btn primary">Додати</button></form>
 <div class="tablewrap"><table class="t cattable" style="min-width:640px"><thead><tr><th>Фото</th><th>Назва</th><th>Товарів</th><th></th></tr></thead><tbody>
 ${T.map((c,i)=>{const subs=subCats(c.id);return this.catRow(c,false,i,T.length)+subs.map((s,j)=>this.catRow(s,true,j,subs.length)).join("")+
  `<tr class="catsub catnew" data-p="${c.id}" hidden><td></td><td colspan="3"><form class="catsubform" data-form="catadd"><span class="catbranch" aria-hidden="true">└</span><input type="hidden" name="parent" value="${c.id}"><input class="field" name="name" placeholder="Назва підкатегорії в «${esc(c.name)}»" maxlength="80" required><button class="btn primary sm">Додати</button><button type="button" class="btn sm" data-act="a:catsub" data-id="${c.id}">Скасувати</button></form></td></tr>`}).join("")}
 </tbody></table></div><p class="help">Порядок тут = порядок на сайті (підкатегорії рухаються в межах своєї категорії). Число товарів у категорії враховує її підкатегорії. Якщо фото не задано, береться фото першого товару.</p>`},
});
