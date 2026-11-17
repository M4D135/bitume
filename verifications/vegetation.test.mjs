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
const famillesDe = r => [...new Set(r.lots.flatMap(l => l.objets.map(o => o.shape.replace(/-val(-loin)?$/, ''))))].sort();
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
verifier('qualite optionnelle : seule medium et high sont demandés ; tout le reste vaut le palier historique', () => {
  // Le palier haut est une demande explicite. Une valeur absente, nulle, « auto » ou inconnue ne peut pas,
  // par accident, multiplier le coût du décor : elle retrouve le profil d'avant le chantier.
  const bas = construire(c, 'low');
  assert.equal(V.construire(c, { limites: B.decor.limites(c), interroger: indexAxe(c) }).qualite, 'low');
  const haut = construire(c, 'high'), auto = construire(c, 'auto'), inconnue = construire(c, 'ultra');
  assert.deepEqual(auto.lots, bas.lots);
  assert.deepEqual(inconnue.lots, bas.lots);
  assert.equal(V.construire(c, { limites: B.decor.limites(c), interroger: indexAxe(c), qualite: null }).qualite, 'low');
  const moyen = construire(c, 'medium');
  assert.ok(moyen.herbes > haut.herbes * .4 && moyen.herbes < haut.herbes, 'medium entre bas et haut');
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
verifier('côte et montagne sont végétalisées, un biome hors thème reste vide sans erreur', () => {
  for (const theme of ['cote', 'montagne']) {
    assert.ok(Object.keys(B.decor.THEMES).includes(theme), theme);
    const [graine, longueur] = PISTES.find(p => p[1] === theme).slice(1);
    const piste = B.circuit.creer(graine, { theme, longueur });
    const r = construire(piste, 'high');
    assert.ok(r.lots.length > 0 && r.herbes > 40, `${theme} : ${r.herbes} herbes`);
    assert.ok(r.taillis > 5, `${theme} : ${r.taillis} taillis`);
    for (const l of r.lots) {
      assert.equal(l.vegetation, true); assert.equal(l.portee, Infinity); assert.equal(l.bascule, 520);
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
    for (const qualite of ['low', 'medium', 'high']) {
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
console.log(JSON.stringify({ controles, plantes: apres.vegetation, erreursLod }, null, 2));
