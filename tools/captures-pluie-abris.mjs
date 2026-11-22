#!/usr/bin/env node
// Pluie depuis un abri : vrai jeu, PhysX et Canvas2D, caméra d'inspection prescrite.
// Les témoins sans pluie ne changent que visibility sur la toile, sans avancer une image.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer, optionsCapture } from './controle-visuel.mjs';
import { preparerEtat } from './captures-meteo.mjs';
import { decoderPng } from './visuel-images.mjs';

export const SCENARIOS_PLUIE_ABRIS = Object.freeze([
  { id: 'cimes-tunnel-portail', circuit: 5, circuitId: 'route-des-cimes', type: 'tunnel', pose: 'portail', pluieVisible: true, vue: 'cockpit' },
  { id: 'cimes-tunnel-fond', circuit: 5, circuitId: 'route-des-cimes', type: 'tunnel', pose: 'fond', pluieVisible: false, vue: 'poursuite' },
  { id: 'cimes-tunnel-linteau', circuit: 5, circuitId: 'route-des-cimes', type: 'tunnel', pose: 'linteau', pluieVisible: true, vue: 'poursuite' },
  { id: 'cimes-galerie-ouverte', circuit: 5, circuitId: 'route-des-cimes', type: 'galerie', pose: 'ouvert', pluieVisible: true, vue: 'cockpit' },
  { id: 'cimes-galerie-fermee', circuit: 5, circuitId: 'route-des-cimes', type: 'galerie', pose: 'ferme', pluieVisible: false, vue: 'poursuite' },
  { id: 'cimes-pilier', circuit: 5, circuitId: 'route-des-cimes', type: 'galerie', pose: 'pilier', pluieVisible: true, vue: 'poursuite' },
  { id: 'cimes-galerie-legere', circuit: 5, circuitId: 'route-des-cimes', type: 'galerie', pose: 'ouvert', pluieVisible: true, vue: 'poursuite', qualite: 'low' },
  { id: 'cimes-galerie-portrait', circuit: 5, circuitId: 'route-des-cimes', type: 'galerie', pose: 'ouvert', pluieVisible: true, vue: 'cockpit', taille: '540,960' }
].map(Object.freeze));

export function optionsPluieAbris(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url', 'sortie', 'chrome', 'cas', 'taille', 'angle'].includes(k) ||
        !argv[i + 1] || argv[i + 1].startsWith('--') || o[k] !== undefined)
      throw new Error('Option inconnue, répétée ou valeur absente : ' + argv[i]);
    o[k] = argv[i + 1];
  }
  if (!o.url || !o.sortie || new URL(o.url).protocol !== 'file:') throw new Error('--url file: et --sortie requis');
  o.cas = o.cas ? o.cas.split(',') : SCENARIOS_PLUIE_ABRIS.map(s => s.id);
  if (!o.cas.length || new Set(o.cas).size !== o.cas.length || o.cas.some(id => !SCENARIOS_PLUIE_ABRIS.some(s => s.id === id)))
    throw new Error('Scénario inconnu ou répété');
  o.taille ||= '960,540'; o.angle ||= 'swiftshader';
  optionsScenarioPluieAbris(SCENARIOS_PLUIE_ABRIS[0], o);
  return o;
}

export function optionsScenarioPluieAbris(s, o) {
  const args = ['--url', o.url, '--sortie', path.join(o.sortie, s.id), '--scenario', 'pluie',
    '--circuit', String(s.circuit), '--vue', s.vue, '--qualite', s.qualite || 'high', '--retro', 'non',
    '--saison', 'ete', '--moment', 'jour', '--meteo', 'pluie', '--depart', '280', '--vitesse', '0',
    '--taille', s.taille || o.taille, '--images', '2', '--chauffe', '12', '--pas', '.1',
    '--angle', o.angle || 'swiftshader', '--attendre', '120000'];
  if (o.chrome) args.push('--chrome', o.chrome);
  return optionsCapture(args);
}

