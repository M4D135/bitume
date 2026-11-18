#!/usr/bin/env node
// Produit une COPIE de QA autoexécutable, à ouvrir dans un navigateur autorisé avec WebGL2.
// Ne lance aucun navigateur, ne modifie pas le build et ne mesure pas les performances.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { horlogeCapture } from './controle-visuel.mjs';

function avantJeu(config) {
  const choix = new URLSearchParams(location.search);
  const vue = choix.get('vue') || config.vue;
  const charge = choix.get('chargement') || 'valide';
  const Q = window.__BITUME_OPTIONS_QA = { state: 'running', vue, charge, erreurs: [], avertissements: [],
    controles: [], images: [], erreursWebGL: [], build: config.build, limite: 'Horloge commandée ; aucune mesure FPS.' };
  const chaine = x => { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch { return String(x); } };
  for (const [methode, destination] of [['error','erreurs'], ['warn','avertissements']]) {
    const origine = console[methode].bind(console);
    console[methode] = (...args) => { Q[destination].push(args.map(chaine).join(' ')); origine(...args); };
  }
  addEventListener('error', e => Q.erreurs.push(e.message || String(e.error)));
  addEventListener('unhandledrejection', e => Q.erreurs.push(String(e.reason)));
  Q.restituerStockage = () => {
    if (!Q.stockageDisponible) return;
    if (Q.stockageAvant === null) localStorage.removeItem('bitume.reglages');
    else localStorage.setItem('bitume.reglages', Q.stockageAvant);
  };
  try {
    Q.stockageAvant = localStorage.getItem('bitume.reglages'); Q.stockageDisponible = true;
    const options = charge === 'ancien' ? {} : charge === 'invalide'
      ? { anticrenelage: 'invalide', ombres: 8, vegetation: null }
      : { anticrenelage: ' MSAA4 ', ombres: 'off', vegetation: ' LOW ' };
    localStorage.setItem('bitume.reglages', JSON.stringify({ qualite: 'low', demo: 'non', general: 0, retro: 'non', ...options }));
    addEventListener('beforeunload', Q.restituerStockage);
  } catch (e) { Q.stockageDisponible = false; Q.erreurs.push('Stockage inaccessible : ' + e.message); }
  document.documentElement.dataset.qaState = 'running';
}

