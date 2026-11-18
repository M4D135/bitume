// Garde-fou du déterminisme de la simulation (version de physique p9). Les records et les fantômes des joueurs
// portent la version de la physique : tant qu'elle reste « p9 », un remaniement du pas de simulation (course,
// conduite, contacts, obstacles, dégâts, circuit) ne doit pas changer un seul bit de ce que la course produit.
//
// Chaque cas simule une séance réelle (vrais tracés du catalogue, solides du décor, douze voitures) et prend, à
// chaque seconde de simulation, une empreinte SHA-256 de l'état complet : tous les champs de chaque voiture (état
// de conduite, IA, dégâts, tours, classement), l'état public de la course et les événements de la seconde écoulée.
// Les nombres entrent tels qu'ils sont en mémoire (Float64 petit-boutiste, sans arrondi : −0 et +0 diffèrent).
// Les champs dont le nom commence par « _ » sont des caches internes des modules ; ils n'entrent pas dans
// l'empreinte, leur effet sur la suite de la course y entre.
//
// Les empreintes de référence (verifications/fixtures/determinisme-p9.json) ont été prises sur le code d'avant
// le lot « Fluidité » de la simulation (commit 54e98c9). Elles ne se réécrivent qu'avec un changement de physique
// voulu, qui fait aussi passer PHYSIQUE (src/jeu.js) à « p10 » :
//   node verifications/determinisme-simulation.test.mjs --ecrire
// Les fonctions mathématiques de Node (V8) donnent les mêmes bits d'une machine à l'autre à version égale ; une
// autre version majeure de Node peut, en principe, en changer quelques-uns (version notée dans la fixture).
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ici = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course', 'carene', 'decor']) req(path.join(ici, '..', 'src', f + '.js'));
const B = globalThis.BITUME;
const FIXTURE = path.join(ici, 'fixtures', 'determinisme-p9.json');
const ECRIRE = process.argv.includes('--ecrire');
const DT = 1 / 120, PAS_SECONDE = 120;

// Tracés du catalogue de src/jeu.js (graine, thème, longueur visée), lus et recopiés tels quels.
const CIRCUITS = {
  'val-brule': { graine: 11, theme: 'foret', longueur: 4200 },
  'port-sable': { graine: 29, theme: 'cote', longueur: 3600 },
  'haut-col': { graine: 47, theme: 'montagne', longueur: 5200 },
  'cap-sequoia': { graine: 157, theme: 'pacifique', longueur: 5200 }
};

