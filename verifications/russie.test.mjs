import { generateurHistorique } from './helpers/generateur-historique.mjs';
// 13A — Baïkal : tracé et relief originaux, sept circuits historiques intacts et conduite historique à douze.
// Ce banc conserve la voie de compatibilité sans backend PhysX. Les corps dynamiques du jeu p15 sont
// qualifiés séparément par physique-voitures, physx-circuits et physx-stands avec le vrai WASM intégré.
// Par défaut les trois courses de trois tours sont exécutées. BITUME_RUSSIE_GEOMETRIE_SEULE=1 sert
// uniquement au diagnostic court : son rapport indique explicitement que la course n'est pas qualifiée.
import assert from 'node:assert/strict';
import { test as nodeTest, after } from 'node:test';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DT = 1 / 120, TOURS = 3, DUREE_MAX = 1200;
const GEOMETRIE_SEULE = process.env.BITUME_RUSSIE_GEOMETRIE_SEULE === '1';
const CONTRAT = Object.freeze({ id: 'baikal', nom: 'Circuit de la Glace Vive', theme: 'baikal', graine: 179, longueur: 5400 });
const historique = JSON.parse(readFileSync(new URL('./fixtures/circuits-historiques-cimes.json', import.meta.url), 'utf8'));
const sourceJeu = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const declaration = sourceJeu.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/);
assert.ok(declaration, 'catalogue du jeu présent');
const CATALOGUE = new Function(declaration[0] + '; return CATALOGUE;')();
const sha256 = v => createHash('sha256').update(v).digest('hex');
function empreintesSources() {
  const fichiers = {};
  function lire(dossier) {
    for (const entree of readdirSync(path.join(racine, dossier), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relatif = dossier + '/' + entree.name;
      if (entree.isDirectory()) lire(relatif);
      else if (entree.isFile()) fichiers[relatif] = sha256(readFileSync(path.join(racine, relatif)));
    }
  }
  lire('src');
  for (const nom of ['verifications/russie.test.mjs', 'verifications/fixtures/circuits-historiques-cimes.json']) {
    fichiers[nom] = sha256(readFileSync(path.join(racine, nom)));
  }
  return fichiers;
}
const avant = empreintesSources(), resultats = [];
function verifier(nom, f) {
  nodeTest(nom, () => {
    const debut = performance.now(), resultat = { nom, reussi: false };
    resultats.push(resultat);
    try { resultat.mesures = f(); resultat.reussi = true; }
    catch (erreur) { resultat.erreur = erreur.message; throw erreur; }
    finally { resultat.dureeExecutionMs = performance.now() - debut; }
  });
}
after(() => {
  const apres = empreintesSources(), sourcesStables = JSON.stringify(apres) === JSON.stringify(avant);
  const rapport = { date: new Date().toISOString(), node: process.version, pas: DT, contrat: CONTRAT,
    portee: GEOMETRIE_SEULE ? 'geometrie-seulement' : 'geometrie-et-trois-courses-conduite-historique-sans-physx',
    coursesDemandees: GEOMETRIE_SEULE ? 0 : 3, toursParCourse: TOURS, sourcesStables,
    tests: resultats.length, reussis: resultats.filter(r => r.reussi).length, resultats, empreintes: avant };
  if (process.env.BITUME_RAPPORTS_RUSSIE) {
    const dossier = path.resolve(process.env.BITUME_RAPPORTS_RUSSIE); mkdirSync(dossier, { recursive: true });
    writeFileSync(path.join(dossier, 'russie.json'), JSON.stringify(rapport, null, 2) + '\n');
  }
  assert.deepEqual(apres, avant, 'les sources restent identiques pendant les contrôles');
});

const require = createRequire(import.meta.url);
for (const nom of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'botanique', 'ecologie', 'saisons',
  'vegetation', 'bords', 'carene', 'decor', 'meteo', 'strategie-stands', 'course']) require('../src/' + nom + '.js');
