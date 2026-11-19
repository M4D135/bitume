// 12D : surfaces réellement rendues, sans effet sur la physique ni diamètre ajouté par un décalque.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const f of ['pneus', 'carene', 'main', 'voiture']) require('../src/' + f + '.js');
const B = globalThis.BITUME, V = B.voiture, P = B.pneus;
const formes = new Map(Object.values(V.FORMES).map(f => [f.nom, f]));
const livree = pneus => ({ couleur: [.8, .1, .08], pneus });
const pose = etatPneus => ({ p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: .13, roule: 1.3, v: 15, etatPneus });
const etats = (u = 0, s = 0, g = 0) => P.creerEtat('slicks', { seance: 17, voiture: 4 }).etatPneus.map(e => ({ ...e, usure: u, salete: s, grainage: g }));
const dessiner = (mod, ev, options) => { const s = []; V.poser(mod, ev, s, options); return s; };
const valeurs = sortie => JSON.stringify(sortie);
const matiere = o => o.shape.startsWith('bitume-matiere-pneu-');
const fond = o => o.shape.startsWith('bitume-fond-sculpture-');
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

verifier('état absent, neuf explicite et retour neuf rendent exactement la même image', () => {
  for (const type of P.TYPES) {
    const mod = V.modele(livree(type)), sans = valeurs(dessiner(mod, pose()));
    assert.equal(valeurs(dessiner(mod, pose(etats()))), sans);
    assert.notEqual(valeurs(dessiner(mod, pose(etats(.7, .6, .5)))), sans);
    assert.equal(valeurs(dessiner(mod, pose())), sans, 'aucune teinte usée conservée dans le cache');
  }
});

verifier('partition de la peau : mêmes triangles, mêmes normales et mêmes cotes, sans doublon', () => {
  for (const type of P.TYPES) {
    const mod = V.modele(livree(type));
    for (const roue of [0, 2]) for (let niveau = 0; niveau < 2; niveau++) {
      const pieces = mod.corps.filter(p => p.roue === roue && p.usureRoue >= 1 && p.usureRoue <= 5);
      const origine = V.ROUES_FORMES[roue < 2 ? 'av' : 'ar'][type][niveau], triangles = [];
      for (const p of pieces) {
        const f = (p.formesUsees || p.formesRoues)[niveau];
        assert.ok(f.tri.length > 0, f.nom);
        assert.strictEqual(f.taille, origine.taille);
        assert.strictEqual(f.centre, origine.centre);
        triangles.push(...f.tri);
      }
      assert.equal(triangles.length, origine.tri.length);
      assert.equal(new Set(triangles).size, origine.tri.length);
      for (const tri of origine.tri) assert.ok(triangles.includes(tri));
    }
  }
});

verifier('chaque roue évolue seule et les marques suivent ses rotations sans muter son état', () => {
  const mod = V.modele(livree('slicks')), e = etats(), ev = pose(e), neuf = dessiner(mod, ev);
  const horsAVG = neuf.filter(o => !(Math.abs(o.p[0] - V.ROUES[0].x) < 1e-12 && Math.abs(o.p[2] - V.ROUES[0].z) < 1e-12));
  const avant = valeurs(horsAVG);
  Object.assign(e[0], { usure: .65, salete: .3, grainage: .7 });
  const source = JSON.stringify(e), use = dessiner(mod, ev);
  assert.equal(valeurs(use.filter(o => !(Math.abs(o.p[0] - V.ROUES[0].x) < 1e-12 && Math.abs(o.p[2] - V.ROUES[0].z) < 1e-12))), avant);
  const surfaces = use.filter(matiere), rotation = Array.from(surfaces[0].r);
  assert.equal(surfaces.length, 4);
  assert.ok(surfaces.every(o => o.r === surfaces[0].r));
  ev.roule += .2; ev.braquage += .1; dessiner(mod, ev);
  assert.notDeepEqual(Array.from(surfaces[0].r), rotation);
  assert.equal(JSON.stringify(e), source);
});

verifier('teintes continues, graine reproductible et saleté réversible sans effacer l’usure', () => {
  const mod = V.modele(livree('slicks')), e = etats(.5, 0, .4), ev = pose(e);
  const propre = valeurs(dessiner(mod, ev));
  e[0].salete = .8;
  assert.notEqual(valeurs(dessiner(mod, ev)), propre);
  e[0].salete = 0;
  assert.equal(valeurs(dessiner(mod, ev)), propre);
  const graine = e[0].graine; e[0].graine = 912345;
  assert.notEqual(valeurs(dessiner(mod, ev)), propre);
  e[0].graine = graine;
  assert.equal(valeurs(dessiner(mod, ev)), propre);
  const couleurs = dessiner(mod, ev).filter(matiere).map(o => Array.from(o.color));
  e[0].usure += 1e-5;
  const suite = dessiner(mod, ev).filter(matiere);
  for (let i = 0; i < suite.length; i++) for (let k = 0; k < 3; k++)
    assert.ok(Math.abs(suite[i].color[k] - couleurs[i][k]) < 1e-5, 'pas de palier brutal');
});

