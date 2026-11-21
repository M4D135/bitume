import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const f of ['carene', 'route-des-cimes', 'circuit', 'ecologie', 'saisons', 'botanique', 'vegetation', 'decor', 'ambiance', 'animaux']) require('../src/' + f + '.js');
const B = globalThis.BITUME, A = B.animaux, NP = 17;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
const decor = B.decor.construire(c, { vegetation: false, vegetationQualite: 'off', qualite: 'low', saison: 'ete' });
const creer = () => A.creer(c, decor, { saison: 'ete' });
const vers = (etat, groupe, vue = 0) => ({ vue, qualite: 'high', camera: {
  pos: [groupe.hx + 40, A.solExact(etat.G.T, groupe.hx, groupe.hz) + 2, groupe.hz],
  yaw: -Math.PI / 2, pitch: 0, roll: 0, fov: 42,
}, aspect: 16 / 9, hauteur: 720 });
const vide = { qualite: 'high', camera: { pos: [100000, 100000, 100000], yaw: 0, fov: 60 }, aspect: 16 / 9, hauteur: 720 };

verifier('chaque biome du catalogue possède une bande proche finie', () => {
  for (const theme of Object.keys(A.BIOMES)) assert(Number.isFinite(A.BANDES_ABORDS[theme]) && A.BANDES_ABORDS[theme] <= 50, theme);
  for (const options of [{ theme: 'baikal', graine: 179, longueur: 5400 }, { theme: 'montagne', graine: 181, partition: 'route-des-cimes' }]) {
    const c = B.circuit.creer(options.graine, options), d = B.decor.construire(c, { vegetation: false, vegetationQualite: 'off', qualite: 'low' }), e = A.creer(c, d);
    assert(e.nAnimaux > 0);
    assert(e.cour.every(Number.isFinite));
    for (const g of e.groupes) assert(g.dAxe <= (c.largeur / 2 || 5) + A.BANDES_ABORDS[options.theme]);
  }
});

verifier('abords : chaque animal reste proche du vrai bord, hors du dégagement', () => {
  const etat = creer();
  for (let a = 0; a < etat.nAnimaux; a++) {
    const x = etat.cour[a * NP], z = etat.cour[a * NP + 1];
    let distance = Infinity, limite = 0;
    for (let i = 0; i < c.n; i++) {
      const d = Math.hypot(x - c.x[i], z - c.z[i]);
      if (d < distance) { distance = d; limite = Math.max(c.limiteG[i], c.limiteD[i]); }
    }
    assert(distance >= limite + A.GARDE_BORD, 'aucun animal dans le dégagement');
    assert(distance - c.largeur / 2 <= A.BANDES_ABORDS.foret + 3, 'aucun habitat lointain');
  }
  assert(etat.groupes.some(g => g.dAxe < 34), 'la garde historique de 34 m ne subsiste pas');
});

verifier('aucune vue au départ : cerveau et hasard restent immobiles', () => {
  const etat = creer(), positions = etat.cour.slice(), cerveau = etat.cer.slice(), graines = etat.graines.slice();
  for (let i = 0; i < 1200; i++) A.pas(etat, i / 120, []);
  assert.deepEqual(etat.cour, positions); assert.deepEqual(etat.cer, cerveau); assert.deepEqual(etat.graines, graines);
  assert.equal(A.stats(etat).activite.pasGroupes, 0);
  assert.equal(A.stats(etat).activite.groupesEndormis, etat.groupes.length);
});

verifier('sélection avant simulation : seuls les groupes du champ avancent', () => {
  const etat = creer(), ctx = vers(etat, etat.groupes[0]), initial = etat.cour.slice();
  const table = etat.visibilite.champs, horloges = etat.visibilite.horloges;
  A.selectionnerVues(etat, [ctx]);
  for (let i = 0; i <= 240; i++) A.pas(etat, i / 120, []);
  const actifs = A.stats(etat).activite.groupesActifs;
  assert(actifs > 0 && actifs < etat.groupes.length);
  etat.groupes.forEach((g, i) => {
    if (etat.visibilite.actifs[i]) assert(etat.visibilite.horloges[i] > 0);
    else { assert.equal(etat.visibilite.horloges[i], 0); assert.deepEqual(etat.cour.slice(g.debut * NP, (g.debut + g.n) * NP), initial.slice(g.debut * NP, (g.debut + g.n) * NP)); }
  });
  assert.strictEqual(etat.visibilite.champs, table); assert.strictEqual(etat.visibilite.horloges, horloges);
});

