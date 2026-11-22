// Orchestration réellement utilisée par le jeu, aux frontières DOM/renderer simulées.
// Les frontières de banc lèvent une erreur : ni la détection ni le démarrage ne
// doivent préparer, dessiner ou chronométrer une scène pour tester l'appareil.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
require('../src/autoconfig.js'); require('../src/graphismes.js'); require('../src/ferro/surface.js');
const B = globalThis.BITUME, A = B.autoconfig;
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
function bloc(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a);
  assert.ok(a >= 0 && b > a, debut); return source.slice(a, b);
}
const USINE = { qualite: 'auto', anticrenelage: 'profil', ombres: 'profil', vegetation: 'profil', faune: 'profil', retro: 'auto' };
const six = o => Object.fromEntries(A.CLES.map(k => [k, o[k]]));
const iphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  platform: 'iPhone', maxTouchPoints: 5, hardwareConcurrency: undefined, deviceMemory: undefined };
const ipad = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
  platform: 'MacIntel', maxTouchPoints: 5, hardwareConcurrency: 8, deviceMemory: undefined };
const bureau = { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/144.0.0.0 Safari/537.36', platform: 'Linux x86_64',
  maxTouchPoints: 0, hardwareConcurrency: 16, deviceMemory: 8 };
const xbox = { ...bureau, platform: 'Win32', hardwareConcurrency: 8,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) Chrome/144 Safari/537.36 Edg/144' };
const orchestration = new Function('base', 'scenario', `
  const appels = [], erreurs = [], stockage = JSON.parse(JSON.stringify(scenario.stock || {})), nodes = new Map();
  const ecouteurs = new Map();
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: id !== 'reglages', dataset: {}, textContent: '', disabled: false,
      classList: { add(v) { appels.push('classe:' + id + ':' + v); } }, addEventListener() {}, focus() { appels.push('focus:' + id); } });
    return nodes.get(id);
  };
  const [innerWidth, innerHeight] = scenario.fenetre || [1280, 720];
  const navigator = scenario.navigator || ${JSON.stringify(bureau)};
  const matchMedia = () => ({ matches: !!scenario.coarse });
  const version = scenario.version || '0.2.80';
  const badge = { textContent: 'V' + version, getAttribute: () => 'Version ' + version };
  const document = { hidden: !!scenario.cache, visibilityState: scenario.cache ? 'hidden' : 'visible',
    activeElement: $('r-detecter'), querySelector: s => s === '.version-jeu' ? badge : null,
    addEventListener(t, f) { if (!ecouteurs.has(t)) ecouteurs.set(t, new Set()); ecouteurs.get(t).add(f); },
    removeEventListener(t, f) { ecouteurs.get(t)?.delete(f); } };
  const montrer = () => { document.hidden = false; document.visibilityState = 'visible';
    for (const f of [...(ecouteurs.get('visibilitychange') || [])]) f(); };
  const console = { warn() {}, error(e) { erreurs.push(e.message); } }, addEventListener = () => {};
  const canvas = { style: { cssText: 'width: 390px; height: 844px' }, addEventListener() {} };
  const jeu = { dataset: { ecran: scenario.demarrage ? 'chargement' : 'reglages', partage: 'haut-bas' } };
  let ecran = jeu.dataset.ecran, detectionGraphiqueActive = false, annulerDetection = false, contexteRenduPerdu = false;
  let contexteFragile = false, restaurerDecorApresContexte = false, derniereDetection = null, gpuModeste = false;
  let materielRendu = scenario.materiel || 'GPU-A|16384|16';
  const lireStock = (k, d) => stockage[k] ?? d, ecrireStock = (k, v) => { stockage[k] = JSON.parse(JSON.stringify(v)); };
  const DEFAUT = { ...${JSON.stringify(USINE)} }, reglages = Object.assign({ ...DEFAUT, moment: 'nuit', meteo: 'pluie',
    pneus: 'pluie', tours: 9, commandes: ['clavier', 'manette'], circuit: 0 }, scenario.reglages || {});
  const etatProfils = base.graphismes.etatStable(), palier = { n: 0 }, horlogeProfils = () => 0;
  let capacitesRendu = base.graphismes.capacites({ msaa: 4, shadowMapScale: 2, reflections: true }, false, 1);
  const moteurs = [], renderer = () => ({ stats: { backend: 'webgl2' },
    draw() { throw Error('dessin interdit pendant la détection'); },
    setWorld() { appels.push('restaurer-world'); }, setNappes() { appels.push('restaurer-nappes'); }, setLots() { appels.push('restaurer-lots'); } });
  let rendu = scenario.demarrage ? null : renderer(), son = null;
  const window = { devicePixelRatio: 3, screen: { width: 390, height: 844 },
    FRender: { create(c, options) { appels.push('renderer'); const r = renderer(); moteurs.push({ options, r }); return r; } },
    FPhysX: scenario.physx === null ? null : { isReady() { appels.push('physx'); return scenario.physx !== false; } } };
  const interdit = nom => () => { appels.push(nom); throw Error(nom + ' interdit'); };
  let estimations = 0;
  const B = { ...base, autoconfig: { ...base.autoconfig,
    passive(...args) { estimations++; return base.autoconfig.passive(...args); }, executer: interdit('banc-rafales') },
    sceneBench: { creer: interdit('scene-test') }, son: { creer() { appels.push('son'); return {}; } } };
  const scene = { decor: { atmosphere: {}, nappes: [], lots: [] }, chauffe: {} };
  let session = scenario.demarrage ? null : { type: scenario.vitrine ? 'vitrine' : 'course', i: 0,
    enLigne: !!scenario.enLigne, course: { temps: 123.45 }, nature: { ambiance: { atmosphere: {} }, revisionRendu: 2 } };
  const EL = { R: scenario.salon ? {} : null }, prepa = { enCours: false, dernier: null };
  const abandonnerPreparation = () => appels.push('abandon-preparation');
  const appliquerPalier = () => appels.push('profil:' + reglages.qualite);
  const remplirReglages = () => appels.push('options'), lancerVitrine = () => appels.push('vitrine-reprise');
  const restaurerPalier = () => { appels.push('palier'); return false; };
  const CATALOGUE = [{}], clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const glacesPossibles = () => reglages.retro !== 'non', creerMoteurRetro = () => appels.push('retro');
  const preparerSeance = async (type, i) => { appels.push('seance:' + type + ':' + reglages.qualite); session = { type, i }; };
  const lancer = type => { appels.push('lancer:' + type); session = { type, i: 0 }; };
  const aller = nom => { appels.push(nom); ecran = nom; jeu.dataset.ecran = nom; };
  const image = () => {}, requestAnimationFrame = () => appels.push('boucle');
  const erreur = () => appels.push('erreur'), ouvrirAccesOutils = () => appels.push('outils');
  const webgl2 = () => true;
  ${bloc('  function capacitesDeclarees()', '  async function demarrer()')}
  ${bloc('  async function demarrer()', "  // Outil d'essai")}
  return { detecterGraphismes, majDetectionGraphique, appliquerDetection, contexteGraphiqueRetabli, empreinteDetection,
    capacitesDeclarees, preferenceGraphique, demarrer, appels, erreurs, stockage, reglages, nodes, montrer, moteurs,
    get session() { return session; }, scene, canvas, jeu, get ecran() { return ecran; }, get actif() { return detectionGraphiqueActive; },
    get gpuModeste() { return gpuModeste; }, get derniere() { return derniereDetection; }, get estimations() { return estimations; } };
`);
const trace = (profil, version = '0.2.80') => ({ revision: A.REVISION, methode: A.METHODE, statut: 'ok',
  selection: profil, empreinte: A.empreinte('GPU-A|16384|16', version), mesures: [{}], appliques: A.reglages(profil) });

