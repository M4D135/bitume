import '../src/vibrations.js';
import assert from 'node:assert/strict';

const VIB = globalThis.BITUME.vibrations;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

function simuler(V, entree, duree, dt) {
  const n = Math.round(duree / dt);
  for (let i = 0; i < n; i++) VIB.calculer(V, entree, dt);
  return V.sortie;
}

function trace(V, entree, duree, dt) {
  const n = Math.round(duree / dt);
  const t = [];
  for (let i = 0; i < n; i++) {
    VIB.calculer(V, entree, dt);
    t.push({ faible: V.sortie.faible, fort: V.sortie.fort, gachetteG: V.sortie.gachetteG, gachetteD: V.sortie.gachetteD });
  }
  return t;
}

function passages(valeurs, seuil) {
  let n = 0, haut = false;
  for (let i = 0; i < valeurs.length; i++) {
    const au = valeurs[i] >= seuil;
    if (au && !haut) n++;
    haut = au;
  }
  return n;
}

verifier('arrêt au ralenti : quatre sorties à 0 après une seconde', () => {
  const V = VIB.creer();
  const s = simuler(V, { regime: 1000, ralenti: 1000, maxUtile: 14000, v: 0, gaz: 0 }, 1, 1 / 60);
  assert.equal(s.faible, 0);
  assert.equal(s.fort, 0);
  assert.equal(s.gachetteG, 0);
  assert.equal(s.gachetteD, 0);
});

verifier('plein régime en charge : moteur lourd > 0, gâchettes à 0 hors rupteur', () => {
  const V = VIB.creer();
  const s = simuler(V, { regime: 12000, ralenti: 1000, maxUtile: 14000, gaz: 1, v: 60 }, 1, 1 / 60);
  assert.ok(s.fort > 0.1, 'fort=' + s.fort);
  assert.equal(s.gachetteG, 0);
  assert.equal(s.gachetteD, 0);
});

verifier('rupteur : gâchette droite et moteur léger varient dans le temps', () => {
  const V = VIB.creer();
  const t = trace(V, { regime: 13900, ralenti: 1000, maxUtile: 14000, gaz: 1, v: 60 }, 0.2, 1 / 120);
  const fa = new Set(t.map(x => Math.round(x.faible * 1000)));
  const gd = new Set(t.map(x => Math.round(x.gachetteD * 1000)));
  assert.ok(fa.size >= 2, 'faible varie, valeurs=' + fa.size);
  assert.ok(gd.size >= 2, 'gachetteD varie, valeurs=' + gd.size);
});

verifier('vibreur : la fréquence de battement double à peu près entre 10 m/s et 20 m/s, et ne dépasse jamais 14 Hz à 80 m/s', () => {
  const V1 = VIB.creer();
  const V2 = VIB.creer();
  const t1 = trace(V1, { v: 10, vibreur: true, regime: 4000, ralenti: 1000, maxUtile: 14000 }, 2, 1 / 240);
  const t2 = trace(V2, { v: 20, vibreur: true, regime: 4000, ralenti: 1000, maxUtile: 14000 }, 2, 1 / 240);
  // Le milieu de la nouvelle enveloppe de bordure se trouve entre les creux à .05 et les crêtes à .28.
  const p1 = passages(t1.map(x => x.fort), 0.17);
  const p2 = passages(t2.map(x => x.fort), 0.17);
  const ratio = p2 / p1;
  assert.ok(ratio > 1.6 && ratio < 2.4, 'ratio=' + ratio + ' p10=' + p1 + ' p20=' + p2);
  const V80 = VIB.creer();
  const t80 = trace(V80, { v: 80, vibreur: true, regime: 4000, ralenti: 1000, maxUtile: 14000 }, 2, 1 / 240);
  const p80 = passages(t80.map(x => x.fort), 0.17);
  const freq80 = p80 / 2;
  assert.ok(freq80 <= 14.2, 'freq80=' + freq80 + ' p80=' + p80);
});

verifier('herbe : plus fort à 20 m/s qu’à 5 m/s ; nul à l’arrêt', () => {
  const lent = simuler(VIB.creer(), { v: 5, surface: 'herbe' }, 1, 1 / 60);
  const vite = simuler(VIB.creer(), { v: 20, surface: 'herbe' }, 1, 1 / 60);
  const arret = simuler(VIB.creer(), { v: 0, surface: 'herbe' }, 1, 1 / 60);
  assert.ok(vite.fort > lent.fort, 'vite.fort=' + vite.fort + ' lent.fort=' + lent.fort);
  assert.ok(vite.faible > lent.faible, 'vite.faible=' + vite.faible + ' lent.faible=' + lent.faible);
  assert.equal(arret.fort, 0);
  assert.equal(arret.faible, 0);
});

