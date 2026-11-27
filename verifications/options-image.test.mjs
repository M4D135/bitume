// Intégration des vraies fonctions de jeu.js : les frontières DOM/renderer sont remplacées, pas les décisions.
// Ces contrôles ne qualifient pas WebGL ; tools/controle-options.mjs prépare le parcours navigateur réel.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
require('../src/graphismes.js');
require('../src/detail-peripherique.js');
require('../src/pneus.js');
require('../src/ambiance.js');
require('../src/saisons.js');
require('../src/chaussee.js');
require('../src/meteo.js');
require('../src/conditions-course.js');
require('../src/qualite.js');
// la lecture des réglages normalise aussi la cadence d'images (src/cadence.js, chargé avant jeu.js)
require('../src/cadence.js');
// Dépendance réelle de la lecture des réglages, même pour un banc limité aux options Image.
require('../src/menu-arcade.js');
require('../src/championnat.js');
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
function bloc(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a);
  assert.ok(a >= 0 && b > a, 'bloc de production disponible : ' + debut);
  return source.slice(a, b);
}

const executer = new Function('B', 'stockage', `
  const appels = { decor: [], rendu: [], ecritures: [] }, elements = new Map(), ecouteurs = new Map(), radios = new Map();
  const $ = id => { if (!elements.has(id)) elements.set(id, { classList: { add() {} }, dataset: {}, hidden: false }); return elements.get(id); };
  const localStorage = { getItem: k => stockage[k] ?? null, setItem: (k,v) => { stockage[k] = v; appels.ecritures.push(k); } };
  const document = { hidden: false, addEventListener: (k,f) => ecouteurs.set(k,f),
    querySelectorAll: sel => {
      if (!sel.includes('name="moment')) return [];
      const nom=sel.includes('momentDepart')?'momentDepart':'moment';
      if(!radios.has(nom))radios.set(nom,['jour','crepuscule','nuit','cycle'].map(value=>({value,checked:false})));
      return radios.get(nom);
    },
    createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) };
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x)), ramener = (s,l) => ((s%l)+l)%l;
  const CATALOGUE = [{ id: 'essai', graine: 11, theme: 'foret' }], c = { longueur: 1000 };
  const circuit = () => c, plan = () => ({}), dessinerTrace = () => {}, appliquerCarte = () => {};
  const suspendreAnnoncesVirages = () => { appels.annoncesSuspendues = (appels.annoncesSuspendues || 0) + 1; };
  const rendu = { plafondInitial: 2400 * 1350, resize: v => appels.rendu.push(['resize',v]), setMaxPixels: v => appels.rendu.push(['maxPixels',v]),
    setWorld: (...args) => appels.rendu.push(['world',...args]), setNappes: v => appels.rendu.push(['nappes',v]), setLots: v => appels.rendu.push(['lots',v]) };
  const gpuModeste = false, EL = { role: null }, retro = { j1: null, j2: null };
  let scene = null, session = null, decorEnrichi = true, graineCourse = 0, cameraEssai = null, horlogeReelle = 0, tPrec = 0, dureeImage = 16, ecran = 'titre';
  const remplirPoses = () => {}, aller = nom => { ecran = nom; }, majPreparation = () => {}, afficherConditions = () => {}, actualiserConditions = () => {};
  B = { ...B,
    decor: { construire: (c,o) => { appels.decor.push(o); return { nappes: [], lots: [], obstacles: [], atmosphere: { sunDirection: [1,1,0] } }; } },
    obstacles: { creer: objets => ({ objets }) },
    conduite: { PARAMS: { vitessePointe: [20,40,60,80,100], maxUtile: 8000, ralenti: 900 }, pneusConseilles: () => 'slicks', eauSurPiste: () => 0 },
    circuit: { ecart: (c,a,b) => b-a, echantillon: () => ({ y: 0, devers: 0, pente: 0 }) },
    mesures: { reinitialiser() {} }
  };
  ${bloc('  function initialiserChoixPneus(', '  function choixPneusLocaux(')}
  ${bloc('  function lireStock(', '  // records et fantômes')}
  ${bloc('  const palier = ', '  // effets permis par le profil résolu')}
  capacitesRendu = B.graphismes.capacites({ msaa: 4, shadowMapScale: 2 }, false, 1);
  B.graphismes.stabiliser(etatProfils, reglages.qualite, 0, 0);
  ${bloc('  const PORTEE_VUE = ', '  // ---------------------------------------------------------------- séances')}
  function lancer(type, i) {
    restaurerReference();
    const sc = installer(i), joueur = { id: 0, joueur: true, etat: { s: 0, d: 0, v: 0 } };
    session = { type, i, c: sc.c, locaux: [0], cour: [], prec: [], meteo: {}, course: {
      joueur, voitures: [joueur], feux: {}, sAvant: new Float64Array(1)
    } };
    return session;
  }
  // la cadence de la boucle, créée comme dans jeu.js avec le réglage lu
  const cadence = B.cadence.creer({ hz: 120, maxPas: 14, mode: reglages.cadence });
  const RANGS_VUE = { vue: 0, vue2: 1, vue3: 2, vue4: 3, vuePret: 0, vuePret2: 1, vuePret3: 2, vuePret4: 3,
    vueDepart: 0, vueDepart2: 1, vueDepart3: 2, vueDepart4: 3 };
  const reglerVue = () => {};
  ${bloc("  document.addEventListener('change', e => {", "  for (const nom of ['general', 'moteur', 'effets'])")}
  ${bloc('  function restaurerReference()', '  // Banc (console)')}
  ${bloc('  function meteoPourConditions(', '  function surfaceAnnoncee(')}
  lancer('course',0);
  return { reglages, stockage, appels, radios, installer, reference, restaurerReference, lancer,
    preparer: () => { ecran = 'preparation'; }, enCourse: () => { ecran = 'course'; },
    lireStock, ecrireStock, differerStock, viderStock,
    get session() { return session; }, get scene() { return scene; }, get profil() { return profilDe(session); },
    etatCadence: () => B.cadence.etat(cadence),
    choisir: (name,value) => ecouteurs.get('change')({ target: { name, value } }) };
`);
function jeu(prefs = {}) {
  const stockage = { 'bitume.reglages': JSON.stringify(prefs) };
  return executer(globalThis.BITUME, stockage);
}
const options = x => Object.fromEntries(['anticrenelage','ombres','vegetation'].map(k => [k,x[k]]));
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok ' + nom); }

