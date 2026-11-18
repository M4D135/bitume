// Intégration des vraies fonctions de jeu.js : les frontières DOM/renderer sont remplacées, pas les décisions.
// Ces contrôles ne qualifient pas WebGL ; tools/controle-options.mjs prépare le parcours navigateur réel.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
require('../src/graphismes.js');
require('../src/qualite.js');
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
function bloc(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a);
  assert.ok(a >= 0 && b > a, 'bloc de production disponible : ' + debut);
  return source.slice(a, b);
}

const executer = new Function('B', 'stockage', `
  const appels = { decor: [], rendu: [], ecritures: [] }, elements = new Map(), ecouteurs = new Map();
  const $ = id => { if (!elements.has(id)) elements.set(id, { classList: { add() {} }, dataset: {}, hidden: false }); return elements.get(id); };
  const localStorage = { getItem: k => stockage[k] ?? null, setItem: (k,v) => { stockage[k] = v; appels.ecritures.push(k); } };
  const document = { hidden: false, addEventListener: (k,f) => ecouteurs.set(k,f),
    createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) };
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x)), ramener = (s,l) => ((s%l)+l)%l;
  const CATALOGUE = [{ id: 'essai', graine: 11 }], c = { longueur: 1000 };
  const circuit = () => c, plan = () => ({}), dessinerTrace = () => {}, appliquerCarte = () => {};
  const rendu = { resize: v => appels.rendu.push(['resize',v]),
    setWorld: (...args) => appels.rendu.push(['world',...args]), setNappes: v => appels.rendu.push(['nappes',v]), setLots: v => appels.rendu.push(['lots',v]) };
  const gpuModeste = false, EL = { role: null }, retro = { j1: null, j2: null };
  let scene = null, session = null, decorEnrichi = true, graineCourse = 0, cameraEssai = null, horlogeReelle = 0, tPrec = 0, dureeImage = 16, ecran = 'titre';
  const remplirPoses = () => {}, aller = nom => { ecran = nom; };
  B = { ...B,
    decor: { construire: (c,o) => { appels.decor.push(o); return { nappes: [], lots: [], obstacles: [], atmosphere: { sunDirection: [1,1,0] } }; } },
    obstacles: { creer: objets => ({ objets }) },
    conduite: { PARAMS: { vitessePointe: [20,40,60,80,100], maxUtile: 8000, ralenti: 900 }, pneusConseilles: () => 'slicks', eauSurPiste: () => 0 },
    circuit: { ecart: (c,a,b) => b-a, echantillon: () => ({ y: 0, devers: 0, pente: 0 }) },
    meteo: { pour: nom => ['soleil','pluie'].includes(nom) ? { mouille: 0 } : null }, mesures: { reinitialiser() {} }
  };
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
  ${bloc("  document.addEventListener('change', e => {", "  for (const nom of ['general', 'moteur', 'effets'])")}
  ${bloc('  function restaurerReference()', '  // Banc (console)')}
  lancer('course',0);
  return { reglages, stockage, appels, installer, reference, restaurerReference, lancer,
    get session() { return session; }, get scene() { return scene; }, get profil() { return profilDe(session); },
    choisir: (name,value) => ecouteurs.get('change')({ target: { name, value } }) };
`);
function jeu(prefs = {}) {
  const stockage = { 'bitume.reglages': JSON.stringify(prefs) };
  return executer(globalThis.BITUME, stockage);
}
const options = x => Object.fromEntries(['anticrenelage','ombres','vegetation'].map(k => [k,x[k]]));
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok ' + nom); }

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
  const initial = { qualite: 'medium', anticrenelage: 'off', ombres: 'medium', vegetation: 'low' };
  const j = jeu(initial), stockAvant = j.stockage['bitume.reglages'];
  const ref = j.reference({ qualite: 'low', anticrenelage: 'msaa4', ombres: 'high', vegetation: 'ultra', retro: 'non' });
  assert.deepEqual(options(ref), { anticrenelage: 'msaa4', ombres: 'high', vegetation: 'ultra' });
  assert.equal(j.scene.vegetationQualite,'ultra');
  assert.equal(j.session.essai,true); assert.equal(j.session.course.phase,'course');
  assert.equal(j.profil.rendu.msaa,4); assert.equal(j.profil.effets.halo,false);
  j.choisir('ombres','off');
  assert.equal(j.stockage['bitume.reglages'],stockAvant,'la référence ne sauvegarde aucun réglage');
  j.lancer('course',0);
  assert.deepEqual(options(j.reglages),options(initial));
  assert.equal(j.reglages.qualite,initial.qualite);
  assert.equal(j.scene.vegetationQualite,'low');
  assert.equal(j.stockage['bitume.reglages'],stockAvant);
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

console.log('options image : ' + controles + ' contrôles passés');
