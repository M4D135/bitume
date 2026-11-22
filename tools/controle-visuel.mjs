#!/usr/bin/env node
// Captures déterministes de BITUME et contrôle temporel, hors du jeu et sans dépendance npm.
// node tools/controle-visuel.mjs --url file:///chemin/dist/bitume.html --sortie /tmp/bitume-visuel --scenario tunnel
// Ajouter --reference /tmp/avant/rapport.json pour comparer un autre build avec les mêmes réglages.
// L'horloge rAF est commandée : aucun FPS de cette capture ne constitue une mesure de performance.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decoderPng, mesurerImage, analyserSequence, comparerSequences } from './visuel-images.mjs';

const aide = `Contrôle visuel de BITUME (Node >= 22 + Chrome/Chromium)
  --url <page> --sortie <nouveau dossier>
  --scenario tunnel|piste|pluie|duo     défaut tunnel
  --images 48 --pas 0.1 --chauffe 4   nombre de captures, secondes simulées, images de chauffe
  --taille 960,540 --qualite high      résolution CSS ; DPR fixé à 1 (low, medium ou high)
  --graine 17017 --circuit 2          défaut circuit 2 pour tunnel, 0 pour les autres
  --meteo sec|pluie --vue cockpit --vue2 cockpit --partage haut-bas|cote
  --moment jour|crepuscule|nuit|cycle --saison printemps|ete|automne|hiver
  --depart tunnel|<abscisse> --vitesse 75 --retro oui|non
  --decor reference|enrichi             variante visuelle, comparable à conditions identiques
  --reference <rapport.json>          comparaison avant/après, réglages et environnement identiques
  --chrome <binaire> --angle swiftshader|native --attendre 60000
Le dossier contient les PNG, rapport.json et index.html. Les alertes demandent un examen visuel.
Cette commande ne mesure pas les FPS ; utiliser séparément banc-navigateur.mjs sur une fenêtre au premier plan.`;

export function optionsCapture(argv) {
  const a = {};
  const connus = new Set(['url', 'sortie', 'scenario', 'images', 'pas', 'chauffe', 'taille', 'qualite', 'graine', 'circuit', 'meteo', 'moment', 'saison', 'vue', 'vue2', 'partage', 'depart', 'vitesse', 'retro', 'decor', 'reference', 'chrome', 'angle', 'attendre']);
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] === '--help' || argv[i] === '-h') return { aide: true };
    const nom = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !connus.has(nom) || argv[i + 1] === undefined || argv[i + 1].startsWith('--'))
      throw new Error('Option inconnue ou valeur absente : ' + argv[i]);
    a[nom] = argv[i + 1];
  }
  if (!a.url || !a.sortie) throw new Error('--url et --sortie sont nécessaires');
  const url = new URL(a.url);
  if (!['file:', 'http:', 'https:'].includes(url.protocol)) throw new Error('URL file/http/https attendue');
  const scenario = a.scenario || 'tunnel';
  if (!['tunnel', 'piste', 'pluie', 'duo'].includes(scenario)) throw new Error('Scénario inconnu');
  const nombre = (nom, defaut, min, max, entier = false) => {
    const n = Number(a[nom] ?? defaut);
    if (!Number.isFinite(n) || n < min || n > max || (entier && !Number.isInteger(n))) throw new Error('Valeur invalide : --' + nom);
    return n;
  };
  const taille = (a.taille || '960,540').split(/[x,]/).map(Number);
  if (taille.length !== 2 || taille.some(n => !Number.isInteger(n) || n < 240 || n > 4096)) throw new Error('Taille attendue : largeur,hauteur (240..4096)');
  const choix = (nom, defaut, liste) => { const v = a[nom] || defaut; if (!liste.includes(v)) throw new Error('Valeur invalide : --' + nom); return v; };
  const depart = a.depart ?? (scenario === 'tunnel' ? 'tunnel' : 280);
  if (depart !== 'tunnel' && (!Number.isFinite(Number(depart)) || Number(depart) < 0)) throw new Error('Départ invalide');
  return {
    url: url.href, sortie: path.resolve(a.sortie), reference: a.reference ? path.resolve(a.reference) : null,
    chrome: a.chrome || process.env.CHROME || ['/usr/bin/chromium', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync) || 'google-chrome',
    angle: choix('angle', 'swiftshader', ['swiftshader', 'native']), attendre: nombre('attendre', 60000, 1000, 300000),
    scenario, taille, images: nombre('images', 48, 2, 1000, true), pas: nombre('pas', .1, 1 / 240, .1), chauffe: nombre('chauffe', 4, 0, 240, true),
    // Le catalogue du jeu valide ensuite l'indice exact ; l'outil accompagne son extension par petits lots.
    referenceJeu: { graine: nombre('graine', 17017, 0, 0xffffffff, true), circuit: nombre('circuit', scenario === 'tunnel' ? 2 : 0, 0, 255, true),
      qualite: choix('qualite', 'high', ['low', 'medium', 'high']), mode: scenario === 'duo' ? 'duo' : 'solo',
      vue: choix('vue', 'cockpit', ['cockpit', 'poursuite']),
      vue2: choix('vue2', 'cockpit', ['cockpit', 'poursuite']),
      meteo: choix('meteo', scenario === 'pluie' ? 'pluie' : 'sec', ['sec', 'pluie']),
      moment: choix('moment', 'jour', ['jour', 'crepuscule', 'nuit', 'cycle']),
      saison: choix('saison', 'ete', ['printemps', 'ete', 'automne', 'hiver']),
      partage: choix('partage', 'haut-bas', ['haut-bas', 'cote']), retro: choix('retro', 'oui', ['oui', 'non']),
      decor: choix('decor', 'enrichi', ['reference', 'enrichi']),
      depart: depart === 'tunnel' ? depart : Number(depart), vitesse: nombre('vitesse', 75, 0, 100) }
  };
}

