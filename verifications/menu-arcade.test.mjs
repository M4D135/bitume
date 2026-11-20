// Géométrie réelle et frontière Canvas contrôlée ; pas de moteur, WebGL ni dépendance de navigateur.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
require('../src/circuit.js'); require('../src/route-des-cimes.js'); require('../src/menu-arcade.js');
const B = globalThis.BITUME, A = B.menuArcade;
const jeu = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const catalogue = vm.runInNewContext('(' + jeu.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1] + ')');
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok ' + nom); }
const proche = (a, b, precision = 1e-9) => assert.ok(Math.abs(a - b) < precision, `${a} ≠ ${b}`);
const petit = () => ({ n: 4, x: [0, 80, 80, 0], y: [5, 15, 25, 10], z: [0, 0, 60, 60], longueur: 280 });

verifier('le catalogue entier conserve ses vrais XYZ, son départ et une seule échelle métrique', () => {
  assert.equal(catalogue.length, 9);
  for (const k of catalogue) {
    const c = B.circuit.creer(k.graine, k), avant = [Array.from(c.x), Array.from(c.y), Array.from(c.z)];
    const t = A.preparerTrace(c);
    assert.ok(t.n <= A.MAX_POINTS && t.n >= 12, k.id);
    assert.equal(t.indices[0], 0, `${k.id} : départ`);
    assert.equal(new Set(t.indices).size, t.n, `${k.id} : échantillons distincts`);
    for (let i = 0; i < t.n; i++) {
      const j = t.indices[i];
      proche(t.points[i * 3] * t.diametre + t.centre[0], c.x[j]);
      proche(t.points[i * 3 + 1] * t.diametre + t.centre[1], c.y[j]);
      proche(t.points[i * 3 + 2] * t.diametre + t.centre[2], c.z[j]);
    }
    proche(t.altitudeMin, Math.min(...c.y)); proche(t.altitudeMax, Math.max(...c.y));
    proche(t.relief * t.diametre, t.altitudeMax - t.altitudeMin); assert.equal(t.longueur, c.longueur);
    assert.deepEqual([Array.from(c.x), Array.from(c.y), Array.from(c.z)], avant, 'source intacte');
  }
});

verifier('neuf circuits et 144 rotations : cadrage complet paysage/portrait, relief sans exagération', () => {
  for (const k of catalogue) {
    const t = A.preparerTrace(B.circuit.creer(k.graine, k)), tampon = new Float64Array(t.n * 3);
    for (const [largeur, hauteur] of [[720, 400], [280, 180], [960, 540], [640, 160], [340, 370], [1280, 720]]) {
      for (let angle = 0; angle < 144; angle++) {
        assert.equal(A.projeterTrace(t, angle * Math.PI / 72, largeur, hauteur, tampon), tampon);
        for (let i = 0; i < t.n; i++) {
          const x = tampon[i * 3] / largeur, y = tampon[i * 3 + 1] / hauteur;
          assert.ok(x >= .08 - 1e-9 && x <= .92 + 1e-9 && y >= .15 - 1e-9 && y <= .92 + 1e-9,
            `${k.id} ${largeur}×${hauteur} rotation ${angle} point ${i} (${x},${y})`);
          assert.ok(Number.isFinite(tampon[i * 3 + 2]) && tampon[i * 3 + 2] > 0);
        }
      }
    }
    const zero = A.projeterTrace(t, 0, 720, 400), tour = A.projeterTrace(t, Math.PI * 2, 720, 400);
    for (let i = 0; i < zero.length; i++) proche(zero[i], tour[i]);
  }
});

verifier('tracés incomplets et projections invalides refusés ; points et tampons bornés', () => {
  for (const c of [null, {}, { n: 2, x: [0, 1], z: [0, 1] }, { ...petit(), y: [] }, { ...petit(), x: [0, NaN, 2, 3] }]) assert.throws(() => A.preparerTrace(c), TypeError);
  const c = petit(); delete c.y; const t = A.preparerTrace(c, 12);
  assert.equal(t.n, 4); assert.equal(t.altitudeMin, 0); assert.equal(t.altitudeMax, 0);
  for (let i = 0; i < t.n; i++) assert.equal(t.points[i * 3 + 1], 0);
  const grand = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  assert.equal(A.preparerTrace(grand, 1).n, 12);
  assert.equal(A.preparerTrace(grand, 100000).n, A.MAX_POINTS);
  assert.equal(A.preparerTrace(grand, NaN).n, A.MAX_POINTS);
  assert.throws(() => A.projeterTrace(t, 0, 0, 200), RangeError);
  assert.throws(() => A.projeterTrace(t, 0, 300, Infinity), RangeError);
  assert.throws(() => A.projeterTrace(t, NaN, 300, 200), RangeError);
  assert.throws(() => A.projeterTrace(t, 0, 300, 200, new Float64Array(3)), RangeError);
});

