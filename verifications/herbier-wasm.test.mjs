import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const require = createRequire(import.meta.url);
const lire = nom => readFileSync(new URL('../' + nom, import.meta.url));
const octets = lire('src/herbier/noyau.wasm');
const binaire = new WebAssembly.Module(octets);
const { creer } = require('../prototypes/calcul/herbier/noyau-wasm.js');
const { noyauJS } = require('../prototypes/calcul/herbier/herbier-serre.js');
const source = lire('src/herbier-wasm.js').toString().replace('__BITUME_HERBIER_WASM__', octets.toString('base64'));

function activer(wasm = WebAssembly) {
  let decodages = 0;
  const contexte = { WebAssembly: wasm, performance, atob: s => { decodages++; return atob(s); } };
  runInNewContext(source, contexte);
  return { decouper: contexte.BITUME.herbierWasm.decouper, decodages: () => decodages };
}

function terrain(nb, eau = NaN) {
  const brutes = Int32Array.from({ length: nb }, (_, k) => k), LEN = new Float64Array(nb).fill(1);
  const P = new Float64Array(nb * 9), PL = new Float64Array(nb * 3);
  for (let k = 0; k < nb; k++) P.set([k, 0, 0, k + 1, 0, 0, k, 0, 1], 9*k);
  return { P, PL, LEN, VEG: new Uint8Array(nb).fill(1), brutes, M: new Float64Array(0), MOff: new Int32Array(1),
    CM: new Int32Array(0), CMO: new Int32Array(nb+1), CC: new Int32Array(0), CCO: new Int32Array(nb+1), eau };
}
function identite(a, b) {
  assert.deepEqual(Buffer.from(a.buffer,a.byteOffset,a.byteLength), Buffer.from(b.buffer,b.byteOffset,b.byteLength));
}

test('reconstruction canonique ; découpe sèche, eau et recouvrement identiques au JS', () => {
  const sha = b => createHash('sha256').update(b).digest('hex');
  assert.equal(sha(lire('prototypes/calcul/herbier/herbier.c')), '3ff4e61fa2c75044a4dbf42ece4ae736db8b72702f6373e81411cbae0dff1166');
  assert.equal(sha(octets), 'b829b98a06dfa5ebd9b3a3376da5f19195674338cbf66c3060b1b96fb0511760');
  for (const [nb,eau] of [[0,NaN],[1,1],[9,-1],[256,NaN]]) {
    const D = terrain(nb,eau); const sortie = creer(binaire)(D);
    identite(sortie,noyauJS(D)); assert.equal(sortie.buffer.byteLength,sortie.byteLength);
  }
  const D = terrain(2);
  D.M = Float64Array.from([0,0,.4,0,.4,.4,0,.4]); D.MOff = Int32Array.from([0,4]);
  D.CM = Int32Array.of(0); D.CMO = Int32Array.of(0,1,1);
  D.CC = Int32Array.of(1,0); D.CCO = Int32Array.of(0,1,2);
  identite(creer(binaire)(D),noyauJS(D));
});

test('à la demande à partir de 65 536 sources et sans instance mémorisée', () => {
  let instances = 0;
  const suivi = { Module: WebAssembly.Module, Memory: WebAssembly.Memory,
    Instance: class extends WebAssembly.Instance { constructor(...args) { super(...args); instances++; } } };
  const b = activer(suivi); assert.equal(b.decodages(),0);
  assert.equal(b.decouper({ brutes:{length:65535} }),null); assert.equal(b.decodages(),0);
  const D = terrain(65536);
  const premiere = b.decouper(D); assert.equal(b.decodages(),1); assert.equal(instances,1);
  identite(premiere,noyauJS(D));
  const suivante = b.decouper(D); assert.equal(instances,2); assert.equal(b.decodages(),1);
  identite(suivante,premiere);
  assert.equal(premiere.buffer.byteLength,premiere.byteLength,'sortie détachée de la mémoire linéaire');
});

test('compilateur absent, refus mémoire, débordement C et grandes tailles reviennent au JS', () => {
  const D = { brutes: { length: 65536 } };
  const absent = activer(null); assert.equal(absent.decouper(D),null); assert.equal(absent.decouper(D),null); assert.equal(absent.decodages(),1);
  const refus = activer({ Module: WebAssembly.Module, Instance: WebAssembly.Instance, Memory: class { constructor() { throw new RangeError(); } } });
  assert.equal(refus.decouper(D),null);
  const grand = terrain(1); grand.P = { length: 2**29+1 }; grand.brutes = D.brutes;
  assert.equal(activer().decouper(grand),null,'pas de rebouclage à 4 Gio');
  const cas = terrain(65536);
  for (const n of [-1,-2,-3,-4,12,2**30]) {
    const echec = activer({ Module: WebAssembly.Module, Memory: WebAssembly.Memory,
      Instance: class { constructor() { this.exports = {__heap_base:{value:66560}, noyau:()=>n}; } } });
    assert.equal(echec.decouper(cas),null,'sortie partielle interdite : '+n);
  }
});

test('raccord du jeu : la vitrine et les reprises de saison ne sollicitent jamais WebAssembly', () => {
  const decor = lire('src/decor.js').toString(), jeu = lire('src/jeu.js').toString();
  // creerHerbier enchaîne d'un trait les étapes de creerHerbierEtapes (le repli sans ouvrier les joue par images)
  const fonction = decor.match(/^  function\* creerHerbierEtapes\([\s\S]*?^  }$/m)[0] + '\n' + decor.match(/^  function creerHerbier\([\s\S]*?^  }$/m)[0];
  const appels = { wasm: 0, js: 0, relier: 0 }; let accepte = true;
  const contexte = { HERBIER: { lire: () => ({}), empreinte: () => 'identique', relier: D => { appels.relier++; return D; },
    noyau: () => { appels.js++; return new Float64Array(0); }, finir: () => ({triangles: []}) },
    B: { herbierWasm: { decouper: () => { appels.wasm++; return accepte ? new Float64Array(0) : null; } } },
    COMPTES_HERBIER: { decoupes: 0, reprises: 0, wasm: 0 } };
  runInNewContext(fonction,contexte);
  const construire = (autorise,ancien) => contexte.creerHerbier(null,null,null,null,null,NaN,ancien,autorise);
  construire(false); assert.deepEqual(appels,{ wasm:0, js:1, relier:1 });
  const a = construire(true); construire(true,a); assert.deepEqual(appels,{ wasm:1, js:1, relier:2 });
  accepte = false; construire(true); assert.deepEqual(appels,{ wasm:2, js:2, relier:3 });
  assert.equal(contexte.COMPTES_HERBIER.wasm,1);
  assert.match(jeu, /installer\(i, B\.saisons\.normaliser\(conditions\.saison\), null, type !== 'vitrine'(, [^)]*)?\)/);   // 5e argument facultatif : circuit de la fenêtre sans fin
  assert.match(jeu, /installer\(i, saison, panorama, type !== 'vitrine'(, [^)]*)?\)/);
  assert.match(decor, /entree && entree\.herbier, options\.herbierWasm !== false\)/);
});
