/* BITUME — le public des tribunes : de vrais corps humains, variés, animés sur le processeur graphique.
 *
 * Demande de David (18/11/2026) : « prends les beaux modèles human body de notre jeu emprise et remplace les cubes
 * dans le public par des vrais modèles humains, animés ». Les boîtes colorées des gradins (decor.js, tribune) cèdent
 * la place à des spectateurs assis sur les marches et debout derrière les glissières, qui respirent, tournent la tête
 * vers les voitures, se lèvent et agitent les bras au passage du peloton, au départ et à l'arrivée, et s'abritent
 * sous la pluie (au sec sous les toits ; parapluies et capuches à découvert).
 *
 * Provenance (lecture seule ; aucun fichier d'EMPRISE n'est chargé en plus de ceux que BITUME a déjà) :
 *   - EMPRISE (M4D135/emprise, commit cc004826a506e6979eaaec217748fe85d5cd6ac5, version 0.6.8) :
 *     src/human-data.js (tête : profil, nez, pommettes, orbites, bouche, oreilles, cou ; yeux et sourcils) et
 *     src/body-data.js (chemise, bassin, bras, mains et doigts, jambes, chaussures, poids continus sur deux os).
 *     Ces deux fichiers sont identiques, octet pour octet, aux copies de BITUME src/humain-donnees.js et
 *     src/humain-corps.js : on appelle leurs fonctions exportées (RADE.proceduralHuman : surface, ellipsoid, profile,
 *     normalise) avec leurs profils recopiés ici, à des résolutions choisies pour chaque niveau de détail. Les formes
 *     sont celles d'EMPRISE ; seuls changent le nombre d'anneaux et de côtés, et les fonds cachés dans le corps.
 *   - EMPRISE src/human.js : trois visages par déformation de la mâchoire et du nez (repris ici en continu dans le
 *     shader), cheveux tirés du crâne (même règle de sélection, même gonflement de 2,5 %), ajustement féminin des
 *     épaules, palette de peaux, tailles et carrures tirées par spectateur.
 *   - FERRO src/ferro/crowd.js (identique dans EMPRISE et BITUME) : format de sommet (36 octets : os, teinte, partie,
 *     matière, second os et son poids), pose des os dans le shader autour des mêmes pivots (hanches, cou, épaules,
 *     coudes, genoux, chevilles), liste des visibles faite par le processeur sans allocation, plafond par histogramme,
 *     dessin par les points d'accroche « foule » du moteur (fx.foule.ombre et fx.foule.couleur) avec la bibliothèque
 *     d'éclairage du monde (renderer.pdr). Ce module ne charge pas crowd.js : celui-ci pose ses unités sur un sol
 *     codé de 0 à 2,55 m et dessine les lointaines en points, alors que les gradins montent à 4 m au-dessus d'un
 *     relief quelconque et que le lointain doit rester un corps (rien ne se coupe ni ne change de nature au loin).
 *
 * Conception (voir docs/reprise/18-PUBLIC.md) :
 *   - tout se prépare au chargement : maillages des trois niveaux, spectateurs, textures des spectateurs, programmes ;
 *   - en course, par image : une liste d'indices par niveau (tableaux préalloués) et 96 vec4 pour les sections du
 *     public (excitation, cible du regard) ; aucune allocation, aucun objet par spectateur ;
 *   - la pose de chaque spectateur est calculée par le processeur graphique à partir du temps et de sa section ;
 *   - trois niveaux de détail (corps d'EMPRISE fin, corps d'EMPRISE allégé, silhouette articulée), passés en fondu
 *     tramé sur une bande de tailles à l'écran : la bascule ne se voit pas, et personne ne disparaît au loin ;
 *   - le hasard du public a sa propre graine, tirée de celle du circuit : ni Math.random, ni le hasard de la course,
 *     ni celui du décor ne sont consommés. Les animations ne dépendent que du temps : même mouvement à 30, 60 ou
 *     120 images par seconde.
 */
