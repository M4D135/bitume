/* BITUME — état de chaussée et éclairage du ruban de piste. */
(function (B) {
  'use strict';
  const VIDE = Object.freeze({});
  const borner = x => Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
  const objet = x => x && typeof x === 'object' ? x : VIDE;

  // Initialisation de séance seulement : la couverture reste explicite, indépendante des flocons.
  // .75 décrit la route du paysage hivernal du jeu, pas une profondeur mesurée de neige.
  // Une couverture fournie par la préparation/l'hôte est conservée, y compris zéro.
  function preparer(m, profilSaison) {
    m = m && typeof m === 'object' ? m : {};
    const p = objet(profilSaison), sud = p.theme === 'cote';
    m.precipitationsNeige = !sud && (m.reel === true ? m.neige === true : p.neige === true);
    m.neigeSol = sud ? 0 : Number.isFinite(m.neigeSol) ? borner(m.neigeSol) : p.neige === true ? .75 : 0;
    return m;
  }

  // Lecture sans mutation ni évolution temporelle ; passer une sortie propre à l'appelant évite
  // toute allocation au pas de simulation. Les limites de tunnel restent celles du circuit.
  function exposee(meteo, sortie) {
    const m = objet(meteo === undefined ? B.meteo && B.meteo.actuel : meteo);
    const out = sortie && typeof sortie === 'object' ? sortie : {};
    const flocons = typeof m.precipitationsNeige === 'boolean' ? m.precipitationsNeige : m.reel === true && m.neige === true;
    // .6 conserve la pondération historique de l'eau résiduelle. Une chute de neige n'est
    // pas une pluie liquide ; de l'eau déjà présente peut néanmoins coexister avec la neige.
    out.eau = Math.max(flocons ? 0 : borner(m.pluie), .6 * borner(m.mouille));
    out.neige = borner(m.neigeSol);
    out.abri = false;
    return out;
  }

  function lire(c, s, meteo, sortie) {
    const out = exposee(meteo, sortie);
    if (c && Number.isFinite(s) && B.circuit?.dansCouvert?.(c, s)) {
      out.abri = true; out.eau = 0; out.neige = 0;
    }
    return out;
  }

  // Différence centrée le long des deux rangées voisines du maillage construit.
  // Une extrémité de spéciale n'a qu'une voisine. Une limite de lot n'interrompt pas le tracé.
  function creerNormalesRuban(c, largeurBord, marcheBord) {
    const demi = c.largeur / 2;
    let f, dx, dy, dz, drx, drz, variationDevers, variationGauche, variationDroite;
    function preparerRangee(cadre) {
      f = cadre;
      const i = f.i, a = i > 0 ? i - 1 : c.ouvert ? 0 : c.n - 1;
      const b = i + 1 < c.n ? i + 1 : c.ouvert ? i : 0;
      dx = c.x[b] - c.x[a]; dy = c.y[b] - c.y[a]; dz = c.z[b] - c.z[a];
      drx = Math.sin(c.cap[a]) - Math.sin(c.cap[b]);
      drz = Math.cos(c.cap[b]) - Math.cos(c.cap[a]);
      variationDevers = Math.sin(c.devers[b]) - Math.sin(c.devers[a]);
      variationGauche = ((c.vibreur[b] & 1) - (c.vibreur[a] & 1)) * marcheBord;
      variationDroite = (((c.vibreur[b] >> 1) & 1) - ((c.vibreur[a] >> 1) & 1)) * marcheBord;
    }
    function normale(d, penteTransverse, bord, sortie) {
      // Tangente entre les deux échantillons au même décalage d. En virage, un
      // mètre d'axe n'est pas un mètre au bord intérieur. Le dévers peut aussi varier.
      const x = dx + d * drx, z = dz + d * drz;
      const avance = x * f.t[0] + z * f.t[2], travers = x * f.r[0] + z * f.r[2];
      let hauteur = dy - Math.max(-demi, Math.min(demi, d)) * variationDevers;
      if (bord) {
        const part = Math.max(0, Math.min(1, (Math.abs(d) - demi) / largeurBord));
        hauteur += part * (d < 0 ? variationGauche : variationDroite);
      }
      const pente = avance > 1e-5 ? (hauteur - penteTransverse * travers) / avance : (c.pente?.[f.i] || 0);
      const ny = 1 / Math.sqrt(1 + pente * pente + penteTransverse * penteTransverse);
      sortie[0] = -(pente * f.t[0] + penteTransverse * f.r[0]) * ny;
      sortie[1] = ny;
      sortie[2] = -(pente * f.t[2] + penteTransverse * f.r[2]) * ny;
    }
    return { preparerRangee, normale };
  }

  B.chaussee = { preparer, lire, exposee, creerNormalesRuban };
})(globalThis.BITUME = globalThis.BITUME || {});
