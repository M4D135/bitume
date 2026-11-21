#!/usr/bin/env node
// Mesures comparables de préparation dans des processus Node isolés.
// node tools/qualification/budget-mains.mjs <commit-reference> <rapport.json>
// Ce banc prépare le vrai répertoire FERRO ; il ne crée pas de contexte GPU.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const fichier = fileURLToPath(import.meta.url), racine = path.resolve(path.dirname(fichier), '../..');
const modules = ['moteur/renderer.js', 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'cockpit-matieres.js', 'voiture.js'];
const sha = contenu => createHash('sha256').update(contenu).digest('hex');
const git = args => execFileSync('git', args, { cwd: racine, maxBuffer: 64 * 1024 * 1024 });

if (process.argv[2] === '--mesure') {
  assert.equal(typeof globalThis.gc, 'function', 'exécuter avec --expose-gc');
  const reference = process.argv[3];
  assert.ok(reference === 'travail' || /^[a-f0-9]{40}$/.test(reference), 'référence explicite');
  globalThis.gc();
  const avant = process.memoryUsage(), debut = performance.now(), empreintes = {};
  const contexte = vm.createContext({ console });
  vm.runInContext('globalThis.window = globalThis', contexte);
  for (const nom of modules) {
    const source = reference === 'travail' ? readFileSync(path.join(racine, 'src', nom), 'utf8')
      : git(['show', reference + ':src/' + nom]).toString('utf8');
    empreintes[nom] = sha(source);
    vm.runInContext(source, contexte, { filename: nom });
  }
  const V = contexte.BITUME.voiture, geometrie = contexte.FRender.shared.geometry(false);
  const modele = V.modele({ couleur: [.8, .12, .1], combinaison: [.9, .85, .7], numero: 27 }), chauffe = [];
  const prechauffes = V.preparerExpressions(chauffe, [0, 0, 0]), formes = new Set(chauffe.map(o => o.shape));
  // Faire exister le même rig et les mêmes états avant le prélèvement mémoire.
  const ev = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, v: 20,
    pilote: { volant: 0, rapportAvant: 2, rapport: 3, passage: 1, geste: null, gesteIntensite: 0 } };
  const sortie = [];
  V.poser(modele, ev, sortie);
  const preparationMs = performance.now() - debut;
  globalThis.gc();
  const apres = process.memoryUsage();
  const nomFormes = new Map(Object.values(V.FORMES).map(f => [f.nom, f]));
  const resultat = { reference, sources: empreintes, formes: formes.size, entreesPrechauffage: prechauffes,
    trianglesMains: [...formes].reduce((s, n) => s + nomFormes.get(n).triangles, 0),
    tamponsGeometrie: { sommets: geometrie.vertices.byteLength, indices: geometrie.indices.byteLength },
    preparationMs, memoireDeltaOctets: Object.fromEntries(['heapUsed', 'arrayBuffers', 'rss'].map(n => [n, apres[n] - avant[n]])),
    objetsRendus: sortie.length, maillagesEnregistres: contexte.FRender.shared.shapes.size };
  // Garantir que tous les objets nécessaires restent vivants après le GC mesuré.
  assert.ok(geometrie.vertices.length && chauffe.length && modele.objetsRendu && sortie.length);
  console.log(JSON.stringify(resultat));
} else {
  const [reference, destination] = process.argv.slice(2);
  assert.ok(/^[a-f0-9]{40}$/.test(reference || '') && destination, 'commit complet et rapport requis');
  const empreintesAvant = Object.fromEntries(modules.map(n => [n, sha(readFileSync(path.join(racine, 'src', n)))]));
  const resultats = [];
  for (let repetition = 0; repetition < 3; repetition++) for (const version of [reference, 'travail']) {
    const sortie = execFileSync(process.execPath, ['--expose-gc', fichier, '--mesure', version],
      { cwd: racine, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    resultats.push({ repetition: repetition + 1, ...JSON.parse(sortie) });
  }
  for (const [n, h] of Object.entries(empreintesAvant)) assert.equal(sha(readFileSync(path.join(racine, 'src', n))), h,
    'source modifiée pendant les mesures : ' + n);
  const mediane = nombres => nombres.slice().sort((a, b) => a - b)[Math.floor(nombres.length / 2)];
  const synthese = [reference, 'travail'].map(version => {
    const lignes = resultats.filter(r => r.reference === version), premier = lignes[0];
    for (const ligne of lignes) for (const n of ['sources', 'formes', 'entreesPrechauffage', 'trianglesMains', 'tamponsGeometrie'])
      assert.deepEqual(ligne[n], premier[n], 'configuration stable : ' + n);
    return { reference: version, formes: premier.formes, entreesPrechauffage: premier.entreesPrechauffage,
      trianglesMains: premier.trianglesMains, tamponsGeometrie: premier.tamponsGeometrie,
      preparationMedianeMs: mediane(lignes.map(r => r.preparationMs)),
      memoireMedianeOctets: Object.fromEntries(['heapUsed', 'arrayBuffers', 'rss'].map(n =>
        [n, mediane(lignes.map(r => r.memoireDeltaOctets[n]))])) };
  });
  const rapport = { format: 'bitume-budget-mains-1', node: process.version, plateforme: process.platform,
    architecture: process.arch, repetitions: 3,
    methode: 'Processus Node isolés alternés référence/candidat ; GC avant chargement et après préparation du vrai répertoire geometry(false), du modèle et des variantes. Même rig rendu une fois.',
    limites: ['Mesures CPU et tampons typés uniquement ; aucun contexte GPU ni FPS matériel.',
      'Les temps et le RSS dépendent de la machine ; les nombres de formes, triangles et octets des tampons sont déterministes.',
      'Le temps inclut la lecture des fichiers de travail ou des blobs Git de référence.'],
    resultats, synthese };
  const sortie = path.resolve(destination); mkdirSync(path.dirname(sortie), { recursive: true });
  writeFileSync(sortie, JSON.stringify(rapport, null, 2) + '\n');
  console.log(JSON.stringify({ fichier: sortie, synthese }));
}
