/* BITUME — Route-des-Cimes : port métrique de l’étude 22F vers le châssis p15.
   Source récupérée : tools/lieux-partitions.mjs et tools/lieux-trace.mjs, base f41614e.
   L’étude de 9 618,689 m reste disponible comme témoin. La reconstruction du plan final allonge
   deux paliers du Mur et adoucit la première branche des Lacets ; aucune mise à l’échelle globale.
   Ses séquences sont une nouvelle conception explicite, pas la récupération du commit disparu.
   Module autonome, aucun ajout au catalogue. Identifiant/graine propres : route-des-cimes / 181. */
(function (B) {
  'use strict';
  const PAS = 2, LARGEUR = 12, LIMITE = 20, G = 9.81, RAD = Math.PI / 180;
  const angle = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  const borner = (v, a, b) => v < a ? a : v > b ? b : v;
  const PROVENANCE = Object.freeze({
    source: 'tools/lieux-partitions.mjs', constructeur: 'tools/lieux-trace.mjs', base: 'f41614e',
    sourceSHA256: '4e6ef531f90ee49518cd92ffe171297252534d723072c60863158b9fbeefa279',
    identiteHistorique: 'haut-col-etude-22F', identiteRuntime: 'route-des-cimes',
    longueurPlanFinalM: 9698, sequencesFinalesRetrouvees: false,
    qualificationCatalogue: false, versionPhysique: 'p15',
    reconstruction: 'Étude métrique et objectif utilisateur ; Mur +40 m à 22 %, raccord haut +30 m à 7 %, première branche des Lacets à 3 %.',
    avertissement: 'Le commit historique final n’a pas été retrouvé ; la reconstruction ne revendique pas son identité.'
  });
  const RACCORDS_PENTE = Object.freeze([0,60,0,60,60,60,0,60,60,60,0,0,0,60,0,0,60,60,60,72,63,60,60,60,60,60,60,60,60,60,0,60,60,60,60,60,60,60,0,0,60,0,60,60,60,60,79.89977032156744,60,0,60,60,60,75.33460365676834,60]);
const D = (l, o = {}) => ({ t: 'D', l, ...o });
const C = (r, a, o = {}) => ({ t: 'C', r, a, ...o });

// Séquences de l’étude historique (alors nommée Haut-Col). Identité indépendante au runtime.
// Le tour fait le tour du cirque de l'Aiglière, dans le sens contraire des aiguilles d'une montre : la vallée et
// les stands au sud, la montée par le Bois Noir et le Mur à l'est, les lacets, le tunnel du Rocher, la corniche
// sur le rebord nord (le cirque est à gauche, à l'intérieur de la boucle), le col, la galerie et le tunnel des
// Échelles à l'ouest, l'alpage, le pont de la Gorge et le virage du Vide pour redescendre à la vallée.
const PARTITION = {
  id: 'route-des-cimes', nom: 'Route-des-Cimes', theme: 'montagne', graine: 181, zoom: [{ lieu: 3, rayon: 240 }],
  lieux: [
    { n: 1, nom: 'Le Bois Noir', court: 'forêt dense de sapins, esses en montée, troncs à 3 m du bord' },
    { n: 2, nom: 'Le Mur', court: 'rampe droite, près de 300 m au-delà de 20 % et une pointe à 30 %, après la gauche lente de la Scierie' },
    { n: 3, nom: 'Les Lacets', court: 'trois épingles empilées, murs de pierre sèche entre les branches' },
    { n: 4, nom: 'Le Balcon du Cirque', court: 'corniche taillée dans la paroi, grand virage, le vide à gauche' },
    { n: 5, nom: "Col de l'Aiglière", court: 'replat sommital, lac, refuge, galerie paravalanche' },
    { n: 6, nom: 'Pont de la Gorge', court: 'arche de pierre au-dessus de la gorge, cascade en aval' },
    { n: 7, nom: 'Virage du Vide', court: 'gauche convexe, contre-dévers, parapet bas au-dessus de la vallée' },
  ],
  seq: [
    D(300, { p: 0, stands: true, dv: 0 }),
    C(260, -30, { p: 1 }),
    D(240, { p: 1, ajuste: true }),
    C(130, -50, { p: 2 }),
    // le Bois Noir : la forêt dense, esses en montée douce
    D(180, { p: 3.5, lieu: 1, bord: { cote: 'D', type: 'arbres', nom: 'Sapins du Bois Noir' } }),
    C(90, 50, { p: 4.5, lieu: 1 }),
    C(80, -70, { p: 4.5, lieu: 1 }),
    D(220, { p: 3.5, lieu: 1, bord: { cote: 'G', type: 'arbres', nom: 'Sapins du Bois Noir' } }),
    C(110, 45, { p: 4.5, lieu: 1 }),
    C(95, -45, { p: 3.5, lieu: 1 }),
    D(160, { p: 3.5, lieu: 1 }),
    C(130, 35, { p: 3.5, lieu: 1 }),
    D(260, { p: 3.5, lieu: 1, bord: { cote: 'D', type: 'arbres', nom: 'Sapins du Bois Noir' } }),
    C(130, 65, { p: 4, lieu: 1, ajusteCap: true }),
    D(100, { p: 4 }),
    // la Scierie : gauche lente au pied du Mur, on l'attaque à 70 km/h
    C(45, -90, { p: 4 }),
    // le Mur : droit dans la pente, 320 m de 22 à 30 % (26 % de moyenne), puis 160 m de bascule à 14 et 7 % : la crête
    // est assez longue pour qu'on ne s'y allège pas de plus de 0,4 g à 190 km/h
    D(110, { p: 22, lieu: 2, vib: false }),
    D(130, { p: 30, lieu: 2, vib: false }),
    D(80, { p: 24, lieu: 2, vib: false }),
    D(90, { p: 14, lieu: 2, vib: false }),
    D(70, { p: 7, lieu: 2, vib: false }),
    // replat, puis les lacets (branches à 7,5 %, épingles à 4 %)
    C(60, 90, { p: 2, lieu: 3 }),
    D(320, { p: 6.5, lieu: 3 }),
    C(32, -180, { p: 4, lieu: 3, dv: -3 }),
    D(230, { p: 7.5, lieu: 3, bord: { cote: 'D', type: 'muret', nom: 'Murs des Lacets' } }),
    C(32, 180, { p: 4, lieu: 3, dv: 3 }),
    D(230, { p: 7.5, lieu: 3, bord: { cote: 'G', type: 'muret', nom: 'Murs des Lacets' } }),
    C(34, -180, { p: 4, lieu: 3, dv: -3 }),
    D(200, { p: 5 }),
    // tunnel du Rocher, en légère courbe
    C(300, 20, { p: 4, couvert: { type: 'tunnel', nom: 'Tunnel du Rocher' } }),
    D(200, { p: 4, couvert: { type: 'tunnel', nom: 'Tunnel du Rocher' } }),
    // le Balcon du Cirque : corniche, le cirque à gauche (dans le virage), la paroi à droite
    C(420, -110, { p: 1.5, lieu: 4, dv: -2.5, vib: false, ld: 8.2, bord: { cote: 'G', type: 'vide', nom: 'Balcon du Cirque' } }),
    D(160, { p: 1, lieu: 4, vib: false, bord: { cote: 'G', type: 'vide', nom: 'Balcon du Cirque' } }),
    // le col
    C(180, 40, { p: .5, lieu: 5 }),
    D(260, { p: 0, lieu: 5 }),
    C(180, -40, { p: -3, lieu: 5 }),
    // galerie paravalanche (ouverte à gauche sur le cirque) et tunnel des Échelles
    D(300, { p: -7, couvert: { type: 'galerie', nom: 'Galerie des Avalanches', ouvert: 'G' } }),
    C(250, 40, { p: -8 }),
    D(170, { p: -8, couvert: { type: 'tunnel', nom: 'Tunnel des Échelles' } }),
    C(250, 80, { p: -8 }),
    // l'alpage : la traversée vers l'ouest-nord-ouest, rapide et ouverte, en balcon au-dessus de la vallée
    D(200, { p: -9, ajuste: true }),
    C(170, -40, { p: -9 }),
    C(170, 35, { p: -10 }),
    D(160, { p: -9 }),
    C(160, -125, { p: -8 }),
    // pont de la Gorge, les Mélèzes (forêt claire en descente), puis le virage du Vide (le vide à droite)
    D(130, { p: -1, lieu: 6, pont: { type: 'arche', nom: 'Pont de la Gorge' } }),
    C(150, 40, { p: -8 }),
    D(180, { p: -9, ajuste: true }),
    C(150, -40, { p: -9 }),
    D(120, { p: -7, ajuste: true }),
    C(140, -80, { p: -5, lieu: 7, dv: 2, vib: false, bord: { cote: 'D', type: 'vide', nom: 'Virage du Vide' } }),
    // la vallée : dernière descente le long de la rivière, puis le replat des stands
    D(560, { p: 'a', ajuste: true }),
    D(220, { p: -1.5 }),
    D(120, { p: 0, stands: true, dv: 0 }),
  ],
};

  function longueurDe(q) { return q.t === 'D' ? q.l : q.r * Math.abs(q.a) * RAD; }
  function courbureDe(q) { return q.t === 'D' ? 0 : Math.sign(q.a) / q.r; }

  // Raccords de courbure : rampe linéaire centrée sur la jonction (clothoïde), plus longue pour un plus grand
  // saut de courbure, jamais plus de 45 % de chacune des deux séquences voisines.
  function raccordsPlan(seq) {
    const N = seq.length, T = new Float64Array(N);   // T[m] : raccord entre m - 1 et m
    for (let m = 0; m < N; m++) {
      const a = seq[(m - 1 + N) % N], b = seq[m], dk = Math.abs(b.k - a.k);
      T[m] = dk < 1e-9 ? 0 : Math.min(borner(26 + 520 * dk, 24, 48), .9 * Math.min(a.L, b.L));
    }
    return T;
  }

  // Valeur par morceaux avec raccords linéaires centrés : v[m] sur la séquence m, T[m] le raccord à son début.
  function fonctionRaccordee(seq, v, T) {
    const N = seq.length, B = new Float64Array(N + 1);
    for (let m = 0; m < N; m++) B[m + 1] = B[m] + seq[m].L;
    const S = B[N];
    let m = 0;
    // lecture monotone (s croissant) : l'index de séquence avance sans recherche
    return function (s) {
      if (s < B[m]) m = 0;
      while (m < N - 1 && s >= B[m + 1]) m++;
      const debut = B[m], fin = B[m + 1], Ta = T[m] / 2, Tb = T[(m + 1) % N] / 2;
      const prec = v[(m - 1 + N) % N], suiv = v[(m + 1) % N], ici = v[m];
      // (Ta, Tb nuls : pas de raccord ; s peut dépasser la fin du tour d'un epsilon d'arrondi)
      if (Ta > 0 && s < debut + Ta) return prec + (ici - prec) * (s - (debut - Ta)) / (2 * Ta);
      if (Tb > 0 && s > fin - Tb) return ici + (suiv - ici) * Math.min(1, (s - (fin - Tb)) / (2 * Tb));
      return ici;
    };
  }

  // Intègre le plan au pas fin h ; rend positions et caps aux abscisses j·h.
  function integrerPlan(seq, T, cap0) {
    const N = seq.length, S = seq.reduce((a, q) => a + q.L, 0);
    const nf = Math.ceil(S / .5), h = S / nf, k = fonctionRaccordee(seq, seq.map(q => q.k), T);
    const X = new Float64Array(nf + 1), Z = new Float64Array(nf + 1), A = new Float64Array(nf + 1), K = new Float64Array(nf + 1);
    A[0] = cap0; K[0] = k(0);
    for (let j = 0; j < nf; j++) {
      const s = j * h, k0 = K[j], k1 = k(s + h / 2), k2 = k(s + h);
      const am = A[j] + h / 2 * (k0 + k1) / 2, a2 = A[j] + h * (k0 + 4 * k1 + k2) / 6;
      X[j + 1] = X[j] + h * (Math.cos(A[j]) + 4 * Math.cos(am) + Math.cos(a2)) / 6;
      Z[j + 1] = Z[j] + h * (Math.sin(A[j]) + 4 * Math.sin(am) + Math.sin(a2)) / 6;
      A[j + 1] = a2; K[j + 1] = k2;
    }
    return { X, Z, A, K, nf, h, S };
  }

  // Fermeture : cap total imposé (± 360° × tours) par la courbe désignée, puis position par deux droites
  // désignées. Allonger une droite de δ décale tout ce qui suit de δ·(cos θ, sin θ) : le système est linéaire.
  function fermer(partition) {
    const seq = partition.seq.map(q => ({ ...q }));
    const total = seq.reduce((a, q) => a + (q.t === 'C' ? q.a : 0), 0);
    const vise = 360 * (partition.tours || 1) * Math.sign(total);
    const ic = seq.findIndex(q => q.ajusteCap);
    if (ic < 0) throw new Error(partition.id + ' : aucune courbe ajusteCap');
    seq[ic].a += vise - total;
    if (Math.sign(seq[ic].a) !== Math.sign(partition.seq[ic].a)) throw new Error(partition.id + ' : la courbe ajusteCap change de sens');
    // Groupes de droites ajustables : `ajuste: true` est un groupe à lui seul ; `ajuste: 'nom'` réunit plusieurs
    // droites à peu près parallèles qui se partagent l'allongement au prorata de leur longueur (aucune ne devient
    // démesurée). Direction d'un groupe : la moyenne de ses caps pondérée par les longueurs.
    const groupes = new Map();
    seq.forEach((q, i) => { if (q.t === 'D' && q.ajuste) { const cle = q.ajuste === true ? '#' + i : q.ajuste; if (!groupes.has(cle)) groupes.set(cle, []); groupes.get(cle).push(i); } });
    const listes = [...groupes.values()];
    for (let tour = 0; tour < 8; tour++) {
      for (const q of seq) { q.L = longueurDe(q); q.k = courbureDe(q); }
      const T = raccordsPlan(seq), P = integrerPlan(seq, T, 0);
      const rx = P.X[P.nf], rz = P.Z[P.nf];
      if (Math.hypot(rx, rz) < 1e-6) break;
      const B = [0]; for (const q of seq) B.push(B[B.length - 1] + q.L);
      const capMilieu = i => P.A[Math.round((B[i] + seq[i].L / 2) / P.h)];
      const dir = g => { const tot = g.reduce((t, i) => t + partition.seq[i].l, 0); let ux = 0, uz = 0; for (const i of g) { const w = partition.seq[i].l / tot; ux += w * Math.cos(capMilieu(i)); uz += w * Math.sin(capMilieu(i)); } return { ux, uz, tot }; };
      let choix = null;
      for (let u = 0; u < listes.length; u++) for (let v = u + 1; v < listes.length; v++) {
        const A = dir(listes[u]), Bd = dir(listes[v]), det = A.ux * Bd.uz - A.uz * Bd.ux;
        if (Math.abs(det) < .35) continue;
        const da = (-rx * Bd.uz + rz * Bd.ux) / det, db = (rx * A.uz - rz * A.ux) / det;
        const ok = (g, d, tot) => g.every(i => seq[i].l + d * partition.seq[i].l / tot >= 40);
        if (!ok(listes[u], da, A.tot) || !ok(listes[v], db, Bd.tot)) continue;
        const cout = Math.max(Math.abs(da) / A.tot, Math.abs(db) / Bd.tot);
        if (!choix || cout < choix.cout) choix = { u, v, da, db, ta: A.tot, tb: Bd.tot, cout };
      }
      if (!choix) throw new Error(partition.id + ' : fermeture impossible avec les droites ajustables (résidu ' + Math.hypot(rx, rz).toFixed(1) + ' m)');
      for (const i of listes[choix.u]) seq[i].l += choix.da * partition.seq[i].l / choix.ta;
      for (const i of listes[choix.v]) seq[i].l += choix.db * partition.seq[i].l / choix.tb;
    }
    for (const q of seq) { q.L = longueurDe(q); q.k = courbureDe(q); }
    const T = raccordsPlan(seq), P = integrerPlan(seq, T, 0);
    return { seq, T, P, angleAjuste: seq[ic].a - partition.seq[ic].a,
      allongements: seq.map((q, i) => q.t === 'D' ? q.l - partition.seq[i].l : 0) };
  }

  function moyenneCirculaire(tab, F) {
    const n = tab.length, r = new Float64Array(n);
    let somme = 0;
    for (let j = -F; j <= F; j++) somme += tab[(j + n) % n];
    for (let i = 0; i < n; i++) { r[i] = somme / (2 * F + 1); somme += tab[(i + F + 1) % n] - tab[(i - F + n) % n]; }
    return r;
  }
  function limitesAuto(courbure, n, largeur) {
    const Gc = new Float32Array(n), D = new Float32Array(n), F = Math.round(36 / PAS);
    for (let i = 0; i < n; i++) {
      let g = LIMITE, d = LIMITE;
      for (let j = -F; j <= F; j++) {
        const k = courbure[(i + j + n) % n];
        if (k > 1e-6) d = Math.min(d, .62 / k - 2); else if (k < -1e-6) g = Math.min(g, .62 / -k - 2);
      }
      Gc[i] = Math.max(largeur / 2 + 3.2, g); D[i] = Math.max(largeur / 2 + 3.2, d);
    }
    return { G: Gc, D };
  }

  function creer(options = {}) {
    const etude = options.etude === true;
    const partition = { ...PARTITION, seq: PARTITION.seq.map(q => ({ ...q })) };
    if (!etude) {
      // Révision originale bornée par le plan reçu : davantage de Mur et un palier doux avant les épingles.
      // Les droites ajustables referment ensuite le plan par le même système métrique que l’étude.
      partition.seq[16].l = 150; // 110 + 40 m à 22 %
      partition.seq[20].l = 100; // 70 + 30 m à 7 % pour la bascule haute
      partition.seq[22].p = 3;   // première branche des Lacets, auparavant à 6,5 %
    }
    const { seq, T: Tplan, P, angleAjuste, allongements } = fermer(partition);
    const S = P.S, n = Math.round(S / PAS), ds = S / n, w = LARGEUR / 2;
    const bornes = [0]; for (const q of seq) bornes.push(bornes[bornes.length - 1] + q.L);
    // rééchantillonnage au pas du jeu (≈ 2 m), résidu de fermeture réparti linéairement (de l'ordre du micron)
    const x = new Float64Array(n), z = new Float64Array(n), cap = new Float64Array(n), courbure = new Float64Array(n);
    const seqDe = new Uint16Array(n), ex = P.X[P.nf] - P.X[0], ez = P.Z[P.nf] - P.Z[0];
    const ea = P.A[P.nf] - P.A[0] - 2 * Math.PI * (partition.tours || 1) * Math.sign(P.A[P.nf] - P.A[0]);
    let m = 0;
    for (let i = 0; i < n; i++) {
      const s = i * ds, f = s / P.h, j = Math.min(P.nf - 1, Math.floor(f)), t = f - j, u = s / S;
      x[i] = P.X[j] + (P.X[j + 1] - P.X[j]) * t - ex * u;
      z[i] = P.Z[j] + (P.Z[j + 1] - P.Z[j]) * t - ez * u;
      cap[i] = angle(P.A[j] + (P.A[j + 1] - P.A[j]) * t - ea * u);
      courbure[i] = P.K[j] + (P.K[j + 1] - P.K[j]) * t;
      while (m < seq.length - 1 && s >= bornes[m + 1]) m++;
      seqDe[i] = m;
    }
    const iDe = s => ((Math.round(s / ds) % n) + n) % n;

    // Profil historique conservé comme géométrie : longueurs des raccords paraboliques archivées.
    // Aucune vitesse p9/p10 n'entre dans la conduite ou dans la consigne IA p15.
    const auto = seq.map(q => q.p === 'a');
    const sommeFixe = seq.reduce((a, q, k) => a + (auto[k] ? 0 : (q.p || 0) / 100 * q.L), 0);
    const longueurAuto = seq.reduce((a, q, k) => a + (auto[k] ? q.L : 0), 0);
    const paliers = seq.map((q, k) => auto[k] ? -sommeFixe / longueurAuto : (q.p || 0) / 100);
    const N = seq.length, profil = fonctionRaccordee(seq, paliers, RACCORDS_PENTE);
    const y = new Float64Array(n), pente = new Float64Array(n), kv = new Float64Array(n);
    for (let i = 0; i < n; i++) pente[i] = profil(i * ds);
    for (let i = 1; i < n; i++) y[i] = y[i - 1] + (pente[i - 1] + pente[i]) / 2 * ds;
    const ey = y[n - 1] + (pente[n - 1] + pente[0]) / 2 * ds;
    for (let i = 0; i < n; i++) { y[i] -= ey * i / n; pente[i] -= ey / S; }
    for (let i = 0; i < n; i++) kv[i] = (pente[(i + 1) % n] - pente[(i - 1 + n) % n]) / (2 * ds * Math.pow(1 + pente[i] * pente[i], 1.5));
    const devBrut = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const q = seq[seqDe[i]];
      devBrut[i] = q.dv != null ? q.dv * RAD : (q.stands || q.couvert) ? 0 : borner(courbure[i] * 1.6, -.045, .045);
    }
    const devers = moyenneCirculaire(devBrut, 10);

    // ---- limites : automatiques comme le jeu, puis imposées par séquence (couverts, ponts, bords dangereux),
    // resserrées en entonnoir (pente latérale ≤ 0,35) pour qu'une glissière ne saute jamais.
    const lim = limitesAuto(courbure, n, LARGEUR), MUR = w + 1.6, PARAPET = w + 1.5;
    const imposeG = new Float32Array(n).fill(Infinity), imposeD = new Float32Array(n).fill(Infinity);
    for (let i = 0; i < n; i++) {
      const q = seq[seqDe[i]];
      let g = q.lg != null ? q.lg : Infinity, d = q.ld != null ? q.ld : Infinity;
      if (q.couvert) { g = Math.min(g, MUR); d = Math.min(d, MUR); }
      if (q.pont) { g = Math.min(g, PARAPET); d = Math.min(d, PARAPET); }
      for (const b of [].concat(q.bord || [])) {
        const v = b.type === 'vide' ? w + 1.4 : b.type === 'muret' ? w + 1.0 : b.type === 'fosse' ? w + 2.5 : Infinity;
        if (b.cote === 'G') g = Math.min(g, v); else d = Math.min(d, v);
      }
      imposeG[i] = g; imposeD[i] = d;
    }
    for (const [L, I] of [[lim.G, imposeG], [lim.D, imposeD]]) {
      for (let i = 0; i < n; i++) if (I[i] < L[i]) L[i] = I[i];
      for (let t = 0; t < 2; t++) {
        for (let j = 1; j <= 2 * n; j++) { const i = j % n, p = (i - 1 + n) % n; L[i] = Math.min(L[i], L[p] + .35 * ds); }
        for (let j = 2 * n - 1; j >= 0; j--) { const i = j % n, s = (i + 1) % n; L[i] = Math.min(L[i], L[s] + .35 * ds); }
      }
      for (let i = 0; i < n; i++) L[i] = Math.max(L[i], w + .9);
    }

    // ---- vibreurs comme le jeu, sauf où la séquence les refuse (route de montagne, corniche, pont, couvert)
    const vibreur = new Uint8Array(n), V = Math.round(15 / PAS);
    for (let i = 0; i < n; i++) if (Math.abs(courbure[i]) > 1 / 140) for (let j = -V; j <= V; j++) {
      const k = (i + j + n) % n, q = seq[seqDe[k]];
      if (q.vib !== false && !q.couvert && !q.pont) vibreur[k] = 3;
    }

    // ---- éléments nommés : plages d'abscisses fusionnées par nom
    function plages(cle) {
      const sortie = [];
      for (let k = 0; k < N; k++) for (const e of [].concat(seq[k][cle] || [])) {
        const nom = e.nom || cle, der = sortie[sortie.length - 1];
        if (der && der.nom === nom && Math.abs(der.fin - bornes[k]) < 1e-6) der.fin = bornes[k + 1];
        else sortie.push({ ...e, nom, debut: bornes[k], fin: bornes[k + 1] });
      }
      return sortie;
    }
    const couverts = plages('couvert').map((t, i) => ({ ...t, id: 'cimes-couvert-' + i, mur: MUR, hauteur: 6.4 })), ponts = plages('pont'), bords = plages('bord');
    const lieux = (partition.lieux || []).map(l => {
      const ks = seq.map((q, k) => q.lieu === l.n ? k : -1).filter(k => k >= 0);
      return { ...l, debut: ks.length ? bornes[ks[0]] : 0, fin: ks.length ? bornes[ks[ks.length - 1] + 1] : 0 };
    });

    // ---- tunnel au sens du jeu actuel (un seul, c.tunnel) : le premier passage couvert de type tunnel
    const premierTunnel = couverts.find(t => t.type === 'tunnel');
    const tunnel = premierTunnel || null;

    // ---- ligne droite des stands : la première et la dernière séquence (le départ est entre les deux)
    const debutDroite = -Math.round(seq[N - 1].L / PAS) * PAS, finDroite = Math.round(seq[0].L / PAS) * PAS;
    const av = Math.max(-300, debutDroite + 40), ap = Math.min(260, finDroite - 60);
    const s0 = Math.max(av + 30, 30), g0 = s0 + 40, g1 = g0 + 48, s1 = ap - 20;
    const stands = (s1 - s0 > 140 && g1 + 20 < s1) ? { cote: 1, d: LARGEUR / 2 - 1.6, demi: 1.6, debut: s0, fin: s1, garage0: g0, garage1: g1, vitesse: 11 } : null;

    const c = {
      graine: partition.graine, nom: partition.nom, theme: partition.theme, longueur: S, pas: ds, n,
      x, y, z, cap, courbure, pente, devers, largeur: LARGEUR, vibreur,
      limite: LIMITE, limiteG: lim.G, limiteD: lim.D,
      depart: 0, ligneDroite: { debut: debutDroite, fin: finDroite }, secteurs: [Math.round(n / 3) * ds, Math.round(2 * n / 3) * ds],
      tunnel, stands, essais: 1,
      generation: 4, type: 'trace-dirige', partition: partition.id, pretPourCourse: false, id: partition.id, lieux, couverts, ponts, bords, seqDe, sequences: seq.map((q, k) => ({ ...q, debut: bornes[k], fin: bornes[k + 1] })),
      kv, pasReel: ds, provenance: Object.freeze({ ...PROVENANCE, variante: etude ? 'etude-temoin' : 'reconstruction-2026-11-20' }),
      fermeture: { angleAjuste, allongements, residuPlan: Math.hypot(ex, ez), residuCap: ea, residuVertical: ey },
    };
    if (!B.circuit?.preparerParcours) throw new Error('Route-des-Cimes : préparation de parcours absente');
    B.circuit.preparerParcours(c);
    // Garde des crêtes sans appui aérodynamique, puis enveloppe de freinage corrigée de la gravité.
    // La preuve de roulage reste celle du vrai châssis PhysX ; cette table est une consigne IA, pas un oracle.
    for (let i = 0; i < n; i++) if (kv[i] < -1e-7)
      c.vitesse[i] = Math.min(c.vitesse[i], Math.sqrt(.45 * G / Math.sqrt(1 + pente[i] * pente[i]) / -kv[i]));
    for (let j = 2 * n - 1; j >= 0; j--) {
      const i = j % n, suivant = (i + 1) % n, sinus = pente[i] / Math.sqrt(1 + pente[i] * pente[i]);
      const dec = Math.max(3, 10 + G * sinus);
      c.vitesse[i] = Math.min(c.vitesse[i], Math.sqrt(c.vitesse[suivant] ** 2 + 2 * dec * ds));
    }
    c.mesures = mesurer(c);
    return c;
  }


  function mesurer(c) {
    let min = Infinity, max = -Infinity, penteMin = Infinity, penteMax = -Infinity, kmax = 0, au20 = 0;
    for (let i = 0; i < c.n; i++) {
      min = Math.min(min, c.y[i]); max = Math.max(max, c.y[i]);
      penteMin = Math.min(penteMin, c.pente[i]); penteMax = Math.max(penteMax, c.pente[i]);
      kmax = Math.max(kmax, Math.abs(c.courbure[i])); if (c.pente[i] >= .2) au20 += c.pas;
    }
    return { longueur: c.longueur, denivele: max - min, penteMin, penteMax, rayonMin: 1 / kmax,
      longueurAu20: au20, longueurCouverte: c.couverts.reduce((s, t) => s + t.fin - t.debut, 0),
      ecartAuPlanFinalM: c.longueur - PROVENANCE.longueurPlanFinalM };
  }
  function valider(c) {
    const pb = [], n = c?.n;
    if (!Number.isInteger(n) || n < 8 || !(c.pas > 0) || !Number.isFinite(c.longueur)) return ['grille métrique invalide'];
    if (Math.abs(c.longueur - n * c.pas) > 1e-7) pb.push('longueur incohérente');
    const champs = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse', 'limiteG', 'limiteD'];
    if (!champs.every(k => c[k]?.length === n && c[k].every(Number.isFinite))) return pb.concat('données non finies');
    const s = Math.hypot(c.x[0] - c.x[n - 1], c.z[0] - c.z[n - 1]);
    if (Math.abs(s - c.pas) > .01 || Math.abs(angle(c.cap[0] - c.cap[n - 1])) > .001 || Math.abs(c.y[0] - c.y[n - 1]) > .01) pb.push('boucle mal refermée');
    const m = mesurer(c);
    if (m.rayonMin < 31.99 || m.penteMax > .30001 || m.penteMin < -.10001) pb.push('géométrie hors enveloppe');
    for (let i = 0; i < n; i++) if (c.limiteG[i] < c.largeur / 2 + .89 || c.limiteD[i] < c.largeur / 2 + .89 || c.vitesse[i] < 1) { pb.push('corridor ou consigne invalide'); break; }
    if (c.couverts.length !== 3 || c.ponts.length !== 1 || c.lieux.length !== 7 || !c.stands) pb.push('ouvrages ou lieux incomplets');
    return pb;
  }
  B.routeDesCimes = { creer, mesurer, valider, provenance: PROVENANCE };
})(globalThis.BITUME = globalThis.BITUME || {});
