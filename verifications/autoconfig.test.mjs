import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/autoconfig.js');
const A = globalThis.BITUME.autoconfig;
let controles = 0;
async function verifier(nom, f) { await f(); controles++; console.log('ok ' + nom); }
const proche = (a, b, nom, ecart = 1e-3) => assert.ok(Math.abs(a - b) < ecart, nom + ' : ' + a + ' au lieu de ' + b);

// Machine simulée. dessiner occupe le processeur (cpu ms) puis remet l'image à la carte, qui l'exécute (gpu ms) dès
// qu'elle est libre : processeur et carte travaillent en même temps, comme en course. terminer attend la fin du travail
// de la carte (lecture d'un pixel). Le rappel d'image suivant tombe à la première période libre de l'écran.
// charges[id] : { cpu, gpu, vues: [gpu par point de vue], glace: { gpu, tous }, premiere: ms de compilation }.
// Les glaces ne coûtent qu'une fois activées (activerGlaces), une toutes les « tous » images du cockpit (vue 0).
// options.pas : temps d'un pas de simulation (ms), ou liste par appel de simuler ; options.pics[id][k] : millisecondes
// de carte ajoutées à la k-ième image du palier id (0 : la première après son décor).
function machine(charges, options = {}) {
  const periode = options.periode || 1000 / 60;
  let horloge = 0, vsync = 0, carte = 0, id = null, appels = 0, cockpit = 0, glacesActives = false, premiere = false;
  let imagesPalier = 0, appelsSimulation = 0;
  const visites = [], preparations = [], suivi = { dessins: 0, avant: 0, simulation: 0, activations: 0, fins: 0, sondes: 0, progressions: [] };
  const io = {
    maintenant: () => horloge,
    empreinte: () => 'machine',
    annule: () => !!options.annuler && appels > 20,
    masque: () => !!options.masquer && appels > 20,
    perdu: () => !!options.perdre && appels > 20,
    image: async () => {
      appels++;
      if (options.sansCadence && appels > 20) return null;
      vsync = Math.max(vsync + periode, Math.ceil(horloge / periode - 1e-9) * periode);
      horloge = vsync; return horloge;
    },
    preparer: (choix, profil, reglage) => {
      assert.equal(profil, A.profils[choix]);
      id = choix; visites.push(choix); preparations.push(reglage); cockpit = 0; glacesActives = false; premiere = true; imagesPalier = 0;
      horloge += options.preparation?.[choix] ?? 0;
      return options.infos?.[choix] ?? { glaces: 'differees', glacesParImage: choix === 'medium' ? .5 : 1, toile: [1920, 1080] };
    },
    activerGlaces: () => {
      suivi.activations++;
      const r = options.glaces?.[id] ?? { glaces: 'dessinees', glacesParImage: id === 'medium' ? .5 : 1 };
      glacesActives = r.glaces === 'dessinees'; return r;
    },
    simuler: n => {
      const p = Array.isArray(options.pas) ? options.pas[Math.min(appelsSimulation, options.pas.length - 1)] : options.pas || 0;
      appelsSimulation++; suivi.simulation += n; horloge += n * p;
    },
    dessiner: (temps, vue) => {
      assert.ok(vue >= 0 && vue < 3 && Number.isFinite(temps));
      if (id === null) suivi.avant++;
      const c = charges[id] || { cpu: 1, gpu: 2 };
      const glace = glacesActives && c.glace && vue === 0 && ++cockpit % c.glace.tous === 0 ? c.glace.gpu : 0;
      horloge += c.cpu + (premiere ? c.premiere || 0 : 0); premiere = false;
      const pic = options.pics?.[id]?.[imagesPalier++] || 0;
      carte = Math.max(carte, horloge) + (c.vues ? c.vues[vue] : c.gpu) + glace + pic;
      suivi.dessins++;
    },
    terminer: () => { suivi.fins++; horloge = Math.max(horloge, carte); },
    progression: (texte, fraction) => { suivi.progressions.push({ texte, fraction }); },
  };
  if (options.sansGlaces) delete io.activerGlaces;
  if (options.sansFin) delete io.terminer;
  // sonde : résultat de la sonde de débit (src/scene-bench.js), ou une erreur qu'elle lève
  if ('sonde' in options) io.sonder = () => {
    suivi.sondes++; assert.equal(id, null, 'sonde avant tout décor');
    if (options.sonde instanceof Error) throw options.sonde;
    horloge += 40; return options.sonde;
  };
  return { io, visites, preparations, suivi };
}

