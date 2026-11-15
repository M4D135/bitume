import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));

charger('circuit.js');
charger('conduite.js');
charger('course.js');

const B = globalThis.BITUME;

let nbOk = 0;
function verifier(nom, f) {
  try {
    f();
    nbOk++;
    console.log('ok  ' + nom);
  } catch (e) {
    console.error('KO  ' + nom);
    console.error(e);
    process.exit(1);
  }
}

const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
const dt = 1 / 120;

verifier('feux', () => {
  const course = B.course.creer(c, { mode: 'course', graine: 42, placeJoueur: 1 });
  const evts = [];
  let t = 0;
  while (t < 10 && !course.feux.vert) {
    const e = B.course.pas(course, { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 }, dt);
    evts.push(...e);
    t += dt;
  }
  const feuxEvts = evts.filter(e => e.type === 'feu');
  assert.equal(feuxEvts.length, 5, '5 evenements feu');
  const vertEvt = evts.find(e => e.type === 'vert');
  assert.ok(vertEvt, 'evenement vert');
  assert.ok(t >= 5.4 && t <= 7.0, 'vert entre 5.4 et 7.0s, t=' + t);
  const joueur = course.joueur;
  assert.equal(joueur.etat.v, 0, 'joueur arrete avant vert');
});

verifier('course 2 tours', () => {
  const course = B.course.creer(c, { mode: 'course', tours: 2, difficulte: 1, rivaux: 11, graine: 42, placeJoueur: 8 });
  let t = 0;
  const sommeD = new Float64Array(12), nbD = new Float64Array(12);
  while (t < 600 && !course.termine) {
    B.course.pas(course, { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 }, dt);
    if (course.phase === 'course') for (const v of course.voitures) if (!v.joueur && !v.fini) { sommeD[v.id] += Math.abs(v.etat.d); nbD[v.id]++; }
    t += dt;
  }
  for (let i = 1; i < 12; i++) assert.ok(sommeD[i] / nbD[i] < 10, 'ecart lateral moyen ' + i + ' = ' + (sommeD[i] / nbD[i]).toFixed(2));
  assert.ok(course.termine, 'termine vrai');
  const rivaux = course.voitures.filter(v => !v.joueur);
  for (const r of rivaux) {
    assert.ok(r.fini, 'rival ' + r.id + ' fini');
    assert.ok(r.tempsTours.length >= 2, 'rival ' + r.id + ' a 2 tours');
    let sommePasVitesse = 0;
    for (let i = 0; i < c.n; i++) {
      sommePasVitesse += c.pas / c.vitesse[i];
    }
    // Le trafic évité et les récupérations pénalisent un tour ; sa borne haute se teste seul, ci-dessous.
    for (const tempsTour of r.tempsTours) assert.ok(tempsTour >= 0.9 * sommePasVitesse, 'temps tour ' + r.id + ' : ' + tempsTour.toFixed(2) + ' s pour ' + sommePasVitesse.toFixed(2));
  }
  const positions = course.voitures.map(v => v.position);
  const sorted = [...positions].sort((a, b) => a - b);
  for (let i = 0; i < positions.length; i++) {
    assert.equal(sorted[i], i + 1, 'position ' + (i + 1));
  }
});

verifier('depassements', () => {
  const course = B.course.creer(c, { mode: 'course', tours: 2, difficulte: 1, rivaux: 11, graine: 42, placeJoueur: 8 });
  const rivaux = course.voitures.filter(v => !v.joueur);
  const ordre = () => rivaux.slice().sort((a, b) => a.position - b.position).map(v => v.id).join(',');
  let ordrePrec = ordre();
  let changements = 0;
  let t = 0;
  while (t < 600 && !course.termine) {
    B.course.pas(course, { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 }, dt);
    t += dt;
    const ordreCourant = ordre();
    if (ordreCourant !== ordrePrec) {
      changements++;
      ordrePrec = ordreCourant;
    }
  }
  assert.ok(changements >= 3, 'au moins 3 changements d ordre, ' + changements);
});

verifier('contacts', () => {
  const course = B.course.creer(c, { mode: 'course', graine: 42, placeJoueur: 1 });
  const v1 = course.voitures[0];
  const v2 = course.voitures[1];
  v1.etat.s = 100;
  v1.etat.d = 0;
  v1.etat.v = 10;
  v2.etat.s = 101;
  v2.etat.d = 0.5;
  v2.etat.v = 10;
  const evts = B.course.pas(course, { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 }, dt);
  const contactsEvts = evts.filter(e => e.type === 'contact');
  assert.equal(contactsEvts.length, 1, 'un seul contact');
  assert.equal(contactsEvts[0].a, v1.id);
  assert.equal(contactsEvts[0].b, v2.id);
  const ds = Math.abs(B.circuit.ecart(c, v1.etat.s, v2.etat.s)), dd = Math.abs(v2.etat.d - v1.etat.d);
  assert.ok(ds >= 4.5 - 1e-9 || dd >= 1.9 - 1e-9, 'separees en un pas');
  v2.etat.d = v1.etat.d + 0.5;
  let autres = 0;
  for (let i = 0; i < 30; i++) autres += B.course.pas(course, { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 }, dt).filter(e => e.type === 'contact').length;
  assert.equal(autres, 0, 'pas de second evenement dans les 0,3 s');
});

