/* BITUME — Six destinations originales supplémentaires (lots 16A–16F) :
   Fjord-d’Argent, Crêtes-des-Carpates, Landes-d’Écosse, Sierra-Cuivrée, Baie-du-Corail, Col-des-Andes.
   Palettes dédiées + lieux emblématiques organiques et architecturaux. Zéro asset externe, zéro Math.random(). */
(function (B) {
  'use strict';

  const CATALOGUE = Object.freeze([
    Object.freeze({ id: 'fjord', nom: 'Fjord-d’Argent', lieu: 'Norvège · fjord de granit et cascade', theme: 'fjord', graine: 223, longueur: 5100 }),
    Object.freeze({ id: 'carpates', nom: 'Crêtes-des-Carpates', lieu: 'Roumanie · col boisé et citadelle', theme: 'carpates', graine: 241, longueur: 5300 }),
    Object.freeze({ id: 'ecosse', nom: 'Landes-d’Écosse', lieu: 'Highlands · bruyères et loch brumeux', theme: 'ecosse', graine: 257, longueur: 4700 }),
    Object.freeze({ id: 'sierra', nom: 'Sierra-Cuivrée', lieu: 'Canyons ocre · arche et viaduc rouge', theme: 'sierra', graine: 271, longueur: 5000 }),
    Object.freeze({ id: 'corail', nom: 'Baie-du-Corail', lieu: 'Lagon turquoise · atoll et phare blanc', theme: 'corail', graine: 283, longueur: 4500 }),
    Object.freeze({ id: 'andes', nom: 'Col-des-Andes', lieu: 'Cordillère · haute altitude et observatoire', theme: 'andes', graine: 293, longueur: 5600 })
  ]);

  const THEMES = Object.freeze({
    fjord: Object.freeze({
      atmosphere: Object.freeze({
        skyTop: [.13, .28, .48], skyBottom: [.58, .68, .76], fog: [.54, .64, .72],
        sunDirection: [-.42, .56, -.36], sunColor: [1.22, 1.18, 1.10], ambient: [.30, .35, .42],
        fogDensity: .00085, wind: .75, biome: 'montagne'
      }),
      herbe: [.17, .31, .16], herbeClaire: [.25, .40, .21], terre: [.26, .24, .21],
      roche: [.27, .29, .32], sable: [.46, .45, .42], neige: [.93, .95, .98],
      relief: 46, echelle: 480, essence: 'conifere', densite: .42, marge: 960,
      eau: -6, montagnes: true
    }),
    carpates: Object.freeze({
      atmosphere: Object.freeze({
        skyTop: [.16, .34, .58], skyBottom: [.64, .73, .80], fog: [.58, .66, .72],
        sunDirection: [.36, .64, -.32], sunColor: [1.30, 1.22, 1.04], ambient: [.31, .35, .37],
        fogDensity: .00080, wind: .55, biome: 'montagne'
      }),
      herbe: [.20, .35, .14], herbeClaire: [.30, .45, .18], terre: [.31, .25, .17],
      roche: [.41, .39, .36], sable: [.54, .50, .42], neige: [.92, .94, .97],
      relief: 44, echelle: 460, essence: 'conifere', densite: .56, marge: 920,
      montagnes: true
    }),
    ecosse: Object.freeze({
      atmosphere: Object.freeze({
        skyTop: [.20, .30, .44], skyBottom: [.62, .66, .70], fog: [.58, .62, .66],
        sunDirection: [-.30, .48, .50], sunColor: [1.16, 1.14, 1.06], ambient: [.32, .35, .39],
        fogDensity: .00120, wind: .90, biome: 'foret'
      }),
      herbe: [.22, .32, .17], herbeClaire: [.39, .26, .34], terre: [.28, .23, .18],
      roche: [.36, .36, .35], sable: [.52, .48, .42], neige: [.90, .92, .95],
      relief: 34, echelle: 420, essence: 'conifere', densite: .26, marge: 880,
      eau: -4.5
    }),
    sierra: Object.freeze({
      atmosphere: Object.freeze({
        skyTop: [.12, .32, .62], skyBottom: [.84, .70, .52], fog: [.72, .56, .40],
        sunDirection: [.56, .62, -.28], sunColor: [1.40, 1.18, .86], ambient: [.38, .33, .28],
        fogDensity: .00060, wind: .65, biome: 'desert'
      }),
      herbe: [.54, .36, .20], herbeClaire: [.68, .48, .27], terre: [.58, .31, .16],
      roche: [.52, .26, .14], sable: [.78, .60, .38], neige: [.92, .92, .94],
      relief: 38, echelle: 440, essence: null, densite: 0, marge: 1020,
      aride: true
    }),
    corail: Object.freeze({
      atmosphere: Object.freeze({
        skyTop: [.09, .44, .78], skyBottom: [.70, .86, .93], fog: [.66, .82, .89],
        sunDirection: [.22, .74, -.30], sunColor: [1.38, 1.28, 1.04], ambient: [.35, .41, .44],
        fogDensity: .00072, wind: .70, biome: 'cote'
      }),
      herbe: [.18, .44, .18], herbeClaire: [.28, .54, .23], terre: [.52, .46, .30],
      roche: [.56, .54, .48], sable: [.88, .83, .68], neige: [.95, .96, .98],
      relief: 22, echelle: 380, essence: 'pin', densite: .34, marge: 860,
      eau: -3.5, pacifique: true
    }),
    andes: Object.freeze({
      atmosphere: Object.freeze({
        skyTop: [.07, .24, .58], skyBottom: [.58, .70, .84], fog: [.58, .68, .80],
        sunDirection: [-.32, .76, -.34], sunColor: [1.36, 1.28, 1.14], ambient: [.30, .35, .43],
        fogDensity: .00062, wind: .85, biome: 'montagne'
      }),
      herbe: [.30, .36, .19], herbeClaire: [.42, .44, .24], terre: [.40, .31, .22],
      roche: [.44, .39, .35], sable: [.62, .54, .42], neige: [.95, .96, .99],
      relief: 48, echelle: 520, essence: null, densite: .08, marge: 1050,
      montagnes: true
    })
  });

  const FORMES = {};

  function trouverSite(c, outils, sPref, dMin, dMax, essais = 28) {
    const { interroger, terrain } = outils;
    for (let k = 0; k < essais; k++) {
      const s = ((sPref + k * 145) % c.longueur + c.longueur) % c.longueur;
      const f = B.circuit.echantillon(c, s);
      const cote = (k & 1) ? 1 : -1;
      const d = dMin + ((k * 37) % 100) / 100 * (dMax - dMin);
      const x = f.x - Math.sin(f.cap) * cote * d;
      const z = f.z + Math.cos(f.cap) * cote * d;
      const q = interroger ? interroger(x, z, 60, true) : { d: 999 };
      if (!q || q.d >= Math.max(20, dMin * 0.72)) {
        return { x, z, y: terrain.sol(x, z), cap: f.cap, f, cote, s };
      }
    }
    const f = B.circuit.echantillon(c, sPref % c.longueur);
    const x = f.x - Math.sin(f.cap) * dMax, z = f.z + Math.cos(f.cap) * dMax;
    return { x, z, y: terrain.sol(x, z), cap: f.cap, f, cote: 1, s: sPref };
  }

  function trouverLigneDroite(c, sPref) {
    let bestS = sPref % c.longueur, bestK = Infinity;
    for (let k = 0; k < 24; k++) {
      const s = (sPref + k * 170) % c.longueur;
      const idx = Math.floor(s / c.pas) % c.n;
      const ak = Math.abs(c.courbure[idx]);
      if (ak < bestK && !(B.circuit.dansCouvert && B.circuit.dansCouvert(c, s, 25))) { bestK = ak; bestS = s; }
    }
    return B.circuit.echantillon(c, bestS);
  }

  function poser(c, outils) {
    if (!c || !THEMES[c.theme] || !outils || !outils.ajouter) return null;
    const { terrain, limites, ajouter, qualite } = outils;
    const D = B.decor;
    const rocheShape = B.lieux ? 'bitume-lieu-rocher-alpin' : 'octa';
    const galetShape = B.lieux ? 'bitume-lieu-galet-a' : 'octa';
    const isLow = qualite === 'low';
    const compte = { theme: c.theme, objets: 0 };

    function push(objs, loin, x, z) {
      ajouter(objs, loin, x, z);
      compte.objets += objs.length;
    }

    if (c.theme === 'fjord') {
      // Grand Pont Haubané au-dessus d'une portion droite + 2 cascades de granit
      const f = trouverLigneDroite(c, c.longueur * 0.32);
      const rx = -Math.sin(f.cap), rz = Math.cos(f.cap);
      const span = (c.largeur || 12) + 14;
      const objs = [], loin = [];
      for (const side of [-1, 1]) {
        const px = f.x + rx * side * (span / 2), pz = f.z + rz * side * (span / 2);
        const py = terrain.sol(px, pz);
        const h = Math.max(36, f.y - py + 34);
        const pil = { shape: 'cylinder', p: [px, py + h / 2, pz], s: [2.4, h, 2.4], r: [0, 0, 0], mat: 9, color: [.78, .80, .84] };
        D.marquerSolide(pil, 'pylone-fjord', 2);
        objs.push(pil); loin.push(pil);
      }
      const traverse = { shape: 'box', p: [f.x, f.y + 18, f.z], s: [2.2, 1.4, span + 2], r: [0, -f.cap, 0], mat: 0, color: [.72, .75, .80] };
      objs.push(traverse); loin.push(traverse);
      if (!isLow) {
        for (const side of [-1, 1]) {
          for (const dx of [-26, -16, -8, 8, 16, 26]) {
            const p0 = [f.x + rx * side * (span / 2), f.y + 32, f.z + rz * side * (span / 2)];
            const p1 = [f.x + Math.cos(f.cap) * dx + rx * side * (span / 2), f.y + 2, f.z + Math.sin(f.cap) * dx + rz * side * (span / 2)];
            const dir = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const rot = D.angles(...D.base(dir, [0, 1, 0]));
            objs.push({ shape: 'cylinder', p: [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2], s: [.18, Math.hypot(...dir), .18], r: rot, mat: 0, color: [.82, .84, .88] });
          }
        }
      }
      push(objs, loin, f.x, f.z);
      const siteC = trouverSite(c, outils, c.longueur * 0.65, 55, 110);
      const casc = [
        { shape: 'cylinder', p: [siteC.x, siteC.y + 24, siteC.z], s: [7, 52, 3], r: [.15, -siteC.cap, 0], mat: 12, color: [.80, .92, .98], emissive: .2 },
        { shape: 'cylinder', p: [siteC.x, siteC.y + .5, siteC.z], s: [22, .8, 18], r: [0, 0, 0], mat: 12, color: [.10, .30, .42] }
      ];
      push(casc, casc, siteC.x, siteC.z);
    } else if (c.theme === 'carpates') {
      // Citadelle des Carpates (donjon + 4 tours à toits coniques + courtines)
      const site = trouverSite(c, outils, c.longueur * 0.42, 48, 95);
      const objs = [], loin = [], pierre = [.50, .47, .42], toit = [.24, .18, .17];
      const donjon = { shape: 'cylinder', p: [site.x, site.y + 15, site.z], s: [11, 30, 11], r: [0, 0, 0], mat: 9, color: pierre };
      const toitD = { shape: 'cone', p: [site.x, site.y + 34, site.z], s: [13, 10, 13], r: [0, 0, 0], mat: 1, color: toit };
      objs.push(donjon, toitD); loin.push(donjon, toitD);
      for (const [dx, dz] of [[-14, -10], [14, -10], [-14, 10], [14, 10]]) {
        const tx = site.x + dx, tz = site.z + dz, ty = terrain.sol(tx, tz);
        const t = { shape: 'cylinder', p: [tx, ty + 10, tz], s: [5.5, 22, 5.5], r: [0, 0, 0], mat: 9, color: pierre };
        const tc = { shape: 'cone', p: [tx, ty + 24, tz], s: [7, 7, 7], r: [0, 0, 0], mat: 1, color: toit };
        objs.push(t, tc); loin.push(t);
      }
      for (const [dx, dz, sx, sz] of [[0, -10, 28, 2.2], [0, 10, 28, 2.2], [-14, 0, 2.2, 20], [14, 0, 2.2, 20]]) {
        const m = { shape: 'bevel', p: [site.x + dx, site.y + 7, site.z + dz], s: [sx, 15, sz], r: [0, 0, 0], mat: 9, color: pierre };
        objs.push(m); loin.push(m);
      }
      push(objs, loin, site.x, site.z);
    } else if (c.theme === 'ecosse') {
      // Château des Highlands en pierre grise + cercle de menhirs organiques
      const site = trouverSite(c, outils, c.longueur * 0.38, 45, 90);
      const objs = [], loin = [], pierre = [.38, .39, .40];
      const tour = { shape: 'bevel', p: [site.x, site.y + 11, site.z], s: [10, 22, 10], r: [0, -site.cap, 0], mat: 9, color: pierre };
      const aile = { shape: 'bevel', p: [site.x + 11, site.y + 6, site.z], s: [14, 12, 8], r: [0, -site.cap, 0], mat: 9, color: [.42, .43, .44] };
      objs.push(tour, aile); loin.push(tour, aile);
      const siteM = trouverSite(c, outils, c.longueur * 0.72, 32, 65);
      const menhirs = [];
      for (let i = 0; i < 9; i++) {
        const a = i * Math.PI * 2 / 9;
        const mx = siteM.x + Math.cos(a) * 14, mz = siteM.z + Math.sin(a) * 14, my = terrain.sol(mx, mz);
        menhirs.push({ shape: rocheShape, p: [mx, my + 2.4, mz], s: [2.2, 5.4 + (i % 3) * 1.1, 1.8], r: [0, a, 0], mat: 9, color: [.36, .37, .38] });
      }
      push(objs, loin, site.x, site.z);
      push(menhirs, menhirs.slice(0, 4), siteM.x, siteM.z);
    } else if (c.theme === 'sierra') {
      // Grande Arche de Grès Naturelle au-dessus d'une droite + mesas organiques
      const f = trouverLigneDroite(c, c.longueur * 0.45);
      const rx = -Math.sin(f.cap), rz = Math.cos(f.cap), gres = [.56, .25, .14];
      const objs = [], loin = [];
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI * i / 12;
        const lat = Math.cos(a) * 19, h = Math.sin(a) * 17 + 4;
        const ax = f.x + rx * lat, az = f.z + rz * lat;
        const bloc = { shape: galetShape, p: [ax, f.y + h, az], s: [9.5, 6.2, 8.5], r: [0, -f.cap + a * .2, 0], mat: 9, color: gres };
        if (i === 0 || i === 12) D.marquerSolide(bloc, 'arche-sierra', 2);
        objs.push(bloc); if (i % 2 === 0) loin.push(bloc);
      }
      push(objs, loin, f.x, f.z);
    } else if (c.theme === 'corail') {
      // Grand Phare Blanc & Rouge sur îlot du lagon + voiliers blancs
      const site = trouverSite(c, outils, c.longueur * 0.35, 55, 110);
      const objs = [], loin = [];
      const ilot = { shape: galetShape, p: [site.x, site.y + 1.5, site.z], s: [24, 5, 22], r: [0, 0, 0], mat: 9, color: [.74, .68, .54] };
      const f1 = { shape: 'cylinder', p: [site.x, site.y + 9, site.z], s: [5.2, 12, 5.2], r: [0, 0, 0], mat: 13.2, color: [.94, .94, .92] };
      const f2 = { shape: 'cylinder', p: [site.x, site.y + 18, site.z], s: [4.5, 8, 4.5], r: [0, 0, 0], mat: 13.2, color: [.84, .14, .10] };
      const f3 = { shape: 'cylinder', p: [site.x, site.y + 25, site.z], s: [3.8, 7, 3.8], r: [0, 0, 0], mat: 13.2, color: [.94, .94, .92] };
      const lanterne = { shape: 'cylinder', p: [site.x, site.y + 30.5, site.z], s: [3.2, 3.2, 3.2], r: [0, 0, 0], mat: 16, color: [1.0, 0.94, 0.72], emissive: 2.2 };
      const coupole = { shape: 'sphere', p: [site.x, site.y + 32.5, site.z], s: [3.4, 2.2, 3.4], r: [0, 0, 0], mat: 0, color: [.82, .14, .10] };
      objs.push(ilot, f1, f2, f3, lanterne, coupole);
      loin.push(ilot, f1, f2, f3, lanterne);
      push(objs, loin, site.x, site.z);
    } else if (c.theme === 'andes') {
      // Observatoire Astronomique d'Altitude (3 coupoles blanches brillantes)
      const site = trouverSite(c, outils, c.longueur * 0.50, 50, 105);
      const objs = [], loin = [], blanc = [.94, .95, .97], alu = [.72, .75, .79];
      for (const [dx, dz, rad] of [[0, 0, 9.5], [-18, 8, 6.5], [16, -9, 6.0]]) {
        const ox = site.x + dx, oz = site.z + dz, oy = terrain.sol(ox, oz);
        const socle = { shape: 'cylinder', p: [ox, oy + rad * .55, oz], s: [rad * 2, rad * 1.1, rad * 2], r: [0, 0, 0], mat: 13.2, color: alu };
        const dome = { shape: 'sphere', p: [ox, oy + rad * 1.1, oz], s: [rad * 1.95, rad * 1.85, rad * 1.95], r: [0, 0, 0], mat: 16, color: blanc };
        const fente = { shape: 'box', p: [ox, oy + rad * 1.5, oz + rad * .65], s: [rad * .28, rad * .9, rad * .4], r: [.4, 0, 0], mat: 7, color: [.08, .10, .14] };
        objs.push(socle, dome, fente); loin.push(socle, dome);
      }
      push(objs, loin, site.x, site.z);
    }

    return compte;
  }

  B.destinations = { CATALOGUE, THEMES, poser, FORMES };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.destinations;
