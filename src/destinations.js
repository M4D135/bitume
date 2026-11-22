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

  function trouverSite(c, outils, fraction, dMin, dMax, essais = 28) {
    const { interroger, terrain } = outils;
    for (let k = 0; k < essais; k++) {
      const s = outils.secteur ? outils.secteur.position(fraction, k * 145) : (c.longueur * fraction + k * 145) % c.longueur;
      if (outils.secteur && (!horsZoneDepart(c, s) || B.circuit.dansCouvert?.(c, s, 45))) continue;
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
    if (outils.secteur) return null;
    const sPref = c.longueur * fraction, f = B.circuit.echantillon(c, sPref % c.longueur);
    const x = f.x - Math.sin(f.cap) * dMax, z = f.z + Math.cos(f.cap) * dMax;
    return { x, z, y: terrain.sol(x, z), cap: f.cap, f, cote: 1, s: sPref };
  }

  function horsZoneDepart(c, s) {
    const L = c.longueur;
    const ss = ((s % L) + L) % L;
    if (ss < 340 || ss > L - 340) return false;
    if (c.stands) {
      const d0 = ((c.stands.debut - 90) % L + L) % L;
      const d1 = ((c.stands.fin + 90) % L + L) % L;
      if (d0 < d1 ? (ss >= d0 && ss <= d1) : (ss >= d0 || ss <= d1)) return false;
    }
    return true;
  }

  function trouverLigneDroite(c, secteur, fraction, demiPortee = 0) {
    let bestS = -1, bestK = Infinity;
    const secteurs = secteur && B.saisons?.secteurs?.(c);
    for (let k = 0; k < 36; k++) {
      const s = secteur ? secteur.position(fraction, k * 115) : (c.longueur * fraction + k * 115) % c.longueur;
      if (!horsZoneDepart(c, s)) continue;
      if (B.circuit.dansCouvert && B.circuit.dansCouvert(c, s, 45)) continue;
      let ak = 0, libre = true;
      for (let d = -demiPortee; d <= demiPortee; d += 8) {
        const pos = (s + d + c.longueur) % c.longueur;
        if (demiPortee && (!horsZoneDepart(c, pos) || B.circuit.dansCouvert?.(c, pos, 12) ||
            (secteurs && secteurs.a(pos).theme !== secteur.theme))) { libre = false; break; }
        ak = Math.max(ak, Math.abs(c.courbure[Math.floor(pos / c.pas) % c.n]));
      }
      if (!libre) continue;
      if (ak < bestK) { bestK = ak; bestS = s; }
    }
    if (bestS < 0 && (secteur || demiPortee)) return null;
    if (bestS < 0) bestS = Math.max(400, Math.min(c.longueur - 400, c.longueur * 0.45));
    return { ...B.circuit.echantillon(c, bestS), s: bestS };
  }

  function planPontFjord(c, secteur) {
    if ((secteur?.theme || c.theme) !== 'fjord') return null;
    const demi = 48, f = trouverLigneDroite(c, secteur, .32, demi);
    if (!f) return null;
    return { f, demi, tx: Math.cos(f.cap), tz: Math.sin(f.cap) };
  }

  function poidsGorge(a, b, d) {
    const t = Math.max(0, Math.min(1, (b - d) / (b - a)));
    return t * t * (3 - 2*t);
  }
  function reliefPontFjord(c, p, x, z, q, h) {
    const dx = x - p.f.x, dz = z - p.f.z;
    const travers = -dx * p.tz + dz * p.tx, long = dx * p.tx + dz * p.tz;
    if (Math.abs(long) >= p.demi + 12 || Math.abs(travers) >= 145) return h;
    const autreRoute = q.i >= 0 && Math.abs(B.circuit.ecart(c, p.f.s, q.i*c.pas)) > p.demi + 26;
    const libre = autreRoute ? 1 - poidsGorge(22, 53, q.d) : 1;
    const gorge = poidsGorge(15, p.demi+12, Math.abs(long)) * poidsGorge(84, 145, Math.abs(travers)) * libre;
    return h + (Math.min(h, p.f.y - 24) - h) * gorge;
  }

  function construirePontFjord(c, pont, terrain, lim, low) {
    const objets = [], loin = [], f = pont.f, w = c.largeur / 2;
    const beton = [.59,.63,.66], acier = [.74,.78,.80];
    const ajouter = (o, distant = true) => { objets.push(o); if (distant) loin.push(o); };
    function rive(ds, cote, retrait) {
      const s = (f.s + ds + c.longueur) % c.longueur, p = B.circuit.echantillon(c, s);
      const n = Math.floor(s/c.pas), t = s/c.pas - n, l = cote < 0 ? lim.G : lim.D;
      const d = l[n%c.n] + (l[(n+1)%c.n] - l[n%c.n])*t + retrait;
      const y = p.y - cote*w*Math.sin(p.devers) - .02*(d-w-1.2);
      return [p.x - Math.sin(p.cap)*cote*d, y, p.z + Math.cos(p.cap)*cote*d];
    }
    function poutre(a, b, hauteur, largeur, mat, couleur, distant, solide) {
      const v = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
      const p = [(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2];
      // FERRO aligne ici l’axe X local sur la corde 3D entre les deux attaches.
      const o = { shape:'box', p, s:[Math.hypot(...v), hauteur, largeur], r:B.decor.angles(...B.decor.base(v,[0,1,0])), mat, color:couleur };
      if (solide) B.decor.marquerSolide(o, solide, 2);
      ajouter(o, distant);
    }
    const tetes = [];
    for (const cote of [-1,1]) {
      const [x,y,z] = rive(0,cote,1.9);
      const bas = Math.min(terrain.sol(x,z), terrain.sol(x-2,z), terrain.sol(x+2,z), terrain.sol(x,z-2), terrain.sol(x,z+2)) - 2;
      const haut = Math.max(y + 33, bas + 34), r = [0,-f.cap,0];
      const pil = { shape:'box', p:[x,(bas+haut)/2,z], s:[3.2,haut-bas,2.4], r, mat:9, color:beton };
      B.decor.marquerSolide(pil,'pylone-fjord',2); ajouter(pil);
      const semelle = { shape:'box', p:[x,bas+1.5,z], s:[5.6,3,4.6], r, mat:9, color:[.41,.44,.47] };
      B.decor.marquerSolide(semelle,'fondation-fjord',2); ajouter(semelle);
      tetes.push([x,haut-7,z]);
      for (const ds of (low ? [-40,-20,20,40] : [-40,-29,-18,18,29,40])) {
        const assise = rive(ds,cote,1.6), ancre = [assise[0],assise[1]+.55,assise[2]];
        const distant = Math.abs(ds) >= 29 || low;
        ajouter({ shape:'box', p:[ancre[0],assise[1]+.27,ancre[2]], s:[1.15,.62,.9], r, mat:9, color:beton }, distant);
        poutre([x,haut-1-Math.max(0,40-Math.abs(ds))*.12,z],ancre,.17,.17,0,acier,distant);
      }
    }
    poutre(tetes[0],tetes[1],1.3,1.8,9,beton,true);
    // Chaque culée soutient l’extrémité du tablier suivant son dévers et entre dans les deux talus.
    for (const ds of [-pont.demi+1, pont.demi-1]) {
      const g = rive(ds,-1,3.3), d = rive(ds,1,3.3);
      const haut = Math.min(g[1],d[1]) - 1.15;
      const sol = Math.min(terrain.sol(g[0],g[2]),terrain.sol(d[0],d[2]),terrain.sol((g[0]+d[0])/2,(g[2]+d[2])/2));
      const bas = Math.min(haut-1.6, sol-1.2), y = (haut+bas)/2;
      poutre([g[0],y,g[2]],[d[0],y,d[2]],haut-bas,2.4,9,beton,true,'culee-fjord');
      poutre([g[0],g[1]-1.42,g[2]],[d[0],d[1]-1.42,d[2]],.7,2.4,9,beton,true,'appui-fjord');
    }
    return { objets, loin };
  }

  function poser(c, outils) {
    const theme = outils?.secteur?.theme || c?.theme;
    if (!c || !THEMES[theme] || !outils || !outils.ajouter) return null;
    const { terrain, limites, ajouter, qualite } = outils;
    const D = B.decor;
    const rocheShape = B.lieux ? 'bitume-lieu-rocher-alpin' : 'octa';
    const galetShape = B.lieux ? 'bitume-lieu-galet-a' : 'octa';
    const isLow = qualite === 'low';
    const compte = { theme, objets: 0, marqueurs: [] };
    function marquer(nom, x, y, z, rayon = 105, hauteur = 42) {
      compte.marqueurs.push({ nom, x, y, z, rayon, hauteur });
    }

    function push(objs, loin, x, z) {
      ajouter(objs, loin, x, z);
      compte.objets += objs.length;
    }

    if (theme === 'fjord') {
      // Grand Pont Haubané au-dessus d'une portion droite + 2 cascades de granit
      const pont = outils.pontFjord === undefined ? planPontFjord(c, outils.secteur) : outils.pontFjord;
      if (!pont) return compte;
      const f = pont.f, piles = construirePontFjord(c, pont, terrain, limites, isLow);
      push(piles.objets, piles.loin, f.x, f.z);
      marquer('Grand Pont du Fjord-d’Argent', f.x, f.y + 12, f.z, 115, 48);
      const siteC = trouverSite(c, outils, 0.65, 55, 110);
      if (!siteC) return compte;
      const cascForme = B.lieux ? 'bitume-lieu-cascade' : 'bevel';
      const lacForme = B.lieux ? 'bitume-lieu-lac-organique' : 'cylinder';
      const casc = [
        { shape: cascForme, p: [siteC.x, siteC.y + 24, siteC.z], s: [8.5, 52, 4.2], r: [.15, -siteC.cap + .2, 0], mat: 12, color: [.80, .92, .98], emissive: .22 },
        { shape: lacForme, p: [siteC.x, siteC.y + .45, siteC.z], s: [26, .9, 21], r: [0, -siteC.cap + .4, 0], mat: 12, color: [.10, .30, .42] }
      ];
      push(casc, casc, siteC.x, siteC.z);
    } else if (theme === 'carpates') {
      // Citadelle des Carpates (donjon + 4 tours à toits coniques + courtines)
      const site = trouverSite(c, outils, 0.42, 48, 95);
      if (!site) return compte;
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
      marquer('Citadelle des Carpates', site.x, site.y + 18, site.z, 110, 46);
    } else if (theme === 'ecosse') {
      // Château des Highlands en pierre grise + cercle de menhirs organiques
      const site = trouverSite(c, outils, 0.38, 45, 90);
      if (!site) return compte;
      const objs = [], loin = [], pierre = [.38, .39, .40];
      const tour = { shape: 'bevel', p: [site.x, site.y + 11, site.z], s: [10, 22, 10], r: [0, -site.cap, 0], mat: 9, color: pierre };
      const aile = { shape: 'bevel', p: [site.x + 11, site.y + 6, site.z], s: [14, 12, 8], r: [0, -site.cap, 0], mat: 9, color: [.42, .43, .44] };
      objs.push(tour, aile); loin.push(tour, aile);
      const siteM = trouverSite(c, outils, 0.72, 32, 65);
      if (!siteM) return compte;
      const menhirs = [];
      for (let i = 0; i < 9; i++) {
        const a = i * Math.PI * 2 / 9 + Math.sin(i * 3.7) * 0.22;
        const distM = 12.5 + Math.sin(i * 2.3) * 3.4;
        const mx = siteM.x + Math.cos(a) * distM, mz = siteM.z + Math.sin(a) * distM, my = terrain.sol(mx, mz);
        const tilt = Math.sin(i * 4.1) * 0.14;
        menhirs.push({ shape: rocheShape, p: [mx, my + 2.4, mz], s: [2.1 + (i % 2) * .6, 4.8 + (i % 3) * 1.3, 1.7 + (i % 3) * .3], r: [tilt, a + i * .7, -tilt * .7], mat: 23, color: [.36, .37, .38] });
      }
      push(objs, loin, site.x, site.z);
      push(menhirs, menhirs.slice(0, 4), siteM.x, siteM.z);
      marquer('Château des Highlands', site.x, site.y + 14, site.z, 105, 42);
    } else if (theme === 'sierra') {
      // Grande Arche de Grès Naturelle au-dessus d'une droite HORS zone départ/stands
      const f = trouverLigneDroite(c, outils.secteur, 0.45);
      if (!f) return compte;
      if (!B.lieux) return compte;
      const repere = D.cadre(c, Math.round(f.s / c.pas));
      const gres = [.56, .25, .14];
      const arche = B.lieux.poserArcheRoute(repere, limites, terrain, 'bitume-lieu-arche-naturelle', 21, 9.2, 23, gres);
      const objets = arche.objets;
      if (!objets.length) return compte;
      // Éboulis indépendants sur les deux berges. Chaque pierre conserve son propre appui.
      for (let i = 0; i < 4; i++) {
        const cote = i % 2 ? 1 : -1, lat = cote * (arche.span / 2 + 3 + i * .8);
        const ds = i < 2 ? 3.5 : -5;
        const x = arche.cx + repere.r[0]*lat + repere.t[0]*ds, z = arche.cz + repere.r[2]*lat + repere.t[2]*ds;
        const hauteur = 1.45 + .22 * i;
        const pierre={ shape: galetShape, p: [x, 0, z],
          s: [2.4 + i*.27, hauteur, 1.9 + .32*i], r: [.06*i, i*1.7, -.08], mat: 23, color: gres,
          mobilePhysX: { genre: 'éboulis', masse: 4400 + 850*i } };
        if (B.lieux.appuyerEboulis(arche.solSite,pierre,repere.r,cote)) objets.push(pierre);
      }
      push(objets, objets, arche.cx, arche.cz);
      marquer('Grande Arche de la Sierra', arche.cx, arche.ySommet-9, arche.cz, 105, 42);
    } else if (theme === 'corail') {
      // Grand Phare Blanc & Rouge sur îlot du lagon + voiliers blancs
      const site = terrain.lagon?.rive || trouverSite(c, outils, 0.35, 55, 110);
      if (!site) return compte;
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
      const mouillage = terrain.lagon?.mouillage;
      if (mouillage && B.lieux?.ajouterVoilier) {
        const { x, y, z, cap } = mouillage, tx = Math.cos(cap), tz = Math.sin(cap);
        const voiliers = [];
        for (const ecart of [0, 17]) {
          const vx = x + ecart * tx, vz = z + ecart * tz;
          // La coque entière doit tenir sur la nappe, jusqu'à la proue et aux deux bords.
          if ([-5, 5].every(d => [-2, 2].every(l => Number.isFinite(
            terrain.niveauEauA(vx + d * tx - l * tz, vz + d * tz + l * tx)))))
            B.lieux.ajouterVoilier(voiliers, vx, vz, y, -cap, -cap + .35);
        }
        if (voiliers.length) push(voiliers, voiliers.slice(), x, z);
      }
      marquer('Phare de la Baie-du-Corail', site.x, site.y + 18, site.z, 110, 44);
    } else if (theme === 'andes') {
      // Observatoire Astronomique d'Altitude (3 coupoles blanches brillantes)
      const site = trouverSite(c, outils, 0.50, 50, 105);
      if (!site) return compte;
      const objs = [], loin = [], blanc = [.94, .95, .97], alu = [.72, .75, .79];
      for (const [dx, dz, rad] of [[0, 0, 9.5], [-18, 8, 6.5], [16, -9, 6.0]]) {
        const ox = site.x + dx, oz = site.z + dz, oy = terrain.sol(ox, oz);
        const socle = { shape: 'cylinder', p: [ox, oy + rad * .55, oz], s: [rad * 2, rad * 1.1, rad * 2], r: [0, 0, 0], mat: 13.2, color: alu };
        const dome = { shape: 'sphere', p: [ox, oy + rad * 1.1, oz], s: [rad * 1.95, rad * 1.85, rad * 1.95], r: [0, 0, 0], mat: 16, color: blanc };
        const fente = { shape: 'box', p: [ox, oy + rad * 1.5, oz + rad * .65], s: [rad * .28, rad * .9, rad * .4], r: [.4, 0, 0], mat: 7, color: [.08, .10, .14] };
        objs.push(socle, dome, fente); loin.push(socle, dome);
      }
      push(objs, loin, site.x, site.z);
      marquer('Observatoire des Andes', site.x, site.y + 12, site.z, 110, 46);
    }

    return compte;
  }

  B.destinations = { CATALOGUE, THEMES, poser, FORMES, planPontFjord, reliefPontFjord };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.destinations;
