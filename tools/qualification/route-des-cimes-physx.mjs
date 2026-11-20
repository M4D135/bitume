// Vrai PhysX p15, parcours complet en commandes IA ; aucune pose ou vitesse imposée après installation.
// RIVAUX=0|11, METEO=sec|pluie|neige, DUREE=420, RAPPORT=... ; BITUME_CIMES_DECOR permet de relire
// un décor candidat d'intégration dont le chemin et l'empreinte sont enregistrés dans le reçu.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chargerPhysX } from '../../verifications/helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url), racine = fileURLToPath(new URL('../../', import.meta.url));
for (const f of ['circuit', 'couverts', 'route-des-cimes', 'conduite', 'degats', 'contacts', 'obstacles', 'botanique', 'ecologie', 'saisons',
  'vegetation', 'bords', 'carene', 'meteo', 'strategie-stands', 'course', 'solides-physx', 'physique']) require(racine + 'src/' + f + '.js');
const decorPath = process.env.BITUME_CIMES_DECOR ? resolve(process.env.BITUME_CIMES_DECOR) : racine + 'src/decor.js';
require(decorPath);
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX(), dt = 1 / 120;
const rivaux = Number(process.env.RIVAUX || 0), duree = Number(process.env.DUREE || 420), meteo = process.env.METEO || 'sec';
assert.ok(Number.isInteger(rivaux) && rivaux >= 0 && rivaux <= 11); assert.ok(duree > 0 && Number.isFinite(duree));
assert.ok(['sec', 'pluie', 'neige'].includes(meteo));
const sortie = resolve(process.env.RAPPORT || '/tmp/bitume-route-des-cimes-physx.json');
const fichiers = ['src/circuit.js', 'src/couverts.js', 'src/route-des-cimes.js', 'src/route-des-cimes-decor.js', 'src/conduite.js', 'src/course.js', 'src/physique.js',
  'src/solides-physx.js', 'src/bords.js', 'src/chaussee.js', 'src/ferro/physx.js', 'src/ferro/physx-runtime.js',
  'tools/qualification/route-des-cimes-physx.mjs'];
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const rapport = { schema: 2, physique: 'p15', backend: X.status(), dt, rivaux, meteo, dureeMax: duree,
  sourceHashes: Object.fromEntries(fichiers.map(p => [p, sha(racine + p)])),
  decor: { source: process.env.BITUME_CIMES_DECOR ? basename(decorPath) : 'src/decor.js', candidatExterne: !!process.env.BITUME_CIMES_DECOR, sha256: sha(decorPath) },
  geometrie: null, progres: [], evenements: [], corrections: { setPose: 0, setVelocity: 0, setAngularVelocity: 0 }, reussi: false };
