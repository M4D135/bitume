#!/usr/bin/env node
import { environnementWebGPU, argumentsWebGPU } from './diagnostic-webgpu.mjs';
// Banc navigateur de BITUME : ouvre la page construite dans Chrome sans interface, conduit le jeu par le protocole
// DevTools, et rend un rapport JSON (banc, volet de mesures, erreurs de console, capture).
//
//   node tools/banc-navigateur.mjs --url file:///chemin/dist/bitume.html --duree 20 --qualite high --circuit 0
//
// Le rapport distingue ce qui est réellement mesuré de ce qui ne l'est pas : sans timestamp-query,
// le temps GPU reste N/D, et un rendu logiciel (SwiftShader) ne qualifie pas les performances d'un GPU réel.
// Aucune dépendance : Node 22 et plus suffisent (WebSocket global).

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { controlerJeu, controlerStand } from './smoke-jeu.mjs';
import { controlerCachePanorama } from './controle-cache-panorama.mjs';
import { controlerCacheLRU } from './qualification/cache-lru.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const url = args.url;
if (!url) { console.error('usage : banc-navigateur.mjs --url <page> [--mode banc|course|crash|stand|smoke|cache-panorama] [--duree 20] [--qualite high] [--circuit 0] [--graine 17017] [--meteo sec|pluie] [--partie solo|duo] [--decor reference|enrichi] [--chauffe 1] [--taille 1390,1295] [--overlay oui] [--capture fichier.png] [--chrome binaire] [--attendre 20000] [--detection oui] [--angle native|swiftshader]'); process.exit(2); }
const mode = args.mode || 'banc';
const duree = Number(args.duree ?? 20), qualite = args.qualite || 'high', circuit = Number(args.circuit ?? 0);
const chauffe = Number(args.chauffe ?? 1), attendre = Number(args.attendre ?? 20000);
const taille = (args.taille || '1390,1295').split(/[x,]/).map(Number);
if (taille.length !== 2 || taille.some(n => !Number.isInteger(n) || n < 240 || n > 4096)) {
  console.error('--taille attend largeur,hauteur (240..4096 pixels)'); process.exit(2);
}
const referenceJeu = { graine: Number(args.graine ?? 17017), circuit, qualite, mode: args.partie || 'solo',
  meteo: args.meteo || 'sec', vue: args.vue || 'cockpit', vue2: args.vue2 || 'cockpit', partage: args.partage || 'haut-bas',
  retro: args.retro || 'oui', decor: args.decor || 'enrichi', depart: args.depart === 'tunnel' ? 'tunnel' : Number(args.depart ?? 280), vitesse: Number(args.vitesse ?? 75) };
const optionsBanc = { ...referenceJeu, duree, chauffe };
const chrome = args.chrome || process.env.CHROME || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const profil = mkdtempSync(path.join(tmpdir(), 'bitume-chrome-'));
// Sous 20 % de batterie, Chrome bride l'affichage à 30 images par seconde (économie d'énergie) : coupé dans ce profil
// jetable, pour mesurer la machine et non son alimentation.
writeFileSync(path.join(profil, 'Local State'), JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } }));
const requetes = new Map(); let suivant = 1; let ws = null;
const evenements = { console: [], avertissements: [], exceptions: [] };