for (const [nom, nav] of [['iPhone', iphone], ['iPad avec agent Mac', ipad], ['Android', { ...bureau, userAgent: 'Android 16 Mobile', maxTouchPoints: 5 }]]) {
  test(nom + ' : premier lancement prudent sans scène de mesure ni rétroviseur supplémentaire', async () => {
    const h = orchestration(B, { demarrage: true, navigator: nav, fenetre: [390, 844], coarse: true });
    await h.demarrer();
    assert.deepEqual(h.erreurs, []); assert.equal(h.ecran, 'titre'); assert.equal(h.session, null);
    assert.deepEqual(six(h.reglages), A.reglages('low'));
    assert.equal(h.estimations, 1); assert.equal(h.gpuModeste, true);
    assert.equal(h.appels.includes('retro'), false); assert.equal(h.appels.some(a => /banc|scene-test/.test(a)), false);
    assert.deepEqual(h.appels.filter(a => a.startsWith('profil:')), ['profil:low'], 'aucune allocation provisoire d’un profil coûteux');
    assert.equal(h.appels.some(a => a.startsWith('seance:') || a.startsWith('lancer:')), false);
    assert.ok(h.appels.indexOf('profil:low') < h.appels.indexOf('titre'));
    assert.ok(h.appels.includes('boucle')); assert.equal(h.canvas.style.cssText, 'width: 390px; height: 844px');
    assert.equal(h.nodes.get('autodetection'), undefined, 'aucun écran de test créé ou ouvert');
    for (const cle of ['resolution', 'maxPixels', 'renderScale'])
      assert.equal(Object.hasOwn(h.moteurs[0].options, cle), false, 'plafond Xbox absent sur mobile : ' + cle);
  });
}

