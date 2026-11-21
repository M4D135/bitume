#!/usr/bin/env node
// Comparaison directe avec la base mobile qualifiée, indépendante de la fixture voiture-identite.
// node tools/qualification/raccord-mains-realisme.mjs <commit-base-mobile> <rapport.json>
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [reference, destination] = process.argv.slice(2);
assert(/^[a-f0-9]{40}$/.test(reference || '') && destination, 'commit complet et fichier de rapport requis');
assert.equal(reference, '6526493d3f2dfc472eb0dc8f8a6e2354dedf6ace',
  'base mobile qualifiée explicite ; sa voiture est celle de .79');
const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
const sha = b => createHash('sha256').update(b).digest('hex');
const cache = new Map();
function source(f, base) {
  const cle = (base ? reference : 'travail') + ':' + f;
  if (!cache.has(cle)) cache.set(cle, base ? git(['show', `${reference}:${f}`]) : readFileSync(path.join(root, f)));
  return cache.get(cle);
}
const perimetreRuntime = ['src', 'FERRO.lock.json', 'construire.py'];
const fichiersRuntime = git(['diff', '--name-only', reference, '--', ...perimetreRuntime])
  .toString('utf8').trim().split('\n').filter(Boolean);
assert.deepEqual(fichiersRuntime, ['src/main.js', 'src/voiture.js'], 'seules les deux sources du lot changent');
assert.equal(git(['ls-files', '--others', '--exclude-standard', '--', ...perimetreRuntime]).toString('utf8'), '',
  'aucune source runtime nouvelle hors suivi');

const modules = ['carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js',
  'conduite.js', 'cockpit-matieres.js', 'voiture.js'];
function charger(base) {
  const c = vm.createContext({ console });
  for (const f of modules) vm.runInContext(source(`src/${f}`, base).toString('utf8'), c, { filename: f });
  return c.BITUME.voiture;
}
const avant = charger(true), apres = charger(false);
const formes = { horsMainsIdentiques: [], mainsInchangees: [], mainsModifiees: [], mainsAjoutees: [], mainsSupprimees: [] };
for (const nom of Object.keys(avant.FORMES)) {
  if (!nom.startsWith('main-')) {
    assert.equal(JSON.stringify(apres.FORMES[nom]), JSON.stringify(avant.FORMES[nom]), `forme hors mains : ${nom}`);
    formes.horsMainsIdentiques.push(nom);
  } else if (!apres.FORMES[nom]) formes.mainsSupprimees.push(nom);
  else (JSON.stringify(avant.FORMES[nom]) === JSON.stringify(apres.FORMES[nom])
    ? formes.mainsInchangees : formes.mainsModifiees).push(nom);
}
for (const nom of Object.keys(apres.FORMES)) if (!avant.FORMES[nom]) {
  assert.ok(nom.startsWith('main-'), `nouvelle forme hors mains : ${nom}`);
  formes.mainsAjoutees.push(nom);
}
const nomsConstantes = V => Object.keys(V).filter(n => n !== 'FORMES' && typeof V[n] !== 'function').sort();
const constantes = nomsConstantes(avant);
assert.deepEqual(nomsConstantes(apres), constantes, 'mêmes constantes publiques');
for (const n of constantes) assert.equal(JSON.stringify(apres[n]), JSON.stringify(avant[n]), `constante ${n}`);

// Exclure les seules instances réellement articulées. Un filtre sur sphere ou
// cylinder cacherait aussi une régression du pommeau, de la colonne ou des roues.
// Les épaules, le buste, le casque, le volant et le levier restent comparés.
const rolesArticules = /^(?:gant|bras|avant-bras|manche-joint|coude)-/;
const rolesExclus = new Set();
function exclusions(mod) {
  const R = mod.objetsRendu.pilote, H = R.habitacle, objets = new Set();
  for (const main of H.mains) for (const p of [...main.pieces, ...main.tubes, ...main.boules]) objets.add(p.objet);
  for (const v of [...R.variantes, R.cockpit]) for (const p of v.pieces) if (rolesArticules.test(p.role)) {
    objets.add(p.objet); rolesExclus.add(p.role);
  }
  return objets;
}
const garder = (objets, exclus) => objets.filter(o => !exclus.has(o));
function comparerSorties(a, b, exclusA, exclusB, nom) {
  const x = garder(a, exclusA), y = garder(b, exclusB);
  assert.ok(x.length > 0, `${nom} : contrôle non vide`);
  assert.equal(y.length, x.length, `${nom} : même nombre d'instances conservées`);
  assert.equal(b.length - y.length, a.length - x.length, `${nom} : même nombre d'instances articulées exclues`);
  assert.ok([...x, ...y].every(o => !/^bitume-main-/.test(o.shape)), `${nom} : aucune main oubliée dans le filtre`);
  assert.equal(sha(JSON.stringify(y)), sha(JSON.stringify(x)), `${nom} : objets hors mains/bras identiques sans arrondi`);
  return { conserves: x.length, exclus: a.length - x.length };
}

