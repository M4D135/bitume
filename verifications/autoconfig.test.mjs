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
await verifier('les réglages ne touchent ni au moment de la course ni aux commandes', () => {
  for (const id of Object.keys(A.profils)) assert.deepEqual(Object.keys(A.reglages(id)), [...A.CLES]);
  assert.equal(A.reglages('inconnu'), null);
  const original = { moment: 'nuit', meteo: 'pluie', pneus: 'pluie', aide: .2, qualite: 'high', vegetation: 'ultra', faune: 'ultra' };
  Object.assign(original, A.reglages('low'));
  assert.equal(original.moment, 'nuit'); assert.equal(original.meteo, 'pluie'); assert.equal(original.aide, .2);
  assert.equal(original.vegetation, 'off'); assert.equal(original.faune, 'off');
});
console.log(`${controles} contrôles de détection graphique réussis.`);
