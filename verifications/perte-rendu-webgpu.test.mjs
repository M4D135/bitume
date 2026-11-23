// Exécute les transitions de l’hôte avec un DOM et une file RAF contrôlés. Aucun GPU n'est ouvert.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
function fonction(nom) {
  const match = new RegExp('^  (?:async )?function ' + nom + '\\(', 'm').exec(source);
  assert.ok(match, nom);
  return source.slice(match.index, source.indexOf('\n  }\n', match.index) + 4);
}

function hote(ecran, chargement) {
  const appels = [], elements = new Map(), boutons = [];
  function element(id) {
    if (!elements.has(id)) elements.set(id, { id, hidden: id === 'erreur', inert: false, dataset: {},
      querySelector: nom => element(id + '/' + nom),
      focus() { appels.push('focus:' + id); }, addEventListener(type, cb) { this[type] = cb; }, append(b) { boutons.push(b); } });
    return elements.get(id);
  }
  const jeu = element('jeu');
  jeu.children = ['vue-course', 'titre', 'hud', 'autodetection', 'chargement', 'saisie-manette', 'erreur'].map(element);
  const contexte = vm.createContext({ jeu, ecran, $: element,
    document: { createElement: element }, location: { reload() { appels.push('relance'); } },
    contexteRenduPerdu: false, rendu: {}, imageDemandee: 0, avalerJusque: 400,
    prepa: { jeton: 4, enCours: chargement, voile: chargement, attente: chargement, focus: {}, rapport: chargement ? {} : null },
    session: { fx: {} }, B: { navigationMenu: { fermerSaisie(doc, refocus) { assert.equal(refocus, false); appels.push('fermer-saisie'); } },
      traces: { liberer() { appels.push('traces'); } } },
    libererVerre() { appels.push('verre'); }, libererRenduSecondaire() { appels.push('glaces'); },
    annulerConditions() { appels.push('annuler-meteo'); }, fermerLiaisonSalon() { appels.push('fermer-liaison'); },
    arreterManettes() { appels.push('arreter-manettes'); }, suspendreAnnoncesVirages() {},
    son: { musique(oui) { assert.equal(oui, false); }, suspendre() { appels.push('suspendre-son'); } },
    cancelAnimationFrame(id) { assert.equal(id, 0); appels.push('annuler-raf'); },
    requestAnimationFrame() { assert.fail('nouvelle image après la perte'); } });
  vm.runInContext(['signalerPerteGPU', 'erreur', 'annulerPreparation', 'image', 'preparerSeance', 'lancer', 'lancerVitrine', 'aller', 'attendreGPU'].map(fonction).join('\n'), contexte);
  return { contexte, element, appels, boutons };
}

for (const [ecran, chargement] of [['titre', false], ['demo', false], ['course', false], ['pause', false], ['demo', true]]) {
  test('perte WebGPU, écran ' + ecran + (chargement ? ' en préparation' : ''), async () => {
    const { contexte: h, element, appels, boutons } = hote(ecran, chargement);
    h.signalerPerteGPU({ message: 'périphérique remplacé' });
    h.signalerPerteGPU({ message: 'notification tardive' });
    assert.equal(h.ecran, 'erreur'); assert.equal(h.jeu.dataset.ecran, 'erreur');
    assert.equal(element('erreur/p').textContent, 'périphérique remplacé');
    assert.ok(h.jeu.children.every(el => el.id === 'erreur' ? !el.hidden && !el.inert : el.hidden && el.inert));
    assert.equal(appels.filter(a => a === 'annuler-raf').length, 1);
    assert.deepEqual(appels.filter(a => ['glaces', 'verre', 'traces'].includes(a)), ['verre', 'glaces', 'traces']);
    assert.equal(h.prepa.enCours, false); assert.equal(h.prepa.jeton, 5);
    if (chargement) { assert.equal(h.prepa.dernier.annule, true); assert.equal(h.prepa.focus, null); }
    h.image(1024); h.aller('titre');
    assert.equal(await h.preparerSeance('course', 0), null);
    assert.equal(h.lancerVitrine(0), null); assert.equal(h.lancer('demo', 0), null);
    h.erreur('Erreur secondaire', 'devrait rester derrière la première');
    assert.equal(element('erreur/h2').textContent, 'Le périphérique graphique a été interrompu');
    assert.equal(h.ecran, 'erreur'); assert.equal(boutons.length, 1); assert.ok(appels.includes('focus:button'));
    boutons[0].click(); assert.equal(appels.at(-1), 'relance'); assert.equal(h.avalerJusque, 0);
  });
}

test('la perte pendant une attente GPU ne poursuit pas la chauffe, une erreur indépendante reste identifiable', async () => {
  const { contexte: h } = hote('course', true);
  h.ANNULE = { annule: true };
  let reprendre;
  const moteur = { gpu: { device: { queue: { onSubmittedWorkDone: () => new Promise(resolve => { reprendre = resolve; }) } } } };
  const attente = h.attendreGPU(moteur);
  h.signalerPerteGPU(); reprendre();
  await assert.rejects(attente, e => e === h.ANNULE);
  const normal = hote('titre', false).contexte;
  const cause = Error('défaut de soumission');
  moteur.gpu.device.queue.onSubmittedWorkDone = async () => { throw cause; };
  await assert.rejects(normal.attendreGPU(moteur), e => e === cause);
});
