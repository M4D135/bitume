(function (B) {
  'use strict';
  // BITUME : coque du jeu (boucle à pas fixe, commandes, caméras, affichage, menus). Écrit par Claude.

  const DT = 1 / 120;
  const $ = id => document.getElementById(id);
  const clamp = (x, a, b) => x < a ? a : (x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const angle = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
  const ramener = (s, L) => ((s % L) + L) % L;

  // Les trois circuits de l'essai : graines fixes, tracés générés par circuit.js.
  const CATALOGUE = [
    { id: 'val-brule', nom: 'Val-Brûlé', lieu: 'Forêt', theme: 'foret', graine: 11, longueur: 4200 },
    { id: 'port-sable', nom: 'Port-Sable', lieu: 'Bord de mer', theme: 'cote', graine: 29, longueur: 3600 },
    { id: 'haut-col', nom: 'Haut-Col', lieu: 'Montagne', theme: 'montagne', graine: 47, longueur: 5200 }
  ];

  // ---------------------------------------------------------------- stockage local (commodités propres au navigateur)
  function lireStock(cle, defaut) { try { const t = localStorage.getItem(cle); return t ? JSON.parse(t) : defaut; } catch (e) { return defaut; } }
  function ecrireStock(cle, valeur) { try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) { /* stockage indisponible */ } }
  const DEFAUT = { vue: 'cockpit', vue2: 'poursuite', partage: 'haut-bas', boite: 'auto', aide: 0.35, qualite: 'auto', general: 0.8, moteur: 0.9, effets: 0.9, tours: 3, difficulte: 1, circuit: 0, champ: 60, retro: 'auto', pneus: 'slicks', tableau: 'reduit', carte: 'oui', cartePosition: 'droite', carteTaille: 'normale', demo: 'oui', vibrations: 'oui', vibrationForce: 0.5, meteo: 'aleatoire',
    secousses: (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1; } catch (e) { return 1; } })() };
  const reglages = Object.assign({}, DEFAUT, lireStock('bitume.reglages', {}));
  // Champ du cockpit : 69° n'a été le défaut que l'après-midi du 16/11, et David le trouve trop large (« fov moins
  // prononcé »). Une valeur restée à 69 revient une seule fois au défaut ; tout autre choix du pilote est gardé.
  if (!reglages.champRevu) { if (+reglages.champ === 69) reglages.champ = DEFAUT.champ; reglages.champRevu = true; }
  reglages.secousses = Number.isFinite(+reglages.secousses) ? clamp(+reglages.secousses, 0, 1) : DEFAUT.secousses;
  // Les anciens placements auto/haut/bas reviennent en haut à droite ; taille et visibilité sont conservées.
  for (const [cle, valeurs] of Object.entries({ carte: ['oui', 'non'], cartePosition: ['gauche', 'droite'], carteTaille: ['petite', 'normale', 'grande'] }))
    if (!valeurs.includes(reglages[cle])) reglages[cle] = DEFAUT[cle];
  const sauverReglages = () => ecrireStock('bitume.reglages', reglages);
  // records et fantômes suivent la physique : ceux de l'essai 0.1 (avant le modèle à deux essieux) ne se comparent plus
  const PHYSIQUE = 'p8', CLE_RECORDS = 'bitume.records.' + PHYSIQUE, CLE_FANTOME = 'bitume.fantome.' + PHYSIQUE + '.';
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
  const canvas = $('scene'), jeu = $('jeu');
  function appliquerCarte() {
    for (const cle of ['carte', 'cartePosition', 'carteTaille'])
      if (jeu.dataset[cle] !== reglages[cle]) jeu.dataset[cle] = reglages[cle];
  }
  appliquerCarte();

  // Rien ne se coupe à distance : le plan lointain passe derrière tout le décor (au plus à 4,4 km de la piste) et la
  // brume fait la limite. Les ombres du soleil prennent tout l'atlas du moteur sur un carré de 200 m de côté.
  const PORTEE_VUE = 6000, OMBRE = 100, OMBRE_DEVANT = 76;
  function installer(i) {
    if (scene && scene.index === i) return scene;
    const c = circuit(i), decor = B.decor.construire(c);
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
    scene = { index: i, c, decor, fond, plan: p, ombre };
    return scene;
  }

  // ---------------------------------------------------------------- séances : vitrine (écran titre), démo, course, chrono
  // Vitrine et démo : les douze voitures sont à l'IA. La vitrine tourne sans fin derrière les menus ; la démo est
  // une vraie course de trois tours, filmée par le réalisateur, que la suivante remplace sur le circuit d'après.
  const TOURS_DEMO = 3, PILOTE_DEMO = 'N. Aubrac';
  let graineCourse = (Date.now() >>> 7) & 0xffff;
  function lancer(type, i, enl) {
    // en ligne, une machine qui porte deux pilotes joue en écran partagé, comme une course à deux
    if (enl && enl.locaux.length === 2) type = 'duo';
    const sc = installer(i), c = sc.c, demo = type === 'demo', auto = demo || type === 'vitrine', duo = type === 'duo';
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
    const meteoInit = enl ? (B.meteo.pour(enl.meteo) || B.meteo.initial(enl.graine))
      : (type === 'course' || type === 'chrono' || duo)
      ? (B.meteo.pour(reglages.meteo) || B.meteo.initial(graineCourse))
      : B.meteo.initial(graineCourse);
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
      meteo: meteoInit
    };
    if (enl) {
      S.enLigne = { T0: enl.T0, role: enl.role, humains: enl.humains }; S.enLigneOrigine = true;
      course.distant = (v, dt) => appliquerDistant(S, v, dt);
      EL.recus.clear(); EL.corr.clear(); EL.pasEnvoi = 0;
    }
    // Écran partagé (David, 16/11 : « multi en écran splitté local, deux manettes, l'un sur l'autre ou côte à côte ») :
    // la vue du joueur 2 a son propre état de caméra, d'éclair et d'affichage, le reste vient de la séance.
    if (duo) S.vueJ2 = Object.assign(Object.create(S), { camCap: null, tete: null, secousse: 0, eclair: 0, lumiere: 1, sol: null, tele: { poste: null, alea: graine32(31 + i) },
      suivie: course.duo ? course.voitures.filter(v => v.joueur)[1].id : 1, vue: reglages.vue2, positionPrec: 0, derniereJauge: -9, prochainClassement: 0, profilMeilleur: null });
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
  const pad = { precedent: [], volant: 0, gaz: 0, frein: 0, derive: false, actif: false, manette: null, deriveEtat: null, rumbleF: -1, rumbleS: -1, rumbleT: 0, choc: 0, passe: 0 };
  const pad2 = { precedent: [], volant: 0, gaz: 0, frein: 0, derive: false, manette: null, rumbleF: -1, rumbleS: -1, rumbleT: 0, choc: 0, passe: 0 };   // manette du joueur 2 (écran partagé)
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
    souris.active = true; souris.x = e.clientX; souris.largeur = innerWidth || 1; boutonsSouris(e); activerSon();
  });
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; souris.x = e.clientX; souris.largeur = innerWidth || 1; if (souris.active) boutonsSouris(e); }, { passive: true });
  addEventListener('pointerup', e => { if (e.pointerType === 'mouse') boutonsSouris(e); });
  addEventListener('contextmenu', e => { if (enCourse() || ecran === 'pause') e.preventDefault(); });
  addEventListener('wheel', e => {
    if (!enCourse() || !souris.active || !e.deltaY) return;
    const imp = session && session.type === 'duo' && sourisPour(1) ? impulsions2 : impulsions;
    if (e.deltaY < 0) imp.haut = true; else imp.bas = true;
  }, { passive: true });
  let pauseAuto = true; // coupée par BITUME_JEU.pauseAuto = false, pour les captures et le banc
  let pilotageAuto = false; // BITUME_JEU.pilotageAuto = true : l'ordinateur conduit la voiture du joueur en temps réel (essais en ligne)
  let cameraEssai = null; // BITUME_JEU.camera = (pose, camera) => ({ pos, yaw, pitch, fov }) : vue libre pour les captures
  addEventListener('blur', () => { touches.clear(); souris.gaz = souris.frein = souris.derive = false; relacherTactile(); if (pauseAuto && enCourse()) basculerPause(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) relacherTactile();
    if (pauseAuto && document.hidden && enCourse()) basculerPause(true);
    if (son) son.musique(!document.hidden && ecran === 'titre'); // onglet caché : le minuteur du thème serait bridé
  });
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
    const ancienne = pad.manette, etatDerive = pad.deriveEtat;
    // à deux en course : deux manettes, une chacun ; une seule va au joueur 2 (le joueur 1 garde le clavier). En pause,
    // la première manette mène les menus et la seconde peut reprendre.
    const connectees = [];
    for (const candidate of liste) if (candidate && candidate.connected) connectees.push(candidate);
    nbManettes = connectees.length; manettes = connectees;
    const duoJeu = !!session && session.type === 'duo' && (ecran === 'course' || ecran === 'pause');
    const [p1, p2] = duoJeu && ecran === 'course' ? assigner(connectees) : [connectees[0] || null, duoJeu && connectees.length >= 2 ? connectees[1] : null];
    if (duoJeu || pad2.manette) lireManette2(p2);
    const p = p1;
    const change = (ancienne?.index ?? -1) !== (p?.index ?? -1) || ancienne?.id !== p?.id;
    if (change) {
      // Une manette perdue ne relâche pas une dérive chargée en déclenchant un turbo involontaire.
      // Seul l'état auquel ses commandes ont été appliquées compte ; une nouvelle séance reste intacte.
      if (ancienne && etatDerive === session?.course?.joueur?.etat && etatDerive?.derive?.actif &&
          !doigt.derive && !touches.has('Space') && !touches.has('ShiftLeft') && !touches.has('ShiftRight'))
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
      if (enCourse()) {
        if (nouveau(5)) impulsions.haut = true;
        if (nouveau(4)) impulsions.bas = true;
        if (nouveau(3)) changerVue();
      }
      if (nouveau(9)) {
        if (enCourse() || ecran === 'pause') basculerPause();
        else if (ecran === 'titre') { modePrepa = 'course'; activerSon(); aller('preparation'); }
        else if (ecran === 'preparation') { const b = $('b-depart'); if (b) { activerSon(); b.click(); } }
        else naviguerManette(nouveau);
      } else if (!enCourse()) naviguerManette(nouveau);
      for (let i = 0; i < p.buttons.length; i++) pad.precedent[i] = appuye(i);
      if (Math.abs(pad.volant) > .05 || pad.gaz > .05 || pad.frein > .05) { pad.actif = true; analogique = true; activerSon(); }
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
  let pluieVue = null, pluieVue2 = null;
  const METEO_ABRI = { pluie: 0, nuage: 0, eclair: 0, mouille: 0, ventX: 0, ventZ: 0, t: 0 };
  function dessinerMeteo(S, dt, cam, vue) {
    // à deux, les gouttes du joueur 2 tombent sur sa moitié (toile #meteo2)
    const deux = S !== session;
    if (deux && !pluieVue2) pluieVue2 = B.meteo.creerPluie($('meteo2'));
    if (!deux && !pluieVue) pluieVue = B.meteo.creerPluie($('meteo'));
    // sous la voûte du tunnel, il ne pleut pas
    const suivie = S.course.voitures[S.suivie || 0], abri = !VUES_DEHORS.has(vue) && B.circuit.dansTunnel(S.course.c, suivie.etat.s, -4);
    (deux ? pluieVue2 : pluieVue).dessiner(abri ? Object.assign(METEO_ABRI, { t: S.meteo.t }) : S.meteo, cam, dt, { cockpit: vue === 'cockpit', dpr: window.devicePixelRatio || 1 });
  }

  // menus à la manette : croix pour se déplacer (gauche, droite règlent un curseur), A valide, B revient
  function naviguerManette(nouveau) {
    const zone = $(ecran); if (!zone || zone.hidden) return;
    const liste = Array.from(zone.querySelectorAll('button, input')).filter(el => !el.disabled && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]'));
    if (!liste.length) return;
    const i = liste.indexOf(document.activeElement), el = liste[i];
    if (el && el.type === 'range' && (nouveau(14) || nouveau(15))) {
      el.value = String(clamp(+el.value + (nouveau(15) ? 1 : -1) * (+el.step || .05), +el.min, +el.max));
      el.dispatchEvent(new Event('input', { bubbles: true })); return;
    }
    const bouger = k => liste[i < 0 ? 0 : (i + k + liste.length) % liste.length].focus({ focusVisible: true });
    if (nouveau(12) || nouveau(14)) bouger(-1);
    else if (nouveau(13) || nouveau(15)) bouger(1);
    else if (nouveau(0)) { const cible = el || liste[0]; cible.focus({ focusVisible: true }); cible.click(); }
    else if (nouveau(1)) retour();
  }

  // à deux au clavier, le joueur 1 garde ZQSD (WASD), Espace et Maj gauche ; les flèches vont au joueur 2, sauf
  // quand celui-ci a l'unique manette
  function lireManette2(p) {
    const change = (pad2.manette?.index ?? -1) !== (p?.index ?? -1) || pad2.manette?.id !== p?.id;
    pad2.manette = p; pad2.volant = pad2.gaz = pad2.frein = 0; pad2.derive = false;
    if (!p) { pad2.precedent.length = 0; return; }
    const b = i => p.buttons[i] ? (p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0)) : 0, appuye = i => b(i) > .5, nouveau = i => appuye(i) && !pad2.precedent[i];
    if (change) for (let i = 0; i < p.buttons.length; i++) pad2.precedent[i] = appuye(i);
    const ax = p.axes[0] || 0, morte = .06, x = Math.abs(ax) < morte ? 0 : Math.sign(ax) * (Math.abs(ax) - morte) / (1 - morte);
    pad2.volant = Math.sign(x) * Math.pow(Math.abs(x), 1.22);
    pad2.gaz = b(7); pad2.frein = b(6); pad2.derive = appuye(0) || appuye(2);
    if (ecran === 'course' && nouveau(3)) changerVue2();
    if (nouveau(9)) { activerSon(); basculerPause(); }
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
    const cmd = { gaz, frein, volant, derive, marcheArriere: true, haut: impulsions2.haut, bas: impulsions2.bas, boite: 'auto', aide: reglages.aide, guidage: analog ? 0 : .15 };
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
    // en Auto, le clavier ou la manette reprennent la main sur la souris
    if (c0 === 'auto' && souris.active && (gaz || frein || volant || pad.actif)) souris.active = false;
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
    pad.deriveEtat = pad.derive && session ? session.course.joueur.etat : null;
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
  function annoncerCourse() {
    if (EL.role !== 'hote' || !EL.R) return;
    const prevue = (reglages.meteo && reglages.meteo !== 'aleatoire' && B.meteo.pour(reglages.meteo)) || B.meteo.initial(graineCourse + 1);
    EL.course = { i: reglages.circuit, tours: reglages.tours, difficulte: reglages.difficulte, meteo: reglages.meteo || 'aleatoire', eau: B.conduite.eauSurPiste(prevue) };
    EL.R.envoyer(Object.assign({ t: 'course' }, EL.course));
    majCourseSalon();
  }
  function majCourseSalon() {
    const k = EL.course, ouvert = !!EL.R && EL.R.etat !== 'ferme';
    $('l-course').hidden = !(ouvert && k);
    if (!k) return;
    const conseil = B.conduite.pneusConseilles(k.eau), meteo = NOMS_METEO[k.meteo] || (k.eau > .25 ? 'pluie, tirée au sort' : 'sec, tirée au sort');
    texte($('l-course-texte'), 'Prochaine course : ' + CATALOGUE[k.i].nom + ' · ' + k.tours + ' tours · météo : ' + meteo + ' (pneus conseillés : ' + NOMS_PNEUS[conseil].toLowerCase() + ').');
    $('l-vers-prets').hidden = !EL.confirmation;
  }
  // Avant le départ (David, 16/11 : « un écran de confirmation quand tout le monde est prêt, pour régler ses options
  // avant la course ») : l'hôte propose la course ; chaque machine règle pneus, boîte et vue, puis se dit prête ; la
  // course part quand toutes les machines liées le sont. L'hôte peut annuler ; une machine peut revenir au salon.
  function proposerCourse() {
    const R = EL.R;
    if (!R || !lienActif() || EL.role !== 'hote') { etatEnLigne('Pas d’autre pilote connecté.'); aller('enligne'); return; }
    annoncerCourse();
    EL.confirmation = { prets: new Set() }; EL.pretIci = false;
    R.envoyer({ t: 'confirmer', course: EL.course });
    aller('prets');
  }
  function majPrets() {
    const k = EL.course, R = EL.R, C = EL.confirmation;
    if (!k || !R || !C) return;
    const meteo = NOMS_METEO[k.meteo] || (k.eau > .25 ? 'pluie, tirée au sort' : 'sec, tirée au sort');
    texte($('pr-course'), CATALOGUE[k.i].nom + ' · ' + k.tours + ' tours · météo : ' + meteo);
    texte($('pr-pneus-conseil'), 'Conseillés pour cette météo : ' + NOMS_PNEUS[B.conduite.pneusConseilles(k.eau)].toLowerCase() + '.');
    for (const [nom, val] of [['pneusPret', reglages.pneus], ['boitePret', reglages.boite], ['vuePret', reglages.vue]]) for (const r of document.querySelectorAll('input[name="' + nom + '"]')) r.checked = r.value === val;
    let html = '', n = 0, m = 0;
    for (const x of [...R.membres].sort((a, b) => a.id - b.id)) {
      if (x.id !== R.id && !R.pretAvec(x.id)) continue;
      const pret = C.prets.has(x.id);
      m++; if (pret) n++;
      html += '<li' + (x.id === R.id ? ' class="moi"' : '') + '><b>' + propre(x.nom) + '</b><span>' + (x.joueurs === 2 ? '2 pilotes' : '1 pilote') + (x.id === 0 ? ' · hôte' : '') + '</span><em class="' + (pret ? 'pret' : 'attente') + '">' + (pret ? 'prêt' : 'règle ses options…') + '</em></li>';
    }
    const liste = $('pr-pilotes');
    if (liste._html !== html) { liste._html = html; liste.innerHTML = html; }
    texte($('pr-etat'), m && n === m ? 'Tout le monde est prêt : départ !' : n + ' machine' + (n > 1 ? 's' : '') + ' prête' + (n > 1 ? 's' : '') + ' sur ' + m + '. La course part quand toutes le sont.');
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
  // hôte : la liste des machines prêtes à tous ; toutes prêtes, la course part
  function diffuserPrets() {
    const R = EL.R, C = EL.confirmation;
    if (!R || !C || EL.role !== 'hote') return;
    R.envoyer({ t: 'prets', liste: [...C.prets] });
    majPrets();
    const ids = R.membres.filter(m => m.id === R.id || R.pretAvec(m.id)).map(m => m.id);
    if (ids.length >= 2 && ids.every(id => C.prets.has(id))) { EL.confirmation = null; EL.pretIci = false; setTimeout(departEnLigne, 700); }
  }
  function quitterPrets() {
    if (EL.role === 'hote') { EL.confirmation = null; if (EL.R) EL.R.envoyer({ t: 'annuler' }); }
    else if (EL.R && EL.pretIci) EL.R.envoyer({ t: 'pret', oui: false }, 0);
    EL.pretIci = false;
    aller('enligne');
  }
  function recevoirCourse(m) {
    if (!m || !CATALOGUE[m.i]) return;
    // nouvelle annonce : les pneus conseillés sont présélectionnés quand la météo change, le pilote peut changer
    const eau = clamp(+m.eau || 0, 0, 1), avant = EL.course;
    EL.course = { i: m.i | 0, tours: clamp(m.tours | 0, 1, 99), difficulte: m.difficulte | 0, meteo: String(m.meteo || ''), eau };
    if (!avant || Math.abs(avant.eau - eau) > .05 || !B.conduite.PNEUS[reglages.pneus]) { reglages.pneus = B.conduite.pneusConseilles(eau); envoyerPneus(); }
    majCourseSalon();
    if (ecran === 'prets') majPrets();
  }
  function envoyerPneus() {
    if (EL.R && EL.role === 'invite' && EL.R.pretAvec(0) && B.conduite.PNEUS[reglages.pneus]) EL.R.envoyer({ t: 'pneus', pneus: reglages.pneus }, 0);
  }
  function nouvelleLiaison() {
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
    }).on('salle', () => { if (R === EL.R) majSalon(); })
      .on('pair', id => {
        if (R !== EL.R) return;
        majSalon();
        if (EL.role !== 'hote') { if (id === 0) envoyerPneus(); return; }
        annoncerCourse();
        // une machine arrive pendant la confirmation : elle la reçoit aussi
        if (EL.confirmation) { R.envoyer({ t: 'confirmer', course: EL.course }, id); R.envoyer({ t: 'prets', liste: [...EL.confirmation.prets] }, id); majPrets(); }
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
    setTimeout(() => { lancer('course', cfg.i, cfg); $('chargement').classList.add('fini'); aller('course'); }, 30);
  }
  function surMessageEnLigne(m, de) {
    const S = session;
    if (m.t === 'depart' && de === 0 && EL.role === 'invite' && m.cfg) {
      const humains = (Array.isArray(m.cfg.humains) ? m.cfg.humains : []).slice(0, 4).map(h => ({ nom: propre(h.nom), machine: h.machine | 0 }));
      const locaux = humains.map((h, k) => h.machine === EL.R.id ? k : -1).filter(k => k >= 0);
      EL.confirmation = null; EL.pretIci = false;
      if (!locaux.length) { etatEnLigne('La course est partie sans cette machine : attendez la suivante.'); majCourseSalon(); return; }
      lancerEnLigne(Object.assign({}, m.cfg, { humains, locaux, role: 'invite' }));
    } else if (m.t === 'course' && de === 0 && EL.role === 'invite') recevoirCourse(m);
    else if (m.t === 'confirmer' && de === 0 && EL.role === 'invite') {
      recevoirCourse(m.course);
      EL.confirmation = { prets: new Set() }; EL.pretIci = false;
      if (ecran !== 'course' && ecran !== 'pause') aller('prets');
      majCourseSalon();
    } else if (m.t === 'prets' && de === 0 && EL.confirmation) { EL.confirmation.prets = new Set((Array.isArray(m.liste) ? m.liste : []).map(x => x | 0)); majPrets(); }
    else if (m.t === 'annuler' && de === 0) {
      EL.confirmation = null; EL.pretIci = false;
      if (ecran === 'prets') aller('enligne');
      etatEnLigne('L’hôte a annulé le départ.'); majCourseSalon();
    } else if (m.t === 'pret' && EL.role === 'hote' && EL.confirmation) {
      if (B.conduite.PNEUS[m.pneus]) EL.pneusDe.set(de, m.pneus);
      if (m.oui) EL.confirmation.prets.add(de); else EL.confirmation.prets.delete(de);
      diffuserPrets();
    } else if (m.t === 'pneus' && EL.role === 'hote') {
      if (B.conduite.PNEUS[m.pneus]) EL.pneusDe.set(de, m.pneus);
    } else if (m.t === 'arrivee' && S && S.enLigne) {
      const v = S.course.voitures[m.id];
      if (v && v.distant && Number.isFinite(m.temps)) { v.tempsOfficiel = m.temps; if (v.fini) v.tempsFinal = m.temps; }   // temps officiel
    } else if (m.t === 'vers-salon' && de === 0 && EL.role === 'invite' && ecran !== 'enligne' && (!S || !S.enLigne || S.course.termine)) aller('enligne');
  }
  // une machine (pas l'hôte) quitte la partie : l'ordinateur de l'hôte reprend ses voitures et envoie leur état
  function surDepart(id) {
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
    const meteo = reglages.meteo || 'aleatoire', graine = ++graineCourse;
    const conseil = B.conduite.pneusConseilles(B.conduite.eauSurPiste(B.meteo.pour(meteo) || B.meteo.initial(graine)));
    const cfg = { graine, i: reglages.circuit, tours: reglages.tours, difficulte: reglages.difficulte, meteo, T0: R.horloge() + 4000, humains,
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
  $('p-touches').addEventListener('click', () => { retourReglages = 'preparation'; aller('reglages'); setTimeout(() => $('r-commandes').scrollIntoView({ block: 'start' }), 60); });
  $('l-code').addEventListener('input', e => { const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); if (v !== e.target.value) e.target.value = v; });
  $('l-code-affiche').addEventListener('click', () => {
    const code = $('l-code-affiche').textContent;
    if (navigator.clipboard && code) navigator.clipboard.writeText(code).then(() => etatEnLigne('Code ' + code + ' copié. Envoyez-le à l’autre pilote.'), () => {});
  });
  $('l-code').addEventListener('keydown', e => { if (e.key === 'Enter') rejoindre(); });
  $('l-choisir').addEventListener('click', () => { modePrepa = 'enligne'; aller('preparation'); annoncerCourse(); });
  $('l-reglages').addEventListener('click', () => { retourReglages = 'enligne'; aller('reglages'); });
  $('l-vers-prets').addEventListener('click', () => aller('prets'));
  $('pr-pret').addEventListener('click', basculerPret);
  $('pr-retour').addEventListener('click', quitterPrets);
  $('pr-reglages').addEventListener('click', () => { retourReglages = 'prets'; aller('reglages'); });

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
  // En qualité Auto, quand les images ralentissent (plus de 19 ms en moyenne pendant 2 s, volet visible), le jeu
  // retire un effet coûteux après l'autre : image réelle des rétroviseurs, ombres, halo et reflets, puis il baisse la
  // résolution (palier 4). Il remonte d'un palier après 8 s sous 14 ms. Le gouverneur de résolution du moteur
  // continue d'agir dans chaque palier. Les qualités Légère et Fine restent fixes.
  const palier = { n: 0, somme: 0, compte: 0, t: 0, aise: 0 };
  const PALIERS = 4;
  function majPalier(S, dt) {
    if (reglages.qualite !== 'auto' || S.banc || document.hidden || !(dt > 0) || dt > .25 || (S.type !== 'course' && S.type !== 'chrono' && S.type !== 'demo')) { palier.somme = palier.compte = palier.t = 0; return; }
    palier.somme += dt; palier.compte++; palier.t += dt;
    if (palier.t < 2) return;
    const moyenne = palier.somme / palier.compte * 1000;
    palier.somme = palier.compte = palier.t = 0;
    if (moyenne > 19 && palier.n < PALIERS) { palier.n++; palier.aise = 0; appliquerPalier(); }
    else if (moyenne < 14 && palier.n > (gpuModeste ? 1 : 0)) { if ((palier.aise += 2) >= 8) { palier.n--; palier.aise = 0; appliquerPalier(); } }
    else palier.aise = 0;
  }
  function appliquerPalier() { if (rendu) rendu.resize(palier.n >= 4 ? .75 : 'auto'); }
  // effets permis par la qualité et le palier
  const avecOmbres = q => q === 'high' || (q === 'auto' && palier.n < 2);
  // retour de halo en [0,1] : 0 = éteint, 1 = plein (qualité élevée ou palier suffisant)
  // on l'adapte aussi selon qu'on est dans le tunnel pour éviter le pop
  const intensiteHalo = (q, dansTunnel) => {
    const base = q === 'high' ? 1 : q === 'auto' && palier.n < 3 ? .5 : 0;
    // si on est dans le tunnel, faire doucement monter/descendre l'intensité
    if (dansTunnel !== undefined && dansTunnel !== null) {
      const av = dansTunnel.avancement !== undefined ? dansTunnel.avancement : 0;
      return base * (.5 + .5 * av);  // demi-intensity au début du tunnel, plein à la sortie
    }
    return base;
  };
  const avecReflets = (q, m) => !gpuModeste && (q === 'high' || (q === 'auto' && palier.n === 0)) && !!m && (m.mouille > .2 || m.pluie > .2);
  // Reflets d'écran (David, 16/11 : « améliore le rendu, reflets ») : sur piste mouillée, les voitures, le ciel et les
  // lampes du tunnel se reflètent dans les flaques (matières humides du moteur repris d'EMPRISE). Qualité Fine, ou
  // Auto au premier palier, hors processeur graphique modeste.

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
    const q = S.banc ? S.banc.qualite : reglages.qualite;
    return r === 'oui' && vue === 'cockpit' && S.type !== 'vitrine' && !retro.echec && !cameraEssai && q !== 'low' && !(q === 'auto' && palier.n >= 1);
  }
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
  function majGlaces(S, vue, cam, ps, sortie, ambiance, suivie) {
    // à deux, le joueur 2 a ses deux glaces, posées sur sa moitié ; chaque joueur rafraîchit une glace par image
    const G = S !== session ? (retro.j2 || (retro.j2 = { toiles: [$('glace-g2'), $('glace-d2')], ctx: [], cote: 0 }))
      : (retro.j1 || (retro.j1 = { toiles: [$('glace-g'), $('glace-d')], ctx: [], cote: 0 }));
    const toiles = G.toiles;
    const voir = retroVoulu(S, vue);
    for (const t of toiles) if (t.hidden === voir) t.hidden = !voir;
    if (!voir) return;
    const source = $('retro-rendu');
    if (!retro.rendu) {
      try { retro.rendu = window.FRender.create(source, { msaa: 0, shadowMapScale: 1, reflections: false, sea: false, overlayLighting: 'world' }); retro.rendu.resize(Math.min(window.devicePixelRatio || 1, 1.5)); }
      catch (e) { console.warn('BITUME : image des rétroviseurs indisponible', e); retro.echec = true; for (const t of toiles) t.hidden = true; return; }
    }
    if (!G.ctx.length) toiles.forEach((t, i) => { t.width = source.width; t.height = source.height; t.style.width = source.clientWidth + 'px'; t.style.height = source.clientHeight + 'px'; G.ctx[i] = t.getContext('2d'); });
    if (retro.scene !== scene.index) {
      const d = scene.decor;
      retro.rendu.setWorld([], [], d.atmosphere);
      retro.rendu.setNappes(d.nappes.map(n => Object.assign({}, n)));
      retro.rendu.setLots(d.lots.map(l => Object.assign({}, l, { tampon: null, tamponLoin: null, paquet: null, paquetLoin: null })));
      retro.scene = scene.index;
    }
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
    retro.rendu.draw(camR, objets, { time: horlogeReelle, shadows: false, bloom: false, torch: false, sunOnly: true, adaptive: false, frameMs: dureeImage, damage: 0, flash: 0, photo: 0, weather: ambiance });
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
    for (let k = 0; k < co.voitures.length; k++) poses[k] = melange(S.prec[k], S.cour[k], alpha, poses[k] || {});

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
    if (B.meteo) B.meteo.actuel = meteo;
    // Écran partagé : la vue du joueur 2 d'abord, copiée aussitôt dans sa toile 2D, puis celle du joueur 1, qui reste dans
    // la toile WebGL. Le moteur lit la taille affichée de sa toile à chaque image : il rend chaque vue à la moitié.
    if (S.type === 'duo' && S.vueJ2) {
      rendreVue(S.vueJ2, co.voitures[S.locaux[1]], reglages.vue2, dtImage, meteo);
      const t2 = $('scene2'), ctx2 = t2._ctx || (t2._ctx = t2.getContext('2d'));
      if (t2.width !== canvas.width || t2.height !== canvas.height) { t2.width = canvas.width; t2.height = canvas.height; }
      ctx2.drawImage(canvas, 0, 0);
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
        const atm = scene.decor.atmosphere;
        B.voiture.cockpit(S.modeles[k], ev, sortie, { regime: et.regime, volant: et.volant, rapport: et.rapport, kmh: B.conduite.kmh(et), roues: co.voitures[k].degats && co.voitures[k].degats.roues, casse: !!(et.degats && et.degats.casse),
          passage: suivie.tPassage === undefined ? 1 : (co.horloge - suivie.tPassage) / .36, rapportAvant: suivie.rapportAvant, derriere, ciel: atm.skyBottom, brume: atm.fog,
          glaceVive: !!retro.rendu && retroVoulu(S, vue) });
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
      if (!S.rotLampe) S.rotLampe = MATRICE_LAMPE(port.cap);
      for (let k = 0; k < port.feux.length; k++) {
        const allume = !co.feux.vert && k < co.feux.allumes;
        sortie.push({ shape: 'cylinder', p: port.feux[k], s: [.56, .05, .56], r: S.rotLampe, mat: allume ? 5 : 7, color: allume ? [1, .14, .06] : [.1, .03, .03], emissive: allume ? 3 : 0 });
      }
    }
    // traces de pneus, fumée et étincelles
    const tFx = S.banc ? performance.now() : 0;
    B.traces.dessiner(S.fx, sortie, cam.pos, S.fx.acc);
    if (S.banc) S.banc.effets += performance.now() - tFx;
    const q = S.banc ? S.banc.qualite : reglages.qualite;
    // uEffects.z colore tout l'écran : la rougeur suit seulement l'éclair du choc, jamais les dégâts persistants.
    const eclair = S.eclair || 0;
    // Tunnel : l'œil s'adapte. En entrant, l'intérieur paraît d'abord sombre puis s'éclaircit (0,8 s) ; en sortant, le
    // jour éblouit un instant (0,3 s). Les huit lampes les plus proches de la caméra éclairent les murs et la chaussée.
    // Les lumières sont ALLUMÉES EN PERMANENCE (puissance 12, portée 18) ; l'adaptation S.lumiere gère le passage lumière/caverne.
    const sousVoute = !VUES_DEHORS.has(vue) && B.circuit.dansTunnel(c, suivie.etat.s, -6), cibleLumiere = sousVoute ? 1.32 : 1;
    S.lumiere = S.lumiere ?? 1;
    S.lumiere += (cibleLumiere - S.lumiere) * (1 - Math.exp(-dtImage / (cibleLumiere > S.lumiere ? .8 : .3)));
    // LAMPES TUNNEL : toujours allumées plein pot, pas de progression progressive pour éviter le "clipping"
    // L'adaptation oculaire S.lumiere (0,8 s entrée / 0,3 s sortie) gère le passage lumière/caverne
    let lampes;
    const LT = scene.decor.tunnelLampes;
    if (LT && B.circuit.dansTunnel(c, suivie.etat.s, 80)) {
      lampes = tampons.lampes || (tampons.lampes = []); lampes.length = 0;
      for (const p of LT) { const d2 = (p[0] - cam.pos[0]) ** 2 + (p[2] - cam.pos[2]) ** 2; if (d2 < 4900) lampes.push({ p, power: 12, range: 18, color: [1, .84, .58], d2 }); }
      lampes.sort((a, b) => a.d2 - b.d2); if (lampes.length > 8) lampes.length = 8;
    }
    // Intensité du halo/bloom : pleine en qualité élevée, moitié en automatique au palier 2+, atténuée à l'entrée du tunnel
    const haloInt = intensiteHalo(reglages.qualite, { avancement });
    rendu.draw(cam, sortie, { time: horlogeReelle, shadows: avecOmbres(q), bloom: haloInt, brightness: S.lumiere, lights: lampes, torch: false, sunOnly: true, adaptive: q === 'auto', frameMs: dureeImage, damage: eclair, flash: eclair, photo: haloInt ? 1 : 0, reflections: avecReflets(q, meteo), weather: B.meteo.ambiance(meteo) });
    dessinerMeteo(S, dtImage, cam, vue);
    majGlaces(S, vue, cam, ps, sortie, B.meteo.ambiance(meteo), suivie);
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
  const sonRivaux = [];
  function majSon(S, cam, dtImage) {
    if (!son || !sonActif) return;
    // la voiture entendue de l'intérieur est celle que l'on suit de près : le joueur, ou celle du plan de la démo
    const co = S.course, ks = S.suivie || 0, et = co.voitures[ks].etat, poses = tampons.poses;
    const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    sonRivaux.length = 0;
    const exterieur = VUES_DEHORS.has(S.vue), micro = exterieur && S.type === 'demo';
    for (let k = 0; k < co.voitures.length; k++) {
      if (k === ks && !exterieur) continue;
      const p = poses[k], dx = p.x - cam.pos[0], dy = p.y - cam.pos[1], dz = p.z - cam.pos[2], d = Math.hypot(dx, dy, dz);
      if (S.distances[k] >= 0 && dtImage > 0) S.vRel[k] = lerp(S.vRel[k], clamp((S.distances[k] - d) / dtImage, -120, 120), .2);
      S.distances[k] = d;
      const v = co.voitures[k];
      // démo vue de l'extérieur : un micro d'ambiance rapproche les voitures (la caméra est à 30 à 120 m), l'effet Doppler reste celui de la caméra
      sonRivaux.push({ id: k, distance: micro ? 2 + d * .06 : d, angle: Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz), regime: v.etat.regime, gaz: v.etat.gaz, vRel: S.vRel[k] });
    }
    son.mettreAJour({
      pause: ecran === 'pause',
      joueur: { regime: et.regime, gaz: et.gaz, rapport: et.rapport, v: Math.abs(et.v), glisse: et.glisse, surface: et.surface, turbo: et.turbo.reste > 0, vue: S.vue === 'cockpit' ? 'cockpit' : 'poursuite', muet: exterieur,
        tunnel: !exterieur && B.circuit.dansTunnel(co.c, et.s, -2) },
      rivaux: sonRivaux
    }, dtImage);
  }

  // ---------------------------------------------------------------- affichage de course
  const H = {};
  for (const id of ['h-pos', 'h-sur', 'h-tour', 'h-tours', 'h-actuel', 'h-meilleur', 'h-delta', 'h-delta-ligne', 'h-vitesse', 'h-rapport', 'h-regime', 'h-fps', 'jauge-derive', 'classement', 'feux', 'carte', 'c-position', 'c-tour', 'message', 'sous-message']) H[id] = $(id);
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
  for (const id of ['h-pneus', 'c-pneus']) { H[id] = $(id); H2[id] = hud2.querySelector('#' + id); }
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
    if (H['h-fps']) { texte(H['h-fps'], fps + ' i/s'); classe(H['h-fps'], 'bas', fps < 50); }
  }

  // ---------------------------------------------------------------- écrans
  let ecran = 'chargement';
  const ECRANS = ['titre', 'enligne', 'prets', 'preparation', 'reglages', 'pause', 'resultats'];
  let modePrepa = 'course', retourReglages = 'titre';
  const enCourse = () => ecran === 'course';

  function aller(nom) {
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
      if (!session || session.type !== 'vitrine' || (nom === 'preparation' && session.i !== reglages.circuit)) lancer('vitrine', nom === 'preparation' ? reglages.circuit : (session ? session.i : reglages.circuit));
    }
    // en ligne, la pause n'arrête pas la course : pas de « Recommencer »
    if (nom === 'pause') { $('b-recommencer').hidden = !!(session && session.enLigne); $('b-replacer').hidden = aDeux(); }
    if (nom === 'enligne') majSalon();
    if (nom === 'prets') majPrets();
    tactile(nom === 'course' && !aDeux());
    if (nom === 'preparation') remplirPreparation();
    if (nom === 'reglages') remplirReglages();
    // une course arrêtée (pause, réglages, résultats) se tait ; la vitrine des menus continue, moins fort
    if (son) { if (session && session.type !== 'vitrine' && nom !== 'course' && nom !== 'demo') son.suspendre(); else son.reprendre(); }
    if (son) son.musique(nom === 'titre'); // seule musique du jeu : l'écran titre
    appliquerVolumes();
    if (nom === 'course' || nom === 'demo') { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return; }
    const focus = $(nom) && $(nom).querySelector('button.gros, button');
    if (focus && !estTactile) setTimeout(() => focus.focus({ preventScroll: true }), 30);
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
  }
  // Présélection des pneus selon la météo prévue (David, 16/11) : au soleil des slicks, sous la pluie des pneus
  // pluie ; la météo aléatoire est tirée d'avance (même graine que la course qui va partir). Le pilote peut changer.
  const NOMS_PNEUS = { slicks: 'Slicks', inter: 'Intermédiaires', pluie: 'Pluie' };
  function preselectionnerPneus() {
    const prevue = (reglages.meteo && reglages.meteo !== 'aleatoire' && B.meteo.pour(reglages.meteo)) || B.meteo.initial(graineCourse + 1);
    reglages.pneus = B.conduite.pneusConseilles(B.conduite.eauSurPiste(prevue));
    for (const r of document.querySelectorAll('input[name="pneus"]')) r.checked = r.value === reglages.pneus;
    $('p-pneus-conseil').textContent = 'Conseillés pour cette météo : ' + NOMS_PNEUS[reglages.pneus].toLowerCase() + '.';
  }
  function majPreparation() {
    preselectionnerPneus();
    for (const b of $('circuits').children) b.setAttribute('aria-checked', String(+b.dataset.index === reglages.circuit));
    const r = records[CATALOGUE[reglages.circuit].id];
    $('p-record').innerHTML = r ? 'Votre record sur ' + CATALOGUE[reglages.circuit].nom + ' : <b>' + chrono(r.tour) + '</b>' : 'Pas encore de temps sur ' + CATALOGUE[reglages.circuit].nom + '.';
  }
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'tours' || t.name === 'difficulte') { reglages[t.name] = +t.value; sauverReglages(); }
    if (t.name === 'meteo') { reglages.meteo = t.value; sauverReglages(); preselectionnerPneus(); }
    if (t.name === 'pneus' && B.conduite.PNEUS[t.value]) { reglages.pneus = t.value; sauverReglages(); }
    if ((t.name === 'pneusIci' || t.name === 'pneusPret') && B.conduite.PNEUS[t.value]) {
      reglages.pneus = t.value; sauverReglages(); envoyerPneus();
      if (EL.pretIci && EL.role === 'invite' && EL.R) EL.R.envoyer({ t: 'pret', oui: true, pneus: reglages.pneus }, 0);
    }
    if (t.name === 'boitePret' && ['auto', 'manuelle'].includes(t.value)) { reglages.boite = t.value; sauverReglages(); }
    if (t.name === 'vuePret' && ['cockpit', 'poursuite'].includes(t.value)) { reglages.vue = t.value; sauverReglages(); }
    if (EL.role === 'hote' && lienActif() && ['tours', 'difficulte', 'meteo', 'pneus'].includes(t.name)) annoncerCourse();
    if (t.name === 'joueursIci') { reglages.joueursLocaux = t.value === '2' ? 2 : 1; sauverReglages(); }
    if (t.name === 'partage') { reglages.partage = t.value === 'cote' ? 'cote' : 'haut-bas'; sauverReglages(); }
    if (/^r?cmd[01]$/.test(t.name) && NOMS_COMMANDES[t.value]) {
      const n = +t.name.slice(-1);
      reglages.commandes = [commande(0), commande(1)]; reglages.commandes[n] = t.value; souris.active = false; sauverReglages();
      if (t.name[0] === 'r') majCommandes(); else for (const r of document.querySelectorAll('input[name="rcmd' + n + '"]')) r.checked = r.value === t.value;
    }
    if (['vue', 'boite', 'qualite', 'tableau', 'retro', 'demo', 'cartePosition', 'carteTaille'].includes(t.name)) { reglages[t.name] = t.value; sauverReglages(); appliquerCarte(); if (t.name === 'qualite' && rendu) { palier.n = gpuModeste ? 1 : 0; rendu.resize(t.value); } }
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
    for (const nom of ['vue', 'boite', 'qualite', 'aide', 'tableau', 'retro', 'demo', 'cartePosition', 'carteTaille']) for (const r of document.querySelectorAll('input[name="' + nom + '"]')) r.checked = String(reglages[nom]) === r.value;
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

  $('b-depart').addEventListener('click', () => modePrepa === 'enligne' ? proposerCourse() : demarrerSeance(modePrepa));
  function demarrerSeance(type) {
    $('chargement').classList.remove('fini');
    setTimeout(() => {
      lancer(type, reglages.circuit);
      $('chargement').classList.add('fini');
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
  let tPrec = 0;
  function image(t) {
    requestAnimationFrame(image);
    const dtReel = tPrec ? Math.min(.1, (t - tPrec) / 1000) : DT;
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
    if (!S || !rendu) return;
    // la vitrine tourne derrière les menus ; une course ne tourne qu'à l'écran de course, la démo qu'à l'écran de démo
    const tourne = S.type === 'vitrine' ? ecran !== 'chargement' : ecran === (S.type === 'demo' ? 'demo' : 'course') || (!!S.enLigne && (ecran === 'pause' || ecran === 'resultats'));
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
      while (S.acc >= DT && n < 14) { pasSimulation(S, !!S.banc); S.acc -= DT; n++; }
      if (n === 14) S.acc = 0;
    } else if (horlogeReelle - (S.imageFigee || 0) < .25) return; // image arrêtée : quatre images par seconde suffisent
    S.imageFigee = horlogeReelle;
    if (S.type === 'vitrine') S.suiviRang = Math.floor(horlogeReelle / 18) % 4;
    const dtVu = tourne ? dtReel : 0, cam = rendreImage(S, clamp(S.acc / DT, 0, 1), dtVu);
    if (tourne) majPalier(S, dtReel);
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
    majSon(S, cam, dtVu);
  }

  // ---------------------------------------------------------------- démarrage
  // Petites configurations (David, 16/11 : « faire tourner ce jeu sur des petites configs type ordi portable de
  // bureau ») : un processeur graphique intégré ou logiciel est reconnu dès le départ ; le rendu part alors sans
  // anticrénelage, avec une carte d'ombres simple, et la qualité Auto commence un palier plus bas (voir paliers).
  let gpuModeste = false;
  function webgl2() {
    try {
      const t = document.createElement('canvas'), gl = t.getContext('webgl2');
      if (!gl) return false;
      const info = gl.getExtension('WEBGL_debug_renderer_info'), nom = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
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
  function demarrer() {
    if (!webgl2()) { erreur('WebGL2 indisponible', 'BITUME dessine la piste avec WebGL2. Ouvrez la page dans un navigateur récent (Chrome, Edge, Firefox, Safari 15 ou plus) avec l’accélération graphique active.'); return; }
    try {
      rendu = window.FRender.create(canvas,{msaa:gpuModeste?0:4,shadowMapScale:gpuModeste?1:2,reflections:!gpuModeste,sea:false,overlayLighting:'world'});
      palier.n = gpuModeste ? 1 : 0;
      if (rendu.stats.backend !== 'webgl2') { erreur('WebGL2 indisponible', 'Le rendu de secours ne sait pas dessiner la piste. Activez l’accélération graphique du navigateur.'); return; }
      rendu.resize(reglages.qualite);
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
  // Banc (console) : une course en qualité fixe (« high » par défaut ; le mode Auto masquerait les régressions), la
  // voiture du joueur confiée à l'IA, grille et feux passés en simulation. Après une seconde de chauffe, il mesure
  // l'intervalle entre deux images pendant 20 s, rend p50, p95 et la pire image en ms (objet JSON), puis revient à
  // l'écran titre. La séance est d'essai : ni record ni fantôme.
  function banc(options = {}) {
    const duree = options.duree || 20, chauffe = options.chauffe ?? 1, qualite = options.qualite || 'high';
    if (!rendu) return Promise.reject(new Error('rendu absent'));
    if (!['low', 'auto', 'high'].includes(qualite)) return Promise.reject(new Error('qualité inconnue : ' + qualite));
    lancer('course', clamp((options.circuit ?? reglages.circuit) | 0, 0, CATALOGUE.length - 1));
    const S = session; S.essai = true; S.banc = { qualite, effets: 0 };
    rendu.resize(qualite);
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
          effets: { moyenne: +(effets.reduce((a, b) => a + b, 0) / Math.max(1, effets.length)).toFixed(3), p95: +(effets.sort((a, b) => a - b)[Math.floor(.95 * effets.length)] || 0).toFixed(3) },
          traces: B.traces.compter(S.fx)
        };
        S.banc = null; rendu.resize(reglages.qualite);
        if (session === S && ecran === 'course') aller('titre');
        console.info('BITUME banc', JSON.stringify(r));
        rendre(r);
      };
      requestAnimationFrame(mesurer);
    });
  }
  window.BITUME_JEU = { get session() { return session; }, get rendu() { return rendu; }, get ecran() { return ecran; }, reglages, CATALOGUE, avancer, banc,
    get son() { return son ? son.stats() : null; }, get palier() { return palier.n; }, get gpuModeste() { return gpuModeste; },
    demo: i => lancerDemo(i === undefined ? reglages.circuit : i), // lance la démo sans attendre les cinq secondes
    get pauseAuto() { return pauseAuto; }, set pauseAuto(v) { pauseAuto = !!v; },
    get pilotageAuto() { return pilotageAuto; }, set pilotageAuto(v) { pilotageAuto = !!v; }, get enLigne() { return EL; },
    get camera() { return cameraEssai; }, set camera(f) { cameraEssai = typeof f === 'function' ? f : null; } };
  setTimeout(demarrer, 20);
})(globalThis.BITUME = globalThis.BITUME || {});
