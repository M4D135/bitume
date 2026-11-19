// Couleurs CPU de la vraie chaussée : cohérence avec la couverture physique, sans nouvelle géométrie.
import '../src/circuit.js';
import '../src/carene.js';
import '../src/saisons.js';
import '../src/chaussee.js';
import '../src/decor.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const B = globalThis.BITUME, C = B.chaussee;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const construire = (c, saison, options = {}) => B.decor.construire(c, { qualite: 'low', vegetation: false, saison, ...options });
const empreinteRoute = d => {
  const h = createHash('sha256');
  for (const n of d.nappes.filter(n => n.surfaceType === 'accotement')) {
    h.update(Buffer.from(n.sommets.buffer, n.sommets.byteOffset, n.sommets.byteLength));
    h.update(Buffer.from(n.indices.buffer, n.indices.byteOffset, n.indices.byteLength));
  }
  return h.digest('hex');
};
// Capturées avant le raccord visuel 12E : les nappes d'été sans les nouveaux repères,
// couleurs comprises, restent celles de 0.2.46. Ces empreintes historiques ne sont pas régénérées.
const CAS = [
  { theme: 'foret', graine: 11, longueur: 4200, ete: '4d683fa0825f0c4ec9213994c5e2c4617a4d08485ac7f308ba9e46174da3b30e' },
  { theme: 'cote', graine: 29, longueur: 3600, ete: '223f5ee2de2c5cc722aef4840956b3cff62ad43623e1f92829cd585741840781' },
  { theme: 'montagne', graine: 47, longueur: 5200, ete: '01556772b8a74aac371d4b4e87443b52c171efde5541f4fea5fd0e84baa59a42' }
];

