// Exécute le vrai lancer() du jeu avec des mondes natifs et deux erreurs de construction tardives.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'route-des-cimes', 'conduite', 'degats', 'contacts', 'obstacles', 'course', 'solides-physx', 'physique',
  'carene', 'humain-donnees', 'humain-corps', 'main', 'voiture', 'traces', 'botanique', 'ecologie', 'saisons', 'vegetation', 'bords', 'decor', 'ambiance', 'meteo', 'son']) require('../src/' + f + '.js');
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX();
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8'), rapports = [];
const catalogue = vm.runInNewContext(source.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
function fonction(nom) {
  const debut = source.indexOf('  function ' + nom + '('), fin = source.indexOf('\n  }', debut);
  assert.ok(debut >= 0 && fin > debut, 'fonction du jeu absente : ' + nom);
  return source.slice(debut, fin + 4);
}
const fonctions = ['lancer', 'graine32', 'remplirPoses', 'creerChampsFaune'].map(fonction).join('\n');
const k = catalogue[0], c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom, partition: k.partition });
B.bords.limites(c, B.bords.planifier(c));
const decor = B.decor.construire(c, { qualite: 'low', vegetation: false, saison: 'ete', solsProceduraux: true });
c.obstacles = B.obstacles.creer(decor.obstacles);

