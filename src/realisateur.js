(function (B) {
  'use strict';
  // BITUME — réalisateur de la démo. Plan après plan, il choisit la voiture filmée et la caméra : bord de piste,
  // embarquée, poursuite, hélicoptère. Il ne lit que la course (course.js) et un tirage à graine : même course et
  // même graine, mêmes plans. Les caméras elles-mêmes sont dans jeu.js.
  //
  //   const R = B.realisateur.creer(graine);
  //   const plan = B.realisateur.tenir(R, course);   // à chaque image : { vue, sujet, debut, fin, motif, n }
  //
  // Le plan rendu reste le même objet jusqu'à la coupe ; `n` compte les plans, `motif` dit pourquoi il a été choisi
  // ('grille', 'depart', 'duel', 'tete', 'sprint', 'arrivee', 'honneur').

  const VUES = ['tele', 'cockpit', 'poursuite', 'helico'];
  const DUREES = { tele: 9, cockpit: 8, poursuite: 7, helico: 7 };   // secondes, à une seconde près
  const POIDS = { tele: 34, cockpit: 30, poursuite: 22, helico: 14 };
  const APRES_VERT = 2.5;      // la grille reste à l'image le temps que le peloton s'élance
  const DUEL = 30;             // mètres : en dessous, deux voitures se battent
  const ALLURE = 15;           // m/s : en dessous, pas de caméra embarquée ni de poursuite
  const ARRET = 6;             // m/s : une voiture filmée de près qui s'arrête fait couper
  const SPRINT = 300;          // mètres : la tête arrive au drapeau, on monte à son bord et on ne coupe plus

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const dePres = vue => vue === 'cockpit' || vue === 'poursuite';

  function creer(graine) {
    return { alea: mulberry32((graine >>> 0) + 0x51ED270B), plan: null, n: 0, vert: -1, vainqueur: -1, sprint: false };
  }

  function couper(R, co, vue, sujet, duree, motif) {
    R.plan = { vue, sujet, debut: co.horloge, fin: co.horloge + duree, motif, n: ++R.n };
    return R.plan;
  }

  // Tirage pondéré dans une liste de [valeur, poids].
  function tirer(R, liste) {
    let total = 0;
    for (const x of liste) total += x[1];
    let u = R.alea() * total;
    for (const x of liste) { u -= x[1]; if (u <= 0) return x[0]; }
    return liste[liste.length - 1][0];
  }

  function suivant(R, co) {
    const avant = R.plan, V = co.voitures;
    const enPiste = co.classement.map(id => V[id]).filter(v => !v.fini);
    if (!enPiste.length) return couper(R, co, 'tele', co.classement[0], DUREES.tele, 'tete');
    let vue = tirer(R, VUES.filter(v => !avant || v !== avant.vue).map(v => [v, POIDS[v]]));

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
    if (dePres(vue) && V[sujet].etat.v <= ALLURE) vue = avant && avant.vue === 'tele' ? 'helico' : 'tele';
    return couper(R, co, vue, sujet, DUREES[vue] - 1 + 2 * R.alea(), motif);
  }

  function tenir(R, co) {
    const t = co.horloge, p = R.plan, V = co.voitures;
    // Avant le vert : toute la grille vue d'en haut, depuis la dernière ligne.
    if (co.phase === 'grille' || co.phase === 'feux') {
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
    if (!p) return suivant(R, co);
    // Les 300 derniers mètres de la tête : on finit avec elle, de près, et le plan tient jusqu'au drapeau.
    const tete = V[co.classement[0]];
    if (!R.sprint && co.toursTotal * co.c.longueur - tete.progression < SPRINT) {
      R.sprint = true;
      if (p.sujet !== tete.id) return couper(R, co, p.vue === 'poursuite' ? 'cockpit' : 'poursuite', tete.id, 1e9, 'sprint');
      p.fin = 1e9;
    }
    const s = V[p.sujet];
    const arrete = dePres(p.vue) && t - p.debut > 1.5 && s.etat.v < ARRET;
    return t < p.fin && !s.fini && !arrete ? p : suivant(R, co);
  }

  B.realisateur = { creer, tenir, VUES, DUREES };
})(globalThis.BITUME = globalThis.BITUME || {});
