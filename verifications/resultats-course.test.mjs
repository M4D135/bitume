import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const jeu = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const resultat = jeu.match(/  function montrerResultats\([^)]*\) \{[\s\S]*?\n  \}/)[0];
const chrono = jeu.match(/  function chrono\(t\) \{[\s\S]*?\n  \}/)[0];
function afficher({ mode = 'course', fini = false, abandon = false, termine = true, final = true, meilleur = null }) {
  const pilote = { id: 0, joueur: true, position: 1, nom: 'Vous', numero: 1, couleur: [1, 0, 0],
    tours: fini ? 1 : 0, fini, abandon, tempsFinal: fini ? 125.5 : null, tempsTours: fini ? [125.5] : [], meilleur };
  const course = { c: { ouvert: true }, mode, termine, joueur: pilote, voitures: [pilote], classement: [0], toursTotal: 1, difficulte: 1 };
  const noeuds = { 'res-sous': {}, 'res-titre': {}, 'res-lignes': {} };
  const contexte = { S: { i: 0, course }, final, CATALOGUE: [{ id: 'larche', nom: 'Larche' }], records: {},
    $: id => noeuds[id], document: { querySelector: () => ({}) }, boutonsResultats() {}, aller() {}, finirClassement() {} };
  runInNewContext(chrono + '\n' + resultat + '\nmontrerResultats(S, final);', contexte);
  return [noeuds['res-titre'].textContent, noeuds['res-sous'].textContent, noeuds['res-lignes'].innerHTML];
}

test('la clôture de la course distingue ligne franchie, voiture en piste et abandon', () => {
  const [titre, sousTitre, lignes] = afficher({});
  assert.match(titre, /Ligne non franchie/);
  assert.match(lignes, /Non arrivé/);
  assert.match(sousTitre, /1 tour ·/);
  assert.match(afficher({ termine: false })[2], /en piste/);
  assert.match(afficher({ final: false })[2], /en piste/);
  assert.match(afficher({ fini: true })[0], /Victoire/);
  assert.match(afficher({ abandon: true })[0], /Abandon/);
});

test('la spéciale affiche le temps réalisé même quand le chrono ne compte pas pour un record', () => {
  for (const meilleur of [null, 125.5]) {
    const [titre, detail, lignes] = afficher({ mode: 'chrono', fini: true, meilleur });
    assert.match(titre, /Arrivée de la spéciale/);
    assert.match(detail, /temps 2:05,500/);
    assert.equal(detail.includes('hors record'), meilleur === null);
    assert.match(lignes, /<td>–<\/td>/u);
  }
});
