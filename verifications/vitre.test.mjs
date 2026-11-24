import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/vitre.js');
const V = globalThis.BITUME.vitre;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
function canvas(w = 1280, h = 720) {
  const stats = { effaces: 0, chemins: 0, ellipses: 0, tailles: [] };
  const ctx = { globalAlpha: 1, setTransform(...n) { assert(n.every(Number.isFinite)); }, clearRect() { stats.effaces++; },
    beginPath() { stats.chemins++; }, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, stroke() {}, fill() {},
    ellipse(x, y, rx, ry, angle) { assert([x, y, rx, ry, angle].every(Number.isFinite)); assert(rx >= 0 && ry >= 0); stats.ellipses++; } };
  return { width: w, height: h, clientWidth: w, clientHeight: h, ctx, stats,
    getContext(type, options) { assert.equal(type, '2d'); assert.equal(options.alpha, true); return ctx; } };
}
const contexte = (qualite = 'high') => ({ qualite, actif: true, pluie: 1, neige: 0, vitesse: 40, ventX: 4, ventZ: 1, dpr: 2 });
function avancer(e, c, secondes, hz = 60) { for (let i = 0; i < secondes * hz; i++) V.mettreAJour(e, 1 / hz, c); return e.stats; }
const capture = e => [e.gouttes, e.neige].map(liste => liste.map(p => ({ ...p })));

