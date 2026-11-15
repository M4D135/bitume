// Contrat réel jeu/module : secondes, pause, cadence, projection et coût borné en Canvas2D.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const fichier=process.argv[2]||fileURLToPath(new URL('../src/jeu.js',import.meta.url));
const source=readFileSync(fichier,'utf8');
await import(pathToFileURL(resolve(dirname(fichier),'meteo.js')));
const B=globalThis.BITUME,M=B.meteo;
let controles=0;const check=(v,msg)=>{assert.ok(v,msg);controles++};
const signature='  function majMeteo(S, dt) { return B.meteo.avancer(S, dt); }';
check(source.includes(signature),'jeu délègue la météo au module');
const appel=source.match(/const meteo = majMeteo\(S,\s*\w+\);/g);
check(appel?.length===1,'un raccord météo');
const image=new Function('B','S','dureeImage','dtImage',signature+'\n'+appel[0]+'return meteo;');
const fin=[];
for(const hz of [20,30,60,120,144]){
 const S={};for(let i=0;i<200*hz;i++)image(B,S,1000/hz,1/hz);
 check(Math.abs(S.meteo.t-200)<1e-8,`${hz}Hz horloge 200s`);
 check(S.meteo.phase==='pluie'&&Math.abs(S.meteo.tp-10)<1e-8,`${hz}Hz phase/reliquat`);
 const avant=JSON.stringify(S.meteo);for(let i=0;i<40;i++)image(B,S,250,0);
 check(JSON.stringify(S.meteo)===avant,`${hz}Hz pause exacte`);
 for(let i=0;i<hz;i++)image(B,S,1000/hz,1/hz);
 check(Math.abs(S.meteo.t-201)<1e-8,`${hz}Hz reprise`);fin.push(S.meteo);
}
for(const m of fin)for(const k of ['pluie','nuage','eclair','ventX','ventZ'])check(Math.abs(m[k]-fin[0][k])<1e-8,`cadence ${k}`);
for(const m of fin)check(Math.abs(m.mouille-fin[0].mouille)<.0001,'mouillage stable malgré clamps');
const orages=[];
for(const hz of [30,60,120]){const S={};for(let i=0;i<61.3*hz;i++)M.avancer(S,1/hz);check(S.meteo.eclair>0&&S.meteo.eclair<1,'éclair orage visible puis décroissant');orages.push(S.meteo)}
for(const m of orages)for(const k of ['eclair','prochainEclair'])check(Math.abs(m[k]-orages[0][k])<1e-8,`orage stable ${k}`);
const old={meteo:{t:1,phase:'clair',tp:1,pluie:0,nuage:.12,eclair:0,prochainEclair:0}};
M.avancer(old,1/60);check(Number.isFinite(old.meteo.mouille)&&old.meteo.phase==='clair','ancien état accepté');
const after=JSON.stringify(old);for(const dt of [0,-1,NaN,Infinity])M.avancer(old,dt);check(JSON.stringify(old)===after,'pas invalide ignoré');
function surface(w=1280,h=720){
 const traces=[],styles=[];let point=null,strokes=0;
 const ctx={setTransform(){},clearRect(){traces.length=styles.length=0;strokes=0},beginPath(){},moveTo(x,y){point=[x,y]},lineTo(x,y){traces.push([...point,x,y])},stroke(){strokes++;styles.push([this.lineWidth,this.strokeStyle])}};
 const canvas={clientWidth:w,clientHeight:h,width:0,height:0,getContext:()=>ctx};
 return {canvas,ctx,traces,styles,get strokes(){return strokes}};
}
const results=[];
for(const hz of [30,60,120]){
 const s=surface(),p=M.creerPluie(s.canvas);let m={t:12,pluie:1,nuage:1,eclair:0};
 const cam={pos:[0,1.2,0],yaw:0,pitch:-.02,roll:.02,fov:60};p.dessiner(m,cam,1/hz,{cockpit:true,dpr:2});
 for(let i=1;i<=hz;i++){m.t=12+i/hz;cam.pos=[i/hz*2,1.2,-i/hz*20];p.dessiner(m,cam,1/hz,{cockpit:true,dpr:2})}
 check(p.stats.visibles>8&&p.stats.visibles<840,`${hz}Hz gouttes projetées`);
 check(s.strokes<=3&&s.strokes>0,'au plus 3 lots');
 check(s.canvas.width===1920&&s.canvas.height===1080,'DPR borné1.5 et taille CSS respectée');
 check(s.traces.every(v=>v.every(Number.isFinite)&&Math.hypot(v[2]-v[0],v[3]-v[1])<=18.0001),'traits finis et longueur bornée');
 check(s.styles.every(v=>v[0]<=1&&Number(v[1].match(/,([^,]+)\)$/)[1])<=.28),'traits fins et translucides');
 const before=JSON.stringify(s.traces);p.dessiner(m,cam,0,{cockpit:true,dpr:2});check(JSON.stringify(s.traces)===before,'pause garde projection/traînée exactes');
 results.push(s.traces.map(v=>v.map(n=>Math.round(n*1000)/1000)));
 cam.yaw=.7;p.dessiner(m,cam,0,{cockpit:true});check(JSON.stringify(s.traces)!==before,'orientation caméra change projection');
 cam.pos=[10000,2000,-10000];p.dessiner(m,cam,1/hz,{cockpit:true});check(s.traces.every(v=>v.every(Number.isFinite)),'coupe/teleport sans traits infinis');
 m.pluie=0;p.dessiner(m,cam,1/hz);check(p.stats.visibles===0&&s.traces.length===0&&s.strokes===0,'temps sec transparent sans traits');
 s.canvas.clientWidth=390;s.canvas.clientHeight=844;m.pluie=1;p.dessiner(m,cam,1/hz,{dpr:3});check(s.canvas.width===585&&s.canvas.height===1266,'portrait resize correct');
}
assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],results[2]);controles+=2;
const a=M.ambiance({pluie:1,nuage:1,eclair:1,mouille:.8,ventX:2,ventZ:.3});
check(a.pluie===.72&&a.nuage===.86&&a.eclair===.3&&a.mouille===.8,'contrat ambiance borné et mouillage pour renderer');
check(source.includes('dessinerMeteo(S, dtImage, cam, vue);'),'overlay reçoit secondes et caméra effectivement rendue');
check(source.includes('weather: B.meteo.ambiance(meteo)'),'ambiance raccordée au rendu');
console.log(`météo : ${controles} contrôles horloge, pause, projection, profondeur, paramètres et cadence tenus`);
