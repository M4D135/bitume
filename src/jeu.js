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
  // localStorage est synchrone, et un fantôme pèse jusqu'à 43 ko de base64. Ce que la course écrit (records, fantôme,
  // réglages changés en roulant) passe donc par une file, vidée au repos du navigateur, en quittant l'écran de course
  // (pause, résultats) et quand la page est masquée ou quittée : jamais dans le pas de simulation ni dans l'image.
  // Une valeur en attente peut être une fonction : le fantôme n'est encodé qu'à la vidange. Lire ou écrire une clé en
  // attente vide d'abord la file : on relit toujours ce qu'on a écrit.
  function lireStock(cle, defaut) { if (stockEnAttente.has(cle)) viderStock(); try { const t = localStorage.getItem(cle); return t ? JSON.parse(t) : defaut; } catch (e) { return defaut; } }
  function ecrireStock(cle, valeur) { stockEnAttente.delete(cle); try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) { /* stockage indisponible */ } }
  const stockEnAttente = new Map();
  let vidangePrevue = false;
  function differerStock(cle, valeur) {
    stockEnAttente.set(cle, valeur);
    if (vidangePrevue) return;
    vidangePrevue = true;
    // Safari n'a pas requestIdleCallback : une seconde plus tard, hors de toute image
    if (typeof requestIdleCallback === 'function') requestIdleCallback(viderAuRepos, { timeout: 4000 });
    else setTimeout(viderStock, 1000);
  }
  function viderAuRepos(repos) {
    // trop peu de marge avant l'image suivante : la vidange attend le repos suivant (au plus 4 s)
    if (!repos.didTimeout && repos.timeRemaining() < 4) { requestIdleCallback(viderAuRepos, { timeout: 4000 }); return; }
    viderStock();
  }
  function viderStock() {
    vidangePrevue = false;
    for (const [cle, valeur] of [...stockEnAttente]) ecrireStock(cle, typeof valeur === 'function' ? valeur() : valeur);
  }
  const DEFAUT = { vue: 'cockpit', vue2: 'poursuite', partage: 'haut-bas', boite: 'auto', aide: 0.35, qualite: 'auto', cadence: 'auto', general: 0.8, moteur: 0.9, effets: 0.9, tours: 3, difficulte: 1, circuit: 0, champ: 60, retro: 'auto', pneus: 'slicks', tableau: 'reduit', carte: 'oui', cartePosition: 'droite', carteTaille: 'normale', demo: 'oui', vibrations: 'oui', vibrationForce: 0.5, meteo: 'aleatoire',
    anticrenelage: 'profil', ombres: 'profil', vegetation: 'profil', faune: 'profil', moment: 'jour', saison: 'ete', saisonMode: 'manuel', momentMode: 'manuel',
    secousses: (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1; } catch (e) { return 1; } })() };
  const reglages = Object.assign({}, DEFAUT, lireStock('bitume.reglages', {}));
  reglages.qualite = B.graphismes.normaliser(reglages.qualite);
  // Cadence d'images (Auto, Écran, 120, 60, 30) : une valeur ancienne, inconnue ou mal écrite revient à Auto.
  reglages.cadence = B.cadence.normaliser(reglages.cadence);
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
    // en course (changement de vue au clavier ou à la manette), l'écriture attend la file
    if (!session || !session.reglagesReference) (ecran === 'course' ? differerStock : ecrireStock)('bitume.reglages', reglages);
  };
  // records et fantômes suivent la physique : ceux de l'essai 0.1 (avant le modèle à deux essieux) ne se comparent plus
  const PHYSIQUE = 'p9', CLE_RECORDS = 'bitume.records.' + PHYSIQUE, CLE_FANTOME = 'bitume.fantome.' + PHYSIQUE + '.';
  const records = lireStock(CLE_RECORDS, {});
  // temps et longueur du fantôme gardé, par circuit : lus une fois, puis tenus à jour à chaque écriture (finTour
  // relisait et analysait le fantôme entier à chaque tour de chrono)
  const fantomesGardes = new Map();

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
    // ox, oz et e servent aussi tels quels au plan de course (ox + x × e), qui projette sans créer de tableau
    return { e, ox, oz, vers: (x, z) => [ox + x * e, oz + z * e] };
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
  const canvas = $('scene'), jeu = $('jeu');
  function appliquerCarte() {
    for (const cle of ['carte', 'cartePosition', 'carteTaille'])
      if (jeu.dataset[cle] !== reglages[cle]) jeu.dataset[cle] = reglages[cle];
  }
  appliquerCarte();

  // Rien ne se coupe à distance : le plan lointain passe derrière tout le décor (au plus à 4,4 km de la piste) et la
  // brume fait la limite. Les ombres du soleil prennent tout l'atlas du moteur sur un carré de 200 m de côté.
  const PORTEE_VUE = 6000, OMBRE = 100, OMBRE_DEVANT = 76;
  function installer(i, saisonDemandee) {
    // Le décor est bâti sur un palier « ancre » (voir « profils graphiques du menu ») : la même piste ne se
    // reconstruit pas à chaque fluctuation du gouverneur, seulement quand l'ancre ou l'enrichissement change.
    const ancre = etatProfils.decor;
    const veut = B.graphismes.melange(ancre, 0, { decor: ancre, capacites: capacitesRendu, options: reglages }).decor;
    const vegetationQualite = decorEnrichi ? veut.vegetationQualite : 'off';
    const saison = B.saisons.normaliser(saisonDemandee ?? reglages.saison);
    if (scene && scene.index === i && scene.enrichi === decorEnrichi && scene.palier === ancre && scene.vegetationQualite === vegetationQualite && scene.saison === saison) return scene;
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
  const pad = { precedent: [], volant: 0, gaz: 0, frein: 0, derive: false, actif: false, manette: null, deriveEtat: null };
  const pad2 = { precedent: [], volant: 0, gaz: 0, frein: 0, derive: false, manette: null, deriveEtat: null };   // manette du joueur 2 (écran partagé)
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
    if (document.hidden) { relacherTactile(); viderStock(); }   // un onglet masqué peut être tué sans autre avis
    if (pauseAuto && document.hidden && enCourse()) basculerPause(true);
    if (son) son.musique(!document.hidden && ecran === 'titre'); // onglet caché : le minuteur du thème serait bridé
  });
  addEventListener('focus', oublierIntervalle);
  addEventListener('pagehide', viderStock);   // page fermée ou rechargée : la file part avant
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

  // Vibrations de manette (David, 14/11 puis 18/11 : « de meilleures vibrations ») : src/vibrations.js calcule quatre
  // sorties continues (moteur léger, moteur lourd, gâchettes gauche et droite) une fois par image rendue, avec la durée
  // réelle de l'image : le ressenti reste le même à 30, 60 ou 120 images par seconde. Chaque joueur a sa manette, son
  // état (phases et enveloppes) et les événements de son image (chocs, contacts, rapports, réceptions), retenus pas
  // après pas dans un tableau réutilisé. Moteur lourd (grave) à droite, léger (aigu) à gauche ; rien si la manette ne
  // sait pas vibrer.
  // Une manette ne suit pas une modulation plus fine qu'une quinzaine de hertz, et chaque reprogrammation passe par le
  // pilote : une trentaine par seconde au plus (31 ms, pour qu'une image à 30 Hz un peu en avance passe encore). L'effet
  // dure trois intervalles : une image en retard ne coupe pas le grondement, un onglet quitté l'éteint seul.
  const VIB_INTERVALLE = 31, VIB_DUREE = 100, VIB_EVENEMENTS = 64;
  const VIB_ATTERRISSAGE = Object.freeze({ type: 'atterrissage', force: 0 }), sansSuite = () => {};
  function etatVibrations() {
    return {
      V: B.vibrations.creer(), evenements: [],
      entree: { regime: 0, ralenti: 0, maxUtile: 0, gaz: 0, frein: 0, v: 0, surface: 'piste', vibreur: false, patinage: 0,
        blocage: 0, glisseAr: 0, glisseAv: 0, bosse: 0, turbo: 0, force: .5, derive: null, evenements: null },
      // paramètres des effets, réutilisés : le navigateur les lit pendant l'appel
      double: { startDelay: 0, duration: VIB_DUREE, weakMagnitude: 0, strongMagnitude: 0 },
      gachettes: { startDelay: 0, duration: VIB_DUREE, weakMagnitude: 0, strongMagnitude: 0, leftTrigger: 0, rightTrigger: 0 },
      instant: -Infinity, arret: true
    };
  }
  const vibrations = [etatVibrations(), etatVibrations()];
  let vibreImage = false;   // garde-fou du dernier pas (manetteVibre), lu par l'image qui suit
  // Envoie les quatre intensités à la manette du joueur P (pad ou pad2). Un arrêt (tout à zéro) part aussitôt et une
  // seule fois ; une intensité attend la fin de l'intervalle. « trigger-rumble » quand la manette l'annonce (moteurs
  // dans les gâchettes) porte aussi les deux moteurs du corps : deux effets joués coup sur coup s'interrompraient.
  function secouerManette(faible, fort, P = pad, gauche = 0, droite = 0, maintenant = performance.now()) {
    const J = P === pad2 ? vibrations[1] : vibrations[0], p = P.manette, a = p && p.vibrationActuator;
    if (!a || typeof a.playEffect !== 'function') { J.arret = true; return; }
    faible = clamp(faible || 0, 0, 1); fort = clamp(fort || 0, 0, 1); gauche = clamp(gauche || 0, 0, 1); droite = clamp(droite || 0, 0, 1);
    const arret = !faible && !fort && !gauche && !droite;
    if (arret ? J.arret : maintenant - J.instant < VIB_INTERVALLE) return;
    J.arret = arret; J.instant = maintenant;
    try {
      const avecGachettes = !!a.effects && typeof a.effects.includes === 'function' && a.effects.includes('trigger-rumble');
      const o = avecGachettes ? J.gachettes : J.double;
      o.weakMagnitude = faible; o.strongMagnitude = fort;
      if (avecGachettes) { o.leftTrigger = gauche; o.rightTrigger = droite; }
      const effet = a.playEffect(avecGachettes ? 'trigger-rumble' : 'dual-rumble', o);
      if (effet && typeof effet.catch === 'function') effet.catch(sansSuite);
    } catch (e) { /* manette sans vibration */ }
  }
  // Événements d'un pas qui touchent la voiture id, gardés pour l'image : la réception d'un saut devient l'atterrissage
  // du module. Le tableau est vidé à chaque image rendue ; la borne ne sert qu'aux pas sans image (outils).
  function retenirVibrations(J, ev, id) {
    const liste = J.evenements;
    for (let i = 0; i < ev.length && liste.length < VIB_EVENEMENTS; i++) {
      const e = ev[i], type = e.type;
      if (type === 'contact' ? e.a !== id && e.b !== id : e.id !== id) continue;
      if (type === 'choc' || type === 'contact' || type === 'roue' || type === 'casse' || type === 'rapport') liste.push(e);
      else if (type === 'reception') liste.push(VIB_ATTERRISSAGE);
    }
  }
  // Voiture replacée en piste : ni événement de l'image ni pic d'un choc antérieur ne la suivent.
  function calmerVibrations(n) { vibrations[n].evenements.length = 0; vibrations[n].V = B.vibrations.creer(); }
  // Une fois par image rendue qui fait tourner la séance : dt est la durée réelle de l'image, t son horodatage.
  function majVibrations(S, dt, t) {
    const co = S.course, PR = B.conduite.PARAMS, pousseeMax = PR.turboAcc[PR.turboAcc.length - 1] || 1;
    for (let n = 0; n < 2; n++) {
      const J = vibrations[n], P = n ? pad2 : pad;
      const v = !vibreImage || !P.manette ? null : n === 0 ? co.joueur : S.type === 'duo' ? co.voitures[S.locaux[1]] : null;
      if (!v) { J.evenements.length = 0; secouerManette(0, 0, P); continue; }
      const et = v.etat, e = J.entree;
      e.regime = et.regime; e.ralenti = PR.ralenti; e.maxUtile = PR.maxUtile; e.gaz = et.gaz; e.frein = et.frein; e.v = et.v;
      e.surface = et.surface; e.vibreur = et.vibreur; e.patinage = et.patinage; e.blocage = et.blocage;
      e.glisseAr = et.glisseAr; e.glisseAv = et.glisseAv; e.derive = et.derive;
      e.turbo = et.turbo && et.turbo.reste > 0 ? clamp(et.turbo.poussee / pousseeMax, 0, 1) : 0;
      e.force = clamp(reglages.vibrationForce != null ? +reglages.vibrationForce : .5, 0, 1);
      e.evenements = J.evenements;
      const s = B.vibrations.calculer(J.V, e, dt);
      J.evenements.length = 0;
      if (t - J.instant >= VIB_INTERVALLE) secouerManette(s.faible, s.fort, P, s.gachetteG, s.gachetteD, t);
    }
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
    if (deux && !pluieVue2) pluieVue2 = B.meteo.creerPluie($('meteo2'));
    if (!deux && !pluieVue) pluieVue = B.meteo.creerPluie($('meteo'));
    // sous la voûte du tunnel, il ne pleut pas : la caméra décide, sinon les gouttes disparaissent pendant que la
    // vue extérieure montre encore la pluie
    const abri = !VUES_DEHORS.has(vue) && sousLaVoute(S.course.c, cam.pos), neige = precipitationsNeige(S);
    (deux ? pluieVue2 : pluieVue).dessiner(abri || neige > 0 ? Object.assign(METEO_ABRI, { t: S.meteo.t }) : S.meteo, cam, dt, { cockpit: vue === 'cockpit', dpr: window.devicePixelRatio || 1 });
    if (B.vitre) {
      if (deux && !vitreVue2) vitreVue2 = B.vitre.creer($('vitre2'));
      if (!deux && !vitreVue) vitreVue = B.vitre.creer($('vitre'));
      const contexte = S.vitreContexte || (S.vitreContexte = {});
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
      if (e.id === S.course.joueur.id) { calmerVibrations(0); S.avertiContresens = false; }
      if (S.locaux && S.type === 'duo' && e.id === S.locaux[1]) calmerVibrations(1);
    }
  }

  // La manette ne vibre que sur l'écran de course, quand un joueur tient le volant (David, 18/11 : « je ne veux pas
  // de vibration dans la manette pendant les menus »). La vitrine des menus et la démo font rouler la voiture « du
  // joueur » à l'ordinateur : sans ce garde-fou, son moteur grondait dans les mains devant l'écran titre.
  function manetteVibre(auto) { return !auto && reglages.vibrations === 'oui' && ecran === 'course'; }

  function pasSimulation(S, pilote) {
    if (B.meteo) B.meteo.actuel = S.meteo;
    const co = S.course;
    const auto = S.type === 'vitrine' || S.type === 'demo' || pilote || pilotageAuto;
    let cmd;
    if (S.type === 'duo') { const [a, b] = S.locaux; cmd = []; cmd[a] = auto ? B.course.commandesIA(co, co.voitures[a]) : commandesJoueur(); cmd[b] = auto ? B.course.commandesIA(co, co.voitures[b]) : commandesJoueur2(); }
    else cmd = auto ? B.course.commandesIA(co, co.joueur) : commandesJoueur();
    const ev = B.course.pas(co, cmd, DT);
    // vibration manette : le pilote la sent passer dans ses mains — le moteur selon les tours, la route, les
    // vibreurs, l'herbe, le patinage, la glisse et les chocs ; la main reste calme si le réglage est à « non ».
    // Les événements du pas sont retenus pour l'image (majVibrations), à deux pour chaque joueur et sa voiture.
    const vibre = manetteVibre(auto);
    vibreImage = vibre;
    if (vibre) {
      retenirVibrations(vibrations[0], ev, co.joueur.id);
      if (S.type === 'duo') retenirVibrations(vibrations[1], ev, S.locaux[1]);
    }
    for (const v of co.voitures) {
      v.roule = (v.roule || 0) + v.etat.v * DT; // distance roulée : fait tourner les roues
      // changement de rapport : la main droite du pilote va au levier (vue cockpit). cockpit-6 : au premier pas,
      // on initialise seule la référence, sans trajet ; cockpit-2 : un rapport qui arrive pendant l'animation
      // précédente (0,36 s) est consommé sans reprise — le trajet en cours vise déjà le rapport courant, et
      // tPassage ne repart pas à zéro (sinon la main se téléporte du pommeau à la jante)
      if (v.etat.rapport !== v.rapportVu) {
        if (v.rapportVu !== undefined && (v.tPassage === undefined || co.horloge - v.tPassage >= .36)) { v.rapportAvant = v.rapportVu; v.tPassage = co.horloge; }
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
      differerStock(CLE_RECORDS, records);   // finTour tourne dans le pas de simulation : l'écriture attend la file
      if (ancien) texte += ' · record du circuit';
    }
    if (e.valide === false) texte += ' · hors classement chrono';
    const qui = co.duo ? 0 : undefined;
    sousMessage(texte, qui);
    if (co.mode === 'chrono') {
      // le fantôme gardé est celui du meilleur tour jamais fait ici ; seuls son temps et sa longueur comptent pour
      // décider, lus une fois par circuit. Le tour retenu est une copie que la course ne touche plus (course.js) :
      // il n'est encodé en base64 qu'à la vidange de la file.
      const f = co.fantome;
      let garde = fantomesGardes.get(id);
      if (garde === undefined) { const g = lireStock(CLE_FANTOME + id, null); garde = g && { temps: g.temps, longueur: g.longueur }; fantomesGardes.set(id, garde); }
      if (!S.essai && e.valide !== false && f.meilleur && f.temps === e.temps && (!garde || garde.longueur !== co.c.longueur || e.temps < garde.temps)) {
        const m = f.meilleur, temps = f.temps, longueur = co.c.longueur;
        fantomesGardes.set(id, { temps, longueur });
        differerStock(CLE_FANTOME + id, () => ({ temps, n: m.n, longueur, b64: enBase64(m.donnees) }));
      }
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
  function lancerEnLigne(cfg) {
    reglages.circuit = cfg.i;
    $('chargement').classList.remove('fini');
    const R = EL.R;
    setTimeout(() => {
      $('chargement').classList.add('fini');
      if (EL.R !== R || !R || R.etat !== 'connecte') return;
      lancer('course', cfg.i, cfg); aller('course');
    }, 30);
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
    const cote = plan.cote || 1, age = S.tRendu - plan.debut;   // temps rendu : la grue et l'orbite glissent sans sauts
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
  // En qualité Auto, quand les images ralentissent (pendant 3 s, une image en moyenne au-delà de 1,2 fois la période
  // visée, celle de l'écran multipliée par le diviseur de la cadence), le jeu retire un effet coûteux après l'autre :
  // image réelle des rétroviseurs, ombres, halo et reflets, puis il baisse la résolution (palier 4). Il remonte d'un
  // palier après 8 s d'un travail du fil principal sous la moitié de la période. Le gouverneur de résolution du moteur
  // ne joue plus (adaptive: false) : il changeait la taille de l'image en pleine conduite. Les qualités Légère,
  // Moyenne et Fine restent fixes.
  const palier = { n: 0, somme: 0, compte: 0, t: 0, aise: 0 };
  const PALIERS = 4;
  // Palier appris par machine : la qualité Auto repart au démarrage du palier où elle s'était posée, au lieu de
  // repayer à chaque lancement les secondes lentes qui l'y avaient menée. La clé suit l'empreinte de la détection
  // graphique (processeur graphique, taille de fenêtre, densité de pixels) : une autre machine ou un autre écran
  // repart de zéro.
  const CLE_PALIER = 'bitume.palier.v1';
  function retenirPalier() { ecrireStock(CLE_PALIER, { empreinte: empreinteDetection(), n: palier.n }); }
  function restaurerPalier() {
    if (reglages.qualite !== 'auto') return false;
    const m = lireStock(CLE_PALIER, null);
    if (!m || m.empreinte !== empreinteDetection() || !Number.isInteger(m.n)) return false;
    palier.n = Math.max(gpuModeste ? 1 : 0, Math.min(PALIERS, m.n));
    palier.somme = palier.compte = palier.t = palier.aise = 0;
    return true;
  }
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
  // suivante ; ombres, halo, reflets, glaces et cadence du second joueur s'appliquent à l'image, sans redémarrer la
  // course. La résolution attend un arrêt (voir appliquerPalierEnCourse).
  function majProfils(S) {
    return B.graphismes.stabiliser(etatProfils, S && S.banc ? S.banc.qualite : reglages.qualite,
      palier.n, horlogeProfils());
  }
  // Le gouverneur ne juge que les séances où un joueur (ou la démo) roule, en qualité Auto, hors banc et référence.
  function gouverneurActif(S) {
    return reglages.qualite === 'auto' && !S.banc && !S.reference && !document.hidden &&
      (S.type === 'course' || S.type === 'chrono' || S.type === 'demo' || S.type === 'duo');
  }
  const optionsPalier = { actif: false, min: 0, max: PALIERS, periode: undefined, travail: undefined };
  // dt : intervalle de l'image sur la grille de l'écran (s). f : image de la cadence ; avec elle, les seuils suivent
  // la période visée et la remontée juge le travail du fil principal. Sans elle (outils, contrôles), la règle à 60 Hz.
  function majPalier(S, dt, f) {
    const o = optionsPalier;
    o.actif = gouverneurActif(S); o.min = gpuModeste ? 1 : 0; o.max = PALIERS;
    o.periode = f ? f.periode * f.diviseur : undefined; o.travail = f ? f.travail : undefined;
    const change = B.qualite.avancer(palier, dt, o);
    majProfils(S);
    if (change) { if (o.actif) retenirPalier(); appliquerPalierEnCourse(S); }
  }
  // Résolution réellement donnée au moteur. En changer réalloue ses cibles : un accroc, puis une image plus floue ou
  // plus nette d'un coup. En pleine conduite, le changement attend donc un arrêt — grille et feux, pause, résultats,
  // séance suivante (resolutionDifferee, appliquée par la boucle) ; les autres effets du palier suivent à l'image.
  let resolutionMoteur = null, resolutionDifferee = false;
  function appliquerPalier() {
    if (!rendu) return;
    resolutionMoteur = profilDe(session).rendu.resolution; resolutionDifferee = false;
    rendu.resize(resolutionMoteur);
  }
  function conduiteEnCours(S) {
    return !!S && (ecran === 'course' || ecran === 'demo') && !!S.course && S.course.phase !== 'grille' &&
      S.course.phase !== 'feux' && !S.course.termine;
  }
  function appliquerPalierEnCourse(S) {
    if (rendu && conduiteEnCours(S) && profilDe(session).rendu.resolution !== resolutionMoteur) { resolutionDifferee = true; return; }
    appliquerPalier();
  }
  // À chaque image rendue : une résolution mise en attente passe dès que plus personne ne conduit.
  function appliquerResolutionDifferee(S) { if (resolutionDifferee && !conduiteEnCours(S)) appliquerPalier(); }
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
    if (!tunnel.axe || tunnel.axe.length < n * 2) tunnel.axe = new Float64Array(n * 2);
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
  // porteur/clé isolent l'état temporel de chaque caméra : la vue de J1, celle de J2 et chaque glace ont leur propre
  // lissage. Le tableau rendu est celui de l'état : le moteur le lit pendant le draw, rien n'est alloué par image.
  function lampesTunnel(porteur, cle, LT, cam, dtImage, rev) {
    if (!LT || !LT.length) return null;
    let et = porteur[cle];
    if (!et || et.rev !== rev || et.n !== LT.length) et = porteur[cle] = nouvelEtatLampes(rev, LT.length);
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
  // la direction qu'elle renvoie à l'œil (glace légèrement bombée : 34° de champ), les deux glaces en alternance au
  // rythme du profil, compté en temps (30 Hz chacune en Fine, quelle que soit la fréquence de l'écran).
  // L'image est copiée dans la toile de la glace, retournée comme dans un miroir et posée sur les quatre coins
  // projetés de la glace par une transformation projective (matrix3d). Ce rendu a ses propres copies des nappes et
  // des lots : le moteur range ses tampons dans les lots. Réglage « Image des rétroviseurs » : image simple (fond
  // dessiné dans la glace) en qualité basse et, par défaut, sur écran tactile.
  const retro = { rendu: null, scene: -1, cote: 0, echec: false, objets: [], toiles: null, ctx: [], l: 0, h: 0 };
  // État des glaces de chaque joueur (J1, J2), créé ici une fois : cadence au temps (dette, secondes écoulées depuis
  // la dernière image de chaque glace), coins des glaces (voiture.js, glacesCockpit, sortie réécrite) et pose CSS de
  // chaque toile, calculée à chaque image et écrite en fin d'image seulement si elle a changé (poserGlaces).
  const nouvelleGlace = () => ({ k: 0, coins: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], centre: [0, 0, 0], normale: [0, 0, 0], droite: [0, 0, 0] });
  const nouvellePoseCss = () => ({ v: new Float64Array(16), w: new Float64Array(16), ok: false, chaine: '', ecrite: null, visible: null });
  const ETATS_GLACES = [0, 1].map(() => ({ vu: false, seance: null, dette: 0, ecoule: [0, 0], glaces: [nouvelleGlace(), nouvelleGlace()],
    poses: [nouvellePoseCss(), nouvellePoseCss()], toiles: null, aPoser: false }));
  // Caméra des glaces et objets de sa liste, réutilisés d'une glace à l'autre (le moteur relit tout à chaque draw)
  const CAM_GLACE = { pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, fov: 34, near: .3, far: 6000, allStatic: true, sun: { center: [0, 0, 0], extent: 0, depth: 0 } };
  const POSE_GLACES = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0 }, OPTIONS_RETRO = { roues: undefined, casse: false };
  const OPTIONS_GLACE = [], AXE_GLACE = [0, 0, 0], AXE_VUE = [0, 0, 0], COINS_ECRAN = new Float64Array(8);
  // caméra principale pour projeter les coins des glaces (axes comme le moteur, cameraAxes), réécrite à chaque image
  const PROJ = { x: 0, y: 0, z: 0, dr0: 0, dr1: 0, dr2: 0, up0: 0, up1: 0, up2: 0, av0: 0, av1: 0, av2: 0, L: 1, H: 1, t: 1, asp: 1 };
  // coin p d'une glace projeté à l'écran, rangé en Q[2j], Q[2j + 1] ; faux s'il est derrière la caméra
  function projeterCoin(p, j, Q) {
    const C = PROJ, q0 = p[0] - C.x, q1 = p[1] - C.y, q2 = p[2] - C.z, z = q0 * C.av0 + q1 * C.av1 + q2 * C.av2;
    if (z < .05) return false;
    Q[2 * j] = ((q0 * C.dr0 + q1 * C.dr1 + q2 * C.dr2) / (z * C.t * C.asp) + 1) / 2 * C.L;
    Q[2 * j + 1] = (1 - (q0 * C.up0 + q1 * C.up1 + q2 * C.up2) / (z * C.t)) / 2 * C.H;
    return true;
  }
  // Ce qui est derrière la glace au-delà de la taille de l'objet et d'un mètre n'y paraîtrait pas. Les aurores
  // (rubans lointains) et les objets sans position restent.
  function devantGlace(o, axe, ox, oy, oz) {
    if (o.overlay) return false;
    const p = o.p, s = o.s;
    if (!p || o.aurore) return true;
    const marge = 1 + (s ? Math.max(Math.abs(s[0]) || 0, Math.abs(s[1]) || 0, Math.abs(s[2]) || 0) : 0);
    return (p[0] - ox) * axe[0] + (p[1] - oy) * axe[1] + (p[2] - oz) * axe[2] >= -marge;
  }
  // niveaux de détail du plus lourd au plus léger : le plus léger des deux
  const RANG_DETAIL = { complet: 2, moyen: 1, simple: 0 };
  const plusLeger = (a, b) => RANG_DETAIL[a] <= RANG_DETAIL[b] ? a : b;
  // Chrome ne confie au processeur graphique qu'une toile 2D d'au moins 256 × 257 pixels : en deçà, chaque copie de
  // l'image WebGL vers la toile d'une glace repasse par le processeur central. La toile du moteur des glaces (et donc
  // celles des glaces, de même taille) garde au moins 66 000 pixels quelle que soit la densité de l'écran.
  const PIXELS_GLACE = 66000;
  function ratioGlaces(l, h, dpr) {
    let r = Math.min(dpr || 1, 1.5);
    if (!(l > 0 && h > 0) || Math.round(l * r) * Math.round(h * r) >= PIXELS_GLACE) return r;
    r = Math.max(r, Math.sqrt(PIXELS_GLACE / (l * h)));
    while (Math.round(l * r) * Math.round(h * r) < PIXELS_GLACE && r < 2) r += .005;
    return Math.min(r, 2);
  }
  // Lots du décor pour le moteur des glaces : copies sans les tampons du moteur principal (chaque moteur range les
  // siens dans le lot) et sans les tapis d'herbe rase (lot.tapis, vegetation.js). Préparée pour la création du moteur
  // des glaces au chargement (lot « chargement ») : la course copie encore tous les lots (majGlaces), retirer l'herbe
  // des glaces est un changement d'image à vérifier par captures avant de la brancher.
  function lotsGlaces(decor) {
    const lots = [];
    for (const l of decor.lots) if (!l.tapis) lots.push(Object.assign({}, l, { tampon: null, tamponLoin: null, paquet: null, paquetLoin: null }));
    return lots;
  }
  // Axe du regard (vecteur unité) d'une caméra, comme le moteur (cameraAxes)
  function axeCamera(cam, axe) {
    const cp = Math.cos(cam.pitch || 0);
    axe[0] = Math.sin(cam.yaw) * cp; axe[1] = Math.sin(cam.pitch || 0); axe[2] = -Math.cos(cam.yaw) * cp;
    return axe;
  }
  function retroVoulu(S, vue) {
    const r = reglages.retro === 'auto' ? (estTactile ? 'non' : 'oui') : reglages.retro;
    // Le profil décide : image des glaces refusée d'office au palier bas et aux paliers Auto les plus serrés.
    return r === 'oui' && vue === 'cockpit' && S.type !== 'vitrine' && !retro.echec && !cameraEssai && profilDe(S).effets.retroImages;
  }
  // Homographie du carré unité vers le quadrilatère Q (images de (0,0), (1,0), (1,1), (0,1), rangées x0, y0, … x3, y3),
  // pour une toile de l × h pixels CSS : v reçoit les seize valeurs de la matrix3d CSS. Faux si elle n'existe pas
  // (coins alignés, valeur non finie). Sans tableau ni chaîne : la chaîne n'est refaite que si une valeur change.
  function homographie(Q, l, h, v) {
    const x0 = Q[0], y0 = Q[1], x1 = Q[2], y1 = Q[3], x2 = Q[4], y2 = Q[5], x3 = Q[6], y3 = Q[7];
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    const det = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(det) < 1e-9) return false;
    const g = (sx * dy2 - dx2 * sy) / det, k = (dx1 * sy - sx * dy1) / det;
    const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
    v[0] = a / l; v[1] = d / l; v[2] = 0; v[3] = g / l; v[4] = b / h; v[5] = e / h; v[6] = 0; v[7] = k / h;
    v[8] = 0; v[9] = 0; v[10] = 1; v[11] = 0; v[12] = x0; v[13] = y0; v[14] = 0; v[15] = 1;
    for (let i = 0; i < 16; i++) if (!Number.isFinite(v[i])) return false;
    return true;
  }
  // chaîne CSS de la matrice (six décimales)
  function chaineMatrice(v) {
    let c = 'matrix3d(';
    for (let i = 0; i < 16; i++) c += (i ? ',' : '') + (+v[i].toFixed(6));
    return c + ')';
  }
  // Écrit en fin d'image (après tous les rendus de l'image) les poses des toiles qui ont changé : une écriture de
  // style avant un draw forçait un recalcul de style au draw suivant (le moteur lit la taille de sa toile).
  function poserGlaces() {
    for (const J of ETATS_GLACES) {
      if (!J.aPoser) continue;
      J.aPoser = false;
      for (let i = 0; i < 2; i++) {
        const t = J.toiles[i], P = J.poses[i];
        if (P.visible !== P.ok) { t.style.visibility = P.ok ? '' : 'hidden'; P.visible = P.ok; }
        if (P.ok && P.ecrite !== P.chaine) { t.style.transform = P.chaine; P.ecrite = P.chaine; }
      }
    }
  }
  function majGlaces(S, vue, cam, ps, sortie, ambiance, suivie, dtImage) {
    // à deux, le joueur 2 a ses deux glaces, posées sur sa moitié
    const G = S !== session ? (retro.j2 || (retro.j2 = { toiles: [$('glace-g2'), $('glace-d2')], ctx: [], cote: 0 }))
      : (retro.j1 || (retro.j1 = { toiles: [$('glace-g'), $('glace-d')], ctx: [], cote: 0 }));
    const toiles = G.toiles, J = ETATS_GLACES[S !== session ? 1 : 0];
    const voir = retroVoulu(S, vue);
    for (const t of toiles) if (t.hidden === voir) t.hidden = !voir;
    // nouvelle séance (course, référence) : les glaces repartent comme à leur premier affichage
    if (!voir || J.seance !== session) { J.vu = false; J.seance = session; }
    if (!voir) return;
    const source = $('retro-rendu');
    if (!retro.rendu) {
      try { retro.rendu = window.FRender.create(source, { msaa: 0, shadowMapScale: 1, reflections: false, sea: false, overlayLighting: 'world' }); retro.rendu.resize(Math.min(window.devicePixelRatio || 1, 1.5)); }
      catch (e) { console.warn('BITUME : image des rétroviseurs indisponible', e); retro.echec = true; for (const t of toiles) t.hidden = true; return; }
    }
    if (!G.ctx.length) toiles.forEach((t, i) => { t.width = source.width; t.height = source.height; t.style.width = source.clientWidth + 'px'; t.style.height = source.clientHeight + 'px'; G.ctx[i] = t.getContext('2d'); });
    if (retro.scene !== scene) {
      const d = scene.decor;
      retro.rendu.setWorld([], [], d.atmosphere);
      retro.rendu.setNappes(d.nappes.map(n => Object.assign({}, n)));
      retro.rendu.setLots(d.lots.map(l => Object.assign({}, l, { tampon: null, tamponLoin: null, paquet: null, paquetLoin: null })));
      retro.scene = scene;
    }
    // Toile du moteur des glaces : au moins PIXELS_GLACE pixels (voir ratioGlaces). Sa taille CSS est fixe (style.css,
    // .retro-rendu) : relue seulement quand la densité de l'écran change.
    const dpr = window.devicePixelRatio || 1;
    if (retro.dpr !== dpr) {
      retro.dpr = dpr; retro.l = source.clientWidth; retro.h = source.clientHeight;
      const r = ratioGlaces(retro.l, retro.h, dpr);
      if (retro.rendu.stats.pixelRatio !== r) retro.rendu.resize(r);
    }
    const l = retro.l, h = retro.h;
    // Coins des glaces projetés à l'écran à chaque image, quelle que soit la cadence : la glace suit son boîtier même
    // les images où elle n'est pas repeinte. Axes de la caméra principale comme le moteur (cameraAxes).
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cr = Math.cos(cam.roll || 0), sr = Math.sin(cam.roll || 0);
    const r00 = cy, r01 = 0, r02 = sy, u00 = -sy * sp, u01 = cp, u02 = cy * sp, C = PROJ;
    C.dr0 = r00 * cr + u00 * sr; C.dr1 = r01 * cr + u01 * sr; C.dr2 = r02 * cr + u02 * sr;
    C.up0 = u00 * cr - r00 * sr; C.up1 = u01 * cr - r01 * sr; C.up2 = u02 * cr - r02 * sr; C.av0 = sy * cp; C.av1 = sp; C.av2 = -cy * cp;
    C.L = canvas.clientWidth; C.H = canvas.clientHeight; C.t = Math.tan(cam.fov * Math.PI / 360); C.asp = C.L / Math.max(1, C.H);
    C.x = cam.pos[0]; C.y = cam.pos[1]; C.z = cam.pos[2];
    const Q = COINS_ECRAN;
    const ev = POSE_GLACES;
    ev.p[0] = ps.x; ev.p[1] = ps.y; ev.p[2] = ps.z; ev.cap = ps.cap; ev.tangage = ps.tangage; ev.roulis = ps.roulis;
    const glaces = B.voiture.glacesCockpit(ev, J.glaces);
    J.toiles = toiles;
    for (let i = 0; i < 2; i++) {
      // image retournée : son coin haut gauche va au coin haut droit de la glace
      const g = glaces[i], PC = J.poses[i], v = PC.v;
      const ok = projeterCoin(g.coins[1], 0, Q) && projeterCoin(g.coins[0], 1, Q) && projeterCoin(g.coins[3], 2, Q) && projeterCoin(g.coins[2], 3, Q) && homographie(Q, l, h, v);
      if (changee(v, PC) || (ok && PC.chaine === '')) PC.chaine = ok ? chaineMatrice(v) : '';
      PC.ok = ok;
    }
    J.aPoser = true;
    // Cadence au temps (src/graphismes.js, hz par glace) : une glace toutes les 1/(2 hz) s, les côtés en alternance,
    // deux au plus par image ; le même coût par seconde à 30, 60, 120 ou 144 Hz. À l'image la plus proche de
    // l'échéance (demi-image de tolérance) ; une dette bornée à deux glaces : après un accroc, les deux glaces sont
    // repeintes, sans rafale de rattrapage. La première image où les glaces se montrent, les deux sont peintes.
    const P = profilDe(S), hz = P.secondaires.retroviseurs.hz;
    if (!(hz > 0)) return;
    const intervalle = 1 / (2 * hz), dt = Math.max(0, dtImage || 0);
    if (!J.vu) { J.vu = true; J.dette = 2 * intervalle; J.ecoule[0] = J.ecoule[1] = 0; }
    else J.dette = Math.min(J.dette + dt, 2 * intervalle);
    J.ecoule[0] += dt; J.ecoule[1] += dt;
    for (let n = 0; n < 2 && J.dette >= intervalle - dt / 2; n++) {
      J.dette -= intervalle;
      const i = G.cote; G.cote = 1 - G.cote;
      const dtGlace = J.ecoule[i]; J.ecoule[i] = 0;
      peindreGlace(S, G, i, glaces[i], cam, ps, sortie, ambiance, suivie, P, source, l, h, dtGlace);
    }
  }
  // quelque valeur de la matrice a-t-elle changé depuis la dernière chaîne ? (mémorise les valeurs)
  function changee(v, P) {
    const w = P.w;
    let diff = false;
    for (let i = 0; i < 16; i++) if (w[i] !== v[i]) { w[i] = v[i]; diff = true; }
    return diff;
  }
  // Une glace : la caméra est à la glace et regarde dans la direction réfléchie du regard.
  function peindreGlace(S, G, i, g, cam, ps, sortie, ambiance, suivie, P, source, l, h, dtGlace) {
    const toiles = G.toiles;
    // Comme un vrai rétroviseur réglé par le pilote, le regard est ouvert de 9° vers l'extérieur et passe un peu
    // au-dessus de la caisse : la roue arrière et le ponton n'occupent que le bord intérieur de la glace.
    const d00 = g.centre[0] - cam.pos[0], d01 = g.centre[1] - cam.pos[1], d02 = g.centre[2] - cam.pos[2], dn = Math.hypot(d00, d01, d02) || 1;
    const dv0 = d00 / dn, dv1 = d01 / dn, dv2 = d02 / dn, n = g.normale;
    const pn = dv0 * n[0] + dv1 * n[1] + dv2 * n[2], rf0 = dv0 - 2 * pn * n[0], rf1 = dv1 - 2 * pn * n[1], rf2 = dv2 - 2 * pn * n[2];
    const ouvre = g.k * .16, co = Math.cos(ouvre), so = Math.sin(ouvre), rx = rf0 * co - rf2 * so, rz = rf0 * so + rf2 * co;
    const camR = CAM_GLACE;
    camR.pos[0] = g.centre[0]; camR.pos[1] = g.centre[1] + .1; camR.pos[2] = g.centre[2];
    camR.yaw = Math.atan2(rx, -rz); camR.pitch = Math.asin(clamp(rf1, -1, 1)) + .06; camR.roll = ps.roulis * .85;
    camR.fov = 2 * Math.atan(Math.tan(16 * Math.PI / 180) * h / l) * 180 / Math.PI; camR.near = .3; camR.far = PORTEE_VUE;
    const sun = camR.sun;
    sun.center[0] = ps.x; sun.center[1] = ps.y; sun.center[2] = ps.z; sun.extent = scene.ombre.extent; sun.depth = scene.ombre.depth;
    const objets = listeGlace(S, camR, sortie, suivie, source.height);
    if (S.nature && (retro.ambianceSource !== S.nature.ambiance || retro.ambianceRevision !== S.nature.ambiance.revision)) {
      if (retro.rendu.setEnvironment) retro.rendu.setEnvironment(S.nature.ambiance.atmosphere);
      retro.ambianceSource = S.nature.ambiance; retro.ambianceRevision = S.nature.ambiance.revision;
    }
    retro.rendu.draw(camR, objets, { time: horlogeReelle, shadows: false, bloom: false, torch: false, sunOnly: true, adaptive: false, frameMs: dureeImage, damage: 0, flash: 0, photo: 0, weather: ambiance, windSources: S.sillage && S.sillage.sources, windStrength: P.windStrength, groundCover: P.groundCover, lights: lampesTunnel(G, i ? 'lampes1' : 'lampes0', scene.decor.tunnelLampes, camR, dtGlace, scene.index) });
    if (B.mesures.actif) B.mesures.vue('retro', retro.rendu);
    const ctx = G.ctx[i];
    if (toiles[i].width !== source.width || toiles[i].height !== source.height) { toiles[i].width = source.width; toiles[i].height = source.height; }
    ctx.drawImage(source, 0, 0);
  }
  // Liste propre à une glace (avant : tous les objets de la vue). Décor vivant (faune, effets de saison, aurores),
  // fantôme et feux : ce qui n'est pas derrière la glace (devantGlace). Voitures : reposées au niveau de détail de
  // leur taille dans la toile de la glace, jamais plus lourd que la règle de la vue (plafond, avant le passage au
  // modèle moyen derrière la caméra), aucune à plus de 8 m derrière la glace ; la voiture suivie n'y montre que sa
  // roue arrière (voiture.js, poserRetro). Effets : leur propre appel, au même instant que la vue, sans coupure à
  // distance. Même ordre qu'avant : décor, voitures, fantôme et feux, effets, roue arrière. Les objets de la vue sont
  // réécrits : elle est déjà dessinée.
  function listeGlace(S, camR, sortie, suivie, hauteur) {
    const objets = retro.objets; objets.length = 0;
    const axe = axeCamera(camR, AXE_GLACE), ox = camR.pos[0], oy = camR.pos[1], oz = camR.pos[2];
    for (let k = 0, n = S.iVoitures0; k < n; k++) if (devantGlace(sortie[k], axe, ox, oy, oz)) objets.push(sortie[k]);
    const co = S.course, poses = tampons.poses, tanDemi = Math.tan(clamp(camR.fov, 10, 110) * Math.PI / 360);
    for (let k = 0; k < co.voitures.length; k++) {
      if (k === suivie.id) continue;
      const p = poses[k], ex = p.x - ox, ez = p.z - oz;
      if (ex * axe[0] + (p.y - oy) * axe[1] + ez * axe[2] < -DERRIERE_CAMERA) continue;
      const o = optionsGlace(k), v = co.voitures[k];
      o.detail = plusLeger(OPTIONS_POSE[k].plafond, detailVoiture(ex * ex + ez * ez, tanDemi, hauteur));
      o.roues = v.degats && v.degats.roues; o.casse = !!(v.degats && v.degats.casse);
      B.voiture.poser(S.modeles[k], POSES_RENDU[k], objets, o);
    }
    for (let k = S.iVoitures1, n = S.iEffets0; k < n; k++) if (devantGlace(sortie[k], axe, ox, oy, oz)) objets.push(sortie[k]);
    B.traces.dessiner(S.fx, objets, camR.pos, S.hEffets, axe, 0);
    const R = OPTIONS_RETRO;
    R.roues = suivie.degats && suivie.degats.roues; R.casse = !!(suivie.etat.degats && suivie.etat.degats.casse);
    B.voiture.poserRetro(S.modeles[suivie.id], POSES_RENDU[suivie.id], objets, R);
    return objets;
  }
  function optionsGlace(k) { return OPTIONS_GLACE[k] || (OPTIONS_GLACE[k] = nouvellesOptions()); }

  // ---------------------------------------------------------------- rendu d'une image
  const MATRICE_LAMPE = cap => {
    const e = B.voiture.euler, A = e(0, -cap, 0), Bm = e(0, 0, -Math.PI / 2);
    const m = [B.voiture.mul(A, Bm[0]), B.voiture.mul(A, Bm[1]), B.voiture.mul(A, Bm[2])];
    return B.voiture.angles(m);
  };
  const tampons = { poses: [], mel: {} };
  let horlogeReelle = 0, dureeImage = 16;

  // Objets passés à voiture.js et au moteur, réécrits à chaque image au lieu d'être recréés (ramasse-miettes) :
  // voiture.js lit la pose et les options sans les garder, le moteur relit le soleil et les feux à chaque draw. Une
  // vue (J2, puis J1, puis leurs glaces) finit de s'en servir avant que la suivante les réécrive. Seize voitures au
  // plus (onze rivaux, quatre humains) ; au-delà, les tableaux grandissent.
  const nouvellePose = () => ({ p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, rebond: null, v: 0 });
  const nouvellesOptions = () => ({ detail: 'complet', roues: undefined, casse: false, plafond: 'complet' });
  const POSES_RENDU = Array.from({ length: 16 }, nouvellePose), OPTIONS_POSE = Array.from({ length: 16 }, nouvellesOptions);
  const POSE_FANTOME = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0 };
  const ETAT_COCKPIT = { regime: 0, volant: 0, rapport: 0, kmh: 0, roues: undefined, casse: false, passage: 1, rapportAvant: undefined,
    derriere: null, ciel: null, brume: null, glaceVive: false };
  const SUIVEURS = [], RESERVE_SUIVEURS = Array.from({ length: 16 }, () => ({ x: 0, z: 0, couleur: null })), AUCUN_SUIVEUR = Object.freeze([]);
  const SOLEILS = [{ center: [0, 0, 0], extent: 0, depth: 0 }, { center: [0, 0, 0], extent: 0, depth: 0 }];
  const LAMPES_PORTIQUE = [], FEU_ALLUME = [1, .14, .06], FEU_ETEINT = [.1, .03, .03], TAILLE_FEU = [.56, .05, .56];
  // une voiture plus loin que ces 8 m derrière le plan d'une caméra ne s'y voit que par son ombre portée vers l'avant
  const DERRIERE_CAMERA = 8;
  function poseRendu(k, p, roule, v) {
    const ev = POSES_RENDU[k] || (POSES_RENDU[k] = nouvellePose());
    ev.p[0] = p.x; ev.p[1] = p.y; ev.p[2] = p.z;
    ev.cap = p.cap; ev.tangage = p.tangage; ev.roulis = p.roulis; ev.braquage = p.braquage; ev.roule = roule; ev.rebond = p.rebond; ev.v = v;
    return ev;
  }
  function optionsPose(k) { return OPTIONS_POSE[k] || (OPTIONS_POSE[k] = nouvellesOptions()); }
  function soleilDe(i, x, y, z) {
    const s = SOLEILS[i], o = scene.ombre;
    s.center[0] = x; s.center[1] = y; s.center[2] = z; s.extent = o.extent; s.depth = o.depth;
    return s;
  }
  function lampePortique(k) {
    return LAMPES_PORTIQUE[k] || (LAMPES_PORTIQUE[k] = { shape: 'cylinder', p: null, s: TAILLE_FEU, r: null, mat: 7, color: FEU_ETEINT, emissive: 0 });
  }
  // Niveau de détail d'une voiture (voiture.js, detailPour) d'après sa taille à l'écran : jamais plus lourd que la
  // règle d'avant (complet jusqu'au seuil du champ, simple au-delà). Sous 1 080 pixels de toile (petit écran, écran
  // partagé, résolution réduite du profil), le seuil du modèle complet se rapproche au prorata ; entre les deux, le
  // modèle moyen tant que la voiture couvre une trentaine de pixels.
  function detailVoiture(d2, tanDemi, hauteur) {
    if (B.voiture.detailPour(d2, tanDemi, 0) === 'simple') return 'simple';
    return B.voiture.detailPour(d2, tanDemi, hauteur, Math.min(1, hauteur / 1080));
  }
  // Rivaux derrière la voiture k, dans son repère, du plus proche au plus lointain : la glace peinte du cockpit les
  // montre. Insertion stable : même ordre que le tri d'avant, sans tableau ni fermeture neufs.
  function suiveurs(co, poses, k, p) {
    const ca = Math.cos(p.cap), sa = Math.sin(p.cap);
    let n = 0;
    for (let q = 0; q < co.voitures.length; q++) {
      if (q === k) continue;
      const ex = poses[q].x - p.x, ez = poses[q].z - p.z, x = ex * ca + ez * sa;
      if (!(x < -1 && x > -95)) continue;
      const e = RESERVE_SUIVEURS[n] || (RESERVE_SUIVEURS[n] = { x: 0, z: 0, couleur: null });
      e.x = x; e.z = ez * ca - ex * sa; e.couleur = co.voitures[q].couleur;
      let j = n++;
      while (j > 0 && SUIVEURS[j - 1].x < x) { SUIVEURS[j] = SUIVEURS[j - 1]; j--; }
      SUIVEURS[j] = e;
    }
    SUIVEURS.length = n;
    return SUIVEURS;
  }

  function rendreImage(S, alpha, dtImage) {
    appliquerCarte();
    const co = S.course, j = co.joueur;
    const poses = tampons.poses;
    for (let k = 0; k < co.voitures.length; k++) poses[k] = melange(S.prec[k], S.cour[k], alpha, poses[k] || {});
    // Temps rendu, une fois par image : les voitures sont dessinées entre leurs deux dernières poses, à l'instant
    // horloge − pas + alpha × pas. Fantôme, caméras de la démo, secousses du casque, aurores et effets le suivent :
    // pris au dernier pas, ils avançaient par sauts de 1/120 s (à 144 Hz, une image sur six sans pas les figeait) et
    // devançaient les voitures d'un pas au plus. La vue du joueur 2 hérite des deux valeurs (Object.create).
    S.retardImage = (1 - alpha) * DT; S.tRendu = co.horloge - S.retardImage;
    if (B.sillage) B.sillage.mettreAJour(S.sillage || (S.sillage = B.sillage.creer()), co.voitures, poses, co.c);
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
    const nV = co.voitures.length, RV = S.rouleVu || (S.rouleVu = new Float64Array(nV)), RP = S.rouleVrai || (S.rouleVrai = new Float64Array(nV).fill(NaN));
    for (let k = 0; k < nV; k++) {
      const p = poses[k], d = Number.isNaN(RP[k]) ? 0 : p.roule - RP[k];
      RP[k] = p.roule; RV[k] += Math.abs(d) > .11 ? Math.sign(d) * .11 : d;
      const v = Math.abs(co.voitures[k].etat.v), a = .0035 * clamp(v / 60, 0, 1) * (co.voitures[k].etat.surface === 'herbe' ? 3 : co.voitures[k].etat.surface === 'vibreur' ? 2.2 : 1);
      const reb = p.rebond || (p.rebond = [0, 0, 0, 0]), t = horlogeReelle, s0 = p.roule * 1.7;
      for (let r = 0; r < 4; r++) reb[r] = a * (Math.sin(s0 + r * 1.9) * .6 + Math.sin(s0 * 2.3 + r * .7 + t * 3) * .4);
    }
    const meteo = majMeteo(S, dtImage);
    S.ambianceImage = B.meteo.ambiance(meteo, S.ambianceImage || {});
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
      // Cadence du second joueur (src/graphismes.js) : au palier serré (30 Hz), sa vue est rendue au temps et garde
      // entre-temps la dernière copiée ; le joueur 1 garde toute la fluidité de la sienne. Le compte d'images en
      // faisait 72 Hz sur un écran 144 Hz et 15 Hz à 30 images par seconde, et la vue ne recevait que l'intervalle
      // d'une image : caméras lissées, secousses, pluie et cadence de ses glaces tournaient à moitié. Elle reçoit
      // maintenant tout le temps écoulé depuis son rendu précédent. Toujours rendue : à la première image d'une séance,
      // et aux images arrêtées (pause, quatre par seconde, sans temps qui passe) où un réglage peut avoir changé.
      const hzJ2 = P.secondaires.partage.hz;
      S.dtJ2 = (S.dtJ2 || 0) + dtImage;
      if (hzJ2 >= 55 || !S.j2Rendue || dtImage === 0 || S.dtJ2 + dtImage / 2 >= 1 / hzJ2) {
        const dtJ2 = S.dtJ2; S.dtJ2 = 0; S.j2Rendue = true;
        rendreVue(S.vueJ2, co.voitures[S.locaux[1]], reglages.vue2, dtJ2, meteo);
        const t2 = $('scene2'), ctx2 = t2._ctx || (t2._ctx = t2.getContext('2d'));
        if (t2.width !== canvas.width || t2.height !== canvas.height) { t2.width = canvas.width; t2.height = canvas.height; }
        ctx2.drawImage(canvas, 0, 0);
      }
      const camJ1 = rendreVue(S, j, reglages.vue, dtImage, meteo);
      poserGlaces();
      return camJ1;
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
    const camVue = rendreVue(S, suivie, vue, dtImage, meteo);
    poserGlaces();
    return camVue;
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
    else cam = vue === 'cockpit' ? cameraCockpit(S, ps, suivie.etat, S.tRendu, dtImage) : cameraPoursuite(S, ps, suivie.etat, dtImage);
    if (cameraEssai) cam = Object.assign({ roll: 0, near: .1, far: PORTEE_VUE, fov: 40 }, cameraEssai(pj, cam));
    if (S.secousse > 0) {
      const a = S.secousse * .05 * reglages.secousses, t = horlogeReelle;
      cam.pitch += Math.sin(t * 61) * a * .5; cam.yaw += Math.sin(t * 47) * a * .35;
      S.secousse = Math.max(0, S.secousse - dtImage * 2.6);
    }
    // axe horizontal du regard, en deux nombres (plus de tableau neuf par image)
    const avX = Math.sin(cam.yaw), avZ = -Math.cos(cam.yaw);
    // ombres du soleil autour de ce que l'on regarde : devant le pilote (jusqu'à 176 m), ou autour de la voiture filmée.
    // Un soleil par vue, réécrit à chaque image : le moteur le relit à chaque draw sans le garder.
    cam.sun = soleilDe(S === session ? 0 : 1, exterieur ? ps.x : cam.pos[0] + avX * OMBRE_DEVANT, ps.y, exterieur ? ps.z : cam.pos[2] + avZ * OMBRE_DEVANT);
    // Le jeu ne confie aucun objet statique au moteur (setWorld([], …) partout) : allStatic lui évite d'interroger à
    // chaque draw un index spatial vide (clés de grille et tableaux temporaires). Image identique.
    cam.allStatic = true;

    // Habitats partagés ; pools propres aux deux vues. Le temps absolu garde les mêmes vols dans les miroirs.
    if (S.nature && B.faune && P.faune !== 'off' && (!S.nature.saison || S.nature.saison.faune > 0)) {
      const nature = S.nature;
      if (!nature.faune) nature.faune = B.faune.creer(c, scene.decor);
      const contexte = S.fauneVue || (S.fauneVue = { qualite: P.faune, nuit: 0, pluie: 0, pose: ps, vue: S === session ? 0 : 1 });
      contexte.qualite = P.faune; contexte.nuit = nature.ambiance.nuit; contexte.pluie = meteo.pluie || 0; contexte.pose = ps;
      contexte.activite = nature.saison ? nature.saison.faune : 1;
      B.faune.dessiner(nature.faune, horlogeReelle, contexte, sortie);
    }
    if (S.nature && B.effetsSaison && S.nature.saison && (S.nature.effetsSaison || S.nature.saison.feuilles || S.nature.saison.neige || meteo.neige)) {
      const nature = S.nature;
      if (!nature.effetsSaison) nature.effetsSaison = B.effetsSaison.creer(c, scene.decor);
      const contexte = S.saisonVue || (S.saisonVue = { qualite: 'low', nuit: 0, pluie: 0, neige: 0, ventX: 0, ventZ: 0, pose: cam.pos, vue: S === session ? 0 : 1, abri: false });
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
      if (!nature.aurores) nature.aurores = B.aurores.creer(c);
      const contexte = S.auroresVue || (S.auroresVue = { vue: S === session ? 0 : 1, qualite: 'low', nuit: 0, pluie: 0, neige: 0, nuages: 0, tunnel: false });
      contexte.qualite = P.palier; contexte.nuit = nature.ambiance.nuit;
      contexte.pluie = meteo.pluie || 0; contexte.neige = precipitationsNeige(S); contexte.nuages = meteo.nuage || 0;
      contexte.tunnel = sousLaVoute(c, cam.pos) && cam.pos[1] < ps.y + (c.tunnel ? c.tunnel.hauteur : 5) + .5;
      B.aurores.dessiner(nature.aurores, S.tRendu, contexte, sortie);
    }

    // voitures : toujours dessinées. Niveau de détail selon la taille à l'écran (detailVoiture) : la hauteur de la
    // toile suit l'écran et la résolution du profil ; le seuil suit le champ (un téléobjectif garde le modèle complet
    // bien plus loin).
    const tanDemi = Math.tan(clamp(cam.fov, 10, 110) * Math.PI / 360), hauteur = canvas.height;
    S.iVoitures0 = sortie.length;   // repères de la liste pour celle des glaces (listeGlace)
    for (let k = 0; k < co.voitures.length; k++) {
      const p = poses[k], dx = p.x - cam.pos[0], dz = p.z - cam.pos[2], d2 = dx * dx + dz * dz;
      const ev = poseRendu(k, p, RV[k], co.voitures[k].etat.v);
      if (k === suivie.id && vue === 'cockpit') {
        const et = suivie.etat, atm = S.nature ? S.nature.ambiance.atmosphere : scene.decor.atmosphere, glaceVive = !!retro.rendu && retroVoulu(S, vue);
        const etc = ETAT_COCKPIT;
        etc.regime = et.regime; etc.volant = et.volant; etc.rapport = et.rapport; etc.kmh = B.conduite.kmh(et);
        etc.roues = co.voitures[k].degats && co.voitures[k].degats.roues; etc.casse = !!(et.degats && et.degats.casse);
        etc.passage = suivie.tPassage === undefined ? 1 : (co.horloge - suivie.tPassage) / .36; etc.rapportAvant = suivie.rapportAvant;
        // les rivaux de la glace peinte ne servent que sans image réelle des glaces
        etc.derriere = glaceVive ? AUCUN_SUIVEUR : suiveurs(co, poses, k, p);
        etc.ciel = atm.skyBottom; etc.brume = atm.fog; etc.glaceVive = glaceVive;
        B.voiture.cockpit(S.modeles[k], ev, sortie, etc);
        continue;
      }
      // Derrière le plan de la caméra, une voiture ne se voit que par son ombre : modèle moyen au plus, même
      // silhouette. Les glaces la reposent à leur propre niveau, plafonné par la règle de la vue.
      const o = optionsPose(k);
      o.plafond = detailVoiture(d2, tanDemi, hauteur);
      o.detail = o.plafond === 'complet' && dx * avX + dz * avZ < -DERRIERE_CAMERA ? 'moyen' : o.plafond;
      o.roues = co.voitures[k].degats && co.voitures[k].degats.roues; o.casse = !!(co.voitures[k].degats && co.voitures[k].degats.casse);
      B.voiture.poser(S.modeles[k], ev, sortie, o);
    }
    S.iVoitures1 = sortie.length;
    // fantôme du meilleur tour
    if (co.mode === 'chrono') {
      const f = B.course.fantome(co, S.retardImage);
      if (f) {
        const e = B.circuit.echantillon(c, f.s), sa = Math.sin(e.cap), ca = Math.cos(e.cap);
        const x = e.x - sa * f.d, z = e.z + ca * f.d, dx = x - pj.x, dz = z - pj.z;
        if (dx * dx + dz * dz > 9 || vue !== 'cockpit') {
          const g = POSE_FANTOME;
          g.p[0] = x; g.p[1] = e.y - f.d * Math.sin(e.devers); g.p[2] = z; g.cap = e.cap + f.angle; g.tangage = Math.atan(e.pente); g.roulis = e.devers;
          B.voiture.fantome(g, sortie);
        }
      }
    }
    // feux du portique : objets permanents, réécrits (le moteur recopie leurs valeurs à chaque draw)
    const port = scene.decor.portique;
    if (port && co.mode === 'course') {
      if (!S.rotLampe) S.rotLampe = MATRICE_LAMPE(port.cap);
      for (let k = 0; k < port.feux.length; k++) {
        const allume = !co.feux.vert && k < co.feux.allumes, o = lampePortique(k);
        o.p = port.feux[k]; o.r = S.rotLampe; o.mat = allume ? 5 : 7; o.color = allume ? FEU_ALLUME : FEU_ETEINT; o.emissive = allume ? 3 : 0;
        sortie.push(o);
      }
    }
    // traces de pneus, fumée et étincelles ; plus de 4 m derrière le plan de la caméra, rien ne se voit (traces.js,
    // MARGE_ARRIERE) : les glaces ont leur propre appel, au même instant (S.hEffets). L'instant est celui des voitures
    // (B.traces.extrapolation) : fx.acc seul figeait les effets entre deux pas et les mettait un pas devant elles.
    S.iEffets0 = sortie.length; S.hEffets = B.traces.extrapolation(S.fx, S.retardImage);
    const tFx = (S.banc || B.mesures.actif) ? performance.now() : 0;
    B.traces.dessiner(S.fx, sortie, cam.pos, S.hEffets, axeCamera(cam, AXE_VUE), 0);
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
    // adaptive: false partout : le gouverneur du moteur baissait la taille de l'image au fil des images lentes, en
    // pleine conduite, et la vitrine des menus léguait l'échelle réduite à la course suivante. La qualité Auto
    // (paliers) et la cadence décident seules ; la résolution ne change qu'à un arrêt.
    rendu.draw(cam, sortie, { time: horlogeReelle, msaa: P.rendu.msaa === 4, shadowMapScale: P.rendu.shadowMapScale, shadows: avecOmbres(P), bloom: haloInt, brightness: S.lumiere, lights: lampes, torch: false, sunOnly: true, adaptive: false, frameMs: dureeImage, damage: eclair, flash: eclair, photo: haloInt ? 1 : 0, reflections: avecReflets(S, P, meteo), weather: S.ambianceImage, windSources: S.sillage && S.sillage.sources, windStrength: P.windStrength, groundCover: P.groundCover });
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
      const r = sonCandidats[k] || (sonCandidats[k] = {});
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

  // Classement en tour de piste : sept lignes faites une fois par affichage, dans l'ordre où elles peuvent servir (les
  // trois de tête, la coupure, le joueur et ses deux voisins ; la seule coupure possible suit la troisième ligne).
  // Une mise à jour ne réécrit que les cellules qui changent ; innerHTML recréait six lignes et vingt-quatre cellules
  // toutes les 250 ms, avec analyse HTML, style et mise en page.
  function lignesClassement(liste) {
    const lignes = [];
    for (let k = 0; k < 7; k++) {
      const li = document.createElement('li');
      if (k === 3) li.className = 'saut';
      else for (const c of ['p', 'c', 'n', 'e']) { const s = document.createElement('span'); s.className = c; li.appendChild(s); li['_' + c] = s; }
      li.hidden = true;
      liste.appendChild(li); lignes.push(li);
    }
    return lignes;
  }
  HUD1.lignes = lignesClassement(H.classement); HUD2.lignes = lignesClassement(H2.classement);
  // couleur CSS d'une voiture (pastilles du plan et du classement) : calculée une fois par voiture, plus à chaque image
  const couleursCss = new WeakMap();
  function couleurCss(v) {
    let c = couleursCss.get(v);
    if (c === undefined) { c = 'rgb(' + v.couleur.map(x => Math.round(x * 255)).join(',') + ')'; couleursCss.set(v, c); }
    return c;
  }

  const aDeux = () => !!session && session.type === 'duo';
  // à deux : qui = 0 pour l'affichage du joueur 1 seul, 1 pour celui du joueur 2, rien pour les deux
  const affichages = (cle, qui) => !aDeux() || qui === 0 ? [H[cle]] : qui === 1 ? [H2[cle]] : [H[cle], H2[cle]];
  // Messages : relancer l'animation CSS passait par une lecture de géométrie (void offsetWidth), soit un calcul forcé
  // du style et de la mise en page au milieu du pas de simulation. Le message attend maintenant le rappel d'image
  // suivant (appliquerMessages, en tête de image) et s'y relance en changeant de nom d'animation : message et
  // message-bis sont identiques (style.css), et un nom qui change relance l'animation sans rien mesurer. Une seule
  // bascule par élément et par rappel : deux bascules avant le même calcul de style s'annuleraient, d'où la file.
  const messagesEnAttente = new Map();
  function message(t, ton, court, qui) {
    const classes = 'message visible' + (ton ? ' ' + ton : '') + (court ? ' court' : '');
    for (const el of affichages('message', qui)) messagesEnAttente.set(el, [t, classes]);
  }
  function sousMessage(t, qui) {
    for (const el of affichages('sous-message', qui)) messagesEnAttente.set(el, [t, 'sous-message visible']);
  }
  function appliquerMessages() {
    if (!messagesEnAttente.size) return;
    for (const [el, [t, classes]] of messagesEnAttente) {
      el._bis = !el._bis;
      el.textContent = t; el.className = classes + (el._bis ? ' bis' : '');
    }
    messagesEnAttente.clear();
  }
  // place gagnée : même bascule de nom (eclat, eclat-bis) ; majHud ne passe qu'une fois par image et par affichage
  function eclat(el) {
    el._bis = !el._bis;
    el.classList.add('eclat'); classe(el, 'bis', el._bis);
  }

  const LIBELLES_PLAN = { tele: 'bord de piste', cockpit: 'caméra embarquée', poursuite: 'poursuite', helico: 'hélicoptère',
    roue: 'caméra de roue', aileron: 'au-dessus de l’arceau', arriere: 'caméra arrière', travelling: 'travelling', orbite: 'autour de la voiture', sol: 'au ras de la piste' };
  // Cadences de l'affichage : chrono, écart, vitesse et régime changent à chaque image mais ne se lisent pas au-delà
  // de 30 Hz ; le plan se redessine à 15 Hz, décalé des chiffres, et jamais quand il est masqué. Position, tour,
  // santé, dérive et feux restent à chaque image : ils ne s'écrivent que lorsqu'ils changent. La marge d'une
  // demi-image à 120 Hz tient le rythme quand l'intervalle tombe pile sur la période (à 60 Hz : les chiffres une
  // image sur deux, le plan une sur quatre, jamais la même).
  const PERIODE_CHIFFRES = 1 / 30 - 1 / 240, PERIODE_PLAN = 1 / 15 - 1 / 240;
  function majHud(S, x = HUD1, jForce = null) {
    // en démo, l'affichage est celui de la voiture filmée ; à deux, chaque affichage a sa voiture (x : ses éléments)
    const H = x.h, segments = x.segments, lampes = x.lampes, etiquetteDerive = x.etiquette, barre = x.barre;
    const co = S.course, demo = S.type === 'demo', j = jForce || (demo ? co.voitures[S.suivie || 0] : co.joueur), et = j.etat, chronoMode = co.mode === 'chrono';
    const nb = co.voitures.length;
    // nouvelle séance : tout s'écrit dès sa première image
    if (x.seance !== S) { x.seance = S; x.tChiffres = x.tPlan = -Infinity; }
    if (demo && S.planVu) texte($('demo-plan'), CATALOGUE[S.i].nom + ' · ' + LIBELLES_PLAN[S.planVu.vue] + ' · ' + j.nom);
    texte(H['h-pos'], chronoMode ? '–' : String(j.position)); texte(H['h-sur'], chronoMode ? '' : '/' + nb);
    if (!chronoMode && !demo && S.positionPrec && j.position < S.positionPrec && co.phase === 'course') eclat(H['c-position']);
    S.positionPrec = j.position;
    const tourAff = chronoMode ? j.tours + (co.chronoParti ? 1 : 0) : Math.min(co.toursTotal, j.tours + 1);
    texte(H['h-tour'], co.phase === 'grille' || co.phase === 'feux' || (chronoMode && !co.chronoParti) ? '–' : String(tourAff));
    texte(H['h-tours'], chronoMode ? '' : '/' + co.toursTotal);
    if (horlogeReelle >= x.tChiffres) {
      x.tChiffres = horlogeReelle + PERIODE_CHIFFRES;
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
    }

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

    // tour de classement : tête de course et voisins du joueur (rangs 0 à 2, puis du rang devant le joueur à celui
    // derrière lui), sur les lignes faites une fois ; la coupure suit la troisième ligne quand les rangs sautent
    if (!chronoMode && (!S.prochainClassement || co.horloge >= S.prochainClassement)) {
      S.prochainClassement = co.horloge + .25;
      const lignes = x.lignes, lance = co.phase === 'course' || co.phase === 'arrivee';
      let n = 0, prec = -1, saut = false;
      for (let r = 0; r < nb && n < 6; r++) {
        if (r > 2 && (r < j.position - 2 || r > j.position)) continue;
        if (prec >= 0 && r > prec + 1) saut = true;
        const v = co.voitures[co.classement[r]], li = lignes[n < 3 ? n : n + 1];
        if (li._v !== v) { li._v = v; li._c.style.background = couleurCss(v); }
        texte(li._p, String(r + 1)); texte(li._n, nomCourt(v));
        texte(li._e, v.abandon ? 'Abandon' : !lance ? '' : r === 0 ? 'Tête' : ecartTexte(v.ecart));
        classe(li, 'joueur', v === j);
        if (li.hidden) li.hidden = false;
        n++; prec = r;
      }
      for (let k = n; k < 6; k++) { const li = lignes[k < 3 ? k : k + 1]; if (!li.hidden) li.hidden = true; }
      if (lignes[3].hidden === saut) lignes[3].hidden = !saut;
    }
    H.classement.hidden = chronoMode;

    // plan du circuit : 15 Hz, rien quand il est masqué (redessiné dès qu'il revient). Le premier dessin d'une séance
    // tombe avec les chiffres, les suivants une image plus tard (à 60 Hz) ; projection ox + x × e sans tableau.
    if (reglages.carte === 'non') x.tPlan = -Infinity;
    else if (horlogeReelle >= x.tPlan) {
      x.tPlan = horlogeReelle + PERIODE_PLAN + (x.tPlan === -Infinity ? 1 / 60 : 0);
      const ctx = H.carte.getContext('2d'), p = scene.plan;
      ctx.clearRect(0, 0, 220, 220); ctx.drawImage(scene.fond, 0, 0);
      for (let k = co.voitures.length - 1; k >= 0; k--) {
        const v = co.voitures[k], ps = tampons.poses[k]; if (!ps) continue;
        const moi = v === j;
        ctx.beginPath(); ctx.arc(p.ox + ps.x * p.e, p.oz + ps.z * p.e, moi ? 5.5 : 3.6, 0, Math.PI * 2);
        ctx.fillStyle = moi && !demo ? '#e0301e' : couleurCss(v); ctx.fill();
        ctx.lineWidth = moi ? 2 : 1; ctx.strokeStyle = moi ? '#f2ecdf' : 'rgba(10,12,15,.85)'; ctx.stroke();
      }
      if (chronoMode) {
        const f = B.course.fantome(co, S.retardImage);
        if (f) { const e = B.circuit.echantillon(co.c, f.s); ctx.beginPath(); ctx.arc(p.ox + e.x * p.e, p.oz + e.z * p.e, 4, 0, Math.PI * 2); ctx.fillStyle = '#6fd0ff'; ctx.fill(); }
      }
    }
    // compteur d'images : la cadence réellement tenue (images rendues par seconde, lissées sur la grille de l'écran),
    // virée à l'ambre sous 90 % de la cadence visée — l'écran divisé par le diviseur de la cadence, et non 60 d'office :
    // 30 images tenues sur un écran bridé à 30 Hz ne sont pas une alerte, 100 sur un écran 144 Hz en sont une
    const fps = Math.round(imageCadence && imageCadence.ips || 1000 / Math.max(.5, dureeImage));
    const cible = imageCadence ? 1 / (imageCadence.periode * imageCadence.diviseur) : 60;
    if (H['h-fps']) { texte(H['h-fps'], fps + ' FPS'); classe(H['h-fps'], 'bas', fps < .9 * cible); }
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
    if (nom !== 'course') { secouerManette(0, 0); secouerManette(0, 0, pad2); }
    // pause, résultats, menus : les écritures différées de la course (records, fantôme, réglages) partent ici
    if (nom !== 'course') viderStock();
    for (const e of ECRANS) $(e).hidden = e !== nom;
    $('hud').hidden = !(nom === 'course' || nom === 'pause' || nom === 'demo');
    hud2.hidden = !(aDeux() && (nom === 'course' || nom === 'pause'));
    $('demo').hidden = nom !== 'demo';
    $('jeu').dataset.ecran = nom;
    ecran = nom;
    if (nom === 'titre') dernierGeste = performance.now();
    if (nom === 'titre' || nom === 'preparation' || nom === 'enligne' || nom === 'prets') {
      if (!session || session.type !== 'vitrine' || (nom === 'preparation' && session.i !== reglages.circuit)) lancer('vitrine', nom === 'preparation' ? reglages.circuit : (session ? session.i : reglages.circuit));
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
  function lancerDemo(i) {
    lancer('demo', clamp(i | 0, 0, CATALOGUE.length - 1));
    H.message.className = 'message'; H['sous-message'].className = 'sous-message';
    aller('demo');
  }
  // La course de démo est finie : la suivante part sur le circuit d'après, derrière le voile de préparation.
  function demoSuivante(S) {
    S.enchaine = true;
    $('chargement').classList.remove('fini');
    setTimeout(() => {
      if (ecran === 'demo' && session === S) lancerDemo((S.i + 1) % CATALOGUE.length);
      $('chargement').classList.add('fini');
    }, 340);
  }
  function sortirDemo() {
    if (ecran !== 'demo') return;
    avalerJusque = performance.now() + 400;
    $('chargement').classList.add('fini');
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
        if (session.i !== reglages.circuit || session.nature.saison.id !== k.saison) lancer('vitrine', reglages.circuit, null, k);
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
        b.addEventListener('click', () => { reglages.circuit = i; sauverReglages(); majPreparation(); if (son) son.evenement('clic'); lancer('vitrine', i); if (EL.role === 'hote' && lienActif()) annoncerCourse(); });
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
    // Cadence d'images : la valeur normalisée par la cadence est celle qui est retenue (une cible fixe vise le
    // diviseur de l'écran le plus proche) ; les essais en cours repartent de zéro.
    if (t.name === 'cadence') { reglages.cadence = B.cadence.regler(cadence, t.value); sauverReglages(); }
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
    for (const nom of ['vue', 'boite', 'qualite', 'cadence', 'anticrenelage', 'ombres', 'vegetation', 'faune', 'aide', 'tableau', 'retro', 'demo', 'cartePosition', 'carteTaille']) for (const r of document.querySelectorAll('input[name="' + nom + '"]')) r.checked = String(reglages[nom]) === r.value;
    $('v-carte').checked = reglages.carte !== 'non';
    $('v-champ').value = reglages.champ; $('v-champ-valeur').textContent = reglages.champ + '°';
    $('v-secousses').value = reglages.secousses; $('v-secousses-valeur').textContent = Math.round(reglages.secousses * 100) + ' %';
    for (const nom of ['general', 'moteur', 'effets']) $('v-' + nom).value = reglages[nom];
    $('v-vibrations').checked = reglages.vibrations !== 'non';
    reglages.vibrationForce = clamp(reglages.vibrationForce != null ? +reglages.vibrationForce : 0.5, 0, 1);
    $('v-vibration-force').value = reglages.vibrationForce; $('v-vibration-force-valeur').textContent = Math.round(reglages.vibrationForce * 100) + ' %';
  }
  function retour() {
    if (ecran === 'reglages') aller(retourReglages || 'titre');
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
  function demarrerSeance(type, conditions) {
    $('chargement').classList.remove('fini');
    const avant = ecran, choix = conditions || (session && session.conditions) || conditionsDuDepart();
    setTimeout(() => {
      $('chargement').classList.add('fini');
      if (ecran !== avant) return;
      lancer(type, reglages.circuit, null, choix);
      aller('course');
      if (type === 'chrono') sousMessage('Le chrono part à la ligne');
    }, 30);
  }
  function basculerPause(forcer) {
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

  // ---------------------------------------------------------------- boucle principale
  // Cadence (src/cadence.js) : la boucle ne lit pas l'heure elle-même. Elle passe à la cadence l'horodatage de chaque
  // rappel ; la cadence estime la période de l'écran, cale le temps de jeu sur elle (nombre de pas verrouillé, alpha
  // stable) et, en Auto, ne fait rendre qu'un rappel sur k quand la machine ne tient pas la période. Une image qui
  // alterne une et deux périodes se voit bien plus qu'une cadence moitié tenue.
  const cadence = B.cadence.creer({ hz: 1 / DT, maxPas: 14, mode: reglages.cadence });
  // contexte réutilisé : actif (une séance tourne et peut décider), qualiteReductible (la qualité Auto peut encore
  // baisser : la cadence ne divise pas avant elle), echelle (ralenti de la démo)
  const ctxCadence = { echelle: 1, qualiteReductible: false, actif: false };
  const mesuresCadence = { periode: null, diviseur: 1, verrouille: false }, etatCadence = {};
  let imageCadence = null, seanceVue = null;
  // Le volet de mesures s'ouvre sans le chronomètre GPU : ses requêtes coupent les passes des processeurs graphiques
  // à tuiles et coûtent elles-mêmes. BITUME_JEU.chronoGPU = true le rouvre.
  B.mesures.chrono(false);
  let tPrec = 0;
  function oublierIntervalle() {
    // Le temps passé dans un onglet masqué ne doit pas faire baisser la qualité au retour, ni compter comme une
    // image ratée ou du temps à rattraper.
    tPrec = 0;
    B.cadence.oublier(cadence);
    B.qualite.avancer(palier, 0, { actif: false });
    B.mesures.reinitialiser();
  }
  function image(t) {
    requestAnimationFrame(image);
    // Le banc possède temporairement le renderer. Aucune seconde boucle de jeu ne pollue la mesure, et l'intervalle
    // qui suit le banc n'est pas du temps à rattraper.
    if (detectionGraphiqueActive) { tPrec = 0; B.cadence.oublier(cadence); return; }
    // Commandes et menus à chaque rappel, même sans image : les pas de l'image suivante lisent l'état le plus frais.
    // Les messages demandés depuis le rappel précédent s'affichent ici, une fois (voir message).
    lireManette();
    majAttente();
    appliquerMessages();
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
    // Nouvelle séance (chargement, référence, démo suivante) : l'intervalle du chargement n'est ni une image ratée ni
    // du temps à rattraper. Une vraie séance rouvre les essais de retour de la cadence et les niveaux de la qualité
    // Auto qui avaient échoué, et le volet de mesures repart d'elle (créations tardives, images longues). Le changement
    // de séance est un arrêt : une résolution en attente y passe.
    if (S !== seanceVue) {
      seanceVue = S; tPrec = 0;
      B.cadence.oublier(cadence);
      if (S && S.type !== 'vitrine') { B.cadence.nouvelleSeance(cadence); B.qualite.nouvelleSeance(palier); B.mesures.reinitialiser(); }
      if (resolutionDifferee && rendu) appliquerPalier();
    }
    // la vitrine tourne derrière les menus ; une course ne tourne qu'à l'écran de course, la démo qu'à l'écran de démo
    const tourne = !!S && (S.type === 'vitrine' ? ecran !== 'chargement' : ecran === (S.type === 'demo' ? 'demo' : 'course') || (!!S.enLigne && (ecran === 'pause' || ecran === 'resultats')));
    const actif = tourne && !S.banc && !S.reference && !document.hidden;
    ctxCadence.actif = actif;
    ctxCadence.qualiteReductible = actif && reglages.qualite === 'auto' && palier.n < PALIERS;
    // démo : un choc passe au ralenti (réalisateur) ; la cadence compte alors moins de pas par image
    ctxCadence.echelle = tourne && S.type === 'demo' && !S.enLigne ? B.realisateur.vitesse(S.real, S.course) : 1;
    const f = imageCadence = B.cadence.image(cadence, t, ctxCadence);
    if (!S || !rendu || !f.rendre) return;
    const tMes = B.mesures.imageDebut();
    const tBrut = tPrec ? (t - tPrec) / 1000 : DT;   // intervalle réellement subi depuis l'image rendue précédente
    const dtReel = f.dt;                             // temps de jeu de l'image, borné comme les pas (14 au plus)
    tPrec = t; horlogeReelle += dtReel; dureeImage = lerp(dureeImage, dtReel * 1000, .1);
    appliquerResolutionDifferee(S);
    const tSim = B.mesures.actif ? performance.now() : 0;
    let alpha;
    if (tourne && S.enLigne) {
      // en ligne : la simulation suit l'horloge commune, pas à pas, depuis l'instant T0 du départ
      const cible = (EL.R ? EL.R.horloge() - S.enLigne.T0 : 0) / 1000;
      let n = 0;
      while (S.course.horloge + DT <= cible && n < 90 && !S.course.termine) { pasSimulation(S, false); n++; }
      if (n) envoyerEtats(S);   // une fois par image, l'état le plus récent : le moins vieux possible à l'arrivée
      S.acc = clamp(cible - S.course.horloge, 0, DT);
      alpha = S.acc / DT;
      if (cible < 0) texte($('sous-message'), 'Départ dans ' + Math.ceil(-cible) + ' s');
    } else if (tourne) {
      // hors ligne : les pas que la cadence a comptés (verrouillés sur la période de l'écran, rattrapage borné à 14)
      // et sa phase pour l'interpolation ; S.acc garde la phase pour les images arrêtées qui suivent. La boucle ne
      // rend jamais S.acc négatif : un S.acc négatif vient d'un outil d'essai qui fige la boucle pour avancer pas à
      // pas (BITUME_JEU.avancer, scripts de captures). Elle ne fait alors aucun pas et montre l'état précédent
      // (alpha nul), comme l'ancien accumulateur, dont ces scripts dépendent.
      if (S.acc < 0) alpha = 0;
      else {
        const pilote = !!(S.reference && S.reference.pilote);
        for (let k = 0; k < f.pas; k++) pasSimulation(S, pilote);
        alpha = f.alpha; S.acc = alpha * DT;
      }
    } else if (horlogeReelle - (S.imageFigee || 0) < .25) return; // image arrêtée : quatre images par seconde suffisent
    else alpha = clamp(S.acc / DT, 0, 1);
    if (B.mesures.actif) B.mesures.section('simulation', performance.now() - tSim);
    if (tourne) majVibrations(S, dtReel, t);
    S.imageFigee = horlogeReelle;
    if (S.type === 'vitrine') S.suiviRang = Math.floor(horlogeReelle / 18) % 4;
    const dtVu = tourne ? dtReel : 0, cam = rendreImage(S, alpha, dtVu);
    if (tourne) majPalier(S, f.intervalle, f);
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
      // période de l'écran (inconnue tant que la cadence n'a pas sa grille : le volet l'estime alors), diviseur et
      // verrou déclarés au volet : une image est longue au-delà de (diviseur + 0,5) périodes
      B.cadence.etat(cadence, etatCadence);
      mesuresCadence.periode = etatCadence.grille ? etatCadence.periodeMs : null;
      mesuresCadence.diviseur = etatCadence.diviseur; mesuresCadence.verrouille = etatCadence.verrouille;
      B.mesures.cadence(mesuresCadence);
      B.mesures.imageFin(tMes, tBrut); B.mesures.majAffichage(rendu, horlogeReelle);
    }
    // travail du fil principal pour cette image : la cadence ne tente un diviseur plus bas que s'il laisse de la marge,
    // et la qualité Auto ne remonte que sur lui. Une image qui a chargé la séance suivante (démo) ne compte pas.
    if (session === S) B.cadence.travail(cadence, performance.now() - tMes);
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
    if (contexteRenduPerdu) { restaurerDecorApresContexte = true; return; }
    const atm = session && session.nature ? session.nature.ambiance.atmosphere : scene.decor.atmosphere;
    rendu.setWorld([], [], atm); rendu.setNappes(scene.decor.nappes); rendu.setLots(scene.decor.lots);
    if (session && session.nature) session.nature.revisionRendu = -1;
    restaurerDecorApresContexte = false;
  }
  function contexteGraphiqueRetabli() {
    contexteRenduPerdu = false;
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
    let parcours = null, resultat = null, glacesPretees = false;
    try {
      // Peindre l'indication avant de construire le parcours procédural.
      await imageDetection();
      // Le moteur des rétroviseurs est prêté au parcours s'il existe déjà : la mesure paie alors les glaces comme la
      // course ; sinon le parcours le dit et la détection resserre sa limite. Il rend ensuite le décor de la séance.
      glacesPretees = !!retro.rendu;
      parcours = B.sceneBench.creer(rendu, { ...capacitesRendu, gpuModeste: false }, glacesPretees ? { glaces: retro.rendu } : undefined);
      // terminer : lecture d'un pixel qui force la fin du travail graphique ; la détection mesure alors l'image
      // complète à l'horloge, sans ouvrir le chronomètre GPU (qui gonfle les temps des processeurs à tuiles)
      resultat = await B.autoconfig.executer({ empreinte: empreinteDetection, image: imageDetection,
        annule: () => annulerDetection, masque: () => document.hidden, perdu: () => contexteRenduPerdu,
        preparer: parcours.preparer, dessiner: parcours.dessiner, terminer: parcours.terminer,
        profilGPU: () => rendu.profile ? rendu.profile() : null,
        progression: (texte, fraction) => { $('detection-texte').textContent = texte; $('detection-progres').value = Math.min(1, fraction); } });
      derniereDetection = resultat;
      appliquerDetection(resultat);
    } catch (e) {
      derniereDetection = resultat = { statut: 'interrompu', motif: 'erreur' };
      console.warn('BITUME : détection graphique interrompue', e);
    } finally {
      if (parcours) parcours.liberer();
      // le moteur prêté garde le décor du parcours : la prochaine glace réinstalle celui de la séance
      if (glacesPretees) retro.scene = null;
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
          if (!contexteRenduPerdu && session && session.type === 'vitrine' && resultat && resultat.statut === 'ok') lancer('vitrine', session.i);
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
      // ce que le moteur a réellement ouvert, et non ce que le menu demande : src/graphismes.js ne promet pas
      // une capacité que FRender.create aurait refusée (msaa, atlas d'ombres, reflets d'écran)
      capacitesRendu = B.graphismes.capacites(optionsRendu, gpuModeste, window.devicePixelRatio || 1);
      // perte de contexte : les pièces détachées n'ont plus de scène où vivre ; on rend leurs corps sans attendre
      canvas.addEventListener('webglcontextlost', () => { contexteRenduPerdu = true; if (session && session.fx) B.traces.liberer(session.fx); });
      canvas.addEventListener('webglcontextrestored', contexteGraphiqueRetabli);
      palier.n = gpuModeste ? 1 : 0;
      if (rendu.stats.backend !== 'webgl2') { erreur('WebGL2 indisponible', 'Le rendu de secours ne sait pas dessiner la piste. Activez l’accélération graphique du navigateur.'); return; }
      B.graphismes.stabiliser(etatProfils, reglages.qualite, palier.n, horlogeProfils());
      appliquerPalier();
      const mesure = lireStock(B.autoconfig.CLE, null);
      // Le cache évite de refaire le test et d'effacer des choix manuels à chaque ouverture. Une mesure faite au
      // chronomètre GPU (avant la fin forcée par lecture d'un pixel) n'est plus valable : ce chronomètre gonfle les
      // temps des processeurs graphiques à tuiles (Légère choisie sur un Apple M5 qui tient Moyenne à 60 images par
      // seconde en course) ; elle est refaite une fois, à l'horloge.
      const terminer = !!(rendu.gl && typeof rendu.gl.readPixels === 'function');
      if (!B.autoconfig.cacheValide(mesure, empreinteDetection(), { terminer })) await detecterGraphismes(true);
      else {
        derniereDetection = mesure;
        gpuModeste = mesure.selection === 'low';
        capacitesRendu = Object.freeze({ ...capacitesRendu, gpuModeste });
      }
      // qualité Auto : le palier appris sur cette machine, plutôt que de repayer les secondes lentes du premier départ
      if (restaurerPalier()) { B.graphismes.stabiliser(etatProfils, reglages.qualite, palier.n, horlogeProfils()); appliquerPalier(); }
      // PhysX (FERRO) ne sert qu'aux pièces détachées et son décodage est lourd : lancé en tâche de fond, jamais
      // sur le chemin de l'écran titre, et l'absence du module ne doit pas empêcher la page de tourner.
      if (window.FPhysX && window.FPhysX.init) Promise.resolve(window.FPhysX.init()).catch(() => { /* pièces en parabole */ });
      son = B.son.creer();
      reglages.circuit = clamp(reglages.circuit | 0, 0, CATALOGUE.length - 1);
      lancer('vitrine', reglages.circuit);
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
    for (const G of [retro.j1, retro.j2]) if (G) { G.cote = 0; delete G.lampes0; delete G.lampes1; }
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
    // le banc mesure chaque image de l'écran : ni diviseur ni cible imposée pendant la mesure
    B.cadence.regler(cadence, 'ecran');
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
        B.cadence.regler(cadence, reglages.cadence);
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
    demo: i => lancerDemo(i === undefined ? reglages.circuit : i), // lance la démo sans attendre les cinq secondes
    get pauseAuto() { return pauseAuto; }, set pauseAuto(v) { pauseAuto = !!v; },
    get pilotageAuto() { return pilotageAuto; }, set pilotageAuto(v) { pilotageAuto = !!v; }, get enLigne() { return EL; },
    get camera() { return cameraEssai; }, set camera(f) { cameraEssai = typeof f === 'function' ? f : null; },
    // volet de mesures : BITUME_JEU.mesures = true l'ouvre, false le ferme ; la lecture donne l'instantané
    get mesures() { return B.mesures.lire(rendu); }, set mesures(v) { B.mesures.afficher(!!v, rendu); },
    // chronomètre GPU du volet, fermé par défaut (ses requêtes coûtent) ; cadence : période, diviseur, essais
    get chronoGPU() { return B.mesures.chronoGPU; }, set chronoGPU(v) { B.mesures.chrono(!!v, rendu); },
    get cadence() { return B.cadence.etat(cadence); } };
  setTimeout(demarrer, 20);
})(globalThis.BITUME = globalThis.BITUME || {});
