// Diagnostic hors CI. Fournir le src/traces.js exact de 54e98c9d809312e549013f1ce5ffe9836279209b.
// node docs/reprise/rapports/TRACES-FIABILITE-2026-11-19/preuve-historique.mjs /tmp/traces-54e98c9.js
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = new URL('../../../../', import.meta.url), req = createRequire(import.meta.url);
if (!process.argv[2]) throw new Error('Chemin du src/traces.js historique requis');
const ancien = readFileSync(process.argv[2], 'utf8');
assert.equal(createHash('sha256').update(ancien).digest('hex'), '8c52d9737c4fb93be231385210e83c610cce0ee342a4ff859870d442133a5c31');
for (const f of ['circuit', 'conduite', 'degats', 'course', 'carene', 'main', 'voiture']) req(fileURLToPath(new URL('src/' + f + '.js', root)));
const test = readFileSync(new URL('verifications/traces.test.mjs', root), 'utf8');
const debut = test.indexOf('function sceneComplete('), capture = test.indexOf('\nfunction etatEffets(', debut), fin = test.indexOf('\nfunction proche(', capture);
assert.ok(debut >= 0 && capture > debut && fin > capture, 'scénario et capture présents');
const jouer = new Function('B', 'T', 'DT', test.slice(debut, capture) + test.slice(capture, fin) + '\nconst {fx}=sceneComplete(); const valeurs=etatEffets(fx); for(let i=0;i<5;i++)valeurs["alea["+i+"]"]=fx.alea(); return valeurs;');
const sources = [ancien, readFileSync(new URL('src/traces.js', root), 'utf8')];
const resultats = sources.map(source => {
  runInThisContext(source);
  const valeurs = jouer(globalThis.BITUME, globalThis.BITUME.traces, 1 / 120);
  const h = createHash('sha256'), f64 = new Float64Array(1), octets = new Uint8Array(f64.buffer);
  for (const x of Object.values(valeurs)) { f64[0] = x; h.update(octets); }
  return { valeurs, empreinte: h.digest('hex') };
});
const differences = Object.keys(resultats[0].valeurs).filter(k => !Object.is(resultats[0].valeurs[k], resultats[1].valeurs[k]));
console.log(JSON.stringify({ node: process.version, plateforme: process.platform, architecture: process.arch,
  champs: Object.keys(resultats[0].valeurs).length, historique: resultats[0].empreinte, actuel: resultats[1].empreinte, differences }, null, 2));
assert.equal(differences.length, 0, 'le code historique et le code actuel doivent rester égaux sur ce scénario');
