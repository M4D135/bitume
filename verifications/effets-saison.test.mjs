import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/effets-saison.js');
const E = globalThis.BITUME.effetsSaison;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
function fixture(type = 'neige') {
  let appels = 0;
  const c = { graine: 47, theme: type === 'neige' ? 'montagne' : 'foret' };
  const decor = { saison: { neige: type === 'neige', feuilles: type === 'feuilles' }, sol(x, z) { appels++; return x * .008 + z * .006; },
    sourcesFeuilles: Array.from({ length: 25 }, (_, i) => ({ x: (i % 5 - 2) * 11, z: (Math.floor(i / 5) - 2) * 11, y: 8, sol: 0, rayon: 3 })) };
  return { c, decor, get appels() { return appels; }, reset() { appels = 0; } };
}
function contexte(qualite = 'high', vue = 0) { return { qualite, vue, nuit: 0, pluie: 1, ventX: 0, ventZ: 0, pose: { x: 0, y: 2, z: 0 } }; }
function stabiliser(etat, ctx, fin = 3, hz = 60) {
  const out = [];
  for (let i = 0; i <= fin * hz; i++) { out.length = 0; E.dessiner(etat, i / hz, ctx, out); }
  return out;
}
const snapshot = out => out.map(o => ({ p: o.p.slice(), s: o.s.slice(), r: o.r.slice(), color: o.color.slice(), alpha: o.alpha }));
const inventaire = e => e.vues.flatMap(v => [v.feuilles, v.neige].flatMap(p => p.slots.map(s => s.objet)));

