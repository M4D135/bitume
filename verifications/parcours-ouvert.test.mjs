// Lot L2 — Parcours ouvert (Col de Larche -> Vinadio) : circuit, conduite, course et non-régression boucle fermée.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const require = createRequire(import.meta.url);
for (const m of ['circuit', 'chaussee', 'pneus', 'usure-pneus', 'conduite', 'degats', 'strategie-stands', 'course']) {
  require(resolve(ROOT, 'src', m + '.js'));
}
const B = globalThis.BITUME;

function construireTraceOuvert() {
  const pts = [], N = 440, L = 4400, ds = L / N;
  for (let i = 0; i <= N; i++) {
    const s = i * ds;
    const y = 1200 - 300 * (s / L);
    const freq = 2 * Math.PI * 3 / L;
    const x = 65 * Math.sin(freq * s);
    const z = s;
    pts.push({
      x, y, z,
      devers: 0.03 * Math.sin(freq * s),
      largeurG: 4.5, largeurD: 4.5,
      limiteG: 6.5, limiteD: 6.5,
    });
  }
  return { nom: 'Larche-Vinadio-Synthetique', unite: 'm', topologie: 'ouvert', depart: 0, arrivee: 4000, points: pts };
}

function construireTraceFerme() {
  const pts = [], N = 360, R = 500;
  for (let i = 0; i <= N; i++) {
    const theta = (i / N) * 2 * Math.PI;
    pts.push({
      x: R * Math.cos(theta), y: 0, z: R * Math.sin(theta),
      devers: 0.04, largeurG: 4.5, largeurD: 4.5, limiteG: 6.5, limiteD: 6.5,
    });
  }
  pts[N] = { ...pts[0] };
  return { nom: 'Boucle-Synthetique', unite: 'm', points: pts };
}

describe('Lot L2 — Parcours ouvert : circuit.js', () => {
  it('validerTrace passe sur un tracé ouvert valide', () => {
    const c = B.circuit.creerDepuisTrace(construireTraceOuvert(), { topologie: 'ouvert' });
    assert.equal(c.ouvert, true);
    assert.equal(c.topologie, 'ouvert');
    assert.equal(c.depart, 0);
    assert.equal(c.arrivee, 4000);
    assert.deepEqual(c.zoneDeceleration, [4000, c.longueur]);
    assert.deepEqual(B.circuit.valider(c), []);
  });

  it('rejette un tracé non fermé si topologie ouverte non demandée', () => {
    const t = construireTraceOuvert();
    delete t.topologie;
    assert.throws(() => B.circuit.creerDepuisTrace(t), /boucle non fermée/);
  });

  it('ramener et ecart ne rebouclent jamais en mode ouvert', () => {
    const c = B.circuit.creerDepuisTrace(construireTraceOuvert(), { topologie: 'ouvert' });
    assert.equal(B.circuit.ramener(c, c.longueur + 120), c.longueur);
    assert.equal(B.circuit.ramener(c, -80), 0);
    assert.equal(B.circuit.ramener(c, 1234), 1234);
    assert.equal(B.circuit.ecart(c, 100, 350), 250);
    assert.equal(B.circuit.ecart(c, 350, 100), -250);
    assert.equal(B.circuit.ecart(c, 0, c.longueur), c.longueur);
  });

  it('echantillonTrace et dansTunnel ne rebouclent pas aux bornes', () => {
    const c = B.circuit.creerDepuisTrace(construireTraceOuvert(), { topologie: 'ouvert' });
    const eFin = B.circuit.echantillon(c, c.longueur), eApres = B.circuit.echantillon(c, c.longueur + 500);
    assert.equal(eFin.x, eApres.x); assert.equal(eFin.z, eApres.z);
    const eDeb = B.circuit.echantillon(c, 0), eAvant = B.circuit.echantillon(c, -200);
    assert.equal(eDeb.x, eAvant.x); assert.equal(eDeb.z, eAvant.z);
    c.tunnel = { debut: 1000, fin: 1200 };
    assert.equal(B.circuit.dansTunnel(c, -100, 0), false);
    assert.equal(B.circuit.dansTunnel(c, c.longueur + 100, 0), false);
    assert.equal(B.circuit.dansTunnel(c, 1100, 0), true);
  });

  it('charge le relevé réel Col de Larche -> Vinadio (trace-l1.json) en mode ouvert', () => {
    const p = resolve(ROOT, 'docs/references/larche-vinadio-2026/trace-l1.json');
    if (!existsSync(p)) return;
    const brut = JSON.parse(readFileSync(p, 'utf8'));
    const points = (brut.points || []).map(pt => ({
      x: pt.localX, y: pt.yChausseeM ?? pt.zTerrainDtm5M, z: pt.localZ,
      largeurG: pt.largeurGM ?? 3.5, largeurD: pt.largeurDM ?? 3.5,
      limiteG: (pt.largeurGM ?? 3.5) + 1.5, limiteD: (pt.largeurDM ?? 3.5) + 1.5,
      devers: pt.deversRad ?? 0,
    }));
    const c = B.circuit.creerDepuisTrace({
      nom: 'Col de Larche -> Vinadio', unite: 'm', topologie: 'ouvert',
      depart: 0, arrivee: brut.resume.longueurPlanCourseM, points, pasMax: 5
    }, { topologie: 'ouvert' });
    assert.equal(c.ouvert, true);
    assert(c.longueur > 32000, 'Longueur attendue > 32 km : ' + c.longueur);
    assert.deepEqual(B.circuit.valider(c), []);
  });
});

