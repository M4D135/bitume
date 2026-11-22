/* BITUME — rive du Baïkal : paysage original, calculé une fois à la préparation.
   La piste garde son tracé. Le lac, les caps, les bois et le hameau ont leur propre plan déterministe. */
(function (B) {
  'use strict';
  const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const cloche = (x, centre, rayon) => Math.exp(-Math.pow((x - centre) / rayon, 2));
  function hache(x, z, g) {
    let h = Math.imul(Math.floor(x * 8), 374761393) ^ Math.imul(Math.floor(z * 8), 668265263) ^ g;
    h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function planifier(c, niveauEau) {
    let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < c.n; i++) {
      xmin = Math.min(xmin, c.x[i]); xmax = Math.max(xmax, c.x[i]);
      zmin = Math.min(zmin, c.z[i]); zmax = Math.max(zmax, c.z[i]);
    }
    const centre = [(xmin + xmax) * .5, (zmin + zmax) * .5];
    // La rive regarde un secteur exposé et bas du tour, sans passer entre deux branches de la piste.
    // Une projection de TOUS les échantillons fixe la garde : aucune baie ne peut couper une épingle.
    let meilleur = null;
    for (let a = 0; a < 32; a++) {
      const angle = a * Math.PI / 16, ux = Math.cos(angle), uz = Math.sin(angle);
      let bord = -Infinity;
      for (let i = 0; i < c.n; i++) bord = Math.max(bord, (c.x[i] - centre[0]) * ux + (c.z[i] - centre[1]) * uz);
      let compte = 0, hauteur = 0;
      for (let i = 0; i < c.n; i += 4) {
        const p = (c.x[i] - centre[0]) * ux + (c.z[i] - centre[1]) * uz;
        if (bord - p < 125) { compte++; hauteur += c.y[i]; }
      }
      const score = compte - (compte ? hauteur / compte : 0) * .7;
      if (!meilleur || score > meilleur.score) meilleur = { ux, uz, bord, score };
    }
    const g = (c.graine ^ 0x61b42a9d) >>> 0;
    return Object.freeze({ centre: Object.freeze(centre), axe: Object.freeze([meilleur.ux, meilleur.uz]),
      tangente: Object.freeze([-meilleur.uz, meilleur.ux]), depart: meilleur.bord + 90,
      niveauEau, graine: g, cap: -260, baie: 350 });
  }
  function local(p, x, z) {
    const dx = x - p.centre[0], dz = z - p.centre[1];
    return [dx * p.axe[0] + dz * p.axe[1], dx * p.tangente[0] + dz * p.tangente[1]];
  }
  function monde(p, u, v) { return [p.centre[0] + u * p.axe[0] + v * p.tangente[0], p.centre[1] + u * p.axe[1] + v * p.tangente[1]]; }
  function rivage(p, t) {
    return p.depart + 70 + 205 * cloche(t, p.cap, 210) + 105 * cloche(t, 880, 150)
      - 48 * cloche(t, p.baie, 185) + 19 * Math.sin(t / 111) + 9 * Math.sin(t / 47);
  }
  function relief(p, x, z, distanceRoute, base) {
    if (distanceRoute <= 72) return base;
    const [u, t] = local(p, x, z), rive = rivage(p, t), garde = lisse(72, 175, distanceRoute);
    // Le promontoire et la petite crête sont des hauteurs de la nappe, pas des blocs empilés.
    const promontoire = 66 * cloche(t, p.cap, 230) * cloche(u, rive - 120, 150);
    const crete = 95 * cloche(u, p.depart - 970, 350) * (.44 + .56 * cloche(t, -520, 730));
    let h = base + (promontoire + crete) * garde;
    const fond = p.niveauEau - 16 - 4 * (.5 + .5 * Math.sin(t / 180));
    h += (fond - h) * lisse(rive - 45, rive + 100, u) * garde;
    return h;
  }
  function riveRocheuse(p, x, z) {
    const [u, t] = local(p, x, z); return 1 - lisse(25, 140, Math.abs(u - rivage(p, t)));
  }
  function coinsEau(p) {
    return [[p.depart - 64, -2600], [p.depart + 2800, -2600], [p.depart + 2800, 2600], [p.depart - 64, 2600]].map(([u, v]) => monde(p, u, v));
  }
  function essence(p, x, z) {
    // Des petits bois de feuillus clairs au milieu des conifères ; aucun tirage de la course consommé.
    const poche = hache(Math.floor(x / 56), Math.floor(z / 56), p.graine);
    return hache(x, z, p.graine ^ 0x31ef92a5) < .18 + .46 * poche ? 'feuillu' : 'conifere';
  }
  function habitations(c, terrain, interroger, plan) {
    const sites = [];
    for (const portion of [.24, .53, .76]) {
      let place = null;
      for (let essai = 0; essai < 64 && !place; essai++) {
        const i = (Math.floor(c.n * portion) + Math.floor(essai / 2) * 13) % c.n;
        const a = c.cap[i], cote = essai % 2 ? -1 : 1, recul = 110 + (Math.floor(essai / 8) % 4) * 24;
        const x = c.x[i] - Math.sin(a) * recul * cote, z = c.z[i] + Math.cos(a) * recul * cote;
        const q = interroger(x, z, 220);
        if (q.i < 0 || q.d < 90 || Math.abs(B.circuit.ecart(c, 0, q.i * c.pas)) < 380) continue;
        const y = terrain.sol(x, z), hx = terrain.sol(x + 12, z) - terrain.sol(x - 12, z), hz = terrain.sol(x, z + 12) - terrain.sol(x, z - 12);
        if (y < plan.niveauEau + 8 || Math.hypot(hx, hz) > 3.8) continue;
        place = { x, z, a, s: i * c.pas };
      }
      if (!place) continue;
      for (let j = 0; j < 2; j++) {
        const x = place.x + Math.cos(place.a) * j * 25, z = place.z + Math.sin(place.a) * j * 25;
        const q = interroger(x, z, 220), a = place.a + (j ? .12 : -.08), l = 9 + j, w = 6.2, coins = [];
        for (const dx of [-l / 2, l / 2]) for (const dz of [-w / 2, w / 2]) {
          const px = x + Math.cos(a) * dx - Math.sin(a) * dz, pz = z + Math.sin(a) * dx + Math.cos(a) * dz;
          coins.push(terrain.sol(px, pz));
        }
        const bas = Math.min(...coins), haut = Math.max(...coins);
        if (q.i < 0 || q.d < 85 || bas < plan.niveauEau + 6 || haut - bas >= 2.5) continue;
        const sol = (coins[0] + coins[1] + coins[2] + coins[3]) / 4;
        sites.push(Object.freeze({ x, z, a, l, w, bas: bas - .55, sol, s: place.s, variante: sites.length % 3 }));
      }
    }
    return Object.freeze(sites);
  }
  function objetsMaison(site, neige) {
    const { x, z, a, l, w, sol, bas, variante } = site, objets = [];
    const bois = [[.36, .24, .15], [.46, .31, .18], [.32, .30, .23]][variante];
    const cadre = [[.56, .73, .78], [.72, .76, .65], [.64, .30, .18]][variante];
    const toit = neige ? [.86, .90, .93] : [[.24, .32, .31], [.42, .20, .14], [.25, .30, .35]][variante];
    const point = (dx, y, dz) => [x + Math.cos(a) * dx - Math.sin(a) * dz, y, z + Math.sin(a) * dx + Math.cos(a) * dz];
    function boite(p, s, color, mat = 10, collision, inclinaison = 0) {
      const o = { shape: 'box', p, s, r: [inclinaison, -a, 0], color, mat, lieu: 'hameau-baikal' };
      if (collision) o.collision = collision;
      objets.push(o); return o;
    }
    boite(point(0, (sol + bas) / 2, 0), [l + .25, sol - bas, w + .25], [.39, .40, .39], 9, 'batiment');
    boite(point(0, sol + 1.6, 0), [l, 3.2, w], bois, 10, 'batiment');
    // Deux pans réels : le faîtage ne flotte pas sur un cube, et la silhouette est gardée au loin.
    const pente = .53, demi = (w / 2 + .55) / 2, longueurPan = (w / 2 + .55) / Math.cos(pente);
    for (const cote of [-1, 1]) boite(point(0, sol + 3.22 + demi * Math.tan(pente), cote * demi),
      [l + 1.1, .24, longueurPan], toit, 0, 'toit', cote * pente);
    // Le faîtage est au-dessus de 5 m : le conduit traverse la couverture et dépasse réellement le toit.
    boite(point(-l * .22, sol + 4.8, 0), [.65, 3.2, .7], [.33, .28, .24], 3, 'batiment');
    for (const cote of [-1, 1]) for (const dx of [-l * .29, l * .27]) {
      boite(point(dx, sol + 1.9, cote * (w / 2 + .035)), [1.55, 1.45, .14], cadre, 0);
      boite(point(dx, sol + 1.9, cote * (w / 2 + .12)), [1.13, 1.03, .045], [.11, .18, .20], 7);
      boite(point(dx, sol + 1.9, cote * (w / 2 + .16)), [.075, 1.06, .06], cadre, 0);
    }
    boite(point(l / 2 + .04, sol + 1.14, 0), [.15, 2.28, 1.25], [.22, .17, .12], 10);
    return objets;
  }
  B.baikal = { planifier, local, monde, rivage, relief, riveRocheuse, coinsEau, essence, habitations, objetsMaison };
})(globalThis.BITUME = globalThis.BITUME || {});
