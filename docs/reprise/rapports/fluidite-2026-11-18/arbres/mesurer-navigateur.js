// Triangles et appels de dessin de l'image entière dans le vrai jeu, sans aucun chrono :
//   node <dépôt>/tools/page-essai.mjs dist/bitume.html mesurer-navigateur.js --taille 1440,757 --dpr 2
// Départ de référence à 800 m, 20 images de mise en route puis 60 images comptées par src/mesures.js (moyenne par
// image du jeu, glace comprise même quand elle n'est rendue qu'une image sur deux). Lots visibles : dernière image.
(
async () => {
  const J = BITUME_JEU;
  const images = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  // Val-Brûlé, Haut-Col, Brume-de-Jade, Cap-Séquoia (indices du catalogue), en Fine puis en Moyenne.
  const cas = [[0, 'high'], [0, 'medium'], [2, 'high'], [2, 'medium'], [5, 'high'], [5, 'medium'], [6, 'high'], [6, 'medium']];
  const sortie = {};
  for (const [circuit, qualite] of cas) {
    J.reference({ circuit, qualite, depart: 800 });
    await images(20);
    J.mesures = true;
    await images(60);
    const m = J.mesures, s = J.rendu.stats, d = J.scene.decor;
    sortie[J.CATALOGUE[circuit].id + '/' + qualite] = {
      image: s.width + 'x' + s.height,
      principale: { triangles: Math.round(m.vues.principale.trianglesParImage), drawCalls: Math.round(m.vues.principale.drawCallsParImage) },
      retro: { triangles: Math.round(m.vues.retro.trianglesParImage), drawCalls: Math.round(m.vues.retro.drawCallsParImage), rendus: m.vues.retro.rendusParImage },
      instant: { triangles: s.triangles, drawCalls: s.drawCalls, lotsVisibles: s.lotsVisibles, lots: s.lots },
      arbres: d.arbres.length, lotsDecor: d.lots.length,
    };
    J.mesures = false;
  }
  return sortie;
}
)()
