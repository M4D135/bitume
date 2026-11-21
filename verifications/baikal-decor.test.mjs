// 13B — le paysage boréal est réel, indépendant du palier, sans modifier la route 0.2.59/p14.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const n of ['circuit', 'carene', 'botanique', 'ecologie', 'saisons', 'vegetation', 'bords', 'decor', 'obstacles', 'solides-physx', 'animaux']) require('../src/' + n + '.js');
const B = globalThis.BITUME;
const c = B.circuit.creer(179, { theme: 'baikal', longueur: 5400, nom: 'Baïkal' });
B.bords.limites(c, B.bords.planifier(c));
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const construire = (saison = 'ete', qualite = 'low', vegetation = false) => B.decor.construire(c, { qualite, saison, vegetation });
const ete = construire(), hiver = construire('hiver'), automne = construire('automne'), printemps = construire('printemps');
const fine = construire('ete', 'high', true);
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function geometrie(nappes) {
  const h = createHash('sha256');
  for (const n of nappes) {
    const a = [];
    for (let i = 0; i < n.sommets.length; i += 13) for (let j = 0; j < 6; j++) a.push(n.sommets[i + j]);
    h.update(Buffer.from(new Float32Array(a).buffer)); h.update(Buffer.from(n.indices.buffer));
    if (n.surfacesPhysX) h.update(Buffer.from(n.surfacesPhysX.buffer));
  }
  return h.digest('hex');
}
const objets = d => (d.lotsHerbier || d.lots).flatMap(l => l.objets);
const arbres = d => objets(d).filter(o => o.collision === 'tronc');
const axe = (x, z) => { let d = Infinity; for (let i = 0; i < c.n; i++) d = Math.min(d, Math.hypot(x - c.x[i], z - c.z[i])); return d; };
const mesures = {};

verifier('piste et accotements : géométrie physique 0.2.59 conservée bit à bit', () => {
  // Mesuré avant 13B sur la 0.2.59 : XYZ, normales, indices et surfaces PhysX, sans couleurs saisonnières.
  const attendu = '40d9e32cae50bd6f735b980253755fd55e42ddab1a1f92b785f5c30326868a23';
  for (const d of [ete, hiver, automne, printemps, fine]) assert.equal(geometrie(d.nappes.filter(n => n.surfaceType === 'accotement')), attendu);
  assert.equal(c.longueur, 5424); assert.equal(c.graine, 179); assert.equal(c.theme, 'baikal');
});

verifier('lac sous la piste, côte irrégulière et promontoire modelés dans le terrain', () => {
  assert.ok(Number.isFinite(ete.niveauEau));
  for (const y of c.y) assert.ok(y - ete.niveauEau >= 7.9);
  const eau = ete.nappes.filter(n => n.surfaceType === 'eau'); assert.equal(eau.length, 1);
  assert.equal(eau[0].indices.length, 6);
  for (let k = 0; k < eau[0].sommets.length; k += 13) { assert.equal(eau[0].sommets[k + 1], ete.niveauEau); assert.equal(eau[0].sommets[k + 9], 12); }
  let roche = 0, total = 0, sousEau = 0, min = Infinity, max = -Infinity;
  for (const n of ete.nappes) if (n.surfaceType === 'terrain') for (let k = 0; k < n.sommets.length; k += 13) {
    const y = n.sommets[k + 1]; total++; if (n.sommets[k + 9] === 9) roche++; if (y < ete.niveauEau) sousEau++;
    min = Math.min(min, y); max = Math.max(max, y);
    for (let j = 0; j < 13; j++) assert.ok(Number.isFinite(n.sommets[k + j]));
  }
  assert.ok(sousEau / total > .12 && sousEau / total < .45, 'un grand plan d’eau et une terre majoritaire');
  assert.ok(roche > 500 && max - min > 110, 'relief et berges lisibles');
  assert.equal(ete.baikal.lieux.length, 3); assert.ok(ete.baikal.lieux[0].y > ete.niveauEau + 45);
  for (const l of ete.baikal.lieux) assert.ok(axe(l.x, l.z) > 50);
  mesures.terrain = { sommets: total, roche, immerges: sousEau, min, max };
});

