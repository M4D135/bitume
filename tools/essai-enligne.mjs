// Essai réel du jeu en ligne sans serveur : plusieurs Chrome sans interface, chacun avec son profil jetable, ouvrent
// la page du jeu (fichier local), se trouvent par le code (relais publics) ou par l'invitation à la main, passent par
// « Avant le départ » puis courent ensemble, l'ordinateur au volant de chaque voiture. Le rapport donne le temps de
// mise en relation, le relais qui a servi, les liaisons (directes ou relayées par une machine), l'âge et le débit des
// états reçus en course, l'écart entre ce que chaque machine affiche d'une voiture et ce qu'en dit son pilote, et la
// reprise par l'ordinateur des voitures d'une machine qui part.
//
//   node tools/essai-enligne.mjs --scenario code --machines 2 [--duree 20] [--sortie rapport.json]
//   Scénarios :
//     code           code de partie, relais publics (MQTT, WebTorrent, Nostr)
//     main           invitation à la main, sans relais (?relais=aucun) ; le code QR est relu dans la page
//     sans-internet  résolution de noms coupée dans Chrome : relais et STUN injoignables, invitation à la main
//     tiers          code ; deux invités sans liaison directe entre eux : leur course passe par l'hôte
//     par-invite     code ; le troisième n'atteint pas l'hôte : il entre par l'autre invité
//   --relais mqtt,torrent : familles gardées (scénarios par code) ; --course non : mise en relation seule ;
//   --page fichier.html (défaut dist/bitume.html) ; --chrome binaire ; --qr fichier.png (copie du code QR, hors dépôt)
//
// Limite à garder en tête : toutes les machines sont des navigateurs de ce Mac. Leurs liaisons passent par la boucle
// locale ou le réseau de la maison ; cela ne prouve pas la traversée de deux box différentes (NAT symétrique,
// pare-feu d'entreprise, réseau mobile). Le rapport ne garde ni code de partie, ni description de session, ni adresse.
// Aucune dépendance : Node 22 et plus (WebSocket global).

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const scenario = args.scenario || 'code';
if (!['code', 'main', 'sans-internet', 'tiers', 'par-invite'].includes(scenario)) { console.error('scénario inconnu : ' + scenario); process.exit(2); }
const nb = Math.max(2, Math.min(4, Number(args.machines || (scenario === 'tiers' || scenario === 'par-invite' ? 3 : 2))));
if ((scenario === 'tiers' || scenario === 'par-invite') && nb < 3) { console.error('il faut trois machines pour ce scénario'); process.exit(2); }
const duree = Number(args.duree ?? 20), avecCourse = args.course !== 'non';
const page = path.resolve(args.page || path.join(ici, '..', 'dist', 'bitume.html'));
const chrome = args.chrome || process.env.CHROME || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const parCode = ['code', 'tiers', 'par-invite'].includes(scenario);
const requete = scenario === 'main' ? '?relais=aucun' : parCode && args.relais ? '?relais=' + args.relais : '';
const NOMS = ['Essai H', 'Essai A', 'Essai B', 'Essai C'];
const dormir = ms => new Promise(r => setTimeout(r, ms));
const debutEssai = Date.now();

