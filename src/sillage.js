(function (B) {
  'use strict';
  // Sources aérodynamiques communes à toutes les vues ; aucun parcours de plantes.
  // L'état se prépare au lancement de la séance (preparer) plutôt qu'à sa première image : la liste des sources y
  // prend sa taille et chaque source sa forme définitive (coordonnées et rayons tenus en nombres à virgule), de sorte
  // que la mise à jour de chaque image n'alloue rien, la première comprise, une fois le code optimisé par le moteur.
  const MAX_SOURCES = 16;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function creer(capacite = MAX_SOURCES) {
    const n = Number.isFinite(capacite) ? clamp(Math.floor(capacite), 0, MAX_SOURCES) : MAX_SOURCES;
    const reserve = Array.from({ length: n }, (_, id) => ({
      id, p: [0, 0, 0], velocity: [0, 0, 0], radius: 6, strength: 0, wake: 10,
    }));
    return { reserve, sources: [], actifs: 0 };
  }
  // Une valeur à virgule écrite puis effacée fait passer tableau et champ à leur représentation en nombres à virgule :
  // la première vraie mise à jour n'a plus à convertir (une conversion alloue la nouvelle représentation).
  function former(source) {
    for (const t of [source.p, source.velocity]) for (let k = 0; k < 3; k++) { t[k] = .5; t[k] = 0; }
    source.radius = 6.5; source.radius = 6; source.wake = 10.5; source.wake = 10;
  }
  // Prépare pour n voitures l'état donné (ou un neuf s'il n'y en a pas) et le rend : sources de la réserve en place
  // dans la liste, sans souffle, comme à la création. À appeler au lancement de la séance, hors de la boucle d'images.
  function preparer(etat, n) {
    const e = etat && Array.isArray(etat.reserve) && Array.isArray(etat.sources) ? etat : creer();
    const k = Math.min(e.reserve.length, Number.isFinite(n) ? Math.max(0, Math.floor(n)) : e.reserve.length);
    for (let i = 0; i < e.reserve.length; i++) {
      const source = e.reserve[i];
      former(source);
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
      if (v.abandon || vitesse < .5 || (circuit && B.circuit && B.circuit.dansTunnel && B.circuit.dansTunnel(circuit, e.s, 0))) continue;
      // Le cap dessiné inclut le dérapage de la caisse ; le flux suit la vitesse réelle.
      const capVitesse = p.cap - (Number.isFinite(e.beta) ? e.beta : 0);
      source.velocity[0] = Math.cos(capVitesse) * e.v;
      source.velocity[2] = Math.sin(capVitesse) * e.v;
      source.radius = 6 + 2 * clamp(vitesse / 70, 0, 1);
      source.wake = 10 + Math.min(24, vitesse * .3);
      source.strength = 1; actifs++;
    }
    // la longueur ne change qu'avec le nombre de voitures : la liste garde son stockage d'une image à l'autre
    if (sources.length !== n) sources.length = n;
    etat.actifs = actifs;
    return sources;
  }
  B.sillage = { MAX_SOURCES, creer, preparer, mettreAJour };
})(globalThis.BITUME = globalThis.BITUME || {});