verifier('physique : aucun triangle du lac transmis au moteur de collision', () => {
  c.obstacles = B.obstacles.creer(ete.obstacles);
  const w = { next: 1, objets: new Map(), addBox(pos, half, options) { const id = this.next++; this.objets.set(id, { pos, half, options }); return id; },
    addTriangleMesh(vertices, indices, options) { const id = this.next++; this.objets.set(id, { vertices, indices, options }); return id; }, remove(id) { this.objets.delete(id); } };
  const m = B.solidesPhysX.installer(w, c, ete);
  assert.equal(m.statistiques.trianglesEauIgnores, 2);
  for (const a of m.acteurs.values()) if (a.source === 'nappe') assert.notEqual(ete.nappes[a.index].surfaceType, 'eau');
  assert.ok(m.statistiques.trianglesSol > 10000);
  B.solidesPhysX.liberer(m); assert.equal(w.objets.size, 0);
});

verifier('saisons et paliers : mêmes reliefs, racines et solides', () => {
  const g = geometrie(ete.nappes), obs = hash(ete.obstacles), racines = hash(ete.arbres);
  for (const d of [hiver, automne, printemps, fine]) {
    assert.equal(geometrie(d.nappes), g); assert.equal(hash(d.obstacles), obs); assert.equal(hash(d.arbres), racines);
    assert.deepEqual(d.baikal.maisons, ete.baikal.maisons); assert.equal(d.niveauEau, ete.niveauEau);
  }
});

verifier('forêt mixte : troncs clairs, conifères verts et feuilles dorées séparées', () => {
  const ts = arbres(ete), caducs = ts.filter(o => o.essenceBaikal === 'feuillu'), aiguilles = ts.filter(o => o.essenceBaikal === 'conifere');
  assert.ok(caducs.length > 80 && aiguilles.length > caducs.length && ts.length < 1200);
  for (const o of caducs) assert.ok(o.color.every(v => v > .6));
  for (const p of ete.arbres) assert.ok(axe(p[0], p[1]) >= 29.9);
  assert.equal(automne.sourcesFeuilles.length, caducs.length);
  assert.equal(ete.sourcesFeuilles.length, 0); assert.equal(hiver.sourcesFeuilles.length, 0);
  const leaves = d => objets(d).filter(o => o.essenceBaikal && !o.collision);
  const a = leaves(automne), e = leaves(ete); assert.equal(a.length, e.length);
  let oranges = 0, verts = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i].essenceBaikal === 'feuillu') { if (a[i].color[0] > a[i].color[1]) oranges++; }
    else { if (a[i].color[1] > a[i].color[0] * 1.4) verts++; }
  }
  assert.ok(oranges > 100 && verts > 100);
  mesures.arbres = { feuillus: caducs.length, coniferes: aiguilles.length, sourcesFeuilles: automne.sourcesFeuilles.length };
});

verifier('hameaux : fondations enterrées, maisons hors piste et silhouettes présentes au loin', () => {
  assert.ok(ete.baikal.maisons.length >= 4 && ete.baikal.maisons.length <= 8);
  for (const m of ete.baikal.maisons) {
    assert.ok(axe(m.x, m.z) > 80); assert.ok(m.sol > m.bas && m.sol - m.bas < 4);
    for (const [x, z] of ete.arbres) assert.ok(Math.hypot(m.x - x, m.z - z) >= 18);
  }
  const proches = objets(ete).filter(o => o.lieu === 'hameau-baikal');
  const lointains = (ete.lotsHerbier || ete.lots).flatMap(l => l.loin).filter(o => o.lieu === 'hameau-baikal');
  assert.equal(proches.length, lointains.length);
  assert.deepEqual(proches, lointains);
  assert.equal(proches.filter(o => o.collision === 'toit').length, ete.baikal.maisons.length * 2);
  assert.ok(hiver.lots.some(l => l.objets.some(o => o.lieu === 'hameau-baikal' && o.collision === 'toit' && o.color[0] > .8)));
  mesures.maisons = ete.baikal.maisons.length;
});

