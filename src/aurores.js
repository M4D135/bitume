/* BITUME — rideaux polaires procéduraux, placés dans le ciel du circuit islandais. */
(function (B) {
  'use strict';
  const TAU = Math.PI * 2, SEGMENTS = 24, BANDES = 6;
  const BUDGETS = Object.freeze({ off: 0, low: 1, medium: 2, high: 3, ultra: 3 });
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const unite = x => Number.isFinite(+x) ? clamp(+x, 0, 1) : 0;
  const lisse = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const CENTRES = [.14, .26, .41, .57, .73, .86], DEMI_HAUTEURS = [.08, .12, .14, .15, .15, .09];
  const COULEURS = [[.08, .60, .24], [.12, .95, .45], [.08, .74, .50], [.12, .58, .66], [.35, .28, .65], [.55, .22, .60]];
  const OPACITES = [.20, .30, .25, .18, .10, .055];
  const hache = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

  // Six couches du même rideau : les normales s'inclinent vers le ciel aux bords.
  // Le fondu angulaire du matériau FX adoucit ainsi chaque bande et ses extrémités,
  // sans texture, shader supplémentaire, transparence du terrain ni surimpression.
  // Les deux faces sont nécessaires lorsque les pilotes roulent de part et d'autre.
  function enregistrerFormes() {
    if (!globalThis.FRender || !globalThis.FRender.forme) return;
    for (let bande = 0; bande < BANDES; bande++) {
      const points = [], normales = [], triangles = [];
      for (let i = 0; i <= SEGMENTS; i++) {
        const u = i / SEGMENTS, x = u - .5;
        const z = .29 * Math.sin(TAU * u + .2) + .12 * Math.sin(TAU * 2.8 * u - .6);
        const pente = .29 * TAU * Math.cos(TAU * u + .2) + .12 * TAU * 2.8 * Math.cos(TAU * 2.8 * u - .6);
        const vague = .025 * Math.sin(TAU * 2.5 * u) + .018 * Math.sin(TAU * 1.3 * u + .6);
        const lateral = lisse(0, .13, u) * (1 - lisse(.87, 1, u)), invLen = 1 / Math.hypot(pente, 1);
        for (let j = 0; j < 3; j++) {
          points.push([x, CENTRES[bande] + (j - 1) * DEMI_HAUTEURS[bande] + vague - .5, z]);
          const face = j === 1 ? lateral : 0, haut = 1 - face, n = Math.hypot(face, haut) || 1;
          normales.push([pente * invLen * face / n, haut / n, -face * invLen / n]);
        }
      }
      function triangle(a, b, c) {
        const na = normales[a], nb = normales[b], nc = normales[c];
        triangles.push([points[a], points[b], points[c], na, nb, nc]);
        triangles.push([points[a], points[c], points[b], [-na[0], na[1], -na[2]], [-nc[0], nc[1], -nc[2]], [-nb[0], nb[1], -nb[2]]]);
      }
      for (let i = 0; i < SEGMENTS; i++) for (let j = 0; j < 2; j++) {
        const a = i * 3 + j, b = a + 3;
        triangle(a, a + 1, b); triangle(b, a + 1, b + 1);
      }
      globalThis.FRender.forme('bitume-aurore-' + bande, triangles);
    }
  }
  enregistrerFormes(); // impérativement avant le premier FRender.create du jeu

  function vue() {
    const objets = [];
    for (let i = 0; i < 3; i++) for (let bande = 0; bande < BANDES; bande++) objets.push({
      shape: 'bitume-aurore-' + bande, p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0],
      color: COULEURS[bande].slice(), alpha: 0, emissive: 5, mat: 7, fx: true,
      overlay: false, outdoor: true, surface: 'object', windResponsive: false, aurore: true
    });
    return { objets, stats: { rubans: 0, objets: 0, triangles: 0, intensite: 0 } };
  }
  const PREPARATION = 'aurores';
  // Partie statique d'une scène : les trois rubans ne dépendent que du circuit (emprise, altitude, graine).
  // L'appelant peut la garder sur la scène ; creer() refuse celle d'un autre circuit et la refait alors.
  function concerne(c) {
    return c?.theme === 'islande' || !!c?.tronconsThemes?.some(t => t.theme === 'islande');
  }
  function preparer(circuit) {
    const c = circuit || {}, actif = concerne(c), secteurs = B.saisons?.secteurs?.(c);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, haut = 0;
    for (let i = 0; i < (c.x ? c.x.length : 0); i++) {
      if (secteurs && secteurs.plages[secteurs.indices[i]].theme !== 'islande') continue;
      x0 = Math.min(x0, c.x[i]); x1 = Math.max(x1, c.x[i]);
      z0 = Math.min(z0, c.z[i]); z1 = Math.max(z1, c.z[i]);
      if (c.y && Number.isFinite(c.y[i])) haut = Math.max(haut, c.y[i]);
    }
    const cx = Number.isFinite(x0 + x1) ? (x0 + x1) * .5 : 0, cz = Number.isFinite(z0 + z1) ? (z0 + z1) * .5 : 0;
    const largeur = Number.isFinite(x1 - x0 + z1 - z0) ? Math.max(x1 - x0, z1 - z0) * .5 : 600;
    const rayon = 1500 + Math.min(800, largeur) * .45, graine = (c.graine || 0) >>> 0, rubans = [];
    for (let i = 0; i < 3; i++) {
      const phase = hache(graine ^ Math.imul(i + 1, 7919)) * TAU, a = i * TAU / 3 + .15 + phase * .09;
      const d = rayon + i * 170;
      rubans.push(Object.freeze({ x: cx + Math.sin(a) * d, y: haut + 780 + i * 90, z: cz - Math.cos(a) * d,
        cap: -a, largeur: 3380 - i * 150, hauteur: 390 - i * 28, profondeur: 620 + i * 55, phase }));
    }
    return Object.freeze({ type: PREPARATION, circuit, actif, rubans: Object.freeze(rubans) });
  }
  // creer(circuit) seul calcule aussi les rubans ; avec la préparation du même circuit, seuls les objets des deux vues sont créés.
  function creer(circuit, preparation) {
    const p = preparation && preparation.type === PREPARATION && preparation.circuit === circuit ? preparation : preparer(circuit);
    return { actif: p.actif, rubans: p.rubans, preparation: p, vues: p.actif ? [vue(), vue()] : [],
      stats: { rubans: 0, objets: 0, triangles: 0, intensite: 0 } };
  }
  function dessiner(etat, temps, contexte, sortie) {
    const c = contexte || {}, v = etat.actif ? etat.vues[c.vue === 1 ? 1 : 0] : null;
    const stats = v ? v.stats : etat.stats;
    stats.rubans = stats.objets = stats.triangles = stats.intensite = 0;
    if (!v || c.tunnel) return stats;
    const budget = BUDGETS[c.qualite] === undefined ? BUDGETS.medium : BUDGETS[c.qualite];
    const nuit = lisse(.48, .93, unite(c.nuit)), precipitation = Math.max(unite(c.pluie), unite(c.neige));
    const nuages = unite(c.nuages === undefined ? c.nuage : c.nuages);
    const intensite = (c.presence ?? 1) * nuit * (1 - .88 * precipitation) * (1 - lisse(.18, .94, nuages));
    if (intensite < .012 || !budget) return stats;
    const t = Number.isFinite(temps) ? temps : 0;
    for (let i = 0; i < budget; i++) {
      const ruban = etat.rubans[i], phase = ruban.phase;
      const balancement = Math.sin(t * .023 + phase), hauteur = 1 + .045 * Math.sin(t * .037 + phase);
      const pulse = .88 + .12 * Math.sin(t * .081 + phase), poids = intensite * pulse * (1 - i * .1);
      for (let bande = 0; bande < BANDES; bande++) {
        const o = v.objets[i * BANDES + bande];
        o.p[0] = ruban.x + 42 * balancement; o.p[1] = ruban.y + 18 * Math.sin(t * .029 + phase); o.p[2] = ruban.z;
        o.s[0] = ruban.largeur; o.s[1] = ruban.hauteur * hauteur; o.s[2] = ruban.profondeur;
        o.r[1] = ruban.cap + .022 * balancement; o.alpha = OPACITES[bande] * poids;
        // La brume de FERRO conserve au moins 14 % de la couleur : cette émission
        // rend le rideau lointain lisible sans lumière ponctuelle ni modification moteur.
        sortie.push(o);
      }
    }
    stats.rubans = budget; stats.objets = budget * BANDES; stats.triangles = stats.objets * SEGMENTS * 8; stats.intensite = intensite;
    return stats;
  }
  B.aurores = { concerne, preparer, creer, dessiner, BUDGETS, MAX_OBJETS: 18, TRIANGLES_PAR_RUBAN: BANDES * SEGMENTS * 8 };
})(globalThis.BITUME = globalThis.BITUME || {});
