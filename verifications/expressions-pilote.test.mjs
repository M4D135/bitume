// Expressions visuelles : les vrais croisements de progression doivent aussi se produire côte à côte.
// Aucun moteur physique ni hasard de course n'est remplacé ou avancé par ce module.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const maths = Object.create(Math);
maths.random = () => { throw new Error('hasard global utilisé par une expression'); };
const contexte = vm.createContext({ Math: maths });
vm.runInContext(readFileSync(new URL('../src/expressions-pilote.js', import.meta.url), 'utf8'), contexte);
const X = contexte.BITUME.expressionsPilote;
const etat = (id, progression = 100) => ({ id, progression, fini: false, abandon: false,
  etat: { v: 30, rapport: 3, accident: null, recuperation: null, degats: { casse: false } } });
function seance(nombre = 2, graine = 1) {
  const co = { phase: 'course', termine: false, voitures: Array.from({ length: nombre }, (_, i) => etat(i)) };
  Object.defineProperty(co, 'rng', { get() { throw new Error('RNG de course consulté'); } });
  const poses = Array.from({ length: nombre }, (_, i) => ({ x: 100, y: 0, z: i * 3, cap: 0 }));
  return { E: X.creer(nombre, graine), co, poses };
}
function image(s, t, demo = false) { X.actualiser(s.E, s.co, s.poses, t, demo); }
function droit(s, t) {
  for (let i = 0; i < s.co.voitures.length; i++) {
    s.co.voitures[i].progression = 100 + 30 * t + i * 50;
    s.poses[i].x = s.co.voitures[i].progression;
  }
}
function duel(s, t, cote = 1) {
  // Le n°0 gagne 4 m/s sur le n°1 ; centres à hauteur à t=1 s, passage confirmé vers t=1,2 s.
  const a = s.co.voitures[0], b = s.co.voitures[1];
  a.progression = 96 + 34 * t; b.progression = 100 + 30 * t;
  a.etat.v = 34; b.etat.v = 30;
  s.poses[0].x = a.progression; s.poses[0].z = 0;
  s.poses[1].x = b.progression; s.poses[1].z = cote * 3;
}
function avancer(s, debut, fin, disposer = droit, demo = false, hz = 60) {
  for (let k = Math.round(debut * hz); k <= Math.round(fin * hz); k++) {
    const t = k / hz; disposer(s, t); image(s, t, demo);
  }
}
function copie(o) { return JSON.parse(JSON.stringify(o)); }

test('un dépassement proche donne un regard signé, cervicalement borné, puis un retour doux', () => {
  for (const cote of [-1, 1]) {
    const s = seance(); let maximum = 0, precedent = 0, deltaMax = 0;
    for (let k = 0; k <= 210; k++) {
      const t = k / 60; duel(s, t, cote); image(s, t);
      const o = X.lire(s.E, 0); maximum = Math.max(maximum, Math.abs(o.regard));
      deltaMax = Math.max(deltaMax, Math.abs(o.regard - precedent)); precedent = o.regard;
      assert(o.regard * cote >= 0, 'regard du côté du concurrent dépassé');
      assert(Math.abs(o.regard) <= .32); assert.equal(o.geste, null, 'pas de provocation automatique hors démo');
      assert.equal(X.lire(s.E, 1).regard, 0, 'pas de regard copié dans le pilote dépassé');
      if (t < 1.19) assert.equal(o.regard, 0, 'se côtoyer ne suffit pas');
    }
    assert(maximum > .28); assert(deltaMax < .05, 'pas de claquement de tête');
    assert.equal(X.lire(s.E, 0).regard, 0); assert.equal(s.E.pilotes[0].depassements, 1);
  }
});

test('classement, autre niveau, grille, marche arrière et replacement ne sont pas des dépassements', () => {
  for (const cas of ['loin', 'niveau', 'grille', 'recul', 'replacement', 'replacement-court', 'nouvelle-voiture', 'nouvelle-course']) {
    const s = seance();
    for (let k = 0; k <= 120; k++) {
      const t = k / 60; duel(s, t);
      if (cas === 'loin') s.poses[1].z = 180;
      if (cas === 'niveau') s.poses[1].y = 15;
      if (cas === 'grille') s.co.phase = t < 1.4 ? 'grille' : 'course';
      if (cas === 'recul') s.co.voitures[0].etat.rapport = -1;
      if (cas === 'replacement' && t >= .9) { s.co.voitures[0].progression += 300; s.poses[0].x += 300; }
      if (cas === 'replacement-court' && t >= .9) {
        s.co.voitures[0].progression += 2.6; s.poses[0].x += 2.6; s.co.voitures[0].etat.repositionnements = 1;
      }
      if (cas === 'nouvelle-voiture' && k === 70) s.co.voitures[0] = etat(0, s.co.voitures[0].progression);
      if (cas === 'nouvelle-course' && k === 70) s.co = { ...s.co, voitures: s.co.voitures };
      image(s, t, true);
      assert.equal(X.lire(s.E, 0).regard, 0, cas); assert.equal(X.lire(s.E, 0).geste, null, cas);
    }
    assert.equal(s.E.pilotes[0].depassements, 0, cas);
  }
});