verifier('herbe boréale proche et teintes hivernales sur les surfaces sèches', () => {
  assert.ok(fine.vegetation.brinsAccotements > 10000 && fine.vegetation.brinsTerrain > 10000);
  let blancs = 0, candidats = 0;
  for (const n of hiver.nappes) if (n.surfaceType === 'terrain') for (let k = 0; k < n.sommets.length; k += 13) {
    if (n.sommets[k + 1] <= hiver.niveauEau + 1 || n.sommets[k + 4] < .65) continue;
    candidats++; if (n.sommets[k + 10] > .8 && n.sommets[k + 11] > .8 && n.sommets[k + 12] > .8) blancs++;
  }
  assert.ok(blancs / candidats > .90);
  mesures.vegetation = { brins: fine.vegetation.brins, tuiles: fine.vegetation.tuiles, neige: blancs / candidats };
});

verifier('faune : profil boréal propre, habitats réels et trajectoires hors piste', () => {
  const A = B.animaux, ancien = Math.random;
  let etat;
  try { Math.random = () => { throw new Error('hasard partagé'); }; etat = A.creer(c, ete, { saison: 'ete' }); }
  finally { Math.random = ancien; }
  assert.equal(etat.theme, 'baikal'); assert.deepEqual(A.BIOMES.baikal, ['cerf', 'sanglier', 'aigle', 'oie']);
  assert.equal(etat.absentes.length, 0, JSON.stringify(etat.absentes));
  // La population dort sans vue utile. Observer tout le tracé pour conserver ici
  // les 90 secondes de locomotion et de fuite, y compris les habitats hors écran joueur.
  const centreX = (Math.min(...c.x) + Math.max(...c.x)) / 2, centreZ = (Math.min(...c.z) + Math.max(...c.z)) / 2;
  A.selectionnerVues(etat, [{ qualite: 'ultra', camera: { pos: [centreX, 2500, centreZ], yaw: 0, pitch: -Math.PI / 2, fov: 150 },
    aspect: 2, hauteur: 720, portee: 12000 }]);
  const positionsInitiales = etat.cour.slice();
  const voit = Array.from({ length: 12 }, () => ({ x: 0, y: 0, z: 0 }));
  let marge = Infinity, margeBord = Infinity;
  for (let k = 0; k <= 120 * 90; k++) {
    for (let j = 0; j < voit.length; j++) { const i = Math.floor(((k / 120 * 55 + j * 40) % c.longueur) / c.pas) % c.n; voit[j].x = c.x[i]; voit[j].z = c.z[i]; }
    A.pas(etat, k / 120, voit);
    if (k % 120) continue;
    for (let i = 0; i < etat.nAnimaux; i++) {
      const x = etat.cour[i * 17], z = etat.cour[i * 17 + 1];
      let d = Infinity, limite = 0;
      for (let j = 0; j < c.n; j++) {
        const distance = Math.hypot(x - c.x[j], z - c.z[j]);
        if (distance < d) { d = distance; limite = Math.max(c.limiteG[j], c.limiteD[j]); }
      }
      marge = Math.min(marge, d); margeBord = Math.min(margeBord, d - limite);
      // La demande du 21/11 remplace les 34 m uniformes par une garde depuis le bord réel.
      assert.ok(d >= limite + 4, 'animal hors de la route et de son dégagement réel, avec garde de 4 m');
      assert.ok(A.solExact(etat.G.T, x, z) > ete.niveauEau);
    }
  }
  assert.equal(A.stats(etat).activite.groupesActifs, etat.groupes.length);
  assert.notDeepEqual(etat.cour, positionsInitiales, 'le contrôle de trajectoire doit réellement simuler la population');
  assert.ok(A.stats(etat).activite.pasGroupes > 0);
  const hiverAnimaux = A.creer(c, hiver, { saison: 'hiver' });
  assert.ok(hiverAnimaux.absentes.some(e => e.cle === 'oie' && e.raison === 'saison'));
  mesures.faune = { especes: etat.especes, animaux: etat.nAnimaux, margeMinimum: marge, margeMinimumBord: margeBord };
});

console.log(JSON.stringify({ controles, mesures }));
console.log(controles + '/' + controles + ' contrôles 13B réussis');