// ------------------------------------------------------------------ empreinte canonique
class Ecrivain {
  constructor() { this.buf = Buffer.allocUnsafe(1 << 16); this.n = 0; this.vus = new Set(); }
  place(k) {
    if (this.n + k <= this.buf.length) return;
    const b = Buffer.allocUnsafe(Math.max(2 * this.buf.length, this.n + k));
    this.buf.copy(b, 0, 0, this.n); this.buf = b;
  }
  octet(x) { this.place(1); this.buf[this.n++] = x; }
  nombre(x) { this.place(9); this.buf[this.n++] = 0x64; this.buf.writeDoubleLE(x, this.n); this.n += 8; }
  texte(s) {
    const b = Buffer.from(String(s), 'utf8');
    this.place(5 + b.length); this.buf[this.n++] = 0x73; this.buf.writeUInt32LE(b.length, this.n); this.n += 4;
    b.copy(this.buf, this.n); this.n += b.length;
  }
  valeur(x) {
    if (x === null) return this.octet(0x6e);
    if (x === undefined) return this.octet(0x75);
    switch (typeof x) {
      case 'number': return this.nombre(x);
      case 'boolean': return this.octet(x ? 0x54 : 0x46);
      case 'string': return this.texte(x);
      case 'bigint': return this.texte('bigint:' + x);
      case 'function': return this.octet(0x66);
    }
    if (this.vus.has(x)) throw new Error('empreinte : cycle dans l’état');
    this.vus.add(x);
    if (Array.isArray(x) || ArrayBuffer.isView(x)) {
      this.octet(0x5b); this.place(4); this.buf.writeUInt32LE(x.length, this.n); this.n += 4;
      for (let i = 0; i < x.length; i++) this.valeur(x[i]);
      this.octet(0x5d);
    } else if (x instanceof Map) {
      const cles = [...x.keys()].sort((a, b) => String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
      this.octet(0x4d); for (const k of cles) { this.valeur(k); this.valeur(x.get(k)); } this.octet(0x6d);
    } else {
      const cles = Object.keys(x).filter(k => k[0] !== '_' && x[k] !== undefined && typeof x[k] !== 'function').sort();
      this.octet(0x7b);
      for (const k of cles) { this.texte(k); this.valeur(x[k]); }
      this.octet(0x7d);
    }
    this.vus.delete(x);
  }
  empreinte() { return createHash('sha256').update(this.buf.subarray(0, this.n)).digest('hex'); }
}

// L'état public de la course ; les voitures entrent en entier (sauf leurs caches « _ »).
function etatCourse(co) {
  const f = co.fantome && co.fantome.meilleur;
  return {
    horloge: co.horloge, temps: co.temps, dt: co.dt, phase: co.phase, mode: co.mode, toursTotal: co.toursTotal,
    difficulte: co.difficulte, feux: co.feux, delaiVert: co.delaiVert, classement: co.classement, termine: co.termine,
    drapeau: co.drapeau, finisseurs: co.finisseurs, finSansCourse: co.finSansCourse, chronoParti: co.chronoParti,
    fantomeTemps: co.fantome ? co.fantome.temps : null, fantome: f ? { n: f.n, donnees: f.donnees } : null,
    enregN: co.enreg.n, enregProchain: co.enreg.prochain, enreg: co.enreg.donnees.subarray(0, 4 * co.enreg.n),
    statsIa: co.statsIa, sAvant: co.sAvant, contactsT: co.contactsT, tempsReference: co.tempsReference, vref: co.vref,
    enLigne: co.enLigne, duo: co.duo, vuFantome: co.mode === 'chrono' ? B.course.fantome(co) : null,
    voitures: co.voitures
  };
}
function empreinteSeconde(co, evenements) {
  const w = new Ecrivain();
  w.valeur(etatCourse(co)); w.valeur(evenements);
  return w.empreinte();
}
function empreinteObstacles(liste) { const w = new Ecrivain(); w.valeur(liste); return w.empreinte(); }

// ------------------------------------------------------------------ séances
function lire(c, tab, s) {
  const L = c.longueur, f = (((s % L) + L) % L) / c.pas, fi = Math.floor(f), i = fi % c.n, j = (i + 1) % c.n;
  return tab[i] + (tab[j] - tab[i]) * (f - fi);
}
// tracé, décor et solides neufs pour chaque cas : aucun état ne passe d'un cas à l'autre
function circuit(nom) {
  const k = CIRCUITS[nom], c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur });
  const decor = B.decor.construire(c);
  c.obstacles = B.obstacles.creer(decor.obstacles);
  return { c, obstacles: empreinteObstacles(decor.obstacles), solides: c.obstacles.objets.length };
}
function pneus(co, eau, choix = {}) {
  const conseil = B.conduite.pneusConseilles(eau);
  for (const v of co.voitures) v.etat.pneus = choix[v.id] || conseil;
}
function meteo(m) { if (m) B.meteo = { actuel: m }; else delete B.meteo; }

