#!/usr/bin/env node
// Banc navigateur de BITUME : ouvre la page construite dans Chrome sans interface, conduit le jeu par le protocole
// DevTools, et rend un rapport JSON (banc, volet de mesures, erreurs de console, capture).
//
//   node tools/banc-navigateur.mjs --url file:///chemin/dist/bitume.html --duree 20 --qualite high --circuit 0
//
// Le rapport distingue ce qui est réellement mesuré de ce qui ne l'est pas : sans EXT_disjoint_timer_query_webgl2,
// le temps GPU reste N/D, et un rendu logiciel (SwiftShader) ne qualifie pas les performances d'un GPU réel.
// Aucune dépendance : Node 22 et plus suffisent (WebSocket global).

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const url = args.url;
if (!url) { console.error('usage : banc-navigateur.mjs --url <page> [--duree 20] [--qualite high] [--circuit 0] [--chauffe 1] [--overlay] [--capture fichier.png] [--chrome binaire] [--attendre 20000]'); process.exit(2); }
const mode = args.mode || 'banc';
const duree = Number(args.duree ?? 20), qualite = args.qualite || 'high', circuit = Number(args.circuit ?? 0);
const chauffe = Number(args.chauffe ?? 1), attendre = Number(args.attendre ?? 20000);
const chrome = args.chrome || process.env.CHROME || 'google-chrome';
const profil = mkdtempSync(path.join(tmpdir(), 'bitume-chrome-'));
const requetes = new Map(); let suivant = 1; let ws = null;
const evenements = { console: [], avertissements: [], exceptions: [] };

