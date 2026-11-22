import { definitionHistorique } from './catalogue-historique.mjs';
// Référentiels natifs p14/p15 : chaque replay s'exécute dans un processus neuf et charge le vrai WASM embarqué.
// Les corps, masses, suspensions et triangles viennent exclusivement des modules de production.
import { rejouerPhysiqueDeReference } from './replay-physx-p16.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename } from 'node:path';
import { chargerPhysX } from './physx-runtime.mjs';
import { comparerDeterminismePhysX as comparer, validerScenesPhysX } from './reference-physx.mjs';

const require = createRequire(import.meta.url), DT = 1 / 120, PAS_SECONDE = 120;
const MARQUEUR = '@@BITUME_DETERMINISME_PHYSX@@';
const MODULES = ['circuit', 'route-des-cimes', 'conduite', 'degats', 'contacts', 'obstacles', 'botanique', 'ecologie',
  'saisons', 'vegetation', 'bords', 'carene', 'decor', 'meteo', 'strategie-stands', 'course',
  'solides-physx', 'physique'];
const CAS = [
  { nom: 'val-brule-sec-12', circuit: 'val-brule', graine: 1401, saison: 'ete', pneus: 'slicks', secondes: 18,
    meteo: { pluie: 0, mouille: 0, neigeSol: 0, fixe: true } },
  { nom: 'port-sable-pluie-12', circuit: 'port-sable', graine: 1402, saison: 'automne', pneus: 'pluie', secondes: 18,
    meteo: { pluie: 1, mouille: 1, neigeSol: 0, fixe: true } },
  { nom: 'baikal-neige-12', circuit: 'baikal', graine: 1403, saison: 'hiver', pneus: 'neige', secondes: 18,
    meteo: { pluie: .8, mouille: 0, neigeSol: .8, precipitationsNeige: true, fixe: true } }
];
function sources() {
  // decor charge ces deux modules en CommonJS ; ils font partie des entrées physiques même sans import direct ici.
  return Object.fromEntries([...MODULES.map(n => n + '.js'), 'baikal.js', 'batiments.js', 'jeu.js', 'moteur/renderer.js', 'ferro/physx.js', 'ferro/physx-runtime.js']
    .map(n => [n, createHash('sha256').update(readFileSync(new URL('../../src/' + n, import.meta.url))).digest('hex')]));
}
function identite(p, id) {
  if (id === null || id === undefined || id === 0) return null;
  const voiture = p.byId.get(id);
  if (voiture) return { voiture: voiture.v.id };
  const solide = p.solids.acteurs.get(id);
  assert.ok(solide, 'acteur natif sans identité logique');
  return { source: solide.source, index: solide.index, genre: solide.genre, groupe: solide.groupe };
}
function contact(p, q) {
  return { a: identite(p, q.a), b: identite(p, q.b), x: q.x, y: q.y, z: q.z,
    nx: q.nx, ny: q.ny, nz: q.nz, ix: q.ix, iy: q.iy, iz: q.iz, separation: q.separation };
}
function evenement(p, e) {
  const copie = structuredClone(e);
  if (Object.hasOwn(copie, 'obstacleId')) copie.obstacleId = identite(p, copie.obstacleId);
  return copie;
}
function geometrieDecor(decor) {
  // Ni couleurs ni grain du shader dans cet oracle physique : uniquement les entrées des solides.
  const nappes = decor.nappes.map(n => {
    const positions = [], indices = [], surfaces = [];
    for (let i = 0; i < n.sommets.length; i += 13) positions.push(n.sommets[i], n.sommets[i + 1], n.sommets[i + 2]);
    for (let i = 0; i < n.indices.length; i += 3) {
      const triangle = [n.indices[i], n.indices[i + 1], n.indices[i + 2]];
      if (triangle.every(j => n.sommets[j * 13 + 9] === 12)) continue;
      indices.push(...triangle);
      surfaces.push(n.surfacesPhysX ? n.surfacesPhysX[i / 3] : n.surfaceType === 'accotement' ? 1 : 3);
    }
    return { positions, indices, surfaces };
  });
  const vus = new Set(), primitives = [];
  for (const lot of decor.lotsHerbier || decor.lots || []) for (const o of lot.objets || []) {
    if (vus.has(o)) continue; vus.add(o);
    if (o.collision || o.solidePhysX) primitives.push({ shape: o.shape, p: o.p, s: o.s, r: o.r,
      collision: o.collision, solidePhysX: o.solidePhysX });
  }
  return { nappes, primitives, obstacles: decor.obstacles };
}
function natif(p) {
  return {
    backend: p.backend, version: p.version, pas: p.pas, temps: p.temps, placements: p.placements,
    accumulateur: p.world._acc,
    collisions: [...p.collisions].map(([cle, temps]) => ({
      acteurs: cle.split(':').map(Number).map(id => identite(p, id)), temps
    })),
    voitures: p.voitures.map(ph => ({
      id: ph.v.id, pose: p.world.readPose(ph.id), vitesse: p.world.readVelocity(ph.id),
      rotation: p.world.readAngularVelocity(ph.id), masse: ph.mass, inertie: ph.inertia, centreMasse: ph.cgLocal,
      distant: ph.distant, avantVitesse: ph.beforeVelocity, forces: ph.forces, offsets: ph.offsets,
      retenue: ph.retenue, controle: ph.controle, enAir: ph.airborne, appuis: ph.groundCount, surface: ph.surface,
      roues: ph.contacts.map(w => ({
        i: w.i, ancrage: w.anchor, point: w.point, normale: w.normal, tangente: w.tangent,
        droite: w.right, vitesse: w.velocity, pose: w.shapePose, charge: w.load, capacite: w.capacity,
        fx: w.fx, fy: w.fy, surface: w.surface, distance: w.distance, raideur: w.k,
        touche: !!w.hit.hit, sol: w.hit.hit ? identite(p, w.hit.body) : null,
        face: w.hit.hit ? w.hit.faceIndex : null
      }))
    }))
  };
}
function verifierSensibilite(empreinte) {
  const f = new Float64Array([1]), u = new BigUint64Array(f.buffer);
  const base = { pose: [1, 2, 3, 0, 0, 0, 1], vitesse: [1, 2, 3],
    etat: { usure: 1 }, evenements: [{ type: 'contact', force: 1 }] };
  const h = empreinte(base); u[0]++;
  for (const changer of [x => { x.pose[0] = f[0]; }, x => { x.vitesse[0] = f[0]; },
    x => { x.etat.usure = f[0]; }, x => { x.evenements[0].force = f[0]; }]) {
    const x = structuredClone(base); changer(x); assert.notEqual(empreinte(x), h, 'un ulp a disparu du hachage');
  }
  assert.notEqual(empreinte(-0), empreinte(0), 'signe du zéro perdu');
}
async function rejouer(Ecrivain, etatCourse, physique) {
  assert.ok(!process.env.BITUME_PHYSX_ADAPTER, 'le référentiel exige le moteur installé, sans adaptateur de développement');
  const empreintesSources = sources();
  for (const nom of MODULES) require('../../src/' + nom + '.js');
  const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX();
  assert.equal(X.isReady(), true); assert.equal(X.status().version, '5.12.0');
  const empreinte = (...valeurs) => { const w = new Ecrivain(); for (const v of valeurs) w.valeur(v); return w.empreinte(); };
  verifierSensibilite(empreinte);
  const source = readFileSync(new URL('../../src/jeu.js', import.meta.url), 'utf8');
  assert.equal(source.match(/\bPHYSIQUE\s*=\s*['"](p\d+)['"]/)?.[1], physique,
    'la physique du jeu a changé avant le replay natif');
  const catalogue = new Function(source.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0] + '; return CATALOGUE;')();
  const cas = {};
  for (const options of CAS) {
    const k = definitionHistorique(catalogue, options.circuit);
    const c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom, partition: k.partition });
    B.bords.limites(c, B.bords.planifier(c));
    const decor = B.decor.construire(c, { qualite: 'low', matieres: true, vegetation: false, saison: options.saison });
    c.obstacles = B.obstacles.creer(decor.obstacles);
    B.meteo.actuel = B.chaussee.preparer(options.meteo, B.saisons.profil(options.saison, c.theme));
    const co = B.course.creer(c, { mode: 'course', rivaux: 11, tours: 3, graine: options.graine, difficulte: 1, placeJoueur: 8 });
    for (const v of co.voitures) v.etat.pneus = v.etat.pneusProchainArret = v.livree.pneus = options.pneus;
    const p = B.physique.installer(co, decor);
    try {
      assert.equal(p.backend, 'PhysX'); assert.equal(p.voitures.length, 12);
      assert.ok(p.solids.ids.length > 100, 'solides réels absents');
      assert.ok(p.solids.statistiques.trianglesSol > 10000, 'triangles réels du sol absents');
      for (const ph of p.voitures) {
        const corps = p.world._bodies.get(ph.id);
        assert.equal(corps.type, 'dynamic'); assert.equal(corps.actor.getMass(), 600);
      }
      // Le décor complet et son ordre d'installation sont identifiés sans poignée PhysX.
      const scene = { statistiques: { ...p.solids.statistiques },
        empreinte: empreinte(geometrieDecor(decor),
          [...p.solids.acteurs.values()].map(a => ({ ...a }))) };
      const initial = p.voitures.map(ph => p.world.readPose(ph.id).slice(0, 3));
      const compte = {}, empreintes = [], couches = [], ev = [];
      let evenements = [], contacts = [], totalContacts = 0, vitesseMax = 0;
      for (let n = 0; n < options.secondes * PAS_SECONDE; n++) {
        B.course.pas(co, B.course.commandesIA(co, co.joueur), DT, ev);
        const natifs = p.world.contacts;
        assert.equal(natifs.enabled, true); assert.equal(natifs.error, null); assert.equal(natifs.dropped, 0);
        for (const e of ev) { evenements.push({ pas: n + 1, ...evenement(p, e) }); compte[e.type] = (compte[e.type] || 0) + 1; }
        if (natifs.count) {
          contacts.push({ pas: n + 1, points: natifs.points.slice(0, natifs.count).map(q => contact(p, q)) });
          totalContacts += natifs.count;
        }
        for (const v of co.voitures) vitesseMax = Math.max(vitesseMax, Math.abs(v.etat.v));
        if ((n + 1) % PAS_SECONDE === 0) {
          const etat = etatCourse(co), physique = natif(p);
          couches.push({ etat: empreinte(etat), natif: empreinte(physique), evenements: empreinte(evenements), contacts: empreinte(contacts) });
          empreintes.push(empreinte(etat, physique, evenements, contacts));
          evenements = []; contacts = [];
        }
      }
      assert.equal(p.pas, options.secondes * PAS_SECONDE, 'pas PhysX manquant');
      assert.equal(co.phase, 'course', 'course jamais partie'); assert.ok(vitesseMax > 10, 'course immobile');
      assert.equal(compte.vert, 1, 'départ réel absent'); assert.ok(compte.rapport > 0, 'aucun passage de rapport');
      assert.ok(totalContacts > 0, 'aucun contact natif observé');
      const deplacements = p.voitures.map((ph, i) => Math.hypot(...p.world.readPose(ph.id).slice(0, 3).map((v, j) => v - initial[i][j])));
      assert.ok(deplacements.every(d => d > 20), 'les douze voitures doivent réellement rouler');
      cas[options.nom] = { secondes: options.secondes, configuration: options, scene,
        resume: { phase: co.phase, horloge: co.horloge, temps: co.temps, voitures: co.voitures.length,
          pasPhysX: p.pas, vitesseMax, deplacements, contactsNatifs: totalContacts,
          evenements: Object.fromEntries(Object.entries(compte).sort()),
          replacements: co.voitures.map(v => v.etat.repositionnements || 0),
          pneus: co.voitures.map(v => v.etat.pneus) }, empreintes, couches };
    } finally { B.physique.liberer(co); B.meteo.actuel = null; }
    assert.equal(X.status().worlds, 0, 'monde PhysX non libéré');
  }
  assert.deepEqual(sources(), empreintesSources, 'sources modifiées pendant le replay');
  return { physique, node: process.version, moteur: { backend: 'PhysX', version: X.status().version },
    sources: empreintesSources, cas };
}
function archivesAnterieures(physique) {
  const historique = readFileSync(new URL('../fixtures/determinisme-p14.json', import.meta.url));
  const scenes = readFileSync(new URL('../fixtures/determinisme-scenes-0260.json', import.meta.url));
  // Ce validateur reste strictement p14 et vérifie l'empreinte historique déjà publiée.
  validerScenesPhysX(JSON.parse(historique), JSON.parse(scenes), historique);
  const archives = {
    'determinisme-p14.json': createHash('sha256').update(historique).digest('hex'),
    'determinisme-scenes-0260.json': createHash('sha256').update(scenes).digest('hex')
  };
  if (physique === 'p16' || physique === 'p17') {
    const p15 = readFileSync(new URL('../fixtures/determinisme-p15.json', import.meta.url));
    archives['determinisme-p15.json'] = createHash('sha256').update(p15).digest('hex');
    assert.equal(archives['determinisme-p15.json'], '7f65117fb5d8fc531fa9bac69e0bcd6655847ae2ea68091cc721b1ea8bb4a4b4');
  }
  if (physique === 'p17') {
    const p16=readFileSync(new URL('../fixtures/determinisme-p16.json',import.meta.url));
    archives['determinisme-p16.json']=createHash('sha256').update(p16).digest('hex');
    assert.equal(archives['determinisme-p16.json'],'aadb4676e9e714f3ac2a451a76e17debc026e5483e2943802faba7a41c79af7c');
  }
  return archives;
}
export async function controlerDeterminismePhysX({ Ecrivain, etatCourse, fixture, ecrire, fichier, physique }) {
  assert.ok(['p14', 'p15', 'p16', 'p17'].includes(physique), 'physique native non reconnue ; aucun repli historique');
  assert.equal(basename(fixture), 'determinisme-' + physique + '.json', 'fixture incompatible avec la physique demandée');
  if (process.argv.includes('--physx-worker')) {
    console.log(MARQUEUR + JSON.stringify(await rejouer(Ecrivain, etatCourse, physique))); return;
  }
  if (ecrire && existsSync(fixture)) throw new Error('La fixture ' + physique + ' existe déjà ; aucune réécriture implicite du référentiel');
  const archives = archivesAnterieures(physique);
  const lancer = () => {
    const sortie = execFileSync(process.execPath, [fichier, '--physx-worker'], { encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024, timeout: 300000 });
    const i = sortie.lastIndexOf(MARQUEUR); assert.ok(i >= 0, 'replay sans résultat');
    const resultat = JSON.parse(sortie.slice(i + MARQUEUR.length).trim());
    assert.equal(resultat.physique, physique, 'le worker a exécuté une autre physique');
    assert.deepEqual(resultat.moteur, { backend: 'PhysX', version: '5.12.0' }, 'le replay doit employer le vrai WASM PhysX');
    return resultat;
  };
  const a = lancer();
  if (physique === 'p16') {
    const temoin = rejouerPhysiqueDeReference();
    comparer(temoin, a, 'Témoin indépendant c38a28c sur '+process.platform+'/'+process.arch);
    console.log('ok  c38a28c et conduite p16 : 54 empreintes identiques sur '+process.platform+'/'+process.arch);
  }
  if (ecrire) {
    console.log('ok  premier replay PhysX indépendant : 3 courses, 54 secondes, 12 voitures chacune');
    const b = lancer(); comparer(a, b, 'Deux processus indépendants');
    assert.deepEqual(a.sources, b.sources, 'sources différentes entre les deux replays');
    assert.equal(a.node, b.node);
    const reference = { format: 'bitume-determinisme-physx-1', ...a,
      creation: { processusIndependants: 2, empreintesIdentiques: 54, relectureApresEcriture: true },
      ...(physique === 'p16' ? {temoin: 'c38a28c34921447e9025b55457587ac92476c795', plateforme: process.platform, architecture: process.arch, v8: process.versions.v8} : {}),
      archivesConservees: archives,
      explication: 'WASM PhysX réel, 120 Hz, décor et statiques de production. SHA-256 chaque seconde : états de course, poses/quaternions, vitesses linéaires et angulaires natives, suspensions, événements et contacts ordonnés. Float64LE sans arrondi ; aucun pointeur ou identifiant natif. Scène et simulation complètes ; archives des physiques précédentes conservées séparément.' };
    assert.deepEqual(archivesAnterieures(physique), archives, 'les archives p14 ont changé pendant la création');
    writeFileSync(fixture, JSON.stringify(reference, null, 2) + '\n', { flag: 'wx' });
    const relue = JSON.parse(readFileSync(fixture, 'utf8'));
    assert.deepEqual(relue, reference); comparer(relue, b, 'Relecture de la fixture écrite');
    console.log('ok  deux replays PhysX indépendants identiques ; nouvelle fixture ' + physique + ' écrite puis relue');
  }
  const contenuHistorique = readFileSync(fixture), reference = JSON.parse(contenuHistorique);
  assert.equal(reference.format, 'bitume-determinisme-physx-1'); assert.equal(reference.physique, physique);
  // L'architecture et le lac changent les solides de scène. Leurs nouvelles empreintes sont séparées :
  // les 54 états/contacts natifs, événements, configurations et bilans restent ceux de la fixture p14 intacte.
  const scenes = physique === 'p14' ? validerScenesPhysX(reference,
    JSON.parse(readFileSync(new URL('../fixtures/determinisme-scenes-0260.json', import.meta.url), 'utf8')), contenuHistorique) : null;
  if (physique !== 'p14') assert.deepEqual(reference.archivesConservees, archives, 'provenance des archives p14 différente');
  const machineOrigine = reference.plateforme === process.platform && reference.architecture === process.arch && reference.v8 === process.versions.v8;
  if (physique !== 'p16' || machineOrigine) comparer(reference, a, 'Référentiel ' + physique, scenes);
  assert.deepEqual(archivesAnterieures(physique), archives, 'les archives p14 ont changé pendant la vérification');
  for (const [nom, r] of Object.entries(a.cas)) console.log(`ok  ${nom} : ${r.empreintes.length} empreintes exactes, 12 corps dynamiques, ${r.scene.statistiques.trianglesSol} triangles de sol`);
  console.log(physique === 'p14'
    ? 'ok  scènes 0.2.60 : géométrie et statistiques exactes pour les trois cas ; provenance Baïkal/bâtiments incluse'
    : 'ok  référence native intégrale : scène, configurations, états, contacts, événements et bilans comparés sans substitution');
  console.log('ok  sensibilité : un ulp sur pose, vitesse, usure ou événement change le hachage ; −0 distinct de +0');
  console.log('ok  déterminisme ' + physique + ' : 3 cas PhysX réels, 54 empreintes, aucune fixture historique modifiée');
}
