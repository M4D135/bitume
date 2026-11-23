#!/usr/bin/env node
// Banc visuel isolé : vrais voiture.js et FERRO, sans jeu.js ni construction du jeu.
// node tools/captures-pilote-module.mjs --sortie /tmp/pilote --reference <commit> [--chrome /usr/bin/chromium]
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { argumentsWebGPU, environnementWebGPU } from './diagnostic-webgpu.mjs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RENDU = ['ferro/render-shared.js', 'ferro/webgpu-shaders.js', 'ferro/webgpu-renderer.js'];
const MODULES = [...RENDU, 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'cockpit-matieres.js', 'voiture.js'];
const empreinte = b => createHash('sha256').update(b).digest('hex');
export const SCENARIOS_PILOTE = Object.freeze([
  { id: 'face', poste: [1.7, 1.30, 0], cible: [0, .64, 0] },
  { id: 'profil', poste: [-.10, 1.02, -2], cible: [-.05, .62, 0] },
  { id: 'trois-quarts', poste: [-1.15, 1.55, 1.25], cible: [.05, .58, 0] },
  { id: 'cockpit', cockpit: true },
  { id: 'braquage-passage', poste: [-1.15, 1.55, 1.25], cible: [.05, .58, 0], volant: -.8, passage: .38 },
  { id: 'majeur', poste: [.85, 1.25, -1.65], cible: [-.02, .72, 0], geste: 'majeur' },
  { id: 'lod-moyen', detail: 'moyen', poste: [-1.15, 1.55, 1.25], cible: [.05, .58, 0] },
  { id: 'lod-simple', detail: 'simple', poste: [-1.15, 1.55, 1.25], cible: [.05, .58, 0] }
].map(s => Object.freeze({ detail: 'complet', fov: 40, ...s })));

export function optionsPilote(argv) {
  const o = { chrome: process.env.CHROME || '/usr/bin/chromium', moteur: 'webgpu' };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['sortie', 'chrome', 'reference', 'moteur'].includes(k) || !argv[i + 1] || argv[i + 1].startsWith('--'))
      throw new Error('Option invalide : ' + argv[i]);
    o[k] = argv[i + 1];
  }
  if (!o.sortie) throw new Error('--sortie requis');
  if (!['webgpu', 'logiciel'].includes(o.moteur)) throw new Error('Moteur attendu : webgpu ou logiciel');
  if (o.reference && !/^[a-f0-9]{7,40}$/.test(o.reference)) throw new Error('La référence doit être un SHA Git');
  o.sortie = path.resolve(o.sortie); return o;
}

