// Préparations statiques de la faune, des effets de saison et des aurores : calculées une fois par scène,
// reprises par chaque séance sans changer une seule image, refusées pour une autre scène, jamais modifiées.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const n of ['circuit', 'carene', 'botanique', 'ecologie', 'saisons', 'vegetation', 'decor', 'faune', 'effets-saison', 'aurores']) require('../src/' + n + '.js');
const B = globalThis.BITUME, F = B.faune, E = B.effetsSaison, A = B.aurores;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const empreinte = out => out.map(o => [o.faune || o.effetSaison || o.aurore, ...o.p, ...o.s, ...o.r, ...o.color, o.alpha, o.emissive].join(',')).join(';');

const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
const decor = B.decor.construire(c, { qualite: 'low', matieres: true, vegetation: true, vegetationQualite: 'low', saison: 'automne' });
const autre = B.decor.construire(c, { qualite: 'low', matieres: true, vegetation: true, vegetationQualite: 'low', saison: 'hiver' });

// Deux vues (la seconde à demi-cadence) qui roulent sur le circuit ; renvoie l'empreinte de chaque image.
function rouler(dessiner, etat, images = 900, contexte = {}) {
  const ctx = [0, 1].map(vue => ({ vue, qualite: 'high', nuit: .3, pluie: 0, ventX: 4, ventZ: 1, pose: { x: 0, y: 0, z: 0 }, ...contexte }));
  const empreintes = [], out = [];
  for (let n = 0; n < images; n++) {
    const t = n / 60;
    for (let vue = 0; vue < 2; vue++) {
      if (vue && n % 2) continue;
      const p = B.circuit.echantillon(c, (t * (vue ? 52 : 70) + vue * 900) % c.longueur);
      ctx[vue].pose.x = p.x; ctx[vue].pose.y = p.y + 1.5; ctx[vue].pose.z = p.z; ctx[vue].qualite = ['high', 'ultra', 'medium'][Math.floor(t / 5) % 3];
      out.length = 0; dessiner(etat, t, ctx[vue], out); empreintes.push(empreinte(out));
    }
  }
  return empreintes;
}

verifier('faune : préparation reprise telle quelle, mêmes images qu’une création complète', () => {
  const prep = F.preparer(c, decor);
  assert(Object.isFrozen(prep) && prep.habitats.length > 0 && !('vues' in prep));
  const avant = JSON.stringify(prep.habitats);
  const repris = F.creer(c, decor, prep), complet = F.creer(c, decor);
  assert.strictEqual(repris.habitats, prep.habitats); assert.strictEqual(repris.index, prep.index); assert.strictEqual(repris.preparation, prep);
  assert.equal(JSON.stringify(complet.habitats), avant);
  const a = rouler(F.dessiner, repris), b = rouler(F.dessiner, complet);
  assert(a.some(e => e.length) && a.every((e, i) => e === b[i]), 'mêmes objets image par image');
  // Une seconde séance sur la même préparation repart de zéro et montre les mêmes vols aux mêmes instants.
  const seconde = rouler(F.dessiner, F.creer(c, decor, prep));
  assert(seconde.every((e, i) => e === a[i])); assert.equal(JSON.stringify(prep.habitats), avant, 'préparation jamais modifiée');
  // La table des identités ne garde que les entrées notées : c'est ce qui permet de ne pas tout remettre à −1.
  for (const v of repris.vues) assert.equal(v.proprietaires.reduce((n, x) => n + (x >= 0), 0), v.nEcrits);
});
verifier('faune : préparation d’une autre scène refusée, préparation par tranches identique', () => {
  const prep = F.preparer(c, decor);
  assert.notStrictEqual(F.creer(c, autre, prep).preparation, prep);
  assert.notStrictEqual(F.creer(B.circuit.creer(12, { theme: 'foret', longueur: 4200 }), decor, prep).preparation, prep);
  assert.notStrictEqual(F.creer(c, decor, { ...prep }).preparation, prep);
  const travail = F.preparerParTranches(c, decor);
  let tranches = 0; while (!travail.avancer(.2)) tranches++;
  assert(tranches > 0, 'un budget de 0,2 ms découpe la préparation');
  assert.equal(JSON.stringify(travail.resultat.habitats), JSON.stringify(prep.habitats));
  assert.equal(JSON.stringify(travail.resultat.index), JSON.stringify(prep.index));
  assert.strictEqual(travail.avancer(.2), true); assert.equal(travail.habitats, prep.habitats.length);
  assert.strictEqual(F.creer(c, decor, travail.resultat).preparation, travail.resultat);
});
verifier('effets de saison : préparation partagée entre séances et vues, mêmes feuilles et flocons', () => {
  const prep = E.preparer(c, decor);
  assert(Object.isFrozen(prep) && prep.sources.length > 50 && !('vues' in prep));
  const sources = JSON.stringify(prep.sources);
  const repris = E.creer(c, decor, prep);
  assert.strictEqual(repris.sources, prep.sources); assert.strictEqual(repris.cacheSols, prep.cacheSols); assert.strictEqual(repris.preparation, prep);
  // Le cache des sols, rempli par la première séance, est réutilisé par la suivante sans rien changer.
  const neige = { neige: .9 };
  const a = rouler(E.dessiner, repris, 900, neige), b = rouler(E.dessiner, E.creer(c, decor), 900, neige), d = rouler(E.dessiner, E.creer(c, decor, prep), 900, neige);
  assert(a.some(e => e.includes('feuille')) && a.some(e => e.includes('neige')));
  assert(a.every((e, i) => e === b[i] && e === d[i]), 'mêmes objets image par image');
  assert.equal(JSON.stringify(prep.sources), sources);
  assert.notStrictEqual(E.creer(c, autre, prep).preparation, prep);
  // Seules les positions notées de la table des propriétaires sont occupées.
  for (const v of repris.vues) for (const p of [v.feuilles, v.neige]) assert.equal(p.proprietaires.reduce((n, x) => n + (x >= 0), 0), p.nPositions);
});
verifier('aurores : rubans préparés une fois, refusés pour un autre circuit', () => {
  const islande = B.circuit.creer(83, { theme: 'islande', longueur: 4600 }), prep = A.preparer(islande);
  assert(Object.isFrozen(prep) && Object.isFrozen(prep.rubans) && prep.actif && prep.rubans.length === 3);
  const repris = A.creer(islande, prep), complet = A.creer(islande);
  assert.strictEqual(repris.rubans, prep.rubans); assert.equal(JSON.stringify(complet.rubans), JSON.stringify(prep.rubans));
  assert.notStrictEqual(A.creer(c, prep).preparation, prep); assert.equal(A.creer(c, prep).actif, false);
  const ctx = { vue: 0, qualite: 'ultra', nuit: 1, pluie: 0, nuages: 0 };
  for (let t = 0; t < 60; t += .7) {
    const x = [], y = []; A.dessiner(repris, t, ctx, x); A.dessiner(complet, t, ctx, y);
    assert.equal(empreinte(x), empreinte(y)); assert.equal(x.length, 18);
  }
});
console.log('préparations de la nature : ' + controles + ' contrôles passés');
