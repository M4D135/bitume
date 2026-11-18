// Fonctions d'orchestration de production, frontières DOM/rendu simulées. Aucune prétention de test GPU.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/autoconfig.js'); require('../src/graphismes.js');
const B = globalThis.BITUME, A = B.autoconfig, source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
function bloc(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a);
  assert.ok(a >= 0 && b > a, debut); return source.slice(a, b);
}
const six = o => Object.fromEntries(A.CLES.map(k => [k, o[k]]));
// valeurs d'usine des six options (src/jeu.js, DEFAUT)
const USINE = { qualite: 'auto', anticrenelage: 'profil', ombres: 'profil', vegetation: 'profil', faune: 'profil', retro: 'auto' };
// Page simulée autour du bloc de la détection. scenario : version (badge du titre), materiel, fenetre [l, h],
// ecran { width, height }, reglages, stock (stockage local initial), selection (verdict de la mesure), sortie (résultat
// imposé), cadenceBridee, annulation, echec, perteContexte, attente, glaces, terminer, enLigne, vitrine.
const orchestration = new Function('base', 'scenario', `
  const appels = [], stockage = JSON.parse(JSON.stringify(scenario.stock || {})), nodes = new Map();
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: id !== 'reglages', dataset: {}, textContent: '', value: 0, disabled: false,
      classList: { add() {} }, addEventListener() {}, focus() { appels.push('focus:' + id); } });
    return nodes.get(id);
  };
  const [innerWidth, innerHeight] = scenario.fenetre || [1280, 720];
  const window = { devicePixelRatio: 1, screen: scenario.ecran || { width: 2560, height: 1440 } };
  const version = scenario.version || '0.2.40';
  const badge = { textContent: 'V' + version, getAttribute: n => n === 'aria-label' ? 'Version ' + version : null };
  const document = { hidden: false, activeElement: $('r-detecter'), addEventListener() {}, querySelector: s => s === '.version-jeu' ? badge : null };
  // style de la toile : cssText rend ce que width et height valent, et les remet comme le navigateur
  const style = { width: '', height: '', autre: scenario.styleToile || '',
    get cssText() { return [this.autre, this.width && 'width: ' + this.width + ';', this.height && 'height: ' + this.height + ';'].filter(Boolean).join(' '); },
    set cssText(v) { this.autre = v.replace(/(^|\\s)(width|height): [^;]*;/g, '').trim(); const w = /width: ([^;]*);/.exec(v), h = /height: ([^;]*);/.exec(v); this.width = w ? w[1] : ''; this.height = h ? h[1] : ''; } };
  style.cssText = scenario.styleToile || '';
  const canvas = { style };
  const addEventListener = () => {};
  const requestAnimationFrame = fn => queueMicrotask(() => fn(100));
  const console = { warn() {} };
  const lireStock = (k, d) => stockage[k] ?? d, ecrireStock = (k, v) => { stockage[k] = JSON.parse(JSON.stringify(v)); };
  let detectionGraphiqueActive = false, annulerDetection = false, contexteRenduPerdu = false, derniereDetection = null;
  let materielRendu = scenario.materiel || 'GPU-A|16384|10';
  let restaurerDecorApresContexte = false;
  let ecran = 'reglages', gpuModeste = true;
  const jeu = { dataset: { ecran: 'reglages', partage: 'haut-bas' } }, hud2 = $('hud2');
  const ECRANS = ['titre', 'reglages', 'pause'], EL = { R: scenario.enLigne ? {} : null };
  const son = { musique() {}, suspendre() {}, reprendre() {} };
  let profile = null;
  const rendu = { profile(v) { if (v === false) profile = null; if (v === true) profile = {}; return profile; },
    setWorld(...a) { appels.push(['world', ...a]); if (scenario.restaurationImpossible) throw Error('lost'); },
    setNappes(a) { appels.push(['nappes', a]); }, setLots(a) { appels.push(['lots', a]); } };
  const obstacles = { solides: [1, 2, 3] };
  const scene = { decor: { atmosphere: { ciel: 1 }, nappes: [1], lots: [2] }, c: { obstacles } };
  const session = { type: scenario.vitrine ? 'vitrine' : 'course', i: 2, c: scene.c, course: { temps: 123.45 }, nature: { ambiance: { atmosphere: { nuit: .8 } }, revisionRendu: 4 } };
  let capacitesRendu = base.graphismes.capacites({ msaa: 4, shadowMapScale: 2, reflections: true }, true, 1);
  const etatProfils = base.graphismes.etatStable(), palier = { n: 3 }, horlogeProfils = () => 0;
  const DEFAUT = { ...${JSON.stringify(USINE)}, moment: 'jour', meteo: 'aleatoire' };
  const reglages = Object.assign({ moment: 'nuit', meteo: 'pluie', pneus: 'pluie', tours: 9, commandes: ['clavier', 'manette'] },
    scenario.reglages || { qualite: 'high', anticrenelage: 'msaa4', ombres: 'high', vegetation: 'ultra', faune: 'ultra', retro: 'oui' });
  const appliquerPalier = () => appels.push('resize'), oublierIntervalle = () => appels.push('reset-clock');
  const remplirReglages = () => appels.push('refresh-options'), lancer = (...a) => appels.push(['lancer', ...a]);
  // moteur des rétroviseurs : prêté au parcours seulement s'il existe déjà ; scene dit quel décor il porte
  const retro = { rendu: scenario.glaces || null, scene: 'seance' }, annexes = [];
  let ioVu = null, toileVue = null, parcoursVu = null;
  const B = { ...base, autoconfig: { ...base.autoconfig, async executer(io) {
    ioVu = io; toileVue = [canvas.style.width, canvas.style.height];
    if (scenario.attente) await scenario.attente;
    if (scenario.echec) throw Error('driver');
    if (scenario.perteContexte) { contexteRenduPerdu = true; return { statut: 'interrompu', motif: 'contexte_perdu', empreinte: io.empreinte() }; }
    if (scenario.annulation) return { statut: 'interrompu', motif: 'annule', empreinte: io.empreinte() };
    if (scenario.sortie) return { ...scenario.sortie, empreinte: io.empreinte() };
    const selection = scenario.selection || 'medium';
    return { revision: base.autoconfig.REVISION, statut: 'ok', selection, empreinte: io.empreinte(), mesures: [{}],
      reglages: base.autoconfig.reglages(selection), cadenceBridee: !!scenario.cadenceBridee };
  } }, sceneBench: { creer(r, capacites, annexe) { appels.push('prepare-bench'); annexes.push(annexe);
    return parcoursVu = { sonder() {}, preparer() {}, activerGlaces() {}, simuler() {}, dessiner() {}, terminer: scenario.terminer || (() => {}), liberer() { appels.push('release-bench'); } }; } } };
  ${bloc('  function empreinteDetection()', '  async function demarrer()')}
  return { detecterGraphismes, majDetectionGraphique, appliquerDetection, contexteGraphiqueRetabli, empreinteDetection, appels, stockage, reglages,
    scene, session, obstacles, nodes, get actif() { return detectionGraphiqueActive; }, get ecran() { return ecran; }, jeu, canvas,
    get gpuModeste() { return gpuModeste; }, get derniere() { return derniereDetection; }, retro, annexes, get io() { return ioVu; },
    get toileVue() { return toileVue; }, get parcours() { return parcoursVu; } };
`);
const etat = h => h.nodes.get('r-detection-etat').textContent;
let n = 0;
async function verifier(nom, f) { await f(); n++; console.log('ok ' + nom); }

