// Régressions sur les vrais circuits/triangles et le vrai solveur, avec des voitures dynamiques.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'botanique', 'ecologie', 'saisons', 'vegetation',
  'bords', 'carene', 'decor', 'meteo', 'strategie-stands', 'course', 'solides-physx', 'physique']) require('../src/' + f + '.js');
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX(), DT = 1 / 120;
const catalogue = vm.runInNewContext(readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8')
  .match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
const NEUTRE = { gaz: 0, frein: 0, volant: 0, aide: 0, guidage: 0, boite: 'auto', marcheArriere: false };
const FREIN = { ...NEUTRE, frein: 1 }, rapports = [];
const fichiers = ['src/circuit.js', 'src/conduite.js', 'src/course.js', 'src/physique.js', 'src/solides-physx.js',
  'src/decor.js', 'src/bords.js', 'src/ferro/physx-runtime.js', 'verifications/physx-circuits.test.mjs',
  'verifications/helpers/physx-runtime.mjs'];
const empreintes = Object.fromEntries(fichiers.map(f => [f, createHash('sha256')
  .update(readFileSync(new URL('../' + f, import.meta.url))).digest('hex')]));
const adaptateur = process.env.BITUME_PHYSX_ADAPTER || fileURLToPath(new URL('../src/ferro/physx.js', import.meta.url));
empreintes.adaptateurPhysX = createHash('sha256').update(readFileSync(adaptateur)).digest('hex');
let controles = 0;
function verifier(nom, f) {
  const debut = performance.now(), r = { nom, reussi: false }; controles++;
  try { Object.assign(r, f()); r.reussi = true; console.log('ok  ' + nom); }
  catch (e) { r.erreur = e.message; throw e; }
  finally { r.dureeExecutionMs = performance.now() - debut; rapports.push(r); }
}
function construire(k) {
  const c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom });
  B.bords.limites(c, B.bords.planifier(c));
  const decor = B.decor.construire(c, { qualite: 'high', vegetation: false, saison: 'ete' });
  c.obstacles = B.obstacles.creer(decor.obstacles);
  B.meteo.actuel = B.chaussee.preparer({ pluie: 0, mouille: 0, neigeSol: 0, fixe: true }, B.saisons.profil('ete', c.theme));
  return { c, decor };
}
function course(scene, s, vitesse = 0) {
  const co = B.course.creer(scene.c, { mode: 'chrono', rivaux: 0, tours: 3, graine: 42 });
  co.phase = 'course'; co.joueur.ia.hab = .9;
  Object.assign(co.joueur.etat, { s, d: 0, v: vitesse });
  const p = B.physique.installer(co, scene.decor), e = co.joueur.etat;
  return { co, p, e, ph: e._physx, c: scene.c, ev: [], cmd: {} };
}
function surveiller(s) {
  const r = { pas: 0, sondes: 0, minRepereSolVisible: Infinity, maxRepereSolVisible: -Infinity,
    sousLeSol: 0, corrections: 0, genresContacts: new Set(), appuisTunnel: 0 };
  for (const nom of ['setPose', 'setVelocity', 'setAngularVelocity']) {
    const original = s.p.world[nom];
    s.p.world[nom] = function (...args) { r.corrections++; return original.apply(this, args); };
  }
  const origine = [0, 0, 0], hit = {};
  r.lire = () => {
    const { p, ph, e } = s;
    assert([ph.x, ph.y, ph.z, e.v, e.tangage, e.roulis].every(Number.isFinite), 'état dynamique non fini');
    origine[0] = ph.x; origine[1] = ph.y + 12; origine[2] = ph.z;
    p.world.raycast(origine, [0, -1, 0], 24, { mask: 1, staticOnly: true }, hit);
    assert(hit.hit, 'sol visible absent sous la voiture');
    const gap = ph.y - hit.y; r.minRepereSolVisible = Math.min(r.minRepereSolVisible, gap);
    r.maxRepereSolVisible = Math.max(r.maxRepereSolVisible, gap); r.sondes++;
    if (gap < -.15) r.sousLeSol++;
    if (p.solids.acteurs.get(hit.body)?.genre === 'sol-tunnel') r.appuisTunnel++;
    for (let i = 0; i < p.world.contacts.count; i++) {
      const q = p.world.contacts.points[i], autre = q.a === ph.id ? q.b : q.b === ph.id ? q.a : null;
      const genre = p.solids.acteurs.get(autre)?.genre; if (genre) r.genresContacts.add(genre);
    }
    r.pas++;
  };
  r.verifier = () => {
    assert.equal(r.corrections, 0, 'la pose/vitesse a été imposée après le départ');
    assert.equal(s.e.repositionnements, 0, 'replacement pendant le scénario');
    assert.equal(r.sousLeSol, 0, 'repère caisse plus de 15 cm sous les triangles visibles');
  };
  r.resume = () => ({ pas: r.pas, sondes: r.sondes, minRepereSolVisible: r.minRepereSolVisible,
    maxRepereSolVisible: r.maxRepereSolVisible, corrections: r.corrections, replacements: s.e.repositionnements,
    contacts: [...r.genresContacts], appuisTunnel: r.appuisTunnel });
  return r;
}
function avancer(s, n, commande, r) {
  for (let i = 0; i < n; i++) { B.course.pas(s.co, commande === 'ia' ? B.course.commandesIA(s.co, s.co.joueur, s.cmd) : commande, DT, s.ev); r.lire(); }
}