// ------------------------------------------------------------------ cache (C) et choix du joueur (D)
await verifier('empreinte : version du jeu et machine, rien d’autre', () => {
  const e = A.empreinte('GPU-A|16384|10', '0.2.40');
  assert.equal(e, A.empreinte('GPU-A|16384|10', '0.2.40'), 'même version, même machine');
  assert.notEqual(e, A.empreinte('GPU-A|16384|10', '0.2.41'), 'nouvelle version');
  assert.notEqual(e, A.empreinte('GPU-B|16384|10', '0.2.40'), 'autre carte graphique');
  assert.equal(A.empreinte.length, 2, 'ni fenêtre, ni densité de pixels, ni écran');
  assert.match(e, /^[0-9a-z]+$/);
});
await verifier('cache : même version gardée ; nouvelle version, autre carte ou révision précédente refaites', () => {
  const ici = A.empreinte('GPU-A', '0.2.40');
  const c = { revision: A.REVISION, statut: 'ok', selection: 'medium', empreinte: ici, mesures: [{}] };
  assert.ok(A.cacheValide(c, ici));
  assert.equal(A.cacheValide(c, A.empreinte('GPU-A', '0.2.41')), false, 'nouvelle version');
  assert.equal(A.cacheValide(c, A.empreinte('GPU-B', '0.2.40')), false, 'autre carte graphique');
  assert.equal(A.cacheValide({ ...c, revision: 2 }, ici), false, 'révision 2 (une image à la fois) : refaite une fois');
  assert.equal(A.cacheValide({ ...c, selection: '__proto__' }, ici), false);
  assert.equal(A.cacheValide({ ...c, mesures: [] }, ici), false);
  assert.equal(A.cacheValide(null, ici), false);
  // passée par le joueur : plus redemandée pour cette version ; interrompue : refaite, deux fois au plus
  const passe = { revision: A.REVISION, statut: 'interrompu', motif: 'annule', empreinte: ici, tentatives: 1 };
  assert.ok(A.cacheValide(passe, ici));
  assert.equal(A.cacheValide(passe, A.empreinte('GPU-A', '0.2.41')), false, 'la version suivante la refait');
  const coupe = { ...passe, motif: 'delai' };
  assert.equal(A.cacheValide(coupe, ici), false, 'première interruption : refaite à l’ouverture suivante');
  assert.ok(A.cacheValide({ ...coupe, tentatives: A.TENTATIVES }, ici), 'deuxième interruption : on n’insiste plus');
  // C1 : un onglet passé en arrière-plan n'est jamais un verdict, quel que soit le compte
  const cache = { ...passe, motif: 'onglet_masque' };
  for (const t of [0, 1, A.TENTATIVES, 9]) assert.equal(A.cacheValide({ ...cache, tentatives: t }, ici), false, 'onglet caché, ' + t);
  assert.equal(A.tentatives({ ...coupe, tentatives: 1 }, { empreinte: ici, motif: 'onglet_masque' }), 1, 'onglet caché : pas compté');
  // écran bridé à 30 Hz pendant la mesure : verdict provisoire, refait ; deux mesures bridées de suite valent verdict
  const bridee = { ...c, cadenceBridee: true, tentatives: 1 };
  assert.equal(A.cacheValide(bridee, ici), false, 'mesure bridée : refaite à l’ouverture suivante');
  assert.equal(A.cacheValide({ ...bridee, tentatives: undefined }, ici), false);
  assert.ok(A.cacheValide({ ...bridee, tentatives: A.TENTATIVES }, ici), 'bridée deux fois : c’est l’état de la machine');
  assert.equal(A.tentatives(bridee, { empreinte: ici }), 2);
  assert.equal(A.tentatives(bridee, { empreinte: A.empreinte('GPU-A', '0.2.41') }), 1, 'nouvelle version : compte remis à un');
  assert.equal(A.tentatives(null, { empreinte: ici }), 1);
});
await verifier('référence des choix : celle notée par la détection, ou les réglages d’une détection de la révision 2', () => {
  const moyen = A.reglages('medium');
  assert.deepEqual(A.reference({ statut: 'ok', appliques: { ...moyen, vegetation: 'high' }, reglages: moyen }), { ...moyen, vegetation: 'high' });
  assert.deepEqual(A.reference({ revision: 2, statut: 'ok', reglages: moyen }), moyen);
  assert.equal(A.reference({ statut: 'interrompu', motif: 'annule' }), null);
  assert.equal(A.reference({ statut: 'ok', reglages: { qualite: 'medium' } }), null, 'six valeurs ou rien');
  assert.equal(A.reference(null), null);
});
await verifier('fusion automatique : les options touchées par le joueur restent, les autres suivent la recommandation', () => {
  const avant = A.reglages('medium'), fine = A.reglages('high');
  const joueur = { ...avant, vegetation: 'ultra', ombres: 'off' };
  const f = A.fusionner(joueur, avant, fine, false);
  assert.deepEqual(f.valeurs, { ...fine, vegetation: 'ultra', ombres: 'off' });
  assert.deepEqual(f.gardes, ['ombres', 'vegetation']);
  // la référence garde, pour les options du joueur, ce que la détection avait posé : la version suivante les respecte
  assert.deepEqual(f.reference, { ...fine, vegetation: avant.vegetation, ombres: avant.ombres });
  const suite = A.fusionner(f.valeurs, f.reference, A.reglages('low'), false);
  assert.equal(suite.valeurs.vegetation, 'ultra'); assert.equal(suite.valeurs.ombres, 'off'); assert.equal(suite.valeurs.qualite, 'low');
  // rien de touché : tout est appliqué, rien n'est gardé
  const net = A.fusionner(avant, avant, fine, false);
  assert.deepEqual(net.valeurs, fine); assert.deepEqual(net.gardes, []); assert.deepEqual(net.reference, fine);
  // un choix du joueur égal à la recommandation n'est pas annoncé comme gardé
  const egal = A.fusionner({ ...avant, qualite: 'high' }, avant, fine, false);
  assert.deepEqual(egal.gardes, []); assert.equal(egal.valeurs.qualite, 'high');
});
await verifier('fusion à la main : tout est remplacé, même les options touchées', () => {
  const avant = A.reglages('medium'), joueur = { ...avant, vegetation: 'ultra', retro: 'non' };
  const f = A.fusionner(joueur, avant, A.reglages('low'), true);
  assert.deepEqual(f.valeurs, A.reglages('low')); assert.deepEqual(f.gardes, []); assert.deepEqual(f.reference, A.reglages('low'));
});
await verifier('trace d’une détection passée ou interrompue : tentatives comptées par version, référence gardée', () => {
  const ici = A.empreinte('GPU-A', '0.2.40'), ref = A.reglages('medium');
  const precedent = { revision: A.REVISION, statut: 'ok', empreinte: A.empreinte('GPU-A', '0.2.39'), appliques: ref };
  let m = A.marquer(precedent, { statut: 'interrompu', motif: 'contexte_perdu', empreinte: ici });
  assert.equal(m.statut, 'interrompu'); assert.equal(m.motif, 'contexte_perdu'); assert.equal(m.tentatives, 1);
  assert.deepEqual(m.appliques, ref); assert.equal(A.cacheValide(m, ici), false);
  // C1 : l'onglet caché laisse une trace sans tentative de plus ; le test reviendra
  m = A.marquer(m, { statut: 'interrompu', motif: 'onglet_masque', empreinte: ici });
  assert.equal(m.tentatives, 1); assert.equal(A.cacheValide(m, ici), false); assert.deepEqual(m.appliques, ref);
  m = A.marquer(m, { statut: 'interrompu', motif: 'delai', empreinte: ici });
  assert.equal(m.tentatives, 2); assert.ok(A.cacheValide(m, ici)); assert.deepEqual(m.appliques, ref);
  m = A.marquer(m, { statut: 'interrompu', motif: 'annule', empreinte: A.empreinte('GPU-A', '0.2.41') });
  assert.equal(m.tentatives, 1, 'nouvelle version : compte remis à un');
  assert.equal(A.marquer(null, { statut: 'interrompu', empreinte: ici }).motif, 'erreur');
  assert.equal(A.marquer(null, { statut: 'interrompu', empreinte: ici }).appliques, undefined);
});
await verifier('les réglages ne touchent ni au moment de la course ni aux commandes', () => {
  for (const id of Object.keys(A.profils)) assert.deepEqual(Object.keys(A.reglages(id)), [...A.CLES]);
  assert.equal(A.reglages('inconnu'), null);
  for (const k of A.CLES) assert.equal(typeof A.NOMS[k], 'string');
  const original = { moment: 'nuit', meteo: 'pluie', pneus: 'pluie', aide: .2, qualite: 'high', vegetation: 'ultra', faune: 'ultra' };
  Object.assign(original, A.reglages('low'));
  assert.equal(original.moment, 'nuit'); assert.equal(original.meteo, 'pluie'); assert.equal(original.aide, .2);
  assert.equal(original.vegetation, 'off'); assert.equal(original.faune, 'off');
});