await verifier('détection à la main : remplace les six options, garde conduite, météo, moment et la course', async () => {
  const h = orchestration(B, {}), s = h.session, obstacles = h.scene.c.obstacles;
  const r = await h.detecterGraphismes(false);
  assert.equal(r.statut, 'ok'); assert.deepEqual(six(h.reglages), A.reglages('medium'));
  assert.equal(h.reglages.moment, 'nuit'); assert.equal(h.reglages.meteo, 'pluie'); assert.equal(h.reglages.tours, 9);
  assert.deepEqual(h.reglages.commandes, ['clavier', 'manette']);
  assert.strictEqual(h.session, s); assert.strictEqual(h.scene.c.obstacles, obstacles); assert.equal(s.course.temps, 123.45);
  assert.equal(h.ecran, 'reglages'); assert.equal(h.jeu.dataset.partage, 'haut-bas'); assert.equal(h.actif, false);
  assert.equal(h.nodes.get('reglages').hidden, false); assert.equal(h.nodes.get('autodetection').hidden, true);
  assert.deepEqual(Object.keys(h.stockage).sort(), ['bitume.reglages', A.CLE].sort());
  const note = h.stockage[A.CLE];
  assert.deepEqual(note.appliques, A.reglages('medium')); assert.deepEqual(note.gardes, []);
  assert.ok(A.cacheValide(note, h.empreinteDetection()), 'la détection de cette version est faite');
  assert.equal(h.gpuModeste, false); assert.equal(h.appels.some(a => Array.isArray(a) && a[0] === 'lancer'), false);
  h.majDetectionGraphique(); assert.equal(etat(h), 'Dernière détection : Moyenne · réglages appliqués.');
});
await verifier('nouvelle version, détection automatique : les choix du joueur depuis la précédente restent', async () => {
  // la version précédente avait posé Moyenne (format de la révision 2) ; le joueur a monté la végétation depuis
  const ancienne = { revision: 2, statut: 'ok', selection: 'medium', empreinte: 'ancienne', mesures: [{}], reglages: A.reglages('medium') };
  const h = orchestration(B, { stock: { [A.CLE]: ancienne }, reglages: { ...A.reglages('medium'), vegetation: 'ultra' }, selection: 'high' });
  const r = await h.detecterGraphismes(true);
  assert.equal(r.statut, 'ok');
  assert.deepEqual(six(h.reglages), { ...A.reglages('high'), vegetation: 'ultra' }, 'Fine appliquée, végétation du joueur gardée');
  const note = h.stockage[A.CLE];
  assert.deepEqual(note.gardes, ['vegetation']); assert.equal(note.selection, 'high');
  assert.deepEqual(note.appliques, { ...A.reglages('high'), vegetation: 'medium' }, 'référence de la végétation : ce que la détection avait posé');
  assert.deepEqual(six(h.stockage['bitume.reglages']), six(h.reglages));
  assert.equal(h.reglages.moment, 'nuit');
  h.majDetectionGraphique(); assert.equal(etat(h), 'Recommandé : Fine · vos choix gardés : végétation.');
  // version suivante : la végétation reste au joueur, le reste suit la nouvelle recommandation
  const suite = orchestration(B, { stock: h.stockage, reglages: six(h.reglages), selection: 'medium', version: '0.2.41' });
  await suite.detecterGraphismes(true);
  assert.deepEqual(six(suite.reglages), { ...A.reglages('medium'), vegetation: 'ultra' });
});
await verifier('premier lancement : les valeurs d’usine sont remplacées ; une option déjà changée reste', async () => {
  const h = orchestration(B, { reglages: { ...USINE }, selection: 'low' });
  await h.detecterGraphismes(true);
  assert.deepEqual(six(h.reglages), A.reglages('low')); assert.deepEqual(h.stockage[A.CLE].gardes, []);
  assert.equal(h.gpuModeste, true);
  const g = orchestration(B, { reglages: { ...USINE, ombres: 'off', retro: 'non' }, selection: 'high' });
  await g.detecterGraphismes(true);
  assert.deepEqual(six(g.reglages), { ...A.reglages('high'), ombres: 'off', retro: 'non' });
  assert.deepEqual(g.stockage[A.CLE].gardes, ['ombres', 'retro']);
});
await verifier('détection à la main : tout est appliqué, même après des choix manuels', async () => {
  const precedente = { revision: A.REVISION, statut: 'ok', selection: 'medium', empreinte: 'x', mesures: [{}], appliques: A.reglages('medium') };
  const h = orchestration(B, { stock: { [A.CLE]: precedente }, reglages: { ...A.reglages('medium'), vegetation: 'ultra', ombres: 'off' }, selection: 'high' });
  await h.detecterGraphismes(false);
  assert.deepEqual(six(h.reglages), A.reglages('high')); assert.deepEqual(h.stockage[A.CLE].gardes, []);
  assert.deepEqual(h.stockage[A.CLE].appliques, A.reglages('high'));
});
await verifier('« Passer » au démarrage : rien d’appliqué, et la question ne revient pas pour cette version', async () => {
  const precedente = { revision: 2, statut: 'ok', selection: 'medium', empreinte: 'ancienne', mesures: [{}], reglages: A.reglages('medium') };
  const h = orchestration(B, { annulation: true, stock: { [A.CLE]: precedente } }), avant = JSON.stringify(h.reglages);
  const r = await h.detecterGraphismes(true);
  assert.equal(r.statut, 'interrompu'); assert.equal(JSON.stringify(h.reglages), avant);
  assert.equal(h.stockage['bitume.reglages'], undefined, 'aucune préférence écrite');
  const trace = h.stockage[A.CLE];
  assert.equal(trace.statut, 'interrompu'); assert.equal(trace.motif, 'annule'); assert.equal(trace.tentatives, 1);
  assert.deepEqual(trace.appliques, A.reglages('medium'), 'la référence des choix survit');
  assert.ok(A.cacheValide(trace, h.empreinteDetection()), 'même version : plus de détection automatique');
  assert.equal(A.cacheValide(trace, A.empreinte('GPU-A|16384|10', '0.2.41')), false, 'la version suivante la propose');
  h.majDetectionGraphique(); assert.equal(etat(h), 'Détection passée · réglages conservés.');
});
await verifier('interruption au démarrage (onglet caché) : refaite à l’ouverture suivante, deux fois au plus', async () => {
  const sortie = { revision: A.REVISION, statut: 'interrompu', motif: 'onglet_masque', mesures: [] };
  const h = orchestration(B, { sortie });
  await h.detecterGraphismes(true);
  assert.equal(h.stockage[A.CLE].tentatives, 1); assert.equal(A.cacheValide(h.stockage[A.CLE], h.empreinteDetection()), false);
  const g = orchestration(B, { sortie, stock: h.stockage });
  await g.detecterGraphismes(true);
  assert.equal(g.stockage[A.CLE].tentatives, 2); assert.ok(A.cacheValide(g.stockage[A.CLE], g.empreinteDetection()));
  g.majDetectionGraphique(); assert.equal(etat(g), 'Détection interrompue · réglages conservés.');
});
await verifier('annulation et exception à la main : aucune préférence écrite, interface et monde restitués', async () => {
  const precedente = { revision: A.REVISION, statut: 'ok', selection: 'medium', empreinte: 'x', mesures: [{}], appliques: A.reglages('medium') };
  for (const scenario of [{ annulation: true }, { echec: true }, { echec: true, restaurationImpossible: true }, { annulation: true, stock: { [A.CLE]: precedente } }]) {
    const h = orchestration(B, scenario), avant = JSON.stringify(h.reglages), stock = JSON.stringify(h.stockage);
    const r = await h.detecterGraphismes(false);
    assert.equal(r.statut, 'interrompu'); assert.equal(JSON.stringify(h.reglages), avant); assert.equal(JSON.stringify(h.stockage), stock);
    assert.equal(h.actif, false); assert.equal(h.ecran, 'reglages'); assert.equal(h.nodes.get('autodetection').hidden, true);
    assert.ok(h.appels.includes('release-bench'));
    if (scenario.stock) { h.majDetectionGraphique(); assert.match(etat(h), /^Recommandé : Moyenne · vos choix gardés : qualité/, 'la précédente reste affichée'); }
  }
  // au démarrage, une exception laisse une trace : la détection est retentée à l'ouverture suivante
  const d = orchestration(B, { echec: true }); await d.detecterGraphismes(true);
  assert.equal(d.stockage[A.CLE].motif, 'erreur'); assert.equal(d.stockage['bitume.reglages'], undefined);
  assert.equal(A.cacheValide(d.stockage[A.CLE], d.empreinteDetection()), false);
});
await verifier('mesure à la taille de l’écran entier, toile rendue ensuite', async () => {
  const h = orchestration(B, { fenetre: [1280, 720], ecran: { width: 2560, height: 1440 }, styleToile: 'touch-action: none;' });
  await h.detecterGraphismes(false);
  assert.deepEqual(h.toileVue, ['2560px', '1440px'], 'plein écran pendant la mesure');
  assert.equal(h.canvas.style.cssText, 'touch-action: none;'); assert.equal(h.canvas.style.width, '');
  // fenêtre en portrait : l'écran dans le même sens ; fenêtre plus grande que l'écran : la fenêtre
  const p = orchestration(B, { fenetre: [720, 1280], ecran: { width: 2560, height: 1440 } }); await p.detecterGraphismes(false);
  assert.deepEqual(p.toileVue, ['1440px', '2560px']);
  const g = orchestration(B, { fenetre: [3000, 1200], ecran: { width: 1920, height: 1080 } }); await g.detecterGraphismes(false);
  assert.deepEqual(g.toileVue, ['3000px', '1200px']);
  const e = orchestration(B, { echec: true, ecran: { width: 1920, height: 1080 } }); await e.detecterGraphismes(false);
  assert.deepEqual(e.toileVue, ['1920px', '1080px']); assert.equal(e.canvas.style.cssText, '', 'toile rendue après une erreur');
});
await verifier('empreinte : version du badge et carte graphique ; ni la fenêtre ni l’écran', () => {
  const ici = orchestration(B, {}).empreinteDetection();
  assert.equal(ici, A.empreinte('GPU-A|16384|10', '0.2.40'));
  assert.equal(orchestration(B, { fenetre: [800, 600], ecran: { width: 3840, height: 2160 } }).empreinteDetection(), ici);
  assert.notEqual(orchestration(B, { version: '0.2.41' }).empreinteDetection(), ici);
  assert.notEqual(orchestration(B, { materiel: 'GPU-B|16384|10' }).empreinteDetection(), ici);
});
await verifier('aucune double détection et aucun lancement pendant une partie en ligne', async () => {
  let finir; const attente = new Promise(r => { finir = r; }); const h = orchestration(B, { attente });
  const t = h.detecterGraphismes(); assert.equal(h.actif, true); assert.equal(await h.detecterGraphismes(), null);
  finir(); await t; assert.equal(h.appels.filter(a => a === 'prepare-bench').length, 1);
  const reseau = orchestration(B, { enLigne: true }); assert.equal(await reseau.detecterGraphismes(), null); assert.deepEqual(reseau.stockage, {});
  reseau.majDetectionGraphique(); assert.match(etat(reseau), /partie en ligne/);
});
await verifier('perte puis retour WebGL : restaurer le vrai décor après la fin du banc', async () => {
  const h = orchestration(B, { perteContexte: true }); await h.detecterGraphismes();
  assert.equal(h.actif, false); assert.equal(h.appels.some(a => Array.isArray(a) && a[0] === 'lots'), false);
  h.contexteGraphiqueRetabli();
  assert.ok(h.appels.some(a => Array.isArray(a) && a[0] === 'lots' && a[1] === h.scene.decor.lots));
  assert.ok(h.appels.some(a => Array.isArray(a) && a[0] === 'nappes' && a[1] === h.scene.decor.nappes));
  assert.equal(h.session.course.temps, 123.45); assert.deepEqual(h.stockage, {});
});
await verifier('parcours transmis : sonde, fin forcée, simulation, glaces différées ; moteur des glaces prêté puis rendu', async () => {
  const terminer = () => {}, glaces = { gl: {} };
  const h = orchestration(B, { glaces, terminer }); await h.detecterGraphismes(false);
  assert.strictEqual(h.io.terminer, terminer, 'la détection reçoit la lecture d’un pixel du parcours');
  assert.strictEqual(h.io.sonder, h.parcours.sonder, 'la sonde de débit du parcours');
  assert.strictEqual(h.io.simuler, h.parcours.simuler); assert.strictEqual(h.io.activerGlaces, h.parcours.activerGlaces);
  assert.strictEqual(h.io.preparer, h.parcours.preparer); assert.strictEqual(h.io.dessiner, h.parcours.dessiner);
  assert.equal(h.io.profilGPU, undefined, 'le chronomètre GPU ne sert plus');
  assert.strictEqual(h.annexes[0].glaces, glaces, 'le parcours dessine les glaces avec le moteur du jeu');
  assert.equal(h.retro.scene, null, 'la prochaine glace réinstalle le décor de la séance');
  const sans = orchestration(B, {}); await sans.detecterGraphismes(false);
  assert.equal(sans.annexes[0], undefined, 'pas de moteur de glaces : le parcours crée le sien');
  assert.equal(sans.retro.scene, 'seance', 'rien à réinstaller');
});
await verifier('la vitrine suit immédiatement la densité sélectionnée ; l’onglet Image dit ce qui est gardé', async () => {
  const h = orchestration(B, { vitrine: true, cadenceBridee: true }); await h.detecterGraphismes();
  assert.ok(h.appels.some(a => Array.isArray(a) && a[0] === 'lancer' && a[1] === 'vitrine'));
  h.majDetectionGraphique();
  assert.equal(etat(h), 'Dernière détection : Moyenne · réglages appliqués. Écran bridé à 30 images par seconde pendant le test (économie d’énergie ?) : nouvelle mesure à la prochaine ouverture.');
  h.reglages.vegetation = 'ultra'; h.reglages.faune = 'off'; h.majDetectionGraphique();
  assert.match(etat(h), /^Recommandé : Moyenne · vos choix gardés : végétation, faune\./);
});
await verifier('écran bridé à 30 Hz pendant la mesure : appliquée, refaite à l’ouverture suivante, sans condamner la machine', async () => {
  // l'économie d'énergie bride l'écran et ralentit le fil principal : Légère mesurée
  const h = orchestration(B, { reglages: { ...USINE }, selection: 'low', cadenceBridee: true });
  await h.detecterGraphismes(true);
  assert.deepEqual(six(h.reglages), A.reglages('low'));
  const note = h.stockage[A.CLE];
  assert.equal(note.cadenceBridee, true); assert.equal(note.tentatives, 1);
  assert.equal(A.cacheValide(note, h.empreinteDetection()), false, 'provisoire : nouvelle mesure à la prochaine ouverture');
  // ouverture suivante sans bridage : la vraie mesure remplace Légère, choix du joueur compris
  const libre = orchestration(B, { stock: h.stockage, reglages: six(h.reglages), selection: 'medium' });
  await libre.detecterGraphismes(true);
  assert.deepEqual(six(libre.reglages), A.reglages('medium'));
  assert.ok(A.cacheValide(libre.stockage[A.CLE], libre.empreinteDetection()), 'mesure libre : verdict');
  libre.majDetectionGraphique(); assert.equal(etat(libre), 'Dernière détection : Moyenne · réglages appliqués.');
  // bridé deux fois de suite : verdict, l'onglet Image dit comment refaire la mesure
  const encore = orchestration(B, { stock: h.stockage, reglages: six(h.reglages), selection: 'low', cadenceBridee: true });
  await encore.detecterGraphismes(true);
  assert.equal(encore.stockage[A.CLE].tentatives, 2); assert.ok(A.cacheValide(encore.stockage[A.CLE], encore.empreinteDetection()));
  encore.majDetectionGraphique();
  assert.match(etat(encore), /à chaque test \(économie d’énergie \?\) : relancez la détection sans elle\.$/);
});

