import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/ambiance.js');
require('../src/graphismes.js');
const A = globalThis.BITUME.ambiance, G = globalThis.BITUME.graphismes;
const base = Object.freeze({ skyTop: [.09,.29,.62], skyBottom: [.62,.74,.87], fog: [.67,.75,.83],
  sunColor: [1.3,1.19,1.02], ambient: [.32,.37,.43], fogDensity: .000255,
  sunDirection: [.3,.7,-.46], biome: 'montagne', wind: .7 });
const copie = JSON.stringify(base);
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

verifier('jour/nuit sur chaque circuit, sans modifier la météo ni la densité de brume', () => {
  for (const montagne of [false, true]) {
    const e = A.creer(base, montagne);
    for (const mode of A.MODES) for (const t of [0, 60, 180, 359]) {
      A.appliquer(e, mode, t);
      assert.equal(e.atmosphere.fogDensity, base.fogDensity);
      assert.equal(e.atmosphere.wind, base.wind);
      assert.deepEqual(e.atmosphere.sunDirection, base.sunDirection);
      if (mode === 'jour') {
        assert.equal(e.nuit, 0);
        for (const cle of ['skyTop','skyBottom','fog','sunColor','ambient']) assert.deepEqual(e.atmosphere[cle],base[cle]);
      }
      if (mode === 'nuit') assert.equal(e.nuit,1);
    }
  }
  assert.equal(JSON.stringify(base),copie,'atmosphère de référence intacte');
  assert.notDeepEqual(A.appliquer(A.creer(base,true),'nuit',0).atmosphere.skyTop,
    A.appliquer(A.creer(base,false),'nuit',0).atmosphere.skyTop,'palette féerique réservée à la montagne');
});

verifier('la nuit est accessible immédiatement et le cycle garde une transition continue', () => {
  const e = A.creer(base, true);
  A.appliquer(e,'nuit',0); assert.equal(e.nuit,1);
  assert.ok(e.atmosphere.ambient[2] > .2,'éclairage nocturne lisible');
  A.appliquer(e,'crepuscule',0); assert.ok(e.nuit > .3 && e.nuit < .7);
  let avant = A.appliquer(e,'cycle',0).nuit, min = 1, max = 0;
  for (let t=.25;t<=A.DUREE_CYCLE+.25;t+=.25) {
    const n=A.appliquer(e,'cycle',t).nuit;
    assert.ok(Math.abs(n-avant)<.02,'aucun saut à la boucle ou au passage jour/nuit');
    min=Math.min(min,n);max=Math.max(max,n);avant=n;
  }
  assert.equal(min,0);assert.equal(max,1);
});

verifier('tampons partagés entre vues et actualisation de lumière bornée', () => {
  const e=A.creer(base,true), ref=e.atmosphere, couleurs=ref.skyTop;
  A.appliquer(e,'cycle',100); const rev=e.revision;
  A.appliquer(e,'cycle',100);
  assert.strictEqual(e.atmosphere,ref);assert.strictEqual(e.atmosphere.skyTop,couleurs);
  assert.equal(e.revision,rev,'une même image partagée ne renormalise pas deux fois');
  for(const mode of [null,{},'valeur obsolete']) assert.equal(A.normaliser(mode),'jour');
  A.appliquer(e,'cycle',NaN);assert.ok(Number.isFinite(e.nuit));
});

verifier('petit profil sans faune, maximum manuel conservé et prairie adaptée à Auto', () => {
  assert.equal(G.melange('low',0).faune,'off');
  assert.equal(G.melange('auto',4).faune,'off');
  for(let n=0;n<=4;n++) {
    const p=G.melange('auto',n,{options:{vegetation:'ultra',faune:'ultra'}});
    assert.equal(p.faune,'ultra');assert.strictEqual(p.groundCover,G.PRAIRIE.ultra);
  }
  assert.ok(G.melange('auto',4).groundCover.distance[1] < G.melange('auto',0).groundCover.distance[1]);
  assert.equal(G.melange('high',0,{options:{faune:'off'}}).faune,'off');
});
console.log(`${controles} contrôles ambiance/nature réussis.`);
