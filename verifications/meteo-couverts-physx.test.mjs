// Vraies précipitations projetées, vrais ouvrages du décor et vrai PhysX WASM.
// Le Canvas enregistre les traits : ce banc ne remplace pas les captures du compositing navigateur.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const req = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'carene', 'decor', 'solides-physx', 'meteo', 'vitre']) req('../src/' + f + '.js');
const B = globalThis.BITUME, M = B.meteo, X = await chargerPhysX();
const c = B.circuit.creer(47, { theme: 'montagne', longueur: 5200 }), t = c.tunnel;
c.couverts = [
  { ...t, id: 'premier', type: 'tunnel', fin: t.debut + 78 },
  { ...t, id: 'galerie', type: 'galerie', ouvert: 'G', debut: t.debut + 100, fin: t.debut + 154 },
  { ...t, id: 'second', type: 'tunnel', debut: t.debut + 186 }
];
const decor = B.decor.construire(c, { qualite: 'low', vegetation: false });
const world = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 1 }), solids = B.solidesPhysX.installer(world, c, decor);
const physique = { world, solids }, natif = world.raycast; let requetes = 0, controles = 0;
world.raycast = function (...args) { requetes++; return natif.apply(this, args); };
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const rapport = { schema: 1, controles: 0, rayonsNatifs: 0, scenarios: [],
  meteoSha256: createHash('sha256').update(readFileSync(new URL('../src/meteo.js', import.meta.url))).digest('hex'),
  limite: 'Temps CPU JavaScript et requêtes WASM, Canvas instrumenté sans raster ; aucun FPS matériel déduit.' };

function jeuRaccorde() {
  if (process.argv[2]) {
    const source = readFileSync(process.argv[2], 'utf8');
    rapport.raccord = { sourceSha256: createHash('sha256').update(source).digest('hex'), portee: 'Copie raccordée fournie explicitement au banc.' };
    return source;
  }
  const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
  const patch = fileURLToPath(new URL('../docs/reprise/PARALLELE-2026-11-20/raccordements/06-jeu.patch', import.meta.url));
  const temporaire = mkdtempSync(join(tmpdir(), 'bitume-pluie-raccord-'));
  try {
    mkdirSync(join(temporaire, 'src'));
    writeFileSync(join(temporaire, 'src/jeu.js'), source);
    let dejaRaccorde = false;
    try { execFileSync('git', ['apply', '--check', patch], { cwd: temporaire, stdio: 'pipe' }); }
    catch {
      // Après intégration par 00, le vrai fichier satisfait déjà le même raccord.
      // Vérifier exactement le patch inverse, sans l'appliquer, évite une double reprise.
      execFileSync('git', ['apply', '--reverse', '--check', patch], { cwd: temporaire, stdio: 'pipe' });
      dejaRaccorde = true;
    }
    if (!dejaRaccorde) execFileSync('git', ['apply', patch], { cwd: temporaire, stdio: 'pipe' });
    rapport.raccord = { sourceSha256: createHash('sha256').update(source).digest('hex'),
      patchSha256: createHash('sha256').update(readFileSync(patch)).digest('hex'),
      portee: dejaRaccorde ? 'jeu.js déjà raccordé, patch inverse vérifié sans modification.' : 'Copie temporaire de jeu.js raccordée, fichier partagé inchangé.' };
    return readFileSync(join(temporaire, 'src/jeu.js'), 'utf8');
  } finally { rmSync(temporaire, { recursive: true, force: true }); }
}

function toile() {
  const traits = []; let point;
  const ctx = { globalAlpha: 1, setTransform() {}, clearRect() { traits.length = 0; }, beginPath() {}, stroke() {}, fill() {},
    moveTo(x, y) { point = [x, y]; }, lineTo(x, y) { traits.push([...point, x, y]); }, quadraticCurveTo() {}, ellipse() {} };
  return { width: 960, height: 540, clientWidth: 960, clientHeight: 540, style: {}, traits,
    getContext: type => type === '2d' ? ctx : null };
}
function camera(s, angle = 0, hauteur = 1.2, lateral = 0) {
  const q = B.circuit.echantillon(c, s);
  return { pos: [q.x - Math.sin(q.cap) * lateral, q.y + hauteur, q.z + Math.cos(q.cap) * lateral],
    yaw: q.cap + Math.PI / 2 + angle, pitch: 0, fov: 70 };
}
function passage(nom, cam, palier = 'high', n = 60) {
  const canvas = toile(), pluie = M.creerPluie(canvas), mesures = [], temps = [], empreinte = createHash('sha256');
  for (let i = 0; i < n; i++) {
    const avant = requetes, debut = performance.now();
    const s = pluie.dessiner({ t: 12 + i / 30, pluie: 1 }, cam, 1 / 30, { circuit: c, physique, palier });
    temps.push(performance.now() - debut); mesures.push({ ...s });
    empreinte.update(JSON.stringify({ traits: canvas.traits, stats: s }));
    assert.equal(requetes - avant, s.rayons, 'compteur fidèle aux requêtes natives');
    assert.ok(s.rayons <= 5 * s.spatiaux, 'au plus cinq rayons par trait déjà projeté près d’un couvert');
    assert.ok(s.spatiaux <= s.candidats && s.candidats <= M.GOUTTES[palier]);
  }
  temps.sort((a, b) => a - b);
  rapport.scenarios.push({ nom, palier, images: n, traitsEtStatsSha256: empreinte.digest('hex'),
    traitsMin: Math.min(...mesures.map(s => s.traits)), traitsMax: Math.max(...mesures.map(s => s.traits)),
    rayonsMax: Math.max(...mesures.map(s => s.rayons)), spatiauxMax: Math.max(...mesures.map(s => s.spatiaux)),
    cpuMs: { p50: temps[Math.floor(n / 2)], p95: temps[Math.floor(n * .95)], pire: temps[n - 1] } });
  return { canvas, pluie, mesures };
}