// Pilote humain simulé : la trajectoire de l'IA, mais la boîte à la main, la dérive au bouton dans les virages et
// le guidage du clavier une seconde sur quatre ; il passe par les chemins de la conduite que les rivaux ne prennent
// jamais (rapports manuels, dérive, turbo, guidage), ceux dont dépendent les records et les fantômes.
function piloteHumain(co, v) {
  const base = B.course.commandesIA(co, v), e = v.etat, c = co.c;
  const cmd = { gaz: base.gaz, frein: base.frein, volant: base.volant, derive: false, haut: false, bas: false, boite: 'manuelle', aide: .35, guidage: 0, marcheArriere: false };
  if (e.regime > 12400 && e.rapport < 6) cmd.haut = true;
  else if (e.regime < 9300 && e.rapport > 1) cmd.bas = true;
  if (Math.abs(lire(c, c.courbure, e.s + 12)) > 1 / 170 && e.v > 18 && cmd.frein < .3) {
    cmd.derive = true;
    // contre-braquage tenu une fois la caisse en travers, comme un pilote qui rattrape sa glisse
    if (e.derive.actif && e.derive.sens * e.beta > .03) cmd.volant = -e.derive.sens * .45;
  }
  if (Math.floor(co.horloge) % 4 === 1) cmd.guidage = .5;
  return cmd;
}
// Visée simple d'un décalage et d'une vitesse, pour les manœuvres scriptées (stands, arrêt, mur).
function viser(co, v, dVise, vVise, cmd) {
  const e = v.etat, c = co.c, vv = Math.max(e.v, 5), la = 8 + .45 * vv;
  const k = lire(c, c.courbure, e.s), psiC = Math.atan2(dVise - e.d, la);
  cmd.volant = Math.max(-1, Math.min(1, B.conduite.volantPour(e, k + 2.2 * (psiC - e.psi) / 10)));
  cmd.gaz = Math.max(0, Math.min(1, (vVise - e.v) * .8 + .35));
  cmd.frein = Math.max(0, Math.min(1, (e.v - vVise - 1) * .3));
  return cmd;
}
// Pilote casseur : arrêt aux stands, conduite à la dérive, arrêt sur la trajectoire au milieu du peloton, marche
// arrière, plein gaz braqué vers le rail, replacement à la main.
function piloteCasseur(etatScript) {
  return (co, v) => {
    const e = v.etat, c = co.c, t = co.phase === 'course' ? co.temps : -1, S = c.stands;
    const cmd = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: .35, guidage: 0, marcheArriere: true };
    if (t < 0) { cmd.gaz = .6; return cmd; }                          // grille et feux : le moteur chante
    if (!e.stands && e.standsSortie) etatScript.sortiStands = true;
    if (S && t < 30 && !etatScript.sortiStands) {
      const ecartGarage = B.circuit.ecart(c, e.s, S.garage0 + 14);
      if (e.stands && e.stands.phase === 'sortie') viser(co, v, S.d, 20, cmd);
      else if ((e.stands && e.stands.phase === 'service') || ecartGarage <= 2) { viser(co, v, S.d, 0, cmd); cmd.gaz = 0; cmd.frein = 1; cmd.marcheArriere = false; }
      else viser(co, v, S.d, 8, cmd);
      return cmd;
    }
    if (t < 42) { const h = piloteHumain(co, v); h.boite = 'auto'; h.marcheArriere = true; return h; }
    if (t < 47) { cmd.frein = 1; return cmd; }                           // arrêt sur place, puis recul au frein tenu
    if (t < 52) { const h = piloteHumain(co, v); h.boite = 'auto'; h.derive = false; return h; }
    if (t < 55) { cmd.gaz = 1; cmd.volant = e.d >= 0 ? 1 : -1; return cmd; }   // plein gaz vers le rail le plus proche
    if (!etatScript.replace && t >= 58) { etatScript.replace = true; etatScript.evenements.push(...B.course.replacer(co, v)); }
    const h = piloteHumain(co, v); h.boite = 'auto'; return h;
  };
}

