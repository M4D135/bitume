/* BITUME — monde statique PhysX : triangles rendus, mobilier réel et obstacles du circuit.
   Aucun profil de hauteur approché, aucune glissière déduite d'une limite de Frenet. */
(function (B) {
  'use strict';
  const GROUPES = Object.freeze({ sol: 1, obstacles: 2, voitures: 4, debris: 8 });
  const SURFACES = [null, 'piste', 'vibreur', 'herbe'], PRIMITIVES = new Map();
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
    if (PRIMITIVES.size) return;
    if (typeof module !== 'undefined' && module.exports && !globalThis.FRender?.shared?.geometry) require('./moteur/renderer.js');
    if (!globalThis.FRender?.shared?.geometry) throw new Error('PhysX : géométrie canonique FERRO absente');
    // Lecture publique du moteur, sans le modifier. Les formes de détail des plantes ne deviennent pas solides.
    const g = globalThis.FRender.shared.geometry();
    for (const nom of ['cylinder', 'bevel', 'octa', 'wedge']) {
      const plage = g.ranges[nom];
      if (!plage) throw new Error('PhysX : primitive FERRO absente (' + nom + ')');
      const vertices = new Float32Array(plage.count * 3), indices = new Uint32Array(plage.count), premier = plage.offset / 4;
      for (let k = 0; k < plage.count; k++) {
        const v = g.indices[premier + k] * 6;
        vertices[k * 3] = g.vertices[v]; vertices[k * 3 + 1] = g.vertices[v + 1]; vertices[k * 3 + 2] = g.vertices[v + 2]; indices[k] = k;
      }
      PRIMITIVES.set(nom, { vertices, indices });
    }
  }
  function primitive(o) {
    vecteur(o.p, 3, 'position'); vecteur(o.s, 3, 'taille');
    if (Array.from(o.s).some(v => v <= 0)) throw new RangeError('PhysX : taille positive requise');
    const pose = { pos: Array.from(o.p), quaternion: quaternion(o.r) };
    if (o.shape === 'box') return { ...pose, half: Array.from(o.s, v => v / 2) };
    primitives();
    const g = PRIMITIVES.get(o.shape);
    if (!g) throw new TypeError('PhysX : forme solide non prise en charge (' + o.shape + ')');
    const vertices = new Float32Array(g.vertices.length);
    for (let k = 0; k < vertices.length; k++) vertices[k] = g.vertices[k] * o.s[k % 3];
    return { ...pose, vertices, indices: g.indices };
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
    const vertices = new Float32Array(s.length / 13 * 3), indices = [], surfaces = [], nb = s.length / 13;
    for (let k = 0; k < nb; k++) for (let a = 0; a < 3; a++) {
      const x = s[k * 13 + a]; if (!Number.isFinite(x)) throw new TypeError('PhysX : sommet non fini');
      vertices[k * 3 + a] = x;
    }
    for (let k = 0; k < entree.length; k += 3) {
      const a = entree[k], b = entree[k + 1], c = entree[k + 2];
      if (![a, b, c].every(i => Number.isInteger(i) && i >= 0 && i < nb)) throw new RangeError('PhysX : indice hors nappe');
      // L'eau est une surface visuelle, jamais une dalle invisible pour les roues ou le châssis.
      if ([a, b, c].every(i => s[i * 13 + 9] === 12)) continue;
      indices.push(a, b, c);
      surfaces.push(n.surfacesPhysX ? n.surfacesPhysX[k / 3] : n.surfaceType === 'accotement' ? 1 : 3);
    }
    return { vertices, indices: new Uint32Array(indices), surfaces: new Uint8Array(surfaces), eauIgnoree: (entree.length - indices.length) / 3 };
  }
  function installer(world, c, decor) {
    if (!world || typeof world.addTriangleMesh !== 'function' || typeof world.addBox !== 'function' || typeof world.remove !== 'function') throw new TypeError('PhysX : monde statique incomplet');
    if (!decor || !Array.isArray(decor.nappes)) throw new TypeError('PhysX : décor absent');
    const montage = { world, ids: [], acteurs: new Map(), libere: false, statistiques: {
      nappes: 0, obstaclesHistoriques: 0, complements: 0, trianglesSol: 0, trianglesObstacles: 0, trianglesEauIgnores: 0
    } };
    const ajouter = (g, info) => {
      const groupe = info.groupe, options = { type: 'static', group: groupe, mask: GROUPES.voitures | GROUPES.debris, queryGroup: groupe,
        friction: groupe === GROUPES.sol ? .8 : .6, restitution: 0, quaternion: g.quaternion || [0, 0, 0, 1] };
      const id = g.half ? world.addBox(g.pos, g.half, options) : world.addTriangleMesh(g.vertices, g.indices, { ...options, pos: g.pos || [0, 0, 0] });
      montage.ids.push(id); montage.acteurs.set(id, info);
      if (g.indices) montage.statistiques[groupe === GROUPES.sol ? 'trianglesSol' : 'trianglesObstacles'] += g.indices.length / 3;
      return id;
    };
    try {
      for (let i = 0; i < decor.nappes.length; i++) {
        const source = decor.nappes[i], g = nappe(source);
        montage.statistiques.trianglesEauIgnores += g.eauIgnoree;
        if (!g.indices.length) continue;
        ajouter(g, { genre: source.surfaceType === 'accotement' ? 'chaussee' : 'terrain', groupe: GROUPES.sol, source: 'nappe', index: i, surfaces: g.surfaces });
        montage.statistiques.nappes++;
      }
      // lotsHerbier conserve les primitives de collision dans leur ordre d'origine, avant les LOD des arbres.
      const lots = decor.lotsHerbier || decor.lots || [], vus = new Set(), sources = [], complements = [];
      for (const lot of lots) for (const o of lot.objets || []) {
        if (vus.has(o)) continue; vus.add(o);
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
  B.solidesPhysX = { installer, liberer, surface, GROUPES };
})(globalThis.BITUME = globalThis.BITUME || {});
