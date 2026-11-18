// Lot 28A-28C — chemin réel du joueur dans la page instrumentée : titre → préparation sur un autre circuit (la vitrine
// rebâtit le niveau dans le clic) → deux changements de saison dans l'écran de préparation (été → automne → hiver).
// Rend, par étape, la durée, la plus longue image et les chronos (page-instrumentee.py). Dérivé de scenario-menu.js ;
// __CIRCUIT__ est remplacé par le pilote (prototypes/calcul/serie-saison.sh).
(async () => {
  const CIRCUIT = __CIRCUIT__, QUALITE = 'high', SAISONS = ['automne', 'hiver'];
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
  const T = []; let marche = true; const tour = t => { if (!marche) return; T.push(t); requestAnimationFrame(tour); }; requestAnimationFrame(tour);
  // plus long intervalle entre deux images dont la seconde tombe dans ]a, b]
  const pire = (a, b) => { let m = 0; for (let k = 1; k < T.length; k++) if (T[k] > a && T[k] <= b) m = Math.max(m, T[k] - T[k - 1]); return +m.toFixed(0); };
  const pret = () => J.ecran === 'preparation' && !document.getElementById('b-depart').disabled && J.session && J.session.i === CIRCUIT;
  Object.assign(R, { circuit: CIRCUIT, qualite: QUALITE, saison: 'ete', moment: 'jour', meteo: 'soleil', saisonMode: 'manuel', momentMode: 'manuel', meteoMode: 'manuel', vibrations: 'non', secousses: 0, vue: 'cockpit', retro: 'oui' });
  void J.profil; // stabilise l'ancre du décor sur la qualité choisie
  try { J.rendu.resize(J.profil.rendu.resolution); } catch (e) {}
  const etapes = [], fin = async (etape, t0) => { await dormir(150); const t1 = performance.now(); etapes.push({ etape, ms: +(t1 - t0 - 150).toFixed(0), pireImage: pire(t0, t1), chronos: __chronosLire(true) }); };
  __chronosLire(true);
  let t0 = performance.now();
  document.querySelector('[data-aller="course"]').click();
  await attendre(pret, 120000, 'préparation');
  await fin('circuit', t0);
  for (const s of SAISONS) {
    await dormir(600); __chronosLire(true); t0 = performance.now();
    const radio = document.querySelector('input[name="saisonDepart"][value="' + s + '"]');
    radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true }));
    await attendre(() => pret() && J.session.nature.saison.id === s, 120000, 'saison ' + s);
    await fin(s, t0);
  }
  marche = false;
  return { circuit: CIRCUIT, qualite: QUALITE, ancre: J.ancre, scene: J.scene ? { palier: J.scene.palier, vegetation: J.scene.vegetationQualite, saison: J.scene.saison } : null, etapes };
})()
