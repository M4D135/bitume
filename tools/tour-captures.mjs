#!/usr/bin/env node
// Tour de captures de BITUME : sur chaque circuit, une position tous les 400 m (abscisse 0 = ligne de départ), une
// image en vue cockpit (la vraie caméra du jeu, rivaux envoyés à l'autre bout du tour) et une image en bord de piste
// (caméra libre de spectateur, 1,6 m au-dessus du sol, à l'extérieur du virage qui suit), puis deux planches par
// circuit. Une seule session de Chrome ; horloge rAF commandée comme tools/controle-visuel.mjs : aucune de ces images
// ne mesure les performances.
//
//   node tools/tour-captures.mjs [--page dist/bitume.html] [--sortie <dossier des planches>] [--images <dossier>]
//        [--pas 400] [--taille 960,540] [--qualite high] [--saison ete] [--moment jour] [--graine 17017]
//        [--circuits val-brule,haut-col] [--abscisses 0,1200] [--injecter script.js] [--etiquette avant]
//        [--angle native|swiftshader] [--jpeg 82] [--vues cockpit,bord]
//
// --injecter évalue un script avant le chargement du jeu (prototype sans toucher aux sources, par exemple la sortie
// de tools/prototype-relief.mjs --script-page). Les images sont en JPEG ; les planches aussi, avec l'abscisse,
// l'altitude, la pente, le dévers et le rayon de chaque position. Aucune dépendance : Node 22 et plus.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { horlogeCapture } from './controle-visuel.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, defaut = null) => { const i = argv.indexOf('--' + n); return i < 0 ? defaut : argv[i + 1]; };
const page = path.resolve(opt('page', path.join(RACINE, 'dist/bitume.html')));
const sortie = path.resolve(opt('sortie', path.join(RACINE, 'docs/reprise/rapports/procedural-2026-11-18/captures')));
const dossierImages = path.resolve(opt('images', path.join(sortie, 'images')));
const pas = Number(opt('pas', 400)), taille = String(opt('taille', '960,540')).split(',').map(Number);
const qualite = opt('qualite', 'high'), saison = opt('saison', 'ete'), moment = opt('moment', 'jour');
const graine = Number(opt('graine', 17017)), jpeg = Number(opt('jpeg', 82)), etiquette = opt('etiquette', '');
const filtre = opt('circuits') ? opt('circuits').split(',') : null;
const abscissesImposees = opt('abscisses') ? opt('abscisses').split(',').map(Number) : null;
const vues = String(opt('vues', 'cockpit,bord')).split(',');
const injecter = opt('injecter') ? readFileSync(path.resolve(opt('injecter')), 'utf8') : null;
const suffixe = etiquette ? '-' + etiquette : '';
mkdirSync(sortie, { recursive: true }); mkdirSync(dossierImages, { recursive: true });