verifier('blocage : gâchette gauche active, gâchette droite à 0', () => {
  const s = simuler(VIB.creer(), { blocage: 1, v: 30, frein: 1 }, 0.5, 1 / 120);
  assert.ok(s.gachetteG > 0.1, 'gachetteG=' + s.gachetteG);
  assert.equal(s.gachetteD, 0);
});

verifier('patinage : gâchette droite active, gâchette gauche à 0', () => {
  const s = simuler(VIB.creer(), { patinage: 1, v: 30, gaz: 1 }, 0.5, 1 / 120);
  assert.ok(s.gachetteD > 0.1, 'gachetteD=' + s.gachetteD);
  assert.equal(s.gachetteG, 0);
});

function verifierEvenement(nom, entree, duree, canaux) {
  verifier('événement ' + nom + ' : pic immédiat puis retour sous le seuil', () => {
    const V = VIB.creer();
    VIB.calculer(V, {}, 1 / 60); // état stable à zéro
    VIB.calculer(V, entree, 1 / 60);
    let pic = 0;
    for (let i = 0; i < canaux.length; i++) if (V.sortie[canaux[i]] > pic) pic = V.sortie[canaux[i]];
    assert.ok(pic >= VIB.SEUIL, nom + ' pic=' + pic);
    simuler(V, {}, duree * 6, 1 / 60);
    for (let i = 0; i < canaux.length; i++) {
      assert.ok(V.sortie[canaux[i]] < VIB.SEUIL, nom + ' ' + canaux[i] + '=' + V.sortie[canaux[i]]);
    }
  });
}

verifierEvenement('rapport', { evenements: [{ type: 'rapport', force: 1 }] }, 0.09, ['fort', 'gachetteD']);
verifierEvenement('choc', { evenements: [{ type: 'choc', force: 30 }] }, 0.35, ['fort']);
verifierEvenement('contact', { evenements: [{ type: 'contact', force: 30 }] }, 0.35, ['fort']);
verifierEvenement('roue', { evenements: [{ type: 'roue', force: 1 }] }, 0.5, ['fort']);
verifierEvenement('casse', { evenements: [{ type: 'casse', force: 1 }] }, 0.5, ['fort']);
verifierEvenement('atterrissage', { evenements: [{ type: 'atterrissage', force: 1 }] }, 0.2, ['fort']);

function pics(valeurs, seuil) {
  let n = 0;
  for (let i = 1; i < valeurs.length - 1; i++) {
    if (valeurs[i] >= seuil && valeurs[i] > valeurs[i - 1] && valeurs[i] >= valeurs[i + 1]) n++;
  }
  return n;
}

verifier('dérive : battements stables selon la cadence (4 s, niveaux 0 et 3)', () => {
  const dts = [1 / 30, 1 / 60, 1 / 120];
  for (let i = 0; i < dts.length; i++) {
    const dt = dts[i];
    const t0 = trace(VIB.creer(), { derive: { actif: true, niveau: 0, charge: 1, fenetre: 0 } }, 4, dt);
    const t3 = trace(VIB.creer(), { derive: { actif: true, niveau: 3, charge: 1, fenetre: 0 } }, 4, dt);
    // Pics au-dessus du fond : le lissage peut maintenir le niveau haut à 30 Hz,
    // on compte donc les maxima locaux (chaque enveloppe déclenchée en produit un).
    const p0 = pics(t0.map(x => x.faible), 0.06);
    const p3 = pics(t3.map(x => x.faible), 0.06);
    assert.ok(Math.abs(p0 - 8) <= 1, 'dt=' + dt + ' p0=' + p0);
    assert.ok(Math.abs(p3 - 32) <= 2, 'dt=' + dt + ' p3=' + p3);
  }
});

verifier('dérive : tic au changement de niveau', () => {
  const V = VIB.creer();
  simuler(V, { derive: { actif: true, niveau: 1, charge: 1, fenetre: 0 } }, 0.5, 1 / 60);
  // laisser retomber les enveloppes éventuelles
  simuler(V, {}, 0.6, 1 / 60);
  const avant = V.sortie.fort;
  VIB.calculer(V, { derive: { actif: true, niveau: 2, charge: 1, fenetre: 0 } }, 1 / 60);
  assert.ok(V.sortie.fort > avant + 0.1, 'avant=' + avant + ' apres=' + V.sortie.fort);
});

verifier('dérive : frémissement quand fenetre > 0', () => {
  const V = VIB.creer();
  const t = trace(V, { derive: { actif: true, niveau: 1, charge: 1, fenetre: 1 } }, 0.3, 1 / 240);
  const fa = new Set(t.map(x => Math.round(x.faible * 1000)));
  const fo = new Set(t.map(x => Math.round(x.fort * 1000)));
  assert.ok(fa.size >= 2, 'faible varie');
  assert.ok(fo.size >= 2, 'fort varie');
  assert.ok(t[t.length - 1].fort > 0, 'fort actif en fenêtre');
});

