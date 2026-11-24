// Lot C : écran partagé local à trois et quatre joueurs. Ce contrôle vérifie le branchement (DOM, nombre de
// pilotes, affichages J3/J4, case carte animée à trois, absence de quatrième voiture fantôme). Il ne prétend
// pas qualifier le rendu WebGPU ni la mise en page, réservés aux captures Mac.
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
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
function extrait(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a);
  assert.ok(a >= 0 && b > a, 'bloc de production disponible : ' + debut);
  return source.slice(a, b);
}

let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok ' + nom); }

// ---------------------------------------------------------------- le HTML de la grille
verifier('le HTML porte les cases 3 et 4, la carte animée et les choix de trois et quatre pilotes', () => {
  for (const id of ['scene3', 'scene4', 'case-circuit', 'carte-circuit', 'o-joueurs', 'o-vue-3', 'o-vue-4',
    'p-vue-3', 'p-vue-4', 'p-commandes-j3', 'p-commandes-j4', 'ps-pilote-2', 'ps-pilote-3'])
    assert.ok(html.includes('id="' + id + '"'), 'élément présent : #' + id);
  for (const v of ['2', '3', '4']) assert.ok(html.includes('name="joueursLocaux" value="' + v + '"'), 'radio joueursLocaux ' + v);
  for (const v of ['2', '3']) assert.ok(html.includes('name="piloteStand" value="' + v + '"'), 'radio piloteStand ' + v);
  assert.ok(html.includes('name="joueursIci" value="3"') && html.includes('name="joueursIci" value="4"'), 'le lobby propose 3 et 4');
});

