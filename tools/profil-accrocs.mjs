#!/usr/bin/env node
import { environnementWebGPU, argumentsWebGPU } from './diagnostic-webgpu.mjs';
// Profil des accrocs de BITUME : ouvre la page construite dans Chrome, lance une course comme le fait un joueur
// (ou une séance de référence), relève l'intervalle de CHAQUE image et attribue chaque image longue à sa cause grâce
// à la trace de Chrome (tâche du fil principal, ramasse-miettes, compilation de shaders dans le processus graphique).
//
//   node tools/profil-accrocs.mjs --url file:///chemin/dist/bitume.html --scenario depart --circuit 0 --duree 20
//
// Scénarios :
//   depart    : chemin réel du joueur (titre → préparation → départ), feux compris, la voiture confiée à l'ordinateur ;
//   reference : BITUME_JEU.reference(...), course déjà lancée à 75 m/s, qualité fixe.
// Options : --qualite high|medium|low|auto  --meteo soleil|pluie|…  --vue cockpit|poursuite  --retro oui|non
//           --partie solo|duo  --cpu 4 (ralentit le processeur 4 fois : petite machine)  --taille 1390,1295
//           --fenetre oui (navigateur visible : vraie synchronisation verticale de l'écran)  --dpr 2 (densité de pixels imposée)
//           --detection oui (laisse la détection graphique du premier lancement aller au bout et la rapporte)
//           --economie oui (garde l'économie d'énergie de Chrome : 30 images par seconde sur batterie faible)
//           --mesures non (volet de mesures fermé : ses chronomètres GPU ont un coût)
//           --trace non (sans attribution)  --capture fichier.png  --sortie rapport.json
//           --angle swiftshader (rendu logiciel ; le défaut est le processeur graphique de la machine)
//
// Ce que le rapport mesure : des intervalles entre images sur CETTE machine, dans CE navigateur. Sans interface, Chrome
// cadence à 60 Hz sans écran réel : les accrocs du fil principal et du processus graphique s'y voient, la
// synchronisation verticale d'un écran à 120 ou 144 Hz ne s'y voit pas.
// Aucune dépendance : Node 22 et plus (WebSocket global).

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.url) { console.error('usage : profil-accrocs.mjs --url <page> [--scenario depart|reference] [--circuit 0] [--duree 20] [--qualite high] [--meteo soleil] [--vue cockpit] [--retro oui] [--partie solo|duo] [--cpu 1] [--taille 1390,1295] [--fenetre non] [--trace oui] [--capture f.png] [--sortie f.json] [--chrome binaire] [--angle native]'); process.exit(2); }
const scenario = args.scenario || 'depart';
const duree = Number(args.duree ?? 20), circuit = Number(args.circuit ?? 0), cpu = Number(args.cpu ?? 1);
const taille = (args.taille || '1390,1295').split(/[x,]/).map(Number);
const avecTrace = args.trace !== 'non';
const chrome = args.chrome || process.env.CHROME || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const jeuOptions = { circuit, qualite: args.qualite || 'high', meteo: args.meteo || 'soleil', vue: args.vue || 'cockpit', vue2: args.vue2 || 'cockpit',
  retro: args.retro || 'oui', mode: args.partie || 'solo', partage: args.partage || 'haut-bas', graine: Number(args.graine ?? 17017),
  saison: args.saison || 'ete', moment: args.moment || 'jour', tours: Number(args.tours ?? 3) };
if (args.depart !== undefined) jeuOptions.depart = args.depart === 'tunnel' ? 'tunnel' : Number(args.depart);
// --options '{"vegetation":"off","ombres":"off"}' : réglages indépendants du menu (anticrenelage, ombres, vegetation, faune…)
const optionsLibres = args.options ? JSON.parse(args.options) : {};
Object.assign(jeuOptions, optionsLibres);

