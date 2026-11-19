/* BITUME — 12F4 : décision et conduite des arrêts IA, sans écrire la pose ni réparer la voiture.
   creer() préalloue le plan et ses commandes ; course.js le place dans v.ia.stand.
   commandes(course, v, sortie?) rend des commandes, ou null pour conserver l'IA ordinaire.
   autorise(course, v) ouvre seulement le service existant d'une IA locale réellement engagée.
   servicePossible(course, v) relit l'occupation avant l'admission ; un service commencé reste à course.js.
   La décision au repos est lue à 2 Hz ; le guidage engagé suit le pas de simulation. */
(function (B) {
  'use strict';
  const PARAMS = Object.freeze({ usure: .72, gainMonte: .12, dureeMonte: 8, decision: .5,
    attente: 25, tempsMaximum: 90, vitesseVoie: 9.5, intervalle: 9, margeArret: 2 });
  const SURFACE = {};
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ramener = (x, l) => ((x % l) + l) % l;
  const ecart = (c, a, b) => B.circuit.ecart(c, a, b);
  function lire(c, tab, s) {
    const f = ramener(s, c.longueur) / c.pas, i = Math.floor(f), j = (i + 1) % c.n;
    return tab[i % c.n] + (tab[j] - tab[i % c.n]) * (f - i);
  }
  function creer() {
    return { phase: 'repos', motif: '', pneus: '', candidat: '', dureeCandidat: 0,
      prochaineDecision: 0, derniereDecision: 0, attendre: 0, passageAttente: -2,
      debut: 0, revision: 0, vuStand: false, reussi: false, admission: false,
      commande: { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false,
        boite: 'auto', aide: .35, guidage: 0, marcheArriere: false } };
  }
  function eligible(co, v) {
    return !!(co && !co.termine && co.mode === 'course' && co.c?.stands && Array.isArray(co.voitures) && v && v.ia?.stand &&
      co.voitures.includes(v) && !v.distant && !v.fini && !v.abandon &&
      ((!v.joueur && !v.humain) || v.reprise) && v.etat && Number.isFinite(v.etat.s) &&
      Number.isFinite(v.etat.d) && Number.isFinite(v.etat.v));
  }
  function autorise(co, v) {
    if (!eligible(co, v)) return false;
    const p = v.ia.stand;
    const x = ecart(co.c, co.c.stands.debut, v.etat.s);
    return p.phase === 'approche' && x >= 0 && co.phase === 'course' && co.drapeau == null ||
      p.phase === 'voie' || p.phase === 'service' ||
      p.phase === 'sortie' && !!v.etat.stands;
  }
  // Appelé après les contacts : l'admission ne repose jamais sur le cache du guidage précédent.
  function servicePossible(co, v) {
    if (!eligible(co, v)) return false;
    const phase = v.ia.stand.phase;
    if (phase !== 'voie' && phase !== 'service') return false;
    const c = co.c, S = c.stands, x = ecart(c, S.debut, v.etat.s), g0 = S.garage0 - S.debut, g1 = S.garage1 - S.debut;
    for (let i = 0; i < co.voitures.length; i++) {
      const o = co.voitures[i]; if (o === v) continue;
      const e = o.etat, p = o.ia?.stand, ox = ecart(c, S.debut, e.s);
      if (Math.abs(e.d - S.d) < 2.8 && ox >= g0 - 12 && ox <= g1 + 6 &&
        (e.stands?.phase === 'service' || (o.joueur || o.humain) && !o.reprise && (e.stands || Math.abs(e.v) < 13))) return false;
      if (p && !o.distant && !o.fini && !o.abandon && p.phase !== 'repos' && p.phase !== 'degager' &&
        ox <= (p.phase === 'sortie' ? g1 + 12 : S.fin - S.debut + 12) &&
        (ox > x + .25 || Math.abs(ox - x) <= .25 && o.id < v.id)) return false;
    }
    return true;
  }
  function passage(v) { return Number.isFinite(v.maxPassages) ? v.maxPassages : v.passages || 0; }
  function finir(co, v) {
    const p = v.ia.stand;
    p.phase = 'repos'; p.attendre = co.temps + PARAMS.attente; p.passageAttente = passage(v);
    p.vuStand = false; p.admission = false; p.candidat = ''; p.dureeCandidat = 0;
    p.prochaineDecision = p.attendre;
    v.ia.cible = -1; v.ia.cote = 0; v.ia.decalVise = 0; v.ia.decalDep = 0;
  }
  function engager(co, v, p, S, surface, maintenant) {
    if (maintenant < p.prochaineDecision) return false;
    const duree = clamp(maintenant - p.derniereDecision, 0, PARAMS.decision * 2);
    p.derniereDecision = maintenant; p.prochaineDecision = maintenant + PARAMS.decision;
    if (co.phase !== 'course' || co.drapeau != null || maintenant < 5 || maintenant < p.attendre ||
      passage(v) <= p.passageAttente || co.toursTotal - Math.max(0, v.tours) <= 1 || v.etat.standsSortie) return false;
    const e = v.etat;
    if (!B.pneus.estJouable(e.pneus) || !Array.isArray(e.etatPneus) || e.etatPneus.length !== 4 || e.v < 0) return false;
    let usure = 0;
    for (let i = 0; i < 4; i++) {
      if (!Number.isFinite(e.etatPneus[i]?.usure)) return false;
      usure = Math.max(usure, e.etatPneus[i].usure);
    }
    B.chaussee.lire(co.c, e.s, undefined, surface);
    let conseil = e.pneus;
    if (!surface.abri) {
      conseil = B.conduite.pneusConseilles(surface);
      const gain = B.conduite.adherencePneus(conseil, surface) /
        Math.max(.05, B.conduite.adherencePneus(e.pneus, surface)) - 1;
      if (conseil !== e.pneus && gain >= PARAMS.gainMonte) {
        p.dureeCandidat = p.candidat === conseil ? p.dureeCandidat + duree : 0;
        p.candidat = conseil;
      } else { p.candidat = ''; p.dureeCandidat = 0; }
    }
    const use = usure >= PARAMS.usure, inadapte = p.dureeCandidat >= PARAMS.dureeMonte;
    if (!use && !inadapte) return false;
    // Une décision prise sous abri ne choisit jamais des slicks à cause du seul toit du tunnel.
    if (surface.abri) return false;
    const distance = ecart(co.c, e.s, S.debut), adhesion = Math.max(.25, B.conduite.adherenceVoiture(e, surface));
    const freinage = Math.max(0, e.v * e.v - S.vitesse * S.vitesse) / (12 * adhesion) + 1.5 * e.v + 35;
    const portee = Math.min(co.c.longueur * .4, Math.max(350, freinage + 100));
    if (distance < 35 || distance > portee || distance < freinage * .8) return false;
    p.phase = 'approche'; p.motif = use ? 'usure' : 'monte'; p.pneus = inadapte ? p.candidat : conseil;
    p.debut = maintenant; p.revision = e.servicePneus; p.vuStand = false; p.reussi = false;
    e.pneusProchainArret = p.pneus;
    v.ia.cible = -1; v.ia.cote = 0; v.ia.decalVise = 0; v.ia.decalDep = 0;
    v.ia.sillage = -1; v.ia.defend = 0; v.ia.presse = -1; v.ia.bloque = 0; v.ia.degagement = 0;
    return true;
  }
  function commandes(co, v, sortie) {
    if (!eligible(co, v)) return null;
    const c = co.c, S = c.stands, e = v.etat, p = v.ia.stand, maintenant = co.temps;
    if (e.recuperation || e.accident || e.saut || e.reparation || e.degats?.casse) {
      if (p.phase !== 'repos') finir(co, v);
      return null;
    }
    if (p.phase === 'repos' && !engager(co, v, p, S, SURFACE, maintenant)) return null;
    const st = e.stands;
    if (!st && p.phase === 'approche' && (co.drapeau != null || co.phase !== 'course')) p.phase = 'degager';
    if (st && p.phase !== 'degager') {
      p.vuStand = true;
      if (st.phase === 'voie') p.phase = 'voie';
      else if (st.phase === 'service') p.phase = 'service';
      else if (st.phase === 'sortie') { p.phase = 'sortie'; p.reussi = true; }
    } else if (p.vuStand && p.phase !== 'sortie' && p.phase !== 'degager') p.phase = 'degager';
    const x = ecart(c, S.debut, e.s), garage0 = S.garage0 - S.debut, garage1 = S.garage1 - S.debut;
    if ((p.phase === 'approche' || p.phase === 'voie') &&
      (x > garage1 || maintenant - p.debut > PARAMS.tempsMaximum)) p.phase = 'degager';
    const cmd = sortie || p.commande;
    cmd.gaz = 0; cmd.frein = 0; cmd.volant = 0; cmd.derive = false; cmd.haut = false; cmd.bas = false;
    cmd.boite = 'auto'; cmd.aide = .35; cmd.guidage = 0; cmd.marcheArriere = false;
    if (p.phase === 'service') { cmd.frein = 1; return cmd; }
    B.chaussee.lire(c, e.s, undefined, SURFACE);
    const adhesion = Math.max(.20, B.conduite.adherenceVoiture(e, SURFACE));
    const vitesse = Math.max(0, e.v), deceleration = 4 * adhesion, freinage = 6 * adhesion;
    let sortieStand = p.phase === 'sortie' || p.phase === 'degager';
    const regard = p.phase === 'degager' ? 4 + .25 * vitesse : 8 + .45 * vitesse;
    const ligne = lire(c, c.ligne, e.s + regard), courbure = lire(c, c.courbure, e.s);
    const h = e.psi + e.beta, moiLat = 2.475 * Math.abs(Math.sin(h)) + 1.01 * Math.abs(Math.cos(h));
    const moiLong = 2.475 * Math.abs(Math.cos(h)) + 1.01 * Math.abs(Math.sin(h));
    const utile = Math.max(.5, c.largeur / 2 - moiLat - .25);
    let dVise = S.d, cible = PARAMS.vitesseVoie, rang = 0, humainAuGarage = false, fusionLibre = true;
    const V = co.voitures;
    // Réservation dérivée de l'ordre réel : aucune file invisible, aucun déplacement d'une autre voiture.
    for (let i = 0; i < V.length; i++) {
      const o = V[i]; if (o === v) continue;
      const oe = o.etat, op = o.ia?.stand, ox = ecart(c, S.debut, oe.s), ds = ecart(c, e.s, oe.s);
      if (op && !o.distant && !o.fini && !o.abandon && op.phase !== 'repos' && op.phase !== 'degager' &&
        ox <= (op.phase === 'sortie' ? garage1 + 12 : S.fin - S.debut + 12) &&
        (ox > x + .25 || Math.abs(ox - x) <= .25 && o.id < v.id)) rang++;
      if ((o.joueur || o.humain) && !o.reprise && Math.abs(oe.d - S.d) < 2.8 &&
        ox >= garage0 - 12 && ox <= garage1 + 6 && (oe.stands || Math.abs(oe.v) < 13)) humainAuGarage = true;
      if (sortieStand && oe.d < S.d - 1.8 && ds > -Math.max(14, (oe.v - vitesse) * 3 + 10) && ds < 12) fusionLibre = false;
    }
    p.admission = rang === 0 && !humainAuGarage;
    if (!sortieStand && !p.admission && x >= garage0 - 1) { p.phase = 'degager'; sortieStand = true; }
    if (sortieStand) {
      const peutRentrer = p.phase === 'degager' || x > S.fin - S.debut - 25;
      if (peutRentrer && fusionLibre) dVise = p.phase === 'degager' ? Math.min(ligne, 0) : ligne;
      const rejoint = p.phase === 'degager' ? Math.abs(e.d - S.d) > S.demi + 1 : Math.abs(e.d - ligne) < .6;
      const degagementFini = p.phase !== 'degager' || !p.vuStand || x > garage1 + 12;
      if (!st && peutRentrer && fusionLibre && rejoint && degagementFini && Math.abs(e.psi) < .12) {
        finir(co, v); return null;
      }
      cible = Math.min(18, lire(c, c.vitesse, e.s) * Math.sqrt(adhesion) * .8);
      if (!peutRentrer || !fusionLibre) cible = PARAMS.vitesseVoie;
    } else {
      const attente = rang > 0 || humainAuGarage;
      const arret = attente ? S.garage0 - PARAMS.intervalle * Math.max(1, rang) : (S.garage0 + S.garage1) / 2;
      const restant = ecart(c, e.s, arret);
      cible = Math.min(PARAMS.vitesseVoie, Math.sqrt(2 * deceleration * Math.max(0, restant - PARAMS.margeArret)));
      // Préparer la vitesse sur la vraie route ; le décalage se fait progressivement dans la ligne droite.
      if (x < -20) {
        cible = Math.min(lire(c, c.vitesse, e.s) * Math.sqrt(adhesion) * .85,
          Math.sqrt(PARAMS.vitesseVoie ** 2 + 2 * freinage * Math.max(0, -x - 25)));
        const debut = Math.max(c.ligneDroite.debut - S.debut + 20, -210);
        const f = clamp((x - debut) / Math.max(30, -25 - debut), 0, 1);
        dVise = ligne + (S.d - ligne) * f;
      }
      if (restant < -3 && x > garage1) p.phase = 'degager';
    }
    let dMin = -utile, dMax = utile;
    // Les mêmes emprises que l'IA ordinaire : garder un intervalle réel avant de se rabattre ou d'avancer.
    for (let i = 0; i < V.length; i++) {
      const o = V[i]; if (o === v) continue;
      const oe = o.etat, oh = oe.psi + oe.beta, ds = ecart(c, e.s, oe.s);
      const lat = 2.475 * Math.abs(Math.sin(oh)) + 1.01 * Math.abs(Math.cos(oh));
      const long = 2.475 * Math.abs(Math.cos(oh)) + 1.01 * Math.abs(Math.sin(oh));
      const largeur = moiLat + lat + .4;
      if (Math.abs(ds) < moiLong + long + 2) {
        if (oe.d >= e.d) dMax = Math.min(dMax, oe.d - largeur);
        else dMin = Math.max(dMin, oe.d + largeur);
      }
      if (ds > 0 && ds < 160 && (Math.abs(oe.d - dVise) < largeur || Math.abs(oe.d - e.d) < largeur)) {
        const gap = Math.max(0, ds - moiLong - long - 3), ov = Math.max(0, oe.v);
        let limite = Math.min(ov + gap * .65, Math.sqrt(ov * ov + 2 * deceleration * gap));
        // Le couloir visé est libre : garder une très faible avance pour pouvoir braquer, sans consommer
        // la vraie distance entre les caisses. À l'arrêt complet, aucun déplacement latéral n'est possible.
        if (p.phase === 'degager' && fusionLibre && Math.abs(oe.d - dVise) >= largeur) {
          const espaceReel = Math.max(0, ds - moiLong - long - .7);
          limite = Math.max(limite, Math.min(1.5, espaceReel * .8));
        }
        cible = Math.min(cible, limite);
      }
    }
    dVise = dMin > dMax ? e.d : clamp(dVise, dMin, dMax);
    const ouverture = Math.min(p.phase === 'degager' ? .65 : .30, Math.asin(Math.min(1, 4 / Math.max(vitesse, 1))));
    const psi = clamp(Math.atan2(dVise - e.d, regard), -ouverture, ouverture);
    const k = courbure / Math.max(1 - courbure * e.d, .3) +
      2.2 * (psi - e.psi) * Math.max(vitesse, 5) / (10 * Math.max(vitesse, 3));
    cmd.volant = B.conduite.volantPour(e, k);
    if (cible < .05) cmd.frein = 1;
    else if (vitesse > cible + .15) cmd.frein = clamp((vitesse - cible) * .45, 0, 1);
    else cmd.gaz = clamp((cible - vitesse + .15) * .35, 0, .75);
    v.ia.bloque = 0; v.ia.retourBloque = false;
    return cmd;
  }
  B.strategieStands = Object.freeze({ PARAMS, creer, commandes, autorise, servicePossible });
})(globalThis.BITUME = globalThis.BITUME || {});
