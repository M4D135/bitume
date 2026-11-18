// Exécute le module de production sur une frontière DOM contrôlée, sans navigateur ni dépendance.
// Ces contrôles qualifient les événements et le focus ; ils ne remplacent pas une inspection du CSS rendu.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/navigation-menu.js');
const N = globalThis.BITUME.navigationMenu;
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok ' + nom); }

class Evenement {
  constructor(type, options = {}) { Object.assign(this, { type, bubbles: false, defaultPrevented: false }, options); }
  preventDefault() { this.defaultPrevented = true; }
}
class Element {
  constructor(doc, tag, attributs = {}) {
    this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.parentElement = null; this.children = [];
    this.attrs = {}; this.dataset = {}; this.listeners = new Map(); this.events = []; this.focuses = []; this.scrolls = [];
    this.disabled = this.checked = this.readOnly = false; this.form = null; this.style = {}; this._value = ''; this._selection = -1;
    this.min = this.max = this.step = this.name = ''; this.type = tag === 'input' ? 'text' : '';
    for (const [k, v] of Object.entries(attributs)) this.setAttribute(k, v);
  }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(v) { if (v) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
  get tabIndex() { return this.hasAttribute('tabindex') ? +this.attrs.tabindex : 0; }
  set tabIndex(v) { this.setAttribute('tabindex', v); }
  get options() { return this.querySelectorAll('option'); }
  get selectedIndex() { return this._selection; }
  set selectedIndex(v) { this._selection = v; }
  get value() { return this.tagName === 'SELECT' ? this.options[this._selection]?.value || '' : this._value; }
  set value(v) { this._value = String(v); }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase())] = String(v);
    if (['type', 'name', 'min', 'max', 'step', 'value'].includes(k)) this[k] = String(v);
    if (k === 'disabled') this.disabled = true;
    if (k === 'checked') this.checked = true;
  }
  getAttribute(k) { return Object.hasOwn(this.attrs, k) ? this.attrs[k] : null; }
  hasAttribute(k) { return Object.hasOwn(this.attrs, k); }
  removeAttribute(k) { delete this.attrs[k]; }
  append(...elements) { for (const e of elements) { e.parentElement = this; this.children.push(e); } return this; }
  contains(el) { return el === this || this.children.some(c => c.contains(el)); }
  matches(selecteur) {
    return selecteur.split(',').some(s => {
      s = s.trim();
      if (s === ':disabled') return this.disabled || !!this.closest('fieldset[disabled]');
      const tag = s.match(/^[a-zA-Z]+/);
      if (tag && this.tagName !== tag[0].toUpperCase()) return false;
      const attrs = Array.from(s.matchAll(/\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g));
      if (!tag && !attrs.length) throw new Error('Sélecteur non pris en charge par le banc : ' + s);
      return attrs.every(([, k, v]) => v === undefined ? this.hasAttribute(k) : this.getAttribute(k) === v);
    });
  }
  closest(s) { for (let e = this; e instanceof Element; e = e.parentElement) if (e.matches(s)) return e; return null; }
  querySelectorAll(s) {
    this.ownerDocument.requetes++;
    const a = []; const visiter = e => { for (const c of e.children) { if (c.matches(s)) a.push(c); visiter(c); } }; visiter(this); return a;
  }
  getClientRects() {
    this.ownerDocument.geometries++;
    for (let e = this; e; e = e.parentElement) if (e.hidden || e.style.display === 'none') return [];
    return [{}];
  }
  addEventListener(type, f) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(f); }
  dispatchEvent(e) {
    if (!e.target) e.target = this;
    this.events.push(e.type);
    for (const f of this.listeners.get(e.type) || []) f(e);
    if (e.bubbles && this.parentElement) this.parentElement.dispatchEvent(e);
    return !e.defaultPrevented;
  }
  focus(options) { this.ownerDocument.activeElement = this; this.focuses.push(options); }
  scrollIntoView(options) { this.scrolls.push(options); }
  click() {
    if (this.matches(':disabled')) return;
    let change = false;
    if (this.type === 'checkbox') { this.checked = !this.checked; change = true; }
    if (this.type === 'radio' && !this.checked) {
      for (const r of this.ownerDocument.body.querySelectorAll('input')) if (r.type === 'radio' && r.name === this.name && r.form === this.form) r.checked = false;
      this.checked = true; change = true;
    }
    this.dispatchEvent(new Evenement('click', { bubbles: true }));
    if (change) for (const type of ['input', 'change']) this.dispatchEvent(new Evenement(type, { bubbles: true }));
  }
}
function page() {
  const doc = { activeElement: null, hidden: false, requetes: 0, geometries: 0,
    defaultView: { Event: Evenement, getComputedStyle: el => {
      for (let e = el; e; e = e.parentElement) if (e.style.visibility) return { visibility: e.style.visibility };
      return { visibility: 'visible' };
    } } };
  const creer = (tag, attrs) => new Element(doc, tag, attrs);
  doc.body = creer('body'); const zone = creer('section'); doc.body.append(zone);
  return { doc, zone, creer };
}
function manette(index = 0) { return { index, id: 'pad-' + index, axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) }; }
function commandes(p, options = {}) {
  const pad = options.pad || manette(); let temps = 0, activations = 0, retours = 0;
  const lire = (fronts = [], delta = 100, extra = {}) => {
    temps += delta;
    return N.naviguer(p.zone, i => fronts.includes(i), { pad, temps, activer: () => activations++, retour: () => retours++, ...extra });
  };
  return { pad, lire, get temps() { return temps; }, get activations() { return activations; }, get retours() { return retours; } };
}
function radio(p, name, checked = false) {
  const label = p.creer('label'), el = p.creer('input', { type: 'radio', name }); el.checked = checked;
  label.append(el, p.creer('span')); p.zone.append(label); return el;
}
function tabs(p) {
  const nav = p.creer('nav', { 'data-menu-tabs': '', role: 'tablist' }), ts = [], panels = [];
  p.zone.append(nav);
  for (const id of ['image', 'pilotage', 'audio']) {
    const t = p.creer('button', { id: 'tab-' + id, role: 'tab', 'data-menu-tab': id, 'aria-controls': id, 'aria-selected': String(id === 'image') });
    const panel = p.creer('div', { id, 'data-menu-panel': '', role: 'tabpanel' }); panel.append(p.creer('button', { id: 'action-' + id }));
    nav.append(t); p.zone.append(panel); ts.push(t); panels.push(panel);
  }
  return { nav, ts, panels };
}

