/* BITUME — végétation basse des trois biomes. Géométrie originale, générée une fois puis instanciée.
   Les deux résolutions partagent leurs pieds, extrémités et dimensions ; les plantes restent présentes au loin.
   Aucun fichier de modèle, texture ou son ; aucune dépendance à la simulation ni consommation de son hasard. */
(function (B) {
  'use strict';

  const PI2 = Math.PI * 2;
  // Budget historique du palier bas : référence figée, le palier low ne retire ni ne déplace rien.
  const BUDGET = Object.freeze({ stations: 76, herbes: 152, taillis: 76, formes: 4 });

  // low reproduit exactement l'existant (mêmes stations, mêmes comptes, matière 11, deux familles).
  // Les paliers supérieurs plantent les poches du champ écologique. Les clairières n'allouent aucun tapis.
  // `groupes` = formes distinctes au plus par lot et par passe. `sol` = recette de terreau sous les fougères.
  const PALIERS = Object.freeze({
    low: Object.freeze({ stations: 76, herbes: 2, fougeres: 0, fleurs: 0, taillis: .58, mat: 11, sol: 11, groupes: 2, familles: ['herbes', 'taillis'] }),
    medium: Object.freeze({ stations: 112, herbes: 3, fougeres: 1, fleurs: 0, taillis: .74, mat: 27, sol: 25, groupes: 16, familles: ['herbes', 'fougères', 'taillis'] }),
    high: Object.freeze({ stations: 150, herbes: 4, fougeres: 2, fleurs: 3, taillis: .88, mat: 27, sol: 25, groupes: 16, familles: ['herbes', 'fougères', 'fleurs', 'taillis'] }),
    ultra: Object.freeze({ stations: 150, herbes: 4, fougeres: 2, fleurs: 3, taillis: .88, mat: 27, sol: 25, groupes: 16, familles: ['herbes', 'fougères', 'fleurs', 'taillis'] }),
  });
  // Une tuile est un petit maillage de 96 vrais brins, partagé par toutes les instances. La 0.2.29
  // dessinait 9 brins et 216 triangles par touffe : ici 576 triangles proches / 192 lointains par tuile,
  // soit 6 / 2 triangles par brin. Les plafonds concernent les tuiles, jamais des objets JS par brin.
  const BRINS_TUILE = 96;
  const LOT_TAPIS = 48;
  const BRINS_PRAIRIE = Object.freeze([8, 32, 64, 128, 256, 512, 1024, 2048, 4096]);
  // Brins par m² dans une poche riche, avant arrondi au maillage disponible. La campagne est moins drue
  // que les abords parcourus en voiture ; le champ écologique module la présence avant toute allocation.
  const TAPIS = Object.freeze({
    medium: Object.freeze({ densite: 2, terrain: .04, maximum: 180000, maillages: [8, 32], variantes: 2, plafonner: true }),
    high: Object.freeze({ densite: 8, terrain: .10, maximum: 180000, maillages: [8, 128], variantes: 2, plafonner: true }),
    ultra: Object.freeze({ densite: 240, terrain: 2, maximum: 220000, maillages: [8, 128, 1024, 4096], variantes: 2 }),
  });
  // Lot H (mode organique du jeu) : prairies et abords beaucoup plus denses (herbes hautes,
  // sous-bois, fougères, taillis) tout en préservant les budgets historiques des bancs sans organique.
  const PALIERS_DENSE = Object.freeze({
    low: PALIERS.low,
    medium: Object.freeze({ stations: 220, herbes: 4, fougeres: 2, fleurs: 0, taillis: 1.15, mat: 27, sol: 25, groupes: 16, familles: ['herbes', 'fougères', 'taillis'] }),
    high: Object.freeze({ stations: 380, herbes: 5, fougeres: 3, fleurs: 4, taillis: 1.65, mat: 27, sol: 25, groupes: 16, familles: ['herbes', 'fougères', 'fleurs', 'taillis'] }),
    ultra: Object.freeze({ stations: 460, herbes: 6, fougeres: 4, fleurs: 5, taillis: 2.0, mat: 27, sol: 25, groupes: 16, familles: ['herbes', 'fougères', 'fleurs', 'taillis'] }),
  });
  const TAPIS_DENSE = Object.freeze({
    medium: Object.freeze({ densite: 28, terrain: .40, maximum: 160000, maillages: [8, 128, 1024], variantes: 2, plafonner: true }),
    high: Object.freeze({ densite: 120, terrain: 1.4, maximum: 190000, maillages: [8, 128, 1024, 4096], variantes: 2, plafonner: true }),
    ultra: Object.freeze({ densite: 240, terrain: 2.6, maximum: 220000, maillages: [8, 128, 1024, 4096], variantes: 2 }),
  });

  // Biomes réellement dessinés par le décor (mêmes noms que THEMES de decor.js). Un biome absent retourne des lots vides.
  // `stations` module la maille d'échantillonnage, `densite` le nombre de plants par station, `taille` la stature.
  const BIOMES = Object.freeze({
    foret: Object.freeze({
      stations: 1, densite: 1, taille: 1, familles: ['herbes', 'fougères', 'fleurs', 'taillis'],
      herbe: [.12, .24, .062], taillis: [.075, .175, .046], taillisNuance: [.035, .055, .01],
      fougere: [.072, .195, .062], humus: [.13, .095, .052],
      fleurs: [[.70, .17, .12], [.90, .76, .16], [.86, .86, .90], [.34, .38, .78]],
    }),
    cote: Object.freeze({
      stations: .78, densite: .84, taille: .92, familles: ['herbes', 'fleurs', 'taillis'],
      herbe: [.18, .255, .095], taillis: [.115, .185, .072], taillisNuance: [.04, .05, .02],
      fougere: [.14, .225, .095], humus: [.22, .18, .105],
      fleurs: [[.92, .84, .30], [.88, .46, .18], [.94, .93, .88]],
    }),
    montagne: Object.freeze({
      stations: .74, densite: .78, taille: .84, familles: ['herbes', 'fougères', 'taillis'],
      herbe: [.125, .23, .082], taillis: [.082, .16, .072], taillisNuance: [.03, .045, .025],
      fougere: [.085, .19, .092], humus: [.115, .105, .075],
      fleurs: [[.56, .34, .62], [.88, .82, .28], [.90, .36, .44]],
    }),
    baikal: Object.freeze({
      stations: .78, densite: .82, taille: .86, familles: ['herbes', 'fougères', 'fleurs', 'taillis'],
      herbe: [.135, .235, .105], taillis: [.088, .185, .088], taillisNuance: [.03, .05, .025],
      fougere: [.085, .20, .105], humus: [.145, .13, .092],
      fleurs: [[.68, .60, .77], [.90, .88, .82], [.82, .65, .24]],
    }),
    pacifique: Object.freeze({
      stations: .95, densite: .95, taille: 1.05, familles: ['herbes', 'fougères', 'fleurs', 'taillis'],
      herbe: [.13, .22, .085], taillis: [.075, .165, .072], taillisNuance: [.03, .05, .02],
      fougere: [.072, .19, .078], humus: [.15, .105, .062],
      fleurs: [[.90, .74, .22], [.82, .38, .28], [.90, .90, .86]],
    }),
    asie: Object.freeze({
      stations: .85, densite: .88, taille: .96, familles: ['herbes', 'fougères', 'fleurs', 'taillis'],
      herbe: [.095, .24, .125], taillis: [.072, .185, .095], taillisNuance: [.03, .05, .02],
      fougere: [.068, .205, .105], humus: [.13, .13, .085],
      fleurs: [[.92, .56, .66], [.94, .88, .72], [.88, .32, .26]],
    }),
    corail: Object.freeze({
      stations: .80, densite: .84, taille: .94, familles: ['herbes', 'fleurs', 'taillis'],
      herbe: [.125, .25, .095], taillis: [.082, .205, .082], taillisNuance: [.035, .05, .02],
      fougere: [.095, .22, .092], humus: [.19, .155, .095],
      fleurs: [[.96, .52, .34], [.96, .84, .24], [.96, .95, .92]],
    }),
    fjord: Object.freeze({
      stations: .78, densite: .80, taille: .86, familles: ['herbes', 'fougères', 'taillis'],
      herbe: [.115, .21, .088], taillis: [.078, .155, .078], taillisNuance: [.03, .045, .02],
      fougere: [.082, .185, .095], humus: [.125, .115, .085],
      fleurs: [[.62, .42, .72], [.90, .86, .52]],
    }),
    sierra: Object.freeze({
      stations: .52, densite: .58, taille: .72, familles: ['herbes', 'taillis'],
      herbe: [.26, .24, .11], taillis: [.19, .20, .095], taillisNuance: [.04, .04, .02],
      fougere: [.18, .20, .09], humus: [.28, .17, .095],
      fleurs: [[.92, .68, .18], [.88, .38, .16]],
    }),
    islande: Object.freeze({
      stations: .58, densite: .64, taille: .66, familles: ['herbes', 'taillis'],
      herbe: [.14, .20, .078], taillis: [.11, .165, .072], taillisNuance: [.03, .04, .015],
      fougere: [.11, .17, .08], humus: [.08, .085, .09],
      fleurs: [[.78, .72, .86], [.88, .82, .38]],
    }),
    ovale: Object.freeze({
      stations: .82, densite: .85, taille: .90, familles: ['herbes', 'fleurs', 'taillis'],
      herbe: [.13, .235, .075], taillis: [.092, .185, .068], taillisNuance: [.035, .05, .018],
      fougere: [.095, .20, .078], humus: [.16, .135, .082],
      fleurs: [[.92, .82, .26], [.86, .34, .22], [.94, .94, .90]],
    }),
  });

  // Sans palier demandé, le profil historique : un appel qui ne nomme pas le palier (tests, outil de
  // comparaison avant/après, consommateur externe) retrouve exactement la végétation d'avant le chantier.
  function normaliserQualite(q) {
    return q === 'medium' || q === 'high' || q === 'ultra' || q === 'off' ? q : 'low';
  }

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

  // Ruban à nervure relevée : une courbe simple, deux pans et une pointe. Le niveau lointain ne change que
  // l'échantillonnage de la courbe ; aucune feuille n'est supprimée, aucun volume de remplacement n'apparaît.
  function feuille(sortie, spec, segments) {
    const { pied, cap, longueur, largeur, elevation, courbe, pli } = spec;
    const avant = [Math.cos(cap), 0, Math.sin(cap)], cote = [-avant[2], 0, avant[0]];
    const point = (t, u) => {
      const profil = Math.sin(Math.PI * t), avance = longueur * (t - courbe * t * t * .28);
      const monte = longueur * (elevation * t - courbe * t * t * .28);
      const l = largeur * profil * u, dos = largeur * pli * profil * (1 - Math.abs(u));
      return [pied[0] + avant[0] * avance + cote[0] * l, pied[1] + monte + dos, pied[2] + avant[2] * avance + cote[2] * l];
    };
    for (let i = 0; i < segments; i++) for (const u of [-1, 0]) {
      const a = point(i / segments, u), b = point(i / segments, u + 1);
      const c = point((i + 1) / segments, u + 1), d = point((i + 1) / segments, u);
      triangle(sortie, a, b, c, true); triangle(sortie, a, c, d, true);
    }
  }
  function tige(sortie, a, b, rayon) {
    const axe = unite(moins(b, a)), cote = unite(croix(axe, Math.abs(axe[1]) < .9 ? [0, 1, 0] : [1, 0, 0]));
    const face = croix(axe, cote), anneau = (p, r) => [0, 1, 2].map(i => {
      const angle = i * PI2 / 3;
      return p.map((v, k) => v + r * (cote[k] * Math.cos(angle) + face[k] * Math.sin(angle)));
    });
    const bas = anneau(a, rayon), haut = anneau(b, rayon * .45);
    for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; triangle(sortie, bas[i], haut[j], haut[i]); triangle(sortie, bas[i], bas[j], haut[j]); }
  }
  // Équivalent lointain d'une tige : un seul plan deux faces, même pied et même extrémité, donc même volume.
  function lance(sortie, a, b, largeur) {
    const axe = unite(moins(b, a)), cote = unite(croix(axe, Math.abs(axe[1]) < .9 ? [0, 1, 0] : [1, 0, 0]));
    const l = largeur / 2;
    triangle(sortie, a.map((v, i) => v - cote[i] * l), a.map((v, i) => v + cote[i] * l), b, true);
  }
  function herbe(segments) {
    const r = hasard(1807), tri = [];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399963229728653 + (r() - .5) * .4;
      feuille(tri, { pied: [Math.cos(a) * .045, 0, Math.sin(a) * .045], cap: a,
        longueur: .30 + r() * .24, largeur: .022 + r() * .017,
        elevation: 1.1 + r() * .9, courbe: .45 + r() * .7, pli: .36 }, segments);
    }
    return tri;
  }
  // Points bleus périodiques : chaque racine choisit le meilleur de douze candidats, avec la distance
  // torique aux racines déjà placées. Ni lignes de plantation ni amas au centre de la tuile. La génération
  // coûte une seule fois à l'ouverture ; le moteur n'actualise ensuite que ses uniformes de vent.
  function prairie(graine) {
    const r = hasard(graine), racines = [], proche = [], loin = [];
    for (let i = 0; i < BRINS_TUILE; i++) {
      let meilleur = null, distance = -1;
      for (let essai = 0; essai < 12; essai++) {
        const p = [r(), r()];
        let d = Infinity;
        for (const q of racines) {
          const dx = Math.abs(p[0] - q[0]), dz = Math.abs(p[1] - q[1]);
          d = Math.min(d, Math.min(dx, 1 - dx) ** 2 + Math.min(dz, 1 - dz) ** 2);
        }
        if (d > distance) { distance = d; meilleur = p; }
      }
      racines.push(meilleur);
      const x = (meilleur[0] - .5) * .90, z = (meilleur[1] - .5) * .90;
      const cap = r() * PI2, largeur = .0035 + r() * .0035, penche = .012 + r() * .025;
      const hauteur = .56 + r() * .44, dx = Math.cos(cap), dz = Math.sin(cap);
      const a = [x - dz * largeur, -.5, z + dx * largeur];
      const b = [x + dz * largeur, -.5, z - dx * largeur];
      const c = [x + dx * penche, -.5 + hauteur, z + dz * penche];
      const courbe = penche * (.12 + r() * .24);
      const milieu = p => [p[0] + (c[0] - p[0]) * .53 - dx * courbe,
        p[1] + (c[1] - p[1]) * .53, p[2] + (c[2] - p[2]) * .53 - dz * courbe];
      const am = milieu(a), bm = milieu(b);
      // Le maillage proche courbe le brin en gardant le pied et la pointe du triangle lointain.
      triangle(proche, a, b, bm, true); triangle(proche, a, bm, am, true); triangle(proche, am, bm, c, true);
      triangle(loin, a, b, c, true);
    }
    return { proche, loin };
  }
  // Canonique triangulaire : x,z dans [-.5,.5], x+z<=0. L'affinité de l'instance colle exactement
  // au vrai triangle du terrain, même avec du dévers. La grille est seulement un identifiant GPU :
  // positions, orientations et hauteurs sont tirées librement dans chaque cellule, sans rangs alignés.
  function prairieTriangle(variante) {
    const r = hasard(0x509f4173 ^ variante * 8171), cases = Array.from({ length: 8 }, () => []);
    for (let x = 0; x < 32; x++) for (let z = 0; z < 32 - x; z++) cases[(x * 13 + z * 7) % 8].push([x, z]);
    for (const liste of cases) for (let k = liste.length - 1; k > 0; k--) {
      const j = Math.floor(r() * (k + 1)), p = liste[k]; liste[k] = liste[j]; liste[j] = p;
    }
    const proche = [], loin = [];
    for (let i = 0; i < 4096; i++) {
      const rang = i % 8, liste = cases[rang], [cx, cz] = liste[Math.floor(i / 8) % liste.length];
      let u = r(), v = r();
      if (cx + cz === 31) { if (u + v > 1) { u = 1 - u; v = 1 - v; } u = .05 + u * .85; v = .05 + v * .85; }
      else { u = .04 + u * .92; v = .04 + v * .92; }
      const x = (cx + u) / 32 - .5, z = (cz + v) / 32 - .5, cap = r() * PI2;
      const dx = Math.cos(cap), dz = Math.sin(cap), largeur = .00020 + r() * .00020, penche = .00015 + r() * .00040;
      const a = [x - dz * largeur, -.5, z + dx * largeur], b = [x + dz * largeur, -.5, z - dx * largeur];
      const c = [x + dx * penche, -.5 + .48 + r() * .52, z + dz * penche];
      const courbe = penche * (.12 + r() * .24);
      const milieu = p => [p[0] + (c[0] - p[0]) * .53 - dx * courbe,
        p[1] + (c[1] - p[1]) * .53, p[2] + (c[2] - p[2]) * .53 - dz * courbe];
      const am = milieu(a), bm = milieu(b);
      triangle(proche, a, b, bm, true); triangle(proche, a, bm, am, true); triangle(proche, am, bm, c, true);
      if (rang === 0) triangle(loin, a, b, c, true);
    }
    return { proche, loin };
  }
  function taillis(segments) {
    const r = hasard(937), tri = [], pied = [0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const a = i * PI2 / 4 + (r() - .5) * .5, h = .44 + r() * .22;
      const milieu = [Math.cos(a) * .12, h * .55, Math.sin(a) * .12];
      const bout = [Math.cos(a) * .25, h, Math.sin(a) * .25];
      tige(tri, pied, milieu, .012); tige(tri, milieu, bout, .008);
      for (let j = 0; j < 3; j++) {
        const t = .28 + j * .32;
        const p = milieu.map((v, k) => v + (bout[k] - v) * t);
        feuille(tri, { pied: p, cap: a + (j % 2 ? 1 : -1) * (.55 + r() * .35), longueur: .20 + r() * .11,
          largeur: .065 + r() * .025, elevation: .10 + r() * .38, courbe: .38, pli: .28 }, segments);
      }
    }
    return tri;
  }
  // Fronde : un rachis arqué et huit pinnules par fronde, présentes aux deux résolutions. Le niveau lointain
  // ne change que l'échantillonnage (plan au lieu du tube du rachis, triangle au lieu du pan de la pinnule).
  function fougere(segments) {
    const r = hasard(2411), tri = [], proche = segments > 2;
    for (let i = 0; i < 5; i++) {
      const a = i * PI2 / 5 + (r() - .5) * .55, h = .34 + r() * .20;
      const pied = [0, 0, 0];
      const milieu = [Math.cos(a) * .07, h * .62, Math.sin(a) * .07];
      const bout = [Math.cos(a) * .30, h * .94, Math.sin(a) * .30];
      const avant = [Math.cos(a), 0, Math.sin(a)], cote = [-avant[2], 0, avant[0]];
      if (proche) { tige(tri, pied, milieu, .010); tige(tri, milieu, bout, .006); }
      else { lance(tri, pied, milieu, .050); lance(tri, milieu, bout, .034); }
      for (let j = 0; j < 8; j++) {
        const t = (j + .5) / 8, sens = j % 2 ? 1 : -1;
        const p = t < .5 ? pied.map((v, k) => v + (milieu[k] - v) * (t / .5)) : milieu.map((v, k) => v + (bout[k] - v) * ((t - .5) / .5));
        const l = (.055 + r() * .05) * Math.sin(Math.PI * Math.min(1, t * 1.15)) + .015;
        const e = [p[0] + cote[0] * l * sens, p[1] + .014, p[2] + cote[2] * l * sens];
        const q = [p[0] + avant[0] * .085, p[1] + .008, p[2] + avant[2] * .085];
        const eq = q.map((v, k) => v + (e[k] - p[k]));
        // Le pan lointain garde le coin extérieur de la pinnule ; le pied, porté par le rachis, reste couvert.
        if (proche) { triangle(tri, p, e, eq, true); triangle(tri, p, eq, q, true); }
        else triangle(tri, e, q, eq, true);
      }
    }
    return tri;
  }
  // Touffe fleurie : trois hampes raides, une corolle à six pétales, un cœur et deux feuilles. Au loin,
  // hampe en un plan, corolle à trois pétales pris parmi les six (mêmes pointes) et feuilles en un plan :
  // aucune hampe, aucune corolle, aucune feuille ne disparaît, seules les arêtes s'espacent.
  function fleur(segments) {
    const r = hasard(5217), tri = [], proche = segments > 2;
    for (let i = 0; i < 3; i++) {
      const a = i * PI2 / 3 + (r() - .5) * .8, h = .20 + r() * .14;
      const pied = [Math.cos(a) * .05, 0, Math.sin(a) * .05];
      const sommet = [Math.cos(a) * .085, h, Math.sin(a) * .085];
      const avant = [Math.cos(a), 0, Math.sin(a)], cote = [-avant[2], 0, avant[0]];
      if (proche) tige(tri, pied, sommet, .006); else lance(tri, pied, sommet, .038);
      const rayon = .055 + r() * .02;
      const pointe = j => {
        const b = j * PI2 / 6 + a;
        return [sommet[0] + Math.cos(b) * rayon, sommet[1] + .015, sommet[2] + Math.sin(b) * rayon];
      };
      // La corolle rejoint la hampe et le cœur conserve sa hauteur aux deux résolutions.
      const petales = proche ? 6 : 3;
      for (let j = 0; j < petales; j++) triangle(tri, sommet, pointe(2 * j), pointe(2 * ((j + 1) % 3)), true);
      const coeur = [sommet[0], sommet[1] + .05, sommet[2]], r2 = rayon * .45;
      for (let j = 0; j < 3; j++) {
        const b1 = j * PI2 / 3, b2 = (j + 1) * PI2 / 3;
        triangle(tri, coeur,
          [sommet[0] + Math.cos(b1) * r2, sommet[1] + .012, sommet[2] + Math.sin(b1) * r2],
          [sommet[0] + Math.cos(b2) * r2, sommet[1] + .012, sommet[2] + Math.sin(b2) * r2]);
      }
      for (let j = 0; j < 2; j++) {
        const t = .35 + j * .3, sens = j % 2 ? 1 : -1;
        const p = pied.map((v, k) => v + (sommet[k] - v) * t);
        const e = [p[0] + cote[0] * .075 * sens, p[1] + .012, p[2] + cote[2] * .075 * sens];
        const q = [p[0] + avant[0] * .055, p[1] + .006, p[2] + avant[2] * .055];
        const eq = q.map((v, k) => v + (e[k] - p[k]));
        if (proche) { triangle(tri, p, e, eq, true); triangle(tri, p, eq, q, true); }
        else triangle(tri, e, q, eq, true);
      }
    }
    return tri;
  }
  // Terreau sous les fougères : couronne basse et large, recette de sol organique du moteur. Les rayons sont
  // tirés une fois pour les deux résolutions ; la version lointaine reprend les mêmes, seulement moins sectorisée.
  function terreau(segments) {
    const tri = [], sommet = [0, .035, 0], n = segments > 2 ? 11 : 5;
    // Rayon analytique : les deux résolutions posent leurs sommets sur le même contour, seule la sectorisation change.
    const rayon = a => .115 + .022 * Math.cos(5 * a + .7) + .011 * Math.sin(3 * a + 1.9);
    for (let i = 0; i < n; i++) {
      const a0 = i * PI2 / n, a1 = (i + 1) * PI2 / n;
      triangle(tri, sommet, [Math.cos(a0) * rayon(a0), .004, Math.sin(a0) * rayon(a0)],
        [Math.cos(a1) * rayon(a1), .004, Math.sin(a1) * rayon(a1)]);
    }
    return tri;
  }
  function normaliserPaire(proche, loin) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const tri of proche.concat(loin)) for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], tri[i][k]); max[k] = Math.max(max[k], tri[i][k]);
    }
    const taille = max.map((v, i) => v - min[i]), centre = max.map((v, i) => (v + min[i]) / 2);
    const convertir = liste => liste.map(t => t.map((p, i) => i < 3 ? p.map((v, k) => (v - centre[k]) / taille[k]) : unite(p.map((v, k) => v * taille[k]))));
    return { proche: convertir(proche), loin: convertir(loin) };
  }
  const H = normaliserPaire(herbe(4), herbe(2)), T = normaliserPaire(taillis(4), taillis(2));
  const F = normaliserPaire(fougere(4), fougere(2)), FLE = normaliserPaire(fleur(4), fleur(2));
  const U = normaliserPaire(terreau(4), terreau(2)), P = prairie(0);
  const FORMES_PRAIRIE = {}, BRINS_FORMES = { 'herbes-val': 9, 'herbes-val-loin': 9, 'prairie-val': 96, 'prairie-val-loin': 96 };
  for (let variante = 0; variante < 2; variante++) {
    const p = prairieTriangle(variante);
    for (const n of BRINS_PRAIRIE) {
      const nom = 'prairie-val-' + n + '-' + (variante ? 'b' : 'a');
      FORMES_PRAIRIE[nom] = p.proche.slice(0, n * 6); FORMES_PRAIRIE[nom + '-loin'] = p.loin.slice(0, n / 4);
      BRINS_FORMES[nom] = n; BRINS_FORMES[nom + '-loin'] = n / 8;
    }
  }
  Object.freeze(FORMES_PRAIRIE); Object.freeze(BRINS_FORMES);

  // Les quatre formes historiques restent le registre de référence du palier bas.
  const FORMES = Object.freeze({ 'herbes-val': H.proche, 'herbes-val-loin': H.loin, 'taillis-val': T.proche, 'taillis-val-loin': T.loin });
  const FORMES_AJOUT = Object.freeze({
    ...FORMES_PRAIRIE,
    'prairie-val': P.proche, 'prairie-val-loin': P.loin,
    'fougeres-val': F.proche, 'fougeres-val-loin': F.loin,
    'humus-val': U.proche, 'humus-val-loin': U.loin,
    'fleurs-val': FLE.proche, 'fleurs-val-loin': FLE.loin,
  });
  const TOUTES = Object.assign({}, FORMES, FORMES_AJOUT);
  const JEU_FORMES = Object.freeze({
    low: Object.keys(FORMES),
    medium: Object.keys(FORMES).concat(Object.keys(FORMES_PRAIRIE), ['prairie-val', 'prairie-val-loin', 'fougeres-val', 'fougeres-val-loin', 'humus-val', 'humus-val-loin']),
    high: Object.keys(FORMES).concat(Object.keys(FORMES_AJOUT)),
  });
  const forme = nom => TOUTES[nom];
  function installer(rendu, qualite) {
    if (!rendu || typeof rendu.forme !== 'function') return false;
    // Sans palier demandé, on tient le contrat historique : quatre formes au registre. Une valeur nommée mais
    // inconnue (« auto », une faute de frappe) enregistre tout : inscrire une forme de trop coûte de la mémoire,
    // en oublier une ferait dessiner un objet absent du registre.
    const cle = qualite === undefined || qualite === null || qualite === 'low' ? 'low'
      : qualite === 'medium' ? 'medium' : 'high';
    for (const nom of JEU_FORMES[cle]) rendu.forme(nom, TOUTES[nom]);
    return true;
  }

  // Massifs par secteurs de 420 m, tapis par secteurs de 48 m pour limiter le surdessin hors champ.
  // Les verts ont leur générateur indépendant. Ajouter un massif ne déplace ni arbre, ni obstacle, ni stand.
  function construire(c, options = {}) {
    const { limites, interroger } = options;
    const qualite = normaliserQualite(options.qualite);
    const vide = { lots: [], herbes: 0, fougeres: 0, fleurs: 0, taillis: 0, brins: 0, brinsTapis: 0, tuiles: 0, objetsHerbe: 0, qualite };
    if (qualite === 'off' || !c || !limites || !interroger) return vide;
    const organique = options.organique === true;
    const biome = BIOMES[c.theme];
    if (!biome) return vide;
    // Un biome que le décor ne connaît pas n'a pas d'accotement dessiné : rien à végétaliser.
    if (B.decor && B.decor.THEMES && !B.decor.THEMES[c.theme] && !(organique && B.destinations?.THEMES?.[c.theme])) return vide;
    const palier = (organique ? PALIERS_DENSE : PALIERS)[qualite];
    const r = hasard((c.graine ^ 0x53a98b17) >>> 0), groupes = new Map(), groupesTapis = new Map(), w = c.largeur / 2;
    const ecologie = qualite === 'low' ? null : options.ecologie || (B.ecologie && B.ecologie.creer(c.graine, c.theme));
    const habitat = {};
    const tirageSpatial = (x, z, sel) => {
      let h = Math.imul(Math.floor(x * 31), 374761393) ^ Math.imul(Math.floor(z * 31), 668265263) ^ c.graine ^ sel;
      h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    let herbes = 0, fougeres = 0, fleurs = 0, taillis = 0;
    let tuiles = 0;
    const stations = Math.max(1, Math.round(palier.stations * biome.stations));
    const pas = Math.max(1, Math.ceil(c.n / stations));
    function ajouter(i, d, famille, angle, taille, color, mat) {
      if (c.stands && B.circuit.empriseStands(c, i*c.pas, d, Math.max(taille[0],taille[2])*.5+.5)) return false;
      // Chaque plante vérifie sa propre abscisse, pas seulement celle du début du massif : les décalages
      // internes d'une touffe ne doivent pas rentrer par le portail ou dans la zone des stands.
      if (qualite !== 'low' && interdit(i)) return false;
      const a = c.cap[i], x = c.x[i] - Math.sin(a) * d, z = c.z[i] + Math.cos(a) * d;
      if (ecologie) {
        const e = ecologie.echantillonner(x, z, habitat);
        const richesse = famille === 'fleurs' ? e.fleurs : famille === 'taillis' ? e.boisement
          : famille === 'fougeres' ? e.herbe * (.35 + .65 * e.boisement) : e.herbe;
        const seuilEco = organique ? .03 : .08;
        if (richesse < seuilEco || tirageSpatial(x, z, famille.length * 911) > (organique ? Math.min(.95, richesse * 1.45 + .18) : richesse)) return false;
      }
      const q = interroger(x, z, 40), marge = Math.hypot(taille[0], taille[2]) / 2 + .18;
      if (q.i < 0 || q.d < w + 1.2 + marge || Math.abs(B.circuit.ecart(c, i * c.pas, q.i * c.pas)) > 20) return false;
      if (qualite !== 'low' && interdit(q.i)) return false;
      const cote = d < 0 ? -1 : 1, limite = cote < 0 ? limites.G[i] : limites.D[i];
      if (Math.abs(d) + marge > limite - .7) return false;
      // Même bande d'accotement que nappesRoute(), pied légèrement enterré, dévers arrêté au bord de piste.
      const ext = limite + 4, u = (Math.abs(d) - w - 1.2) / (ext - w - 1.2);
      const bord = c.y[i] - cote * w * Math.tan(c.devers[i]);
      const sol = bord - .015 + u * (.015 - .02 * (ext - w - 1.2));
      const objet = { shape: famille + '-val', p: [x, sol + taille[1] / 2 - .025, z], s: taille,
        r: [0, angle, 0], mat, color };
      if (qualite !== 'low' && famille === 'herbes') objet.windResponsive = true;
      const cle = Math.floor(i * c.pas / 420);
      let lot = groupes.get(cle); if (!lot) groupes.set(cle, lot = { objets: [], loin: [] });
      lot.objets.push(objet); lot.loin.push({ ...objet, shape: famille + '-val-loin' });
      return objet;
    }
    function interdit(i) {
      const margeDepart = organique ? (c.ouvert ? 35 : 115) : 360;
      return Math.abs(B.circuit.ecart(c, 0, i * c.pas)) < margeDepart || (B.circuit.dansCouvert && B.circuit.dansCouvert(c, i * c.pas, 20));
    }
    function tiragesSpecimen(i, d, sel) {
      const cap = c.cap[i];
      const x = Math.floor((c.x[i] - Math.sin(cap) * d) * 100);
      const z = Math.floor((c.z[i] + Math.cos(cap) * d) * 100);
      return [hash(x, z, sel), hash(x, z, sel + 1), hash(x, z, sel + 2)];
    }
    for (let station = 0, i = 0; i < c.n && station < stations; i += pas, station++) {
      const hasardStation = [r(), r(), r(), r(), r(), r(), r(), r()];
      const cote = qualite === 'low' ? (station % 2 ? 1 : -1) : (hasardStation[6] < .5 ? -1 : 1);
      if (interdit(i)) continue;
      const limite = cote < 0 ? limites.G[i] : limites.D[i], espace = limite - w - 4.2;
      if (espace < 1.2) continue;
      const d = cote * (w + 2.5 + hasardStation[0] * Math.min(espace - .3, 4.5));
      for (let k = 0; k < palier.herbes; k++) {
        const j = (i + k * 2) % c.n, decalage = d + cote * k * .75;
        const [orientation, ampleur, stature] = qualite === 'low'
          ? [hasardStation[k + 2], hasardStation[k + 1], hasardStation[k + 3]]
          : tiragesSpecimen(j, decalage, 1001);
        const largeur = (.95 + ampleur * .52) * biome.taille, h = (.40 + stature * .28) * biome.taille;
        const vert = .82 + hasardStation[k + 4] * .30, b = biome.herbe;
        if (ajouter(j, decalage, 'herbes', orientation * PI2,
          [largeur, h, largeur * (.72 + stature * .20)], [b[0] * vert, b[1] * vert, b[2] * vert], palier.mat)) herbes++;
      }
      if (hasardStation[7] < palier.taillis && espace > 3) {
        const nbTaillis = organique && palier.taillis > 1 ? 1 + Math.floor(hasardStation[1] * 2.2) : 1;
        for (let tk = 0; tk < nbTaillis; tk++) {
          const jT = (i + tk * 2) % c.n;
          const decalage = cote * Math.min(limite - 2.3, Math.abs(d) + 2.2 + tk * 1.1);
          const [orientation, ampleur, stature] = qualite === 'low'
            ? [hasardStation[4], hasardStation[5], hasardStation[6]]
            : tiragesSpecimen(jT, decalage, 1011 + tk * 7);
          const largeur = (1.0 + ampleur * .62) * biome.taille, h = (.78 + stature * .45) * biome.taille;
          const b = biome.taillis, n = biome.taillisNuance, t = hasardStation[(3 + tk) % 8];
          if (ajouter(jT, decalage, 'taillis', orientation * PI2,
            [largeur, h, largeur * .85], [b[0] + n[0] * t, b[1] + n[1] * t, b[2] + n[2] * t], palier.mat)) taillis++;
        }
      }
    }

    // Plantation en deux dimensions sur les triangles visibles. Aucun ruban ne dépend du sens de
    // la route ; les limites suivent le sol, les bâtiments et les rochers, jusque dans la campagne.
    const tapis = (organique ? TAPIS_DENSE : TAPIS)[qualite];
    let brinsTapis = 0, brinsAccotements = 0, brinsTerrain = 0, aireAccotements = 0, aireTerrain = 0;
    let aireDisponible = 0, aireRiche = 0, brinsRiches = 0;
    function hash(x, z, sel = 0) {
      let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(c.graine + sel, 2246822519);
      h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    function bruit(x, z, echelle, sel) {
      x /= echelle; z /= echelle;
      const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
      const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
      const a = hash(ix, iz, sel), b = hash(ix + 1, iz, sel), d = hash(ix, iz + 1, sel), e = hash(ix + 1, iz + 1, sel);
      return a + (b - a) * u + (d - a) * v + (a - b - d + e) * u * v;
    }
    if (tapis) {
      const surfaces = options.surfaces || (B.decor && B.decor.construire(c, { qualite: 'high', vegetation: false }).herbier);
      const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      function planter(source, points, cle, profondeur = 0) {
        if (tuiles >= tapis.maximum) return;
        const centre = [0, 1, 2].map(k => (points[0][k] + points[1][k] + points[2][k]) / 3);
        const ab = moins(points[1], points[0]), ac = moins(points[2], points[0]);
        const aire = Math.hypot(...croix(ab, ac)) / 2;
        const axe = interroger(centre[0], centre[2], 100), d = axe.i < 0 ? Infinity : axe.d;
        let richesse = 1, lisiere = false;
        if (ecologie) {
          richesse = ecologie.echantillonner(centre[0], centre[2], habitat).herbe;
          if (organique && source.type === 'accotement') {
            // Lot H : l'herbe des accotements varie de rase à très drue, sans bande chauve en plastique,
            // tout en gardant les clairières naturelles du grand terrain (budget 60 FPS tenu).
            if (richesse < .26) richesse = .26;
          }
          if (source.type === 'accotement' || d < 140) {
            let min = richesse, max = richesse;
            for (const p of points) {
              const v = ecologie.echantillonner(p[0], p[2], habitat).herbe;
              min = Math.min(min, v); max = Math.max(max, v);
            }
            if (organique && source.type === 'accotement') { min = Math.max(min, .26); max = Math.max(max, .26); }
            if (max < .025) return;
            lisiere = max - min > .38 || (min === 0 && max > .15);
          }
          if (richesse < .025 && !lisiere) return;
        }
        const proximite = source.type === 'accotement' ? 1 : 1 - lisse(28, 90, d);
        const masse = .90 + .20 * bruit(centre[0], centre[2], 31, 813);
        const densite = (tapis.terrain + (tapis.densite - tapis.terrain) * proximite * proximite) * masse * Math.min(1, richesse / .8);
        const souhait = aire * densite;
        if (((!tapis.plafonner && souhait > 4096) || lisiere) && profondeur < 9 && tuiles + 2 < tapis.maximum) {
          const longueurs = [0, 1, 2].map(i => Math.hypot(...moins(points[(i + 1) % 3], points[i])));
          const longueur = Math.max(...longueurs);
          if ((!tapis.plafonner && souhait > 4096) || (lisiere && longueur > 12)) {
            const k = longueurs.indexOf(longueur), a = points[k], b = points[(k + 1) % 3], c0 = points[(k + 2) % 3];
            const milieu = a.map((v, j) => (v + b[j]) / 2);
            planter(source, [a, milieu, c0], cle * 2 + 1, profondeur + 1);
            planter(source, [milieu, b, c0], cle * 2 + 2, profondeur + 1);
            return;
          }
        }
        if (richesse < .025) return;
        const n = tapis.maillages.find(v => v >= souhait) || tapis.maillages[tapis.maillages.length - 1];
        // Le sommet d'angle le plus ouvert place le centre de l'instance sur le grand côté : sa sphère
        // est petite, et une pointe aiguë ne retarde pas le LOD de toutes les plantes du secteur.
        let permutation = 0, angle = Infinity;
        for (let k = 0; k < 3; k++) {
          const u = moins(points[(k + 1) % 3], points[k]), v = moins(points[(k + 2) % 3], points[k]);
          const cos = u.reduce((s, x, j) => s + x * v[j], 0) / (Math.hypot(...u) * Math.hypot(...v));
          if (cos < angle) { angle = cos; permutation = k; }
        }
        const proche = source.type === 'accotement' || d < 100, maille = proche ? (qualite === 'ultra' ? 16 : qualite === 'medium' ? 48 : 24) : (qualite === 'medium' ? 96 : 64);
        const gx = Math.floor(centre[0] / maille), gz = Math.floor(centre[2] / maille), groupe = (proche ? 'p' : 'l') + gx + ',' + gz;
        // Une seule variante dans un lot : le nombre de dessins ne double pas pour varier les motifs.
        const variante = tapis.variantes === 1 || hash(gx, gz, 701) < .5 ? 'a' : 'b';
        const a = points[permutation], b = points[(permutation + 1) % 3], c0 = points[(permutation + 2) % 3];
        const ex = moins(b, a), ez = moins(c0, a), sx = Math.hypot(...ex), x = ex.map(v => v / sx), y = source.normal;
        const z = croix(x, y), shear = x.reduce((s, v, k) => s + v * ez[k], 0), sz = z.reduce((s, v, k) => s + v * ez[k], 0);
        if (!(sx > .001 && sz > .001)) return;
        const stature = bruit(centre[0], centre[2], 17, 947), ton = bruit(centre[0], centre[2], 57, 967);
        const h = (organique ? (.28 + .26 * stature) : (.22 + .20 * stature)) * biome.taille;
        const vert = .84 + ton * .28, sec = bruit(centre[0], centre[2], 113, 163) * (organique ? .08 : .12);
        const color = [biome.herbe[0] * vert + sec * .18, biome.herbe[1] * vert + sec * .11, biome.herbe[2] * vert];
        const nom = 'prairie-val-' + n + '-' + variante;
        const objet = { shape: nom, p: a.map((v, k) => v + (ex[k] + ez[k]) / 2 + y[k] * h / 2 - (k === 1 ? .005 : 0)),
          s: [sx, h, sz], r: [Math.atan2(y[2], z[2]), -Math.asin(Math.max(-1, Math.min(1, x[2]))), Math.atan2(x[1], x[0])],
          mat: palier.mat, color, windResponsive: true, groundCover: true, groundShear: shear,
          grassArea: aire, grassSurface: source.type, grassRichness: richesse };
        let lot = groupesTapis.get(groupe); if (!lot) groupesTapis.set(groupe, lot = { objets: [], loin: [] });
        lot.objets.push(objet); lot.loin.push({ ...objet, shape: nom + '-loin' });
        herbes++; tuiles++; brinsTapis += n;
        if (richesse >= .8) { aireRiche += aire; brinsRiches += n; }
        if (source.type === 'accotement') { brinsAccotements += n; aireAccotements += aire; }
        else { brinsTerrain += n; aireTerrain += aire; }
      }
      if (surfaces) {
        aireDisponible = surfaces.aire;
        // Le plafond est réparti sur toute la surface en cas de circuit exceptionnellement grand.
        const sources = surfaces.triangles, saut = Math.max(1, Math.ceil(sources.length / tapis.maximum));
        for (let i = 0; i < sources.length; i += saut) planter(sources[i], sources[i].points, i + 1);
      }
    }

    // Fougères : générées sur leur propre maille, côté opposé aux herbes, avec leur terreau.
    if (palier.fougeres && biome.familles.includes('fougères')) {
      const rf = hasard((c.graine ^ 0x2c1f9a17) >>> 0);
      const stationsDenses = Math.max(1, Math.round(PALIERS.high.stations * biome.stations));
      const stationsF = Math.max(1, Math.round(stationsDenses * .82 * biome.densite));
      const pasF = Math.max(1, Math.ceil(c.n / stationsF));
      const stationsRetenues = Math.max(1, Math.round(stations * .82 * biome.densite));
      const densite = stationsRetenues / stationsF;
      for (let station = 0, i = 0; i < c.n && station < stationsF; i += pasF, station++) {
        if (interdit(i)) continue;
        const t = [rf(), rf(), rf(), rf(), rf(), rf()];
        // La densité filtre la maille commune après le tirage de la station.
        if (Math.ceil((station + 1) * densite) === Math.ceil(station * densite)) continue;
        const cote = t[5] < .5 ? -1 : 1;
        const limite = cote < 0 ? limites.G[i] : limites.D[i], espace = limite - w - 4.2;
        if (espace < 2.2) continue;
        const d = cote * (w + 3.6 + t[0] * Math.min(espace - .8, 4.8));
        const nombre = 1 + Math.floor(t[1] * (palier.fougeres + .35));
        for (let k = 0; k < nombre; k++) {
          const j = (i + k + Math.floor(t[3] * pasF * .75)) % c.n, vert = .78 + t[2 + (k % 4)] * .34;
          const decalage = d + cote * k * .85;
          const [orientation, ampleur, stature] = tiragesSpecimen(j, decalage, 1021);
          const largeur = (1.05 + ampleur * .55) * biome.taille, h = (.52 + stature * .26) * biome.taille;
          const b = biome.fougere;
          const plant = ajouter(j, decalage, 'fougeres', orientation * PI2,
            [largeur, h, largeur * (.86 + t[5] * .22)], [b[0] * vert, b[1] * vert, b[2] * vert], palier.mat);
          if (!plant) continue;
          fougeres++;
          // Le pied de fougère repose sur une couronne de terreau posée au sol, même empreinte au sol que la fronde.
          const lot = groupes.get(Math.floor(j * c.pas / 420));
          const couronne = { ...plant, shape: 'humus-val',
            p: [plant.p[0], plant.p[1] - plant.s[1] / 2 + .03, plant.p[2]],
            s: [plant.s[0] * .8, .06, plant.s[2] * .8], mat: palier.sol, color: biome.humus };
          lot.objets.push(couronne); lot.loin.push({ ...couronne, shape: 'humus-val-loin' });
        }
      }
    }

    // Fleurs : prairie clairsemée en bordure extérieure, palette par biome.
    if (palier.fleurs && biome.familles.includes('fleurs') && biome.fleurs && biome.fleurs.length) {
      const rl = hasard((c.graine ^ 0x7a19c3d1) >>> 0);
      const stationsL = Math.max(1, Math.round(stations * .9 * biome.densite)), pasL = Math.max(1, Math.ceil(c.n / stationsL));
      for (let station = 0, i = 0; i < c.n && station < stationsL; i += pasL, station++) {
        if (interdit(i)) continue;
        const t = [rl(), rl(), rl(), rl(), rl(), rl()];
        const cote = t[5] < .5 ? -1 : 1;
        const limite = cote < 0 ? limites.G[i] : limites.D[i], espace = limite - w - 4.2;
        if (espace < 2.6) continue;
        const d = cote * (w + 4.4 + t[0] * Math.min(espace - 1.0, 5.4));
        const nombre = 1 + Math.floor(t[1] * (palier.fleurs + .4));
        for (let k = 0; k < nombre; k++) {
          const j = (i + k + Math.floor(t[3] * pasL * .75)) % c.n, vert = .84 + t[2 + (k % 4)] * .30;
          const decalage = d + cote * k * .6;
          const [orientation, ampleur, stature] = tiragesSpecimen(j, decalage, 1031);
          const largeur = (.62 + ampleur * .40) * biome.taille, h = (.30 + stature * .18) * biome.taille;
          const c0 = biome.fleurs[Math.floor(t[5] * biome.fleurs.length) % biome.fleurs.length];
          if (ajouter(j, decalage, 'fleurs', orientation * PI2,
            [largeur, h, largeur * (.9 + t[5] * .25)], [c0[0] * vert, c0[1] * vert, c0[2] * vert], palier.mat)) fleurs++;
        }
      }
    }

    const lots = [];
    for (const [tapis, collection] of [[false, groupes], [true, groupesTapis]]) for (const l of collection.values()) {
      const centre = [0, 0, 0];
      for (const o of l.objets) for (let k = 0; k < 3; k++) centre[k] += o.p[k] / l.objets.length;
      // La sphère comprend la déformation de vent, également utilisée dans la passe d'ombre de FERRO.
      let rayon = 0;
      for (const o of l.objets) rayon = Math.max(rayon, Math.hypot(...moins(o.p, centre)) + Math.hypot(o.s[0] + Math.abs(o.groundShear || 0), o.s[1], o.s[2]) / 2 + .25
        + (o.windResponsive ? o.s[1] * 2.3 : 0));
      const lot = { ...l, centre, rayon, portee: Infinity, bascule: tapis ? 60 : 520, lodReferenceFov: 60, lodReferenceHeight: 1080, vegetation: true };
      // herbe rase : aucune ombre du soleil lisible (un texel d'ombre fait 10 cm), le moteur la saute en passe d'ombre
      if (tapis) { lot.tapis = true; lot.groundCover = true; lot.ombre = false; }
      lots.push(lot);
    }
    return { lots, herbes, fougeres, fleurs, taillis, brins: (herbes - tuiles) * 9 + brinsTapis,
      brinsTapis, brinsAccotements, brinsTerrain, aireAccotements, aireTerrain,
      aireNue: Math.max(0, aireDisponible - aireAccotements - aireTerrain), aireRiche, brinsRiches, tuiles, objetsHerbe: herbes, qualite };
  }

  B.vegetation = { FORMES, FORMES_AJOUT, FORMES_PRAIRIE, BRINS_FORMES, BRINS_PRAIRIE, BUDGET, PALIERS, TAPIS, LOT_TAPIS, BRINS_TUILE, BIOMES, JEU_FORMES, forme, installer, construire };
  // La page enregistre d'emblée toutes les formes : un changement de palier ne doit pas demander
  // d'ajouter une forme après FRender.create. Le registre du palier bas reste les quatre formes historiques.
  installer(typeof window !== 'undefined' ? window.FRender : globalThis.FRender, 'high');
})(globalThis.BITUME = globalThis.BITUME || {});
