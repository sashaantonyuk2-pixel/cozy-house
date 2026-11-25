/* ===== Seller Central · Категорії ===== */
Object.assign(Admin,{
/* ---- categories ---- */
categories(){return `<div class="ahead"><h1>Категорії</h1></div>
 <form class="panel" data-form="catadd" style="display:flex;gap:10px;margin-bottom:18px;padding:16px"><input class="field" name="name" placeholder="Назва нової категорії" required><button class="btn primary">Додати</button></form>
 <div class="tablewrap"><table class="t" style="min-width:600px"><thead><tr><th>Фото</th><th>Назва</th><th>Товарів</th><th></th></tr></thead><tbody>
 ${S.categories.map((c,i)=>`<tr><td><img src="${esc(catImg(c))}" alt=""></td><td><input class="field" value="${esc(c.name)}" data-ach="catname" data-id="${c.id}"></td><td>${S.products.filter(p=>p.cat===c.id).length}</td>
 <td><div class="acts"><button class="btn sm" data-act="a:catmv" data-i="${i}" data-d="-1" title="Вище">↑</button><button class="btn sm" data-act="a:catmv" data-i="${i}" data-d="1" title="Нижче">↓</button><label class="btn sm">Фото<input type="file" accept="image/*" hidden data-up="${c.id}"></label>${c.image?`<button class="btn sm" data-act="a:catimgdel" data-id="${c.id}">Скинути фото</button>`:""}<button class="btn sm danger" data-act="a:catdel" data-id="${c.id}">✕</button></div></td></tr>`).join("")}
 </tbody></table></div><p class="help">Якщо фото категорії не задано, береться фото першого товару з неї. Порядок тут = порядок на сайті.</p>`},
});
