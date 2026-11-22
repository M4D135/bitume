// Couronne alpine visuelle. Un seul bloc binaire stocke les géométries, aucun objet WebGL ou PhysX.
(function (B) {
  'use strict';
  const MAGIC = 0x31524150, ENTREE = 40;
  function encoder(nappes) {
    let octets = 8 + ENTREE * nappes.length;
    for (const n of nappes) octets += n.sommets.byteLength + n.indices.byteLength;
    const bloc = new ArrayBuffer(octets), enTete = new DataView(bloc);
    enTete.setUint32(0, MAGIC, true); enTete.setUint32(4, nappes.length, true);
    let pos = 8 + ENTREE * nappes.length;
    for (let i = 0; i < nappes.length; i++) {
      const n = nappes[i], t = 8 + ENTREE * i;
      enTete.setUint32(t, n.sommets.length, true); enTete.setUint32(t + 4, n.indices.length, true);
      for (let k = 0; k < 3; k++) enTete.setFloat64(t + 8 + 8 * k, n.centre[k], true);
      enTete.setFloat64(t + 32, n.rayon, true);
      new Float32Array(bloc, pos, n.sommets.length).set(n.sommets); pos += n.sommets.byteLength;
      new Uint32Array(bloc, pos, n.indices.length).set(n.indices); pos += n.indices.byteLength;
    }
    return bloc;
  }
  function decoder(bloc) {
    if (!(bloc instanceof ArrayBuffer) || bloc.byteLength < 8) return null;
    const vue = new DataView(bloc), n = vue.getUint32(4, true);
    let pos = 8 + ENTREE * n;
    if (vue.getUint32(0, true) !== MAGIC || !n || pos > bloc.byteLength) return null;
    const nappes = [];
    for (let i = 0; i < n; i++) {
      const t = 8 + ENTREE * i, ns = vue.getUint32(t, true), ni = vue.getUint32(t + 4, true);
      if (!ns || ns % 13 || !ni || ni % 3 || pos + (ns + ni) * 4 > bloc.byteLength) return null;
      const centre = [vue.getFloat64(t + 8, true), vue.getFloat64(t + 16, true), vue.getFloat64(t + 24, true)];
      const rayon = vue.getFloat64(t + 32, true);
      if (!centre.every(Number.isFinite) || !Number.isFinite(rayon) || rayon <= 0) return null;
      const sommets = new Float32Array(bloc, pos, ns); pos += ns * 4;
      const indices = new Uint32Array(bloc, pos, ni); pos += ni * 4;
      for (const index of indices) if (index >= ns / 13) return null;
      for (let k = 0; k < ns; k++) if (!Number.isFinite(sommets[k])) return null;
      const nappe = { centre, rayon, sommets, indices };
      Object.defineProperty(nappe, 'surfaceType', { value: 'panorama' });
      nappes.push(nappe);
    }
    return pos === bloc.byteLength ? nappes : null;
  }

  // La lecture part au lever du voile. Si le terrain est prêt avant IndexedDB,
  // il emprunte immédiatement le générateur et garde sa propre copie des nappes.
  function ouvrir(cle) {
    const cache = { cle, choisi: false, nappes: null, present: null,
      rapport: { source: 'calcul', lectureMs: null, constructionMs: null, octets: 0, ecriture: null } };
    const t = performance.now();
    cache.lecture = B.cache.lire(cle).then(bloc => {
      const nappes = decoder(bloc);
      if (nappes) {
        cache.rapport.octets = bloc.byteLength;
        if (!cache.choisi) cache.nappes = nappes;
      }
      cache.rapport.lectureMs = performance.now() - t;
      cache.present = !!nappes;
      return cache.present;
    }).catch(() => { cache.present = false; return false; });
    return cache;
  }
  function obtenir(cache, construire) {
    if (!cache) return construire();
    cache.choisi = true;
    if (cache.nappes) { cache.rapport.source = 'indexeddb'; return cache.nappes; }
    const t = performance.now();
    cache.nappes = construire(); cache.rapport.constructionMs = performance.now() - t;
    return cache.nappes;
  }
  function conserver(cache) {
    if (!cache?.choisi) return;
    const nappes = cache.nappes;
    cache.nappes = null;
    if (cache.present === true) {
      cache.rapport.ecriture = false;
      return;
    }
    const ecrire = async () => {
      try {
        // Une ouverture encore bloquée après la première image sera retentée lors
        // d'une autre visite. Ne pas retenir le panorama dans une promesse suspendue.
        if (cache.present !== false) { cache.rapport.ecriture = false; return; }
        const bloc = encoder(nappes);
        cache.rapport.octets = bloc.byteLength;
        cache.rapport.ecriture = await B.cache.ecrire(cache.cle, bloc);
      } catch (_) { cache.rapport.ecriture = false; }
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(ecrire);
    else setTimeout(ecrire, 0);
  }
  B.panoramaCache = { ouvrir, obtenir, conserver, encoder, decoder };
})(globalThis.BITUME = globalThis.BITUME || {});
