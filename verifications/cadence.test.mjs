import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import inspector from 'node:inspector/promises';
const require = createRequire(import.meta.url);
// Même ordre que la liste MODULES de construire.py ; la cadence applique elle-même les règles de FLoop (voir
// src/cadence.js) et doit aussi marcher seule.
require('../src/ferro/loop.js');
require('../src/cadence.js');
require('../src/qualite.js');
const K = globalThis.BITUME.cadence, Q = globalThis.BITUME.qualite;
const H = 1000 / 120;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

// Écran et machine synthétiques, déterministes. L'écran synchronise toutes les 1000/hz ms. Un rappel a lieu à une
// synchronisation si le fil principal est libre (cpu ms après le début de l'image rendue) et si le processeur
// graphique n'a pas plus d'une image d'avance (gpu ms par image, à la suite) : la contre-pression d'un navigateur.
// L'horodatage reçu porte une gigue uniforme de ±gigue ms ou l'arrondi à la milliseconde. Le temps de jeu rendu
// d'une image vaut (pas cumulés + alpha) × 1/120 s : c'est l'instant que montre l'image interpolée.
function hasard(graine) {
  let a = graine | 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function jouer(C, o) {
  const r = hasard(o.graine || 1), debut = o.debut ?? 1000, fin = debut + o.duree * 1000;
  const ctx = o.contexte || { echelle: 1, qualiteReductible: false, actif: true };
  let vs = debut, cpuLibre = -1e9, fin1 = -1e9, fin2 = -1e9, gpuLibre = -1e9, jeu = o.jeu || 0, rappels = 0;
  const images = [];
  while (vs < fin) {
    vs += 1000 / (typeof o.hz === 'function' ? o.hz(vs - debut) : o.hz);
    const s = vs - debut;
    if (o.masque && s >= o.masque[0] && s < o.masque[1]) continue;   // onglet masqué : aucun rappel
    if (vs < cpuLibre || fin1 > vs) continue;
    let t = vs + (o.gigue ? (r() * 2 - 1) * o.gigue : 0);
    if (o.arrondi) t = Math.round(t);
    if (o.avant) o.avant(s, ctx);
    const f = K.image(C, t, ctx); rappels++;
    if (o.objets) o.objets.add(f);
    if (f.rendre) {
      const cpu = typeof o.cpu === 'function' ? o.cpu(s) : o.cpu || 0, gpu = typeof o.gpu === 'function' ? o.gpu(s) : o.gpu || 0;
      cpuLibre = vs + cpu;
      gpuLibre = Math.max(vs + cpu, gpuLibre) + gpu; fin1 = fin2; fin2 = gpuLibre;
      K.travail(C, cpu);
      jeu += f.pas;
      images.push({ s, vs, t, pas: f.pas, alpha: f.alpha, dt: f.dt, k: f.diviseur, rate: f.rate, verrou: f.verrouille,
        intervalle: f.intervalle, periode: f.periode, travail: f.travail, jeu: (jeu + f.alpha) * H });
      if (o.apres) o.apres(f, s, ctx);
    }
    // Rappel en trop entre deux synchronisations (navigateur qui relance requestAnimationFrame) : rien à rendre. Il
    // vient après la lecture de f, objet que la cadence réutilise d'un rappel à l'autre.
    if (o.intrus && o.intrus(s)) { const g = K.image(C, t + o.intrusMs, ctx); if (g.rendre && s > 1000) images.intrus = (images.intrus || 0) + 1; }
  }
  return { images, rappels, vs, jeu };
}
// Plus grand écart entre l'avance du temps de jeu rendu et echelle × l'intervalle réel entre deux images.
function ecartMax(images, echelle = 1) {
  let e = 0;
  for (let i = 1; i < images.length; i++) e = Math.max(e, Math.abs(images[i].jeu - images[i - 1].jeu - echelle * (images[i].vs - images[i - 1].vs)));
  return e;
}
const depuis = (images, ms) => images.filter(i => i.s >= ms);
const distincts = (images, cle) => new Set(images.map(i => i[cle])).size;
const contexte = (o = {}) => Object.assign({ echelle: 1, qualiteReductible: false, actif: true }, o);

// ---------------------------------------------------------------- horloge et temps de jeu
verifier('30, 60 et 120 Hz avec ±2 ms de gigue : verrou, pas et alpha constants, temps de jeu exact', () => {
  for (const hz of [30, 60, 120]) for (let graine = 1; graine <= 6; graine++) {
    const C = K.creer({});
    const images = depuis(jouer(C, { hz, duree: 12, gigue: 2, graine }).images, 2000);
    const nom = `${hz} Hz, graine ${graine}`;
    assert.ok(images.length > hz * 9, nom);
    assert.ok(images.every(i => i.pas === 120 / hz && i.verrou && i.k === 1 && !i.rate), nom + ' : pas constants, verrouillé, rien de raté');
    assert.equal(distincts(images, 'alpha'), 1, nom + ' : alpha constant');
    assert.ok(images[0].alpha > .99, nom + ' : phase calée au verrou, l’image montre l’état le plus récent');
    assert.ok(ecartMax(images) < 1e-6, nom + ' : une période de jeu par période d’écran');
    assert.ok(images.every(i => Math.abs(i.dt * 1000 - 1000 / hz) < 1e-9), nom + ' : dt calé sur la période');
    const e = K.etat(C);
    assert.ok(Math.abs(e.periodeMs - 1000 / hz) < .05, nom + ' : période ' + e.periodeMs);
    assert.equal(e.pasParPeriode, 120 / hz);
  }
});
verifier('144, 165, 75 et 100 Hz : temps de jeu avançant d’une période par image à mieux que 0,5 ms', () => {
  for (const [hz, gigue] of [[144, 2], [144, 1], [165, 1], [75, 1], [100, 1], [90, 2]]) for (let graine = 1; graine <= 6; graine++) {
    const C = K.creer({});
    const tout = jouer(C, { hz, duree: 12, gigue, graine }).images, images = depuis(tout, 2000);
    const nom = `${hz} Hz ±${gigue} ms, graine ${graine}`;
    assert.ok(images.every(i => !i.verrou && i.k === 1 && !i.rate), nom + ' : ni verrou ni image ratée');
    assert.ok(ecartMax(images) < .5, nom + ' : écart ' + ecartMax(images));
    // aucune dérive : sur dix secondes, le temps de jeu rendu suit l'horloge de l'écran
    const a = images[0], b = images[images.length - 1];
    assert.ok(Math.abs(b.jeu - a.jeu - (b.vs - a.vs)) < 1, nom + ' : dérive');
    assert.ok(Math.abs(K.etat(C).periodeMs - 1000 / hz) < .05, nom);
    // images par seconde affichées : celles de l'écran, sans la gigue des horodatages
    assert.ok(Math.abs(K.etat(C).ips - hz) < 1, nom + ' : ' + K.etat(C).ips + ' images par seconde');
  }
});
verifier('horloge d’écran qui dérive de ±1 % : la dette garde le temps de jeu à moins de 1 ms de l’écran', () => {
  for (let graine = 1; graine <= 4; graine++) {
    const C = K.creer({});
    const images = depuis(jouer(C, { hz: s => 144 * (1 + .01 * Math.sin(2 * Math.PI * (s - 1000) / 4000)), duree: 30,
      gigue: .5, graine }).images, 2000);
    let derive = 0;
    for (const i of images) derive = Math.max(derive, Math.abs(i.jeu - images[0].jeu - (i.vs - images[0].vs)));
    assert.ok(derive < 1, 'graine ' + graine + ' : dérive ' + derive);
    assert.ok(ecartMax(images) < .5);
  }
});
verifier('horodatages arrondis à la milliseconde (Firefox, Safari), de 30 à 240 Hz', () => {
  for (const hz of [30, 60, 120, 144, 165, 240, 75, 100, 59.94]) {
    const C = K.creer({});
    const images = depuis(jouer(C, { hz, duree: 12, arrondi: true }).images, 2000);
    const verrouillable = [30, 60, 120, 59.94].includes(hz), nom = hz + ' Hz arrondi';
    assert.ok(images.every(i => i.k === 1 && !i.rate && i.verrou === verrouillable), nom);
    if (verrouillable) {
      assert.equal(distincts(images, 'pas'), 1, nom); assert.equal(distincts(images, 'alpha'), 1, nom);
    }
    // 59,94 Hz verrouillé sur deux pas prend 0,1 % de retard, comme FLoop : 0,017 ms par image
    assert.ok(ecartMax(images) < (hz === 59.94 ? .02 : .5), nom + ' : écart ' + ecartMax(images));
    assert.ok(Math.abs(K.etat(C).periodeMs - 1000 / hz) < .02, nom);
  }
});
verifier('accroc isolé de 195 ms : un rattrapage borné à maxPas, puis la cadence d’avant, k inchangé', () => {
  const C = K.creer({});
  let fait = false;
  const { images } = jouer(C, { hz: 60, duree: 10, gigue: .5, cpu: s => !fait && s >= 5000 && (fait = true) ? 195 : 1 });
  const apres = depuis(images, 2000), longues = apres.filter(i => i.pas !== 2);
  assert.equal(longues.length, 1, 'une seule image porte le rattrapage');
  assert.equal(longues[0].pas, 14, '200 ms valent 24 pas ; 14 au plus');
  assert.ok(longues[0].rate, 'image ratée comptée');
  const e = K.etat(C);
  assert.equal(e.pasAbandonnes, 10, 'l’excédent est abandonné, pas rattrapé ensuite');
  assert.ok(images.every(i => i.k === 1), 'k ne change jamais pour un accroc isolé');
  assert.equal(e.hausses, 0);
  assert.equal(distincts(apres, 'alpha'), 1, 'la phase est gardée');
  assert.ok(Math.abs(longues[0].dt - 14 * H / 1000) < 1e-12, 'dt borné à maxPas pas');
});
verifier('onglet masqué 5 s puis revenu : un seul pas, rien de raté ni de rattrapé, avec ou sans oublier', () => {
  for (const avecOublier of [false, true]) {
    const C = K.creer({});
    let fait = false;
    const { images } = jouer(C, { hz: 60, duree: 14, gigue: .5, masque: [4000, 9000],
      avant: s => { if (avecOublier && !fait && s >= 9000) { fait = true; K.oublier(C); } } });
    const i = images.findIndex(x => x.s >= 9000), avant = images[i - 1], retour = images[i];
    assert.equal(retour.pas, 1, 'un pas au retour'); assert.equal(retour.rate, false);
    assert.ok(retour.jeu - avant.jeu <= 2 * H + 1e-9, 'le temps masqué n’est pas rattrapé');
    assert.equal(K.etat(C).ratees, 0); assert.ok(images.every(x => x.k === 1));
    assert.ok(depuis(images, 9500).every(x => x.pas === 2 && x.verrou), 'verrou retrouvé aussitôt');
  }
});
verifier('onglet masqué à k = 2 : les pas en attente d’un rappel sauté ne sont pas rattrapés au retour', () => {
  for (const debut of [4000, 4017, 4034, 4050]) {
    const C = K.creer({});
    const { images } = jouer(C, { hz: 60, duree: 12, arrondi: true, cpu: 8, gpu: 1.4 * 1000 / 60, masque: [debut, debut + 3000] });
    const retour = images.find(x => x.s >= debut + 3000);
    assert.equal(K.etat(C).diviseur, 2, 'k = 2 avant et après');
    assert.equal(retour.pas, 1, 'masqué à ' + debut + ' : un pas au retour');
  }
});
verifier('pause de 170 ms : oublier évite l’image ratée et le rattrapage', () => {
  const sans = K.creer({}), avec = K.creer({});
  const a = jouer(sans, { hz: 60, duree: 6, masque: [4000, 4160] }).images.find(x => x.s >= 4160);
  let fait = false;
  const b = jouer(avec, { hz: 60, duree: 6, masque: [4000, 4160], avant: s => { if (!fait && s >= 4160) { fait = true; K.oublier(avec); } } })
    .images.find(x => x.s >= 4160);
  assert.equal(a.rate, true); assert.equal(a.pas, 14, 'sans oublier : dix périodes, rattrapage borné');
  assert.equal(b.rate, false); assert.equal(b.pas, 1, 'avec oublier : ni image ratée ni temps à rattraper');
  assert.equal(K.etat(avec).ratees, 0);
});

// ---------------------------------------------------------------- diviseur
const GPU_LENT = 1.4 * 1000 / 60;   // une image demande 1,4 période d'un écran 60 Hz
verifier('machine trop lente (1,4 période par image), qualité non réductible : k = 2, cadence régulière', () => {
  for (const [hz, pas] of [[60, 4], [120, 2]]) {
    const C = K.creer({});
    const { images } = jouer(C, { hz, duree: 12, gigue: .5, gpu: 1.4 * 1000 / hz, cpu: 2 });
    const k1 = images.filter(i => i.k === 1 && i.s > 500 && i.intervalle > 0);
    const moyenne = k1.reduce((s, i) => s + i.intervalle * 1000, 0) / k1.length / (1000 / hz);
    assert.ok(moyenne > 1.3 && moyenne < 1.5, hz + ' Hz : la machine simulée rend une image toutes les 1,4 période (' + moyenne + ')');
    const passage = images.find(i => i.k === 2);
    assert.ok(passage && passage.s < 3000, hz + ' Hz : k = 2 en moins de 3 s');
    const ensuite = images.filter(i => i.s > passage.s + 200);
    assert.ok(ensuite.every(i => i.k === 2 && !i.rate && i.pas === pas && i.verrou), hz + ' Hz : plus rien de raté');
    assert.equal(distincts(ensuite, 'alpha'), 1);
    assert.ok(ecartMax(ensuite) < 1e-6);
    const e = K.etat(C);
    assert.equal(e.hausses, 1, 'un seul changement');
    assert.ok(Math.abs(e.periodeMs - 1000 / hz) < .05, 'la période reste celle de l’écran, pas 1,4 ou 2 périodes');
    assert.ok(Math.abs(e.ips - hz / 2) < 1, 'ips ' + e.ips);
  }
});
verifier('machine trop lente, qualité réductible : k attend, le gouverneur de qualité baisse puis ne réessaie qu’après 20 s', () => {
  const C = K.creer({}), palier = { n: 0, somme: 0, compte: 0, t: 0, aise: 0 }, changements = [];
  const ctx = contexte({ qualiteReductible: true });
  const { images } = jouer(C, { hz: 60, duree: 34, gigue: .5, cpu: 2, contexte: ctx,
    gpu: () => GPU_LENT * (1 - .35 * palier.n),
    apres: (f, s) => {
      const avant = palier.n;
      Q.avancer(palier, f.intervalle, { periode: f.periode * f.diviseur, travail: f.travail, min: 0, max: 4 });
      if (palier.n !== avant) changements.push([s, palier.n]);
      ctx.qualiteReductible = palier.n < 4;
    } });
  assert.ok(images.every(i => i.k === 1), 'le diviseur ne bouge pas tant que la qualité peut baisser');
  assert.equal(changements[0][1], 1, 'première décision : une baisse');
  assert.ok(changements[0][0] < 4500, 'baisse à la fin de la première fenêtre de 3 s');
  assert.equal(changements[1][1], 0, 'remontée'); assert.ok(changements[1][0] - changements[0][0] >= 20000, 'pas avant 20 s');
  assert.equal(changements[2][1], 1, 'le niveau échoue de nouveau');
  assert.equal(changements.length, 3, 'puis 40 s d’attente');
  const calme = images.filter(i => i.s > changements[0][0] + 100 && i.s < changements[1][0]);
  assert.ok(calme.every(i => !i.rate && i.pas === 2), 'au palier tenu, plus rien de raté');
});
verifier('rappels en trop entre deux synchronisations : ni rendus ni comptés, le verrou tient', () => {
  // [écran, gigue, rappel en trop ms après une synchronisation, une synchronisation sur combien]
  for (const [hz, gigue, ms, tous] of [[60, .5, 2, 10], [60, .5, 4, 10], [60, .5, 6, 10], [60, 1, 3, 5], [120, .5, 2, 10],
    [144, 1, 2, 10]]) for (let graine = 1; graine <= 3; graine++) {
    const C = K.creer({}), nom = `${hz} Hz ±${gigue} ms, ${ms} ms après une synchronisation sur ${tous}, graine ${graine}`;
    const { images } = jouer(C, { hz, duree: 10, gigue, graine, intrus: s => Math.round(s / (1000 / hz)) % tous === 0, intrusMs: ms });
    // avant la grille (première demi-seconde), chaque rappel est rendu, comme dans la boucle d'aujourd'hui
    assert.equal(images.intrus || 0, 0, nom + ' : aucun rappel en trop rendu une fois la grille posée');
    const apres = depuis(images, 2000);
    assert.ok(apres.every(i => i.k === 1 && !i.rate), nom + ' : rien de raté');
    if (hz !== 144) assert.ok(apres.every(i => i.pas === 120 / hz && i.verrou), nom + ' : verrou tenu');
    assert.ok(ecartMax(apres) < .5, nom + ' : écart ' + ecartMax(apres));
    // la grille est celle de l'écran, pas un peigne fin qui range aussi les rappels en trop
    assert.ok(Math.abs(K.etat(C).periodeMs - 1000 / hz) < .05, nom + ' : période ' + K.etat(C).periodeMs);
  }
});
verifier('essai de retour réussi : pas avant 20 s de régularité, une seconde, puis k − 1 tenu', () => {
  const C = K.creer({}), essais = [];
  let enCours = false;
  const { images } = jouer(C, { hz: 60, duree: 40, gigue: .5, cpu: 2, gpu: s => s < 6000 ? GPU_LENT : 5,
    apres: (f, s) => { const e = K.etat(C).essais.enCours; if (e !== enCours) { essais.push([s, e]); enCours = e; } } });
  const hausse = images.find(i => i.k === 2).s, derniereRatee = Math.max(...images.filter(i => i.rate).map(i => i.s));
  assert.equal(essais.length, 2, 'un essai, ouvert puis fermé');
  assert.ok(essais[0][0] - derniereRatee >= 20000 && essais[0][0] - derniereRatee < 20500, 'essai après 20 s de régularité');
  assert.ok(essais[1][0] - essais[0][0] >= 1000 && essais[1][0] - essais[0][0] < 1100, 'essai d’une seconde');
  const e = K.etat(C);
  assert.deepEqual([e.essais.faits, e.essais.reussis, e.essais.rates], [1, 1, 0]);
  assert.equal(e.diviseur, 1); assert.ok(hausse < 3000);
  // l'image qui ouvre l'essai couvre encore deux périodes ; les suivantes une seule
  assert.ok(images.filter(i => i.s > essais[0][0]).every(i => i.k === 1 && !i.rate && i.pas === 2), 'k − 1 tenu sans image ratée');
  // Rechute peu après un essai réussi : il comptait sur un passage favorable, il est compté raté.
  const C2 = K.creer({}), essais2 = [];
  let enCours2 = false, succes = Infinity;
  jouer(C2, { hz: 60, duree: 40, gigue: .5, cpu: 2, gpu: s => s < 6000 || s > succes + 3000 ? GPU_LENT : 5,
    apres: (f, s) => {
      const e = K.etat(C2).essais;
      if (e.enCours !== enCours2) { essais2.push(s); enCours2 = e.enCours; if (!e.enCours && e.reussis) succes = s; }
    } });
  const e2 = K.etat(C2);
  assert.equal(e2.diviseur, 2, 'la machine ralentit de nouveau : k = 2');
  assert.deepEqual([e2.essais.reussis, e2.essais.rates, e2.essais.delaiS], [1, 1, 40], 'rechute comptée comme un essai raté');
});
verifier('essai raté : délai doublé, trois essais au plus ; oublier ne rend pas les essais, nouvelleSeance oui', () => {
  const C = K.creer({}), essais = [];
  let enCours = false;
  const suivre = (f, s) => { const e = K.etat(C).essais.enCours; if (e !== enCours) { essais.push([s, e]); enCours = e; } };
  const a = jouer(C, { hz: 60, duree: 200, arrondi: true, cpu: 2, gpu: GPU_LENT, apres: suivre });
  const debuts = essais.filter(x => x[1]).map(x => x[0]), fins = essais.filter(x => !x[1]).map(x => x[0]);
  const hausse = a.images.find(i => i.k === 2).s;
  assert.equal(debuts.length, 3, 'trois essais');
  const ecarts = [debuts[0] - hausse, debuts[1] - fins[0], debuts[2] - fins[1]];
  for (const [i, attendu] of [[0, 20000], [1, 40000], [2, 80000]]) {
    assert.ok(ecarts[i] >= attendu && ecarts[i] < attendu + 600, `essai ${i + 1} après ${ecarts[i]} ms (${attendu} attendus)`);
  }
  for (let i = 0; i < 3; i++) assert.ok(fins[i] - debuts[i] < 400, 'un essai raté s’arrête aux deux premières images ratées');
  let e = K.etat(C);
  assert.deepEqual([e.essais.faits, e.essais.rates, e.essais.restants, e.diviseur], [3, 3, 0, 2]);
  const ratees = a.images.filter(i => i.rate && i.s > hausse + 500).length;
  assert.ok(ratees <= 3 * 2 + 3, 'chaque essai raté coûte deux ou trois images ratées, pas plus (' + ratees + ')');
  // un quatrième essai viendrait 160 s après le troisième : 200 s de plus le montreraient
  K.oublier(C);
  jouer(C, { hz: 60, duree: 200, arrondi: true, cpu: 2, gpu: GPU_LENT, debut: a.vs, apres: suivre });
  e = K.etat(C);
  assert.equal(e.essais.faits, 3, 'oublier ne remet pas le compte');
  K.nouvelleSeance(C);
  jouer(C, { hz: 60, duree: 25, arrondi: true, cpu: 2, gpu: GPU_LENT, debut: a.vs + 200000, apres: suivre });
  e = K.etat(C);
  assert.equal(e.essais.faits, 4, 'nouvelle séance : un essai de nouveau après 20 s');
  assert.equal(e.diviseur, 2);
});
verifier('fil principal trop chargé (plus de 40 % de la période visée) : aucun essai', () => {
  const C = K.creer({});
  jouer(C, { hz: 60, duree: 60, arrondi: true, cpu: 8, gpu: GPU_LENT });
  const e = K.etat(C);
  assert.equal(e.diviseur, 2); assert.equal(e.essais.faits, 0);
  assert.ok(e.travailMs > .4 * 1000 / 60);
});
verifier('écran 60 Hz bridé à 30 puis rendu : ni le diviseur ni la qualité ne bougent', () => {
  for (const variante of [{ gigue: .5 }, { arrondi: true }, { gigue: 2 }]) {
    const C = K.creer({}), palier = { n: 0, somme: 0, compte: 0, t: 0, aise: 0 }, niveaux = new Set();
    const hz = s => s >= 5000 && s < 17000 ? 30 : 60;
    const { images } = jouer(C, Object.assign({ hz, duree: 24, cpu: 2, gpu: 3, apres: f => {
      Q.avancer(palier, f.intervalle, { periode: f.periode * f.diviseur, travail: f.travail, min: 0, max: 4 });
      niveaux.add(palier.n);
    } }, variante));
    const nom = JSON.stringify(variante);
    assert.ok(images.every(i => i.k === 1), nom + ' : k reste 1');
    assert.deepEqual([...niveaux], [0], nom + ' : la qualité ne baisse pas');
    const bride = images.filter(i => i.s > 6000 && i.s < 17000), rendu = depuis(images, 18000);
    assert.ok(bride.every(i => i.pas === 4 && i.verrou && !i.rate), nom + ' : 30 Hz tenus, quatre pas par image');
    assert.ok(rendu.every(i => i.pas === 2 && i.verrou && !i.rate), nom + ' : 60 Hz retrouvés');
    const e = K.etat(C);
    assert.equal(e.hausses, 0, nom);
    assert.ok(e.ratees <= 8, nom + ' : la transition coûte au plus huit images (' + e.ratees + ')');
    assert.ok(Math.abs(e.periodeMs - 1000 / 60) < .05, nom);
  }
});
verifier('modes forcés : cible ramenée au diviseur de l’écran le plus proche, aucune décision automatique', () => {
  for (const [mode, hz, k] of [['60', 144, 2], ['30', 144, 5], ['30', 60, 2], ['120', 60, 1], ['60', 120, 2], ['ecran', 144, 1]]) {
    const C = K.creer({ mode });
    const images = depuis(jouer(C, { hz, duree: 6, gigue: .5 }).images, 1500);
    assert.ok(images.every(i => i.k === k && !i.rate), `${mode} sur ${hz} Hz : k = ${k}`);
    assert.ok(ecartMax(images) < .5);
    assert.ok(Math.abs(K.etat(C).ips - hz / k) < 1, `${mode} sur ${hz} Hz : ${K.etat(C).ips} images par seconde`);
  }
  for (const mode of ['ecran', '60']) {
    const C = K.creer({ mode });
    jouer(C, { hz: 60, duree: 30, gigue: .5, gpu: GPU_LENT });
    const e = K.etat(C);
    assert.deepEqual([e.diviseur, e.hausses, e.essais.faits], [1, 0, 0], mode + ' : machine lente, k imposé');
    assert.ok(e.ratees > 100);
  }
  const C = K.creer({ mode: '30' });
  jouer(C, { hz: 60, duree: 3, gigue: .5 });
  assert.equal(K.etat(C).diviseur, 2);
  assert.equal(K.regler(C, 'Auto'), 'auto'); assert.equal(K.etat(C).diviseur, 1);
  const r = jouer(C, { hz: 60, duree: 6, gigue: .5, gpu: GPU_LENT, debut: 5000 });
  assert.equal(r.images[r.images.length - 1].k, 2, 'Auto décide de nouveau');
});
verifier('normaliser, MODES et options de creer', () => {
  assert.deepEqual([...K.MODES], ['auto', 'ecran', '120', '60', '30']);
  assert.ok(Object.isFrozen(K.MODES));
  for (const [entree, sortie] of [['écran', 'ecran'], [' ECRAN ', 'ecran'], [60, '60'], ['120', '120'], [' Auto ', 'auto'],
    ['144', 'auto'], [undefined, 'auto'], [null, 'auto'], ['', 'auto'], [{}, 'auto']]) assert.equal(K.normaliser(entree), sortie);
  for (const options of [{ hz: 0 }, { hz: NaN }, { hz: 2000 }, { maxPas: 0 }, { maxPas: 1.5 }, { maxPas: 61 }]) {
    assert.throws(() => K.creer(options), TypeError);
  }
  const C = K.creer({ hz: 60, maxPas: 3 });
  const images = depuis(jouer(C, { hz: 30, duree: 5 }).images, 2000);
  assert.ok(images.every(i => i.pas === 2 && i.verrou), 'pas de 1/60 s : deux pas par image à 30 Hz');
  assert.equal(K.creer().mode, 'auto');
});
verifier('jamais sous 24 images par seconde environ', () => {
  // [écran, image en ms, k attendu] ; null : machine sous 24 images par seconde quel que soit k, seul le plancher compte
  for (const [hz, gpu, kMax] of [[60, 58, 2], [144, 38, 6], [30, 80, 1], [120, 60, 5], [144, 60, null]]) for (let graine = 1; graine <= 4; graine++) {
    const C = K.creer({}), nom = `${hz} Hz, image de ${gpu} ms, graine ${graine}`;
    const { images } = jouer(C, { hz, duree: 12, gigue: .5, gpu, graine });
    assert.ok(images.every(i => i.periode * i.k <= 1.02 / 24 + 1e-12), nom + ' : jamais plus de 1/24 s visé');
    const e = K.etat(C);
    assert.equal(e.diviseur, e.diviseurMax, nom + ' : la cadence ne descend pas plus bas');
    if (kMax === null) continue;
    assert.equal(e.diviseur, kMax, nom); assert.ok(Math.abs(e.periodeMs - 1000 / hz) < .05, nom + ' : période ' + e.periodeMs);
    // le diviseur monte d'un coup au plus petit qui tient, sans paliers saccadés de 1,5 s chacun
    assert.equal(e.hausses, kMax > 1 ? 1 : 0, nom + ' : ' + e.hausses + ' hausses');
    if (hz === 144) assert.ok(depuis(images, 9000).every(i => !i.rate && i.k === 6), nom + ' : 38 ms tiennent dans six périodes');
  }
});
verifier('machine régulière à deux, trois ou quatre périodes d’un écran rapide : pas un écran bridé, k juste', () => {
  // Une suite de rappels sur un même multiple ressemble à un écran bridé ; les rappels plus tôt la démentent, la
  // cadence revient à la période de l'écran et ne recommence pas sur la même suite.
  for (const [hz, gpu, k] of [[144, 20, 3], [120, 16, 2], [144, 27, 4], [60, 32, 2], [165, 12, 2]]) for (let graine = 1; graine <= 3; graine++) {
    const C = K.creer({}), nom = `${hz} Hz, image de ${gpu} ms, graine ${graine}`;
    const { images } = jouer(C, { hz, duree: 14, gigue: .5, gpu, cpu: 1, graine });
    const fin = depuis(images, 10000), e = K.etat(C);
    assert.ok(Math.abs(e.periodeMs - 1000 / hz) < .05, nom + ' : période ' + e.periodeMs);
    assert.equal(e.bride, false, nom);
    assert.ok(fin.every(i => i.k === k && !i.rate), nom + ' : k = ' + k + ' sans image ratée');
    for (let i = 1; i < fin.length; i++) assert.ok(Math.abs(fin[i].vs - fin[i - 1].vs - k * 1000 / hz) < 1e-6, nom + ' : une image toutes les ' + k + ' périodes');
    assert.ok(e.reestimations <= 4, nom + ' : ' + e.reestimations + ' réestimations');
  }
});
verifier('machine lente dès le départ : la grille est celle de l’écran, pas celle des intervalles moyens', () => {
  // Une image toutes les quatre ou cinq périodes : une grille de 18 ms (240 Hz) ou de 30 ms (144 Hz) range ces
  // rappels presque aussi bien en périodes, mais pas en millisecondes.
  for (const [hz, gigue] of [[240, .5], [240, 0], [144, 1], [165, 1]]) for (let graine = 1; graine <= 3; graine++) {
    const C = K.creer({}), nom = `${hz} Hz ${gigue ? '±' + gigue + ' ms' : 'arrondi'}, graine ${graine}`;
    const { images } = jouer(C, { hz, duree: 12, gigue, arrondi: !gigue, gpu: 4.3 * 1000 / hz, cpu: 1, graine });
    const e = K.etat(C);
    assert.ok(Math.abs(e.periodeMs - 1000 / hz) < .05, nom + ' : période ' + e.periodeMs);
    assert.ok(depuis(images, 9000).every(i => i.k === 5 && !i.rate), nom + ' : 4,3 périodes par image, k = 5');
  }
  // Une image toutes les trois ou six périodes d'un écran 60 Hz, horodatages arrondis : 50 ou 100 ms d'intervalle
  // tombent aussi sur des grilles de 25 ms ou de 4 ms ; aucune n'est un écran.
  for (const [charge, arrondi] of [[3, false], [6, true], [3, true]]) {
    const C = K.creer({}), nom = `60 Hz, ${charge} périodes par image${arrondi ? ', arrondi' : ''}`;
    const { images } = jouer(C, { hz: 60, duree: 10, gigue: arrondi ? 0 : .5, arrondi, gpu: charge * 1000 / 60, cpu: 1 });
    const e = K.etat(C);
    assert.ok(Math.abs(e.periodeMs - 1000 / 60) < .05, nom + ' : période ' + e.periodeMs);
    assert.equal(e.diviseur, 2, nom + ' : 30 images par seconde visées, pas moins');
    assert.ok(depuis(images, 4000).every(i => i.rate), nom + ' : la machine ne les tient pas, chaque image le dit');
  }
});
verifier('amorce sur douze intervalles d’un écran 30 Hz avec ±2 ms : la grille de l’écran, pour 3 000 graines', () => {
  // Sur si peu d'intervalles, un peigne de 4 ms range parfois la gigue par hasard ; il ne doit pas servir de
  // référence et écarter la grille de 33 ms.
  for (let graine = 1; graine <= 3000; graine++) {
    const C = K.creer({});
    jouer(C, { hz: 30, duree: .6, gigue: 2, graine });
    const e = K.etat(C);
    assert.ok(e.grille && Math.abs(e.periodeMs - 1000 / 30) < .5, 'graine ' + graine + ' : période ' + e.periodeMs);
  }
});
verifier('mode Écran, machine à un peu plus de deux périodes : la grille reste celle de l’écran', () => {
  // Rendre presque toujours une image toutes les deux périodes ressemble à un écran bridé. Le mode Écran ne
  // change pas k : chaque hypothèse démentie aussitôt double la suite exigée pour la suivante, sans quoi la grille
  // oscillerait entre les deux périodes toute la partie.
  for (const [hz, f] of [[120, 2.1], [120, 2.05], [144, 2.1], [60, 2.1]]) {
    const C = K.creer({ mode: 'ecran' }), nom = `${hz} Hz, ${f} périodes par image`;
    jouer(C, { hz, duree: 30, gigue: .5, cpu: 1, gpu: f * 1000 / hz });
    const e = K.etat(C);
    assert.ok(Math.abs(e.periodeMs - 1000 / hz) < .05, nom + ' : période ' + e.periodeMs);
    assert.equal(e.bride, false, nom);
    assert.ok(e.reestimations <= 6, nom + ' : ' + e.reestimations + ' réestimations');
  }
});
verifier('écran bridé pendant que k > 1 : la cadence tenue ne change ni pendant ni après le bridage', () => {
  // Une machine à 30 images par seconde sur un écran 120 Hz bridé à 60 (économie d'énergie), ou sur un écran 60 Hz
  // bridé à 30 : k = 4 devient 2 sur la grille bridée, puis le diviseur d'avant revient aussitôt, sans repartir
  // de la cadence de l'écran et rater toutes ses images pendant 1,5 s.
  for (const [hz, bas, gpu, k] of [[120, 60, 26, 4], [60, 30, 23.3, 2]]) for (let graine = 1; graine <= 3; graine++) {
    const C = K.creer({}), nom = `${hz} Hz bridé à ${bas}, graine ${graine}`;
    let hausses = -1;
    const { images } = jouer(C, { hz: s => s >= 5000 && s < 17000 ? bas : hz, duree: 24, gigue: .5, cpu: 1, gpu, graine,
      apres: (f, s) => { if (s < 5000) hausses = K.etat(C).hausses; } });
    const cible = k * 1000 / hz, ratees = depuis(images, 4000).filter(i => i.rate).length;
    assert.ok(images.filter(i => i.s >= 4000 && i.s < 5000).every(i => i.k === k && !i.rate), nom + ' : k = ' + k + ' avant');
    const pendant = images.filter(i => i.s > 6000 && i.s < 17000);
    assert.ok(pendant.every(i => Math.abs(i.periode * 1000 * i.k - cible) < .1 && !i.rate), nom + ' : même cadence, bridé');
    assert.ok(depuis(images, 17500).every(i => i.k === k && !i.rate), nom + ' : k = ' + k + ' aussitôt après');
    const e = K.etat(C);
    assert.equal(e.hausses, hausses, nom + ' : aucune hausse');
    assert.ok(ratees <= 2, nom + ' : ' + ratees + ' images ratées aux deux transitions');
    assert.equal(e.bride, false, nom);
  }
  // Machine ralentie pendant le bridage (60 puis 30 images par seconde sur la grille bridée) : la cadence tenue a
  // changé, c'est elle qui est convertie à la fin du bridage, pas le diviseur d'avant qui reviendrait.
  for (let graine = 1; graine <= 3; graine++) {
    const C = K.creer({}), nom = 'machine ralentie pendant le bridage, graine ' + graine;
    const { images } = jouer(C, { hz: s => s >= 5000 && s < 17000 ? 60 : 120, duree: 24, gigue: .5, cpu: 1, graine,
      gpu: s => s < 8000 ? 12 : 26 });
    assert.ok(depuis(images, 17500).every(i => i.k === 4 && !i.rate), nom + ' : 30 images par seconde aussitôt après');
    assert.ok(depuis(images, 17000).filter(i => i.rate).length <= 1, nom + ' : fin du bridage sans images ratées');
  }
  // Fin d'un vrai bridage : la suite exigée, doublée par des hypothèses démenties au départ, redevient courte.
  const C = K.creer({});
  let suite = 0;
  jouer(C, { hz: s => s >= 10000 && s < 20000 ? 60 : 120, duree: 26, gigue: .5, cpu: 1, gpu: s => s < 8000 ? 2.05 * H : 3,
    apres: (f, s) => { if (s < 10000) suite = K.etat(C).suiteBridage; } });
  assert.ok(suite >= 16, 'suite exigée doublée avant le bridage (' + suite + ')');
  assert.equal(K.etat(C).suiteBridage, 8, 'puis remise à huit');
  assert.equal(K.etat(C).bride, false);
});
verifier('contexte.actif faux (menus, pause) : la période se mesure, rien ne se décide', () => {
  const C = K.creer({}), ctx = contexte({ actif: false });
  const { images } = jouer(C, { hz: 60, duree: 12, gigue: .5, gpu: GPU_LENT, contexte: ctx, avant: s => { ctx.actif = s >= 8000; } });
  assert.ok(images.filter(i => i.s < 8000).every(i => i.k === 1), 'aucune décision en menu');
  const passage = images.find(i => i.k === 2);
  assert.ok(passage && passage.s >= 9450 && passage.s < 10500, 'décision 1,5 s après le retour en jeu (' + (passage && passage.s) + ')');
  const C2 = K.creer({});
  jouer(C2, { hz: 60, duree: 4, gigue: .5, gpu: GPU_LENT, contexte: contexte({ actif: false }) });
  const e = K.etat(C2);
  assert.equal(e.fenetre.images, 0); assert.ok(e.grille); assert.ok(Math.abs(e.periodeMs - 1000 / 60) < .05);
});
verifier('retour de menu : la fenêtre de décision repart, des images ratées d’avant le menu ne décident rien', () => {
  const C = K.creer({}), ctx = contexte({ qualiteReductible: true });
  const { images } = jouer(C, { hz: 60, duree: 12, gigue: .5, gpu: GPU_LENT, contexte: ctx, avant: s => {
    ctx.actif = !(s >= 4000 && s < 7000);       // menu de 4 à 7 s
    ctx.qualiteReductible = s < 4000;           // au retour, la qualité ne peut plus baisser
  } });
  assert.ok(images.filter(i => i.s < 4000).every(i => i.k === 1) && K.etat(C).ratees > 50, 'images ratées avant le menu, k tenu');
  const passage = images.find(i => i.k === 2);
  assert.ok(passage.s >= 8450, 'k ne monte que 1,5 s après le retour (' + passage.s + ')');
});
verifier('echelle : la démo ralentie avance le temps de jeu de echelle × période par image, sans à-coup', () => {
  for (const [hz, gigue, tolerance] of [[120, 2, 1e-6], [60, 2, 1e-6], [144, 1, .5 * .35]]) {
    const C = K.creer({});
    const images = depuis(jouer(C, { hz, duree: 8, gigue, contexte: contexte({ echelle: .35 }) }).images, 2000);
    assert.ok(ecartMax(images, .35) < tolerance, `${hz} Hz : écart ${ecartMax(images, .35)}`);
    assert.ok(images.every(i => i.pas <= 1));
    const pas = images.reduce((s, i) => s + i.pas, 0), attendu = .35 * images.reduce((s, i) => s + i.dt * 1000, 0) / H;
    assert.ok(Math.abs(pas - attendu) <= 1, 'le nombre de pas suit dt × echelle');
  }
  // ralenti puis vitesse normale : le temps de jeu suit l'échelle courante, aucun rattrapage
  const C = K.creer({}), ctx = contexte();
  const images = depuis(jouer(C, { hz: 60, duree: 8, gigue: 1, contexte: ctx, avant: s => { ctx.echelle = s >= 4000 && s < 6000 ? .35 : 1; } }).images, 2000);
  for (let i = 1; i < images.length; i++) {
    const e = images[i].s >= 4000 && images[i].s < 6000 ? .35 : 1;
    assert.ok(Math.abs(images[i].jeu - images[i - 1].jeu - e * 1000 / 60) < 1e-6, 'à ' + images[i].s);
  }
});

// ---------------------------------------------------------------- allocations
// Échantillonneur de tas de V8 : chaque allocation de la cadence pendant 100 000 rappels en régime permanent serait
// comptée (un seul nombre emballé par rappel ferait 1,6 Mo). Le témoin, qui alloue un objet par appel, prouve que
// la mesure voit les allocations.
async function octetsAlloues(f, n) {
  const session = new inspector.Session(); session.connect();
  await session.post('HeapProfiler.enable');
  // objets ramassés compris : une allocation passagère par rappel ne survit pas jusqu'à la fin de la mesure
  await session.post('HeapProfiler.startSampling', { samplingInterval: 64, includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true });
  f(n);
  const { profile } = await session.post('HeapProfiler.stopSampling');
  session.disconnect();
  // une allocation compte pour la cadence si l'une de ses fonctions est dans la pile (appels internes compris)
  const parts = { cadence: 0, temoin: 0 };
  const parcourir = (noeud, cadence, temoin) => {
    cadence = cadence || noeud.callFrame.url.endsWith('/src/cadence.js');
    temoin = temoin || noeud.callFrame.functionName === 'temoinAlloue';
    if (cadence) parts.cadence += noeud.selfSize;
    if (temoin) parts.temoin += noeud.selfSize;
    for (const enfant of noeud.children) parcourir(enfant, cadence, temoin);
  };
  parcourir(profile.head, false, false);
  return parts;
}
const gardes = [];
function temoinAlloue(n) { for (let i = 0; i < n; i++) gardes.push({ i }); gardes.length = 0; }
// À k = 2, un fil principal chargé (8 ms) interdit les essais de retour : le régime ne change pas pendant la mesure.
for (const [hz, gpu, cpu, nom] of [[60, 0, 1, '60 Hz verrouillé'], [144, 0, 1, '144 Hz recalé'], [60, GPU_LENT, 8, '60 Hz à k = 2']]) {
  const C = K.creer({}), ctx = contexte(), objets = new Set();
  // échauffement : grille, décisions, compilation optimisée
  const r = jouer(C, { hz, duree: 30, gigue: .5, gpu, cpu, objets });
  assert.equal(objets.size, 1, nom + ' : un seul objet rendu');
  const etat = new Float64Array(2); etat[0] = r.vs; etat[1] = 7;
  const P = 1000 / hz, k = K.etat(C).diviseur;
  const lot = n => {
    for (let i = 0; i < n; i++) {
      etat[0] += P; etat[1] = etat[1] * 16807 % 2147483647;
      const f = K.image(C, etat[0] + (etat[1] / 2147483647 - .5), ctx);
      if (f.rendre) K.travail(C, cpu);
    }
  };
  lot(100000);
  const mesure = await octetsAlloues(n => { lot(n); temoinAlloue(20000); }, 100000);
  assert.ok(mesure.temoin > 200000, nom + ' : le témoin est vu (' + mesure.temoin + ' octets)');
  assert.ok(mesure.cadence < 1024, nom + ' : ' + mesure.cadence + ' octets alloués par la cadence en 100 000 rappels');
  assert.equal(K.etat(C).diviseur, k, nom + ' : régime inchangé pendant la mesure');
  controles++; console.log('ok aucune allocation en régime permanent : ' + nom + ' (' + mesure.cadence + ' octets en 100 000 rappels)');
}
console.log(`cadence : ${controles} contrôles passés`);
