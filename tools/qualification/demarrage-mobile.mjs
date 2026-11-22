#!/usr/bin/env node
// Premier démarrage mobile, sans cache et sans substituer les fonctions du jeu.
// Le vrai rendu WebGL2 suit le titre prêt ; deux images, aucun banc FPS.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer, optionsCapture } from '../controle-visuel.mjs';

export function instrumenterDemarrageMobile() {
  const trace = globalThis.__BITUME_MOBILE = {
    stockageInitial: Object.keys(localStorage),
    appels: { benchmark: 0, sceneBench: 0, passive: 0 },
    surveilles: { benchmark: false, sceneBench: false, passive: false }
  };
  const B = globalThis.BITUME = globalThis.BITUME || {};
  function observerFonction(module, propriete, compteur) {
    let enveloppe;
    const affecter = originale => {
      trace.surveilles[compteur] = typeof originale === 'function';
      enveloppe = typeof originale === 'function' ? function (...args) {
        trace.appels[compteur]++;
        return Reflect.apply(originale, this, args);
      } : originale;
    };
    const originale = module[propriete];
    Object.defineProperty(module, propriete, { configurable: true, enumerable: true,
      get: () => enveloppe, set: affecter });
    affecter(originale);
  }
  function observerModule(propriete, methodes) {
    let valeur;
    Object.defineProperty(B, propriete, { configurable: true, enumerable: true,
      get: () => valeur,
      set: module => {
        valeur = module;
        if (module) for (const [methode, compteur] of methodes) observerFonction(module, methode, compteur);
      }
    });
  }
  observerModule('autoconfig', [['executer', 'benchmark'], ['passive', 'passive']]);
  observerModule('sceneBench', [['creer', 'sceneBench']]);
}

function releverMobile() {
  const trace = __BITUME_MOBILE, J = BITUME_JEU;
  return { stockageInitial: trace.stockageInitial, appels: { ...trace.appels }, surveilles: { ...trace.surveilles },
    cache: JSON.parse(localStorage.getItem(BITUME.autoconfig.CLE)),
    reglagesEnregistres: JSON.parse(localStorage.getItem('bitume.reglages')),
    qualiteEffective: J.reglages.qualite, ecran: J.ecran, type: J.session?.type, phase: J.session?.course?.phase,
    appareil: { userAgent: navigator.userAgent, platform: navigator.platform, touch: navigator.maxTouchPoints,
      taille: [innerWidth, innerHeight], dpr: devicePixelRatio },
    webgl2: J.rendu?.stats.webglVersion === 2 };
}

export function verifierDemarrageMobile(r) {
  assert.ok(!r.fatal, r.fatal);
  assert.deepEqual(r.erreurs, [], 'aucune erreur navigateur');
  assert.ok(r.demarrage?.pret && r.demarrage.ecran === 'titre' && r.demarrage.type === null,
    'le titre est prêt sans séance avant reference()');
  assert.equal(r.environnement.webgl2, true);
  assert.equal(r.environnement.physx?.ready, true);
  assert.equal(r.images.length, 2, 'deux captures du jeu réel');
  const observations = [r.initialisation, ...r.images.map(i => i.observation)];
  for (const o of observations) {
    assert.deepEqual(o.stockageInitial, [], 'premier lancement sans réglages ni cache préchargés');
    assert.deepEqual(o.surveilles, { benchmark: true, sceneBench: true, passive: true }, 'fonctions natives surveillées');
    assert.equal(o.appels.benchmark, 0, 'aucun appel du banc autoconfig.executer');
    assert.equal(o.appels.sceneBench, 0, 'aucune création de scène de benchmark');
    assert.ok(o.appels.passive >= 1, 'la recommandation passive a réellement été exécutée');
    assert.equal(o.cache?.methode, 'capacites-declarees');
    assert.equal(o.cache?.selection, 'low');
    assert.equal(o.cache?.statut, 'ok');
    assert.equal(o.reglagesEnregistres?.qualite, 'low', 'profil prudent persisté avant la référence');
    assert.equal(o.webgl2, true); assert.equal(o.ecran, 'course'); assert.equal(o.type, 'course'); assert.equal(o.phase, 'course');
    assert.deepEqual(o.appareil.taille, [390, 844]); assert.equal(o.appareil.touch, 5);
    assert.equal(o.appareil.platform, 'iPhone'); assert.match(o.appareil.userAgent, /iPhone.*Mobile/);
  }
  const clic = r.images[0].observation.redetection;
  assert.equal(clic?.declencheur, 'bouton#r-detecter.click');
  assert.equal(clic?.passiveApres, clic?.passiveAvant + 1, 'le bouton déclenche bien une nouvelle recommandation');
  assert.equal(r.images[1].observation.appels.passive, clic.passiveApres, 'aucune répétition automatique après le bouton');
  for (const image of r.images) assert.ok(image.etat.referenceConservee && image.etat.zones.scene, 'course et toile réelles conservées');
}