verifier('onglets : initialisation idempotente, clic délégué, panneaux et ARIA cohérents', () => {
  const p = page(), t = tabs(p); N.initialiser(p.zone); N.initialiser(p.zone);
  assert.deepEqual(t.panels.map(x => x.hidden), [false, true, true]);
  assert.deepEqual(t.ts.map(x => x.tabIndex), [0, -1, -1]);
  assert.equal(p.zone.listeners.get('click').length, 1);
  const enfant = p.creer('span'); t.ts[2].append(enfant); enfant.click();
  assert.deepEqual(t.panels.map(x => x.hidden), [true, true, false]);
  assert.equal(t.panels[2].getAttribute('aria-labelledby'), 'tab-audio');
  assert.equal(N.ouvrirOnglet(p.zone, 'absent', true), false);
  assert.equal(t.panels[2].hidden, false, 'un identifiant inconnu ne masque pas le panneau courant');
  t.ts[1].disabled = true; assert.equal(N.ouvrirOnglet(p.zone, 'pilotage'), false);
});

verifier('onglets : clavier Home/End/flèches, Entrée native et retour à la souris', () => {
  const p = page(), t = tabs(p); N.initialiser(p.zone); t.ts[0].focus();
  const key = k => { const e = new Evenement('keydown', { key: k, bubbles: true }); p.doc.activeElement.dispatchEvent(e); return e; };
  assert.equal(key('ArrowRight').defaultPrevented, true); assert.equal(p.doc.activeElement, t.ts[1]);
  key('End'); assert.equal(p.doc.activeElement, t.ts[2]); key('Home'); assert.equal(p.doc.activeElement, t.ts[0]);
  assert.equal(key('Enter').defaultPrevented, false, 'pas de clic dupliqué au keydown');
  p.zone.dataset.manette = 'true'; t.ts[0].dispatchEvent(new Evenement('pointerdown', { bubbles: true }));
  assert.equal(p.zone.dataset.manette, undefined);
  p.zone.dataset.manette = 'true'; key('Tab'); assert.equal(p.zone.dataset.manette, undefined);
});