let co;
try {
  const debut = performance.now(), c = B.routeDesCimes.creer();
  B.bords.limites(c, B.bords.planifier(c));
  const saison = meteo === 'neige' ? 'hiver' : 'ete';
  const scene = B.decor.construire(c, { qualite: 'high', vegetation: false, saison });
  c.obstacles = B.obstacles.creer(scene.obstacles);
  B.meteo.actuel = B.chaussee.preparer({ pluie: meteo === 'pluie' ? 1 : 0, mouille: meteo === 'pluie' ? 1 : 0,
    neigeSol: meteo === 'neige' ? .8 : 0, precipitationsNeige: meteo === 'neige', fixe: true }, B.saisons.profil(saison, c.theme));
  co = B.course.creer(c, { mode: rivaux ? 'course' : 'chrono', rivaux, tours: 3, graine: 42, placeJoueur: 12 });
  co.phase = 'course'; co.joueur.ia.hab = .9;
  const pneus = B.conduite.pneusConseilles(B.chaussee.lire(c, 0));
  for (const v of co.voitures) { Object.assign(v.etat, B.pneus.creerEtat(pneus, { seance: 42, voiture: v.id })); v.livree.pneus = pneus; }
  const p = B.physique.installer(co, scene), debutSim = performance.now(), placements = p.placements;
  rapport.constructionMs = debutSim - debut; rapport.geometrie = c.mesures; rapport.provenance = c.provenance;
  rapport.statiques = p.solids.statistiques;
  rapport.ouvrages = { declares: c.couverts.map(t => ({ ...t })), ponts: c.ponts.map(t => ({ ...t })),
    solsTunnel: [...p.solids.acteurs.values()].filter(a => a.genre === 'sol-tunnel').length,
    galerieConstruite: [...p.solids.acteurs.values()].some(a => a.genre === 'sol-galerie'), pontConstruit: !!scene.cimes?.pont,
    rayonsOuvrages: [] };
  assert.ok(rapport.ouvrages.galerieConstruite, 'galerie réellement construite');
  assert.ok(rapport.ouvrages.pontConstruit, 'pont réellement construit');
  for (const t of c.couverts) {
    const q = B.circuit.echantillon(c, (t.debut + t.fin) / 2), origine = [q.x, q.y + 1, q.z];
    const toit = p.world.raycast(origine, [0, 1, 0], t.hauteur + 2, { mask: 2, staticOnly: true });
    const sol = p.world.raycast(origine, [0, -1, 0], 2, { mask: 1, staticOnly: true });
    assert.ok(toit.hit && sol.hit, 'sol et toit réels : ' + t.nom);
    const genreToit = p.solids.acteurs.get(toit.body)?.genre;
    assert.equal(genreToit, t.type === 'galerie' ? 'voute-galerie' : 'voute-tunnel');
    rapport.ouvrages.rayonsOuvrages.push({ nom: t.nom, toit: genreToit, sol: p.solids.acteurs.get(sol.body)?.genre });
  }
  const pont = c.ponts[0], q = B.circuit.echantillon(c, (pont.debut + pont.fin) / 2), r = [-Math.sin(q.cap), 0, Math.cos(q.cap)];
  const passage = p.world.raycast([q.x - r[0] * 20, q.y - 20, q.z - r[2] * 20], r, 40, { mask: 1 | 2, staticOnly: true });
  assert.equal(passage.hit, false, 'le vide sous l’arche doit être réellement ouvert');
  rapport.ouvrages.archeOuverte = true;
  for (const nom of Object.keys(rapport.corrections)) {
    const original = p.world[nom];
    p.world[nom] = function (...args) { rapport.corrections[nom]++; return original.apply(this, args); };
  }
  const mesures = co.voitures.map(v => ({ id: v.id, distanceDepart: v.etat.distance, maxAbsD: 0, minCaisseSol: Infinity,
    maxCaisseSol: -Infinity, sansSol: 0, sousSol: 0, sansAppui: 0, maxSansAppuiS: 0, dernierSansAppuiS: 0,
    couvertsParcourus: new Set(), pontsParcourus: new Set(), sondesSol: 0 }));
  const cmd = {}, ev = [], origine = [0, 0, 0], hit = {}; let pas = 0;
  for (; pas < duree / dt; pas++) {
    B.course.pas(co, B.course.commandesIA(co, co.joueur, cmd), dt, ev);
    for (const x of ev) if (['choc','accident','replacement','contact'].includes(x.type)) {
      const v = co.voitures[x.id ?? x.a];
      rapport.evenements.push({ t: co.horloge, ...x, s: v?.etat.s, d: v?.etat.d, v: v?.etat.v });
    }
    for (let k = 0; k < co.voitures.length; k++) {
      const v = co.voitures[k], e = v.etat, ph = e._physx, m = mesures[k];
      assert.ok([ph.x, ph.y, ph.z, e.v, e.d, e.s].every(Number.isFinite), 'état natif non fini');
      assert.equal(e.repositionnements, 0, 'replacement voiture ' + v.id + ' à s=' + e.s);
      m.maxAbsD = Math.max(m.maxAbsD, Math.abs(e.d));
      if (!ph.groundCount) { m.sansAppui++; m.dernierSansAppuiS += dt; m.maxSansAppuiS = Math.max(m.maxSansAppuiS, m.dernierSansAppuiS); }
      else m.dernierSansAppuiS = 0;
      const couvert = B.circuit.dansCouvert(c, e.s); if (couvert) m.couvertsParcourus.add(couvert.nom);
      for (const pont of c.ponts) if (e.s > pont.debut && e.s < pont.fin) m.pontsParcourus.add(pont.nom);
      if (pas % 12 === 0) {
        // Origine sous la voûte : la sonde rencontre les triangles de roulement et non le toit d'un tunnel.
        origine[0] = ph.x; origine[1] = ph.y + 1; origine[2] = ph.z;
        p.world.raycast(origine, [0, -1, 0], 4, { mask: 1, staticOnly: true }, hit); m.sondesSol++;
        if (!hit.hit) m.sansSol++;
        else { const gap = ph.y - hit.y; m.minCaisseSol = Math.min(m.minCaisseSol, gap); m.maxCaisseSol = Math.max(m.maxCaisseSol, gap); if (gap < -.15) m.sousSol++; }
      }
    }
    if (pas % 4800 === 0) {
      const q = { t: co.horloge, voitures: co.voitures.map(v => ({ id: v.id, s: v.etat.s, d: v.etat.d, v: v.etat.v, appuis: v.etat._physx.groundCount, replacements: v.etat.repositionnements })) };
      rapport.progres.push(q); console.log(JSON.stringify(q));
    }
    if (co.voitures.every((v, i) => v.etat.distance - mesures[i].distanceDepart > c.longueur + 500)) break;
  }
  rapport.pas = pas + 1; rapport.dureeSimulee = co.horloge; rapport.executionMs = performance.now() - debutSim;
  rapport.placementsSupplementaires = p.placements - placements;
  rapport.voitures = co.voitures.map((v, i) => ({ ...mesures[i], distance: v.etat.distance - mesures[i].distanceDepart,
    couvertsParcourus: [...mesures[i].couvertsParcourus], pontsParcourus: [...mesures[i].pontsParcourus],
    replacements: v.etat.repositionnements, tours: v.tours, appuisFin: v.etat._physx.groundCount }));
  assert.equal(rapport.placementsSupplementaires, 0, 'placement supplémentaire pendant le roulage');
  assert.equal(Object.values(rapport.corrections).reduce((a, x) => a + x, 0), 0, 'pose ou vitesse imposée');
  for (const v of rapport.voitures) {
    assert.ok(v.distance > c.longueur + 500, 'tour complet absent : voiture ' + v.id);
    assert.equal(v.replacements, 0, 'replacement : voiture ' + v.id);
    assert.equal(v.sousSol, 0, 'traversée du sol visible : voiture ' + v.id);
    assert.equal(v.sansSol, 0, 'aucun sol visible sous la voiture ' + v.id);
    assert.equal(v.couvertsParcourus.length, 3); assert.equal(v.pontsParcourus.length, 1);
  }
  rapport.reussi = true;
} catch (e) { rapport.erreur = String(e); throw e; }
finally {
  if (co) B.physique.liberer(co); X.dispose(); mkdirSync(dirname(sortie), { recursive: true });
  writeFileSync(sortie, JSON.stringify(rapport, null, 2) + '\n');
  console.log('Route-des-Cimes', JSON.stringify({ reussi: rapport.reussi, voitures: rapport.voitures?.length,
    duree: rapport.dureeSimulee, corrections: rapport.corrections, erreur: rapport.erreur?.split('\n')[0] }));
}
