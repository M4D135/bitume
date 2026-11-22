// Les deux modèles d'une case d'arbres ont la même implantation et la même silhouette.
// Dans les coins de la vue, les petites branches peuvent passer au modèle lointain plus tôt.
(function (B) {
  'use strict';
  const CASE = 128, TAN_60 = Math.tan(Math.PI / 6);
  function creer(lots) {
    const colonnes = new Map(), touches = [], seuils = [];
    let rayonMax = 0, basculeMax = 0;
    for (const lot of lots) {
      if (lot.arbres !== true || !(lot.loin?.length || lot.detailLointain) || !(lot.bascule > 0) ||
          lot.lodReferenceFov !== 60 || lot.lodReferenceHeight !== 1080) continue;
      const i = Math.floor(lot.centre[0] / CASE), j = Math.floor(lot.centre[2] / CASE);
      let colonne = colonnes.get(i);
      if (!colonne) { colonne = new Map(); colonnes.set(i, colonne); }
      let caseArbres = colonne.get(j);
      if (!caseArbres) { caseArbres = []; colonne.set(j, caseArbres); }
      caseArbres.push(lot);
      rayonMax = Math.max(rayonMax, lot.rayon); basculeMax = Math.max(basculeMax, lot.bascule);
      touches.push(null); seuils.push(0);
    }
    // Dans les cases denses, borner les centres en 3D une fois. Le rayon propre
    // de chaque lot reste distinct du rayon qui contient tous les centres.
    for (const colonne of colonnes.values()) for (const lots of colonne.values()) {
      if (lots.length < 3) continue;
      let x0=Infinity, y0=Infinity, z0=Infinity, x1=-Infinity, y1=-Infinity, z1=-Infinity, rayon=0;
      for (const lot of lots) {
        const [x,y,z] = lot.centre;
        x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y); z0=Math.min(z0,z); z1=Math.max(z1,z);
        rayon=Math.max(rayon,lot.rayon);
      }
      lots.volume = {x:(x0+x1)/2,y:(y0+y1)/2,z:(z0+z1)/2,centres:Math.hypot(x1-x0,y1-y0,z1-z0)/2+1e-6,rayon};
    }
    // Fenêtres de cases des deux vues. La voiture peut rouler de nombreuses images avant
    // qu'un bord de fenêtre franchisse 128 m ; l'angle et les seuils restent évalués à chaque vue.
    const fenetre = () => ({ i0: NaN, i1: NaN, j0: NaN, j1: NaN, cases: [] });
    return { colonnes, rayonMax, basculeMax, touches, seuils, n: 0, route: [{}, {}, {}, {}, {}],
      fenetres: [fenetre(), fenetre()], recente: 0 };
  }
  function casesProches(d, i0, i1, j0, j1) {
    for (let k=0; k<d.fenetres.length; k++) {
      const f=d.fenetres[k];
      if (f.i0===i0 && f.i1===i1 && f.j0===j0 && f.j1===j1) { d.recente=k; return f.cases; }
    }
    d.recente=1-d.recente;
    const f=d.fenetres[d.recente], cases=f.cases;
    f.i0=i0; f.i1=i1; f.j0=j0; f.j1=j1;
    let n=0;
    for (let i=i0; i<=i1; i++) {
      const colonne=d.colonnes.get(i);
      if (!colonne) continue;
      for (let j=j0; j<=j1; j++) {
        const lots=colonne.get(j);
        if (lots) cases[n++]=lots;
      }
    }
    cases.length=n; return cases;
  }
  function surTrajectoire(x, z, a, b, marge) {
    const dx = b.x - a.x, dz = b.z - a.z, longueur2 = dx * dx + dz * dz;
    const t = longueur2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / longueur2)) : 0;
    const ex = x - a.x - dx * t, ez = z - a.z - dz * t;
    return ex * ex + ez * ez <= marge * marge;
  }
  function appliquer(d, c, et, cam, largeur, hauteur) {
    if (!d.basculeMax || !(hauteur > 0 && largeur > 0)) return;
    const tan = Math.tan((cam.fov || 75) * Math.PI / 360), horizontal = tan * largeur / hauteur;
    const facteur = TAN_60 / tan * hauteur / 1080;
    const portee = d.basculeMax * facteur + d.rayonMax;
    // Au téléobjectif ou sur une très grande toile, la bascule normale suffit.
    // La requête parcourt au plus 17 × 17 cases, indépendamment de la longueur du circuit.
    if (portee > 8 * CASE) return;
    const oeil = cam.pos, sy = Math.sin(cam.yaw || 0), cy = Math.cos(cam.yaw || 0);
    const sp = Math.sin(cam.pitch || 0), cp = Math.cos(cam.pitch || 0), sr = Math.sin(cam.roll || 0), cr = Math.cos(cam.roll || 0);
    const ax = sy * cp, ay = sp, az = -cy * cp;
    const rx = cy * cr - sy * sp * sr, ry = cp * sr, rz = sy * cr + cy * sp * sr;
    // À la décélération, garder plus longtemps le point de corde et la sortie du virage.
    const avance = Math.max(35, Math.min(180, Math.abs(et.v) * (1.65 + .55 * (et.frein || 0))));
    const sens = et.v < 0 ? -1 : 1;
    const route = d.route;
    let routePrete = false;
    // Une sphère qui touche le centre du champ ou le couloir du prochain virage garde son détail.
    const centre = .50 * horizontal, bord = .90 * horizontal, normale = Math.sqrt(1 + centre * centre), normaleChamp = Math.sqrt(1 + horizontal * horizontal);
    const i0 = Math.floor((oeil[0] - portee) / CASE), iFin = Math.floor((oeil[0] + portee) / CASE);
    const j0 = Math.floor((oeil[2] - portee) / CASE), jFin = Math.floor((oeil[2] + portee) / CASE);
    for (const lots of casesProches(d, i0, iFin, j0, jFin)) {
      const b = lots.volume;
      if (b) {
        const x=b.x-oeil[0], y=b.y-oeil[1], z=b.z-oeil[2];
        const devant=x*ax+y*ay+z*az, cote=Math.abs(x*rx+y*ry+z*rz), total=b.centres+b.rayon;
        // Tout le volume est derrière, au-delà d'un bord ou entièrement dans le cône
        // central protégé. Les cas tangents restent soumis au calcul de chaque lot.
        if (devant+total < 0 || cote-devant*horizontal > total*normaleChamp ||
            cote-devant*centre < -b.centres*normale) continue;
      }
      for (const lot of lots) {
        const p = lot.centre, r = lot.rayon, dx = p[0] - oeil[0], dy = p[1] - oeil[1], dz = p[2] - oeil[2];
        const distance2 = dx * dx + dy * dy + dz * dz, limite = lot.bascule * facteur + r;
        if (distance2 >= limite * limite || distance2 <= (35 + r) ** 2 ||
            distance2 < (lot.bascule * (1 - .34) * facteur + r) ** 2) continue;
        const devant = dx * ax + dy * ay + dz * az, lateral = Math.abs(dx * rx + dy * ry + dz * rz);
        if (devant + r <= 0 || lateral <= devant * centre + r * normale ||
            lateral > devant * horizontal + r * normaleChamp) continue;
        const peripherie = Math.min(1, (lateral - devant * centre - r * normale) / Math.max(1, devant * (bord - centre)));
        const seuil = lot.bascule * (1 - .34 * peripherie);
        if (distance2 < (seuil * facteur + r) ** 2) continue;
        // Seuls les arbres qui changeraient vraiment de LOD ont besoin du tracé.
        if (!routePrete) {
          for (let k = 0; k < route.length; k++) B.circuit.echantillon(c, et.s + sens * avance * k / 4, route[k]);
          routePrete = true;
        }
        const margeRoute = r + 12;
        let surRoute = false;
        for (let k = 1; k < route.length && !surRoute; k++)
          surRoute = surTrajectoire(p[0], p[2], route[k - 1], route[k], margeRoute);
        if (surRoute) continue;
        d.touches[d.n] = lot; d.seuils[d.n++] = lot.bascule; lot.bascule = seuil;
      }
    }
  }
  function restaurer(d) {
    while (d.n) { const i = --d.n; d.touches[i].bascule = d.seuils[i]; }
  }
  B.detailPeripherique = { creer, appliquer, restaurer };
})(globalThis.BITUME = globalThis.BITUME || {});