verifier('haut/bas : un arrêt par groupe, sélection mémorisée et contrôles invisibles exclus', () => {
  const p = page(), a = radio(p, 'qualite'), b = radio(p, 'qualite', true), c = radio(p, 'vue', true);
  const cache = p.creer('div', { hidden: '' }).append(p.creer('button')), inerte = p.creer('div', { inert: '' }).append(p.creer('button'));
  const fs = p.creer('fieldset', { disabled: '' }).append(p.creer('input', { type: 'checkbox' }));
  const bouton = p.creer('button'); p.zone.append(cache, inerte, fs, bouton);
  a.style.opacity = 0; b.style.opacity = 0;
  const j = commandes(p); j.lire([13]); assert.equal(p.doc.activeElement, b);
  j.lire([13]); assert.equal(p.doc.activeElement, c);
  j.lire([13]); assert.equal(p.doc.activeElement, bouton);
  j.lire([12]); assert.equal(p.doc.activeElement, c);
  j.lire([12]); assert.equal(p.doc.activeElement, b);
  assert.equal(p.zone.dataset.manette, 'true');
  assert.equal(b.focuses.at(-1).focusVisible, true);
  assert.equal(b.parentElement.scrolls.at(-1).block, 'nearest');
  assert.equal(b.parentElement.scrolls.at(-1).behavior, 'auto');
});

verifier('radios natifs et cartes : gauche/droite sélectionne une seule fois', () => {
  const p = page(), a = radio(p, 'saison', true), b = radio(p, 'saison'), c = radio(p, 'saison'); b.disabled = true;
  a.focus(); const j = commandes(p); j.lire([15]);
  assert.equal(p.doc.activeElement, c); assert.equal(c.checked, true); assert.equal(a.checked, false);
  assert.equal(c.events.filter(t => t === 'change').length, 1); assert.equal(c.events.filter(t => t === 'input').length, 1);
  j.lire([15]); assert.equal(p.doc.activeElement, a); assert.equal(a.checked, true);
  const cartes = p.creer('div', { role: 'radiogroup' }); const cs = [0, 1, 2].map(i => p.creer('button', { role: 'radio', 'aria-checked': String(i === 0) }));
  for (const c of cs) c.addEventListener('click', () => { for (const q of cs) q.setAttribute('aria-checked', String(q === c)); });
  cartes.append(...cs); p.zone.append(cartes); cs[0].focus();
  j.lire([15]); assert.equal(p.doc.activeElement, cs[1]); assert.equal(cs[1].getAttribute('aria-checked'), 'true');
  assert.equal(cs[1].events.filter(t => t === 'click').length, 1);
});

verifier('curseurs : pas décimal exact, bornes et événements natifs de réglage', () => {
  const p = page(), range = p.creer('input', { type: 'range', min: '0', max: '1', step: '.05', value: '.9' });
  p.zone.append(range); range.focus(); const j = commandes(p);
  j.lire([15]); assert.equal(range.value, '0.95'); j.lire([15]); assert.equal(range.value, '1'); j.lire([15]); assert.equal(range.value, '1');
  assert.deepEqual(range.events.filter(t => t !== 'click'), ['input', 'change', 'input', 'change']);
  for (let i = 0; i < 20; i++) j.lire([14]); assert.equal(range.value, '0');
  j.lire([14]); assert.equal(range.events.filter(t => t === 'change').length, 22);
  range.readOnly = true; j.lire([15]); assert.equal(range.value, '0');
});

verifier('sélections et cases : options interdites sautées, changement effectif seulement', () => {
  const p = page(), s = p.creer('select'), o0 = p.creer('option', { value: 'a' }), o1 = p.creer('option', { value: 'b', disabled: '' }), o2 = p.creer('option', { value: 'c' });
  const groupe = p.creer('optgroup', { disabled: '' }).append(p.creer('option', { value: 'interdit' }));
  s.append(o0, o1, groupe, o2); s.selectedIndex = 0; p.zone.append(s); s.focus(); const j = commandes(p);
  j.lire([15]); assert.equal(s.value, 'c'); j.lire([15]); assert.equal(s.value, 'c');
  assert.deepEqual(s.events, ['input', 'change']); j.lire([14]); assert.equal(s.value, 'a');
  const c = p.creer('input', { type: 'checkbox' }); p.zone.append(c); c.focus();
  j.lire([15]); j.lire([15]); assert.equal(c.checked, true); assert.equal(c.events.filter(x => x === 'change').length, 1);
  j.lire([14]); assert.equal(c.checked, false); j.lire([0]); assert.equal(c.checked, true);
});

