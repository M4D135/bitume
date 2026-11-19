// Observation seule de la même course : les commandes, états, collisions et règles de fin restent intacts.
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const require = createRequire(path.resolve('diagnostic-russie.cjs'));
for (const n of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'botanique', 'ecologie', 'saisons',
  'vegetation', 'bords', 'carene', 'decor', 'meteo', 'strategie-stands', 'course']) require(path.resolve('src', n + '.js'));
const B = globalThis.BITUME, original = B.course.pas;
const avant = {}, derniersEvenements = [], fenetre = [], incidents = [];
for (const n of ['src/circuit.js', 'src/course.js', 'src/conduite.js', 'src/decor.js', 'verifications/russie.test.mjs']) {
  avant[n] = createHash('sha256').update(readFileSync(n)).digest('hex');
}
let appels = 0, precedent = false, replacements = 0;
function pose(v) {
  const e = v.etat;
  return structuredClone({ id: v.id, s: e.s, d: e.d, v: e.v, psi: e.psi, beta: e.beta, omega: e.omega,
    accident: e.accident, recuperation: e.recuperation, replacements: e.repositionnements || 0,
    dommages: e.degats, tour: v.tours, progression: v.progression });
}
B.course.pas = function(...args) {
  const co = args[0], ev = original.apply(this, args); appels++;
  const v = co.voitures.find(v => v.id === 7);
  if (!v) return ev;
  for (const e of ev) if (['contact', 'choc', 'accident'].includes(e.type)) {
    derniersEvenements.push({ temps: co.temps, horloge: co.horloge, ...e });
    if (derniersEvenements.length > 100) derniersEvenements.shift();
  }
  if (appels % 12 === 0) {
    fenetre.push({ temps: co.temps, horloge: co.horloge, voitures: co.voitures.map(pose) });
    if (fenetre.length > 40) fenetre.shift();
  }
  const accident = !!(v.etat.accident || v.etat.recuperation), nombre = v.etat.repositionnements || 0;
  if ((accident && !precedent) || nombre > replacements) {
    const obstacles = ev.filter(e => e.type === 'choc' && e.obstacleId !== undefined)
      .map(e => co.c.obstacles.objets.find(o => o.id === e.obstacleId));
    incidents.push(JSON.parse(JSON.stringify({ temps: co.temps, horloge: co.horloge,
      cible: pose(v), piste: B.circuit.echantillon(co.c, v.etat.s), evenements: ev,
      obstacles, derniersEvenements, fenetre })));
  }
  precedent = accident; replacements = nombre;
  return ev;
};
process.on('exit', () => {
  if (!appels) return;
  writeFileSync(new URL('./trace.json', import.meta.url), JSON.stringify({ observationSeulement: true,
    appels, sourceSha256: avant, incidents }, null, 2) + '\n');
});
