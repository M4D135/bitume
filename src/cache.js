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
    if (donnees instanceof ArrayBuffer) {
      const octets = new Uint8Array(donnees);
      for (let i = 0; i < octets.length; i++) h = Math.imul(h ^ octets[i], 0x01000193);
      return h >>> 0;
    }
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
    try { return typeof indexedDB !== 'undefined' && indexedDB !== null; } catch (_) { return false; }
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
        let bloque = false;
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'cle' });
            store.createIndex('accesAt', 'accesAt', { unique: false });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          if (bloque) { db.close(); return; }
          db.onversionchange = () => db.close();
          resolve(db);
        };
        req.onerror = () => reject(req.error);
        req.onblocked = () => { bloque = true; reject(new Error('IDB bloqué')); };
      } catch (e) {
        reject(e);
      }
    });
  }

  // ─── Opérations IndexedDB ────────────────────────────────────────────────
  function valide(entree) {
    if (!entree || entree.versionSchema !== VERSION_SCHEMA) return false;
    try { return entree.checksum === checksum(entree.valeur); } catch (_) { return false; }
  }
  // Lecture, contrôle et date d'accès dans une seule transaction. Une ancienne lecture
  // ne peut ainsi réinsérer une entrée purgée ou écraser sa régénération dans un autre onglet.
  function _idbLire(db, cle) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite'), store = tx.objectStore(STORE_NAME);
      let valeur = null;
      const req = store.get(cle);
      req.onsuccess = () => {
        const entree = req.result;
        if (!entree) return;
        if (!valide(entree)) { store.delete(cle); return; }
        valeur = entree.valeur; entree.accesAt = Date.now(); store.put(entree);
      };
      tx.oncomplete = () => resolve(valeur);
      tx.onabort = () => reject(tx.error);
    });
  }

  function _idbPut(db, entree) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(entree);
        tx.oncomplete = () => resolve(true);
        tx.onabort = () => reject(tx.error);
      } catch (e) { reject(e); }
    });
  }

  function _idbDelete(db, cle) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(cle);
        tx.oncomplete = () => resolve(true);
        tx.onabort = () => reject(tx.error);
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
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onabort = () => reject(tx.error);
      } catch (e) { reject(e); }
    });
  }

  // ─── Éviction LRU ────────────────────────────────────────────────────────
  // L'index fournit les clés par ordre d'accès sans relire tous les blocs binaires.
  function _evictLRU(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite'), store = tx.objectStore(STORE_NAME);
      const compte = store.count();
      compte.onsuccess = () => {
        let restant = compte.result - MAX_ENTREES;
        if (restant <= 0) return;
        const ordre = store.index('accesAt').openKeyCursor();
        ordre.onsuccess = () => {
          const curseur = ordre.result;
          if (!curseur) return;
          store.delete(curseur.primaryKey);
          if (--restant > 0) curseur.continue();
        };
      };
      tx.oncomplete = () => resolve(true);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function lire(cle) {
    // Backend mémoire prioritaire si fourni
    if (_memoryStore) {
      const entree = _memoryStore.get(cle);
      if (!entree) return null;
      if (!valide(entree)) {
        _memoryStore.delete(cle);
        return null;
      }
      entree.accesAt = Date.now();
      return entree.valeur;
    }

    let db;
    try {
      db = await _ouvrirDB();
      return await _idbLire(db, cle);
    } catch (_) {
      return null;
    } finally { db?.close(); }
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

    let db;
    try {
      db = await _ouvrirDB();
      await _idbPut(db, entree);
      await _evictLRU(db);
      return true;
    } catch (_) {
      return false;
    } finally { db?.close(); }
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

    let db;
    try {
      db = await _ouvrirDB();
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
    } finally { db?.close(); }
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
