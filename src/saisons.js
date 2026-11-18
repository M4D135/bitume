/* BITUME — saisons purement visuelles, choisies à la préparation de la course. */
(function (B) {
  'use strict';
  const IDS = Object.freeze(['printemps', 'ete', 'automne', 'hiver']);
  const DONNEES = Object.freeze({
    printemps: { soleil: 1.04, teinteSoleil: [1, 1.01, 1.02], faune: 1 },
    ete: { soleil: 1.18, teinteSoleil: [1.04, 1.01, .94], faune: .85 },
    automne: { soleil: .93, teinteSoleil: [1.05, .97, .87], faune: .48 },
    hiver: { soleil: .87, teinteSoleil: [.94, 1, 1.07], faune: .28 },
  });
  const normaliser = id => IDS.includes(id) ? id : 'ete';
  const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const profils = {};
  for (const id of IDS) for (const theme of ['foret', 'cote', 'montagne', 'islande', 'desert', 'asie', 'pacifique']) {
    const d = DONNEES[id], neige = id === 'hiver' && theme !== 'cote';
    profils[id + ':' + theme] = Object.freeze({ id, theme, neige, feuilles: id === 'automne' && (theme === 'foret' || theme === 'asie'),
      faune: neige || theme === 'islande' || theme === 'desert' ? 0 : d.faune, soleil: d.soleil, teinteSoleil: Object.freeze(d.teinteSoleil.slice()) });
  }
  function profil(id, theme = 'foret') {
    return profils[normaliser(id) + ':' + (theme === 'cote' || theme === 'montagne' || theme === 'islande' || theme === 'desert' || theme === 'asie' || theme === 'pacifique' ? theme : 'foret')];
  }
  function bruit(x, z, sel) {
    const px = (x * .8 - z * .6) / 73, pz = (x * .6 + z * .8) / 73;
    const ix = Math.floor(px), iz = Math.floor(pz), fx = px - ix, fz = pz - iz;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const hache = (a, b) => {
      let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ sel;
      h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const a = hache(ix, iz), b = hache(ix + 1, iz), c = hache(ix, iz + 1), d = hache(ix + 1, iz + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const BLANC = [.96, .94, .88], ROSE = [.96, .64, .76];
  const ORANGE = [.76, .30, .065], CUIVRE = [.48, .16, .055], OR = [.79, .53, .09];
  const SEC = [.43, .36, .16], FROID = [.25, .32, .28], NEIGE = [.91, .94, .97];
  function teinte(p, famille, base, x, z, habitat, sortie) {
    const resultat = sortie || new Array(3), n = bruit(x, z, 139), nuance = bruit(x + 197, z - 311, 277);
    const feuillage = famille === 'feuillage', fleurs = famille === 'fleurs';
    let cible = base, part = 0;
    if (p.neige) {
      cible = NEIGE; part = feuillage ? .55 + .32 * n : famille === 'sol' ? .93 + .04 * n : .78 + .12 * n;
    } else if (p.theme === 'islande') {
      // Les coulées restent sombres : seules les mousses changent de ton, sans forêt ni prairie sèche.
      const mousse = Math.max(0, Math.min(1, (base[1] - base[0]) * 8));
      cible = p.id === 'printemps' ? [.25, .36, .14] : p.id === 'automne' ? [.33, .29, .13] : [.31, .36, .17];
      part = mousse * (p.id === 'automne' ? .35 : .16);
    } else if (p.theme === 'desert') {
      // Hauts plateaux minéraux : les saisons modulent l'ocre sans inventer de prairie.
      cible = p.id === 'printemps' ? [.67, .45, .25] : p.id === 'automne' ? [.59, .32, .14] : [.82, .59, .31];
      part = (p.id === 'ete' ? .10 : .06) + .04 * n;
    } else if (p.id === 'printemps') {
      if (feuillage && (p.theme === 'foret' || p.theme === 'asie')) {
        const floraison = lisse(.38, .72, n + (habitat ? habitat.fleurs : 0) * .24);
        cible = nuance < .5 ? BLANC : ROSE; part = floraison * .94;
      } else if (!feuillage) {
        cible = fleurs ? ROSE : [base[0] * .88, Math.min(1, base[1] * 1.16), base[2] * .91];
        part = fleurs ? .14 : .40;
      }
    } else if (p.id === 'ete') {
      cible = SEC;
      part = feuillage ? (p.theme === 'foret' || p.theme === 'asie' ? .18 : .09) + .18 * n
        : fleurs ? .12 : .22 + .19 * n + (habitat ? (1 - habitat.herbe) * .10 : 0);
    } else if (p.id === 'automne') {
      if (feuillage && (p.theme === 'foret' || p.theme === 'asie')) {
        cible = n < .34 ? CUIVRE : n < .67 ? ORANGE : OR; part = .79 + .18 * nuance;
      } else if (!feuillage) { cible = SEC; part = fleurs ? .30 : .35 + .20 * nuance; }
    } else {
      // Le Sud reste sans neige, y compris sur les pins, les plantes et leurs sources d'effets.
      cible = FROID; part = feuillage ? .13 : .20;
    }
    for (let k = 0; k < 3; k++) resultat[k] = Math.max(0, Math.min(1, base[k] + (cible[k] - base[k]) * part));
    return resultat;
  }
  function atmosphere(p, base) {
    const resultat = { ...base };
    if (base.sunColor) resultat.sunColor = base.sunColor.map((v, k) => v * p.soleil * p.teinteSoleil[k]);
    if (p.neige) {
      if (base.ambient) resultat.ambient = base.ambient.map((v, k) => v * [1.08, 1.12, 1.18][k]);
      if (base.fog) resultat.fog = base.fog.map((v, k) => v * .65 + [.77, .83, .89][k] * .35);
    }
    return resultat;
  }
  B.saisons = { IDS, normaliser, profil, teinte, atmosphere };
})(globalThis.BITUME = globalThis.BITUME || {});
