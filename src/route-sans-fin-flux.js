// Flux asynchrone « Route sans fin » : préparation hors fil principal (Web Worker auto-extrait)
// du prochain tronçon de circuit, de son décor complet, de l'herbier, de la grille faune et des
// tampons statiques PhysX, suivie d'une cuisson PhysX par micro-tranches (< 1,6 ms/image) avant bascule.
// Élimine tout gel à l'approche des checkpoints et des stations-service (60 IPS continus).
(function (B) {
  'use strict';

  const MODULES_WORKER = [
    'ferro/render-shared.js',
    'circuit.js',
    'couverts.js',
    'circuit-raccords-data.js',
    'circuit-raccords.js',
    'route-sans-fin.js',
    'route-sans-fin-fenetre.js',
    'route-des-cimes.js',
    'route-des-cimes-decor.js',
    'larche-vinadio-data.js',
    'larche-vinadio.js',
    'larche-relief.js',
    'coniferes-alpins.js',
    'pietraporzio-data.js',
    'argentera-data.js',
    'pietraporzio.js',
    'larche-vinadio-decor.js',
    'marseille.js',
    'marseille-decor.js',
    'destinations.js',
    'virages.js',
    'chaussee.js',
    'obstacles.js',
    'botanique.js',
    'ecologie.js',
    'saisons.js',
    'vegetation.js',
    'bosquets.js',
    'bords.js',
    'baikal.js',
    'batiments.js',
    'lieux.js',
    'herbier-wasm.js',
    'lagon.js',
    'ovale-forges-decor.js',
    'signalisation-course.js',
    'mouvements-stand-data.js',
    'mouvements-stand.js',
    'equipe-stands.js',
    'decor.js',
    'solides-physx.js',
    'animaux.js'
  ];

  const MAILLE_HERBIER = 32;
  const maintenant = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function cleCaseHerbier(x, z) { return (x + 1048576) * 2097152 + (z + 1048576); }

  // Sérialise les triangles de `decor.herbier` en un Float32Array compact (19 flottants/triangle)
  // pour un transfert sans copie vers le fil principal.
  function empaqueterHerbier(herbier) {
    if (!herbier || !Array.isArray(herbier.triangles) || !herbier.triangles.length) return null;
    const T = herbier.triangles, n = T.length, plat = new Float32Array(n * 19);
    for (let i = 0, o = 0; i < n; i++) {
      const t = T[i], p0 = t.points[0], p1 = t.points[1], p2 = t.points[2], nrm = t.normal, col = t.color, pl = t.plan;
      plat[o++] = p0[0]; plat[o++] = p0[1]; plat[o++] = p0[2];
      plat[o++] = p1[0]; plat[o++] = p1[1]; plat[o++] = p1[2];
      plat[o++] = p2[0]; plat[o++] = p2[1]; plat[o++] = p2[2];
      plat[o++] = nrm[0]; plat[o++] = nrm[1]; plat[o++] = nrm[2];
      plat[o++] = col[0]; plat[o++] = col[1]; plat[o++] = col[2];
      plat[o++] = pl.h; plat[o++] = pl.dx; plat[o++] = pl.dz;
      plat[o++] = t.type === 'accotement' ? 1 : 0;
    }
    return plat;
  }

  function surfaceHerbeDepuisPlat(plat) {
    if (!plat || !plat.length) return () => null;
    const nT = (plat.length / 19) | 0;
    const grille = new Map();
    const normales = new Array(nT), couleurs = new Array(nT);
    for (let k = 0; k < nT; k++) {
      const o = k * 19;
      normales[k] = [plat[o + 9], plat[o + 10], plat[o + 11]];
      couleurs[k] = [plat[o + 12], plat[o + 13], plat[o + 14]];
      const x0 = Math.floor(Math.min(plat[o], plat[o + 3], plat[o + 6]) / MAILLE_HERBIER);
      const x1 = Math.floor(Math.max(plat[o], plat[o + 3], plat[o + 6]) / MAILLE_HERBIER);
      const z0 = Math.floor(Math.min(plat[o + 2], plat[o + 5], plat[o + 8]) / MAILLE_HERBIER);
      const z1 = Math.floor(Math.max(plat[o + 2], plat[o + 5], plat[o + 8]) / MAILLE_HERBIER);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const cle = cleCaseHerbier(x, z), ids = grille.get(cle);
        if (ids) ids.push(k); else grille.set(cle, [k]);
      }
    }
    return function surface(x, z, sortie = {}) {
      let meilleur = -1, hauteur = -Infinity;
      const ids = grille.get(cleCaseHerbier(Math.floor(x / MAILLE_HERBIER), Math.floor(z / MAILLE_HERBIER)));
      if (ids) for (let q = 0; q < ids.length; q++) {
        const k = ids[q], o = k * 19;
        const ax = plat[o], az = plat[o + 2], bx = plat[o + 3], bz = plat[o + 5], cx = plat[o + 6], cz = plat[o + 8];
        const abx = bx - ax, abz = bz - az, acx = cx - ax, acz = cz - az, det = abx * acz - abz * acx;
        const u = ((x - ax) * acz - (z - az) * acx) / det, v = (abx * (z - az) - abz * (x - ax)) / det;
        if (u < -1e-6 || v < -1e-6 || u + v > 1.000001) continue;
        const y = plat[o + 15] + plat[o + 16] * x + plat[o + 17] * z;
        if (y > hauteur) { hauteur = y; meilleur = k; }
      }
      if (meilleur < 0) return null;
      const o = meilleur * 19;
      sortie.y = hauteur;
      sortie.normal = normales[meilleur];
      sortie.color = couleurs[meilleur];
      sortie.type = plat[o + 18] > .5 ? 'accotement' : 'terrain';
      if (sortie.rayonPied !== undefined) {
        let rayon = .2;
        for (let j = 0; j < 3; j++) {
          const ja = o + j * 3, jb = o + ((j + 1) % 3) * 3;
          const ax = plat[ja], az = plat[ja + 2], dx = plat[jb] - ax, dz = plat[jb + 2] - az;
          rayon = Math.min(rayon, Math.abs(dx * (z - az) - dz * (x - ax)) / Math.max(.0001, Math.sqrt(dx * dx + dz * dz)));
        }
        sortie.rayonPied = rayon;
      }
      return sortie;
    };
  }

  function creerSolDepuisMaillage(M) {
    if (!M || !M.H) return () => 0;
    const { x0, z0, nx, nz, pas, alterne, H } = M;
    return function sol(x, z) {
      const fi = (x - x0) / pas, fj = (z - z0) / pas;
      const i = Math.max(0, Math.min(nx - 2, Math.floor(fi))), j = Math.max(0, Math.min(nz - 2, Math.floor(fj)));
      const u = Math.max(0, Math.min(1, fi - i)), v = Math.max(0, Math.min(1, fj - j));
      const h00 = H[j * nx + i], h10 = H[j * nx + i + 1], h01 = H[(j + 1) * nx + i], h11 = H[(j + 1) * nx + i + 1];
      if (alterne && ((i + j) & 1)) {
        return u + v <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
      }
      return h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v;
    };
  }

  function construireCircuitFenetre(BRef, req) {
    const R = BRef.routeSansFin;
    const { graine, k0, k1, sOrigine, station } = req;
    const trace = R.creerTrace(k0, k1, graine);
    const c = BRef.circuit.creerDepuisTrace(trace, { topologie: 'ouvert' });
    BRef.circuit.preparerParcours(c);
    c.sauts = R.sautsFenetre(trace, c);
    c.graine = graine;
    c.theme = R.pointsSegment(k0, graine).profil.theme;
    const tronconsThemes = [];
    let sAcc = 0, sBrut = 0;
    for (let k = k0; k < k1; k++) sBrut += R.pointsSegment(k, graine).profil.L;
    const echelle = sBrut > 0 ? c.longueur / sBrut : 1;
    for (let k = k0; k < k1; k++) {
      const p = R.pointsSegment(k, graine).profil, dL = p.L * echelle;
      tronconsThemes.push({ theme: p.theme, biome: p.biome, debut: sAcc, fin: Math.min(c.longueur, sAcc + dL) });
      sAcc += dL;
    }
    if (tronconsThemes.length) tronconsThemes[tronconsThemes.length - 1].fin = c.longueur;
    c.tronconsThemes = tronconsThemes;
    const pasCp = 1500, cps = [];
    const premierCp = Math.max(1, Math.ceil((sOrigine + 10) / pasCp));
    for (let m = premierCp; m * pasCp <= sOrigine + c.longueur - 10; m++) {
      cps.push({ s: m * pasCp - sOrigine, sAbs: m * pasCp, numero: m });
    }
    c.checkpointsSansFin = cps;
    c.sansFinFenetre = { k0, k1, sOrigine };
    if (station) {
      c.stands = {
        debut: station.debutAbs - sOrigine, fin: station.finAbs - sOrigine,
        garage0: station.garage0 - sOrigine, garage1: station.garage1 - sOrigine,
        cote: station.cote, vitesse: 11
      };
      BRef.circuit.preparerStands(c);
    } else c.stands = null;
    return c;
  }

  // Les étapes de la préparation : l'ouvrier les enchaîne d'un trait, le repli sans ouvrier en joue une par image.
  function* etapesPreparation(BRef, req, pourOuvrier) {
    const c = construireCircuitFenetre(BRef, req);
    yield 'circuit';
    // sans ouvrier, l'herbier et la prairie se bâtissent aussi par tranches de quelques millisecondes (une par image)
    const decor = BRef.decor.construireEtapes
      ? yield* BRef.decor.construireEtapes(c, req.decorOptions, pourOuvrier ? null : { budget: 6 })
      : BRef.decor.construire(c, req.decorOptions);
    yield 'decor';
    if (BRef.obstacles) c.obstacles = BRef.obstacles.creer(decor.obstacles);
    const vegetationQualite = req.decorOptions.vegetationQualite;
    const besoinHerbier = req.decorOptions.vegetation !== false && vegetationQualite !== 'off' && vegetationQualite !== 'low';
    const herbierPlat = besoinHerbier ? empaqueterHerbier(decor.herbier) : null;
    yield 'herbier';
    const extraitPhysX = BRef.solidesPhysX.extraire(c, decor);
    yield 'physx';
    const grilleAnimaux = !(req.avecAnimaux && BRef.animaux?.grille) ? null
      : BRef.animaux.grilleEtapes ? yield* BRef.animaux.grilleEtapes(c, decor, pourOuvrier ? null : { budget: 6 })
        : BRef.animaux.grille(c, decor);
    if (grilleAnimaux) { grilleAnimaux.lagon = null; grilleAnimaux.T = null; }
    yield 'animaux';
    const maillageSol = decor.maillageSol || null;
    const saisonId = decor.saison?.id || req.decorOptions.saison || null;
    const sourcesFeuilles = decor.sourcesFeuilles || [];
    const qualite = decor.qualite || req.decorOptions.qualite;
    // Purger toute fonction ou accesseur non clonable avant postMessage
    const decorPur = {
      mobilesPhysX: decor.mobilesPhysX || [],
      nappes: (decor.nappes || []).map(n => ({
        sommets: n.sommets,
        indices: n.indices,
        vertexTint: n.vertexTint,
        surfaceType: n.surfaceType || null
      })),
      // les lots progressifs des bosquets partent avec leur semis, sans leurs fonctions de préparation
      lots: pourOuvrier && BRef.bosquets && BRef.bosquets.serialiser ? decor.lots.map(BRef.bosquets.serialiser) : decor.lots,
      railsVirages: decor.railsVirages,
      atmosphere: decor.atmosphere,
      portique: decor.portique,
      obstacles: decor.obstacles,
      niveauEau: decor.niveauEau,
      limites: decor.limites,
      theme: decor.theme,
      arbres: decor.arbres,
      enceinte: decor.enceinte,
      tunnelLampes: decor.tunnelLampes || null,
      vegetation: decor.vegetation || null
    };
    return { c, decorPur, maillageSol, saisonId, sourcesFeuilles, qualite, herbierPlat, extraitPhysX, grilleAnimaux };
  }
  function executerPreparationCPU(BRef, req, pourOuvrier) {
    const g = etapesPreparation(BRef, req, pourOuvrier);
    for (;;) { const r = g.next(); if (r.done) return r.value; }
  }

  // L'ouvrier envoie les lots par paquets d'environ POIDS_PAQUET objets : le fil principal
  // désérialise un paquet par image au lieu de tout le décor d'un coup.
  const POIDS_PAQUET = 1200;
  function decouperLots(lots) {
    const paquets = [];
    let courant = [], poids = 0;
    for (const l of lots || []) {
      const p = 1 + (l && l.objets ? l.objets.length : 0) + (l && l.loin ? l.loin.length : 0);
      if (courant.length && poids + p > POIDS_PAQUET) { paquets.push(courant); courant = []; poids = 0; }
      courant.push(l); poids += p;
    }
    if (courant.length) paquets.push(courant);
    return paquets;
  }

  function creerWorkerBlob() {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof document === 'undefined') return null;
    // ?ouvrier=non : la séance se passe d'ouvrier, comme un navigateur qui les refuserait (essai du repli au banc)
    if (typeof location !== 'undefined' && /[?&]ouvrier=non(&|$)/.test(location.search || '')) return null;
    const table = new Map();
    for (const s of document.scripts || []) {
      const txt = s.textContent || '';
      // construire.py écrit « <script>\n// ---- nom ---- » : le texte du script commence par ce saut de ligne
      const m = /^\s*\/\/ ---- ([^\n]+) ----\n/.exec(txt);
      if (m) table.set(m[1].trim(), txt);
    }
    const morceaux = [
      'self.window = self; self.globalThis = self;\n',
      'const __MODULES__ = [];\n'
    ];
    for (const nom of MODULES_WORKER) {
      const src = table.get(nom);
      if (!src) return null;
      morceaux.push(src, '\n');
    }
    morceaux.push(
      'const empaqueterHerbier = ', empaqueterHerbier.toString(), ';\n',
      'const construireCircuitFenetre = ', construireCircuitFenetre.toString(), ';\n',
      'const etapesPreparation = ', etapesPreparation.toString(), ';\n',
      'const executerPreparationCPU = ', executerPreparationCPU.toString(), ';\n',
      'const POIDS_PAQUET = ', String(POIDS_PAQUET), ';\n',
      'const decouperLots = ', decouperLots.toString(), ';\n',
      `self.onmessage = function (ev) {
        const msg = ev.data;
        if (!msg || msg.t !== 'preparer') return;
        try {
          const res = executerPreparationCPU(self.BITUME, msg.req, true);
          const paquets = decouperLots(res.decorPur.lots);
          res.decorPur.lots = null;
          const transferts = [], vus = new Set();
          const pousser = (buf, liste) => { if (buf instanceof ArrayBuffer && !vus.has(buf)) { vus.add(buf); (liste || transferts).push(buf); } };
          for (const n of res.decorPur.nappes) { pousser(n.sommets?.buffer); pousser(n.indices?.buffer); }
          if (res.maillageSol?.H) pousser(res.maillageSol.H.buffer);
          if (res.herbierPlat) pousser(res.herbierPlat.buffer);
          for (const n of res.extraitPhysX.nappes) { pousser(n.vertices?.buffer); pousser(n.indices?.buffer); pousser(n.surfaces?.buffer); }
          if (res.grilleAnimaux) {
            for (const k of ['premier', 'fin', 'lignes', 'd', 'bords', 'h', 'ny', 'arbres', 'drap', 'eauLocale'])
              if (res.grilleAnimaux[k]?.buffer) pousser(res.grilleAnimaux[k].buffer);
          }
          self.postMessage({ t: 'pret', id: msg.id, cle: msg.cle, station: msg.req.station, cleStation: msg.cleStation, res, paquets: paquets.length }, transferts);
          for (let k = 0; k < paquets.length; k++) {
            const tr = [];
            for (const l of paquets[k]) pousser(l?.semisProgressif?.semis?.buffer, tr);
            self.postMessage({ t: 'lots', id: msg.id, k, lots: paquets[k] }, tr);
          }
        } catch (err) {
          self.postMessage({ t: 'erreur', id: msg.id, cle: msg.cle, message: String(err && err.stack || err) });
        }
      };\n`
    );
    let url = null;
    try {
      url = URL.createObjectURL(new Blob(morceaux, { type: 'text/javascript' }));
      const worker = new Worker(url, { name: 'bitume-sans-fin' });
      return { worker, url };
    } catch (e) {
      if (url) try { URL.revokeObjectURL(url); } catch (_) {}
      try {
        const dataUrl = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(morceaux.join(''));
        const worker = new Worker(dataUrl, { name: 'bitume-sans-fin' });
        return { worker, url: null };
      } catch (_) {
        return null;
      }
    }
  }

  // Réhydratation légère du décor reçu : tout sauf la grille de l'herbier et le flux du décor,
  // construits chacun dans leur propre étape de cuisson.
  function rehydraterDecor(c, brut, optionsAtmosphere) {
    const { decorPur: decor, maillageSol, saisonId, sourcesFeuilles, qualite, grilleAnimaux } = brut;
    for (const n of decor.nappes) {
      if (n.surfaceType) Object.defineProperty(n, 'surfaceType', { value: n.surfaceType, enumerable: false });
    }
    if (B.bosquets && B.bosquets.rehydrater) for (const l of decor.lots || []) if (l && l.semisProgressif) B.bosquets.rehydrater(l);
    decor.sol = creerSolDepuisMaillage(maillageSol);
    decor.niveauEauA = undefined;
    decor.lagon = undefined;
    const ecologie = B.ecologie ? B.ecologie.creer(c.graine, c.theme) : null;
    const saison = saisonId && B.saisons ? B.saisons.profil(saisonId, c.theme) : null;
    if (grilleAnimaux && maillageSol) grilleAnimaux.T = maillageSol;
    Object.defineProperties(decor, {
      maillageSol: { value: maillageSol },
      grilleAnimaux: { value: grilleAnimaux },
      ecologie: { value: ecologie },
      saison: { value: saison },
      sourcesFeuilles: { value: sourcesFeuilles || [] },
      qualite: { value: qualite, enumerable: false },
    });
    if (optionsAtmosphere) {
      decor.atmosphere = B.graphismes.atmosphere(decor.atmosphere);
      decor.atmosphere = Object.assign({}, decor.atmosphere, {
        fogDensity: Math.max(decor.atmosphere.fogDensity || .0006, optionsAtmosphere.brumeMin)
      });
    }
    return decor;
  }

  function creer(callbacks) {
    const w = creerWorkerBlob();
    const flux = {
      worker: w ? w.worker : null,
      url: w ? w.url : null,
      callbacks,
      prochainId: 1,
      enVol: null,       // { id, cle, params } envoyé au Worker
      boite: [],         // messages reçus de l'ouvrier, désérialisés un par image
      recu: null,        // préparation en cours de réception { m, params, cle, lots, attendus, recus }
      repli: null,       // préparation sans ouvrier, jouée étape par étape { id, cle, gen, cible, params }
      cuisson: null,     // tâche en cours de cuisson incrémentale sur le fil principal
      pret: null,        // paquet entièrement cuit { cle, c, sc, montage, station, cleStation }
      aLiberer: [],      // anciens mondes PhysX à détruire hors image de bascule
      detruit: false,
      stats: { reception: 0, messages: 0, repli: 0, repliEtapes: {}, etapes: {} },   // pires durées (ms) sur le fil principal
    };
    if (flux.worker) {
      // Chrome ne désérialise un message qu'à la première lecture de ev.data : la boîte garde les événements
      // intacts et avancerCadre en ouvre un par image.
      flux.worker.onmessage = ev => { if (!flux.detruit) flux.boite.push(ev); };
      // un ouvrier qui ne se charge pas (sécurité de la page, module en échec) laisse la place au repli
      flux.worker.onerror = ev => {
        ev?.preventDefault?.();
        console.warn('BITUME sans-fin worker indisponible :', ev?.message || 'erreur de chargement');
        passerEnRepli(flux);
      };
    }
    return flux;
  }

  function passerEnRepli(flux) {
    if (flux.worker) { try { flux.worker.terminate(); } catch (_) {} flux.worker = null; }
    if (flux.url) { try { URL.revokeObjectURL(flux.url); } catch (_) {} flux.url = null; }
    flux.enVol = null;
    flux.recu = null;
    flux.boite.length = 0;
  }

  function abandonnerCuisson(flux) {
    const q = flux.cuisson;
    flux.cuisson = null;
    if (q?.montage?.world) flux.aLiberer.push(q.montage.world);
  }

  function abandonnerPret(flux) {
    const p = flux.pret;
    flux.pret = null;
    if (p?.montage?.world) flux.aLiberer.push(p.montage.world);
  }

  function demander(flux, cible, params) {
    if (!flux || flux.detruit || !cible) return;
    if (flux.pret?.cle === cible.cle || flux.cuisson?.cle === cible.cle || flux.enVol?.cle === cible.cle
      || flux.recu?.cle === cible.cle || flux.repli?.cle === cible.cle) return;
    abandonnerCuisson(flux);
    abandonnerPret(flux);
    flux.recu = null;
    flux.repli = null;
    const id = flux.prochainId++;
    const req = {
      graine: cible.graine,
      k0: cible.k0,
      k1: cible.k1,
      sOrigine: cible.sOrigine,
      station: cible.station,
      decorOptions: params.decorOptions,
      avecAnimaux: params.avecAnimaux,
    };
    if (flux.worker) {
      flux.enVol = { id, cle: cible.cle, params };
      flux.worker.postMessage({ t: 'preparer', id, cle: cible.cle, cleStation: cible.cleStation, req });
    } else {
      // Repli sans ouvrier : les étapes de la préparation se jouent une par image dans avancerCadre
      flux.repli = { id, cle: cible.cle, gen: etapesPreparation(B, req, false), cible, params };
    }
  }

  // Ouvre un message de la boîte (sa désérialisation a lieu ici) et range son contenu.
  function recevoir(flux) {
    const ev = flux.boite.shift(), t0 = maintenant();
    const m = ev.data;
    flux.stats.reception = Math.max(flux.stats.reception, +(maintenant() - t0).toFixed(2));
    flux.stats.messages++;
    if (!m) return;
    if (m.t === 'pret') {
      if (!flux.enVol || m.id !== flux.enVol.id) return;   // préparation remplacée entre-temps
      flux.recu = { m, params: flux.enVol.params, cle: m.cle, lots: [], attendus: m.paquets || 0, recus: 0 };
      flux.enVol = null;
    } else if (m.t === 'lots') {
      const r = flux.recu;
      if (!r || r.m.id !== m.id) return;
      for (const l of m.lots) r.lots.push(l);
      r.recus++;
    } else if (m.t === 'erreur') {
      if (!(flux.enVol && flux.enVol.id === m.id) && !(flux.recu && flux.recu.m.id === m.id)) return;
      // une préparation refusée ne se relance pas à chaque image : la séance passe au repli
      console.warn('BITUME sans-fin worker:', m.message);
      passerEnRepli(flux);
      return;
    }
    const r = flux.recu;
    if (r && r.recus >= r.attendus) {
      flux.recu = null;
      r.m.res.decorPur.lots = r.lots;
      demarrerCuisson(flux, { cle: r.cle, station: r.m.station, cleStation: r.m.cleStation, res: r.m.res, params: r.params });
    }
  }

  function demarrerCuisson(flux, msg) {
    const params = msg.params || flux.callbacks.parametres();
    flux.cuisson = {
      cle: msg.cle,
      c: msg.res.c,
      brut: msg.res,
      decor: null,
      station: msg.station || null,
      cleStation: msg.cleStation ?? null,
      extraitPhysX: msg.res.extraitPhysX,
      montage: null,
      curseurPhysX: { iNappe: 0, iStatique: 0, iMobile: 0, statsCopiees: false },
      etape: -3,
      detailPeripherique: null,
      visibilite: null,
      animaux: null,
      fond: null,
      plan: null,
      params,
    };
  }

  function avancerCadre(flux, S, budgetMs = 1.5) {
    if (!flux || flux.detruit) return;
    const t0 = maintenant();

    // 1. Planification anticipée (950 m avant la limite du décor bâti ou 750 m avant sortie de station)
    if (S?.seance && B.routeSansFinSeance?.anticiper) {
      const co = S.course, vivantes = [];
      for (const v of co.voitures) if (v.humain && !v.distant && v.sansFin && !v.sansFin.elimine) vivantes.push(v.etat.s);
      if (!vivantes.length) vivantes.push(co.joueur.etat.s);
      const cible = B.routeSansFinSeance.anticiper(S.seance, vivantes);
      if (cible) demander(flux, cible, flux.callbacks.parametres(S));
    }

    // 2. Une seule unité de travail par image : un message de l'ouvrier, une étape du repli ou une étape de cuisson
    if (flux.boite.length) { recevoir(flux); return; }
    if (flux.repli) {
      const r = flux.repli, te = maintenant();
      try {
        const pas = r.gen.next();
        if (!pas.done) flux.stats.repliEtapes[pas.value] = Math.max(flux.stats.repliEtapes[pas.value] || 0, +(maintenant() - te).toFixed(2));
        if (pas.done) {
          flux.repli = null;
          demarrerCuisson(flux, { cle: r.cle, station: r.cible.station, cleStation: r.cible.cleStation, res: pas.value, params: r.params });
        }
      } catch (e) { console.warn('BITUME sans-fin repli:', e); flux.repli = null; }
      flux.stats.repli = Math.max(flux.stats.repli, +(maintenant() - te).toFixed(2));
      return;
    }

    // 3. Cuisson incrémentale du monde suivant (décor, PhysX, auxiliaires) sous budget par image
    const q = flux.cuisson;
    if (q) {
      const te = maintenant(), etape = q.etape;
      try {
        if (q.etape === -3) {
          q.decor = rehydraterDecor(q.c, q.brut, q.params);
          q.etape = -2;
        } else if (q.etape === -2) {
          const surfaceFn = surfaceHerbeDepuisPlat(q.brut.herbierPlat);
          Object.defineProperty(q.decor, 'surfaceHerbe', { value: (x, z, sortie) => surfaceFn(x, z, sortie) });
          q.etape = -1;
        } else if (q.etape === -1) {
          if (B.decor?.creerFluxDecor) Object.defineProperty(q.decor, 'fluxDecor', { value: B.decor.creerFluxDecor(q.decor.lots) });
          q.etape = -0.5;
        } else if (q.etape === -0.5) {
          const X = globalThis.FPhysX;
          if (!X || !X.isReady()) { abandonnerCuisson(flux); return; }
          const world = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 8, ccdMaxPasses: 8, contacts: true, maxContactPoints: 512 });
          q.montage = B.solidesPhysX.creerMontage(world, !!(q.decor.mobilesPhysX && q.decor.mobilesPhysX.length));
          q.brut = null;
          q.etape = 0;
        } else if (q.etape === 0) {
          if (B.solidesPhysX.insererTranche(q.montage, q.extraitPhysX, q.curseurPhysX, budgetMs)) q.etape = 1;
        } else if (q.etape === 1) {
          q.detailPeripherique = B.detailPeripherique ? B.detailPeripherique.creer(q.decor.lots) : null;
          q.etape = 2;
        } else if (q.etape === 2) {
          q.visibilite = B.visibiliteRaycast ? B.visibiliteRaycast.creer(q.decor) : null;
          q.etape = 3;
        } else if (q.etape === 3) {
          q.animaux = flux.callbacks.creerAnimaux ? flux.callbacks.creerAnimaux(q.c, q.decor, S) : null;
          q.etape = 4;
        } else if (q.etape === 4) {
          const carte = flux.callbacks.creerPlan ? flux.callbacks.creerPlan(q.c) : { fond: null, plan: null };
          q.fond = carte.fond; q.plan = carte.plan;
          flux.cuisson = null;
          flux.pret = {
            cle: q.cle,
            c: q.c,
            decor: q.decor,
            station: q.station,
            cleStation: q.cleStation,
            montage: { world: q.montage.world, solids: q.montage },
            detailPeripherique: q.detailPeripherique,
            visibilite: q.visibilite,
            animaux: q.animaux,
            fond: q.fond,
            plan: q.plan,
            params: q.params,
          };
        }
      } catch (e) {
        console.warn('BITUME sans-fin cuisson:', e);
        abandonnerCuisson(flux);
      }
      flux.stats.etapes[etape] = Math.max(flux.stats.etapes[etape] || 0, +(maintenant() - te).toFixed(2));
      return;
    }

    // 3. Si aucune cuisson ne tourne et qu'il reste du budget, libérer un ancien monde PhysX retraité
    if (flux.aLiberer.length && maintenant() - t0 < 0.6) {
      const w = flux.aLiberer.shift();
      try { w.dispose(); } catch (_) {}
    }
  }

  function consommerPret(flux, seance, positionsRel) {
    if (!flux || !flux.pret || !seance) return null;
    const p = flux.pret;
    const oP = p.c.sansFinFenetre.sOrigine;
    const abs = positionsRel.map(s => (seance.cPorteur ? seance.cPorteur.sansFinFenetre.sOrigine : 0) + s);
    const minAbs = Math.min(...abs), maxAbs = Math.max(0, ...abs);
    if (minAbs < oP - 10 || maxAbs > oP + p.c.longueur - 400) return null;
    flux.pret = null;
    return p;
  }

  function recyclerMonde(flux, world) {
    if (!world) return;
    if (!flux || flux.detruit) { try { world.dispose(); } catch (_) {} return; }
    flux.aLiberer.push(world);
  }

  function enPreparation(flux) {
    return !!(flux && !flux.detruit && (flux.enVol || flux.boite.length || flux.recu || flux.repli || flux.cuisson || flux.pret));
  }

  function detruire(flux) {
    if (!flux || flux.detruit) return;
    flux.detruit = true;
    flux.enVol = null;
    flux.recu = null;
    flux.repli = null;
    flux.boite.length = 0;
    abandonnerCuisson(flux);
    abandonnerPret(flux);
    if (flux.worker) { try { flux.worker.terminate(); } catch (_) {} flux.worker = null; }
    if (flux.url) { try { URL.revokeObjectURL(flux.url); } catch (_) {} flux.url = null; }
    while (flux.aLiberer.length) {
      const w = flux.aLiberer.pop();
      try { w.dispose(); } catch (_) {}
    }
  }

  B.routeSansFinFlux = { creer, demander, avancerCadre, consommerPret, recyclerMonde, enPreparation, detruire };
})(globalThis.BITUME = globalThis.BITUME || {});
