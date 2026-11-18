// Herbier : vérification bit-à-bit contre la référence historique (avant lot 28A).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const n of ['circuit', 'carene', 'botanique', 'ecologie', 'saisons', 'vegetation', 'decor']) require('../src/' + n + '.js');
const B = globalThis.BITUME;
const historique = require('./fixtures/herbier-historique.cjs')(B);

const circuits = [
  { nom: 'Val-Brûlé', theme: 'foret', graine: 11, longueur: 4200 },
  { nom: 'Port-Sable', theme: 'cote', graine: 29, longueur: 3600 },
  { nom: 'Haut-Col', theme: 'montagne', graine: 47, longueur: 5200 },
  { nom: 'Lande-Noire', theme: 'islande', graine: 83, longueur: 4600 },
  { nom: 'Roche-Fauve', theme: 'desert', graine: 107, longueur: 4800 },
  { nom: 'Brume-de-Jade', theme: 'asie', graine: 131, longueur: 5000 },
  { nom: 'Cap-Séquoia', theme: 'pacifique', graine: 157, longueur: 5200 }
];

const paliers = ['high', 'medium'];
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

const buf64 = new Float64Array(24);

function empreinteTriangles(h) {
  const hash = createHash('sha256');
  const totaux = new Float64Array(7);
  totaux[0] = h.aireBrute;
  totaux[1] = h.aire;
  totaux[2] = h.aireAccotements;
  totaux[3] = h.aireTerrain;
  totaux[4] = h.trianglesSources;
  totaux[5] = h.masques;
  totaux[6] = h.triangles.length;
  hash.update(Buffer.from(totaux.buffer));
  
  for (const t of h.triangles) {
    buf64[0] = t.points[0][0]; buf64[1] = t.points[0][1]; buf64[2] = t.points[0][2];
    buf64[3] = t.points[1][0]; buf64[4] = t.points[1][1]; buf64[5] = t.points[1][2];
    buf64[6] = t.points[2][0]; buf64[7] = t.points[2][1]; buf64[8] = t.points[2][2];
    buf64[9] = t.aire;
    buf64[10] = t.normal[0]; buf64[11] = t.normal[1]; buf64[12] = t.normal[2];
    buf64[13] = t.color[0]; buf64[14] = t.color[1]; buf64[15] = t.color[2];
    buf64[16] = t.plan.dx; buf64[17] = t.plan.dz; buf64[18] = t.plan.h; buf64[19] = t.plan.len;
    buf64[20] = t.boite.x0; buf64[21] = t.boite.x1; buf64[22] = t.boite.z0; buf64[23] = t.boite.z1;
    hash.update(Buffer.from(buf64.buffer));
    hash.update(t.type + ';');
  }
  return hash.digest('hex');
}

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function genererPoints(avant) {
  const points = [];
  if (avant.triangles.length === 0) return points;
  
  // Centre des triangles
  for (const t of avant.triangles) {
    const cx = (t.points[0][0] + t.points[1][0] + t.points[2][0]) / 3;
    const cz = (t.points[0][2] + t.points[1][2] + t.points[2][2]) / 3;
    points.push([cx, cz]);
  }
  
  // Boîte englobante
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const t of avant.triangles) {
    if (t.boite.x0 < x0) x0 = t.boite.x0;
    if (t.boite.x1 > x1) x1 = t.boite.x1;
    if (t.boite.z0 < z0) z0 = t.boite.z0;
    if (t.boite.z1 > z1) z1 = t.boite.z1;
  }
  x0 -= 10; x1 += 10; z0 -= 10; z1 += 10;
  
  const rand = mulberry32(12345);
  for (let i = 0; i < 20000; i++) {
    const x = x0 + rand() * (x1 - x0);
    const z = z0 + rand() * (z1 - z0);
    points.push([x, z]);
  }
  return points;
}

const bufSurf = new Float64Array(8);

function empreinteSurface(h, points) {
  const hash = createHash('sha256');
  const sortie = {};
  for (const [x, z] of points) {
    const res = h.surface(x, z, sortie);
    if (res === null) {
      hash.update('n;');
    } else {
      bufSurf[0] = sortie.y;
      bufSurf[1] = sortie.normal[0]; bufSurf[2] = sortie.normal[1]; bufSurf[3] = sortie.normal[2];
      bufSurf[4] = sortie.color[0]; bufSurf[5] = sortie.color[1]; bufSurf[6] = sortie.color[2];
      hash.update(Buffer.from(bufSurf.buffer));
      hash.update(sortie.type + ';');
    }
  }
  return hash.digest('hex');
}