test('Xbox sur grand écran : profil léger avant la séance, sans banc ni moteur de rétroviseurs', async () => {
  for (const nav of [xbox, { ...bureau, userAgentData: { platform: 'Xbox', mobile: false } }]) {
    const h = orchestration(B, { demarrage: true, navigator: nav, fenetre: [3840, 2160], materiel: 'AMD Radeon|16384|8' });
    await h.demarrer();
    assert.deepEqual(h.erreurs, []); assert.equal(h.ecran, 'titre');
    assert.deepEqual(six(h.reglages), A.reglages('low'));
    assert.equal(h.stockage[A.CLE].appareil.xbox, true); assert.equal(h.stockage[A.CLE].performancesMesurees, false);
    assert.equal(h.estimations, 1); assert.equal(h.gpuModeste, true);
    assert.equal(h.appels.includes('retro'), false); assert.equal(h.appels.some(a => /banc|scene-test/.test(a)), false);
    assert.deepEqual(h.appels.filter(a => a.startsWith('profil:')), ['profil:low']);
    assert.equal(h.appels.some(a => a.startsWith('seance:') || a.startsWith('lancer:')), false);
    assert.ok(h.appels.indexOf('profil:low') < h.appels.indexOf('titre'));
    assert.deepEqual(h.reglages.commandes, ['clavier', 'manette'], 'la détection graphique ne réaffecte aucun joueur');
    assert.equal(h.moteurs.length, 1);
    assert.equal(h.moteurs[0].options.resolution, 'native');
    assert.equal(h.moteurs[0].options.maxPixels, 1280 * 720); assert.equal(h.moteurs[0].options.renderScale, 1);
  }
});

test('Xbox : la surface FERRO réelle borne le buffer à 720p après changement de DPR et redimensionnement', async () => {
  const h = orchestration(B, { demarrage: true, navigator: xbox, fenetre: [3840, 2160] });
  await h.demarrer();
  const options = h.moteurs[0].options, bounds = { left: 0, top: 0, right: 3840, bottom: 2160 };
  let changement, debranche = false;
  const environnement = { devicePixelRatio: 1, ResizeObserver: class {
    constructor(callback) { changement = callback; }
    observe() {}
    disconnect() { debranche = true; }
  } };
  const canvas = { width: 1, height: 1, style: { width: '100%', height: '100%' }, getBoundingClientRect: () => bounds };
  const surface = globalThis.FSurface.create(canvas, { environment: environnement, maxPixels: options.maxPixels, scale: options.renderScale });
  const verifier = (largeur, hauteur, dpr, attendu) => {
    bounds.right = largeur; bounds.bottom = hauteur; environnement.devicePixelRatio = dpr;
    surface.measure(); const image = surface.size();
    assert.deepEqual([image.width, image.height], attendu);
    assert.ok(image.width * image.height <= 1280 * 720, 'pas de buffer au-delà du budget');
    assert.ok(image.width <= largeur * dpr && image.height <= hauteur * dpr && surface.stats.scale <= 1,
      'aucun suréchantillonnage de l’écran physique');
    if (largeur * hauteur >= 1280 * 720) assert.ok(image.ratio <= 1, 'grande fenêtre : au plus un pixel par pixel CSS');
    assert.deepEqual(canvas.style, { width: '100%', height: '100%' }, 'le HUD conserve sa définition CSS');
    return image;
  };
  verifier(3840, 2160, 1, [1280, 720]);
  verifier(3840, 2160, 2, [1280, 720]);
  verifier(1920, 1080, 2, [1280, 720]);
  verifier(1080, 1920, 2, [720, 1280]);
  verifier(960, 540, 2, [1280, 720]);
  verifier(640, 360, 1, [640, 360]);
  // Le navigateur peut annoncer directement les pixels physiques à l’observateur.
  // Le même plafond doit s'appliquer sans une mesure manuelle supplémentaire.
  changement([{ target: canvas, devicePixelContentBoxSize: [{ inlineSize: 7680, blockSize: 4320 }] }]);
  const apresResize = surface.size();
  assert.deepEqual([apresResize.width, apresResize.height], [1280, 720]);
  assert.ok(apresResize.width * apresResize.height <= 1280 * 720);
  surface.dispose(); assert.equal(debranche, true);
});