verifier('A/B restent sur fronts, B prioritaire et utilisable dans un panneau vide', () => {
  const p = page(), c = p.creer('input', { type: 'checkbox' }); p.zone.append(c); c.focus(); const j = commandes(p);
  j.pad.buttons[0].pressed = true; j.lire([0]); j.lire([]); j.lire([], 500);
  assert.equal(c.checked, true); assert.equal(c.events.filter(x => x === 'click').length, 1);
  j.lire([0, 1]); assert.equal(c.checked, true); assert.equal(j.retours, 1);
  c.hidden = true; j.lire([1]); assert.equal(j.retours, 2);
  p.zone.hidden = true; assert.equal(j.lire([1]), false); assert.equal(j.retours, 2);
  p.zone.hidden = false; p.zone.style.display = 'none'; assert.equal(j.lire([0]), false);
});

verifier('croix maintenue : premier appui, délai 360 ms, répétition 95 ms, pas de rattrapage', () => {
  const p = page(), bs = [0, 1, 2, 3].map(() => p.creer('button')); p.zone.append(...bs); bs[0].focus(); const j = commandes(p);
  j.lire([]); j.pad.buttons[13].pressed = true; j.lire([13]); assert.equal(p.doc.activeElement, bs[1]);
  j.lire([], 359); assert.equal(p.doc.activeElement, bs[1]);
  j.lire([], 1); assert.equal(p.doc.activeElement, bs[2]);
  j.lire([], 94); assert.equal(p.doc.activeElement, bs[2]);
  j.lire([], 1); assert.equal(p.doc.activeElement, bs[3]);
  j.lire([], 700); assert.equal(p.doc.activeElement, bs[0], 'une seule étape malgré un retard de plusieurs répétitions');
  j.pad.buttons[13].pressed = false; j.lire([]); j.pad.buttons[13].pressed = true; j.lire([13]); assert.equal(p.doc.activeElement, bs[1]);
});

verifier('stick : zone morte, hystérésis, retour au neutre après connexion/course', () => {
  const p = page(), bs = [0, 1, 2].map(() => p.creer('button')); p.zone.append(...bs); bs[0].focus(); const j = commandes(p);
  j.pad.axes[1] = .8; j.lire(); assert.equal(p.doc.activeElement, bs[0], 'stick déjà tenu à l’entrée');
  j.pad.axes[1] = 0; j.lire(); j.pad.axes[1] = .54; j.lire(); assert.equal(p.doc.activeElement, bs[0]);
  j.pad.axes[1] = .6; j.lire(); assert.equal(p.doc.activeElement, bs[1]);
  j.pad.axes[1] = .4; j.lire([], 100); assert.equal(p.doc.activeElement, bs[1]);
  j.lire([], 260); assert.equal(p.doc.activeElement, bs[2]);
  N.initialiser(p.zone); j.lire([], 100); j.lire([], 400); assert.equal(p.doc.activeElement, bs[2]);
  j.pad.axes[1] = 0; j.lire(); j.pad.axes[1] = -.7; j.lire(); assert.equal(p.doc.activeElement, bs[1]);
});

verifier('LB/RB changent seulement les onglets, actions simultanées des deux manettes réunies', () => {
  const p = page(), t = tabs(p), j = commandes(p); N.initialiser(p.zone);
  j.lire([5]); assert.equal(p.doc.activeElement, t.ts[1]); assert.equal(t.panels[1].hidden, false);
  j.lire([4]); assert.equal(p.doc.activeElement, t.ts[0]);
  const c = p.creer('input', { type: 'checkbox' }); t.panels[0].append(c); c.focus(); j.lire([0]);
  const pad2 = manette(1); N.naviguer(p.zone, i => i === 0, { pad: pad2, temps: j.temps + 1 });
  assert.equal(c.checked, true); assert.equal(c.events.filter(x => x === 'click').length, 1);
  N.naviguer(p.zone, i => i === 0, { pad: pad2, temps: j.temps + 100 }); assert.equal(c.checked, false);
});

verifier('repos : aucun parcours des contrôles ni interrogation de géométrie par image', () => {
  const p = page(), b = p.creer('button'); p.zone.append(b); const j = commandes(p); j.lire();
  const avant = [p.doc.requetes, p.doc.geometries];
  for (let i = 0; i < 120; i++) assert.equal(j.lire([], 16), false);
  assert.deepEqual([p.doc.requetes, p.doc.geometries], avant);
  assert.equal(p.doc.activeElement, null); assert.equal(j.activations, 0);
  const capture = p.creer('button', { 'aria-disabled': 'true' }); p.zone.append(capture);
  p.doc.activeElement = capture; j.lire([0]); assert.equal(p.doc.activeElement, b); assert.equal(b.events.filter(x => x === 'click').length, 1);
});

console.log(controles + ' contrôles navigation menu validés');