verifier('chrono fantome', () => {
  const course = B.course.creer(c, { mode: 'chrono', graine: 42, placeJoueur: 1 });
  let t = 0;
  while (t < 300 && course.joueur.tours < 3) {
    const cmd = B.course.commandesIA(course, course.joueur);
    B.course.pas(course, cmd, dt);
    t += dt;
  }
  let reference=0; for(let i=0;i<c.n;i++)reference+=c.pas/c.vitesse[i];
  for(const t of course.joueur.tempsTours) assert.ok(t>=.9*reference && t<=1.25*reference,
    'tour solitaire entre0,9 et1,25 du temps idéal : '+t.toFixed(2)+' / '+reference.toFixed(2));
  assert.ok(course.fantome.meilleur, 'fantome existe');
  assert.ok(course.fantome.temps > 0, 'temps fantome > 0');
  const f = B.course.fantome(course);
  assert.ok(f, 'fantome renvoie des positions');
  assert.ok(Math.abs(B.circuit.ecart(c, 0, f.s)) < 40, 'fantome pres de la ligne en debut de tour : ' + f.s);
  assert.equal(course.joueur.tempsTours.length, 3, 'trois tours chronometres');
  assert.ok(Math.abs(course.fantome.temps - Math.min(...course.joueur.tempsTours)) < 1e-9, 'fantome = meilleur tour');
});

verifier('determinisme', () => {
  const course1 = B.course.creer(c, { mode: 'course', graine: 42, placeJoueur: 8 });
  const course2 = B.course.creer(c, { mode: 'course', graine: 42, placeJoueur: 8 });
  let t = 0;
  while (t < 60) {
    B.course.pas(course1, { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 }, dt);
    B.course.pas(course2, { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 }, dt);
    t += dt;
  }
  assert.deepEqual(course1.classement, course2.classement, 'classements identiques');
  for (let i = 0; i < course1.voitures.length; i++) {
    assert.equal(course1.voitures[i].etat.s, course2.voitures[i].etat.s, 's identique');
    assert.equal(course1.voitures[i].etat.v, course2.voitures[i].etat.v, 'v identique');
  }
});

verifier('performance', () => {
  const course = B.course.creer(c, { mode: 'course', graine: 42, placeJoueur: 8 });
  const debut = Date.now();
  let t = 0;
  while (t < 60) {
    B.course.pas(course, { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 }, dt);
    t += dt;
  }
  const duree = Date.now() - debut;
  assert.ok(duree < 1500, '60s de course en moins de 1.5s, duree=' + duree + 'ms');
});

verifier('aspiration', () => {
  // ligne droite d'essai : à 10 m derrière un rival à 250 km/h, au moins 3 m gagnés en 4 s sur l'air libre ;
  // rien au-delà de 30 m ou de 2 m d'écart latéral
  const vrai = B.circuit;
  B.circuit = {
    echantillon: () => ({ x: 0, y: 0, z: 0, cap: 0, courbure: 0, pente: 0, devers: 0, ligne: 0, vitesse: 0 }),
    vibreurA: () => false, ecart: (c, a, b) => a - b
  };
  try {
    const droite = { longueur: 1e6, largeur: 12, limite: 20 }, v0 = 250 / 3.6;
    const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
    const gain = (derriere, cote) => {
      const rival = B.conduite.creer(1000, 0), suiveur = B.conduite.creer(1000 - derriere, cote), seul = B.conduite.creer(0, 0);
      for (const e of [rival, suiveur, seul]) { e.v = v0; e.rapport = 6; }
      const V = [{ etat: rival }, { etat: suiveur }];
      for (let i = 0; i < 480; i++) {
        B.course.aspirer(droite, V);
        B.conduite.pas(suiveur, cmd, droite, dt); B.conduite.pas(seul, cmd, droite, dt);
        rival.v = v0; rival.s += v0 * dt;
      }
      return (suiveur.s - (1000 - derriere)) - seul.s;
    };
    const g10 = gain(10, 0), gCote = gain(10, 2.1);
    assert.ok(g10 >= 3, 'gain à 10 m : ' + g10.toFixed(2) + ' m');
    assert.ok(Math.abs(gCote) < .01, 'gain à 2,1 m de côté : ' + gCote.toFixed(3) + ' m');
    // part d'aspiration selon la place derrière le rival
    const part = (derriere, cote) => {
      const V = [{ etat: B.conduite.creer(1000, 0) }, { etat: B.conduite.creer(1000 - derriere, cote) }];
      B.course.aspirer(droite, V); return V[1].etat.aspiration;
    };
    assert.ok(part(29, 0) > 0 && part(30.5, 0) === 0 && part(10, 2.05) === 0 && part(10, 1.5) > 0, 'portée et côté');
  } finally { B.circuit = vrai; }
});

console.log('---');
console.log(nbOk + ' tests passes');
process.exit(0);
