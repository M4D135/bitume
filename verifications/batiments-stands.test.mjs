// Architecture active : profondeur réelle des garages, marquages utiles, solides cohérents et hasard isolé.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for(const n of ['moteur/renderer','circuit','carene','botanique','ecologie','saisons','bords','decor','obstacles','solides-physx'])require('../src/'+n+'.js');
const B=globalThis.BITUME, A=B.batiments, geo=globalThis.FRender.shared.geometry();
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const physique=o=>!!(o.collision||o.solidePhysX);
const solides=liste=>liste.filter(physique).map(o=>({shape:o.shape,p:o.p,s:o.s,r:o.r,genre:o.collision||o.solidePhysX.genre}));
const tous=d=>(d.lotsHerbier||d.lots).flatMap(l=>l.objets);
let controles=0;
const verifier=(nom,f)=>{f();controles++;console.log('ok '+nom);};
function tourner(r,p) {
  const [x,y,z]=r||[0,0,0], [a,b,c]=p, y1=b*Math.cos(x)-c*Math.sin(x), z1=b*Math.sin(x)+c*Math.cos(x);
  const x2=a*Math.cos(y)+z1*Math.sin(y),z2=-a*Math.sin(y)+z1*Math.cos(y);
  return [x2*Math.cos(z)-y1*Math.sin(z),x2*Math.sin(z)+y1*Math.cos(z),z2];
}
const monde=(o,p)=>tourner(o.r,p.map((v,i)=>v*o.s[i])).map((v,i)=>v+o.p[i]);
function triangles(objets) {
  const sortie=[];
  for(const o of objets) {
    const plage=geo.ranges[o.shape];assert(plage,'primitive canonique '+o.shape);
    for(let j=plage.offset/4;j<plage.offset/4+plage.count;j+=3)sortie.push([0,1,2].map(k=>{
      const at=geo.indices[j+k]*6;return monde(o,Array.from(geo.vertices.slice(at,at+3)));
    }));
  }
  return sortie;
}
// Rayon parallèle à z, intersection indépendante dans le triangle rendu (projection sur XY).
function premierImpact(mesh,x,y,z) {
  let meilleur=Infinity;
  for(const [a,b,c] of mesh) {
    const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-10)continue;
    const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det;
    const v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det;
    if(u<0||v<0||u+v>1)continue;
    const hit=u*a[2]+v*b[2]+(1-u-v)*c[2];if(hit>z)meilleur=Math.min(meilleur,hit);
  }
  return meilleur;
}
function procheAxe(c,p) {
  let meilleur={distance:Infinity};
  for(let i=0;i<c.n;i++) {
    const j=(i+1)%c.n,dx=c.x[j]-c.x[i],dz=c.z[j]-c.z[i],l2=dx*dx+dz*dz;
    const t=Math.max(0,Math.min(1,((p[0]-c.x[i])*dx+(p[2]-c.z[i])*dz)/l2));
    const x=c.x[i]+t*dx,z=c.z[i]+t*dz,distance=(p[0]-x)**2+(p[2]-z)**2;
    if(distance<meilleur.distance)meilleur={distance,s:(i+t)*c.pas,d:((p[2]-z)*dx-(p[0]-x)*dz)/Math.sqrt(l2)};
  }
  return meilleur;
}
function contient(o,p) {
  // Inverse de la rotation, calculé par les axes réellement orientés du volume.
  const delta=p.map((v,i)=>v-o.p[i]);
  for(let i=0;i<3;i++) {
    const axe=[0,0,0];axe[i]=1;const u=tourner(o.r,axe),proj=u.reduce((s,v,k)=>s+v*delta[k],0);
    if(Math.abs(proj)>o.s[i]/2+.025)return false;
  }
  return true;
}
const site={x:0,z:0,sol:0,a:0,demiRoute:6,longueur:60,graine:11};
verifier('les baies ouvertes ont une vraie profondeur, sans volume plein caché derrière la façade',()=>{
  const d=A.stands(site),mesh=triangles(d.objets.filter(physique));let ouvertes=0,fermees=0;
  for(let x=-25;x<30;x+=10) {
    const impact=premierImpact(mesh,x,1.6,17);
    if(impact>28)ouvertes++;else {assert(impact>18.8&&impact<19.2);fermees++;}
  }
  assert(ouvertes>=2&&fermees>=1,'rideaux réellement ouverts et fermés : '+ouvertes+'/'+fermees);
  assert(!d.objets.some(o=>o.s[0]>50&&o.s[1]>4&&o.s[2]>5),'aucun grand pavé plein');
  assert(d.objets.some(o=>o.partie==='servante')&&d.objets.some(o=>o.partie==='pneus'));
});
verifier('auvents courbes, chéneaux ronds, variations de rideaux et mobilier décentré',()=>{
  const d=A.stands(site),pans=d.objets.filter(o=>o.partie==='auvent');
  assert(new Set(pans.map(o=>o.r[0].toFixed(4))).size>=6);
  assert(pans.some(o=>o.r[0]<-.1)&&pans.some(o=>o.r[0]>.1));
  assert(d.objets.filter(o=>o.partie==='cheneau').every(o=>o.shape==='cylinder'));
  const autre=A.stands({...site,graine:29});assert.notEqual(hash(d.objets),hash(autre.objets));
  assert.notDeepEqual(d.objets.filter(o=>o.partie==='extracteur').map(o=>o.p[0]),[-20,0,20]);
});
verifier('le LOD retire le mobilier, jamais les parois physiques ni la silhouette des toits',()=>{
  const proche=A.stands(site),leger=A.stands(site,{detail:false});
  assert.deepEqual(solides(proche.objets),solides(leger.objets));
  assert(proche.loin.length<proche.objets.length*.75);
  for(const partie of ['mur-arriere','toiture','auvent','poteau-auvent','baie-etage'])assert(proche.loin.some(o=>o.partie===partie));
  assert(!proche.loin.some(o=>o.partie==='tiroir'||o.partie==='pneus'));
  assert(proche.objets.length<450&&proche.loin.length<160);
});
verifier('maisons : pignons, portes, volets, porches et cheminées, formes finies et stables entre paliers',()=>{
  for(const theme of ['foret','montagne','cote','baikal']) {
    const m={x:20,z:40,sol:3,a:.73,l:10,w:7,h:5,theme,graine:47},d=A.maison(m),leger=A.maison(m,{detail:false});
    assert.deepEqual(solides(d.objets),solides(leger.objets));
    for(const partie of ['pignon','porte','volet','cheneau','perron','cheminee'])assert(d.objets.some(o=>o.partie===partie));
    assert(d.objets.length<90&&d.loin.length<20);
    for(const o of d.objets)assert([...o.p,...o.s,...o.r,...o.color].every(Number.isFinite)&&o.s.every(v=>v>0));
  }
});
verifier('aucun hasard partagé : mêmes objets et surfaces de collision au prochain chargement',()=>{
  const random=Math.random;Math.random=()=>{throw Error('Math.random partagé');};
  try { assert.equal(hash(A.stands(site)),hash(A.stands(site)));assert.equal(hash(A.maison({...site,l:9,w:6,h:4})),hash(A.maison({...site,l:9,w:6,h:4}))); }
  finally {Math.random=random;}
});
verifier('Baïkal : faîtage au-dessus des égouts, pans réunis et cheminée au-dessus du toit',()=>{
  const m={x:0,z:0,a:0,l:9,w:6.2,sol:0,bas:-1,variante:0};
  const objets=B.baikal.objetsMaison(m,false),toits=objets.filter(o=>o.collision==='toit');
  const sommets=toits.map(o=>[-.5,.5].map(z=>monde(o,[0,.5,z])));
  for(const paire of sommets) {
    const interieur=paire.reduce((a,b)=>Math.abs(a[2])<Math.abs(b[2])?a:b),exterieur=paire.find(p=>p!==interieur);
    assert(interieur[1]>exterieur[1]+1.8,'la pente monte vers le milieu de la maison');
  }
  const faitage=sommets.map(p=>p.reduce((a,b)=>Math.abs(a[2])<Math.abs(b[2])?a:b));
  assert(Math.abs(faitage[0][1]-faitage[1][1])<1e-8&&Math.abs(faitage[0][2]-faitage[1][2])<.15);
  const cheminee=objets.find(o=>o.s[0]===.65&&o.s[2]===.7);assert(cheminee.p[1]+cheminee.s[1]/2>faitage[0][1]+.6);
});

