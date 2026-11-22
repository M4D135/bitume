// Même caméra avant/après, sur les mêmes décors. Compteurs de passe couleur issus des
// volumes, décisions de LOD et indices FERRO. Le chronomètre mesure le sélecteur CPU seul.
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
for (const n of ['moteur/renderer', 'graphismes', 'circuit', 'carene', 'ecologie', 'saisons',
  'vegetation', 'botanique', 'chaussee', 'virages', 'baikal', 'bords', 'batiments', 'destinations',
  'route-des-cimes', 'route-des-cimes-decor', 'larche-vinadio', 'larche-vinadio-decor', 'decor', 'detail-peripherique']) require('../src/'+n+'.js');
const B = globalThis.BITUME, R = globalThis.FRender.shared, D = B.detailPeripherique;
const formes = R.geometry(false).ranges;
const epreuves = [
  ['Val-Brûlé', () => B.circuit.creer(11,{theme:'foret',longueur:4200})],
  ['Cap-Séquoia', () => B.circuit.creer(157,{theme:'pacifique',longueur:5200})],
  ['Route-des-Cimes', () => B.circuit.creer(181,{theme:'montagne',longueur:9697.52858032384,partition:'route-des-cimes'})],
  ['Larche', () => B.larche.creer(210)]
];
function cout(objets) {
  let triangles = 0;
  for (const o of objets) {
    const forme = formes[o.shape || 'box']; assert.ok(forme, o.shape);
    triangles += forme.count / 3;
  }
  return { instances: objets.length, triangles };
}
const resultats = [];
for (const [nom, circuit] of epreuves) {
  const c = circuit();
  if (!c.ouvert) B.bords.limites(c, B.bords.planifier(c));
  const decor = B.decor.construire(c,{qualite:'high',vegetation:true,vegetationQualite:'high',matieres:true,solsProceduraux:true,organique:true});
  const selecteur = D.creer(decor.lots), arbres = decor.lots.filter(l => l.arbres);
  const couts = new Map(arbres.map(l => [l, [cout(l.loin), cout(l.objets)]]));
  const refs = decor.lots.map(l => [l.objets, l.loin, l.bascule]), etats = R.lotViewState();
  for (const [largeur, hauteur] of [[1920,1080],[1920,540]]) {
    let avant = 0, apres = 0, ia = 0, ip = 0, changes = 0, charges = 0, ns = 0;
    for (let k=0;k<256;k++) {
      const s = ((k+.5)/256)*(c.arrivee || c.longueur), p = B.circuit.echantillon(c,s);
      const et = {s,v:Math.min(76,p.vitesse||60),frein:Math.abs(p.courbure)>.004 ? .7 : 0};
      const cam = {pos:[p.x,p.y+1.35,p.z],yaw:p.cap+Math.PI/2,pitch:-.03,roll:0,fov:66};
      const axes = R.cameraAxes(cam), tan = Math.tan(cam.fov*Math.PI/360);
      function mesurer() {
        let n=0, t=0;
        for (const rec of etats.prepare(arbres,cam.pos,tan,hauteur)) {
          if (!R.visible(rec.bounds,cam.pos,axes,tan*largeur/hauteur,tan,900)) continue;
          const cout = couts.get(rec.lot)[Number(rec.near)]; n += cout.instances; t += cout.triangles;
        }
        return [n,t];
      }
      const [n0,t0] = mesurer();
      // Répéter à caméra fixe pour distinguer la microseconde des fluctuations du chronomètre.
      const debut = performance.now();
      for (let i=0;i<32;i++) {D.appliquer(selecteur,c,et,cam,largeur,hauteur);D.restaurer(selecteur);}
      ns += (performance.now()-debut)*1e6/32;
      D.appliquer(selecteur,c,et,cam,largeur,hauteur);
      const [n1,t1] = mesurer();
      if (t0!==t1 || n0!==n1) changes++;
      charges += selecteur.n;
      D.restaurer(selecteur);
      ia+=n0;ip+=n1;avant+=t0;apres+=t1;
    }
    for (let i=0;i<refs.length;i++) {
      assert.equal(decor.lots[i].objets,refs[i][0]); assert.equal(decor.lots[i].loin,refs[i][1]); assert.equal(decor.lots[i].bascule,refs[i][2]);
    }
    resultats.push({nom,largeur,hauteur,cameras:256,arbres:arbres.length,cellulesModifiees:charges,vuesModifiees:changes,
      trianglesAvant:avant,trianglesApres:apres,instancesAvant:ia,instancesApres:ip,cpuSelecteurUsParVue:+(ns/256/1000).toFixed(2)});
  }
}
console.log(JSON.stringify(resultats,null,2));
