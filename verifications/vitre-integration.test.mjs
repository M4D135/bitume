// Vraies fonctions de jeu.js et vitre.js ; seuls stockage, DOM et pluie projetée sont remplacés.
// Ce banc vérifie le raccord menu/vues/conditions. Il ne qualifie pas le compositing WebGL du navigateur.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const nom of ['graphismes', 'pneus', 'ambiance', 'saisons', 'chaussee', 'meteo', 'conditions-course', 'cadence', 'vitre', 'sillage']) require('../src/' + nom + '.js');
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
function bloc(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a);
  assert(a >= 0 && b > a, 'bloc de production : ' + debut); return source.slice(a, b);
}
const executer = new Function('B', 'prefs', `
  const stockage = { 'bitume.reglages': JSON.stringify(prefs) }, elements = new Map();
  let session = null, ecran = 'titre', retourReglages = 'titre', captureTouche = null;
  const localStorage = { getItem: k => stockage[k] || null, setItem: (k,v) => { stockage[k] = v; } };
  const setTimeout = () => 0, matchMedia = () => ({ matches: false });
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { id, style: {}, width: 1000, height: 600, clientWidth: 1000, clientHeight: 600,
      listeners: new Map(), addEventListener(type, fn) { this.listeners.set(type, fn); },
      getContext: () => ({ globalAlpha: 1, setTransform() {}, clearRect() {}, beginPath() {},
        moveTo() {}, lineTo() {}, quadraticCurveTo() {}, ellipse() {}, stroke() {}, fill() {} }) });
    return elements.get(id);
  };
  const document = { querySelectorAll: () => [] }, window = { devicePixelRatio: 1 };
  const majCommandes = () => {}, majDetectionGraphique = () => {}, appliquerVolumes = () => {}, appliquerCarte = () => {}, secouerManette = () => {}, pad2 = {};
  const CATALOGUE = [{ theme: 'foret' }, { theme: 'cote' }];
  const VUES_DEHORS = new Set(['tele', 'helico', 'orbite', 'travelling', 'sol', 'panorama', 'flore', 'faune', 'pilote', 'peloton']);
  const creationTardive = (nom, valeur) => valeur, sousLaVoute = (c, pos) => !!pos.abri;
  B = { ...B, meteo: { ...B.meteo, creerPluie: () => ({ dessiner() {} }) } };
  ${bloc('  function initialiserChoixPneus(', '  function choixPneusLocaux(')}
  ${bloc('  function lireStock(', '  // records et fantômes')}
  ${bloc('  let pluieVue = null', '  // menus à la manette')}
  ${bloc("  for (const nom of ['general', 'moteur', 'effets'])", '  const NOMS_ACTIONS =')}
  ${bloc('  function remplirReglages()', '  function retour()')}
  return { reglages, stockage, elements, remplirReglages, viderStock,
    initialiser: S => { session = S; ecran = 'course'; },
    ecran: (nom, retour = 'titre') => { ecran = nom; retourReglages = retour; },
    choisir: valeur => { $('v-gouttes').value = String(valeur); $('v-gouttes').listeners.get('input')({ target: $('v-gouttes') }); },
    dessiner: (S, vue = 'cockpit', dt = 1/30, abri = false, position = [0,1,0], suivie) => dessinerMeteo(S, dt, { pos: Object.assign([...position], { abri }) }, vue, { palier: 'ultra' }, suivie),
    vues: () => [vitreVue, vitreVue2] };
`);
function seance() {
  const voitures = [{ id: 0, etat: { v: 35 } }, { id: 1, etat: { v: 35 } }];
  return { i: 0, suivie: 0, nature: { saison: { neige: false } }, meteo: { pluie: 1, ventX: 4, ventZ: 2 },
    course: { c: {}, voitures, joueur: voitures[0] }, vitreContexte: null };
}
const jeu = (prefs = {}) => executer(globalThis.BITUME, prefs);
const avancer = (j, S, s = 3, vue = 'cockpit') => { for (let i = 0; i < s * 30; i++) j.dessiner(S, vue); };
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

