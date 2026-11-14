/* BITUME — contacts entre voitures (Chantier 3). Remplace les auto-tamponneuses : frotter les roues d'un autre
   fait sauter (petit bond rattrapable, ou grand arc qui peut casser), un choc de caisse orienté fait tourner,
   une roue décalée fait braquer. Une seule réponse par paire (réarmement après séparation), immunité après un
   accident, et les dégâts sont facturés à degats.js. Rien ici ne dépend du moteur ni du rendu. */
(function (B) {
  'use strict';

  const PARAMS = Object.freeze({
    LONGUEUR: 4.95, LARGEUR: 2.02,   // emprise de la caisse (critères)
    bondVMin: 0.65,                  // rapprochement latéral minimal pour un bond
    sautVMin: 6.5,                   // au-delà, grand arc
    rearmSeparation: 0.35,           // délai après séparation avant une nouvelle interaction
    rearmBond: 1.25,                 // délai minimal entre deux petits bonds d'une même paire
    rearmEvent: 0.30,                // jamais deux événements de la même paire en moins de 0,3 s
    lacetDecale: 0.06,               // lacet minimal (rad) d'une roue décalée (≈ 3,4° > 2°)
    lacetChoc: 0.9                    // gain du lacet sur un choc de caisse orienté
  });
  const P = PARAMS;

  function ecartSigne(L, a, b) { let d = b - a; while (d > L / 2) d -= L; while (d < -L / 2) d += L; return d; }
  function ramener(s, Lc) { return ((s % Lc) + Lc) % Lc; }

  // état par paire : minuteurs d'événement, de bond, et drapeau de séparation
  function paire(co, k) {
    let p = co._paire[k];
    if (!p) p = co._paire[k] = { tEvent: -9, tBond: -9, separe: true, tSeparation: 0 };
    return p;
  }

  // un choc facture des dégâts aux deux caisses (roue locale si le contact est latéral)
  function facturer(co, V, i, j, force, lateral) {
    if (!B.degats) return;
    for (const idx of [i, j]) {
      const v = V[idx];
      if (!v.degats) continue;
      const roue = lateral ? (v.etat.d >= 0 ? (v.etat.psi > 0 ? 1 : 0) : (v.etat.psi > 0 ? 3 : 2)) : undefined;
      const e = B.degats.choc(v.degats, force, { roue });
      if (e) for (const x of e) { x.id = v.id; co._ev.push(x); }
      if (v.degats.casse && !v.etat.accident) B.conduite.declencherAccident(v.etat, {});
    }
  }

  function pas(course, ev) {
    const V = course.voitures, c = course.c, n = V.length, L = c.longueur, t = course.horloge;
    if (!course._paire) course._paire = {};
    course._ev = ev;
    for (let i = 0; i < n; i++) {
      const a = V[i].etat;
      for (let j = i + 1; j < n; j++) {
        const b = V[j].etat, k = i * n + j, p = paire(course, k);
        const ds = ecartSigne(L, a.s, b.s);                 // b devant a si ds > 0
        const ol = P.LONGUEUR - Math.abs(ds);               // chevauchement longitudinal
        const dd = b.d - a.d, olat = P.LARGEUR - Math.abs(dd); // chevauchement latéral
        const separe = ol <= 0 || olat <= 0;
        if (separe) {
          if (!p.separe) { p.separe = true; p.tSeparation = t; }   // vient de se séparer : réarmement en cours
          continue;
        }
        // réarmement : il faut être séparé puis attendre 0,35 s, et pas deux événements en 0,3 s
        if (!p.separe && t - p.tSeparation < P.rearmSeparation) continue;
        if (t - p.tEvent < P.rearmEvent) continue;
        p.separe = false;

        // aucun contact avec une caisse en l'air, en accident ou immunisée
        const bloque = e => (e.saut && e.saut.actif) || e.accident || e.immunite > 0;
        if (bloque(a) || bloque(b)) continue;

        const sg = ds >= 0 ? 1 : -1;            // b devant a si sg > 0
        const ar = sg > 0 ? a : b, av = sg > 0 ? b : a;   // arrière, avant
        const sgD = dd >= 0 ? 1 : -1;           // b à droite de a si sgD > 0
        const vrLong = ar.v - av.v;             // rapprochement longitudinal (l'arrière rejoint l'avant)
        // vitesse de rapprochement latéral (signée, vers la droite de a positive)
        const vrLat = (a.v * Math.sin(a.psi) - b.v * Math.sin(b.psi)) * sgD;

        const lateral = olat <= ol;             // on pénètre par le flanc (roue contre roue) ou par la face
        let force = 0;

        if (lateral) {
          // séparation latérale
          a.d -= sgD * olat / 2; b.d += sgD * olat / 2;
          const rapprochement = Math.max(0, vrLat);
          // roue contre roue : un frottement suffisant fait sauter la voiture (l'arrière qui talonne le flanc)
          const peutSauter = !a.saut && !b.saut;
          if (peutSauter && rapprochement >= P.bondVMin && t - p.tBond >= P.rearmBond) {
            const grand = rapprochement >= P.sautVMin;
            // la voiture qui monte sur la roue de l'autre : celle qui est derrière et pousse vers l'autre
            const victime = vrLong > 0 ? (sg > 0 ? a : b) : (sgD > 0 ? b : a);
            const roulV = (sgD > 0 ? -1 : 1) * (grand ? 2.4 : 0.7);
            const tangV = grand ? -1.4 : -0.3;
            B.conduite.lancerSaut(victime, { grand, pouss: sgD, roulV, tangV, omega: victime.omega + (sgD > 0 ? -0.18 : 0.18) });
            p.tBond = t;
          }
          // roue décalée : le cap tourne d'au moins 2°, selon la géométrie de l'engagement (qui talonne le flanc)
          if (Math.abs(ds) > 0.4) {
            const kick = P.lacetDecale * (ds >= 0 ? 1 : -1);
            a.psi -= kick; b.psi += kick;
          }
          if (rapprochement > 0) { const m = rapprochement * 0.1; a.psi -= sgD * m / Math.max(a.v, 5); b.psi += sgD * m / Math.max(b.v, 5); }
          // un frottement de roues coûte de la vitesse aux deux caisses
          const perte = Math.min(0.18, rapprochement * 0.02);
          a.v *= 1 - perte; b.v *= 1 - perte;
          force = rapprochement;
          for (const e of [a, b]) {
            const cd = e.d < 0 ? -1 : 1, lim = B.conduite.limiteCote(c, e.s, cd) - 0.1;
            if (Math.abs(e.d) > lim) e.d = cd * lim;
          }
        } else {
          // choc de caisse longitudinal : séparation + lacet orienté selon le décalage latéral (T-bone, talonnage)
          a.s = ramener(a.s - sg * ol / 2, L); b.s = ramener(b.s + sg * ol / 2, L);
          if (vrLong > 0) { ar.v -= 0.30 * vrLong; av.v += 0.15 * vrLong; }
          // le décalage latéral du point d'impact fait tourner la caisse touchée
          const bras = dd / (P.LARGEUR / 2);                 // -1..1, excentrement de l'impact
          const lacet = P.lacetChoc * vrLong * bras * 0.05;
          a.omega -= lacet; b.omega += lacet;
          force = Math.max(0, vrLong);
        }

        // une seule réponse par paire : horodatée, avec un contact émis au plus tous les 0,3 s
        p.tEvent = t;
        ev.push({ type: 'contact', a: V[i].id, b: V[j].id, force, lateral });
        facturer(course, V, i, j, force, lateral);
        for (const v of [V[i], V[j]]) if (v.joueur) { const x = B.conduite.annulerDerive(v.etat); if (x) { x.id = v.id; ev.push(x); } }
      }
    }
  }

  B.contacts = { PARAMS, pas };
})(globalThis.BITUME = globalThis.BITUME || {});