verifier('champ cockpit : défaut 70 degrés, choix mémorisés conservés et référence fidèle au défaut', () => {
  assert.equal(jeu().reglages.champ, 70);
  for (const champ of [60, 70, 95, 105]) assert.equal(jeu({ champ }).reglages.champ, champ);
  const j = jeu({ champ: 95 });
  j.reference(); assert.equal(j.reglages.champ, 70);
  j.restaurerReference(); assert.equal(j.reglages.champ, 95);
});

verifier('annonces de virage : désactivées par défaut, trois choix persistés, valeurs invalides refusées', () => {
  assert.equal(jeu().reglages.annoncesVirages,'non');
  assert.equal(jeu({annoncesVirages:'inconnue'}).reglages.annoncesVirages,'non');
  for (const mode of ['non','ecran','voix']) {
    const j=jeu(); j.choisir('annoncesVirages',mode);
    assert.equal(j.reglages.annoncesVirages,mode);
    assert.equal(jeu(JSON.parse(j.stockage['bitume.reglages'])).reglages.annoncesVirages,mode);
    assert.equal(j.appels.annoncesSuspendues,1,'changement de mode coupe la phrase précédente');
    j.choisir('annoncesVirages','inconnue'); assert.equal(j.reglages.annoncesVirages,mode);
    assert.equal(j.appels.annoncesSuspendues,1);
  }
});

