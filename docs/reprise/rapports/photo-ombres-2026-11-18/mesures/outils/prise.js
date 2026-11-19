(async () => {
  // Prise déterministe : boucle du jeu gelée puis menée à instants commandés, hasard réamorcé. Mêmes poses d'une
  // construction à l'autre ; seule l'image change.
  const J = BITUME_JEU, B = globalThis.BITUME, R = J.rendu, gl = R.gl;
  if (window.FPhysX && FPhysX.init) { try { await FPhysX.init(); } catch (e) {} }
  const vraiRAF = window.requestAnimationFrame.bind(window), image = () => new Promise(r => vraiRAF(r));
  const file = [];
  window.requestAnimationFrame = cb => (cb.name === 'image') ? (file.push(cb), 0) : vraiRAF(cb);
  await image(); await image(); await image();
  let graine = 17017; Math.random = () => { graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0; return graine / 4294967296; };
  const REF = __REF__;
  J.reference(REF);
  const c = J.scene.c, d = J.scene.decor;
  const ech = s => B.circuit.echantillon(c, ((s % c.longueur) + c.longueur) % c.longueur);
  const sol = (x, z, y) => { const h = d.sol ? d.sol(x, z) : null; return Number.isFinite(h) ? h : y; };
  const cote = (s, lateral, hauteur, lacet, tangage, fov) => {
    const e = ech(s), ca = Math.cos(e.cap), sa = Math.sin(e.cap);
    const x = e.x - sa * lateral, z = e.z + ca * lateral;
    return { pos: [x, sol(x, z, e.y) + hauteur, z], yaw: e.cap + Math.PI / 2 + lacet, pitch: tangage, fov };
  };
  const viser = (pos, cible, fov) => { const dx = cible[0] - pos[0], dy = cible[1] - pos[1], dz = cible[2] - pos[2];
    return { pos, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), fov }; };
  let info = {};
  __CAM__
  // 19/11 : le voile de chargement aussi. Il s'efface en 0,3 s de temps réel (style.css, .chargement.fini) ; selon la
  // charge de la machine, la prise tombait pendant ce fondu et toute l'image était plus ou moins sombre d'un tirage à
  // l'autre (jusqu'à 9,5 niveaux sur le ciel de la tribune).
  for (const id of ['hud', 'h-fps', 'classement', 'zone-carte', 'message', 'sous-message', 'feux', 'jauge-derive', 'tactile', 'b-pause', 'aide-console', 'vignette', 'chargement']) {
    const el = document.getElementById(id); if (el) el.style.visibility = 'hidden';
  }
  // Et toute transition de la page : la vue de course (#vue-course) apparaît elle aussi en 0,3 s de temps réel
  // (style.css). Une prise faite moins de 50 images après le lancement tombait pendant ce fondu, plus ou moins avancé
  // selon la charge : toute l'image changeait d'une prise à l'autre (jusqu'à 12 niveaux en moyenne, vues 5, 6, 10, 11).
  const fige = document.createElement('style');
  fige.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
  document.head.appendChild(fige);
  const retouche = __FX__, orig = R.draw;
  if (retouche) R.draw = function (cam, sortie, fx) { return orig.call(this, cam, sortie, Object.assign({}, fx, retouche)); };
  let t = 1000; const PAS = 1000 / 60;
  for (let k = 0; k < __N__; k++) { t += PAS; for (const cb of file.splice(0)) cb(t); }
  R.draw = orig;
  __EXTRA__
  const s = R.stats, S = J.session, j = S.course.joueur;
  return Object.assign({ moteur: window.FERRO && FERRO.version, triangles: s.triangles, appels: s.drawCalls, ombre: s.shadowMapSize, msaa: s.msaa, halo: s.bloom,
    image: s.width + 'x' + s.height, s: +j.etat.s.toFixed(2), creations: s.creations, photo: s.ombresPhoto || null }, info);
})()