verifier('précipitations réservées aux profils neigeux ; feuilles aux arbres automnaux', () => {
  for (const type of ['neige', 'feuilles', 'ete']) {
    const q = fixture(type), e = E.creer(q.c, q.decor), out = stabiliser(e, contexte('ultra'));
    if (type === 'ete') assert.equal(out.length, 0);
    else { assert(out.length > 15); assert(out.every(o => o.effetSaison === (type === 'neige' ? 'neige' : 'feuille'))); }
  }
  const q = fixture(); q.decor.saison.neige = false; q.c.theme = 'cote';
  assert.equal(stabiliser(E.creer(q.c, q.decor), contexte()).length, 0);
});
verifier('paliers croissants et arrêt effectif, sans nouvelle lecture du sol', () => {
  for (const type of ['neige', 'feuilles']) {
    let avant = -1;
    for (const qualite of ['off', 'low', 'medium', 'high', 'ultra']) {
      const q = fixture(type), e = E.creer(q.c, q.decor), ctx = contexte(qualite), out = stabiliser(e, ctx);
      assert(out.length > avant); assert(out.length <= E.BUDGETS[qualite][type]); avant = out.length;
      q.reset(); ctx.qualite = 'off'; out.length = 0; E.dessiner(e, 4, ctx, out); assert.equal(out.length, 0); assert.equal(q.appels, 0);
    }
  }
});
verifier('neige météo explicite hors hiver, intensité finale et interdiction persistante au Sud', () => {
  const q = fixture('ete'), e = E.creer(q.c, q.decor), ctx = contexte('ultra');
  ctx.pluie = 0; ctx.neige = .8;
  assert(stabiliser(e, ctx).length > 30);
  q.c.theme = 'cote'; assert.equal(stabiliser(E.creer(q.c, q.decor), ctx).length, 0);
  ctx.neige = 0; const out = []; E.dessiner(e, 3.02, ctx, out); assert(out.length > 0);
  for (let i = 1; i <= 240; i++) { out.length = 0; E.dessiner(e, 3.02 + i / 60, ctx, out); }
  assert.equal(out.length, 0);
});
verifier('neige sans eau, sans abri, sans sous-sol ; objets 3D petits et proches', () => {
  const q = fixture(); q.decor.niveauEau = 0; q.decor.sol = (x, z) => x < 0 ? -1 : 1;
  const e = E.creer(q.c, q.decor), ctx = contexte('ultra'), out = [];
  for (let i = 0; i < 900; i++) {
    out.length = 0; E.dessiner(e, i / 30, ctx, out);
    for (const o of out) {
      assert(o.p[0] > 0); assert(o.p[1] > 1); assert(Math.hypot(o.p[0], o.p[1] - 2, o.p[2]) < E.PORTEE_NEIGE);
      assert.equal(o.overlay, false); assert.equal(o.fx, true); assert.equal(o.collision, undefined);
      assert(o.s.every(v => v > 0 && v < .07)); assert(o.alpha > 0 && o.alpha <= .78);
    }
  }
  ctx.abri = true; out.length = 0; E.dessiner(e, 31, ctx, out); assert.equal(out.length, 0);
  ctx.abri = false; out.length = 0; E.dessiner(e, 31.1, ctx, out); assert.equal(out.length, 0, 'retour progressif à la sortie');
  assert(stabiliser(e, ctx, 4).length > 0);
});
verifier('portails du tunnel et toitures sont masqués aussi vus de l’extérieur', () => {
  const q = fixture(), B = globalThis.BITUME;
  const ancien = B.circuit; B.circuit = { dansTunnel: () => true };
  q.c.x = [0]; q.c.y = [0]; q.c.z = [0];
  const e = E.creer(q.c, q.decor); B.circuit = ancien;
  assert.equal(stabiliser(e, contexte('ultra')).length, 0);
  const b = fixture(); b.decor.obstacles = [{ type: 'box', x: 0, z: 0, hx: 8, hz: 8 }];
  const eb = E.creer(b.c, b.decor);
  for (const o of stabiliser(eb, contexte('ultra'))) assert(Math.abs(o.p[0]) > 8 || Math.abs(o.p[2]) > 8);
});
verifier('déterminisme sans hasard partagé, même temps dans deux pools indépendants', () => {
  const q = fixture(), original = JSON.stringify(q.c), alea = Math.random;
  let e, copie;
  try { Math.random = () => { throw Error('hasard partagé'); }; e = E.creer(q.c, q.decor); copie = E.creer(q.c, q.decor); }
  finally { Math.random = alea; }
  const a = contexte('ultra', 0), b = contexte('ultra', 1), oa = [], ob = [];
  for (let n = 0; n <= 180; n++) { oa.length = ob.length = 0; E.dessiner(e, n / 60, a, oa); E.dessiner(e, n / 60, b, ob); }
  assert.deepEqual(snapshot(oa), snapshot(ob)); assert(oa.every(o => !ob.includes(o)));
  assert.deepEqual(snapshot(oa), snapshot(stabiliser(copie, a)));
  const avant = snapshot(oa); ob.length = 0; b.pose.x = 12; E.dessiner(e, 3, b, ob); assert.deepEqual(snapshot(oa), avant);
  assert.equal(JSON.stringify(q.c), original);
});
verifier('trajectoires absolues et fondus identiques à 30 et 120 Hz', () => {
  for (const type of ['neige', 'feuilles']) {
    const q = fixture(type), a = stabiliser(E.creer(q.c, q.decor), contexte('ultra'), 3, 30), b = stabiliser(E.creer(q.c, q.decor), contexte('ultra'), 3, 120);
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) for (const k of ['p', 's', 'r']) for (let j = 0; j < 3; j++) assert(Math.abs(a[i][k][j] - b[i][k][j]) < 1e-9);
  }
});
verifier('vent continu et varié, chute réelle et fonte douce en fin de précipitation', () => {
  const q = fixture(), e = E.creer(q.c, q.decor), ctx = contexte('ultra'), out = stabiliser(e, ctx), connus = new Map(out.map(o => [o, o.p.slice()]));
  ctx.ventX = 14; ctx.ventZ = -8; out.length = 0; E.dessiner(e, 3.016, ctx, out);
  let descend = 0;
  for (const o of out) if (connus.has(o)) { const p = connus.get(o); if (o.p[1] < p[1]) descend++; assert(Math.hypot(o.p[0] - p[0], o.p[2] - p[2]) < .1); }
  assert(descend > 10);
  ctx.pluie = 0; out.length = 0; E.dessiner(e, 3.032, ctx, out); assert(out.length > 0);
  for (let i = 1; i <= 240; i++) { out.length = 0; E.dessiner(e, 3.032 + i / 60, ctx, out); }
  assert.equal(out.length, 0);
});
verifier('pools et tableaux réutilisés sur 2000 images ; sélection et terrain au repos mis en cache', () => {
  const q = fixture(), e = E.creer(q.c, q.decor), ctx = contexte('ultra'), out = stabiliser(e, ctx);
  const objets = inventaire(e), connus = new Set(objets), arrays = objets.map(o => [o.p, o.s, o.r, o.color]);
  q.reset(); const requetes = e.vues[0].stats.requetes;
  for (let i = 0; i < 2000; i++) { out.length = 0; E.dessiner(e, 3 + i / 60, ctx, out); assert(out.every(o => connus.has(o))); assert(out.length <= 480); }
  assert.equal(q.appels, 0); assert.equal(e.vues[0].stats.requetes, requetes);
  objets.forEach((o, i) => { assert.strictEqual(o.p, arrays[i][0]); assert.strictEqual(o.s, arrays[i][1]); assert.strictEqual(o.r, arrays[i][2]); assert.strictEqual(o.color, arrays[i][3]); });
  for (let i = 0; i < 600; i++) { ctx.pose.x = i / 10; out.length = 0; E.dessiner(e, 40 + i / 60, ctx, out); assert(out.every(o => connus.has(o))); }
});
verifier('vrais décors : sources automnales, profils hivernaux et suppression dans le tunnel', () => {
  for (const n of ['circuit', 'carene', 'ecologie', 'saisons', 'vegetation', 'decor']) require('../src/' + n + '.js');
  const B = globalThis.BITUME;
  for (const [graine, theme, longueur] of [[11, 'foret', 4200], [29, 'cote', 3600], [47, 'montagne', 5200]]) {
    const c = B.circuit.creer(graine, { theme, longueur });
    const decor = B.decor.construire(c, { qualite: 'low', vegetation: false, saison: 'hiver' }), e = E.creer(c, decor);
    const ctx = contexte('ultra'); let nombre = 0;
    for (const f of [.1, .3, .5, .7, .9]) { const p = B.circuit.echantillon(c, c.longueur * f); ctx.pose.x = p.x; ctx.pose.y = p.y + 2; ctx.pose.z = p.z; nombre += stabiliser(e, ctx, 2).length; }
    if (theme === 'cote') assert.equal(nombre, 0); else assert(nombre > 20);
    if (theme === 'montagne' && c.tunnel) { const p = B.circuit.echantillon(c, (c.tunnel.debut + c.tunnel.fin) / 2); ctx.pose.x = p.x; ctx.pose.y = p.y + 2; ctx.pose.z = p.z; assert.equal(stabiliser(e, ctx, 2).length, 0); }
    if (theme === 'foret') {
      const automne = B.decor.construire(c, { qualite: 'low', vegetation: false, saison: 'automne' }), feuilles = E.creer(c, automne);
      assert(feuilles.sources.length > 50); const s = feuilles.sources[Math.floor(feuilles.sources.length / 2)];
      ctx.pose.x = s.x; ctx.pose.z = s.z; ctx.pose.y = s.sol + 2;
      assert(stabiliser(feuilles, ctx, 2).some(o => o.effetSaison === 'feuille'));
    }
  }
});
console.log('effets-saison : ' + controles + ' contrôles passés');
