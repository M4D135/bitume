// Mesures indépendantes des profils de gant : distances entre contrôles et
// sommets effectivement produits. Ces longueurs ne sont pas des cotes humaines.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
require('../src/carene.js');
require('../src/main.js');
const M = globalThis.BITUME.main, reference = M.construire(false);
const difference = (a, b) => a.map((v, i) => v - b[i]);
const distance = (a, b) => Math.hypot(...difference(a, b));
const produit = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const longueurs = p => p.slice(2).map((v, i) => distance(v, p[i + 1]));
const doigtsReference = reference.points.doigts.map(longueurs), pouceReference = longueurs(reference.points.pouce);
const segmentsConserves = (points, attendus, libelle) => {
  const observes = longueurs(points);
  assert.equal(observes.length, attendus.length, libelle + ' : même chaîne');
  observes.forEach((l, i) => assert.ok(Math.abs(l - attendus[i]) < 1e-10,
    `${libelle}, segment ${i} : ${l} m au lieu de ${attendus[i]} m`));
};
const sommets = triangles => triangles.flatMap(t => t.slice(0, 3));

test('chaque segment des quatre doigts et du pouce garde sa longueur pendant ouverture et gestes', () => {
  let poses = 0;
  const verifier = (main, libelle) => {
    main.points.doigts.forEach((p, i) => segmentsConserves(p, doigtsReference[i], libelle + '/' + i));
    segmentsConserves(main.points.pouce, pouceReference, libelle + '/pouce');
    poses++;
  };
  for (let i = 0; i <= 20; i++) verifier(M.construire(i / 20), 'ouverture ' + i / 20);
  for (const geste of ['majeur', 'poing', 'salut']) for (let i = 0; i <= 20; i++)
    verifier(M.construire(1, { geste, progression: i / 20 }), geste + ' ' + i / 20);
  assert.equal(poses, 84);
});

test('le contrôle de longueurs refuse une contraction artificielle des doigts et du pouce', () => {
  // Témoin négatif : reproduire une réduction de 72 % autour de la jointure.
  // Ni la formule de pose ni ses directions ne participent au contrôle.
  const contracter = points => points.map((p, i) => i < 2 ? p.slice()
    : p.map((v, k) => points[1][k] + .28 * (v - points[1][k])));
  reference.points.doigts.forEach((p, i) => assert.throws(
    () => segmentsConserves(contracter(p), doigtsReference[i], 'contraction ' + i),
    { name: 'AssertionError' }));
  assert.throws(() => segmentsConserves(contracter(reference.points.pouce), pouceReference, 'contraction pouce'),
    { name: 'AssertionError' });
});

test('la prise et le salut conservent des proportions de doigts cohérentes', () => {
  const attendus = [[.070, .077], [.078, .086], [.072, .080], [.055, .063]];
  for (const main of [reference, M.construire(1), M.construire(1, { geste: 'salut', progression: 1 })]) {
    const mesures = main.points.doigts.map(p => longueurs(p).reduce((s, l) => s + l, 0));
    mesures.forEach((l, i) => assert.ok(l > attendus[i][0] && l < attendus[i][1],
      M.DOIGTS[i].nom + ' : longueur de modèle ' + l));
    assert.ok(mesures[1] > mesures[2] && mesures[2] > mesures[0] && mesures[0] > mesures[3],
      'majeur le plus long, auriculaire le plus court ; anneau et index proches');
  }
});

test('les doigts déployés existent dans les vrais sommets, au-delà de simples points de contrôle', () => {
  for (const geste of [null, 'salut', 'majeur']) {
    const main = geste ? M.construire(1, { geste, progression: 1 }) : M.construire(1);
    const vertices = sommets(main.prise);
    for (let i = 0; i < 4; i++) {
      if (geste === 'majeur' && i !== 1) continue;
      const points = main.points.doigts[i], racine = points[1], longueur = doigtsReference[i].reduce((s, v) => s + v, 0);
      const bout = difference(points.at(-1), racine), projection = produit(bout, M.AXE) * -1;
      assert.ok(projection > longueur * .96, 'doigt réellement déployé : ' + geste + '/' + i);
      const axe = bout.map(v => v / Math.hypot(...bout)), rayon = M.DOIGTS[i].r;
      let extremite = -Infinity, distaux = 0;
      for (const v of vertices) {
        const d = difference(v, racine), leLong = produit(d, axe);
        const transversal = Math.hypot(...d.map((x, k) => x - axe[k] * leLong));
        // Ce cylindre étroit exclut les doigts voisins ; la paume est derrière.
        if (transversal > rayon * 1.15 || leLong <= longueur * .8) continue;
        distaux++; extremite = Math.max(extremite, leLong);
      }
      assert.ok(distaux >= 8 && extremite >= longueur * .98,
        'surface distale absente malgré les contrôles : ' + geste + '/' + i);
      assert.ok(extremite < longueur + rayon * 1.6,
        'surface excessivement étirée : ' + geste + '/' + i);
    }
  }
});

