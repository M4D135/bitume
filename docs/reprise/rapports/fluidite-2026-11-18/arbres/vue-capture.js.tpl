// Vue de capture pour tools/page-essai.mjs (dépôt principal) : remplacer __VUE__ par l'objet de la vue, par
// exemple {circuit:2,qualite:'high',arbre:90,distance:250,fov:60,cible:5.5}, puis
//   node <dépôt>/tools/page-essai.mjs dist/bitume.html vue.js --capture image.png --taille 1440,757 --dpr 2
// s/lateral/hauteur/lacet : pose le long de la piste ; arbre/distance/cible : caméra sur la droite qui joint la piste
// à l'arbre n° arbre de decor.arbres ; force 'proche' ou 'loin' : tous les lots d'arbres dans une seule version.
// Les vues de chaque image du rapport sont listées dans LISEZ-MOI.md.
(async () => {
  const J = BITUME_JEU, B = globalThis.BITUME;
  const images = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const V = __VUE__;
  J.reference({ circuit: V.circuit, qualite: V.qualite, depart: V.depart ?? 800, vue: V.vueJeu || 'cockpit' });
  const c = J.scene.c, d = J.scene.decor;
  let info = {};
  if (V.s !== undefined) {
    const e = B.circuit.echantillon(c, V.s), ca = Math.cos(e.cap), sa = Math.sin(e.cap);
    const x = e.x - sa * V.lateral - ca * (V.recul || 0), z = e.z + ca * V.lateral - sa * (V.recul || 0);
    const y = (d.sol(x, z) ?? e.y) + V.hauteur;
    // regard : cap + π regarde à droite de la piste, cap à gauche, cap + π/2 devant
    const pose = { pos: [x, y, z], yaw: e.cap + V.lacet, pitch: V.tangage || 0, fov: V.fov || 60 };
    J.camera = () => pose;
  } else if (V.arbre !== undefined) {
    // caméra à V.distance du tronc choisi, sur la droite qui joint la piste à l'arbre, regard sur le milieu de l'arbre
    const [tx, tz] = d.arbres[V.arbre];
    let best = Infinity, bi = 0;
    for (let i = 0; i < c.n; i++) { const q = (c.x[i] - tx) ** 2 + (c.z[i] - tz) ** 2; if (q < best) { best = q; bi = i; } }
    const vx = c.x[bi] - tx, vz = c.z[bi] - tz, l = Math.hypot(vx, vz) || 1;
    const x = tx + vx / l * V.distance, z = tz + vz / l * V.distance, y = (d.sol(x, z) ?? 0) + (V.hauteur || 1.6);
    const ty = (d.sol(tx, tz) ?? 0) + (V.cible || 4);
    const yaw = Math.atan2(tx - x, -(tz - z)), pitch = Math.atan2(ty - y, Math.hypot(tx - x, tz - z));
    const pose = { pos: [x, y, z], yaw, pitch, fov: V.fov || 60 };
    J.camera = () => pose;
    info = { arbre: [tx, tz], distancePiste: Math.sqrt(best), camera: pose.pos };
  }
  const arbre = o => o.collision === 'tronc' || /^arbre-|^foliage$/.test(o.shape || '');
  const lotsArbres = d.lots.filter(l => l.objets.some(arbre));
  if (V.force === 'proche') for (const l of lotsArbres) l.bascule = 1e9;
  if (V.force === 'loin') {
    // la version lointaine prend la place de la proche dans le moteur, et toutes les versions « proches » sont tirées
    await images(2);
    for (const l of lotsArbres) if (l.paquetLoin) {
      [l.paquet, l.paquetLoin] = [l.paquetLoin, l.paquet]; [l.tampon, l.tamponLoin] = [l.tamponLoin, l.tampon]; l.bascule = 1e9;
    }
  }
  await images(V.images || 40);
  const s = J.rendu.stats;
  return { ...info, triangles: s.triangles, drawCalls: s.drawCalls, lotsVisibles: s.lotsVisibles, lots: s.lots, lotsArbres: lotsArbres.length, image: s.width + 'x' + s.height };
})()