try {
  for (const k of catalogue) {
    const scene = construire(k);
    verifier(k.nom + ' : quatre appuis réels, puis roulage dynamique sur le relief du circuit', () => {
      // Point de pente réelle forte, loin du bouclage, sans commencer dans un virage serré.
      let index = 60;
      for (let i = 60; i < scene.c.n - 60; i++)
        if (Math.abs(scene.c.courbure[i]) < 1 / 350 && Math.abs(scene.c.pente[i]) > Math.abs(scene.c.pente[index])) index = i;
      const s = course(scene, index * scene.c.pas), r = surveiller(s);
      try {
        avancer(s, 240, FREIN, r);
        assert.equal(s.ph.groundCount, 4, 'une suspension ne porte pas sur le circuit');
        const depart = s.e.distance;
        avancer(s, 1200, 'ia', r);
        r.verifier(); assert(s.e.distance - depart > 50, 'la voiture ne progresse pas sur le vrai circuit');
        return { circuit: k.id, sDepart: index * scene.c.pas, distance: s.e.distance - depart, ...r.resume() };
      } finally { B.physique.liberer(s.co); }
    });

    if (k.id === 'baikal') verifier('Baïkal : le saut s=2520 m à 60 m/s rencontre la montée responsable des trois mètres de traversée', () => {
      const s = course(scene, 2520, 60), r = surveiller(s); let aUneSeconde;
      try {
        B.conduite.lancerSaut(s.e, { grand: true });
        for (let i = 0; i < 360; i++) {
          avancer(s, 1, NEUTRE, r);
          if (i === 119) aUneSeconde = { s: s.e.s, y: s.ph.y, appuis: s.ph.groundCount, saut: !!s.e.saut };
        }
        r.verifier(); assert(r.maxRepereSolVisible > .2, 'le vrai saut n’a pas décollé');
        assert(s.e.s > 2660 && s.ph.groundCount === 4, 'la voiture n’a pas repris sa route après réception');
        assert.equal(aUneSeconde.saut, false, 'le saut doit déjà avoir rencontré la montée à une seconde');
        return { circuit: k.id, aUneSeconde, ...r.resume() };
      } finally { B.physique.liberer(s.co); }
    });

    if (scene.c.tunnel) {
      const t = scene.c.tunnel, milieu = (t.debut + t.fin) / 2;
      verifier(k.nom + ' : entrée, sol intérieur surélevé et sortie du tunnel avec quatre suspensions', () => {
        const s = course(scene, t.debut - 20, 35), r = surveiller(s);
        try {
          for (let i = 0; i < 3600 && s.e.s < t.fin + 20; i++) avancer(s, 1, 'ia', r);
          r.verifier(); assert(s.e.s >= t.fin + 20, 'la voiture ne sort pas du tunnel');
          assert(r.appuisTunnel > 120, 'le sol intérieur réel n’a pas été parcouru');
          assert(s.ph.groundCount >= 2, 'les suspensions ne reprennent pas la chaussée extérieure');
          return r.resume();
        } finally { B.physique.liberer(s.co); }
      });
      for (const cote of [-1, 1]) verifier(k.nom + ' : le châssis heurte le mur ' + (cote < 0 ? 'gauche' : 'droit') + ' du tunnel sans le traverser', () => {
        const s = course(scene, milieu), q = B.circuit.echantillon(scene.c, milieu);
        // Condition de départ d'un essai d'impact ; aucune écriture ensuite.
        s.p.world.setVelocity(s.ph.id, [-Math.sin(q.cap) * 60 * cote, 0, Math.cos(q.cap) * 60 * cote]); s.e.immunite = 10;
        const r = surveiller(s); let maxD = 0;
        try {
          for (let i = 0; i < 36; i++) { avancer(s, 1, NEUTRE, r); maxD = Math.max(maxD, s.e.d * cote); }
          r.verifier(); assert(r.genresContacts.has('mur-tunnel'), 'aucun contact natif avec le mur');
          assert(maxD < t.mur + .1, 'le châssis est passé de l’autre côté du mur');
          return { cote, vitesseInitiale: 60, maxD, mur: t.mur, ...r.resume() };
        } finally { B.physique.liberer(s.co); }
      });
      verifier(k.nom + ' : une voiture projetée vers la voûte reçoit un contact PhysX réel', () => {
        const s = course(scene, milieu), q = B.circuit.echantillon(scene.c, milieu);
        const plafond = s.p.world.raycast([q.x, q.y + 1, q.z], [0, 1, 0], t.hauteur + 1, { mask: 2, staticOnly: true });
        assert.equal(s.p.solids.acteurs.get(plafond.body)?.genre, 'voute-tunnel');
        s.p.world.setVelocity(s.ph.id, [0, 35, 0]); s.e.immunite = 10;
        const r = surveiller(s); let maxY = -Infinity;
        try {
          for (let i = 0; i < 72; i++) { avancer(s, 1, NEUTRE, r); maxY = Math.max(maxY, s.ph.y); }
          r.verifier(); assert(r.genresContacts.has('voute-tunnel'), 'aucun contact natif avec la voûte');
          assert(maxY < plafond.y + .05, 'le centre du châssis a franchi la voûte');
          return { vitesseVerticaleInitiale: 35, maxY, plafond: plafond.y, ...r.resume() };
        } finally { B.physique.liberer(s.co); }
      });
    }
  }
  verifier('les scénarios libèrent tous leurs mondes PhysX', () => { assert.equal(X.status().worlds, 0); return { mondesRestants: 0 }; });
  console.log(JSON.stringify({ controles, dt: DT, PhysX: X.status().version, rapports }));
} finally {
  if (process.env.BITUME_RAPPORTS_PHYSX_CIRCUITS) {
    const dossier = resolve(process.env.BITUME_RAPPORTS_PHYSX_CIRCUITS); mkdirSync(dossier, { recursive: true });
    writeFileSync(resolve(dossier, 'physx-circuits.json'), JSON.stringify({ date: new Date().toISOString(), node: process.version,
      portee: 'Scénarios dynamiques ciblés sur les huit circuits ; pas une course complète sur chaque circuit.',
      runtime: X.status(), adaptateur, dt: DT, controles, reussis: rapports.filter(r => r.reussi).length,
      empreintes, rapports }, null, 2) + '\n');
  }
  X.dispose();
}
