// Roues 12B/12C : maillages rendus, taille projetée, vues indépendantes et réemploi après une casse.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const f of ['pneus', 'carene', 'main', 'conduite', 'voiture', 'traces']) require('../src/' + f + '.js');
const B = globalThis.BITUME, V = B.voiture;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const pose = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: .12, roule: 1.7, v: 12 };
const livree = { couleur: [.8, .1, .08], seconde: [.9, .9, .9], casque: [.9, .9, .9], pneus: 'pluie' };
const roue = o => o.shape.startsWith('bitume-pneu-');

verifier('type de pneu invalide ou hérité : repli slick sans plantage, avec ou sans contrat partagé', () => {
  const contrat = B.pneus;
  try {
    for (const module of [contrat, undefined]) {
      B.pneus = module;
      for (const pneus of ['constructor', '__proto__', 'toString', 'inconnu', null, undefined, {}]) {
        const mod = V.modele({ ...livree, pneus }), sortie = [];
        V.poser(mod, pose, sortie, { rouesDetail: 0 });
        const visibles = sortie.filter(roue);
        assert.equal(visibles.length, 4);
        for (let i = 0; i < 4; i++)
          assert.equal(visibles[i].shape, V.ROUES_FORMES[i < 2 ? 'av' : 'ar'].slicks[0].nom);
      }
    }
  } finally { B.pneus = contrat; }
});