verifier('réglage 0..2 conservé au chargement, valeurs invalides ramenées au défaut 1', () => {
  for (const [entree, attendu] of [[undefined, 1], [null, 1], ['invalide', 1], [-8, 0], [9, 2], [0, 0], [.7, .7], ['1.8', 1.8]]) {
    const j = jeu({ gouttes: entree }); assert.equal(j.reglages.gouttes, attendu);
    j.remplirReglages(); assert.equal(+j.elements.get('v-gouttes').value, attendu);
  }
});
verifier('curseur standard accessible, valeur affichée, persistance et rendu utilisent le même choix', () => {
  const balise = html.match(/<input[^>]*id="v-gouttes"[^>]*>/)?.[0];
  assert(balise && /type="range"/.test(balise) && /min="0"/.test(balise) && /max="2"/.test(balise) && /step="0.1"/.test(balise));
  const j = jeu(), S = seance(); j.initialiser(S); avancer(j, S);
  assert(j.vues()[0].stats.gouttes > 0);
  j.choisir(0); j.dessiner(S, 'cockpit', 0); assert(j.vues()[0].propre);
  j.choisir(1.7); j.viderStock(); j.remplirReglages(); avancer(j, S);
  assert.equal(S.vitreContexte.intensite, 1.7); assert.equal(j.elements.get('v-gouttes-valeur').textContent, '1,7 ×');
  assert.equal(JSON.parse(j.stockage['bitume.reglages']).gouttes, 1.7); assert(j.vues()[0].stats.gouttes > 0);
});
verifier('vues cockpit/extérieures et les deux vitres restent indépendantes', () => {
  const j = jeu(), S = seance(), J2 = { ...S, suivie: 1, vitreContexte: null }; j.initialiser(S);
  for (let i = 0; i < 120; i++) { j.dessiner(S); j.dessiner(J2); }
  const [a,b] = j.vues(); assert.notEqual(a.graine, b.graine);
  assert.notDeepEqual(a.gouttes.filter(p => p.vivant).map(p => [p.x,p.y]), b.gouttes.filter(p => p.vivant).map(p => [p.x,p.y]));
  assert.notStrictEqual(S.vitreContexte, J2.vitreContexte);
  const avant = JSON.stringify(a.gouttes); j.dessiner(J2, 'poursuite');
  assert.equal(JSON.stringify(a.gouttes), avant); assert.equal(J2.vitreContexte.cockpit, false); assert(b.opacite < a.opacite);
  assert.equal(S.vitreContexte.cockpit, true);
});
verifier('la vraie pause et son menu de réglages conservent les dépôts, reprise sans saut de temps', () => {
  const j = jeu(), S = seance(); j.initialiser(S); avancer(j, S);
  const e = j.vues()[0], avant = JSON.stringify(e.gouttes), temps = e.temps;
  j.ecran('pause'); avancer(j, S); j.ecran('reglages', 'pause'); avancer(j, S);
  assert.equal(JSON.stringify(e.gouttes), avant); assert.equal(e.temps, temps);
  j.ecran('course'); j.dessiner(S); assert(Math.abs(e.temps - temps - 1/30) < 1e-12);
  j.ecran('titre'); j.dessiner(S, 'cockpit', 0); assert(e.propre && e.masquee);
});
verifier('précipitations neige réelles, saison et exception côtière restent celles du jeu', () => {
  const j = jeu(), S = seance(); j.initialiser(S);
  S.nature.saison.neige = true; j.dessiner(S); assert.equal(S.vitreContexte.neige, 1); assert.equal(S.vitreContexte.pluie, 0);
  S.meteo.precipitationsNeige = false; j.dessiner(S); assert.equal(S.vitreContexte.neige, 0); assert.equal(S.vitreContexte.pluie, 1);
  S.meteo.precipitationsNeige = true; S.i = 1; j.dessiner(S); assert.equal(S.vitreContexte.neige, 0);
  const meteoAvant = JSON.stringify(S.meteo); j.dessiner(S, 'cockpit', 1/30, true);
  assert.equal(S.vitreContexte.abri, true); assert.equal(JSON.stringify(S.meteo), meteoAvant);
});
verifier('la source optique suit le rendu courant et les embruns sont propres à chaque caméra', () => {
  const j = jeu(), S = seance(), J2 = { ...S, suivie: 1, vitreContexte: null }; j.initialiser(S);
  S.sillage = globalThis.BITUME.sillage.creer();
  globalThis.BITUME.sillage.mettreAJour(S.sillage, [{ id: 7, etat: { v: 65, s: 0 } }], [{ x: 0, y: 0, z: 0, cap: 0 }]);
  j.dessiner(S, 'cockpit', 1/30, false, [-12,1,0]);
  assert.strictEqual(S.vitreContexte.sourceScene, j.elements.get('scene'));
  assert(S.vitreContexte.embruns > .6);
  j.dessiner(J2, 'cockpit', 1/30, false, [12,1,0]);
  assert.equal(J2.vitreContexte.embruns, 0); assert(S.vitreContexte.embruns > .6);
  j.dessiner(S, 'cockpit', 1/30, true, [-12,1,0]); assert.equal(S.vitreContexte.embruns, 0);
  S.meteo.pluie = 0; S.meteo.mouille = 1;
  j.dessiner(S, 'cockpit', 1/30, false, [-12,1,0]); assert(S.vitreContexte.embruns > .6, 'route encore mouillée');
  S.meteo.mouille = 0;
  j.dessiner(S, 'cockpit', 1/30, false, [-12,1,0]); assert.equal(S.vitreContexte.embruns, 0);
});
verifier('un changement de voiture filmée emploie immédiatement sa vitesse et son identifiant', () => {
  const j = jeu(), S = seance(); j.initialiser(S);
  S.course.voitures[1].etat.v = 65;
  j.dessiner(S, 'cockpit', 1/30, false, [0,1,0], S.course.voitures[1]);
  assert.equal(S.vitreContexte.vitesse, 65);
});
verifier('les glaces J1/J2 sont composées après les deux vitres ; le HUD reste après la scène', () => {
  for (const glace of ['glace-g', 'glace-d', 'glaces2']) for (const vitre of ['vitre', 'vitre2'])
    assert(html.indexOf('id="' + glace + '"') > html.indexOf('id="' + vitre + '"'));
  assert(html.indexOf('id="hud"') > html.indexOf('id="glaces2"'));
});
console.log('vitre intégration : ' + controles + ' contrôles passés');
