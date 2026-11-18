/* BITUME — parcours de calibration isolé : même terrain, végétation, voitures et renderer que le jeu.
   Ne crée aucune course, ne touche ni aux circuits installés, ni aux records, ni aux commandes. */
(function (B) {
  'use strict';
  // Distance au-delà de laquelle la course dessine une voiture allégée (rendu d'une image, src/jeu.js) : le modèle
  // complet tant qu'il tient une trentaine de pixels de haut au champ donné. Le parcours suit la même règle pour
  // coûter ce que coûte un peloton en course.
  const distanceComplete = fov => 170 * Math.tan(20.8 * Math.PI / 180) / Math.tan(Math.max(10, Math.min(110, fov)) * Math.PI / 360);
  // Mesure à l'horloge (reglage.chronoGPU === false) : le premier point de vue est l'endroit le plus chargé compté en
  // course le 18/11, le départ de la séance de référence de Val-Brûlé (s = 800 ; 4,3 M de triangles en Fine, 1,6 fois
  // les points d'herbe), vu du cockpit avec l'habitacle. Le parcours a la graine, le thème et la longueur de
  // Val-Brûlé : c'est le même tracé. Le 95e centile du coût, qui juge, tombe alors sur ce point de vue.
  const DEPART = 800;
  // annexes.glaces : moteur des rétroviseurs du jeu (second contexte WebGL, toile hors écran). En course, chaque
  // image du cockpit peut ajouter le rendu d'une glace ; sans ce moteur, le parcours ne sait pas le dessiner et le
  // dit à la détection, qui resserre alors sa limite.
  function creer(rendu, capacites, annexes) {
    const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200, nom: 'Détection' });
    const couleurs = [[.72,.08,.04],[.04,.22,.65],[.75,.58,.04],[.12,.38,.16]];
    const modeles = Array.from({ length: 12 }, (_, i) => B.voiture.modele({ couleur: couleurs[i % 4], seconde: [.8,.78,.7], pneus: 'slicks' }));
    const sortie = [], fauneVue = { qualite: 'off', nuit: 0, pluie: .18, pose: { x: 0, y: 0, z: 0 }, vue: 0 };
    const meteo = B.meteo.pour('pluie'); meteo.pluie = .18; meteo.nuage = .4; meteo.mouille = .65;
    const weather = B.meteo.ambiance(meteo);
    // Sillage des douze voitures : en course, l'herbe et les feuillages proches plient au passage du peloton (sources
    // de vent du moteur, calculées pour chaque sommet de prairie). Sans elles, le parcours épargnerait ce travail.
    const sillage = B.sillage ? B.sillage.creer(modeles.length) : null;
    const voituresSillage = modeles.map((_, id) => ({ id, etat: { s: 0, v: 45, beta: 0 } }));
    const posesSillage = modeles.map(() => ({ x: 0, y: 0, z: 0, cap: 0 }));
    // Fin forcée du travail graphique : lire un pixel oblige le pilote à exécuter tout ce qui attend. L'horloge
    // autour de dessiner() puis terminer() mesure alors l'image complète sans requête de chronométrage GPU, quelles
    // que soient la synchronisation verticale et la cadence du navigateur (même procédé que rendu.calibrate du
    // moteur). Sans contexte lisible, pas de fin forcée : la détection garde alors sa mesure au chronomètre.
    // Les glaces se terminent aussi : leur contexte a sa propre file de travail.
    const lisible = g => !!g && typeof g.readPixels === 'function';
    const glacesRendu = annexes && annexes.glaces || null, gl = rendu && rendu.gl, glG = glacesRendu && glacesRendu.gl, pixel = new Uint8Array(4);
    let glacesActives = false;
    const terminer = lisible(gl) ? () => {
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      if (glacesActives && lisible(glG)) glG.readPixels(0, 0, 1, 1, glG.RGBA, glG.UNSIGNED_BYTE, pixel);
    } : null;
    let decor = null, P = null, faune = null, positionsHerbe = null, positionsCourse = null, horloge = false, compte = 0;
    let sautGlaces = 0, pasGlaces = 0, imagesGlaces = 0;
    const pilote = B.voiture.modele({ couleur: [.9, .9, .88], seconde: [.1, .1, .1], pneus: 'slicks' }), objetsGlace = [];
    const habitacle = { regime: 9500, volant: 0, rapport: 5, kmh: 250, passage: 1, derriere: [], ciel: null, brume: null, glaceVive: false };
    function endroitsCharges(d, premier) {
      if (!d.ecologie) return [800, 1800, 3000];
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
      const choisis = premier === undefined ? [] : [premier];
      for (const v of candidats) if (choisis.every(s => Math.abs(s - v.s) > 300)) { choisis.push(v.s); if (choisis.length === 3) break; }
      return choisis.length === 3 ? choisis : [800, 1800, 3000];
    }
    // reglage.chronoGPU === false : la détection mesure à l'horloge avec terminer() ; le chronomètre GPU du moteur
    // reste fermé, ses requêtes couperaient les passes des processeurs graphiques à tuiles et fausseraient la mesure.
    function preparer(id, options, reglage) {
      P = B.graphismes.melange(options.qualite, 0, { capacites, decor: options.qualite, options });
      decor = B.decor.construire(c, { qualite: options.qualite, matieres: P.decor.matieres,
        vegetation: P.decor.vegetation, vegetationQualite: P.decor.vegetationQualite });
      decor.atmosphere = B.graphismes.atmosphere(decor.atmosphere);
      horloge = !!reglage && reglage.chronoGPU === false;
      positionsHerbe ||= endroitsCharges(decor);
      if (horloge) positionsCourse ||= endroitsCharges(decor, DEPART);
      rendu.resize(P.rendu.resolution);
      rendu.setWorld([], [], decor.atmosphere); rendu.setNappes(decor.nappes); rendu.setLots(decor.lots);
      if (!faune && P.faune !== 'off') faune = B.faune.creer(c, decor);
      fauneVue.qualite = P.faune;
      if (rendu.profile) { rendu.profile(false); if (!horloge) rendu.profile(true); }
      // Glaces au rythme de la course (src/jeu.js, majGlaces) : une glace toutes les round(30 / hz) images du cockpit.
      // Le moteur des glaces reçoit ses propres copies des nappes et des lots, comme en course.
      const hz = P.effets.retroImages && P.secondaires && P.secondaires.retroviseurs ? P.secondaires.retroviseurs.hz : 0;
      sautGlaces = hz > 0 ? Math.max(1, Math.round(30 / hz)) : 0; pasGlaces = 0;
      glacesActives = horloge && sautGlaces > 0 && !!glacesRendu;
      if (glacesActives) {
        glacesRendu.setWorld([], [], decor.atmosphere);
        glacesRendu.setNappes(decor.nappes.map(n => Object.assign({}, n)));
        glacesRendu.setLots(decor.lots.map(l => Object.assign({}, l, { tampon: null, tamponLoin: null, paquet: null, paquetLoin: null })));
      }
      habitacle.ciel = decor.atmosphere.skyBottom; habitacle.brume = decor.atmosphere.fog;
      compte = 0; imagesGlaces = 0;
      // glaces : 'dessinees' (au rythme de la course), 'absentes' (la course les dessinerait, le parcours ne le peut
      // pas), 'aucune' (palier sans image des glaces) ; glacesParImage : rendus de glace par image en course.
      return { glaces: !sautGlaces ? 'aucune' : glacesActives ? 'dessinees' : 'absentes', glacesParImage: sautGlaces ? 1 / sautGlaces : 0,
        cockpit: horloge };
    }
    // Rendu d'une glace depuis le cockpit, même géométrie et mêmes options que la course : regard réfléchi par la
    // glace, ouvert de 9° vers l'extérieur, champ de 16° rapporté au format de la glace, ni ombres ni halo.
    function dessinerGlace(cam, ev, temps, vent) {
      const glaces = B.voiture.glacesCockpit(ev), g = glaces[imagesGlaces % 2];
      const d0 = [g.centre[0] - cam.pos[0], g.centre[1] - cam.pos[1], g.centre[2] - cam.pos[2]];
      const dn = Math.hypot(d0[0], d0[1], d0[2]) || 1, dv = d0.map(v => v / dn);
      const pn = dv[0] * g.normale[0] + dv[1] * g.normale[1] + dv[2] * g.normale[2], rf = dv.map((v, k) => v - 2 * pn * g.normale[k]);
      const ouvre = g.k * .16, co = Math.cos(ouvre), so = Math.sin(ouvre), rx = rf[0] * co - rf[2] * so, rz = rf[0] * so + rf[2] * co;
      const R = B.voiture.RETRO, camR = { pos: [g.centre[0], g.centre[1] + .1, g.centre[2]], yaw: Math.atan2(rx, -rz),
        pitch: Math.asin(Math.max(-1, Math.min(1, rf[1]))) + .06, roll: (ev.roulis || 0) * .85,
        fov: 2 * Math.atan(Math.tan(16 * Math.PI / 180) * R.h / R.l) * 180 / Math.PI, near: .3, far: 6000, sun: cam.sun };
      objetsGlace.length = 0;
      for (const o of sortie) if (!o.overlay) objetsGlace.push(o);
      glacesRendu.draw(camR, objetsGlace, { time: temps, shadows: false, bloom: false, torch: false, sunOnly: true, adaptive: false,
        damage: 0, flash: 0, photo: 0, weather, windSources: vent, windStrength: P.windStrength, groundCover: P.groundCover });
      imagesGlaces++;
    }
    function dessiner(temps, vue) {
      const positions = horloge ? positionsCourse : positionsHerbe, cockpit = horloge && vue === 0;
      const s = positions[vue] + Math.sin(temps * .6) * 10, e = B.circuit.echantillon(c, s);
      const ca = Math.cos(e.cap), sa = Math.sin(e.cap);
      const sun = { center: [e.x + ca * 65, e.y, e.z + sa * 65], extent: 100, depth: 340 };
      let cam, ev = null;
      sortie.length = 0;
      if (cockpit) {
        // Œil du pilote dans sa monoplace, regard dans l'axe (src/jeu.js, cameraCockpit, sans les mouvements de tête).
        ev = { p: [e.x, e.y, e.z], cap: e.cap, tangage: Math.atan(e.pente || 0), roulis: e.devers || 0, braquage: 0, roule: temps * 4, rebond: 0, v: 45 };
        const o = B.voiture.mul(B.voiture.attitude(ev.cap, ev.tangage, ev.roulis), B.voiture.OEIL);
        cam = { pos: [e.x + o[0], e.y + o[1], e.z + o[2]], yaw: e.cap + Math.PI / 2, pitch: ev.tangage * .85, roll: -ev.roulis * .85,
          fov: 60, near: .1, far: 6000, sun };
        B.voiture.cockpit(pilote, ev, sortie, habitacle);
      } else cam = { pos: [e.x - ca * 10, e.y + 3, e.z - sa * 10], yaw: e.cap + Math.PI / 2,
        pitch: -.11, roll: 0, fov: 60, near: .08, far: 6000, sun };
      const complet = distanceComplete(cam.fov);
      for (let i = 0; i < modeles.length; i++) {
        const sv = s + 8 + i * 10, v = B.circuit.echantillon(c, sv), d = i % 2 ? 2 : -2;
        const x = v.x - Math.sin(v.cap) * d, z = v.z + Math.cos(v.cap) * d, dx = x - cam.pos[0], dz = z - cam.pos[2];
        B.voiture.poser(modeles[i], { p: [x, v.y, z], cap: v.cap, tangage: Math.atan(v.pente || 0), roulis: v.devers || 0, roule: temps * 4, v: 45 },
          sortie, { simple: dx * dx + dz * dz > complet * complet });
        const q = posesSillage[i]; q.x = x; q.y = v.y; q.z = z; q.cap = v.cap; voituresSillage[i].etat.s = sv;
      }
      const vent = sillage ? B.sillage.mettreAJour(sillage, voituresSillage, posesSillage, c) : undefined;
      fauneVue.pose.x = e.x; fauneVue.pose.y = e.y; fauneVue.pose.z = e.z;
      if (faune && P.faune !== 'off') B.faune.dessiner(faune, temps, fauneVue, sortie);
      // Mêmes options de rendu que la course, reflets compris dès que le palier les permet (piste mouillée) :
      // le parcours mesure le cas le plus chargé du palier, pas une course sèche.
      rendu.draw(cam, sortie, { time: temps, msaa: P.rendu.msaa === 4, shadowMapScale: P.rendu.shadowMapScale,
        shadows: P.effets.ombres, bloom: P.effets.halo, brightness: 1, torch: false, sunOnly: true, adaptive: false,
        photo: P.effets.halo ? 1 : 0, reflections: P.effets.reflets, weather, windSources: vent, windStrength: P.windStrength,
        groundCover: P.groundCover });
      // Une glace par image du cockpit au plus, une sur deux en Moyenne : le 95e centile voit les images qui la paient.
      if (cockpit && glacesActives && (pasGlaces = (pasGlaces + 1) % sautGlaces) === 0) dessinerGlace(cam, ev, temps, vent);
      compte++;
    }
    return { preparer, dessiner, terminer, get positions() { const p = horloge ? positionsCourse : positionsHerbe; return p && p.slice(); },
      get images() { return compte; }, get imagesGlaces() { return imagesGlaces; },
      // Le moteur des glaces garde le décor du parcours : le jeu doit lui rendre celui de sa séance.
      liberer() { sortie.length = 0; objetsGlace.length = 0; modeles.length = 0; decor = null; faune = null; glacesActives = false; } };
  }
  B.sceneBench = { creer, distanceComplete };
})(globalThis.BITUME = globalThis.BITUME || {});