verifier('sommeil long puis réveil : aucun rattrapage, aucun saut de position', () => {
  const etat = creer(), ctx = vers(etat, etat.groupes[0]);
  A.selectionnerVues(etat, [ctx]); A.pas(etat, 0, []); A.pas(etat, .1, []);
  A.selectionnerVues(etat, []); A.pas(etat, .2, []);
  const cour = etat.cour.slice(), graines = etat.graines.slice(), horloges = etat.visibilite.horloges.slice();
  const avant = A.stats(etat).activite.pasGroupes;
  A.pas(etat, 100000, []);
  assert.deepEqual(etat.cour, cour); assert.deepEqual(etat.graines, graines); assert.deepEqual(etat.visibilite.horloges, horloges);
  A.selectionnerVues(etat, [ctx]); A.pas(etat, 100000.1, []);
  assert(A.stats(etat).activite.pasGroupes - avant <= etat.groupes.length);
  for (let i = 0; i < etat.nAnimaux; i++) assert(Math.hypot(etat.cour[i * NP] - cour[i * NP], etat.cour[i * NP + 1] - cour[i * NP + 1]) < 1.5);
  for (let i = 0; i < horloges.length; i++) assert(etat.visibilite.horloges[i] - horloges[i] <= A.PAS + 1e-8);
});

verifier('union J1/J2 et glaces : une vraie vue arrière compte, le booléen seul ne compte plus', () => {
  const etat = creer(), miroir = vers(etat, etat.groupes[0]), principale = { ...vide, vue: 0, arriere: true };
  A.selectionnerVues(etat, [vide, miroir]); A.pas(etat, 0, []); A.pas(etat, .1, []);
  assert(etat.visibilite.actifs[0]);
  const sortie = []; A.dessiner(etat, .1, principale, sortie); assert.equal(sortie.length, 0);
  const poses = A.stats(etat).activite.posesPreparees;
  principale.vuesSecondaires = [miroir]; A.dessiner(etat, .1, principale, sortie);
  assert(sortie.length > 0); assert(A.stats(etat).activite.posesPreparees > poses);
  miroir.qualite = 'off'; sortie.length = 0;
  A.selectionnerVues(etat, [vide, miroir]); A.pas(etat, .2, []); A.dessiner(etat, .2, principale, sortie);
  assert.equal(sortie.length, 0); assert.equal(A.stats(etat).activite.groupesActifs, 0);
});

verifier('frustum vertical et distance : aucune pose détaillée hors champ', () => {
  const etat = creer(), ctx = vers(etat, etat.groupes[0]), sortie = [];
  ctx.camera.pitch = Math.PI / 2;
  A.selectionnerVues(etat, [ctx]); A.pas(etat, 0, []); A.pas(etat, 1, []);
  const avant = A.stats(etat).activite.posesPreparees;
  A.dessiner(etat, 1, vide, sortie);
  assert.equal(sortie.length, 0); assert.equal(A.stats(etat).activite.posesPreparees, avant);
  assert.equal(etat.visibilite.actifs[0], 0);
});

verifier('Légère garde les animaux proches dans les budgets', () => {
  const etat = creer(), ctx = vers(etat, etat.groupes[0]), sortie = [];
  ctx.qualite = 'low'; A.dessiner(etat, 0, ctx, sortie);
  assert(sortie.length > 0 && sortie.length <= A.BUDGETS.low.objets);
  assert(sortie.every(o => /loin/.test(o.shape)));
  ctx.qualite = 'off'; sortie.length = 0; A.dessiner(etat, 0, ctx, sortie); assert.equal(sortie.length, 0);
});

verifier('même séquence de vues : simulation déterministe à 30/60/120 images par seconde', () => {
  const sorties = [];
  for (const hz of [30, 60, 120]) {
    const etat = creer(), ctx = vers(etat, etat.groupes[0]);
    for (let pas = 0; pas <= 120 * 6; pas++) {
      if (pas % (120 / hz) === 0) A.selectionnerVues(etat, pas >= 240 && pas < 480 ? [] : [ctx]);
      A.pas(etat, pas / 120, []);
    }
    sorties.push([etat.cour, etat.cer, etat.graines, etat.visibilite.horloges]);
  }
  assert.deepEqual(sorties[1], sorties[0]); assert.deepEqual(sorties[2], sorties[0]);
});
console.log(controles + ' contrôles animaux proximité/visibilité');