const profil = mkdtempSync(path.join(tmpdir(), 'bitume-tour-'));
writeFileSync(path.join(profil, 'Local State'), JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } }));
const args = ['--headless=new', '--no-sandbox', '--remote-debugging-port=0', '--user-data-dir=' + profil, '--window-size=' + taille.join(','),
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--allow-file-access-from-files'];
if (opt('angle') === 'swiftshader') args.push('--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader');
args.push('about:blank');
const proc = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args, { stdio: 'ignore', detached: true });
const dormir = ms => new Promise(r => setTimeout(r, ms));
let ws, suivant = 1; const req = new Map(), erreurs = [];
const envoyer = (method, params = {}) => new Promise((ok, ko) => { const id = suivant++; req.set(id, { ok, ko }); ws.send(JSON.stringify({ id, method, params })); });
const evaluer = async e => { const r = await envoyer('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };
const avancer = async (images, ms = 1000 / 60) => { for (let i = 0; i < images; i++) await evaluer(`__BITUME_CAPTURE.avancer(${ms})`); };
const capturer = async fichier => { const s = await envoyer('Page.captureScreenshot', { format: 'jpeg', quality: jpeg, captureBeyondViewport: false });
  writeFileSync(fichier, Buffer.from(s.data, 'base64')); };

// Caméra de bord de piste, évaluée dans la page : spectateur debout à l'extérieur du virage qui suit (en ligne droite,
// côté alterné), 4,5 m au-delà du bord de chaussée, regard vers l'axe 70 m plus loin. Dans le tunnel, contre le mur.
const CAMERA_BORD = `(rang) => {
  const B = BITUME, S = BITUME_JEU.session, c = S.course.c, L = c.longueur, s0 = S.reference.depart;
  const sc = (s0 + 30) % L, e = B.circuit.echantillon(c, sc);
  let k = 0; for (let ds = 20; ds <= 160; ds += 10) k += B.circuit.echantillon(c, sc + ds).courbure;
  const cote = k > 2e-3 ? -1 : k < -2e-3 ? 1 : (rang % 2 ? -1 : 1);
  const tunnel = B.circuit.dansTunnel(c, sc, 6);
  const d = cote * (tunnel ? c.largeur / 2 - .8 : c.largeur / 2 + 4.5);
  const x = e.x - Math.sin(e.cap) * d, z = e.z + Math.cos(e.cap) * d;
  const sol = BITUME_JEU.scene && BITUME_JEU.scene.decor && BITUME_JEU.scene.decor.sol ? BITUME_JEU.scene.decor.sol(x, z) : NaN;
  const y = (tunnel || !isFinite(sol) ? e.y - d * Math.sin(e.devers) : Math.max(sol, e.y - d * Math.sin(e.devers))) + 1.6;
  const f = B.circuit.echantillon(c, sc + 70), dx = f.x - x, dy = f.y + .6 - y, dz = f.z - z, dist = Math.hypot(dx, dy, dz) || 1;
  const camera = { pos: [x, y, z], yaw: Math.atan2(dx, -dz), pitch: Math.asin(Math.max(-1, Math.min(1, dy / dist))), roll: 0, fov: 58 };
  BITUME_JEU.camera = () => ({ pos: camera.pos.slice(), yaw: camera.yaw, pitch: camera.pitch, roll: 0, fov: camera.fov });
  return { cote, tunnel, sol: isFinite(sol) ? +sol.toFixed(2) : null, pos: camera.pos.map(v => +v.toFixed(1)) };
}`;
// Les rivaux partent à l'autre bout du tour : la vue reste dégagée, la course ne change pas d'état autrement.
const ECARTER_RIVAUX = `(() => { const B = BITUME, S = BITUME_JEU.session, co = S.course, c = co.c, L = c.longueur, s0 = S.reference.depart;
  co.voitures.forEach((v, n) => { if (v.joueur) return; const et = v.etat; et.s = (s0 + L / 2 + n * 14) % L; et.d = n % 2 ? 3 : -3; et.v = 0;
    const e = B.circuit.echantillon(c, et.s); et.y = e.y - et.d * Math.sin(e.devers); co.sAvant[v.id] = et.s; v.roule = et.s; });
  return co.voitures.length; })()`;
const LIRE_POSITION = `(() => { const B = BITUME, S = BITUME_JEU.session, c = S.course.c, s = S.reference.depart, e = B.circuit.echantillon(c, s);
  const j = S.course.joueur.etat;
  return { s, y: +e.y.toFixed(2), pentePct: +(e.pente * 100).toFixed(2), deversDeg: +(e.devers * 180 / Math.PI).toFixed(2),
    rayon: Math.abs(e.courbure) > 1e-5 ? Math.round(1 / Math.abs(e.courbure)) : null, sens: e.courbure > 1e-5 ? 'droite' : e.courbure < -1e-5 ? 'gauche' : '',
    vitesseRefKmh: Math.round(e.vitesse * 3.6), tunnel: B.circuit.dansTunnel(c, s, 0), joueur: { s: +j.s.toFixed(1), v: +j.v.toFixed(1) },
    palier: BITUME_JEU.palier, ecran: BITUME_JEU.ecran }; })()`;

let code = 0;
const rapport = { date: new Date().toISOString(), page, etiquette, pas, taille, qualite, saison, moment, graine, injection: !!injecter, circuits: [], erreurs };
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
  await envoyer('Emulation.setDeviceMetricsOverride', { width: taille[0], height: taille[1], deviceScaleFactor: 1, mobile: false });
  await envoyer('Page.addScriptToEvaluateOnNewDocument', { source: horlogeCapture(graine) });
  if (injecter) await envoyer('Page.addScriptToEvaluateOnNewDocument', { source: injecter });
  await envoyer('Page.navigate', { url: pathToFileURL(page).href });
  const fin = Date.now() + 90000;
  for (;;) {
    const e = await evaluer(`(() => { if (!(window.BITUME_JEU && BITUME_JEU.rendu)) return null; const a = document.getElementById('autodetection');
      if (a && !a.hidden) { document.getElementById('detection-annuler').click(); return 'detection'; } return 'pret'; })()`).catch(() => null);
    if (e === 'pret') break; if (Date.now() > fin) throw new Error('BITUME ne démarre pas'); await dormir(100);
  }
  await evaluer(`(async () => { if (window.FPhysX && FPhysX.init) { try { await FPhysX.init(); } catch {} } return true; })()`);
  await evaluer('BITUME_JEU.pauseAuto = false; true');
  // Le tableau de bord du pilote reste (volant, rétroviseurs, instruments) ; l'affichage tête haute est masqué pour
  // laisser voir les bords de piste qu'il recouvre.
  await evaluer(`(() => { const st = document.createElement('style'); st.textContent = '#hud,#h-fps,#b-pause,#tactile,#demo{visibility:hidden!important}';
    document.head.appendChild(st); return true; })()`);
  rapport.gpu = await evaluer(`(() => { const gl = BITUME_JEU.rendu.gl, i = gl.getExtension('WEBGL_debug_renderer_info'); return i ? gl.getParameter(i.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); })()`);
  const catalogue = await evaluer('BITUME_JEU.CATALOGUE.map((k, i) => ({ i, id: k.id, nom: k.nom, theme: k.theme }))');
  for (const k of catalogue) {
    if (filtre && !filtre.includes(k.id)) continue;
    const base = { graine, circuit: k.i, qualite, mode: 'solo', retro: 'oui', meteo: 'sec', moment, saison, decor: 'enrichi', tours: 3 };
    await evaluer(`BITUME_JEU.reference(${JSON.stringify({ ...base, vue: 'cockpit', depart: 0, vitesse: 0, pilote: false })}); true`);
    const L = await evaluer('BITUME_JEU.session.course.c.longueur');
    const abscisses = abscissesImposees || Array.from({ length: Math.ceil(L / pas) }, (_, n) => n * pas).filter(s => s < L);
    const fiche = { id: k.id, nom: k.nom, theme: k.theme, longueur: L, positions: [] };
    process.stderr.write(`${k.nom} : ${abscisses.length} positions\n`);
    for (const [rang, s] of abscisses.entries()) {
      const p = { rang }, nom = `${k.id}${suffixe}-${String(Math.round(s)).padStart(4, '0')}`;
      if (vues.includes('cockpit')) {
        // vue cockpit à 144 km/h, pilotée par l'IA pendant 0,13 s : le champ de vision est celui de la course
        await evaluer(`BITUME_JEU.reference(${JSON.stringify({ ...base, vue: 'cockpit', depart: s, vitesse: 40, pilote: true })}); BITUME_JEU.camera = null; true`);
        await evaluer(ECARTER_RIVAUX); await avancer(8);
        Object.assign(p, await evaluer(LIRE_POSITION));
        p.cockpit = nom + '-cockpit.jpg'; await capturer(path.join(dossierImages, p.cockpit));
      }
      if (vues.includes('bord')) {
        await evaluer(`BITUME_JEU.reference(${JSON.stringify({ ...base, vue: 'cockpit', depart: s, vitesse: 0, pilote: false })}); true`);
        await evaluer(ECARTER_RIVAUX);
        p.camera = await evaluer(`(${CAMERA_BORD})(${rang})`); await avancer(8);
        if (p.s === undefined) Object.assign(p, await evaluer(LIRE_POSITION));
        p.bord = nom + '-bord.jpg'; await capturer(path.join(dossierImages, p.bord));
        await evaluer('BITUME_JEU.camera = null; true');
      }
      fiche.positions.push(p);
    }
    rapport.circuits.push(fiche);
  }
  // Planches : une par circuit et par vue, quatre colonnes, légende chiffrée sous chaque image.
  const nf = (v, d = 0) => v === null || v === undefined ? '–' : Number(v).toFixed(d).replace('-', '−').replace('.', ',');
  const colonnes = 4, lv = 400, hv = Math.round(lv * taille[1] / taille[0]), hl = 34, marge = 10, entete = 46;
  rapport.planches = [];
  for (const f of rapport.circuits) for (const vue of vues) {
    const lignes = Math.ceil(f.positions.length / colonnes), W = colonnes * (lv + marge) + marge, H = entete + lignes * (hv + hl + marge) + marge;
    const relatif = path.relative(sortie, dossierImages).split(path.sep).join('/');
    const cases = f.positions.map(p => `<figure><img src="${relatif}/${p[vue]}"><figcaption><b>s = ${nf(p.s)} m</b> · alt. ${nf(p.y, 1)} m · pente ${nf(p.pentePct, 1)} % · dévers ${nf(p.deversDeg, 1)}°<br>${p.rayon && p.rayon < 900 ? 'R ' + nf(p.rayon) + ' m ' + p.sens : 'ligne droite'} · réf. ${nf(p.vitesseRefKmh)} km/h${p.tunnel ? ' · tunnel' : ''}${vue === 'bord' && p.camera ? ' · caméra ' + (p.camera.cote > 0 ? 'à droite' : 'à gauche') : ''}</figcaption></figure>`).join('');
    const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><style>body{margin:0;background:#15191e;color:#e6ebf1;font:12px/1.35 -apple-system,system-ui,sans-serif;width:${W}px}
      h1{font-size:17px;margin:0;padding:12px ${marge}px 0;height:${entete - 12}px;font-weight:600}h1 span{color:#9aa6b2;font-weight:400}
      .g{display:grid;grid-template-columns:repeat(${colonnes},${lv}px);gap:${marge}px;padding:0 ${marge}px ${marge}px}figure{margin:0}img{display:block;width:${lv}px;height:${hv}px}
      figcaption{height:${hl}px;padding-top:3px;color:#c7d0d9}b{color:#fff}</style>
      <h1>${f.nom} (${f.theme}) — vue ${vue === 'bord' ? 'bord de piste' : 'cockpit'}${etiquette ? ' — ' + etiquette : ''} <span>· tous les ${pas} m · ${nf(f.longueur)} m · ${qualite}, ${saison}, ${moment}</span></h1><div class="g">${cases}</div></html>`;
    const fichierHtml = path.join(sortie, `.planche-${f.id}-${vue}${suffixe}.html`);
    writeFileSync(fichierHtml, html);
    await envoyer('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await envoyer('Page.navigate', { url: pathToFileURL(fichierHtml).href }); await dormir(900);
    const nomPlanche = `planche-${f.id}-${vue}${suffixe}.jpg`;
    const s = await envoyer('Page.captureScreenshot', { format: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    writeFileSync(path.join(sortie, nomPlanche), Buffer.from(s.data, 'base64'));
    rmSync(fichierHtml); rapport.planches.push(nomPlanche);
  }
  writeFileSync(path.join(sortie, `tour${suffixe}.json`), JSON.stringify(rapport, null, 1) + '\n');
  console.log(JSON.stringify({ sortie, images: dossierImages, planches: rapport.planches.length, positions: rapport.circuits.reduce((a, f) => a + f.positions.length, 0), gpu: rapport.gpu, erreurs: erreurs.slice(0, 10) }, null, 1));
} catch (e) { console.log(JSON.stringify({ fatal: String(e && e.stack || e), erreurs: erreurs.slice(0, 10) }, null, 1)); code = 1; }
finally { try { ws && ws.close(); } catch {} try { process.kill(-proc.pid, 'SIGKILL'); } catch {} rmSync(profil, { recursive: true, force: true }); }
process.exit(code);
