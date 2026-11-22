// Même fabrique que la préparation du jeu, avec une instance neuve pour chaque scénario.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const jeu = readFileSync(new URL('../../src/jeu.js', import.meta.url), 'utf8');
export const catalogueJeu = JSON.parse(JSON.stringify(vm.runInNewContext(jeu.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1])));
const declaration = jeu.match(/  function circuit\(i\) \{[\s\S]*?\n  \}/)[0];
const fabrique = new Function('B', 'CATALOGUE', 'circuits', declaration + '; return circuit(0);');
export function creerCircuitCatalogue(B, definition) {
  require('../../src/route-des-cimes.js');
  require('../../src/marseille.js');
  require('../../src/larche-vinadio.js');
  return fabrique(B, [definition], []);
}
