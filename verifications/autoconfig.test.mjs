import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/autoconfig.js');
const A = globalThis.BITUME.autoconfig;
let controles = 0;
async function verifier(nom, f) { await f(); controles++; console.log('ok ' + nom); }
function appareil(charges, options = {}) {
  let horloge = 0, trame = 0, debutTrame = 0, id = null, chargePrecedente = 0, appels = 0;
  let stats = { gpu: !options.sansGPU, frames: 0, history: [] };
  const visites = [], progressions = [];
  const io = {
    maintenant: () => horloge,
    empreinte: () => options.redimensionner && appels > 30 ? 'nouvelle' : 'machine',
    annule: () => options.annuler && appels > 20,
    masque: () => options.masquer && appels > 20,
    perdu: () => options.perdre && appels > 20,
    image: async () => {
      appels++;
      if (options.sansCadence && appels > 20) return null;
      const periode = options.periode || 1000 / 60;
      debutTrame += Math.ceil(Math.max(periode, chargePrecedente, horloge - debutTrame) / periode) * periode;
      horloge = debutTrame; chargePrecedente = 0; return horloge;
    },
    preparer: (choix) => { id = choix; visites.push(id); horloge += options.preparation?.[id] || 0; stats = { gpu: !options.sansGPU, frames: 0, history: [] }; },
    dessiner: (temps, vue) => {
      assert.ok(vue >= 0 && vue < 3);
      const charge = charges[id] || { cpu: 1, gpu: 2 };
      horloge += charge.cpu; chargePrecedente = charge.gpu;
      stats.frames++;
      stats.history.push({ frame: stats.frames, valid: true, queries: options.sansGPU ? 0 : 1,
        completed: options.sansGPU || (id === 'extreme' && options.extremeIncomplet) ? 0 : 1, gpu: { scene: charge.gpu } });
      trame++;
    },
    profilGPU: () => stats,
    progression: (texte, fraction) => { progressions.push({ texte, fraction }); },
  };
  return { io, visites, progressions };
}

