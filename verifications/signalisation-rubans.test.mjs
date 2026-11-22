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

test('onze parcours : balises espacées à l’extérieur des virages marqués, tournées vers l’approche', t => {
  assert.equal(CATALOGUE_SAISONS.length,11);
  for (const def of CATALOGUE_SAISONS) {
    const c=creerCircuitSaisons(def), etat=B.signalisationCourse.creer(c,{}), virages=B.virages.planifier(c);
    assert(etat.panneaux.length>0,def.id);
    for (const v of virages) {
      const groupe=etat.panneaux.filter(p=>(p.s-v.debut+c.longueur)%c.longueur<v.longueur);
      assert(groupe.length<=v.difficulte);
      const offsets=groupe.map(p=>(p.s-v.debut+c.longueur)%c.longueur).sort((a,b)=>a-b);
      for (let i=1;i<offsets.length;i++) assert(offsets[i]-offsets[i-1]>=16.99);
    }
    for (const p of etat.panneaux) {
      const v=virages.find(v=>(p.s-v.debut+c.longueur)%c.longueur<v.longueur);
      assert(v && !B.couverts.segment(c,p.s));
      assert.equal(Math.sign(p.lat),-v.sens);
      assert.deepEqual(p.fond.s,[2.45,1.4,.12]);
      const amont=camera(c,c.ouvert?Math.max(0,p.s-28):(p.s-28+c.longueur)%c.longueur);
      const [rx,ry,rz]=p.fond.r, cx=Math.cos(rx), sx=Math.sin(rx);
      const normale=[Math.cos(rz)*Math.sin(ry)*cx+Math.sin(rz)*sx,Math.sin(rz)*Math.sin(ry)*cx-Math.cos(rz)*sx,Math.cos(ry)*cx];
      const dx=amont[0]-p.x,dz=amont[2]-p.z;
      assert((normale[0]*dx+normale[2]*dz)/Math.hypot(dx,dz)>.99999,'face LED tournée vers le pilote');
      for (const poteau of p.supports) {
        const d=(poteau.p[0]-p.x)*normale[0]+(poteau.p[2]-p.z)*normale[2];
        assert(d<-.08 && poteau.p[1]-poteau.s[1]/2 < p.fond.p[1]-.7);
      }
    }
    t.diagnostic(def.id+' : '+etat.panneaux.length+' panneaux sur '+virages.length+' virages annoncés');
  }
});

test('la face LED et la tôle ferment le boîtier de près et de loin, sans surface superposée', () => {
  const { vertices, indices, ranges }=globalThis.FRender.shared.geometry(false);
  for (const [metal,lumiere] of [['bitume-ruban-grille','bitume-balise-led'],['bitume-balise-boitier','bitume-ruban-chevron']]) {
    const aire={avant:0,dos:0,chants:0};
    for (const nom of [metal,lumiere]) {
      const r=ranges[nom], debut=r.offset/indices.BYTES_PER_ELEMENT;
      for (let i=debut;i<debut+r.count;i+=3) {
        const [a,b,c]=Array.from(indices.subarray(i,i+3),j=>vertices.subarray(6*j,6*j+3));
        if (nom===lumiere) assert([a,b,c].every(p=>p[2]===.5),'LED seulement côté route');
        const u=b.map((x,j)=>x-a[j]), v=c.map((x,j)=>x-a[j]);
        const normale=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        const face=normale[2]>0?'avant':normale[2]<0?'dos':'chants';
        aire[face]+=Math.hypot(...normale)/2;
      }
    }
    for (const [face,attendu] of Object.entries({avant:1,dos:1,chants:4})) assert(Math.abs(aire[face]-attendu)<1e-5,face);
  }
});

test('sous la pluie, une pulsation stable par panneau et des supports indépendants du niveau de détail',()=>{
  const c=B.larche.creer(210), etat=B.signalisationCourse.creer(c,{}), p=etat.panneaux[0];
  const proche=[p.x+8,p.fond.p[1],p.z], loin=[p.x+98,p.fond.p[1],p.z];
  for (const qualite of ['low','high']) {
    const opt={qualite,pluie:1,nuit:1};
    assert(image(etat,0,proche,opt).includes(p.fleche)); assert.equal(p.fleche.shape,'bitume-balise-led');
    const niveau=p.fleche.emissive, position=[...p.fleche.p];
    image(etat,.6,proche,opt); assert.notEqual(p.fleche.emissive,niveau);
    const visibles=image(etat,0,loin,opt);
    assert(visibles.includes(p.fond) && p.supports.every(o=>visibles.includes(o)));
    assert.equal(p.fleche.shape,'bitume-ruban-chevron'); assert.equal(p.fond.emissive,0);
    assert.deepEqual(p.fleche.p,position);
    image(etat,0,proche,{...opt,mouvementReduit:true}); const fixe=p.fleche.emissive;
    image(etat,.6,proche,{...opt,mouvementReduit:true}); assert.equal(p.fleche.emissive,fixe);
  }
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