// Fait tourner une séance : `pilotes` donne, pour chaque voiture conduite ici, la fonction de commande ; sans
// pilote, la voiture du joueur est confiée à l'IA (comme la vitrine et BITUME_JEU.avancer(s, true)).
function derouler(co, { secondes, pilotes = null, jusquaFin = false, perturber = null, avantPas = null }) {
  const empreintes = [], compte = {};
  let evenements = [];
  const total = Math.round(secondes * PAS_SECONDE);
  const etatScript = co._script || { evenements: [] };
  for (let k = 0; k < total; k++) {
    if (jusquaFin && co.termine) break;
    if (avantPas) avantPas(co, k);
    let cmd;
    if (pilotes) {
      const locaux = co.voitures.filter(v => v.joueur && pilotes[v.id]);
      if (co.duo) { cmd = []; for (const v of locaux) cmd[v.id] = pilotes[v.id](co, v); }
      else cmd = pilotes[co.joueur.id](co, co.joueur);
    } else cmd = co.joueur.fini ? null : B.course.commandesIA(co, co.joueur);
    const ev = B.course.pas(co, cmd, DT);
    // les événements d'un geste scripté (replacement à la main), produits avant le pas, entrent avant les siens
    for (const e of etatScript.evenements) { evenements.push(e); compte[e.type] = (compte[e.type] || 0) + 1; }
    etatScript.evenements.length = 0;
    for (const e of ev) { evenements.push(e); compte[e.type] = (compte[e.type] || 0) + 1; }
    if (perturber) perturber(co, k);
    if ((k + 1) % PAS_SECONDE === 0 || k === total - 1 || (jusquaFin && co.termine)) {
      empreintes.push(empreinteSeconde(co, evenements));
      evenements = [];
    }
  }
  return { empreintes, compte };
}
function resume(co, compte, extra = {}) {
  return {
    horloge: +co.horloge.toFixed(3), phase: co.phase, termine: co.termine, classement: co.classement.slice(),
    tours: co.voitures.map(v => v.tours), fini: co.voitures.filter(v => v.fini).length,
    vMax: +Math.max(...co.voitures.map(v => v.etat.v)).toFixed(3),
    casses: co.voitures.filter(v => v.degats && v.degats.chocs > 0).length,
    evenements: Object.fromEntries(Object.entries(compte).sort()), ...extra
  };
}

// ------------------------------------------------------------------ cas
const CAS = [];
for (const nom of ['val-brule', 'haut-col', 'cap-sequoia'])
  for (const graine of [7, 51234])
    for (const difficulte of [1, 2])
      CAS.push({
        nom: `${nom}-g${graine}-d${difficulte}`,
        jouer() {
          meteo(null);
          const { c, obstacles, solides } = circuit(nom);
          const co = B.course.creer(c, { mode: 'course', tours: 3, difficulte, rivaux: 11, graine, placeJoueur: 8 });
          pneus(co, 0);
          const r = derouler(co, { secondes: 60 });
          return { ...r, resume: resume(co, r.compte, { obstacles, solides }) };
        }
      });

// Chrono : un premier tour de l'IA donne le fantôme « gardé » (comme celui que lancer() relit du stockage) ; la
// séance suivante le court avec le pilote humain simulé, qui enregistre le sien et le remplace s'il est meilleur.
function fantomeSource() {
  meteo(null);
  const { c } = circuit('port-sable');
  const co = B.course.creer(c, { mode: 'chrono', rivaux: 0 });
  pneus(co, 0);
  let tour = null;
  for (let k = 0; k < 200 * PAS_SECONDE && !tour; k++)
    for (const e of B.course.pas(co, B.course.commandesIA(co, co.joueur), DT)) if (e.type === 'tour' && e.valide) tour = e;
  if (!tour || !co.fantome.meilleur) throw new Error('chrono : aucun tour valide pour le fantôme source');
  return { donnees: Float32Array.from(co.fantome.meilleur.donnees), n: co.fantome.meilleur.n, temps: co.fantome.temps };
}
CAS.push({
  nom: 'chrono-fantome-port-sable',
  jouer() {
    const source = fantomeSource();
    meteo(null);
    const { c, obstacles, solides } = circuit('port-sable');
    const co = B.course.creer(c, { mode: 'chrono', rivaux: 0 });
    pneus(co, 0);
    co.fantome = { meilleur: { donnees: source.donnees, n: source.n }, temps: source.temps };
    const r = derouler(co, { secondes: 200, pilotes: { 0: piloteHumain } });
    return { ...r, resume: resume(co, r.compte, { obstacles, solides, fantomeSource: source.temps, fantome: co.fantome.temps, tempsTours: co.joueur.tempsTours.slice() }) };
  }
});

