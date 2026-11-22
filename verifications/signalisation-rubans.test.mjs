import assert from 'node:assert/strict';
import { test } from 'node:test';
import { B, CATALOGUE_SAISONS, creerCircuitSaisons } from '../tools/qualification/saisons-circuits.mjs';
await import('../src/signalisation-course.js');

const signe = x => Math.sign(x);
const dans = (c, v, s) => ((s - v.debut) % c.longueur + c.longueur) % c.longueur < v.longueur;
const camera = (c, s) => {
  const q = B.circuit.echantillon(c, s);
  return [q.x, q.y + 1.1, q.z];
};
function image(etat, t, cameraPos, options = {}) {
  const sortie = [];
  B.signalisationCourse.mettreAJour(etat, t, { cameraPos, qualite: 'high', ...options }, sortie);
  return sortie;
}

test('les onze parcours couvrent virages annoncés et courbes douces, dans les deux sens', t => {
  assert.equal(CATALOGUE_SAISONS.length, 11);
  for (const def of CATALOGUE_SAISONS) {
    const c = creerCircuitSaisons(def), etat = B.signalisationCourse.creer(c, {});
    assert.deepEqual(new Set(etat.rubans.map(v => v.sens)), new Set([-1, 1]), def.id);
    for (const v of B.virages.planifier(c)) {
      for (let d = c.pas / 2; d < v.longueur; d += c.pas) {
        assert(etat.rubans.some(r => r.sens === v.sens && r.difficulte >= v.difficulte && dans(c,r,v.debut+d)), def.id + ' ' + (v.debut+d));
      }
    }
    const limites = B.decor.limites(c);
    let modules = 0, maximum = 0;
    for (const v of etat.rubans) {
      assert.equal(v.points[0].s, v.debut);
      assert(Math.abs(v.points.at(-1).s-v.fin)<1e-8);
      for (let i=0; i<v.points.length; i++) {
        const a=v.points[i], b=v.points[i+1];
        assert.equal(signe(a.lat), -v.sens, 'rive extérieure');
        assert([a.x,a.y,a.z].every(Number.isFinite));
        const q=B.circuit.echantillon(c,a.s), largeur=B.circuit.largeurA(c,a.s,-v.sens);
        assert(Math.abs(a.lat)>largeur, def.id+' : emprise au-delà de la chaussée');
        const delta=[a.x-q.x,a.z-q.z];
        assert(Math.abs(delta[0]*Math.cos(q.cap)+delta[1]*Math.sin(q.cap))<1e-5, 'ancré perpendiculairement à la route');
        const ouvrage=B.couverts.segment(c,a.s);
        if (!ouvrage) {
          const index=Math.min(c.n-1,Math.floor((a.s%c.longueur)/c.pas));
          const j=c.ouvert?Math.min(c.n-1,index+1):(index+1)%c.n, f=(a.s%c.longueur)/c.pas-index;
          const rail=v.sens>0?limites.G:limites.D;
          assert(Math.abs(a.lat) >= rail[index]*(1-f)+rail[j]*f+.8, 'garde de la glissière');
        } else if (Number.isFinite(ouvrage.mur)) assert(Math.abs(a.lat)<ouvrage.mur, 'montage sur la face visible du couvert');
        if (b) { assert(b.s>a.s && b.s-a.s<=6.00001); modules++; }
      }
    }
    for (let i=0;i<c.n;i+=16) {
      const ensemble=image(etat, 1, [c.x[i], c.y[i]+1.5, c.z[i]]);
      maximum=Math.max(maximum,ensemble.length);
      assert.equal(ensemble.length, new Set(ensemble).size);
    }
    assert(maximum<900 && etat.objets.length<1050,'réservation spatiale indépendante des kilomètres de parcours');
    t.diagnostic(def.id+' : '+etat.rubans.length+' rubans, '+modules+' modules, '+maximum+' instances au plus sur le parcours échantillonné');
  }
});

