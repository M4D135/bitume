// Export géométrique pour l'inspection CPU ; aucun asset n'est importé dans le jeu.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../../../..');
for(const f of ['pneus','carene','main','conduite','voiture'])require(path.join(root,'src',f+'.js'));
const V=globalThis.BITUME.voiture,resultat={},formes=Object.fromEntries(Object.values(V.FORMES).map(f=>[f.nom,f]));
for(const type of ['slicks','inter','pluie','neige']){
 const m=V.modele({couleur:[.8,.1,.1],pneus:type});
 resultat[type]=m.corps.filter(o=>o.roue===2&&formes[o.shape]).map(o=>({forme:o.shape,couleur:o.color,taille:o.s,decale:o.decale||[0,0,0],tri:formes[o.shape].tri}));
}
writeFileSync(process.argv[2],JSON.stringify(resultat));
console.log('Quatre pneus arrière exportés pour inspection géométrique CPU.');
