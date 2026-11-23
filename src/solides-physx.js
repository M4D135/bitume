/* BITUME — monde statique PhysX : triangles rendus, mobilier réel et obstacles du circuit.
   Aucun profil de hauteur approché, aucune glissière déduite d'une limite de Frenet. */
(function (B) {
  'use strict';
  const GROUPES = Object.freeze({ sol: 1, obstacles: 2, voitures: 4, debris: 8 });
  const SURFACES = [null, 'piste', 'vibreur', 'herbe'];
  let primitivesPhysiques;
  const vecteur = (v, n, nom) => {
    if ((!Array.isArray(v) && !ArrayBuffer.isView(v)) || v.length !== n || !Array.from(v).every(Number.isFinite)) throw new TypeError('PhysX : ' + nom);
  };
  // Même rotation Rz·Ry·Rx que les instances FERRO ; la physique garde aussi pente et inclinaison.
  function quaternion(r = [0, 0, 0]) {
    vecteur(r, 3, 'rotation');
    const [x, y, z] = r.map(v => v / 2), cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    return [sx * cy * cz - cx * sy * sz, cx * sy * cz + sx * cy * sz, cx * cy * sz - sx * sy * cz, cx * cy * cz + sx * sy * sz];
  }
  function primitives() {
    if (primitivesPhysiques) return primitivesPhysiques;
    if (typeof module !== 'undefined' && module.exports && !globalThis.FRender?.shared?.geometry) require('./ferro/render-shared.js');
    if (!globalThis.FRender?.shared?.geometry) throw new Error('PhysX : géométrie canonique FERRO absente');
    // Lecture publique du moteur, sans le modifier. Les formes de détail des plantes ne deviennent pas solides.
    const g = globalThis.FRender.shared.geometry(), maillages = new Map();
    for (const nom of ['cylinder', 'bevel', 'octa', 'wedge']) {
      const plage = g.ranges[nom];
      if (!plage) throw new Error('PhysX : primitive FERRO absente (' + nom + ')');
      const vertices = new Float32Array(plage.count * 3), indices = new Uint32Array(plage.count), premier = plage.offset / 4;
      for (let k = 0; k < plage.count; k++) {
        const v = g.indices[premier + k] * 6;
        vertices[k * 3] = g.vertices[v]; vertices[k * 3 + 1] = g.vertices[v + 1]; vertices[k * 3 + 2] = g.vertices[v + 2]; indices[k] = k;
      }
      maillages.set(nom, { vertices, indices });
    }
    primitivesPhysiques = maillages;
    return maillages;
  }
  // geometry() assemble aussi toutes les formes libres inscrites dans FERRO. Dans la page, ce module
  // suit immédiatement le renderer : seules ses primitives sont alors présentes. Une entrée autonome
  // chargée plus tard garde la lecture à la demande lors de son premier solide non cubique.
  const partage = globalThis.FRender?.shared;
  if (partage?.shapes?.size === 0 && typeof partage.geometry === 'function') primitives();
  function primitive(o) {
    vecteur(o.p, 3, 'position'); vecteur(o.s, 3, 'taille');
    if (Array.from(o.s).some(v => v <= 0)) throw new RangeError('PhysX : taille positive requise');
    const pose = { pos: Array.from(o.p), quaternion: quaternion(o.r) };
    if (o.shape === 'box') return { ...pose, half: Array.from(o.s, v => v / 2) };
    const maillage = o.solidePhysX?.maillage;
    if (!maillage && typeof o.shape === 'string' && o.shape.startsWith('bitume-lieu-')) return { ...pose, half: Array.from(o.s, v => v * .44) };
    const g = maillage || primitives().get(o.shape);
    if (!g) throw new TypeError('PhysX : forme solide non prise en charge (' + o.shape + ')');
    const vertices = new Float32Array(g.vertices.length);
    for (let k = 0; k < vertices.length; k++) vertices[k] = g.vertices[k] * o.s[k % 3];
    return { ...pose, vertices, indices: g.indices };
  }
  function creerMobile(world, modele) {
    const m = modele.mobilePhysX;
    let sections = m.sections;
    if (!sections) {
      const points = new Map();
      for (const face of B.lieux.FORMES[modele.shape])
        for (let k=0; k<3; k++) points.set(face[k].join(','), face[k]);
      sections = [Array.from(points.values())];
    }
    const formes = sections.map(section => {
      const vertices = new Float32Array(section.length * 3);
      section.forEach((v, k) => {
        for (let j=0; j<3; j++) vertices[3*k+j] = v[j] * modele.s[j];
      });
      return { type: 'convex', vertices };
    });
    const pos = modele.p.slice(), rot = modele.r.slice(), q = quaternion(rot);
    const id = world.addCompound(pos, formes, { type: 'dynamic', mass: m.masse, quaternion: q,
      group: GROUPES.obstacles, mask: GROUPES.sol | GROUPES.obstacles | GROUPES.voitures | GROUPES.debris,
      queryGroup: GROUPES.obstacles, friction: .85, restitution: .025, angularDamping: .35 });
    return { id, pose: [...pos,...q], objet: { ...modele, p: pos, r: rot },
      rayon: .5 * Math.hypot(...modele.s) };
  }

  // Les lots immuables du GPU ne contiennent aucun double du rocher à sa position de départ.
  // Une séance et son rejeu possèdent chacun les instances de leur propre monde PhysX.
  function lireMobiles(montage) {
    for (const m of montage.mobiles) {
      const pose = montage.world.readPose(m.id, m.pose), o = m.objet;
      const x=pose[3], y=pose[4], z=pose[5], w=pose[6];
      o.p[0]=pose[0]; o.p[1]=pose[1]; o.p[2]=pose[2];
      o.r[0]=Math.atan2(2*(w*x+y*z),1-2*(x*x+y*y));
      o.r[1]=Math.asin(Math.max(-1,Math.min(1,2*(w*y-z*x))));
      o.r[2]=Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z));
    }
  }
  function depuisObstacle(o) {
    if (o.type === 'prism') {
      if (o.sides !== 16) throw new TypeError('PhysX : prisme différent du cylindre FERRO');
      return { shape: 'cylinder', p: o.p, s: o.s, r: o.r };
    }
    if (o.type === 'box') return { shape: 'box', p: [o.x, (o.ymin + o.ymax) / 2, o.z], s: [2 * o.hx, o.ymax - o.ymin, 2 * o.hz], r: [0, -(o.angle || 0), 0] };
    if (o.type === 'circle') return { shape: 'cylinder', p: [o.x, (o.ymin + o.ymax) / 2, o.z], s: [2 * o.r, o.ymax - o.ymin, 2 * o.r] };
    throw new TypeError('PhysX : obstacle non pris en charge (' + o.type + ')');
  }
  function nappe(n) {
    const s = n.sommets, entree = n.indices;
    if (!s || s.length % 13 || !entree || entree.length % 3) throw new TypeError('PhysX : nappe invalide');
    const nb = s.length / 13, vertices = new Float32Array(nb * 3);
    const indices = new Uint32Array(entree.length), surfaces = new Uint8Array(entree.length / 3);
    const surfaceDefaut = n.surfaceType === 'accotement' ? 1 : 3;
    let faces = 0;
    for (let k = 0; k < nb; k++) for (let a = 0; a < 3; a++) {
      const x = s[k * 13 + a]; if (!Number.isFinite(x)) throw new TypeError('PhysX : sommet non fini');
      vertices[k * 3 + a] = x;
    }
    const indiceValide = i => Number.isInteger(i) && i >= 0 && i < nb;
    for (let k = 0; k < entree.length; k += 3) {
      const a = entree[k], b = entree[k + 1], c = entree[k + 2];
      if (!indiceValide(a) || !indiceValide(b) || !indiceValide(c)) throw new RangeError('PhysX : indice hors nappe');
      // L'eau est visuelle. Compacter directement dans les tampons utilisés par PhysX.
      if (s[a * 13 + 9] === 12 && s[b * 13 + 9] === 12 && s[c * 13 + 9] === 12) continue;
      indices[faces * 3] = a; indices[faces * 3 + 1] = b; indices[faces * 3 + 2] = c;
      surfaces[faces++] = n.surfacesPhysX ? n.surfacesPhysX[k / 3] : surfaceDefaut;
    }
    return { vertices, indices: indices.subarray(0, faces * 3), surfaces: surfaces.subarray(0, faces), eauIgnoree: entree.length / 3 - faces };
  }
  function installer(world, c, decor) {
    if (!world || typeof world.addTriangleMesh !== 'function' || typeof world.addBox !== 'function' || typeof world.remove !== 'function') throw new TypeError('PhysX : monde statique incomplet');
    if (!decor || !Array.isArray(decor.nappes)) throw new TypeError('PhysX : décor absent');
    const montage = { world, ids: [], mobiles: [], acteurs: new Map(), libere: false, statistiques: {
      nappes: 0, obstaclesHistoriques: 0, complements: 0, trianglesSol: 0, trianglesObstacles: 0, trianglesEauIgnores: 0
    } };
    const ajouter = (g, info) => {
      const groupe = info.groupe, options = { type: 'static', group: groupe, mask: GROUPES.voitures | GROUPES.debris | (decor.mobilesPhysX?.length ? GROUPES.obstacles : 0), queryGroup: groupe,
        friction: groupe === GROUPES.sol ? .8 : .6, restitution: 0, quaternion: g.quaternion || [0, 0, 0, 1] };
      const id = g.half ? world.addBox(g.pos, g.half, options) : world.addTriangleMesh(g.vertices, g.indices, { ...options, pos: g.pos || [0, 0, 0] });
      montage.ids.push(id); montage.acteurs.set(id, info);
      if (g.indices) montage.statistiques[groupe === GROUPES.sol ? 'trianglesSol' : 'trianglesObstacles'] += g.indices.length / 3;
      return id;
    };
    try {
      for (let i = 0; i < decor.nappes.length; i++) {
        const source = decor.nappes[i];
        if (source.surfaceType === 'panorama') continue;
        const g = nappe(source);
        montage.statistiques.trianglesEauIgnores += g.eauIgnoree;
        if (!g.indices.length) continue;
        ajouter(g, { genre: source.surfaceType === 'accotement' ? 'chaussee' : 'terrain', groupe: GROUPES.sol, source: 'nappe', index: i, surfaces: g.surfaces });
        montage.statistiques.nappes++;
      }
      // lotsHerbier conserve les primitives de collision dans leur ordre d'origine, avant les LOD des arbres.
      const lots = decor.lotsHerbier || decor.lots || [], vus = new Set(), sources = [], complements = [];
      for (const lot of lots) for (const o of lot.objets || []) {
        if ((!o.collision && !o.solidePhysX) || vus.has(o)) continue;
        vus.add(o);
        if (o.collision) sources.push(o);
        else if (o.solidePhysX) complements.push(o);
      }
      const obstacles = c?.obstacles?.objets || decor.obstacles || [];
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i], source = sources[i];
        // Les vrais biseaux, cylindres et rotations du décor priment sur leur ancien rectangle de collision.
        const exact = source && source.collision === o.genre && source.p[0] === (o.type === 'prism' ? o.p[0] : o.x) && source.p[2] === (o.type === 'prism' ? o.p[2] : o.z);
        ajouter(primitive(exact ? source : depuisObstacle(o)), { genre: o.genre || 'obstacle', groupe: GROUPES.obstacles, source: 'obstacle', index: i });
        montage.statistiques.obstaclesHistoriques++;
      }
      for (let i = 0; i < complements.length; i++) {
        const o = complements[i], m = o.solidePhysX;
        if (m.groupe !== GROUPES.sol && m.groupe !== GROUPES.obstacles) throw new TypeError('PhysX : groupe statique invalide');
        ajouter(primitive(o), { genre: m.genre, groupe: m.groupe, surface: m.surface, source: 'primitive', index: i });
        montage.statistiques.complements++;
      }
      for (const modele of decor.mobilesPhysX || []) {
        const mobile = creerMobile(world, modele);
        montage.ids.push(mobile.id); montage.mobiles.push(mobile);
        montage.acteurs.set(mobile.id, {genre: modele.mobilePhysX.genre, groupe: GROUPES.obstacles, source: 'mobile'});
      }
      return montage;
    } catch (erreur) {
      try { liberer(montage); } catch (nettoyage) { erreur.nettoyage = nettoyage; }
      throw erreur;
    }
  }
  function surface(montage, id, faceIndex = -1) {
    const a = montage?.acteurs.get(id);
    if (!a || a.groupe !== GROUPES.sol) return null;
    return a.surface || (a.surfaces && SURFACES[a.surfaces[faceIndex]]) || (a.genre === 'terrain' ? 'herbe' : 'piste');
  }
  function liberer(montage) {
    if (!montage || montage.libere) return;
    let premiereErreur = null;
    for (let k = montage.ids.length - 1; k >= 0; k--) {
      const id = montage.ids[k];
      try { montage.world.remove(id); montage.acteurs.delete(id); montage.ids.splice(k, 1); }
      catch (e) { premiereErreur ||= e; }
    }
    montage.libere = montage.ids.length === 0;
    if (premiereErreur) throw premiereErreur;
  }
  B.solidesPhysX = { installer, lireMobiles, liberer, surface, GROUPES };
})(globalThis.BITUME = globalThis.BITUME || {});
