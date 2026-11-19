/* BITUME — lot 22F « circuits mémorables » : prototype du tracé dirigé (outil d'étude, hors du jeu).

   Le générateur du jeu (src/circuit.js) part d'un polygone étoilé : il ne sait pas poser un lieu. Ici, un circuit
   est écrit comme une partition, une suite de séquences typées (droite, courbe à rayon et angle donnés) qui portent
   chacune leur pente, leur dévers, leurs limites, un passage couvert, un pont, un bord dangereux ou un lieu. Le
   tracé est intégré exactement (courbure linéaire dans les raccords, qui préservent l'angle total), refermé en cap
   par une courbe désignée et en position par deux droites désignées (système linéaire 2 × 2, exact puisque le cap
   d'une droite est constant), puis le profil en long est posé en paliers de pente reliés par des raccords
   paraboliques dont la longueur vient de la vitesse et de la charge verticale admise (crête : 0,4 g ; creux : 0,7 g).

   Tout est dans une seule fonction autonome, `fabriqueTrace`, pour pouvoir être injectée telle quelle dans la page
   du jeu (fabriqueTrace.toString()) et y remplacer un circuit le temps d'une capture, sans toucher aux sources.
   L'objet rendu a les champs que lit le jeu (x, y, z, cap, courbure, pente, devers, ligne, vitesse, limiteG/D,
   ligneDroite, stands, tunnel…) plus ceux de l'étude (lieux, couverts, ponts, bords, croisements, mesures). */

