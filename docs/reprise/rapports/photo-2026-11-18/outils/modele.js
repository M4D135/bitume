(async () => {
  // Modèle de prise de vue du lot 21 : séance figée, caméra libre, affichage de course masqué.
  const J = BITUME_JEU, B = globalThis.BITUME;
  const images = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const REF = __REF__;
  J.reference(REF);
  const c = J.scene.c, d = J.scene.decor;
  const ech = s => B.circuit.echantillon(c, ((s % c.longueur) + c.longueur) % c.longueur);
  const sol = (x, z, y) => { const h = d.sol ? d.sol(x, z) : null; return Number.isFinite(h) ? h : y; };
  // pose au bord de la piste : abscisse s, décalage latéral (> 0 à droite), hauteur au-dessus du sol, lacet relatif
  // (0 = devant, π/2 = à droite... selon FERRO yaw = cap + π/2 regarde devant), tangage, champ
  const cote = (s, lateral, hauteur, lacet, tangage, fov, recul = 0) => {
    const e = ech(s), ca = Math.cos(e.cap), sa = Math.sin(e.cap);
    const x = e.x - sa * lateral - ca * recul, z = e.z + ca * lateral - sa * recul;
    const y = Math.max(sol(x, z, e.y), e.y - 50) + hauteur;
    return { pos: [x, y, z], yaw: e.cap + Math.PI / 2 + lacet, pitch: tangage, fov };
  };
  // regarder un point depuis une position
  const viser = (pos, cible, fov) => {
    const dx = cible[0] - pos[0], dy = cible[1] - pos[1], dz = cible[2] - pos[2];
    return { pos, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), fov };
  };
  let info = {};
  __CAM__
  if (__HUD__) for (const id of ['hud', 'h-fps', 'classement', 'zone-carte', 'message', 'sous-message', 'feux', 'jauge-derive', 'tactile', 'b-pause', 'aide-console']) {
    const el = document.getElementById(id); if (el) el.style.visibility = 'hidden';
  }
  await images(__N__);
  __EXTRA__
  const s = J.rendu.stats;
  return Object.assign({ triangles: s.triangles, appels: s.drawCalls, ombre: s.shadowMapSize, msaa: s.msaa, halo: s.bloom, reflets: s.reflections,
    image: s.width + 'x' + s.height, moment: J.session.reference && J.session.reference.moment, saison: J.session.reference && J.session.reference.saison }, info);
})()