test('un vrai dépassement de démo produit effectivement un geste, sans solliciter le hasard de course', () => {
  const s = seance(2, 1); let vu = false, regard = false, cote = 0;
  for (let k = 0; k <= 240; k++) {
    const t = k / 60; duel(s, t); image(s, t, true);
    const o = X.lire(s.E, 0); regard ||= o.regard > .1;
    if (o.geste && o.gesteIntensite > .2) { vu = true; cote = o.gesteCote; assert(X.GESTES.includes(o.geste)); }
  }
  assert(regard); assert(vu, 'la démo doit réellement lever une main après ce dépassement proche');
  assert.equal(cote, 1); assert.equal(s.E.pilotes[0].gestesDemo, 1);
  assert.equal(X.lire(s.E, 0).geste, null); assert.equal(X.lire(s.E, 0).gesteIntensite, 0);
});

test('deux vrais dépassements rapprochés gardent les gestes de démo occasionnels', () => {
  const s = seance(2, 1);
  for (let k = 0; k <= 600; k++) {
    const t = k / 60;
    const ecart = t <= 2.5 ? -4 + 4 * t : t <= 4.5 ? 6 - 8 * (t - 2.5) : -10 + 4 * (t - 4.5);
    s.co.voitures[1].progression = s.poses[1].x = 100 + 30 * t;
    s.co.voitures[0].progression = s.poses[0].x = 100 + 30 * t + ecart;
    s.co.voitures[0].etat.v = t > 2.5 && t <= 4.5 ? 22 : 34;
    image(s, t, true);
  }
  assert.equal(s.E.pilotes[0].depassements, 2, 'le deuxième vrai passage est reconnu');
  assert.equal(s.E.pilotes[0].gestesDemo, 1, 'le délai de dix-huit secondes protège le montage');
  assert.equal(X.lire(s.E, 0).geste, null);
});

test('Troll maintenu ne recommence pas ; relâcher puis appuyer donne un autre geste et revient au volant', () => {
  const s = seance(), noms = new Set(); image(s, 0);
  assert(X.demander(s.E, 0, true));
  let dernierNom = null, derniereIntensite = 0, deltaMax = 0;
  for (let k = 1; k <= 600; k++) {
    const t = k / 60; droit(s, t); assert.equal(X.demander(s.E, 0, true), false); image(s, t);
    const o = X.lire(s.E, 0); if (o.geste) { noms.add(o.geste); dernierNom = o.geste; }
    deltaMax = Math.max(deltaMax, Math.abs(o.gesteIntensite - derniereIntensite)); derniereIntensite = o.gesteIntensite;
    assert(o.gestePhase >= 0 && o.gestePhase <= 1); assert(o.gesteIntensite >= 0 && o.gesteIntensite <= 1);
  }
  assert.equal(s.E.pilotes[0].gestesManuels, 1); assert.equal(X.lire(s.E, 0).geste, null);
  assert.equal(X.lire(s.E, 0).gesteIntensite, 0); assert(deltaMax < .12);
  for (let essai = 0; essai < 8; essai++) {
    const debut = 10 + essai * 3;
    X.demander(s.E, 0, false); assert(X.demander(s.E, 0, true));
    avancer(s, debut + 1 / 60, debut + 1);
    const nom = X.lire(s.E, 0).geste; assert(nom); assert.notEqual(nom, dernierNom); noms.add(nom); dernierNom = nom;
    avancer(s, debut + 1 + 1 / 60, debut + 3);
    assert.equal(X.lire(s.E, 0).geste, null);
  }
  assert.deepEqual([...noms].sort(), ['majeur', 'poing', 'salut']);
});

test('le levier passe en premier : demande différée, geste interrompu et aucun geste en épave', () => {
  const s = seance(); image(s, 0); s.co.voitures[0].tPassage = .02;
  X.demander(s.E, 0, true);
  avancer(s, 1 / 60, .35);
  assert.equal(X.lire(s.E, 0).geste, null);
  avancer(s, .35 + 1 / 60, .7);
  assert(X.lire(s.E, 0).geste); assert(X.lire(s.E, 0).gesteIntensite > .8);
  s.co.voitures[0].etat.rapport = 4; s.co.voitures[0].tPassage = .72;
  avancer(s, .7 + 1 / 60, .9);
  assert.equal(X.lire(s.E, 0).geste, null); assert.equal(X.lire(s.E, 0).gesteIntensite, 0);
  for (const panne of ['accident', 'recuperation', 'casse']) {
    const f = seance(); image(f, 0);
    if (panne === 'casse') f.co.voitures[0].etat.degats.casse = true; else f.co.voitures[0].etat[panne] = {};
    X.demander(f.E, 0, true); avancer(f, 1 / 60, 1);
    assert.equal(X.lire(f.E, 0).geste, null, panne);
    f.co.voitures[0].etat.accident = f.co.voitures[0].etat.recuperation = null; f.co.voitures[0].etat.degats.casse = false;
    avancer(f, 1 + 1 / 60, 2); assert.equal(X.lire(f.E, 0).geste, null, 'aucune demande retenue sous l’épave');
  }
});

