#!/usr/bin/env node
/* BITUME — lot 22F : captures dans le vrai rendu, pour juger sur image (aucune mesure de performance ici : l'horloge
   est réelle et les images sont prises quand la scène est posée).

     node tools/lieux-captures.mjs <page.html> [--sortie dossier] [--circuits 0,2,4] [--qualite high]
          [--taille 960,540] [--jpeg 84] [--trace haut-col] [--vues bords|lieux] [--sans-images]

   Une planche par circuit (<id>-planche.jpg, trois vues par rangée avec l'abscisse, l'altitude et la pente) ;
   --sans-images ne garde que les planches et le rapport JSON.

   --vues bords (défaut) : sur chaque circuit du catalogue, l'approche et l'intérieur de chaque bord dangereux, la plus
   longue série de bandeaux, un grand panneau et la passerelle. La page doit être construite avec src/bords.js branché
   (integration.patch du rapport) ; sinon il n'y a rien à montrer et l'outil le dit.
   --trace <id> : avant le chargement du jeu, remplace le circuit de même graine par le tracé proposé de
   tools/lieux-partitions.mjs (construit par tools/lieux-trace.mjs, la même source qu'en Node) ; --vues lieux prend
   alors une vue par lieu nommé, par passage couvert et par pont. Les sources du jeu ne sont pas touchées.
   Une seule session de Chrome, profil jetable ; aucune dépendance (Node 22 et plus). */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fabriqueTrace } from './lieux-trace.mjs';
import { PARTITION } from './lieux-partitions.mjs';

const argv = process.argv.slice(2), page = argv[0];
const opt = (k, d = null) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
if (!page) { console.error('usage : node tools/lieux-captures.mjs <page.html> [--sortie dossier] [--circuits 0,2] [--trace haut-col] [--vues bords|lieux]'); process.exit(2); }
const sortie = path.resolve(opt('sortie', 'docs/reprise/rapports/lieux-2026-11-18/captures'));
const taille = String(opt('taille', '960,540')).split(',').map(Number), jpeg = Number(opt('jpeg', 84)), qualite = opt('qualite', 'high');
const trace = opt('trace'), vuesVoulues = opt('vues', trace ? 'lieux' : 'bords');
const circuits = opt('circuits') ? opt('circuits').split(',').map(Number) : null;
mkdirSync(sortie, { recursive: true });

// Injection du tracé proposé : la fabrique est autonome (sérialisée telle quelle), la partition est une donnée.
function scriptTrace(id) {
  const p = PARTITION[id];
  if (!p) throw new Error('partition inconnue : ' + id);
  return `/* lot 22F : tracé proposé « ${p.nom} » injecté (tools/lieux-captures.mjs), sources du jeu intactes */
(() => {
  const TRACE = (${fabriqueTrace.toString()})(), PARTITION = ${JSON.stringify(p)};
  const B = globalThis.BITUME = globalThis.BITUME || {};
  let reel;
  Object.defineProperty(B, 'circuit', { configurable: true, enumerable: true, get() { return reel; }, set(v) {
    const creer = v.creer;
    v.creer = function (graine, options) {
      if (graine !== PARTITION.graine) return creer.call(this, graine, options);
      try { const c = TRACE.construire(PARTITION); c.vitesse = c.vitesseP9; return c; }   // l'IA du jeu reste réglée sur p9
      catch (e) { console.error('tracé 22F', e); return creer.call(this, graine, options); }
    };
    reel = v;
  } });
})();`;
}

