(function (B) {
  'use strict';
  // Sources aérodynamiques communes à toutes les vues ; aucun parcours de plantes.
  const MAX_SOURCES = 16;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function creer(capacite = MAX_SOURCES) {
    const n = Number.isFinite(capacite) ? clamp(Math.floor(capacite), 0, MAX_SOURCES) : MAX_SOURCES;
    const reserve = Array.from({ length: n }, (_, id) => ({
      id, p: [0, 0, 0], velocity: [0, 0, 0], radius: 6, strength: 0, wake: 10,
    }));
    return { reserve, sources: [], actifs: 0 };
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
    sources.length = n; etat.actifs = actifs;
    return sources;
  }
  B.sillage = { MAX_SOURCES, creer, mettreAJour };
})(globalThis.BITUME = globalThis.BITUME || {});
