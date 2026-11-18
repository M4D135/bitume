// Création des animaux dans la page (lot 26) : pour chaque circuit, la scène bâtie par BITUME_JEU.reference, puis
// quatre créations de plus code chaud, et la mémoire des tableaux typés de l'état (grille des habitats surtout).
//   node tools/page-essai.mjs dist/bitume.html docs/reprise/rapports/animaux-2026-11-18/essai-creation.js
// La page doit intégrer src/animaux.js (integration.patch appliqué, page reconstruite).
(async () => {
  const J = BITUME_JEU, A = BITUME.animaux;
  const octets = (o, vu = new Set(), prof = 0) => {
    if (!o || typeof o !== 'object' || vu.has(o) || prof > 5) return 0; vu.add(o);
    if (ArrayBuffer.isView(o)) return o.byteLength;
    let s = 0; for (const k of Object.keys(o)) { if (k === 'c') continue; s += octets(o[k], vu, prof + 1); } return s;
  };
  const base = { qualite: 'high', saison: 'ete', moment: 'jour', meteo: 'soleil', faune: 'profil', vue: 'tele', retro: 'oui' };
  const res = [];
  for (let i = 0; i < 7; i++) {
    const t0 = performance.now(), ref = J.reference(Object.assign({}, base, { circuit: i })), tRef = performance.now() - t0;
    const sc = J.scene, E = J.session.animaux, premiere = A.stats(E, 0).creationMs;
    const t1 = performance.now(); J.reference(Object.assign({}, base, { circuit: i })); const tRef2 = performance.now() - t1;
    const fois = [];
    for (let n = 0; n < 4; n++) { const t = performance.now(); A.creer(sc.c, sc.decor, { saison: sc.saison }); fois.push(Math.round((performance.now() - t) * 10) / 10); }
    res.push({ i, id: ref.circuitId, premiere: Math.round(premiere * 10) / 10, referenceMs: Math.round(tRef), referenceCacheMs: Math.round(tRef2), creerMs: fois, cases: E.G.N, nx: E.G.nx, nz: E.G.nz,
      koGrille: Math.round(octets(E.G) / 1024), koEtat: Math.round(octets(E) / 1024), memeEtat: J.session.animaux === E });
  }
  return res;
})()
