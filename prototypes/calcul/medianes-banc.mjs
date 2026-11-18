#!/usr/bin/env node
// Lot 28 « calcul » — médianes de plusieurs séries de courses de banc profilées, chaque série résumée par
// depouiller-banc.mjs. Usage : node prototypes/calcul/medianes-banc.mjs r0.json r1.json r2.json > medianes.json
import { readFileSync } from 'node:fs';
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const cas = {};
for (const f of process.argv.slice(2)) for (const c of JSON.parse(readFileSync(f, 'utf8')).courses) if (!c.fatal) (cas[c.fichier] = cas[c.fichier] || []).push(c);
const out = { unite: 'ms par image, médiane [min, max] des séries ; majorant (démarrage de la course dans le profil, fonctions de démarrage connues retirées du total)', cas: {} };
for (const [k, L] of Object.entries(cas)) {
  const g = f => { const v = L.map(f).filter(x => typeof x === 'number'); return v.length ? [+med(v).toFixed(2), +Math.min(...v).toFixed(2), +Math.max(...v).toFixed(2)] : null; };
  const m = n => c => c.parModule[n] ? c.parModule[n].msParImage : 0;
  out.cas[k] = { essais: L.length, horsDemarrageParImage: g(c => c.actifHorsDemarrageParImageMs), rendu: g(m('moteur/renderer.js')), rivaux: g(m('course.js')), voitures: g(m('voiture.js')),
    jeu: g(m('jeu.js')), images: L.map(c => c.images), p50: L.map(c => c.p50), pire: L.map(c => c.pire), herbierRefait: L.map(c => c.herbierRefait) };
}
console.log(JSON.stringify(out, null, 1));
