import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
createRequire(import.meta.url)('../src/qualite.js');
createRequire(import.meta.url)('../src/graphismes.js');
const Q = globalThis.BITUME.qualite;
const creer = n => ({ n, somme: 0, compte: 0, t: 0, aise: 0 });
function images(p, fps, n, options) { let changements = 0; for (let i = 0; i < n; i++) if (Q.avancer(p, 1 / fps, options)) changements++; return changements; }
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
verifier('49 FPS : aucune baisse avant trois secondes, puis un seul palier', () => {
  const p = creer(0);
  assert.equal(images(p, 49, 146), 0); assert.equal(p.n, 0);
  assert.equal(images(p, 49, 1), 1); assert.equal(p.n, 1);
  assert.equal(images(p, 49, 147), 1); assert.equal(p.n, 2);
});
verifier('50 et 60 FPS stables : ni baisse ni remontée', () => {
  for (const fps of [50, 60]) { const p = creer(2); assert.equal(images(p, fps, fps * 24), 0); assert.equal(p.n, 2); }
});
verifier('75 FPS : huit secondes avant une remontée, puis nouvelle observation complète', () => {
  const p = creer(3);
  assert.equal(images(p, 75, 599), 0); assert.equal(p.n, 3);
  assert.equal(images(p, 75, 1), 1); assert.equal(p.n, 2);
  assert.equal(images(p, 75, 599), 0); assert.equal(p.n, 2);
  assert.equal(images(p, 75, 1), 1); assert.equal(p.n, 1);
});
verifier('14 ms est la limite stricte de la remontée', () => {
  const p = creer(2);
  for (let i = 0; i < 1000; i++) assert.equal(Q.avancer(p, .014), false);
  assert.equal(p.n, 2);
});
verifier('très faible FPS et longues images restent pris en compte', () => {
  const p = creer(0);
  assert.equal(Q.avancer(p, 1.5), false);
  assert.equal(Q.avancer(p, 1.5), true); assert.equal(p.n, 1);
  assert.equal(Q.avancer(p, 12), true); assert.equal(p.n, 2, 'une seule baisse par image, pas quatre paliers d’un coup');
});
verifier('masquage ou mode inactif remet à zéro les deux fenêtres', () => {
  const p = creer(2);
  images(p, 75, 500);
  assert.ok(p.aise > 6);
  assert.equal(Q.avancer(p, 120, { actif: false }), false);
  assert.deepEqual(p, creer(2));
  assert.equal(images(p, 75, 599), 0);
  assert.equal(images(p, 75, 1), 1);
  images(p, 49, 146);
  Q.avancer(p, 0, { actif: false });
  assert.equal(images(p, 49, 146), 0);
  assert.equal(images(p, 49, 1), 1);
});
verifier('durées invalides ignorées sans contaminer une fenêtre', () => {
  const p = creer(1); images(p, 49, 100);
  const avant = { ...p };
  for (const dt of [0, -1, NaN, Infinity, -Infinity, undefined]) assert.equal(Q.avancer(p, dt), false);
  assert.deepEqual(p, avant);
  assert.equal(images(p, 49, 47), 1);
});
verifier('plancher GPU modeste et plafond de qualité respectés', () => {
  const modeste = creer(2);
  assert.equal(images(modeste, 75, 600, { min: 1 }), 1); assert.equal(modeste.n, 1);
  assert.equal(images(modeste, 75, 1200, { min: 1 }), 0); assert.equal(modeste.n, 1);
  const maximum = creer(4); assert.equal(images(maximum, 10, 1000, { max: 4 }), 0); assert.equal(maximum.n, 4);
  const hors = creer(0); assert.equal(Q.avancer(hors, 1 / 60, { min: 1 }), true); assert.equal(hors.n, 1);
});
verifier('une zone intermédiaire rompt la remontée, sans oscillation', () => {
  const p = creer(2); images(p, 75, 450); // six secondes confortables
  images(p, 60, 180); // trois secondes de fenêtre intermédiaire
  assert.equal(p.n, 2); assert.equal(p.aise, 0);
  assert.equal(images(p, 75, 599), 0); assert.equal(p.n, 2);
  assert.equal(images(p, 75, 1), 1); assert.equal(p.n, 1);
});