test('J1 et J2 ont des boutons et des tirages indépendants', () => {
  const a = seance(2, 73), b = seance(2, 73); image(a, 0); image(b, 0);
  X.demander(a.E, 0, true);
  for (let k = 1; k <= 45; k++) {
    const t = k / 60; droit(a, t); droit(b, t); image(a, t); image(b, t);
    assert.equal(X.lire(a.E, 1).geste, null);
  }
  X.demander(a.E, 1, true); X.demander(b.E, 1, true);
  for (let k = 46; k <= 120; k++) {
    const t = k / 60; droit(a, t); droit(b, t); image(a, t); image(b, t);
    assert.deepEqual(copie(X.lire(a.E, 1)), copie(X.lire(b.E, 1)));
  }
  assert.equal(a.E.pilotes[1].gestesManuels, 1); assert.equal(a.E.pilotes[0].gestesManuels, 1);
  assert.notEqual(X.lire(a.E, 0), X.lire(a.E, 1));
});

test('sorties préallouées, lecture pure, course gelée et double rendu sans nouvelle animation', () => {
  const s = seance(), out = { volant: .3, passage: .5, rapport: 4 }, reference = X.lire(s.E, 0);
  const tableaux = [s.E.x, s.E.y, s.E.z, s.E.progression, s.E.armes, s.E.voitures];
  for (const v of s.co.voitures) { Object.freeze(v.etat.degats); Object.freeze(v.etat); Object.freeze(v); }
  s.co.voitures.forEach(Object.freeze); Object.freeze(s.co.voitures); Object.freeze(s.co);
  s.poses.forEach(Object.freeze); Object.freeze(s.poses);
  image(s, 0); X.demander(s.E, 0, true); image(s, .1);
  const avant = copie(s.E.pilotes), historique = Array.from(s.E.armes);
  for (let i = 0; i < 100; i++) {
    image(s, .1); assert.equal(X.lire(s.E, 0), reference); assert.equal(X.lire(s.E, 0, out), out);
  }
  assert.deepEqual(copie(s.E.pilotes), avant); assert.deepEqual(Array.from(s.E.armes), historique);
  assert.equal(out.volant, .3); assert.equal(out.passage, .5); assert.equal(out.rapport, 4);
  [s.E.x, s.E.y, s.E.z, s.E.progression, s.E.armes, s.E.voitures].forEach((v, i) => assert.equal(v, tableaux[i]));
});

test('même graine et mêmes vrais passages donnent les mêmes expressions, malgré les lectures J2 supplémentaires', () => {
  const a = seance(2, 31), b = seance(2, 31);
  for (let k = 0; k <= 180; k++) {
    const t = k / 60; duel(a, t, -1); duel(b, t, -1); image(a, t, true); image(b, t, true);
    X.lire(b.E, 1); X.lire(b.E, 0, {}); image(b, t, true);
    assert.deepEqual(copie(X.lire(a.E, 0)), copie(X.lire(b.E, 0)));
  }
});

test('un grand saut de temps ne transforme pas une nouvelle position en dépassement', () => {
  const s = seance(); avancer(s, 0, .8, duel, true);
  duel(s, 1.5); image(s, 1.5, true);
  assert.equal(s.E.pilotes[0].depassements, 0); assert.equal(X.lire(s.E, 0).regard, 0); assert.equal(X.lire(s.E, 0).geste, null);
  s.poses[0].x = NaN; image(s, 1.6); assert.equal(X.lire(s.E, 0).regard, 0);
  assert.equal(X.lire(s.E, 0).geste, null);
});

test('un retour de l’horloge efface les délais du futur et demande un nouvel appui', () => {
  const s = seance(); droit(s, 10); image(s, 10); X.demander(s.E, 0, true);
  avancer(s, 10 + 1 / 60, 10.5); assert(X.lire(s.E, 0).geste);
  droit(s, 0); image(s, 0); assert.equal(X.lire(s.E, 0).geste, null);
  avancer(s, 1 / 60, .2); assert.equal(X.lire(s.E, 0).geste, null, 'l’appui encore tenu ne repart pas');
  X.demander(s.E, 0, false); X.demander(s.E, 0, true);
  avancer(s, .2 + 1 / 60, .6); assert(X.lire(s.E, 0).geste, 'pas de délai bloqué jusqu’à l’ancienne horloge');
});