function moyenneMax(traceVals) {
  let somme = 0, max = 0;
  for (let i = 0; i < traceVals.length; i++) { somme += traceVals[i]; if (traceVals[i] > max) max = traceVals[i]; }
  return { moy: somme / traceVals.length, max };
}

verifier('indépendance à la cadence : 1/30, 1/60 et 1/120 diffèrent de moins de 15 %', () => {
  const scenario = { v: 30, vibreur: true, glisseAr: 0.5, regime: 8000, ralenti: 1000, maxUtile: 14000, gaz: 0.6 };
  const t30 = trace(VIB.creer(), scenario, 2, 1 / 30);
  const t60 = trace(VIB.creer(), scenario, 2, 1 / 60);
  const t120 = trace(VIB.creer(), scenario, 2, 1 / 120);
  const canaux = ['faible', 'fort', 'gachetteG', 'gachetteD'];
  for (let c = 0; c < canaux.length; c++) {
    const k = canaux[c];
    const a = moyenneMax(t30.map(x => x[k]));
    const b = moyenneMax(t60.map(x => x[k]));
    const d = moyenneMax(t120.map(x => x[k]));
    const refM = Math.max(a.moy, b.moy, d.moy, 0.001);
    const refX = Math.max(a.max, b.max, d.max, 0.001);
    assert.ok(Math.abs(a.moy - d.moy) / refM < 0.15, k + ' moy 30=' + a.moy + ' 120=' + d.moy);
    assert.ok(Math.abs(b.moy - d.moy) / refM < 0.15, k + ' moy 60=' + b.moy + ' 120=' + d.moy);
    assert.ok(Math.abs(a.max - d.max) / refX < 0.15, k + ' max 30=' + a.max + ' 120=' + d.max);
    assert.ok(Math.abs(b.max - d.max) / refX < 0.15, k + ' max 60=' + b.max + ' 120=' + d.max);
  }
});

