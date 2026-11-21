#!/usr/bin/env node
// Inspection de forme uniquement : fallback FERRO livré, scène commune au banc pilote.
// node tools/captures-carrosserie.mjs --sortie /tmp/carrosserie --reference <sha>
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenePilote } from './captures-pilote-module.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),o={};
for(let i=0;i<args.length;i+=2){
 if(!['--sortie','--reference'].includes(args[i])||!args[i+1])throw new Error('Option invalide');
 o[args[i].slice(2)]=args[i+1];
}
if(!o.sortie||o.reference&&!/^[a-f0-9]{7,40}$/.test(o.reference))throw new Error('--sortie requis ; référence SHA facultative');
const sortie=path.resolve(o.sortie);if(existsSync(path.join(sortie,'rapport.json')))throw new Error('Dossier déjà utilisé');
const require=createRequire(import.meta.url);
let createCanvas;try{({createCanvas}=require('@napi-rs/canvas'));}
catch{({createCanvas}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas')));}
const modules=['moteur/renderer.js','carene.js','main.js','humain-donnees.js','humain-corps.js','ferro/vehicle-dynamics.js','pneus.js','usure-pneus.js','chaussee.js','conduite.js','cockpit-matieres.js','voiture.js'];
const scenarios=[
 {id:'trois-quarts',poste:[4.7,3.0,-4.2],cible:[0,.45,0]},
 {id:'profil',poste:[0,1.5,-6.8],cible:[0,.4,0]},
 {id:'dessus',poste:[-.001,7.5,0],cible:[0,0,0]},
 {id:'avant',poste:[5.3,1.8,0],cible:[.4,.32,0]},
 {id:'lod-moyen',poste:[4.7,3.0,-4.2],cible:[0,.45,0],detail:'moyen'},
 {id:'lod-simple',poste:[4.7,3.0,-4.2],cible:[0,.45,0],detail:'simple'}
].map(s=>({detail:'complet',fov:40,...s}));
const sha=b=>createHash('sha256').update(b).digest('hex');
const rapport={format:'bitume-carrosserie-module-1',reference:o.reference||null,variantes:{},
 limites:['Fallback Canvas2D de FERRO ; ne qualifie ni WebGL2, ni shaders, ni reflets.',
 'Module isolé et poses prescrites ; aucun jeu.js, HUD, seuil de LOD ou FPS matériel qualifié.',
 'Cotes et train roulant historiques conservés ; proportions visuelles, pas relevé constructeur.',
 'Le poste de la base reste visible dans ces témoins ; ce lot ne modifie aucune pièce du poste.']};
for(const [nom,ref] of (o.reference?[['reference',o.reference],['candidat',null]]:[['candidat',null]])){
 const folder=path.join(sortie,nom);mkdirSync(folder,{recursive:true});
 const natif=createCanvas(960,640);
 const canvas={getContext:t=>t==='2d'?natif.getContext('2d'):null,clientWidth:960,clientHeight:640,
  get width(){return natif.width;},set width(v){natif.width=v;},get height(){return natif.height;},set height(v){natif.height=v;}};
 const c=vm.createContext({console,document:{querySelector:()=>canvas},navigator:{userAgent:'Node '+process.version+' / @napi-rs/canvas'},innerWidth:960,innerHeight:640,devicePixelRatio:1});
 vm.runInContext('globalThis.window=globalThis',c);
 const preuves={empreintes:{},images:[]};
 for(const f of modules){
  const b=ref?execFileSync('git',['show',ref+':src/'+f],{cwd:root,maxBuffer:8*1024*1024}):readFileSync(path.join(root,'src',f));
  preuves.empreintes['src/'+f]=sha(b);vm.runInContext(b.toString('utf8'),c,{filename:f});
 }
 vm.runInContext('('+scenePilote.toString()+')(true)',c);
 preuves.environnement=c.__PILOTE.environnement;
 for(const s of scenarios){
  const mesure=c.__PILOTE.dessiner(s),png=natif.toBuffer('image/png'),fichier=nom+'/'+s.id+'.png';
  writeFileSync(path.join(sortie,fichier),png);preuves.images.push({...mesure,fichier,sha256:sha(png),octets:png.length});
 }
 rapport.variantes[nom]=preuves;
}
rapport.outil=sha(readFileSync(fileURLToPath(import.meta.url)));
writeFileSync(path.join(sortie,'rapport.json'),JSON.stringify(rapport,null,2)+'\n');
console.log(JSON.stringify({sortie,variantes:Object.keys(rapport.variantes),images:Object.values(rapport.variantes).reduce((s,v)=>s+v.images.length,0)}));