// Vues calculées dans la page à partir du circuit installé : { nom, s, d, h (caméra), sc, dc, hc (cible), fov }.
// d > 0 à droite de la piste. Une vue « haut » place la caméra à une hauteur absolue au-dessus d'un point.
const VUES = `(mode) => {
  const B = BITUME, c = BITUME_JEU.session.course.c, w = c.largeur / 2, L = c.longueur, vues = [];
  const lim = (s, cote) => B.circuit.limiteA ? B.circuit.limiteA(c, s, cote) : c.limite;
  if (mode === 'bords') {
    if (!B.bords) return { erreur: 'bords.js absent de la page' };
    const plan = B.bords.planifier(c);
    for (const d of plan.dangers.slice(0, 4)) {
      const k = d.type + '-' + (d.cote < 0 ? 'g' : 'd') + '-' + Math.round(d.debut);
      vues.push({ nom: 'danger-' + k + '-approche', s: d.debut - 150, d: -d.cote * 1.5, h: 1.15, sc: d.debut - 20, dc: d.cote * (w + 1), hc: 1.2, fov: 52 });
      vues.push({ nom: 'danger-' + k + '-portion', s: d.debut + 25, d: -d.cote * 2, h: 1.15, sc: d.debut + 95, dc: d.cote * (w + 2.5), hc: .9, fov: 62 });
      const m = (d.debut + d.fin) / 2;
      vues.push({ nom: 'danger-' + k + '-travers', s: m - 45, d: -d.cote * (w + 5), h: 5, sc: m + 15, dc: d.cote * (w + 2), hc: .8, fov: 50 });
    }
    const series = []; let prec = null;
    for (const b of plan.bandeaux) { if (!prec || b.cote !== prec.cote || b.i !== prec.i + 4) series.push({ s: b.i * c.pas, cote: b.cote, n: 1 }); else series[series.length - 1].n++; prec = b; }
    series.sort((a, b) => b.n - a.n);
    for (const sr of series.slice(0, 2)) vues.push({ nom: 'bandeaux-' + Math.round(sr.s), s: sr.s - 40, d: -sr.cote * 2.5, h: 1.15, sc: sr.s + 4 * sr.n, dc: sr.cote * lim(sr.s, sr.cote), hc: 1.3, fov: 48 });
    for (const a of plan.affiches.slice(0, 1)) vues.push({ nom: 'affiche-' + Math.round(a.s), s: a.s - 75, d: -a.cote * 2, h: 1.15, sc: a.s, dc: a.cote * (lim(a.s, a.cote) + 3.5), hc: 3.4, fov: 46 });
    for (const p of plan.passerelles) vues.push({ nom: 'passerelle-' + Math.round(p.s), s: p.s - 120, d: -2, h: 1.15, sc: p.s, dc: 0, hc: 6.5, fov: 50 });
  } else {
    // centre de la boucle (pour survoler un lieu par l'extérieur) et centre d'un lieu
    let gx = 0, gz = 0, ng = 0; for (let i = 0; i < c.n; i += 10) { gx += c.x[i]; gz += c.z[i]; ng++; } gx /= ng; gz /= ng;
    const centre = (a, b) => { let x = 0, y = 0, z = 0, k = 0; for (let s = a; s <= b; s += 10) { const e = B.circuit.echantillon(c, s); x += e.x; y += e.y; z += e.z; k++; } return [x / k, y / k, z / k]; };
    for (const l of c.lieux || []) {
      // vue de pilote ; une rampe (plus de 10 %) se regarde de son pied, voiture encore à plat, regard 140 m plus haut
      let s = l.debut + Math.min(60, (l.fin - l.debut) * .2), sc = s + 110;
      for (let x = l.debut; x < l.fin; x += 4) if (B.circuit.echantillon(c, x).pente > .1) { s = x - 25; sc = x + 140; break; }
      vues.push({ nom: 'lieu-' + l.n + '-' + l.nom, s, d: 0, h: 1.15, sc, dc: 0, hc: 1, fov: 60 });
      // survol : de l'extérieur de la boucle, en surplomb, regard sur le centre du lieu
      const m = centre(l.debut, l.fin), e0 = B.circuit.echantillon(c, l.debut), e1 = B.circuit.echantillon(c, l.fin);
      let px = -(e1.z - e0.z), pz = e1.x - e0.x; const nn = Math.hypot(px, pz) || 1; px /= nn; pz /= nn;
      if ((m[0] - gx) * px + (m[2] - gz) * pz < 0) { px = -px; pz = -pz; }
      const R = Math.max(140, Math.min(320, (l.fin - l.debut) * .4));
      vues.push({ nom: 'survol-' + l.n + '-' + l.nom, s: l.debut, sc: l.debut, pos: [m[0] + px * R, m[1] + R * .6, m[2] + pz * R], cible: m, fov: 52 });
    }
    for (const t of c.couverts || []) vues.push({ nom: 'couvert-' + t.nom, s: t.debut - 90, d: -1.5, h: 1.15, sc: t.debut + 10, dc: 0, hc: 2.5, fov: 55 });
    for (const t of c.ponts || []) vues.push({ nom: 'pont-' + t.nom, s: (t.debut + t.fin) / 2, d: 40, h: -12, haut: true, sc: (t.debut + t.fin) / 2, dc: 0, hc: 0, fov: 55 });
    for (const t of c.bords || []) vues.push({ nom: 'bord-' + t.nom + '-' + Math.round(t.debut), s: t.debut + 20, d: (t.cote === 'G' ? 1 : -1) * 2, h: 1.15, sc: t.debut + 100, dc: (t.cote === 'G' ? -1 : 1) * (w + 2), hc: .9, fov: 62 });
  }
  return vues.map(v => Object.assign(v, { s: ((v.s % L) + L) % L, sc: ((v.sc % L) + L) % L }));
}`;