const profil = mkdtempSync(path.join(tmpdir(), 'bitume-profil-'));
// Sur batterie faible, Chrome passe en économie d'énergie et bride l'affichage à 30 images par seconde : la mesure
// dirait alors 33 ms quelle que soit la charge. --economie oui garde ce bridage (cas réel d'un portable) ; par défaut
// il est coupé dans ce profil jetable pour mesurer la machine, pas le réglage d'alimentation.
if (args.economie !== 'oui') writeFileSync(path.join(profil, 'Local State'), JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } }));
const requetes = new Map(); let suivant = 1, ws = null;
const journal = { erreurs: [], exceptions: [] };
const trace = { evenements: [], fini: null, recus: 0 };
const dormir = ms => new Promise(r => setTimeout(r, ms));

function envoyer(methode, params = {}, delai = 120000) {
  return new Promise((resoudre, rejeter) => {
    const id = suivant++;
    const minuteur = setTimeout(() => { requetes.delete(id); rejeter(new Error('DevTools expiré : ' + methode)); }, delai);
    requetes.set(id, { resoudre, rejeter, minuteur });
    ws.send(JSON.stringify({ id, method: methode, params }));
  });
}
async function evaluer(expression, delai) {
  const r = await envoyer('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, delai);
  if (r.exceptionDetails) throw new Error('page : ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
}
async function attendre(teste, delai, etiquette) {
  const echeance = Date.now() + delai;
  while (!await teste()) { if (Date.now() > echeance) throw new Error('expiré : ' + etiquette); await dormir(100); }
}
// La trace complète pèse des centaines de mégaoctets : on ne garde que ce qui sert à l'attribution.
const GARDE = /GC|Compile|Optimize|Link|Program|Shader|Pipeline|Texture|Upload|Buffer|Layout|Paint|Commit|RunTask|FunctionCall|FireAnimationFrame|Evaluate|Timer|Event|Parse|Wasm|Raster|Swap|Flush|Draw|Decode/i;
function garder(e) {
  if (e.ph === 'M') return true;
  if (e.cat && e.cat.includes('blink.user_timing')) return true;
  if (e.ph === 'X') return e.dur >= 400 && (e.dur >= 1500 || GARDE.test(e.name));
  if (e.ph === 'B' || e.ph === 'E') return GARDE.test(e.name || '') || (e.cat && e.cat.includes('gpu'));
  return false;
}

const chromeArgs = ['--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0', '--user-data-dir=' + profil,
  '--window-size=' + taille.join(','), '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--autoplay-policy=no-user-gesture-required'];
if (args.fenetre !== 'oui') chromeArgs.unshift('--headless=new');
chromeArgs.push(...argumentsWebGPU(args.angle || 'native'));
chromeArgs.push('about:blank');
const processus = spawn(chrome, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'], detached: true });
let stderr = '', lancementErreur = null;
processus.stderr.on('data', d => { stderr += d.toString(); if (stderr.length > 20000) stderr = stderr.slice(-10000); });
processus.on('error', e => { lancementErreur = e; });
async function lirePort() {
  const f = path.join(profil, 'DevToolsActivePort');
  for (let i = 0; i < 300; i++) {
    if (lancementErreur) throw lancementErreur;
    try { const l = readFileSync(f, 'utf8').split('\n'); if (l[0] && l[1]) return l[0]; } catch (e) { /* pas encore écrit */ }
    await dormir(50);
  }
  throw new Error('port DevTools introuvable\n' + stderr.slice(-800));
}

// Relevé dans la page : horodatage de chaque image, tâches longues et images longues (attribution du navigateur).
const RELEVE = `(() => {
  const R = window.__releve = { t: new Float64Array(200000), n: 0, marche: true, longues: [], loaf: [], ecrans: [], t0: performance.now() };
  const tour = t => { if (!R.marche) return; if (R.n < R.t.length) R.t[R.n++] = t; requestAnimationFrame(tour); };
  requestAnimationFrame(tour);
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) R.longues.push([+e.startTime.toFixed(1), +e.duration.toFixed(1)]); }).observe({ type: 'longtask', buffered: false }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) R.loaf.push({ t: +e.startTime.toFixed(1), d: +e.duration.toFixed(1), bloc: +e.blockingDuration.toFixed(1),
      rendu: +(e.renderStart - e.startTime).toFixed(1), style: +(e.styleAndLayoutStart - e.startTime).toFixed(1),
      scripts: (e.scripts || []).map(s => ({ f: s.sourceFunctionName || s.invoker || '?', d: +s.duration.toFixed(1), type: s.invokerType, mise: +(s.forcedStyleAndLayoutDuration || 0).toFixed(1) })).filter(s => s.d >= 2).slice(0, 4) }); }).observe({ type: 'long-animation-frame', buffered: false }); } catch (e) {}
  let ecran = null;
  setInterval(() => { const e = window.BITUME_JEU && BITUME_JEU.ecran; if (e !== ecran) { ecran = e; R.ecrans.push([+performance.now().toFixed(1), e]); } }, 20);
  performance.mark('profil-synchro');
  return performance.now();
})()`;

const rapport = { url: args.url, parametres: { scenario, duree, cpu, taille, fenetre: args.fenetre === 'oui', angle: args.angle || 'native', jeu: jeuOptions },
  environnement: {}, build: null, chargement: null, images: null, accrocs: [], ramasseMiettes: null, graphique: null, erreurs: [], limites: [] };
let code = 0;
try {
  if (args.url.startsWith('file:')) {
    const html = readFileSync(fileURLToPath(args.url));
    rapport.build = { sha256: createHash('sha256').update(html).digest('hex'), octets: html.length };
  }
  const port = await lirePort();
  const liste = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const cible = liste.find(t => t.type === 'page');
  if (!cible) throw new Error('aucune cible de page');
  ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((resoudre, rejeter) => { ws.onopen = resoudre; ws.onerror = () => rejeter(new Error('connexion DevTools refusée')); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && requetes.has(m.id)) { const q = requetes.get(m.id); requetes.delete(m.id); clearTimeout(q.minuteur); m.error ? q.rejeter(new Error(m.error.message)) : q.resoudre(m.result); return; }
    if (m.method === 'Tracing.dataCollected') { for (const ev of m.params.value) { trace.recus++; if (garder(ev)) trace.evenements.push(ev); } }
    else if (m.method === 'Tracing.tracingComplete') { if (trace.fini) trace.fini(); }
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') journal.erreurs.push((m.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(' ').slice(0, 400));
    else if (m.method === 'Runtime.exceptionThrown') journal.exceptions.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 600));
  };
  await envoyer('Runtime.enable'); await envoyer('Page.enable');
  // Sans interface : fenêtre et densité imposées (reproductible). Avec --fenetre oui : l'écran réel décide, sauf --dpr.
  if (args.fenetre !== 'oui' || args.dpr) await envoyer('Emulation.setDeviceMetricsOverride', { width: taille[0], height: taille[1], deviceScaleFactor: Number(args.dpr ?? 1), mobile: false });
  const tNav = Date.now();
  await envoyer('Page.navigate', { url: args.url });
  await attendre(() => evaluer('!!(window.BITUME && window.BITUME_JEU && window.BITUME_JEU.rendu)'), 60000, 'le jeu ne démarre pas');
  // Premier lancement : la détection graphique occupe le renderer. On la passe, comme le bouton « Passer ».
  await attendre(async () => {
    const e = await evaluer(`(() => { const a = document.getElementById('autodetection'); if (a && !a.hidden) { ${args.detection === 'oui' ? '' : "document.getElementById('detection-annuler').click();"} return 'detection'; } return BITUME_JEU.ecran; })()`);
    return e === 'titre';
  }, 60000, 'écran titre jamais atteint');
  rapport.chargementPage = { jusquAuTitreMs: Date.now() - tNav };
  // --detection oui : la détection du premier lancement va à son terme ; son verdict et ses mesures sont relevés.
  if (args.detection === 'oui') rapport.detection = await evaluer(`(() => { try { return JSON.parse(localStorage.getItem('bitume.detection.v1')); } catch (e) { return null; } })()`);
  rapport.environnement = await evaluer(`(() => { const r = BITUME_JEU.rendu, vue = (${environnementWebGPU.toString()})(r); return { ...vue, version: document.querySelector('.version-jeu')?.textContent || null, gpuModeste: BITUME_JEU.gpuModeste, toile: [r.gpu.context.canvas.width, r.gpu.context.canvas.height], fenetre: [innerWidth, innerHeight, devicePixelRatio], visible: !document.hidden, coeurs: navigator.hardwareConcurrency }; })()`);
  if (cpu > 1) await envoyer('Emulation.setCPUThrottlingRate', { rate: cpu });
  // --mesures non : le volet de mesures ouvre le chronomètre GPU du moteur, dont les requêtes peuvent elles-mêmes
  // coûter (coupures de passe sur les processeurs graphiques à tuiles) ; sans lui, la cadence relevée est celle du jeu.
  await evaluer('BITUME_JEU.pauseAuto = false; BITUME_JEU.mesures = ' + (args.mesures !== 'non') + '; true');
  await dormir(1500); // la vitrine du titre tourne : hors mesure

  if (avecTrace) {
    await envoyer('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { recordMode: 'recordAsMuchAsPossible',
      includedCategories: ['toplevel', 'devtools.timeline', 'v8', 'disabled-by-default-v8.gc', 'gpu', 'gpu.angle', 'blink.user_timing', 'disabled-by-default-devtools.timeline', 'viz'] } });
  }
  const tReleve = await evaluer(RELEVE);
  let tDebut;
  if (scenario === 'reference') {
    tDebut = await evaluer(`(() => { const t = performance.now(); BITUME_JEU.reference(${JSON.stringify(jeuOptions)}); window.__releve.lancement = performance.now() - t; return t; })()`);
  } else {
    // chemin du joueur : réglages du menu, préparation, départ ; l'ordinateur tient le volant
    tDebut = await evaluer(`(() => { const R = BITUME_JEU.reglages, o = ${JSON.stringify(jeuOptions)};
      Object.assign(R, { circuit: o.circuit, qualite: o.qualite, vue: o.vue, vue2: o.vue2, retro: o.retro, meteo: o.meteo, saison: o.saison, moment: o.moment,
        saisonMode: 'manuel', momentMode: 'manuel', meteoMode: 'manuel', tours: o.tours, secousses: 0, vibrations: 'non' }, ${JSON.stringify(optionsLibres)});
      // comme le menu des réglages : la résolution du profil choisi est appliquée au moteur
      try { BITUME_JEU.rendu.resize(BITUME_JEU.profil.rendu.resolution); } catch (e) {}
      BITUME_JEU.pilotageAuto = true;
      document.querySelector('[data-aller="' + (o.mode === 'duo' ? 'duo' : 'course') + '"]').click();
      return performance.now(); })()`);
    await attendre(() => evaluer(`BITUME_JEU.ecran === 'preparation' && !document.getElementById('b-depart').disabled`), 20000, 'préparation jamais prête');
    await dormir(300);
    tDebut = await evaluer(`(() => { const t = performance.now(); document.getElementById('b-depart').click(); return t; })()`);
    await attendre(() => evaluer(`BITUME_JEU.ecran === 'course'`), 60000, 'la course ne part pas');
  }
  const tCourse = await evaluer('performance.now()');
  await dormir(duree * 1000);
  const releve = await evaluer(`(() => { const R = window.__releve; R.marche = false; const S = BITUME_JEU.session, co = S && S.course;
    return { t: Array.from(R.t.subarray(0, R.n)), longues: R.longues, loaf: R.loaf, ecrans: R.ecrans, lancement: R.lancement ?? null, fin: performance.now(),
      seance: co ? { phase: co.phase, horloge: +co.horloge.toFixed(2), type: S.type, circuit: BITUME_JEU.CATALOGUE[S.i].nom, vue: S.vue, s: +co.joueur.etat.s.toFixed(1), v: +co.joueur.etat.v.toFixed(1), tours: co.joueur.tours } : null,
      mesures: JSON.parse(JSON.stringify(BITUME_JEU.mesures)), profil: (() => { try { const P = BITUME_JEU.profil; return { palier: P.palier, qualite: P.qualite, rendu: P.rendu, effets: P.effets }; } catch (e) { return null; } })(),
      stats: (() => { const s = BITUME_JEU.rendu.stats || {}; const o = {}; for (const k in s) if (typeof s[k] !== 'object' && typeof s[k] !== 'function') o[k] = s[k]; return o; })() }; })()`);
  if (args.capture) {
    const s = await envoyer('Page.captureScreenshot', { format: 'png' });
    writeFileSync(args.capture, Buffer.from(s.data, 'base64')); rapport.capture = path.resolve(args.capture);
  }
  if (avecTrace) {
    const fin = new Promise(r => { trace.fini = r; });
    await envoyer('Tracing.end');
    await Promise.race([fin, dormir(90000)]);
  }

  // ------------------------------------------------------------ dépouillement
  const t = releve.t, inter = [];
  for (let k = 1; k < t.length; k++) inter.push({ t: t[k], dt: t[k] - t[k - 1] });
  const quantile = (liste, p) => { if (!liste.length) return null; const tri = liste.slice().sort((a, b) => a - b); return +tri[Math.min(tri.length - 1, Math.floor(p * tri.length))].toFixed(2); };
  const fenetre = (debut, fin) => inter.filter(i => i.t > debut && i.t <= fin);
  const enCourse = fenetre(tCourse, releve.fin);
  const nominal = quantile(enCourse.map(i => i.dt), .5) || 16.7;
  const resume = liste => { const d = liste.map(i => i.dt); return { images: d.length, p50: quantile(d, .5), p95: quantile(d, .95), p99: quantile(d, .99), pire: d.length ? +Math.max(...d).toFixed(2) : null,
    au_dela_1_5x: d.filter(x => x > nominal * 1.5).length, au_dela_2x: d.filter(x => x > nominal * 2.5).length, au_dela_50ms: d.filter(x => x > 50).length,
    irregularite: d.length ? +(Math.sqrt(d.reduce((a, x) => a + (x - nominal) * (x - nominal), 0) / d.length)).toFixed(2) : null }; };
  rapport.images = { nominalMs: nominal, course: resume(enCourse), premieres2s: resume(fenetre(tCourse, tCourse + 2000)), apres2s: resume(fenetre(tCourse + 2000, releve.fin)) };
  rapport.chargement = { clicAuPremierEcranCourseMs: +(tCourse - tDebut).toFixed(0), lancementSynchroneMs: releve.lancement === null ? null : +releve.lancement.toFixed(0),
    plusLongueImagePendantChargement: (() => { const d = fenetre(tDebut, tCourse).map(i => i.dt); return d.length ? +Math.max(...d).toFixed(0) : null; })() };
  rapport.seance = releve.seance; rapport.profil = releve.profil; rapport.mesures = releve.mesures; rapport.statsRendu = releve.stats;
  rapport.ecrans = releve.ecrans.filter(e => e[0] >= tDebut - 50);
  rapport.imagesLonguesNavigateur = releve.loaf.filter(l => l.t >= tDebut - 50).slice(0, 60);

  // synchronisation des horloges : la marque posée par la page se retrouve dans la trace
  let decalage = null;
  const fils = new Map(), procs = new Map();
  for (const e of trace.evenements) {
    if (e.ph === 'M' && e.name === 'thread_name') fils.set(e.pid + ':' + e.tid, e.args.name);
    if (e.ph === 'M' && e.name === 'process_name') procs.set(e.pid, e.args.name);
    if (e.name === 'profil-synchro' && e.cat && e.cat.includes('blink.user_timing') && decalage === null) decalage = e.ts - tReleve * 1000;
  }
  rapport.trace = { evenementsRecus: trace.recus, gardes: trace.evenements.length, synchronisee: decalage !== null };
  const X = trace.evenements.filter(e => e.ph === 'X');
  // paires B/E du processus graphique ramenées à des événements complets
  const piles = new Map();
  for (const e of trace.evenements) {
    if (e.ph !== 'B' && e.ph !== 'E') continue;
    const cle = e.pid + ':' + e.tid; let pile = piles.get(cle); if (!pile) piles.set(cle, pile = []);
    if (e.ph === 'B') pile.push(e); else { const b = pile.pop(); if (b && e.ts - b.ts >= 400) X.push({ ...b, ph: 'X', dur: e.ts - b.ts }); }
  }
  const nomFil = e => (procs.get(e.pid) || '?') + '/' + (fils.get(e.pid + ':' + e.tid) || '?');
  const estGC = e => /MinorGC|MajorGC|V8\.GC_|BlinkGC|Scavenge|MarkCompact/.test(e.name);
  // « Graphics.Pipeline » est le suivi d'une image par le compositeur, pas une compilation : il est écarté.
  const estShader = e => e.name !== 'Graphics.Pipeline' && /Compile|Link|ShaderTranslate|ProgramMtl|ProgramExecutable|PipelineState|RenderPipeline|GetShaderiv|GetProgramiv|Shader/i.test(e.name);
  const BANAL = new Set(['RunTask', 'ThreadControllerImpl::RunTask', 'v8.callFunction', 'Scheduler::RunTask', 'Graphics.Pipeline', 'SimpleWatcher::OnHandleReady', 'ThreadPool_RunTask', 'Receive mojo message', 'Closed mojo endpoint', 'ThreadController::Task', 'SequenceManager::DoIdleWork', 'MessagePumpKqueue::DoInternalWork']);
  if (decalage !== null) {
    const dansFenetre = (debutMs, finMs) => { const a = debutMs * 1000 + decalage, b = finMs * 1000 + decalage; return X.filter(e => e.ts < b && e.ts + e.dur > a); };
    const longues = inter.filter(i => i.t > tDebut && i.dt > Math.max(nominal * 1.5, nominal + 6)).sort((a, b) => b.dt - a.dt);
    for (const i of longues.slice(0, 40)) {
      const ev = dansFenetre(i.t - i.dt, i.t).filter(e => e.dur >= 1000 && !BANAL.has(e.name));
      const parNom = new Map();
      for (const e of ev) { const cle = nomFil(e) + ' · ' + e.name; parNom.set(cle, Math.max(parNom.get(cle) || 0, e.dur)); }
      const top = [...parNom.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nom, dur]) => nom + ' ' + (dur / 1000).toFixed(1) + ' ms');
      const gc = ev.filter(estGC).reduce((a, e) => Math.max(a, e.dur), 0) / 1000, sh = ev.filter(estShader).reduce((a, e) => a + e.dur, 0) / 1000;
      rapport.accrocs.push({ tDepuisCourseS: +((i.t - tCourse) / 1000).toFixed(2), dtMs: +i.dt.toFixed(1), gcMs: +gc.toFixed(1), shadersMs: +sh.toFixed(1), evenements: top });
    }
    rapport.accrocs.sort((a, b) => a.tDepuisCourseS - b.tDepuisCourseS);
    const gcCourse = dansFenetre(tCourse, releve.fin).filter(e => estGC(e) && /MinorGC|MajorGC/.test(e.name));
    const somme = l => +(l.reduce((a, e) => a + e.dur, 0) / 1000).toFixed(1), pire = l => +(l.reduce((a, e) => Math.max(a, e.dur), 0) / 1000).toFixed(1);
    const mineurs = gcCourse.filter(e => e.name === 'MinorGC'), majeurs = gcCourse.filter(e => e.name === 'MajorGC');
    rapport.ramasseMiettes = { mineurs: { n: mineurs.length, totalMs: somme(mineurs), pireMs: pire(mineurs) }, majeurs: { n: majeurs.length, totalMs: somme(majeurs), pireMs: pire(majeurs) },
      parSeconde: +(mineurs.length / Math.max(1, (releve.fin - tCourse) / 1000)).toFixed(2) };
    const sh = dansFenetre(tCourse, releve.fin).filter(estShader), shChargement = dansFenetre(tDebut, tCourse).filter(estShader);
    const grouper = l => { const m = new Map(); for (const e of l) { const o = m.get(e.name) || { n: 0, ms: 0, pire: 0 }; o.n++; o.ms += e.dur / 1000; o.pire = Math.max(o.pire, e.dur / 1000); m.set(e.name, o); }
      return [...m.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 10).map(([nom, o]) => ({ nom, n: o.n, ms: +o.ms.toFixed(1), pire: +o.pire.toFixed(1) })); };
    rapport.graphique = { shadersEnCourse: grouper(sh), shadersAuChargement: grouper(shChargement),
      processusGraphiquePremiereSeconde: grouper(dansFenetre(tCourse, tCourse + 1000).filter(e => /GPU|Gpu/.test(nomFil(e)) && e.dur >= 2000 && !BANAL.has(e.name))),
      processusGraphiqueEnsuite: grouper(dansFenetre(tCourse + 1000, releve.fin).filter(e => /GPU|Gpu/.test(nomFil(e)) && e.dur >= 4000 && !BANAL.has(e.name))),
      filPrincipalEnCourse: grouper(dansFenetre(tCourse + 1000, releve.fin).filter(e => /CrRendererMain/.test(nomFil(e)) && e.dur >= 4000 && !BANAL.has(e.name))) };
  } else rapport.limites.push('Trace non synchronisée : les accrocs ne sont pas attribués.');
  if (!avecTrace) for (const i of inter.filter(i => i.t > tDebut && i.dt > Math.max(nominal * 1.5, nominal + 6)).slice(0, 60)) rapport.accrocs.push({ tDepuisCourseS: +((i.t - tCourse) / 1000).toFixed(2), dtMs: +i.dt.toFixed(1) });
  rapport.erreurs = journal.erreurs.concat(journal.exceptions);
  if (args.fenetre !== 'oui') rapport.limites.push('Chrome sans interface : cadence synthétique à 60 Hz, sans synchronisation verticale d un écran réel.');
  await evaluer(`(async () => { const r = BITUME_JEU.rendu; await r.gpu.device.queue.onSubmittedWorkDone(); (${environnementWebGPU.toString()})(r); return true; })()`);
  if (/swiftshader|llvmpipe|software/i.test(String(rapport.environnement.gpu))) rapport.limites.push('Rendu logiciel : ne qualifie aucun processeur graphique réel.');
  if (cpu > 1) rapport.limites.push('Processeur ralenti ' + cpu + ' fois par le navigateur : le processeur graphique, lui, ne l est pas.');
  if (rapport.erreurs.length) code = 1;
} catch (e) {
  rapport.fatal = String(e && e.stack || e); rapport.erreurs = journal.erreurs.concat(journal.exceptions); code = 1;
} finally {
  for (const q of requetes.values()) clearTimeout(q.minuteur);
  requetes.clear();
  if (args.sortie) writeFileSync(args.sortie, JSON.stringify(rapport, null, 1));
  const court = { ...rapport, mesures: undefined, statsRendu: undefined, imagesLonguesNavigateur: (rapport.imagesLonguesNavigateur || []).slice(0, 12) };
  console.log(JSON.stringify(court, null, 1));
  try { ws && ws.close(); } catch (e) { /* déjà fermé */ }
  try { processus.kill('SIGKILL'); } catch (e) { /* déjà mort */ }
  try { process.kill(-processus.pid, 'SIGKILL'); } catch (e) { /* groupe déjà mort */ }
  rmSync(profil, { recursive: true, force: true });
}
process.exit(code);