for (const cas of CAS) {
  const c = B.circuit.creer(cas.graine, cas), ete = construire(c, 'ete');
  const eteHistorique = construire(c, 'ete', { reperesVirages: false });
  verifier(`${cas.theme} : empreinte d'été historique inchangée sans les nouveaux repères`, () => {
    assert.equal(empreinteRoute(eteHistorique), cas.ete);
  });
  verifier(`${cas.theme} : les repères actifs par défaut ne recolorent que les vibreurs historiques`, () => {
    assert.ok(ete.lots.some(l => l.objets.some(o => o.repereVirage?.type === 'freinage')), 'les nouveaux repères sont réellement actifs');
    assert.deepEqual(ete.obstacles, eteHistorique.obstacles);
    assert.equal(ete.nappes.length, eteHistorique.nappes.length);
    let recolores = 0;
    for (let i = 0; i < ete.nappes.length; i++) {
      const n = ete.nappes[i], base = eteHistorique.nappes[i];
      assert.equal(n.sommets.length, base.sommets.length);
      assert.deepEqual(n.indices, base.indices);
      for (let k = 0; k < n.sommets.length; k += 13) {
        for (let a = 0; a < 10; a++) assert.equal(n.sommets[k + a], base.sommets[k + a], 'position, normale et matière intactes avec les repères');
        if (![10, 11, 12].some(a => n.sommets[k + a] !== base.sommets[k + a])) continue;
        assert.equal(base.surfaceType, 'accotement');
        assert.equal(base.sommets[k + 9], 14);
        const vibreurHistorique = [[.74, .09, .07], [.90, .90, .87]]
          .some(couleur => couleur.every((v, a) => Math.abs(base.sommets[k + 10 + a] - v) < 1e-6));
        assert.ok(vibreurHistorique, 'aucune recoloration de l’asphalte, des marquages ou des abords');
        recolores++;
      }
    }
    assert.ok(recolores > 0, 'le contraste des vibreurs est réellement renforcé');
  });
  // Le reste du contrôle conserve les repères actifs par défaut, dans les deux
  // constructions hivernales. Seule la lecture de neige sur l'asphalte est isolée.
  // La référence garde ses couleurs de terrain antérieures, sans cette lecture d'asphalte.
  let reference;
  try { B.chaussee = null; reference = construire(c, 'hiver'); }
  finally { B.chaussee = C; }
  const hiver = construire(c, 'hiver');
  const m = C.preparer({}, B.saisons.profil('hiver', cas.theme));
  // Les bords d'asphalte sont à 30 cm des lignes extérieures. Leur position rattache chaque couleur à
  // l'abscisse physique, sans supposer l'ordre des sommets ou le découpage des nappes.
  const abscisses = new Map(), demi = c.largeur / 2 - .3;
  for (let i = 0; i < c.n; i++) for (const d of [-demi, demi]) {
    const x = Math.fround(c.x[i] - Math.sin(c.cap[i]) * d);
    const z = Math.fround(c.z[i] + Math.cos(c.cap[i]) * d);
    abscisses.set(x + ',' + z, i * c.pas);
  }

  verifier(`${cas.theme} : seule la couleur de l'asphalte change, aucun sommet ni objet ajouté`, () => {
    assert.equal(hiver.nappes.length, reference.nappes.length);
    assert.deepEqual(hiver.lots, reference.lots);
    assert.deepEqual(hiver.obstacles, reference.obstacles);
    for (let i = 0; i < hiver.nappes.length; i++) {
      const n = hiver.nappes[i], base = reference.nappes[i];
      assert.equal(n.sommets.length, base.sommets.length);
      assert.deepEqual(n.indices, base.indices);
      for (let k = 0; k < n.sommets.length; k += 13) {
        for (let a = 0; a < 10; a++) assert.equal(n.sommets[k + a], base.sommets[k + a], 'position, normale et matière intactes');
        const asphalt = base.surfaceType === 'accotement' && (base.sommets[k + 9] === 14 || base.sommets[k + 9] === 21)
          && base.sommets[k + 10] < .3 && base.sommets[k + 10] === base.sommets[k + 11];
        if (!asphalt) for (let a = 10; a < 13; a++) assert.equal(n.sommets[k + a], base.sommets[k + a], 'marquages, vibreurs et abords conservés');
      }
    }
  });

  verifier(`${cas.theme} : asphalte clair si et seulement si la surface physique porte de la neige`, () => {
    let clairs = 0, secs = 0, abrites = 0;
    const surface = {};
    for (let i = 0; i < hiver.nappes.length; i++) {
      const n = hiver.nappes[i], base = reference.nappes[i];
      if (base.surfaceType !== 'accotement') continue;
      for (let k = 0; k < n.sommets.length; k += 13) {
        const mat = base.sommets[k + 9];
        if ((mat !== 14 && mat !== 21) || base.sommets[k + 10] >= .3 || base.sommets[k + 10] !== base.sommets[k + 11]) continue;
        const s = abscisses.get(n.sommets[k] + ',' + n.sommets[k + 2]);
        assert.ok(Number.isFinite(s), 'surface rattachée au même tracé que la conduite');
        C.lire(c, s, m, surface);
        if (surface.neige > 0) {
          clairs++;
          for (let a = 10; a < 13; a++) {
            assert.ok(n.sommets[k + a] > .5 && n.sommets[k + a] < .95, 'neige grise/blanche lisible sans blanc saturé');
            assert.ok(n.sommets[k + a] > base.sommets[k + a] + .3, 'différence nette avec le bitume sec');
          }
        } else {
          secs++; if (surface.abri) abrites++;
          for (let a = 10; a < 13; a++) assert.equal(n.sommets[k + a], base.sommets[k + a], 'sous abri et au Sud, asphalte exactement conservé');
        }
      }
    }
    if (cas.theme === 'cote') { assert.equal(clairs, 0); assert.ok(secs > 100); }
    else assert.ok(clairs > 100, 'la route enneigée a réellement changé');
    if (c.tunnel) assert.ok(abrites > 100, 'intérieur du tunnel réellement couvert par le contrôle');
  });
}

console.log(controles + ' contrôles chaussée visuelle CPU réussis');
