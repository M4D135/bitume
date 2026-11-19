// Régression 12E : conserver le mouvement tangent, puis sortir d'un contact par les commandes normales.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const req = createRequire(import.meta.url);
for (const f of ['circuit','conduite','degats','contacts','obstacles','course','botanique','ecologie','saisons','vegetation','bords','decor','meteo']) req('../src/'+f+'.js');
const B = globalThis.BITUME, circuitReel = B.circuit, O = B.obstacles, dt = 1 / 120;
let controles = 0;
function verifier(nom, f) { try { f(); controles++; console.log('ok '+nom); } finally { B.circuit = circuitReel; B.meteo.actuel = null; } }
function ligne(solides, vitesse = 10) {
  B.circuit = { echantillon(c,s) { return {x:s,z:0,y:0,cap:0,courbure:0}; } };
  const e = B.conduite.creer(100,0); e.v=vitesse; e.degats=B.degats.creer();
  return {c:{longueur:10000,obstacles:O.creer(solides)},voitures:[{id:0,etat:e,degats:e.degats}],horloge:0,dt};
}
const mur = {type:'box',x:100,z:2.012,angle:0,hx:80,hz:1,ymin:0,ymax:3,genre:'muret'};
function avancer(co, rotation = .01) {
  const e=co.voitures[0].etat;co.horloge+=dt;O.avant(co);
  const ds=Math.cos(e.psi)*e.v*dt;
  e.s+=ds;e.d+=Math.sin(e.psi)*e.v*dt;e.distance+=ds;e.beta+=rotation;
  const ev=[];O.pas(co,ev);return ev;
}
function libre(co) {
  const e=co.voitures[0].etat,p={x:e.s,z:e.d,angle:e.psi+e.beta,hx:2.475,hz:1.01,ymin:e.y,ymax:e.y+1.1};
  return co.c.obstacles.objets.every(o=>!O.tester(p,o));
}

verifier('contact rasant répété : la rotation bloquée ne vole plus la translation tangentielle',()=>{
  for(const signe of [1,-1]) {
    const co=ligne([mur],10*signe),e=co.voitures[0].etat,depart=e.s;
    for(let i=0;i<120;i++) {avancer(co);assert.ok(libre(co));assert.ok(Math.abs(e.v)<=10+1e-10);}
    assert.ok(signe*(e.s-depart)>8,'déplacement tangent conservé en marche avant et au recul');
    assert.equal(e.repositionnements,0);assert.equal(e.recuperation,null);
  }
});

verifier('le glissement est rebalayé contre un second mur sans énergie ni traversée ajoutées',()=>{
  const co=ligne([mur,{type:'box',x:106,z:0,angle:0,hx:.1,hz:4,ymin:0,ymax:3,genre:'muret'}]),e=co.voitures[0].etat;
  for(let i=0;i<150;i++) {avancer(co);assert.ok(libre(co));assert.ok(Math.abs(e.v)<=10+1e-10);}
  assert.ok(e.s<106-.1-2.475+.003,'la caisse reste devant la paroi transversale');
});

verifier('aucune marche arrière IA pour la grille, une attente de trafic ou une voiture sans contact fixe',()=>{
  const c=B.circuit.creer(11,{theme:'foret',longueur:4200});
  for(const phase of ['grille','course']) {
    const co=B.course.creer(c,{mode:'course',rivaux:1,graine:2047}),v=co.voitures[1];
    co.phase=phase;co.dt=dt;co.temps=30;v.etat.v=0;
    for(let i=0;i<180;i++)assert.equal(B.course.commandesIA(co,v).marcheArriere,false);
    assert.equal(v.ia.degagement,0);
  }
});