verifier('la feuille de style pose la grille 2×2 et réserve la quatrième case à trois joueurs', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /#jeu\[data-partage="grille"\] #scene \{[^}]*width: 50%[^}]*height: 50%/);
  for (const id of ['scene2', 'scene3', 'scene4', 'hud2', 'hud3', 'hud4'])
    assert.match(css, new RegExp('#jeu\\[data-partage="grille"\\] #' + id + ' '), 'case mise en page : #' + id);
  assert.match(css, /#jeu\[data-partage="grille"\]\[data-joueurs="3"\] #scene4 \{ display: none/);
  assert.match(css, /#jeu\[data-partage="grille"\]\[data-joueurs="3"\] #case-circuit \{ display: flex/);
});

// ---------------------------------------------------------------- le nombre de pilotes
function compteurs(reglages) {
  return new Function('reglages', extrait('  const joueursLocaux = () =>', '  const propre = t =>') + '\nreturn { joueursLocaux, joueursIci };')(reglages);
}
verifier('joueursLocaux accepte 1 à 4 ; joueursIci reste borné à 2 pour le réseau', () => {
  for (const n of [1, 2, 3, 4]) assert.strictEqual(compteurs({ joueursLocaux: n }).joueursLocaux(), n, 'local ' + n);
  assert.strictEqual(compteurs({ joueursLocaux: 7 }).joueursLocaux(), 1, 'valeur hors plage');
  assert.strictEqual(compteurs({ joueursLocaux: 3 }).joueursIci(), 2, 'réseau borné à deux');
  assert.strictEqual(compteurs({ joueursLocaux: 4 }).joueursIci(), 2, 'réseau borné à deux');
});

function seanceLancer(nbLocaux, humains) {
  const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const co = B.course.creer(c, { graine: 2048, rivaux: 11, humains });
  const S = { type: 'duo' };
  new Function('S', 'duo', 'nbLocaux', 'course', 'configurerTrollLocaux',
    extrait('    S.nbJoueurs = duo', '    if (joue && S.expressions'))(S, true, nbLocaux, co, () => {});
  return { S, co };
}
verifier('une séance à trois et quatre compte ses pilotes locaux, sans voiture de plus', () => {
  const noms = ['Joueur 1', 'Joueur 2', 'Joueur 3', 'Joueur 4'];
  for (const nb of [3, 4]) {
    const { S, co } = seanceLancer(nb, { noms: noms.slice(0, nb), locaux: noms.slice(0, nb).map((_, k) => k), hote: true, enLigne: false });
    assert.strictEqual(S.nbJoueurs, nb, 'S.nbJoueurs');
    assert.strictEqual(S.locaux.length, nb, 'S.locaux');
    assert.deepStrictEqual(S.locaux, [0, 1, 2, 3].slice(0, nb), 'voitures conduites ici');
    assert.ok(co.duo, 'co.duo vrai dès deux pilotes');
    for (let k = 0; k < nb; k++) assert.ok(co.voitures[k].joueur, 'pilote ' + k + ' conduit');
    assert.ok(!co.voitures[nb].joueur, 'pas de pilote fantôme en case ' + (nb + 1));
    assert.strictEqual(co.voitures.filter(v => v.joueur).length, nb, 'exactement ' + nb + ' voitures conduites');
  }
});

function partages(nbLocaux, duo = true) {
  const jeu = { dataset: {} };
  new Function('jeu', 'duo', 'nbLocaux', 'reglages',
    extrait("    jeu.dataset.partage = duo", "    delete $('hud').dataset.reduit"))(jeu, duo, nbLocaux, { partage: 'haut-bas' });
  return jeu.dataset;
}
verifier('la grille 2×2 vient avec le troisième joueur ; deux joueurs gardent le partage choisi', () => {
  assert.strictEqual(partages(2).partage, 'haut-bas');
  assert.strictEqual(partages(3).partage, 'grille');
  assert.strictEqual(partages(4).partage, 'grille');
  assert.strictEqual(partages(3).joueurs, '3');
  assert.strictEqual(partages(4).joueurs, '4');
});

// ---------------------------------------------------------------- les affichages J3/J4 (vrai fragment HUD)
class Noeud {
  constructor(tag, attributs = {}) {
    this.tag = tag; this.attributs = { ...attributs }; this.enfants = []; this.parent = null;
    this.contenu = ''; this.ecritures = 0; this.hidden = Object.hasOwn(attributs, 'hidden');
    const proprietes = new Map();
    this.style = { setProperty: (nom, valeur) => { this.ecritures++; proprietes.set(nom, String(valeur)); },
      getPropertyValue: nom => proprietes.get(nom) || '' };
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
  after(n) { assert.ok(this.parent, 'le HUD appartient au fragment HTML'); n.parent = this.parent; this.parent.enfants.splice(this.parent.enfants.indexOf(this) + 1, 0, n); }
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
  const $ = id => { const n = racine.querySelector('#' + id); assert.ok(n, 'identifiant réellement présent dans le HTML : ' + id); return n; };
  const carte = new Noeud('canvas');
  const traits = [];
  carte.getContext = () => ({ clearRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => traits.push('trait'),
    fill: () => {}, arc: () => {}, closePath: () => {}, fillText: () => {}, set font(v) {}, set fillStyle(v) {}, set strokeStyle(v) {},
    set lineWidth(v) {}, set lineJoin(v) {}, set lineCap(v) {}, set textAlign(v) {}, set textBaseline(v) {} });
  const document = { createElement: tag => new Noeud(tag), getElementById: id => id === 'carte-circuit' ? carte : null };
  return { racine, $, document, traits };
}
const charger = new Function('B', 'dom', `
  'use strict';
  const { $, document } = dom;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v)), lerp = (a,b,t) => a+(b-a)*t;
  const reglages = { carte:'oui', boite:'auto', annoncesVirages:'non', general:.8, effets:.9 }, imageCadence = null, dureeImage = 16;
  let ecran = 'course', sonActif = true, muet = false;
  function majPneusStands() {}
  const paroles = [], annulations = [], voixVirages = { dire: (...args) => paroles.push(args), annuler: () => annulations.push(true) };
  const chrono = t => t == null ? '–' : String(t), ecartTexte = t => String(t), nomCourt = v => v.nom;
  let horlogeReelle = 0, session = null;
  ${extrait('  const H = {};', '  // ---------------------------------------------------------------- écrans')}
  return { HUDS, hud3, hud4, HUD_CIRCUIT, majHudCircuitAnime, nbJoueursSession, indexVue, vueLourde,
    reglages, document, ecran:n => { ecran=n; }, horloge:t => { horlogeReelle=t; } };
`);
function harnais() { const arbre = dom(); return { ...charger(B, arbre), arbre }; }

verifier('quatre affichages distincts sont créés, les cases 3 et 4 partent masquées', () => {
  const h = harnais();
  assert.strictEqual(h.HUDS.length, 4, 'HUDS = [J1, J2, J3, J4]');
  assert.strictEqual(h.hud3.id, 'hud3'); assert.strictEqual(h.hud4.id, 'hud4');
  assert.strictEqual(h.hud3.hidden, true, 'hud3 masqué à la création');
  assert.strictEqual(h.hud4.hidden, true, 'hud4 masqué à la création');
  assert.strictEqual(h.hud3.getAttribute('aria-label'), 'Affichage du joueur 3');
  assert.strictEqual(h.hud4.getAttribute('aria-label'), 'Affichage du joueur 4');
  for (const n of [2, 3]) {
    assert.notStrictEqual(h.HUDS[n].h['h-pneus'], h.HUDS[0].h['h-pneus'], 'J' + (n + 1) + ' a son propre compteur de pneus');
    assert.notStrictEqual(h.HUDS[n].h.carte, h.HUDS[0].h.carte, 'J' + (n + 1) + ' a sa propre minimap');
    assert.ok(h.HUDS[n].h['h-pneus'].ecritures === 0, 'le HUD ' + (n + 1) + ' n\'a pas encore été écrit');
  }
  assert.ok(!h.hud3.querySelector('#b-pause') && !h.hud3.querySelector('#h-fps'), 'pause et FPS restent sur le joueur 1');
});

verifier('la case carte animée suit le leader à trois joueurs et reste silencieuse sinon', () => {
  const h = harnais();
  assert.ok(h.HUD_CIRCUIT, 'la carte animée est branchée sur #carte-circuit');
  const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const co = B.course.creer(c, { graine: 2048, rivaux: 2, humains: { noms: ['Joueur 1', 'Joueur 2', 'Joueur 3'], locaux: [0, 1, 2], hote: true, enLigne: false } });
  const S = { type: 'duo', course: co, nbJoueurs: 3, vuesJoueurs: [{}, {}, {}, null] };
  h.horloge(10);
  h.majHudCircuitAnime(S, 3);
  assert.ok(h.arbre.traits.length > 0, 'la quatrième case dessine le circuit à trois joueurs');
  const avant = h.arbre.traits.length;
  h.majHudCircuitAnime(S, 4);
  assert.strictEqual(h.arbre.traits.length, avant, 'à quatre joueurs, la case carte ne dessine rien');
  h.majHudCircuitAnime(S, 2);
  assert.strictEqual(h.arbre.traits.length, avant, 'à deux joueurs, la case carte ne dessine rien');
});

verifier('les effets lourds par vue restent aux deux premières cases', () => {
  const h = harnais();
  const S = { type: 'duo' };
  const vues = [{ indexVue: 0 }, { indexVue: 1 }, { indexVue: 2 }, { indexVue: 3 }];
  assert.deepStrictEqual(vues.map(v => h.vueLourde(v)), [true, true, false, false], 'faune, pluie de lentille, vitre et glaces: deux premières cases');
  assert.deepStrictEqual(vues.map(v => h.indexVue(v)), [0, 1, 2, 3]);
  assert.match(source, /if \(!vueLourde\(S\)\) return null;[^\n]*\n\s+const G = glacesDe/, 'les glaces de J3/J4 sont coupées avant toute lecture de la case voisine');
  assert.match(source, /if \(!vueLourde\(S\)\) \{ S\.pluieImage = 0; return; \}/, 'la pluie de lentille de J3/J4 est coupée');
});

console.log('contrôles : ' + controles);
