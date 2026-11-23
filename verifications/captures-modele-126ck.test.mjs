import assert from 'node:assert/strict';
import { SCENARIOS_MODELE, optionsModele, verifierModele, comparerPresencePilote } from '../tools/qualification/captures-modele-126ck.mjs';

let controles = 0;
const tester = (nom, fn) => { fn(); controles++; };
const piece = (role, shape = 'box', pilote = false) => ({ role, shape, pilote, p: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1], mat: 0 });
const scenario = SCENARIOS_MODELE.find(s => s.id === 'habitacle-vide');
const rapport = () => ({ environnement: { webgpu: true }, erreurs: [], build: { sha256: 'candidat', octets: 10 }, images: [{
  etat: { referenceConservee: true }, observation: { type: 'course', ecran: 'course', gpuErreur: null, gpuPerdu: false,
    cameraImposee: true, sansPilote: true, obstructionStatique: false,
    piecesModele: ['volant', 'levier', 'pommeau', 'planche', 'support-volant-0'].map(r => piece(r)).concat(
      ['goutte', 'cuve', 'assise-pilote', 'arceau'].map(n => piece('coque:' + n, 'bitume-' + n))) }
}] });

tester('options bornées', () => {
  const o = optionsModele(['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/modele', '--cas', 'dessus,habitacle-vide']);
  assert.deepEqual(o.cas, ['dessus', 'habitacle-vide']);
  for (const cas of ['dessus,dessus', 'inconnu']) assert.throws(() => optionsModele(['--url', o.url, '--sortie', o.sortie, '--cas', cas]));
  assert.throws(() => optionsModele(['--url', 'https://example.org', '--sortie', o.sortie]));
});
tester('témoin habitacle complet accepté', () => assert.deepEqual(verifierModele(rapport(), scenario), []));
tester('pilote encore visible détecté', () => {
  const r = rapport(); r.images[0].observation.piecesModele.push(piece('bras-0', 'sphere', true));
  assert.ok(verifierModele(r, scenario).some(e => e.includes('Corps ou membres')));
});
tester('commandes retirées avec le pilote détectées', () => {
  const r = rapport(); r.images[0].observation.piecesModele = r.images[0].observation.piecesModele.filter(p => p.role !== 'volant');
  assert.ok(verifierModele(r, scenario).includes('Commande absente : volant'));
});
tester('siège conservé requis', () => {
  const r = rapport(); r.images[0].observation.piecesModele = r.images[0].observation.piecesModele.filter(p => p.shape !== 'bitume-assise-pilote');
  assert.ok(verifierModele(r, scenario).includes('Pièce structurelle absente : assise-pilote'));
});
tester('faux moteur et interruption ne passent pas', () => {
  const r = rapport(); r.environnement.webgpu = false; r.fatal = 'chrome indisponible';
  const e = verifierModele(r, scenario); assert.ok(e.includes('WebGPU absent')); assert.ok(e.some(x => x.startsWith('Capture interrompue')));
});
tester('pièces non finies détectées', () => {
  const r = rapport(); r.images[0].observation.piecesModele[0].p[0] = NaN;
  assert.ok(verifierModele(r, scenario).includes('Pièces absentes ou non finies'));
});
tester('comparaison retire seulement le pilote', () => {
  const sans = rapport().images[0].observation, avec = structuredClone(sans); avec.sansPilote = false;
  avec.piecesModele.reverse(); avec.piecesModele.push(piece('buste', 'bitume-pilote-buste', true));
  assert.deepEqual(comparerPresencePilote(avec, sans), []);
  avec.piecesModele.find(p => p.role === 'volant').p[0] += .01;
  assert.equal(comparerPresencePilote(avec, sans).length, 1);
});
tester('absence de données de comparaison ne passe pas', () => assert.equal(comparerPresencePilote({}, {}).length, 1));
tester('pilote requis dans les vues normales', () => {
  const r = rapport(); r.images[0].observation.sansPilote = false;
  assert.ok(verifierModele(r, SCENARIOS_MODELE.find(s => s.id === 'profil')).includes('Pilote attendu absent'));
});
console.log(`${controles} contrôles de capture du modèle 126 CK réussis.`);