const scenarios = [
  { nom: 'prise-neutre', volant: 0, passage: 1 },
  { nom: 'prise-braquage-gauche', volant: -1, passage: 1 },
  { nom: 'prise-braquage-droite', volant: 1, passage: 1 },
  { nom: 'levier-ouverture', volant: 0, passage: .12 },
  { nom: 'levier-trajet', volant: -.6, passage: .32 },
  { nom: 'levier-contact', volant: 0, passage: .54 },
  { nom: 'levier-retour', volant: .6, passage: .85 },
  { nom: 'salut-deploiement', volant: 0, passage: 1, geste: 'salut', gesteCote: 1, gesteIntensite: .6 },
  { nom: 'majeur-gauche', volant: -.6, passage: 1, geste: 'majeur', gesteCote: -1, gesteIntensite: 1 },
  { nom: 'poing-droit', volant: .6, passage: 1, geste: 'poing', gesteCote: 1, gesteIntensite: 1 }
];
const pneus = ['slicks', 'inter', 'pluie', 'neige'], niveaux = ['complet', 'moyen', 'simple'];
const groupes = {}, empreintePoses = createHash('sha256');
let poses = 0, temoinPommeau = false;
for (const monte of pneus) {
  const livree = { couleur: [.8, .12, .1], combinaison: [.9, .85, .7], numero: 27, pneus: monte };
  const a = avant.modele(livree), b = apres.modele(livree);
  for (let i = 0; i < scenarios.length; i++) {
    const { nom, ...posePilote } = scenarios[i], rouesDetail = i % 4;
    const etat = { rapportAvant: 2, rapport: 3, regard: .15, geste: null, gesteCote: 1,
      gestePhase: .37, gesteIntensite: 0, regime: 9000, kmh: 151, ...posePilote };
    const ev = { p: [15, 2, -20], cap: .47, tangage: .08, roulis: -.06, braquage: etat.volant * .6,
      roule: 17, v: 42, pilote: etat, rebond: [.001, -.002, .003, -.001] };
    const appels = [...niveaux.map(detail => ({ mode: 'poser', detail })),
      { mode: 'cockpit' }, { mode: 'poserRetro' }, { mode: 'fantome' }];
    for (const { mode, detail } of appels) {
      const x = [], y = [], options = { detail, rouesDetail };
      if (mode === 'fantome') { avant.fantome(ev, x); apres.fantome(ev, y); }
      else if (mode === 'cockpit') { avant.cockpit(a, ev, x, { ...etat, rouesDetail }); apres.cockpit(b, ev, y, { ...etat, rouesDetail }); }
      else { avant[mode](a, ev, x, options); apres[mode](b, ev, y, options); }
      const exclusA = exclusions(a), exclusB = exclusions(b), cle = mode + (detail ? '/' + detail : '');
      const compte = comparerSorties(x, y, exclusA, exclusB, `${monte}/${nom}/${cle}`);
      const g = groupes[cle] ||= { appels: 0, objetsConserves: 0, objetsArticulesExclus: 0 };
      g.appels++; g.objetsConserves += compte.conserves; g.objetsArticulesExclus += compte.exclus; poses++;
      empreintePoses.update(`${monte}/${nom}/${cle}\n` + JSON.stringify(garder(y, exclusB)) + '\n');
      // Témoin négatif ciblé : le pommeau est une sphère comme des articulations,
      // mais son déplacement de 1 mm doit rester détecté par le vrai filtre.
      if (!temoinPommeau && mode === 'poser' && detail === 'complet') {
        const pommeau = b.objetsRendu.pilote.variantes[0].pieces.find(p => p.role === 'pommeau').objet;
        assert.ok(y.includes(pommeau) && !exclusB.has(pommeau), 'le pommeau appartient au contrôle');
        const alteree = y.map(o => o === pommeau ? { ...o, p: Array.from(o.p, (v, k) => v + (k === 0 ? .001 : 0)) } : o);
        assert.throws(() => comparerSorties(x, alteree, exclusA, exclusB, 'témoin pommeau 1 mm'), { name: 'AssertionError' });
        temoinPommeau = true;
      }
    }
  }
}
assert.ok(temoinPommeau, 'témoin négatif exécuté');
// Une écriture concurrente des sources ne doit pas produire un reçu ambigu.
for (const f of modules.map(n => 'src/' + n)) assert.equal(sha(readFileSync(path.join(root, f))), sha(source(f, false)), `source stable : ${f}`);
const empreintesSources = Object.fromEntries(modules.map(n => {
  const f = 'src/' + n;
  return [f, { reference: sha(source(f, true)), candidat: sha(source(f, false)) }];
}));
const rapport = {
  reference, candidatHead: git(['rev-parse', 'HEAD']).toString('utf8').trim(), runtimeModifie: fichiersRuntime,
  formes, constantesIdentiques: constantes,
  posesHorsMainsBrasIdentiques: poses, groupes, pneus, niveauxVoiture: niveaux, niveauxRoues: [0, 1, 2, 3],
  scenarios, rolesArticulesExclus: [...rolesExclus].sort(), temoinPommeau1mmRejete: temoinPommeau,
  empreintesSources, empreintePosesHorsMains: empreintePoses.digest('hex'), fixtureUtilisee: false,
  limites: [
    'Comparaison exacte des objets rendus prescrits, sans arrondi ; le moteur WebGL ne tourne pas dans cet outil.',
    'Les états des mains et les bras qui suivent leurs trajets sont exclus par identité des instances, jamais par primitive sphere/cylinder.',
    'Les épaules, le buste, le casque, la carrosserie, les roues, les commandes et les rétroviseurs restent comparés.',
    'Trois LOD de voiture pour poser ; cockpit, rétroviseur et fantôme conservent leur niveau natif. Les quatre LOD de roues sont répartis sur les dix scénarios.',
    'La fixture voiture-identite est indépendante et n’est ni lue ni renouvelée par cet outil.',
    'Ces invariants ne prouvent ni la qualité visuelle des mains ni l’absence de collision ; voir les contrôles de surfaces et les captures WebGL.'
  ]
};
const fichier = path.resolve(destination); mkdirSync(path.dirname(fichier), { recursive: true });
writeFileSync(fichier, JSON.stringify(rapport, null, 2) + '\n');
console.log(JSON.stringify({ formesHorsMainsIdentiques: formes.horsMainsIdentiques.length,
  constantesIdentiques: constantes.length, poses, groupes, temoinPommeau1mmRejete: temoinPommeau, fichier }));
