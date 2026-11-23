"""Build the storefront (../index.html) and Seller Central (../seller/index.html) from the parts in this folder.
Run from this folder:  python3 build.py   (needs Python 3 and Node.js)"""
import os
import subprocess,json
css=open('style.css').read()+'.fav-inline.on svg{fill:var(--terra);stroke:var(--terra)}\n'
def js(files): return ''.join(open(f).read()+'\n' for f in files)
# snapshot for the storefront fallback (demo data with embedded photos)
snap=subprocess.run(["node","-e","const fs=require('fs');eval(fs.readFileSync('photos.js','utf8')+fs.readFileSync('demo.js','utf8'));process.stdout.write(JSON.stringify(demoState()))"],capture_output=True,text=True).stdout
import re as _re
_ph=json.loads(open('photos.js').read()[len('const PHOTO='):-2]);_inv={v:k for k,v in _ph.items()}
_d=json.loads(snap)
for p in _d['products']: p['images']=['photo:'+_inv[u] if u in _inv else u for u in p['images']]
snap=json.dumps(_d).replace('<','\\u003c')
body=open('body.html').read().replace('<script id="store-data" type="application/json">null</script>','<script id="store-data" type="application/json">'+snap+'</script>')
store=open('head.html').read()+'\n'+css+body+js(['i18n.js','photos.js','demo.js','account.js','app.js'])+'</script>\n</body></html>'
open('store.html','w').write(store)
seller=open('seller_head.html').read()+'\n'+css+open('seller_body.html').read()+js(['i18n.js','photos.js','demo.js','admin.js','account.js','seller.js','app.js'])+'</script>\n</body></html>'
open('seller.html','w').write(seller)
for f in ['store.html','seller.html']:
    r=subprocess.run(["node","-e","const s=require('fs').readFileSync('%s','utf8');const ms=[...s.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];new Function(ms[ms.length-1][1]);console.log('%s syntax ok',s.length)"%(f,f)],capture_output=True,text=True)
    print(r.stdout.strip() or r.stderr[:600])

import shutil
shutil.copy('store.html','../index.html');shutil.copy('seller.html','../seller/index.html')
os.remove('store.html');os.remove('seller.html')
print('Copied to ../index.html and ../seller/index.html')