function evenements() {
  const listeners = new Map();
  return { listeners,
    addEventListener(type, f) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(f); },
    removeEventListener(type, f) { listeners.get(type)?.delete(f); },
    emettre(type, e = {}) { for (const f of listeners.get(type) || []) f(e); }
  };
}
function toile({ reduit = false, contexte = true, largeur = 720, hauteur = 400 } = {}) {
  const appels = { contexte: 0, dessins: 0, dimensions: 0, geometries: 0, styles: 0, textes: [] }, media = { ...evenements(), matches: reduit };
  const observer = { deconnecte: false, callback: null };
  const vue = { ...evenements(), devicePixelRatio: 2, innerWidth: 1920, innerHeight: 1080,
    performance: { now: () => performance.now() }, matchMedia: () => media,
    getComputedStyle: canvas => { appels.styles++; return { visibility: canvas.visibility }; },
    ResizeObserver: class { constructor(f) { observer.callback = f; } observe() {} disconnect() { observer.deconnecte = true; } },
    requestAnimationFrame() { throw new Error('L’aperçu ne crée pas de boucle autonome'); }
  };
  const doc = { ...evenements(), defaultView: vue, hidden: false };
  const ctx = { createLinearGradient: () => ({ addColorStop() {} }), fillRect() { appels.dessins++; },
    beginPath() {}, closePath() {}, stroke() {}, fill() {},
    moveTo(...points) { assert.ok(points.every(Number.isFinite)); },
    lineTo(...points) { assert.ok(points.every(Number.isFinite)); },
    arc(...points) { assert.ok(points.every(Number.isFinite)); },
    fillText(texte, x, y) { assert.ok([x, y].every(Number.isFinite)); appels.textes.push({ texte, x, y }); }
  };
  const canvas = { ownerDocument: doc, visibility: 'visible', masque: false, x: 0, y: 0, largeur, hauteur,
    _width: 720, _height: 400,
    get width() { return this._width; }, set width(v) { this._width = v; appels.dimensions++; },
    get height() { return this._height; }, set height(v) { this._height = v; appels.dimensions++; },
    getContext(type, options) { assert.equal(type, '2d'); assert.deepEqual(options, { alpha: false }); appels.contexte++; return contexte ? ctx : null; },
    closest() { return this.masque ? {} : null; },
    getBoundingClientRect() { appels.geometries++; return { width: this.largeur, height: this.hauteur, left: this.x, right: this.x + this.largeur, top: this.y, bottom: this.y + this.hauteur }; }
  };
  return { canvas, doc, vue, media, observer, appels };
}

verifier('choisir un circuit caché ne crée ni contexte, ni géométrie, ni tampon de dessin', () => {
  const t = toile(), apercu = A.creerApercu(t.canvas); let lectures = 0;
  const c = petit(), source = new Proxy(c, { get(obj, cle) { lectures++; return obj[cle]; } });
  apercu.choisir(source); assert.equal(lectures, 0); assert.equal(t.appels.contexte, 0);
  for (let i = 0; i < 60; i++) assert.equal(apercu.dessiner(i * 16, false), false);
  t.doc.hidden = true;
  for (let i = 0; i < 60; i++) assert.equal(apercu.dessiner(i * 16, true), false);
  t.doc.hidden = false; t.canvas.masque = true;
  assert.equal(apercu.dessiner(2000, true), false);
  assert.equal(lectures, 0); assert.equal(t.appels.contexte, 0); assert.equal(t.appels.geometries, 0);
  assert.equal(apercu.stats().preparations, 0); assert.equal(apercu.stats().images, 0);
  t.canvas.masque = false; assert.equal(apercu.dessiner(2100, true), true);
  assert.ok(lectures > 0); assert.equal(apercu.stats().preparations, 1); assert.equal(t.appels.contexte, 1);
  apercu.detruire();
});

verifier('CSS invisible, taille nulle et aperçu hors vue ne préparent pas le circuit', () => {
  for (const modifier of [t => { t.canvas.visibility = 'hidden'; }, t => { t.canvas.visibility = 'collapse'; },
    t => { t.canvas.largeur = 0; }, t => { t.canvas.hauteur = 0; }, t => { t.canvas.y = 1081; }, t => { t.canvas.x = 1921; }, t => { t.canvas.y = -500; }]) {
    const t = toile(), apercu = A.creerApercu(t.canvas); apercu.choisir(petit()); modifier(t);
    assert.equal(apercu.dessiner(0, true), false); assert.equal(apercu.stats().preparations, 0);
    assert.equal(t.appels.dessins, 0); assert.equal(t.appels.contexte, 0); apercu.detruire();
  }
});

