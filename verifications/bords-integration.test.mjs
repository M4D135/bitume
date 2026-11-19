// Bords de route du lot 22F branchés sur le décor (integration.patch du rapport docs/reprise/rapports/lieux-2026-11-18) :
// avec src/bords.js chargé, le décor garde ses tirages, ses arbres, ses lots et ses solides historiques dans le même
// ordre et avec les mêmes identifiants ; les objets des bords arrivent dans des lots à eux, à la fin, et leurs solides
// après tous les autres ; la glissière disparaît seulement derrière un parapet, un muret ou les balises d'un fossé.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
for (const f of ['carene', 'circuit', 'decor', 'obstacles', 'bords']) require('../src/' + f + '.js');
const B = globalThis.BITUME;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok  ' + nom); };
const CATALOGUE = [[11, 'foret', 4200, 'Val-Brûlé'], [29, 'cote', 3600, 'Port-Sable'], [47, 'montagne', 5200, 'Haut-Col'], [83, 'islande', 4600, 'Lande-Noire'],
  [107, 'desert', 4800, 'Roche-Fauve'], [131, 'asie', 5000, 'Brume-de-Jade'], [157, 'pacifique', 5200, 'Cap-Séquoia']];
// le circuit tel que jeu.js le prépare : création, puis limites resserrées une fois
const preparer = ([graine, theme, longueur, nom]) => { const c = B.circuit.creer(graine, { theme, longueur, nom }); B.bords.limites(c, B.bords.planifier(c)); return c; };
const sansBords = (c, options) => { const m = B.bords; delete B.bords; try { return B.decor.construire(c, options); } finally { B.bords = m; } };
const glissiere = o => o.shape === 'box' && Math.abs(o.s[1] - .34) < 1e-9 && Math.abs(o.s[2] - .07) < 1e-9 && o.mat === 0;

for (const k of CATALOGUE) for (const qualite of ['low', 'high']) verifier(`${k[3]} (${qualite}) : décor historique intact, bords ajoutés à la fin`, () => {
  const c = preparer(k), plan = B.bords.planifier(c), avant = sansBords(c, { qualite }), apres = B.decor.construire(c, { qualite });
  // tirages du décor inchangés : mêmes arbres au même endroit
  assert.deepEqual(apres.arbres, avant.arbres);
  // solides historiques : mêmes descripteurs, même ordre, donc mêmes identifiants ; ceux des bords suivent
  assert.ok(apres.obstacles.length >= avant.obstacles.length);
  assert.deepEqual(apres.obstacles.slice(0, avant.obstacles.length), avant.obstacles);
  const idx = B.obstacles.creer(apres.obstacles);
  assert.equal(idx.objets.length, apres.obstacles.length, 'tout solide des bords est accepté par l\'index de collision');
  // l'ordre des solides suit celui des lots (comme verifications/decor-obstacles.test.mjs l'exige). En Moyenne et Fine,
  // les arbres sortent de leurs lots pour des lots de cases dessinés à part (lotsImage de src/decor.js) : l'ordre se
  // vérifie sur le mobilier, et chaque tronc dessiné a son solide.
  const portes = apres.lots.flatMap(l => l.objets).filter(o => o.collision);
  assert.equal(portes.length, apres.obstacles.length);
  const mobilier = portes.filter(o => o.collision !== 'tronc'), solides = apres.obstacles.filter(d => d.type !== 'prism');
  assert.equal(mobilier.length, solides.length);
  mobilier.forEach((o, i) => assert.equal(solides[i].x, o.p[0]));
  const troncs = new Set(apres.obstacles.filter(d => d.type === 'prism').map(d => d.p[0] + ',' + d.p[2]));
  for (const o of portes) if (o.collision === 'tronc') assert.ok(troncs.has(o.p[0] + ',' + o.p[2]), 'tronc sans solide');
  // lots : chaque lot historique se retrouve tel quel (glissières retirées mises à part), et ceux des bords s'ajoutent
  const nb = avant.lots.length, filtre = l => JSON.stringify(l.objets.filter(o => !glissiere(o) && !(o.shape === 'box' && Math.abs(o.s[1] - .8) < 1e-9 && o.mat === 0)));
  assert.ok(apres.lots.length > nb);
  const restants = new Map();
  for (const l of apres.lots) { const k = filtre(l); restants.set(k, (restants.get(k) || 0) + 1); }
  for (let i = 0; i < nb; i++) {
    const k = filtre(avant.lots[i]), m = restants.get(k) || 0;
    assert.ok(m > 0, `lot historique ${i} modifié`); restants.set(k, m - 1);
  }
  // glissières retirées : seulement derrière un parapet, un muret ou les balises d'un fossé
  const retirees = avant.lots.flatMap(l => l.objets).filter(glissiere).length - apres.lots.flatMap(l => l.objets).filter(glissiere).length;
  let attendu = 0;
  for (const d of plan.dangers) if (d.type === 'vide' || d.type === 'muret' || d.type === 'fosse') { const b = B.bords.bornes(c, d); attendu += (b.i1 - b.i0) / 4 + 1; }
  assert.equal(retirees, attendu, `${retirees} glissières retirées pour ${attendu} segments de parapet`);
});

// La caméra au sol de la démo (jeu.js, cameraSol) se pose à min(w + 1,1 ; limite − 0,4) du centre : devant un muret ou
// un parapet, elle reste sur l'accotement, à 40 cm du mur ; partout ailleurs, elle garde sa place historique (w + 1,1).
verifier('la caméra au sol ne se pose jamais dans un muret ou un parapet des bords', () => {
  const placeSol = (c, s, cote) => Math.min(c.largeur / 2 + 1.1, B.circuit.limiteA(c, s, cote) - .4);
  for (const k of CATALOGUE) {
    const c = preparer(k), plan = B.bords.planifier(c), w = c.largeur / 2;
    for (const d of plan.dangers) {
      if (d.type !== 'vide' && d.type !== 'muret') continue;
      const { i0, i1 } = B.bords.bornes(c, d);
      for (let i = i0; i <= i1 + 4; i++) {
        const s = i * c.pas, lim = B.circuit.limiteA(c, s, d.cote), place = placeSol(c, s, d.cote);
        assert.ok(place <= lim - .4 + 1e-9, `${k[3]} : caméra à ${place} pour un mur à ${lim}`);
        assert.ok(place >= w + .5, `${k[3]} : caméra sur la chaussée (${place})`);
      }
    }
    // hors des bords, la place historique ne bouge pas
    for (let s = 0; s < c.longueur; s += 50) for (const cote of [-1, 1]) {
      if (plan.dangers.some(d => d.cote === cote && (d.type === 'vide' || d.type === 'muret') && s > d.debut - 150 && s < d.fin + 150)) continue;
      if (B.circuit.dansTunnel(c, s, 30)) continue;
      assert.equal(placeSol(c, s, cote), w + 1.1, `${k[3]} : place changée à ${s}`);
    }
  }
});

console.log(`${n} vérifications de l'intégration des bords de route`);