verifier('tous les maillages de roue ont des faces finies, non dégénérées, orientées vers leurs normales', () => {
  const formes = Object.values(V.FORMES).filter(f => /^bitume-(pneu-|jante-|rayons-|moyeu-roue-|valve-roue|bague-pneu-|disque-roue-)/.test(f.nom));
  assert.ok(formes.length > 30);
  for (const f of formes) for (const tr of f.tri) {
    assert.ok(tr.flat().every(Number.isFinite), f.nom);
    const [a, b, c] = tr, u = b.map((x, i) => x - a[i]), v = c.map((x, i) => x - a[i]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    assert.ok(Math.hypot(...n) > 1e-12, 'face nulle : ' + f.nom);
    for (const normale of tr.slice(3)) {
      assert.ok(Math.abs(Math.hypot(...normale) - 1) < 1e-10, 'normale unitaire : ' + f.nom);
      assert.ok(n.reduce((s, x, i) => s + x * normale[i], 0) > 0, 'face inversée : ' + f.nom);
    }
  }
});

verifier('quatre sculptures distinctes proches, silhouettes partagées au loin, cotes et ouverture de jante conservées', () => {
  for (const [essieu, w] of [['av', V.ROUES[0]], ['ar', V.ROUES[2]]]) {
    const types = V.ROUES_FORMES[essieu];
    assert.equal(new Set(Object.values(types).map(t => t[0].triangles)).size, 4);
    for (const [type, formes] of Object.entries(types)) for (let i = 0; i < formes.length; i++) {
      const f = formes[i];
      assert.ok(Math.abs(f.taille[0] - 2 * w.r) < 1e-10 && Math.abs(f.taille[2] - 2 * w.r) < 1e-10, f.nom);
      assert.ok(Math.abs(f.taille[1] - w.l) < 1e-10, f.nom);
      if (i >= 2) assert.strictEqual(f, types.slicks[i]);
      for (const tr of f.tri) for (const p of tr.slice(0, 3)) {
        const x = p[0] * f.taille[0], z = p[2] * f.taille[2], r = Math.hypot(x, z);
        assert.ok(r > .169 && r <= w.r + 1e-10, 'pneu annulaire : ' + type);
        if (type === 'slicks' && Math.abs(p[1] * f.taille[1]) < w.l / 2 - .050 && r > .9 * w.r)
          assert.ok(Math.abs(r - w.r) < 1e-10, 'slick neuf sans faux canal');
      }
    }
  }
});

verifier('taille projetée et hystérésis : quatre détails utiles et erreur de corde bornée dans les cadrages de référence', () => {
  const t = Math.tan(Math.PI / 6), h = 1080, distance2 = pixels => (V.ROUES[2].r * h / (2 * t * pixels)) ** 2;
  for (const [pixels, niveau] of [[10, 3], [40, 2], [150, 1], [500, 0]])
    assert.equal(V.detailRouesPour(distance2(pixels), t, h, -1), niveau);
  assert.equal(V.detailRouesPour(distance2(350), t, h, 0), 0, 'baisse retardée dans la bande');
  assert.equal(V.detailRouesPour(distance2(290), t, h, 0), 1, 'baisse après sortie de la bande');
  assert.equal(V.detailRouesPour(distance2(380), t, h, 1), 1, 'hausse retardée dans la bande');
  assert.equal(V.detailRouesPour(distance2(430), t, h, 1), 0, 'hausse après sortie de la bande');
  for (const pixels of [1, 19, 22, 40, 80, 96, 150, 350, 410, 500, 900]) for (const precedent of [-1, 0, 1, 2, 3]) {
    const niveau = V.detailRouesPour(distance2(pixels), t, h, precedent);
    assert.ok(pixels * (1 - Math.cos(Math.PI / V.SEGMENTS_ROUE[niveau])) <= .5, pixels + ' px');
  }
  const d2 = distance2(90);
  assert.ok(V.detailRouesPour(d2, t, 270, -1) > V.detailRouesPour(d2, t, 1080, -1), 'la petite glace n’hérite pas du détail de la grande vue');
});

verifier('distance en 3D : caméra haute, roue proche et suspension influent dans le bon sens', () => {
  const ev = { ...pose, cap: Math.PI / 2, braquage: 0 };
  // AVG après un quart de tour : centre (.85, .29, 1.35).
  assert.ok(V.distanceRoues2(ev, [.85, .29, 1.45]) <= .0100000001);
  assert.ok(V.distanceRoues2(ev, [.85, 20, 1.45]) > 300, 'pas de faux gros plan sous une caméra haute');
  const cam = [.85, 2, 1.35], a = V.distanceRoues2(ev, cam);
  ev.rebond = [.1, 0, 0, 0];
  assert.ok(V.distanceRoues2(ev, cam) < a, 'la suspension rapproche le pneu de la caméra');
});

verifier('passages entre détails : quatre pneus, mêmes objets permanents, dimensions et pose stables', () => {
  const mod = V.modele(livree), sortie = [];
  V.poser(mod, pose, sortie, { rouesDetail: 0 });
  const pneus = sortie.filter(roue), positions = pneus.map(o => Array.from(o.p)), dimensions = pneus.map(o => Array.from(o.s));
  assert.equal(pneus.length, 4);
  for (const niveau of [3, 1, 2, 0]) {
    sortie.length = 0; V.poser(mod, pose, sortie, { rouesDetail: niveau });
    const vus = sortie.filter(roue);
    assert.equal(vus.length, 4);
    for (let i = 0; i < 4; i++) {
      assert.strictEqual(vus[i], pneus[i]);
      assert.deepEqual(Array.from(vus[i].p), positions[i]);
      assert.deepEqual(Array.from(vus[i].s), dimensions[i]);
      assert.equal(vus[i].shape, V.ROUES_FORMES[i < 2 ? 'av' : 'ar'].pluie[niveau].nom);
    }
  }
});

verifier('cockpit et rétroviseur acceptent leur détail sans écraser les objets de la vue principale', () => {
  const mod = V.modele(livree), vue = [], cockpit = [], retro = [];
  V.poser(mod, pose, vue, { rouesDetail: 0 });
  const noms = vue.filter(roue).map(o => o.shape);
  V.cockpit(mod, pose, cockpit, { regime: 9000, rapport: 3, rouesDetail: 1 });
  assert.equal(cockpit.filter(roue).length, 2);
  assert.ok(cockpit.filter(roue).every(o => o.shape === V.ROUES_FORMES.av.pluie[1].nom));
  V.poserRetro(mod, pose, retro, { rouesDetail: 2 });
  assert.equal(retro.filter(roue).length, 2);
  assert.ok(retro.filter(roue).every(o => o.shape === V.ROUES_FORMES.ar.pluie[2].nom));
  assert.deepEqual(vue.filter(roue).map(o => o.shape), noms, 'tables indépendantes');
  const fantome = V.objetsFantome();
  assert.equal(fantome.objets.filter(roue).length, 4, 'pas de cylindre grossier sur le fantôme');
});

verifier('roue détachée : sculpture conservée et taille du collider inchangée', () => {
  const fx = B.traces.creer(1, 9123), w = V.ROUES[2];
  const co = { c: { longueur: 2000 }, voitures: [{ etat: { pneus: 'pluie', s: 0, v: 0 } }] };
  B.traces.pas(fx, co, [{ x: 0, y: 0, z: 0, cap: 0 }], 0, 0, [{ type: 'roue', id: 0, roue: 2 }]);
  const debris = fx.debris.filter(d => d.actif);
  assert.equal(debris.length, 1);
  assert.equal(debris[0].objet.shape, V.ROUES_FORMES.ar.pluie[1].nom);
  assert.deepEqual(Array.from(debris[0].objet.s), [2 * w.r, w.l, 2 * w.r]);
  B.traces.liberer(fx);
});

console.log(controles + ' vérifications réussies');
