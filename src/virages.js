/* BITUME — lecture du tracé et annonces de virages ; aucune action sur la conduite.
 * Distances/rayons en mètres, vitesses en m/s, angle cumulé en radians.
 * Un suivi propre à chaque HUD distingue les passages ; il se remplace à chaque séance.
 */
(function (B) {
  'use strict';
  const plans = new WeakMap(), suivis = new WeakMap(), VIDE = Object.freeze([]);
  const RAYON_SERRE = 85;
  const borner = (x, a, b) => Math.max(a, Math.min(b, x));
  const ramener = (s, L) => ((s % L) + L) % L;

  function planifier(c) {
    if (!c || typeof c !== 'object') return VIDE;
    if (plans.has(c)) return plans.get(c);
    const L = c.longueur, pas = c.pas, K = c.courbure;
    const segments = c.ouvert ? c.n - 1 : c.n;
    if (!Number.isInteger(segments) || segments < 3 || !K || K.length !== c.n || !Number.isFinite(L) || L <= 0
      || !Number.isFinite(pas) || pas <= 0 || Math.abs(segments * pas - L) > .001) return VIDE;

    const arrivee = c.ouvert && Number.isFinite(c.arrivee) ? borner(c.arrivee, 0, L) : L;
    const n = Math.min(segments, Math.ceil(arrivee / pas));
    const abscisse = i => c.ouvert ? Math.min(i * pas, arrivee) : ramener(i * pas, L);

    // Le bord large (R = 350 m) conserve les raccords d'entrée. La sélection finale
    // exige R <= 180 m, au moins 17° et 14 m : ni frémissements des droites ni pics isolés.
    const plus = new Float64Array(n + 1), moins = new Float64Array(n + 1), lobes = [];
    let ouvert = null;
    for (let i = 0; i <= n; i++) {
      const k = i < n && Number.isFinite(K[i]) ? K[i] : 0;
      if (i < n) {
        const ds = c.ouvert ? abscisse(i + 1) - abscisse(i) : pas;
        plus[i + 1] = plus[i] + Math.max(0, k) * ds;
        moins[i + 1] = moins[i] + Math.max(0, -k) * ds;
      }
      const sens = Math.abs(k) >= 1 / 350 ? Math.sign(k) : 0;
      if (ouvert && sens !== ouvert.sens) { ouvert.fin = i; lobes.push(ouvert); ouvert = null; }
      if (sens && !ouvert) ouvert = { debut: i, fin: i + 1, sens };
    }
    const cumul = (table, i) => Math.floor(i / n) * table[n] + table[i % n];
    const integrale = (sens, a, b) => {
      const table = sens > 0 ? plus : moins;
      return cumul(table, b) - cumul(table, a);
    };
    function fusionner(liste) {
      let change = true;
      while (change && liste.length > 1) {
        change = false;
        for (let i = 0; i < liste.length - (c.ouvert ? 1 : 0); i++) {
          const j = (i + 1) % liste.length, a = liste[i], b = liste[j];
          const decalage = j === 0 ? n : 0, debut = b.debut + decalage;
          if (a.sens !== b.sens || (debut - a.fin) * pas > 36) continue;
          const fin = b.fin + decalage;
          // Limiter la courbure absolue cumulée sur les deux lobes et leur raccord.
          const angle = integrale(1, a.debut, fin) + integrale(-1, a.debut, fin);
          if (angle > .08) continue;
          a.fin = fin;
          liste.splice(j, 1); change = true; break;
        }
      }
      return liste;
    }
    fusionner(lobes); // raccord de fin de tour compris, avant d'écarter les petits lobes
    const groupes = fusionner(lobes.filter(v => integrale(v.sens, v.debut, v.fin) >= .08));
    const resultat = [];
    for (const v of groupes) {
      const longueur = c.ouvert ? abscisse(v.fin) - abscisse(v.debut) : (v.fin - v.debut) * pas;
      const angle = integrale(v.sens, v.debut, v.fin);
      let maximum = 0, vitesseMin = Infinity;
      for (let i = v.debut; i < v.fin; i++) {
        const k = K[i % n];
        if (Number.isFinite(k)) maximum = Math.max(maximum, k * v.sens);
        const vitesse = c.vitesse && c.vitesse[i % n];
        if (Number.isFinite(vitesse) && vitesse > 0) vitesseMin = Math.min(vitesseMin, vitesse);
      }
      if (maximum < 1 / 180 || angle < .30 || longueur < 14) continue;
      // Centre du plus long plateau de courbure maximale, pas un maximum flottant
      // arbitraire ; deux sommets séparés ne placent pas le repère dans leur creux.
      let debutPic = -1, taillePic = 0, sommet = v.debut;
      for (let i = v.debut; i <= v.fin; i++) {
        const pic = i < v.fin && K[i % n] * v.sens >= .98 * maximum;
        if (pic && debutPic < 0) debutPic = i;
        if (!pic && debutPic >= 0) {
          if (i - debutPic > taillePic) { taillePic = i - debutPic; sommet = (debutPic + i - 1) / 2; }
          debutPic = -1;
        }
      }
      const rayonMin = 1 / maximum;
      // Une épingle exige aussi un changement de direction : un coude à 90°, même
      // très court, reste « serré ». Les valeurs classent le tracé, jamais la météo.
      const difficulte = rayonMin <= 45 && angle >= 2 ? 3 : rayonMin <= RAYON_SERRE ? 2 : 1;
      const direction = v.sens > 0 ? 'droite' : 'gauche';
      const libelle = difficulte === 3 ? 'Épingle à ' + direction
        : (v.sens > 0 ? 'Droite' : 'Gauche') + (difficulte === 2 ? ' serrée' : ' marquée');
      if (!Number.isFinite(vitesseMin)) {
        // Repli pour les tracés sans enveloppe de vitesse : mêmes constantes que
        // circuit.vitesses(), appliquées ici au rayon de l'axe uniquement.
        const den = maximum - 1.55 * .00155;
        vitesseMin = den <= 0 ? 86 : Math.min(86, Math.sqrt(1.55 * 9.81 / den));
      }
      resultat.push({ debut: abscisse(v.debut), sommet: abscisse(sommet),
        fin: abscisse(v.fin), longueur, sens: v.sens, rayonMin, angle, vitesseMin, difficulte, libelle });
    }
    resultat.sort((a, b) => a.debut - b.debut);
    for (let i = 0; i < resultat.length; i++) resultat[i] = Object.freeze({ id: i, ...resultat[i] });
    const plan = Object.freeze(resultat);
    plans.set(c, plan);
    return plan;
  }

  function lire(c, position, suivi) {
    if (!suivi || typeof suivi !== 'object') return null;
    const plan = planifier(c);
    let etat = suivis.get(suivi);
    if (!etat || etat.c !== c) {
      etat = { c, maximum: -Infinity, precedente: null, annonces: new Map(), actuelle: null };
      suivis.set(suivi, etat);
    }
    const p = position && position.progression, vitesse = position && position.vitesse;
    if (!position || !Number.isFinite(position.s) || !Number.isFinite(p) || !Number.isFinite(vitesse) || !plan.length) {
      etat.actuelle = null; return null;
    }
    const recul = etat.precedente !== null && p < etat.precedente - .25 || p < etat.maximum - .75;
    etat.precedente = p; etat.maximum = Math.max(etat.maximum, p);
    // Garder la mémoire des annonces pendant un arrêt, une pause ou un recul évite
    // de répéter la même phrase quand la voiture recommence à avancer.
    if (position.actif !== true || vitesse < 1.5 || recul) { etat.actuelle = null; return null; }
    const L = c.longueur, s = c.ouvert ? position.s : ramener(position.s, L);
    let actuelle = etat.actuelle;
    if (actuelle && (p > actuelle.fin || p < actuelle.entree - 440)) actuelle = null;
    if (!actuelle) {
      let prochain = null, distance = Infinity;
      for (const v of plan) {
        const d = c.ouvert ? v.debut - s : ramener(v.debut - s, L);
        if (d < 0) continue;
        if (d < distance) { prochain = v; distance = d; }
      }
      if (!prochain) { etat.actuelle = null; return null; }
      const adh = Number.isFinite(position.adherence) ? borner(position.adherence, .2, 1.2) : 1;
      const v = borner(vitesse, 0, 120), cible = prochain.vitesseMin * Math.sqrt(adh);
      // 1,8 s pour lire/réagir, puis freinage à 14 m/s² sur sec. L'adhérence réduit
      // la vitesse cible et la décélération ; 70..420 m gardent l'annonce proche.
      const portee = borner(30 + 1.8 * v + Math.max(0, v * v - cible * cible) / (28 * adh), 70, 420);
      if (distance > portee) { etat.actuelle = null; return null; }
      const entree = p + distance;
      const tour = c.ouvert ? 0 : Math.round((entree + (Number.isFinite(c.depart) ? c.depart : 0) - prochain.debut) / L);
      actuelle = { virage: prochain, entree, fin: entree + ramener(prochain.sommet - prochain.debut, L),
        tour, cle: prochain.id + ':' + tour };
    }
    etat.actuelle = actuelle;
    const v = actuelle.virage, distance = Math.max(0, actuelle.entree - p);
    const dernier = etat.annonces.get(v.id), nouveau = dernier === undefined || actuelle.tour > dernier;
    if (nouveau) etat.annonces.set(v.id, actuelle.tour);
    return { cle: actuelle.cle, id: v.id, sens: v.sens, difficulte: v.difficulte, libelle: v.libelle,
      distance, distanceAffichee: Math.max(0, Math.round(distance / 10) * 10), nouveau };
  }

  // Web Speech : https://webaudio.github.io/web-speech-api/#speechsynthesisvoice
  // Une voix distante ou de provenance inconnue n'est jamais utilisée. Interroger
  // la liste à chaque demande accepte aussi son arrivée tardive, sans écouteur global.
  function creerVoix(hote = globalThis) {
    let synthese = null, Parole = null, courante = null, generation = 0;
    try { synthese = hote && hote.speechSynthesis; Parole = hote && hote.SpeechSynthesisUtterance; } catch (_) {}
    function choisir() {
      if (!synthese || typeof Parole !== 'function' || typeof synthese.getVoices !== 'function'
        || typeof synthese.speak !== 'function' || typeof synthese.cancel !== 'function') return null;
      try {
        const voix = Array.from(synthese.getVoices()).filter(v => v && v.localService === true && /^fr(?:-|$)/i.test(v.lang));
        return voix.find(v => v.default) || voix.find(v => /^fr-FR$/i.test(v.lang)) || voix[0] || null;
      } catch (_) { return null; }
    }
    function annuler() {
      generation++;
      if (!courante) return true;
      courante.onend = courante.onerror = null;
      try { synthese.cancel(); courante = null; return true; }
      catch (_) { return false; } // ne pas ajouter une autre phrase si l'ancienne résiste
    }
    function dire(texte, volume = 1) {
      if (!annuler()) return false;
      const voix = choisir(), niveau = Number.isFinite(volume) ? borner(volume, 0, 1) : 0;
      if (!voix || typeof texte !== 'string' || !texte.trim() || niveau === 0) return false;
      try {
        if (synthese.paused) {
          if (typeof synthese.resume !== 'function') return false;
          synthese.resume();
          if (synthese.paused) return false;
        }
        const parole = new Parole(texte.trim().slice(0, 180)), jeton = ++generation;
        parole.voice = voix; parole.lang = voix.lang; parole.volume = niveau; parole.rate = 1.05; parole.pitch = 1;
        parole.onend = parole.onerror = () => { if (generation === jeton && courante === parole) courante = null; };
        courante = parole;
        synthese.speak(parole);
        return true;
      } catch (_) { annuler(); return false; }
    }
    return { dire, annuler, disponible: () => !!choisir() };
  }

  B.virages = { planifier, lire, creerVoix, RAYON_SERRE };
})(globalThis.BITUME = globalThis.BITUME || {});
