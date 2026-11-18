#!/usr/bin/env node
// Lot 28A-28C — résume les essais de serie-saison.sh : par version, circuit, processeur et étape, médiane [min–max] de la
// plus longue image, de la durée et du temps propre de l'herbier (chrono decor.herbier), plus la charge notée.
//   node prototypes/calcul/depouiller-saison.mjs <dossier des essais> <journal de la série> > resume.json
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const [dir, journal] = process.argv.slice(2);
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const mmm = a => a.length ? { med: +med(a).toFixed(0), min: Math.round(Math.min(...a)), max: Math.round(Math.max(...a)), n: a.length } : null;
const cas = {}, echecs = [];
for (const f of readdirSync(dir).filter(f => /^saison-(avant|apres)-c\d-cpu\d-r\d+\.json$/.test(f)).sort()) {
  const [, v, c, cpu] = /^saison-(\w+)-c(\d)-cpu(\d)/.exec(f), j = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
  if (j.fatal || !j.valeur) { echecs.push(f + ' : ' + String(j.fatal).slice(0, 120)); continue; }
  for (const e of j.valeur.etapes) {
    const k = `${e.etape} c${c} cpu${cpu} ${v}`, x = cas[k] || (cas[k] = { pireImage: [], ms: [], herbier: [], decor: [] });
    x.pireImage.push(e.pireImage); x.ms.push(e.ms);
    x.herbier.push(e.chronos['decor.herbier'] ? e.chronos['decor.herbier'].total : 0);
    x.decor.push(e.chronos['decor.construire'] ? e.chronos['decor.construire'].total : 0);
  }
}
const resume = {};
for (const k of Object.keys(cas).sort()) resume[k] = Object.fromEntries(Object.entries(cas[k]).map(([n, a]) => [n, mmm(a)]));
const charges = journal ? readFileSync(journal, 'utf8').trim().split('\n').filter(l => / charge /.test(l)) : [];
console.log(JSON.stringify({ unite: 'ms murales ; médiane, min, max, n essais', cas: resume, charges, echecs }, null, 1));
