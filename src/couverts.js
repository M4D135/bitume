/* BITUME — passages couverts multiples, abris à leur vraie altitude et galeries ouvertes.
   c.tunnel reste une entrée historique ; c.couverts porte les ouvrages lorsqu'il existe.
   Les lectures ne changent ni le circuit, ni la météo, ni les solides de la conduite. */
(function (B) {
  'use strict';
  const VIDE = Object.freeze([]), LISTES = new WeakMap(), CACHE = new WeakMap();
  const TYPES = Object.freeze(['tunnel', 'galerie']);
  const POLITIQUES = Object.freeze({
    tunnel: Object.freeze({ abri: true, interieur: true, exposition: 1.32, echo: true, toit: true }),
    galerie: Object.freeze({ abri: true, interieur: false, exposition: 1, echo: false, toit: true })
  });
  const DEHORS = Object.freeze({ abri: false, interieur: false, exposition: 1, echo: false, toit: false });
  const fini = Number.isFinite, ramener = (s, L) => ((s % L) + L) % L;
  const borner = (v, a, b) => Math.max(a, Math.min(b, v));
  const type = t => t && (t.type === undefined ? 'tunnel' : t.type);
  const politique = t => POLITIQUES[type(t)] || DEHORS;

  function liste(c) {
    if (!c || typeof c !== 'object') return VIDE;
    if (Array.isArray(c.couverts)) return c.couverts;
    if (!c.tunnel) return VIDE;
    let cache = LISTES.get(c);
    if (!cache || cache[0] !== c.tunnel) { cache = Object.freeze([c.tunnel]); LISTES.set(c, cache); }
    return cache;
  }
  function longueur(c, t) {
    if (!c || !t || !fini(c.longueur) || !(c.longueur > 0) || !fini(t.debut) || !fini(t.fin)) return 0;
    const d = t.fin - t.debut;
    return d > 0 ? d : d < 0 ? ramener(d, c.longueur) : 0;
  }
  function inclut(c, t, s, marge) {
    if (!POLITIQUES[type(t)] || !fini(s) || !fini(marge)) return false;
    const l = longueur(c, t), n = l + 2 * marge;
    if (!(l > 0) || l >= c.longueur || n <= 0) return false;
    if (n > c.longueur) return true;
    const d = ramener(s - t.debut + marge, c.longueur);
    return d > 0 && d < n; // mêmes portails ouverts que dansTunnel historique
  }
  function segment(c, s, marge = 0, genre = null) {
    // Les listes historiques et la liste vide sont gelées. Leur itération for…of crée
    // un itérateur et ses résultats dans V8, y compris pour chaque voiture sans couvert.
    const ts = liste(c);
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if ((!genre || type(t) === genre) && inclut(c, t, s, marge)) return t;
    }
    return null;
  }
  function dansTunnel(c, s, marge = 0) { return segment(c, s, marge, 'tunnel') !== null; }
  function valider(c) {
    if (!c || !fini(c.longueur) || c.longueur <= 0) throw new TypeError('Couverts : longueur de circuit invalide');
    const ids = new Set();
    for (const t of liste(c)) {
      if (!t || !POLITIQUES[type(t)]) throw new TypeError('Couverts : type tunnel ou galerie attendu');
      const l = longueur(c, t);
      if (!(l > 0 && l < c.longueur)) throw new RangeError('Couverts : intervalle vide ou tour entier');
      if (!fini(t.mur) || t.mur <= 0 || !fini(t.hauteur) || t.hauteur <= 0) throw new RangeError('Couverts : dimensions invalides');
      if (type(t) === 'galerie' && t.ouvert !== 'G' && t.ouvert !== 'D') throw new TypeError('Couverts : côté ouvert G ou D attendu');
      if (t.id !== undefined) {
        if (typeof t.id !== 'string' || !t.id || ids.has(t.id)) throw new TypeError('Couverts : identifiant vide ou dupliqué');
        ids.add(t.id);
      }
    }
    return true;
  }
  // La sortie évite aussi un deuxième ouvrage chevauchant le premier. Null signifie qu'aucun poste
  // ne respecte la marge : le réalisateur doit choisir une autre vue, jamais garder un faux poste libre.
  function sortie(c, s, marge = 25, degagement = 5) {
    if (!c || !fini(c.longueur) || c.longueur <= 0 || !fini(s) || !fini(marge) || marge < 0 || !fini(degagement) || degagement <= 0) return null;
    let q = ramener(s, c.longueur);
    const ts = liste(c);
    for (let n = 0; n <= ts.length; n++) {
      const t = segment(c, q, marge);
      if (!t) return q;
      q = ramener(t.debut + longueur(c, t) + marge + degagement, c.longueur);
    }
    return null;
  }
  function invalider(c) { if (c && typeof c === 'object') CACHE.delete(c); }
  // Chaque tranche contient aussi le dernier sommet du dernier segment. Une
  // marge horizontale égale à la largeur du couvert préserve les portails et
  // les bords courbes. La hauteur et le dévers restent évalués sur le vrai sol.
  function emprise(axe, debut, fin, marge) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let k = debut; k <= fin; k += 5) {
      x0 = Math.min(x0, axe[k]); x1 = Math.max(x1, axe[k]);
      z0 = Math.min(z0, axe[k + 2]); z1 = Math.max(z1, axe[k + 2]);
    }
    return { debut, fin, x0: x0 - marge, x1: x1 + marge, z0: z0 - marge, z1: z1 + marge };
  }
  function horsEmprise(b, x, z) {
    return x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1;
  }
  // Préparation de scène. Les sommets sont ceux de la polyligne réellement échantillonnée, y et dévers compris.
  // Une modification en place du tracé ou d'un ouvrage exige invalider(c), avant le prochain rendu.
  function preparer(c) {
    const ts = liste(c), cache = c && CACHE.get(c);
    if (cache && cache.liste === ts && cache.longueur === c.longueur && cache.x === c.x && cache.y === c.y && cache.z === c.z && cache.devers === c.devers) return cache;
    valider(c);
    const blocs = [], pas = Math.min(4, fini(c.pas) && c.pas > 0 ? c.pas : 2);
    if (ts.length && typeof B.circuit?.echantillon !== 'function') throw new TypeError('Couverts : lecteur du circuit absent');
    for (const t of ts) {
      const debut = t.debut, fin = debut + longueur(c, t), points = [], e = {};
      let s = debut;
      for (;;) {
        B.circuit.echantillon(c, s, e);
        if (![e.x, e.y, e.z, e.devers ?? 0].every(fini)) throw new TypeError('Couverts : axe non fini');
        points.push(e.x, e.y, e.z, s, e.devers || 0);
        if (s === fin) break;
        s = Math.min(fin, (Math.floor((s + 1e-8) / pas) + 1) * pas);
      }
      const axe = new Float64Array(points), finAxe = axe.length - 5, tranches = [];
      for (let k = 0; k < finAxe; k += 80)
        tranches.push(emprise(axe, k, Math.min(finAxe, k + 80), t.mur));
      blocs.push({ t, axe, tranches, emprise: emprise(axe, 0, finAxe, t.mur), politique: politique(t) });
    }
    const resultat = { liste: ts, longueur: c.longueur, x: c.x, y: c.y, z: c.z, devers: c.devers, blocs };
    CACHE.set(c, resultat); return resultat;
  }
  function vider(o) {
    o.couvert = null; o.type = null; o.s = o.d = o.sol = o.hauteur = 0;
    o.abri = o.interieur = o.echo = false; o.exposition = 1; o.ouvert = null;
    return o;
  }
  // Point monde, pas abscisse de la voiture : deux routes superposées ne partagent jamais leur abri.
  function position(c, p, destination) {
    const out = destination || {}, px = p?.[0], py = p?.[1], pz = p?.[2]; vider(out);
    if (!fini(px) || !fini(py) || !fini(pz) || !c || !liste(c).length) return null;
    let meilleur = Infinity;
    for (const bloc of preparer(c).blocs) {
      if (horsEmprise(bloc.emprise, px, pz)) continue;
      const { t, axe: A } = bloc;
      let proche = Infinity, index = -1, fraction = 0, decalage = 0, hauteur = 0, solProche = 0;
      for (const tranche of bloc.tranches) {
        if (horsEmprise(tranche, px, pz)) continue;
        for (let k = tranche.debut; k < tranche.fin; k += 5) {
          const dx = A[k + 5] - A[k], dz = A[k + 7] - A[k + 2], l2 = dx * dx + dz * dz;
          if (l2 < 1e-12) continue;
          const vx = px - A[k], vz = pz - A[k + 2], u0 = (vx * dx + vz * dz) / l2;
          const u = borner(u0, 0, 1), qx = vx - dx * u, qz = vz - dz * u, d2 = qx * qx + qz * qz;
          if (d2 > t.mur * t.mur || d2 >= proche) continue;
          const d = (vz * dx - vx * dz) / Math.sqrt(l2), devers = A[k + 4] + (A[k + 9] - A[k + 4]) * u;
          const sol = A[k + 1] + (A[k + 6] - A[k + 1]) * u - d * Math.tan(devers), h = py - sol;
          proche = d2; index = k; fraction = u; decalage = d; hauteur = h; solProche = sol;
        }
      }
      if (index < 0 || hauteur < -.12 || hauteur >= t.hauteur || proche >= meilleur) continue;
      // Portails ouverts : la projection clampée sur le premier ou le dernier sommet
      // placerait un point extérieur sous la voûte. La même plage ouverte que segment().
      const abscisse = ramener(A[index + 3] + (A[index + 8] - A[index + 3]) * fraction, c.longueur);
      if (!inclut(c, t, abscisse, 0)) continue;
      meilleur = proche;
      out.couvert = t; out.type = type(t); out.s = abscisse;
      out.d = decalage; out.sol = solProche; out.hauteur = hauteur; out.ouvert = t.ouvert || null;
      out.abri = true; out.interieur = bloc.politique.interieur; out.echo = bloc.politique.echo; out.exposition = bloc.politique.exposition;
    }
    return out.couvert ? out : null;
  }
  const LECTURE = {};
  function abri(c, p) { return position(c, p, LECTURE) !== null; }
  function interieur(c, p) { const q = position(c, p, LECTURE); return !!q?.interieur; }
  function eclairage(c, p, destination) { const out = destination || {}; position(c, p, out); return out; }

  // Galeries : mêmes primitives de dessin et de collision. Le tunnel historique reste construit dans decor.js.
  // Aucun pont ni gorge n'est inventé ici : une plage c.ponts ne creuse pas le terrain et ne crée pas un tablier.
  function orientation(avant, haut = [0, 1, 0]) {
    const l = Math.hypot(...avant), x = avant.map(v => v / l), dot = haut[0]*x[0] + haut[1]*x[1] + haut[2]*x[2];
    const h = haut.map((v, k) => v - dot * x[k]);
    const n = Math.hypot(...h), y = h.map(v => v / n), z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
    return [Math.atan2(y[2], z[2]), -Math.asin(borner(x[2], -1, 1)), Math.atan2(x[1], x[0])];
  }
  function solide(p, s, r, genre, color, mat = 3, groupe = 2, surface = null) {
    const o = { shape: 'box', p, s, r, mat, color, outdoor: true, surface: 'object' };
    Object.defineProperty(o, 'solidePhysX', { value: Object.freeze({ genre, groupe, surface }) });
    return o;
  }
  function construireGalerie(c, t) {
    valider({ longueur: c.longueur, couverts: [t] });
    if (type(t) !== 'galerie') throw new TypeError('Couverts : une galerie est requise');
    const lots = [], lampes = [], debut = t.debut, fin = debut + longueur(c, t), ouvert = t.ouvert === 'G' ? -1 : 1, ferme = -ouvert;
    const beton = [.48, .49, .47], toit = [.32, .34, .35], M = t.mur, H = t.hauteur;
    // Les 4 cm de surépaisseur se raccordent sur six mètres à chaque portail : une dalle
    // constante présentait sa tranche aux roues et à la caisse avant les premiers appuis.
    const rehausse = s => {
      const u = borner(Math.min(s - debut, fin - s) / 6, 0, 1);
      return .002 + .038 * u * u * (3 - 2 * u);
    };
    for (let s = debut, numero = 0; s < fin; s = Math.min(fin, s + 6), numero++) {
      const suivant = Math.min(fin, s + 6), a = B.circuit.echantillon(c, s), b = B.circuit.echantillon(c, suivant), q = B.circuit.echantillon(c, (s + suivant) / 2);
      const axe = [b.x - a.x, b.y - a.y, b.z - a.z], r = orientation(axe), droit = [-Math.sin(q.cap), 0, Math.cos(q.cap)];
      const angle = Math.abs(Math.atan2(Math.sin(b.cap - a.cap), Math.cos(b.cap - a.cap)));
      const long = Math.hypot(...axe) + .06 + 2 * (M + .7) * Math.tan(Math.min(angle / 2, .45));
      const milieu = [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], objets = [];
      // Revêtement abrité indépendant du terrain enneigé, éclairé par le jour latéral.
      const bank = q.devers || 0, normal = [Math.sin(bank) * droit[0], Math.cos(bank), Math.sin(bank) * droit[2]];
      const h0 = rehausse(s), h1 = rehausse(suivant), axeSol = [axe[0], axe[1] + h1 - h0, axe[2]], normeSol = Math.hypot(...axeSol);
      const tangent = axeSol.map(v => v / normeSol), produit = tangent.reduce((s, v, i) => s + v * normal[i], 0);
      const nSol = normal.map((v, i) => v - produit * tangent[i]), nLongueur = Math.hypot(...nSol);
      const centreSol = milieu.map((v, i) => v + (i === 1 ? (h0 + h1) / 2 : 0) - .05 * nSol[i] / nLongueur);
      objets.push(solide(centreSol, [normeSol + long - Math.hypot(...axe), .1, 2 * M], orientation(axeSol, normal), 'sol-galerie', [.20, .20, .205], 7, 1, 'piste'));
      objets.push(solide([milieu[0], milieu[1] + H + .35, milieu[2]], [long, .7, 2 * M + 1.4], r, 'voute-galerie', toit));
      const d = ferme * (M + .3), y = milieu[1] - d * Math.tan(q.devers || 0);
      objets.push(solide([milieu[0] + droit[0] * d, y + H / 2, milieu[2] + droit[2] * d], [long, H + .12, .6], r, 'mur-galerie', beton));
      if (numero % 2 === 0) {
        const p = [milieu[0] + droit[0] * ferme * (M - .12), y + H - .55, milieu[2] + droit[2] * ferme * (M - .12)];
        objets.push({ shape: 'box', p, s: [1.1, .16, .08], r, mat: 5, color: [1, .88, .65], emissive: 2.1, outdoor: true, surface: 'object' });
        lampes.push([p[0] - droit[0] * ferme * .6, p[1] - .2, p[2] - droit[2] * ferme * .6]);
      }
      lots.push({ objets, loin: objets.slice(), x: q.x, z: q.z });
    }
    for (let s = debut; ; s = Math.min(fin, s + 12)) {
      const q = B.circuit.echantillon(c, s), d = ouvert * (M + .3), x = q.x - Math.sin(q.cap) * d, z = q.z + Math.cos(q.cap) * d;
      const y = q.y - d * Math.tan(q.devers || 0), o = solide([x, y + H / 2, z], [.65, H + .12, .6], [0, -q.cap, 0], 'pilier-galerie', beton);
      lots.push({ objets: [o], loin: [o], x: q.x, z: q.z });
      if (s === fin) break;
    }
    return { lots, lampes };
  }
  B.couverts = { TYPES, liste, type, politique, longueur, segment, dansTunnel, valider, sortie, preparer, invalider, position, abri, interieur, eclairage, construireGalerie };
})(globalThis.BITUME = globalThis.BITUME || {});
