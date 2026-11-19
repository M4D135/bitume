#!/usr/bin/env node
// Planche des animaux des abords (lot 26, src/animaux.js) : ouvre la page construite dans Chrome sans interface,
// horloge d'images commandée (celle de tools/controle-visuel.mjs : une image ne part que quand l'outil la demande),
// et filme pour chaque circuit un troupeau de près, un troupeau de loin, une fuite au passage du peloton et des
// oiseaux en vol. Chaque prise donne les chiffres du rendu (rendu.stats) avec et sans animaux, à l'instant exact de
// l'image (la même image redessinée sans eux). Une course en vue cockpit, rétroviseurs compris, rejouée avec et sans
// animaux en alternance après un échauffement, donne ensuite le coût par image et le bruit de cette mesure.
//
//   node tools/planche-animaux.mjs dist/bitume.html <dossier neuf> [--circuits 0,1,2,3,4,5,6] [--taille 1280,720]
//        [--qualite high] [--saison ete] [--format jpeg|png] [--legere 0] [--chrome <binaire>]
//
// La page doit intégrer src/animaux.js (BITUME.animaux et session.animaux, voir docs/reprise/26-ANIMAUX.md). Les
// temps CPU viennent de performance.now (réel) mais les images s'enchaînent sans attendre l'écran : ce sont des
// ordres de grandeur, pas une mesure de fluidité (pour celle-ci, tools/banc-navigateur.mjs). Aucune dépendance :
// Node 22 et plus (WebSocket global), Chrome installé.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { horlogeCapture } from './controle-visuel.mjs';

const [page, sortie, ...reste] = process.argv.slice(2);
if (!page || !sortie) { console.error('usage : node tools/planche-animaux.mjs dist/bitume.html <dossier neuf> [options]'); process.exit(2); }
const opt = (n, d) => { const i = reste.indexOf('--' + n); return i < 0 ? d : reste[i + 1]; };
const circuits = String(opt('circuits', '0,1,2,3,4,5,6')).split(',').map(Number);
const taille = String(opt('taille', '1280,720')).split(',').map(Number), qualite = opt('qualite', 'high'), saison = opt('saison', 'ete');
const format = opt('format', 'jpeg') === 'png' ? 'png' : 'jpeg', legere = opt('legere', '0');
if (existsSync(sortie) && readdirSync(sortie).some(f => /\.(jpe?g|png)$/.test(f))) { console.error('dossier déjà rempli de captures : en choisir un neuf'); process.exit(2); }
mkdirSync(sortie, { recursive: true });

