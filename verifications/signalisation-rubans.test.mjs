import assert from 'node:assert/strict';
import { test } from 'node:test';
import { B, CATALOGUE_SAISONS, creerCircuitSaisons } from '../tools/qualification/saisons-circuits.mjs';
await import('../src/signalisation-course.js');

const camera = (c, s) => {
  const q = B.circuit.echantillon(c, s);
  return [q.x, q.y + 1.1, q.z];
};
function image(etat, t, cameraPos, options = {}) {
  const sortie = [];
  B.signalisationCourse.mettreAJour(etat, t, { cameraPos, qualite: 'high', ...options }, sortie);
  return sortie;
}

test('les bandeaux des onze circuits suivent exclusivement les glissières présentes, à dix centimètres maximum', t=>{
  for (const def of CATALOGUE_SAISONS) {
    const c=creerCircuitSaisons(def), decor=B.decor.construire(c,{qualite:'low',vegetation:false});
    const etat=B.signalisationCourse.creer(c,decor), rails=decor.railsVirages;
    assert.equal(etat.panneaux.length,rails.length); assert(rails.length>0,def.id);
    const presents=new Set(decor.lots.flatMap(l=>l.objets));
    for (let i=0;i<rails.length;i++) {
      const t=rails[i],p=etat.panneaux[i],rail=t.rail;
      assert(presents.has(rail) && rail.solidePhysX.genre==='glissiere');
      assert(!B.circuit.dansTunnel(c,t.s,6),'la voûte remplace la glissière');
      assert.deepEqual(p.fond.p,p.fleche.p); assert.deepEqual(p.fond.s,p.fleche.s);
      assert(Math.abs(p.fond.s[0]-(rail.s[0]-.25))<1e-8,'longueur utile du rail');
      const hauteurNormale=t.haut.reduce((h,n,j)=>h+n*(p.fond.p[j]-rail.p[j]),0);
      const garde=(hauteurNormale-rail.s[1]/2-p.fond.s[1]/2)/t.haut[1];
      assert(Math.abs(garde-.01)<1e-7 && garde+p.fond.s[1]/t.haut[1]<=.1000001);
      const [rx,ry,rz]=p.fond.r, cx=Math.cos(rx), sx=Math.sin(rx);
      const nx=Math.cos(rz)*Math.sin(ry)*cx+Math.sin(rz)*sx, nz=Math.cos(ry)*cx;
      const axe=B.circuit.echantillon(c,t.s);
      assert((axe.x-p.x)*nx+(axe.z-p.z)*nz>0,'LED vers la chaussée');
    }
    t.diagnostic(def.id+' : '+rails.length+' tronçons');
  }
});

test('à chaque phase au moins trois chevrons complets par groupe, un dos fermé et aucune diode au revers',()=>{
  const {vertices,indices,ranges}=globalThis.FRender.shared.geometry(false);
  for (let grille=0;grille<=1;grille++) for (let phase=0;phase<8;phase++) {
    const nom='bitume-rail-'+grille+'-'+phase, rects=[];
    const aire={avant:0,dos:0,chants:0};
    for (const forme of [nom,nom+'-led']) {
      const r=ranges[forme], debut=r.offset/indices.BYTES_PER_ELEMENT;
      for (let i=debut;i<debut+r.count;i+=3) {
        const [a,b,c]=Array.from(indices.subarray(i,i+3),j=>vertices.subarray(6*j,6*j+3));
        if (forme.endsWith('-led')) {
          assert([a,b,c].every(p=>p[2]===.5));
          if (i%6===debut%6) rects.push([a[0],b[0],a[1],c[1]]);
        }
        const u=b.map((x,j)=>x-a[j]), v=c.map((x,j)=>x-a[j]);
        const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        aire[n[2]>0?'avant':n[2]<0?'dos':'chants']+=Math.hypot(...n)/2;
      }
    }
    for (const [k,v] of Object.entries({avant:1,dos:1,chants:4})) assert(Math.abs(aire[k]-v)<1e-5,k);
    for (let groupe=0;groupe<4;groupe++) {
      let complets=0;
      for (let k=-1;k<=4;k++) {
        const col=k*8+phase+6.5;
        if (col-4<0 || col+.5>32) continue;
        const pointe=(groupe*128+48+col)/512-.5, pied=pointe-3/512;
        for(const [x,y] of [[pointe,0],[pied,.37],[pied,-.37]])
          assert(rects.some(([g,d,b,h])=>x>g && x<d && y>b && y<h),'pointe et branches allumées');
        complets++;
      }
      assert(complets>=3);
    }
  }
});