// Accidents : deux pilotes à l'écran partagé sous la pluie, l'un casseur (stands, arrêt au milieu du peloton, recul,
// plein gaz vers le rail, replacement), l'autre humain simulé sur intermédiaires ; dix rivaux sur pneus pluie.
CAS.push({
  nom: 'accidents-duo-pluie-haut-col',
  jouer() {
    meteo({ pluie: .75, mouille: .4 });
    try {
      const { c, obstacles, solides } = circuit('haut-col');
      const co = B.course.creer(c, { mode: 'course', tours: 3, difficulte: 1, rivaux: 11, graine: 977, placeJoueur: 1,
        humains: { noms: ['Joueur 1', 'Joueur 2'], locaux: [0, 1], hote: true, enLigne: false } });
      pneus(co, B.conduite.eauSurPiste(), { 0: 'slicks', 1: 'inter' });
      const etatScript = { evenements: [] };
      co._script = etatScript;
      const r = derouler(co, { secondes: 75, pilotes: { 0: piloteCasseur(etatScript), 1: piloteHumain } });
      delete co._script;
      return { ...r, resume: resume(co, r.compte, { obstacles, solides, sortiStands: !!etatScript.sortiStands, chocs: co.voitures.map(v => v.degats.chocs) }) };
    } finally { meteo(null); }
  }
});

// Accident contre un solide du décor : virage serré abordé à 180 km/h sans braquer (approche de
// verifications/decor-obstacles.test.mjs), casse, remise en piste, puis l'IA repart.
CAS.push({
  nom: 'accident-solide-val-brule',
  jouer() {
    meteo(null);
    const { c, obstacles, solides } = circuit('val-brule');
    const co = B.course.creer(c, { mode: 'chrono', rivaux: 0 });
    pneus(co, 0);
    const e = co.joueur.etat;
    Object.assign(e, { s: 2195, d: 0, v: 50, rapport: 6, psi: 0 });
    let casse = false;
    const pilote = (co, v) => {
      if (v.etat.degats.casse) casse = true;
      return casse ? B.course.commandesIA(co, v) : { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0, guidage: 0 };
    };
    const r = derouler(co, { secondes: 12, pilotes: { 0: pilote } });
    return { ...r, resume: resume(co, r.compte, { obstacles, solides, casse }) };
  }
});

// Solides posés sur la piste même (piles de pneus, murets, troncs inclinés) en plus de ceux du décor : l'IA ne les
// évite pas, le peloton les percute à toutes les vitesses (frôlements, chocs légers, casses, prismes, remise en
// piste sur un solide). Le décor réel les tient derrière les glissières ; ici, chaque branche du balayage travaille.
CAS.push({
  nom: 'solides-sur-piste-val-brule',
  jouer() {
    meteo(null);
    const { c, obstacles } = circuit('val-brule'), liste = [];
    const sol = (s, d) => B.circuit.point(c, s, d, 0), capA = s => B.circuit.echantillon(c, s).cap;
    [[150, 1.5], [240, -3], [330, 0], [470, 2.6], [640, -1.2], [820, .4], [1010, -2.2], [1230, 3.1], [1480, 0], [1760, -.6]].forEach(([s, d]) => {
      const p = sol(s, d); liste.push({ type: 'circle', x: p[0], z: p[2], r: .37, ymin: p[1], ymax: p[1] + .8, genre: 'pneus' });
    });
    [[200, 4.6, 0], [380, -4.4, 0], [560, 3.8, .35], [900, -3.6, -.4], [1350, 0, Math.PI / 2]].forEach(([s, d, tourne]) => {
      const p = sol(s, d); liste.push({ type: 'box', x: p[0], z: p[2], angle: capA(s) + tourne, hx: tourne === Math.PI / 2 ? 1.6 : 5, hz: .25, ymin: p[1], ymax: p[1] + 1, genre: 'muret' });
    });
    [[290, -1.8], [520, 2.2], [730, -2.8], [1120, 1.1], [1600, 2.4]].forEach(([s, d], i) => {
      const p = sol(s, d); liste.push({ type: 'prism', p: [p[0], p[1] + 6, p[2]], s: [.45, 12, .45], r: [.05 * (i - 2), .3 * i, -.04], sides: 16, genre: 'tronc' });
    });
    const index = B.obstacles.creer(liste.concat(B.decor.construire(c).obstacles));
    c.obstacles = index;
    const co = B.course.creer(c, { mode: 'course', tours: 3, difficulte: 2, rivaux: 11, graine: 99, placeJoueur: 4 });
    pneus(co, 0);
    const r = derouler(co, { secondes: 60 });
    return { ...r, resume: resume(co, r.compte, { obstacles, solides: index.objets.length, ajoutes: empreinteObstacles(liste), chocs: co.voitures.map(v => v.degats.chocs) }) };
  }
});

