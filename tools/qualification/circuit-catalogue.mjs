// Même fabrique que la préparation du jeu, avec une instance neuve pour chaque scénario.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const jeu = readFileSync(new URL('../../src/jeu.js', import.meta.url), 'utf8');
const declaration = jeu.match(/  function circuit\(i\) \{[\s\S]*?\n  \}/)[0];
const fabrique = new Function('B', 'CATALOGUE', 'circuits', declaration + '; return circuit(0);');
export function creerCircuitCatalogue(B, definition) {
  require('../../src/route-des-cimes.js');
  require('../../src/marseille.js');
  require('../../src/larche-vinadio.js');
  return fabrique(B, [definition], []);
}