test('le build inclut la dépendance FERRO du dimensionnement natif avant la coque', () => {
  const build = readFileSync(new URL('../construire.py', import.meta.url), 'utf8');
  const liste = /MODULES = \[([\s\S]*?)^\]/m.exec(build);
  assert.ok(liste, 'liste explicite des modules du jeu');
  const modules = [...liste[1].matchAll(/^\s*'([^']+)'/gm)].map(m => m[1]);
  const surface = modules.indexOf('ferro/surface.js'), jeu = modules.indexOf('jeu.js');
  assert.ok(surface >= 0 && jeu > surface, 'FSurface doit exister avant FRender.create en mode natif');
});

test('Xbox : l’ancien profil passif automatique est revu une fois, les choix manuels restent conservés', async () => {
  const ancien = { ...A.passive(bureau, A.empreinte('AMD Radeon|16384|8', '0.2.80')),
    revision: A.REVISION - 1, appliques: A.reglages('medium') };
  const h = orchestration(B, { demarrage: true, navigator: xbox, fenetre: [3840, 2160], materiel: 'AMD Radeon|16384|8',
    stock: { [A.CLE]: ancien }, reglages: { ...A.reglages('medium'), faune: 'high' } });
  await h.demarrer();
  assert.deepEqual(h.erreurs, []); assert.equal(h.ecran, 'titre');
  assert.deepEqual(six(h.reglages), { ...A.reglages('low'), faune: 'high' });
  assert.deepEqual(h.stockage[A.CLE].gardes, ['faune']);
  assert.equal(h.stockage[A.CLE].revision, A.REVISION); assert.equal(h.stockage[A.CLE].performancesMesurees, false);
  assert.equal(h.appels.some(a => /banc|scene-test/.test(a)), false);
});

test('Xbox légère : réactiver les animaux du profil, respecter la désactivation du joueur', async () => {
  const valeurs = { ...A.reglages('low'), faune: 'off' };
  const ancienne = { ...trace('low', '0.2.90'), revision: A.REVISION - 1, appliques: valeurs };
  for (const manuel of [false, true]) {
    const h = orchestration(B, { demarrage: true, navigator: xbox, stock: { [A.CLE]: ancienne },
      reglages: { ...valeurs, fauneCoupeeManuellement: manuel } });
    await h.demarrer();
    assert.equal(h.reglages.faune, manuel ? 'off' : 'low');
  }
});

test('migration d’un ancien résultat de rafales : aucun nouveau test, profil automatique abaissé sur téléphone', async () => {
  for (const extra of [{}, { provisoire: true, tentatives: 1 }, { cadenceBridee: true, tentatives: 1 }]) {
    const ancienne = { ...trace('extreme', '0.2.79'), ...extra };
    const h = orchestration(B, { demarrage: true, navigator: iphone, stock: { [A.CLE]: ancienne }, reglages: A.reglages('extreme') });
    await h.demarrer();
    assert.equal(h.ecran, 'titre'); assert.deepEqual(six(h.reglages), A.reglages('low'));
    assert.equal(h.stockage[A.CLE].methode, A.METHODE_PASSIVE); assert.deepEqual(h.stockage[A.CLE].mesures, []);
    assert.equal(h.stockage[A.CLE].performancesMesurees, false);
    assert.ok(A.cacheValide(h.stockage[A.CLE], h.empreinteDetection()));
  }
});

