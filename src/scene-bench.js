/* BITUME — parcours de calibration isolé : même terrain, végétation, voitures et renderer que le jeu.
   Ne touche ni aux circuits installés, ni à la séance, ni aux records, ni aux commandes : sa seule course est une
   course de chauffe jetable (src/course.js), sur son propre tracé. */
(function (B) {
  'use strict';
  // Distance au-delà de laquelle la course dessine une voiture allégée (rendu d'une image, src/jeu.js) : le modèle
  // complet tant qu'il tient une trentaine de pixels de haut au champ donné. Le parcours suit la même règle pour
  // coûter ce que coûte un peloton en course.
  const distanceComplete = fov => 170 * Math.tan(20.8 * Math.PI / 180) / Math.tan(Math.max(10, Math.min(110, fov)) * Math.PI / 360);
  // Le premier point de vue est l'endroit le plus chargé compté en course le 18/11, le départ de la séance de
  // référence de Val-Brûlé (s = 800 ; 4,3 M de triangles en Fine, 1,6 fois les points d'herbe), vu du cockpit avec
  // l'habitacle. Le parcours a la graine, le thème et la longueur de Val-Brûlé : c'est le même tracé. Les deux autres
  // points de vue, en poursuite, sont les endroits les plus herbeux du tracé, loin du premier.
  const DEPART = 800;
  // Moteur des rétroviseurs, mêmes options que celui de la course (src/jeu.js, majGlaces) : sans moteur prêté par le
  // jeu (premier lancement, avant toute course), le parcours en crée un, le temps de la mesure.
  const OPTIONS_GLACES = Object.freeze({ msaa: 0, shadowMapScale: 1, reflections: false, sea: false, overlayLighting: 'world' });
  function moteurGlacesTemporaire() {
    const doc = globalThis.document, F = globalThis.FRender;
    if (!doc || !doc.createElement || !F || typeof F.create !== 'function') return null;
    const toile = doc.createElement('canvas');
    toile.className = 'retro-rendu'; toile.setAttribute('aria-hidden', 'true');
    (doc.getElementById('jeu') || doc.body).appendChild(toile);
    try {
      const rendu = F.create(toile, OPTIONS_GLACES);
      rendu.resize(Math.min(globalThis.devicePixelRatio || 1, 1.5));
      return { rendu, liberer() {
        try { rendu.dispose(); } catch (e) { /* déjà libéré */ }
        try { const x = rendu.gl && rendu.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* contexte déjà perdu */ }
        toile.remove();
      } };
    } catch (e) { toile.remove(); return null; }
  }
  // Sonde, avant tout décor : un contexte WebGL à part (toile jamais affichée, mêmes préférences que le moteur). Un
  // rendu logiciel (aucune carte graphique) se reconnaît à son nom et la sonde s'arrête là : rien n'est compilé. Sinon
  // elle remplit SONDE × SONDE pixels avec un programme minuscule, lecture d'un pixel comprise : moins d'une
  // milliseconde sur une carte graphique (0,3 à 0,7 ms sur le M5, machine très chargée, le 18/11). La détection en
  // juge (src/autoconfig.js, SONDE_MS) : un rendu bien trop lent conclut sans bâtir le décor de Moyenne ni compiler ses
  // programmes, qui figeraient la page plusieurs secondes. Le temps seul ne suffit pas à reconnaître SwiftShader : de
  // 1 à 14 ms par passe d'un essai à l'autre.
  const SONDE = 512, SONDE_PASSES = 3, SONDE_ARRET = 100;
  const LOGICIEL = /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render/i;
  const SONDE_VS = '#version 300 es\nvoid main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0.,1.);}';
  const SONDE_FS = '#version 300 es\nprecision highp float;uniform float u;out vec4 o;\n'
    + 'void main(){vec2 q=gl_FragCoord.xy*.001+u;float a=0.;for(int i=0;i<4;i++){a+=sin(q.x*float(i+1)+a)*cos(q.y-a);}o=vec4(a,q,1.);}';
  const ATTRIBUTS_SONDE = Object.freeze({ alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  function sonder(maintenant) {
    const doc = globalThis.document;
    if (!doc || typeof doc.createElement !== 'function') return null;
    let g = null;
    try {
      const toile = doc.createElement('canvas'); toile.width = SONDE; toile.height = SONDE;
      g = typeof toile.getContext === 'function' ? toile.getContext('webgl2', ATTRIBUTS_SONDE) : null;
      if (!g) return null;
      const info = g.getExtension('WEBGL_debug_renderer_info');
      if (LOGICIEL.test(String(g.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : g.RENDERER) || ''))) return { logiciel: true, passes: [], premiere: null, taille: [SONDE, SONDE] };
      const programme = g.createProgram();
      for (const [type, source] of [[g.VERTEX_SHADER, SONDE_VS], [g.FRAGMENT_SHADER, SONDE_FS]]) {
        const s = g.createShader(type); g.shaderSource(s, source); g.compileShader(s); g.attachShader(programme, s);
      }
      g.linkProgram(programme);
      if (!g.getProgramParameter(programme, g.LINK_STATUS)) return null;
      g.useProgram(programme); g.viewport(0, 0, SONDE, SONDE);
      const u = g.getUniformLocation(programme, 'u'), pixel = new Uint8Array(4);
      const passe = k => {
        const a = maintenant();
        g.uniform1f(u, k); g.drawArrays(g.TRIANGLES, 0, 3); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, pixel);
        return maintenant() - a;
      };
      // première passe, compilation comprise : hors jugement. Une passe très lente suffit à juger.
      const premiere = passe(0), passes = [];
      while (passes.length < SONDE_PASSES) { const ms = passe(passes.length + 1); passes.push(ms); if (ms > SONDE_ARRET) break; }
      return { logiciel: false, passes, premiere, taille: [SONDE, SONDE] };
    } catch (e) { return null; } finally {
      try { const x = g && g.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* contexte déjà perdu */ }
    }
  }
  // annexes.glaces : moteur des rétroviseurs prêté par le jeu (second contexte WebGL, toile hors écran).
  // annexes.creerGlaces : fabrique d'un moteur des glaces temporaire ({ rendu, liberer }) ; par défaut celle du
  // navigateur, aucune dans Node. Sans moteur du tout, le parcours dit les glaces absentes et la détection resserre sa
  // limite. annexes.maintenant : horloge de la sonde (performance.now par défaut).
  function creer(rendu, capacites, annexes) {
    const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200, nom: 'Détection' });
    const couleurs = [[.72,.08,.04],[.04,.22,.65],[.75,.58,.04],[.12,.38,.16]];
    const modeles = Array.from({ length: 12 }, (_, i) => B.voiture.modele({ couleur: couleurs[i % 4], seconde: [.8,.78,.7], pneus: 'slicks' }));
    const sortie = [], fauneVue = { qualite: 'off', nuit: 0, pluie: .18, pose: { x: 0, y: 0, z: 0 }, vue: 0 };
    // Trois points de mesure et deux miroirs : chacun conserve sa propre hystérésis. Les poses et les options
    // sont réemployées pour que le choix du détail n'ajoute pas d'allocations à la mesure.
    const detailsRoues = Array.from({ length: 3 }, () => new Int8Array(modeles.length + 1).fill(-1));
    const detailsGlaces = Array.from({ length: 2 }, () => new Int8Array(modeles.length + 1).fill(-1));
    // Mesurer aussi les surfaces d'usure actives, préparées une fois : une course ne reste pas sur des pneus neufs.
    const pneusMesure = Array.from({ length: modeles.length + 1 }, (_, voiture) => Array.from({ length: 4 }, (_, roue) =>
      ({ usure: .65, salete: .15, grainage: .25, graine: ((voiture + 1) * 37 + roue * 97) >>> 0 })));
    const posesVoitures = modeles.map((_, i) => ({ p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, roule: 0, v: 45, etatPneus: pneusMesure[i] }));
    const optionsVoitures = modeles.map(() => ({ simple: false, rouesDetail: 0 }));
    const optionsGlaces = modeles.map(() => ({ simple: false, rouesDetail: 0 })), optionsPiloteGlace = { rouesDetail: 0 };
    let finVoitures = 0;
    const meteo = B.meteo.pour('pluie'); meteo.pluie = .18; meteo.nuage = .4; meteo.mouille = .65;
    const weather = B.meteo.ambiance(meteo);
    // Sillage des douze voitures : en course, l'herbe et les feuillages proches plient au passage du peloton (sources
    // de vent du moteur, calculées pour chaque sommet de prairie). Sans elles, le parcours épargnerait ce travail.
    const sillage = B.sillage ? B.sillage.creer(modeles.length) : null;
    const voituresSillage = modeles.map((_, id) => ({ id, etat: { s: 0, v: 45, beta: 0 } }));
    const posesSillage = modeles.map(() => ({ x: 0, y: 0, z: 0, cap: 0 }));
    // Simulation : chaque image de course fait deux pas de 1/120 s pour douze voitures (conduite, IA, contacts). Le
    // parcours les fait sur une course de chauffe jetable (B.course.chauffe, ses propres états, ni son, ni records,
    // ni débris), sur son propre tracé : une machine au processeur lent paie ce travail comme en course.
    // simuler(n) seul, pendant les images à vide du début : le moteur JavaScript compile ces chemins avant la mesure.
    let sim = null, pas = 0;
    function simuler(n = 2) {
      if (!B.course || typeof B.course.chauffe !== 'function') return;
      if (!sim || sim.reste < n) sim = B.course.chauffe(c, { secondes: 60 });
      sim.avancer(n); pas += n;
    }
    // Fin forcée du travail graphique : lire un pixel oblige le pilote à exécuter tout ce qui attend. Les glaces se
    // terminent aussi : leur contexte a sa propre file de travail. Sans contexte lisible, pas de fin forcée : la
    // détection ne mesure pas.
    const lisible = g => !!g && typeof g.readPixels === 'function';
    const gl = rendu && rendu.gl, pixel = new Uint8Array(4);
    const pretees = annexes && annexes.glaces || null;
    const fabrique = annexes && typeof annexes.creerGlaces === 'function' ? annexes.creerGlaces : moteurGlacesTemporaire;
    let glacesRendu = pretees, temporaires = null, echecGlaces = false, glacesActives = false, copie = null;
    const terminer = lisible(gl) ? () => {
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      const glG = glacesRendu && glacesRendu.gl;
      if (glacesActives && lisible(glG)) glG.readPixels(0, 0, 1, 1, glG.RGBA, glG.UNSIGNED_BYTE, pixel);
    } : null;
    let decor = null, P = null, faune = null, positions = null, compte = 0;
    let sautGlaces = 0, pasGlaces = 0, imagesGlaces = 0;
    const pilote = B.voiture.modele({ couleur: [.9, .9, .88], seconde: [.1, .1, .1], pneus: 'slicks' }), objetsGlace = [];
    const habitacle = { regime: 9500, volant: 0, rapport: 5, kmh: 250, passage: 1, derriere: [], ciel: null, brume: null, glaceVive: false, rouesDetail: 0 };
    function endroitsCharges(d, premier) {
      if (!d.ecologie) return [premier, 1800, 3000];
      const candidats = [], a = {}, b = {}, sol = {};
      for (let s = 180; s < c.longueur - 120; s += 45) {
        const e = B.circuit.echantillon(c, s), dx = Math.sin(e.cap) * 17, dz = Math.cos(e.cap) * 17;
        d.ecologie.echantillonner(e.x + dx, e.z - dz, a); d.ecologie.echantillonner(e.x - dx, e.z + dz, b);
        const gauche = !d.surfaceHerbe || !!d.surfaceHerbe(e.x + dx, e.z - dz, sol);
        const droite = !d.surfaceHerbe || !!d.surfaceHerbe(e.x - dx, e.z + dz, sol);
        if (!gauche || !droite) continue;
        candidats.push({ s, score: (a.herbe + b.herbe) * .7 + (a.boisement + b.boisement) * .3 });
      }
      candidats.sort((a, b) => b.score - a.score);
      const choisis = [premier];
      for (const v of candidats) if (choisis.every(s => Math.abs(s - v.s) > 300)) { choisis.push(v.s); if (choisis.length === 3) break; }
      return choisis.length === 3 ? choisis : [premier, 1800, 3000];
    }
    // reglage.glaces === 'differees' : le moteur des glaces n'est préparé qu'à l'appel d'activerGlaces (la détection
    // le fait après la chauffe, quand le palier a un espoir). Le chronomètre GPU du moteur reste fermé : ses requêtes
    // couperaient les passes des processeurs graphiques à tuiles et fausseraient la mesure à l'horloge.
    function preparer(id, options, reglage) {
      P = B.graphismes.melange(options.qualite, 0, { capacites, decor: options.qualite, options });
      decor = B.decor.construire(c, { qualite: options.qualite, matieres: P.decor.matieres,
        vegetation: P.decor.vegetation, vegetationQualite: P.decor.vegetationQualite });
      decor.atmosphere = B.graphismes.atmosphere(decor.atmosphere);
      positions ||= endroitsCharges(decor, DEPART);
      rendu.resize(P.rendu.resolution);
      rendu.setWorld([], [], decor.atmosphere); rendu.setNappes(decor.nappes); rendu.setLots(decor.lots);
      if (!faune && P.faune !== 'off') faune = B.faune.creer(c, decor);
      fauneVue.qualite = P.faune;
      if (rendu.profile) rendu.profile(false);
      // Glaces au rythme de la course (src/jeu.js, majGlaces) : une glace toutes les round(30 / hz) images du cockpit.
      const hz = P.effets.retroImages && P.secondaires && P.secondaires.retroviseurs ? P.secondaires.retroviseurs.hz : 0;
      sautGlaces = hz > 0 ? Math.max(1, Math.round(30 / hz)) : 0; pasGlaces = 0; glacesActives = false;
      habitacle.ciel = decor.atmosphere.skyBottom; habitacle.brume = decor.atmosphere.fog;
      compte = 0; imagesGlaces = 0;
      for (const etat of detailsRoues) etat.fill(-1);
      for (const etat of detailsGlaces) etat.fill(-1);
      const differees = !!reglage && reglage.glaces === 'differees';
      const info = differees && sautGlaces ? { glaces: 'differees', glacesParImage: 1 / sautGlaces } : activerGlaces();
      // toile : taille de l'image mesurée (pixels du moteur), celle de l'écran entier quand le jeu l'a posée
      const toile = gl && gl.canvas ? [gl.canvas.width, gl.canvas.height] : null;
      return Object.assign(info, { cockpit: true, toile });
    }
    // glaces : 'dessinees' (au rythme de la course), 'absentes' (la course les dessinerait, le parcours ne le peut
    // pas), 'aucune' (palier sans image des glaces) ; glacesParImage : rendus de glace par image en course.
    function activerGlaces() {
      if (!sautGlaces) return { glaces: 'aucune', glacesParImage: 0 };
      if (!glacesRendu && !echecGlaces) {
        temporaires = fabrique();
        if (temporaires && temporaires.rendu) glacesRendu = temporaires.rendu; else { temporaires = null; echecGlaces = true; }
      }
      glacesActives = !!glacesRendu && !!decor;
      if (glacesActives) {
        // Le moteur des glaces reçoit ses propres copies des nappes et des lots, comme en course.
        glacesRendu.setWorld([], [], decor.atmosphere);
        glacesRendu.setNappes(decor.nappes.map(n => Object.assign({}, n)));
        glacesRendu.setLots(decor.lots.map(l => Object.assign({}, l, { tampon: null, tamponLoin: null, paquet: null, paquetLoin: null })));
        // En course, chaque glace rendue est copiée dans la toile 2D posée sur le rétroviseur (drawImage) : le
        // parcours fait la même copie dans une toile à lui, jamais affichée.
        const source = glacesRendu.gl && glacesRendu.gl.canvas, doc = globalThis.document;
        if (!copie && source && doc && doc.createElement) {
          const t = doc.createElement('canvas'), ctx = t.getContext && t.getContext('2d');
          if (ctx) copie = { t, ctx };
        }
        if (copie && source && (copie.t.width !== source.width || copie.t.height !== source.height)) { copie.t.width = source.width; copie.t.height = source.height; }
      }
      return { glaces: glacesActives ? 'dessinees' : 'absentes', glacesParImage: 1 / sautGlaces, glacesTemporaires: !!temporaires };
    }
    // Rendu d'une glace depuis le cockpit, même géométrie et mêmes options que la course : regard réfléchi par la
    // glace, ouvert de 9° vers l'extérieur, champ de 16° rapporté au format de la glace, ni ombres ni halo.
    function dessinerGlace(cam, ev, temps, vent) {
      const cote = imagesGlaces % 2, glaces = B.voiture.glacesCockpit(ev), g = glaces[cote];
      const d0 = [g.centre[0] - cam.pos[0], g.centre[1] - cam.pos[1], g.centre[2] - cam.pos[2]];
      const dn = Math.hypot(d0[0], d0[1], d0[2]) || 1, dv = d0.map(v => v / dn);
      const pn = dv[0] * g.normale[0] + dv[1] * g.normale[1] + dv[2] * g.normale[2], rf = dv.map((v, k) => v - 2 * pn * g.normale[k]);
      const ouvre = g.k * .16, co = Math.cos(ouvre), so = Math.sin(ouvre), rx = rf[0] * co - rf[2] * so, rz = rf[0] * so + rf[2] * co;
      const R = B.voiture.RETRO, camR = { pos: [g.centre[0], g.centre[1] + .1, g.centre[2]], yaw: Math.atan2(rx, -rz),
        pitch: Math.asin(Math.max(-1, Math.min(1, rf[1]))) + .06, roll: (ev.roulis || 0) * .85,
        fov: 2 * Math.atan(Math.tan(16 * Math.PI / 180) * R.h / R.l) * 180 / Math.PI, near: .3, far: 6000, sun: cam.sun };
      objetsGlace.length = 0;
      // Le rendu principal est terminé : les modèles peuvent être reposés pour la petite toile du miroir,
      // comme en course. Garder le maillage de la grande vue surestimait le coût du banc après le lot 12B.
      const toile = glacesRendu.gl && glacesRendu.gl.canvas, hauteur = toile && toile.height || 180;
      const tanDemi = Math.tan(camR.fov * Math.PI / 360), histoire = detailsGlaces[cote], complet = distanceComplete(camR.fov);
      for (let i = 0; i < modeles.length; i++) {
        const e = posesVoitures[i], o = optionsGlaces[i], dx = e.p[0] - camR.pos[0], dz = e.p[2] - camR.pos[2];
        o.simple = optionsVoitures[i].simple || dx * dx + dz * dz > complet * complet;
        o.rouesDetail = histoire[i] = B.voiture.detailRouesPour(B.voiture.distanceRoues2(e, camR.pos), tanDemi, hauteur, histoire[i]);
        B.voiture.poser(modeles[i], e, objetsGlace, o);
      }
      for (let i = finVoitures; i < sortie.length; i++) if (!sortie[i].overlay) objetsGlace.push(sortie[i]);
      optionsPiloteGlace.rouesDetail = histoire[modeles.length] = B.voiture.detailRouesPour(B.voiture.distanceRoues2(ev, camR.pos), tanDemi, hauteur, histoire[modeles.length]);
      B.voiture.poserRetro(pilote, ev, objetsGlace, optionsPiloteGlace);
      glacesRendu.draw(camR, objetsGlace, { time: temps, shadows: false, bloom: false, torch: false, sunOnly: true, adaptive: false,
        damage: 0, flash: 0, photo: 0, weather, windSources: vent, windStrength: P.windStrength, groundCover: P.groundCover });
      if (copie) copie.ctx.drawImage(glacesRendu.gl.canvas, 0, 0);
      imagesGlaces++;
    }
    // Une image de course : deux pas de simulation, douze voitures posées, la scène, et la glace du rythme de course
    // si le point de vue est le cockpit.
    function dessiner(temps, vue) {
      simuler();
      const cockpit = vue === 0;
      const s = positions[vue] + Math.sin(temps * .6) * 10, e = B.circuit.echantillon(c, s);
      const ca = Math.cos(e.cap), sa = Math.sin(e.cap);
      const sun = { center: [e.x + ca * 65, e.y, e.z + sa * 65], extent: 100, depth: 340 };
      const histoire = detailsRoues[vue], hauteur = gl && gl.canvas && gl.canvas.height || 1080;
      let cam, ev = null;
      sortie.length = 0;
      if (cockpit) {
        // Œil du pilote dans sa monoplace, regard dans l'axe (src/jeu.js, cameraCockpit, sans les mouvements de tête).
        ev = { p: [e.x, e.y, e.z], cap: e.cap, tangage: Math.atan(e.pente || 0), roulis: e.devers || 0, braquage: 0, roule: temps * 4, rebond: 0, v: 45, etatPneus: pneusMesure[modeles.length] };
        const o = B.voiture.mul(B.voiture.attitude(ev.cap, ev.tangage, ev.roulis), B.voiture.OEIL);
        cam = { pos: [e.x + o[0], e.y + o[1], e.z + o[2]], yaw: e.cap + Math.PI / 2, pitch: ev.tangage * .85, roll: -ev.roulis * .85,
          fov: 60, near: .1, far: 6000, sun };
        habitacle.rouesDetail = histoire[modeles.length] = B.voiture.detailRouesPour(B.voiture.distanceRoues2(ev, cam.pos), Math.tan(cam.fov * Math.PI / 360), hauteur, histoire[modeles.length]);
        B.voiture.cockpit(pilote, ev, sortie, habitacle);
      } else cam = { pos: [e.x - ca * 10, e.y + 3, e.z - sa * 10], yaw: e.cap + Math.PI / 2,
        pitch: -.11, roll: 0, fov: 60, near: .08, far: 6000, sun };
      const complet = distanceComplete(cam.fov), tanDemi = Math.tan(cam.fov * Math.PI / 360);
      for (let i = 0; i < modeles.length; i++) {
        const sv = s + 8 + i * 10, v = B.circuit.echantillon(c, sv), d = i % 2 ? 2 : -2;
        const x = v.x - Math.sin(v.cap) * d, z = v.z + Math.cos(v.cap) * d, dx = x - cam.pos[0], dz = z - cam.pos[2];
        const pose = posesVoitures[i], options = optionsVoitures[i];
        pose.p[0] = x; pose.p[1] = v.y; pose.p[2] = z; pose.cap = v.cap;
        pose.tangage = Math.atan(v.pente || 0); pose.roulis = v.devers || 0; pose.roule = temps * 4;
        options.simple = dx * dx + dz * dz > complet * complet;
        options.rouesDetail = histoire[i] = B.voiture.detailRouesPour(B.voiture.distanceRoues2(pose, cam.pos), tanDemi, hauteur, histoire[i]);
        B.voiture.poser(modeles[i], pose, sortie, options);
        const q = posesSillage[i]; q.x = x; q.y = v.y; q.z = z; q.cap = v.cap; voituresSillage[i].etat.s = sv;
      }
      finVoitures = sortie.length;
      const vent = sillage ? B.sillage.mettreAJour(sillage, voituresSillage, posesSillage, c) : undefined;
      fauneVue.pose.x = e.x; fauneVue.pose.y = e.y; fauneVue.pose.z = e.z;
      if (faune && P.faune !== 'off') B.faune.dessiner(faune, temps, fauneVue, sortie);
      // Mêmes options de rendu que la course, reflets compris dès que le palier les permet (piste mouillée) :
      // le parcours mesure le cas le plus chargé du palier, pas une course sèche.
      rendu.draw(cam, sortie, { time: temps, msaa: P.rendu.msaa === 4, shadowMapScale: P.rendu.shadowMapScale,
        shadows: P.effets.ombres, bloom: P.effets.halo, brightness: 1, torch: false, sunOnly: true, adaptive: false,
        photo: P.effets.halo ? 1 : 0, reflections: P.effets.reflets, weather, windSources: vent, windStrength: P.windStrength,
        groundCover: P.groundCover });
      // Une glace par image du cockpit au plus, une sur deux en Moyenne : chaque rafale du cockpit en contient.
      if (cockpit && glacesActives && (pasGlaces = (pasGlaces + 1) % sautGlaces) === 0) dessinerGlace(cam, ev, temps, vent);
      compte++;
    }
    const horloge = annexes && typeof annexes.maintenant === 'function' ? annexes.maintenant : () => globalThis.performance.now();
    return { sonder: () => sonder(horloge), preparer, activerGlaces, simuler, dessiner, terminer, get positions() { return positions && positions.slice(); },
      get images() { return compte; }, get imagesGlaces() { return imagesGlaces; }, get pasSimulation() { return pas; },
      // Le moteur des glaces prêté garde le décor du parcours : le jeu doit lui rendre celui de sa séance. Le moteur
      // temporaire est détruit avec son contexte.
      liberer() {
        sortie.length = 0; objetsGlace.length = 0; modeles.length = 0; decor = null; faune = null; glacesActives = false; sim = null; copie = null;
        if (temporaires) { temporaires.liberer(); temporaires = null; glacesRendu = pretees; }
      } };
  }
  B.sceneBench = { creer, distanceComplete, DEPART, OPTIONS_GLACES, SONDE, ATTRIBUTS_SONDE, LOGICIEL };
})(globalThis.BITUME = globalThis.BITUME || {});
