/* Extrait la géométrie effectivement envoyée à FERRO, sans simplifier le tablier. */
const {join, resolve} = require('node:path');
const {writeFileSync} = require('node:fs');
const [racine, fichier] = process.argv.slice(2);
if (!racine || !fichier) throw Error('Usage : node extraire-rayons-larche.cjs <dépôt> <scene.json>');
for (const moduleJeu of ['circuit', 'couverts', 'route-des-cimes', 'larche-vinadio-data', 'larche-vinadio',
  'larche-vinadio-decor', 'carene', 'botanique', 'ecologie', 'saisons', 'bords', 'decor']) {
  require(join(resolve(racine), 'src', moduleJeu+'.js'));
}
const B = globalThis.BITUME, c = B.larche.creer(210);
const decor = B.decor.construire(c,{qualite:'low',organique:true,vegetation:false});
const pont = c.ponts.find(p => p.debut === 14222.8 && p.fin === 14323.3);
if (!pont) throw Error('Le pont de la référence a changé');
const s = (pont.debut + pont.fin)/2, q = B.circuit.echantillon(c,s);
const triangles = [];
let cible = -1, distance = Infinity;
for (const n of decor.nappes.filter(n => n.surfaceType === 'accotement')) {
  for (let k=0; k<n.indices.length; k+=3) {
    if (n.surfacesPhysX[k/3] !== 1) continue;
    const sommets = Array.from(n.indices.subarray(k,k+3), i => Array.from(n.sommets.subarray(13*i,13*i+3)));
    const centre = [0,1,2].map(j=>sommets.reduce((r,p)=>r+p[j],0)/3);
    const ecart = Math.hypot(centre[0]-q.x, centre[2]-q.z);
    if (ecart>45) continue;
    if (ecart<distance) {distance=ecart;cible=triangles.length;}
    triangles.push(sommets);
  }
}
if (cible<0) throw Error('Aucun triangle de chaussée dans un rayon de 45 m');
const origineLocale = [0,1,2].map(j=>triangles[cible].reduce((r,p)=>r+p[j],0)/3);
const points = triangles.flat().map(p=>p.map((x,j)=>Math.fround(x-origineLocale[j])));
const bord = B.circuit.echantillon(c,s+1);
const tangente = [bord.x-q.x,bord.z-q.z], norme = Math.hypot(...tangente);
const droite = [-tangente[1]/norme, tangente[0]/norme];
const sousTablier = [0,-2,0];
// Viser un second point à barycentriques différentes pour vérifier l'ordre des trois sommets.
const biais = [.56,.27,.17];
const pointOblique = [0,1,2].map(j=>biais.reduce((v,p,k)=>v+p*points[3*cible+k][j],0));
const axeOblique = [.2,-1,.3].map(x=>x/Math.hypot(.2,-1,.3));
const rayons = [
  {nom:'chaussée', origine:[0,8,0], vers:[0,-1,0], portee:20, ombre:false, attendu:true},
  {nom:'chaussée en biais', origine:pointOblique.map((x,j)=>x-4.5*axeOblique[j]), vers:axeOblique, portee:12, ombre:false, attendu:true},
  {nom:'hors chaussée', origine:[60*droite[0],8,60*droite[1]], vers:[0,-1,0], portee:20, ombre:false, attendu:false},
  {nom:'lumière derrière le tablier', origine:sousTablier, vers:[0,1,0], portee:12, ombre:true, attendu:true},
  {nom:'lumière à côté du tablier', origine:sousTablier, vers:[18*droite[0],2.5,18*droite[1]], portee:24, ombre:true, attendu:false},
  {nom:'lumière avant le tablier', origine:sousTablier, vers:[0,1,0], portee:1, ombre:true, attendu:false}
];
for (const r of rayons) {
  const longueur = Math.hypot(...r.vers);
  r.vers = r.vers.map(x=>Math.fround(x/longueur));
  r.origine = r.origine.map(Math.fround);
}
writeFileSync(fichier,JSON.stringify({circuit:'larche',graine:210,abscisseM:s,origineLocale,cible,points,rayons})+'\n');