const catalogue=[[11,'foret',4200],[29,'cote',3600],[47,'montagne',5200],[83,'islande',4600],[107,'desert',4800],[131,'asie',5000],[157,'pacifique',5200],[179,'baikal',5400]];
const planRoute=c=>hash([c.x,c.y,c.z,c.cap,c.courbure,c.pente,c.devers,c.largeur,c.stands,c.limiteG,c.limiteD]);
const nappe=d=>hash(d.nappes.map(n=>[n.sommets,n.indices,n.surfacesPhysX]));
for(const [graine,theme,longueur] of catalogue) {
  const c=B.circuit.creer(graine,{theme,longueur});B.bords.limites(c,B.bords.planifier(c));
  const avant=planRoute(c),options={qualite:'low',vegetation:false,saison:'ete'},ancien=B.decor.construire(c,{...options,batiments:false}),d=B.decor.construire(c,options);
  verifier(theme+' : architecture active, piste/terrain/arbres/zone de service inchangés',()=>{
    assert.equal(planRoute(c),avant);assert.equal(nappe(d),nappe(ancien));assert.deepEqual(d.arbres,ancien.arbres);
    assert(d.architecture.stands.length>=3);assert(tous(d).some(o=>o.architecture==='stands'));
    assert(tous(d).some(o=>o.architecture==='commissaires'));
    if(d.baikal)assert.deepEqual(d.baikal.maisons,ancien.baikal.maisons);
  });
  verifier(theme+' : entrée, arrêt et sortie de la voie restent dégagés',()=>{
    const S=c.stands;
    const nouveaux=tous(d).filter(o=>o.architecture);
    const corps=nouveaux.filter(physique);
    for(let s=S.debut-6;s<=S.fin+6;s+=3)for(const d of [S.d-S.demi+.1,S.d,S.d+S.demi-.1])for(const h of [.25,1.15]) {
      const q=B.circuit.echantillon(c,s),p=[q.x-Math.sin(q.cap)*d,q.y-d*Math.sin(q.devers)+h,q.z+Math.cos(q.cap)*d];
      assert(!corps.some(o=>contient(o,p)),'passage occupé à '+s+' m, décalage '+d);
    }
    const peinture=nouveaux.filter(o=>o.architecture==='voie-service'&&!['panneau','numero','poteau-panneau'].includes(o.partie));
    assert(peinture.length>20);
    for(const o of peinture){const {s,d}=procheAxe(c,o.p);assert(s>=S.debut-1&&s<=S.fin+1);assert(d>=S.d-S.demi&&d<=S.d+S.demi);assert(!physique(o));}
    assert(peinture.some(o=>o.partie==='limite-service')&&peinture.some(o=>o.partie==='arret'));
    const panneau=nouveaux.find(o=>o.partie==='panneau'),normal=tourner(panneau.r,[0,0,-1]),cap=B.circuit.echantillon(c,S.debut+5).cap;
    assert(normal[0]*Math.cos(cap)+normal[2]*Math.sin(cap)<-.99,'le panneau est face au pilote qui arrive');
  });
  verifier(theme+' : panneau et poteau sont en amont de la voie et derrière le muret réel',()=>{
    const S=c.stands,q=B.circuit.echantillon(c,S.debut),ca=Math.cos(q.cap),sa=Math.sin(q.cap);
    const signal=tous(d).filter(o=>o.architecture==='voie-service'&&['panneau','numero','poteau-panneau'].includes(o.partie));
    const poteau=signal.find(o=>o.partie==='poteau-panneau'),panneau=signal.find(o=>o.partie==='panneau');
    assert(poteau&&panneau&&physique(poteau),'signal visible avec son vrai poteau solide');
    const local=p=>({s:(p[0]-q.x)*ca+(p[2]-q.z)*sa,d:-(p[0]-q.x)*sa+(p[2]-q.z)*ca});
    const points=triangles(signal).flat(),poses=points.map(local);
    const s0=Math.min(...poses.map(p=>p.s)),s1=Math.max(...poses.map(p=>p.s));
    assert(s1 < -6,'l’ensemble laisse six mètres avant le début réel de la voie');
    // Le muret dessiné fournit la frontière : on vérifie les triangles, pas une copie du retrait codé.
    const murs=tous(d).filter(o=>o.architecture==='stands'&&['muret','lisse-muret'].includes(o.partie)).map(o=>triangles([o]).flat().map(local));
    const devant=murs.filter(p=>Math.min(...p.map(v=>v.s))<=s0&&Math.max(...p.map(v=>v.s))>=s1);
    assert(devant.length>0,'un vrai muret continu protège toute la largeur longitudinale du signal');
    const exterieur=Math.max(...devant.flat().map(p=>p.d)),interieur=Math.min(...poses.map(p=>p.d));
    assert(interieur>=exterieur+.19,'panneau complet et poteau restent derrière le muret avec leur marge');
    for(const p of points) {
      const axe=procheAxe(c,p);
      assert(Math.abs(axe.d)>Math.max(c.largeur/2,S.d+S.demi)+1.01,'aucun sommet dans la route ou le dégagement latéral de la voie');
    }
    const index=B.obstacles.creer(d.obstacles);
    const solide=index.objets.find(o=>o.genre==='pilier'&&Math.hypot(o.x-poteau.p[0],o.z-poteau.p[2])<1e-9&&Math.abs(o.ymin-(poteau.p[1]-poteau.s[1]/2))<1e-9);
    assert(solide,'le déplacement conserve la collision du poteau au même endroit que le dessin');
    assert(B.obstacles.tester({x:poteau.p[0],z:poteau.p[2],ymin:poteau.p[1]-.1,ymax:poteau.p[1]+.1,angle:0,hx:.1,hz:.1},solide),'le poteau déplacé répond toujours aux contacts');
  });
}
verifier('les nouveaux volumes solides sont acceptés par le vrai montage PhysX',()=>{
  const c=B.circuit.creer(11,{theme:'foret',longueur:4200}),d=B.decor.construire(c,{qualite:'low',vegetation:false});
  c.obstacles=B.obstacles.creer(d.obstacles);
  const monde={n:0,addBox(){return ++this.n;},addTriangleMesh(){return ++this.n;},remove(){}};
  const m=B.solidesPhysX.installer(monde,c,d);
  assert(m.statistiques.obstaclesHistoriques===d.obstacles.length&&m.statistiques.complements>100);
  B.solidesPhysX.liberer(m);
});
console.log('bâtiments et stands : '+controles+' contrôles passés');
