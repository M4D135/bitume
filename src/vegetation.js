/* BITUME — végétation basse de Val-Brûlé. Géométrie originale, générée une fois puis instanciée.
   Les deux résolutions partagent leurs pieds, extrémités et dimensions ; les plantes restent présentes au loin.
   Aucun fichier de modèle, texture ou son ; aucune dépendance à la simulation ni consommation de son hasard. */
(function (B) {
  'use strict';

  const PI2 = Math.PI * 2;
  const BUDGET = Object.freeze({ stations: 76, herbes: 152, taillis: 76, formes: 4 });
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
  const FORMES = Object.freeze({ 'herbes-val': H.proche, 'herbes-val-loin': H.loin, 'taillis-val': T.proche, 'taillis-val-loin': T.loin });
  function installer(rendu) {
    if (!rendu || typeof rendu.forme !== 'function') return false;
    for (const nom of Object.keys(FORMES)) rendu.forme(nom, FORMES[nom]);
    return true;
  }

  // Un lot par secteur de 420 m : deux familles seulement, donc au plus deux groupes instanciés par lot/passe.
  // Les verts ont leur générateur indépendant. Ajouter un massif ne déplace ni arbre, ni obstacle, ni stand.
  function construire(c, { limites, interroger } = {}) {
    if (c.theme !== 'foret' || !limites || !interroger) return { lots: [], herbes: 0, taillis: 0 };
    const r = hasard((c.graine ^ 0x53a98b17) >>> 0), groupes = new Map(), w = c.largeur / 2;
    let herbes = 0, taillis = 0;
    const pas = Math.max(1, Math.ceil(c.n / BUDGET.stations));
    function ajouter(i, d, famille, angle, taille, color) {
      const a = c.cap[i], x = c.x[i] - Math.sin(a) * d, z = c.z[i] + Math.cos(a) * d;
      const q = interroger(x, z, 40), marge = Math.hypot(taille[0], taille[2]) / 2 + .18;
      if (q.i < 0 || q.d < w + 1.2 + marge || Math.abs(B.circuit.ecart(c, i * c.pas, q.i * c.pas)) > 20) return false;
      const cote = d < 0 ? -1 : 1, limite = cote < 0 ? limites.G[i] : limites.D[i];
      if (Math.abs(d) + marge > limite - .7) return false;
      // Même bande d'accotement que nappesRoute(), pied légèrement enterré, dévers arrêté au bord de piste.
      const ext = limite + 4, u = (Math.abs(d) - w - 1.2) / (ext - w - 1.2);
      const bord = c.y[i] - cote * w * Math.sin(c.devers[i]);
      const sol = bord - .015 + u * (.015 - .02 * (ext - w - 1.2));
      const objet = { shape: famille + '-val', p: [x, sol + taille[1] / 2 - .025, z], s: taille,
        r: [0, angle, 0], mat: 11, color };
      const cle = Math.floor(i * c.pas / 420);
      let lot = groupes.get(cle); if (!lot) groupes.set(cle, lot = { objets: [], loin: [] });
      lot.objets.push(objet); lot.loin.push({ ...objet, shape: famille + '-val-loin' });
      return true;
    }
    for (let station = 0, i = 0; i < c.n && station < BUDGET.stations; i += pas, station++) {
      const cote = station % 2 ? 1 : -1, hasardStation = [r(), r(), r(), r(), r(), r(), r(), r()];
      if (Math.abs(B.circuit.ecart(c, 0, i * c.pas)) < 360 || (B.circuit.dansTunnel && B.circuit.dansTunnel(c, i * c.pas, 20))) continue;
      const limite = cote < 0 ? limites.G[i] : limites.D[i], espace = limite - w - 4.2;
      if (espace < 1.2) continue;
      const d = cote * (w + 2.5 + hasardStation[0] * Math.min(espace - .3, 4.5));
      for (let k = 0; k < 2; k++) {
        const j = (i + k * 2) % c.n, largeur = .95 + hasardStation[k + 1] * .52, h = .40 + hasardStation[k + 3] * .28;
        const vert = .82 + hasardStation[k + 4] * .30;
        if (ajouter(j, d + cote * k * .75, 'herbes', hasardStation[k + 2] * PI2,
          [largeur, h, largeur * (.72 + hasardStation[k + 3] * .20)], [.21 * vert, .34 * vert, .105 * vert])) herbes++;
      }
      if (hasardStation[7] < .58 && espace > 3) {
        const largeur = 1.0 + hasardStation[5] * .55, h = .75 + hasardStation[6] * .35;
        if (ajouter(i, cote * Math.min(limite - 2.3, Math.abs(d) + 2.5), 'taillis', hasardStation[4] * PI2,
          [largeur, h, largeur * .85], [.135 + hasardStation[3] * .04, .26 + hasardStation[3] * .06, .075])) taillis++;
      }
    }
    const lots = [];
    for (const l of groupes.values()) {
      const centre = [0, 0, 0];
      for (const o of l.objets) for (let k = 0; k < 3; k++) centre[k] += o.p[k] / l.objets.length;
      // La sphère comprend la déformation de vent, également utilisée dans la passe d'ombre de FERRO.
      let rayon = 0;
      for (const o of l.objets) rayon = Math.max(rayon, Math.hypot(...moins(o.p, centre)) + Math.hypot(...o.s) / 2 + .25);
      lots.push({ ...l, centre, rayon, portee: Infinity, bascule: 520, lodReferenceFov: 60, lodReferenceHeight: 1080, vegetation: true });
    }
    return { lots, herbes, taillis };
  }

  B.vegetation = { FORMES, BUDGET, installer, construire };
  installer(typeof window !== 'undefined' ? window.FRender : globalThis.FRender);
})(globalThis.BITUME = globalThis.BITUME || {});
