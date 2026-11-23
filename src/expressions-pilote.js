/* BITUME — expressions du pilote et événement Troll, sans effet sur la conduite.
   Un état par séance, une sortie et un hasard privés par voiture. Aucun acteur n'est modifié.
   actualiser puis consommerEvenement se font avant les vues J2/J1 ; lire reste une lecture pure. */
(function (B) {
  'use strict';
  const GESTES = Object.freeze(['majeur', 'poing', 'salut']);
  const KLAXONS = Object.freeze(['classique', 'ancien', 'mariage']);
  const DUREES = Object.freeze([1.65, 1.40, 1.80]);
  const LIMITES = Object.freeze({ regard: .32, distance: 18, denivele: 3, vitesse: 8,
    depassement: .8, historique: .5, amorce: .4, regardDuree: 1.45,
    delaiManuel: 2.5, delaiDemo: 18, probabiliteDemo: .28, attenteDemande: .65,
    delaiIA: 8, delaiGlobalIA: 1.2 });
  const NEUTRE = Object.freeze({ regard: 0, geste: null, gestePhase: 0, gesteCote: -1, gesteIntensite: 0, passageVisuel: null });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lisse = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const fini = Number.isFinite;
  const normaliserGeste = valeur => GESTES.includes(valeur) ? valeur : 'majeur';
  const normaliserKlaxon = valeur => KLAXONS.includes(valeur) ? valeur : 'classique';

  function creer(nombre, graine = 1, options = null) {
    if (!Number.isInteger(nombre) || nombre < 1 || nombre > 64) throw new RangeError('Expressions : 1 à 64 pilotes');
    const pilotes = new Array(nombre);
    for (let i = 0; i < nombre; i++) pilotes[i] = {
      sortie: { regard: 0, geste: null, gestePhase: 0, gesteCote: -1, gesteIntensite: 0, passageVisuel: null },
      // Sans configuration explicite, conserver le tirage manuel historique des bancs de pose.
      choixGeste: -1, choixKlaxon: 0, prochainIA: -Infinity,
      evenement: { id: i, numero: 0, sequence: 0, temps: -Infinity, geste: null, klaxon: null, cote: -1, origine: null },
      evenementPret: false,
      hasard: ((graine >>> 0) ^ Math.imul(i + 1, 0x9e3779b1) ^ 0x45585052) >>> 0,
      hasardSon: ((graine >>> 0) ^ Math.imul(i + 1, 0x9e3779b1) ^ 0x4b4c4158) >>> 0,
      tenu: false, demande: false, demandeAvant: NaN, prochainManuel: -Infinity,
      regardA: -Infinity, regardAngle: 0, prochainRegard: -Infinity,
      geste: -1, dernierGeste: -1, gesteA: -Infinity, gesteCote: -1,
      retourA: -Infinity, retourNiveau: 0, passageJusqua: -Infinity,
      passageAnimeDebut: -Infinity, passageAnimeFin: -Infinity,
      stableDepuis: NaN, depassements: 0, gestesManuels: 0, gestesDemo: 0, gestesIA: 0
    };
    // L'activation explicite distingue la course de la vitrine derrière les menus.
    return { nombre, pilotes, ia: options?.ia === true, course: null, phase: null, temps: NaN,
      prochainAuto: -Infinity, prochainIA: -Infinity,
      // File de N indices vers les N événements préalloués : un départ au plus par pilote/image.
      // La séquence reste monotone pour toute la vie de E, même après un retour de l'horloge.
      evenements: new Uint8Array(nombre), evenementsN: 0, evenementsLu: 0, sequence: 0,
      evenementConsomme: false,
      voitures: new Array(nombre).fill(null), references: new Array(nombre).fill(null),
      x: new Float64Array(nombre), y: new Float64Array(nombre), z: new Float64Array(nombre),
      progression: new Float64Array(nombre), rapport: new Float64Array(nombre), repositionnements: new Uint32Array(nombre),
      valide: new Uint8Array(nombre), continu: new Uint8Array(nombre),
      armes: new Uint8Array(nombre * nombre), derriereA: new Float64Array(nombre * nombre),
      duelApres: new Float64Array(nombre * nombre).fill(-Infinity) };
  }

  function configurer(E, id, choix) {
    if (!Number.isInteger(id) || id < 0 || id >= E?.nombre) return false;
    const p = E?.pilotes?.[id]; if (!p) return false;
    // Copier les valeurs : modifier les réglages n'altère ni ces préférences ni le geste déjà lancé.
    p.choixGeste = GESTES.indexOf(normaliserGeste(choix?.geste));
    p.choixKlaxon = KLAXONS.indexOf(normaliserKlaxon(choix?.klaxon));
    return true;
  }
  // Contrat 00, révision 1. La sortie appartient à l'appelant et doit être réutilisée.
  // Une lecture fausse laisse ses champs inchangés. La consommation par id partage les mêmes marques.
  function consommerEvenement(E, sortie) {
    if (!E || !sortie || typeof sortie !== 'object' || E.evenementConsomme) return false;
    for (let i = E.evenementsLu; i < E.evenementsN; i++) {
      const p = E.pilotes[E.evenements[i]], e = p.evenement;
      if (!p.evenementPret || e.temps !== E.temps) continue;
      // Valider la consommation avant toute écriture dans la sortie de l'appelant.
      E.evenementConsomme = true;
      p.evenementPret = false;
      E.evenementsLu = i + 1;
      const { sequence, id, geste, klaxon, temps, cote } = e;
      sortie.sequence = sequence; sortie.pilote = id; sortie.geste = geste;
      sortie.klaxon = klaxon; sortie.instant = temps; sortie.cote = cote;
      return true;
    }
    return false;
  }
  function consommer(E, id) {
    if (!Number.isInteger(id) || id < 0 || id >= E?.nombre) return null;
    const p = E?.pilotes?.[id]; if (!p || !p.evenementPret) return null;
    p.evenementPret = false;
    // Référence réutilisée : à lire maintenant, pas à retenir comme une file différée.
    return p.evenement.temps === E.temps ? p.evenement : null;
  }

  function hasard(p) {
    p.hasard = (p.hasard + 0x6d2b79f5) >>> 0;
    let t = p.hasard;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  // Le timbre a son flux privé : l'ajout du son ne décale aucun ancien tirage de geste/démo.
  function hasardKlaxon(p) {
    p.hasardSon = (p.hasardSon + 0x6d2b79f5) >>> 0;
    let t = p.hasardSon;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function demander(E, id, appuye) {
    const p = E?.pilotes[id]; if (!p) return false;
    const front = !!appuye && !p.tenu; p.tenu = !!appuye;
    if (front) { p.demande = true; p.demandeAvant = fini(E.temps) ? E.temps + LIMITES.attenteDemande : NaN; }
    return front;
  }
  function eteindre(p) {
    p.geste = -1; p.retourA = -Infinity; p.evenementPret = false;
    const o = p.sortie; o.geste = null; o.gestePhase = o.gesteIntensite = 0;
  }
  function neutraliser(p) {
    eteindre(p); p.demande = false; p.regardA = -Infinity; p.regardAngle = 0; p.sortie.regard = 0;
    p.passageAnimeDebut = p.passageAnimeFin = -Infinity; p.sortie.passageVisuel = null;
  }
  function sain(v, pose) {
    const e = v?.etat;
    return !!e && !!pose && fini(pose.x) && fini(pose.y) && fini(pose.z) && fini(pose.cap) &&
      fini(v.progression) && fini(e.v) && fini(e.rapport) && !v.fini && !v.abandon && !e.accident && !e.recuperation &&
      !e.reparation && !e.stands && !e.degats?.casse && !v.degats?.casse && !(e.rapport < 0);
  }
  function enveloppe(p, t) {
    if (p.geste < 0) return 0;
    const age = Math.max(0, t - p.gesteA), duree = DUREES[p.geste];
    let niveau = lisse(age / .24) * (1 - lisse((age - duree + .36) / .36));
    if (p.retourA !== -Infinity) niveau = Math.min(niveau, p.retourNiveau * (1 - lisse((t - p.retourA) / .14)));
    return niveau;
  }
  function interrompre(p, t) {
    if (p.geste >= 0 && p.retourA === -Infinity) {
      p.retourNiveau = enveloppe(p, t); p.retourA = t;
      // Rendre d'abord la main à la jante, puis suivre le trajet validé du levier. Superposer les
      // deux trajets faisait traverser la jante à la main droite. La boîte réelle n'est pas décalée.
      p.passageAnimeDebut = t + .14; p.passageAnimeFin = p.passageJusqua;
    }
  }
  function lancer(E, p, t, cote, origine) {
    // N places suffisent par construction. À saturation, ne lancer ni geste ni son, ne tirer aucun hasard.
    // Une demande manuelle garde son échéance et peut être acceptée à l'image suivante.
    if (E.evenementsN >= E.evenements.length) return false;
    // Le premier tirage couvre les trois gestes ; ensuite, pas de répétition immédiate du même geste.
    const automatique = origine !== 'manuel';
    let k = p.choixGeste;
    if (automatique || k < 0) {
      const u = hasard(p);
      k = p.dernierGeste < 0 ? Math.floor(u * GESTES.length)
        : (p.dernierGeste + 1 + Math.floor(u * (GESTES.length - 1))) % GESTES.length;
    }
    const klaxon = automatique ? Math.floor(hasardKlaxon(p) * KLAXONS.length) : p.choixKlaxon;
    p.geste = p.dernierGeste = k; p.gesteA = t; p.gesteCote = cote < 0 ? -1 : 1; p.retourA = -Infinity;
    p.prochainManuel = t + LIMITES.delaiManuel;
    const e = p.evenement;
    e.numero++; e.sequence = ++E.sequence; e.temps = t; e.geste = GESTES[k]; e.klaxon = KLAXONS[klaxon]; e.cote = p.gesteCote; e.origine = origine;
    p.evenementPret = true;
    E.evenements[E.evenementsN++] = e.id;
    if (origine === 'demo') p.gestesDemo++;
    else if (origine === 'ia') p.gestesIA++;
    else p.gestesManuels++;
    return true;
  }
  function lateral(pose, autre) {
    return -(autre.x - pose.x) * Math.sin(pose.cap) + (autre.z - pose.z) * Math.cos(pose.cap);
  }
  function coteManuel(E, poses, id, t) {
    const p = E.pilotes[id];
    if (t - p.regardA < LIMITES.regardDuree && Math.abs(p.regardAngle) > .01) return p.regardAngle < 0 ? -1 : 1;
    const pose = poses[id]; let distance = LIMITES.distance ** 2, cote = -1;
    for (let j = 0; j < E.nombre; j++) if (j !== id && E.valide[j]) {
      const q = poses[j], dx = q.x - pose.x, dy = q.y - pose.y, dz = q.z - pose.z, d = dx * dx + dy * dy + dz * dz;
      if (Math.abs(dy) <= LIMITES.denivele && d < distance) {
        const lat = lateral(pose, q); if (Math.abs(lat) < .35) continue;
        distance = d; cote = lat < 0 ? -1 : 1;
      }
    }
    return cote;
  }
  function depasser(E, poses, id, autre, t, demo) {
    const p = E.pilotes[id], pose = poses[id], q = poses[autre]; p.depassements++;
    const lat = lateral(pose, q), longitudinal = (q.x - pose.x) * Math.cos(pose.cap) + (q.z - pose.z) * Math.sin(pose.cap);
    const regard = clamp(Math.atan2(lat, Math.max(4, Math.abs(longitudinal))), -LIMITES.regard, LIMITES.regard);
    if (t >= p.prochainRegard && Math.abs(lat) >= .35) {
      p.regardA = t; p.regardAngle = regard; p.prochainRegard = t + LIMITES.regardDuree + .45;
    }
    const v = E.voitures[id], cible = E.voitures[autre];
    if (v.distant || t < p.prochainManuel || t < p.passageJusqua || p.geste >= 0) return;
    const cote = lat < -.35 ? -1 : lat > .35 ? 1 : -1;
    if (demo && t >= E.prochainAuto && hasard(p) < LIMITES.probabiliteDemo) {
      if (lancer(E, p, t, cote, 'demo')) E.prochainAuto = t + LIMITES.delaiDemo;
    } else if (!demo && E.ia && !v.joueur && (!v.humain || v.reprise) &&
      (cible.joueur || cible.humain) && !cible.reprise && t >= p.prochainIA && t >= E.prochainIA) {
      if (lancer(E, p, t, cote, 'ia')) { p.prochainIA = t + LIMITES.delaiIA; E.prochainIA = t + LIMITES.delaiGlobalIA; }
    }
  }
  function afficher(p, t) {
    const o = p.sortie, ageRegard = t - p.regardA;
    o.passageVisuel = t < p.passageAnimeFin && p.passageAnimeFin > p.passageAnimeDebut
      ? clamp((t - p.passageAnimeDebut) / (p.passageAnimeFin - p.passageAnimeDebut), 0, 1) : null;
    o.regard = ageRegard >= 0 && ageRegard < LIMITES.regardDuree
      ? p.regardAngle * lisse(ageRegard / .18) * (1 - lisse((ageRegard - .65) / .8)) : 0;
    if (p.geste < 0) { o.geste = null; o.gestePhase = o.gesteIntensite = 0; return; }
    const age = t - p.gesteA;
    if (age >= DUREES[p.geste] || p.retourA !== -Infinity && t - p.retourA >= .14) { eteindre(p); return; }
    o.geste = GESTES[p.geste]; o.gestePhase = clamp(age / DUREES[p.geste], 0, 1);
    o.gesteCote = p.gesteCote; o.gesteIntensite = enveloppe(p, t);
  }

  function actualiser(E, co, poses, t, demo = false) {
    if (!E || !co || !poses || !fini(t)) return E;
    // Plusieurs vues ou une pause relisent le même état : aucun nouveau tirage au même instant.
    if (E.course === co && E.phase === co.phase && E.temps === t) return E;
    // Un début non consommé dans son image est périmé, même si l'audio n'a pas encore été déverrouillé.
    E.evenementsN = E.evenementsLu = 0;
    for (let i = 0; i < E.nombre; i++) E.pilotes[i].evenementPret = false;
    const dt = t - E.temps, reset = E.course !== co || E.phase !== co.phase || !fini(dt) || dt < 0 || dt > LIMITES.historique;
    const enCourse = co.phase === 'course' && !co.termine;
    if (E.course && E.course !== co || fini(dt) && dt < 0) {
      E.prochainAuto = E.prochainIA = -Infinity;
      for (let i = 0; i < E.nombre; i++) {
        const p = E.pilotes[i]; neutraliser(p);
        p.prochainManuel = p.prochainRegard = p.passageJusqua = p.prochainIA = -Infinity;
      }
    }
    if (reset) { E.valide.fill(0); E.armes.fill(0); E.duelApres.fill(-Infinity); }
    E.voitures.fill(null);
    for (let k = 0; k < co.voitures.length; k++) {
      const v = co.voitures[k]; if (Number.isInteger(v.id) && v.id >= 0 && v.id < E.nombre) E.voitures[v.id] = v;
    }
    // Historique du vrai mouvement : un replacement, une nouvelle grille ou un grand saut temporel ne passe pas pour un duel.
    for (let i = 0; i < E.nombre; i++) {
      const p = E.pilotes[i], v = E.voitures[i], q = poses[i], et = v?.etat, avant = E.valide[i];
      const actif = enCourse && sain(v, q); E.continu[i] = 0;
      if (!actif) { neutraliser(p); p.stableDepuis = NaN; E.valide[i] = 0; E.references[i] = v; continue; }
      const limite = 3 + Math.abs(et.v) * Math.max(0, dt) * 2;
      const continu = !reset && avant && E.references[i] === v && (et.repositionnements || 0) === E.repositionnements[i] &&
        Math.abs(v.progression - E.progression[i]) <= limite && v.progression >= E.progression[i] - .2 &&
        Math.hypot(q.x - E.x[i], q.y - E.y[i], q.z - E.z[i]) <= limite;
      if (!continu) {
        p.stableDepuis = t; p.regardA = -Infinity; p.regardAngle = 0;
        if (avant || E.course && E.course !== co || fini(dt) && dt < 0) {
          eteindre(p); p.demande = false; p.passageAnimeDebut = p.passageAnimeFin = -Infinity;
        }
      }
      E.continu[i] = continu && t - p.stableDepuis >= LIMITES.amorce ? 1 : 0;
      if (avant && E.references[i] === v && et.rapport !== E.rapport[i]) p.passageJusqua = t + .36;
      if (fini(v.tPassage) && v.tPassage <= t + .05) p.passageJusqua = Math.max(p.passageJusqua, v.tPassage + .36);
      if (t < p.passageJusqua) interrompre(p, t);
      E.valide[i] = 1; E.references[i] = v;
    }
    for (let i = 0; i < E.nombre; i++) {
      const p = E.pilotes[i]; if (!E.valide[i] || !p.demande) continue;
      if (E.voitures[i].distant) { p.demande = false; continue; }
      if (!fini(p.demandeAvant)) p.demandeAvant = t + LIMITES.attenteDemande;
      if (t > p.demandeAvant) p.demande = false;
      else if (p.geste < 0 && t >= p.passageJusqua && t >= p.prochainManuel) {
        if (lancer(E, p, t, coteManuel(E, poses, i, t), 'manuel')) p.demande = false;
      }
    }
    for (let i = 0; i < E.nombre; i++) for (let j = 0; j < E.nombre; j++) if (i !== j) {
      const k = i * E.nombre + j;
      if (!E.continu[i] || !E.continu[j] || E.voitures[i].etat.v < LIMITES.vitesse || E.voitures[j].etat.v < LIMITES.vitesse) { E.armes[k] = 0; continue; }
      const a = poses[i], b = poses[j], dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      const ecart = E.voitures[i].progression - E.voitures[j].progression;
      if (dx * dx + dy * dy + dz * dz > LIMITES.distance ** 2 || Math.abs(dy) > LIMITES.denivele || Math.abs(ecart) > 16 || t < E.duelApres[k]) { E.armes[k] = 0; continue; }
      if (ecart <= -LIMITES.depassement) { E.armes[k] = 1; E.derriereA[k] = t; }
      else if (E.armes[k] && ecart >= LIMITES.depassement) {
        E.armes[k] = 0;
        if (t - E.derriereA[k] <= 2.5) {
          E.duelApres[k] = E.duelApres[j * E.nombre + i] = t + 4;
          depasser(E, poses, i, j, t, demo);
        }
      }
    }
    for (let i = 0; i < E.nombre; i++) {
      const p = E.pilotes[i], v = E.voitures[i], q = poses[i];
      if (E.valide[i]) {
        E.x[i] = q.x; E.y[i] = q.y; E.z[i] = q.z; E.progression[i] = v.progression; E.rapport[i] = v.etat.rapport;
        E.repositionnements[i] = v.etat.repositionnements || 0;
        afficher(p, t);
      }
    }
    if (E.temps !== t) E.evenementConsomme = false;
    E.course = co; E.phase = co.phase; E.temps = t; return E;
  }
  function lire(E, id, sortie) {
    const o = E?.pilotes[id]?.sortie || NEUTRE;
    if (!sortie) return o;
    sortie.regard = o.regard; sortie.geste = o.geste; sortie.gestePhase = o.gestePhase;
    sortie.gesteCote = o.gesteCote; sortie.gesteIntensite = o.gesteIntensite; sortie.passageVisuel = o.passageVisuel; return sortie;
  }
  B.expressionsPilote = { creer, configurer, actualiser, demander, consommerEvenement, consommer, lire,
    normaliserGeste, normaliserKlaxon, GESTES, KLAXONS, LIMITES };
})(globalThis.BITUME = globalThis.BITUME || {});