async function parcours() {
  const Q = window.__BITUME_OPTIONS_QA;
  const panneau = document.createElement('details'); panneau.id = 'qa-panneau'; panneau.open = Q.vue === 'rapport';
  panneau.style.cssText = 'position:fixed;z-index:100000;bottom:8px;right:8px;max-width:min(700px,94vw);max-height:70vh;overflow:auto;background:#111e;color:#eee;padding:10px;border:1px solid #999;border-radius:8px;font:12px system-ui';
  const etat = document.createElement('summary'); etat.id = 'qa-etat';
  const pre = document.createElement('pre'); pre.id = 'qa-resultats'; pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
  panneau.append(etat,pre); document.body.append(panneau);
  const publier = () => {
    document.documentElement.dataset.qaState = Q.state; etat.textContent = 'qa-state:' + Q.state;
    document.title = 'BITUME QA — ' + Q.state;
    pre.textContent = JSON.stringify({ state: Q.state, build: Q.build, chargement: Q.charge,
      environnement: Q.environnement, controles: Q.controles, images: Q.images, erreurs: Q.erreurs,
      erreursWebGL: Q.erreursWebGL, avertissements: Q.avertissements, limite: Q.limite }, null, 2);
  };
  publier();
  const exiger = (v, m) => { if (!v) throw new Error(m); };
  const egal = (a,b,m) => exiger(JSON.stringify(a) === JSON.stringify(b), m + ' : ' + JSON.stringify(a) + ' / ' + JSON.stringify(b));
  const selection = x => ({ anticrenelage: x.anticrenelage, ombres: x.ombres, vegetation: x.vegetation });
  const tester = (nom,f) => {
    try { const detail = f(); Q.controles.push({ nom, resultat: 'pass', detail }); }
    catch (e) { Q.controles.push({ nom, resultat: 'fail', erreur: e.message }); }
    publier();
  };
  try {
    const debut = performance.now();
    while (!window.BITUME_JEU?.rendu) {
      if (performance.now() - debut > 120000) throw new Error('Le jeu ne démarre pas en 120 secondes');
      await new Promise(r => setTimeout(r,50));
    }
    const J = window.BITUME_JEU, gl = J.rendu.gl;
    exiger(J.rendu.stats.backend === 'webgl2' && gl, 'WebGL2 requis pour ce parcours');
    J.pauseAuto = false; J.mesures = false;
    const maxSamples = gl.getParameter(gl.MAX_SAMPLES), maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    Q.environnement = { backend: J.rendu.stats.backend, gpuModeste: J.gpuModeste, maxSamples, maxTexture,
      resolution: [document.getElementById('scene').width,document.getElementById('scene').height] };
    const choisir = (name,value) => {
      const element = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
      exiger(element, 'Option absente : ' + name + '=' + value);
      element.checked = true; element.dispatchEvent(new Event('change',{ bubbles: true }));
    };
    const image = nom => {
      window.__BITUME_CAPTURE.avancer(1000/60);
      for (let n = 0; n < 16; n++) { const e = gl.getError(); if (!e) break; Q.erreursWebGL.push({ image: nom, code: e }); }
      const s = J.rendu.stats;
      const r = { nom, msaa: s.msaa, shadowMapSize: s.shadowMapSize, shadowTileSize: s.shadowTileSize,
        halo: J.profil.effets.halo, vegetation: J.scene.vegetationQualite, plantes: J.scene.decor.vegetation || null };
      Q.images.push(r); return r;
    };
    tester('chargement et normalisation des préférences', () => {
      const attendu = Q.charge === 'ancien' || Q.charge === 'invalide'
        ? { anticrenelage: 'profil', ombres: 'profil', vegetation: 'profil' }
        : { anticrenelage: 'msaa4', ombres: 'off', vegetation: 'low' };
      egal(selection(J.reglages),attendu,'préférences chargées');
    });
    tester('événements change enregistrés dans le stockage', () => {
      exiger(Q.stockageDisponible,'stockage indisponible');
      choisir('anticrenelage','off'); choisir('ombres','medium'); choisir('vegetation','low');
      egal(selection(JSON.parse(localStorage.getItem('bitume.reglages'))),
        { anticrenelage: 'off', ombres: 'medium', vegetation: 'low' },'préférences persistées');
    });
    const ancienneSession = J.session, ancienneScene = J.scene, ancienGl = gl, anciensObstacles = J.scene.c.obstacles;
    tester('MSAA réel sans halo en qualité Légère', () => {
      choisir('anticrenelage','msaa4'); choisir('ombres','off');
      const r = image('low-msaa4');
      exiger(!r.halo,'le test exige le halo coupé');
      exiger(maxSamples < 2 ? r.msaa === 0 : r.msaa >= 2 && r.msaa <= Math.min(4,maxSamples),'échantillons MSAA effectifs inattendus');
      return { supportMateriel: maxSamples >= 2, samples: r.msaa };
    });
    let ombreMoyenne = 0;
    tester('ombres moyennes puis fines : deux atlas réels', () => {
      choisir('anticrenelage','off'); choisir('ombres','medium');
      const a = image('ombres-medium'); ombreMoyenne = a.shadowMapSize;
      exiger(a.msaa === 0 && a.shadowMapSize > 0,'MSAA désactivé, atlas d’ombres présent');
      choisir('ombres','high'); const b = image('ombres-high');
      exiger(b.shadowMapSize >= a.shadowMapSize,'atlas réduit en qualité fine');
      if (maxTexture >= a.shadowMapSize * 2) egal(b.shadowMapSize,a.shadowMapSize*2,'atlas doublé');
      return { moyen: a.shadowMapSize, fin: b.shadowMapSize };
    });
    tester('basculements répétés sans nouvelle séance ni nouveau contexte', () => {
      for (let k = 0; k < 2; k++) {
        choisir('anticrenelage','off'); choisir('ombres','off');
        const a = image('eteint-' + k); egal([a.msaa,a.shadowMapSize],[0,0],'effets coupés');
        choisir('anticrenelage','msaa4'); choisir('ombres','medium');
        const b = image('rallume-' + k); egal(b.shadowMapSize,ombreMoyenne,'atlas réactivé');
        if (maxSamples >= 2) exiger(b.msaa >= 2,'MSAA non réactivé');
      }
      exiger(J.session === ancienneSession && J.scene === ancienneScene && J.rendu.gl === ancienGl
        && J.scene.c.obstacles === anciensObstacles,'AA/ombres ont recréé une identité de séance');
    });
    tester('densité différée puis active à la séance suivante', () => {
      const sc = J.scene, s = J.session;
      choisir('vegetation','high');
      exiger(J.scene === sc && J.session === s,'la densité ne doit pas rebâtir une course en cours');
      J.demo(0);
      exiger(J.scene.vegetationQualite === 'high','densité high non appliquée à la nouvelle séance');
      exiger(J.scene.palier === 'low','la densité ne doit pas changer le profil global');
      exiger(J.scene.decor.vegetation?.herbes > 0,'aucune herbe avec Low + végétation High');
    });
    tester('reference(options), retour au jeu et absence d’écriture persistante', () => {
      const avant = selection(J.reglages), stock = localStorage.getItem('bitume.reglages');
      const ref = J.reference({ qualite: 'low', anticrenelage: 'msaa4', ombres: 'high', vegetation: 'ultra', retro: 'non', vitesse: 0, vue: 'poursuite' });
      egal(selection(ref),{ anticrenelage: 'msaa4', ombres: 'high', vegetation: 'ultra' },'référence explicite');
      egal(J.scene.vegetationQualite,'ultra','scène de référence');
      image('reference-ultra'); choisir('ombres','off');
      egal(localStorage.getItem('bitume.reglages'),stock,'la référence ne sauvegarde pas ses options');
      document.getElementById('b-abandon').click();
      egal(selection(J.reglages),avant,'restauration des réglages après référence');
    });
    if (Q.vue === 'options') {
      document.querySelector('[data-aller="reglages"]').click();
      const cible = document.querySelector('input[name="qualite"]').closest('fieldset');
      cible.scrollIntoView({ block: 'start' });
    } else if (Q.vue === 'herbe') {
      const densite = new URLSearchParams(location.search).get('densite') || 'high';
      J.reference({ qualite: 'medium', anticrenelage: 'msaa4', ombres: 'high', vegetation: densite, retro: 'non', vitesse: 0, vue: 'poursuite', depart: 800 });
      image('capture-herbe');
    }
    tester('aucune erreur JavaScript ou WebGL observée', () => {
      egal(Q.erreurs,[],'erreurs JavaScript'); egal(Q.erreursWebGL,[],'erreurs WebGL');
    });
  } catch (e) { Q.controles.push({ nom: 'parcours', resultat: 'fail', erreur: e.message }); }
  finally {
    try { Q.restituerStockage(); }
    catch (e) { Q.controles.push({ nom: 'restauration stockage', resultat: 'fail', erreur: e.message }); }
    Q.state = Q.erreurs.length || Q.erreursWebGL.length || Q.controles.some(c => c.resultat === 'fail') ? 'fail' : 'pass';
    if (Q.state === 'fail') panneau.open = true;
    publier();
  }
}

