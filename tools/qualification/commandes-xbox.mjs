#!/usr/bin/env node
// Parcours natif du vrai HTML : profil Xbox/4K et Gamepad API simulés, sans banc FPS.
// Les entrées et le temps sont prescrits ; ni commandes de conduite ni résultats de rendu ne le sont.
import { argumentsWebGPU } from '../diagnostic-webgpu.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { horlogeCapture } from '../controle-visuel.mjs';
import { instrumenterDemarrageMobile, verifierMesureGraphique } from './demarrage-mobile.mjs';

export const UA_XBOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0';

export function optionsCommandesXbox(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const cle = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url', 'sortie', 'chrome'].includes(cle) ||
        !argv[i + 1] || argv[i + 1].startsWith('--') || o[cle]) throw new Error('Option invalide : ' + argv[i]);
    o[cle] = argv[i + 1];
  }
  if (!o.url || !o.sortie) throw new Error('--url et --sortie nécessaires');
  if (new URL(o.url).protocol !== 'file:') throw new Error('Le HTML local exact est requis');
  o.sortie = path.resolve(o.sortie);
  o.chrome ||= process.env.CHROME || '/usr/bin/google-chrome';
  return o;
}

export function instrumenterXbox() {
  const trace = globalThis.__BITUME_XBOX = {
    lectures: 0, vibrations: 0, pointeur: 0, commandes: 0, derniereCommande: null,
    pads: [{ index: 0, id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', connected: true,
      mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) }]
  };
  trace.pads[0].vibrationActuator = {
    playEffect() { trace.vibrations++; return Promise.resolve('complete'); },
    reset() { return Promise.resolve('complete'); }
  };
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => {
    trace.lectures++;
    return trace.pads.map(p => p.connected ? p : null);
  } });
  Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
  for (const type of ['pointermove', 'pointerdown', 'pointerup'])
    addEventListener(type, () => trace.pointeur++, { capture: true });
}

export function observerConduiteXbox() {
  const trace = __BITUME_XBOX, originale = BITUME.conduite.pas;
  if (trace.observeConduite) return;
  trace.observeConduite = true;
  BITUME.conduite.pas = function (etat, commande, ...args) {
    if (etat === BITUME_JEU.session?.course?.joueur?.etat) {
      trace.commandes++;
      trace.derniereCommande = { gaz: commande.gaz, frein: commande.frein, volant: commande.volant,
        derive: commande.derive, haut: commande.haut, bas: commande.bas };
    }
    return Reflect.apply(originale, this, [etat, commande, ...args]);
  };
}

export function releverXbox() {
  const J = BITUME_JEU, trace = __BITUME_XBOX, profil = __BITUME_MOBILE;
  const toile = document.getElementById('scene'), gpu = J.rendu?.gpu, S = J.session, chargement = J.chargement;
  return {
    ecran: J.ecran, etape: J.menuArcade.etape, type: S?.type, phase: S?.course?.phase,
    reference: !!S?.reference, pilotageAuto: J.pilotageAuto,
    horloge: S?.course?.horloge, feux: S?.course?.feux, cadence: J.cadence,
    chargement: { enCours: chargement.enCours, voile: chargement.voile, etape: chargement.etape },
    modeCommandes: J.reglages.commandes || ['auto', 'auto'],
    statutPreparation: document.getElementById('p-manettes')?.textContent || '',
    qualite: J.reglages.qualite, manettes: J.reglages.manettes,
    stocke: JSON.parse(localStorage.getItem('bitume.reglages')),
    cache: JSON.parse(localStorage.getItem(BITUME.autoconfig.CLE)),
    stockageInitial: profil.stockageInitial, appels: { ...profil.appels }, surveilles: { ...profil.surveilles },
    viewport: [innerWidth, innerHeight, devicePixelRatio], userAgent: navigator.userAgent,
    framebuffer: gpu ? [gpu.context.canvas.width, gpu.context.canvas.height] : null,
    toile: toile ? [toile.width, toile.height] : null,
    webgpu: J.rendu?.stats.backend === 'webgpu' && !!J.rendu.gpu?.device, physx: globalThis.FPhysX?.status?.().ready === true,
    lectures: trace.lectures, commandes: trace.commandes, commande: trace.derniereCommande,
    vitesse: S?.course?.joueur?.etat.v, pointeur: trace.pointeur, vibrations: trace.vibrations,
    souris: document.getElementById('jeu')?.dataset.souris || null,
    statutManette: document.getElementById('r-manette-etat')?.textContent || '',
    statutJoueur: document.getElementById('r-manette-joueur-0-status')?.textContent || '',
    annulerVisible: !!document.getElementById('r-pad-annuler') &&
      !document.getElementById('r-pad-annuler').hidden && document.getElementById('r-pad-annuler').getClientRects().length > 0,
    actif: document.activeElement?.outerHTML.slice(0, 350)
  };
}

