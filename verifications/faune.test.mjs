import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/faune.js');
const F = globalThis.BITUME.faune;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
function fixture(theme = 'montagne') {
  let appels = 0;
  const sol = (x, z) => x * .015 + z * .004 + Math.sin(x / 20) * .06;
  const autorise = (x, z) => Math.abs(x) < 105 && Math.abs(z) < 105 && Math.abs(z) > 6 &&
    !(x < -65 && z < 0) && !(x > 60 && z > 40) && !((x - 40) ** 2 + (z - 30) ** 2 < 64) &&
    !(x > 20 && x < 45 && z < -25);
  const objets = [];
  for (let x = -96; x <= 96; x += 12) for (let z = -96; z <= 96; z += 12)
    objets.push({ shape: 'prairie-val-a', p: [x, sol(x, z) + .21, z], s: [1, .42, 1] });
  const c = { theme, graine: 47, longueur: 5200 };
  const decor = { lots: [{ vegetation: true, tapis: true, objets }], surfaceHerbe(x, z, sortie = {}) {
    appels++; if (!autorise(x, z)) return null;
    sortie.y = sol(x, z); sortie.normal = sortie.normal || [0, 1, 0]; sortie.normal[1] = .99;
    sortie.type = 'terrain'; return sortie;
  } };
  return { c, decor, sol, autorise, get appels() { return appels; }, reset() { appels = 0; } };
}
function contexte(nuit = 0, qualite = 'high', vue = 0) { return { nuit, qualite, vue, pluie: 0, pose: { x: 0, y: 1, z: 30 } }; }
function stabiliser(etat, ctx, fin = 3, hz = 60) {
  const sortie = [];
  for (let n = 0; n <= fin * hz; n++) { sortie.length = 0; F.dessiner(etat, n / hz, ctx, sortie); }
  return { sortie, stats: etat.vues[ctx.vue].stats };
}
const inventaire = e => e.vues.flatMap(v => ['abeilles', 'insectes', 'lucioles'].flatMap(k => v[k].slots.flatMap(s => s.objets)));
const snapshot = out => out.map(o => ({ p: o.p.slice(), s: o.s.slice(), r: o.r.slice(), color: o.color.slice(), alpha: o.alpha, emissive: o.emissive, faune: o.faune }));