verifier('cadence plafonnée à 30/20 images par seconde et changements réunis, sans recréer le cache', () => {
  for (const leger of [false, true]) {
    const t = toile(), apercu = A.creerApercu(t.canvas), a = petit(), b = petit(); b.y[2] = 30;
    apercu.choisir(a);
    for (let temps = 0; temps <= 1000; temps++) {
      if (temps === 5) apercu.choisir(b);
      if (temps === 10) apercu.choisir(a);
      apercu.dessiner(temps, true, leger);
    }
    assert.ok(apercu.stats().images <= (leger ? 21 : 31)); assert.ok(apercu.stats().images >= (leger ? 20 : 29));
    assert.equal(apercu.stats().preparations, 1, 'le choix intermédiaire jamais visible reste non préparé');
    assert.equal(t.appels.contexte, 1);
    assert.ok(t.appels.dimensions <= 2, 'pas de redimensionnement répété');
    apercu.choisir(b); apercu.dessiner(1100, true, leger); assert.equal(apercu.stats().preparations, 2);
    apercu.choisir(a); apercu.dessiner(1200, true, leger); assert.equal(apercu.stats().preparations, 2);
    apercu.detruire();
  }
});

verifier('résolution plafonnée sur les deux axes et adaptée lors d’un changement de qualité', () => {
  for (const [largeur, hauteur] of [[4000, 3000], [200, 4000], [720, 400], [320, 180]]) {
    const t = toile({ largeur, hauteur }), apercu = A.creerApercu(t.canvas); apercu.choisir(petit());
    apercu.dessiner(0, true); let [w, h] = apercu.stats().resolution;
    assert.ok(w <= 960 && h <= 540 && w > 0 && h > 0);
    assert.ok(Math.abs(w / h - largeur / hauteur) <= 1 / h + largeur / hauteur / h);
    apercu.dessiner(100, true, true); [w, h] = apercu.stats().resolution;
    assert.ok(w <= 640 && h <= 360 && w > 0 && h > 0);
    t.canvas.largeur = 400; t.canvas.hauteur = 300; t.observer.callback();
    apercu.dessiner(200, true, true); assert.deepEqual(apercu.stats().resolution, [400, 300]);
    apercu.detruire();
  }
});

verifier('suspension écran/onglet et retour sans bond, même si aucune image n’arrive en arrière-plan', () => {
  const t = toile(), apercu = A.creerApercu(t.canvas); apercu.choisir(petit());
  apercu.dessiner(0, true); apercu.dessiner(100, true); const rotation = apercu.stats().rotation;
  assert.equal(apercu.dessiner(150, false), false); assert.equal(apercu.stats().actif, false);
  apercu.dessiner(10000, true); assert.equal(apercu.stats().rotation, rotation);
  t.doc.hidden = true; t.doc.emettre('visibilitychange'); assert.equal(apercu.stats().actif, false);
  t.doc.hidden = false; t.doc.emettre('visibilitychange'); apercu.dessiner(100000, true);
  assert.equal(apercu.stats().rotation, rotation); apercu.dessiner(100050, true);
  proche(apercu.stats().rotation - rotation, .05 * .19);
  apercu.detruire();
});

verifier('mouvement réduit et bouton figer : une image utile, aucun travail de projection au repos', () => {
  const t = toile({ reduit: true }), apercu = A.creerApercu(t.canvas); apercu.choisir(petit());
  apercu.dessiner(0, true); const fixe = apercu.stats().rotation, geometries = t.appels.geometries;
  for (let temps = 40; temps < 1000; temps += 10) assert.equal(apercu.dessiner(temps, true), false);
  assert.equal(apercu.stats().images, 1); assert.equal(t.appels.geometries, geometries);
  t.media.emettre('change', { matches: false }); apercu.dessiner(2000, true);
  assert.equal(apercu.stats().rotation, fixe); apercu.dessiner(2050, true); assert.ok(apercu.stats().rotation > fixe);
  apercu.pause(true); apercu.dessiner(2100, true); const pause = apercu.stats(), appels = t.appels.geometries;
  for (let temps = 2200; temps < 3000; temps += 10) assert.equal(apercu.dessiner(temps, true), false);
  assert.equal(apercu.stats().images, pause.images); assert.equal(t.appels.geometries, appels);
  apercu.pause(false); apercu.dessiner(10000, true); assert.equal(apercu.stats().rotation, pause.rotation);
  t.media.emettre('change', { matches: true }); apercu.dessiner(10100, true);
  assert.equal(apercu.stats().rotation, pause.rotation); assert.equal(apercu.stats().pause, true);
  apercu.detruire();
});