// Exécuter les vrais changements d'écran et le vrai gestionnaire de qualité de jeu.js. Le DOM et le renderer
// sont remplacés par leurs frontières minimales ; les transitions et le gouverneur ne sont pas réécrits ici.
// Passer un ancien jeu.js en argument permet de constater la régression avant correction.
const source = readFileSync(process.argv[2] || new URL('../src/jeu.js', import.meta.url), 'utf8');
function bloc(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a);
  assert.ok(a >= 0 && b > a, 'bloc du jeu disponible : ' + debut);
  return source.slice(a, b);
}
const integration = new Function('B', `
  const reglages = { qualite: 'auto' }, redimensions = [], ecouteurs = new Map(), elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { hidden: false, dataset: {}, querySelector: () => null });
    return elements.get(id);
  };
  const document = { hidden: false, activeElement: null, addEventListener: (nom, f) => ecouteurs.set(nom, f) };
  const rendu = { resize: valeur => redimensions.push(valeur) }, gpuModeste = false, estTactile = true;
  const session = { type: 'course' }, son = null, hud2 = $('hud2'), pad2 = {}, EL = { role: null };
  const aDeux = () => session.type === 'duo', secouerManette = () => {}, tactile = () => {};
  const appliquerVolumes = () => {}, remplirReglages = () => {}, sauverReglages = () => {}, appliquerCarte = () => {};
  ${bloc('  const palier = ', '  // effets permis par le profil résolu')}
  ${bloc("  let ecran = 'chargement';", "  document.addEventListener('click', e => {")}
  ${bloc("  document.addEventListener('change', e => {", "  for (const nom of ['general', 'moteur', 'effets'])")}
  ecran = 'course';
  return { palier, session, reglages, redimensions, aller,
    images: (fps, n) => { for (let i = 0; i < n; i++) majPalier(session, 1 / fps); },
    choisir: valeur => ecouteurs.get('change')({ target: { name: 'qualite', value: valeur } }) };
`);

verifier('jeu : 2,9 s lentes puis pause exigent trois nouvelles secondes après reprise', () => {
  const jeu = integration(globalThis.BITUME); jeu.palier.n = 2;
  jeu.images(40, 116); // 2,9 s, sous le seuil de décision
  jeu.aller('pause'); jeu.aller('course');
  assert.equal(jeu.palier.n, 2, 'la pause conserve le niveau choisi');
  jeu.images(40, 119);
  assert.equal(jeu.palier.n, 2, 'aucune décision avec les images antérieures à la pause');
  assert.equal(jeu.redimensions.length, 0, 'la pause ne redimensionne pas le rendu');
  jeu.images(40, 1); assert.equal(jeu.palier.n, 3);
  assert.deepEqual(jeu.redimensions, ['auto']);
});
verifier('jeu : les réglages interrompent aussi une remontée presque acquise', () => {
  const jeu = integration(globalThis.BITUME); jeu.palier.n = 2;
  jeu.images(75, 590);
  jeu.aller('reglages'); jeu.aller('course');
  jeu.images(75, 599); assert.equal(jeu.palier.n, 2);
  jeu.images(75, 1); assert.equal(jeu.palier.n, 1);
});
verifier('jeu : un choix manuel de qualité efface la charge précédente', () => {
  const jeu = integration(globalThis.BITUME);
  jeu.images(40, 116); jeu.choisir('high'); jeu.choisir('auto');
  // Fine rend le ratio décidé par src/graphismes.js (borné par devicePixelRatio), Auto rend la main au
  // gouverneur du moteur : c'est lui qui tient les 1 800 000 pixels, plus le profil qui décide du reste.
  assert.equal(typeof jeu.redimensions[0], 'number', 'un choix nommé rend un ratio, pas un nom');
  assert.ok(jeu.redimensions[0] >= .5 && jeu.redimensions[0] <= 2, 'ratio dans les bornes du moteur');
  assert.deepEqual(jeu.redimensions.slice(1), ['auto']);
  jeu.images(40, 119); assert.equal(jeu.palier.n, 0);
  jeu.images(40, 1); assert.equal(jeu.palier.n, 1);
});
verifier('jeu : pause/reprise ne force ni qualité fixe ni banc ni référence', () => {
  for (const options of [{ qualite: 'high' }, { banc: {} }, { reference: {} }]) {
    const jeu = integration(globalThis.BITUME); jeu.palier.n = 2;
    if (options.qualite) jeu.reglages.qualite = options.qualite;
    if (options.banc) jeu.session.banc = options.banc;
    if (options.reference) jeu.session.reference = options.reference;
    jeu.aller('pause'); jeu.aller('course'); jeu.images(10, 100);
    assert.equal(jeu.palier.n, 2); assert.equal(jeu.redimensions.length, 0);
  }
});
console.log(`qualité : ${controles} contrôles passés`);
