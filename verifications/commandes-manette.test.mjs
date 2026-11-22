// Affectations de manette : valeurs de conduite, deux joueurs, capture et retour au neutre.
import assert from 'node:assert/strict';
import '../src/commandes-manette.js';
const M = globalThis.BITUME.commandesManette;
const pad = (axes = [0, 0, 0, 0], mapping = 'standard') => ({ index: 0, id: 'pad-test', connected: true, mapping, axes: axes.slice(), buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })) });
const presser = (p, i, v = 1) => { p.buttons[i].value = v; p.buttons[i].pressed = v > .5; };
const armer = (c, p) => { assert.equal(M.avancerCapture(c, p), null); assert.equal(M.avancerCapture(c, p), null); assert.equal(c.pret, true); };
let reussis = 0;
function test(nom, verifier) { verifier(); reussis++; console.log('ok ' + nom); }

test('les commandes Xbox standard conservent pédales analogiques, volant et boutons', () => {
  const p = pad(), s = {}; presser(p, 7, .75); presser(p, 6, .25); p.axes[0] = -.5;
  for (const i of [0, 2, 3, 4, 5]) presser(p, i);
  assert.strictEqual(M.lire(p, null, s), s);
  assert.equal(s.gaz, .75); assert.equal(s.frein, .25); assert(s.volant < -.35 && s.volant > -.45);
  for (const a of ['derive', 'haut', 'bas', 'vue', 'troll']) assert.equal(s[a], 1, a);
  p.axes[0] = .04; assert.equal(M.lire(p, null, s).volant, 0);
  p.axes[0] = 1; assert.equal(M.lire(p, null, s).volant, 1);
});
test('X déclenche la dérive et A (Xbox) / B (Switch) déclenche les emotes', () => {
  const p1 = pad(); presser(p1, 2); assert.equal(M.lire(p1).derive, 1); assert.equal(M.lire(p1).troll, 0);
  const p2 = pad(); presser(p2, 0); assert.equal(M.lire(p2).troll, 1); assert.equal(M.lire(p2).derive, 0);
});
test('absence, déconnexion et valeurs invalides restent neutres et bornées', () => {
  const p = pad(), s = M.lire(p); presser(p, 7); p.axes[0] = 1; M.lire(p, null, s);
  M.lire(null, null, s); assert(Object.values(s).every(v => v === 0));
  p.connected = false; M.lire(p, null, s); assert(Object.values(s).every(v => v === 0));
  p.connected = true; p.axes[0] = NaN; p.buttons[7] = { value: Infinity, pressed: false }; p.buttons[6] = { value: 3, pressed: true };
  M.lire(p, null, s); assert.equal(s.gaz, 0); assert.equal(s.frein, 1); assert.equal(s.volant, 0);
});
test('les mappings des deux joueurs et les défauts ne partagent aucun objet modifiable', () => {
  const a = M.normaliser(), b = M.normaliser(); a.gaz[0].index = 0; a.gauche[0].sens = 1;
  assert.equal(b.gaz[0].index, 7); assert.equal(M.DEFAUT.gaz[0].index, 7); assert.equal(b.gauche[0].sens, -1);
});
test('un mapping corrompu garde les défauts, une liste vide désaffecte', () => {
  const m = M.normaliser({ gaz: [{ type: 'bouton', index: 999 }], frein: [], haut: [{ type: 'axe', index: 1, sens: 1, origine: 1 }] });
  assert.deepEqual(m.gaz, M.DEFAUT.gaz); assert.deepEqual(m.frein, []); assert.deepEqual(m.haut, M.DEFAUT.haut);
  const p = pad(); presser(p, 6); assert.equal(M.lire(p, m).frein, 0);
});
test('affecter une entrée la retire des autres actions du seul mapping ciblé', () => {
  const m1 = M.normaliser(), m2 = M.normaliser();
  const m = M.affecter(m1, 'gaz', { type: 'bouton', index: 0 });
  assert.deepEqual(m.derive, [{ type: 'bouton', index: 2 }]); assert.deepEqual(m.gaz, [{ type: 'bouton', index: 0 }]);
  assert.deepEqual(m1.gaz, M.DEFAUT.gaz); assert.deepEqual(m2.derive, M.DEFAUT.derive);
  const p = pad(); presser(p, 0); assert.equal(M.lire(p, m).gaz, 1); assert.equal(M.lire(p, m).derive, 0);
});
test('les deux sens d’un même axe restent affectables séparément', () => {
  const m = M.affecter(null, 'gaz', { type: 'axe', index: 0, sens: 1, origine: 0 });
  assert.deepEqual(m.droite, []); assert.deepEqual(m.gauche, M.DEFAUT.gauche);
  const p = pad(); p.axes[0] = -.7; const s = M.lire(p, m); assert.equal(s.gaz, 0); assert(s.volant < 0);
});
test('B, Menu et Xbox restent réservés au navigateur et aux menus', () => {
  for (const i of [1, 9, 16]) assert.deepEqual(M.affecter(null, 'gaz', { type: 'bouton', index: i }).gaz, M.DEFAUT.gaz);
});
test('gâchette non standard en axe de -1 à 1 : repos neutre et amplitude entière', () => {
  const p = pad([0, 0, -1], ''), m = M.affecter(null, 'gaz', { type: 'axe', index: 2, sens: 1, origine: -1 });
  assert.equal(M.lire(p, m).gaz, 0); p.axes[2] = 0; assert(Math.abs(M.lire(p, m).gaz - .468085106383) < 1e-8);
  p.axes[2] = 1; assert.equal(M.lire(p, m).gaz, 1);
});
test('capture attend le relâchement du bouton A qui ouvre la configuration', () => {
  const p = pad(); presser(p, 0); const c = M.creerCapture(p);
  for (let i = 0; i < 4; i++) assert.equal(M.avancerCapture(c, p), null);
  assert.equal(c.pret, false); presser(p, 0, 0); armer(c, p); presser(p, 7, .8);
  assert.deepEqual(M.avancerCapture(c, p), { type: 'bouton', index: 7 });
});
test('capture attend le neutre du stick standard qui naviguait dans le menu', () => {
  const p = pad([0, 1, 0, 0]), c = M.creerCapture(p); M.avancerCapture(c, p); assert.equal(c.pret, false);
  p.axes[1] = 0; armer(c, p); p.axes[0] = -.8;
  assert.deepEqual(M.avancerCapture(c, p), { type: 'axe', index: 0, sens: -1, origine: 0 });
});
test('une gâchette déclarée comme axe est configurable sans clavier', () => {
  const p = pad([0, 0, -1], ''), c = M.creerCapture(p); armer(c, p); p.axes[2] = .4;
  const l = M.avancerCapture(c, p); assert.deepEqual(l, { type: 'axe', index: 2, sens: 1, origine: -1 });
  const m = M.affecter(null, 'gaz', l); p.axes[2] = -1; assert.equal(M.lire(p, m).gaz, 0);
  p.axes[2] = 1; assert.equal(M.lire(p, m).gaz, 1);
});
test('B ou Menu tenu à l’ouverture doit être relâché avant un nouvel appui d’annulation', () => {
  for (const i of [1, 9]) { const p = pad(); presser(p, i); const c = M.creerCapture(p); M.avancerCapture(c, p); assert.equal(c.annule, false); presser(p, i, 0); armer(c, p); presser(p, i); assert.equal(M.avancerCapture(c, p), null); assert.equal(c.annule, true); }
});
test('B et Menu annulent même si une dérive de stick empêche l’armement', () => {
  for (const i of [1, 9]) {
    const p = pad([.4, 0, 0, 0]), c = M.creerCapture(p);
    for (let n = 0; n < 4; n++) M.avancerCapture(c, p);
    assert.equal(c.pret, false); presser(p, i);
    assert.equal(M.avancerCapture(c, p), null); assert.equal(c.annule, true);
    assert.equal(c.liaison, null); assert.equal(c.raison, 'annulee');
  }
});
test('annulation tenue à l’ouverture ou reconnexion : sortie possible au nouvel appui sans neutre du stick', () => {
  for (const i of [1, 9]) for (const reconnexion of [false, true]) {
    const p = pad([.4, 0, 0, 0]); presser(p, i);
    const c = M.creerCapture(reconnexion ? null : p);
    if (reconnexion) M.avancerCapture(c, null);
    for (let n = 0; n < 3; n++) M.avancerCapture(c, p);
    assert.equal(c.annule, false); assert.equal(c.pret, false);
    presser(p, i, 0); M.avancerCapture(c, p); presser(p, i);
    M.avancerCapture(c, p); assert.equal(c.annule, true); assert.equal(c.liaison, null);
  }
});
test('annuler depuis le bouton du menu interdit toute affectation ultérieure', () => {
  const p = pad(), c = M.creerCapture(p); armer(c, p); c.annule = true; presser(p, 7);
  assert.equal(M.avancerCapture(c, p), null); assert.equal(c.liaison, null);
});
test('déconnexion et remplacement de contrôleur exigent un nouveau neutre', () => {
  const p = pad(), c = M.creerCapture(p); armer(c, p); M.avancerCapture(c, null); assert.equal(c.pret, false);
  const q = pad(); q.id = 'autre'; presser(q, 7); assert.equal(M.avancerCapture(c, q), null); assert.equal(c.pret, false);
  presser(q, 7, 0); armer(c, q); presser(q, 5); assert.deepEqual(M.avancerCapture(c, q), { type: 'bouton', index: 5 });
});
test('lecture réutilisable pendant une course et aucune mutation des affectations', () => {
  const p = pad(), m = M.normaliser(), avant = JSON.stringify(m), s = {};
  for (let i = 0; i < 10000; i++) { p.axes[0] = Math.sin(i); presser(p, 7, (i % 100) / 100); assert.strictEqual(M.lire(p, m, s), s); }
  assert.equal(JSON.stringify(m), avant); assert.equal(Object.keys(s).length, 10);
});
console.log(`${reussis}/${reussis} contrôles affectations manette tenus`);
