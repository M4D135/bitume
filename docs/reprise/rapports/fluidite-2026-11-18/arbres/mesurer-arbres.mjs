// Triangles et appels de dessin des arbres par image, moteur réel, WebGL inerte (aucun shader exécuté, aucun pixel,
// aucun temps GPU). Même méthode que tools/mesurer-prairie.mjs : setLots puis draw du vrai renderer.js, appels
// enregistrés par la doublure docs/reprise/rapports/herbe-sillage-2026-11-18/fixture-webgl.js.
//   node mesurer-arbres.mjs <dépôt BITUME> <commit|WORKTREE> <sortie.json> [ombres-lointaines]
// Arbres : tronc porteur de collision, formes botaniques « arbre-* » et blobs de feuillage des arbres en Légère.
// Les lots gardent leur sphère et leur bascule ; seuls les objets qui ne sont pas des arbres sont retirés.
// « ombres-lointaines » simule une retouche du moteur qui n'existe pas encore : la passe d'ombre du soleil prend la
// version lointaine d'un lot d'arbres (lot.arbres) dont la sphère est à plus de 40 m de l'œil. Simulation seulement,
// pour chiffrer une demande d'intégration ; le moteur publié n'est pas modifié.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const [depot, refDemandee, sortie, variante] = process.argv.slice(2);
if (!depot || !refDemandee || !sortie) throw Error('dépôt, référence et sortie requis');
if (variante && variante !== 'ombres-lointaines') throw Error('variante inconnue : ' + variante);
const ref = refDemandee === 'WORKTREE' ? 'WORKTREE' : execFileSync('git', ['-C', depot, 'rev-parse', refDemandee], { encoding: 'utf8' }).trim();
const empreintes = {};
function source(fichier) {
  const texte = ref === 'WORKTREE' ? readFileSync(path.join(depot, fichier), 'utf8')
    : execFileSync('git', ['-C', depot, 'show', ref + ':' + fichier], { encoding: 'utf8', maxBuffer: 8e6 });
  empreintes[fichier] = createHash('sha256').update(texte).digest('hex');
  return texte;
}
let moteur = source('src/moteur/renderer.js');
if (variante) {
  const avant = 'const proche=!l.paquetLoin||entry.near;';
  assert.ok(moteur.includes(avant), 'retouche simulée introuvable dans renderer.js');
  moteur = moteur.replace(avant, 'const proche=!l.paquetLoin||(entry.near&&!(accepte&&l.arbres===true&&entry.distance>40));');
}
vm.runInThisContext(moteur, { filename: 'src/moteur/renderer.js' });
const registre = new Map(), enregistrer = globalThis.FRender.forme;
globalThis.FRender.forme = (nom, triangles) => { registre.set(nom, triangles); return enregistrer(nom, triangles); };
for (const n of ['graphismes', 'carene', 'circuit', 'ecologie', 'saisons', 'vegetation', 'decor', 'botanique'])
  vm.runInThisContext(source('src/' + n + '.js'), { filename: 'src/' + n + '.js' });
const doublure = readFileSync(new URL('../../herbe-sillage-2026-11-18/fixture-webgl.js', import.meta.url), 'utf8');
const fixture = new Function('assert', 'vm', 'source', 'registry', doublure + '\nreturn fixture;')(assert, vm, moteur, registre);
const B = globalThis.BITUME;

const CIRCUITS = [['val-brule', 11, 'foret', 4200], ['haut-col', 47, 'montagne', 5200], ['brume-de-jade', 131, 'asie', 5000], ['cap-sequoia', 157, 'pacifique', 5200]];
// Toiles relevées dans le navigateur (../MESURES-BASE.md) : Fine 2880 × 1514, Moyenne 1440 × 757 ; glace 495 × 150.
const PALIERS = [['high', 2], ['medium', 1]];
const POSES = [800, 1500, 2200, 2900, 3600, 4300];
const estArbre = o => o.collision === 'tronc' || /^arbre-/.test(o.shape || '') || (o.shape === 'foliage' && Math.floor(o.mat) === 11);
const vierge = l => ({ ...l, tampon: null, tamponLoin: null, paquet: null, paquetLoin: null });

