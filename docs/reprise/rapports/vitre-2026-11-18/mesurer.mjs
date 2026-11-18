#!/usr/bin/env node
// BITUME, lot 19 : contrôles et coût de l'effet de visière, dans Chrome sans interface (processeur graphique réel).
//   node mesurer.mjs <sortie.jsonl>
// Une ligne JSON par essai : 1. controle=sec (sans eau ni neige, l'effet rend la scène telle quelle) ; 2. controle=ips
// (même image à 30, 47, 60, 120 et 144 images par seconde) ; 3. mesure=1 (temps GPU médian de la copie, du voile et
// de l'effet, par palier, état et taille de toile). En temps réel, pas en temps virtuel : les chronomètres GPU ont besoin
// d'images réellement présentées. Aucune dépendance : Node 22 et plus (WebSocket global), comme tools/page-essai.mjs.
import { spawn } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sortie = path.resolve(process.argv[2] || 'mesures.jsonl');
const page = 'file://' + path.join(path.dirname(fileURLToPath(import.meta.url)), 'prototype.html');
const ETATS = {
  sec: 'scene=sec-cockpit&pluie=0&vitesse=180',
  'forte-pluie-250': 'scene=pluie-course&pluie=1&vitesse=250',
  grille: 'scene=pluie-grille&pluie=1&vitesse=0',
  nuage: 'scene=pluie-suivi&pluie=.7&vitesse=235&embruns=.95',
  'neige-lente': 'scene=hiver-neige&pluie=0&neige=1&vitesse=45&froid=1&humidite=.7&histoire=120'
};
const essais = [];
for (const p of ['fine', 'moyenne', 'legere', 'legere&demi=1']) essais.push([[1280, 720, 1], `${ETATS.sec}&palier=${p}&controle=sec`]);
for (const e of ['forte-pluie-250', 'grille', 'neige-lente']) essais.push([[1280, 720, 1], `${ETATS[e]}&controle=ips`]);
// Tailles de la toile : 1280 × 720, 1920 × 1080, et un écran 2× (1512 × 982 points, soit 3024 × 1964 pixels, la
// résolution de Fine sur un portable Retina : le profil Fine rend à min(devicePixelRatio, 2)).
for (const taille of [[1280, 720, 1], [1920, 1080, 1], [1512, 982, 2]])
  for (const p of ['fine', 'moyenne', 'legere', 'legere&demi=1'])
    for (const e of Object.keys(ETATS)) essais.push([taille, `${ETATS[e]}&palier=${p}&mesure=1`, e]);

const profil = mkdtempSync(path.join(tmpdir(), 'bitume-visiere-'));
writeFileSync(path.join(profil, 'Local State'), JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } }));
const proc = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new',
  '--remote-debugging-port=0', '--user-data-dir=' + profil, '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore', detached: true });
const dormir = ms => new Promise(r => setTimeout(r, ms));
let ws, suivant = 1; const req = new Map();
const envoyer = (method, params = {}) => new Promise((ok, ko) => { const id = suivant++; req.set(id, { ok, ko }); ws.send(JSON.stringify({ id, method, params })); });
const evaluer = async e => { const r = await envoyer('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.value; };
let code = 0;
writeFileSync(sortie, '');
try {
  let port = null;
  for (let i = 0; i < 300 && !port; i++) { try { port = readFileSync(path.join(profil, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await dormir(50); } }
  const cible = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
  ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && req.has(m.id)) { const q = req.get(m.id); req.delete(m.id); m.error ? q.ko(new Error(m.error.message)) : q.ok(m.result); } };
  await envoyer('Runtime.enable'); await envoyer('Page.enable');
  for (const [[l, h, dsf], params, nom] of essais) {
    await envoyer('Emulation.setDeviceMetricsOverride', { width: l, height: h, deviceScaleFactor: dsf, mobile: false });
    await envoyer('Page.navigate', { url: page + '?' + params });
    let titre = '', fin = Date.now() + 60000;
    await dormir(200);
    while (Date.now() < fin) {
      titre = await evaluer('document.readyState === "complete" ? document.title : ""').catch(() => '');
      if (titre === 'erreur' || titre === 'mesure-finie' || (titre === 'pret' && !params.includes('mesure=1'))) break;
      await dormir(100);
    }
    const texte = await evaluer('document.getElementById("journal").textContent').catch(() => '');
    let r; try { r = JSON.parse(texte); } catch { r = { erreur: String(texte || titre || 'délai dépassé').slice(0, 400) }; }
    Object.assign(r, { essai: params, etat: nom || null, fenetre: [l, h], echelle: dsf });
    const ligne = JSON.stringify(r);
    appendFileSync(sortie, ligne + '\n'); console.log(ligne.slice(0, 260));
  }
} catch (e) { console.log('fatal', e && e.stack || e); code = 1; }
finally { try { ws && ws.close(); } catch {} try { process.kill(-proc.pid, 'SIGKILL'); } catch {} rmSync(profil, { recursive: true, force: true }); }
process.exit(code);
