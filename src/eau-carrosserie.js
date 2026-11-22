/* BITUME — eau sur la peinture : attaches barycentriques aux vrais triangles du modèle.
   Préparer sous le voile, avancer une seule fois par image, puis reposer sans avancer le temps dans chaque vue.
   Aucun bitmap, aucun shader ajouté, aucune modification des formes de la voiture ou des copies FERRO. */
(function (B) {
  'use strict';

  const MAX = 192, LIMITES = Object.freeze({ complet: MAX, moyen: 48, leger: 12, 'moyen-leger': 12,
    epave: MAX, 'epave-moyen': 48, 'epave-leger': 12, simple: 0 });
  const NOM = 'bitume-goutte-carrosserie', MAT_EAU = 19, ECART = .00006;
  const moteur = globalThis.FRender || globalThis.window?.FRender, atlasConnus = new Map();
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // Calotte de 24 triangles, base y=0 et sommet y=.5. La base touche la peau ; elle n'est pas une sphère flottante.
  // Les normales lisses emploient la matière brillante native 19 du moteur.
  function calotte() {
    const t = [], bas = [], haut = [], nb = [], nh = [];
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, x = Math.cos(a), z = Math.sin(a), k = Math.SQRT1_2;
      bas.push([x * .5, 0, z * .5]); haut.push([x * k * .5, k * .5, z * k * .5]);
      nb.push([x, 0, z]); nh.push([x * k, k, z * k]);
    }
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      t.push([bas[i], haut[i], haut[j], nb[i], nh[i], nh[j]], [bas[i], haut[j], bas[j], nb[i], nh[j], nb[j]],
        [haut[i], [0, .5, 0], haut[j], nh[i], [0, 1, 0], nh[j]]);
    }
    return t;
  }
  const FORME = calotte();
  if (moteur?.forme) moteur.forme(NOM, FORME);

  function hasard(graine) {
    let a = graine >>> 0;
    return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const peinte = p => p.mat === 17 && !p.pilote && !p.tetePilote && p.roue === undefined && !p.fx;

  // Même cube unité et mêmes faces que geometry().box du renderer. Seule primitive peinte du modèle courant.
  function boite() {
    const t = [];
    for (let axe = 0; axe < 3; axe++) for (const signe of [-1, 1]) {
      const a = (axe + 1) % 3, b = (axe + 2) % 3;
      const p = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(q => { const v = [0, 0, 0]; v[axe] = signe * .5; v[a] = q[0] * .5; v[b] = q[1] * .5; return v; });
      t.push(signe > 0 ? [p[0], p[1], p[2]] : [p[0], p[2], p[1]], signe > 0 ? [p[0], p[2], p[3]] : [p[0], p[3], p[2]]);
    }
    return t;
  }
  const BOITE = boite();
  function catalogue(mod) {
    const pieces = mod.corps.filter(peinte), moyens = new Set(mod.moyens), epave = new Set(mod.epave);
    const cle = pieces.map(p => [p.shape, ...p.o, ...p.s, ...(p.m ? p.m.flat() : []), +moyens.has(p), +epave.has(p)].join(',')).join(';');
    const connu = atlasConnus.get(cle); if (connu) return connu;
    const formes = new Map(Object.values(B.voiture.FORMES).map(f => [f.nom, f.tri]));
    const faces = [], candidates = []; let aire = 0;
    pieces.forEach((p, piece) => {
      const source = formes.get(p.shape) || (p.shape === 'box' ? BOITE : null);
      if (!source) throw new Error('Eau : surface peinte non décrite : ' + p.shape);
      const m = p.m || [[1, 0, 0], [0, 1, 0], [0, 0, 1]], masque = 1 | (moyens.has(p) ? 2 : 0) | (epave.has(p) ? 4 : 0);
      source.forEach((tri, indice) => {
        const points = tri.slice(0, 3).map(v => { const q = v.map((x, k) => x * p.s[k]);
          return p.o.map((x, k) => x + m[0][k] * q[0] + m[1][k] * q[1] + m[2][k] * q[2]); });
        const a = points[0], b = points[1], c = points[2], u = b.map((x, k) => x - a[k]), v = c.map((x, k) => x - a[k]);
        const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
        const doubleAire = Math.hypot(nx, ny, nz);
        if (!(doubleAire > 1e-12)) return;
        // Les faces écartées de la sélection peuvent encore masquer une attache.
        const normaleY = ny / doubleAire;
        if (normaleY < -.05) {
          faces.push({ a, u, v });
          return;
        }
        const uu = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
        const vv = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
        const minNormal = 2 ** -1022;
        const lu = uu >= minNormal && Number.isFinite(uu) ? Math.sqrt(uu) : Math.hypot(...u);
        const lv = vv >= minNormal && Number.isFinite(vv) ? Math.sqrt(vv) : Math.hypot(...v);
        const lw = Math.hypot(b[0] - c[0], b[1] - c[1], b[2] - c[2]);
        const rayonInscrit = doubleAire / (lu + lv + lw);
        if (rayonInscrit < .0035) {
          faces.push({ a, u, v });
          return;
        }
        const normal = [nx / doubleAire, normaleY, nz / doubleAire];
        const uv = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
        const f = { piece, shape: p.shape, indice, masque, a, u, v, normal, doubleAire, lu,
          hauteurs: [doubleAire / lw, doubleAire / lv, doubleAire / lu], rayonInscrit,
          uu, uv, vv, determinant: uu * vv - uv * uv };
        faces.push(f);
        aire += doubleAire * (.2 + .8 * Math.max(0, normal[1]));
        f.cumul = aire; candidates.push(f);
      });
    });
    if (!candidates.length) throw new Error('Eau : aucune surface peinte admissible');
    const atlas = { faces, candidates, aire, pieces: pieces.map(p => p.shape) };
    atlasConnus.set(cle, atlas); return atlas;
  }

  // Une autre peau peinte située devant la normale cache l'attache (quille sous le capot, par exemple).
  function cachee(atlas, face, x, y, z) {
    const n = face.normal;
    for (const t of atlas.faces) {
      if (t === face) continue;
      const h0 = n[1] * t.v[2] - n[2] * t.v[1], h1 = n[2] * t.v[0] - n[0] * t.v[2], h2 = n[0] * t.v[1] - n[1] * t.v[0];
      const det = t.u[0] * h0 + t.u[1] * h1 + t.u[2] * h2; if (Math.abs(det) < 1e-12) continue;
      const sx = x - t.a[0], sy = y - t.a[1], sz = z - t.a[2], u = (sx * h0 + sy * h1 + sz * h2) / det;
      if (u < 0 || u > 1) continue;
      const q0 = sy * t.u[2] - sz * t.u[1], q1 = sz * t.u[0] - sx * t.u[2], q2 = sx * t.u[1] - sy * t.u[0];
      const v = (n[0] * q0 + n[1] * q1 + n[2] * q2) / det; if (v < 0 || u + v > 1) continue;
      const distance = (t.v[0] * q0 + t.v[1] * q1 + t.v[2] * q2) / det;
      if (distance > .00015 && distance < 3) return true;
    }
    return false;
  }

  // L'orientation et le déplacement projeté appartiennent au triangle ; chaque perle garde son attache et ses limites.
  // Une voiture possède ses propres supports car deux voitures ne subissent pas le même vent ni le même roulis.
  function supportMouille(face) {
    const n = face.normal, t = face.u.map(x => x / face.lu);
    const repere = Float64Array.of(t[0], t[1], t[2], n[0], n[1], n[2],
      t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]);
    return { face, repere, du: 0, dv: 0, pose: 0, rotation: new Float64Array(3) };
  }

  function preparer(modele, graine = 1) {
    if (modele.eauCarrosserie) return modele.eauCarrosserie;
    const atlas = catalogue(modele), alea = hasard(graine), peintes = modele.corps.filter(peinte);
    const couleurs = [], parPiece = new Map();
    for (const liste of [modele.corps, modele.moyens, modele.simples, modele.epave]) for (const p of liste) if (peinte(p) && !parPiece.has(p)) {
      const base = [...p.color], couleur = [...base]; p.color = couleur;
      const lien = { base, couleur }; couleurs.push(lien); parPiece.set(p, lien);
    }
    // Les variantes déjà compilées et celles qui seront créées plus tard lisent la même couleur préparée.
    for (const t of modele.objetsRendu?.tables || []) if (t) {
      let i = 0;
      for (const p of t.liste) { if (t.cockpit && p.tetePilote) continue;
        const lien = parPiece.get(p); if (lien) t.objets[i].color = lien.couleur; i++; }
    }
    const gouttes = [], supports = [], parFace = new Map();
    for (let i = 0; i < MAX; i++) {
      let f, u, v, rayon, marge, libre, x, y, z, trouve = false;
      for (let essai = 0; essai < 96 && !trouve; essai++) {
        const choix = alea() * atlas.aire; let lo = 0, hi = atlas.candidates.length - 1;
        while (lo < hi) { const milieu = (lo + hi) >> 1; if (atlas.candidates[milieu].cumul < choix) lo = milieu + 1; else hi = milieu; }
        f = atlas.candidates[lo]; rayon = Math.min(.001 + alea() * .0017, f.rayonInscrit * .22);
        marge = f.hauteurs.map(h => (rayon * 1.8 + ECART) / h);
        libre = 1 - marge[0] - marge[1] - marge[2];
        const a = Math.sqrt(alea()), b = alea();
        u = marge[1] + libre * a * (1 - b); v = marge[2] + libre * a * b;
        x = f.a[0] + f.u[0] * u + f.v[0] * v; y = f.a[1] + f.u[1] * u + f.v[1] * v; z = f.a[2] + f.u[2] * u + f.v[2] * v;
        trouve = !cachee(atlas, f, x, y, z);
      }
      if (!trouve) throw new Error('Eau : impossible de trouver une attache exposée');
      const base = parPiece.get(peintes[f.piece]).base;
      let support = parFace.get(f);
      if (!support) { support = supportMouille(f); parFace.set(f, support); supports.push(support); }
      gouttes.push({ face: f, support, u, v, u0: u, v0: v, marge, libre,
        rayon, force: 0, allongement: 1, repere: support.repere,
        local: Float64Array.of(x, y, z), objet: { shape: NOM, p: [0, 0, 0], s: [0, 0, 0], r: [0, 0, 0],
          mat: MAT_EAU, color: base.map((c, k) => c * .42 + [.25, .28, .32][k]), surface: 'object', overlay: false } });
    }
    return (modele.eauCarrosserie = { atlas, gouttes, couleurs, supports, poseEau: 0, gx: NaN, gy: NaN, gz: NaN, matrice: new Float64Array(9), matriceSuivante: new Float64Array(9), deplacement: new Float64Array(3), humide: 0, pluie: 0,
      actives: 0, age: 0, revisions: 0, dernierInstant: -Infinity, dernierAjout: 0, dernierLOD: 'simple' });
  }

  // instant : identifiant monotone de l'image complète (horlogeReelle), partagé par J1, J2 et les glaces.
  // pose : pose existante {tangage,roulis,...} ; aucune copie nécessaire. Un appel dt=0 ne fait pas vieillir l'eau.
  function mettreAJour(e, dt, meteo, vitesse, abri, instant, pose) {
    if (!(dt > 0) || !Number.isFinite(dt) || !Number.isFinite(instant) || instant <= e.dernierInstant) return false;
    const neige = typeof meteo?.precipitationsNeige === 'boolean' ? meteo.precipitationsNeige : !!meteo?.neige;
    const pluie = abri || neige ? 0 : clamp(Number.isFinite(meteo?.pluie) ? meteo.pluie : 0, 0, 1), v = Number.isFinite(vitesse) ? vitesse : 0;
    const dejaSec = e.humide === 0 && pluie === 0;
    const tau = pluie > e.humide ? 2 : 8 / (1 + Math.abs(v) / 55);
    e.humide = pluie + (e.humide - pluie) * Math.exp(-dt / tau);
    if (pluie === 0 && e.humide < 1e-5) e.humide = 0;
    e.pluie = pluie; e.age += dt; e.revisions++; e.dernierInstant = instant; e.actives = Math.ceil(e.humide * MAX);
    // Une carrosserie déjà sèche ne parcourt ni ses perles ni ses couleurs. Le dernier pas
    // de séchage passe encore ci-dessous pour restaurer les attaches et la peinture ;
    // la prochaine pluie reprend les mêmes pools et recalcule leur transport normalement.
    if (dejaSec) return true;
    const p = Number.isFinite(pose?.tangage) ? pose.tangage : 0, r = Number.isFinite(pose?.roulis) ? pose.roulis : 0;
    // Gravité exprimée dans le repère incliné de la voiture, et air vers l'arrière (inverse en marche arrière).
    const cp = Math.cos(p), gx = -.0018 * Math.sin(p) - .0035 * clamp(v / 85, -1, 1), gy = -.0018 * cp * Math.cos(r), gz = .0018 * cp * Math.sin(r);
    const D = e.deplacement;
    if (e.humide === 0) { D[0] = 0; D[1] = 0; D[2] = 0; }
    else { D[0] += gx * dt; D[1] += gy * dt; D[2] += gz * dt; }
    const reorienter = !Object.is(e.gx, gx) || !Object.is(e.gy, gy) || !Object.is(e.gz, gz);
    e.gx = gx; e.gy = gy; e.gz = gz;
    for (let i = 0; i < e.supports.length; i++) {
      const support = e.supports[i], f = support.face, n = f.normal;
      if (e.humide > 0) {
        const fu = f.u[0] * D[0] + f.u[1] * D[1] + f.u[2] * D[2], fv = f.v[0] * D[0] + f.v[1] * D[1] + f.v[2] * D[2];
        support.du = (fu * f.vv - fv * f.uv) / f.determinant;
        support.dv = (fv * f.uu - fu * f.uv) / f.determinant;
      }
      if (!reorienter) continue;
      const composante = gx * n[0] + gy * n[1] + gz * n[2], tx = gx - composante * n[0], ty = gy - composante * n[1], tz = gz - composante * n[2];
      const longueur = Math.hypot(tx, ty, tz), m = support.repere;
      if (longueur > 1e-12) {
        const x = tx / longueur, y = ty / longueur, z = tz / longueur;
        if (Object.is(m[0], x) && Object.is(m[1], y) && Object.is(m[2], z)) continue;
        support.pose = -1;
        m[0] = x; m[1] = y; m[2] = z;
        m[6] = m[1] * n[2] - m[2] * n[1]; m[7] = m[2] * n[0] - m[0] * n[2]; m[8] = m[0] * n[1] - m[1] * n[0];
      }
    }
    const charge = e.humide * MAX, allongement = 1 + .65 * clamp(Math.abs(v) / 85, 0, 1);
    for (let i = 0; i < MAX; i++) {
      const g = e.gouttes[i], f = g.face;
      g.force = clamp(charge - i, 0, 1); g.allongement = allongement;
      if (e.humide === 0) { g.u = g.u0; g.v = g.v0; }
      else {
        g.u = Math.max(g.marge[1], g.u0 + g.support.du);
        g.v = Math.max(g.marge[2], g.v0 + g.support.dv);
        const somme = g.u + g.v - g.marge[1] - g.marge[2];
        if (somme > g.libre) { const k = g.libre / somme; g.u = g.marge[1] + (g.u - g.marge[1]) * k; g.v = g.marge[2] + (g.v - g.marge[2]) * k; }
      }
      g.local[0] = f.a[0] + f.u[0] * g.u + f.v[0] * g.v;
      g.local[1] = f.a[1] + f.u[1] * g.u + f.v[1] * g.v;
      g.local[2] = f.a[2] + f.u[2] * g.u + f.v[2] * g.v;
    }
    // Mouillage de la peinture : assombrissement progressif ; les perles apportent les reflets brillants.
    // Les matériaux satinés du modèle sec et ses couleurs d'origine sont conservés/restaurés exactement.
    const teinte = 1 - .12 * e.humide;
    for (let i = 0; i < e.couleurs.length; i++) {
      const c = e.couleurs[i]; c.couleur[0] = c.base[0] * teinte; c.couleur[1] = c.base[1] * teinte; c.couleur[2] = c.base[2] * teinte;
    }
    return true;
  }

  function attitude(M, pose) {
    const h = pose.cap || 0, p = pose.tangage || 0, r = pose.roulis || 0;
    const ch = Math.cos(h), sh = Math.sin(h), cp = Math.cos(p), sp = Math.sin(p), cr = Math.cos(r), sr = Math.sin(r);
    M[0] = ch * cp; M[1] = sp; M[2] = sh * cp;
    M[3] = -ch * sp * cr - sh * sr; M[4] = cp * cr; M[5] = -sh * sp * cr + ch * sr;
    M[6] = ch * sp * sr - sh * cr; M[7] = -cp * sr; M[8] = sh * sp * sr + ch * cr;
  }

  // Diamètre maximal 5,4 mm : ne pas payer des perles devenues sous-pixel parce que la voiture est encore détaillée.
  // Le film coloré continue d'être actualisé même si la projection coupe toutes les perles.
  function detailPour(distance2, tanDemi, hauteur, detailVoiture = 'complet', palier = 'high') {
    if (!(distance2 >= 0) || !Number.isFinite(distance2) || !(tanDemi > 0) || !Number.isFinite(tanDemi) ||
        !(hauteur > 0) || !Number.isFinite(hauteur) || detailVoiture !== 'complet' && detailVoiture !== 'moyen' && detailVoiture !== 'epave') return 'simple';
    const pixels = .0054 * hauteur / (2 * tanDemi * Math.max(.15, Math.sqrt(distance2)));
    if (pixels < .5) return 'simple';
    const petit = palier !== 'high' && palier !== 'medium';
    if (detailVoiture === 'epave') return petit ? 'epave-leger' : pixels < 1.1 || palier === 'medium' ? 'epave-moyen' : 'epave';
    if (detailVoiture === 'moyen') return petit ? 'moyen-leger' : 'moyen';
    return petit ? 'leger' : pixels < 1.1 || palier === 'medium' ? 'moyen' : 'complet';
  }

  function orienterSupport(M, support) {
    const m = support.repere, r = support.rotation;
    const a00 = M[0] * m[0] + M[3] * m[1] + M[6] * m[2], a01 = M[1] * m[0] + M[4] * m[1] + M[7] * m[2], a02 = M[2] * m[0] + M[5] * m[1] + M[8] * m[2];
    const a12 = M[2] * m[3] + M[5] * m[4] + M[8] * m[5], a22 = M[2] * m[6] + M[5] * m[7] + M[8] * m[8];
    r[1] = -Math.asin(clamp(a02, -1, 1));
    if (Math.abs(a02) > 1 - 1e-12) {
      const a10 = M[0] * m[3] + M[3] * m[4] + M[6] * m[5], a11 = M[1] * m[3] + M[4] * m[4] + M[7] * m[5];
      r[0] = Math.atan2(-a02 * a10, a11); r[2] = 0;
    } else { r[0] = Math.atan2(a12, a22); r[2] = Math.atan2(a01, a00); }
  }

  // Appeler juste après voiture.poser/cockpit ; leur matrice renvoyée peut être réutilisée ici.
  // Reposer dans J2/J1/rétros ne change ni humidité, ni barycentriques, ni âge, ni graine.
  function ajouter(sortie, pose, e, lod = 'complet', overlay = false, matrice = null) {
    const limite = typeof LIMITES[lod] === 'number' ? LIMITES[lod] : 0; e.dernierAjout = 0; e.dernierLOD = lod;
    if (!e.actives || !limite) return 0;
    const M = e.matrice, suivante = e.matriceSuivante;
    if (matrice) for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) suivante[c * 3 + r] = matrice[c][r];
    else attitude(suivante, pose);
    // Les vues peuvent partager les rotations si la matrice de la voiture est identique.
    if (e.poseEau === 0 || suivante.some((valeur, i) => !Object.is(valeur, M[i]))) {
      M.set(suivante);
      e.poseEau++;
    }
    const px = pose.p ? pose.p[0] : pose.x, py = pose.p ? pose.p[1] : pose.y, pz = pose.p ? pose.p[2] : pose.z;
    const profilNez=pose.zonesDegats?B.voiture.profilImpact(pose.zonesDegats):0;
    const pas = MAX / limite, masque = lod === 'epave' || lod === 'epave-moyen' || lod === 'epave-leger' ? 4
      : lod === 'moyen' || lod === 'moyen-leger' ? 2 : 1;
    const fin = Math.min(e.actives, MAX);
    for (let i = 0; i < fin; i += pas) {
      const g = e.gouttes[i]; if (!(g.force > 0) || !(g.face.masque & masque)) continue;
      const n=g.face.normal,o=g.objet;
      let x=g.local[0]+n[0]*ECART,y=g.local[1]+n[1]*ECART,z=g.local[2]+n[2]*ECART;
      if(profilNez && x>.98) {
        const point=e.pointNez || (e.pointNez=[0,0,0]);
        point[0]=x;point[1]=y;point[2]=z;
        B.voiture.pointSurNez(g.face.shape,profilNez,point);
        x=point[0];y=point[1];z=point[2];
      }
      o.p[0] = px + M[0] * x + M[3] * y + M[6] * z; o.p[1] = py + M[1] * x + M[4] * y + M[7] * z; o.p[2] = pz + M[2] * x + M[5] * y + M[8] * z;
      const support = g.support;
      if (support.pose !== e.poseEau) {
        orienterSupport(M, support);
        support.pose = e.poseEau;
      }
      const rotation = support.rotation;
      o.r[0] = rotation[0]; o.r[1] = rotation[1]; o.r[2] = rotation[2];
      const rayon = g.rayon * Math.sqrt(g.force);
      o.s[0] = 2 * rayon * g.allongement; o.s[1] = rayon * .9; o.s[2] = 2 * rayon;
      o.overlay = overlay; sortie.push(o); e.dernierAjout++;
    }
    return e.dernierAjout;
  }
  B.eauCarrosserie = Object.freeze({ preparer, mettreAJour, ajouter, detailPour, LIMITES, NOM, FORME, ECART });
})(globalThis.BITUME = globalThis.BITUME || {});
