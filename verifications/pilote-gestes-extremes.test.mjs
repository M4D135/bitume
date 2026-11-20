// Poses conservées de l'audit du 20/11/2026 : extrema des oscillations et
// intervalle le plus mobile du coude parmi 150 150 poses. Le contrôle utilise
// les triangles Float32 du rendu et l'oracle indépendant des surfaces.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { qualifier, preparerBanc } from '../tools/qualification/pilote-thorax.mjs';

const scenes = [];
// sin(6π × phase) vaut +1 puis -1 : poing haut/bas, salut écarté/rapproché.
// Les braquages suivent le côté du geste, cas le plus mobile mesuré.
for (const geste of ['poing', 'salut']) for (const gesteCote of [-1, 1])
  for (const gesteIntensite of [.65, 1]) for (const gestePhase of [1 / 12, .25])
    scenes.push({ nom: 'extremum-oscillation', geste, gesteCote, volant: gesteCote,
      gesteIntensite, gestePhase, passage: 1 });
for (const gesteCote of [-1, 1]) for (const gesteIntensite of [.775, .776])
  scenes.push({ nom: 'pire-coude-audit', geste: 'salut', gesteCote, volant: gesteCote,
    gesteIntensite, gestePhase: .75, passage: 1 });

test('poing/salut extrêmes : thorax, coque, tête et autre bras dégagés aux trois LOD', () => {
  const rapport = qualifier({ scenes });
  // Conserver aussi les poses et les empreintes en cas d'échec, avant les assertions.
  if (process.env.BITUME_RAPPORT_GESTES_EXTREMES)
    fs.writeFileSync(process.env.BITUME_RAPPORT_GESTES_EXTREMES, JSON.stringify(rapport, null, 2) + '\n');
  assert.equal(scenes.length, 20, 'matrice bornée à vingt poses ciblées');
  assert.equal(rapport.qualite, false, 'primitives réellement utilisées par le rendu WebGL2');
  assert.deepEqual(Object.keys(rapport.lod), ['complet', 'moyen', 'simple']);
  for (const [detail, resultat] of Object.entries(rapport.lod)) {
    assert.equal(resultat.poses, scenes.length, detail + ' : toutes les poses mesurées');
    assert.equal(resultat.posesAvecContact, 0,
      detail + ' : contact hors attache ' + JSON.stringify(resultat.exemples.slice(0, 3)));
    assert.equal(resultat.raccordsEpaule.controles, scenes.length * 2, detail + ' : deux raccords par pose');
    assert.equal(resultat.raccordsEpaule.absents, 0, detail + ' : épaules réellement reliées');
    assert.equal(resultat.raccordsEpaule.rotulesHorsAttache, 0, detail + ' : attache locale de 35 mm');
    assert.ok(resultat.osErreurMax < 1e-8, detail + ' : os constants de 21 et 23 cm');
  }
  assert.equal(rapport.statut, 'conforme_sur_echantillon');
  console.log('gestes extrêmes : 60 poses de surfaces, trois LOD, aucun contact hors attache');
});

test('le pire intervalle de coude reste continu quand le pas d’intensité est divisé par deux', () => {
  const { V, modele } = preparerBanc();
  const ev = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, v: 20,
    pilote: { rapportAvant: 2, rapport: 3, passage: 1, geste: 'salut', gestePhase: .75 } };
  const distance = (a, j, k) => Math.hypot(a[j] - a[k], a[j + 1] - a[k + 1], a[j + 2] - a[k + 2]);
  const mesures = [];
  for (const cote of [-1, 1]) {
    Object.assign(ev.pilote, { gesteCote: cote, volant: cote });
    const maximums = [];
    // Fenêtre fixe issue de l'audit, pas une recherche du maximum du code testé.
    for (const subdivisions of [30, 60]) {
      let precedent = null, maximum = 0;
      for (let n = 0; n <= subdivisions; n++) {
        ev.pilote.gesteIntensite = .760 + .030 * n / subdivisions;
        V.poser(modele, ev, []);
        const a = modele.objetsRendu.pilote.articulations;
        for (const j of [0, 9]) {
          assert.ok(Math.abs(distance(a, j, j + 3) - .21) < 1e-10, 'humérus constant');
          assert.ok(Math.abs(distance(a, j + 3, j + 6) - .23) < 1e-10, 'avant-bras constant');
          if (precedent) maximum = Math.max(maximum,
            Math.hypot(a[j + 3] - precedent[j + 3], a[j + 4] - precedent[j + 4], a[j + 5] - precedent[j + 5]));
        }
        precedent = Array.from(a);
      }
      maximums.push(maximum);
    }
    assert.ok(maximums[0] < .002, 'aucun saut de coude de 2 mm pour Δintensité = 0,001');
    assert.ok(maximums[0] > 0, 'le contrôle exerce bien une transition');
    assert.ok(maximums[1] < maximums[0] * .65, 'un saut ne diminue pas avec la subdivision');
    mesures.push({ cote, pasM: maximums[0], demiPasM: maximums[1] });
  }
  console.log('continuité du coude aux extrêmes : ' + JSON.stringify(mesures));
});