await verifier('le cache valide garde les choix manuels ; empreinte locale bornée', () => {
  const e = A.empreinte('GPU-A', 1280, 720, 1);
  assert.equal(e, A.empreinte('GPU-A', 1280, 720, 1));
  assert.notEqual(e, A.empreinte('GPU-B', 1280, 720, 1));
  assert.notEqual(e, A.empreinte('GPU-A', 2560, 1440, 2));
  const c = { revision: A.REVISION, statut: 'ok', selection: 'medium', empreinte: e, mesures: [{}] };
  assert.ok(A.cacheValide(c, e));
  assert.equal(A.cacheValide({ ...c, revision: -1 }, e), false);
  assert.equal(A.cacheValide({ ...c, selection: '__proto__' }, e), false);
  assert.equal(A.cacheValide({ ...c, mesures: [] }, e), false);
  assert.equal(A.cacheValide(c, 'autre'), false);
});
await verifier('mesures GPU incomplètes et disjointes exclues', () => {
  const stats = { gpu: true, history: [
    { frame: 1, valid: true, queries: 2, completed: 2, gpu: { scene: 3, post: 1 } },
    { frame: 2, valid: false, queries: 1, completed: 1, gpu: { scene: 999 } },
    { frame: 3, valid: true, queries: 2, completed: 1, gpu: { scene: 2 } },
    { frame: 4, valid: true, queries: 1, completed: 1, gpu: { scene: 5 } },
  ] };
  assert.deepEqual(A.gpuComplet(stats, 1), [4, 5]);
  assert.deepEqual(A.gpuComplet(stats, 3), [5]);
  assert.deepEqual(A.gpuComplet({ ...stats, gpu: false }, 0), []);
});
await verifier('GPU faible : palier léger mesuré, aucune tentative coûteuse ensuite', async () => {
  const f = appareil({ medium: { cpu: 2, gpu: 45 }, low: { cpu: 2, gpu: 8 } });
  const r = await A.executer(f.io);
  assert.equal(r.statut, 'ok'); assert.equal(r.selection, 'low');
  assert.deepEqual(f.visites, ['medium', 'low']);
  assert.equal(r.reglages.vegetation, 'off'); assert.equal(r.reglages.ombres, 'off');
});
await verifier('moyen stable mais haut trop lent : décision moyenne avec mesure GPU réelle', async () => {
  const f = appareil({ medium: { cpu: 2, gpu: 8 }, high: { cpu: 2, gpu: 22 } });
  const r = await A.executer(f.io);
  assert.equal(r.selection, 'medium'); assert.deepEqual(f.visites, ['medium', 'high']);
  assert.ok(r.mesures[0].images >= 24); assert.ok(r.mesures[0].imagesGPU >= 8);
});
await verifier('sans extension GPU, un écran à 60 Hz ne suffit pas à sélectionner Extrême', async () => {
  const f = appareil({}, { sansGPU: true });
  const r = await A.executer(f.io);
  assert.equal(r.selection, 'high'); assert.deepEqual(f.visites, ['medium', 'high']);
  assert.equal(r.mesures[1].gpu95, null);
});
await verifier('Extrême est réellement essayé et refusé si son coût dépasse la marge', async () => {
  const f = appareil({ extreme: { cpu: 2, gpu: 28 } });
  const r = await A.executer(f.io);
  assert.deepEqual(f.visites, ['medium', 'high', 'extreme']); assert.equal(r.selection, 'high');
});
await verifier('machine rapide : Extrême retenu seulement après sa propre mesure', async () => {
  const f = appareil({ extreme: { cpu: 2, gpu: 9 } });
  const r = await A.executer(f.io);
  assert.equal(r.selection, 'extreme'); assert.equal(r.reglages.vegetation, 'ultra');
  assert.equal(r.reglages.faune, 'ultra'); assert.equal(r.statut, 'ok');
  assert.equal(f.progressions.at(-1).fraction, 1);
});
await verifier('requêtes Extrême devenues incomplètes : conserver Fine déjà mesuré', async () => {
  const f = appareil({}, { extremeIncomplet: true }), r = await A.executer(f.io);
  assert.ok(f.visites.includes('extreme')); assert.equal(r.selection, 'high');
  assert.equal(r.mesures.at(-1).imagesGPU, 0); assert.equal(r.mesures.at(-1).acceptable, false);
});
await verifier('préparation lente : ne pas jeter un palier valide à cause du délai global', async () => {
  const lent = appareil({}, { preparation: { medium: 10500, high: 4000 } });
  const r = await A.executer(lent.io); assert.equal(r.statut, 'ok'); assert.equal(r.selection, 'medium');
  assert.deepEqual(lent.visites, ['medium']);
  const debord = appareil({}, { preparation: { medium: 6000, high: 7000 } });
  const p = await A.executer(debord.io); assert.equal(p.statut, 'ok'); assert.equal(p.selection, 'medium'); assert.equal(p.partiel, true);
});
await verifier('écran 30 Hz : distinguer la cadence de la charge réelle', async () => {
  const f = appareil({ medium: { cpu: 3, gpu: 12 }, high: { cpu: 3, gpu: 20 } }, { periode: 1000 / 30 });
  const r = await A.executer(f.io);
  assert.equal(r.selection, 'high'); assert.ok(r.cadence > 33 && r.cadence < 34);
});
await verifier('annulation, onglet masqué, contexte perdu, redimensionnement et RAF bloqué ne donnent aucun réglage', async () => {
  for (const [option, motif] of [['annuler','annule'],['masquer','onglet_masque'],['perdre','contexte_perdu'],['redimensionner','taille_modifiee'],['sansCadence','cadence_indisponible']]) {
    const f = appareil({}, { [option]: true }); const r = await A.executer(f.io);
    assert.equal(r.statut, 'interrompu', option); assert.equal(r.motif, motif); assert.equal(r.reglages, undefined);
  }
});
// Appareil à fin forcée : dessiner occupe le processeur, terminer attend la fin du travail graphique (en série,
// comme la lecture d'un pixel). La synchronisation suivante tombe à la première période d'écran libre.
// charges[id].glace = { gpu, tous } : comme le parcours, une glace toutes les « tous » images du point de vue 0
// (cockpit). options.infos[id] : réponse du parcours à preparer (glaces dessinées, absentes…).
// La limite vaut 12,5 ms (FRACTION 0,75) depuis que la mesure contient l'endroit le plus chargé et les glaces : les
// coûts de ces cas encadrent cette limite.
function appareilFin(charges, options = {}) {
  const periode = options.periode || 1000 / 60;
  let horloge = 0, vsync = 0, id = null, gpuEnCours = 0, image = 0, cockpit = 0, appels = 0, lecturesGPU = 0, fins = 0, dessinsAvant = 0;
  const visites = [], preparations = [];
  const io = {
    maintenant: () => horloge,
    empreinte: () => 'machine',
    perdu: () => options.perdre && appels > 20,
    image: async () => {
      appels++;
      const libre = horloge + gpuEnCours; gpuEnCours = 0;
      vsync = Math.max(vsync + periode, Math.ceil(libre / periode - 1e-9) * periode);
      horloge = vsync; return horloge;
    },
    preparer: (choix, profil, reglage) => { id = choix; visites.push(choix); preparations.push(reglage); image = 0; cockpit = 0; return options.infos?.[choix]; },
    dessiner: (temps, vue) => {
      assert.ok(vue >= 0 && vue < 3);
      if (id === null) dessinsAvant++;
      const c = charges[id] || { cpu: 1, gpu: 2 }, pic = c.pic && ++image % c.pic.tous === 0;
      const glace = c.glace && vue === 0 && ++cockpit % c.glace.tous === 0 ? c.glace.gpu : 0;
      horloge += c.cpu; gpuEnCours = (pic ? c.pic.gpu : c.gpu) + glace;
    },
    terminer: () => { fins++; horloge += gpuEnCours; gpuEnCours = 0; },
    profilGPU: () => { lecturesGPU++; return { gpu: true, frames: 0, history: [] }; },
  };
  return { io, visites, preparations, get lecturesGPU() { return lecturesGPU; }, get fins() { return fins; }, get dessinsAvant() { return dessinsAvant; } };
}
const proche = (a, b, nom) => assert.ok(Math.abs(a - b) < 1e-3, nom + ' : ' + a + ' au lieu de ' + b);
await verifier('fin forcée : un profil trop cher est refusé, sans jamais lire le chronomètre GPU', async () => {
  const f = appareilFin({ medium: { cpu: 3, gpu: 10 }, low: { cpu: 1, gpu: 2 } }), r = await A.executer(f.io);
  assert.equal(r.statut, 'ok'); assert.equal(r.methode, 'terminer'); assert.equal(r.selection, 'low');
  assert.deepEqual(f.visites, ['medium', 'low']);
  assert.equal(r.mesures[0].acceptable, false); proche(r.mesures[0].cout95, 13, 'coût de Moyenne');
  assert.equal(r.mesures[1].acceptable, true); proche(r.mesures[1].cout95, 3, 'coût de Légère');
  proche(r.mesures[0].cpu95, 3, 'processeur'); proche(r.mesures[0].attente95, 10, 'attente du GPU');
  assert.equal(f.lecturesGPU, 0, 'le chronomètre GPU n est plus consulté');
  assert.ok(f.preparations.every(p => p && p.chronoGPU === false), 'le parcours n ouvre pas le chronomètre');
  assert.ok(f.fins >= r.mesures[0].images + r.mesures[1].images, 'chaque image mesurée est terminée');
  // la période vient d'images à vide, avant tout dessin
  assert.equal(f.dessinsAvant, 0); assert.ok(r.cadenceIntervalles >= 9 && r.cadenceIntervalles <= 24);
  proche(r.cadence, 1000 / 60, 'période'); assert.equal(r.cadenceEcart, 0);
  proche(r.budget, 1000 / 60, 'budget'); assert.equal(r.limite, 12.5); assert.equal(r.fraction, A.FRACTION);
  assert.equal(r.mesures[0].glaces, null, 'un parcours qui ne répond rien ne déclare pas de glaces');
});
await verifier('fin forcée : juste sous la limite accepté, juste au-dessus refusé', async () => {
  const f = appareilFin({ medium: { cpu: 2, gpu: 10.4 }, high: { cpu: 2, gpu: 10.6 } }), r = await A.executer(f.io);
  assert.equal(r.selection, 'medium'); assert.deepEqual(f.visites, ['medium', 'high']);
  assert.equal(r.mesures[0].acceptable, true); assert.equal(r.mesures[1].acceptable, false);
  assert.ok(r.mesures[0].images >= 24);
});
await verifier('fin forcée : un écran bridé à 30 Hz ne change plus le verdict', async () => {
  const charges = { medium: { cpu: 2, gpu: 10.4 }, high: { cpu: 2, gpu: 10.6 } };
  const a60 = await A.executer(appareilFin(charges).io), a30 = await A.executer(appareilFin(charges, { periode: 1000 / 30 }).io);
  assert.equal(a60.selection, 'medium'); assert.equal(a30.selection, 'medium');
  proche(a30.cadence, 1000 / 30, 'période consignée'); proche(a30.mesures[0].p50, 1000 / 30, 'intervalles consignés');
  assert.deepEqual(a30.mesures.map(m => m.acceptable), a60.mesures.map(m => m.acceptable));
  assert.deepEqual(a30.mesures.map(m => m.cout95), a60.mesures.map(m => m.cout95));
});
await verifier('fin forcée : un accroc sur huit images refuse un profil dont la médiane passe', async () => {
  const f = appareilFin({ medium: { cpu: 2, gpu: 5, pic: { tous: 8, gpu: 12 } } }), r = await A.executer(f.io);
  proche(r.mesures[0].cout50, 7, 'médiane'); proche(r.mesures[0].cout95, 14, '95e centile');
  assert.equal(r.mesures[0].acceptable, false); assert.equal(r.selection, 'low');
});
await verifier('fin forcée : Extrême essayé seulement si Fine tient dans la moitié de la limite', async () => {
  const large = appareilFin({ medium: { cpu: 1, gpu: 2 }, high: { cpu: 1, gpu: 3.5 }, extreme: { cpu: 1, gpu: 8 } });
  let r = await A.executer(large.io);
  assert.deepEqual(large.visites, ['medium', 'high', 'extreme']); assert.equal(r.selection, 'extreme');
  const juste = appareilFin({ medium: { cpu: 1, gpu: 2 }, high: { cpu: 1, gpu: 5.5 } });
  r = await A.executer(juste.io);
  assert.deepEqual(juste.visites, ['medium', 'high']); assert.equal(r.selection, 'high');
  const lourd = appareilFin({ medium: { cpu: 1, gpu: 2 }, high: { cpu: 1, gpu: 3.5 }, extreme: { cpu: 1, gpu: 12 } });
  r = await A.executer(lourd.io);
  assert.deepEqual(lourd.visites, ['medium', 'high', 'extreme']); assert.equal(r.selection, 'high');
});
await verifier('fin forcée : Fine refusée quand ses glaces font passer le point de vue du cockpit au-dessus de la limite', async () => {
  // Sans glaces, Fine (10 ms) et Moyenne (9 ms) tiennent. Une glace par image du cockpit en Fine (+ 3 ms sur un tiers
  // des images) et une sur deux en Moyenne (+ 1,5 ms sur un sixième) : le 95e centile voit ces images.
  const infos = { medium: { glaces: 'dessinees', glacesParImage: .5 }, high: { glaces: 'dessinees', glacesParImage: 1 } };
  const sans = await A.executer(appareilFin({ medium: { cpu: 1, gpu: 8 }, high: { cpu: 1, gpu: 9 } }, { infos }).io);
  assert.equal(sans.selection, 'high');
  const f = appareilFin({ medium: { cpu: 1, gpu: 8, glace: { gpu: 1.5, tous: 2 } }, high: { cpu: 1, gpu: 9, glace: { gpu: 3, tous: 1 } } }, { infos });
  const r = await A.executer(f.io);
  assert.deepEqual(f.visites, ['medium', 'high']); assert.equal(r.selection, 'medium');
  proche(r.mesures[1].cout50, 10, 'médiane de Fine, hors cockpit'); proche(r.mesures[1].cout95, 13, 'Fine au cockpit, glace comprise');
  assert.equal(r.mesures[1].acceptable, false); proche(r.mesures[0].cout95, 10.5, 'Moyenne glace comprise');
  assert.equal(r.mesures[0].acceptable, true);
  assert.equal(r.mesures[1].glaces, 'dessinees'); proche(r.mesures[1].limite, A.LIMITE, 'glaces mesurées : limite entière');
});
await verifier('fin forcée : glaces absentes du parcours, la limite perd leur part', async () => {
  const charges = { medium: { cpu: 1, gpu: 9 }, high: { cpu: 1, gpu: 9 } };
  const infos = { medium: { glaces: 'absentes', glacesParImage: .5 }, high: { glaces: 'absentes', glacesParImage: 1 } };
  const r = await A.executer(appareilFin(charges, { infos }).io);
  proche(r.mesures[0].limite, A.LIMITE / 1.18, 'Moyenne, une glace une image sur deux');
  proche(r.mesures[1].limite, A.LIMITE / 1.36, 'Fine, une glace par image');
  assert.equal(r.mesures[0].acceptable, true, '10 ms sous 10,59'); assert.equal(r.mesures[1].acceptable, false, '10 ms au-dessus de 9,19');
  assert.equal(r.selection, 'medium'); assert.equal(r.mesures[1].glaces, 'absentes');
  // mêmes coûts, glaces dessinées ou palier sans glaces : la limite reste entière et Fine passe
  const pleine = await A.executer(appareilFin(charges, { infos: { medium: { glaces: 'aucune' }, high: { glaces: 'dessinees', glacesParImage: 1 } } }).io);
  assert.equal(pleine.selection, 'high'); proche(pleine.mesures[1].limite, A.LIMITE, 'limite entière');
  assert.equal(A.limiteProfil(undefined), A.LIMITE); assert.equal(A.limiteProfil({ glaces: 'absentes' }), A.LIMITE / 1.36);
});
await verifier('fin forcée : un profil sans espoir est mesuré sur huit images seulement', async () => {
  const f = appareilFin({ medium: { cpu: 5, gpu: 20 } }), r = await A.executer(f.io);
  assert.equal(r.mesures[0].images, 8); assert.equal(r.mesures[0].acceptable, false);
  assert.equal(r.selection, 'low'); assert.deepEqual(f.visites, ['medium', 'low']);
});
await verifier('fin forcée : un contexte perdu interrompt sans réglage', async () => {
  const r = await A.executer(appareilFin({}, { perdre: true }).io);
  assert.equal(r.statut, 'interrompu'); assert.equal(r.motif, 'contexte_perdu'); assert.equal(r.reglages, undefined);
  assert.equal(r.methode, 'terminer');
});
await verifier('sans io.terminer : méthode du chronomètre GPU et appel de préparation inchangés', async () => {
  const f = appareil({ medium: { cpu: 2, gpu: 8 }, high: { cpu: 2, gpu: 22 } }), arguments_ = [], preparer = f.io.preparer;
  f.io.preparer = (...a) => { arguments_.push(a.length); return preparer(...a); };
  const r = await A.executer(f.io);
  assert.equal(r.methode, 'chrono-gpu'); assert.equal(r.selection, 'medium');
  assert.equal(r.limite, undefined); assert.equal(r.mesures[0].methode, undefined);
  assert.deepEqual(arguments_, [2, 2]);
});
await verifier('cache : la fin forcée refait une fois les détections prises au chronomètre GPU', () => {
  const e = A.empreinte('GPU-A', 1280, 720, 1);
  const ancien = { revision: A.REVISION, statut: 'ok', selection: 'low', empreinte: e, mesures: [{}], methode: 'chrono-gpu' };
  assert.ok(A.cacheValide(ancien, e), 'sans fin forcée, la validité ne change pas');
  assert.equal(A.cacheValide(ancien, e, { terminer: true }), false);
  assert.ok(A.cacheValide({ ...ancien, methode: 'terminer' }, e, { terminer: true }));
  assert.equal(A.cacheValide({ ...ancien, revision: 1 }, e), false, 'les détections de la révision 1 sont refaites');
});
await verifier('bilan de coût : le 95e centile juge, la limite est incluse', () => {
  const vingtQuatre = v => Array(24).fill(v);
  assert.equal(A.bilanCout('medium', vingtQuatre(A.LIMITE), [], [], []).acceptable, true);
  assert.equal(A.bilanCout('medium', vingtQuatre(A.LIMITE + .01), [], [], []).acceptable, false);
  assert.equal(A.bilanCout('medium', Array(23).fill(1), [], [], []).acceptable, false, 'trop peu d images');
  assert.equal(A.bilanCout('high', vingtQuatre(9.5), [], [], [], 9.19).acceptable, false, 'limite du profil');
  assert.equal(A.bilanCout('high', vingtQuatre(9.5), [], [], [], 9.19).limite, 9.19);
  assert.equal(A.LIMITE, A.BUDGET * A.FRACTION);
  // Ce qui reste hors mesure sur le M5 (MESURES-BASE) doit tenir dans le budget : ramassage mineur de 2,1 ms au plus
  // et une milliseconde de composition et de copie des glaces.
  assert.ok(A.LIMITE + 2.1 + 1 <= A.BUDGET, 'marge hors mesure : ' + (A.BUDGET - A.LIMITE));
  // Fine sur le M5 : elle rate une image sur quatre en course, donc coûte plus d'un budget glaces comprises.
  assert.equal(A.bilanCout('high', vingtQuatre(A.BUDGET + .1), [], [], []).acceptable, false);
});
await verifier('les réglages ne touchent ni au moment de la course ni aux commandes', () => {
  for (const id of Object.keys(A.profils)) assert.deepEqual(Object.keys(A.reglages(id)), [...A.CLES]);
  assert.equal(A.reglages('inconnu'), null);
  const original = { moment: 'nuit', meteo: 'pluie', pneus: 'pluie', aide: .2, qualite: 'high', vegetation: 'ultra', faune: 'ultra' };
  Object.assign(original, A.reglages('low'));
  assert.equal(original.moment, 'nuit'); assert.equal(original.meteo, 'pluie'); assert.equal(original.aide, .2);
  assert.equal(original.vegetation, 'off'); assert.equal(original.faune, 'off');
});
console.log(`${controles} contrôles de détection graphique réussis.`);
