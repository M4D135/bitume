// Le vrai filtre Xbox arbitre uniquement les clics natifs qui doublent une
// entrée manette ; les clics programmatiques du menu restent indispensables.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const a = source.indexOf('  function filtrerPointeurConsole('); assert(a >= 0);
let b = source.indexOf('{', a), profondeur = 1;
for (b++; profondeur && b < source.length; b++) { if (source[b] === '{') profondeur++; else if (source[b] === '}') profondeur--; }
assert.equal(profondeur, 0);
const factory = new Function('navigator', 'consoleXbox', 'dernierSignalManette', 'performance', source.slice(a, b) + '; return filtrerPointeurConsole;');
const manette = () => ({ connected: true, buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })), axes: [0, 0, 0, 0] });
function contexte({ xbox = true, signal = -Infinity } = {}) {
  const p = manette(), horloge = { t: 1000 }, nav = { pads: [p], getGamepads() { return this.pads; } };
  const filtrer = factory(nav, xbox, signal, { now: () => horloge.t });
  return { p, nav, horloge, filtrer };
}
function evenement(champs = {}) {
  return { type: 'pointerdown', pointerType: 'mouse', isTrusted: true, detail: 1, annule: false, arrete: false,
    preventDefault() { this.annule = true; }, stopImmediatePropagation() { this.arrete = true; }, ...champs };
}
function controle(f, bloque, champs) { const e = evenement(champs); assert.doesNotThrow(() => f.filtrer(e)); assert.equal(e.annule, bloque); assert.equal(e.arrete, bloque); }
let reussis = 0;
function verifier(nom, f) { f(); reussis++; console.log('ok ' + nom); }

verifier('ordinateur : souris normale conservée malgré une manette active', () => {
  const f = contexte({ xbox: false, signal: 995 }); f.p.buttons[0] = { value: 1, pressed: true }; controle(f, false);
});
for (const type of ['pointerdown', 'pointerup', 'click']) verifier('Xbox : ' + type + ' natif doublant une entrée récente est consommé', () => {
  controle(contexte({ signal: 900 }), true, { type });
});
verifier('clic programmatique du menu à la manette jamais bloqué', () => {
  const f = contexte({ signal: 995 }); f.p.buttons[0] = { value: 1, pressed: true };
  controle(f, false, { type: 'click', pointerType: '', isTrusted: false, detail: 0 });
  controle(f, false, { type: 'click', pointerType: 'mouse', isTrusted: false, detail: 1 });
});
verifier('clavier natif, toucher et stylet restent disponibles', () => {
  const f = contexte({ signal: 995 });
  controle(f, false, { type: 'click', pointerType: '', detail: 0 });
  controle(f, false, { pointerType: 'touch' }); controle(f, false, { pointerType: 'pen' });
});
verifier('bouton Gamepad déjà actif avant le prochain poll bloque le doublon natif', () => {
  const f = contexte(); f.p.buttons[0] = { value: 1, pressed: true }; controle(f, true);
  f.p.buttons[0] = { value: .3, pressed: false }; controle(f, true);
});
verifier('stick gauche actif avant le poll protège le focus, bruit de repos ignoré', () => {
  const f = contexte(); f.p.axes[0] = .7; controle(f, true); f.p.axes[0] = .1; f.p.axes[1] = -.7; controle(f, true);
  f.p.axes[1] = .1; controle(f, false);
});
verifier('le pointeur retrouve les menus au neutre après la courte fenêtre', () => {
  const f = contexte({ signal: 900 }); controle(f, true); f.horloge.t = 1351; controle(f, false);
  f.p.buttons[0] = { value: 1, pressed: true }; controle(f, true);
  f.p.buttons[0] = { value: 0, pressed: false }; controle(f, false);
});
verifier('absence, déconnexion et API refusée laissent une issue au pointeur', () => {
  const f = contexte(); f.p.connected = false; f.p.buttons[0] = { value: 1, pressed: true }; controle(f, false);
  f.nav.pads = []; controle(f, false); f.nav.getGamepads = undefined; controle(f, false);
  f.nav.getGamepads = () => { throw new Error('API refusée'); }; controle(f, false);
});
console.log(`${reussis}/${reussis} contrôles pointeur Xbox tenus`);