verifier('chargement : anciennes préférences et choix invalides reprennent le profil', () => {
  for (const prefs of [{ qualite: 'low' }, { anticrenelage: 'impossible', ombres: 5, vegetation: null }]) {
    assert.deepEqual(options(jeu(prefs).reglages), { anticrenelage: 'profil', ombres: 'profil', vegetation: 'profil' });
  }
  const j = jeu({ qualite: 'Légère', anticrenelage: ' MSAA4 ', ombres: 'HIGH', vegetation: ' Ultra ' });
  assert.equal(j.reglages.qualite, 'low');
  assert.deepEqual(options(j.reglages), { anticrenelage: 'msaa4', ombres: 'high', vegetation: 'ultra' });
  assert.equal(j.scene.vegetationQualite, 'ultra');
});

verifier('gestionnaire change : les trois choix sont sauvegardés et rechargés', () => {
  const j = jeu();
  for (const [cle, valeur] of Object.entries({ anticrenelage: 'off', ombres: 'medium', vegetation: 'high' })) j.choisir(cle,valeur);
  assert.equal(j.appels.ecritures.length,3);
  const stocke = JSON.parse(j.stockage['bitume.reglages']);
  assert.deepEqual(options(stocke), { anticrenelage: 'off', ombres: 'medium', vegetation: 'high' });
  assert.deepEqual(options(jeu(stocke).reglages), options(stocke));
  j.choisir('vegetation','inconnue');
  assert.equal(j.reglages.vegetation,'profil');
  assert.equal(JSON.parse(j.stockage['bitume.reglages']).vegetation,'profil');
});

verifier('cadence : valeur normalisée au chargement, choix du menu sauvegardé et donné à la cadence', () => {
  for (const [stocke, attendu] of [[undefined, 'auto'], ['Écran', 'ecran'], [' 60 ', '60'], [120, '120'], ['144', 'auto'], ['n importe', 'auto']])
    assert.equal(jeu(stocke === undefined ? {} : { cadence: stocke }).reglages.cadence, attendu, String(stocke));
  const j = jeu();
  assert.equal(j.etatCadence().mode, 'auto');
  j.choisir('cadence', '30');
  assert.equal(j.reglages.cadence, '30'); assert.equal(JSON.parse(j.stockage['bitume.reglages']).cadence, '30');
  assert.equal(j.etatCadence().mode, '30', 'la boucle suit le menu sans redémarrer');
  assert.equal(jeu(JSON.parse(j.stockage['bitume.reglages'])).reglages.cadence, '30', 'rechargé tel quel');
  j.choisir('cadence', 'bidon');
  assert.equal(j.reglages.cadence, 'auto'); assert.equal(j.etatCadence().mode, 'auto');
});

verifier('faune et moment avant départ : préférences indépendantes persistées', () => {
  const j=jeu({qualite:'low'}), sc=j.scene;
  assert.equal(j.reglages.moment,'jour');assert.equal(j.profil.faune,'low');
  j.choisir('faune','ultra');j.choisir('momentDepart','nuit');
  assert.equal(j.radios.get('momentDepart').find(r=>r.checked).value,'nuit');
  assert.equal(j.profil.faune,'ultra');assert.strictEqual(j.scene,sc,'aucune reconstruction du terrain');
  const prefs=JSON.parse(j.stockage['bitume.reglages']), recharge=jeu(prefs);
  assert.equal(recharge.reglages.faune,'ultra');assert.equal(recharge.reglages.moment,'nuit');
  j.choisir('momentDepart','inconnu');assert.equal(j.reglages.moment,'jour');
  j.choisir('faune','off');assert.equal(j.profil.faune,'off');
  assert.equal(JSON.parse(j.stockage['bitume.reglages']).fauneCoupeeManuellement, true);
});
verifier('saison choisie avant départ : sauvegarde et cache du décor distincts', () => {
  const j = jeu({ saison: 'ete' }), avant = j.scene;
  j.preparer(); j.choisir('saisonDepart', 'hiver');
  j.installer(0); // Reconstruction appelée par la résolution de préparation, qualifiée dans conditions-integration.
  assert.equal(j.reglages.saison, 'hiver'); assert.notStrictEqual(j.scene, avant);
  assert.equal(j.scene.saison, 'hiver'); assert.equal(j.appels.decor.at(-1).saison, 'hiver');
  assert.equal(JSON.parse(j.stockage['bitume.reglages']).saison, 'hiver');
  assert.equal(jeu({ saison: 'erreur' }).reglages.saison, 'ete');
  const ref = jeu({ saison: 'automne' }); ref.reference({ saison: 'printemps' });
  assert.equal(ref.reglages.saison, 'printemps'); ref.restaurerReference(); assert.equal(ref.reglages.saison, 'automne');
});

