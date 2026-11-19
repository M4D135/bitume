// 12F2 : les pneus changent réellement sur le même modèle, avec toutes leurs vues et leurs surfaces d'usure.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const nom of ['pneus', 'carene', 'main', 'circuit', 'conduite', 'degats', 'contacts', 'course', 'voiture']) require('../src/' + nom + '.js');
const B = globalThis.BITUME, V = B.voiture, P = B.pneus;
const livree = type => ({ couleur: [.8, .12, .07], seconde: [.9, .88, .84], casque: [.7, .6, .1], numero: 27, pneus: type });
const pose = { p: [12, 1, -8], cap: .3, tangage: .02, roulis: -.01, braquage: .17, roule: 12.7, v: 23, rebond: [.01, 0, -.02, .01] };
const etats = P.creerEtat('slicks', { seance: 123, voiture: 2 }).etatPneus;
etats.forEach((r, i) => Object.assign(r, { usure: .15 + .2 * i, grainage: .11 + .12 * i, salete: .13 + .09 * i }));
const use = { ...pose, etatPneus: etats }, etatsAvant = structuredClone(etats);
const resume = liste => JSON.stringify(liste.map(o => ({ shape: o.shape, mat: o.mat, fx: o.fx, alpha: o.alpha,
  overlay: o.overlay, emissive: o.emissive, p: Array.from(o.p), s: Array.from(o.s), r: Array.from(o.r), color: Array.from(o.color) })));
const pneus = o => /^bitume-(pneu-|matiere-pneu-|fond-sculpture-|bague-pneu-)/.test(o.shape);
const vues = [
  ['complet', (m, ev, r, n) => V.poser(m, ev, r, { rouesDetail: n })],
  ['moyen', (m, ev, r, n) => V.poser(m, ev, r, { detail: 'moyen', rouesDetail: n })],
  ['simple', (m, ev, r, n) => V.poser(m, ev, r, { detail: 'simple', rouesDetail: n })],
  ['cockpit', (m, ev, r, n) => V.cockpit(m, ev, r, { regime: 9000, rapport: 3, rouesDetail: n })],
  ['glaces', (m, ev, r, n) => V.poserRetro(m, ev, r, { rouesDetail: n })],
  ['epave', (m, ev, r, n) => V.poser(m, ev, r, { casse: true, rouesDetail: n })],
  ['cockpit-epave', (m, ev, r, n) => V.cockpit(m, ev, r, { casse: true, regime: 0, rapport: 0, rouesDetail: n })],
  ['glaces-epave', (m, ev, r, n) => V.poserRetro(m, ev, r, { casse: true, rouesDetail: n })],
  ['roues-detachees', (m, ev, r, n) => V.poser(m, ev, r, { roues: [true, false, false, true], rouesDetail: n })]
];
function dessiner(mod, ev = pose, niveau = 0, vue = vues[0]) { const out = []; vue[1](mod, ev, out, niveau); return out; }
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok ' + nom); }

verifier('préparer les quatre montes conserve exactement les images neuves et usées de chaque vue', () => {
  for (const type of P.TYPES) {
    const mod = V.modele(livree(type)), avant = [];
    for (const ev of [pose, use]) for (const vue of vues) for (let n = 0; n < 4; n++) avant.push(resume(dessiner(mod, ev, n, vue)));
    const listes = [mod.corps, mod.simples, mod.moyens, mod.epave], habitacle = mod.objetsRendu.habitacle;
    assert.equal(V.preparerPneusService(mod), true);
    let i = 0;
    for (const ev of [pose, use]) for (const vue of vues) for (let n = 0; n < 4; n++)
      assert.equal(resume(dessiner(mod, ev, n, vue)), avant[i++], type + '/' + vue[0] + '/' + n);
    assert.deepEqual([mod.corps, mod.simples, mod.moyens, mod.epave].map((l, j) => l === listes[j]), [true, true, true, true]);
    assert.equal(mod.objetsRendu.habitacle, habitacle);
    const plan = mod.objetsRendu.pneusService;
    assert.equal(V.preparerPneusService(mod), true); assert.equal(mod.objetsRendu.pneusService, plan);
  }
});

verifier('toutes les transitions retrouvent le rendu natif du nouveau type aux quatre détails, avec et sans usure', () => {
  const natifs = Object.fromEntries(P.TYPES.map(type => [type, V.modele(livree(type))]));
  for (const initial of P.TYPES) {
    const mod = V.modele(livree(initial)); V.preparerPneusService(mod);
    for (const type of [...P.TYPES, initial]) {
      assert.equal(V.changerPneus(mod, type), true);
      for (const ev of [pose, use]) for (const vue of vues) for (let n = 0; n < 4; n++)
        assert.equal(resume(dessiner(mod, ev, n, vue)), resume(dessiner(natifs[type], ev, n, vue)), initial + ' -> ' + type + '/' + vue[0] + '/' + n);
    }
  }
  assert.deepEqual(etats, etatsAvant, 'les vues et les changements ne modifient pas la simulation des roues');
});

