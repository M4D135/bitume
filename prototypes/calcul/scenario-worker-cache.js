// Lot 28 « calcul » — essais dans la vraie page (file://) : (1) construire le niveau dans un Web Worker bâti à partir
// des scripts de la page, sans toucher à src/ ; (2) cache persistant du produit (IndexedDB, OPFS) contre régénération.
// __CIRCUIT__ et __PALIER__ sont remplacés par le pilote.
(async () => {
  const CIRCUIT = __CIRCUIT__, PALIER = '__PALIER__';
  const J = BITUME_JEU, B = window.BITUME, K = J.CATALOGUE[CIRCUIT];
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const res = { circuit: K.id, palier: PALIER, origine: location.origin, protocole: location.protocol, crossOriginIsolated: self.crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer };
  // relevé des images pendant les essais : le fil principal reste-t-il libre ?
  const T = []; let marche = true; const tour = t => { if (!marche) return; T.push(t); requestAnimationFrame(tour); }; requestAnimationFrame(tour);
  const pireImage = (a, b) => { let m = 0; for (let k = 1; k < T.length; k++) if (T[k] > a && T[k] <= b) m = Math.max(m, T[k] - T[k - 1]); return +m.toFixed(1); };
  const veut = B.graphismes.melange(PALIER, 0, { decor: PALIER, options: { vegetation: 'profil', faune: 'profil', ombres: 'profil', anticrenelage: 'profil' } }).decor;
  const options = { qualite: PALIER, matieres: veut.matieres, vegetation: veut.vegetation, vegetationQualite: veut.vegetationQualite, saison: 'ete' };
  // champs clonables du décor (les fonctions et fermetures restent à rebâtir : sol, surfaceHerbe)
  const produit = d => ({ nappes: d.nappes, lots: d.lots, obstacles: d.obstacles, atmosphere: d.atmosphere, portique: d.portique, limites: d.limites, enceinte: d.enceinte, arbres: d.arbres, niveauEau: d.niveauEau, vegetation: d.vegetation,
    herbier: d.__herbier ? { triangles: d.__herbier.triangles, aire: d.__herbier.aire } : null });

  // ---------------------------------------------------------------- régénération sur le fil principal (référence)
  await dormir(300);
  let t = performance.now();
  const c = B.circuit.creer(K.graine, { theme: K.theme, longueur: K.longueur, nom: K.nom });
  const d = B.decor.construire(c, options);
  const h = PALIER === 'low' ? null : d.herbier;
  const regenMs = performance.now() - t;
  Object.defineProperty(d, '__herbier', { value: h });
  const P = produit(d);
  res.regenerationFilPrincipalMs = +regenMs.toFixed(0);
  res.pireImagePendantRegenerationMs = (await dormir(100), pireImage(t, performance.now()));
  // clonabilité et taille
  t = performance.now(); let clone = null; try { clone = structuredClone(P); } catch (e) { res.cloneErreur = String(e).slice(0, 200); }
  res.structuredCloneMs = +(performance.now() - t).toFixed(1);
  let octetsTypes = 0; for (const n of d.nappes) octetsTypes += n.sommets.byteLength + n.indices.byteLength;
  res.octetsNappes = octetsTypes; res.objets = d.lots.reduce((a, l) => a + l.objets.length + (l.loin || []).length, 0); res.trianglesHerbier = h ? h.triangles.length : 0;

  // ---------------------------------------------------------------- Web Worker (blob:, scripts de la page)
  try {
    const NOMS = ['graphismes.js', 'carene.js', 'circuit.js', 'botanique.js', 'ecologie.js', 'saisons.js', 'vegetation.js', 'decor.js'];
    const textes = [...document.querySelectorAll('script')].map(s => s.textContent);
    const modules = NOMS.map(n => textes.find(x => x.startsWith('\n// ---- ' + n + ' ----')));
    if (modules.some(m => !m)) throw new Error('scripts introuvables');
    const code = 'self.window = self; self.FRender = { forme: (n) => n };\n' + modules.join('\n') + `
      self.onmessage = e => { const { K, options, plat } = e.data; const t0 = performance.now();
        const B = self.BITUME, c = B.circuit.creer(K.graine, { theme: K.theme, longueur: K.longueur, nom: K.nom });
        const d = B.decor.construire(c, options); const h = options.qualite === 'low' ? null : d.herbier; const t1 = performance.now();
        const transfert = []; for (const n of d.nappes) transfert.push(n.sommets.buffer, n.indices.buffer);
        if (plat) {
          // variante à plat : objets en une chaîne JSON, nappes et herbier en tampons transférés (aucun graphe d'objets à recopier)
          const H = new Float64Array(h ? h.triangles.length * 10 : 0);
          if (h) for (let k = 0; k < h.triangles.length; k++) { const tr = h.triangles[k], o = 10 * k; for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) H[o + 3 * p + q] = tr.points[p][q]; H[o + 9] = tr.aire; }
          const json = JSON.stringify({ lots: d.lots, obstacles: d.obstacles, atmosphere: d.atmosphere, portique: d.portique, limites: d.limites, enceinte: d.enceinte, arbres: d.arbres, niveauEau: d.niveauEau });
          const nappes = d.nappes.map(n => Object.assign({}, n, { sommets: null, indices: null }));
          const t2 = performance.now();
          self.postMessage({ plat: { json, nappesMeta: JSON.stringify(nappes), tampons: d.nappes.map(n => [n.sommets, n.indices]), herbier: H }, calculMs: t1 - t0, aplatirMs: t2 - t1 }, transfert.concat([H.buffer]));
          return;
        }
        const P = { nappes: d.nappes, lots: d.lots, obstacles: d.obstacles, atmosphere: d.atmosphere, portique: d.portique, limites: d.limites, enceinte: d.enceinte, arbres: d.arbres, niveauEau: d.niveauEau, vegetation: d.vegetation,
          herbier: h ? { triangles: h.triangles, aire: h.aire } : null };
        self.postMessage({ P, calculMs: t1 - t0 }, transfert); };`;
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    let tCree = performance.now();
    const w = new Worker(url);
    res.workerCreationMs = +(performance.now() - tCree).toFixed(1);
    const essai = () => new Promise((ok, ko) => {
      const t0 = performance.now();
      w.onerror = e => ko(new Error('worker : ' + e.message));
      w.onmessage = e => { const tRecu = performance.now(); const x = e.data; const tLu = performance.now();
        setTimeout(() => ok({ allerRetourMs: +(tRecu - t0).toFixed(0), lectureMessageMs: +(tLu - tRecu).toFixed(1), calculDansWorkerMs: +x.calculMs.toFixed(0), pireImageFilPrincipalMs: pireImage(t0, performance.now()), nappes: x.P.nappes.length, lots: x.P.lots.length, P: x.P }), 100); };
      w.postMessage({ K: { graine: K.graine, theme: K.theme, longueur: K.longueur, nom: K.nom }, options });
    });
    const e1 = await essai(); await dormir(200); const e2 = await essai(); await dormir(200);
    // variante à plat : coût, sur le fil principal, de la réception et du JSON.parse des objets
    const ePlat = await new Promise((ok, ko) => {
      const t0 = performance.now();
      w.onerror = e => ko(new Error('worker : ' + e.message));
      w.onmessage = e => { const tRecu = performance.now(); const x = e.data; const tLu = performance.now(); const objets = JSON.parse(x.plat.json); const nappes = JSON.parse(x.plat.nappesMeta); const tParse = performance.now();
        setTimeout(() => ok({ allerRetourMs: +(tRecu - t0).toFixed(0), lectureMessageMs: +(tLu - tRecu).toFixed(1), jsonParseMs: +(tParse - tLu).toFixed(1), octetsJson: x.plat.json.length, calculDansWorkerMs: +x.calculMs.toFixed(0), aplatirDansWorkerMs: +x.aplatirMs.toFixed(0),
          pireImageFilPrincipalMs: pireImage(t0, performance.now()), lotsRelus: objets.lots.length, nappesRelues: nappes.length, octetsHerbier: x.plat.herbier.byteLength }), 100); };
      w.postMessage({ K: { graine: K.graine, theme: K.theme, longueur: K.longueur, nom: K.nom }, options, plat: true });
    });
    // identité : mêmes nappes et mêmes objets que sur le fil principal
    let ecarts = 0;
    for (let k = 0; k < d.nappes.length; k++) { const a = d.nappes[k].sommets, b = e2.P.nappes[k].sommets; if (a.length !== b.length) { ecarts++; continue; } for (let q = 0; q < a.length; q++) if (!Object.is(a[q], b[q])) { ecarts++; break; } }
    const jsonA = JSON.stringify(d.lots.slice(0, 50).map(l => l.objets.slice(0, 20))), jsonB = JSON.stringify(e2.P.lots.slice(0, 50).map(l => l.objets.slice(0, 20)));
    delete e1.P; delete e2.P;
    res.worker = { essai1: e1, essai2: e2, plat: ePlat, nappesDifferentes: ecarts, objetsIdentiques: jsonA === jsonB };
    w.terminate(); URL.revokeObjectURL(url);
  } catch (e) { res.worker = { erreur: String(e && e.message || e).slice(0, 300) }; }

  // ---------------------------------------------------------------- IndexedDB
  try {
    const ouvrir = () => new Promise((ok, ko) => { const r = indexedDB.open('calcul28', 1); r.onupgradeneeded = () => r.result.createObjectStore('niveaux'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
    let db = await ouvrir();
    const ecrire = v => new Promise((ok, ko) => { const tx = db.transaction('niveaux', 'readwrite'); tx.objectStore('niveaux').put(v, 'n'); tx.oncomplete = ok; tx.onerror = () => ko(tx.error); });
    const lire = () => new Promise((ok, ko) => { const tx = db.transaction('niveaux', 'readonly'); const r = tx.objectStore('niveaux').get('n'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
    const mesures = []; res.indexedDB = { mesures };
    for (let r = 0; r < 3; r++) {
      let t0 = performance.now(); await ecrire({ cle: '0.2.39|' + K.id + '|' + PALIER, P }); const ecr = performance.now() - t0;
      db.close(); db = await ouvrir();
      await dormir(150); t0 = performance.now(); const v = await lire(); const lu = performance.now() - t0; await dormir(100);
      mesures.push({ ecritureMs: +ecr.toFixed(0), lectureMs: +lu.toFixed(0), pireImageLectureMs: pireImage(t0, performance.now()), relu: !!(v && v.P && v.P.nappes.length === d.nappes.length) });
    }
    // même base, produit à plat : tampons binaires et une chaîne JSON (pas de graphe d'objets à sérialiser)
    const H = h ? new Float64Array(h.triangles.length * 10) : new Float64Array(0);
    if (h) for (let k = 0; k < h.triangles.length; k++) { const tr = h.triangles[k], o = 10 * k; for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) H[o + 3 * p + q] = tr.points[p][q]; H[o + 9] = tr.aire; }
    let t0 = performance.now();
    const plat = { json: JSON.stringify({ lots: d.lots.map(l => Object.assign({}, l, { paquet: undefined, paquetLoin: undefined, tampon: undefined, tamponLoin: undefined })), obstacles: d.obstacles }),
      tampons: d.nappes.map(n => [n.sommets.slice().buffer, n.indices.slice().buffer]), herbier: H.buffer };
    const aplatirMs = performance.now() - t0;
    const mesuresPlat = []; res.indexedDB.plat = { aplatirMs: +aplatirMs.toFixed(0), octetsJson: plat.json.length, mesures: mesuresPlat };
    for (let r = 0; r < 3; r++) {
      t0 = performance.now(); await ecrire({ cle: '0.2.39|' + K.id + '|' + PALIER + '|plat', plat }); const ecr = performance.now() - t0;
      db.close(); db = await ouvrir();
      await dormir(150); t0 = performance.now(); const v = await lire(); const lu = performance.now() - t0;
      const t1 = performance.now(); const objets = JSON.parse(v.plat.json); const parse = performance.now() - t1; await dormir(100);
      mesuresPlat.push({ ecritureMs: +ecr.toFixed(0), lectureMs: +lu.toFixed(0), jsonParseMs: +parse.toFixed(0), pireImageLectureMs: pireImage(t0, performance.now()), lotsRelus: objets.lots.length });
    }
    // tout en binaire : objets des lots en Float32Array (forme, p, s, r, couleur, matière, détail), comme le ferait un cache conçu pour ça
    const Z3 = [0, 0, 0]; const formes = []; const idx = new Map(); let nObj = 0; for (const l of d.lots) nObj += l.objets.length + (l.loin || []).length;
    t0 = performance.now();
    const F = new Float32Array(nObj * 15), L = new Uint32Array(d.lots.length * 2); let o = 0, q = 0;
    for (const l of d.lots) { L[q++] = l.objets.length; L[q++] = (l.loin || []).length; for (const ob of l.objets.concat(l.loin || [])) { let k = idx.get(ob.shape); if (k === undefined) { idx.set(ob.shape, k = formes.length); formes.push(ob.shape); } const P3 = ob.p || Z3, S3 = ob.s || Z3, R3 = ob.r || Z3, C3 = ob.color || Z3; F[o] = k; F[o + 1] = P3[0]; F[o + 2] = P3[1]; F[o + 3] = P3[2]; F[o + 4] = S3[0]; F[o + 5] = S3[1]; F[o + 6] = S3[2]; F[o + 7] = R3[0]; F[o + 8] = R3[1]; F[o + 9] = R3[2]; F[o + 10] = C3[0]; F[o + 11] = C3[1]; F[o + 12] = C3[2]; F[o + 13] = ob.mat || 0; F[o + 14] = ob.detail || 0; o += 15; } }
    const binaire = { formes, F: F.buffer, L: L.buffer, tampons: plat.tampons, herbier: plat.herbier };
    const encoderBinaireMs = performance.now() - t0;
    const mesuresBinaire = []; res.indexedDB.binaire = { encoderMs: +encoderBinaireMs.toFixed(0), objets: nObj, mesures: mesuresBinaire };
    for (let r = 0; r < 3; r++) {
      t0 = performance.now(); await ecrire({ cle: '0.2.39|' + K.id + '|' + PALIER + '|binaire', binaire }); const ecr = performance.now() - t0;
      db.close(); db = await ouvrir();
      await dormir(150); t0 = performance.now(); const v = await lire(); const lu = performance.now() - t0;
      // reconstitution des objets tels que le jeu les attend aujourd'hui
      const t1 = performance.now(); const G = new Float32Array(v.binaire.F), M = new Uint32Array(v.binaire.L), fo = v.binaire.formes; const lots = []; let a = 0;
      for (let k = 0; k < M.length; k += 2) { const objets = [], loin = []; for (let n = 0; n < M[k] + M[k + 1]; n++, a += 15) (n < M[k] ? objets : loin).push({ shape: fo[G[a]], p: [G[a + 1], G[a + 2], G[a + 3]], s: [G[a + 4], G[a + 5], G[a + 6]], r: [G[a + 7], G[a + 8], G[a + 9]], mat: G[a + 13], color: [G[a + 10], G[a + 11], G[a + 12]], detail: G[a + 14] }); lots.push({ objets, loin }); }
      const recon = performance.now() - t1; await dormir(100);
      mesuresBinaire.push({ ecritureMs: +ecr.toFixed(0), lectureMs: +lu.toFixed(0), reconstitutionObjetsMs: +recon.toFixed(0), pireImageLectureMs: pireImage(t0, performance.now()), lotsRelus: lots.length });
    }
    res.indexedDB = { mesures, plat: { aplatirMs: +aplatirMs.toFixed(0), octetsJson: plat.json.length, octetsBinaires: plat.tampons.reduce((a, [s, i]) => a + s.byteLength + i.byteLength, 0) + H.byteLength, mesures: mesuresPlat },
      binaire: { encoderMs: +encoderBinaireMs.toFixed(0), octets: F.byteLength + L.byteLength + plat.tampons.reduce((a, [s, i]) => a + s.byteLength + i.byteLength, 0) + H.byteLength, objets: nObj, formes: formes.length, mesures: mesuresBinaire } };
    db.close(); await new Promise(ok => { const r = indexedDB.deleteDatabase('calcul28'); r.onsuccess = r.onerror = r.onblocked = ok; });
  } catch (e) { res.indexedDB = Object.assign(res.indexedDB || {}, { erreur: String(e && e.message || e).slice(0, 300) }); }

  // ---------------------------------------------------------------- OPFS (binaire à plat + objets en JSON)
  try {
    const racine = await navigator.storage.getDirectory();
    // encodage : nappes et triangles de l'herbier en binaire, objets des lots en JSON
    let t0 = performance.now();
    const parties = [];
    for (const n of d.nappes) { parties.push(n.sommets, n.indices); }
    const H = h ? new Float64Array(h.triangles.length * 10) : new Float64Array(0);
    if (h) for (let k = 0; k < h.triangles.length; k++) { const tr = h.triangles[k], o = 10 * k; H[o] = tr.points[0][0]; H[o + 1] = tr.points[0][1]; H[o + 2] = tr.points[0][2]; H[o + 3] = tr.points[1][0]; H[o + 4] = tr.points[1][1]; H[o + 5] = tr.points[1][2]; H[o + 6] = tr.points[2][0]; H[o + 7] = tr.points[2][1]; H[o + 8] = tr.points[2][2]; H[o + 9] = tr.aire; }
    parties.push(H);
    const json = JSON.stringify({ lots: d.lots.map(l => Object.assign({}, l, { paquet: undefined, paquetLoin: undefined, tampon: undefined, tamponLoin: undefined })), obstacles: d.obstacles });
    const blob = new Blob([...parties, json]);
    const encodageMs = performance.now() - t0;
    const mesures = [];
    for (let r = 0; r < 3; r++) {
      t0 = performance.now();
      const f = await racine.getFileHandle('niveau-' + K.id + '.bin', { create: true });
      const wr = await f.createWritable(); await wr.write(blob); await wr.close();
      const ecr = performance.now() - t0;
      t0 = performance.now();
      const g = await (await racine.getFileHandle('niveau-' + K.id + '.bin')).getFile();
      const buf = await g.arrayBuffer();
      const lu = performance.now() - t0;
      t0 = performance.now();
      const texte = new TextDecoder().decode(new Uint8Array(buf, buf.byteLength - new Blob([json]).size));
      const objets = JSON.parse(texte);
      const decodage = performance.now() - t0;
      mesures.push({ ecritureMs: +ecr.toFixed(0), lectureMs: +lu.toFixed(0), decodageJsonMs: +decodage.toFixed(0), octets: buf.byteLength, lotsRelus: objets.lots.length });
    }
    res.opfs = { encodageMs: +encodageMs.toFixed(0), octetsJson: json.length, mesures, estimation: await navigator.storage.estimate().then(e => ({ quota: e.quota, usage: e.usage })).catch(e => String(e)), persiste: await navigator.storage.persisted().catch(e => String(e)) };
    await racine.removeEntry('niveau-' + K.id + '.bin');
  } catch (e) { res.opfs = { erreur: String(e && e.message || e).slice(0, 300) }; }
  marche = false;
  return res;
})()