// Sérialisée dans la page de banc. Les appels de production restent intacts.
export async function scenePilote() {
  const V = BITUME.voiture, canvas = document.querySelector('canvas');
  const modele = V.modele({ couleur: [.82, .12, .08], combinaison: [.88, .84, .72], numero: 27 });
  const rendu = await FRenderWebGPU.create(canvas, { msaa: 4, reflections: false, shadowMapScale: 1, overlayLighting: 'world' });
  const sol = { shape: 'box', p: [0, -.045, 0], s: [60, .06, 60], r: [0, 0, 0], mat: 0, color: [.28, .30, .32], outdoor: true };
  rendu.setWorld([sol], [], { sunDirection: [1, 1.8, -1.2], ambient: [.42, .45, .49], sunColor: [.9, .88, .84],
    skyTop: [.33, .43, .52], skyBottom: [.68, .72, .75], fog: [.68, .72, .75], fogDensity: .0001, wind: 0,
    outdoorZones: [{ x: 0, z: 0, w: 100, d: 100 }] });
  window.__PILOTE = { environnement: environnementWebGPU(rendu),
    async dessiner(s) {
      const etat = { volant: s.volant || 0, rapportAvant: 2, rapport: 3, passage: s.passage ?? 1, regime: 9000, kmh: 150,
        v: 35, t: 12, alat: 0, along: 0, regard: 0, geste: s.geste || null, gesteIntensite: s.geste ? 1 : 0, gesteCote: -1, gestePhase: .43,
        ciel: [.68, .72, .75], brume: [.68, .72, .75] };
      const ev = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: etat.volant * .12, roule: 0, v: 35, pilote: etat };
      const objets = [];
      if (s.cockpit) V.cockpit(modele, ev, objets, etat); else V.poser(modele, ev, objets, { detail: s.detail });
      let camera;
      if (s.cockpit) camera = { pos: Array.from(V.OEIL), yaw: Math.PI / 2, pitch: -Math.PI / 60, roll: 0,
        fov: 2 * Math.atan(Math.tan(Math.PI / 6) / (960 / 640)) * 180 / Math.PI, near: .1, far: 180 };
      else {
        const d = s.cible.map((v, i) => v - s.poste[i]);
        camera = { pos: s.poste, yaw: Math.atan2(d[0], -d[2]), pitch: Math.atan2(d[1], Math.hypot(d[0], d[2])), roll: 0, fov: s.fov, near: .045, far: 180 };
      }
      const fx = { time: 12, shadows: true, bloom: false, msaa: true, torch: false, sunOnly: true, adaptive: false, vignette: false,
        reflections: false, brightness: 1, damage: 0, flash: 0, photo: 0 };
      for (let i = 0; i < 3; i++) rendu.draw(camera, objets, fx);
      await rendu.gpu.device.queue.onSubmittedWorkDone();
      const erreursGPU = [...rendu.stats.errorEvents];
      if (rendu.stats.deviceLost) erreursGPU.push('Périphérique perdu');
      return { id: s.id, camera, detailPrescrit: s.detail, cockpit: !!s.cockpit, pose: etat,
        oeil: Array.from(V.OEIL), assise: V.PILOTE_ASSISE ? Array.from(V.PILOTE_ASSISE) : null,
        articulations: Array.from(modele.objetsRendu.habitacle.articulations), objets: objets.length,
        resolution: [canvas.width, canvas.height], statistiques: { triangles: rendu.stats.triangles, instances: rendu.stats.instances, backend: rendu.stats.backend }, erreursGPU };
    }
  };
}

function sourcesBanc(ref) {
  return MODULES.map(nom => {
    const source = ref && !RENDU.includes(nom) ? execFileSync('git', ['show', `${ref}:src/${nom}`], { cwd: racine, maxBuffer: 8 * 1024 * 1024 }) : readFileSync(path.join(racine, 'src', nom));
    return { nom: 'src/' + nom, source, sha256: empreinte(source) };
  });
}
function pageBanc(ref) {
  const sources = sourcesBanc(ref);
  const html = '<!doctype html><meta charset="utf-8"><title>BITUME — inspection du module pilote</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block;width:100vw;height:100vh}</style><canvas width="960" height="640"></canvas>' +
    sources.map(s => '<script>' + s.source.toString('utf8').replace(/<\/script/gi, '<\\/script') + '</script>').join('\n') +
    '<script>const environnementWebGPU = ' + environnementWebGPU.toString() + ';(' + scenePilote.toString() + ')().catch(e=>{window.__PILOTE_ERREUR=String(e.stack || e)})</script>';
  return { html, empreintes: Object.fromEntries(sources.map(s => [s.nom, s.sha256])) };
}

