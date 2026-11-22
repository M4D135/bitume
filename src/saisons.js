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
  for (const id of IDS) for (const theme of ['foret', 'cote', 'montagne', 'islande', 'desert', 'asie', 'pacifique', 'baikal']) {
    const d = DONNEES[id], neige = id === 'hiver' && theme !== 'cote';
    profils[id + ':' + theme] = Object.freeze({ id, theme, neige, feuilles: id === 'automne' && (theme === 'foret' || theme === 'montagne' || theme === 'asie' || theme === 'baikal'),
      faune: neige || theme === 'islande' || theme === 'desert' ? 0 : d.faune, soleil: d.soleil, teinteSoleil: Object.freeze(d.teinteSoleil.slice()) });
  }
  function profil(id, theme = 'foret') {
    if (theme === 'corail') theme = 'cote';
    return profils[normaliser(id) + ':' + (theme === 'cote' || theme === 'montagne' || theme === 'islande' || theme === 'desert' || theme === 'asie' || theme === 'pacifique' || theme === 'baikal' ? theme : 'foret')];
  }
  // L'axe est échantillonné à pas constant. Une table légère par circuit mixte est
  // partagée entre construction du terrain, placement des habitats et caméras.
  const CACHE_SECTEURS = new WeakMap();
  function secteurs(c) {
    if (!c?.tronconsThemes?.length || !(c.longueur > 0) || !(c.pas > 0) || !c.n) return null;
    if (CACHE_SECTEURS.has(c)) return CACHE_SECTEURS.get(c);
    const L = c.longueur;
    const parties = c.tronconsThemes.filter(t => t.theme && Number.isFinite(t.debut) && Number.isFinite(t.fin));
    const repere = valeur => valeur >= 0 && valeur <= L ? valeur : (valeur % L + L) % L;
    const bornes = [...new Set([0, L, ...parties.flatMap(t => [repere(t.debut), repere(t.fin)])])].sort((a,b) => a-b);
    const plages = [];
    for (let i = 1; i < bornes.length; i++) {
      const debut = bornes[i-1], fin = bornes[i], milieu = (debut + fin) / 2;
      const partie = parties.find(t => {
        const a = repere(t.debut), b = repere(t.fin);
        return a <= b ? milieu >= a && milieu < b : milieu >= a || milieu < b;
      });
      const theme = partie?.theme || c.theme, precedente = plages[plages.length-1];
      if (precedente?.theme === theme) { precedente.fin = fin; continue; }
      plages.push({ debut, fin, theme, profils: Object.fromEntries(IDS.map(id => [id, profil(id, theme)])) });
    }
    const indices = new Uint8Array(c.n);
    let p = 0;
    for (let i = 0; i < c.n; i++) {
      while (p+1 < plages.length && i*c.pas >= plages[p].fin) p++;
      indices[i] = p;
    }
    const decoupage = { plages, indices, a(s) {
      // Nombre d'intervalles limité à trois sur les circuits mixtes. Le domaine
      // au mètre près sert aux changements d'ambiance et aux fondus à la frontière.
      if (s < 0 || s >= L) s = (s % L + L) % L;
      let p = indices[Math.min(c.n-1, Math.floor(s/c.pas))] || 0;
      while (p+1 < plages.length && s >= plages[p].fin) p++;
      return plages[p];
    } };
    CACHE_SECTEURS.set(c, decoupage);
    return decoupage;
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
    const feuillage = famille === 'feuillage' || famille === 'feuillage-caduque' || famille === 'feuillage-persistant', fleurs = famille === 'fleurs';
    const caduc = famille === 'feuillage-caduque' || famille === 'feuillage' && (p.theme === 'foret' || p.theme === 'asie');
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
      if (caduc && (p.theme === 'foret' || p.theme === 'asie')) {
        const floraison = lisse(.38, .72, n + (habitat ? habitat.fleurs : 0) * .24);
        cible = nuance < .5 ? BLANC : ROSE; part = floraison * .94;
      } else if (feuillage) {
        // Jeunes feuilles boréales/alpines et pousses des persistants ; pas de floraison rose des pins.
        cible = [base[0] * .88, Math.min(1, base[1] * 1.22 + .025), base[2] * .94];
        part = caduc ? .64 : .30;
      } else {
        cible = fleurs ? ROSE : [base[0] * .88, Math.min(1, base[1] * 1.16), base[2] * .91];
        part = fleurs ? .14 : .40;
      }
    } else if (p.id === 'ete') {
      cible = SEC;
      part = feuillage ? (caduc ? .18 + .18 * n : .06 + .07 * n)
        : fleurs ? .12 : .22 + .19 * n + (habitat ? (1 - habitat.herbe) * .10 : 0);
    } else if (p.id === 'automne') {
      if (caduc) {
        cible = p.theme === 'baikal' ? OR : n < .34 ? CUIVRE : n < .67 ? ORANGE : OR; part = .79 + .18 * nuance;
      } else if (feuillage) {
        cible = [base[0] * .96, base[1] * .92, base[2] * 1.03]; part = .55;
      } else { cible = SEC; part = fleurs ? .30 : .35 + .20 * nuance; }
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
  B.saisons = { IDS, normaliser, profil, secteurs, teinte, atmosphere };
})(globalThis.BITUME = globalThis.BITUME || {});