// Sérialisée dans la page. Les seuls changements sont les poses/conditions de la scène d'essai.
export function installerPluieAbris(s) {
  const J = BITUME_JEU, B = BITUME, S = J.session, c = S.course.c, C = B.couverts;
  if (J.CATALOGUE[S.i]?.id !== s.circuitId || typeof B.meteo.abriCouverts !== 'function') throw new Error('Circuit ou module pluie-abris absent');
  const t = C.liste(c).find(t => C.type(t) === s.type);
  if (!t) throw new Error('Ouvrage absent : ' + s.type);
  const milieu = t.debut + C.longueur(c, t) / 2;
  const abscisse = s.pose === 'portail' ? t.debut + 3 : s.pose === 'linteau' ? t.debut - 1.75 :
    s.pose === 'pilier' ? t.debut + Math.floor(C.longueur(c, t) / 24) * 12 : milieu;
  const q = B.circuit.echantillon(c, abscisse), ouvert = t.ouvert === 'G' ? -1 : 1;
  const angle = s.pose === 'portail' || s.pose === 'linteau' ? Math.PI : ['ouvert', 'pilier'].includes(s.pose) ? ouvert * Math.PI / 2 : s.pose === 'ferme' ? -ouvert * Math.PI / 2 : 0;
  const camera = { pos: [q.x, q.y + 1.2, q.z], yaw: q.cap + Math.PI / 2 + angle, pitch: 0, roll: 0, fov: 70 };
  for (const v of S.course.voitures) {
    const positionS = v.id === S.suivie ? abscisse : milieu + 60 + v.id * 7;
    const p = B.circuit.echantillon(c, positionS), e = v.etat;
    Object.assign(e, { s: ((positionS % c.longueur) + c.longueur) % c.longueur, d: 0, v: 0, psi: 0, beta: 0,
      y: p.y, tangage: Math.atan(p.pente || 0), roulis: p.devers || 0 });
    const pose = { x: p.x, y: p.y, z: p.z, cap: p.cap, tangage: e.tangage, roulis: e.roulis,
      braquage: 0, roule: v.roule || 0, rebond: [0, 0, 0, 0] };
    if (e._physx) { Object.assign(e._physx, { x: p.x, y: p.y, z: p.z, cap: p.cap, groundCount: 4 }); e._physx.velocity.fill(0); }
    for (const liste of [S.prec, S.cour]) Object.assign(liste[v.id], pose);
  }
  S.camCap = null; S.tete = null; S.secousse = 0; J.reglages.secousses = 0;
  J.camera = () => ({ ...camera, pos: camera.pos.slice() });
  globalThis.__PLUIE_ABRIS_CAPTURE = { scenario: s, section: t, abscisse, camera };
  return { posePrescrite: true, circuitId: s.circuitId, section: { ...t }, camera, abscisse,
    description: 'Caméra d’inspection et poses prescrites ; géométrie, masque, pluie et compositing du HTML exact. Aucun roulage ni FPS matériel.' };
}

export function observerPluieAbris() {
  const J = BITUME_JEU, B = BITUME, S = J.session, G = __PLUIE_ABRIS_CAPTURE, gl = J.rendu.gl;
  const canvas = document.getElementById('meteo'), ctx = canvas?.getContext('2d'), r = canvas?.getBoundingClientRect();
  if (!ctx || !r) throw new Error('Toile de pluie absente');
  const css = getComputedStyle(canvas), c = S.course.c;
  let pilier = null;
  if (G.scenario.pose === 'pilier') {
    const a = S.camera, dir = [Math.sin(a.yaw) * Math.cos(a.pitch), Math.sin(a.pitch), -Math.cos(a.yaw) * Math.cos(a.pitch)];
    const hit = S.course.physique.world.raycast(a.pos, dir, G.section.mur + 3, { mask: 2, staticOnly: true });
    pilier = { hit: !!hit.hit, genre: hit.hit ? S.course.physique.solids.acteurs.get(hit.body)?.genre || null : null };
  }
  return { glErreur: gl.getError(), glPerdu: gl.isContextLost(), pluie: S.meteo.pluie, temps: S.meteo.t,
    statistiques: S.pluieImage ? { ...S.pluieImage } : null, qualite: S.vitreContexte?.qualite, vue: S.vue,
    abri: B.meteo.abriCouverts(c, S.camera.pos, S.course.physique), abriLogique: B.couverts.abri(c, S.camera.pos),
    abriVisiere: S.vitreContexte?.abri, visiere: J.vitres?.j1 || null, pilier,
    camera: { pos: [...S.camera.pos], yaw: S.camera.yaw, pitch: S.camera.pitch, fov: S.camera.fov },
    section: G.section.id || null, largeur: canvas.width, hauteur: canvas.height,
    toileVisible: !canvas.hidden && css.display !== 'none' && css.visibility !== 'hidden',
    rectangle: { x: r.x, y: r.y, width: r.width, height: r.height }, masquePng: canvas.toDataURL('image/png') };
}

