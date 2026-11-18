// Géométrie, coût borné et invariants du biome pilote. Les références historiques restent séparées.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
for (const nom of ['circuit', 'carene', 'ecologie', 'vegetation', 'decor']) require('../src/' + nom + '.js');
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
const famillesDe = r => [...new Set(r.lots.flatMap(l => l.objets.map(o => o.shape.startsWith('prairie-val') ? 'herbes' : o.shape.replace(/-val(-loin)?$/, ''))))].sort();
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
verifier('contrat GPU : rang constant par brin, racines fixes et exactement un huitième de brins lointains', () => {
  for (const [nom, proches] of Object.entries(V.FORMES_PRAIRIE)) {
    if (nom.endsWith('-loin')) continue;
    const n = V.BRINS_FORMES[nom], loin = V.forme(nom + '-loin'); let survivants = 0;
    assert.equal(proches.length, n * 6); assert.equal(loin.length, n / 8 * 2);
    for (let i = 0; i < n; i++) {
      const a = proches[i * 6][0], b = proches[i * 6][1], pointe = proches[i * 6 + 4][2];
      assert.equal(a[1], -.5); assert.equal(b[1], -.5);
      const cellule = p => [Math.floor((p[0] + .5) * 32), Math.floor((p[2] + .5) * 32)];
      const attendu = cellule(a), rang = (attendu[0] * 13 + attendu[1] * 7) % 8;
      for (const t of proches.slice(i * 6, i * 6 + 6)) for (const p of t.slice(0, 3)) {
        assert.deepEqual(cellule(p), attendu, nom + ' : identifiant stable du pied à la pointe');
        assert.ok(p[0] >= -.5 && p[2] >= -.5 && p[0] + p[2] <= 1e-12, 'dans le vrai triangle');
      }
      if (rang === 0) {
        assert.deepEqual(loin[survivants * 2].slice(0, 3), [a, b, pointe], 'le brin conservé est identique');
        survivants++;
      }
    }
    assert.equal(survivants, n / 8);
  }
  assert.notDeepEqual(V.forme('prairie-val-512-a'), V.forme('prairie-val-512-b'), 'motifs réellement distincts');
});

function repere(o) {
  const [rx, ry, rz] = o.r, cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  const rotation = v => { let [x, y, z] = v; [y, z] = [y * cx - z * sx, y * sx + z * cx]; [x, z] = [x * cy + z * sy, -x * sy + z * cy]; return [x * cz - y * sz, x * sz + y * cz, z]; };
  const x = rotation([1, 0, 0]), y = rotation([0, 1, 0]), z = rotation([0, 0, 1]);
  return { x: x.map(v => v * o.s[0]), y: y.map(v => v * o.s[1]), z: z.map((v, k) => v * o.s[2] + x[k] * (o.groundShear || 0)), p: o.p };
}
const transformer = (r, p) => r.p.map((v, k) => v + r.x[k] * p[0] + r.y[k] * p[1] + r.z[k] * p[2]);