// Manœuvres d'un pilote seul, une à une : rupteur en deuxième ; dérive au bouton tenue tout le premier virage
// (trois paliers) puis turbo ; replacement à la main ; arrêt complet, marche arrière au frein, roue libre en
// arrière, gaz en arrière, frein sans marche arrière ; appui contre le rail à 30 m/s, glissade lente le long du
// rail ; saut retombé en tonneau, remise en piste automatique.
CAS.push({
  nom: 'manoeuvres-cap-sequoia',
  jouer() {
    meteo(null);
    const { c, obstacles, solides } = circuit('cap-sequoia');
    const co = B.course.creer(c, { mode: 'chrono', rivaux: 0 });
    pneus(co, 0);
    const etatScript = { evenements: [] }, g = { phase: 0, t0: 0, turbo: false, arret: -1, recul: false, saute: false };
    co._script = etatScript;
    const pilote = (co, v) => {
      const e = v.etat, t = co.temps, dr = e.derive;
      const cmd = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'manuelle', aide: 0, guidage: 0, marcheArriere: false };
      if (e.rapport === -1) g.recul = true;
      if (g.phase === 0) {
        if (t < 6) { viser(co, v, 0, 80, cmd); cmd.gaz = 1; cmd.frein = 0; cmd.haut = e.rapport < 2; return cmd; }
        g.phase = 1;
      }
      if (g.phase === 1) {
        // le pilote humain simulé, mais la dérive tenue sans frein jusqu'à la sortie du virage, contre-braquée
        const h = piloteHumain(co, v);
        if (dr.actif) {
          h.derive = Math.abs(lire(c, c.courbure, e.s)) > 1 / 250; h.frein = 0;
          if (dr.sens * e.beta > .03) h.volant = -dr.sens * .45;
        } else if (h.derive) h.frein = 0;
        if (e.turbo.reste > 0) { g.turbo = true; if (e.turbo.ecoule > .25) { h.frein = .3; h.gaz = 0; } return h; }
        if (!g.turbo && t < 40) return h;
        etatScript.evenements.push(...B.course.replacer(co, v));
        g.phase = 2; g.t0 = t;
      }
      cmd.boite = 'auto';
      if (g.phase === 2) {
        const u = t - g.t0;
        if (u < 3) return viser(co, v, 0, 30, cmd);
        if (g.arret < 0) {
          if (Math.abs(e.v) > .05 && u < 8) { viser(co, v, 0, 0, cmd); cmd.gaz = 0; cmd.frein = 1; return cmd; }
          g.arret = t;
        }
        const w = t - g.arret;
        if (w < 2) { cmd.frein = 1; cmd.marcheArriere = true; return cmd; }
        if (w < 3) { cmd.marcheArriere = true; return cmd; }
        if (w < 4) { cmd.gaz = .5; cmd.marcheArriere = true; return cmd; }
        if (w < 5) { cmd.frein = 1; return cmd; }
        if (w < 8) return viser(co, v, 0, 30, cmd);
        if (w < 10.5) return viser(co, v, -21, 30, cmd);
        if (w < 12.5) return viser(co, v, -30, 1.5, cmd);
        B.conduite.lancerSaut(e, { grand: true, h: 1.8, duree: 1, tangV: 1.1, roulV: 1.4, pouss: 1 });
        g.phase = 3; g.saute = true;
      }
      const h = piloteHumain(co, v); h.boite = 'auto'; return h;
    };
    const r = derouler(co, { secondes: 45, pilotes: { 0: pilote } });
    delete co._script;
    return { ...r, resume: resume(co, r.compte, { obstacles, solides, recul: g.recul, saute: g.saute }) };
  }
});

