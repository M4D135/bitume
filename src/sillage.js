(function (B) {
  'use strict';
  // Sources aérodynamiques communes à toutes les vues ; aucun parcours de plantes.
  // Au lancement de la séance, preparer dimensionne la liste et réinitialise les sources de la réserve.
  // La mise à jour par image réutilise ces sources et leurs vecteurs.
  const MAX_SOURCES = 16;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function creer(capacite = MAX_SOURCES) {
    const n = Number.isFinite(capacite) ? clamp(Math.floor(capacite), 0, MAX_SOURCES) : MAX_SOURCES;
    const reserve = Array.from({ length: n }, (_, id) => ({
      id, p: [0, 0, 0], velocity: [0, 0, 0], strength: 0,
    }));
    return { reserve, sources: [], actifs: 0 };
  }
  // Prépare pour n voitures l'état donné (ou un neuf s'il n'y en a pas) et le rend : sources de la réserve en place
  // dans la liste, sans souffle, comme à la création. À appeler au lancement de la séance, hors de la boucle d'images.
  function preparer(etat, n) {
    const e = etat && Array.isArray(etat.reserve) && Array.isArray(etat.sources) ? etat : creer();
    const k = Math.min(e.reserve.length, Number.isFinite(n) ? Math.max(0, Math.floor(n)) : e.reserve.length);
    for (let i = 0; i < e.reserve.length; i++) {
      const source = e.reserve[i];
      source.p[0] = source.p[1] = source.p[2] = 0;
      source.velocity[0] = source.velocity[1] = source.velocity[2] = 0;
      source.id = i; source.strength = 0;
      if (i < k) e.sources[i] = source;
    }
    e.sources.length = k; e.actifs = 0;
    return e;
  }
  function mettreAJour(etat, voitures, poses, circuit) {
    const n = Math.min(voitures.length, etat.reserve.length), sources = etat.sources;
    let actifs = 0;
    for (let i = 0; i < n; i++) {
      const v = voitures[i], p = poses[i], e = v && v.etat, source = etat.reserve[i];
      sources[i] = source; source.strength = 0;
      source.velocity[0] = source.velocity[1] = source.velocity[2] = 0;
      if (!e || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z) || !Number.isFinite(p.cap) || !Number.isFinite(e.v)) continue;
      source.id = v.id === undefined ? i : v.id;
      source.p[0] = p.x; source.p[1] = p.y + .35; source.p[2] = p.z;
      const vitesse = Math.abs(e.v);
      if (v.abandon || vitesse <= .5 || (circuit && B.circuit && (B.circuit.dansCouvert || B.circuit.dansTunnel)?.(circuit, e.s, 0))) continue;
      // Le cap dessiné inclut le dérapage de la caisse ; le flux suit la vitesse réelle.
      const capVitesse = p.cap - (Number.isFinite(e.beta) ? e.beta : 0);
      source.velocity[0] = Math.cos(capVitesse) * e.v;
      source.velocity[2] = Math.sin(capVitesse) * e.v;
      source.radius = 6 + 2 * clamp(vitesse / 70, 0, 1);
      source.wake = 10 + Math.min(24, vitesse * .3);
      source.strength = 1; actifs++;
    }
    for (let i = n; i < sources.length; i++) {
      const source = etat.reserve[i];
      source.strength = 0;
      source.velocity[0] = source.velocity[1] = source.velocity[2] = 0;
    }
    // la longueur ne change qu'avec le nombre de voitures : la liste garde son stockage d'une image à l'autre
    if (sources.length !== n) sources.length = n;
    etat.actifs = actifs;
    return sources;
  }
  // Eau soulevée derrière les pneus : exposition locale de la caméra, d'après les poses du rendu.
  // Ne dépend ni du classement ni de l'abscisse de piste (deux portions voisines peuvent se croiser).
  // Le cône suit la vitesse réelle, s'élargit puis se dissipe ; aucune allocation par vue.
  const porteeEmbruns = vitesse => 12 + Math.min(vitesse, 100) * .85;
  const rayonEmbruns = derriere => 1.6 + derriere * .085;
  // Projection sur un axe du monde : la somme des maxima longitudinal et latéral couvre toute orientation.
  const PORTEE_MAX = porteeEmbruns(100), EMPRISE_EMBRUNS = PORTEE_MAX + rayonEmbruns(PORTEE_MAX) + 1;
  function exposition(etat, position, mouille, idExclu) {
    const eau = Number.isFinite(mouille) ? clamp(mouille, 0, 1) : 0;
    if (!etat || !etat.sources || !position || !eau ||
        !Number.isFinite(position[0]) || !Number.isFinite(position[1]) || !Number.isFinite(position[2])) return 0;
    let charge = 0;
    for (const source of etat.sources) {
      if (!source || source.id === idExclu || !(source.strength > 0)) continue;
      const dx = position[0] - source.p[0], dy = position[1] - source.p[1], dz = position[2] - source.p[2];
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dz) || dy < -1 ||
          Math.abs(dx) > EMPRISE_EMBRUNS || Math.abs(dz) > EMPRISE_EMBRUNS) continue;
      const vx = source.velocity[0], vz = source.velocity[2], vitesse = Math.hypot(vx, vz);
      if (!Number.isFinite(vitesse) || vitesse < 8) continue;
      const derriere = -(dx * vx + dz * vz) / vitesse, portee = porteeEmbruns(vitesse);
      if (derriere <= 0 || derriere >= portee) continue;
      const lateral = Math.abs(dx * vz - dz * vx) / vitesse, rayon = rayonEmbruns(derriere);
      if (lateral >= rayon) continue;
      // À grande vitesse, l'eau pulvérisée remonte dans le sillage turbulent. L'ancien plafond bas
      // perdait presque toute la caméra de poursuite (2,45 m), alors que le casque recevait le nuage.
      // Une chaussée peu mouillée ou une voiture lente conservent un panache bas ; le cœur humide
      // s'amenuise progressivement jusqu'à son sommet, sans palier opaque ni dépendance à la vue.
      const pulverisation = eau * clamp((vitesse - 20) / 50, 0, 1);
      const hauteur = 1.35 + derriere * (.032 + .035 * pulverisation) + .50 * pulverisation;
      if (dy > hauteur) continue;
      const bord = 1 - lateral / rayon, distance = 1 - derriere / portee;
      const altitude = Math.max(0, dy) / hauteur, vertical = 1 - altitude * altitude;
      charge += eau * clamp((vitesse - 8) / 42, 0, 1) * bord * bord * distance * vertical * 2.8;
    }
    return 1 - Math.exp(-charge);
  }
  B.sillage = { MAX_SOURCES, creer, preparer, mettreAJour, exposition };
})(globalThis.BITUME = globalThis.BITUME || {});