// Pose une vue : rivaux à l'autre bout du tour et arrêtés, caméra libre, quelques images pour que tout soit posé.
const POSER = `async (v) => {
  const B = BITUME, J = BITUME_JEU, S = J.session, co = S.course, c = co.c, L = c.longueur;
  // l'affichage de course masqué : on regarde le décor
  for (const id of ['hud', 'h-fps', 'b-pause', 'tactile', 'zone-carte', 'classement']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; }
  co.voitures.forEach((x, k) => { const e = x.etat; e.s = (v.s + L / 2 + 14 * k) % L; e.v = 0; e.d = (k % 2 ? -3 : 3); });
  const pos = v.pos || (v.haut ? (() => { const q = B.circuit.point(c, v.s, v.d, 0); q[1] -= v.h; return q; })() : B.circuit.point(c, v.s, v.d, v.h));
  const cible = v.cible || B.circuit.point(c, v.sc, v.dc, v.hc), dx = cible[0] - pos[0], dy = cible[1] - pos[1], dz = cible[2] - pos[2], dist = Math.hypot(dx, dy, dz);
  J.camera = () => ({ pos, yaw: Math.atan2(dx, -dz), pitch: Math.asin(dy / dist), fov: v.fov });
  await new Promise(r => { let k = 0; const f = () => (++k > 12 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  await new Promise(r => setTimeout(r, 250));
  const e = B.circuit.echantillon(c, v.s);
  return { y: +e.y.toFixed(1), pente: +(e.pente * 100).toFixed(1), rayon: Math.abs(e.courbure) > 1e-6 ? Math.round(1 / Math.abs(e.courbure)) : null };
}`;

