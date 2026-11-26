"""Build the storefront (../index.html) and Seller Central (../seller/index.html).
   shared/ = code and styles used by both, store/ = storefront only, seller/ = Seller Central only.
Run from this folder:  python3 build.py   (needs Python 3 and Node.js — or, on a Mac, the built-in JavaScriptCore)"""
import os
import subprocess,json,shutil,tempfile
JSC='/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
def run_js(code):
    """Run JS that may use readFile(path) and print(x). Uses Node.js if installed, otherwise macOS JavaScriptCore."""
    if shutil.which('node'):
        pre="const fs=require('fs');const readFile=f=>fs.readFileSync(f,'utf8');const print=x=>process.stdout.write(String(x)+'\\n');"
        return subprocess.run(['node','-e',pre+code],capture_output=True,text=True)
    if not os.path.exists(JSC): raise SystemExit('Need Node.js (or macOS JavaScriptCore) to build')
    with tempfile.NamedTemporaryFile('w',suffix='.js',delete=False,encoding='utf-8') as f: f.write(code);fn=f.name
    try: return subprocess.run([JSC,fn],capture_output=True,text=True)
    finally: os.remove(fn)
css=open('shared/style.css').read()+'.fav-inline.on svg{fill:var(--terra);stroke:var(--terra)}\n'
def js(files): return ''.join(open(f).read()+'\n' for f in files)
# snapshot for the storefront fallback (demo data with embedded photos)
_r=run_js("eval(readFile('shared/photos.js')+readFile('shared/demo.js'));print(JSON.stringify(demoState()))")
if _r.returncode or not _r.stdout.strip(): raise SystemExit('snapshot failed: '+_r.stderr[:600])
snap=_r.stdout.strip()
import re as _re
_pr=run_js("eval(readFile('shared/photos.js')+';print(JSON.stringify(PHOTO))')")
if _pr.returncode or not _pr.stdout.strip(): raise SystemExit('photos failed: '+_pr.stderr[:300])
_ph=json.loads(_pr.stdout.strip());_inv={v:k for k,v in _ph.items()}
_d=json.loads(snap)
for p in _d['products']: p['images']=['photo:'+_inv[u] if u in _inv else u for u in p['images']]
snap=json.dumps(_d).replace('<','\\u003c')
body=open('store/body.html').read().replace('<script id="store-data" type="application/json">null</script>','<script id="store-data" type="application/json">'+snap+'</script>')
# Seller Central sections (core first: it creates the Admin object the others extend)
ADMIN=['core','dashboard','analytics','orders','products','suppliers','excel','categories','attrs','customers','support','returns','reviews','seo','settings','system']
SHARED=['shared/i18n.js','shared/photos.js','shared/demo.js','shared/supabase.js','shared/core.js']
store=open('store/head.html').read()+'\n'+css+body+js(SHARED+['store/track.js','store/auth.js','store/account.js','store/orders.js','store/chat.js','store/store.js'])+'</script>\n</body></html>'
open('store.html','w').write(store)
seller=open('seller/head.html').read()+'\n'+css+open('seller/body.html').read()+js(SHARED+['seller/admin/'+f+'.js' for f in ADMIN]+['seller/seller.js','seller/main.js'])+'</script>\n</body></html>'
open('seller.html','w').write(seller)
for f in ['store.html','seller.html']:
    r=run_js("const s=readFile('%s');const ms=[...s.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];new Function(ms[ms.length-1][1]);print('%s syntax ok '+s.length)"%(f,f))
    print(r.stdout.strip() or r.stderr[:600])
    if 'syntax ok' not in r.stdout: raise SystemExit('Syntax error — nothing copied')

shutil.copy('store.html','../index.html');shutil.copy('seller.html','../seller/index.html')
os.remove('store.html');os.remove('seller.html')
print('Copied to ../index.html and ../seller/index.html')