// Générateur maison à graine fixe (mulberry32), pas de Math.random.
function rng(graine) {
  let t = graine >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

verifier('bornes : scénario aléatoire extrême reste dans [0, 1] sans NaN', () => {
  const rnd = rng(0xC0FFEE);
  const V = VIB.creer();
  const surfaces = ['piste', 'herbe', 'gravier'];
  const types = ['choc', 'contact', 'roue', 'casse', 'rapport', 'atterrissage'];
  for (let i = 0; i < 2000; i++) {
    const evs = [];
    if (rnd() < 0.2) evs.push({ type: types[(rnd() * types.length) | 0], force: rnd() * 40 });
    const entree = {
      regime: rnd() * 16000, ralenti: 1000, maxUtile: 14000,
      gaz: rnd(), frein: rnd(), v: rnd() * 100,
      surface: surfaces[(rnd() * surfaces.length) | 0],
      vibreur: rnd() < 0.3, patinage: rnd() * 2, blocage: rnd() * 2,
      glisseAr: rnd(), glisseAv: rnd(), bosse: rnd(), turbo: rnd(),
      derive: rnd() < 0.5 ? { actif: rnd() < 0.7, charge: rnd(), niveau: (rnd() * 4) | 0, fenetre: rnd() < 0.2 ? rnd() : 0 } : null,
      evenements: evs, force: rnd()
    };
    VIB.calculer(V, entree, 1 / 60);
    const s = V.sortie;
    const vals = [s.faible, s.fort, s.gachetteG, s.gachetteD];
    for (let j = 0; j < 4; j++) {
      assert.ok(!Number.isNaN(vals[j]), 'NaN au pas ' + i);
      assert.ok(vals[j] >= 0 && vals[j] <= 1, 'hors bornes ' + vals[j] + ' au pas ' + i);
    }
  }
});

verifier('force = 0 : tout à 0', () => {
  const s = simuler(VIB.creer(), { regime: 13000, ralenti: 1000, maxUtile: 14000, gaz: 1, v: 50, vibreur: true, force: 0 }, 1, 1 / 60);
  assert.equal(s.faible, 0); assert.equal(s.fort, 0); assert.equal(s.gachetteG, 0); assert.equal(s.gachetteD, 0);
});

verifier('entrée vide {} : tout à 0, sans exception', () => {
  const V = VIB.creer();
  assert.doesNotThrow(() => simuler(V, {}, 1, 1 / 60));
  const s = V.sortie;
  assert.equal(s.faible, 0); assert.equal(s.fort, 0); assert.equal(s.gachetteG, 0); assert.equal(s.gachetteD, 0);
});

verifier('entrée absente (null, undefined) : sorties à 0, sans exception, et V sans propriété nouvelle', () => {
  const Vn = VIB.creer();
  const avantN = Object.keys(Vn).length;
  assert.doesNotThrow(() => simuler(Vn, null, 1, 1 / 60));
  assert.equal(Vn.sortie.faible, 0); assert.equal(Vn.sortie.fort, 0); assert.equal(Vn.sortie.gachetteG, 0); assert.equal(Vn.sortie.gachetteD, 0);
  assert.equal(Object.keys(Vn).length, avantN, 'propriétés ajoutées sur V (null)');

  const Vu = VIB.creer();
  const avantU = Object.keys(Vu).length;
  assert.doesNotThrow(() => simuler(Vu, undefined, 1, 1 / 60));
  assert.equal(Vu.sortie.faible, 0); assert.equal(Vu.sortie.fort, 0); assert.equal(Vu.sortie.gachetteG, 0); assert.equal(Vu.sortie.gachetteD, 0);
  assert.equal(Object.keys(Vu).length, avantU, 'propriétés ajoutées sur V (undefined)');
});

verifier('même objet de sortie à chaque appel', () => {
  const V = VIB.creer();
  const ref = V.sortie;
  for (let i = 0; i < 10; i++) {
    const r = VIB.calculer(V, { v: 20, regime: 5000, ralenti: 1000, maxUtile: 14000 }, 1 / 60);
    assert.equal(r, ref);
    assert.equal(V.sortie, ref);
  }
});

verifier('choc : le pic ressenti ne dépend pas de la cadence', () => {
  // Le pic doit sortir entier avant de retomber : décroître d'abord le rabotait d'un tiers à 30 appels par seconde.
  const pic = dt => { const V = VIB.creer(); let m = 0;
    VIB.calculer(V, { evenements: [{ type: 'choc', force: 30 }] }, dt); m = V.sortie.fort;
    for (let t = dt; t < .3; t += dt) { VIB.calculer(V, {}, dt); if (V.sortie.fort > m) m = V.sortie.fort; }
    return m; };
  const a = pic(1 / 30), b = pic(1 / 60), c = pic(1 / 120);
  assert.ok(c > .5, 'pic trop faible : ' + c);
  assert.ok(Math.abs(a - c) / c < .15, 'pic à 30 appels/s ' + a + ' contre ' + c + ' à 120');
  assert.ok(Math.abs(b - c) / c < .15, 'pic à 60 appels/s ' + b + ' contre ' + c + ' à 120');
});

verifier('dt non fini ou énorme : sorties finies, puis retour au silence', () => {
  for (const dt of [Infinity, NaN, -1, 1e9]) {
    const V = VIB.creer();
    const e = { v: 40, vibreur: true, surface: 'herbe', glisseAr: 1, glisseAv: 1, blocage: 1, patinage: 1, regime: 13900, ralenti: 1000, maxUtile: 14000,
      gaz: 1, derive: { actif: true, niveau: 3, fenetre: .2 } };
    VIB.calculer(V, e, dt); VIB.calculer(V, e, 1 / 60);
    for (const k of ['faible', 'fort', 'gachetteG', 'gachetteD']) assert.ok(Number.isFinite(V.sortie[k]) && V.sortie[k] >= 0 && V.sortie[k] <= 1, k + ' = ' + V.sortie[k] + ' pour dt = ' + dt);
    simuler(V, {}, 3, 1 / 60);
    for (const k of ['faible', 'fort', 'gachetteG', 'gachetteD']) assert.equal(V.sortie[k], 0, k + ' ne retombe pas après dt = ' + dt);
  }
});

verifier('force 1 vs 0.5 : somme strictement supérieure et sorties bornées à 1', () => {
  const e = { v: 5, vibreur: true, surface: 'herbe' };
  const V05 = VIB.creer();
  const s05 = simuler(V05, { ...e, force: 0.5 }, 1, 1 / 120);
  const somme05 = s05.faible + s05.fort + s05.gachetteG + s05.gachetteD;
  assert.ok(somme05 > 0, 'somme à force 0.5 doit être non nulle : ' + somme05);

  const V1 = VIB.creer();
  const s1 = simuler(V1, { ...e, force: 1 }, 1, 1 / 120);
  const somme1 = s1.faible + s1.fort + s1.gachetteG + s1.gachetteD;
  assert.ok(somme1 > somme05, 'somme à force 1 (' + somme1 + ') pas > somme à force 0.5 (' + somme05 + ')');
  for (const k of ['faible', 'fort', 'gachetteG', 'gachetteD']) {
    assert.ok(s1[k] <= 1, k + ' dépasse 1 à force 1 : ' + s1[k]);
  }
});

console.log(`vibrations : ${controles} contrôles passés`);
