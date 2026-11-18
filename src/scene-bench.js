/* BITUME — parcours de calibration isolé : même terrain, végétation, voitures et renderer que le jeu.
   Ne crée aucune course, ne touche ni aux circuits installés, ni aux records, ni aux commandes. */
(function (B) {
  'use strict';
  // Distance au-delà de laquelle la course dessine une voiture allégée (rendu d'une image, src/jeu.js) : le modèle
  // complet tant qu'il tient une trentaine de pixels de haut au champ donné. Le parcours suit la même règle pour
  // coûter ce que coûte un peloton en course.
  const distanceComplete = fov => 170 * Math.tan(20.8 * Math.PI / 180) / Math.tan(Math.max(10, Math.min(110, fov)) * Math.PI / 360);
  function creer(rendu, capacites) {
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
    const gl = rendu && rendu.gl, pixel = new Uint8Array(4);
    const terminer = gl && typeof gl.readPixels === 'function'
      ? () => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); } : null;
    let decor = null, P = null, faune = null, positions = null, compte = 0;
    function endroitsCharges(d) {
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
      const choisis = [];
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
      positions ||= endroitsCharges(decor);
      rendu.resize(P.rendu.resolution);
      rendu.setWorld([], [], decor.atmosphere); rendu.setNappes(decor.nappes); rendu.setLots(decor.lots);
      if (!faune && P.faune !== 'off') faune = B.faune.creer(c, decor);
      fauneVue.qualite = P.faune;
      if (rendu.profile) { rendu.profile(false); if (!reglage || reglage.chronoGPU !== false) rendu.profile(true); }
      compte = 0;
    }
    function dessiner(temps, vue) {
      const s = positions[vue] + Math.sin(temps * .6) * 10, e = B.circuit.echantillon(c, s);
      const ca = Math.cos(e.cap), sa = Math.sin(e.cap);
      const cam = { pos: [e.x - ca * 10, e.y + 3, e.z - sa * 10], yaw: e.cap + Math.PI / 2,
        pitch: -.11, roll: 0, fov: 60, near: .08, far: 6000, sun: { center: [e.x + ca * 65, e.y, e.z + sa * 65], extent: 100, depth: 340 } };
      const complet = distanceComplete(cam.fov);
      sortie.length = 0;
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
      compte++;
    }
    return { preparer, dessiner, terminer, get positions() { return positions && positions.slice(); }, get images() { return compte; },
      liberer() { sortie.length = 0; modeles.length = 0; decor = null; faune = null; } };
  }
  B.sceneBench = { creer, distanceComplete };
})(globalThis.BITUME = globalThis.BITUME || {});
