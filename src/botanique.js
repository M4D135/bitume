/* BITUME — arbres procéduraux de Val-Brûlé : feuillu à houppier ramifié, pin sinueux à plateaux, conifère conique à verticilles.
   Géométrie originale générée une fois puis instanciée ; aucune image, aucun son, aucun réseau, aucune dépendance.
   Le vent n'est pas traité ici : le moteur déforme déjà les sommets de matière 27 (botanicalFoliage), pied immobile. */
(function (B) {
  'use strict';

  const PI2 = Math.PI * 2;
  const ESSENCES = Object.freeze(['feuillu', 'pin', 'conifere']);
  const QUALITES = Object.freeze(['low', 'medium', 'high']);
  const MATIERES = Object.freeze({ ecorce: 26, feuillage: 27 });

  // Un palier ajoute des segments le long des courbes et des organes, jamais l'inverse. Le palier lointain ne
  // retire aucun organe : il échantillonne moins les courbes, comme normaliserPaire le fait dans vegetation.js.
  const BUDGETS = Object.freeze({
    low: Object.freeze({
      segments: Object.freeze({ proche: 3, loin: 2 }),
      feuillu: Object.freeze({ branches: 4, charpentières: 1, amas: 6 }),
      pin: Object.freeze({ étages: 3, branches: 3, amas: 10 }),
      conifere: Object.freeze({ verticilles: 4, branches: 4, amas: 5 }),
    }),
    medium: Object.freeze({
      segments: Object.freeze({ proche: 5, loin: 3 }),
      feuillu: Object.freeze({ branches: 5, charpentières: 2, amas: 9 }),
      pin: Object.freeze({ étages: 4, branches: 4, amas: 17 }),
      conifere: Object.freeze({ verticilles: 6, branches: 5, amas: 9 }),
    }),
    high: Object.freeze({
      segments: Object.freeze({ proche: 7, loin: 4 }),
      feuillu: Object.freeze({ branches: 6, charpentières: 3, amas: 12 }),
      pin: Object.freeze({ étages: 5, branches: 5, amas: 26 }),
      conifere: Object.freeze({ verticilles: 8, branches: 6, amas: 14 }),
    }),
  });

  function hasard(graine) {
    let n = graine >>> 0;
    return () => {
      n = (n + 0x6D2B79F5) >>> 0;
      let x = Math.imul(n ^ (n >>> 15), n | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  const unite = p => { const l = Math.hypot(...p) || 1; return p.map(v => v / l); };
  const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const moins = (a, b) => a.map((v, i) => v - b[i]);
  function triangle(sortie, a, b, c, deuxFaces = false) {
    const n = croix(moins(b, a), moins(c, a)), aire = Math.hypot(...n);
    if (aire < 1e-10) return;
    const no = n.map(v => v / aire);
    sortie.push([a, b, c, no, no, no]);
    if (deuxFaces) { const inverse = no.map(v => -v); sortie.push([a, c, b, inverse, inverse, inverse]); }
  }
  const direction = (azim, inclinaison) => [
    Math.cos(inclinaison) * Math.cos(azim), Math.sin(inclinaison), Math.cos(inclinaison) * Math.sin(azim)];

  // Prisme le long d'une courbe P(t). La tangente est prise par différence finie à pas fixe : les anneaux de
  // pied et de tête sont donc calculés par les mêmes formules en proche et en loin, quel que soit le segmentage.
  function tronc(sortie, P, N, rBas, rHaut, F) {
    const tangente = t => unite(moins(P(Math.min(1, t + 1e-3)), P(Math.max(0, t - 1e-3))));
    const disque = t => {
      const c = P(t), a = tangente(t);
      const cote = unite(croix(a, Math.abs(a[1]) < .9 ? [0, 1, 0] : [1, 0, 0]));
      const face = croix(a, cote), r = rBas + (rHaut - rBas) * t;
      const anneau = Array.from({ length: F }, (_, j) => {
        const angle = j * PI2 / F;
        return c.map((v, k) => v + r * (cote[k] * Math.cos(angle) + face[k] * Math.sin(angle)));
      });
      return { c, a, anneau };
    };
    const disques = Array.from({ length: N + 1 }, (_, i) => disque(i / N));
    for (let i = 0; i < N; i++) {
      const A = disques[i], C = disques[i + 1];
      for (let j = 0; j < F; j++) {
        const k = (j + 1) % F;
        triangle(sortie, A.anneau[j], C.anneau[k], C.anneau[j]);
        triangle(sortie, A.anneau[j], C.anneau[k], A.anneau[k]);
      }
    }
    const pied = disques[0], tete = disques[N];
    const pointe = tete.c.map((v, k) => v + tete.a[k] * rHaut * .9);
    for (let j = 0; j < F; j++) {
      const k = (j + 1) % F;
      triangle(sortie, pied.c, pied.anneau[k], pied.anneau[j]);
      triangle(sortie, pointe, tete.anneau[j], tete.anneau[k], true);
    }
    return P(1);
  }
  function branche(sortie, depart, dir, long, chute, N, rBas, rHaut, F) {
    const P = t => [depart[0] + dir[0] * long * t, depart[1] + dir[1] * long * t - chute * t * t,
      depart[2] + dir[2] * long * t];
    return tronc(sortie, P, N, rBas, rHaut, F);
  }
  function amas(sortie, c, r, F) {
    const anneau = Array.from({ length: F }, (_, j) => {
      const angle = j * PI2 / F;
      return [c[0] + r * Math.cos(angle), c[1], c[2] + r * Math.sin(angle)];
    });
    const haut = [c[0], c[1] + r * 1.15, c[2]], bas = [c[0], c[1] - r * .3, c[2]];
    for (let j = 0; j < F; j++) {
      const k = (j + 1) % F;
      triangle(sortie, haut, anneau[j], anneau[k], true);
      triangle(sortie, bas, anneau[k], anneau[j], true);
    }
  }
  function plateau(sortie, c, r, F, giration) {
    const anneau = Array.from({ length: F }, (_, j) => {
      const angle = giration + j * PI2 / F;
      return [c[0] + r * Math.cos(angle), c[1] + (j % 2 ? .06 : -.06) * r, c[2] + r * Math.sin(angle)];
    });
    for (let j = 0; j < F; j++) {
      const k = (j + 1) % F;
      triangle(sortie, c, anneau[j], anneau[k], true);
    }
  }

  // Le plan tire tout le hasard avant toute géométrie : proche et loin partagent pieds, extrémités et dimensions,
  // seul le nombre de segments le long des courbes change. Chaque essence a son générateur à graine fixe.
  const PLANS = new Map();
  function plan(essence, qualite) {
    const cle = essence + '|' + qualite;
    if (PLANS.has(cle)) return PLANS.get(cle);
    const b = BUDGETS[qualite][essence], p = {};
    if (essence === 'feuillu') {
      const r = hasard(0xB01A);
      p.hauteur = .55 + r() * .12;
      p.pente = [(r() - .5) * .16, (r() - .5) * .16];
      p.branches = Array.from({ length: b.branches }, (_, i) => ({
        azim: i * PI2 / b.branches + (r() - .5) * .6,
        attache: .5 + r() * .42,
        inclinaison: .55 + r() * .5,
        long: .24 + r() * .12,
        chute: .04 + r() * .05,
      }));
      p.charpentières = p.branches.map(() => Array.from({ length: b.charpentières }, () => ({
        position: .55 + r() * .4,
        gisement: (r() - .5) * 2.4,
        inclinaison: .3 + r() * .6,
        long: .12 + r() * .07,
        chute: .03 + r() * .04,
      })));
      p.amas = Array.from({ length: b.amas }, () => ({
        r: .13 + r() * .07, d: [(r() - .5) * .06, (r() - .5) * .06, (r() - .5) * .06] }));
    } else if (essence === 'pin') {
      const r = hasard(0xA11E);
      p.hauteur = .95 + r() * .2;
      p.sinuosite = [.08 + r() * .05, .08 + r() * .05, r() * PI2, r() * PI2];
      p.etages = Array.from({ length: b.étages }, (_, e) => ({
        t: .3 + .62 * (b.étages > 1 ? e / (b.étages - 1) : .5),
        azim: e * 2.399963229728653 + (r() - .5) * .5,
        branches: Array.from({ length: b.branches }, (_, i) => ({
          azim: i * PI2 / b.branches + (r() - .5) * .35,
          inclinaison: .1 + r() * .22,
          long: .2 + r() * .1,
          chute: .03 + r() * .03,
          plateau: { r: .12 + r() * .06, giration: r() * PI2 },
        })),
      }));
      p.sommet = { r: .09 + r() * .05, giration: r() * PI2 };
    } else {
      const r = hasard(0xC005);
      p.hauteur = 1.05 + r() * .15;
      p.pente = [(r() - .5) * .06, (r() - .5) * .06];
      p.verticilles = Array.from({ length: b.verticilles }, (_, v) => {
        const t = .12 + .72 * (b.verticilles > 1 ? v / (b.verticilles - 1) : .5);
        return {
          t,
          azim: v * 2.399963229728653 + (r() - .5) * .4,
          branches: Array.from({ length: b.branches }, (_, i) => ({
            azim: i * PI2 / b.branches + (r() - .5) * .3,
            inclinaison: -.25 - r() * .1,
            long: (.3 - .22 * t) * (.85 + r() * .25),
            chute: .01 + r() * .01,
          })),
        };
      });
      p.amas = Array.from({ length: b.amas }, () => ({ r: .05 + r() * .03 }));
    }
    PLANS.set(cle, p);
    return p;
  }

  function feuillu(tri, p, N) {
    const P = t => [p.pente[0] * t * t, p.hauteur * t, p.pente[1] * t * t];
    tronc(tri, P, N, .055, .03, 6);
    const pointes = [P(1)];
    p.branches.forEach((br, i) => {
      const depart = P(br.attache);
      const bout = branche(tri, depart, direction(br.azim, br.inclinaison), br.long, br.chute, N, .028, .012, 4);
      pointes.push(bout);
      for (const c of p.charpentières[i]) {
        const depart2 = depart.map((v, k) => v + (bout[k] - v) * c.position);
        pointes.push(branche(tri, depart2, direction(br.azim + c.gisement, c.inclinaison), c.long, c.chute, N, .014, .006, 4));
      }
    });
    let k = 0;
    const poser = c => { const a = p.amas[k++]; amas(tri, [c[0] + a.d[0], c[1] + a.d[1], c[2] + a.d[2]], a.r, 6); };
    poser(pointes[0]);
    for (let i = 1; i <= p.branches.length && k < p.amas.length; i++) poser(pointes[i]);
    for (let i = p.branches.length + 1; k < p.amas.length; i++) poser(pointes[i % pointes.length]);
  }
  function pin(tri, p, N) {
    const [sx, sz, pa, pb] = p.sinuosite;
    const P = t => [sx * Math.sin(4.5 * t + pa) * t, p.hauteur * t, sz * Math.sin(3.7 * t + pb) * t];
    tronc(tri, P, N, .06, .025, 6);
    for (const e of p.etages) {
      const depart = P(e.t);
      for (const br of e.branches) {
        const bout = branche(tri, depart, direction(e.azim + br.azim, br.inclinaison), br.long, br.chute, N, .02, .008, 4);
        plateau(tri, bout, br.plateau.r, 8, br.plateau.giration);
      }
    }
    plateau(tri, P(1), p.sommet.r, 8, p.sommet.giration);
  }
  function conifere(tri, p, N) {
    const P = t => [p.pente[0] * t * t, p.hauteur * t, p.pente[1] * t * t];
    tronc(tri, P, N, .05, .012, 6);
    const pointes = [];
    for (const v of p.verticilles) {
      const depart = P(v.t);
      for (const br of v.branches)
        pointes.push(branche(tri, depart, direction(v.azim + br.azim, br.inclinaison), br.long, br.chute, N, .016, .005, 4));
    }
    const n = pointes.length;
    for (let k = 0; k < p.amas.length; k++) {
      const c = pointes[Math.floor(k * n / p.amas.length)], a = p.amas[k];
      amas(tri, [c[0], c[1] + a.r * .4, c[2]], a.r, 6);
    }
  }

  // Échelle uniforme et centrage sur la boîte englobante commune aux deux résolutions : les repères partagés
  // (pied au sol, cime) tombent sur les mêmes coordonnées normalisées en proche et en loin.
  function normaliser(proche, loin) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const tri of proche.concat(loin)) for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], tri[i][k]); max[k] = Math.max(max[k], tri[i][k]);
    }
    const taille = Math.max(...max.map((v, i) => v - min[i])), centre = max.map((v, i) => (v + min[i]) / 2);
    const convertir = liste => liste.map(t => t.map((p, i) => i < 3 ? p.map((v, k) => (v - centre[k]) / taille) : unite(p)));
    return { proche: convertir(proche), loin: convertir(loin) };
  }

  const CACHE = new Map();
  function generer(essence, qualite) {
    const p = plan(essence, qualite), b = BUDGETS[qualite];
    const proche = [], loin = [];
    const construire = (tri, N) => {
      if (essence === 'feuillu') feuillu(tri, p, N);
      else if (essence === 'pin') pin(tri, p, N);
      else conifere(tri, p, N);
    };
    construire(proche, b.segments.proche);
    construire(loin, b.segments.loin);
    return normaliser(proche, loin);
  }
  function forme(essence, loin, qualite) {
    if (!ESSENCES.includes(essence)) throw new Error('essence inconnue : ' + essence);
    if (!QUALITES.includes(qualite)) throw new Error('qualité inconnue : ' + qualite);
    const cle = essence + '|' + (loin ? 'loin' : 'proche') + '|' + qualite;
    if (!CACHE.has(cle)) {
      const paire = generer(essence, qualite);
      CACHE.set(essence + '|proche|' + qualite, paire.proche);
      CACHE.set(essence + '|loin|' + qualite, paire.loin);
    }
    return CACHE.get(cle);
  }
  function nomForme(essence, loin, qualite) {
    return 'arbre-' + essence + '-' + (loin ? 'loin' : 'proche') + '-' + qualite;
  }
  function organes(essence, qualite) {
    const b = BUDGETS[qualite][essence];
    if (essence === 'feuillu') return Object.freeze({
      pieds: 1, branches: b.branches, charpentières: b.branches * b.charpentières,
      amas: b.amas, pointes: 1 + b.branches * (1 + b.charpentières) });
    if (essence === 'pin') return Object.freeze({
      pieds: 1, étages: b.étages, branches: b.étages * b.branches, amas: b.amas, pointes: b.étages * b.branches + 1 });
    return Object.freeze({
      pieds: 1, verticilles: b.verticilles, branches: b.verticilles * b.branches, amas: b.amas,
      pointes: b.verticilles * b.branches + 1 });
  }
  function installer(rendu) {
    if (!rendu || typeof rendu.forme !== 'function') return false;
    for (const essence of ESSENCES) for (const loin of [false, true]) for (const qualite of QUALITES)
      rendu.forme(nomForme(essence, loin, qualite), forme(essence, loin, qualite));
    return true;
  }
  const matiere = partie => MATIERES[partie];

  B.botanique = { ESSENCES, QUALITES, BUDGETS, MATIERES, forme, nomForme, organes, installer, matiere };
  installer(typeof window !== 'undefined' ? window.FRender : globalThis.FRender);
})(globalThis.BITUME = globalThis.BITUME || {});
