#!/usr/bin/env node
// Allocations par image dans la vraie page (Chrome sans fenêtre, carte graphique réelle) : ouvre la page construite,
// lance une séance de référence (BITUME_JEU.reference), laisse passer des images de chauffe, puis échantillonne le tas
// (HeapProfiler.startSampling, CDP) pendant N images et range les octets par fonction (nom et ligne de la page).
//
//   node allocations-page.mjs page.html '{"circuit":0,"qualite":"high","vue":"cockpit","retro":"non"}' [images] [--taille 1440,757] [--dpr 2] [--intervalle 512] [--chauffe 240]
// (intervalle d'échantillonnage en octets : 32 ralentissait tant les images que la course finissait avant la fin du relevé)
//
// Rend en JSON : images, octets par image, et les fonctions qui allouent (nom:ligne → octets par image).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [page, refTexte, imagesTexte, ...reste] = process.argv.slice(2);
const opt = n => { const i = reste.indexOf('--' + n); return i < 0 ? null : reste[i + 1]; };
const taille = String(opt('taille') || '1440,757').split(',').map(Number), images = Number(imagesTexte || 300);
const profil = mkdtempSync(path.join(tmpdir(), 'bitume-alloc-'));
writeFileSync(path.join(profil, 'Local State'), JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } }));
const args = ['--headless=new', '--no-sandbox', '--remote-debugging-port=0', '--user-data-dir=' + profil, '--window-size=' + taille.join(','), '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'];
const proc = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args, { stdio: 'ignore', detached: true });
const dormir = ms => new Promise(r => setTimeout(r, ms));
let ws, suivant = 1; const req = new Map(), erreurs = [];
const envoyer = (method, params = {}) => new Promise((ok, ko) => { const id = suivant++; req.set(id, { ok, ko }); ws.send(JSON.stringify({ id, method, params })); });
const evaluer = async e => { const r = await envoyer('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };
let code = 0;
try {
  let port = null;
  for (let i = 0; i < 300 && !port; i++) { try { port = readFileSync(path.join(profil, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await dormir(50); } }
  const cible = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
  ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && req.has(m.id)) { const q = req.get(m.id); req.delete(m.id); m.error ? q.ko(new Error(m.error.message)) : q.ok(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') erreurs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 500)); };
  await envoyer('Runtime.enable'); await envoyer('Page.enable'); await envoyer('HeapProfiler.enable');
  await envoyer('Emulation.setDeviceMetricsOverride', { width: taille[0], height: taille[1], deviceScaleFactor: Number(opt('dpr') || 1), mobile: false });
  await envoyer('Page.navigate', { url: 'file://' + path.resolve(page) });
  const fin = Date.now() + 60000;
  for (;;) {
    const e = await evaluer(`(() => { if (!(window.BITUME_JEU && BITUME_JEU.rendu)) return null; const a = document.getElementById('autodetection'); if (a && !a.hidden) { document.getElementById('detection-annuler').click(); return 'detection'; } return BITUME_JEU.ecran; })()`).catch(() => null);
    if (e === 'titre') break; if (Date.now() > fin) throw new Error('écran titre jamais atteint'); await dormir(100);
  }
  const attendreImages = n => `new Promise(r => { let k = 0; const f = () => (++k >= ${n} ? r(true) : requestAnimationFrame(f)); requestAnimationFrame(f); })`;
  await evaluer(`BITUME_JEU.pauseAuto = false; BITUME_JEU.reference(${refTexte}); ${attendreImages(Number(opt('chauffe') || 240))}`);
  const d0 = await evaluer('BITUME_JEU.rendu.stats.creations');
  await envoyer('HeapProfiler.collectGarbage');
  await envoyer('HeapProfiler.startSampling', { samplingInterval: Number(opt('intervalle') || 512), includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  const t0 = Date.now();
  await evaluer(attendreImages(images));
  const duree = Date.now() - t0;
  const { profile } = await envoyer('HeapProfiler.stopSampling');
  const etat = await evaluer('({ ecran: BITUME_JEU.ecran, horloge: +BITUME_JEU.session.course.horloge.toFixed(1), moteur: window.FERRO && FERRO.version, photo: BITUME_JEU.rendu.stats.ombresPhoto ? Object.assign({}, BITUME_JEU.rendu.stats.ombresPhoto) : null, creations: BITUME_JEU.rendu.stats.creations, toile: BITUME_JEU.rendu.gl.drawingBufferWidth + "x" + BITUME_JEU.rendu.gl.drawingBufferHeight })');
  const parFonction = {}; let total = 0;
  const visiter = n => {
    if (n.selfSize) { const cle = (n.callFrame.functionName || '(anonyme)') + ':' + (n.callFrame.lineNumber + 1); parFonction[cle] = (parFonction[cle] || 0) + n.selfSize; total += n.selfSize; }
    for (const c of n.children) visiter(c);
  };
  visiter(profile.head);
  const fonctions = Object.entries(parFonction).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / images).toFixed(1)]);
  console.log(JSON.stringify({ valeur: { ...etat, images, dureeMs: duree, creationsAvant: d0, octetsParImage: +(total / images).toFixed(1), fonctions }, erreurs }, null, 1));
} catch (e) { console.log(JSON.stringify({ fatal: String(e && e.stack || e), erreurs }, null, 1)); code = 1; }
finally { try { ws && ws.close(); } catch {} try { process.kill(-proc.pid, 'SIGKILL'); } catch {} rmSync(profil, { recursive: true, force: true }); }
process.exit(code);