export function genererOptions({ entree, sortie, vue = 'rapport' }) {
  entree = path.resolve(entree); sortie = path.resolve(sortie);
  if (!['rapport','options','herbe'].includes(vue)) throw new Error('--vue : rapport, options ou herbe');
  if (entree === sortie || path.dirname(entree) === path.dirname(sortie)) throw new Error('Écrire la copie QA hors du dossier du build');
  const source = readFileSync(entree,'utf8');
  if (!source.includes('<head>') || !source.includes('</body>')) throw new Error('Page HTML complète attendue');
  const build = { sha256: createHash('sha256').update(source).digest('hex'), octets: Buffer.byteLength(source) };
  const script = js => '<script>\n' + js.replace(/<\/script/gi,'<\\/script') + '\n</script>\n';
  const avant = script(horlogeCapture(17017) + ';\n(' + avantJeu.toString() + ')(' + JSON.stringify({ vue, build }) + ');');
  const apres = script('(' + parcours.toString() + ')();');
  const html = source.replace('<head>','<head>\n' + avant).replace('</body>',apres + '</body>');
  mkdirSync(path.dirname(sortie),{ recursive: true }); writeFileSync(sortie,html,{ flag: 'wx' });
  return { fichier: sortie, build, execute: false, vue, parametresURL: '?vue=options | ?vue=herbe&densite=high | ?chargement=ancien | ?chargement=invalide' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const a = {};
    for (let i = 2; i < process.argv.length; i += 2) {
      const nom = process.argv[i].replace(/^--/,'');
      if (!['entree','sortie','vue'].includes(nom) || !process.argv[i+1]) throw new Error('Utilisation : node tools/controle-options.mjs --entree dist/bitume.html --sortie /tmp/bitume-options.html [--vue rapport|options|herbe]');
      a[nom] = process.argv[i+1];
    }
    if (!a.entree || !a.sortie) throw new Error('--entree et --sortie sont nécessaires');
    console.log(JSON.stringify(genererOptions(a),null,2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