test('choix retouchés après une ancienne mesure préservés, autres réglages migrés', async () => {
  const ancienne = trace('high', '0.2.79');
  const h = orchestration(B, { navigator: iphone, stock: { [A.CLE]: ancienne },
    reglages: { ...A.reglages('high'), qualite: 'medium', faune: 'ultra' } });
  await h.detecterGraphismes(true);
  assert.equal(h.reglages.qualite, 'medium'); assert.equal(h.reglages.faune, 'ultra');
  assert.equal(h.reglages.ombres, 'off'); assert.equal(h.reglages.retro, 'non');
  assert.deepEqual(h.stockage[A.CLE].gardes, ['qualite', 'faune']);
  assert.equal(h.reglages.meteo, 'pluie'); assert.equal(h.reglages.tours, 9);
});

test('sans ancien reçu, les options manuelles restent conservées et les options Auto suivent le profil', async () => {
  const h = orchestration(B, { demarrage: true, navigator: iphone, reglages: A.reglages('high') });
  await h.demarrer();
  assert.equal(h.ecran, 'titre'); assert.deepEqual(six(h.reglages), { ...A.reglages('high'), retro: 'non' });
  assert.equal(h.stockage[A.CLE].selection, 'low');
  assert.match(h.nodes.get('r-detection-etat').textContent, /Vos choix gardés/);
});

test('bouton Image : applique le profil passif sans remplacer la course ni agrandir la toile', async () => {
  const h = orchestration(B, { navigator: iphone, reglages: A.reglages('high') }), session = h.session;
  const r = await h.detecterGraphismes(false);
  assert.equal(r.selection, 'low'); assert.deepEqual(six(h.reglages), A.reglages('low'));
  assert.strictEqual(h.session, session); assert.equal(h.session.course.temps, 123.45);
  assert.equal(h.ecran, 'reglages'); assert.equal(h.jeu.dataset.partage, 'haut-bas');
  assert.equal(h.canvas.style.cssText, 'width: 390px; height: 844px');
  assert.equal(h.appels.some(a => /banc|scene-test|restaurer|abandon/.test(a)), false);
  assert.equal(h.actif, false); assert.equal(h.reglages.moment, 'nuit');
  assert.deepEqual(h.reglages.commandes, ['clavier', 'manette']);
});

test('cache passif et nouvelle version : titre accessible, aucune reprise des anciens essais', async () => {
  const premier = orchestration(B, { demarrage: true, navigator: iphone }); await premier.demarrer();
  const stock = premier.stockage;
  const meme = orchestration(B, { demarrage: true, navigator: iphone, stock, reglages: stock['bitume.reglages'] });
  await meme.demarrer(); assert.equal(meme.estimations, 0); assert.equal(meme.ecran, 'titre');
  const nouveau = orchestration(B, { demarrage: true, navigator: iphone, version: '0.2.81', stock, reglages: stock['bitume.reglages'] });
  await nouveau.demarrer(); assert.equal(nouveau.estimations, 1); assert.equal(nouveau.ecran, 'titre');
  assert.deepEqual(six(nouveau.reglages), A.reglages('low'));
  for (const h of [meme, nouveau]) assert.equal(h.appels.some(a => /banc|scene-test/.test(a)), false);
});

test('partie ou salon en ligne : bouton indisponible, aucun réglage remplacé', async () => {
  for (const contexte of [{ enLigne: true }, { salon: true }]) {
    const h = orchestration(B, { ...contexte, navigator: iphone, reglages: A.reglages('high') });
    assert.equal(await h.detecterGraphismes(false), null); assert.equal(h.estimations, 0);
    assert.deepEqual(six(h.reglages), A.reglages('high')); assert.deepEqual(h.stockage, {});
    h.majDetectionGraphique(); assert.equal(h.nodes.get('r-detecter').disabled, true);
  }
});

