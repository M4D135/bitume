// Lot 12F1 : vrai raccord HUD, vrais états de course et de remplacement ; seule la frontière DOM est simulée.
// Les nœuds viennent du HTML de production. Ce contrôle ne prétend pas qualifier la mise en page ou WebGL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/circuit.js';
import '../src/conduite.js';
import '../src/degats.js';
import '../src/contacts.js';
import '../src/course.js';

const B = globalThis.BITUME;
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
function extrait(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a);
  assert.ok(a >= 0 && b > a, 'bloc de production disponible : ' + debut);
  return source.slice(a, b);
}

// Petit arbre strict : aucun get/query ne fabrique un élément absent. cloneNode crée bien des nœuds distincts.
class Noeud {
  constructor(tag, attributs = {}) {
    this.tag = tag; this.attributs = { ...attributs }; this.enfants = []; this.parent = null;
    this.contenu = ''; this.ecritures = 0; this.hidden = Object.hasOwn(attributs, 'hidden');
    const proprietes = new Map();
    this.style = {
      setProperty: (nom, valeur) => { this.ecritures++; proprietes.set(nom, String(valeur)); },
      getPropertyValue: nom => proprietes.get(nom) || ''
    };
    this.classList = {
      contains: nom => this.className.split(/\s+/).includes(nom),
      toggle: (nom, oui) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        const ajout = oui === undefined ? !classes.has(nom) : oui;
        if (ajout) classes.add(nom); else classes.delete(nom);
        this.className = [...classes].join(' '); return ajout;
      },
      add: nom => this.classList.toggle(nom, true)
    };
  }
  get id() { return this.attributs.id || ''; }
  set id(v) { this.attributs.id = v; }
  get className() { return this.attributs.class || ''; }
  set className(v) { this.ecritures++; this.attributs.class = v; }
  get textContent() { return this.contenu + this.enfants.map(n => n.textContent).join(''); }
  set textContent(v) { this.ecritures++; this.contenu = String(v); this.enfants = []; }
  setAttribute(nom, valeur) { this.ecritures++; this.attributs[nom] = String(valeur); }
  getAttribute(nom) { return this.attributs[nom] ?? null; }
  appendChild(n) { n.parent = this; this.enfants.push(n); return n; }
  after(n) {
    assert.ok(this.parent, 'le HUD appartient au fragment HTML');
    n.parent = this.parent; this.parent.enfants.splice(this.parent.enfants.indexOf(this) + 1, 0, n);
  }
  remove() { if (this.parent) this.parent.enfants.splice(this.parent.enfants.indexOf(this), 1); this.parent = null; }
  cloneNode(profond) {
    const n = new Noeud(this.tag, this.attributs); n.contenu = this.contenu; n.hidden = this.hidden;
    if (profond) for (const enfant of this.enfants) n.appendChild(enfant.cloneNode(true));
    return n;
  }
  querySelectorAll(selecteur) {
    const criteres = selecteur.split(',').map(s => s.trim());
    for (const s of criteres) assert.match(s, /^(?:[#.][\w-]+|[a-z]+)$/, 'sélecteur DOM prévu : ' + s);
    const trouve = [], visite = n => {
      for (const e of n.enfants) {
        if (criteres.some(s => s[0] === '#' ? e.id === s.slice(1) : s[0] === '.' ? e.classList.contains(s.slice(1)) : e.tag === s)) trouve.push(e);
        visite(e);
      }
    };
    visite(this); return trouve;
  }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
}
function dom() {
  const debut = html.indexOf('<section id="hud"'), fin = html.indexOf('</section>', debut);
  assert.ok(debut >= 0 && fin > debut, 'fragment HUD présent');
  const racine = new Noeud('fragment'), pile = [racine];
  for (const jeton of html.slice(debut, fin + 10).match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)) {
    if (jeton.startsWith('<!--')) continue;
    if (jeton.startsWith('</')) { assert.equal(pile.pop().tag, jeton.slice(2, -1).trim()); continue; }
    if (!jeton.startsWith('<')) { pile.at(-1).contenu += jeton; continue; }
    const [, tag, reste] = jeton.match(/^<([\w-]+)([\s\S]*?)>$/), attributs = {};
    for (const [, nom, valeur] of reste.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attributs[nom] = valeur ?? '';
    const n = pile.at(-1).appendChild(new Noeud(tag, attributs));
    if (!['br', 'input', 'img', 'hr'].includes(tag)) pile.push(n);
  }
  assert.equal(pile.length, 1, 'fragment HTML équilibré');
  const $ = id => {
    const n = racine.querySelector('#' + id);
    assert.ok(n, 'identifiant réellement présent dans le HTML : ' + id); return n;
  };
  return { racine, $, document: { createElement: tag => new Noeud(tag) } };
}

const charger = new Function('B', 'dom', `
  'use strict';
  const { $, document } = dom;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v)), lerp = (a,b,t) => a+(b-a)*t;
  const reglages = { carte:'non', boite:'auto' }, imageCadence = null, dureeImage = 16;
  const chrono = t => t == null ? '–' : String(t), ecartTexte = t => String(t), nomCourt = v => v.nom;
  let horlogeReelle = 0, session = null;
  ${extrait('  const H = {};', '  // ---------------------------------------------------------------- écrans')}
  function initialiser(course, duo = false, joue = true) {
    const S = {};
    ${extrait('    S.locaux = course.voitures.filter', '    jeu.dataset.partage =')}
    return S;
  }
  return { HUD1, HUD2, hud2, majPneusHUD, majHud, initialiser, horloge:t => { horlogeReelle=t; } };
`);
function harnais() { const arbre = dom(); return { ...charger(B, arbre), arbre }; }
const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
function course(humains) { return B.course.creer(c, { graine: 2048, rivaux: 0, humains }); }
function seance(co) { return { type: co.duo ? 'duo' : 'course', course: co, derniereJauge: -9, positionPrec: 0, profilMeilleur: null }; }
function monte(et, type, usures) {
  Object.assign(et, B.pneus.creerEtat(type, { seance: 2048, voiture: 0 }));
  usures.forEach((usure, i) => { et.etatPneus[i].usure = usure; });
}
const ids = ['h-pneus', 'c-pneus', 'h-pneus-usure', 'h-pneu-0', 'h-pneu-1', 'h-pneu-2', 'h-pneu-3'];
const compte = x => ids.reduce((n, id) => n + x.h[id].ecritures, 0);
function lecture(x) {
  return { nom: x.h['h-pneus'].textContent, usure: x.h['h-pneus-usure'].textContent,
    type: x.h['c-pneus'].getAttribute('data-pneus'), niveau: x.h['c-pneus'].getAttribute('data-usure'),
    description: x.h['c-pneus'].getAttribute('aria-label'),
    barres: [0, 1, 2, 3].map(i => x.h['h-pneu-' + i].style.getPropertyValue('--f')) };
}
function figer(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.values(o).forEach(figer); Object.freeze(o); } return o; }
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok ' + nom); }

verifier('vrai HTML et vraies tables H/H2 : deux ensembles distincts, aucun ID inventé', () => {
  const h = harnais();
  for (const id of ids) {
    assert.strictEqual(h.HUD1.h[id], h.arbre.$(id));
    assert.strictEqual(h.HUD2.h[id], h.hud2.querySelector('#' + id));
    assert.notStrictEqual(h.HUD1.h[id], h.HUD2.h[id]);
  }
  assert.equal(h.HUD2.h['h-fps'], null, 'le clone conserve le choix de ne pas dupliquer les FPS');
  assert.equal(h.HUD1.h['c-pneus'].getAttribute('role'), 'group');
});

verifier('majHud réel : quatre montes, quatre usures et roue la plus usée réellement visibles', () => {
  const h = harnais(), co = course(), S = seance(co), et = co.joueur.etat;
  for (const [i, type] of B.pneus.TYPES_JOUABLES.entries()) {
    monte(et, type, [0, .21, .64, .90]); h.horloge(i); h.majHud(S);
    const lu = lecture(h.HUD1);
    assert.equal(lu.nom, B.pneus.NOMS_PNEUS[type]); assert.equal(lu.type, type);
    assert.equal(lu.usure, 'Usure max. 90 %'); assert.equal(lu.niveau, 'limite');
    assert.deepEqual(lu.barres, ['1.00', '0.79', '0.36', '0.10']);
    for (const [roue, valeur] of [['avant gauche', 0], ['avant droite', 21], ['arrière gauche', 64], ['arrière droite', 90]])
      assert.ok(lu.description.includes('roue ' + roue + ' ' + valeur + ' %'));
  }
});

verifier('initialisation de lancement : joueurs locaux 1 et 3 sélectionnés avant la première image', () => {
  const h = harnais(), co = course({ noms: ['Distant A', 'Local A', 'Distant B', 'Local B'], locaux: [1, 3], enLigne: true });
  monte(co.voitures[0].etat, 'pluie', [.9, .9, .9, .9]);
  monte(co.voitures[1].etat, 'slicks', [.1, .2, .3, .4]);
  monte(co.voitures[3].etat, 'neige', [.6, .5, .4, .3]);
  const S = h.initialiser(co, true);
  assert.deepEqual(S.locaux, [1, 3]);
  assert.equal(lecture(h.HUD1).type, 'slicks'); assert.equal(lecture(h.HUD1).usure, 'Usure max. 40 %');
  assert.equal(lecture(h.HUD2).type, 'neige'); assert.equal(lecture(h.HUD2).usure, 'Usure max. 60 %');
});

verifier('majHud partagé : chaque pilote garde ses pneus, sans fuite ni mutation de la simulation', () => {
  const h = harnais(), co = course({ noms: ['Un', 'Deux'], locaux: [0, 1] }), S = seance(co), S2 = Object.create(S);
  monte(co.voitures[0].etat, 'inter', [.12, .23, .34, .45]);
  monte(co.voitures[1].etat, 'neige', [.87, .76, .65, .54]);
  const avant = co.voitures.map(v => JSON.stringify(v.etat));
  co.voitures.forEach(v => figer(v.etat));
  h.majHud(S); const lu1 = lecture(h.HUD1), n1 = compte(h.HUD1);
  h.majHud(S2, h.HUD2, co.voitures[1]);
  assert.deepEqual(lecture(h.HUD1), lu1); assert.equal(compte(h.HUD1), n1);
  assert.equal(lecture(h.HUD2).type, 'neige'); assert.equal(lecture(h.HUD2).usure, 'Usure max. 87 %');
  assert.equal(lu1.type, 'inter'); assert.equal(lu1.usure, 'Usure max. 45 %');
  assert.deepEqual(co.voitures.map(v => JSON.stringify(v.etat)), avant);
});

verifier('remplacement réel : monte et quatre jauges actualisées, révision de service jamais changée par le HUD', () => {
  const h = harnais(), co = course(), et = co.joueur.etat, S = seance(co);
  monte(et, 'slicks', [.8, .7, .6, .5]); et.servicePneus = 3; h.majHud(S);
  assert.equal(B.pneus.remplacerEtat(et, 'pluie', { seance: 2048, voiture: co.joueur.id }, 3), true);
  const apresService = JSON.stringify(et); h.horloge(1); h.majHud(S);
  assert.equal(lecture(h.HUD1).type, 'pluie'); assert.equal(lecture(h.HUD1).usure, 'Usure max. 0 %');
  assert.deepEqual(lecture(h.HUD1).barres, ['1.00', '1.00', '1.00', '1.00']);
  assert.equal(et.servicePneus, 4); assert.equal(JSON.stringify(et), apresService);
  h.horloge(2); h.majHud(S); assert.equal(et.servicePneus, 4);
});

verifier('données absentes ou incomplètes : usure inconnue explicite, pas de pneus neufs inventés', () => {
  const h = harnais();
  for (const roues of [undefined, null, [], [{ usure: .5 }], [{ usure: NaN }, { usure: .2 }, { usure: Infinity }, {}]]) {
    const et = figer({ pneus: 'slicks', servicePneus: 7, etatPneus: roues });
    h.majPneusHUD(h.HUD1, et);
    const lu = lecture(h.HUD1);
    assert.equal(lu.usure, 'Usure —'); assert.equal(lu.niveau, 'inconnue');
    assert.ok(lu.description.includes('inconnue')); assert.equal(et.servicePneus, 7);
    if (roues?.[0]?.usure === .5) assert.equal(lu.barres[0], '0.50');
  }
});

verifier('affichage borné et catégorie lisible, sans normaliser l’état de conduite', () => {
  const h = harnais();
  for (const [usures, attendu, niveau] of [[[0, .2, .4, .59], 59, 'normale'], [[.6, .2, .3, .4], 60, 'forte'], [[-.3, 2, .3, .4], 100, 'limite']]) {
    const et = figer({ pneus: 'neige', etatPneus: usures.map(usure => ({ usure })) });
    const avant = JSON.stringify(et); h.majPneusHUD(h.HUD1, et);
    assert.equal(lecture(h.HUD1).usure, 'Usure max. ' + attendu + ' %');
    assert.equal(lecture(h.HUD1).niveau, niveau); assert.equal(JSON.stringify(et), avant);
  }
});

verifier('images identiques : aucune écriture pneus répétée ; la mise à jour suit la cadence du HUD', () => {
  const h = harnais(), co = course(), et = co.joueur.etat, S = seance(co);
  monte(et, 'slicks', [.1, .2, .3, .4]); h.majHud(S); const n = compte(h.HUD1);
  h.horloge(1); h.majHud(S); assert.equal(compte(h.HUD1), n, 'même état lors du prochain rafraîchissement');
  et.etatPneus[0].usure = .9;
  h.horloge(1.001); h.majHud(S); assert.equal(compte(h.HUD1), n, 'pas d’écriture entre deux rafraîchissements');
  h.horloge(1.04); h.majHud(S); assert.equal(lecture(h.HUD1).usure, 'Usure max. 90 %');
  const nouveau = compte(h.HUD1); h.horloge(1.08); h.majHud(S); assert.equal(compte(h.HUD1), nouveau);
});

console.log(controles + ' contrôles HUD pneus réels réussis (DOM simulé, mise en page/WebGL non qualifiés)');
