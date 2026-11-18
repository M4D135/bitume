// Calculateurs de l'étude du lot 17 (docs/reprise/rapports/conduite-2026-11-18/etude-17/). Le plan
// docs/reprise/17-CONDUITE.md tire ses valeurs de départ de ces calculs : ce test refait ceux qu'il cite et échoue si
// un calculateur ou une valeur du plan s'en écarte. Il ne touche pas au modèle du jeu (les calculateurs sont
// autonomes) ; seule la validation lit les mesures figées du banc (banc-base.json).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ETUDE = new URL('../docs/reprise/rapports/conduite-2026-11-18/etude-17/', import.meta.url);
const { ACTUEL, P10, vLimiteR } = await import(new URL('regime-etabli.mjs', ETUDE).href);
const { depart, freiner } = await import(new URL('longitudinal.mjs', ETUDE).href);
const banc = JSON.parse(readFileSync(new URL('../banc-base.json', ETUDE), 'utf8')).resultats.virages.etablis;

let nbOk = 0;
function verifier(nom, f) {
  try { f(); console.log('ok  ' + nom); nbOk++; }
  catch (e) { console.error('FAIL ' + nom + ' : ' + e.message); process.exit(1); }
}
const dans = (x, a, b, quoi) => assert(x >= a && x <= b, `${quoi} = ${x} hors de [${a}, ${b}]`);

verifier('le calculateur de régime établi suit le banc à −2,5 / +4 % près sur le modèle actuel', () => {
  for (const R of [30, 60, 120, 180]) {
    const e = vLimiteR(ACTUEL, R).kmh / banc[R].vAdherence_kmh - 1;
    dans(e, -.025, .04, `écart en R ${R}`);
    assert.equal(vLimiteR(ACTUEL, R).limitePar, 'avant', `R ${R} limité par l'avant (constat du banc)`);
  }
  assert(vLimiteR(ACTUEL, 30).kmh < banc[30].vAdherence_kmh && vLimiteR(ACTUEL, 180).kmh > banc[180].vAdherence_kmh, 'sens des écarts cités par le plan');
});

verifier('jeu p10 retenu : même enveloppe d’adhérence que l’actuel, un peu plus stable', () => {
  const r30 = vLimiteR(P10, 30), r180 = vLimiteR(P10, 180);
  dans(r30.kmh, 83.5, 85.5, 'p10 R 30 (km/h, calcul)');
  dans(r180.kmh, 255, 266, 'p10 R 180 (km/h, calcul)');
  for (const R of [30, 60, 120, 180, 250]) {
    const r = vLimiteR(P10, R);
    assert.equal(r.limitePar, 'avant', `p10 R ${R} limité par l'avant`);
    dans(r.margeArSurAv, 1.06, 1.13, `marge arrière/avant en R ${R}`);
  }
  // le levier d'équilibre annoncé : plus d'adhérence arrière, plus de marge
  assert(vLimiteR({ ...P10, gAr: 1.08 }, 120).margeArSurAv > vLimiteR(P10, 120).margeArSurAv + .03, 'gripArriere déplace l’équilibre');
});

const chassis = { m: 665, L: 2.70, rep: .44, h: .33, SCz: 1.9, aeroAv: .42, mu: 1.85, gAr: 1.04, q: .18, ex: 1.05, rr: .25, eta: .9,
  fm0: 15, fm1: .0030, FbMax_g: 2.3, b: .70, glisse: .82, SCx: .88 };

verifier('deux jeux de ligne droite cohérents : puissance constante, pointe sous le rupteur', () => {
  const actuel = depart({ ...chassis, Tmax: 216, SCx: .58 }), fidele = depart({ ...chassis, Tmax: 320, SCx: .88 });
  dans(actuel.pRoueMax_kW, 228, 238, 'niveau actuel, puissance à la roue (kW)');
  dans(fidele.pRoueMax_kW, 340, 350, 'fidèle, puissance à la roue (kW)');
  dans(actuel.pointe, 297, 307, 'niveau actuel, pointe (km/h)');
  dans(fidele.pointe, 297, 307, 'fidèle, pointe (km/h)');
  dans(fidele.t200, 5.0, 5.6, 'fidèle, 0-200 (s, calcul)');
  assert(actuel.t200 - fidele.t200 > 1.2, 'le niveau fidèle gagne plus de 1,2 s sur 0-200');
});

verifier('freins retenus : l’avant bloque le premier à 70 %, l’arrière à 60 %', () => {
  for (const [a, c] of [[300, 0], [200, 0], [300, 100], [100, 0]])
    assert.equal(freiner(chassis, a, c, { pilote: 'plein', rampe: .15 }).premier, 'avant', `${a}-${c} à 70 %`);
  assert.equal(freiner({ ...chassis, b: .60 }, 300, 0, { pilote: 'plein', rampe: .15 }).premier, 'arrière', '300-0 à 60 %');
  dans(freiner(chassis, 200, 0, { pilote: 'abs', rampe: .15 }).d, 66, 72, '200-0 au mieux (m, calcul)');
  dans(freiner(chassis, 300, 100, { pilote: 'abs', rampe: .15 }).d, 115, 124, '300-100 au mieux (m, calcul)');
  const plein = freiner(chassis, 300, 0, { pilote: 'plein', rampe: .15 }).d, abs = freiner(chassis, 300, 0, { pilote: 'abs', rampe: .15 }).d;
  dans(plein / abs, 1.02, 1.15, 'prix d’un blocage tenu jusqu’à l’arrêt (rapport des distances)');
});

console.log(`${nbOk} vérifications de l’étude 17 tenues`);