const profil = mkdtempSync(path.join(tmpdir(), 'bitume-lieux-'));
writeFileSync(path.join(profil, 'Local State'), JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } }));
const args = ['--headless=new', '--no-sandbox', '--remote-debugging-port=0', '--user-data-dir=' + profil, '--window-size=' + taille.join(','), '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'];
const proc = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args, { stdio: 'ignore', detached: true });
const dormir = ms => new Promise(r => setTimeout(r, ms));
let ws, suivant = 1; const req = new Map(), erreurs = [];
const envoyer = (method, params = {}) => new Promise((ok, ko) => { const id = suivant++; req.set(id, { ok, ko }); ws.send(JSON.stringify({ id, method, params })); });
const evaluer = async e => { const r = await envoyer('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };
const rapport = { date: new Date().toISOString(), page: path.relative(process.cwd(), path.resolve(page)), qualite, taille, trace, vues: vuesVoulues, images: [], erreurs };
let code = 0;
try {
  let port = null;
  for (let i = 0; i < 300 && !port; i++) { try { port = readFileSync(path.join(profil, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await dormir(50); } }
  const cible = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
  ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && req.has(m.id)) { const q = req.get(m.id); req.delete(m.id); m.error ? q.ko(new Error(m.error.message)) : q.ok(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') erreurs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 400));
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') erreurs.push((m.params.args || []).map(a => a.value ?? a.description).join(' ').slice(0, 400)); };
  await envoyer('Runtime.enable'); await envoyer('Page.enable');
  await envoyer('Emulation.setDeviceMetricsOverride', { width: taille[0], height: taille[1], deviceScaleFactor: 1, mobile: false });
  if (trace) await envoyer('Page.addScriptToEvaluateOnNewDocument', { source: scriptTrace(trace) });
  await envoyer('Page.navigate', { url: 'file://' + path.resolve(page) });
  const fin = Date.now() + 90000;
  for (;;) {
    const e = await evaluer(`(() => { if (!(window.BITUME_JEU && BITUME_JEU.rendu)) return null; const a = document.getElementById('autodetection'); if (a && !a.hidden) { document.getElementById('detection-annuler').click(); return 'detection'; } return BITUME_JEU.ecran; })()`).catch(() => null);
    if (e === 'titre') break; if (Date.now() > fin) throw new Error('écran titre jamais atteint'); await dormir(100);
  }
  await evaluer('BITUME_JEU.pauseAuto = false; true');
  const catalogue = await evaluer('BITUME_JEU.CATALOGUE.map(k => ({ id: k.id, nom: k.nom, graine: k.graine }))');
  const liste = circuits || (trace ? [catalogue.findIndex(k => k.graine === PARTITION[trace].graine)] : catalogue.map((k, i) => i));
  for (const i of liste) {
    const t0 = Date.now();
    await evaluer(`BITUME_JEU.reference({ circuit: ${i}, qualite: ${JSON.stringify(qualite)}, vue: 'poursuite', vitesse: 0, pilote: false, saison: 'ete', moment: 'jour', meteo: 'sec' }); true`);
    const installation = Date.now() - t0;
    const vues = await evaluer(`(${VUES})(${JSON.stringify(vuesVoulues)})`);
    if (!Array.isArray(vues)) { rapport.images.push({ circuit: catalogue[i].id, ...vues }); console.log(catalogue[i].nom + ' : ' + JSON.stringify(vues)); continue; }
    for (const v of vues) {
      const info = await evaluer(`(${POSER})(${JSON.stringify(v)})`);
      const nom = `${catalogue[i].id}-${v.nom}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase() + '.jpg';
      const s = await envoyer('Page.captureScreenshot', { format: 'jpeg', quality: jpeg });
      writeFileSync(path.join(sortie, nom), Buffer.from(s.data, 'base64'));
      rapport.images.push({ circuit: catalogue[i].id, fichier: nom, s: Math.round(v.s), ...info, installationMs: installation });
      console.log(nom, JSON.stringify(info));
    }
    await evaluer('BITUME_JEU.camera = null; true');
  }
  // planches : une page de vignettes par circuit, photographiée dans la même session
  const parCircuit = new Map();
  for (const im of rapport.images) if (im.fichier) { if (!parCircuit.has(im.circuit)) parCircuit.set(im.circuit, []); parCircuit.get(im.circuit).push(im); }
  for (const [id, ims] of parCircuit) {
    const lignes = Math.ceil(ims.length / 3), H = 52 + lignes * 388, nomCircuit = catalogue.find(k => k.id === id).nom;
    const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#1b1d20;color:#e9e7e2;font:14px -apple-system,Helvetica,Arial,sans-serif">
<div style="padding:14px 16px 0;font-size:19px;font-weight:600">${nomCircuit} — ${trace ? 'tracé proposé (lot 22F)' : 'bords de route (lot 22F)'} · ${qualite}</div>
<div style="display:grid;grid-template-columns:repeat(3,640px);gap:6px;padding:10px 6px">${ims.map(im => `<div><img src="${im.fichier}" width="640" height="360" style="display:block"><div style="padding:3px 2px;color:#bdb9b1">${im.fichier.replace(id + '-', '').replace('.jpg', '')} · s ${im.s} m · y ${im.y} m · pente ${im.pente} %</div></div>`).join('')}</div>`;
    const fichierHtml = path.join(sortie, '_planche-' + id + '.html');
    writeFileSync(fichierHtml, html);
    await envoyer('Emulation.setDeviceMetricsOverride', { width: 1938, height: H, deviceScaleFactor: 1, mobile: false });
    await envoyer('Page.navigate', { url: 'file://' + fichierHtml });
    await dormir(800);
    const s = await envoyer('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
    writeFileSync(path.join(sortie, id + (trace ? '-trace' : '') + '-planche.jpg'), Buffer.from(s.data, 'base64'));
    rmSync(fichierHtml);
    if (argv.includes('--sans-images')) for (const im of ims) rmSync(path.join(sortie, im.fichier));
  }
} catch (e) { rapport.fatal = String(e && e.stack || e); console.error(rapport.fatal); code = 1; }
finally {
  try { ws && ws.close(); } catch {} try { process.kill(-proc.pid, 'SIGKILL'); } catch {} rmSync(profil, { recursive: true, force: true });
  writeFileSync(path.join(sortie, (trace ? 'trace-' + trace : 'bords') + '.json'), JSON.stringify(rapport, null, 1) + '\n');
  if (erreurs.length) console.error('erreurs de la page :\n' + erreurs.join('\n'));
}
process.exit(code);
