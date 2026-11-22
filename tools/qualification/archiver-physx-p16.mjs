// Extrait les sources, aux octets du commit, pour rejouer la physique à archiver sur chaque architecture.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const racine = fileURLToPath(new URL('../../', import.meta.url));
const commit = 'c38a28c34921447e9025b55457587ac92476c795';
const jeu = ['baikal','batiments','bords','botanique','carene','chaussee','circuit','conduite','contacts','course','couverts',
  'decor','degats','ecologie','equipe-stands','jeu','lieux','marseille-decor','meteo','obstacles','physique','pneus',
  'route-des-cimes-decor','route-des-cimes','saisons','solides-physx','strategie-stands','usure-pneus','vegetation','virages'];
const banc = ['determinisme-simulation.test.mjs','fixtures/circuits-historiques-0252.json',
  'helpers/determinisme-physx.mjs','helpers/reference-physx.mjs','helpers/catalogue-historique.mjs','helpers/physx-runtime.mjs'];
const sources = {}, communs = {};
function lire(nom) {
  return execFileSync('git',['show',commit+':'+nom],{cwd:racine,maxBuffer:32*1024*1024});
}
for (const nom of [...jeu.map(n => 'src/'+n+'.js'), ...banc.map(n => 'verifications/'+n), 'src/moteur/renderer.js']) sources[nom] = lire(nom).toString('utf8');
for (const nom of ['src/ferro/physx.js','src/ferro/physx-runtime.js','src/ferro/vehicle-dynamics.js'])
  communs[nom] = createHash('sha256').update(lire(nom)).digest('hex');
const contenu = Buffer.from(JSON.stringify({commit,sources,communs}));
writeFileSync(new URL('../../verifications/fixtures/replay-physx-c38a28c.json.gz', import.meta.url),gzipSync(contenu,{level:9}));
console.log(createHash('sha256').update(contenu).digest('hex'));