const B = globalThis.BITUME;
function creerCircuit(k = CONTRAT) {
  return B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom });
}
function empreinteCircuit(c) {
  const metadonnees = {}, tableaux = {};
  for (const cle of Object.keys(c).sort()) {
    const v = c[cle];
    if (ArrayBuffer.isView(v)) tableaux[cle] = { type: v.constructor.name, longueur: v.length,
      sha256: sha256(Buffer.from(v.buffer, v.byteOffset, v.byteLength)) };
    else if (typeof v !== 'function' && cle[0] !== '_') metadonnees[cle] = v;
  }
  return { metadonnees, tableaux };
}
function creerMonde(saison = 'ete') {
  const c = creerCircuit();
  B.bords.limites(c, B.bords.planifier(c));
  const decor = B.decor.construire(c, { qualite: 'high', matieres: true, vegetation: true,
    vegetationQualite: 'high', saison });
  c.obstacles = B.obstacles.creer(decor.obstacles);
  assert.ok(c.obstacles.objets.length > 0, 'les solides du décor sont actifs');
  assert.equal(c.obstacles.objets.length, decor.obstacles.length, 'aucun solide rejeté silencieusement');
  return { c, decor };
}

verifier('13A catalogue : Baïkal ajouté après les sept circuits conservés', () => {
  assert.equal(historique.commitSource, '9703e711bf9f849fbd2c8d9fdc320f6e0177857d');
  assert.equal(historique.circuits.length, 7);
  for (const {catalogue: ancien} of historique.circuits) {
    const actuel = CATALOGUE.find(k => k.id === ancien.id);
    if (actuel) assert.deepEqual([actuel.graine, actuel.theme, actuel.longueur], [ancien.graine, ancien.theme, ancien.longueur], ancien.id);
  }
  const indice = CATALOGUE.findIndex(k => k.id === CONTRAT.id);
  for (const [cle, valeur] of Object.entries(CONTRAT)) assert.equal(CATALOGUE[indice][cle], valeur, cle);
  assert.equal(CATALOGUE.filter(k => k.id === CONTRAT.id).length, 1);
  assert.equal(sourceJeu.match(/\bPHYSIQUE\s*=\s*['"](p\d+)['"]/)?.[1], 'p17', 'les records suivent la conduite actuelle');
  return { indice, circuitsHistoriques: 7, physique: 'p17', backendDuBanc: 'conduite-historique-sans-physx' };
});

verifier('13A les 84 tableaux numériques des sept anciens tracés restent identiques bit à bit', () => {
  const base = generateurHistorique('cimes');
  for (const attendu of historique.circuits) {
    const k = attendu.catalogue;
    const reference = JSON.parse(JSON.stringify(empreinteCircuit(base.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom }))));
    if (process.platform === 'linux' && process.arch === 'x64') assert.deepEqual(reference, attendu.empreinte);
    assert.deepEqual(empreinteCircuit(creerCircuit(k)), reference,
      'tracé historique conservé : ' + attendu.catalogue.id);
  }
  return { reference: historique.commitSource, circuits: historique.circuits.length,
    tableaux: historique.circuits.reduce((n, c) => n + Object.keys(c.empreinte.tableaux).length, 0) };
});

verifier('13A boucle praticable, relief significatif et raccord continu', () => {
  const c = creerCircuit();
  assert.equal(c.theme, CONTRAT.theme);
  assert.deepEqual(B.circuit.valider(c), []);
  assert.ok(c.longueur >= 4800 && c.longueur <= 5800, 'longueur dans la cible du plan');
  const fermeture = Math.hypot(c.x[0] - c.x[c.n - 1], c.z[0] - c.z[c.n - 1]);
  const denivele = Math.max(...c.y) - Math.min(...c.y), penteMax = Math.max(...Array.from(c.pente, Math.abs));
  assert.ok(fermeture < 2.5, 'le dernier segment rejoint le départ');
  assert.ok(denivele >= 42 && denivele <= 80, 'dénivelé entre 42 et 80 mètres : ' + denivele);
  assert.ok(penteMax <= .070000001, 'pente maximale de 7 % : ' + penteMax);
  for (let i = 0; i < c.n; i++) {
    const j = (i + 1) % c.n;
    assert.ok(Math.abs(c.y[j] - c.y[i]) <= c.pas * .071, 'pas de marche dans le relief, raccord compris');
    assert.ok(Number.isFinite(c.vitesse[i]) && c.vitesse[i] > 15 && c.vitesse[i] <= 86);
    assert.ok(Math.abs(c.ligne[i]) <= c.largeur / 2 - 1.4);
  }
  return { longueur: c.longueur, denivele, penteMax, fermeture,
    rayonMinimum: 1 / Math.max(...Array.from(c.courbure, Math.abs)) };
});

verifier('13A départ et stands plats, droits et compatibles avec douze voitures', () => {
  const c = creerCircuit(), S = c.stands;
  assert.ok(S && S.garage1 > S.garage0 && S.fin > S.garage1 + 20);
  const yDepart = B.circuit.echantillon(c, 0).y;
  for (let s = -120; s <= S.fin; s += c.pas) {
    const e = B.circuit.echantillon(c, s);
    assert.ok(Math.abs(e.courbure) < 1 / 900, 'départ/stands droits à ' + s);
    assert.ok(Math.abs(e.pente) < 1e-8, 'départ/stands sans pente à ' + s);
    assert.ok(Math.abs(e.y - yDepart) < 1e-6, 'départ/stands au même niveau à ' + s);
    assert.ok(Math.abs(e.devers) < 1e-8, 'départ/stands sans dévers à ' + s);
  }
  const co = B.course.creer(c, { rivaux: 11, tours: TOURS, graine: 42, placeJoueur: 12 });
  assert.equal(co.voitures.length, 12);
  assert.equal(co.voitures.filter(v => !v.joueur).length, 11);
  for (const v of co.voitures) {
    assert.ok(Math.abs(v.etat.d) + B.course.empriseIA(v.etat).lat < c.largeur / 2, 'grille contenue dans la route');
  }
  return { ligneDroite: c.ligneDroite, stands: S, voitures: co.voitures.length };
});

verifier('13A reconstruction du tracé indépendante du hasard global', () => {
  const premiere = empreinteCircuit(creerCircuit()), ancienHasard = Math.random;
  try {
    Math.random = () => { throw new Error('le générateur ne doit pas utiliser Math.random'); };
    assert.deepEqual(empreinteCircuit(creerCircuit()), premiere);
  } finally { Math.random = ancienHasard; }
  return premiere;
});

verifier('13A les solides réels restent hors de toutes les portions de chaussée', () => {
  const { c } = creerMonde(), naturels = c.obstacles.objets.filter(o => ['tronc', 'roche'].includes(o.genre));
  assert.ok(naturels.length > 0, 'le banc contient des obstacles naturels');
  let margeMinimum = Infinity;
  for (const o of naturels) {
    const rayon = o.type === 'prism' ? Math.max(...o.sommets.map(v => Math.hypot(v[0], v[2])))
      : o.type === 'circle' ? o.r : Math.hypot(o.hx, o.hz);
    let distance = Infinity;
    for (let i = 0; i < c.n; i++) distance = Math.min(distance, Math.hypot(o.x - c.x[i], o.z - c.z[i]));
    const libre = distance - rayon - c.largeur / 2;
    margeMinimum = Math.min(margeMinimum, libre);
    assert.ok(libre > .5, o.genre + ' empiète sur une portion de route : ' + libre);
  }
  return { solidesActifs: c.obstacles.objets.length, obstaclesNaturels: naturels.length, margeMinimum };
});

function parcourir(nom, meteo, saison, pneus) {
  const { c } = creerMonde(saison), profil = B.saisons.profil(saison, CONTRAT.theme);
  assert.equal(profil.theme, CONTRAT.theme, 'le thème russe est reconnu par la préparation');
  B.meteo.actuel = B.chaussee.preparer({ ...meteo, fixe: true }, profil);
  const surface = B.chaussee.lire(c, 0);
  assert.equal(B.conduite.pneusConseilles(surface), pneus, 'pneus adaptés à la chaussée réelle');
  const co = B.course.creer(c, { mode: 'course', rivaux: 11, tours: TOURS, difficulte: 1, graine: 42, placeJoueur: 12 });
  // Le jeu clôt normalement huit secondes après l'arrivée du joueur. Un pilotage prudent dès le départ
  // lui évite de couper l'observation des derniers rivaux ; aucune condition de fin ni pose n'est modifiée.
  co.joueur.ia.hab = .88;
  for (const v of co.voitures) {
    Object.assign(v.etat, B.pneus.creerEtat(pneus, { seance: co.graine, voiture: v.id }));
    v.etat.pneusProchainArret = pneus; v.livree.pneus = pneus;
  }
  const voitures = co.voitures.map(v => ({ id: v.id, nom: v.nom, rival: !v.joueur, contacts: 0,
    chocs: 0, accidents: 0, replacements: 0, railSecondes: 0, serviceSecondes: 0,
    stagnationMaxSecondes: 0, stagnationHorsStandsMaxSecondes: 0, services: 0 }));
  const immobilite = new Float64Array(co.voitures.length), immobiliteHorsStands = new Float64Array(co.voitures.length);
  const accidentPrecedent = new Uint8Array(co.voitures.length), commande = {}, evenements = [];
  try {
    while (co.horloge < DUREE_MAX && !co.termine) {
      // Le joueur roule avec les mêmes commandes publiques qu'en démo : aucune pose n'est réécrite.
      if (!co.joueur.fini) B.course.commandesIA(co, co.joueur, commande);
      B.course.pas(co, commande, DT, evenements);
      for (const ev of evenements) {
        if (ev.type === 'contact') {
          if (voitures[ev.a]) voitures[ev.a].contacts++;
          if (voitures[ev.b]) voitures[ev.b].contacts++;
        } else if (ev.type === 'choc' && voitures[ev.id]) voitures[ev.id].chocs++;
        else if (ev.type === 'stand' && ev.phase === 'service' && voitures[ev.id]) voitures[ev.id].services++;
      }
      for (let i = 0; i < co.voitures.length; i++) {
        const v = co.voitures[i], e = v.etat, m = voitures[i];
        for (const cle of ['s', 'd', 'v', 'psi', 'beta', 'omega', 'y']) assert.ok(Number.isFinite(e[cle]), nom + ' : ' + v.nom + '.' + cle);
        const accident = !!(e.accident || e.recuperation);
        if (accident && !accidentPrecedent[i]) m.accidents++;
        accidentPrecedent[i] = accident ? 1 : 0;
        m.replacements = e.repositionnements || 0;
        if (e.auRail) m.railSecondes += DT;
        if (e.stands?.phase === 'service') m.serviceSecondes += DT;
        if (co.phase === 'course' && co.temps > 5 && !v.fini && Math.abs(e.v) < 1) {
          immobilite[i] += DT;
          immobiliteHorsStands[i] = e.stands ? 0 : immobiliteHorsStands[i] + DT;
        } else { immobilite[i] = 0; immobiliteHorsStands[i] = 0; }
        m.stagnationMaxSecondes = Math.max(m.stagnationMaxSecondes, immobilite[i]);
        m.stagnationHorsStandsMaxSecondes = Math.max(m.stagnationHorsStandsMaxSecondes, immobiliteHorsStands[i]);
      }
    }
    for (let i = 0; i < co.voitures.length; i++) {
      const v = co.voitures[i], m = voitures[i];
      Object.assign(m, { fini: v.fini, abandon: v.abandon, tours: v.tempsTours.length,
        tempsTours: v.tempsTours.slice(), tempsFinal: v.tempsFinal, distance: v.etat.distance,
        sFinal: v.etat.s, vitesseFinale: v.etat.v });
    }
    const bilan = { condition: nom, saison, pneus, surface, dureeSimulee: co.horloge,
      solidesActifs: c.obstacles.objets.length, rivaux: 11, toursDemandes: TOURS,
      pilotageJoueur: { hab: .88, commandesIA: true }, voitures };
    // Le bilan est aussi conservé en cas d'échec : une arrivée sauvée par un replacement ne passe pas.
    const resultat = resultats.findLast(r => r.nom === '13A ' + nom + ' : onze rivaux accomplissent trois tours sans secours');
    if (resultat) resultat.mesures = bilan;
    for (const m of voitures) {
      assert.ok(m.fini && !m.abandon && m.tours === TOURS, nom + ' : course inachevée pour ' + m.nom + ' — ' + JSON.stringify(m));
      assert.equal(m.replacements, 0, nom + ' : replacement de ' + m.nom);
      assert.equal(m.accidents, 0, nom + ' : accident de ' + m.nom);
      assert.ok(m.stagnationHorsStandsMaxSecondes < 12, nom + ' : stagnation hors stands de ' + m.nom);
      assert.ok(m.distance > c.longueur * (TOURS - .25), nom + ' : distance réellement parcourue insuffisante');
    }
    return bilan;
  } finally { B.meteo.actuel = null; }
}

if (!GEOMETRIE_SEULE) for (const [nom, meteo, saison, pneus] of [
  ['sec', { pluie: 0, mouille: 0, neigeSol: 0 }, 'ete', 'slicks'],
  ['pluie', { pluie: 1, mouille: 1, neigeSol: 0 }, 'ete', 'pluie'],
  ['neige', { pluie: .8, mouille: 0, neigeSol: .8, precipitationsNeige: true }, 'hiver', 'neige'],
]) verifier('13A ' + nom + ' : onze rivaux accomplissent trois tours sans secours', () => parcourir(nom, meteo, saison, pneus));
