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
  stopPropagation() { this.propagationArretee = true; }
}
class Element {
  constructor(doc, tag, attributs = {}) {
    this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.parentElement = null; this.children = [];
    this.attrs = {}; this.dataset = {}; this.listeners = new Map(); this.events = []; this.focuses = []; this.scrolls = [];
    this.disabled = this.checked = this.readOnly = this.open = false; this.form = null; this.style = {}; this._value = ''; this._selection = -1;
    this.min = this.max = this.step = this.name = ''; this.type = tag === 'input' ? 'text' : '';
    for (const [k, v] of Object.entries(attributs)) this.setAttribute(k, v);
  }
  get isConnected() { for (let e = this; e; e = e.parentElement) if (e === this.ownerDocument.body) return true; return false; }
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
  replaceChildren(...elements) { for (const e of this.children) e.parentElement = null; this.children = []; this.append(...elements); }
  contains(el) { return el === this || this.children.some(c => c.contains(el)); }
  matches(selecteur) {
    return selecteur.split(',').some(s => {
      s = s.trim();
      if (s === ':disabled') return this.disabled || !!this.closest('fieldset[disabled]');
      const tag = s.match(/^[a-zA-Z]+/);
      if (tag && this.tagName !== tag[0].toUpperCase()) return false;
      const attrs = Array.from(s.matchAll(/\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g));
      const classes = Array.from(s.matchAll(/\.([\w-]+)/g), m => m[1]);
      if (!tag && !attrs.length && !classes.length) throw new Error('Sélecteur non pris en charge par le banc : ' + s);
      const possedees = String(this.className || this.getAttribute('class') || '').split(/\s+/).filter(Boolean);
      return attrs.every(([, k, v]) => v === undefined ? this.hasAttribute(k) : this.getAttribute(k) === v) &&
        classes.every(c => possedees.includes(c));
    });
  }
  closest(s) { for (let e = this; e instanceof Element; e = e.parentElement) if (e.matches(s)) return e; return null; }
  querySelectorAll(s) {
    this.ownerDocument.requetes++;
    const a = []; const visiter = e => { for (const c of e.children) { if (c.matches(s)) a.push(c); visiter(c); } }; visiter(this); return a;
  }
  getClientRects() {
    this.ownerDocument.geometries++;
    for (let e = this; e; e = e.parentElement) if (e.hidden || e.style.display === 'none' || e.tagName === 'DIALOG' && !e.open) return [];
    return [{}];
  }
  addEventListener(type, f) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(f); }
  dispatchEvent(e) {
    if (!e.target) e.target = this;
    this.events.push(e.type);
    for (const f of this.listeners.get(e.type) || []) f(e);
    if (e.bubbles && !e.propagationArretee && this.parentElement) this.parentElement.dispatchEvent(e);
    return !e.defaultPrevented;
  }
  focus(options) { this.ownerDocument.activeElement = this; this.focuses.push(options); }
  scrollIntoView(options) { this.scrolls.push(options); }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new Evenement('close')); }
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
  doc.createElement = creer;
  doc.getElementById = id => doc.body.querySelectorAll('[id]').find(el => el.id === id) || null;
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
function saisie(p, type = 'code', valeur = '') {
  const champ = p.creer('input', { 'data-menu-saisie': type, maxlength: String(type === 'code' ? 4 : 16) }); champ.value = valeur; p.zone.append(champ);
  let dialogue = p.doc.getElementById('saisie-manette');
  if (!dialogue) {
    dialogue = p.creer('dialog', { id: 'saisie-manette' });
    for (const id of ['sm-titre', 'sm-contenu', 'sm-limite', 'sm-touches']) dialogue.append(p.creer('div', { id }));
    for (const id of ['sm-maj', 'sm-espace', 'sm-effacer', 'sm-valider', 'sm-annuler']) dialogue.append(p.creer('button', { id }));
    p.doc.body.append(dialogue);
  }
  const $ = id => p.doc.getElementById(id);
  const touche = lettre => dialogue.querySelectorAll('button').find(b => b.dataset.saisieLettre === lettre);
  return { champ, dialogue, $, touche };
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

verifier('changer de panneau libère le focus masqué et notifie seulement le changement effectif', () => {
  const p = page(), t = tabs(p); N.initialiser(p.zone);
  let changements = 0; p.zone.addEventListener('menuongletchange', () => changements++);
  t.panels[0].children[0].focus();
  assert.equal(N.ouvrirOnglet(p.zone, 'pilotage'), true);
  assert.equal(p.doc.activeElement, t.ts[1], 'un champ du panneau caché ne conserve pas le clavier');
  assert.equal(changements, 1);
  t.panels[1].children[0].focus(); N.ouvrirOnglet(p.zone, 'pilotage');
  assert.equal(p.doc.activeElement, t.panels[1].children[0], 'actualiser la même étape ne déplace pas le focus');
  assert.equal(changements, 1);
  t.ts[2].disabled = true; N.ouvrirOnglet(p.zone, 'audio'); assert.equal(changements, 1);
  t.ts[2].disabled = false; t.ts[2].hidden = true;
  const j = commandes(p); j.lire([5]);
  assert.equal(p.doc.activeElement, t.ts[0], 'LB/RB saute un onglet caché');
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

verifier('catalogue vertical : haut/bas choisit, gauche/droite quitte, A continue sans second clic', () => {
  const p = page(), precedent = p.creer('button'), suivant = p.creer('button');
  const liste = p.creer('div', { role: 'radiogroup', 'data-menu-axis': 'vertical' });
  const cs = Array.from({ length: 9 }, (_, i) => p.creer('button', { role: 'radio', 'aria-checked': String(i === 0) }));
  for (const c of cs) c.addEventListener('click', () => { for (const q of cs) q.setAttribute('aria-checked', String(q === c)); });
  liste.append(...cs); p.zone.append(precedent, liste, suivant); cs[0].focus();
  const j = commandes(p); j.lire([13]);
  assert.equal(p.doc.activeElement, cs[1]); assert.equal(cs[1].getAttribute('aria-checked'), 'true');
  j.lire([12]); assert.equal(p.doc.activeElement, cs[0]);
  j.lire([12]); assert.equal(p.doc.activeElement, cs[8], 'le catalogue boucle dans son propre groupe');
  assert.equal(cs[8].events.filter(t => t === 'click').length, 1);
  j.lire([15]); assert.equal(p.doc.activeElement, suivant, 'la liste ne retient pas toutes les directions');
  j.lire([12]); assert.equal(p.doc.activeElement, cs[8], 'la sélection est retrouvée au retour');
  j.lire([14]); assert.equal(p.doc.activeElement, precedent);
  j.lire([13]); assert.equal(p.doc.activeElement, cs[8]);
  let validations = 0;
  j.lire([0], 100, { valider: el => { assert.equal(el, cs[8]); validations++; return true; } });
  assert.equal(validations, 1); assert.equal(cs[8].events.filter(t => t === 'click').length, 1);
  j.lire([15]); j.lire([0], 100, { valider: () => false });
  assert.equal(suivant.events.filter(t => t === 'click').length, 1, 'les autres boutons gardent leur action native');
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

verifier('choix des deux joueurs : selects indépendants et champs J2 cachés hors parcours', () => {
  const p = page();
  const champs = [0, 1].map(n => {
    const s = p.creer('select', { id: 'klaxon-' + n });
    s.append(...['classique', 'ancien', 'mariage'].map(value => p.creer('option', { value })));
    s.selectedIndex = 0; p.zone.append(s); return s;
  });
  const fin = p.creer('button'); p.zone.append(fin); const j = commandes(p); champs[0].focus();
  j.lire([15]); assert.deepEqual(champs.map(s => s.value), ['ancien', 'classique']);
  j.lire([13]); assert.equal(p.doc.activeElement, champs[1]);
  j.lire([15]); j.lire([15]); assert.deepEqual(champs.map(s => s.value), ['ancien', 'mariage']);
  champs[1].hidden = true; champs[0].focus(); j.lire([13]); assert.equal(p.doc.activeElement, fin);
  assert.deepEqual(champs.map(s => s.value), ['ancien', 'mariage'], 'masquer J2 conserve ses choix');
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

verifier('Start facultatif : même garde-fou que A, B prioritaire, aucune répétition', () => {
  const p = page(), b = p.creer('button'); p.zone.append(b); b.focus(); const j = commandes(p);
  let departs = 0; const options = { demarrer: () => departs++ };
  assert.equal(j.lire([9]), false, 'Start reste au jeu si aucun raccord de menu ne le demande');
  j.lire([9], 100, options); assert.equal(departs, 1);
  N.naviguer(p.zone, i => i === 9, { pad: manette(1), temps: j.temps + 1, ...options }); assert.equal(departs, 1);
  j.pad.buttons[9] = { pressed: true, value: 1 }; j.lire([], 500, options); assert.equal(departs, 1);
  j.lire([1, 9], 100, options); assert.equal(departs, 1); assert.equal(j.retours, 1);
  j.lire([0, 9], 100, options); assert.equal(departs, 2);
  assert.equal(b.events.filter(x => x === 'click').length, 0, 'Start ne valide pas aussi le contrôle courant');
});

verifier('saisie manette du code : A ouvre, croix choisit, brouillon borné et validation native sans rejoindre', () => {
  const p = page(), s = saisie(p), j = commandes(p); s.champ.focus();
  s.champ.click(); assert.equal(s.dialogue.open, false, 'clic clavier/tactile conservé, sans dialogue imposé');
  s.champ.events.length = 0; j.lire([0]); assert.equal(s.dialogue.open, true); assert.equal(p.doc.activeElement, s.touche('A'));
  assert.equal(s.$('sm-maj').hidden, true); assert.equal(s.$('sm-espace').hidden, true);
  j.lire([0]); j.lire([15]); j.lire([0]); assert.equal(s.$('sm-contenu').textContent, 'AZ');
  j.lire([13]); assert.equal(p.doc.activeElement, s.touche('S'), 'même colonne sur la ligne suivante'); j.lire([0]);
  s.touche('T').focus(); j.lire([0]); j.lire([0]); assert.equal(s.$('sm-contenu').textContent, 'AZST', 'limite de quatre lettres');
  assert.equal(s.champ.value, ''); assert.deepEqual(s.champ.events, [], 'aucune écriture du champ tant que la saisie reste ouverte');
  s.$('sm-valider').focus(); j.lire([0]);
  assert.equal(s.dialogue.open, false); assert.equal(s.champ.value, 'AZST'); assert.deepEqual(s.champ.events, ['input', 'change']);
  assert.equal(p.doc.activeElement, s.champ); assert.equal(j.retours, 0);
});

verifier('saisie : B, Annuler et Échap abandonnent ; Start et LB/RB n’agissent pas derrière le dialogue', () => {
  const p = page(), t = tabs(p), s = saisie(p, 'code', 'AB'), j = commandes(p); N.initialiser(p.zone);
  s.champ.focus(); j.lire([0]); j.lire([0]); let departs = 0;
  j.lire([9], 100, { demarrer: () => departs++ }); j.lire([5]);
  assert.equal(departs, 0); assert.equal(s.$('sm-contenu').textContent, 'ABA'); assert.equal(t.panels[0].hidden, false);
  j.lire([1]); assert.equal(s.champ.value, 'AB'); assert.equal(s.dialogue.open, false); assert.equal(j.retours, 0);
  j.lire([0]); j.lire([0]); s.$('sm-annuler').focus(); j.lire([0]); assert.equal(s.champ.value, 'AB');
  j.lire([0]);
  const e = new Evenement('keydown', { key: 'Escape', bubbles: true }); p.doc.activeElement.dispatchEvent(e);
  assert.equal(e.defaultPrevented, true); assert.equal(e.propagationArretee, true);
  assert.equal(s.dialogue.open, false); assert.equal(s.champ.value, 'AB'); assert.equal(p.doc.activeElement, s.champ);
  j.lire([0]); const annulation = new Evenement('cancel'); s.dialogue.dispatchEvent(annulation);
  assert.equal(annulation.defaultPrevented, true); assert.equal(s.dialogue.open, false); assert.deepEqual(s.champ.events, []);
});

verifier('nom à la manette : casse, espace, accents, effacement et limite du champ', () => {
  const p = page(), s = saisie(p, 'nom', 'Fr'), j = commandes(p); s.champ.focus(); j.lire([0]);
  assert.equal(s.$('sm-maj').hidden, false); assert.equal(s.$('sm-espace').hidden, false);
  assert.equal(s.touche('È').textContent, 'è'); s.touche('È').focus(); j.lire([0]);
  s.touche('R').focus(); j.lire([0]); s.touche('E').focus(); j.lire([0]);
  s.$('sm-espace').focus(); j.lire([0]); s.$('sm-maj').focus(); j.lire([0]);
  assert.equal(s.$('sm-maj').getAttribute('aria-pressed'), 'true'); assert.equal(s.touche('A').textContent, 'A');
  s.touche('A').focus(); j.lire([0]); s.$('sm-effacer').focus(); j.lire([0]);
  assert.equal(s.$('sm-contenu').textContent, 'Frère ');
  s.touche('Q').focus(); for (let k = 0; k < 20; k++) j.lire([0]);
  assert.equal(s.$('sm-contenu').textContent.length, 16); assert.equal(s.champ.value, 'Fr');
  s.$('sm-valider').focus(); j.lire([0]); assert.equal(s.champ.value, 'Frère QQQQQQQQQQ'); assert.deepEqual(s.champ.events, ['input', 'change']);
});

verifier('saisie et changement d’écran : annulation du brouillon, pas de focus caché ni écouteur cumulé', () => {
  const p = page(), s = saisie(p, 'code', 'A'), j = commandes(p); s.champ.focus(); j.lire([0]); j.lire([0]);
  p.zone.hidden = true; assert.equal(j.lire(), false); assert.equal(s.dialogue.open, false); assert.equal(s.champ.value, 'A');
  p.zone.hidden = false; s.champ.focus(); j.lire([0]); j.lire([0]);
  assert.equal(N.fermerSaisie(p.doc, false), true); assert.equal(s.champ.value, 'A'); assert.equal(N.fermerSaisie(p.doc, false), false);
  s.champ.focus(); j.lire([0]);
  const autre = p.creer('section'); p.doc.body.append(autre); N.initialiser(autre); assert.equal(s.dialogue.open, false);
  s.champ.focus(); j.lire([0]);
  s.dialogue.dispatchEvent(new Evenement('close')); assert.equal(s.dialogue.open, true, 'une notification close ancienne ne ferme pas la nouvelle saisie');
  assert.equal(s.$('sm-valider').listeners.get('click').length, 1); assert.equal(s.$('sm-maj').listeners.get('click').length, 1);
  N.fermerSaisie(p.doc); assert.deepEqual(s.champ.events, []);
  s.champ.readOnly = true; j.lire([0]); assert.equal(s.dialogue.open, false);
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

verifier('deux manettes : une seule validation même si J1 vient de changer d’écran', () => {
  const p = page(), depart = p.creer('button'), seconde = p.creer('section', { hidden: '' }), action = p.creer('button');
  p.zone.append(depart); seconde.append(action); p.doc.body.append(seconde);
  let activations = 0; action.addEventListener('click', () => activations++);
  depart.addEventListener('click', () => {
    p.zone.hidden = true; seconde.hidden = false; N.initialiser(seconde); action.focus();
  });
  depart.focus(); const j = commandes(p); j.lire([0]); assert.equal(seconde.hidden, false);
  const pad2 = manette(1);
  N.naviguer(seconde, i => i === 0, { pad: pad2, temps: j.temps + 1 });
  assert.equal(activations, 0, 'A de J2 dans la même lecture ne valide pas le nouvel écran');
  N.naviguer(seconde, () => false, { pad: pad2, temps: j.temps + 30 });
  N.naviguer(seconde, i => i === 0, { pad: pad2, temps: j.temps + 100 });
  assert.equal(activations, 1, 'un nouvel appui ultérieur est accepté');
});

verifier('masquage et remplacement de manette : aucune action cachée, reprise au neutre', () => {
  const p = page(), bs = [0, 1].map(() => p.creer('button')); p.zone.append(...bs); bs[0].focus(); const j = commandes(p);
  j.lire(); p.doc.hidden = true; j.pad.axes[1] = .9;
  assert.equal(j.lire([0, 1, 13], 1000), false); assert.equal(j.activations, 0); assert.equal(j.retours, 0);
  p.doc.hidden = false; j.lire(); assert.equal(p.doc.activeElement, bs[0]);
  j.pad.axes[1] = 0; j.lire(); j.pad.axes[1] = .9; j.lire(); assert.equal(p.doc.activeElement, bs[1]);
  j.pad.id = 'nouvelle-manette'; j.lire(); j.lire([], 400); assert.equal(p.doc.activeElement, bs[1]);
  j.pad.axes[1] = 0; j.lire(); j.pad.axes[1] = -.9; j.lire(); assert.equal(p.doc.activeElement, bs[0]);
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
