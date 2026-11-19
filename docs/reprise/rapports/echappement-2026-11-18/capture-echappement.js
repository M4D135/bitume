// Mise en scène d'une capture des flammes d'échappement (lot 20), pour tools/page-essai.mjs.
// PARAMS est remplacé par captures.sh : moment (jour, nuit), cas (passage, gros-plan, lever, rival, retro), circuit,
// graine.
// La course de référence part à 40 m/s ; la boucle du jeu est figée (acc très négatif) et l'on avance pas à pas
// jusqu'à l'événement voulu, puis jusqu'à l'instant où sa flamme est au plus fort. Mesures : objets dessinés,
// instances d'effets et appels de dessin avec puis sans les flammes, coût en µs du dessin et du pas dans la page.
(async () => {
  const P = PARAMS;
  const J = BITUME_JEU, B = BITUME, DT = 1 / 120;
  const attendre = ms => new Promise(r => setTimeout(r, ms));
  J.reference({ circuit: P.circuit, graine: P.graine, vue: P.cas === 'retro' ? 'cockpit' : 'poursuite', moment: P.moment, vitesse: P.vitesse || 40, pilote: true, qualite: P.qualite || 'high' });
  const S = J.session, co = S.course, E = S.ech, j = co.joueur.id;
  if (!E) return { erreur: 'pas de module d’échappement dans cette construction' };
  const figer = () => { S.acc = -1e9; };
  figer();
  const devant = (k, q) => {   // position de q dans le repère de k : x vers l'avant
    const a = S.cour[k], b = S.cour[q], ca = Math.cos(a.cap), sa = Math.sin(a.cap), ex = b.x - a.x, ez = b.z - a.z;
    return { x: ex * ca + ez * sa, z: ez * ca - ex * sa };
  };
  // flammes posées par l'événement e (un crépitement part à l'instant exact de l'événement) : tubes et teinte
  const NS = B.echappement.SORTIES.length, K = B.echappement.IMPULSIONS;
  const flammes = e => {
    let n = 0, orangees = 0;
    for (let q = e.voiture * NS * K; q < (e.voiture + 1) * NS * K; q++) if (E.impT0[q] === e.t) { n++; if (E.impTeinte[q] >= .5) orangees++; }
    return { n, orangees };
  };
  let derniereDet = -9;
  const choisir = e => {
    if (e.voiture === j && e.genre === 'detonation') derniereDet = e.t;
    if (P.cas === 'passage' || P.cas === 'gros-plan') return e.voiture === j && e.genre === 'detonation' && e.force > .8;
    // lever de pied : le premier crépitement franc de la combinaison la plus fréquente, un banc entier et orangé
    // (55 % × 75 %) ; le premier venu, essayé d'abord, était un tube seul en bleu, à peine visible de jour
    if (P.cas === 'lever') {
      if (e.voiture !== j || e.genre !== 'crepitement' || e.force <= .5 || e.t - derniereDet <= .3) return false;
      const f = flammes(e); return f.n >= 2 && f.orangees === f.n;
    }
    if (P.cas === 'rival') { if (e.voiture === j || e.genre !== 'detonation' || e.force < .8) return false; const d = devant(j, e.voiture); return d.x > 8 && d.x < 80; }
    if (P.cas === 'retro') { if (e.voiture === j || e.genre !== 'detonation') return false; const d = devant(j, e.voiture); return d.x < -4 && d.x > -26 && Math.abs(d.z) < 4; }
    return false;
  };
  let lu = E.son.n, cible = null, pas = 0;
  while (!cible && pas < 120 * 60) {
    J.avancer(DT, true); figer(); pas++;
    for (; lu < E.son.n && !cible; lu++) { const e = E.son.liste[lu % E.son.taille]; if (choisir(e)) cible = { voiture: e.voiture, genre: e.genre, t: e.t, force: e.force }; }
  }
  if (!cible) return { erreur: 'aucun événement retenu en ' + (pas / 120).toFixed(1) + ' s' };
  const delai = P.delai ?? (cible.genre === 'detonation' ? .022 : .012);
  while (co.horloge - DT < cible.t + delai) { J.avancer(DT, true); figer(); }
  if (P.cas === 'rival' || P.cas === 'gros-plan') {
    // caméra libre derrière la voiture : le rival à 8 m, un peu au-dessus ; le gros plan à 3,6 m, à hauteur des tubes
    const proche = P.cas === 'gros-plan', d = proche ? 3.6 : 8, cote = proche ? .9 : .7, haut = proche ? 1.05 : 2.1;
    J.camera = () => {
      const p = S.prec[cible.voiture], f = [Math.cos(p.cap), Math.sin(p.cap)];
      const pos = [p.x - f[0] * d - f[1] * cote, p.y + haut, p.z - f[1] * d + f[0] * cote], vise = [p.x - f[0] * (proche ? 2.3 : 1.2), p.y + (proche ? .35 : .45), p.z - f[1] * (proche ? 2.3 : 1.2)];
      const dx = vise[0] - pos[0], dy = vise[1] - pos[1], dz = vise[2] - pos[2], l = Math.hypot(dx, dy, dz);
      return { pos, yaw: Math.atan2(dx, -dz), pitch: Math.asin(dy / l), fov: proche ? 50 : 42 };
    };
  }
  await attendre(900);
  const st = () => ({ appels: J.rendu.stats.drawCalls, instances: J.rendu.stats.instances, effets: J.rendu.stats.fxInstances });
  const avec = st(), objets = E.dessines;
  // coût dans la page : le dessin de l'image figée, puis un pas sans événement (même horloge)
  const tmp = [], poses = S.prec.map(p => ({ ...p })), t = co.horloge - DT;
  let t0 = performance.now();
  for (let i = 0; i < 4000; i++) { tmp.length = 0; B.echappement.dessiner(E, tmp, poses, t); }
  const dessin = (performance.now() - t0) / 4000 * 1000;
  t0 = performance.now();
  for (let i = 0; i < 4000; i++) B.echappement.pas(E, co.voitures, co.horloge);
  const pasUs = (performance.now() - t0) / 4000 * 1000;
  S.ech = null; await attendre(400);
  const sans = st();
  S.ech = E; await attendre(700);
  return { cas: P.cas, moment: P.moment, cible, horloge: co.horloge, apres: +(co.horloge - DT - cible.t).toFixed(4), objets, avec, sans, dessinUs: +dessin.toFixed(2), pasUs: +pasUs.toFixed(2),
    voiture: { rapport: co.voitures[cible.voiture].etat.rapport, kmh: Math.round(co.voitures[cible.voiture].etat.v * 3.6) }, son: J.son };
})()
