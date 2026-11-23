(function (B) {
  'use strict';
  // BITUME : coque du jeu (boucle à pas fixe, commandes, caméras, affichage, menus). Écrit par Claude.

  const DT = 1 / 120;
  const $ = id => document.getElementById(id);
  const clamp = (x, a, b) => x < a ? a : (x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const angle = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
  const ramener = (s, L) => ((s % L) + L) % L;

  // L'identité du parcours complet sépare ses résultats et ses fantômes de ceux de chaque ancien tronçon.
  const CATALOGUE = [
    { id: 'forets-du-pacifique', nom: 'Ça sent le sapin', lieu: 'Val-Brûlé et les falaises de Cap-Séquoia', theme: 'foret', graine: 11,
      troncons: [
        { id: 'val-brule', nom: 'Val-Brûlé', theme: 'foret', graine: 11, longueur: 4200 },
        { id: 'cap-sequoia', nom: 'Cap-Séquoia', theme: 'pacifique', graine: 157, longueur: 5200 }
      ] },
    { id: 'marseille', nom: 'La Sardine en pole', lieu: 'Marseille · du Vieux-Port à la Corniche', theme: 'cote', graine: 313, longueur: 5992, distanceCourse: 5752, ouvert: true },
    { id: 'karst-et-lagon', nom: 'Ça karste ou ça casse', lieu: 'Terrasses de Brume-de-Jade et Baie-du-Corail', theme: 'asie', graine: 131,
      troncons: [
        { id: 'brume-de-jade', nom: 'Brume-de-Jade', theme: 'asie', graine: 131, longueur: 5000 },
        { id: 'corail', nom: 'Baie-du-Corail', theme: 'corail', graine: 283, longueur: 4500 }
      ] },
    { id: 'sierra', nom: 'Le Canyon qui klaxonne', lieu: 'Sierra-Cuivrée · arche et viaduc rouge', theme: 'sierra', graine: 271, longueur: 5000 },
    { id: 'nord-atlantique', nom: 'Fjord à bâbord', lieu: 'Fjord-d’Argent et plateau volcanique de Lande-Noire', theme: 'fjord', graine: 223,
      troncons: [
        { id: 'fjord', nom: 'Fjord-d’Argent', theme: 'fjord', graine: 223, longueur: 5100 },
        { id: 'lande-noire', nom: 'Lande-Noire', theme: 'islande', graine: 83, longueur: 4600 }
      ] },
    { id: 'route-des-cimes', nom: 'Le Col des Fondus', lieu: 'Grand col alpin · cirque de l’Aiglière', theme: 'montagne', graine: 181, longueur: 9697.52858032384, partition: 'route-des-cimes' },
    { id: 'larche', nom: 'Raclette en roue libre', lieu: 'Col de Larche → Vinadio · SS21', theme: 'montagne', graine: 210, longueur: 32816.81, distanceCourse: 32249.33, ouvert: true },
    { id: 'baikal', nom: 'Les Glaçons à réaction', lieu: 'Lac Baïkal · rives gelées et tremplin', theme: 'baikal', graine: 179, longueur: 5400 },
    { id: 'ovale-des-forges', nom: 'Le Cocodrome', lieu: 'Caraïbes · speedway de plage, quatre virages relevés à 24 %',
      theme: 'ovale', graine: 347, longueur: 1600, partition: 'ovale-des-forges' }
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
  // Identifiants persistés : « poursuite » conserve son cadre historique à 7,4 m.
  const VUES_COURSE = Object.freeze(['aileron-avant', 'nez', 'cockpit', 'arceau', 'poursuite-proche', 'poursuite']);
  const preferenceMouvement = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const DEFAUT = { vue: 'cockpit', vue2: 'poursuite', partage: 'haut-bas', boite: 'auto', aide: 0.35, qualite: 'auto', cadence: 'auto', general: 0.8, moteur: 0.9, effets: 0.9, tours: 3, difficulte: 1, circuit: 0, champ: 70, retro: 'auto', pneus: 'slicks', tableau: 'reduit', carte: 'oui', cartePosition: 'bas-gauche', carteTaille: 'normale', demo: 'oui', vibrations: 'oui', vibrationForce: 0.5, meteo: 'aleatoire',
    anticrenelage: 'profil', ombres: 'profil', vegetation: 'profil', faune: 'profil', moment: 'jour', saison: 'ete', saisonMode: 'manuel', momentMode: 'manuel', annoncesVirages: 'non', gouttes: 1, forcePluie: 'forte',
    secousses: (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1; } catch (e) { return 1; } })() };
  const reglagesEnregistres = lireStock('bitume.reglages', {});
  const reglages = Object.assign({}, DEFAUT, reglagesEnregistres);
  const circuitSauve = B.championnat.indiceCircuit(CATALOGUE, reglagesEnregistres?.circuitId, reglagesEnregistres?.circuit);
  reglages.circuit = circuitSauve >= 0 ? circuitSauve : DEFAUT.circuit;
  for (const cle of ['vue', 'vue2']) if (!VUES_COURSE.includes(reglages[cle])) reglages[cle] = DEFAUT[cle];
  Object.assign(reglages, initialiserChoixPneus(reglagesEnregistres));
  reglages.trollPilotes = B.menuArcade.normaliserTroll(reglagesEnregistres);
  reglages.qualite = B.graphismes.normaliser(reglages.qualite);
  // Cadence d'images (Auto, Écran, 120, 60, 30) : une valeur ancienne, inconnue ou mal écrite revient à Auto.
  reglages.cadence = B.cadence.normaliser(reglages.cadence);
  Object.assign(reglages, B.graphismes.normaliserOptions(reglages));
  reglages.moment = B.ambiance.normaliser(reglages.moment);
  reglages.saison = B.saisons.normaliser(reglages.saison);
  reglages.saisonMode = B.conditionsCourse.normaliserMode(reglages.saisonMode);
  reglages.momentMode = B.conditionsCourse.normaliserMode(reglages.momentMode);
  reglages.meteoMode = B.conditionsCourse.normaliserMode(reglages.meteoMode || (reglages.meteo === 'aleatoire' ? 'aleatoire' : 'manuel'));
  reglages.forcePluie = B.conditionsCourse.normaliserForcePluie(reglages.forcePluie);
  // Champ du cockpit : défaut 70° (décision David 22/11). Une ancienne valeur 69° ou 80° revient une fois à 70°.
  if (!reglages.champRevu || reglages.champRevu < 2) {
    if (+reglages.champ === 69 || +reglages.champ === 80) reglages.champ = DEFAUT.champ;
    reglages.champRevu = 2;
  }
  reglages.secousses = Number.isFinite(+reglages.secousses) ? clamp(+reglages.secousses, 0, 1) : DEFAUT.secousses;
  reglages.gouttes = reglages.gouttes != null && Number.isFinite(+reglages.gouttes) ? clamp(+reglages.gouttes, 0, 2) : DEFAUT.gouttes;
  // Quatre coins disponibles pour la carte ; par défaut en bas à gauche (décision David 21/11).
  if (!reglages.cartePositionVersion || reglages.cartePositionVersion < 3) {
    if (reglages.cartePosition === 'gauche' || reglages.cartePosition === 'droite'
      || (reglages.cartePositionVersion === 2 && reglages.cartePosition === 'haut-gauche')) {
      reglages.cartePosition = 'bas-gauche';
    }
    reglages.cartePositionVersion = 3;
  } else {
    if (reglages.cartePosition === 'gauche') reglages.cartePosition = 'bas-gauche';
    else if (reglages.cartePosition === 'droite') reglages.cartePosition = 'bas-droite';
  }
  for (const [cle, valeurs] of Object.entries({ carte: ['oui', 'non'], cartePosition: ['bas-gauche', 'bas-droite', 'haut-gauche', 'haut-droite'], carteTaille: ['petite', 'normale', 'grande'], annoncesVirages: ['non', 'ecran', 'voix'] }))
    if (!valeurs.includes(reglages[cle])) reglages[cle] = DEFAUT[cle];
  const sauverReglages = () => {
    // en course (changement de vue au clavier ou à la manette), l'écriture attend la file
    if (!session || !session.reglagesReference) {
      reglages.circuitId = CATALOGUE[reglages.circuit]?.id;
      (ecran === 'course' ? differerStock : ecrireStock)('bitume.reglages', reglages);
    }
  };
  // records et fantômes suivent la physique : ceux de l'essai 0.1 (avant le modèle à deux essieux) ne se comparent plus
  const PHYSIQUE = 'p19', CLE_RECORDS = 'bitume.records.' + PHYSIQUE, CLE_FANTOME = 'bitume.fantome.' + PHYSIQUE + '.';
  const recordsLus = lireStock(CLE_RECORDS, {});
  // JSON.stringify ignore les clés nommées d'un tableau. Reprendre ses temps sous leurs
  // anciens identifiants avant que la première amélioration sur un raccord soit sauvegardée.
  const records = Array.isArray(recordsLus)
    ? Object.fromEntries(Array.from(recordsLus, (record, i) => [B.championnat.ANCIEN_CATALOGUE[i]?.id || 'circuit_' + i, record]))
    : recordsLus || {};
  const recordsEnrichis = (() => {
    try { return B.records ? B.records.lireTout(globalThis.localStorage, B.championnat.ANCIEN_CATALOGUE) : null; }
    catch (e) { return null; }
  })();
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
    if (!circuits[i]) {
      const k = CATALOGUE[i];
      if (k.troncons) circuits[i] = B.raccords.creer(k);
      else if (k.id === 'larche' && B.larche) circuits[i] = B.larche.creer(k.graine);
      else if (k.id === 'marseille' && B.marseille) circuits[i] = B.marseille.creer(k.graine);
      else circuits[i] = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom, partition: k.partition });
      circuits[i].nom = k.nom;
      // lot 22F : le parapet, le muret ou le bord du fossé d'un bord dangereux devient la limite (une fois, à la création)
      if (B.bords && !circuits[i].ouvert) B.bords.limites(circuits[i], B.bords.planifier(circuits[i]));
    }
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
    c = B.menuArcade.parcoursChronometre(c);
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
    const pas = c.ouvert ? Math.max(4, Math.floor(c.n / 600)) : 3;
    const fin = c.ouvert ? c.n - 1 : c.n;
    for (let i = 0; i <= fin; i += pas) { const [x, y] = p.vers(c.x[i % c.n], c.z[i % c.n]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    if (c.ouvert) { const [x, y] = p.vers(c.x[c.n - 1], c.z[c.n - 1]); ctx.lineTo(x, y); }
    else ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = epaisseur; ctx.strokeStyle = couleur; ctx.stroke();
    // ligne de départ (et ligne d'arrivée distincte en parcours ouvert)
    const [x, y] = p.vers(c.x[0], c.z[0]), a = c.cap[0], l = epaisseur * 1.6;
    ctx.beginPath(); ctx.moveTo(x - Math.sin(a) * l, y + Math.cos(a) * l); ctx.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l);
    ctx.lineWidth = Math.max(2, epaisseur * .55); ctx.strokeStyle = c.ouvert ? '#2ecc71' : '#e0301e'; ctx.stroke();
    if (c.ouvert && Number.isFinite(c.arrivee)) {
      const iArr = c.n - 1;
      const [ax, ay] = p.vers(c.x[iArr], c.z[iArr]), aa = c.cap[iArr];
      ctx.beginPath(); ctx.moveTo(ax - Math.sin(aa) * l, ay + Math.cos(aa) * l); ctx.lineTo(ax + Math.sin(aa) * l, ay - Math.cos(aa) * l);
      ctx.lineWidth = Math.max(2, epaisseur * .55); ctx.strokeStyle = '#e0301e'; ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- moteur de rendu et son
  let rendu = null, son = null, scene = null, session = null;
  let detectionGraphiqueActive = false, annulerDetection = false, contexteRenduPerdu = false, contexteFragile = false;
  let restaurerDecorApresContexte = false;
  let materielRendu = 'webgl2', derniereDetection = null;
  let decorEnrichi = true; // l'outil de référence peut retrouver le décor historique pour une comparaison A/B
  let publicVisible = true; // BITUME_JEU.public.visible : mesurer l'image avec et sans le public
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
  function clePanorama(i, v) {
    const k = CATALOGUE[i], version = document.querySelector('.version-jeu')?.textContent;
    if (k.id !== 'larche' || !version) return null;
    const options = [v.ancre, decorEnrichi, v.veut.matieres, v.vegetationQualite, 'flux-1'].join('/');
    return 'panorama-v1:' + B.cache.cleDecor(k.id, k.graine, options, v.saison, version);
  }
  function installer(i, saisonDemandee, panorama, herbierWasm) {
    // Le décor est bâti sur un palier « ancre » (voir « profils graphiques du menu ») : la même piste ne se
    // reconstruit pas à chaque fluctuation du gouverneur, seulement quand l'ancre ou l'enrichissement change.
    const v = voeuDecor(saisonDemandee), { ancre, veut, vegetationQualite, saison } = v;
    if (sceneEnPlace(i, saisonDemandee, v)) return scene;
    const c = circuit(i), decor = B.decor.construire(c, {
      decorProgressif: true,
      cachePanorama: panorama && panorama.cle === clePanorama(i, v) ? panorama : null,
      herbierWasm,
      qualite: ancre,
      matieres: decorEnrichi && veut.matieres,
      vegetation: decorEnrichi && veut.vegetation,
      vegetationQualite,
      saison,
      solsProceduraux: true,
      organique: true,
      public: decorEnrichi && !!B.public,
    });
    decor.atmosphere = B.graphismes.atmosphere(decor.atmosphere);
    if (B.obstacles) c.obstacles = B.obstacles.creer(decor.obstacles);
    rendu.setWorld([], [], decor.atmosphere);
    rendu.setNappes(decor.nappes, { staticBounds: true });
    rendu.setLots(decor.lots, { staticBounds: true, progressif: !!decor.fluxDecor });
    // Le public (public.js) : de vrais spectateurs à la place des boîtes des gradins, dessinés par le point d'accroche
    // « foule » du moteur. Bâti au palier ancre, comme le décor ; la vue de l'ancienne scène rend ses tampons.
    if (scene && scene.vuePublic) scene.vuePublic.liberer();
    const pub = decor.gradins && B.public ? B.public.creer(c, decor, { qualite: ancre, saison }) : null;
    let vuePublic = null;
    if (pub) try { vuePublic = B.public.vue(rendu, pub); } catch (e) { console.warn('BITUME : public indisponible', e); }
    // plan du circuit pour l'affichage de course, dessiné une fois
    const fond = document.createElement('canvas'); fond.width = fond.height = 220;
    const trace = B.menuArcade.parcoursChronometre(c);
    const p = plan(trace, 220, 220, 16), ctx = fond.getContext('2d');
    dessinerTrace(ctx, trace, p, 9, 'rgba(10,12,15,.9)'); dessinerTrace(ctx, trace, p, 4.5, '#d9d2c3');
    // profondeur du volume d'ombre : un point du sol au bord du carré est décalé de OMBRE × cotangente de la hauteur du soleil
    const sol = decor.atmosphere.sunDirection, sinus = sol[1] / Math.hypot(sol[0], sol[1], sol[2]);
    const ombre = { extent: OMBRE, depth: 2 * (OMBRE * Math.sqrt(Math.max(0, 1 - sinus * sinus)) / Math.max(.25, sinus) + 30) };
    scene = { index: i, enrichi: decorEnrichi, palier: ancre, vegetationQualite, saison, c, decor, fond, plan: p, ombre, detailPeripherique: B.detailPeripherique.creer(decor.lots), public: pub, vuePublic };
    return scene;
  }
  // Six champs préalloués : vue principale et deux glaces par joueur. Les caméras de rendu
  // sont réutilisées ailleurs ; copier leurs nombres évite qu'une autre vue déplace ce champ.
  function creerChampsFaune() {
    const champs = [];
    for (let i = 0; i < 6; i++) champs.push({ camera: { pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, fov: 70 },
      qualite: 'off', aspect: 16 / 9, hauteur: 720, valide: false });
    return champs;
  }
  function copierChampFaune(champ, cam, aspect, hauteur, qualite) {
    const c = champ.camera;
    c.pos[0] = cam.pos[0]; c.pos[1] = cam.pos[1]; c.pos[2] = cam.pos[2];
    c.yaw = cam.yaw; c.pitch = cam.pitch || 0; c.roll = cam.roll || 0; c.fov = cam.fov;
    champ.aspect = aspect; champ.hauteur = hauteur; champ.qualite = qualite; champ.valide = true;
  }
  // Rejet conservateur du petit disque qui enveloppe la glace réelle, dans le repère caméra.
  function glaceVisibleFaune(g, cam, aspect) {
    const dx = g.centre[0] - cam.pos[0], dy = g.centre[1] - cam.pos[1], dz = g.centre[2] - cam.pos[2];
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch || 0), sp = Math.sin(cam.pitch || 0);
    const cr = Math.cos(cam.roll || 0), sr = Math.sin(cam.roll || 0);
    const x = dx * cy + dz * sy, y = -dx * sy * sp + dy * cp + dz * cy * sp;
    const z = dx * sy * cp + dy * sp - dz * cy * cp;
    let rayon2 = 0;
    for (let i = 0; i < g.coins.length; i++) {
      const p = g.coins[i], ex = p[0] - g.centre[0], ey = p[1] - g.centre[1], ez = p[2] - g.centre[2];
      rayon2 = Math.max(rayon2, ex * ex + ey * ey + ez * ez);
    }
    const rayon = Math.sqrt(rayon2), tan = Math.tan(cam.fov * Math.PI / 360);
    return z + rayon > .01 && Math.abs(x * cr + y * sr) <= z * tan * aspect + rayon * (1 + tan * aspect)
      && Math.abs(y * cr - x * sr) <= z * tan + rayon * (1 + tan);
  }
  function preparerChampsFaune(S, vue, cam, ps, P, acteurs, avecGlaces = glacesVives(S, vue), glaces) {
    const champs = S.champsFaune, premier = S === session ? 0 : 3;
    if (acteurs) { acteurs.masque = 0; acteurs.indetermine = avecGlaces; }
    if (!champs) return;
    for (let i = premier; i < premier + 3; i++) champs[i].qualite = 'off';
    const animaux = reglages.faune !== 'off' && B.animaux;
    const qualite = animaux ? B.animaux.qualite(reglages.faune, P.palier) : 'off';
    const aspect = canvas.width / Math.max(1, canvas.height);
    if (animaux) copierChampFaune(champs[premier], cam, aspect, canvas.height, qualite);
    if ((!acteurs && !animaux) || !avecGlaces || !(P.secondaires.retroviseurs.hz > 0)) return;

    const source = $('retro-rendu');
    if (acteurs) tailleGlaces(source);
    if (!(retro.l > 0 && retro.h > 0)) return;
    if (!glaces) {
      const ev = POSE_GLACES, J = ETATS_GLACES[premier ? 1 : 0];
      ev.p[0] = ps.x; ev.p[1] = ps.y; ev.p[2] = ps.z; ev.cap = ps.cap; ev.tangage = ps.tangage; ev.roulis = ps.roulis;
      glaces = B.voiture.glacesCockpit(ev, J.glaces);
    }
    // La vraie projection CSS utilise les dimensions de la surface affichée. Le champ
    // le plus large inclut aussi l'arrondi du tampon FERRO, même en écran partagé.
    const aspectGlaces = Math.max(aspect, (canvas.clientWidth || 0) / Math.max(1, canvas.clientHeight || 0));
    if (acteurs) acteurs.indetermine = false;
    for (let i = 0; i < 2; i++) {
      if (!glaceVisibleFaune(glaces[i], cam, aspectGlaces)) continue;
      const champ = champs[premier + 1 + i];
      cameraReflet(glaces[i], cam, ps, retro.l, retro.h, champ.camera);
      champ.qualite = qualite; champ.aspect = retro.l / retro.h; champ.hauteur = source.height; champ.valide = true;
      if (acteurs) {
        const reflet = champGlace(champ.camera, source.width, source.height, acteurs.reflets[i]);
        if (reflet) acteurs.masque |= 1 << i;
        else acteurs.indetermine = true;
      }
    }
    return glaces;
  }
  function selectionnerChampsFaune(S) {
    if (!S.animaux || !B.animaux || !B.animaux.selectionnerVues) return;
    const champs = S.champsFaune;
    if (!champs) return;
    // Les derniers champs affichés servent aux pas de l'image suivante. Une glace désactivée
    // ou un joueur absent sont retirés immédiatement, même si leur ancienne image est gardée.
    for (let j = 0; j < 2; j++) {
      const V = j ? (S.type === 'duo' ? S.vueJ2 : null) : S;
      const q = V && reglages.faune !== 'off' ? B.animaux.qualite(reglages.faune, profilDe(V).palier) : 'off';
      const premier = j * 3;
      champs[premier].qualite = champs[premier].valide ? q : 'off';
      const glaces = q !== 'off' && V && glacesVives(V, V.vue);
      for (let i = 1; i < 3; i++) if (!glaces) champs[premier + i].qualite = 'off';
    }
    B.animaux.selectionnerVues(S.animaux, champs, 6);
  }
  // Animaux des abords (src/animaux.js) : bâtis une fois par scène, comme le décor qu'ils habitent (12 à 90 ms mesurés
  // dans la page, une saccade si chaque course de la démo les recréait), puis repris de leurs places de départ à
  // chaque séance. Le moment de la journée suit la séance ; à l'horloge réelle, la nuit du départ vaut pour la course
  // (elle change trop lentement pour qu'une course le voie).
  function animauxDe(sc, nature) {
    if (!B.animaux || reglages.faune === 'off') return null;
    const reelle = nature.horlogeReelle && B.conditionsCourse && B.conditionsCourse.nuitReelle;
    const options = { saison: sc.saison, moment: nature.moment,
      nuit: reelle ? B.conditionsCourse.nuitReelle(nature.dateDepart != null ? nature.dateDepart : Date.now(), nature.horlogeReelle) : undefined };
    if (sc.animaux) return B.animaux.repartir(sc.animaux, options);
    return (sc.animaux = B.animaux.creer(sc.c, sc.decor, options));
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
    if (session && session.course) B.physique.liberer(session.course);
    session = null;
    // en ligne, une machine qui porte deux pilotes joue en écran partagé, comme une course à deux
    if (enl && enl.locaux.length === 2) type = 'duo';
    const conditions = enl || conditionsChoisies || conditionsDuDepart();
    const sc = installer(i, B.saisons.normaliser(conditions.saison), null, type !== 'vitrine'), c = sc.c, demo = type === 'demo', auto = demo || type === 'vitrine', duo = type === 'duo';
    // ombre lointaine du circuit (src/ombres.js) : une passe par décor, aucune sans ombres du soleil possibles
    B.ombres.carte(rendu, gpuModeste || !B.ombres.ombresPossibles(reglages.qualite, { decor: etatProfils.decor, capacites: capacitesRendu, options: reglages }), sc.decor.lots);
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
    const meteoInit = meteoPourConditions(conditions, i, enl ? enl.graine : graineCourse);
    // Pneus : le joueur roule sur ceux de la préparation (présélectionnés selon la météo, qu'il peut changer) ; les
    // rivaux sur ceux que conseille la piste au départ. La caisse les montre (voiture.js) et la conduite les sent.
    const conseil = B.conduite.pneusConseilles(B.chaussee.lire(null, 0, meteoInit)), joue = type === 'course' || type === 'chrono' || duo;
    monterPneusDepart(course, joue, enl, conseil);
    let S = null;
    try {
    B.physique.installer(course, sc.decor);
    S = {
      type, i, course, c, modeles: course.voitures.map(v => B.voiture.modele(v.livree)),
      prec: [], cour: [], sortie: [], acc: 0, tele: { poste: null, alea: graine32(course.voitures.length * 7 + i) },
      camCap: null, regardArriere: false, profil: new Float32Array(Math.ceil(c.longueur / 10) + 2).fill(-1), profilMeilleur: null,
      distances: new Float64Array(course.voitures.length).fill(-1), vRel: new Float64Array(course.voitures.length),
      visibiliteActeurs: creerVisibiliteActeurs(),
      detailsRoues: new Int8Array(course.voitures.length).fill(-1),
      detailsRouesGlaces: [new Int8Array(course.voitures.length).fill(-1), new Int8Array(course.voitures.length).fill(-1)],
      contresens: 0, bloque: 0, finA: null, resultats: false, derniereJauge: -9, positionPrec: 0, tempsAffiche: null,
      real: demo ? B.realisateur.creer(graineCourse) : null, cinema: null, planVu: null, suivie: 0, enchaine: false,
      expressions: B.expressionsPilote ? B.expressionsPilote.creer(course.voitures.length, graineCourse, { ia: joue }) : null,
      trollEvenement: { sequence: 0, pilote: -1, geste: null, klaxon: 'classique', instant: 0, cote: -1 },
      raclement: B.son.creerRaclement(),
      trollAudio: { klaxon: 'classique', gain: 0, pan: 0 },
      fx: B.traces.creer(course.voitures.length, graineCourse, course.physique.world),
      // flammes et détonations d'échappement (lot 20) : hasard propre, tiré de la graine de la course
      ech: B.echappement ? B.echappement.creer(course.voitures.length, graineCourse) : null,
      meteo: meteoInit, conditions, eauCarrosserieTemps: 0, eauCarrosseriePoint: new Float64Array(3),
      nature: { ambiance: B.ambiance.creer(sc.decor.atmosphere, c.theme === 'montagne'),
        secteurs: B.saisons.secteurs(c), aurorePossible: !!B.aurores?.concerne(c), moment: B.ambiance.normaliser(conditions.moment),
        horlogeReelle: horlogePartagee(conditions.horlogeReelle), dateDepart: enl && Number.isFinite(enl.dateDepart) ? enl.dateDepart : null,
        saison: sc.decor.saison || B.saisons.profil(sc.saison, CATALOGUE[i].theme), revisionRendu: -1, faune: null, effetsSaison: null, aurores: null },
      fauneVue: null, saisonVue: null, auroresVue: null, vitreContexte: null, animaux: null, animauxVue: null,
      champsFaune: creerChampsFaune(), fauneSecondaires: null,
      // créations tardives : objets nés dans le chemin d'une image au lieu de la préparation (doit rester à zéro)
      tardives: { n: 0, sousVoile: 0, noms: {} },
    };
    S.fauneSecondaires = [S.champsFaune[1], S.champsFaune[2]];
    // Toutes les montes sont préparées sous le voile : un service ne construit rien en pleine course.
    for (const modele of S.modeles) B.voiture.preparerPneusService(modele);
    if (B.eauCarrosserie) for (let k = 0; k < S.modeles.length; k++)
      B.eauCarrosserie.preparer(S.modeles[k], (enl ? enl.graine : graineCourse) + k * 739);
    // bâtis avec la scène (une fois par décor), repris ici de leurs places de départ : sous le voile de la préparation
    S.animaux = animauxDe(sc, S.nature);
    if (demo) S.cinema = B.cinema.preparer(c, sc.decor, S.animaux, course.physique.world);
    // Le public de la séance : moins nombreux sous la pluie, en hiver et la nuit ; son animation repart de zéro.
    if (sc.public) {
      B.public.reinitialiser(sc.public);
      B.public.regler(sc.public, { presence: B.public.presencePour(conditions.meteo, sc.saison, conditions.moment === 'nuit') });
    }
    if (enl) {
      S.enLigne = { T0: enl.T0, role: enl.role, humains: enl.humains, seance: enl.seance,
        troll: trollDepart(enl.humains, enl.troll) }; S.enLigneOrigine = true;
      course.distant = (v, dt) => appliquerDistant(S, v, dt);
      EL.recus.clear(); EL.corr.clear(); EL.pasEnvoi = 0;
      initialiserPneusReseau(S, enl);
    }
    // Écran partagé (David, 16/11 : « multi en écran splitté local, deux manettes, l'un sur l'autre ou côte à côte ») :
    // la vue du joueur 2 a son propre état de caméra, d'éclair et d'affichage, le reste vient de la séance.
    if (duo) S.vueJ2 = Object.assign(Object.create(S), { raclement: B.son.creerRaclement(1), camCap: null, regardArriere: false, tete: null, secousse: 0, eclair: 0, lumiere: 1, sol: null, tele: { poste: null, alea: graine32(31 + i) },
      distances: new Float64Array(course.voitures.length).fill(-1), vRel: new Float64Array(course.voitures.length),
      visibiliteActeurs: creerVisibiliteActeurs(),
      detailsRoues: new Int8Array(course.voitures.length).fill(-1),
      detailsRouesGlaces: [new Int8Array(course.voitures.length).fill(-1), new Int8Array(course.voitures.length).fill(-1)],
      suivie: course.duo ? course.voitures.filter(v => v.joueur)[1].id : 1, vue: reglages.vue2, positionPrec: 0, derniereJauge: -9, prochainClassement: 0, profilMeilleur: null, fauneVue: null, saisonVue: null, auroresVue: null, vitreContexte: null, animauxVue: null,
      fauneSecondaires: [S.champsFaune[4], S.champsFaune[5]] });
    S.locaux = course.voitures.filter(v => v.joueur).map(v => v.id);   // voitures conduites ici (une, ou deux à l'écran partagé)
    if (joue && S.expressions) configurerTrollLocaux(S);
    if (joue) {
      majPneusHUD(HUD1, course.voitures[S.locaux[0] ?? course.joueur.id].etat);
      if (duo) majPneusHUD(HUD2, course.voitures[S.locaux[1] ?? course.joueur.id].etat);
    }
    jeu.dataset.partage = duo ? (reglages.partage === 'cote' ? 'cote' : 'haut-bas') : '';
    delete $('hud').dataset.reduit; delete hud2.dataset.reduit;
    remplirPoses(S.cour, course); remplirPoses(S.prec, course);
    session = S;
    if (enl) {
      envoyerPneusReseau(S, true);
      if (EL.role === 'invite') EL.R.envoyer({ t: 'demande-pneus', version: VERSION_PNEUS_RESEAU, seance: enl.seance }, 0);
    }
    tactile(!auto && !duo);
    // hors préparation (référence, banc, démarrage), tout ce que la séance créerait à sa première image naît ici
    if (!prepa.interne) prechargerSeance(S);
    return S;
    } catch (e) {
      if (S && S.fx) B.traces.liberer(S.fx);
      B.physique.liberer(course);
      if (session === S) session = null;
      throw e;
    }
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
      if (et._physx && !v.distant) { p.x = et._physx.x; p.y = et._physx.y; p.z = et._physx.z; p.cap = et._physx.cap; }
      p.braquage = (et.braquage || 0) * (et._physx ? 1 : 2.2); p.roule = v.roule || 0;
      const rebond = p.rebond || (p.rebond = [0, 0, 0, 0]);
      for (let i = 0; i < 4; i++) rebond[i] = et._physx ? et._physx.offsets[i] : 0;
    });
  }
  function melange(a, b, t, sortie) {
    sortie.x = lerp(a.x, b.x, t); sortie.y = lerp(a.y, b.y, t); sortie.z = lerp(a.z, b.z, t);
    sortie.cap = a.cap + angle(b.cap - a.cap) * t; sortie.tangage = lerp(a.tangage, b.tangage, t);
    sortie.roulis = lerp(a.roulis, b.roulis, t); sortie.braquage = lerp(a.braquage, b.braquage, t);
    sortie.roule = lerp(a.roule || 0, b.roule || 0, t);
    const rebond = sortie.rebond || (sortie.rebond = [0, 0, 0, 0]);
    for (let i = 0; i < 4; i++) rebond[i] = lerp(a.rebond?.[i] || 0, b.rebond?.[i] || 0, t);
    return sortie;
  }

  // ---------------------------------------------------------------- commandes
  const touches = new Set();
  const impulsions = { haut: false, bas: false };
  const pad = { precedent: [], actions: {}, entrees: {}, volant: 0, gaz: 0, frein: 0, derive: false, actif: false, manette: null, deriveEtat: null };
  const pad2 = { precedent: [], actions: {}, entrees: {}, volant: 0, gaz: 0, frein: 0, derive: false, manette: null, deriveEtat: null };   // manette du joueur 2 (écran partagé)
  const consoleXbox = B.autoconfig?.recommander(navigator).xbox === true;
  const versionManettes = Number(reglages.manettesVersion) || 0;
  const configurationsManettes = [0, 1].map(n => B.commandesManette.migrer(reglages.manettes?.[n], versionManettes, n));
  if (versionManettes < B.commandesManette.VERSION) {
    reglages.manettesVersion = B.commandesManette.VERSION;
    if (Array.isArray(reglages.manettes)) {
      reglages.manettes = configurationsManettes.slice();
      ecrireStock('bitume.reglages', reglages);
    }
  }
  let captureManette = null, dernierSignalManette = -Infinity;
  let nbManettes = 0, manettes = [];
  let navigationManetteTraitee = false;
  const impulsions2 = { haut: false, bas: false };
  // Commandes de chaque joueur (David, 16/11 : « choix manette, clavier ou souris, et gérer les touches de chacun » ;
  // « clavier normal pour un et pavé numérique pour l'autre ») : appareil choisi (auto, manette, clavier, souris) et
  // jusqu'à deux touches par action, réglables ; positions physiques des touches (e.code).
  const ACTIONS = ['gaz', 'frein', 'gauche', 'droite', 'derive', 'haut', 'bas', 'vue', 'troll'];
  const TOUCHES_DEFAUT = [
    { gaz: ['ArrowUp', 'KeyW'], frein: ['ArrowDown', 'KeyS'], gauche: ['ArrowLeft', 'KeyA'], droite: ['ArrowRight', 'KeyD'], derive: ['Space', 'ShiftLeft', 'ShiftRight'], haut: ['KeyE'], bas: ['KeyQ'], vue: ['KeyC'], troll: ['KeyG'] },
    { gaz: ['Numpad8'], frein: ['Numpad5', 'Numpad2'], gauche: ['Numpad4'], droite: ['Numpad6'], derive: ['Numpad0'], haut: ['Numpad9'], bas: ['Numpad7'], vue: ['NumpadEnter'], troll: ['NumpadDecimal'] }
  ];
  const commande = n => (reglages.commandes && reglages.commandes[n]) || 'auto';
  const toucheDe = (n, action) => (reglages.touches && reglages.touches[n] && reglages.touches[n][action]) || TOUCHES_DEFAUT[n][action];
  const appuieSur = (n, action) => toucheDe(n, action).some(c => touches.has(c));
  // la souris va au joueur qui l'a choisie ; en Auto, au joueur seul, ou au joueur 2 dans une course à deux
  const sourisPour = (n, duo = !!session && session.type === 'duo') => {
    const c = commande(n), p = n === 0 ? pad : pad2;
    // Le pointeur d'Edge Xbox n'est pas un volant. Sur ordinateur, une manette
    // affectée reste prioritaire même quand ses sticks reviennent au neutre.
    return c === 'souris' || (c === 'auto' && !consoleXbox && !p.manette && (duo ? n === 1 && commande(0) !== 'souris' : n === 0));
  };
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
  function memoriserActionsManette(P, n, p) {
    B.commandesManette.lire(p, configurationsManettes[n], P.entrees);
    for (const action of ACTIONS) P.actions[action] = P.entrees[action] > .5;
    if (p) for (let i = 0; i < p.buttons.length; i++) P.precedent[i] = !!(p.buttons[i]?.pressed || p.buttons[i]?.value > .5);
  }

  function boutonsAnnulationManette(p) {
    const tenu = i => !!(p.buttons[i]?.pressed || p.buttons[i]?.value > .5);
    return Number(tenu(8)) | (Number(tenu(9)) << 1);
  }
  // Les deux manettes peuvent annuler. Seule celle du joueur choisi fournit la nouvelle affectation.
  function noterAnnulationManette(q, p) {
    const ancien = q.autres.get(p.index), boutons = boutonsAnnulationManette(p);
    if (!ancien || ancien.id !== p.id) { q.autres.set(p.index, { id: p.id, boutons }); return false; }
    const front = boutons & ~ancien.boutons;
    ancien.boutons = boutons;
    return front !== 0;
  }

  // Un seul changement de menu par lecture, même si les deux pilotes appuient ensemble.
  function routerManette(nouveau, p) {
    if (navigationManetteTraitee) return;
    if (enCourse() || ecran === 'pause') {
      if (nouveau(9)) { navigationManetteTraitee = true; activerSon(); basculerPause(); return; }
      if (enCourse()) return;
    }
    naviguerManette(nouveau, p);
  }

  // Les choix du menu sont copiés au départ, par place locale et non par identifiant de voiture.
  // Le raccord 03 peut fournir choixTrollLocaux ; les réglages directs restent un repli autonome.
  function configurerTrollLocaux(S) {
    const X = B.expressionsPilote;
    if (!S.expressions || !X?.configurer) return;
    const choix = typeof choixTrollLocaux === 'function' ? choixTrollLocaux() : reglages.trollPilotes;
    for (let n = 0; n < S.locaux.length; n++) {
      // En ligne, le départ fige les préférences négociées ; aucun changement ultérieur du menu
      // ni ordre différent des machines ne doit remplacer la paire acceptée pour cette voiture.
      const c = S.enLigne?.troll?.pilotes?.[S.locaux[n]] || choix?.[n];
      X.configurer(S.expressions, S.locaux[n], { geste: X.normaliserGeste(c?.geste), klaxon: X.normaliserKlaxon(c?.klaxon) });
    }
  }

  // Un front de touche, de bouton ou un clic tactile : aucune répétition quand on maintient la commande.
  // L'animation choisit sa variante et son côté sans toucher à l'état de conduite ni au hasard de la course.
  function provoquer(n = 0) {
    if (!enCourse() || !session?.expressions || (n === 1 && session.type !== 'duo')) return;
    const id = session.locaux?.[n] ?? session.course.joueur.id;
    B.expressionsPilote.demander(session.expressions, id, true);
    B.expressionsPilote.demander(session.expressions, id, false);
  }

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
      if (course || ecran === 'pause') {
        if (ecran === 'pause' && e.code === 'Escape') retourPause(); else basculerPause();
        e.preventDefault();
      }
      else if (e.code === 'Escape') retour();
      return;
    }
    if (!course) return;
    analogique = false;
    if (commande(0) === 'auto' || commande(0) === 'clavier') {
      if (toucheDe(0, 'haut').includes(e.code)) impulsions.haut = true;
      if (toucheDe(0, 'bas').includes(e.code)) impulsions.bas = true;
      if (toucheDe(0, 'vue').includes(e.code)) changerVue();
      if (toucheDe(0, 'troll').includes(e.code)) provoquer(0);
    }
    if (session && session.type === 'duo' && (commande(1) === 'auto' || commande(1) === 'clavier')) {
      if (toucheDe(1, 'haut').includes(e.code)) impulsions2.haut = true;
      if (toucheDe(1, 'bas').includes(e.code)) impulsions2.bas = true;
      if (toucheDe(1, 'vue').includes(e.code)) changerVue2();
      if (toucheDe(1, 'troll').includes(e.code)) provoquer(1);
    }
    if (lettre === 'm') couperSon();
    if (lettre === 'r' && !aDeux()) replacer();
  });
  addEventListener('keyup', e => touches.delete(e.code));
  // Souris (David, 16/11 : « ou alors souris aussi, comme le vrai Vroom », refaite ici) : le pointeur à gauche ou à
  // droite du milieu de l'écran tourne le volant (plein braquage à 30 % de la largeur), bouton gauche : gaz, droit :
  // frein, milieu ou latéraux : dérive, molette : rapports. En Auto, elle compte après un clic en course.
  const boutonsSouris = e => { souris.gaz = !!(e.buttons & 1); souris.frein = !!(e.buttons & 2); souris.derive = !!(e.buttons & 28); };
  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || !enCourse()) return;
    if (e.target?.closest?.('button, input, select, a, [role="button"]')) return;
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
    if (document.hidden) { arreterManettes(); relacherTactile(); viderStock(); suspendreAnnoncesVirages(); }   // un onglet masqué peut être tué sans autre avis
    if (pauseAuto && document.hidden && enCourse()) basculerPause(true);
    if (document.hidden && son) son.couperRaclements();
    if (son) son.musique(!document.hidden && ecran === 'titre'); // onglet caché : le minuteur du thème serait bridé
  });
  addEventListener('gamepaddisconnected', ev => {
    for (let n = 0; n < vibrations.length; n++) {
      const o = vibrations[n].sortie;
      if (o.pad && o.pad.index === ev.gamepad.index && o.pad.id === ev.gamepad.id) {
        arreterVibrations(n);
        B.vibrations.affecter(o, null);
      }
    }
  });
  addEventListener('focus', oublierIntervalle);
  addEventListener('pagehide', () => { arreterManettes(); viderStock(); suspendreAnnoncesVirages(); });   // page fermée ou rechargée : la file part avant
  addEventListener('pointerdown', activerSon, { passive: true });
  // Gestes : ils remettent à zéro l'attente de la démo sur l'écran titre ; pendant la démo, le premier ramène au
  // titre et ne compte pas comme un clic sur le menu qui revient.
  let dernierGeste = performance.now(), avalerJusque = 0;
  // Edge Xbox peut émettre des clics depuis son pointeur. Une entrée manette
  // récente garde le focus et évite une double validation. Les clics du menu
  // à la manette sont programmatiques ; la souris reste disponible au repos.
  function filtrerPointeurConsole(e) {
    if (!consoleXbox || !e.isTrusted || e.pointerType && e.pointerType !== 'mouse' || e.type === 'click' && !e.detail) return;
    let signal = performance.now() - dernierSignalManette < 450;
    if (!signal) try {
      const liste = navigator.getGamepads?.() || [];
      for (const p of liste) if (p?.connected && (p.buttons.some(b => b?.pressed || b?.value > .25) || Math.abs(p.axes[0] || 0) > .25 || Math.abs(p.axes[1] || 0) > .25)) { signal = true; break; }
    } catch (_) { /* le pointeur reste utilisable si l'API est indisponible */ }
    if (signal) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
  for (const type of ['pointerdown', 'pointerup', 'click']) addEventListener(type, filtrerPointeurConsole, { capture: true });
  addEventListener('pointerdown', e => {
    dernierGeste = performance.now();
    if (ecran === 'demo') { activerSon(); e.preventDefault(); e.stopPropagation(); sortirDemo(); }
  }, { capture: true });
  addEventListener('click', e => { if (performance.now() < avalerJusque) { e.preventDefault(); e.stopPropagation(); } avalerJusque = 0; }, { capture: true });
  addEventListener('pointermove', () => { if (ecran === 'titre') dernierGeste = performance.now(); }, { capture: true, passive: true });
  addEventListener('wheel', () => { dernierGeste = performance.now(); if (ecran === 'demo') sortirDemo(); }, { capture: true, passive: true });

  function lireManette() {
    navigationManetteTraitee = false;
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
    if (captureManette) {
      pad.manette = p1; pad2.manette = p2;
      lireCaptureManette(connectees);
      if (!captureManette) B.navigationMenu?.initialiser?.($('reglages'));
      memoriserActionsManette(pad, 0, p1); memoriserActionsManette(pad2, 1, p2);
      pad.gaz = pad.frein = pad.volant = pad2.gaz = pad2.frein = pad2.volant = 0;
      pad.derive = pad2.derive = pad.actif = false;
      return;
    }
    if (duoJeu || pad2.manette) lireManette2(p2);
    const p = p1;
    const change = (ancienne?.index ?? -1) !== (p?.index ?? -1) || ancienne?.id !== p?.id;
    pad.manette = p;
    if (change) {
      // Une manette perdue ne relâche pas une dérive chargée en déclenchant un turbo involontaire.
      // Seul l'état auquel ses commandes ont été appliquées compte ; une nouvelle séance reste intacte.
      const clavier = commande(0) === 'auto' || commande(0) === 'clavier';
      if (ancienne && etatDerive === session?.course?.joueur?.etat && etatDerive?.derive?.actif &&
          !doigt.derive && !(clavier && appuieSur(0, 'derive')) && !(souris.active && sourisPour(0) && souris.derive))
        B.conduite.annulerDerive(etatDerive, true);
      pad.precedent.length = 0; pad.deriveEtat = null;
      if (session) session.regardArriere = false;
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
      const entrees = B.commandesManette.lire(p, configurationsManettes[0], pad.entrees);
      if (change) for (const action of ACTIONS) pad.actions[action] = entrees[action] > .5;
      const nouvelleAction = action => entrees[action] > .5 && !pad.actions[action];
      pad.volant = entrees.volant; pad.gaz = entrees.gaz; pad.frein = entrees.frein; pad.derive = entrees.derive > .5;
      if (p.buttons.some(x => x?.pressed || x?.value > .25) || p.axes.some(x => Math.abs(x) > .25)) dernierSignalManette = performance.now();
      if (Math.abs(pad.volant) > .1 || pad.gaz > .1 || pad.frein > .1) compteurVisites?.activite();
      const accepte = commande(0) === 'auto' || commande(0) === 'manette';
      if (enCourse() && ecran === ecranLecture && accepte && !nouveau(9)) {
        if (nouvelleAction('haut')) impulsions.haut = true;
        if (nouvelleAction('bas')) impulsions.bas = true;
        if (nouvelleAction('vue')) changerVue();
        if (nouvelleAction('troll')) provoquer(0);
      }
      // Si J2 vient de changer d'écran, consommer aussi les fronts de J1 sans agir une seconde fois.
      if (ecran === ecranLecture) routerManette(nouveau, p);
      for (let i = 0; i < p.buttons.length; i++) pad.precedent[i] = appuye(i);
      for (const action of ACTIONS) pad.actions[action] = entrees[action] > .5;
      if (accepte && (Math.abs(pad.volant) > .05 || pad.gaz > .05 || pad.frein > .05)) { pad.actif = true; analogique = true; activerSon(); }
      return;
    }
  }

  // Vibrations de manette (David, 14/11 puis 22/11). Une synthèse et une sortie matérielle par pilote local.
  const VIB_EVENEMENTS = 64;
  const VIB_ATTERRISSAGE = Object.freeze({ type: 'atterrissage', force: 0 });
  function etatVibrations() {
    return { V: B.vibrations.creer(), sortie: B.vibrations.creerSortie(), actif: false, pasRecu: false, evenements: [], entree: {} };
  }
  const vibrations = [etatVibrations(), etatVibrations()];
  let vibreImage = false;
  function arreterVibrations(n) {
    B.vibrations.arreter(vibrations[n].sortie);
    calmerVibrations(n);
  }
  function arreterManettes() { vibreImage = false; arreterVibrations(0); arreterVibrations(1); }
  function synchroniserVibrations(n) {
    const J = vibrations[n];
    if (B.vibrations.affecter(J.sortie, (n ? pad2 : pad).manette)) calmerVibrations(n);
    return J;
  }
  // Événements d'un pas qui touchent la voiture id, gardés pour l'image : la réception d'un saut devient l'atterrissage
  // du module. Le tableau est vidé à chaque image rendue ; la borne ne sert qu'aux pas sans image (outils).
  function retenirVibrations(n, ev, id) {
    const J = synchroniserVibrations(n), liste = J.evenements;
    J.pasRecu = true;
    for (let i = 0; i < ev.length && liste.length < VIB_EVENEMENTS; i++) {
      const e = ev[i], type = e.type;
      if (type === 'contact' ? e.a !== id && e.b !== id : e.id !== id) continue;
      if (type === 'choc' || type === 'contact' || type === 'roue' || type === 'casse' || type === 'rapport') liste.push(e);
      else if (type === 'reception') liste.push(VIB_ATTERRISSAGE);
    }
  }
  // Voiture replacée en piste : ni événement de l'image ni pic d'un choc antérieur ne la suivent.
  function calmerVibrations(n) {
    const J = vibrations[n];
    J.evenements.length = 0;
    if (J.actif) J.V = B.vibrations.creer();
    J.actif = false; J.pasRecu = false;
  }
  function majVibrations(S, dt, t) {
    // Le réseau peut rendre des images du classement ou de la pause sans avancer la simulation.
    if (!vibreImage || !manetteVibre(false)) { arreterManettes(); return; }
    const co = S.course, PR = B.conduite.PARAMS;
    for (let n = 0; n < 2; n++) {
      const J = synchroniserVibrations(n);
      const mode = commande(n), force = clamp(reglages.vibrationForce != null ? +reglages.vibrationForce : .5, 0, 1);
      const v = n === 0 ? co.joueur : S.type === 'duo' ? co.voitures[S.locaux[1]] : null;
      if (!J.pasRecu || !v || !force || (mode !== 'auto' && mode !== 'manette') || !J.sortie.routes[J.sortie.route]) {
        arreterVibrations(n); continue;
      }
      const et = v.etat, ph = et._physx, e = J.entree;
      J.actif = true;
      e.regime = et.regime; e.ralenti = PR.ralenti; e.maxUtile = PR.maxUtile; e.gaz = et.gaz; e.v = et.v;
      e.auSol = ph ? ph.groundCount > 0 : !(et.bond > .03);
      e.surface = et.surface;
      // Une seule roue chargée suffit à sentir les dents, même si les trois autres restent sur l'asphalte.
      e.vibreur = ph ? false : et.vibreur;
      if (ph && e.auSol) for (const roue of ph.contacts) {
        if (roue.load > 0 && roue.surface === 'vibreur') { e.vibreur = true; break; }
      }
      e.patinage = et.patinage; e.blocage = et.blocage; e.glisseAr = et.glisseAr; e.glisseAv = et.glisseAv; e.derive = et.derive;
      e.force = force;
      e.evenements = J.evenements;
      const s = B.vibrations.calculer(J.V, e, dt);
      J.evenements.length = 0;
      B.vibrations.envoyer(J.sortie, s, t);
    }
  }


  // Météo et pluie projetée : les secondes viennent du rendu, zéro pendant une pause.
  function majMeteo(S, dt) { return B.meteo.avancer(S, dt); }
  // L'eau appartient à chaque voiture, pas à la caméra. Un seul pas avant J2/J1 et les rétros.
  function majEauCarrosserie(S, poses, dt, meteo) {
    if (!B.eauCarrosserie) return;
    if (dt > 0 && Number.isFinite(dt)) S.eauCarrosserieTemps += dt;
    const point = S.eauCarrosseriePoint;
    for (let k = 0; k < S.modeles.length; k++) {
      const p = poses[k], etat = S.modeles[k].eauCarrosserie;
      if (!etat || !p) continue;
      point[0] = p.x; point[1] = p.y + .65; point[2] = p.z;
      B.eauCarrosserie.mettreAJour(etat, dt, meteo, S.course.voitures[k].etat.v,
        sousLaVoute(S.course.c, point), S.eauCarrosserieTemps, p);
    }
  }
  function poserEauCarrosserie(S, k, ev, sortie, detail, overlay, matrice, distance2, tanDemi, hauteur, palierVue) {
    const E = B.eauCarrosserie, etat = S.modeles[k].eauCarrosserie;
    if (!E || !etat) return;
    const lod = E.detailPour(distance2, tanDemi, hauteur, detail, palierVue);
    E.ajouter(sortie, ev, etat, lod, overlay, matrice);
  }
  let pluieVue = null, pluieVue2 = null, vitreVue = null, vitreVue2 = null;
  const projectionsPluie = [{}, {}];
  const SANS_PLUIE_PROJETEE = { pluie: 0 };
  const ambiancePublic = () => ({ pluie: 0, neige: 0, mouille: 0, feux: 0, vert: false, termine: false });
  function precipitationsNeige(S) {
    if (!S.nature || (S.saisonLocale || S.nature.saison)?.theme === 'cote') return 0;
    if (typeof S.meteo.precipitationsNeige === 'boolean') return S.meteo.precipitationsNeige ? S.meteo.pluie || 0 : 0;
    return (S.meteo.reel ? S.meteo.neige : S.nature.saison && S.nature.saison.neige) ? S.meteo.pluie || 0 : 0;
  }
  function dessinerMeteo(S, dt, cam, vue, profil, suivie) {
    // à deux, les gouttes du joueur 2 tombent sur sa moitié (toile #meteo2)
    const deux = S !== session;
    if (deux && !pluieVue2) pluieVue2 = creationTardive('pluie', B.meteo.creerPluie($('meteo2')));
    if (!deux && !pluieVue) pluieVue = creationTardive('pluie', B.meteo.creerPluie($('meteo')));
    const abri = sousLaVoute(S.course.c, cam.pos) || B.meteo.abriCouverts(S.course.c, cam.pos, S.course.physique), neige = precipitationsNeige(S);
    if (B.vitre) {
      if (deux && !vitreVue2) vitreVue2 = creationTardive('vitre', B.vitre.creer($('vitre2'), { graine: 2 }));
      if (!deux && !vitreVue) vitreVue = creationTardive('vitre', B.vitre.creer($('vitre')));
      const contexte = S.vitreContexte || (S.vitreContexte = creationTardive('contexteVitre', {}));
      contexte.pluie = neige > 0 ? 0 : S.meteo.pluie || 0; contexte.neige = neige;
      contexte.ventX = S.meteo.ventX || 0; contexte.ventY = S.meteo.ventY || 0; contexte.ventZ = S.meteo.ventZ || 0;
      const voiture = suivie || S.course.voitures[S.suivie || 0] || S.course.joueur;
      contexte.vitesse = voiture.etat.v || 0; contexte.qualite = profil.palier;
      contexte.cameraYaw = cam.yaw || 0; contexte.cameraPitch = cam.pitch || 0; contexte.cameraRoll = cam.roll || 0;
      // La visière et la lentille de poursuite suivent le déplacement réel du support, y compris
      // dérive et marche arrière. Une coupe, un regard arrière ou un replacement de caméra ne
      // deviennent pas une vitesse artificielle : aucune dérivée des positions de caméra ici.
      const mouvement = voiture.etat._physx?.velocity;
      if (mouvement && Number.isFinite(mouvement[0]) && Number.isFinite(mouvement[1]) && Number.isFinite(mouvement[2])) {
        contexte.vitesseX = mouvement[0]; contexte.vitesseY = mouvement[1]; contexte.vitesseZ = mouvement[2];
      } else {
        // Modèle classique : v est en plan et le tangage contient le transfert de charge visuel.
        // Ses deux poses physiques au pas fixe donnent le vrai déplacement, pente et saut compris.
        // synchroniserReplacement les égalise déjà lors d'un retour en piste ; les coupes caméra
        // et la cadence d'affichage ne participent jamais à cette différence.
        const pose = S.cour?.[voiture.id], precedente = S.prec?.[voiture.id];
        const dx = pose?.x - precedente?.x, dy = pose?.y - precedente?.y, dz = pose?.z - precedente?.z;
        if (Number.isFinite(dx) && Number.isFinite(dy) && Number.isFinite(dz)) {
          contexte.vitesseX = dx / DT; contexte.vitesseY = dy / DT; contexte.vitesseZ = dz / DT;
        } else {
          // Contexte ancien sans historique physique : seule la vitesse horizontale est connue.
          const direction = (Number.isFinite(pose?.cap) ? pose.cap : contexte.cameraYaw - Math.PI / 2) - (voiture.etat.beta || 0);
          contexte.vitesseX = contexte.vitesse * Math.cos(direction); contexte.vitesseY = 0;
          contexte.vitesseZ = contexte.vitesse * Math.sin(direction);
        }
      }
      contexte.pause = ecran === 'pause' || (ecran === 'reglages' && retourReglages === 'pause');
      // Toutes les vues de conduite gardent leur lentille et leur vrai axe avant/arrière.
      contexte.actif = (ecran === 'course' || ecran === 'demo' || contexte.pause) && (VUES_COURSE.includes(vue) || vue === 'aileron' || vue === 'roue' || vue === 'arriere');
      contexte.intensite = reglages.gouttes; contexte.cockpit = vue === 'cockpit'; contexte.abri = abri;
      contexte.dpr = window.devicePixelRatio || 1;
      // rendreVue vient de dessiner cette caméra : en duo, la source contient encore J2 avant la copie scene2,
      // puis J1 à son tour. La visière capture sa propre image, sans getImageData ni readPixels.
      contexte.sourceScene = $('scene');
      contexte.embruns = contexte.actif && contexte.intensite > 0 && profil.palier !== 'off' && !abri && neige === 0 && B.sillage && B.sillage.exposition
        ? B.sillage.exposition(session.sillage, cam.pos, Math.max(S.meteo.mouille || 0, S.meteo.pluie || 0), voiture.id) : 0;
      const vitre = deux ? vitreVue2 : vitreVue;
      B.vitre.mettreAJour(vitre, dt, contexte);
    }
    // L'averse existe dans le monde, y compris au-delà d'un portail. L'intensité de
    // la visière règle seulement l'eau qui s'attache à la caméra de ce joueur.
    const projection = projectionsPluie[deux ? 1 : 0];
    projection.cockpit = vue === 'cockpit'; projection.dpr = window.devicePixelRatio || 1;
    projection.palier = profil.palier; projection.circuit = S.course.c; projection.physique = S.course.physique;
    S.pluieImage = (deux ? pluieVue2 : pluieVue).dessiner(neige > 0 ? SANS_PLUIE_PROJETEE : S.meteo, cam, dt, projection);
  }

  // Dans les menus, A valide et Select/View revient. B reste une commande de conduite affectable.
  function naviguerManette(nouveau, manette = pad.manette) {
    if (navigationManetteTraitee || captureManette || enCourse()) return;
    const zone = $(ecran); if (!zone || zone.hidden) return;
    if (captureTouche) {
      if (nouveau(8) || nouveau(9)) { navigationManetteTraitee = true; retour(); }
      return;
    }
    if (ecran === 'preparation' && !nouveau(8) && !nouveau(9) && (nouveau(6) || nouveau(7))) {
      const categories = $('p-categories');
      if (categories?._decaler && !$('p-piste').hidden) {
        navigationManetteTraitee = true; categories._decaler(nouveau(6) ? -1 : 1); return;
      }
    }
    navigationManetteTraitee = B.navigationMenu.naviguer(zone, nouveau, { pad: manette, temps: performance.now(), activer: activerSon,
      retour: () => ecran === 'pause' ? retourPause() : retour(),
      demarrer: ecran === 'titre' ? () => { modePrepa = manette === manettes[1] ? 'duo' : 'course'; aller('preparation'); }
        : ecran === 'preparation' ? () => { const b = $('b-depart'); if (b && !b.disabled) b.click(); } : null,
      valider: el => ecran === 'preparation' && menuArcade.valider(el) });
  }

  // Les manettes supplémentaires naviguent aussi avant la course, sans prendre une affectation de conduite.
  // Les appareils déjà lus comme J1/J2 sont exclus : aucun front ne se traite deux fois.
  const suivisManettesMenu = new Map();
  function lireAutresManettesMenu(consommer = false) {
    const menus = ['titre', 'championnat', 'preparation', 'reglages', 'enligne', 'prets', 'pause', 'resultats'];
    if (document.hidden || !menus.includes(ecran) || captureManette) { suivisManettesMenu.clear(); return; }
    const presentes = new Set();
    for (const p of manettes) {
      if (p === pad.manette || p === pad2.manette) continue;
      presentes.add(p.index);
      let suivi = suivisManettesMenu.get(p.index);
      const appuye = i => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > .5));
      if (!suivi || suivi.id !== p.id) {
        suivi = { id: p.id, boutons: p.buttons.map((_, i) => appuye(i)) };
        suivisManettesMenu.set(p.index, suivi);
      }
      const nouveau = i => appuye(i) && !suivi.boutons[i];
      if (ecran === 'titre' && (p.buttons.some((_, i) => appuye(i)) || p.axes.some(a => Math.abs(a) > .5))) dernierGeste = performance.now();
      if (!consommer) naviguerManette(nouveau, p);
      for (let i = 0; i < p.buttons.length; i++) suivi.boutons[i] = appuye(i);
    }
    for (const i of suivisManettesMenu.keys()) if (!presentes.has(i)) suivisManettesMenu.delete(i);
  }

  // Deuxième manette : mêmes rapports et protection de dérive que pour le joueur 1 ; son clavier reste indépendant.
  function lireManette2(p) {
    const ancienne = pad2.manette, etatDerive = pad2.deriveEtat;
    const change = (ancienne?.index ?? -1) !== (p?.index ?? -1) || ancienne?.id !== p?.id;
    pad2.manette = p;
    if (change) {
      // En ligne, le deuxième pilote local peut conduire une autre voiture que la n° 1. Ne toucher qu'à la
      // dérive réellement commandée par cette manette, sauf si son clavier ou sa souris la maintient encore.
      const etatJ2 = session?.course?.voitures?.[session?.locaux?.[1]]?.etat;
      const clavier = commande(1) === 'auto' || commande(1) === 'clavier';
      if (ancienne && etatDerive === etatJ2 && etatDerive?.derive?.actif &&
          !(clavier && appuieSur(1, 'derive')) && !(souris.active && sourisPour(1) && souris.derive))
        B.conduite.annulerDerive(etatDerive, true);
      pad2.precedent.length = 0; pad2.deriveEtat = null;
      if (session?.vueJ2) session.vueJ2.regardArriere = false;
    }
    pad2.manette = p; pad2.volant = pad2.gaz = pad2.frein = 0; pad2.derive = false;
    if (!p) { pad2.precedent.length = 0; return; }
    const b = i => p.buttons[i] ? (p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0)) : 0, appuye = i => b(i) > .5, nouveau = i => appuye(i) && !pad2.precedent[i];
    if (change) for (let i = 0; i < p.buttons.length; i++) pad2.precedent[i] = appuye(i);
    const entrees = B.commandesManette.lire(p, configurationsManettes[1], pad2.entrees);
    if (change) for (const action of ACTIONS) pad2.actions[action] = entrees[action] > .5;
    const nouvelleAction = action => entrees[action] > .5 && !pad2.actions[action];
    pad2.volant = entrees.volant; pad2.gaz = entrees.gaz; pad2.frein = entrees.frein; pad2.derive = entrees.derive > .5;
    if (p.buttons.some(x => x?.pressed || x?.value > .25) || p.axes.some(x => Math.abs(x) > .25)) dernierSignalManette = performance.now();
    if (Math.abs(pad2.volant) > .1 || pad2.gaz > .1 || pad2.frein > .1) compteurVisites?.activite();
    if (ecran === 'course' && !nouveau(9)) {
      if (nouvelleAction('haut')) impulsions2.haut = true;
      if (nouvelleAction('bas')) impulsions2.bas = true;
      if (nouvelleAction('vue')) changerVue2();
      if ((commande(1) === 'auto' || commande(1) === 'manette') && nouvelleAction('troll')) provoquer(1);
    }
    routerManette(nouveau, p);
    for (let i = 0; i < p.buttons.length; i++) pad2.precedent[i] = appuye(i);
    for (const action of ACTIONS) pad2.actions[action] = entrees[action] > .5;
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
  if (consoleXbox) {
    $('aide-console').hidden = false;
    for (const aide of document.querySelectorAll('.aide-xbox')) aide.hidden = false;
  }
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
    $('t-troll').addEventListener('click', () => provoquer(0));
    $('b-pause').addEventListener('click', () => basculerPause());
  })();

  // Même affectation que la course préparée : en solo, le premier pad va à J1.
  function entreeDe(n, duo = true) {
    const c = commande(n), ms = duo ? assigner(manettes) : [manettes[0] || null, null];
    const m = c === 'auto' || c === 'manette' ? ms[n] : null, codes = ['gaz', 'gauche', 'frein', 'droite'].map(a => toucheDe(n, a)[0]);
    const texteClavier = codes.every(k => /^Numpad\d$/.test(k || '')) ? 'pavé numérique (' + codes.map(k => k.slice(6)).join(' ') + ')' : 'clavier (' + codes.map(nomTouche).join(' ') + ')';
    const morceaux = [];
    if (m) morceaux.push('manette');
    else if (c === 'manette') morceaux.push('manette (non détectée)');
    if (c === 'auto' || c === 'clavier') morceaux.push(texteClavier);
    if (sourisPour(n, duo) && (c === 'souris' || !m)) morceaux.push('souris');
    return morceaux.join(' ou ') || 'rien';
  }
  function changerVue2() {
    reglerVue(1, VUES_COURSE[(VUES_COURSE.indexOf(reglages.vue2) + 1) % VUES_COURSE.length]);
  }
  function changerVue() {
    reglerVue(0, VUES_COURSE[(VUES_COURSE.indexOf(reglages.vue) + 1) % VUES_COURSE.length]);
  }
  function reglerVue(n, vue) {
    if (!VUES_COURSE.includes(vue)) return false;
    reglages[n ? 'vue2' : 'vue'] = vue;
    const S = n ? session && session.vueJ2 : session;
    if (S) {
      if (B.cameraTransition && S.camera && !S.reference && !S.regardArriere) {
        const ct = S.camTransition || (S.camTransition = B.cameraTransition.creer());
        const ps = S.poseSuivie;
        B.cameraTransition.demander(ct, S.camera, {
          instantane: reglages.secousses === 0,
          carPos: ps ? [ps.x, ps.y, ps.z] : null,
          carCap: ps ? ps.cap : undefined
        });
      }
      S.camCap = null; S.tete = null; S.regardArriere = false;
    }
    sauverReglages();
    return true;
  }

  // ---------------------------------------------------------------- son
  let sonActif = false, muet = false;
  const voixVirages = B.virages.creerVoix();
  function activerSon() {
    if (!son) return;
    son.demarrer();
    if (!sonActif) { sonActif = true; appliquerVolumes(); son.musique(ecran === 'titre'); }
  }
  function appliquerVolumes() {
    if (muet || !(reglages.general * reglages.effets > 0)) voixVirages.annuler();
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
  function manetteVibre(auto) { return !auto && reglages.vibrations === 'oui' && ecran === 'course' && !document.hidden; }

  function pasSimulation(S, pilote) {
    if (B.meteo) B.meteo.actuel = S.meteo;
    const co = S.course;
    const auto = S.type === 'vitrine' || S.type === 'demo' || pilote || pilotageAuto;
    let cmd;
    if (S.type === 'duo') { const [a, b] = S.locaux; cmd = []; cmd[a] = auto ? B.course.commandesIA(co, co.voitures[a]) : commandesJoueur(); cmd[b] = auto ? B.course.commandesIA(co, co.voitures[b]) : commandesJoueur2(); }
    else cmd = auto ? B.course.commandesIA(co, co.joueur) : commandesJoueur();
    const ev = B.course.pas(co, cmd, DT);
    if (S.enLigne) actualiserPneusDistants(S, DT);
    // Le réseau avance aussi sous la pause. Garder la lecture à jour évite un raclement périmé à la reprise.
    if (son && sonActif && S.type !== 'vitrine') {
      const v = S.type === 'demo' ? co.voitures[S.suivie] : co.joueur;
      B.son.suivreRaclement(S.raclement, v?.etat._physx, co.horloge);
      if (S.vueJ2) B.son.suivreRaclement(S.vueJ2.raclement, co.voitures[S.locaux[1]].etat._physx, co.horloge);
    }
    // vibration manette : le pilote la sent passer dans ses mains — le moteur selon les tours, la route, les
    // vibreurs, l'herbe, le patinage, la glisse et les chocs ; la main reste calme si le réglage est à « non ».
    // Les événements du pas sont retenus pour l'image (majVibrations), à deux pour chaque joueur et sa voiture.
    const vibre = manetteVibre(auto);
    vibreImage = vibre;
    if (vibre) {
      retenirVibrations(0, ev, co.joueur.id);
      if (S.type === 'duo') retenirVibrations(1, ev, S.locaux[1]);
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
    // les betes lisent les voitures à chaque pas ; leur cerveau n'avance qu'aux instants k × 0,1 s de l'horloge de
    // course, sans tirer sur le hasard de la course
    if (S.animaux && reglages.faune !== 'off') B.animaux.pas(S.animaux, co.horloge, S.cour);
    synchroniserReplacement(S, ev);
    const tFx = S.banc ? performance.now() : 0;
    B.traces.pas(S.fx, co, S.cour, S.suivie || 0, DT, ev);
    if (S.ech) B.echappement.pas(S.ech, co.voitures, co.horloge);
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
          if (son) son.evenement(e.type, e, S.raclement);
          if (e.type === 'choc') S.secousse = Math.min(1, (S.secousse || 0) + Math.max(0, e.force - 2) * .07);
      }
    }
  }

  function annoncerRecuperation(e, qui) {
    if (e.type === 'retour' && e.repositionnement) message('Replacé', '', true, qui);
    else if (e.type === 'roue' || e.type === 'casse' || e.type === 'tonneau') message('Retour en piste', 'ambre', true, qui);
  }

  function traiter(S, ev) {
    const co = S.course, j = co.joueur, V2 = S.vueJ2;
    if (V2) for (const e of ev) {
      const id2 = S.locaux[1];
      if (e.type === 'contact' && (e.a === id2 || e.b === id2)) V2.secousse = Math.min(1, V2.secousse + Math.max(0, e.force - 2) * .07);
      else if (e.id !== id2) continue;
      else if (e.type === 'choc') {
        if (son && B.son.matiereRaclement(e.obstacle)) son.evenement('choc', e, V2.raclement);
        V2.secousse = Math.min(1, V2.secousse + Math.max(0, e.force - 2) * .07); if (e.force > 18) V2.eclair = Math.min(.9, (e.force - 18) * .07); }
      else if (e.type === 'tonneau' || e.type === 'casse') { V2.secousse = 1; V2.eclair = .7; }
    }
    // en ligne : chacun annonce le temps officiel de sa voiture, l'hôte aussi ceux des rivaux ; un temps officiel reçu
    // remplace celui mesuré ici sur les états reçus (même classement au millième sur les deux machines)
    if (S.enLigne && EL.R) {
      let annonceStand;
      for (const e of ev) {
        if (e.type === 'stand' && !co.voitures[e.id].distant) {
          if (e.phase === 'repare') annonceStand = 'pneus-service';
          else annonceStand ??= 'pneus-etat';
        } else if (e.type === 'tour' && co.voitures[e.id].joueur) EL.R.envoyer({ t: 'tour', id: e.id, tour: e.tour, temps: e.temps });
        else if (e.type === 'arrivee') {
          const v = co.voitures[e.id];
          if (v.joueur || (S.enLigne.role === 'hote' && (!v.humain || v.reprise))) EL.R.envoyer({ t: 'arrivee', id: v.id, temps: v.tempsFinal, tours: v.tours });
          else if (v.tempsOfficiel != null) v.tempsFinal = v.tempsOfficiel;
        }
      }
      if (annonceStand) envoyerPneusReseau(S, true, annonceStand);
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
          if (e.id !== j.id) {
            if (V2 && e.id === S.locaux[1]) annoncerRecuperation(e, 1);
            break;
          }
          annoncerRecuperation(e, 0);
          if (son) son.evenement(e.type, e, S.raclement);
          if (e.type === 'choc') { S.secousse = Math.min(1, (S.secousse || 0) + Math.max(0, e.force - 2) * .07); if (e.force > 18) S.eclair = Math.min(.9, (e.force - 18) * .07); }
          else if (e.type === 'reception') S.secousse = Math.min(1, (S.secousse || 0) + Math.max(0, (e.force || 0) - 2) * .12);
          else if (e.type === 'tonneau' || e.type === 'casse') { S.secousse = 1; S.eclair = .7; }
          else if (e.type === 'roue') S.eclair = .5;
          else if (e.type === 'retour' && e.repositionnement) { S.secousse = 0; S.eclair = 0; S.bloque = 0; S.contresens = 0; }
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
    if (!S.essai && e.valide !== false && B.records && recordsEnrichis) {
      B.records.enregistrer(recordsEnrichis, {
        circuitId: id, sens: 'normal', mode: co.mode,
        boite: reglages.boite === 'manuelle' ? 'manuelle' : 'auto', versionPhysique: PHYSIQUE
      }, { tourMs: Math.round(e.temps * 1000) });
      differerStock(B.records.STORAGE_KEY, () => B.records.courants(recordsEnrichis));
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
      if (S.contresens > 1.2 && !S.avertiContresens) {
        if (!et.stands && !et.recuperation && !j.abandon) message('Contresens', 'rouge', true, 0);
        S.avertiContresens = true;
      }
      if (S.contresens < .2) S.avertiContresens = false;
      const coince = !et.recuperation && et.rapport >= 0 && et.v >= 0 && ((et.v < 1.5 && et.gaz > .5) || (Math.cos(et.psi) < -.5 && et.v < 3));
      S.bloque = coince ? S.bloque + DT : 0;
      if (S.bloque > 3) { replacer(); S.bloque = 0; }
      // Sortie prolongée derrière une glissière/muret : retour automatique fiable sur la chaussée
      const demi = (co.c.largeur || 12) * 0.5;
      const horsCircuit = !et.recuperation && !et.stands && Math.abs(et.d) > demi + 5.5;
      S.horsPiste = horsCircuit ? (S.horsPiste || 0) + DT : 0;
      if (S.horsPiste > 2.2) { replacer(); S.horsPiste = 0; }
    }
  }

  function replacer() {
    const S = session; if (!S) return;
    const co = S.course, ev = B.course.replacer(co);
    // Téléportation PhysX synchrone immédiate (ne jamais rester bloqué hors du circuit)
    if (co.physique && B.physique && B.physique.replacerVoiture) B.physique.replacerVoiture(co, co.joueur);
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
  const EL = { R: null, role: null, recus: new Map(), corr: new Map(), pasEnvoi: 0, pred: {}, vieux: {}, course: null, pneusDe: new Map(), trollDe: new Map(),
    numeroSeance: 0, seanceAcceptee: null, dernierDepart: -Infinity };
  const VERSION_CHOIX_PNEUS = 2, VERSION_PNEUS_RESEAU = 1;
  // Empreinte des sources du build, incluant catalogue, générateur, limites et collisions : même piste, même jeu.
  const REVISION_PISTES = '__REVISION_PISTES__';
  function contratPiste(i) {
    return Number.isInteger(i) && CATALOGUE[i] ? { id: CATALOGUE[i].id, revision: REVISION_PISTES, physique: PHYSIQUE } : null;
  }
  function compatiblePneusReseau(k) {
    const piste = k && contratPiste(k.i);
    return !!(piste && k.versionChoixPneus === VERSION_CHOIX_PNEUS && k.protocolePneus === VERSION_PNEUS_RESEAU &&
      k.piste && k.piste.id === piste.id && k.piste.revision === piste.revision && k.piste.physique === piste.physique);
  }
  function identiteSeanceValide(s) { return typeof s === 'string' && s.length > 0 && s.length <= 128; }
  const nomPilote = () => (reglages.nom || '').trim().slice(0, 16) || 'Pilote';
  const joueursIci = () => reglages.joueursLocaux === 2 ? 2 : 1;
  const propre = t => String(t || '').replace(/[<>&"'`\\]/g, '').trim().slice(0, 16) || 'Pilote';
  function etatEnLigne(t) { texte($('l-etat'), t); }
  const lienActif = () => !!(EL.R && EL.R.etat === 'connecte');
  let parcoursSalon = null, connexionSalon = false, dernierChoixSalon = 'creer';
  function fermerLiaisonSalon() {
    const R = EL.R;
    annulerConfirmation(); EL.course = null; EL.pneusDe.clear(); EL.trollDe.clear();
    EL.R = null; EL.role = null; connexionSalon = false;
    if (R) R.fermer();
  }
  function quitterEnLigne() {
    fermerLiaisonSalon(); parcoursSalon = null;
    etatEnLigne(''); aller('titre');
  }
  function retourSalon() {
    if (!connexionSalon && !parcoursSalon && !EL.role) { quitterEnLigne(); return; }
    const enCours=connexionSalon;
    fermerLiaisonSalon();
    if (!enCours) parcoursSalon=null;
    etatEnLigne(''); majSalon(true);
  }
  function ouvrirParcoursSalon(choix) {
    parcoursSalon=choix; dernierChoixSalon=choix;
    etatEnLigne(''); majSalon(true);
  }
  // pilotes de la partie, dans l'ordre des machines (voitures humaines 0 à 3) ; « prets » : l'hôte et les machines liées
  function pilotesSalle(R, prets) {
    const p = [];
    for (const m of [...R.membres].sort((a, b) => a.id - b.id)) {
      if (prets && m.id !== R.id && !R.pretAvec(m.id)) continue;
      for (let k = 0; k < (m.joueurs === 2 ? 2 : 1); k++) p.push({ nom: propre(m.nom) + (k ? ' 2' : ''), machine: m.id, local: k });
    }
    return p;
  }
  // l'écran du salon : choix créer / rejoindre sans partie, sinon le code, la liste des machines et l'état
  function majSalon(focus=false) {
    const R = EL.R, ouvert = !!(R && R.etat !== 'ferme' && EL.role), actif = lienActif();
    const page=ouvert ? 'salle' : connexionSalon ? 'connexion' : parcoursSalon || 'choix';
    const creer=page==='creer', rejoindre=page==='rejoindre';
    const titres={choix:'En ligne',creer:'Créer une partie',rejoindre:'Rejoindre une partie',connexion:'Connexion',salle:'Salon de la partie'};
    texte($('l-titre'),titres[page]);
    texte($('l-aide'),creer ? 'Partagez le code avec les autres pilotes une fois la partie créée.' :
      rejoindre ? 'Entrez les quatre lettres communiquées par l’hôte.' : page==='choix' ? 'De deux à quatre pilotes, jusqu’à deux par machine.' : '');
    $('l-aide').hidden=page==='connexion' || ouvert;
    $('l-choix').hidden=page!=='choix'; $('l-formulaire').hidden=!creer && !rejoindre;
    $('l-champ-code').hidden=!rejoindre; $('l-creer').hidden=!creer; $('l-rejoindre').hidden=!rejoindre;
    $('l-annuler').hidden=page!=='connexion'; $('l-salle').hidden=!ouvert;
    $('l-retour').setAttribute('aria-label',ouvert ? 'Quitter la partie' : page==='connexion' ? 'Annuler la connexion' : page==='choix' ? 'Retour au menu' : 'Retour au choix du salon');
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
    const element=document.activeElement, zone=$('enligne');
    if (ecran==='enligne' && (focus || !zone.contains(element) || element?.disabled || element?.closest('[hidden]'))) {
      const priorites=ouvert ? ['l-vers-prets','l-choisir','l-code-affiche','l-reglages'] :
        [page==='connexion' ? 'l-annuler' : creer ? 'l-creer' : rejoindre ? (estTactile ? 'l-rejoindre' : 'l-code') : 'l-choix-'+dernierChoixSalon];
      const cible=priorites.map($).find(b=>b && !b.disabled && !b.closest('[hidden]'));
      cible?.focus({preventScroll:true});
    }
  }
  // Prochaine course (David, 16/11 : « pourquoi les autres ne peuvent pas choisir les pneus ? ») : l'hôte annonce
  // circuit, tours et météo prévue (la même graine que la course qui partira) ; chaque machine choisit ses pneus, que
  // l'hôte reprend au départ. Boîte, vue, aide et commandes restent les réglages de chaque machine.
  const NOMS_METEO = { soleil: 'soleil', pluie: 'pluie', variable: 'variable' };
  const NOMS_MOMENT = { jour: 'jour', crepuscule: 'crépuscule', nuit: 'nuit', cycle: 'cycle jour / nuit' };
  const NOMS_SAISON = { printemps: 'printemps', ete: 'été', automne: 'automne', hiver: 'hiver' };
  function cleConditions() {
    return [reglages.saisonMode, reglages.saison, reglages.momentMode, reglages.moment, reglages.meteoMode, reglages.meteo, reglages.forcePluie].join('|');
  }
  function conditionsDuDepart() {
    if (conditionsPreparation && conditionsPreparationCle === cleConditions()) return conditionsPreparation;
    return { saison: B.saisons.normaliser(reglages.saison), moment: B.ambiance.normaliser(reglages.moment),
      meteo: reglages.meteo || 'aleatoire', forcePluie: B.conditionsCourse.normaliserForcePluie(reglages.forcePluie), mReelle: null, horlogeReelle: null };
  }
  // Même initialisation au conseil, au départ et chez les invités : les flocons ne sont pas
  // de l'eau liquide, et le paysage hivernal fournit une couverture de chaussée explicite.
  function meteoPourConditions(k, i, graine) {
    const m = B.meteo.depuisReel(k.mReelle) || B.meteo.pour(k.meteo) || B.meteo.initial(graine);
    // Le mode réel garde la mesure reçue. L'ancien choix Pluie conserve ses 0,75 par défaut.
    if (!k.mReelle && k.meteo === 'pluie') m.pluie = m.pluieFixe = B.conditionsCourse.FORCES_PLUIE[B.conditionsCourse.normaliserForcePluie(k.forcePluie)];
    return B.chaussee.preparer(m, B.saisons.profil(k.saison, CATALOGUE[i].theme));
  }
  function surfaceAnnoncee(k) {
    const surface = B.chaussee.lire(null, 0, meteoPourConditions(k, k.i, 0));
    // L'eau de la météo aléatoire vient de la prévision annoncée par l'hôte.
    if (Number.isFinite(k.eau)) surface.eau = clamp(k.eau, 0, 1);
    return surface;
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
      forcePluie: B.conditionsCourse.normaliserForcePluie(k.forcePluie),
      mReelle: B.meteo.depuisReel(k.mReelle), horlogeReelle: horlogePartagee(k.horlogeReelle) };
  }
  function nomMeteoCourse(k) {
    const force = { fine: 'fine', moderee: 'modérée', forte: 'forte', tres_forte: 'très forte' }[B.conditionsCourse.normaliserForcePluie(k.forcePluie)];
    const nom = k.meteo === 'pluie' ? 'pluie ' + force : NOMS_METEO[k.meteo] || (k.eau > .25 ? 'pluie, tirée au sort' : 'sec, tirée au sort');
    const profil = B.saisons.profil(k.saison, CATALOGUE[k.i].theme);
    const neige = profil.theme !== 'cote' && (k.mReelle ? k.mReelle.neige : profil.neige);
    if (k.mReelle) return (k.mReelle.pluie > .02 ? neige ? 'neige' : k.mReelle.phase === 'orage' ? 'orage' : 'pluie'
      : k.mReelle.nuage > .65 ? 'couvert' : k.mReelle.nuage > .25 ? 'éclaircies' : 'soleil') + ' · réelle';
    return neige ? nom.replace('pluie', 'neige') : nom;
  }
  function annoncerCourse() {
    if (EL.role !== 'hote' || !EL.R) return;
    const conditions = conditionsCommunes(conditionsDuDepart());
    const prevue = meteoPourConditions(conditions, reglages.circuit, graineCourse + 1);
    EL.course = { i: reglages.circuit, tours: reglages.tours, difficulte: reglages.difficulte, ...conditions, eau: B.conduite.eauSurPiste(prevue),
      versionChoixPneus: VERSION_CHOIX_PNEUS, protocolePneus: VERSION_PNEUS_RESEAU, piste: contratPiste(reglages.circuit), schemaTroll: 1 };
    EL.R.envoyer(Object.assign({ t: 'course' }, EL.course));
    majCourseSalon();
  }
  function majCourseSalon() {
    const k = EL.course, ouvert = !!EL.R && EL.R.etat !== 'ferme';
    $('l-course').hidden = !(ouvert && k);
    if (!k) return;
    const conseil = B.conduite.pneusConseilles(surfaceAnnoncee(k)), meteo = nomMeteoCourse(k);
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
    EL.confirmation = { prets: new Set(), incompatibles: new Set() }; EL.pretIci = false;
    R.envoyer({ t: 'confirmer', course: EL.course });
    aller('prets');
  }
  function majPrets() {
    const k = EL.course, R = EL.R, C = EL.confirmation;
    if (!k || !R || !C) return;
    const meteo = nomMeteoCourse(k);
    texte($('pr-course'), CATALOGUE[k.i].nom + ' · ' + k.tours + ' tours · ' + NOMS_SAISON[B.saisons.normaliser(k.saison)] + ' · ' + NOMS_MOMENT[B.ambiance.normaliser(k.moment)] + ' · météo : ' + meteo);
    texte($('pr-pneus-conseil'), 'Conseillés pour cette chaussée : ' + NOMS_PNEUS[B.conduite.pneusConseilles(surfaceAnnoncee(k))].toLowerCase() + '.');
    majChoixPneus();
    for (const [nom, val] of [['boitePret', reglages.boite], ['vuePret', reglages.vue], ['vuePret2', reglages.vue2]]) for (const r of document.querySelectorAll('input[name="' + nom + '"]')) r.checked = r.value === val;
    $('pr-vue-2').hidden = joueursIci() < 2;
    let html = '', n = 0, m = 0;
    for (const x of [...R.membres].sort((a, b) => a.id - b.id)) {
      const pret = C.prets.has(x.id) && (x.id === R.id || R.pretAvec(x.id));
      m++; if (pret) n++;
      html += '<li' + (x.id === R.id ? ' class="moi"' : '') + '><b>' + propre(x.nom) + '</b><span>' + (x.joueurs === 2 ? '2 pilotes' : '1 pilote') + (x.id === 0 ? ' · hôte' : '') + '</span><em class="' + (pret ? 'pret' : 'attente') + '">' + (pret ? 'prêt' : 'règle ses options…') + '</em></li>';
    }
    const liste = $('pr-pilotes');
    if (liste._html !== html) { liste._html = html; liste.innerHTML = html; }
    const incompatibles = C.incompatibles && [...C.incompatibles].filter(id => R.membres.some(x => x.id === id));
    texte($('pr-etat'), incompatibles && incompatibles.length ? 'Choix de pneus incompatibles. Chaque machine doit recharger la même version du jeu et confirmer ses pilotes.' : tousPrets(R, C) ? 'Tout le monde est prêt : départ !' : n + ' machine' + (n > 1 ? 's' : '') + ' prête' + (n > 1 ? 's' : '') + ' sur ' + m + '. La course part quand toutes le sont.');
    texte($('pr-pret'), EL.pretIci ? 'Pas encore prêt' : 'Je suis prêt');
    classe($('pr-pret'), 'principal', !EL.pretIci);
    texte($('pr-troll-etat'), statutTrollEnLigne());
  }
  function basculerPret() {
    const R = EL.R, C = EL.confirmation;
    if (!R || !C) return;
    EL.pretIci = !EL.pretIci;
    if (EL.role === 'hote') { if (EL.pretIci) C.prets.add(R.id); else C.prets.delete(R.id); diffuserPrets(); }
    else R.envoyer({ t: 'pret', oui: EL.pretIci, ...messageChoixPneus() }, 0);
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
    if (C.incompatibles) for (const id of C.incompatibles) if (!R.membres.some(m => m.id === id)) C.incompatibles.delete(id);
    C.trollIncompatibles = [...EL.trollDe].filter(([id, choix]) => !choix.compatible && R.membres.some(m => m.id === id)).map(([id]) => id);
    R.envoyer({ t: 'prets', liste: [...C.prets], trollIncompatibles: C.trollIncompatibles });
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
    if (!compatiblePneusReseau(m)) { refuserVersionPneus(); return false; }
    // nouvelle annonce : les pneus conseillés sont présélectionnés quand la météo change, le pilote peut changer
    const eau = clamp(+m.eau || 0, 0, 1), avant = EL.course;
    EL.course = { i: m.i | 0, tours: clamp(m.tours | 0, 1, 99), difficulte: m.difficulte | 0, ...conditionsCommunes(m), eau,
      versionChoixPneus: VERSION_CHOIX_PNEUS, protocolePneus: VERSION_PNEUS_RESEAU, piste: contratPiste(m.i), schemaTroll: m.schemaTroll === 1 ? 1 : 0 };
    if (!avant || avant.i !== EL.course.i || avant.saison !== EL.course.saison || Math.abs(avant.eau - eau) > .05) {
      appliquerConseilPneus(B.conduite.pneusConseilles(surfaceAnnoncee(EL.course))); envoyerPneus();
    } else if (avant.schemaTroll !== EL.course.schemaTroll) envoyerPneus();
    majCourseSalon();
    if (ecran === 'prets') majPrets();
    return true;
  }
  function envoyerPneus() {
    if (EL.R && EL.role === 'invite' && EL.R.pretAvec(0)) EL.R.envoyer({ t: 'pneus', ...messageChoixPneus() }, 0);
  }
  function messageChoixPneus() {
    const membre = EL.R && EL.R.membres.find(m => m.id === EL.R.id);
    const pneusPilotes = choixPneusLocaux().slice(0, membre && membre.joueurs === 2 ? 2 : 1);
    const message = { versionChoixPneus: VERSION_CHOIX_PNEUS, pneus: pneusPilotes[0], pneusPilotes };
    // L'extension est annoncée par l'hôte ; un hôte ancien reçoit son message historique exact.
    if (EL.role === 'hote' || EL.course?.schemaTroll === 1) message.troll = {
      schema: 1, pilotes: Array.from({ length: pneusPilotes.length }, (_, n) => paireTroll(reglages.trollPilotes?.[n])) };
    return message;
  }
  // Extension de préférences sur les messages fiables existants, distincte des pneus et des
  // événements de geste. Aucun paquet de geste ni interprétation de temps distant n'est ajouté.
  function paireTroll(c) {
    return { geste: c && ['majeur', 'poing', 'salut'].includes(c.geste) ? c.geste : 'majeur',
      klaxon: c && ['classique', 'ancien', 'mariage'].includes(c.klaxon) ? c.klaxon : 'classique' };
  }
  function paireTrollValide(c) {
    return !!(c && typeof c === 'object' && !Array.isArray(c) &&
      Object.hasOwn(c, 'geste') && Object.hasOwn(c, 'klaxon') &&
      ['majeur', 'poing', 'salut'].includes(c.geste) && ['classique', 'ancien', 'mariage'].includes(c.klaxon));
  }
  function lireChoixTrollMessage(m, de) {
    const membre = EL.R && EL.R.membres.find(x => x.id === de);
    if (!membre) return null;
    const nombre = membre.joueurs === 2 ? 2 : 1, t = m && m.troll;
    const compatible = !!(t && t.schema === 1 && Array.isArray(t.pilotes) && t.pilotes.length === nombre &&
      Array.from(t.pilotes).every(paireTrollValide));
    return { compatible, pilotes: Array.from({ length: nombre }, (_, n) => paireTroll(compatible ? t.pilotes[n] : null)) };
  }
  function trollDepart(humains, envelope) {
    const nombres = new Map();
    const identites = humains.map(h => {
      const local = nombres.get(h.machine) || 0; nombres.set(h.machine, local + 1);
      return { machine: h.machine, local };
    });
    const lignes = envelope && envelope.schema === 1 && Array.isArray(envelope.pilotes) && envelope.pilotes.length === humains.length
      ? envelope.pilotes : null;
    // L'ordre du départ est canonique ; une paire dupliquée, inconnue ou permutée n'est jamais attribuée à un autre pilote.
    const compatible = !!(lignes && identites.every((h, i) => paireTrollValide(lignes[i]) &&
      lignes[i].machine === h.machine && lignes[i].local === h.local));
    return { schema: 1, compatible, pilotes: identites.map((h, i) => ({ ...h, ...paireTroll(compatible ? lignes[i] : null) })) };
  }
  function statutTrollEnLigne() {
    const manque = EL.role === 'invite' && EL.course && EL.course.schemaTroll !== 1;
    const incompatibles = EL.confirmation?.trollIncompatibles || [];
    const choix = manque ? 'L’hôte ne négocie pas les choix Troll : valeurs par défaut au départ. '
      : incompatibles.length ? 'Choix Troll incompatibles sur ' + incompatibles.length + ' machine(s) : valeurs par défaut annoncées. '
      : 'Les choix Troll sont conservés pour chaque pilote. ';
    return choix + 'Les gestes et klaxons restent locaux à chaque appareil ; ils ne sont pas encore partagés en ligne.';
  }
  function lireChoixPneusMessage(m, de) {
    const membre = EL.R && EL.R.membres.find(x => x.id === de);
    if (!membre || m.versionChoixPneus !== VERSION_CHOIX_PNEUS || !Array.isArray(m.pneusPilotes) ||
      m.pneusPilotes.length !== (membre.joueurs === 2 ? 2 : 1)) return null;
    for (let n = 0; n < m.pneusPilotes.length; n++) if (!B.pneus.estJouable(m.pneusPilotes[n])) return null;
    return m.pneusPilotes.slice();
  }
  function refuserVersionPneus() {
    annulerConfirmation(); EL.course = null; EL.seanceAcceptee = null;
    if (ecran === 'prets') aller('enligne');
    majCourseSalon();
    etatEnLigne('Versions incompatibles : rechargez la même version du jeu sur chaque machine.');
  }
  function humainsDepartValides(humains) {
    if (!Array.isArray(humains) || humains.length < 2 || humains.length > 4) return false;
    const nombres = new Map();
    for (const h of humains) {
      if (!h || typeof h !== 'object' || Array.isArray(h) || !Number.isInteger(h.machine)) return false;
      const membre = EL.R && EL.R.membres.find(x => x.id === h.machine);
      if (!membre) return false;
      const n = (nombres.get(h.machine) || 0) + 1;
      if (n > (membre.joueurs === 2 ? 2 : 1)) return false;
      nombres.set(h.machine, n);
    }
    return nombres.has(0) && nombres.size >= 2;
  }
  function nouvelleLiaison() {
    annulerConfirmation();
    const precedente=EL.R; EL.R=null;
    if (precedente) precedente.fermer();
    EL.course = null; EL.pneusDe.clear(); EL.trollDe.clear(); EL.seanceAcceptee = null; EL.dernierDepart = -Infinity;
    const R = EL.R = B.reseau.creer({ url: B.reseau.adresseSalon(), nom: nomPilote(), joueurs: joueursIci() });
    EL.role = null;
    $('l-choisir').hidden = true; $('l-code-affiche').hidden = true;
    R.on('salon', m => {
      if (R !== EL.R) return;
      connexionSalon=false; EL.role = m.role;
      if (m.role === 'hote') {
        texte($('l-code-affiche'),m.code);
        $('l-code-affiche').setAttribute('aria-label','Copier le code de la partie '+m.code);
      }
      majSalon();
    }).on('salle', () => { if (R === EL.R) { majSalon(); if (EL.confirmation) { diffuserPrets(); majPrets(); } } })
      .on('pair', id => {
        if (R !== EL.R) return;
        majSalon();
        if (session && session.enLigne && session.enLigne.humains.some(h => h.machine === id)) {
          if (EL.role === 'hote') envoyerPneusReseau(session, true, 'pneus-etat', id);
          else if (id === 0) {
            envoyerPneusReseau(session, true);
            R.envoyer({ t: 'demande-pneus', version: VERSION_PNEUS_RESEAU, seance: session.enLigne.seance }, 0);
          }
        }
        if (EL.role !== 'hote') { if (id === 0) envoyerPneus(); return; }
        annoncerCourse();
        // une machine arrive pendant la confirmation : elle la reçoit aussi
        if (EL.confirmation) { R.envoyer({ t: 'confirmer', course: EL.course }, id); R.envoyer({ t: 'prets', liste: [...EL.confirmation.prets] }, id); diffuserPrets(); }
      })
      .on('relais', () => { if (R !== EL.R) return; majSalon(); if (session && session.enLigne && ecran === 'course') sousMessage('Liaison directe perdue : la course passe par le salon'); })
      .on('parti', id => { if (R === EL.R) surDepart(id); })
      .on('message', (m, de) => { if (R === EL.R) surMessageEnLigne(m, de); })
      .on('etat', (p, de) => { if (R === EL.R) recevoirEtatEnLigne(p, de); })
      .on('erreur', t => {
        if (R !== EL.R) return;
        if (connexionSalon) { fermerLiaisonSalon(); majSalon(true); }
        etatEnLigne(t);
      })
      .on('ferme', raison => { if (R === EL.R) surFermeture(raison); });
    return R;
  }
  // la préparation s'abandonne si la liaison change ou tombe ; elle sait combien de temps reste avant le départ commun
  function lancerEnLigne(cfg) {
    reglages.circuit = cfg.i;
    const R = EL.R;
    return preparerSeance('course', cfg.i, cfg, null, { verifier: () => EL.R === R && !!R && R.etat === 'connecte' && EL.seanceAcceptee === cfg.seance,
      reste: () => R && R.horloge ? cfg.T0 - R.horloge() : Infinity });
  }
  function surMessageEnLigne(m, de) {
    if (!m || typeof m !== 'object' || !EL.R) return;
    const S = session;
    if (m.t === 'depart' && de === 0 && EL.role === 'invite' && m.cfg) {
      if (!compatiblePneusReseau(m.cfg) || !identiteSeanceValide(m.cfg.seance) || !Number.isFinite(m.cfg.T0) ||
        !Number.isSafeInteger(m.cfg.graine) || m.cfg.graine < 0 || !humainsDepartValides(m.cfg.humains) ||
        !Array.isArray(m.cfg.pneus) || m.cfg.pneus.length !== m.cfg.humains.length ||
        !Array.from(m.cfg.pneus).every(p => B.pneus.estJouable(p))) { refuserVersionPneus(); return; }
      if (m.cfg.T0 <= EL.dernierDepart || m.cfg.seance === EL.seanceAcceptee) return;
      const humains = (Array.isArray(m.cfg.humains) ? m.cfg.humains : []).slice(0, 4).map(h => ({ nom: propre(h.nom), machine: h.machine | 0 }));
      const locaux = humains.map((h, k) => h.machine === EL.R.id ? k : -1).filter(k => k >= 0);
      annulerConfirmation();
      if (!locaux.length) { etatEnLigne('La course est partie sans cette machine : attendez la suivante.'); majCourseSalon(); return; }
      EL.seanceAcceptee = m.cfg.seance; EL.dernierDepart = m.cfg.T0;
      lancerEnLigne(Object.assign({}, m.cfg, conditionsCommunes(m.cfg), { humains, locaux, role: 'invite', troll: trollDepart(humains, m.cfg.troll) }));
    } else if (m.t === 'box') recevoirBox(S, m, de);
    else if (m.t === 'pneus-etat' || m.t === 'pneus-service' || m.t === 'pneus-relais') recevoirPneusReseau(S, m, de);
    else if (m.t === 'demande-pneus' && S && S.enLigne && EL.role === 'hote' &&
      m.version === VERSION_PNEUS_RESEAU && m.seance === S.enLigne.seance &&
      S.enLigne.humains.some(h => h.machine === de) && EL.R.pretAvec(de)) {
      envoyerPneusReseau(S, true, 'pneus-etat', de);
    } else if (m.t === 'course' && de === 0 && EL.role === 'invite') recevoirCourse(m);
    else if (m.t === 'confirmer' && de === 0 && EL.role === 'invite') {
      if (!recevoirCourse(m.course)) return;
      annulerConfirmation();
      EL.confirmation = { prets: new Set(), incompatibles: new Set() }; EL.pretIci = false;
      if (ecran !== 'course' && ecran !== 'pause') aller('prets');
      majCourseSalon();
    } else if (m.t === 'prets' && de === 0 && EL.confirmation) {
      EL.confirmation.prets = new Set((Array.isArray(m.liste) ? m.liste : []).map(x => x | 0));
      EL.confirmation.trollIncompatibles = [...new Set((Array.isArray(m.trollIncompatibles) ? m.trollIncompatibles : [])
        .filter(id => Number.isInteger(id) && EL.R.membres.some(x => x.id === id)))].slice(0, 4);
      majPrets();
    }
    else if (m.t === 'annuler' && de === 0 && EL.role === 'invite') {
      annulerConfirmation(); EL.seanceAcceptee = null;
      if (retourReglages === 'prets') retourReglages = 'enligne';
      if (ecran === 'prets') aller('enligne');
      etatEnLigne('L’hôte a annulé le départ.'); majCourseSalon();
    } else if (m.t === 'pret' && EL.role === 'hote' && EL.confirmation && EL.R.membres.some(x => x.id === de) && EL.R.pretAvec(de)) {
      const choix = lireChoixPneusMessage(m, de), C = EL.confirmation;
      EL.trollDe.set(de, lireChoixTrollMessage(m, de));
      if (m.oui === true && choix) { EL.pneusDe.set(de, choix); C.prets.add(de); C.incompatibles.delete(de); }
      else { C.prets.delete(de); if (m.oui !== false) C.incompatibles.add(de); }
      diffuserPrets();
    } else if (m.t === 'pneus' && EL.role === 'hote' && EL.R.membres.some(x => x.id === de) && EL.R.pretAvec(de)) {
      const choix = lireChoixPneusMessage(m, de), avant = EL.pneusDe.get(de), C = EL.confirmation;
      const troll = lireChoixTrollMessage(m, de), ancienTroll = EL.trollDe.get(de);
      EL.trollDe.set(de, troll);
      const trollChange = !ancienTroll || troll.compatible !== ancienTroll.compatible ||
        troll.pilotes.some((p, n) => p.geste !== ancienTroll.pilotes[n]?.geste || p.klaxon !== ancienTroll.pilotes[n]?.klaxon);
      if (choix) EL.pneusDe.set(de, choix);
      if (C && (!choix || !avant || choix.some((p, n) => p !== avant[n]) || trollChange)) {
        C.prets.delete(de); if (choix) C.incompatibles.delete(de); else C.incompatibles.add(de); diffuserPrets();
      }
    } else if (m.t === 'arrivee' && S && S.enLigne) {
      const v = S.course.voitures[m.id];
      if (v && v.distant && Number.isFinite(m.temps)) { v.tempsOfficiel = m.temps; if (v.fini) v.tempsFinal = m.temps; }   // temps officiel
    } else if (m.t === 'vers-salon' && de === 0 && EL.role === 'invite' && ecran !== 'enligne' && (!S || !S.enLigne || S.course.termine)) aller('enligne');
  }
  // une machine (pas l'hôte) quitte la partie : l'ordinateur de l'hôte reprend ses voitures et envoie leur état
  function surDepart(id) {
    EL.pneusDe.delete(id); EL.trollDe.delete(id);
    majSalon();
    if (EL.confirmation && EL.role === 'hote') { EL.confirmation.prets.delete(id); diffuserPrets(); }
    else if (ecran === 'prets') majPrets();
    const S = session;
    if (!S || !S.enLigne || S.course.termine) return;
    const leurs = S.enLigne.humains.map((h, k) => h.machine === id ? k : -1).filter(k => k >= 0);
    if (!leurs.length) return;
    if (EL.role === 'hote') reprendrePneusReseau(S, id);
    message('Un pilote est parti', 'ambre'); sousMessage('Sa voiture passe à l’ordinateur');
  }
  function surFermeture(raison) {
    connexionSalon=false;
    annulerConfirmation(); EL.course = null; EL.pneusDe.clear(); EL.trollDe.clear();
    if (retourReglages === 'prets') retourReglages = 'enligne';
    if (ecran === 'prets') aller('enligne');
    const S = session;
    etatEnLigne(raison === 'parti' ? 'L’hôte a quitté la partie.' : raison === 'local' ? '' : 'La liaison est coupée.');
    if (S && S.enLigne && !S.course.termine) {
      // la course continue : ce qui venait du réseau passe à l'IA de cette machine
      S.course.admettreStand = null;
      for (const v of S.course.voitures) if (v.distant) {
        B.reseau.stands.reprendre(S.course, v); v.distant = false; v.joueur = false; v.reprise = true;
      }
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
    const conseil = B.conduite.pneusConseilles(B.chaussee.lire(null, 0, meteoPourConditions(k, k.i, graine)));
    const T0 = Math.max(R.horloge() + 4000, EL.dernierDepart + 1);
    const seance = Date.now().toString(36) + '-' + (++EL.numeroSeance) + '-' + graine;
    const cfg = { graine, i: k.i, tours: k.tours, difficulte: k.difficulte, ...conditionsCommunes(k), T0, dateDepart: Date.now() + 4000, humains,
      seance, versionChoixPneus: VERSION_CHOIX_PNEUS, protocolePneus: VERSION_PNEUS_RESEAU, arbitrageBox: 1, piste: contratPiste(k.i),
      pneus: humains.map(h => { const choix = h.machine === R.id ? choixPneusLocaux() : EL.pneusDe.get(h.machine); const p = choix && choix[h.local]; return B.pneus.estJouable(p) ? p : conseil; }) };
    cfg.troll = trollDepart(humains, { schema: 1, pilotes: humains.map(h => {
      const choix = h.machine === R.id ? reglages.trollPilotes : EL.trollDe.get(h.machine)?.pilotes;
      return { machine: h.machine, local: h.local, ...paireTroll(choix?.[h.local]) };
    }) });
    EL.seanceAcceptee = seance; EL.dernierDepart = T0;
    R.envoyer({ t: 'depart', cfg });
    lancerEnLigne(Object.assign({}, cfg, { locaux: humains.map((h, k) => h.machine === 0 ? k : -1).filter(k => k >= 0), role: 'hote' }));
  }
  // Le box est commun aux machines. Seul l'hôte le réserve, après la même vérification
  // d'arrêt que le pilote. Une libération est acquittée, y compris si le canal bascule
  // vers le relais. Une ancienne réponse ne peut jamais ouvrir une nouvelle réservation.
  function envoyerBox(S, action, id, numero, vers) {
    EL.R.envoyer({t:'box', seance:S.enLigne.seance, action, id, numero}, vers);
  }
  function admettreStandReseau(S, v) {
    const box = S.boxReseau, co = S.course;
    if (EL.role === 'hote') return !box.reserve;
    let demande = box.demandes.get(v.id);
    if (!demande) {
      demande = {numero:++box.numero, derniere:-Infinity, accord:false, libere:false};
      box.demandes.set(v.id, demande);
    }
    if (demande.libere) return false;
    if (!demande.accord && co.horloge - demande.derniere >= .75) {
      demande.derniere = co.horloge; envoyerBox(S, 'demande', v.id, demande.numero, 0);
    }
    return demande.accord;
  }
  function suivreDemandesBox(S) {
    const box = S.boxReseau;
    if (!box || !box.demandes.size) return;
    const co = S.course;
    for (const [id, d] of box.demandes) {
      const v = co.voitures[id], e = v.etat;
      if (!d.libere) {
        if (!v.fini && !v.abandon && !co.termine && (e.stands?.phase === 'service' ||
          e.stands?.phase === 'voie' && Math.abs(e.v) < B.course.STANDS.arret && B.course.dansLeGarage(co.c, e, co.c.stands))) continue;
        d.libere = true; d.derniere = -Infinity;
      }
      if (co.horloge - d.derniere >= .75) {
        d.derniere = co.horloge; envoyerBox(S, 'libre', id, d.numero, 0);
      }
    }
  }
  function recevoirBox(S, m, de) {
    const box = S?.boxReseau, co = S?.course, ctx = S?.pneusReseau;
    if (!box || !S.enLigne || m.seance !== S.enLigne.seance || !Number.isInteger(m.id) ||
        !Number.isSafeInteger(m.numero) || m.numero < 1) return;
    const v = co.voitures[m.id];
    if (!v) return;
    if (EL.role === 'hote') {
      if (!v.distant || de === 0 || ctx.autorites[m.id] !== de) return;
      const r = box.reserve, meme = r && r.id === m.id && r.numero === m.numero;
      if (m.action === 'libre') {
        box.fermes[m.id] = Math.max(box.fermes[m.id], m.numero);
        if (meme) box.reserve = null;
        envoyerBox(S, 'acquitte', m.id, m.numero, de);
      } else if (m.action === 'demande' && m.numero > box.fermes[m.id] && (!r || meme)) {
        if (!meme) {
          // La pose brute est celle de l'autorité, sans le lissage visuel du châssis.
          const e = EL.recus.get(m.id)?.etat;
          if (!e || co.termine || v.fini || v.abandon || v.etat.stands?.phase !== 'voie' ||
              !Number.isFinite(e.v) || !Number.isFinite(e.psi) || Math.abs(e.v) >= B.course.STANDS.arret ||
              !B.course.dansLeGarage(co.c, e, co.c.stands) ||
              co.voitures.some(v => v.etat.stands?.phase === 'service')) return;
          box.reserve = {id:m.id, numero:m.numero, machine:de};
        }
        envoyerBox(S, 'accord', m.id, m.numero, de);
      }
    } else if (de === 0 && !v.distant && ctx.autorites[m.id] === ctx.machine) {
      const d = box.demandes.get(m.id);
      if (m.action === 'accord') {
        if (d?.numero === m.numero && !d.libere) d.accord = true;
        else envoyerBox(S, 'libre', m.id, m.numero, 0);
      } else if (m.action === 'acquitte' && d?.numero === m.numero && d.libere) box.demandes.delete(m.id);
    }
  }
  // Les pneus voyagent à faible fréquence sur le canal fiable. L'hôte valide les humains invités AVANT de
  // relayer leur état : à une déconnexion il possède ainsi tout remplacement déjà visible chez un autre pair.
  function initialiserPneusReseau(S, cfg) {
    const R = EL.R, co = S && S.course;
    if (!R || !co || !cfg) return false;
    const contexte = B.pneusReseau.creer({ seance: cfg.seance, machine: R.id, humains: cfg.humains, nombre: co.voitures.length });
    if (!contexte) return false;
    S.pneusReseau = contexte; S.pneusArchives = new Map();
    if (cfg.arbitrageBox === 1 && co.c.stands) {
      S.boxReseau = {numero:0, reserve:null, demandes:new Map(), fermes:new Array(co.voitures.length).fill(0)};
      co.admettreStand = v => admettreStandReseau(S, v);
    }
    S.pneusEnvoi = { dernier: -Infinity, messages: 0, octets: 0, services: 0 };
    S.pneusVisuels = co.voitures.map(v => v.etat.etatPneus.map(r => ({ ...r })));
    S.pneusServicesVus = co.voitures.map(v => v.etat.servicePneus);
    return true;
  }
  function envoyerPneusReseau(S, force = false, type = 'pneus-etat', vers) {
    const R = EL.R, co = S && S.course, contexte = S && S.pneusReseau;
    if (!R || R.etat !== 'connecte' || !S || !S.enLigne || !co || !contexte || contexte.machine !== R.id) return false;
    if (vers !== undefined && (!S.enLigne.humains.some(h => h.machine === vers) || !R.pretAvec(vers))) return false;
    if (!force && co.horloge - S.pneusEnvoi.dernier < .5 - 1e-9) return false;
    const paquet = B.pneusReseau.encoder(contexte, co.voitures, type);
    if (!paquet) return false;
    B.reseau.stands.joindre(paquet, co);
    R.envoyer(paquet, contexte.machine === 0 ? vers : 0);
    S.pneusEnvoi.dernier = co.horloge; S.pneusEnvoi.messages++;
    S.pneusEnvoi.octets += JSON.stringify(paquet).length;
    if (type === 'pneus-service') S.pneusEnvoi.services++;
    // Fin de chargement ou retour de liaison : reprendre aussi les derniers humains validés par l'hôte.
    if (contexte.machine === 0 && vers !== undefined) for (const [origine, etat] of S.pneusArchives) {
      if (contexte.reprises.has(origine)) continue;
      R.envoyer({ t: 'pneus-relais', origine, etat }, vers);
    }
    return true;
  }
  function recevoirPneusReseau(S, m, de) {
    const R = EL.R, contexte = S && S.pneusReseau;
    if (!R || !S || !S.enLigne || !contexte || contexte.machine !== R.id || !m || typeof m !== 'object') return [];
    let origine = de, paquet = m;
    if (m.t === 'pneus-relais') {
      if (contexte.machine === 0 || de !== 0 || !Number.isInteger(m.origine) || m.origine === 0 ||
        !S.enLigne.humains.some(h => h.machine === m.origine)) return [];
      origine = m.origine; paquet = m.etat;
    } else if (contexte.machine !== 0 && de !== 0) return [];
    const recus = B.pneusReseau.recevoir(contexte, paquet, origine, S.course.voitures);
    if (recus.length) B.reseau.stands.lire(paquet, S.course, recus);
    if (contexte.machine === 0 && origine !== 0 && recus.length) {
      const copie = JSON.parse(JSON.stringify(paquet));
      S.pneusArchives.set(origine, copie);
      R.envoyer({ t: 'pneus-relais', origine, etat: copie });
    }
    for (const v of S.course.voitures) if (v.distant && v.humain &&
      S.enLigne.humains[v.id]?.machine !== 0 && contexte.autorites[v.id] === 0) v.reprise = true;
    for (const id of recus) {
      const v = S.course.voitures[id], e = v.etat;
      v.livree.pneus = e.pneus;
      // Une monte nouvelle apparaît avec ses quatre pneus à la fois ; seule l'usure d'un même service est lissée.
      if (S.pneusServicesVus[id] !== e.servicePneus) {
        for (let i = 0; i < 4; i++) Object.assign(S.pneusVisuels[id][i], e.etatPneus[i]);
        S.pneusServicesVus[id] = e.servicePneus;
      }
    }
    return recus;
  }
  function actualiserPneusDistants(S, dt) {
    if (!S.pneusVisuels || !Number.isFinite(dt) || dt <= 0) return;
    const f = 1 - Math.exp(-dt / .12);
    for (const v of S.course.voitures) if (v.distant) {
      const visibles = S.pneusVisuels[v.id], etats = v.etat.etatPneus;
      for (let i = 0; i < 4; i++) {
        const a = visibles[i], b = etats[i];
        a.usure += (b.usure - a.usure) * f; a.salete += (b.salete - a.salete) * f; a.grainage += (b.grainage - a.grainage) * f;
        a.distance = b.distance; a.sollicitation = b.sollicitation; a.graine = b.graine;
      }
    }
  }
  function reprendrePneusReseau(S, machine) {
    if (!S || !S.pneusReseau || S.enLigne?.role !== 'hote') return [];
    const ids = B.pneusReseau.reprendre(S.pneusReseau, machine);
    if (S.boxReseau?.reserve?.machine === machine) S.boxReseau.reserve = null;
    for (const id of ids) {
      const v = S.course.voitures[id];
      B.reseau.stands.reprendre(S.course, v);
      v.distant = false; v.joueur = false; v.reprise = true;
      EL.recus.delete(id); EL.corr.delete(id);
    }
    if (ids.length) { S.pneusArchives.delete(machine); envoyerPneusReseau(S, true); }
    return ids;
  }
  function recevoirEtatEnLigne(p, de) {
    const S = session, contexte = S && S.pneusReseau;
    if (!S || !S.enLigne || !contexte || !p || !Number.isFinite(p.t) || p.t < S.enLigne.T0 || !Array.isArray(p.voitures)) return;
    for (const e of p.voitures) {
      const v = e && S.course.voitures[e.id];
      if (!v || !Number.isInteger(e.id) || !v.distant || contexte.autorites[e.id] !== de) continue;
      const r = EL.recus.get(e.id);
      if (!r || p.t >= r.t) EL.recus.set(e.id, { t: p.t, etat: e });
    }
  }
  // état de nos voitures, une fois par image : les nôtres toujours, et chez l'hôte les rivaux une image sur deux
  function envoyerEtats(S) {
    const R = EL.R, co = S.course;
    if (!R || R.etat !== 'connecte') return;
    const k = ++EL.pasEnvoi, liste = S.locaux.map(id => co.voitures[id]);
    if (S.enLigne.role === 'hote' && k % 2 === 0) for (const v of co.voitures) if (!v.humain || v.reprise) liste.push(v);
    R.envoyerEtat(B.reseau.emballer(S.enLigne.T0 + co.horloge * 1000, liste));
    envoyerPneusReseau(S);
    suivreDemandesBox(S);
  }
  // Voiture distante : dernier état reçu, prolongé jusqu'à l'instant de ce pas. À l'arrivée d'un état, ce qu'on aurait
  // affiché à ce même pas avec l'ancien moins la nouvelle prédiction devient une correction qui se résorbe en 0,12 s :
  // ni saut, ni retard.
  function appliquerDistant(S, v, dt) {
    B.reseau.stands.avancer(S.course, v.etat);
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
    if (e._physx) {
      const ph = e._physx; ph.hasRemote = !!pred.physx;
      if (pred.physx) for (let i = 0; i < 11; i++) ph.remote[i] = pred.physx[i];
    }
  }
  for (const r of document.querySelectorAll('input[name="joueursIci"]')) r.checked = String(joueursIci()) === r.value;
  $('l-nom').value = reglages.nom || '';
  $('l-nom').addEventListener('input', e => { reglages.nom = e.target.value.slice(0, 16); sauverReglages(); });
  $('l-choix-creer').addEventListener('click',()=>ouvrirParcoursSalon('creer'));
  $('l-choix-rejoindre').addEventListener('click',()=>ouvrirParcoursSalon('rejoindre'));
  $('l-annuler').addEventListener('click',retourSalon);
  $('l-quitter').addEventListener('click',retourSalon);
  async function connecterSalon(choix) {
    if (connexionSalon || parcoursSalon!==choix || EL.R?.role && EL.R.etat!=='ferme') return;
    const code=$('l-code').value.trim().toUpperCase();
    if (choix==='rejoindre' && !/^[A-Z]{4}$/.test(code)) {
      etatEnLigne('Le code doit contenir quatre lettres.');
      $('l-code').focus({preventScroll:true}); return;
    }
    const R=nouvelleLiaison();
    connexionSalon=true; majSalon(true);
    etatEnLigne(choix==='creer' ? 'Création de la partie…' : 'Recherche de la partie '+code+'…');
    try {
      if (choix==='creer') await R.creerSalon(); else await R.rejoindreSalon(code);
    } catch (e) {
      if (R!==EL.R) return;
      fermerLiaisonSalon(); majSalon(true); etatEnLigne('Le salon ne répond pas. Réessayez plus tard.');
    }
  }
  $('l-creer').addEventListener('click',()=>connecterSalon('creer'));
  $('l-rejoindre').addEventListener('click',()=>connecterSalon('rejoindre'));
  $('p-touches').addEventListener('click', () => { retourReglages = 'preparation'; aller('reglages'); B.navigationMenu.ouvrirOnglet($('reglages'), 'r-commandes-panel', true); });
  $('p-reglages-pilote').addEventListener('click', () => { retourReglages = 'preparation'; aller('reglages'); B.navigationMenu.ouvrirOnglet($('reglages'), 'r-pilotage', true); });
  $('l-code').addEventListener('input', e => { const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); if (v !== e.target.value) e.target.value = v; });
  $('l-code-affiche').addEventListener('click', () => {
    const code = $('l-code-affiche').textContent;
    if (navigator.clipboard && code) navigator.clipboard.writeText(code).then(() => etatEnLigne('Code ' + code + ' copié. Envoyez-le à l’autre pilote.'), () => {});
  });
  $('l-code').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); connecterSalon('rejoindre'); } });
  $('l-choisir').addEventListener('click', () => { modePrepa = 'enligne'; aller('preparation'); annoncerCourse(); });
  $('l-reglages').addEventListener('click', () => { retirerPret(); retourReglages = 'enligne'; aller('reglages'); });
  $('l-vers-prets').addEventListener('click', () => aller('prets'));
  $('pr-pret').addEventListener('click', basculerPret);
  $('pr-retour').addEventListener('click', quitterPrets);
  $('pr-reglages').addEventListener('click', () => { retirerPret(); retourReglages = 'prets'; aller('reglages'); });

  // ---------------------------------------------------------------- caméras
  // Inclinaison légère vers la piste : rétros, volant, compteurs et roues avant restent lisibles ensemble.
  const INCLINAISON_COCKPIT = -.035;
  function champCockpit(aspect, v, cam, glaces, M) {
    const t = Math.tan(clamp(+reglages.champ || 70, 60, 105) * Math.PI / 360) * (16 / 9);
    const tv = aspect < 16 / 9 ? Math.hypot(t, t / (16 / 9)) / Math.hypot(1, Math.max(.3, aspect)) : t / (16 / 9);
    const portraitTelephone = estTactile && canvas.clientWidth <= 600 && aspect < 1;
    let tangente = tv * (portraitTelephone ? .82 : 1);
    // En paysage, garantit que les deux rétroviseurs restent entièrement dans le cadre si le champ réglé est serré.
    if (!portraitTelephone && aspect >= 1.1 && glaces && cam && M) {
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const cr = Math.cos(cam.roll || 0), sr = Math.sin(cam.roll || 0);
      const fwdX = sy * cp, fwdY = sp, fwdZ = -cy * cp;
      const r0x = cy, r0y = 0, r0z = sy;
      const u0x = -sy * sp, u0y = cp, u0z = cy * sp;
      const rx = r0x * cr + u0x * sr, ry = r0y * cr + u0y * sr, rz = r0z * cr + u0z * sr;
      const ux = u0x * cr - r0x * sr, uy = u0y * cr - r0y * sr, uz = u0z * cr - r0z * sr;
      let besoin = tangente;
      for (let g = 0; g < glaces.length; g++) {
        const coins = glaces[g].coins;
        for (let i = 0; i < coins.length; i++) {
          const dx = coins[i][0] - cam.pos[0], dy = coins[i][1] - cam.pos[1], dz = coins[i][2] - cam.pos[2];
          const zc = dx * fwdX + dy * fwdY + dz * fwdZ;
          if (!(zc > .12)) continue;
          const xc = Math.abs(dx * rx + dy * ry + dz * rz), yc = Math.abs(dx * ux + dy * uy + dz * uz);
          // 92 % du demi-cadre : laisse une marge nette autour des deux boîtiers.
          besoin = Math.max(besoin, (xc / (zc * aspect)) / .90, (yc / zc) / .90);
        }
      }
      tangente = Math.min(besoin, Math.tan(102 * Math.PI / 360));
    }
    const vertical = 2 * Math.atan(tangente) * 180 / Math.PI;
    return clamp(vertical * (1 + (portraitTelephone ? .04 : .05) * clamp(v / 85, 0, 1)), 10, 110);
  }
  // La tête du pilote vit : poussée G franche à l'accélération, coup de fouet brutal au changement de rapport,
  // plongée au freinage, regard vers la corde, et vibrations viscérales du V12 + haute vitesse + vibreurs.
  function cameraCockpit(S, p, et, t, dt) {
    const T = S.tete || (S.tete = { lat: 0, lon: 0, regard: 0, chocRapport: 0, rapportPrev: et.rapport || 1 });
    const k = 1 - Math.exp(-dt * 8.5);
    const sec = reglages.secousses;
    // Détection directe du changement de rapport (auto ou manuel) : coup de bélier sec de boîte F1
    const rap = et.rapport || 1;
    if (T.rapportPrev != null && rap !== T.rapportPrev && et.v > 4) {
      if (rap > T.rapportPrev) T.chocRapport = 1.0;
      else if (rap > 0 && rap < T.rapportPrev) T.chocRapport = -0.68;
    }
    T.rapportPrev = rap;
    T.chocRapport *= Math.exp(-dt * 12.5);
    if (Math.abs(T.chocRapport) < 1e-4) T.chocRapport = 0;

    T.lat += (clamp(et.alat / 24, -1, 1) - T.lat) * k;
    T.lon += (clamp(et.along / 16, -1, 1) - T.lon) * k;
    T.regard += (clamp(et.volant, -1, 1) * clamp(et.v / 28, 0, 1) - T.regard) * (1 - Math.exp(-dt * 3.5));

    const OE = B.voiture.OEIL, M = B.voiture.attitude(p.cap, p.tangage, p.roulis);
    const PR = B.conduite.PARAMS;
    const rpmN = clamp(((et.regime || 0) - PR.ralenti) / Math.max(1, PR.maxUtile - PR.ralenti), 0, 1);
    const vitN = clamp((et.v || 0) / 82, 0, 1);
    const gaz = et.gaz || 0;
    const choc = T.chocRapport * sec;

    // Recul net dans le baquet à l'accélération + à-coup brutal de rapport ; avancée franche au freinage
    const depLon = T.lon * (T.lon > 0 ? .058 : .036) * sec + choc * .048;
    const depH = -Math.max(0, -T.lon) * .010 * sec + Math.max(0, T.lon) * .005 * sec + Math.abs(choc) * .011;
    const depLat = T.lat * .022 * sec;

    // Vibrations viscérales cockpit : régime V12 en charge + vitesse + vibreurs + coup de rapport
    const vibSurface = et.surface === 'vibreur' ? .011 : et.surface === 'herbe' ? .008 * Math.min(1, et.v / 18) : 0;
    const vibMoteur = .0040 * Math.pow(rpmN, 2.0) * (0.30 + 0.70 * gaz) * (et.v > 1 || gaz > 0.1 ? 1 : 0);
    const vibVitesse = .0042 * Math.pow(vitN, 1.8);
    const vibRapport = Math.abs(choc) * .013;
    const vibTot = (vibSurface + vibMoteur + vibVitesse + vibRapport) * sec;
    const oscY = (Math.sin(t * 73) * 0.65 + Math.sin(t * 127) * 0.35) * vibTot;
    const oscLat = Math.cos(t * 97) * vibTot * 0.45;
    const oscRoll = Math.sin(t * 89) * (vibMoteur + vibVitesse + vibRapport) * 0.38 * sec;

    const o = B.voiture.mul(M, [OE[0] - depLon, OE[1] + depH, OE[2] - depLat + oscLat]);
    const pitchAcc = (T.lon > 0 ? T.lon * .022 : T.lon * .016) * sec + choc * .028;
    const cam = {
      pos: [p.x + o[0], p.y + o[1] + oscY, p.z + o[2]],
      yaw: p.cap + Math.PI / 2 + T.regard * .07,
      pitch: p.tangage * .85 + INCLINAISON_COCKPIT + pitchAcc,
      roll: -p.roulis * .85 + T.lat * .018 + oscRoll,
      fov: 60, near: .1, far: PORTEE_VUE
    };
    // La seconde vue hérite de S : elle doit posséder ses buffers, même si J1 a déjà rendu son cockpit.
    const C = Object.prototype.hasOwnProperty.call(S, 'cadrageCockpit') ? S.cadrageCockpit
      : (S.cadrageCockpit = { pose: { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0 }, glaces: null });
    C.pose.p[0] = p.x; C.pose.p[1] = p.y; C.pose.p[2] = p.z;
    C.pose.cap = p.cap; C.pose.tangage = p.tangage; C.pose.roulis = p.roulis;
    C.glaces = B.voiture.glacesCockpit(C.pose, C.glaces);
    const baseFov = champCockpit(canvas.clientWidth / Math.max(1, canvas.clientHeight), et.v, cam, C.glaces, M);
    // Effet puissance / vitesse en vue intérieure : élargissement dynamique du champ à l'accélération + coup de rapport
    const boostFov = (Math.max(0, T.lon) * 3.8 + Math.pow(vitN, 1.5) * 3.2 + Math.max(0, choc) * 2.6 + (et.turbo && et.turbo.reste > 0 ? 3.5 : 0)) * sec;
    cam.fov = clamp(baseFov + boostFov, 10, 110);
    return cam;
  }
  // Écran partagé : la poursuite garde la diagonale du cadre 16:9 dans une moitié plus large ou plus étroite
  function champAdapte(f) {
    const a = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    if (!session || session.type !== 'duo' || Math.abs(a - 16 / 9) < .05) return f;
    const t = Math.tan(f * Math.PI / 360);
    return 2 * Math.atan(Math.hypot(t, t * 16 / 9) / Math.hypot(1, a)) * 180 / Math.PI;
  }
  // Supports de caméra dans le repère de l'unique voiture 126 CK : x vers le nez.
  // L'arceau culmine à 1,05 m ; les deux supports avant sont devant l'essieu x = 1,35.
  const ANCRAGES_CAMERAS = Object.freeze({
    arceau: Object.freeze({ p: Object.freeze([.20, 1.18, 0]), inclinaison: -.14, champ: 66 }),
    nez: Object.freeze({ p: Object.freeze([1.78, .48, 0]), inclinaison: -.025, champ: 70 }),
    'aileron-avant': Object.freeze({ p: Object.freeze([1.98, .26, .56]), inclinaison: 0, champ: 72 })
  });
  function cameraEmbarquee(p, et, vue) {
    const A = ANCRAGES_CAMERAS[vue], M = B.voiture.attitude(p.cap, p.tangage, p.roulis), q = B.voiture.mul(M, A.p);
    return { pos: [p.x + q[0], p.y + q[1], p.z + q[2]], yaw: p.cap + Math.PI / 2,
      pitch: p.tangage + A.inclinaison, roll: -p.roulis,
      fov: champAdapte(A.champ + 4 * clamp(et.v / 85, 0, 1)), near: .04, far: PORTEE_VUE };
  }
  function cameraPoursuite(S, p, et, dt, vue = 'poursuite') {
    if (S.camCap === null) S.camCap = p.cap;
    S.camCap += angle(p.cap - S.camCap) * (1 - Math.exp(-dt * 5.5));
    const proche = vue === 'poursuite-proche', dist = proche ? 4.65 : 7.4, hauteur = proche ? 1.65 : 2.45;
    const cx = p.x - Math.cos(S.camCap) * dist, cz = p.z - Math.sin(S.camCap) * dist;
    const sol = scene.decor.sol ? scene.decor.sol(cx, cz) : p.y;
    const y = Math.max(p.y + hauteur, (isFinite(sol) ? sol : p.y) + (proche ? 1 : 1.4));
    return { pos: [cx, y, cz], yaw: S.camCap + Math.PI / 2, pitch: -.12 - (y - p.y - hauteur) * .06, roll: 0, fov: champAdapte((proche ? 60 : 64) + 8 * clamp(et.v / 85, 0, 1)), near: .1, far: PORTEE_VUE };
  }
  // Stick droit maintenu vers le bas (axe 3 du Gamepad standard). L'hystérésis évite les bascules près du seuil ;
  // aucun réglage de vue ni état de conduite n'est modifié. Chaque moitié d'écran garde son propre maintien.
  function regardArriereVoulu(S, suivie, vue) {
    const n = S === session ? 0 : session?.vueJ2 === S ? 1 : -1, choix = n >= 0 ? commande(n) : '';
    const manette = n === 0 ? pad.manette : n === 1 ? pad2.manette : null, axe = manette?.axes?.[3];
    const id = n === 1 ? session?.locaux?.[1] : session?.course?.joueur?.id;
    const autorise = n >= 0 && ecran === 'course' && (S.type === 'course' || S.type === 'chrono' || S.type === 'duo') &&
      !S.banc && !S.reference && VUES_COURSE.includes(vue) && suivie.id === id &&
      (choix === 'auto' || choix === 'manette') && manette?.connected && Number.isFinite(axe);
    // Une affectation explicite prime sur ce geste implicite. Le demi-axe haut
    // centré reste indépendant ; une gâchette au repos à ±1 occupe l'axe entier.
    let libre = true;
    if (autorise) for (let a = 0; libre && a < ACTIONS.length; a++) {
      const liens = configurationsManettes[n][ACTIONS[a]];
      for (let k = 0; k < liens.length; k++) {
        const l = liens[k];
        if (l.type === 'axe' && l.index === 3 && (l.sens > 0 || l.origine !== 0)) { libre = false; break; }
      }
    }
    S.regardArriere = !!autorise && libre && axe >= (S.regardArriere ? .35 : .55);
    return S.regardArriere;
  }
  const RAYON_REGARD = { origine: [0, 0, 0], direction: [0, 0, 0], hit: {} };
  function cameraRegardArriere(S, p, cam, vue = 'poursuite') {
    // La caméra normale est calculée avant le regard arrière : les filtres continuent,
    // sans demi-tour à rattraper au relâchement, ni modification du choix mémorisé.
    if (vue !== 'poursuite' && vue !== 'poursuite-proche') {
      const A = ANCRAGES_CAMERAS[vue];
      if (vue === 'nez' || vue === 'aileron-avant') {
        // Les lentilles basses ont leur pendant au-delà de l'aileron arrière, pour voir
        // le poursuivant sans traverser la coque. Le modèle reste entier à sa vraie place.
        const q = B.voiture.mul(B.voiture.attitude(p.cap, p.tangage, p.roulis), [-2.34, A.p[1], A.p[2]]);
        cam.pos[0] = p.x + q[0]; cam.pos[1] = p.y + q[1]; cam.pos[2] = p.z + q[2];
      }
      cam.yaw += Math.PI; cam.pitch = A ? -p.tangage + A.inclinaison : -cam.pitch;
      cam.roll = -(cam.roll || 0); cam.regardArriere = true;
      return cam;
    }
    const cap = S.camCap ?? p.cap, ca = Math.cos(cap), sa = Math.sin(cap), pos = cam.pos;
    const proche = vue === 'poursuite-proche', dist = proche ? 4.65 : 7.4, hauteur = proche ? 1.65 : 2.45;
    pos[0] = p.x + ca * dist; pos[2] = p.z + sa * dist;
    const sol = scene.decor.sol ? scene.decor.sol(pos[0], pos[2]) : p.y;
    pos[1] = Math.max(p.y + hauteur, (Number.isFinite(sol) ? sol : p.y) + (proche ? 1 : 1.4));
    const monde = S.course.physique?.world;
    if (monde?.raycast) {
      const origine = RAYON_REGARD.origine, direction = RAYON_REGARD.direction;
      origine[0] = p.x; origine[1] = p.y + 1.1; origine[2] = p.z;
      for (let k = 0; k < 3; k++) direction[k] = pos[k] - origine[k];
      const distance = Math.hypot(...direction);
      for (let k = 0; k < 3; k++) direction[k] /= distance;
      // Sol, parois et plafond réels ; les voitures et les débris ne font pas rebondir la caméra.
      const hit = monde.raycast(origine, direction, distance + .35, { mask: 3, staticOnly: true }, RAYON_REGARD.hit);
      if (hit.hit) {
        const libre = Math.max(0, Math.min(distance, hit.distance - .35));
        for (let k = 0; k < 3; k++) pos[k] = origine[k] + direction[k] * libre;
      }
    }
    cam.yaw = cap - Math.PI / 2;
    cam.pitch = -Math.atan2(pos[1] - p.y - .6, Math.hypot(pos[0] - p.x, pos[2] - p.z) + 5);
    cam.roll = 0; cam.regardArriere = true;
    return cam;
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
      if (B.circuit.dansCouvert(c, sp, 25)) {
        sp = B.couverts.sortie(c, sp, 25, 5 + T.alea() * 30);
        if (sp === null) return cameraPoursuite(S, p, v.etat, 0);
      }
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
  const VUES_DEHORS = new Set(['tele', 'helico', 'orbite', 'travelling', 'sol', 'panorama', 'lieu', 'peloton']);
  const DANS_LA_ROCHE = new Set(['helico', 'orbite', 'travelling', 'pilote', 'peloton']);   // sous le tunnel, ces caméras seraient dans la montagne
  const CAMERAS_DEMO = new Set(['roue', 'aileron', 'arriere', 'travelling', 'orbite']);
  function cameraDemo(S, p, plan, vue = plan && plan.vue) {
    const M = B.voiture.attitude(p.cap, p.tangage, p.roulis), pt = o => { const q = B.voiture.mul(M, o); return [p.x + q[0], p.y + q[1], p.z + q[2]]; };
    const vise = (pos, cible, fov) => { const dx = cible[0] - pos[0], dy = cible[1] - pos[1], dz = cible[2] - pos[2], d = Math.hypot(dx, dy, dz) || 1;
      return { pos, yaw: Math.atan2(dx, -dz), pitch: Math.asin(clamp(dy / d, -1, 1)), roll: 0, fov, near: .1, far: PORTEE_VUE }; };
    const cote = plan && plan.cote || 1, age = S.tRendu - (plan ? plan.debut : 0);   // temps rendu, même hors réalisateur
    switch (vue) {
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
      if (B.circuit.dansCouvert(c, sp, 25)) {
        sp = B.couverts.sortie(c, sp, 25);
        if (sp === null) return cameraPoursuite(S, p, v.etat, 0);
      }
      const e = B.circuit.echantillon(c, sp);
      const cote = e.courbure > 1e-4 ? 1 : e.courbure < -1e-4 ? -1 : plan.cote;
      // lot 22F : un muret (limite à 1 m du bord) ou un parapet (1,4 m) commence à la limite ; à 1,1 m du bord, la
      // caméra serait dans le mur. Elle reste 40 cm devant la limite ; ailleurs (limites d'au moins 3,2 m), rien ne change.
      const d = cote * Math.min(c.largeur / 2 + 1.1, B.conduite.limiteCote(c, sp, cote) - .4), x = e.x - Math.sin(e.cap) * d, z = e.z + Math.cos(e.cap) * d;
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
  // graphique (version du jeu et processeur graphique) : une nouvelle version ou une autre machine repart de zéro.
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
  // Profil résolu, mémorisé sur tout ce qui le décide : qualité (du banc ou du menu), niveau du gouverneur, ancre du
  // décor, capacités du moteur et les quatre options du menu. melange normalise des chaînes, crée une vingtaine
  // d'objets et les gèle ; rappelé deux à cinq fois par vue et par image (neuf à deux), il ne se recalcule plus que
  // lorsqu'une de ces entrées change : réglage, palier du gouverneur, détection graphique. Même résultat, objet figé.
  const profilVu = { qualite: null, n: -1, decor: null, capacites: null, anticrenelage: null, ombres: null, vegetation: null, faune: null, profil: null };
  function profilDe(S) {
    const q = S && S.banc ? S.banc.qualite : reglages.qualite, m = profilVu;
    if (m.profil === null || m.qualite !== q || m.n !== palier.n || m.decor !== etatProfils.decor || m.capacites !== capacitesRendu ||
        m.anticrenelage !== reglages.anticrenelage || m.ombres !== reglages.ombres || m.vegetation !== reglages.vegetation || m.faune !== reglages.faune) {
      m.qualite = q; m.n = palier.n; m.decor = etatProfils.decor; m.capacites = capacitesRendu;
      m.anticrenelage = reglages.anticrenelage; m.ombres = reglages.ombres; m.vegetation = reglages.vegetation; m.faune = reglages.faune;
      m.profil = B.graphismes.melange(q, palier.n, { decor: etatProfils.decor, capacites: capacitesRendu, options: reglages });
    }
    return m.profil;
  }
  // Le décor (matières et massifs) est bâti une fois par séance sur un palier « ancre ». Le gouverneur Auto ne le
  // fait jamais bouger en pleine course : rebâtir nappes, lots et tampons au milieu d'une course toucherait les
  // stands, les caméras et les rétroviseurs. Le budget du décor suit donc l'ancre et prend effet à la séance
  // suivante ; ombres, halo, reflets, glaces et cadence du second joueur s'appliquent à l'image, sans redémarrer la
  // course. La résolution attend un arrêt (voir appliquerPalierEnCourse).
  // majPalier l'appelle à chaque image. stabiliser ne change rien quand l'état a déjà le palier visé pour cette
  // qualité et ce niveau du gouverneur, sans demande ni décor en attente (sa temporisation doit être rappelée tant
  // que l'un des deux attend) : l'appel est alors sauté. Même état, sans le résultat figé ni la normalisation de
  // chaîne qu'il allouait à chaque image. Le palier visé ne se recalcule que si la qualité ou le niveau change.
  const cibleProfils = { qualite: null, n: -1, palier: null };
  function majProfils(S) {
    const q = S && S.banc ? S.banc.qualite : reglages.qualite, e = etatProfils, c = cibleProfils;
    if (c.qualite !== q || c.n !== palier.n) { c.qualite = q; c.n = palier.n; c.palier = B.graphismes.resoudre(q, palier.n); }
    if (e.palier !== null && e.palier === c.palier && e.demande === null && e.decor === e.palier) return null;
    return B.graphismes.stabiliser(e, q, palier.n, horlogeProfils());
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
    const flocons = m && (typeof m.precipitationsNeige === 'boolean' ? m.precipitationsNeige : m.reel && m.neige);
    const eau = peutEtre ? Math.max(m.mouille || 0, flocons ? 0 : m.pluie || 0) : 0;
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
  function preparerTunnel(c) {
    return B.couverts.preparer(c).blocs.length > 0;
  }
  const abriCamera = { geometrie: null, x: NaN, y: NaN, z: NaN, lecture: {} };
  // Altitude, parois et portails réels : une caméra au-dessus du toit reste dehors.
  // Le troisième argument distingue le tunnel fermé de la galerie qui reçoit le jour.
  function sousLaVoute(c, p, interieur = false) {
    if (!p || !B.couverts.liste(c).length) return false;
    const geometrie = B.couverts.preparer(c), cache = abriCamera;
    if (cache.geometrie !== geometrie || cache.x !== p[0] || cache.y !== p[1] || cache.z !== p[2]) {
      B.couverts.position(c, p, cache.lecture);
      cache.geometrie = geometrie; cache.x = p[0]; cache.y = p[1]; cache.z = p[2];
    }
    return interieur ? cache.lecture.interieur : cache.lecture.abri;
  }

  // Une lampe n'éclaire que ce qui est près d'elle : le moteur éteint toute lampe de portée 18 m au-delà de 18 m
  // (atténuation du shader) et n'en retient que huit par rendu. Les choisir à 70 m à la volée, triées à chaque image,
  // les faisait basculer par blocs de douze watts. La contribution de chaque lampe suit maintenant une rampe continue
  // qui s'achève au-delà de la portée réelle du moteur : la lumière monte et redescend, elle ne bascule pas. Le
  // lissage anti-tremblement ne sert qu'à cela : le seuil d'extinction est appliqué à la cible, jamais à la valeur
  // lissée, sinon une lampe dont la cible reste sous le seuil ne s'allumerait plus jamais.
  const LAMPE_PUISSANCE = 12, LAMPE_PORTEE = 18, LAMPE_RAYON = 20, LAMPE_PLAT = .5, LAMPE_MIN = .35, LAMPE_MAX = 8, LAMPE_LISSAGE = .08;
  const COULEUR_LAMPE = [1, .84, .58];
  const GROUPES_LAMPES = new WeakMap();
  const CASE_LAMPES = 96;
  function groupesLampes(lampes) {
    const connu = GROUPES_LAMPES.get(lampes);
    if (connu) return connu;
    const groupes = [], colonnes = new Map(), grands = [];
    for (let debut = 0; debut < lampes.length; debut += 12) {
      const fin = Math.min(debut + 12, lampes.length);
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (let i = debut; i < fin; i++) {
        const p = lampes[i];
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
        z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
      }
      const id = groupes.length, g = { debut, fin, x0: x0 - LAMPE_RAYON, x1: x1 + LAMPE_RAYON,
        z0: z0 - LAMPE_RAYON, z1: z1 + LAMPE_RAYON };
      groupes.push(g);
      const i0 = Math.floor(g.x0/CASE_LAMPES), i1 = Math.floor(g.x1/CASE_LAMPES);
      const j0 = Math.floor(g.z0/CASE_LAMPES), j1 = Math.floor(g.z1/CASE_LAMPES);
      // Un groupe peut chevaucher deux ouvrages très éloignés dans la liste des lampes.
      if (!Number.isSafeInteger(i0) || !Number.isSafeInteger(i1) || !Number.isSafeInteger(j0) ||
          !Number.isSafeInteger(j1) || (i1-i0+1)*(j1-j0+1)>64) { grands.push(id); continue; }
      for (let i=i0; i<=i1; i++) {
        let colonne=colonnes.get(i);
        if (!colonne) colonnes.set(i,colonne=new Map());
        for (let j=j0; j<=j1; j++) {
          let caseLampes=colonne.get(j);
          if (!caseLampes) colonne.set(j,caseLampes=[]);
          caseLampes.push(id);
        }
      }
    }
    if (grands.length) for (const colonne of colonnes.values()) for (const ids of colonne.values()) {
      for (const id of grands) ids.push(id);
      ids.sort((a,b)=>a-b);
    }
    const index = { groupes, colonnes, grands };
    GROUPES_LAMPES.set(lampes, index); return index;
  }
  function nouvelEtatLampes(rev, lampes) {
    const n = lampes.length, index = groupesLampes(lampes);
    const e = { rev, n, lampes, index, celluleX: NaN, celluleZ: NaN, candidats: index.grands, actifs: [], suivants: [],
      p: new Float64Array(n), hors: [], pool: [] };
    for (let k = 0; k < LAMPE_MAX; k++) e.pool.push({ p: null, power: 0, range: LAMPE_PORTEE, color: COULEUR_LAMPE });
    return e;
  }
  // état de départ d'une caméra sans rien réallouer : toutes les lampes éteintes, comme un état neuf
  function remettreLampes(porteur) {
    for (const cle of ['lampesTunnel', 'lampes0', 'lampes1']) {
      const e = Object.prototype.hasOwnProperty.call(porteur, cle) && porteur[cle];
      if (e && e.p) { e.p.fill(0); e.actifs.length = e.suivants.length = 0; }
    }
  }
  // porteur/clé isolent l'état temporel de chaque caméra : la vue de J1, celle de J2 et chaque glace ont leur propre
  // lissage. Le tableau rendu est celui de l'état : le moteur le lit pendant le draw, rien n'est alloué par image.
  function lampesTunnel(porteur, cle, LT, cam, dtImage, rev) {
    if (!LT || !LT.length) return null;
    let et = porteur[cle];
    if (!et || et.rev !== rev || et.lampes !== LT) et = porteur[cle] = creationTardive('lampes', nouvelEtatLampes(rev, LT));
    const cx = cam.pos[0], cy = cam.pos[1], cz = cam.pos[2], P = et.p;
    const ix = Math.floor(cx/CASE_LAMPES), iz = Math.floor(cz/CASE_LAMPES);
    if (et.celluleX !== ix || et.celluleZ !== iz) {
      et.celluleX = ix; et.celluleZ = iz;
      et.candidats = et.index.colonnes.get(ix)?.get(iz) || et.index.grands;
    }
    const candidats = et.candidats, actifs = et.actifs, suivants = et.suivants;
    if (!candidats.length && !actifs.length) return null;
    const k = 1 - Math.exp(-Math.max(0, dtImage) / LAMPE_LISSAGE), r = LAMPE_RAYON, plat = r * (1 - LAMPE_PLAT);
    let compte = 0, c = 0, a = 0, n = 0;
    // Fusion en ordre historique : les égalités des huit lumières et leur extinction
    // après un saut de caméra restent propres à chaque vue, rétroviseurs compris.
    while (c < candidats.length || a < actifs.length) {
      const g = Math.min(c < candidats.length ? candidats[c] : Infinity, a < actifs.length ? actifs[a] : Infinity);
      const etaitActif = actifs[a] === g;
      if (etaitActif) a++;
      if (candidats[c] === g) c++;
      const groupe = et.index.groupes[g];
      const proche = cx >= groupe.x0 && cx <= groupe.x1 && cz >= groupe.z0 && cz <= groupe.z1;
      // Après la sortie, le groupe reste actif jusqu'à l'extinction des dernières lampes.
      if (!proche && !etaitActif) continue;
      let actif = 0;
      for (let i = groupe.debut; i < groupe.fin; i++) {
        let cible = 0;
        if (proche) {
          const q = LT[i], dx = q[0] - cx, dy = q[1] - cy, dz = q[2] - cz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < r * r) {
            const u = d2 <= plat * plat ? 1 : (r - Math.sqrt(d2)) / (r - plat);
            cible = LAMPE_PUISSANCE * u * u * (3 - 2 * u);
          }
        }
        let v = P[i] + (cible - P[i]) * k;
        if (cible === 0 && v < LAMPE_MIN) v = 0;
        P[i] = v;
        if (v <= 0) continue;
        actif = 1;
        if (compte < LAMPE_MAX) { const o = et.pool[compte++]; o.p = LT[i]; o.power = v; }
        else {
          let min = 0;
          for (let j = 1; j < LAMPE_MAX; j++) if (et.pool[j].power < et.pool[min].power) min = j;
          if (v > et.pool[min].power) { const o = et.pool[min]; o.p = LT[i]; o.power = v; }
        }
      }
      if (actif) suivants[n++] = g;
    }
    suivants.length = n; et.actifs = suivants; et.suivants = actifs;
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
  const ETATS_GLACES = [0, 1].map(() => ({ vu: false, seance: null, dette: 0, masque: 0, geometrie: null, ecoule: [0, 0], glaces: [nouvelleGlace(), nouvelleGlace()],
    poses: [nouvellePoseCss(), nouvellePoseCss()], toiles: null, aPoser: false }));
  // Caméra des glaces et objets de sa liste, réutilisés d'une glace à l'autre (le moteur relit tout à chaque draw)
  const CAM_GLACE = { pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, fov: 34, near: .3, far: 6000, allStatic: true, sun: { center: [0, 0, 0], extent: 0, depth: 0 } };
  const POSE_GLACES = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0 }, OPTIONS_RETRO = { roues: undefined, casse: false, rouesDetail: 0 };
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
  function retroVoulu(S, vue, P) {
    const r = reglages.retro === 'auto' ? (estTactile ? 'non' : 'oui') : reglages.retro;
    // Le profil décide : image des glaces refusée d'office au palier bas et aux paliers Auto les plus serrés.
    return r === 'oui' && (vue === 'cockpit' || vue === 'arceau') && !S.regardArriere && S.type !== 'vitrine' && !retro.echec && !cameraEssai && (P || profilDe(S)).effets.retroImages;
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
      retro.rendu = window.FRender.create($('retro-rendu'), { indexRegisteredShapes: true, msaa: 0, shadowMapScale: 1, reflections: false, sea: false, overlayLighting: 'world' });
      retro.rendu.resize(Math.min(window.devicePixelRatio || 1, 1.5));
      if (retro.rendu.retain) retro.rendu.retain(true);   // FERRO 0.3.10 : cibles gardées malgré 120 rendus sans usage
    } catch (e) {
      console.warn('BITUME : image des rétroviseurs indisponible', e); retro.rendu = null; retro.echec = true;
      for (const G of [retro.j1, retro.j2]) if (G) for (const t of G.toiles) t.hidden = true;
    }
    return !!retro.rendu;
  }
  // Toile du moteur des glaces : au moins PIXELS_GLACE pixels (voir ratioGlaces). Sa taille CSS est fixe (style.css,
  // .retro-rendu) : relue seulement quand la densité de l'écran change. Posée à la préparation des glaces, revue à
  // chaque image (un changement de densité, écran déplacé, la refait).
  function tailleGlaces(source) {
    const dpr = window.devicePixelRatio || 1;
    if (retro.dpr === dpr) return;
    retro.dpr = dpr; retro.l = source.clientWidth; retro.h = source.clientHeight;
    const r = ratioGlaces(retro.l, retro.h, dpr);
    if (retro.rendu.stats.pixelRatio !== r) retro.rendu.resize(r);
  }
  // même décor et même clé de scène que le moteur principal ; le moteur range ses tampons dans les lots : copies
  function installerRetro() {
    if (!retro.rendu || !scene || retro.scene === scene) return;
    const d = scene.decor;
    retro.rendu.setWorld([], [], d.atmosphere);
    retro.rendu.setNappes(d.nappes.map(n => Object.assign({}, n)), { staticBounds: true });
    retro.rendu.setLots(d.lots.map(l => Object.assign({}, l, { tampon: null, tamponLoin: null, paquet: null, paquetLoin: null })), { staticBounds: true, progressif: !!d.fluxDecor });
    // le public dans les glaces : son propre contexte WebGL, sans le niveau proche ni les ombres (glace sans ombre)
    if (retro.vuePublic) retro.vuePublic.liberer();
    retro.vuePublic = null;
    if (scene.public) try { retro.vuePublic = B.public.vue(retro.rendu, scene.public, { niveauMin: 1, ombre: false }); } catch (e) { console.warn('BITUME : public des rétroviseurs indisponible', e); }
    retro.scene = scene;
  }
  function preparerGlaces() {
    if (!creerMoteurRetro()) return false;
    installerRetro();
    const source = $('retro-rendu'), LT = scene && scene.decor.tunnelLampes;
    tailleGlaces(source);   // taille de régime posée ici : la première image en cockpit ne réalloue rien
    for (const cle of ['j1', 'j2']) {
      const G = glacesDe(cle);
      if (!G.ctx.length) {
        G.opaque = retro.rendu.stats.backend === 'webgl2'; // FERRO ouvre cette surface avec alpha:false
        G.toiles.forEach((t, i) => {
          t.width = source.width; t.height = source.height;
          t.style.width = source.clientWidth + 'px'; t.style.height = source.clientHeight + 'px';
          G.ctx[i] = t.getContext('2d', { alpha: !G.opaque });
          if (G.opaque) G.ctx[i].globalCompositeOperation = 'copy';
        });
      }
      if (LT && LT.length) for (const k of ['lampes0', 'lampes1']) if (!G[k] || G[k].rev !== scene.index || G[k].lampes !== LT) G[k] = nouvelEtatLampes(scene.index, LT);
    }
    return true;
  }
  const glacesPretes = G => !!retro.rendu && retro.scene === scene && !!G && G.ctx.length === 2;
  const glacesVives = (S, vue) => retroVoulu(S, vue) && glacesPretes(S !== session ? retro.j2 : retro.j1);
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
  function planifierGlaces(S, cam, ps, dtImage, glaces, voir, P) {
    // à deux, le joueur 2 a ses deux glaces, posées sur sa moitié
    const G = glacesDe(S !== session ? 'j2' : 'j1');
    const toiles = G.toiles, J = ETATS_GLACES[S !== session ? 1 : 0];
    for (const t of toiles) if (t.hidden === voir) t.hidden = !voir;
    // nouvelle séance (course, référence) : les glaces repartent comme à leur premier affichage
    if (!voir || J.seance !== session) { J.vu = false; J.seance = session; }
    if (!voir) return null;
    const source = $('retro-rendu');
    // le moteur, sa copie du décor et les toiles sont prêts (glacesVives) : seule la densité de l'écran peut avoir
    // changé depuis la préparation
    tailleGlaces(source);
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
    if (!glaces) {
      const ev = POSE_GLACES;
      ev.p[0] = ps.x; ev.p[1] = ps.y; ev.p[2] = ps.z; ev.cap = ps.cap; ev.tangage = ps.tangage; ev.roulis = ps.roulis;
      glaces = B.voiture.glacesCockpit(ev, J.glaces);
    }
    J.toiles = toiles;
    let aRepeindre = 0;
    for (let i = 0; i < 2; i++) {
      // Chaque glace reste visible dès qu'une partie de son rectangle projeté entre dans la vue.
      const g = glaces[i], PC = J.poses[i], v = PC.v;
      const ok = projeterCoin(g.coins[1], 0, Q) && projeterCoin(g.coins[0], 1, Q)
        && projeterCoin(g.coins[3], 2, Q) && projeterCoin(g.coins[2], 3, Q)
        && Math.max(Q[0], Q[2], Q[4], Q[6]) >= 0 && Math.min(Q[0], Q[2], Q[4], Q[6]) <= C.L
        && Math.max(Q[1], Q[3], Q[5], Q[7]) >= 0 && Math.min(Q[1], Q[3], Q[5], Q[7]) <= C.H
        && homographie(Q, l, h, v);
      if (ok) {
        if (changee(v, PC) || !PC.chaine) PC.chaine = chaineMatrice(v);
        if (!PC.ok || !J.vu) aRepeindre |= 1 << i;
      }
      PC.ok = ok;
    }
    J.aPoser = true;
    // Cadence au temps (src/graphismes.js, hz par glace) : une glace toutes les 1/(2 hz) s, les côtés en alternance,
    // deux au plus par image ; le même coût par seconde à 30, 60, 120 ou 144 Hz. À l'image la plus proche de
    // l'échéance (demi-image de tolérance) ; une dette bornée à deux glaces : après un accroc, les deux glaces sont
    // repeintes, sans rafale de rattrapage. La première image où les glaces se montrent, les deux sont peintes.
    const hz = P.secondaires.retroviseurs.hz;
    if (!(hz > 0)) return null;
    const intervalle = 1 / (2 * hz), dt = Math.max(0, dtImage || 0);
    if (!J.vu) { J.vu = true; J.dette = 2 * intervalle; J.ecoule[0] = J.ecoule[1] = 0; }
    else J.dette = Math.min(J.dette + dt, 2 * intervalle);
    J.ecoule[0] += dt; J.ecoule[1] += dt;
    for (let n = 0; n < 2 && J.dette >= intervalle - dt / 2; n++) {
      J.dette -= intervalle;
      const i = G.cote; G.cote = 1 - G.cote;
      if (J.poses[i].ok) aRepeindre |= 1 << i;
    }
    if (!aRepeindre) return null;
    J.masque = aRepeindre;
    J.geometrie = glaces;
    return J;
  }

  function peindreGlacesPlanifiees(S, plan, cam, ps, sortie, ambiance, suivie, P) {
    if (!plan) return;
    const G = glacesDe(S !== session ? 'j2' : 'j1'), source = $('retro-rendu');
    for (let i=0; i<2; i++) {
      if (!(plan.masque & (1 << i))) continue;
      const dtGlace = plan.ecoule[i];
      plan.ecoule[i] = 0;
      peindreGlace(S, G, i, plan.geometrie[i], cam, ps, sortie, ambiance, suivie, P, source,
        retro.l, retro.h, dtGlace, i === 0 && plan.masque === 3);
    }
  }
  // quelque valeur de la matrice a-t-elle changé depuis la dernière chaîne ? (mémorise les valeurs)
  function changee(v, P) {
    const w = P.w;
    let diff = false;
    for (let i = 0; i < 16; i++) if (w[i] !== v[i]) { w[i] = v[i]; diff = true; }
    return diff;
  }
  // Même caméra réfléchie pour le rendu de la glace et la sélection de sa faune.
  function cameraReflet(g, cam, ps, l, h, camR) {
    // Comme un vrai rétroviseur réglé par le pilote, le regard est ouvert de 9° vers l'extérieur et passe un peu
    // au-dessus de la caisse : la roue arrière et le ponton n'occupent que le bord intérieur de la glace.
    const d00 = g.centre[0] - cam.pos[0], d01 = g.centre[1] - cam.pos[1], d02 = g.centre[2] - cam.pos[2], dn = Math.hypot(d00, d01, d02) || 1;
    const dv0 = d00 / dn, dv1 = d01 / dn, dv2 = d02 / dn, n = g.normale;
    const pn = dv0 * n[0] + dv1 * n[1] + dv2 * n[2], rf0 = dv0 - 2 * pn * n[0], rf1 = dv1 - 2 * pn * n[1], rf2 = dv2 - 2 * pn * n[2];
    const ouvre = g.k * .16, co = Math.cos(ouvre), so = Math.sin(ouvre), rx = rf0 * co - rf2 * so, rz = rf0 * so + rf2 * co;
    camR.pos[0] = g.centre[0]; camR.pos[1] = g.centre[1] + .1; camR.pos[2] = g.centre[2];
    camR.yaw = Math.atan2(rx, -rz); camR.pitch = Math.asin(clamp(rf1, -1, 1)) + .06; camR.roll = ps.roulis * .85;
    camR.fov = 2 * Math.atan(Math.tan(16 * Math.PI / 180) * h / l) * 180 / Math.PI; camR.near = .3; camR.far = PORTEE_VUE;
    return camR;
  }
  // Les carènes normalisées par BITUME tiennent dans leur cube unité. Une sphère
  // autour de chaque pièce est conservative quelle que soit sa rotation en suspension.
  const FORMES_GLACE = new Set(Object.values(B.voiture.FORMES).map(f => f.nom));
  const FORMES_EFFETS_GLACE = new Set(['box', 'sphere', 'cylinder', ...Array.from(B.echappement?.FORMES || [], f => f.nom)]);
  const BORNE_GLACE = {p:null,radius:0};
  function nouveauChampGlace() {
    return { axes: { right: [0,0,0], up: [0,0,0], forward: [0,0,0] }, camera: null,
      horizontal: 0, vertical: 0, rayons: { horizontal: 1, vertical: 1 }, visible: null };
  }
  const CHAMP_GLACE = nouveauChampGlace();
  function champGlace(camR, largeur, hauteur, champ = CHAMP_GLACE) {
    const shared = window.FRender?.shared;
    if (!shared?.visible || !(hauteur > 0 && largeur > 0)) return null;
    // Même base que FERRO cameraAxes, écrite dans les neuf coefficients déjà réservés.
    const cy = Math.cos(camR.yaw), sy = Math.sin(camR.yaw), cp = Math.cos(camR.pitch), sp = Math.sin(camR.pitch);
    const cr = Math.cos(camR.roll || 0), sr = Math.sin(camR.roll || 0);
    const { right, up, forward } = champ.axes;
    right[0] = cy*cr - sy*sp*sr; right[1] = cp*sr; right[2] = sy*cr + cy*sp*sr;
    up[0] = -sy*sp*cr - cy*sr; up[1] = cp*cr; up[2] = cy*sp*cr - sy*sr;
    forward[0] = sy*cp; forward[1] = sp; forward[2] = -cy*cp;
    champ.camera = camR; champ.visible = shared.visible;
    champ.vertical = Math.tan(clamp(camR.fov, 10, 110) * Math.PI / 360);
    champ.horizontal = champ.vertical * largeur / hauteur;
    champ.rayons.horizontal = Math.sqrt(1 + champ.horizontal*champ.horizontal);
    champ.rayons.vertical = Math.sqrt(1 + champ.vertical*champ.vertical);
    return champ;
  }
  const POINT_ACTEUR = [0,0,0];
  function creerVisibiliteActeurs() {
    // Ces deux fonctions, leurs cônes et leurs repères sont créés une fois par joueur.
    const etat = { principal: null, indetermine: false, masque: 0, reflets: [nouveauChampGlace(), nouveauChampGlace()] };
    etat.reflete = (x,y,z,rayon) => {
      if (etat.indetermine) return true;
      if (!etat.masque) return false;
      POINT_ACTEUR[0]=x; POINT_ACTEUR[1]=y; POINT_ACTEUR[2]=z;
      BORNE_GLACE.p=POINT_ACTEUR; BORNE_GLACE.radius=rayon;
      for (let i=0; i<2; i++) {
        const reflet=etat.reflets[i];
        if ((etat.masque & 1<<i) && visibleDansGlace(BORNE_GLACE, reflet.camera, reflet)) return true;
      }
      return false;
    };
    etat.visible = (x,y,z,rayon) => !etat.principal || etat.principal(x,y,z,rayon) || etat.reflete(x,y,z,rayon);
    return etat;
  }
  function rayonMonoplace(pose) {
    const r = pose.rebond;
    return DERRIERE_CAMERA + (r ? Math.max(Math.abs(r[0] || 0), Math.abs(r[1] || 0), Math.abs(r[2] || 0), Math.abs(r[3] || 0)) : 0);
  }
  function visibleDansGlace(borne, camR, champ) {
    return champ.visible(borne, camR.pos, champ.axes, champ.horizontal, champ.vertical, camR.far, champ.rayons);
  }
  const POSE_ROUES_DISTANTE = { p: [0,0,0], cap: 0, tangage: 0, roulis: 0, rebond: null };
  function detailRouesHorsChamp(p, oeil, tanDemi, hauteur, precedent, rayon) {
    const dx=p.x-oeil[0], dy=p.y-oeil[1], dz=p.z-oeil[2], d=Math.sqrt(dx*dx+dy*dy+dz*dz);
    // La distance à la roue proche (déjà minorée du rayon du pneu) est comprise
    // dans [d−rayon, d+rayon]. Le choix avec hystérésis est monotone à état précédent fixé.
    const proche=Math.max(.1,d-rayon), loin=d+rayon;
    const a=B.voiture.detailRouesPour(proche*proche,tanDemi,hauteur,precedent);
    if (a===B.voiture.detailRouesPour(loin*loin,tanDemi,hauteur,precedent)) return a;
    const ev=POSE_ROUES_DISTANTE;
    ev.p[0]=p.x; ev.p[1]=p.y; ev.p[2]=p.z;
    ev.cap=p.cap; ev.tangage=p.tangage; ev.roulis=p.roulis; ev.rebond=p.rebond;
    return B.voiture.detailRouesPour(B.voiture.distanceRoues2(ev,oeil),tanDemi,hauteur,precedent);
  }
  // Les effets du circuit (embruns, fumée, traces, flammes) emploient des maillages normalisés
  // sans déplacement de sommets. Les FX de modules externes conservent leurs propres bornes.
  function ecarterPiecesHorsGlace(objets, camR, champ, debutEffets=0, finEffets=0) {
    if (!champ) return;
    let n=0;
    for (let k=0;k<objets.length;k++) {
      const o=objets[k];
      const effet = k >= debutEffets && k < finEffets;
      if (effet ? FORMES_EFFETS_GLACE.has(o.shape) || FORMES_GLACE.has(o.shape)
        : !o.fx && !o.overlay && FORMES_GLACE.has(o.shape)) {
        const s=o.s;
        BORNE_GLACE.p=o.p;
        BORNE_GLACE.radius=.867*Math.max(Math.abs(s[0]),Math.abs(s[1]),Math.abs(s[2]))+.04;
        if (!visibleDansGlace(BORNE_GLACE, camR, champ)) continue;
      }
      objets[n++]=o;
    }
    objets.length=n;
  }
  // Une glace : la caméra est à la glace et regarde dans la direction réfléchie du regard.
  function peindreGlace(S, G, i, g, cam, ps, sortie, ambiance, suivie, P, source, l, h, dtGlace, secondeGlace) {
    const toiles = G.toiles;
    const champs = S.visibiliteActeurs;
    const prepare = champs && (champs.masque & 1 << i) ? champs.reflets[i] : null;
    const camR = prepare ? prepare.camera : cameraReflet(g, cam, ps, l, h, CAM_GLACE);
    camR.sun = CAM_GLACE.sun; camR.allStatic = true;
    const sun = camR.sun;
    sun.center[0] = ps.x; sun.center[1] = ps.y; sun.center[2] = ps.z; sun.extent = scene.ombre.extent; sun.depth = scene.ombre.depth;
    const champ = prepare || champGlace(camR, source.width, source.height);
    const objets = listeGlace(S, camR, sortie, suivie, source.height, i, champ, P.palier, secondeGlace);
    ecarterPiecesHorsGlace(objets, camR, champ, retro.debutEffets, G.opaque ? retro.finEffets : 0);
    retro.foulePublic = publicVisible && retro.vuePublic ? retro.vuePublic.fx : null;
    if (S.nature && (retro.ambianceSource !== S.nature.ambiance || retro.ambianceRevision !== S.nature.ambiance.revision)) {
      if (retro.rendu.setEnvironment) retro.rendu.setEnvironment(S.nature.ambiance.atmosphere);
      retro.ambianceSource = S.nature.ambiance; retro.ambianceRevision = S.nature.ambiance.revision;
    }
    retro.rendu.draw(camR, objets, { time: horlogeReelle, shadows: false, bloom: false, torch: false, sunOnly: true, adaptive: false, frameMs: dureeImage, damage: 0, flash: 0, photo: 0, weather: ambiance, windSources: S.sillage && S.sillage.sources, windStrength: P.windStrength, groundCover: P.groundCover, lights: lampesTunnel(G, i ? 'lampes1' : 'lampes0', scene.decor.tunnelLampes, camR, dtGlace, scene.index), foule: retro.foulePublic });
    if (B.mesures.actif) B.mesures.vue('retro', retro.rendu);
    const ctx = G.ctx[i];
    if (toiles[i].width !== source.width || toiles[i].height !== source.height) {
      toiles[i].width = source.width; toiles[i].height = source.height;
      if (G.opaque) ctx.globalCompositeOperation = 'copy';
    }
    ctx.drawImage(source, 0, 0);
  }
  // Entre le dessin d'une vue et ses deux reflets, les poses monde et les dégâts sont figés.
  // Une autre variante peut réécrire les objets de la table : seule la dernière pose est réutilisable.
  // La silhouette de l'essieu arrière possède sa propre table, réservée à la voiture suivie.
  function cleGeometrieVoiture(o, essieu) {
    return (essieu ? 4 : o.casse ? 3 : RANG_DETAIL[o.detail]) * 4 + o.rouesDetail;
  }
  function retenirGeometrie(prise, cle, liste, debut, attitude) {
    prise.cle = cle; prise.liste = liste; prise.debut = debut; prise.fin = liste.length; prise.attitude = attitude;
  }
  function poserVoitureGlace(S, k, ev, objets, o, essieu, secondeGlace) {
    const poser = essieu ? B.voiture.poserRetro : B.voiture.poser, modele = S.modeles[k];
    const reserve = S.geometrieGlaces, prise = reserve && reserve.voitures[k];
    if (!prise) return poser(modele, ev, objets, o);
    const cle = cleGeometrieVoiture(o, essieu);
    if (prise.cle !== cle) {
      prise.cle = -1;
      if (!secondeGlace) return poser(modele, ev, objets, o);
      const pieces = reserve.pieces, debut = pieces.length;
      const attitude = poser(modele, ev, pieces, o);
      retenirGeometrie(prise, cle, pieces, debut, attitude);
    }
    const liste = prise.liste;
    for (let i = prise.debut; i < prise.fin; i++) objets.push(liste[i]);
    return prise.attitude;
  }
  // Liste propre à une glace (avant : tous les objets de la vue). Décor vivant (faune, effets de saison, aurores),
  // fantôme et feux : ce qui n'est pas derrière la glace (devantGlace). Voitures : reposées au niveau de détail de
  // leur taille dans la toile de la glace, jamais plus lourd que la règle de la vue (plafond, avant le passage au
  // modèle moyen derrière la caméra), aucune à plus de 8 m derrière la glace ; la voiture suivie n'y montre que sa
  // roue arrière (voiture.js, poserRetro). Les effets monde reprennent leur pose principale au même instant,
  // puis la glace choisit ses bandes et conserve les particules qui peuvent entrer dans son champ. Même ordre qu'avant : décor, voitures, fantôme et feux, effets, roue arrière. Les objets de la vue sont
  // réécrits : elle est déjà dessinée.
  function listeGlace(S, camR, sortie, suivie, hauteur, cote, champ, palierVue, secondeGlace) {
    const objets = retro.objets; objets.length = 0;
    const axe = axeCamera(camR, AXE_GLACE), ox = camR.pos[0], oy = camR.pos[1], oz = camR.pos[2];
    for (let k = 0, n = S.iVoitures0; k < n; k++) if (devantGlace(sortie[k], axe, ox, oy, oz)) objets.push(sortie[k]);
    const co = S.course, poses = tampons.poses;
    const tanDemi = champ ? champ.vertical : Math.tan(clamp(camR.fov, 10, 110) * Math.PI / 360);
    const detailsRoues = S.detailsRouesGlaces[cote];
    for (let k = 0; k < co.voitures.length; k++) {
      if (k === suivie.id) continue;
      const p = poses[k], ex = p.x - ox, ez = p.z - oz;
      if (ex * axe[0] + (p.y - oy) * axe[1] + ez * axe[2] < -DERRIERE_CAMERA) continue;
      if (champ) {
        // La pose complète peut avoir été écartée pour les trois vues. Le centre vient
        // toujours de l'interpolation courante, y compris au retour dans la glace.
        POINT_ACTEUR[0]=p.x; POINT_ACTEUR[1]=p.y; POINT_ACTEUR[2]=p.z;
        BORNE_GLACE.p=POINT_ACTEUR; BORNE_GLACE.radius=rayonMonoplace(p);
        if (!visibleDansGlace(BORNE_GLACE, camR, champ)) {
          detailsRoues[k] = detailRouesHorsChamp(p, camR.pos, tanDemi, hauteur, detailsRoues[k], BORNE_GLACE.radius);
          continue;
        }
      }
      const pose = POSES_RENDU[k], v = co.voitures[k];
      const niveauRoues = detailsRoues[k] = B.voiture.detailRouesPour(B.voiture.distanceRoues2(pose, camR.pos, S.modeles[k]), tanDemi, hauteur, detailsRoues[k]);
      const o = optionsGlace(k);
      o.rouesDetail = niveauRoues;
      o.detail = plusLeger(OPTIONS_POSE[k].plafond, detailVoiture(ex * ex + ez * ez, tanDemi, hauteur));
      o.roues = rouesRendues(v); o.casse = !!(v.degats && v.degats.casse);
      const attitude = poserVoitureGlace(S, k, pose, objets, o, false, secondeGlace);
      poserEauCarrosserie(S, k, pose, objets, o.casse ? 'epave' : o.detail, false, attitude,
        ex * ex + ez * ez, tanDemi, hauteur, palierVue);
    }
    for (let k = S.iVoitures1, n = S.iEffets0; k < n; k++) if (devantGlace(sortie[k], axe, ox, oy, oz)) objets.push(sortie[k]);
    const debutEffets = objets.length, partage = S.geometrieGlaces;
    if (partage) B.traces.dessinerReflet(partage.traces, objets, camR.pos, axe);
    else B.traces.dessiner(S.fx, objets, camR.pos, S.hEffets, axe, 0);
    if (S.ech) {
      if (partage) {
        const f = partage.flammes;
        for (let k=f.debut; k<f.debutPilote; k++) objets.push(sortie[k]);
        for (let k=f.finPilote; k<f.fin; k++) objets.push(sortie[k]);
        S.ech.dessines = (f.fin-f.debut) - (f.finPilote-f.debutPilote);
      } else B.echappement.dessiner(S.ech, objets, poses, S.tRendu, suivie.id);
    }
    retro.debutEffets = debutEffets; retro.finEffets = objets.length;
    const R = OPTIONS_RETRO;
    R.roues = rouesRendues(suivie); R.casse = !!(suivie.etat.degats && suivie.etat.degats.casse);
    R.rouesDetail = detailsRoues[suivie.id] = B.voiture.detailRouesPour(B.voiture.distanceRoues2(POSES_RENDU[suivie.id], camR.pos, S.modeles[suivie.id]), tanDemi, hauteur, detailsRoues[suivie.id]);
    poserVoitureGlace(S, suivie.id, POSES_RENDU[suivie.id], objets, R, true, secondeGlace);
    return objets;
  }
  function rouesRendues(v) {
    const perdues = v.degats?.roues, st = v.etat.stands;
    if (st?.phase !== 'service') return perdues;
    const roues = v._rouesAuStand || (v._rouesAuStand = [false,false,false,false]);
    B.equipeStands.rouesDeposees(st, roues, perdues);
    return roues;
  }
  function optionsGlace(k) { return OPTIONS_GLACE[k] || (OPTIONS_GLACE[k] = nouvellesOptions()); }

  // ---------------------------------------------------------------- rendu d'une image
  const MATRICE_LAMPE = cap => {
    const e = B.voiture.euler, A = e(0, -cap, 0), Bm = e(0, 0, -Math.PI / 2);
    const m = [B.voiture.mul(A, Bm[0]), B.voiture.mul(A, Bm[1]), B.voiture.mul(A, Bm[2])];
    return B.voiture.angles(m);
  };
  const tampons = { poses: [], mel: {} };
  const etatOmbres = B.ombres.creer(); // contact, tuile et pénombre de chaque vue (src/ombres.js)
  let horlogeReelle = 0, dureeImage = 16;

  // Objets passés à voiture.js et au moteur, réécrits à chaque image au lieu d'être recréés (ramasse-miettes) :
  // voiture.js lit la pose et les options sans les garder, le moteur relit le soleil et les feux à chaque draw. Une
  // vue (J2, puis J1, puis leurs glaces) finit de s'en servir avant que la suivante les réécrive. Seize voitures au
  // plus (onze rivaux, quatre humains) ; au-delà, les tableaux grandissent.
  const nouvellePose = () => ({ p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, rebond: null, v: 0, etatPneus: null, zonesDegats: null,
    pilote: { volant: 0, rapport: 1, rapportAvant: 1, passage: 1, regime: 0, kmh: 0, alat: 0, along: 0, v: 0, t: 0,
      regard: 0, geste: null, gestePhase: 0, gesteCote: -1, gesteIntensite: 0, passageVisuel: null } });
  const nouvellesOptions = () => ({ detail: 'complet', roues: undefined, casse: false, plafond: 'complet', rouesDetail: 0 });
  const POSES_RENDU = Array.from({ length: 16 }, nouvellePose), OPTIONS_POSE = Array.from({ length: 16 }, nouvellesOptions);
  const POSE_FANTOME = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0 };
  const ETAT_COCKPIT = { regime: 0, volant: 0, rapport: 0, kmh: 0, roues: undefined, casse: false, passage: 1, rapportAvant: undefined,
    derriere: null, ciel: null, brume: null, glaceVive: false, rouesDetail: 0,
    regard: 0, geste: null, gestePhase: 0, gesteCote: -1, gesteIntensite: 0, passageVisuel: null };
  const SUIVEURS = [], RESERVE_SUIVEURS = Array.from({ length: 16 }, () => ({ x: 0, z: 0, couleur: null })), AUCUN_SUIVEUR = Object.freeze([]);
  const SOLEILS = [{ center: [0, 0, 0], extent: 0, depth: 0 }, { center: [0, 0, 0], extent: 0, depth: 0 }];
  const LAMPES_PORTIQUE = [], FEU_ALLUME = [1, .14, .06], FEU_ETEINT = [.1, .03, .03], TAILLE_FEU = [.56, .05, .56];
  // une voiture plus loin que ces 8 m derrière le plan d'une caméra ne s'y voit que par son ombre portée vers l'avant
  const DERRIERE_CAMERA = 8;
  function poseRendu(k, p, roule, etat, etatPneus) {
    const ev = POSES_RENDU[k] || (POSES_RENDU[k] = nouvellePose());
    ev.p[0] = p.x; ev.p[1] = p.y; ev.p[2] = p.z;
    ev.cap = p.cap; ev.tangage = p.tangage; ev.roulis = p.roulis; ev.braquage = p.braquage; ev.roule = roule; ev.rebond = p.rebond; ev.v = etat.v;
    ev.zonesDegats = etat.degats?.zones || null;
    ev.feuStop = (etat.rapport < 0 ? etat.gaz : etat.frein) > .01;
    ev.etatPneus = etatPneus || null;
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
  function detailVoiture(d2, tanDemi, hauteur, palier) {
    if (B.voiture.detailPour(d2, tanDemi, 0) === 'simple') return 'simple';
    const facteur = Math.min(1, hauteur / 1080) * (palier === 'low' ? .62 : 1);
    return B.voiture.detailPour(d2, tanDemi, hauteur, facteur);
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

  // Un seul événement sonore pour chaque départ réel de geste, avant toute vue ou rétroviseur.
  // Toujours vider la file, même si l'audio est absent/muet ou si un menu masque la séance.
  // Les voix et tampons appartiennent à son.js ; ce raccord ne crée aucun contexte ni oscillateur.
  function consommerTroll(S, poses) {
    const X = B.expressionsPilote;
    if (!S.expressions || !X?.consommerEvenement) return;
    const evenement = S.trollEvenement, audio = S.trollAudio, demo = S.type === 'demo';
    const audible = demo ? ecran === 'demo'
      : ecran === 'course' && (S.type === 'course' || S.type === 'chrono' || S.type === 'duo');
    while (X.consommerEvenement(S.expressions, evenement)) {
      if (!audible || !son) continue;
      const p = poses[evenement.pilote];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) continue;
      let ecoute = null, distance2 = Infinity;
      const nombre = demo ? 1 : S.locaux.length || 1;
      for (let n = 0; n < nombre; n++) {
        const id = demo ? S.suivie : S.locaux[n] ?? S.course.joueur.id;
        const q = poses[id] || (demo ? poses[S.course.joueur.id] : null);
        if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.y) || !Number.isFinite(q.z) || !Number.isFinite(q.cap)) continue;
        const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < distance2) { distance2 = d2; ecoute = q; }
      }
      if (!ecoute) continue;
      const dx = p.x - ecoute.x, dz = p.z - ecoute.z, ca = Math.cos(ecoute.cap), sa = Math.sin(ecoute.cap);
      audio.klaxon = evenement.klaxon;
      audio.gain = B.son.gainDistance(Math.sqrt(distance2));
      audio.pan = B.son.panoramique(Math.atan2(-dx * sa + dz * ca, dx * ca + dz * sa));
      son.evenement('troll', audio);
    }
  }

  // Les deux cadrages sont connus avant le premier draw. Un plan de lieu peut viser loin du pilote.
  const cadresDecor = [{ cam: null, pose: null, suivie: null, vue: '' }, { cam: null, pose: null, suivie: null, vue: '' }];
  const pilotesDecor = [[0, 0, 0], [0, 0, 0]], vuesDecor = [];
  function preparerLotDecor(index, loinSeul) { return rendu?.preparerLot?.(index, loinSeul); }
  function approcherDecor(S, cadre1, cadre2, dt) {
    const flux = scene.decor.fluxDecor;
    if (!flux || dt <= 0 || prepa.enCours || contexteRenduPerdu || document.hidden || S.type === 'vitrine' ||
        (ecran !== 'course' && ecran !== 'demo')) return;
    let n = 0;
    for (let k = 0; k < (cadre2 ? 2 : 1); k++) {
      const cadre = k ? cadre2 : cadre1, camera = cadre.cam || (k ? S.vueJ2.camera : S.camera);
      if (camera) {
        vuesDecor[n++] = camera.pos;
        if (camera.cible) vuesDecor[n++] = camera.cible;
      }
      const pose = cadre.pose, p = pilotesDecor[k];
      if (pose) { p[0] = pose.x; p[1] = pose.y; p[2] = pose.z; vuesDecor[n++] = p; }
    }
    vuesDecor.length = n;
    if (n) flux.approcher(vuesDecor, dt, preparerLotDecor);
  }

  function rendreImage(S, alpha, dtImage) {
    appliquerCarte();
    const co = S.course, j = co.joueur;
    const poses = tampons.poses;
    for (let k = 0; k < co.voitures.length; k++) {
      const pose = poses[k] = melange(S.prec[k], S.cour[k], alpha, poses[k] || creationTardive('poses', {}));
      const st = co.voitures[k].etat.stands;
      if (st?.phase === 'service') pose.y += B.equipeStands.hauteurCric(st);
    }
    // Temps rendu, une fois par image : les voitures sont dessinées entre leurs deux dernières poses, à l'instant
    // horloge − pas + alpha × pas. Fantôme, caméras de la démo, secousses du casque, aurores et effets le suivent :
    // pris au dernier pas, ils avançaient par sauts de 1/120 s (à 144 Hz, une image sur six sans pas les figeait) et
    // devançaient les voitures d'un pas au plus. La vue du joueur 2 hérite des deux valeurs (Object.create).
    S.retardImage = (1 - alpha) * DT; S.tRendu = co.horloge - S.retardImage;
    if (S.expressions) {
      B.expressionsPilote.actualiser(S.expressions, co, poses, S.tRendu, S.type === 'demo');
      consommerTroll(S, poses);
    }
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
      if (co.voitures[k].etat._physx && !co.voitures[k].distant) continue; // débattement de suspension PhysX interpolé
      const v = Math.abs(co.voitures[k].etat.v), a = .0035 * clamp(v / 60, 0, 1) * (co.voitures[k].etat.surface === 'herbe' ? 3 : co.voitures[k].etat.surface === 'vibreur' ? 2.2 : 1);
      const reb = p.rebond || (p.rebond = creationTardive('rebond', [0, 0, 0, 0])), t = horlogeReelle, s0 = p.roule * 1.7;
      for (let r = 0; r < 4; r++) reb[r] = a * (Math.sin(s0 + r * 1.9) * .6 + Math.sin(s0 * 2.3 + r * .7 + t * 3) * .4);
    }
    if (co.physique?.solids.mobiles.length) B.solidesPhysX.lireMobiles(co.physique.solids);
    const meteo = majMeteo(S, dtImage);
    majEauCarrosserie(S, poses, dtImage, meteo);
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
      // Cadence du second joueur (src/graphismes.js) : au palier serré (30 Hz), sa vue est rendue au temps et garde
      // entre-temps la dernière copiée ; le joueur 1 garde toute la fluidité de la sienne. Le compte d'images en
      // faisait 72 Hz sur un écran 144 Hz et 15 Hz à 30 images par seconde, et la vue ne recevait que l'intervalle
      // d'une image : caméras lissées, secousses, pluie et cadence de ses glaces tournaient à moitié. Elle reçoit
      // maintenant tout le temps écoulé depuis son rendu précédent. Toujours rendue : à la première image d'une séance,
      // et aux images arrêtées (pause, quatre par seconde, sans temps qui passe) où un réglage peut avoir changé.
      const hzJ2 = P.secondaires.partage.hz;
      S.dtJ2 = (S.dtJ2 || 0) + dtImage;
      const dtJ2 = S.dtJ2, refaireJ2 = hzJ2 >= 55 || !S.j2Rendue || dtImage === 0 || dtJ2 + dtImage / 2 >= 1 / hzJ2;
      const cadre1 = cadresDecor[0], cadre2 = cadresDecor[1];
      if (refaireJ2) {
        S.dtJ2 = 0; S.j2Rendue = true;
        rendreVue(S.vueJ2, co.voitures[S.locaux[1]], reglages.vue2, dtJ2, meteo, cadre2);
      } else {
        cadre2.cam = S.vueJ2.camera; cadre2.pose = poses[S.locaux[1]];
      }
      rendreVue(S, j, reglages.vue, dtImage, meteo, cadre1);
      approcherDecor(S, cadre1, cadre2, dtImage);
      if (refaireJ2 && cadre2.cam) {
        dessinerVue(S.vueJ2, cadre2.suivie, cadre2.vue, dtJ2, meteo, cadre2.cam, cadre2.pose);
        const t2 = $('scene2'), ctx2 = t2._ctx || (t2._ctx = creationTardive('toileJ2', t2.getContext('2d')));
        if (t2.width !== canvas.width || t2.height !== canvas.height) { t2.width = canvas.width; t2.height = canvas.height; }
        ctx2.drawImage(canvas, 0, 0);
      }
      const camJ1 = cadre1.cam && dessinerVue(S, cadre1.suivie, cadre1.vue, dtImage, meteo, cadre1.cam, cadre1.pose);
      poserGlaces();
      return camJ1;
    }
    // caméra : celle du joueur, ou celle que choisit le réalisateur de la démo
    let vue = reglages.vue, suivie = j;
    if (S.type === 'vitrine') { suivie = co.voitures[co.classement[S.suiviRang || 0]] || j; vue = 'tele'; }
    else if (S.type === 'demo') {
      B.cinema.regler(S.cinema, { faune: B.animaux.qualite(reglages.faune, P.palier), nuit: S.nature?.ambiance.nuit || 0, pluie: meteo.pluie || 0 });
      const pl = B.realisateur.tenir(S.real, co, S.cinema, S.expressions, co.voitures[co.classement[0]].etat.s);
      // coupe : les caméras lissées repartent de la nouvelle voiture, les écarts du son aussi
      if (S.planVu !== pl) { S.planVu = pl; S.camCap = null; S.tete = null; S.tele.poste = null; S.distances.fill(-1); S.vRel.fill(0); S.secousse = 0; }
      vue = pl.vue; suivie = co.voitures[pl.sujet];
    } else if (j.fini && S.finA !== null && co.horloge - S.finA > 2.5) vue = 'tele';
    const cadre = cadresDecor[0];
    rendreVue(S, suivie, vue, dtImage, meteo, cadre);
    approcherDecor(S, cadre, null, dtImage);
    const camVue = cadre.cam && dessinerVue(S, cadre.suivie, cadre.vue, dtImage, meteo, cadre.cam, cadre.pose);
    poserGlaces();
    return camVue;
  }
  // Une vue : caméra, objets, effets et rendu, pour la voiture suivie. S est l'état de la vue (la séance, ou celui du
  // joueur 2 à deux, qui hérite de la séance).
  function rendreVue(S, suivie, vue, dtImage, meteo, cadre) {
    const co = S.course, poses = tampons.poses, pj = poses[0];
    if (cadre) { cadre.cam = null; cadre.pose = poses[suivie.id]; }
    let cam;
    if (DANS_LA_ROCHE.has(vue) && B.circuit.dansCouvert(co.c, suivie.etat.s, 8)) {
      if (S.type === 'demo') {
        S.planVu = B.realisateur.replier(S.real, co, 'poursuite', suivie.id);
        suivie = co.voitures[S.planVu.sujet];
        S.camCap = null; S.tete = null; S.tele.poste = null; S.distances.fill(-1); S.vRel.fill(0); S.secousse = 0;
      }
      vue = 'poursuite';
    }
    let ps = poses[suivie.id];
    if (B.cinema.VUES.includes(vue)) {
      cam = B.cinema.camera(S.cinema, S.planVu, poses, co, S.tRendu);
      if (!cam) {
        // Coupe explicite, sans conserver l'ancien plan ni ses filtres quand son sujet devient masqué.
        S.planVu = B.realisateur.replier(S.real, co, 'poursuite', suivie.id); S.camCap = null; S.tete = null; S.tele.poste = null;
        suivie = co.voitures[S.planVu.sujet]; ps = poses[suivie.id];
        S.distances.fill(-1); S.vRel.fill(0); S.secousse = 0;
        vue = 'poursuite'; cam = cameraPoursuite(S, ps, suivie.etat, dtImage);
      }
    } else if (vue === 'tele') cam = cameraTele(S, suivie, ps);
    else if (vue === 'helico') cam = cameraHelico(S, ps, dtImage);
    else if (vue === 'sol') cam = cameraSol(S, suivie, ps);
    else if (CAMERAS_DEMO.has(vue)) cam = cameraDemo(S, ps, S.planVu, vue);
    else if (ANCRAGES_CAMERAS[vue]) cam = cameraEmbarquee(ps, suivie.etat, vue);
    else cam = vue === 'cockpit' ? cameraCockpit(S, ps, suivie.etat, S.tRendu, dtImage) : cameraPoursuite(S, ps, suivie.etat, dtImage, vue);
    S.poseSuivie = ps;
    if (B.cameraTransition && S.camTransition && S.camTransition.actif && VUES_COURSE.includes(vue) && !S.regardArriere && !S.reference && S.type !== 'demo') {
      cam = B.cameraTransition.appliquer(S.camTransition, cam, dtImage, { solY: ps.y, carPos: [ps.x, ps.y, ps.z], carCap: ps.cap });
    }
    if (S.type === 'demo') {
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      // Toutes les vues passent par le même contrôle, y compris les anciens plans télé, sol et orbite.
      // Un refus change réellement de plan : le repli ne revient pas dans le plan masqué à l'image suivante.
      const accepte = vue === 'poursuite' || B.cinema.valider(S.cinema, cam, cam.cible || [ps.x, ps.y + .65, ps.z], S.planVu, S.tRendu, aspect);
      if (accepte) S.secoursCamera = null;
      else if (S.secoursCamera === S.planVu) {
        // Une voiture coincée ne provoque pas une rafale de coupes : conserver le dernier cadre libre,
        // puis reprendre le support embarqué dès qu'il redevient possible.
        cam = B.cinema.secours(S.cinema, aspect);
        if (!cam) return;
        vue = cam.sujetNature ? 'panorama' : 'tele';
      } else {
        S.planVu = B.realisateur.replier(S.real, co, 'poursuite', suivie.id);
        suivie = co.voitures[S.planVu.sujet]; ps = poses[suivie.id];
        S.camCap = null; S.tete = null; S.tele.poste = null;
        S.distances.fill(-1); S.vRel.fill(0); S.secousse = 0;
        vue = 'poursuite'; cam = cameraPoursuite(S, ps, suivie.etat, dtImage);
      }
      if (vue === 'poursuite') {
        const libre = B.cinema.poursuite(S.cinema, cam, ps, S.planVu, S.tRendu, aspect);
        if (libre) cam = libre;
        else {
          // Si aucun bras extérieur ne tient, coupe sur le support embarqué au-dessus de l'arceau.
          S.planVu = B.realisateur.replier(S.real, co, 'aileron', suivie.id);
          suivie = co.voitures[S.planVu.sujet]; ps = poses[suivie.id];
          S.camCap = null; S.tete = null; S.tele.poste = null;
          S.distances.fill(-1); S.vRel.fill(0); S.secousse = 0;
          vue = 'aileron'; cam = cameraDemo(S, ps, S.planVu);
          if (!B.cinema.valider(S.cinema, cam, cam.cible || [ps.x, ps.y + .65, ps.z], S.planVu, S.tRendu, aspect)) {
            S.planVu = B.realisateur.replier(S.real, co, 'cockpit', suivie.id);
            S.camCap = null; S.tete = null;
            vue = 'cockpit'; cam = cameraCockpit(S, ps, suivie.etat, S.tRendu, dtImage);
            if (!B.cinema.valider(S.cinema, cam, [ps.x, ps.y + .65, ps.z], S.planVu, S.tRendu, aspect)) {
              S.secoursCamera = S.planVu;
              cam = B.cinema.secours(S.cinema, aspect);
              if (!cam) return;
              vue = cam.sujetNature ? 'panorama' : 'tele';
            }
          }
        }
      }
    }
    if (regardArriereVoulu(S, suivie, vue)) cam = cameraRegardArriere(S, ps, cam, vue);
    if (cameraEssai) cam = Object.assign({ roll: 0, near: .1, far: PORTEE_VUE, fov: 40 }, cameraEssai(pj, cam));
    if (S.secousse > 0 && !cam.sujetNature) {
      const pitchSur = cam.pitch, yawSur = cam.yaw;
      const a = S.secousse * .05 * reglages.secousses, t = horlogeReelle;
      cam.pitch += Math.sin(t * 61) * a * .5; cam.yaw += Math.sin(t * 47) * a * .35;
      if (S.type === 'demo' && a > 0 && !B.cinema.valider(S.cinema, cam, cam.cible || [ps.x, ps.y + .65, ps.z], S.planVu, S.tRendu, canvas.clientWidth / Math.max(1, canvas.clientHeight))) {
        cam.pitch = pitchSur; cam.yaw = yawSur;
      }
      S.secousse = Math.max(0, S.secousse - dtImage * 2.6);
    }
    if (S.type === 'demo' && !S.secoursCamera) cam = B.cinema.souffle(S.cinema, cam, S.planVu, poses, co, S.tRendu, reglages.secousses, canvas.clientWidth / Math.max(1, canvas.clientHeight));
    if (cadre) {
      cadre.cam = cam; cadre.pose = ps; cadre.suivie = suivie; cadre.vue = vue;
      return cam;
    }
    return dessinerVue(S, suivie, vue, dtImage, meteo, cam, ps);
  }
  function dessinerVue(S, suivie, vue, dtImage, meteo, cam, ps) {
    const co = S.course, c = co.c, sortie = S.sortie, poses = tampons.poses, pj = poses[0], RV = S.rouleVu;
    const P = profilDe(S), exterieur = VUES_DEHORS.has(vue);
    sortie.length = 0;
    // axe horizontal du regard, en deux nombres (plus de tableau neuf par image)
    const avX = Math.sin(cam.yaw), avZ = -Math.cos(cam.yaw);
    // ombres du soleil autour de ce que l'on regarde : devant le pilote (jusqu'à 176 m), ou autour de la voiture filmée.
    // Un soleil par vue, réécrit à chaque image : le moteur le relit à chaque draw sans le garder.
    cam.sun = cam.sujetNature ? soleilDe(S === session ? 0 : 1, cam.cible[0], cam.cible[1], cam.cible[2])
      : soleilDe(S === session ? 0 : 1, exterieur ? ps.x : cam.pos[0] + avX * OMBRE_DEVANT, ps.y, exterieur ? ps.z : cam.pos[2] + avZ * OMBRE_DEVANT);
    // Le jeu ne confie aucun objet statique au moteur (setWorld([], …) partout) : allStatic lui évite d'interroger à
    // chaque draw un index spatial vide (clés de grille et tableaux temporaires). Image identique.
    cam.allStatic = true;

    // Le même filtre FERRO considère la caméra et les volumes projetant des ombres.
    // Les glaces reposent ensuite leurs voitures indépendamment de la vue principale.
    const optionsVisibilite = S.optionsVisibilite || (S.optionsVisibilite = { sunOnly: true });
    optionsVisibilite.time = horlogeReelle;
    optionsVisibilite.shadows = avecOmbres(P);
    optionsVisibilite.reflections = avecReflets(S, P, meteo);
    const acteurVisible = rendu?.actorFilter?.(cam, optionsVisibilite);
    const avecGlaces = glacesVives(S, vue);

    const sNature = cam.sujetNature && S.planVu?.ancre ? S.planVu.ancre.s : suivie.etat.s;
    const plage = S.nature?.secteurs?.a(sNature);
    const saisonLocale = S.saisonLocale = plage && S.nature.saison ? plage.profils[S.nature.saison.id] : S.nature?.saison;
    const champsActeurs = S.visibiliteActeurs;
    if (champsActeurs) champsActeurs.principal = acteurVisible;
    // Le cadrage du cockpit a déjà transformé les deux glaces de cette voiture. Le champ
    // réfléchi et la projection CSS lisent les mêmes coins, même pendant une transition de caméra.
    const glacesCockpit = vue === 'cockpit' && S.cadrageCockpit?.glaces;
    const glacesMonde = preparerChampsFaune(S, vue, cam, ps, P, champsActeurs, avecGlaces, glacesCockpit) || glacesCockpit;
    // La simulation de la faune conserve les deux champs. Pour le dessin de cette image,
    // seuls les rétros à repeindre ont besoin du décor animé, des voitures et des embruns.
    const planGlaces = planifierGlaces(S, cam, ps, dtImage, glacesMonde, avecGlaces, P);
    if (champsActeurs) {
      const actifs = planGlaces ? planGlaces.masque : 0;
      champsActeurs.indetermine = !!(actifs & ~champsActeurs.masque);
      champsActeurs.masque &= actifs;
    }
    const toutesVues = planGlaces ? champsActeurs?.visible : acteurVisible;
    // Habitats partagés ; pools propres aux deux vues. Le temps absolu garde les mêmes vols dans les miroirs.
    if (S.nature && B.faune && P.faune !== 'off' && (!saisonLocale || saisonLocale.faune > 0 || S.fauneVue)) {
      const nature = S.nature;
      if (!nature.faune) nature.faune = creationTardive('faune', B.faune.creer(c, scene.decor));
      const contexte = S.fauneVue || (S.fauneVue = creationTardive('contexteFaune', { qualite: P.faune, nuit: 0, pluie: 0, pose: ps, vue: S === session ? 0 : 1 }));
      contexte.qualite = P.faune; contexte.nuit = nature.ambiance.nuit; contexte.pluie = meteo.pluie || 0; contexte.pose = cam.sujetNature ? S.cinema.poseVue : ps;
      contexte.activite = saisonLocale ? saisonLocale.faune : 1;
      contexte.camera = cam; contexte.aspect = canvas.width / Math.max(1, canvas.height); contexte.vuesSecondaires = S.fauneSecondaires;
      B.faune.dessiner(nature.faune, horlogeReelle, contexte, sortie);
    }
    // Hélicoptère TV & drones métal de tournage : suivi peloton de tête + balayage vers le dernier,
    // survol haut anti-tunnel, anti-arbres et anti-décor (ZÉRO couplage au cap du joueur).
    if (B.aeriens && S.type !== 'vitrine') {
      const ae = S.aeriens || (S.aeriens = creationTardive('aeriens', B.aeriens.creer(c, { qualite: P.palier })));
      const ctxAe = S.aeriensVue || (S.aeriensVue = creationTardive('contexteAeriens', { qualite: P.palier, sTete: 0, sDernier: 0, sCible: 0, nuit: 0, sol: null }));
      const cl = co.classement;
      const vTete = cl && cl.length ? co.voitures[cl[0]] : suivie;
      const vDernier = cl && cl.length ? co.voitures[cl[cl.length - 1]] : suivie;
      ctxAe.qualite = P.palier;
      ctxAe.sTete = vTete && vTete.etat ? vTete.etat.s : (suivie.etat.s || 0);
      ctxAe.sDernier = vDernier && vDernier.etat ? vDernier.etat.s : ctxAe.sTete;
      ctxAe.sCible = suivie.etat.s || 0;
      ctxAe.nuit = S.nature?.ambiance?.nuit || 0;
      ctxAe.sol = scene.decor.sol; ctxAe.visible = toutesVues;
      B.aeriens.dessiner(ae, S.tRendu, ctxAe, sortie);
    }
    // Panneaux directionnels de virage animés + bandeaux LED dynamiques du portique
    if (B.signalisationCourse && S.type !== 'vitrine') {
      const sig = S.signalisation || (S.signalisation = creationTardive('signalisation', B.signalisationCourse.creer(c, scene.decor)));
      const ctxSig = S.signalisationVue || (S.signalisationVue = creationTardive('contexteSignalisation', { qualite: P.palier, course: co, pluie: 0, nuit: 0, cameraPos: null }));
      ctxSig.qualite = P.palier;
      ctxSig.mouvementReduit = !!preferenceMouvement?.matches;
      ctxSig.pluie = meteo.pluie || 0; ctxSig.nuit = S.nature?.ambiance?.nuit || 0; ctxSig.cameraPos = cam.pos;
      ctxSig.course = co;
      // Les glaces réutilisent cette liste de balises. Garder leur champ arrière lorsqu’elles sont actives.
      ctxSig.visible = toutesVues;
      B.signalisationCourse.mettreAJour(sig, S.tRendu, ctxSig, sortie);
    }
    if (co.physique) {
      for (const mobile of co.physique.solids.mobiles) {
        const point = mobile.objet.p;
        if (!toutesVues || toutesVues(point[0],point[1],point[2],mobile.rayon)) sortie.push(mobile.objet);
      }
    } else {
      for (const modele of scene.decor.mobilesPhysX || []) sortie.push(modele);
    }
    // Les poses du stand utilisent les mêmes véhicules interpolés que le cockpit et ses rétroviseurs.
    if (B.equipeStands && c.stands && S.type !== 'vitrine') {
      const eq = S.equipeStands || (S.equipeStands = creationTardive('equipeStands', B.equipeStands.creer(c, scene.decor)));
      const ctxEq = S.equipeStandsVue || (S.equipeStandsVue = creationTardive('contexteEquipeStands', { course: null, nuit: 0, cameraPos: null }));
      ctxEq.course = co; ctxEq.nuit = S.nature?.ambiance?.nuit || 0; ctxEq.cameraPos = cam.pos; ctxEq.visible = toutesVues; ctxEq.poses = poses;
      B.equipeStands.animer(eq, S.tRendu, ctxEq, sortie);
    }
    // Animaux des abords : poses du cerveau interpolées à l'instant affiché des voitures (même horloge de course,
    // mêmes images à 30, 60 ou 120 images/s). Quelques animaux proches en Légère ; aucune pose
    // hors de la vue principale et des champs réfléchis réellement actifs. Contextes préchargés.
    if (!S.animaux && reglages.faune !== 'off' && S.nature && B.animaux) S.animaux = animauxDe(scene, S.nature);
    if (S.animaux && reglages.faune !== 'off') {
      const contexte = S.animauxVue || (S.animauxVue = creationTardive('contexteAnimaux', { vue: S === session ? 0 : 1, qualite: 'off', camera: null, hauteur: 720, aspect: 16 / 9, vuesSecondaires: S.fauneSecondaires, nuit: 0, pluie: 0 }));
      contexte.qualite = B.animaux.qualite(reglages.faune, P.palier); contexte.camera = cam;
      contexte.hauteur = canvas.height; contexte.aspect = canvas.width / Math.max(1, canvas.height);
      contexte.vuesSecondaires = S.fauneSecondaires;
      contexte.nuit = S.nature ? S.nature.ambiance.nuit : 0; contexte.pluie = meteo.pluie || 0;
      B.animaux.dessiner(S.animaux, S.tRendu, contexte, sortie);
    }
    if (S.nature && B.effetsSaison && saisonLocale && (S.nature.effetsSaison || saisonLocale.feuilles || saisonLocale.neige || meteo.neige)) {
      const nature = S.nature;
      if (!nature.effetsSaison) nature.effetsSaison = creationTardive('effetsSaison', B.effetsSaison.creer(c, scene.decor));
      const contexte = S.saisonVue || (S.saisonVue = creationTardive('contexteSaison', { qualite: 'low', nuit: 0, pluie: 0, neige: 0, ventX: 0, ventZ: 0, pose: cam.pos, vue: S === session ? 0 : 1, abri: false }));
      contexte.qualite = P.decor.vegetationQualite === 'ultra' ? 'ultra' : P.palier;
      contexte.nuit = nature.ambiance.nuit; contexte.pluie = meteo.pluie || 0;
      contexte.neige = precipitationsNeige(S); contexte.saison = saisonLocale;
      contexte.ventX = meteo.ventX || 0; contexte.ventZ = meteo.ventZ || 0; contexte.pose = cam.pos;
      contexte.abri = sousLaVoute(c, cam.pos);
      B.effetsSaison.dessiner(nature.effetsSaison, horlogeReelle, contexte, sortie);
    }

    // Rubans lointains en géométrie monde : occultés par le relief, repris dans les rétroviseurs.
    if (S.nature?.aurorePossible) {
      const nature = S.nature;
      if (!nature.aurores) nature.aurores = creationTardive('aurores', B.aurores.creer(c));
      const contexte = S.auroresVue || (S.auroresVue = creationTardive('contexteAurores', { vue: S === session ? 0 : 1, qualite: 'low', nuit: 0, pluie: 0, neige: 0, nuages: 0, tunnel: false }));
      contexte.qualite = P.palier; contexte.nuit = nature.ambiance.nuit;
      contexte.pluie = meteo.pluie || 0; contexte.neige = precipitationsNeige(S); contexte.nuages = meteo.nuage || 0;
      // Les rideaux apparaissent sur 160 m à l'entrée de Lande-Noire et s'effacent au retour vers le fjord.
      contexte.presence = plage ? (plage.theme === 'islande' ? clamp(Math.min(sNature-plage.debut, plage.fin-sNature)/160, 0, 1) : 0) : 1;
      contexte.tunnel = sousLaVoute(c, cam.pos);
      B.aurores.dessiner(nature.aurores, S.tRendu, contexte, sortie);
    }

    // Voitures retenues par la caméra et les ombres. Le détail dépend de la taille à l'écran : la hauteur de la
    // toile suit l'écran et la résolution du profil ; le seuil suit le champ (un téléobjectif garde le modèle complet
    // bien plus loin).
    const tanDemi = Math.tan(clamp(cam.fov, 10, 110) * Math.PI / 360), hauteur = canvas.height;
    const geometrieGlaces = planGlaces && S.geometrieGlaces;
    if (geometrieGlaces) {
      geometrieGlaces.pieces.length = 0;
      for (const prise of geometrieGlaces.voitures) prise.cle = -1;
    }
    S.iVoitures0 = sortie.length;   // repères de la liste pour celle des glaces (listeGlace)
    let ombreDebut = 0, ombreFin = 0; // objets de la voiture filmée dans sortie : sa tuile d'ombre (src/ombres.js)
    for (let k = 0; k < co.voitures.length; k++) {
      const p = poses[k], dx = p.x - cam.pos[0], dz = p.z - cam.pos[2], d2 = dx * dx + dz * dz;
      const rayon = rayonMonoplace(p);
      const visible = k === suivie.id || !acteurVisible || acteurVisible(p.x, p.y, p.z, rayon);
      if (!visible && !avecGlaces) continue;
      if (!visible && champsActeurs && !champsActeurs.reflete(p.x, p.y, p.z, rayon)) {
        S.detailsRoues[k] = detailRouesHorsChamp(p, cam.pos, tanDemi, hauteur, S.detailsRoues[k], rayon);
        continue;
      }
      const etRoue = co.voitures[k].etat, serviceRoue = etRoue.stands;
      const monteVisible = serviceRoue?.phase === 'service' && serviceRoue.t >= .625*serviceRoue.duree ? serviceRoue.pneus : etRoue.pneus;
      B.voiture.changerPneus(S.modeles[k], monteVisible);
      const etatsPneus = co.voitures[k].distant && S.pneusVisuels ? S.pneusVisuels[k] : co.voitures[k].etat.etatPneus;
      const ev = poseRendu(k, p, RV[k], co.voitures[k].etat, etatsPneus);
      const pilote = ev.pilote, voiture = co.voitures[k], etatPilote = voiture.etat;
      pilote.volant = etatPilote.volant; pilote.rapport = etatPilote.rapport;
      pilote.rapportAvant = voiture.rapportAvant === undefined ? etatPilote.rapport : voiture.rapportAvant;
      pilote.passage = voiture.tPassage === undefined ? 1 : clamp((S.tRendu - voiture.tPassage) / .36, 0, 1);
      pilote.alat = etatPilote.alat; pilote.along = etatPilote.along; pilote.v = etatPilote.v; pilote.t = S.tRendu;
      // Les instruments appartiennent à la voiture : même mesure pour l'habitacle, les rivaux et les rétros.
      pilote.regime = etatPilote.regime; pilote.kmh = B.conduite.kmh(etatPilote);
      if (S.expressions) B.expressionsPilote.lire(S.expressions, k, pilote);
      // Hystérésis propre à cette vue : ni la seconde moitié d'écran ni les deux miroirs ne la réécrivent.
      const rouesDetail = S.detailsRoues[k] = B.voiture.detailRouesPour(B.voiture.distanceRoues2(ev, cam.pos, S.modeles[k]), tanDemi, hauteur, S.detailsRoues[k]);
      if (k === suivie.id) ombreDebut = sortie.length;
      if (k === suivie.id && vue === 'cockpit') {
        const et = suivie.etat, atm = S.nature ? S.nature.ambiance.atmosphere : scene.decor.atmosphere, glaceVive = avecGlaces;
        const etc = ETAT_COCKPIT;
        etc.regime = et.regime; etc.volant = et.volant; etc.rapport = et.rapport; etc.kmh = B.conduite.kmh(et);
        etc.rouesDetail = rouesDetail;
        etc.roues = rouesRendues(co.voitures[k]); etc.casse = !!(et.degats && et.degats.casse);
        etc.passage = pilote.passage; etc.rapportAvant = pilote.rapportAvant;
        etc.regard = pilote.regard; etc.geste = pilote.geste; etc.gestePhase = pilote.gestePhase;
        etc.gesteCote = pilote.gesteCote; etc.gesteIntensite = pilote.gesteIntensite;
        etc.passageVisuel = pilote.passageVisuel;
        // les rivaux de la glace peinte ne servent que sans image réelle des glaces
        etc.derriere = glaceVive ? AUCUN_SUIVEUR : suiveurs(co, poses, k, p);
        etc.ciel = atm.skyBottom; etc.brume = atm.fog; etc.glaceVive = glaceVive;
        const attitude = B.voiture.cockpit(S.modeles[k], ev, sortie, etc);
        poserEauCarrosserie(S, k, ev, sortie, etc.casse ? 'epave' : 'complet', true, attitude,
          d2, tanDemi, hauteur, P.palier);
        ombreFin = sortie.length;
        continue;
      }
      // Derrière le plan de la caméra, une voiture ne se voit que par son ombre : modèle moyen au plus, même
      // silhouette. Les glaces la reposent à leur propre niveau, plafonné par la règle de la vue.
      const o = optionsPose(k);
      o.plafond = detailVoiture(d2, tanDemi, hauteur, k === suivie.id ? null : P.palier);
      o.rouesDetail = rouesDetail;
      o.detail = o.plafond === 'complet' && dx * avX + dz * avZ < -DERRIERE_CAMERA ? 'moyen' : o.plafond;
      o.roues = rouesRendues(co.voitures[k]); o.casse = !!(co.voitures[k].degats && co.voitures[k].degats.casse);
      if (!visible) continue;
      const debut = sortie.length, attitude = B.voiture.poser(S.modeles[k], ev, sortie, o);
      // L'eau conserve son propre détail par caméra. La plage ne couvre que la voiture.
      const prise = geometrieGlaces && geometrieGlaces.voitures[k];
      if (prise && k !== suivie.id) retenirGeometrie(prise, cleGeometrieVoiture(o, false), sortie, debut, attitude);
      poserEauCarrosserie(S, k, ev, sortie, o.casse ? 'epave' : o.detail, false, attitude,
        d2, tanDemi, hauteur, P.palier);
      if (k === suivie.id) ombreFin = sortie.length;
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
      if (!S.rotLampe) S.rotLampe = creationTardive('feuxPortique', MATRICE_LAMPE(port.cap));
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
    B.traces.dessiner(S.fx, sortie, cam.pos, S.hEffets, axeCamera(cam, AXE_VUE), 0, geometrieGlaces && geometrieGlaces.traces, glacesMonde);
    // Les rétros réutilisent ces mêmes flammes, sauf celles de la voiture qui porte le miroir.
    if (S.ech) {
      const plage = geometrieGlaces && geometrieGlaces.flammes;
      if (plage) plage.pilote = suivie.id;
      B.echappement.dessiner(S.ech, sortie, poses, S.tRendu, vue === 'cockpit' ? suivie.id : -1, plage);
    }
    if (tFx) { const dFx = performance.now() - tFx; if (S.banc) S.banc.effets += dFx; if (B.mesures.actif) B.mesures.section('effets', dFx); }
    // uEffects.z colore tout l'écran : la rougeur suit seulement l'éclair du choc, jamais les dégâts persistants.
    const eclair = S.eclair || 0;
    // Tunnel : l'œil s'adapte d'après la caméra, pas d'après la seule voiture suivie. En entrant, l'intérieur paraît
    // d'abord sombre puis s'éclaircit (0,8 s) ; en sortant, le jour éblouit un instant (0,3 s). Les lampes gardent
    // leur puissance : seules l'adaptation de l'œil et les contributions lissées de lampesTunnel changent.
    const sousVoute = sousLaVoute(c, cam.pos, true), cibleLumiere = sousVoute ? 1.32 : 1;
    S.lumiere = S.lumiere ?? 1;
    S.lumiere += (cibleLumiere - S.lumiere) * (1 - Math.exp(-dtImage / (cibleLumiere > S.lumiere ? .8 : .3)));
    const LT = scene.decor.tunnelLampes;
    const lampes = lampesTunnel(S, 'lampesTunnel', LT, cam, dtImage, scene.index);
    // Halo/bloom : ouverts ou fermés par le profil résolu (menu, gouverneur et capacités du moteur)
    const haloInt = avecHalo(P);
    // Le public : excitation et regard par section d'après les voitures, abris d'après la pluie et la neige, fête au
    // départ et au drapeau à damier. Le temps fait l'animation (même mouvement à toute cadence) ; aucune allocation
    // (l'ambiance est créée par prechargerSeance).
    const vuePublic = publicVisible && scene.vuePublic;
    if (vuePublic) {
      const A = S.ambiancePublic || (S.ambiancePublic = creationTardive('ambiancePublic', ambiancePublic()));
      A.pluie = meteo.pluie || 0; A.neige = precipitationsNeige(S); A.mouille = Math.max(meteo.mouille || 0, A.pluie);
      A.feux = co.feux ? co.feux.allumes : 0; A.vert = !co.feux || co.feux.vert; A.termine = co.drapeau !== null && co.drapeau !== undefined;
      B.public.animer(scene.public, horlogeReelle, poses, co.voitures.length, A);
      if (S.palierPublic !== P.palier) { vuePublic.qualite(P.palier); S.palierPublic = P.palier; }
    }
    S.foulePublic = vuePublic ? vuePublic.fx : null;
    const ombresVue = B.ombres.preparer(etatOmbres, P, cam, poses, co.voitures.length, suivie.id, ombreDebut, ombreFin, (S.banc ? S.banc.qualite : reglages.qualite) === 'auto' ? palier.n : -1, horlogeReelle);
    const tDraw = B.mesures.actif ? performance.now() : 0;
    // adaptive: false partout : le gouverneur du moteur baissait la taille de l'image au fil des images lentes, en
    // pleine conduite, et la vitrine des menus léguait l'échelle réduite à la course suivante. La qualité Auto
    // (paliers) et la cadence décident seules ; la résolution ne change qu'à un arrêt.
    // La caméra de chaque joueur prépare ses propres branches périphériques. Les glaces et les
    // vues du réalisateur retrouvent les seuils de la scène, y compris si le dessin échoue.
    const detail = scene.detailPeripherique;
    try {
      if (!S.regardArriere && !S.camTransition?.actif && VUES_COURSE.includes(vue) && S.type !== 'demo' && S.type !== 'vitrine') {
        B.detailPeripherique.appliquer(detail, c, suivie.etat, cam, canvas.width, canvas.height);
      }
      rendu.draw(cam, sortie, { time: horlogeReelle, msaa: P.rendu.msaa === 4, shadowMapScale: P.rendu.shadowMapScale, shadows: avecOmbres(P), bloom: haloInt, brightness: S.lumiere, lights: lampes, torch: false, sunOnly: true, adaptive: false, frameMs: dureeImage, damage: eclair, flash: eclair, photo: haloInt ? 1 : 0, reflections: optionsVisibilite.reflections, weather: S.ambianceImage, windSources: S.sillage && S.sillage.sources, windStrength: P.windStrength, groundCover: P.groundCover, foule: S.foulePublic, contacts: ombresVue.contacts, ombreProche: ombresVue.ombreProche, penombre: ombresVue.penombre });
    } finally { B.detailPeripherique.restaurer(detail); }
    if (B.mesures.actif) {
      B.mesures.section('rendu', performance.now() - tDraw);
      B.mesures.vue(S === session ? 'principale' : 'joueur2', rendu, { lampes: lampes ? lampes.length : 0, ombres: avecOmbres(P) });
    }
    dessinerMeteo(S, dtImage, cam, vue, P, suivie);
    peindreGlacesPlanifiees(S, planGlaces, cam, ps, sortie, S.ambianceImage, suivie, P);
    if (S.eclair > 0) S.eclair = Math.max(0, S.eclair - dtImage * 3.2);
    S.camera = cam; S.vue = vue; S.suivie = suivie.id;
    const affichage = S.type === 'duo' && S !== session ? hud2 : $('hud');
    if (affichage.dataset.vue !== vue) affichage.dataset.vue = vue;
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
    const PR = B.conduite.PARAMS;
    sortie.deriveRelative = Math.max(Math.abs(et.deriveAv) / PR.alphaAv, Math.abs(et.deriveAr) / PR.alphaAr);
    sortie.blocage = et.blocage; sortie.patinage = et.patinage;
    sortie.raclement = S.raclement && (ecran === 'course' || ecran === 'demo') && !voiture.fini && !voiture.abandon && !et.recuperation &&
      S.raclement.acteur === et._physx ? S.raclement : null;
    const auSol = et._physx ? et._physx.groundCount > 0 : !et.saut?.actif && !(et.bond > .03);
    sortie.contactPneus = auSol && et.rapport > 0 && !et.recuperation && et.stands?.phase !== 'service';
    sortie.eauRoulement = 0; sortie.microRoulement = 0;
    if (auSol && Math.abs(et.v) > .5 && !et.recuperation && et.stands?.phase !== 'service'
      && (ecran === 'course' || ecran === 'demo') && B.chaussee?.lire) {
      // La même eau que l'adhérence, à la position du pilote. Un tunnel peut rester sec en pleine pluie.
      const surface = sortie.chausseeRoulement || (sortie.chausseeRoulement = {});
      const eau = B.chaussee.lire(S.course.c, et.s, S.meteo, surface).eau;
      if (eau > 0) {
        const roues = et._physx?.contacts;
        let part = 0;
        if (roues?.length) {
          for (const roue of roues) if (roue.load > 0 && (roue.surface === 'piste' || roue.surface === 'vibreur')) part++;
          part /= roues.length;
        } else if (et.surface === 'piste' || et.surface === 'vibreur') part = 1;
        sortie.eauRoulement = eau * part;
        const distance = S.distances?.[voiture.id];
        if (exterieur && distance >= 0) sortie.microRoulement = B.son.gainDistance(distance);
      }
    }
    sortie.aspiration = Number.isFinite(et.aspiration) ? clamp(et.aspiration, 0, 1) : 0;
    sortie.ventActif = (ecran === 'course' || ecran === 'demo') && VUES_COURSE.includes(S.vue);
    sortie.turbo = et.turbo.reste > 0; sortie.vue = S.vue === 'cockpit' ? 'cockpit' : 'poursuite';
    sortie.muet = exterieur; sortie.tunnel = !exterieur && sousLaVoute(S.course.c, cam.pos, true);
  }
  // écoute des claquements d'échappement par voiture (src/son.js, echappement) : entendue du cockpit, distance, angle
  const ecouteEchappement = n => ({ dedans: new Uint8Array(n), distance: new Float64Array(n), angle: new Float64Array(n) });
  function majSon(S, cam, dtImage) {
    if (!son || !sonActif || !cam) return;
    // la voiture entendue de l'intérieur est celle que l'on suit de près : le joueur, ou celle du plan de la démo
    const co = S.course, ks = S.suivie || 0, poses = tampons.poses;
    const S2 = S.type === 'duo' ? S.vueJ2 : null, cam2 = S2 && S2.camera, k2 = cam2 ? S.locaux[1] : -1;
    const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    const fx2 = cam2 ? Math.sin(cam2.yaw) : 0, fz2 = cam2 ? -Math.cos(cam2.yaw) : 0;
    const rx2 = cam2 ? Math.cos(cam2.yaw) : 0, rz2 = cam2 ? Math.sin(cam2.yaw) : 0;
    sonRivaux.length = 0;
    const exterieur = VUES_DEHORS.has(S.vue), exterieur2 = S2 && VUES_DEHORS.has(S2.vue), micro = exterieur && S.type === 'demo';
    const ec = S.ech && son.echappement ? (S.ecouteEch || (S.ecouteEch = creationTardive('ecouteEchappement', ecouteEchappement(co.voitures.length)))) : null;
    for (let k = 0; k < co.voitures.length; k++) {
      if (ec) { ec.dedans[k] = (k === ks && !exterieur) || (k === k2 && !exterieur2) ? 1 : 0; ec.distance[k] = -1; }
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
      if (ec) { ec.distance[k] = r.distance; ec.angle[k] = r.angle; }
      sonRivaux.push(r);
    }
    etatSon.pause = document.hidden || ecran === 'pause';
    decrireMoteur(etatSon.joueur, S, co.voitures[ks], cam);
    etatSon.joueur2 = cam2 ? sonJoueur2 : null;
    if (cam2) decrireMoteur(sonJoueur2, S2, co.voitures[k2], cam2);
    son.mettreAJour(etatSon, dtImage);
    if (son.foule) {
      let intensiteFoule = 0;
      if ((ecran === 'course' || ecran === 'demo') && S.type !== 'vitrine') {
        const vj = co.voitures[ks], ej = vj && vj.etat;
        if (ej) {
          const c = co.c, L = c.longueur;
          // Proximité ligne de départ/arrivée & tribunes principales
          const dDepart = c.ouvert ? Math.min(Math.abs(ej.s - (c.depart || 0)), Math.abs(ej.s - (c.arrivee || L))) : Math.min(ej.s, L - ej.s);
          if (dDepart < 160) intensiteFoule = Math.max(intensiteFoule, Math.max(0, 1 - dDepart / 160));
          // Proximité groupes de spectateurs / gradins du public 3D
          if (S.public && S.public.zones && S.public.zones.length) {
            const pj = poses[ks];
            for (let zi = 0; zi < S.public.zones.length; zi++) {
              const z = S.public.zones[zi];
              const d = Math.hypot((z.x || 0) - pj.x, (z.z || 0) - pj.z);
              if (d < 95) intensiteFoule = Math.max(intensiteFoule, (1 - d / 95) * 0.9);
            }
          }
          // Ambiance légère dans les gros virages spectateurs
          if (intensiteFoule < 0.25 && Math.abs(ej.v) > 20 && c.stands) {
            const dSt = Math.abs(B.circuit.ecart(c, (c.stands.debut + c.stands.fin) * 0.5, ej.s));
            if (dSt < 140) intensiteFoule = Math.max(intensiteFoule, (1 - dSt / 140) * 0.85);
          }
          son.foule(intensiteFoule, Math.abs(ej.v || 0));
        }
      } else {
        son.foule(0, 0);
      }
    }
    if (ec) son.echappement(S.ech.son, ec);
  }

  // ---------------------------------------------------------------- affichage de course
  const H = {};
  for (const id of ['h-pos', 'h-sur', 'h-tour', 'h-tours', 'h-actuel', 'h-meilleur', 'h-delta', 'h-delta-ligne', 'h-vitesse', 'h-rapport', 'h-regime', 'h-fps', 'h-sante', 'h-sante-barre', 'c-sante', 'jauge-derive', 'classement', 'feux', 'carte', 'c-position', 'c-tour', 'message', 'sous-message', 'h-virage', 'h-virage-nom', 'h-virage-distance', 'h-virage-annonce']) H[id] = $(id);
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
  for (const id of ['h-pneus', 'c-pneus', 'h-pneus-usure', 'h-pneu-0', 'h-pneu-1', 'h-pneu-2', 'h-pneu-3', 'h-sante', 'h-sante-barre', 'h-carburant', 'h-box', 'c-sante']) { H[id] = $(id); H2[id] = hud2.querySelector('#' + id); }
  const HUD1 = { h: H, segments, lampes, etiquette: etiquetteDerive, barre };
  const HUD2 = { h: H2, segments: Array.from(H2['jauge-derive'].querySelectorAll('i')), lampes: Array.from(H2.feux.querySelectorAll('i')),
    etiquette: H2['jauge-derive'].querySelector('.etiquette'), barre: H2['h-regime'].querySelector('.barre') };
  function texte(el, t) { if (el._t !== t) { el._t = t; el.textContent = t; } }
  function attr(el, nom, v) { if (el['_' + nom] !== v) { el['_' + nom] = v; el.setAttribute(nom, v); } }
  function style(el, nom, v) { if (el['_s' + nom] !== v) { el['_s' + nom] = v; el.style.setProperty(nom, v); } }
  function classe(el, nom, oui) { if (el.classList.contains(nom) !== !!oui) el.classList.toggle(nom, !!oui); }

  // Les annonces suivent le pilote de cet ATH, jamais l'état partagé de S.vueJ2. Le plan et la surface
  // sont lus sans modifier la course. Seule la distance visible évolue ; le lecteur d'écran parle une fois.
  function masquerAnnonceVirage(x) {
    x.h['h-virage'].hidden = true;
    texte(x.h['h-virage-annonce'], '');
  }
  function suspendreAnnoncesVirages() {
    voixVirages.annuler();
    for (const x of [HUD1, HUD2]) { masquerAnnonceVirage(x); x.tVirage = -Infinity; }
  }
  function majAnnonceVirage(S, x, j) {
    const co = S.course, et = j.etat;
    if (x.courseVirages !== co || x.piloteVirages !== j.id) {
      x.courseVirages = co; x.piloteVirages = j.id; x.suiviVirages = {}; x.surfaceVirage = {};
      x.positionVirage = {}; x.tVirage = -Infinity;
      masquerAnnonceVirage(x);
      if (x === HUD1) voixVirages.annuler();
    }
    const actif = (reglages.annoncesVirages === 'ecran' || reglages.annoncesVirages === 'voix')
      && ecran === 'course' && !document.hidden && S.type !== 'demo' && co.phase === 'course'
      && !j.fini && !j.abandon && !et.stands && !et.accident && !et.recuperation && !et.reparation && et.rapport >= 0 && et.v >= 0;
    if (actif && horlogeReelle < x.tVirage) return;
    x.tVirage = horlogeReelle + .1;
    const position = x.positionVirage;
    position.s = et.s; position.progression = j.progression; position.vitesse = et.v; position.actif = actif;
    position.adherence = actif ? B.conduite.adherenceVoiture(et, B.chaussee.lire(co.c, et.s, S.meteo, x.surfaceVirage)) : 1;
    const annonce = B.virages.lire(co.c, position, x.suiviVirages);
    if (!annonce) {
      if (x === HUD1 && !x.h['h-virage'].hidden) voixVirages.annuler();
      masquerAnnonceVirage(x); return;
    }
    const H = x.h;
    attr(H['h-virage'], 'data-sens', annonce.sens > 0 ? 'droite' : 'gauche');
    attr(H['h-virage'], 'data-difficulte', String(annonce.difficulte));
    texte(H['h-virage-nom'], annonce.libelle);
    texte(H['h-virage-distance'], annonce.distanceAffichee + ' m');
    H['h-virage'].hidden = false;
    if (annonce.nouveau) {
      const phrase = annonce.libelle + (annonce.distanceAffichee > 0 ? ', dans ' + annonce.distanceAffichee + ' mètres.' : ', maintenant.');
      texte(H['h-virage-annonce'], phrase);
      if (x === HUD1 && reglages.annoncesVirages === 'voix' && sonActif && !muet)
        voixVirages.dire(phrase, reglages.general * reglages.effets);
    }
  }

  // L'état affiché appartient au pilote de cet ATH, y compris à deux. Aucun calcul d'usure ni remise à neuf ici.
  // Les écritures DOM restent bornées aux changements de pourcentage entier, sans lecture de mise en page.
  function majPneusHUD(x, et) {
    const H = x.h, type = B.pneus.normaliserType(et.pneus), nom = B.pneus.NOMS_PNEUS[type];
    texte(H['h-pneus'], nom); attr(H['c-pneus'], 'data-pneus', type);
    let pire = 0, complet = true, detail = 'Pneus ' + nom + '. Usure : ';
    for (let i = 0; i < 4; i++) {
      const u = et.etatPneus?.[i]?.usure, valide = Number.isFinite(u);
      const pourcent = valide ? Math.round(clamp(u, 0, 1) * 100) : 0;
      complet = complet && valide; pire = Math.max(pire, pourcent);
      style(H['h-pneu-' + i], '--f', valide ? ((100 - pourcent) / 100).toFixed(2) : '0');
      detail += (i ? ', ' : '') + B.pneus.ROUES[i].nom + ' ' + (valide ? pourcent + ' %' : 'inconnue');
    }
    texte(H['h-pneus-usure'], complet ? 'Usure max. ' + pire + ' %' : 'Usure —');
    attr(H['c-pneus'], 'data-usure', complet ? (pire >= 85 ? 'limite' : pire >= 60 ? 'forte' : 'normale') : 'inconnue');
    attr(H['c-pneus'], 'aria-label', detail + '.');
  }

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
    roue: 'caméra de roue', aileron: 'au-dessus de l’arceau', arriere: 'caméra arrière', travelling: 'travelling', orbite: 'autour de la voiture', sol: 'au ras de la piste',
    panorama: 'tracé du circuit', lieu: 'lieu emblématique', peloton: 'dans le peloton' };
  // Cadences de l'affichage : chrono, écart, vitesse et régime changent à chaque image mais ne se lisent pas au-delà
  // de 30 Hz ; le plan se redessine à 15 Hz, décalé des chiffres, et jamais quand il est masqué. Position, tour,
  // santé, dérive et feux restent à chaque image : ils ne s'écrivent que lorsqu'ils changent. La marge d'une
  // demi-image à 120 Hz tient le rythme quand l'intervalle tombe pile sur la période (à 60 Hz : les chiffres une
  // image sur deux, le plan une sur quatre, jamais la même).
  const PERIODE_CHIFFRES = 1 / 30 - 1 / 240, PERIODE_PLAN = 1 / 15 - 1 / 240;
  function aideRetour(S) {
    // Les compteurs de conduite décident déjà du retour. Un arrêt choisi n'appelle aucune aide.
    const cause = S.horsPiste >= .8 ? 'Hors piste' : S.bloque >= .8 ? 'Bloqué' : '';
    if (!cause || ecran !== 'course' || S.course.phase !== 'course' || S.type === 'demo' || S.type === 'vitrine') return '';
    const j = S.course.joueur, et = j.etat;
    if (j.fini || j.abandon || et.stands || et.recuperation ||
        !(et.gaz > .5 && et.frein < .1 && et.rapport >= 0 && et.v >= 0 && et.v < 1.5)) return '';
    const c = commande(0), m = pad.manette;
    let suite = 'retour automatique';
    if (S.type !== 'duo') {
      if (doigt.gaz) suite = 'Pause → Se replacer';
      else if (c === 'manette' || (c === 'auto' && pad.gaz > .5)) {
        if (m?.buttons?.[9]) {
          let bouton = 'Bouton 10';
          if (m.mapping === 'standard') {
            if (/054c|playstation|dualshock|dualsense|sony/i.test(m.id)) bouton = 'Options';
            else if (/057e|nintendo|switch/i.test(m.id)) bouton = '+';
            else if (/045e|xbox|xinput/i.test(m.id)) bouton = 'Menu';
          }
          suite = bouton + ' → Se replacer';
        }
      } else if (c === 'clavier' || (c === 'auto' && !(souris.active && souris.gaz))) {
        const conflit = ACTIONS.some(a => toucheDe(0, a).some(code => code === 'KeyR' || nomTouche(code) === 'R'));
        suite = conflit ? 'Échap → Se replacer' : 'R pour se replacer';
      }
    }
    return cause + ' · ' + suite;
  }

  // Partage la ligne secondaire existante. Un message de tour qui la reprend reste maître de son texte.
  function afficherAideRetour(aide) {
    const el = H['sous-message'];
    if (aide === (el._aideRetour || '')) return;
    el._aideRetour = aide;
    if (aide && !messagesEnAttente.has(el)) {
      el.textContent = aide; el.className = 'sous-message aide-retour';
    } else if (!aide && el.classList.contains('aide-retour')) {
      el.textContent = ''; el.className = 'sous-message';
    }
  }

  function majHud(S, x = HUD1, jForce = null) {
    // en démo, l'affichage est celui de la voiture filmée ; à deux, chaque affichage a sa voiture (x : ses éléments)
    const H = x.h, segments = x.segments, lampes = x.lampes, etiquetteDerive = x.etiquette, barre = x.barre;
    const co = S.course, demo = S.type === 'demo', j = jForce || (demo ? co.voitures[S.suivie || 0] : co.joueur), et = j.etat, chronoMode = co.mode === 'chrono';
    const nb = co.voitures.length;
    // nouvelle séance : tout s'écrit dès sa première image
    if (x.seance !== S) { x.seance = S; x.tChiffres = x.tPlan = -Infinity; }
    majAnnonceVirage(S, x, j);
    if (x === HUD1) afficherAideRetour(aideRetour(S));
    if (demo && S.planVu) {
      const p = S.planVu;
      const legende = p.nature ? p.label : p.motif === 'freinage' ? 'Freinage · ' + p.label
        : p.motif === 'pluie' ? 'Sous la pluie · ' + j.nom : LIBELLES_PLAN[p.vue] + ' · ' + j.nom;
      texte($('demo-plan'), CATALOGUE[S.i].nom + ' · ' + legende);
    }
    texte(H['h-pos'], chronoMode ? '–' : String(j.position)); texte(H['h-sur'], chronoMode ? '' : '/' + nb);
    if (!chronoMode && !demo && S.positionPrec && j.position < S.positionPrec && co.phase === 'course') eclat(H['c-position']);
    S.positionPrec = j.position;
    if (co.c.ouvert) {
      const resteM = Math.max(0, (co.c.arrivee || co.c.longueur) - (j.etat.s || 0));
      texte(H['h-tour'], co.phase === 'grille' || co.phase === 'feux' ? '–' : (resteM / 1000).toFixed(1).replace('.', ','));
      texte(H['h-tours'], ' km');
    } else {
      const tourAff = chronoMode ? j.tours + (co.chronoParti ? 1 : 0) : Math.min(co.toursTotal, j.tours + 1);
      texte(H['h-tour'], co.phase === 'grille' || co.phase === 'feux' || (chronoMode && !co.chronoParti) ? '–' : String(tourAff));
      texte(H['h-tours'], chronoMode ? '' : '/' + co.toursTotal);
    }
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
      majPneusHUD(x, et);
    }

    // Santé (lot 4) : la jauge vient du même état que les pénalités et la réparation (B.degats.sante), jamais d'un
    // compteur monté pour le seul affichage. Le stand y ajoute son fil : voie, service avec le temps restant, sortie.
    const av = et.degats, st = et.stands, s01 = B.degats.sante(av);
    texte(H['h-sante'], s01 > .999 ? 'Neuve' : Math.round(s01 * 100) + ' %');
    H['h-carburant'].hidden = et.carburant == null;
    if (et.carburant != null) texte(H['h-carburant'], 'Essence ' + Math.ceil(et.carburant) + ' L');
    const box = H['h-box'];
    box.hidden = !st;
    if (st) {
      let consigne;
      if (st.phase === 'service') {
        const u = st.t / st.duree;
        const geste = u < .22 ? 'Mise sur crics' : u < .625 ? 'Changement des roues'
          : u < .72 && st.carburantAvant != null ? 'Ravitaillement' : u < .88 ? 'Fin du service' : 'Équipe en retrait';
        consigne = geste + ' · ' + Math.max(0, st.duree - st.t).toFixed(1).replace('.', ',') + ' s';
      } else if (st.phase === 'sortie') consigne = 'Feu vert · Suivez la voie de sortie';
      else {
        const stand = co.c.stands, distance = B.circuit.ecart(co.c, et.s, stand.sBox);
        const cote = stand.cote === -1 ? 'à gauche' : 'à droite';
        consigne = distance > 9 ? 'Box ' + cote + ' · ' + Math.round(distance) + ' m'
          : distance < -2.35 ? 'Box dépassé · Suivez la sortie'
          : Math.abs(et.d - stand.dBox) > 1.15 ? 'Rangez-vous dans le box ' + cote
          : distance > 2.35 ? 'Avancez au repère' : 'Immobilisez la voiture';
      }
      texte(box, consigne);
      attr(box, 'data-phase', st.phase);
    }
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
      // En ligne la course continue sous la pause, y compris le service de l’autre pilote local.
      if (ecran === 'pause' && S.enLigne && x === HUD1) majPneusStands();
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
  const compteurVisites = B.visites?.creer();
  const ECRANS = ['titre', 'championnat', 'enligne', 'prets', 'preparation', 'reglages', 'pause', 'resultats'];
  let modePrepa = 'course', retourReglages = 'titre';
  let pagePause = 'accueil', piloteStand = 0;
  const enCourse = () => ecran === 'course';
  const menuOpaque = () => ['titre', 'championnat', 'preparation', 'reglages', 'enligne', 'prets'].includes(ecran);
  const menuArcade = B.menuArcade.installer($('preparation'), { retour, actualiser: () => { majBilanArcade(); majChoixTroll(); } });

  let pageTitre = 'accueil', dernierModeTitre = null;
  function ouvrirPageTitre(page) {
    const precedente = pageTitre;
    pageTitre = page;
    const nav = $('titre-modes');
    for (const bouton of nav.children) bouton.hidden = bouton.dataset.pageTitre !== page;
    $('titre-section').hidden = page === 'accueil';
    const libelle = { accueil: 'Menu principal', solo: 'Solo', multi: 'Multijoueur' }[page];
    texte($('titre-section-nom'), libelle);
    nav.setAttribute('aria-label', libelle);
    dernierModeTitre = (page === 'accueil' && nav.querySelector('[data-ouvrir-titre="' + precedente + '"]')) ||
      nav.querySelector('button:not([hidden])');
    dernierModeTitre.focus({ preventScroll: true });
    dernierGeste = performance.now();
    if (son) son.evenement('clic');
  }
  $('titre').addEventListener('click', e => {
    const ouvrir = e.target.closest('[data-ouvrir-titre]');
    if (ouvrir) ouvrirPageTitre(ouvrir.dataset.ouvrirTitre);
    else if (e.target.closest('[data-aller]')) dernierModeTitre = e.target.closest('[data-aller]');
  });

  let coupe = null;
  let choisirCoupe = false;

  function afficherChampionnat() {
    const choisir = !coupe || choisirCoupe;
    $('ch-choix').hidden = !choisir;
    $('ch-saison').hidden = choisir;
    texte($('ch-nom'), choisir ? 'Choisissez votre coupe' : coupe.nom);
    if (choisir) {
      $('ch-choix').replaceChildren();
      for (const id of Object.keys(B.championnat.SAISONS)) {
        const serie = B.championnat.creer(id, CATALOGUE);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'gros';
        b.textContent = serie.nom + ' · ' + serie.manches.length + ' manches';
        b.onclick = () => {
          coupe = serie; choisirCoupe = false;
          sauverChampionnat(); afficherChampionnat();
          $('ch-depart').focus();
        };
        $('ch-choix').append(b);
      }
      return;
    }
    const manche = coupe.manches[coupe.indexManche];
    const i = indiceManche(manche);
    texte($('ch-prochaine'), coupe.termine ? 'Coupe terminée' : i < 0 ? 'Circuit de la sauvegarde indisponible'
      : 'Manche ' + (coupe.indexManche + 1) + ' / ' + coupe.manches.length + ' · ' + CATALOGUE[i].nom);
    $('ch-depart').hidden = coupe.termine; $('ch-depart').disabled = i < 0;
    $('ch-table').hidden = !coupe.pilotes.length;
    const lignes = $('ch-classement'); lignes.replaceChildren();
    for (const [pos, pilote] of B.championnat.classement(coupe).entries()) {
      const row = lignes.insertRow(); if (pilote.joueur) row.className = 'joueur';
      row.insertCell().textContent = pos + 1;
      const nom = row.insertCell(); nom.className = 'nom'; nom.textContent = pilote.nom;
      row.insertCell().textContent = pilote.points;
    }
    texte($('ch-nouveau'), coupe.termine ? 'Nouvelle coupe' : 'Changer de coupe');
  }

  function indiceManche(manche) {
    if (!manche) return -1;
    return B.championnat.indiceCircuit(CATALOGUE, manche.circuitId, manche.circuitIndex);
  }
  function sauverChampionnat() {
    const ok = B.championnat.sauver(coupe);
    texte($('ch-stock'), ok ? '' : 'Stockage indisponible. La progression sera perdue à la fermeture.');
  }
  function partirChampionnat() {
    const numero = coupe?.indexManche, manche = coupe?.manches[numero], i = indiceManche(manche);
    if (i < 0 || prepa.voile) return;
    const avant = ecran;
    const conditions = { ...conditionsDuDepart(), meteo: manche.meteo === 'sec' ? 'soleil' : manche.meteo, mReelle: null };
    return preparerSeance('course', i, null, conditions, { verifier: () => ecran === avant,
      apres: () => { session.mancheChampionnat = numero; } });
  }
  $('ch-depart').addEventListener('click', partirChampionnat);
  $('ch-nouveau').addEventListener('click', () => {
    choisirCoupe = true; afficherChampionnat(); $('ch-choix').firstElementChild?.focus();
  });
  function compterManche(S) {
    if (!coupe || S.essai || S.mancheChampionnat !== coupe.indexManche || indiceManche(coupe.manches[coupe.indexManche]) !== S.i) return;
    const ordre = S.course.classement.map(id => S.course.voitures[id]);
    const valides = ordre.filter(v => !v.abandon && v.meilleur > 0);
    const meilleur = valides.reduce((a, v) => !a || v.meilleur < a.meilleur ? v : a, null);
    B.championnat.enregistrerCourse(coupe, ordre.map(v => ({
      id: v.id, nom: v.nom, couleur: v.couleur, joueur: v.joueur, abandon: v.abandon, meilleurTour: v.meilleur,
    })), meilleur?.id);
    sauverChampionnat();
  }

  function pilotesMenu() {
    const membre = EL.R && EL.R.membres.find(m => m.id === EL.R.id);
    return modePrepa === 'duo' || (modePrepa === 'enligne' && membre && membre.joueurs === 2) ? 2 : 1;
  }
  function choixTrollLocaux() { return B.menuArcade.normaliserTroll(reglages); }
  function majChoixTroll() {
    const choix = choixTrollLocaux(), membre = EL.R && EL.R.membres.find(m => m.id === EL.R.id);
    $('o-troll-1').hidden = pilotesMenu() !== 2;
    $('pr-troll-1').hidden = !(membre && membre.joueurs === 2);
    for (let n = 0; n < 2; n++) for (const prefixe of ['p', 'pr']) {
      $(prefixe + '-geste-' + n).value = choix[n].geste;
      $(prefixe + '-klaxon-' + n).value = choix[n].klaxon;
    }
    const disponible = !!(son && typeof son.klaxon === 'function');
    for (const b of document.querySelectorAll('[data-essai-klaxon]')) b.disabled = !disponible;
    const enLigne = modePrepa === 'enligne' || ecran === 'prets';
    const notice = enLigne && typeof statutTrollEnLigne === 'function' ? statutTrollEnLigne() : '';
    for (const id of ['p-troll-etat', 'pr-troll-etat']) if ($(id)) texte($(id), (disponible ? '' : 'Aperçu sonore indisponible. ') + notice);
  }
  function majBilanArcade() {
    const k = conditionsDuDepart(), cat = CATALOGUE[reglages.circuit], nombre = pilotesMenu();
    texte($('p-bilan-circuit'), cat.nom);
    texte($('p-bilan-course'), modePrepa === 'chrono' ? 'Contre-la-montre · fantôme personnel' : reglages.tours + ' tours · rivaux ' + ['faciles', 'normaux', 'coriaces'][reglages.difficulte]);
    texte($('p-bilan-saison'), NOMS_SAISON[k.saison] + ' · ' + NOMS_MOMENT[k.moment]);
    texte($('p-bilan-meteo'), nomMeteoCourse({ ...k, i: reglages.circuit }));
    texte($('p-bilan-joueurs'), (nombre === 2 ? 'Deux pilotes locaux' : 'Un pilote local') + (modePrepa === 'enligne' ? ' · en ligne' : ''));
    const gestes = { majeur: 'doigt d’honneur', poing: 'poing levé', salut: 'salut' };
    const klaxons = { classique: 'classique', ancien: 'ancien', mariage: 'mariage' };
    const choix = choixTrollLocaux(), pneus = choixPneusLocaux();
    texte($('p-bilan-troll'), choix.slice(0, nombre).map((c, n) => 'J' + (n + 1) + '\u00a0: ' + NOMS_PNEUS[pneus[n]] + ' · ' + gestes[c.geste] + ' + klaxon ' + klaxons[c.klaxon]).join(' / '));
    texte($('b-depart'), modePrepa === 'enligne' ? 'Confirmer la course' : modePrepa === 'chrono' ? 'Lancer le chrono' : 'Prendre le départ');
  }

  function aller(nom) {
    const precedent = ecran;
    if (nom !== precedent) B.navigationMenu.fermerSaisie(document, false);
    if (nom !== 'course') suspendreAnnoncesVirages();
    if (precedent === 'preparation' && nom !== 'preparation') annulerConditions();
    if (nom === 'preparation' && precedent !== 'preparation' && precedent !== 'reglages') {
      conditionsPreparation = null; conditionsPreparationCle = '';
    }
    // Une pause ou les réglages interrompent l'observation Auto, même quand aucune image de course ne passe.
    // Conserver le niveau déjà choisi, mais exiger une nouvelle fenêtre complète au retour en piste.
    if ((ecran === 'course' || ecran === 'demo') !== (nom === 'course' || nom === 'demo'))
      B.qualite.avancer(palier, 0, { actif: false });
    if (son && nom !== 'demo') son.evenement('clic');
    if (nom !== 'course') { arreterManettes(); afficherAideRetour(''); }
    // pause, résultats, menus : les écritures différées de la course (records, fantôme, réglages) partent ici
    if (nom !== 'course') viderStock();
    for (const e of ECRANS) $(e).hidden = e !== nom;
    $('hud').hidden = !(nom === 'course' || nom === 'pause' || nom === 'demo');
    hud2.hidden = !(aDeux() && (nom === 'course' || nom === 'pause'));
    $('demo').hidden = nom !== 'demo';
    $('jeu').dataset.ecran = nom;
    ecran = nom;
    compteurVisites?.titre(nom === 'titre');
    if (nom === 'titre') dernierGeste = performance.now();
    // Les menus opaques ne préparent pas une course invisible. La scène change au vrai départ.
    // en ligne, la pause n'arrête pas la course : pas de « Recommencer »
    if (nom === 'pause') {
      $('b-recommencer').hidden = !!session?.enLigne; $('b-replacer').hidden = aDeux();
      if (precedent !== 'reglages') piloteStand = 0;
      ouvrirPagePause(precedent === 'reglages' ? 'options' : 'accueil',
        precedent === 'reglages' ? $('b-reglages-pause') : $('b-reprendre'));
    }
    if (nom === 'championnat') {
      coupe ??= B.championnat.charger(undefined, CATALOGUE);
      choisirCoupe = false;
      afficherChampionnat();
    }
    if (nom === 'enligne') {
      majSalon(precedent!==nom);
      if (precedent==='reglages' && !$('l-salle').hidden) $('l-reglages').focus({preventScroll:true});
    }
    if (nom === 'prets') { majPrets(); majChoixTroll(); }
    tactile(nom === 'course' && !aDeux());
    if (nom === 'preparation') {
      remplirPreparation();
      if (precedent !== 'preparation' && precedent !== 'reglages') menuArcade.ouvrir(0, false);
      else menuArcade.actualiser();
    }
    menuArcade.image(performance.now(), false);
    if (nom === 'reglages') remplirReglages();
    if ($(nom) && B.navigationMenu) B.navigationMenu.initialiser($(nom));
    // Aucun moteur figé derrière un menu ; la musique du titre est commandée séparément.
    if (son) { if (nom !== 'course' && nom !== 'demo') son.suspendre(); else son.reprendre(); }
    if (son) son.musique(nom === 'titre'); // seule musique du jeu : l'écran titre
    appliquerVolumes();
    if (nom === 'course' || nom === 'demo') { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return; }
    const zone = $(nom);
    if (zone && !estTactile) setTimeout(() => {
      if (ecran !== nom || zone.contains(document.activeElement) && !document.activeElement.closest('[hidden]')) return;
      const focus = (nom === 'titre' && (dernierModeTitre || $('titre-modes').querySelector('button:not([hidden])'))) ||
        zone.querySelector('[data-menu-tab][aria-selected="true"]') || zone.querySelector('button.gros, button');
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
    const z = $('titre-attente'), actif = ecran === 'titre' && pageTitre === 'accueil' && reglages.demo !== 'non' && !!rendu && !prepa.enCours && !erreurPhysique;
    if (z.hidden === actif) z.hidden = !actif;
    if (!actif) return;
    if (document.hidden || contexteRenduPerdu) { dernierGeste = performance.now(); return; }
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
    $('p-force-pluie').hidden = reglages.meteoMode !== 'manuel' || reglages.meteo !== 'pluie';
    $('p-force-pluie-titre').textContent = profil.neige ? 'Intensité de la neige' : 'Intensité de la pluie';
    for (const r of document.querySelectorAll('input[name="forcePluie"]')) r.checked = r.value === reglages.forcePluie;
    $('p-saison-note').textContent = (reglages.saisonMode === 'manuel' ? '' : NOMS_SAISON[k.saison] + ' · ')
      + (profil.neige ? 'Paysage enneigé. Les précipitations manuelles tombent en flocons.' : k.saison === 'hiver' ? 'Hiver doux à Port-Sable, sans neige.' : 'La saison transforme le paysage.');
    $('p-moment-note').textContent = reglages.momentMode === 'reel' ? 'L’éclairage suit l’heure réelle, à vitesse normale.'
      : reglages.momentMode === 'aleatoire' ? 'Moment tiré au sort : ' + NOMS_MOMENT[k.moment] + '.' : 'Cycle jour/nuit de six minutes.';
    const resume = CATALOGUE[reglages.circuit].nom + ' · ' + NOMS_SAISON[k.saison] + ' · ' + NOMS_MOMENT[k.moment]
      + (k.horlogeReelle ? ' (heure réelle)' : '') + ' · ' + nomMeteoCourse({ ...k, i: reglages.circuit });
    texte($('p-resume'), resume);
    majBilanArcade();
    $('p-conditions-reel').hidden = !reel;
    if ($('p-bdtre')) $('p-bdtre').hidden = CATALOGUE[reglages.circuit].id !== 'larche';
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
      // Le départ utilisera ces conditions ; aucun décor caché n’est reconstruit dans le menu.
      if (EL.role === 'hote' && lienActif()) annoncerCourse();
      return k;
    }).catch(erreur => {
      if (numero !== conditionsNumero || erreur.name === 'AbortError') return null;
      // Défaut imprévu : le pilote peut toujours partir avec ses choix manuels visibles.
      conditionsPreparation = { saison: B.saisons.normaliser(choix.saison), moment: B.ambiance.normaliser(choix.moment),
        meteo: ['soleil', 'pluie', 'variable'].includes(choix.meteo) ? choix.meteo : 'soleil', forcePluie: B.conditionsCourse.normaliserForcePluie(choix.forcePluie), mReelle: null, horlogeReelle: null,
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

  const FAMILLES_CIRCUITS = [
    { nom: 'Forêts et côtes', ids: ['forets-du-pacifique', 'marseille', 'karst-et-lagon'] },
    { nom: 'Montagnes et cols', ids: ['route-des-cimes', 'larche'] },
    { nom: 'Terres sauvages', ids: ['sierra', 'nord-atlantique', 'baikal'] },
    { nom: 'Speedway', ids: ['ovale-des-forges'] }
  ];
  function remplirPreparation() {
    $('p-titre').textContent = modePrepa === 'chrono' ? 'Chrono' : modePrepa === 'enligne' ? 'Course en ligne' : modePrepa === 'duo' ? 'Course à deux' : 'Course';
    $('o-partage').hidden = modePrepa !== 'duo';
    $('o-commandes').hidden = false;
    $('p-commandes-j2').hidden = modePrepa !== 'duo';
    $('o-vue-2').hidden = !(modePrepa === 'duo' || modePrepa === 'enligne' && joueursIci() === 2);
    $('p-vue').value = reglages.vue; $('p-vue-2').value = reglages.vue2;
    for (const n of [0, 1]) for (const r of document.querySelectorAll('input[name="cmd' + n + '"]')) r.checked = commande(n) === r.value;
    for (const r of document.querySelectorAll('input[name="partage"]')) r.checked = (reglages.partage === 'cote' ? 'cote' : 'haut-bas') === r.value;
    $('o-tours').hidden = $('o-difficulte').hidden = modePrepa === 'chrono';
    $('o-chrono').hidden = modePrepa !== 'chrono';
    const zone = $('circuits');
    const BIOME_COULEURS = { foret: '#39ff8e', cote: '#00d4ff', marseille: '#00c8ff', montagne: '#8ee8ff', larche: '#5cd6ff', islande: '#ff6b35', desert: '#ffb84d', asie: '#ff66b2', pacifique: '#2dd4bf', baikal: '#60a5fa', fjord: '#38bdf8', carpates: '#a3e635', ecosse: '#34d399', sierra: '#fb923c', corail: '#22d3ee', andes: '#c084fc', ovale: '#4bd8ca' };
    const barreCat = $('p-categories');
    function familleChoisie() {
      const id = CATALOGUE[reglages.circuit].id;
      return FAMILLES_CIRCUITS.findIndex(f => f.ids.includes(id));
    }
    function afficherFamille(index) {
      const f = FAMILLES_CIRCUITS[index];
      for (const b of zone.children) b.hidden = !f.ids.includes(b.dataset.id);
      texte($('p-famille'), f.nom + ' · ' + (index + 1) + ' / ' + FAMILLES_CIRCUITS.length);
    }
    if (!zone.childElementCount) {
      CATALOGUE.forEach((k, i) => {
        const b = document.createElement('button');
        const clefTheme = k.id === 'larche' ? 'larche' : k.id === 'marseille' ? 'marseille' : (k.theme || 'foret');
        b.type = 'button'; b.className = 'carte-circuit'; b.setAttribute('role', 'radio'); b.dataset.index = i; b.dataset.id = k.id; b.dataset.theme = clefTheme;
        b.style.setProperty('--biome', BIOME_COULEURS[clefTheme] || '#39ff8e');
        b.style.animationDelay = (i * 18) + 'ms';
        b.innerHTML = '<span class="nom">' + k.nom + '</span><span class="fiche">' + k.lieu + '</span>';
        b.addEventListener('click', () => { reglages.circuit = i; sauverReglages(); majPreparation(); if (son) son.evenement('clic'); if (EL.role === 'hote' && lienActif()) annoncerCourse(); });
        zone.appendChild(b);
      });
      const dernierCircuit = new Map();
      barreCat._decaler = sens => {
        const depart = familleChoisie(), n = FAMILLES_CIRCUITS.length;
        const arrivee = (depart + sens + n) % n, famille = FAMILLES_CIRCUITS[arrivee];
        dernierCircuit.set(depart, reglages.circuit);
        const cible = zone.children[dernierCircuit.get(arrivee)] || zone.querySelector('[data-id="' + famille.ids[0] + '"]');
        const suivreFocus = zone.contains(document.activeElement);
        afficherFamille(arrivee);
        cible.click();
        if (suivreFocus) cible.focus({ preventScroll: true });
      };
      barreCat.addEventListener('click', ev => {
        const bouton = ev.target.closest('[data-famille-sens]');
        if (bouton) barreCat._decaler(Number(bouton.dataset.familleSens));
      });
    }
    afficherFamille(familleChoisie());
    for (const nom of ['tours', 'difficulte']) for (const r of document.querySelectorAll('input[name="' + nom + '"]')) r.checked = String(reglages[nom]) === r.value;
    for (const r of document.querySelectorAll('input[name="meteo"]')) r.checked = String(reglages.meteo || 'aleatoire') === r.value;
    majPreparation();
    actualiserConditions();
  }
  // Présélection des pneus selon la météo prévue (David, 16/11) : au soleil des slicks, sous la pluie des pneus
  // pluie ; la météo aléatoire est tirée d'avance (même graine que la course qui va partir). Le pilote peut changer.
  const NOMS_PNEUS = B.pneus.NOMS_PNEUS;
  // L'ancienne préférence appartient désormais aux deux pilotes locaux. Un choix manuel reste mémorisé ;
  // « Conseillés » suit la chaussée prévue sans écraser la préférence manuelle de l'autre pilote.
  function initialiserChoixPneus(source) {
    const s = source && typeof source === 'object' ? source : {}, pneusPilotes = B.pneus.normaliserChoixPilotes(s);
    const ancienChoix = Object.prototype.hasOwnProperty.call(s, 'pneus') || Object.prototype.hasOwnProperty.call(s, 'pneusPilotes');
    const pneusAutoPilotes = [0, 1].map(n => Array.isArray(s.pneusAutoPilotes) ? s.pneusAutoPilotes[n] === true : !ancienChoix);
    return { pneus: pneusPilotes[0], pneusPilotes, pneusAutoPilotes };
  }
  function choixPneusLocaux() { return B.pneus.normaliserChoixPilotes(reglages); }
  function pneusAutomatiques(n) { return !!(Array.isArray(reglages.pneusAutoPilotes) && reglages.pneusAutoPilotes[n] === true); }
  function appliquerConseilPneus(type) {
    if (!B.pneus.estJouable(type)) return;
    const choix = choixPneusLocaux();
    for (let n = 0; n < 2; n++) if (pneusAutomatiques(n)) choix[n] = type;
    reglages.pneusPilotes = choix; reglages.pneus = choix[0];
  }
  function choisirPneusPilote(n, type) {
    if ((n !== 0 && n !== 1) || (type !== 'auto' && !B.pneus.estJouable(type))) return false;
    const choix = choixPneusLocaux(), automatiques = [pneusAutomatiques(0), pneusAutomatiques(1)];
    automatiques[n] = type === 'auto';
    if (type === 'auto') {
      const surface = ecran === 'prets' && EL.course ? surfaceAnnoncee(EL.course) :
        B.chaussee.lire(null, 0, meteoPourConditions(conditionsDuDepart(), reglages.circuit, graineCourse + 1));
      choix[n] = B.conduite.pneusConseilles(surface);
    } else choix[n] = type;
    reglages.pneusPilotes = choix; reglages.pneusAutoPilotes = automatiques; reglages.pneus = choix[0];
    return true;
  }
  function majChoixPneus() {
    const choix = choixPneusLocaux(), membre = EL.R && EL.R.membres.find(m => m.id === EL.R.id);
    const duoPreparation = modePrepa === 'duo' || (modePrepa === 'enligne' && membre && membre.joueurs === 2);
    $('o-pneus-2').hidden = !duoPreparation;
    $('pr-pneus-2').hidden = !(membre && membre.joueurs === 2);
    for (let n = 0; n < 2; n++) {
      const valeur = pneusAutomatiques(n) ? 'auto' : choix[n];
      for (const nom of [n ? 'pneus2' : 'pneus', n ? 'pneusPret2' : 'pneusPret'])
        for (const r of document.querySelectorAll('input[name="' + nom + '"]')) r.checked = r.value === valeur;
    }
  }
  function monterPneusDepart(course, joue, enl, conseil) {
    const choix = choixPneusLocaux(); let local = 0;
    for (const v of course.voitures) {
      const type = enl && v.humain ? enl.pneus && enl.pneus[v.id] : v.joueur && joue ? choix[local++] : conseil;
      v.etat.pneus = B.pneus.estJouable(type) ? type : conseil;
      v.etat.pneusProchainArret = v.etat.pneus;
      v.livree.pneus = v.etat.pneus;
    }
  }
  // Choix de service attaché à la voiture de la séance, sans changer les pneus actuellement montés.
  function choisirPneusStands(n, type) {
    if (!session || ecran !== 'pause' || (n !== 0 && n !== 1)) return false;
    const co = session.course, id = session.locaux && session.locaux[n], v = co && co.voitures[id];
    const accepte = !!(v && B.course.demanderPneus(co, v, type));
    majPneusStands(); return accepte;
  }
  function majPneusStands() {
    if (ecran !== 'pause' || pagePause !== 'stands') return;
    const S = session, co = S && S.course;
    const garage = !!co?.c?.stands;
    texte($('ps-note'), garage ? 'Empruntez la bretelle, puis immobilisez la voiture au repère devant le garage. L’équipe change les quatre pneus, répare la voiture et fait le plein en course. Repartez au feu vert.' :
      'Ce parcours ne propose pas de réparation complète ni de changement de pneus.');
    for (let n = 0; n < 2; n++) {
      const id = S && S.locaux && S.locaux[n], v = co && co.voitures[id], zone = $('ps-pilote-' + n);
      zone.hidden = !v || n !== piloteStand; if (zone.hidden) continue;
      const et = v.etat, st = et.stands, service = st && st.phase === 'service';
      const type = B.pneus.estJouable(et.pneusProchainArret) ? et.pneusProchainArret : et.pneus;
      const prochainArret = garage && !v.distant && !v.reprise && !v.fini && !v.abandon && !co.termine;
      zone.disabled = !!service || !prochainArret;
      const pieces = B.degats.avaries(et.degats, true);
      let bilan = 'État des avaries indisponible.';
      if (et.degats) {
        if (pieces.length) bilan = 'À réparer · ' + pieces.join(', ') + '.';
        else if (B.degats.sante(et.degats) < 1) bilan = 'Dégâts légers.';
        else bilan = st?.repare ? 'Aucune avarie après le service.' : 'Aucune avarie.';
        if (et.recuperation) bilan += ' Remise en piste automatique en cours.';
      }
      texte($('ps-avaries-' + n), bilan);
      for (const r of document.querySelectorAll('input[name="pneusStand' + n + '"]')) r.checked = r.value === (service ? st.pneus : type);
      let monte = 'Montés : ' + NOMS_PNEUS[et.pneus];
      if (service) monte = 'Service en cours : ' + NOMS_PNEUS[st.pneus] + '. Choix verrouillé jusqu’à sa fin.';
      else if (prochainArret) monte += ' · prochain arrêt : ' + NOMS_PNEUS[type] + '.';
      else monte += garage ? '. Service indisponible pour ce pilote.' : '.';
      texte($('ps-etat-' + n), monte);
    }
  }
  function preselectionnerPneus() {
    const k = conditionsDuDepart();
    const prevue = meteoPourConditions(k, reglages.circuit, graineCourse + 1);
    const conseil = B.conduite.pneusConseilles(B.chaussee.lire(null, 0, prevue));
    appliquerConseilPneus(conseil); majChoixPneus();
    $('p-pneus-conseil').textContent = 'Conseillés pour cette chaussée : ' + NOMS_PNEUS[conseil].toLowerCase() + '.';
  }
  function majPreparation() {
    preselectionnerPneus();
    for (const r of document.querySelectorAll('input[name="momentDepart"]')) r.checked = r.value === reglages.moment;
    for (const r of document.querySelectorAll('input[name="saisonDepart"]')) r.checked = r.value === reglages.saison;
    afficherConditions();
    const c = circuit(reglages.circuit), fC = fiche(c), metaC = CATALOGUE[reglages.circuit];
    for (const b of $('circuits').children) {
      const actif = +b.dataset.index === reglages.circuit;
      b.setAttribute('aria-checked', String(actif)); b.tabIndex = actif ? 0 : -1;
    }
    menuArcade.trace(c, fC, metaC, reglages.circuit, CATALOGUE.length);
    // Jauges arcade animées (Vitesse, Technique, Relief)
    const jVit = clamp(Math.round(92 - Math.min(48, (fC.virages || 8) * 1.9) + Math.min(18, (c.longueur || 4000) / 1400)), 28, 98);
    const jTech = clamp(Math.round(28 + (fC.virages || 8) * 3.6 + (c.ouvert ? 16 : 0)), 25, 99);
    const jRel = clamp(Math.round(14 + Math.min(86, Math.sqrt(Math.max(0, fC.relief || 10)) * 4.4)), 15, 100);
    for (const [id, val, c1, c2] of [
      ['jauge-vitesse', jVit, '#00e5ff', '#39ff8e'],
      ['jauge-technique', jTech, '#ffd600', '#ff9100'],
      ['jauge-relief', jRel, '#ff3860', '#ff6b4a']
    ]) {
      const el = $(id), txt = $(id + '-val');
      if (el) { el.style.setProperty('--val', val + '%'); el.style.setProperty('--jauge-c1', c1); el.style.setProperty('--jauge-c2', c2); }
      if (txt) txt.textContent = String(val);
    }
    majChoixTroll(); majBilanArcade();
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
    if (t.name === 'forcePluie') { reglages.forcePluie = B.conditionsCourse.normaliserForcePluie(t.value); sauverReglages(); preselectionnerPneus(); }
    if (['pneus', 'pneus2', 'pneusIci', 'pneusPret', 'pneusPret2'].includes(t.name) && choisirPneusPilote(t.name.endsWith('2') ? 1 : 0, t.value)) {
      retirerPret(); sauverReglages(); envoyerPneus(); majChoixPneus();
    }
    if (['boitePret', 'vuePret', 'vuePret2', 'vueDepart', 'vueDepart2', 'boite', 'vue', 'vue2'].includes(t.name)) retirerPret();
    if (/^pneusStand[01]$/.test(t.name)) choisirPneusStands(+t.name.slice(-1), t.value);
    if (t.name === 'boitePret' && ['auto', 'manuelle'].includes(t.value)) { reglages.boite = t.value; sauverReglages(); }
    if (['vue', 'vue2', 'vuePret', 'vuePret2', 'vueDepart', 'vueDepart2'].includes(t.name)) reglerVue(t.name.endsWith('2') ? 1 : 0, t.value);
    if (['meteo', 'forcePluie', 'momentDepart', 'saisonDepart', 'saisonMode', 'momentMode', 'meteoMode'].includes(t.name) && ecran === 'preparation') actualiserConditions();
    if (EL.role === 'hote' && lienActif() && ['tours', 'difficulte'].includes(t.name)) annoncerCourse();
    if (t.name === 'joueursIci') { reglages.joueursLocaux = t.value === '2' ? 2 : 1; sauverReglages(); }
    if (t.name === 'partage') { reglages.partage = t.value === 'cote' ? 'cote' : 'haut-bas'; sauverReglages(); }
    if (/^r?cmd[01]$/.test(t.name) && NOMS_COMMANDES[t.value]) {
      const n = +t.name.slice(-1);
      reglages.commandes = [commande(0), commande(1)]; reglages.commandes[n] = t.value; souris.active = false; sauverReglages();
      if (t.name[0] === 'r') majCommandes(); else for (const r of document.querySelectorAll('input[name="rcmd' + n + '"]')) r.checked = r.value === t.value;
    }
    if (['boite', 'qualite', 'tableau', 'retro', 'demo', 'cartePosition', 'carteTaille'].includes(t.name)) {
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
    if (t.name === 'annoncesVirages' && ['non', 'ecran', 'voix'].includes(t.value)) {
      reglages.annoncesVirages = t.value; sauverReglages(); suspendreAnnoncesVirages();
    }
    // Cadence d'images : la valeur normalisée par la cadence est celle qui est retenue (une cible fixe vise le
    // diviseur de l'écran le plus proche) ; les essais en cours repartent de zéro.
    if (t.name === 'cadence') { reglages.cadence = B.cadence.regler(cadence, t.value); sauverReglages(); }
    if (Object.prototype.hasOwnProperty.call(B.graphismes.OPTIONS, t.name)) {
      reglages[t.name] = B.graphismes.normaliserOptions({ [t.name]: t.value })[t.name];
      if (t.name === 'faune') reglages.fauneCoupeeManuellement = reglages.faune === 'off';
      sauverReglages();
      // AA et ombres sont lus au prochain rendu, sans recréer le contexte. La végétation suit la prochaine
      // séance : aucun rebâtiment du terrain ni changement d'obstacles au milieu d'une course.
    }
    if (t.name === 'aide') { reglages.aide = +t.value; sauverReglages(); }
  });
  for (const nom of ['general', 'moteur', 'effets']) $('v-' + nom).addEventListener('input', e => { reglages[nom] = +e.target.value; sauverReglages(); appliquerVolumes(); });
  $('v-champ').addEventListener('input', e => { reglages.champ = clamp(+e.target.value, 60, 105); $('v-champ-valeur').textContent = reglages.champ + '°'; sauverReglages(); });
  $('v-secousses').addEventListener('input', e => { reglages.secousses = clamp(+e.target.value, 0, 1); $('v-secousses-valeur').textContent = Math.round(reglages.secousses * 100) + ' %'; sauverReglages(); });
  $('v-gouttes').addEventListener('input', e => { reglages.gouttes = clamp(+e.target.value, 0, 2); $('v-gouttes-valeur').textContent = reglages.gouttes.toFixed(1).replace('.', ',') + ' ×'; sauverReglages(); });
  $('v-vibrations').addEventListener('change', e => { reglages.vibrations = e.target.checked ? 'oui' : 'non'; if (!e.target.checked) arreterManettes(); sauverReglages(); });
  $('v-carte').addEventListener('change', e => { reglages.carte = e.target.checked ? 'oui' : 'non'; sauverReglages(); appliquerCarte(); });
  $('v-vibration-force').addEventListener('input', e => { reglages.vibrationForce = clamp(+e.target.value, 0, 1); $('v-vibration-force-valeur').textContent = Math.round(reglages.vibrationForce * 100) + ' %'; sauverReglages(); });
  document.addEventListener('change', e => {
    const correspondance = /^(geste|klaxon)Pilote([01])$/.exec(e.target.name || '');
    if (correspondance) {
      const choix = choixTrollLocaux(); choix[+correspondance[2]][correspondance[1]] = e.target.value;
      reglages.trollPilotes = B.menuArcade.normaliserTroll({ trollPilotes: choix });
      retirerPret(); sauverReglages(); majChoixTroll();
      if (EL.role === 'invite') envoyerPneus();
    }
    if (ecran === 'preparation') majBilanArcade();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-essai-klaxon]');
    if (!b || b.disabled || !['preparation', 'prets'].includes(ecran)) return;
    activerSon();
    const choix = choixTrollLocaux()[+b.dataset.essaiKlaxon];
    if (choix && son && son.klaxon) son.klaxon(choix.klaxon, { gain: .75 });
  });
  const NOMS_ACTIONS = { gaz: 'Accélérer', frein: 'Freiner', gauche: 'Gauche', droite: 'Droite', derive: 'Dérive', haut: 'Rapport +', bas: 'Rapport −', vue: 'Vue', troll: 'Troll / geste' };
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
  // Affectations clavier et manette séparées. Le focus survit à la reconstruction
  // du tableau : A ouvre une capture, le bouton encore tenu ne la remplit pas.
  function majCommandes() {
    const zone = $('r-commandes'); if (!zone) return;
    const actif = document.activeElement;
    const focus = zone.contains(actif) ? actif.matches('input') ? 'input[name="' + actif.name + '"][value="' + actif.value + '"]'
      : actif.dataset.padAction ? '[data-pad-action="' + actif.dataset.padAction + '"][data-n="' + actif.dataset.n + '"]'
      : actif.dataset.action ? '[data-action="' + actif.dataset.action + '"][data-n="' + actif.dataset.n + '"][data-place="' + actif.dataset.place + '"]'
      : actif.id ? '#' + actif.id : null : null;
    let html = '';
    for (const n of [0, 1]) {
      html += '<div class="joueur-commandes"><h3>Joueur ' + (n + 1) + '</h3><fieldset class="choix-commande"><legend>Commande</legend>';
      for (const c of Object.keys(NOMS_COMMANDES)) html += '<label><input type="radio" name="rcmd' + n + '" value="' + c + '"' + (commande(n) === c ? ' checked' : '') + '><span>' + NOMS_COMMANDES[c] + '</span></label>';
      html += '</fieldset><p class="etat-manette" id="r-manette-joueur-' + n + '-status"></p><table class="table-touches"><thead><tr><th>Action</th><th colspan="2">Clavier</th><th>Manette</th></tr></thead><tbody>';
      for (const a of ACTIONS) {
        const l = toucheDe(n, a);
        html += '<tr><th scope="row">' + NOMS_ACTIONS[a] + '</th>';
        for (const k of [0, 1]) {
          const attend = captureTouche && captureTouche.n === n && captureTouche.action === a && captureTouche.place === k;
          html += '<td><button type="button" class="touche' + (attend ? ' attente' : '') + '" data-n="' + n + '" data-action="' + a + '" data-place="' + k + '">' + (attend ? 'Touche ?' : nomTouche(l[k])) + '</button></td>';
        }
        const attendPad = captureManette && captureManette.n === n && captureManette.action === a;
        html += '<td><button type="button" class="touche touche-manette' + (attendPad ? ' attente' : '') + '" data-n="' + n + '" data-pad-action="' + a + '" aria-label="Manette joueur ' + (n + 1) + ' : ' + NOMS_ACTIONS[a] + '">' +
          (attendPad ? 'Relâchez…' : B.commandesManette.nom(configurationsManettes[n][a])) + '</button></td>';
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }
    zone.innerHTML = html + '<p class="note-commandes">Manette : choisissez une action avec A, relâchez les commandes, puis pressez un bouton ou déplacez un stick. Select / View ou Menu / Start annule l’affectation. En course, Menu / Start met en pause. Maintenez le stick droit vers le bas pour regarder derrière dans les six vues, sauf si ce mouvement est affecté à une autre action. Les affectations sont propres à chaque joueur.</p>'
      + '<p class="note-commandes">Clavier : choisissez une touche puis pressez la nouvelle ; Échap annule. Souris : choisissez explicitement « Souris » pour conduire avec le pointeur lorsqu’une manette est branchée. Pause : Échap ou P · son : M.</p>'
      + '<div class="actions-commandes"><button type="button" class="discret" id="r-touches-defaut">Clavier par défaut</button><button type="button" class="discret" id="r-pad-defaut">Manettes par défaut</button><button type="button" class="discret" id="r-pad-annuler"' + (captureManette || captureTouche ? '' : ' hidden') + '>Annuler l’affectation</button></div>';
    if (focus) { const suivant = zone.querySelector(focus); if (suivant && !suivant.hidden) suivant.focus({ preventScroll: true }); }
    majEtatManettes(true);
  }
  $('r-commandes').addEventListener('click', e => {
    const b = e.target.closest('button.touche');
    if (b && b.dataset.padAction) {
      const n = +b.dataset.n, p = manetteConfiguration(n) || manettes[n] || (manettes.length === 1 ? manettes[0] : null);
      captureTouche = null;
      captureManette = { n, action: b.dataset.padAction, index: p?.index ?? null, id: p?.id,
        suivi: B.commandesManette.creerCapture(p), autres: new Map() };
      for (const autre of manettes) if (autre !== p) noterAnnulationManette(captureManette, autre);
      majCommandes(); return;
    }
    if (b) { captureManette = null; captureTouche = { n: +b.dataset.n, action: b.dataset.action, place: +b.dataset.place }; majCommandes(); return; }
    if (e.target.id === 'r-pad-annuler') { captureManette = captureTouche = null; majCommandes(); }
    if (e.target.id === 'r-pad-defaut') {
      captureManette = captureTouche = null;
      for (const n of [0, 1]) configurationsManettes[n] = B.commandesManette.normaliser();
      reglages.manettes = configurationsManettes.slice(); sauverReglages(); majCommandes();
    }
    if (e.target.id === 'r-touches-defaut') { reglages.touches = [{}, {}]; captureTouche = null; sauverReglages(); majCommandes(); }
  });
  function manetteConfiguration(n, liste = manettes) {
    // Le choix à deux reste identique à la course. Hors duo, le joueur 1 garde
    // la première manette ; le second peut configurer la suivante sans clavier.
    return session?.type === 'duo' || ecran === 'reglages' && retourReglages === 'preparation' && modePrepa === 'duo'
      ? assigner(liste)[n] : liste[n] || null;
  }
  function lireCaptureManette(liste) {
    const q = captureManette;
    if (!q) return;
    if (ecran !== 'reglages' || $('r-commandes-panel').hidden) { captureManette = null; return; }
    // Au débranchement de J2, J1 ne peut pas affecter par erreur le profil de son voisin.
    const p = q.index == null ? manetteConfiguration(q.n, liste) || (liste.length === 1 ? liste[0] : null)
      : liste.find(p => p.index === q.index && p.id === q.id);
    if (p && q.index == null) { q.index = p.index; q.id = p.id; }
    for (const index of q.autres.keys()) if (!liste.some(m => m.index === index)) q.autres.delete(index);
    for (const autre of liste) if (autre !== p && noterAnnulationManette(q, autre)) {
      captureManette = null; majCommandes(); return;
    }
    const liaison = B.commandesManette.avancerCapture(q.suivi, p);
    if (liaison) {
      configurationsManettes[q.n] = B.commandesManette.affecter(configurationsManettes[q.n], q.action, liaison);
      reglages.manettes = configurationsManettes.slice();
      reglages.commandes = [commande(0), commande(1)]; reglages.commandes[q.n] = 'manette';
      captureManette = null; souris.active = false; sauverReglages(); majCommandes();
    } else if (q.suivi.annule) { captureManette = null; majCommandes(); }
    else {
      const bouton = $('r-commandes').querySelector('[data-pad-action="' + q.action + '"][data-n="' + q.n + '"]');
      if (bouton) texte(bouton, q.suivi.pret ? 'Actionnez…' : 'Relâchez…');
    }
  }
  let prochaineMajManette = 0;
  function majEtatManettes(force = false) {
    if (!force && (ecran !== 'reglages' || performance.now() < prochaineMajManette)) return;
    prochaineMajManette = performance.now() + 150;
    const etat = $('r-manette-etat');
    if (etat) texte(etat, captureManette ? 'Joueur ' + (captureManette.n + 1) + ' · ' + NOMS_ACTIONS[captureManette.action] + ' : ' +
      (captureManette.suivi.raison === 'deconnectee' ? 'manette non reçue. Rebranchez-la ou activez les commandes de jeu dans Edge.' : captureManette.suivi.pret ? 'actionnez la commande souhaitée. Select / View annule.' : 'relâchez tous les boutons et les sticks.') :
      nbManettes ? nbManettes + ' manette' + (nbManettes > 1 ? 's reçues' : ' reçue') + ' · testez les pédales et le stick ci-dessous.' :
      consoleXbox ? 'Manette non reçue. Maintenez Menu ≡ pour passer aux commandes de jeu dans Edge, puis appuyez sur A.' : 'Appuyez sur un bouton de la manette pour la détecter.');
    for (const n of [0, 1]) {
      const el = $('r-manette-joueur-' + n + '-status'); if (!el) continue;
      const p = manetteConfiguration(n), entree = n ? pad2.entrees : pad.entrees;
      B.commandesManette.lire(p, configurationsManettes[n], entree);
      texte(el, p ? 'Gaz ' + Math.round(entree.gaz * 100) + ' % · frein ' + Math.round(entree.frein * 100) + ' % · volant ' + Math.round(entree.volant * 100) + ' %' : 'Aucune manette affectée');
    }
  }
  // la touche suivante prend la place choisie ; elle quitte toute autre action, des deux joueurs
  addEventListener('keydown', e => {
    if (captureManette) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code === 'Escape') { captureManette = null; majCommandes(); }
      return;
    }
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
    captureTouche = captureManette = null; majCommandes();
    majDetectionGraphique();
    for (const nom of ['vue', 'vue2', 'boite', 'qualite', 'cadence', 'anticrenelage', 'ombres', 'vegetation', 'faune', 'aide', 'tableau', 'retro', 'demo', 'cartePosition', 'carteTaille', 'annoncesVirages']) for (const r of document.querySelectorAll('input[name="' + nom + '"]')) r.checked = String(reglages[nom]) === r.value;
    $('v-carte').checked = reglages.carte !== 'non';
    $('v-champ').value = reglages.champ; $('v-champ-valeur').textContent = reglages.champ + '°';
    $('v-secousses').value = reglages.secousses; $('v-secousses-valeur').textContent = Math.round(reglages.secousses * 100) + ' %';
    $('v-gouttes').value = reglages.gouttes; $('v-gouttes-valeur').textContent = reglages.gouttes.toFixed(1).replace('.', ',') + ' ×';
    for (const nom of ['general', 'moteur', 'effets']) $('v-' + nom).value = reglages[nom];
    $('v-vibrations').checked = reglages.vibrations !== 'non';
    reglages.vibrationForce = clamp(reglages.vibrationForce != null ? +reglages.vibrationForce : 0.5, 0, 1);
    $('v-vibration-force').value = reglages.vibrationForce; $('v-vibration-force-valeur').textContent = Math.round(reglages.vibrationForce * 100) + ' %';
  }
  function retour() {
    if (prepa.voile) return;   // sous le voile, rien ne se quitte : la préparation finit ou s'annule seule
    if (captureTouche || captureManette) { captureTouche = captureManette = null; majCommandes(); return; }
    if (ecran === 'reglages') { aller(retourReglages || 'titre'); if (ecran === 'pause' && session && session.type !== 'vitrine') rechaufferEnPause(session); }
    else if (ecran === 'titre' && pageTitre !== 'accueil') ouvrirPageTitre('accueil');
    else if (ecran === 'preparation' && menuArcade.retour()) return;
    else if (ecran === 'preparation' && modePrepa === 'enligne') aller('enligne');
    else if (ecran === 'enligne') retourSalon();
    else if (ecran === 'prets') quitterPrets();
    else if (ecran === 'championnat') { choisirCoupe = false; aller('titre'); }
    else if (ecran === 'resultats' && session?.mancheChampionnat != null) $('b-rejouer').click();
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
  function ouvrirPagePause(page, cible) {
    const avecStand = !!session?.course && session.type !== 'demo' && session.type !== 'vitrine';
    const precedent = pagePause;
    pagePause = page === 'stands' && !avecStand ? 'accueil' : page;
    $('pause-accueil').hidden = pagePause !== 'accueil';
    $('pause-options').hidden = pagePause !== 'options';
    $('pause-vers-stands').hidden = !avecStand;
    $('pneus-stands').hidden = pagePause !== 'stands';
    $('pause-retour').hidden = pagePause === 'accueil';
    texte($('pause-titre'), pagePause === 'stands' ? 'Stratégie de stand' : pagePause === 'options' ? 'Options de séance' : 'Pause');
    if (pagePause === 'stands') {
      const choix = $('ps-choix-pilote'), deux = session.locaux?.length > 1;
      choix.hidden = !deux;
      if (!deux) piloteStand = 0;
      const radio = choix.querySelector('[value="' + piloteStand + '"]');
      radio.checked = true;
      majPneusStands();
      cible ||= deux ? radio : $('ps-pilote-0').querySelector('input:checked:not(:disabled)');
    } else if (pagePause === 'options') cible ||= $('pause-options').querySelector('button:not([hidden])');
    else cible ||= precedent === 'options' ? $('pause-vers-options') : avecStand && precedent === 'stands' ? $('pause-vers-stands') : $('b-reprendre');
    (cible || $('pause-retour')).focus({ preventScroll: true });
    $('pause').scrollTop = 0;
  }
  function retourPause() {
    if (pagePause === 'accueil') basculerPause(); else ouvrirPagePause('accueil');
  }
  $('pause-vers-stands').addEventListener('click', () => ouvrirPagePause('stands'));
  $('pause-vers-options').addEventListener('click', () => ouvrirPagePause('options'));
  $('pause-retour').addEventListener('click', retourPause);
  $('ps-choix-pilote').addEventListener('change', e => {
    if (e.target.name === 'piloteStand') { piloteStand = Number(e.target.value); majPneusStands(); }
  });
  function basculerPause(forcer) {
    if (prepa.voile) return;
    if (ecran === 'course') aller('pause');
    else if (ecran === 'pause' && !forcer) aller('course');
  }
  $('b-reprendre').addEventListener('click', () => aller('course'));
  $('b-replacer').addEventListener('click', () => { replacer(); aller('course'); });
  $('b-recommencer').addEventListener('click', () => session?.mancheChampionnat != null ? partirChampionnat() : demarrerSeance(session ? session.type : 'course'));
  $('b-reglages-pause').addEventListener('click', () => { retourReglages = 'pause'; aller('reglages'); });
  $('b-abandon').addEventListener('click', () => {
    if (session && session.enLigne) quitterEnLigne();
    else if (session?.mancheChampionnat != null) aller('championnat');
    else if (session && session.type === 'chrono' && session.course.joueur.tempsTours.length) montrerResultats(session);
    else aller('titre');
  });
  // Résultats d'une course en ligne : « Quitter » tant qu'elle dure (l'ordinateur reprend la voiture chez l'autre), puis
  // « Salon » ; l'hôte lance la revanche (mêmes réglages), l'invité la reçoit où qu'il soit.
  const enLigneApres = () => !!(session && session.enLigneOrigine && lienActif());
  function boutonsResultats(S) {
    const enl = !!(S && S.enLigneOrigine) && lienActif(), fin = !!(S && S.course.termine);
    const manche = S?.mancheChampionnat != null;
    $('b-menu').disabled = manche && S.attenteClassementChampionnat;
    texte($('b-menu'), enl ? (fin ? 'Salon' : 'Quitter') : 'Menu');
    texte($('b-rejouer'), manche ? 'Classement général' : enl ? 'Revanche' : 'Rejouer');
    $('b-rejouer').hidden = enl && EL.role !== 'hote';
    $('b-rejouer').disabled = (enl && !fin) || (manche && S.attenteClassementChampionnat);
  }
  $('b-menu').addEventListener('click', () => {
    if (!enLigneApres()) aller('titre');
    else if (!session.course.termine) quitterEnLigne();
    else { if (EL.role === 'hote') EL.R.envoyer({ t: 'vers-salon' }); aller('enligne'); }
  });
  $('b-rejouer').addEventListener('click', () => {
    if (session?.mancheChampionnat != null) aller('championnat');
    else if (!enLigneApres()) demarrerSeance(session ? session.type : 'course');
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
    const j = co.joueur, corps = $('res-lignes'), entete = document.querySelector('#resultats .tableau-resultats thead tr');
    const nomCircuit = CATALOGUE[S.i].nom;
    if (co.mode === 'chrono') {
      const speciale = co.c.ouvert && j.fini;
      $('res-titre').textContent = j.abandon ? 'Voiture détruite' : speciale ? 'Arrivée de la spéciale' : 'Séance de chrono';
      const r = records[CATALOGUE[S.i].id];
      const tempsSeance = speciale ? 'temps ' + chrono(j.tempsFinal) + (j.meilleur === null ? ' · hors record' : '') : 'meilleur tour ' + chrono(j.meilleur);
      $('res-sous').textContent = nomCircuit + ' · ' + tempsSeance + (r ? ' · record ' + chrono(r.tour) : '');
      entete.innerHTML = '<th>' + (co.c.ouvert ? 'Spéciale' : 'Tour') + '</th><th class="nom">Temps</th><th>Écart au meilleur</th>';
      corps.innerHTML = j.tempsTours.map((t, k) => '<tr' + (t === j.meilleur ? ' class="joueur"' : '') + '><td>' + (k + 1) + '</td><td class="nom">' + chrono(t) + '</td><td>' + (j.meilleur == null || t === j.meilleur ? '–' : ecartTexte(t - j.meilleur, 3)) + '</td></tr>').join('');
    } else {
      const ordre = co.classement.map(id => co.voitures[id]), tete = ordre[0];
      const meilleurAbsolu = Math.min(...ordre.map(v => v.meilleur ?? Infinity));
      const [h1, h2] = (S.locaux || [0]).map(id => co.voitures[id]);
      $('res-titre').textContent = co.duo && h2 ? (h1.position < h2.position ? h1.nom : h2.nom) + ' devant · ' + Math.min(h1.position, h2.position) + 'e et ' + Math.max(h1.position, h2.position) + 'e'
        : j.abandon ? 'Abandon · voiture détruite' : !j.fini ? 'Ligne non franchie · ' + j.position + 'e'
        : j.position === 1 ? 'Victoire' : 'Arrivée · ' + j.position + 'e';
      $('res-sous').textContent = nomCircuit + ' · ' + co.toursTotal + (co.toursTotal > 1 ? ' tours' : ' tour') + ' · rivaux ' + ['faciles', 'normaux', 'coriaces'][co.difficulte]
        + (!S.enLigneOrigine || !lienActif() ? '' : !co.termine ? ' · course en cours' : EL.role === 'hote' ? '' : ' · l’hôte choisit la suite');
      entete.innerHTML = '<th>Pos.</th><th>N°</th><th class="nom">Pilote</th><th>Tours</th><th>Temps</th><th>Meilleur tour</th>';
      corps.innerHTML = ordre.map((v, r) => {
        const col = 'rgb(' + v.couleur.map(x => Math.round(x * 255)).join(',') + ')';
        let tps;
        if (v.abandon) tps = 'Abandon';
        else if (r === 0 && v.fini) tps = chrono(v.tempsFinal);
        else if (v.fini && tete.fini && v.tours === tete.tours) tps = ecartTexte(v.tempsFinal - tete.tempsFinal, 3);
        else if (tete.tours - v.tours >= 1 && v.fini) tps = '+' + (tete.tours - v.tours) + ' tour' + (tete.tours - v.tours > 1 ? 's' : '');
        else tps = v.fini ? chrono(v.tempsFinal) : classementFinal && co.termine ? 'Non arrivé' : 'en piste';
        return '<tr' + (v.joueur ? ' class="joueur"' : '') + '><td>' + (r + 1) + '</td><td>' + v.numero + '</td><td class="nom"><span class="pastille" style="background:' + col + '"></span>' + (v.joueur && !co.duo ? 'Vous' : v.nom) + '</td><td>' + v.tours + '</td><td>' + tps + '</td><td' + (v.meilleur === meilleurAbsolu ? ' class="record-tour"' : '') + '>' + chrono(v.meilleur) + '</td></tr>';
      }).join('');
    }
    if (S.mancheChampionnat != null) {
      S.attenteClassementChampionnat = !classementFinal && co.drapeau !== null && !j.abandon;
      if (!S.attenteClassementChampionnat) compterManche(S);
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
  const meteoPeutMouiller = m => !!m && ((m.mouille || 0) > 0 || m.precipitationsNeige !== true && ((m.pluie || 0) > 0 || m.fixe !== true));
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
      windStrength: v.windStrength, groundCover: v.groundCover, foule: publicVisible && scene && scene.vuePublic ? scene.vuePublic.fx : null };
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
    if (S.nature?.aurorePossible) ajouter({ shape: 'bitume-aurore-0', p: devant(40, 0, 10), s: [1, 1, 1], mat: 7, fx: true, alpha: .2, emissive: 5, outdoor: true, surface: 'object' });
    if (B.voiture.preparerExpressions) B.voiture.preparerExpressions(l, devant(6, 0, 0));
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
      if (q && q.connected) memoriserActionsManette(p, p === pad ? 0 : 1, q);
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
      if (B.aeriens && !S.aeriens && S.type !== 'vitrine') S.aeriens = B.aeriens.creer(c, { qualite: profilDe(S).palier });
      if (B.signalisationCourse && !S.signalisation && S.type !== 'vitrine' && scene?.decor) S.signalisation = B.signalisationCourse.creer(c, scene.decor);
      if (B.equipeStands && c.stands && !S.equipeStands && S.type !== 'vitrine' && scene?.decor) {
        S.equipeStands = B.equipeStands.creer(c, scene.decor);
        S.equipeStandsVue = { course: co, nuit: 0, cameraPos: null };
      }
      if (B.cameraTransition && !S.camTransition) S.camTransition = B.cameraTransition.creer();
      if (!S.ambianceImage) S.ambianceImage = {};
      // pluie projetée et vitre : celles du joueur 2 aussi, à deux
      if (!pluieVue) pluieVue = B.meteo.creerPluie($('meteo'));
      if (duo && !pluieVue2) pluieVue2 = B.meteo.creerPluie($('meteo2'));
      if (B.vitre) {
        if (!vitreVue) vitreVue = B.vitre.creer($('vitre'));
        if (duo && !vitreVue2) vitreVue2 = B.vitre.creer($('vitre2'), { graine: 2 });
        for (const V of vues) if (!V.vitreContexte) V.vitreContexte = {};
        // Compiler, allouer et exercer l'optique sous le voile, y compris au départ d'une course sèche.
        // La première averse n'a ainsi pas à créer son pipeline. L'état des dépôts reste vierge.
        if (B.vitre.prechauffer) {
          const optique = { qualite: profilDe(S).palier, sourceScene: canvas, dpr: window.devicePixelRatio || 1,
            actif: true, intensite: reglages.gouttes };
          B.vitre.prechauffer(vitreVue, optique);
          if (duo) B.vitre.prechauffer(vitreVue2, optique);
        }
      }
      // tunnel : axe de la scène, puis un état de lampes par vue (le joueur 2 a son propre lissage)
      if (scene) {
        preparerTunnel(c);
        const LT = scene.decor.tunnelLampes;
        if (LT && LT.length) for (const V of vues) {
          const et = Object.prototype.hasOwnProperty.call(V, 'lampesTunnel') ? V.lampesTunnel : null;
          if (!et || et.rev !== scene.index || et.lampes !== LT) V.lampesTunnel = nouvelEtatLampes(scene.index, LT);
        }
      }
      // Nature : habitats et contextes de vue dès que la saison les permet, même si le profil coupe la faune pour
      // l'instant (le gouverneur Auto peut la rouvrir en pleine course).
      const N = S.nature, sa = N && N.saison;
      if (N && B.faune && (!sa || sa.faune > 0 || N.secteurs?.plages.some(p => p.profils[sa.id].faune > 0))) {
        if (!N.faune) N.faune = B.faune.creer(c, scene.decor);
        for (const V of vues) if (!V.fauneVue) V.fauneVue = { qualite: 'off', nuit: 0, pluie: 0, pose: null, camera: null, aspect: 16 / 9, vuesSecondaires: V.fauneSecondaires, vue: V === S ? 0 : 1 };
      }
      // public des tribunes : ambiance de chaque vue (l'animation lit la pluie, les feux et le drapeau)
      if (scene && scene.vuePublic) for (const V of vues) if (!Object.prototype.hasOwnProperty.call(V, 'ambiancePublic') || !V.ambiancePublic) V.ambiancePublic = ambiancePublic();
      // animaux des abords : un contexte de vue par joueur (l'état vient de lancer, avec la scène)
      if (S.animaux) for (const V of vues) if (!Object.prototype.hasOwnProperty.call(V, 'animauxVue') || !V.animauxVue)
        V.animauxVue = { vue: V === S ? 0 : 1, qualite: 'off', camera: null, hauteur: 720, aspect: 16 / 9, vuesSecondaires: V.fauneSecondaires, nuit: 0, pluie: 0 };
      if (N && B.effetsSaison && sa && (N.effetsSaison || sa.feuilles || sa.neige || (S.meteo && S.meteo.neige) || N.secteurs?.plages.some(p => p.profils[sa.id].feuilles || p.profils[sa.id].neige))) {
        if (!N.effetsSaison) N.effetsSaison = B.effetsSaison.creer(c, scene.decor);
        for (const V of vues) if (!V.saisonVue) V.saisonVue = { qualite: 'low', nuit: 0, pluie: 0, neige: 0, ventX: 0, ventZ: 0, pose: null, vue: V === S ? 0 : 1, abri: false };
      }
      if (N?.aurorePossible) {
        if (!N.aurores) N.aurores = B.aurores.creer(c);
        for (const V of vues) if (!V.auroresVue) V.auroresVue = { vue: V === S ? 0 : 1, qualite: 'low', nuit: 0, pluie: 0, neige: 0, nuages: 0, tunnel: false };
      }
      const port = scene && scene.decor.portique;
      if (port && co.mode === 'course' && !S.rotLampe) S.rotLampe = MATRICE_LAMPE(port.cap);
      if (duo) { const t2 = $('scene2'); if (!t2._ctx) t2._ctx = t2.getContext('2d'); }
      // rétroviseurs : glaces de chaque joueur, et moteur des miroirs avec sa copie du décor quand la séance peut en montrer
      if (S.type !== 'vitrine') {
        glacesDe('j1'); if (duo) glacesDe('j2');
        if (glacesPossibles(S) && preparerGlaces() && !S.geometrieGlaces) {
          S.geometrieGlaces = { pieces: [], traces: B.traces.creerReflet(),
            flammes: { pilote: -1, debut: 0, fin: 0, debutPilote: 0, finPilote: 0 },
            voitures: Array.from({ length: n },
            () => ({ cle: -1, liste: null, debut: 0, fin: 0, attitude: null })) };
        }
      }
      // Raccords : les modules qui savent préparer leurs ressources le font ici (fonctions encore absentes de leur
      // module : rien n'est appelé tant qu'elles n'existent pas).
      const attendreSi = r => { if (r && typeof r.then === 'function') attentes.push(Promise.resolve(r).catch(e => console.warn('BITUME : préparation d’un module', e))); };
      try { if (B.traces.prechauffer) attendreSi(B.traces.prechauffer(S.fx)); } catch (e) { console.warn('BITUME : préparation des traces', e); }
      if (S.ech && son && son.echappement && !S.ecouteEch) S.ecouteEch = ecouteEchappement(n);
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
    const n = co.voitures.length, poses = [];
    let fx = null, libere = false;
    const liberer = () => {
      if (libere) return;
      libere = true;
      try { if (fx) B.traces.liberer(fx); }
      finally { if (co.physique) B.physique.liberer(co); }
    };
    try {
    // La chauffe exerce les mêmes corps et solides, dans une scène indépendante qui ne fait jamais avancer la séance.
    if (base.physique) B.physique.installer(co, scene.decor);
    fx = B.traces.creer(n, GRAINE_JETABLE, co.physique ? co.physique.world : undefined);
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
        if (rapport || libere) return true;
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
          if (k >= total) rapport = { pas: k, ms: +(ms + performance.now() - t0).toFixed(1), effets: B.traces.compter(fx) };
          return !!rapport;
        } catch (e) { liberer(); throw e; }
        finally { B.meteo.actuel = avant; ms += performance.now() - t0; }
      },
      dessiner(sortie, oeil) {
        if (libere) return;
        try { B.traces.dessiner(fx, sortie, oeil, 0); } catch (e) { liberer(); throw e; }
      },
      liberer
    };
    } catch (e) { liberer(); throw e; }
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
  // Réserve des flux d'instances du moteur (raccord FERRO, options.reserve de prewarm) : ce que la course ajoute à la
  // première image (betes des abords au plafond de leur palier, flammes de toutes les sorties), et autant de jeu que
  // la première image pour le reste. Le moteur relève sa taille retenue sans appel GL : une course qui reste dessous
  // ne compte aucune création.
  function reserveFlux(S, liste) {
    let dynamic = 0, overlay = 0, effects = 0;
    for (const o of liste) { if (o.fx) effects++; else if (o.overlay) overlay++; else dynamic++; }
    const betes = B.animaux && S.animaux ? B.animaux.BUDGETS[reglages.faune === 'ultra' ? 'ultra' : 'high'].objets : 0;
    const flammes = B.echappement && S.ech ? S.course.voitures.length * B.echappement.OBJETS_PAR_VOITURE : 0;
    // Le fondu des animaux reste dans le flux opaque ; les huit effets réservés
    // couvrent notamment les souffles, sans réserver une seconde fois leurs corps.
    return { dynamic: 2 * dynamic + betes, overlay: 2 * overlay, effects: 2 * effects + flammes + 8 };
  }
  async function chaufferRendu(S, suite, synchrone, alpha = 0) {
    const t0 = performance.now(), E = etatChauffe(), voisins = machineLente(), r = { variantes: 0, retro: 0, prewarm: false, voisins, ms: 0 };
    // Safari : préparer d'un bloc toutes les variantes de rendu y prend plusieurs secondes, et le navigateur coupe alors
    // les contextes graphiques (mesuré le 19/11/2026 sur Safari 27.2 : étape de 5,9 s, puis les deux toiles perdues,
    // image noire ou course qui ne part pas). Les variantes s'y compilent donc à leur premier usage, comme avant le
    // chargement sous voile.
    if (contexteFragile) { r.saute = 'navigateur'; r.ms = +(performance.now() - t0).toFixed(1); return r; }
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
        await rendu.prewarm(cam, liste, fxVariante(S, manque[manque.length - 1][1], cam), { variants: manque.map(m => fxVariante(S, m[1], cam)), allShapes: true, reserve: reserveFlux(S, liste) });
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
        weather: S.ambianceImage, windSources: S.sillage && S.sillage.sources, windStrength: v.windStrength, groundCover: v.groundCover, lights: v.lampes ? lampeTemoin(camR) : null,
        foule: publicVisible && retro.vuePublic ? retro.vuePublic.fx : null });
      if (retro.rendu.prewarm && !synchrone) await retro.rendu.prewarm(camR, objets, fxR(manqueR[manqueR.length - 1][1]), { variants: manqueR.map(m => fxR(m[1])), allShapes: true, reserve: reserveFlux(S, objets) });
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
  const CLES_VUE = ['tete', 'camCap', 'regardArriere', 'sol', 'camera', 'vue', 'suivie', 'lumiere', 'secousse', 'eclair', 'refletsEcran', 'planVu', 'j2Image', 'tele', 'real'];
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
      for (const nom of VUES_COURSE) for (let k = 0; k < (nom === 'cockpit' || nom === 'arceau' ? cockpit : 1); k++) {
        rendreVue(S.vueJ2, j2, nom, 0, meteo);
        if (t2._ctx) { if (t2.width !== canvas.width || t2.height !== canvas.height) { t2.width = canvas.width; t2.height = canvas.height; } t2._ctx.drawImage(canvas, 0, 0); }
        rendreVue(S, j, nom, 0, meteo); n += 2;
        await souffler();
      }
    } else if (S.type === 'demo') {
      // chaque plan du réalisateur, sans le consulter : son générateur reste celui de la séance
      for (const nom of B.realisateur.VUES.concat(B.realisateur.VUES_CINEMA)) {
        S.planVu = { vue: nom, sujet: j.id, debut: co.horloge, fin: 1e9, motif: 'course', n: 0, cote: 1, angle: .6 };
        if (B.cinema.NATURE.has(nom)) S.planVu.ancre = B.cinema.choisir(S.cinema, nom, 0, co.horloge);
        await vue(S, j, nom, nom === 'cockpit' ? cockpit : 1);
      }
    } else {
      // Les six cadres jouables et leurs glaces, puis la télévision qui suit l'arrivée.
      for (const nom of VUES_COURSE) await vue(S, j, nom, nom === 'cockpit' || nom === 'arceau' ? cockpit : 1);
      await vue(S, j, 'tele');
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
  const ETAPES = { voile: 'Mise en place', physique: 'Initialisation du moteur physique', decor: 'Construction du décor', retro: 'Rétroviseurs', circuit: 'Tracé et tunnel',
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
    if (demo) sortirDemo(); else if (!menuOpaque()) remettreVitrine();
  }
  // La séance doit correspondre à la scène installée : une préparation arrêtée a pu bâtir un autre décor, ou lancer une
  // course que personne ne verra. Sur un menu, la vitrine reprend sur la scène en place, sans rebâtir.
  function remettreVitrine() {
    if (!rendu || !scene || detectionGraphiqueActive || prepa.enCours) return;
    const menus = ['titre', 'championnat', 'preparation', 'enligne', 'prets'];
    const menu = menus.includes(ecran) || (ecran === 'reglages' && menus.includes(retourReglages));
    if (!session || session.i !== scene.index || (menu && session.type !== 'vitrine'))
      lancer('vitrine', scene.index, null, Object.assign({}, conditionsDuDepart(), { saison: scene.saison }));
  }

  // Le point de passage de tous les lancements. o : ecran (écran montré dès le début), fondu (ms de fondu d'entrée,
  // l'ancienne séance continuant derrière), verifier (la préparation s'abandonne s'il devient faux), apres (après
  // l'écran de course), reste (ms avant un départ commun en ligne).
  let initialisationPhysique = null, erreurPhysique = null;
  function preparerPhysique() {
    if (!initialisationPhysique) {
      initialisationPhysique = Promise.resolve().then(() => window.FERRO.initPhysics()).then(() => {
        if (!window.FPhysX?.isReady()) throw new Error('PhysX indisponible après initialisation');
        return publierOutils();
      }).catch(e => {
        erreurPhysique = e instanceof Error ? e : new Error(String(e));
        throw erreurPhysique;
      });
    }
    return initialisationPhysique;
  }
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
    const cle = aBatir && CATALOGUE[i].id === 'larche' && B.cache?.disponible() && clePanorama(i, voeuDecor(saison));
    const panorama = cle ? B.panoramaCache.ouvrir(cle) : null;
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
      // cadence des glaces au temps (majGlaces) : la première vraie image les repeint toutes les deux
      for (const J of ETATS_GLACES) J.vu = false;
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
      if (!window.FPhysX?.isReady()) {
        await etape('physique', true);
        try { await preparerPhysique(); } finally { controler(); }
      }
      // 2. décor, s'il change (le seul travail synchrone indivisible : B.decor.construire)
      await etape('decor', aBatir);
      if (aBatir) {
        installer(i, saison, panorama, type !== 'vitrine');
        if (panorama?.choisi) R.cachePanorama = panorama.rapport;
      }
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
      // une résolution du palier Auto mise en attente pendant la séance précédente passe ici, sous le voile : la
      // chauffe se fait à la taille de la première image, que la boucle ne réalloue plus à la levée du voile
      if (resolutionDifferee && rendu) appliquerPalier();
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
      // 11. l'écran de course, puis le fondu. Le bloc optionnel s'écrit ensuite au repos.
      const rapport = terminer();
      if (panorama) B.panoramaCache.conserver(panorama);
      return rapport;
    } catch (e) {
      if (panorama) panorama.nappes = null;
      // l'état des vues appartient à la séance : toujours rendu ; les glaces sont communes : seulement si personne
      // d'autre ne prépare
      if (!restaure) { if (gel) rendreVues(gel); if (glacesGel && jeton === prepa.jeton) { for (const [G, pas, cote] of glacesGel) { G.pas = pas; G.cote = cote; } for (const J of ETATS_GLACES) J.vu = false; } restaure = true; }
      fermer();
      if (e === ANNULE) { R.annule = true; if (prepa.rapport === R) prepa.rapport = null; prepa.dernier = R; return R; }
      console.error('BITUME : préparation de la séance', e);
      R.erreur = String(e && e.message || e);
      if (jeton === prepa.jeton) {
        if (S && session === S) { try { return terminer(); } catch (f) { console.error(f); abandonnerPreparation(); } }
        else abandonnerPreparation();
        if (e === erreurPhysique) erreur('Le moteur physique n’a pas pu démarrer', 'Rechargez la page pour réessayer. ' + R.erreur);
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
    // Sous le voile d'une préparation, rien ne se simule ni ne se dessine et les entrées n'agissent pas ; en démo, un
    // geste rend le titre. Pendant le fondu d'entrée (attente), l'ancienne séance tourne encore. Le temps passé sous
    // le voile n'est ni une image ratée ni du temps à rattraper : la levée du voile (terminer, oublierIntervalle)
    // remet la cadence et le volet de mesures à zéro, et la nouvelle séance part de la première image qui suit.
    if (prepa.voile && !prepa.attente) { tPrec = 0; B.cadence.oublier(cadence); if (ecran === 'demo') lireManette(); else tenirManettes(); return; }
    // Commandes et menus à chaque rappel, même sans image : les pas de l'image suivante lisent l'état le plus frais.
    // Les messages demandés depuis le rappel précédent s'affichent ici, une fois (voir message).
    const avantEntrees = ecran, captureAvant = !!captureManette;
    lireManette();
    lireAutresManettesMenu(ecran !== avantEntrees || captureAvant);
    majEtatManettes();
    majAttente();
    appliquerMessages();
    const sourisVue = souris.active && enCourse() ? 'oui' : 'non';
    if (jeu.dataset.souris !== sourisVue) jeu.dataset.souris = sourisVue;
    const modeManette = consoleXbox && nbManettes && performance.now() - dernierSignalManette < 1200 ? 'oui' : 'non';
    if (jeu.dataset.manette !== modeManette) jeu.dataset.manette = modeManette;
    // deux manettes branchées : « À deux » le signale, et Start sur la seconde, au titre, ouvre la course à deux
    if (ecran === 'titre') $('t-manettes').hidden = nbManettes < 2;
    // préparation d'une course à deux : qui joue avec quoi, selon les choix et les manettes branchées
    if (ecran === 'preparation') texte($('p-manettes'), (modePrepa === 'duo' ? [0, 1] : [0]).map(n => 'Joueur ' + (n + 1) + ' : ' + entreeDe(n, modePrepa === 'duo')).join(' · ') + '.');
    menuArcade.image(t, ecran === 'preparation', gpuModeste || reglages.qualite === 'low');
    // Aucune simulation ni image de course derrière les écrans opaques ; les entrées et le compte à rebours restent actifs.
    if (menuOpaque()) { tPrec = 0; B.cadence.oublier(cadence); return; }
    const S = session;
    // vitrine en préparation : les menus vivent, la séance attend la fin de la préparation (le temps qui passe n'est
    // pas du temps à rattraper)
    if (S && rendu && prepa.enCours && !prepa.attente) { tPrec = 0; B.cadence.oublier(cadence); return; }
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
    selectionnerChampsFaune(S);
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
      gpuModeste = B.autoconfig.recommander(capacitesDeclarees()).selection === 'low';
      const perte = gl.getExtension('WEBGL_lose_context'); if (perte) perte.loseContext();
      return true;
    } catch (e) { return false; }
  }
  function erreur(titre, texteErreur) {
    const el = $('erreur');
    el.innerHTML = '<h2></h2><p></p>'; el.querySelector('h2').textContent = titre; el.querySelector('p').textContent = texteErreur;
    el.hidden = false; $('chargement').classList.add('fini');
  }
  // Une détection par version du jeu et par machine (processeur graphique annoncé) : ni la fenêtre ni l'écran n'y
  // entrent. La version est celle du badge du titre, posée par construire.py.
  function capacitesDeclarees() {
    let pointeurGrossier = false;
    try { pointeurGrossier = matchMedia('(pointer: coarse)').matches; } catch (_) { /* indication facultative */ }
    return { userAgent: navigator.userAgent, platform: navigator.platform, userAgentData: navigator.userAgentData,
      mobile: navigator.userAgentData && navigator.userAgentData.mobile,
      maxTouchPoints: navigator.maxTouchPoints, hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory, pointeurGrossier,
      petitEcran: Math.min(innerWidth, innerHeight) <= 900,
      gpu: String(materielRendu || '').split('|')[0] };
  }
  function empreinteDetection() {
    return B.autoconfig.empreinte(materielRendu, versionJeu());
  }
  function versionJeu() {
    const badge = document.querySelector('.version-jeu');
    const m = badge && /\d+(?:\.\d+)+/.exec(badge.getAttribute('aria-label') || badge.textContent || '');
    return m ? m[0] : '';
  }
  function restaurerDecorApresDetection() {
    if (!scene || !rendu) { restaurerDecorApresContexte = false; return; }
    scene.chauffe = null;   // le banc a remplacé le monde du moteur : la chauffe de cette scène est à refaire
    if (contexteRenduPerdu) { restaurerDecorApresContexte = true; return; }
    const atm = session && session.nature ? session.nature.ambiance.atmosphere : scene.decor.atmosphere;
    rendu.setWorld([], [], atm); rendu.setNappes(scene.decor.nappes, { staticBounds: true }); rendu.setLots(scene.decor.lots, { staticBounds: true, progressif: !!scene.decor.fluxDecor });
    scene.decor.fluxDecor?.reinitialiser();
    if (session && session.nature) session.nature.revisionRendu = -1;
    restaurerDecorApresContexte = false;
  }
  function contexteGraphiqueRetabli() {
    contexteRenduPerdu = false;
    if (scene) {
      scene.chauffe = null;   // nouveau contexte : programmes et cibles du moteur principal sont à refaire
      scene.decor.fluxDecor?.reinitialiser();
    }
    if (session?.course?.physique && (!session.fx || session.fx.libere)) {
      // Le contexte GPU ne possède pas les voitures : seul le pool d'effets libéré est recréé.
      session.fx = B.traces.creer(session.course.voitures.length, session.fx?.graine?.[0] ?? graineCourse, session.course.physique.world);
    }
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
      // la recommandation reste affichée ; les options que le joueur a gardées ou changées depuis sont nommées
      const choisis = B.autoconfig.reglages(dernier.selection), nom = B.autoconfig.profils[dernier.selection].nom;
      const gardes = B.autoconfig.CLES.filter(k => reglages[k] !== choisis[k]);
      etat.textContent = 'Profil estimé : ' + nom + ' · capacités déclarées, sans test de charge.'
        + (gardes.length ? ' Vos choix gardés : ' + gardes.map(k => B.autoconfig.NOMS[k]).join(', ') + '.'
          : ' Réglages appliqués.');
    } else etat.textContent = 'Profil prudent disponible, sans test de charge.';
  }
  // toutAppliquer (détection lancée à la main) : demande explicite de remplacer TOUS les choix graphiques. Une
  // détection automatique (nouvelle version) ne change que les options que le joueur n'a pas modifiées depuis la
  // précédente (sans détection précédente : depuis les valeurs d'usine) ; elle mémorise la recommandation, que
  // l'onglet Image montre. Passée ou interrompue, elle est notée pour ne pas revenir à chaque ouverture.
  function appliquerDetection(resultat, toutAppliquer) {
    const precedent = lireStock(B.autoconfig.CLE, null);
    if (!resultat || resultat.statut !== 'ok') {
      if (!toutAppliquer && resultat && resultat.empreinte) ecrireStock(B.autoconfig.CLE, B.autoconfig.marquer(precedent, resultat));
      return false;
    }
    const choisis = B.autoconfig.reglages(resultat.selection);
    if (!choisis) return false;
    // Sans trace de la recommandation précédente, seuls les réglages d'usine sont automatiques.
    const usine = Object.fromEntries(B.autoconfig.CLES.map(k => [k, DEFAUT[k]]));
    const ref = B.autoconfig.reference(precedent) || usine;
    if (!toutAppliquer && reglages.fauneCoupeeManuellement === true && reglages.faune === 'off') ref.faune = 'profil';
    const f = B.autoconfig.fusionner(reglages, ref, choisis, !!toutAppliquer);
    if (toutAppliquer) reglages.fauneCoupeeManuellement = false;
    Object.assign(reglages, f.valeurs);
    resultat.appliques = f.reference; resultat.gardes = f.gardes;
    // Recommandation prudente ; aucun essai de rendu n'a été lancé.
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
    detectionGraphiqueActive = true;
    try {
      const resultat = B.autoconfig.passive(capacitesDeclarees(), empreinteDetection());
      derniereDetection = resultat;
      appliquerDetection(resultat, !auDemarrage);
      if (!auDemarrage && !contexteRenduPerdu) appliquerPalier();
      if (!auDemarrage && !contexteRenduPerdu && session && session.type === 'vitrine') lancerVitrine(session.i);
      if (!auDemarrage && ecran === 'reglages') remplirReglages();
      return resultat;
    } finally {
      detectionGraphiqueActive = false;
      majDetectionGraphique();
    }
  }
  $('r-detecter').addEventListener('click', () => { void detecterGraphismes(false); });
  $('detection-annuler').addEventListener('click', () => { annulerDetection = true; });
  document.addEventListener('change', e => {
    if (ecran === 'reglages' && B.autoconfig.CLES.includes(e.target.name)) majDetectionGraphique();
  });
  addEventListener('keydown', e => { if (detectionGraphiqueActive && e.code === 'Escape') { annulerDetection = true; e.preventDefault(); } });

  // Safari perd un contexte WebGL demandé en « haute performance » : dès sa création quand la page n'est pas au premier
  // plan, ou plus tard, et l'image principale reste noire alors que le jeu continue. Mesuré le 19/11/2026 sur Safari
  // 27.2 (puce Apple) : contexte par défaut intact, contexte haute performance perdu à la naissance. Le moteur demande
  // la haute performance ; dans Safari, ou quand un contexte d'essai naît perdu, le jeu la remplace par le réglage par
  // défaut pour toutes ses toiles. Sur une machine à une seule carte graphique, cela ne change rien au rendu.
  function preferenceGraphique() {
    const proto = window.HTMLCanvasElement && window.HTMLCanvasElement.prototype;
    if (!proto || proto.getContextOrigine) return;
    const agent = navigator.userAgent || '';
    // WKWebView sur Mac annonce AppleWebKit sans le suffixe Safari. Un contexte
    // haute performance y naît valide mais peut se perdre à la chauffe du décor.
    const webkitApple = !/Chrome|Chromium|Android|CriOS|FxiOS|Edg/i.test(agent)
      && (/Safari\//i.test(agent) || (/AppleWebKit\//i.test(agent) && /Macintosh|iPhone|iPad|iPod/i.test(agent)));
    let fragile = B.autoconfig.recommander(capacitesDeclarees()).mobile || webkitApple;
    if (!fragile) {
      try {
        const essai = document.createElement('canvas').getContext('webgl2', { powerPreference: 'high-performance' });
        fragile = !!essai && essai.isContextLost();
        const perdre = essai && essai.getExtension('WEBGL_lose_context');
        if (perdre) perdre.loseContext();
      } catch (e) { /* pas de contexte d'essai : rien à adapter */ }
    }
    if (!fragile) return;
    contexteFragile = true;
    const origine = proto.getContext;
    proto.getContextOrigine = origine;
    proto.getContext = function (type, attributs) {
      const doux = type === 'webgl2' && attributs && attributs.powerPreference === 'high-performance';
      return origine.call(this, type, doux ? Object.assign({}, attributs, { powerPreference: 'default' }) : attributs);
    };
  }

  // Safari coupe un contexte graphique créé pendant que la page est cachée (onglet ou fenêtre en arrière-plan ; mesuré le
  // 19/11/2026 : toile principale perdue 0,8 s après sa création, pendant la liaison des shaders). Le moteur ne se crée
  // donc qu'une fois la page visible ; d'ici là, le voile de chargement reste affiché.
  const pageCachee = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  function pageVisible() {
    return new Promise(resoudre => {
      const voir = () => { if (document.visibilityState !== 'hidden') { document.removeEventListener('visibilitychange', voir); resoudre(); } };
      document.addEventListener('visibilitychange', voir); voir();
    });
  }

  async function demarrer() {
    if (!webgl2()) { erreur('WebGL2 indisponible', 'BITUME dessine la piste avec WebGL2. Ouvrez la page dans un navigateur récent (Chrome, Edge, Firefox, Safari 15 ou plus) avec l’accélération graphique active.'); return; }
    try {
      // ombres photo (src/ombres.js) : tuile de 512² ; à 1024², des dents rampent sous la casquette de la planche.
      // Bloc PCSS compilé seulement si la pénombre variable sert (B.ombres.reglages.pcssFine) : shader plus court sinon.
      const optionsRendu = { indexRegisteredShapes: true, cullRigidOverlay: true, cameraRelativeOverlay: true, cullRigidSunCasters: true, msaa: 4, shadowMapScale: 2, reflections: true, sea: false, overlayLighting: 'world', ombresPhoto: { tuile: 512, pcss: !!(B.ombres && B.ombres.reglages.pcssFine) } };
      // L'interface garde sa définition CSS ; seule la scène Xbox est bornée
      // à 720p, y compris sur TV 4K et après redimensionnement. FSurface applique
      // ce budget avant l'allocation des cibles WebGL, sans retouche de FERRO.
      const recoMateriel = B.autoconfig.recommander(capacitesDeclarees());
      if (recoMateriel.xbox) Object.assign(optionsRendu, { resolution: 'native', maxPixels: 1280 * 720, renderScale: 1 });
      else if (!recoMateriel.mobile && recoMateriel.selection === 'low') Object.assign(optionsRendu, { resolution: 'native', maxPixels: 1600 * 900, renderScale: 1 });
      if (pageCachee()) await pageVisible();
      preferenceGraphique();
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
      const mesure = lireStock(B.autoconfig.CLE, null);
      // La migration d'une ancienne mesure, un premier lancement ou une nouvelle
      // version ne déclenchent qu'une lecture passive des capacités déclarées.
      if (!B.autoconfig.cacheValide(mesure, empreinteDetection()) || mesure.methode !== B.autoconfig.METHODE_PASSIVE)
        await detecterGraphismes(true);
      else {
        derniereDetection = mesure;
        if (mesure.statut === 'ok') {
          gpuModeste = mesure.selection === 'low';
          capacitesRendu = Object.freeze({ ...capacitesRendu, gpuModeste });
        }
      }
      // Résoudre le profil avant la première allocation de cibles de rendu :
      // un téléphone ne passe pas brièvement par le profil Auto plus coûteux.
      B.graphismes.stabiliser(etatProfils, reglages.qualite, palier.n, horlogeProfils());
      appliquerPalier();
      // qualité Auto : le palier appris sur cette machine, plutôt que de repayer les secondes lentes du premier départ
      if (restaurerPalier()) { B.graphismes.stabiliser(etatProfils, reglages.qualite, palier.n, horlogeProfils()); appliquerPalier(); }
      son = B.son.creer();
      reglages.circuit = clamp(reglages.circuit | 0, 0, CATALOGUE.length - 1);
      // Le titre est un menu opaque. La première séance prépare son décor, sa physique et ses glaces.
      $('chargement').classList.add('fini');
      aller('titre');
      ouvrirAccesOutils();
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
    const forcePluie = B.conditionsCourse.normaliserForcePluie(options.forcePluie);
    const vue = options.vue || 'cockpit', vue2 = options.vue2 || 'cockpit';
    const partage = options.partage || 'haut-bas', glaces = options.retro || 'oui';
    const difficulte = options.difficulte ?? 1, tours = options.tours ?? 3;
    const pilote = options.pilote ?? true;
    const vitesse = options.vitesse ?? 75, mouille = options.mouille ?? (meteo === 'pluie' ? .75 : 0);
    const vues = VUES_COURSE.concat(['tele', 'helico', 'aileron', 'roue', 'arriere']);
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
    const cles = ['vue', 'vue2', 'partage', 'qualite', 'anticrenelage', 'ombres', 'vegetation', 'faune', 'moment', 'saison', 'retro', 'meteo', 'forcePluie', 'saisonMode', 'momentMode', 'meteoMode', 'pneus', 'pneusPilotes', 'pneusAutoPilotes', 'secousses', 'vibrations', 'champ', 'difficulte', 'tours'];
    const avant = Object.fromEntries(cles.map(k => [k, reglages[k]])), decorAvant = decorEnrichi;
    Object.assign(reglages, { vue, vue2, partage, qualite, difficulte, tours, retro: glaces, meteo, forcePluie, saisonMode: 'manuel', momentMode: 'manuel', meteoMode: 'manuel', secousses: 0, vibrations: 'non', champ: DEFAUT.champ });
    Object.assign(reglages, B.graphismes.normaliserOptions(options));
    reglages.moment = B.ambiance.normaliser(options.moment ?? 'jour');
    reglages.saison = B.saisons.normaliser(options.saison ?? 'ete');
    reglages.pneus = B.conduite.pneusConseilles(B.chaussee.lire(null, 0, meteoPourConditions({ meteo, forcePluie, saison: reglages.saison }, i, graine)));
    reglages.pneusPilotes = [reglages.pneus, reglages.pneus]; reglages.pneusAutoPilotes = [true, true];
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
    if (co.physique && B.physique.repositionner) B.physique.repositionner(co);
    remplirPoses(S.cour, co); remplirPoses(S.prec, co);
    cameraEssai = null; horlogeReelle = 0; tPrec = 0; dureeImage = 16;
    Object.assign(palier, { n: gpuModeste ? 1 : 0, somme: 0, compte: 0, t: 0, aise: 0 });
    // glaces remises à leur état de départ sans réallouer : rien ne naît dans la première image de la référence
    for (const G of [retro.j1, retro.j2]) if (G) { G.cote = 0; remettreLampes(G); }
    S.reference = { graine, circuit: i, circuitId: CATALOGUE[i].id, graineCircuit: CATALOGUE[i].graine,
      mode, qualite, ...B.graphismes.normaliserOptions(reglages), moment: reglages.moment, saison: reglages.saison, difficulte, tours, pilote, vue, vue2, partage, retro: glaces, meteo, forcePluie, mouille, depart: ramener(depart, c.longueur), vitesse,
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
  const outilsJeu = { get session() { return session; }, get rendu() { return rendu; }, get ecran() { return ecran; }, reglages, CATALOGUE, avancer, banc, reference, detecterGraphismes,
    // ce que le banc et le contrôle visuel vérifient sans toucher au jeu : la scène installée et le profil résolu
    get menuArcade() { return menuArcade.stats(); },
    get scene() { return scene; }, get profil() { return profilDe(session); }, get ancre() { return etatProfils.decor; },
    get vitres() { return { j1: vitreVue ? vitreVue.stats : null, j2: vitreVue2 ? vitreVue2.stats : null }; },
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
    // le public des tribunes : visible ou non (mesures avec et sans), scène et mesures de la dernière image
    public: { get visible() { return publicVisible; }, set visible(v) { publicVisible = !!v; },
      get scene() { return scene && scene.public; }, get mesure() { return scene && scene.vuePublic ? scene.vuePublic.mesure : null; } },
    // volet de mesures : BITUME_JEU.mesures = true l'ouvre, false le ferme ; la lecture donne l'instantané
    get mesures() { return B.mesures.lire(rendu); }, set mesures(v) { B.mesures.afficher(!!v, rendu); },
    // chronomètre GPU du volet, fermé par défaut (ses requêtes coûtent) ; cadence : période, diviseur, essais
    get chronoGPU() { return B.mesures.chronoGPU; }, set chronoGPU(v) { B.mesures.chrono(!!v, rendu); },
    get cadence() { return B.cadence.etat(cadence); } };
  function publierOutils() {
    Object.defineProperty(window, 'BITUME_JEU', { value: outilsJeu, configurable: true, enumerable: true, writable: true });
    return outilsJeu;
  }
  function ouvrirAccesOutils() {
    // Les clients historiques attendent l’objet puis appellent reference() ou demo() de façon synchrone.
    // Consulter l’objet au titre déclenche PhysX. Le jeu lui-même y accède uniquement à travers ses fonctions internes.
    B.jeuPret = preparerPhysique;
    Object.defineProperty(window, 'BITUME_JEU', { configurable: true, enumerable: true, get() {
      if (window.FPhysX?.isReady()) return publierOutils();
      if (!initialisationPhysique) void preparerPhysique().catch(e => console.error('BITUME : initialisation de PhysX', e));
      return undefined;
    } });
  }
  setTimeout(demarrer, 20);
})(globalThis.BITUME = globalThis.BITUME || {});
