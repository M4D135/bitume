/* BITUME — végétation basse des trois biomes. Géométrie originale, générée une fois puis instanciée.
   Les deux résolutions partagent leurs pieds, extrémités et dimensions ; les plantes restent présentes au loin.
   Aucun fichier de modèle, texture ou son ; aucune dépendance à la simulation ni consommation de son hasard. */
(function (B) {
  'use strict';

  const PI2 = Math.PI * 2;
  // Budget historique du palier bas : référence figée, le palier low ne retire ni ne déplace rien.
  const BUDGET = Object.freeze({ stations: 76, herbes: 152, taillis: 76, formes: 4 });

  // low reproduit exactement l'existant (mêmes stations, mêmes comptes, matière 11, deux familles).
  // Les paliers supérieurs ajoutent un tapis bas entre les massifs historiques. Ultra réemploie les formes High :
  // plus d'instances, pas de nouvelle famille de maillage ni de nouvelle passe de rendu.
  // `groupes` = formes distinctes au plus par lot et par passe. `sol` = recette de terreau sous les fougères.
  const PALIERS = Object.freeze({
    low: Object.freeze({ stations: 76, herbes: 2, fougeres: 0, fleurs: 0, taillis: .58, mat: 11, sol: 11, groupes: 2, familles: ['herbes', 'taillis'] }),
    medium: Object.freeze({ stations: 112, herbes: 3, fougeres: 1, fleurs: 0, taillis: .74, mat: 27, sol: 25, groupes: 4, familles: ['herbes', 'fougères', 'taillis'] }),
    high: Object.freeze({ stations: 150, herbes: 4, fougeres: 2, fleurs: 3, taillis: .88, mat: 27, sol: 25, groupes: 5, familles: ['herbes', 'fougères', 'fleurs', 'taillis'] }),
    ultra: Object.freeze({ stations: 150, herbes: 4, fougeres: 2, fleurs: 3, taillis: .88, mat: 27, sol: 25, groupes: 5, familles: ['herbes', 'fougères', 'fleurs', 'taillis'] }),
  });
  // Une tuile est un petit maillage de 96 vrais brins, partagé par toutes les instances. La 0.2.29
  // dessinait 9 brins et 216 triangles par touffe : ici 576 triangles proches / 192 lointains par tuile,
  // soit 6 / 2 triangles par brin. Les plafonds concernent les tuiles, jamais des objets JS par brin.
  const BRINS_TUILE = 96;
  const LOT_TAPIS = 48;
  // Maille métrique : couverture identique sur une piste plus longue, jusqu'au plafond réparti sur le tour.
  const TAPIS = Object.freeze({
    medium: Object.freeze({ pas: 6, rangees: 1, maximum: 1800, brins: BRINS_TUILE }),
    high: Object.freeze({ pas: 3.75, rangees: 2, maximum: 5600, brins: BRINS_TUILE }),
    ultra: Object.freeze({ pas: 1.875, rangees: 2, maximum: 11200, brins: BRINS_TUILE }),
  });

  // Biomes réellement dessinés par le décor (mêmes noms que THEMES de decor.js). Un biome absent retourne des lots vides.
  // `stations` module la maille d'échantillonnage, `densite` le nombre de plants par station, `taille` la stature.
  const BIOMES = Object.freeze({
    foret: Object.freeze({
      stations: 1, densite: 1, taille: 1, familles: ['herbes', 'fougères', 'fleurs', 'taillis'],
      herbe: [.21, .34, .105], taillis: [.135, .26, .075], taillisNuance: [.04, .06, 0],
      fougere: [.115, .27, .10], humus: [.16, .115, .06],
      fleurs: [[.70, .17, .12], [.90, .76, .16], [.86, .86, .90], [.34, .38, .78]],
    }),
    cote: Object.freeze({
      stations: .72, densite: .78, taille: .9, familles: ['herbes', 'fleurs', 'taillis'],
      herbe: [.34, .40, .17], taillis: [.22, .27, .13], taillisNuance: [.05, .05, .02],
      fougere: [.24, .33, .16], humus: [.30, .25, .15],
      fleurs: [[.92, .84, .30], [.88, .46, .18], [.94, .93, .88]],
    }),
    montagne: Object.freeze({
      stations: .62, densite: .66, taille: .78, familles: ['herbes', 'fougères', 'taillis'],
      herbe: [.21, .33, .14], taillis: [.15, .23, .13], taillisNuance: [.03, .05, .03],
      fougere: [.14, .26, .15], humus: [.13, .12, .09],
      fleurs: [[.56, .34, .62], [.88, .82, .28], [.90, .36, .44]],
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
  function prairie() {
    const r = hasard(180729), racines = [], proche = [], loin = [];
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
      const hauteur = i === 0 ? 1 : .56 + r() * .44, dx = Math.cos(cap), dz = Math.sin(cap);
      const a = [x - dz * largeur, -.5, z + dx * largeur];
      const b = [x + dz * largeur, -.5, z - dx * largeur];
      const c = [x + dx * penche, -.5 + hauteur, z + dz * penche];
      const milieu = p => p.map((v, k) => v + (c[k] - v) * .53), am = milieu(a), bm = milieu(b);
      // La version proche subdivise EXACTEMENT le triangle lointain : surface, racines, normales et
      // silhouette identiques au repos. Le milieu sert seulement à courber le brin sous le vent GPU.
      triangle(proche, a, b, bm, true); triangle(proche, a, bm, am, true); triangle(proche, am, bm, c, true);
      triangle(loin, a, b, c, true);
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
      // Au loin, la corolle s'appuie sur le sommet du cœur : la pointe la plus haute reste couverte.
      const origine = proche ? sommet : [sommet[0], sommet[1] + .05, sommet[2]];
      const petales = proche ? 6 : 3;
      for (let j = 0; j < petales; j++) triangle(tri, origine, pointe(2 * j), pointe(2 * ((j + 1) % 3)), true);
      if (proche) {
        const coeur = [sommet[0], sommet[1] + .05, sommet[2]], r2 = rayon * .45;
        for (let j = 0; j < 3; j++) {
          const b1 = j * PI2 / 3, b2 = (j + 1) * PI2 / 3;
          triangle(tri, coeur,
            [sommet[0] + Math.cos(b1) * r2, sommet[1] + .012, sommet[2] + Math.sin(b1) * r2],
            [sommet[0] + Math.cos(b2) * r2, sommet[1] + .012, sommet[2] + Math.sin(b2) * r2]);
        }
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
  const U = normaliserPaire(terreau(4), terreau(2)), P = prairie();

  // Les quatre formes historiques restent le registre de référence du palier bas.
  const FORMES = Object.freeze({ 'herbes-val': H.proche, 'herbes-val-loin': H.loin, 'taillis-val': T.proche, 'taillis-val-loin': T.loin });
  const FORMES_AJOUT = Object.freeze({
    'prairie-val': P.proche, 'prairie-val-loin': P.loin,
    'fougeres-val': F.proche, 'fougeres-val-loin': F.loin,
    'humus-val': U.proche, 'humus-val-loin': U.loin,
    'fleurs-val': FLE.proche, 'fleurs-val-loin': FLE.loin,
  });
  const TOUTES = Object.assign({}, FORMES, FORMES_AJOUT);
  const JEU_FORMES = Object.freeze({
    low: Object.keys(FORMES),
    medium: Object.keys(FORMES).concat(['prairie-val', 'prairie-val-loin', 'fougeres-val', 'fougeres-val-loin', 'humus-val', 'humus-val-loin']),
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
    const biome = BIOMES[c.theme];
    if (!biome) return vide;
    // Un biome que le décor ne connaît pas n'a pas d'accotement dessiné : rien à végétaliser.
    if (B.decor && B.decor.THEMES && !B.decor.THEMES[c.theme]) return vide;
    const palier = PALIERS[qualite];
    const r = hasard((c.graine ^ 0x53a98b17) >>> 0), groupes = new Map(), groupesTapis = new Map(), w = c.largeur / 2;
    let herbes = 0, fougeres = 0, fleurs = 0, taillis = 0;
    let tuiles = 0;
    const stations = Math.max(1, Math.round(palier.stations * biome.stations));
    const pas = Math.max(1, Math.ceil(c.n / stations));
    function ajouter(i, d, famille, angle, taille, color, mat) {
      // Chaque plante vérifie sa propre abscisse, pas seulement celle du début du massif : les décalages
      // internes d'une touffe ne doivent pas rentrer par le portail ou dans la zone des stands.
      if (qualite !== 'low' && interdit(i)) return false;
      const a = c.cap[i], x = c.x[i] - Math.sin(a) * d, z = c.z[i] + Math.cos(a) * d;
      const q = interroger(x, z, 40), marge = Math.hypot(taille[0], taille[2]) / 2 + .18;
      if (q.i < 0 || q.d < w + 1.2 + marge || Math.abs(B.circuit.ecart(c, i * c.pas, q.i * c.pas)) > 20) return false;
      if (qualite !== 'low' && interdit(q.i)) return false;
      const cote = d < 0 ? -1 : 1, limite = cote < 0 ? limites.G[i] : limites.D[i];
      if (Math.abs(d) + marge > limite - .7) return false;
      // Même bande d'accotement que nappesRoute(), pied légèrement enterré, dévers arrêté au bord de piste.
      const ext = limite + 4, u = (Math.abs(d) - w - 1.2) / (ext - w - 1.2);
      const bord = c.y[i] - cote * w * Math.sin(c.devers[i]);
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
      return Math.abs(B.circuit.ecart(c, 0, i * c.pas)) < 360 || (B.circuit.dansTunnel && B.circuit.dansTunnel(c, i * c.pas, 20));
    }
    for (let station = 0, i = 0; i < c.n && station < stations; i += pas, station++) {
      const cote = station % 2 ? 1 : -1, hasardStation = [r(), r(), r(), r(), r(), r(), r(), r()];
      if (interdit(i)) continue;
      const limite = cote < 0 ? limites.G[i] : limites.D[i], espace = limite - w - 4.2;
      if (espace < 1.2) continue;
      const d = cote * (w + 2.5 + hasardStation[0] * Math.min(espace - .3, 4.5));
      for (let k = 0; k < palier.herbes; k++) {
        const j = (i + k * 2) % c.n, largeur = (.95 + hasardStation[k + 1] * .52) * biome.taille, h = (.40 + hasardStation[k + 3] * .28) * biome.taille;
        const vert = .82 + hasardStation[k + 4] * .30, b = biome.herbe;
        if (ajouter(j, d + cote * k * .75, 'herbes', hasardStation[k + 2] * PI2,
          [largeur, h, largeur * (.72 + hasardStation[k + 3] * .20)], [b[0] * vert, b[1] * vert, b[2] * vert], palier.mat)) herbes++;
      }
      if (hasardStation[7] < palier.taillis && espace > 3) {
        const largeur = (1.0 + hasardStation[5] * .55) * biome.taille, h = (.75 + hasardStation[6] * .35) * biome.taille;
        const b = biome.taillis, n = biome.taillisNuance, t = hasardStation[3];
        if (ajouter(i, cote * Math.min(limite - 2.3, Math.abs(d) + 2.5), 'taillis', hasardStation[4] * PI2,
          [largeur, h, largeur * .85], [b[0] + n[0] * t, b[1] + n[1] * t, b[2] + n[2] * t], palier.mat)) taillis++;
      }
    }

    // Le plan est celui du triangle d'accotement réellement dessiné par nappesRoute(), dévers compris.
    // Une tuile suit ce plan au lieu de flotter à l'horizontale au-dessus d'une pente. Les indices voisins
    // couvrent aussi les petites variations de cap entre l'axe interpolé et les triangles du sol.
    function planSol(x, z, indice, cote) {
      const sommetSol = (j, exterieur) => {
        j = (j + c.n) % c.n;
        const limite = cote < 0 ? limites.G[j] : limites.D[j], ext = limite + 4;
        const d = cote * (exterieur ? ext : w + 1.2), a = c.cap[j];
        const y = c.y[j] - cote * w * Math.sin(c.devers[j]) - (exterieur ? .02 * (ext - w - 1.2) : .015);
        return [c.x[j] - Math.sin(a) * d, y, c.z[j] + Math.cos(a) * d];
      };
      for (let ecart = -2; ecart <= 2; ecart++) {
        const i = indice + ecart, a = sommetSol(i, cote < 0), b = sommetSol(i, cote > 0);
        const d = sommetSol(i + 1, cote < 0), e = sommetSol(i + 1, cote > 0);
        for (const [p, q, v] of [[a, b, e], [a, e, d]]) {
          const ax = q[0] - p[0], az = q[2] - p[2], bx = v[0] - p[0], bz = v[2] - p[2];
          const det = ax * bz - az * bx;
          if (Math.abs(det) < 1e-8) continue;
          const px = x - p[0], pz = z - p[2], u = (px * bz - pz * bx) / det, t = (ax * pz - az * px) / det;
          if (u < -1e-6 || t < -1e-6 || u + t > 1.000001) continue;
          const ay = q[1] - p[1], by = v[1] - p[1];
          return { y: p[1] + u * ay + t * by, dx: (ay * bz - by * az) / det, dz: (ax * by - bx * ay) / det };
        }
      }
      return null;
    }
    // Tapis continu : le maillage couvre toute l'empreinte, les tuiles se chevauchent légèrement et leur
    // décalage est indépendant. La frontière ne révèle ni rangée ni forme de touffe agrandie. Les paliers
    // partagent le même registre et n'ajoutent aucun objet par brin, même en Ultra.
    const tapis = TAPIS[qualite];
    if (tapis) {
      const cellules = Math.ceil(c.longueur / tapis.pas), candidats = cellules * 2 * tapis.rangees;
      for (let cellule = 0; cellule < cellules; cellule++) {
        for (const cote of [-1, 1]) for (let rang = 0; rang < tapis.rangees; rang++) {
          const k = (cellule * 2 + (cote > 0 ? 1 : 0)) * tapis.rangees + rang;
          if (candidats > tapis.maximum && Math.floor((k + 1) * tapis.maximum / candidats) === Math.floor(k * tapis.maximum / candidats)) continue;
          const rt = hasard((c.graine ^ 0x4f1b7d93 ^ Math.imul(cellule + 1, 0x45d9f3b)
            ^ Math.imul(rang + 1, 0x119de1f3) ^ (cote < 0 ? 0x6a09e667 : 0xbb67ae85)) >>> 0);
          const t = [rt(), rt(), rt(), rt(), rt(), rt(), rt(), rt()];
          const s = ((cellule + .5 + (t[0] - .5) * .10) * tapis.pas) % c.longueur;
          const i = Math.min(c.n - 1, Math.floor(s / c.pas));
          const longueur = tapis.pas * (1.28 + t[1] * .04);
          const protection = longueur / 2 + .5;
          if (interdit(i) || Math.abs(B.circuit.ecart(c, 0, s)) < 360 + protection
            || (B.circuit.dansTunnel && B.circuit.dansTunnel(c, s, 20 + protection))) continue;
          const e = B.circuit.echantillon(c, s), limite = cote < 0 ? limites.G[i] : limites.D[i];
          const debut = w + 1.48, fin = Math.min(limite - 1.9, w + 8.2), bande = fin - debut;
          if (bande < 1.1) continue;
          const largeur = bande / tapis.rangees * (1.04 + t[2] * .04);
          const demi = largeur * .5;
          const radial = Math.max(debut + demi, Math.min(fin - demi,
            debut + bande * ((rang + .5 + (t[3] - .5) * .10) / tapis.rangees)));
          const d = cote * radial, x = e.x - Math.sin(e.cap) * d, z = e.z + Math.cos(e.cap) * d;
          const q = interroger(x, z, 40);
          if (q.i < 0 || interdit(q.i) || Math.abs(B.circuit.ecart(c, s, q.i * c.pas)) > 20) continue;
          const plan = planSol(x, z, i, cote);
          if (!plan) continue;
          const cap = e.cap + (t[4] < .5 ? 0 : Math.PI), co = Math.cos(cap), si = Math.sin(cap);
          // La pente moyenne de l'empreinte évite de prolonger sur toute une tuile le seul triangle
          // central, notamment à l'entrée d'un dévers, et répartit l'erreur sur toute l'empreinte.
          const ax = planSol(x - co * longueur / 2, z - si * longueur / 2, i, cote);
          const bx = planSol(x + co * longueur / 2, z + si * longueur / 2, i, cote);
          const az = planSol(x + si * largeur / 2, z - co * largeur / 2, i, cote);
          const bz = planSol(x - si * largeur / 2, z + co * largeur / 2, i, cote);
          if (ax && bx && az && bz) {
            const px = (bx.y - ax.y) / longueur, pz = (bz.y - az.y) / largeur;
            plan.dx = px * co - pz * si; plan.dz = px * si + pz * co;
          }
          const normal = unite([-plan.dx, 1, -plan.dz]);
          const tangent = unite([co, plan.dx * co + plan.dz * si, si]), lateral = croix(tangent, normal);
          const rotation = [Math.atan2(normal[2], lateral[2]), -Math.asin(Math.max(-1, Math.min(1, tangent[2]))), Math.atan2(tangent[1], tangent[0])];
          const h = (.23 + t[5] * .13) * biome.taille, vert = .84 + t[6] * .26, b = biome.herbe;
          const objet = { shape: 'prairie-val', p: [x + normal[0] * h / 2, plan.y + normal[1] * h / 2 - .012, z + normal[2] * h / 2],
            s: [longueur, h, largeur], r: rotation, mat: palier.mat,
            color: [b[0] * vert, b[1] * vert, b[2] * vert], windResponsive: true };
          const cle = Math.floor(s / LOT_TAPIS);
          let lot = groupesTapis.get(cle); if (!lot) groupesTapis.set(cle, lot = { objets: [], loin: [] });
          lot.objets.push(objet); lot.loin.push({ ...objet, shape: 'prairie-val-loin' });
          herbes++; tuiles++;
        }
      }
    }

    // Fougères : générées sur leur propre maille, côté opposé aux herbes, avec leur terreau.
    if (palier.fougeres && biome.familles.includes('fougères')) {
      const rf = hasard((c.graine ^ 0x2c1f9a17) >>> 0);
      const stationsF = Math.max(1, Math.round(stations * .82 * biome.densite)), pasF = Math.max(1, Math.ceil(c.n / stationsF));
      for (let station = 0, i = 0; i < c.n && station < stationsF; i += pasF, station++) {
        if (interdit(i)) continue;
        const cote = station % 2 ? -1 : 1;
        const limite = cote < 0 ? limites.G[i] : limites.D[i], espace = limite - w - 4.2;
        if (espace < 2.2) continue;
        const t = [rf(), rf(), rf(), rf(), rf(), rf()];
        const d = cote * (w + 3.6 + t[0] * Math.min(espace - .8, 4.8));
        const nombre = 1 + Math.floor(t[1] * (palier.fougeres + .35));
        for (let k = 0; k < nombre; k++) {
          const j = (i + k) % c.n, vert = .78 + t[2 + (k % 4)] * .34;
          const largeur = (1.05 + t[2] * .55) * biome.taille, h = (.52 + t[3] * .26) * biome.taille;
          const b = biome.fougere;
          const plant = ajouter(j, d + cote * k * .85, 'fougeres', t[4] * PI2 + k * 1.7,
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
        const cote = station % 3 ? 1 : -1;
        const limite = cote < 0 ? limites.G[i] : limites.D[i], espace = limite - w - 4.2;
        if (espace < 2.6) continue;
        const t = [rl(), rl(), rl(), rl(), rl(), rl()];
        const d = cote * (w + 4.4 + t[0] * Math.min(espace - 1.0, 5.4));
        const nombre = 1 + Math.floor(t[1] * (palier.fleurs + .4));
        for (let k = 0; k < nombre; k++) {
          const j = (i + k) % c.n, vert = .84 + t[2 + (k % 4)] * .30;
          const largeur = (.62 + t[2] * .40) * biome.taille, h = (.30 + t[3] * .18) * biome.taille;
          const c0 = biome.fleurs[Math.floor(t[5] * biome.fleurs.length) % biome.fleurs.length];
          if (ajouter(j, d + cote * k * .6, 'fleurs', t[4] * PI2 + k * 2.1,
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
      for (const o of l.objets) rayon = Math.max(rayon, Math.hypot(...moins(o.p, centre)) + Math.hypot(...o.s) / 2 + .25
        + (o.windResponsive ? o.s[1] * 1.5 : 0));
      const lot = { ...l, centre, rayon, portee: Infinity, bascule: tapis ? 60 : 520, lodReferenceFov: 60, lodReferenceHeight: 1080, vegetation: true };
      if (tapis) lot.tapis = true;
      lots.push(lot);
    }
    return { lots, herbes, fougeres, fleurs, taillis, brins: (herbes - tuiles) * 9 + tuiles * BRINS_TUILE,
      brinsTapis: tuiles * BRINS_TUILE, tuiles, objetsHerbe: herbes, qualite };
  }

  B.vegetation = { FORMES, FORMES_AJOUT, BUDGET, PALIERS, TAPIS, LOT_TAPIS, BRINS_TUILE, BIOMES, JEU_FORMES, forme, installer, construire };
  // La page enregistre d'emblée toutes les formes : un changement de palier ne doit pas demander
  // d'ajouter une forme après FRender.create. Le registre du palier bas reste les quatre formes historiques.
  installer(typeof window !== 'undefined' ? window.FRender : globalThis.FRender, 'high');
})(globalThis.BITUME = globalThis.BITUME || {});