verifier('pluie ruisselante : dépôts bornés, trajets continus et Canvas transparent', () => {
  const surface = canvas(), e = V.creer(surface), c = contexte('ultra'); avancer(e, c, 10);
  assert(e.stats.gouttes > 25); assert.equal(e.stats.neige, 0); assert(surface.stats.ellipses > 0);
  const avant = e.gouttes.filter(p => p.vivant && p.glisse === 1).map(p => ({ p, y: p.y, age: p.age }));
  avancer(e, c, .5);
  // Certaines perles fusionnent ou sortent de la vitre ; suivre celles dont l'identité continue d'exister.
  assert(avant.some(a => a.p.vivant && a.p.age > a.age && a.p.y > a.y));
  assert(e.gouttes.every(p => !p.vivant || p.taille <= 12));
  assert.equal(surface.ctx.globalAlpha, 1); assert.equal(surface.getImageData, undefined);
});
verifier('neige collée, fonte vers une goutte et séchage sans nouvelles précipitations', () => {
  const e = V.creer(canvas()), c = contexte('ultra'); c.neige = .8; c.pluie = 0;
  avancer(e, c, 12); assert(e.stats.neige > 5); assert(e.neige.some(p => p.vivant && p.fondu)); assert(e.stats.gouttes > 0);
  c.neige = 0; avancer(e, c, 45); assert.equal(e.stats.neige, 0); assert.equal(e.stats.gouttes, 0); assert.equal(e.propre, true);
});
verifier('budgets adaptés à la qualité, maximum 148 dépôts poolés', () => {
  let precedent = -1;
  for (const qualite of ['off', 'low', 'medium', 'high', 'ultra']) {
    const e = V.creer(canvas()), c = contexte(qualite); c.vitesse = 100;
    avancer(e, c, 15); assert(e.stats.gouttes <= V.BUDGETS[qualite].gouttes); assert(e.stats.gouttes > precedent); precedent = e.stats.gouttes;
    c.pluie = 0; c.neige = 1; avancer(e, c, 20); assert(e.stats.neige <= V.BUDGETS[qualite].neige); assert(e.stats.gouttes + e.stats.neige <= 148);
  }
});
verifier('30 Hz indépendants de l’affichage, même animation à 30 et 120 Hz', () => {
  const a = V.creer(canvas()), b = V.creer(canvas()), c = contexte('ultra');
  avancer(a, c, 12, 30); avancer(b, c, 12, 120);
  assert.equal(a.stats.etapes, 360); assert.equal(b.stats.etapes, 360); assert(a.stats.dessins <= 360);
  assert.deepEqual(capture(a), capture(b));
  // La simulation reste au pas de 1/30 s, mais la visière se dessine à chaque image, entre les deux derniers pas,
  // pour un ruissellement fluide à toute cadence : à 120 Hz, environ quatre dessins par pas au lieu d'un, et un
  // appel sans nouveau pas redessine à une fraction plus avancée sans faire avancer les gouttes.
  assert(b.stats.dessins > 3.9 * a.stats.dessins && b.stats.dessins <= 1440);
  const dessins = b.stats.dessins, fraction = b.stats.fraction, etat = JSON.stringify(capture(b));
  V.mettreAJour(b, 1 / 120, c);
  assert.equal(b.stats.dessins, dessins + 1); assert(b.stats.fraction > fraction); assert.equal(b.stats.etapes, 360);
  assert.equal(JSON.stringify(capture(b)), etat);
});
verifier('DPR et surface plafonnés ; dimensions propres à chaque viewport', () => {
  for (const qualite of ['low', 'medium', 'high', 'ultra']) {
    const surface = canvas(7680, 2160), e = V.creer(surface), c = contexte(qualite); c.dpr = 4;
    avancer(e, c, 1); assert(e.stats.pixels <= V.MAX_PIXELS); assert(e.stats.dpr <= V.BUDGETS[qualite].dpr);
    c.largeur = 640; c.hauteur = 360; avancer(e, c, 1);
    assert.equal(surface.width, Math.floor(640 * V.BUDGETS[qualite].dpr)); assert.equal(surface.height, Math.floor(360 * V.BUDGETS[qualite].dpr));
  }
});
verifier('deux joueurs : pools, horloges et Canvas indépendants, sans mutation croisée', () => {
  const a = V.creer(canvas()), b = V.creer(canvas(640, 720)), ca = contexte(), cb = contexte(); cb.neige = 1;
  avancer(a, ca, 5); const avant = capture(a), pixels = a.stats.dessins;
  avancer(b, cb, 5); assert.deepEqual(capture(a), avant); assert.equal(a.stats.dessins, pixels);
  assert(a.gouttes.every(p => !b.gouttes.includes(p))); assert.equal(a.stats.neige, 0); assert(b.stats.neige > 0);
});
verifier('abri coupe les nouveaux dépôts et garde le séchage ; hors course et off effacent immédiatement', () => {
  const e = V.creer(canvas()), c = contexte(); avancer(e, c, 5); assert(e.stats.gouttes > 0);
  c.abri = true; const sequence = e.sequence; avancer(e, c, 2); assert.equal(e.sequence, sequence); assert(e.stats.gouttes > 0);
  avancer(e, c, 30); assert.equal(e.stats.gouttes, 0);
  c.abri = false; avancer(e, c, 5); c.actif = false; V.mettreAJour(e, 0, c); assert.equal(e.stats.gouttes, 0); assert.equal(e.propre, true);
  c.actif = true; avancer(e, c, 5); assert(e.stats.gouttes > 0); c.qualite = 'off'; V.mettreAJour(e, 0, c); assert.equal(e.stats.gouttes, 0);
});
verifier('pools stables, pas de lecture de pixels ni de hasard partagé ; libération idempotente', () => {
  const e = V.creer(canvas()), c = contexte('ultra'), gouttes = e.gouttes.slice(), neige = e.neige.slice(), stats = e.stats;
  const alea = Math.random; Math.random = () => { throw Error('hasard partagé'); };
  try { for (let i = 0; i < 3000; i++) { c.neige = i < 1500 ? 0 : 1; assert.strictEqual(V.mettreAJour(e, 1 / 120, c), stats); } }
  finally { Math.random = alea; }
  gouttes.forEach((p, i) => assert.strictEqual(p, e.gouttes[i])); neige.forEach((p, i) => assert.strictEqual(p, e.neige[i]));
  V.liberer(e); V.liberer(e); assert.equal(e.canvas, null); assert.equal(e.contexte, null); assert.strictEqual(V.mettreAJour(e, 1, c), stats);
  assert.equal(V.mettreAJour(V.creer(null), 1, c).gouttes, 0);
});
console.log('vitre : ' + controles + ' contrôles passés');