// ------------------------------------------------------------------ mesure (A)
await verifier('Apple M5 : Moyenne tient, Fine (deux fois plus de pixels, une glace par image) refusée', async () => {
  const f = machine({ medium: { cpu: 1.5, gpu: 6.5 }, high: { cpu: 3, gpu: 22 } }), r = await A.executer(f.io);
  assert.equal(r.statut, 'ok'); assert.equal(r.methode, 'rafales'); assert.equal(r.selection, 'medium');
  assert.deepEqual(f.visites, ['medium', 'high']);
  const [m, h] = r.mesures;
  assert.equal(m.R, 4); proche(m.cout, 6.5 + 1.5 / 4, 'Moyenne : la carte, plus un quart du processeur');
  assert.equal(m.rafales, 12); assert.equal(m.images, 48); assert.ok(m.parVue.every(v => v.rafales === 4));
  assert.equal(m.acceptable, true); assert.equal(m.glaces, 'dessinees'); assert.deepEqual(m.toile, [1920, 1080]);
  assert.equal(h.R, 2); proche(h.cout, 22 + 3 / 2, 'Fine');
  assert.equal(h.rafales, 6, 'sans espoir : deux rafales par point de vue suffisent'); assert.equal(h.acceptable, false);
  proche(r.budget, 1000 / 60, 'budget'); assert.equal(r.fraction, A.FRACTION); proche(r.limite, A.LIMITE, 'limite');
  assert.ok(Number.isFinite(m.preparation) && Number.isFinite(m.duree));
  assert.equal(f.suivi.progressions.at(-1).fraction, 1);
});
await verifier('rafales : le recouvrement du processeur et de la carte est compté (14,4 ms en série, 12,8 en rafale)', async () => {
  const f = machine({ medium: { cpu: 2.4, gpu: 12 }, high: { cpu: 3, gpu: 30 } }), r = await A.executer(f.io);
  const m = r.mesures[0];
  assert.ok(m.chauffe.slice(3).every(ms => Math.abs(ms - 14.4) < 1e-6), 'une image à la fois : ' + m.chauffe);
  assert.ok(14.4 > A.LIMITE, 'en série, Moyenne serait refusée');
  assert.equal(m.R, 3); proche(m.cout, 12 + 2.4 / 3, 'rafale de trois');
  assert.equal(m.acceptable, true); assert.equal(r.selection, 'medium');
});
await verifier('processeur lent : la mesure le paie et refuse Moyenne', async () => {
  const f = machine({ medium: { cpu: 14, gpu: 4 } }), r = await A.executer(f.io);
  proche(r.mesures[0].cout, 14 + 4 / 2, 'le processeur borne la cadence');
  proche(r.mesures[0].cpu, 14, 'part du processeur relevée');
  assert.equal(r.mesures[0].acceptable, false); assert.equal(r.selection, 'low'); assert.deepEqual(f.visites, ['medium']);
});
await verifier('fil principal : estimé en course à 3 fois celui du parcours, il tient dans la moitié du budget', async () => {
  // M5 ralenti quatre fois (18/11) : la rafale tient sous la limite, mais 5 ms de fil principal au parcours font
  // 15 ms estimés en course, où Moyenne ratait 14 à 95 images en 10 s.
  const f = machine({ medium: { cpu: 5, gpu: 6 } }), r = await A.executer(f.io), m = r.mesures[0];
  assert.ok(m.cout <= m.limite, 'la rafale seule passerait : ' + m.cout);
  proche(m.processeur, 5 * A.COURSE_PROCESSEUR, 'fil principal estimé'); proche(m.limiteProcesseur, A.BUDGET * A.PART_PROCESSEUR, 'sa limite');
  assert.equal(m.acceptable, false); assert.equal(r.selection, 'low'); assert.deepEqual(f.visites, ['medium']);
  // Même ralenti, machine peu chargée : 3,3 ms au parcours (le 18/11), 9,9 estimés : refusée
  const h = machine({ medium: { cpu: 3.3, gpu: 6 } }), u = await A.executer(h.io);
  proche(u.mesures[0].processeur, 9.9, 'ralenti, peu chargé'); assert.equal(u.selection, 'low');
  // M5 au rythme normal : 1,5 ms au parcours, 4,5 ms estimés en course (2,15 ms au plus relevés en fenêtre : 6,45)
  const g = machine({ medium: { cpu: 1.5, gpu: 6.5 }, high: { cpu: 3, gpu: 22 } }), s = await A.executer(g.io);
  proche(s.mesures[0].processeur, 4.5, 'M5'); assert.equal(s.mesures[0].acceptable, true); assert.equal(s.selection, 'medium');
  const k = machine({ medium: { cpu: 2.15, gpu: 6 }, high: { cpu: 3, gpu: 22 } }), w = await A.executer(k.io);
  assert.equal(w.selection, 'medium', 'M5 le plus chargé relevé en fenêtre');
  // limite incluse ; le point de vue au fil principal le plus chargé juge
  const seuil = A.LIMITE_PROCESSEUR / A.COURSE_PROCESSEUR;
  const rafales = cpu => [0, 1, 2].flatMap(vue => Array(2).fill(0).map(() => ({ vue, n: 4, cout: 8, cpu: vue === 1 ? cpu : 1 })));
  assert.equal(A.bilanRafales('medium', rafales(seuil - 1e-3)).acceptable, true);
  assert.equal(A.bilanRafales('medium', rafales(seuil + .01)).acceptable, false);
  proche(A.bilanRafales('medium', rafales(3)).processeur, 3 * A.COURSE_PROCESSEUR, 'la poursuite juge ici');
  assert.equal(A.bilanRafales('medium', rafales(NaN).map(x => ({ ...x, cpu: NaN }))).acceptable, false, 'sans relevé du processeur');
});
await verifier('carte très lente : Légère conclue en trois images de Moyenne, sans créer le moteur des glaces', async () => {
  const f = machine({ medium: { cpu: 25, gpu: 400, premiere: 900 } }), r = await A.executer(f.io);
  assert.equal(r.statut, 'ok'); assert.equal(r.selection, 'low'); assert.deepEqual(f.visites, ['medium']);
  const m = r.mesures[0];
  assert.equal(m.sansEspoir, true); assert.equal(m.images, 3); assert.equal(m.rafales, 0); assert.equal(m.acceptable, false);
  assert.equal(f.suivi.activations, 0, 'aucun second contexte pour une machine sans espoir');
  assert.ok(r.duree < 2.5, 'conclusion rapide : ' + r.duree + ' s');
});
await verifier('sonde : un rendu logiciel conclut Légère sans bâtir le décor de Moyenne ; une carte graphique continue', async () => {
  // SwiftShader, le 18/11 : 8,5 à 13 ms par passe de sonde ; le décor et la première image de Moyenne figeaient la page
  const f = machine({ medium: { cpu: 25, gpu: 400, premiere: 900 } }, { sonde: { passes: [9.5, 13.2, 11.5], premiere: 41, taille: [512, 512] } });
  const r = await A.executer(f.io);
  assert.equal(r.statut, 'ok'); assert.equal(r.selection, 'low'); assert.deepEqual(f.visites, [], 'aucun décor bâti');
  assert.equal(f.suivi.dessins, 0); assert.equal(f.suivi.sondes, 1);
  const m = r.mesures[0];
  assert.equal(m.profil, 'medium'); assert.equal(m.sansEspoir, true); assert.equal(m.acceptable, false);
  proche(m.sonde.passe, 11.5, 'médiane des passes'); assert.deepEqual(r.sonde, m.sonde); assert.deepEqual(r.sonde.taille, [512, 512]);
  assert.ok(r.duree < .5, 'conclusion en moins d’une demi-seconde : ' + r.duree + ' s');
  assert.ok(A.cacheValide({ ...r, revision: A.REVISION }, r.empreinte), 'verdict gardé pour la version');
  // carte graphique : la sonde est relevée, la mesure se fait comme avant
  const g = machine({ medium: { cpu: 1.5, gpu: 6.5 }, high: { cpu: 3, gpu: 22 } }, { sonde: { passes: [.4, .7, .5], premiere: 3 } });
  const s = await A.executer(g.io);
  assert.deepEqual(g.visites, ['medium', 'high']); assert.equal(s.selection, 'medium'); proche(s.sonde.passe, .5, 'sonde relevée');
  // limite incluse ; sonde absente, vide, sans nombre ou en erreur : la mesure se fait
  const bord = machine({}, { sonde: { passes: [A.SONDE_MS] } }); await A.executer(bord.io);
  assert.deepEqual(bord.visites.slice(0, 1), ['medium'], 'à la limite, Moyenne est mesurée');
  for (const sonde of [null, { passes: [] }, { passes: [NaN] }, new Error('contexte refusé')]) {
    const h = machine({}, { sonde }), t = await A.executer(h.io);
    assert.equal(t.statut, 'ok'); assert.deepEqual(h.visites.slice(0, 1), ['medium']); assert.equal(t.sonde, null);
  }
  const sans = await A.executer(machine({}).io); assert.equal(sans.sonde, null, 'parcours sans sonde');
});
await verifier('rendu logiciel reconnu par la sonde, processeur trop lent pour la simulation : Légère sans aucun décor', async () => {
  const f = machine({}, { sonde: { logiciel: true, passes: [], premiere: null, taille: [512, 512] } }), r = await A.executer(f.io);
  assert.equal(r.selection, 'low'); assert.deepEqual(f.visites, []); assert.equal(r.mesures[0].motif, 'logiciel');
  assert.equal(r.sonde.logiciel, true); assert.ok(r.duree < .5, r.duree + ' s');
  // simulation : 0,9 ms par pas, soit 28,8 ms estimés pour la boucle de la course, confirmés après la sonde
  const lent = machine({}, { pas: .9, sonde: { passes: [.5, .5, .5] } }), s = await A.executer(lent.io);
  assert.equal(s.selection, 'low'); assert.deepEqual(lent.visites, []); assert.equal(lent.suivi.sondes, 1);
  assert.equal(s.mesures[0].motif, 'processeur'); proche(s.simulation.pasMs, .9, 'pas'); proche(s.simulation.processeur, .9 * 2 * A.COURSE_SIMULATION, 'boucle estimée');
  proche(s.simulation.confirmation, .9, 'confirmé'); assert.equal(s.simulation.pas.length, 8); assert.equal(s.simulation.pasConfirmation.length, 4);
  assert.equal(lent.suivi.simulation, 12 * 15, 'douze appels de quinze pas');
  assert.ok(s.duree < .5 + 12 * 15 * .9 / 1000, s.duree + ' s');
  // quelques images lentes sur une machine rapide (0,58 ms par pas sur le M5, une fois) : non confirmées, mesuré
  const pic = machine({ medium: { cpu: 1.5, gpu: 6.5 }, high: { cpu: 3, gpu: 22 } }, { pas: [.1, .1, .1, .1, .6, .6, .6, .6, .1] });
  const p = await A.executer(pic.io);
  proche(p.simulation.pasMs, .6, 'images lentes'); proche(p.simulation.confirmation, .1, 'puis rapides');
  assert.equal(p.selection, 'medium'); assert.deepEqual(pic.visites, ['medium', 'high']);
  // simulation rapide : aucune confirmation demandée
  const vite = machine({}, { pas: .1 }), v = await A.executer(vite.io);
  assert.equal(v.simulation.confirmation, undefined); assert.equal(vite.suivi.simulation, 8 * 15);
  // M5 très chargé : 0,25 ms par pas, 8 ms estimés ; la mesure se fait. À un budget près : mesuré.
  const m5 = machine({ medium: { cpu: 1.5, gpu: 6.5 }, high: { cpu: 3, gpu: 22 } }, { pas: .25 }), t = await A.executer(m5.io);
  assert.equal(t.selection, 'medium'); proche(t.simulation.processeur, 8, 'M5');
  const bord = machine({}, { pas: A.BUDGET / (2 * A.COURSE_SIMULATION) - 1e-6 }); await A.executer(bord.io);
  assert.deepEqual(bord.visites.slice(0, 1), ['medium']);
  const sansSimulation = await A.executer(machine({}).io); proche(sansSimulation.simulation.pasMs, 0, 'simulation instantanée');
});
await verifier('compilation à la première image : pas jugée, le palier reste mesuré', async () => {
  const f = machine({ medium: { cpu: 1, gpu: 6, premiere: 300 }, high: { cpu: 1, gpu: 9, premiere: 300 } }), r = await A.executer(f.io);
  assert.ok(r.mesures[0].chauffe[0] > 300 && !r.mesures[0].sansEspoir);
  assert.equal(r.selection, 'high'); proche(r.mesures[1].cout, 9.25, 'Fine');
});
await verifier('chauffe : deux images de suite au-delà de trois budgets au second tour jugent le palier sans espoir', async () => {
  const f = machine({ medium: { cpu: 5, gpu: 47 } }), r = await A.executer(f.io);
  assert.equal(r.mesures[0].sansEspoir, true); assert.equal(r.mesures[0].images, 5);
  const g = machine({ medium: { cpu: 5, gpu: 40 } }), s = await A.executer(g.io);
  assert.equal(s.mesures[0].sansEspoir, undefined, '45 ms : mesuré en rafales, puis refusé');
  assert.equal(s.mesures[0].acceptable, false); assert.equal(s.mesures[0].rafales, 6);
  // une image seule au-delà (M5, 18/11 : 52 ms au second tour de Moyenne) : la mesure se fait, Moyenne tient
  const pic = machine({ medium: { cpu: 1.5, gpu: 6.5 }, high: { cpu: 3, gpu: 22 } }, { pics: { medium: { 3: 45 } } });
  const p = await A.executer(pic.io);
  assert.ok(p.mesures[0].chauffe[3] > 3 * A.BUDGET, 'pic : ' + p.mesures[0].chauffe);
  assert.equal(p.mesures[0].sansEspoir, undefined); assert.equal(p.selection, 'medium');
  // une seule image très lente après la première : de même
  const pic2 = machine({ medium: { cpu: 1.5, gpu: 6.5 }, high: { cpu: 3, gpu: 22 } }, { pics: { medium: { 1: 150 } } });
  assert.equal((await A.executer(pic2.io)).selection, 'medium');
});
await verifier('limite : juste sous la limite accepté, juste au-dessus refusé', async () => {
  const f = machine({ medium: { cpu: 1, gpu: A.LIMITE - .35 }, high: { cpu: 1, gpu: A.LIMITE - .15 } }), r = await A.executer(f.io);
  assert.equal(r.mesures[0].acceptable, true, 'Moyenne ' + r.mesures[0].cout); assert.equal(r.mesures[1].acceptable, false, 'Fine ' + r.mesures[1].cout);
  assert.equal(r.selection, 'medium');
  assert.equal(A.LIMITE, A.BUDGET * A.FRACTION);
  // ce qui reste hors mesure doit tenir dans le budget : ramassage mineur (2,1 ms au plus), composition et vitre
  assert.ok(A.LIMITE + 2.1 + 1 <= A.BUDGET, 'marge hors mesure : ' + (A.BUDGET - A.LIMITE));
});
await verifier('le point de vue le plus cher juge : le cockpit et ses glaces', async () => {
  // Sans glaces, Fine tient (10,25 ms). Une glace de 4 ms par image du cockpit : 14,25 ms au cockpit, refusée.
  const charges = { medium: { cpu: 1, gpu: 8, glace: { gpu: 1.5, tous: 2 } }, high: { cpu: 1, gpu: 10, glace: { gpu: 4, tous: 1 } } };
  const r = await A.executer(machine(charges).io);
  assert.equal(r.selection, 'medium');
  const h = r.mesures[1];
  proche(h.parVue[0].cout, 14.25, 'Fine au cockpit, glace comprise'); proche(h.parVue[1].cout, 10.25, 'Fine en poursuite');
  proche(h.cout, 14.25, 'le cockpit juge'); assert.equal(h.acceptable, false);
  proche(r.mesures[0].parVue[0].cout, 8.25 + .75, 'Moyenne : une glace sur deux');
  const sans = await A.executer(machine(charges, { glaces: { medium: { glaces: 'aucune', glacesParImage: 0 }, high: { glaces: 'aucune', glacesParImage: 0 } } }).io);
  assert.equal(sans.selection, 'high', 'palier sans glaces : Fine passe');
  // vues différentes : le plus cher des trois, pas la moyenne
  const v = await A.executer(machine({ medium: { cpu: 1, vues: [7, 14, 6] } }).io);
  assert.equal(v.mesures[0].R, 3, 'rafales réglées sur l’image la plus lente de la chauffe (15 ms)');
  proche(v.mesures[0].cout, 14 + 1 / 3, 'vue la plus chère'); assert.equal(v.selection, 'low');
});
await verifier('glaces absentes du parcours : la limite perd leur part', async () => {
  const charges = { medium: { cpu: 1, gpu: 9.75 }, high: { cpu: 1, gpu: 9.75 } };
  const absentes = { medium: { glaces: 'absentes', glacesParImage: .5 }, high: { glaces: 'absentes', glacesParImage: 1 } };
  const r = await A.executer(machine(charges, { glaces: absentes }).io);
  proche(r.mesures[0].limite, A.LIMITE / (1 + A.PART_GLACES / 2), 'Moyenne, une glace une image sur deux');
  proche(r.mesures[1].limite, A.LIMITE / (1 + A.PART_GLACES), 'Fine, une glace par image');
  assert.equal(r.mesures[0].acceptable, true); assert.equal(r.mesures[1].acceptable, false); assert.equal(r.selection, 'medium');
  const dessinees = await A.executer(machine(charges).io);
  assert.equal(dessinees.selection, 'high'); proche(dessinees.mesures[1].limite, A.LIMITE, 'glaces mesurées : limite entière');
  assert.equal(A.limiteProfil(undefined), A.LIMITE); assert.equal(A.limiteProfil({ glaces: 'absentes' }), A.LIMITE / (1 + A.PART_GLACES));
});
await verifier('écran bridé à 30 Hz ou écran à 120 Hz : mêmes coûts, même verdict, bridage reconnu', async () => {
  const charges = { medium: { cpu: 1.5, gpu: 6.5 }, high: { cpu: 2, gpu: 12.5 }, extreme: { cpu: 2, gpu: 20 } };
  const a60 = await A.executer(machine(charges).io);
  const a30 = await A.executer(machine(charges, { periode: 1000 / 30 }).io);
  const a120 = await A.executer(machine(charges, { periode: 1000 / 120 }).io);
  assert.equal(a60.selection, 'high');
  for (const a of [a30, a120]) {
    assert.equal(a.selection, a60.selection);
    assert.deepEqual(a.mesures.map(m => m.cout), a60.mesures.map(m => m.cout));
    assert.deepEqual(a.mesures.map(m => m.acceptable), a60.mesures.map(m => m.acceptable));
  }
  proche(a30.cadence, 1000 / 30, 'période consignée'); assert.equal(a30.cadenceBridee, true);
  assert.equal(a60.cadenceBridee, false); assert.equal(a120.cadenceBridee, false); proche(a120.cadence, 1000 / 120, '120 Hz');
});
await verifier('Extrême essayé seulement si Fine tient dans la moitié de la limite', async () => {
  const large = machine({ medium: { cpu: 1, gpu: 2 }, high: { cpu: 1, gpu: 3.5 }, extreme: { cpu: 1, gpu: 8 } });
  let r = await A.executer(large.io);
  assert.deepEqual(large.visites, ['medium', 'high', 'extreme']); assert.equal(r.selection, 'extreme');
  assert.equal(r.reglages.vegetation, 'ultra'); assert.equal(r.reglages.faune, 'ultra');
  const juste = machine({ medium: { cpu: 1, gpu: 2 }, high: { cpu: 1, gpu: 6.6 } });
  r = await A.executer(juste.io);
  assert.deepEqual(juste.visites, ['medium', 'high']); assert.equal(r.selection, 'high');
  const lourd = machine({ medium: { cpu: 1, gpu: 2 }, high: { cpu: 1, gpu: 3.5 }, extreme: { cpu: 1, gpu: 14 } });
  r = await A.executer(lourd.io);
  assert.deepEqual(lourd.visites, ['medium', 'high', 'extreme']); assert.equal(r.selection, 'high');
  assert.equal(A.peutEssayerExtreme({ profil: 'high', acceptable: true, cout: 6, limite: 13.333 }), true);
  assert.equal(A.peutEssayerExtreme({ profil: 'high', acceptable: true, cout: 7, limite: 13.333 }), false);
});
await verifier('cadence relevée sur des images à vide ; la simulation y chauffe ; préparation sans chronomètre GPU', async () => {
  const f = machine({ medium: { cpu: 1, gpu: 5 }, high: { cpu: 1, gpu: 20 } }), r = await A.executer(f.io);
  assert.equal(f.suivi.avant, 0, 'aucune image dessinée avant la mesure de la cadence');
  assert.equal(r.cadenceIntervalles, 9); proche(r.cadence, 1000 / 60, 'période'); assert.equal(r.cadenceEcart, 0);
  assert.ok(r.mesures.every(m => Number.isFinite(m.glacesMs)), 'chargement des glaces chronométré');
  assert.equal(f.suivi.simulation, 8 * 15, 'une seconde de course simulée, à vide');
  assert.ok(f.preparations.every(p => p && p.chronoGPU === false && p.glaces === 'differees'));
  assert.equal(f.suivi.activations, 2, 'glaces activées après la chauffe de chaque palier mesuré');
  assert.ok(f.suivi.fins >= r.mesures.reduce((s, m) => s + m.rafales, 0), 'chaque rafale est terminée');
  const sans = machine({}, { sansGlaces: true });
  await A.executer(sans.io);
  assert.ok(sans.preparations.every(p => p.glaces === undefined), 'parcours sans glaces différées');
});
await verifier('bilan : chaque point de vue mesuré deux fois au moins, la limite est incluse', () => {
  const rafales = v => [0, 1, 2].flatMap(vue => Array(v).fill(0).map(() => ({ vue, n: 4, cout: A.LIMITE, cpu: 1 })));
  assert.equal(A.bilanRafales('medium', rafales(2)).acceptable, true);
  assert.equal(A.bilanRafales('medium', rafales(1)).acceptable, false, 'une rafale par point de vue');
  assert.equal(A.bilanRafales('medium', rafales(2).map(r => ({ ...r, cout: A.LIMITE + .01 }))).acceptable, false);
  assert.equal(A.bilanRafales('high', rafales(2), 9.19).acceptable, false, 'limite du palier');
  assert.equal(A.bilanRafales('medium', rafales(2).filter(r => r.vue !== 2)).acceptable, false, 'point de vue manquant');
  assert.equal(A.choisir([]), 'low'); assert.equal(A.choisir([{ profil: 'high', acceptable: true }, { profil: 'medium', acceptable: true }]), 'high');
});
await verifier('six secondes au pire : un palier de plus n’est essayé que s’il y tient', async () => {
  const charges = { medium: { cpu: 1, gpu: 5 }, high: { cpu: 1, gpu: 7 } };
  const tient = machine(charges, { preparation: { medium: 2000 } }), r = await A.executer(tient.io);
  assert.deepEqual(tient.visites, ['medium', 'high']); assert.equal(r.selection, 'high'); assert.ok(r.duree <= A.DUREE_MAX / 1000, r.duree + ' s');
  const juste = machine(charges, { preparation: { medium: 3000 } }), s = await A.executer(juste.io);
  assert.deepEqual(juste.visites, ['medium'], 'Moyenne en 3,4 s : Fine ne tiendrait pas dans les six secondes');
  assert.equal(s.selection, 'medium'); assert.equal(s.partiel, false); assert.ok(s.duree < A.DUREE_MAX / 1000);
  // Un décor de Fine juste sous la limite : Fine est mesurée, mais Extrême ne tiendrait plus dans les six secondes.
  const fin = machine({ medium: { cpu: 1, gpu: 3 }, high: { cpu: 1, gpu: 4 }, extreme: { cpu: 1, gpu: 5 } }, { preparation: { high: A.PREPARATION_MAX } });
  const u = await A.executer(fin.io);
  assert.deepEqual(fin.visites, ['medium', 'high'], 'un palier valide n’est pas jeté à cause du temps'); assert.equal(u.selection, 'high'); assert.equal(u.partiel, false);
});
await verifier('décor trop long : le palier n’est pas mesuré (Légère si c’est Moyenne), en peu de temps', async () => {
  const lent = machine({ medium: { cpu: 1, gpu: 5 } }, { preparation: { medium: A.PREPARATION_MAX + 1 } }), t = await A.executer(lent.io);
  assert.equal(t.statut, 'ok'); assert.equal(t.selection, 'low'); assert.equal(t.partiel, false);
  assert.deepEqual(lent.visites, ['medium']); assert.equal(lent.suivi.dessins, 0, 'aucune image mesurée');
  assert.equal(lent.suivi.activations, 0, 'glaces jamais chargées');
  const m = t.mesures[0];
  assert.equal(m.motif, 'preparation'); assert.equal(m.sansEspoir, true); assert.equal(m.acceptable, false);
  assert.equal(m.preparation, A.PREPARATION_MAX + 1); assert.ok(t.duree < (A.PREPARATION_MAX + 500) / 1000, t.duree + ' s');
  assert.ok(A.cacheValide(t, 'machine'), 'verdict mémorisé : Légère ne revient pas à chaque ouverture');
  // à la limite : mesuré
  const juste = machine({ medium: { cpu: 1, gpu: 5 } }, { preparation: { medium: A.PREPARATION_MAX } }), s = await A.executer(juste.io);
  assert.equal(s.selection, 'medium'); assert.ok(lent.suivi.dessins === 0 && juste.suivi.dessins > 0);
  // Fine au décor trop long : Moyenne, mesurée, reste le verdict
  const fine = machine({ medium: { cpu: 1, gpu: 3 }, high: { cpu: 1, gpu: 4 } }, { preparation: { high: A.PREPARATION_MAX + 1 } }), f = await A.executer(fine.io);
  assert.deepEqual(fine.visites, ['medium', 'high']); assert.equal(f.selection, 'medium'); assert.equal(f.mesures[1].motif, 'preparation');
});
await verifier('délai pendant un palier de plus : le palier mesuré tient ; avant toute mesure : interrompu', async () => {
  const debord = machine({}, { preparation: { medium: 1000, high: A.DELAI } });
  const p = await A.executer(debord.io);
  assert.deepEqual(debord.visites, ['medium', 'high']);
  assert.equal(p.statut, 'ok'); assert.equal(p.selection, 'medium'); assert.equal(p.partiel, true);
  const bloque = machine({}, { preparation: { medium: A.DELAI + 1 } }), q = await A.executer(bloque.io);
  assert.equal(q.statut, 'interrompu'); assert.equal(q.motif, 'delai'); assert.equal(q.reglages, undefined);
});
await verifier('annulation, onglet masqué, contexte perdu et rappel d’image bloqué ne donnent aucun réglage', async () => {
  for (const [option, motif] of [['annuler', 'annule'], ['masquer', 'onglet_masque'], ['perdre', 'contexte_perdu'], ['sansCadence', 'cadence_indisponible']]) {
    const f = machine({}, { [option]: true }), r = await A.executer(f.io);
    assert.equal(r.statut, 'interrompu', option); assert.equal(r.motif, motif); assert.equal(r.reglages, undefined);
    assert.equal(r.empreinte, 'machine'); assert.equal(r.methode, 'rafales');
  }
  const f = machine({}, { sansFin: true }), r = await A.executer(f.io);
  assert.equal(r.statut, 'interrompu'); assert.equal(r.motif, 'mesure_impossible'); assert.deepEqual(f.visites, [], 'sans fin forcée, rien n’est mesuré');
});
console.log(`${controles} contrôles de détection graphique réussis.`);