test('les pièces ouvertes et les gestes gardent des sommets finis et des normales unitaires orientées', () => {
  const poses = [[0, null], [.1, null], [.5, null], [1, null]];
  for (const geste of ['majeur', 'poing', 'salut']) for (const progression of [.25, .5, .75, 1])
    poses.push([1, { geste, progression }]);
  for (const [ouverture, expression] of poses) {
    const main = M.construire(ouverture, expression);
    for (const nom of ['prise', 'dos', 'paume', 'garde', 'poignet', 'sangle']) for (const triangle of main[nom]) {
      assert.equal(triangle.length, 6, nom + ' : triangle avec trois normales');
      for (const p of triangle) assert.ok(p.length === 3 && p.every(Number.isFinite), nom + ' : nombres finis');
      const normale = croix(difference(triangle[1], triangle[0]), difference(triangle[2], triangle[0]));
      assert.ok(Math.hypot(...normale) > 1e-14, nom + ' : face non dégénérée');
      for (let j = 3; j < 6; j++) {
        assert.ok(Math.abs(Math.hypot(...triangle[j]) - 1) < 1e-9, nom + ' : normale unitaire');
        assert.ok(produit(normale, triangle[j]) >= -1e-13, nom + ' : normale du côté de la face');
      }
    }
  }
});

test('l’ouverture libère la jante sans faire pénétrer la peau du gant', () => {
  let minimum = Infinity;
  for (let i = 0; i <= 20; i++) {
    const main = M.construire(i / 20);
    for (const p of sommets(main.prise)) {
      const jeu = Math.hypot(p[0], Math.hypot(p[1], p[2] - M.JANTE.R) - M.JANTE.R) - M.JANTE.r;
      minimum = Math.min(minimum, jeu);
      assert.ok(jeu > -.002, 'peau dans la jante pendant ouverture ' + i / 20 + ' : ' + jeu);
    }
  }
  console.log(JSON.stringify({ ouverture: 21, jeuMinimumJanteMm: minimum * 1000 }));
});

test('les racines, jointures et le vrai maillage de manchette gardent leurs ancrages', () => {
  const poses = [[0, null], [.2, null], [.5, null], [.8, null], [1, null]];
  for (const geste of ['majeur', 'poing', 'salut']) for (const progression of [0, .2, .5, .8, 1])
    poses.push([1, { geste, progression }]);
  for (const [ouverture, expression] of poses) {
    const main = M.construire(ouverture, expression);
    assert.deepEqual(main.points.poignet, reference.points.poignet, 'poignet');
    assert.deepEqual(main.points.jointures, reference.points.jointures, 'jointures');
    main.points.doigts.forEach((p, i) => assert.deepEqual(p.slice(0, 2), reference.points.doigts[i].slice(0, 2), 'racine ' + i));
    assert.deepEqual(main.points.pouce.slice(0, 2), reference.points.pouce.slice(0, 2), 'éminence du pouce');
    assert.deepEqual(main.poignet, reference.poignet, 'surface de manchette');
    assert.deepEqual(main.sangle, reference.sangle, 'surface de sangle');
  }
});

test('treize états réduisent les sauts de pose par rapport aux six états, à longueurs identiques', () => {
  const maximums = {};
  for (const geste of [null, 'majeur', 'poing', 'salut']) {
    const mesurer = intervalles => {
      let precedent = null, maximum = 0;
      for (let n = 0; n <= intervalles; n++) {
        const main = geste ? M.construire(1, { geste, progression: n / intervalles }) : M.construire(n / intervalles);
        const points = main.points.doigts.flat().concat(main.points.pouce);
        if (precedent) points.forEach((p, i) => { maximum = Math.max(maximum, distance(p, precedent[i])); });
        precedent = points;
      }
      return maximum;
    };
    // Comparaison à géométrie égale : une borne absolue fondée sur les anciens
    // doigts trop courts favorisait justement leur contraction. Les contacts
    // et la constance des longueurs sont contrôlés séparément sans tolérance accrue.
    const six = mesurer(5), treize = mesurer(12);
    assert.ok(six > .001 && treize < six * .45, 'réduction de plus de 55 % du saut maximal : ' + geste);
    maximums[geste || 'ouverture'] = { sixEtats: six * 1000, treizeEtats: treize * 1000 };
  }
  console.log(JSON.stringify({ etats: 13, ecartControlesMaxMm: maximums,
    limite: 'États discrets préparés, pas une interpolation continue des sommets.' }));
});
