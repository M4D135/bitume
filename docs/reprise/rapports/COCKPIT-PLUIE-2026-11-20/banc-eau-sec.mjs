// Mesure CPU Node, pas mesure graphique ou matérielle du jeu.
// Depuis la racine : node ce-fichier.mjs /chemin/avant.js src/eau-carrosserie.js /chemin/rapport.json
// La source avant se reconstruit depuis après avec eau-sec-correctif.patch appliqué à l'envers.
import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import os from 'node:os';
const [avant, apres, sortie] = process.argv.slice(2);
if (!avant || !apres || !sortie) throw new Error('Sources avant/après et sortie JSON requises');
const c = vm.createContext({ console });
vm.runInContext('window=globalThis', c);
for (const n of ['moteur/renderer', 'carene', 'main', 'humain-donnees', 'humain-corps', 'ferro/vehicle-dynamics',
  'pneus', 'usure-pneus', 'chaussee', 'conduite', 'voiture']) vm.runInContext(fs.readFileSync('src/' + n + '.js', 'utf8'), c);
const V = c.BITUME.voiture, cas = [];
for (const [nom, chemin] of [['avant', avant], ['apres', apres]]) {
  const source = fs.readFileSync(chemin, 'utf8'); vm.runInContext(source, c);
  const E = c.BITUME.eauCarrosserie;
  const modeles = Array.from({ length: 12 }, (_, k) => V.modele({ couleur: [.8, .12, .1], numero: k + 1 }));
  for (const m of modeles) V.preparerPneusService(m);
  const debut = performance.now();
  const etats = modeles.map((m, k) => E.preparer(m, k + 37));
  cas.push({ nom, E, etats, source_sha256: createHash('sha256').update(source).digest('hex'), preparation_ms: performance.now() - debut,
    temps: 0, series: [] });
}
const pose = { tangage: 0, roulis: 0 }, sec = { pluie: 0, precipitationsNeige: false }, pluie = { pluie: 1, precipitationsNeige: false };
const pas = (s, meteo) => { s.temps += 1 / 60; for (const e of s.etats) s.E.mettreAJour(e, 1 / 60, meteo, 35, false, s.temps, pose); };
const stats = a => { a.sort((x, y) => x - y); return { p50_ms: a[Math.floor(a.length * .5)], p95_ms: a[Math.floor(a.length * .95)], maximum_ms: a.at(-1) }; };
for (const meteo of [sec, pluie]) {
  for (const s of cas) for (let n = 0; n < 60; n++) pas(s, meteo);
  for (let serie = 0; serie < 5; serie++) for (const s of serie % 2 ? [...cas].reverse() : cas) {
    const mesures = [];
    for (let n = 0; n < 180; n++) { const debut = performance.now(); pas(s, meteo); mesures.push(performance.now() - debut); }
    s.series.push({ meteo: meteo.pluie ? 'pluie' : 'sec', serie, images: mesures.length, ...stats(mesures) });
  }
}
const rapport = { schema: 1, date_utc: new Date().toISOString(), environnement: { node: process.version, plateforme: process.platform,
  architecture: process.arch, cpu: os.cpus()[0]?.model }, protocole: { voitures: 12, perles_par_voiture: 192, pas_s: 1 / 60,
  vitesse_m_s: 35, chauffe_images_par_etat: 60, series_alternees: 5, images_par_serie: 180,
  portee: 'mettreAJour des douze carrosseries uniquement, aucun rendu, aucune physique, aucune mesure FPS Xbox/Intel ; charge hôte non isolée' },
  sources_communes: Object.fromEntries(['src/voiture.js', 'src/moteur/renderer.js'].map(p => [p, createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),
  resultats: cas.map(({ nom, source_sha256, preparation_ms, series }) => ({ nom, source_sha256, preparation_ms, series })) };
fs.writeFileSync(sortie, JSON.stringify(rapport, null, 2) + '\n');
for (const s of rapport.resultats) for (const meteo of ['sec', 'pluie']) {
  const a = s.series.filter(x => x.meteo === meteo);
  console.log(s.nom, meteo, JSON.stringify({ mediane_p50_ms: a.map(x => x.p50_ms).sort((x, y) => x - y)[2], mediane_p95_ms: a.map(x => x.p95_ms).sort((x, y) => x - y)[2] }));
}
