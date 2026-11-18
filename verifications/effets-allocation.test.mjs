// Effets sans allocation par image : passe à 30 Hz et dessin de src/traces.js, mise à jour de src/sillage.js.
// Un octet alloué à chaque image finit par coûter un ramassage mineur (1 à 2 ms sur le M5, le double processeur
// ralenti) au milieu d'une course. Mesure : profil d'allocation échantillonné du moteur V8 (un échantillon tous les
// 32 octets en moyenne, objets ramassés compris), une fois chaque chemin parcouru et le code optimisé.
// Tout ce qui est alloué pendant la mesure compte, quel que soit le fichier : le moteur incorpore les petites
// fonctions des effets à celles de l'essai qui les appellent (compter, par exemple), et une allocation faite là serait
// comptée à l'essai. Les boucles de l'essai n'allouent donc rien elles-mêmes : aucun nombre à virgule n'y est passé à
// une fonction (il y serait mis en boîte), les instants dessinés viennent d'une table de nombres déjà en boîte.
// Processus à part : les autres suites donnent aux mêmes fonctions des objets de formes variées (états de voiture
// faits à la main, poses incomplètes), que le jeu ne leur donne jamais et qui font lire des nombres en boîte.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import inspector from 'node:inspector';
import path from 'node:path';
import v8 from 'node:v8';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));
for (const f of ['circuit.js', 'conduite.js', 'course.js', 'carene.js', 'main.js', 'voiture.js', 'traces.js', 'sillage.js']) charger(f);
const B = globalThis.BITUME, T = B.traces, S = B.sillage, DT = 1 / 120;

let compte = 0;
async function verifier(nom, f) {
  try { await f(); compte++; console.log(`ok  ${nom}`); } catch (e) { console.error(`KO  ${nom}`); console.error(e); process.exit(1); }
}

const pause = ms => new Promise(r => setTimeout(r, ms));
const codeMachine = () => v8.getHeapCodeStatistics().code_and_metadata_size;
function ramasser() { const s = new inspector.Session(); s.connect(); s.post('HeapProfiler.collectGarbage'); s.disconnect(); }