// ------------------------------------------------ un navigateur piloté par DevTools
class Navigateur {
  constructor(nom, extra = []) {
    this.nom = nom; this.profil = mkdtempSync(path.join(tmpdir(), 'bitume-enligne-'));
    this.requetes = new Map(); this.suivant = 1; this.erreurs = []; this.exceptions = [];
    writeFileSync(path.join(this.profil, 'Local State'), JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } }));
    const a = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0', '--user-data-dir=' + this.profil,
      '--window-size=800,520', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required', ...extra, 'about:blank'];
    this.processus = spawn(chrome, a, { stdio: ['ignore', 'ignore', 'pipe'], detached: true });
    this.stderr = '';
    this.processus.stderr.on('data', d => { this.stderr = (this.stderr + d).slice(-8000); });
    this.processus.on('error', e => { this.lancement = e; });
  }
  async ouvrir() {
    let port = null;
    for (let i = 0; i < 300 && !port; i++) {
      if (this.lancement) throw this.lancement;
      try { const l = readFileSync(path.join(this.profil, 'DevToolsActivePort'), 'utf8').split('\n'); if (l[0] && l[1]) port = l[0]; } catch (e) { /* pas encore écrit */ }
      if (!port) await dormir(50);
    }
    if (!port) throw new Error(this.nom + ' : port DevTools introuvable\n' + this.stderr.slice(-600));
    const cible = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
    this.ws = new WebSocket(cible.webSocketDebuggerUrl);
    await new Promise((ok, ko) => { this.ws.onopen = ok; this.ws.onerror = () => ko(new Error('DevTools refusé')); });
    this.ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && this.requetes.has(m.id)) { const q = this.requetes.get(m.id); this.requetes.delete(m.id); clearTimeout(q.minuteur); m.error ? q.ko(new Error(m.error.message)) : q.ok(m.result); return; }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error' && this.erreurs.length < 30) this.erreurs.push((m.params.args || []).map(x => x.value !== undefined ? x.value : (x.description || x.type)).join(' ').slice(0, 300));
      else if (m.method === 'Runtime.exceptionThrown' && this.exceptions.length < 30) this.exceptions.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 400));
    };
    await this.envoyer('Runtime.enable'); await this.envoyer('Page.enable');
    await this.envoyer('Emulation.setDeviceMetricsOverride', { width: 800, height: 520, deviceScaleFactor: 1, mobile: false });
  }
  envoyer(methode, params = {}, delai = 60000) {
    return new Promise((ok, ko) => {
      const id = this.suivant++, minuteur = setTimeout(() => { this.requetes.delete(id); ko(new Error(this.nom + ' : DevTools expiré, ' + methode)); }, delai);
      this.requetes.set(id, { ok, ko, minuteur });
      this.ws.send(JSON.stringify({ id, method: methode, params }));
    });
  }
  async evaluer(expression, delai) {
    const r = await this.envoyer('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, delai);
    if (r.exceptionDetails) throw new Error(this.nom + ' : ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result?.value;
  }
  async attendre(expression, delai, etiquette) {
    const fin = Date.now() + delai;
    for (;;) {
      let v = false;
      try { v = await this.evaluer(expression); } catch (e) { /* page en cours de chargement */ }
      if (v) return Date.now();
      if (Date.now() > fin) throw new Error(this.nom + ' : expiré, ' + etiquette);
      await dormir(100);
    }
  }
  fermer() {
    try { this.ws && this.ws.close(); } catch (e) { /* déjà fermé */ }
    try { process.kill(-this.processus.pid, 'SIGTERM'); } catch (e) { /* déjà parti */ }
    setTimeout(() => { try { rmSync(this.profil, { recursive: true, force: true }); } catch (e) { /* profil verrouillé */ } }, 800);
  }
}

// ------------------------------------------------ expressions évaluées dans la page
const J = 'BITUME_JEU', EL = 'BITUME_JEU.enLigne';
const REUNI = `(() => { const R = ${EL}.R; return !!R && R.etat === 'connecte' && R.membres.length === ${nb} && R.membres.every(m => m.id === R.id || R.pretAvec(m.id)); })()`;
const LIENS = `(() => { const R = ${EL}.R; if (!R) return null; return { id: R.id, role: R.role, membres: R.membres.map(m => ({ id: m.id, nom: m.nom, joueurs: m.joueurs })),
  pairs: [...R.pairs.values()].map(p => ({ id: p.id, pret: p.pret, relais: p.relais, via: p.via })), etat: R.etat, synchro: R.synchro, rtt: Math.round(R.rtt),
  affichage: [...document.querySelectorAll('#l-pilotes li')].map(li => li.textContent) }; })()`;
const SIGNALISATION = `(() => { const R = ${EL}.R; if (!R) return null; const s = R.signalisation;
  return { mode: s.mode, premiers: s.premiers, relais: R.relaisEtat(), transports: s.transports, journal: s.journal, statut: R.statut,
    ligne: document.getElementById('l-relais').textContent, etat: document.getElementById('l-etat').textContent }; })()`;
const SONDE = `(() => { const S = ${J}.session, R = ${EL}.R; if (!S || !S.course || !S.enLigne || !R) return null; const co = S.course;
  return { h: R.horloge(), w: Date.now(), horloge: co.horloge, L: co.c.longueur, moi: R.id,
    v: co.voitures.map(v => [v.id, v.etat.s, v.etat.d, v.etat.v, v.distant ? 1 : 0, v.humain ? 1 : 0, v.reprise ? 1 : 0]),
    recus: [...${EL}.recus].map(([id, r]) => [id, R.horloge() - r.t]) }; })()`;

const rapport = { date: new Date().toISOString(), scenario, machines: nb, duree: avecCourse ? duree : 0, requete: requete || null,
  page: null, navigateur: null, contexteSecurise: null, limites: [
    'Toutes les machines sont des navigateurs Chrome sans interface de ce Mac : leurs liaisons passent par la boucle locale ou le réseau de la maison. Cela ne prouve pas la traversée de deux box différentes.',
    'Relais publics tiers : leur disponibilité au moment de l’essai ne promet rien pour demain.'],
  mise_en_relation: {}, invitation: null, liens: {}, course: null, depart: null, erreurs: {} };
const machines = [];
let code = 0;
try {
  const html = readFileSync(page);
  rapport.page = { fichier: path.relative(path.join(ici, '..'), page), sha256: createHash('sha256').update(html).digest('hex').slice(0, 16), octets: html.length };
  // sans Internet : plus aucun nom ne se résout (relais, STUN) ; les noms .local des candidats WebRTC restent
  const extra = scenario === 'sans-internet' ? ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE *.local'] : [];
  for (let i = 0; i < nb; i++) machines.push(new Navigateur(NOMS[i], extra));
  await Promise.all(machines.map(m => m.ouvrir()));
  const url = pathToFileURL(page).href + requete;
  await Promise.all(machines.map(async (m, i) => {
    await m.envoyer('Page.navigate', { url });
    await m.attendre(`!!(window.BITUME && window.${J} && ${J}.rendu)`, 120000, 'le jeu ne démarre pas');
    await m.attendre(`(() => { const a = document.getElementById('autodetection'); if (a && !a.hidden) { document.getElementById('detection-annuler').click(); return false; } return ${J}.ecran === 'titre'; })()`, 120000, 'écran titre');
    // réglages légers et fixes : qualité basse (trois jeux sur un seul processeur graphique), conditions manuelles
    // (le mode réel interrogerait la météo), nom de la machine
    await m.evaluer(`(() => { const R = ${J}.reglages; Object.assign(R, { nom: ${JSON.stringify(NOMS[i])}, qualite: 'low', circuit: 0, tours: 3, meteo: 'soleil', saison: 'ete', moment: 'jour',
      saisonMode: 'manuel', momentMode: 'manuel', meteoMode: 'manuel', secousses: 0, vibrations: 'non', joueursLocaux: 1 });
      try { ${J}.rendu.resize(${J}.profil.rendu.resolution); } catch (e) {}
      ${J}.pauseAuto = false; document.getElementById('l-nom').value = R.nom;
      document.querySelector('[data-aller="enligne"]').click(); return true; })()`);
    await m.attendre(`${J}.ecran === 'enligne'`, 15000, 'écran En ligne');
  }));
  const H = machines[0], invites = machines.slice(1);
  rapport.navigateur = await H.evaluer('navigator.userAgent');
  rapport.contexteSecurise = await H.evaluer('isSecureContext && !!(crypto && crypto.subtle)');

  // ------------------------------------------------ mise en relation
  const pid = m => m.evaluer(`${EL}.R && ${EL}.R.pid`);
  if (parCode) {
    const t0 = Date.now();
    await H.evaluer(`document.getElementById('l-creer').click(); true`);
    await H.attendre(`!!(${EL}.R && ${EL}.R.code && !document.getElementById('l-code-affiche').hidden)`, 20000, 'code de la partie');
    const affiche = await H.evaluer(`document.getElementById('l-code-affiche').textContent`);
    await H.attendre(`${EL}.R.relaisEtat().prets > 0`, 20000, 'premier relais de l’hôte');
    rapport.mise_en_relation[H.nom] = { role: 'hôte', code_affiche: /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/.test(affiche) ? 'XXXXX-XXXXX' : 'format inattendu', premier_relais_ms: Date.now() - t0 };
    for (const [k, G] of invites.entries()) {
      // tiers : les deux invités ne se joignent pas en direct ; par-invite : le dernier ne joint pas l'hôte
      const sans = scenario === 'tiers' && k === 1 ? [invites[0]] : scenario === 'par-invite' && k === 1 ? [H] : [];
      const tClic = Date.now();
      await G.evaluer(`(() => { const c = document.getElementById('l-code'); c.value = ${JSON.stringify(affiche)}; c.dispatchEvent(new Event('input'));
        document.getElementById('l-rejoindre').click(); return true; })()`);
      if (sans.length) {
        const gp = await pid(G);
        for (const autre of sans) {
          const ap = await pid(autre);
          await G.evaluer(`${EL}.R.essai.sansDirect.add(${JSON.stringify(ap)}), true`);
          await autre.evaluer(`${EL}.R.essai.sansDirect.add(${JSON.stringify(gp)}), true`);
        }
      }
      const tAdmis = await G.attendre(`${EL}.R && ${EL}.R.id > 0`, 60000, 'admission');
      await Promise.all(machines.slice(0, k + 2).map(m => m.attendre(`(() => { const R = ${EL}.R; return !!R && R.membres.length === ${k + 2} && R.membres.every(m => m.id === R.id || R.pretAvec(m.id)); })()`, 60000, 'liaisons')));
      const tLie = Date.now();
      const s = await G.evaluer(SIGNALISATION);
      const j = s.journal, premier = q => { const e = j.find(x => x.quoi === q); return e ? e.t : null; };
      const offre = j.find(x => x.quoi === 'offre reçue');
      rapport.mise_en_relation[G.nom] = { role: 'invité', clic_a_admis_ms: tAdmis - tClic, clic_a_tous_lies_ms: tLie - tClic,
        journal_ms: { premier_relais: premier('relais prêt'), offre_recue: premier('offre reçue'), canaux_ouverts: premier('canaux ouverts'), bienvenue: premier('bienvenue') },
        offre_par: offre ? offre.voie : null, premiers_par_famille: s.premiers, relais: s.relais, transports: s.transports, sans_direct_avec: sans.map(x => x.nom) };
    }
  } else {
    // invitation à la main : l'hôte invite, chaque invité colle et renvoie sa réponse, l'hôte la colle
    const tInv = Date.now();
    await H.evaluer(`document.getElementById('l-inviter').click(); true`);
    rapport.invitation = { machines: [] };
    for (const [k, G] of invites.entries()) {
      if (k > 0) {
        await H.attendre(`!document.getElementById('l-inviter-plus').hidden`, 30000, 'bouton d’une nouvelle invitation');
        await H.evaluer(`document.getElementById('l-inviter-plus').click(); true`);
      }
      const t1 = Date.now();
      await H.attendre(`!document.getElementById('l-main-envoi').hidden && document.getElementById('l-main-texte').value.length > 40`, 30000, 'invitation prête');
      const tPrete = Date.now();
      const inv = await H.evaluer(`document.getElementById('l-main-texte').value`);
      // le code QR dessiné, relu par le détecteur du navigateur quand il existe ; nombre de candidats par nature
      const qr = await H.evaluer(`(async () => { const c = document.getElementById('l-qr'), t = document.getElementById('l-main-texte').value, q = BITUME.reseau.qr(t);
        const r = { cache: c.hidden, cote_px: c.width, version: q && q.version, niveau: q && q.niveau, relu: null };
        if (typeof BarcodeDetector === 'function') { try { const d = await new BarcodeDetector({ formats: ['qr_code'] }).detect(c); r.relu = d.length ? d[0].rawValue === t : false; } catch (e) { r.relu = 'détecteur : ' + e.message; } }
        else r.relu = 'BarcodeDetector absent';
        const sdp = BITUME.reseau.interne.lireInvitation(t).sdp || '';
        r.candidats = { hote: (sdp.match(/ typ host/g) || []).length, srflx: (sdp.match(/ typ srflx/g) || []).length, mdns: (sdp.match(/\\.local /g) || []).length };
        if (${JSON.stringify(!!args.qr)}) r.png = c.toDataURL('image/png');
        return r; })()`);
      if (qr.png) { writeFileSync(args.qr, Buffer.from(qr.png.split(',')[1], 'base64')); writeFileSync(args.qr + '.txt', inv); delete qr.png; }
      const tColle = Date.now();
      await G.evaluer(`(() => { document.getElementById('l-coller').click(); document.getElementById('l-main-saisie').value = ${JSON.stringify(inv)};
        document.getElementById('l-main-valider').click(); return true; })()`);
      await G.attendre(`!document.getElementById('l-main-envoi').hidden && document.getElementById('l-main-texte').value.length > 40`, 30000, 'réponse de l’invité');
      const tReponse = Date.now();
      const rep = await G.evaluer(`document.getElementById('l-main-texte').value`);
      // la réponse aussi doit porter une adresse publique (srflx) : sans elle, deux box ordinaires ne se joignent pas
      const repCand = await G.evaluer(`(() => { const sdp = BITUME.reseau.interne.lireInvitation(${JSON.stringify(rep)}).sdp || '';
        return { hote: (sdp.match(/ typ host/g) || []).length, srflx: (sdp.match(/ typ srflx/g) || []).length, mdns: (sdp.match(/\\.local /g) || []).length }; })()`);
      await H.evaluer(`(() => { document.getElementById('l-main-saisie').value = ${JSON.stringify(rep)}; document.getElementById('l-main-valider').click(); return true; })()`);
      const tRendue = Date.now();
      await Promise.all(machines.slice(0, k + 2).map(m => m.attendre(`(() => { const R = ${EL}.R; return !!R && R.membres.length === ${k + 2} && R.membres.every(m => m.id === R.id || R.pretAvec(m.id)); })()`, 60000, 'liaisons')));
      const tLie = Date.now();
      rapport.invitation.machines.push({ invite: G.nom, invitation_caracteres: inv.length, reponse_caracteres: rep.length, qr, reponse_candidats: repCand,
        preparation_invitation_ms: tPrete - (k ? t1 : tInv), preparation_reponse_ms: tReponse - tColle, reponse_collee_a_tous_lies_ms: tLie - tRendue });
    }
    for (const m of machines) rapport.mise_en_relation[m.nom] = await m.evaluer(SIGNALISATION);
  }
  for (const m of machines) rapport.liens[m.nom] = await m.evaluer(LIENS);
  // admis dès qu'un chemin existe ; les liaisons directes qui manquent (entre invités) suivent : combien de temps
  if (scenario !== 'tiers' && scenario !== 'par-invite') {
    const t = Date.now();
    try { await Promise.all(machines.map(m => m.attendre(`[...${EL}.R.pairs.values()].every(p => p.pret && !p.relais)`, 30000, 'maillage direct'))); rapport.maillage_direct_apres_ms = Date.now() - t; }
    catch (e) { rapport.maillage_direct_apres_ms = 'incomplet après 30 s'; }
  }
  // l'horloge commune réglée chez chaque invité avant le départ
  await Promise.all(invites.map(m => m.attendre(`${EL}.R.synchro`, 15000, 'horloge commune')));

  // ------------------------------------------------ course : « Avant le départ », puis la course, l'ordinateur au volant
  if (avecCourse) {
    await H.attendre(`!document.getElementById('l-choisir').hidden`, 10000, 'bouton Choisir la course');
    await H.evaluer(`document.getElementById('l-choisir').click(); true`);
    await H.attendre(`${J}.ecran === 'preparation' && !document.getElementById('b-depart').disabled`, 30000, 'préparation de l’hôte');
    await H.evaluer(`document.getElementById('b-depart').click(); true`);
    await Promise.all(machines.map(m => m.attendre(`${J}.ecran === 'prets'`, 20000, 'écran Avant le départ')));
    for (const m of machines) await m.evaluer(`(() => { ${J}.pilotageAuto = true; window.__paquets = {}; ${EL}.R.on('etat', (p, de) => { window.__paquets[de] = (window.__paquets[de] || 0) + 1; });
      document.getElementById('pr-pret').click(); return true; })()`);
    const tPret = Date.now();
    await Promise.all(machines.map(m => m.attendre(`${J}.ecran === 'course' && !!${J}.session && !!${J}.session.enLigne`, 30000, 'départ de la course')));
    const tCourse = Date.now();
    // on attend le départ réel (T0 sur l'horloge commune), puis on relève toutes les 250 ms
    await Promise.all(machines.map(m => m.attendre(`${J}.session.course.horloge > 0.5`, 30000, 'horloge de course')));
    await Promise.all(machines.map(m => m.evaluer('window.__paquets = {}, true')));
    const releves = machines.map(() => []), debut = Date.now();
    while (Date.now() - debut < duree * 1000) {
      const r = await Promise.all(machines.map(m => m.evaluer(SONDE).catch(() => null)));
      r.forEach((x, i) => { if (x) releves[i].push(x); });
      await dormir(250);
    }
    const paquets = await Promise.all(machines.map(m => m.evaluer('window.__paquets')));
    rapport.liens_fin_course = {};
    for (const m of machines) rapport.liens_fin_course[m.nom] = await m.evaluer(LIENS);
    rapport.course = analyserCourse(releves, paquets, Date.now() - debut, tCourse - tPret);
    // une machine part en pleine course : l'hôte confie ses voitures à l'ordinateur
    const D = machines[nb - 1], idD = (await D.evaluer(`${EL}.R.id`)) | 0;
    const humains = await H.evaluer(`${J}.session.enLigne.humains.map(h => h.machine)`);
    const sesVoitures = humains.map((m, k) => m === idD ? k : -1).filter(k => k >= 0);
    const avant = await H.evaluer(SONDE), tFermer = Date.now();
    await D.evaluer(`${EL}.R.fermer(), true`);
    await H.attendre(`(() => { const S = ${J}.session; return ${JSON.stringify(sesVoitures)}.every(k => S.course.voitures[k].reprise && !S.course.voitures[k].distant); })()`, 15000, 'reprise par l’ordinateur');
    const t1 = Date.now();
    await dormir(2000);
    const apres = await H.evaluer(SONDE);
    const ecartS = k => { const a = avant.v.find(x => x[0] === k), b = apres.v.find(x => x[0] === k); let ds = b[1] - a[1]; if (ds < -apres.L / 2) ds += apres.L; return +ds.toFixed(1); };
    rapport.depart = { machine: D.nom, voitures: sesVoitures, reprise_constatee: true, avance_m_apres_depart: sesVoitures.map(ecartS),
      membres_restants: await Promise.all(machines.slice(0, nb - 1).map(m => m.evaluer(`${EL}.R.membres.length`))), delai_reprise_ms: t1 - tFermer };
  }
} catch (e) {
  code = 1;
  rapport.echec = String(e && e.stack || e).slice(0, 1500);
  console.error(e);
  for (const m of machines) { try { rapport.mise_en_relation[m.nom + ' (état à l’échec)'] = await m.evaluer(SIGNALISATION); } catch (x) { /* page perdue */ } }
} finally {
  for (const m of machines) rapport.erreurs[m.nom] = { console: m.erreurs, exceptions: m.exceptions };
  rapport.duree_essai_s = Math.round((Date.now() - debutEssai) / 1000);
  const texte = JSON.stringify(rapport, null, 1);
  if (args.sortie) writeFileSync(args.sortie, texte + '\n');
  console.log(resume(rapport));
  for (const m of machines) m.fermer();
  setTimeout(() => process.exit(code), 1200);
}

// ------------------------------------------------ dépouillement de la course
function quantiles(x) {
  if (!x.length) return null;
  const t = [...x].sort((a, b) => a - b), q = p => t[Math.min(t.length - 1, Math.floor(p * t.length))];
  return { n: t.length, p50: +q(.5).toFixed(2), p95: +q(.95).toFixed(2), max: +t[t.length - 1].toFixed(2) };
}
function analyserCourse(releves, paquets, dureeMs, attenteDepartMs) {
  const r = { duree_ms: dureeMs, pret_a_course_ms: attenteDepartMs, machines: {}, accord: {} };
  // propriétaire de chaque voiture : la machine où elle n'est pas « distante »
  const proprio = new Map();
  releves.forEach((liste, i) => { const x = liste[liste.length - 1]; if (x) for (const v of x.v) if (!v[4]) proprio.set(v[0], i); });
  releves.forEach((liste, i) => {
    if (liste.length < 2) { r.machines[NOMS[i]] = { releves: liste.length }; return; }
    const a = liste[0], b = liste[liste.length - 1];
    const ages = {};
    for (const x of liste) for (const [id, age] of x.recus) (ages[id] || (ages[id] = [])).push(age);
    const agesQ = {};
    for (const id of Object.keys(ages)) if (proprio.get(+id) !== i) agesQ[id] = quantiles(ages[id]);
    const locales = b.v.filter(v => !v[4]).map(v => v[0]);
    r.machines[NOMS[i]] = { releves: liste.length, cadence_simulation: +((b.horloge - a.horloge) * 1000 / (b.w - a.w)).toFixed(3),
      voitures_locales: locales, paquets_recus_par_machine: paquets[i] || {},
      paquets_par_seconde: Object.fromEntries(Object.entries(paquets[i] || {}).map(([de, n]) => [de, +(n / (dureeMs / 1000)).toFixed(1)])),
      age_etat_ms_par_voiture: agesQ };
  });
  // écart entre la voiture affichée par une machine et ce qu'en dit son pilote au même instant de l'horloge commune
  for (const [id, p] of proprio) {
    const ds = [], dd = [];
    releves.forEach((liste, i) => {
      if (i === p) return;
      for (const x of liste) {
        const ref = releves[p].reduce((m, y) => Math.abs(y.h - x.h) < Math.abs(m.h - x.h) ? y : m, releves[p][0]);
        if (!ref || Math.abs(ref.h - x.h) > 200) continue;
        const v = x.v.find(z => z[0] === id), w = ref.v.find(z => z[0] === id);
        if (!v || !w) continue;
        let e = v[1] - (w[1] + w[3] * (x.h - ref.h) / 1000);
        if (e > x.L / 2) e -= x.L; else if (e < -x.L / 2) e += x.L;
        ds.push(Math.abs(e)); dd.push(Math.abs(v[2] - w[2]));
      }
    });
    if (ds.length) r.accord[id] = { pilote: NOMS[p], ecart_long_m: quantiles(ds), ecart_lateral_m: quantiles(dd) };
  }
  return r;
}
function resume(r) {
  const l = ['essai en ligne : ' + r.scenario + ', ' + r.machines + ' machines' + (r.echec ? ' — ÉCHEC' : '')];
  for (const [nom, m] of Object.entries(r.mise_en_relation)) if (m && m.clic_a_admis_ms != null) l.push('  ' + nom + ' : admis en ' + m.clic_a_admis_ms + ' ms, tous liés en ' + m.clic_a_tous_lies_ms + ' ms, offre par ' + m.offre_par);
  if (r.invitation) for (const m of r.invitation.machines) l.push('  ' + m.invite + ' : invitation ' + m.invitation_caracteres + ' car. (QR v' + m.qr.version + ', relu : ' + m.qr.relu + '), réponse ' + m.reponse_caracteres + ' car., liés ' + m.reponse_collee_a_tous_lies_ms + ' ms après la réponse');
  for (const [nom, x] of Object.entries(r.liens_fin_course || r.liens)) if (x) l.push('  ' + nom + ' : ' + x.pairs.map(p => 'vers ' + p.id + (p.pret ? p.relais ? ' relayée par ' + p.via : ' directe' : ' en attente')).join(', '));
  if (r.maillage_direct_apres_ms != null) l.push('  maillage direct complet ' + r.maillage_direct_apres_ms + ' ms après les admissions');
  if (r.course) {
    for (const [nom, m] of Object.entries(r.course.machines)) l.push('  ' + nom + ' : cadence ' + m.cadence_simulation + ', paquets/s ' + JSON.stringify(m.paquets_par_seconde) + ', âge p95 ' + JSON.stringify(Object.fromEntries(Object.entries(m.age_etat_ms_par_voiture || {}).map(([k, q]) => [k, q && q.p95]))));
    l.push('  accord (écart longitudinal p95, m) : ' + JSON.stringify(Object.fromEntries(Object.entries(r.course.accord).map(([k, a]) => [k, a.ecart_long_m.p95]))));
  }
  if (r.depart) l.push('  départ de ' + r.depart.machine + ' : voitures ' + r.depart.voitures.join(',') + ' reprises, avance ' + r.depart.avance_m_apres_depart.join(',') + ' m en 2 s');
  const err = Object.entries(r.erreurs).filter(([, e]) => e.console.length || e.exceptions.length);
  if (err.length) l.push('  erreurs : ' + JSON.stringify(err).slice(0, 600));
  return l.join('\n');
}
