// Vérification intégrale Marseille (tracé OSM réel, décor 3D, 0 intrusion, PhysX 4 roues sur viaduc)
// et Stands F1 (portiques PIT IN/OUT, chicane de sortie, 12 mécaniciens animés, sucette STOP → GO !).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';

const require = createRequire(import.meta.url);
for (const f of [
  'circuit', 'marseille', 'marseille-decor', 'equipe-stands',
  'conduite', 'degats', 'contacts', 'obstacles',
  'botanique', 'ecologie', 'saisons', 'vegetation',
  'bords', 'carene', 'decor', 'meteo', 'strategie-stands',
  'course', 'solides-physx', 'physique', 'aeriens'
]) {
  require('../src/' + f + '.js');
}

const B = globalThis.BITUME;
let ok = 0;
function test(nom, fn) { fn(); ok++; console.log('ok  ' + nom); }

let cMrs, decorMrs;
test('Marseille : tracé OSM réel valide, Viaduc du Vallon des Auffes & provenance ODbL', () => {
  cMrs = B.marseille.creer(313);
  assert.deepEqual(B.marseille.valider(cMrs), []);
  assert.equal(cMrs.id, 'marseille');
  assert.equal(cMrs.ouvert, true);
  assert.ok(cMrs.longueur > 5700 && cMrs.longueur < 6200, 'longueur=' + cMrs.longueur);
  assert.equal(cMrs.ponts.length, 1);
  assert.ok(B.marseille.PROVENANCE.source.includes('OpenStreetMap'));
  assert.ok(B.marseille.PROVENANCE.source.includes('ODbL'));
});

test('Marseille : décor complet, 0 bosse terrain sur chaussée, crique creusée sous le viaduc, mer mat=12', () => {
  decorMrs = B.decor.construire(cMrs, { qualite: 'high', vegetation: false, saison: 'ete', organique: true, solsProceduraux: true });
  assert.equal(decorMrs.niveauEau, -0.35);
  assert.ok(decorMrs.nappes.length > 20, 'nappes=' + decorMrs.nappes.length);

  // Vérifier format 13 floats FERRO & normales +Y sur toutes les nappes terrain/eau
  let nappesEau = 0, nappesTerrain = 0;
  for (const n of decorMrs.nappes) {
    assert.equal(n.sommets.length % 13, 0, 'sommets % 13');
    if (n.surfaceType === 'eau') nappesEau++;
    if (n.surfaceType === 'terrain') nappesTerrain++;
    for (let i = 0; i < n.sommets.length; i += 13) {
      assert.ok(Number.isFinite(n.sommets[i]) && Number.isFinite(n.sommets[i + 1]) && Number.isFinite(n.sommets[i + 2]));
      if (n.surfaceType === 'terrain' || n.surfaceType === 'eau') {
        assert.ok(n.sommets[i + 4] > 0, 'normale ny > 0');
      }
    }
  }
  assert.ok(nappesEau >= 20, 'mer méditerranée présente: ' + nappesEau);
  assert.ok(nappesTerrain >= 40, 'terrain côtier + NDG présent: ' + nappesTerrain);

  // Zéro bosse terrain au-dessus de la chaussée sur les 6 km
  for (let i = 0; i < cMrs.n; i++) {
    const ySol = decorMrs.sol(cMrs.x[i], cMrs.z[i]);
    assert.ok(ySol <= cMrs.y[i] - 0.35, `terrain au-dessus de la chaussée à i=${i} s=${i * cMrs.pas}: sol=${ySol} route=${cMrs.y[i]}`);
  }
  // Crique creusée sous le Viaduc du Vallon des Auffes (mer visible sous les arches !)
  const p = cMrs.ponts[0];
  const iMid = Math.round((p.debut + p.fin) * 0.5 / cMrs.pas);
  const yCrique = decorMrs.sol(cMrs.x[iMid], cMrs.z[iMid]);
  assert.ok(yCrique < -1.5, 'crique creusée sous viaduc: ' + yCrique);

  // Notre-Dame de la Garde culmine bien au sommet de sa colline
  const nd = cMrs.marseille.ndlg;
  const yND = decorMrs.sol(nd.x, nd.z);
  assert.ok(yND > 130, 'Colline NDG haute: ' + yND);
  assert.ok(decorMrs.lieux && decorMrs.lieux.marqueurs.length === 4, '4 marqueurs Marseille');
});

