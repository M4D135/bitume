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
    return { colonnes, rayonMax, basculeMax, touches, seuils, n: 0, route: [{}, {}, {}, {}, {}] };
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
    for (let k = 0; k < route.length; k++)
      B.circuit.echantillon(c, et.s + sens * avance * k / 4, route[k]);
    // Une sphère qui touche le centre du champ ou le couloir du prochain virage garde son détail.
    const centre = .50 * horizontal, bord = .90 * horizontal, normale = Math.sqrt(1 + centre * centre), normaleChamp = Math.sqrt(1 + horizontal * horizontal);
    const i0 = Math.floor((oeil[0] - portee) / CASE), iFin = Math.floor((oeil[0] + portee) / CASE);
    const j0 = Math.floor((oeil[2] - portee) / CASE), jFin = Math.floor((oeil[2] + portee) / CASE);
    for (let i = i0; i <= iFin; i++) {
      const col = d.colonnes.get(i);
      if (!col) continue;
      for (let j = j0; j <= jFin; j++) {
        const lots = col.get(j);
        if (!lots) continue;
        for (const lot of lots) {
          const p = lot.centre, r = lot.rayon, dx = p[0] - oeil[0], dy = p[1] - oeil[1], dz = p[2] - oeil[2];
          const distance2 = dx * dx + dy * dy + dz * dz, limite = lot.bascule * facteur + r;
          if (distance2 >= limite * limite || distance2 <= (35 + r) ** 2) continue;
          const devant = dx * ax + dy * ay + dz * az, lateral = Math.abs(dx * rx + dy * ry + dz * rz);
          if (devant + r <= 0 || lateral <= devant * centre + r * normale ||
              lateral > devant * horizontal + r * normaleChamp) continue;
          const margeRoute = r + 12;
          let surRoute = false;
          for (let k = 1; k < route.length && !surRoute; k++)
            surRoute = surTrajectoire(p[0], p[2], route[k - 1], route[k], margeRoute);
          if (surRoute) continue;
          const peripherie = Math.min(1, (lateral - devant * centre - r * normale) / Math.max(1, devant * (bord - centre)));
          const seuil = lot.bascule * (1 - .34 * peripherie);
          if (distance2 < (seuil * facteur + r) ** 2) continue;
          d.touches[d.n] = lot; d.seuils[d.n++] = lot.bascule; lot.bascule = seuil;
        }
      }
    }
  }
  function restaurer(d) {
    while (d.n) { const i = --d.n; d.touches[i].bascule = d.seuils[i]; }
  }
  B.detailPeripherique = { creer, appliquer, restaurer };
})(globalThis.BITUME = globalThis.BITUME || {});
