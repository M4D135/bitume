(function (B) {
  'use strict';
  // BITUME : déroulement d'une course ou d'une séance de chrono (grille, feux, IA, contacts,
  // tours, classement, fantôme). Pas fixe, déterministe.
  // Premier jet : Spark (KBZA, 12/11/2026). Réécrit par Claude : progression continue et
  // franchissements de ligne interpolés, drapeau à damier pour tous dès l'arrivée du premier,
  // IA lisant directement les tableaux du circuit, dépassements à décalage persistant,
  // contacts séparés à chaque pas, fantôme extensible.

  // Pilotes inventés (aucun vrai pilote).
  const PILOTES = [
    ['R. Castagnet', 3], ['E. Varenne', 5], ['P. Morvan', 7], ['L. Brasquet', 8], ['H. Delacour', 11],
    ['T. Okafor', 14], ['J. Vanmeer', 17], ['S. Ferrandi', 19], ['K. Lindgren', 22], ['M. Duvernet', 26],
    ['A. Kowalczyk', 28]
  ];
  const C = (r, g, b) => [r, g, b];
  // livrées franches et distinctes : caisse, bande, casque
  const LIVREES = [
    [C(.10, .25, .75), C(.95, .93, .88), C(.95, .78, .10)], [C(.95, .78, .10), C(.08, .08, .09), C(.10, .25, .75)],
    [C(.08, .50, .25), C(.95, .78, .10), C(.92, .92, .90)], [C(.95, .45, .08), C(.10, .12, .30), C(.92, .92, .90)],
    [C(.92, .92, .90), C(.10, .25, .75), C(.86, .10, .08)], [C(.08, .08, .09), C(.85, .68, .25), C(.85, .68, .25)],
    [C(.05, .62, .66), C(.92, .92, .90), C(.95, .45, .08)], [C(.42, .14, .58), C(.92, .92, .90), C(.95, .78, .10)],
    [C(.45, .70, .92), C(.92, .92, .90), C(.10, .25, .75)], [C(.45, .06, .12), C(.85, .68, .25), C(.92, .92, .90)],
    [C(.55, .80, .15), C(.08, .08, .09), C(.08, .50, .25)]
  ];
  const LIVREE_JOUEUR = [C(.86, .10, .08), C(.95, .93, .88), C(.95, .93, .88)];
  const LONGUEUR = 4.5, LARGEUR_VOITURE = 1.9;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function ramener(s, L) { return ((s % L) + L) % L; }
  function ecart(c, s1, s2) { return B.circuit.ecart(c, s1, s2); }
  // lecture interpolée d'un tableau du circuit, sans allocation
  function lire(c, tab, s) {
    const f = ramener(s, c.longueur) / c.pas, fi = Math.floor(f), i = fi % c.n, j = (i + 1) % c.n;
    return tab[i] + (tab[j] - tab[i]) * (f - fi);
  }
  function sLigne(c, s) { return ramener(s - (c.depart || 0), c.longueur); }
  const AIDE_IA = 0.35;
  const NEUTRE = Object.freeze({ gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 });

  function creer(c, o = {}) {
    const chrono = o.mode === 'chrono';
    const L = c.longueur;
    const difficulte = clamp(Math.round(o.difficulte ?? 1), 0, 2);
    const nbRivaux = chrono ? 0 : clamp(Math.round(o.rivaux ?? 11), 0, PILOTES.length);
    const nb = nbRivaux + 1;
    const graine = (o.graine ?? 1) >>> 0;
    const placeJoueur = clamp(Math.round(o.placeJoueur ?? Math.min(8, nb)), 1, nb);
    const rng = mulberry32(graine + 0x2545F491);
    const habBase = [0.90, 0.955, 0.99][difficulte];

    const voiture = (id, nom, numero, liv, joueur) => ({
      id, nom, numero, joueur, couleur: liv[0],
      livree: { couleur: liv[0], seconde: liv[1], casque: liv[2], combinaison: liv[1], numero },
      etat: null, tourValide: true, repositionnements: 0, tours: 0, passages: -1, maxPassages: -1, progression: 0, debutTour: 0,
      tempsTours: [], meilleur: null, position: 0, fini: false, abandon: false, tempsFinal: null, ecart: 0, ecartTete: 0,
      ia: {
        hab: joueur ? 1 : habBase + (rng() * 2 - 1) * 0.015, decal: joueur ? 0 : (rng() * 2 - 1) * 0.5,
        reaction: joueur ? 0 : 0.12 + rng() * 0.28, cible: -1, cote: 0, decalVise: 0, decalDep: 0
      }
    });
    const voitures = [voiture(0, 'Vous', 1, LIVREE_JOUEUR, true)];
    for (let r = 0; r < nbRivaux; r++) voitures.push(voiture(r + 1, PILOTES[r][0], PILOTES[r][1], LIVREES[r], false));

    // grille : ordre des rivaux tiré de la graine, le joueur à sa place
    const ordre = voitures.slice(1);
    for (let i = ordre.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ordre[i], ordre[j]] = [ordre[j], ordre[i]]; }
    ordre.splice(placeJoueur - 1, 0, voitures[0]);
    ordre.forEach((v, k) => {
      const s = chrono ? -40 : -10 - 8 * k, d = chrono ? 0 : (k % 2 === 0 ? -2.4 : 2.4);
      v.etat = B.conduite.creer(ramener((c.depart || 0) + s, L), d);
      v.degats = B.degats ? B.degats.creer() : null; v.etat.degats = v.degats;
      v.progression = s; v.position = k + 1;
    });

    let tRef = 0;
    for (let i = 0; i < c.n; i++) tRef += c.pas / c.vitesse[i];
    return {
      c, mode: chrono ? 'chrono' : 'course', toursTotal: chrono ? 0 : Math.max(1, Math.round(o.tours ?? 3)), difficulte,
      phase: chrono ? 'course' : 'grille', horloge: 0, temps: 0, dt: 1 / 120,
      feux: { allumes: 0, vert: chrono }, delaiVert: 0.4 + rng() * 1.0,
      voitures, joueur: voitures[0], classement: ordre.map(v => v.id),
      fantome: { meilleur: null, temps: null }, chronoParti: false,
      enreg: { donnees: new Float32Array(4 * 2048), n: 0, prochain: 0 },
      termine: false, drapeau: null, finisseurs: 0, tempsReference: tRef, vref: L / tRef,
      contactsT: new Float64Array(nb * nb).fill(-1e9), sAvant: new Float64Array(nb)
    };
  }

  // Projection de la caisse orientée sur les axes du circuit ; une épave en travers occupe un vrai couloir.
  function empriseIA(e) {
    const h=e.psi+e.beta, ca=Math.abs(Math.cos(h)),sa=Math.abs(Math.sin(h));
    return {long:2.475*ca+1.01*sa,lat:2.475*sa+1.01*ca};
  }
  function commandesIA(course, v) {
    const c = course.c, e = v.etat, ia = v.ia, P = c.pas, n = c.n, dt = course.dt;
    const moi=empriseIA(e), vit=e.v, demi=c.largeur/2, utile=Math.max(.5,demi-moi.lat-.25);
    // Retour en piste seulement quand la voiture est vraiment dehors (centre au-delà du bord), avec hystérésis :
    // frôler la trajectoire idéale, qui longe le bord, n'est pas une sortie.
    const ad=Math.abs(e.d);
    if (ad>demi+.4) ia.dehors=true; else if (ad<demi-1.2) ia.dehors=false;
    const recuperer=!!ia.dehors;
    if (course.mode === 'course' && course.phase === 'course' && course.temps < ia.reaction) { ia.bloque=0;return NEUTRE; }

    let hab = ia.hab;
    if (v.fini || (v.joueur && course.phase === 'arrivee')) hab *= 0.82; // tour de décélération
    else if (course.mode === 'course' && course.difficulte < 2 && !v.joueur && !course.joueur.fini) {
      const ej = v.progression - course.joueur.progression, f = clamp((Math.abs(ej) - 250) / 500, 0, 1) * 0.02;
      hab += ej < 0 ? f : -f; // léger élastique
    }
    // Pluie : la conduite perd jusqu'à 22 % d'adhérence ; l'allure de virage suit sa racine, le freinage la suit.
    const meteo = B.meteo && B.meteo.actuel, pluie = meteo && Number.isFinite(meteo.pluie) ? clamp(meteo.pluie, 0, 1) : 0;
    const adh = 1 - .22 * pluie;
    hab *= Math.sqrt(adh);

    // Vitesse visée et freinage anticipé (jusqu'à 200 m devant). Le freinage finit une fraction de seconde avant
    // chaque point (avance), et la vitesse visée est la plus basse de ce bout de piste : la voiture arrive à la
    // corde déjà ralentie, au lieu de freiner en braquant, ce qui prend aux pneus l'adhérence du virage.
    const f = ramener(e.s, c.longueur) / P, i0 = Math.floor(f) % n, fr = f - Math.floor(f);
    const dec = 0.8 * (14 + 0.15 * vit) * (recuperer ? .6 : 1) * adh, v2 = vit * vit; // l'herbe freine moins bien
    const anticipe = .5 * vit;
    let cible = lire(c, c.vitesse, e.s) * hab, besoin = 0;
    for (let q = 1, N = Math.ceil(200 / P); q <= N; q++) {
      const vc = c.vitesse[(i0 + q) % n] * hab, dist = (q - fr) * P;
      if (dist <= anticipe) { if (vc < cible) cible = vc; continue; }
      const b = (v2 - vc * vc) / (2 * (dist - anticipe));
      if (b > besoin) besoin = b;
    }

    // Trafic : voiture la plus proche devant dans le couloir ; voisines à côté à ne pas serrer. Le regard
    // s'allonge avec la vitesse (distance d'arrêt + marge) pour qu'un rival lancé voie et évite un obstacle
    // arrêté bien avant de lereach (Chantier 3 : un rival à 80 m/s doit éviter une voiture arrêtée).
    const regard = Math.max(70, v2 / 60 + 30);
    // prochain virage à portée de freinage : son intérieur est le seul côté où l'on dépasse en freinant
    let kAv = 0;
    for (let q = 1, N = Math.ceil(Math.max(60, v2 / 20 + 30) / P); q <= N; q++) {
      const k = c.courbure[(i0 + q) % n];
      if (Math.abs(k) > 3e-3) { kAv = k; break; }
    }
    let devant = null, dsMin = regard, dMin = -utile, dMax = utile;
    for (const o of course.voitures) {
      if (o === v) continue;
      const ds = ecart(c, e.s, o.etat.s), dd = o.etat.d - e.d, taille=empriseIA(o.etat), espace=moi.lat+taille.lat+.35;
      if (ds > 0 && ds < dsMin && Math.abs(dd) < espace) { dsMin = ds; devant = o; }
      if (Math.abs(ds) < moi.long+taille.long+.5 && Math.abs(dd) < espace+.5) { // vraiment côte à côte
        if (dd >= 0) dMax = Math.min(dMax, o.etat.d - espace); else dMin = Math.max(dMin, o.etat.d + espace);
      }
    }
    if (devant) {
      const od=devant.etat, taille=empriseIA(od), espace=moi.lat+taille.lat+.5, gap=dsMin-moi.long-taille.long;
      // un obstacle vraiment plus lent (voiture arrêtée ou en perdition) justifie un engagement plus tôt et plus
      // franc ; la circulation normale (allure voisine) garde la conduite habituelle du peloton.
      const obstacle = od.v < vit - 10;
      if (!recuperer && ia.cible !== devant.id && vit > od.v + 0.3 && gap < (obstacle ? Math.max(70, v2 / 45 + 25) : 30)) {
        const interieur = kAv > 0 ? 1 : kAv < 0 ? -1 : (od.d > e.d ? -1 : 1);
        // côté libre : dans la piste et sans autre voiture sur la trajectoire de dépassement
        const libre = cote => {
          const x=od.d+espace*cote;
          if (Math.abs(x) > utile) return false;
          for (const o of course.voitures) {
            if (o === v || o === devant) continue;
            const ds = ecart(c, e.s, o.etat.s);
            if (ds > -8 && ds < dsMin + 10 && Math.abs(o.etat.d-x)<moi.lat+empriseIA(o.etat).lat+.35) return false;
          }
          return true;
        };
        // l'extérieur d'un virage qui arrive mène tout droit dans l'herbe : réservé à l'évitement d'un obstacle
        const cote = libre(interieur) ? interieur : (!kAv || obstacle) && libre(-interieur) ? -interieur : 0;
        if (cote) { ia.cible = devant.id; ia.cote = cote; }
      }
      // dépassement engagé par l'extérieur quand le virage arrive, sans être encore à la hauteur de l'autre : on
      // renonce et on rentre derrière lui
      if (ia.cible === devant.id && !obstacle && kAv && ia.cote === -Math.sign(kAv) && gap > -moi.long) { ia.cible = -1; ia.cote = 0; }
      // pas d'emboutissage : tant qu'on est dans les roues de celui de devant, on garde une distance de suivi.
      // Mais une fois le dépassement amorcé sur un côté libre, on ne rampe pas (sans vitesse, pas de mouvement
      // latéral) : on garde de quoi dégager la trajectoire, quitte à se rabattre derrière si le côté se referme.
      if (Math.abs(od.d-e.d)<espace) {
        if (obstacle && ia.cible === devant.id && Math.abs(od.d-e.d)>espace-.3) {
          const lim = Math.max(od.v + 12, Math.min(vit, od.v + 6 + gap * 0.6));
          cible = Math.min(cible, Math.max(5,lim));
        } else {
          let lim = od.v + Math.max(0, gap - 3) * 0.9;
          if (ia.cible === devant.id) lim = Math.max(lim, Math.min(5, 1.5 + gap * 0.5));
          cible = Math.min(cible, lim);
        }
      }
    }
    // Dehors, l'adhérence tombe à un peu plus de la moitié. Tant que la voiture s'éloigne encore de la piste, on
    // freine fort pour resserrer le virage ; dès qu'elle revient, allure de virage réduite d'autant, sans piler.
    if (recuperer) {
      ia.cible=-1;ia.cote=0;ia.decalVise=0;
      cible=Math.min(cible,e.psi*Math.sign(e.d)>.03?Math.max(10,vit*.65):lire(c, c.vitesse, e.s)*hab*.74);
    }
    const base = lire(c, c.ligne, e.s) + ia.decal;
    if (ia.cible >= 0 && dMin > dMax) { ia.cible = -1; ia.cote = 0; } // coincée : on renonce
    if (ia.cible >= 0) {
      const o = course.voitures[ia.cible], avance = ecart(c, o.etat.s, e.s);
      if (avance > 3+moi.long+empriseIA(o.etat).long || avance < -(regard + 10)) { ia.cible = -1; ia.cote = 0; }
      else ia.decalVise = o.etat.d+(moi.lat+empriseIA(o.etat).lat+.5)*ia.cote-base;
    }
    const vise = ia.cible >= 0 ? ia.decalVise : 0, vLat = (ia.cible >= 0 ? (devant && vit > devant.etat.v + 8 ? 6.0 : 3.0) : recuperer ? 4 : .8) * dt;
    ia.decalDep += clamp(vise - ia.decalDep, -vLat, vLat);

    // Direction : poursuite d'un point de la ligne visée. Face à un obstacle beaucoup plus lent, on vise plus
    // court pour braquer plus sec et dégager la trajectoire avant d'arriver dessus ; circulation normale : visée longue.
    // Dehors : retour du côté où l'on est sorti, sans traverser la piste, sous un angle doux (11° au plus), pour
    // ne pas repartir dans l'herbe d'en face. En piste, l'écart au cap de la trajectoire est borné par une vitesse
    // latérale (5 m/s, 9 pour éviter un obstacle) : à 200 km/h, un changement de côté ne jette plus la voiture
    // de travers à l'entrée d'un virage.
    const evite=!recuperer && ia.cible>=0 && devant && vit>devant.etat.v+10;
    const la = recuperer ? 10 + 0.6 * vit : (evite ? 5 : 8) + (evite ? 0.30 : 0.45) * vit;
    const ligneLa = lire(c, c.ligne, e.s + la);
    let dVise = recuperer ? Math.sign(e.d) * (demi - 1.8) : clamp(ligneLa + ia.decal + ia.decalDep, -utile, utile);
    dVise = dMin > dMax ? e.d : clamp(dVise, dMin, dMax);
    const psiL = recuperer ? 0 : Math.atan2(ligneLa - lire(c, c.ligne, e.s), la);
    const ouverture = recuperer ? .19 : Math.asin(Math.min(1, (evite ? 9 : 5) / Math.max(vit, 1)));
    const psiC = clamp(Math.atan2(dVise - e.d, la), psiL - ouverture, psiL + ouverture);
    // même loi que le joueur : le volant demande la part d'adhérence avant qui tient la courbure visée. La courbure
    // de base est celle de la voiture à son décalage (plus serrée à la corde), pas celle de l'axe de la piste.
    const kIci = lire(c, c.courbure, e.s);
    const kVise = kIci / Math.max(1 - kIci * e.d, .3) + 2.2 * (psiC - e.psi) * Math.max(vit, 5) / (10 * Math.max(vit, 3));
    const volant = B.conduite.volantPour(e, kVise);

    // Sous-virage : en virage, la voiture s'écarte de sa ligne vers l'extérieur. Comme un pilote, on lève le pied
    // et on freine un peu : la charge revient sur l'avant et la trajectoire se referme.
    if (!recuperer && Math.abs(kIci) > 4e-3) {
      const large = (lire(c, c.ligne, e.s) + ia.decal + ia.decalDep - e.d) * Math.sign(kIci);
      if (large > 2) cible = Math.min(cible, vit * (1 - .03 * Math.min(large - 2, 3)));
    }

    let gaz = 0, frein = 0;
    if (besoin > 0.7 * dec) frein = clamp((besoin - 0.7 * dec) / (0.3 * dec), 0, 1);
    else if (vit > cible + 2) frein = clamp((vit - cible - 2) / 4, 0, 1);
    else gaz = vit < cible - 1 ? 1 : clamp((cible - vit + 1) / 2, 0, 1);
    // Même retour progressif que le joueur, après un long blocage non fatal. Une attente de trafic voulue,
    // un arrêt au stand, un vol ou une casse n'est jamais une invitation à replacer la voiture.
    const roule=course.phase==='course'||course.phase==='arrivee';
    // La direction d'une vitesse quasi nulle peut osciller au contact : garder l'épisode tant que la caisse
    // reste immobile, au lieu de remettre le compteur à zéro un pas sur deux.
    const gardeRetour=roule && !v.fini && !v.abandon && e.v<.1 && gaz>.1 && frein<.1 &&
      !(e.degats&&e.degats.casse) && !e.recuperation && !e.saut && !e.accident && !e.reparation && !(e.immunite>0);
    ia.retourBloque=gardeRetour && (ia.retourBloque || Math.cos(e.psi)<-.2);
    const intention=gaz>.1 && frein<.1 && (cible>2 || ia.retourBloque);
    const coince=roule && !v.fini && !v.abandon && e.v<1.5 && intention &&
      !(e.degats&&e.degats.casse) && !e.recuperation && !e.saut && !e.accident && !e.reparation && !(e.immunite>0);
    ia.bloque=coince?(ia.bloque||0)+dt:0;
    if(ia.bloque>15) { B.conduite.declencherAccident(e,{});ia.bloque=0;ia.cible=-1;ia.cote=0;ia.decalVise=0;ia.decalDep=0; }
    // l'IA conduit avec l'aide au volant légère, le réglage par défaut du joueur
    return { gaz, frein, volant, derive: false, haut: false, bas: false, boite: 'auto', aide: AIDE_IA };
  }

  // Contacts : rectangles 4,5 × 1,9 m dans le repère (s, d), séparés à chaque pas.
  function contacts(course, ev) {
    const V = course.voitures, c = course.c, n = V.length, L = c.longueur;
    for (let i = 0; i < n; i++) {
      const a = V[i].etat;
      for (let j = i + 1; j < n; j++) {
        const b = V[j].etat;
        const ds = ecart(c, a.s, b.s), ol = LONGUEUR - Math.abs(ds);
        if (ol <= 0) continue;
        const dd = b.d - a.d, olat = LARGEUR_VOITURE - Math.abs(dd);
        if (olat <= 0) continue;
        let force;
        if (ol < olat) {
          const sg = ds >= 0 ? 1 : -1; // b devant a si sg > 0
          a.s = ramener(a.s - sg * ol / 2, L); b.s = ramener(b.s + sg * ol / 2, L);
          const ar = sg > 0 ? a : b, av = sg > 0 ? b : a, vr = ar.v - av.v;
          if (vr > 0) { ar.v -= 0.30 * vr; av.v += 0.15 * vr; }
          force = Math.max(0, vr);
        } else {
          const sg = dd >= 0 ? 1 : -1; // b à droite de a si sg > 0
          a.d -= sg * olat / 2; b.d += sg * olat / 2;
          const vr = (a.v * Math.sin(a.psi) - b.v * Math.sin(b.psi)) * sg;
          const k = Math.min(0.05, olat * 0.1);
          a.psi -= sg * k; b.psi += sg * k;
          if (vr > 0) { const m = vr * 0.25; a.psi -= sg * m / Math.max(a.v, 5); b.psi += sg * m / Math.max(b.v, 5); }
          for (const e of [a, b]) {
            const cd = e.d < 0 ? -1 : 1, lim = B.conduite.limiteCote(c, e.s, cd) - 0.1;
            if (Math.abs(e.d) > lim) e.d = cd * lim;
          }
          force = Math.max(0, vr);
        }
        const k = i * n + j;
        if (course.horloge - course.contactsT[k] >= 0.3) {
          course.contactsT[k] = course.horloge;
          ev.push({ type: 'contact', a: V[i].id, b: V[j].id, force });
        }
        for (const v of [V[i], V[j]]) if (v.joueur) { const x = B.conduite.annulerDerive(v.etat); if (x) { x.id = v.id; ev.push(x); } }
      }
    }
  }

  function passageLigne(course, v, tPassage, ev) {
    if (v.abandon) return;
    if (course.mode === 'chrono') {
      if (!course.chronoParti) { course.chronoParti = true; v.debutTour = tPassage; v.tourValide = true; course.enreg.n = 0; course.enreg.prochain = 0; return; }
    } else if (v.passages === 0 || v.fini) return; // départ compté depuis le vert ; rien après l'arrivée
    const temps = tPassage - v.debutTour, valide = v.tourValide !== false, meilleur = valide && (v.meilleur === null || temps < v.meilleur);
    v.debutTour = tPassage; v.tours++; v.tempsTours.push(temps);
    if (meilleur) v.meilleur = temps;
    ev.push({ type: 'tour', id: v.id, tour: v.tours, temps, meilleur, valide });
    v.tourValide = true;
    if (course.mode === 'chrono') {
      // le fantôme est le meilleur tour connu : celui de la séance, ou celui chargé s'il reste meilleur
      if (valide && (course.fantome.temps === null || temps < course.fantome.temps)) course.fantome = { meilleur: { donnees: course.enreg.donnees.slice(0, course.enreg.n * 4), n: course.enreg.n }, temps };
      course.enreg.n = 0; course.enreg.prochain = 0;
    } else if (!v.fini && (v.tours >= course.toursTotal || course.drapeau !== null)) {
      v.fini = true; v.tempsFinal = tPassage; course.finisseurs++;
      if (course.drapeau === null) course.drapeau = tPassage;
      ev.push({ type: 'arrivee', id: v.id, position: course.finisseurs });
      if (v.joueur) course.phase = 'arrivee';
    }
  }

  function enregistrer(course, v, t) {
    const E = course.enreg, tl = t - v.debutTour;
    if (tl < E.prochain) return;
    if ((E.n + 1) * 4 > E.donnees.length) { const d = new Float32Array(E.donnees.length * 2); d.set(E.donnees); E.donnees = d; }
    const e = v.etat, k = E.n * 4;
    E.donnees[k] = tl; E.donnees[k + 1] = e.s; E.donnees[k + 2] = e.d; E.donnees[k + 3] = e.psi + e.beta;
    E.n++; E.prochain += 0.05;
  }

  function score(v, L) { return v.fini ? v.tours : v.progression / L; }
  function majClassement(course) {
    const L = course.c.longueur;
    const tri = course.voitures.slice().sort((a, b) => {
      if (a.abandon !== b.abandon) return a.abandon ? 1 : -1;
      const d = score(b, L) - score(a, L);
      if (d !== 0) return d;
      if (a.fini !== b.fini) return a.fini ? -1 : 1;
      return a.fini ? a.tempsFinal - b.tempsFinal : a.id - b.id;
    });
    const tete = tri[0];
    const prog = v => v.fini ? v.tours * L : v.progression;
    tri.forEach((v, i) => {
      v.position = i + 1;
      if (i === 0) { v.ecart = 0; v.ecartTete = 0; return; }
      const p = tri[i - 1];
      v.ecart = p.fini && v.fini && p.tours === v.tours ? v.tempsFinal - p.tempsFinal : (prog(p) - prog(v)) / course.vref;
      v.ecartTete = tete.fini && v.fini && tete.tours === v.tours ? v.tempsFinal - tete.tempsFinal : (prog(tete) - prog(v)) / course.vref;
    });
    course.classement = tri.map(v => v.id);
  }

  // Aspiration : dans le sillage d'une voiture à moins de 30 m devant et à moins de 2 m de côté, la traînée baisse
  // (part de 0 à 1, lue par la conduite) ; elle croît quand on se rapproche et quand on s'aligne.
  const ASPIRATION = { portee: 30, cote: 2 };
  function aspirer(c, V) {
    for (const a of V) {
      let part = 0;
      for (const b of V) {
        if (b === a) continue;
        const ds = ecart(c, b.etat.s, a.etat.s), dd = Math.abs(b.etat.d - a.etat.d);
        if (ds > LONGUEUR && ds < ASPIRATION.portee && dd < ASPIRATION.cote)
          part = Math.max(part, (1 - ds / ASPIRATION.portee) * (1 - dd / ASPIRATION.cote));
      }
      a.etat.aspiration = part;
    }
  }

  function pas(course, cmdJoueur, dt) {
    const ev = [];
    if (course.termine) return ev;
    const c = course.c, L = c.longueur, V = course.voitures;
    course.dt = dt; course.horloge += dt;
    // le pas du vert retient encore les voitures : elles partent au pas suivant, à temps = 0
    const retenue = course.phase === 'grille' || course.phase === 'feux';
    if (course.phase === 'grille' && course.horloge >= 1.5) course.phase = 'feux';
    if (course.phase === 'feux') {
      const t = course.horloge - 1.5, allumes = Math.min(5, Math.floor(t / 0.8 + 1e-9));
      while (course.feux.allumes < allumes) { course.feux.allumes++; ev.push({ type: 'feu', allumes: course.feux.allumes }); }
      if (t >= 4.0 + course.delaiVert) {
        course.feux.vert = true; course.feux.allumes = 0; course.phase = 'course'; course.temps = 0;
        ev.push({ type: 'vert' });
      }
    }
    const t0 = course.temps;
    aspirer(c, V);

    if (B.contacts && B.contacts.avant) B.contacts.avant(course);
    if (B.obstacles) B.obstacles.avant(course);
    for (let i = 0; i < V.length; i++) {
      const v = V[i];
      course.sAvant[i] = sLigne(c, v.etat.s);
      let cmd;
      if (!v.joueur || v.fini) cmd = commandesIA(course, v);
      else cmd = cmdJoueur || NEUTRE;
      for (const e of B.conduite.pas(v.etat, cmd, c, dt, retenue)) { e.id = v.id; ev.push(e); }
    }
    if (B.contacts) B.contacts.pas(course, ev); else contacts(course, ev);
    if (B.obstacles) B.obstacles.pas(course, ev);
    if (!retenue) course.temps = t0 + dt;

    // Franchissements de ligne (interpolés dans le pas) et progression continue
    for (let i = 0; i < V.length; i++) {
      const v = V[i], a = course.sAvant[i], b = sLigne(c, v.etat.s);
      if(v.etat.recuperation || (v.degats&&(v.degats.casse||B.degats?.uneRouePerdue(v.degats))))v.tourValide=false;
      const replacements=v.etat.repositionnements||0;
      if(replacements!==v.repositionnements){v.tourValide=false;v.repositionnements=replacements;course.sAvant[i]=b;v.progression=v.passages*L+b;continue;}
      // Un franchissement réellement parcouru peut finir le tour, marqué non valide après accident.
      if (a > 0.75 * L && b < 0.25 * L) {
        v.passages++;
        if (v.passages > v.maxPassages) {
          v.maxPassages = v.passages;
          passageLigne(course, v, t0 + dt * (L - a) / (L - a + b), ev);
        }
      } else if (a < 0.25 * L && b > 0.75 * L) v.passages--;
      v.progression = v.passages * L + b;
      if (course.mode === 'chrono' && course.chronoParti && v.joueur && v.tourValide !== false) enregistrer(course, v, course.temps);
    }
    majClassement(course);
    if (V.every(v => v.fini || v.abandon)) {
      if (course.finSansCourse === undefined) course.finSansCourse = course.horloge;
      if (course.horloge - course.finSansCourse >= 3) course.termine = true;
    }

    // Fin : 8 s après l'arrivée du joueur, ou quand le délai après le drapeau est écoulé
    const j = course.joueur;
    if (course.mode === 'course' && course.drapeau !== null) {
      const delai = Math.max(40, 1.25 * course.drapeau / course.toursTotal);
      if ((j.fini && course.temps - j.tempsFinal >= 8) || course.temps - course.drapeau >= delai ||
          V.every(v => v.fini || v.abandon)) course.termine = true;
    }
    return ev;
  }

  // Retour manuel : même abscisse, aucun passage ajouté, tour courant non homologué.
  function replacer(course,v=course.joueur) {
    const ev=B.conduite.replacer(v.etat,course.c);v.tourValide=false;v.repositionnements=v.etat.repositionnements;
    const i=course.voitures.indexOf(v);if(i>=0)course.sAvant[i]=sLigne(course.c,v.etat.s);
    v.progression=v.passages*course.c.longueur+sLigne(course.c,v.etat.s);
    for(const x of ev)x.id=v.id;return ev;
  }

  // Fantôme du meilleur tour (chrono) au temps du tour en cours : { s, d, angle } ou null.
  function fantome(course) {
    const f = course.fantome.meilleur;
    if (!f || !course.chronoParti || f.n < 1) return null;
    const c = course.c, D = f.donnees, m = f.n, t = course.temps - course.joueur.debutTour;
    if (t < 0 || t > course.fantome.temps) return null;
    if (m === 1) return { s: D[1], d: D[2], angle: D[3] };
    let i = clamp(Math.floor(t / 0.05), 0, m - 2);
    while (i > 0 && D[4 * i] > t) i--;
    while (i < m - 2 && D[4 * (i + 1)] <= t) i++;
    const ta = D[4 * i], tb = D[4 * i + 4], u = tb > ta ? clamp((t - ta) / (tb - ta), 0, 1) : 0;
    const sa = D[4 * i + 1], sb = D[4 * i + 5];
    return {
      s: ramener(sa + ecart(c, sa, sb) * u, c.longueur),
      d: D[4 * i + 2] + (D[4 * i + 6] - D[4 * i + 2]) * u,
      angle: D[4 * i + 3] + (D[4 * i + 7] - D[4 * i + 3]) * u
    };
  }

  function etatPilotes(course) {
    return course.classement.map(id => {
      const v = course.voitures[id];
      return {
        id: v.id, nom: v.nom, numero: v.numero, couleur: v.couleur, position: v.position, tours: v.tours,
        meilleur: v.meilleur, dernier: v.tempsTours.length ? v.tempsTours[v.tempsTours.length - 1] : null,
        ecart: v.ecart, ecartTete: v.ecartTete, fini: v.fini, joueur: v.joueur
      };
    });
  }

  B.course = { creer, pas, replacer, fantome, etatPilotes, commandesIA, aspirer, PILOTES, LIVREES, ASPIRATION };
})(globalThis.BITUME = globalThis.BITUME || {});
