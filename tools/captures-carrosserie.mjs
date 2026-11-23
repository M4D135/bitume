#!/usr/bin/env node
// Six vues du modèle avec le même moteur WebGPU et les mêmes matériaux que le pilote.
import { capturerPilote, optionsPilote } from './captures-pilote-module.mjs';
const scenarios=[
 {id:'trois-quarts',poste:[4.7,3.0,-4.2],cible:[0,.45,0]},
 {id:'profil',poste:[0,1.5,-6.8],cible:[0,.4,0]},
 {id:'dessus',poste:[-.001,7.5,0],cible:[0,0,0]},
 {id:'avant',poste:[5.3,1.8,0],cible:[.4,.32,0]},
 {id:'lod-moyen',poste:[4.7,3.0,-4.2],cible:[0,.45,0],detail:'moyen'},
 {id:'lod-simple',poste:[4.7,3.0,-4.2],cible:[0,.45,0],detail:'simple'}
].map(s=>({detail:'complet',fov:40,...s}));
const o = optionsPilote(process.argv.slice(2));
const rapport = await capturerPilote(o, scenarios, 'bitume-carrosserie-module-1');
console.log(JSON.stringify({ statut: rapport.statut, sortie: o.sortie, variantes: Object.keys(rapport.variantes) }));
if (rapport.statut === 'erreurs_conservees') process.exitCode = 1;