test('la courbe douce qui chevauche le départ possède une seule jointure et les sections ouvertes finissent au drapeau',()=>{
  // Un stade de 480 m de large. La ligne de départ se trouve au milieu du demi-tour est.
  const points = [];
  function arc(centre, debut, fin) {
    const n = Math.round((fin-debut)*240);
    for (let i=0; i<=n; i++) {
      const a=debut+(fin-debut)*i/n;
      points.push({x:centre+240*Math.cos(a),y:0,z:240*Math.sin(a),largeurG:6,largeurD:6,limiteG:9,limiteD:9});
    }
  }
  arc(160,0,Math.PI/2); arc(-160,Math.PI/2,1.5*Math.PI); arc(160,1.5*Math.PI,2*Math.PI);
  points[points.length-1]={...points[0]};
  const circuit=B.circuit.creerDepuisTrace({unite:'m',pasMax:2,points});
  const etat=B.signalisationCourse.creer(circuit,{}), raccords=etat.rubans.filter(r=>r.fin>circuit.longueur);
  assert.equal(etat.rubans.length,2);
  assert.equal(raccords.length,1);
  assert.equal(B.virages.planifier(circuit).length,0);
  const [r]=raccords;
  assert(r.debut>circuit.longueur/2 && r.sens===1);
  assert(r.points.some((a,i)=>a.s<circuit.longueur && r.points[i+1]?.s>=circuit.longueur));
  const c=B.larche.creer(210);
  assert(B.signalisationCourse.creer(c,{}).rubans.every(v=>v.debut>=0 && v.fin<=c.arrivee));
});

test('les 209 cellules de la grille restent séparées par un joint horizontal et vertical', () => {
  const { vertices, indices, ranges } = globalThis.FRender.shared.geometry(false);
  const grille = ranges['bitume-ruban-grille'];
  const debut = grille.offset / indices.BYTES_PER_ELEMENT;
  const joints = [];
  for (let i = debut; i < debut + grille.count; i += 6) {
    const points = Array.from(indices.subarray(i, i + 6), index => vertices.subarray(6 * index, 6 * index + 3));
    if (points[0][2] <= .492) continue;
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    joints.push({ gauche: Math.min(...xs), droite: Math.max(...xs), bas: Math.min(...ys), haut: Math.max(...ys) });
  }
  const estJoint = (x, y) => joints.some(j => x >= j.gauche && x <= j.droite && y >= j.bas && y <= j.haut);
  for (let ligne = 0; ligne < 11; ligne++) for (let col = 0; col < 19; col++) {
    const x = (col + .5) / 19 - .5, y = (ligne + .5) / 11 - .5;
    assert(!estJoint(x, y));
    assert(estJoint(x - .5 / 19, y));
    assert(estJoint(x, y - .5 / 11));
  }
});

test('Larche à 29,4 km : flèches volumiques mobiles, lumière continue sous pluie et immobilisation du mouvement réduit',()=>{
  const c=B.larche.creer(210), etat=B.signalisationCourse.creer(c,{});
  const droite=etat.rubans.find(r=>dans(c,r,2868)), gauche=etat.rubans.find(r=>dans(c,r,2920));
  assert.equal(droite.sens,1);assert.equal(gauche.sens,-1);assert.notEqual(droite,gauche);
  const geom=globalThis.FRender.shared.geometry(false).ranges['bitume-ruban-chevron'];
  assert.equal(geom.count/3,20,'20 triangles instanciés pour la face, son revers et le profil');
  const vue=camera(c,2868);
  for (const qualite of ['low','high']) {
    const opt={qualite,pluie:1,nuit:1}, s=.18;
    const sortie=image(etat,s,vue,opt), o=sortie.find(v=>v.shape.startsWith('bitume-ruban-led-'));
    assert(o && o.s[1]>2.5 && o.emissive>.7);
    assert(sortie.some(v=>v.shape==='bitume-ruban-grille'),'diodes éteintes groupées sur la dalle');
    assert(sortie.some(v=>v.shape==='bitume-ruban-chevron'),'au loin, silhouette pleine antimoiré');
    const led=globalThis.FRender.shared.geometry(false).ranges['bitume-ruban-led-0'];
    const grille=globalThis.FRender.shared.geometry(false).ranges['bitume-ruban-grille'];
    assert(led.count/3>80,'plusieurs dizaines de diodes allumées en une seule forme');
    assert.equal(grille.count/3,68,'deux faces et les 20 joints verticaux / 12 joints horizontaux');
    const avant=[...o.p], e0=o.emissive, phase=o.shape;
    assert(image(etat,s+.16,vue,opt).includes(o),'le mouvement réutilise la même instance');
    assert.deepEqual(o.p,avant,'les diodes sont fixées à la dalle');
    assert.notEqual(o.shape,phase,'la flèche défile par colonnes de diodes');
    assert.notEqual(o.emissive,e0);
    image(etat,s,vue,{...opt,mouvementReduit:true});
    const fixe=[...o.p,o.emissive];
    image(etat,s+1,vue,{...opt,mouvementReduit:true});
    assert.deepEqual([...o.p,o.emissive],fixe);
    assert(o.emissive>.7,'une silhouette lumineuse subsiste');
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
