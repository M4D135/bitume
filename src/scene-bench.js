/* BITUME — parcours de calibration isolé : même terrain, végétation, voitures et renderer que le jeu.
   Ne crée aucune course, ne touche ni aux circuits installés, ni aux records, ni aux commandes. */
(function (B) {
  'use strict';
  function creer(rendu, capacites) {
    const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200, nom: 'Détection' });
    const couleurs = [[.72,.08,.04],[.04,.22,.65],[.75,.58,.04],[.12,.38,.16]];
    const modeles = Array.from({ length: 12 }, (_, i) => B.voiture.modele({ couleur: couleurs[i % 4], seconde: [.8,.78,.7], pneus: 'slicks' }));
    const sortie = [], fauneVue = { qualite: 'off', nuit: 0, pluie: .18, pose: { x: 0, y: 0, z: 0 }, vue: 0 };
    const meteo = B.meteo.pour('pluie'); meteo.pluie = .18; meteo.nuage = .4; meteo.mouille = .65;
    const weather = B.meteo.ambiance(meteo);
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
    function preparer(id, options) {
      P = B.graphismes.melange(options.qualite, 0, { capacites, decor: options.qualite, options });
      decor = B.decor.construire(c, { qualite: options.qualite, matieres: P.decor.matieres,
        vegetation: P.decor.vegetation, vegetationQualite: P.decor.vegetationQualite });
      decor.atmosphere = B.graphismes.atmosphere(decor.atmosphere);
      positions ||= endroitsCharges(decor);
      rendu.resize(P.rendu.resolution);
      rendu.setWorld([], [], decor.atmosphere); rendu.setNappes(decor.nappes); rendu.setLots(decor.lots);
      if (!faune && P.faune !== 'off') faune = B.faune.creer(c, decor);
      fauneVue.qualite = P.faune;
      if (rendu.profile) { rendu.profile(false); rendu.profile(true); }
      compte = 0;
    }
    function dessiner(temps, vue) {
      const s = positions[vue] + Math.sin(temps * .6) * 10, e = B.circuit.echantillon(c, s);
      const ca = Math.cos(e.cap), sa = Math.sin(e.cap);
      const cam = { pos: [e.x - ca * 10, e.y + 3, e.z - sa * 10], yaw: e.cap + Math.PI / 2,
        pitch: -.11, roll: 0, fov: 60, near: .08, far: 6000, sun: { center: [e.x + ca * 65, e.y, e.z + sa * 65], extent: 100, depth: 340 } };
      sortie.length = 0;
      for (let i = 0; i < modeles.length; i++) {
        const v = B.circuit.echantillon(c, s + 8 + i * 10), d = i % 2 ? 2 : -2;
        B.voiture.poser(modeles[i], { p: [v.x - Math.sin(v.cap) * d, v.y, v.z + Math.cos(v.cap) * d],
          cap: v.cap, tangage: Math.atan(v.pente || 0), roulis: v.devers || 0, roule: temps * 4, v: 45 }, sortie, { simple: i > 6 });
      }
      fauneVue.pose.x = e.x; fauneVue.pose.y = e.y; fauneVue.pose.z = e.z;
      if (faune && P.faune !== 'off') B.faune.dessiner(faune, temps, fauneVue, sortie);
      rendu.draw(cam, sortie, { time: temps, msaa: P.rendu.msaa === 4, shadowMapScale: P.rendu.shadowMapScale,
        shadows: P.effets.ombres, bloom: P.effets.halo, brightness: 1, torch: false, sunOnly: true, adaptive: false,
        reflections: P.effets.reflets, weather, windStrength: 1, groundCover: P.groundCover });
      compte++;
    }
    return { preparer, dessiner, get positions() { return positions && positions.slice(); }, get images() { return compte; },
      liberer() { sortie.length = 0; modeles.length = 0; decor = null; faune = null; } };
  }
  B.sceneBench = { creer };
})(globalThis.BITUME = globalThis.BITUME || {});
