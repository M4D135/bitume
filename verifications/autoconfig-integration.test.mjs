// Fonctions d'orchestration de production, frontières DOM/rendu simulées. Aucune prétention de test GPU.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/autoconfig.js'); require('../src/graphismes.js');
const B = globalThis.BITUME, source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
function bloc(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a);
  assert.ok(a >= 0 && b > a); return source.slice(a, b);
}
const orchestration = new Function('base', 'scenario', `
  const appels = [], stockage = {}, nodes = new Map();
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: id !== 'reglages', dataset: {}, textContent: '', value: 0,
      classList: { add() {} }, addEventListener() {}, focus() { appels.push('focus:' + id); } });
    return nodes.get(id);
  };
  const innerWidth = 1280, innerHeight = 720, window = { devicePixelRatio: 1 };
  const document = { hidden: false, activeElement: $('r-detecter'), addEventListener() {} };
  const addEventListener = () => {};
  const requestAnimationFrame = fn => queueMicrotask(() => fn(100));
  const console = { warn() {} };
  const lireStock = (k,d) => stockage[k] ?? d, ecrireStock = (k,v) => { stockage[k] = JSON.parse(JSON.stringify(v)); };
  let detectionGraphiqueActive = false, annulerDetection = false, contexteRenduPerdu = false, materielRendu = 'GPU', derniereDetection = null;
  let restaurerDecorApresContexte = false;
  let ecran = 'reglages', gpuModeste = true;
  const jeu = { dataset: { ecran: 'reglages', partage: 'haut-bas' } }, hud2 = $('hud2');
  const ECRANS = ['titre', 'reglages', 'pause'], EL = { R: scenario.enLigne ? {} : null };
  const son = { musique() {}, suspendre() {}, reprendre() {} };
  let profile = null;
  const rendu = { profile(v) { if (v === false) profile = null; if (v === true) profile = {}; return profile; },
    setWorld(...a) { appels.push(['world', ...a]); if (scenario.restaurationImpossible) throw Error('lost'); },
    setNappes(a) { appels.push(['nappes',a]); }, setLots(a) { appels.push(['lots',a]); } };
  const obstacles = { solides: [1,2,3] };
  const scene = { decor: { atmosphere: { ciel: 1 }, nappes: [1], lots: [2] }, c: { obstacles } };
  const session = { type: scenario.vitrine ? 'vitrine' : 'course', i: 2, c: scene.c, course: { temps: 123.45 }, nature: { ambiance: { atmosphere: { nuit: .8 } }, revisionRendu: 4 } };
  const avantSession = session;
  let capacitesRendu = base.graphismes.capacites({ msaa: 4, shadowMapScale: 2, reflections: true }, true, 1);
  const etatProfils = base.graphismes.etatStable(), palier = { n: 3 }, horlogeProfils = () => 0;
  const reglages = { qualite: 'high', anticrenelage: 'msaa4', ombres: 'high', vegetation: 'ultra', faune: 'ultra', retro: 'oui', moment: 'nuit', meteo: 'pluie', pneus: 'pluie', tours: 9, commandes: ['clavier','manette'] };
  const appliquerPalier = () => appels.push('resize'), oublierIntervalle = () => appels.push('reset-clock');
  const remplirReglages = () => appels.push('refresh-options'), lancer = (...a) => appels.push(['lancer', ...a]);
  const resultat = { revision: base.autoconfig.REVISION, statut: 'ok', selection: 'medium', empreinte: 'machine', mesures: [{}], reglages: base.autoconfig.reglages('medium') };
  const B = { ...base, autoconfig: { ...base.autoconfig, async executer(io) {
    if (scenario.attente) await scenario.attente;
    if (scenario.echec) throw Error('driver');
    if (scenario.perteContexte) { contexteRenduPerdu = true; return { statut: 'interrompu', motif: 'contexte_perdu' }; }
    if (scenario.annulation) return { statut: 'interrompu', motif: 'annule' };
    return resultat;
  } }, sceneBench: { creer() { appels.push('prepare-bench'); return { preparer() {}, dessiner() {}, liberer() { appels.push('release-bench'); } }; } } };
  ${bloc('  function empreinteDetection()', '  async function demarrer()')}
  return { detecterGraphismes, majDetectionGraphique, appliquerDetection, contexteGraphiqueRetabli, resultat, appels, stockage, reglages,
    scene, session, obstacles, nodes, get actif() { return detectionGraphiqueActive; }, get ecran() { return ecran; }, jeu,
    get gpuModeste() { return gpuModeste; } };
`);
let n = 0;
async function verifier(nom, f) { await f(); n++; console.log('ok ' + nom); }
await verifier('relance : remplace les six options, garde conduite/météo/moment et la course', async () => {
  const h = orchestration(B, {}), s = h.session, obstacles = h.scene.c.obstacles;
  const r = await h.detecterGraphismes(false);
  assert.equal(r.statut, 'ok'); assert.deepEqual(Object.fromEntries(B.autoconfig.CLES.map(k => [k,h.reglages[k]])), B.autoconfig.reglages('medium'));
  assert.equal(h.reglages.moment, 'nuit'); assert.equal(h.reglages.meteo, 'pluie'); assert.equal(h.reglages.tours, 9);
  assert.deepEqual(h.reglages.commandes, ['clavier','manette']);
  assert.strictEqual(h.session, s); assert.strictEqual(h.scene.c.obstacles, obstacles); assert.equal(s.course.temps, 123.45);
  assert.equal(h.ecran, 'reglages'); assert.equal(h.jeu.dataset.partage, 'haut-bas'); assert.equal(h.actif, false);
  assert.equal(h.nodes.get('reglages').hidden, false); assert.equal(h.nodes.get('autodetection').hidden, true);
  assert.deepEqual(Object.keys(h.stockage).sort(), ['bitume.reglages', B.autoconfig.CLE].sort());
  assert.equal(h.gpuModeste, false); assert.equal(h.appels.some(a => Array.isArray(a) && a[0] === 'lancer'), false);
});
await verifier('annulation et exception : aucune préférence écrite, interface et monde restitués', async () => {
  for (const scenario of [{ annulation: true }, { echec: true }, { echec: true, restaurationImpossible: true }]) {
    const h = orchestration(B, scenario), avant = JSON.stringify(h.reglages);
    const r = await h.detecterGraphismes();
    assert.equal(r.statut, 'interrompu'); assert.equal(JSON.stringify(h.reglages), avant); assert.deepEqual(h.stockage, {});
    assert.equal(h.actif, false); assert.equal(h.ecran, 'reglages'); assert.equal(h.nodes.get('autodetection').hidden, true);
    assert.ok(h.appels.includes('release-bench'));
  }
});
await verifier('aucune double détection et aucun lancement pendant une partie en ligne', async () => {
  let finir; const attente = new Promise(r => { finir = r; }); const h = orchestration(B, { attente });
  const t = h.detecterGraphismes(); assert.equal(h.actif, true); assert.equal(await h.detecterGraphismes(), null);
  finir(); await t; assert.equal(h.appels.filter(a => a === 'prepare-bench').length, 1);
  const reseau = orchestration(B, { enLigne: true }); assert.equal(await reseau.detecterGraphismes(), null); assert.deepEqual(reseau.stockage, {});
});
await verifier('perte puis retour WebGL : restaurer le vrai décor après la fin du banc', async () => {
  const h = orchestration(B, { perteContexte: true }); await h.detecterGraphismes();
  assert.equal(h.actif, false); assert.equal(h.appels.some(a => Array.isArray(a) && a[0] === 'lots'), false);
  h.contexteGraphiqueRetabli();
  assert.ok(h.appels.some(a => Array.isArray(a) && a[0] === 'lots' && a[1] === h.scene.decor.lots));
  assert.ok(h.appels.some(a => Array.isArray(a) && a[0] === 'nappes' && a[1] === h.scene.decor.nappes));
  assert.equal(h.session.course.temps, 123.45); assert.deepEqual(h.stockage, {});
});
await verifier('la vitrine suit immédiatement la densité sélectionnée, les préférences manuelles sont signalées', async () => {
  const h = orchestration(B, { vitrine: true }); await h.detecterGraphismes();
  assert.ok(h.appels.some(a => Array.isArray(a) && a[0] === 'lancer' && a[1] === 'vitrine'));
  h.majDetectionGraphique(); assert.match(h.nodes.get('r-detection-etat').textContent, /appliqués/);
  h.reglages.vegetation = 'ultra'; h.majDetectionGraphique(); assert.match(h.nodes.get('r-detection-etat').textContent, /modifiés/);
});
const demarrage = new Function('base','mesure','attente', `
  const appels=[], elements=new Map(); const $=id=>{if(!elements.has(id))elements.set(id,{classList:{add(){}}});return elements.get(id);};
  const canvas={addEventListener(){}},optionsRendu={};
  let rendu=null,son=null,contexteRenduPerdu=false,gpuModeste=false,derniereDetection=null,capacitesRendu=null;
  const palier={n:0},etatProfils=base.graphismes.etatStable(),reglages={qualite:'high',vegetation:'ultra',circuit:0};
  const CATALOGUE=[{}],clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),horlogeProfils=()=>0;
  const B={...base,son:{creer(){appels.push('son');return{};}}};
  const window={devicePixelRatio:1,FRender:{create(){appels.push('renderer');return{stats:{backend:'webgl2'}};}}};
  const webgl2=()=>true,appliquerPalier=()=>{},lireStock=()=>mesure,empreinteDetection=()=> 'machine';
  const detecterGraphismes=async()=>{appels.push('bench');await attente;appels.push('bench-termine');};
  const contexteGraphiqueRetabli=()=>{};
  const lancer=()=>appels.push('vitrine'),aller=nom=>appels.push(nom),requestAnimationFrame=()=>appels.push('boucle'),image=()=>{},erreur=()=>appels.push('erreur');
  ${bloc('  async function demarrer()', "  // Outil d'essai")}
  return {demarrer,appels,reglages};
`);
await verifier('premier lancement : attendre le benchmark avant le titre, la musique et la boucle', async () => {
  let finir; const attente = new Promise(r => { finir = r; }), h = demarrage(B, null, attente);
  const execution = h.demarrer();
  assert.deepEqual(h.appels, ['renderer','bench']); assert.equal(h.appels.includes('titre'), false);
  finir(); await execution;
  assert.deepEqual(h.appels, ['renderer','bench','bench-termine','son','vitrine','titre','boucle']);
});
await verifier('démarrage suivant : cache compatible, choix manuels conservés et aucun nouveau bench', async () => {
  const mesure = { revision: B.autoconfig.REVISION, statut: 'ok', empreinte: 'machine', selection: 'medium', mesures: [{}] };
  const h = demarrage(B, mesure, new Promise(() => {})); await h.demarrer();
  assert.equal(h.appels.includes('bench'), false); assert.ok(h.appels.includes('titre'));
  assert.equal(h.reglages.qualite, 'high'); assert.equal(h.reglages.vegetation, 'ultra');
});
console.log(`${n} contrôles d’intégration de la détection réussis.`);
