#!/usr/bin/env node
// Entrée CI du lot faune/démos : montage réel, neuf circuits et activité faune observée.
// Le contrôleur commun garde le build exact, les PNG et les diagnostics WebGL/PhysX.
import { optionsDemo, campagne } from '../captures-demo.mjs';

try {
  const options = optionsDemo(process.argv.slice(2));
  const rapport = await campagne(options);
  console.log(JSON.stringify({ dossier: options.sortie, passages: rapport.passages.length,
    echecs: rapport.echecs, limites: rapport.limites }, null, 2));
  process.exitCode = rapport.echecs ? 1 : 0;
} catch (erreur) {
  console.error(erreur.stack || erreur.message);
  process.exitCode = 1;
}