verifier('sculptures : fond continu sous les sommets ; slick sans canal et diamètre inchangé', () => {
  for (const type of P.TYPES) {
    const mod = V.modele(livree(type)), e = etats(.1), ev = pose(e), a = dessiner(mod, ev), fonds = a.filter(fond);
    assert.equal(fonds.length, type === 'slicks' ? 0 : 4);
    const tailles = fonds.map(o => Array.from(o.s));
    for (const p of e) p.usure = 1;
    const b = dessiner(mod, ev), finis = b.filter(fond);
    for (let i = 0; i < finis.length; i++) {
      assert.strictEqual(finis[i], fonds[i]);
      assert.ok(finis[i].s[0] > tailles[i][0]);
      const forme = formes.get(finis[i].shape), rayon = Math.max(...forme.tri.flatMap(tri => tri.slice(0, 3).map(p => Math.hypot(p[0] * finis[i].s[0], p[2] * finis[i].s[2]))));
      assert.ok(rayon < V.ROUES[i].r);
      assert.equal(finis[i].s[1], tailles[i][1]);
    }
    for (const o of b.filter(matiere)) {
      const f = formes.get(o.shape), r = o.shape.includes('-av-') ? V.ROUES[0].r : V.ROUES[2].r;
      assert.equal(o.s[0], 2 * r); assert.equal(o.s[2], 2 * r);
      for (const tri of f.tri) for (const p of tri.slice(0, 3)) assert.ok(Math.hypot(p[0] * o.s[0], p[2] * o.s[2]) <= r + 1e-10);
    }
  }
});

verifier('tables permanentes et niveaux de détail : supports limités au proche, couleurs locales', () => {
  const mod = V.modele(livree('pluie')), e = etats(.6, .4, .3), ev = pose(e), a = dessiner(mod, ev), refs = a.map(o => ({ o, color: o.color, p: o.p, r: o.r }));
  const nombreTables = mod.objetsRendu.tables.filter(Boolean).length;
  for (let n = 0; n < 1000; n++) { ev.roule += .005; dessiner(mod, ev); }
  const b = dessiner(mod, ev);
  assert.equal(b.length, refs.length);
  for (let i = 0; i < b.length; i++) {
    assert.strictEqual(b[i], refs[i].o); assert.strictEqual(b[i].color, refs[i].color);
    assert.strictEqual(b[i].p, refs[i].p); assert.strictEqual(b[i].r, refs[i].r);
  }
  for (const detail of [0, 1, 2, 3, 0]) {
    const sortie = dessiner(mod, ev, { rouesDetail: detail });
    assert.equal(sortie.filter(matiere).length, detail < 2 ? 16 : 0);
    assert.equal(sortie.filter(fond).length, detail < 2 ? 4 : 0);
    for (const o of sortie) for (const k of ['p', 's', 'r', 'color']) assert.ok(Array.from(o[k]).every(Number.isFinite));
  }
  assert.equal(mod.objetsRendu.tables.filter(Boolean).length, nombreTables);
  const ref = valeurs(dessiner(mod, ev)), retro = [];
  V.poserRetro(mod, pose(etats(.2, .8)), retro, { rouesDetail: 1 });
  assert.equal(valeurs(b), ref, 'la glace ne retouche pas les couleurs ni tailles de la vue principale');
});

verifier('rétroviseurs : même usure que la vue entière filtrée ; roue perdue entièrement masquée', () => {
  const mod = V.modele(livree('pluie')), ev = pose(etats(.8, .2, .5));
  const complet = dessiner(mod, ev).filter(o => Math.abs(o.p[0] - V.ROUES[2].x) < .5 && Math.abs(o.p[2]) > .55), retro = [];
  V.poserRetro(mod, ev, retro);
  assert.equal(valeurs(retro), valeurs(complet));
  const sans = dessiner(mod, ev, { roues: [true, true, true, true] });
  assert.equal(sans.filter(matiere).length, 0); assert.equal(sans.filter(fond).length, 0);
});

verifier('valeurs invalides et exagérées : aucun nombre non fini injecté dans le rendu', () => {
  const mod = V.modele(livree('neige')), e = etats();
  e[0] = { usure: NaN, salete: Infinity, grainage: -1, graine: NaN };
  e[1] = { usure: 5, salete: -3, grainage: 4, graine: Infinity }; e[2] = null;
  for (const o of dessiner(mod, pose(e))) for (const k of ['p', 's', 'r', 'color']) assert.ok(Array.from(o[k]).every(Number.isFinite));
});

console.log(controles + ' contrôles usure visuelle réussis');
