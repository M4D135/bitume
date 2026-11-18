(function (B) {
  'use strict';
  // BITUME : coque du jeu (boucle à pas fixe, commandes, caméras, affichage, menus). Écrit par Claude.

  const DT = 1 / 120;
  const $ = id => document.getElementById(id);
  const clamp = (x, a, b) => x < a ? a : (x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const angle = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
  const ramener = (s, L) => ((s % L) + L) % L;

  // Catalogue progressif : graines originales fixes, tracés générés par circuit.js.
  const CATALOGUE = [
    { id: 'val-brule', nom: 'Val-Brûlé', lieu: 'Forêt', theme: 'foret', graine: 11, longueur: 4200 },
    { id: 'port-sable', nom: 'Port-Sable', lieu: 'Bord de mer', theme: 'cote', graine: 29, longueur: 3600 },
    { id: 'haut-col', nom: 'Haut-Col', lieu: 'Montagne', theme: 'montagne', graine: 47, longueur: 5200 },
    { id: 'lande-noire', nom: 'Lande-Noire', lieu: 'Islande · plateau volcanique', theme: 'islande', graine: 83, longueur: 4600 },
    { id: 'roche-fauve', nom: 'Roche-Fauve', lieu: 'Afrique · hauts plateaux d’ocre', theme: 'desert', graine: 107, longueur: 4800 },
    { id: 'brume-de-jade', nom: 'Brume-de-Jade', lieu: 'Asie · pics calcaires et terrasses', theme: 'asie', graine: 131, longueur: 5000 },
    { id: 'cap-sequoia', nom: 'Cap-Séquoia', lieu: 'États-Unis · falaises du Pacifique', theme: 'pacifique', graine: 157, longueur: 5200 }
  ];

  // ---------------------------------------------------------------- stockage local (commodités propres au navigateur)
  function lireStock(cle, defaut) { try { const t = localStorage.getItem(cle); return t ? JSON.parse(t) : defaut; } catch (e) { return defaut; } }
  function ecrireStock(cle, valeur) { try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) { /* stockage indisponible */ } }
  const DEFAUT = { vue: 'cockpit', vue2: 'poursuite', partage: 'haut-bas', boite: 'auto', aide: 0.35, qualite: 'auto', general: 0.8, moteur: 0.9, effets: 0.9, tours: 3, difficulte: 1, circuit: 0, champ: 60, retro: 'auto', pneus: 'slicks', tableau: 'reduit', carte: 'oui', cartePosition: 'droite', carteTaille: 'normale', demo: 'oui', vibrations: 'oui', vibrationForce: 0.5, meteo: 'aleatoire',
    anticrenelage: 'profil', ombres: 'profil', vegetation: 'profil', faune: 'profil', moment: 'jour', saison: 'ete', saisonMode: 'manuel', momentMode: 'manuel',
    secousses: (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1; } catch (e) { return 1; } })() };
  const reglages = Object.assign({}, DEFAUT, lireStock('bitume.reglages', {}));
  reglages.qualite = B.graphismes.normaliser(reglages.qualite);
  Object.assign(reglages, B.graphismes.normaliserOptions(reglages));
  reglages.moment = B.ambiance.normaliser(reglages.moment);
  reglages.saison = B.saisons.normaliser(reglages.saison);
  reglages.saisonMode = B.conditionsCourse.normaliserMode(reglages.saisonMode);
  reglages.momentMode = B.conditionsCourse.normaliserMode(reglages.momentMode);
  reglages.meteoMode = B.conditionsCourse.normaliserMode(reglages.meteoMode || (reglages.meteo === 'aleatoire' ? 'aleatoire' : 'manuel'));
  // Champ du cockpit : 69° n'a été le défaut que l'après-midi du 16/11, et David le trouve trop large (« fov moins
  // prononcé »). Une valeur restée à 69 revient une seule fois au défaut ; tout autre choix du pilote est gardé.
  if (!reglages.champRevu) { if (+reglages.champ === 69) reglages.champ = DEFAUT.champ; reglages.champRevu = true; }
  reglages.secousses = Number.isFinite(+reglages.secousses) ? clamp(+reglages.secousses, 0, 1) : DEFAUT.secousses;
  // Les anciens placements auto/haut/bas reviennent en haut à droite ; taille et visibilité sont conservées.
  for (const [cle, valeurs] of Object.entries({ carte: ['oui', 'non'], cartePosition: ['gauche', 'droite'], carteTaille: ['petite', 'normale', 'grande'] }))
    if (!valeurs.includes(reglages[cle])) reglages[cle] = DEFAUT[cle];
  const sauverReglages = () => {
    if (!session || !session.reglagesReference) ecrireStock('bitume.reglages', reglages);
  };
  // records et fantômes suivent la physique : ceux de l'essai 0.1 (avant le modèle à deux essieux) ne se comparent plus
  const PHYSIQUE = 'p9', CLE_RECORDS = 'bitume.records.' + PHYSIQUE, CLE_FANTOME = 'bitume.fantome.' + PHYSIQUE + '.';
  const records = lireStock(CLE_RECORDS, {});

  function enBase64(f32) {
    const o = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
    let t = '';
    for (let i = 0; i < o.length; i += 0x8000) t += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000));
    return btoa(t);
  }
  function deBase64(b) {
    const t = atob(b), o = new Uint8Array(t.length);
    for (let i = 0; i < t.length; i++) o[i] = t.charCodeAt(i);
    return new Float32Array(o.buffer);
  }

  // ---------------------------------------------------------------- formats
  function chrono(t) {
    if (t == null || !isFinite(t)) return '–';
    const m = Math.floor(t / 60), s = t - 60 * m;
    return m + ':' + s.toFixed(3).padStart(6, '0').replace('.', ',');
  }
  const signe = x => (x < 0 ? '−' : '+');
  function ecartTexte(e, decimales = 1) { return signe(e) + Math.abs(e).toFixed(decimales).replace('.', ','); }
  const enDemo = () => !!session && session.type === 'demo';
  const nomCourt = v => {
    const co = session && session.course;
    if (v.humain && co && (co.duo || co.enLigne) && !(v.joueur && !co.duo)) return co.enLigne ? v.nom.slice(0, 10) : 'J' + (v.id + 1);
    return v.joueur && !enDemo() ? 'Vous' : v.nom.replace(/^.\. /, '');
  };

  // ---------------------------------------------------------------- circuits
  const circuits = [];
  function circuit(i) {
    if (!circuits[i]) { const k = CATALOGUE[i]; circuits[i] = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom }); }
    return circuits[i];
  }
  function nombreVirages(c) {
    let n = 0, dans = 0, droit = 99;
    for (let i = 0; i < c.n; i++) {
      const k = c.courbure[i];
      if (Math.abs(k) > 1 / 260) {
        const sens = Math.sign(k);
        if (!dans || (sens !== dans && droit > 3) || droit >= 15) n++;
        dans = sens; droit = 0;
      } else if (Math.abs(k) < 1 / 500) droit++;
    }
    return n;
  }
  function fiche(c) {
    const droite = c.ligneDroite ? c.ligneDroite.fin - c.ligneDroite.debut : 0;
    return { km: (c.longueur / 1000).toFixed(2).replace('.', ','), virages: nombreVirages(c), droite: Math.round(droite) };
  }
  // tracé ramené dans un rectangle, pour le plan et les cartes du menu
  function plan(c, largeur, hauteur, marge) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < c.n; i++) { x0 = Math.min(x0, c.x[i]); x1 = Math.max(x1, c.x[i]); z0 = Math.min(z0, c.z[i]); z1 = Math.max(z1, c.z[i]); }
    const e = Math.min((largeur - 2 * marge) / (x1 - x0), (hauteur - 2 * marge) / (z1 - z0));
    const ox = (largeur - (x1 - x0) * e) / 2 - x0 * e, oz = (hauteur - (z1 - z0) * e) / 2 - z0 * e;
    return { e, vers: (x, z) => [ox + x * e, oz + z * e] };
  }
  function dessinerTrace(ctx, c, p, epaisseur, couleur) {
    ctx.beginPath();
    for (let i = 0; i <= c.n; i += 3) { const [x, y] = p.vers(c.x[i % c.n], c.z[i % c.n]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = epaisseur; ctx.strokeStyle = couleur; ctx.stroke();
    // ligne de départ
    const [x, y] = p.vers(c.x[0], c.z[0]), a = c.cap[0], l = epaisseur * 1.6;
    ctx.beginPath(); ctx.moveTo(x - Math.sin(a) * l, y + Math.cos(a) * l); ctx.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l);
    ctx.lineWidth = Math.max(2, epaisseur * .55); ctx.strokeStyle = '#e0301e'; ctx.stroke();
  }

  // ---------------------------------------------------------------- moteur de rendu et son
  let rendu = null, son = null, scene = null, session = null;
  let detectionGraphiqueActive = false, annulerDetection = false, contexteRenduPerdu = false;
  let restaurerDecorApresContexte = false;
  let materielRendu = 'webgl2', derniereDetection = null;
  let decorEnrichi = true; // l'outil de référence peut retrouver le décor historique pour une comparaison A/B
  // Préparation d'une séance (voir « préparation des séances ») : déclarée avant tout lancement possible. jeton :
  // une préparation plus récente ou une perte de contexte l'incrémente, et la préparation en cours s'arrête à son
  // prochain await ; interne : le lancement vient de la préparation elle-même ; precharge : prechargerSeance tourne ;
  // attente : fondu d'entrée, l'ancienne séance tourne encore ; chaud : code déjà chauffé, par type de séance et par
  // piste (« course:sec ») ; lente : une image de régime y dépasse 50 ms (chauffe resserrée).
  const prepa = { enCours: false, voile: false, attente: false, interne: false, precharge: false, jeton: 0, type: null, i: -1, saison: null,
    conditions: null, etape: null, rapport: null, dernier: null, focus: null, chaud: new Set(), periode: 1000 / 60, lente: false };
  // Création tardive : un objet né dans le chemin d'une image au lieu de la préparation. Sous le voile (ou pendant
  // prechargerSeance) elle est permise et comptée à part ; une fois la séance montrée, elle doit rester à zéro.
  function creationTardive(nom, valeur) {
    const T = session && session.tardives;
    if (T) {
      if (prepa.enCours || prepa.precharge) T.sousVoile++;
      else { T.n++; T.noms[nom] = (T.noms[nom] || 0) + 1; }
    }
    return valeur;
  }
  const canvas = $('scene'), jeu = $('jeu');
  function appliquerCarte() {
    for (const cle of ['carte', 'cartePosition', 'carteTaille'])
      if (jeu.dataset[cle] !== reglages[cle]) jeu.dataset[cle] = reglages[cle];
  }
  appliquerCarte();

  // Rien ne se coupe à distance : le plan lointain passe derrière tout le décor (au plus à 4,4 km de la piste) et la
  // brume fait la limite. Les ombres du soleil prennent tout l'atlas du moteur sur un carré de 200 m de côté.
  const PORTEE_VUE = 6000, OMBRE = 100, OMBRE_DEVANT = 76;
  // Clé du décor voulu : palier ancre, enrichissement, végétation et saison. La préparation des séances la compare à
  // la scène installée pour savoir s'il reste un décor à bâtir avant de lancer la séance.
  function voeuDecor(saisonDemandee) {
    const ancre = etatProfils.decor;
    const veut = B.graphismes.melange(ancre, 0, { decor: ancre, capacites: capacitesRendu, options: reglages }).decor;
    return { ancre, veut, vegetationQualite: decorEnrichi ? veut.vegetationQualite : 'off', saison: B.saisons.normaliser(saisonDemandee ?? reglages.saison) };
  }
  function sceneEnPlace(i, saisonDemandee, v = voeuDecor(saisonDemandee)) {
    return !!scene && scene.index === i && scene.enrichi === decorEnrichi && scene.palier === v.ancre && scene.vegetationQualite === v.vegetationQualite && scene.saison === v.saison;
  }
  function installer(i, saisonDemandee) {
    // Le décor est bâti sur un palier « ancre » (voir « profils graphiques du menu ») : la même piste ne se
    // reconstruit pas à chaque fluctuation du gouverneur, seulement quand l'ancre ou l'enrichissement change.
    const v = voeuDecor(saisonDemandee), { ancre, veut, vegetationQualite, saison } = v;
    if (sceneEnPlace(i, saisonDemandee, v)) return scene;
    const c = circuit(i), decor = B.decor.construire(c, {
      qualite: ancre,
      matieres: decorEnrichi && veut.matieres,
      vegetation: decorEnrichi && veut.vegetation,
      vegetationQualite,
      saison,
    });
    decor.atmosphere = B.graphismes.atmosphere(decor.atmosphere);
    if (B.obstacles) c.obstacles = B.obstacles.creer(decor.obstacles);
    rendu.setWorld([], [], decor.atmosphere);
    rendu.setNappes(decor.nappes);
    rendu.setLots(decor.lots);
    // plan du circuit pour l'affichage de course, dessiné une fois
    const fond = document.createElement('canvas'); fond.width = fond.height = 220;
    const p = plan(c, 220, 220, 16), ctx = fond.getContext('2d');
    dessinerTrace(ctx, c, p, 9, 'rgba(10,12,15,.9)'); dessinerTrace(ctx, c, p, 4.5, '#d9d2c3');
    // profondeur du volume d'ombre : un point du sol au bord du carré est décalé de OMBRE × cotangente de la hauteur du soleil
    const sol = decor.atmosphere.sunDirection, sinus = sol[1] / Math.hypot(sol[0], sol[1], sol[2]);
    const ombre = { extent: OMBRE, depth: 2 * (OMBRE * Math.sqrt(Math.max(0, 1 - sinus * sinus)) / Math.max(.25, sinus) + 30) };
    scene = { index: i, enrichi: decorEnrichi, palier: ancre, vegetationQualite, saison, c, decor, fond, plan: p, ombre };
    return scene;
  }

  // ---------------------------------------------------------------- séances : vitrine (écran titre), démo, course, chrono
  // Vitrine et démo : les douze voitures sont à l'IA. La vitrine tourne sans fin derrière les menus ; la démo est
  // une vraie course de trois tours, filmée par le réalisateur, que la suivante remplace sur le circuit d'après.
  const TOURS_DEMO = 3, PILOTE_DEMO = 'N. Aubrac';
  let graineCourse = (Date.now() >>> 7) & 0xffff;
  let conditionsPreparation = null, conditionsPreparationCle = '', conditionsNumero = 0;
  let conditionsControle = null, conditionsEnCours = null;
  function lancer(type, i, enl, conditionsChoisies) {
    // un lancement direct (référence, banc, démarrage, détection) remplace ce qui se préparait
    if (prepa.enCours && !prepa.interne) annulerPreparation();
    restaurerReference();
    if (B.vitre) { if (vitreVue) B.vitre.effacer(vitreVue); if (vitreVue2) B.vitre.effacer(vitreVue2); }
    // la séance qui meurt rend ses corps PhysX : la démo enchaîne les courses sans fin et laisserait un monde
    // orphelin par course (les pièces détachées y vivent douze secondes chacune)
    if (session && session.fx) B.traces.liberer(session.fx);
    // en ligne, une machine qui porte deux pilotes joue en écran partagé, comme une course à deux
    if (enl && enl.locaux.length === 2) type = 'duo';
    const conditions = enl || conditionsChoisies || conditionsDuDepart();
    const sc = installer(i, B.saisons.normaliser(conditions.saison)), c = sc.c, demo = type === 'demo', auto = demo || type === 'vitrine', duo = type === 'duo';
    // enl : course en ligne (même graine, mêmes réglages des deux côtés ; voir « jeu en ligne »)
    const course = B.course.creer(c, {
      mode: type === 'chrono' ? 'chrono' : 'course', tours: enl ? enl.tours : type === 'vitrine' ? 99 : demo ? TOURS_DEMO : reglages.tours,
      difficulte: enl ? enl.difficulte : auto ? 2 : reglages.difficulte, rivaux: 11, graine: enl ? enl.graine : ++graineCourse, placeJoueur: type === 'vitrine' ? 5 : demo ? 6 : 8,
      humains: enl ? { noms: enl.humains.map(h => h.nom), locaux: enl.locaux, hote: enl.role === 'hote', enLigne: true } : duo ? { noms: ['Joueur 1', 'Joueur 2'], locaux: [0, 1], hote: true, enLigne: false } : null
    });
    if (auto) course.joueur.ia.hab = 0.965;
    if (demo) course.joueur.nom = PILOTE_DEMO;
    if (type === 'chrono') {
      const f = lireStock(CLE_FANTOME + CATALOGUE[i].id, null);
      // fantôme gardé : seulement pour le même tracé (la longueur change si le générateur change)
      if (f && f.b64 && f.n > 1 && f.temps > 0 && f.longueur === c.longueur) {
        try { const d = deBase64(f.b64); if (d.length >= 4 * f.n) course.fantome = { meilleur: { donnees: d, n: f.n }, temps: f.temps }; } catch (e) { /* fantôme illisible : ignoré */ }
      }
    }
    const meteoInit = B.meteo.depuisReel(conditions.mReelle) || B.meteo.pour(conditions.meteo) || B.meteo.initial(enl ? enl.graine : graineCourse);
    // Pneus : le joueur roule sur ceux de la préparation (présélectionnés selon la météo, qu'il peut changer) ; les
    // rivaux sur ceux que conseille la piste au départ. La caisse les montre (voiture.js) et la conduite les sent.
    const conseil = B.conduite.pneusConseilles(B.conduite.eauSurPiste(meteoInit)), joue = type === 'course' || type === 'chrono' || duo;
    for (const v of course.voitures) {
      v.etat.pneus = enl && v.humain ? (B.conduite.PNEUS[enl.pneus && enl.pneus[v.id]] ? enl.pneus[v.id] : conseil) : v.joueur && joue && B.conduite.PNEUS[reglages.pneus] ? reglages.pneus : conseil;
      v.livree.pneus = v.etat.pneus;
    }
    if (joue) for (const h of duo ? [H, H2] : [H]) { h['h-pneus'].textContent = NOMS_PNEUS[course.joueur.etat.pneus]; h['c-pneus'].dataset.pneus = course.joueur.etat.pneus; }
    const S = {
      type, i, course, c, modeles: course.voitures.map(v => B.voiture.modele(v.livree)),
      prec: [], cour: [], sortie: [], acc: 0, tele: { poste: null, alea: graine32(course.voitures.length * 7 + i) },
      camCap: null, profil: new Float32Array(Math.ceil(c.longueur / 10) + 2).fill(-1), profilMeilleur: null,
      distances: new Float64Array(course.voitures.length).fill(-1), vRel: new Float64Array(course.voitures.length),
      contresens: 0, bloque: 0, finA: null, resultats: false, derniereJauge: -9, positionPrec: 0, tempsAffiche: null,
      real: demo ? B.realisateur.creer(graineCourse) : null, planVu: null, suivie: 0, enchaine: false,
      fx: B.traces.creer(course.voitures.length, graineCourse),
      meteo: meteoInit, conditions,
      nature: { ambiance: B.ambiance.creer(sc.decor.atmosphere, i === 2), moment: B.ambiance.normaliser(conditions.moment),
        horlogeReelle: horlogePartagee(conditions.horlogeReelle), dateDepart: enl && Number.isFinite(enl.dateDepart) ? enl.dateDepart : null,
        saison: sc.decor.saison || B.saisons.profil(sc.saison, CATALOGUE[i].theme), revisionRendu: -1, faune: null, effetsSaison: null, aurores: null },
      fauneVue: null, saisonVue: null, auroresVue: null, vitreContexte: null,
      // créations tardives : objets nés dans le chemin d'une image au lieu de la préparation (doit rester à zéro)
      tardives: { n: 0, sousVoile: 0, noms: {} },
    };
    if (enl) {
      S.enLigne = { T0: enl.T0, role: enl.role, humains: enl.humains }; S.enLigneOrigine = true;
      course.distant = (v, dt) => appliquerDistant(S, v, dt);
      EL.recus.clear(); EL.corr.clear(); EL.pasEnvoi = 0;
    }
    // Écran partagé (David, 16/11 : « multi en écran splitté local, deux manettes, l'un sur l'autre ou côte à côte ») :
    // la vue du joueur 2 a son propre état de caméra, d'éclair et d'affichage, le reste vient de la séance.
    if (duo) S.vueJ2 = Object.assign(Object.create(S), { camCap: null, tete: null, secousse: 0, eclair: 0, lumiere: 1, sol: null, tele: { poste: null, alea: graine32(31 + i) },
      distances: new Float64Array(course.voitures.length).fill(-1), vRel: new Float64Array(course.voitures.length),
      suivie: course.duo ? course.voitures.filter(v => v.joueur)[1].id : 1, vue: reglages.vue2, positionPrec: 0, derniereJauge: -9, prochainClassement: 0, profilMeilleur: null, fauneVue: null, saisonVue: null, auroresVue: null, vitreContexte: null });
    S.locaux = course.voitures.filter(v => v.joueur).map(v => v.id);   // voitures conduites ici (une, ou deux à l'écran partagé)
    jeu.dataset.partage = duo ? (reglages.partage === 'cote' ? 'cote' : 'haut-bas') : '';
    delete $('hud').dataset.reduit; delete hud2.dataset.reduit;
    remplirPoses(S.cour, course); remplirPoses(S.prec, course);
    session = S;
    tactile(!auto && !duo);
    // hors préparation (référence, banc, démarrage), tout ce que la séance créerait à sa première image naît ici
    if (!prepa.interne) prechargerSeance(S);
    return S;
  }
  function graine32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // position et attitude de chaque voiture dans le monde, gardées pour l'interpolation entre deux pas
  function remplirPoses(liste, co) {
    const c = co.c;
    co.voitures.forEach((v, k) => {
      const et = v.etat, e = B.circuit.echantillon(c, et.s), sa = Math.sin(e.cap), ca = Math.cos(e.cap);
      const p = liste[k] || (liste[k] = {});
      p.x = e.x - sa * et.d; p.y = et.y; p.z = e.z + ca * et.d;
      p.cap = e.cap + et.psi + et.beta; p.tangage = et.tangage; p.roulis = et.roulis;
      p.braquage = (et.braquage || 0) * 2.2; p.roule = v.roule || 0; // braquage réel des roues, accentué pour se voir
    });
  }
  function melange(a, b, t, sortie) {
    sortie.x = lerp(a.x, b.x, t); sortie.y = lerp(a.y, b.y, t); sortie.z = lerp(a.z, b.z, t);
    sortie.cap = a.cap + angle(b.cap - a.cap) * t; sortie.tangage = lerp(a.tangage, b.tangage, t);
    sortie.roulis = lerp(a.roulis, b.roulis, t); sortie.braquage = lerp(a.braquage, b.braquage, t);
    sortie.roule = lerp(a.roule || 0, b.roule || 0, t);
    return sortie;
  }

  // ---------------------------------------------------------------- commandes
  const touches = new Set();
  const impulsions = { haut: false, bas: false };
  const pad = { precedent: [], volant: 0, gaz: 0, frein: 0, derive: false, actif: false, manette: null, deriveEtat: null, rumbleF: -1, rumbleS: -1, rumbleT: 0, choc: 0, passe: 0 };
  const pad2 = { precedent: [], volant: 0, gaz: 0, frein: 0, derive: false, manette: null, deriveEtat: null, rumbleF: -1, rumbleS: -1, rumbleT: 0, choc: 0, passe: 0 };   // manette du joueur 2 (écran partagé)
  let nbManettes = 0, manettes = [];
  const impulsions2 = { haut: false, bas: false };
  // Commandes de chaque joueur (David, 16/11 : « choix manette, clavier ou souris, et gérer les touches de chacun » ;
  // « clavier normal pour un et pavé numérique pour l'autre ») : appareil choisi (auto, manette, clavier, souris) et
  // jusqu'à deux touches par action, réglables ; positions physiques des touches (e.code).
  const ACTIONS = ['gaz', 'frein', 'gauche', 'droite', 'derive', 'haut', 'bas', 'vue'];
  const TOUCHES_DEFAUT = [
    { gaz: ['ArrowUp', 'KeyW'], frein: ['ArrowDown', 'KeyS'], gauche: ['ArrowLeft', 'KeyA'], droite: ['ArrowRight', 'KeyD'], derive: ['Space', 'ShiftLeft', 'ShiftRight'], haut: ['KeyE'], bas: ['KeyQ'], vue: ['KeyC'] },
    { gaz: ['Numpad8'], frein: ['Numpad5', 'Numpad2'], gauche: ['Numpad4'], droite: ['Numpad6'], derive: ['Numpad0'], haut: ['Numpad9'], bas: ['Numpad7'], vue: ['NumpadEnter'] }
  ];
  const commande = n => (reglages.commandes && reglages.commandes[n]) || 'auto';
  const toucheDe = (n, action) => (reglages.touches && reglages.touches[n] && reglages.touches[n][action]) || TOUCHES_DEFAUT[n][action];
  const appuieSur = (n, action) => toucheDe(n, action).some(c => touches.has(c));
  // la souris va au joueur qui l'a choisie ; en Auto, au joueur seul, ou au joueur 2 dans une course à deux
  const sourisPour = (n, duo = !!session && session.type === 'duo') => { const c = commande(n); return c === 'souris' || (c === 'auto' && (duo ? n === 1 && commande(0) !== 'souris' : n === 0)); };
  const souris = { active: false, x: 0, largeur: 1, gaz: false, frein: false, derive: false };
  const volantSouris = () => { const x = (souris.x - souris.largeur / 2) / (souris.largeur * .3); return Math.abs(x) < .03 ? 0 : Math.max(-1, Math.min(1, x)); };
  // manettes de la course à deux selon le choix de chacun : deux pour deux ; une seule va au joueur 2, sauf si le joueur
  // 1 l'a demandée et pas lui
  const assigner = c => {
    const v0 = commande(0) === 'auto' || commande(0) === 'manette', v1 = commande(1) === 'auto' || commande(1) === 'manette';
    if (v0 && v1) return c.length >= 2 ? [c[0], c[1]] : c.length === 1 ? (commande(0) === 'manette' && commande(1) !== 'manette' ? [c[0], null] : [null, c[0]]) : [null, null];
    return [v0 ? c[0] || null : null, v1 ? c[0] || null : null];
  };
  const doigt = { volant: 0, gaz: false, frein: false, derive: false, id: null, x0: 0 };
  let analogique = false;
  let relacherTactile = () => {};

  // conduite par position physique des touches (e.code : ZQSD et WASD au même endroit) ; vue, son et pause par lettre
  addEventListener('keydown', e => {
    const course = enCourse(), lettre = (e.key || '').toLowerCase();
    if (e.repeat) { if (course) e.preventDefault(); return; }
    // F3 : volet de mesures (FPS, intervalle d'image, CPU, GPU mesuré, draw calls, triangles, voitures)
    if (e.code === 'F3') { B.mesures.afficher(!B.mesures.actif, rendu); e.preventDefault(); return; }
    dernierGeste = performance.now();
    // démo : n'importe quelle touche, sauf une touche morte seule, ramène à l'écran titre
    if (ecran === 'demo') { if (!/^(Shift|Control|Alt|AltGraph|Meta|OS|CapsLock|Fn)$/.test(e.key || '')) { e.preventDefault(); activerSon(); sortirDemo(); } return; }
    activerSon();
    if (course && (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) || [0, 1].some(n => ACTIONS.some(a => toucheDe(n, a).includes(e.code))))) e.preventDefault();
    touches.add(e.code);
    if (e.code === 'Escape' || lettre === 'p') {
      if (course || ecran === 'pause') { basculerPause(); e.preventDefault(); }
      else if (e.code === 'Escape') retour();
      return;
    }
    if (!course) return;
    analogique = false;
    if (commande(0) === 'auto' || commande(0) === 'clavier') {
      if (toucheDe(0, 'haut').includes(e.code)) impulsions.haut = true;
      if (toucheDe(0, 'bas').includes(e.code)) impulsions.bas = true;
      if (toucheDe(0, 'vue').includes(e.code)) changerVue();
    }
    if (session && session.type === 'duo' && (commande(1) === 'auto' || commande(1) === 'clavier')) {
      if (toucheDe(1, 'haut').includes(e.code)) impulsions2.haut = true;
      if (toucheDe(1, 'bas').includes(e.code)) impulsions2.bas = true;
      if (toucheDe(1, 'vue').includes(e.code)) changerVue2();
    }
    if (lettre === 'm') couperSon();
  });
  addEventListener('keyup', e => touches.delete(e.code));
  // Souris (David, 16/11 : « ou alors souris aussi, comme le vrai Vroom », refaite ici) : le pointeur à gauche ou à
  // droite du milieu de l'écran tourne le volant (plein braquage à 30 % de la largeur), bouton gauche : gaz, droit :
  // frein, milieu ou latéraux : dérive, molette : rapports. En Auto, elle compte après un clic en course.
  const boutonsSouris = e => { souris.gaz = !!(e.buttons & 1); souris.frein = !!(e.buttons & 2); souris.derive = !!(e.buttons & 28); };
  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || !enCourse()) return;
    if (!sourisPour(0) && !(session && session.type === 'duo' && sourisPour(1))) return;
    souris.active = true; souris.x = e.clientX; souris.largeur = innerWidth || 1; boutonsSouris(e); activerSon();
  });
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; souris.x = e.clientX; souris.largeur = innerWidth || 1; if (souris.active) boutonsSouris(e); }, { passive: true });
  addEventListener('pointerup', e => { if (e.pointerType === 'mouse') boutonsSouris(e); });
  addEventListener('contextmenu', e => { if (enCourse() || ecran === 'pause') e.preventDefault(); });
  addEventListener('wheel', e => {
    if (!enCourse() || !souris.active || !e.deltaY) return;
    const imp = session && session.type === 'duo' && sourisPour(1) ? impulsions2 : sourisPour(0) ? impulsions : null;
    if (!imp) return;
    if (e.deltaY < 0) imp.haut = true; else imp.bas = true;
  }, { passive: true });
  let pauseAuto = true; // coupée par BITUME_JEU.pauseAuto = false, pour les captures et le banc
  let pilotageAuto = false; // BITUME_JEU.pilotageAuto = true : l'ordinateur conduit la voiture du joueur en temps réel (essais en ligne)
  let cameraEssai = null; // BITUME_JEU.camera = (pose, camera) => ({ pos, yaw, pitch, fov }) : vue libre pour les captures
  addEventListener('blur', () => { touches.clear(); souris.gaz = souris.frein = souris.derive = false; relacherTactile(); if (pauseAuto && enCourse()) basculerPause(true); });
  document.addEventListener('visibilitychange', () => {
    oublierIntervalle();
    if (document.hidden) relacherTactile();
    if (pauseAuto && document.hidden && enCourse()) basculerPause(true);
    if (son) son.musique(!document.hidden && ecran === 'titre'); // onglet caché : le minuteur du thème serait bridé
  });
  addEventListener('focus', oublierIntervalle);
  addEventListener('pointerdown', activerSon, { passive: true });
  // Gestes : ils remettent à zéro l'attente de la démo sur l'écran titre ; pendant la démo, le premier ramène au
  // titre et ne compte pas comme un clic sur le menu qui revient.
  let dernierGeste = performance.now(), avalerJusque = 0;
  addEventListener('pointerdown', e => {
    dernierGeste = performance.now();
    if (ecran === 'demo') { activerSon(); e.preventDefault(); e.stopPropagation(); sortirDemo(); }
  }, { capture: true });
  addEventListener('click', e => { if (performance.now() < avalerJusque) { e.preventDefault(); e.stopPropagation(); } avalerJusque = 0; }, { capture: true });
  addEventListener('pointermove', () => { if (ecran === 'titre') dernierGeste = performance.now(); }, { capture: true, passive: true });
  addEventListener('wheel', () => { dernierGeste = performance.now(); if (ecran === 'demo') sortirDemo(); }, { capture: true, passive: true });

  function lireManette() {
    let liste = [];
    try { if (navigator.getGamepads) liste = navigator.getGamepads() || []; } catch (e) { /* accès non autorisé : commandes neutres, le rendu continue */ }
    const ancienne = pad.manette, etatDerive = pad.deriveEtat, ecranLecture = ecran;
    // À deux, garder les mêmes affectations durant toute la séance, réglages et résultats compris : en ligne,
    // la simulation continue derrière certains menus. Chaque manette affectée peut y naviguer.
    const connectees = [];
    for (const candidate of liste) if (candidate && candidate.connected) connectees.push(candidate);
    nbManettes = connectees.length; manettes = connectees;
    const duoJeu = !!session && session.type === 'duo';
    const [p1, p2] = duoJeu ? assigner(connectees) : [connectees[0] || null, null];
    if (duoJeu || pad2.manette) lireManette2(p2);
    const p = p1;
    const change = (ancienne?.index ?? -1) !== (p?.index ?? -1) || ancienne?.id !== p?.id;
    if (change) {
      // Une manette perdue ne relâche pas une dérive chargée en déclenchant un turbo involontaire.
      // Seul l'état auquel ses commandes ont été appliquées compte ; une nouvelle séance reste intacte.
      const clavier = commande(0) === 'auto' || commande(0) === 'clavier';
      if (ancienne && etatDerive === session?.course?.joueur?.etat && etatDerive?.derive?.actif &&
          !doigt.derive && !(clavier && appuieSur(0, 'derive')) && !(souris.active && sourisPour(0) && souris.derive))
        B.conduite.annulerDerive(etatDerive, true);
      pad.precedent.length = 0; pad.deriveEtat = null;
    }
    pad.actif = false; pad.manette = p;
    pad.volant = pad.gaz = pad.frein = 0; pad.derive = false;
    if (p) {
      const b = i => p.buttons[i] ? (p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0)) : 0;
      const appuye = i => b(i) > .5, nouveau = i => appuye(i) && !pad.precedent[i];
      // À la connexion, les boutons déjà tenus ne sont pas de nouveaux appuis (pause, menus, rapports).
      if (change) for (let i = 0; i < p.buttons.length; i++) pad.precedent[i] = appuye(i);
      if (ecran === 'demo' || ecran === 'titre') {
        const geste = p.buttons.some((x, i) => appuye(i)) || Array.from(p.axes).some(a => Math.abs(a) > .5);
        if (geste) dernierGeste = performance.now();
        // démo : un bouton ou un manche ramène au titre ; le bouton reste « déjà appuyé » pour ne rien valider au retour
        if (ecran === 'demo') { for (let i = 0; i < p.buttons.length; i++) pad.precedent[i] = appuye(i); if (geste) { activerSon(); sortirDemo(); } return; }
      }
      // zone morte de 0,06 puis exposant 1,22 : vif au centre sans à-coup, point d'accroche trouvé plus tôt, plein
      // volant au bout de la course (16/11 : « précision »)
      const ax = p.axes[0] || 0, morte = .06, x = Math.abs(ax) < morte ? 0 : Math.sign(ax) * (Math.abs(ax) - morte) / (1 - morte);
      pad.volant = Math.sign(x) * Math.pow(Math.abs(x), 1.22);
      pad.gaz = b(7); pad.frein = b(6); pad.derive = appuye(0) || appuye(2);
      const accepte = commande(0) === 'auto' || commande(0) === 'manette';
      if (enCourse() && ecran === ecranLecture && accepte) {
        if (nouveau(5)) impulsions.haut = true;
        if (nouveau(4)) impulsions.bas = true;
        if (nouveau(3)) changerVue();
      }
      // Si J2 vient de changer d'écran, consommer aussi les fronts de J1 sans agir une seconde fois.
      if (ecran === ecranLecture) {
        if (nouveau(9)) {
          if (enCourse() || ecran === 'pause') basculerPause();
          else if (ecran === 'titre') { modePrepa = 'course'; activerSon(); aller('preparation'); }
          else if (ecran === 'preparation') { const b = $('b-depart'); if (b) { activerSon(); b.click(); } }
          else naviguerManette(nouveau);
        } else if (!enCourse()) naviguerManette(nouveau);
      }
      for (let i = 0; i < p.buttons.length; i++) pad.precedent[i] = appuye(i);
      if (accepte && (Math.abs(pad.volant) > .05 || pad.gaz > .05 || pad.frein > .05)) { pad.actif = true; analogique = true; activerSon(); }
      return;
    }
  }

  // vibration manette (David, 14/11) : un vrai système continu, pas de simples déclenchements. Le moteur fait
  // vibrer les haut-parleurs de la manette selon son régime (de plus en plus fort en approchant la zone rouge,
  // davantage en charge), la route ronronne selon la vitesse, les vibreurs martèlent, l'herbe trépigne, le
  // patinage et la glisse de l'arrière sifflent sous les doigts, et les chocs déclenchent un pic qui retombe.
  // Moteur lourd (grave) à droite, effets légers (aigus) à gauche ; rien si la manette ne sait pas vibrer.
  function secouerManette(faible, fort, P = pad) {
    const p = P.manette;
    faible = clamp(faible || 0, 0, 1); fort = clamp(fort || 0, 0, 1);
    if (!p || !p.vibrationActuator || !p.vibrationActuator.playEffect) return;
    const maintenant = performance.now();
    // le moteur à effet « dual-rumble » s'éteint seul au bout de sa durée : on le reprogramme au moins toutes
    // les 40 ms pour tenir un grondement continu, et plus vite encore dès que l'intensité bouge (choc, vibreur)
    if (Math.abs(faible - P.rumbleF) < .05 && Math.abs(fort - P.rumbleS) < .05 && maintenant - P.rumbleT < 40) return;
    P.rumbleF = faible; P.rumbleS = fort; P.rumbleT = maintenant;
    try {
      const effet = p.vibrationActuator.playEffect('dual-rumble', { startDelay: 0, duration: 90, weakMagnitude: faible, strongMagnitude: fort });
      if (effet && typeof effet.catch === 'function') effet.catch(() => {});
    } catch (e) { /* manette sans vibration */ }
  }

  // construit l'intensité continue (faible = aigu, fort = grave) à partir de l'état de la voiture et des
  // événements du pas ; les chocs alimentent un pic qui décroît image après image
  function vibrationManette(et, ev, horloge, P = pad, id = 0) {
    const PR = B.conduite.PARAMS;
    // pics transitoires des chocs et contacts, plafonnés et qui retombent ; le passage de rapport donne un coup sec
    P.choc = Math.max(0, (P.choc || 0) - DT * 2.4);
    P.passe = Math.max(0, (P.passe || 0) - DT * 3.4);
    for (const e of ev) {
      if (e.type === 'choc' && e.id === id) P.choc = Math.max(P.choc, clamp(((e.force || 0) - 2) / 28, 0, .9));
      else if (e.type === 'contact' && (e.a === id || e.b === id)) P.choc = Math.max(P.choc, clamp(((e.force || 0) - 2) / 28, 0, .7));
      else if ((e.type === 'roue' || e.type === 'casse') && e.id === id) P.choc = Math.max(P.choc, .85);
      else if (e.repositionnement && e.id === id) P.choc = 0;
    }
    // grondement du moteur : doux au ralenti, il monte progressivement vers la zone rouge sans jamais saturer
    const r = clamp((et.regime - PR.ralenti) / (PR.maxUtile - PR.ralenti), 0, 1);
    const charge = .25 + .75 * (et.gaz || 0);
    const moteur = .05 + .7 * r * r * charge;
    const zoneRouge = r > .97 ? (Math.sin(horloge * 50) > 0 ? .2 : 0) : 0;   // le rupteur crépite à peine en haut
    // route, vibreurs, herbe, patinage, glisse — tous en dessous de leur maximum pour rester fins
    const route = clamp(Math.abs(et.v) / 90, 0, 1);
    const martellement = et.vibreur ? .5 + .5 * Math.sin(horloge * 40) : 0;
    const herbe = et.surface === 'herbe' ? clamp(Math.abs(et.v) / 26, 0, 1) : 0;
    const patinage = clamp(et.patinage / .35, 0, 1);
    const blocage = clamp(et.blocage / .35, 0, 1);
    const glisse = clamp(Math.abs(et.glisseAr) / .5, 0, 1);
    let faible = route * .16 + patinage * .5 + blocage * .38 + glisse * .3 + herbe * .3 + martellement * .42 + zoneRouge + moteur * .35;
    let fort = moteur * 1.0 + route * .16 + herbe * .42 + martellement * .5 + (P.choc || 0) * .85 + (P.passe || 0) * .5;
    // mise en forme : une courbe en puissance garde le bas de l'échelle subtil, puis la puissance maître du réglage
    const f = clamp(reglages.vibrationForce != null ? +reglages.vibrationForce : .5, 0, 1);
    faible = Math.pow(clamp(faible, 0, 1), 1.25) * f;
    fort = Math.pow(clamp(fort, 0, 1), 1.25) * f;
    if (faible < .04) faible = 0;   // sous ce seuil, la manette reste parfaitement silencieuse
    if (fort < .04) fort = 0;
    return [faible, fort];
  }


  // Météo et pluie projetée : les secondes viennent du rendu, zéro pendant une pause.
  function majMeteo(S, dt) { return B.meteo.avancer(S, dt); }
  let pluieVue = null, pluieVue2 = null, vitreVue = null, vitreVue2 = null;
  const METEO_ABRI = { pluie: 0, nuage: 0, eclair: 0, mouille: 0, ventX: 0, ventZ: 0, t: 0 };
  function precipitationsNeige(S) {
    if (!S.nature || CATALOGUE[S.i].theme === 'cote') return 0;
    return (S.meteo.reel ? S.meteo.neige : S.nature.saison && S.nature.saison.neige) ? S.meteo.pluie || 0 : 0;
  }
  function dessinerMeteo(S, dt, cam, vue, profil) {
    // à deux, les gouttes du joueur 2 tombent sur sa moitié (toile #meteo2)
    const deux = S !== session;
    if (deux && !pluieVue2) pluieVue2 = creationTardive('pluie', B.meteo.creerPluie($('meteo2')));
    if (!deux && !pluieVue) pluieVue = creationTardive('pluie', B.meteo.creerPluie($('meteo')));
    // sous la voûte du tunnel, il ne pleut pas : la caméra décide, sinon les gouttes disparaissent pendant que la
    // vue extérieure montre encore la pluie
    const abri = !VUES_DEHORS.has(vue) && sousLaVoute(S.course.c, cam.pos), neige = precipitationsNeige(S);
    (deux ? pluieVue2 : pluieVue).dessiner(abri || neige > 0 ? Object.assign(METEO_ABRI, { t: S.meteo.t }) : S.meteo, cam, dt, { cockpit: vue === 'cockpit', dpr: window.devicePixelRatio || 1 });
    if (B.vitre) {
      if (deux && !vitreVue2) vitreVue2 = creationTardive('vitre', B.vitre.creer($('vitre2')));
      if (!deux && !vitreVue) vitreVue = creationTardive('vitre', B.vitre.creer($('vitre')));
      const contexte = S.vitreContexte || (S.vitreContexte = creationTardive('contexteVitre', {}));
      contexte.pluie = neige > 0 ? 0 : S.meteo.pluie || 0; contexte.neige = neige;
      contexte.ventX = S.meteo.ventX || 0; contexte.ventZ = S.meteo.ventZ || 0;
      const voiture = S.course.voitures[S.suivie || 0] || S.course.joueur;
      contexte.vitesse = Math.abs(voiture.etat.v || 0); contexte.qualite = profil.palier;
      contexte.actif = ecran === 'course' || ecran === 'demo'; contexte.abri = abri;
      contexte.dpr = window.devicePixelRatio || 1;
      B.vitre.mettreAJour(deux ? vitreVue2 : vitreVue, dt, contexte);
    }
  }

  // menus à la manette : croix pour se déplacer (gauche, droite règlent un curseur), A valide, B revient
  function naviguerManette(nouveau, manette = pad.manette) {
    const zone = $(ecran); if (!zone || zone.hidden) return;
    B.navigationMenu.naviguer(zone, nouveau, { pad: manette, temps: performance.now(), activer: activerSon,
      retour: () => ecran === 'pause' ? basculerPause() : retour() });
  }

  // Deuxième manette : mêmes rapports et protection de dérive que pour le joueur 1 ; son clavier reste indépendant.
  function lireManette2(p) {
    const ancienne = pad2.manette, etatDerive = pad2.deriveEtat;
    const change = (ancienne?.index ?? -1) !== (p?.index ?? -1) || ancienne?.id !== p?.id;
    if (change) {
      // En ligne, le deuxième pilote local peut conduire une autre voiture que la n° 1. Ne toucher qu'à la
      // dérive réellement commandée par cette manette, sauf si son clavier ou sa souris la maintient encore.
      const etatJ2 = session?.course?.voitures?.[session?.locaux?.[1]]?.etat;
      const clavier = commande(1) === 'auto' || commande(1) === 'clavier';
      if (ancienne && etatDerive === etatJ2 && etatDerive?.derive?.actif &&
          !(clavier && appuieSur(1, 'derive')) && !(souris.active && sourisPour(1) && souris.derive))
        B.conduite.annulerDerive(etatDerive, true);
      pad2.precedent.length = 0; pad2.deriveEtat = null;
    }
    pad2.manette = p; pad2.volant = pad2.gaz = pad2.frein = 0; pad2.derive = false;
    if (!p) { pad2.precedent.length = 0; return; }
    const b = i => p.buttons[i] ? (p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0)) : 0, appuye = i => b(i) > .5, nouveau = i => appuye(i) && !pad2.precedent[i];
    if (change) for (let i = 0; i < p.buttons.length; i++) pad2.precedent[i] = appuye(i);
    const ax = p.axes[0] || 0, morte = .06, x = Math.abs(ax) < morte ? 0 : Math.sign(ax) * (Math.abs(ax) - morte) / (1 - morte);
    pad2.volant = Math.sign(x) * Math.pow(Math.abs(x), 1.22);
    pad2.gaz = b(7); pad2.frein = b(6); pad2.derive = appuye(0) || appuye(2);
    if (ecran === 'course') {
      if (nouveau(5)) impulsions2.haut = true;
      if (nouveau(4)) impulsions2.bas = true;
      if (nouveau(3)) changerVue2();
    }
    if (nouveau(9)) { activerSon(); basculerPause(); }
    else if (!enCourse()) naviguerManette(nouveau, p);
    for (let i = 0; i < p.buttons.length; i++) pad2.precedent[i] = appuye(i);
    if (Math.abs(pad2.volant) > .05 || pad2.gaz > .05 || pad2.frein > .05) activerSon();
  }
  function commandesJoueur2() {
    let gaz = 0, frein = 0, volant = 0, derive = false, analog = false;
    const c1 = commande(1), clavier = c1 === 'auto' || c1 === 'clavier', manette = c1 === 'auto' || c1 === 'manette';
    if (clavier) {
      if (appuieSur(1, 'gaz')) gaz = 1;
      if (appuieSur(1, 'frein')) frein = 1;
      if (appuieSur(1, 'gauche')) volant -= 1;
      if (appuieSur(1, 'droite')) volant += 1;
      derive = appuieSur(1, 'derive');
    }
    if (c1 === 'auto' && souris.active && sourisPour(1) && (gaz || frein || volant || Math.abs(pad2.volant) > .05 || pad2.gaz > .05)) souris.active = false;
    if (manette && pad2.manette) {
      gaz = Math.max(gaz, pad2.gaz); frein = Math.max(frein, pad2.frein);
      if (Math.abs(pad2.volant) > Math.abs(volant)) { volant = pad2.volant; analog = true; }
      derive = derive || pad2.derive;
    }
    if (souris.active && sourisPour(1)) {
      gaz = Math.max(gaz, souris.gaz ? 1 : 0); frein = Math.max(frein, souris.frein ? 1 : 0);
      const vs = volantSouris(); if (Math.abs(vs) > Math.abs(volant)) volant = vs;
      derive = derive || souris.derive; analog = true;
    }
    pad2.deriveEtat = manette && pad2.manette && pad2.derive ? session?.course?.voitures?.[session?.locaux?.[1]]?.etat : null;
    const cmd = { gaz, frein, volant, derive, marcheArriere: true, haut: impulsions2.haut, bas: impulsions2.bas, boite: reglages.boite, aide: reglages.aide, guidage: analog ? 0 : .15 };
    impulsions2.haut = impulsions2.bas = false;
    return cmd;
  }
  function commandesJoueur() {
    let gaz = 0, frein = 0, volant = 0, derive = false;
    const c0 = commande(0), clavier = c0 === 'auto' || c0 === 'clavier', manette = c0 === 'auto' || c0 === 'manette';
    if (clavier) {
      if (appuieSur(0, 'gaz')) gaz = 1;
      if (appuieSur(0, 'frein')) frein = 1;
      if (appuieSur(0, 'gauche')) volant -= 1;
      if (appuieSur(0, 'droite')) volant += 1;
      derive = appuieSur(0, 'derive');
    }
    // en Auto, le clavier ou la manette reprennent la main sur la souris de ce joueur seulement
    if (c0 === 'auto' && souris.active && sourisPour(0) && (gaz || frein || volant || pad.actif)) souris.active = false;
    if (manette) {
      gaz = Math.max(gaz, pad.gaz); frein = Math.max(frein, pad.frein);
      if (Math.abs(pad.volant) > Math.abs(volant)) volant = pad.volant;
      derive = derive || pad.derive;
    }
    gaz = Math.max(gaz, doigt.gaz ? 1 : 0); frein = Math.max(frein, doigt.frein ? 1 : 0);
    if (Math.abs(doigt.volant) > Math.abs(volant)) volant = doigt.volant;
    derive = derive || doigt.derive;
    if (souris.active && sourisPour(0)) {
      gaz = Math.max(gaz, souris.gaz ? 1 : 0); frein = Math.max(frein, souris.frein ? 1 : 0);
      const vs = volantSouris(); if (Math.abs(vs) > Math.abs(volant)) volant = vs;
      derive = derive || souris.derive; analogique = true;
    }
    pad.deriveEtat = manette && pad.manette && pad.derive ? session?.course?.joueur?.etat : null;
    // aide au volant (rattrape les glisses) au niveau choisi ; guidage le long du virage au clavier et au doigt seulement
    const cmd = { gaz, frein, volant, derive, marcheArriere: true, haut: impulsions.haut, bas: impulsions.bas, boite: reglages.boite, aide: reglages.aide, guidage: analogique ? 0 : .15 };
    impulsions.haut = impulsions.bas = false;
    return cmd;
  }

  // commandes tactiles : volant en glissant le pouce à gauche, pédales et dérive à droite
  const estTactile = navigator.maxTouchPoints > 0 && typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches);
  if (estTactile) document.body.classList.add('tactile');
  if (/Xbox/i.test(navigator.userAgent || '')) $('aide-console').hidden = false;
  function tactile(visible) { $('tactile').hidden = !(visible && estTactile); if (!visible) relacherTactile(); }
  (function () {
    const zone = $('t-volant'), bouton = zone.querySelector('.bouton-volant');
    const contacts = new Map();
    const annulerDerive = () => {
      if (doigt.derive && !pad.derive && !touches.has('Space') && !touches.has('ShiftLeft') && !touches.has('ShiftRight')) {
        const etat = session?.course?.joueur?.etat;
        if (etat) B.conduite.annulerDerive(etat, true);
      }
    };
    zone.addEventListener('pointerdown', e => {
      if (doigt.id !== null) return;
      doigt.id = e.pointerId; doigt.x0 = e.clientX; zone.setPointerCapture(e.pointerId); analogique = true;
      zone.classList.add('appuye'); e.preventDefault();
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== doigt.id) return;
      doigt.volant = clamp((e.clientX - doigt.x0) / 70, -1, 1);
      const course = Math.max(0, Math.min(60, (zone.clientWidth - bouton.offsetWidth) / 2 - 8));
      bouton.style.transform = 'translateX(' + (doigt.volant * course) + 'px)';
    });
    const lacher = e => { if (e.pointerId !== doigt.id) return; doigt.id = null; doigt.volant = 0; bouton.style.transform = ''; zone.classList.remove('appuye'); };
    zone.addEventListener('pointerup', lacher); zone.addEventListener('pointercancel', lacher); zone.addEventListener('lostpointercapture', lacher);
    for (const [id, cle] of [['t-gaz', 'gaz'], ['t-frein', 'frein'], ['t-derive', 'derive']]) {
      const el = $(id);
      const on = e => { if (contacts.has(el)) return; contacts.set(el, e.pointerId); doigt[cle] = true; el.classList.add('appuye'); el.setPointerCapture(e.pointerId); e.preventDefault(); };
      const off = e => {
        if (contacts.get(el) !== e.pointerId) return;
        if (cle === 'derive' && e.type !== 'pointerup') annulerDerive();
        contacts.delete(el); doigt[cle] = false; el.classList.remove('appuye');
      };
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
    }
    relacherTactile = () => {
      annulerDerive();
      const captures = [...contacts];
      if (doigt.id !== null) captures.push([zone, doigt.id]);
      contacts.clear(); doigt.id = null; doigt.volant = 0; doigt.gaz = doigt.frein = doigt.derive = false;
      bouton.style.transform = ''; zone.classList.remove('appuye');
      for (const [el, id] of captures) { el.classList.remove('appuye'); if (el.hasPointerCapture(id)) el.releasePointerCapture(id); }
    };
    addEventListener('resize', relacherTactile);
    $('t-vue').addEventListener('click', changerVue);
    $('b-pause').addEventListener('click', () => basculerPause());
  })();

  // ce que tient chaque joueur dans une course à deux, en clair
  function entreeDe(n) {
    const [m1, m2] = assigner(manettes), m = n ? m2 : m1, c = commande(n), codes = ['gaz', 'gauche', 'frein', 'droite'].map(a => toucheDe(n, a)[0]);
    const texteClavier = codes.every(k => /^Numpad\d$/.test(k || '')) ? 'pavé numérique (' + codes.map(k => k.slice(6)).join(' ') + ')' : 'clavier (' + codes.map(nomTouche).join(' ') + ')';
    const morceaux = [];
    if (m) morceaux.push('manette');
    else if (c === 'manette') morceaux.push('manette (non détectée)');
    if (c === 'auto' || c === 'clavier') morceaux.push(texteClavier);
    if (sourisPour(n, true) && (c === 'souris' || !m)) morceaux.push('souris');
    return morceaux.join(' ou ') || 'rien';
  }
  function changerVue2() {
    reglages.vue2 = reglages.vue2 === 'cockpit' ? 'poursuite' : 'cockpit';
    sauverReglages(); if (session && session.vueJ2) session.vueJ2.camCap = null;
  }
  function changerVue() {
    reglages.vue = reglages.vue === 'cockpit' ? 'poursuite' : 'cockpit';
    sauverReglages(); if (session) session.camCap = null;
  }

  // ---------------------------------------------------------------- son
  let sonActif = false, muet = false;
  function activerSon() {
    if (!son) return;
    son.demarrer();
    if (!sonActif) { sonActif = true; appliquerVolumes(); son.musique(ecran === 'titre'); }
  }
  function appliquerVolumes() {
    if (!son) return;
    const menu = !(enCourse() || ecran === 'demo');
    son.regler({ general: muet ? 0 : reglages.general * (menu ? .55 : 1), moteur: reglages.moteur, effets: reglages.effets });
  }
  function couperSon() { muet = !muet; appliquerVolumes(); message(muet ? 'Son coupé' : 'Son rétabli', '', true); }

  // ---------------------------------------------------------------- pas de simulation et événements
  function synchroniserReplacement(S, ev) {
    for (const e of ev) if (e.repositionnement) {
      // Ni trajet interpolé dans le décor, ni ancien cap de caméra après un tête-à-queue.
      if (S.prec[e.id]) Object.assign(S.prec[e.id], S.cour[e.id]);
      if (e.id === (S.suivie || 0)) {
        S.camCap = null; S.tete = null; S.tele.poste = null;
        S.distances.fill(-1); S.vRel.fill(0); S.secousse = 0; S.eclair = 0;
      }
      if (e.id === S.course.joueur.id) { pad.choc = 0; pad.passe = 0; S.avertiContresens = false; }
      if (S.locaux && e.id === S.locaux[1]) { pad2.choc = 0; pad2.passe = 0; }
    }
  }

  function pasSimulation(S, pilote) {
    if (B.meteo) B.meteo.actuel = S.meteo;
    const co = S.course;
    const auto = S.type === 'vitrine' || S.type === 'demo' || pilote || pilotageAuto;
    let cmd;
    if (S.type === 'duo') { const [a, b] = S.locaux; cmd = []; cmd[a] = auto ? B.course.commandesIA(co, co.voitures[a]) : commandesJoueur(); cmd[b] = auto ? B.course.commandesIA(co, co.voitures[b]) : commandesJoueur2(); }
    else cmd = auto ? B.course.commandesIA(co, co.joueur) : commandesJoueur();
    const ev = B.course.pas(co, cmd, DT);
    // vibration manette : le pilote la sent passer dans ses mains — le moteur selon les tours, la route, les
    // vibreurs, l'herbe, le patinage, la glisse et les chocs ; la main reste calme si le réglage est à « non »
    if (!pilote && reglages.vibrations === 'oui') {
      const [faible, fort] = vibrationManette(co.joueur.etat, ev, co.horloge, pad, co.joueur.id);
      secouerManette(faible, fort);
    } else secouerManette(0, 0);
    // à deux, la manette du joueur 2 vit sa propre voiture
    if (S.type === 'duo' && pad2.manette) {
      if (!pilote && reglages.vibrations === 'oui') { const [f2, s2] = vibrationManette(co.voitures[S.locaux[1]].etat, ev, co.horloge, pad2, S.locaux[1]); secouerManette(f2, s2, pad2); }
      else secouerManette(0, 0, pad2);
    }
    for (const v of co.voitures) {
      v.roule = (v.roule || 0) + v.etat.v * DT; // distance roulée : fait tourner les roues
      // changement de rapport : la main droite du pilote va au levier (vue cockpit). cockpit-6 : au premier pas,
      // on initialise seule la référence, sans trajet ; cockpit-2 : un rapport qui arrive pendant l'animation
      // précédente (0,36 s) est consommé sans reprise — le trajet en cours vise déjà le rapport courant, et
      // tPassage ne repart pas à zéro (sinon la main se téléporte du pommeau à la jante)
      if (v.etat.rapport !== v.rapportVu) {
        if (v.rapportVu !== undefined && (v.tPassage === undefined || co.horloge - v.tPassage >= .36)) { v.rapportAvant = v.rapportVu; v.tPassage = co.horloge; if (v === co.joueur) pad.passe = .5; else if (S.type === 'duo' && v.id === S.locaux[1]) pad2.passe = .5; }
        v.rapportVu = v.etat.rapport;
      }
    }
    const t = S.prec; S.prec = S.cour; S.cour = t; remplirPoses(S.cour, co);
    synchroniserReplacement(S, ev);
    const tFx = S.banc ? performance.now() : 0;
    B.traces.pas(S.fx, co, S.cour, S.suivie || 0, DT, ev);
    if (S.banc) S.banc.effets += performance.now() - tFx;
    if (S.type === 'demo') traiterDemo(S, ev);
    else if (S.type !== 'vitrine') { traiter(S, ev); suivreJoueur(S); }
  }

  // Démo : les sons et les annonces suivent la course et la voiture filmée, pas un joueur.
  function traiterDemo(S, ev) {
    const co = S.course, pl = S.planVu, sujet = pl ? pl.sujet : -1, dePres = !!pl && B.realisateur.PORTEES.has(pl.vue);
    B.realisateur.signaler(S.real, co, ev);
    for (const e of ev) {
      switch (e.type) {
        case 'feu': son && son.evenement('feu'); break;
        case 'vert': son && son.evenement('vert'); message('Départ', 'vert', true); break;
        case 'contact':
          if (dePres && (e.a === sujet || e.b === sujet)) { son && son.evenement('contact', { force: e.force }); S.secousse = Math.min(1, (S.secousse || 0) + Math.max(0, e.force - 2) * .07); }
          break;
        case 'tour': if (co.voitures[e.id].position === 1 && co.toursTotal - e.tour === 1 && co.drapeau === null) message('Dernier tour', 'ambre'); break;
        case 'arrivee':
          if (e.position !== 1) break;
          son && son.evenement('arrivee');
          S.finA = co.horloge;
          message('Drapeau à damier', 'ambre');
          sousMessage(co.voitures[e.id].nom + ' · ' + CATALOGUE[S.i].nom + ' · ' + chrono(co.voitures[e.id].tempsFinal));
          break;
        default:
          if (!dePres || e.id !== sujet) break;
          if (son) son.evenement(e.type, e);
          if (e.type === 'choc') S.secousse = Math.min(1, (S.secousse || 0) + Math.max(0, e.force - 2) * .07);
      }
    }
  }

  function traiter(S, ev) {
    const co = S.course, j = co.joueur, V2 = S.vueJ2;
    if (V2) for (const e of ev) {
      const id2 = S.locaux[1];
      if (e.type === 'contact' && (e.a === id2 || e.b === id2)) V2.secousse = Math.min(1, V2.secousse + Math.max(0, e.force - 2) * .07);
      else if (e.id !== id2) continue;
      else if (e.type === 'choc') { V2.secousse = Math.min(1, V2.secousse + Math.max(0, e.force - 2) * .07); if (e.force > 18) V2.eclair = Math.min(.9, (e.force - 18) * .07); }
      else if (e.type === 'tonneau' || e.type === 'casse') { V2.secousse = 1; V2.eclair = .7; }
    }
    // en ligne : chacun annonce le temps officiel de sa voiture, l'hôte aussi ceux des rivaux ; un temps officiel reçu
    // remplace celui mesuré ici sur les états reçus (même classement au millième sur les deux machines)
    if (S.enLigne && EL.R) for (const e of ev) {
      if (e.type === 'tour' && co.voitures[e.id].joueur) EL.R.envoyer({ t: 'tour', id: e.id, tour: e.tour, temps: e.temps });
      else if (e.type === 'arrivee') {
        const v = co.voitures[e.id];
        if (v.joueur || (S.enLigne.role === 'hote' && (!v.humain || v.reprise))) EL.R.envoyer({ t: 'arrivee', id: v.id, temps: v.tempsFinal, tours: v.tours });
        else if (v.tempsOfficiel != null) v.tempsFinal = v.tempsOfficiel;
      }
    }
    for (const e of ev) {
      switch (e.type) {
        case 'feu': son && son.evenement('feu'); break;
        case 'vert': son && son.evenement('vert'); message('Départ', 'vert', true); break;
        case 'contact': if (e.a === j.id || e.b === j.id) { son && son.evenement('contact', { force: e.force }); S.secousse = Math.min(1, (S.secousse || 0) + Math.max(0, e.force - 2) * .07); } break;
        case 'tour':
          if (co.duo && e.id === S.locaux[1]) finTourJ2(S, e);
          if (e.id !== j.id) break;
          son && son.evenement('tour', { meilleur: e.meilleur });
          finTour(S, e);
          break;
        case 'arrivee':
          if (co.duo && e.id === S.locaux[1]) { const v2 = co.voitures[e.id]; message(v2.position === 1 ? 'Victoire' : 'Arrivée · ' + v2.position + 'e', 'vert', false, 1); sousMessage('Drapeau à damier · ' + chrono(v2.tempsFinal), 1); }
          if (e.id !== j.id) break;
          son && son.evenement('arrivee');
          S.finA = co.horloge;
          message(e.position === 1 ? 'Victoire' : e.position + (e.position === 1 ? 're' : 'e') + ' place', e.position <= 3 ? 'ambre' : '');
          sousMessage('Drapeau à damier · ' + chrono(j.tempsFinal));
          break;
        default:
          if (e.id !== j.id) break;
          if (son) son.evenement(e.type, e);
          if (e.type === 'choc') { S.secousse = Math.min(1, (S.secousse || 0) + Math.max(0, e.force - 2) * .07); if (e.force > 18) S.eclair = Math.min(.9, (e.force - 18) * .07); }
          else if (e.type === 'reception') S.secousse = Math.min(1, (S.secousse || 0) + Math.max(0, (e.force || 0) - 2) * .12);
          else if (e.type === 'tonneau' || e.type === 'casse') { S.secousse = 1; S.eclair = .7; message('Retour en piste', 'ambre', true); }
          else if (e.type === 'roue') { message('Retour en piste', 'ambre', true); S.eclair = .5; }
          else if (e.type === 'retour' && e.repositionnement) { S.secousse = 0; S.eclair = 0; S.bloque = 0; S.contresens = 0; message('Replacé', '', true); }
          else if (e.type === 'turbo') message(e.parfait ? 'Turbo parfait' : 'Turbo', e.parfait ? 'ambre' : '', true);
          else if (e.type === 'deriveAnnulee') S.derniereJauge = co.horloge;
      }
    }
  }

  function finTour(S, e) {
    const co = S.course, j = co.joueur, id = CATALOGUE[S.i].id;
    const ancien = records[id] && records[id].tour;
    // profil du tour (temps tous les 10 m) pour l'écart en direct
    if (e.valide !== false && e.meilleur) S.profilMeilleur = S.profil.slice();
    S.profil.fill(-1);
    let texte = 'Tour ' + e.tour + ' · ' + chrono(e.temps);
    if (!S.essai && e.valide !== false && (!ancien || e.temps < ancien)) {
      records[id] = { tour: e.temps, date: new Date().toISOString().slice(0, 10), mode: co.mode };
      ecrireStock(CLE_RECORDS, records);
      if (ancien) texte += ' · record du circuit';
    }
    if (e.valide === false) texte += ' · hors classement chrono';
    const qui = co.duo ? 0 : undefined;
    sousMessage(texte, qui);
    if (co.mode === 'chrono') {
      // le fantôme gardé est celui du meilleur tour jamais fait ici
      const f = co.fantome;
      const garde = lireStock(CLE_FANTOME + id, null);
      if (!S.essai && e.valide !== false && f.meilleur && f.temps === e.temps && (!garde || garde.longueur !== co.c.longueur || e.temps < garde.temps))
        ecrireStock(CLE_FANTOME + id, { temps: f.temps, n: f.meilleur.n, longueur: co.c.longueur, b64: enBase64(f.meilleur.donnees) });
      message(e.valide === false ? 'Tour non chronométré' : e.meilleur ? 'Meilleur tour' : chrono(e.temps), e.valide !== false && e.meilleur ? 'vert' : '', true);
    } else if (co.toursTotal - j.tours === 1) message('Dernier tour', 'ambre', false, qui);
    else if (e.meilleur && j.tours > 1) message('Meilleur tour', 'vert', true, qui);
  }
  // tours du joueur 2, sur son affichage
  function finTourJ2(S, e) {
    const co = S.course, v = co.voitures[S.locaux[1]];
    sousMessage('Tour ' + e.tour + ' · ' + chrono(e.temps), 1);
    if (co.toursTotal - v.tours === 1) message('Dernier tour', 'ambre', false, 1);
    else if (e.meilleur && v.tours > 1) message('Meilleur tour', 'vert', true, 1);
  }

  function suivreJoueur(S) {
    const co = S.course, j = co.joueur, et = j.etat, L = co.c.longueur;
    const enLice = co.mode === 'chrono' ? co.chronoParti : co.phase === 'course' || co.phase === 'arrivee';
    if (enLice && !j.fini) {
      const dans = j.progression - j.tours * L, k = Math.floor(dans / 10);
      if (k >= 0 && k < S.profil.length && S.profil[k] < 0) S.profil[k] = co.temps - j.debutTour;
    }
    // contresens et voiture coincée : retour sur la piste
    if (co.phase === 'course' && !j.fini) {
      const arriere = Math.cos(et.psi) < -.2 && et.v > 2;
      S.contresens = arriere ? S.contresens + DT : Math.max(0, S.contresens - DT * 2);
      if (S.contresens > 1.2 && !S.avertiContresens) { message('Contresens', 'rouge', true); S.avertiContresens = true; }
      if (S.contresens < .2) S.avertiContresens = false;
      const coince = !et.recuperation && et.rapport >= 0 && et.v >= 0 && ((et.v < 1.5 && et.gaz > .5) || (Math.cos(et.psi) < -.5 && et.v < 3));
      S.bloque = coince ? S.bloque + DT : 0;
      if (S.bloque > 3) { replacer(); S.bloque = 0; }
    }
  }

  function replacer() {
    const S = session; if (!S) return;
    const co = S.course, ev = B.course.replacer(co);
    remplirPoses(S.cour, co); remplirPoses(S.prec, co);
    synchroniserReplacement(S, ev);
    B.traces.pas(S.fx, co, S.cour, S.suivie || 0, 0, ev);
    traiter(S, ev);
  }

  // ---------------------------------------------------------------- jeu en ligne (reseau.js)
  // De deux à quatre pilotes (David, 16/11 : « en ligne jusqu'à quatre ; deux en local contre deux en local ; deux en
  // local contre un seul ») : chaque machine en porte un ou deux (écran partagé). L'hôte crée la partie, choisit la
  // course et donne l'instant du départ T0 sur l'horloge commune ; toutes les simulations partent ensemble et avancent
  // au même pas. Chaque machine conduit ses voitures et envoie leur état à chaque image ; l'hôte envoie aussi celui des
  // rivaux une image sur deux. Une voiture distante est prolongée jusqu'au pas courant et son écart se résorbe en
  // 0,12 s. Les temps officiels arrivent par le canal fiable. Une machine qui part laisse ses voitures à l'ordinateur
  // de l'hôte ; sans hôte, chacun finit la course seul.
  const EL = { R: null, role: null, recus: new Map(), corr: new Map(), pasEnvoi: 0, pred: {}, vieux: {}, course: null, pneusDe: new Map() };
  const nomPilote = () => (reglages.nom || '').trim().slice(0, 16) || 'Pilote';
  const joueursIci = () => reglages.joueursLocaux === 2 ? 2 : 1;
  const propre = t => String(t || '').replace(/[<>&"'`\\]/g, '').trim().slice(0, 16) || 'Pilote';
  function etatEnLigne(t) { texte($('l-etat'), t); }
  const lienActif = () => !!(EL.R && EL.R.etat === 'connecte');
  function quitterEnLigne() {
    const R = EL.R;
    annulerConfirmation(); EL.course = null; EL.pneusDe.clear();
    EL.R = null; EL.role = null;
    if (R) R.fermer();
    etatEnLigne('');
    aller('titre');
  }
  // pilotes de la partie, dans l'ordre des machines (voitures humaines 0 à 3) ; « prets » : l'hôte et les machines liées
  function pilotesSalle(R, prets) {
    const p = [];
    for (const m of [...R.membres].sort((a, b) => a.id - b.id)) {
      if (prets && m.id !== R.id && !R.pretAvec(m.id)) continue;
      for (let k = 0; k < (m.joueurs === 2 ? 2 : 1); k++) p.push({ nom: propre(m.nom) + (k ? ' 2' : ''), machine: m.id });
    }
    return p;
  }
  // l'écran du salon : choix créer / rejoindre sans partie, sinon le code, la liste des machines et l'état
  function majSalon() {
    const R = EL.R, ouvert = !!R && R.etat !== 'ferme', actif = lienActif();
    for (const sel of ['.enligne-choix', '.champ-nom', '.champ-joueurs']) document.querySelector(sel).hidden = ouvert;
    $('l-code-affiche').hidden = !(ouvert && EL.role === 'hote' && R.code);
    const liste = $('l-pilotes');
    liste.hidden = !ouvert;
    if (ouvert) {
      let html = '';
      for (const m of [...R.membres].sort((a, b) => a.id - b.id)) {
        const moi = m.id === R.id, p = R.pairs.get(m.id);
        const lien = moi ? 'vous' : !p || !p.pret ? 'connexion…' : p.relais ? 'par le salon' : 'liaison directe';
        html += '<li' + (moi ? ' class="moi"' : '') + '><b>' + propre(m.nom) + '</b><span>' + (m.joueurs === 2 ? '2 pilotes, écran partagé' : '1 pilote') + (m.id === 0 ? ' · hôte' : '') + '</span><em>' + lien + '</em></li>';
      }
      if (liste._html !== html) { liste._html = html; liste.innerHTML = html; }
    }
    const n = ouvert ? pilotesSalle(R).length : 0;
    $('l-choisir').hidden = !(actif && EL.role === 'hote');
    $('l-choisir').disabled = n > 4;
    majCourseSalon();
    if (ouvert && !actif) etatEnLigne(EL.role === 'hote' ? 'Partie créée. Donnez ce code aux autres pilotes : quatre pilotes au plus.' : 'Connexion aux autres pilotes…');
    else if (actif) etatEnLigne(n > 4 ? 'Plus de quatre pilotes : une machine doit passer à un seul pilote.'
      : EL.role === 'hote' ? n + ' pilotes. Choisissez la course quand tout le monde est là.' : n + ' pilotes. L’hôte choisit la course…');
  }
  // Prochaine course (David, 16/11 : « pourquoi les autres ne peuvent pas choisir les pneus ? ») : l'hôte annonce
  // circuit, tours et météo prévue (la même graine que la course qui partira) ; chaque machine choisit ses pneus, que
  // l'hôte reprend au départ. Boîte, vue, aide et commandes restent les réglages de chaque machine.
  const NOMS_METEO = { soleil: 'soleil', pluie: 'pluie', variable: 'variable' };
  const NOMS_MOMENT = { jour: 'jour', crepuscule: 'crépuscule', nuit: 'nuit', cycle: 'cycle jour / nuit' };
  const NOMS_SAISON = { printemps: 'printemps', ete: 'été', automne: 'automne', hiver: 'hiver' };
  function cleConditions() {
    return [reglages.saisonMode, reglages.saison, reglages.momentMode, reglages.moment, reglages.meteoMode, reglages.meteo].join('|');
  }
  function conditionsDuDepart() {
    if (conditionsPreparation && conditionsPreparationCle === cleConditions()) return conditionsPreparation;
    return { saison: B.saisons.normaliser(reglages.saison), moment: B.ambiance.normaliser(reglages.moment),
      meteo: reglages.meteo || 'aleatoire', mReelle: null, horlogeReelle: null };
  }
  // Les messages transportent les conditions utiles, jamais la localisation IP ni le lieu de l’hôte.
  function horlogePartagee(h) {
    if (!h || !['locale', 'soleil'].includes(h.type)) return null;
    let fuseau = typeof h.fuseau === 'string' && h.fuseau.length < 80 ? h.fuseau : 'UTC';
    try { new Intl.DateTimeFormat('fr', { timeZone: fuseau }); } catch (_) { fuseau = 'UTC'; }
    if (h.type === 'locale') return { type: 'locale', fuseau };
    const jours = (Array.isArray(h.jours) ? h.jours : []).slice(0, 12).filter(j => j && Number.isFinite(j.midi) &&
      (j.polaire === 1 || j.polaire === -1 || Number.isFinite(j.lever) && Number.isFinite(j.coucher) && j.coucher > j.lever))
      .map(j => ({ midi: j.midi, lever: Number.isFinite(j.lever) ? j.lever : null,
        coucher: Number.isFinite(j.coucher) ? j.coucher : null, polaire: j.polaire === 1 ? 1 : j.polaire === -1 ? -1 : 0 }));
    return jours.length ? { type: 'soleil', fuseau, jours } : null;
  }
  function conditionsCommunes(k) {
    return { saison: B.saisons.normaliser(k.saison), moment: B.ambiance.normaliser(k.moment),
      meteo: ['soleil', 'pluie', 'variable', 'aleatoire'].includes(k.meteo) ? k.meteo : 'soleil',
      mReelle: B.meteo.depuisReel(k.mReelle), horlogeReelle: horlogePartagee(k.horlogeReelle) };
  }
  function nomMeteoCourse(k) {
    const nom = NOMS_METEO[k.meteo] || (k.eau > .25 ? 'pluie, tirée au sort' : 'sec, tirée au sort');
    const profil = B.saisons.profil(k.saison, CATALOGUE[k.i].theme);
    const neige = CATALOGUE[k.i].theme !== 'cote' && (k.mReelle ? k.mReelle.neige : profil.neige);
    if (k.mReelle) return (k.mReelle.pluie > .02 ? neige ? 'neige' : k.mReelle.phase === 'orage' ? 'orage' : 'pluie'
      : k.mReelle.nuage > .65 ? 'couvert' : k.mReelle.nuage > .25 ? 'éclaircies' : 'soleil') + ' · réelle';
    return neige ? nom.replace('pluie', 'neige') : nom;
  }
  function annoncerCourse() {
    if (EL.role !== 'hote' || !EL.R) return;
    const conditions = conditionsCommunes(conditionsDuDepart());
    const prevue = B.meteo.depuisReel(conditions.mReelle) || B.meteo.pour(conditions.meteo) || B.meteo.initial(graineCourse + 1);
    EL.course = { i: reglages.circuit, tours: reglages.tours, difficulte: reglages.difficulte, ...conditions, eau: B.conduite.eauSurPiste(prevue) };
    EL.R.envoyer(Object.assign({ t: 'course' }, EL.course));
    majCourseSalon();
  }
  function majCourseSalon() {
    const k = EL.course, ouvert = !!EL.R && EL.R.etat !== 'ferme';
    $('l-course').hidden = !(ouvert && k);
    if (!k) return;
    const conseil = B.conduite.pneusConseilles(k.eau), meteo = nomMeteoCourse(k);
    texte($('l-course-texte'), 'Prochaine course : ' + CATALOGUE[k.i].nom + ' · ' + k.tours + ' tours · ' + NOMS_SAISON[B.saisons.normaliser(k.saison)] + ' · ' + NOMS_MOMENT[B.ambiance.normaliser(k.moment)] + ' · météo : ' + meteo + ' (pneus conseillés : ' + NOMS_PNEUS[conseil].toLowerCase() + ').');
    $('l-vers-prets').hidden = !EL.confirmation;
  }
  // Avant le départ (David, 16/11 : « un écran de confirmation quand tout le monde est prêt, pour régler ses options
  // avant la course ») : l'hôte propose la course ; chaque machine règle pneus, boîte et vue, puis se dit prête ; la
  // course part quand toutes les machines liées le sont. L'hôte peut annuler ; une machine peut revenir au salon.
  function proposerCourse() {
    const R = EL.R;
    if (!R || !lienActif() || EL.role !== 'hote') { etatEnLigne('Pas d’autre pilote connecté.'); aller('enligne'); return; }
    annulerConfirmation();
    annoncerCourse();
    EL.confirmation = { prets: new Set() }; EL.pretIci = false;
    R.envoyer({ t: 'confirmer', course: EL.course });
    aller('prets');
  }
  function majPrets() {
    const k = EL.course, R = EL.R, C = EL.confirmation;
    if (!k || !R || !C) return;
    const meteo = nomMeteoCourse(k);
    texte($('pr-course'), CATALOGUE[k.i].nom + ' · ' + k.tours + ' tours · ' + NOMS_SAISON[B.saisons.normaliser(k.saison)] + ' · ' + NOMS_MOMENT[B.ambiance.normaliser(k.moment)] + ' · météo : ' + meteo);
    texte($('pr-pneus-conseil'), 'Conseillés pour cette météo : ' + NOMS_PNEUS[B.conduite.pneusConseilles(k.eau)].toLowerCase() + '.');
    for (const [nom, val] of [['pneusPret', reglages.pneus], ['boitePret', reglages.boite], ['vuePret', reglages.vue]]) for (const r of document.querySelectorAll('input[name="' + nom + '"]')) r.checked = r.value === val;
    let html = '', n = 0, m = 0;
    for (const x of [...R.membres].sort((a, b) => a.id - b.id)) {
      const pret = C.prets.has(x.id) && (x.id === R.id || R.pretAvec(x.id));
      m++; if (pret) n++;
      html += '<li' + (x.id === R.id ? ' class="moi"' : '') + '><b>' + propre(x.nom) + '</b><span>' + (x.joueurs === 2 ? '2 pilotes' : '1 pilote') + (x.id === 0 ? ' · hôte' : '') + '</span><em class="' + (pret ? 'pret' : 'attente') + '">' + (pret ? 'prêt' : 'règle ses options…') + '</em></li>';
    }
    const liste = $('pr-pilotes');
    if (liste._html !== html) { liste._html = html; liste.innerHTML = html; }
    texte($('pr-etat'), tousPrets(R, C) ? 'Tout le monde est prêt : départ !' : n + ' machine' + (n > 1 ? 's' : '') + ' prête' + (n > 1 ? 's' : '') + ' sur ' + m + '. La course part quand toutes le sont.');
    texte($('pr-pret'), EL.pretIci ? 'Pas encore prêt' : 'Je suis prêt');
    classe($('pr-pret'), 'principal', !EL.pretIci);
  }
  function basculerPret() {
    const R = EL.R, C = EL.confirmation;
    if (!R || !C) return;
    EL.pretIci = !EL.pretIci;
    if (EL.role === 'hote') { if (EL.pretIci) C.prets.add(R.id); else C.prets.delete(R.id); diffuserPrets(); }
    else R.envoyer({ t: 'pret', oui: EL.pretIci, pneus: reglages.pneus }, 0);
    majPrets();
  }
  function annulerConfirmation() {
    if (EL.confirmation) clearTimeout(EL.confirmation.minuteur);
    EL.confirmation = null; EL.pretIci = false;
  }
  function retirerPret() {
    if (EL.confirmation && EL.pretIci) basculerPret();
  }
  function tousPrets(R, C) {
    return !!(R && C && R.etat === 'connecte' && R.membres.length >= 2 &&
      pilotesSalle(R).length <= 4 && R.membres.every(m =>
        C.prets.has(m.id) && (m.id === R.id || R.pretAvec(m.id))));
  }
  // Le délai reste annulable : retour au salon, déconnexion ou nouveau membre ne lancent jamais une ancienne course.
  function diffuserPrets() {
    const R = EL.R, C = EL.confirmation;
    if (!R || !C || EL.role !== 'hote') return;
    for (const id of C.prets) if (!R.membres.some(m => m.id === id)) C.prets.delete(id);
    R.envoyer({ t: 'prets', liste: [...C.prets] });
    majPrets();
    if (!tousPrets(R, C)) { clearTimeout(C.minuteur); C.minuteur = null; return; }
    if (C.minuteur != null) return;
    C.minuteur = setTimeout(() => {
      C.minuteur = null;
      if (EL.R !== R || EL.confirmation !== C || !tousPrets(R, C)) return;
      annulerConfirmation();
      departEnLigne();
    }, 700);
  }
  function quitterPrets() {
    if (EL.role === 'hote') { annulerConfirmation(); if (EL.R) EL.R.envoyer({ t: 'annuler' }); }
    else if (EL.R && EL.pretIci) EL.R.envoyer({ t: 'pret', oui: false }, 0);
    EL.pretIci = false;
    aller('enligne');
  }
  function recevoirCourse(m) {
    if (!m || !Number.isInteger(m.i) || !CATALOGUE[m.i]) return false;
    // nouvelle annonce : les pneus conseillés sont présélectionnés quand la météo change, le pilote peut changer
    const eau = clamp(+m.eau || 0, 0, 1), avant = EL.course;
    EL.course = { i: m.i | 0, tours: clamp(m.tours | 0, 1, 99), difficulte: m.difficulte | 0, ...conditionsCommunes(m), eau };
    if (!avant || Math.abs(avant.eau - eau) > .05 || !B.conduite.PNEUS[reglages.pneus]) { reglages.pneus = B.conduite.pneusConseilles(eau); envoyerPneus(); }
    majCourseSalon();
    if (ecran === 'prets') majPrets();
    return true;
  }
  function envoyerPneus() {
    if (EL.R && EL.role === 'invite' && EL.R.pretAvec(0) && B.conduite.PNEUS[reglages.pneus]) EL.R.envoyer({ t: 'pneus', pneus: reglages.pneus }, 0);
  }
  function nouvelleLiaison() {
    annulerConfirmation();
    if (EL.R) EL.R.fermer();
    EL.course = null; EL.pneusDe.clear();
    const R = EL.R = B.reseau.creer({ url: B.reseau.adresseSalon(), nom: nomPilote(), joueurs: joueursIci() });
    EL.role = null;
    $('l-choisir').hidden = true; $('l-code-affiche').hidden = true;
    R.on('salon', m => {
      if (R !== EL.R) return;
      EL.role = m.role;
      if (m.role === 'hote') texte($('l-code-affiche'), m.code);
      majSalon();
    }).on('salle', () => { if (R === EL.R) { majSalon(); if (EL.confirmation) { diffuserPrets(); majPrets(); } } })
      .on('pair', id => {
        if (R !== EL.R) return;
        majSalon();
        if (EL.role !== 'hote') { if (id === 0) envoyerPneus(); return; }
        annoncerCourse();
        // une machine arrive pendant la confirmation : elle la reçoit aussi
        if (EL.confirmation) { R.envoyer({ t: 'confirmer', course: EL.course }, id); R.envoyer({ t: 'prets', liste: [...EL.confirmation.prets] }, id); diffuserPrets(); }
      })
      .on('relais', () => { if (R !== EL.R) return; majSalon(); if (session && session.enLigne && ecran === 'course') sousMessage('Liaison directe perdue : la course passe par le salon'); })
      .on('parti', id => { if (R === EL.R) surDepart(id); })
      .on('message', (m, de) => { if (R === EL.R) surMessageEnLigne(m, de); })
      .on('etat', p => { if (R === EL.R) for (const e of p.voitures) { const r = EL.recus.get(e.id); if (!r || p.t >= r.t) EL.recus.set(e.id, { t: p.t, etat: e }); } })
      .on('erreur', t => { if (R === EL.R) etatEnLigne(t); })
      .on('ferme', raison => { if (R === EL.R) surFermeture(raison); });
    return R;
  }
  // la préparation s'abandonne si la liaison change ou tombe ; elle sait combien de temps reste avant le départ commun
  function lancerEnLigne(cfg) {
    reglages.circuit = cfg.i;
    const R = EL.R;
    return preparerSeance('course', cfg.i, cfg, null, { verifier: () => EL.R === R && !!R && R.etat === 'connecte',
      reste: () => R && R.horloge ? cfg.T0 - R.horloge() : Infinity });
  }
  function surMessageEnLigne(m, de) {
    if (!m || typeof m !== 'object' || !EL.R) return;
    const S = session;
    if (m.t === 'depart' && de === 0 && EL.role === 'invite' && m.cfg) {
      const humains = (Array.isArray(m.cfg.humains) ? m.cfg.humains : []).slice(0, 4).map(h => ({ nom: propre(h.nom), machine: h.machine | 0 }));
      const locaux = humains.map((h, k) => h.machine === EL.R.id ? k : -1).filter(k => k >= 0);
      annulerConfirmation();
      if (!locaux.length) { etatEnLigne('La course est partie sans cette machine : attendez la suivante.'); majCourseSalon(); return; }
      lancerEnLigne(Object.assign({}, m.cfg, conditionsCommunes(m.cfg), { humains, locaux, role: 'invite' }));
    } else if (m.t === 'course' && de === 0 && EL.role === 'invite') recevoirCourse(m);
    else if (m.t === 'confirmer' && de === 0 && EL.role === 'invite') {
      if (!recevoirCourse(m.course)) return;
      annulerConfirmation();
      EL.confirmation = { prets: new Set() }; EL.pretIci = false;
      if (ecran !== 'course' && ecran !== 'pause') aller('prets');
      majCourseSalon();
    } else if (m.t === 'prets' && de === 0 && EL.confirmation) { EL.confirmation.prets = new Set((Array.isArray(m.liste) ? m.liste : []).map(x => x | 0)); majPrets(); }
    else if (m.t === 'annuler' && de === 0 && EL.role === 'invite') {
      annulerConfirmation();
      if (retourReglages === 'prets') retourReglages = 'enligne';
      if (ecran === 'prets') aller('enligne');
      etatEnLigne('L’hôte a annulé le départ.'); majCourseSalon();
    } else if (m.t === 'pret' && EL.role === 'hote' && EL.confirmation && EL.R.membres.some(x => x.id === de) && EL.R.pretAvec(de)) {
      if (B.conduite.PNEUS[m.pneus]) EL.pneusDe.set(de, m.pneus);
      if (m.oui) EL.confirmation.prets.add(de); else EL.confirmation.prets.delete(de);
      diffuserPrets();
    } else if (m.t === 'pneus' && EL.role === 'hote' && EL.R.membres.some(x => x.id === de)) {
      if (B.conduite.PNEUS[m.pneus]) EL.pneusDe.set(de, m.pneus);
    } else if (m.t === 'arrivee' && S && S.enLigne) {
      const v = S.course.voitures[m.id];
      if (v && v.distant && Number.isFinite(m.temps)) { v.tempsOfficiel = m.temps; if (v.fini) v.tempsFinal = m.temps; }   // temps officiel
    } else if (m.t === 'vers-salon' && de === 0 && EL.role === 'invite' && ecran !== 'enligne' && (!S || !S.enLigne || S.course.termine)) aller('enligne');
  }
  // une machine (pas l'hôte) quitte la partie : l'ordinateur de l'hôte reprend ses voitures et envoie leur état
  function surDepart(id) {
    EL.pneusDe.delete(id);
    majSalon();
    if (EL.confirmation && EL.role === 'hote') { EL.confirmation.prets.delete(id); diffuserPrets(); }
    else if (ecran === 'prets') majPrets();
    const S = session;
    if (!S || !S.enLigne || S.course.termine) return;
    const leurs = S.enLigne.humains.map((h, k) => h.machine === id ? k : -1).filter(k => k >= 0);
    if (!leurs.length) return;
    if (EL.role === 'hote') for (const k of leurs) { const v = S.course.voitures[k]; v.distant = false; v.joueur = false; v.reprise = true; }
    message('Un pilote est parti', 'ambre'); sousMessage('Sa voiture passe à l’ordinateur');
  }
  function surFermeture(raison) {
    annulerConfirmation(); EL.course = null; EL.pneusDe.clear();
    if (retourReglages === 'prets') retourReglages = 'enligne';
    if (ecran === 'prets') aller('enligne');
    const S = session;
    etatEnLigne(raison === 'parti' ? 'L’hôte a quitté la partie.' : raison === 'local' ? '' : 'La liaison est coupée.');
    if (S && S.enLigne && !S.course.termine) {
      // la course continue : ce qui venait du réseau passe à l'IA de cette machine
      for (const v of S.course.voitures) if (v.distant) { v.distant = false; v.joueur = false; }
      S.enLigne = null; S.enLigneOrigine = false;   // la course finit comme une course seule
      if (raison !== 'local') { message('Liaison perdue', 'ambre'); sousMessage('Les autres pilotes sont remplacés par l’ordinateur'); }
      if (ecran === 'resultats' && S.course.drapeau !== null) finirClassement(S);
    }
    EL.role = raison === 'local' ? null : EL.role;
    majSalon();
    if (S && ecran === 'resultats') montrerResultats(S, true);
  }
  // hôte : départ de la course en ligne, T0 dans 4 s sur l'horloge commune ; les machines déjà liées y prennent part
  function departEnLigne() {
    const R = EL.R;
    if (!R || !lienActif() || EL.role !== 'hote') { etatEnLigne('Pas d’autre pilote connecté.'); aller('enligne'); return; }
    const humains = pilotesSalle(R, true);
    if (humains.length > 4) { etatEnLigne('Quatre pilotes au plus.'); aller('enligne'); return; }
    const k = EL.course || { i: reglages.circuit, tours: reglages.tours, difficulte: reglages.difficulte, ...conditionsCommunes(conditionsDuDepart()) };
    const graine = ++graineCourse;
    const conseil = B.conduite.pneusConseilles(B.conduite.eauSurPiste(B.meteo.depuisReel(k.mReelle) || B.meteo.pour(k.meteo) || B.meteo.initial(graine)));
    const cfg = { graine, i: k.i, tours: k.tours, difficulte: k.difficulte, ...conditionsCommunes(k), T0: R.horloge() + 4000, dateDepart: Date.now() + 4000, humains,
      pneus: humains.map(h => { const p = h.machine === 0 ? reglages.pneus : EL.pneusDe.get(h.machine); return B.conduite.PNEUS[p] ? p : conseil; }) };
    R.envoyer({ t: 'depart', cfg });
    lancerEnLigne(Object.assign({}, cfg, { locaux: humains.map((h, k) => h.machine === 0 ? k : -1).filter(k => k >= 0), role: 'hote' }));
  }
  // état de nos voitures, une fois par image : les nôtres toujours, et chez l'hôte les rivaux une image sur deux
  function envoyerEtats(S) {
    const R = EL.R, co = S.course;
    if (!R || R.etat !== 'connecte') return;
    const k = ++EL.pasEnvoi, liste = S.locaux.map(id => co.voitures[id]);
    if (S.enLigne.role === 'hote' && k % 2 === 0) for (const v of co.voitures) if (!v.humain || v.reprise) liste.push(v);
    R.envoyerEtat(B.reseau.emballer(S.enLigne.T0 + co.horloge * 1000, liste));
  }
  // Voiture distante : dernier état reçu, prolongé jusqu'à l'instant de ce pas. À l'arrivée d'un état, ce qu'on aurait
  // affiché à ce même pas avec l'ancien moins la nouvelle prédiction devient une correction qui se résorbe en 0,12 s :
  // ni saut, ni retard.
  function appliquerDistant(S, v, dt) {
    const r = EL.recus.get(v.id);
    if (!r || !S.enLigne) return;
    const co = S.course, L = co.c.longueur, e = v.etat, tPas = S.enLigne.T0 + co.horloge * 1000, f = Math.exp(-dt / .12);
    const pred = B.reseau.prolonger(r.etat, (tPas - r.t) / 1000, co.c, EL.pred);
    let corr = EL.corr.get(v.id);
    if (!corr) EL.corr.set(v.id, corr = { s: 0, d: 0, psi: 0, r });
    else if (corr.r !== r) {
      const vieux = B.reseau.prolonger(corr.r.etat, (tPas - corr.r.t) / 1000, co.c, EL.vieux);
      let ds = vieux.s + corr.s * f - pred.s; if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      const dd = vieux.d + corr.d * f - pred.d;
      if (Math.abs(ds) < 8 && Math.abs(dd) < 4) { corr.s = ds; corr.d = dd; corr.psi = vieux.psi + corr.psi * f - pred.psi; } else corr.s = corr.d = corr.psi = 0;
      corr.r = r;
    } else { corr.s *= f; corr.d *= f; corr.psi *= f; }
    e.s = ramener(pred.s + corr.s, L); e.d = pred.d + corr.d; e.psi = pred.psi + corr.psi;
    for (const k of ['v', 'beta', 'omega', 'y', 'tangage', 'roulis', 'regime', 'volant', 'rapport', 'gaz', 'frein', 'braquage']) e[k] = pred[k];
  }
  for (const r of document.querySelectorAll('input[name="joueursIci"]')) r.checked = String(joueursIci()) === r.value;
  $('l-nom').value = reglages.nom || '';
  $('l-nom').addEventListener('input', e => { reglages.nom = e.target.value.slice(0, 16); sauverReglages(); });
  $('l-creer').addEventListener('click', async () => {
    const R = nouvelleLiaison(); etatEnLigne('Connexion au salon…');
    try { await R.creerSalon(); } catch (e) { etatEnLigne('Le salon ne répond pas. Réessayez plus tard.'); }
  });
  const rejoindre = async () => {
    const code = $('l-code').value.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) { etatEnLigne('Le code a quatre lettres.'); return; }
    const R = nouvelleLiaison(); etatEnLigne('Recherche de la partie ' + code + '…');
    try { await R.rejoindreSalon(code); } catch (e) { etatEnLigne('Le salon ne répond pas. Réessayez plus tard.'); }
  };
  $('l-rejoindre').addEventListener('click', rejoindre);
  $('p-touches').addEventListener('click', () => { retourReglages = 'preparation'; aller('reglages'); B.navigationMenu.ouvrirOnglet($('reglages'), 'r-commandes-panel', true); });
  $('p-reglages-pilote').addEventListener('click', () => { retourReglages = 'preparation'; aller('reglages'); B.navigationMenu.ouvrirOnglet($('reglages'), 'r-pilotage', true); });
  $('l-code').addEventListener('input', e => { const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); if (v !== e.target.value) e.target.value = v; });
  $('l-code-affiche').addEventListener('click', () => {
    const code = $('l-code-affiche').textContent;
    if (navigator.clipboard && code) navigator.clipboard.writeText(code).then(() => etatEnLigne('Code ' + code + ' copié. Envoyez-le à l’autre pilote.'), () => {});
  });
  $('l-code').addEventListener('keydown', e => { if (e.key === 'Enter') rejoindre(); });
  $('l-choisir').addEventListener('click', () => { modePrepa = 'enligne'; aller('preparation'); annoncerCourse(); });
  $('l-reglages').addEventListener('click', () => { retirerPret(); retourReglages = 'enligne'; aller('reglages'); });
  $('l-vers-prets').addEventListener('click', () => aller('prets'));
  $('pr-pret').addEventListener('click', basculerPret);
  $('pr-retour').addEventListener('click', quitterPrets);
  $('pr-reglages').addEventListener('click', () => { retirerPret(); retourReglages = 'prets'; aller('reglages'); });

  // ---------------------------------------------------------------- caméras
  // Champ du cockpit : réglage en degrés horizontaux mesurés en 16:9 (60° par défaut, 36° verticaux). Plus large
  // que 16:9, le champ vertical est gardé ; plus étroit (fenêtre presque carrée, portrait), la diagonale du cadre de
  // référence 16:9 : garder tout le champ horizontal ouvrait 66° verticaux dans une fenêtre carrée, d'où des bras
  // interminables et une image déformée (David, 16/11 : « fov moins prononcé », « bras de 10 km »). Sur téléphone,
  // David demande un champ plus serré (16/11) : tangente réduite de 18 %. L'ouverture avec la vitesse est discrète
  // (5 %, 4 % sur téléphone). Le curseur reste mémorisé.
  function champCockpit(aspect, v) {
    const t = Math.tan(clamp(+reglages.champ || 60, 60, 105) * Math.PI / 360);
    const tv = aspect < 16 / 9 ? Math.hypot(t, t / (16 / 9)) / Math.hypot(1, Math.max(.3, aspect)) : t / (16 / 9);
    const portraitTelephone = estTactile && canvas.clientWidth <= 600 && aspect < 1;
    const vertical = 2 * Math.atan(tv * (portraitTelephone ? .82 : 1)) * 180 / Math.PI;
    return clamp(vertical * (1 + (portraitTelephone ? .04 : .05) * clamp(v / 85, 0, 1)), 10, 110);
  }
  // La tête du pilote vit : elle part vers l'extérieur du virage et vers l'avant au freinage (2 cm au plus), le regard
  // va vers la corde (4° au plus), et le casque tremble à haute vitesse, sur les vibreurs et dans l'herbe.
  function cameraCockpit(S, p, et, t, dt) {
    const T = S.tete || (S.tete = { lat: 0, lon: 0, regard: 0 }), k = 1 - Math.exp(-dt * 7);
    T.lat += (clamp(et.alat / 26, -1, 1) - T.lat) * k;
    T.lon += (clamp(et.along / 22, -1, 1) - T.lon) * k;
    T.regard += (clamp(et.volant, -1, 1) * clamp(et.v / 28, 0, 1) - T.regard) * (1 - Math.exp(-dt * 3.5));
    const OE = B.voiture.OEIL, M = B.voiture.attitude(p.cap, p.tangage, p.roulis);
    const o = B.voiture.mul(M, [OE[0] - T.lon * .02, OE[1] - Math.max(0, -T.lon) * .006, OE[2] - T.lat * .016]);
    const vib = (et.surface === 'vibreur' ? .006 : et.surface === 'herbe' ? .004 * Math.min(1, et.v / 20) : 0) + .0011 * Math.pow(clamp(et.v / 85, 0, 1), 2);
    return {
      pos: [p.x + o[0], p.y + o[1] + Math.sin(t * 73) * vib * reglages.secousses, p.z + o[2]], yaw: p.cap + Math.PI / 2 + T.regard * .07,
      pitch: p.tangage * .85 + Math.min(0, T.lon) * .012, roll: -p.roulis * .85 + T.lat * .014,
      fov: champCockpit(canvas.clientWidth / Math.max(1, canvas.clientHeight), et.v), near: .1, far: PORTEE_VUE
    };
  }
  // Écran partagé : la poursuite garde la diagonale du cadre 16:9 dans une moitié plus large ou plus étroite
  function champAdapte(f) {
    const a = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    if (!session || session.type !== 'duo' || Math.abs(a - 16 / 9) < .05) return f;
    const t = Math.tan(f * Math.PI / 360);
    return 2 * Math.atan(Math.hypot(t, t * 16 / 9) / Math.hypot(1, a)) * 180 / Math.PI;
  }
  function cameraPoursuite(S, p, et, dt) {
    if (S.camCap === null) S.camCap = p.cap;
    S.camCap += angle(p.cap - S.camCap) * (1 - Math.exp(-dt * 5.5));
    const dist = 7.4, cx = p.x - Math.cos(S.camCap) * dist, cz = p.z - Math.sin(S.camCap) * dist;
    const sol = scene.decor.sol ? scene.decor.sol(cx, cz) : p.y;
    const y = Math.max(p.y + 2.45, (isFinite(sol) ? sol : p.y) + 1.4);
    return { pos: [cx, y, cz], yaw: S.camCap + Math.PI / 2, pitch: -.12 - (y - p.y - 2.45) * .06, roll: 0, fov: champAdapte(64 + 8 * clamp(et.v / 85, 0, 1)), near: .1, far: PORTEE_VUE };
  }
  // hélicoptère (démo) : en arrière et au-dessus de la voiture suivie, cap lissé ; vise un peu devant elle
  function cameraHelico(S, p, dt) {
    if (S.camCap === null) S.camCap = p.cap;
    S.camCap += angle(p.cap - S.camCap) * (1 - Math.exp(-dt * 1.4));
    const cx = p.x - Math.cos(S.camCap) * 30, cz = p.z - Math.sin(S.camCap) * 30, sol = scene.decor.sol ? scene.decor.sol(cx, cz) : p.y;
    const y = Math.max(p.y, isFinite(sol) ? sol : p.y) + 21;
    const dx = p.x + Math.cos(p.cap) * 10 - cx, dy = p.y + .5 - y, dz = p.z + Math.sin(p.cap) * 10 - cz, dist = Math.hypot(dx, dy, dz) || 1;
    return { pos: [cx, y, cz], yaw: Math.atan2(dx, -dz), pitch: Math.asin(clamp(dy / dist, -1, 1)), roll: 0, fov: 38, near: .1, far: PORTEE_VUE };
  }
  // caméra de télévision : postes au bord de la piste, en avant de la voiture suivie
  function cameraTele(S, v, p) {
    const c = S.course.c, T = S.tele, s = v.etat.s;
    if (!T.poste || B.circuit.ecart(c, T.poste.s, s) > 18 || B.circuit.ecart(c, T.poste.s, s) < -200) {
      let sp = ramener(s + 60 + T.alea() * 60, c.longueur);
      if (B.circuit.dansTunnel(c, sp, 25)) sp = ramener(c.tunnel.fin + 30 + T.alea() * 30, c.longueur);   // pas de caméra dans la roche
      const e = B.circuit.echantillon(c, sp);
      const cote = e.courbure > 1e-4 ? -1 : e.courbure < -1e-4 ? 1 : (T.alea() < .5 ? -1 : 1);
      // derrière la glissière ; le long des tribunes et des stands, sur l'accotement, plus bas, pour rester devant eux
      const zone = scene.decor.enceinte, rel = B.circuit.ecart(c, 0, sp), serre = !!zone && rel > zone.debut && rel < zone.fin;
      const d = cote * (serre ? c.largeur / 2 + 2.2 + T.alea() * 1.6 : B.conduite.limiteCote(c, sp, cote) + 2.5 + T.alea() * 3), sa = Math.sin(e.cap), ca = Math.cos(e.cap);
      const x = e.x - sa * d, z = e.z + ca * d, sol = scene.decor.sol ? scene.decor.sol(x, z) : e.y;
      T.poste = { s: sp, pos: [x, Math.max(e.y, isFinite(sol) ? sol : e.y) + (serre ? 1.5 + T.alea() * 2 : 2.2 + T.alea() * 4.5), z] };
    }
    const q = T.poste.pos, dx = p.x - q[0], dy = p.y + .55 - q[1], dz = p.z - q[2], dist = Math.hypot(dx, dy, dz) || 1;
    return { pos: q.slice(), yaw: Math.atan2(dx, -dz), pitch: Math.asin(clamp(dy / dist, -1, 1)), roll: 0, fov: clamp(2 * Math.atan(7.5 / dist) * 180 / Math.PI, 10, 50), near: .1, far: PORTEE_VUE };
  }

  // Caméras de la démo (David, 16/11 : « des démos plus impressionnantes, avec de l'action, des vues différentes »).
  // Portées par la voiture filmée (son attitude) ou posées autour d'elle ; le plan dit de quel côté (milieu de piste).
  const VUES_DEHORS = new Set(['tele', 'helico', 'orbite', 'travelling', 'sol']);
  const DANS_LA_ROCHE = new Set(['helico', 'orbite', 'travelling']);   // sous le tunnel, ces caméras seraient dans la montagne
  const CAMERAS_DEMO = new Set(['roue', 'aileron', 'arriere', 'travelling', 'orbite']);
  function cameraDemo(S, p, plan) {
    const M = B.voiture.attitude(p.cap, p.tangage, p.roulis), pt = o => { const q = B.voiture.mul(M, o); return [p.x + q[0], p.y + q[1], p.z + q[2]]; };
    const vise = (pos, cible, fov) => { const dx = cible[0] - pos[0], dy = cible[1] - pos[1], dz = cible[2] - pos[2], d = Math.hypot(dx, dy, dz) || 1;
      return { pos, yaw: Math.atan2(dx, -dz), pitch: Math.asin(clamp(dy / d, -1, 1)), roll: 0, fov, near: .1, far: PORTEE_VUE }; };
    const cote = plan.cote || 1, age = S.course.horloge - plan.debut;
    switch (plan.vue) {
      case 'roue':        // au ras du ponton, la roue avant au premier plan et la piste qui file
        return { pos: pt([-.05, .40, cote * 1.13]), yaw: p.cap + Math.PI / 2 - cote * .07, pitch: -.025 + p.tangage * .85, roll: -p.roulis * .85, fov: 66, near: .05, far: PORTEE_VUE };
      case 'aileron':     // au-dessus de l'arceau, comme les caméras de télévision : casque et nez devant
        return { pos: pt([-.66, 1.17, 0]), yaw: p.cap + Math.PI / 2, pitch: -.12 + p.tangage * .85, roll: -p.roulis * .85, fov: 58, near: .05, far: PORTEE_VUE };
      case 'arriere':     // sur l'aileron arrière, regard vers le poursuivant
        return { pos: pt([-1.95, 1.1, 0]), yaw: p.cap - Math.PI / 2, pitch: -.075 - p.tangage * .85, roll: p.roulis * .85, fov: 46, near: .05, far: PORTEE_VUE };
      case 'travelling':  // grue qui roule à côté de la voiture et se laisse doucement distancer ; le décor file
        return vise(pt([1.6 - age * .45, 1.15, cote * 6.4]), pt([.2, .45, 0]), 38);
      default: {          // orbite : tour lent autour de la voiture, plus serré pendant une action
        const a = plan.angle + age * .34 * cote, r = plan.motif === 'action' ? 6.2 : 7.8;
        return vise(pt([Math.cos(a) * r, 1.6 + .5 * Math.sin(age * .5), Math.sin(a) * r]), pt([0, .5, 0]), 44);
      }
    }
  }
  // au ras de la piste, à son bord, un peu devant la voiture : elle arrive, passe tout près, et la caméra la suit
  function cameraSol(S, v, p) {
    const c = S.course.c, s = v.etat.s, plan = S.planVu;
    if (!S.sol || S.sol.plan !== plan) {
      let sp = ramener(s + 55 + plan.angle * 4, c.longueur);
      if (B.circuit.dansTunnel(c, sp, 25)) sp = ramener(c.tunnel.fin + 30, c.longueur);
      const e = B.circuit.echantillon(c, sp);
      const cote = e.courbure > 1e-4 ? 1 : e.courbure < -1e-4 ? -1 : plan.cote;
      const d = cote * (c.largeur / 2 + 1.1), x = e.x - Math.sin(e.cap) * d, z = e.z + Math.cos(e.cap) * d;
      const sol = scene.decor.sol ? scene.decor.sol(x, z) : e.y;
      S.sol = { plan, pos: [x, Math.max(e.y, isFinite(sol) ? sol : e.y) + .32, z] };
    }
    const q = S.sol.pos, dx = p.x - q[0], dy = p.y + .4 - q[1], dz = p.z - q[2], dist = Math.hypot(dx, dy, dz) || 1;
    return { pos: q.slice(), yaw: Math.atan2(dx, -dz), pitch: Math.asin(clamp(dy / dist, -1, 1)), roll: 0, fov: clamp(2 * Math.atan(5 / dist) * 180 / Math.PI, 28, 70), near: .1, far: PORTEE_VUE };
  }

  // ---------------------------------------------------------------- paliers de la qualité Auto
  // En qualité Auto, quand les images ralentissent (moins de 50 i/s pendant 3 s, volet visible), le jeu
  // retire un effet coûteux après l'autre : image réelle des rétroviseurs, ombres, halo et reflets, puis il baisse la
  // résolution (palier 4). Il remonte d'un palier après 8 s sous 14 ms. Le gouverneur de résolution du moteur
  // continue d'agir dans chaque palier. Les qualités Légère et Fine restent fixes.
  const palier = { n: 0, somme: 0, compte: 0, t: 0, aise: 0 };
  const PALIERS = 4;
  // ---------------------------------------------------------------- profils graphiques du menu
  // src/graphismes.js est la seule source des paliers : le menu (Légère, Moyenne, Fine, Auto), le gouverneur
  // Auto de src/qualite.js et les capacités réellement ouvertes par FRender.create s'y rejoignent. Le gouverneur
  // reste seul décideur du niveau ; ici on traduit ce niveau en budget et on retarde l'application d'un palier
  // pour qu'une fluctuation isolée ne fasse rien payer deux fois.
  const etatProfils = B.graphismes.etatStable();
  let capacitesRendu = B.graphismes.capacites({ msaa: 0, shadowMapScale: 1, reflections: false }, true, 1);
  const horlogeProfils = () => performance.now() / 1000;
  function profilDe(S) {
    return B.graphismes.melange(S && S.banc ? S.banc.qualite : reglages.qualite, palier.n,
      { decor: etatProfils.decor, capacites: capacitesRendu, options: reglages });
  }
  // Le décor (matières et massifs) est bâti une fois par séance sur un palier « ancre ». Le gouverneur Auto ne le
  // fait jamais bouger en pleine course : rebâtir nappes, lots et tampons au milieu d'une course toucherait les
  // stands, les caméras et les rétroviseurs. Le budget du décor suit donc l'ancre et prend effet à la séance
  // suivante ; tout le reste — résolution, ombres, halo, reflets, glaces, cadence du second joueur — s'applique
  // à l'image, sans redémarrer la course.
  function majProfils(S) {
    return B.graphismes.stabiliser(etatProfils, S && S.banc ? S.banc.qualite : reglages.qualite,
      palier.n, horlogeProfils());
  }
  function majPalier(S, dt) {
    const actif = reglages.qualite === 'auto' && !S.banc && !S.reference && !document.hidden &&
      (S.type === 'course' || S.type === 'chrono' || S.type === 'demo' || S.type === 'duo');
    const change = B.qualite.avancer(palier, dt, { actif, min: gpuModeste ? 1 : 0, max: PALIERS });
    majProfils(S);
    if (change) appliquerPalier();
  }
  function appliquerPalier() { if (rendu) rendu.resize(profilDe(session).rendu.resolution); }
  // effets permis par le profil résolu : menu, gouverneur et capacités du moteur, en un seul endroit
  const avecOmbres = P => P.effets.ombres;
  const avecHalo = P => P.effets.halo;
  // Reflets d'écran (David, 16/11 : « améliore le rendu, reflets ») : sur piste mouillée, les voitures, le ciel et les
  // lampes du tunnel se reflètent dans les flaques (matières humides du moteur repris d'EMPRISE). Le profil les ouvre
  // (Fine, ou Auto au premier palier) et refuse déjà un processeur graphique modeste : le moteur n'a de toute façon
  // pas ouvert la capacité à la création.
  // Le moteur ne propose ce rendu que tout ou rien (fx.reflections) : l'intensité ne se règle pas ici, dans un module
  // verrouillé. Ce qui l'est, c'est le franchissement du seuil. L'humidité de la piste monte et redescend en continu
  // sous la pluie ; franchir un seul seuil faisait clignoter le rendu aller-retour autour de la valeur. Deux seuils
  // (prise puis relâchement) et un état mémorisé par séance suppriment l'oscillation.
  const REFLET_PRISE = .2, REFLET_LACHE = .12;
  function avecReflets(S, P, m) {
    const peutEtre = P.effets.reflets && !!m;
    const eau = peutEtre ? Math.max(m.mouille || 0, m.pluie || 0) : 0;
    const etat = S.refletsEcran === true;
    const pris = etat ? eau >= REFLET_LACHE : eau >= REFLET_PRISE;
    S.refletsEcran = pris;
    return pris;
  }

  // ---------------------------------------------------------------- tunnel : lampes et abri, selon la caméra
  // L'œil s'adapte et les lampes éclairent d'après ce que VOIT la caméra, pas seulement d'après l'abscisse de la
  // voiture suivie : en poursuite, en poursuite rapprochée ou à deux, la caméra peut être encore sous la voûte quand
  // la voiture en est sortie, ou l'inverse. L'axe du tunnel est échantillonné une fois par scène (une vingtaine de
  // points, la portion est droite par construction) ; le test d'une caméra ne coûte ensuite qu'une comparaison.
  const TUNNEL_PAS = 10, TUNNEL_MARGE = 3;
  const tunnel = { scene: -1, n: 0, axe: null, demi: 0 };
  function preparerTunnel(c) {
    if (tunnel.scene === scene.index) return tunnel.n > 0;
    tunnel.scene = scene.index; tunnel.n = 0;
    const t = c && c.tunnel;
    if (!t) return false;
    const n = Math.max(2, Math.round((t.fin - t.debut) / TUNNEL_PAS) + 1);
    if (!tunnel.axe || tunnel.axe.length < n * 2) tunnel.axe = creationTardive('axeTunnel', new Float64Array(n * 2));
    for (let i = 0; i < n; i++) { const e = B.circuit.echantillon(c, t.debut + (t.fin - t.debut) * i / (n - 1)); tunnel.axe[2 * i] = e.x; tunnel.axe[2 * i + 1] = e.z; }
    tunnel.n = n; tunnel.demi = t.mur + TUNNEL_MARGE;
    return true;
  }
  // la caméra (ou tout point) est-elle sous la voûte, ou juste devant un portail ?
  function sousLaVoute(c, p) {
    if (!preparerTunnel(c)) return false;
    const x = p[0], z = p[2], A = tunnel.axe;
    let dm = Infinity;
    for (let i = 0; i < tunnel.n; i++) { const dx = A[2 * i] - x, dz = A[2 * i + 1] - z, d = dx * dx + dz * dz; if (d < dm) dm = d; }
    return dm < tunnel.demi * tunnel.demi;
  }

  // Une lampe n'éclaire que ce qui est près d'elle : le moteur éteint toute lampe de portée 18 m au-delà de 18 m
  // (atténuation du shader) et n'en retient que huit par rendu. Les choisir à 70 m à la volée, triées à chaque image,
  // les faisait basculer par blocs de douze watts. La contribution de chaque lampe suit maintenant une rampe continue
  // qui s'achève au-delà de la portée réelle du moteur : la lumière monte et redescend, elle ne bascule pas. Le
  // lissage anti-tremblement ne sert qu'à cela : le seuil d'extinction est appliqué à la cible, jamais à la valeur
  // lissée, sinon une lampe dont la cible reste sous le seuil ne s'allumerait plus jamais.
  const LAMPE_PUISSANCE = 12, LAMPE_PORTEE = 18, LAMPE_RAYON = 20, LAMPE_PLAT = .5, LAMPE_MIN = .35, LAMPE_MAX = 8, LAMPE_LISSAGE = .08;
  const COULEUR_LAMPE = [1, .84, .58];
  function nouvelEtatLampes(rev, n) {
    const e = { rev, n, p: new Float64Array(n), hors: [], pool: [] };
    for (let k = 0; k < LAMPE_MAX; k++) e.pool.push({ p: null, power: 0, range: LAMPE_PORTEE, color: COULEUR_LAMPE });
    return e;
  }
  // état de départ d'une caméra sans rien réallouer : toutes les lampes éteintes, comme un état neuf
  function remettreLampes(porteur) {
    for (const cle of ['lampesTunnel', 'lampes0', 'lampes1']) {
      const e = Object.prototype.hasOwnProperty.call(porteur, cle) && porteur[cle];
      if (e && e.p) e.p.fill(0);
    }
  }
  // porteur/clé isolent l'état temporel de chaque caméra : la vue de J1, celle de J2 et chaque glace ont leur propre
  // lissage. Le tableau rendu est celui de l'état : le moteur le lit pendant le draw, rien n'est alloué par image.
  function lampesTunnel(porteur, cle, LT, cam, dtImage, rev) {
    if (!LT || !LT.length) return null;
    let et = porteur[cle];
    if (!et || et.rev !== rev || et.n !== LT.length) et = porteur[cle] = creationTardive('lampes', nouvelEtatLampes(rev, LT.length));
    const k = 1 - Math.exp(-Math.max(0, dtImage) / LAMPE_LISSAGE), r = LAMPE_RAYON, plat = r * (1 - LAMPE_PLAT);
    const cx = cam.pos[0], cz = cam.pos[2], P = et.p, n = et.n;
    for (let i = 0; i < n; i++) {
      const q = LT[i], dx = q[0] - cx, dz = q[2] - cz, d = Math.sqrt(dx * dx + dz * dz);
      let cible = 0;
      if (d < r) { const u = d <= plat ? 1 : (r - d) / (r - plat); cible = LAMPE_PUISSANCE * u * u * (3 - 2 * u); }
      const v = P[i] + (cible - P[i]) * k;
      P[i] = cible === 0 && v < LAMPE_MIN ? 0 : v;
    }
    // les contributions les plus fortes, sans tri ni allocation ; la sélection ne peut plus osciller, les valeurs
    // montent et descendent en continu et le plafond de huit n'est jamais atteint à la limite du cône d'éclairage
    let compte = 0;
    for (let i = 0; i < n; i++) {
      const v = P[i];
      if (v <= 0) continue;
      if (compte < LAMPE_MAX) { const o = et.pool[compte++]; o.p = LT[i]; o.power = v; }
      else {
        let min = 0;
        for (let j = 1; j < LAMPE_MAX; j++) if (et.pool[j].power < et.pool[min].power) min = j;
        if (v > et.pool[min].power) { const o = et.pool[min]; o.p = LT[i]; o.power = v; }
      }
    }
    if (!compte) return null;
    const hors = et.hors; hors.length = 0;
    for (let j = 0; j < compte; j++) hors.push(et.pool[j]);
    return hors;
  }

  // ---------------------------------------------------------------- rétroviseurs
  // David (16/11) : « les deux rétros bien visibles et bien foutus ». En vue cockpit, chaque glace reçoit l'image
  // réelle de la scène arrière : un second rendu FERRO, sur une petite toile hors de l'écran, depuis la glace et dans
  // la direction qu'elle renvoie à l'œil (glace légèrement bombée : 34° de champ), une glace par image (30 Hz chacune).
  // L'image est copiée dans la toile de la glace, retournée comme dans un miroir et posée sur les quatre coins
  // projetés de la glace par une transformation projective (matrix3d). Ce rendu a ses propres copies des nappes et
  // des lots : le moteur range ses tampons dans les lots. Réglage « Image des rétroviseurs » : image simple (fond
  // dessiné dans la glace) en qualité basse et, par défaut, sur écran tactile.
  const retro = { rendu: null, scene: -1, cote: 0, echec: false, objets: [], toiles: null, ctx: [], l: 0, h: 0 };
  function retroVoulu(S, vue) {
    const r = reglages.retro === 'auto' ? (estTactile ? 'non' : 'oui') : reglages.retro;
    // Le profil décide : image des glaces refusée d'office au palier bas et aux paliers Auto les plus serrés.
    return r === 'oui' && vue === 'cockpit' && S.type !== 'vitrine' && !retro.echec && !cameraEssai && profilDe(S).effets.retroImages;
  }
  // Le second moteur, sa copie du décor et les toiles des quatre glaces naissent au chargement, jamais dans le
  // chemin d'une image : tant que la copie n'est pas prête, la glace reste peinte (fond dessiné du cockpit).
  function glacesDe(cle) {
    return retro[cle] || (retro[cle] = creationTardive('glaces', { toiles: cle === 'j2' ? [$('glace-g2'), $('glace-d2')] : [$('glace-g'), $('glace-d')], ctx: [], cote: 0 }));
  }
  // la séance (ou n'importe quelle course si S est nul) peut-elle montrer des glaces vives, à un palier quelconque
  // que le gouverneur Auto peut atteindre ?
  function glacesPossibles(S) {
    const r = reglages.retro === 'auto' ? (estTactile ? 'non' : 'oui') : reglages.retro, type = S ? S.type : 'course';
    if (r !== 'oui' || retro.echec || type === 'vitrine' || !window.FRender) return false;
    return profilsAtteignables(type, S).some(P => P.effets.retroImages);
  }
  function creerMoteurRetro() {
    if (retro.rendu || retro.echec) return !!retro.rendu;
    try {
      retro.rendu = window.FRender.create($('retro-rendu'), { msaa: 0, shadowMapScale: 1, reflections: false, sea: false, overlayLighting: 'world' });
      retro.rendu.resize(Math.min(window.devicePixelRatio || 1, 1.5));
      if (retro.rendu.retain) retro.rendu.retain(true);   // FERRO 0.3.10 : cibles gardées malgré 120 rendus sans usage
    } catch (e) {
      console.warn('BITUME : image des rétroviseurs indisponible', e); retro.rendu = null; retro.echec = true;
      for (const G of [retro.j1, retro.j2]) if (G) for (const t of G.toiles) t.hidden = true;
    }
    return !!retro.rendu;
  }
  // même décor et même clé de scène que le moteur principal ; le moteur range ses tampons dans les lots : copies
  function installerRetro() {
    if (!retro.rendu || !scene || retro.scene === scene) return;
    const d = scene.decor;
    retro.rendu.setWorld([], [], d.atmosphere);
    retro.rendu.setNappes(d.nappes.map(n => Object.assign({}, n)));
    retro.rendu.setLots(d.lots.map(l => Object.assign({}, l, { tampon: null, tamponLoin: null, paquet: null, paquetLoin: null })));
    retro.scene = scene;
  }
  function preparerGlaces() {
    if (!creerMoteurRetro()) return false;
    installerRetro();
    const source = $('retro-rendu'), LT = scene && scene.decor.tunnelLampes;
    for (const cle of ['j1', 'j2']) {
      const G = glacesDe(cle);
      if (!G.ctx.length) G.toiles.forEach((t, i) => { t.width = source.width; t.height = source.height; t.style.width = source.clientWidth + 'px'; t.style.height = source.clientHeight + 'px'; G.ctx[i] = t.getContext('2d'); });
      if (LT && LT.length) for (const k of ['lampes0', 'lampes1']) if (!G[k] || G[k].rev !== scene.index || G[k].n !== LT.length) G[k] = nouvelEtatLampes(scene.index, LT.length);
    }
    return true;
  }
  const glacesPretes = G => !!retro.rendu && retro.scene === scene && !!G && G.ctx.length === 2;
  const glacesVives = (S, vue) => retroVoulu(S, vue) && glacesPretes(S !== session ? retro.j2 : retro.j1);
  // homographie du carré unité vers le quadrilatère q (images de (0,0), (1,0), (1,1), (0,1)), puis matrix3d CSS
  // pour une toile de l × h pixels CSS
  function matrice3d(q, l, h) {
    const [x0, y0] = q[0], [x1, y1] = q[1], [x2, y2] = q[2], [x3, y3] = q[3];
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    const det = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(det) < 1e-9) return null;
    const g = (sx * dy2 - dx2 * sy) / det, k = (dx1 * sy - sx * dy1) / det;
    const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
    const v = [a / l, d / l, 0, g / l, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1];
    return v.every(Number.isFinite) ? 'matrix3d(' + v.map(x => +x.toFixed(6)).join(',') + ')' : null;
  }
  function majGlaces(S, vue, cam, ps, sortie, ambiance, suivie, dtImage) {
    // à deux, le joueur 2 a ses deux glaces, posées sur sa moitié ; chaque joueur rafraîchit une glace par image
    const G = glacesDe(S !== session ? 'j2' : 'j1');
    const toiles = G.toiles;
    const voir = glacesVives(S, vue);
    for (const t of toiles) if (t.hidden === voir) t.hidden = !voir;
    if (!voir) return;
    // Cadence des glaces (src/graphismes.js) : une glace par image donne déjà 30 images/s par glace. Les paliers
    // serrés peignent une image sur deux, sur quatre, et laissent à l'écran la dernière image faite, au lieu de
    // payer un rendu complet pour un miroir que l'œil ne distingue plus.
    const P = profilDe(S), hzGlaces = P.secondaires.retroviseurs.hz;
    const saut = Math.max(1, Math.round(30 / Math.max(1, hzGlaces)));
    G.pas = ((G.pas | 0) + 1) % saut;
    if (G.pas) return;
    const source = $('retro-rendu');
    // axes de la caméra principale, comme le moteur (cameraAxes) : chaque coin de glace projeté à l'écran
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cr = Math.cos(cam.roll || 0), sr = Math.sin(cam.roll || 0);
    const r0 = [cy, 0, sy], u0 = [-sy * sp, cp, cy * sp];
    const dr = r0.map((v, i) => v * cr + u0[i] * sr), up = u0.map((v, i) => v * cr - r0[i] * sr), av = [sy * cp, sp, -cy * cp];
    const L = canvas.clientWidth, H = canvas.clientHeight, t = Math.tan(cam.fov * Math.PI / 360), asp = L / Math.max(1, H);
    const ecran = p => {
      const q = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]], z = q[0] * av[0] + q[1] * av[1] + q[2] * av[2];
      if (z < .05) return null;
      return [((q[0] * dr[0] + q[1] * dr[1] + q[2] * dr[2]) / (z * t * asp) + 1) / 2 * L, (1 - (q[0] * up[0] + q[1] * up[1] + q[2] * up[2]) / (z * t)) / 2 * H];
    };
    const glaces = B.voiture.glacesCockpit({ p: [ps.x, ps.y, ps.z], cap: ps.cap, tangage: ps.tangage, roulis: ps.roulis });
    const l = source.clientWidth, h = source.clientHeight;
    glaces.forEach((g, i) => {
      // image retournée : son coin haut gauche va au coin haut droit de la glace
      const q = [g.coins[1], g.coins[0], g.coins[3], g.coins[2]].map(ecran), m = q.every(Boolean) ? matrice3d(q, l, h) : null;
      if (!m) { toiles[i].style.visibility = 'hidden'; return; }
      toiles[i].style.visibility = ''; toiles[i].style.transform = m;
    });
    // une glace par image : la caméra est à la glace et regarde dans la direction réfléchie du regard
    const g = glaces[G.cote], i = G.cote; G.cote = 1 - G.cote;
    // Comme un vrai rétroviseur réglé par le pilote, le regard est ouvert de 9° vers l'extérieur et passe un peu
    // au-dessus de la caisse : la roue arrière et le ponton n'occupent que le bord intérieur de la glace.
    const d0 = g.centre.map((v, k) => v - cam.pos[k]), dn = Math.hypot(d0[0], d0[1], d0[2]) || 1, dv = d0.map(v => v / dn);
    const pn = dv[0] * g.normale[0] + dv[1] * g.normale[1] + dv[2] * g.normale[2], rf = dv.map((v, k) => v - 2 * pn * g.normale[k]);
    const ouvre = g.k * .16, co = Math.cos(ouvre), so = Math.sin(ouvre), rx = rf[0] * co - rf[2] * so, rz = rf[0] * so + rf[2] * co;
    const pos = [g.centre[0], g.centre[1] + .1, g.centre[2]];
    const camR = { pos, yaw: Math.atan2(rx, -rz), pitch: Math.asin(clamp(rf[1], -1, 1)) + .06, roll: ps.roulis * .85, fov: 2 * Math.atan(Math.tan(16 * Math.PI / 180) * h / l) * 180 / Math.PI, near: .3, far: PORTEE_VUE };
    camR.sun = Object.assign({ center: [ps.x, ps.y, ps.z] }, scene.ombre);
    // tout sauf l'habitacle (pièces « overlay »), plus la roue arrière de la voiture elle-même, qui entre au bord
    // extérieur de la glace comme dans un vrai rétroviseur (le reste de la caisse boucherait la vue ; les dérives de
    // l'aileron arrière faisaient deux « carrés rouges », David 16/11)
    const objets = retro.objets; objets.length = 0;
    for (const o of sortie) if (!o.overlay) objets.push(o);
    const n0 = objets.length, ca = Math.cos(ps.cap), sa = Math.sin(ps.cap);
    B.voiture.poser(S.modeles[suivie.id], { p: [ps.x, ps.y, ps.z], cap: ps.cap, tangage: ps.tangage, roulis: ps.roulis, braquage: ps.braquage, roule: S.rouleVu ? S.rouleVu[suivie.id] : ps.roule, rebond: ps.rebond, v: suivie.etat.v }, objets, { roues: suivie.degats && suivie.degats.roues, casse: !!(suivie.etat.degats && suivie.etat.degats.casse) });
    for (let k = objets.length - 1; k >= n0; k--) {
      const o = objets[k], dx = o.p[0] - ps.x, dz = o.p[2] - ps.z, x = dx * ca + dz * sa, z = dz * ca - dx * sa;
      if (!(Math.abs(x - B.voiture.ROUES[2].x) < .5 && Math.abs(z) > .55)) objets.splice(k, 1);
    }
    if (S.nature && (retro.ambianceSource !== S.nature.ambiance || retro.ambianceRevision !== S.nature.ambiance.revision)) {
      if (retro.rendu.setEnvironment) retro.rendu.setEnvironment(S.nature.ambiance.atmosphere);
      retro.ambianceSource = S.nature.ambiance; retro.ambianceRevision = S.nature.ambiance.revision;
    }
    retro.rendu.draw(camR, objets, { time: horlogeReelle, shadows: false, bloom: false, torch: false, sunOnly: true, adaptive: false, frameMs: dureeImage, damage: 0, flash: 0, photo: 0, weather: ambiance, windSources: S.sillage && S.sillage.sources, windStrength: P.windStrength, groundCover: P.groundCover, lights: lampesTunnel(G, 'lampes' + i, scene.decor.tunnelLampes, camR, dtImage, scene.index) });
    if (B.mesures.actif) B.mesures.vue('retro', retro.rendu);
    const ctx = G.ctx[i];
    if (toiles[i].width !== source.width || toiles[i].height !== source.height) { toiles[i].width = source.width; toiles[i].height = source.height; }
    ctx.drawImage(source, 0, 0);
  }

  // ---------------------------------------------------------------- rendu d'une image
  const MATRICE_LAMPE = cap => {
    const e = B.voiture.euler, A = e(0, -cap, 0), Bm = e(0, 0, -Math.PI / 2);
    const m = [B.voiture.mul(A, Bm[0]), B.voiture.mul(A, Bm[1]), B.voiture.mul(A, Bm[2])];
    return B.voiture.angles(m);
  };
  const tampons = { poses: [], mel: {} };
  let horlogeReelle = 0, dureeImage = 16;

  function rendreImage(S, alpha, dtImage) {
    appliquerCarte();
    const co = S.course, j = co.joueur;
    const poses = tampons.poses;
    for (let k = 0; k < co.voitures.length; k++) poses[k] = melange(S.prec[k], S.cour[k], alpha, poses[k] || creationTardive('poses', {}));
    if (B.sillage) B.sillage.mettreAJour(S.sillage || (S.sillage = creationTardive('sillage', B.sillage.creer())), co.voitures, poses, co.c);
    if (B.mesures.actif) {
      let actives = 0;
      for (let k = 0; k < co.voitures.length; k++) if (!co.voitures[k].abandon && !co.voitures[k].fini) actives++;
      B.mesures.voitures(actives, co.voitures.length);
      const qVue = S.banc ? S.banc.qualite : reglages.qualite, pVue = profilDe(S);
      // le rapport garde la demande du menu ET le palier réellement rendu : « auto » n'est pas un palier
      B.mesures.reglages({ palier: qVue === 'auto' ? palier.n : null, qualite: qVue, profil: pVue.palier });
    }

    // Roues (David, 16/11 : « on voit pas les roues rouler, on dirait qu'on glisse ») : au-delà d'une vingtaine de
    // degrés par image, la rotation vraie se lit figée ou à l'envers (effet stroboscopique). L'angle dessiné suit la
    // distance roulée, mais avance d'au plus 0,11 m de bande par image (22° à l'avant) ; la suspension bat sur les
    // bosses, plus vite et un peu plus fort avec la vitesse (quelques millimètres, roue par roue).
    const nV = co.voitures.length, RV = S.rouleVu || (S.rouleVu = creationTardive('roues', new Float64Array(nV))), RP = S.rouleVrai || (S.rouleVrai = creationTardive('roues', new Float64Array(nV).fill(NaN)));
    for (let k = 0; k < nV; k++) {
      const p = poses[k], d = Number.isNaN(RP[k]) ? 0 : p.roule - RP[k];
      RP[k] = p.roule; RV[k] += Math.abs(d) > .11 ? Math.sign(d) * .11 : d;
      const v = Math.abs(co.voitures[k].etat.v), a = .0035 * clamp(v / 60, 0, 1) * (co.voitures[k].etat.surface === 'herbe' ? 3 : co.voitures[k].etat.surface === 'vibreur' ? 2.2 : 1);
      const reb = p.rebond || (p.rebond = creationTardive('rebond', [0, 0, 0, 0])), t = horlogeReelle, s0 = p.roule * 1.7;
      for (let r = 0; r < 4; r++) reb[r] = a * (Math.sin(s0 + r * 1.9) * .6 + Math.sin(s0 * 2.3 + r * .7 + t * 3) * .4);
    }
    const meteo = majMeteo(S, dtImage);
    S.ambianceImage = B.meteo.ambiance(meteo, S.ambianceImage || creationTardive('ambiance', {}));
    if (S.nature) {
      const nature = S.nature;
      if (nature.horlogeReelle) {
        const ms = nature.dateDepart != null ? nature.dateDepart + co.horloge * 1000 : Date.now();
        if (!nature.prochaineLumiereReelle || ms >= nature.prochaineLumiereReelle || ms < nature.prochaineLumiereReelle - 2000) {
          nature.nuitReelle = B.conditionsCourse.nuitReelle(ms, nature.horlogeReelle); nature.prochaineLumiereReelle = ms + 1000;
        }
      }
      const ambiance = nature.horlogeReelle ? B.ambiance.appliquerReel(nature.ambiance, nature.nuitReelle)
        : B.ambiance.appliquer(nature.ambiance, nature.moment || reglages.moment, co.horloge);
      if (nature.revisionRendu !== ambiance.revision) {
        if (rendu.setEnvironment) rendu.setEnvironment(ambiance.atmosphere);
        nature.revisionRendu = ambiance.revision;
      }
    }
    if (B.meteo) B.meteo.actuel = meteo;
    const P = profilDe(S);
    // Écran partagé : la vue du joueur 2 d'abord, copiée aussitôt dans sa toile 2D, puis celle du joueur 1, qui reste dans
    // la toile WebGL. Le moteur lit la taille affichée de sa toile à chaque image : il rend chaque vue à la moitié.
    if (S.type === 'duo' && S.vueJ2) {
      // Cadence du second joueur (src/graphismes.js) : au palier serré, le joueur 2 tient sur une image sur deux et
      // garde la dernière copiée ; le joueur 1 garde toute la fluidité de la sienne.
      S.j2Image = (S.j2Image | 0) + 1;
      if (P.secondaires.partage.hz >= 55 || S.j2Image % 2 === 0) {
        rendreVue(S.vueJ2, co.voitures[S.locaux[1]], reglages.vue2, dtImage, meteo);
        const t2 = $('scene2'), ctx2 = t2._ctx || (t2._ctx = creationTardive('toileJ2', t2.getContext('2d')));
        if (t2.width !== canvas.width || t2.height !== canvas.height) { t2.width = canvas.width; t2.height = canvas.height; }
        ctx2.drawImage(canvas, 0, 0);
      }
      return rendreVue(S, j, reglages.vue, dtImage, meteo);
    }
    // caméra : celle du joueur, ou celle que choisit le réalisateur de la démo
    let vue = reglages.vue, suivie = j;
    if (S.type === 'vitrine') { suivie = co.voitures[co.classement[S.suiviRang || 0]] || j; vue = 'tele'; }
    else if (S.type === 'demo') {
      const pl = B.realisateur.tenir(S.real, co);
      // coupe : les caméras lissées repartent de la nouvelle voiture, les écarts du son aussi
      if (S.planVu !== pl) { S.planVu = pl; S.camCap = null; S.tete = null; S.tele.poste = null; S.distances.fill(-1); S.vRel.fill(0); S.secousse = 0; }
      vue = pl.vue; suivie = co.voitures[pl.sujet];
    } else if (j.fini && S.finA !== null && co.horloge - S.finA > 2.5) vue = 'tele';
    return rendreVue(S, suivie, vue, dtImage, meteo);
  }
  // Une vue : caméra, objets, effets et rendu, pour la voiture suivie. S est l'état de la vue (la séance, ou celui du
  // joueur 2 à deux, qui hérite de la séance).
  function rendreVue(S, suivie, vue, dtImage, meteo) {
    const co = S.course, c = co.c, sortie = S.sortie, poses = tampons.poses, pj = poses[0], RV = S.rouleVu;
    const P = profilDe(S); // menu + gouverneur + capacités du moteur, décidé une fois par image
    sortie.length = 0;
    let cam;
    if (DANS_LA_ROCHE.has(vue) && B.circuit.dansTunnel(co.c, suivie.etat.s, 8)) vue = 'poursuite';
    const ps = poses[suivie.id], exterieur = VUES_DEHORS.has(vue);
    if (vue === 'tele') cam = cameraTele(S, suivie, ps);
    else if (vue === 'helico') cam = cameraHelico(S, ps, dtImage);
    else if (vue === 'sol') cam = cameraSol(S, suivie, ps);
    else if (CAMERAS_DEMO.has(vue)) cam = cameraDemo(S, ps, S.planVu);
    else cam = vue === 'cockpit' ? cameraCockpit(S, ps, suivie.etat, co.horloge, dtImage) : cameraPoursuite(S, ps, suivie.etat, dtImage);
    if (cameraEssai) cam = Object.assign({ roll: 0, near: .1, far: PORTEE_VUE, fov: 40 }, cameraEssai(pj, cam));
    if (S.secousse > 0) {
      const a = S.secousse * .05 * reglages.secousses, t = horlogeReelle;
      cam.pitch += Math.sin(t * 61) * a * .5; cam.yaw += Math.sin(t * 47) * a * .35;
      S.secousse = Math.max(0, S.secousse - dtImage * 2.6);
    }
    const fwd = [Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)];
    // ombres du soleil autour de ce que l'on regarde : devant le pilote (jusqu'à 176 m), ou autour de la voiture filmée
    cam.sun = Object.assign({ center: exterieur ? [ps.x, ps.y, ps.z] : [cam.pos[0] + fwd[0] * OMBRE_DEVANT, ps.y, cam.pos[2] + fwd[2] * OMBRE_DEVANT] }, scene.ombre);

    // Habitats partagés ; pools propres aux deux vues. Le temps absolu garde les mêmes vols dans les miroirs.
    if (S.nature && B.faune && P.faune !== 'off' && (!S.nature.saison || S.nature.saison.faune > 0)) {
      const nature = S.nature;
      if (!nature.faune) nature.faune = creationTardive('faune', B.faune.creer(c, scene.decor));
      const contexte = S.fauneVue || (S.fauneVue = creationTardive('contexteFaune', { qualite: P.faune, nuit: 0, pluie: 0, pose: ps, vue: S === session ? 0 : 1 }));
      contexte.qualite = P.faune; contexte.nuit = nature.ambiance.nuit; contexte.pluie = meteo.pluie || 0; contexte.pose = ps;
      contexte.activite = nature.saison ? nature.saison.faune : 1;
      B.faune.dessiner(nature.faune, horlogeReelle, contexte, sortie);
    }
    if (S.nature && B.effetsSaison && S.nature.saison && (S.nature.effetsSaison || S.nature.saison.feuilles || S.nature.saison.neige || meteo.neige)) {
      const nature = S.nature;
      if (!nature.effetsSaison) nature.effetsSaison = creationTardive('effetsSaison', B.effetsSaison.creer(c, scene.decor));
      const contexte = S.saisonVue || (S.saisonVue = creationTardive('contexteSaison', { qualite: 'low', nuit: 0, pluie: 0, neige: 0, ventX: 0, ventZ: 0, pose: cam.pos, vue: S === session ? 0 : 1, abri: false }));
      contexte.qualite = P.decor.vegetationQualite === 'ultra' ? 'ultra' : P.palier;
      contexte.nuit = nature.ambiance.nuit; contexte.pluie = meteo.pluie || 0;
      contexte.neige = precipitationsNeige(S);
      contexte.ventX = meteo.ventX || 0; contexte.ventZ = meteo.ventZ || 0; contexte.pose = cam.pos;
      contexte.abri = sousLaVoute(c, cam.pos) && cam.pos[1] < ps.y + (c.tunnel ? c.tunnel.hauteur : 5) + .5;
      B.effetsSaison.dessiner(nature.effetsSaison, horlogeReelle, contexte, sortie);
    }

    // Rubans lointains en géométrie monde : occultés par le relief, repris dans les rétroviseurs.
    if (S.nature && B.aurores && c.theme === 'islande') {
      const nature = S.nature;
      if (!nature.aurores) nature.aurores = creationTardive('aurores', B.aurores.creer(c));
      const contexte = S.auroresVue || (S.auroresVue = creationTardive('contexteAurores', { vue: S === session ? 0 : 1, qualite: 'low', nuit: 0, pluie: 0, neige: 0, nuages: 0, tunnel: false }));
      contexte.qualite = P.palier; contexte.nuit = nature.ambiance.nuit;
      contexte.pluie = meteo.pluie || 0; contexte.neige = precipitationsNeige(S); contexte.nuages = meteo.nuage || 0;
      contexte.tunnel = sousLaVoute(c, cam.pos) && cam.pos[1] < ps.y + (c.tunnel ? c.tunnel.hauteur : 5) + .5;
      B.aurores.dessiner(nature.aurores, co.horloge, contexte, sortie);
    }

    // voitures : toujours dessinées ; modèle complet tant qu'il tient plus d'une trentaine de pixels de haut, allégé
    // au-delà. Le seuil suit le champ : un téléobjectif garde le modèle complet bien plus loin.
    const complet = 170 * Math.tan(20.8 * Math.PI / 180) / Math.tan(clamp(cam.fov, 10, 110) * Math.PI / 360);
    for (let k = 0; k < co.voitures.length; k++) {
      const p = poses[k], dx = p.x - cam.pos[0], dz = p.z - cam.pos[2], d2 = dx * dx + dz * dz;
      const ev = { p: [p.x, p.y, p.z], cap: p.cap, tangage: p.tangage, roulis: p.roulis, braquage: p.braquage, roule: RV[k], rebond: p.rebond, v: co.voitures[k].etat.v };
      if (k === suivie.id && vue === 'cockpit') {
        // voitures derrière, dans le repère de celle-ci, de la plus proche à la plus lointaine : les rétroviseurs les montrent
        const et = suivie.etat, ca = Math.cos(p.cap), sa = Math.sin(p.cap), derriere = [];
        for (let q = 0; q < co.voitures.length; q++) {
          if (q === k) continue;
          const ex = poses[q].x - p.x, ez = poses[q].z - p.z, x = ex * ca + ez * sa;
          if (x < -1 && x > -95) derriere.push({ x, z: ez * ca - ex * sa, couleur: co.voitures[q].couleur });
        }
        derriere.sort((a, b) => b.x - a.x);
      const atm = S.nature ? S.nature.ambiance.atmosphere : scene.decor.atmosphere;
        B.voiture.cockpit(S.modeles[k], ev, sortie, { regime: et.regime, volant: et.volant, rapport: et.rapport, kmh: B.conduite.kmh(et), roues: co.voitures[k].degats && co.voitures[k].degats.roues, casse: !!(et.degats && et.degats.casse),
          passage: suivie.tPassage === undefined ? 1 : (co.horloge - suivie.tPassage) / .36, rapportAvant: suivie.rapportAvant, derriere, ciel: atm.skyBottom, brume: atm.fog,
          glaceVive: glacesVives(S, vue) });
        continue;
      }
      B.voiture.poser(S.modeles[k], ev, sortie, { simple: d2 > complet * complet, roues: co.voitures[k].degats && co.voitures[k].degats.roues, casse: !!(co.voitures[k].degats && co.voitures[k].degats.casse) });
    }
    // fantôme du meilleur tour
    if (co.mode === 'chrono') {
      const f = B.course.fantome(co);
      if (f) {
        const e = B.circuit.echantillon(c, f.s), sa = Math.sin(e.cap), ca = Math.cos(e.cap);
        const x = e.x - sa * f.d, z = e.z + ca * f.d, dx = x - pj.x, dz = z - pj.z;
        if (dx * dx + dz * dz > 9 || vue !== 'cockpit') B.voiture.fantome({ p: [x, e.y - f.d * Math.sin(e.devers), z], cap: e.cap + f.angle, tangage: Math.atan(e.pente), roulis: e.devers }, sortie);
      }
    }
    // feux du portique
    const port = scene.decor.portique;
    if (port && co.mode === 'course') {
      if (!S.rotLampe) S.rotLampe = creationTardive('feuxPortique', MATRICE_LAMPE(port.cap));
      for (let k = 0; k < port.feux.length; k++) {
        const allume = !co.feux.vert && k < co.feux.allumes;
        sortie.push({ shape: 'cylinder', p: port.feux[k], s: [.56, .05, .56], r: S.rotLampe, mat: allume ? 5 : 7, color: allume ? [1, .14, .06] : [.1, .03, .03], emissive: allume ? 3 : 0 });
      }
    }
    // traces de pneus, fumée et étincelles
    const tFx = (S.banc || B.mesures.actif) ? performance.now() : 0;
    B.traces.dessiner(S.fx, sortie, cam.pos, S.fx.acc);
    if (tFx) { const dFx = performance.now() - tFx; if (S.banc) S.banc.effets += dFx; if (B.mesures.actif) B.mesures.section('effets', dFx); }
    // uEffects.z colore tout l'écran : la rougeur suit seulement l'éclair du choc, jamais les dégâts persistants.
    const eclair = S.eclair || 0;
    // Tunnel : l'œil s'adapte d'après la caméra, pas d'après la seule voiture suivie. En entrant, l'intérieur paraît
    // d'abord sombre puis s'éclaircit (0,8 s) ; en sortant, le jour éblouit un instant (0,3 s). Les lampes gardent
    // leur puissance : seules l'adaptation de l'œil et les contributions lissées de lampesTunnel changent.
    const sousVoute = !VUES_DEHORS.has(vue) && sousLaVoute(c, cam.pos), cibleLumiere = sousVoute ? 1.32 : 1;
    S.lumiere = S.lumiere ?? 1;
    S.lumiere += (cibleLumiere - S.lumiere) * (1 - Math.exp(-dtImage / (cibleLumiere > S.lumiere ? .8 : .3)));
    const LT = scene.decor.tunnelLampes;
    const lampes = lampesTunnel(S, 'lampesTunnel', LT, cam, dtImage, scene.index);
    // Halo/bloom : ouverts ou fermés par le profil résolu (menu, gouverneur et capacités du moteur)
    const haloInt = avecHalo(P);
    const tDraw = B.mesures.actif ? performance.now() : 0;
    rendu.draw(cam, sortie, { time: horlogeReelle, msaa: P.rendu.msaa === 4, shadowMapScale: P.rendu.shadowMapScale, shadows: avecOmbres(P), bloom: haloInt, brightness: S.lumiere, lights: lampes, torch: false, sunOnly: true, adaptive: P.qualite === 'auto', frameMs: dureeImage, damage: eclair, flash: eclair, photo: haloInt ? 1 : 0, reflections: avecReflets(S, P, meteo), weather: S.ambianceImage, windSources: S.sillage && S.sillage.sources, windStrength: P.windStrength, groundCover: P.groundCover });
    if (B.mesures.actif) {
      B.mesures.section('rendu', performance.now() - tDraw);
      B.mesures.vue(S === session ? 'principale' : 'joueur2', rendu, { lampes: lampes ? lampes.length : 0, ombres: avecOmbres(P) });
    }
    dessinerMeteo(S, dtImage, cam, vue, P);
    majGlaces(S, vue, cam, ps, sortie, S.ambianceImage, suivie, dtImage);
    if (S.eclair > 0) S.eclair = Math.max(0, S.eclair - dtImage * 3.2);
    S.camera = cam; S.vue = vue; S.suivie = suivie.id;
    // En cockpit, la planche donne vitesse, rapport et régime : le tableau réduit retire plan et compteurs, qui
    // couvriraient les pneus avant.
    const reduit = vue === 'cockpit' && reglages.tableau === 'reduit' ? 'oui' : 'non';
    // à deux, chaque affichage suit la vue de son joueur
    const boite = S.type === 'duo' ? (S === session ? $('hud') : hud2) : jeu;
    if (boite.dataset.reduit !== reduit) boite.dataset.reduit = reduit;
    if (boite !== jeu && jeu.dataset.reduit !== 'non') jeu.dataset.reduit = 'non';
    return cam;
  }

  // ---------------------------------------------------------------- son de chaque image
  const sonRivaux = [], sonCandidats = [], sonJoueur2 = {};
  const etatSon = { pause: false, joueur: {}, joueur2: null, rivaux: sonRivaux };
  function decrireMoteur(sortie, S, voiture, cam) {
    const et = voiture.etat, exterieur = VUES_DEHORS.has(S.vue);
    sortie.id = voiture.id; sortie.regime = et.regime; sortie.gaz = et.gaz; sortie.rapport = et.rapport;
    sortie.v = Math.abs(et.v); sortie.glisse = et.glisse; sortie.surface = et.surface;
    sortie.turbo = et.turbo.reste > 0; sortie.vue = S.vue === 'cockpit' ? 'cockpit' : 'poursuite';
    sortie.muet = exterieur; sortie.tunnel = !exterieur && sousLaVoute(S.course.c, cam.pos);
  }
  function majSon(S, cam, dtImage) {
    if (!son || !sonActif) return;
    // la voiture entendue de l'intérieur est celle que l'on suit de près : le joueur, ou celle du plan de la démo
    const co = S.course, ks = S.suivie || 0, poses = tampons.poses;
    const S2 = S.type === 'duo' ? S.vueJ2 : null, cam2 = S2 && S2.camera, k2 = cam2 ? S.locaux[1] : -1;
    const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    const fx2 = cam2 ? Math.sin(cam2.yaw) : 0, fz2 = cam2 ? -Math.cos(cam2.yaw) : 0;
    const rx2 = cam2 ? Math.cos(cam2.yaw) : 0, rz2 = cam2 ? Math.sin(cam2.yaw) : 0;
    sonRivaux.length = 0;
    const exterieur = VUES_DEHORS.has(S.vue), exterieur2 = S2 && VUES_DEHORS.has(S2.vue), micro = exterieur && S.type === 'demo';
    for (let k = 0; k < co.voitures.length; k++) {
      if (k === ks && !exterieur) continue;
      if (k === k2 && !exterieur2) continue;
      const p = poses[k], dx = p.x - cam.pos[0], dy = p.y - cam.pos[1], dz = p.z - cam.pos[2], d = Math.hypot(dx, dy, dz);
      if (S.distances[k] >= 0 && dtImage > 0) S.vRel[k] = lerp(S.vRel[k], clamp((S.distances[k] - d) / dtImage, -120, 120), .2);
      S.distances[k] = d;
      let distance = d, direction = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz), vitesseRelative = S.vRel[k];
      // Les deux moteurs humains sont réservés. Pour les trois voix d'ambiance communes, retenir l'auditeur
      // le plus proche avec sa propre histoire de distances ; J2 éloigné ne devient jamais silencieux.
      if (cam2) {
        const dx2 = p.x - cam2.pos[0], dy2 = p.y - cam2.pos[1], dz2 = p.z - cam2.pos[2], d2 = Math.hypot(dx2, dy2, dz2);
        if (S2.distances[k] >= 0 && dtImage > 0) S2.vRel[k] = lerp(S2.vRel[k], clamp((S2.distances[k] - d2) / dtImage, -120, 120), .2);
        S2.distances[k] = d2;
        if (d2 < distance) { distance = d2; direction = Math.atan2(dx2 * rx2 + dz2 * rz2, dx2 * fx2 + dz2 * fz2); vitesseRelative = S2.vRel[k]; }
      }
      const v = co.voitures[k];
      // démo vue de l'extérieur : un micro d'ambiance rapproche les voitures (la caméra est à 30 à 120 m), l'effet Doppler reste celui de la caméra
      const r = sonCandidats[k] || (sonCandidats[k] = creationTardive('son', {}));
      r.id = k; r.distance = micro ? 2 + distance * .06 : distance; r.angle = direction;
      r.regime = v.etat.regime; r.gaz = v.etat.gaz; r.vRel = vitesseRelative;
      sonRivaux.push(r);
    }
    etatSon.pause = ecran === 'pause';
    decrireMoteur(etatSon.joueur, S, co.voitures[ks], cam);
    etatSon.joueur2 = cam2 ? sonJoueur2 : null;
    if (cam2) decrireMoteur(sonJoueur2, S2, co.voitures[k2], cam2);
    son.mettreAJour(etatSon, dtImage);
  }

  // ---------------------------------------------------------------- affichage de course
  const H = {};
  for (const id of ['h-pos', 'h-sur', 'h-tour', 'h-tours', 'h-actuel', 'h-meilleur', 'h-delta', 'h-delta-ligne', 'h-vitesse', 'h-rapport', 'h-regime', 'h-fps', 'h-sante', 'h-sante-barre', 'c-sante', 'jauge-derive', 'classement', 'feux', 'carte', 'c-position', 'c-tour', 'message', 'sous-message']) H[id] = $(id);
  const segments = Array.from(H['jauge-derive'].querySelectorAll('i')), lampes = Array.from(H.feux.querySelectorAll('i'));
  const etiquetteDerive = H['jauge-derive'].querySelector('.etiquette');
  const barre = H['h-regime'].querySelector('.barre');
  // Écran partagé : second affichage, copie du premier (mêmes identifiants, cherchés dans sa propre arborescence ;
  // getElementById trouve toujours celui du joueur 1, placé avant)
  const hud2 = $('hud').cloneNode(true);
  hud2.id = 'hud2'; hud2.hidden = true; hud2.setAttribute('aria-label', 'Affichage du joueur 2');
  for (const el of hud2.querySelectorAll('#b-pause, #h-fps')) el.remove();
  $('hud').after(hud2);
  const H2 = {};
  for (const id of Object.keys(H)) H2[id] = hud2.querySelector('#' + id);
  for (const id of ['h-pneus', 'c-pneus', 'h-sante', 'h-sante-barre', 'c-sante']) { H[id] = $(id); H2[id] = hud2.querySelector('#' + id); }
  const HUD1 = { h: H, segments, lampes, etiquette: etiquetteDerive, barre };
  const HUD2 = { h: H2, segments: Array.from(H2['jauge-derive'].querySelectorAll('i')), lampes: Array.from(H2.feux.querySelectorAll('i')),
    etiquette: H2['jauge-derive'].querySelector('.etiquette'), barre: H2['h-regime'].querySelector('.barre') };
  function texte(el, t) { if (el._t !== t) { el._t = t; el.textContent = t; } }
  function attr(el, nom, v) { if (el['_' + nom] !== v) { el['_' + nom] = v; el.setAttribute(nom, v); } }
  function style(el, nom, v) { if (el['_s' + nom] !== v) { el['_s' + nom] = v; el.style.setProperty(nom, v); } }
  function classe(el, nom, oui) { if (el.classList.contains(nom) !== !!oui) el.classList.toggle(nom, !!oui); }

  const aDeux = () => !!session && session.type === 'duo';
  // à deux : qui = 0 pour l'affichage du joueur 1 seul, 1 pour celui du joueur 2, rien pour les deux
  const affichages = (cle, qui) => !aDeux() || qui === 0 ? [H[cle]] : qui === 1 ? [H2[cle]] : [H[cle], H2[cle]];
  function message(t, ton, court, qui) {
    for (const el of affichages('message', qui)) {
      el.textContent = t; el.className = 'message';
      void el.offsetWidth;
      el.className = 'message visible' + (ton ? ' ' + ton : '') + (court ? ' court' : '');
    }
  }
  function sousMessage(t, qui) {
    for (const el of affichages('sous-message', qui)) {
      el.textContent = t; el.className = 'sous-message'; void el.offsetWidth; el.className = 'sous-message visible';
    }
  }

  const LIBELLES_PLAN = { tele: 'bord de piste', cockpit: 'caméra embarquée', poursuite: 'poursuite', helico: 'hélicoptère',
    roue: 'caméra de roue', aileron: 'au-dessus de l’arceau', arriere: 'caméra arrière', travelling: 'travelling', orbite: 'autour de la voiture', sol: 'au ras de la piste' };
  function majHud(S, x = HUD1, jForce = null) {
    // en démo, l'affichage est celui de la voiture filmée ; à deux, chaque affichage a sa voiture (x : ses éléments)
    const H = x.h, segments = x.segments, lampes = x.lampes, etiquetteDerive = x.etiquette, barre = x.barre;
    const co = S.course, demo = S.type === 'demo', j = jForce || (demo ? co.voitures[S.suivie || 0] : co.joueur), et = j.etat, chronoMode = co.mode === 'chrono';
    const nb = co.voitures.length;
    if (demo && S.planVu) texte($('demo-plan'), CATALOGUE[S.i].nom + ' · ' + LIBELLES_PLAN[S.planVu.vue] + ' · ' + j.nom);
    texte(H['h-pos'], chronoMode ? '–' : String(j.position)); texte(H['h-sur'], chronoMode ? '' : '/' + nb);
    if (!chronoMode && !demo && S.positionPrec && j.position < S.positionPrec && co.phase === 'course') { H['c-position'].classList.remove('eclat'); void H['c-position'].offsetWidth; H['c-position'].classList.add('eclat'); }
    S.positionPrec = j.position;
    const tourAff = chronoMode ? j.tours + (co.chronoParti ? 1 : 0) : Math.min(co.toursTotal, j.tours + 1);
    texte(H['h-tour'], co.phase === 'grille' || co.phase === 'feux' || (chronoMode && !co.chronoParti) ? '–' : String(tourAff));
    texte(H['h-tours'], chronoMode ? '' : '/' + co.toursTotal);
    const enLice = chronoMode ? co.chronoParti : (co.phase === 'course' || co.phase === 'arrivee');
    const actuel = j.fini ? j.tempsTours[j.tempsTours.length - 1] : enLice ? co.temps - j.debutTour : null;
    texte(H['h-actuel'], chrono(actuel));
    texte(H['h-meilleur'], chrono(j.meilleur));
    // écart en direct avec le meilleur tour, à distance égale
    let delta = null;
    if (enLice && !j.fini && S.profilMeilleur) {
      const dans = j.progression - j.tours * co.c.longueur, k = Math.floor(dans / 10), u = dans / 10 - k;
      const a = S.profilMeilleur[k], b = S.profilMeilleur[k + 1];
      if (a >= 0 && b >= 0) delta = (co.temps - j.debutTour) - lerp(a, b, u);
    }
    texte(H['h-delta'], delta === null ? '–' : ecartTexte(delta, 2));
    classe(H['h-delta'], 'avance', delta !== null && delta < 0); classe(H['h-delta'], 'retard', delta !== null && delta > 0);

    texte(H['h-vitesse'], String(B.conduite.kmh(et)));
    texte(H['h-rapport'], et.rapport < 0 ? 'R' : String(et.rapport));
    style(barre, '--r', clamp((et.regime - 4000) / 9000, 0, 1).toFixed(3));
    classe(H['h-regime'], 'passer', et.regime > (reglages.boite === 'manuelle' ? 12100 : 12600) && et.rapport > 0 && et.rapport < 6);

    // Santé (lot 4) : la jauge vient du même état que les pénalités et la réparation (B.degats.sante), jamais d'un
    // compteur monté pour le seul affichage. Le stand y ajoute son fil : voie, service avec le temps restant, sortie.
    const av = et.degats, st = et.stands, s01 = B.degats.sante(av);
    texte(H['h-sante'], st ? (st.phase === 'service' ? 'Service ' + Math.max(0, st.duree - st.t).toFixed(1) + ' s'
      : st.repare ? 'Réparée' : 'Stand') : s01 > .999 ? 'Neuve' : Math.round(s01 * 100) + ' %');
    style(H['h-sante-barre'], '--f', s01.toFixed(2));
    attr(H['c-sante'], 'data-sante', s01 > .999 ? 'neuve' : s01 > .55 ? 'abimee' : 'grave');
    attr(H['c-sante'], 'data-phase', st ? st.phase : 'piste');

    // jauge de dérive
    const dr = et.derive, montrer = dr.actif || co.horloge - S.derniereJauge < .6;
    H['jauge-derive'].hidden = !montrer;
    if (dr.actif) {
      const N = B.conduite.PARAMS.deriveNiveaux, ch = dr.charge;
      const f = [clamp(ch / N[0], 0, 1), clamp((ch - N[0]) / (N[1] - N[0]), 0, 1), clamp((ch - N[1]) / (N[2] - N[1]), 0, 1)];
      segments.forEach((sg, k) => style(sg, '--f', f[k].toFixed(2)));
      attr(H['jauge-derive'], 'data-niveau', String(dr.niveau));
      classe(H['jauge-derive'], 'fenetre', dr.fenetre > 0);
      // chaque nouveau palier ouvre une fenêtre : lâcher dedans donne le turbo parfait
      texte(etiquetteDerive, dr.fenetre > 0 ? 'Lâchez !' : 'Dérive');
      S.derniereJauge = co.horloge;
    }

    // feux de départ
    const feuxVisibles = co.mode === 'course' && (co.phase === 'grille' || co.phase === 'feux');
    H.feux.hidden = !feuxVisibles;
    if (feuxVisibles) lampes.forEach((l, k) => classe(l, 'allume', k < co.feux.allumes));

    // tour de classement : tête de course et voisins du joueur
    if (!chronoMode && (!S.prochainClassement || co.horloge >= S.prochainClassement)) {
      S.prochainClassement = co.horloge + .25;
      const ordre = co.classement.map(id => co.voitures[id]);
      const rangs = new Set([0, 1, 2, j.position - 2, j.position - 1, j.position].filter(r => r >= 0 && r < nb));
      const liste = [...rangs].sort((a, b) => a - b);
      let html = '', prec = -1;
      for (const r of liste) {
        if (prec >= 0 && r > prec + 1) html += '<li class="saut"></li>';
        const v = ordre[r], col = 'rgb(' + v.couleur.map(x => Math.round(x * 255)).join(',') + ')';
        const lance = co.phase === 'course' || co.phase === 'arrivee';
        const ecart = v.abandon ? 'Abandon' : !lance ? '' : r === 0 ? 'Tête' : ecartTexte(v.ecart);
        html += '<li' + (v === j ? ' class="joueur"' : '') + '><span class="p">' + (r + 1) + '</span><span class="c" style="background:' + col + '"></span><span class="n">' + nomCourt(v) + '</span><span class="e">' + ecart + '</span></li>';
        prec = r;
      }
      if (H.classement._html !== html) { H.classement._html = html; H.classement.innerHTML = html; }
    }
    H.classement.hidden = chronoMode;

    // plan du circuit
    const ctx = H.carte.getContext('2d');
    ctx.clearRect(0, 0, 220, 220); ctx.drawImage(scene.fond, 0, 0);
    const p = scene.plan;
    for (let k = co.voitures.length - 1; k >= 0; k--) {
      const v = co.voitures[k], ps = tampons.poses[k]; if (!ps) continue;
      const [x, y] = p.vers(ps.x, ps.z);
      const moi = v === j;
      ctx.beginPath(); ctx.arc(x, y, moi ? 5.5 : 3.6, 0, Math.PI * 2);
      ctx.fillStyle = moi && !demo ? '#e0301e' : 'rgb(' + v.couleur.map(x => Math.round(x * 255)).join(',') + ')'; ctx.fill();
      ctx.lineWidth = moi ? 2 : 1; ctx.strokeStyle = moi ? '#f2ecdf' : 'rgba(10,12,15,.85)'; ctx.stroke();
    }
    if (chronoMode) {
      const f = B.course.fantome(co);
      if (f) { const e = B.circuit.echantillon(co.c, f.s), [x, y] = p.vers(e.x, e.z); ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = '#6fd0ff'; ctx.fill(); }
    }
    // compteur d'images : le temps d'image lissé de la boucle, viré à l'ambre quand ça descend sous 50 i/s
    const fps = Math.round(1000 / Math.max(.5, dureeImage));
    if (H['h-fps']) { texte(H['h-fps'], fps + ' FPS'); classe(H['h-fps'], 'bas', fps < 50); }
  }

  // ---------------------------------------------------------------- écrans
  let ecran = 'chargement';
  const ECRANS = ['titre', 'enligne', 'prets', 'preparation', 'reglages', 'pause', 'resultats'];
  let modePrepa = 'course', retourReglages = 'titre';
  const enCourse = () => ecran === 'course';

  function aller(nom) {
    const precedent = ecran;
    if (precedent === 'preparation' && nom !== 'preparation') annulerConditions();
    if (nom === 'preparation' && precedent !== 'preparation' && precedent !== 'reglages') {
      conditionsPreparation = null; conditionsPreparationCle = '';
    }
    // Une pause ou les réglages interrompent l'observation Auto, même quand aucune image de course ne passe.
    // Conserver le niveau déjà choisi, mais exiger une nouvelle fenêtre complète au retour en piste.
    if ((ecran === 'course' || ecran === 'demo') !== (nom === 'course' || nom === 'demo'))
      B.qualite.avancer(palier, 0, { actif: false });
    if (son && nom !== 'demo') son.evenement('clic');
    if (nom !== 'course' && nom !== 'demo' && nom !== 'pause') { secouerManette(0, 0); secouerManette(0, 0, pad2); }
    for (const e of ECRANS) $(e).hidden = e !== nom;
    $('hud').hidden = !(nom === 'course' || nom === 'pause' || nom === 'demo');
    hud2.hidden = !(aDeux() && (nom === 'course' || nom === 'pause'));
    $('demo').hidden = nom !== 'demo';
    $('jeu').dataset.ecran = nom;
    ecran = nom;
    if (nom === 'titre') dernierGeste = performance.now();
    if (nom === 'titre' || nom === 'preparation' || nom === 'enligne' || nom === 'prets') {
      if (!session || session.type !== 'vitrine' || (nom === 'preparation' && session.i !== reglages.circuit)) lancerVitrine(nom === 'preparation' ? reglages.circuit : (session ? session.i : reglages.circuit));
    }
    // en ligne, la pause n'arrête pas la course : pas de « Recommencer »
    if (nom === 'pause') { $('b-recommencer').hidden = !!(session && session.enLigne); $('b-replacer').hidden = aDeux(); }
    if (nom === 'enligne') majSalon();
    if (nom === 'prets') majPrets();
    tactile(nom === 'course' && !aDeux());
    if (nom === 'preparation') remplirPreparation();
    if (nom === 'reglages') remplirReglages();
    if ($(nom) && B.navigationMenu) B.navigationMenu.initialiser($(nom));
    // une course arrêtée (pause, réglages, résultats) se tait ; la vitrine des menus continue, moins fort
    if (son) { if (session && session.type !== 'vitrine' && nom !== 'course' && nom !== 'demo') son.suspendre(); else son.reprendre(); }
    if (son) son.musique(nom === 'titre'); // seule musique du jeu : l'écran titre
    appliquerVolumes();
    if (nom === 'course' || nom === 'demo') { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return; }
    const zone = $(nom);
    if (zone && !estTactile) setTimeout(() => {
      if (ecran !== nom || zone.contains(document.activeElement) && !document.activeElement.closest('[hidden]')) return;
      const focus = zone.querySelector('[data-menu-tab][aria-selected="true"]') || zone.querySelector('button.gros, button');
      if (focus && !focus.closest('[hidden]')) focus.focus({ preventScroll: true });
    }, 30);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-aller]');
    if (!b) return;
    const cible = b.dataset.aller;
    // en ligne, la flèche de retour ramène de la préparation au salon, et du salon (lien fermé) au titre
    if (cible === 'titre' && (ecran === 'enligne' || (ecran === 'preparation' && modePrepa === 'enligne'))) retour();
    else if (cible === 'course' || cible === 'chrono' || cible === 'duo') { modePrepa = cible; aller('preparation'); }
    else if (cible === 'reglages') { retourReglages = ecran; aller('reglages'); }
    else aller(cible);
  });

  // ---------------------------------------------------------------- démo
  // Sans geste pendant cinq secondes sur l'écran titre, la démo part : des courses de trois tours, toutes les
  // voitures à l'IA, filmées par le réalisateur. Elle ne s'arrête pas : au drapeau, la course suivante part sur le
  // circuit d'après. Un clic, une touche ou un bouton de manette ramène à l'écran titre.
  const ATTENTE_DEMO = 5, APRES_DRAPEAU = 9;
  function majAttente() {
    const z = $('titre-attente'), actif = ecran === 'titre' && reglages.demo !== 'non' && !!session && !!rendu;
    if (z.hidden === actif) z.hidden = !actif;
    if (!actif) return;
    if (document.hidden) { dernierGeste = performance.now(); return; }
    const reste = ATTENTE_DEMO - (performance.now() - dernierGeste) / 1000;
    if (reste <= 0) { lancerDemo(reglages.circuit); return; }
    texte($('titre-attente-texte'), 'Démo dans ' + Math.max(1, Math.ceil(reste)) + ' s');
    style(z, '--part', clamp(1 - reste / ATTENTE_DEMO, 0, 1).toFixed(2));
  }
  // L'écran de démo est montré dès le début de la préparation : un geste, sous le voile, rend déjà le titre.
  const apresDemo = () => { H.message.className = 'message'; H['sous-message'].className = 'sous-message'; };
  function lancerDemo(i) {
    return preparerSeance('demo', clamp(i | 0, 0, CATALOGUE.length - 1), null, null, { ecran: 'demo', apres: apresDemo });
  }
  // La course de démo est finie : la suivante part sur le circuit d'après, derrière le voile de préparation. L'ancienne
  // tourne encore pendant le fondu d'entrée (340 ms), comme avant.
  function demoSuivante(S) {
    S.enchaine = true;
    void preparerSeance('demo', (S.i + 1) % CATALOGUE.length, null, null, { ecran: 'demo', fondu: 340, verifier: () => ecran === 'demo', apres: apresDemo });
  }
  function sortirDemo() {
    if (ecran !== 'demo') return;
    if (prepa.enCours) annulerPreparation();
    avalerJusque = performance.now() + 400;
    $('chargement').classList.add('fini');
    remettreVitrine();
    aller('titre');
  }

  function annulerConditions() {
    if (conditionsControle) conditionsControle.abort();
    conditionsControle = null; conditionsEnCours = null; conditionsNumero++;
    $('b-depart').disabled = false;
  }
  function afficherConditions() {
    const k = conditionsDuDepart(), reel = ['saison', 'moment', 'meteo'].some(n => reglages[n + 'Mode'] === 'reel');
    for (const nom of ['saison', 'moment', 'meteo']) {
      for (const r of document.querySelectorAll('input[name="' + nom + 'Mode"]')) r.checked = r.value === reglages[nom + 'Mode'];
      $('p-manuel-' + nom).hidden = reglages[nom + 'Mode'] !== 'manuel';
    }
    const profil = B.saisons.profil(k.saison, CATALOGUE[reglages.circuit].theme);
    $('p-type-precipitations').textContent = profil.neige ? 'Neige' : 'Pluie';
    $('p-saison-note').textContent = (reglages.saisonMode === 'manuel' ? '' : NOMS_SAISON[k.saison] + ' · ')
      + (profil.neige ? 'Paysage enneigé. Les précipitations manuelles tombent en flocons.' : k.saison === 'hiver' ? 'Hiver doux à Port-Sable, sans neige.' : 'La saison transforme le paysage.');
    $('p-moment-note').textContent = reglages.momentMode === 'reel' ? 'L’éclairage suit l’heure réelle, à vitesse normale.'
      : reglages.momentMode === 'aleatoire' ? 'Moment tiré au sort : ' + NOMS_MOMENT[k.moment] + '.' : 'Cycle jour/nuit de six minutes.';
    const resume = CATALOGUE[reglages.circuit].nom + ' · ' + NOMS_SAISON[k.saison] + ' · ' + NOMS_MOMENT[k.moment]
      + (k.horlogeReelle ? ' (heure réelle)' : '') + ' · ' + nomMeteoCourse({ ...k, i: reglages.circuit });
    texte($('p-resume'), resume);
    $('p-conditions-reel').hidden = !reel;
    $('p-meteo-sources').hidden = reglages.meteoMode !== 'reel';
    $('p-actualiser-conditions').hidden = !reel && !['saison', 'moment', 'meteo'].some(n => reglages[n + 'Mode'] === 'aleatoire');
    texte($('p-actualiser-conditions'), reel ? 'Actualiser les conditions' : 'Tirer à nouveau');
    if (!conditionsEnCours) {
      const meta = k.meta;
      texte($('p-conditions-etat'), meta && meta.message ? meta.message : 'Conditions prêtes. Le tirage est conservé jusqu’au départ.');
    }
  }
  function actualiserConditions(forcer = false) {
    if (modePrepa === 'enligne' && EL.role === 'invite') return Promise.resolve(null);
    const cle = cleConditions();
    if (!forcer && conditionsEnCours && conditionsPreparationCle === cle) return conditionsEnCours;
    if (!forcer && conditionsPreparation && conditionsPreparationCle === cle) { afficherConditions(); return Promise.resolve(conditionsPreparation); }
    annulerConditions();
    const numero = conditionsNumero, controle = new AbortController();
    conditionsControle = controle; conditionsPreparationCle = cle; conditionsPreparation = null;
    const choix = { ...reglages };
    $('b-depart').disabled = true;
    texte($('p-conditions-etat'), [choix.saisonMode, choix.momentMode, choix.meteoMode].includes('reel') ? 'Recherche des conditions locales…' : 'Préparation des conditions…');
    const promesse = B.conditionsCourse.resoudre(choix, { signal: controle.signal, forcer, timeoutMs: 4000 }).then(k => {
      if (numero !== conditionsNumero || ecran !== 'preparation') return null;
      conditionsPreparation = k;
      preselectionnerPneus();
      if (session && session.type === 'vitrine') {
        if (session.i !== reglages.circuit || session.nature.saison.id !== k.saison) lancerVitrine(reglages.circuit, k);
        else {
          session.conditions = k; session.meteo = B.meteo.depuisReel(k.mReelle) || B.meteo.pour(k.meteo) || B.meteo.initial(graineCourse);
          session.nature.moment = k.moment; session.nature.horlogeReelle = horlogePartagee(k.horlogeReelle);
          session.nature.prochaineLumiereReelle = 0;
        }
      }
      if (EL.role === 'hote' && lienActif()) annoncerCourse();
      return k;
    }).catch(erreur => {
      if (numero !== conditionsNumero || erreur.name === 'AbortError') return null;
      // Défaut imprévu : le pilote peut toujours partir avec ses choix manuels visibles.
      conditionsPreparation = { saison: B.saisons.normaliser(choix.saison), moment: B.ambiance.normaliser(choix.moment),
        meteo: ['soleil', 'pluie', 'variable'].includes(choix.meteo) ? choix.meteo : 'soleil', mReelle: null, horlogeReelle: null,
        meta: { statut: 'repli', message: 'Détection indisponible : conditions manuelles affichées.' } };
      preselectionnerPneus();
      return conditionsPreparation;
    }).finally(() => {
      if (numero !== conditionsNumero) return;
      conditionsControle = null; conditionsEnCours = null; $('b-depart').disabled = false;
      if (ecran === 'preparation') afficherConditions();
    });
    conditionsEnCours = promesse;
    return promesse;
  }
  $('p-actualiser-conditions').addEventListener('click', () => actualiserConditions(true));

  function remplirPreparation() {
    $('p-titre').textContent = modePrepa === 'chrono' ? 'Chrono' : modePrepa === 'enligne' ? 'Course en ligne' : modePrepa === 'duo' ? 'Course à deux' : 'Course';
    $('o-partage').hidden = $('o-commandes').hidden = modePrepa !== 'duo';
    for (const n of [0, 1]) for (const r of document.querySelectorAll('input[name="cmd' + n + '"]')) r.checked = commande(n) === r.value;
    for (const r of document.querySelectorAll('input[name="partage"]')) r.checked = (reglages.partage === 'cote' ? 'cote' : 'haut-bas') === r.value;
    $('o-tours').hidden = $('o-difficulte').hidden = modePrepa === 'chrono';
    $('o-chrono').hidden = modePrepa !== 'chrono';
    const zone = $('circuits');
    if (!zone.childElementCount) {
      CATALOGUE.forEach((k, i) => {
        const c = circuit(i), f = fiche(c), b = document.createElement('button');
        b.type = 'button'; b.className = 'carte-circuit'; b.setAttribute('role', 'radio'); b.dataset.index = i;
        b.innerHTML = '<span class="lieu">' + k.lieu + '</span><span class="nom">' + k.nom + '</span><canvas width="320" height="200"></canvas>' +
          '<p class="fiche"><b>' + f.km + ' km</b> · ' + f.virages + ' virages · ligne droite de ' + f.droite + ' m</p>';
        const ctx = b.querySelector('canvas').getContext('2d');
        const p = plan(c, 320, 200, 14);
        dessinerTrace(ctx, c, p, 10, 'rgba(0,0,0,.55)'); dessinerTrace(ctx, c, p, 5, '#efe8da');
        b.addEventListener('click', () => { reglages.circuit = i; sauverReglages(); majPreparation(); if (son) son.evenement('clic'); lancerVitrine(i); if (EL.role === 'hote' && lienActif()) annoncerCourse(); });
        zone.appendChild(b);
      });
    }
    for (const nom of ['tours', 'difficulte']) for (const r of document.querySelectorAll('input[name="' + nom + '"]')) r.checked = String(reglages[nom]) === r.value;
    for (const r of document.querySelectorAll('input[name="meteo"]')) r.checked = String(reglages.meteo || 'aleatoire') === r.value;
    majPreparation();
    actualiserConditions();
  }
  // Présélection des pneus selon la météo prévue (David, 16/11) : au soleil des slicks, sous la pluie des pneus
  // pluie ; la météo aléatoire est tirée d'avance (même graine que la course qui va partir). Le pilote peut changer.
  const NOMS_PNEUS = { slicks: 'Slicks', inter: 'Intermédiaires', pluie: 'Pluie' };
  function preselectionnerPneus() {
    const k = conditionsDuDepart();
    const prevue = B.meteo.depuisReel(k.mReelle) || B.meteo.pour(k.meteo) || B.meteo.initial(graineCourse + 1);
    reglages.pneus = B.conduite.pneusConseilles(B.conduite.eauSurPiste(prevue));
    for (const r of document.querySelectorAll('input[name="pneus"]')) r.checked = r.value === reglages.pneus;
    $('p-pneus-conseil').textContent = 'Conseillés pour cette météo : ' + NOMS_PNEUS[reglages.pneus].toLowerCase() + '.';
  }
  function majPreparation() {
    preselectionnerPneus();
    for (const r of document.querySelectorAll('input[name="momentDepart"]')) r.checked = r.value === reglages.moment;
    for (const r of document.querySelectorAll('input[name="saisonDepart"]')) r.checked = r.value === reglages.saison;
    afficherConditions();
    for (const b of $('circuits').children) b.setAttribute('aria-checked', String(+b.dataset.index === reglages.circuit));
    const r = records[CATALOGUE[reglages.circuit].id];
    $('p-record').innerHTML = r ? 'Votre record sur ' + CATALOGUE[reglages.circuit].nom + ' : <b>' + chrono(r.tour) + '</b>' : 'Pas encore de temps sur ' + CATALOGUE[reglages.circuit].nom + '.';
  }
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'momentDepart') {
      reglages.moment = B.ambiance.normaliser(t.value); sauverReglages();
      for (const r of document.querySelectorAll('input[name="momentDepart"]')) r.checked = r.value === reglages.moment;
    }
    if (t.name === 'saisonDepart') {
      reglages.saison = B.saisons.normaliser(t.value); sauverReglages(); majPreparation();
    }
    if (['saisonMode', 'momentMode', 'meteoMode'].includes(t.name)) {
      reglages[t.name] = B.conditionsCourse.normaliserMode(t.value);
      if (t.name === 'meteoMode' && reglages.meteo === 'aleatoire') reglages.meteo = 'soleil';
      sauverReglages(); afficherConditions();
    }
    if (t.name === 'tours' || t.name === 'difficulte') { reglages[t.name] = +t.value; sauverReglages(); }
    if (t.name === 'meteo') { reglages.meteo = t.value; sauverReglages(); preselectionnerPneus(); }
    if (t.name === 'pneus' && B.conduite.PNEUS[t.value]) { reglages.pneus = t.value; sauverReglages(); }
    if (['pneusIci', 'pneusPret', 'boitePret', 'vuePret', 'boite', 'vue'].includes(t.name)) retirerPret();
    if ((t.name === 'pneusIci' || t.name === 'pneusPret') && B.conduite.PNEUS[t.value]) {
      reglages.pneus = t.value; sauverReglages(); envoyerPneus();
    }
    if (t.name === 'boitePret' && ['auto', 'manuelle'].includes(t.value)) { reglages.boite = t.value; sauverReglages(); }
    if (t.name === 'vuePret' && ['cockpit', 'poursuite'].includes(t.value)) { reglages.vue = t.value; sauverReglages(); }
    if (['meteo', 'momentDepart', 'saisonDepart', 'saisonMode', 'momentMode', 'meteoMode'].includes(t.name) && ecran === 'preparation') actualiserConditions();
    if (EL.role === 'hote' && lienActif() && ['tours', 'difficulte', 'pneus'].includes(t.name)) annoncerCourse();
    if (t.name === 'joueursIci') { reglages.joueursLocaux = t.value === '2' ? 2 : 1; sauverReglages(); }
    if (t.name === 'partage') { reglages.partage = t.value === 'cote' ? 'cote' : 'haut-bas'; sauverReglages(); }
    if (/^r?cmd[01]$/.test(t.name) && NOMS_COMMANDES[t.value]) {
      const n = +t.name.slice(-1);
      reglages.commandes = [commande(0), commande(1)]; reglages.commandes[n] = t.value; souris.active = false; sauverReglages();
      if (t.name[0] === 'r') majCommandes(); else for (const r of document.querySelectorAll('input[name="rcmd' + n + '"]')) r.checked = r.value === t.value;
    }
    if (['vue', 'boite', 'qualite', 'tableau', 'retro', 'demo', 'cartePosition', 'carteTaille'].includes(t.name)) {
      reglages[t.name] = t.value; sauverReglages(); appliquerCarte();
      if (t.name === 'qualite') {
        B.qualite.avancer(palier, 0, { actif: false });
        palier.n = gpuModeste ? 1 : 0;
        // Un choix du menu est un acte délibéré : il s'applique à l'image, sans la temporisation réservée aux
        // fluctuations de l'Auto. Le décor, lui, attend la séance suivante : il est cuit dans la scène.
        B.graphismes.stabiliser(etatProfils, t.value, palier.n, horlogeProfils());
        if (rendu) appliquerPalier();
      }
    }
    if (Object.prototype.hasOwnProperty.call(B.graphismes.OPTIONS, t.name)) {
      reglages[t.name] = B.graphismes.normaliserOptions({ [t.name]: t.value })[t.name];
      sauverReglages();
      // AA et ombres sont lus au prochain rendu, sans recréer le contexte. La végétation suit la prochaine
      // séance : aucun rebâtiment du terrain ni changement d'obstacles au milieu d'une course.
    }
    if (t.name === 'aide') { reglages.aide = +t.value; sauverReglages(); }
  });
  for (const nom of ['general', 'moteur', 'effets']) $('v-' + nom).addEventListener('input', e => { reglages[nom] = +e.target.value; sauverReglages(); appliquerVolumes(); });
  $('v-champ').addEventListener('input', e => { reglages.champ = clamp(+e.target.value, 60, 105); $('v-champ-valeur').textContent = reglages.champ + '°'; sauverReglages(); });
  $('v-secousses').addEventListener('input', e => { reglages.secousses = clamp(+e.target.value, 0, 1); $('v-secousses-valeur').textContent = Math.round(reglages.secousses * 100) + ' %'; sauverReglages(); });
  $('v-vibrations').addEventListener('change', e => { reglages.vibrations = e.target.checked ? 'oui' : 'non'; if (!e.target.checked) { secouerManette(0, 0); secouerManette(0, 0, pad2); } sauverReglages(); });
  $('v-carte').addEventListener('change', e => { reglages.carte = e.target.checked ? 'oui' : 'non'; sauverReglages(); appliquerCarte(); });
  $('v-vibration-force').addEventListener('input', e => { reglages.vibrationForce = clamp(+e.target.value, 0, 1); $('v-vibration-force-valeur').textContent = Math.round(reglages.vibrationForce * 100) + ' %'; sauverReglages(); });
  const NOMS_ACTIONS = { gaz: 'Accélérer', frein: 'Freiner', gauche: 'Gauche', droite: 'Droite', derive: 'Dérive', haut: 'Rapport +', bas: 'Rapport −', vue: 'Vue' };
  const NOMS_COMMANDES = { auto: 'Auto', manette: 'Manette', clavier: 'Clavier', souris: 'Souris' };
  let captureTouche = null, carteClavier = null;   // action en attente d'une touche ; noms des touches du clavier réel
  try { if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then(m => { carteClavier = m; majCommandes(); }, () => {}); } catch (e) { /* pas d'API de disposition */ }
  function nomTouche(code) {
    if (!code) return '–';
    const fixes = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Espace', ShiftLeft: 'Maj gauche', ShiftRight: 'Maj droite', ControlLeft: 'Ctrl gauche', ControlRight: 'Ctrl droite',
      AltLeft: 'Alt gauche', AltRight: 'Alt droite', MetaLeft: 'Cmd gauche', MetaRight: 'Cmd droite', Enter: 'Entrée', NumpadEnter: 'Entrée (pavé)', Backspace: 'Effacer', Tab: 'Tab', CapsLock: 'Verr. maj' };
    if (fixes[code]) return fixes[code];
    const vu = (carteClavier && carteClavier.get(code)) || (reglages.etiquettes && reglages.etiquettes[code]);
    if (vu) return vu.toUpperCase();
    let m = /^Key(.)$/.exec(code); if (m) return m[1];
    m = /^Digit(.)$/.exec(code); if (m) return m[1];
    m = /^Numpad(.+)$/.exec(code); if (m) return ({ Add: '+', Subtract: '−', Multiply: '×', Divide: '÷', Decimal: ',' }[m[1]] || m[1]) + ' (pavé)';
    return code;
  }
  // tableau des commandes des deux joueurs dans les réglages : appareil, puis deux touches par action
  function majCommandes() {
    const zone = $('r-commandes'); if (!zone) return;
    let html = '';
    for (const n of [0, 1]) {
      html += '<div class="joueur-commandes"><h3>Joueur ' + (n + 1) + '</h3><fieldset class="choix-commande"><legend>Commande</legend>';
      for (const c of Object.keys(NOMS_COMMANDES)) html += '<label><input type="radio" name="rcmd' + n + '" value="' + c + '"' + (commande(n) === c ? ' checked' : '') + '><span>' + NOMS_COMMANDES[c] + '</span></label>';
      html += '</fieldset><table class="table-touches"><tbody>';
      for (const a of ACTIONS) {
        const l = toucheDe(n, a);
        html += '<tr><th scope="row">' + NOMS_ACTIONS[a] + '</th>';
        for (const k of [0, 1]) {
          const attend = captureTouche && captureTouche.n === n && captureTouche.action === a && captureTouche.place === k;
          html += '<td><button type="button" class="touche' + (attend ? ' attente' : '') + '" data-n="' + n + '" data-action="' + a + '" data-place="' + k + '">' + (attend ? 'Touche ?' : nomTouche(l[k])) + '</button></td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }
    zone.innerHTML = html + '<p class="note-commandes">Cliquez une touche puis appuyez sur la nouvelle (Échap annule). Souris : pointeur à gauche ou à droite pour tourner, bouton gauche pour accélérer, droit pour freiner, molette pour les rapports. Manette : gâchettes, stick gauche, A pour la dérive, RB et LB pour les rapports, Y pour la vue, Start pour la pause. Pause : Échap ou P · son : M.</p>'
      + '<button type="button" class="discret" id="r-touches-defaut">Touches par défaut</button>';
  }
  $('r-commandes').addEventListener('click', e => {
    const b = e.target.closest('button.touche');
    if (b) { captureTouche = { n: +b.dataset.n, action: b.dataset.action, place: +b.dataset.place }; majCommandes(); return; }
    if (e.target.id === 'r-touches-defaut') { reglages.touches = [{}, {}]; captureTouche = null; sauverReglages(); majCommandes(); }
  });
  // la touche suivante prend la place choisie ; elle quitte toute autre action, des deux joueurs
  addEventListener('keydown', e => {
    if (!captureTouche) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const q = captureTouche; captureTouche = null;
    if (e.code !== 'Escape' && e.code) {
      const T = reglages.touches = [0, 1].map(n => Object.assign({}, reglages.touches && reglages.touches[n]));
      for (const n of [0, 1]) for (const a of ACTIONS) if (toucheDe(n, a).includes(e.code)) T[n][a] = toucheDe(n, a).filter(c => c !== e.code);
      const liste = toucheDe(q.n, q.action).slice(0, 2);
      liste[Math.min(q.place, liste.length)] = e.code;
      T[q.n][q.action] = liste.filter(Boolean);
      if (e.key && e.key.length === 1) reglages.etiquettes = Object.assign({}, reglages.etiquettes, { [e.code]: e.key });
      sauverReglages();
    }
    majCommandes();
  }, { capture: true });
  function remplirReglages() {
    captureTouche = null; majCommandes();
    majDetectionGraphique();
    for (const nom of ['vue', 'boite', 'qualite', 'anticrenelage', 'ombres', 'vegetation', 'faune', 'aide', 'tableau', 'retro', 'demo', 'cartePosition', 'carteTaille']) for (const r of document.querySelectorAll('input[name="' + nom + '"]')) r.checked = String(reglages[nom]) === r.value;
    $('v-carte').checked = reglages.carte !== 'non';
    $('v-champ').value = reglages.champ; $('v-champ-valeur').textContent = reglages.champ + '°';
    $('v-secousses').value = reglages.secousses; $('v-secousses-valeur').textContent = Math.round(reglages.secousses * 100) + ' %';
    for (const nom of ['general', 'moteur', 'effets']) $('v-' + nom).value = reglages[nom];
    $('v-vibrations').checked = reglages.vibrations !== 'non';
    reglages.vibrationForce = clamp(reglages.vibrationForce != null ? +reglages.vibrationForce : 0.5, 0, 1);
    $('v-vibration-force').value = reglages.vibrationForce; $('v-vibration-force-valeur').textContent = Math.round(reglages.vibrationForce * 100) + ' %';
  }
  function retour() {
    if (prepa.voile) return;   // sous le voile, rien ne se quitte : la préparation finit ou s'annule seule
    if (ecran === 'reglages') { aller(retourReglages || 'titre'); if (ecran === 'pause' && session && session.type !== 'vitrine') rechaufferEnPause(session); }
    else if (ecran === 'preparation' && modePrepa === 'enligne') aller('enligne');
    else if (ecran === 'enligne') quitterEnLigne();
    else if (ecran === 'prets') quitterPrets();
    else if (ecran === 'resultats' && enLigneApres()) $('b-menu').click();
    else if (ecran === 'preparation' || ecran === 'resultats') aller('titre');
  }
  $('r-retour').addEventListener('click', retour);

  $('b-depart').addEventListener('click', async () => {
    const k = await actualiserConditions();
    if (!k || ecran !== 'preparation' || conditionsEnCours) return;
    if (modePrepa === 'enligne') proposerCourse(); else demarrerSeance(modePrepa, k);
  });
  // Départ, Recommencer et Rejouer : la séance se prépare sous le voile, l'écran de course vient avec sa première image.
  function demarrerSeance(type, conditions) {
    const avant = ecran, choix = conditions || (session && session.conditions) || conditionsDuDepart();
    return preparerSeance(type, reglages.circuit, null, choix, { verifier: () => ecran === avant,
      apres: type === 'chrono' ? () => sousMessage('Le chrono part à la ligne') : null });
  }
  function basculerPause(forcer) {
    if (prepa.voile) return;
    if (ecran === 'course') aller('pause');
    else if (ecran === 'pause' && !forcer) aller('course');
  }
  $('b-reprendre').addEventListener('click', () => aller('course'));
  $('b-replacer').addEventListener('click', () => { replacer(); aller('course'); });
  $('b-recommencer').addEventListener('click', () => demarrerSeance(session ? session.type : 'course'));
  $('b-reglages-pause').addEventListener('click', () => { retourReglages = 'pause'; aller('reglages'); });
  $('b-abandon').addEventListener('click', () => {
    if (session && session.enLigne) quitterEnLigne();
    else if (session && session.type === 'chrono' && session.course.joueur.tempsTours.length) montrerResultats(session);
    else aller('titre');
  });
  // Résultats d'une course en ligne : « Quitter » tant qu'elle dure (l'ordinateur reprend la voiture chez l'autre), puis
  // « Salon » ; l'hôte lance la revanche (mêmes réglages), l'invité la reçoit où qu'il soit.
  const enLigneApres = () => !!(session && session.enLigneOrigine && lienActif());
  function boutonsResultats(S) {
    const enl = !!(S && S.enLigneOrigine) && lienActif(), fin = !!(S && S.course.termine);
    texte($('b-menu'), enl ? (fin ? 'Salon' : 'Quitter') : 'Menu');
    texte($('b-rejouer'), enl ? 'Revanche' : 'Rejouer');
    $('b-rejouer').hidden = enl && EL.role !== 'hote';
    $('b-rejouer').disabled = enl && !fin;
  }
  $('b-menu').addEventListener('click', () => {
    if (!enLigneApres()) aller('titre');
    else if (!session.course.termine) quitterEnLigne();
    else { if (EL.role === 'hote') EL.R.envoyer({ t: 'vers-salon' }); aller('enligne'); }
  });
  $('b-rejouer').addEventListener('click', () => {
    if (!enLigneApres()) demarrerSeance(session ? session.type : 'course');
    else if (EL.role === 'hote' && session.course.termine) proposerCourse();
  });

  // Le classement apparaît tout de suite ; les rivaux finissent sans monopoliser le fil de l'interface.
  function finirClassement(S) {
    const co = S.course, delai = Math.max(40, 1.25 * co.drapeau / co.toursTotal);
    let pas = 0;
    const continuer = () => pas < 120 * 240 && !co.voitures.every(v => v.fini || v.abandon) && co.temps - co.drapeau < delai;
    co.termine = true;
    function tranche() {
      if (session !== S || ecran !== 'resultats') return;
      const debut = performance.now();
      while (continuer()) {
        co.termine = false; B.course.pas(co, null, DT); pas++;
        if (performance.now() - debut >= 4) break;
      }
      co.termine = true;
      if (continuer()) setTimeout(tranche, 0);
      else {
        remplirPoses(S.cour, co); remplirPoses(S.prec, co);
        if (session === S && ecran === 'resultats') montrerResultats(S, true);
      }
    }
    setTimeout(tranche, 0);
  }

  function montrerResultats(S, classementFinal = false) {
    S.resultats = true;
    const co = S.course;
    const j = co.joueur, corps = $('res-lignes'), entete = document.querySelector('.tableau-resultats thead tr');
    const nomCircuit = CATALOGUE[S.i].nom;
    if (co.mode === 'chrono') {
      $('res-titre').textContent = j.abandon ? 'Voiture détruite' : 'Séance de chrono';
      const r = records[CATALOGUE[S.i].id];
      $('res-sous').textContent = nomCircuit + ' · meilleur tour ' + chrono(j.meilleur) + (r ? ' · record ' + chrono(r.tour) : '');
      entete.innerHTML = '<th>Tour</th><th class="nom">Temps</th><th>Écart au meilleur</th>';
      corps.innerHTML = j.tempsTours.map((t, k) => '<tr' + (t === j.meilleur ? ' class="joueur"' : '') + '><td>' + (k + 1) + '</td><td class="nom">' + chrono(t) + '</td><td>' + (t === j.meilleur ? '–' : ecartTexte(t - j.meilleur, 3)) + '</td></tr>').join('');
    } else {
      const ordre = co.classement.map(id => co.voitures[id]), tete = ordre[0];
      const meilleurAbsolu = Math.min(...ordre.map(v => v.meilleur ?? Infinity));
      const [h1, h2] = (S.locaux || [0]).map(id => co.voitures[id]);
      $('res-titre').textContent = co.duo && h2 ? (h1.position < h2.position ? h1.nom : h2.nom) + ' devant · ' + Math.min(h1.position, h2.position) + 'e et ' + Math.max(h1.position, h2.position) + 'e'
        : j.abandon ? 'Abandon · voiture détruite' : j.position === 1 ? 'Victoire' : 'Arrivée · ' + j.position + 'e';
      $('res-sous').textContent = nomCircuit + ' · ' + co.toursTotal + ' tours · rivaux ' + ['faciles', 'normaux', 'coriaces'][co.difficulte]
        + (!S.enLigneOrigine || !lienActif() ? '' : !co.termine ? ' · course en cours' : EL.role === 'hote' ? '' : ' · l’hôte choisit la suite');
      entete.innerHTML = '<th>Pos.</th><th>N°</th><th class="nom">Pilote</th><th>Tours</th><th>Temps</th><th>Meilleur tour</th>';
      corps.innerHTML = ordre.map((v, r) => {
        const col = 'rgb(' + v.couleur.map(x => Math.round(x * 255)).join(',') + ')';
        let tps;
        if (v.abandon) tps = 'Abandon';
        else if (r === 0 && v.fini) tps = chrono(v.tempsFinal);
        else if (v.fini && tete.fini && v.tours === tete.tours) tps = ecartTexte(v.tempsFinal - tete.tempsFinal, 3);
        else if (tete.tours - v.tours >= 1 && v.fini) tps = '+' + (tete.tours - v.tours) + ' tour' + (tete.tours - v.tours > 1 ? 's' : '');
        else tps = v.fini ? chrono(v.tempsFinal) : 'en piste';
        return '<tr' + (v.joueur ? ' class="joueur"' : '') + '><td>' + (r + 1) + '</td><td>' + v.numero + '</td><td class="nom"><span class="pastille" style="background:' + col + '"></span>' + (v.joueur && !co.duo ? 'Vous' : v.nom) + '</td><td>' + v.tours + '</td><td>' + tps + '</td><td' + (v.meilleur === meilleurAbsolu ? ' class="record-tour"' : '') + '>' + chrono(v.meilleur) + '</td></tr>';
      }).join('');
    }
    boutonsResultats(S);
    if (!classementFinal) {
      aller('resultats');
      if (co.mode === 'course' && co.drapeau !== null && !j.abandon && !S.enLigneOrigine) finirClassement(S);
    }
  }

  // ---------------------------------------------------------------- préparation des séances
  // Lancer une séance coûtait sa première seconde de course : décor bâti, programmes du moteur compilés, objets créés
  // et code froid au moment où la voiture partait. Chaque départ (Départ, Recommencer, Rejouer, en ligne, démo et
  // vitrine dont le décor change) passe maintenant par preparerSeance : tout cela se fait sous un voile opaque, et la
  // première image montrée est déjà une image de régime. Rien de ce qui suit ne touche aux règles ni à la course : la
  // simulation de la séance n'avance pas d'un pas avant que le voile se lève.

  // Profils que le gouverneur Auto peut atteindre pendant la séance : la chauffe les couvre tous, sinon le premier
  // changement de palier en pleine course compilerait ses programmes. Une qualité fixe n'en a qu'un.
  // voisins : machine lente, seuls le palier courant et ses deux voisins (chaque variante y coûte une image complète)
  function profilsAtteignables(type, S, voisins = false) {
    const q = S && S.banc ? S.banc.qualite : reglages.qualite, garde = { decor: etatProfils.decor, capacites: capacitesRendu, options: reglages };
    const gouverne = B.graphismes.normaliser(q) === 'auto' && !(S && (S.banc || S.reference)) && ['course', 'chrono', 'demo', 'duo'].includes(type);
    if (!gouverne) return [B.graphismes.melange(q, palier.n, garde)];
    const l = [];
    for (let n = gpuModeste ? 1 : 0; n <= PALIERS; n++) if (!voisins || Math.abs(n - palier.n) <= 1) l.push(B.graphismes.melange(q, n, garde));
    return l;
  }
  // La piste peut-elle se mouiller pendant la séance ? Alors les reflets d'écran viendront : leur variante se chauffe.
  const meteoPeutMouiller = m => !!m && ((m.pluie || 0) > 0 || (m.mouille || 0) > 0 || m.fixe !== true);
  const varianteDe = (P, reflections, lampes) => ({ msaa: P.rendu.msaa === 4, shadowMapScale: P.rendu.shadowMapScale, shadows: avecOmbres(P), bloom: avecHalo(P), reflections, lampes, groundCover: P.groundCover, windStrength: P.windStrength });
  // Combinaisons d'effets que la séance peut demander au moteur : chacune a ses programmes, compilés au premier usage.
  function variantesRendu(S, voisins = false) {
    const m = new Map(), mouille = meteoPeutMouiller(S.meteo), LT = scene && scene.decor.tunnelLampes, tunnelEclaire = !!(LT && LT.length);
    const ajouter = P => {
      for (const reflets of P.effets.reflets && mouille ? [false, true] : [false])
        for (const lampes of tunnelEclaire ? [false, true] : [false]) {
          const v = varianteDe(P, reflets, lampes), cle = JSON.stringify(v);
          m.delete(cle); m.set(cle, v);
        }
    };
    for (const P of profilsAtteignables(S.type, S, voisins)) ajouter(P);
    ajouter(profilDe(S));   // le profil courant en dernier : le moteur finit la chauffe dans l'état de la première image
    return m;
  }
  // une lampe de tunnel devant la caméra : la variante éclairée compile sans attendre le tunnel
  const lampeTemoin = cam => [{ p: [cam.pos[0] + Math.sin(cam.yaw) * 6, cam.pos[1] + 2.5, cam.pos[2] - Math.cos(cam.yaw) * 6], power: LAMPE_PUISSANCE, range: LAMPE_PORTEE, color: COULEUR_LAMPE }];
  function fxVariante(S, v, cam) {
    return { time: horlogeReelle, msaa: v.msaa, shadowMapScale: v.shadowMapScale, shadows: v.shadows, bloom: v.bloom, brightness: 1,
      lights: v.lampes ? lampeTemoin(cam) : null, torch: false, sunOnly: true, adaptive: false, frameMs: dureeImage, damage: 0, flash: 0,
      photo: v.bloom ? 1 : 0, reflections: v.reflections, weather: S.ambianceImage, windSources: S.sillage && S.sillage.sources,
      windStrength: v.windStrength, groundCover: v.groundCover };
  }
  // Objets de la chauffe : ceux de la vraie première image, plus un témoin de chaque sorte que la course peut faire
  // naître (habitacle, traces, fumée, étincelles, débris, faune, saison, feux, aurores, fantôme). Ils sont posés devant
  // la caméra pour que le moteur ne les écarte pas ; personne ne les voit, ils ne vivent que sous le voile.
  function listeChauffe(S, cam, base, avecHabitacle = true) {
    const l = base.slice(), fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    const devant = (d, lat, h) => [cam.pos[0] + fx * d + rx * lat, cam.pos[1] + h, cam.pos[2] + fz * d + rz * lat];
    const ajouter = o => l.push(Object.assign({ r: [0, 0, 0], color: [.5, .5, .5] }, o));
    ajouter({ shape: 'box', p: devant(6, -1.2, 0), s: [.4, .4, .4], mat: 1 });
    if (avecHabitacle) ajouter({ shape: 'box', p: devant(1.2, 0, -.3), s: [.1, .05, .1], mat: 2, overlay: true, surface: 'object' });
    ajouter({ shape: 'box', p: devant(7, 0, -1), s: [1, .01, .3], fx: true, fxPriority: 'hazard', alpha: .5, color: [.02, .02, .022] });
    ajouter({ shape: 'sphere', p: devant(8, 1, 0), s: [.6, .6, .6], fx: true, alpha: .3, color: [.82, .82, .8] });
    ajouter({ shape: 'box', p: devant(8, -1, .2), s: [.05, .05, .2], fx: true, alpha: .8, color: [1, .6, .18], emissive: 2.4 });
    ajouter({ shape: 'box', p: devant(9, .5, -.5), s: [.3, .1, .3], mat: 7, fx: true, fxPriority: 'hazard', alpha: 1, color: [.7, .1, .08] });
    ajouter({ shape: 'sphere', p: devant(10, 2, 1), s: [.2, .2, .2], mat: 7, surface: 'object', outdoor: true });
    ajouter({ shape: 'sphere', p: devant(10, -2, 1), s: [.2, .2, .2], mat: 7, surface: 'object', outdoor: true, fx: true, alpha: .5, emissive: 1 });
    ajouter({ shape: 'octa', p: devant(11, 1.5, 1.5), s: [.1, .02, .1], mat: 7, surface: 'object', outdoor: true, fx: true, alpha: .7 });
    ajouter({ shape: 'octa', p: devant(11, -1.5, 1.5), s: [.1, .1, .1], mat: 5, emissive: 2 });
    ajouter({ shape: 'cylinder', p: devant(12, 0, 2), s: [.56, .05, .56], mat: 5, emissive: 3, color: [1, .14, .06] });
    if (B.aurores && S.c && S.c.theme === 'islande') ajouter({ shape: 'bitume-aurore-0', p: devant(40, 0, 10), s: [1, 1, 1], mat: 7, fx: true, alpha: .2, emissive: 5, outdoor: true, surface: 'object' });
    B.voiture.fantome({ p: devant(14, 2.5, -.6), cap: cam.yaw - Math.PI / 2, tangage: 0, roulis: 0 }, l);
    return l;
  }
  // Un pixel lu après la chauffe : le processeur graphique a fini de compiler et de dessiner avant l'étape suivante.
  const PIXEL = new Uint8Array(4);
  function attendreGPU(r) {
    const gl = r && r.gl;
    if (!gl || (gl.isContextLost && gl.isContextLost())) return;
    try {
      if (gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING)) return;
      const lu = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
      if (lu) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, PIXEL);
      if (lu) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, lu);
    } catch (e) { /* lecture refusée : la chauffe reste valable, seule l'attente manque */ }
  }
  // Céder la main entre deux étapes : une image (le voile et son texte se peignent), ou un message quand l'onglet est
  // caché (requestAnimationFrame y dort) ; cent millisecondes au plus dans tous les cas.
  const canalPrepa = typeof MessageChannel === 'function' ? new MessageChannel() : null, attentesCanal = [];
  if (canalPrepa) canalPrepa.port1.onmessage = () => { const f = attentesCanal.shift(); if (f) f(); };
  function attendreImage() {
    return new Promise(resolve => {
      let fini = false, delai = 0;
      const finir = () => { if (fini) return; fini = true; clearTimeout(delai); resolve(); };
      delai = setTimeout(finir, 100);
      if (document.hidden && canalPrepa) { attentesCanal.push(finir); canalPrepa.port2.postMessage(0); }
      else requestAnimationFrame(finir);
    });
  }
  // Sous le voile, les boutons tenus restent « déjà appuyés » : Start, qui a lancé la course, ne la met pas en pause
  // dès qu'elle apparaît ; rien d'autre n'est lu.
  function tenirManettes() {
    let liste = [];
    try { if (navigator.getGamepads) liste = navigator.getGamepads() || []; } catch (e) { return; }
    for (const p of [pad, pad2]) {
      const m = p.manette, q = m && liste[m.index];
      if (q && q.connected) for (let i = 0; i < q.buttons.length; i++) { const b = q.buttons[i]; p.precedent[i] = !!b && (b.value || (b.pressed ? 1 : 0)) > .5; }
    }
  }

  // Tout ce qui naissait à la première image où il servait. Les filets « if (!x) » du chemin d'image restent, mais
  // comptent ce qu'ils créent (creationTardive) : en course, ce compteur doit rester à zéro. Rend les attentes des
  // modules qui préparent leurs propres ressources (traces, son), quand ils savent le faire.
  function prechargerSeance(S) {
    const attentes = [];
    prepa.precharge = true;
    try {
      const co = S.course, c = co.c, n = co.voitures.length, duo = S.type === 'duo' && !!S.vueJ2, vues = duo ? [S, S.vueJ2] : [S];
      for (let k = 0; k < n; k++) {
        const p = tampons.poses[k] || (tampons.poses[k] = {});
        if (!p.rebond) p.rebond = [0, 0, 0, 0];
        if (!sonCandidats[k]) sonCandidats[k] = {};
      }
      if (!S.rouleVu) S.rouleVu = new Float64Array(n);
      if (!S.rouleVrai) S.rouleVrai = new Float64Array(n).fill(NaN);
      if (B.sillage && !S.sillage) S.sillage = B.sillage.creer();
      if (!S.ambianceImage) S.ambianceImage = {};
      // pluie projetée et vitre : celles du joueur 2 aussi, à deux
      if (!pluieVue) pluieVue = B.meteo.creerPluie($('meteo'));
      if (duo && !pluieVue2) pluieVue2 = B.meteo.creerPluie($('meteo2'));
      if (B.vitre) {
        if (!vitreVue) vitreVue = B.vitre.creer($('vitre'));
        if (duo && !vitreVue2) vitreVue2 = B.vitre.creer($('vitre2'));
        for (const V of vues) if (!V.vitreContexte) V.vitreContexte = {};
      }
      // tunnel : axe de la scène, puis un état de lampes par vue (le joueur 2 a son propre lissage)
      if (scene) {
        preparerTunnel(c);
        const LT = scene.decor.tunnelLampes;
        if (LT && LT.length) for (const V of vues) {
          const et = Object.prototype.hasOwnProperty.call(V, 'lampesTunnel') ? V.lampesTunnel : null;
          if (!et || et.rev !== scene.index || et.n !== LT.length) V.lampesTunnel = nouvelEtatLampes(scene.index, LT.length);
        }
      }
      // Nature : habitats et contextes de vue dès que la saison les permet, même si le profil coupe la faune pour
      // l'instant (le gouverneur Auto peut la rouvrir en pleine course).
      const N = S.nature, sa = N && N.saison;
      if (N && B.faune && (!sa || sa.faune > 0)) {
        if (!N.faune) N.faune = B.faune.creer(c, scene.decor);
        for (const V of vues) if (!V.fauneVue) V.fauneVue = { qualite: 'off', nuit: 0, pluie: 0, pose: null, vue: V === S ? 0 : 1 };
      }
      if (N && B.effetsSaison && sa && (N.effetsSaison || sa.feuilles || sa.neige || (S.meteo && S.meteo.neige))) {
        if (!N.effetsSaison) N.effetsSaison = B.effetsSaison.creer(c, scene.decor);
        for (const V of vues) if (!V.saisonVue) V.saisonVue = { qualite: 'low', nuit: 0, pluie: 0, neige: 0, ventX: 0, ventZ: 0, pose: null, vue: V === S ? 0 : 1, abri: false };
      }
      if (N && B.aurores && c.theme === 'islande') {
        if (!N.aurores) N.aurores = B.aurores.creer(c);
        for (const V of vues) if (!V.auroresVue) V.auroresVue = { vue: V === S ? 0 : 1, qualite: 'low', nuit: 0, pluie: 0, neige: 0, nuages: 0, tunnel: false };
      }
      const port = scene && scene.decor.portique;
      if (port && co.mode === 'course' && !S.rotLampe) S.rotLampe = MATRICE_LAMPE(port.cap);
      if (duo) { const t2 = $('scene2'); if (!t2._ctx) t2._ctx = t2.getContext('2d'); }
      // rétroviseurs : glaces de chaque joueur, et moteur des miroirs avec sa copie du décor quand la séance peut en montrer
      if (S.type !== 'vitrine') {
        glacesDe('j1'); if (duo) glacesDe('j2');
        if (glacesPossibles(S)) preparerGlaces();
      }
      // Raccords : les modules qui savent préparer leurs ressources le font ici (fonctions encore absentes de leur
      // module : rien n'est appelé tant qu'elles n'existent pas).
      const attendreSi = r => { if (r && typeof r.then === 'function') attentes.push(Promise.resolve(r).catch(e => console.warn('BITUME : préparation d’un module', e))); };
      try { if (B.traces.prechauffer) attendreSi(B.traces.prechauffer(S.fx)); } catch (e) { console.warn('BITUME : préparation des traces', e); }
      try { if (son && son.preparer) attendreSi(son.preparer({ type: S.type, voitures: n, joueurs: S.locaux ? S.locaux.length : 0, circuit: S.i })); } catch (e) { console.warn('BITUME : préparation du son', e); }
    } finally { prepa.precharge = false; }
    return attentes;
  }

  // Course jetable : deux à trois secondes d'une autre course, sur le même tracé, pour que le code de la simulation,
  // des contacts, des traces, de la fumée, des étincelles, des débris et des embruns soit compilé avant le vrai
  // départ. Elle a sa graine, ses voitures, ses effets et sa météo ; la course de la séance, son générateur et ses
  // pneus ne bougent pas d'un bit (verifications/chargement.test.mjs le prouve).
  const GRAINE_JETABLE = 0x5eed;
  function courseJetable(S, secondes) {
    const base = S.course, mode = base.mode;
    const co = B.course.creer(base.c, { mode, tours: 2, difficulte: base.difficulte, rivaux: 11, graine: GRAINE_JETABLE, placeJoueur: 2 });
    co.phase = 'course'; co.feux.vert = true; co.feux.allumes = 5; co.horloge = co.temps = 6;
    for (const v of co.voitures) { co.sAvant[v.id] = v.etat.s; v.debutTour = co.temps; }
    const n = co.voitures.length, fx = B.traces.creer(n, GRAINE_JETABLE), poses = [];
    remplirPoses(poses, co);
    // une piste qui peut se mouiller est chauffée mouillée : les embruns ont leur chemin de code
    const meteo = Object.assign({}, S.meteo);
    if (meteoPeutMouiller(S.meteo)) { meteo.pluie = Math.max(meteo.pluie || 0, .75); meteo.mouille = 1; }
    const total = Math.max(1, Math.round(secondes / DT));
    // la dernière seconde, gaz à fond et volant d'un bord à l'autre : glisse, fumée et traces
    const force = { gaz: 1, frein: 0, volant: 0, derive: true, haut: false, bas: false, boite: 'auto', aide: 0, guidage: 0, marcheArriere: false };
    let k = 0, ms = 0, rapport = null;
    return {
      course: co, effets: fx, get rapport() { return rapport; },
      avancer(budget) {
        if (rapport) return true;
        const avant = B.meteo.actuel, t0 = performance.now();
        B.meteo.actuel = meteo;
        try {
          while (k < total && performance.now() - t0 < budget) {
            const j = co.joueur;
            let cmd = B.course.commandesIA(co, j);
            if (k >= total - 120) { force.volant = (k >> 4) & 1 ? 1 : -1; cmd = force; }
            const ev = B.course.pas(co, cmd, DT);
            for (const v of co.voitures) v.roule = (v.roule || 0) + v.etat.v * DT;
            remplirPoses(poses, co);
            // chemins rares, forcés une fois : contact violent (étincelles, panneau), roue perdue et casse (débris, PhysX)
            if (k === total - 30 && n > 1) ev.push({ type: 'contact', a: j.id, b: (j.id + 1) % n, force: 40 });
            if (k === total - 20) { ev.push({ type: 'roue', id: j.id, roue: 0 }); ev.push({ type: 'casse', id: (j.id + 1) % n, cote: 1, avant: true }); }
            B.traces.pas(fx, co, poses, j.id, DT, ev);
            k++;
          }
        } finally { B.meteo.actuel = avant; ms += performance.now() - t0; }
        if (k >= total) rapport = { pas: k, ms: +ms.toFixed(1), effets: B.traces.compter(fx) };
        return !!rapport;
      },
      dessiner(sortie, oeil) { B.traces.dessiner(fx, sortie, oeil, 0); },
      liberer() { B.traces.liberer(fx); }
    };
  }

  // ---------------------------------------------------------------- chauffe du rendu
  // Chaque variante atteignable (ombres et atlas, anticrénelage, halo, reflets si la piste peut se mouiller, lampes
  // si le tunnel est éclairé) est dessinée une fois sous le voile, sur les deux moteurs. Le travail fait est noté par
  // scène et par taille d'image : Recommencer ne refait rien, un autre circuit ou un écran partagé refait le nécessaire.
  function etatChauffe() { return scene.chauffe || (scene.chauffe = { rendu: new Set(), retro: new Set() }); }
  // Une image de régime au-delà de 50 ms (rendu logiciel, processeur graphique très modeste) : chaque variante chauffée
  // y coûte une image complète, et la chauffe du code ne s'y verrait pas. Mesuré par la boucle des menus avant la
  // préparation, ou par la chauffe du code d'une préparation précédente.
  const IMAGE_LENTE = 50;
  const machineLente = () => prepa.lente || dureeImage > IMAGE_LENTE;
  // Ce qui manque au registre de la scène pour cette séance, sur les deux moteurs : la préparation s'en sert pour
  // choisir le voile (rien ne manque : fondu court) et la chauffe pour savoir quoi dessiner.
  function aChauffer(S, voisins = machineLente()) {
    const E = etatChauffe();
    const suffixe = '@' + canvas.clientWidth + 'x' + canvas.clientHeight + ':' + profilDe(S).rendu.resolution;
    const manque = [];
    for (const [cle, v] of variantesRendu(S, voisins)) if (!E.rendu.has(cle + suffixe)) manque.push([cle + suffixe, v]);
    // miroirs : leurs propres variantes (lampes, couvert végétal et vent), aux paliers qui montrent des glaces vives
    const manqueR = [], source = $('retro-rendu');
    if (retro.rendu && glacesPossibles(S) && glacesPretes(retro.j1)) {
      const LT = scene.decor.tunnelLampes, suffixeR = '@' + source.clientWidth + 'x' + source.clientHeight;
      for (const P of profilsAtteignables(S.type, S, voisins)) if (P.effets.retroImages)
        for (const lampes of LT && LT.length ? [false, true] : [false]) {
          const v = { lampes, groundCover: P.groundCover, windStrength: P.windStrength }, cle = JSON.stringify(v) + suffixeR;
          if (!E.retro.has(cle) && !manqueR.some(m => m[0] === cle)) manqueR.push([cle, v]);
        }
    }
    return { manque, manqueR };
  }
  // La chauffe du code se note par type de séance et par piste (sèche, ou qui peut se mouiller : embruns et eau ont
  // leur propre chemin) ; la course jetable, par mode et par piste.
  const pisteDe = S => meteoPeutMouiller(S.meteo) ? 'mouille' : 'sec';
  const cleCode = (type, S) => type + ':' + pisteDe(S);
  async function chaufferRendu(S, suite, synchrone, alpha = 0) {
    const t0 = performance.now(), E = etatChauffe(), voisins = machineLente(), r = { variantes: 0, retro: 0, prewarm: false, voisins, ms: 0 };
    const { manque, manqueR } = aChauffer(S, voisins);
    if (!manque.length && !manqueR.length) { r.ms = +(performance.now() - t0).toFixed(1); return r; }
    // synchrone : aucun await, tout se fait dans la tâche de l'appelant (pause, Recommencer)
    let tranche = performance.now();
    const souffler = async moteur => { if (suite && performance.now() - tranche > 50) { attendreGPU(moteur); await suite(); tranche = performance.now(); } };
    // la vraie première image d'abord : caméra, objets, environnement et poses de la séance
    const cam = rendreImage(S, alpha, 0);
    if (manque.length) {
      const liste = listeChauffe(S, cam, S.sortie);
      if (rendu.prewarm && !synchrone) {
        // raccord FERRO : le moteur prépare lui-même chaque variante et toutes ses formes
        r.prewarm = true;
        await rendu.prewarm(cam, liste, fxVariante(S, manque[manque.length - 1][1], cam), { variants: manque.map(m => fxVariante(S, m[1], cam)), allShapes: true });
      } else for (const [, v] of manque) { rendu.draw(cam, liste, fxVariante(S, v, cam)); r.variantes++; if (!synchrone) await souffler(rendu); }
      attendreGPU(rendu);
      for (const [cle] of manque) E.rendu.add(cle);
    }
    if (manqueR.length) {
      const ps = tampons.poses[S.locaux && S.locaux.length ? S.locaux[0] : 0];
      const camR = { pos: [ps.x, ps.y + 1, ps.z], yaw: ps.cap - Math.PI / 2, pitch: 0, roll: 0, fov: 34, near: .3, far: PORTEE_VUE };
      camR.sun = Object.assign({ center: [ps.x, ps.y, ps.z] }, scene.ombre);
      if (S.nature && (retro.ambianceSource !== S.nature.ambiance || retro.ambianceRevision !== S.nature.ambiance.revision)) {
        if (retro.rendu.setEnvironment) retro.rendu.setEnvironment(S.nature.ambiance.atmosphere);
        retro.ambianceSource = S.nature.ambiance; retro.ambianceRevision = S.nature.ambiance.revision;
      }
      const objets = listeChauffe(S, camR, S.sortie.filter(o => !o.overlay), false);
      const fxR = v => ({ time: horlogeReelle, shadows: false, bloom: false, torch: false, sunOnly: true, adaptive: false, frameMs: dureeImage, damage: 0, flash: 0, photo: 0,
        weather: S.ambianceImage, windSources: S.sillage && S.sillage.sources, windStrength: v.windStrength, groundCover: v.groundCover, lights: v.lampes ? lampeTemoin(camR) : null });
      if (retro.rendu.prewarm && !synchrone) await retro.rendu.prewarm(camR, objets, fxR(manqueR[manqueR.length - 1][1]), { variants: manqueR.map(m => fxR(m[1])), allShapes: true });
      else for (const [, v] of manqueR) { retro.rendu.draw(camR, objets, fxR(v)); r.retro++; if (!synchrone) await souffler(retro.rendu); }
      attendreGPU(retro.rendu);
      for (const [cle] of manqueR) E.retro.add(cle);
    }
    r.ms = +(performance.now() - t0).toFixed(1);
    return r;
  }

  // ---------------------------------------------------------------- chauffe du code
  // Vraies images à dt = 0 dans chaque vue que la séance peut montrer : le code des caméras, des glaces, de la pluie,
  // de la nature et du dessin est compilé avant le départ. L'état des vues est figé avant et rendu après : la séance
  // repart exactement de son état de lancement (caméras lissées, poste de télévision et son générateur, réalisateur).
  const CLES_VUE = ['tete', 'camCap', 'sol', 'camera', 'vue', 'suivie', 'lumiere', 'secousse', 'eclair', 'refletsEcran', 'planVu', 'j2Image', 'tele', 'real'];
  function figerVues(S) {
    const gel = [];
    for (const V of S.vueJ2 ? [S, S.vueJ2] : [S]) for (const cle of CLES_VUE) {
      const propre = Object.prototype.hasOwnProperty.call(V, cle);
      gel.push([V, cle, propre, propre ? V[cle] : undefined]);
    }
    return gel;
  }
  function rendreVues(gel) {
    for (const [V, cle, propre, valeur] of gel) { if (propre) V[cle] = valeur; else delete V[cle]; }
  }
  async function imagesDeChauffe(S, suite) {
    const co = S.course, j = co.joueur, hz = profilDe(S).secondaires.retroviseurs.hz;
    // assez d'images cockpit pour que chaque glace vive soit rafraîchie au moins une fois à sa cadence ; une seule
    // quand les glaces sont peintes (qualité basse) : rien d'autre ne change d'une image cockpit à la suivante
    const vives = glacesVives(S, 'cockpit') || (!!S.vueJ2 && glacesVives(S.vueJ2, 'cockpit'));
    const cockpit = vives ? 2 * Math.max(1, Math.round(30 / Math.max(1, hz))) : 1;
    let n = 0, tranche = performance.now();
    const souffler = async () => { if (performance.now() - tranche > 50) { attendreGPU(rendu); await suite(); tranche = performance.now(); } };
    // machine déjà connue pour lente : la première vraie image, sous le voile, passe seule par ce chemin
    if (machineLente()) return { n, lent: true };
    const t1 = performance.now();
    rendreImage(S, 0, 0); n++;
    attendreGPU(rendu);
    // Une image complète, programmes déjà compilés, coûte plus de 50 ms : à cette cadence le code chaud ne se verrait
    // pas, et chaque vue de plus coûterait autant sous le voile. Les préparations suivantes le savent.
    const lent = performance.now() - t1 > IMAGE_LENTE;
    if (lent) { prepa.lente = true; return { n, lent }; }
    await souffler();
    const meteo = majMeteo(S, 0);
    const vue = async (V, voiture, nom, fois = 1) => { for (let k = 0; k < fois; k++) { rendreVue(V, voiture, nom, 0, meteo); n++; } await souffler(); };
    if (S.type === 'duo' && S.vueJ2) {
      const j2 = co.voitures[S.locaux[1]], t2 = $('scene2');
      for (const nom of ['cockpit', 'poursuite']) for (let k = 0; k < (nom === 'cockpit' ? cockpit : 1); k++) {
        rendreVue(S.vueJ2, j2, nom, 0, meteo);
        if (t2._ctx) { if (t2.width !== canvas.width || t2.height !== canvas.height) { t2.width = canvas.width; t2.height = canvas.height; } t2._ctx.drawImage(canvas, 0, 0); }
        rendreVue(S, j, nom, 0, meteo); n += 2;
        await souffler();
      }
    } else if (S.type === 'demo') {
      // chaque plan du réalisateur, sans le consulter : son générateur reste celui de la séance
      for (const nom of B.realisateur.VUES) {
        S.planVu = { vue: nom, sujet: j.id, debut: co.horloge, fin: 1e9, motif: 'course', n: 0, cote: 1, angle: .6 };
        await vue(S, j, nom, nom === 'cockpit' ? cockpit : 1);
      }
    } else {
      // cockpit et ses deux glaces, poursuite, et la vue de télévision qui suit l'arrivée
      await vue(S, j, 'cockpit', cockpit); await vue(S, j, 'poursuite'); await vue(S, j, 'tele');
    }
    return { n, lent: false };
  }
  async function chaufferCode(S, suite, o) {
    const t0 = performance.now(), r = { images: 0, lent: false, simulation: null, ms: 0 };
    const v = await imagesDeChauffe(S, suite);
    r.images = v.n; r.lent = v.lent;
    // la course jetable, une fois par mode et par piste ; en ligne, pas quand le départ commun est trop proche
    const cle = 'simulation:' + S.course.mode + ':' + pisteDe(S), reste = o.reste ? o.reste() : Infinity;
    if (!prepa.chaud.has(cle) && !(reste < 1500)) {
      const J = courseJetable(S, 2.5);
      try {
        while (!J.avancer(40)) { attendreGPU(rendu); await suite(); }
        // ses effets passent par le vrai chemin de dessin, avec les témoins, puis par le moteur (pas sur une machine
        // lente : leurs programmes sont déjà compilés par la chauffe du rendu, seul leur code de dessin restait froid)
        const cam = S.camera || rendreImage(S, 0, 0), liste = listeChauffe(S, cam, S.sortie);
        J.dessiner(liste, cam.pos);
        if (!r.lent) { rendu.draw(cam, liste, fxVariante(S, varianteDe(profilDe(S), false, false), cam)); attendreGPU(rendu); }
        prepa.chaud.add(cle);
        r.simulation = J.rapport;
      } finally { J.liberer(); }
    }
    r.ms = +(performance.now() - t0).toFixed(1);
    return r;
  }

  // ---------------------------------------------------------------- voile de chargement
  const ETAPES = { voile: 'Mise en place', decor: 'Construction du décor', retro: 'Rétroviseurs', circuit: 'Tracé et tunnel',
    seance: 'Grille de départ', creations: 'Effets de la séance', rendu: 'Chauffe de l’image', code: 'Chauffe de la course',
    zero: 'Remise à zéro', image: 'Première image' };
  const ORDRE_ETAPES = Object.keys(ETAPES);
  // Opaque d'emblée, sans transition, quand le travail est long (texte d'étape et barre sobre) ; quand il reste peu à
  // faire (Recommencer), le fondu d'aujourd'hui, sans texte.
  function montrerVoile(etapes, fondu) {
    const v = $('chargement');
    classe(v, 'etapes', !!etapes);
    classe(v, 'net', !!etapes && !fondu);
    v.classList.remove('fini');
    if (etapes) { texte($('chargement-etape'), ''); $('chargement-progres').value = 0; }
  }
  function majVoile(nom) {
    prepa.etape = nom;
    if (!prepa.voile && ecran !== 'chargement') return;   // le voile de la page, avant le titre, montre aussi ses étapes
    const k = ORDRE_ETAPES.indexOf(nom);
    texte($('chargement-etape'), ETAPES[nom] || '');
    $('chargement-progres').value = k < 0 ? 0 : k / (ORDRE_ETAPES.length - 1);
  }
  function leverVoile() { const v = $('chargement'); v.classList.remove('net', 'tiede'); v.classList.add('fini'); }
  // Dernière image sous le voile : il passe à 99 % et l'affichage de course se montre dessous. Le compositeur du
  // navigateur peint alors une fois la scène, les glaces et l'affichage (il ne peint rien de ce qu'un voile opaque
  // cache) : ses programmes ne se compilent pas sur la première image du fondu.
  function tiedirVoile(S) {
    $('chargement').classList.add('tiede');
    $('hud').hidden = false;
    if (S.type === 'duo' && S.vueJ2) hud2.hidden = false;
  }
  // l'affichage de l'écran présent, comme aller() le pose (une préparation annulée a pu le montrer sous le voile)
  function remettreHud() {
    $('hud').hidden = !(ecran === 'course' || ecran === 'pause' || ecran === 'demo');
    hud2.hidden = !(aDeux() && (ecran === 'course' || ecran === 'pause'));
  }
  // Sous le voile, menus et affichages ne prennent ni clic ni clavier ; le focus revient si la préparation s'annule.
  function bloquerEntrees(oui) {
    for (const el of [...ECRANS.map($), $('hud'), hud2, $('tactile')]) if (el) el.inert = !!oui;
    if (oui) {
      const a = document.activeElement;
      if (a && a !== document.body) { if (!prepa.focus) prepa.focus = a; if (a.blur) a.blur(); }
    }
  }
  // même règle que aller() : la vitrine des menus s'entend, une course arrêtée se tait ; musique au seul titre
  function retablirSon() {
    if (!son) return;
    if (session && session.type !== 'vitrine' && ecran !== 'course' && ecran !== 'demo') son.suspendre(); else son.reprendre();
    son.musique(ecran === 'titre' && !document.hidden);
    appliquerVolumes();
  }
  // Une préparation plus récente, un lancement direct ou une perte de contexte arrêtent celle qui court : son jeton
  // change, elle s'arrête à son prochain await. Le voile se lève, les entrées et le son reviennent.
  function annulerPreparation() {
    prepa.jeton++;
    if (!prepa.enCours) return;
    const voile = prepa.voile;
    prepa.enCours = prepa.voile = prepa.attente = false; prepa.etape = null;
    if (prepa.rapport) { prepa.rapport.annule = true; prepa.dernier = prepa.rapport; prepa.rapport = null; }
    delete jeu.dataset.vitrine;
    if (voile) {
      bloquerEntrees(false); leverVoile(); remettreHud();
      const f = prepa.focus; prepa.focus = null;
      if (f && f.isConnected && !f.closest('[hidden]') && f.focus) f.focus({ preventScroll: true });
    }
    retablirSon();
    tPrec = 0;
  }
  // abandon (perte de contexte, liaison perdue) : la démo rend le titre, sinon la vitrine reprend la scène installée
  function abandonnerPreparation() {
    const demo = ecran === 'demo';
    annulerPreparation();
    if (demo) sortirDemo(); else remettreVitrine();
  }
  // La séance doit correspondre à la scène installée : une préparation arrêtée a pu bâtir un autre décor, ou lancer une
  // course que personne ne verra. Sur un menu, la vitrine reprend sur la scène en place, sans rebâtir.
  function remettreVitrine() {
    if (!rendu || !scene || detectionGraphiqueActive || prepa.enCours) return;
    const menus = ['titre', 'preparation', 'enligne', 'prets'];
    const menu = menus.includes(ecran) || (ecran === 'reglages' && menus.includes(retourReglages));
    if (!session || session.i !== scene.index || (menu && session.type !== 'vitrine'))
      lancer('vitrine', scene.index, null, Object.assign({}, conditionsDuDepart(), { saison: scene.saison }));
  }

  // Le point de passage de tous les lancements. o : ecran (écran montré dès le début), fondu (ms de fondu d'entrée,
  // l'ancienne séance continuant derrière), verifier (la préparation s'abandonne s'il devient faux), apres (après
  // l'écran de course), reste (ms avant un départ commun en ligne).
  const ANNULE = { annule: true };
  async function preparerSeance(type, i, enl, conditionsChoisies, o = {}) {
    if (!rendu) return null;
    annulerPreparation();
    restaurerReference();
    const jeton = ++prepa.jeton, debut = performance.now();
    const conditions = enl || conditionsChoisies || conditionsDuDepart(), saison = B.saisons.normaliser(conditions.saison);
    const vitrine = type === 'vitrine', typeCode = enl && enl.locaux && enl.locaux.length === 2 ? 'duo' : type;
    const aBatir = !sceneEnPlace(i, saison), glaces = !vitrine && glacesPossibles({ type: typeCode });
    // peu de travail en vue : même scène, code déjà chaud pour ce type, rendu déjà chauffé sur cette scène, glaces
    // prêtes. Le compte exact (variantes de cette météo, taille d'image, piste mouillable) se fait une fois la séance
    // lancée : s'il manque quelque chose, le voile devient opaque avant de le faire.
    let leger = !vitrine && !aBatir && (prepa.chaud.has(typeCode + ':sec') || prepa.chaud.has(typeCode + ':mouille')) && !!scene.chauffe && scene.chauffe.rendu.size > 0 && (!glaces || glacesPretes(retro.j1));
    const R = { type: typeCode, circuit: i, leger, etapes: [], date: Date.now() };
    Object.assign(prepa, { enCours: true, voile: !vitrine, attente: false, type: typeCode, i, saison, rapport: R, conditions: null, etape: null });
    let S = null, gel = null, glacesGel = null, restaure = true;
    const controler = () => {
      if (jeton !== prepa.jeton) throw ANNULE;
      if (contexteRenduPerdu || (o.verifier && !o.verifier())) { retablir(); abandonnerPreparation(); throw ANNULE; }
    };
    const suite = async () => { await attendreImage(); controler(); };
    // état des vues et des glaces rendu tel qu'au lancement, que la préparation aboutisse ou non
    const retablir = () => {
      if (restaure) return;
      restaure = true;
      if (gel) rendreVues(gel);
      if (glacesGel) for (const [G, pas, cote] of glacesGel) { G.pas = pas; G.cote = cote; }
    };
    const fermer = () => { const d = R.etapes[R.etapes.length - 1]; if (d && d.debut !== undefined) { d.ms = +(performance.now() - d.debut).toFixed(1); delete d.debut; } };
    // une étape : son texte, puis une image cédée pour qu'il se peigne avant le travail qu'il annonce
    const etape = async (nom, attendre) => { fermer(); majVoile(nom); if (attendre) await suite(); R.etapes.push({ nom, debut: performance.now() }); };
    const terminer = () => {
      fermer();
      prepa.enCours = prepa.voile = prepa.attente = false; prepa.etape = null;
      if (vitrine) { delete jeu.dataset.vitrine; retablirSon(); }
      else {
        aller(type === 'demo' ? 'demo' : 'course');
        if (o.apres) o.apres();
        bloquerEntrees(false); prepa.focus = null;
        leverVoile();
      }
      // la première image montrée part d'une horloge propre : pas d'intervalle hérité du chargement, rien
      // d'accumulé, la fenêtre d'observation du mode Auto vide, et la cadence de l'écran comme durée d'image
      oublierIntervalle(); S.acc = 0; dureeImage = periode;
      if (!vitrine && document.hidden && pauseAuto && ecran === 'course') basculerPause(true);
      R.totalMs = +(performance.now() - debut).toFixed(1);
      R.tardives = { n: S.tardives.n, sousVoile: S.tardives.sousVoile };
      prepa.dernier = R; prepa.rapport = null;
      return R;
    };
    let periode = dureeImage;
    try {
      // 1. voile opaque, peint deux fois avant le premier travail lourd
      if (o.ecran && ecran !== o.ecran) aller(o.ecran);
      if (vitrine) { jeu.dataset.vitrine = 'cache'; if (ecran === 'chargement') montrerVoile(true, false); }
      else { bloquerEntrees(true); montrerVoile(!leger, o.fondu); }
      await etape('voile', false);
      if (o.fondu) {
        prepa.attente = true;
        try { const fin = performance.now() + o.fondu; while (performance.now() < fin) await suite(); } finally { prepa.attente = false; }
      }
      if (son) son.suspendre();
      await suite();
      if (!leger) { const t1 = performance.now(); await suite(); if (!document.hidden) prepa.periode = clamp(performance.now() - t1, 4, 60); }
      // 2. décor, s'il change (le seul travail synchrone indivisible : B.decor.construire)
      await etape('decor', aBatir);
      if (aBatir) installer(i, saison);
      // 3. moteur des rétroviseurs : sa copie du décor et les toiles des quatre glaces
      await etape('retro', glaces && !leger && (!retro.rendu || retro.scene !== scene));
      if (glaces) preparerGlaces();
      // 4. axe du tunnel et registre de chauffe de la scène
      await etape('circuit', false);
      preparerTunnel(scene.c); etatChauffe();
      // 5. la séance elle-même
      await etape('seance', !leger);
      const choisies = vitrine && prepa.conditions ? prepa.conditions : conditionsChoisies || (enl ? null : conditions);
      prepa.interne = true;
      try { S = lancer(type, i, enl, choisies); } finally { prepa.interne = false; }
      if (leger) {
        const a = aChauffer(S);
        if (a.manque.length || a.manqueR.length || !prepa.chaud.has(cleCode(typeCode, S))) {
          // la séance demande une variante ou un chemin encore froid (pluie après une course sèche, autre taille) : le
          // fondu court ne cacherait pas leur compilation, le voile passe opaque et se peint avant
          leger = false; R.leger = false; R.promu = true;
          montrerVoile(true, false); majVoile('seance');
          await suite(); await suite();
        }
      }
      // 6. ce que la séance créerait à ses premières images
      await etape('creations', !leger);
      const attentes = prechargerSeance(S);
      if (attentes.length) { await Promise.race([Promise.all(attentes), new Promise(r => setTimeout(r, 2000))]); controler(); }
      gel = figerVues(S); glacesGel = [retro.j1, retro.j2].filter(Boolean).map(G => [G, G.pas, G.cote]); restaure = false;
      // la chauffe consulte un poste de télévision et un réalisateur jetables : les générateurs de la séance ne bougent pas
      S.tele = { poste: null, alea: graine32(GRAINE_JETABLE) };
      if (S.vueJ2) S.vueJ2.tele = { poste: null, alea: graine32(GRAINE_JETABLE + 1) };
      if (S.real) S.real = B.realisateur.creer(GRAINE_JETABLE);
      // 7. chauffe du rendu : variantes atteignables des deux moteurs
      // La vitrine ne chauffe que ce qu'elle montre, par sa première vraie image (étape 10) : les variantes et les
      // témoins de course se chauffent à la première préparation de course, et l'écran titre n'attend pas pour eux.
      await etape('rendu', !leger && !vitrine);
      if (!vitrine) R.rendu = await chaufferRendu(S, suite, leger);
      // 8. chauffe du code : vues de la séance, puis la course jetable
      if (!vitrine && !prepa.chaud.has(cleCode(typeCode, S))) {
        await etape('code', true);
        R.code = await chaufferCode(S, suite, o);
        prepa.chaud.add(cleCode(typeCode, S));
      }
      // 9. remise à zéro de ce que la chauffe a touché
      await etape('zero', false);
      retablir();
      if (S.rouleVu) S.rouleVu.fill(0);
      if (S.rouleVrai) S.rouleVrai.fill(NaN);
      if (B.sillage) S.sillage = B.sillage.creer();
      if (B.vitre) { if (vitreVue) B.vitre.effacer(vitreVue); if (vitreVue2) B.vitre.effacer(vitreVue2); }
      // 10. première vraie image, sous le voile
      await etape('image', !leger);
      periode = (B.cadence && B.cadence.periode && B.cadence.periode()) || prepa.periode || dureeImage;
      dureeImage = periode;
      rendreImage(S, 0, 0);
      if (!vitrine) { majHud(S); if (S.type === 'duo' && S.vueJ2) majHud(S.vueJ2, HUD2, S.course.voitures[S.locaux[1]]); }
      attendreGPU(rendu);
      if (!leger) { if (!vitrine) tiedirVoile(S); await suite(); }
      // 11. l'écran de course, puis le fondu
      return terminer();
    } catch (e) {
      // l'état des vues appartient à la séance : toujours rendu ; les glaces sont communes : seulement si personne
      // d'autre ne prépare
      if (!restaure) { if (gel) rendreVues(gel); if (glacesGel && jeton === prepa.jeton) for (const [G, pas, cote] of glacesGel) { G.pas = pas; G.cote = cote; } restaure = true; }
      fermer();
      if (e === ANNULE) { R.annule = true; if (prepa.rapport === R) prepa.rapport = null; prepa.dernier = R; return R; }
      console.error('BITUME : préparation de la séance', e);
      R.erreur = String(e && e.message || e);
      if (jeton === prepa.jeton) {
        if (S && session === S) { try { return terminer(); } catch (f) { console.error(f); abandonnerPreparation(); } }
        else abandonnerPreparation();
      }
      prepa.dernier = R;
      return R;
    }
  }
  // Vitrine des menus : directe quand sa scène est en place, préparée (vue cachée, menus vivants) quand le décor change.
  function lancerVitrine(i, conditions) {
    restaurerReference();
    const k = conditions || conditionsDuDepart(), saison = B.saisons.normaliser(k.saison);
    if (prepa.enCours && prepa.type === 'vitrine' && prepa.i === i && prepa.saison === saison) { if (conditions) prepa.conditions = conditions; return null; }
    if (!rendu || detectionGraphiqueActive || contexteRenduPerdu || sceneEnPlace(i, saison)) return lancer('vitrine', i, null, conditions);
    return preparerSeance('vitrine', i, null, conditions || null);
  }
  // Réglages changés pendant la pause : la nouvelle variante (anticrénelage, ombres, glaces) se chauffe au retour à
  // l'écran de pause, dans le menu, et non à la première image de course.
  function rechaufferEnPause(S) {
    if (!rendu || contexteRenduPerdu || detectionGraphiqueActive || !S || S !== session) return;
    prechargerSeance(S);
    const a = clamp(S.acc / DT, 0, 1);
    void chaufferRendu(S, null, true, a);   // sans attente : tout se fait dans cette tâche
    rendreImage(S, a, 0);                    // et l'image de pause reste celle de la course, sans les témoins
  }

  // ---------------------------------------------------------------- boucle principale
  let tPrec = 0;
  function oublierIntervalle() {
    // Le temps passé dans un onglet masqué ne doit pas faire baisser la qualité au retour.
    tPrec = 0;
    B.qualite.avancer(palier, 0, { actif: false });
    B.mesures.reinitialiser();
  }
  function image(t) {
    requestAnimationFrame(image);
    // Le banc possède temporairement le renderer. Aucune seconde boucle de jeu ne pollue la mesure.
    if (detectionGraphiqueActive) { tPrec = 0; return; }
    // Sous le voile d'une préparation, rien ne se simule ni ne se dessine et les entrées n'agissent pas ; en démo, un
    // geste rend le titre. Pendant le fondu d'entrée (attente), l'ancienne séance tourne encore.
    if (prepa.voile && !prepa.attente) { tPrec = 0; if (ecran === 'demo') lireManette(); else tenirManettes(); return; }
    const tMes = B.mesures.imageDebut();
    const tBrut = tPrec ? (t - tPrec) / 1000 : DT;   // intervalle réellement subi, avant le bridage de la simulation
    const dtReel = Math.min(.1, tBrut);
    tPrec = t; horlogeReelle += dtReel; dureeImage = lerp(dureeImage, dtReel * 1000, .1);
    lireManette();
    majAttente();
    const sourisVue = souris.active && enCourse() ? 'oui' : 'non';
    if (jeu.dataset.souris !== sourisVue) jeu.dataset.souris = sourisVue;
    // deux manettes branchées : « À deux » le signale, et Start sur la seconde, au titre, ouvre la course à deux
    if (ecran === 'titre') {
      $('t-manettes').hidden = nbManettes < 2;
      const start2 = nbManettes >= 2 && !!(manettes[1].buttons[9] && manettes[1].buttons[9].pressed);
      if (start2 && !pad2.start) { modePrepa = 'duo'; activerSon(); aller('preparation'); }
      pad2.start = start2;
    }
    // préparation d'une course à deux : qui joue avec quoi, selon les choix et les manettes branchées
    if (ecran === 'preparation' && modePrepa === 'duo') texte($('p-manettes'), [0, 1].map(n => 'Joueur ' + (n + 1) + ' : ' + entreeDe(n)).join(' · ') + '.');
    const S = session;
    // vitrine en préparation : les menus vivent, la séance attend la fin de la préparation
    if (!S || !rendu || (prepa.enCours && !prepa.attente)) return;
    // la vitrine tourne derrière les menus ; une course ne tourne qu'à l'écran de course, la démo qu'à l'écran de démo
    const tourne = S.type === 'vitrine' ? ecran !== 'chargement' : ecran === (S.type === 'demo' ? 'demo' : 'course') || (!!S.enLigne && (ecran === 'pause' || ecran === 'resultats'));
    const tSim = B.mesures.actif ? performance.now() : 0;
    if (tourne && S.enLigne) {
      // en ligne : la simulation suit l'horloge commune, pas à pas, depuis l'instant T0 du départ
      const cible = (EL.R ? EL.R.horloge() - S.enLigne.T0 : 0) / 1000;
      let n = 0;
      while (S.course.horloge + DT <= cible && n < 90 && !S.course.termine) { pasSimulation(S, false); n++; }
      if (n) envoyerEtats(S);   // une fois par image, l'état le plus récent : le moins vieux possible à l'arrivée
      S.acc = clamp(cible - S.course.horloge, 0, DT);
      if (cible < 0) texte($('sous-message'), 'Départ dans ' + Math.ceil(-cible) + ' s');
    } else if (tourne) {
      // démo : un choc passe au ralenti (réalisateur)
      S.acc += dtReel * (S.type === 'demo' ? B.realisateur.vitesse(S.real, S.course) : 1);
      let n = 0;
      while (S.acc >= DT && n < 14) { pasSimulation(S, !!(S.reference && S.reference.pilote)); S.acc -= DT; n++; }
      if (n === 14) S.acc = 0;
    } else if (horlogeReelle - (S.imageFigee || 0) < .25) return; // image arrêtée : quatre images par seconde suffisent
    if (B.mesures.actif) B.mesures.section('simulation', performance.now() - tSim);
    S.imageFigee = horlogeReelle;
    if (S.type === 'vitrine') S.suiviRang = Math.floor(horlogeReelle / 18) % 4;
    const dtVu = tourne ? dtReel : 0, cam = rendreImage(S, clamp(S.acc / DT, 0, 1), dtVu);
    if (tourne) majPalier(S, tBrut);
    const tHud = B.mesures.actif ? performance.now() : 0;
    if (S.type !== 'vitrine') {
      majHud(S);
      if (S.type === 'duo' && S.vueJ2) majHud(S.vueJ2, HUD2, S.course.voitures[S.locaux[1]]);
      const j = S.course.joueur;
      // en ligne, le classement s'affiche 8 s après sa propre arrivée et se complète en direct : la course continue
      // derrière (l'autre pilote est peut-être encore en piste), jusqu'à sa fin commune
      if ((S.type === 'course' || S.type === 'chrono' || S.type === 'duo') && !S.resultats &&
          (S.course.termine || (j.abandon && S.course.horloge - j.tAbandon >= 3) || (S.enLigneOrigine && S.locaux.every(id => S.course.voitures[id].fini) && S.course.temps - Math.max(...S.locaux.map(id => S.course.voitures[id].tempsFinal)) >= 8))) {
        if (!S.enLigneOrigine) S.course.termine = true;
        montrerResultats(S);
      }
      if (S.enLigneOrigine && ecran === 'resultats' && horlogeReelle - (S.majResultats || 0) > .5) { S.majResultats = horlogeReelle; montrerResultats(S, true); }
      if (S.type === 'demo' && !S.enchaine && ecran === 'demo' && (S.course.termine || (S.finA !== null && S.course.horloge - S.finA > APRES_DRAPEAU))) demoSuivante(S);
    }
    if (B.mesures.actif) B.mesures.section('hud', performance.now() - tHud);
    const tSon = B.mesures.actif ? performance.now() : 0;
    majSon(S, cam, dtVu);
    if (B.mesures.actif) {
      B.mesures.section('son', performance.now() - tSon);
      B.mesures.audio(son ? son.stats() : null);
      const fx = S && S.fx;
      B.mesures.pieces(fx ? B.traces.compter(fx).debris : 0, B.traces.DEBRIS,
        window.FPhysX && window.FPhysX.status ? window.FPhysX.status() : null);
      B.mesures.imageFin(tMes, tBrut); B.mesures.majAffichage(rendu, horlogeReelle);
    }
  }

  // ---------------------------------------------------------------- démarrage
  // Petites configurations (David, 16/11 : « faire tourner ce jeu sur des petites configs type ordi portable de
  // bureau ») : un processeur graphique intégré ou logiciel est reconnu dès le départ ; le profil part alors sans
  // anticrénelage, avec une carte d'ombres simple, et la qualité Auto commence un palier plus bas (voir paliers).
  // Les capacités restent ouvertes pour un choix manuel ; FERRO n'alloue les cibles qu'au moment de les utiliser.
  let gpuModeste = false;
  function webgl2() {
    try {
      const t = document.createElement('canvas'), gl = t.getContext('webgl2');
      if (!gl) return false;
      const info = gl.getExtension('WEBGL_debug_renderer_info'), nom = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      materielRendu = [nom, gl.getParameter(gl.MAX_TEXTURE_SIZE), navigator.hardwareConcurrency || 0].join('|');
      gpuModeste = /intel|uhd|iris|hd graphics|mali|adreno|powervr|swiftshader|llvmpipe|software|microsoft basic|radeon\(tm\) graphics|vega [0-9]+ graphics/i.test(nom) || (navigator.hardwareConcurrency || 8) <= 4;
      const perte = gl.getExtension('WEBGL_lose_context'); if (perte) perte.loseContext();
      return true;
    } catch (e) { return false; }
  }
  function erreur(titre, texteErreur) {
    const el = $('erreur');
    el.innerHTML = '<h2></h2><p></p>'; el.querySelector('h2').textContent = titre; el.querySelector('p').textContent = texteErreur;
    el.hidden = false; $('chargement').classList.add('fini');
  }
  function empreinteDetection() {
    return B.autoconfig.empreinte(materielRendu, innerWidth, innerHeight, window.devicePixelRatio || 1);
  }
  function restaurerDecorApresDetection() {
    if (!scene || !rendu) { restaurerDecorApresContexte = false; return; }
    scene.chauffe = null;   // le banc a remplacé le monde du moteur : la chauffe de cette scène est à refaire
    if (contexteRenduPerdu) { restaurerDecorApresContexte = true; return; }
    const atm = session && session.nature ? session.nature.ambiance.atmosphere : scene.decor.atmosphere;
    rendu.setWorld([], [], atm); rendu.setNappes(scene.decor.nappes); rendu.setLots(scene.decor.lots);
    if (session && session.nature) session.nature.revisionRendu = -1;
    restaurerDecorApresContexte = false;
  }
  function contexteGraphiqueRetabli() {
    contexteRenduPerdu = false;
    if (scene) scene.chauffe = null;   // nouveau contexte : programmes et cibles du moteur principal sont à refaire
    if (restaurerDecorApresContexte && !detectionGraphiqueActive) {
      try { restaurerDecorApresDetection(); appliquerPalier(); }
      catch (e) { console.warn('BITUME : restauration différée du décor', e); }
    }
  }
  function majDetectionGraphique() {
    const bouton = $('r-detecter'), etat = $('r-detection-etat');
    const enLigne = !!(session && session.enLigne) || !!(EL && EL.R);
    bouton.disabled = detectionGraphiqueActive || enLigne;
    if (enLigne) { etat.textContent = 'Détection disponible après avoir quitté la partie en ligne.'; return; }
    const dernier = derniereDetection || lireStock(B.autoconfig.CLE, null);
    if (dernier && dernier.statut === 'ok' && B.autoconfig.profils[dernier.selection]) {
      const choisis = B.autoconfig.reglages(dernier.selection);
      const personnalise = B.autoconfig.CLES.some(k => reglages[k] !== choisis[k]);
      etat.textContent = 'Dernière détection : ' + B.autoconfig.profils[dernier.selection].nom
        + (personnalise ? ' · réglages modifiés depuis.' : ' · réglages appliqués.');
    } else etat.textContent = dernier && dernier.statut === 'interrompu' ? 'Détection interrompue · réglages conservés.' : 'Aucune mesure enregistrée.';
  }
  function imageDetection() {
    return new Promise(resolve => {
      let fini = false;
      const finir = valeur => { if (!fini) { fini = true; clearTimeout(delai); resolve(valeur); } };
      const delai = setTimeout(() => finir(null), 1800);
      requestAnimationFrame(t => {
        // La boucle du jeu attend le banc ; B doit malgré tout permettre de le passer à la manette.
        try {
          const liste = navigator.getGamepads ? navigator.getGamepads() : [];
          for (const p of liste || []) if (p && p.connected && p.buttons[1] && p.buttons[1].pressed) annulerDetection = true;
        } catch (_) { /* navigateur sans accès aux manettes */ }
        finir(t);
      });
    });
  }
  function appliquerDetection(resultat) {
    if (!resultat || resultat.statut !== 'ok') return false;
    // Un relancement est une demande explicite de remplacer TOUS les choix graphiques, y compris les overrides.
    const choisis = B.autoconfig.reglages(resultat.selection);
    if (!choisis) return false;
    Object.assign(reglages, choisis);
    // Après une mesure réelle, l'ancien indice fondé sur le nom du GPU n'impose plus un faux plafond.
    gpuModeste = resultat.selection === 'low';
    capacitesRendu = Object.freeze({ ...capacitesRendu, gpuModeste });
    Object.assign(palier, { n: 0, somme: 0, compte: 0, t: 0, aise: 0 });
    B.graphismes.stabiliser(etatProfils, reglages.qualite, 0, horlogeProfils());
    ecrireStock('bitume.reglages', reglages);
    ecrireStock(B.autoconfig.CLE, resultat);
    return true;
  }
  async function detecterGraphismes(auDemarrage = false) {
    if (detectionGraphiqueActive || !rendu || (session && session.enLigne) || (EL && EL.R)) return null;
    // le banc prend le moteur : une préparation en cours s'arrête et la vitrine reprend sa scène
    if (prepa.enCours) abandonnerPreparation();
    detectionGraphiqueActive = true; annulerDetection = false;
    const ecranAvant = ecran, partageAvant = jeu.dataset.partage, focusAvant = document.activeElement;
    const profilAvant = !!(rendu.profile && rendu.profile());
    const elements = [...ECRANS.map($), $('hud'), hud2, $('demo'), $('meteo'), $('meteo2'), $('vitre'), $('vitre2'), $('glace-g'), $('glace-d'), $('glaces2')];
    const masques = elements.map(el => [el, el.hidden]);
    for (const [el] of masques) el.hidden = true;
    ecran = 'detection'; jeu.dataset.ecran = 'detection'; jeu.dataset.partage = '';
    $('autodetection').hidden = false; $('detection-progres').value = 0;
    $('detection-annuler').textContent = auDemarrage ? 'Passer' : 'Annuler';
    $('detection-annuler').focus({ preventScroll: true });
    $('chargement').classList.add('fini');
    if (son) { son.musique(false); son.suspendre(); }
    let parcours = null, resultat = null;
    try {
      // Peindre l'indication avant de construire le parcours procédural.
      await imageDetection();
      parcours = B.sceneBench.creer(rendu, { ...capacitesRendu, gpuModeste: false });
      resultat = await B.autoconfig.executer({ empreinte: empreinteDetection, image: imageDetection,
        annule: () => annulerDetection, masque: () => document.hidden, perdu: () => contexteRenduPerdu,
        preparer: parcours.preparer, dessiner: parcours.dessiner, profilGPU: () => rendu.profile ? rendu.profile() : null,
        progression: (texte, fraction) => { $('detection-texte').textContent = texte; $('detection-progres').value = Math.min(1, fraction); } });
      derniereDetection = resultat;
      appliquerDetection(resultat);
    } catch (e) {
      derniereDetection = resultat = { statut: 'interrompu', motif: 'erreur' };
      console.warn('BITUME : détection graphique interrompue', e);
    } finally {
      if (parcours) parcours.liberer();
      try {
        if (rendu.profile) { rendu.profile(false); if (profilAvant) rendu.profile(true); }
        // La séance et ses obstacles n'ont jamais été remplacés. Restituer uniquement son décor au renderer.
        restaurerDecorApresDetection();
      } catch (e) { console.warn('BITUME : restauration du rendu après détection', e); }
      finally {
        ecran = ecranAvant; jeu.dataset.ecran = ecranAvant; jeu.dataset.partage = partageAvant || '';
        for (const [el, cache] of masques) el.hidden = cache;
        $('autodetection').hidden = true;
        detectionGraphiqueActive = false;
        if (!contexteRenduPerdu) appliquerPalier();
        oublierIntervalle();
        if (!auDemarrage) {
          if (!contexteRenduPerdu && session && session.type === 'vitrine' && resultat && resultat.statut === 'ok') lancerVitrine(session.i);
          if (ecran === 'reglages') remplirReglages();
          if (son && session && session.type === 'vitrine') son.reprendre();
          if (son) son.musique(ecranAvant === 'titre');
          if (focusAvant && focusAvant.focus) focusAvant.focus({ preventScroll: true });
        }
      }
    }
    return resultat;
  }
  $('r-detecter').addEventListener('click', () => { void detecterGraphismes(false); });
  $('detection-annuler').addEventListener('click', () => { annulerDetection = true; });
  document.addEventListener('change', e => {
    if (ecran === 'reglages' && B.autoconfig.CLES.includes(e.target.name)) majDetectionGraphique();
  });
  addEventListener('keydown', e => { if (detectionGraphiqueActive && e.code === 'Escape') { annulerDetection = true; e.preventDefault(); } });

  async function demarrer() {
    if (!webgl2()) { erreur('WebGL2 indisponible', 'BITUME dessine la piste avec WebGL2. Ouvrez la page dans un navigateur récent (Chrome, Edge, Firefox, Safari 15 ou plus) avec l’accélération graphique active.'); return; }
    try {
      const optionsRendu = { msaa: 4, shadowMapScale: 2, reflections: true, sea: false, overlayLighting: 'world' };
      rendu = window.FRender.create(canvas, optionsRendu);
      // raccord FERRO : cibles gardées malgré 120 rendus sans usage (sinon une variante chauffée peut être libérée)
      if (rendu.retain) rendu.retain(true);
      // ce que le moteur a réellement ouvert, et non ce que le menu demande : src/graphismes.js ne promet pas
      // une capacité que FRender.create aurait refusée (msaa, atlas d'ombres, reflets d'écran)
      capacitesRendu = B.graphismes.capacites(optionsRendu, gpuModeste, window.devicePixelRatio || 1);
      // perte de contexte : les pièces détachées n'ont plus de scène où vivre ; on rend leurs corps sans attendre
      canvas.addEventListener('webglcontextlost', () => { contexteRenduPerdu = true; if (session && session.fx) B.traces.liberer(session.fx); if (prepa.enCours) abandonnerPreparation(); });
      canvas.addEventListener('webglcontextrestored', contexteGraphiqueRetabli);
      palier.n = gpuModeste ? 1 : 0;
      if (rendu.stats.backend !== 'webgl2') { erreur('WebGL2 indisponible', 'Le rendu de secours ne sait pas dessiner la piste. Activez l’accélération graphique du navigateur.'); return; }
      B.graphismes.stabiliser(etatProfils, reglages.qualite, palier.n, horlogeProfils());
      appliquerPalier();
      const mesure = lireStock(B.autoconfig.CLE, null);
      // Le cache évite de refaire le test et d'effacer des choix manuels à chaque ouverture.
      if (!B.autoconfig.cacheValide(mesure, empreinteDetection())) await detecterGraphismes(true);
      else {
        derniereDetection = mesure;
        gpuModeste = mesure.selection === 'low';
        capacitesRendu = Object.freeze({ ...capacitesRendu, gpuModeste });
      }
      // Moteur des rétroviseurs dès la page, quand une course pourra montrer des glaces vives : sa création ne tombe
      // jamais sur le chemin d'une séance.
      if (glacesPossibles(null)) creerMoteurRetro();
      // PhysX (FERRO) ne sert qu'aux pièces détachées et son décodage est lourd : lancé en tâche de fond, jamais
      // sur le chemin de l'écran titre, et l'absence du module ne doit pas empêcher la page de tourner.
      if (window.FPhysX && window.FPhysX.init) Promise.resolve(window.FPhysX.init()).catch(() => { /* pièces en parabole */ });
      son = B.son.creer();
      reglages.circuit = clamp(reglages.circuit | 0, 0, CATALOGUE.length - 1);
      // la vitrine du titre est préparée comme une séance, sous le voile de chargement de la page
      const R = await preparerSeance('vitrine', reglages.circuit, null, null);
      // préparation abandonnée avant la séance (contexte graphique perdu avant le décor) : la vitrine se lance
      // d'un bloc, comme avant le voile ; le moteur reprend ses ressources à la restauration du contexte
      if (!session && R && R.annule) lancer('vitrine', reglages.circuit, null, null);
      if (!session) throw new Error((prepa.dernier && prepa.dernier.erreur) || 'la vitrine ne démarre pas');
      $('chargement').classList.add('fini');
      aller('titre');
      requestAnimationFrame(image);
    } catch (e) {
      console.error(e);
      erreur('Le jeu n’a pas pu démarrer', String(e && e.message || e));
    }
  }
  // Outil d'essai (console) : avance la séance de n secondes, la voiture du joueur confiée à l'IA si pilote est vrai.
  // La séance devient d'essai : elle n'écrit plus ni record ni fantôme.
  function avancer(secondes, pilote) {
    const S = session; if (!S) return null;
    S.essai = true;
    for (let k = 0, n = Math.round(secondes / DT); k < n && !S.course.termine; k++) pasSimulation(S, pilote);
    const j = S.course.joueur;
    return { phase: S.course.phase, tours: j.tours, position: j.position, meilleur: j.meilleur, termine: S.course.termine };
  }
  // Parcours reproductible réservé à la console et aux outils de qualification. Même course réelle, mêmes
  // caméras et rétroviseurs ; seuls les paramètres de départ sont imposés. Aucun record ni réglage stocké.
  // Le retour au jeu normal restitue les réglages qui précédaient cet essai.
  function restaurerReference() {
    if (!session || !session.reglagesReference) return;
    Object.assign(reglages, session.reglagesReference);
    decorEnrichi = session.decorAvantReference;
    delete session.reglagesReference;
    session.reference = null;
    if (rendu) appliquerPalier();
  }
  // Démo des outils (tools/controle-options.mjs, tools/banc-navigateur.mjs) : synchrone comme reference(), la séance
  // et sa scène sont en place au retour. Le jeu, lui, la prépare sous le voile (lancerDemo, ou preparer({ type: 'demo' })).
  function demoDirecte(i) {
    lancer('demo', clamp(i | 0, 0, CATALOGUE.length - 1));
    apresDemo();
    aller('demo');
  }
  function reference(options = {}) {
    if (!rendu) throw new Error('rendu absent');
    if (session && session.enLigne) throw new Error('terminer la séance en ligne avant une référence locale');
    const mode = options.mode || 'solo', qualite = options.qualite || 'high';
    const i = options.circuit ?? 0, graine = options.graine ?? 17017;
    const meteo = ['sec', 'clair'].includes(options.meteo) ? 'soleil' : (options.meteo || 'soleil');
    const vue = options.vue || 'cockpit', vue2 = options.vue2 || 'cockpit';
    const partage = options.partage || 'haut-bas', glaces = options.retro || 'oui';
    const difficulte = options.difficulte ?? 1, tours = options.tours ?? 3;
    const pilote = options.pilote ?? true;
    const vitesse = options.vitesse ?? 75, mouille = options.mouille ?? (meteo === 'pluie' ? .75 : 0);
    const vues = ['cockpit', 'poursuite', 'tele', 'helico'];
    if (!['solo', 'duo'].includes(mode) || !B.graphismes.QUALITES.includes(qualite)) throw new Error('mode ou qualité de référence inconnu');
    if (!Number.isInteger(i) || i < 0 || i >= CATALOGUE.length || !Number.isInteger(graine) || graine < 0 || graine > 0xffffffff) throw new Error('circuit ou graine invalide');
    if (!Number.isInteger(difficulte) || difficulte < 0 || difficulte > 2 || !Number.isInteger(tours) || tours < 1 || tours > 99) throw new Error('difficulté ou nombre de tours invalide');
    if (typeof pilote !== 'boolean') throw new Error('pilotage de référence invalide');
    if (!B.meteo.pour(meteo) || !vues.includes(vue) || !vues.includes(vue2) || !['haut-bas', 'cote'].includes(partage) || !['oui', 'non'].includes(glaces)) throw new Error('paramètre visuel de référence inconnu');
    if (!Number.isFinite(vitesse) || vitesse < 0 || vitesse > 100 || !Number.isFinite(mouille) || mouille < 0 || mouille > 1) throw new Error('vitesse ou humidité invalide');
    if (options.decor !== undefined && !['reference', 'enrichi'].includes(options.decor)) throw new Error('décor de référence inconnu');
    const c = circuit(i);
    if (options.depart === 'tunnel' && !c.tunnel) throw new Error('ce circuit ne possède pas de tunnel');
    const depart = options.depart === 'tunnel' ? c.tunnel.debut - 40 : (options.depart ?? 800);
    if (!Number.isFinite(depart)) throw new Error('abscisse de départ invalide');
    restaurerReference();
    const cles = ['vue', 'vue2', 'partage', 'qualite', 'anticrenelage', 'ombres', 'vegetation', 'faune', 'moment', 'saison', 'retro', 'meteo', 'saisonMode', 'momentMode', 'meteoMode', 'pneus', 'secousses', 'vibrations', 'champ', 'difficulte', 'tours'];
    const avant = Object.fromEntries(cles.map(k => [k, reglages[k]])), decorAvant = decorEnrichi;
    Object.assign(reglages, { vue, vue2, partage, qualite, difficulte, tours, retro: glaces, meteo, saisonMode: 'manuel', momentMode: 'manuel', meteoMode: 'manuel', secousses: 0, vibrations: 'non', champ: 60,
      pneus: B.conduite.pneusConseilles(B.conduite.eauSurPiste(B.meteo.pour(meteo))) });
    Object.assign(reglages, B.graphismes.normaliserOptions(options));
    reglages.moment = B.ambiance.normaliser(options.moment ?? 'jour');
    reglages.saison = B.saisons.normaliser(options.saison ?? 'ete');
    decorEnrichi = options.decor !== 'reference';
    graineCourse = graine - 1;
    // l'ancre du décor se fixe avant la construction de la scène : une séance de référence est filmée au palier demandé
    B.graphismes.stabiliser(etatProfils, qualite, palier.n, horlogeProfils());
    const S = lancer(mode === 'duo' ? 'duo' : 'course', i);
    S.reglagesReference = avant; S.decorAvantReference = decorAvant; S.essai = true;
    S.meteo.mouille = mouille;
    const co = S.course, ancienDepart = co.joueur.etat.s;
    co.phase = 'course'; co.feux.vert = true; co.feux.allumes = 5; co.horloge = 6; co.temps = 6;
    const P = B.conduite.PARAMS;
    for (const v of co.voitures) {
      const et = v.etat, decal = B.circuit.ecart(c, ancienDepart, et.s);
      et.s = ramener(depart + (v.id === S.locaux[1] ? -14 : decal), c.longueur);
      if (v.joueur) et.d = 0;
      const e = B.circuit.echantillon(c, et.s);
      et.y = e.y - et.d * Math.sin(e.devers); et.tangage = Math.atan(e.pente || 0); et.roulis = e.devers || 0;
      et.v = vitesse; et.gaz = .6;
      const rapport = P.vitessePointe.findIndex(pointe => vitesse < pointe * .95);
      et.rapport = rapport < 0 ? P.vitessePointe.length : rapport + 1;
      et.regime = clamp(P.maxUtile * vitesse / P.vitessePointe[et.rapport - 1], P.ralenti, P.maxUtile);
      v.progression = ramener(et.s - (c.depart || 0), c.longueur); v.roule = et.s; v.tourValide = false;
      v.passages = 0; v.maxPassages = 0; v.debutTour = co.temps;
      co.sAvant[v.id] = et.s;
    }
    remplirPoses(S.cour, co); remplirPoses(S.prec, co);
    cameraEssai = null; horlogeReelle = 0; tPrec = 0; dureeImage = 16;
    Object.assign(palier, { n: gpuModeste ? 1 : 0, somme: 0, compte: 0, t: 0, aise: 0 });
    // glaces remises à leur état de départ sans réallouer : rien ne naît dans la première image de la référence
    for (const G of [retro.j1, retro.j2]) if (G) { G.cote = 0; remettreLampes(G); }
    S.reference = { graine, circuit: i, circuitId: CATALOGUE[i].id, graineCircuit: CATALOGUE[i].graine,
      mode, qualite, ...B.graphismes.normaliserOptions(reglages), moment: reglages.moment, saison: reglages.saison, difficulte, tours, pilote, vue, vue2, partage, retro: glaces, meteo, mouille, depart: ramener(depart, c.longueur), vitesse,
      decor: decorEnrichi ? 'enrichi' : 'reference', tunnel: c.tunnel ? { debut: c.tunnel.debut, fin: c.tunnel.fin } : null };
    $('chargement').classList.add('fini'); aller('course'); appliquerPalier();
    B.mesures.reinitialiser();
    return Object.assign({}, S.reference);
  }
  // Banc (console) : une course en qualité fixe (« high » par défaut ; le mode Auto masquerait les régressions), la
  // voiture du joueur confiée à l'IA, grille et feux passés en simulation. Après une seconde de chauffe, il mesure
  // l'intervalle entre deux images pendant 20 s, rend p50, p95 et la pire image en ms (objet JSON), puis revient à
  // l'écran titre. La séance est d'essai : ni record ni fantôme.
  function banc(options = {}) {
    const duree = options.duree || 20, chauffe = options.chauffe ?? 1, qualite = options.qualite || 'high';
    if (!rendu) return Promise.reject(new Error('rendu absent'));
    if (!B.graphismes.QUALITES.includes(qualite)) return Promise.reject(new Error('qualité inconnue : ' + qualite));
    reference(Object.assign({}, options, { qualite, circuit: options.circuit ?? reglages.circuit }));
    const S = session; S.essai = true; S.banc = { qualite, effets: 0 };
    B.graphismes.stabiliser(etatProfils, qualite, palier.n, horlogeProfils());
    appliquerPalier();
    $('chargement').classList.add('fini');
    aller('course');
    while (S.course.phase !== 'course') pasSimulation(S, true);
    return new Promise(rendre => {
      const temps = [], effets = []; let t0 = 0, prec = 0;
      const mesurer = t => {
        const interrompu = session !== S || ecran !== 'course';
        if (!t0) t0 = t;
        const ecoule = (t - t0) / 1000;
        if (!interrompu && prec && ecoule > chauffe) { temps.push(t - prec); effets.push(S.banc.effets); }
        S.banc.effets = 0;
        prec = t;
        if (!interrompu && ecoule < chauffe + duree) { requestAnimationFrame(mesurer); return; }
        const tri = temps.sort((a, b) => a - b), q = p => tri.length ? tri[Math.min(tri.length - 1, Math.floor(p * tri.length))] : 0;
        const r = {
          qualite, duree: +Math.max(0, ecoule - chauffe).toFixed(2), images: tri.length, p50: +q(.5).toFixed(2), p95: +q(.95).toFixed(2),
          pire: +(tri.length ? tri[tri.length - 1] : 0).toFixed(2), fenetre: innerWidth + '×' + innerHeight, image: canvas.width + '×' + canvas.height,
          circuit: CATALOGUE[S.i].nom, interrompu,
          reference: S.reference,
          effets: { moyenne: +(effets.reduce((a, b) => a + b, 0) / Math.max(1, effets.length)).toFixed(3), p95: +(effets.sort((a, b) => a - b)[Math.floor(.95 * effets.length)] || 0).toFixed(3) },
          traces: B.traces.compter(S.fx)
        };
        S.banc = null;
        if (session === S) { restaurerReference(); if (ecran === 'course') aller('titre'); }
        console.info('BITUME banc', JSON.stringify(r));
        rendre(r);
      };
      requestAnimationFrame(mesurer);
    });
  }
  window.BITUME_JEU = { get session() { return session; }, get rendu() { return rendu; }, get ecran() { return ecran; }, reglages, CATALOGUE, avancer, banc, reference, detecterGraphismes,
    // ce que le banc et le contrôle visuel vérifient sans toucher au jeu : la scène installée et le profil résolu
    get scene() { return scene; }, get profil() { return profilDe(session); }, get ancre() { return etatProfils.decor; },
    get son() { return son ? son.stats() : null; }, get palier() { return palier.n; }, get gpuModeste() { return gpuModeste; },
    demo: i => demoDirecte(i === undefined ? reglages.circuit : i), // lance la démo sans attendre les cinq secondes, dans la tâche de l'appelant
    // Prépare et lance une séance comme le menu : { type: course|chrono|duo|demo|vitrine, circuit, conditions }.
    // Rend la promesse du compte rendu (étapes et durées, chauffe, créations tardives).
    preparer: (o = {}) => {
      const type = o.type || 'course', i = Number.isInteger(o.circuit) ? clamp(o.circuit, 0, CATALOGUE.length - 1) : reglages.circuit;
      if (type === 'demo') return lancerDemo(i);
      if (!['course', 'chrono', 'duo', 'vitrine'].includes(type)) return Promise.reject(new Error('type de séance inconnu : ' + type));
      return preparerSeance(type, i, null, o.conditions || null, { apres: type === 'chrono' ? () => sousMessage('Le chrono part à la ligne') : null });
    },
    // état du chargement : préparation en cours, étape, créations tardives de la séance (zéro en course), dernier compte rendu
    get chargement() {
      const T = session && session.tardives;
      return { enCours: prepa.enCours, voile: prepa.voile, type: prepa.type, etape: prepa.etape,
        tardives: T ? { n: T.n, sousVoile: T.sousVoile, noms: Object.assign({}, T.noms) } : null,
        rapport: prepa.rapport || prepa.dernier, chaud: [...prepa.chaud] };
    },
    get pauseAuto() { return pauseAuto; }, set pauseAuto(v) { pauseAuto = !!v; },
    get pilotageAuto() { return pilotageAuto; }, set pilotageAuto(v) { pilotageAuto = !!v; }, get enLigne() { return EL; },
    get camera() { return cameraEssai; }, set camera(f) { cameraEssai = typeof f === 'function' ? f : null; },
    // volet de mesures : BITUME_JEU.mesures = true l'ouvre, false le ferme ; la lecture donne l'instantané
    get mesures() { return B.mesures.lire(rendu); }, set mesures(v) { B.mesures.afficher(!!v, rendu); } };
  setTimeout(demarrer, 20);
})(globalThis.BITUME = globalThis.BITUME || {});