// ---------------------------------------------------------------- aide évaluée dans la page (texte de la fonction)
function aidePage() {
  const J = window.BITUME_JEU, A = window.BITUME.animaux, DT = 1 / 120, NG = 10, GETAT = 0, ALERTE = 1, FUITE = 2;
  const PS = {}, PV = {};
  const somme = () => ({ n: 0, ms: 0, max: 0 });
  let M = { dessin: somme(), cerveau: somme() }, couper = false, couperCerveau = false;
  const dessiner = A.dessiner, pas = A.pas;
  // le jeu appelle B.animaux.dessiner / B.animaux.pas par l'objet : les envelopper suffit à chronométrer ou couper
  A.dessiner = function (etat, temps, ctx, sortie) {
    if (couper) return 0;
    const t0 = performance.now(), r = dessiner(etat, temps, ctx, sortie), d = performance.now() - t0;
    M.dessin.n++; M.dessin.ms += d; if (d > M.dessin.max) M.dessin.max = d; return r;
  };
  A.pas = function (etat, temps, voitures) {
    if (couperCerveau) return;
    const k = etat ? etat.k : 0, t0 = performance.now(); pas(etat, temps, voitures);
    if (etat && etat.k !== k) { const d = performance.now() - t0; M.cerveau.n++; M.cerveau.ms += d; if (d > M.cerveau.max) M.cerveau.max = d; }
  };
  const S = () => J.session, E = () => J.session.animaux;
  const tempsVu = () => { const s = S(); return s.course.horloge - DT + Math.min(Math.max(s.acc, 0), DT); };
  function axeProche(c, x, z) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < c.n; i++) { const dx = c.x[i] - x, dz = c.z[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    return { i: best, s: best * c.pas, d: Math.sqrt(bd) };
  }
  function centre(g, t) {
    const e = E(), grp = e.groupes[g]; let sx = 0, sz = 0, n = 0;
    for (let m = 0; m < grp.n; m++) { const p = A.poseAnimal(e, grp.debut + m, t, PS); if (p) { sx += p.x; sz += p.z; n++; } }
    const x = sx / n, z = sz / n; let fx = x, fz = z, best = Infinity;
    // bête la plus proche du centre : la prise de près la cadre, les autres l'entourent
    for (let m = 0; m < grp.n; m++) { const p = A.poseAnimal(e, grp.debut + m, t, PS); if (!p) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < best) { best = d; fx = p.x; fz = p.z; } }
    return { x, z, fx, fz };
  }
  const hauteurDe = grp => (grp.md.rig ? grp.md.rig.hauteur : grp.md.hauteur || 1) * (grp.e.echelle || 1);
  // Distance, hauteur d'œil et champ selon la prise : de près, une bête et ses voisines ; pour la fuite, l'œil recule
  // et s'ouvre pour garder la route derrière les bêtes ; de loin, 120 m au téléobjectif ; Légère, au-delà de 120 m.
  function cadrage(g, mode) {
    const h = hauteurDe(E().groupes[g]);
    if (mode === 'loin') return { R: 120, haut: 12, fov: 28 };
    if (mode === 'legere') return { R: 145, haut: 10, fov: 20 };
    if (mode === 'fuite') return { R: Math.max(h * 16, 14), haut: Math.max(2.6, h * 1.8), fov: 60 };
    return { R: Math.max(h * 9, 8), haut: Math.max(1.2, h * 1.05 + .3), fov: 52 };
  }
  // caméra posée du côté opposé à la route (le peloton passe derrière le troupeau), sur l'angle le plus dégagé :
  // obstacles du décor et relief entre l'œil et les bêtes, eau et sous-bois sous l'œil ; plus près si tout est caché
  function cameraTroupeau(g, mode, t) {
    const cad = cadrage(g, mode), fov = cad.fov, haut = cad.haut;
    const e = E(), G = e.G, c = e.c, ctr = centre(g, t), ax = axeProche(c, ctr.x, ctr.z), vx = mode === 'proche' ? ctr.fx : ctr.x, vz = mode === 'proche' ? ctr.fz : ctr.z;
    const ux = ctr.x - c.x[ax.i], uz = ctr.z - c.z[ax.i], L = Math.hypot(ux, uz) || 1, cible = A.solExact(G.T, vx, vz) + hauteurDe(e.groupes[g]) * .6;
    let best = null;
    for (const R of mode === 'legere' ? [cad.R, cad.R * 1.2] : [cad.R, cad.R * .75, cad.R * .55]) {
      for (const th of [0, .35, -.35, .7, -.7, 1.05, -1.05, 1.4, -1.4, 1.9, -1.9]) {
        const ca = Math.cos(th), sa = Math.sin(th), dx = (ux * ca - uz * sa) / L, dz = (ux * sa + uz * ca) / L;
        const px = vx + dx * R, pz = vz + dz * R, k0 = A.cellule(G, px, pz);
        if (k0 < 0) continue;
        const y = Math.max(A.solExact(G.T, px, pz), G.eau) + haut;
        let gene = G.h[k0] < G.eau ? 40 : 0, cache = 0; gene += Math.min(20, G.arbres[k0]) * .5 + (G.drap[k0] & 1 ? 30 : 0);
        for (let q = 1; q < 48; q++) {
          const f = q / 48, x = px + (vx - px) * f, z = pz + (vz - pz) * f, k = A.cellule(G, x, z);
          if (k < 0) { gene += 5; continue; }
          if (G.drap[k] & 1) gene += 2;
          if (A.solExact(G.T, x, z) > y + (cible - y) * f - .25) cache++;
        }
        const score = gene + cache * 40 + Math.abs(th) * 2 + (R < cad.R ? 15 : 0);
        if (!best || score < best.score) best = { px, pz, y, score, cache };
      }
      if (best && !best.cache) break;
    }
    if (!best) return null;
    const dx = vx - best.px, dz = vz - best.pz, dh = Math.hypot(dx, dz);
    return { pos: [best.px, best.y, best.pz], yaw: Math.atan2(dx, -dz), pitch: Math.atan2(cible - best.y, dh), fov, gene: best.score, cache: best.cache, distance: dh };
  }
  // passage : l'œil en hauteur de l'autre côté de la piste, comme un drone de télévision : le peloton passe au premier
  // plan, le troupeau s'enfuit derrière. Parmi quelques places le long de la piste, celle où arbres et relief cachent
  // le moins les bêtes.
  function cameraPassage(g, t) {
    const e = E(), G = e.G, c = e.c, ctr = centre(g, t), ax = axeProche(c, ctr.x, ctr.z);
    const nx = -Math.sin(c.cap[ax.i]), nz = Math.cos(c.cap[ax.i]), cote = Math.sign((ctr.x - c.x[ax.i]) * nx + (ctr.z - c.z[ax.i]) * nz) || 1;
    const vx = c.x[ax.i] + (ctr.x - c.x[ax.i]) * .6, vz = c.z[ax.i] + (ctr.z - c.z[ax.i]) * .6, cible = A.solExact(G.T, vx, vz), haut = A.solExact(G.T, ctr.x, ctr.z) + 1;
    let best = null;
    for (const ds of [-25, 0, 25, -50, 50]) {
      const j = (ax.i + Math.round(ds / c.pas) + c.n) % c.n, mx = Math.sin(c.cap[j]) * cote, mz = -Math.cos(c.cap[j]) * cote;
      const ecart = Math.max(c.limiteG[j], c.limiteD[j]) + 14, px = c.x[j] + mx * ecart, pz = c.z[j] + mz * ecart, k0 = A.cellule(G, px, pz);
      if (k0 < 0) continue;
      const y = Math.max(A.solExact(G.T, px, pz), G.eau) + 18;
      let gene = 0;
      for (let q = 1; q < 48; q++) {
        const f = q / 48, x = px + (ctr.x - px) * f, z = pz + (ctr.z - pz) * f, k = A.cellule(G, x, z);
        if (k < 0) { gene += 5; continue; }
        gene += G.arbres[k] * .1;
        if (A.solExact(G.T, x, z) > y + (haut - y) * f - .25) gene += 30;
      }
      gene += Math.abs(ds) * .05;
      if (!best || gene < best.gene) best = { px, pz, y, gene, ds };
    }
    if (!best) return null;
    const dx = vx - best.px, dz = vz - best.pz, dh = Math.hypot(dx, dz);
    return { pos: [best.px, best.y, best.pz], yaw: Math.atan2(dx, -dz), pitch: Math.atan2(cible - best.y, dh), fov: 42, gene: best.gene, decalage: best.ds, distance: Math.hypot(ctr.x - best.px, ctr.z - best.pz) };
  }
  // oiseau suivi : l'œil en retrait de trois quarts arrière et un peu au-dessus, ailes ouvertes et pays dessous
  function cameraOiseau(f, k, recul, dessus, fov) {
    const e = E(), G = e.G;
    return () => {
      A.poseVolant(e, f, k, tempsVu(), PV);
      const a = PV.cap + .6, px = PV.x - Math.cos(a) * recul, pz = PV.z - Math.sin(a) * recul, sol = Math.max(A.solExact(G.T, px, pz), G.eau) + 2;
      const py = Math.max(sol, PV.y + dessus), dh = Math.hypot(PV.x - px, PV.z - pz);
      return { pos: [px, py, pz], yaw: Math.atan2(PV.x - px, -(PV.z - pz)), pitch: Math.atan2(PV.y - py, dh), fov };
    };
  }
  function cacherInterface() {
    const toile = document.getElementById('scene');
    for (const el of document.querySelectorAll('body *')) if (el !== toile && !el.contains(toile)) el.style.visibility = 'hidden';
  }
  // compteurs du rendu ; ceux des bêtes seulement si elles ont été dessinées (dessin coupé, ils resteraient ceux de
  // l'image d'avant), pour ne pas les recopier dans la colonne « sans »
  function rendus() {
    const st = J.rendu.stats, r = { drawCalls: st.drawCalls, triangles: st.triangles, instances: st.instances };
    if (couper) return r;
    const v = A.stats(E(), 0).vue;
    return Object.assign(r, { animaux: v.animaux, proches: v.proches, moyens: v.moyens, lointains: v.lointains, objetsAnimaux: v.objets, trianglesAnimaux: v.triangles });
  }
  window.__PLANCHE = {
    reference(o) { const r = J.reference(o); J.pauseAuto = false; cacherInterface(); return { circuit: r.circuit, circuitId: r.circuitId, depart: r.depart, faune: r.faune, qualite: r.qualite }; },
    // course simulée sans image : premier instant d'alerte et de fuite de chaque groupe
    simuler(duree) {
      const e = E(), n = e.groupes.length, fuite = new Array(n).fill(null), alerte = new Array(n).fill(null), fin = S().course.horloge + duree;
      while (S().course.horloge < fin && !S().course.termine) {
        J.avancer(.1, true);
        const t = S().course.horloge;
        for (let g = 0; g < n; g++) { const st = e.gs[g * NG + GETAT]; if (st === FUITE && fuite[g] === null) fuite[g] = t; if (st >= ALERTE && alerte[g] === null) alerte[g] = t; }
      }
      return e.groupes.map((grp, g) => ({ g, espece: grp.cle, famille: grp.famille, n: grp.n, dAxe: Math.round(grp.dAxe), refuge: grp.refuge, arbres: e.G.arbres[A.cellule(e.G, grp.hx, grp.hz)], fuite: fuite[g], alerte: alerte[g] }));
    },
    avancerSim(secondes) { if (secondes > 0) J.avancer(secondes, true); return S().course.horloge; },
    horloge: () => S().course.horloge,
    etatGroupe: g => E().gs[g * NG + GETAT],
    // Légère ne dessine que les groupes à plus de 150 m de la piste : le plus éloigné d'abord
    groupesLoin: () => E().groupes.map((grp, g) => ({ g, espece: grp.cle, n: grp.n, dAxe: Math.round(grp.dAxe) })).filter(x => x.dAxe >= 150).sort((a, b) => b.dAxe - a.dAxe),
    stats: () => { const s = A.stats(E(), 0); delete s.vue; return s; },
    volants: () => E().volants.map((f, v) => ({ v, espece: f.e.cle, famille: f.famille, n: f.n })),
    // migrateurs : l'instant (à partir de maintenant) où la tête du vol passe au plus près du centre du circuit
    passageVolant(v, duree) {
      const e = E(), c = e.c, f = e.volants[v], t0 = tempsVu();
      let cx = 0, cz = 0; for (let i = 0; i < c.n; i++) { cx += c.x[i]; cz += c.z[i]; } cx /= c.n; cz /= c.n;
      let best = t0, bd = Infinity;
      for (let t = t0; t < t0 + duree; t += .5) { A.poseVolant(e, f, 0, t, PV); const d = Math.hypot(PV.x - cx, PV.z - cz); if (d < bd) { bd = d; best = t; } }
      return { t: best, distance: bd };
    },
    cameraTroupeau(g, mode) { const cam = cameraTroupeau(g, mode, tempsVu()); if (!cam) return null; J.camera = () => ({ pos: cam.pos, yaw: cam.yaw, pitch: cam.pitch, fov: cam.fov }); return cam; },
    cameraPassage(g) { const cam = cameraPassage(g, tempsVu()); if (!cam) return null; J.camera = () => ({ pos: cam.pos, yaw: cam.yaw, pitch: cam.pitch, fov: cam.fov }); return cam; },
    cameraOiseau(v, k, recul, dessus, fov) { const f = E().volants[v]; J.camera = cameraOiseau(f, k, recul, dessus, fov); return true; },
    // baleine : l'instant (à partir de maintenant) où elle est en surface
    surface(v, duree) {
      const e = E(), f = e.volants[v], t0 = tempsVu();
      for (let t = t0; t < t0 + duree; t += .25) if (A.poseVolant(e, f, 0, t, PV) && PV.y > e.G.eau - .7) return { t: t + .5 };
      return { t: t0 };
    },
    rendus, couper(v) { couper = !!v; }, couperCerveau(v) { couperCerveau = !!v; },
    mesures() { const r = JSON.parse(JSON.stringify(M)); M = { dessin: somme(), cerveau: somme() }; return r; },
    // images enchaînées dans la page (horloge commandée) : coût CPU par image et bêtes dessinées
    rouler(images, pasMs) {
      const t = [], an = [], ob = [], tri = [];
      for (let q = 0; q < images; q++) {
        const t0 = performance.now(); window.__BITUME_CAPTURE.avancer(pasMs); t.push(performance.now() - t0);
        if (couper) continue; // dessin coupé : les compteurs de la vue ne bougent plus
        const v = A.stats(E(), 0).vue; an.push(v.animaux); ob.push(v.objets); tri.push(v.triangles);
      }
      const moy = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length), q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
      const r = { images, imageMs: { moyenne: moy(t), p50: q(t, .5), p95: q(t, .95) } };
      if (an.length) Object.assign(r, { animaux: { moyenne: moy(an), max: Math.max(...an) }, objets: { moyenne: moy(ob), max: Math.max(...ob) }, triangles: { moyenne: moy(tri), max: Math.max(...tri) } });
      return r;
    },
    environnement() { const gl = J.rendu.gl, info = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return { navigateur: navigator.userAgent, gpu: gl ? (info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : null,
        version: document.querySelector('.version-jeu')?.textContent || null, ecran: [innerWidth, innerHeight, devicePixelRatio], formes: A.FORMES.size, trianglesFormes: A.trianglesFormes, chargementMs: A.dureeChargement }; }
  };
  return true;
}