// Échantillonneur indépendant des triangles réellement rendus. Il ne lit ni herbier, ni sa fonction de sol.
function solRendu(decor) {
  const grille = new Map(), maille = 32;
  for (const nap of decor.nappes) for (let i = 0; i < nap.indices.length; i += 3) {
    const ids = [nap.indices[i], nap.indices[i + 1], nap.indices[i + 2]].map(n => n * 13);
    if (ids.every(id => nap.sommets[id + 9] === 12)) continue;
    const p = ids.map(id => Array.from(nap.sommets.slice(id, id + 3)));
    const bx = [Math.floor(Math.min(...p.map(v => v[0])) / maille), Math.floor(Math.max(...p.map(v => v[0])) / maille)];
    const bz = [Math.floor(Math.min(...p.map(v => v[2])) / maille), Math.floor(Math.max(...p.map(v => v[2])) / maille)];
    for (let x = bx[0]; x <= bx[1]; x++) for (let z = bz[0]; z <= bz[1]; z++) {
      const cle = x + ',' + z; let liste = grille.get(cle); if (!liste) grille.set(cle, liste = []); liste.push(p);
    }
  }
  return (x, z) => {
    let y = -Infinity;
    for (const [a, b, c] of grille.get(Math.floor(x / maille) + ',' + Math.floor(z / maille)) || []) {
      const ax = b[0] - a[0], az = b[2] - a[2], bx = c[0] - a[0], bz = c[2] - a[2], det = ax * bz - az * bx;
      if (Math.abs(det) < 1e-10) continue;
      const u = ((x - a[0]) * bz - (z - a[2]) * bx) / det, v = (ax * (z - a[2]) - az * (x - a[0])) / det;
      if (u >= -1e-6 && v >= -1e-6 && u + v <= 1.000001) y = Math.max(y, a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]));
    }
    return y;
  };
}
const reference031 = JSON.parse(readFileSync(new URL('./fixtures/herbe-031.json', import.meta.url)));
const reference032 = JSON.parse(readFileSync(new URL('./fixtures/herbe-032.json', import.meta.url)));
const racinesFormes = new Map(), mesures = {};
function racines(nom) {
  if (racinesFormes.has(nom)) return racinesFormes.get(nom);
  const historique = nom === 'herbes-val', triangles = V.forme(historique ? nom + '-loin' : nom), pas = historique ? 8 : 6, n = triangles.length / pas;
  const pieds = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) { const t = triangles[i * pas]; pieds[i * 2] = historique ? t[0][0] : (t[0][0] + t[1][0]) / 2; pieds[i * 2 + 1] = historique ? t[0][2] : (t[0][2] + t[1][2]) / 2; }
  racinesFormes.set(nom, pieds); return pieds;
}
function compterDisques(r, reference) {
  const disques = reference.map(d => ({ ...d, avant: d.brins, brins: 0 }));
  for (const lot of r.lots) for (const o of lot.objets) {
    if (o.shape !== 'herbes-val' && !o.groundCover) continue;
    const rayon = Math.hypot(o.s[0] + Math.abs(o.groundShear || 0), o.s[2]) / 2;
    const proches = disques.filter(d => (o.p[0] - d.x) ** 2 + (o.p[2] - d.z) ** 2 < (rayon + d.rayon) ** 2);
    if (!proches.length) continue;
    const m = repere(o), pieds = racines(o.shape), bx = o.p[0] - m.y[0] / 2, bz = o.p[2] - m.y[2] / 2;
    for (const d of proches) for (let k = 0; k < pieds.length; k += 2) {
      const x = bx + pieds[k] * m.x[0] + pieds[k + 1] * m.z[0] - d.x, z = bz + pieds[k] * m.x[2] + pieds[k + 1] * m.z[2] - d.z;
      if (x * x + z * z <= d.rayon * d.rayon) d.brins++;
    }
  }
  return disques.map(d => ({ id: d.id, type: d.type || 'reference', avant: d.avant, brins: d.brins,
    facteur: d.avant ? d.brins / d.avant : null, parMetreCarre: d.brins / d.aire }));
}
function disquesEcologiques(c, decor) {
  const nus = [], riches = [], sortie = {};
  for (let s = 440; s < c.longueur - 440 && (nus.length < 3 || riches.length < 3); s += 14) for (const cote of [-1, 1]) {
    if (B.circuit.dansTunnel(c, s, 35)) continue;
    const p = B.circuit.echantillon(c, s), x = p.x - Math.sin(p.cap) * cote * 10, z = p.z + Math.cos(p.cap) * cote * 10;
    const valeur = decor.ecologie.echantillonner(x, z, sortie).herbe;
    const type = valeur === 0 ? 'nu' : valeur >= .96 ? 'riche' : null, liste = type === 'nu' ? nus : riches;
    if (!type || liste.length >= 3 || liste.some(d => Math.hypot(d.x - x, d.z - z) < 35)) continue;
    let valide = !!decor.surfaceHerbe(x, z);
    for (let k = 0; k < 8 && valide; k++) {
      const a = k * Math.PI / 4, co = Math.cos(a), si = Math.sin(a), rayon = type === 'nu' ? 14 : 3;
      const v = decor.ecologie.echantillonner(x + co * rayon, z + si * rayon, sortie).herbe;
      if ((type === 'nu' ? v !== 0 : v < .90) || !decor.surfaceHerbe(x + co * 2.1, z + si * 2.1)) valide = false;
    }
    if (valide) liste.push({ id: type + ':' + Math.round(s) + ':' + cote, type, x, z, rayon: 2, aire: Math.PI * 4, brins: 0 });
  }
  assert.ok(nus.length >= 2 && riches.length >= 2, c.theme + ' : plusieurs clairières et poches riches admissibles');
  return nus.concat(riches);
}
verifier('clairières sans brins, poches MAX très denses et coût inférieur à la 0.2.32', () => {
  for (const [graine, theme, longueur] of PISTES) {
    const piste = B.circuit.creer(graine, { theme, longueur }), decor = B.decor.construire(piste, { qualite: 'high', vegetation: false });
    const surfaces = decor.herbier, interroger = indexAxe(piste), rendu = solRendu(decor), ancienne = reference031.lignes.find(l => l.biome === theme);
    assert.ok(surfaces.aireTerrain > surfaces.aireAccotements * 10, 'la prairie dépasse largement les bandes de bord de route');
    const trace = empreinte([piste.x, piste.y, piste.z, piste.cap, piste.devers]), solides = empreinte(decor.obstacles);
    let precedent = 0; mesures[theme] = {};
    for (const qualite of ['medium', 'high', 'ultra']) {
      const r = V.construire(piste, { qualite, limites: decor.limites, interroger, surfaces, ecologie: decor.ecologie });
      let brins = 0, brinsTapis = 0, tuiles = 0, aire = 0, erreurSol = 0, controlesSol = 0, tuilesRichesProches = 0;
      for (const lot of r.lots) {
        assert.equal(lot.portee, Infinity, 'la portée effective ne vient qu’après le fondu GPU');
        assert.equal(lot.objets.length, lot.loin.length);
        if (lot.tapis) {
          assert.equal(lot.groundCover, true); assert.equal(lot.bascule, 60);
          assert.ok(new Set(lot.objets.map(o => o.shape)).size <= V.TAPIS[qualite].maillages.length, 'une seule variante par lot');
        }
        assert.ok(new Set(lot.objets.map(o => o.shape)).size <= V.PALIERS[qualite].groupes);
        for (let i = 0; i < lot.objets.length; i++) {
          const o = lot.objets[i], lointain = lot.loin[i];
          if (o.shape === 'herbes-val') brins += 9;
          if (!o.groundCover) continue;
          const n = V.forme(o.shape).length / 6; brins += n; brinsTapis += n; tuiles++; aire += o.grassArea;
          assert.ok(o.grassRichness >= .025, 'aucune instance dans un triangle éteint par le champ');
          assert.equal(n, V.BRINS_FORMES[o.shape]); assert.equal(V.BRINS_FORMES[lointain.shape], n / 8);
          assert.equal(o.windResponsive, true); assert.equal(o.mat, 27); assert.equal(o.collision, undefined);
          assert.deepEqual(o.p, lointain.p); assert.deepEqual(o.s, lointain.s); assert.deepEqual(o.r, lointain.r);
          assert.equal(lointain.groundShear, o.groundShear);
          const borne = Math.hypot(...sous(o.p, lot.centre)) + Math.hypot(o.s[0] + Math.abs(o.groundShear), o.s[1], o.s[2]) / 2 + .25 + 2.3 * o.s[1];
          assert.ok(borne <= lot.rayon + 1e-7, 'shear et souffle maximum compris dans le culling');
          if (qualite === 'ultra') {
            const pied = transformer(repere(o), [-1 / 6, -.5, -1 / 6]), y = rendu(pied[0], pied[2]);
            assert.ok(Number.isFinite(y), 'sol rendu présent sous chaque instance');
            const erreur = Math.abs(pied[1] - y); erreurSol = Math.max(erreurSol, erreur); controlesSol++;
            assert.ok(erreur < .009, `${theme} : racine à ${erreur} m du vrai sol`);
            assert.ok(decor.surfaceHerbe(pied[0], pied[2]), 'empreinte admissible après tous les masques');
            if (decor.niveauEau !== undefined) assert.ok(pied[1] > decor.niveauEau + .03);
            assert.ok(Math.abs(decor.ecologie.echantillonner(pied[0], pied[2]).herbe - o.grassRichness) < 1e-8);
            if (o.grassRichness >= .8 && o.grassSurface === 'accotement') {
              assert.ok(n / o.grassArea >= 200, 'les noyaux riches gardent leur forte densité par m²');
              tuilesRichesProches++;
            }
          }
        }
      }
      assert.equal(r.brins, brins); assert.equal(r.brinsTapis, brinsTapis); assert.equal(r.tuiles, tuiles);
      assert.ok(brins > precedent); precedent = brins;
      assert.ok(tuiles <= V.TAPIS[qualite].maximum);
      assert.ok(aire / surfaces.aire > .1 && aire / surfaces.aire < .8, `${theme} ${qualite} : la carte comporte de vraies clairières`);
      assert.ok(Math.abs(aire + r.aireNue - surfaces.aire) < 1e-3);
      const avant032 = reference032.mesures[theme][qualite];
      assert.ok(brins < avant032.brins * .65, `${theme} ${qualite} : les brins vides ne sont plus construits`);
      assert.ok(tuiles < avant032.tuiles * .7, `${theme} ${qualite} : moins d'instances réelles`);
      assert.ok(r.lots.length < avant032.lots, `${theme} ${qualite} : moins de lots réels`);
      assert.ok(r.brinsTerrain > 0 && r.brinsAccotements > 0);
      mesures[theme][qualite] = { brins, tuiles, lots: r.lots.length, aireCouverte: aire, couverture: aire / surfaces.aire,
        brinsAccotements: r.brinsAccotements, brinsTerrain: r.brinsTerrain, erreurSol, controlesSol,
        instanceBufferBytes: tuiles * 16 * 4 * 2, aireNue: r.aireNue, aireRiche: r.aireRiche,
        brinsRiches: r.brinsRiches, ratioBrins032: brins / avant032.brins,
        ratioInstances032: tuiles / avant032.tuiles, tuilesRichesProches };
      if (qualite === 'ultra') {
        const disques = compterDisques(r, ancienne.disques); mesures[theme][qualite].disques = disques;
        assert.ok(disques.length >= 6);
        const habitats = compterDisques(r, disquesEcologiques(piste, decor)); mesures[theme][qualite].habitats = habitats;
        assert.ok(tuilesRichesProches > 100);
        for (const d of habitats) {
          if (d.type === 'nu') assert.equal(d.brins, 0, `${theme} ${d.id} : clairière réellement vide`);
          else assert.ok(d.parMetreCarre >= 200, `${theme} ${d.id} : poche riche à ${d.parMetreCarre} brins/m²`);
        }
      }
    }
    assert.equal(empreinte([piste.x, piste.y, piste.z, piste.cap, piste.devers]), trace);
    assert.equal(empreinte(decor.obstacles), solides);
  }
});
verifier('un champ entièrement nu ne construit ni brin ni lot végétal', () => {
  const piste = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const decor = B.decor.construire(piste, { qualite: 'high', vegetation: false });
  const ecologie = { echantillonner(x, z, sortie) { sortie.herbe = sortie.fleurs = sortie.insectes = sortie.boisement = 0; return sortie; } };
  const r = V.construire(piste, { qualite: 'ultra', limites: decor.limites, interroger: indexAxe(piste), surfaces: decor.herbier, ecologie });
  assert.equal(r.lots.length, 0); assert.equal(r.tuiles, 0); assert.equal(r.brins, 0);
  assert.equal(r.aireNue, decor.herbier.aire);
});
verifier('surfaceHerbe existe en Off, refuse les routes et le tunnel et accepte une sortie réutilisable', () => {
  const piste = B.circuit.creer(47, { theme: 'montagne', longueur: 5200 }), decor = B.decor.construire(piste, { vegetation: false });
  assert.equal(decor.vegetation, undefined); assert.equal(typeof decor.surfaceHerbe, 'function');
  assert.equal(typeof decor.ecologie.echantillonner, 'function');
  for (let i = 0; i < piste.n; i += 9) assert.equal(decor.surfaceHerbe(piste.x[i], piste.z[i]), null, 'chaussée toujours propre');
  for (const t of decor.herbier.triangles.slice(0, 1200)) {
    const p = [0, 1, 2].map(k => (t.points[0][k] + t.points[1][k] + t.points[2][k]) / 3), sortie = {};
    assert.strictEqual(decor.surfaceHerbe(p[0], p[2], sortie), sortie);
    assert.ok(Math.abs(sortie.y - p[1]) < .001); assert.ok(['terrain', 'accotement'].includes(sortie.type));
    assert.ok(Math.abs(Math.hypot(...sortie.normal) - 1) < 1e-9);
  }
  assert.equal(Object.keys(decor).includes('herbier'), false, 'les empreintes historiques ne sérialisent pas le cache');
  assert.equal(Object.keys(decor).includes('surfaceHerbe'), false);
  assert.equal(Object.keys(decor).includes('ecologie'), false);
});
verifier('implantation déterministe et aucune nouvelle consommation du hasard du circuit', () => {
  const piste = B.circuit.creer(29, { theme: 'cote', longueur: 3600 });
  const options = { qualite: 'high', limites: B.decor.limites(piste), interroger: indexAxe(piste) };
  const a = V.construire(piste, options), b = V.construire(piste, options);
  assert.equal(a.brins, b.brins); assert.equal(a.tuiles, b.tuiles); assert.equal(a.lots.length, b.lots.length);
  for (let i = 0; i < a.lots.length; i++) assert.deepEqual(a.lots[i], b.lots[i]);
  const bas = construire(piste, 'low'); assert.equal(bas.herbes, 86); assert.equal(bas.tuiles, 0);
  assert.equal(construire(piste, 'off').lots.length, 0);
});
console.log(JSON.stringify({ controles, plantesHistoriques: apres.vegetation, erreursLod, mesures }, null, 2));
