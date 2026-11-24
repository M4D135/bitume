// Raccord réel jeu.js : les champs affichés pilotent l'activité, sans caméra partagée mutable.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
function fonction(nom) {
  const a = source.indexOf(`  function ${nom}(`), b = source.indexOf('\n  }', a);
  assert(a >= 0 && b > a, `fonction de production ${nom}`);
  return source.slice(a, b + 4);
}
function banc() {
  const glaces = [-1, 1].map(k => ({ k, centre: [k * .3, 0, -1], normale: [0, 0, 1],
    coins: [[k * .3 - .12, .06, -1], [k * .3 + .12, .06, -1], [k * .3 + .12, -.06, -1], [k * .3 - .12, -.06, -1]] }));
  const appels = [];
  const c = vm.createContext({
    Math, reglages: { faune: 'high', retro: 'oui' }, canvas: { width: 1280, height: 720 },
    retro: { l: 200, h: 80 }, PORTEE_VUE: 6000,
    POSE_GLACES: { p: [0, 0, 0] }, ETATS_GLACES: [{ glaces }, { glaces }],
    $: () => ({ height: 128 }), clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
    profilDe: () => ({ palier: 'high' }),
    B: { voiture: { glacesCockpit: () => glaces }, animaux: {
      qualite: r => r, selectionnerVues: (etat, vues, n) => appels.push(structuredClone({ etat, vues, n }))
    } }
  });
  c.glacesVives = (S, vue) => c.reglages.retro === 'oui' && !S.regardArriere && (vue === 'cockpit' || vue === 'arceau');
  for (const nom of ['creerChampsFaune', 'copierChampFaune', 'glaceVisibleFaune', 'cameraReflet', 'preparerChampsFaune', 'selectionnerChampsFaune'])
    vm.runInContext(fonction(nom), c);
  const S = c.session = { type: 'duo', vue: 'cockpit', animaux: { id: 1 }, champsFaune: c.creerChampsFaune() };
  S.vueJ2 = Object.assign(Object.create(S), { vue: 'cockpit' });
  c.indexVue = V => V && V.indexVue != null ? V.indexVue : (V === S ? 0 : 1);
  const cam = { pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, fov: 70 };
  const ps = { x: 0, y: 0, z: 0, cap: 0, tangage: 0, roulis: 0 };
  const P = { palier: 'high', secondaires: { retroviseurs: { hz: 30 } } };
  return { c, S, cam, ps, P, appels };
}

test('avant la première image, aucune fausse caméra ne réveille les animaux', () => {
  const { c, S, appels } = banc();
  c.selectionnerChampsFaune(S);
  assert.equal(appels[0].n, 6);
  assert(appels[0].vues.every(v => v.qualite === 'off'));
});

test('chaque joueur conserve sa caméra et ses deux champs réfléchis réels', () => {
  const { c, S, cam, ps, P, appels } = banc();
  const champs = S.champsFaune, identites = Array.from(champs, v => v.camera.pos);
  c.preparerChampsFaune(S, 'cockpit', cam, ps, P);
  c.preparerChampsFaune(S.vueJ2, 'cockpit', cam, ps, P);
  assert(champs.slice(0, 6).every(v => v.qualite === 'high'));
  assert(champs[1].camera.fov < cam.fov && champs[2].camera.fov < cam.fov, 'les glaces ne réveillent pas tout l’arrière');
  assert(Math.cos(champs[1].camera.yaw) < -.8 && Math.cos(champs[2].camera.yaw) < -.8, 'les deux vrais champs réfléchis regardent derrière');
  assert.equal(champs[1].aspect, 2.5);
  assert.equal(champs[1].hauteur, 128);
  cam.pos[0] = 100; cam.yaw = 1.2;
  assert.equal(champs[0].camera.pos[0], 0, 'une caméra de rendu réutilisée ne déplace pas le champ mémorisé');
  assert.equal(champs[3].camera.yaw, 0);
  c.selectionnerChampsFaune(S);
  assert(appels.at(-1).vues.slice(0, 6).every(v => v.qualite === 'high'));
  c.preparerChampsFaune(S, 'poursuite', cam, ps, P);
  for (let i = 0; i < 6; i++) assert.strictEqual(champs[i].camera.pos, identites[i], 'tampons conservés');
  assert.equal(champs[0].camera.pos[0], 100);
  assert.equal(champs[3].camera.pos[0], 0, 'J1 ne remplace pas le champ de J2');
  assert(champs.slice(1, 3).every(v => v.qualite === 'off'));
  assert(champs.slice(3, 6).every(v => v.qualite === 'high'));
});

test('glaces hors écran, coupées ou sans cadence n’activent aucune faune arrière', () => {
  const { c, S, cam, ps, P } = banc();
  c.preparerChampsFaune(S, 'cockpit', cam, ps, P);
  cam.yaw = Math.PI;
  c.preparerChampsFaune(S, 'cockpit', cam, ps, P);
  assert(S.champsFaune.slice(1, 3).every(v => v.qualite === 'off'));
  cam.yaw = 0; P.secondaires.retroviseurs.hz = 0;
  c.preparerChampsFaune(S, 'cockpit', cam, ps, P);
  assert(S.champsFaune.slice(1, 3).every(v => v.qualite === 'off'));
  P.secondaires.retroviseurs.hz = 30;
  c.preparerChampsFaune(S, 'cockpit', cam, ps, P);
  c.reglages.retro = 'non';
  c.selectionnerChampsFaune(S);
  assert(S.champsFaune.slice(1, 3).every(v => v.qualite === 'off'), 'la coupure agit avant les pas suivants');
});

test('Faune désactivée et sortie du duo enlèvent immédiatement leurs champs', () => {
  const { c, S, cam, ps, P, appels } = banc();
  for (const V of [S, S.vueJ2]) c.preparerChampsFaune(V, 'cockpit', cam, ps, P);
  S.type = 'course';
  c.selectionnerChampsFaune(S);
  assert(appels.at(-1).vues.slice(3).every(v => v.qualite === 'off'));
  c.reglages.faune = 'off';
  c.selectionnerChampsFaune(S);
  assert(appels.at(-1).vues.every(v => v.qualite === 'off'));
});
