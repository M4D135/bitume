// Vérification des formes libres émises par le moteur (retouche BITUME n° 11 de PROVENANCE.md) :
// geometry() doit émettre les triangles des formes libres dans l'ordre du registre, sans les réorienter.
// renderer.js est chargé avec un faux WebGL2 qui capture les tampons envoyés par create().
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));

// --- faux WebGL2 : constantes numérotées, méthodes muettes, bufferData capturé
let prochain = 0;
const constances = new Map(), captures = [], courant = {};
const gl = new Proxy({}, {
  get(cible, cle) {
    if (typeof cle !== 'string') return undefined;
    if (/^[A-Z][A-Z0-9_]*$/.test(cle)) { if (!constances.has(cle)) constances.set(cle, ++prochain); return constances.get(cle); }
    switch (cle) {
      case 'getParameter': return p => (p === constances.get('MAX_TEXTURE_SIZE') ? 8192 : 4096);
      case 'getShaderParameter': case 'getProgramParameter': return () => true;
      case 'getShaderInfoLog': case 'getProgramInfoLog': return () => '';
      case 'checkFramebufferStatus': return () => constances.get('FRAMEBUFFER_COMPLETE');
      case 'getUniformLocation': return () => ({});
      case 'getAttribLocation': return () => 0;
      case 'getExtension': return () => null;
      case 'getContextAttributes': return () => ({});
      case 'bindBuffer': return (target, buffer) => { courant[target] = buffer; };
      case 'bufferData': return (target, data) => { captures.push({ cible: courant[target], data }); };
      default: return cle.startsWith('create') ? () => ({ id: ++prochain }) : () => {};
    }
  }
});

globalThis.window = { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
charger('moteur/renderer.js');
const R = globalThis.window.FRender;
assert.ok(R && R.forme, 'FRender.forme est enregistré');
// la voiture se charge après le moteur : elle enregistre ses carènes dans le registre du moteur
charger('carene.js');
charger('main.js');
charger('voiture.js');
const V = globalThis.BITUME.voiture;

const canvas = { getContext: () => gl, addEventListener() {}, removeEventListener() {}, clientWidth: 800, clientHeight: 600, width: 800, height: 600 };
R.create(canvas);

const sommets = captures.find(c => c.data instanceof Float32Array && c.data.length > 6).data;
const index = captures.find(c => c.data instanceof Uint32Array && c.data.length > 3).data;
assert.ok(sommets && index, 'les tampons de geometry() sont envoyés');

let totalTri = 0;
for (const nom of Object.keys(V.FORMES)) totalTri += V.FORMES[nom].tri.length;
assert.ok(totalTri > 5000, `${totalTri} triangles au registre`);
let k = index.length - totalTri * 3;
assert.ok(k > 0, 'les formes libres sont émises en dernier');

let defauts = [];
for (const nom of Object.keys(V.FORMES)) {
  const f = V.FORMES[nom];
  for (let j = 0; j < f.tri.length; j++) {
    const t = f.tri[j], i = [index[k++], index[k++], index[k++]];
    if (!(i[0] < i[1] && i[1] < i[2])) defauts.push(`${nom}#${j} : ordre émis inversé`);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      if (Math.abs(sommets[i[r] * 6 + c] - t[r][c]) > 1e-6) defauts.push(`${nom}#${j} : sommet ${r} hors registre`);
      if (Math.abs(sommets[i[r] * 6 + 3 + c] - t[3 + r][c]) > 1e-6) defauts.push(`${nom}#${j} : normale ${r} hors registre`);
    }
  }
}
assert.deepEqual(defauts.slice(0, 5), [], `${defauts.length} triangles de formes libres émis hors de l'ordre du registre`);
console.log(`formes libres : ${totalTri} triangles émis dans l'ordre du registre`);
