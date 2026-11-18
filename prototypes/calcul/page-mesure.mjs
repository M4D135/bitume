#!/usr/bin/env node
// Lot 28 « calcul » — pilote de mesure dans la vraie page (Chrome sans interface, processeur graphique réel).
// Variante de tools/page-essai.mjs : processeur ralenti (--cpu), profileur échantillonné de V8 (--profil) dont le
// temps propre est rangé par module de la page (marques « // ---- nom ---- » de construire.py) et par fonction.
//
//   node prototypes/calcul/page-mesure.mjs --page dist/bitume.html --script essai.js [--cpu 4] [--profil oui]
//        [--taille 1440,900] [--dpr 1] [--sortie r.json] [--chrome-args "--enable-unsafe-webgpu"] [--avant prepa.js]
//
// Le script est une expression (souvent une fonction async appelée sur-le-champ) évaluée sur l'écran titre.
// Aucune fenêtre visible : ces mesures ne gênent pas l'écran de la machine.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : argv[i + 1]; };
const page = path.resolve(opt('page', 'dist/bitume.html')), fichier = opt('script');
const cpu = Number(opt('cpu', 1)), avecProfil = opt('profil', 'non') === 'oui';
const taille = String(opt('taille', '1440,900')).split(',').map(Number);
const profil = mkdtempSync(path.join(tmpdir(), 'calcul28-page-'));
writeFileSync(path.join(profil, 'Local State'), JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } }));
const args = ['--headless=new', '--no-sandbox', '--remote-debugging-port=0', '--user-data-dir=' + profil, '--window-size=' + taille.join(','), '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required'];
if (opt('chrome-args')) args.push(...opt('chrome-args').split(' ').filter(Boolean));
args.push('about:blank');
const proc = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args, { stdio: 'ignore', detached: true });
const dormir = ms => new Promise(r => setTimeout(r, ms));
let ws, suivant = 1; const req = new Map(), erreurs = [], journal = [];
const envoyer = (method, params = {}) => new Promise((ok, ko) => { const id = suivant++; req.set(id, { ok, ko }); ws.send(JSON.stringify({ id, method, params })); });
const evaluer = async e => { const r = await envoyer('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };

// bornes des modules dans la page : « <script>\n// ---- nom ---- »
const lignes = readFileSync(page, 'utf8').split('\n');
const bornes = [];
for (let i = 0; i < lignes.length; i++) { const m = /^\/\/ ---- (.+) ----$/.exec(lignes[i]); if (m) bornes.push([i, m[1]]); }
const moduleDe = (url, ligne) => {
  if (!url) return '(natif)';
  if (!url.endsWith('.html')) return url.split('/').pop() || '(autre)';
  let nom = '(page)'; for (const [l, n] of bornes) { if (l <= ligne) nom = n; else break; } return nom;
};
function depouiller(p) {
  const parId = new Map(p.nodes.map(n => [n.id, n]));
  const propre = new Map();
  for (let k = 0; k < p.samples.length; k++) { const id = p.samples[k], dt = p.timeDeltas[k + 1] ?? 0; propre.set(id, (propre.get(id) || 0) + dt); }
  const parModule = new Map(), parFonction = new Map();
  let total = 0, inactif = 0;
  for (const [id, us] of propre) {
    const n = parId.get(id), cf = n.callFrame;
    if (cf.functionName === '(idle)') { inactif += us; continue; }
    total += us;
    const mod = cf.functionName.startsWith('(') ? cf.functionName : moduleDe(cf.url, cf.lineNumber);
    parModule.set(mod, (parModule.get(mod) || 0) + us);
    const cle = mod + ' · ' + (cf.functionName || '(anonyme)') + ':' + (cf.lineNumber - (bornes.filter(b => b[0] <= cf.lineNumber).pop()?.[0] ?? 0));
    parFonction.set(cle, (parFonction.get(cle) || 0) + us);
  }
  const tri = m => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, us]) => [k, +(us / 1000).toFixed(2)]);
  return { actifMs: +(total / 1000).toFixed(1), inactifMs: +(inactif / 1000).toFixed(1), parModule: tri(parModule).slice(0, 40), parFonction: tri(parFonction).slice(0, 40) };
}

let code = 0, sortie = null;
try {
  let port = null;
  for (let i = 0; i < 300 && !port; i++) { try { port = readFileSync(path.join(profil, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await dormir(50); } }
  const cible = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
  ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && req.has(m.id)) { const q = req.get(m.id); req.delete(m.id); m.error ? q.ko(new Error(m.error.message)) : q.ok(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') erreurs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 500));
    else if (m.method === 'Runtime.consoleAPICalled') { const t = (m.params.args || []).map(a => a.value ?? a.description).join(' ').slice(0, 400); if (m.params.type === 'error') erreurs.push(t); else if (t.startsWith('[calcul]')) journal.push(t); } };
  await envoyer('Runtime.enable'); await envoyer('Page.enable');
  await envoyer('Emulation.setDeviceMetricsOverride', { width: taille[0], height: taille[1], deviceScaleFactor: Number(opt('dpr', 1)), mobile: false });
  const tNav = Date.now();
  await envoyer('Page.navigate', { url: 'file://' + page });
  const fin = Date.now() + 90000;
  for (;;) {
    const e = await evaluer(`(() => { if (!(window.BITUME_JEU && BITUME_JEU.rendu)) return null; const a = document.getElementById('autodetection'); if (a && !a.hidden) { document.getElementById('detection-annuler').click(); return 'detection'; } return BITUME_JEU.ecran; })()`).catch(() => null);
    if (e === 'titre') break; if (Date.now() > fin) throw new Error('écran titre jamais atteint'); await dormir(100);
  }
  const jusquAuTitreMs = Date.now() - tNav;
  await evaluer('BITUME_JEU.pauseAuto = false; true');
  await dormir(1000);
  if (opt('avant')) await evaluer(readFileSync(opt('avant'), 'utf8'));   // préparation hors mesure (ex. bâtir la scène)
  if (cpu > 1) await envoyer('Emulation.setCPUThrottlingRate', { rate: cpu });
  if (avecProfil) { await envoyer('Profiler.enable'); await envoyer('Profiler.setSamplingInterval', { interval: 200 }); await envoyer('Profiler.start'); }
  const valeur = await evaluer(readFileSync(fichier, 'utf8'));
  let profilV8 = null;
  if (avecProfil) { const r = await envoyer('Profiler.stop'); profilV8 = depouiller(r.profile); }
  if (cpu > 1) await envoyer('Emulation.setCPUThrottlingRate', { rate: 1 });
  sortie = { page: path.basename(page), cpu, taille, jusquAuTitreMs, valeur, profilV8, journal, erreurs };
} catch (e) { sortie = { fatal: String(e && e.stack || e), erreurs, journal }; code = 1; }
finally { try { ws && ws.close(); } catch {} try { process.kill(-proc.pid, 'SIGKILL'); } catch {} rmSync(profil, { recursive: true, force: true }); }
if (opt('sortie')) writeFileSync(opt('sortie'), JSON.stringify(sortie, null, 1));
console.log(JSON.stringify(sortie, null, 1).slice(0, Number(opt('court', 6000))));
process.exit(code);
