/* BITUME — expressions visuelles du pilote, sans effet sur la conduite.
   Un état par séance, une sortie et un hasard privés par voiture. Aucun acteur n'est modifié.
   actualiser se fait une fois avant les vues J2/J1 ; lire ne fait que recopier cinq champs. */
(function (B) {
  'use strict';
  const GESTES = Object.freeze(['majeur', 'poing', 'salut']);
  const DUREES = Object.freeze([1.65, 1.40, 1.80]);
  const LIMITES = Object.freeze({ regard: .32, distance: 18, denivele: 3, vitesse: 8,
    depassement: .8, historique: .5, amorce: .4, regardDuree: 1.45,
    delaiManuel: 2.5, delaiDemo: 18, probabiliteDemo: .28, attenteDemande: .65 });
  const NEUTRE = Object.freeze({ regard: 0, geste: null, gestePhase: 0, gesteCote: -1, gesteIntensite: 0 });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lisse = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const fini = Number.isFinite;

  function creer(nombre, graine = 1) {
    if (!Number.isInteger(nombre) || nombre < 1 || nombre > 64) throw new RangeError('Expressions : 1 à 64 pilotes');
    const pilotes = new Array(nombre);
    for (let i = 0; i < nombre; i++) pilotes[i] = {
      sortie: { regard: 0, geste: null, gestePhase: 0, gesteCote: -1, gesteIntensite: 0 },
      hasard: ((graine >>> 0) ^ Math.imul(i + 1, 0x9e3779b1) ^ 0x45585052) >>> 0,
      tenu: false, demande: false, demandeAvant: NaN, prochainManuel: -Infinity,
      regardA: -Infinity, regardAngle: 0, prochainRegard: -Infinity,
      geste: -1, dernierGeste: -1, gesteA: -Infinity, gesteCote: -1,
      retourA: -Infinity, retourNiveau: 0, passageJusqua: -Infinity,
      stableDepuis: NaN, depassements: 0, gestesManuels: 0, gestesDemo: 0
    };
    return { nombre, pilotes, course: null, phase: null, temps: NaN, prochainAuto: -Infinity,
      voitures: new Array(nombre).fill(null), references: new Array(nombre).fill(null),
      x: new Float64Array(nombre), y: new Float64Array(nombre), z: new Float64Array(nombre),
      progression: new Float64Array(nombre), rapport: new Float64Array(nombre), repositionnements: new Uint32Array(nombre),
      valide: new Uint8Array(nombre), continu: new Uint8Array(nombre),
      armes: new Uint8Array(nombre * nombre), derriereA: new Float64Array(nombre * nombre),
      duelApres: new Float64Array(nombre * nombre).fill(-Infinity) };
  }

  function hasard(p) {
    p.hasard = (p.hasard + 0x6d2b79f5) >>> 0;
    let t = p.hasard;
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
    p.geste = -1; p.retourA = -Infinity;
    const o = p.sortie; o.geste = null; o.gestePhase = o.gesteIntensite = 0;
  }
  function neutraliser(p) {
    eteindre(p); p.demande = false; p.regardA = -Infinity; p.regardAngle = 0; p.sortie.regard = 0;
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
    }
  }
  function lancer(p, t, cote, demo) {
    // Le premier tirage couvre les trois gestes ; ensuite, pas de répétition immédiate du même geste.
    const u = hasard(p), k = p.dernierGeste < 0 ? Math.floor(u * GESTES.length)
      : (p.dernierGeste + 1 + Math.floor(u * (GESTES.length - 1))) % GESTES.length;
    p.geste = p.dernierGeste = k; p.gesteA = t; p.gesteCote = cote < 0 ? -1 : 1; p.retourA = -Infinity;
    p.prochainManuel = t + LIMITES.delaiManuel;
    if (demo) p.gestesDemo++; else p.gestesManuels++;
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
    if (demo && t >= E.prochainAuto && t >= p.prochainManuel && t >= p.passageJusqua && p.geste < 0 && hasard(p) < LIMITES.probabiliteDemo) {
      lancer(p, t, lat < -.35 ? -1 : lat > .35 ? 1 : -1, true); E.prochainAuto = t + LIMITES.delaiDemo;
    }
  }
  function afficher(p, t) {
    const o = p.sortie, ageRegard = t - p.regardA;
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
    const dt = t - E.temps, reset = E.course !== co || E.phase !== co.phase || !fini(dt) || dt < 0 || dt > LIMITES.historique;
    const enCourse = co.phase === 'course' && !co.termine;
    if (E.course && E.course !== co || fini(dt) && dt < 0) {
      E.prochainAuto = -Infinity;
      for (let i = 0; i < E.nombre; i++) {
        const p = E.pilotes[i]; neutraliser(p);
        p.prochainManuel = p.prochainRegard = p.passageJusqua = -Infinity;
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
        if (avant || E.course && E.course !== co || fini(dt) && dt < 0) { eteindre(p); p.demande = false; }
      }
      E.continu[i] = continu && t - p.stableDepuis >= LIMITES.amorce ? 1 : 0;
      if (avant && E.references[i] === v && et.rapport !== E.rapport[i]) p.passageJusqua = t + .36;
      if (fini(v.tPassage) && v.tPassage <= t + .05) p.passageJusqua = Math.max(p.passageJusqua, v.tPassage + .36);
      if (t < p.passageJusqua) interrompre(p, t);
      E.valide[i] = 1; E.references[i] = v;
    }
    for (let i = 0; i < E.nombre; i++) {
      const p = E.pilotes[i]; if (!E.valide[i] || !p.demande) continue;
      if (!fini(p.demandeAvant)) p.demandeAvant = t + LIMITES.attenteDemande;
      if (t > p.demandeAvant) p.demande = false;
      else if (p.geste < 0 && t >= p.passageJusqua && t >= p.prochainManuel) {
        lancer(p, t, coteManuel(E, poses, i, t), false); p.demande = false;
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
    E.course = co; E.phase = co.phase; E.temps = t; return E;
  }
  function lire(E, id, sortie) {
    const o = E?.pilotes[id]?.sortie || NEUTRE;
    if (!sortie) return o;
    sortie.regard = o.regard; sortie.geste = o.geste; sortie.gestePhase = o.gestePhase;
    sortie.gesteCote = o.gesteCote; sortie.gesteIntensite = o.gesteIntensite; return sortie;
  }
  B.expressionsPilote = { creer, actualiser, demander, lire, GESTES, LIMITES };
})(globalThis.BITUME = globalThis.BITUME || {});