export function verifierProfilXbox(q, premier = false) {
  if (premier) assert.deepEqual(q.stockageInitial, [], 'premier lancement sans cache ni réglages préchargés');
  assert.match(q.userAgent, /Xbox.*Edg\//);
  assert.deepEqual(q.viewport, [3840, 2160, 1]);
  assert.equal(q.webgpu, true); assert.equal(q.physx, true);
  verifierMesureGraphique({ ...q, reglagesEnregistres: q.stocke }, premier ? 1 : 0);
  if (q.cache.statut === 'ok') assert.equal(q.qualite, q.cache.reglages.qualite);
  for (const dimensions of [q.framebuffer, q.toile]) {
    assert.ok(dimensions && dimensions[0] > 0 && dimensions[1] > 0, 'toile réelle créée');
    assert.ok(dimensions[0] <= 1280 && dimensions[1] <= 720, 'rendu Xbox 4K borné : ' + dimensions);
  }
}

export async function qualifierCommandesXbox(o) {
  if (existsSync(path.join(o.sortie, 'rapport.json'))) throw new Error('Dossier de réception déjà utilisé');
  mkdirSync(o.sortie, { recursive: true });
  const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const hash = () => createHash('sha256').update(readFileSync(fileURLToPath(o.url))).digest('hex');
  const rapport = { format: 'bitume-commandes-xbox-1', statut: 'en_cours',
    commit: execFileSync('git', ['-C', racine, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    htmlSha256: hash(), controles: [], captures: [], erreurs: [], limites: [
      'Chrome/SwiftShader avec identité Xbox Edge, écran CSS 4K et Gamepad API virtuels ; console et manette physiques non qualifiées.',
      'Temps rAF commandé : aucune mesure ni promesse de FPS matériels.',
      'Les observateurs comptent les appels et copient les commandes ; les fonctions natives et leurs résultats restent exécutés.',
      'La démonstration automatique est désactivée en mémoire pour garder le parcours stable ; aucun profil graphique n’est préchargé.'
    ] };
  const { chromium } = createRequire(import.meta.url)('playwright');
  const navigateur = await chromium.launch({ executablePath: o.chrome, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', ...argumentsWebGPU('swiftshader')] });
  const contexte = await navigateur.newContext({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1,
    userAgent: UA_XBOX, hasTouch: false, locale: 'fr-FR' });
  await contexte.addInitScript(horlogeCapture(17017));
  await contexte.addInitScript(instrumenterDemarrageMobile);
  await contexte.addInitScript(instrumenterXbox);
  const page = await contexte.newPage();
  page.setDefaultTimeout(180000);
  page.on('pageerror', e => rapport.erreurs.push(e.message));
  const noter = (nom, preuve = {}) => { rapport.controles.push({ nom, ...preuve }); console.log('OK ' + nom); };
  const lire = () => page.evaluate(releverXbox);
  const pas = async (n = 2, ms = 1000 / 60) => {
    for (let i = 0; i < n; i++) {
      await page.evaluate(ms => {
        if (window.BITUME_JEU) { BITUME_JEU.reglages.demo = 'non'; BITUME_JEU.pauseAuto = false; }
        return window.__BITUME_CAPTURE?.avancer(ms);
      }, ms);
    }
  };
  const attendre = async (predicat, description, ms = 1000 / 60, delai = 180000) => {
    const fin = Date.now() + delai; let prochainReleve = Date.now() + 30000;
    while (Date.now() < fin) {
      if (await page.evaluate(predicat)) return;
      await pas(1, ms); await new Promise(r => setTimeout(r, 5));
      if (Date.now() >= prochainReleve) {
        const q = await lire();
        console.log(JSON.stringify({ attente: description, ecran: q.ecran, phase: q.phase,
          horloge: q.horloge, feux: q.feux, chargement: q.chargement }));
        prochainReleve = Date.now() + 30000;
      }
    }
    throw new Error('Attente expirée : ' + description);
  };
  const valeur = async (index, value) => {
    await page.evaluate(({ index, value }) => {
      const p = __BITUME_XBOX.pads[0];
      Object.assign(p.buttons[index], { pressed: value > .5, touched: value > 0, value }); p.timestamp++;
    }, { index, value });
  };
  const bouton = async index => {
    await valeur(index, 1); await pas(2); await valeur(index, 0); await pas(2);
  };
  const cibler = async selecteur => {
    for (let i = 0; i < 100; i++) {
      if (await page.evaluate(s => document.activeElement?.matches(s), selecteur)) return;
      await bouton(13);
    }
    throw new Error('Cible inaccessible à la croix : ' + selecteur);
  };
  const choisir = async selecteur => { await cibler(selecteur); await bouton(0); };
  const ongletCommandes = async () => {
    for (let i = 0; i < 6; i++) {
      if (await page.evaluate(() => document.querySelector('[data-menu-tab="r-commandes-panel"]')?.getAttribute('aria-selected') === 'true')) return;
      await bouton(5);
    }
    throw new Error('Onglet Commandes inaccessible avec RB');
  };
  const capture = async nom => {
    await page.screenshot({ path: path.join(o.sortie, nom + '.png'), animations: 'disabled' });
    rapport.captures.push(nom + '.png');
  };
  const dispositionCommandes = async () => {
    const q = await page.evaluate(() => {
      const boites = [...document.querySelectorAll('.joueur-commandes')].map(el => {
        const b = el.getBoundingClientRect(), t = el.querySelector('table').getBoundingClientRect();
        return { x: b.x, y: b.y, droite: b.right, bas: b.bottom, tableDroite: t.right,
          debordement: el.scrollWidth - el.clientWidth };
      });
      return { largeur: innerWidth, boites };
    });
    assert.equal(q.boites.length, 2);
    for (const b of q.boites) {
      assert.ok(b.x >= 0 && b.droite <= q.largeur + 1, 'colonne dans la largeur de l’écran');
      assert.ok(b.tableDroite <= b.droite + 1 && b.debordement <= 1, 'tableau de commandes sans débordement');
    }
    const [a, b] = q.boites;
    assert.ok(a.droite <= b.x + 1 || a.bas <= b.y + 1, 'commandes J1/J2 sans chevauchement');
    noter('Colonnes de commandes lisibles sur ' + q.largeur + ' pixels', q);
  };
  const titrePret = async () => {
    await attendre(() => {
      const J = window.BITUME_JEU;
      return J?.ecran === 'titre' && J.session === null && J.scene === null && J.rendu &&
        !J.chargement.enCours && !J.chargement.voile && globalThis.FPhysX?.status?.().ready;
    }, 'vrai premier démarrage achevé');
    await pas(2); await page.evaluate(observerConduiteXbox);
  };
  const commandeFraiche = async (n = 3, ms = 100) => {
    const avant = (await lire()).commandes;
    await pas(n, ms); const apres = await lire();
    assert.ok(apres.commandes > avant, 'la vraie simulation a consommé de nouvelles commandes');
    assert.equal(apres.reference, false, 'aucune séance de référence qui confierait la conduite à l’IA');
    assert.equal(apres.pilotageAuto, false); assert.equal(apres.ecran, 'course');
    return apres;
  };
  const gazUi = 'button[data-pad-action="gaz"][data-n="0"]';
  try {
    await page.goto(o.url, { waitUntil: 'load', timeout: 180000 }); await titrePret();
    let q = await lire(); verifierProfilXbox(q, true);
    noter('Premier démarrage Xbox 4K avec détection WebGPU et framebuffer borné', { observation: q });
    await capture('titre-xbox-4k');

    const pointeurAvant = q.pointeur;
    await choisir('[data-aller="course"]'); q = await lire();
    assert.equal(q.ecran, 'preparation'); assert.equal(q.etape, 0, 'A n’ouvre qu’une étape');
    assert.match(q.statutPreparation, /Joueur 1 : manette/, 'le solo Auto annonce la manette affectée à J1');
    assert.equal(q.pointeur, pointeurAvant, 'parcours effectué sans pointeur synthétique');
    await bouton(8); assert.equal((await lire()).ecran, 'titre');
    noter('Croix et A ouvrent la préparation, View revient, sans activation de pointeur');

    await choisir('[data-aller="reglages"]'); await ongletCommandes();
    q = await lire(); assert.ok(q.statutJoueur.trim(), 'état de connexion par joueur visible');
    const avantAnnulation = q.manettes;
    await choisir(gazUi); await pas(2);
    assert.equal((await lire()).annulerVisible, true, 'capture de bouton ouverte');
    await bouton(8); q = await lire();
    assert.equal(q.ecran, 'reglages', 'View annule la capture sans quitter les réglages');
    assert.equal(q.annulerVisible, false); assert.deepEqual(q.manettes, avantAnnulation);
    noter('View annule la capture sans changer les affectations ni quitter les réglages');

    await cibler(gazUi); await valeur(0, 1); await pas(1);
    await page.evaluate(() => { __BITUME_XBOX.pads[0].axes[0] = .4; });
    await valeur(0, 0); await pas(2);
    assert.equal((await lire()).annulerVisible, true, 'capture maintenue avec le stick décalé');
    await bouton(8); q = await lire();
    assert.equal(q.annulerVisible, false); assert.equal(q.ecran, 'reglages');
    assert.deepEqual(q.manettes, avantAnnulation);
    await page.evaluate(() => { __BITUME_XBOX.pads[0].axes[0] = 0; }); await pas(2);
    noter('View permet de quitter une capture même si le stick ne revient pas au neutre');

    await choisir(gazUi); await pas(2); await bouton(2); q = await lire();
    assert.equal(q.annulerVisible, false);
    assert.notDeepEqual(q.manettes?.[0]?.gaz, avantAnnulation?.[0]?.gaz, 'affectation RT remplacée');
    assert.deepEqual(q.stocke?.manettes, q.manettes, 'affectations sauvegardées');
    const affectations = structuredClone(q.manettes);
    const etiquette = await page.locator(gazUi).textContent();
    assert.match(etiquette, /X/); assert.doesNotMatch(etiquette, /RT/);
    noter('A ouvre la capture, X affecte Accélérer et le choix est sauvegardé', { affectations, etiquette });
    await dispositionCommandes();
    await capture('affectations-xbox');
    assert.equal(q.vibrations, 0, 'aucune vibration dans les menus');
    for (const [width, height] of [[1280, 720], [390, 844]]) {
      await page.setViewportSize({ width, height }); await pas(2);
      await dispositionCommandes();
      await capture('affectations-' + width + 'x' + height);
    }
    await page.setViewportSize({ width: 3840, height: 2160 }); await pas(2);

    await page.reload({ waitUntil: 'load', timeout: 180000 }); await titrePret();
    q = await lire(); verifierProfilXbox(q); assert.deepEqual(q.manettes, affectations);
    noter('Affectation conservée après un vrai rechargement', { affectations: q.manettes });

    await choisir('[data-aller="course"]');
    for (let i = 0; i < 3; i++) await bouton(5);
    q = await lire(); assert.equal(q.etape, 3, 'bilan avant départ');
    await choisir('#b-depart');
    await attendre(() => BITUME_JEU.ecran === 'course' && !BITUME_JEU.chargement.enCours &&
      !BITUME_JEU.chargement.voile && BITUME_JEU.session?.course?.phase === 'course', 'départ réel et feux verts', 100, 480000);
    q = await commandeFraiche(); verifierProfilXbox(q);
    const vitesseSansGaz = q.vitesse;
    await valeur(2, 1); q = await commandeFraiche(12);
    assert.equal(q.commande.gaz, 1); assert.equal(q.commande.derive, false, 'X est retiré de Dérive');
    assert.ok(q.vitesse > vitesseSansGaz + .1, 'la voiture accélère avec X');
    noter('Affectation rechargée réellement utilisée en course', { commande: q.commande,
      vitesseAvant: vitesseSansGaz, vitesseApres: q.vitesse });
    await valeur(2, 0); await valeur(7, 1); q = await commandeFraiche();
    assert.equal(q.commande.gaz, 0, 'l’ancien RT n’accélère plus après réaffectation');
    await valeur(7, 0);

    await bouton(9); assert.equal((await lire()).ecran, 'pause');
    await choisir('#b-reglages-pause'); await ongletCommandes();
    await choisir('#r-pad-defaut'); q = await lire();
    assert.notDeepEqual(q.manettes?.[0]?.gaz, affectations[0].gaz, 'retour aux commandes par défaut');
    await cibler('input[name="rcmd0"]'); await bouton(14);
    assert.equal(await page.locator('input[name="rcmd0"][value="auto"]').isChecked(), true,
      'le mode Auto est choisi à la manette dans le menu');
    await bouton(8); assert.equal((await lire()).ecran, 'pause');
    await bouton(8); assert.equal((await lire()).ecran, 'course');
    q = await commandeFraiche(); const vitesseAvantRt = q.vitesse;
    await valeur(7, 1); q = await commandeFraiche(12);
    assert.equal(q.commande.gaz, 1); assert.equal(q.commande.frein, 0);
    assert.ok(q.vitesse > vitesseAvantRt + .1, 'RT fait réellement accélérer la voiture');
    const vitesseAvantLt = q.vitesse;
    noter('Commandes par défaut restaurées : RT accélère', { commande: q.commande,
      vitesseAvant: vitesseAvantRt, vitesseApres: q.vitesse });
    await valeur(7, 0); await valeur(6, .65); q = await commandeFraiche(6);
    assert.ok(Math.abs(q.commande.frein - .65) < 1e-6, 'LT conserve son intensité analogique');
    assert.equal(q.commande.gaz, 0); assert.ok(q.vitesse < vitesseAvantLt - .1, 'LT ralentit réellement la voiture');
    noter('LT freine avec son intensité analogique', { commande: q.commande,
      vitesseAvant: vitesseAvantLt, vitesseApres: q.vitesse });
    await valeur(6, 0);
    for (const x of [-.8, .8]) {
      await page.evaluate(x => { __BITUME_XBOX.pads[0].axes[0] = x; }, x);
      q = await commandeFraiche(); assert.ok(q.commande.volant * x > .1, 'sens du stick gauche conservé');
    }
    await page.evaluate(() => { __BITUME_XBOX.pads[0].axes[0] = 0; });
    await capture('course-xbox-4k');

    await page.mouse.move(3800, 1080); await page.mouse.down();
    q = await commandeFraiche(); await page.mouse.up();
    assert.equal(q.modeCommandes[0], 'auto', 'conflit pointeur vérifié en vrai mode Auto');
    assert.equal(q.commande.gaz, 0, 'le clic pointeur Edge n’accélère pas en mode console');
    assert.equal(q.commande.volant, 0, 'le pointeur Edge ne détourne pas le volant');
    assert.notEqual(q.souris, 'oui');
    noter('Pointeur et clic souris n’ajoutent pas de conduite parasite sur Xbox', { commande: q.commande });

    await valeur(7, 1); q = await commandeFraiche(); assert.equal(q.commande.gaz, 1);
    await page.evaluate(() => { __BITUME_XBOX.pads[0].connected = false; });
    q = await commandeFraiche(); assert.equal(q.commande.gaz, 0); assert.equal(q.commande.frein, 0);
    assert.equal(q.commande.volant, 0); assert.equal(q.commande.derive, false);
    await valeur(7, 0); await valeur(9, 1);
    await page.evaluate(() => { __BITUME_XBOX.pads[0].connected = true; });
    await pas(2); assert.equal((await lire()).ecran, 'course', 'reconnexion Start tenu sans pause fantôme');
    await valeur(9, 0); await pas(2); await bouton(9);
    assert.equal((await lire()).ecran, 'pause', 'nouvel appui Start reconnu après reconnexion');
    noter('Déconnexion neutralise les commandes et reconnexion sans pause fantôme');
    await choisir('#b-abandon'); assert.equal((await lire()).ecran, 'titre');
    await choisir('[data-aller="reglages"]'); await ongletCommandes();
    await page.evaluate(() => { __BITUME_XBOX.pads[0].connected = false; }); await pas(3);
    q = await lire(); assert.match(q.statutJoueur, /aucune|déconnect|non détect|non branch|absente/i,
      'l’absence de manette est expliquée dans les commandes');
    noter('État de déconnexion lisible dans les réglages', { statut: q.statutJoueur });
    assert.deepEqual(rapport.erreurs, [], 'aucune erreur JavaScript du vrai jeu');
    assert.equal(hash(), rapport.htmlSha256, 'HTML exact inchangé pendant la qualification');
    rapport.statut = 'ok';
  } catch (e) {
    rapport.statut = 'echec'; rapport.echec = e.stack || String(e);
    try { rapport.dernierEtat = await lire(); } catch { /* erreur de chargement conservée */ }
    try { await capture('echec'); } catch { /* navigateur déjà fermé */ }
    console.error(rapport.echec);
  } finally {
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(rapport, null, 2) + '\n');
    await navigateur.close();
  }
  return rapport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = await qualifierCommandesXbox(optionsCommandesXbox(process.argv.slice(2)));
    console.log(JSON.stringify({ statut: r.statut, commit: r.commit, htmlSha256: r.htmlSha256,
      controles: r.controles.length, png: r.captures.length, erreurs: r.erreurs.length }));
    if (r.statut !== 'ok') process.exitCode = 1;
  } catch (e) { console.error(e.stack || String(e)); process.exitCode = 1; }
}
