// Formes organiques, pyramides du désert et lieux emblématiques des neuf circuits.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
for (const f of ['moteur/renderer', 'circuit', 'couverts', 'route-des-cimes', 'route-des-cimes-decor', 'virages', 'chaussee', 'ecologie', 'saisons', 'botanique', 'vegetation', 'bords', 'baikal', 'batiments', 'lieux', 'decor', 'solides-physx']) {
  require('../src/' + f + '.js');
}
const B = globalThis.BITUME;
let controles = 0;
const verifier = (nom, fn) => { fn(); controles++; console.log('ok ' + nom); };

const NEUF_CIRCUITS = [
  { id: 'val-brule', theme: 'foret', graine: 11, longueur: 4200, minLieux: 2 },
  { id: 'port-sable', theme: 'cote', graine: 29, longueur: 3600, minLieux: 2 },
  { id: 'haut-col', theme: 'montagne', graine: 47, longueur: 5200, minLieux: 2 },
  { id: 'lande-noire', theme: 'islande', graine: 83, longueur: 4600, minLieux: 3 },
  { id: 'roche-fauve', theme: 'desert', graine: 107, longueur: 4800, minLieux: 3 },
  { id: 'brume-de-jade', theme: 'asie', graine: 131, longueur: 5000, minLieux: 2 },
  { id: 'cap-sequoia', theme: 'pacifique', graine: 157, longueur: 5200, minLieux: 2 },
  { id: 'baikal', theme: 'baikal', graine: 211, longueur: 4800, minLieux: 3 },
  { id: 'route-des-cimes', cimes: true, minLieux: 2 },
];

verifier('toutes les formes B.lieux.FORMES : finies, cube unité, normales sortantes >= 95 %', () => {
  const noms = Object.keys(B.lieux.FORMES);
  assert(noms.length >= 16, 'nombre de formes : ' + noms.length);
  let totalTris = 0;
  for (const nom of noms) {
    assert(nom.startsWith('bitume-lieu-'), nom);
    const tris = B.lieux.FORMES[nom];
    assert(Array.isArray(tris) && tris.length > 0, nom + ' vide');
    let accord = 0;
    for (const t of tris) {
      for (const v of t) for (const x of v) assert(Number.isFinite(x), nom + ' coord non finie');
      for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) assert(Math.abs(t[j][k]) <= .5001, nom + ' hors cube unité');
      const e1 = [t[1][0] - t[0][0], t[1][1] - t[0][1], t[1][2] - t[0][2]];
      const e2 = [t[2][0] - t[0][0], t[2][1] - t[0][1], t[2][2] - t[0][2]];
      const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const ns = [t[3][0] + t[4][0] + t[5][0], t[3][1] + t[4][1] + t[5][1], t[3][2] + t[4][2] + t[5][2]];
      if (fn[0] * ns[0] + fn[1] * ns[1] + fn[2] * ns[2] > 0) accord++;
    }
    assert(accord >= tris.length * .95, nom + ' : ' + accord + '/' + tris.length + ' normales sortantes');
    totalTris += tris.length;
  }
  console.log('   ' + noms.length + ' formes organiques/lieux, ' + totalTris + ' triangles');
});

verifier('neuf circuits en mode organique : pyramides au désert, zéro rocher carré, lieux emblématiques et PhysX', () => {
  const mondeFictif = {
    id: 0,
    addTriangleMesh() { return ++this.id; },
    addBox() { return ++this.id; },
    remove() {},
  };
  for (const spec of NEUF_CIRCUITS) {
    const c = spec.cimes ? B.routeDesCimes.creer() : B.circuit.creer(spec.graine, { theme: spec.theme, longueur: spec.longueur });
    const decor = B.decor.construire(c, { qualite: 'medium', vegetationQualite: 'off', organique: true, solsProceduraux: true });
    assert(decor.lieux && Array.isArray(decor.lieux.marqueurs), spec.id + ' : lieux absents');
    assert(decor.lieux.marqueurs.length >= spec.minLieux, spec.id + ' : marqueurs insuffisants (' + decor.lieux.marqueurs.length + ')');

    // Aucun triangle de terrain à matière mixte (pas de liseré métallique/carré sur les pentes)
    for (const n of decor.nappes) if (n.surfaceType === 'terrain') {
      const s = n.sommets, idx = n.indices;
      for (let k = 0; k < idx.length; k += 3) {
        const m0 = s[idx[k] * 13 + 9], m1 = s[idx[k + 1] * 13 + 9], m2 = s[idx[k + 2] * 13 + 9];
        assert(m0 === m1 && m1 === m2, spec.id + ' : triangle terrain à matière mixte (' + m0 + ',' + m1 + ',' + m2 + ')');
      }
    }

    // Aucun rocher naturel en box / bevel / octa
    let pyramides = 0, rochersOrganiques = 0;
    for (const lot of decor.lots) for (const o of lot.objets) {
      if (o.collision === 'roche') {
        assert(o.shape.startsWith('bitume-lieu-'), spec.id + ' : rocher géométrique résiduel (' + o.shape + ')');
        rochersOrganiques++;
      }
      if (o.shape === 'bitume-lieu-pyramide' || o.shape === 'bitume-lieu-pyramide-degres') {
        assert.equal(o.solidePhysX?.genre, 'pyramide', 'seuls les monuments de la nécropole ont une forme de pyramide');
        pyramides++;
      }
    }
    if (spec.theme === 'desert') {
      assert(decor.lieux.marqueurs.some(m => m.type === 'pyramides'));
      assert.equal(pyramides, 3, 'les trois monuments de la nécropole du témoin Roche-Fauve');
    }
    if (spec.theme === 'islande' || spec.theme === 'desert' || spec.theme === 'asie') {
      assert(rochersOrganiques > 15, spec.id + ' : rochers organiques attendus (' + rochersOrganiques + ')');
    } else if (spec.theme === 'pacifique') {
      assert(rochersOrganiques >= 1, spec.id + ' : rochers organiques attendus (' + rochersOrganiques + ')');
    }

    // Montage PhysX complet sans erreur (y compris les nouvelles formes bitume-lieu-*)
    const montage = B.solidesPhysX.installer(mondeFictif, c, decor);
    assert(montage.ids.length > 10, spec.id + ' : montage PhysX vide');
    B.solidesPhysX.liberer(montage);
    console.log('   ' + spec.id + ' : ' + decor.lieux.marqueurs.map(m => m.nom).join(' + ') + (pyramides ? ' (' + pyramides + ' pyramides)' : ''));
  }
});

verifier('reproductibilité stricte sans Math.random en mode organique', () => {
  const alea = Math.random;
  try {
    Math.random = () => { throw new Error('Math.random interdit'); };
    const c = B.circuit.creer(107, { theme: 'desert', longueur: 4800 });
    const a = B.decor.construire(c, { qualite: 'low', vegetationQualite: 'off', organique: true });
    const b = B.decor.construire(c, { qualite: 'low', vegetationQualite: 'off', organique: true });
    assert.deepEqual(a.lieux.marqueurs, b.lieux.marqueurs);
  } finally {
    Math.random = alea;
  }
});

console.log(controles + ' contrôles lieux organiques');