for (const panne of ['modele', 'prechauffage']) test('PhysX : une exception de ' + panne + ' libère ancienne et nouvelle séance', () => {
  const ancienne = B.course.creer(c, { mode: 'chrono', rivaux: 0, tours: 3, graine: 1 });
  const ancienMontage = B.physique.installer(ancienne, decor), ancienFx = B.traces.creer(1, 1, ancienMontage.world);
  const ancienneSession = { type: 'vitrine', i: 0, course: ancienne, fx: ancienFx };
  const ph = ancienne.joueur.etat._physx, pose = { x: ph.x, y: ph.y, z: ph.z, cap: ph.cap, tangage: 0, roulis: 0 };
  B.traces.pas(ancienFx, ancienne, [pose], 0, 0, [{ type: 'roue', id: 0, roue: 0 }]);
  assert.equal(B.traces.compter(ancienFx).corps, 1, 'la vieille séance doit aussi rendre un vrai débris');
  const ordre = [], courses = [], montages = [], effets = [], sessions = [], erreur = new Error('panne injectée : ' + panne);
  const element = { dataset: {} };
  let contexte;
  const environnement = {
    // Seuls les branchements d'interface sans navigateur sont neutralisés. Circuit, modèles, effets et PhysX restent réels.
    ecran: 'titre', creerVisibiliteActeurs: () => ({ principal: null, indetermine: false, masque: 0, reflets: [], reflete: () => true, visible: () => true }),
    prepa: { enCours: false, interne: false }, restaurerReference() {}, session: ancienneSession,
    installer: () => ({ c, decor, saison: 'ete' }), rendu: {}, gpuModeste: false,
    reglages: { qualite: 'low', tours: 3, difficulte: 1 }, etatProfils: { decor: {} }, capacitesRendu: {},
    graineCourse: 3, CATALOGUE: catalogue,
    meteoPourConditions: () => B.chaussee.preparer({}, B.saisons.profil('ete', c.theme)),
    monterPneusDepart() {}, horlogePartagee: x => x, animauxDe: () => null,
    majPneusHUD() {}, HUD1: {}, HUD2: {}, jeu: element, hud2: element, $: () => element, tactile() {},
    conditions: { saison: 'ete', moment: 'jour', meteo: 'sec' },
    prechargerSeance(S) {
      assert.equal(contexte.session, S, 'la panne doit arriver après publication de la nouvelle séance');
      assert.equal(S.fx.monde, S.course.physique.world); assert.equal(X.status().worlds, 1);
      sessions.push(S); ordre.push('panne:prechauffage'); throw erreur;
    },
    B: { ...B, ombres: { carte() {}, ombresPossibles: () => false },
      course: { ...B.course, creer(...args) { const co = B.course.creer(...args); courses.push(co); return co; } },
      physique: { ...B.physique,
        installer(...args) {
          assert.equal(X.status().worlds, 0, 'le nouveau monde a été installé avant destruction de l’ancien');
          assert.equal(contexte.session, null, 'référence de séance détruite encore publiée');
          const p = B.physique.installer(...args); montages.push(p); ordre.push('monde:nouveau');
          assert.equal(p.voitures.length, 12); assert.ok(p.solids.ids.length > 1000); return p;
        },
        liberer(co) { ordre.push('liberer:' + (co === ancienne ? 'ancien' : 'nouveau')); return B.physique.liberer(co); }
      },
      traces: { ...B.traces,
        creer(...args) { const fx = B.traces.creer(...args); effets.push(fx); return fx; },
        liberer(fx) { ordre.push('effets:' + (fx === ancienFx ? 'anciens' : 'nouveaux')); return B.traces.liberer(fx); }
      },
      voiture: { ...B.voiture, modele(...args) {
        if (panne === 'modele') { ordre.push('panne:modele'); throw erreur; }
        return B.voiture.modele(...args);
      } }
    }
  };
  contexte = vm.createContext(environnement);
  try {
    assert.equal(X.status().worlds, 1);
    assert.throws(() => vm.runInContext(fonctions + '; lancer("course", 0, null, conditions);', contexte), e => e === erreur);
    assert.equal(contexte.session, null, 'séance incomplète encore exposée');
    assert.equal(X.status().worlds, 0, 'monde natif orphelin après erreur');
    assert.deepEqual(ordre.slice(0, 3), ['effets:anciens', 'liberer:ancien', 'monde:nouveau']);
    assert.equal(ancienFx.libere, true); assert.equal(ancienMontage.disposed, true);
    assert.equal(ancienMontage.world._bodies.size, 0);
    assert.equal(courses.length, 1); assert.equal(montages.length, 1); assert.equal(montages[0].disposed, true);
    assert.equal(montages[0].world._bodies.size, 0);
    for (const co of [ancienne, ...courses]) {
      assert.equal(co.physique, null); assert.ok(co.voitures.every(v => v.etat._physx === undefined), 'référence vers un corps détruit conservée');
    }
    if (panne === 'prechauffage') {
      assert.equal(sessions.length, 1); assert.equal(effets.length, 1); assert.equal(effets[0].libere, true);
      assert.equal(effets[0].monde, null); assert.ok(ordre.indexOf('effets:nouveaux') < ordre.indexOf('liberer:nouveau'));
    }
    rapports.push({ panne, reussi: true, ordre, mondesRestants: X.status().worlds });
  } finally {
    B.traces.liberer(ancienFx); for (const fx of effets) B.traces.liberer(fx);
    B.physique.liberer(ancienne); for (const co of courses) B.physique.liberer(co);
  }
});
test('PhysX : la perte du périphérique GPU libère les effets sans toucher aux voitures', () => {
  const co = B.course.creer(c, { mode: 'chrono', rivaux: 0, tours: 3, graine: 2 }); co.phase = 'course';
  const p = B.physique.installer(co, decor), ph = co.joueur.etat._physx, fx = B.traces.creer(1, 345, p.world);
  const S = { course: co, fx }, corps = [...p.world._bodies.keys()];
  const acteur = p.world._bodies.get(ph.id).actor;
  const poses = [{ x: ph.x, y: ph.y, z: ph.z, cap: ph.cap, tangage: 0, roulis: 0 }];
  const evRoue = [{ type: 'roue', id: 0, roue: 0 }];
  B.traces.pas(fx, co, poses, 0, 0, evRoue); assert.equal(B.traces.compter(fx).corps, 1);
  // Depuis la réécriture WebGPU, le jeu ne restaure plus le contexte en place : signalerPerteGPU
  // déclare la perte, affiche l'écran d'erreur et libère les effets ; le joueur relance (aa98404).
  const titres = [];
  const contexte = vm.createContext({ B, session: S, rendu: {}, contexteRenduPerdu: false, prepa: { enCours: false },
    abandonnerPreparation() {}, enCourse: () => false, basculerPause() {}, location: { reload() {} },
    document: { createElement: () => ({ addEventListener() {} }) }, $: () => ({ append() {} }),
    erreur: (titre) => titres.push(titre), libererVerre() {}, libererRenduSecondaire() {} });
  try {
    vm.runInContext(fonction('signalerPerteGPU') + '; signalerPerteGPU({ message: "device lost" });', contexte);
    assert.equal(contexte.contexteRenduPerdu, true, 'le jeu se déclare en perte de périphérique');
    assert.deepEqual(titres, ['Le périphérique graphique a été interrompu'], 'le joueur voit l’écran d’erreur');
    assert.equal(S.fx.libere, true, 'les effets sont libérés à la perte GPU');
    assert.equal(p.world._bodies.get(ph.id).actor, acteur, 'la voiture reste dans le monde à la perte GPU');
    assert.deepEqual([...p.world._bodies.keys()], corps, 'les corps de la séance ne changent pas');
    assert.equal(X.status().worlds, 1);
    rapports.push({ panne: 'perte GPU', reussi: true, mondeConserve: true, acteurConserve: true, effetsLiberes: true });
  } finally { if (!S.fx.libere) B.traces.liberer(S.fx); B.physique.liberer(co); }
});
test('PhysX : la chauffe possède son monde, préserve la séance réelle et libère aussi ses erreurs', () => {
  const co = B.course.creer(c, { mode: 'course', rivaux: 1, tours: 3, graine: 4242 });
  const p = B.physique.installer(co, decor), fx = B.traces.creer(co.voitures.length, 4242, p.world);
  const S = { course: co, fx, meteo: { pluie: 0, mouille: 0, fixe: false } }, precedente = B.meteo.actuel;
  B.meteo.actuel = S.meteo;
  function empreinteScene() {
    const h = createHash('sha256');
    for (const n of decor.nappes) for (const t of [n.sommets, n.indices]) h.update(Buffer.from(t.buffer, t.byteOffset, t.byteLength));
    for (const l of decor.lots) h.update(JSON.stringify(l));
    h.update(JSON.stringify(decor.obstacles)); return h.digest('hex');
  }
  const empreinteDecor = empreinteScene();
  function photographier() {
    return { etat: JSON.stringify(co, (k, v) => k === 'c' || k === 'physique' ? undefined : v), pas: p.pas, placements: p.placements,
      corps: co.voitures.map(v => {
        const id = v.etat._physx.id, pose = [...p.world.readPose(id)];
        const hit = p.world.raycast([pose[0], pose[1] + 3, pose[2]], [0, -1, 0], 6, { mask: 1, staticOnly: true });
        return { id, pose, vitesse: [...p.world.readVelocity(id)], rotation: [...p.world.readAngularVelocity(id)],
          appui: [hit.hit, hit.body, hit.faceIndex, hit.distance, hit.y] };
      }), acteurs: [...p.world._bodies.keys()], graineEffets: fx.graine[0], effets: { ...B.traces.compter(fx) } };
  }
  const avant = photographier(), courses = [], montages = [], effets = [], evenements = [];
  let panne = null, erreur = null;
  const contexte = vm.createContext({ performance, scene: { c, decor }, S,
    B: { ...B,
      course: { ...B.course,
        creer(...args) { const q = B.course.creer(...args); courses.push(q); return q; },
        pas(...args) { const ev = B.course.pas(...args); if (panne === 'pas') throw erreur; return ev; }
      },
      physique: { ...B.physique,
        installer(...args) { const m = B.physique.installer(...args); montages.push(m); return m; },
        liberer(q) { evenements.push('monde'); return B.physique.liberer(q); }
      },
      traces: { ...B.traces,
        creer(...args) { if (panne === 'creation-effets') throw erreur; const q = B.traces.creer(...args); effets.push(q); return q; },
        liberer(q) { evenements.push('effets'); return B.traces.liberer(q); }
      }
    }
  });
  const declarations = [source.match(/^  const DT = [^\n]+;/m)?.[0], source.match(/^  const GRAINE_JETABLE = [^\n]+;/m)?.[0],
    source.match(/^  const meteoPeutMouiller = [^\n]+;/m)?.[0], fonction('remplirPoses'), fonction('courseJetable')].join('\n');
  vm.runInContext(declarations, contexte);
  try {
    const J = vm.runInContext('courseJetable(S, .5)', contexte), temporaire = J.course.physique;
    assert.equal(X.status().worlds, 2); assert.notEqual(temporaire.world, p.world);
    assert.equal(J.effets.monde, temporaire.world); assert.equal(J.effets.partage, true);
    assert.deepEqual(temporaire.solids.statistiques, p.solids.statistiques, 'la chauffe ne monte pas tous les solides réels');
    const step = temporaire.world.step; let pas = 0;
    temporaire.world.step = function (...args) { pas++; return step.apply(this, args); };
    while (!J.avancer(5));
    assert.equal(J.rapport.pas, 60); assert.equal(pas, 60, 'le monde jetable est avancé une seconde fois par les effets');
    assert.ok(J.rapport.effets.corps > 0, 'débris natifs non chauffés');
    assert.deepEqual(photographier(), avant, 'la chauffe a modifié la course réelle');
    assert.equal(empreinteScene(), empreinteDecor, 'la chauffe a modifié le décor partagé');
    assert.equal(B.meteo.actuel, S.meteo); assert.deepEqual(S.meteo, { pluie: 0, mouille: 0, fixe: false });
    J.liberer(); J.liberer();
    assert.deepEqual(evenements, ['effets', 'monde']); assert.equal(X.status().worlds, 1);
    assert.equal(temporaire.disposed, true); assert.equal(temporaire.world._bodies.size, 0); assert.equal(J.effets.libere, true);
    assert.ok(J.course.voitures.every(v => v.etat._physx === undefined));
    const situations = ['normal'];
    for (panne of ['creation-effets', 'pas']) {
      erreur = new Error('panne de chauffe : ' + panne); evenements.length = 0;
      if (panne === 'creation-effets') assert.throws(() => vm.runInContext('courseJetable(S, .5)', contexte), e => e === erreur);
      else {
        const q = vm.runInContext('courseJetable(S, .5)', contexte);
        assert.throws(() => q.avancer(50), e => e === erreur);
        assert.equal(q.effets.libere, true); assert.deepEqual(evenements, ['effets', 'monde']);
      }
      assert.equal(X.status().worlds, 1, 'monde jetable orphelin sur erreur : ' + panne);
      assert.equal(montages.at(-1).disposed, true); assert.equal(montages.at(-1).world._bodies.size, 0);
      assert.ok(courses.at(-1).voitures.every(v => v.etat._physx === undefined));
      assert.equal(B.meteo.actuel, S.meteo); assert.deepEqual(photographier(), avant);
      situations.push(panne);
    }
    assert.equal(empreinteScene(), empreinteDecor);
    rapports.push({ panne: 'chauffe PhysX', reussi: true, situations, mondeIndependant: true, pas: 60, seanceIntacte: true, decorIntact: true, mondeReelRestant: 1 });
  } finally {
    for (const q of effets) B.traces.liberer(q); for (const q of courses) B.physique.liberer(q);
    B.traces.liberer(fx); B.physique.liberer(co); B.meteo.actuel = precedente;
  }
});
after(() => {
  assert.equal(X.status().worlds, 0);
  const bilan = { version: X.status().version, jeuSHA256: createHash('sha256').update(source).digest('hex'), resultats: rapports };
  if (process.env.BITUME_RAPPORT_CYCLES_PHYSX) writeFileSync(process.env.BITUME_RAPPORT_CYCLES_PHYSX, JSON.stringify(bilan, null, 2) + '\n');
  console.log(JSON.stringify(bilan));
});
