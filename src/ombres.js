/* BITUME — ombres photo (lot 21, étape 1), sur l'option ombresPhoto de FERRO 0.3.11.
   Une fois par vue, juste avant rendu.draw : le contact des voitures proches (O1), la tuile d'ombre de la voiture
   filmée (O3) et la pénombre (O4) selon le palier ; au lancement d'une séance, la carte d'ombre lointaine du circuit
   (O2, une fois par décor, seulement si des ombres du soleil sont possibles) ; et le journal du niveau de la qualité
   Auto (O5). Tableaux réservés à la création : rien n'est alloué à l'image. */
(function (B) {
  'use strict';

  // Places du shader (FERRO en lit six au plus) : six en Moyenne et Fine, quatre en Légère.
  const PLACES = 6, PLACES_LEGERE = 4, FLOTTANTS = 24;
  // Force selon la distance à la caméra : entière jusqu'à 45 m, nulle à 60 m (au-delà, le contact fait moins d'un
  // pixel de haut). Une voiture derrière la caméra passe après celles de devant : jusqu'à 30 m de pénalité, en
  // fondu selon l'angle (aucun saut quand elle passe à côté de la caméra).
  const PLEINE = 45, PORTEE = 60, DERRIERE = 30;
  // Chaque force suit aussi l'écart avec la première voiture laissée dehors (entière à 6 m d'écart, nulle à égalité ;
  // à défaut, avec la portée). Ce score est continu quand les voitures se doublent : une voiture n'entre jamais dans
  // la liste ni n'en sort d'un coup, et un échange de places dans la liste ne change aucune force.
  const ECART = 6;
  // Part de la variation appliquée par préparation et seuil de fin du fondu.
  const LISSAGE_CONTACT = .15, FORCE_MIN = 1e-3;
  // Caisse de la 312 T5 vue par l'occlusion : ellipsoïde de 4,2 × 0,68 × 1,26 m, centre 10 cm en arrière du milieu
  // des essieux et 38 cm au-dessus du sol (fond plat à 4 cm). Roues : celles de src/voiture.js.
  const CAISSE_X = -.10, CAISSE_Y = .38, DEMI_LONGUEUR = 2.10, DEMI_HAUTEUR = .34, DEMI_LARGEUR = .63;
  const ROUES_312 = [{ x: 1.35, z: -.85, r: .29, l: .28 }, { x: 1.35, z: .85, r: .29, l: .28 },
    { x: -1.35, z: -.8075, r: .335, l: .46 }, { x: -1.35, z: .8075, r: .335, l: .46 }];
  // Terme de FERRO : part retirée à l'ambiance, part retirée au soleil, exposant du soleil, marge de portée (m) autour
  // de la demi-longueur. Sans carte d'ombre (Légère), le contact tient aussi lieu d'ombre portée sous la voiture :
  // plus de soleil retiré, sur toute la zone de l'occlusion (exposant 1 : 28 % au bord de la caisse, 13 % à 1 m).
  // Avec les ombres, il n'appuie que le contact (exposant 4 : sous les pneus et sous la caisse).
  const SANS_OMBRES = Object.freeze([.85, .85, 1, 1.6]), AVEC_OMBRES = Object.freeze([.85, .6, 4, 1.6]);
  // Tuile : 3,5 m de demi-côté (dans le repère du soleil) autour du milieu de la caisse, à 45 cm du sol.
  const TUILE = 3.5, TUILE_Y = .45;
  // Carte lointaine : 2048² (8 Mo), emprise calculée par FERRO sur les lots qui projettent.
  const DEMANDE_CARTE = Object.freeze({ taille: 2048, marge: 20, dessous: 300 });
  // Pénombre : la part météo, gratuite, en Moyenne et en Fine. La pénombre variable (PCSS allégé de FERRO) reste
  // coupée : décor immobile, carré qui suit la voiture, elle fait encore bouger l'image (d1 0,012 contre 0,008 sans
  // elle ; règle O5 : moins de 0,01). pcssFine: true la rallume en Fine, à régler avant la création du rendu : le
  // jeu ne fait compiler le bloc PCSS par FERRO que dans ce cas (ombresPhoto.pcss, src/jeu.js) ; sinon FERRO rend la
  // part météo. Contact en Légère : voir docs/reprise/rapports/photo-ombres-2026-11-18 ; coupé ici si une machine
  // modeste le paie trop cher.
  const reglages = { pcssFine: false, contactLegere: true };
  // Journal du gouverneur : les 64 derniers changements de niveau ou d'ombres.
  const JOURNAL = 64;

  const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const borne01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  let dernier = null;

  function creer() {
    const O = {
      contacts: { nombre: 0, boites: new Float32Array(PLACES * FLOTTANTS), ambiance: 0, soleil: 0, exposant: 4, marge: 1.6 },
      proche: { centre: [0, 0, 0], etendue: TUILE, debut: 0, fin: 0, axe: [1, 0, 0] },
      ombreProche: null, penombre: null,
      score: new Float64Array(16), pris: new Uint8Array(16), rang: new Int32Array(PLACES + 1), axes: new Float64Array(6),
      axesSuivie: new Float64Array(6),
      forces: new Float32Array(16),
      journal: { niveau: new Int8Array(JOURNAL), ombres: new Uint8Array(JOURNAL), t: new Float64Array(JOURNAL), tete: 0, compte: 0, cle: null },
      carte: null,
    };
    dernier = O;
    return O;
  }

  // Axes de la caisse comme src/voiture.js (M = Ry(−cap)·Rz(tangage)·Rx(roulis)) : avant F = M·x dans A[0..2], haut
  // U = M·y dans A[3..5]. La droite, F × U, est refaite par le shader.
  function axes(A, p) {
    const ch = Math.cos(p.cap || 0), sh = Math.sin(p.cap || 0), ct = Math.cos(p.tangage || 0), st = Math.sin(p.tangage || 0);
    const cq = Math.cos(p.roulis || 0), sq = Math.sin(p.roulis || 0);
    A[0] = ch * ct; A[1] = st; A[2] = sh * ct;
    A[3] = -ch * st * cq - sh * sq; A[4] = ct * cq; A[5] = ch * sq - sh * st * cq;
    return A;
  }

  // Six vec4 par voiture, dans l'ordre que lit FERRO : centre de la caisse et force ; axe avant et demi-longueur ; axe
  // haut et demi-hauteur ; demi-largeur, hauteur du centre, essieux avant et arrière (depuis le centre) ; rayon,
  // demi-voie et demi-largeur des roues avant ; idem à l'arrière. La force (b[o + 3]) est écrite par l'appelant : une
  // fonction appelée à chaque image ne reçoit pas de nombre à virgule calculé (hors ligne, il serait mis en boîte).
  function ecrire(b, o, p, A, R) {
    b[o] = p.x + A[0] * CAISSE_X + A[3] * CAISSE_Y; b[o + 1] = p.y + A[1] * CAISSE_X + A[4] * CAISSE_Y;
    b[o + 2] = p.z + A[2] * CAISSE_X + A[5] * CAISSE_Y;
    b[o + 4] = A[0]; b[o + 5] = A[1]; b[o + 6] = A[2]; b[o + 7] = DEMI_LONGUEUR;
    b[o + 8] = A[3]; b[o + 9] = A[4]; b[o + 10] = A[5]; b[o + 11] = DEMI_HAUTEUR;
    b[o + 12] = DEMI_LARGEUR; b[o + 13] = CAISSE_Y; b[o + 14] = R[0].x - CAISSE_X; b[o + 15] = R[2].x - CAISSE_X;
    b[o + 16] = R[0].r; b[o + 17] = Math.abs(R[0].z); b[o + 18] = R[0].l / 2; b[o + 19] = 0;
    b[o + 20] = R[2].r; b[o + 21] = Math.abs(R[2].z); b[o + 22] = R[2].l / 2; b[o + 23] = 0;
  }

  // P : profil résolu de l'image (P.palier, P.effets.ombres) ; cam : caméra de la vue ; poses : poses interpolées des
  // voitures (x, y au sol, z, cap, tangage, roulis) ; n : nombre de voitures ; suivie : indice de la voiture filmée ;
  // [debut, fin) : ses objets dans la liste donnée à rendu.draw ; niveau : niveau de la qualité Auto (−1 hors Auto) ;
  // t : horloge (s), pour le journal. Rend O : O.contacts, O.ombreProche (ou null) et O.penombre (ou null).
  function preparer(O, P, cam, poses, n, suivie, debut, fin, niveau, t) {
    const ombres = !!(P && P.effets && P.effets.ombres);
    const places = P && P.palier === 'low' ? (reglages.contactLegere ? PLACES_LEGERE : 0) : PLACES;
    const R = B.voiture && B.voiture.ROUES && B.voiture.ROUES.length === 4 ? B.voiture.ROUES : ROUES_312;
    if (O.score.length < n) {
      O.score = new Float64Array(n * 2); O.pris = new Uint8Array(n * 2);
      const forces = new Float32Array(n * 2);
      forces.set(O.forces); O.forces = forces;
    }
    const forces = O.forces;
    forces.fill(0, n);
    const sc = O.score, pris = O.pris, rang = O.rang, A = O.axes, b = O.contacts.boites;
    const ex = cam.pos[0], ey = cam.pos[1], ez = cam.pos[2], vx = Math.sin(cam.yaw || 0), vz = -Math.cos(cam.yaw || 0);
    for (let k = 0; k < n; k++) {
      const p = poses[k]; pris[k] = 0;
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) { sc[k] = Infinity; continue; }
      const dx = p.x - ex, dy = p.y - ey, dz = p.z - ez, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const a = borne01(d > 1e-6 ? -2 * (dx * vx + dz * vz) / d : 0);
      sc[k] = d + DERRIERE * a * a * (3 - 2 * a);
    }
    // places + 1 meilleures voitures à moins de 60 m ; la dernière n'est que la première laissée dehors
    let m = 0;
    for (; m <= places && m < n; m++) {
      let best = -1, bs = PORTEE;
      for (let k = 0; k < n; k++) if (!pris[k] && sc[k] < bs) { bs = sc[k]; best = k; }
      if (best < 0) break;
      pris[best] = 1; rang[m] = best;
    }
    let nombre = 0, axesSuivieCalcules = false;
    const dehors = m > places ? sc[rang[places]] : PORTEE;
    const retenues = Math.min(m, places);
    if (m > places) pris[rang[places]] = 0;
    // Les contacts déjà visibles gardent leur place pendant le fondu de sortie.
    // Les nouveaux prennent ensuite les places libres dans l’ordre du classement.
    for (let i = 0; i < n + retenues && nombre < PLACES; i++) {
      const dejaVisible = i < n;
      const k = dejaVisible ? i : rang[i - n];
      const retenue = pris[k] !== 0;
      if (dejaVisible ? forces[k] === 0 : !retenue) continue;
      pris[k] = 0;
      const s = sc[k];
      if (!Number.isFinite(s)) { forces[k] = 0; continue; }
      const cible = retenue ? (1 - lisse(PLEINE, PORTEE, s)) * borne01((dehors - s) / ECART) : 0;
      let force = forces[k] ?? 0;
      force += (cible - force) * LISSAGE_CONTACT;
      forces[k] = cible === 0 && force < FORCE_MIN ? 0 : force;
      if (forces[k] === 0) continue;
      const p = poses[k], o = nombre * FLOTTANTS;
      const estSuivie = k === suivie;
      ecrire(b, o, p, axes(estSuivie ? O.axesSuivie : A, p), R);
      if (estSuivie) axesSuivieCalcules = true;
      b[o + 3] = forces[k]; nombre++;
    }
    const c = O.contacts, r = ombres ? AVEC_OMBRES : SANS_OMBRES;
    const alpha = c.ambiance === 0 ? 1 : LISSAGE_CONTACT;
    c.soleil += (r[1] - c.soleil) * alpha;
    c.exposant += (r[2] - c.exposant) * alpha;
    c.nombre = nombre; c.ambiance = r[0]; c.marge = r[3];

    const ps = ombres && suivie >= 0 && fin > debut ? poses[suivie] : null;
    if (ps && Number.isFinite(ps.x)) {
      const As = O.axesSuivie;
      if (!axesSuivieCalcules) axes(As, ps);
      const pr = O.proche, C = pr.centre, X = pr.axe;
      C[0] = ps.x + As[0] * CAISSE_X + As[3] * TUILE_Y; C[1] = ps.y + As[1] * CAISSE_X + As[4] * TUILE_Y; C[2] = ps.z + As[2] * CAISSE_X + As[5] * TUILE_Y;
      X[0] = As[0]; X[1] = As[1]; X[2] = As[2]; pr.debut = debut; pr.fin = fin; pr.etendue = TUILE;
      O.ombreProche = pr;
    } else O.ombreProche = null;
    O.penombre = ombres ? ((P?.effets?.pcss || (P?.palier === 'high' && reglages.pcssFine)) ? 'pcss' : 'meteo') : null;
    noter(O, niveau, ombres, t);
    return O;
  }

  // Journal : un changement de niveau du gouverneur Auto, ou d'ombres ouvertes ou fermées, prend une ligne.
  function noter(O, niveau, ombres, t) {
    const J = O.journal, n = Number.isFinite(niveau) ? niveau | 0 : -1, cle = n * 2 + (ombres ? 1 : 0);
    if (cle === J.cle) return;
    J.cle = cle;
    const i = J.tete; J.niveau[i] = n; J.ombres[i] = ombres ? 1 : 0; J.t[i] = Number.isFinite(t) ? t : 0;
    J.tete = (i + 1) % JOURNAL; J.compte++;
  }
  // Lignes du journal, de la plus ancienne à la plus récente (pour les outils ; alloue, jamais appelé à l'image).
  function journal(O) {
    const J = (O || dernier || creer()).journal, n = Math.min(J.compte, JOURNAL), lignes = [];
    for (let k = 0; k < n; k++) { const i = (J.tete - n + k + JOURNAL) % JOURNAL; lignes.push({ t: J.t[i], niveau: J.niveau[i], ombres: !!J.ombres[i] }); }
    return { changements: J.compte, lignes };
  }

  // Ombres du soleil possibles pendant la séance : un des paliers que la qualité choisie peut prendre en a. Auto les
  // parcourt tous ; un choix fixe n'en a qu'un. Les ombres forcées du menu comptent ; coupées, aucun palier n'en a.
  // garde : celui que jeu.js donne à B.graphismes.melange (ancre du décor, capacités du moteur, réglages du menu).
  function ombresPossibles(qualite, garde) {
    const G = B.graphismes;
    if (!G || typeof G.melange !== 'function') return true;
    for (let n = 0; n <= (G.NIVEAU_MAX || 4); n++) if (G.melange(qualite, n, garde).effets.ombres) return true;
    return false;
  }

  // Carte lointaine (O2), au lancement d'une séance, après rendu.setLots : une passe de profondeur de tout le décor qui
  // projette, faite une fois par décor (lots : decor.lots ; la même liste garde la carte déjà faite). coupee : GPU
  // modeste, ou aucune ombre du soleil possible avec les réglages (Légère, ombres coupées) ; la carte est alors libérée
  // et ses 8 Mo rendus. Rend le compte rendu du moteur, ou null.
  const etatCarte = { lots: null, rapport: null };
  function carte(rendu, coupee, lots) {
    if (!rendu || typeof rendu.precalculerOmbre !== 'function') return null;
    if (coupee) {
      if (etatCarte.rapport) rendu.precalculerOmbre(null);
      etatCarte.lots = etatCarte.rapport = null;
    } else if (!(lots && etatCarte.lots === lots && etatCarte.rapport)) {
      etatCarte.rapport = rendu.precalculerOmbre(DEMANDE_CARTE);
      etatCarte.lots = etatCarte.rapport ? lots || null : null;
    }
    if (dernier) dernier.carte = etatCarte.rapport;
    return etatCarte.rapport;
  }

  B.ombres = { creer, preparer, carte, ombresPossibles, journal, axes, reglages, PLACES, PLACES_LEGERE, PORTEE, TUILE, DEMANDE_CARTE };
})(globalThis.BITUME = globalThis.BITUME || {});
