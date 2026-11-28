/* BITUME — alertes de la Route sans fin. David, 28/11 : « faut plus signaler le temps restant, les checkpoints, le
   compte à rebours avant fin du temps et panne essence, pneus etc ». Logique pure, sans document ni horloge propre,
   testée dans Node (verifications/alertes-route.test.mjs) : src/jeu.js lui passe l'état d'un joueur à chaque mise à
   jour de son affichage et montre l'annonce qu'elle rend. */
(function (B) {
  'use strict';
  // Un sujet s'annonce quand son niveau monte, jamais quand il redescend. Une annonce à la fois, la plus grave
  // d'abord, au plus une toutes les 2,5 s ; une alerte rouge bipe. Les cinq dernières secondes du compte à rebours
  // passent avant tout, une par seconde, avec un bip. David, 28/11 : « faut que ça clignote quand ça craint, alerte
  // avant un peu » : seuils avancés, et chaque niveau donne sa gravité (1 ambre, 2 rouge) à l'élément de l'affichage
  // qui clignote (src/jeu.js, src/style.css).
  const ECART = 2.5, DECOMPTE = 5;
  const POIDS = Object.freeze({ temps: 50, chauffe: 40, essence: 30, sante: 20, pneus: 10 });
  const SUJETS = Object.freeze(Object.keys(POIDS));

  function distance(m) {
    if (!(m > 0)) return 'ici';
    const metres = Math.max(10, Math.round(m / 10) * 10);
    return metres < 1000 ? metres + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
  }
  const aLaStation = e => Number.isFinite(e.station) ? ' · ' + distance(e.station) : '';
  const versCheckpoint = e => Number.isFinite(e.distCp) ? 'Checkpoint à ' + distance(e.distCp) : null;

  // e : { restant (s), distCp (m), essence ('ok'|'prochaine'|'insuffisant'|'vide'), station (m jusqu'à la prochaine
  // station), usure (pire pneu, 0 à 1), sante (0 à 1), chauffe (0 à 1 et plus), feu (0 à 1) }
  function niveau(sujet, e) {
    switch (sujet) {
      case 'temps': return !Number.isFinite(e.restant) ? 0 : e.restant <= 10 ? 2 : e.restant <= 20 ? 1 : 0;
      case 'essence': return e.essence === 'vide' ? 3 : e.essence === 'insuffisant' ? 2 : e.essence === 'prochaine' ? 1 : 0;
      case 'pneus': return e.usure >= .8 ? 2 : e.usure >= .55 ? 1 : 0;
      case 'sante': return e.sante < .3 ? 2 : e.sante < .6 ? 1 : 0;
      case 'chauffe': return e.feu > 0 ? 3 : e.chauffe >= .8 ? 2 : e.chauffe >= .6 ? 1 : 0;
    }
    return 0;
  }
  // gravité d'un niveau pour l'affichage : 0 rien, 1 ambre (prévenir), 2 rouge (danger)
  const gravite = (sujet, n) => n <= 0 ? 0 : sujet === 'essence' || sujet === 'chauffe' ? (n >= 2 ? 2 : 1) : Math.min(2, n);
  const MESSAGES = Object.freeze({
    temps: [null,
      e => ({ texte: 'Plus que 20 s', ton: 'ambre', court: false, sous: versCheckpoint(e) }),
      e => ({ texte: 'Plus que 10 s', ton: 'rouge', court: false, sous: versCheckpoint(e) })],
    essence: [null,
      e => ({ texte: 'Ravitaillez', ton: 'ambre', court: true,
        sous: Number.isFinite(e.station) ? 'Prochaine station · ' + distance(e.station) : 'À la prochaine station' }),
      e => ({ texte: 'Réserve', ton: 'rouge', court: false,
        sous: (Number.isFinite(e.station) ? 'Station à ' + distance(e.station) + ' · ' : '') + 'levez le pied' }),
      e => ({ texte: 'Plus d\'essence', ton: 'rouge', court: false,
        sous: Number.isFinite(e.station) && e.station < 1500 ? 'Roue libre jusqu\'à la station · ' + distance(e.station) : 'Roue libre' })],
    pneus: [null,
      e => ({ texte: 'Pneus usés', ton: 'ambre', court: true, sous: 'À changer à la station' + aLaStation(e) }),
      e => ({ texte: 'Pneus à bout', ton: 'rouge', court: false, sous: 'À changer à la station' + aLaStation(e) })],
    sante: [null,
      e => ({ texte: 'Voiture abîmée', ton: 'ambre', court: true, sous: 'Réparation à la station' + aLaStation(e) }),
      e => ({ texte: 'Voiture en danger', ton: 'rouge', court: false, sous: 'Réparation à la station' + aLaStation(e) })],
    chauffe: [null,
      e => ({ texte: 'Moteur chaud', ton: 'ambre', court: true, sous: 'Levez le pied' }),
      e => ({ texte: 'Le moteur fume', ton: 'rouge', court: false, sous: 'Levez le pied · station' + aLaStation(e) }),
      e => ({ texte: 'Feu moteur !', ton: 'rouge', court: false, sous: 'Extincteurs à la station' + aLaStation(e) })],
  });

  function creer() {
    const niveaux = {};
    for (const s of SUJETS) niveaux[s] = 0;
    return { niveaux, file: new Map(), prochaine: -Infinity, decompte: Infinity };
  }

  // Rend null, ou { annonce: { texte, ton, court, sous }, bip, sujet, niveau }. maintenant : secondes, croissantes.
  function evaluer(m, e, maintenant) {
    for (const sujet of SUJETS) {
      const avant = m.niveaux[sujet], apres = niveau(sujet, e);
      if (apres > avant) m.file.set(sujet, apres);
      else if (apres < avant && (m.file.get(sujet) || 0) > apres) m.file.delete(sujet);   // annonce devenue fausse
      m.niveaux[sujet] = apres;
    }
    if (Number.isFinite(e.restant) && e.restant > 0 && e.restant <= DECOMPTE) {
      const s = Math.ceil(e.restant);
      if (s < m.decompte) {
        m.decompte = s; m.prochaine = Math.max(m.prochaine, maintenant + 1);
        return { annonce: { texte: String(s), ton: 'rouge', court: true, sous: versCheckpoint(e) }, bip: true, sujet: 'decompte', niveau: s };
      }
    } else m.decompte = Infinity;
    if (maintenant < m.prochaine || !m.file.size) return null;
    let choix = null, meilleur = -Infinity;
    for (const [sujet, n] of m.file) {
      const score = POIDS[sujet] + 15 * n;
      if (score > meilleur) { meilleur = score; choix = sujet; }
    }
    const n = m.file.get(choix);
    m.file.delete(choix);
    m.prochaine = maintenant + ECART;
    return { annonce: MESSAGES[choix][n](e), bip: gravite(choix, n) >= 2, sujet: choix, niveau: n };
  }

  B.alertesRoute = { ECART, DECOMPTE, SUJETS, creer, evaluer, niveau, gravite, distance };
})(globalThis.BITUME = globalThis.BITUME || {});
