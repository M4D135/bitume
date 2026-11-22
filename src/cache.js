'use strict';

(function () {
  const B = (globalThis.BITUME = globalThis.BITUME || {});

  const VERSION_SCHEMA = 1;
  const DB_NAME = 'bitume-cache-v1';
  const STORE_NAME = 'entrees';
  const MAX_ENTREES = 12;

  // ─── FNV-1a 32-bit ───────────────────────────────────────────────────────
  function checksum(donnees) {
    let h = 0x811c9dc5;
    const str = typeof donnees === 'string' ? donnees : JSON.stringify(donnees);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
      h = h >>> 0;
    }
    return h >>> 0;
  }

  // ─── Clé déterministe ────────────────────────────────────────────────────
  function cleDecor(circuitId, graine, qualite, saisonId, versionBuild) {
    return `decor:${circuitId}:${graine}:${qualite}:${saisonId}:${versionBuild}`;
  }

  // ─── Détection IndexedDB ─────────────────────────────────────────────────
  function disponible() {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  }

  // ─── Backend mémoire (fallback / tests) ──────────────────────────────────
  let _memoryStore = null;

  function _getMemoryStore() {
    if (!_memoryStore) _memoryStore = new Map();
    return _memoryStore;
  }

  // ─── Ouverture IndexedDB ─────────────────────────────────────────────────
  function _ouvrirDB() {
    return new Promise((resolve, reject) => {
      if (!disponible()) { reject(new Error('IDB absent')); return; }
      try {
        const req = indexedDB.open(DB_NAME, VERSION_SCHEMA);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'cle' });
            store.createIndex('accesAt', 'accesAt', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IDB bloqué'));
      } catch (e) {
        reject(e);
      }
    });
  }

  // ─── Opérations IndexedDB ────────────────────────────────────────────────
  function _idbGet(db, cle) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(cle);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  function _idbPut(db, entree) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(entree);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  function _idbDelete(db, cle) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(cle);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  function _idbAll(db) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  function _idbClear(db) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  // ─── Éviction LRU ────────────────────────────────────────────────────────
  async function _evictLRU(db) {
    try {
      const all = await _idbAll(db);
      if (all.length <= MAX_ENTREES) return;
      all.sort((a, b) => (a.accesAt || 0) - (b.accesAt || 0));
      const aSupprimer = all.slice(0, all.length - MAX_ENTREES);
      for (const e of aSupprimer) {
        await _idbDelete(db, e.cle);
      }
    } catch (_) { /* silencieux */ }
  }

  // ─── API publique ────────────────────────────────────────────────────────
  async function lire(cle) {
    // Backend mémoire prioritaire si fourni
    if (_memoryStore) {
      const entree = _memoryStore.get(cle);
      if (!entree) return null;
      if (entree.checksum !== checksum(entree.valeur)) {
        _memoryStore.delete(cle);
        return null;
      }
      entree.accesAt = Date.now();
      return entree.valeur;
    }

    try {
      const db = await _ouvrirDB();
      const entree = await _idbGet(db, cle);
      if (!entree) return null;
      // Vérification intégrité
      if (entree.checksum !== checksum(entree.valeur)) {
        await _idbDelete(db, cle);
        return null;
      }
      // Vérification version
      if (entree.versionSchema !== VERSION_SCHEMA) {
        await _idbDelete(db, cle);
        return null;
      }
      // Mise à jour LRU
      entree.accesAt = Date.now();
      await _idbPut(db, entree);
      return entree.valeur;
    } catch (_) {
      return null;
    }
  }

  async function ecrire(cle, valeur, meta = {}) {
    const entree = {
      cle,
      valeur,
      checksum: checksum(valeur),
      versionSchema: VERSION_SCHEMA,
      accesAt: Date.now(),
      creeAt: Date.now(),
      meta
    };

    // Backend mémoire
    if (_memoryStore) {
      _memoryStore.set(cle, entree);
      // LRU mémoire
      if (_memoryStore.size > MAX_ENTREES) {
        const entries = [..._memoryStore.entries()]
          .sort((a, b) => (a[1].accesAt || 0) - (b[1].accesAt || 0));
        const excess = entries.slice(0, _memoryStore.size - MAX_ENTREES);
        for (const [k] of excess) _memoryStore.delete(k);
      }
      return true;
    }

    try {
      const db = await _ouvrirDB();
      await _idbPut(db, entree);
      await _evictLRU(db);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function purger(prefixeOuVersion = null) {
    // Backend mémoire
    if (_memoryStore) {
      if (prefixeOuVersion === null) {
        _memoryStore.clear();
        return true;
      }
      if (typeof prefixeOuVersion === 'string') {
        for (const k of [..._memoryStore.keys()]) {
          if (k.startsWith(prefixeOuVersion)) _memoryStore.delete(k);
        }
      } else if (typeof prefixeOuVersion === 'number') {
        for (const [k, v] of [..._memoryStore.entries()]) {
          if (v.versionSchema !== prefixeOuVersion) _memoryStore.delete(k);
        }
      }
      return true;
    }

    try {
      const db = await _ouvrirDB();
      if (prefixeOuVersion === null) {
        await _idbClear(db);
        return true;
      }
      const all = await _idbAll(db);
      for (const e of all) {
        if (typeof prefixeOuVersion === 'string' && e.cle.startsWith(prefixeOuVersion)) {
          await _idbDelete(db, e.cle);
        } else if (typeof prefixeOuVersion === 'number' && e.versionSchema !== prefixeOuVersion) {
          await _idbDelete(db, e.cle);
        }
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  // ─── Injection backend mémoire pour tests ────────────────────────────────
  function _setMemoryStore(store) {
    _memoryStore = store || null;
  }

  B.cache = {
    disponible,
    lire,
    ecrire,
    purger,
    cleDecor,
    checksum,
    // Exposé pour tests unitaires
    _setMemoryStore,
    VERSION_SCHEMA,
    MAX_ENTREES
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.cache;