(function (B) {
  'use strict';

  // ---------------------------------------------------------------------------------------------------------------
  // Hasard propre au public
  // ---------------------------------------------------------------------------------------------------------------

  /** mulberry32 : la même suite que le reste du jeu, avec une graine à nous. */
  function alea(graine) {
    let a = graine >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Hachage entier (celui du shader de la foule de FERRO). */
  function hache(x) {
    x = (x ^ (x >>> 16)) >>> 0; x = Math.imul(x, 0x7feb352d) >>> 0;
    x = (x ^ (x >>> 15)) >>> 0; x = Math.imul(x, 0x846ca68b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /** smoothstep qui accepte des bords inversés (lisse(170, 22, d) : 1 tout près, 0 au loin). */
  const lisse = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const unite = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  // ---------------------------------------------------------------------------------------------------------------
  // Constantes partagées avec le shader
  // ---------------------------------------------------------------------------------------------------------------

  // Os d'EMPRISE (body-data.js) : 0 torse, 1 tête, 2/3 bras, 18/19 avant-bras, 4/5 cuisses, 16/17 tibias, 20/21 pieds.
  // Le côté −x porte les numéros pairs (2, 18, 4, 16, 20), le côté +x les impairs.
  const OS = Object.freeze({ TORSE: 0, TETE: 1, BRAS_G: 2, BRAS_D: 3, CUISSE_G: 4, CUISSE_D: 5, TIBIA_G: 16, TIBIA_D: 17,
    AVANT_BRAS_G: 18, AVANT_BRAS_D: 19, PIED_G: 20, PIED_D: 21 });
  // Teinte d'un sommet : la couleur vient du spectateur, sauf les teintes fixes (blanc des yeux, pupilles, métal).
  // TETE_LOIN : dessus et arrière de la tête des silhouettes, couleur des cheveux, du couvre-chef ou de la capuche.
  const TEINTE = Object.freeze({ PEAU: 0, HAUT: 1, BAS: 2, CHAUSSURES: 3, CHEVEUX: 4, COIFFE: 5, ACCESSOIRE: 6, BLANC: 7,
    SOMBRE: 8, METAL: 9, TETE_LOIN: 10 });
  // Parties montrées ou cachées par spectateur (masque de 32 bits) ; le corps (0) est toujours montré.
  const PARTIE = Object.freeze({ CORPS: 0, CHEVEUX_DESSUS: 1, CHEVEUX_LONGS: 2, QUEUE: 3, CHEVEUX_TOUR: 4, CASQUETTE: 5,
    BOB: 6, BONNET: 7, CHAPEAU: 8, CAPUCHE: 9, PARAPLUIE: 10, DRAPEAU: 11, ECHARPE: 12, LUNETTES: 13, YEUX: 14,
    VOLUME: 15, MOUSTACHE: 16 });
  // Matières : rugosité et métal décodés dans le shader.
  const MATIERE = Object.freeze({ TISSU: 0, PEAU: 1, CUIR: 2, CHEVEUX: 3, TOILE: 4, METAL: 5, PAILLE: 6, VERRE: 7, OEIL: 8, LAINE: 9 });
  const DEUX_OS = 32;
  const SOMMET = 36;                 // octets : position 3 × f32, normale 3 × f32, second os et poids 2 × f32, 4 × u8
  const NIVEAUX = 3;
  const SECTIONS = 48;               // vec4 par tableau d'uniformes : la ligne droite la plus longue en demande 39
  const LONG_SECTION = 16;           // m de ligne droite par section du public
  const LARGEUR_TEX = 1024;          // texels par ligne ; deux texels par spectateur
  const MAX_SPECTATEURS = 8192;      // l'indice tient sur 16 bits dans l'attribut d'instance
  const PENTE_PLUIE = .45;           // pluie poussée par le vent : 0,45 m vers l'intérieur par mètre de chute (≈ 24°)
  const GENRE = Object.freeze({ ASSIS: 0, DEBOUT: 1, GLISSIERE: 2 });
  // Abri d'un spectateur sous la pluie (bits 22-23 des traits) : au sec sous un toit, ou à découvert avec ce qu'il a.
  const ABRI = Object.freeze({ AUCUN: 0, PARAPLUIE: 1, CAPUCHE: 2, TOIT: 3 });

  // Paliers du jeu (graphismes.js) : Légère, Moyenne, Fine. cible : spectateurs sur la ligne droite, quel que soit le
  // nombre de tribunes du circuit ; glissieres : part debout derrière les glissières. Le niveau 0 n'existe qu'en Fine,
  // la Légère ne dessine que des silhouettes. Bandes de fondu en pixels de hauteur à l'écran ; plafonds d'instances.
  const PALIERS = Object.freeze({
    low: Object.freeze({ nom: 'low', cible: 300, glissieres: .12, debout: .25, bande0: [Infinity, Infinity], bande1: [Infinity, Infinity], plafond0: 0, plafond1: 0, ombre: false, niveauMin: 2 }),
    medium: Object.freeze({ nom: 'medium', cible: 450, glissieres: .15, debout: .5, bande0: [Infinity, Infinity], bande1: [19, 25], plafond0: 0, plafond1: 220, ombre: true, niveauMin: 1 }),
    high: Object.freeze({ nom: 'high', cible: 1000, glissieres: .16, debout: 1, bande0: [84, 106], bande1: [16, 21], plafond0: 48, plafond1: 360, ombre: true, niveauMin: 0 }),
  });
  const palierDe = q => PALIERS[q === 'ultra' ? 'high' : q] || PALIERS.high;

  // ---------------------------------------------------------------------------------------------------------------
  // Maillages : un constructeur à la manière de FERRO (crowd.js), puis les trois niveaux
  // ---------------------------------------------------------------------------------------------------------------

  function constructeur() {
    const f = [], b = [], idx = [];
    let os = 0, teinte = 0, partie = 0, matiere = 0;
    const regler = (o, t, p = PARTIE.CORPS, m = MATIERE.TISSU) => { os = o; teinte = t; partie = p; matiere = m; };
    /** Sommet : position, normale ; second os et son poids (−1 : un seul os ; même os : poids libre pour la partie). */
    function sommet(p, n, os2 = -1, poids = 0) {
      f.push(p[0], p[1], p[2], n[0], n[1], n[2], os2 < 0 ? os : os2, poids);
      b.push(os, teinte, partie, matiere | (os2 >= 0 && os2 !== os ? DEUX_OS : 0));
      return f.length / 8 - 1;
    }
    const pos = i => [f[i * 8], f[i * 8 + 1], f[i * 8 + 2]];
    /** Triangle tourné vers la normale voulue (sens direct vu de dehors, comme FERRO et EMPRISE). */
    function triangle(a, c, d, n) {
      const pa = pos(a), pc = pos(c), pd = pos(d);
      const u = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]], v = [pd[0] - pa[0], pd[1] - pa[1], pd[2] - pa[2]];
      const x = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (x[0] * n[0] + x[1] * n[1] + x[2] * n[2] < 0) idx.push(a, d, c); else idx.push(a, c, d);
    }
    return { f, b, idx, regler, sommet, triangle, pos, get sommets() { return f.length / 8; } };
  }

  /** Ellipsoïde, ou calotte gardée depuis le haut (calotte < 1), sommets partagés, normales analytiques. */
  function ellipsoide(m, c, r, lon, lat, calotte = 1) {
    const lignes = [], vmax = Math.PI * calotte;
    for (let j = 0; j <= lat; j++) {
      const v = j / lat * vmax, ligne = [];
      for (let i = 0; i <= lon; i++) {
        const u = i / lon * Math.PI * 2, e = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
        ligne.push(m.sommet([c[0] + e[0] * r[0], c[1] + e[1] * r[1], c[2] + e[2] * r[2]], unite([e[0] / r[0], e[1] / r[1], e[2] / r[2]])));
      }
      lignes.push(ligne);
    }
    for (let j = 0; j < lat; j++) for (let i = 0; i < lon; i++) {
      const a = lignes[j][i], b = lignes[j][i + 1], d2 = lignes[j + 1][i + 1], e = lignes[j + 1][i];
      const pa = m.pos(a), pd = m.pos(d2), n = [(pa[0] + pd[0]) / 2 - c[0], (pa[1] + pd[1]) / 2 - c[1], (pa[2] + pd[2]) / 2 - c[2]];
      if (j > 0) m.triangle(a, b, d2, n);
      if (j < lat - 1 || calotte < 1) m.triangle(a, d2, e, n);
    }
  }
  /** Anneau plat ou conique (bord de chapeau), des deux faces : rayon r0 → r1, hauteur y0 → y1 autour de c. */
  function bord(m, c, r0, r1, y0, y1, n, ez = 1) {
    for (const signe of [1, -1]) {
      const dedans = [], dehors = [], normale = unite([-(y1 - y0) * signe, (r1 - r0) * signe, 0]);
      const nn = a => unite([normale[0] * Math.cos(a), normale[1], normale[0] * Math.sin(a)]);
      for (let i = 0; i <= n; i++) {
        const a = i / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        dedans.push(m.sommet([c[0] + ca * r0, c[1] + y0, c[2] + sa * r0 * ez], nn(a)));
        dehors.push(m.sommet([c[0] + ca * r1, c[1] + y1, c[2] + sa * r1 * ez], nn(a)));
      }
      for (let i = 0; i < n; i++) {
        const v = nn((i + .5) / n * Math.PI * 2);
        m.triangle(dedans[i], dehors[i], dehors[i + 1], v); m.triangle(dedans[i], dehors[i + 1], dedans[i + 1], v);
      }
    }
  }
  /** Pavé effilé d'une silhouette lointaine : de y0 à y1, demi-tailles [x, z] en bas et en haut ; une face par nom. */
  const FACES = {
    avant: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [0, 0, 1]],
    arriere: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1], [0, 0, -1]],
    gauche: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, 0, 0]],
    droite: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1], [1, 0, 0]],
    dessus: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1], [0, 1, 0]],
    dessous: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [0, -1, 0]],
  };
  function face(m, c, y0, y1, bas, haut, nom) {
    const q = FACES[nom], coin = ([sx, sy, sz]) => { const d = sy > 0 ? haut : bas; return [c[0] + sx * d[0], sy > 0 ? y1 : y0, c[2] + sz * d[1]]; };
    const p = q.slice(0, 4).map(coin);
    // Normales adoucies vers l'axe du pavé : de loin, un pavé à normales franches scintille d'une face à l'autre.
    const doux = k => unite([q[4][0] + (p[k][0] - c[0]) * 2.2, q[4][1] * 1.4 + (p[k][1] - (y0 + y1) / 2) * .8, q[4][2] + (p[k][2] - c[2]) * 2.2]);
    const s = p.map((x, k) => m.sommet(x, doux(k)));
    m.triangle(s[0], s[1], s[2], q[4]); m.triangle(s[0], s[2], s[3], q[4]);
  }

  /** Corps et tête d'EMPRISE (profils de body-data.js et human-data.js, commit cc00482) à la résolution r. */
  function corpsEmprise(r) {
    const G = globalThis.RADE && globalThis.RADE.proceduralHuman;
    if (!G) throw new Error('public : charger humain-donnees.js (RADE.proceduralHuman) avant public.js');
    const { surface, ellipsoid, profile, smooth, clamp: borne } = G;
    const corps = G.mesh(), tete = G.mesh();
    // Fonds supprimés là où ils sont cachés dans le corps (haut et bas de la chemise, du bras, de la jambe, du cou) ;
    // gardés pour le bas du bassin (entre les jambes), la semelle et le crâne.
    const shirt = [[1.035, .195, .140], [1.11, .197, .145], [1.24, .207, .150], [1.36, .219, .143], [1.43, .216, .122], [1.475, .150, .088], [1.495, .077, .066], [1.512, .070, .064], [1.532, .067, .061]];
    surface(corps, { bottom: 1.035, top: 1.532, rows: r.chemise[0], sides: r.chemise[1], material: 1, cap: false, point(y, a) { const [rx, rz] = profile(y, shirt), fold = .0015 * Math.sin(y * 58 + a * 3) * Math.sin(a * 5); return [(rx + fold) * Math.cos(a), y - .018 * smooth(1.475, 1.532, y) * Math.max(0, Math.sin(a)) ** 2, (rz + fold) * Math.sin(a)]; } });
    surface(corps, { bottom: .87, top: 1.035, rows: r.bassin[0], sides: r.bassin[1], material: 2, point(y, a) { const [rx, rz] = profile(y, [[.87, .158, .108], [.95, .185, .127], [1.035, .195, .140]]); return [rx * Math.cos(a), y, rz * Math.sin(a)]; } });
    for (const side of [-1, 1]) {
      const upper = side > 0 ? 3 : 2, fore = side > 0 ? 19 : 18, thigh = side > 0 ? 5 : 4, shin = side > 0 ? 17 : 16, foot = side > 0 ? 21 : 20;
      surface(corps, { bottom: .955, top: 1.485, rows: r.bras[0], sides: r.bras[1], material: 1, cap: false, bones(y) { if (y > 1.40) return [upper, 0, smooth(1.40, 1.485, y) * .95]; return [upper, fore, 1 - smooth(1.135, 1.245, y)]; }, point(y, a) { const [rx, rz] = profile(y, [[.955, .045, .049], [1.04, .053, .058], [1.12, .058, .063], [1.19, .057, .062], [1.30, .069, .076], [1.40, .070, .076], [1.43, .061, .068], [1.465, .036, .043], [1.485, .012, .018]]), t = borne((1.43 - y) / .24), lower = borne((1.19 - y) / .24), cx = side * (y > 1.43 ? .235 - .085 * smooth(1.43, 1.485, y) : y < 1.19 ? .255 + .005 * lower : .235 + .020 * t), cz = .015 * lower, fold = .0012 * Math.sin(y * 65 + a * 3); return [cx + (rx + fold) * Math.cos(a), y - .026 * smooth(1.27, 1.43, y) * Math.max(0, side * Math.cos(a)) ** 2, cz + (rz + fold) * Math.sin(a)]; } });
      ellipsoid(corps, [side * .26, .910, .015], [.042, .057, .024], { bone: [fore, fore, 0], rows: r.paume[0], sides: r.paume[1] });
      if (r.doigts) {
        const lengths = [.045, .057, .054, .043], offsets = [-.027, -.009, .010, .027];
        for (let f = 0; f < 4; f++) ellipsoid(corps, [side * (.26 + offsets[f]), .861 - lengths[f] / 2, .018], [.0095, lengths[f] / 2 + .009, .0105], { bone: [fore, fore, 0], rows: r.doigts[0], sides: r.doigts[1] });
        ellipsoid(corps, [side * .216, .900, .026], [.012, .030, .014], { bone: [fore, fore, 0], tilt: side * .42, rows: r.pouce[0], sides: r.pouce[1] });
      }
      surface(corps, { bottom: .145, top: 1.0, rows: r.jambe[0], sides: r.jambe[1], material: 2, cap: false, bones(y) { if (y > .88) return [thigh, 0, smooth(.88, 1.0, y) * .7]; return [thigh, shin, 1 - smooth(.465, .575, y)]; }, point(y, a) { const [rx, rz] = profile(y, [[.145, .058, .065], [.29, .072, .082], [.45, .078, .086], [.54, .080, .088], [.72, .096, .107], [.88, .103, .115], [1.0, .102, .119]]), fold = .0014 * Math.sin(y * 52 + a * 4); return [side * .105 + (rx + fold) * Math.cos(a), y, (rz + fold) * Math.sin(a)]; } });
      surface(corps, { bottom: .005, top: .145, rows: r.chaussure[0], sides: r.chaussure[1], material: 4, bones: () => [foot, foot, 0], point(y, a) { const [rx, rz, cz] = profile(y, [[.005, .052, .110, .027], [.020, .059, .126, .035], [.052, .060, .124, .032], [.088, .055, .105, .023], [.115, .047, .071, .010], [.145, .041, .052, 0]]); return [side * .105 + rx * Math.cos(a) * (1 - .08 * Math.max(0, Math.sin(a))), y, cz + rz * Math.sin(a)]; } });
    }
    const shape = [[1.525, .028, .028, .018], [1.55, .057, .049, .026], [1.585, .079, .066, .021], [1.625, .091, .080, .008], [1.67, .095, .086, .0], [1.71, .093, .083, -.002], [1.75, .092, .078, -.007], [1.79, .080, .067, -.012], [1.815, .055, .047, -.015], [1.827, .006, .006, -.015]];
    const g = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
    surface(tete, { bottom: 1.525, top: 1.827, rows: r.tete[0], sides: r.tete[1], bones: () => [1, 1, 0], point(y, a) { const [rx, rz, cz] = profile(y, shape), x = rx * Math.cos(a), front = Math.max(0, Math.sin(a)) ** 6; let z = cz + rz * Math.sin(a); z += front * (.023 * g(x, y, 0, 1.669, .022, .030) + .010 * g(x, y, 0, 1.703, .015, .042) + .008 * g(x, y, -.054, 1.660, .026, .023) + .008 * g(x, y, .054, 1.660, .026, .023) - .010 * g(x, y, -.038, 1.703, .021, .013) - .010 * g(x, y, .038, 1.703, .021, .013) + .009 * g(x, y, 0, 1.611, .036, .008) - .003 * g(x, y, 0, 1.617, .040, .003)); return [x, y, z]; } });
    if (r.oreille) for (const side of [-1, 1]) ellipsoid(tete, [side * .097, 1.669, -.008], [.014, .034, .020], { rows: r.oreille[0], sides: r.oreille[1] });
    surface(tete, { bottom: 1.465, top: 1.555, rows: r.cou[0], sides: r.cou[1], cap: false, bones: () => [1, 1, 0], point(y, a) { const rx = .053 + smooth(1.51, 1.555, y) * .009; return [rx * Math.cos(a), y, .004 + .050 * Math.sin(a)]; } });
    G.normalise(corps); G.normalise(tete);
    return { corps, tete, yeux: [[-.038, 1.701, .078], [.038, 1.701, .078]], sourcils: [[-.038, 1.719, .079], [.038, 1.719, .079]] };
  }

  const TEINTE_EMPRISE = [TEINTE.PEAU, TEINTE.HAUT, TEINTE.BAS, TEINTE.BAS, TEINTE.CHAUSSURES];
  const MATIERE_EMPRISE = [MATIERE.PEAU, MATIERE.TISSU, MATIERE.TISSU, MATIERE.TISSU, MATIERE.CUIR];
  /** Verse un maillage d'EMPRISE (positions, normales, os [a, b, poids de b], matières, indices) dans le constructeur. */
  function verser(m, d, partie = PARTIE.CORPS, filtre = null, transformer = null) {
    const depart = m.sommets, carte = new Int32Array(d.positions.length).fill(-1), garde = [];
    for (let i = 0; i < d.indices.length; i += 3) {
      const a = d.indices[i], c = d.indices[i + 1], e = d.indices[i + 2];
      if (!filtre || filtre(d.positions[a], d.positions[c], d.positions[e])) garde.push(a, c, e);
    }
    for (const i of garde) {
      if (carte[i] >= 0) continue;
      const [os, os2, poids] = d.bones[i], mat = d.materials ? d.materials[i] : 0;
      m.regler(os, TEINTE_EMPRISE[mat] ?? TEINTE.PEAU, partie, MATIERE_EMPRISE[mat] ?? MATIERE.PEAU);
      carte[i] = m.sommet(transformer ? transformer(d.positions[i]) : d.positions[i], d.normals[i], poids > 0 && os2 !== os ? os2 : -1, poids);
    }
    for (const i of garde) m.idx.push(carte[i]);
    return m.sommets - depart;
  }

  // Résolutions des deux niveaux tirés d'EMPRISE : [anneaux, côtés]. EMPRISE dessine ses personnages à 26 × 28
  // (chemise) et 32 × 40 (tête) ; un spectateur ne dépasse guère 250 pixels de haut dans les vues de course, et le
  // niveau 1 ne sert qu'en dessous de 100 pixels.
  const RESOLUTIONS = [
    { chemise: [10, 16], bassin: [4, 16], bras: [12, 10], paume: [5, 8], doigts: [3, 5], pouce: [3, 5], jambe: [14, 10], chaussure: [5, 10],
      tete: [18, 22], oreille: [4, 6], cou: [3, 12] },
    { chemise: [5, 7], bassin: [1, 7], bras: [4, 5], paume: [3, 4], doigts: null, pouce: null, jambe: [5, 5], chaussure: [2, 6],
      tete: [6, 9], oreille: null, cou: [1, 6] },
  ];

  /** Accessoires d'un niveau proche (0) ou moyen (1). Positions au repos : debout, face vers +z. */
  function accessoires(m, n, emp) {
    const fin = n === 0, R = m.regler, T = TEINTE, P = PARTIE, M = MATIERE;
    // Cheveux : la règle d'EMPRISE (human.js), triangles du crâne au-dessus de 1,752 m ou à l'arrière, gonflés de 2,5 %.
    const centreDe = (a, b, c) => [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const crane = (a, b, c) => { const g = centreDe(a, b, c); return g[1] > 1.752 || (g[1] > 1.65 && g[2] < -.065); };
    const gonfler = k => p => [p[0] * k, 1.68 + (p[1] - 1.68) * k, p[2] * k];
    const pousser = (partie, filtre, k) => {
      const debut = m.sommets;
      verser(m, emp.tete, partie, filtre, gonfler(k));
      for (let i = debut; i < m.sommets; i++) { m.b[i * 4 + 1] = T.CHEVEUX; m.b[i * 4 + 3] = (m.b[i * 4 + 3] & DEUX_OS) | M.CHEVEUX; }
    };
    pousser(P.CHEVEUX_DESSUS, (a, b, c) => crane(a, b, c) && centreDe(a, b, c)[1] > 1.775, 1.025);
    pousser(P.CHEVEUX_TOUR, (a, b, c) => crane(a, b, c) && centreDe(a, b, c)[1] <= 1.775, 1.025);
    pousser(P.VOLUME, crane, 1.12);
    // Cheveux longs : une coque ouverte devant, du crâne (os de la tête) jusqu'aux épaules (torse), des deux faces.
    {
      const anneaux = fin ? 7 : 3, cotes = fin ? 12 : 6, lignes = [];
      R(OS.TETE, T.CHEVEUX, P.CHEVEUX_LONGS, M.CHEVEUX);
      for (let j = 0; j <= anneaux; j++) {
        const y = 1.76 - j / anneaux * .35, k = j / anneaux, poids = lisse(1.62, 1.46, y), ligne = [];
        for (let i = 0; i <= cotes; i++) {
          const a = Math.PI * (1.06 + .88 * i / cotes), p = [(.106 + .012 * k) * Math.cos(a), y, -.012 + (.102 + .01 * k) * Math.sin(a) - .02 * k];
          ligne.push([p, unite([Math.cos(a), .15, Math.sin(a)]), poids]);
        }
        lignes.push(ligne);
      }
      for (const signe of [1, -1]) {
        const s = lignes.map(l => l.map(([p, nn, poids]) => m.sommet(p, [nn[0] * signe, nn[1] * signe, nn[2] * signe], poids > .01 ? OS.TORSE : -1, poids)));
        for (let j = 0; j < anneaux; j++) for (let i = 0; i < cotes; i++) {
          const nn = lignes[j][i][1], v = [nn[0] * signe, nn[1] * signe, nn[2] * signe];
          m.triangle(s[j][i], s[j][i + 1], s[j + 1][i + 1], v); m.triangle(s[j][i], s[j + 1][i + 1], s[j + 1][i], v);
        }
      }
    }
    R(OS.TETE, T.CHEVEUX, P.QUEUE, M.CHEVEUX); ellipsoide(m, [0, 1.60, -.128], [.034, .095, .036], fin ? 8 : 5, fin ? 6 : 3);
    // Casquette : calotte et visière (tournée vers l'arrière par le shader pour quelques-uns).
    R(OS.TETE, T.COIFFE, P.CASQUETTE, M.TISSU);
    ellipsoide(m, [0, 1.722, -.004], [.106, .118, .112], fin ? 14 : 8, fin ? 5 : 3, .5);
    {
      const n2 = fin ? 8 : 4, haut = [], bas = [];
      for (let i = 0; i <= n2; i++) {
        const a = Math.PI * i / n2, x = Math.cos(a) * .095, z = .085 + Math.sin(a) * .105;
        haut.push(m.sommet([x, 1.735 - (z - .085) * .25, z], unite([0, 1, .25])));
        bas.push(m.sommet([x, 1.728 - (z - .085) * .25, z], unite([0, -1, -.25])));
      }
      const ch = m.sommet([0, 1.737, .08], unite([0, 1, .25])), cb = m.sommet([0, 1.730, .08], unite([0, -1, -.25]));
      for (let i = 0; i < n2; i++) { m.triangle(ch, haut[i], haut[i + 1], [0, 1, 0]); m.triangle(cb, bas[i + 1], bas[i], [0, -1, 0]); }
    }
    // Bob : calotte et bord tombant.
    R(OS.TETE, T.COIFFE, P.BOB, M.TISSU);
    ellipsoide(m, [0, 1.71, -.006], [.112, .135, .118], fin ? 14 : 8, fin ? 5 : 3, .5);
    bord(m, [0, 1.71, -.006], .112, .175, 0, -.045, fin ? 16 : 8, 1.05);
    // Bonnet : jusque sous les oreilles (l'oreille d'EMPRISE sort à 0,111 m de l'axe), avec un revers.
    R(OS.TETE, T.COIFFE, P.BONNET, M.LAINE);
    ellipsoide(m, [0, 1.676, -.01], [.116, .158, .118], fin ? 14 : 8, fin ? 6 : 3, .56);
    if (fin) bord(m, [0, 1.64, -.01], .119, .121, 0, .045, 14);
    // Chapeau de paille : calotte haute et large bord.
    R(OS.TETE, T.COIFFE, P.CHAPEAU, M.PAILLE);
    ellipsoide(m, [0, 1.70, -.005], [.104, .155, .11], fin ? 14 : 8, fin ? 5 : 3, .5);
    bord(m, [0, 1.735, -.005], .1, .225, 0, -.025, fin ? 18 : 8);
    // Capuche : coque autour de la tête, ouverte sur le visage, des deux faces ; le shader la rabat dans le dos.
    {
      R(OS.TETE, T.HAUT, P.CAPUCHE, M.TISSU);
      const c = [0, 1.685, -.012], r = [.124, .162, .132], lon = fin ? 16 : 8, lat = fin ? 9 : 5, lignes = [];
      for (let j = 0; j <= lat; j++) {
        const v = j / lat * Math.PI * .8, ligne = [];
        for (let i = 0; i <= lon; i++) {
          const u = i / lon * Math.PI * 2, e = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
          ligne.push([[c[0] + e[0] * r[0], c[1] + e[1] * r[1], c[2] + e[2] * r[2]], unite([e[0] / r[0], e[1] / r[1], e[2] / r[2]])]);
        }
        lignes.push(ligne);
      }
      for (const signe of [1, -1]) {
        const s = lignes.map(l => l.map(([p, nn]) => m.sommet(p, [nn[0] * signe, nn[1] * signe, nn[2] * signe])));
        for (let j = 0; j < lat; j++) for (let i = 0; i < lon; i++) {
          const pa = lignes[j][i][0], pc = lignes[j + 1][i + 1][0], g = [(pa[0] + pc[0]) / 2, (pa[1] + pc[1]) / 2, (pa[2] + pc[2]) / 2];
          if (g[2] > .035 && g[1] < 1.80) continue;     // l'ouverture du visage
          const v = [(g[0] - c[0]) * signe, (g[1] - c[1]) * signe, (g[2] - c[2]) * signe];
          m.triangle(s[j][i], s[j][i + 1], s[j + 1][i + 1], v); m.triangle(s[j][i], s[j + 1][i + 1], s[j + 1][i], v);
        }
      }
    }
    // Parapluie : manche et toile en coordonnées de la main droite ; le shader le tient droit au-dessus de la tête.
    {
      R(OS.AVANT_BRAS_D, T.METAL, P.PARAPLUIE, M.METAL);
      const e = .008, h = .80;
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const tx = -nz, tz = nx, q = [[-1, 0], [1, 0], [1, h], [-1, h]].map(([s, y]) => m.sommet([nx * e + tx * e * s, y, nz * e + tz * e * s], [nx, 0, nz]));
        m.triangle(q[0], q[1], q[2], [nx, 0, nz]); m.triangle(q[0], q[2], q[3], [nx, 0, nz]);
      }
      R(OS.AVANT_BRAS_D, T.ACCESSOIRE, P.PARAPLUIE, M.TOILE);
      const n8 = fin ? 16 : 8, anneaux = fin ? 3 : 1, R0 = .54;
      for (const signe of [1, -1]) {
        const centre = m.sommet([0, h + .17, 0], [0, signe, 0]), lignes = [];
        for (let j = 1; j <= anneaux; j++) {
          const k = j / anneaux, ligne = [];
          for (let i = 0; i <= n8; i++) {
            const a = i / n8 * Math.PI * 2, festons = fin ? 1 - .05 * (1 - Math.cos(a * 8)) * k : 1, rr = R0 * k * festons, y = h + .17 * (1 - k * k) - .03 * k;
            ligne.push(m.sommet([Math.cos(a) * rr, y, Math.sin(a) * rr], unite([Math.cos(a) * k * .6 * signe, signe, Math.sin(a) * k * .6 * signe])));
          }
          lignes.push(ligne);
        }
        for (let i = 0; i < n8; i++) m.triangle(centre, lignes[0][i], lignes[0][i + 1], [0, signe, 0]);
        for (let j = 0; j + 1 < anneaux; j++) for (let i = 0; i < n8; i++) {
          m.triangle(lignes[j][i], lignes[j + 1][i], lignes[j + 1][i + 1], [0, signe, 0]);
          m.triangle(lignes[j][i], lignes[j + 1][i + 1], lignes[j][i + 1], [0, signe, 0]);
        }
      }
    }
    // Drapeau : hampe dans la main gauche, toile au bout ; le poids libre (même os) mesure l'éloignement de la hampe.
    {
      const x = -.26, z = .02, e = .007;
      R(OS.AVANT_BRAS_G, T.METAL, P.DRAPEAU, M.METAL);
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const tx = -nz, tz = nx, q = [[-1, .885], [1, .885], [1, .125], [-1, .125]].map(([s, y]) => m.sommet([x + nx * e + tx * e * s, y, z + nz * e + tz * e * s], [nx, 0, nz]));
        m.triangle(q[0], q[1], q[2], [nx, 0, nz]); m.triangle(q[0], q[2], q[3], [nx, 0, nz]);
      }
      R(OS.AVANT_BRAS_G, T.ACCESSOIRE, P.DRAPEAU, M.TOILE);
      const nu = fin ? 6 : 2, nh = fin ? 3 : 1, L = .40, Hh = .27;
      for (const signe of [1, -1]) {
        const s = [];
        for (let j = 0; j <= nh; j++) for (let i = 0; i <= nu; i++) s.push(m.sommet([x - i / nu * L, .125 + Hh * j / nh, z], [0, 0, signe], OS.AVANT_BRAS_G, i / nu));
        for (let j = 0; j < nh; j++) for (let i = 0; i < nu; i++) {
          const a = j * (nu + 1) + i;
          m.triangle(s[a], s[a + 1], s[a + nu + 2], [0, 0, signe]); m.triangle(s[a], s[a + nu + 2], s[a + nu + 1], [0, 0, signe]);
        }
      }
    }
    // Écharpe : un tour de cou épais et un pan sur la poitrine.
    {
      R(OS.TORSE, T.ACCESSOIRE, P.ECHARPE, M.LAINE);
      const n1 = fin ? 14 : 7, n2 = fin ? 6 : 3, s = [];
      for (let j = 0; j <= n2; j++) for (let i = 0; i <= n1; i++) {
        const a = i / n1 * Math.PI * 2, b = j / n2 * Math.PI * 2, rr = .030;
        s.push(m.sommet([Math.cos(a) * (.079 + rr * Math.cos(b)), 1.492 + rr * Math.sin(b) * 1.1, .004 + Math.sin(a) * (.068 + rr * Math.cos(b))], unite([Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)])));
      }
      for (let j = 0; j < n2; j++) for (let i = 0; i < n1; i++) {
        const a = j * (n1 + 1) + i, mi = (i + .5) / n1 * Math.PI * 2, mj = (j + .5) / n2 * Math.PI * 2;
        const v = [Math.cos(mi) * Math.cos(mj), Math.sin(mj), Math.sin(mi) * Math.cos(mj)];
        m.triangle(s[a], s[a + 1], s[a + n1 + 2], v); m.triangle(s[a], s[a + n1 + 2], s[a + n1 + 1], v);
      }
      const pan = [[.035, 1.48, .095], [.085, 1.48, .09], [.08, 1.27, .158], [.03, 1.27, .163]];
      for (const signe of [1, -1]) {
        const q = pan.map(p => m.sommet([p[0], p[1], p[2] + (signe > 0 ? .006 : 0)], unite([0, .3, signe])));
        m.triangle(q[0], q[1], q[2], [0, .3, signe]); m.triangle(q[0], q[2], q[3], [0, .3, signe]);
      }
    }
    if (fin) {
      // Lunettes de soleil ; yeux et sourcils aux places d'EMPRISE (human-data.js) ; moustache.
      R(OS.TETE, T.SOMBRE, P.LUNETTES, M.VERRE);
      for (const oeil of emp.yeux) ellipsoide(m, [oeil[0] * 1.04, oeil[1] + .001, oeil[2] + .016], [.019, .0135, .005], 10, 5);
      R(OS.TETE, T.SOMBRE, P.LUNETTES, M.METAL);
      ellipsoide(m, [0, 1.707, .095], [.012, .0025, .003], 6, 3);
      for (const oeil of emp.yeux) {
        R(OS.TETE, T.BLANC, P.YEUX, M.OEIL); ellipsoide(m, oeil, [.0095, .0055, .0045], 8, 5);
        R(OS.TETE, T.SOMBRE, P.YEUX, M.OEIL); ellipsoide(m, [oeil[0], oeil[1] - .0005, oeil[2] + .0045], [.0035, .0035, .0018], 6, 4);
      }
      R(OS.TETE, T.CHEVEUX, P.YEUX, M.CHEVEUX);
      for (const s of emp.sourcils) ellipsoide(m, s, [.016, .0028, .0035], 8, 3);
      R(OS.TETE, T.CHEVEUX, P.MOUSTACHE, M.CHEVEUX);
      ellipsoide(m, [0, 1.637, .094], [.029, .0065, .009], 10, 4);
    }
  }

  /** Silhouette articulée du lointain : pavés effilés sur les mêmes os, aux couleurs du spectateur. */
  function silhouette(m) {
    const T = TEINTE;
    const poser = (os, teinte, c, y0, y1, bas, haut, noms) => {
      for (const nom of noms) {
        const [n, t] = Array.isArray(nom) ? nom : [nom, teinte];
        m.regler(os, t, PARTIE.CORPS, MATIERE.TISSU); face(m, c, y0, y1, bas, haut, n);
      }
    };
    const tour = ['avant', 'arriere', 'gauche', 'droite'];
    poser(OS.TETE, T.PEAU, [0, 0, .008], 1.55, 1.82, [.072, .088], [.078, .09], ['avant', 'gauche', 'droite', ['arriere', T.TETE_LOIN], ['dessus', T.TETE_LOIN]]);
    poser(OS.TORSE, T.HAUT, [0, 0, 0], 1.04, 1.50, [.17, .115], [.215, .105], [...tour, 'dessus']);
    poser(OS.TORSE, T.BAS, [0, 0, 0], .87, 1.04, [.165, .112], [.17, .115], [...tour, 'dessous']);
    for (const side of [-1, 1]) {
      const d = side > 0;
      poser(d ? OS.BRAS_D : OS.BRAS_G, T.HAUT, [side * .245, 0, 0], 1.19, 1.47, [.048, .055], [.055, .06], tour);
      poser(d ? OS.AVANT_BRAS_D : OS.AVANT_BRAS_G, T.HAUT, [side * .257, 0, .012], .86, 1.20, [.042, .045], [.047, .05], [...tour, ['dessous', T.PEAU]]);
      poser(d ? OS.CUISSE_D : OS.CUISSE_G, T.BAS, [side * .105, 0, 0], .52, .98, [.075, .085], [.1, .11], tour);
      poser(d ? OS.TIBIA_D : OS.TIBIA_G, T.BAS, [side * .105, 0, .01], .07, .53, [.058, .07], [.075, .085], tour);
      poser(d ? OS.PIED_D : OS.PIED_G, T.CHAUSSURES, [side * .105, 0, .045], .005, .075, [.055, .11], [.05, .09], ['avant', 'gauche', 'droite', 'dessus', 'arriere']);
    }
    // Parapluie et drapeau du lointain : une toile octogonale et un fanion, aux mêmes points d'accroche.
    m.regler(OS.AVANT_BRAS_D, T.ACCESSOIRE, PARTIE.PARAPLUIE, MATIERE.TOILE);
    for (const signe of [1, -1]) {
      const centre = m.sommet([0, .97, 0], [0, signe, 0]), tourT = [];
      for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI * 2; tourT.push(m.sommet([Math.cos(a) * .54, .78, Math.sin(a) * .54], unite([Math.cos(a) * .5 * signe, signe, Math.sin(a) * .5 * signe]))); }
      for (let i = 0; i < 8; i++) m.triangle(centre, tourT[i], tourT[i + 1], [0, signe, 0]);
    }
    m.regler(OS.AVANT_BRAS_G, T.ACCESSOIRE, PARTIE.DRAPEAU, MATIERE.TOILE);
    for (const signe of [1, -1]) {
      const s = [[-.26, .125, 0], [-.66, .125, 1], [-.66, .395, 1], [-.26, .395, 0]].map(q => m.sommet([q[0], q[1], .02], [0, 0, signe], OS.AVANT_BRAS_G, q[2]));
      m.triangle(s[0], s[1], s[2], [0, 0, signe]); m.triangle(s[0], s[2], s[3], [0, 0, signe]);
    }
  }

  let MAILLAGES = null;
  /** Les trois niveaux dans un seul tampon : sommets entrelacés (36 octets), indices 32 bits, plage de chaque niveau. */
  function maillages() {
    if (MAILLAGES) return MAILLAGES;
    const m = constructeur(), niveaux = [];
    for (let n = 0; n < NIVEAUX; n++) {
      const premier = m.idx.length, base = m.sommets;
      if (n < 2) {
        const emp = corpsEmprise(RESOLUTIONS[n]);
        verser(m, emp.corps); verser(m, emp.tete); accessoires(m, n, emp);
      } else silhouette(m);
      niveaux.push(Object.freeze({ niveau: n, premier, compte: m.idx.length - premier, sommets: m.sommets - base }));
    }
    const nb = m.sommets, tampon = new ArrayBuffer(nb * SOMMET), fl = new Float32Array(tampon), u8 = new Uint8Array(tampon);
    for (let i = 0; i < nb; i++) {
      for (let k = 0; k < 8; k++) fl[i * 9 + k] = m.f[i * 8 + k];
      for (let k = 0; k < 4; k++) u8[i * SOMMET + 32 + k] = m.b[i * 4 + k];
    }
    // Triangles de chaque niveau par partie : le budget compte ce qui se dessine pour un spectateur donné.
    const parPartie = niveaux.map(nv => { const t = new Array(32).fill(0); for (let k = nv.premier; k < nv.premier + nv.compte; k += 3) t[m.b[m.idx[k] * 4 + 2]]++; return Object.freeze(t); });
    MAILLAGES = Object.freeze({ sommets: tampon, nombre: nb, indices: Uint32Array.from(m.idx), niveaux: Object.freeze(niveaux), parPartie: Object.freeze(parPartie) });
    return MAILLAGES;
  }
  /** Triangles dessinés pour un spectateur au niveau n, selon son masque de parties (ce que compte le budget). */
  function trianglesDe(n, masque) {
    const t = maillages().parPartie[n];
    let s = 0;
    for (let p = 0; p < 32; p++) if (p === PARTIE.CORPS || (masque >>> p) & 1) s += t[p];
    return s;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Description des gradins construits ou du plan d'implantation partagé pour les aperçus.
  // ---------------------------------------------------------------------------------------------------------------

  /** Même plan que les lots proches et lointains, y compris pour un aperçu sans décor construit. */
  function decrireGradins(c) {
    return B.decor.planGradins(c).gradins;
  }

  // Palettes (couleurs linéaires du moteur). Peaux : EMPRISE human.js ; cheveux : FERRO crowd.js ; le reste dit
  // une tribune de course : beaucoup de blanc, de bleu et de rouge, des teintes plus sombres l'hiver.
  const PEAUX = [[.28, .17, .12], [.37, .23, .16], [.45, .29, .20], [.51, .34, .23], [.60, .41, .29], [.66, .46, .32], [.79, .60, .46], [.87, .70, .57]];
  const CHEVEUX = [[.035, .03, .026], [.10, .065, .04], [.22, .14, .08], [.36, .25, .14], [.62, .50, .29], [.42, .17, .07], [.42, .41, .39], [.74, .73, .70]];
  const CHAUSSURES = [[.05, .05, .055], [.24, .15, .08], [.80, .79, .76], [.10, .12, .20]];
  const HAUTS_ETE = [[.86, .85, .82], [.80, .10, .08], [.90, .72, .12], [.12, .22, .52], [.30, .55, .80], [.92, .48, .12], [.16, .45, .26], [.88, .62, .60], [.62, .44, .70], [.84, .78, .58], [.12, .48, .52], [.70, .16, .30], [.95, .93, .86], [.45, .30, .16], [.20, .20, .22], [.55, .70, .35]];
  const HAUTS_FROID = [[.20, .20, .22], [.12, .16, .30], [.42, .28, .16], [.30, .32, .26], [.55, .12, .10], [.62, .55, .40], [.38, .38, .40], [.16, .30, .22], [.58, .38, .14], [.10, .10, .11], [.70, .66, .58], [.40, .12, .18]];
  const BAS = [[.17, .23, .37], [.23, .31, .47], [.12, .15, .26], [.62, .55, .42], [.34, .24, .16], [.36, .36, .38], [.09, .09, .10], [.30, .30, .20], [.80, .78, .72], [.20, .27, .42]];
  const COIFFES = [[.80, .10, .08], [.92, .90, .86], [.10, .14, .32], [.90, .74, .12], [.08, .08, .09], [.14, .42, .24], [.85, .40, .10], [.30, .52, .80]];
  const PAILLE = [[.80, .68, .40], [.74, .60, .34], [.86, .76, .50]];
  const LAINES = [[.70, .10, .10], [.12, .16, .34], [.38, .38, .40], [.16, .36, .22], [.86, .84, .80], [.55, .30, .10], [.45, .12, .30]];
  const PARAPLUIES = [[.06, .06, .07], [.10, .14, .34], [.78, .10, .08], [.12, .40, .22], [.90, .72, .12], [.40, .14, .40], [.85, .85, .82]];
  const DRAPEAUX = [[.85, .10, .08], [.92, .76, .10], [.10, .26, .70], [.10, .50, .26], [.92, .92, .90]];
  const BLANC_CASSE = [.90, .89, .85];
  const pack = c => ((Math.round(clamp(c[0], 0, 1) * 255) << 16) | (Math.round(clamp(c[1], 0, 1) * 255) << 8) | Math.round(clamp(c[2], 0, 1) * 255)) >>> 0;
  const tirer = (r, l) => l[Math.floor(r() * l.length) % l.length];
  const nuancer = (r, c, k) => { const f = 1 + (r() - .5) * k; return [c[0] * f, c[1] * f, c[2] * f]; };
  /** Teinte claire (luminance des couleurs linéaires) : blanc, crème, sable. */
  const clair = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2] > .6;

  /**
   * Tenue d'un spectateur : parties montrées, couleurs, traits (décodés dans le shader).
   * Bits des traits : 0-1 genre, 2-4 peau, 5-7 cheveux, 8-9 chaussures, 10 féminin, 11 manches courtes, 12 short,
   * 13 gants, 14 casquette à l'envers, 15 deux bras, 16 applaudit, 17 sautille, 18-21 motif, 22-23 abri (ABRI : 1
   * parapluie, 2 capuche, 3 sous un toit), 24-27 visage, 28-29 posture. abrite : la place est sous un toit (sousToit).
   */
  function habiller(r, saison, genre, enfant, abrite, sortie) {
    const P = PARTIE, chaud = saison === 'ete', froid = saison === 'hiver', doux = saison === 'printemps';
    const feminin = r() < .38, peau = r() < .72 ? 4 + Math.floor(r() * 4) : Math.floor(r() * 4);
    const age = enfant ? 0 : r();
    let cheveux = Math.floor(r() * 6);
    if (age > .78) cheveux = r() < .6 ? 6 : 7; else if (peau < 3 && cheveux > 2) cheveux = Math.floor(r() * 2);
    let masque = 1 << P.CORPS | 1 << P.YEUX;
    const coupe = r();
    if (feminin) masque |= coupe < .45 ? (1 << P.CHEVEUX_DESSUS | 1 << P.CHEVEUX_TOUR | 1 << P.CHEVEUX_LONGS)
      : coupe < .72 ? (1 << P.CHEVEUX_DESSUS | 1 << P.CHEVEUX_TOUR | 1 << P.QUEUE)
        : coupe < .86 ? (1 << P.VOLUME) : (1 << P.CHEVEUX_DESSUS | 1 << P.CHEVEUX_TOUR);
    else masque |= age > .62 && coupe < .45 ? (coupe < .12 ? 0 : 1 << P.CHEVEUX_TOUR)
      : coupe < .08 ? (1 << P.VOLUME) : coupe < .14 ? (1 << P.CHEVEUX_DESSUS | 1 << P.CHEVEUX_TOUR | 1 << P.CHEVEUX_LONGS)
        : (1 << P.CHEVEUX_DESSUS | 1 << P.CHEVEUX_TOUR);
    if (!feminin && !enfant && r() < .26) masque |= 1 << P.MOUSTACHE;
    // couvre-chef, selon la saison
    const tc = r();
    let coiffe = tirer(r, COIFFES), envers = false;
    const casquette = chaud ? .30 : froid ? .10 : .20, bob = chaud ? .07 : froid ? 0 : .04, paille = chaud ? .07 : 0, bonnet = froid ? .48 : saison === 'automne' ? .10 : 0;
    const sansDessus = ~(1 << P.CHEVEUX_DESSUS | 1 << P.VOLUME);
    if (tc < casquette) { masque = masque & sansDessus | 1 << P.CASQUETTE; envers = r() < .12; if (r() < .3) coiffe = BLANC_CASSE; }
    else if (tc < casquette + bob) masque = masque & sansDessus | 1 << P.BOB;
    else if (tc < casquette + bob + paille) { masque = masque & sansDessus | 1 << P.CHAPEAU; coiffe = tirer(r, PAILLE); }
    else if (tc < casquette + bob + paille + bonnet) { masque = masque & ~(1 << P.CHEVEUX_DESSUS | 1 << P.CHEVEUX_TOUR | 1 << P.VOLUME | 1 << P.QUEUE) | 1 << P.BONNET; coiffe = tirer(r, LAINES); }
    // haut, bas, motif
    const manchesCourtes = chaud ? r() < .66 : doux ? r() < .18 : false;
    const short = chaud ? r() < (feminin ? .18 : .30) : false;
    let haut = nuancer(r, tirer(r, chaud || doux ? HAUTS_ETE : HAUTS_FROID), .22);
    if (r() < .12) haut = nuancer(r, [.80, .09, .07], .12); // le rouge des monoplaces, un peu plus que les autres
    const mt = r(), motif = mt < .56 ? 0 : mt < .66 ? 1 : mt < .73 ? 2 : mt < .80 ? 3 : mt < .88 ? 4 : mt < .94 ? 5 : 6;
    const second = r() < .55 ? BLANC_CASSE : nuancer(r, tirer(r, COIFFES), .2);
    let bas = nuancer(r, tirer(r, BAS), .18);
    // blanc sur blanc : de loin, un mannequin sans couleur ; le bas passe au bleu du jean (sans tirage de plus)
    if (clair(haut) && clair(bas)) bas = [bas[0] * .26, bas[1] * .32, bas[2] * .52];
    const gants = froid && r() < .55;
    if (froid ? r() < .5 : saison === 'automne' && r() < .14) masque |= 1 << P.ECHARPE;
    if (chaud && r() < .30) masque |= 1 << P.LUNETTES;
    // pluie : au sec sous un toit (personne n'y ouvre de parapluie) ; à découvert, parapluie, capuche, ou rien (on se
    // mouille). Le tirage a lieu dans les deux cas.
    const at = r(), abri = abrite ? ABRI.TOIT : at < .46 ? ABRI.PARAPLUIE : at < .80 ? ABRI.CAPUCHE : ABRI.AUCUN;
    if (abri === 1) masque |= 1 << P.PARAPLUIE;
    if (abri === 2) masque |= 1 << P.CAPUCHE;
    const accessoire = abri === 1 ? tirer(r, PARAPLUIES) : (masque & 1 << P.ECHARPE) ? tirer(r, LAINES) : tirer(r, DRAPEAUX);
    // un drapeau pour quelques-uns, qui ne sort qu'au passage des voitures ; jamais avec un parapluie ni une écharpe
    if (abri !== 1 && !(masque & 1 << P.ECHARPE) && r() < .10) masque |= 1 << P.DRAPEAU;
    const chaussures = short && r() < .5 ? 2 : Math.floor(r() * 4);
    const deuxBras = r() < .45, applaudit = r() < .25, sautille = genre !== GENRE.ASSIS && r() < .35;
    const posture = r() < .62 ? 0 : r() < .55 ? 1 : 2;
    const visage = Math.floor(r() * 16);
    sortie.masque = masque >>> 0;
    sortie.traits = ((genre & 3) | (peau << 2) | (cheveux << 5) | (chaussures << 8) | (feminin ? 1 << 10 : 0) | (manchesCourtes ? 1 << 11 : 0)
      | (short ? 1 << 12 : 0) | (gants ? 1 << 13 : 0) | (envers ? 1 << 14 : 0) | (deuxBras ? 1 << 15 : 0) | (applaudit ? 1 << 16 : 0)
      | (sautille ? 1 << 17 : 0) | (motif << 18) | (abri << 22) | (visage << 24) | (posture << 28)) >>> 0;
    sortie.haut = pack(haut); sortie.second = pack(second); sortie.bas = pack(bas); sortie.coiffe = pack(coiffe); sortie.accessoire = pack(accessoire);
    return sortie;
  }

  /** Objets du décor qui gênent un spectateur : boîtes et cylindres des lots autour de la ligne droite. */
  function genes(decor, x0, z0, x1, z1) {
    const liste = [];
    if (!decor || !decor.lots) return liste;
    for (const lot of decor.lots) for (const o of lot.objets) {
      if (o.shape !== 'box' && o.shape !== 'cylinder') continue;
      const s = o.s || [1, 1, 1], rayon = Math.hypot(s[0], s[2]) / 2;
      if (o.p[0] + rayon < x0 || o.p[0] - rayon > x1 || o.p[2] + rayon < z0 || o.p[2] - rayon > z1) continue;
      liste.push({ x: o.p[0], z: o.p[2], ymin: o.p[1] - s[1] / 2, ymax: o.p[1] + s[1] / 2, angle: -(o.r ? o.r[1] : 0), hx: s[0] / 2, hz: s[2] / 2,
        rond: o.shape === 'cylinder', genre: o.collision || null });
    }
    return liste;
  }
  /**
   * Un disque (x, z, rayon) entre les hauteurs y0 et y1 touche-t-il un de ces objets ? Repère d'obstacles.js.
   * solides : seulement les objets qui ont une collision, hors marches et toits (le public est posé sur les marches).
   */
  function geneEntre(liste, x, z, rayon, y0, y1, solides) {
    for (const o of liste) {
      if (solides && (!o.genre || o.genre === 'gradin' || o.genre === 'toit')) continue;
      if (o.ymax < y0 || o.ymin > y1) continue;
      const dx = x - o.x, dz = z - o.z;
      if (o.rond) { if (Math.hypot(dx, dz) < o.hx + rayon) return true; continue; }
      const ca = Math.cos(o.angle), sa = Math.sin(o.angle), lx = dx * ca + dz * sa, lz = -dx * sa + dz * ca;
      if (Math.abs(lx) < o.hx + rayon && Math.abs(lz) < o.hz + rayon) return true;
    }
    return false;
  }
  /** Debout derrière une glissière : un disque entre y + 0,1 et y + 1,9 m, contre tous les objets. */
  const gene = (liste, x, y, z, rayon) => geneEntre(liste, x, z, rayon, y + .1, y + 1.9, false);
  /**
   * À l'abri d'un toit : la tête (x, yTete, z) est sous un toit du décor, assez loin de ses bords pour que la pluie
   * poussée par le vent (PENTE_PLUIE) ne l'atteigne pas. Sous le toit des tribunes (7,25 m), le premier rang et les
   * bouts de rangée restent exposés ; les glissières sont à découvert.
   */
  function sousToit(toits, x, yTete, z) {
    for (const o of toits) {
      if (o.ymin < yTete + .3) continue;
      const marge = (o.ymin - yTete) * PENTE_PLUIE, dx = x - o.x, dz = z - o.z;
      const ca = Math.cos(o.angle), sa = Math.sin(o.angle), lx = dx * ca + dz * sa, lz = -dx * sa + dz * ca;
      if (Math.abs(lx) <= o.hx - marge && Math.abs(lz) <= o.hz - marge) return true;
    }
    return false;
  }
  /** Facteur q tel que l'espérance du nombre retenu, Σ min(1, q·poids), vaille « voulu » (bissection, sans hasard). */
  function proportion(poids, voulu) {
    let total = 0; for (const p of poids) total += p > 0 ? 1 : 0;
    if (voulu >= total) return Infinity;
    let a = 0, b = 64;
    for (let k = 0; k < 40; k++) {
      const m = (a + b) / 2; let e = 0;
      for (const p of poids) e += Math.min(1, m * p);
      if (e < voulu) a = m; else b = m;
    }
    return (a + b) / 2;
  }

  /**
   * Génère les spectateurs. options : { qualite, saison, graine, cible (nombre voulu), sol(x, z) }.
   * Rend la scène du public : tableaux typés et quelques nombres ; rien n'est alloué ensuite en course.
   */
  function creer(c, decor, options = {}) {
    const gradins = (decor && decor.gradins) || decrireGradins(c);
    const palier = palierDe(options.qualite || 'high');
    const saison = options.saison || (decor && decor.saison && decor.saison.id) || 'ete';
    const sol = options.sol || (decor && typeof decor.sol === 'function' ? decor.sol : null);
    const limites = (decor && decor.limites) || B.decor.limites(c);
    // La graine : celle du circuit mêlée d'une constante du public. Ni Math.random ni le hasard du décor.
    const graine = (options.graine ?? (Math.imul((c.graine >>> 0) + 1, 0x9E3779B1) ^ 0x5EC7A7E5)) >>> 0;
    const cible = Math.min(MAX_SPECTATEURS, Math.max(0, Math.round(options.cible ?? palier.cible)));
    const w = c.largeur / 2, enceinte = gradins.enceinte || { debut: -200, fin: 200 }, D = B.decor;
    const s0 = enceinte.debut, nSections = clamp(Math.ceil((enceinte.fin - enceinte.debut) / LONG_SECTION), 1, SECTIONS);
    // Objets du décor autour de la ligne droite : personne ne s'assoit ni ne se tient dans l'un d'eux.
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let s = enceinte.debut; s <= enceinte.fin; s += 8) { const f = D.cadre(c, Math.round(s / c.pas)); x0 = Math.min(x0, f.x); x1 = Math.max(x1, f.x); z0 = Math.min(z0, f.z); z1 = Math.max(z1, f.z); }
    const objets = genes(decor, x0 - 40, z0 - 40, x1 + 40, z1 + 40), toits = objets.filter(o => o.genre === 'toit' && !o.rond);

    // ---- 1. Places candidates dans les tribunes : au bord de chaque marche, en grappes (on vient à plusieurs).
    const places = [];
    gradins.tribunes.forEach((t, it) => {
      const r = alea(hache(graine ^ (0xA511E9B3 + it * 0x632BE5AB)));
      const tx = Math.cos(t.a), tz = Math.sin(t.a), rx = -Math.sin(t.a), rz = Math.cos(t.a);
      // les solides près de cette tribune (piliers, poteaux, murets d'un autre élément du décor)
      const portee = Math.hypot(t.longueur / 2, Math.abs(t.recul) + t.marches * t.profondeur + 1) + 2;
      const solides = objets.filter(o => o.genre && o.genre !== 'gradin' && o.genre !== 'toit' && Math.hypot(o.x - t.x, o.z - t.z) < portee + Math.hypot(o.hx, o.hz));
      const fx = -t.cote * rx, fz = -t.cote * rz, cap = Math.atan2(fx, fz);    // face à la piste
      const tribuneP = 1.25 - .5 * Math.min(1, Math.abs(t.s) / 250);         // plus de monde près de la ligne
      // Premier rang : les jambes pendent jusqu'au pied de la tribune ; si le sol devant est plus haut, on ne s'y
      // assoit pas (les pieds seraient dans la terre).
      const devant0 = sol ? sol(t.x + rx * (t.recul - t.cote * .35), t.z + rz * (t.recul - t.cote * .35)) : t.y;
      const premier = devant0 <= t.y + .04 ? 0 : 1;
      const phase1 = r() * 40, phase2 = r() * 40;
      for (let m = premier; m < t.marches; m++) {
        const bordD = t.recul + t.cote * m * t.profondeur, haut = (m + 1) * t.haut;
        const rang = .8 + .4 * Math.sin(Math.PI * (m + .5) / t.marches);    // les rangs du milieu, un peu plus pleins
        let k = -t.longueur / 2 + .32 + r() * .2;
        while (k < t.longueur / 2 - .3) {
          const grappe = Math.max(0, 1 + 1.15 * Math.sin(k * .55 + phase1 + m * 1.7) * Math.sin(k * .21 + phase2 - m * .9));
          const r1 = r(), enfant = r() < .055, debout = m === t.marches - 1 && r() < .35 * palier.debout;
          const pas = (enfant ? .44 : .50) + r() * .12, kk = k + (r() - .5) * .06;
          const d = debout ? bordD + t.cote * (.55 + r() * .3) : bordD + t.cote * (.13 + r() * .04), dc = r(), hR = r(), lR = r();
          // au premier rang, les genoux passeraient dans les piliers du toit (decor.js : tous les 12 m, devant la tribune)
          const u = ((kk + t.longueur / 2) % 12 + 12) % 12, pilier = m === 0 && Math.min(u, 12 - u) < .42;
          const x = t.x + rx * d + tx * kk, z = t.z + rz * d + tz * kk, y = debout ? t.y + haut : t.y + haut + .10, cp = cap + (dc - .5) * .22;
          // ni le corps ni, assis, les genoux dans un solide du décor (un poteau planté dans les gradins, par exemple)
          const genou = .44 * (enfant ? .78 : 1) * .9;
          const libre = !pilier && !geneEntre(solides, x, z, .2, y + .05, y + (debout ? 1.8 : .9), true)
            && (debout || !geneEntre(solides, x + Math.sin(cp) * genou, z + Math.cos(cp) * genou, .2, y - .5, y + .15, true));
          if (libre) places.push({ poids: grappe * rang * tribuneP, r1, enfant, debout, x, z, y, chute: t.haut + .10, cap: cp, s: t.s + kk, hR, lR,
            abrite: sousToit(toits, x, y + (debout ? 1.6 : .85), z) });
          k += pas;
        }
      }
    });
    // ---- 2. Candidats debout derrière les glissières, hors des tribunes et des stands, loin des objets du décor.
    const rails = [];
    if (palier.debout > 0 && limites) {
      const r = alea(hache(graine ^ 0x6C1A55E7));
      const pris = (s, cote) => cote < 0 ? gradins.tribunes.some(t => Math.abs(s - t.s) < t.longueur / 2 + 1.5)
        : gradins.stands.some(t => Math.abs(s - t.s) < t.longueur / 2 + 2);
      for (const cote of [-1, 1]) {
        const phase = r() * 50;
        for (let s = enceinte.debut + r() * 2; s < enceinte.fin; s += .52 + r() * .3) {
          const grappe = Math.max(0, Math.sin(s * .12 + phase) * 1.3 + Math.sin(s * .047 + phase * 2) * .6);
          const rangs = r() < .4 ? 2 : 1;
          for (let k = 0; k < rangs; k++) {
            const r1 = r(), dl = r(), dt = r(), dc = r(), enfant = r() < .06, hR = r(), lR = r();
            if (grappe <= 0 || pris(s, cote)) continue;
            const f = D.cadre(c, Math.round(s / c.pas)), L = (cote < 0 ? limites.G : limites.D)[f.i];
            const d = cote * (L + .75 + k * .62 + dl * .2), lon = (dt - .5) * .2;
            if (c.stands && B.circuit.empriseStands(c,s,d,1)) continue;
            const x = f.x + f.r[0] * d + f.t[0] * lon, z = f.z + f.r[2] * d + f.t[2] * lon;
            const y = sol ? sol(x, z) : D.hauteurRoute(f, cote * w, w);
            if (gene(objets, x, y, z, .32)) continue;
            rails.push({ poids: grappe * (k ? .6 : 1), r1, enfant, x, y, z, cap: Math.atan2(-cote * f.r[0], -cote * f.r[2]) + (dc - .5) * .5, s, hR, lR,
              abrite: sousToit(toits, x, y + 1.6, z) });
          }
        }
      }
    }
    // ---- 3. Choix : autant de spectateurs que la cible du palier, quel que soit le nombre de tribunes du circuit.
    const voulusRails = Math.min(rails.length, Math.round(cible * palier.glissieres));
    const voulusPlaces = Math.max(0, cible - voulusRails);
    const qP = proportion(places.map(p => p.poids), voulusPlaces), qR = proportion(rails.map(p => p.poids), voulusRails);
    const retenus = [];
    for (const p of places) if (p.poids > 0 && p.r1 < Math.min(1, qP * p.poids)) retenus.push([p, p.debout ? GENRE.DEBOUT : GENRE.ASSIS]);
    for (const p of rails) if (p.poids > 0 && p.r1 < Math.min(1, qR * p.poids)) retenus.push([p, GENRE.GLISSIERE]);
    retenus.length = Math.min(retenus.length, MAX_SPECTATEURS);

    // ---- 4. Tenues et textures : deux texels par spectateur. Flottants : position et cap ; avance, chute, taille,
    // carrure. Entiers : graine, masque, traits, section et seconde couleur ; haut, bas, couvre-chef, accessoire.
    const n = retenus.length, lignes = Math.max(1, Math.ceil(n * 2 / LARGEUR_TEX));
    const flottants = new Float32Array(lignes * LARGEUR_TEX * 4), entiers = new Uint32Array(lignes * LARGEUR_TEX * 4), cpu = new Float32Array(Math.max(1, n) * 4);
    const habit = {}, compte = { assis: 0, debout: 0, glissiere: 0, enfants: 0, abrites: 0 };
    retenus.forEach(([p, genre], i) => {
      const g = hache(graine ^ Math.imul(i + 1, 0x27D4EB2F)) >>> 0;
      habiller(alea(g ^ 0x3C6EF372), saison, genre, p.enfant, p.abrite, habit);
      if (p.abrite) compte.abrites++;
      const hauteur = p.enfant ? .62 + p.hR * .14 : .93 + p.hR * .14, largeur = p.enfant ? .74 + p.lR * .1 : .9 + p.lR * .24;
      const assis = genre === GENRE.ASSIS, section = clamp(Math.floor((p.s - s0) / LONG_SECTION), 0, nSections - 1);
      flottants.set([p.x, p.y, p.z, p.cap, assis ? .44 * (p.enfant ? .78 : 1) : 0, assis ? p.chute : 0, hauteur, largeur], i * 8);
      entiers.set([g, habit.masque, habit.traits, (section | (habit.second << 8)) >>> 0, habit.haut, habit.bas, habit.coiffe, habit.accessoire], i * 8);
      // pour la liste du processeur : centre du corps, et le tirage de présence (indépendant de la tenue et de la pose)
      cpu.set([p.x, p.y + (assis ? .35 : .9), p.z, hache(g ^ 0x7F4A7C15) / 4294967296], i * 4);
      compte[genre === GENRE.ASSIS ? 'assis' : genre === GENRE.DEBOUT ? 'debout' : 'glissiere']++;
      if (p.enfant) compte.enfants++;
    });
    // Points de référence des sections : l'axe de la piste au milieu de chaque tronçon de 16 m.
    const sections = new Float32Array(nSections * 4);
    for (let k = 0; k < nSections; k++) {
      const s = s0 + (k + .5) * LONG_SECTION, f = D.cadre(c, Math.round(s / c.pas));
      sections[k * 4] = f.x; sections[k * 4 + 1] = f.y + 1; sections[k * 4 + 2] = f.z; sections[k * 4 + 3] = s;
    }
    return {
      n, qualite: palier.nom, palier, saison, graine, cible, nSections, lignes, flottants, entiers, cpu, sections, gradins,
      volumes: bornerPublic(cpu, n),
      candidats: { places: places.length, rails: rails.length }, compte,
      etat: { s1: new Float32Array(SECTIONS * 4), s2: new Float32Array(SECTIONS * 4), temps: 0, tPrec: -1, couverture: 0, mouille: 0,
        fete: 0, departVu: false, arriveeVu: false, tDepart: -1e9, tArrivee: -1e9, presence: 1, version: 0, seance: 0 },
    };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Animation des sections (processeur, sans allocation, indépendante de la cadence)
  // ---------------------------------------------------------------------------------------------------------------

  /** Réglages de séance : présence (0 à 1), fixée au départ d'après la météo choisie ; les absents ne viennent pas. */
  function regler(pub, o = {}) {
    if (!pub) return;
    if (Number.isFinite(o.presence)) pub.etat.presence = clamp(o.presence, 0, 1);
  }
  /** Présence d'après la séance : on vient moins nombreux sous la pluie, en hiver et la nuit. */
  function presencePour(meteo, saison, nuit) {
    let p = meteo === 'pluie' ? .62 : meteo === 'variable' ? .86 : 1;
    if (saison === 'hiver') p *= .82;
    if (nuit) p *= .9;
    return p;
  }
  /** Nouvelle séance : l'animation repart de zéro (regard, excitation, départ et arrivée). */
  function reinitialiser(pub) {
    if (!pub) return;
    const E = pub.etat;
    E.seance++; E.s1.fill(0); E.s2.fill(0); E.tPrec = -1; E.version = 0; E.fete = 0; E.departVu = E.arriveeVu = false; E.tDepart = E.tArrivee = -1e9;
  }
  /**
   * Une image : temps (s, horloge visuelle), voitures (tableau d'objets { x, y, z }) et leur nombre, ambiance
   * { pluie, neige, mouille, feux (0 à 5 allumés), vert (départ donné), termine (arrivée) }.
   */
  function animer(pub, temps, voitures, n, ambiance) {
    if (!pub) return;
    const E = pub.etat, s1 = E.s1, s2 = E.s2, sec = pub.sections, a = ambiance || {};
    const dt = E.tPrec < 0 ? 0 : clamp(temps - E.tPrec, 0, .25);
    E.tPrec = temps; E.temps = temps;
    // Départ et arrivée : l'heure du signal, puis une fête qui décroît avec le temps, pas avec les images.
    if (a.vert && !E.departVu) { E.departVu = true; E.tDepart = temps; }
    if (!a.vert && !a.termine) E.departVu = false;
    if (a.termine && !E.arriveeVu) { E.arriveeVu = true; E.tArrivee = temps; }
    if (!a.termine) E.arriveeVu = false;
    const attente = a.vert || a.termine ? 0 : .22 + .07 * clamp(a.feux || 0, 0, 5);
    const fete = Math.max(attente, a.vert ? Math.exp(-(temps - E.tDepart) / 5) : 0, a.termine ? Math.exp(-Math.max(0, temps - E.tArrivee - 6) / 8) : 0);
    E.fete = fete;
    // Lissages exacts (exponentielle du temps écoulé) : la première image prend l'état d'emblée ; un second appel
    // dans la même image (écran partagé : une vue par joueur) ne change rien.
    const premier = E.version === 0;
    // Abris et mouillé, lissés : on n'ouvre pas tous ensemble (chacun a son seuil dans le shader).
    const couvrir = clamp(Math.max(a.pluie || 0, (a.neige || 0) * .8), 0, 1);
    E.couverture += (couvrir - E.couverture) * (premier ? 1 : -Math.expm1(-dt / 1.6));
    E.mouille = clamp(a.mouille ?? E.couverture, 0, 1);
    const ke1 = premier ? 1 : -Math.expm1(-dt / .32), ke2 = premier ? 1 : -Math.expm1(-dt / 3);
    const kr = premier ? 1 : -Math.expm1(-dt / .22), kp = premier ? 1 : -Math.expm1(-dt / .5);
    for (let k = 0; k < pub.nSections; k++) {
      const o = k * 4, cx = sec[o], cy = sec[o + 1], cz = sec[o + 2];
      // Cible du regard : les voitures proches, pondérées par le cube de leur proximité (la plus proche mène, un
      // peloton serré se suit en bloc) ; la piste en face compte un peu, pour que rien ne saute quand une voiture
      // entre dans le champ. La cible reste continue : même mouvement à toute cadence.
      let somme = 0, meilleur = 0, q = .002, bx = cx * q, by = cy * q, bz = cz * q;
      for (let j = 0; j < n; j++) {
        const v = voitures[j]; if (!v) continue;
        const dx = v.x - cx, dz = v.z - cz, distance2 = dx * dx + dz * dz;
        // Au-delà de 170 m, le poids de cette voiture est exactement nul pour la tribune.
        if (distance2 >= 170 * 170) continue;
        const p = lisse(170, 22, Math.sqrt(distance2)), p3 = p * p * p;
        somme += p; if (p > meilleur) meilleur = p;
        q += p3; bx += v.x * p3; by += (v.y + .5) * p3; bz += v.z * p3;
      }
      bx /= q; by /= q; bz /= q;
      // Monter vite (un tiers de seconde), retomber lentement (trois secondes) : exact quelle que soit la cadence.
      const cible = clamp(.62 * somme, 0, 1), e = s1[o + 3];
      s1[o + 3] = premier ? cible : e + (cible - e) * (cible > e ? ke1 : ke2);
      // Regard lissé (un quart de seconde) ; son poids suit la proximité de la voiture la plus proche.
      if (premier) { s1[o] = bx; s1[o + 1] = by; s1[o + 2] = bz; }
      else { s1[o] += (bx - s1[o]) * kr; s1[o + 1] += (by - s1[o + 1]) * kr; s1[o + 2] += (bz - s1[o + 2]) * kr; }
      const poids = clamp(meilleur * 1.6, 0, 1);
      s2[o] = premier ? poids : s2[o] + (poids - s2[o]) * kp;
      s2[o + 1] = fete;
    }
    E.version++;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Liste des niveaux (processeur, sans allocation)
  // ---------------------------------------------------------------------------------------------------------------

  /** Indice d'un spectateur (16 bits) et son intervalle de trame [bas, haut) sur 8 bits chacun. */
  const coder = (i, bas, haut) => (i | (Math.round(bas * 255) << 16) | (Math.round(haut * 255) << 24)) >>> 0;

  // L'indice des sièges suit les rangées. Un volume global puis une sphère par suite
  // de 32 indices permettent d’écarter des gradins entiers sans permuter la liste GPU.
  const PLACES_PAR_VOLUME = 32;
  function bornerPublic(cpu, n) {
    const volumes = new Float64Array((1 + Math.ceil(n / PLACES_PAR_VOLUME)) * 4);
    function borner(o, debut, fin) {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let i = debut; i < fin; i++) {
        const j = i * 4, x = cpu[j], y = cpu[j + 1], z = cpu[j + 2];
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z);
        x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z);
      }
      volumes[o] = (x0 + x1) / 2; volumes[o + 1] = (y0 + y1) / 2; volumes[o + 2] = (z0 + z1) / 2;
      volumes[o + 3] = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + .001;
    }
    if (n) borner(0, 0, n);
    for (let i = 0, o = 4; i < n; i += PLACES_PAR_VOLUME, o += 4) borner(o, i, Math.min(i + PLACES_PAR_VOLUME, n));
    return volumes;
  }

  function horsChamp(volumes, o, oeil, avant, droite, haut, cadrage, normes) {
    const x = volumes[o] - oeil[0], y = volumes[o + 1] - oeil[1], z = volumes[o + 2] - oeil[2], rayon = volumes[o + 3];
    const profMax = x * avant[0] + y * avant[1] + z * avant[2] + rayon * normes[0];
    if (profMax < -1.2) return true;
    const p = Math.max(profMax, .05);
    return Math.abs(x * droite[0] + y * droite[1] + z * droite[2]) > p * cadrage[0] + 1.4 + rayon * normes[1]
      || Math.abs(x * haut[0] + y * haut[1] + z * haut[2]) > p * cadrage[1] + 1.6 + rayon * normes[2];
  }

  // Lorsque même le siège le plus proche est sous le premier seuil de fondu et que
  // toute l’enceinte tient dans le cadre, la liste des silhouettes dépend uniquement de la présence.
  function tribuneLointaine(volumes, oeil, avant, droite, haut, cadrage, normes, seuil) {
    const x = volumes[0] - oeil[0], y = volumes[1] - oeil[1], z = volumes[2] - oeil[2], rayon = volumes[3];
    const profMin = x * avant[0] + y * avant[1] + z * avant[2] - rayon * normes[0];
    if (profMin <= .05 || Math.fround(1.7 * cadrage[2] / profMin) >= seuil) return false;
    return Math.abs(x * droite[0] + y * droite[1] + z * droite[2]) + rayon * normes[1] < profMin * cadrage[0] + 1.4
      && Math.abs(x * haut[0] + y * haut[1] + z * haut[2]) + rayon * normes[2] < profMin * cadrage[1] + 1.6;
  }

  function horsOmbre(volumes, o, centre, direction, norme, rayon) {
    const x = volumes[o] - centre[0], y = volumes[o + 1] - centre[1], z = volumes[o + 2] - centre[2];
    const le = (x * direction[0] + y * direction[1] + z * direction[2]) / norme;
    const marge = rayon + volumes[o + 3];
    return x * x + y * y + z * z - le * le > marge * marge;
  }

  function creerListe(pub) {
    const n = pub.n, liste = new Uint32Array(Math.max(1, n * 2)), debut = new Int32Array(NIVEAUX), compte = new Int32Array(NIVEAUX);
    const tailles = new Float32Array(Math.max(1, n)), vus = new Int32Array(Math.max(1, n)), histo = new Int32Array(64), bandes = new Float64Array(4);
    const resultat = { liste, debut, compte, total: 0, vus: 0, bandes, plafonne: 0, presenceLointaine: null };
    const cpu = pub.cpu, volumes = pub.volumes || bornerPublic(cpu, n), normes = new Float64Array(3);
    const ls = (a, b, x) => { if (!(b > a)) return x >= b ? 1 : 0; const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
    /**
     * Classe de taille (histogramme logarithmique en huitièmes d'octave, sans tri) au-dessus de laquelle restent au
     * plus « plafond » instances : le seuil relevé vaut seuil × 2^(classe/8), 0 si le plafond n'est pas atteint.
     * Le seuil est lu dans bandes[b] et le résultat est un entier : un flottant passé à une fonction non incorporée,
     * ou rendu par elle, serait alloué à chaque image.
     */
    function classePlafond(nv, b, plafond) {
      const seuil = bandes[b];
      histo.fill(0); let k = 0;
      for (let j = 0; j < nv; j++) { const t = tailles[j]; if (t < seuil) continue; k++; histo[Math.min(63, (Math.log2(t / seuil) * 8) | 0)]++; }
      if (k <= plafond) return 0;
      let acc = 0, c = 63;
      while (c >= 0 && acc + histo[c] <= plafond) { acc += histo[c]; c--; }
      resultat.plafonne++;
      return c + 1;
    }
    /**
     * Vue de la couleur : œil, axes (avant, droite, haut), cadrage [tangente horizontale du demi-champ, tangente
     * verticale, focale en pixels, présence], reglage { bande0, bande1, plafond0, plafond1, niveauMin }. Range les
     * visibles par niveau avec leur part de trame. Les nombres arrivent dans un tableau : un flottant passé en
     * argument à une fonction non incorporée serait alloué à chaque image.
     */
    function lister(oeil, avant, droite, haut, cadrage, reglage) {
      const tanH = cadrage[0], tanV = cadrage[1], focale = cadrage[2], presence = cadrage[3];
      const ex = oeil[0], ey = oeil[1], ez = oeil[2], f0 = avant[0], f1 = avant[1], f2 = avant[2];
      const r0 = droite[0], r1 = droite[1], r2 = droite[2], u0 = haut[0], u1 = haut[1], u2 = haut[2];
      let nv = 0;
      resultat.plafonne = 0;
      normes[0] = Math.sqrt(f0*f0 + f1*f1 + f2*f2);
      normes[1] = Math.sqrt(r0*r0 + r1*r1 + r2*r2);
      normes[2] = Math.sqrt(u0*u0 + u1*u1 + u2*u2);
      // Bandes de fondu (pixels) dans un tableau de flottants : des variables mêlant entiers, Infinity et flottants
      // calculés seraient rangées en boîtes, donc allouées, à chaque image.
      const sans0 = reglage.niveauMin >= 1, sans1 = reglage.niveauMin >= 2;
      bandes[0] = sans0 ? Infinity : reglage.bande0[0]; bandes[1] = sans0 ? Infinity : reglage.bande0[1];
      bandes[2] = sans1 ? Infinity : reglage.bande1[0]; bandes[3] = sans1 ? Infinity : reglage.bande1[1];
      if (tribuneLointaine(volumes, oeil, avant, droite, haut, cadrage, normes, Math.min(bandes[0], bandes[2]))) {
        if (resultat.presenceLointaine !== presence) {
          for (let i = 0; i < n; i++) if (cpu[i * 4 + 3] < presence) liste[nv++] = coder(i, 0, 1);
          resultat.total = nv;
        }
        resultat.presenceLointaine = presence;
        debut[0] = debut[1] = debut[2] = 0;
        compte[0] = compte[1] = 0;
        compte[2] = resultat.vus = resultat.total;
        return resultat;
      }
      resultat.presenceLointaine = null;
      const finVisible = horsChamp(volumes, 0, oeil, avant, droite, haut, cadrage, normes) ? 0 : n;
      for (let debutBloc = 0, v = 4; debutBloc < finVisible; debutBloc += PLACES_PAR_VOLUME, v += 4) {
        if (horsChamp(volumes, v, oeil, avant, droite, haut, cadrage, normes)) continue;
        const finBloc = Math.min(debutBloc + PLACES_PAR_VOLUME, n);
        for (let i = debutBloc; i < finBloc; i++) {
          const o = i * 4;
          if (cpu[o + 3] >= presence) continue;
          const dx = cpu[o] - ex, dy = cpu[o + 1] - ey, dz = cpu[o + 2] - ez, prof = dx * f0 + dy * f1 + dz * f2;
          if (prof < -1.2) continue;
          const p = Math.max(prof, .05);
          // marges : un corps debout, bras levés, parapluie ouvert
          if (Math.abs(dx * r0 + dy * r1 + dz * r2) > p * tanH + 1.4 || Math.abs(dx * u0 + dy * u1 + dz * u2) > p * tanV + 1.6) continue;
          vus[nv] = i; tailles[nv] = 1.7 * focale / p; nv++;
        }
      }
      resultat.vus = nv;
      // Plafonds : au-delà, les plus petits passent au niveau suivant ; la bande de fondu suit le seuil relevé.
      if (bandes[0] < Infinity) { const c = classePlafond(nv, 0, reglage.plafond0); if (c > 0) { const k = Math.pow(2, c / 8); bandes[0] *= k; bandes[1] *= k; } }
      if (bandes[2] < Infinity) { const c = classePlafond(nv, 2, reglage.plafond1); if (c > 0) { const k = Math.pow(2, c / 8); bandes[2] *= k; bandes[3] *= k; } }
      const b00 = bandes[0], b01 = bandes[1], b10 = bandes[2], b11 = bandes[3];
      compte[0] = compte[1] = compte[2] = 0;
      for (let j = 0; j < nv; j++) {
        const t = tailles[j], c0 = ls(b00, b01, t), c1 = Math.max(c0, ls(b10, b11, t));
        if (c0 > 0) compte[0]++;
        if (c1 > c0) compte[1]++;
        if (c1 < 1) compte[2]++;
      }
      debut[0] = 0; debut[1] = compte[0]; debut[2] = compte[0] + compte[1];
      let k0 = debut[0], k1 = debut[1], k2 = debut[2];
      for (let j = 0; j < nv; j++) {
        const t = tailles[j], i = vus[j], c0 = ls(b00, b01, t), c1 = Math.max(c0, ls(b10, b11, t));
        if (c0 > 0) liste[k0++] = coder(i, 0, c0);
        if (c1 > c0) liste[k1++] = coder(i, c0, c1);
        if (c1 < 1) liste[k2++] = coder(i, c1, 1);
      }
      resultat.total = k2;
      return resultat;
    }
    /**
     * Vue du soleil : les spectateurs dont la sphère touche la boîte de l'ombre (centre, direction vers le soleil),
     * l'œil, cadrage [demi-étendue de la boîte, présence, niveau minimal, distance « proche »]. Niveau 1 à moins de
     * « proche » mètres de l'œil (si le palier l'admet), silhouettes au-delà ; sans trame.
     */
    function listerOmbre(centre, direction, oeil, cadrage) {
      resultat.presenceLointaine = null;
      const etendue = cadrage[0], presence = cadrage[1], niveauMin = cadrage[2], proche = cadrage[3];
      // Math.hypot n'est pas incorporé par l'optimiseur : son résultat serait alloué à chaque appel
      const lx = direction[0], ly = direction[1], lz = direction[2], ll = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
      const rayon = etendue * 1.45 + 2, r2 = rayon * rayon, ex = oeil[0], ey = oeil[1], ez = oeil[2], p2 = proche * proche;
      compte[0] = compte[1] = compte[2] = 0; let nv = 0;
      const finVisible = horsOmbre(volumes, 0, centre, direction, ll, rayon) ? 0 : n;
      for (let debutBloc = 0, v = 4; debutBloc < finVisible; debutBloc += PLACES_PAR_VOLUME, v += 4) {
        if (horsOmbre(volumes, v, centre, direction, ll, rayon)) continue;
        const finBloc = Math.min(debutBloc + PLACES_PAR_VOLUME, n);
        for (let i = debutBloc; i < finBloc; i++) {
          const o = i * 4;
          if (cpu[o + 3] >= presence) continue;
          const dx = cpu[o] - centre[0], dy = cpu[o + 1] - centre[1], dz = cpu[o + 2] - centre[2], le = (dx * lx + dy * ly + dz * lz) / ll;
          if (dx * dx + dy * dy + dz * dz - le * le > r2) continue;
          const ox = cpu[o] - ex, oy = cpu[o + 1] - ey, oz = cpu[o + 2] - ez;
          const pres = niveauMin <= 1 && ox * ox + oy * oy + oz * oz < p2;
          vus[nv++] = pres ? i : -1 - i;
          compte[pres ? 1 : 2]++;
        }
      }
      debut[0] = 0; debut[1] = 0; debut[2] = compte[1];
      let k1 = 0, k2 = compte[1];
      for (let j = 0; j < nv; j++) { const v = vus[j]; if (v >= 0) liste[k1++] = coder(v, 0, 1); else liste[k2++] = coder(-1 - v, 0, 1); }
      resultat.total = k2; resultat.vus = nv;
      return resultat;
    }
    return { lister, listerOmbre, resultat };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Shaders
  // ---------------------------------------------------------------------------------------------------------------

  const vec3s = l => l.map(c => `vec3(${c.map(v => Number(v).toFixed(3)).join(',')})`).join(',');
  const VS = `#version 300 es
  precision highp float;precision highp int;
  layout(location=0) in vec3 aPosition;
  layout(location=1) in vec3 aNormale;
  layout(location=2) in vec2 aPoids;
  layout(location=3) in uvec4 aInfo;
  layout(location=4) in uint aSpectateur;
  uniform highp sampler2D uPublicF;
  uniform highp usampler2D uPublicU;
  uniform mat4 uVP;
  uniform vec4 uTemps;                    // temps (s), abris (pluie ou neige lissée), mouillé, libre
  uniform vec4 uSections[${SECTIONS}];    // cible du regard (x, y, z), excitation
  uniform vec4 uSections2[${SECTIONS}];   // poids du regard, fête (départ, arrivée)
  #ifndef OMBRE
  out vec3 vMonde;out vec3 vNormale;out vec3 vObjet;
  flat out vec3 vBase;flat out vec3 vSecond;flat out vec4 vMatiere;flat out vec2 vTrame;flat out uint vMotif;
  #endif
  const vec3 PIV_HANCHES=vec3(0.,.95,0.),PIV_COU=vec3(0.,1.52,0.);
  vec3 rx(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x,v.y*c+v.z*s,-v.y*s+v.z*c);}
  vec3 ry(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x*c+v.z*s,v.y,-v.x*s+v.z*c);}
  vec3 rz(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x*c-v.y*s,v.x*s+v.y*c,v.z);}
  vec3 couleur(uint c){return vec3(float((c>>16)&255u),float((c>>8)&255u),float(c&255u))/255.;}
  // Angles d'une pose. Bras : rotation de l'humérus vers le dedans (avant-bras ramené devant le corps), flexion vers
  // l'avant (épaule, coude), abduction vers le dehors, balancier de l'avant-bras. Jambes : flexion de la hanche, du
  // genou, de la cheville ; ouverture des genoux (assis) et écart (debout).
  struct Pose{vec2 hanche;vec2 genou;vec2 cheville;vec2 ecart;vec2 ouvre;vec2 epaule;vec2 abduction;vec2 dedans;vec2 coude;vec2 balancier;
    vec3 torse;vec2 tete;float souffle;};
  void poserOs(inout vec3 p,inout vec3 n,uint os,Pose q){
    if(os==4u||os==5u||os==16u||os==17u||os>=20u){
      int c=(os==4u||os==16u||os==20u)?0:1;float sx=c==0?-.105:.105;
      if(os>=20u){vec3 k=vec3(sx,.145,0.);p=k+rx(p-k,q.cheville[c]);n=rx(n,q.cheville[c]);}
      if(os>=16u){vec3 k=vec3(sx,.52,0.);p=k+rx(p-k,q.genou[c]);n=rx(n,q.genou[c]);}
      vec3 k=vec3(sx,.97,0.);
      p=k+rz(ry(rx(p-k,q.hanche[c]),q.ouvre[c]),q.ecart[c]);n=rz(ry(rx(n,q.hanche[c]),q.ouvre[c]),q.ecart[c]);
      return;
    }
    if(os==2u||os==3u||os==18u||os==19u){
      int c=(os==2u||os==18u)?0:1;float sx=c==0?-1.:1.;
      if(os>=18u){vec3 k=vec3(sx*.255,1.19,0.);p=k+rz(rx(p-k,q.coude[c]),sx*q.balancier[c]);n=rz(rx(n,q.coude[c]),sx*q.balancier[c]);}
      vec3 k=vec3(sx*.235,1.43,0.);float d=-sx*q.dedans[c],ab=sx*q.abduction[c];
      p=k+rz(rx(ry(p-k,d),q.epaule[c]),ab);n=rz(rx(ry(n,d),q.epaule[c]),ab);
      p.y+=.004*q.souffle;
    }else if(os==1u){
      p=PIV_COU+ry(rx(p-PIV_COU,-q.tete.y),q.tete.x);n=ry(rx(n,-q.tete.y),q.tete.x);
    }else{
      float w=smoothstep(1.06,1.2,p.y)*(1.-smoothstep(1.4,1.48,p.y));
      p.xz*=1.+.013*q.souffle*w;
    }
    p=PIV_HANCHES+ry(rz(rx(p-PIV_HANCHES,-q.torse.x),q.torse.y),q.torse.z);n=ry(rz(rx(n,-q.torse.x),q.torse.y),q.torse.z);
  }
  void cacher(){
    gl_Position=vec4(0.,0.,3.,1.);
    #ifndef OMBRE
    vMonde=vec3(0.);vNormale=vec3(0.,1.,0.);vObjet=vec3(0.);vBase=vec3(0.);vSecond=vec3(0.);vMatiere=vec4(0.);vTrame=vec2(0.);vMotif=0u;
    #endif
  }
  void main(){
    uint idx=aSpectateur&65535u,lo8=(aSpectateur>>16)&255u,hi8=aSpectateur>>24;
    ivec2 t0=ivec2(int((idx*2u)&1023u),int((idx*2u)>>10)),t1=ivec2(t0.x+1,t0.y);
    if(hi8<=lo8){cacher();return;}
    uvec4 U0=texelFetch(uPublicU,t0,0);
    uint os=aInfo.x,teinte=aInfo.y,partie=aInfo.z,mat=aInfo.w&31u;
    uint g=U0.x,masque=U0.y,traits=U0.z,section=min(U0.w&255u,${SECTIONS - 1}u);
    bool assis=(traits&3u)==0u;
    if(((masque>>partie)&1u)==0u){cacher();return;}
    float h1=float(g&255u)/255.,h2=float((g>>8)&255u)/255.,h3=float((g>>16)&255u)/255.,h4=float((g>>24)&255u)/255.;
    // ---- l'animation : excitation de la section, seuils propres au spectateur
    float t=uTemps.x;vec4 S=uSections[section],S2=uSections2[section];
    float exc=clamp(max(S.w,S2.y*(.55+.5*h2)),0.,1.);
    float seuil=.16+.95*h1,lever=assis?smoothstep(seuil,seuil+.17,exc):1.,lev=lever*lever*(3.-2.*lever);
    float agite=smoothstep(seuil+.04,seuil+.28,exc);
    bool deuxBras=((traits>>15)&1u)==1u,applaudit=((traits>>16)&1u)==1u;
    uint abri=(traits>>22)&3u,posture=(traits>>28)&3u;
    float couvert=smoothstep(.06+.3*h3,.2+.3*h3,uTemps.y);
    float parapluie=abri==1u?couvert:0.,capuche=abri==2u?couvert:0.;
    float drapeau=((masque>>${PARTIE.DRAPEAU}u)&1u)==1u?smoothstep(.05,.3,agite):0.;
    if(partie==${PARTIE.PARAPLUIE}u&&parapluie<.02||partie==${PARTIE.DRAPEAU}u&&drapeau<.02){cacher();return;}
    float ph=6.2831853*h4,souffle=sin(t*(1.25+.5*h3)+ph),om=9.+5.*h2;
    Pose q;q.souffle=souffle;
    // jambes : assis au bord de la marche (cuisse presque à plat, tibia d'aplomb, pied à plat), debout tout droit,
    // le poids passant d'une jambe à l'autre
    float hA=1.36+.1*(h3-.5),gA=-(hA+.04),ouvre=.06+.12*h2;
    for(int c=0;c<2;c++){
      float sc=c==0?-1.:1.,appui=assis?0.:.06*max(0.,sin(t*.31+ph+float(c)*3.1))*(1.-agite);
      q.hanche[c]=mix(hA,0.,lev)+appui;q.genou[c]=mix(gA,0.,lev)-appui*2.;q.cheville[c]=-(q.hanche[c]+q.genou[c]);
      q.ecart[c]=sc*mix(.02,.035+.02*h1,lev);q.ouvre[c]=sc*mix(ouvre,.12+.1*h3,lev);
    }
    // bras au repos (flexion, abduction, dedans, coude). Assis : mains sur les cuisses, coudes sur les genoux
    // (penché) ou mains jointes (adossé). Debout : le long du corps, mains dans les poches ou bras croisés.
    vec4 R0;
    if(assis)R0=posture==1u?vec4(.30,.10,.50,1.25):posture==2u?vec4(.08,.06,.62,.85):vec4(.20+.06*h2,.07,.45,.80+.08*h3);
    else R0=posture==1u?vec4(-.05,.16,.25,.35):posture==2u?vec4(.55,.05,1.1,1.6):vec4(.03+.05*h3,.06+.04*h2,.12,.12+.25*h2);
    R0=mix(R0,vec4(.05,.06,.12,.2),assis?lev:0.);
    for(int c=0;c<2;c++){
      vec4 r=R0;if(!assis&&posture==2u&&c==0)r=vec4(.47,.05,1.05,1.75);  // bras croisés : le gauche passe dessus
      q.epaule[c]=r.x;q.abduction[c]=r.y;q.dedans[c]=r.z;q.coude[c]=r.w;q.balancier[c]=0.;
    }
    // enthousiasme : on applaudit (mains qui se rejoignent devant la poitrine) ou l'on agite les bras levés en V
    if(applaudit){
      float k=.5+.5*sin(t*om*1.2+ph);
      for(int c=0;c<2;c++){q.epaule[c]=mix(q.epaule[c],1.0,agite);q.coude[c]=mix(q.coude[c],1.2,agite);q.abduction[c]=mix(q.abduction[c],.02,agite);q.dedans[c]=mix(q.dedans[c],.72+.32*k,agite);}
    }else{
      for(int c=0;c<2;c++){
        float bras=(c==1||deuxBras)?agite:0.,k=sin(t*om*.62+ph+float(c)*1.7);
        q.epaule[c]=mix(q.epaule[c],2.55+.12*sin(t*1.7+ph),bras);q.abduction[c]=mix(q.abduction[c],-.30+.10*k,bras);
        q.dedans[c]=mix(q.dedans[c],0.,bras);q.coude[c]=mix(q.coude[c],.32+.12*sin(t*om*.62+ph+float(c)+1.),bras);q.balancier[c]=.42*k*bras;
      }
    }
    // abris : le parapluie tenu de la main droite, devant la poitrine ; la main gauche agite le drapeau
    if(parapluie>0.){q.epaule[1]=mix(q.epaule[1],.62,parapluie);q.coude[1]=mix(q.coude[1],1.82,parapluie);q.abduction[1]=mix(q.abduction[1],.1,parapluie);q.dedans[1]=mix(q.dedans[1],.2,parapluie);q.balancier[1]*=1.-parapluie;}
    if(drapeau>0.){float k=sin(t*7.+ph);q.epaule[0]=mix(q.epaule[0],2.55+.2*k,drapeau);q.abduction[0]=mix(q.abduction[0],-.25+.3*k,drapeau);q.dedans[0]=mix(q.dedans[0],0.,drapeau);q.coude[0]=mix(q.coude[0],.25,drapeau);q.balancier[0]=0.;}
    // torse : se pencher pour se lever, respirer, osciller ; trois façons d'être assis (droit, penché, adossé)
    float penche=assis?(posture==1u?.34:posture==2u?-.1:.02+.05*h1):.02;
    q.torse.x=mix(penche,.03,lev)+(assis?.5*sin(3.1415927*lever):0.)+.012*souffle+.06*agite*sin(t*om*.62+ph);
    q.torse.y=.022*sin(t*.43+ph)+.03*agite*sin(t*om*.31+ph);
    // regard : la voiture de la section, sinon des coups d'œil au hasard
    vec4 A=texelFetch(uPublicF,t0,0),Bf=texelFetch(uPublicF,t1,0);
    vec3 ancre=A.xyz;float cap=A.w,cc=cos(cap),sc=sin(cap);
    vec3 X=vec3(cc,0.,-sc),Fv=vec3(sc,0.,cc);
    vec3 teteMonde=ancre+vec3(0.,mix(.62,1.62-Bf.y,lev),0.)+Fv*Bf.x*lev;
    vec3 d=S.xyz-teteMonde;float lx=dot(d,X),lz=dot(d,Fv);
    float lacet=atan(lx,lz),tangage=atan(d.y,max(.5,length(vec2(lx,lz))));
    float poids=S2.x*(.7+.3*h2)*(1.-smoothstep(1.9,2.5,abs(lacet)));
    float oisif=.38*sin(t*(.09+.06*h2)+ph*1.3)+.16*sin(t*.27+h1*9.);
    lacet=mix(oisif,clamp(lacet,-1.5,1.5),poids);
    q.torse.z=.3*lacet;
    q.tete.x=clamp(lacet-q.torse.z,-1.15,1.15);
    q.tete.y=clamp(mix(.08+.06*sin(t*.21+ph),-tangage*.8,poids),-.35,.5)-.25*agite*(1.-parapluie);
    float saut=((traits>>17)&1u)==1u?.06*max(0.,sin(t*om*.7+ph))*smoothstep(.5,.9,agite):0.;
    // ---- le sommet
    vec3 p=aPosition,n=aNormale,objet=aPosition;
    if(os==1u&&p.y>1.54){
      // trois visages d'EMPRISE (human.js), ici en continu : mâchoire et nez
      float v=float((traits>>24)&15u)/7.5-1.,jaw=exp(-pow((p.y-1.605)/.052,2.)),upper=clamp((p.y-1.54)/.10,0.,1.);
      p.x*=1.+v*(.025+.035*jaw)*upper;
      p.z+=v*.003*exp(-(pow(p.x/.020,2.)+pow((p.y-1.675)/.035,2.)))*max(0.,p.z/.1);
    }
    if(((traits>>10)&1u)==1u&&os<=3u&&os!=1u&&p.y>1.2)p.x*=1.-.025*smoothstep(1.2,1.44,p.y);
    // tête un peu plus grosse chez les enfants : on n'est pas un adulte en réduction
    if(os==1u){float k=pow(clamp(1./Bf.z,1.,1.4),.6);p=PIV_COU+(p-PIV_COU)*k;}
    if(partie==${PARTIE.CASQUETTE}u&&((traits>>14)&1u)==1u){p=vec3(-p.x,p.y,-.008-p.z);n=vec3(-n.x,n.y,-n.z);}
    if(partie==${PARTIE.CAPUCHE}u){
      // sans pluie, la capuche est rabattue, aplatie dans le dos
      vec3 k=vec3(0.,1.53,-.07);float a=1.75*(1.-capuche),e=mix(.5,1.,capuche);
      p=k+rx((p-k)*vec3(1.,e,e),a);n=rx(normalize(n*vec3(1.,1./e,1./e)),a);
    }
    if(partie==${PARTIE.DRAPEAU}u){
      float u=aPoids.y;p.z+=.07*u*sin(t*11.-u*7.+ph)*drapeau;p.x=-.26+(p.x+.26)*drapeau;p.y=.905+(p.y-.905)*drapeau;
    }
    if(partie==${PARTIE.PARAPLUIE}u){
      // la main droite posée, puis le parapluie droit au-dessus, ouvert selon la pluie
      vec3 main=vec3(.262,.905,.02),mn=vec3(0.,1.,0.);poserOs(main,mn,19u,q);
      float r=p.y>.7?mix(.08,1.,parapluie):1.;
      vec3 l=rx(vec3(p.x*r,p.y,p.z*r),.22);n=rx(n,.22);
      p=main+l;
    }else{
      vec3 pa=p,na=n;poserOs(pa,na,os,q);
      if((aInfo.w&${DEUX_OS}u)!=0u){vec3 pb=p,nb=n;poserOs(pb,nb,uint(aPoids.x+.5),q);pa=mix(pa,pb,aPoids.y);na=mix(na,nb,aPoids.y);}
      p=pa;n=na;
    }
    // échelle du spectateur (autour de la hanche assis, des pieds debout), puis ancrage et orientation
    vec3 echelle=vec3(Bf.w,Bf.z,.5+.5*Bf.w),pivot=vec3(0.,.97*(1.-lev),0.);
    p=pivot+(p-pivot)*echelle;n=n/echelle;
    p+=mix(vec3(0.,-.97,0.),vec3(0.,-Bf.y,Bf.x),lev);p.y+=saut;
    vec3 monde=ancre+X*p.x+vec3(0.,p.y,0.)+Fv*p.z;
    gl_Position=uVP*vec4(monde,1.);
    #ifndef OMBRE
    vMonde=monde;vNormale=X*n.x+vec3(0.,n.y,0.)+Fv*n.z;vObjet=objet;
    vTrame=vec2(float(lo8),float(hi8))/255.;
    // couleur de la partie
    uvec4 U1=texelFetch(uPublicU,t1,0);
    uint peau=(traits>>2)&7u,chev=(traits>>5)&7u,chau=(traits>>8)&3u;
    const vec3 PEAUX[8]=vec3[8](${vec3s(PEAUX)});
    const vec3 CHEVEUX[8]=vec3[8](${vec3s(CHEVEUX)});
    const vec3 CHAUSSURES[4]=vec3[4](${vec3s(CHAUSSURES)});
    vec3 b;uint motif=0u;
    bool couvreChef=((masque>>${PARTIE.CASQUETTE}u)&15u)!=0u;
    if(teinte==${TEINTE.TETE_LOIN}u)teinte=capuche>.5?${TEINTE.HAUT}u:couvreChef?${TEINTE.COIFFE}u:(masque&${(1 << PARTIE.CHEVEUX_DESSUS) | (1 << PARTIE.VOLUME)}u)!=0u?${TEINTE.CHEVEUX}u:${TEINTE.PEAU}u;
    if(teinte==${TEINTE.HAUT}u&&((traits>>11)&1u)==1u&&(os==2u||os==3u||os==18u||os==19u)&&objet.y<1.255)teinte=${TEINTE.PEAU}u;
    if(teinte==${TEINTE.BAS}u&&((traits>>12)&1u)==1u&&objet.y<.62&&os!=0u)teinte=${TEINTE.PEAU}u;
    if(teinte==${TEINTE.PEAU}u&&((traits>>13)&1u)==1u&&(os==18u||os==19u)&&objet.y<.97)teinte=${TEINTE.COIFFE}u;
    if(teinte==${TEINTE.PEAU}u)b=PEAUX[peau];
    else if(teinte==${TEINTE.HAUT}u){b=couleur(U1.x);if(partie==0u)motif=(traits>>18)&15u;}
    else if(teinte==${TEINTE.BAS}u)b=couleur(U1.y);
    else if(teinte==${TEINTE.CHAUSSURES}u)b=CHAUSSURES[chau];
    else if(teinte==${TEINTE.CHEVEUX}u)b=CHEVEUX[chev];
    else if(teinte==${TEINTE.COIFFE}u){b=couleur(U1.z);if(partie==${PARTIE.CASQUETTE}u&&h3>.6)motif=10u;}
    else if(teinte==${TEINTE.ACCESSOIRE}u){b=couleur(U1.w);if(partie==${PARTIE.PARAPLUIE}u)motif=8u;if(partie==${PARTIE.DRAPEAU}u)motif=9u;}
    else if(teinte==${TEINTE.BLANC}u)b=vec3(.80,.79,.76);
    else if(teinte==${TEINTE.SOMBRE}u)b=vec3(.025,.025,.03);
    else b=vec3(.52,.53,.55);
    vMotif=motif;vBase=b;vSecond=couleur(U0.w>>8u);
    // rugosité, métal, mouillé (pas sous un toit, un parapluie ou une capuche), peau du visage (pour les lèvres)
    float rug=mat==${MATIERE.PEAU}u?.58:mat==${MATIERE.CUIR}u?.5:mat==${MATIERE.CHEVEUX}u?.52:mat==${MATIERE.TOILE}u?.42:mat==${MATIERE.METAL}u?.3:mat==${MATIERE.VERRE}u?.12:mat==${MATIERE.OEIL}u?.25:mat==${MATIERE.PAILLE}u?.82:mat==${MATIERE.LAINE}u?.97:.88;
    float abrite=abri==${ABRI.TOIT}u?1.:max(parapluie,capuche),textile=mat==${MATIERE.TISSU}u||mat==${MATIERE.LAINE}u||mat==${MATIERE.CHEVEUX}u?1.:0.;
    vMatiere=vec4(rug,mat==${MATIERE.METAL}u?.85:0.,uTemps.z*(1.-abrite)*textile,teinte==${TEINTE.PEAU}u&&os==1u?1.:0.);
    #endif
  }`;

  const FS = `#version 300 es
  precision highp float;precision highp int;
  /*PDR*/
  in vec3 vMonde;in vec3 vNormale;in vec3 vObjet;
  flat in vec3 vBase;flat in vec3 vSecond;flat in vec4 vMatiere;flat in vec2 vTrame;flat in uint vMotif;
  out vec4 fragColor;
  // bande d'un motif, adoucie à la taille du pixel, et fondue vers sa moyenne quand elle devient plus fine que lui
  float bande(float v,float largeur){float aa=max(fwidth(v)*1.2,1e-4);float d=abs(fract(v)-.5)-(.5-largeur*.5);float k=1.-smoothstep(-aa,aa,d);return mix(k,largeur,smoothstep(.25,.5,aa));}
  void main(){
    // fondu tramé entre deux niveaux : chaque pixel appartient à un seul des deux
    if(vTrame.x>0.||vTrame.y<1.){
      float d=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
      if(d<vTrame.x||d>=vTrame.y)discard;
    }
    vec3 n=normalize(vNormale),base=vBase,o=vObjet;
    float k=0.;
    if(vMotif==1u)k=bande(o.y*15.,.45);                                    // marinière
    else if(vMotif==2u)k=bande(atan(o.x,o.z+.001)*9.,.3);                  // fines rayures verticales
    else if(vMotif==3u)k=max(bande(o.y*11.,.32),bande(o.x*11.,.32))*.75;    // carreaux
    else if(vMotif==4u)k=abs(o.x)>.205&&o.y<1.47?1.:0.;                     // manches contrastées
    else if(vMotif==5u)k=step(1.26,o.y)*step(o.y,1.34);                     // bande de poitrine
    else if(vMotif==6u)k=step(1.47,o.y);                                    // col contrasté
    else if(vMotif==8u)k=step(.5,fract(atan(o.z,o.x)*1.2732395));           // panneaux du parapluie
    else if(vMotif==9u)k=step(.5,fract((o.y-.125)*7.4));                    // drapeau à bandes
    else if(vMotif==10u)k=step(.04,o.z)*step(o.y,1.79);                     // casquette à façade claire
    base=mix(base,vSecond,clamp(k,0.,1.));
    // lèvres : un peu de sang sous la peau du visage
    if(vMatiere.w>.5){float l=exp(-pow(o.x/.022,2.)-pow((o.y-1.613)/.0055,2.))*step(.06,o.z);base*=mix(vec3(1.),vec3(.86,.6,.58),l);}
    float rug=vMatiere.x,mouille=vMatiere.z;
    base*=1.-.28*mouille;rug=mix(rug,.35,mouille*.6);
    float ombre=pdrOmbreSoleil(vMonde,n);
    fragColor=vec4(pdrFinir(pdrEclairer(base,n,vMonde,rug,vMatiere.y,0.,ombre),vMonde),0.);
  }`;

  const FS_OMBRE = `#version 300 es
  precision highp float;
  void main(){}`;

  // ---------------------------------------------------------------------------------------------------------------
  // La vue sur le processeur graphique : une par moteur (le rendu principal, les rétroviseurs)
  // ---------------------------------------------------------------------------------------------------------------

  function reglageDe(palier, niveauMin) {
    return { bande0: palier.bande0, bande1: palier.bande1, plafond0: palier.plafond0, plafond1: palier.plafond1, niveauMin: Math.max(niveauMin || 0, palier.niveauMin) };
  }
  /** options : { niveauMin (0 : tous ; 2 : silhouettes seules), ombre (selon le palier par défaut), proche (m) }. */
  function vue(renderer, pub, options = {}) {
    const gl = renderer && renderer.gl, pdr = renderer && renderer.pdr;
    if (!gl || !pdr || !pub) throw new Error('public : il faut un moteur WebGL 2 avec ses points d’accroche (renderer.pdr)');
    const M = maillages(), liste = creerListe(pub), niveauMin = options.niveauMin || 0, proche = options.proche ?? 20;
    let palier = pub.palier, reglage = reglageDe(palier, niveauMin), ombres = options.ombre ?? palier.ombre;
    const oeil = new Float32Array(3), compteRendu = { appels: 0, triangles: 0, instances: 0 };
    const mesure = { listeMs: 0, ombreMs: 0, vus: 0, niveaux: [0, 0, 0], triangles: 0, appels: 0, ombreInstances: 0, ombreTriangles: 0, plafonne: 0 };
    const temps = new Float32Array(4), cadrage = new Float64Array(4), cadrageOmbre = new Float64Array(4);
    let res = null, generation = -1, oeilConnu = false, imageOmbre = -1;
    function creerRessources() {
      const r = { presenceLointaine: null };
      r.couleur = pdr.programme(VS, FS.replace('/*PDR*/', pdr.glsl));
      r.ombre = pdr.programme(VS.replace('precision highp int;', 'precision highp int;\n  #define OMBRE 1'), FS_OMBRE);
      r.uC = { version: -1, seance: -1 }; r.uO = { version: -1, seance: -1 };
      for (const nom of ['uPublicF', 'uPublicU', 'uVP', 'uTemps', 'uSections', 'uSections2']) { r.uC[nom] = gl.getUniformLocation(r.couleur, nom); r.uO[nom] = gl.getUniformLocation(r.ombre, nom); }
      r.eclairer = pdr.lier(r.couleur);
      r.vao = gl.createVertexArray(); gl.bindVertexArray(r.vao);
      r.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, r.vbo); gl.bufferData(gl.ARRAY_BUFFER, M.sommets, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, SOMMET, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, SOMMET, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, SOMMET, 24);
      gl.enableVertexAttribArray(3); gl.vertexAttribIPointer(3, 4, gl.UNSIGNED_BYTE, SOMMET, 32);
      r.ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, M.indices, gl.STATIC_DRAW);
      // Deux tampons d'instances : l'ombre et la couleur ne réécrivent pas, dans la même image, un tampon déjà lu.
      r.instances = [gl.createBuffer(), gl.createBuffer()];
      for (const b of r.instances) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, liste.resultat.liste.byteLength, gl.DYNAMIC_DRAW); }
      gl.enableVertexAttribArray(4); gl.vertexAttribIPointer(4, 1, gl.UNSIGNED_INT, 4, 0); gl.vertexAttribDivisor(4, 1);
      gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
      // Les spectateurs, une fois pour toutes, sur les unités 8 et 9 (le monde emploie 2, 4, 5, 6 et 7 ; l'après 0, 1, 3).
      gl.activeTexture(gl.TEXTURE8);
      r.texF = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, r.texF);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, LARGEUR_TEX, pub.lignes, 0, gl.RGBA, gl.FLOAT, pub.flottants);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.activeTexture(gl.TEXTURE9);
      r.texU = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, r.texU);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, LARGEUR_TEX, pub.lignes, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, pub.entiers);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.activeTexture(gl.TEXTURE0);
      res = r; generation = pdr.generation;
    }
    function pret() {
      if (gl.isContextLost && gl.isContextLost()) return false;
      if (!res || generation !== pdr.generation) creerRessources();
      return true;
    }
    function lier(u, vp) {
      const E = pub.etat;
      gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, res.texF);
      gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, res.texU);
      if (u.version < 0) { gl.uniform1i(u.uPublicF, 8); gl.uniform1i(u.uPublicU, 9); }
      gl.uniformMatrix4fv(u.uVP, false, vp);
      // Chaque programme conserve ses uniformes entre les deux yeux ou tuiles d’ombre.
      // La nouvelle séance et la recréation du programme invalident ce partage.
      if (u.version !== E.version || u.seance !== E.seance) {
        temps[0] = E.temps; temps[1] = E.couverture; temps[2] = E.mouille; temps[3] = 0;
        gl.uniform4fv(u.uTemps, temps);
        gl.uniform4fv(u.uSections, E.s1); gl.uniform4fv(u.uSections2, E.s2);
        u.version = E.version; u.seance = E.seance;
      }
    }
    function dessiner(ombre) {
      const L = liste.resultat, tampon = res.instances[ombre ? 1 : 0];
      gl.bindVertexArray(res.vao); gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
      // L’ombre a son propre tampon. Si celui de couleur contient déjà exactement la
      // suite des silhouettes de cette séance, les indices peuvent rester sur le GPU.
      if (ombre || L.presenceLointaine === null || L.presenceLointaine !== res.presenceLointaine) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, L.liste, 0, L.total);
        if (!ombre) res.presenceLointaine = L.presenceLointaine;
      }
      let appels = 0, triangles = 0, instances = 0;
      for (let k = 0; k < NIVEAUX; k++) {
        const nombre = L.compte[k]; if (!nombre) continue;
        const nv = M.niveaux[k];
        gl.vertexAttribIPointer(4, 1, gl.UNSIGNED_INT, 4, L.debut[k] * 4);
        gl.drawElementsInstanced(gl.TRIANGLES, nv.compte, gl.UNSIGNED_INT, nv.premier * 4, nombre);
        appels++; triangles += nv.compte / 3 * nombre; instances += nombre;
        if (!ombre) mesure.niveaux[k] = nombre;
      }
      gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null); gl.activeTexture(gl.TEXTURE0);
      compteRendu.appels = appels; compteRendu.triangles = triangles; compteRendu.instances = ombre ? 0 : instances;
      return compteRendu;
    }
    const fx = {
      /** Passe d'ombre du soleil (une par tuile de l'atlas) : cadre, biais et programme de profondeur posés par le moteur. */
      ombre(gl2, lumiere) {
        if (!ombres || !pub.n || !pret()) return null;
        const t0 = performance.now();
        if (imageOmbre !== pub.etat.version) { imageOmbre = pub.etat.version; mesure.ombreMs = 0; mesure.ombreInstances = 0; mesure.ombreTriangles = 0; }
        cadrageOmbre[0] = lumiere.etendue; cadrageOmbre[1] = pub.etat.presence; cadrageOmbre[2] = reglage.niveauMin; cadrageOmbre[3] = proche;
        liste.listerOmbre(lumiere.centre, lumiere.direction, oeilConnu ? oeil : lumiere.centre, cadrageOmbre);
        let r = null;
        if (liste.resultat.total) {
          gl.useProgram(res.ombre); lier(res.uO, lumiere.matrice);
          gl.enable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST);
          r = dessiner(true);
          mesure.ombreInstances += liste.resultat.total; mesure.ombreTriangles += r.triangles;
        }
        mesure.ombreMs += performance.now() - t0;
        return r;
      },
      /** Passe couleur, dans la cible du moteur (MSAA compris), éclairée comme le monde. */
      couleur(gl2, v) {
        if (!pub.n || !pret()) return null;
        const t0 = performance.now();
        oeil[0] = v.oeil[0]; oeil[1] = v.oeil[1]; oeil[2] = v.oeil[2]; oeilConnu = true;
        cadrage[0] = v.tangente * v.largeur / Math.max(1, v.hauteur); cadrage[1] = v.tangente; cadrage[2] = v.focale; cadrage[3] = pub.etat.presence;
        liste.lister(v.oeil, v.avant, v.droite, v.haut, cadrage, reglage);
        mesure.vus = liste.resultat.vus; mesure.plafonne = liste.resultat.plafonne;
        mesure.niveaux[0] = mesure.niveaux[1] = mesure.niveaux[2] = 0; mesure.triangles = mesure.appels = 0;
        let r = null;
        if (liste.resultat.total) {
          gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
          gl.useProgram(res.couleur); lier(res.uC, v.vp); res.eclairer(v);
          r = dessiner(false);
          mesure.triangles = r.triangles; mesure.appels = r.appels;
        }
        mesure.listeMs = performance.now() - t0;
        return r;
      },
    };
    /** Changer de palier en course (qualité automatique) : bandes et plafonds, sans rien allouer ni régénérer. */
    function qualite(q) { palier = palierDe(q); reglage = reglageDe(palier, niveauMin); ombres = options.ombre ?? palier.ombre; }
    function liberer() {
      if (!res) return;
      gl.deleteProgram(res.couleur); gl.deleteProgram(res.ombre);
      for (const b of [res.vbo, res.ibo, ...res.instances]) gl.deleteBuffer(b);
      gl.deleteTexture(res.texF); gl.deleteTexture(res.texU); gl.deleteVertexArray(res.vao);
      res = null;
    }
    pret();
    return { fx, mesure, liberer, qualite, get reglage() { return reglage; }, get pret() { return !!res; } };
  }

  B.public = Object.freeze({ creer, animer, regler, reinitialiser, vue, maillages, trianglesDe, creerListe, decrireGradins, presencePour, alea, hache,
    PALIERS, OS, TEINTE, PARTIE, MATIERE, SECTIONS, LONG_SECTION, GENRE, ABRI, PENTE_PLUIE, SOMMET, coder, VS, FS,
    provenance: Object.freeze({ depot: 'M4D135/emprise', commit: 'cc004826a506e6979eaaec217748fe85d5cd6ac5', version: '0.6.8',
      fichiers: Object.freeze(['src/human-data.js', 'src/body-data.js', 'src/human.js', 'src/ferro/crowd.js']) }) });
})(globalThis.BITUME = globalThis.BITUME || {});