function envoyer(methode, params = {}) {
  return new Promise((resoudre, rejeter) => {
    const id = suivant++;
    requetes.set(id, { resoudre, rejeter });
    ws.send(JSON.stringify({ id, method: methode, params }));
  });
}
function attendreJusqua(teste, delai, etiquete) {
  const echeance = Date.now() + delai;
  return new Promise((resoudre, rejeter) => {
    const tourner = async () => {
      if (await teste()) return resoudre();
      if (Date.now() > echeance) return rejeter(new Error('expiré : ' + etiquete));
      setTimeout(tourner, 120);
    };
    tourner();
  });
}
async function evaluer(expression) {
  const r = await envoyer('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, allowUnsafeEvalBlocklist: true });
  if (r.exceptionDetails) throw new Error('page : ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
}

const chromeArgs = [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox',
  '--remote-debugging-port=0', '--user-data-dir=' + profil,
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=' + (args.angle || 'swiftshader'),
  '--window-size=' + (args.taille || '1390,1295'), '--hide-scrollbars', 'about:blank'
];
// groupe détaché : le navigateur lance des processus enfants qu'un simple kill du père laisserait tourner,
// et un rendu logiciel à 1000 % de CPU qui traîne fausse toutes les mesures suivantes
const processus = spawn(chrome, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'], detached: true });
let stderr = '';
processus.stderr.on('data', d => { stderr += d.toString(); });

const dormir = ms => new Promise(r => setTimeout(r, ms));
async function lirePort() {
  const f = path.join(profil, 'DevToolsActivePort');
  for (let i = 0; i < 200; i++) {
    try { const l = readFileSync(f, 'utf8').split('\n'); if (l[0] && l[1]) return { port: l[0], cible: l[1] }; } catch (e) { /* pas encore écrit */ }
    await dormir(50);
  }
  throw new Error('port DevTools introuvable\n' + stderr.slice(-800));
}

const rapport = { url, environnement: {}, banc: null, mesures: null, erreurs: [], avertissements: [], limites: [] };
let code = 0;
try {
  const { port } = await lirePort();
  const liste = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const cible = liste.find(t => t.type === 'page');
  if (!cible) throw new Error('aucune cible de page : ' + stderr.slice(-400));
  ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((resoudre, rejeter) => { ws.onopen = resoudre; ws.onerror = () => rejeter(new Error('connexion DevTools refusée')); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && requetes.has(m.id)) { const q = requetes.get(m.id); requetes.delete(m.id); m.error ? q.rejeter(new Error(m.error.message)) : q.resoudre(m.result); return; }
    if (m.method === 'Runtime.consoleAPICalled') {
      const t = (m.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(' ');
      (m.params.type === 'error' ? evenements.console : evenements.avertissements).push({ type: m.params.type, texte: String(t).slice(0, 400) });
    } else if (m.method === 'Runtime.exceptionThrown') {
      evenements.exceptions.push({ texte: String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 600) });
    }
  };
  await envoyer('Runtime.enable'); await envoyer('Page.enable');
  await envoyer('Emulation.setDeviceMetricsOverride', { width: 1390, height: 1295, deviceScaleFactor: 1, mobile: false });
  await envoyer('Page.navigate', { url });
  await attendreJusqua(() => evaluer('!!(window.BITUME && window.BITUME_JEU && window.BITUME_JEU.rendu)'), attendre, 'le jeu ne démarre pas');

  rapport.environnement = await evaluer(`(() => { const r = window.BITUME_JEU.rendu, gl = r.gl, i = gl.getExtension('WEBGL_debug_renderer_info');
    return { navigateur: navigator.userAgent, rendu: gl.getParameter(gl.RENDERER),
      nonMasque: i ? gl.getParameter(i.UNMASKED_RENDERER_WEBGL) : null, webgl2: r.stats.webglVersion === 2,
      backend: r.stats.backend, chronometrageGpu: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
      gpuModeste: window.BITUME_JEU.gpuModeste, resolution: [document.getElementById('scene').width, document.getElementById('scene').height],
      version: (document.querySelector('.version-jeu') || {}).textContent || null,
      signature: !!document.querySelector('.signature'), liensSignature: document.querySelectorAll('.marque a').length }; })()`);
  rapport.titre = await evaluer(`(() => { const t = document.getElementById('titre'); return { visible: !t.hidden,
    marque: (document.querySelector('.marque h1') || {}).textContent, signature: (document.querySelector('.signature') || {}).textContent || null }; })()`);

  if (args.overlay === 'oui') await evaluer('BITUME_JEU.mesures = true; true');
  await evaluer('BITUME_JEU.pauseAuto = false; true');
  if (args.mode === 'course') {
    // une séance réelle (démo sur le circuit choisi), avancée en simulation jusqu à l endroit voulu, puis quelques
    // secondes d images rendues : c est là que les lampes du tunnel et les rétroviseurs sont réellement dessinés
    await evaluer(`BITUME_JEU.demo(${circuit}); true`);
    if (args.avancer) await evaluer(`BITUME_JEU.avancer(${Number(args.avancer)}, true); true`);
    await evaluer('BITUME_JEU.mesures = true; true');
    await dormir(Number(args.secondes || 6) * 1000);
    rapport.seance = await evaluer(`(() => { const S = BITUME_JEU.session; if (!S) return null;
      const k = S.suivie || 0, v = S.course.voitures[k];
      return { ecran: BITUME_JEU.ecran, type: S.type, circuit: BITUME_JEU.ecran, suivie: k, s: +v.etat.s.toFixed(1),
        v: +v.etat.v.toFixed(1), vue: S.vue, dansTunnel: BITUME.circuit.dansTunnel(S.course.c, v.etat.s, 0),
        lampes: (S.lampesTunnel && S.lampesTunnel.p) ? Array.from(S.lampesTunnel.p).filter(x => x > 0).length : 0,
        sommeLampes: (S.lampesTunnel && S.lampesTunnel.p) ? +Array.from(S.lampesTunnel.p).reduce((a, x) => a + x, 0).toFixed(2) : 0,
        lumiere: +(S.lumiere || 1).toFixed(3), refletsEcran: !!S.refletsEcran }; })()`);
  } else if (args.camera) {
    // caméra d'essai placée à une abscisse voulue : c'est la caméra, et non la voiture, qui décide des lampes, de
    // l'adaptation de l'œil et de l'abri de la pluie. Le banc ne peut pas viser un endroit précis, si.
    await evaluer(`BITUME_JEU.demo(${circuit}); true`);
    await evaluer(`BITUME_JEU.reglages.vue = 'cockpit'; BITUME_JEU.camera = () => { const c = BITUME_JEU.session.course.c,
      e = BITUME.circuit.echantillon(c, ${Number(args.camera)}); return { pos: [e.x, e.y + 1.4, e.z], yaw: e.cap + Math.PI / 2, pitch: 0, fov: 60 }; }; true`);
    await evaluer('BITUME_JEU.mesures = true; true');
    await dormir(Number(args.secondes || 6) * 1000);
    rapport.seance = await evaluer(`(() => { const S = BITUME_JEU.session; if (!S) return null;
      const P = S.lampesTunnel && S.lampesTunnel.p ? Array.from(S.lampesTunnel.p) : [];
      return { ecran: BITUME_JEU.ecran, type: S.type, vue: S.vue, abscisse: ${Number(args.camera)},
        dansTunnel: BITUME.circuit.dansTunnel(S.course.c, ${Number(args.camera)}, 0),
        lampesAllumees: P.filter(x => x > 0).length, sommeLampes: +P.reduce((a, x) => a + x, 0).toFixed(2),
        lumiere: +(S.lumiere || 1).toFixed(3), refletsEcran: !!S.refletsEcran }; })()`);
  } else {
    rapport.banc = await evaluer(`BITUME_JEU.banc({ duree: ${duree}, qualite: ${JSON.stringify(qualite)}, circuit: ${circuit}, chauffe: ${chauffe} })`);
  }
  rapport.mesures = await evaluer('JSON.parse(JSON.stringify(BITUME_JEU.mesures))');
  rapport.etatCourse = await evaluer(`(() => { const S = BITUME_JEU.session; if (!S) return null; const c = S.course;
    return { ecran: BITUME_JEU.ecran, phase: c && c.phase, voitures: c && c.voitures.length, horloge: c && +c.horloge.toFixed(2) }; })()`);
  if (args.capture) {
    const s = await envoyer('Page.captureScreenshot', { format: 'png' });
    writeFileSync(args.capture, Buffer.from(s.data, 'base64'));
    rapport.capture = path.resolve(args.capture);
  }
  rapport.erreurs = evenements.console.filter(e => e.type === 'error').concat(evenements.exceptions);
  rapport.avertissements = evenements.avertissements;
  if (!rapport.environnement.chronometrageGpu) rapport.limites.push('EXT_disjoint_timer_query_webgl2 absente : le temps GPU n est pas mesurable ici, le volet affiche N/D.');
  if (/swiftshader|llvmpipe|software/i.test(String(rapport.environnement.nonMasque || rapport.environnement.rendu)))
    rapport.limites.push('Rendu logiciel (SwiftShader) : ces chiffres ne qualifient les performances d aucun GPU réel, ni d un téléphone, ni d une Xbox Edge.');
  rapport.limites.push('Une session Chrome sans interface ne prouve ni les manettes physiques, ni une vraie partie WebRTC sur plusieurs machines.');
  if (rapport.erreurs.length) code = 1;
} catch (e) {
  rapport.fatal = String(e && e.message || e);
  rapport.erreurs = evenements.console.filter(x => x.type === 'error').concat(evenements.exceptions);
  code = 1;
} finally {
  if (args.sortie) writeFileSync(args.sortie, JSON.stringify(rapport, null, 2));
  console.log(JSON.stringify(rapport, null, 2));
  try { ws && ws.close(); } catch (e) { /* déjà fermé */ }
  try { processus.kill('SIGKILL'); } catch (e) { /* déjà mort */ }
  try { process.kill(-processus.pid, 'SIGKILL'); } catch (e) { /* groupe déjà mort */ }
  rmSync(profil, { recursive: true, force: true });
}
process.exit(code);