// Octets alloués par f(...args), tous fichiers confondus, par f et tout ce qu'elle appelle (pas par l'inspecteur qui
// mène la mesure) ; lieux : par fonction (fichier:nom:ligne ; un appel interne du moteur, l'agrandissement d'un tableau
// par exemple, est compté à la fonction JavaScript qui l'a fait), octets, échantillons et plus gros objet (un seul
// gros objet trahit le moteur, des centaines de petits une boîte par image) ; code : octets de code machine compilés
// ou jetés pendant la mesure.
async function profil(f, args) {
  await pause(40);
  const session = new inspector.Session(); session.connect();
  let p = null, code = 0;
  const code0 = codeMachine();
  session.post('HeapProfiler.startSampling', { samplingInterval: 32, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  try { f(...args); code = codeMachine() - code0; }
  finally { session.post('HeapProfiler.stopSampling', (e, r) => { p = r && r.profile; }); session.disconnect(); }
  const lieux = {}, noeuds = new Map();
  let octets = 0;
  const visiter = (n, parent) => {
    const lieu = n.callFrame.url ? n.callFrame : parent;
    const nom = `${path.basename(lieu.url)}:${lieu.functionName || '(anonyme)'}:${lieu.lineNumber + 1}`;
    noeuds.set(n.id, nom);
    if (n.selfSize) { octets += n.selfSize; const l = lieux[nom] || (lieux[nom] = { octets: 0, echantillons: 0, plusGros: 0 }); l.octets += n.selfSize; }
    for (const e of n.children) visiter(e, lieu);
  };
  (function chercher(n) {
    if (n.callFrame.functionName === f.name && n.callFrame.url === import.meta.url) visiter(n, n.callFrame);
    else for (const e of n.children) chercher(e);
  })(p.head);
  for (const s of p.samples) { const l = lieux[noeuds.get(s.nodeId)]; if (l) { l.echantillons++; l.plusGros = Math.max(l.plusGros, s.size); } }
  return { octets, lieux, code };
}

// Mesure du code optimisé, en régime établi. Trois choses l'en écartent, d'où la suite des opérations :
// - un ramassage complet jette le code optimisé qui citait des objets morts (ceux des essais précédents, des tours de
//   chauffe) : la fonction repasse par l'interpréteur, qui met ses nombres en boîte, puis se recompile. Le profileur
//   en fait un à chaque fin de mesure ; chaque essai commence donc par le sien (ramasser), suivi de la chauffe ;
// - le moteur ne compile une fonction marquée chaude qu'à son appel suivant, et installe le code compilé en tâche de
//   fond au premier point de contrôle venu, dans la fonction qui tourne alors : ces kilo-octets (code machine, tables
//   de désoptimisation) seraient comptés à une fonction des effets. Le rodage (la même charge en plus court, les
//   mêmes fonctions) est donc répété, une pause après chaque tour, jusqu'à deux tours de suite sans code nouveau ;
// - une compilation peut encore tomber dans la mesure : la mesure où du code a été compilé ou jeté ne compte pas,
//   elle est refaite (cinq essais au plus ; au-delà, le code ne se stabilise pas, et c'est un échec).
// prete() rend les arguments de la mesure (des états neufs, des pièces lancées), juste avant elle.
async function octetsAlloues({ chauffe, rodage, prete }, f) {
  let r = null;
  for (let essai = 1; essai <= 5; essai++) {
    ramasser(); chauffe();
    for (let stables = 0, k = 0; stables < 2 && k < 30; k++) {
      const c0 = codeMachine(); rodage(); await pause(15);
      stables = codeMachine() === c0 ? stables + 1 : 0;
    }
    r = await profil(f, prete());
    r.essais = essai;
    if (!r.code) return r;
  }
  assert.fail('du code est compilé ou jeté pendant chacune des cinq mesures : ' + JSON.stringify(r.lieux) + ', code ' + r.code);
}
// Le moteur optimise une fonction d'après le travail fait dans son propre corps : une boucle courte qui appelle une
// grosse fonction n'est optimisée qu'au bout de plusieurs appels. Dix tours de chauffe.
const chauffer = (f, ...args) => { for (let t = 0; t < 10; t++) f(...args); };

await verifier('témoin : la mesure voit une allocation connue (compter sans objet fourni)', async () => {
  const fx = T.creer(1, 1), c = {}, garde = new Array(2000).fill(null);
  // les résultats sont gardés : un objet jamais lu, le moteur se dispense de le créer
  const neufs = () => { for (let i = 0; i < 2000; i++) garde[i] = T.compter(fx); };
  const fourni = () => { for (let i = 0; i < 2000; i++) garde[i] = T.compter(fx, c); };
  // en alternance : fourni réécrit les champs de c, qui ont la forme des objets neufs, et le code de neufs qui les
  // tenait pour constants est jeté ; le second tour le refait pour de bon
  const deux = () => { neufs(); fourni(); };
  const banc = { chauffe: () => chauffer(deux), rodage: deux, prete: () => [] };
  const { octets } = await octetsAlloues(banc, neufs);
  assert.ok(octets > 20000, octets + ' octets vus pour 2 000 objets neufs');
  const sans = await octetsAlloues(banc, fourni);
  assert.equal(sans.octets, 0, 'compter dans un objet fourni : ' + JSON.stringify(sans.lieux));
});

// Douze voitures sur un cercle de 300 m, toutes en glisse ; une sur trois dans l'herbe, une sur deux contre la
// glissière ; pluie ; contacts réguliers ; une casse toutes les 5 s. Puis 10 s mesurées, pièces en vol.
await verifier('traces : passe à 30 Hz et dessin sans allocation, tous les effets (glisse, herbe, glissière, contacts, pluie, pièces)', async () => {
  const eauVraie = B.conduite.eauSurPiste;
  B.conduite.eauSurPiste = () => .6;
  try {
    const R = 300, voitures = [], poses = [];
    for (let k = 0; k < 12; k++) {
      voitures.push({ id: k, couleur: [.7, .1, .08], etat: { s: k * 8 + .5, d: k % 2 ? 2 : -2, v: 40, beta: .3, bond: 0, surface: k % 3 === 0 ? 'herbe' : 'piste', choc: k % 2 ? B.conduite.PARAMS.chocDuree : 0, roues: [0, 1, 2, 3].map(() => ({ glisse: 1 })) } });
      poses.push({ x: .5, y: .5, z: .5, cap: .5, tangage: .01, roulis: .02 });
    }
    const co = { c: { longueur: 2 * Math.PI * R }, voitures }, fx = T.creer(12, 5), CONTACT = [{ type: 'contact', a: 3, b: 4, force: 5 }];
    const casse = k => [0, 1, 2, 3].map(w => ({ type: 'roue', roue: w, id: k })).concat([{ type: 'casse', force: 40, id: k, cote: 1, avant: true }]);
    // instants dessinés : de −DT à 3 DT (ce que rend extrapolation), en boîte une fois pour toutes ; null garde au
    // tableau des cases quelconques, pour que les nombres n'y soient pas tenus nus (puis remis en boîte à chaque appel)
    const INSTANTS = Array.from({ length: 64 }, (_, j) => -DT + j * 4 * DT / 63).concat([null]);
    const compteurs = new Int32Array(2);                            // pas de course, image
    const pas = ev => {
      for (let k = 0; k < 12; k++) { const et = voitures[k].etat, p = poses[k]; et.s += et.v * DT; const a = et.s / R; p.x = R * Math.cos(a); p.z = R * Math.sin(a); p.cap = a + Math.PI / 2 + et.beta; }
      T.pas(fx, co, poses, 0, DT, ev !== undefined ? ev : (compteurs[0] % 36 === 0 ? CONTACT : null)); compteurs[0]++;
    };
    const sortie = { n: 0, t: new Array(4096).fill(null), push(o) { this.t[this.n++] = o; } }, oeil = [.5, 1, .5], axe = [.5, 0, 1];
    const image = () => {
      const p = poses[0], j = compteurs[1]++ & 63;
      oeil[0] = p.x; oeil[2] = p.z; axe[0] = -Math.sin(p.cap - .3); axe[2] = Math.cos(p.cap - .3);
      sortie.n = 0; T.dessiner(fx, sortie, oeil, INSTANTS[j], axe, 0);
      sortie.n = 0; T.dessiner(fx, sortie, oeil, INSTANTS[63 - j], axe, 60);
      sortie.n = 0; T.dessiner(fx, sortie, oeil);
    };
    const fenetre = n => { for (let i = 0; i < n; i++) { pas(); if (i % 2) image(); } };   // n pas de course
    for (let i = 0; i < 24000; i++) { pas(i % 600 === 0 ? casse((i / 600) % 12) : undefined); if (i % 2) image(); }
    const { octets, lieux, essais } = await octetsAlloues({
      chauffe: () => chauffer(fenetre, 1200), rodage: () => fenetre(120),
      prete: () => {                                                 // des pièces en vol pendant la mesure
        for (let k = 0; k < 12; k++) fx.pieces[k] = 0;
        pas(casse(2)); pas(casse(7)); fenetre(24);
        return [1200];                                               // 10 s de course : 300 passes, 1 800 dessins
      }
    }, fenetre);
    const c = T.compter(fx);
    assert.ok(c.bandes === 512 && c.fumees > 30 && c.etincelles > 30 && c.embruns > 100 && c.debris >= 12, JSON.stringify(c));
    assert.ok(sortie.n > 500, sortie.n + ' objets dessinés');
    assert.equal(octets, 0, 'octets alloués pendant la mesure : ' + JSON.stringify(lieux));
    console.log(`    0 octet alloué en 300 passes et 1 800 dessins (${sortie.n} objets par dessin ; mesure ${essais}/5)`);
  } finally { B.conduite.eauSurPiste = eauVraie; }
});

// Sillage : l'état préparé au lancement (preparer) met à jour sa première image comme les suivantes, sans allouer ;
// un état neuf de creer agrandit sa liste de sources à sa première image (témoin de la mesure).
await verifier('sillage : état préparé au lancement, première image et suivantes sans allocation', async () => {
  B.circuit.dansTunnel = B.circuit.dansTunnel || (() => false);
  const circuit = { longueur: 5000, tunnel: { debut: 800, fin: 1100 } };
  const voitures = Array.from({ length: 12 }, (_, i) => ({ id: i, abandon: i === 11, etat: { s: 100 * i + .5, v: 20.5 + 5 * i, beta: .1 * (i % 3) + .01 } }));
  const poses = voitures.map((v, i) => ({ x: i * 3.5 + .5, y: 1.25, z: -i * 2.5 + .5, cap: .3 * i + .01 }));
  const bouger = f => { for (let i = 0; i < 12; i++) { voitures[i].etat.s += .37; poses[i].x += .11 * f; poses[i].cap += .001; } };
  const premieres = liste => { for (let i = 0; i < liste.length; i++) S.mettreAJour(liste[i], voitures, poses, circuit); };
  const suite = (liste, n) => { for (let f = 0; f < n; f++) { bouger(f); S.mettreAJour(liste[f % liste.length], voitures, poses, circuit); } };
  const prepares = () => Array.from({ length: 50 }, () => S.preparer(null, 12)), neufs = () => Array.from({ length: 50 }, () => S.creer());
  // premières images d'états préparés et d'états neufs (les deux chemins de la liste), puis images suivantes
  const tour = () => { premieres(prepares()); premieres(neufs()); suite(prepares(), 400); };
  const banc = prete => ({ chauffe: () => { chauffer(tour); chauffer(suite, prepares(), 4000); }, rodage: tour, prete });
  let lot = null;
  const premiere = await octetsAlloues(banc(() => [lot = prepares()]), premieres);
  assert.equal(premiere.octets, 0, 'premières images d’états préparés : ' + JSON.stringify(premiere.lieux));
  // la mesure a fait le vrai travail : une source par voiture lancée, ni l'épave ni celles qui sont sous la voûte
  const attendu = voitures.filter(v => !v.abandon && !B.circuit.dansTunnel(circuit, v.etat.s, 0)).length;
  assert.ok(attendu > 0 && lot.every(e => e.actifs === attendu && e.sources.length === 12), 'sources actives : ' + lot[0].actifs + ' pour ' + attendu);
  const ensuite = await octetsAlloues(banc(() => [lot, 4000]), suite);
  assert.equal(ensuite.octets, 0, 'images suivantes : ' + JSON.stringify(ensuite.lieux));
  const temoin = await octetsAlloues(banc(() => [neufs()]), premieres);
  assert.ok(temoin.octets > 0, 'un état neuf de creer agrandit sa liste à la première image : la mesure doit le voir');
  console.log(`    0 octet sur 50 premières images préparées et 4 000 suivantes ; ${temoin.octets} octets pour 50 premières images d'états neufs`);
});

console.log('---');
console.log(compte + ' tests passes');
process.exit(0);
