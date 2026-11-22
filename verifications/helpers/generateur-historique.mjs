// Extraits indépendants de src/circuit.js aux commits 18451e0 (.52), f350dd7 (.59), f41614e (avant les Cimes).
// git show <commit>:src/circuit.js | gzip -n > verifications/fixtures/circuit-<version>.js.gz
// Comparer sur le même moteur conserve l'identité au bit près pour sin/cos sur ARM et x64.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import vm from 'node:vm';
const sha = {
  '0252': 'e872944198a9a9bcd0efdd8d33d5f201c4dfd98016cf04e0bccf4a5b5c9a674f',
  '0259': 'e6aa6ef807345c35f2016e192dcdb543dc682f50e604a483097052250965da98',
  '0266': '39389f4855fd9010c083baba6d3ed43aa8838817f484624eec5adff0aa4a5a72'
};
export function generateurHistorique(version) {
  const contenu = gunzipSync(readFileSync(new URL('../fixtures/circuit-' + version + '.js.gz', import.meta.url)));
  assert.equal(createHash('sha256').update(contenu).digest('hex'), sha[version]);
  return vm.runInNewContext(contenu.toString('utf8') + '\nBITUME.circuit;', {});
}
