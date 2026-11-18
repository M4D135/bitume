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

verifier('pluie ruisselante : petits dépôts, trajets lents et Canvas transparent', () => {
  const surface = canvas(), e = V.creer(surface), c = contexte('ultra'); avancer(e, c, 10);
  assert(e.stats.gouttes > 25); assert.equal(e.stats.neige, 0); assert(surface.stats.ellipses > 0);
  const p = e.gouttes.find(p => p.vivant && p.glisse === 1), avant = p.y;
  avancer(e, c, .5); assert(p.y > avant); assert(p.taille < 4);
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
  assert.equal(a.stats.dessins, b.stats.dessins); assert.deepEqual(capture(a), capture(b));
  const dessins = b.stats.dessins; V.mettreAJour(b, 1 / 120, c); assert.equal(b.stats.dessins, dessins);
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
