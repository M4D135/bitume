// Lot 20 : combien de ratés au rupteur sur la grille (voiture à l'arrêt) dans une vraie course de 20 s, toutes les
// voitures menées par l'IA ? Lancer depuis la racine du dépôt : node docs/reprise/rapports/echappement-2026-11-18/grille.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'src');
const charger = f => createRequire(import.meta.url)(path.join(src, f));
for (const f of ['circuit.js', 'conduite.js', 'course.js', 'carene.js', 'main.js', 'voiture.js']) charger(f);
globalThis.window = { FRender: { forme: () => {} } };
charger('echappement.js');
delete globalThis.window;
const B = globalThis.BITUME, X = B.echappement, DT = 1 / 120;
for (const graine of [5, 17017]) {
  const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const co = B.course.creer(c, { mode: 'course', tours: 3, difficulte: 1, rivaux: 11, graine, placeJoueur: 8 });
  const E = X.creer(co.voitures.length, graine);
  let lu = 0, vert = null; const arret = new Set(), parVoiture = {};
  let ratesArret = 0, ratesTotal = 0, maxRegimeArret = 0;
  for (let i = 1; i <= 20 * 120; i++) {
    const ev = B.course.pas(co, B.course.commandesIA(co, co.joueur), DT);
    for (const e of ev) if (e.type === 'vert' && vert === null) vert = co.horloge;
    X.pas(E, co.voitures, co.horloge);
    co.voitures.forEach(v => { if (Math.abs(v.etat.v) < 1) maxRegimeArret = Math.max(maxRegimeArret, v.etat.regime); });
    for (; lu < E.son.n; lu++) {
      const e = E.son.liste[lu % E.son.taille];
      if (e.genre !== 'rate') continue;
      ratesTotal++;
      if (Math.abs(co.voitures[e.voiture].etat.v) < 1) { ratesArret++; arret.add(e.voiture); parVoiture[e.voiture] = (parVoiture[e.voiture] || 0) + 1; }
    }
  }
  console.log(`graine ${graine} : feu vert à ${vert === null ? '?' : vert.toFixed(2)} s ; ratés en 20 s : ${ratesTotal}, dont ${ratesArret} à l'arrêt, sur ${arret.size} voitures ; régime max à l'arrêt ${Math.round(maxRegimeArret)} tr/min`, JSON.stringify(parVoiture));
}