function envoyer(methode, params = {}) {
  return new Promise((resoudre, rejeter) => {
    const id = suivant++;
    const minuteur = setTimeout(() => { requetes.delete(id); rejeter(new Error('DevTools expiré : ' + methode)); }, Math.max(attendre, (duree + chauffe + 10) * 1000));
    requetes.set(id, { resoudre, rejeter, minuteur });
    ws.send(JSON.stringify({ id, method: methode, params }));
  });
}
async function attendreJusqua(teste, delai, etiquette) {
  const echeance = Date.now() + delai;
  while (!await teste()) {
    if (Date.now() > echeance) throw new Error('expiré : ' + etiquette);
    await new Promise(r => setTimeout(r, 120));
  }
}
async function evaluer(expression) {
  const r = await envoyer('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, allowUnsafeEvalBlocklist: true });
  if (r.exceptionDetails) throw new Error('page : ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
}

const chromeArgs = [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox',
  '--remote-debugging-port=0', '--user-data-dir=' + profil,
  '--window-size=' + taille.join(','), '--hide-scrollbars'
];
// --angle native laisse Chrome choisir le backend matériel de la machine ; le défaut est explicitement logiciel.
chromeArgs.push(...argumentsWebGPU(args.angle || 'swiftshader'));
chromeArgs.push('about:blank');
// groupe détaché : le navigateur lance des processus enfants qu'un simple kill du père laisserait tourner,
// et un rendu logiciel à 1000 % de CPU qui traîne fausse toutes les mesures suivantes
const processus = spawn(chrome, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'], detached: true });
let stderr = '', lancementErreur = null;
processus.stderr.on('data', d => { stderr += d.toString(); });
processus.on('error', e => { lancementErreur = e; });

const dormir = ms => new Promise(r => setTimeout(r, ms));
const images = n => evaluer(`new Promise(resolve => { let restant = ${n}; function prochain() {
  if (--restant <= 0) resolve(true); else requestAnimationFrame(prochain);
} requestAnimationFrame(prochain); })`);
async function lirePort() {
  const f = path.join(profil, 'DevToolsActivePort');
  for (let i = 0; i < 200; i++) {
    if (lancementErreur) throw lancementErreur;
    try { const l = readFileSync(f, 'utf8').split('\n'); if (l[0] && l[1]) return { port: l[0], cible: l[1] }; } catch (e) { /* pas encore écrit */ }
    await dormir(50);
  }
  throw new Error('port DevTools introuvable\n' + stderr.slice(-800));
}

const rapport = { url, parametres: { mode, duree, chauffe, taille, angle: args.angle || 'swiftshader', referenceJeu },
  environnement: {}, build: null, banc: null, mesures: null, erreurs: [], avertissements: [], limites: [] };
let code = 0;
try {
  if (url.startsWith('file:')) {
    const html = readFileSync(fileURLToPath(url));
    rapport.build = { sha256: createHash('sha256').update(html).digest('hex'), octets: html.length };
  }
  const { port } = await lirePort();
  const liste = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const cible = liste.find(t => t.type === 'page');
  if (!cible) throw new Error('aucune cible de page : ' + stderr.slice(-400));
  ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((resoudre, rejeter) => { ws.onopen = resoudre; ws.onerror = () => rejeter(new Error('connexion DevTools refusée')); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && requetes.has(m.id)) { const q = requetes.get(m.id); requetes.delete(m.id); clearTimeout(q.minuteur); m.error ? q.rejeter(new Error(m.error.message)) : q.resoudre(m.result); return; }
    if (m.method === 'Runtime.consoleAPICalled') {
      const t = (m.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(' ');
      (m.params.type === 'error' ? evenements.console : evenements.avertissements).push({ type: m.params.type, texte: String(t).slice(0, 400) });
    } else if (m.method === 'Runtime.exceptionThrown') {
      evenements.exceptions.push({ texte: String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 600) });
    }
  };
  await envoyer('Runtime.enable'); await envoyer('Page.enable');
  await envoyer('Emulation.setDeviceMetricsOverride', { width: taille[0], height: taille[1], deviceScaleFactor: 1, mobile: false });
  await envoyer('Page.navigate', { url });
  await attendreJusqua(() => evaluer('!!(window.BITUME && window.BITUME_JEU && window.BITUME_JEU.rendu)'), attendre, 'le jeu ne démarre pas');
  // Premier lancement d'un profil neuf : la détection graphique tient le renderer et masque les écrans. Un banc lancé
  // pendant qu'elle tourne était interrompu au bout de deux secondes. On la passe comme le bouton « Passer », puis
  // on attend l'écran titre (--detection oui la laisse aller au bout).
  await attendreJusqua(() => evaluer(`(() => { const a = document.getElementById('autodetection');
    if (a && !a.hidden) { ${args.detection === 'oui' ? '' : "document.getElementById('detection-annuler').click();"} return false; }
    return window.BITUME_JEU.ecran === 'titre'; })()`), Math.max(attendre, 30000), 'écran titre jamais atteint');

  rapport.environnement = await evaluer(`(() => { const r = BITUME_JEU.rendu, vue = (${environnementWebGPU.toString()})(r); return { ...vue, version: document.querySelector('.version-jeu')?.textContent || null, gpuModeste: BITUME_JEU.gpuModeste, rendu: vue.gpu, nonMasque: vue.gpu, chronometrageGpu: vue.chronoGpu, resolution: [r.gpu.context.canvas.width,r.gpu.context.canvas.height], fenetre: [innerWidth,innerHeight,devicePixelRatio], visible:!document.hidden, signature:!!document.querySelector('.signature'), liensSignature:document.querySelectorAll('.marque a').length }; })()`);
  rapport.titre = await evaluer(`(() => { const t = document.getElementById('titre'); return { visible: !t.hidden,
    marque: (document.querySelector('.marque h1') || {}).textContent, signature: (document.querySelector('.signature') || {}).textContent || null }; })()`);

  // Le banc promet aussi les sections CPU et les coûts de chaque vue : les activer même sans demande
  // explicite d'overlay, sinon la capture finale serait un rapport vide alors que le chronomètre a tourné.
  if (mode === 'banc' || args.overlay === 'oui') await evaluer('BITUME_JEU.mesures = true; true');
  await evaluer('BITUME_JEU.pauseAuto = false; true');
  if (mode === 'prairie') {
    // Vue rasante reproduisible sur une vraie surface herbeuse, sans superposition du cockpit.
    await evaluer(`BITUME_JEU.reference(${JSON.stringify({...referenceJeu, vue:'poursuite', vegetation:'ultra', retro:'non'})}); true`);
    rapport.pointPrairie = await evaluer(`(() => {
      const {c,decor} = BITUME_JEU.scene, sonde={}, habitat={};
      for(let i=0;i<c.n;i+=3) for(const d of [-14,14,-22,22,-36,36]){
        const x=c.x[i]-Math.sin(c.cap[i])*d,z=c.z[i]+Math.cos(c.cap[i])*d;
        if(decor.ecologie.echantillonner(x,z,habitat).herbe<.72 || !decor.surfaceHerbe(x,z,sonde)) continue;
        const cam={pos:[x,sonde.y+.85,z],yaw:c.cap[i]+Math.PI/2,pitch:-.21,fov:56};
        BITUME_JEU.camera=()=>cam; return {x,z,d,habitat:habitat.herbe};
      } throw Error('Prairie introuvable'); })()`);
    await images(60);
    rapport.prairie = await evaluer('BITUME_JEU.scene.prairies[0]?.mesure');
    if (!(rapport.prairie?.candidats > 0 && rapport.prairie.candidats < 196608)) throw new Error('Prairie ultra absente ou non filtrée');
  } else if (args.mode === 'course') {
    // une séance réelle (démo sur le circuit choisi), avancée en simulation jusqu à l endroit voulu, puis quelques
    // secondes d images rendues : c est là que les lampes du tunnel et les rétroviseurs sont réellement dessinés
    await evaluer(`BITUME_JEU.reference(${JSON.stringify(referenceJeu)}); true`);
    if (args.avancer) await evaluer(`BITUME_JEU.avancer(${Number(args.avancer)}, true); true`);
    await evaluer('BITUME_JEU.mesures = true; true');
    await dormir(Number(args.secondes || 6) * 1000);
    rapport.seance = await evaluer(`(() => { const S = BITUME_JEU.session; if (!S) return null;
      const k = S.suivie || 0, v = S.course.voitures[k];
      return { ecran: BITUME_JEU.ecran, type: S.type, circuit: BITUME_JEU.CATALOGUE[S.i].nom, suivie: k, s: +v.etat.s.toFixed(1),
        v: +v.etat.v.toFixed(1), vue: S.vue, dansTunnel: BITUME.circuit.dansTunnel(S.course.c, v.etat.s, 0),
        lampes: (S.lampesTunnel && S.lampesTunnel.p) ? Array.from(S.lampesTunnel.p).filter(x => x > 0).length : 0,
        sommeLampes: (S.lampesTunnel && S.lampesTunnel.p) ? +Array.from(S.lampesTunnel.p).reduce((a, x) => a + x, 0).toFixed(2) : 0,
        lumiere: +(S.lumiere || 1).toFixed(3), refletsEcran: !!S.refletsEcran,
        statsIa: S.course.statsIa, engagees: S.course.voitures.filter(x => x.ia.cible >= 0).length }; })()`);
  } else if (args.camera) {
    // caméra d'essai placée à une abscisse voulue : c'est la caméra, et non la voiture, qui décide des lampes, de
    // l'adaptation de l'œil et de l'abri de la pluie. Le banc ne peut pas viser un endroit précis, si.
    await evaluer(`BITUME_JEU.reference(${JSON.stringify(referenceJeu)}); true`);
    await evaluer(`BITUME_JEU.reglages.vue = 'cockpit'; BITUME_JEU.camera = () => { const c = BITUME_JEU.session.course.c,
      e = BITUME.circuit.echantillon(c, ${Number(args.camera)}); return { pos: [e.x, e.y + 1.4, e.z], yaw: e.cap + Math.PI / 2, pitch: 0, fov: 60 }; }; true`);
    await evaluer('BITUME_JEU.mesures = true; true');
    await dormir(Number(args.secondes || 6) * 1000);
    rapport.seance = await evaluer(`(() => { const S = BITUME_JEU.session; if (!S) return null;
      const P = S.lampesTunnel && S.lampesTunnel.p ? Array.from(S.lampesTunnel.p) : [];
      return { ecran: BITUME_JEU.ecran, type: S.type, vue: S.vue, abscisse: ${Number(args.camera)},
        dansTunnel: BITUME.circuit.dansTunnel(S.course.c, ${Number(args.camera)}, 0),
        lampesAllumees: P.filter(x => x > 0).length, sommeLampes: +P.reduce((a, x) => a + x, 0).toFixed(2),
        lumiere: +(S.lumiere || 1).toFixed(3), refletsEcran: !!S.refletsEcran,
        statsIa: S.course.statsIa, engagees: S.course.voitures.filter(x => x.ia.cible >= 0).length }; })()`);
  } else if (mode === 'crash') {
    rapport.etapes = [];
    // gros choc réel : les pièces détachées doivent naître, être budgétées, et rouler avec de vrais corps PhysX
    await evaluer(`window.__banc = BITUME_JEU.banc(${JSON.stringify(optionsBanc)}); true`);
    await dormir(Number(args.attente || 4) * 1000);
    rapport.avantCasse = await evaluer('window.FPhysX ? Object.assign({ present: true }, window.FPhysX.status()) : { present: false }');
    rapport.etapes.push(await evaluer(`(() => { const S = BITUME_JEU.session; if (!S) return 'sans seance';
      // le chemin réel d'un gros choc : la conduite produit les événements de dégâts, les effets les consomment,
      // exactement comme dans la boucle d'image du jeu
      const v = S.course.voitures[0], ev = BITUME.conduite.subirChoc(v.etat, 45, { cote: 1, front: true });
      for (const e of ev) e.id = v.id;
      BITUME.traces.pas(S.fx, S.course, S.cour, S.suivie || 0, 0, ev);
      return ev.map(e => e.type).join(',') || 'aucun evenement'; })()`));
    await dormir(2500);
    rapport.casse = await evaluer(`(() => { const S = BITUME_JEU.session; if (!S) return null; const fx = S.fx, m = fx.monde;
      const d = fx.debris.filter(x => x.actif);
      return { debris: BITUME.traces.compter(fx).debris, pool: BITUME.traces.DEBRIS, budget: BITUME.traces.PIECES_PAR_VOITURE,
        piecesVoiture0: fx.pieces[0], roues: d.filter(x => x.objet.shape === 'cylinder').length,
        corps: m ? m._bodies.size : 0, dalles: m ? m._statics.length : 0, repos: d.filter(x => !x.corps && x.repos > 0).length,
        casse: !!(S.course.voitures[0].etat.degats && S.course.voitures[0].etat.degats.casse),
        trainee: +(S.course.voitures[0].etat.degats ? S.course.voitures[0].etat.degats.trainee : 1).toFixed(4),
        physx: window.FPhysX ? window.FPhysX.status() : null }; })()`);
    await evaluer('window.__banc');
    // la séance qui finit doit rendre son monde : une nouvelle séance ne doit pas en empiler un second
    await evaluer(`BITUME_JEU.demo(${circuit}); true`);
    await dormir(2500);
    rapport.apresSeance = await evaluer(`(() => { const S = BITUME_JEU.session;
      return { mondeCourant: !!(S && S.fx && S.fx.monde), mondes: window.FPhysX ? window.FPhysX.status().worlds : null }; })()`);
  } else if (mode === 'cache-relief') {
    rapport.cacheRelief=[];
    for(let k=0;k<2;k++){
      if(k){
        await evaluer('window.__anciennePage=true');
        await envoyer('Page.reload',{ignoreCache:true});
        await attendreJusqua(()=>evaluer('!window.__anciennePage && window.BITUME_JEU?.ecran==="titre"').catch(()=>false),attendre,'rechargement du cache relief');
      }
      const essai=await evaluer(`(async()=>{
        const r=await BITUME_JEU.preparer({type:'course',circuit:3,conditions:{saison:'ete',meteo:'soleil',moment:'jour'}});
        const mesure=r.cacheRelief;
        if(!mesure)throw Error(r.erreur||'Cache relief absent');
        const fin=performance.now()+12000;
        while(mesure.ecriture===null && performance.now()<fin)await new Promise(ok=>setTimeout(ok,50));
        const grille=BITUME_JEU.scene.decor.maillageSol.H;
        return {mesure,empreinte:BITUME.cache.checksum(grille.buffer),sommet:grille.length};
      })()`);
      rapport.cacheRelief.push(essai);
    }
    const [a,b]=rapport.cacheRelief;
    if(!a.mesure.ecriture || b.mesure.source!=='indexeddb' || a.empreinte!==b.empreinte || a.sommet!==b.sommet)
      throw Error('Relief non reproduit : '+JSON.stringify(rapport.cacheRelief));
  } else if (mode === 'cache-lru') {
    rapport.cacheLRU = await evaluer(`(${controlerCacheLRU.toString()})()`);
  } else if (mode === 'endurance-larche') {
    // Enregistrer les nouvelles images principales (pas seulement les callbacks rAF).
    const compteur = readFileSync(new URL('../docs/reprise/rapports/LARCHE-ENDURANCE-2026-11-22/Compteur-de-rendus.js',import.meta.url),'utf8');
    await evaluer(`BITUME_JEU.reference({...${JSON.stringify(referenceJeu)},circuit:BITUME_JEU.CATALOGUE.findIndex(c=>c.id==='larche'),depart:0,meteo:'pluie',qualite:'high',vue:'cockpit',retro:'oui'}); true`);
    await evaluer(compteur);
    let dernierKm=-1, maxi=-1, progres=Date.now();
    for(;;) {
      await dormir(5000);
      const etat=await evaluer('recuDescente.etat()');
      if(etat.kmRoute!==null && etat.kmRoute>maxi+.015){maxi=etat.kmRoute;progres=Date.now();}
      const km=Math.floor(etat.kmRoute ?? -1);
      if(km>dernierKm && args.sortie){
        const precedent=km>0?await evaluer(`recuDescente.troncon(${km-1})`):null;
        (rapport.kilometres ||= []).push({etat,precedent});
        writeFileSync(args.sortie+'.progress.json',JSON.stringify(rapport.kilometres)); dernierKm=km;
      }
      if(etat.fin || Date.now()-progres>90000){
        rapport.endurance=await evaluer('recuDescente.fin()');
        if(!etat.fin?.termine || etat.pertes || etat.erreurs) throw new Error('Descente incomplète ou conditions perdues : '+JSON.stringify(etat));
        break;
      }
    }
  } else if (mode === 'cache-panorama') {
    rapport.cachePanorama = await controlerCachePanorama(evaluer, envoyer, attendre);
  } else if (mode === 'stand') {
    Object.assign(rapport, await controlerStand(evaluer, images, referenceJeu));
    rapport.limites.push('Stand contrôlé par avancement explicite au pas fixe : aucun FPS de ce parcours ne qualifie le temps réel.');
  } else if (mode === 'smoke') {
    rapport.smoke = { controles: [], limites: [] };
    await controlerJeu({ evaluer, envoyer, images, dormir, cible: cible.id }, referenceJeu, rapport.smoke);
    rapport.limites.push('Parcours fonctionnel avec sauts de simulation : ne pas utiliser ses FPS comme mesure de performance.');
  } else {
    // Le banc restitue les menus avant de résoudre sa promesse. Relever les mesures dans cette microtâche :
    // un second appel CDP laisserait entre-temps une image de vitrine contaminer la fenêtre CPU/GPU.
    const releve = await evaluer(`(() => {
      const longues=[], journal=${args.profil === 'oui'} && PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')
        ? new PerformanceObserver(liste=>longues.push(...liste.getEntries().map(e=>e.toJSON()))) : null;
      journal?.observe({type:'long-animation-frame'});
      const appel=performance.now(), p = BITUME_JEU.banc(${JSON.stringify(optionsBanc)}), pret=performance.now(), S = BITUME_JEU.session, debutSimulation = S.course.horloge;
      const debutImages=[];
      if(journal)requestAnimationFrame(function debut(t){debutImages.push([t,performance.now()]);if(debutImages.length<4)requestAnimationFrame(debut);});
      const scene = BITUME_JEU.scene;
      return p.then(banc => {const longuesImages=journal?[...longues,...journal.takeRecords().map(e=>e.toJSON())].sort((a,b)=>b.duration-a.duration).slice(0,8):null;journal?.disconnect();return { banc, ...(journal?{longues:longuesImages,appel,pret,debutImages}:{}), mesures: BITUME_JEU.mesures, finBanc: {
        prairies: scene.prairies?.map(v => v?.mesure),
        terrain: scene.decor.nappes.filter(n=>n.surfaceType==='terrain').reduce((s,n)=>{
          s.triangles+=n.indices.length/3; s.herbier+=n.herbeTriangles?.length || 0; s.horizon+=Number(!!n.horizon); return s;
        },{triangles:0,herbier:0,horizon:0}),
        phase: S.course.phase, simulationEcoulee: S.course.horloge-debutSimulation,
        joueurs: S.locaux.map(id => { const e=S.course.voitures[id].etat; return { id, s:e.s, d:e.d, v:e.v }; }),
        visible: !document.hidden, imagePrincipale: banc.image
      } };});
    })()`);
    Object.assign(rapport, releve);
    rapport.mesuresPortee = {
      intervalles: 'Fenêtre chronométrée du banc après chauffe : p50/p95/pire dans banc, en millisecondes réelles.',
      cpu: 'Fenêtre des 240 images les plus récentes, pouvant inclure la chauffe si moins de 240 images ont été rendues.',
      vues: 'drawCalls/triangles : moyenne par rendu depuis le départ ; champs ParImage : fenêtre des 240 images récentes.',
      gpu: 'Moyenne des trois derniers draws complets du moteur principal ; pas le total par image avec les rétroviseurs.',
      simulation: 'simulationEcoulee inclut la chauffe ; vérifier le trajet final, la boucle bride les longs intervalles à 0,1 s.'
    };
  }
  if (!rapport.mesures) rapport.mesures = await evaluer('JSON.parse(JSON.stringify(BITUME_JEU.mesures))');
  rapport.etatCourse = await evaluer(`(() => { const S = BITUME_JEU.session; if (!S) return null; const c = S.course;
    return { ecran: BITUME_JEU.ecran, phase: c && c.phase, voitures: c && c.voitures.length, horloge: c && +c.horloge.toFixed(2) }; })()`);
  if (args.capture) {
    const s = await envoyer('Page.captureScreenshot', { format: 'png' });
    writeFileSync(args.capture, Buffer.from(s.data, 'base64'));
    rapport.capture = path.resolve(args.capture);
  }
  rapport.erreurs = evenements.console.filter(e => e.type === 'error').concat(evenements.exceptions);
  rapport.avertissements = evenements.avertissements;
  if (!rapport.environnement.chronometrageGpu) rapport.limites.push('Fonction timestamp-query absente : le temps GPU n est pas mesurable ici, le volet affiche N/D.');
  if (/swiftshader|llvmpipe|software/i.test(String(rapport.environnement.nonMasque || rapport.environnement.rendu)))
    rapport.limites.push('Rendu logiciel (SwiftShader) : ces chiffres ne qualifient les performances d aucun GPU réel, ni d un téléphone, ni d une Xbox Edge.');
  rapport.limites.push('Une session Chrome sans interface ne prouve ni les manettes physiques, ni une vraie partie WebRTC sur plusieurs machines.');
  await evaluer(`(async () => { const r = BITUME_JEU.rendu; await r.gpu.device.queue.onSubmittedWorkDone(); (${environnementWebGPU.toString()})(r); return true; })()`);
  if (rapport.erreurs.length) code = 1;
} catch (e) {
  rapport.fatal = String(e && e.message || e);
  rapport.erreurs = evenements.console.filter(x => x.type === 'error').concat(evenements.exceptions);
  if (args.capture && ws) try {
    const s = await envoyer('Page.captureScreenshot', { format: 'png' });
    writeFileSync(args.capture, Buffer.from(s.data, 'base64')); rapport.capture = path.resolve(args.capture);
  } catch { /* la cause d'origine reste dans le rapport */ }
  code = 1;
} finally {
  for (const q of requetes.values()) clearTimeout(q.minuteur);
  requetes.clear();
  if (args.sortie) writeFileSync(args.sortie, JSON.stringify(rapport, null, 2));
  console.log(JSON.stringify(rapport, null, 2));
  try { ws && ws.close(); } catch (e) { /* déjà fermé */ }
  try { processus.kill('SIGKILL'); } catch (e) { /* déjà mort */ }
  try { process.kill(-processus.pid, 'SIGKILL'); } catch (e) { /* groupe déjà mort */ }
  rmSync(profil, { recursive: true, force: true });
}
process.exit(code);
