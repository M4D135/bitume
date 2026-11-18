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
function appareilFin(charges, options = {}) {
  const periode = options.periode || 1000 / 60;
  let horloge = 0, vsync = 0, id = null, gpuEnCours = 0, image = 0, appels = 0, lecturesGPU = 0, fins = 0, dessinsAvant = 0;
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
    preparer: (choix, profil, reglage) => { id = choix; visites.push(choix); preparations.push(reglage); image = 0; },
    dessiner: (temps, vue) => {
      assert.ok(vue >= 0 && vue < 3);
      if (id === null) dessinsAvant++;
      const c = charges[id] || { cpu: 1, gpu: 2 }, pic = c.pic && ++image % c.pic.tous === 0;
      horloge += c.cpu; gpuEnCours = pic ? c.pic.gpu : c.gpu;
    },
    terminer: () => { fins++; horloge += gpuEnCours; gpuEnCours = 0; },
    profilGPU: () => { lecturesGPU++; return { gpu: true, frames: 0, history: [] }; },
  };
  return { io, visites, preparations, get lecturesGPU() { return lecturesGPU; }, get fins() { return fins; }, get dessinsAvant() { return dessinsAvant; } };
}
const proche = (a, b, nom) => assert.ok(Math.abs(a - b) < 1e-3, nom + ' : ' + a + ' au lieu de ' + b);
await verifier('fin forcée : un profil trop cher est refusé, sans jamais lire le chronomètre GPU', async () => {
  const f = appareilFin({ medium: { cpu: 3, gpu: 8 }, low: { cpu: 1, gpu: 2 } }), r = await A.executer(f.io);
  assert.equal(r.statut, 'ok'); assert.equal(r.methode, 'terminer'); assert.equal(r.selection, 'low');
  assert.deepEqual(f.visites, ['medium', 'low']);
  assert.equal(r.mesures[0].acceptable, false); proche(r.mesures[0].cout95, 11, 'coût de Moyenne');
  assert.equal(r.mesures[1].acceptable, true); proche(r.mesures[1].cout95, 3, 'coût de Légère');
  proche(r.mesures[0].cpu95, 3, 'processeur'); proche(r.mesures[0].attente95, 8, 'attente du GPU');
  assert.equal(f.lecturesGPU, 0, 'le chronomètre GPU n est plus consulté');
  assert.ok(f.preparations.every(p => p && p.chronoGPU === false), 'le parcours n ouvre pas le chronomètre');
  assert.ok(f.fins >= r.mesures[0].images + r.mesures[1].images, 'chaque image mesurée est terminée');
  // la période vient d'images à vide, avant tout dessin
  assert.equal(f.dessinsAvant, 0); assert.ok(r.cadenceIntervalles >= 9 && r.cadenceIntervalles <= 24);
  proche(r.cadence, 1000 / 60, 'période'); assert.equal(r.cadenceEcart, 0);
  proche(r.budget, 1000 / 60, 'budget'); assert.equal(r.limite, 10); assert.equal(r.fraction, A.FRACTION);
});
await verifier('fin forcée : juste sous la limite accepté, juste au-dessus refusé', async () => {
  const f = appareilFin({ medium: { cpu: 2, gpu: 7.9 }, high: { cpu: 2, gpu: 8.3 } }), r = await A.executer(f.io);
  assert.equal(r.selection, 'medium'); assert.deepEqual(f.visites, ['medium', 'high']);
  assert.equal(r.mesures[0].acceptable, true); assert.equal(r.mesures[1].acceptable, false);
  assert.ok(r.mesures[0].images >= 24);
});
await verifier('fin forcée : un écran bridé à 30 Hz ne change plus le verdict', async () => {
  const charges = { medium: { cpu: 2, gpu: 7.9 }, high: { cpu: 2, gpu: 8.3 } };
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
  const juste = appareilFin({ medium: { cpu: 1, gpu: 2 }, high: { cpu: 1, gpu: 4.5 } });
  r = await A.executer(juste.io);
  assert.deepEqual(juste.visites, ['medium', 'high']); assert.equal(r.selection, 'high');
  const lourd = appareilFin({ medium: { cpu: 1, gpu: 2 }, high: { cpu: 1, gpu: 3.5 }, extreme: { cpu: 1, gpu: 9.5 } });
  r = await A.executer(lourd.io);
  assert.deepEqual(lourd.visites, ['medium', 'high', 'extreme']); assert.equal(r.selection, 'high');
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
  assert.equal(A.bilanCout('medium', vingtQuatre(10), [], [], []).acceptable, true);
  assert.equal(A.bilanCout('medium', vingtQuatre(10.01), [], [], []).acceptable, false);
  assert.equal(A.bilanCout('medium', Array(23).fill(1), [], [], []).acceptable, false, 'trop peu d images');
  assert.equal(A.LIMITE, A.BUDGET * A.FRACTION);
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