export async function demarrageMobile({ url, sortie, chrome }) {
  const o = optionsCapture(['--url', url, '--sortie', sortie, '--scenario', 'piste', '--taille', '390,844',
    '--qualite', 'low', '--retro', 'non', '--vue', 'poursuite', '--images', '2', '--chauffe', '0',
    '--pas', String(1 / 60), '--attendre', '180000', ...(chrome ? ['--chrome', chrome] : [])]);
  o.avantNavigation = async ({ envoyer, rapport }) => {
    await envoyer('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await envoyer('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await envoyer('Emulation.setUserAgentOverride', { platform: 'iPhone',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    await envoyer('Page.addScriptToEvaluateOnNewDocument', { source: '(' + instrumenterDemarrageMobile.toString() + ')()' });
    rapport.limites.push('Chrome avec viewport, toucher et identifiants iPhone émulés ; ce contrôle ne remplace pas un essai Safari/iOS matériel.',
      'Wrappers de comptage : fonctions et résultats natifs conservés ; aucune sortie de benchmark substituée.');
  };
  o.initialiser = async ({ evaluer }) => evaluer('(' + releverMobile.toString() + ')()');
  o.observer = async ({ evaluer, i }) => {
    if (i !== 0) return evaluer('(' + releverMobile.toString() + ')()');
    return evaluer(`(async () => {
      const relever = ${releverMobile.toString()}, avant = relever(), bouton = document.getElementById('r-detecter');
      if (!bouton || bouton.disabled) throw new Error('Bouton de recommandation absent ou désactivé');
      bouton.click(); await Promise.resolve();
      const apres = relever();
      return { ...apres, redetection: { declencheur: 'bouton#r-detecter.click',
        passiveAvant: avant.appels.passive, passiveApres: apres.appels.passive } };
    })()`);
  };
  const rapport = await capturer(o);
  verifierDemarrageMobile(rapport);
  const resume = { format: 'bitume-demarrage-mobile-1', commit: rapport.source.commit, htmlSha256: rapport.build.sha256,
    demarrage: rapport.demarrage, premierLancement: rapport.initialisation,
    apresRedetection: rapport.images[1].observation, png: rapport.images.length,
    erreurs: 0, fpsMaterielsQualifies: false, navigateurMobileMaterielQualifie: false };
  writeFileSync(path.join(o.sortie, 'RESUME.json'), JSON.stringify(resume, null, 2) + '\n');
  return resume;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), o = {};
  try {
    for (let i = 0; i < args.length; i += 2) {
      const cle = args[i].replace(/^--/, '');
      if (!['url', 'sortie', 'chrome'].includes(cle) || !args[i + 1] || o[cle]) throw new Error('Option invalide : ' + args[i]);
      o[cle] = args[i + 1];
    }
    assert.ok(o.url && o.sortie, '--url et --sortie nécessaires');
    const r = await demarrageMobile(o);
    console.log(JSON.stringify({ commit: r.commit, htmlSha256: r.htmlSha256, png: r.png, erreurs: r.erreurs }));
  } catch (e) { console.error(e.stack || e); process.exitCode = 1; }
}