verifier('détruire débranche les observateurs/événements ; absence de contexte sans boucle de relance', () => {
  const t = toile(), apercu = A.creerApercu(t.canvas); apercu.choisir(petit()); apercu.dessiner(0, true);
  apercu.detruire(); apercu.detruire();
  assert.equal(t.observer.deconnecte, true);
  for (const cible of [t.vue, t.doc, t.media]) for (const liste of cible.listeners.values()) assert.equal(liste.size, 0);
  apercu.choisir(petit()); assert.equal(apercu.dessiner(100, true), false); assert.equal(apercu.stats().detruit, true);
  const sans = toile({ contexte: false }), indisponible = A.creerApercu(sans.canvas); indisponible.choisir(petit());
  for (let i = 0; i < 60; i++) assert.equal(indisponible.dessiner(i * 16, true), false);
  assert.equal(sans.appels.contexte, 1); assert.equal(indisponible.stats().preparations, 0); indisponible.detruire();
});

verifier('Troll : choix indépendants, valeurs bornées, aucun alias vers les réglages stockés', () => {
  for (const source of [undefined, null, {}, { trollPilotes: null }, { trollPilotes: 'ancien' }, { trollPilotes: [null, 7] }]) {
    assert.deepEqual(A.normaliserTroll(source), [{ geste: 'majeur', klaxon: 'classique' }, { geste: 'majeur', klaxon: 'classique' }]);
  }
  const source = { trollPilotes: [{ geste: 'poing', klaxon: 'ancien' }, { geste: 'salut', klaxon: 'mariage' }] };
  const copie = A.normaliserTroll(source); assert.deepEqual(copie, source.trollPilotes);
  assert.notEqual(copie, source.trollPilotes); assert.notEqual(copie[0], source.trollPilotes[0]); assert.notEqual(copie[0], copie[1]);
  copie[0].geste = 'salut'; assert.equal(source.trollPilotes[0].geste, 'poing'); assert.equal(copie[1].geste, 'salut');
  assert.deepEqual(A.normaliserTroll({ trollPilotes: [{ geste: 'interdit', klaxon: 'ancien' }, { geste: 'poing', klaxon: {} }] }),
    [{ geste: 'majeur', klaxon: 'ancien' }, { geste: 'poing', klaxon: 'classique' }]);
});

verifier('changement d’étape : défilement central remis au début, réglage courant et liste préservés', () => {
  const t = toile(), defilement = { scrollTop: 123 }, catalogue = { scrollTop: 72 };
  const elements = new Map(), selection = { dataset: { menuTab: A.ETAPES[0] } };
  function element(id) {
    if (!elements.has(id)) elements.set(id, { ...evenements(), id, hidden: false, disabled: false, visibility: 'visible',
      setAttribute() {}, matches: () => false, closest() { return this.hidden ? this : null; },
      getClientRects: () => [{}], querySelectorAll: () => [], focus() {}, scrollIntoView() {} });
    return elements.get(id);
  }
  t.doc.getElementById = id => id === 'p-trace-3d' ? t.canvas : element(id);
  Object.assign(element('circuits'), catalogue);
  const zone = { ...evenements(), ownerDocument: t.doc, dataset: {},
    querySelector: s => s === '.panneaux-menu' ? defilement : selection };
  const ancien = B.navigationMenu;
  B.navigationMenu = { ouvrirOnglet(z, id) {
    if (!A.ETAPES.includes(id)) return false;
    if (selection.dataset.menuTab !== id) { selection.dataset.menuTab = id; z.emettre('menuongletchange'); }
    return true;
  } };
  const menu = A.installer(zone);
  try {
    assert.equal(defilement.scrollTop, 123, 'installer ne déclenche aucun changement d’écran');
    menu.actualiser(); assert.equal(defilement.scrollTop, 123, 'actualiser conserve le réglage en cours');
    menu.ouvrir(1, false); assert.equal(defilement.scrollTop, 0, 'entrée suivante au début');
    defilement.scrollTop = 210;
    menu.actualiser(); assert.equal(defilement.scrollTop, 210, 'un changement de condition ne saute pas au début');
    menu.ouvrir(1, false); assert.equal(defilement.scrollTop, 210, 'réouvrir l’étape sélectionnée ne déplace pas le contenu');
    menu.ouvrir(3, false); assert.equal(defilement.scrollTop, 0, 'bilan au début');
    defilement.scrollTop = 99; assert.equal(menu.retour(), true); assert.equal(menu.etape, 2);
    assert.equal(defilement.scrollTop, 0, 'retour à une autre étape au début');
    assert.equal(element('circuits').scrollTop, 72, 'le défilement propre au catalogue n’est pas réinitialisé');
  } finally { menu.detruire(); if (ancien) B.navigationMenu = ancien; else delete B.navigationMenu; }
});

console.log(`${controles} contrôles du menu arcade réussis ; neuf circuits, 144 rotations et six formats.`);
