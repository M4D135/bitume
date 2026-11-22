(function (B) {
  'use strict';
  // BITUME — réalisateur de la démo. Plan après plan, il choisit la voiture filmée et la caméra. Il ne lit que la
  // course (course.js) et un tirage à graine : même course et même graine, mêmes plans. Les caméras elles-mêmes sont
  // dans jeu.js.
  //
  //   const R = B.realisateur.creer(graine);
  //   B.realisateur.signaler(R, course, evenements);  // à chaque pas : contacts et accidents appellent l'action
  //   const plan = B.realisateur.tenir(R, course);   // à chaque image : { vue, sujet, debut, fin, motif, n, cote, ralenti }
  //
  // Le plan rendu reste le même objet jusqu'à la coupe ; `n` compte les plans, `motif` dit pourquoi il a été choisi
  // ('grille', 'depart', 'duel', 'tete', 'depassement', 'action', 'sprint', 'arrivee', 'honneur'). `cote` (−1, 1) place
  // les caméras latérales du côté du milieu de la piste ; `ralenti` (horloge de course) ralentit l'action.
  //
  // David (21/11/2026) : la route, le circuit et son lieu emblématique sont les seuls sujets.
  // Les voitures donnent l'échelle et le rythme ; aucun gros plan autonome roue, pilote ou nature.
  const VUES = ['tele', 'cockpit', 'poursuite', 'helico', 'aileron', 'arriere', 'sol'];
  const DUREES = { tele: 7, cockpit: 6, poursuite: 5, helico: 6, aileron: 6, arriere: 5, sol: 4, peloton: 5 };
  const POIDS = { tele: 13, cockpit: 10, poursuite: 12, helico: 12, aileron: 11, arriere: 6, sol: 7, peloton: 14 };
  const VUES_CINEMA = Object.freeze(['panorama', 'lieu', 'peloton']);
  // Caméras portées : jamais sur une voiture lente.
  const PORTEES = new Set(['cockpit', 'poursuite', 'aileron', 'arriere']);
  const APRES_VERT = 2.5;      // la grille reste à l'image le temps que le peloton s'élance
  const DUEL = 30;             // mètres : en dessous, deux voitures se battent
  const ALLURE = 15;           // m/s : en dessous, pas de caméra portée
  const ARRET = 6;             // m/s : une voiture filmée de près qui s'arrête fait couper
  const SPRINT = 300;          // mètres : la tête arrive au drapeau, on monte à son bord et on ne coupe plus
  const RALENTI = .35, RALENTI_DUREE = 2.2;   // vitesse et durée (horloge de course) du ralenti d'un choc

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const dePres = vue => PORTEES.has(vue);

  function creer(graine) {
    return { alea: mulberry32((graine >>> 0) + 0x51ED270B), plan: null, n: 0, vert: -1, vainqueur: -1, sprint: false,
      vus: {}, ordre: null, action: null, cinema: null, plansCourse: 0, natureTour: 0, natureDerniere: -1e9 };
  }

  // côté du milieu de la piste, vu de la voiture : les caméras latérales s'y placent, loin des arbres et des rails
  const coteMilieu = (co, id) => co.voitures[id].etat.d > 0 ? -1 : 1;
  function couper(R, co, vue, sujet, duree, motif, extra) {
    R.vus[vue] = R.n + 1;
    R.plan = Object.assign({ vue, sujet, debut: co.horloge, fin: co.horloge + duree, motif, n: ++R.n, cote: coteMilieu(co, sujet), angle: R.alea() * Math.PI * 2 }, extra);
    if (R.plan.nature) { R.plansCourse = 0; R.natureDerniere = co.horloge; }
    else if (motif !== 'grille') R.plansCourse++;
    return R.plan;
  }

  function respiration(R, co) {
    if (!R.cinema || R.sprint || co.drapeau !== null || R.plansCourse < 3 || co.horloge - R.natureDerniere < 15 || co.horloge - R.vert < 11) return null;
    const types = ['lieu', 'panorama'];
    for (let k = 0; k < types.length; k++) {
      const type = types[(R.natureTour + k) % types.length], ancre = B.cinema.choisir(R.cinema, type, Math.floor(R.natureTour / types.length), co.horloge);
      if (!ancre) continue;
      R.natureTour += k + 1;
      let sujet = co.classement[0], distance = Infinity;
      for (const v of co.voitures) if (!v.fini) {
        const d = Math.abs(B.circuit.ecart(co.c, v.etat.s, ancre.s)); if (d < distance) { distance = d; sujet = v.id; }
      }
      return couper(R, co, type, sujet, type === 'panorama' ? 6.4 : 6, 'circuit', { ancre, nature: true, label: ancre.label });
    }
    return null;
  }

  // Tirage pondéré dans une liste de [valeur, poids].
  function tirer(R, liste) {
    let total = 0;
    for (const x of liste) total += x[1];
    let u = R.alea() * total;
    for (const x of liste) { u -= x[1]; if (u <= 0) return x[0]; }
    return liste[liste.length - 1][0];
  }
  // une caméra pas vue depuis longtemps pèse plus lourd : toutes servent
  const poids = (R, v) => POIDS[v] * (1 + .45 * Math.min(8, R.n + 1 - (R.vus[v] || 0)));

  // un poursuivant à moins de DUEL mètres ?
  function chasse(co, id) {
    const v = co.voitures[id];
    return co.voitures.some(o => o !== v && !o.fini && v.progression - o.progression > 0 && v.progression - o.progression < DUEL);
  }

  function suivant(R, co) {
    const avant = R.plan, V = co.voitures;
    const enPiste = co.classement.map(id => V[id]).filter(v => !v.fini);
    if (!enPiste.length) return couper(R, co, 'tele', co.classement[0], DUREES.tele, 'tete');
    const paysage = respiration(R, co); if (paysage) return paysage;

    // Les duels : la voiture qui chasse, pour que celle de devant soit à l'image. La tête de course pèse plus lourd,
    // l'écart court aussi ; on évite de reprendre la voiture du plan précédent.
    const duels = [];
    for (let r = 1; r < enPiste.length; r++) {
      const ecart = enPiste[r - 1].progression - enPiste[r].progression;
      if (ecart < DUEL && enPiste[r].etat.v > ALLURE) duels.push([enPiste[r].id, (1 + (DUEL - ecart) / DUEL) / (1 + (r - 1) * .35)]);
    }
    const autre = liste => { const l = liste.filter(x => !avant || x[0] !== avant.sujet); return l.length ? l : liste; };
    let sujet, motif;
    const tete = enPiste[0], dernierTour = tete.tours >= co.toursTotal - 1;
    if (dernierTour && R.alea() < .6) {
      // dernier tour : on ne quitte guère la tête, ou celui qui la menace
      const menace = enPiste[1] && tete.progression - enPiste[1].progression < DUEL ? enPiste[1] : null;
      sujet = (menace && R.alea() < .6 ? menace : tete).id; motif = 'tete';
    } else if (duels.length) { sujet = tirer(R, autre(duels)); motif = 'duel'; }
    else { sujet = tirer(R, autre(enPiste.slice(0, 4).map((v, r) => [v.id, 4 - r]))); motif = 'tete'; }

    // la caméra : jamais la même deux fois ; l'arrière seulement si quelqu'un suit ; rien de porté sur une voiture lente
    const lente = V[sujet].etat.v <= ALLURE;
    const catalogue = R.cinema ? VUES.concat(['peloton']) : VUES;
    const vues = catalogue.filter(v => (!avant || v !== avant.vue) && !(v === 'arriere' && !chasse(co, sujet)) && !(lente && dePres(v)));
    const vue = tirer(R, vues.map(v => [v, poids(R, v)]));
    return couper(R, co, vue, sujet, DUREES[vue] - 1 + 2 * R.alea(), motif);
  }

  // Contacts et accidents de la course : le plus fort, s'il touche une voiture qui roulait vite, appelle l'action.
  function signaler(R, co, evenements) {
    if (co.phase !== 'course' || co.drapeau !== null || R.sprint) return;
    for (const e of evenements) {
      let id = -1, force = 0;
      if (e.type === 'contact' && e.force > 3) { id = co.voitures[e.a].etat.v >= co.voitures[e.b].etat.v ? e.a : e.b; force = e.force; }
      else if (e.type === 'choc' && e.id !== undefined && e.force > 8) { id = e.id; force = e.force; }
      else if ((e.type === 'tonneau' || e.type === 'casse' || e.type === 'roue') && e.id !== undefined) { id = e.id; force = 25; }
      if (id >= 0 && (!R.action || force > R.action.force)) R.action = { id, force, t: co.horloge };
    }
  }

  function tenir(R, co, cinema = null, expressions = null) {
    R.cinema = cinema;
    const t = co.horloge, p = R.plan, V = co.voitures;
    // La première découverte tient dans le délai existant : les feux et le départ restent en temps réel.
    if (co.phase === 'grille' || co.phase === 'feux') {
      if (cinema && t < 2.4) {
        const ancre = B.cinema.choisir(cinema, 'lieu', 0, t) || B.cinema.choisir(cinema, 'panorama', 0, t);
        if (ancre) return p?.motif === 'decouverte' ? p : couper(R, co, ancre.type, co.classement[0], 2.4 - t, 'decouverte', { ancre, nature: true, label: ancre.label });
      }
      return p && p.motif === 'grille' ? p : couper(R, co, 'helico', co.classement[co.classement.length - 1], 1e9, 'grille');
    }
    if (p && p.motif === 'grille') {
      if (R.vert < 0) R.vert = t;
      return t - R.vert < APRES_VERT ? p : couper(R, co, 'tele', co.classement[0], DUREES.tele, 'depart');
    }
    // Le drapeau : le vainqueur au bord de la piste, puis vu d'en haut jusqu'à la fin de la séance.
    if (co.drapeau !== null) {
      if (R.vainqueur < 0) {
        let premier = null;
        for (const v of V) if (v.fini && (!premier || v.tempsFinal < premier.tempsFinal)) premier = v;
        R.vainqueur = premier ? premier.id : co.classement[0];
        return couper(R, co, 'tele', R.vainqueur, 6, 'arrivee');
      }
      return t < p.fin ? p : couper(R, co, 'helico', R.vainqueur, 1e9, 'honneur');
    }
    if (!p) { R.ordre = co.classement.slice(); return suivant(R, co); }
    // Les 300 derniers mètres de la tête : on finit avec elle, de près, et le plan tient jusqu'au drapeau.
    const tete = V[co.classement[0]];
    if (!R.sprint && (co.c.ouvert ? co.c.longueur : co.toursTotal * co.c.longueur) - tete.progression < SPRINT) {
      R.sprint = true;
      if (p.sujet !== tete.id || p.nature) return couper(R, co, p.vue === 'poursuite' ? 'cockpit' : 'poursuite', tete.id, 1e9, 'sprint');
      p.fin = 1e9;
    }
    // Un plan de circuit garde sa durée tant que sa trajectoire est disponible.
    // Un sprint ou le drapeau garde toujours la priorité ci-dessus.
    if (p.nature && !R.sprint) return B.cinema.disponible(cinema, p.ancre, t) && t < p.fin ? p : suivant(R, co);
    if (!R.sprint) {
      // L'action : un choc fort, filmé de dehors, au ralenti
      const a = R.action; R.action = null;
      if (a && t - a.t < 1.2 && p.motif !== 'action' && t - p.debut > .8 && !V[a.id].fini) {
        const vue = tirer(R, ['helico', 'tele', 'sol'].filter(v => v !== p.vue).map(v => [v, 1]));
        return couper(R, co, vue, a.id, 4.2, 'action', { ralenti: t + RALENTI_DUREE, facteur: RALENTI });
      }
      // Un dépassement dans les huit premiers : on coupe sur celui qui vient de passer
      const ordre = co.classement;
      if (R.ordre && p.motif !== 'action' && p.motif !== 'depassement' && t - p.debut > 2.5) {
        for (let r = 0; r < Math.min(8, ordre.length); r++) {
          const id = ordre[r], avantRang = R.ordre.indexOf(id);
          if (avantRang > r && !V[id].fini && V[id].etat.v > ALLURE && R.alea() < .7) {
            R.ordre = ordre.slice();
            const vue = tirer(R, ['poursuite', 'arriere', 'tele', 'aileron'].filter(v => v !== p.vue && !(v === 'arriere' && !chasse(co, id))).map(v => [v, poids(R, v)]));
            return couper(R, co, vue, id, DUREES[vue], 'depassement');
          }
        }
      }
      R.ordre = ordre.slice();
    }
    const s = V[p.sujet];
    const arrete = dePres(p.vue) && p.motif !== 'action' && t - p.debut > 1.5 && s.etat.v < ARRET;
    return t < p.fin && !s.fini && !arrete ? p : suivant(R, co);
  }

  // Une caméra mobile devenue masquée change réellement de plan : le numéro et les filtres repartent ensemble.
  function replier(R, co, vue = 'tele', sujet = R.plan?.sujet) {
    if (!VUES.includes(vue)) vue = 'tele';
    const sprint = R.sprint && co.drapeau === null;
    // Le terrain peut imposer une autre caméra, jamais une nouvelle respiration pendant l'arrivée.
    if (sprint) sujet = co.classement[0];
    if (!co.voitures[sujet]) sujet = co.classement[0];
    return couper(R, co, vue, sujet, sprint ? 1e9 : DUREES[vue], sprint ? 'sprint' : 'cadre');
  }

  // facteur de vitesse de la démo : ralenti d'une action, sinon 1
  function vitesse(R, co) {
    const p = R && R.plan;
    return p && p.ralenti && co.horloge < p.ralenti ? p.facteur : 1;
  }

  B.realisateur = { creer, tenir, replier, signaler, vitesse, VUES, VUES_CINEMA, DUREES, PORTEES };
})(globalThis.BITUME = globalThis.BITUME || {});
