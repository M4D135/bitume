// Régression du raccord entre la boucle de rendu (secondes) et la météo.
// On exerce la fonction ET son appel réel de jeu.js, sans démarrer le DOM/WebGL.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const fichier = process.argv[2] || new URL('../src/jeu.js', import.meta.url);
const source = readFileSync(fichier, 'utf8');
const debut = source.indexOf('  function majMeteo(');
assert.ok(debut >= 0, 'fonction météo présente');
let fin = source.indexOf('{', debut), niveau = 1;
for (fin++; niveau && fin < source.length; fin++) {
  if (source[fin] === '{') niveau++;
  else if (source[fin] === '}') niveau--;
}
assert.equal(niveau, 0, 'fonction météo complète');
const appels = [...source.matchAll(/const meteo = majMeteo\(S,\s*\w+\);/g)];
assert.equal(appels.length, 1, 'un raccord météo dans le rendu');
const image = new Function('S', 'dureeImage', 'dtImage', source.slice(debut, fin) + '\n' + appels[0][0] + '\nreturn meteo;');
let controles = 0;
for (const hz of [20, 30, 60, 144]) {
  const S = {};
  for (let k = 0; k < 10 * hz; k++) image(S, 1000 / hz, 1 / hz);
  assert.ok(Math.abs(S.meteo.t - 10) < 1e-9, `${hz} Hz : 10 s de jeu doivent donner 10 s de météo, reçu ${S.meteo.t}`);
  assert.equal(S.meteo.phase, 'clair', `${hz} Hz : pas de changement de phase prématuré`);
  const avant = JSON.stringify(S.meteo);
  for (let k = 0; k < 40; k++) image(S, 250, 0);
  assert.equal(JSON.stringify(S.meteo), avant, `${hz} Hz : la pause fige toute la météo`);
  for (let k = 0; k < hz; k++) image(S, 1000 / hz, 1 / hz);
  assert.ok(Math.abs(S.meteo.t - 11) < 1e-9, `${hz} Hz : reprise sans rattrapage du temps de pause`);
  controles += 4;
}
console.log(`météo : ${controles} contrôles cadence, pause et reprise`);