test('Marseille : 0 obstacle / bâtiment / bateau / arbre sur la chaussée (d < w + 0.5)', () => {
  const w = cMrs.largeur / 2;
  let intrus = 0;
  for (const lot of decorMrs.lots) {
    for (const o of lot.objets) {
      if (!o || !o.p || !o.s) continue;
      // Ignorer marquages au sol (h < 0.08), portiques hauts (bas > route + 4.5 m), piles/tablier sous le pont
      const bottomY = o.p[1] - o.s[1] * 0.5;
      const topY = o.p[1] + o.s[1] * 0.5;
      if (o.s[1] <= 0.08) continue;
      let bi = 0, bd2 = 1e18;
      for (let i = 0; i < cMrs.n; i += 2) {
        const dx = cMrs.x[i] - o.p[0], dz = cMrs.z[i] - o.p[2];
        const d2 = dx * dx + dz * dz;
        if (d2 < bd2) { bd2 = d2; bi = i; }
      }
      const d = Math.sqrt(bd2);
      if (d < w + 0.3 && topY > cMrs.y[bi] + 0.08 && bottomY < cMrs.y[bi] + 4.2) {
        intrus++;
        console.error('INTRUSION ROUTE:', { shape: o.shape, p: o.p, s: o.s, d, yRoute: cMrs.y[bi], sRoute: bi * cMrs.pas });
      }
    }
  }
  assert.equal(intrus, 0, 'aucune intrusion sur la chaussée marseillaise');
});

test('Stands F1 : portiques, chicane de sortie sans intrusion piste, 12 mécaniciens & sucette STOP → GO !', () => {
  const cVal = B.circuit.creer(11, { theme: 'foret', longueur: 4200, nom: 'Val-Brûlé' });
  assert.ok(cVal.stands, 'Val-Brûlé possède des stands');
  const decorVal = B.decor.construire(cVal, { qualite: 'high', vegetation: false, saison: 'ete', organique: true });
  const S = cVal.stands, w = cVal.largeur / 2;
  const sBox = (S.garage0 + S.garage1) * 0.5;

  // Vérifier que les décors statiques des stands n'entrent jamais dans la trajectoire piste principale (d < S.d - S.demi - 0.15)
  const dLimitePiste = S.d - S.demi - 0.20;
  const decorsStands = [];
  B.equipeStands.construireDecors(cVal, { sol: decorVal.sol }, (objs) => { decorsStands.push(...objs); });
  assert.ok(decorsStands.length >= 60, 'décors stands riches: ' + decorsStands.length);
  for (const o of decorsStands) {
    assert.ok(o.p.every(Number.isFinite) && o.s.every(Number.isFinite));
    if (o.p[1] - o.s[1] * 0.5 > 3.5) continue; // poutre porte-à-faux en hauteur
    if (o.s[1] <= 0.05) continue; // peinture plate au sol
    const proj = B.circuit.point ? null : null;
    let bi = 0, bd2 = 1e18;
    for (let i = 0; i < cVal.n; i++) {
      const dx = o.p[0] - cVal.x[i], dz = o.p[2] - cVal.z[i];
      const d2 = dx * dx + dz * dz;
      if (d2 < bd2) { bd2 = d2; bi = i; }
    }
    const rx = -Math.sin(cVal.cap[bi]), rz = Math.cos(cVal.cap[bi]);
    const dSigned = (o.p[0] - cVal.x[bi]) * rx + (o.p[2] - cVal.z[bi]) * rz;
    assert.ok(dSigned >= dLimitePiste, `objet stand trop à gauche sur piste principale: d=${dSigned.toFixed(2)} < ${dLimitePiste.toFixed(2)}`);
  }

  // Tester les 4 phases de l'équipe de 12 mécaniciens (zéro allocation par image)
  const eq = B.equipeStands.creer(cVal, decorVal);
  assert.equal(eq.actif, true);
  assert.equal(eq.mecs.length, 12, '12 mécaniciens F1');
  const co = B.course.creer(cVal, { mode: 'chrono', rivaux: 0, tours: 2, graine: 7 });
  const j = co.joueur;
  const fBox = B.circuit.echantillon(cVal, sBox);
  const sortie = [];

  // 1. Culling lointain (> 340 m)
  B.equipeStands.animer(eq, 1.0, { course: co, nuit: 0, cameraPos: [fBox.x + 800, 5, fBox.z + 800] }, sortie);
  assert.equal(sortie.length, 0, 'culling lointain coupe les stands');

  // 2. Veille (près du box)
  sortie.length = 0;
  B.equipeStands.animer(eq, 1.0, { course: co, nuit: 0, cameraPos: [fBox.x, 3, fBox.z] }, sortie);
  assert.equal(sortie.length, eq.objets.length);
  const refsAvant = sortie.slice();

  // 3. Service en cours (u = 0.25 → pistolet dévisse, étincelles, sucette ROUGE STOP abaissée)
  j.etat.s = sBox; j.etat.d = S.d; j.etat.v = 0;
  j.etat.stands = { phase: 'service', t: 0.625, duree: 2.5, pneus: 'pluie', sService: sBox, dService: S.d };
  sortie.length = 0;
  B.equipeStands.animer(eq, 2.0, { course: co, nuit: 0, cameraPos: [fBox.x, 3, fBox.z] }, sortie);
  for (let i = 0; i < sortie.length; i++) {
    assert.equal(sortie[i], refsAvant[i], 'zéro allocation par image');
    assert.ok(sortie[i].p.every(Number.isFinite) && sortie[i].r.every(Number.isFinite) && sortie[i].s.every(Number.isFinite));
  }
  const sucette = eq.mecs[11];
  assert.ok(sucette.disque.color[0] > 0.9 && sucette.disque.color[1] < 0.2, 'sucette ROUGE STOP pendant service');
  const yStop = sucette.disque.p[1];
  // Flanc de pneu bleu pluie appliqué aux porteurs de roues
  const flancPluie = eq.mecs[4].flanc.color;
  assert.ok(flancPluie[2] > 0.75 && flancPluie[2] > Math.max(flancPluie[0], flancPluie[1]) * 1.5, 'pneus pluie bleus portés par l\'équipe');

  // 4. Relâchement GO ! (u = 0.92 → sucette LEVÉE + VERT NÉON GO !)
  j.etat.stands.phase = 'sortie'; j.etat.stands.t = 2.50;
  sortie.length = 0;
  B.equipeStands.animer(eq, 3.68, { course: co, nuit: 0, cameraPos: [fBox.x, 3, fBox.z] }, sortie);
  assert.ok(sucette.disque.color[1] > 0.9 && sucette.disque.color[0] < 0.2, 'sucette VERT GO ! au relâchement');
  assert.ok(sucette.disque.p[1] > yStop + 0.9, `sucette levée au GO: ${sucette.disque.p[1].toFixed(2)} > ${yStop.toFixed(2)}`);
});