// E : le palier appris de la qualité Auto suit l'empreinte de la détection (version et carte graphique).
const memoirePalier = new Function('base', 'scenario', `
  const stockage = scenario.stockage, lireStock = (k, d) => stockage[k] ?? d, ecrireStock = (k, v) => { stockage[k] = JSON.parse(JSON.stringify(v)); };
  const version = scenario.version, document = { querySelector: () => ({ textContent: 'V' + version, getAttribute: () => 'Version ' + version }) };
  const B = base, materielRendu = scenario.materiel, reglages = { qualite: 'auto' }, gpuModeste = false;
  const palier = { n: scenario.n ?? 0, somme: 0, compte: 0, t: 0, aise: 0 }, PALIERS = 4;
  ${bloc('  const CLE_PALIER', '  // ---------------------------------------------------------------- profils graphiques du menu')}
  ${bloc('  function empreinteDetection()', '  function restaurerDecorApresDetection()')}
  return { retenirPalier, restaurerPalier, palier };
`);
await verifier('palier appris : gardé pour la même version et la même carte, oublié sinon', () => {
  const stockage = {}, machine = 'GPU-A|16384|10';
  memoirePalier(B, { stockage, version: '0.2.40', materiel: machine, n: 2 }).retenirPalier();
  assert.equal(stockage['bitume.palier.v1'].empreinte, A.empreinte(machine, '0.2.40'), 'même clé que la détection');
  const meme = memoirePalier(B, { stockage, version: '0.2.40', materiel: machine });
  assert.equal(meme.restaurerPalier(), true); assert.equal(meme.palier.n, 2);
  assert.equal(memoirePalier(B, { stockage, version: '0.2.41', materiel: machine }).restaurerPalier(), false, 'nouvelle version : réappris');
  assert.equal(memoirePalier(B, { stockage, version: '0.2.40', materiel: 'GPU-B|16384|10' }).restaurerPalier(), false, 'autre carte');
});

