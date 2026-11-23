// Lot D : minimap zoomée et défilante. Le test exerce la vraie fonction de jeu.js avec un
// canvas 2D simulé ; il ne qualifie pas la mise en page réelle, seulement le suivi s, le
// défilement, les marqueurs utiles et l'indépendance des affichages.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/circuit.js';
import '../src/virages.js';
import '../src/conduite.js';
import '../src/degats.js';
import '../src/contacts.js';
import '../src/course.js';

const B = globalThis.BITUME;
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
function extrait(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a);
  assert.ok(a >= 0 && b > a, 'bloc de production disponible : ' + debut);
  return source.slice(a, b);
}
const code = extrait('const couleursCss = new WeakMap();', 'const aDeux =');
const charger = new Function('B', 'clamp', `"use strict"; ${code}; return { dessinerCarteZoom };`);
const { dessinerCarteZoom } = charger(B, (v, a, b) => Math.max(a, Math.min(b, v)));

function contexte() {
  const ctx = {
    appels: [], chemins: [], courant: null, style: {}, lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    clearRect(...a) { this.appels.push(['clearRect', ...a]); },
    beginPath() { this.courant = []; this.chemins.push(this.courant); },
    moveTo(x, y) { this.courant.push(['moveTo', x, y]); },
    lineTo(x, y) { this.courant.push(['lineTo', x, y]); },
    arc(x, y, r) { this.appels.push(['arc', x, y, r]); },
    closePath() {},
    fill() { this.appels.push(['fill']); },
    fillText(t, x, y) { this.appels.push(['fillText', t, x, y]); },
    stroke() { this.appels.push(['stroke']); },
  };
  return { width: 220, height: 220, ctx, getContext: () => ctx };
}
function hud() { const carte = contexte(); return { h: { carte }, carte }; }
function course(humains = 1) {
  const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const co = B.course.creer(c, {
    graine: 2048, rivaux: 1,
    humains: { noms: Array.from({ length: humains }, (_, k) => 'J' + (k + 1)), locaux: Array.from({ length: humains }, (_, k) => k), hote: true, enLigne: false }
  });
  return { c, co, j: co.voitures[0], rival: co.voitures[humains] };
}
function placer(v, s, progression = s) {
  v.etat.s = s; v.etat.v = 40; v.progression = progression;
}

let controles = 0;
const verifier = async (nom, fn) => { await fn(); controles++; };

await verifier('le joueur reste centré et le tracé défile avec sa progression', () => {
  const { co, j } = course();
  placer(j, 100, 100);
  const x = hud();
  dessinerCarteZoom(x, { retardImage: 0 }, co, j, false);
  assert.equal(x.planProg, 100);
  assert.ok(x.carte.ctx.appels.some(a => a[0] === 'clearRect'), 'la toile est effacée');
  const trace = x.carte.ctx.chemins[0];
  assert.ok(trace && trace.length > 12, 'le tracé local est dessiné avec assez de points');
  const fleche = x.carte.ctx.chemins.at(-1);
  assert.deepEqual(fleche[0], ['moveTo', 110, 129.4], 'la flèche du joueur est ancrée dans sa zone stable');

  placer(j, 1000, 1000);
  for (let i = 0; i < 20; i++) dessinerCarteZoom(x, { retardImage: 0 }, co, j, false);
  assert.ok(Math.abs(x.planProg - 1000) < 1, 'le centre suit la progression continue');
});

await verifier('un rival proche est attaché à son abscisse curviligne, pas au point le plus proche', () => {
  const { co, j, rival } = course();
  placer(j, 1000, 1000);
  placer(rival, 1020, 1020);
  const x = hud();
  dessinerCarteZoom(x, { retardImage: 0 }, co, j, false);
  const arcs = x.carte.ctx.appels.filter(a => a[0] === 'arc');
  assert.ok(arcs.some(a => Math.abs(a[3] - 3.2) < 1e-6), 'le pastille du rival a la taille attendue');
});

await verifier('stands, départ et virages difficiles apparaissent comme repères utiles', () => {
  const { c, co, j } = course();
  assert.ok(c.stands, 'le circuit de test possède des stands');
  placer(j, Math.max(0, c.stands.sBox - 80), Math.max(0, c.stands.sBox - 80));
  const x = hud();
  dessinerCarteZoom(x, { retardImage: 0 }, co, j, false);
  assert.ok(x.carte.ctx.appels.some(a => a[0] === 'fillText' && a[1] === 'P'), 'le stand est marqué P');
  assert.ok(x.carte.ctx.appels.some(a => a[0] === 'arc'), 'les repères sont dessinés');
});

await verifier('chaque affichage garde son propre état de défilement', () => {
  const { co, j } = course(2);
  const a = hud(), b = hud();
  placer(j, 500, 500);
  dessinerCarteZoom(a, { retardImage: 0 }, co, j, false);
  placer(j, 1500, 1500);
  dessinerCarteZoom(b, { retardImage: 0 }, co, j, false);
  assert.equal(a.planProg, 500);
  assert.equal(b.planProg, 1500);
});

await verifier('le passage par la ligne d\'un circuit fermé ne casse pas le suivi', () => {
  const { c, co, j } = course();
  placer(j, c.longueur - 10, c.longueur - 10);
  const x = hud();
  dessinerCarteZoom(x, { retardImage: 0 }, co, j, false);
  placer(j, 10, c.longueur + 10);
  for (let i = 0; i < 20; i++) dessinerCarteZoom(x, { retardImage: 0 }, co, j, false);
  assert.ok(Math.abs(x.planProg - (c.longueur + 10)) < 1, 'la progression continue suit le tour bouclé');
});

console.log(`${controles} contrôles minimap zoomée réussis (canvas simulé, mise en page non qualifiée).`);
