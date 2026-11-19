// Export exact BITUME render poses and FERRO procedural geometry for the EGL inspection.
// Usage: node pilote-poses.mjs REPO OUTPUT_JSON
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
const [repo, output] = process.argv.slice(2);
const c = vm.createContext({console}); c.window = c;
const sources = {};
for (const name of ['moteur/renderer.js', 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js', 'pneus.js', 'voiture.js']) {
  const source = fs.readFileSync(path.join(repo, 'src', name), 'utf8');
  sources[name] = crypto.createHash('sha256').update(source).digest('hex');
  vm.runInContext(name === 'moteur/renderer.js' ? source.replace('globalThis.FRender=', 'globalThis.poseShaders={VERT,FRAG,FX_VERT,FX_FRAG};globalThis.FRender=') : source, c, {filename:name});
}
const F = c.FRender, V = c.BITUME.voiture, mod = V.modele({couleur:[.78,.08,.045], seconde:[.92,.91,.85], casque:[.95,.92,.82], combinaison:[.70,.73,.77], numero:27});
const ev = {p:[0,0,0],cap:0,tangage:0,roulis:0,roule:0,braquage:0,v:0,rebond:[0,0,0,0],pilote:{volant:0,rapport:4,rapportAvant:3,passage:1}};
const eye=[1.25,1.65,1.35], target=[.09,.70,0], cases=[], used=new Set();
const phases=[['volant-centre',0,1],['main-au-levier',0,.45],['retour-du-levier',0,.82],['virage-droite',.85,1]];
for(const [name,volant,passage] of phases) for(const detail of ['complet','moyen','simple']) {
  Object.assign(ev.pilote,{volant,passage}); const out=[]; V.poser(mod,ev,out,{detail});
  const objects=[];
  for(const o of out) {
    const copy={...o,outdoor:true}, packed=o.fx?F.shared.packEffects([copy],null,eye):F.shared.pack([copy],null,true);
    objects.push({shape:o.shape,fx:!!o.fx,values:Array.from(packed.values)}); used.add(o.shape);
  }
  cases.push({name:name+'-'+detail,phase:name,detail,pose:{...ev.pilote},objects,
    joints:Array.from(mod.objetsRendu.pilote.articulations),head:Array.from(mod.objetsRendu.pilote.tete)});
}
if(process.argv.includes('--grid')) for(const volant of [-1,-.5,0,.5,1]) for(let rapport=1;rapport<=6;rapport++) for(let phase=0;phase<=20;phase++) {
  Object.assign(ev.pilote,{volant,rapport,rapportAvant:rapport-1,passage:phase/20});const out=[];V.poser(mod,ev,out);
  const objects=out.filter(o=>o.shape==='bitume-jante'||o.shape==='bitume-branches').map(o=>({shape:o.shape,fx:false,values:Array.from(F.shared.pack([{...o,outdoor:true}],null,true).values)}));
  cases.push({name:`grille-${volant}-${rapport}-${phase}`,detail:'complet',capture:false,pose:{...ev.pilote},objects,
    joints:Array.from(mod.objetsRendu.pilote.articulations),head:Array.from(mod.objetsRendu.pilote.tete)});
}
const geometry=F.shared.geometry(0), shapes={};
for(const name of used){const range=geometry.ranges[name], vertices=[];
  if(!range)throw new Error('Missing real FERRO geometry: '+name);
  for(let i=range.offset/4;i<range.offset/4+range.count;i++) {
    const at=geometry.indices[i]*6; for(let k=0;k<6;k++)vertices.push(geometry.vertices[at+k]);
  }
  shapes[name]=vertices;
}
fs.writeFileSync(output,JSON.stringify({scope:'Exact BITUME pose and procedural meshes; real FERRO colour/effect GLSL; fixed inspection camera, no browser/postprocessing or hardware FPS.',sources,shaders:c.poseShaders,eye,target,fov:30,shapes,cases}));
console.log(JSON.stringify({cases:cases.length,shapes:Object.keys(shapes).length,triangles:Object.values(shapes).reduce((n,v)=>n+v.length/18,0),bytes:fs.statSync(output).size,sources}));
