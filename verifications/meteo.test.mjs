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


// Le nouveau canvas pluie reçoit lui aussi des secondes et zéro pendant une pause.
const d0 = source.indexOf('  function dessinerMeteo(');
assert.ok(d0 >= 0, 'overlay météo présent');
let d1 = source.indexOf('{', d0), nd = 1;
for (d1++; nd && d1 < source.length; d1++) { if (source[d1] === '{') nd++; else if (source[d1] === '}') nd--; }
const raccords = [...source.matchAll(/^    dessinerMeteo\(S,\s*\w+\);/gm)];
assert.equal(raccords.length, 1, 'un raccord overlay dans le rendu');
for (const hz of [20, 30, 60, 144]) {
  const ctx = { setTransform(){}, clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fillRect(){} };
  const canvas = { width: 100000, height: 100000, clientWidth: 100000, clientHeight: 100000, getContext: () => ctx };
  const creer = new Function('document', 'window', `let meteoCtx = null, meteoDpr = 1;
    let meteoGouttes = Array.from({length:360}, () => ({x:0,y:0,l:10,v:620}));
    ${source.slice(d0,d1)}
    return { image(S,dureeImage,dtImage) { ${raccords[0][0]} }, lire() { return JSON.stringify(meteoGouttes); }, y() { return meteoGouttes[0].y; } };`);
  const test = creer({getElementById: () => canvas}, {devicePixelRatio:1});
  const S = {meteo:{pluie:1,nuage:0,eclair:0}};
  for (let k=0;k<10*hz;k++) test.image(S,1000/hz,1/hz);
  assert.ok(Math.abs(test.y()-6200)<1e-7, `${hz} Hz : pluie 620 px/s durant10s, reçu ${test.y()}`);
  const avant=test.lire(); for(let k=0;k<40;k++)test.image(S,250,0);
  assert.equal(test.lire(),avant, `${hz} Hz : pause fige les gouttes`);
  for(let k=0;k<hz;k++)test.image(S,1000/hz,1/hz);
  assert.ok(Math.abs(test.y()-6820)<1e-7, `${hz} Hz : pluie reprend sans rattrapage`);
  controles+=3;
}
console.log(`météo : ${controles} contrôles cadence, pause, reprise et overlay`);
