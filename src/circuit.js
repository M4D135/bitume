/* BITUME — circuits originaux générés à partir d'une graine.
   Tracé : polygone étoilé dont les sommets sont arrondis par de vrais arcs de cercle (les côtés deviennent de vraies
   lignes droites), transitions de courbure adoucies, puis relief, dévers, vibreurs, trajectoire idéale et vitesse
   de référence. Premier jet du Spark (QAD) pour l'interface, repris par Claude pour la génération du tracé. */
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.couverts) require('./couverts.js');
(function (B) {
  'use strict';

  const PAS = 2, LARGEUR = 12, LIMITE = 20;
  const AMPLITUDE = { foret: 14, cote: 6, montagne: 32, islande: 21, desert: 26, asie: 23, pacifique: 20 };

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
  const angle = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  const borner = (v, a, b) => v < a ? a : v > b ? b : v;
  const lisse = (a, b, x) => { const t = borner((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- tracé en plan
  function polygone(r, rayonBase) {
    const n = 7 + Math.floor(r() * 5), pasA = 2 * Math.PI / n, debut = r() * 2 * Math.PI, pts = [];
    for (let i = 0; i < n; i++) {
      const a = debut + i * pasA + (r() - .5) * pasA * .55;
      let rr = rayonBase * (.58 + r() * .42);
      if (r() < .24) rr *= .5 + r() * .15;            // sommet rentré : épingle ou enchaînement serré
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    if (r() < .5) pts.reverse();                        // la moitié des circuits tournent dans l'autre sens
    return pts;
  }

  // Arrondit chaque sommet ; renvoie la liste des segments (droites et arcs) ou null si un côté est trop court.
  function arrondir(pts, r) {
    const n = pts.length, coins = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      const ux = p1[0] - p0[0], uz = p1[1] - p0[1], vx = p2[0] - p1[0], vz = p2[1] - p1[1];
      const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
      const ui = [ux / lu, uz / lu], uo = [vx / lv, vz / lv];
      const theta = Math.atan2(ui[0] * uo[1] - ui[1] * uo[0], ui[0] * uo[0] + ui[1] * uo[1]);
      const ab = Math.abs(theta);
      let R = ab > 1.7 ? 24 + r() * 22 : ab > 1.05 ? 32 + r() * 60 : ab > .55 ? 55 + r() * 110 : 120 + r() * 200;
      if (ab > .9 && r() < .3) R = 24 + r() * 16;
      coins.push({ p: p1, ui, uo, theta, R, lu, lv });
    }
    // Les tangentes de deux coins voisins doivent laisser une ligne droite d'au moins 24 m.
    for (let i = 0; i < n; i++) {
      const a = coins[i], b = coins[(i + 1) % n], cote = a.lv, ta = t => t.R * Math.tan(Math.abs(t.theta) / 2);
      let somme = ta(a) + ta(b);
      if (somme > cote - 24) {
        const f = (cote - 24) / somme;
        a.R *= f; b.R *= f; somme = ta(a) + ta(b);
      }
      if (a.R < 23.9 || b.R < 23.9) return null;
    }
    const segments = [];
    for (let i = 0; i < n; i++) {
      const c = coins[i], t = c.R * Math.tan(Math.abs(c.theta) / 2);
      c.entree = [c.p[0] - c.ui[0] * t, c.p[1] - c.ui[1] * t];
      c.sortie = [c.p[0] + c.uo[0] * t, c.p[1] + c.uo[1] * t];
    }
    for (let i = 0; i < n; i++) {
      const c = coins[i], d = coins[(i + 1) % n];
      segments.push({ arc: true, depart: c.entree, cap: Math.atan2(c.ui[1], c.ui[0]), k: Math.sign(c.theta) / c.R, longueur: c.R * Math.abs(c.theta) });
      const lx = d.entree[0] - c.sortie[0], lz = d.entree[1] - c.sortie[1];
      segments.push({ arc: false, depart: c.sortie, cap: Math.atan2(c.uo[1], c.uo[0]), k: 0, longueur: Math.hypot(lx, lz) });
    }
    return segments;
  }

  // Échantillonne les segments tous les PAS mètres (après mise à l'échelle qui rend L multiple de PAS),
  // adoucit la courbure sur ±16 m et réintègre le tracé en refermant la boucle.
  function echantillonner(segments) {
    let brut = 0;
    for (const s of segments) brut += s.longueur;
    const n = Math.round(brut / PAS), f = n * PAS / brut;
    const k = new Float64Array(n);
    let seg = 0, debutSeg = 0;
    for (let i = 0; i < n; i++) {
      const s = (i + .5) * PAS;
      while (seg < segments.length - 1 && s > (debutSeg + segments[seg].longueur) * f) { debutSeg += segments[seg].longueur; seg++; }
      k[i] = segments[seg].k / f;
    }
    // adoucissement circulaire : la somme des courbures (le tour complet) est conservée exactement
    const F = 8, lisseK = new Float64Array(n);
    for (let i = 0; i < n; i++) { let m = 0; for (let j = -F; j <= F; j++) m += k[(i + j + n) % n]; lisseK[i] = m / (2 * F + 1); }
    const capDepart = segments[0].cap, x = new Float64Array(n), z = new Float64Array(n);
    let a = capDepart, px = segments[0].depart[0] * f, pz = segments[0].depart[1] * f;
    for (let i = 0; i < n; i++) {
      x[i] = px; z[i] = pz;
      const am = a + lisseK[i] * PAS / 2;
      px += Math.cos(am) * PAS; pz += Math.sin(am) * PAS;
      a += lisseK[i] * PAS;
    }
    // fermeture : l'écart résiduel est réparti le long du tour
    const ex = px - x[0], ez = pz - z[0];
    for (let i = 0; i < n; i++) { x[i] -= ex * i / n; z[i] -= ez * i / n; }
    return { x, z, n };
  }

  function capsEtCourbures(x, z, n) {
    const cap = new Float64Array(n), courbure = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n, b = (i + 1) % n;
      cap[i] = Math.atan2(z[b] - z[a], x[b] - x[a]);
    }
    for (let i = 0; i < n; i++) courbure[i] = angle(cap[(i + 1) % n] - cap[(i - 1 + n) % n]) / (2 * PAS);
    return { cap, courbure };
  }

  function plusLongueDroite(courbure, n) {
    let meilleur = { debut: 0, longueur: 0 }, debut = -1;
    // deux tours pour gérer une droite qui chevauche l'indice 0
    for (let j = 0; j < 2 * n; j++) {
      const i = j % n, droit = Math.abs(courbure[i]) < 1 / 900;
      if (droit && debut < 0) debut = j;
      if ((!droit || j === 2 * n - 1) && debut >= 0) {
        const l = j - debut;
        if (l > meilleur.longueur && l <= n) meilleur = { debut: debut % n, longueur: l };
        debut = -1;
      }
    }
    return { debut: meilleur.debut, longueur: meilleur.longueur * PAS };
  }

  function brasTropProches(x, z, n, seuil) {
    const ecartMin = Math.ceil(150 / PAS);
    if (n < 2 * ecartMin) return false;
    const cote = 2 ** Math.ceil(Math.log2(seuil)), seuil2 = seuil * seuil;
    const colonnes = new Map();
    // Pour chaque j, les i admissibles sont pairs et dans [j - (n - ecartMin), j - ecartMin].
    // On ajoute le dernier i devenu admissible ; la borne basse protège la jonction fin/départ.
    for (let j = ecartMin; j < n; j += 2) {
      const i = j - ecartMin;
      if (Number.isFinite(x[i]) && Number.isFinite(z[i])) {
        const cx = Math.floor(x[i] / cote), cz = Math.floor(z[i] / cote);
        let colonne = colonnes.get(cx);
        if (!colonne) { colonne = new Map(); colonnes.set(cx, colonne); }
        let indices = colonne.get(cz);
        if (!indices) { indices = []; colonne.set(cz, indices); }
        indices.push(i);
      }
      if (!Number.isFinite(x[j]) || !Number.isFinite(z[j])) continue;
      const cx = Math.floor(x[j] / cote), cz = Math.floor(z[j] / cote), premier = j - (n - ecartMin);
      // Une paire sous le seuil tient dans deux cases adjacentes, y compris aux coordonnées négatives.
      for (let a = -1; a <= 1; a++) {
        const colonne = colonnes.get(cx + a);
        if (!colonne) continue;
        for (let b = -1; b <= 1; b++) {
          const indices = colonne.get(cz + b);
          if (!indices) continue;
          for (let k = indices.length - 1; k >= 0 && indices[k] >= premier; k--) {
            const p = indices[k], dx = x[p] - x[j], dz = z[p] - z[j], d2 = dx * dx + dz * dz;
            // Conserver l'arrondi du sqrt historique à la frontière exacte de 59 ou 60 m.
            if (d2 < seuil2 && Math.sqrt(d2) < seuil) return true;
          }
        }
      }
    }
    return false;
  }

  function nombreVirages(courbure, n, seuil) {
    let compte = 0, dans = false;
    for (let i = 0; i < n; i++) {
      const v = Math.abs(courbure[i]) > seuil;
      if (v && !dans) compte++;
      dans = v;
    }
    if (dans && Math.abs(courbure[0]) > seuil && compte > 1) compte--;
    return compte;
  }

  function tourner(tab, decalage) {
    const n = tab.length, r = new tab.constructor(n);
    for (let i = 0; i < n; i++) r[i] = tab[(i + decalage) % n];
    return r;
  }

  // ---------------------------------------------------------------- profils le long du tour
  // Baïkal : rive basse, forêt, montée vers le promontoire puis retour ouvert. Ce profil ne concerne que
  // le nouveau circuit : ni les tirages ni les tableaux des sept tracés historiques ne changent.
  function reliefBaikal(n, L, plat) {
    const y = new Float64Array(n), points = [[0, 0], [.12, 0], [.30, 12], [.64, 64], [.96, 0], [1, 0]];
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = i * PAS / L;
      while (j < points.length - 2 && s > points[j + 1][0]) j++;
      const a = points[j], b = points[j + 1], t = (s - a[0]) / (b[0] - a[0]);
      // Raccord quintique : pente et courbure verticale nulles aux jonctions, sans cassure à la crête.
      const u = t * t * t * (10 + t * (-15 + 6 * t));
      y[i] = (a[1] + (b[1] - a[1]) * u) * (1 - plat[i]);
    }
    return y;
  }
  function relief(n, L, theme, r, plat) {
    const y = theme === 'baikal' ? reliefBaikal(n, L, plat) : new Float64Array(n);
    if (theme !== 'baikal') {
      const A = AMPLITUDE[theme] || 14, harm = [];
      for (let h = 0; h < 3; h++) harm.push({ k: 1 + Math.floor(r() * 5), a: .4 + r() * .6, phi: r() * 2 * Math.PI });
      const somme = harm.reduce((s, h) => s + h.a, 0);
      for (let i = 0; i < n; i++) {
        let v = 0;
        for (const h of harm) v += h.a * Math.sin(2 * Math.PI * h.k * i * PAS / L + h.phi);
        y[i] = v / somme * A * (1 - plat[i]);
      }
    }
    let pmax = 0;
    for (let i = 0; i < n; i++) pmax = Math.max(pmax, Math.abs(y[(i + 1) % n] - y[(i - 1 + n) % n]) / (2 * PAS));
    if (pmax > .068) { const f = .068 / pmax; for (let i = 0; i < n; i++) y[i] *= f; }
    const pente = new Float64Array(n);
    for (let i = 0; i < n; i++) pente[i] = (y[(i + 1) % n] - y[(i - 1 + n) % n]) / (2 * PAS);
    return { y, pente };
  }

  function moyenneCirculaire(tab, F) {
    const n = tab.length, r = new Float64Array(n);
    let somme = 0;
    for (let j = -F; j <= F; j++) somme += tab[(j + n) % n];
    for (let i = 0; i < n; i++) { r[i] = somme / (2 * F + 1); somme += tab[(i + F + 1) % n] - tab[(i - F + n) % n]; }
    return r;
  }

  // Trajectoire idéale : bande élastique à plusieurs échelles (pas de 16, 8, 4, 2 m), bornée à la piste.
  function trajectoire(x, z, cap, n, largeur, ouvert = false) {
    const d = new Float64Array(n), borne = Math.max(.2, largeur / 2 - 1.4);
    const rx = new Float64Array(n), rz = new Float64Array(n);
    for (let i = 0; i < n; i++) { rx[i] = -Math.sin(cap[i]); rz[i] = Math.cos(cap[i]); }
    for (const [h, tours] of [[24, 140], [12, 140], [6, 120], [3, 100], [1, 80]]) {
      const i0 = ouvert ? 1 : 0, i1 = ouvert ? n - 1 : n;
      for (let t = 0; t < tours; t++) for (let i = i0; i < i1; i++) {
        const a = ouvert ? Math.max(0, i - h) : (i - h + n) % n;
        const b = ouvert ? Math.min(n - 1, i + h) : (i + h) % n;
        const mx = (x[a] + rx[a] * d[a] + x[b] + rx[b] * d[b]) / 2, mz = (z[a] + rz[a] * d[a] + z[b] + rz[b] * d[b]) / 2;
        const cible = (mx - x[i]) * rx[i] + (mz - z[i]) * rz[i];
        d[i] = borner(d[i] + .55 * (cible - d[i]), -borne, borne);
      }
    }
    return d;
  }

  function vitesses(x, z, cap, ligne, n, pas = PAS, ouvert = false, arrivee = Infinity) {
    const px = new Float64Array(n), pz = new Float64Array(n), v = new Float64Array(n);
    for (let i = 0; i < n; i++) { px[i] = x[i] - Math.sin(cap[i]) * ligne[i]; pz[i] = z[i] + Math.cos(cap[i]) * ligne[i]; }
    const MU = 1.55, AERO = .00155, VMAX = 86, H = 3;
    for (let i = 0; i < n; i++) {
      const a = ouvert ? Math.max(0, i - H) : (i - H + n) % n;
      const b = ouvert ? Math.min(n - 1, i + H) : (i + H) % n;
      if (ouvert && (a === i || b === i)) { v[i] = VMAX; continue; }
      const a1 = Math.atan2(pz[i] - pz[a], px[i] - px[a]), a2 = Math.atan2(pz[b] - pz[i], px[b] - px[i]);
      const ds = (Math.hypot(pz[i] - pz[a], px[i] - px[a]) + Math.hypot(pz[b] - pz[i], px[b] - px[i])) / 2;
      const k = Math.abs(angle(a2 - a1)) / Math.max(ds, .5);
      const den = k - MU * AERO;
      v[i] = den <= 0 ? VMAX : Math.min(VMAX, Math.sqrt(MU * 9.81 / den));
    }
    if (ouvert) {
      if (Number.isFinite(arrivee) && arrivee < (n - 1) * pas) {
        const iFin = Math.min(n - 1, Math.ceil(arrivee / pas));
        v[n - 1] = 2;
        for (let i = n - 2; i >= iFin; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * 10 * pas));
      }
      for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * 16 * pas));
      const poussee = u => Math.max(.05, Math.min(12, 15.59 - .2592 * u + .000899 * u * u));
      for (let i = 1; i < n; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * poussee(v[i - 1]) * pas));
      return v;
    }
    for (let j = 2 * n - 1; j >= 0; j--) { const i = j % n, s = (i + 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[s] * v[s] + 2 * 16 * pas)); }
    // poussée à fond de la monoplace (enveloppe des six rapports mesurée sur conduite.js, boîte auto)
    const poussee = u => Math.max(.05, Math.min(12, 15.59 - .2592 * u + .000899 * u * u));
    for (let j = 1; j <= 2 * n; j++) { const i = j % n, p = (i - 1 + n) % n; v[i] = Math.min(v[i], Math.sqrt(v[p] * v[p] + 2 * poussee(v[p]) * pas)); }
    return v;
  }

  // L’allée se sépare du bord droit, rejoint le box par une aire latérale puis revient sur la route.
  const transitionStand = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const tamponVoie = {};
  function accesStands(S, s) {
    return transitionStand(Math.min((s - S.debut) / (S.mur0 - S.debut), (S.fin - s) / (S.fin - S.mur1)));
  }
  function axeStands(c, s) {
    const S = c.stands, cote = S?.cote < 0 ? -1 : 1;
    const bord = cote * (c.largeur / 2 - (S?.detachee ? S.demi + .8 : 1.6));
    if (!S) return bord;
    return bord + (S.d - bord) * accesStands(S, s);
  }
  // Intervalle carrossable en d signé. Une voie détachée laisse un terre-plein à
  // l'intérieur de cet anneau ; la voie historique reste attenante au bord de piste.
  function bandeStands(c, s, out = {}) {
    const w = c.largeur / 2, S = c.stands, cote = S?.cote < 0 ? -1 : 1;
    let proche = w, loin = w;
    if (S && s > S.debut && s < S.fin) {
      const acces = accesStands(S,s), demi = S.demi + .8, centre = cote * S.d, fond = cote * S.dFond;
      const aire = transitionStand(Math.min((s-S.garage0+18)/18, (S.garage1+18-s)/18));
      if (S.detachee) {
        const axe = w - demi + (centre - w + demi) * acces;
        proche = Math.max(w, axe - demi);
        loin = Math.max(w, axe + demi + aire * (fond - centre - demi));
      } else {
        loin = w + acces * (centre + S.demi + .8 - w + aire * (fond - centre - S.demi - .8));
      }
    }
    out.min = cote < 0 ? -loin : proche; out.max = cote < 0 ? -proche : loin;
    return out;
  }
  // Portée positive sur le côté demandé. L'appel historique sans côté désigne le bord droit.
  function bordStands(c, s, cote = 1) {
    if (!c.stands || (c.stands.cote < 0) !== (cote < 0)) return c.largeur / 2;
    bandeStands(c, s, tamponVoie);
    return cote < 0 ? -tamponVoie.min : tamponVoie.max;
  }
  function surVoieStands(c, s, d, marge = 0) {
    const S = c.stands;
    if (!S || !(s > S.debut && s < S.fin) || (S.cote < 0 ? -d : d) <= c.largeur / 2) return false;
    const voie = bandeStands(c, s, tamponVoie);
    return voie.max > voie.min && d >= voie.min - marge && d <= voie.max + marge;
  }

  // Réservation des plantations et objets. Les roues emploient uniquement bordStands.
  function empriseStands(c,s,d,marge=0) {
    const S=c.stands;
    if (!S || s < S.debut-marge || s > S.fin+marge) return false;
    const cote = S.cote < 0 ? -1 : 1, voie = bandeStands(c,s,tamponVoie);
    const proche = cote < 0 ? -voie.max : voie.min, loin = cote < 0 ? -voie.min : voie.max;
    const exterieur = s >= S.garage0-4-marge && s <= S.garage1+4+marge ? cote*S.dBox+11 : loin;
    return cote*d >= proche-.2-marge && cote*d <= exterieur+marge;
  }

  function halteEnLigne(c) {
    const fin = c.arrivee || c.longueur, long = 208;
    const ouvrages = [...(c.couverts || []), ...(c.ponts || [])];
    let candidat = null, score = Infinity;
    // Halte de course temporaire sur un plateau dégagé, à l'écart des ouvrages et des lieux identifiés.
    for (let debut = Math.ceil(fin*.20/16)*16; debut + long < fin*.83; debut += 32) {
      const bout = debut + long;
      if (ouvrages.some(o => o.fin + 90 > debut && o.debut - 90 < bout)
          || c.lieux?.some(o => { const marge = o.categorie === 'village' ? 550 : 180; return o.s > debut-marge && o.s < bout+marge; })) continue;
      let courbe = 0, pente = 0;
      for (let i = Math.floor(debut/c.pas); i <= Math.ceil(bout/c.pas); i++) {
        courbe = Math.max(courbe, Math.abs(c.courbure[i]));
        pente = Math.max(pente, Math.abs(c.pente[i]));
      }
      const cout = courbe*100 + pente + Math.abs((debut+long/2)/fin-.55)*.025;
      if (courbe > 1/100 || pente > .10 || cout >= score) continue;
      const i = Math.round((debut+long/2)/c.pas), x = c.x[i], z = c.z[i];
      let libre = true;
      for (let j = 0; j < c.n; j += Math.max(1, Math.floor(12/c.pas))) {
        if (Math.abs(j-i)*c.pas > long/2+65 && Math.hypot(c.x[j]-x,c.z[j]-z) < long/2+45) { libre=false; break; }
      }
      if (libre) { score=cout; candidat={debut,fin:bout,garage0:debut+74,garage1:debut+126,vitesse:11}; }
    }
    return candidat;
  }

  function preparerStands(c) {
    if (!c.stands && (c.ouvert && (c.id === 'larche' || c.id === 'marseille') || !c.ouvert && c.stands === null)) {
      c.stands = halteEnLigne(c);
    }
    const S=c.stands, w=c.largeur/2;
    if (!S || S.dBox !== undefined) return;
    const cote = S.cote < 0 ? -1 : 1, centre = S.retrait ?? w+3.8;
    const raccord = S.raccord ?? Math.min(35,(S.fin-S.debut)*.2);
    Object.assign(S,{ cote, d:cote*centre, demi:2.45, dMur:cote*(S.detachee ? centre-3.25 : w+.45),
      mur0:S.debut+raccord, mur1:S.fin-raccord, sBox:(S.garage0+S.garage1)/2,
      dBox:cote*(S.detachee ? centre+6.4 : w+10.2), demiBox:2.65, dFond:cote*(S.detachee ? centre+12.2 : w+16) });
    // Les glissières physiques et visuelles longent désormais l'extérieur de l'aire et ses raccordements.
    const limites = cote < 0 ? c.limiteG : c.limiteD;
    if (limites) for (let i=Math.max(0,Math.floor(S.debut/c.pas)-6); i<Math.min(c.n,Math.ceil(S.fin/c.pas)+7); i++) {
      const s=i*c.pas;
      limites[i]=Math.max(limites[i],bordStands(c,s,cote)+1.5);
    }
  }

  // Préparation explicite des seules partitions qualifiées séparément. Les huit générateurs historiques
  // conservent leurs appels et leurs résultats ; aucune table de vitesses issue d'une ancienne étude n'est importée.
  function preparerParcours(c) {
    if (c.largeur === undefined && c.largeurG && c.largeurD) {
      let minL = Infinity;
      for (let i = 0; i < c.n; i++) minL = Math.min(minL, c.largeurG[i] + c.largeurD[i]);
      c.largeur = Number.isFinite(minL) && minL > 0 ? minL : LARGEUR;
    }
    preparerStands(c);
    if (!c.vibreur) c.vibreur = new Uint8Array(c.n);
    c.ligne = trajectoire(c.x, c.z, c.cap, c.n, c.largeur, !!c.ouvert);
    c.vitesse = vitesses(c.x, c.z, c.cap, c.ligne, c.n, c.pas, !!c.ouvert, c.ouvert ? c.arrivee : Infinity);
    if (c.type === 'trace-explicite') c.pretPourCourse = true;
    return c;
  }

  // Limites latérales : glissières à 20 m, rapprochées à l'intérieur des virages serrés (repère valable : 1 − κd > 0,3).
  function limites(courbure, n, largeur) {
    const G = new Float32Array(n), D = new Float32Array(n), F = Math.round(36 / PAS);
    for (let i = 0; i < n; i++) {
      let g = LIMITE, d = LIMITE;
      for (let j = -F; j <= F; j++) {
        const k = courbure[(i + j + n) % n];
        if (k > 1e-6) d = Math.min(d, .62 / k - 2); else if (k < -1e-6) g = Math.min(g, .62 / -k - 2);
      }
      G[i] = Math.max(largeur / 2 + 3.2, g); D[i] = Math.max(largeur / 2 + 3.2, d);
    }
    return { G, D };
  }

  // ---------------------------------------------------------------- création
  function creerOvaleDesForges(graine, options) {
    if (graine !== 347) throw new Error('BITUME : identité de l’ovale caribéen invalide');
    const droite = 400, courte = 120, virage = 140, raccord = 24, raccordDevers = 64, avantLigne = 112;
    const demiTour = droite + courte + 2 * virage, longueur = 2 * demiTour, n = longueur / PAS;
    const premier = droite - avantLigne, second = premier + virage + courte;
    const debuts = [premier, second, premier + demiTour, second + demiTour];
    const angleDroit = Math.PI / 2, courbureMax = angleDroit / (virage - raccord);
    // Intégrale de la courbure : montée en smoothstep sur 24 m, arc, sortie symétrique.
    // Son aire vaut exactement π/2. Les portions opposées se ferment par symétrie.
    function rotationQuart(u) {
      if (u >= virage) return angleDroit;
      const l = Math.min(u, virage - u), t = l / raccord;
      const rotation = courbureMax * (l < raccord ? raccord * t * t * t * (1 - .5 * t) : l - raccord / 2);
      return u > virage / 2 ? angleDroit - rotation : rotation;
    }
    function direction(s) {
      let a = 0;
      for (const debut of debuts) {
        if (s <= debut) break;
        a -= rotationQuart(s - debut);
      }
      return a;
    }
    const x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n);
    const cap = new Float64Array(n), courbure = new Float64Array(n), pente = new Float64Array(n);
    const devers = new Float64Array(n), vibreur = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const s = i * PAS;
      cap[i] = angle(direction(s));
      if (i + 1 < n) {
        const milieu = direction(s + PAS / 2);
        x[i + 1] = x[i] + PAS * Math.cos(milieu);
        z[i + 1] = z[i] + PAS * Math.sin(milieu);
      }
      for (const debut of debuts) {
        const u = s - debut, bord = Math.min(u, virage - u);
        if (bord <= -48) continue;
        // d<0 est à gauche. Le mesh produit y − d·tan(devers) : l'inclinaison réellement dessinée
        // et collisionnée vaut donc 40° au cœur des quatre gauches. La rampe quintique (C2) s'étire
        // sur 112 m (−48 → 64) pour éliminer la crête verticale à l'intérieur tout en gardant le
        // milieu des petites droites (bord = −60) parfaitement plat.
        const tb = Math.max(0, Math.min(1, (bord + 48) / (raccordDevers + 48)));
        devers[i] = -40 * Math.PI / 180 * tb * tb * tb * (10 + tb * (-15 + 6 * tb));
        courbure[i] = -courbureMax * lisse(0, raccord, bord);
        if (bord > 0) vibreur[i] = 1;
        break;
      }
    }
    const largeur = 16, lim = limites(courbure, n, largeur);
    // Sur l'anneau relevé à 40°, le mur extérieur épouse le haut du banking (w + 3 m) au lieu
    // de laisser une falaise d'herbe plate de 12 m qui catapultait les voitures au large.
    for (let i = 0; i < n; i++) {
      const partBank = Math.min(1, Math.abs(devers[i]) / (40 * Math.PI / 180));
      if (partBank > 0) lim.D[i] = Math.min(lim.D[i], largeur / 2 + 3 + (LIMITE - (largeur / 2 + 3)) * (1 - partBank));
    }
    // La grille de douze tient derrière le départ ; le garage dispose de l'autre
    // grande droite. La route et sa voie latérale alimentent les mêmes triangles PhysX.
    const droiteStands = second + virage;
    const stands = { cote: -1, detachee: true, retrait: 55, raccord: 124,
      debut: droiteStands + 12, fin: droiteStands + droite - 12,
      garage0: droiteStands + 174, garage1: droiteStands + 226, vitesse: 11 };
    const c = { id: 'ovale-des-forges', partition: 'ovale-des-forges', graine, nom: options.nom || 'Autodrome des Alizés',
      theme: options.theme || 'ovale', longueur, pas: PAS, n, x, y, z, cap, courbure, pente, devers, vibreur, largeur,
      limite: LIMITE, limiteG: lim.G, limiteD: lim.D, depart: 0, ligneDroite: { debut: -avantLigne, fin: premier },
      secteurs: [longueur / 3, 2 * longueur / 3], stands, tunnel: null, essais: 1 };
    preparerParcours(c);
    // Sur l'anneau relevé à 40°, recentrer la trajectoire dans le couloir central-bas (|d| ≤ 2,8 m)
    // évite de plonger sur la corde (−6,6 m) où la rampe de dévers déleste les roues, tout en gardant
    // une ligne continue sans écart brusque en peloton à l'entrée des courbes.
    for (let i = 0; i < n; i++) c.ligne[i] = Math.max(-2.8, Math.min(2.8, c.ligne[i] * 0.42));
    for (let i = 0; i < n; i++) {
      const s = i * PAS, marge = Math.min(s - (stands.garage0 - 10), stands.garage1 + 10 - s);
      const fondGarage = LIMITE + (Math.abs(stands.dBox) + 13.5 - LIMITE) * lisse(-24, 0, marge);
      c.limiteG[i] = Math.max(c.limiteG[i], fondGarage);
    }
    return c;
  }

  function creer(graine, options = {}) {
    if (options.partition !== undefined) {
      if (options.partition === 'ovale-des-forges') return creerOvaleDesForges(graine, options);
      if (options.partition === 'marseille' && B.marseille) return B.marseille.creer(graine, options);
      if (options.partition !== 'route-des-cimes' || graine !== 181 || !B.routeDesCimes) throw new Error('BITUME : partition absente ou identité invalide');
      return B.routeDesCimes.creer();
    }
    if (options.id === 'marseille' && B.marseille) return B.marseille.creer(graine, options);
    const theme = options.theme || 'foret', vise = options.longueur || 4500, nom = options.nom || 'Circuit ' + graine;
    for (let essai = 0; essai < 400; essai++) {
      const r = alea((graine >>> 0) * 2654435761 + essai * 40503);
      let echelle = vise / (2 * Math.PI) * 1.02, trace = null;
      for (let ajustement = 0; ajustement < 4; ajustement++) {
        const rr = alea((graine >>> 0) * 2654435761 + essai * 40503 + 7);
        const pts = polygone(rr, echelle), segs = arrondir(pts, rr);
        if (!segs) { trace = null; break; }
        const L = segs.reduce((s, g) => s + g.longueur, 0);
        trace = segs;
        if (Math.abs(L / vise - 1) < .03) break;
        echelle *= vise / L;
      }
      if (!trace) continue;
      const { x, z, n } = echantillonner(trace);
      const L = n * PAS;
      if (Math.abs(L / vise - 1) > .08) continue;
      let { cap, courbure } = capsEtCourbures(x, z, n);
      let kmax = 0;
      for (let i = 0; i < n; i++) kmax = Math.max(kmax, Math.abs(courbure[i]));
      if (kmax > 1 / 24) continue;
      const droite = plusLongueDroite(courbure, n);
      if (droite.longueur < 450) continue;
      if (nombreVirages(courbure, n, 1 / 70) < 3) continue;
      if (brasTropProches(x, z, n, 60)) continue;
      // le départ à 35 % de la plus longue ligne droite : l'échantillon 0 devient la ligne
      const decalage = (droite.debut + Math.round(droite.longueur * .35 / PAS)) % n;
      const X = tourner(x, decalage), Z = tourner(z, decalage);
      ({ cap, courbure } = capsEtCourbures(X, Z, n));
      const debutDroite = -Math.round(droite.longueur * .35 / PAS) * PAS, finDroite = debutDroite + droite.longueur;
      // fenêtre de la ligne droite (1 sur la droite, raccord doux sur 120 m)
      const plat = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let s = i * PAS; if (s > L / 2) s -= L;
        const dehors = Math.max(debutDroite - s, s - finDroite, 0);
        plat[i] = 1 - lisse(0, 120, dehors);
      }
      const { y, pente } = relief(n, L, theme, r, plat);
      const devBrut = new Float64Array(n);
      for (let i = 0; i < n; i++) devBrut[i] = borner(courbure[i] * 1.6, -.045, .045);
      const devers = moyenneCirculaire(devBrut, 10);
      for (let i = 0; i < n; i++) devers[i] *= 1 - plat[i];
      const vibreur = new Uint8Array(n), V = Math.round(15 / PAS);
      for (let i = 0; i < n; i++) if (Math.abs(courbure[i]) > 1 / 140) for (let j = -V; j <= V; j++) vibreur[(i + j + n) % n] = 3;
      const lim = limites(courbure, n, LARGEUR);
      // Tunnel (David, 16/11 : « dans le circuit Haut-Col, fais une partie dans un tunnel ») : en montagne, 260 m de
      // piste passent sous la roche, au milieu de la plus longue portion droite (rayon > 400 m), loin de la ligne des
      // stands. Le seuil écarte les courbures de l'ordre de 1e-15 dont le signe change d'un moteur JavaScript à l'autre :
      // le tunnel est au même endroit sur toutes les machines (jeu en ligne). Ses murs sont les limites ; 40 m avant et
      // après, les limites se resserrent en entonnoir jusqu'aux portails.
      let tunnel = null;
      if (theme === 'montagne' && options.tunnel !== false) {
        const N = Math.round(260 / PAS), i0 = choisirTunnel(courbure, n, N);
        if (i0 >= 0) {
          const mur = LARGEUR / 2 + 1.6, E = Math.round(40 / PAS);
          tunnel = { debut: i0 * PAS, fin: (i0 + N) * PAS, mur, hauteur: 6.4 };
          for (let i = i0 - E; i <= i0 + N + E; i++) {
            const dehors = Math.max(i0 - i, i - i0 - N, 0) * PAS, k = (i + n) % n;
            lim.G[k] = Math.min(lim.G[k], mur + dehors * .35); lim.D[k] = Math.min(lim.D[k], mur + dehors * .35);
          }
        }
      }
      // Fenêtre de la voie de service sur la ligne droite principale.
      const av = Math.max(-300, debutDroite + 40), ap = Math.min(260, finDroite - 60);
      // La voie commence APRÈS la ligne : la grille est derrière, et une voiture qui rampe à l'arrêt du départ ne
      // doit pas se retrouver aux stands sans l'avoir voulu.
      const s0 = Math.max(av + 30, 30), g0 = s0 + 40, g1 = g0 + 48, s1 = ap - 20;
      const stands = (s1 - s0 > 140 && g1 + 20 < s1) ? {
        cote: 1,
        debut: s0, fin: s1, garage0: g0, garage1: g1,
        vitesse: 11,                                      // m/s : 40 km/h, au-delà le service n'est pas rendu
      } : null;
      const c = {
        graine, nom, theme, longueur: L, pas: PAS, n,
        x: X, y, z: Z, cap, courbure, pente, devers, largeur: LARGEUR, vibreur, ligne: undefined, vitesse: undefined,
        limite: LIMITE, limiteG: lim.G, limiteD: lim.D,
        depart: 0, ligneDroite: { debut: debutDroite, fin: finDroite }, secteurs: [Math.round(L / 3 / PAS) * PAS, Math.round(2 * L / 3 / PAS) * PAS], tunnel, stands,
        essais: essai + 1
      };
      preparerStands(c);
      if (options.differerTrajectoire !== true) return preparerParcours(c);
      // Une fusion extrait d'abord la géométrie des boucles sources et prépare ensuite son propre tracé.
      // Si un autre consommateur demande malgré tout ces tableaux, fournir leurs valeurs ordinaires.
      differerTableau(c, 'ligne', () => trajectoire(c.x, c.z, c.cap, c.n, c.largeur));
      differerTableau(c, 'vitesse', () => vitesses(c.x, c.z, c.cap, c.ligne, c.n, c.pas));
      return c;
    }
    throw new Error('BITUME : aucun tracé valide pour la graine ' + graine);
  }

  function differerTableau(c, cle, calculer) {
    let valeur;
    Object.defineProperty(c, cle, { configurable: true, enumerable: true,
      get() {
        if (calculer) { valeur = calculer(); calculer = null; }
        return valeur;
      },
      set(tableau) { valeur = tableau; calculer = null; }
    });
  }

  // ---------------------------------------------------------------- tracé métrique fourni (fondation 14B1)
  // Contrat v1 : { unite: 'm', points: [{ x, y, z, largeurG, largeurD, devers?, limiteG?, limiteD? }], pasMax?: 2 }.
  // x/z sont des coordonnées locales métriques, y une altitude dans le même repère ; dévers en radians,
  // largeurs et limites des distances positives depuis l'axe. Le dernier point répète exactement le premier,
  // profils compris : aucune fermeture forcée, transformation géographique, mise à l'échelle ou lissage caché.
  // L'abscisse est la distance EN PLAN de cette polyligne (pente = dy/ds). Les sommets source sont conservés
  // séparément pour le futur raffinement visuel : la grille uniforme ne prétend pas passer par chaque sommet.
  // Géométrie seulement : pas de largeur scalaire, de ligne idéale, de vitesse, de grille ni de stands inventés.
  // Les consommateurs de course/décor à largeur fixe, les croisements et couches restent à raccorder et qualifier.
  const CHAMPS_TRACE = Object.freeze(['x', 'y', 'z', 'largeurG', 'largeurD', 'devers', 'limiteG', 'limiteD']);
  const CHAMPS_LECTURE_TRACE = Object.freeze([...CHAMPS_TRACE, 'courbure', 'pente']);
  function creerDepuisTrace(donnees, options = {}) {
    const erreur = message => { throw new RangeError('BITUME : tracé explicite — ' + message); };
    if (!donnees || donnees.unite !== 'm') erreur('unité locale métrique « m » requise');
    const points = donnees.points;
    const ouvert = (options && options.topologie === 'ouvert') || donnees.topologie === 'ouvert';
    if (!Array.isArray(points) || points.length < (ouvert ? 2 : 4) || points.length > 250001) erreur('au moins trois sommets et leur fermeture explicite requis (250 000 segments maximum)');
    const pasMax = donnees.pasMax === undefined ? PAS : donnees.pasMax;
    if (!Number.isFinite(pasMax) || pasMax <= 0) erreur('pasMax doit être strictement positif et fini');
    if (donnees.nom !== undefined && (typeof donnees.nom !== 'string' || !donnees.nom.trim())) erreur('nom invalide');
    const champs = CHAMPS_TRACE;
    const source = points.map((p, i) => {
      if (!p || typeof p !== 'object') erreur('point ' + i + ' invalide');
      const q = { x: p.x, y: p.y, z: p.z, largeurG: p.largeurG, largeurD: p.largeurD,
        devers: p.devers === undefined ? 0 : p.devers,
        limiteG: p.limiteG === undefined ? p.largeurG : p.limiteG,
        limiteD: p.limiteD === undefined ? p.largeurD : p.limiteD };
      if (!champs.every(k => Number.isFinite(q[k]))) erreur('point ' + i + ' : coordonnées/profils non finis ou manquants');
      if (q.largeurG <= 0 || q.largeurD <= 0 || q.limiteG < q.largeurG || q.limiteD < q.largeurD) erreur('point ' + i + ' : largeurs positives et limites au-delà des bords requises');
      if (Math.abs(q.devers) >= Math.PI / 2) erreur('point ' + i + ' : dévers hors du domaine de la chaussée');
      return Object.freeze(q);
    });
    const m = source.length - 1;
    if (!ouvert && !champs.every(k => source[0][k] === source[m][k])) erreur('boucle non fermée : dernier point et profils différents du premier');
    const abscisses = new Float64Array(m + 1);
    for (let i = 0; i < m; i++) {
      const a = source[i], b = source[i + 1], ds = Math.hypot(b.x - a.x, b.z - a.z);
      if (!Number.isFinite(ds) || ds <= 1e-9) erreur('segment ' + i + ' nul, vertical ou non fini');
      abscisses[i + 1] = abscisses[i] + ds;
      if (!Number.isFinite(abscisses[i + 1]) || abscisses[i + 1] <= abscisses[i]) erreur('longueur non représentable');
    }
    for (let i = ouvert ? 1 : 0; i < m; i++) {
      const a = source[ouvert ? i - 1 : (i + m - 1) % m], b = source[i], d = source[i + 1];
      const ux = b.x - a.x, uz = b.z - a.z, vx = d.x - b.x, vz = d.z - b.z;
      const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
      if (Math.hypot(ux / lu + vx / lv, uz / lu + vz / lv) < 1e-8) erreur('demi-tour ponctuel au sommet ' + i);
    }
    const L = abscisses[m], n = Math.max(8, Math.ceil(L / pasMax));
    if (!Number.isSafeInteger(n) || n > 250000) erreur('résolution supérieure à 250 000 échantillons');
    const pas = ouvert ? L / (n - 1) : L / n;
    const c = { type: 'trace-explicite', formatTrace: 1, unite: 'm', pretPourCourse: false,
      nom: donnees.nom || 'Tracé explicite', longueur: L, pas, n, depart: 0,
      sourceTrace: Object.freeze(source), abscissesSource: abscisses };
    if (ouvert) {
      c.ouvert = true;
      c.topologie = 'ouvert';
      c.depart = donnees.depart === undefined ? 0 : donnees.depart;
      c.arrivee = donnees.arrivee === undefined ? L : donnees.arrivee;
      if (!Number.isFinite(c.depart) || !Number.isFinite(c.arrivee) || !(c.depart >= 0 && c.arrivee > c.depart && c.arrivee <= L)) {
        erreur('topologie ouverte : 0 <= depart < arrivee <= longueur requis');
      }
      c.zoneDeceleration = [c.arrivee, L];
    }
    for (const k of champs) c[k] = new Float64Array(n);
    let segment = 0;
    for (let i = 0; i < n; i++) {
      const s = ouvert && i === n - 1 ? L : i * pas;
      while (segment < m - 1 && s >= abscisses[segment + 1]) segment++;
      const a = source[segment], b = source[segment + 1];
      const t = (s - abscisses[segment]) / (abscisses[segment + 1] - abscisses[segment]);
      for (const k of champs) c[k][i] = a[k] + (b[k] - a[k]) * t;
    }
    c.cap = new Float64Array(n); c.courbure = new Float64Array(n); c.pente = new Float64Array(n);
    // Dérivées centrées (bornées sans rebouclage en mode ouvert, périodiques en boucle fermée).
    for (let i = 0; i < n; i++) {
      const a = ouvert ? Math.max(0, i - 1) : (i + n - 1) % n;
      const b = ouvert ? Math.min(n - 1, i + 1) : (i + 1) % n;
      const dx = c.x[b] - c.x[a], dz = c.z[b] - c.z[a], ds = ouvert ? (b - a) * pas : 2 * pas;
      if (Math.hypot(dx, dz) < 1e-9 || (b !== i && Math.hypot(c.x[b] - c.x[i], c.z[b] - c.z[i]) < 1e-9)) erreur('tangente dégénérée : diminuer pasMax ou corriger le relevé');
      c.cap[i] = Math.atan2(dz, dx);
      c.pente[i] = (c.y[b] - c.y[a]) / ds;
    }
    for (let i = 0; i < n; i++) {
      const a = ouvert ? Math.max(0, i - 1) : (i + n - 1) % n;
      const b = ouvert ? Math.min(n - 1, i + 1) : (i + 1) % n;
      const ds = ouvert ? (b - a) * pas : 2 * pas;
      c.courbure[i] = angle(c.cap[b] - c.cap[a]) / ds;
    }
    const problemes = validerTrace(c);
    if (problemes.length) erreur(problemes.join(' ; '));
    return c;
  }

  function validerTrace(c) {
    const pb = [], n = c && c.n;
    if (!Number.isSafeInteger(n) || n < 8 || n > 250000 || !Number.isFinite(c.pas) || c.pas <= 0 || !Number.isFinite(c.longueur) || c.longueur <= 0) return ['grille métrique invalide'];
    const attendue = c.ouvert ? (n - 1) * c.pas : n * c.pas;
    if (Math.abs(c.longueur - attendue) > Math.max(1e-9, c.longueur * 1e-12)) pb.push('longueur différente de n × pas');
    const champs = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'largeurG', 'largeurD', 'limiteG', 'limiteD'];
    if (!champs.every(k => c[k] && c[k].length === n && c[k].every(Number.isFinite))) return pb.concat('valeurs non finies ou tableaux de mauvaise taille');
    if (c.ouvert) {
      if (!Number.isFinite(c.depart) || !Number.isFinite(c.arrivee) || !(c.depart >= 0 && c.arrivee > c.depart && c.arrivee <= c.longueur)) pb.push('bornes depart/arrivee invalides');
      for (let i = 0; i < n; i++) {
        if (i < n - 1 && Math.hypot(c.x[i + 1] - c.x[i], c.z[i + 1] - c.z[i]) < 1e-9) { pb.push('segment échantillonné nul'); break; }
        if (c.largeurG[i] <= 0 || c.largeurD[i] <= 0 || c.limiteG[i] < c.largeurG[i] || c.limiteD[i] < c.largeurD[i] || Math.abs(c.devers[i]) >= Math.PI / 2) { pb.push('profil de chaussée invalide'); break; }
      }
      return pb;
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (Math.hypot(c.x[j] - c.x[i], c.z[j] - c.z[i]) < 1e-9) { pb.push('segment échantillonné nul'); break; }
      if (c.largeurG[i] <= 0 || c.largeurD[i] <= 0 || c.limiteG[i] < c.largeurG[i] || c.limiteD[i] < c.largeurD[i] || Math.abs(c.devers[i]) >= Math.PI / 2) { pb.push('profil de chaussée invalide'); break; }
    }
    return pb;
  }

  function lireTrace(c, s, champ) {
    if (c.ouvert) {
      const f = ramener(c, s) / c.pas, entier = Math.floor(f), i = Math.min(entier, c.n - 1), j = Math.min(i + 1, c.n - 1), t = i === j ? 0 : f - entier;
      return c[champ][i] + (c[champ][j] - c[champ][i]) * t;
    }
    const f = ramener(c, s) / c.pas, entier = Math.floor(f), i = entier % c.n, j = (i + 1) % c.n;
    return c[champ][i] + (c[champ][j] - c[champ][i]) * (f - entier);
  }
  function echantillonTrace(c, s, sortie) {
    if (!sortie) sortie = {};
    if (c.ouvert) {
      const f = ramener(c, s) / c.pas, entier = Math.floor(f), i = Math.min(entier, c.n - 1), j = Math.min(i + 1, c.n - 1), t = i === j ? 0 : f - entier;
      for (const k of CHAMPS_LECTURE_TRACE) sortie[k] = c[k][i] + (c[k][j] - c[k][i]) * t;
      sortie.cap = c.cap[i] + angle(c.cap[j] - c.cap[i]) * t;
      if (c.ligne) sortie.ligne = c.ligne[i] + (c.ligne[j] - c.ligne[i]) * t;
      if (c.vitesse) sortie.vitesse = c.vitesse[i] + (c.vitesse[j] - c.vitesse[i]) * t;
      return sortie;
    }
    const f = ramener(c, s) / c.pas, entier = Math.floor(f), i = entier % c.n, j = (i + 1) % c.n;
    for (const k of CHAMPS_LECTURE_TRACE) sortie[k] = c[k][i] + (c[k][j] - c[k][i]) * (f - entier);
    sortie.cap = c.cap[i] + angle(c.cap[j] - c.cap[i]) * (f - entier);
    if (c.ligne) sortie.ligne = c.ligne[i] + (c.ligne[j] - c.ligne[i]) * (f - entier);
    if (c.vitesse) sortie.vitesse = c.vitesse[i] + (c.vitesse[j] - c.vitesse[i]) * (f - entier);
    return sortie;
  }
  // Demi-largeur gauche/droite ; le générateur historique reste à largeur constante.
  function largeurA(c, s, cote) {
    return c.type === 'trace-explicite' ? lireTrace(c, s, cote < 0 ? 'largeurG' : 'largeurD') : c.largeur / 2;
  }

  // Premier échantillon du tunnel (N échantillons) : au milieu de la plus longue portion droite (rayon > 400 m) entre 30 et
  // 92 % du tour ; −1 s'il n'y en a pas d'assez longue.
  function choisirTunnel(courbure, n, N) {
    const i1 = Math.round(.3 * n), i2 = Math.round(.92 * n), droit = i => Math.abs(courbure[i]) < 1 / 400;
    let meilleur = null;
    for (let i = i1; i < i2;) {
      if (!droit(i)) { i++; continue; }
      let j = i;
      while (j < i2 && droit(j)) j++;
      if (j - i >= N && (!meilleur || j - i > meilleur.long)) meilleur = { debut: i, long: j - i };
      i = j;
    }
    return meilleur ? meilleur.debut + Math.floor((meilleur.long - N) / 2) : -1;
  }

  // ---------------------------------------------------------------- lecture
  // dans le tunnel (marge en mètres de part et d'autre) ?
  function dansTunnel(c, s, marge = 0) {
    if (B.couverts) return B.couverts.dansTunnel(c, s, marge);
    if (c && c.couverts) {
      const t = dansCouvert(c, s, marge);
      return !!t && t.type === 'tunnel';
    }
    const t = c && c.tunnel;
    if (!t) return false;
    const L = c.longueur;
    const x = c.ouvert ? Math.max(0, Math.min(s, L)) : ((s % L) + L) % L;
    return x > t.debut - marge && x < t.fin + marge;
  }
  // Retourne l'ouvrage lui-même, sans allocation, pour la chaussée, la lumière et les caméras.
  // Le premier tunnel reste exposé par c.tunnel pour les consommateurs historiques.
  function dansCouvert(c, s, marge = 0) {
    if (B.couverts) return B.couverts.segment(c, s, marge);
    if (!c) return null;
    const x = c.ouvert ? Math.max(0, Math.min(s, c.longueur)) : ((s % c.longueur) + c.longueur) % c.longueur;
    if (c.couverts) {
      for (let i = 0; i < c.couverts.length; i++) {
        const t = c.couverts[i];
        if (x > t.debut - marge && x < t.fin + marge) return t;
      }
      return null;
    }
    const t = c.tunnel;
    return t && x > t.debut - marge && x < t.fin + marge ? t : null;
  }
  const ramener = (c, s) => {
    if (c.ouvert) return s < 0 ? 0 : s > c.longueur ? c.longueur : s;
    const L = c.longueur; s %= L; return s < 0 ? s + L : s;
  };
  // `sortie`, facultatif : objet de l'appelant, rempli et rendu au lieu d'un objet neuf. Le pas de simulation lit
  // le tracé des dizaines de fois par voiture et par pas ; sans objet à remplir, chaque lecture est un objet jeté.
  // Les nombres sont les mêmes au bit près dans les deux cas (mêmes opérations, même ordre).
  function echantillon(c, s, sortie) {
    if (c.type === 'trace-explicite') return echantillonTrace(c, s, sortie);
    s = ramener(c, s);
    const f = s / c.pas, i = Math.floor(f) % c.n, j = (i + 1) % c.n, t = f - Math.floor(f);
    const X = c.x, Y = c.y, Z = c.z, K = c.courbure, Pe = c.pente, D = c.devers, Li = c.ligne, V = c.vitesse;
    const x = X[i] + (X[j] - X[i]) * t, y = Y[i] + (Y[j] - Y[i]) * t, z = Z[i] + (Z[j] - Z[i]) * t;
    const cap = c.cap[i] + angle(c.cap[j] - c.cap[i]) * t, courbure = K[i] + (K[j] - K[i]) * t;
    const pente = Pe[i] + (Pe[j] - Pe[i]) * t, devers = D[i] + (D[j] - D[i]) * t;
    const ligne = Li[i] + (Li[j] - Li[i]) * t, vitesse = V[i] + (V[j] - V[i]) * t;
    if (!sortie) return { x, y, z, cap, courbure, pente, devers, ligne, vitesse };
    sortie.x = x; sortie.y = y; sortie.z = z; sortie.cap = cap; sortie.courbure = courbure;
    sortie.pente = pente; sortie.devers = devers; sortie.ligne = ligne; sortie.vitesse = vitesse;
    return sortie;
  }
  function point(c, s, d, h = 0) {
    const e = echantillon(c, s), sa = Math.sin(e.cap), ca = Math.cos(e.cap), sd = Math.sin(e.devers), cd = Math.cos(e.devers);
    // normale de la chaussée : verticale inclinée par le dévers (côté droit plus bas si dévers > 0).
    // La hauteur emploie tan pour que le plan passant par (d, y − d·tan(devers)) ait exactement
    // cette normale (pente transversale tan(devers) ⟺ normale inclinée de devers).
    const n = [-sd * sa, cd, sd * ca];
    return [e.x - sa * d + n[0] * h, e.y - d * Math.tan(e.devers) + n[1] * h, e.z + ca * d + n[2] * h];
  }
  function repere(c, s) {
    const e = echantillon(c, s), sa = Math.sin(e.cap), ca = Math.cos(e.cap), sd = Math.sin(e.devers), cd = Math.cos(e.devers);
    const lp = Math.hypot(1, e.pente);
    let t = [ca / lp, e.pente / lp, sa / lp];
    let r = [-sa * cd, -sd, ca * cd];
    // r orthogonal à t, puis n = r × t (vers le haut)
    const p = r[0] * t[0] + r[1] * t[1] + r[2] * t[2];
    r = [r[0] - p * t[0], r[1] - p * t[1], r[2] - p * t[2]];
    const lr = Math.hypot(r[0], r[1], r[2]); r = r.map(v => v / lr);
    const n = [r[1] * t[2] - r[2] * t[1], r[2] * t[0] - r[0] * t[2], r[0] * t[1] - r[1] * t[0]];
    return { t, r, n };
  }
  // Un léger décalage entre les deux colonnes maintient l'ordre de grille dès le premier pas.
  function abscisseGrille(c, place) {
    if (c.partition === 'ovale-des-forges') return -10 - 10 * Math.floor(place / 2) - .6 * (place % 2);
    return -10 - 8 * place;
  }
  function ecart(c, s1, s2) {
    if (c.ouvert) return s2 - s1;
    const L = c.longueur;
    let d = (s2 - s1) % L;
    if (d < -L / 2) d += L; else if (d >= L / 2) d -= L;
    return d;
  }
  function vibreurA(c, s, cote) {
    if (c.type === 'trace-explicite' && c.vibreur?.length !== c.n) return false; // couche optionnelle du parcours
    const i = Math.round(ramener(c, s) / c.pas) % c.n;
    return !!(c.vibreur[i] & (cote < 0 ? 1 : 2));
  }
  function limiteA(c, s, cote) {
    if (c.type === 'trace-explicite') return lireTrace(c, s, cote < 0 ? 'limiteG' : 'limiteD');
    const i = Math.round(ramener(c, s) / c.pas) % c.n;
    return cote < 0 ? c.limiteG[i] : c.limiteD[i];
  }
  function valider(c) {
    if (c && c.partition === 'route-des-cimes') return B.routeDesCimes.valider(c);
    if (c && c.id === 'marseille' && B.marseille) return B.marseille.valider(c);
    if (c && c.type === 'trace-explicite') return validerTrace(c);
    const pb = [];
    const finis = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse'].every(k => c[k].length === c.n && c[k].every(Number.isFinite));
    if (!finis) pb.push('valeurs non finies ou tableaux de mauvaise taille');
    if (c.longueur !== c.n * PAS) pb.push('longueur différente de n × pas');
    const fx = c.x[0] - c.x[c.n - 1], fz = c.z[0] - c.z[c.n - 1];
    if (Math.abs(Math.hypot(fx, fz) - PAS) > .5) pb.push('boucle mal refermée');
    let kmax = 0, pmax = 0;
    for (let i = 0; i < c.n; i++) { kmax = Math.max(kmax, Math.abs(c.courbure[i])); pmax = Math.max(pmax, Math.abs(c.pente[i])); }
    if (kmax > 1 / 23.5) pb.push('rayon minimal inférieur à 24 m');
    if (pmax > .07) pb.push('pente supérieure à 7 %');
    if (brasTropProches(c.x, c.z, c.n, 59)) pb.push('deux portions du tracé trop proches');
    return pb;
  }

  B.circuit = { creer, creerDepuisTrace, preparerParcours, preparerStands, abscisseGrille, axeStands, bandeStands, bordStands, surVoieStands, empriseStands, ramener, echantillon, point, repere, ecart, vibreurA, limiteA, largeurA, valider, dansTunnel, dansCouvert, choisirTunnel, PAS, LARGEUR };
})(globalThis.BITUME = globalThis.BITUME || {});
