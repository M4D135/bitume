// Route sans fin : tronçons déterministes à l'index, cycle obligatoire de biomes,
// raccords sans bosse ni trou. Chaque tronçon ne dépend que de (graine, index) : le
// résultat est identique quel que soit l'ordre de chargement de la fenêtre.
(function (B) {
  'use strict';
  const PAS = 2;
  // Cycle imposé par le maître : plage → plaine → petite montagne → grande montagne →
  // petite montagne → plaine → (plage…). La période est de six tronçons.
  const CYCLE = Object.freeze(['plage', 'plaine', 'petite-montagne', 'grande-montagne', 'petite-montagne', 'plaine']);
  // À l'intérieur du cycle, les paysages varient : variantes de thème par index et par graine.
  const VARIANTES = Object.freeze({
    'plage': ['cote', 'pacifique', 'corail'],
    'plaine': ['foret', 'asie', 'pacifique'],
    'petite-montagne': ['carpates', 'ecosse', 'sierra'],
    'grande-montagne': ['montagne', 'andes', 'islande'],
  });
  const REGLES = Object.freeze({
    'plage': { amplitude: 6, pente: .03, courbure: 1 / 60, virages: .35 },
    'plaine': { amplitude: 14, pente: .05, courbure: 1 / 45, virages: .55 },
    'petite-montagne': { amplitude: 22, pente: .10, courbure: 1 / 34, virages: .8 },
    'grande-montagne': { amplitude: 34, pente: .18, courbure: 1 / 26, virages: 1 },
  });
  const BORDE = 60;   // placage quintique vers les valeurs de bord, en mètres de part et d'autre

  function alea(graine) {
    let a = (graine >>> 0) ^ Math.imul((graine >>> 13) + 1, 0x9E3779B1);
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const borner = (v, a, b) => v < a ? a : v > b ? b : v;
  // Raccord quintique : pente nulle aux jonctions du mélange (comme le relief du Baïkal).
  const quintique = t => t * t * t * (10 + t * (-15 + 6 * t));

  function biomePour(k) { return CYCLE[((k % 6) + 6) % 6]; }

  // État de bord à la sortie du tronçon k : courbure et pente tirées une seule fois par
  // (graine, k). L'entrée du tronçon suivant est exactement cette sortie : C1 en courbure et pente.
  function sortie(k, graine) {
    if (k < 0) return { courbure: 0, pente: 0 };
    const r = alea((graine >>> 0) * 2654435761 + (k >>> 0) * 40503 + 17);
    const regle = REGLES[biomePour(k)];
    const sens = r() < .5 ? -1 : 1;
    const courbure = sens * Math.pow(r(), 1.6) * regle.courbure * (k % 3 === 2 ? .25 : 1);
    const pente = (r() - .5) * 2 * regle.pente * (0.3 + 0.7 * Math.pow(r(), 1.4));
    return { courbure, pente };
  }

  function profilSegment(k, graine) {
    const r = alea((graine >>> 0) * 2246822519 + (k >>> 0) * 668265263 + 7);
    const biome = biomePour(k), regle = REGLES[biome];
    const variantes = VARIANTES[biome];
    const theme = variantes[Math.floor(r() * variantes.length)];
    const L = Math.round((1200 + 900 * r()) / PAS) * PAS;
    const nb = 3 + Math.round(regle.virages * (2 + 3 * r()));
    const reliefs = 2 + Math.round(regle.amplitude / 12);
    const largeur = 6 + r() * 1.5, degagement = 10 + r() * 6;
    return { k, biome, theme, L, nb, reliefs, largeur, degagement, r };
  }

  // Points locaux du tronçon k : origine au début, cap local 0, x vers l'avant, z vers la droite.
  // cap(0)=0, κ(0)=κ_ent, κ(L)=κ_sort ; y(0)=0, y'(0)=pente_ent, y(L)=y_sort, y'(L)=pente_sort.
  function pointsSegment(k, graine) {
    const p = profilSegment(k, graine), r = p.r, regle = REGLES[p.biome];
    const entree = sortie(k - 1, graine), sortieFin = sortie(k, graine);

    // courbure : nœuds quintiques, valeurs de bord imposées, placage quintique sur les BORDE m
    const nc = p.nb;
    const kc = [];
    for (let j = 0; j <= nc; j++) kc.push(j === 0 ? entree.courbure : j === nc ? sortieFin.courbure : (r() - .5) * 2 * regle.courbure * (0.25 + 0.75 * Math.pow(r(), 1.3)));
    const courbure = s => {
      if (s <= 0) return entree.courbure;
      if (s >= p.L) return sortieFin.courbure;
      let j = 0;
      while (j < nc - 1 && s > p.L * (j + 1) / nc) j++;
      const t = (s - p.L * j / nc) / (p.L / nc);
      let v = kc[j] + (kc[j + 1] - kc[j]) * quintique(t);
      if (s < BORDE) v = entree.courbure + (v - entree.courbure) * quintique(s / BORDE);
      if (s > p.L - BORDE) v = sortieFin.courbure + (v - sortieFin.courbure) * quintique((p.L - s) / BORDE);
      return borner(v, -regle.courbure * 1.05, regle.courbure * 1.05);
    };

    // altitude : Hermite cubique par intervalle (pente continue aux nœuds), pentes de bord imposées
    const nr = p.reliefs;
    const cotes = [0], pentes = [entree.pente];
    for (let j = 1; j < nr; j++) { cotes.push(cotes[j - 1] + (r() - .5) * 2 * regle.amplitude / nr * 2); pentes.push((r() - .5) * 2 * regle.pente * .8); }
    cotes.push(cotes[nr - 1] + (r() - .5) * 2 * regle.amplitude / nr * 2); pentes.push(sortieFin.pente);
    for (let j = 0; j <= nr; j++) cotes[j] = borner(cotes[j], -regle.amplitude, regle.amplitude);
    cotes[0] = 0;
    const altitude = s => {
      if (s <= 0) return 0;
      if (s >= p.L) return cotes[nr];
      let j = 0;
      while (j < nr - 1 && s > p.L * (j + 1) / nr) j++;
      const h = p.L / nr, t = (s - p.L * j / nr) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * cotes[j] + (t3 - 2 * t2 + t) * h * pentes[j] + (-2 * t3 + 3 * t2) * cotes[j + 1] + (t3 - t2) * h * pentes[j + 1];
    };

    // intégration du cap et du plan au quart de pas, points à chaque PAS
    const pts = [], h = PAS / 4;
    let x = 0, z = 0, cap = 0;
    pts.push({ x: 0, y: 0, z: 0, cap: 0, s: 0 });
    const etapes = Math.round(p.L / PAS);
    for (let e = 0; e < etapes; e++) {
      for (let u = 0; u < 4; u++) {
        const s = e * PAS + u * h, k1 = courbure(s), k2 = courbure(s + h);
        const cap2 = cap + (k1 + k2) * h / 2, cm = (cap + cap2) / 2;
        x += Math.cos(cm) * h; z += Math.sin(cm) * h; cap = cap2;
      }
      const s = (e + 1) * PAS;
      pts.push({ x, y: altitude(s), z, cap, s });
    }
    return {
      profil: { k: p.k, biome: p.biome, theme: p.theme, L: p.L, largeur: p.largeur, degagement: p.degagement },
      pts,
      deplacement: { dx: x, dy: cotes[nr], dz: z, dcap: cap },
    };
  }

  // État global au début du tronçon k : somme pure des déplacements des tronçons 0..k−1.
  // Fonction pure de (graine, k) — mémoïsée, jamais dépendante de l'ordre des requêtes.
  const memoire = new Map();
  function etatBord(k, graine) {
    const cle = (graine >>> 0) + ':' + k;
    const vu = memoire.get(cle);
    if (vu) return vu;
    let x = 0, y = 0, z = 0, cap = 0;
    for (let j = 0; j < k; j++) {
      const d = pointsSegment(j, graine).deplacement;
      const c = Math.cos(cap), s = Math.sin(cap);
      x += c * d.dx - s * d.dz; z += s * d.dx + c * d.dz; y += d.dy; cap += d.dcap;
    }
    if (memoire.size > 8192) memoire.clear();
    const e = { x, y, z, cap };
    memoire.set(cle, e);
    return e;
  }

  // Trace explicite pour les tronçons [k0, k1[, repère du monde, prêt pour
  // B.circuit.creerDepuisTrace(..., { topologie: 'ouvert' }). Les jonctions partagent
  // exactement le même point : aucune bosse ni trou à la couture.
  function creerTrace(k0, k1, graine, options = {}) {
    const points = [];
    let total = 0;
    for (let k = k0; k < k1; k++) {
      const seg = pointsSegment(k, graine), bord = etatBord(k, graine);
      const c = Math.cos(bord.cap), s = Math.sin(bord.cap);
      const debut = k > k0 ? 1 : 0;   // le point d'origine est celui du voisin, sans doublon
      for (let i = debut; i < seg.pts.length; i++) {
        const q = seg.pts[i];
        points.push({
          x: bord.x + c * q.x - s * q.z, y: bord.y + q.y, z: bord.z + s * q.x + c * q.z,
          largeurG: seg.profil.largeur, largeurD: seg.profil.largeur, devers: 0,
          limiteG: seg.profil.largeur + seg.profil.degagement, limiteD: seg.profil.largeur + seg.profil.degagement,
        });
      }
      total += seg.profil.L;
    }
    // arrivee mesurée sur la polyligne en plan (corde ≤ arc), comme le veut le contrat ouvert
    let mesure = 0;
    for (let i = 1; i < points.length; i++) mesure += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    return { unite: 'm', topologie: 'ouvert', nom: options.nom || ('Route sans fin ' + k0 + '-' + k1),
      depart: 0, arrivee: Math.min(total, mesure - 1e-6), pasMax: PAS, points };
  }

  B.routeSansFin = { PAS, CYCLE, biomePour, profilSegment, pointsSegment, etatBord, creerTrace, REGLES, VARIANTES };
})(globalThis.BITUME = globalThis.BITUME || {});