for (const palier of paliers) {
  for (const cfg of circuits) {
    const c = B.circuit.creer(cfg.graine, { theme: cfg.theme, longueur: cfg.longueur });
    const d = B.decor.construire(c, { qualite: palier, matieres: true, vegetation: false, saison: 'ete' });
    const apres = d.herbier;
    const avant = historique(c, d.nappes, d.lotsHerbier || d.lots, d.limites, d.enceinte, d.niveauEau);
    
    verifier(`herbier ${palier} ${cfg.nom}`, () => {
      // (a) Totaux
      assert.strictEqual(avant.triangles.length, apres.triangles.length, 'Nombre de triangles différent');
      assert.ok(Object.is(avant.aireBrute, apres.aireBrute), 'aireBrute différent');
      assert.ok(Object.is(avant.aire, apres.aire), 'aire différent');
      assert.ok(Object.is(avant.aireAccotements, apres.aireAccotements), 'aireAccotements différent');
      assert.ok(Object.is(avant.aireTerrain, apres.aireTerrain), 'aireTerrain différent');
      assert.ok(Object.is(avant.trianglesSources, apres.trianglesSources), 'trianglesSources différent');
      assert.ok(Object.is(avant.masques, apres.masques), 'masques différent');
      
      // (b) Empreinte triangles
      const eAvant = empreinteTriangles(avant);
      const eApres = empreinteTriangles(apres);
      if (eAvant !== eApres) {
        // Chercher le premier triangle qui diffère
        let diffIdx = -1;
        for (let i = 0; i < avant.triangles.length; i++) {
          const ta = avant.triangles[i];
          const tb = apres.triangles[i];
          let diff = false;
          // Comparaison rapide des champs clés
          if (ta.type !== tb.type) diff = true;
          else if (ta.aire !== tb.aire) diff = true;
          else if (ta.normal[0] !== tb.normal[0] || ta.normal[1] !== tb.normal[1] || ta.normal[2] !== tb.normal[2]) diff = true;
          else if (ta.color[0] !== tb.color[0] || ta.color[1] !== tb.color[1] || ta.color[2] !== tb.color[2]) diff = true;
          else if (ta.plan.dx !== tb.plan.dx || ta.plan.dz !== tb.plan.dz || ta.plan.h !== tb.plan.h || ta.plan.len !== tb.plan.len) diff = true;
          else if (ta.boite.x0 !== tb.boite.x0 || ta.boite.x1 !== tb.boite.x1 || ta.boite.z0 !== tb.boite.z0 || ta.boite.z1 !== tb.boite.z1) diff = true;
          else if (ta.points[0][0] !== tb.points[0][0] || ta.points[0][1] !== tb.points[0][1] || ta.points[0][2] !== tb.points[0][2]) diff = true;
          else if (ta.points[1][0] !== tb.points[1][0] || ta.points[1][1] !== tb.points[1][1] || ta.points[1][2] !== tb.points[1][2]) diff = true;
          else if (ta.points[2][0] !== tb.points[2][0] || ta.points[2][1] !== tb.points[2][1] || ta.points[2][2] !== tb.points[2][2]) diff = true;
          
          if (diff) {
            diffIdx = i;
            break;
          }
        }
        assert.fail(`Empreinte triangles différente. Premier triangle divergent à l'indice ${diffIdx}. Avant: ${JSON.stringify(avant.triangles[diffIdx])}, Après: ${JSON.stringify(apres.triangles[diffIdx])}`);
      }
      
      // (c) Empreinte surface
      const points = genererPoints(avant);
      const sAvant = empreinteSurface(avant, points);
      const sApres = empreinteSurface(apres, points);
      assert.strictEqual(sAvant, sApres, 'Empreinte surface différente');
      
      // (d) Au moins un triangle pour certains circuits
      if (['Val-Brûlé', 'Port-Sable', 'Haut-Col', 'Brume-de-Jade', 'Cap-Séquoia'].includes(cfg.nom)) {
        assert.ok(avant.triangles.length > 0, 'Aucun triangle généré');
      }
      
      console.log(`ok herbier ${palier} ${cfg.nom} : ${avant.triangles.length} triangles, ${points.length} requêtes, empreinte avant ${eAvant.substring(0, 16)} après ${eApres.substring(0, 16)}`);
    });
  }
}

console.log(`herbier : ${controles} cas identiques au bit (triangles et requêtes de surface)`);