// Arrivée : une course d'un tour jusqu'au bout (drapeau, tour de décélération, classement final), le joueur à l'IA
// puis, une fois arrivé, sans commande (comme finirClassement dans src/jeu.js).
CAS.push({
  nom: 'arrivee-un-tour-port-sable',
  jouer() {
    meteo(null);
    const { c, obstacles, solides } = circuit('port-sable');
    const co = B.course.creer(c, { mode: 'course', tours: 1, difficulte: 0, rivaux: 11, graine: 3141, placeJoueur: 5 });
    pneus(co, 0);
    const r = derouler(co, { secondes: 240, jusquaFin: true });
    return { ...r, resume: resume(co, r.compte, { obstacles, solides, tempsFinal: co.voitures.map(v => v.tempsFinal) }) };
  }
});

// En ligne, chez l'hôte : la voiture de l'invité est « distante », son état vient d'ailleurs (ici, une
// prolongation scriptée sur la trajectoire) ; les rivaux voient son état à chaque pas.
CAS.push({
  nom: 'en-ligne-hote-val-brule',
  jouer() {
    meteo(null);
    const { c, obstacles, solides } = circuit('val-brule');
    const co = B.course.creer(c, { mode: 'course', tours: 3, difficulte: 1, rivaux: 11, graine: 2718, placeJoueur: 3,
      humains: { noms: ['Hôte', 'Invité'], locaux: [0], hote: true, enLigne: true } });
    pneus(co, 0);
    co.distant = (v, dt) => {
      const e = v.etat;
      if (co.phase !== 'course') return;
      e.v = Math.min(62, e.v + 9 * dt); e.s = ((e.s + e.v * dt) % c.longueur + c.longueur) % c.longueur;
      e.d = lire(c, c.ligne, e.s) * .8; e.psi = 0; e.beta = 0; e.omega = 0; e.rapport = Math.min(6, 1 + Math.floor(e.v / 12));
    };
    const r = derouler(co, { secondes: 45 });
    return { ...r, resume: resume(co, r.compte, { obstacles, solides }) };
  }
});

// ------------------------------------------------------------------ contrôle
const t0 = performance.now();
const resultats = {};
for (const cas of CAS) {
  const t = performance.now(), r = cas.jouer();
  resultats[cas.nom] = { secondes: r.empreintes.length, empreintes: r.empreintes, resume: r.resume, duree: performance.now() - t };
}
// Chaque scénario doit vraiment passer par les chemins qu'il prétend garder : sinon l'empreinte ne prouve rien.
const COUVERTURE = {
  'accidents-duo-pluie-haut-col': ['contact', 'choc', 'retour', 'stand', 'derive', 'rapport', 'rupteur', 'feu', 'vert'],
  'accident-solide-val-brule': ['choc', 'casse', 'roue', 'retour'],
  'solides-sur-piste-val-brule': ['choc', 'casse', 'retour', 'contact'],
  'manoeuvres-cap-sequoia': ['rupteur', 'derive', 'niveau', 'turbo', 'choc', 'tonneau', 'retour'],
  'chrono-fantome-port-sable': ['tour', 'rapport', 'derive', 'turbo'],
  'arrivee-un-tour-port-sable': ['tour', 'arrivee', 'contact'],
  'en-ligne-hote-val-brule': ['vert']
};
// gestes sans événement propre, relevés par le script lui-même
const GESTES = { 'accidents-duo-pluie-haut-col': ['sortiStands'], 'manoeuvres-cap-sequoia': ['recul', 'saute'] };
let echecs = 0;
for (const [nom, types] of Object.entries(COUVERTURE)) for (const type of types)
  if (!resultats[nom].resume.evenements[type]) { echecs++; console.error(`KO  couverture : ${nom} sans événement « ${type} »`); }