test('onglet caché : attend seulement la visibilité requise par le renderer, puis affiche le titre', async () => {
  const h = orchestration(B, { demarrage: true, cache: true, navigator: iphone });
  const t = h.demarrer(); await Promise.resolve();
  assert.equal(h.appels.includes('renderer'), false); assert.equal(h.estimations, 0);
  h.montrer(); await t;
  assert.equal(h.ecran, 'titre'); assert.equal(h.appels.some(a => /banc|scene-test/.test(a)), false);
});

test('PhysX absent ou non prêt : le menu ouvre avant toute demande de physique', async () => {
  for (const physx of [null, false]) {
    const h = orchestration(B, { demarrage: true, navigator: iphone, physx }); await h.demarrer();
    assert.deepEqual(h.erreurs, []); assert.equal(h.ecran, 'titre');
    assert.ok(h.appels.includes('outils')); assert.equal(h.appels.includes('physx'), false);
    assert.equal(h.appels.some(a => a.startsWith('seance:')), false);
  }
});

test('ordinateur : recommandation annoncée comme estimation, sans niveau extrême automatique', async () => {
  const h = orchestration(B, { demarrage: true, navigator: bureau }); await h.demarrer();
  assert.equal(h.ecran, 'titre'); assert.equal(h.reglages.qualite, 'medium');
  assert.equal(h.session, null); assert.equal(h.appels.includes('retro'), false);
  assert.equal(h.stockage[A.CLE].performancesMesurees, false); assert.match(h.nodes.get('r-detection-etat').textContent, /Profil estimé/);
  for (const cle of ['resolution', 'maxPixels', 'renderScale'])
    assert.equal(Object.hasOwn(h.moteurs[0].options, cle), false, 'plafond Xbox absent sur ordinateur : ' + cle);
});

// Conservation du contrôle antérieur du palier Auto appris en course : cette
// mémoire est distincte de tout banc et ne dépend ni de la fenêtre ni de l'écran.
const memoirePalier = new Function('base', 'scenario', `
  const stockage = scenario.stockage, lireStock = (k, d) => stockage[k] ?? d;
  const ecrireStock = (k, v) => { stockage[k] = JSON.parse(JSON.stringify(v)); };
  const version = scenario.version, document = { querySelector: () => ({ textContent: 'V' + version, getAttribute: () => 'Version ' + version }) };
  const B = base, materielRendu = scenario.materiel, reglages = { qualite: 'auto' }, gpuModeste = false;
  const palier = { n: scenario.n ?? 0, somme: 0, compte: 0, t: 0, aise: 0 }, PALIERS = 4;
  ${bloc('  const CLE_PALIER', '  // ---------------------------------------------------------------- profils graphiques du menu')}
  ${bloc('  function empreinteDetection()', '  function restaurerDecorApresDetection()')}
  return { retenirPalier, restaurerPalier, palier };
`);
test('palier Auto appris en course : conservé pour la même version et la même machine', () => {
  const stockage = {}, machine = 'GPU-A|16384|10';
  memoirePalier(B, { stockage, version: '0.2.80', materiel: machine, n: 2 }).retenirPalier();
  assert.equal(stockage['bitume.palier.v1'].empreinte, A.empreinte(machine, '0.2.80'));
  const meme = memoirePalier(B, { stockage, version: '0.2.80', materiel: machine });
  assert.equal(meme.restaurerPalier(), true); assert.equal(meme.palier.n, 2);
  assert.equal(memoirePalier(B, { stockage, version: '0.2.81', materiel: machine }).restaurerPalier(), false);
  assert.equal(memoirePalier(B, { stockage, version: '0.2.80', materiel: 'GPU-B' }).restaurerPalier(), false);
});

test('orientation ou taille de fenêtre : aucun nouveau réglage automatique ni essai', async () => {
  const portrait = orchestration(B, { demarrage: true, navigator: iphone, fenetre: [390, 844] }); await portrait.demarrer();
  const paysage = orchestration(B, { demarrage: true, navigator: iphone, fenetre: [844, 390],
    stock: portrait.stockage, reglages: portrait.stockage['bitume.reglages'] });
  await paysage.demarrer();
  assert.equal(paysage.empreinteDetection(), portrait.empreinteDetection());
  assert.equal(paysage.estimations, 0); assert.equal(paysage.ecran, 'titre');
  assert.equal(paysage.appels.some(a => /banc|scene-test/.test(a)), false);
});