verifier('AA et ombres changent le profil sans reconstruire le circuit ni la séance', () => {
  const j = jeu({ qualite: 'low' }), s = j.session, sc = j.scene, obstacles = sc.c.obstacles;
  const n = j.appels.decor.length;
  j.choisir('anticrenelage','msaa4'); j.choisir('ombres','high');
  assert.equal(j.profil.rendu.msaa,4); assert.equal(j.profil.effets.halo,false);
  assert.equal(j.profil.effets.ombres,true); assert.equal(j.profil.rendu.shadowMapScale,2);
  j.choisir('anticrenelage','off'); j.choisir('ombres','off');
  assert.equal(j.profil.rendu.msaa,0); assert.equal(j.profil.effets.ombres,false);
  assert.strictEqual(j.session,s); assert.strictEqual(j.scene,sc); assert.strictEqual(j.scene.c.obstacles,obstacles);
  assert.equal(j.appels.decor.length,n);
});

verifier('végétation : application à la séance suivante et cache distinguant la densité', () => {
  const j = jeu({ qualite: 'low' }), sc = j.scene, s = j.session, obstacles = sc.c.obstacles;
  assert.equal(sc.vegetationQualite,'off');
  j.choisir('vegetation','high');
  assert.strictEqual(j.scene,sc); assert.strictEqual(j.session,s); assert.strictEqual(j.scene.c.obstacles,obstacles);
  assert.equal(j.appels.decor.length,1,'aucune reconstruction pendant la séance');
  j.lancer('course',0);
  assert.notStrictEqual(j.scene,sc); assert.equal(j.scene.vegetationQualite,'high');
  assert.equal(j.appels.decor.length,2);
  assert.equal(j.appels.decor[1].qualite,'low');
  assert.equal(j.appels.decor[1].matieres,false,'densité indépendante des matières');
  assert.equal(j.appels.decor[1].vegetation,true);
  const dense = j.scene; j.lancer('course',0);
  assert.strictEqual(j.scene,dense); assert.equal(j.appels.decor.length,2,'densité identique réutilise la scène');
  j.choisir('vegetation','off'); j.lancer('course',0);
  assert.equal(j.scene.vegetationQualite,'off'); assert.equal(j.appels.decor.length,3);
});

verifier('reference(options) applique les surcharges et restitue les préférences précédentes', () => {
  const initial = { qualite: 'medium', anticrenelage: 'off', ombres: 'medium', vegetation: 'low', faune: 'low', moment: 'crepuscule' };
  const j = jeu(initial), stockAvant = j.stockage['bitume.reglages'];
  const ref = j.reference({ qualite: 'low', anticrenelage: 'msaa4', ombres: 'high', vegetation: 'ultra', faune: 'ultra', moment: 'nuit', retro: 'non' });
  assert.deepEqual(options(ref), { anticrenelage: 'msaa4', ombres: 'high', vegetation: 'ultra' });
  assert.equal(j.scene.vegetationQualite,'ultra');
  assert.equal(j.reglages.moment,'nuit');assert.equal(j.profil.faune,'ultra');
  assert.equal(j.session.essai,true); assert.equal(j.session.course.phase,'course');
  assert.equal(j.profil.rendu.msaa,4); assert.equal(j.profil.effets.halo,false);
  j.choisir('ombres','off');
  assert.equal(j.stockage['bitume.reglages'],stockAvant,'la référence ne sauvegarde aucun réglage');
  j.lancer('course',0);
  assert.deepEqual(options(j.reglages),options(initial));
  assert.equal(j.reglages.qualite,initial.qualite);
  assert.equal(j.reglages.moment,initial.moment);assert.equal(j.profil.faune,initial.faune);
  assert.equal(j.scene.vegetationQualite,'low');
  assert.equal(j.stockage['bitume.reglages'],stockAvant);
});