for (const [nom, gestes] of Object.entries(GESTES)) for (const geste of gestes)
  if (resultats[nom].resume[geste] !== true) { echecs++; console.error(`KO  couverture : ${nom} sans le geste « ${geste} »`); }

if (ECRIRE) {
  const fixture = {
    format: 'bitume-determinisme-1', physique: 'p9', base: '54e98c9', node: process.version,
    explication: 'Empreintes SHA-256, à chaque seconde de simulation, de l’état complet des voitures, de la course et des événements (verifications/determinisme-simulation.test.mjs).',
    cas: Object.fromEntries(Object.entries(resultats).map(([nom, r]) => [nom, { secondes: r.secondes, resume: r.resume, empreintes: r.empreintes }]))
  };
  writeFileSync(FIXTURE, JSON.stringify(fixture, null, 1) + '\n');
  console.log(`fixture écrite : ${Object.keys(resultats).length} cas, ${Object.values(resultats).reduce((a, r) => a + r.secondes, 0)} empreintes`);
}

const ref = JSON.parse(readFileSync(FIXTURE, 'utf8'));
if (ref.physique !== 'p9') { console.error('KO  la fixture ne porte pas la physique p9'); process.exit(1); }
for (const [nom, r] of Object.entries(resultats)) {
  const attendu = ref.cas[nom];
  if (!attendu) { echecs++; console.error(`KO  ${nom} : absent de la fixture`); continue; }
  let premier = -1;
  const n = Math.max(attendu.empreintes.length, r.empreintes.length);
  for (let i = 0; i < n; i++) if (attendu.empreintes[i] !== r.empreintes[i]) { premier = i; break; }
  if (premier >= 0) {
    echecs++;
    console.error(`KO  ${nom} : diverge à la seconde ${premier + 1} sur ${attendu.empreintes.length}`);
    console.error('    attendu ' + JSON.stringify(attendu.resume));
    console.error('    obtenu  ' + JSON.stringify(r.resume));
  } else console.log(`ok  ${nom} : ${r.empreintes.length} empreintes identiques (${(r.duree / 1000).toFixed(2)} s)`);
}
for (const nom of Object.keys(ref.cas)) if (!resultats[nom]) { echecs++; console.error(`KO  ${nom} : cas de la fixture non joué`); }

// L'empreinte voit un écart d'un seul ulp : la même séance, la vitesse d'un rival lancé décalée du plus petit
// écart représentable au pas 1200 (10 s), doit diverger dès la seconde 10 et pas avant.
{
  meteo(null);
  const nom = 'val-brule-g7-d1', { c } = circuit('val-brule');
  const co = B.course.creer(c, { mode: 'course', tours: 3, difficulte: 1, rivaux: 11, graine: 7, placeJoueur: 8 });
  pneus(co, 0);
  const f64 = new Float64Array(1), u64 = new BigUint64Array(f64.buffer);
  const r = derouler(co, { secondes: 14, perturber: (co, k) => { if (k === 1199) { const e = co.voitures[3].etat; f64[0] = e.v; u64[0] += 1n; e.v = f64[0]; } } });
  const attendu = ref.cas[nom].empreintes, avant = r.empreintes.slice(0, 9).every((h, i) => h === attendu[i]);
  const apres = r.empreintes.slice(9).every((h, i) => h !== attendu[9 + i]);
  if (avant && apres) console.log('ok  sensibilité : un ulp sur une vitesse au pas 1200 change l’empreinte dès la seconde 10');
  else { echecs++; console.error('KO  sensibilité : l’empreinte ne voit pas un écart d’un ulp', { avant, apres }); }
}

const total = Object.values(resultats).reduce((a, r) => a + r.secondes, 0);
console.log(`${echecs ? 'KO' : 'ok'}  déterminisme p9 : ${Object.keys(resultats).length} cas, ${total} empreintes, ${((performance.now() - t0) / 1000).toFixed(1)} s`);
if (echecs) process.exit(1);
