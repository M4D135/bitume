from pathlib import Path
from playwright.sync_api import sync_playwright
import json,subprocess,base64,hashlib,time
root=Path('/workspace/scratch/fee880a8de7f/bitume');out=Path(__file__).parent
chrome='/workspace/scratch/c89193d9c5e7/browser-qualification/chrome-headless-shell-linux64/chrome-headless-shell'
source=root/'dist/bitume.html'; css=(root/'src/style.css').read_text()
js='import {horlogeCapture} from '+json.dumps((root/'tools/controle-visuel.mjs').as_uri())+'; console.log(horlogeCapture(17017));'
clock=subprocess.check_output(['node','--input-type=module','-e',js],text=True)
cases=[('desktop-360x640',360,640,False,None),('touch-360x640',360,640,True,None),('touch-390x844',390,844,True,None),('touch-640x360',640,360,True,None),('desktop-960x540',960,540,False,None),('duo-cote-960x540',960,540,False,'cote'),('duo-haut-bas-960x540',960,540,False,'haut-bas')]
measure=r'''() => {
const rect=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
const shown=e=>e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0;
const textRect=e=>{let range=document.createRange();range.selectNodeContents(e);return rect(range)};
const intersects=(a,b)=>Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1;
let result={viewport:[innerWidth,innerHeight],tactile:document.body.classList.contains('tactile'),maxTouchPoints:navigator.maxTouchPoints,coarse:matchMedia('(pointer:coarse)').matches,huds:[],errors:[],cellOverhangs:[]};
for(let h of [document.querySelector('#hud'),document.querySelector('#hud2')].filter(shown)){
let region=rect(h),counters=[...h.querySelectorAll('.compteurs .case')].filter(shown).map(e=>({id:e.id,rect:rect(e),text:[...e.querySelectorAll('.etiquette,.grand b,.grand small,.nom-pneus b')].map(n=>({text:n.textContent,rect:textRect(n)}))}));
let chronos=[...h.querySelectorAll('.ligne-chrono')].filter(shown).map(e=>({rect:rect(e),text:e.textContent.trim(),texts:[...e.children].map(n=>({text:n.textContent,rect:textRect(n)}))}));
let pause=h.querySelector('#b-pause'),map=h.querySelector('#zone-carte');
let item={id:h.id,region,counters,chronos,pause:shown(pause)?rect(pause):null,map:shown(map)?rect(map):null};result.huds.push(item);
for(let c of counters){for(let t of c.text){if(t.rect.x<region.x-1||t.rect.right>region.right+1)result.errors.push(h.id+' counter text outside HUD: '+t.text);if(t.rect.x<c.rect.x-1||t.rect.right>c.rect.right+1)result.cellOverhangs.push({hud:h.id,text:t.text,left:Math.max(0,c.rect.x-t.rect.x),right:Math.max(0,t.rect.right-c.rect.right)})}}
for(let i=0;i<counters.length;i++)for(let j=i+1;j<counters.length;j++)for(let a of counters[i].text)for(let b of counters[j].text)if(intersects(a.rect,b.rect))result.errors.push(h.id+' counter text overlap: '+a.text+' / '+b.text);
for(let cr of chronos){for(let t of cr.texts){if(t.rect.x<region.x-1||t.rect.right>region.right+1)result.errors.push(h.id+' chrono text outside HUD: '+t.text)}for(let c of counters)if(intersects(cr.rect,c.rect))result.errors.push(h.id+' counter/chrono overlap');if(item.pause&&intersects(cr.rect,item.pause))result.errors.push(h.id+' chrono/pause overlap');if(item.map&&intersects(cr.rect,item.map))result.errors.push(h.id+' chrono/map overlap')}
for(let c of counters)if(item.pause&&intersects(c.rect,item.pause))result.errors.push(h.id+' counter/pause overlap');
}return result;
}'''
results=[];start=time.monotonic()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=chrome,headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--mute-audio'])
 try:
  for name,w,h,touch,duo in cases:
   print('CASE '+name,flush=True)
   ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=touch,has_touch=touch,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'} if touch else {}))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script(script=clock)
   page.goto(source.as_uri(),wait_until='load',timeout=60000)
   page.wait_for_function('!!globalThis.BITUME_JEU?.rendu',polling=100,timeout=60000)
   page.evaluate("css => { const style = [...document.querySelectorAll('style')].find(s => s.textContent.includes('BITUME : interface')); if (!style) throw new Error('Game stylesheet missing'); style.textContent = css; }", css)
   ref={'circuit':0,'graine':17017,'depart':2388,'vitesse':0,'pilote':False,'vue':'cockpit','qualite':'high','retro':'oui','meteo':'sec','decor':'enrichi'}
   if duo:ref.update({'mode':'duo','vue2':'cockpit','partage':duo})
   page.evaluate('o=>{BITUME_JEU.pauseAuto=false;return BITUME_JEU.reference(o)}',ref)
   for _ in range(3):page.evaluate('__BITUME_CAPTURE.avancer(1000/60)')
   cdp=ctx.new_cdp_session(page)
   normal=page.evaluate(measure)
   (out/(name+'.png')).write_bytes(base64.b64decode(cdp.send('Page.captureScreenshot',{'format':'png'})['data']))
   page.evaluate('''()=>{for(const h of document.querySelectorAll('#hud,#hud2')){h.querySelector('#h-pos').textContent='12';h.querySelector('#h-tour').textContent='99';h.querySelector('#h-tours').textContent='/99';h.querySelector('#h-pneus').textContent='Intermédiaires';h.querySelector('#h-sante').textContent='Service 12,3 s';h.querySelector('#c-sante').dataset.phase='service';h.querySelector('#h-actuel').textContent='9:59,999';h.querySelector('#h-meilleur').textContent='9:58,999';h.querySelector('#h-delta').textContent='+0:12,345'}}''')
   long=page.evaluate(measure)
   (out/(name+'-long.png')).write_bytes(base64.b64decode(cdp.send('Page.captureScreenshot',{'format':'png'})['data']))
   result={'case':name,'touch':touch,'duo':duo,'normal':normal,'longLabels':long,'pageErrors':errors}
   result['passed']=not errors and not normal['errors'] and not long['errors'] and normal['tactile']==touch
   results.append(result);print(json.dumps({'case':name,'passed':result['passed'],'normal':normal['errors'],'long':long['errors']},ensure_ascii=False),flush=True)
   ctx.close()
 finally:browser.close()
report={'cssSha256':hashlib.sha256(css.encode()).hexdigest(),'buildSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'injectedSourceCss':True,'buildRecreated':False,'chrome':chrome,'elapsedSeconds':time.monotonic()-start,'cases':results,'passed':all(r['passed'] for r in results),'limits':'Desktop Chrome emulates viewport, mobile and touch input. Screenshots validate layout only, not a physical phone or frame-rate performance.'}
(out/'hud-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('ALL PASSED '+str(report['passed']),flush=True)