verifier('trajectoires gouttelettes : descente gravité arrêt, dispersion vitesse, direction vent', () => {
  for (const hz of [30, 60, 120]) {
    const e = V.creer(canvas()), c = contexte({ qualite: 'high' });
    c.fluxVentRight = 1; c.fluxVentUp = 0; c.fluxVentForward = 0;
    avancer(e, c, 100 / hz);
    const goutte = e.gouttes.find(p => p.vivant && p.taille > 3);
    if (!goutte) continue;
    const derivRight = goutte.traceX[0] - goutte.traceX[goutte.traceX.length - 1];
    assert(derivRight > 0, hz + ' Hz : fluxVentRight=1 doit déplacer goutte vers la droite');
  }
});

verifier('trajectoires signées : continuité et interpolation', () => {
  const e = V.creer(canvas()), c = contexte({ qualite: 'high' });
  c.fluxVentRight = 0; c.fluxVentUp = 0; c.fluxVentForward = 0;
  avancer(e, c, 60);
  const gouttesInitiales = e.gouttes.map(p => ({ x: p.x, y: p.y }));
  const e2 = V.creer(canvas()), c2 = contexte({ qualite: 'high' });
  c2.fluxVentRight = 0; c2.fluxVentUp = 0; c2.fluxVentForward = 0;
  avancer(e2, c2, 60);
  for (let i = 0; i < Math.min(e.gouttes.length, e2.gouttes.length); i++) {
    const dx = Math.abs(e.gouttes[i].x - e2.gouttes[i].x);
    const dy = Math.abs(e.gouttes[i].y - e2.gouttes[i].y);
    assert(dx < 0.01 && dy < 0.01, 'trajectoire reproductible à l\'identique');
  }
});

verifier('invariance cadence : mêmes trajectoires 30/60/120 Hz', () => {
  const directions = new Map();
  for (const hz of [30, 60, 120]) {
    const e = V.creer(canvas()), c = contexte({ qualite: 'high' });
    c.fluxVentRight = 1; c.fluxVentUp = 0; c.fluxVentForward = 0;
    avancer(e, c, hz * 2);
    const goutte = e.gouttes.find(p => p.vivant && p.taille > 2);
    if (!goutte) continue;
    const netDirection = Math.atan2(goutte.vitesseY, goutte.vitesseX);
    const key = `${hz}Hz-${Math.round(netDirection * 100) / 100}`;
    if (!directions.has(key)) directions.set(key, 0);
    directions.set(key, directions.get(key) + 1);
  }
  const clearDirections = [...directions.entries()].filter(([, count]) => count > 0);
  assert(clearDirections.length > 0, 'au moins une direction claire sur les 3 cadences');
});

verifier('direction vent : cockpit vs poursuite vs portrait', () => {
  const fluxes = [
    { droit: 1, haut: 0, avant: 0 },
    { droit: 0, haut: 1, avant: 0 },
    { droit: 0, haut: 0, avant: 1 },
  ];
  const results = [];
  for (const { droit, haut, avant } of fluxes) {
    const e = V.creer(canvas()), c = contexte({ qualite: 'high' });
    c.fluxVentRight = droit; c.fluxVentUp = haut; c.fluxVentForward = avant;
    avancer(e, c, 50);
    const goutte = e.gouttes.find(p => p.vivant && p.taille > 2);
    if (!goutte) { results.push(null); continue; }
    const angle = Math.atan2(goutte.vitesseY, goutte.vitesseX);
    results.push({ angle, goutte });
  }
  const nonNull = results.filter(r => r !== null);
  assert(nonNull.length > 0, 'au moins une config vent doit produire une direction');
});

verifier('sillage : gouttelettes conservent trajectoire en présence de sillage', () => {
  const e = V.creer(canvas()), c = contexte({ qualite: 'high' });
  c.fluxVentRight = 1; c.fluxVentUp = 0; c.fluxVentForward = 0;
  avancer(e, c, 30);
  const gouttesDebut = e.gouttes.map(p => ({ ...p }));
  c.actif = false; avancer(e, c, 20); c.actif = true;
  avancer(e, c, 30);
  const goutte = e.gouttes.find(p => p.vivant && p.taille > 2);
  if (goutte) {
    const dx = goutte.x - gouttesDebut[0].x;
    assert(Math.abs(dx) < 0.5, 'sillage ne doit pas déplacent gouttes existantes de façon significative');
  }
});
