// Vérification de la forêt continue (FEUILLE-DE-ROUTE, lot 1 reste) : moins de 10 % du tour sans arbre à
// moins de 200 m, au moins 20 arbres par tronçon de 300 m hors stands, plafond de 2 600, construction < 150 ms.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));
charger('carene.js'); charger('circuit.js'); charger('decor.js');
const C = globalThis.BITUME.circuit, D = globalThis.BITUME.decor;

// même catalogue que src/jeu.js
const CATALOGUE = [
  { id: 'val-brule', nom: 'Val-Brûlé', theme: 'foret', graine: 11, longueur: 4200 },
  { id: 'port-sable', nom: 'Port-Sable', theme: 'cote', graine: 29, longueur: 3600 },
  { id: 'haut-col', nom: 'Haut-Col', theme: 'montagne', graine: 47, longueur: 5200 }
];

let compte = 0;
const verifier = (nom, f) => { try { f(); compte++; } catch (e) { console.error(`FAIL ${nom}: ${e.message}`); process.exit(1); } };

for (const k of CATALOGUE) {
  const c = C.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom });
  const t0 = performance.now();
  const decor = D.construire(c);
  const ms = performance.now() - t0;
  verifier(`${k.nom} : décor construit en moins de 150 ms`, () => assert.ok(ms < 150, `${ms.toFixed(0)} ms`));
  const arbres = decor.arbres;
  verifier(`${k.nom} : la construction rend la liste des arbres`, () => assert.ok(Array.isArray(arbres) && arbres.length > 0, 'decor.arbres absente ou vide'));
  verifier(`${k.nom} : plafond de 2 600 arbres tenu`, () => assert.ok(arbres.length <= 2600, `${arbres.length} arbres`));
  verifier(`${k.nom} : l'eau reste sous la piste (virage de Port-Sable)`, () => {
    let yMin = Infinity;
    for (let i = 0; i < c.n; i++) yMin = Math.min(yMin, c.y[i]);
    assert.ok(decor.niveauEau === undefined || decor.niveauEau <= yMin - 2, `niveau ${decor.niveauEau}, piste ${yMin.toFixed(1)}`);
  });

  // le plus proche arbre de chaque échantillon de piste (par 25 m)
  const pas = Math.max(1, Math.round(25 / C.PAS));
  let sans = 0, total = 0;
  const plusProche = (x, z) => { let d = Infinity; for (const [ax, az] of arbres) { const dx = ax - x, dz = az - z, e = dx * dx + dz * dz; if (e < d) d = e; } return Math.sqrt(d); };
  for (let i = 0; i < c.n; i += pas) { if (plusProche(c.x[i], c.z[i]) > 200) sans++; total++; }
  verifier(`${k.nom} : moins de 10 % du tour sans arbre à 200 m`, () => assert.ok(sans / total < .10, `${(100 * sans / total).toFixed(0)} % du tour sans arbre proche`));

  // densité par tronçon de 300 m hors stands (la zone des tribunes et stands est à |écart| < 320 m du départ)
  const parTroncon = new Map();
  for (const [ax, az] of arbres) {
    let d = Infinity, j = -1;
    for (let i = 0; i < c.n; i++) { const dx = c.x[i] - ax, dz = c.z[i] - az, e = dx * dx + dz * dz; if (e < d) { d = e; j = i; } }
    const s = j * C.PAS, t = Math.floor(s / 300);
    parTroncon.set(t, (parTroncon.get(t) || 0) + 1);
  }
  const nTroncons = Math.floor(c.longueur / 300);
  let vides = [];
  for (let t = 0; t < nTroncons; t++) {
    const s = t * 300 + 150;
    if (Math.abs(C.ecart(c, 0, s)) < 320) continue; // tronçon dans la zone des stands : hors critère
    const n = parTroncon.get(t) || 0;
    if (n < 20) vides.push(`${t * 300} m : ${n}`);
  }
  verifier(`${k.nom} : au moins 20 arbres par tronçon de 300 m hors stands`, () => assert.equal(vides.length, 0, vides.slice(0, 6).join(', ')));
}

console.log(`forêt : ${compte} vérifications passées`);