// gl : contexte du moteur. mesure : détection enregistrée. version, materiel : ceux de la page.
const demarrage = new Function('base', 'mesure', 'attente', 'version', 'materiel', `
  const appels = [], elements = new Map(); const $ = id => { if (!elements.has(id)) elements.set(id, { classList: { add() {} } }); return elements.get(id); };
  const canvas = { addEventListener() {} }, optionsRendu = {};
  let rendu = null, son = null, contexteRenduPerdu = false, gpuModeste = false, derniereDetection = null, capacitesRendu = null, session = null;
  const palier = { n: 0 }, etatProfils = base.graphismes.etatStable(), reglages = { qualite: 'high', vegetation: 'ultra', circuit: 0 };
  const CATALOGUE = [{}], clamp = (x, a, b) => Math.max(a, Math.min(b, x)), horlogeProfils = () => 0;
  const B = { ...base, son: { creer() { appels.push('son'); return {}; } } };
  const window = { devicePixelRatio: 1, FRender: { create() { appels.push('renderer'); return { stats: { backend: 'webgl2' }, gl: {} }; } } };
  const webgl2 = () => true, appliquerPalier = () => {}, lireStock = () => mesure;
  const empreinteDetection = () => base.autoconfig.empreinte(materiel || 'GPU-A', version || '0.2.40');
  const restaurerPalier = () => { appels.push('palier'); return false; };
  const detecterGraphismes = async () => { appels.push('bench'); await attente; appels.push('bench-termine'); };
  const contexteGraphiqueRetabli = () => {};
  const lancer = () => appels.push('vitrine'), aller = nom => appels.push(nom), requestAnimationFrame = () => appels.push('boucle'), image = () => {}, erreur = () => appels.push('erreur');
  ${bloc('  async function demarrer()', "  // Outil d'essai")}
  return { demarrer, appels, reglages, get derniere() { return derniereDetection; }, get gpuModeste() { return gpuModeste; } };
`);
await verifier('premier lancement : attendre la détection avant le titre, la musique et la boucle', async () => {
  let finir; const attente = new Promise(r => { finir = r; }), h = demarrage(B, null, attente);
  const execution = h.demarrer();
  assert.deepEqual(h.appels, ['renderer', 'bench']); assert.equal(h.appels.includes('titre'), false);
  finir(); await execution;
  // le palier appris de la qualité Auto est repris après la détection, avant la vitrine
  assert.deepEqual(h.appels, ['renderer', 'bench', 'bench-termine', 'palier', 'son', 'vitrine', 'titre', 'boucle']);
});
await verifier('ouverture suivante : une détection par version et par carte graphique, jamais plus', async () => {
  const ici = A.empreinte('GPU-A', '0.2.40');
  const faite = { revision: A.REVISION, statut: 'ok', empreinte: ici, selection: 'low', mesures: [{}] };
  const lance = async (mesure, version, materiel) => { const h = demarrage(B, mesure, Promise.resolve(), version, materiel); await h.demarrer(); return h; };
  let h = await lance(faite);
  assert.equal(h.appels.includes('bench'), false, 'même version, même carte'); assert.ok(h.appels.includes('titre'));
  assert.strictEqual(h.derniere, faite); assert.equal(h.gpuModeste, true, 'Légère mesurée : petite configuration');
  assert.equal(h.reglages.qualite, 'high', 'choix manuels conservés'); assert.equal(h.reglages.vegetation, 'ultra');
  assert.ok((await lance(faite, '0.2.41')).appels.includes('bench'), 'nouvelle version');
  assert.ok((await lance(faite, '0.2.40', 'GPU-B')).appels.includes('bench'), 'autre carte graphique');
  assert.ok((await lance({ ...faite, revision: 2 })).appels.includes('bench'), 'détection de la révision 2 : refaite une fois');
  const passee = { revision: A.REVISION, statut: 'interrompu', motif: 'annule', empreinte: ici, tentatives: 1 };
  h = await lance(passee); assert.equal(h.appels.includes('bench'), false, 'passée par le joueur'); assert.equal(h.gpuModeste, false);
  assert.ok((await lance({ ...passee, motif: 'delai' })).appels.includes('bench'), 'interrompue une fois : refaite');
  assert.equal((await lance({ ...passee, motif: 'delai', tentatives: 2 })).appels.includes('bench'), false, 'interrompue deux fois : laissée');
  assert.ok((await lance({ ...faite, cadenceBridee: true, tentatives: 1 })).appels.includes('bench'), 'mesurée sous un écran bridé : refaite');
  assert.equal((await lance({ ...faite, cadenceBridee: true, tentatives: 2 })).appels.includes('bench'), false, 'bridée deux fois : laissée');
});
console.log(`${n} contrôles d’intégration de la détection réussis.`);