// File des écritures (src/jeu.js, differerStock) : en course, localStorage n'est jamais écrit dans l'image ; une
// lecture de la clé en attente vide la file d'abord, une écriture directe remplace la valeur en attente.
verifier('stockage : écritures de course différées, relues fraîches, calculées à la vidange', () => {
  const j = jeu();
  j.enCourse();
  const avant = j.appels.ecritures.length;
  j.choisir('ombres', 'medium');
  assert.equal(j.appels.ecritures.length, avant, 'aucune écriture pendant la course');
  assert.equal(j.lireStock('bitume.reglages', {}).ombres, 'medium', 'la lecture vide la file et relit la valeur');
  assert.equal(j.appels.ecritures.length, avant + 1);
  let encodages = 0;
  j.differerStock('essai', () => { encodages++; return { n: 1 }; });
  assert.equal(encodages, 0, 'valeur calculée seulement à la vidange');
  j.viderStock(); j.viderStock();
  assert.equal(encodages, 1, 'une seule écriture par valeur en attente');
  assert.deepEqual(JSON.parse(j.stockage.essai), { n: 1 });
  j.differerStock('essai', { n: 2 }); j.ecrireStock('essai', { n: 3 }); j.viderStock();
  assert.deepEqual(JSON.parse(j.stockage.essai), { n: 3 }, 'une écriture directe remplace la valeur en attente');
});

verifier('références successives sans options reviennent au profil, puis aux choix antérieurs', () => {
  const j = jeu({ qualite: 'low', anticrenelage: 'msaa4', ombres: 'off', vegetation: 'high' });
  const avant = options(j.reglages);
  j.reference({ anticrenelage: 'off', ombres: 'high', vegetation: 'ultra', retro: 'non' });
  const r = j.reference({ qualite: 'medium', retro: 'non' });
  assert.deepEqual(options(r), { anticrenelage: 'profil', ombres: 'profil', vegetation: 'profil' });
  assert.equal(j.scene.vegetationQualite,'medium');
  j.restaurerReference();
  assert.deepEqual(options(j.reglages),avant);
  assert.equal(j.reglages.qualite,'low');
});

verifier('étendue anti-clipping, définition 3D dynamique et optimisations configurables', () => {
  const j = jeu({ qualite: 'low' });
  assert.equal(j.appels.decor.at(-1).decorCinema, true);
  assert.equal(j.appels.decor.at(-1).horizon, 'couloir');
  j.choisir('horizon', 'complet');
  j.choisir('matieres', 'on');
  j.lancer('course', 0);
  assert.equal(j.appels.decor.at(-1).decorCinema, false, 'complet sans coupe génère toute la carte');
  assert.equal(j.appels.decor.at(-1).horizon, 'complet');
  assert.equal(j.appels.decor.at(-1).matieres, true);
  assert.ok(j.appels.decor.at(-1).echelleBascule > 1.4, 'bascule LOD étendue');

  // Plafond de définition appliqué dynamiquement hors conduite
  j.choisir('definition', '720p');
  assert.deepEqual(j.appels.rendu.filter(x => x[0] === 'maxPixels').at(-1), ['maxPixels', 1280 * 720]);
  j.choisir('definition', 'native');
  assert.deepEqual(j.appels.rendu.filter(x => x[0] === 'maxPixels').at(-1), ['maxPixels', 0]);
  j.choisir('definition', 'profil');
  assert.deepEqual(j.appels.rendu.filter(x => x[0] === 'maxPixels').at(-1), ['maxPixels', 2400 * 1350]);

  // Optimisations fovéa/raycast, halo, reflets et foule persistés
  j.choisir('optimisations', 'off');
  j.choisir('foule', 'off');
  j.choisir('ombres', 'ultra');
  assert.deepEqual(j.profil.optimisations, { foveal: false, raycast: false });
  assert.equal(j.profil.decor.foule, false);
  assert.equal(j.profil.effets.pcss, true);
});

console.log('options image : ' + controles + ' contrôles passés');
