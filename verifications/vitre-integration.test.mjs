// Vraies fonctions de jeu.js et vitre.js ; seuls stockage, DOM et pluie projetée sont remplacés.
// Ce banc vérifie le raccord menu/vues/conditions. Il ne qualifie pas le compositing WebGPU du navigateur.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const nom of ['graphismes', 'pneus', 'ambiance', 'saisons', 'chaussee', 'meteo', 'conditions-course', 'championnat', 'cadence', 'circuit', 'conduite', 'vitre', 'sillage']) require('../src/' + nom + '.js');
// Dépendance réelle de la lecture commune des réglages avant les contrôles de la vitre.
require('../src/menu-arcade.js');
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
function bloc(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a);
  assert(a >= 0 && b > a, 'bloc de production : ' + debut); return source.slice(a, b);
}
const executer = new Function('B', 'prefs', `
  ${source.match(/  const DT = [^;]+;/)[0]}
  const stockage = { 'bitume.reglages': JSON.stringify(prefs) }, elements = new Map();
  let session = null, ecran = 'titre', retourReglages = 'titre', captureTouche = null, captureManette = null;
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
  // Les contrôles voisins installent aussi des écouteurs globaux ; les conserver sans simuler un clic.
  const document = Object.assign(new EventTarget(), { querySelectorAll: () => [] }), window = { devicePixelRatio: 1 };
  const majCommandes = () => {}, majDetectionGraphique = () => {}, appliquerVolumes = () => {}, appliquerCarte = () => {}, arreterManettes = () => {}, pad2 = {};
  const vueLourde = () => true;
  const CATALOGUE = [{ id:'forets-du-pacifique',theme:'foret' }, { id:'marseille',theme:'cote' }];
  const VUES_DEHORS = new Set(['tele', 'helico', 'orbite', 'travelling', 'sol', 'panorama', 'lieu', 'peloton']);
  const creationTardive = (nom, valeur) => valeur, sousLaVoute = (c, pos) => !!pos.abri, calmerVibrations = () => {};
  B = { ...B, meteo: { ...B.meteo, creerPluie: () => ({ dessiner() {} }) } };
  ${bloc('  function initialiserChoixPneus(', '  function choixPneusLocaux(')}
  ${bloc('  function lireStock(', '  // records et fantômes')}
  ${bloc('  function remplirPoses(', '  function melange(')}
  ${bloc('  function synchroniserReplacement(', '  // La manette ne vibre')}
  ${bloc('  let pluieVue = null', '  function naviguerManette(')}
  ${bloc("  for (const nom of ['general', 'moteur', 'effets'])", '  const NOMS_ACTIONS =')}
  ${bloc('  function remplirReglages()', '  function retour()')}
  return { reglages, stockage, elements, remplirReglages, viderStock,
    initialiser: S => { session = S; ecran = 'course'; },
    ecran: (nom, retour = 'titre') => { ecran = nom; retourReglages = retour; },
    choisir: valeur => { $('v-gouttes').value = String(valeur); $('v-gouttes').listeners.get('input')({ target: $('v-gouttes') }); },
    dessiner: (S, vue = 'cockpit', dt = 1/30, abri = false, position = [0,1,0], suivie, orientation = {}) => dessinerMeteo(S, dt, { ...orientation, pos: Object.assign([...position], { abri }) }, vue, { palier: 'ultra' }, suivie),
    poser: S => remplirPoses(S.cour, S.course), replacement: synchroniserReplacement,
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

// Un vrai pas de conduite sur une portion droite connue : le relief vient des coordonnées
// métriques, puis remplirPoses fournit les poses que le jeu rend. Aucun transport de vitre recopié.
function supportClassique(pente = 0, v = 20, etatInitial = {}) {
  const B = globalThis.BITUME, S = seance(), j = jeu();
  const points = [[0,0,0], [200,200*pente,0], [200,200*pente,100], [0,0,100], [0,0,0]];
  const c = B.circuit.creerDepuisTrace({ unite: 'm', points: points.map(([x,y,z]) =>
    ({ x, y, z, largeurG: 10, largeurD: 10, limiteG: 30, limiteD: 30 })) });
  c.largeur = 20; // le modèle classique demande encore une largeur scalaire
  const et = B.conduite.creer(50, 0), voiture = { id: 0, etat: et };
  Object.assign(et, { v, y: B.circuit.echantillon(c, et.s).y, tangage: .3, chargeX: 10, rapport: v < 0 ? -1 : 2 }, etatInitial);
  S.course = { c, voitures: [voiture], joueur: voiture }; S.cour = []; S.prec = [];
  S.distances = new Float64Array(1); S.vRel = new Float64Array(1); S.tele = { poste: null };
  j.initialiser(S); j.poser(S); S.prec = S.cour.map(p => ({ ...p }));
  B.conduite.pas(et, { gaz: v < 0 ? 0 : 1, frein: v < 0 ? 1 : 0, volant: 0,
    marcheArriere: true, boite: 'manuelle', aide: 0, guidage: 0 }, c, 1/120);
  j.poser(S); j.dessiner(S, 'cockpit');
  return { j, S, et, contexte: S.vitreContexte };
}

verifier('le flux reçoit le vecteur PhysX et le regard réel, sans rafale lors d’une coupe de caméra', () => {
  const j = jeu(), S = seance(); j.initialiser(S);
  S.course.joueur.etat.v = -8;
  S.course.joueur.etat._physx = { velocity: [12, -3, -7] };
  const orientation = { yaw: .6, pitch: -.2, roll: .3 };
  j.dessiner(S, 'cockpit', 1/30, false, [0,1,0], undefined, orientation);
  const c = S.vitreContexte;
  assert.equal(c.vitesse, -8, 'la marche arrière garde son signe');
  assert.deepEqual([c.vitesseX,c.vitesseY,c.vitesseZ], [12,-3,-7], 'dérive et vitesse verticale réellement transmises');
  assert.deepEqual([c.cameraYaw,c.cameraPitch,c.cameraRoll], [.6,-.2,.3]);
  const flux = { ...j.vues()[0].flux };
  j.dessiner(S, 'poursuite', 1/30, false, [500,120,-700], undefined, orientation);
  assert.deepEqual(j.vues()[0].flux, flux, 'la coupe change la position, pas le flux du support');
  j.dessiner(S, 'poursuite', 1/30, false, [500,120,-700], undefined, { yaw: .6+Math.PI, pitch: -.2, roll: .3 });
  assert.notEqual(j.vues()[0].flux.deriveX, flux.deriveX, 'le regard arrière reprojette le même mouvement');
});
verifier('le vrai raccord garde la même vitesse physique mais calme la lentille tournée derrière', () => {
  const j = jeu(), S = seance(); j.initialiser(S);
  Object.assign(S.meteo, { ventX: 0, ventZ: 0 });
  S.course.joueur.etat.v = 80;
  S.course.joueur.etat._physx = { velocity: [0, 0, -80] };
  j.dessiner(S, 'poursuite', 1/30, false, [0,2,0], undefined, { yaw: 0 });
  const avant = { ...j.vues()[0].flux };
  j.dessiner(S, 'poursuite', 1/30, false, [0,2,-14.8], undefined, { yaw: Math.PI });
  const arriere = j.vues()[0].flux;
  assert.deepEqual([S.vitreContexte.vitesseX,S.vitreContexte.vitesseY,S.vitreContexte.vitesseZ], [0,0,-80]);
  assert(avant.expansion > .3 && avant.air > .5);
  assert.equal(arriere.expansion, 0); assert.equal(arriere.air, 0); assert.equal(arriere.graviteY, 1);
  assert.equal(S.vitreContexte.actif, true, 'la lentille arrière reste active');
});
verifier('les six vues reçoivent pluie et neige selon leur axe, avant et arrière', () => {
  for (const neige of [false,true]) for (const vue of ['cockpit','arceau','nez','aileron-avant','poursuite-proche','poursuite']) {
    const j = jeu(), S = seance(); j.initialiser(S); S.nature.saison.neige = neige;
    Object.assign(S.meteo,{ventX:0,ventZ:0});
    S.course.joueur.etat.v = 80; S.course.joueur.etat._physx = {velocity:[80,0,0]};
    j.dessiner(S,vue,1/30,false,[1,.5,0],undefined,{yaw:Math.PI/2});
    assert(S.vitreContexte.actif,vue); assert.equal(S.vitreContexte.cockpit,vue==='cockpit');
    assert.equal(S.vitreContexte.neige,neige?1:0); assert.equal(S.vitreContexte.pluie,neige?0:1);
    assert(j.vues()[0].flux.expansion>.3,vue+' flux avant');
    j.dessiner(S,vue,1/30,false,[-2.34,.5,0],undefined,{yaw:-Math.PI/2});
    assert(S.vitreContexte.actif); assert.equal(j.vues()[0].flux.expansion,0); assert.equal(j.vues()[0].flux.air,0);
    assert.equal(j.vues()[0].flux.graviteY,1); assert.deepEqual([S.vitreContexte.vitesseX,S.vitreContexte.vitesseY,S.vitreContexte.vitesseZ],[80,0,0]);
  }
});
verifier('sans PhysX, une accélération sur route plate ne transforme pas le tangage en montée', () => {
  const { S, et, contexte: c } = supportClassique();
  assert(et.along > 0 && et.tangage > .05, 'véritable accélération et attitude non horizontale');
  assert(S.cour[0].x > S.prec[0].x && S.cour[0].y === S.prec[0].y, 'le véhicule avance sans monter');
  assert(Math.abs(c.vitesseX - et.v) < 1e-9, 'v reste une vitesse en plan, sans raccourcissement par le tangage');
  assert.equal(c.vitesseY, 0); assert.equal(c.vitesseZ, 0);
});
verifier('sans PhysX, montée et recul suivent les poses physiques et restent indépendants du regard', () => {
  for (const v of [20, -3]) {
    const { j, S, et, contexte: c } = supportClassique(.2, v);
    assert(c.vitesseX * v > 0 && c.vitesseY * v > 0, 'avant monte, recul descend sur le même plan');
    assert(Math.abs(c.vitesseX - et.v) < 1e-9, 'la pente ne réduit pas la vitesse en plan');
    assert(Math.abs(c.vitesseY / c.vitesseX - .2) < 1e-9, '20 m de montée pour 100 m horizontaux');
    assert(Math.abs(c.vitesseX / 120 - (S.cour[0].x - S.prec[0].x)) < 1e-12, 'déplacement rendu du vrai pas');
    const vecteur = [c.vitesseX,c.vitesseY,c.vitesseZ];
    et.tangage = -.4; j.poser(S);
    j.dessiner(S, 'poursuite', 1/144, false, [500,120,-700], undefined, { yaw: -1.5, pitch: .8, roll: -.4 });
    assert.deepEqual([c.vitesseX,c.vitesseY,c.vitesseZ], vecteur, 'coupe, cadence et attitude ne déplacent pas le support');
  }
});
verifier('sans PhysX, la dérive utilise le déplacement du véhicule et pas l’axe de sa caisse', () => {
  const { j, S, et, contexte: c } = supportClassique(0, 20, { psi: .2, beta: .3 });
  const deplacement = [S.cour[0].x - S.prec[0].x, S.cour[0].z - S.prec[0].z];
  assert(deplacement[0] > 0 && deplacement[1] > 0 && Math.abs(et.beta) > .05, 'déplacement latéral réel du modèle');
  assert(Math.abs(c.vitesseZ / c.vitesseX - deplacement[1] / deplacement[0]) < 1e-12);
  const vecteur = [c.vitesseX,c.vitesseY,c.vitesseZ];
  S.cour[0].cap += .8; et.beta = -.4;
  j.dessiner(S, 'poursuite');
  assert.deepEqual([c.vitesseX,c.vitesseY,c.vitesseZ], vecteur, 'l’attitude ne réoriente pas les poses physiques déjà observées');
});
verifier('sans PhysX, un replacement égalise les poses et ne crée aucune rafale', () => {
  const { j, S, et } = supportClassique(.2);
  et.d = 4; et.y += 2; j.poser(S); S.prec[0] = { ...S.cour[0] };
  const ev = globalThis.BITUME.conduite.replacer(et, S.course.c).map(e => ({ ...e, id: 0 }));
  j.poser(S); assert.notEqual(S.cour[0].y, S.prec[0].y, 'le replacement déplace réellement la voiture');
  j.replacement(S, ev); j.dessiner(S, 'poursuite');
  const c = S.vitreContexte;
  assert.deepEqual([c.vitesseX,c.vitesseY,c.vitesseZ], [0,0,0]);
});
verifier('sans poses précédentes, le repli minimal garde le recul dans le plan sans inventer une vitesse verticale', () => {
  const j = jeu(), S = seance(); j.initialiser(S);
  Object.assign(S.course.joueur.etat, { v: -3, beta: .2, tangage: .6 }); S.cour = [{ cap: .2 }];
  j.dessiner(S, 'cockpit', 1/30, false, [0,1,0], undefined, { yaw: 1.5 });
  const c = S.vitreContexte;
  assert.deepEqual([c.vitesseX,c.vitesseY,c.vitesseZ], [-3,0,-0]);
  j.dessiner(S, 'poursuite', 1/30, false, [9,4,0], undefined, { yaw: -1.5 });
  assert.deepEqual([c.vitesseX,c.vitesseY,c.vitesseZ], [-3,0,-0]);
});
verifier('les deux joueurs gardent leur propre mouvement et leur propre orientation de flux', () => {
  const j = jeu(), S = seance(), J2 = { ...S, suivie: 1, vitreContexte: null }; j.initialiser(S);
  S.course.voitures[0].etat._physx = { velocity: [0,0,-70] };
  S.course.voitures[1].etat._physx = { velocity: [40,0,0] };
  j.dessiner(S, 'cockpit', 1/30, false, [0,1,0], undefined, { yaw: 0 });
  const a = { ...j.vues()[0].flux };
  j.dessiner(J2, 'poursuite', 1/30, false, [0,3,0], undefined, { yaw: Math.PI });
  assert.deepEqual(j.vues()[0].flux, a);
  assert.notDeepEqual(j.vues()[1].flux, a);
  assert.deepEqual([J2.vitreContexte.vitesseX,J2.vitreContexte.vitesseZ], [40,0]);
});

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
  S.meteo.precipitationsNeige = true; S.saisonLocale = { theme: 'cote' }; j.dessiner(S); assert.equal(S.vitreContexte.neige, 0);
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
verifier('les projections à 300 km/h suivent le panache humide, avec des vitres J1/J2 indépendantes', () => {
  const j = jeu(), S = seance(), J2 = { ...S, suivie: 1, vitreContexte: null }; j.initialiser(S);
  S.meteo.pluie = 0; S.meteo.mouille = 1;
  S.course.voitures[0].etat.v = S.course.voitures[1].etat.v = 300 / 3.6;
  S.sillage = globalThis.BITUME.sillage.creer();
  globalThis.BITUME.sillage.mettreAJour(S.sillage, [{ id: 7, etat: { v: 300 / 3.6, s: 0 } }], [{ x: 0, y: 0, z: 0, cap: 0 }]);
  for (let i = 0; i < 120; i++) {
    j.dessiner(S, 'cockpit', 1/30, false, [-12,1,0]);
    j.dessiner(J2, 'poursuite', 1/30, false, [-12,1,8]);
  }
  assert(j.vues()[0].stats.gouttes > 25); assert.equal(j.vues()[1].stats.gouttes, 0);
  const apres = JSON.stringify(j.vues()[0].gouttes);
  j.dessiner(J2, 'poursuite', 1/30, false, [-12,1,0]); assert.equal(JSON.stringify(j.vues()[0].gouttes), apres);
});
verifier('les plans aériens et distants n’ont aucun dépôt ; toutes les vues embarquées les rétablissent', () => {
  const j = jeu(), S = seance(); j.initialiser(S);
  for (const vue of ['helico', 'panorama', 'tele', 'lieu', 'orbite', 'sol', 'travelling', 'peloton']) {
    avancer(j, S, 2, 'cockpit'); assert(j.vues()[0].stats.gouttes > 0);
    j.dessiner(S, vue, 0); assert(j.vues()[0].masquee && j.vues()[0].propre, vue);
  }
  for (const vue of ['cockpit', 'poursuite', 'aileron', 'roue', 'arriere']) {
    j.dessiner(S, 'helico', 0);
    avancer(j, S, 3, vue);
    assert(j.vues()[0].stats.gouttes > 0, vue + ' reçoit des gouttes');
    assert.equal(S.vitreContexte.actif, true, vue);
    assert.equal(S.vitreContexte.cockpit, vue === 'cockpit');
  }
});
verifier('vue arceau : abri et sec sans nouveaux dépôts, pause sans avance', () => {
  const j = jeu(), S = seance(); j.initialiser(S);
  for (let n = 0; n < 90; n++) j.dessiner(S, 'aileron', 1/30, true);
  assert.equal(j.vues()[0].stats.gouttes, 0, 'aucune pluie reçue sous toit');
  S.meteo.pluie = 0; avancer(j, S, 3, 'aileron');
  assert.equal(j.vues()[0].stats.gouttes, 0, 'aucune goutte créée au sec');
  S.meteo.pluie = 1; avancer(j, S, 3, 'aileron');
  assert(j.vues()[0].stats.gouttes > 0, 'pluie reçue derrière l’arceau');
  const avant = JSON.stringify(j.vues()[0].gouttes), temps = j.vues()[0].temps;
  j.ecran('pause'); avancer(j, S, 2, 'aileron');
  assert.equal(JSON.stringify(j.vues()[0].gouttes), avant); assert.equal(j.vues()[0].temps, temps);
});
verifier('la poursuite à 2,45 m reçoit des gouttes du rival même sans pluie ambiante', () => {
  const j = jeu(), S = seance(); j.initialiser(S);
  S.meteo.pluie = 0; S.meteo.mouille = 1; S.course.voitures[0].etat.v = 235 / 3.6;
  S.sillage = globalThis.BITUME.sillage.creer();
  globalThis.BITUME.sillage.mettreAJour(S.sillage, [{ id: 7, etat: { v: 235 / 3.6, s: 0 } }], [{ x: 0, y: 0, z: 0, cap: 0 }]);
  for (let i = 0; i < 180; i++) j.dessiner(S, 'poursuite', 1/30, false, [-25.4,2.45,0]);
  assert(S.vitreContexte.embruns > .6); assert(j.vues()[0].stats.gouttes > 0, 'eau réellement déposée sans pluie');
  j.dessiner(S, 'helico', 0, false, [-25.4,21,0]);
  assert(j.vues()[0].masquee && j.vues()[0].propre, 'la vue aérienne efface la visière');
  for (let i = 0; i < 180; i++) j.dessiner(S, 'poursuite', 1/30, true, [-25.4,2.45,0]);
  assert.equal(S.vitreContexte.embruns, 0); assert.equal(j.vues()[0].stats.gouttes, 0, 'aucune nouvelle projection sous abri');
});
verifier('les glaces J1/J2 sont composées après les deux vitres ; le HUD reste après la scène', () => {
  for (const glace of ['glace-g', 'glace-d', 'glaces2']) for (const vitre of ['vitre', 'vitre2'])
    assert(html.indexOf('id="' + glace + '"') > html.indexOf('id="' + vitre + '"'));
  assert(html.indexOf('id="hud"') > html.indexOf('id="glaces2"'));
});
console.log('vitre intégration : ' + controles + ' contrôles passés');
