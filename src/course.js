if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.strategieStands) require('./strategie-stands.js');
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
  const LIVREE_INVITE = [C(.93, .93, .95), C(.12, .28, .78), C(.86, .10, .08)];   // à deux : la seconde voiture humaine
  // humains 3 et 4 (en ligne, quatre pilotes au plus) : jaune et noir, vert et blanc ; numéros libres chez les rivaux
  const LIVREES_HUMAINS = [LIVREE_JOUEUR, LIVREE_INVITE, [C(.95, .78, .08), C(.08, .08, .09), C(.08, .08, .09)], [C(.10, .52, .30), C(.95, .93, .88), C(.95, .93, .88)]];
  const NUMEROS_HUMAINS = [1, 2, 4, 6];
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
  function ramener(s, L, c) {
    if (c && c.ouvert) return s < 0 ? 0 : s > L ? L : s;
    return ((s % L) + L) % L;
  }
  function ecart(c, s1, s2) { return B.circuit.ecart(c, s1, s2); }
  // lecture interpolée d'un tableau du circuit, sans allocation
  function lire(c, tab, s) {
    if (c.ouvert) {
      const sc = s < 0 ? 0 : s > c.longueur ? c.longueur : s;
      const f = sc / c.pas, fi = Math.floor(f), i = Math.min(fi, c.n - 1), j = Math.min(i + 1, c.n - 1), t = i === j ? 0 : f - fi;
      return tab[i] + (tab[j] - tab[i]) * t;
    }
    const f = ramener(s, c.longueur) / c.pas, fi = Math.floor(f), i = fi % c.n, j = (i + 1) % c.n;
    return tab[i] + (tab[j] - tab[i]) * (f - fi);
  }
  function sLigne(c, s) {
    if (c.ouvert) return s - (c.depart || 0);
    return ramener(s - (c.depart || 0), c.longueur);
  }
  const AIDE_IA = 0.35;
  const NEUTRE = Object.freeze({ gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 });
  const CHAUSSEE_IA = {}, CHAUSSEE_ANTICIPEE = {}, CHAUSSEE_CHAUFFE = {};

  function creer(c, o = {}) {
    const chrono = o.mode === 'chrono';
    const L = c.longueur;
    const difficulte = clamp(Math.round(o.difficulte ?? 1), 0, 2);
    // Jeu en ligne (reseau.js) : deux voitures humaines, 0 pour l'hôte et 1 pour l'invité sur les deux machines ;
    // celles que l'on ne conduit pas sont « distantes » (état reçu du réseau) : l'autre pilote, et chez l'invité les
    // rivaux, que l'hôte fait courir. Les rivaux suivent, de 2 à 11.
    // Humains (jeu.js) : { noms (deux à quatre), locaux (voitures conduites sur cette machine), hote, enLigne }. Les
    // humains ont les numéros 0 à 3 ; celles que l'on ne conduit pas sont « distantes » en ligne (état reçu du réseau),
    // comme les rivaux hors de chez l'hôte, qui les fait courir. Les rivaux suivent.
    let humains = !chrono && o.humains ? o.humains : null;
    if (humains && !humains.locaux) humains = humains.duo ? { noms: humains.noms, locaux: [0, 1], hote: true, enLigne: false }
      : { noms: humains.noms, locaux: [humains.local], hote: humains.local === 0, enLigne: true };
    const nH = humains ? clamp(humains.noms.length, 1, 4) : 0;
    const nbRivaux = chrono ? 0 : clamp(Math.round(o.rivaux ?? 11) - Math.max(0, nH - 1), 0, PILOTES.length);
    const nb = nbRivaux + 1;
    const graine = (o.graine ?? 1) >>> 0;
    const placeJoueur = clamp(Math.round(o.placeJoueur ?? Math.min(8, nb)), 1, nb);
    const rng = mulberry32(graine + 0x2545F491);
    const habBase = [0.90, 0.955, 0.99][difficulte];

    // les voitures humaines tirent toujours leurs trois nombres, conduites ici ou ailleurs : en ligne, la grille (tirée
    // ensuite au même générateur) est la même sur toutes les machines
    const voiture = (id, nom, numero, liv, joueur) => {
      const tire = !joueur || (!!humains && id < nH), t1 = tire ? rng() : 0, t2 = tire ? rng() : 0, t3 = tire ? rng() : 0;
      return {
      id, nom, numero, joueur, couleur: liv[0],
      livree: { couleur: liv[0], seconde: liv[1], casque: liv[2], combinaison: liv[1], numero },
      etat: null, tourValide: true, repositionnements: 0, tours: 0, passages: -1, maxPassages: -1, progression: 0, debutTour: 0,
      tempsTours: [], meilleur: null, position: 0, fini: false, abandon: false, tempsFinal: null, ecart: 0, ecartTete: 0,
      ia: {
        hab: joueur ? 1 : habBase + (t1 * 2 - 1) * 0.015, decal: joueur ? 0 : (t2 * 2 - 1) * 0.5,
        reaction: joueur ? 0 : 0.12 + t3 * 0.28, cible: -1, cote: 0, decalVise: 0, decalDep: 0,
        stand: B.strategieStands ? B.strategieStands.creer() : null
      }
      };
    };
    // écran partagé : deux voitures humaines conduites sur cette machine (course à deux, ou en ligne)
    const duo = !!humains && humains.locaux.length === 2;
    const statsIa = { attaques: 0, abandons: 0, presses: 0, contacts: 0, decisions: 0, tempsDecision: 0 };
    const voitures = humains
      ? humains.noms.slice(0, nH).map((nom, k) => voiture(k, nom, NUMEROS_HUMAINS[k], LIVREES_HUMAINS[k], humains.locaux.includes(k)))
      : [voiture(0, 'Vous', 1, LIVREE_JOUEUR, true)];
    const premierRival = voitures.length;
    for (let r = 0; r < nbRivaux; r++) voitures.push(voiture(r + premierRival, PILOTES[r][0], PILOTES[r][1], LIVREES[r], false));
    if (humains) for (const v of voitures) { v.humain = v.id < nH; v.distant = !!humains.enLigne && !humains.locaux.includes(v.id) && (v.humain || !humains.hote); }
    // Caractère de chaque rival (David, 16/11 : « rends les IA plus intelligentes ») : combativité au dépassement,
    // goût de la défense, régularité d'un tour à l'autre ; tiré à part, sans changer la grille.
    for (const v of voitures) {
      const h = mulberry32((graine ^ Math.imul(v.id + 1, 0x9E3779B1)) >>> 0);
      Object.assign(v.ia, { agressivite: v.joueur ? .5 : .25 + .75 * h(), defense: v.joueur ? 0 : h(), regularite: v.joueur ? 1 : .55 + .45 * h(), forme: 1, sillage: -1, defend: 0, defendu: -1,
        t: 0, derniereAttaque: -99, attaques: 0, abandons: 0, presses: 0, presse: -1, tenu: -99, changements: 0,
        // Champs posés en cours de course, déclarés ici dans un ordre fixe : toutes les voitures gardent la même
        // forme d'objet et le pas de l'IA reste compilé pour une seule (sinon chaque voiture les ajoute dans son
        // propre ordre, et le moteur JavaScript recompile commandesIA sans fin). undefined se lit exactement comme
        // un champ absent pour chaque lecteur (!!, ??, == null, ||) : aucune décision ne change.
        dehors: undefined, entamee: undefined, retourBloque: undefined, bloque: undefined, attaque: undefined,
        degagement: 0, degagementT: 0, degagementDistance: 0, degagementS: 0, degagementD: 0, degagementAttente: 0,
        degagementEssais: 0, degagementOrigineS: 0, degagementOrigineD: 0 });
    }

    if (!c.vitesse && B.circuit && B.circuit.preparerParcours) B.circuit.preparerParcours(c);
    // grille : ordre des rivaux tiré de la graine, le joueur à sa place
    const ordre = voitures.slice(premierRival);
    for (let i = ordre.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ordre[i], ordre[j]] = [ordre[j], ordre[i]]; }
    ordre.splice(Math.min(placeJoueur - 1, ordre.length), 0, ...voitures.slice(0, premierRival));
    const depart = c.depart || 0;
    ordre.forEach((v, k) => {
      const d = chrono ? 0 : (k % 2 === 0 ? -2.4 : 2.4);
      let sAbs, prog;
      if (c.ouvert) {
        const baseS = depart >= 120 ? depart - 10 : depart + 10 + 8 * (ordre.length - 1);
        sAbs = chrono ? Math.max(0, Math.min(depart + 10, (c.arrivee || L) - 1)) : Math.max(0, Math.min(baseS - 8 * k, (c.arrivee || L) - 1));
        prog = sAbs - depart;
      } else {
        const s = chrono ? -40 : -10 - 8 * k;
        sAbs = ramener(depart + s, L);
        prog = s;
      }
      v.etat = B.conduite.creer(sAbs, d);
      Object.assign(v.etat, B.pneus.creerEtat('slicks', { seance: graine, voiture: v.id }));
      v.degats = B.degats ? B.degats.creer() : null; v.etat.degats = v.degats;
      v.progression = prog; v.position = k + 1;
    });

    let tRef = 0;
    for (let i = 0; i < c.n; i++) tRef += c.pas / c.vitesse[i];
    const toursTotal = c.ouvert ? 1 : (chrono ? 0 : Math.max(1, Math.round(o.tours ?? 3)));
    return {
      c, graine, mode: chrono ? 'chrono' : 'course', toursTotal, difficulte,
      phase: chrono ? 'course' : 'grille', horloge: 0, temps: 0, dt: 1 / 120,
      feux: { allumes: 0, vert: chrono }, delaiVert: 0.4 + rng() * 1.0,
      voitures, joueur: voitures[humains ? humains.locaux[0] : 0], classement: ordre.map(v => v.id), enLigne: !!humains && !!humains.enLigne, duo,
      fantome: { meilleur: null, temps: null }, chronoParti: false,
      enreg: { donnees: new Float32Array(4 * 2048), n: 0, prochain: 0 },
      termine: false, drapeau: null, finisseurs: 0, tempsReference: tRef, vref: L / tRef,
      contactsT: new Float64Array(nb * nb).fill(-1e9), sAvant: new Float64Array(nb), statsIa
    };
  }

  // Lot 3 — attaque. Délai entre deux engagements d'une même voiture (s de simulation locale, jamais le temps
  // d'affichage), portée au-delà de laquelle une cible n'est plus tenue pour atteignable, et seuil de vitesse
  // relative minimale pour s'engager. Aucun hasard ici : les décisions restent déterministes, donc identiques sur
  // chaque machine en ligne.
  const IA_ATTENTE = 2.5, IA_PORT = 34, IA_ECART_VITESSE = 1 / 60;
  // Une voiture en cours de récupération, de replacement ou de service n'est jamais une cible d'attaque : on la
  // contourne, on ne la serre pas. (Le lot 2 a défini ces états ; le lot 4 ajoutera la réparation aux stands.)
  // Voiture hors service : ni cible d'attaque, ni obstacle qu'on bride. L'arrêt au stand en fait partie (lot 4).
  const horsService = e => !!(e && (e.recuperation || e.reparation || e.stands || e.accident || (e.degats && e.degats.casse)));
  // Manœuvre abandonnée : on rentre derrière la voiture visée. Comptée, car une IA qui renonce sans arrêt oscille.
  function renoncer(ia, course) {
    if (ia.cible >= 0) { ia.abandons++; ia.changements++; if (course && course.statsIa) course.statsIa.abandons++; }
    ia.cible = -1; ia.cote = 0; ia.entamee = null;
  }
  // Projection de la caisse orientée sur les axes du circuit ; une épave en travers occupe un vrai couloir.
  function empriseIA(e) {
    const h=e.psi+e.beta, ca=Math.abs(Math.cos(h)),sa=Math.abs(Math.sin(h));
    return {long:2.475*ca+1.01*sa,lat:2.475*sa+1.01*ca};
  }
  // Les mêmes emprises pour les voitures de la course, rangées par indice et retenues pour leur cap relatif
  // h = psi + beta : l'IA de chaque voiture relit celles de toutes les autres, plusieurs fois par pas. Même calcul
  // qu'empriseIA, refait dès que h change (une voiture déjà avancée dans ce pas a un autre h) : mêmes bits.
  function emprises(course) {
    const n = course.voitures.length;
    let E = course._emprises;
    if (!E || E.h.length < n) E = course._emprises = { h: new Float64Array(n).fill(NaN), long: new Float64Array(n), lat: new Float64Array(n) };
    return E;
  }
  function emprise(E, i, e) {
    const h = e.psi + e.beta;
    if (E.h[i] !== h) {
      const ca = Math.abs(Math.cos(h)), sa = Math.abs(Math.sin(h));
      E.long[i] = 2.475 * ca + 1.01 * sa; E.lat[i] = 2.475 * sa + 1.01 * ca; E.h[i] = h;
    }
  }
  function largeurDe(E, i, e) { emprise(E, i, e); return E.lat[i]; }
  function longueurDe(E, i, e) { emprise(E, i, e); return E.long[i]; }
  // Côté libre d'un dépassement (x : décalage visé) : dans la piste et sans autre voiture sur la trajectoire.
  function coteLibre(course, E, v, devant, x, utile, s, dsMin, moiLat) {
    if (Math.abs(x) > utile) return false;
    const V = course.voitures, c = course.c;
    for (let i = 0; i < V.length; i++) {
      const o = V[i];
      if (o === v || o === devant) continue;
      const ds = ecart(c, s, o.etat.s);
      if (ds > -8 && ds < dsMin + 10 && Math.abs(o.etat.d - x) < moiLat + largeurDe(E, i, o.etat) + .35) return false;
    }
    return true;
  }

  // `sortie`, facultatif : objet de commandes de l'appelant, rempli et rendu au lieu d'un neuf (la course en garde
  // un par voiture pour ses rivaux). Sans lui, chaque appel rend un objet neuf, comme toujours.
  function commandesIA(course, v, sortie) {
    const c = course.c, e = v.etat, ia = v.ia, P = c.pas, n = c.n, dt = course.dt, V = course.voitures, E = emprises(course);
    // emprise de la voiture elle-même : le calcul d'empriseIA, sans objet
    const h0 = e.psi + e.beta, ca0 = Math.abs(Math.cos(h0)), sa0 = Math.abs(Math.sin(h0));
    const moiLong = 2.475 * ca0 + 1.01 * sa0, moiLat = 2.475 * sa0 + 1.01 * ca0;
    const vit = e.v, demi = c.largeur / 2, utile = Math.max(.5, demi - moiLat - .25);
    ia.t = (ia.t || 0) + dt;   // horloge locale de la voiture
    // Les rivaux engagés aux stands conduisent réellement leur approche, attente et sortie.
    const arretIA = B.strategieStands && B.strategieStands.commandes(course, v, sortie);
    if (arretIA) return arretIA;
    // Retour en piste seulement quand la voiture est vraiment dehors, avec hystérésis.
    const ad = Math.abs(e.d);
    if (ad > demi + .4) ia.dehors = true; else if (ad < demi - 1.2) ia.dehors = false;
    const recuperer = !!ia.dehors;
    if (course.mode === 'course' && course.phase === 'course' && course.temps < ia.reaction) { ia.bloque = 0; return NEUTRE; }

    let hab = ia.hab * (ia.forme || 1);
    if (v.fini || (v.joueur && course.phase === 'arrivee')) hab *= 0.82;
    else if (course.mode === 'course' && course.difficulte < 2 && !v.joueur && !course.joueur.fini) {
      const ej = v.progression - course.joueur.progression, f = clamp((Math.abs(ej) - 250) / 500, 0, 1) * 0.02;
      hab += ej < 0 ? f : -f;
    }
    const chaussee = B.chaussee.lire(c, e.s, undefined, CHAUSSEE_IA);
    const adh = B.conduite.adherenceVoiture(e, chaussee);
    const habSansSurface = hab;
    hab *= Math.sqrt(adh);

    // Vitesse visée et freinage anticipé (jusqu'à 200 m devant).
    const f = ramener(e.s, c.longueur) / P, i0 = Math.floor(f) % n, fr = f - Math.floor(f);
    let dec = 0.8 * (14 + 0.15 * vit) * (recuperer ? .6 : 1) * adh;
    const v2 = vit * vit;
    const anticipe = .5 * vit;

    // ── AMÉLIORATION 1 : freinage adapté aux fortes pentes descendantes (cols > 4,5 %) ──
    const penteAv = c.pente ? Math.min(0, lire(c, c.pente, e.s + Math.min(45, anticipe))) : 0;
    if (penteAv < -0.045) dec = Math.max(5, dec + 9.81 * (penteAv + 0.045) * 1.4);

    const vIci = lire(c, c.vitesse, e.s), kIci = lire(c, c.courbure, e.s), lIci = lire(c, c.ligne, e.s);
    let cible = vIci * hab, besoin = 0, eauPrevue = -1, neigePrevue = -1, adhPrevue = adh;
    for (let q = 1, N = Math.ceil(200 / P); q <= N; q++) {
      const index = (i0 + q) % n, dist = (q - fr) * P;
      const surface = B.chaussee.lire(c, index * P, undefined, CHAUSSEE_ANTICIPEE);
      let adhDevant = adh;
      if (surface.eau !== chaussee.eau || surface.neige !== chaussee.neige) {
        if (surface.eau !== eauPrevue || surface.neige !== neigePrevue) {
          adhPrevue = B.conduite.adherenceVoiture(e, surface); eauPrevue = surface.eau; neigePrevue = surface.neige;
        }
        adhDevant = adhPrevue;
      }
      const vc = c.vitesse[index] * habSansSurface * Math.sqrt(adhDevant);
      if (dist <= anticipe) { if (vc < cible) cible = vc; continue; }
      const b = (v2 - vc * vc) / (2 * (dist - anticipe));
      if (b > besoin) besoin = b;
    }

    // Trafic : voiture la plus proche devant dans le couloir.
    const regard = Math.max(70, v2 / 60 + 30);
    let kAv = 0;
    for (let q = 1, N = Math.ceil(Math.max(60, v2 / 20 + 30) / P); q <= N; q++) {
      const k = c.courbure[(i0 + q) % n];
      if (Math.abs(k) > 3e-3) { kAv = k; break; }
    }
    if (ia.cible >= 0 && kAv && ia.cote === Math.sign(kAv)) dec *= 1 + .06 * (ia.agressivite || 0);
    let devant = null, devantI = -1, dsMin = regard, dMin = -utile, dMax = utile;
    for (let i = 0; i < V.length; i++) {
      const o = V[i];
      if (o === v) continue;
      emprise(E, i, o.etat);
      const ds = ecart(c, e.s, o.etat.s), dd = o.etat.d - e.d, espace = moiLat + E.lat[i] + .35;
      if (ds > 0 && ds < dsMin && Math.abs(dd) < espace) { dsMin = ds; devant = o; devantI = i; }
      if (Math.abs(ds) < moiLong + E.long[i] + .5 && Math.abs(dd) < espace + .5) {
        if (dd >= 0) dMax = Math.min(dMax, o.etat.d - espace); else dMin = Math.max(dMin, o.etat.d + espace);
      }
    }
    // Aspiration.
    if (!recuperer && !kAv && ia.cible < 0 && devant) {
      const gap = dsMin - moiLong - longueurDe(E, devantI, devant.etat);
      ia.sillage = gap > 6 && gap < 45 && Math.abs(devant.etat.v - vit) < 6 ? devant.id : -1;
    } else ia.sillage = -1;
    // Défense.
    if (!recuperer && kAv && ia.cible < 0 && (ia.defense || 0) > .45 && course.phase === 'course') {
      const virage = (i0 + Math.round(Math.max(60, v2 / 20 + 30) / P)) / 40 | 0;
      if (ia.defendu !== virage) {
        for (let i = 0; i < V.length; i++) {
          const o = V[i];
          if (o === v || o.fini) continue;
          const ds = ecart(c, o.etat.s, e.s);
          if (ds > 2 && ds < 12 + moiLong && Math.abs(o.etat.d - e.d) < 4) { ia.defend = Math.sign(kAv); ia.defendu = virage; break; }
        }
      }
    }
    if (!kAv && ia.defend && Math.abs(kIci) < 3e-3) ia.defend = 0;
    // Blocage (lot 3).
    const gene = !!devant && devant.etat.v < vit - 10;
    if (!recuperer && !gene && ia.cible < 0 && Math.abs(e.d) <= utile && (ia.agressivite || 0) > .55 && course.phase === 'course') {
      const virage = (i0 + Math.round(Math.max(60, v2 / 20 + 30) / P)) / 40 | 0;
      if (virage !== ia.tenu) {
        for (let i = 0; i < V.length; i++) {
          const o = V[i];
          if (o === v || o.fini || o.abandon || horsService(o.etat)) continue;
          const ds = ecart(c, e.s, o.etat.s);
          if (ds > 1 && ds < 8 + moiLong && Math.abs(o.etat.d - e.d) < moiLat + largeurDe(E, i, o.etat) + .6) {
            if (ia.presse !== o.id) { ia.presse = o.id; ia.presses++; if (course.statsIa) course.statsIa.presses++; }
            ia.tenu = virage; break;
          }
        }
      }
    }
    if (ia.presse >= 0) {
      const o = course.voitures[ia.presse];
      if (!o || horsService(o.etat) || gene || ecart(c, e.s, o.etat.s) > 12 + moiLong || Math.abs(kIci) < 3e-3) ia.presse = -1;
    }
    if (devant) {
      emprise(E, devantI, devant.etat);
      const od = devant.etat, espace = moiLat + E.lat[devantI] + .5, gap = dsMin - moiLong - E.long[devantI];
      // ── AMÉLIORATION 2 : évitement précoce des voitures lentes/arrêtées ──
      const obstacle = od.v < vit - 10 || (od.v < 6 && vit > od.v + 3.5);
      const aspire = ia.sillage === devant.id && gap < 12;
      if (ia.cible < 0 && vit > od.v + 0.3 && gap < IA_PORT) { if (ia.entamee == null) ia.entamee = ia.t; }
      else if (ia.cible < 0) ia.entamee = null;
      const horsJeu = horsService(od), contourne = horsJeu || obstacle;
      const atteignable = (contourne || gap <= IA_PORT) && vit - od.v > Math.max(0.3, gap * IA_ECART_VITESSE);
      if (!recuperer && ia.cible !== devant.id && (contourne || vit > od.v + 0.3 || aspire) && atteignable &&
          gap < (obstacle ? Math.max(70, v2 / 45 + 25) : 30) && (contourne || ia.t - (ia.derniereAttaque ?? -99) >= IA_ATTENTE)) {
        const interieur = kAv > 0 ? 1 : kAv < 0 ? -1 : (od.d > e.d ? -1 : 1);
        const douce = Math.abs(kAv) < 0.005 && (vit - od.v) > 3.5;
        let cote = 0;
        if (coteLibre(course, E, v, devant, od.d + espace * interieur, utile, e.s, dsMin, moiLat)) {
          cote = interieur;
        } else if ((!kAv || obstacle || douce) && coteLibre(course, E, v, devant, od.d + espace * -interieur, utile, e.s, dsMin, moiLat)) {
          cote = -interieur;
        }
        if (cote) {
          ia.attaque = !horsJeu;
          ia.cible = devant.id; ia.cote = cote;
          if (ia.attaque) {
            ia.derniereAttaque = ia.t; ia.attaques++;
            if (course.statsIa) { course.statsIa.attaques++; course.statsIa.decisions++; course.statsIa.tempsDecision += ia.t - (ia.entamee ?? ia.t); }
          }
          ia.changements++;
        }
      }
      // dépassement engagé par l'extérieur quand le virage arrive : renoncer
      if (ia.cible === devant.id && !obstacle && kAv && ia.cote === -Math.sign(kAv) && gap > -moiLong) renoncer(ia, course);
      // ── AMÉLIORATION 2b : freinage progressif anti-emboutissage quand bloqué derrière sans côté libre ──
      if (Math.abs(od.d - e.d) < espace) {
        if (obstacle && ia.cible === devant.id && Math.abs(od.d - e.d) > espace - .3) {
          const lim = Math.max(od.v + 12, Math.min(vit, od.v + 6 + gap * 0.6));
          cible = Math.min(cible, Math.max(5, lim));
        } else {
          let lim = od.v + Math.max(0, gap - 3) * 0.9;
          if (ia.cible === devant.id) lim = Math.max(lim, Math.min(5, 1.5 + gap * 0.5));
          // freinage anti-emboutissage progressif si on arrive nettement plus vite et proche
          if (vit > od.v + 4 && gap < 22 && ia.cible !== devant.id) {
            const besoinTrafic = (v2 - od.v * od.v) / (2 * Math.max(2, gap - 2.5));
            if (besoinTrafic > besoin) besoin = besoinTrafic;
          }
          cible = Math.min(cible, lim);
        }
      }
    }
    // Dehors.
    if (recuperer) {
      ia.cible = -1; ia.cote = 0; ia.decalVise = 0;
      cible = Math.min(cible, e.psi * Math.sign(e.d) > .03 ? Math.max(10, vit * .65) : vIci * hab * .74);
    }
    const base = lIci + ia.decal;
    if (ia.cible >= 0 && dMin > dMax) renoncer(ia, course);
    if (ia.cible >= 0 && horsService(course.voitures[ia.cible] && course.voitures[ia.cible].etat)) renoncer(ia, course);
    if (ia.cible >= 0) {
      const o = course.voitures[ia.cible], avance = ecart(c, o.etat.s, e.s);
      if (avance > 3 + moiLong + longueurDe(E, ia.cible, o.etat) || avance < -(regard + 10)) renoncer(ia, course);
      else ia.decalVise = o.etat.d + (moiLat + largeurDe(E, ia.cible, o.etat) + .5) * ia.cote - base;
    }
    let vise = ia.cible >= 0 ? ia.decalVise : 0, vLat = (ia.cible >= 0 ? (devant && vit > devant.etat.v + 8 ? 6.0 : 3.0) : recuperer ? 4 : .8) * dt;
    if (ia.cible < 0 && !recuperer) {
      if (ia.presse >= 0) { vise = e.d - base; vLat = 1.2 * dt; }
      else if (ia.sillage >= 0) { vise = clamp(course.voitures[ia.sillage].etat.d - base, -utile - base, utile - base); vLat = 1.6 * dt; }
      else if (ia.defend) { vise = ia.defend * (utile - .6) - base; vLat = 2.2 * dt; cible *= .985; }
    }
    ia.decalDep += clamp(vise - ia.decalDep, -vLat, vLat);

    // Direction.
    const evite = !recuperer && ia.cible >= 0 && devant && vit > devant.etat.v + 10;
    const la = recuperer ? 10 + 0.6 * vit : (evite ? 5 : 8) + (evite ? 0.30 : 0.45) * vit;
    const ligneLa = lire(c, c.ligne, e.s + la);
    let dVise = recuperer ? Math.sign(e.d) * (demi - 1.8) : clamp(ligneLa + ia.decal + ia.decalDep, -utile, utile);
    dVise = dMin > dMax ? e.d : clamp(dVise, dMin, dMax);
    const psiL = recuperer ? 0 : Math.atan2(ligneLa - lIci, la);
    const ouverture = recuperer ? .19 : Math.asin(Math.min(1, (evite ? 9 : 5) / Math.max(vit, 1)));
    const psiC = clamp(Math.atan2(dVise - e.d, la), psiL - ouverture, psiL + ouverture);
    // ── AMÉLIORATION 3 : contre-braquage en vraie dérive uniquement ──
    const contreBeta = (vit > 10 && Math.abs(e.beta) > 0.14) ? -0.45 * e.beta : 0;
    const kVise = kIci / Math.max(1 - kIci * e.d, .3) + 2.2 * (psiC - e.psi) * Math.max(vit, 5) / (10 * Math.max(vit, 3)) + contreBeta;
    let volant = B.conduite.volantPour(e, kVise);

    // Sous-virage.
    if (!recuperer && Math.abs(kIci) > 4e-3) {
      const large = (lIci + ia.decal + ia.decalDep - e.d) * Math.sign(kIci);
      if (large > 2) cible = Math.min(cible, vit * (1 - .03 * Math.min(large - 2, 3)));
    }

    let gaz = 0, frein = 0;
    if (besoin > 0.7 * dec) frein = clamp((besoin - 0.7 * dec) / (0.3 * dec), 0, 1);
    else if (vit > cible + 2) frein = clamp((vit - cible - 2) / 4, 0, 1);
    else gaz = vit < cible - 1 ? 1 : clamp((cible - vit + 1) / 2, 0, 1);

    // ── AMÉLIORATION 3b : modulation gaz en dérive (anti têtes-à-queue) ──
    if (vit > 8 && Math.abs(e.beta) > 0.16 && !recuperer) {
      const betaAbs = Math.abs(e.beta);
      const tractionCut = clamp(1 - (betaAbs - 0.16) * 2.8, 0.25, 1);
      gaz *= tractionCut;
      // contre-braquage supplémentaire sur le volant en dérive serrée
      if (betaAbs > 0.22) volant -= 0.3 * Math.sign(e.beta) * (betaAbs - 0.22) * 4;
    }

    // Retour progressif (CONTRAINTES TESTS — ne pas modifier).
    const roule = course.phase === 'course' || course.phase === 'arrivee';
    const gardeRetour = roule && !v.fini && !v.abandon && e.v < .1 && gaz > .1 && frein < .1 &&
      !(e.degats && e.degats.casse) && !e.recuperation && !e.saut && !e.accident && !e.reparation && !e.stands && !(e.immunite > 0);
    ia.retourBloque = gardeRetour && (ia.retourBloque || Math.cos(e.psi) < -.2);
    const intention = gaz > .1 && frein < .1 && (cible > 2 || ia.retourBloque);
    const coince = roule && !v.fini && !v.abandon && e.v < 1.5 && intention &&
      !(e.degats && e.degats.casse) && !e.recuperation && !e.saut && !e.accident && !e.reparation && !e.stands && !(e.immunite > 0);
    ia.bloque = coince ? (ia.bloque || 0) + dt : 0;

    // Dégagement d'un contact fixe confirmé.
    let marcheArriere = false;
    ia.degagementAttente = Math.max(0, (ia.degagementAttente || 0) - dt);
    if (ia.degagementEssais > 0 && Math.hypot(ecart(c, ia.degagementOrigineS, e.s), e.d - ia.degagementOrigineD) >= 8) ia.degagementEssais = 0;
    const contactFixe = e.auRail || !!course._obstacleMemo?.[v.id]?.size;
    if (!ia.degagement && ia.bloque > .8 && contactFixe && !ia.degagementAttente && ia.degagementEssais < 2) {
      if (!ia.degagementEssais) { ia.degagementOrigineS = e.s; ia.degagementOrigineD = e.d; }
      ia.degagementEssais++;
      ia.degagement = 1; ia.degagementT = 0; ia.degagementDistance = 0; ia.degagementS = e.s; ia.degagementD = e.d;
      ia.cible = -1; ia.cote = 0; ia.decalVise = 0; ia.decalDep = 0;
    }
    if (ia.degagement && (!roule || v.fini || v.abandon || e.recuperation || e.saut || e.accident || e.reparation || e.stands || e.degats?.casse)) ia.degagement = 0;
    if (ia.degagement) {
      ia.bloque = 0; ia.degagementT += dt;
      ia.degagementDistance += Math.hypot(ecart(c, ia.degagementS, e.s), e.d - ia.degagementD);
      ia.degagementS = e.s; ia.degagementD = e.d;
      const capVise = clamp(-e.d / 18, -.45, .45), ecartCap = capVise - e.psi - e.beta;
      const corr = clamp(2 * Math.atan2(Math.sin(ecartCap), Math.cos(ecartCap)), -.9, .9);
      // ── AMÉLIORATION 5 : reculer jusqu'à 3.0 m (au lieu de 1.8 m) ──
      if (ia.degagement === 1 && (ia.degagementDistance >= 3.0 || ia.degagementT >= 3.5)) { ia.degagement = 2; ia.degagementT = 0; }
      if (ia.degagement === 1) { marcheArriere = true; gaz = 0; frein = 1; volant = -corr * 1.4; }
      else {
        gaz = .65; frein = 0; volant = corr;
        if (e.v > 6 || ia.degagementT >= 4) { ia.degagement = 0; ia.degagementAttente = 2; }
      }
    }
    // CONTRAINTE TEST : ne pas modifier
    if (ia.bloque > 15) { B.conduite.declencherAccident(e, {}); ia.bloque = 0; ia.cible = -1; ia.cote = 0; ia.decalVise = 0; ia.decalDep = 0; }
    // l'IA conduit avec l'aide au volant légère
    if (!sortie) return { gaz, frein, volant, derive: false, haut: false, bas: false, boite: 'auto', aide: AIDE_IA, marcheArriere };
    sortie.gaz = gaz; sortie.frein = frein; sortie.volant = volant; sortie.derive = false; sortie.haut = false;
    sortie.bas = false; sortie.boite = 'auto'; sortie.aide = AIDE_IA; sortie.marcheArriere = marcheArriere;
    return sortie;
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
          a.s = ramener(a.s - sg * ol / 2, L, c); b.s = ramener(b.s + sg * ol / 2, L, c);
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
    if (course.c.ouvert) {
      if (v.fini) return;
      const temps = tPassage - v.debutTour, valide = v.tourValide !== false, meilleur = valide && (v.meilleur === null || temps < v.meilleur);
      v.debutTour = tPassage; v.tours = 1; v.tempsTours.push(temps);
      if (meilleur) v.meilleur = temps;
      ev.push({ type: 'tour', id: v.id, tour: 1, temps, meilleur, valide });
      v.fini = true; v.tempsFinal = tPassage; course.finisseurs++;
      if (course.drapeau === null) course.drapeau = tPassage;
      ev.push({ type: 'arrivee', id: v.id, position: course.finisseurs });
      if (v.joueur) course.phase = 'arrivee';
      return;
    }
    if (course.mode === 'chrono') {
      if (!course.chronoParti) { course.chronoParti = true; v.debutTour = tPassage; v.tourValide = true; course.enreg.n = 0; course.enreg.prochain = 0; return; }
    } else if (v.passages === 0 || v.fini) return; // départ compté depuis le vert ; rien après l'arrivée
    const temps = tPassage - v.debutTour, valide = v.tourValide !== false, meilleur = valide && (v.meilleur === null || temps < v.meilleur);
    v.debutTour = tPassage; v.tours++; v.tempsTours.push(temps);
    // forme du tour suivant : un rival peu régulier varie un peu (±0,3 % au plus), sans hasard hors de la graine
    if (!v.joueur && v.ia) { const h = mulberry32((Math.imul(v.id + 7, 0x85EBCA6B) ^ Math.imul(v.tours + 3, 0xC2B2AE35)) >>> 0); v.ia.forme = 1 + (h() - .5) * .012 * (1 - v.ia.regularite); }
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
  function comparerRangs(a, b, L) {
    if (a.abandon !== b.abandon) return a.abandon ? 1 : -1;
    const d = score(b, L) - score(a, L);
    if (d !== 0) return d;
    if (a.fini !== b.fini) return a.fini ? -1 : 1;
    return a.fini ? a.tempsFinal - b.tempsFinal : a.id - b.id;
  }
  function progressionTotale(v, L) { return v.fini ? v.tours * L : v.progression; }
  // Rangs, à chaque pas : tri par insertion, stable, depuis l'ordre des voitures, dans le tableau `tri` (rendu ; la
  // course garde le sien : douze voitures, presque toujours déjà en ordre). Même comparaison et, la comparaison étant
  // un ordre cohérent, même résultat, égalités comprises, que le tri stable de Array.prototype.sort sur cet ordre.
  function classer(V, L, tri = []) {
    const n = V.length;
    tri.length = n;
    for (let i = 0; i < n; i++) {
      const v = V[i];
      let j = i;
      while (j > 0 && comparerRangs(tri[j - 1], v, L) > 0) { tri[j] = tri[j - 1]; j--; }
      tri[j] = v;
    }
    return tri;
  }
  // course.classement reste un tableau neuf à chaque pas : ceux qui en gardent un d'avant le retrouvent intact.
  function majClassement(course) {
    const L = course.c.longueur, n = course.voitures.length;
    const tri = classer(course.voitures, L, course._tri || (course._tri = []));
    const tete = tri[0], ids = new Array(n);
    for (let i = 0; i < n; i++) {
      const v = tri[i];
      ids[i] = v.id;
      v.position = i + 1;
      if (i === 0) { v.ecart = 0; v.ecartTete = 0; continue; }
      const p = tri[i - 1];
      v.ecart = p.fini && v.fini && p.tours === v.tours ? v.tempsFinal - p.tempsFinal : (progressionTotale(p, L) - progressionTotale(v, L)) / course.vref;
      v.ecartTete = tete.fini && v.fini && tete.tours === v.tours ? v.tempsFinal - tete.tempsFinal : (progressionTotale(tete, L) - progressionTotale(v, L)) / course.vref;
    }
    course.classement = ids;
  }

  // Aspiration : dans le sillage d'une voiture à moins de 30 m devant et à moins de 2 m de côté, la traînée baisse
  // (part de 0 à 1, lue par la conduite) ; elle croît quand on se rapproche et quand on s'aligne.
  const ASPIRATION = { portee: 30, cote: 2 };
  function aspirer(c, V) {
    for (let i = 0; i < V.length; i++) {
      const a = V[i];
      let part = 0;
      for (let j = 0; j < V.length; j++) {
        const b = V[j];
        if (b === a) continue;
        // ecart va du premier point au second : b doit être devant la voiture qui reçoit le sillage.
        const ds = ecart(c, a.etat.s, b.etat.s), dd = Math.abs(b.etat.d - a.etat.d);
        if (ds > LONGUEUR && ds < ASPIRATION.portee && dd < ASPIRATION.cote)
          part = Math.max(part, (1 - ds / ASPIRATION.portee) * (1 - dd / ASPIRATION.cote));
      }
      a.etat.aspiration = part;
    }
  }

  // Stands (lots 4 et 12F). La voie est le long du bord droit de la ligne droite principale, sous le bâtiment que dessine
  // decor.js (circuit.js, c.stands). Elle est prise sur la chaussée : on y entre en serrant à droite, sans trou dans
  // la glissière. Règles tenues ici, nulle part ailleurs :
  //  - on n'entre qu'à basse vitesse (S.vitesse + 4 m/s) ; à vitesse de course, la voie n'est pas un stand ;
  //  - la voie bride à S.vitesse ; sortir de la voie avant le garage annule l'arrêt, sans réparation ;
  //  - le service ne se rend qu'à l'arrêt dans le garage, pour la durée chiffrée d'après l'état constaté ;
  //  - les quatre pneus, de la monte figée au début du service, sont remplacés ensemble à sa fin seulement ;
  //    sortir du garage, être déplacé ou subir un accident avant la fin annule ce remplacement ;
  //  - la réparation complète (B.degats.reparer) ne se fait QUE là : ni en roulant, ni par replacement
  //    (conduite.js donne reparerUrgence au remplacement, qui laisse les avaries) ;
  //  - entrer aux stands invalide le tour courant (même règle que le replacement) : le chrono et le fantôme n'y
  //    gagnent rien, la voie ne raccourcit pas le tour puisqu'elle est sur la piste ;
  //  - une voiture à l'arrêt au stand n'est jamais « coincée » au sens de l'IA (pas d'accident au bout de 15 s) ;
  //  - les rivaux et reprises IA ne sont admis qu'avec une décision explicite de strategie-stands.js ; ils paient
  //    le même trajet et le même service que le joueur, sans réparation gratuite ;
  //  - en ligne, rien ici ne se décrète pour une voiture distante : son état vient de sa machine (reseau.js ne
  //    transporte ni dégâts ni arrêt), un pair ne peut pas faire réparer la voiture d'un autre.
  const STANDS = { marge: .8, entree: 4, arret: .35, frein: 18, mouvementService: .05 };
  const COMMANDE_SERVICE = Object.freeze({ ...NEUTRE, frein: 1 });
  function limiterVoiePhysX(course, v, cmd) {
    const e = v.etat, S = course.c.stands;
    if (!e._physx || !S || e.stands?.phase !== 'voie' || e.rapport === -1 || e.v < 0) return cmd;
    // Le limiteur travaille par la même motricité et les mêmes freins que le pilote. Écrire e.v après le
    // solveur ne ralentit pas l'acteur : sa vitesse réelle serait relue intacte au pas suivant.
    B.conduite.couperTurbo(e);
    const vitesse = Math.abs(e.v);
    if (vitesse < S.vitesse - .6) return cmd;
    const commandes = course._cmdsLimiteVoie || (course._cmdsLimiteVoie = []);
    const limite = commandes[v.id] || (commandes[v.id] = {});
    Object.assign(limite, cmd);
    limite.gaz = (cmd.gaz || 0) * clamp((S.vitesse - vitesse) / .6, 0, 1);
    limite.frein = Math.max(cmd.frein || 0, clamp((vitesse - S.vitesse) / .5, 0, 1));
    limite.derive = false;
    return limite;
  }
  // Choisir pour le prochain arrêt ne touche ni à la monte actuelle ni à son état. La demande n'est valable
  // que pour une voiture humaine conduite ici ; un service commencé conserve la monte qu'il a figée.
  function demanderPneus(course, v, type) {
    if (!course || course.termine || !Array.isArray(course.voitures) || !v || !course.voitures.includes(v) ||
      !(v.joueur || v.humain) || v.distant || v.reprise || v.fini || v.abandon ||
      !v.etat || typeof v.etat !== 'object' || Array.isArray(v.etat) || v.etat.stands?.phase === 'service' ||
      !B.pneus.estJouable(type)) return false;
    v.etat.pneusProchainArret = type;
    return true;
  }
  function dansLaVoie(c, e, S) {
    return Math.abs(ecart(c, e.s, (S.debut + S.fin) / 2)) <= (S.fin - S.debut) / 2 + STANDS.entree * 10 &&
      Math.abs(e.d - S.d) <= S.demi + STANDS.marge;
  }
  function dansLeGarage(c, e, S) {
    return Math.abs(ecart(c, e.s, (S.garage0 + S.garage1) / 2)) <= (S.garage1 - S.garage0) / 2;
  }
  function serviceImmobile(c, e, S, st) {
    return !!S && dansLaVoie(c, e, S) && dansLeGarage(c, e, S) && Number.isFinite(e.v) && Math.abs(e.v) < STANDS.arret &&
      Number.isFinite(st.sService) && Number.isFinite(st.dService) &&
      Math.hypot(ecart(c, st.sService, e.s), e.d - st.dService) <= STANDS.mouvementService;
  }
  function annulerStand(v, ev) {
    v.etat.stands = null;
    ev.push({ type: 'stand', id: v.id, phase: 'annule' });
  }
  function stands(course, v, dt, ev) {
    const S = course.c.stands, e = v.etat;
    // Une IA perd son autorisation après sa manœuvre de sortie. Réarmer le verrou seulement une fois réellement
    // hors de la voie doit donc précéder cette garde, sinon aucun arrêt ultérieur ne serait possible.
    if (S && !v.distant && e && e.standsSortie && !dansLaVoie(course.c, e, S)) e.standsSortie = false;
    // Une IA qui traîne près du garage ne reçoit rien : seule sa décision d'arrêt engagée ouvre le service partagé.
    const humaine = (v.joueur || v.humain) && !v.reprise;
    const conduite = humaine || (B.strategieStands && B.strategieStands.autorise(course, v));
    if (!S || !conduite || v.distant || v.abandon || v.fini) {
      if (e && e.stands) {
        if (!v.distant && !humaine) annulerStand(v, ev); else e.stands = null;
      }
      return;
    }
    const st = e.stands;
    if (!st) {
      if (course.phase !== 'course' || course.temps < 5 || e.recuperation || e.accident || e.saut) return;
      // on ne reprend pas un deuxième arrêt sans être sorti de la voie : sinon la voiture tournerait en boucle
      // « réparée, re-entrée » tant qu'elle traîne le long du garage
      if (e.standsSortie) { if (!dansLaVoie(course.c, e, S)) e.standsSortie = false; return; }
      // Entrée délibérée : la voiture doit être DANS la voie (pas seulement à son bord) et lente. Une roue qui
      // frôle le bord droit à vitesse de course ne déclenche rien, et une file lente à l'arrêt du départ non plus.
      if (dansLaVoie(course.c, e, S) && Math.abs(e.d - S.d) <= S.demi - .3 && Math.abs(e.v) <= S.vitesse + STANDS.entree) {
        e.stands = { phase: 'voie', t: 0, repare: false };
        v.tourValide = false;
        ev.push({ type: 'stand', id: v.id, phase: 'entree' });
      }
      return;
    }
    if (e.recuperation || e.accident || e.saut || e.reparation) { annulerStand(v, ev); return; }
    if (!Number.isFinite(dt) || dt <= 0) return;
    st.t += dt;
    const dans = dansLaVoie(course.c, e, S);
    if (st.phase === 'voie') {
      if (!dans) { annulerStand(v, ev); return; }
      if (!e._physx && e.v > S.vitesse) e.v = Math.max(S.vitesse, e.v - STANDS.frein * dt);
      // Une place peut être occupée depuis la décision IA du début de pas (entrée humaine ou contact).
      // Revérifier l'admission après les collisions ; une attente dans le garage ne vaut pas service autorisé.
      if (dansLeGarage(course.c, e, S) && Math.abs(e.v) < STANDS.arret &&
        (humaine || B.strategieStands.servicePossible(course, v))) {
        st.phase = 'service'; st.t = 0; st.duree = B.degats.chiffrerService(v.degats);
        st.pneus = B.pneus.estJouable(e.pneusProchainArret) ? e.pneusProchainArret : e.pneus;
        st.revisionPneus = e.servicePneus; st.sService = e.s; st.dService = e.d;
        if (!e._physx) { e.v = 0; e.omega = 0; }
        e.gaz = 0; e.frein = 1;
        ev.push({ type: 'stand', id: v.id, phase: 'service', duree: st.duree, pneus: st.pneus });
      }
    } else if (st.phase === 'service') {
      if (st.interrompu || !serviceImmobile(course.c, e, S, st)) { annulerStand(v, ev); return; }
      if (!e._physx) { e.v = 0; e.omega = 0; }
      e.gaz = 0; e.frein = 1;
      if (st.t >= st.duree) {
        const monteAvant = e.pneus;
        if (!B.pneus.remplacerEtat(e, st.pneus, { seance: course.graine, voiture: v.id }, st.revisionPneus)) {
          annulerStand(v, ev); return;
        }
        if (monteAvant !== e.pneus) v.livree.pneus = e.pneus;
        B.degats.reparer(v.degats);
        st.phase = 'sortie'; st.repare = true;
        ev.push({ type: 'stand', id: v.id, phase: 'repare', pneus: e.pneus, servicePneus: e.servicePneus });
      }
    } else if (st.phase === 'sortie') {
      if (e.v > S.vitesse || !dans) {
        e.stands = null; e.standsSortie = true;
        ev.push({ type: 'stand', id: v.id, phase: 'sortie' });
      }
    }
  }

  function tousArrives(V) { for (let i = 0; i < V.length; i++) if (!(V[i].fini || V[i].abandon)) return false; return true; }
  // `sortie`, facultatif : tableau d'événements de l'appelant, vidé puis rempli et rendu au lieu d'un neuf (un
  // appelant qui avance la course à chaque image peut garder le sien). Sans lui, un tableau neuf, comme toujours.
  function pas(course, cmdJoueur, dt, sortie) {
    const ev = sortie || [];
    if (sortie) sortie.length = 0;
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

    if (course.physique) B.physique.avant(course, dt, retenue);
    else {
      if (B.contacts && B.contacts.avant) B.contacts.avant(course);
      if (B.obstacles) B.obstacles.avant(course);
    }
    const cmdsIA = course._cmdsIA || (course._cmdsIA = []);   // un objet de commandes par voiture, rempli à chaque pas
    for (let i = 0; i < V.length; i++) {
      const v = V[i];
      course.sAvant[i] = sLigne(c, v.etat.s);
      // voiture distante : son état vient du réseau, prolongé jusqu'à ce pas (jeu.js, reseau.js)
      if (v.distant) { if (course.distant) course.distant(v, dt); continue; }
      let cmd;
      if (!v.joueur || v.fini) {
        cmd = commandesIA(course, v, cmdsIA[i] || (cmdsIA[i] = {}));
        if (c.ouvert && v.fini) { cmd.gaz = 0; cmd.frein = v.etat.v > 2 ? .72 : .25; cmd.derive = false; }
      }
      else cmd = (Array.isArray(cmdJoueur) ? cmdJoueur[v.id] : cmdJoueur) || NEUTRE;   // écran partagé : une commande par voiture
      const service = v.etat.stands;
      if (service && service.phase === 'service') {
        // Un choc ou un déplacement observé avant ce pas ne doit pas être effacé par le frein de service.
        if (!serviceImmobile(c, v.etat, c.stands, service)) service.interrompu = true;
        else cmd = COMMANDE_SERVICE;
      }
      // les événements de la voiture vont droit dans ceux du pas ; une conduite de test qui rend son propre tableau
      // est recopiée comme avant
      cmd = limiterVoiePhysX(course, v, cmd);
      const debut = ev.length, rendus = B.conduite.pas(v.etat, cmd, c, dt, retenue, ev);
      if (rendus === ev) for (let k = debut; k < ev.length; k++) ev[k].id = v.id;
      else for (const e of rendus) { e.id = v.id; ev.push(e); }
    }
    const avant = ev.length;
    if (course.physique) B.physique.pas(course, dt, ev);
    else if (B.contacts) B.contacts.pas(course, ev); else contacts(course, ev);
    for (let k = avant; k < ev.length; k++) if (ev[k].type === 'contact' && course.statsIa) course.statsIa.contacts++;
    if (!course.physique && B.obstacles) B.obstacles.pas(course, ev);
    if (!retenue) for (let i = 0; i < V.length; i++) stands(course, V[i], dt, ev);
    if (!retenue) course.temps = t0 + dt;

    // Franchissements de ligne (interpolés dans le pas) et progression continue
    for (let i = 0; i < V.length; i++) {
      const v = V[i], a = course.sAvant[i], b = sLigne(c, v.etat.s);
      if(v.etat.recuperation || (v.degats&&(v.degats.casse||B.degats?.uneRouePerdue(v.degats))))v.tourValide=false;
      const replacements=v.etat.repositionnements||0;
      if(replacements!==v.repositionnements){v.tourValide=false;v.repositionnements=replacements;course.sAvant[i]=b;v.progression=c.ouvert?b:v.passages*L+b;continue;}
      if (c.ouvert) {
        const seuil = (c.arrivee === undefined ? L : c.arrivee) - (c.depart || 0);
        if (!v.fini && a < seuil && b >= seuil) {
          v.passages = 1; v.maxPassages = 1;
          const frac = b > a ? (seuil - a) / (b - a) : 1;
          passageLigne(course, v, t0 + dt * frac, ev);
        }
        v.progression = b;
      } else {
        // Un franchissement réellement parcouru peut finir le tour, marqué non valide après accident.
        if (a > 0.75 * L && b < 0.25 * L) {
          v.passages++;
          if (v.passages > v.maxPassages) {
            v.maxPassages = v.passages;
            passageLigne(course, v, t0 + dt * (L - a) / (L - a + b), ev);
          }
        } else if (a < 0.25 * L && b > 0.75 * L) v.passages--;
        v.progression = v.passages * L + b;
      }
      if (course.mode === 'chrono' && course.chronoParti && v.joueur && v.tourValide !== false) enregistrer(course, v, course.temps);
    }
    majClassement(course);
    if (tousArrives(V)) {
      if (course.finSansCourse === undefined) course.finSansCourse = course.horloge;
      if (course.horloge - course.finSansCourse >= 3) course.termine = true;
    }

    // Fin : 8 s après l'arrivée du joueur, ou quand le délai après le drapeau est écoulé
    // À deux (en ligne ou écran partagé), la course attend aussi l'autre pilote (au plus deux fois ce délai) et finit
    // 8 s après l'arrivée du dernier des deux.
    const j = course.joueur;
    if (course.mode === 'course' && course.drapeau !== null) {
      const delai = Math.max(40, 1.25 * course.drapeau / course.toursTotal);
      let humains = 0, enPiste = false, arrivee = j.fini ? j.tempsFinal : -Infinity;
      for (let i = 0; i < V.length; i++) { const v = V[i]; if (v.humain) { humains++; if (!v.fini && !v.abandon) enPiste = true; else if (v.fini) arrivee = Math.max(arrivee, v.tempsFinal); } }
      const attendre = humains > 0 && enPiste && course.temps - course.drapeau < 2 * delai;
      if (!attendre && ((arrivee > -Infinity && course.temps - arrivee >= 8) || course.temps - course.drapeau >= delai ||
          tousArrives(V))) course.termine = true;
    }
    return ev;
  }

  // Retour manuel : même abscisse, aucun passage ajouté, tour courant non homologué.
  function replacer(course,v=course.joueur) {
    const c = course.c;
    if (c.ouvert) v.etat.s = Math.max(0, Math.min(v.etat.s, c.longueur - 20));
    const ev=B.conduite.replacer(v.etat,c);v.tourValide=false;v.repositionnements=v.etat.repositionnements;
    const i=course.voitures.indexOf(v);if(i>=0)course.sAvant[i]=sLigne(c,v.etat.s);
    v.progression=c.ouvert?sLigne(c,v.etat.s):v.passages*c.longueur+sLigne(c,v.etat.s);
    for(const x of ev)x.id=v.id;return ev;
  }

  // Fantôme du meilleur tour (chrono) au temps du tour en cours : { s, d, angle } ou null. retard (facultatif) : durée
  // dont l'instant dessiné précède le dernier pas (le jeu dessine les voitures entre leurs deux dernières poses) ; le
  // fantôme est alors pris au même instant qu'elles, sans sauts d'un pas à l'autre.
  function fantome(course, retard = 0) {
    const f = course.fantome.meilleur;
    if (!f || !course.chronoParti || f.n < 1) return null;
    const c = course.c, D = f.donnees, m = f.n, t = course.temps - retard - course.joueur.debutTour;
    if (t < 0 || t > course.fantome.temps) return null;
    if (m === 1) return { s: D[1], d: D[2], angle: D[3] };
    let i = clamp(Math.floor(t / 0.05), 0, m - 2);
    while (i > 0 && D[4 * i] > t) i--;
    while (i < m - 2 && D[4 * (i + 1)] <= t) i++;
    const ta = D[4 * i], tb = D[4 * i + 4], u = tb > ta ? clamp((t - ta) / (tb - ta), 0, 1) : 0;
    const sa = D[4 * i + 1], sb = D[4 * i + 5];
    return {
      s: ramener(sa + ecart(c, sa, sb) * u, c.longueur, c),
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

  // Course de chauffe jetable, pour le préchargement d'une séance : douze voitures sur le tracé de la séance, départ
  // lancé (ni grille ni feux), le joueur à la main (boîte manuelle, dérive tenue dans les virages, donc turbo), puis
  // freinage jusqu'à l'arrêt, marche arrière et replacement. Le moteur JavaScript compile ainsi l'IA, la conduite,
  // les contacts et les solides avant la grille, au lieu de le faire en course, où chaque chemin encore jamais pris
  // coûte une recompilation et des objets jetés. Rien n'en passe dans la vraie course : la course jetable a ses
  // propres états, elle lit la météo sans l'écrire et ne touche ni au son, ni aux records, ni aux débris (des solides
  // du tracé, elle ne laisse que les marques de recherche des voisins, qui ne changent aucun contact).
  // avancer(n) fait au plus n pas et dit s'il en reste : la chauffe s'étale en tranches sous le voile de chargement.
  function chauffe(c, o = {}) {
    const co = creer(c, { mode: 'course', tours: 2, difficulte: 2, rivaux: 11, graine: o.graine ?? 4242, placeJoueur: 12 });
    const pneus = B.conduite.pneusConseilles(B.chaussee.lire(c, c.depart || 0, undefined, CHAUSSEE_CHAUFFE));
    for (let i = 0; i < co.voitures.length; i++) co.voitures[i].etat.pneus = pneus;
    co.phase = 'course'; co.feux.vert = true; co.temps = 0;
    const dt = co.dt, total = Math.max(1, Math.round((o.secondes ?? 20) / dt)), arret = total - Math.round(6 / dt);
    const cmd = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'manuelle', aide: AIDE_IA, guidage: 0, marcheArriere: false };
    const cmdIA = {}, ev = [];
    let k = 0;
    function unPas() {
      const v = co.joueur, e = v.etat, base = commandesIA(co, v, cmdIA);
      cmd.gaz = base.gaz; cmd.frein = base.frein; cmd.volant = base.volant; cmd.marcheArriere = false;
      cmd.haut = e.regime > 12400 && e.rapport < 6; cmd.bas = !cmd.haut && e.regime < 9300 && e.rapport > 1;
      cmd.derive = Math.abs(lire(c, c.courbure, e.s + 12)) > 1 / 170 && e.v > 18 && base.frein < .3;
      if (cmd.derive && e.derive.actif && e.derive.sens * e.beta > .03) cmd.volant = -e.derive.sens * .45;
      if (k >= arret) {   // six dernières secondes : frein tenu jusqu'à l'arrêt (la marche arrière s'engage), puis recul
        cmd.derive = false; cmd.haut = false; cmd.bas = false; cmd.marcheArriere = true;
        if (k - arret < Math.round(4.5 / dt)) { cmd.gaz = 0; cmd.frein = 1; } else { cmd.gaz = .5; cmd.frein = 0; }
      }
      pas(co, cmd, dt, ev);
      if (k === total - 1) replacer(co, v);
    }
    return {
      get reste() { return total - k; },
      avancer(n = total) { const fin = Math.min(total, k + (n > 0 ? n : 0)); while (k < fin) { unPas(); k++; } return k < total; }
    };
  }

  B.course = { creer, pas, replacer, fantome, etatPilotes, commandesIA, aspirer, horsService, empriseIA, stands, demanderPneus, dansLaVoie, dansLeGarage, classer, chauffe, STANDS, IA_ATTENTE, IA_PORT, PILOTES, LIVREES, ASPIRATION };
})(globalThis.BITUME = globalThis.BITUME || {});
