// Géométrie, coût borné et invariants du biome pilote. Les références historiques restent séparées.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
for (const nom of ['circuit', 'carene', 'vegetation', 'decor']) require('../src/' + nom + '.js');
const B = globalThis.BITUME, V = B.vegetation;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const sous = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function distanceSegment2(p, a, b) {
  const ab = sous(b, a), ap = sous(p, a), t = Math.max(0, Math.min(1, dot(ap, ab) / dot(ab, ab)));
  return ap.reduce((s, v, i) => s + (v - ab[i] * t) ** 2, 0);
}
function distanceTriangle2(p, t) {
  const [a, b, c] = t, ab = sous(b, a), ac = sous(c, a), ap = sous(p, a);
  const aa = dot(ab, ab), bb = dot(ac, ac), xy = dot(ab, ac), px = dot(ap, ab), py = dot(ap, ac), det = aa * bb - xy * xy;
  const v = (bb * px - xy * py) / det, w = (aa * py - xy * px) / det;
  if (v >= 0 && w >= 0 && v + w <= 1) {
    const n = croix(ab, ac), d = dot(ap, n); return d * d / dot(n, n);
  }
  return Math.min(distanceSegment2(p, a, b), distanceSegment2(p, b, c), distanceSegment2(p, c, a));
}
// Index des échantillons de l'axe, même maille que decor.js : le test juge l'accotement comme le décor.
function indexAxe(c) {
  const T = 40;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < c.n; i++) {
    const x = Math.floor(c.x[i] / T), z = Math.floor(c.z[i] / T);
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const nz = z1 - z0 + 1, cases = new Array((x1 - x0 + 1) * nz);
  for (let i = 0; i < c.n; i++) {
    const k = (Math.floor(c.x[i] / T) - x0) * nz + Math.floor(c.z[i] / T) - z0;
    let l = cases[k]; if (!l) cases[k] = l = []; l.push(i);
  }
  return (x, z, rayon) => {
    const cx = Math.floor(x / T), cz = Math.floor(z / T), r = Math.ceil(rayon / T);
    let meilleur = -1, d2min = Infinity;
    const amin = Math.max(cx - r, x0), amax = Math.min(cx + r, x1);
    const bmin = Math.max(cz - r, z0), bmax = Math.min(cz + r, z1);
    for (let a = amin; a <= amax; a++) for (let b = bmin; b <= bmax; b++) {
      const l = cases[(a - x0) * nz + b - z0]; if (!l) continue;
      for (const i of l) {
        const dx = c.x[i] - x, dz = c.z[i] - z, d2 = dx * dx + dz * dz;
        if (d2 < d2min) { d2min = d2; meilleur = i; }
      }
    }
    return { i: meilleur, d: Math.sqrt(d2min) };
  };
}
// Empreinte stable des lots : les flottants sont arrondis au micron, seul le placement compte.
function empreinte(o) {
  const s = JSON.stringify(o, (k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const famillesDe = r => [...new Set(r.lots.flatMap(l => l.objets.map(o => o.shape.replace(/-val(-loin)?$/, '').replace(/^prairie$/, 'herbes'))))].sort();
const matieresDe = r => [...new Set(r.lots.flatMap(l => l.objets.map(o => o.mat)))].sort((a, b) => a - b);
const PISTES = [[11, 'foret', 4200], [29, 'cote', 3600], [47, 'montagne', 5200]];
const construire = (c, qualite) => V.construire(c, { limites: B.decor.limites(c), interroger: indexAxe(c), qualite });

verifier('quatre formes réutilisées, au plus 800 triangles au registre', () => {
  assert.equal(Object.keys(V.FORMES).length, V.BUDGET.formes);
  assert.ok(Object.values(V.FORMES).reduce((n, t) => n + t.length, 0) <= 800);
  const enregistrees = new Map();
  assert.equal(V.installer({ forme: (nom, triangles) => enregistrees.set(nom, triangles) }), true);
  assert.equal(enregistrees.size, 4);
  assert.equal(V.installer(null), false);
});
verifier('triangles finis, orientés, non dégénérés et tenus dans le cube des instances', () => {
  for (const [nom, tri] of Object.entries(Object.assign({}, V.FORMES, V.FORMES_AJOUT))) for (const t of tri) {
    assert.equal(t.length, 6);
    for (let i = 0; i < 6; i++) for (const n of t[i]) assert.ok(Number.isFinite(n), nom);
    for (let i = 0; i < 3; i++) for (const n of t[i]) assert.ok(Math.abs(n) <= .50000001, nom);
    const n = croix(sous(t[1], t[0]), sous(t[2], t[0])), aire = Math.hypot(...n);
    assert.ok(aire > 1e-10, nom);
    for (let i = 3; i < 6; i++) {
      assert.ok(Math.abs(Math.hypot(...t[i]) - 1) < 1e-10, nom);
      assert.ok(dot(n, t[i]) / aire > .999999, nom);
    }
  }
});
const erreursLod = {};
verifier('LOD vraiment simplifié ; détail retiré sous 0,4 pixel à la distance de référence', () => {
  // Échantillons de la surface proche (sommets, milieux d'arêtes, centres des triangles), comparés aux vrais
  // triangles lointains. C'est une borne observée sur ces échantillons, pas un verdict sur une vidéo.
  for (const famille of ['herbes', 'taillis', 'fougeres', 'fleurs', 'humus']) {
    const proche = V.forme(famille + '-val'), loin = V.forme(famille + '-val-loin');
    assert.ok(proche && loin, famille);
    assert.ok(loin.length < proche.length * .5, famille);
    let distance2 = 0;
    for (const t of proche) {
      const points = t.slice(0, 3).concat([0, 1, 2].map(i => t[i].map((v, k) => (v + t[(i + 1) % 3][k]) / 2)), [t[0].map((v, k) => (v + t[1][k] + t[2][k]) / 3)]);
      for (const p of points) {
        let meilleure = Infinity;
        for (const f of loin) meilleure = Math.min(meilleure, distanceTriangle2(p, f));
        distance2 = Math.max(distance2, meilleure);
      }
    }
    const metres = Math.sqrt(distance2) * 1.55, pixels = metres * (1080 / (2 * Math.tan(Math.PI / 6))) / 520;
    erreursLod[famille] = { metres, pixels };
    assert.ok(pixels < .4, `${famille}: ${pixels.toFixed(3)} px`);
  }
});
verifier('96 brins fins couvrent la tuile ; la simplification conserve exactement sa surface et chaque racine', () => {
  const proche = V.forme('prairie-val'), loin = V.forme('prairie-val-loin');
  assert.equal(proche.length, 96 * 6); assert.equal(loin.length, 96 * 2);
  const racines = [], quadrants = [0, 0, 0, 0];
  let erreur = 0;
  for (let i = 0; i < 96; i++) {
    const t = loin[i * 2], [a, b, c] = t;
    assert.equal(a[1], -.5); assert.equal(b[1], -.5); assert.ok(c[1] > .05);
    const pied = a.map((v, k) => (v + b[k]) / 2);
    racines.push(pied); quadrants[(pied[0] > 0 ? 1 : 0) + (pied[2] > 0 ? 2 : 0)]++;
    for (const p of proche.slice(i * 6, i * 6 + 6).flatMap(f => f.slice(0, 3))) erreur = Math.max(erreur, distanceTriangle2(p, t));
    assert.deepEqual(proche[i * 6][0], a); assert.deepEqual(proche[i * 6][1], b);
    assert.deepEqual(proche[i * 6 + 4][2], c);
    for (const f of proche.slice(i * 6, i * 6 + 6)) assert.ok(Math.abs(dot(f[3], t[3])) > .99999999);
  }
  assert.ok(erreur < 1e-20, 'surface proche exactement contenue dans le triangle lointain');
  assert.ok(quadrants.every(n => n >= 18), `répartition dans toute la tuile : ${quadrants}`);
  assert.equal(new Set(racines.map(p => p[0])).size, 96, 'aucune rangée de racines sur x');
  assert.equal(new Set(racines.map(p => p[2])).size, 96, 'aucune rangée de racines sur z');
  assert.ok(Math.max(...racines.map(p => p[0])) - Math.min(...racines.map(p => p[0])) > .85);
  assert.ok(Math.max(...racines.map(p => p[2])) - Math.min(...racines.map(p => p[2])) > .85);
  erreursLod.prairie = { metresAuRepos: Math.sqrt(erreur), trianglesParBrin: { proche: 6, loin: 2 } };
});
const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
const avant = B.decor.construire(c, { matieres: false, vegetation: false });
const apres = B.decor.construire(c), lots = apres.lots.filter(l => l.vegetation);
// decor.js transmet le palier demandé ; sans palier nommé, il tient le profil historique, 'low'.
const defaut = V.PALIERS.low;
verifier('Val-Brûlé reçoit un nombre borné de plantes et deux groupes au plus par lot', () => {
  assert.ok(apres.vegetation.herbes > 60 && apres.vegetation.herbes <= defaut.stations * defaut.herbes);
  assert.ok(apres.vegetation.taillis > 10 && apres.vegetation.taillis <= defaut.stations);
  assert.ok(lots.length > 0 && lots.length <= Math.ceil(c.longueur / 420));
  let proches = 0, lointains = 0;
  for (const l of lots) {
    assert.ok(new Set(l.objets.map(o => o.shape)).size <= defaut.groupes);
    assert.ok(new Set(l.loin.map(o => o.shape)).size <= defaut.groupes);
    assert.equal(l.objets.length, l.loin.length, 'aucune plante supprimée au loin');
    assert.equal(l.portee, Infinity);
    assert.equal(l.lodReferenceFov, 60); assert.equal(l.lodReferenceHeight, 1080);
    for (let i = 0; i < l.objets.length; i++) {
      const a = l.objets[i], b = l.loin[i];
      proches += V.forme(a.shape).length; lointains += V.forme(b.shape).length;
      assert.deepEqual(a.p, b.p); assert.deepEqual(a.s, b.s); assert.deepEqual(a.r, b.r); assert.deepEqual(a.color, b.color);
      assert.ok(Math.hypot(...sous(a.p, l.centre)) + Math.hypot(...a.s) / 2 + .249999 <= l.rayon, 'vent compris dans le culling');
      assert.equal(a.collision, undefined);
    }
  }
  assert.ok(proches < 220000 && lointains < proches * .5, `${proches}/${lointains}`);
});
verifier('aucun obstacle, arbre ou objet historique déplacé ou retiré', () => {
  assert.deepEqual(apres.obstacles, avant.obstacles);
  assert.deepEqual(apres.arbres, avant.arbres);
  const anciensLots = apres.lots.filter(l => !l.vegetation);
  assert.equal(anciensLots.length, avant.lots.length);
  const sansMatiere = objet => { const { mat, ...reste } = objet; return reste; };
  for (let i = 0; i < avant.lots.length; i++) for (const cle of ['objets', 'loin'])
    assert.deepEqual(anciensLots[i][cle].map(sansMatiere), avant.lots[i][cle].map(sansMatiere));
});
verifier('nouvel asphalte seul, géométrie de chaussée et marquages inchangés', () => {
  let asphalte = 0, marquages = 0;
  assert.equal(avant.nappes.length, apres.nappes.length);
  for (let i = 0; i < avant.nappes.length; i++) {
    const a = avant.nappes[i], b = apres.nappes[i];
    assert.deepEqual(a.indices, b.indices); assert.equal(a.sommets.length, b.sommets.length);
    for (let k = 0; k < a.sommets.length; k++) {
      if (k % 13 !== 9) { assert.equal(a.sommets[k], b.sommets[k]); continue; }
      if (a.sommets[k] === 14 && a.sommets[k + 1] < .3 && a.sommets[k + 2] < .3) { assert.equal(b.sommets[k], 21); asphalte++; }
      else { assert.equal(b.sommets[k], a.sommets[k]); if (a.sommets[k] === 14) marquages++; }
    }
  }
  assert.ok(asphalte > 100 && marquages > 100);
  assert.ok(apres.lots.some(l => l.objets.some(o => o.mat === 22)), 'béton pilote utilisé');
  assert.ok(apres.lots.some(l => l.objets.some(o => o.mat === 24 && o.collision === 'toit')), 'tôle peinte du stand');
  assert.ok(apres.lots.some(l => l.objets.some(o => o.mat === 0 && o.detail === 1)), 'métal nu des glissières conservé');
});
verifier('plantes à l’écart de la chaussée, des stands et des glissières', () => {
  for (const l of lots) for (const o of l.objets) {
    let distance2 = Infinity, indice = -1;
    for (let i = 0; i < c.n; i++) {
      const d = (o.p[0] - c.x[i]) ** 2 + (o.p[2] - c.z[i]) ** 2;
      if (d < distance2) { distance2 = d; indice = i; }
    }
    const marge = Math.hypot(o.s[0], o.s[2]) / 2;
    assert.ok(Math.sqrt(distance2) >= c.largeur / 2 + 1.2 + marge);
    assert.ok(Math.abs(B.circuit.ecart(c, 0, indice * c.pas)) >= 350);
  }
});
verifier('répartition déterministe et indépendante des autres générateurs', () => {
  const autre = B.decor.construire(c);
  assert.deepEqual(autre.lots.filter(l => l.vegetation), lots);
  assert.deepEqual(autre.vegetation, apres.vegetation);
  assert.equal(B.decor.construire(c, { vegetation: false }).vegetation, undefined);
});
verifier('Port-Sable et Haut-Col : la végétation est purement additive, le décor historique est intact', () => {
  for (const [graine, theme, longueur] of [[29, 'cote', 3600], [47, 'montagne', 5200]]) {
    const piste = B.circuit.creer(graine, { theme, longueur });
    const a = B.decor.construire(piste), b = B.decor.construire(piste, { matieres: false, vegetation: false });
    // Les fonctions de hauteur sont reconstruites à chaque appel ; comparer toutes les données, sans ces fonctions.
    // Les massifs et leur compteur sont seuls ajoutés : on les retire de `a` avant de comparer.
    const ajoute = a.vegetation;
    assert.ok(ajoute && ajoute.lots > 0, theme + ' : le biome ne reçoit aucune végétation');
    const sansAjout = Object.assign({}, a, { lots: a.lots.filter(l => !l.vegetation) });
    delete sansAjout.vegetation;
    assert.equal(JSON.stringify(sansAjout), JSON.stringify(b));
  }
});

// ------------------------------------------------------------------ paliers de qualité
// Référence du palier bas, relevée sur le module avant l'extension (graine 11, forêt 4 200 m, même index d'axe).
const REFERENCE_BAS = { herbes: 124, taillis: 34, lots: 10, empreinte: '46d7307a' };
verifier('le palier bas reproduit exactement l\'existant : formes, comptes, placement et matière', () => {
  const bas = construire(c, 'low');
  assert.equal(bas.qualite, 'low');
  assert.equal(bas.herbes, REFERENCE_BAS.herbes);
  assert.equal(bas.taillis, REFERENCE_BAS.taillis);
  assert.equal(bas.fougeres, 0);
  assert.equal(bas.fleurs, 0);
  assert.equal(bas.lots.length, REFERENCE_BAS.lots);
  assert.equal(empreinte(bas.lots), REFERENCE_BAS.empreinte, 'aucune plante déplacée ni changée au palier bas');
  assert.deepEqual(famillesDe(bas), ['herbes', 'taillis']);
  assert.deepEqual(matieresDe(bas), [11], 'le palier bas garde sa matière de base');
  assert.deepEqual(V.JEU_FORMES.low, Object.keys(V.FORMES));
  const registre = new Map();
  assert.equal(V.installer({ forme: (nom, t) => registre.set(nom, t) }, 'low'), true);
  assert.equal(registre.size, 4);
  assert.equal(bas.lots.reduce((n, l) => n + l.objets.length, 0), bas.herbes + bas.taillis);
  let triangles = 0;
  for (const l of bas.lots) for (const o of l.objets) triangles += V.forme(o.shape).length;
  assert.ok(triangles < 60000, `${triangles} triangles au palier bas`);
});
verifier('qualite optionnelle : une valeur inconnue retrouve le palier historique', () => {
  // Le palier haut est une demande explicite. Une valeur absente, nulle, « auto » ou inconnue ne peut pas,
  // par accident, multiplier le coût du décor : elle retrouve le profil d'avant le chantier.
  const bas = construire(c, 'low');
  assert.equal(V.construire(c, { limites: B.decor.limites(c), interroger: indexAxe(c) }).qualite, 'low');
  const haut = construire(c, 'high'), auto = construire(c, 'auto'), inconnue = construire(c, 'inconnue');
  assert.deepEqual(auto.lots, bas.lots);
  assert.deepEqual(inconnue.lots, bas.lots);
  assert.equal(V.construire(c, { limites: B.decor.limites(c), interroger: indexAxe(c), qualite: null }).qualite, 'low');
  const moyen = construire(c, 'medium');
  assert.ok(moyen.herbes > bas.herbes && moyen.herbes < haut.herbes, 'medium entre bas et haut');
  assert.ok(moyen.fougeres > 0 && moyen.fleurs === 0, 'medium ajoute les fougères, pas les fleurs');
  assert.ok(haut.fleurs > 0, 'haut ajoute les fleurs');
  const registre = new Map();
  V.installer({ forme: (nom, t) => registre.set(nom, t) }, 'high');
  assert.equal(registre.size, Object.keys(V.FORMES).length + Object.keys(V.FORMES_AJOUT).length);
  const registre2 = new Map();
  V.installer({ forme: (nom, t) => registre2.set(nom, t) }, 'auto');
  assert.equal(registre2.size, registre.size, 'auto enregistre autant que high');
});
verifier('les trois paliers donnent des budgets vraiment distincts, biome par biome', () => {
  for (const [graine, theme, longueur] of PISTES) {
    const piste = B.circuit.creer(graine, { theme, longueur });
    const r = {};
    for (const qualite of ['low', 'medium', 'high']) r[qualite] = construire(piste, qualite);
    const cle = x => [x.herbes, x.fougeres, x.fleurs, x.taillis, x.lots.length,
      x.lots.reduce((n, l) => n + l.objets.length, 0)].join('|');
    assert.notEqual(cle(r.low), cle(r.medium), theme);
    assert.notEqual(cle(r.medium), cle(r.high), theme);
    assert.notEqual(cle(r.low), cle(r.high), theme);
    assert.ok(r.low.herbes < r.medium.herbes && r.medium.herbes < r.high.herbes, `${theme} herbes`);
    assert.ok(r.low.taillis < r.medium.taillis && r.medium.taillis < r.high.taillis, `${theme} taillis`);
    assert.ok(r.low.lots.length <= r.medium.lots.length && r.medium.lots.length <= r.high.lots.length, `${theme} lots`);
    assert.deepEqual(famillesDe(r.low), ['herbes', 'taillis'], `${theme} familles basses`);
    const moyennes = famillesDe(r.medium), hautes = famillesDe(r.high);
    // Les familles s'ajoutent sans jamais retirer les deux familles historiques ; la côte salée ne porte
    // pas de fougère, la montagne pas de fleur : le nombre de familles dépend du biome, pas du seul palier.
    assert.ok(moyennes.length >= 2 && hautes.length >= moyennes.length, `${theme} familles ajoutées`);
    assert.ok(hautes.length >= 3, `${theme} : ${hautes.join(',')}`);
    const autorisees = ['herbes', 'taillis', 'fougeres', 'fleurs', 'humus'];
    for (const f of moyennes.concat(hautes)) assert.ok(autorisees.includes(f), `${theme} ${f}`);
    for (const l of r.high.lots) assert.ok(new Set(l.objets.map(o => o.shape)).size <= V.PALIERS.high.groupes, theme);
  }
});
const REFERENCE_029 = {
  foret: { low: 124, medium: 1123, high: 3866, ultra: 7238 },
  cote: { low: 86, medium: 853, high: 3030, ultra: 5716 },
  montagne: { low: 74, medium: 1079, high: 3684, ultra: 7108 },
};
const densitesMesurees = {};
verifier('au moins dix fois les vrais brins de la 0.2.29, avec moins de deux fois ses instances', () => {
  // Référence figée sur e150378 / BITUME 0.2.29, mêmes graines, même qualité : chaque ancienne touffe
  // contenait neuf brins. Compter la géométrie effectivement présente, pas un compteur déclaré de densité.
  const brinsMassif = V.forme('herbes-val-loin').length / 8;
  const brinsTuile = V.forme('prairie-val-loin').length / 2;
  assert.equal(brinsMassif, 9); assert.equal(brinsTuile, 96);
  for (const [graine, theme, longueur] of PISTES) {
    const piste = B.circuit.creer(graine, { theme, longueur }), r = {};
    for (const q of ['low', 'medium', 'high', 'ultra']) r[q] = construire(piste, q);
    densitesMesurees[theme] = {};
    assert.ok(r.low.herbes < r.medium.herbes, theme);
    assert.ok(r.high.herbes > r.medium.herbes * 2, `${theme} High apporte une vraie couverture`);
    assert.ok(r.ultra.herbes > r.high.herbes * 1.5, `${theme} Ultra est distinct`);
    for (const q of ['medium', 'high', 'ultra']) {
      const p = V.PALIERS[q], stations = Math.round(p.stations * V.BIOMES[theme].stations);
      const objets = r[q].lots.flatMap(l => l.objets).filter(o => o.shape === 'herbes-val' || o.shape === 'prairie-val');
      const tuiles = objets.filter(o => o.shape === 'prairie-val').length;
      const brins = (objets.length - tuiles) * brinsMassif + tuiles * brinsTuile;
      assert.equal(r[q].brins, brins, `${theme} ${q} : vrais brins construits`);
      assert.equal(r[q].brinsTapis, tuiles * brinsTuile);
      assert.equal(r[q].objetsHerbe, objets.length); assert.equal(r[q].tuiles, tuiles);
      assert.ok(brins >= REFERENCE_029[theme][q] * 9 * 10, `${theme} ${q} : ${brins} brins`);
      assert.ok(objets.length < REFERENCE_029[theme][q] * 2, `${theme} ${q} : allocations bornées`);
      assert.ok(r[q].herbes <= stations * p.herbes + V.TAPIS[q].maximum, `${theme} ${q} plafond`);
      assert.ok(tuiles <= V.TAPIS[q].maximum);
      assert.ok(r[q].lots.filter(l => l.tapis).length <= Math.ceil(piste.longueur / V.LOT_TAPIS), `${theme} ${q} lots tapis`);
      assert.ok(r[q].lots.filter(l => !l.tapis).length <= Math.ceil(piste.longueur / 420), `${theme} ${q} lots massifs`);
      for (const l of r[q].lots) assert.ok(new Set(l.objets.map(o => o.shape)).size <= p.groupes);
      for (const l of r[q].lots.filter(l => l.tapis)) {
        assert.equal(new Set(l.objets.map(o => o.shape)).size, 1, 'un dessin instancié par tuile de secteur');
        assert.equal(l.bascule, 60); assert.equal(l.portee, Infinity);
        assert.ok(l.objets.every(o => o.windResponsive === true));
        assert.ok(l.objets.length <= Math.ceil(V.LOT_TAPIS / V.TAPIS[q].pas) * 2 * V.TAPIS[q].rangees + 8);
        for (const o of l.objets) assert.ok(Math.hypot(...sous(o.p, l.centre)) + Math.hypot(...o.s) / 2 + .25 + 1.5 * o.s[1] <= l.rayon + 1e-8, 'souffle compris dans le culling');
      }
      densitesMesurees[theme][q] = { reference029: REFERENCE_029[theme][q] * 9, brins,
        facteur: brins / (REFERENCE_029[theme][q] * 9), instances: objets.length, tuiles, lotsTapis: r[q].lots.filter(l => l.tapis).length };
    }
    assert.deepEqual(famillesDe(r.ultra), famillesDe(r.high), 'Ultra réutilise les maillages High');
    for (const k of ['fougeres', 'fleurs', 'taillis']) assert.equal(r.ultra[k], r.high[k], 'Ultra ajoute des graminées');
    assert.deepEqual(construire(piste, 'ultra'), r.ultra, `${theme} Ultra déterministe`);
  }
});
verifier('le plafonnement des longues pistes répartit les tuiles sur tout le tour', () => {
  const piste = B.circuit.creer(84, { theme: 'foret', longueur: 18000 }), q = indexAxe(piste);
  for (const qualite of ['medium', 'high', 'ultra']) {
    const r = construire(piste, qualite), maximum = V.TAPIS[qualite].maximum, quarts = [0, 0, 0, 0];
    assert.ok(r.tuiles <= maximum, `${qualite} : ${r.tuiles}/${maximum}`);
    assert.ok(r.tuiles > maximum * .75, `${qualite} : le plafond est effectivement exercé`);
    for (const l of r.lots.filter(l => l.tapis)) for (const o of l.objets) {
      const i = q(o.p[0], o.p[2], 40).i;
      quarts[Math.min(3, Math.floor(i * piste.pas / piste.longueur * 4))]++;
    }
    assert.ok(quarts.every(n => n > r.tuiles * .18), `${qualite} : ${quarts.join(',')}`);
  }
});
verifier('densité indépendante du profil général, modes désactivés et données de course inchangées', () => {
  const piste = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const tracer = () => ['x', 'y', 'z', 'cap', 'devers', 'courbure', 'pente'].map(k => Array.from(piste[k]));
  const traceAvant = tracer();
  const reference = B.decor.construire(piste, { qualite: 'medium', vegetation: false });
  const sansPlantes = d => {
    const { vegetation, sol, ...reste } = d;
    return { ...reste, lots: d.lots.filter(l => !l.vegetation) };
  };
  for (const vegetationQualite of ['off', 'low', 'medium', 'high', 'ultra']) {
    const d = B.decor.construire(piste, { qualite: 'medium', vegetationQualite });
    assert.equal(d.qualite, 'medium', 'la densité ne change pas le profil des arbres');
    assert.deepEqual(sansPlantes(d), sansPlantes(reference), vegetationQualite + ' : décor et solides intacts');
    assert.deepEqual(d.obstacles, reference.obstacles);
    if (vegetationQualite === 'off') assert.equal(d.vegetation, undefined);
    else assert.equal(d.vegetation.qualite, vegetationQualite);
  }
  assert.deepEqual(tracer(), traceAvant, 'aucune influence sur la simulation');
  assert.equal(B.decor.construire(piste, { qualite: 'high', vegetationQualite: 'ultra', vegetation: false }).vegetation, undefined);
  const defaut = B.decor.construire(piste, { qualite: 'medium' });
  const inconnue = B.decor.construire(piste, { qualite: 'medium', vegetationQualite: 'inconnue' });
  assert.deepEqual(defaut.vegetation, inconnue.vegetation, 'densité invalide : suivre le profil');
  assert.deepEqual(construire(piste, 'off'), { lots: [], herbes: 0, fougeres: 0, fleurs: 0, taillis: 0,
    brins: 0, brinsTapis: 0, tuiles: 0, objetsHerbe: 0, qualite: 'off' });
});
verifier('tapis dense hors chaussée, stands, glissières et tunnel, sur les deux accotements', () => {
  for (const [graine, theme, longueur] of PISTES) {
    const piste = B.circuit.creer(graine, { theme, longueur }), q = indexAxe(piste), limites = B.decor.limites(piste);
    for (const qualite of ['medium', 'high', 'ultra']) {
      const r = construire(piste, qualite), cotes = new Set();
      for (const l of r.lots) for (const o of l.objets) {
        const p = q(o.p[0], o.p[2], 40), i = p.i;
        assert.ok(i >= 0);
        // Les tuiles sont orientées dans la pente et leur rectangle suit la route ; le test détaillé plus
        // bas inspecte leurs vrais pieds. Les anciennes plantes restent dans leur sphère conservatrice.
        const marge = o.shape === 'prairie-val' ? 0 : Math.hypot(o.s[0], o.s[2]) / 2;
        assert.ok(p.d >= piste.largeur / 2 + 1.2 + marge, theme + ' piste');
        const s = i * piste.pas;
        assert.ok(Math.abs(B.circuit.ecart(piste, 0, s)) >= 360, theme + ' stands');
        assert.ok(!B.circuit.dansTunnel(piste, s, 20), theme + ' tunnel');
        const d = -(o.p[0] - piste.x[i]) * Math.sin(piste.cap[i]) + (o.p[2] - piste.z[i]) * Math.cos(piste.cap[i]);
        const cote = d < 0 ? -1 : 1, limite = cote < 0 ? limites.G[i] : limites.D[i];
        assert.ok(Math.abs(d) + marge < limite, theme + ' glissière');
        cotes.add(cote);
        assert.ok(o.p.concat(o.s, o.r, o.color).every(Number.isFinite));
        assert.equal(o.collision, undefined);
      }
      assert.equal(cotes.size, 2, `${theme} ${qualite} : deux bords végétalisés`);
    }
  }
});
// Matrice Rz·Ry·Rx du rendu, appliquée aux véritables sommets de la forme instanciée.
function sommetMonde(o, p) {
  let [x, y, z] = p.map((v, i) => v * o.s[i]);
  const [a, b, c] = o.r;
  [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
  [x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
  [x, y] = [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c)];
  return [x + o.p[0], y + o.p[1], z + o.p[2]];
}
// Interroge les vrais triangles de la nappe routière, pas la fonction de placement des plantes.
function surfaceHerbe(c, decor) {
  const maille = 8, cases = new Map();
  for (const nap of decor.nappes.slice(0, Math.ceil(c.n / 60))) for (let i = 0; i < nap.indices.length; i += 3) {
    const ids = Array.from(nap.indices.slice(i, i + 3), id => id * 13);
    if (ids.some(id => nap.sommets[id + 9] !== 8)) continue;
    const t = ids.map(id => Array.from(nap.sommets.slice(id, id + 3)));
    const x0 = Math.floor(Math.min(...t.map(p => p[0])) / maille), x1 = Math.floor(Math.max(...t.map(p => p[0])) / maille);
    const z0 = Math.floor(Math.min(...t.map(p => p[2])) / maille), z1 = Math.floor(Math.max(...t.map(p => p[2])) / maille);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const cle = x + ',' + z, liste = cases.get(cle);
      if (liste) liste.push(t); else cases.set(cle, [t]);
    }
  }
  return (x, z) => {
    for (const [a, b, c] of cases.get(Math.floor(x / maille) + ',' + Math.floor(z / maille)) || []) {
      const ax = b[0] - a[0], az = b[2] - a[2], bx = c[0] - a[0], bz = c[2] - a[2], det = ax * bz - az * bx;
      const u = ((x - a[0]) * bz - (z - a[2]) * bx) / det, v = (ax * (z - a[2]) - az * (x - a[0])) / det;
      if (u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001) return a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]);
    }
    return null;
  };
}
const solMesure = {};
verifier('racines posées sur les vrais triangles de terrain, pieds et pointes hors piste et ouvrages', () => {
  const loin = V.forme('prairie-val-loin');
  for (const [graine, theme, longueur] of PISTES) {
    const piste = B.circuit.creer(graine, { theme, longueur }), limites = B.decor.limites(piste), q = indexAxe(piste);
    const sol = surfaceHerbe(piste, B.decor.construire(piste, { vegetation: false }));
    let erreurMax = 0, sousSol = 0, auDessus = 0, pieds = 0;
    const parQualite = {};
    for (const qualite of ['medium', 'high', 'ultra']) for (const l of construire(piste, qualite).lots.filter(l => l.tapis)) for (const o of l.objets) {
      // Vérifier le pied de chaque brin après toutes les rotations de pente. Douze brins par tuile
      // vérifient aussi leur pointe et les exclusions ; les hauteurs interrogent la nappe réellement rendue.
      for (let k = 0; k < 96; k++) {
        const f = loin[k * 2], local = f[0].map((v, j) => (v + f[1][j]) / 2), pied = sommetMonde(o, local);
        const y = sol(pied[0], pied[2]);
        assert.notEqual(y, null, `${theme} ${qualite} : racine hors nappe d'herbe ${JSON.stringify({ pied, objet: o, k })}`);
        const difference = pied[1] - y, erreur = Math.abs(difference);
        erreurMax = Math.max(erreurMax, erreur); sousSol = Math.min(sousSol, difference); auDessus = Math.max(auDessus, difference); pieds++;
        const mesure = parQualite[qualite] || (parQualite[qualite] = { min: 0, max: 0 });
        mesure.min = Math.min(mesure.min, difference); mesure.max = Math.max(mesure.max, difference);
        // Les tuiles Medium sont plus longues et leur plan approche plusieurs triangles. High/Ultra
        // restent ancrés à 3 cm du sol au plus, avec moins d'un centimètre de dépassement positif.
        assert.ok(erreur < (qualite === 'medium' ? .065 : .03), `${theme} ${qualite} : pied ${erreur.toFixed(5)} m du sol`);
        assert.ok(difference < (qualite === 'medium' ? .03 : .01), `${theme} ${qualite} : pied flottant ${difference.toFixed(5)} m`);
        if (k % 8) continue;
        for (const p of [pied, sommetMonde(o, f[2])]) {
          const proche = q(p[0], p[2], 40), i = proche.i;
          assert.ok(proche.d > piste.largeur / 2 + 1.2, `${theme} ${qualite} : brin dans chaussée`);
          assert.ok(Math.abs(B.circuit.ecart(piste, 0, i * piste.pas)) >= 360);
          assert.ok(!B.circuit.dansTunnel(piste, i * piste.pas, 20));
          const d = -(p[0] - piste.x[i]) * Math.sin(piste.cap[i]) + (p[2] - piste.z[i]) * Math.cos(piste.cap[i]);
          assert.ok(Math.abs(d) < (d < 0 ? limites.G[i] : limites.D[i]) - .8, `${theme} ${qualite} : brin dans glissière`);
        }
      }
    }
    solMesure[theme] = { piedsVerifies: pieds, erreurMaxMetres: erreurMax, sousSolMetres: sousSol, auDessusMetres: auDessus, parQualite };
  }
});
verifier('côte et montagne sont végétalisées, un biome hors thème reste vide sans erreur', () => {
  for (const theme of ['cote', 'montagne']) {
    assert.ok(Object.keys(B.decor.THEMES).includes(theme), theme);
    const [graine, longueur] = PISTES.find(p => p[1] === theme).slice(1);
    const piste = B.circuit.creer(graine, { theme, longueur });
    const r = construire(piste, 'high');
    assert.ok(r.lots.length > 0 && r.herbes > 40, `${theme} : ${r.herbes} herbes`);
    assert.ok(r.taillis > 5, `${theme} : ${r.taillis} taillis`);
    for (const l of r.lots) {
      assert.equal(l.vegetation, true); assert.equal(l.portee, Infinity); assert.equal(l.bascule, l.tapis ? 60 : 520);
      assert.equal(l.lodReferenceFov, 60); assert.equal(l.lodReferenceHeight, 1080);
      assert.equal(l.objets.length, l.loin.length, theme);
      assert.ok(Number.isFinite(l.rayon) && l.rayon > 0, theme);
    }
  }
  const desert = B.circuit.creer(5, { theme: 'desert', longueur: 3000 });
  const vide = V.construire(desert, { limites: B.decor.limites(desert), interroger: indexAxe(desert), qualite: 'high' });
  assert.deepEqual(vide.lots, []);
  assert.deepEqual({ herbes: vide.herbes, fougeres: vide.fougeres, fleurs: vide.fleurs, taillis: vide.taillis },
    { herbes: 0, fougeres: 0, fleurs: 0, taillis: 0 });
  assert.deepEqual(V.construire(c, {}).lots, [], 'sans limites ni interrogateur, rien n\'est planté');
  assert.deepEqual(V.construire(c, { limites: B.decor.limites(c) }).lots, []);
});
verifier('matières naturelles 0.3.5 : feuillage 27 et sol organique 25, retombant sur les familles 11 et 8', () => {
  const haut = construire(c, 'high');
  assert.deepEqual(matieresDe(haut), [25, 27], 'forêt haute : feuillages et terreau');
  assert.ok(haut.lots.some(l => l.objets.some(o => o.mat === 25 && o.shape === 'humus-val')));
  assert.ok(haut.lots.every(l => l.objets.every(o => o.mat === 11 || o.mat === 25 || o.mat === 27)));
  const montagne = construire(B.circuit.creer(47, { theme: 'montagne', longueur: 5200 }), 'high');
  assert.deepEqual(matieresDe(montagne), [25, 27]);
  const cote = construire(B.circuit.creer(29, { theme: 'cote', longueur: 3600 }), 'high');
  assert.deepEqual(matieresDe(cote), [27], 'la côte sans fougère n\'a pas de terreau');
  // Le moteur 0.3.5 fait retomber 27 sur la famille historique 11 et 25 sur la famille 8 : aspect conservé.
  const famille = v => [21, 22, 23, 24, 25, 26, 27].includes(Math.floor(v + .5))
    ? ({ 21: 14, 22: 3, 23: 9, 24: 16, 25: 8, 26: 10, 27: 11 })[Math.floor(v + .5)] : v;
  assert.equal(famille(27), 11); assert.equal(famille(25), 8);
});
verifier('aucune disparition au loin sur tous les paliers et tous les biomes', () => {
  for (const [graine, theme, longueur] of PISTES) {
    const piste = B.circuit.creer(graine, { theme, longueur });
    for (const qualite of ['low', 'medium', 'high', 'ultra']) {
      const r = construire(piste, qualite);
      for (const l of r.lots) {
        assert.equal(l.objets.length, l.loin.length, `${theme} ${qualite}`);
        for (let i = 0; i < l.objets.length; i++) {
          const a = l.objets[i], b = l.loin[i];
          assert.equal(b.shape, a.shape.replace(/-val$/, '-val-loin'), `${theme} ${qualite}`);
          assert.deepEqual(a.p, b.p); assert.deepEqual(a.s, b.s); assert.deepEqual(a.r, b.r); assert.deepEqual(a.color, b.color);
          assert.ok(V.forme(b.shape).length < V.forme(a.shape).length * .5, `${theme} ${qualite} ${a.shape}`);
        }
      }
    }
  }
});
verifier('le palier haut ne consomme pas le hasard de la simulation et ne touche pas au tracé', () => {
  const piste = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const avant = ['x', 'y', 'z', 'cap', 'devers', 'courbure', 'pente'].map(k => Array.from(piste[k]));
  const l2 = B.decor.limites(piste), q = indexAxe(piste);
  const r = V.construire(piste, { limites: l2, interroger: q, qualite: 'high' });
  const apres = ['x', 'y', 'z', 'cap', 'devers', 'courbure', 'pente'].map(k => Array.from(piste[k]));
  assert.deepEqual(apres, avant, 'le tracé est intact');
  assert.deepEqual(r.lots, construire(piste, 'high').lots, 'deux appels, même répartition');
  assert.notEqual(r.lots, construire(piste, 'high').lots);
});
console.log(JSON.stringify({ controles, plantes: apres.vegetation, erreursLod, densitesMesurees, solMesure }, null, 2));
