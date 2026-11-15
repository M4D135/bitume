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
  const DEFAUT = { vue: 'cockpit', boite: 'auto', aide: 0.35, qualite: 'auto', general: 0.8, moteur: 0.9, effets: 0.9, tours: 3, difficulte: 1, circuit: 0, champ: 60, tableau: 'reduit', carte: 'oui', cartePosition: 'droite', carteTaille: 'normale', demo: 'oui', vibrations: 'oui', vibrationForce: 0.5,
    secousses: (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1; } catch (e) { return 1; } })() };
  const reglages = Object.assign({}, DEFAUT, lireStock('bitume.reglages', {}));
  reglages.secousses = Number.isFinite(+reglages.secousses) ? clamp(+reglages.secousses, 0, 1) : DEFAUT.secousses;
  // Les anciens placements auto/haut/bas reviennent en haut à droite ; taille et visibilité sont conservées.
  for (const [cle, valeurs] of Object.entries({ carte: ['oui', 'non'], cartePosition: ['gauche', 'droite'], carteTaille: ['petite', 'normale', 'grande'] }))
    if (!valeurs.includes(reglages[cle])) reglages[cle] = DEFAUT[cle];
  const sauverReglages = () => ecrireStock('bitume.reglages', reglages);
  // records et fantômes suivent la physique : ceux de l'essai 0.1 (avant le modèle à deux essieux) ne se comparent plus
  const PHYSIQUE = 'p6', CLE_RECORDS = 'bitume.records.' + PHYSIQUE, CLE_FANTOME = 'bitume.fantome.' + PHYSIQUE + '.';
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
  const nomCourt = v => v.joueur && !enDemo() ? 'Vous' : v.nom.replace(/^.\. /, '');

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
  function lancer(type, i) {
    const sc = installer(i), c = sc.c, demo = type === 'demo', auto = demo || type === 'vitrine';
    const course = B.course.creer(c, {
      mode: type === 'chrono' ? 'chrono' : 'course', tours: type === 'vitrine' ? 99 : demo ? TOURS_DEMO : reglages.tours,
      difficulte: auto ? 2 : reglages.difficulte, rivaux: 11, graine: ++graineCourse, placeJoueur: type === 'vitrine' ? 5 : demo ? 6 : 8
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
    const S = {
      type, i, course, c, modeles: course.voitures.map(v => B.voiture.modele(v.livree)),
      prec: [], cour: [], sortie: [], acc: 0, tele: { poste: null, alea: graine32(course.voitures.length * 7 + i) },
      camCap: null, profil: new Float32Array(Math.ceil(c.longueur / 10) + 2).fill(-1), profilMeilleur: null,
      distances: new Float64Array(course.voitures.length).fill(-1), vRel: new Float64Array(course.voitures.length),
      contresens: 0, bloque: 0, finA: null, resultats: false, derniereJauge: -9, positionPrec: 0, tempsAffiche: null,
      real: demo ? B.realisateur.creer(graineCourse) : null, planVu: null, suivie: 0, enchaine: false,
      fx: B.traces.creer(course.voitures.length, graineCourse)
    };
    remplirPoses(S.cour, course); remplirPoses(S.prec, course);
    session = S;
    tactile(!auto);
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
    if (course && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    touches.add(e.code);
    if (e.code === 'Escape' || lettre === 'p') {
      if (course || ecran === 'pause') { basculerPause(); e.preventDefault(); }
      else if (e.code === 'Escape') retour();
      return;
    }
    if (!course) return;
    analogique = false;
    if (e.code === 'KeyE') impulsions.haut = true;
    if (e.code === 'KeyQ') impulsions.bas = true;
    if (lettre === 'c') changerVue();
    if (lettre === 'm') couperSon();
  });
  addEventListener('keyup', e => touches.delete(e.code));
  let pauseAuto = true; // coupée par BITUME_JEU.pauseAuto = false, pour les captures et le banc
  let cameraEssai = null; // BITUME_JEU.camera = (pose, camera) => ({ pos, yaw, pitch, fov }) : vue libre pour les captures
  addEventListener('blur', () => { touches.clear(); relacherTactile(); if (pauseAuto && enCourse()) basculerPause(true); });
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
    let p = null;
    for (const candidate of liste) if (candidate && candidate.connected) { p = candidate; break; }
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
      // zone morte de 0,07 puis exposant 1,3 : vif au centre sans à-coup, plein volant au bout de la course
      const ax = p.axes[0] || 0, morte = .07, x = Math.abs(ax) < morte ? 0 : Math.sign(ax) * (Math.abs(ax) - morte) / (1 - morte);
      pad.volant = Math.sign(x) * Math.pow(Math.abs(x), 1.3);
      pad.gaz = b(7); pad.frein = b(6); pad.derive = appuye(0) || appuye(2);
      if (enCourse()) {
        if (nouveau(5)) impulsions.haut = true;
        if (nouveau(4)) impulsions.bas = true;
        if (nouveau(3)) changerVue();
      }
      if (nouveau(9) && (enCourse() || ecran === 'pause')) basculerPause();
      else if (!enCourse()) naviguerManette(nouveau);
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
  function secouerManette(faible, fort) {
    const p = pad.manette;
    faible = clamp(faible || 0, 0, 1); fort = clamp(fort || 0, 0, 1);
    if (!p || !p.vibrationActuator || !p.vibrationActuator.playEffect) return;
    const maintenant = performance.now();
    // le moteur à effet « dual-rumble » s'éteint seul au bout de sa durée : on le reprogramme au moins toutes
    // les 40 ms pour tenir un grondement continu, et plus vite encore dès que l'intensité bouge (choc, vibreur)
    if (Math.abs(faible - pad.rumbleF) < .05 && Math.abs(fort - pad.rumbleS) < .05 && maintenant - pad.rumbleT < 40) return;
    pad.rumbleF = faible; pad.rumbleS = fort; pad.rumbleT = maintenant;
    try {
      const effet = p.vibrationActuator.playEffect('dual-rumble', { startDelay: 0, duration: 90, weakMagnitude: faible, strongMagnitude: fort });
      if (effet && typeof effet.catch === 'function') effet.catch(() => {});
    } catch (e) { /* manette sans vibration */ }
  }

  // construit l'intensité continue (faible = aigu, fort = grave) à partir de l'état de la voiture et des
  // événements du pas ; les chocs alimentent un pic qui décroît image après image
  function vibrationManette(et, ev, horloge) {
    const PR = B.conduite.PARAMS;
    // pics transitoires des chocs et contacts, plafonnés et qui retombent ; le passage de rapport donne un coup sec
    pad.choc = Math.max(0, (pad.choc || 0) - DT * 2.4);
    pad.passe = Math.max(0, (pad.passe || 0) - DT * 3.4);
    for (const e of ev) {
      if (e.type === 'choc' && e.id === 0) pad.choc = Math.max(pad.choc, clamp(.35 + (e.force || 0) / 14, 0, .9));
      else if (e.type === 'contact' && (e.a === 0 || e.b === 0)) pad.choc = Math.max(pad.choc, clamp(.3 + (e.force || 0) / 14, 0, .7));
      else if (e.type === 'roue' || e.type === 'casse') pad.choc = Math.max(pad.choc, .85);
    }
    // grondement du moteur : doux au ralenti, il monte progressivement vers la zone rouge sans jamais saturer
    const r = clamp((et.regime - PR.ralenti) / (PR.maxUtile - PR.ralenti), 0, 1);
    const charge = .25 + .75 * (et.gaz || 0);
    const moteur = .05 + .5 * r * r * charge;
    const zoneRouge = r > .97 ? (Math.sin(horloge * 50) > 0 ? .2 : 0) : 0;   // le rupteur crépite à peine en haut
    // route, vibreurs, herbe, patinage, glisse — tous en dessous de leur maximum pour rester fins
    const route = clamp(et.v / 90, 0, 1);
    const martellement = et.vibreur ? .5 + .5 * Math.sin(horloge * 40) : 0;
    const herbe = et.surface === 'herbe' ? clamp(et.v / 26, 0, 1) : 0;
    const patinage = clamp(et.patinage / .35, 0, 1);
    const blocage = clamp(et.blocage / .35, 0, 1);
    const glisse = clamp(Math.abs(et.glisseAr) / .5, 0, 1);
    let faible = route * .16 + patinage * .5 + blocage * .38 + glisse * .3 + herbe * .3 + martellement * .42 + zoneRouge;
    let fort = moteur * .5 + route * .16 + herbe * .42 + martellement * .5 + (pad.choc || 0) * .85 + (pad.passe || 0) * .5;
    // mise en forme : une courbe en puissance garde le bas de l'échelle subtil, puis la puissance maître du réglage
    const f = clamp(reglages.vibrationForce != null ? +reglages.vibrationForce : .5, 0, 1);
    faible = Math.pow(clamp(faible, 0, 1), 1.25) * f;
    fort = Math.pow(clamp(fort, 0, 1), 1.25) * f;
    if (faible < .04) faible = 0;   // sous ce seuil, la manette reste parfaitement silencieuse
    if (fort < .04) fort = 0;
    return [faible, fort];
  }


  // Météo cyclique et déterministe : clair → se couvre → pluie → orage → clair. Ne pilote que des valeurs
  // d'uniformes (ciel/soleil/brouillard/ambiance) + un éclair ; aucune passe GPU ajoutée (fluidité préservée).
  function majMeteo(S, dt) {
    const m = S.meteo || (S.meteo = { t: 0, phase: 'clair', tp: 0, pluie: 0, nuage: 0.12, eclair: 0, prochainEclair: 0 });
    dt = Math.min(0.05, Math.max(0, dt || 0)); m.t += dt; m.tp += dt;
    const DUREE = { clair: 26, couvre: 12, pluie: 22, orage: 16 }, SUIV = { clair: 'couvre', couvre: 'pluie', pluie: 'orage', orage: 'clair' };
    if (m.tp >= DUREE[m.phase]) { m.phase = SUIV[m.phase]; m.tp = 0; if (m.phase === 'orage') m.prochainEclair = m.t + 1.2; }
    const CIBLE = { clair: [0, 0.12], couvre: [0, 0.6], pluie: [0.75, 0.85], orage: [1, 1] }[m.phase];
    const k = 1 - Math.exp(-dt / 2.5);
    m.pluie += (CIBLE[0] - m.pluie) * k; m.nuage += (CIBLE[1] - m.nuage) * k;
    m.eclair = Math.max(0, m.eclair - dt * 6);
    if (m.phase === 'orage' && m.t >= m.prochainEclair) {
      m.eclair = 1;
      const r = Math.abs(Math.sin(m.t * 12.9898) * 43758.5453) % 1;   // pseudo-aléatoire déterministe
      m.prochainEclair = m.t + 1.2 + r * 3.6;
    }
    return m;
  }

  // Pluie et éclairs dessinés sur un canvas 2D en overlay (zéro GLSL, testable) : gouttes inclinées par le vent,
  // densité ∝ pluie ; un éclair blanchit brièvement l'écran. Ne s'affiche que pendant la pluie/l'éclair.
  let meteoCtx = null, meteoGouttes = [], meteoDpr = 0;
  function dessinerMeteo(S, dt) {
    const cv = document.getElementById('meteo'); if (!cv) return;
    const m = S.meteo || { pluie: 0, eclair: 0, nuage: 0 };
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr) || dpr !== meteoDpr) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); meteoCtx = null; meteoDpr = dpr;
    }
    if (!meteoCtx) meteoCtx = cv.getContext('2d'); const ctx = meteoCtx; if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const pluie = m.pluie || 0, eclair = m.eclair || 0;
    if (pluie > 0.02) {
      const cible = Math.round(pluie * 360);
      while (meteoGouttes.length < cible) meteoGouttes.push({ x: Math.random() * w, y: Math.random() * h, l: 8 + Math.random() * 16, v: 620 + Math.random() * 520 });
      if (meteoGouttes.length > cible) meteoGouttes.length = cible;
      const vent = (m.nuage || 0) * 0.28 + 0.06;
      ctx.strokeStyle = 'rgba(198,214,232,' + (0.16 + pluie * 0.34).toFixed(3) + ')';
      ctx.lineWidth = 1.1; ctx.beginPath();
      for (const g of meteoGouttes) {
        g.y += g.v * dt; g.x += g.v * vent * dt;
        if (g.y > h) { g.y = -g.l; g.x = Math.random() * w; }
        if (g.x > w) g.x -= w; else if (g.x < 0) g.x += w;
        ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - g.l * vent, g.y - g.l);
      }
      ctx.stroke();
    } else if (meteoGouttes.length) meteoGouttes.length = 0;
    if (eclair > 0.01) { ctx.fillStyle = 'rgba(226,236,255,' + (eclair * 0.5).toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
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

  function commandesJoueur() {
    let gaz = 0, frein = 0, volant = 0, derive = false;
    if (touches.has('KeyW') || touches.has('ArrowUp')) gaz = 1;
    if (touches.has('KeyS') || touches.has('ArrowDown')) frein = 1;
    if (touches.has('KeyA') || touches.has('ArrowLeft')) volant -= 1;
    if (touches.has('KeyD') || touches.has('ArrowRight')) volant += 1;
    if (touches.has('Space') || touches.has('ShiftLeft') || touches.has('ShiftRight')) derive = true;
    gaz = Math.max(gaz, pad.gaz, doigt.gaz ? 1 : 0);
    frein = Math.max(frein, pad.frein, doigt.frein ? 1 : 0);
    if (Math.abs(pad.volant) > Math.abs(volant)) volant = pad.volant;
    if (Math.abs(doigt.volant) > Math.abs(volant)) volant = doigt.volant;
    derive = derive || pad.derive || doigt.derive;
    pad.deriveEtat = pad.derive && session ? session.course.joueur.etat : null;
    // aide au volant (rattrape les glisses) au niveau choisi ; guidage le long du virage au clavier et au doigt seulement
    const cmd = { gaz, frein, volant, derive, haut: impulsions.haut, bas: impulsions.bas, boite: reglages.boite, aide: reglages.aide, guidage: analogique ? 0 : .15 };
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
  function pasSimulation(S, pilote) {
    const co = S.course;
    const cmd = S.type === 'vitrine' || S.type === 'demo' || pilote ? B.course.commandesIA(co, co.joueur) : commandesJoueur();
    const ev = B.course.pas(co, cmd, DT);
    // vibration manette : le pilote la sent passer dans ses mains — le moteur selon les tours, la route, les
    // vibreurs, l'herbe, le patinage, la glisse et les chocs ; la main reste calme si le réglage est à « non »
    if (!pilote && reglages.vibrations === 'oui') {
      const [faible, fort] = vibrationManette(co.joueur.etat, ev, co.horloge);
      secouerManette(faible, fort);
    } else secouerManette(0, 0);
    for (const v of co.voitures) {
      v.roule = (v.roule || 0) + v.etat.v * DT; // distance roulée : fait tourner les roues
      // changement de rapport : la main droite du pilote va au levier (vue cockpit). cockpit-6 : au premier pas,
      // on initialise seule la référence, sans trajet ; cockpit-2 : un rapport qui arrive pendant l'animation
      // précédente (0,36 s) est consommé sans reprise — le trajet en cours vise déjà le rapport courant, et
      // tPassage ne repart pas à zéro (sinon la main se téléporte du pommeau à la jante)
      if (v.etat.rapport !== v.rapportVu) {
        if (v.rapportVu !== undefined && (v.tPassage === undefined || co.horloge - v.tPassage >= .36)) { v.rapportAvant = v.rapportVu; v.tPassage = co.horloge; if (v === co.joueur) pad.passe = .5; }
        v.rapportVu = v.etat.rapport;
      }
    }
    const t = S.prec; S.prec = S.cour; S.cour = t; remplirPoses(S.cour, co);
    const tFx = S.banc ? performance.now() : 0;
    B.traces.pas(S.fx, co, S.cour, S.suivie || 0, DT, ev);
    if (S.banc) S.banc.effets += performance.now() - tFx;
    if (S.type === 'demo') traiterDemo(S, ev);
    else if (S.type !== 'vitrine') { traiter(S, ev); suivreJoueur(S); }
  }

  // Démo : les sons et les annonces suivent la course et la voiture filmée, pas un joueur.
  function traiterDemo(S, ev) {
    const co = S.course, pl = S.planVu, sujet = pl ? pl.sujet : -1, dePres = !!pl && (pl.vue === 'cockpit' || pl.vue === 'poursuite');
    for (const e of ev) {
      switch (e.type) {
        case 'feu': son && son.evenement('feu'); break;
        case 'vert': son && son.evenement('vert'); message('Départ', 'vert', true); break;
        case 'contact':
          if (dePres && (e.a === sujet || e.b === sujet)) { son && son.evenement('contact', { force: e.force }); S.secousse = Math.min(1, (S.secousse || 0) + .25 + e.force * .05); }
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
          if (e.type === 'choc') S.secousse = Math.min(1, (S.secousse || 0) + .3 + e.force * .04);
      }
    }
  }

  function traiter(S, ev) {
    const co = S.course, j = co.joueur;
    for (const e of ev) {
      switch (e.type) {
        case 'feu': son && son.evenement('feu'); break;
        case 'vert': son && son.evenement('vert'); message('Départ', 'vert', true); break;
        case 'contact': if (e.a === 0 || e.b === 0) { son && son.evenement('contact', { force: e.force }); S.secousse = Math.min(1, (S.secousse || 0) + .25 + e.force * .05); } break;
        case 'tour':
          if (e.id !== 0) break;
          son && son.evenement('tour', { meilleur: e.meilleur });
          finTour(S, e);
          break;
        case 'arrivee':
          if (e.id !== 0) break;
          son && son.evenement('arrivee');
          S.finA = co.horloge;
          message(e.position === 1 ? 'Victoire' : e.position + (e.position === 1 ? 're' : 'e') + ' place', e.position <= 3 ? 'ambre' : '');
          sousMessage('Drapeau à damier · ' + chrono(j.tempsFinal));
          break;
        default:
          if (e.id !== 0) break;
          if (son) son.evenement(e.type, e);
          if (e.type === 'choc') { S.secousse = Math.min(1, (S.secousse || 0) + .3 + e.force * .04); if (e.force > 6) S.eclair = Math.min(1, .4 + e.force * .05); }
          else if (e.type === 'reception') S.secousse = Math.min(1, (S.secousse || 0) + .25 + (e.force || 0) * .1);
          else if (e.type === 'tonneau' || e.type === 'casse') { S.secousse = 1; S.eclair = 1; if (e.type === 'casse') message('Voiture détruite', 'rouge'); }
          else if (e.type === 'roue') { message('Roue perdue', 'rouge', true); S.eclair = .8; }
          else if (e.type === 'reparation') message('Réparation…', 'ambre', true);
          else if (e.type === 'repare') message('Repositionné', 'vert', true);
          else if (e.type === 'turbo') message(e.parfait ? 'Turbo parfait' : 'Turbo', e.parfait ? 'ambre' : '', true);
          else if (e.type === 'deriveAnnulee') S.derniereJauge = co.horloge;
      }
    }
  }

  function finTour(S, e) {
    const co = S.course, j = co.joueur, id = CATALOGUE[S.i].id;
    const ancien = records[id] && records[id].tour;
    // profil du tour (temps tous les 10 m) pour l'écart en direct
    if (e.meilleur) S.profilMeilleur = S.profil.slice();
    S.profil.fill(-1);
    let texte = 'Tour ' + e.tour + ' · ' + chrono(e.temps);
    if (!S.essai && (!ancien || e.temps < ancien)) {
      records[id] = { tour: e.temps, date: new Date().toISOString().slice(0, 10), mode: co.mode };
      ecrireStock(CLE_RECORDS, records);
      if (ancien) texte += ' · record du circuit';
    }
    sousMessage(texte);
    if (co.mode === 'chrono') {
      // le fantôme gardé est celui du meilleur tour jamais fait ici
      const f = co.fantome;
      const garde = lireStock(CLE_FANTOME + id, null);
      if (!S.essai && f.meilleur && f.temps === e.temps && (!garde || garde.longueur !== co.c.longueur || e.temps < garde.temps))
        ecrireStock(CLE_FANTOME + id, { temps: f.temps, n: f.meilleur.n, longueur: co.c.longueur, b64: enBase64(f.meilleur.donnees) });
      message(e.meilleur ? 'Meilleur tour' : chrono(e.temps), e.meilleur ? 'vert' : '', true);
    } else if (co.toursTotal - j.tours === 1) message('Dernier tour', 'ambre');
    else if (e.meilleur && j.tours > 1) message('Meilleur tour', 'vert', true);
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
      const coince = (et.v < 1.5 && et.gaz > .5) || (Math.cos(et.psi) < -.5 && et.v < 3);
      S.bloque = coince ? S.bloque + DT : 0;
      if (S.bloque > 3) { replacer(); S.bloque = 0; }
    }
  }

  function replacer() {
    const S = session; if (!S) return;
    const co = S.course, et = co.joueur.etat;
    if (et.degats && et.degats.casse) return;
    // Chantier 3 : le remplacement passe par le retour progressif en piste (cap et vitesse continus, immunité)
    if (B.conduite.declencherAccident) B.conduite.declencherAccident(et, { duree: 3.0 });
    else { et.d = B.circuit.echantillon(co.c, et.s).ligne; et.psi = 0; et.beta = 0; et.omega = 0; et.v = Math.min(et.v, 4); }
    B.conduite.annulerDerive(et);
    message('Replacé', '', true);
  }

  // ---------------------------------------------------------------- caméras
  // Champ du cockpit : réglage en degrés horizontaux mesurés en 16:9 (60° par défaut, 41,6° verticaux, comme
  // vroom-unreal). Plus large que 16:9, le champ vertical est gardé ; plus étroit, c'est le champ horizontal.
  // Le portrait conserve la diagonale du cadre de référence 16:9. Sur téléphone, David demande un champ
  // plus serré (16/11) : tangente réduite de 18 %, ouverture de vitesse limitée à 4 %. Le curseur reste mémorisé.
  function champCockpit(aspect, v) {
    const t = Math.tan(clamp(+reglages.champ || 60, 60, 105) * Math.PI / 360);
    const tv = aspect < 1 ? Math.hypot(t, t / (16 / 9)) / Math.hypot(1, aspect) : Math.max(t / (16 / 9), t / Math.max(.3, aspect));
    const portraitTelephone = estTactile && canvas.clientWidth <= 600 && aspect < 1;
    const vertical = 2 * Math.atan(tv * (portraitTelephone ? .82 : 1)) * 180 / Math.PI;
    return clamp(vertical * (1 + (portraitTelephone ? .04 : .13) * clamp(v / 85, 0, 1)), 10, 110);
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
  function cameraPoursuite(S, p, et, dt) {
    if (S.camCap === null) S.camCap = p.cap;
    S.camCap += angle(p.cap - S.camCap) * (1 - Math.exp(-dt * 5.5));
    const dist = 7.4, cx = p.x - Math.cos(S.camCap) * dist, cz = p.z - Math.sin(S.camCap) * dist;
    const sol = scene.decor.sol ? scene.decor.sol(cx, cz) : p.y;
    const y = Math.max(p.y + 2.45, (isFinite(sol) ? sol : p.y) + 1.4);
    return { pos: [cx, y, cz], yaw: S.camCap + Math.PI / 2, pitch: -.12 - (y - p.y - 2.45) * .06, roll: 0, fov: 64 + 8 * clamp(et.v / 85, 0, 1), near: .1, far: PORTEE_VUE };
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
      const sp = ramener(s + 60 + T.alea() * 60, c.longueur), e = B.circuit.echantillon(c, sp);
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
    const co = S.course, c = co.c, sortie = S.sortie, j = co.joueur;
    sortie.length = 0;
    const poses = tampons.poses;
    for (let k = 0; k < co.voitures.length; k++) poses[k] = melange(S.prec[k], S.cour[k], alpha, poses[k] || {});
    const pj = poses[0];

    // caméra : celle du joueur, ou celle que choisit le réalisateur de la démo
    let cam, vue = reglages.vue, suivie = j;
    if (S.type === 'vitrine') { suivie = co.voitures[co.classement[S.suiviRang || 0]] || j; vue = 'tele'; }
    else if (S.type === 'demo') {
      const pl = B.realisateur.tenir(S.real, co);
      // coupe : les caméras lissées repartent de la nouvelle voiture, les écarts du son aussi
      if (S.planVu !== pl) { S.planVu = pl; S.camCap = null; S.tete = null; S.tele.poste = null; S.distances.fill(-1); S.vRel.fill(0); S.secousse = 0; }
      vue = pl.vue; suivie = co.voitures[pl.sujet];
    } else if (j.fini && S.finA !== null && co.horloge - S.finA > 2.5) vue = 'tele';
    const ps = poses[suivie.id], exterieur = vue === 'tele' || vue === 'helico';
    if (vue === 'tele') cam = cameraTele(S, suivie, ps);
    else if (vue === 'helico') cam = cameraHelico(S, ps, dtImage);
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
      const ev = { p: [p.x, p.y, p.z], cap: p.cap, tangage: p.tangage, roulis: p.roulis, braquage: p.braquage, roule: p.roule, v: co.voitures[k].etat.v };
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
          passage: suivie.tPassage === undefined ? 1 : (co.horloge - suivie.tPassage) / .36, rapportAvant: suivie.rapportAvant, derriere, ciel: atm.skyBottom, brume: atm.fog });
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
    const meteo = majMeteo(S, dtImage);
    rendu.draw(cam, sortie, { time: horlogeReelle, shadows: q !== 'low', bloom: q !== 'low', torch: false, sunOnly: true, adaptive: q === 'auto', frameMs: dureeImage, damage: eclair, flash: eclair, photo: q !== 'low' ? 1 : 0, weather: meteo });
    dessinerMeteo(S, dtImage);
    if (S.eclair > 0) S.eclair = Math.max(0, S.eclair - dtImage * 3.2);
    S.camera = cam; S.vue = vue; S.suivie = suivie.id;
    // En cockpit, la planche donne vitesse, rapport et régime : le tableau réduit retire plan et compteurs, qui
    // couvriraient les pneus avant.
    const reduit = vue === 'cockpit' && reglages.tableau === 'reduit' ? 'oui' : 'non';
    if (jeu.dataset.reduit !== reduit) jeu.dataset.reduit = reduit;
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
    const exterieur = S.vue === 'tele' || S.vue === 'helico', micro = exterieur && S.type === 'demo';
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
      joueur: { regime: et.regime, gaz: et.gaz, rapport: et.rapport, v: et.v, glisse: et.glisse, surface: et.surface, turbo: et.turbo.reste > 0, vue: S.vue === 'cockpit' ? 'cockpit' : 'poursuite', muet: exterieur },
      rivaux: sonRivaux
    }, dtImage);
  }

  // ---------------------------------------------------------------- affichage de course
  const H = {};
  for (const id of ['h-pos', 'h-sur', 'h-tour', 'h-tours', 'h-actuel', 'h-meilleur', 'h-delta', 'h-delta-ligne', 'h-vitesse', 'h-rapport', 'h-regime', 'h-fps', 'jauge-derive', 'classement', 'feux', 'carte', 'c-position', 'c-tour', 'message', 'sous-message']) H[id] = $(id);
  const segments = Array.from(H['jauge-derive'].querySelectorAll('i')), lampes = Array.from(H.feux.querySelectorAll('i'));
  const etiquetteDerive = H['jauge-derive'].querySelector('.etiquette');
  const barre = H['h-regime'].querySelector('.barre');
  function texte(el, t) { if (el._t !== t) { el._t = t; el.textContent = t; } }
  function attr(el, nom, v) { if (el['_' + nom] !== v) { el['_' + nom] = v; el.setAttribute(nom, v); } }
  function style(el, nom, v) { if (el['_s' + nom] !== v) { el['_s' + nom] = v; el.style.setProperty(nom, v); } }
  function classe(el, nom, oui) { if (el.classList.contains(nom) !== !!oui) el.classList.toggle(nom, !!oui); }

  function message(t, ton, court) {
    const el = H.message;
    el.textContent = t; el.className = 'message';
    void el.offsetWidth;
    el.className = 'message visible' + (ton ? ' ' + ton : '') + (court ? ' court' : '');
  }
  function sousMessage(t) {
    const el = H['sous-message'];
    el.textContent = t; el.className = 'sous-message'; void el.offsetWidth; el.className = 'sous-message visible';
  }

  const LIBELLES_PLAN = { tele: 'bord de piste', cockpit: 'caméra embarquée', poursuite: 'poursuite', helico: 'hélicoptère' };
  function majHud(S) {
    // en démo, l'affichage est celui de la voiture filmée
    const co = S.course, demo = S.type === 'demo', j = demo ? co.voitures[S.suivie || 0] : co.joueur, et = j.etat, chronoMode = co.mode === 'chrono';
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
    texte(H['h-rapport'], String(et.rapport));
    style(barre, '--r', clamp((et.regime - 4000) / 9000, 0, 1).toFixed(3));
    classe(H['h-regime'], 'passer', et.regime > (reglages.boite === 'manuelle' ? 12100 : 12600) && et.rapport < 6);

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
    texte(H['h-fps'], fps + ' i/s'); classe(H['h-fps'], 'bas', fps < 50);
  }

  // ---------------------------------------------------------------- écrans
  let ecran = 'chargement';
  const ECRANS = ['titre', 'preparation', 'reglages', 'pause', 'resultats'];
  let modePrepa = 'course', retourReglages = 'titre';
  const enCourse = () => ecran === 'course';

  function aller(nom) {
    if (son && nom !== 'demo') son.evenement('clic');
    for (const e of ECRANS) $(e).hidden = e !== nom;
    $('hud').hidden = !(nom === 'course' || nom === 'pause' || nom === 'demo');
    $('demo').hidden = nom !== 'demo';
    $('jeu').dataset.ecran = nom;
    ecran = nom;
    if (nom === 'titre') dernierGeste = performance.now();
    if (nom === 'titre' || nom === 'preparation') {
      if (!session || session.type !== 'vitrine' || (nom === 'preparation' && session.i !== reglages.circuit)) lancer('vitrine', nom === 'preparation' ? reglages.circuit : (session ? session.i : reglages.circuit));
    }
    tactile(nom === 'course');
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
    if (cible === 'course' || cible === 'chrono') { modePrepa = cible; aller('preparation'); }
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
    $('p-titre').textContent = modePrepa === 'chrono' ? 'Chrono' : 'Course';
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
        b.addEventListener('click', () => { reglages.circuit = i; sauverReglages(); majPreparation(); if (son) son.evenement('clic'); lancer('vitrine', i); });
        zone.appendChild(b);
      });
    }
    for (const nom of ['tours', 'difficulte']) for (const r of document.querySelectorAll('input[name="' + nom + '"]')) r.checked = String(reglages[nom]) === r.value;
    majPreparation();
  }
  function majPreparation() {
    for (const b of $('circuits').children) b.setAttribute('aria-checked', String(+b.dataset.index === reglages.circuit));
    const r = records[CATALOGUE[reglages.circuit].id];
    $('p-record').innerHTML = r ? 'Votre record sur ' + CATALOGUE[reglages.circuit].nom + ' : <b>' + chrono(r.tour) + '</b>' : 'Pas encore de temps sur ' + CATALOGUE[reglages.circuit].nom + '.';
  }
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'tours' || t.name === 'difficulte') { reglages[t.name] = +t.value; sauverReglages(); }
    if (['vue', 'boite', 'qualite', 'tableau', 'demo', 'cartePosition', 'carteTaille'].includes(t.name)) { reglages[t.name] = t.value; sauverReglages(); appliquerCarte(); if (t.name === 'qualite' && rendu) rendu.resize(t.value); }
    if (t.name === 'aide') { reglages.aide = +t.value; sauverReglages(); }
  });
  for (const nom of ['general', 'moteur', 'effets']) $('v-' + nom).addEventListener('input', e => { reglages[nom] = +e.target.value; sauverReglages(); appliquerVolumes(); });
  $('v-champ').addEventListener('input', e => { reglages.champ = clamp(+e.target.value, 60, 105); $('v-champ-valeur').textContent = reglages.champ + '°'; sauverReglages(); });
  $('v-secousses').addEventListener('input', e => { reglages.secousses = clamp(+e.target.value, 0, 1); $('v-secousses-valeur').textContent = Math.round(reglages.secousses * 100) + ' %'; sauverReglages(); });
  $('v-vibrations').addEventListener('change', e => { reglages.vibrations = e.target.checked ? 'oui' : 'non'; if (!e.target.checked) secouerManette(0, 0); sauverReglages(); });
  $('v-carte').addEventListener('change', e => { reglages.carte = e.target.checked ? 'oui' : 'non'; sauverReglages(); appliquerCarte(); });
  $('v-vibration-force').addEventListener('input', e => { reglages.vibrationForce = clamp(+e.target.value, 0, 1); $('v-vibration-force-valeur').textContent = Math.round(reglages.vibrationForce * 100) + ' %'; sauverReglages(); });
  function remplirReglages() {
    for (const nom of ['vue', 'boite', 'qualite', 'aide', 'tableau', 'demo', 'cartePosition', 'carteTaille']) for (const r of document.querySelectorAll('input[name="' + nom + '"]')) r.checked = String(reglages[nom]) === r.value;
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
    else if (ecran === 'preparation' || ecran === 'resultats') aller('titre');
  }
  $('r-retour').addEventListener('click', retour);

  $('b-depart').addEventListener('click', () => demarrerSeance(modePrepa));
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
  $('b-abandon').addEventListener('click', () => { if (session && session.type === 'chrono' && session.course.joueur.tempsTours.length) montrerResultats(session); else aller('titre'); });
  $('b-menu').addEventListener('click', () => aller('titre'));
  $('b-rejouer').addEventListener('click', () => demarrerSeance(session ? session.type : 'course'));

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
      $('res-titre').textContent = j.abandon ? 'Abandon · voiture détruite' : j.position === 1 ? 'Victoire' : 'Arrivée · ' + j.position + 'e';
      $('res-sous').textContent = nomCircuit + ' · ' + co.toursTotal + ' tours · rivaux ' + ['faciles', 'normaux', 'coriaces'][co.difficulte];
      entete.innerHTML = '<th>Pos.</th><th>N°</th><th class="nom">Pilote</th><th>Tours</th><th>Temps</th><th>Meilleur tour</th>';
      corps.innerHTML = ordre.map((v, r) => {
        const col = 'rgb(' + v.couleur.map(x => Math.round(x * 255)).join(',') + ')';
        let tps;
        if (v.abandon) tps = 'Abandon';
        else if (r === 0 && v.fini) tps = chrono(v.tempsFinal);
        else if (v.fini && tete.fini && v.tours === tete.tours) tps = ecartTexte(v.tempsFinal - tete.tempsFinal, 3);
        else if (tete.tours - v.tours >= 1 && v.fini) tps = '+' + (tete.tours - v.tours) + ' tour' + (tete.tours - v.tours > 1 ? 's' : '');
        else tps = v.fini ? chrono(v.tempsFinal) : 'en piste';
        return '<tr' + (v.joueur ? ' class="joueur"' : '') + '><td>' + (r + 1) + '</td><td>' + v.numero + '</td><td class="nom"><span class="pastille" style="background:' + col + '"></span>' + (v.joueur ? 'Vous' : v.nom) + '</td><td>' + v.tours + '</td><td>' + tps + '</td><td' + (v.meilleur === meilleurAbsolu ? ' class="record-tour"' : '') + '>' + chrono(v.meilleur) + '</td></tr>';
      }).join('');
    }
    if (!classementFinal) {
      aller('resultats');
      if (co.mode === 'course' && co.drapeau !== null && !j.abandon) finirClassement(S);
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
    const S = session;
    if (!S || !rendu) return;
    // la vitrine tourne derrière les menus ; une course ne tourne qu'à l'écran de course, la démo qu'à l'écran de démo
    const tourne = S.type === 'vitrine' ? ecran !== 'chargement' : ecran === (S.type === 'demo' ? 'demo' : 'course');
    if (tourne) {
      S.acc += dtReel;
      let n = 0;
      while (S.acc >= DT && n < 14) { pasSimulation(S, !!S.banc); S.acc -= DT; n++; }
      if (n === 14) S.acc = 0;
    } else if (horlogeReelle - (S.imageFigee || 0) < .25) return; // image arrêtée : quatre images par seconde suffisent
    S.imageFigee = horlogeReelle;
    if (S.type === 'vitrine') S.suiviRang = Math.floor(horlogeReelle / 18) % 4;
    const dtVu = tourne ? dtReel : 0, cam = rendreImage(S, clamp(S.acc / DT, 0, 1), dtVu);
    if (S.type !== 'vitrine') {
      majHud(S);
      const j = S.course.joueur;
      if ((S.type === 'course' || S.type === 'chrono') && !S.resultats &&
          (S.course.termine || (j.abandon && S.course.horloge - j.tAbandon >= 3))) {
        S.course.termine = true; montrerResultats(S);
      }
      if (S.type === 'demo' && !S.enchaine && ecran === 'demo' && (S.course.termine || (S.finA !== null && S.course.horloge - S.finA > APRES_DRAPEAU))) demoSuivante(S);
    }
    majSon(S, cam, dtVu);
  }

  // ---------------------------------------------------------------- démarrage
  function webgl2() {
    try {
      const t = document.createElement('canvas'), gl = t.getContext('webgl2');
      if (!gl) return false;
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
      rendu = window.FRender.create(canvas);
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
    get son() { return son ? son.stats() : null; },
    demo: i => lancerDemo(i === undefined ? reglages.circuit : i), // lance la démo sans attendre les cinq secondes
    get pauseAuto() { return pauseAuto; }, set pauseAuto(v) { pauseAuto = !!v; },
    get camera() { return cameraEssai; }, set camera(f) { cameraEssai = typeof f === 'function' ? f : null; } };
  setTimeout(demarrer, 20);
})(globalThis.BITUME = globalThis.BITUME || {});
