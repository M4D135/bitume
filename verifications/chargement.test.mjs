// Préparation des séances (jeu.js) : la course jetable de la chauffe, vraie section de production sur les vrais
// modules de simulation, ne déplace pas d'un bit la course de la séance ; tous les lancements passent par
// preparerSeance ; les créations tardives se comptent. Ce contrôle ne remplace pas WebGL : la chauffe du rendu et le
// voile se vérifient dans le navigateur (tools/profil-accrocs.mjs, BITUME_JEU.chargement).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course', 'carene', 'main', 'voiture', 'traces', 'meteo']) require('../src/' + f + '.js');
const B = globalThis.BITUME;
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
function section(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a + debut.length);
  assert.ok(a >= 0 && b > a, 'section réelle de jeu.js : ' + debut.trim());
  return source.slice(a, b);
}
const ligne = re => { const m = source.match(re); assert.ok(m, 'ligne réelle de jeu.js : ' + re); return m[0]; };
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

const fabrique = new Function('B', [
  ligne(/^  const DT = [^\n]+;/m),
  section('  function remplirPoses(', '  function melange('),
  ligne(/^  const meteoPeutMouiller = [^\n]+;/m),
  section('  const GRAINE_JETABLE', '  // ---------------------------------------------------------------- chauffe du rendu'),
  'return { courseJetable, GRAINE_JETABLE, DT, meteoPeutMouiller };'].join('\n'));
const { courseJetable, GRAINE_JETABLE, DT, meteoPeutMouiller } = fabrique(B);

// Empreinte exacte d'une course : chaque nombre au bit près (-0, NaN et infinis compris), sans le tracé partagé.
const empreinte = co => JSON.stringify(co, (k, v) => {
  if (k === 'c') return undefined;
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : Number.isFinite(v) ? v : String(v);
  return v;
});
const seance = (c, mode) => ({ course: B.course.creer(c, { mode, tours: 3, difficulte: 1, rivaux: 11, graine: 4242 }),
  meteo: { pluie: 0, nuage: .2, mouille: 0, fixe: false } });
const pilote = (co, k) => ({ gaz: 1, frein: 0, volant: Math.sin(k / 90) * .35, derive: k % 240 > 200, haut: false, bas: false,
  boite: 'auto', aide: 0, guidage: 0, marcheArriere: false });
// deux tracés jumeaux : la course jetable ne touche que le premier
const traces = [B.circuit.creer(11, { theme: 'foret', longueur: 4200 }), B.circuit.creer(11, { theme: 'foret', longueur: 4200 })];

for (const mode of ['course', 'chrono']) {
  verifier(`${mode} : la course jetable ne déplace ni la séance, ni son générateur, ni ses pneus`, () => {
    const A = seance(traces[0], mode), A2 = seance(traces[1], mode);
    const sec = { pluie: 0, mouille: 0 };
    B.meteo.actuel = sec;
    const avant = empreinte(A.course);
    assert.equal(avant, empreinte(A2.course), 'jumeaux identiques au lancement');
    // par tranches de 4 ms, comme sous le voile (le nombre de tranches dépend de la machine, pas le résultat)
    const J = courseJetable(A, 2.5);
    while (!J.avancer(4));
    const r0 = J.rapport;
    assert.equal(J.avancer(4), true); assert.strictEqual(J.rapport, r0, 'finie, elle ne repart pas');
    assert.strictEqual(B.meteo.actuel, sec, 'la météo du monde est rendue à la séance');
    assert.equal(empreinte(A.course), avant, 'séance intacte après la course jetable');
    const r = J.rapport;
    assert.equal(r.pas, Math.round(2.5 / DT));
    if (mode === 'course') {
      // les chemins rares sont passés : contact (étincelles), casse et roue perdue (débris), glisse (fumée, traces), embruns
      for (const k of ['debris', 'etincelles', 'fumees', 'bandes', 'embruns']) assert.ok(r.effets[k] > 0, 'effet chauffé : ' + k);
    } else assert.ok(r.effets.bandes > 0 && r.effets.fumees > 0, 'seul en piste : glisse, traces et fumée');
    const sortie = []; J.dessiner(sortie, [0, 0, 0]); assert.ok(sortie.length > 0, 'les effets passent par le vrai dessin');
    J.liberer(); assert.equal(J.effets.libere, true, 'monde et effets de la course jetable libérés');
    // puis la séance et sa jumelle courent : départ, feux, IA, contacts, tours ; elles doivent rester identiques
    for (const [S, n] of [[A, 0], [A2, 1]]) {
      B.meteo.actuel = sec;
      for (let k = 0; k < 1800; k++) {
        B.course.pas(S.course, pilote(S.course, k), DT);
        if (k % 300 === 299) (S.marques || (S.marques = [])).push(empreinte(S.course));
      }
    }
    assert.deepEqual(A.marques, A2.marques, 'quinze secondes de course identiques au bit près');
  });
}

