#!/usr/bin/env node
// Comparer le lot carrosserie à son poste de départ avant de renouveler la fixture.
// node tools/qualification/raccord-carrosserie-126ck.mjs <commit-poste> <rapport.json>
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [reference, destination] = process.argv.slice(2);
assert(/^[a-f0-9]{40}$/.test(reference || '') && destination, 'commit complet et fichier de rapport requis');
const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const source = (f, base) => base ? git(['show', `${reference}:${f}`]) : readFileSync(path.join(root, f));
const sha = b => createHash('sha256').update(b).digest('hex');
const modules = ['carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js',
  'conduite.js', 'cockpit-matieres.js', 'voiture.js'];
function charger(base) {
  const c = vm.createContext({ console });
  for (const f of modules) vm.runInContext(source(`src/${f}`, base).toString('utf8'), c, { filename: f });
  return c.BITUME.voiture;
}
const avant = charger(true), apres = charger(false);
const attendues = ['bande', 'filet', 'fleche', 'loin-caisse', 'pontons'];
const ajoutees = ['pontons-conduits', 'pontons-radiateurs'];
const equivalentes = [], modifiees = [], nouvelles = [], supprimees = [];
for (const n of Object.keys(avant.FORMES)) {
  if (!apres.FORMES[n]) supprimees.push(n);
  else (JSON.stringify(avant.FORMES[n]) === JSON.stringify(apres.FORMES[n]) ? equivalentes : modifiees).push(n);
}
for (const n of Object.keys(apres.FORMES)) if (!avant.FORMES[n]) nouvelles.push(n);
assert.deepEqual(modifiees.sort(), attendues);
assert.deepEqual(nouvelles.sort(), ajoutees);
assert.deepEqual(supprimees, []);
const constantes = Object.keys(avant).filter(n => n !== 'FORMES' && typeof avant[n] !== 'function');
for (const n of constantes) assert.equal(JSON.stringify(apres[n]), JSON.stringify(avant[n]), `constante ${n}`);
// Sans numéro, toutes les instances hors des sept formes de carrosserie doivent
// être identiques. Le numéro du nez suit volontairement la nouvelle peau ; sa
// présence ne doit toutefois changer ni les roues ni leur phase de rotation.
const ignores = new Set([...attendues, ...ajoutees].map(n => `bitume-${n}`));
let poses = 0, posesRouesNumero = 0;
for (const numero of [0, 27]) for (const pneus of ['slicks', 'inter', 'pluie', 'neige']) {
  const livree = { couleur: [.8, .1, .1], numero, pneus };
  const a = avant.modele(livree), b = apres.modele(livree);
  const formesRoues = new Set(a.corps.filter(p => p.roue !== undefined)
    .flatMap(p => [p.shape, ...(p.formesRoues || []).map(f => f.nom)]));
  const filtrer = objets => JSON.stringify(objets.filter(o => numero ? formesRoues.has(o.shape) : !ignores.has(o.shape)));
  for (const detail of ['complet', 'moyen', 'simple']) for (const braquage of [-.60, -.35, 0, .35, .60]) {
    const ev = { p: [15, 2, -20], cap: .47, tangage: .08, roulis: -.06, braquage, roule: 17, v: 42 };
    const etat = { volant: braquage, rapport: 3, rapportAvant: 2, passage: .55, regime: 9000, kmh: 151 };
    for (const mode of ['poser', 'cockpit', 'fantome', 'poserRetro']) {
      const x = [], y = [];
      if (mode === 'fantome') { avant.fantome(ev, x); apres.fantome(ev, y); }
      else if (mode === 'cockpit') { avant.cockpit(a, ev, x, etat); apres.cockpit(b, ev, y, etat); }
      else { avant[mode](a, ev, x, { detail }); apres[mode](b, ev, y, { detail }); }
      assert.equal(sha(filtrer(y)), sha(filtrer(x)), `${mode} ${pneus} ${detail} ${braquage} numero ${numero}`);
      if (numero) posesRouesNumero++; else poses++;
    }
  }
}
const fichiersRuntime = git(['diff', '--name-only', reference, '--', 'src', 'FERRO.lock.json', 'construire.py'])
  .toString('utf8').trim().split('\n').filter(Boolean);
assert.deepEqual(fichiersRuntime, ['src/voiture.js']);
const fixturePath = 'verifications/fixtures/voiture-identite.json';
const f0 = JSON.parse(source(fixturePath, true)), f1 = JSON.parse(source(fixturePath, false));
assert.equal(f1.arrondi, f0.arrondi);
const fixture = {};
for (const nom of Object.keys(f0.configurations)) {
  const a = f0.configurations[nom], b = f1.configurations[nom];
  assert.deepEqual(Object.keys(b), Object.keys(a));
  const changements = [];
  for (const groupe of Object.keys(a)) {
    assert.equal(b[groupe].appels, a[groupe].appels, `${nom}/${groupe} appels`);
    if (JSON.stringify(a[groupe]) !== JSON.stringify(b[groupe])) changements.push(groupe);
  }
  assert.equal(JSON.stringify(b.glaces), JSON.stringify(a.glaces));
  fixture[nom] = { groupes: Object.keys(a).length, modifies: changements.length, changements,
    appelsInchanges: true, glacesInchangees: true };
}
const rapport = { reference, runtimeModifie: fichiersRuntime, formes: { inchangees: equivalentes.length,
  modifiees, ajoutees: nouvelles, supprimees }, constantesIdentiques: constantes,
  posesHorsCarrosserieSansNumeroIdentiques: poses, posesRouesAvecNumeroIdentiques: posesRouesNumero, fixture,
  empreintes: { voitureBase: sha(source('src/voiture.js', true)), voitureCandidat: sha(source('src/voiture.js', false)),
    fixtureBase: sha(source(fixturePath, true)), fixtureCandidat: sha(source(fixturePath, false)) },
  limites: ['Le numéro du nez est reprojeté sur la nouvelle peau ; la comparaison hors carrosserie utilise une livrée sans numéro.',
    'Les roues sont aussi comparées avec le numéro 27, qui fixe leur phase de rotation.',
    'Comparaison géométrique et poses prescrites ; ne remplace pas les captures WebGL du jeu assemblé.'] };
const fichier = path.resolve(destination); mkdirSync(path.dirname(fichier), { recursive: true });
writeFileSync(fichier, JSON.stringify(rapport, null, 2) + '\n');
console.log(JSON.stringify({ formes: rapport.formes, constantes: constantes.length, poses, fixture:
  Object.fromEntries(Object.entries(fixture).map(([n, v]) => [n, { groupes: v.groupes, modifies: v.modifies }])), fichier }));
