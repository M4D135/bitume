import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const n of ['circuit', 'carene', 'ecologie', 'decor']) require('../src/' + n + '.js');
const B = globalThis.BITUME, E = B.ecologie, mesures = [];
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

verifier('champ borné, déterministe et sans allocation de sortie imposée', () => {
  const a = E.creer(11, 'foret'), b = E.creer(11, 'foret'), autre = E.creer(12, 'foret');
  const sortie = Object.seal({ herbe: 0, fleurs: 0, insectes: 0, boisement: 0 });
  let ecart = 0, zeros = 0, riches = 0;
  const hasard = Math.random;
  Math.random = () => { throw new Error('Le champ ne doit pas consommer de hasard global'); };
  try {
    for (let x = -1000; x <= 1000; x += 29) for (let z = -1000; z <= 1000; z += 31) {
      assert.strictEqual(a.echantillonner(x, z, sortie), sortie);
      assert.deepEqual(sortie, b.echantillonner(x, z));
      for (const v of Object.values(sortie)) assert.ok(Number.isFinite(v) && v >= 0 && v <= 1);
      if (sortie.herbe === 0) { zeros++; assert.equal(sortie.insectes, 0); assert.equal(sortie.fleurs, 0); }
      if (sortie.herbe > .8) riches++;
      ecart += Math.abs(sortie.herbe - autre.echantillonner(x, z).herbe);
      assert.ok(Math.abs(sortie.herbe - a.echantillonner(x + .001, z + .001).herbe) < .002, 'champ continu aux frontières de cellules');
    }
  } finally { Math.random = hasard; }
  assert.ok(zeros > 500 && riches > 200 && ecart > 200);
  for (const [x, z] of [[NaN, 1], [Infinity, 0], [0, -Infinity]]) {
    assert.strictEqual(a.echantillonner(x, z, sortie), sortie);
    assert.deepEqual(Object.values(sortie), [0, 0, 0, 0]);
  }
});

verifier('les trois tracés comportent des clairières, des poches riches et des côtés différents', () => {
  for (const [graine, biome, longueur] of [[11, 'foret', 4200], [29, 'cote', 3600], [47, 'montagne', 5200]]) {
    const c = B.circuit.creer(graine, { theme: biome, longueur }), e = E.creer(graine, biome), sortie = {};
    const valeurs = [], differences = [];
    let plusLongueClairiere = 0;
    for (const cote of [-1, 1]) {
      let longueurNue = 0;
      for (let s = 400; s < c.longueur - 400; s += 6) {
        const p = B.circuit.echantillon(c, s), x = p.x - Math.sin(p.cap) * cote * 10, z = p.z + Math.cos(p.cap) * cote * 10;
        const v = e.echantillonner(x, z, sortie).herbe; valeurs.push(v);
        if (v === 0) { longueurNue += 6; plusLongueClairiere = Math.max(plusLongueClairiere, longueurNue); }
        else longueurNue = 0;
        if (cote > 0) differences.push(Math.abs(v - e.echantillonner(p.x + Math.sin(p.cap) * 10, p.z - Math.cos(p.cap) * 10, sortie).herbe));
      }
    }
    const nus = valeurs.filter(v => v === 0).length / valeurs.length, riches = valeurs.filter(v => v > .8).length / valeurs.length;
    const asymetrie = differences.reduce((a, b) => a + b, 0) / differences.length;
    assert.ok(nus > .25 && nus < .85, biome + ' : de vraies zones nues');
    assert.ok(riches > .08 && riches < .55, biome + ' : des noyaux denses');
    assert.ok(asymetrie > .06 && plusLongueClairiere >= 60, biome + ' : pas de miroir ni de simple mouchetis uniforme');
    mesures.push({ biome, points: valeurs.length, nus, riches, asymetrie, plusLongueClairiere });
  }
});

