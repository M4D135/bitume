#!/usr/bin/env node
// Node 22+, Chrome/Chromium avec WebGPU. Exerce le device et le shader du jeu construit.
// node tools/qualifier-visiere-webgpu.mjs --sortie /tmp/bitume-gouttes [--page dist/bitume.html] [--webgpu-logiciel]
// --trajectoires ajoute les 36 captures pleine définition et l'analyse indépendante des PNG (Python, NumPy et Pillow).
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parseArgs } from 'node:util';

const racine = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({options:{
  sortie:{type:'string'}, page:{type:'string'}, trajectoires:{type:'boolean'}, 'webgpu-logiciel':{type:'boolean'}
}});
if (!values.sortie) throw Error('Indiquer --sortie DOSSIER_NEUF.');
const executer = promisify(execFile);
const page = path.resolve(values.page || path.join(racine,'dist/bitume.html'));
const sortie = path.resolve(values.sortie);
const reference = JSON.parse(await readFile(path.join(racine,'verifications/fixtures/visiere-0283.json'),'utf8'));
const sha256 = contenu => createHash('sha256').update(contenu).digest('hex');
const empreinte = sha256(await readFile(page));
await mkdir(path.dirname(sortie),{recursive:true});
await mkdir(sortie);

// Cette fonction est exécutée dans la page par le harnais CDP commun. Seule la mire source
// et la lecture finale des pixels utilisent Canvas2D. Le rendu et la réduction utilisent WebGPU.
async function photographier(zones, trajectoires) {
  function toile(w,h) {
    const canvas=document.createElement('canvas');
    canvas.width=w; canvas.height=h; canvas.style.width=w+'px'; canvas.style.height=h+'px';
    document.body.append(canvas); return canvas;
  }
  const w=384,h=216,scene=toile(w,h),motif=scene.getContext('2d',{alpha:false});
  for(let x=0;x<w;x+=8) for(let y=0;y<h;y+=8) {
    motif.fillStyle='rgb('+[(x*3+y*2)%224+16,(y*7)%224+16,(x*13)%224+16].join(',')+')';
    motif.fillRect(x,y,8,8);
  }
  const {device,canvasFormat,adapter}=BITUME_JEU.rendu.gpu;
  const source=toile(w,h),context=source.getContext('webgpu');
  context.configure({device,format:canvasFormat,alphaMode:'opaque',
    usage:GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});
  const toileOptique=toile(w,h),O=BITUME.visiereOptique,vue=BITUME.vitre.creer(toileOptique,{graine:17,gpu:{device,canvasFormat,context}});
  const capture=toile(w,h),lecture=capture.getContext('2d',{willReadFrequently:true});
  const cas=[], erreurs=[], injecter=()=>device.queue.copyExternalImageToTexture({source:scene},{texture:context.getCurrentTexture()},[w,h]);
  const signaler=evt=>erreurs.push(evt.error.message);
  device.addEventListener('uncapturederror',signaler);device.pushErrorScope('validation');
  try {
    const validation=await vue.pipelines.appareil.module.getCompilationInfo();
    for(const message of validation.messages) if(message.type==='error') erreurs.push(message.message);
    for(const [nom,opt] of [['sec',{}],['pluie',{pluie:1}],['vitesse',{pluie:1,vitesse:70}],
      ['embruns',{embruns:1,vitesse:32}],['neige',{neige:1}],
      ['réduction',{pluie:.8,qualite:'medium',largeur:w/2,hauteur:h/2}],['légère',{pluie:1,qualite:'low'}]]) {
      BITUME.vitre.effacer(vue);
      const c={qualite:'high',actif:true,cockpit:true,largeur:w,hauteur:h,dpr:1,intensite:1,pluie:0,neige:0,embruns:0,vitesse:0,...opt};
      O.mettreAJour(vue,1/120,c);
      for(let i=0;i<240;i++) O.avancerEtat(vue.simulation,1/60,c);
      const copies=vue.stats.copiesScene, reductions=vue.stats.reductionsGPU;
      injecter(); BITUME.vitre.mettreAJour(vue,1/60,{...c,sourceScene:source});
      lecture.clearRect(0,0,w,h);lecture.drawImage(vue.canvas,0,0,w,h);
      const pixels=lecture.getImageData(0,0,w,h).data, moyennes=new Float64Array(8*4*4);
      let opaques=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const i=4*(y*w+x), zone=4*(Math.floor(y*4/h)*8+Math.floor(x*8/w)),a=pixels[i+3];
        if(a)opaques++;
        for(let k=0;k<3;k++)moyennes[zone+k]+=pixels[i+k]*a/255;
        moyennes[zone+3]+=a;
      }
      let ecartMax=0, ecartMoyen=0;
      for(let i=0;i<moyennes.length;i++){
        const ecart=Math.abs(moyennes[i]/(w*h/32)-zones[nom][i]);
        ecartMax=Math.max(ecart,ecartMax);ecartMoyen+=ecart/moyennes.length;
      }
      const overlay=capture.toDataURL();lecture.drawImage(scene,0,0);lecture.drawImage(vue.canvas,0,0,w,h);
      cas.push({nom,opaques,ecartMax,ecartMoyen,backend:vue.stats.backend,erreur:vue.stats.erreur,
        copies:vue.stats.copiesScene-copies,reductions:vue.stats.reductionsGPU-reductions,overlay,composite:capture.toDataURL()});
    }
    const suivis=[];
    if(trajectoires) {
      // Même simulation 120 Hz et même pipeline que le rendu en course. Pour identifier un motif
      // sur trois images on isole une génération via ses uniformes ; aucun déplacement n'est synthétisé.
      const surface=toile(960,540), optique=BITUME.vitre.creer(surface,{graine:4,gpu:{device,canvasFormat,context}});
      const c={qualite:'high',actif:true,cockpit:true,largeur:960,hauteur:540,dpr:1,intensite:1,pluie:1};
      const noms=['micro','perles-fines','perles-moyennes','perles','film'];
      try{
        for(let i=0;i<60;i++)O.avancerEtat(optique.simulation,1/60,c);
        injecter(); O.mettreAJour(optique,1/60,{...c,sourceScene:source});
        for(const cockpit of [true,false]) for(const vitesse of [0,300/3.6]) for(const couche of [1,2,3,4]){
          if(couche<3 && !vitesse)continue;
          const s=O.creerEtat({graine:4}), groupe='trajet-'+(cockpit?'cockpit':'poursuite')+'-'+(vitesse?300:0)+'-'+noms[couche];
          for(let image=1;image<=108;image++){
            O.avancerEtat(s,1/120,{...c,largeur:1280,hauteur:720,cockpit,vitesse});
            if(![12,48,108].includes(image))continue;
            const m=optique.mots;
            m.set(s.uniformes);m[0]=1.7;m[1]=m[2]=m[3]=0;m[8]=optique.largeur;m[9]=optique.hauteur;
            m.set(s.fluxUniformes,12);m.set(s.transportUniformes,24);m.set(s.histoireUniformes,72);m.set(s.phaseUniformes,120);
            for(let j=0;j<12;j++)if(j!==couche*2)m[24+j*4+3]=0;
            optique.entiers.fill(0,516,660);optique.entiers[672]=0;
            device.queue.writeBuffer(optique.uniformeGPU,0,m);
            const cmd=device.createCommandEncoder();
            const p=cmd.beginRenderPass({colorAttachments:[{view:optique.contexte.getCurrentTexture().createView(),
              loadOp:'clear',storeOp:'store',clearValue:[0,0,0,0]}]});
            p.setPipeline(optique.pipelines.composer);p.setBindGroup(0,optique.groupeComposition);p.draw(3);p.end();device.queue.submit([cmd.finish()]);
            suivis.push({nom:groupe+'-'+image,suivi:{groupe,image,cockpit,vitesse,couche},overlay:surface.toDataURL()});
          }
        }
      }finally{BITUME.vitre.liberer(optique);surface.remove();}
    }
    await device.queue.onSubmittedWorkDone();
    const validationGPU=await device.popErrorScope();if(validationGPU)erreurs.push(validationGPU.message);
    return {cas,suivis,erreurs,interdits:window.contextesWebGLDemandes,adapter:adapter.info?.description||adapter.info?.vendor||null};
  }finally{
    device.removeEventListener('uncapturederror',signaler);BITUME.vitre.liberer(vue);context.unconfigure();
    for(const canvas of [toileOptique,source,scene,capture])canvas.remove();
  }
}
const temporaire=await mkdtemp(path.join(tmpdir(),'bitume-qualification-optique-'));
try {
  const script=path.join(temporaire,'mires.js');
  await writeFile(script,'('+photographier.toString()+')('+JSON.stringify(reference.zones)+','+!!values.trajectoires+')');
  const drapeaux=values['webgpu-logiciel']?['--webgpu-logiciel']:[];
  const captureBrute=path.join(temporaire,'captures.json'), destination=await open(captureBrute,'w');
  try {
    const chrome=spawn(process.execPath,[path.join(racine,'tools/page-essai.mjs'),page,script,'--sans-webgl','--dpr','1',...drapeaux],
      {stdio:['ignore',destination.fd,'inherit']});
    await new Promise((ok,ko)=>{chrome.once('error',ko);chrome.once('close',ok);});
  }finally{await destination.close();}
  const {valeur,erreurs,fatal}=JSON.parse(await readFile(captureBrute,'utf8'));assert(valeur,fatal);
  const png=(url,nom)=>writeFile(path.join(sortie,nom+'.png'),Buffer.from(url.split(',')[1],'base64'));
  for(const image of valeur.cas){
    await png(image.overlay,image.nom+'-overlay');await png(image.composite,image.nom);
    delete image.overlay;delete image.composite;
  }
  for(const image of valeur.suivis){await png(image.overlay,image.nom+'-overlay');delete image.overlay;}
  let trajectoires=null;
  if(values.trajectoires){
    await writeFile(path.join(sortie,'etats.json'),JSON.stringify(valeur.suivis,null,2));
    const recu=path.join(sortie,'trajectoires-png.json');
    try{await executer(process.env.PYTHON || 'python3',[path.join(racine,'tools/qualification/visiere-png.py'),'--racine',sortie,'--sortie',recu]);}
    catch(e){if(!await readFile(recu).catch(()=>null))throw e;}
    const mesures=JSON.parse(await readFile(recu));trajectoires={reussi:mesures.reussi,...mesures.synthese};
  }
  // Les seuils sur des moyennes spatiales tolèrent les arrondis flottants des différents
  // backends. Le sec, les nombres de copies et l'exécution sans contexte interdit sont exacts.
  const reussi=!erreurs.length&&!valeur.erreurs.length&&!valeur.interdits.length && trajectoires?.reussi!==false &&
    valeur.cas.every(c=> c.backend==='webgpu'&&!c.erreur&&c.ecartMax<6&&c.ecartMoyen<1.5&&
      (c.nom==='sec'?c.opaques===0:c.opaques>300)&&c.copies===Number(!['sec','légère'].includes(c.nom))&&c.reductions===Number(c.nom==='réduction'));
  const rapport={page,sha256:empreinte,reference:reference.sourceSHA256,adapter:valeur.adapter,erreurs:[...erreurs,...valeur.erreurs],
    contextesInterdits:valeur.interdits,cas:valeur.cas,trajectoires,reussi};
  await writeFile(path.join(sortie,'rapport.json'),JSON.stringify(rapport,null,2)+'\n');
  console.log(JSON.stringify({sortie,reussi,cas:rapport.cas.length,trajectoires}));
  if(!reussi)process.exitCode=1;
}finally{await rm(temporaire,{recursive:true,force:true});}
