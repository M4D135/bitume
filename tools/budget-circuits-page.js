/* Budget de rendu par circuit et qualité pour BITUME.
   Mesure les temps de construction (indicatifs), les statistiques de rendu (drawCalls, triangles, instances)
   à 6 poses par circuit, et les créations d'objets GL pendant une course.
   Usage :
     node tools/page-essai.mjs 'file:///chemin/dist/bitume.html#circuits=route-des-cimes&qualites=high,medium,low' tools/budget-circuits-page.js > mesures.json
*/
(async () => {
  const J = window.BITUME_JEU;
  const B = window.BITUME;
  const params = new URLSearchParams(location.hash.slice(1));

  // 1. Paramètres
  let circuitsIds = params.get('circuits');
  let qualitesStr = params.get('qualites') || 'high,medium,low';
  const repetitions = parseInt(params.get('repetitions') || '3', 10);
  const imagesCourse = parseInt(params.get('images') || '300', 10);

  const qualites = qualitesStr.split(',').map(q => q.trim());
  const catalogIds = J.CATALOGUE.map(c => c.id);
  
  let circuitsIndices = [];
  if (circuitsIds) {
    circuitsIds = circuitsIds.split(',').map(id => id.trim());
    circuitsIndices = circuitsIds.map(id => {
      const idx = catalogIds.indexOf(id);
      if (idx === -1) throw new Error('Identifiant de circuit inconnu : ' + id);
      return idx;
    });
  } else {
    circuitsIndices = J.CATALOGUE.map((_, i) => i);
  }

  // 2. Outils
  const image = () => new Promise(r => requestAnimationFrame(() => r()));
  const images = async (n) => { for (let i = 0; i < n; i++) await image(); };
  
  const mediane = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  
  const arrondi = (v) => Math.round(v * 10) / 10;

  // Les rivaux partent à l'autre bout du tour, à l'arrêt, en file (même geste que ECARTER_RIVAUX de
  // tools/tour-captures.mjs) : la vue ne compte que le circuit, son décor et la voiture du joueur.
  const ecarter = () => {
    const S = J.session, co = S.course, c = co.c, L = c.longueur, s0 = S.reference.depart;
    co.voitures.forEach((v, n) => {
      if (v.joueur) return;
      const et = v.etat;
      et.s = (s0 + L / 2 + n * 14) % L; et.d = n % 2 ? 3 : -3; et.v = 0;
      const e = B.circuit.echantillon(c, et.s);
      et.y = e.y - et.d * Math.sin(e.devers); co.sAvant[v.id] = et.s; v.roule = et.s;
    });
  };

  const base = { 
    mode: 'solo', vue: 'cockpit', graine: 17017, meteo: 'sec', 
    moment: 'jour', saison: 'ete', decor: 'enrichi', retro: 'oui', tours: 3 
  };

  const resultats = [];

  // 3. Mesures
  for (const i of circuitsIndices) {
    const circuitInfo = J.CATALOGUE[i];
    const circuitResultat = {
      id: circuitInfo.id,
      nom: circuitInfo.nom,
      longueur: 0,
      qualites: {}
    };

    for (const q of qualites) {
      console.info(`budget ${circuitInfo.id} ${q} : ${repetitions} constructions`);
      
      // a) Construction
      const constructionsMs = [];
      const premiereImageMs = [];
      
      for (let r = 0; r < repetitions; r++) {
        // Défaite de la scène précédente en installant un autre circuit
        const autreIdx = (i + 1) % J.CATALOGUE.length;
        J.reference({ ...base, circuit: autreIdx, qualite: q, depart: 0, vitesse: 0, pilote: false });
        await images(2);
        
        const t0 = performance.now();
        J.reference({ ...base, circuit: i, qualite: q, depart: 0, vitesse: 0, pilote: false });
        const t1 = performance.now();
        await images(2);
        const t2 = performance.now();
        
        constructionsMs.push(t1 - t0);
        premiereImageMs.push(t2 - t0);
      }

      // b) Six poses
      J.reference({ ...base, circuit: i, qualite: q, depart: 0, vitesse: 0, pilote: false });
      const L = J.session.course.c.longueur;
      circuitResultat.longueur = L;
      
      const poses = [];
      let maxTriangles = -1;
      let plusChargePose = null;
      let maxDrawCalls = 0;

      for (let k = 0; k < 6; k++) {
        const s = Math.round(L * k / 6) + 100;
        J.reference({ ...base, circuit: i, qualite: q, depart: s, vitesse: 40, pilote: true });
        ecarter();
        await images(8);
        
        const stats = J.rendu.stats;
        const pose = {
          s: s,
          drawCalls: stats.drawCalls,
          triangles: Math.round(stats.triangles),
          instances: stats.instances
        };
        poses.push(pose);
        
        if (pose.triangles > maxTriangles) {
          maxTriangles = pose.triangles;
          plusChargePose = pose;
        }
        if (pose.drawCalls > maxDrawCalls) {
          maxDrawCalls = pose.drawCalls;
        }
      }

      // c) Créations pendant la course
      await images(30);
      const c0 = J.rendu.stats.creations;
      await images(imagesCourse);
      const c1 = J.rendu.stats.creations;
      
      circuitResultat.qualites[q] = {
        constructionMs: arrondi(mediane(constructionsMs)),
        constructionsMs: constructionsMs.map(arrondi),
        premiereImageMs: arrondi(mediane(premiereImageMs)),
        poses: poses,
        plusCharge: plusChargePose,
        drawCallsMax: maxDrawCalls,
        creationsCourse: c1 - c0,
        imagesCourse: imagesCourse
      };
    }
    resultats.push(circuitResultat);
  }

  // 5. Fin
  J.reference({ ...base, circuit: 0, qualite: 'high', depart: 0, vitesse: 0, pilote: false });

  return {
    taille: [innerWidth, innerHeight],
    date: new Date().toISOString(),
    qualites: qualites,
    repetitions: repetitions,
    circuits: resultats
  };
})();