export function horlogeCapture(graine) {
  // Injecté avant le chargement du jeu dans un profil Chrome neuf. performance.now reste réel pour les coûts CPU.
  return `(() => {
    const attente = new Map(); let identifiant = 0, temps = 1000, hasard = ${graine >>> 0};
    Date.now = () => 1700000000000 + ${graine >>> 0} * 128;
    Math.random = () => { hasard = (Math.imul(hasard, 1664525) + 1013904223) >>> 0; return hasard / 4294967296; };
    window.requestAnimationFrame = fn => { const id = ++identifiant; attente.set(id, fn); return id; };
    window.cancelAnimationFrame = id => attente.delete(id);
    window.__BITUME_CAPTURE = { reinitialiser() { temps = 1000; }, avancer(ms) {
      temps += ms;
      const callbacks = Array.from(attente.values()); attente.clear();
      for (const callback of callbacks) callback(temps);
      return { temps, callbacks: callbacks.length, attente: attente.size };
    } };
  })()`;
}

// Le renderer existe avant la fin du démarrage asynchrone (détection du profil). Une référence
// installée trop tôt perturbe cette initialisation. La démo automatique attend ensuite sur le titre.
// Faire vivre les rAF du démarrage et passer le banc matériel par son bouton : le profil demandé
// pour les captures sera ensuite imposé par reference(), sans prétendre mesurer SwiftShader.
export async function attendreDemarrage(evaluer, attendre, dormir = ms => new Promise(r => setTimeout(r, ms))) {
  const fin = Date.now() + attendre;
  let etat = null;
  while (Date.now() <= fin) {
    etat = await evaluer(`(() => {
      const J = window.BITUME_JEU;
      if (!J) return { pret: false, ecran: null };
      J.reglages.demo = 'non'; J.pauseAuto = false;
      const detection = document.getElementById('autodetection');
      if (J.ecran === 'detection' && detection && !detection.hidden)
        document.getElementById('detection-annuler').click();
      const chargement = J.chargement, type = J.session?.type ?? null;
      return { pret: !!J.rendu && J.ecran === 'titre' && (type === null || type === 'vitrine') && !!chargement && !chargement.enCours && !chargement.voile,
        ecran: J.ecran, type, etape: chargement?.etape, preparation: !!chargement?.enCours };
    })()`);
    if (etat.pret) return etat;
    await evaluer('window.__BITUME_CAPTURE?.avancer(1000 / 60)');
    await dormir(10);
  }
  throw new Error('Démarrage du jeu inachevé avant la référence : ' + JSON.stringify(etat));
}