verifier('habitats et trajectoires déterministes, sans hasard de simulation ni mutation du circuit', () => {
  const q = fixture(), avant = JSON.stringify(q.c), alea = Math.random;
  let a, b;
  try { Math.random = () => { throw Error('hasard partagé interdit'); }; a = F.creer(q.c, q.decor); b = F.creer(q.c, q.decor); }
  finally { Math.random = alea; }
  assert(a.habitats.length > 48 && a.habitats.length <= F.MAX_HABITATS);
  assert.deepEqual(a.habitats, b.habitats); assert.equal(JSON.stringify(q.c), avant);
  const pa = snapshot(stabiliser(a, contexte()).sortie), pb = snapshot(stabiliser(b, contexte()).sortie);
  assert.deepEqual(pa, pb);
});
verifier('aucun habitat inventé sans herbe réellement admissible', () => {
  const q = fixture();
  for (const decor of [{ lots: [] }, { ...q.decor, lots: [] }, { ...q.decor, surfaceHerbe: () => null }]) {
    const e = F.creer(q.c, decor), out = [];
    assert.equal(e.habitats.length, 0); assert.equal(F.dessiner(e, 1, contexte(1, 'ultra'), out).objets, 0); assert.equal(out.length, 0);
  }
});
verifier('groundCover reconnaît une prairie sans dépendre du nom de forme ou du lot', () => {
  const q = fixture(), a = F.creer(q.c, q.decor);
  const decor = { ...q.decor, lots: [{ objets: q.decor.lots[0].objets.map(o => ({ ...o, shape: 'brins-variante-libre', groundCover: true })) }] };
  assert.deepEqual(F.creer(q.c, decor).habitats, a.habitats);
});
verifier('abeilles avec corps et ailes animées le jour ; lucioles exclusivement dans Haut-Col la nuit', () => {
  for (const theme of ['foret', 'cote', 'montagne']) {
    const q = fixture(theme), jour = stabiliser(F.creer(q.c, q.decor), contexte(0));
    assert.equal(jour.stats.abeilles, F.BUDGETS.high.abeilles); assert.equal(jour.stats.insectes, F.BUDGETS.high.insectes);
    assert.equal(jour.stats.lucioles, 0); assert(jour.sortie.some(o => o.faune === 'abeille' && o.fx));
    const nuit = stabiliser(F.creer(q.c, q.decor), contexte(1));
    assert.equal(nuit.stats.abeilles, 0); assert.equal(nuit.stats.insectes, 0);
    assert.equal(nuit.stats.lucioles, theme === 'montagne' ? F.BUDGETS.high.lucioles : 0);
  }
});
verifier('budgets off/low/medium/high/ultra croissants, 256 lucioles et au plus 512 objets', () => {
  const q = fixture(); let avantJour = -1, avantNuit = -1;
  for (const qualite of ['off', 'low', 'medium', 'high', 'ultra']) {
    const j = stabiliser(F.creer(q.c, q.decor), contexte(0, qualite));
    const n = stabiliser(F.creer(q.c, q.decor), contexte(1, qualite));
    assert(j.stats.objets > avantJour); assert(n.stats.objets > avantNuit);
    assert.equal(j.stats.abeilles, F.BUDGETS[qualite].abeilles); assert.equal(j.stats.insectes, F.BUDGETS[qualite].insectes);
    assert.equal(n.stats.lucioles, F.BUDGETS[qualite].lucioles);
    assert.equal(j.stats.objets, F.BUDGETS[qualite].objetsJour); assert.equal(n.stats.objets, F.BUDGETS[qualite].objetsNuit);
    avantJour = j.stats.objets; avantNuit = n.stats.objets;
  }
});
verifier('vols en 3D au-dessus de la prairie, hors chaussée/eau/roche/tunnel/paddock', () => {
  const q = fixture(), e = F.creer(q.c, q.decor), ctx = contexte(1, 'ultra'), out = [];
  for (let frame = 0; frame < 600; frame++) {
    out.length = 0; F.dessiner(e, frame / 30, ctx, out);
    for (const o of out) {
      assert(q.autorise(o.p[0], o.p[2])); assert(o.p[1] > q.sol(o.p[0], o.p[2]) + .4);
      assert.equal(o.overlay, false); assert.equal(o.windResponsive, false); assert.equal(o.collision, undefined);
      for (const v of [...o.p, ...o.s, ...o.r, ...o.color, o.alpha, o.emissive]) assert(Number.isFinite(v));
    }
  }
});
verifier('halos mondiaux bornés, cœur émissif, aucune lumière et aucune taille imposée en pixels', () => {
  const q = fixture(), e = F.creer(q.c, q.decor), ctx = contexte(1, 'ultra');
  for (const t of [2, 3, 5, 7, 10]) {
    const out = []; F.dessiner(e, t, ctx, out);
    for (const o of out) {
      assert(o.s.every(x => x > 0 && x < (o.fx ? .14 : .021)));
      assert(o.emissive > 0); assert.equal(o.light, undefined); assert.equal(o.lights, undefined); assert.equal(o.additive, undefined);
      if (o.fx) assert(o.alpha > 0 && o.alpha <= .31);
    }
  }
});
verifier('deux vues utilisent des objets distincts, même temps absolu, sans accélérer le cycle', () => {
  const q = fixture(), e = F.creer(q.c, q.decor), a = contexte(1, 'high', 0), b = contexte(1, 'high', 1), oa = [], ob = [];
  for (let n = 0; n <= 120; n++) { oa.length = ob.length = 0; F.dessiner(e, n / 60, a, oa); F.dessiner(e, n / 60, b, ob); }
  assert.deepEqual(snapshot(oa), snapshot(ob)); assert(oa.every(o => !ob.includes(o)));
  const avant = snapshot(oa); oa.length = 0; F.dessiner(e, 2, a, oa); assert.deepEqual(snapshot(oa), avant);
  b.pose.x = 35; ob.length = 0; F.dessiner(e, 2, b, ob); assert.deepEqual(snapshot(oa), avant, 'J2 ne modifie pas les objets déjà soumis par J1');
});
verifier('animation et fondus indépendants de la fréquence de dessin', () => {
  const q = fixture(), a = stabiliser(F.creer(q.c, q.decor), contexte(0), 2, 30), b = stabiliser(F.creer(q.c, q.decor), contexte(0), 2, 120);
  assert.equal(a.sortie.length, b.sortie.length);
  for (let i = 0; i < a.sortie.length; i++) for (const k of ['p', 's', 'r']) for (let j = 0; j < 3; j++)
    assert(Math.abs(a.sortie[i][k][j] - b.sortie[i][k][j]) < 1e-8);
  const e = F.creer(q.c, q.decor), ctx = contexte(), out = stabiliser(e, ctx).sortie;
  const aile = out.find(o => o.faune === 'abeille' && o.fx), angle = aile.r[0], position = aile.p.slice();
  out.length = 0; F.dessiner(e, 3.02, ctx, out); assert.notEqual(aile.r[0], angle); assert.notDeepEqual(aile.p, position);
});
verifier('pools et tableaux réutilisés ; aucune lecture de terrain pendant 2000 images', () => {
  const q = fixture(), e = F.creer(q.c, q.decor), objets = inventaire(e), connus = new Set(objets);
  const tableaux = objets.map(o => [o.p, o.s, o.r, o.color]); q.reset();
  const ctx = contexte(1, 'ultra'), out = [];
  for (let n = 0; n < 2000; n++) {
    out.length = 0; F.dessiner(e, n / 60, ctx, out);
    assert(out.every(o => connus.has(o))); assert.equal(new Set(out).size, out.length); assert(out.length <= F.MAX_OBJETS);
  }
  assert.equal(q.appels, 0);
  objets.forEach((o, i) => { assert.strictEqual(o.p, tableaux[i][0]); assert.strictEqual(o.s, tableaux[i][1]); assert.strictEqual(o.r, tableaux[i][2]); assert.strictEqual(o.color, tableaux[i][3]); });
  const requetes = e.vues[0].stats.requetes; ctx.qualite = 'off'; out.length = 0;
  assert.equal(F.dessiner(e, 34, ctx, out).objets, 0); assert.equal(e.vues[0].stats.requetes, requetes);
});
verifier('crépuscule et pluie réduisent progressivement l’activité, qualité légère et retour à off effectifs', () => {
  const q = fixture(), e = F.creer(q.c, q.decor), ctx = contexte(0, 'ultra'), out = stabiliser(e, ctx).sortie;
  const initial = out.find(o => o.faune === 'abeille'), taille = initial.s[0]; ctx.nuit = 1; out.length = 0;
  F.dessiner(e, 3 + 1 / 60, ctx, out); assert(out.includes(initial)); assert(initial.s[0] > taille * .9);
  for (let n = 1; n <= 240; n++) { out.length = 0; F.dessiner(e, 3 + n / 60, ctx, out); assert(out.length <= F.MAX_OBJETS); }
  assert.equal(e.vues[0].stats.abeilles, 0); assert.equal(e.vues[0].stats.lucioles, 256);
  ctx.pluie = 1; ctx.qualite = 'low';
  for (let n = 1; n <= 240; n++) { out.length = 0; F.dessiner(e, 7 + n / 60, ctx, out); }
  assert(e.vues[0].stats.lucioles > 0 && e.vues[0].stats.lucioles <= 6); assert(out.length <= 12);
  ctx.qualite = 'off'; out.length = 0; assert.equal(F.dessiner(e, 12, ctx, out).objets, 0);
});
verifier('vrais circuits sans végétation : habitats indépendants, abeilles à moins de 15 m, vols sur le sol réel', () => {
  for (const f of ['carene', 'circuit', 'decor']) require('../src/' + f + '.js');
  const B = globalThis.BITUME;
  for (const [theme, graine, longueur] of [['foret', 11, 4200], ['cote', 29, 3600], ['montagne', 47, 5200]]) {
    const c = B.circuit.creer(graine, { theme, longueur });
    const decor = B.decor.construire(c, { vegetation: false, vegetationQualite: 'off', qualite: 'low' });
    assert(!decor.vegetation); assert(!decor.lots.some(l => l.tapis || l.vegetation));
    const e = F.creer(c, decor);
    assert(e.habitats.length >= 1000 && e.habitats.length <= F.MAX_HABITATS);
    // Les mêmes surfaces avec un lot de plantes absent, puis inconnu, produisent le même habitat.
    const autre = F.creer(c, { surfaceHerbe: decor.surfaceHerbe, lots: [{ objets: [{ groundCover: true, p: [0, 0, 0], s: [1, 2, 1] }] }] });
    assert.deepEqual(e.habitats, autre.habitats);
    const out = [], ctx = contexte(0, 'ultra'), sonde = {};
    let temps = 0;
    for (let k = 0; k < 8; k++) {
      const s = c.longueur * (.14 + .095 * k), pose = B.circuit.echantillon(c, s);
      if (B.circuit.dansTunnel(c, s, 30)) continue;
      ctx.pose = pose;
      for (let j = 0; j < 180; j++) { out.length = 0; F.dessiner(e, temps += 1 / 60, ctx, out); }
      assert.equal(e.vues[0].stats.abeilles, 32, theme + ' budget de jour');
      const corps = e.vues[0].abeilles.slots.filter(sl => sl.poids > .008).map(sl => sl.objets[0]);
      assert(corps.filter(o => Math.hypot(o.p[0] - pose.x, o.p[2] - pose.z) < 15).length >= 24, theme + ' proximité');
      for (const o of out) {
        const sol = decor.surfaceHerbe(o.p[0], o.p[2], sonde);
        assert(sol, theme + ' vol hors herbe'); assert(o.p[1] > sol.y + .42, theme + ' vol au-dessus des brins');
      }
    }
    if (theme === 'montagne') {
      ctx.nuit = 1;
      for (let j = 0; j < 240; j++) { out.length = 0; F.dessiner(e, temps += 1 / 60, ctx, out); }
      assert.equal(e.vues[0].stats.lucioles, 256); assert.equal(out.length, 512);
    }
  }
});
console.log('faune : ' + controles + ' contrôles passés');