verifier('modèle, pièces hors pneus, tables et objets permanents restent les mêmes pendant les bascules', () => {
  const mod = V.modele(livree('slicks')); V.preparerPneusService(mod);
  const e = mod.objetsRendu, tables = [...e.tables, ...e.retro], objets = tables.map(t => t.objets.slice());
  const listes = [mod.corps, mod.simples, mod.epave, mod.moyens], autres = mod.corps.filter(p => !p.usureRoue && p.pneus === undefined);
  const valeurs = JSON.stringify(autres), empreintes = vues.map(vue => resume(dessiner(mod, use, 0, vue).filter(o => !pneus(o))));
  for (const liste of listes) Object.freeze(liste);
  Object.freeze(e.tables); Object.freeze(e.retro);
  for (const t of tables) Object.freeze(t.objets);
  for (const type of ['neige', 'pluie', 'inter', 'slicks', 'neige']) {
    assert.equal(V.changerPneus(mod, type), true);
    for (let i = 0; i < vues.length; i++) assert.equal(resume(dessiner(mod, use, 0, vues[i]).filter(o => !pneus(o))), empreintes[i]);
    assert.equal(JSON.stringify(autres), valeurs);
    for (let i = 0; i < tables.length; i++) {
      assert.equal((i < 16 ? e.tables : e.retro)[i < 16 ? i : i - 16], tables[i]);
      assert.equal(tables[i].objets.length, objets[i].length);
      for (let j = 0; j < objets[i].length; j++) assert.equal(tables[i].objets[j], objets[i][j]);
    }
    for (let i = 0; i < 4; i++) assert.equal([mod.corps, mod.simples, mod.epave, mod.moyens][i], listes[i]);
  }
});

verifier('géométrie et couleurs globales ainsi que les autres voitures restent inchangées', () => {
  const couleurs = P.TYPES.map(type => [...P.CATALOGUE[type].cercle]);
  const formes = Object.values(V.FORMES).map(f => [f, f.taille.slice(), f.centre.slice(), f.tri, f.triangles]);
  const partagee = livree('pluie'), mod = V.modele(partagee), autre = V.modele(partagee);
  V.preparerPneusService(mod); V.preparerPneusService(autre);
  const avant = resume(dessiner(autre, use)), livreeAvant = structuredClone(partagee);
  for (const type of P.TYPES) { V.changerPneus(mod, type); dessiner(mod, use); }
  assert.equal(resume(dessiner(autre, use)), avant); assert.deepEqual(partagee, livreeAvant);
  for (const [f, taille, centre, tri, triangles] of formes) {
    assert.deepEqual(f.taille, taille); assert.deepEqual(f.centre, centre); assert.equal(f.tri, tri); assert.equal(f.triangles, triangles);
  }
  assert.deepEqual(P.TYPES.map(type => [...P.CATALOGUE[type].cercle]), couleurs);
});

verifier('modèle non préparé et types invalides sont refusés sans reconstruction ni changement', () => {
  const mod = V.modele(livree('pluie')), avant = resume(dessiner(mod, use)), e = mod.objetsRendu;
  assert.equal(V.changerPneus(mod, 'neige'), false); assert.equal(e.pneusService, undefined);
  assert.equal(resume(dessiner(mod, use)), avant);
  V.preparerPneusService(mod);
  for (const type of ['constructor', '__proto__', 'toString', '', 'inconnu', null, undefined, 3, {}]) {
    assert.equal(V.changerPneus(mod, type), false); assert.equal(resume(dessiner(mod, use)), avant);
  }
  assert.equal(V.preparerPneusService(null), false); assert.equal(V.changerPneus(null, 'pluie'), false);
  assert.equal(V.changerPneus(mod, 'pluie'), true); assert.equal(resume(dessiner(mod, use)), avant);
});

verifier('une demande au stand ne change pas l’image avant la fin effective du service', () => {
  const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const co = B.course.creer(c, { mode: 'course', rivaux: 0, graine: 734 }), v = co.joueur, e = v.etat, dt = 1 / 120;
  co.phase = 'course'; co.feux.vert = true; co.temps = 20; v.livree.pneus = e.pneus;
  const mod = V.modele(v.livree); V.preparerPneusService(mod);
  const avant = resume(dessiner(mod));
  assert.equal(B.course.demanderPneus(co, v, 'neige'), true);
  V.changerPneus(mod, e.pneus); assert.equal(resume(dessiner(mod)), avant);
  Object.assign(e, { s: (c.stands.garage0 + c.stands.garage1) / 2, d: c.stands.d, v: 0 });
  B.course.stands(co, v, dt, []); B.course.stands(co, v, dt, []); assert.equal(e.stands.phase, 'service');
  while (e.stands.t + dt < e.stands.duree) B.course.stands(co, v, dt, []);
  V.changerPneus(mod, e.pneus); assert.equal(resume(dessiner(mod)), avant);
  B.course.stands(co, v, dt, []); assert.equal(e.stands.phase, 'sortie'); assert.equal(e.pneus, 'neige');
  assert.equal(V.changerPneus(mod, e.pneus), true); assert.notEqual(resume(dessiner(mod)), avant);
  assert.equal(resume(dessiner(mod)), resume(dessiner(V.modele({ ...v.livree, pneus: 'neige' }))));
});

console.log(controles + ' contrôles changement visuel des pneus réussis');
