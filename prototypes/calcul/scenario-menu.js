// Lot 28 — chemin réel du joueur dans la page instrumentée : titre → choix d'un autre circuit → préparation (la vitrine
// rebâtit le niveau) → Départ → 2 s de course. Rend les durées, la plus longue image et les chronos par étape.
// Les constantes __CIRCUIT__ et __QUALITE__ sont remplacées par le pilote (prototypes/calcul/serie-page.sh).
(async () => {
  const CIRCUIT = __CIRCUIT__, QUALITE = '__QUALITE__';
  const J = BITUME_JEU, R = J.reglages, B = window.BITUME;
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const attendre = async (f, ms, nom) => { const fin = performance.now() + ms; while (!f()) { if (performance.now() > fin) throw new Error('expiré : ' + nom); await dormir(10); } };
  // chronos sur les fonctions publiques (appelées par le namespace au moment de l'appel)
  const publiques = { circuit: ['creer'], decor: ['construire'], vegetation: ['construire'], obstacles: ['creer'], faune: ['creer', 'dessiner'], effetsSaison: ['creer', 'dessiner'],
    aurores: ['creer', 'dessiner'], course: ['creer', 'pas'], voiture: ['modele', 'poser', 'cockpit', 'glacesCockpit'], traces: ['creer', 'pas', 'dessiner'], ambiance: ['creer'],
    sillage: ['mettreAJour'], meteo: ['avancer'], vitre: ['mettreAJour'], graphismes: ['melange', 'atmosphere'] };
  for (const [m, fs] of Object.entries(publiques)) if (B[m]) for (const f of fs) if (typeof B[m][f] === 'function') B[m][f] = __W(m + '.' + f, B[m][f]);
  const r = J.rendu;
  for (const f of ['setWorld', 'setNappes', 'setLots', 'draw']) r[f] = __W('rendu.' + f, r[f]);
  // moteur des rétroviseurs : créé au premier besoin par jeu.js (majGlaces)
  const creer = window.FRender.create;
  window.FRender.create = function (...a) { const t = performance.now(); const x = creer.apply(this, a); __chronos.set('FRender.create(retro)', { n: 1, total: performance.now() - t, propre: performance.now() - t, pire: 0 });
    for (const f of ['setNappes', 'setLots', 'draw']) x[f] = __W('retro.' + f, x[f]); return x; };
  __chronosLire(true);
  // relevé des images et des tâches longues
  const T = []; let marche = true; const tour = t => { if (!marche) return; T.push(t); requestAnimationFrame(tour); }; requestAnimationFrame(tour);
  const longues = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) longues.push([+e.startTime.toFixed(0), +e.duration.toFixed(0)]); }).observe({ type: 'longtask' }); } catch (e) {}
  Object.assign(R, { circuit: CIRCUIT, qualite: QUALITE, saison: 'ete', moment: 'jour', meteo: 'soleil', saisonMode: 'manuel', momentMode: 'manuel', meteoMode: 'manuel', vibrations: 'non', secousses: 0, vue: 'cockpit', retro: 'oui' });
  void J.profil; // stabilise l'ancre du décor sur la qualité choisie
  try { J.rendu.resize(J.profil.rendu.resolution); } catch (e) {}
  J.pilotageAuto = true;
  const t0 = performance.now();
  document.querySelector('[data-aller="course"]').click();
  await attendre(() => J.ecran === 'preparation' && !document.getElementById('b-depart').disabled && J.session && J.session.i === CIRCUIT, 120000, 'préparation');
  const tPret = performance.now();
  const chronosPrepa = __chronosLire(true);
  await dormir(400);
  const tD = performance.now();
  document.getElementById('b-depart').click();
  await attendre(() => J.ecran === 'course', 120000, 'course');
  const tCourse = performance.now();
  await dormir(2500);
  marche = false;
  const chronosDepart = __chronosLire(true);
  const inter = []; for (let k = 1; k < T.length; k++) inter.push([T[k], T[k] - T[k - 1]]);
  const pire = (a, b) => inter.filter(([t]) => t > a && t <= b).reduce((m, [, d]) => Math.max(m, d), 0);
  const nb = (a, b, s) => inter.filter(([t, d]) => t > a && t <= b && d > s).length;
  return { circuit: CIRCUIT, qualite: QUALITE, ancre: J.ancre, scene: J.scene ? { palier: J.scene.palier, vegetation: J.scene.vegetationQualite } : null,
    preparationMs: +(tPret - t0).toFixed(0), plusLongueImagePreparationMs: +pire(t0, tPret).toFixed(0),
    departMs: +(tCourse - tD).toFixed(0), plusLongueImageDepartMs: +pire(tD, tCourse + 2500).toFixed(0), imagesLonguesCourse2s5: nb(tCourse, tCourse + 2500, 25),
    tachesLongues: longues.filter(l => l[0] >= t0 - 5).map(l => [+(l[0] - t0).toFixed(0), l[1]]).slice(0, 30), chronosPrepa, chronosDepart };
})()