describe('Lot L2 — Parcours ouvert : conduite.js et course.js', () => {
  it('conduite borne etat.s dans [0, L] en avant et en marche arrière', () => {
    const c = B.circuit.preparerParcours(B.circuit.creerDepuisTrace(construireTraceOuvert(), { topologie: 'ouvert' }));
    const e1 = B.conduite.creer(c.longueur - 8, 0); e1.v = 32;
    const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0.35 };
    for (let i = 0; i < 180; i++) B.conduite.pas(e1, cmd, c, 1 / 120, false, []);
    assert(e1.s > c.longueur - 20 && e1.s <= c.longueur, 's fin : ' + e1.s);

    const e2 = B.conduite.creer(4, 0); e2.v = -10;
    const cmdAr = { gaz: 0, frein: 1, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0, marcheArriere: true };
    for (let i = 0; i < 180; i++) B.conduite.pas(e2, cmdAr, c, 1 / 120, false, []);
    assert(e2.s >= 0 && e2.s < 20, 's recul : ' + e2.s);
  });

  it('grille ordonnée dans [0, arrivee), franchissement unique et décélération dans [arrivee, L]', () => {
    const c = B.circuit.creerDepuisTrace(construireTraceOuvert(), { topologie: 'ouvert' });
    const course = B.course.creer(c, { mode: 'course', tours: 3, rivaux: 5, graine: 42, placeJoueur: 3 });
    assert.equal(course.toursTotal, 1);
    for (const v of course.voitures) {
      assert(v.etat.s >= 0 && v.etat.s < c.arrivee, `voiture ${v.id} hors grille : ${v.etat.s}`);
    }
    // Lancer la course (feux -> vert) puis laisser l'IA franchir l'arrivée (mode spectateur via joueur fini ou rivaux)
    const dt = 1 / 120, neutre = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
    for (let i = 0; i < 820 && course.phase !== 'course'; i++) B.course.pas(course, neutre, dt, []);
    assert.equal(course.phase, 'course');
    const leader = course.voitures.find(v => !v.joueur);
    let progPrec = leader.progression;
    for (let i = 0; i < 120 * 95 && !leader.fini; i++) {
      B.course.pas(course, neutre, dt, []);
      assert(leader.progression >= progPrec - 1e-6, `progression non monotone : ${leader.progression} < ${progPrec}`);
      progPrec = leader.progression;
    }
    assert.equal(leader.fini, true, 'le rival doit franchir l’arrivée');
    assert.equal(leader.tours, 1);
    assert.equal(leader.passages, 1);
    assert(leader.tempsFinal > 0);
    // 4 s supplémentaires dans la zone de décélération : reste dans [arrivee, longueur] et ralentit
    for (let i = 0; i < 120 * 4; i++) B.course.pas(course, neutre, dt, []);
    assert(leader.etat.s >= c.arrivee && leader.etat.s <= c.longueur, 'hors zone décélération : ' + leader.etat.s);
    assert(leader.etat.v < 15, 'décélération insuffisante : ' + leader.etat.v);
  });

  it('non-régression boucle fermée : ecart ±L/2 et déterminisme inchangés', () => {
    const c = B.circuit.preparerParcours(B.circuit.creerDepuisTrace(construireTraceFerme()));
    assert(!c.ouvert);
    assert(B.circuit.ecart(c, 0, c.longueur - 1) < 0);
    const c1 = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
    const k1 = B.course.creer(c1, { mode: 'course', tours: 1, rivaux: 5, graine: 11, placeJoueur: 4 });
    const k2 = B.course.creer(c1, { mode: 'course', tours: 1, rivaux: 5, graine: 11, placeJoueur: 4 });
    const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0.35 };
    for (let i = 0; i < 900; i++) { B.course.pas(k1, cmd, 1 / 120, []); B.course.pas(k2, cmd, 1 / 120, []); }
    assert.deepEqual(k1.voitures.map(v => [v.etat.s, v.etat.d, v.etat.v]), k2.voitures.map(v => [v.etat.s, v.etat.d, v.etat.v]));
  });
});
