// Les mutations utilisent le candidat EXPLICITE ; jamais le dist historique de la branche 01.
// BITUME_HTML=/chemin/candidat/dist/bitume.html node verifications/troll-assemble.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { optionsTrollAssemble, modulesDuHtml, qualifierHtml } from '../tools/qualification/troll-assemble.mjs';

test('options : candidat et rapport distincts, options inconnues/répétées refusées', () => {
  assert.throws(() => optionsTrollAssemble([]), /nécessaires/);
  assert.throws(() => optionsTrollAssemble(['--html', 'a', '--sortie', 'a']), /écraser/);
  assert.throws(() => optionsTrollAssemble(['--html', 'a', '--html', 'b', '--sortie', 'c']), /uniques/);
  assert.throws(() => optionsTrollAssemble(['--html', 'a', '--sortie', 'b', '--inconnu', 'c']), /Usage/);
  assert(optionsTrollAssemble(['--html', 'a.html', '--sortie', 'b.json']).html.endsWith('/a.html'));
});

test('HTML incomplet ou module dupliqué : refus sans repli sur src', () => {
  assert.throws(() => modulesDuHtml('<html></html>'), /absent/);
  assert.throws(() => modulesDuHtml('<script>\n// ---- jeu.js ----\n0;</script><script>\n// ---- jeu.js ----\n1;</script>'), /dupliqué/);
  const r = qualifierHtml('<html></html>');
  assert.equal(r.echecs, 1); assert.equal(r.qualificationWebGL, false); assert.equal(r.ecouteAudio, false);
});

const chemin = process.env.BITUME_HTML;
const options = { skip: chemin ? false : 'BITUME_HTML absent : aucun candidat assemblé implicite sur cette branche' };
let html;
const lire = () => html ??= readFileSync(chemin, 'utf8');
const mutation = (avant, apres) => {
  const h = lire(), n = h.split(avant).length - 1;
  assert.equal(n, 1, 'point de mutation exact et unique : ' + avant);
  return h.replace(avant, apres);
};

test('candidat exact : commandes, sons, temporalité et retour des vrais modèles', options, () => {
  const r = qualifierHtml(lire());
  assert.equal(r.echecs, 0, JSON.stringify(r.controles.filter(c => c.statut !== 'ok')));
  assert.equal(r.controles.length, 4);
  assert.equal(r.qualificationWebGL, false); assert.equal(r.ecouteAudio, false);
  for (const nom of ['autoconfig.js', 'commandes-manette.js']) assert.match(r.modules[nom], /^[a-f0-9]{64}$/, nom + ' identifié depuis le HTML');
  for (const c of r.controles.slice(0, 2)) {
    assert.equal(c.preuve.mesures.length, 9); assert.equal(c.preuve.pas, 253);
    assert(c.preuve.poses >= 2500); assert.equal(c.preuve.sources.length, 2);
  }
});

for (const nom of ['autoconfig.js', 'commandes-manette.js']) test('dépendance de commandes absente : ' + nom, options, () => {
  const r = qualifierHtml(mutation('// ---- ' + nom + ' ----', '// ---- absent-' + nom + ' ----'));
  assert.equal(r.echecs, 1); assert.equal(r.controles.length, 1);
  assert.equal(r.controles[0].nom, 'chargement-HTML-exact');
  assert.equal(r.controles[0].erreur, 'Module embarqué absent : ' + nom);
});

for (const [nom, avant, apres, attendu] of [
  ['consommation coupée', '      consommerTroll(S, poses);', '      /* consommation retirée pour contrôle négatif */', /exactement une source audio par départ accepté/],
  ['choix J2 remplacé par J1', 'const c = S.enLigne?.troll?.pilotes?.[S.locaux[n]] || choix?.[n];', 'const c = choix?.[0];', /choix du geste conservé par place locale/],
  ['son émis deux fois', "      son.evenement('troll', audio);", "      son.evenement('troll', audio); son.evenement('troll', audio);", /exactement une source audio par départ accepté/],
  ['répétition clavier acceptée', '    if (e.repeat) { if (course) e.preventDefault(); return; }', '    if (false) { if (course) e.preventDefault(); return; }', /répétition clavier ignorée même après réarmement/],
  ['phase figée', 'o.gestePhase = clamp(age / DUREES[p.geste], 0, 1);', 'o.gestePhase = 0;', /phase temporelle strictement croissante/],
  ['retour supprimé', 'if (age >= DUREES[p.geste] || p.retourA !== -Infinity && t - p.retourA >= .14)', 'if (false)', /retour terminé à la durée attendue/]
]) test('oracle négatif : ' + nom, options, () => {
  const r = qualifierHtml(mutation(avant, apres));
  assert(r.echecs > 0, 'la qualification doit refuser : ' + nom);
  assert(r.controles.some(c => c.nom !== 'chargement-HTML-exact' && c.statut === 'echec'), 'la mutation doit atteindre une assertion de comportement');
  const echecs = r.controles.filter(c => c.statut === 'echec');
  assert(echecs.every(c => /^AssertionError\b/.test(c.pile?.[0] || '')), 'aucun échec de montage ne doit valider le contrôle négatif');
  assert(echecs.some(c => attendu.test(c.erreur)), 'la mutation doit atteindre son assertion métier : ' + nom);
});