test('le défilement change les LED, le boîtier reste fixe et la préférence de mouvement réduit est respectée',()=>{
  const c=creerCircuitSaisons(CATALOGUE_SAISONS.find(d=>d.id==='larche')), rail={p:[0,0,0],s:[8.25,.34,.07],r:[0,0,0]};
  const etat=B.signalisationCourse.creer(c,{railsVirages:[{rail,haut:[0,1,0],s:0,cote:-1,longueur:8}]}), p=etat.panneaux[0];
  const cam=[0,1,3], loin=[0,1,40], opt={pluie:1};
  assert(image(etat,0,cam,opt).includes(p.fleche));assert.equal(p.fleche.shape,'bitume-rail-1-0-led');
  const pos=[...p.fleche.p], e=p.fleche.emissive;
  image(etat,.25,cam,opt);assert.equal(p.fleche.shape,'bitume-rail-1-2-led');assert.equal(p.fleche.emissive,e);
  image(etat,2,loin,{...opt,mouvementReduit:true});assert.equal(p.fleche.shape,'bitume-rail-0-0-led');
  assert.deepEqual(p.fleche.p,pos);assert.equal(p.fond.emissive,0);
});
test('les deux faces du portique suivent les feux réels, la tête, les incidents locaux et le drapeau', () => {
  const c = creerCircuitSaisons(CATALOGUE_SAISONS[0]);
  const sig = B.signalisationCourse.creer(c, {}), cameraPos = camera(c, 0);
  const voitures = [{ tours: 0, etat: { s: 14 } }, { tours: 1, etat: { s: c.secteurs[1] + 30 } }];
  const co = { c, phase: 'grille', mode: 'course', drapeau: null, feux: { allumes: 0 },
    voitures, classement: [1,0], toursTotal: 3 };
  function lire(t, pluie = 0, qualite = 'high') {
    const sortie = image(sig, t, cameraPos, { course: co, pluie, qualite });
    for (const b of sig.bandeaux) {
      assert(sortie.includes(b.support));
      assert.equal(b.visibles.map(o => o.shape.slice('bitume-portique-'.length)).join(''), b.texte.replaceAll(' ', ''));
    }
    assert.equal(sig.bandeaux[0].texte, sig.bandeaux[1].texte);
    return sig.bandeaux[0].texte;
  }
  assert.equal(lire(0), 'DEPART');
  assert(sig.bandeaux[0].modules.every(o => o.emissive < .1));
  co.phase = 'feux'; co.feux.allumes = 3;
  lire(3);
  assert.equal(sig.bandeaux[0].modules.filter(o => o.emissive > 1).length, 7);
  co.phase = 'course';
  assert.equal(lire(12, .7), 'PLUIE');
  assert.equal(lire(6, .7), 'TOUR 2');
  assert.equal(lire(8), 'TETE S3');
  voitures[0].etat.stands = { phase: 'service' };
  assert.equal(lire(6), 'STANDS');
  voitures[1].tours = 2;
  assert.equal(lire(12, .7), 'DERNIER TOUR');
  voitures[0].etat.accident = true; voitures[0].etat.s = c.longueur - 45;
  assert.equal(lire(12, .7), 'DANGER');
  co.drapeau = 95;
  assert.equal(lire(12, .7, 'low'), 'ARRIVEE');
});