verifier('piste sèche figée : chauffée sèche ; météo variable ou mouillée : chauffée mouillée', () => {
  assert.equal(meteoPeutMouiller({ pluie: 0, mouille: 0, fixe: true }), false);
  assert.equal(meteoPeutMouiller({ pluie: 0, mouille: 0, fixe: false }), true);
  assert.equal(meteoPeutMouiller({ pluie: .4, fixe: true }), true);
  assert.equal(meteoPeutMouiller(null), false);
  const A = seance(traces[0], 'course'); A.meteo = { pluie: 0, mouille: 0, fixe: true };
  const J = courseJetable(A, 1.2); while (!J.avancer(50));
  assert.equal(J.rapport.effets.embruns, 0, 'pas d’embruns sur une piste qui ne peut pas se mouiller');
  J.liberer();
  assert.equal(GRAINE_JETABLE, 0x5eed);
});

verifier('créations tardives : permises et comptées à part sous le voile, comptées par nom en course', () => {
  const fabriquer = new Function('prepa', 'session', section('  function creationTardive(', '  const canvas = ') + 'return creationTardive;');
  const P = { enCours: true, precharge: false }, S = { tardives: { n: 0, sousVoile: 0, noms: {} } }, f = fabriquer(P, S);
  const objet = {};
  assert.strictEqual(f('pluie', objet), objet, 'le filet rend l’objet créé');
  P.enCours = false; P.precharge = true; f('vitre', 1);
  P.precharge = false; f('pluie', 2); f('faune', 3); f('pluie', 4);
  assert.deepEqual(S.tardives, { n: 3, sousVoile: 2, noms: { pluie: 2, faune: 1 } });
  assert.equal(fabriquer(P, null)('x', 5), 5, 'sans séance, rien n’est compté');
  // le compteur naît avec chaque séance et se lit dans le compte rendu et dans l'outil de la console
  assert.ok(source.includes('tardives: { n: 0, sousVoile: 0, noms: {} }'));
  const outil = section('  const outilsJeu = {', '  function publierOutils()');
  assert.ok(/\bpreparer: \(o = \{\}\) =>/.test(outil) && /get chargement\(\)/.test(outil), 'BITUME_JEU.preparer et BITUME_JEU.chargement');
  assert.ok(/reference[,\s]/.test(outil) && /\bbanc[,\s]/.test(outil), 'reference() et banc() restent dans l’outil');
});