try {
  verifier('le fond du tunnel et le mur fermé de la galerie ne laissent passer aucun trait', () => {
    for (const [nom, cam] of [['fond-tunnel', camera(t.debut + 39)], ['galerie-mur', camera(t.debut + 127, Math.PI / 2)]]) {
      const r = passage(nom, cam);
      assert.ok(r.mesures.every(s => s.traits === 0 && s.masquee));
      assert.ok(r.mesures.some(s => s.abrites > 0 && s.occultes > 0), 'volume et vraies parois exercés');
    }
  });
  verifier('la pluie extérieure demeure visible depuis le portail et le côté ouvert de la galerie', () => {
    for (const [nom, cam] of [['portail-sortant', camera(t.debut + 3, Math.PI)], ['galerie-ouverte', camera(t.debut + 127, -Math.PI / 2)]]) {
      assert.equal(B.couverts.abri(c, cam.pos), true);
      const r = passage(nom, cam);
      assert.ok(r.mesures.every(s => s.traits > 20), 'pluie dehors visible malgré une caméra abritée');
      assert.ok(r.mesures.some(s => s.abrites > 0 && s.occultes > 0));
    }
  });
  verifier('les linteaux réels et le dessus du toit sont distingués sans déplacer les ouvrages', () => {
    const linteau = camera(t.debut - 1.75), ciel = camera(t.debut + 39, 0, t.hauteur + 4);
    assert.equal(B.couverts.abri(c, linteau.pos), false, 'linteau hors intervalle historique');
    assert.equal(M.abriCouverts(c, linteau.pos, physique), true, 'linteau dessiné réellement au-dessus');
    assert.equal(M.abriCouverts(c, ciel.pos, physique), false, 'caméra au-dessus de la couverture');
    assert.ok(passage('dessus-toit', ciel).mesures.every(s => s.traits > 20));
  });
  verifier('loin des couverts, pluie strictement identique et aucune requête native', () => {
    const cam = camera(0), a = toile(), b = toile(), pa = M.creerPluie(a), pb = M.creerPluie(b);
    for (let i = 0; i < 60; i++) {
      const m = { t: 12 + i / 30, pluie: 1 }, avant = requetes;
      pa.dessiner(m, cam, 1 / 30, { circuit: c, physique, palier: 'high' });
      assert.equal(requetes, avant); assert.equal(pa.stats.spatiaux, 0);
      pb.dessiner(m, cam, 1 / 30, { palier: 'high' }); assert.deepEqual(a.traits, b.traits);
    }
    passage('dehors', cam);
  });
  verifier('Légère garde le même masque et réduit les candidats et le nombre de requêtes', () => {
    const cam = camera(t.debut + 127, -Math.PI / 2), bas = passage('galerie-ouverte', cam, 'low'), haut = passage('galerie-ouverte', cam, 'high');
    for (let i = 0; i < bas.mesures.length; i++) {
      assert.equal(bas.mesures[i].candidats, 420); assert.equal(haut.mesures[i].candidats, 840);
      assert.ok(bas.mesures[i].rayons <= haut.mesures[i].rayons);
      assert.ok(bas.mesures[i].traits > 5 && bas.mesures[i].traits <= haut.mesures[i].traits);
    }
  });
  verifier('la pause redessine les mêmes traits et J2 ne modifie pas les tampons de J1', () => {
    const a = toile(), b = toile(), pa = M.creerPluie(a), pb = M.creerPluie(b), camA = camera(t.debut + 3, Math.PI), camB = camera(t.debut + 127, -Math.PI / 2);
    const meteo = { t: 14, pluie: 1 }, options = { circuit: c, physique, palier: 'high' };
    pa.dessiner(meteo, camA, 1 / 60, options); const traits = JSON.stringify(a.traits), stats = JSON.stringify(pa.stats);
    pb.dessiner({ t: 28, pluie: .8 }, camB, 1 / 30, options);
    assert.equal(JSON.stringify(a.traits), traits); assert.equal(JSON.stringify(pa.stats), stats);
    pa.dessiner(meteo, camA, 0, options); assert.equal(JSON.stringify(a.traits), traits);
    const avant = requetes; pa.dessiner({ t: 14, pluie: 0 }, camA, 0, options);
    assert.equal(requetes, avant); assert.equal(pa.stats.traits, 0); assert.equal(pa.stats.masquee, true);
  });
  verifier('le raccord réel du jeu conserve la pluie dehors et laisse sécher la visière sous abri', () => {
    const source = jeuRaccorde();
    const a = source.indexOf('  let pluieVue = null'), b = source.indexOf('  // menus à la manette', a);
    assert.ok(a >= 0 && b > a);
    const v = { id: 0, etat: { v: 35 } }, S = { i: 0, suivie: 0, nature: { saison: { neige: false } }, meteo: { t: 12, pluie: 1 }, course: { c, physique, voitures: [v], joueur: v } };
    const executer = new Function('B', 'session', 'toile', `
      const elements = new Map(), $ = id => { if (!elements.has(id)) elements.set(id, toile()); return elements.get(id); };
      const window = { devicePixelRatio: 1 }, CATALOGUE = [{ theme: 'montagne' }], reglages = { gouttes: 1 }, DT = 1/120;
      const creationTardive = (nom, valeur) => valeur, sousLaVoute = (c, p) => B.couverts.abri(c, p);
      let ecran = 'course'; const retourReglages = 'course';
      ${source.slice(a, b)}
      return { dessiner: (S, cam, palier = 'high', dt = 1/30) => dessinerMeteo(S, dt, cam, 'cockpit', { palier }),
        pluie: (deux = false) => deux ? pluieVue2 : pluieVue, vitre: (deux = false) => deux ? vitreVue2 : vitreVue,
        pause: oui => { ecran = oui ? 'pause' : 'course'; } };
    `)(B, S, toile);
    const dehors = camera(0), portail = camera(t.debut + 3, Math.PI);
    for (let i = 0; i < 90; i++) { S.meteo.t += 1 / 30; executer.dessiner(S, dehors); }
    const vitre = executer.vitre(); assert.ok(vitre.stats.gouttes > 0);
    const sequence = vitre.sequence; executer.dessiner(S, portail);
    assert.equal(S.vitreContexte.abri, true);
    assert.ok(executer.pluie().stats.traits > 20, 'le jeu ne coupe plus globalement la pluie depuis le portail');
    assert.equal(vitre.sequence, sequence, 'aucun nouveau dépôt sous le toit'); assert.ok(vitre.stats.gouttes > 0, 'résidu conservé à l’entrée');
    const statsJ1 = JSON.stringify(S.pluieImage), contexteJ1 = S.vitreContexte;
    const J2 = { ...S, vitreContexte: null, meteo: { ...S.meteo, t: 28 } };
    executer.dessiner(J2, camera(t.debut + 127, -Math.PI / 2), 'low');
    assert.equal(JSON.stringify(S.pluieImage), statsJ1, 'le raccord J2 préserve les statistiques J1');
    assert.equal(J2.pluieImage.candidats, 420, 'le palier réel atteint la pluie de J2');
    assert.notEqual(executer.pluie(), executer.pluie(true)); assert.notEqual(executer.vitre(), executer.vitre(true));
    assert.notEqual(J2.vitreContexte, contexteJ1); assert.equal(J2.vitreContexte.abri, true);
    executer.pause(true); executer.dessiner(S, portail, 'high', 0);
    assert.equal(S.vitreContexte.pause, true); assert.equal(vitre.sequence, sequence, 'le raccord en pause ne dépose aucune goutte');
    executer.pause(false); executer.dessiner(S, portail);
    for (let i = 0; i < 30 * 30; i++) B.vitre.mettreAJour(vitre, 1 / 30, S.vitreContexte);
    assert.equal(vitre.sequence, sequence); assert.equal(vitre.stats.gouttes, 0, 'séchage résiduel');
  });
} finally {
  rapport.controles = controles; rapport.rayonsNatifs = requetes;
  if (process.env.BITUME_PLUIE_RAPPORT) writeFileSync(process.env.BITUME_PLUIE_RAPPORT, JSON.stringify(rapport, null, 2) + '\n');
  B.solidesPhysX.liberer(solids); world.dispose(); X.dispose();
}
console.log(`météo couverts : ${controles} contrôles passés, ${requetes} rayons natifs bornés aux traits projetés`);