verifier('le boisement laisse des vides sans déplacer les objets fixes ou les troncs survivants', () => {
  for (const [graine, theme, longueur] of [[11, 'foret', 4200], [29, 'cote', 3600], [47, 'montagne', 5200]]) {
    const c = B.circuit.creer(graine, { theme, longueur });
    // Le chemin sans module sert d'oracle des candidats historiques et de leur consommation de hasard.
    delete B.ecologie;
    const historique = B.decor.construire(c, { qualite: 'high', vegetation: false });
    B.ecologie = E;
    const decor = B.decor.construire(c, { qualite: 'high', vegetation: false });
    const bas = B.decor.construire(c, { qualite: 'low', vegetation: false });
    assert.equal(Object.keys(decor).includes('ecologie'), false);
    assert.equal(typeof decor.ecologie.echantillonner, 'function');
    assert.deepEqual(decor.arbres, bas.arbres, 'les obstacles sont indépendants de la qualité graphique');
    assert.deepEqual(decor.obstacles, bas.obstacles);
    assert.equal(decor.nappes.length, historique.nappes.length);
    let sommets = 0, indices = 0, couleursModifiees = 0, sableInchange = 0;
    const sable = historique.theme.sable && Array.from(new Float32Array(historique.theme.sable));
    for (let i = 0; i < decor.nappes.length; i++) {
      const a = decor.nappes[i], b = historique.nappes[i];
      sommets += a.sommets.length / 13; indices += a.indices.length;
      assert.deepEqual(a.indices, b.indices);
      assert.equal(a.sommets.length, b.sommets.length);
      for (let k = 0; k < a.sommets.length; k++) if (k % 13 < 10 || Math.floor(a.sommets[k - k % 13 + 9]) !== 8) {
        assert.equal(a.sommets[k], b.sommets[k], 'seules les couleurs des surfaces herbeuses changent');
      }
      for (let k = 0; k < a.sommets.length; k += 13) {
        if (a.sommets[k + 10] !== b.sommets[k + 10] || a.sommets[k + 11] !== b.sommets[k + 11] || a.sommets[k + 12] !== b.sommets[k + 12]) couleursModifiees++;
        if (sable && sable.every((v, j) => b.sommets[k + 10 + j] === v)) {
          for (let j = 0; j < 3; j++) assert.equal(a.sommets[k + 10 + j], b.sommets[k + 10 + j], 'aucune prairie fantôme sur le sable');
          sableInchange++;
        }
      }
    }
    assert.ok(couleursModifiees > 1000);
    if (theme === 'cote') assert.ok(sableInchange > 100);
    const objets = d => d.lots.flatMap(l => l.objets);
    const fixes = d => objets(d).filter(o => o.collision !== 'tronc' && o.shape !== 'foliage').map(o => JSON.stringify(o)).sort();
    assert.deepEqual(fixes(decor), fixes(historique), 'stands, villages, rochers et tunnel inchangés');
    assert.deepEqual(decor.obstacles.filter(o => o.genre !== 'tronc'), historique.obstacles.filter(o => o.genre !== 'tronc'));
    const anciens = new Set(objets(historique).filter(o => o.collision === 'tronc').map(o => JSON.stringify(o)));
    const troncs = objets(decor).filter(o => o.collision === 'tronc');
    assert.ok(troncs.length > 100 && troncs.length < anciens.size * .8, 'le champ réduit réellement les objets');
    assert.equal(decor.obstacles.filter(o => o.genre === 'tronc').length, troncs.length);
    for (const o of troncs) {
      assert.ok(anciens.has(JSON.stringify(o)));
      assert.ok(decor.ecologie.echantillonner(o.p[0], o.p[2]).boisement >= .08);
    }
    Object.assign(mesures.find(m => m.biome === theme), { arbresAvant: anciens.size, arbresApres: troncs.length,
      solLointain: { nappes: decor.nappes.length, sommets, indices, couleursModifiees, sableInchange, sommetsAjoutes: 0, indicesAjoutes: 0, nappesAjoutees: 0 } });
  }
});

console.log(JSON.stringify({ controles, mesures }, null, 2));