// Compare le vrai écran et un témoin sans composition de pluie, à rAF inchangé.
// Le support alpha vient de la toile rasterisée, pas du compteur de traits.
export function mesurerComposition(avec, sans, masque, rectangle) {
  if (avec.width !== sans.width || avec.height !== sans.height || masque.canaux !== 4 ||
      !(rectangle.width > 0 && rectangle.height > 0)) throw new Error('Images de composition incompatibles');
  let pixelsPluie = 0, alphaTotal = 0, modifies = 0, surPluie = 0, horsPluie = 0;
  for (let i = 3; i < masque.pixels.length; i += 4) { const a = masque.pixels[i]; if (a) pixelsPluie++; alphaTotal += a; }
  for (let y = 0; y < avec.height; y++) for (let x = 0; x < avec.width; x++) {
    const a = (y * avec.width + x) * avec.canaux, b = (y * sans.width + x) * sans.canaux;
    if (avec.pixels[a] === sans.pixels[b] && avec.pixels[a + 1] === sans.pixels[b + 1] && avec.pixels[a + 2] === sans.pixels[b + 2]) continue;
    modifies++;
    const mx = Math.floor((x + .5 - rectangle.x) * masque.width / rectangle.width), my = Math.floor((y + .5 - rectangle.y) * masque.height / rectangle.height);
    if (mx >= 0 && mx < masque.width && my >= 0 && my < masque.height && masque.pixels[(my * masque.width + mx) * 4 + 3]) surPluie++;
    else horsPluie++;
  }
  return { pixelsPluie, alphaTotal, modifies, surPluie, horsPluie };
}

export function verifierPluieAbris(r, s) {
  const e = [];
  if (r.fatal) e.push(r.fatal.split('\n')[0]);
  if (!/^[a-f0-9]{64}$/.test(r.build?.sha256 || '') || !/^[a-f0-9]{40}$/.test(r.source?.commit || '')) e.push('Identité HTML ou sources absente');
  if (r.environnement?.webgl2 !== true || r.environnement?.physx?.ready !== true) e.push('WebGL2 ou PhysX natif absent');
  if (s.taille && s.taille.split(',').some((n, i) => r.environnement?.resolution?.[i] !== Number(n))) e.push('Viewport différent du scénario');
  if (r.initialisation?.posePrescrite !== true || r.initialisation?.circuitId !== s.circuitId) e.push('Scène prescrite incorrecte');
  for (const x of r.erreurs || []) e.push('Erreur page : ' + x);
  for (const x of r.avertissements || []) if (/GL_INVALID|shader.*(error|failed)|GLSL|context lost/i.test(x)) e.push('Erreur graphique : ' + x);
  if (r.images?.length !== 2) e.push('Deux captures requises');
  for (const im of r.images || []) {
    const o = im.observation, p = o?.statistiques, raster = o?.composition;
    if (!o || !p || !raster) { e.push('Observation pluie/raster absente'); continue; }
    if (o.glErreur || o.glPerdu) e.push('Erreur WebGL');
    if (s.pose === 'pilier' && (!o.pilier?.hit || o.pilier?.genre !== 'pilier-galerie')) e.push('Pilier absent du centre du cadre');
    if (o.abri !== true || o.abriVisiere !== true || o.abriLogique !== (s.pose !== 'linteau')) e.push('Abri réel ou visière incorrect');
    if (!(o.pluie > .5) || o.qualite !== (s.qualite || 'high') || o.vue !== s.vue) e.push('Pluie, qualité ou vue incorrecte');
    if (!Array.isArray(o.camera?.pos) || o.camera.pos.length !== 3 || !o.camera.pos.every(Number.isFinite)) e.push('Caméra invalide');
    if (![p.candidats, p.traits, p.spatiaux, p.rayons].every(n => Number.isInteger(n) && n >= 0) || p.rayons > 5 * p.spatiaux || p.spatiaux > p.candidats ||
        p.candidats > (s.qualite === 'low' ? 420 : 840)) e.push('Budget pluie ou rayons incorrect');
    if (s.pluieVisible) {
      if (!(p.traits > 0 && raster.pixelsPluie > 0 && raster.surPluie > 0) || o.toileVisible !== true || p.masquee !== false)
        e.push('Pluie extérieure non composée sur les pixels du jeu');
    } else if (p.traits !== 0 || raster.pixelsPluie !== 0 || raster.surPluie !== 0 || o.toileVisible !== false || p.masquee !== true)
      e.push('Pluie indue sur une paroi ou au fond du tunnel');
    if (!(p.spatiaux > 0)) e.push('Masque spatial non exercé');
    if (o.visiere?.eau !== 0 || o.visiere?.gouttes !== 0 || o.visiere?.embruns !== 0) e.push('Nouveaux dépôts sur la visière abritée');
    if (!im.etat?.zones?.scene || !Number.isFinite(im.vues?.scene?.luminance) || !Number.isFinite(im.vues?.scene?.noir) ||
        im.vues.scene.noir > .97 && im.vues.scene.luminance < .025) e.push('Scène rendue absente ou noire');
    if (![o.temoin?.sha256, o.masque?.sha256].every(h => /^[a-f0-9]{64}$/.test(h || ''))) e.push('Témoins raster absents');
  }
  return [...new Set(e)];
}

