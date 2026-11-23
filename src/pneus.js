/* BITUME — contrat commun des roues et des pneus, quatre montes jouables depuis le lot 12E.
   Les coefficients sec/eau historiques restent disponibles ; la neige et l'usure sont traitées en p10.
   Le remplacement 12F1 s'applique une seule fois sur révision attendue, sans avancer le service ni tirer
   dans le générateur de la course. Les dégâts et leur réparation restent dans leur propre module. */
(function (B) {
  'use strict';

  const VERSION_ETAT = 1;
  const DISTANCE_MAX = 1e9, SOLLICITATION_MAX = 1e9, SERVICE_MAX = 0xffffffff;
  const EMPATTEMENT = 2.70, DEMI_VOIE_AV = .85, DEMI_VOIE_AR = .8075, JANTE_R = .165;
  // z < 0 = gauche dans le repère de la voiture ; indices déjà employés par la physique et le dessin.
  const ROUES = Object.freeze([
    Object.freeze({ id: 'AVG', indice: 0, nom: 'roue avant gauche', avant: true, cote: -1, x: 1.35, z: -DEMI_VOIE_AV, r: .29, l: .28 }),
    Object.freeze({ id: 'AVD', indice: 1, nom: 'roue avant droite', avant: true, cote: 1, x: 1.35, z: DEMI_VOIE_AV, r: .29, l: .28 }),
    Object.freeze({ id: 'ARG', indice: 2, nom: 'roue arrière gauche', avant: false, cote: -1, x: -1.35, z: -DEMI_VOIE_AR, r: .335, l: .46 }),
    Object.freeze({ id: 'ARD', indice: 3, nom: 'roue arrière droite', avant: false, cote: 1, x: -1.35, z: DEMI_VOIE_AR, r: .335, l: .46 })
  ]);
  const ORDRE_ROUES = Object.freeze(ROUES.map(r => r.id));
  const NOMS_ROUES = Object.freeze(ROUES.map(r => r.nom));
  const INDICES_ROUES = Object.freeze({ AVG: 0, AVD: 1, ARG: 2, ARD: 3 });

  // Base au sec et variation avec l'eau. Les trois premières paires restent celles de p9.
  // Réglages de jeu, sans prétention de mesure physique d'un pneu de compétition réel.
  const PNEUS = Object.freeze({
    slicks: Object.freeze([1, -.30]),
    inter: Object.freeze([.96, -.10]),
    pluie: Object.freeze([.88, .07]),
    neige: Object.freeze([.78, -.10])
  });
  const ADHERENCE_NEIGE = Object.freeze({ slicks: .32, inter: .46, pluie: .54, neige: .82 });
  // Perte maximale de gomme au sec, complétée selon l'eau liquide ou la couverture neigeuse.
  // Chaque combinaison garde au moins 68 % de la réponse du pneu neuf, sans rupture en fin d'usure.
  const PERTE_USURE = Object.freeze({
    slicks: Object.freeze({ sec: .18, eau: .04, neige: .06 }),
    inter: Object.freeze({ sec: .18, eau: .12, neige: .10 }),
    pluie: Object.freeze({ sec: .18, eau: .14, neige: .10 }),
    neige: Object.freeze({ sec: .18, eau: .10, neige: .14 })
  });
  const CATALOGUE = Object.freeze({
    slicks: Object.freeze({ id: 'slicks', nom: 'Slicks', sculpture: 'lisse', cercle: Object.freeze([.95, .76, .08]), rainures: 0, disponible: true, adherence: PNEUS.slicks }),
    inter: Object.freeze({ id: 'inter', nom: 'Intermédiaires', sculpture: 'intermediaire', cercle: Object.freeze([.16, .72, .30]), rainures: 8, disponible: true, adherence: PNEUS.inter }),
    pluie: Object.freeze({ id: 'pluie', nom: 'Pluie', sculpture: 'pluie', cercle: Object.freeze([.16, .46, .90]), rainures: 14, disponible: true, adherence: PNEUS.pluie }),
    neige: Object.freeze({ id: 'neige', nom: 'Neige', sculpture: 'paves-lamelles', cercle: Object.freeze([.86, .90, .96]), rainures: 18, disponible: true, adherence: PNEUS.neige })
  });
  const TYPES = Object.freeze(Object.keys(CATALOGUE));
  const TYPES_JOUABLES = Object.freeze(TYPES.filter(t => CATALOGUE[t].disponible));
  const NOMS_PNEUS = Object.freeze(Object.fromEntries(TYPES.map(t => [t, CATALOGUE[t].nom])));
  const possede = (o, cle) => Object.prototype.hasOwnProperty.call(o, cle);
  function estType(type) { return typeof type === 'string' && possede(CATALOGUE, type); }
  function normaliserType(type, repli = 'slicks') { return estType(type) ? type : estType(repli) ? repli : 'slicks'; }
  // Migration locale : les deux pilotes héritent de l'ancienne préférence, puis gardent chacun leur choix.
  // Une entrée absente ou invalide ne copie jamais le choix de l'autre pilote. Le tableau rendu appartient
  // à l'appelant, même si la source est gelée ou déjà normalisée.
  function normaliserChoixPilotes(reglages) {
    const source = reglages && typeof reglages === 'object' && !Array.isArray(reglages) ? reglages : {};
    const repli = normaliserType(possede(source, 'pneus') ? source.pneus : undefined);
    const choix = possede(source, 'pneusPilotes') && Array.isArray(source.pneusPilotes) ? source.pneusPilotes : [];
    return [0, 1].map(i => normaliserType(possede(choix, i) ? choix[i] : undefined, repli));
  }
  function lire(type) { return CATALOGUE[normaliserType(type)]; }
  function estJouable(type) { return estType(type) && CATALOGUE[type].disponible; }

  function borner(n, maximum, repli = 0) {
    return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(maximum, n)) : repli;
  }
  function entier(n, maximum, repli = 0) { return Math.floor(borner(n, maximum, repli)); }
  function identifiant(n) { return typeof n === 'string' || typeof n === 'number' && Number.isFinite(n) ? String(n) : '0'; }
  function melanger(n) {
    n = Math.imul(n ^ n >>> 16, 0x7feb352d);
    n = Math.imul(n ^ n >>> 15, 0x846ca68b);
    return (n ^ n >>> 16) >>> 0;
  }
  function graineIdentite(identite, service) {
    identite = identite && typeof identite === 'object' ? identite : {};
    const s = identifiant(identite.seance), v = identifiant(identite.voiture);
    // Préfixes de longueur pour distinguer les identifiants qui contiennent eux-mêmes des séparateurs.
    const texte = s.length + ':' + s + v.length + ':' + v + ':' + service;
    let h = 0x811c9dc5;
    for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 0x01000193);
    return h >>> 0;
  }
  function roueNeuve(base, i) {
    return { usure: 0, salete: 0, grainage: 0, distance: 0, sollicitation: 0,
      graine: melanger((base + Math.imul(i + 1, 0x9e3779b9)) >>> 0) };
  }

  function etatNeuf(type, identite, service) {
    const base = graineIdentite(identite, service);
    return { versionPneus: VERSION_ETAT, pneus: type, servicePneus: service,
      etatPneus: ROUES.map((_, i) => roueNeuve(base, i)) };
  }

  // Le retour peut être copié dans l'état de conduite. Les quatre objets restent indépendants et mutables.
  // servicePneus est la révision du dernier remplacement terminé, initialement zéro ; aucun service n'est lancé ici.
  function creerEtat(type = 'slicks', identite = {}) {
    return etatNeuf(normaliserType(type), identite, 0);
  }

  // Transaction locale : les quatre roues changent ensemble après validation complète. Une seconde livraison
  // du même ordre (révision attendue ancienne) est sans effet. Ne pas normaliser une commande invalide en
  // pneus neufs ; le futur transport doit aussi vérifier séance, expéditeur et version avant cet appel.
  function remplacerEtat(etat, type, identite, revisionAttendue) {
    const identiteValide = x => typeof x === 'string' && x.length > 0 ||
      typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
    if (!etat || typeof etat !== 'object' || Array.isArray(etat) || etat.versionPneus !== VERSION_ETAT ||
      !estJouable(type) || !Number.isInteger(revisionAttendue) || revisionAttendue < 0 || revisionAttendue >= SERVICE_MAX ||
      etat.servicePneus !== revisionAttendue || !identite || typeof identite !== 'object' ||
      !identiteValide(identite.seance) || !identiteValide(identite.voiture) ||
      !Array.isArray(etat.etatPneus) || etat.etatPneus.length !== ROUES.length) return false;
    const nombreBorne = (roue, champ, maximum, entierRequis = false) => {
      const propriete = Object.getOwnPropertyDescriptor(roue, champ);
      if (!propriete || !propriete.enumerable || !possede(propriete, 'value')) return false;
      const valeur = propriete.value;
      return Number.isFinite(valeur) && valeur >= 0 && valeur <= maximum &&
        (!entierRequis || Number.isInteger(valeur));
    };
    for (const { indice } of ROUES) {
      if (!possede(etat.etatPneus, indice)) return false;
      const roue = etat.etatPneus[indice];
      if (!roue || typeof roue !== 'object' || Array.isArray(roue) || Reflect.ownKeys(roue).length !== 6 ||
        !nombreBorne(roue, 'usure', 1) || !nombreBorne(roue, 'salete', 1) ||
        !nombreBorne(roue, 'grainage', 1) || !nombreBorne(roue, 'distance', DISTANCE_MAX) ||
        !nombreBorne(roue, 'sollicitation', SOLLICITATION_MAX) ||
        !nombreBorne(roue, 'graine', SERVICE_MAX, true)) return false;
    }
    const suivant = etatNeuf(type, identite, revisionAttendue + 1);
    Object.assign(etat, suivant);
    return true;
  }

  // Copie locale bornée, pour sauvegarde et reprise. La compatibilité d'un protocole réseau sera vérifiée avant
  // cet appel par le lot 12F ; cette fonction n'accepte ni ne négocie une future version de paquet réseau.
  function normaliserEtat(source, identite = {}) {
    if (typeof source === 'string') return creerEtat(source, identite); // ancienne préférence : un seul identifiant
    source = source && typeof source === 'object' ? source : {};
    const service = entier(source.servicePneus, SERVICE_MAX), base = graineIdentite(identite, service);
    const roues = Array.isArray(source.etatPneus) ? source.etatPneus : [];
    return { versionPneus: VERSION_ETAT, pneus: normaliserType(source.pneus), servicePneus: service,
      etatPneus: ROUES.map((_, i) => {
        const neuf = roueNeuve(base, i), r = roues[i] && typeof roues[i] === 'object' ? roues[i] : {};
        return { usure: borner(r.usure, 1), salete: borner(r.salete, 1), grainage: borner(r.grainage, 1),
          distance: borner(r.distance, DISTANCE_MAX), sollicitation: borner(r.sollicitation, SOLLICITATION_MAX),
          graine: typeof r.graine === 'number' && Number.isInteger(r.graine) && r.graine >= 0 && r.graine <= SERVICE_MAX ? r.graine : neuf.graine };
      }) };
  }

  B.pneus = Object.freeze({ VERSION_ETAT, DISTANCE_MAX, SOLLICITATION_MAX, SERVICE_MAX,
    EMPATTEMENT, DEMI_VOIE_AV, DEMI_VOIE_AR, JANTE_R, ROUES, ORDRE_ROUES, NOMS_ROUES, INDICES_ROUES,
    PNEUS, ADHERENCE_NEIGE, PERTE_USURE, CATALOGUE, TYPES, TYPES_JOUABLES, NOMS_PNEUS, estType, normaliserType, normaliserChoixPilotes, lire, estJouable, creerEtat, remplacerEtat, normaliserEtat });
})(globalThis.BITUME = globalThis.BITUME || {});