verifier('forêt enneigée réelle : le rival collé au tronc recule et repart sans replacement ni pneus restaurés',()=>{
  const c=B.circuit.creer(11,{theme:'foret',longueur:4200});
  const decor=B.decor.construire(c,{qualite:'high',matieres:true,vegetation:true,vegetationQualite:'high',saison:'hiver'});
  c.obstacles=O.creer(decor.obstacles);
  B.meteo.actuel=B.chaussee.preparer({pluie:.75,mouille:0,neigeSol:.75,fixe:true},B.saisons.profil('hiver','foret'));
  const co=B.course.creer(c,{mode:'course',tours:2,rivaux:11,difficulte:1,graine:2047,placeJoueur:12});
  for(const v of co.voitures)v.etat.pneus='neige';
  const cible=co.voitures[2],e=cible.etat,graines=e.etatPneus.map(r=>r.graine),usure=[0,0,0,0];
  const ev=[],cmd={};let choc=false,recul=false,finRecul=false,positionChoc=0;
  while(co.temps<110) {
    const auto=B.course.commandesIA(co,co.joueur,cmd);B.course.pas(co,auto,dt,ev);
    if(ev.some(x=>x.id===2&&x.type==='choc'&&x.obstacle==='tronc')) {choc=true;if(!positionChoc)positionChoc=e.s;}
    if(choc&&e.rapport===-1&&e.v<-.2)recul=true;
    if(recul&&e.rapport>0&&e.v>8)finRecul=true;
    for(let i=0;i<4;i++){assert.ok(e.etatPneus[i].usure+1e-12>=usure[i]);usure[i]=e.etatPneus[i].usure;}
    assert.equal(e.repositionnements,0,'aucune téléportation du rival testé');
  }
  assert.ok(choc&&recul&&finRecul,'impact réel, marche arrière physique puis reprise du guidage');
  assert.ok(B.circuit.ecart(c,positionChoc,e.s)>250,'le rival a quitté la zone qui le bloquait');
  assert.equal(cible.ia.degagement,0);assert.equal(e.servicePneus,0);
  assert.deepEqual(e.etatPneus.map(r=>r.graine),graines);
});

verifier('poche en U : deux essais infructueux rendent la main au secours existant, sans restaurer les pneus',()=>{
  const c=B.circuit.creer(11,{theme:'foret',longueur:4200}),s=200,d=11,q=B.circuit.echantillon(c,s);
  const ca=Math.cos(q.cap),sa=Math.sin(q.cap),x=q.x-sa*d,z=q.z+ca*d;
  const murLocal=(avant,cote,hx,hz)=>({type:'box',x:x+ca*avant-sa*cote,z:z+sa*avant+ca*cote,
    angle:q.cap,hx,hz,ymin:q.y-10,ymax:q.y+20,genre:'muret'});
  // Une poche hors piste ouverte derrière, trop profonde pour que 1,8 m de recul suffise à en sortir.
  c.obstacles=O.creer([murLocal(3,0,.25,1.5),murLocal(-.5,1.4,4,.25),murLocal(-.5,-1.4,4,.25)]);
  const co=B.course.creer(c,{mode:'course',rivaux:0,graine:2047,tours:99}),v=co.joueur,e=v.etat;
  co.phase='course';co.feux.vert=true;co.temps=30;co.horloge=30;co.dt=dt;
  Object.assign(e,{s,d,v:0,psi:0,beta:0,y:q.y,distance:s});v.progression=s;
  for(let i=0;i<4;i++)e.etatPneus[i].usure=.2+i*.1;
  const graines=e.etatPneus.map(r=>r.graine),usure=e.etatPneus.map(r=>r.usure),ev=[],cmd={};
  let essais=0,phasePrecedente=0,secours=false,maxBloque=0;
  for(let k=0;k<60/dt;k++) {
    B.course.commandesIA(co,v,cmd);
    if(!secours) {
      if(v.ia.degagement===1&&phasePrecedente!==1)essais++;
      maxBloque=Math.max(maxBloque,v.ia.bloque||0);
      assert.ok(essais<=2,'les oscillations dans la poche ne réarment pas les tentatives');
    }
    phasePrecedente=v.ia.degagement;B.course.pas(co,cmd,dt,ev);
    if(e.repositionnements>0)secours=true;
    for(let i=0;i<4;i++){assert.ok(e.etatPneus[i].usure+1e-12>=usure[i]);usure[i]=e.etatPneus[i].usure;}
  }
  assert.equal(essais,2);assert.ok(maxBloque>14.9,'le secours conserve son délai historique de 15 secondes');
  assert.equal(e.repositionnements,1);assert.ok(secours);
  assert.ok(Math.abs(B.circuit.ecart(c,s,e.s))>100&&e.v>8,'la voiture a repris la course');
  assert.equal(v.ia.degagementEssais,0,'le déplacement réel réarme les futurs dégagements');
  assert.equal(e.servicePneus,0);assert.deepEqual(e.etatPneus.map(r=>r.graine),graines);
});

console.log(controles+' contrôles contact tangent et dégagement IA réussis');