export async function campagnePluieAbris(o) {
  mkdirSync(o.sortie, { recursive: true });
  const rapport = { format: 'bitume-pluie-abris-v1', date: new Date().toISOString(), demandes: [...o.cas], passages: [], echecs: 0,
    limites: ['Caméras d’inspection et voitures immobiles : aucune traversée roulée.',
      'Les témoins masquent uniquement la toile pluie, sans avancer la simulation ; les PNG complets doivent être inspectés.',
      'Les lectures de pixels et PNG appartiennent à cet outil hors jeu ; elles ne mesurent ni coût de rendu ni FPS matériel.',
      'source identifie les outils ; build.sha256 identifie le HTML temporaire, à rapprocher du reçu de reconstruction.'] };
  for (const id of o.cas) {
    const s = SCENARIOS_PLUIE_ABRIS.find(s => s.id === id), p = optionsScenarioPluieAbris(s, o);
    p.initialiser = ({ evaluer }) => evaluer(`(${preparerEtat.toString()})({vitesse:0}); (${installerPluieAbris.toString()})(${JSON.stringify(s)})`);
    p.observer = async ({ evaluer, envoyer, i }) => {
      const observation = await evaluer(`(${observerPluieAbris.toString()})()`);
      const prefixe = String(i).padStart(4, '0'), masque = Buffer.from(observation.masquePng.replace(/^data:image\/png;base64,/, ''), 'base64');
      delete observation.masquePng;
      const ancien = await evaluer(`(() => {const c=document.getElementById('meteo'), v=c.style.visibility; c.style.visibility='hidden'; return v;})()`);
      let capture;
      try { capture = await envoyer('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); }
      finally { await evaluer(`document.getElementById('meteo').style.visibility=${JSON.stringify(ancien)}; true`); }
      const temoin = Buffer.from(capture.data, 'base64'), avec = readFileSync(path.join(p.sortie, prefixe + '.png'));
      observation.composition = mesurerComposition(decoderPng(avec), decoderPng(temoin), decoderPng(masque), observation.rectangle);
      for (const [cle, suffixe, octets] of [['masque', '-pluie.png', masque], ['temoin', '-sans-pluie.png', temoin]]) {
        const fichier = prefixe + suffixe; writeFileSync(path.join(p.sortie, fichier), octets);
        observation[cle] = { fichier, octets: octets.length, sha256: createHash('sha256').update(octets).digest('hex') };
      }
      return observation;
    };
    const r = await capturer(p), erreurs = verifierPluieAbris(r, s);
    const hashFinal = createHash('sha256').update(readFileSync(fileURLToPath(o.url))).digest('hex');
    if (r.build?.sha256 !== hashFinal || rapport.build && rapport.build.sha256 !== hashFinal) erreurs.push('HTML modifié pendant la campagne');
    rapport.build ||= r.build;
    const empreintes = r.images.map(im => ({ fichier: im.fichier, sha256: createHash('sha256').update(readFileSync(path.join(p.sortie, im.fichier))).digest('hex') }));
    rapport.passages.push({ scenario: id, images: r.images.length, dossier: id, source: r.source, build: r.build, empreintes, erreurs });
    if (erreurs.length) rapport.echecs++;
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(rapport, null, 2) + '\n');
    process.stderr.write(id + ' : ' + r.images.length + ' images, ' + erreurs.length + ' erreurs\n');
    if (r.fatal && !r.images.length) break;
  }
  rapport.nonExecutes = o.cas.filter(id => !rapport.passages.some(p => p.scenario === id));
  rapport.complet = !rapport.nonExecutes.length;
  writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(rapport, null, 2) + '\n');
  return rapport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = await campagnePluieAbris(optionsPluieAbris(process.argv.slice(2))); console.log(JSON.stringify(r, null, 2)); process.exitCode = r.echecs || !r.complet ? 1 : 0; }
  catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}
