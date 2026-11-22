import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
for (const f of ['moteur/renderer', 'circuit', 'couverts', 'route-des-cimes', 'route-des-cimes-decor', 'larche-vinadio-data', 'larche-vinadio', 'larche-vinadio-decor', 'marseille', 'marseille-decor', 'destinations', 'carene', 'botanique', 'ecologie', 'saisons', 'vegetation', 'bords', 'baikal', 'batiments', 'lieux', 'decor', 'ambiance', 'animaux']) require('../src/' + f + '.js');
const B = globalThis.BITUME, A = B.animaux;
const jeu = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const catalogue = vm.runInNewContext(jeu.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1], { B });

for (const k of catalogue) {
  const c = k.id === 'larche' ? B.larche.creer(k.graine) : k.id === 'marseille' ? B.marseille.creer(k.graine) : B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom, partition: k.partition });
  if (!c.ouvert) B.bords.limites(c, B.bords.planifier(c));
  const decor = B.decor.construire(c, { organique: true, qualite: 'low', vegetation: false, vegetationQualite: 'off', saison: 'ete' });
  const e = A.creer(c, decor, { saison: 'ete' });
  const debut = c.ouvert ? c.depart : 0, fin = c.ouvert ? c.arrivee : c.longueur;
  const secteurs = new Set(e.groupes.map(g => Math.floor((g.s - debut) / 1000)));
  const contexte = { vue: 0, qualite: 'low', hauteur: 720, aspect: 16 / 9, camera: { pos: [0, 0, 0], pitch: 0, yaw: 0, fov: 70 } };
  let visibles = 0, stations = 0;
  const sortie = [];
  for (let s = debut; s < fin; s += 90) {
    const p = B.circuit.echantillon(c, s), cam = contexte.camera;
    cam.pos[0] = p.x; cam.pos[1] = p.y + 1.25; cam.pos[2] = p.z; cam.yaw = p.cap + Math.PI / 2;
    cam.pitch = Math.atan(p.pente || 0);
    sortie.length = 0;
    A.dessiner(e, stations * .1, contexte, sortie);
    assert(sortie.length <= A.BUDGETS.low.objets, k.id + ' : budget silhouette');
    if (sortie.length) visibles++;
    stations++;
  }
  console.log(k.id, e.groupes.length, 'groupes au sol,', e.volants.length, 'volées,', secteurs.size, 'secteurs kilométriques,', visibles + '/' + stations, 'vues légères,', e.G.N, 'cases');
  assert(e.groupes.length > 0, k.id + ' : habitat au sol');
  assert(secteurs.size >= Math.floor((fin - debut) / 1000) * .55, k.id + ' : répartition des groupes');
  assert(visibles / stations >= .18, k.id + ' : présence en vue de conduite');
  if (k.id === 'larche') {
    assert(e.G.N < 2500000, 'grille en corridor pour les 32 km');
    assert(e.groupes.length >= 100, 'rencontres réparties le long de la descente');
  }
  for (const g of e.groupes) {
    assert(g.s >= debut && g.s <= fin + c.pas);
    assert(A.praticable(e.G, g.hab, A.cellule(e.G, g.hx, g.hz), false));
  }
  contexte.qualite = 'off'; sortie.length = 0;
  A.dessiner(e, 0, contexte, sortie); assert.equal(sortie.length, 0);
}