function cameras(circuit, decor) {
  const soleil = decor.atmosphere.sunDirection, sinus = soleil[1] / Math.hypot(...soleil), etendue = 100;
  const profondeur = 2 * (etendue * Math.sqrt(Math.max(0, 1 - sinus * sinus)) / Math.max(.25, sinus) + 30);
  const liste = [];
  for (const s of POSES) {
    if (s > circuit.longueur - 50) continue;
    const q = B.circuit.echantillon(circuit, s), ca = Math.cos(q.cap), sa = Math.sin(q.cap);
    const y = (decor.sol(q.x, q.z) ?? q.y) + 1.1;
    // Cockpit : regard le long de la piste (cap + π/2), ombres centrées 76 m devant comme jeu.js.
    liste.push({ nom: 'cockpit-' + s, pos: [q.x, y, q.z], yaw: q.cap + Math.PI / 2, pitch: 0, roll: 0, fov: 60, near: .045, far: 6000,
      sun: { center: [q.x + ca * 76, q.y, q.z + sa * 76], extent: etendue, depth: profondeur } });
    // Rétroviseur : regard vers l'arrière, champ vertical de la glace (16° de demi-champ horizontal, 495 × 150).
    liste.push({ nom: 'retro-' + s, retro: true, pos: [q.x, y + .1, q.z], yaw: q.cap - Math.PI / 2, pitch: .06, roll: 0,
      fov: 2 * Math.atan(Math.tan(16 * Math.PI / 180) * 150 / 495) * 180 / Math.PI, near: .3, far: 6000,
      sun: { center: [q.x, q.y, q.z], extent: etendue, depth: profondeur } });
  }
  return liste;
}

function compter(f) {
  const r = { couleurTriangles: 0, couleurAppels: 0, ombreTriangles: 0, ombreAppels: 0 };
  for (const d of f.draws) {
    if (d.kind === 'fullscreen') continue;
    const passe = d.target && !d.target[f.gl.COLOR_ATTACHMENT0] ? 'ombre' : 'couleur';
    r[passe + 'Triangles'] += d.count * (d.instances ?? 1) / 3; r[passe + 'Appels']++;
  }
  return r;
}

const resultats = [];
for (const [id, graine, theme, longueur] of CIRCUITS) {
  const circuit = B.circuit.creer(graine, { theme, longueur });
  for (const [qualite, echelle] of PALIERS) {
    const profil = B.graphismes.melange(qualite, 0, { decor: qualite });
    const decor = B.decor.construire(circuit, { qualite, ...profil.decor, saison: 'ete' });
    const lotsArbres = decor.lots.map(l => ({ ...vierge(l), objets: l.objets.filter(estArbre), loin: (l.loin || []).filter(estArbre) }))
      .filter(l => l.objets.length || l.loin.length);
    for (const portee of ['arbres', 'tout']) {
      const lots = portee === 'arbres' ? lotsArbres : decor.lots.map(vierge);
      for (const cam of cameras(circuit, decor)) {
        const f = fixture({ creation: { msaa: cam.retro ? 0 : 4, shadowMapScale: cam.retro ? 1 : 2, reflections: false, sea: false } });
        f.canvas.clientWidth = cam.retro ? 495 : 1440; f.canvas.clientHeight = cam.retro ? 150 : 757; f.renderer.resize(cam.retro ? 1 : echelle);
        f.renderer.setWorld([], [], decor.atmosphere);
        f.renderer.setNappes(portee === 'tout' ? decor.nappes.map(n => ({ ...n })) : []);
        f.renderer.setLots(lots.map(vierge));
        const fx = { time: 5, shadows: !cam.retro, sunOnly: true, torch: false, shadowMapScale: cam.retro ? 1 : 2, msaa: !cam.retro, bloom: false,
          reflections: false, adaptive: false, windStrength: 1, groundCover: B.graphismes.PRAIRIE?.[profil.decor.vegetationQualite] };
        let mesure = null;
        for (let image = 0; image < 3; image++) { f.draws.length = 0; f.renderer.draw(cam, [], fx); mesure = compter(f); }
        resultats.push({ circuit: id, qualite, portee, camera: cam.nom, toile: [f.canvas.width, f.canvas.height], ...mesure,
          lotsVisibles: f.renderer.stats.lotsVisibles, lots: lots.length });
        f.renderer.dispose();
      }
    }
  }
}
writeFileSync(sortie, JSON.stringify({ date: new Date().toISOString(), node: process.version, plateforme: process.platform + '/' + process.arch,
  ref, variante: variante || null, empreintes, empreinteDoublure: createHash('sha256').update(doublure).digest('hex'), poses: POSES, resultats }, null, 1) + '\n');
console.log('écrit', sortie, resultats.length, 'mesures');
