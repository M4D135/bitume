#!/usr/bin/env node
// Page d'essai de BITUME : ouvre la page construite dans Chrome (sans interface par défaut, processeur graphique réel),
// passe la détection graphique du premier lancement, attend l'écran titre, évalue le fichier JavaScript donné (une
// expression, ou une fonction async appelée sur-le-champ) et imprime sa valeur en JSON avec les erreurs de la console.
//
//   node tools/page-essai.mjs dist/bitume.html mon-essai.js [--capture image.png] [--taille 1440,900] [--dpr 2]
//                                                            [--fenetre] [--angle swiftshader]
//
// Sert à compter (BITUME_JEU.rendu.stats), à regarder (--capture) et à vérifier un comportement dans le vrai rendu.
// Ne sert pas à chronométrer : pour les intervalles d'image et les accrocs, voir tools/profil-accrocs.mjs.
// Aucune dépendance : Node 22 et plus (WebSocket global).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { argumentsWebGPU } from './diagnostic-webgpu.mjs';

const [page, fichier, ...reste] = process.argv.slice(2);
const opt = n => { const i = reste.indexOf('--' + n); return i < 0 ? null : (reste[i + 1] && !reste[i + 1].startsWith('--') ? reste[i + 1] : true); };
const taille = String(opt('taille') || '1440,900').split(',').map(Number), fenetre = !!opt('fenetre');
const profil = mkdtempSync(path.join(tmpdir(), 'bitume-page-'));
writeFileSync(path.join(profil, 'Local State'), JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } }));
const args = ['--no-sandbox', '--remote-debugging-port=0', '--user-data-dir=' + profil, '--window-size=' + taille.join(','), '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
if (!fenetre) args.unshift('--headless=new');
if (opt('angle')) args.push('--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=' + opt('angle'));
if (opt('webgpu-logiciel')) {
  args.push(...argumentsWebGPU('swiftshader'));
  // Le shader de démarrage travaille sur CPU sous SwiftShader. Le délai du smoke et
  // celui du job encadrent la progression ; laisser ce pilote terminer sa compilation.
  if (process.platform === 'linux') args.push('--disable-gpu-watchdog');
}
const journal = opt('journal-chrome');
if (journal) args.push('--enable-logging=stderr');
args.push('about:blank');
const fdJournal = journal ? openSync(journal, 'w') : null;
const proc = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args,
  { stdio: ['ignore', 'ignore', fdJournal ?? 'ignore'], detached: true });
if (fdJournal !== null) closeSync(fdJournal);
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
    else if (m.method === 'Runtime.exceptionThrown') erreurs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 500));
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') erreurs.push((m.params.args || []).map(a => a.value ?? a.description).join(' ').slice(0, 500)); };
  await envoyer('Runtime.enable'); await envoyer('Page.enable');
  if (!fenetre || opt('dpr')) await envoyer('Emulation.setDeviceMetricsOverride', { width: taille[0], height: taille[1], deviceScaleFactor: Number(opt('dpr') || 1), mobile: false });
  if (opt('sans-webgl')) {
    await envoyer('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      window.contextesWebGLDemandes = [];
      for (const type of [window.HTMLCanvasElement, window.OffscreenCanvas]) {
        if (!type) continue;
        const original = type.prototype.getContext;
        type.prototype.getContext = function(nom, ...args) {
          if (/webgl/i.test(nom)) { window.contextesWebGLDemandes.push(nom); throw new Error('Contexte interdit en WebGPU : ' + nom); }
          return original.call(this, nom, ...args);
        };
      }
    })()` });
  }
  await envoyer('Page.navigate', { url: page.startsWith('file:') || page.startsWith('http') ? page : 'file://' + path.resolve(page) });
  const fin = Date.now() + 60000;
  for (;;) {
    const e = await evaluer(`(() => { if (!(window.BITUME_JEU && BITUME_JEU.rendu)) return null; const a = document.getElementById('autodetection'); if (a && !a.hidden) { document.getElementById('detection-annuler').click(); return 'detection'; } return BITUME_JEU.ecran; })()`).catch(() => null);
    if (!e) {
      const message = await evaluer("document.querySelector('#erreur:not([hidden])')?.textContent");
      if (message) throw new Error(message);
    }
    if (e === 'titre') break; if (Date.now() > fin) throw new Error('écran titre jamais atteint'); await dormir(100);
  }
  await evaluer('BITUME_JEU.pauseAuto = false; true');
  const valeur = await evaluer(readFileSync(fichier, 'utf8'));
  if (opt('capture')) { const s = await envoyer('Page.captureScreenshot', { format: 'png' }); writeFileSync(opt('capture'), Buffer.from(s.data, 'base64')); }
  console.log(JSON.stringify({ valeur, erreurs }, null, 1));
} catch (e) { console.log(JSON.stringify({ fatal: String(e && e.stack || e), erreurs }, null, 1)); code = 1; }
finally { try { ws && ws.close(); } catch {} try { process.kill(-proc.pid, 'SIGKILL'); } catch {} rmSync(profil, { recursive: true, force: true }); }
process.exit(code);