export function fabriqueTrace() {
  'use strict';
  const PAS = 2, LARGEUR = 12, LIMITE = 20, G = 9.81, RAD = Math.PI / 180;
  const angle = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  const borner = (v, a, b) => v < a ? a : v > b ? b : v;

  // ---------------------------------------------------------------- séquences
  // Une séquence : { t: 'D', l } ou { t: 'C', r, a } (a en degrés, > 0 = virage à droite, le cap croît).
  // Options : p (pente en %, ou 'a' = palier ajusté pour refermer le profil), dv (dévers imposé en degrés,
  // > 0 = côté droit plus bas), lg / ld (limite gauche / droite imposée, m depuis l'axe), vib (false : pas de
  // vibreurs), stands, couvert { type, nom }, pont { type, nom }, bord ({ cote: 'G'|'D', type, nom } ou liste),
  // croise (nom d'un croisement déclaré), lieu (numéro), ajuste (droite que la fermeture peut allonger).
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

  // ---------------------------------------------------------------- outils repris de src/circuit.js
  function moyenneCirculaire(tab, F) {
    const n = tab.length, r = new Float64Array(n);
    let somme = 0;
    for (let j = -F; j <= F; j++) somme += tab[(j + n) % n];
    for (let i = 0; i < n; i++) { r[i] = somme / (2 * F + 1); somme += tab[(i + F + 1) % n] - tab[(i - F + n) % n]; }
    return r;
  }
  function trajectoire(x, z, cap, n, largeur) {
    const d = new Float64Array(n), borne = largeur / 2 - 1.4;
    const rx = new Float64Array(n), rz = new Float64Array(n);
    for (let i = 0; i < n; i++) { rx[i] = -Math.sin(cap[i]); rz[i] = Math.cos(cap[i]); }
    for (const [h, tours] of [[24, 140], [12, 140], [6, 120], [3, 100], [1, 80]]) {
      for (let t = 0; t < tours; t++) for (let i = 0; i < n; i++) {
        const a = (i - h + n) % n, b = (i + h) % n;
        const mx = (x[a] + rx[a] * d[a] + x[b] + rx[b] * d[b]) / 2, mz = (z[a] + rz[a] * d[a] + z[b] + rz[b] * d[b]) / 2;
        const cible = (mx - x[i]) * rx[i] + (mz - z[i]) * rz[i];
        d[i] = borner(d[i] + .55 * (cible - d[i]), -borne, borne);
      }
    }
    return d;
  }
  const poussee = u => Math.max(.05, Math.min(12, 15.59 - .2592 * u + .000899 * u * u));
  function courbureLigne(x, z, cap, ligne, n) {
    const px = new Float64Array(n), pz = new Float64Array(n), k = new Float64Array(n), H = 3;
    for (let i = 0; i < n; i++) { px[i] = x[i] - Math.sin(cap[i]) * ligne[i]; pz[i] = z[i] + Math.cos(cap[i]) * ligne[i]; }
    for (let i = 0; i < n; i++) {
      const a = (i - H + n) % n, b = (i + H) % n;
      const a1 = Math.atan2(pz[i] - pz[a], px[i] - px[a]), a2 = Math.atan2(pz[b] - pz[i], px[b] - px[i]);
      const ds = (Math.hypot(pz[i] - pz[a], px[i] - px[a]) + Math.hypot(pz[b] - pz[i], px[b] - px[i])) / 2;
      k[i] = angle(a2 - a1) / Math.max(ds, .5);
    }
    return k;
  }
  // Vitesse de référence du jeu actuel (p9) : plat, freinage constant de 16 m/s², poussée sans pente.
  function vitessesP9(kl, n) {
    const MU = 1.55, AERO = .00155, VMAX = 86, v = new Float64Array(n);
    for (let i = 0; i < n; i++) { const den = Math.abs(kl[i]) - MU * AERO; v[i] = den <= 0 ? VMAX : Math.min(VMAX, Math.sqrt(MU * G / den)); }
    for (let j = 2 * n - 1; j >= 0; j--) { const i = j % n, s = (i + 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[s] * v[s] + 2 * 16 * PAS)); }
    for (let j = 1; j <= 2 * n; j++) { const i = j % n, p = (i - 1 + n) % n; v[i] = Math.min(v[i], Math.sqrt(v[p] * v[p] + 2 * poussee(v[p]) * PAS)); }
    return v;
  }
  // Proposition p10 (exigence pour le lot physique) : charge normale g·cos θ·cos β + appui + v²·κv (crête :
  // κv < 0, la voiture s'allège ; creux : elle s'écrase), dévers qui aide ou qui gêne, garde au décollage
  // (au moins 10 % de charge sur une crête), freinage et poussée corrigés de la gravité le long de la pente.
  function vitessesP10(kl, pente, devers, kv, n) {
    const MU = 1.55, AERO = .00155, VMAX = 86, v = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const c = 1 / Math.sqrt(1 + pente[i] * pente[i]), sgn = Math.sign(kl[i]) || 1;
      const den = Math.abs(kl[i]) - MU * AERO - MU * kv[i];
      const num = MU * G * c * Math.cos(devers[i]) + G * Math.sin(devers[i]) * sgn;
      let vi = den <= 0 ? VMAX : Math.min(VMAX, Math.sqrt(Math.max(1, num) / den));
      if (kv[i] < -1e-6) vi = Math.min(vi, Math.sqrt(.9 * G * c / -kv[i]));
      v[i] = vi;
    }
    const sinus = p => p / Math.sqrt(1 + p * p);
    for (let j = 2 * n - 1; j >= 0; j--) {
      const i = j % n, s = (i + 1) % n, c = 1 / Math.sqrt(1 + pente[i] * pente[i]);
      const dec = Math.max(2, 16 * c + G * sinus(pente[i]));
      v[i] = Math.min(v[i], Math.sqrt(v[s] * v[s] + 2 * dec * PAS));
    }
    for (let j = 1; j <= 2 * n; j++) {
      const i = j % n, p = (i - 1 + n) % n, acc = poussee(v[p]) - G * sinus(pente[p]);
      v[i] = Math.min(v[i], Math.sqrt(Math.max(36, v[p] * v[p] + 2 * acc * PAS)));
    }
    return v;
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

  // ---------------------------------------------------------------- construction complète
  function construire(partition, options = {}) {
    const { seq, T: Tplan, P, angleAjuste, allongements } = fermer(partition);
    const S = P.S, n = Math.round(S / PAS), ds = S / n, w = LARGEUR / 2;
    const B = [0]; for (const q of seq) B.push(B[B.length - 1] + q.L);
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
      while (m < seq.length - 1 && s >= B[m + 1]) m++;
      seqDe[i] = m;
    }
    const iDe = s => ((Math.round(s / ds) % n) + n) % n;

    // ---- profil en long : paliers de pente et raccords paraboliques, deux passes avec la vitesse p10
    const auto = seq.map(q => q.p === 'a');
    const sommeFixe = seq.reduce((a, q, k) => a + (auto[k] ? 0 : (q.p || 0) / 100 * q.L), 0);
    const longueurAuto = seq.reduce((a, q, k) => a + (auto[k] ? q.L : 0), 0);
    if (!longueurAuto) throw new Error(partition.id + " : aucun palier de pente 'a' pour refermer le profil");
    const penteAuto = -sommeFixe / longueurAuto;
    const paliers = seq.map((q, k) => auto[k] ? penteAuto : (q.p || 0) / 100);
    let y = new Float64Array(n), pente = new Float64Array(n), kv = new Float64Array(n), vitesse = null, vitesse9 = null;
    let devers = new Float64Array(n), ligne = null, kl = null;
    const N = seq.length;
    const vitesseJonction = new Float64Array(N).fill(30);
    // dévers : automatique comme le jeu (borné à ± 2,6°), imposé par séquence, nul aux stands et sous couvert
    const devBrut = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const q = seq[seqDe[i]];
      devBrut[i] = q.dv != null ? q.dv * RAD : (q.stands || q.couvert) ? 0 : borner(courbure[i] * 1.6, -.045, .045);
    }
    devers = moyenneCirculaire(devBrut, 10);
    ligne = trajectoire(x, z, cap, n, LARGEUR);
    kl = courbureLigne(x, z, cap, ligne, n);
    vitesse9 = vitessesP9(kl, n);
    // vitesse de dimensionnement d'un raccord : la plus haute (p9 ou p10) à ± 40 m de la jonction. Prendre la
    // vitesse p10 à la jonction même tournerait en rond : la garde de crête l'abaisse justement là.
    const vitesseAutour = (s0, ...series) => {
      let v = 0;
      for (let d = -40; d <= 40; d += ds) { const i = iDe(s0 + d); for (const t of series) v = Math.max(v, t[i]); }
      return v;
    };
    for (let k = 0; k < N; k++) vitesseJonction[k] = vitesseAutour(B[k], vitesse9);
    let Tv = new Float64Array(N);
    for (let passe = 0; passe < 3; passe++) {
      for (let k = 0; k < N; k++) {
        const a = paliers[(k - 1 + N) % N], b = paliers[k], dp = b - a, v = vitesseJonction[k];
        const alpha = dp < 0 ? .4 : .7;   // crête : allègement ≤ 0,4 g ; creux : écrasement ≤ 0,7 g
        Tv[k] = Math.abs(dp) < 1e-6 ? 0 : Math.min(Math.max(60, Math.abs(dp) * v * v / (alpha * G)), .9 * Math.min(seq[(k - 1 + N) % N].L, seq[k].L));
      }
      const p = fonctionRaccordee(seq, paliers, Tv);
      for (let i = 0; i < n; i++) pente[i] = p(i * ds);
      y = new Float64Array(n);
      for (let i = 1; i < n; i++) y[i] = y[i - 1] + (pente[i - 1] + pente[i]) / 2 * ds;
      const ey = y[n - 1] + (pente[n - 1] + pente[0]) / 2 * ds;
      for (let i = 0; i < n; i++) y[i] -= ey * i / n;
      for (let i = 0; i < n; i++) {
        const dp = (pente[(i + 1) % n] - pente[(i - 1 + n) % n]) / (2 * ds);
        kv[i] = dp / Math.pow(1 + pente[i] * pente[i], 1.5);
      }
      vitesse = vitessesP10(kl, pente, devers, kv, n);
      for (let k = 0; k < N; k++) vitesseJonction[k] = vitesseAutour(B[k], vitesse9, vitesse);
    }

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
        if (der && der.nom === nom && Math.abs(der.fin - B[k]) < 1e-6) der.fin = B[k + 1];
        else sortie.push({ ...e, nom, debut: B[k], fin: B[k + 1] });
      }
      return sortie;
    }
    const couverts = plages('couvert'), ponts = plages('pont'), bords = plages('bord');
    const lieux = (partition.lieux || []).map(l => {
      const ks = seq.map((q, k) => q.lieu === l.n ? k : -1).filter(k => k >= 0);
      return { ...l, debut: ks.length ? B[ks[0]] : 0, fin: ks.length ? B[ks[ks.length - 1] + 1] : 0 };
    });

    // ---- tunnel au sens du jeu actuel (un seul, c.tunnel) : le premier passage couvert de type tunnel
    const premierTunnel = couverts.find(t => t.type === 'tunnel');
    const tunnel = premierTunnel ? { debut: Math.round(premierTunnel.debut / PAS) * PAS, fin: Math.round(premierTunnel.fin / PAS) * PAS, mur: MUR, hauteur: 6.4 } : null;

    // ---- ligne droite des stands : la première et la dernière séquence (le départ est entre les deux)
    const debutDroite = -Math.round(seq[N - 1].L / PAS) * PAS, finDroite = Math.round(seq[0].L / PAS) * PAS;
    const av = Math.max(-300, debutDroite + 40), ap = Math.min(260, finDroite - 60);
    const s0 = Math.max(av + 30, 30), g0 = s0 + 40, g1 = g0 + 48, s1 = ap - 20;
    const stands = (s1 - s0 > 140 && g1 + 20 < s1) ? { cote: 1, d: LARGEUR / 2 - 1.6, demi: 1.6, debut: s0, fin: s1, garage0: g0, garage1: g1, vitesse: 11 } : null;

    const c = {
      graine: partition.graine, nom: partition.nom, theme: partition.theme, longueur: n * PAS, pas: PAS, n,
      x, y, z, cap, courbure, pente, devers, largeur: LARGEUR, vibreur, ligne, vitesse: options.vitesse === 'p9' ? vitesse9 : vitesse,
      limite: LIMITE, limiteG: lim.G, limiteD: lim.D,
      depart: 0, ligneDroite: { debut: debutDroite, fin: finDroite }, secteurs: [Math.round(n / 3) * PAS, Math.round(2 * n / 3) * PAS],
      tunnel, stands, essais: 1,
      generation: 3, id: partition.id, lieux, couverts, ponts, bords, seqDe, sequences: seq.map((q, k) => ({ ...q, debut: B[k], fin: B[k + 1] })),
      vitesseP9: vitesse9, vitesseP10: vitesse, kv, pasReel: ds,
      fermeture: { angleAjuste, allongements },
    };
    c.mesures = mesurer(c);
    return c;
  }

  // ---------------------------------------------------------------- mesures et contrôles
  function nombreVirages(courbure, n, seuil) {
    let compte = 0, dans = false;
    for (let i = 0; i < n; i++) { const v = Math.abs(courbure[i]) > seuil; if (v && !dans) compte++; dans = v; }
    if (dans && Math.abs(courbure[0]) > seuil && compte > 1) compte--;
    return compte;
  }
  function mesurer(c) {
    const n = c.n, ds = c.pasReel;
    let ymin = Infinity, ymax = -Infinity, pmax = -Infinity, pmin = Infinity, kmax = 0, droit = 0;
    let au10 = 0, au20 = 0, chargeMin = Infinity, chargeMax = -Infinity, chargeMinOu = 0, chargeMaxOu = 0, t9 = 0, t10 = 0;
    for (let i = 0; i < n; i++) {
      ymin = Math.min(ymin, c.y[i]); ymax = Math.max(ymax, c.y[i]);
      pmax = Math.max(pmax, c.pente[i]); pmin = Math.min(pmin, c.pente[i]); kmax = Math.max(kmax, Math.abs(c.courbure[i]));
      if (Math.abs(c.courbure[i]) < 1 / 900) droit++;
      if (Math.abs(c.pente[i]) >= .10) au10 += ds;
      if (Math.abs(c.pente[i]) >= .20) au20 += ds;
      const v = c.vitesseP10[i], cos = 1 / Math.sqrt(1 + c.pente[i] * c.pente[i]);
      const charge = cos + v * v * c.kv[i] / G;   // en g, sans l'appui aérodynamique
      if (charge < chargeMin) { chargeMin = charge; chargeMinOu = i * ds; }
      if (charge > chargeMax) { chargeMax = charge; chargeMaxOu = i * ds; }
      t9 += ds / c.vitesseP9[i]; t10 += ds / c.vitesseP10[i];
    }
    // séparation : plus petite distance en plan entre deux points à plus de 150 m le long du tour, hors des
    // croisements déclarés (deux séquences « croise » du même nom, au moins 8 m l'une au-dessus de l'autre)
    const ecart = Math.ceil(150 / ds);
    let sep = Infinity, ouSep = null, croisements = new Map();
    for (let i = 0; i < n; i += 2) for (let j = i + ecart; j < n; j += 2) {
      if (n - (j - i) < ecart) continue;
      const dx = c.x[i] - c.x[j], dz = c.z[i] - c.z[j], d = Math.hypot(dx, dz);
      if (d >= 60) continue;
      const qi = c.sequences[c.seqDe[i]], qj = c.sequences[c.seqDe[j]], dy = Math.abs(c.y[i] - c.y[j]);
      if (qi.croise && qi.croise === qj.croise && dy >= 8) {
        const e = croisements.get(qi.croise);
        if (!e || d < e.distance) croisements.set(qi.croise, { nom: qi.croise, distance: d, ecartVertical: dy, s1: i * ds, s2: j * ds, x: (c.x[i] + c.x[j]) / 2, z: (c.z[i] + c.z[j]) / 2 });
        continue;
      }
      if (d < sep) { sep = d; ouSep = [i * ds, j * ds]; }
    }
    c.croisements = [...croisements.values()];
    return {
      longueur: c.longueur, denivele: ymax - ymin, altitudeMin: ymin, altitudeMax: ymax,
      penteMax: pmax * 100, penteMin: pmin * 100, longueurAu10: au10, longueurAu20: au20,
      rayonMin: 1 / kmax, partDroite: droit / n, virages: nombreVirages(c.courbure, n, 1 / 70),
      separation: sep, separationOu: ouSep, chargeMin, chargeMinOu, chargeMax, chargeMaxOu, tourP9: t9, tourP10: t10,
      couverts: c.couverts.length, longueurCouverte: c.couverts.reduce((a, t) => a + t.fin - t.debut, 0), ponts: c.ponts.length, bords: c.bords.length,
    };
  }

  // Contrôles d'une partition construite : ce que le jeu et l'étude exigent.
  function controler(c, attentes = {}) {
    const pb = [], M = c.mesures;
    const finis = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse'].every(k => c[k].length === c.n && c[k].every(Number.isFinite));
    if (!finis) pb.push('valeurs non finies');
    const fx = c.x[0] - c.x[c.n - 1], fz = c.z[0] - c.z[c.n - 1];
    if (Math.abs(Math.hypot(fx, fz) - c.pasReel) > .05) pb.push('boucle mal refermée (' + Math.hypot(fx, fz).toFixed(3) + ' m)');
    const saut = c.y[0] - (c.y[c.n - 1] + (c.pente[c.n - 1] + c.pente[0]) / 2 * c.pasReel);
    if (Math.abs(saut) > .05) pb.push('profil mal refermé (' + saut.toFixed(3) + ' m)');
    if (M.rayonMin < 24) pb.push('rayon minimal inférieur à 24 m');
    if (M.separation < 60) pb.push('deux portions à ' + M.separation.toFixed(1) + ' m (s = ' + M.separationOu.map(v => v.toFixed(0)).join(' / ') + ')');
    if (attentes.penteMax != null && M.penteMax > attentes.penteMax + .01) pb.push('pente ' + M.penteMax.toFixed(1) + ' % > ' + attentes.penteMax + ' %');
    // règle validée : une crête n'allège pas de plus de 0,4 g ; le prototype tolère 0,5 g là où une séquence courte
    // borne le raccord, et le signale au-delà
    if (M.chargeMin < .5) pb.push('crête trop vive : charge ' + M.chargeMin.toFixed(2) + ' g');
    for (const t of c.couverts) if (t.type === 'tunnel' && t.fin - t.debut < 60) pb.push('tunnel ' + t.nom + ' trop court');
    if (!c.stands) pb.push('pas de place pour les stands');
    return pb;
  }

  // Esquisse sans fermeture en position : pour écrire une partition, voir où le tour arrive et d'où partent les
  // séquences (point, cap) avant de choisir les droites qui refermeront la boucle.
  function esquisse(partition) {
    const seq = partition.seq.map(q => ({ ...q, L: longueurDe(q), k: courbureDe(q) }));
    const T = raccordsPlan(seq), P = integrerPlan(seq, T, 0), B = [0];
    for (const q of seq) B.push(B[B.length - 1] + q.L);
    const departs = seq.map((q, k) => { const j = Math.round(B[k] / P.h); return { k, x: P.X[j], z: P.Z[j], cap: P.A[j] / RAD }; });
    return { P, B, seq, departs, fin: [P.X[P.nf], P.Z[P.nf]], capFin: P.A[P.nf] / RAD, longueur: P.S };
  }

  return { construire, controler, mesurer, fermer, esquisse, PAS, LARGEUR };
}

export const TRACE = fabriqueTrace();
