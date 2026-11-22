// Ce mode du banc utilise son profil Chrome jetable. Les cinq chargements passent par
// la préparation des menus, dans le même onglet et la même origine.
import assert from 'node:assert/strict';
import { attendreDemarrage } from './controle-visuel.mjs';

async function mesurer(mode) {
  const B = window.BITUME, J = window.BITUME_JEU;
  const circuit = J.CATALOGUE.findIndex(c => c.id === 'larche');
  J.reglages.faune = 'off';
  J.pauseAuto = false;
  if (mode === 'corrompu') {
    const db = await new Promise((ok, ko) => {
      const r = indexedDB.open('bitume-cache-v1');
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    });
    try {
      await new Promise((ok, ko) => {
        const tx = db.transaction('entrees', 'readwrite'), store = tx.objectStore('entrees');
        const req = store.openCursor();
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) { tx.abort(); return; }
          if (!cur.key.startsWith('panorama-v1:')) { cur.continue(); return; }
          const e = cur.value; new Uint8Array(e.valeur)[100] ^= 128; cur.update(e);
        };
        tx.oncomplete = ok; tx.onabort = () => ko(tx.error || Error('aucun panorama à altérer'));
      });
    } finally { db.close(); }
  }
  if (mode === 'refus') Object.defineProperty(window, 'indexedDB', { configurable: true,
    get() { throw new DOMException('Refus du banc', 'SecurityError'); } });
  if (mode === 'lecture-suspendue') B.cache.lire = () => new Promise(() => {});
  let constructions = 0;
  const construire = B.larcheRelief.construire;
  B.larcheRelief.construire = (...args) => { constructions++; return construire(...args); };
  const r = await J.preparer({ type: 'course', circuit, conditions: { meteo: 'soleil', moment: 'jour', saison: 'ete' } });
  if (r.erreur || r.annule) throw Error(r.erreur || 'préparation annulée');
  const debut = performance.now();
  while (r.cachePanorama?.source === 'calcul' && r.cachePanorama.ecriture === null && performance.now() - debut < 10000)
    await new Promise(ok => setTimeout(ok, 60));
  const nappes = J.scene.decor.nappes.filter(n => n.surfaceType === 'panorama');
  let empreinte = 0x811c9dc5;
  for (const n of nappes) for (const v of [n.sommets, n.indices])
    for (const octet of new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
      empreinte = Math.imul(empreinte ^ octet, 0x01000193);
  return { mode, ecran: J.ecran, constructions, nappes: nappes.length, empreinte: empreinte >>> 0,
    panorama: r.cachePanorama || null, decorMs: r.etapes.find(v => v.nom === 'decor')?.ms, totalMs: r.totalMs };
}

export async function controlerCachePanorama(evaluer, envoyer, attente) {
  const essais = [];
  for (const mode of ['vierge', 'reouverture', 'corrompu', 'refus', 'lecture-suspendue']) {
    if (essais.length) {
      // Marquer l'ancienne page pour distinguer l'achèvement de la navigation du titre déjà affiché.
      await evaluer('window.__avantRechargementCache = true');
      await envoyer('Page.reload', { ignoreCache: true });
      const fin = Date.now() + attente;
      while (await evaluer('window.__avantRechargementCache === true').catch(() => true)) {
        if (Date.now() > fin) throw Error('rechargement de page expiré');
        await new Promise(ok => setTimeout(ok, 80));
      }
    }
    await attendreDemarrage(evaluer, attente);
    const essai = await evaluer('(' + mesurer.toString() + ')(' + JSON.stringify(mode) + ')');
    assert.equal(essai.ecran, 'course'); assert.ok(essai.nappes > 0);
    assert.equal(essai.constructions, mode === 'reouverture' ? 0 : 1);
    if (essais.length) assert.deepEqual([essai.nappes, essai.empreinte], [essais[0].nappes, essais[0].empreinte]);
    if (mode === 'reouverture') assert.equal(essai.panorama.source, 'indexeddb');
    else if (mode === 'refus') assert.equal(essai.panorama, null);
    else if (mode === 'lecture-suspendue') assert.equal(essai.panorama.ecriture, false);
    else assert.equal(essai.panorama.ecriture, true);
    essais.push(essai);
  }
  return essais;
}
