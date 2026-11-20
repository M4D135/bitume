#!/usr/bin/env node
// Parcours du vrai HTML assemblé avec le raccord proposé par 03. Chromium logiciel :
// aucune mesure matérielle, manette physique, écoute audio ou partie réseau n'est qualifiée.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.url || !args.sortie) throw Error('Usage : --url file:///candidat.html --sortie dossier [--chrome binaire]');
mkdirSync(args.sortie, { recursive: true });
const rapport = { schema: 1, commit: process.env.GITHUB_SHA || null, nature: 'raccord propose applique dans une copie temporaire', controles: [], captures: [], erreurs: [], limites: ['Chromium logiciel', 'manettes et tactile simules', 'audio non ecoute', 'reseau entre machines non essaye'] };
const browser = await chromium.launch({ executablePath: args.chrome || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
await context.addInitScript(() => {
  if (!localStorage.getItem('bitume.reglages')) localStorage.setItem('bitume.reglages', JSON.stringify({ qualite: 'low', cadence: '60', retro: 'non', vegetation: 'low', faune: 'non', demo: 'non', meteo: 'sec', saison: 'ete', saisonMode: 'manuel', moment: 'jour', momentMode: 'manuel', meteoMode: 'manuel' }));
  window.__menuEssai = { vibrations: 0, dessins: 0, pads: [] };
  const etat = window.__menuEssai;
  for (let n = 0; n < 2; n++) etat.pads.push({ index: n, id: 'Manette simulee ' + n, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), vibrationActuator: { playEffect() { etat.vibrations++; return Promise.resolve('complete'); }, reset() { return Promise.resolve('complete'); } } });
  Object.defineProperty(navigator, 'getGamepads', { value: () => etat.pads });
  for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) if (type) for (const nom of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const ancien = type.prototype[nom]; if (!ancien) continue;
    type.prototype[nom] = function (...a) { etat.dessins++; return ancien.apply(this, a); };
  }
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror', e => rapport.erreurs.push(e.message));
const notes = (nom, preuve = {}) => { rapport.controles.push({ nom, statut: 'ok', ...preuve }); console.log('OK ' + nom); };
const lire = () => page.evaluate(() => ({ ecran: BITUME_JEU.ecran, menu: BITUME_JEU.menuArcade, reglages: BITUME_JEU.reglages, dessins: __menuEssai.dessins, vibrations: __menuEssai.vibrations, session: { i: BITUME_JEU.session?.i, type: BITUME_JEU.session?.type } }));
const ecran = n => page.waitForFunction(n => window.BITUME_JEU?.ecran === n, n, { timeout: 120000 });
async function attendreTitre(phase) {
  const pret = () => window.BITUME_JEU?.ecran === 'titre' && document.getElementById('titre')?.hidden === false && document.getElementById('autodetection')?.hidden === true;
  await page.waitForFunction(() => window.BITUME_JEU && (BITUME_JEU.ecran === 'titre' || document.getElementById('autodetection')?.hidden === false), null, { timeout: 120000 });
  const passer = page.locator('#detection-annuler');
  if (await passer.isVisible()) {
    try { await passer.click({ timeout: 2000 }); }
    catch (erreur) {
      // L'autodétection peut finir pendant l'attente de stabilité du bouton. Ne tolérer que cet état final observé.
      if (!await page.evaluate(pret).catch(() => false)) throw erreur;
      (rapport.autodetection ||= []).push({ phase, statut: 'terminee_pendant_clic', titreVisible: true, detectionFermee: true });
    }
  }
  await page.waitForFunction(pret, null, { timeout: 120000 });
}
async function bouton(n, controleur = 0) {
  await page.evaluate(({ n, controleur }) => { const p = __menuEssai.pads[controleur]; p.timestamp = performance.now(); p.buttons[n].pressed = true; p.buttons[n].value = 1; }, { n, controleur });
  await page.waitForTimeout(90);
  await page.evaluate(({ n, controleur }) => { const p = __menuEssai.pads[controleur]; p.buttons[n].pressed = false; p.buttons[n].value = 0; }, { n, controleur });
  await page.waitForTimeout(90);
}
async function capture(nom) {
  await page.screenshot({ path: path.join(args.sortie, nom + '.png') });
  rapport.captures.push(nom + '.png');
}
async function calme(nom, verifierApercu = true) {
  const avant = await lire(); await page.waitForTimeout(240); const apres = await lire();
  assert.equal(apres.dessins, avant.dessins, nom + ' : dessin WebGL caché');
  if (verifierApercu) assert.equal(apres.menu.images, avant.menu.images, nom + ' : aperçu caché');
  notes(nom, { dessinsWebGL: apres.dessins - avant.dessins, imagesApercu: apres.menu.images - avant.menu.images });
}
async function etape(n) { await page.locator('[data-menu-tab="' + ['p-piste','p-conditions','p-pilotes','p-bilan'][n] + '"]').click(); await page.waitForFunction(n => BITUME_JEU.menuArcade.etape === n, n); }
async function cadragePaysage(n) {
  // Observer le premier affichage après le vrai clic d'onglet : aucun scrollIntoView ni scroll de réparation.
  const releve = await page.evaluate(n => {
    const zone = document.getElementById('preparation'), panneau = zone.querySelector('.panneaux-menu');
    const entete = zone.querySelector('.menu-entete').getBoundingClientRect(), pied = zone.querySelector('.depart-fixe').getBoundingClientRect();
    const rectangle = r => ({ gauche: r.left, haut: r.top, droite: r.right, bas: r.bottom });
    const contient = (cadre, r) => r.left >= cadre.gauche - 1 && r.top >= cadre.haut - 1 && r.right <= cadre.droite + 1 && r.bottom <= cadre.bas + 1;
    function mesurer(el, nom, texte = false) {
      if (!el) return { nom, visible: false, motif: 'élément absent' };
      const r = el.getBoundingClientRect(), cadre = { gauche: 0, haut: Math.max(0, entete.bottom), droite: innerWidth, bas: Math.min(innerHeight, pied.top) };
      const styleCible = getComputedStyle(el), ancetres = [];
      let masque = el.hidden || styleCible.display === 'none' || styleCible.visibility === 'hidden' || styleCible.visibility === 'collapse' || +styleCible.opacity === 0;
      // Les éléments d'un conteneur scrollable peuvent être dans le viewport tout en étant rognés par ce conteneur.
      for (let parent = texte ? el : el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), p = parent.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || +style.opacity === 0 || parent.hidden) masque = true;
        const coupeX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX), coupeY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
        if (coupeX) { cadre.gauche = Math.max(cadre.gauche, p.left + parent.clientLeft); cadre.droite = Math.min(cadre.droite, p.left + parent.clientLeft + parent.clientWidth); }
        if (coupeY) { cadre.haut = Math.max(cadre.haut, p.top + parent.clientTop); cadre.bas = Math.min(cadre.bas, p.top + parent.clientTop + parent.clientHeight); }
        if (coupeX || coupeY) ancetres.push({ element: parent.id || parent.className || parent.tagName, scrollTop: parent.scrollTop, coupeX, coupeY });
      }
      let contenu = null;
      if (texte) {
        const carte = el.closest('.bilan-grille article'), c = carte.getBoundingClientRect();
        cadre.gauche = Math.max(cadre.gauche, c.left); cadre.haut = Math.max(cadre.haut, c.top);
        cadre.droite = Math.min(cadre.droite, c.right); cadre.bas = Math.min(cadre.bas, c.bottom);
        const range = document.createRange(); range.selectNodeContents(el);
        const lignes = Array.from(range.getClientRects()).filter(l => l.width > 0 && l.height > 0);
        contenu = { lignes: lignes.length, complet: !!el.textContent.trim() && lignes.length > 0 && lignes.every(l => contient(cadre, l)) };
      }
      return { nom, rectangle: rectangle(r), zoneVisible: cadre, ancetres, contenu,
        visible: !masque && r.width > 0 && r.height > 0 && contient(cadre, r) && (!contenu || contenu.complet) };
    }
    const cartes = Array.from(zone.querySelectorAll('.bilan-grille article'));
    const cibles = n === 0 ? [mesurer(document.getElementById('p-trace-3d'), 'canvas du tracé')] : [
      ...cartes.map((c, i) => mesurer(c, 'carte bilan ' + (i + 1))),
      ...['p-bilan-circuit','p-bilan-course','p-bilan-saison','p-bilan-meteo','p-bilan-joueurs','p-bilan-troll'].map(id => mesurer(document.getElementById(id), id, true))
    ];
    return { etape: n + 1, largeur: innerWidth, hauteur: innerHeight, scrollTop: panneau.scrollTop, cartes: cartes.length, cibles };
  }, n);
  (rapport.visibilitePaysage ||= []).push(releve);
  assert.ok(Math.abs(releve.scrollTop) <= 1, 'nouvelle étape ouverte au milieu du panneau : ' + JSON.stringify(releve));
  if (n === 3) assert.equal(releve.cartes, 3, 'les trois cartes du bilan doivent être présentes');
  for (const cible of releve.cibles) assert.equal(cible.visible, true, 'paysage : contenu coupé au premier affichage : ' + JSON.stringify(cible));
}
try {
  await page.goto(args.url, { waitUntil: 'load', timeout: 120000 });
  await attendreTitre('ouverture'); await calme('Titre opaque sans rendu caché');
  await page.locator('[data-aller="course"]').focus(); await page.keyboard.press('Enter'); await ecran('preparation');
  assert.equal(await page.locator('#circuits [role="radio"]').count(), 9);
  await page.locator('#circuits [aria-checked="true"]').focus(); await page.keyboard.press('End');
  await page.waitForFunction(() => BITUME_JEU.reglages.circuit === 8 && BITUME_JEU.menuArcade.images > 0);
  assert.equal(await page.locator('#p-circuit-nom').textContent(), 'Route-des-Cimes');
  assert.equal((await lire()).session.i, 0, 'la sélection ne reconstruit pas une vitrine');
  notes('Clavier : neuf circuits, sélection réelle de Route-des-Cimes, scène inchangée');
  await page.locator('#p-rotation').click(); await page.waitForTimeout(100); await calme('Tracé figé sans nouveau dessin');
  await page.locator('#p-rotation').click(); await page.waitForTimeout(100);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100); await calme('Mouvement réduit sans animation persistante');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const avantMasque = await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); return BITUME_JEU.menuArcade.images; });
  await page.waitForTimeout(240); assert.equal((await lire()).menu.images, avantMasque);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  notes('Masquage document simulé : aperçu arrêté');
  // La reprise protège contre un bouton déjà tenu ; laisser les deux manettes repasser au neutre.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await bouton(9, 1); assert.equal((await lire()).menu.etape, 1); await calme('Conditions : aucun aperçu ni scène cachée');
  assert.equal((await lire()).ecran, 'preparation');
  await page.locator('label:has(input[name="saisonDepart"][value="hiver"])').click();
  await bouton(9, 0); assert.equal((await lire()).menu.etape, 2);
  await page.selectOption('#p-geste-0', 'poing'); await page.selectOption('#p-klaxon-0', 'ancien');
  await page.locator('#p-reglages-pilote').click(); await ecran('reglages'); await calme('Réglages : aucun rendu caché');
  await bouton(1, 1); await ecran('preparation'); assert.equal((await lire()).menu.etape, 2);
  await bouton(9); assert.equal((await lire()).menu.etape, 3); assert.equal((await lire()).ecran, 'preparation');
  notes('Start progresse jusqu’au bilan, retour des réglages conserve l’étape');
  for (let i = 0; i < 4; i++) await bouton(1); await ecran('titre');
  await page.locator('[data-aller="duo"]').click(); await ecran('preparation'); await etape(2);
  assert.equal(await page.locator('#o-troll-1').isVisible(), true);
  await page.selectOption('#p-geste-1', 'salut'); await page.selectOption('#p-klaxon-1', 'mariage');
  let r = await lire(); assert.deepEqual(r.reglages.trollPilotes, [{ geste: 'poing', klaxon: 'ancien' }, { geste: 'salut', klaxon: 'mariage' }]);
  await etape(3); assert.match(await page.locator('#p-bilan-troll').textContent(), /J1.*poing.*ancien.*J2.*salut.*mariage/s);
  notes('Troll J1/J2 indépendant et bilan fidèle');
  for (const taille of [{ width:1440,height:900 }, { width:390,height:844 }, { width:844,height:390 }]) {
    await page.setViewportSize(taille);
    for (let n = 0; n < 4; n++) {
      await etape(n); await page.waitForTimeout(90);
      const dimensions = await page.evaluate(() => {
        const p = document.querySelector('#preparation .panneaux-menu'), f = document.querySelector('#preparation .depart-fixe'), rect = f.getBoundingClientRect();
        return { largeur: innerWidth, hauteur: innerHeight, debordement: p.scrollWidth - p.clientWidth, pied: { haut: rect.top, bas: rect.bottom } };
      });
      assert.ok(dimensions.debordement <= 2, 'panneau déborde horizontalement : ' + JSON.stringify(dimensions));
      assert.ok(dimensions.pied.haut >= 0 && dimensions.pied.bas <= taille.height + 1, 'actions hors écran');
      if (taille.width > taille.height && taille.height <= 430 && (n === 0 || n === 3)) await cadragePaysage(n);
      await capture('etape-' + (n + 1) + '-' + taille.width + 'x' + taille.height);
    }
  }
  notes('Quatre étapes : 12 captures et actions visibles en bureau, portrait et paysage');
  await page.setViewportSize({width:1440,height:900});
  for (let i = 0; i < 4; i++) await bouton(1); await ecran('titre'); await capture('titre-1440x900');
  await page.locator('[data-aller="chrono"]').tap(); await ecran('preparation');
  assert.equal(await page.locator('#o-tours').isVisible(), false); assert.equal(await page.locator('#o-chrono').isVisible(), true);
  await page.locator('#b-suivant').tap(); assert.equal((await lire()).menu.etape, 1);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await ecran('titre');
  notes('Chrono et tactile simulé : options adaptées, retour clavier');
  await page.locator('[data-aller="enligne"]').click(); await ecran('enligne'); await calme('Salon sans rendu caché');
  await page.locator('#l-code').focus(); await bouton(0, 1);
  assert.equal(await page.locator('#saisie-manette').evaluate(d => d.open), true);
  for (let i = 0; i < 4; i++) { if (i) await bouton(15, 1); await bouton(0, 1); }
  assert.equal(await page.locator('#l-code').inputValue(), '', 'saisie brouillon non validée');
  await page.locator('#sm-valider').focus(); await bouton(0, 1);
  assert.equal((await page.locator('#l-code').inputValue()).length, 4); assert.equal((await lire()).ecran, 'enligne');
  await page.locator('#l-nom').focus(); const nom = await page.locator('#l-nom').inputValue(); await bouton(0);
  await bouton(0); await bouton(1); assert.equal(await page.locator('#l-nom').inputValue(), nom);
  assert.equal((await lire()).ecran, 'enligne');
  await page.locator('#l-code').focus(); await bouton(0, 1); await capture('saisie-manette'); await bouton(1, 1);
  notes('Deuxième manette : code sans clavier, brouillon et annulation du nom');
  assert.equal((await lire()).vibrations, 0); notes('Aucune vibration dans les menus');
  await page.reload({waitUntil:'load'}); await attendreTitre('rechargement');
  r = await lire(); assert.deepEqual(r.reglages.trollPilotes, [{ geste:'poing',klaxon:'ancien' },{ geste:'salut',klaxon:'mariage' }]);
  assert.equal(r.reglages.saison,'hiver'); notes('Persistance après rechargement des conditions et choix des deux pilotes');
  await page.locator('[data-aller="course"]').click(); await ecran('preparation');
  await page.locator('#circuits [data-index="0"]').click(); await etape(3); await page.locator('#b-depart').click(); await ecran('course');
  assert.equal((await lire()).session.type, 'course');
  await page.keyboard.press('Escape'); await ecran('pause');
  notes('Départ réel et pause après les étapes arcade');
  await page.locator('#b-reglages-pause').click(); await ecran('reglages'); await calme('Réglages depuis la pause : rendu suspendu');
  await page.keyboard.press('Escape'); await ecran('pause'); await page.locator('#b-reprendre').click(); await ecran('course');
  await page.keyboard.press('Escape'); await ecran('pause'); await page.locator('#b-abandon').click(); await ecran('titre');
  await page.evaluate(() => { BITUME_JEU.reglages.demo = 'oui'; });
  await ecran('demo');
  await page.waitForFunction(() => BITUME_JEU.session?.type === 'demo' && document.querySelector('#chargement').classList.contains('fini'), null, {timeout:120000});
  await page.keyboard.press('Enter'); await ecran('titre'); await calme('Retour de démonstration vers le titre opaque');
  notes('Pause/réglages/reprise et démo automatique après inactivité conservées');
  assert.equal(rapport.erreurs.length, 0, rapport.erreurs.join('\n'));
  rapport.statut='ok';
} catch(e) { rapport.statut='echec'; rapport.echec=String(e.stack||e); try { rapport.dernierEtat = await lire(); } catch {} console.error(rapport.echec); try{await capture('echec')}catch{} process.exitCode=1; }
finally { writeFileSync(path.join(args.sortie,'rapport.json'),JSON.stringify(rapport,null,2)+'\n'); await browser.close(); }
