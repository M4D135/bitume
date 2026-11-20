// L'ancien banc cinématique inversait ecart dans son double de circuit. Ici le
// vrai calcul de course et le vrai WASM doivent faire profiter le suiveur.
import assert from 'node:assert/strict';
import { mesurerAspirationPhysX } from '../tools/qualification/aspiration-physx.mjs';

const r = await mesurerAspirationPhysX({ vitessesKmh: [235], secondes: 6 });
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok  ' + nom); }

verifier('deux châssis dynamiques sur quatre suspensions, forces reçues par le vrai PhysX', () => {
  for (const c of r.resultats) {
    assert.equal(c.corpsDynamiques, c.id === 'seul' ? 1 : 2);
    assert.equal(c.minAppuis, 4); assert.equal(c.forcesNatives, c.pas * c.corpsDynamiques);
    assert.equal(c.maxErreurForceN, 0); assert.equal(c.corrections, 0); assert.equal(c.replacements, 0);
    assert.equal(c.contactsVoitures, 0); assert.equal(c.contactsPerdus, 0);
  }
  assert.equal(r.mondesRestants, 0);
});
verifier('le suiveur reçoit l’aspiration et la baisse de traînée ; le meneur reste en air libre', () => {
  const libre = r.resultats.find(c => c.id === 'seul').premierPas[0];
  const [suiveur, meneur] = r.resultats.find(c => c.id === 'sillage-20m').premierPas;
  assert(suiveur.aspiration > .3, 'aspiration absente du véhicule derrière');
  assert.equal(meneur.aspiration, 0, 'le véhicule devant ne doit pas être aspiré par celui de derrière');
  assert(suiveur.resistanceLongitudinaleN > libre.resistanceLongitudinaleN + 100, 'réduction non transmise à la force native');
  assert.equal(meneur.resistanceLongitudinaleN, libre.resistanceLongitudinaleN);
  assert(r.sensSillageConforme);
});
verifier('gain de vitesse et de distance mesuré dans les poses natives à 2, 4 et 6 secondes', () => {
  const mesures = r.comparaisons.filter(c => c.id === 'sillage-20m');
  assert.equal(mesures.length, 3);
  for (const m of mesures) {
    assert(m.gainSuiveurVitesseKmh > .5 && m.gainSuiveurDistanceM > .3, 'gain réel insuffisant : ' + JSON.stringify(m));
    assert(Math.abs(m.gainMeneurDistanceM) < .02, 'meneur avantagé : ' + JSON.stringify(m));
  }
  assert(mesures[2].gainSuiveurDistanceM > mesures[1].gainSuiveurDistanceM);
});
verifier('aucun gain hors couloir latéral ni au-delà de la portée', () => {
  for (const c of r.resultats.filter(c => c.id.startsWith('hors-'))) {
    for (const p of c.premierPas) assert.equal(p.aspiration, 0);
    for (const m of c.mesures) for (const v of m.voitures) assert.equal(v.aspiration, 0);
  }
  for (const c of r.comparaisons.filter(c => c.id.startsWith('hors-'))) {
    assert(Math.abs(c.gainSuiveurDistanceM) < .001 && Math.abs(c.gainSuiveurVitesseKmh) < .001, JSON.stringify(c));
  }
});
verifier('le sillage conserve son sens au bouclage du circuit et cesse une fois dépassé', () => {
  const B = globalThis.BITUME, c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const suiveur = { etat: B.conduite.creer(c.longueur - 10, 0) };
  const meneur = { etat: B.conduite.creer(10, 0) }, voitures = [suiveur, meneur];
  B.course.aspirer(c, voitures);
  assert(suiveur.etat.aspiration > .3); assert.equal(meneur.etat.aspiration, 0);
  suiveur.etat.s = 18; B.course.aspirer(c, voitures);
  assert.equal(suiveur.etat.aspiration, 0); assert(meneur.etat.aspiration > .7);
  suiveur.etat.d = 2.1; B.course.aspirer(c, voitures);
  assert.equal(suiveur.etat.aspiration, 0); assert.equal(meneur.etat.aspiration, 0);
});
console.log(controles + ' contrôles aspiration PhysX réussis');
