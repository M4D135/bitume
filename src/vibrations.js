/* BITUME — synthèse des vibrations, un état indépendant par voiture locale. */
(function (B) {
  'use strict';
  const SEUIL = .018, TAU = Math.PI * 2;
  const unite = x => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
  const phase = (p, hz, dt) => (p + hz * dt) % 1;
  const onde = p => (1 + Math.sin(p * TAU)) * .5;
  function creer() {
    return {
      moteur: 0, grain: 0, grainFin: 0, bord: 0, aide: 0, derive: 0, dernierNiveau: -1,
      envFort: 0, tenueFort: 0, dureeFort: .12, rapport: 0, envDerive: 0, envTic: 0,
      vide: {}, sortie: { faible: 0, fort: 0, gachetteG: 0, gachetteD: 0 }
    };
  }
  function impact(V, niveau, duree) {
    if (niveau <= 0 || niveau < V.envFort) return;
    V.envFort = niveau;
    V.tenueFort = .038;
    V.dureeFort = duree;
  }
  function intensite(x, gain) {
    const v = unite(x * gain);
    return v >= SEUIL ? v : 0;
  }
  function calculer(V, entree, dt) {
    const e = entree || V.vide, pas = Number.isFinite(dt) ? Math.min(.25, Math.max(0, dt)) : 0;
    const gain = unite(e.force == null ? .5 : e.force);
    const volume = gain <= .5 ? 2 * gain : 1 + (gain - .5) * 1.15;
    const vitesse = Math.abs(e.v || 0), charge = unite(e.gaz);
    const plage = e.maxUtile - e.ralenti;
    const r = plage > 0 ? unite((e.regime - e.ralenti) / plage) : 0;
    // Le moteur accélère son battement et déplace une partie du grave vers l'aigu.
    // Les fréquences sont celles de l'enveloppe des actionneurs, en dessous de la cadence d'envoi.
    V.moteur = phase(V.moteur, 3 + 7 * r, pas);
    const battement = onde(V.moteur);
    const moteur = Math.sqrt(r) * (.55 + .45 * charge);
    let fort = moteur * (.10 + .053 * battement);
    let faible = moteur * r * (.038 + .065 * battement);
    let gauche = 0, droite = 0;
    if (r > .97) droite = battement * .10 * charge;

    // Deux ondulations du grain avancent avec la distance parcourue. À moteur coupé
    // et en roue libre, le grain reste sensible sur le seul canal léger.
    const auSol = e.auSol !== false, actifSol = auSol && vitesse > .3;
    if (actifSol) {
      V.grain = phase(V.grain, Math.min(6.3, vitesse * .21), pas);
      V.grainFin = phase(V.grainFin, Math.min(11.7, vitesse * .39), pas);
      const texture = .22 + .48 * onde(V.grain) + .30 * onde(V.grainFin);
      const roulement = Math.sqrt(unite(vitesse / 56));
      const meuble = e.surface === 'herbe' || e.surface === 'gravier';
      const grain = roulement * texture * (meuble ? (e.surface === 'gravier' ? .19 : .15) : .064);
      faible = Math.max(faible, grain);
      if (meuble) fort = Math.max(fort, grain * .72);
      if (e.vibreur || e.surface === 'vibreur') {
        // Une dent tous les 3,6 m. Le bas de l'onde laisse une séparation franche entre les dents.
        V.bord = phase(V.bord, Math.min(12, vitesse / 3.6), pas);
        const dent = .5 + .5 * Math.tanh(2.2 * Math.sin(TAU * V.bord));
        const bord = Math.min(1, vitesse / 6) * (.052 + .235 * dent);
        faible = Math.max(faible * .55, bord * .65);
        fort = Math.max(fort * .55, bord);
      }
    }

    // Les aides restent en arrière-plan. Les gâchettes portent le blocage et le patinage
    // sur les manettes qui les exposent. Elles n'ajoutent pas un deuxième impact au corps.
    V.aide = phase(V.aide, 8, pas);
    const pulse = .38 + .62 * onde(V.aide);
    if (auSol) {
      gauche = unite(e.blocage) * (.11 + .12 * pulse);
      droite = Math.max(droite, unite(e.patinage) * (.11 + .12 * pulse));
      faible = Math.max(faible, Math.max(unite(e.glisseAr), unite(e.glisseAv)) * pulse * .064);
    }
    const d = e.derive;
    if (d && d.actif) {
      const n = Math.round(3 * unite(d.niveau / 3));
      const precedent = V.derive;
      V.derive = phase(V.derive, 2 + 2 * n, pas);
      if (V.derive < precedent) V.envDerive = .075 + .010 * n;
      if (V.dernierNiveau >= 0 && n > V.dernierNiveau) V.envTic = .12;
      V.dernierNiveau = n;
    }
    fort = Math.max(fort, V.envTic);
    faible = Math.max(faible, V.envDerive);
    if (d && d.fenetre > 0) {
      faible = Math.max(faible, .085 * pulse);
      fort = Math.max(fort, .053 * pulse);
    }
    V.envDerive *= Math.exp(-pas / .025);
    V.envTic *= Math.exp(-pas / .033);

    const events = e.evenements;
    if (events) for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.type === 'rapport') V.rapport = .105;
      else if (ev.type === 'choc' || ev.type === 'contact') {
        const niveau = Math.sqrt(unite((ev.force - 2) / 28));
        impact(V, niveau * .61, .060 + .095 * niveau);
      } else if (ev.type === 'roue' || ev.type === 'casse') impact(V, .55, .13);
      else if (ev.type === 'atterrissage') impact(V, .31, .088);
    }
    // Un choc lourd prend le premier plan. La boîte donne une impulsion légère de
    // 40 ms puis s'efface. Chacun atteint au moins une commande même à 144 images/s.
    const boite = Math.min(1, V.rapport / .065);
    const apresChoc = 1 - unite(V.envFort / .27);
    const fond = (1 - boite * .76) * apresChoc;
    fort = Math.max(fort * fond, V.envFort, .055 * boite * apresChoc);
    faible = Math.max(faible * fond, .32 * boite * boite * apresChoc);
    gauche *= fond;
    droite = Math.max(droite * fond, .19 * boite * boite * apresChoc);
    V.rapport = Math.max(0, V.rapport - pas);
    V.envFort *= Math.exp(-Math.max(0, pas - V.tenueFort) / (V.dureeFort * .44));
    V.tenueFort = Math.max(0, V.tenueFort - pas);

    const s = V.sortie;
    s.faible = intensite(faible, volume); s.fort = intensite(fort, volume);
    s.gachetteG = intensite(gauche, volume); s.gachetteD = intensite(droite, volume);
    return s;
  }
  // L'API Web peut exposer quatre canaux, deux canaux ou un simple pulse. Le choix
  // dépend du pilote et de la liaison de cette manette, y compris pour un même modèle.
  const INTERVALLE = 31, DUREE = 100;
  const ignorer = () => {};
  function creerSortie() {
    return { pad: null, routes: [], route: 0, active: false, instant: -Infinity,
      double: { startDelay: 0, duration: DUREE, weakMagnitude: 0, strongMagnitude: 0 },
      gachettes: { startDelay: 0, duration: DUREE, weakMagnitude: 0, strongMagnitude: 0, leftTrigger: 0, rightTrigger: 0 } };
  }
  function arreter(O) {
    if (!O.active) return;
    O.active = false; O.instant = -Infinity;
    // Un ancien effet peut encore tourner lors d'un repli vers une autre route.
    for (const route of O.routes) {
      if (!route.jouee) continue;
      route.jouee = false;
      for (const a of route.moteurs) {
        try {
          const res = typeof a.reset === 'function' ? a.reset() : route.mode === 'pulse' ? a.pulse(0, 0)
            : a.playEffect(route.mode, { duration: 0, weakMagnitude: 0, strongMagnitude: 0, leftTrigger: 0, rightTrigger: 0 });
          if (res && res.catch) res.catch(ignorer);
        } catch { /* l'actionneur vient de se déconnecter */ }
      }
    }
  }
  function affecter(O, pad) {
    const p = pad && pad.connected !== false ? pad : null, ancien = O.pad;
    if (p === ancien || (ancien && p && ancien.connected !== false && p.index != null && p.index === ancien.index && p.id === ancien.id)) return false;
    arreter(O);
    O.pad = p; O.routes = []; O.route = 0; O.instant = -Infinity;
    if (p) {
      const a = p.vibrationActuator, routes = O.routes;
      function ajouter(mode, moteurs) {
        const route = { mode, moteurs, jouee: false };
        function nonSupporte() {
          if (O.routes === routes && routes[O.route] === route) { route.jouee = false; O.route++; }
        }
        route.resultat = r => { if (r === 'not-supported') nonSupporte(); };
        route.echec = e => { if (e && (e.name === 'NotSupportedError' || e.name === 'TypeError')) nonSupporte(); };
        routes.push(route);
      }
      if (a && typeof a.playEffect === 'function') {
        if (a.effects?.includes('trigger-rumble')) ajouter('trigger-rumble', [a]);
        if (a.effects ? a.effects.includes('dual-rumble') : !a.type || a.type === 'dual-rumble') ajouter('dual-rumble', [a]);
      }
      const moteurs = Array.from(p.hapticActuators || []).filter(m => m && typeof m.pulse === 'function');
      if (!moteurs.length && a && typeof a.pulse === 'function') moteurs.push(a);
      if (moteurs.length) ajouter('pulse', moteurs);
    }
    return true;
  }
  function envoyer(O, s, t) {
    const route = O.routes[O.route];
    if (!route || t - O.instant < INTERVALLE) return;
    if (!(s.faible || s.fort || s.gachetteG || s.gachetteD)) {
      if (O.active) { arreter(O); O.instant = t; }
      return;
    }
    O.instant = t; O.active = true; route.jouee = true;
    const gachettes = route.mode === 'trigger-rumble', o = gachettes ? O.gachettes : O.double;
    o.strongMagnitude = s.fort;
    o.weakMagnitude = gachettes ? s.faible : Math.max(s.faible, .36 * s.gachetteG, .36 * s.gachetteD);
    if (gachettes) { o.leftTrigger = s.gachetteG; o.rightTrigger = s.gachetteD; }
    for (const a of route.moteurs) {
      try {
        const res = route.mode === 'pulse' ? a.pulse(Math.max(o.weakMagnitude, o.strongMagnitude), DUREE) : a.playEffect(route.mode, o);
        if (res && res.then) res.then(route.resultat, route.echec);
        else route.resultat(res);
      } catch (e) { route.echec(e); }
    }
  }
  B.vibrations = { creer, calculer, SEUIL, creerSortie, affecter, arreter, envoyer };
})(globalThis.BITUME = globalThis.BITUME || {});
