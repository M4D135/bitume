// Les circuits retirés du menu restent des scénarios de régression aux graines d’origine.
import { readFileSync } from 'node:fs';
const source = JSON.parse(readFileSync(new URL('../fixtures/circuits-historiques-cimes.json', import.meta.url), 'utf8'));
export const historiques = source.circuits.map(c => c.catalogue);
export function definitionHistorique(catalogue, id) {
  const definition = catalogue.find(c => c.id === id) || historiques.find(c => c.id === id);
  if (!definition) throw new Error('Circuit de référence inconnu : ' + id);
  return definition;
}
