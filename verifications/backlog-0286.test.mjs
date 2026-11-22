// Qualification complète du jalon 0.2.86 : Larche -> Vinadio (32,8 km), 6 destinations (16A-16F),
// aériens (hélicoptère + drones), signalisation LED, transitions de caméra, championnat, records et cache.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';

const req = createRequire(import.meta.url);
for (const f of [
  'circuit', 'couverts', 'bords', 'batiments', 'botanique', 'lieux',
  'larche-vinadio-data', 'larche-vinadio', 'larche-vinadio-decor',
  'destinations', 'aeriens', 'signalisation-course', 'camera-transition',
  'championnat', 'records', 'cache', 'decor', 'solides-physx', 'conduite', 'physique', 'course'
]) req('../src/' + f + '.js');

const B = globalThis.BITUME;
const X = await chargerPhysX();
globalThis.FPhysX = X;

try {
  // 1. Col de Larche -> Vinadio (32,8 km, topologie ouverte, 6 couverts, 16 ponts, terrain corridor rapide, PhysX)
  {
    const c = B.larche.creer();
    assert.deepEqual(B.larche.valider(c), []);
    assert.equal(c.ouvert, true);
    assert.equal(c.couverts.length, 6);
    assert.equal(c.ponts.length, 16);
    const t0 = performance.now();
    const decor = B.decor.construire(c, { qualite: 'low', vegetation: false, organique: true });
    const ms = performance.now() - t0;
    assert.ok(ms < 1500, `construction décor Larche trop lente : ${ms.toFixed(1)} ms`);
    assert.ok(decor.nappes.length > 50 && decor.lots.length > 50);
    // Contact PhysX au départ (Col de Larche), à mi-descente (16 km) et à l'arrivée (Vinadio)
    const world = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 1 });
    const solids = B.solidesPhysX.installer(world, c, decor);
    try {
      const hit = {};
      for (const s of [20, 8000, 16000, 26000, 32200]) {
        const f = B.circuit.echantillon(c, s);
        world.raycast([f.x, f.y + 2.5, f.z], [0, -1, 0], 5, { mask: 3, staticOnly: true }, hit);
        assert.ok(hit.hit, `sol PhysX manquant sur Larche à s=${s}`);
        const err = Math.abs((f.y + 2.5 - hit.distance) - f.y);
        assert.ok(err < 0.25, `écart sol PhysX excessif sur Larche à s=${s}: ${err.toFixed(3)} m`);
      }
    } finally {
      B.solidesPhysX.liberer(solids);
      world.dispose();
    }
    console.log(`ok Larche->Vinadio (32,8 km, 6 couverts, 16 ponts, décor ${ms.toFixed(0)} ms, PhysX vérifié)`);
  }

  // 2. Six destinations originales (16A-16F)
  {
    assert.equal(B.destinations.CATALOGUE.length, 6);
    for (const dest of B.destinations.CATALOGUE) {
      assert.ok(B.destinations.THEMES[dest.theme], `thème manquant ${dest.theme}`);
      const c = B.circuit.creer(dest.graine, { theme: dest.theme, longueur: dest.longueur });
      assert.deepEqual(B.circuit.valider(c), [], `tracé invalide pour ${dest.id}`);
      const d = B.decor.construire(c, { qualite: 'low', vegetation: false, organique: true });
      assert.ok(d.nappes.length > 20 && d.lots.length > 20, `décor vide pour ${dest.id}`);
    }
    console.log('ok 6 destinations originales (fjord, carpates, ecosse, sierra, corail, andes)');
  }

  // 3. Aériens (hélicoptère + drones) : low=0, medium=1 drone, high=2 drones, toutes formes valides
  {
    const c = B.circuit.creer(11, { theme: 'plaine', longueur: 3600 });
    const ae = B.aeriens.creer(c, { qualite: 'high' });
    assert.ok(Object.keys(B.aeriens.FORMES).length >= 8);
    for (const [nom, geo] of Object.entries(B.aeriens.FORMES)) {
      assert.ok(Array.isArray(geo.tris) && geo.tris.length > 0, `tris vides pour ${nom}`);
    }
    const outLow = [], outHigh = [];
    const ctx = { qualite: 'low', cible: [c.x[0], c.y[0], c.z[0]], cibleCap: 0, cibleVitesse: 50, sCible: 0, nuit: 0, sol: () => 0 };
    B.aeriens.dessiner(ae, 5, ctx, outLow);
    assert.equal(outLow.length, 0, 'low coupe les aériens');
    ctx.qualite = 'high';
    B.aeriens.dessiner(ae, 5, ctx, outHigh);
    assert.ok(outHigh.length >= 14, `high attend hélico + drones, reçu ${outHigh.length}`);
    assert.ok(outHigh.every(o => typeof o.emissive === 'number' && o.p.every(Number.isFinite)));
    console.log(`ok aériens (${Object.keys(B.aeriens.FORMES).length} formes, ${outHigh.length} objets en high, 0 en low)`);
  }

  // 4. Signalisation course (chevrons animés + bandeaux LED)
  {
    const c = B.circuit.creer(11, { theme: 'plaine', longueur: 3600 });
    const d = B.decor.construire(c, { qualite: 'low', vegetation: false });
    const sig = B.signalisationCourse.creer(c, d);
    const out = [];
    B.signalisationCourse.mettreAJour(sig, 1.2, { qualite: 'high', phase: 'depart', feux: 3, pluie: 0, nuit: 0, cameraPos: [c.x[0], c.y[0] + 2, c.z[0]] }, out);
    assert.ok(out.length >= 24, `bandeaux LED attendus >= 24, reçu ${out.length}`);
    assert.ok(out.every(o => typeof o.emissive === 'number'));
    console.log(`ok signalisation course (${sig.chevrons.length} chevrons, ${sig.bandeaux.length} bandeaux LED)`);
  }

  // 5. Transitions continues de caméra
  {
    const ct = B.cameraTransition.creer();
    B.cameraTransition.demander(ct, { pos: [0, 0.9, 0], yaw: 0, pitch: 0, roll: 0, fov: 70, near: 0.1 });
    const mid = B.cameraTransition.appliquer(ct, { pos: [0, 2.5, -7], yaw: 0.2, pitch: -0.1, roll: 0, fov: 64, near: 0.1, far: 4000 }, 0.17, { solY: 0 });
    assert.ok(mid.pos[1] > 1.0 && mid.pos[1] < 2.5);
    let fin = mid;
    for (let i = 0; i < 8; i++) fin = B.cameraTransition.appliquer(ct, { pos: [0, 2.5, -7], yaw: 0.2, pitch: -0.1, roll: 0, fov: 64, near: 0.1, far: 4000 }, 0.05, { solY: 0 });
    assert.equal(ct.actif, false);
    assert.equal(fin.pos[2], -7);
    console.log('ok transitions continues de caméra');
  }

  // 6. Championnat multi-courses + Records enrichis + Cache versionné
  {
    const cat = Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, nom: 'C' + i }));
    const ch = B.championnat.creer('europe', cat);
    B.championnat.enregistrerCourse(ch, [{ id: 'j1', nom: 'Vous', temps: 100 }, { id: 'ia1', nom: 'Varenne', temps: 102 }], 'j1');
    const cl = B.championnat.classement(ch);
    assert.equal(cl[0].id, 'j1');
    assert.equal(cl[0].points, 26); // 25 + 1 meilleur tour
    const rec = B.records.migrerAnciens({ c0: { tour: 62000, course: 190000 } }, cat);
    const res = B.records.enregistrer(rec, { circuitId: 'c0', sens: 'normal', mode: 'course', boite: 'auto' }, { tourMs: 60500, courseMs: 185000 });
    assert.equal(res.nouveauTour, true);
    assert.equal(res.nouvelleCourse, true);
    const mem = new Map();
    B.cache._setMemoryStore(mem);
    const cle = B.cache.cleDecor('larche', 210, 'medium', 'ete', '0.2.86');
    assert.equal(await B.cache.ecrire(cle, { ok: 42 }), true);
    const lu = await B.cache.lire(cle);
    assert.deepEqual(lu, { ok: 42 });
    console.log('ok championnat, records enrichis et cache versionné intègre');
  }

  console.log('backlog-0286 : 6 suites complètes passées');
} finally {
  X.dispose();
}