// 5. Test réel PhysX WASM sur Marseille (départ Vieux-Port + traversée du Viaduc du Vallon des Auffes)
const X = globalThis.FPhysX = await chargerPhysX();
try {
  test('Marseille PhysX : 4 appuis réels au Vieux-Port et traversée fluide du Viaduc du Vallon des Auffes', () => {
    const co = B.course.creer(cMrs, { mode: 'chrono', rivaux: 0, tours: 1, graine: 313 });
    co.phase = 'course';
    co.joueur.ia.hab = 0.92;
    const p = cMrs.ponts[0];
    Object.assign(co.joueur.etat, { s: p.debut - 48, d: 0, v: 26 });
    B.meteo.actuel = B.chaussee.preparer({ pluie: 0, mouille: 0, neigeSol: 0, fixe: true }, B.saisons.profil('ete', 'cote'));
    const phx = B.physique.installer(co, decorMrs);
    const e = co.joueur.etat, ph = e._physx, ev = [], cmd = {};
    try {
      for (let step = 0; step < 900; step++) {
        B.course.pas(co, B.course.commandesIA(co, co.joueur, cmd), 1 / 120, ev);
        assert.ok(Number.isFinite(ph.x) && Number.isFinite(ph.y) && Number.isFinite(ph.z));
      }
      assert.ok(e.s > p.fin + 15, `voiture a traversé le Viaduc du Vallon des Auffes: s=${e.s.toFixed(1)} > ${p.fin + 15}`);
      assert.equal(ph.groundCount, 4, '4 roues posées après le viaduc');
      assert.equal(e.repositionnements, 0, 'zéro replacement sur Marseille');
    } finally {
      B.physique.liberer(co);
    }
  });
} finally {
  X.dispose();
}

console.log(`ALL ${ok} marseille & stands checks passed!`);