verifier('tous les lancements passent par la préparation : plus de lancement différé de 30 ms', () => {
  for (const [debut, fin] of [['  function demarrerSeance(', '  function basculerPause('], ['  function lancerEnLigne(', '  function surMessageEnLigne('],
    ['  function lancerDemo(', '  function demoSuivante('], ['  function demoSuivante(', '  function sortirDemo(']]) {
    const corps = section(debut, fin);
    assert.ok(corps.includes('preparerSeance('), debut.trim() + ' prépare sous le voile');
    assert.ok(!corps.includes('setTimeout') && !/\blancer\(/.test(corps), debut.trim() + ' ne lance plus directement');
  }
  const demarrer = section('  async function demarrer()', "  // Outil d'essai");
  assert.doesNotMatch(demarrer, /\b(?:preparerSeance|lancer|creerMoteurRetro)\(/, 'aucune séance ni miroir au démarrage');
  assert.ok(demarrer.includes("aller('titre')") && demarrer.includes('requestAnimationFrame(image)'), 'menu et commandes actifs');
  const lancer = section('  function lancer(', '\n  }\n');
  assert.ok(lancer.includes('if (prepa.enCours && !prepa.interne) annulerPreparation();'));
  assert.ok(lancer.includes('if (!prepa.interne) prechargerSeance(S);'), 'un lancement direct précharge aussi');
  const preparer = section('  async function preparerSeance(', '  function lancerVitrine(');
  assert.ok(preparer.includes('if (glaces) preparerGlaces()'), 'première vraie séance : miroirs selon le profil');
  // la démo des outils reste synchrone, comme reference() : séance et scène en place au retour de BITUME_JEU.demo
  const outil = section('  const outilsJeu = {', '  function publierOutils()');
  assert.ok(/\bdemo: i => demoDirecte\(/.test(outil), 'BITUME_JEU.demo passe par demoDirecte');
  const directe = section('  function demoDirecte(', '  function reference(');
  assert.ok(directe.includes("lancer('demo'") && directe.includes("aller('demo')") && !/await|preparerSeance|Promise/.test(directe), 'demoDirecte sans attente');
});

verifier('chauffe : le voile court seulement quand rien ne manque, la vitrine ne chauffe que ce qu’elle montre', () => {
  // la chauffe du code se note par type et par piste : une course sèche ne rend pas chaude la même course sous la pluie
  const cles = new Function('meteoPeutMouiller', [ligne(/^  const pisteDe = [^\n]+;/m), ligne(/^  const cleCode = [^\n]+;/m), 'return cleCode;'].join('\n'))(meteoPeutMouiller);
  assert.equal(cles('course', { meteo: { pluie: 0, mouille: 0, fixe: true } }), 'course:sec');
  assert.equal(cles('course', { meteo: { pluie: .6, mouille: 0, fixe: true } }), 'course:mouille');
  assert.equal(cles('duo', { meteo: { pluie: 0, mouille: 0, fixe: false } }), 'duo:mouille');
  const corps = section('  async function preparerSeance(', '  function lancerVitrine(');
  // le choix du voile court est revu sur la séance lancée : variante ou chemin froid → voile opaque avant la chauffe
  const apres = corps.slice(corps.indexOf('S = lancer('), corps.indexOf("await etape('creations'"));
  assert.ok(apres.includes('if (leger) {') && apres.includes('aChauffer(S)') && apres.includes('!prepa.chaud.has(cleCode(typeCode, S))'), 'manque recompté après lancer');
  assert.ok(apres.indexOf('leger = false') < apres.indexOf('montrerVoile(true, false)') && /await suite\(\); await suite\(\);/.test(apres), 'voile opaque et peint deux fois');
  assert.ok(/if \(!vitrine && !prepa\.chaud\.has\(cleCode\(typeCode, S\)\)\)/.test(corps) && corps.includes('prepa.chaud.add(cleCode(typeCode, S))'));
  assert.ok(section('  async function chaufferCode(', '  // ---------------------------------------------------------------- voile').includes("'simulation:' + S.course.mode + ':' + pisteDe(S)"),
    'course jetable par mode et par piste');
  // la chauffe et le choix du voile comptent le même manque
  const rendu = section('  async function chaufferRendu(', '  // ---------------------------------------------------------------- chauffe du code');
  assert.ok(rendu.includes('aChauffer(S, voisins)'));
  // la vitrine (écran titre, changement de circuit) ne passe pas par la chauffe des variantes et des témoins de course
  assert.ok(corps.includes('if (!vitrine) R.rendu = await chaufferRendu('));
});

verifier('machine lente : la chauffe se resserre sur le palier courant et ses voisins', () => {
  const fabriquer = new Function('B', 'reglages', 'etatProfils', 'capacitesRendu', 'palier', 'gpuModeste', 'PALIERS',
    section('  function profilsAtteignables(', '  // La piste peut-elle') + 'return profilsAtteignables;');
  const G = { graphismes: { normaliser: q => q, melange: (q, n) => n } };
  const f = (n, modeste) => fabriquer(G, { qualite: 'auto' }, { decor: 'high' }, {}, { n }, modeste, 4);
  assert.deepEqual(f(2, false)('course', null), [0, 1, 2, 3, 4], 'tous les paliers Auto');
  assert.deepEqual(f(2, false)('course', null, true), [1, 2, 3]);
  assert.deepEqual(f(0, false)('chrono', null, true), [0, 1]);
  assert.deepEqual(f(1, true)('duo', null, true), [1, 2], 'jamais sous le plancher d’un processeur modeste');
  assert.deepEqual(f(2, false)('vitrine', null, true), [2], 'hors gouverneur : le seul palier courant');
  // le seuil est celui de la chauffe du code, et une mesure lente se retient pour les préparations suivantes
  const code = section('  async function imagesDeChauffe(', '  async function chaufferCode(');
  assert.ok(code.includes('if (machineLente()) return { n, lent: true };') && code.includes('> IMAGE_LENTE') && code.includes('prepa.lente = true'));
  assert.ok(ligne(/^  const machineLente = [^\n]+;/m).includes('dureeImage > IMAGE_LENTE'));
});

verifier('sous le voile, la boucle ne simule ni ne dessine ; les étapes suivent l’ordre affiché', () => {
  const image = section('  function image(t) {', '    const tMes = B.mesures.imageDebut();');
  assert.ok(image.includes('if (prepa.voile && !prepa.attente) { tPrec = 0;'), 'garde du voile avant toute mesure');
  const corps = section('  async function preparerSeance(', '  function lancerVitrine(');
  const ordre = [...corps.matchAll(/await etape\('(\w+)'/g)].map(m => m[1]);
  const affiche = [...section('  const ETAPES = {', '  const ORDRE_ETAPES').matchAll(/(\w+): '/g)].map(m => m[1]);
  assert.deepEqual(ordre, affiche, 'chaque étape annoncée, dans l’ordre');
  // l'image de la séance montrée part d'une horloge propre
  const terminer = corps.slice(corps.indexOf('const terminer = '), corps.indexOf('let periode = '));
  assert.ok(terminer.includes('oublierIntervalle(); S.acc = 0; dureeImage = periode;'));
  assert.ok(terminer.indexOf('aller(') < terminer.indexOf('leverVoile()'), 'écran de course posé avant le fondu');
});

verifier('voile : opaque sans transition, étape et barre, annoncé poliment, mouvement réduit respecté', () => {
  const voile = html.match(/<div id="chargement"[^>]*>[\s\S]*?<\/div>/)[0];
  assert.ok(/role="status"/.test(voile) && /aria-live="polite"/.test(voile));
  assert.ok(voile.includes('id="chargement-etape"') && /<progress id="chargement-progres"[^>]*max="1"/.test(voile));
  assert.ok(/\.chargement\.net \{ transition: none; \}/.test(css), 'entrée opaque, sans fondu');
  // dernière image à 99 % : le compositeur peint la scène et l'affichage avant le fondu ; un abandon les remet en place
  assert.ok(/\.chargement\.tiede \{ opacity: \.99; \}/.test(css) && source.includes("v.classList.remove('net', 'tiede')"));
  assert.ok(section('  function annulerPreparation(', '  function abandonnerPreparation(').includes('remettreHud()'));
  assert.ok(css.indexOf('.chargement.net') < css.indexOf('.chargement.fini {'), 'le fondu de sortie l’emporte sur .net');
  const reduit = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(/\.chargement, \.chargement\.fini, #vue-course \{ transition: none; \}/.test(reduit.slice(0, reduit.indexOf('}\n}') + 3)));
  for (const nom of ['voile', 'decor', 'retro', 'circuit', 'seance', 'creations', 'rendu', 'code', 'zero', 'image'])
    assert.ok(new RegExp(nom + ": '[A-ZÀ-Ý][^']+'").test(source), 'texte français de l’étape ' + nom);
});
console.log(`${controles} contrôles de la préparation des séances réussis.`);