// ---------------------------------------------------------------- Chrome et protocole DevTools
const profil = mkdtempSync(path.join(tmpdir(), 'bitume-animaux-'));
writeFileSync(path.join(profil, 'Local State'), JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } }));
const args = ['--headless=new', '--no-sandbox', '--remote-debugging-port=0', '--user-data-dir=' + profil, '--window-size=' + taille.join(','), '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'];
const proc = spawn(opt('chrome', process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), args, { stdio: 'ignore', detached: true });
const dormir = ms => new Promise(r => setTimeout(r, ms));
let ws, suivant = 1; const req = new Map(), erreurs = [];
const envoyer = (method, params = {}) => new Promise((ok, ko) => { const id = suivant++; req.set(id, { ok, ko }); ws.send(JSON.stringify({ id, method, params })); });
const evaluer = async e => { const r = await envoyer('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };
const P = (nom, ...a) => evaluer(`__PLANCHE.${nom}(${a.map(x => JSON.stringify(x)).join(',')})`);
const image = ms => evaluer(`__BITUME_CAPTURE.avancer(${ms})`);
const rapport = { format: 'bitume-planche-animaux', date: new Date().toISOString(), page, qualite, saison, taille, circuits: [], erreurs };
const prises = [];
async function prendre(nom, legende, extra = {}) {
  const s = await envoyer('Page.captureScreenshot', format === 'png' ? { format } : { format, quality: 84 });
  const fichier = nom + '.' + (format === 'png' ? 'png' : 'jpg');
  writeFileSync(path.join(sortie, fichier), Buffer.from(s.data, 'base64'));
  // même instant redessiné sans les animaux : l'écart est leur part exacte du rendu
  const avec = await P('rendus'); await P('couper', true); await image(0);
  const sans = await P('rendus'); await P('couper', false); await image(0);
  const prise = Object.assign({ fichier, legende, horloge: await P('horloge'), avec, sans,
    ecart: { drawCalls: avec.drawCalls - sans.drawCalls, triangles: avec.triangles - sans.triangles, instances: avec.instances - sans.instances } }, extra);
  prises.push(prise); process.stderr.write(`${fichier} : ${legende}\n`);
  return prise;
}
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
  await envoyer('Emulation.setDeviceMetricsOverride', { width: taille[0], height: taille[1], deviceScaleFactor: 1, mobile: false });
  await envoyer('Page.addScriptToEvaluateOnNewDocument', { source: horlogeCapture(17017) });
  await envoyer('Page.navigate', { url: page.startsWith('file:') || page.startsWith('http') ? page : 'file://' + path.resolve(page) });
  // l'horloge commandée tient aussi la détection graphique du premier lancement : on l'annule, images à la main
  const fin = Date.now() + 90000;
  for (;;) {
    const e = await evaluer(`(() => { if (!(window.BITUME_JEU && BITUME_JEU.rendu && window.__BITUME_CAPTURE)) return null; const a = document.getElementById('autodetection'); if (a && !a.hidden) { document.getElementById('detection-annuler').click(); } __BITUME_CAPTURE.avancer(16); return BITUME_JEU.ecran; })()`).catch(() => null);
    if (e === 'titre') break; if (Date.now() > fin) throw new Error('écran titre jamais atteint'); await dormir(30);
  }
  if (!await evaluer('!!(window.BITUME && BITUME.animaux)')) throw new Error('page sans src/animaux.js : appliquer integration.patch et reconstruire');
  await evaluer(`(${aidePage})()`);
  rapport.environnement = await P('environnement');
  const base = { qualite, saison, moment: 'jour', meteo: 'soleil', faune: 'profil', vue: 'tele', retro: 'oui' };
  for (const i of circuits) {
    const R0 = await P('reference', Object.assign({}, base, { circuit: i }));
    const id = R0.circuitId, info = { circuit: i, id, especes: null, choix: null };
    process.stderr.write(`\n${id}\n`);
    // 1. course sans image : qui s'alarme et qui fuit, et quand
    const groupes = await P('simuler', 75);
    info.stats = await P('stats'); info.groupes = groupes;
    const gros = f => f === 'troupeau' || f === 'coureur' ? 1 : 0, tri = (a, b) => (gros(b.famille) - gros(a.famille)) || (b.n - a.n) || (a.dAxe - b.dAxe);
    // un groupe alarmé au moins 10 s après le départ : la prise de près le montre encore calme
    const tard = x => x.alerte !== null && x.alerte >= 10;
    const parTard = (a, b) => (tard(b) - tard(a)) || tri(a, b);
    const fuyants = groupes.filter(x => x.fuite !== null).sort(parTard), alertes = groupes.filter(x => x.alerte !== null).sort(parTard);
    const cibleG = fuyants[0] ? Object.assign({ mode: 'fuite' }, fuyants[0]) : alertes[0] ? Object.assign({ mode: 'alerte' }, alertes[0]) : Object.assign({ mode: 'calme' }, groupes.slice().sort(tri)[0]);
    // de loin : une autre espèce si le biome en a une, pour montrer son identité
    // (hors du sous-bois : de loin, les houppiers cacheraient tout)
    const clair = x => x.arbres <= 8 ? 1 : 0;
    const loinG = groupes.filter(x => x.g !== cibleG.g).sort((a, b) => (clair(b) - clair(a)) || ((b.espece !== cibleG.espece) - (a.espece !== cibleG.espece)) || tri(a, b))[0] || cibleG;
    info.choix = { cible: cibleG, loin: loinG };
    const tEvt = cibleG.mode === 'fuite' ? cibleG.fuite : cibleG.mode === 'alerte' ? cibleG.alerte : 30;
    // 2. même course rejouée (graine et départ identiques) jusqu'à quelques secondes avant l'événement
    await P('reference', Object.assign({}, base, { circuit: i }));
    const t0 = Math.max(6.2, (cibleG.alerte ?? tEvt) - 3.5);
    await P('avancerSim', t0 - await P('horloge'));
    await image(16.7);
    const camP = await P('cameraTroupeau', cibleG.g, 'proche');
    if (camP) {
      await image(16.7);
      await prendre(id + '-proche', `${cibleG.espece} (${cibleG.n}) de près, ${Math.round(camP.distance)} m, avant le passage du peloton`, { camera: camP, groupe: cibleG });
    }
    const camL = await P('cameraTroupeau', loinG.g, 'loin');
    if (camL) {
      await image(0);
      await prendre(id + '-loin', `${loinG.espece} (${loinG.n}) de loin, ${Math.round(camL.distance)} m`, { camera: camL, groupe: loinG });
    }
    // 3. fuite : œil plus large, la route derrière le troupeau ; images de 33 ms jusqu'à l'instant voulu
    const camF = await P('cameraTroupeau', cibleG.g, 'fuite');
    // les marmottes plongent au terrier dès la fuite : on les prend dressées, à l'alerte
    const terrier = cibleG.famille === 'terrier' && cibleG.alerte !== null;
    const vise = terrier ? cibleG.alerte + .6 : tEvt + (cibleG.mode !== 'fuite' ? .8 : 1.3);
    for (let n = 0; n < 900 && await P('horloge') < vise; n++) await image(33.3);
    if (camF) await prendre(id + '-fuite', terrier ? `${cibleG.espece} dressées à l'alerte, à l'approche du peloton (au terrier une seconde plus tard)` : cibleG.mode === 'fuite' ? `${cibleG.espece} en fuite au passage du peloton` : `${cibleG.espece} en alerte au passage du peloton (trop loin pour fuir)`,
      { camera: camF, groupe: cibleG, etat: await P('etatGroupe', cibleG.g) });
    // même instant, vu du bord de la piste : le peloton devant, les bêtes qui s'enfuient derrière
    const camB = await P('cameraPassage', cibleG.g);
    if (camB) {
      await image(0);
      await prendre(id + '-passage', `le peloton passe, ${cibleG.espece} ${terrier ? 'en alerte' : cibleG.mode === 'fuite' ? 'en fuite' : 'en alerte'} à ${Math.round(camB.distance)} m de l'œil`, { camera: camB, groupe: cibleG });
    }
    // 4. oiseaux en vol (rapaces, vol migrateur, oiseaux de côte) ; les migrateurs sont attendus au-dessus du circuit
    const volants = (await P('volants')).filter(f => f.famille !== 'marin');
    const ordre = { plane: 0, migrateur: 1, cotier: 2 };
    volants.sort((a, b) => (ordre[a.famille] ?? 9) - (ordre[b.famille] ?? 9));
    if (volants.length) {
      const f = volants[0];
      if (f.famille === 'migrateur') { const p = await P('passageVolant', f.v, 240); const h = await P('horloge'); if (p.t > h + .5) await P('avancerSim', p.t - h); }
      await P('cameraOiseau', f.v, 0, f.famille === 'migrateur' ? 30 : 12, f.famille === 'migrateur' ? 6 : 2.5, f.famille === 'migrateur' ? 46 : 40);
      await image(16.7); await image(16.7);
      await prendre(id + '-vol', `${f.espece} en vol`, { volant: f });
    }
    const baleine = (await P('volants')).find(f => f.famille === 'marin');
    if (baleine) {
      const s = await P('surface', baleine.v, 90), h = await P('horloge');
      if (s.t > h + .2) await P('avancerSim', s.t - h);
      await P('cameraOiseau', baleine.v, 0, 60, 14, 40);
      await image(16.7); await image(16.7);
      await prendre(id + '-baleine', 'baleine au large', { volant: baleine });
    }
    info.prises = prises.filter(p => p.fichier.startsWith(id + '-')).map(p => p.fichier);
    // 5. coût par image en vue cockpit (rétroviseurs compris) : la même course rejouée avec et sans animaux, en
    //    alternance (avec, sans, avec, sans) après une course d'échauffement jetée. La première course en cockpit après
    //    les prises paie les nuanceurs et les caches froids : sans échauffement, l'écart mesuré était celui-là (+11 ms
    //    au premier circuit). L'écart entre deux courses identiques donne le bruit de la mesure.
    const ax = cibleG.dAxe, courses = [];
    const course = async (avecAnimaux, images) => {
      await P('reference', Object.assign({}, base, { circuit: i, vue: 'cockpit' }));
      await P('avancerSim', Math.max(0, t0 - 4 - await P('horloge')));
      await P('couper', !avecAnimaux); await P('couperCerveau', !avecAnimaux); await P('mesures');
      const r = await P('rouler', images, 33.3), m = await P('mesures');
      await P('couper', false); await P('couperCerveau', false);
      return avecAnimaux ? Object.assign(r, { dessin: m.dessin, cerveau: m.cerveau }) : r;
    };
    await course(true, 120);
    // (« animaux » est déjà pris par le compte des bêtes dessinées que rend rouler)
    for (const avecAnimaux of [true, false, true, false]) courses.push(Object.assign({ avecAnimaux }, await course(avecAnimaux, 240)));
    const moyenneDe = (avecAnimaux, cle) => { const l = courses.filter(x => x.avecAnimaux === avecAnimaux); return l.reduce((s, x) => s + x.imageMs[cle], 0) / l.length; };
    const resume = avecAnimaux => ({ moyenne: moyenneDe(avecAnimaux, 'moyenne'), p50: moyenneDe(avecAnimaux, 'p50'), p95: moyenneDe(avecAnimaux, 'p95') });
    const [a1, s1, a2, s2] = courses, cumul = cle => ({ n: a1[cle].n + a2[cle].n, ms: a1[cle].ms + a2[cle].ms, max: Math.max(a1[cle].max, a2[cle].max) });
    info.cockpit = { images: 240, secondes: 8, echauffement: 120, courses, avec: resume(true), sans: resume(false),
      ecartMs: resume(true).moyenne - resume(false).moyenne,
      // bruit : écart entre les deux courses identiques de chaque sorte
      bruitMs: Math.max(Math.abs(a1.imageMs.moyenne - a2.imageMs.moyenne), Math.abs(s1.imageMs.moyenne - s2.imageMs.moyenne)),
      dessin: cumul('dessin'), cerveau: cumul('cerveau'), dAxeCible: ax };
    process.stderr.write(`cockpit : ${info.cockpit.avec.moyenne.toFixed(2)} ms avec, ${info.cockpit.sans.moyenne.toFixed(2)} ms sans (bruit ${info.cockpit.bruitMs.toFixed(2)} ms)\n`);
    rapport.circuits.push(info);
  }
  // Légère : seulement quelques silhouettes lointaines
  if (legere !== 'non') {
    const i = Number(legere) || 0;
    const R0 = await P('reference', Object.assign({}, base, { circuit: i, qualite: 'low' }));
    await P('avancerSim', 8 - await P('horloge'));
    await image(16.7);
    const loin = (await P('groupesLoin'))[0];
    const cam = loin ? await P('cameraTroupeau', loin.g, 'legere') : null;
    await image(16.7); await image(16.7);
    rapport.legere = { circuit: R0.circuitId, groupe: loin || null, camera: cam };
    await prendre(R0.circuitId + '-legere', `Légère : ${loin ? loin.espece + ' à ' + Math.round(cam.distance) + ' m, ' : ''}silhouettes lointaines d'une pièce`, { camera: cam, groupe: loin });
  }
  rapport.prises = prises;
  writeFileSync(path.join(sortie, 'mesures.json'), JSON.stringify(rapport, null, 1) + '\n');
  const echapper = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const vignettes = prises.map(p => `<figure><a href="${p.fichier}"><img src="${p.fichier}" loading="lazy" alt="${echapper(p.legende)}"></a><figcaption><strong>${echapper(p.fichier)}</strong> · ${echapper(p.legende)}<br>` +
    `animaux ${p.avec.animaux} (près ${p.avec.proches}, moyens ${p.avec.moyens}, loin ${p.avec.lointains}) · +${p.ecart.instances} instances, +${p.ecart.triangles} triangles, +${p.ecart.drawCalls} appels</figcaption></figure>`).join('\n');
  writeFileSync(path.join(sortie, 'index.html'), `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BITUME — animaux des abords</title><style>
:root{color-scheme:dark light;font:15px system-ui;background:#14181d;color:#e8edf4}body{margin:24px auto;max-width:1600px;padding:0 16px}h1{font-size:24px}a{color:#a6d1ff}.grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:16px}figure{margin:0;background:#202832;border-radius:10px;overflow:hidden}img{display:block;width:100%;height:auto}figcaption{padding:10px;line-height:1.5}@media(prefers-color-scheme:light){:root{background:#f2f4f7;color:#18222b}figure{background:#fff}a{color:#175998}}</style>
<h1>BITUME — animaux des abords (lot 26)</h1><p>${prises.length} prises, qualité ${echapper(qualite)}, ${echapper(saison)}, jour. Chiffres : rendu.stats de la même image avec et sans animaux. <a href="mesures.json">Mesures complètes</a>.</p><div class="grille">${vignettes}</div></html>\n`);
  console.log(JSON.stringify({ dossier: sortie, prises: prises.length, erreurs }, null, 1));
  if (erreurs.length) code = 1;
} catch (e) { console.log(JSON.stringify({ fatal: String(e && e.stack || e), erreurs }, null, 1)); code = 1;
  try { rapport.fatal = String(e && e.stack || e); rapport.prises = prises; writeFileSync(path.join(sortie, 'mesures.json'), JSON.stringify(rapport, null, 1) + '\n'); } catch {} }
finally { try { ws && ws.close(); } catch {} try { process.kill(-proc.pid, 'SIGKILL'); } catch {} rmSync(profil, { recursive: true, force: true }); }
process.exit(code);
