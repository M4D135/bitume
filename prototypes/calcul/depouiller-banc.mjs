#!/usr/bin/env node
// Lot 28 « calcul » — résumé des courses de banc profilées (serie-banc.sh) : temps propre de V8 par module et par
// image, part de chaque module, en séparant les fonctions de démarrage (faune, cibles de rendu, herbier refait).
//   node prototypes/calcul/depouiller-banc.mjs <dossier banc> > resume.json
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const dossier = process.argv[2];
// fonctions qui ne tournent qu'au départ ou à une reconstruction, pas à chaque image (lecture de src/)
const DEMARRAGE = [/^faune\.js · (habitats|creer|peupler)/, /^decor\.js · /, /^vegetation\.js · /, /^ecologie\.js · /, /^\(natif\) · checkFramebufferStatus/, /^moteur\/renderer\.js · (resize|setLots|setWorld|setNappes|create)/, /^botanique\.js · /, /^saisons\.js · /];
const sortie = [];
for (const f of readdirSync(dossier).filter(f => /^banc-.*\.json$/.test(f)).sort()) {
  const j = JSON.parse(readFileSync(path.join(dossier, f), 'utf8'));
  if (j.fatal) { sortie.push({ fichier: f, fatal: j.fatal.slice(0, 200) }); continue; }
  const b = j.valeur.banc, p = j.profilV8, images = b.images;
  let demarrage = 0; const parModuleImage = {};
  for (const [cle, ms] of p.parFonction) if (DEMARRAGE.some(r => r.test(cle))) demarrage += ms;
  const actifCourant = p.actifMs - demarrage;
  for (const [mod, ms] of p.parModule) parModuleImage[mod] = { msTotal: ms, msParImage: +(ms / images).toFixed(3), part: +(100 * ms / p.actifMs).toFixed(1) };
  sortie.push({ fichier: f, circuit: b.circuit, qualite: b.qualite, saison: b.reference.saison, meteo: b.reference.meteo, cpu: j.cpu,
    images, p50: b.p50, p95: b.p95, pire: b.pire, triangles: j.valeur.stats.triangles, drawCalls: j.valeur.stats.drawCalls,
    actifMs: p.actifMs, demarrageMs: +demarrage.toFixed(1), actifHorsDemarrageParImageMs: +(actifCourant / images).toFixed(2),
    herbierRefait: p.parFonction.some(([k]) => k.startsWith('decor.js · creerHerbier')),
    parModule: Object.fromEntries(Object.entries(parModuleImage).slice(0, 18)),
    fonctions: p.parFonction.slice(0, 20) });
}
console.log(JSON.stringify({ unite: 'temps propre du profileur échantillonné de V8 (200 µs), course de banc de 8 s après 1 s de chauffe ; msParImage = total ÷ images mesurées, donc majorant (le démarrage de la course est dans le profil)', courses: sortie }, null, 1));
