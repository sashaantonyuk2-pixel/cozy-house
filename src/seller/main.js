/* ===== Seller Central (seller/index.html): connection, router, events, boot ===== */
function sbInit(){
 try{if(!window.supabase||!window.supabase.createClient)return;
  sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{flowType:"pkce",persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage:window.sessionStorage,storageKey:"chv-seller-auth"}});
  sb.auth.onAuthStateChange(ev=>{setTimeout(()=>window.Seller&&Seller.onAuth(ev),0)});
 }catch(e){sb=null}}
function save(){if(window.Seller)Seller.queueSync()}
function load(){S=normalize(demoState())} /* real data is loaded by Seller after sign-in */
function chrome(){return Seller.chrome()}
function render(){const h=location.hash.slice(1)||"/";const[path,qs]=h.split("?");const q=new URLSearchParams(qs||"");Seller.render(path.split("/").filter(Boolean),q,path)}

document.addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
 if(a==="pw"){const i=el.parentNode.querySelector("input");i.type=i.type==="password"?"text":"password";el.textContent=i.type==="password"?"Show":"Hide"}
 else if(a.startsWith("a:"))Admin.click(a.slice(2),el,e)});
document.addEventListener("change",e=>{if(e.target.dataset.ach)Admin.change(e.target)});
document.addEventListener("submit",e=>{const f=e.target;const k=f.dataset.form;if(!k)return;e.preventDefault();
 if(k.startsWith("s:"))Seller.submit(k.slice(2),f);else Admin.submit(k,f)});
window.addEventListener("hashchange",render);

(async()=>{sbInit();load();document.documentElement.lang="uk";chrome();Seller.boot()})();