function informationsGit() {
  const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try { return { commit: execFileSync('git', ['-C', racine, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(),
    modifications: execFileSync('git', ['-C', racine, 'status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').filter(Boolean) }; }
  catch { return { commit: null, modifications: null }; }
}

const echapper = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function planche(rapport) {
  const noms = { noire: 'Image sombre', identique: 'Image identique', 'blocs-fugitifs': 'Variation fugitive' };
  const vignettes = rapport.images.map((im, i) => {
    const alertes = rapport.alertes.filter(a => a.image === i);
    return `<figure id="image-${i}"><a href="${im.fichier}" target="_blank"><img src="${im.fichier}" loading="lazy" alt="Capture ${i}"></a><figcaption><strong>${i} · ${im.temps.toFixed(2)} s</strong> · s=${Number(im.etat?.joueurs?.[0]?.s ?? 0).toFixed(1)} m${alertes.map(a => `<span>${echapper(noms[a.type] || a.type)} · ${echapper(a.vue)}</span>`).join('')}</figcaption></figure>`;
  }).join('\n');
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BITUME — contrôle visuel</title><style>
  :root{color-scheme:dark light;font:15px system-ui;background:#14181d;color:#e8edf4}body{margin:24px auto;max-width:1600px;padding:0 16px}h1{font-size:26px}p{line-height:1.6}a{color:#a6d1ff}.grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}figure{margin:0;background:#202832;border-radius:10px;overflow:hidden}img{display:block;width:100%;height:auto}figcaption{padding:10px}figcaption span{display:block;color:#ffc579}code{overflow-wrap:anywhere}pre{white-space:pre-wrap;max-height:20em;overflow:auto;background:#202832;padding:16px} @media(prefers-color-scheme:light){:root{background:#f2f4f7;color:#18222b}figure,pre{background:white}a{color:#175998}figcaption span{color:#915500}}</style>
  <h1>BITUME — ${echapper(rapport.scenario)} · ${echapper(rapport.variante)}</h1><p>${rapport.images.length} captures · ${rapport.alertes.length} alertes à examiner · <a href="rapport.json">Rapport complet</a></p>
  <p>Horloge de simulation commandée : ces images ne mesurent pas les performances. Une ombre, un mouvement rapide ou un éclair légitime peut déclencher une alerte. Cliquer une image pour l’examiner en taille réelle.</p>
  <p>Version ${echapper(rapport.environnement.version || 'N/D')} · ${echapper(rapport.environnement.gpu || 'GPU N/D')}<br>Build : <code>${echapper(rapport.build?.sha256 || 'N/D')}</code></p>
  ${rapport.comparaison ? `<p>Comparaison : ${rapport.comparaison.comparable ? 'réglages identiques ; différences enregistrées dans le rapport' : 'non comparable : ' + echapper(rapport.comparaison.ecarts.join(', '))}.</p>` : ''}
  ${rapport.fatal ? `<pre>${echapper(rapport.fatal)}</pre>` : ''}<div class="grille">${vignettes}</div><details><summary>Paramètres et environnement</summary><pre>${echapper(JSON.stringify({ parametres: rapport.parametres, environnement: rapport.environnement, limites: rapport.limites }, null, 2))}</pre></details></html>`;
}

export async function capturer(o) {
  // Crochets réservés aux scénarios versionnés des outils, jamais lus dans la page ou en ligne de commande.
  // Ils servent à disposer un état visuel et à observer le rendu réel sans ajouter de commandes au jeu livré.
  for (const cle of ['avantNavigation', 'initialiser', 'avantImage', 'observer'])
    if (o[cle] !== undefined && typeof o[cle] !== 'function') throw new Error('Crochet de capture invalide : ' + cle);
  mkdirSync(o.sortie, { recursive: true });
  if (existsSync(path.join(o.sortie, 'rapport.json')) || existsSync(path.join(o.sortie, '0000.png')))
    throw new Error('Dossier déjà utilisé : choisir un dossier neuf pour éviter les captures périmées');
  const { decor, ...conditions } = o.referenceJeu;
  const rapport = { format: 'bitume-controle-visuel', formatVersion: 1, date: new Date().toISOString(), url: o.url,
    scenario: o.scenario, variante: decor, parametres: { ...conditions, images: o.images, pas: o.pas, chauffe: o.chauffe, taille: o.taille, angle: o.angle },
    horloge: { mode: 'raf-commande', departMs: 1000, pasMs: o.pas * 1000, performancesQualifiees: false },
    source: informationsGit(), build: null, environnement: {}, referenceJeu: null, images: [], alertes: [], erreurs: [], avertissements: [], limites: [
      'Temps rAF commandé, aucune conclusion FPS/temps image réel à partir de cette séquence.',
      'Les alertes visuelles sont des candidats à examiner, pas des défauts prouvés.',
      'Le son, les manettes physiques et une partie WebRTC entre machines ne sont pas qualifiés.',
      'Les zones rectangulaires suivent les toiles visibles ; les éléments de HUD superposés peuvent masquer un défaut local.'
    ] };
  if (o.images < 3) rapport.limites.push('Deux images : aucun contrôle de variation fugitive sur trois images.');
  if (o.url.startsWith('file:')) {
    const html = readFileSync(fileURLToPath(o.url));
    rapport.build = { sha256: createHash('sha256').update(html).digest('hex'), octets: html.length };
  }
  const profil = mkdtempSync(path.join(tmpdir(), 'bitume-visuel-'));
  const argumentsChrome = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox', '--remote-debugging-port=0', '--user-data-dir=' + profil,
    '--window-size=' + o.taille.join(','), '--hide-scrollbars'];
  if (o.angle === 'swiftshader') argumentsChrome.push('--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader');
  argumentsChrome.push('about:blank');
  const navigateur = spawn(o.chrome, argumentsChrome, { stdio: ['ignore', 'ignore', 'pipe'], detached: true });
  let erreurLancement = null, stderr = '', ws = null, identifiant = 0, ferme = false;
  const demandes = new Map(), dormir = ms => new Promise(r => setTimeout(r, ms));
  navigateur.on('error', e => { erreurLancement = e; });
  navigateur.on('exit', () => { ferme = true; });
  navigateur.stderr.on('data', d => { stderr = (stderr + d.toString()).slice(-4000); });
  function envoyer(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++identifiant, delai = setTimeout(() => { demandes.delete(id); reject(new Error('DevTools expiré : ' + method)); }, o.attendre);
      demandes.set(id, { resolve, reject, delai });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluer(expression) {
    const r = await envoyer('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result?.value;
  }
  try {
    let port = null;
    const delaiPort = Date.now() + Math.min(o.attendre, 20000);
    while (Date.now() < delaiPort) {
      if (erreurLancement) throw erreurLancement;
      if (ferme) throw new Error('Chrome arrêté : ' + stderr);
      try { port = Number(readFileSync(path.join(profil, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch { /* démarrage */ }
      if (port) break;
      await dormir(60);
    }
    if (!port) throw new Error('Port DevTools introuvable : ' + stderr);
    const liste = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(o.attendre) })).json();
    const cible = liste.find(t => t.type === 'page');
    if (!cible) throw new Error('Aucune page Chrome');
    ws = new WebSocket(cible.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const delai = setTimeout(() => reject(new Error('Connexion DevTools expirée')), o.attendre);
      ws.onopen = () => { clearTimeout(delai); resolve(); }; ws.onerror = () => { clearTimeout(delai); reject(new Error('Connexion DevTools refusée')); };
    });
    ws.onmessage = e => {
      const m = JSON.parse(e.data), attente = demandes.get(m.id);
      if (attente) {
        demandes.delete(m.id); clearTimeout(attente.delai);
        if (m.error) attente.reject(new Error(m.error.message)); else attente.resolve(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        rapport.erreurs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      } else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
        const texte = m.params.args.map(a => String(a.value ?? a.description ?? a.type)).join(' ').slice(0, 1000);
        (m.params.type === 'error' ? rapport.erreurs : rapport.avertissements).push(texte);
      }
    };
    await envoyer('Runtime.enable'); await envoyer('Page.enable');
    await envoyer('Emulation.setDeviceMetricsOverride', { width: o.taille[0], height: o.taille[1], deviceScaleFactor: 1, mobile: false });
    await envoyer('Page.addScriptToEvaluateOnNewDocument', { source: horlogeCapture(o.referenceJeu.graine) });
    if (o.avantNavigation) await o.avantNavigation({ evaluer, envoyer, rapport });
    await envoyer('Page.navigate', { url: o.url });
    rapport.demarrage = await attendreDemarrage(evaluer, o.attendre, dormir);
    if (!await evaluer('typeof BITUME_JEU.reference === "function"')) throw new Error('Ce build doit exposer BITUME_JEU.reference(options) pour les captures reproductibles');
    // L'initialisation PhysX se fait en arrière-plan dans le jeu. Une capture ne doit pas changer de moteur
    // de débris au hasard de la durée réelle d'un rendu : attendre la même promesse avant le premier pas.
    const physx = await evaluer(`(async () => {
      if (!window.FPhysX || !FPhysX.init) return { disponible: false, ready: false, version: null };
      let erreur = null; try { await FPhysX.init(); } catch (e) { erreur = String(e.message || e); }
      const s = FPhysX.status(); return { disponible: true, ready: !!s.ready, version: s.version, erreur };
    })()`);
    await evaluer('__BITUME_CAPTURE.reinitialiser(); true');
    rapport.referenceJeu = await evaluer(`BITUME_JEU.reference(${JSON.stringify(o.referenceJeu)})`);
    await evaluer(`(() => { const J = BITUME_JEU;
      if (J.ecran !== 'course' || J.session?.type !== ${JSON.stringify(o.referenceJeu.mode === 'duo' ? 'duo' : 'course')} || J.session.course.phase !== 'course' || J.chargement.enCours)
        throw new Error('La référence n’a pas installé une course prête');
      globalThis.__BITUME_REFERENCE = J.session;
    })()`);
    await evaluer('BITUME_JEU.pauseAuto = false; BITUME_JEU.mesures = false; true');
    rapport.environnement = await evaluer(`(() => { const gl = BITUME_JEU.rendu.gl, info = gl.getExtension('WEBGL_debug_renderer_info');
      return { navigateur: navigator.userAgent, gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      webgl: gl.getParameter(gl.VERSION), resolution: [innerWidth, innerHeight, devicePixelRatio],
      version: document.querySelector('.version-jeu')?.textContent || null, backend: BITUME_JEU.rendu.stats.backend,
      gpuModeste: BITUME_JEU.gpuModeste, webgl2: BITUME_JEU.rendu.stats.webglVersion === 2 }; })()`);
    rapport.environnement.physx = physx;
    if (/swiftshader|llvmpipe|software/i.test(rapport.environnement.gpu)) rapport.limites.push('Rendu logiciel : aucune performance de GPU réel n’est qualifiée.');
    if (o.initialiser) rapport.initialisation = await o.initialiser({ evaluer, envoyer, rapport });
    for (let i = 0; i < o.chauffe; i++) await evaluer(`__BITUME_CAPTURE.avancer(${o.pas * 1000})`);
    for (let i = 0; i < o.images; i++) {
      if (o.avantImage) await o.avantImage({ evaluer, envoyer, rapport, i });
      const horloge = await evaluer(`__BITUME_CAPTURE.avancer(${o.pas * 1000})`);
      const etat = await evaluer(`(() => { const S = BITUME_JEU.session, zones = {}; const ids = ['scene','scene2','glace-g','glace-d','glace-g2','glace-d2'];
        for (const id of ids) { const e = document.getElementById(id); if (!e) continue; const r = e.getBoundingClientRect(), s = getComputedStyle(e);
          if (r.width > 1 && r.height > 1 && !e.hidden && s.display !== 'none' && s.visibility !== 'hidden' && r.right > 0 && r.bottom > 0 && r.x < innerWidth && r.y < innerHeight)
            zones[id] = { x: Math.max(0,r.x), y: Math.max(0,r.y), width: Math.min(innerWidth,r.right)-Math.max(0,r.x), height: Math.min(innerHeight,r.bottom)-Math.max(0,r.y) };
        }
        return { ecran: BITUME_JEU.ecran, phase: S.course.phase, referenceConservee: S === __BITUME_REFERENCE, horloge: S.course.horloge, meteo: S.meteo.phase,
          joueurs: (S.locaux || [0]).map(id => { const e = S.course.voitures[id].etat; return { id, s:e.s, d:e.d, v:e.v }; }),
          lumiere: S.lumiere, lumiereJ2: S.vueJ2?.lumiere, reflets: S.refletsEcran, zones }; })()`);
      if (!etat.referenceConservee) throw new Error('La séance de référence a été remplacée pendant la capture');
      if (!(o.ecrans || ['course']).includes(etat.ecran) || !['course', 'arrivee'].includes(etat.phase)) throw new Error('La séquence a quitté la course : ' + etat.ecran + '/' + etat.phase);
      if (!etat.zones.scene) throw new Error('Toile principale absente de la capture');
      if (o.referenceJeu.mode === 'duo' && !etat.zones.scene2) throw new Error('Toile J2 absente de la capture duo');
      const capture = await envoyer('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const png = Buffer.from(capture.data, 'base64'), image = decoderPng(png), vues = {};
      for (const [vue, zone] of Object.entries(etat.zones)) vues[vue] = mesurerImage(image, zone);
      const fichier = String(i).padStart(4, '0') + '.png';
      writeFileSync(path.join(o.sortie, fichier), png);
      const observation = o.observer ? await o.observer({ evaluer, envoyer, rapport, i }) : undefined;
      rapport.images.push({ fichier, temps: (horloge.temps - 1000) / 1000, etat, vues, observation });
      if (i % 8 === 0 || i === o.images - 1) process.stderr.write(`capture ${i + 1}/${o.images}\n`);
    }
    rapport.alertes = analyserSequence(rapport.images);
    if (o.reference) {
      const reference = JSON.parse(readFileSync(o.reference, 'utf8'));
      if (reference.format !== rapport.format || reference.formatVersion !== rapport.formatVersion) throw new Error('Format de rapport de référence incompatible');
      rapport.comparaison = comparerSequences(reference, rapport);
      rapport.comparaison.reference = o.reference;
    }
  } catch (e) {
    rapport.fatal = e.stack || String(e);
    rapport.alertes = analyserSequence(rapport.images);
  } finally {
    for (const demande of demandes.values()) { clearTimeout(demande.delai); demande.reject(new Error('Capture terminée')); }
    demandes.clear();
    try { ws?.close(); } catch { /* déjà fermé */ }
    try { process.kill(-navigateur.pid, 'SIGKILL'); } catch { try { navigateur.kill('SIGKILL'); } catch { /* déjà arrêté */ } }
    await dormir(100);
    try { rmSync(profil, { recursive: true, force: true }); } catch { /* le rapport reste disponible */ }
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(rapport, null, 2) + '\n');
    writeFileSync(path.join(o.sortie, 'index.html'), planche(rapport));
  }
  return rapport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = optionsCapture(process.argv.slice(2));
    if (options.aide) console.log(aide);
    else {
      const r = await capturer(options);
      console.log(JSON.stringify({ dossier: options.sortie, images: r.images.length, alertes: r.alertes.length,
        erreurs: r.erreurs, fatal: r.fatal || null, comparaison: r.comparaison ? { comparable: r.comparaison.comparable, ecarts: r.comparaison.ecarts } : null }, null, 2));
      if (r.fatal || r.erreurs.length || r.comparaison?.comparable === false) process.exitCode = 1;
    }
  } catch (e) { console.error(e.message); console.error(aide); process.exitCode = 2; }
}
