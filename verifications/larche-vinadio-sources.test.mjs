// Vérifications L0/L1 Col de Larche -> Vinadio : reproductibilité hors ligne, intégrité SHA-256,
// confinement des chemins, topologie ouverte SS21 sans fermeture artificielle et séparation terrain/chaussée.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'docs/references/larche-vinadio-2026');
const script = path.join(root, 'tools/preparer-larche-vinadio.py');
const outputs = ['manifest.json', 'inconnus.json', 'trace-l1.json', 'plan-et-profil.svg'];

const readJson = (d, n) => JSON.parse(readFileSync(path.join(d, n), 'utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');
const run = (d, ...args) => spawnSync('python3', [script, '--directory', d, ...args], { encoding: 'utf8', timeout: 15000 });
const ok = r => assert.equal(r.status, 0, r.stderr || r.stdout);
const bad = r => assert.notEqual(r.status, 0, 'exécution acceptée à tort');

function fixture(fn) {
  const d = mkdtempSync(path.join(os.tmpdir(), 'larche-l0-'));
  try { cpSync(folder, d, { recursive: true }); fn(d); } finally { rmSync(d, { recursive: true, force: true }); }
}

function snapshot(d) {
  return readdirSync(d, { recursive: true }).sort()
    .filter(n => statSync(path.join(d, n)).isFile())
    .map(n => { const p = path.join(d, n); return [n, sha(readFileSync(p)), statSync(p).mtimeMs]; });
}

test('L0/L1 : chaîne SS21 unique Col de Larche -> Vinadio, 1:1 sans remise à l’échelle, terrain séparé des ouvrages', () => fixture(d => {
  ok(run(d));
  const manifest = readJson(d, 'manifest.json');
  const inconnus = readJson(d, 'inconnus.json');
  const trace = readJson(d, 'trace-l1.json');

  assert.equal(manifest.pretPourRuntime, false);
  assert.equal(manifest.topologie, 'ouvert');
  assert.equal(manifest.identifiantReserve, 'larche');
  assert.equal(manifest.departBarcelonnetteExclu, true);
  assert.equal(manifest.projection.metrique, 'EPSG:32632 (WGS84 / UTM zone 32N)');
  assert.equal(manifest.sourcesFigees.length, 5);
  assert.equal(manifest.bandesWcsDtm5Brutes.length, 10);
  assert.equal(inconnus.pretPourRuntime, false);
  assert(inconnus.mesuresAbsentesOuIncertaines.some(x => x.id === 'largeur_chaussee'));
  assert(inconnus.mesuresAbsentesOuIncertaines.some(x => x.id === 'altitude_tunnels_et_paravalanches'));

  // Longueur réelle proche de 32,2 km sans aucune remise à l'échelle ; zone de décélération après Vinadio.
  const r = trace.resume;
  assert.equal(trace.pretPourRuntime, false);
  assert.equal(trace.topologie, 'ouvert');
  assert.equal(r.remiseAEchelleAppliquee, false);
  assert(r.longueurPlanCourseM > 32000 && r.longueurPlanCourseM < 32600, `longueur plan ${r.longueurPlanCourseM}`);
  assert(r.longueur3dIndicativeCourseM > r.longueurPlanCourseM, 'longueur 3D > longueur plan');
  assert(r.longueurPlanAvecDecelerationM - r.longueurPlanCourseM > 400, 'zone de décélération > 400 m après Vinadio');
  assert(r.altitudeDepartDtm5M > 1985 && r.altitudeDepartDtm5M < 2005, 'sommet proche de 1993 m');
  assert(r.altitudeArriveeDtm5M > 880 && r.altitudeArriveeDtm5M < 920, 'Vinadio proche de 890 m');
  assert(r.deniveleNetM < -1050 && r.deniveleNetM > -1150, 'dénivelé net cohérent');
  assert.equal(r.nbTunnelsEtParavalanches, 6);
  assert(r.nbPonts >= 15);
  assert(r.nbEpinglesDetectees >= 15);

  // Contrôle inter-datum frontière IGN RGE ALTI vs Regione Piemonte DTM 5 m.
  assert.equal(r.comparaisonFrontiereIgnPiemonte.nbPoints, 25);
  assert(Math.abs(r.comparaisonFrontiereIgnPiemonte.ecartMoyenM) < 0.25);

  // Parcours ouvert : départ != arrivée, abscisse strictement croissante, aucun élargissement/dévers inventé.
  const pts = trace.points;
  assert.equal(pts[0].osmNodeId, 928715494);
  assert.equal(pts[0].sPlanM, 0);
  assert(Math.hypot(pts[pts.length - 1].localX - pts[0].localX, pts[pts.length - 1].localZ - pts[0].localZ) > 20000);
  for (let i = 1; i < pts.length; i++) assert(pts[i].sPlanM > pts[i - 1].sPlanM, 'abscisse strictement croissante');
  assert(pts.every(p => p.largeurGM === null && p.largeurDM === null && p.deversRad === null));

  // Séparation stricte terrain / chaussée : aucun point tunnel ou pont n'est donné comme altitude chaussée mesurée.
  const ouvragePts = pts.filter(p => p.tunnelTag || p.pontTag);
  assert(ouvragePts.length > 30);
  assert(ouvragePts.every(p => p.yChausseeM === null && p.statutAltitudeChaussee.startsWith('inconnue_')));
  // Le grand tunnel de 820 m montre bien un versant > 60 m au-dessus de ses portails dans le MNT brut.
  const grandTunnel = trace.ouvrages.find(o => o.longueurPlanM > 700);
  assert(grandTunnel && grandTunnel.zMaxTerrainSurOuvrageM - grandTunnel.zEntreeDtm5M > 60);

  // Repères attendus dans le bon ordre de la descente.
  const noms = trace.reperes.map(x => x.nom);
  assert.deepEqual(noms, ['Col de Larche / Colle della Maddalena', 'Argentera', 'Bersezio', 'Pontebernardo', 'Pietraporzio', 'Sambuco', 'Pianche', 'Vinadio']);
  for (let i = 1; i < trace.reperes.length; i++) assert(trace.reperes[i].sPlanM > trace.reperes[i - 1].sPlanM);
}));

test('--check vérifie les 4 sorties sans écrire et échoue sur toute dérive', () => fixture(d => {
  ok(run(d));
  let before = snapshot(d);
  ok(run(d, '--check'));
  assert.deepEqual(snapshot(d), before);

  writeFileSync(path.join(d, 'inconnus.json'), '{}\n');
  before = snapshot(d);
  bad(run(d, '--check'));
  assert.deepEqual(snapshot(d), before);
}));

test('empreintes sources, CRS, évasion de chemin et liens symboliques sont contrôlés', () => {
  for (const mode of ['sha', 'crs', 'traversal', 'symlink']) fixture(d => {
    if (mode === 'sha') {
      writeFileSync(path.join(d, 'sources/ign-rge-alti-frontiere.json'), '{"elevations":[]}');
    } else if (mode === 'crs') {
      const m = readJson(d, 'manifest.json');
      const dtm = readJson(d, 'sources/piemonte-dtm5-samples.json');
      dtm.crs = 'EPSG:2154';
      const b = Buffer.from(JSON.stringify(dtm));
      writeFileSync(path.join(d, 'sources/piemonte-dtm5-samples.json'), b);
      const e = m.sourcesFigees.find(x => x.fichier === 'sources/piemonte-dtm5-samples.json');
      e.octets = b.length; e.sha256 = sha(b);
      writeFileSync(path.join(d, 'manifest.json'), JSON.stringify(m));
    } else if (mode === 'traversal') {
      const m = readJson(d, 'manifest.json');
      m.sourcesFigees[0].fichier = '../escape.json';
      writeFileSync(path.join(d, 'manifest.json'), JSON.stringify(m));
    } else if (mode === 'symlink') {
      rmSync(path.join(d, 'trace-l1.json'), { force: true });
      symlinkSync(path.join(d, 'manifest.json'), path.join(d, 'trace-l1.json'));
    }
    bad(run(d));
  });
});
