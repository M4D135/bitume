// Données exactes du tracé 13A, puis échantillonnage de 10 m pour la carte de conception.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
require('../../../../src/circuit.js');
const B = globalThis.BITUME;
const c = B.circuit.creer(179, { theme: 'baikal', longueur: 5400, nom: 'Baïkal' });
const h = createHash('sha256');
for (const k of ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse'])
  h.update(Buffer.from(c[k].buffer, c[k].byteOffset, c[k].byteLength));
const points = [];
for (let i = 0; i < c.n; i += 5)
  points.push({ s: i * c.pas, x: c.x[i], y: c.y[i], z: c.z[i], pente: c.pente[i] });
points.push({ ...points[0], s: c.longueur });
const donnees = {
  nom: c.nom, theme: c.theme, graine: c.graine, longueur: c.longueur, largeur: c.largeur,
  denivele: Math.max(...c.y) - Math.min(...c.y), penteMax: Math.max(...Array.from(c.pente, Math.abs)),
  rayonMin: 1 / Math.max(...Array.from(c.courbure, Math.abs)),
  ligneDroite: c.ligneDroite, stands: c.stands, erreurs: B.circuit.valider(c),
  empreinteGeometrie: h.digest('hex'), pasCarte: 10, points,
  note: 'Carte de conception calculée depuis la géométrie du jeu ; aucune capture WebGL ni route réelle.'
};
writeFileSync(new URL('./trace-baikal.json', import.meta.url), JSON.stringify(donnees, null, 2) + '\n');
console.log(JSON.stringify({ longueur: donnees.longueur, denivele: donnees.denivele,
  penteMax: donnees.penteMax, empreinteGeometrie: donnees.empreinteGeometrie }));