export async function capturerPilote(o, scenarios = SCENARIOS_PILOTE, format = 'bitume-pilote-module-1') {
  if (existsSync(path.join(o.sortie, 'rapport.json'))) throw new Error('Dossier déjà utilisé');
  mkdirSync(o.sortie, { recursive: true });
  const profil = mkdtempSync(path.join(tmpdir(), 'bitume-pilote-module-'));
  const navigateur = spawn(o.chrome, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox',
    '--remote-debugging-port=0', '--user-data-dir=' + profil, '--window-size=960,640', '--hide-scrollbars',
    ...argumentsWebGPU(o.moteur === 'logiciel' ? 'swiftshader' : 'native'), 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '', erreur = null, termine = false, ws, sequence = 0; const demandes = new Map();
  navigateur.stderr.on('data', d => { stderr = (stderr + d).slice(-6000); }); navigateur.on('error', e => { erreur = e; });
  navigateur.on('exit', () => { termine = true; });
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const rapport = { format, reference: o.reference || null, taille: [960, 640], erreurs: [], variantes: {},
    limites: ['Banc du module, pas le jeu assemblé : aucun jeu.js, HUD, météo, démo ni raccord de caméra intégré.',
      'Niveaux de détail prescrits en gros plan pour inspecter les surfaces ; aucune validation de leurs seuils de bascule.',
      'Caméra cockpit au repère OEIL avec inclinaison prescrite, sans prétendre qualifier le raccord de 00.',
      'Les variantes emploient le même FERRO WebGPU du checkout ; la référence sélectionne les sources du modèle. La cadence ne fait pas partie de cette recette.'] };
  const envoyer = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, delai = setTimeout(() => { demandes.delete(id); reject(new Error('DevTools expiré : ' + method)); }, 60000);
    demandes.set(id, { resolve, reject, delai }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluer = async expression => {
    const r = await envoyer('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value;
  };
  try {
    let port;
    for (let n = 0; n < 200 && !port; n++) { if (erreur) throw erreur; if (termine) throw new Error('Chromium arrêté : ' + stderr); try { port = +readFileSync(path.join(profil, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {} if (!port) await dormir(100); }
    if (!port) throw new Error('Port DevTools absent : ' + stderr);
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(20000) })).json();
    ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    ws.onmessage = e => { const m = JSON.parse(e.data), q = demandes.get(m.id); if (q) { demandes.delete(m.id); clearTimeout(q.delai); if (m.error) q.reject(new Error(m.error.message)); else q.resolve(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') rapport.erreurs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
    await envoyer('Runtime.enable'); await envoyer('Page.enable');
    await envoyer('Emulation.setDeviceMetricsOverride', { width: 960, height: 640, deviceScaleFactor: 1, mobile: false });
    for (const [nom, ref] of (o.reference ? [['reference', o.reference], ['candidat', null]] : [['candidat', null]])) {
      const dossier = path.join(o.sortie, nom); mkdirSync(dossier, { recursive: true });
      const page = pageBanc(ref), fichier = path.join(dossier, 'banc.html'); writeFileSync(fichier, page.html);
      const preuve = rapport.variantes[nom] = { empreintes: page.empreintes, htmlSha256: empreinte(page.html), images: [] };
      const url = pathToFileURL(fichier).href;
      await envoyer('Page.navigate', { url });
      let pret = false; for (let n = 0; n < 600 && !pret; n++) { const erreur = await evaluer('window.__PILOTE_ERREUR'); if (erreur) throw Error(erreur); pret = await evaluer(`location.href === ${JSON.stringify(url)} && !!window.__PILOTE`); if (!pret) await dormir(100); }
      if (!pret) throw new Error('Banc non prêt : ' + JSON.stringify(rapport.erreurs));
      preuve.environnement = await evaluer('__PILOTE.environnement');
      for (const scenario of scenarios) {
        const mesure = await evaluer(`__PILOTE.dessiner(${JSON.stringify(scenario)})`);
        const png = Buffer.from((await envoyer('Page.captureScreenshot', { format: 'png', fromSurface: true })).data, 'base64');
        writeFileSync(path.join(dossier, scenario.id + '.png'), png);
        preuve.images.push({ ...mesure, fichier: nom + '/' + scenario.id + '.png', sha256: empreinte(png), octets: png.length });
      }
    }
    rapport.statut = rapport.erreurs.length || Object.values(rapport.variantes).some(v => v.images.some(i => i.erreursGPU.length)) ? 'erreurs_conservees' : 'captures_a_inspecter';
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(rapport, null, 2) + '\n'); return rapport;
  } catch (e) {
    rapport.statut = 'echec_capture'; rapport.erreurs.push(String(e.message || e)); rapport.stderr = stderr;
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(rapport, null, 2) + '\n'); throw e;
  } finally {
    ws?.close(); for (const q of demandes.values()) { clearTimeout(q.delai); q.reject(new Error('Banc fermé')); }
    if (!termine) { navigateur.kill('SIGTERM'); await new Promise(r => { if (termine) r(); else navigateur.once('exit', r); }); }
    rmSync(profil, { recursive: true, force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = optionsPilote(process.argv.slice(2)), rapport = await capturerPilote(o);
  console.log(JSON.stringify({ statut: rapport.statut, variantes: Object.fromEntries(Object.entries(rapport.variantes).map(([k, v]) => [k, v.images.length])) }));
  if (rapport.statut === 'erreurs_conservees') process.exitCode = 1;
}
