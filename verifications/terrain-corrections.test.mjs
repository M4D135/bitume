// Section 6 (complément 23/11) — protéger les corrections du terrain.
// Ne pas réintroduire un rejet global des faces (trous vus depuis le bas, dessous transparents)
// ni de falaise artificielle dans le versant des lacets empilés. Garde de régression.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const req = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'route-des-cimes', 'carene', 'botanique', 'ecologie', 'saisons', 'bords', 'decor']) req(resolve(ROOT, 'src', f + '.js'));
const B = globalThis.BITUME;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok ' + nom); };

verifier('le verrou FERRO reste à la version du double-face des nappes (≥ 0.3.33)', () => {
  const lock = JSON.parse(readFileSync(resolve(ROOT, 'FERRO.lock.json'), 'utf8'));
  const [maj, min, pat] = String(lock.version).split('.').map(Number);
  assert.ok(maj * 1e6 + min * 1e3 + pat >= 3033, `FERRO ${lock.version} < 0.3.33 : double-face des nappes (dessous plein, pas de trous vus du bas) perdu`);
});

for (const qualite of ['low', 'high']) {
  const c = B.routeDesCimes.creer(); B.bords.limites(c, B.bords.planifier(c));
  const d = B.decor.construire(c, { qualite, vegetation: false, saison: 'ete' });
  verifier(qualite + ' : versant des lacets empilés continu (aucune falaise de ~68 m réintroduite)', () => {
    const step = 15; let maxJump = 0, at = '', pts = 0;
    for (let x = 1150; x <= 1610; x += step) for (let z = -2370; z <= -2130; z += step) {
      const h = d.sol(x, z);
      assert.ok(Number.isFinite(h), `trou (sol non fini) au lacet (${x},${z})`);
      for (const [hh, lbl] of [[d.sol(x + step, z), 'x'], [d.sol(x, z + step), 'z']]) {
        const j = Math.abs(hh - h); if (j > maxJump) { maxJump = j; at = `(${x},${z})${lbl}`; }
      }
      pts++;
    }
    assert.ok(pts > 400, `versant sous-échantillonné (${pts} pts)`);
    assert.ok(maxJump < 40, `falaise réintroduite dans le versant : saut ${maxJump.toFixed(1)} m à ${at} (rampe attendue ~18 m, falaise ~68 m)`);
  });
}

console.log(`Corrections terrain (section 6) : ${n} vérifications réussies`);
