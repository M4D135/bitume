// Géométrie et placement de la version précédant l'optimisation de l'index d'axe.
// Les seules métadonnées de collision sont exclues : les empreintes visuelles historiques restent exactes.
// Empreintes calculées sur la version non optimisée, pas sur le code à vérifier.
// Source de référence : decor.js 9623f7816466f0062535a478ef03dbe40647bb03dec436c9ae7fdd0f448806b1.
// Node 24.18.0 ARM64 Linux et macOS : quelques flottants du décor diffèrent déjà
// sur la référence historique selon la plateforme. Chaque référence reste exacte.
// Linux x64, Node 24.22.1 (V8 13.6.233.17-node.58), qualifié le 17/11/2026 :
// carene.js, circuit.js et decor.js sont chargés depuis le commit historique
// 4f0afe2fdff16317002d35c9fb993f4142c1bea6 (5208eac^, avant optimisation).
// Les neuf empreintes historiques sont strictement égales à celles de d617bffa,
// tunnel désactivé. Aucun hash ARM n'est remplacé et aucune tolérance n'est ajoutée.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
for(const f of ['carene','circuit','decor'])require('../src/'+f+'.js');
const B=globalThis.BITUME;
function digest(value){const hash=createHash('sha256');function visit(x){if(typeof x==='function')return; if(ArrayBuffer.isView(x)){hash.update(x.constructor.name);hash.update(Buffer.from(x.buffer,x.byteOffset,x.byteLength));return;}if(x&&typeof x==='object'){hash.update(Array.isArray(x)?'[':'{');for(const k of Object.keys(x)){if(typeof x[k]==='function'||k==='collision'||k==='obstacles')continue;hash.update(k+'=');visit(x[k]);}hash.update('}');}else hash.update(typeof x+':'+String(x)+';');}visit(value);return hash.digest('hex');}
// Ne pas comparer une machine inconnue à une empreinte provenant d'une autre architecture.
// Les versions de Node qualifiées sont consignées plus haut ; une autre version est acceptée
// seulement si elle produit exactement les mêmes empreintes, sans tolérance ni nouveau hash.
const environnement = `${process.platform}/${process.arch}/node-${process.versions.node}`;
const champReference = {
  'linux/arm64': 'sha256',
  'darwin/arm64': 'sha256Darwin',
  'linux/x64': 'sha256LinuxX64'
}[`${process.platform}/${process.arch}`];
assert.ok(champReference, `Décor : oracle absent pour ${environnement} ; identité non vérifiée. ` +
  'Qualifier les neuf cas sur le commit historique 4f0afe2fdff16317002d35c9fb993f4142c1bea6 ' +
  'avant toute nouvelle référence ; ne pas prendre les empreintes du code courant.');
const expected=[
  {
    "graine": 11,
    "theme": "foret",
    "longueur": 4200,
    "sha256": "d13f5fc5f4d199aa4eb2d22ca5fd32a55990814ba8a6e7c8462d0b2e94953648",
    "sha256Darwin": "22ec2174f368c3f75b0e466ce820c7b3c767f67d3d09401382776aa7ffc1a7b9",
    "sha256LinuxX64": "66c960ed946280e42729f9e6a4be236e55046029016c0795dcf30d96de8ac6bf"
  },
  {
    "graine": 0,
    "theme": "foret",
    "longueur": 4200,
    "sha256": "a564643a418de3ebb0dfa738ec36e006bdde660f9df833571753221637070fb4",
    "sha256LinuxX64": "42ce2c5ea356b1f2af2b4b71fe891cfe5b1bada9e9f10cc078e9c03201900a30"
  },
  {
    "graine": 96,
    "theme": "foret",
    "longueur": 4200,
    "sha256": "3c73c4e9f9ced6f01eb7e629d08464dc8801c3e02d9c9fa2b0601dc83cffe9ed",
    "sha256Darwin": "b88cc72b2edb2e60678ff62e18a5b45048a6431c05113b27a783269aabee60f0",
    "sha256LinuxX64": "2041bf6b34ca3a29c16f6ae66587c78d999738e98ae7b98ec39ebfa693b71803"
  },
  {
    "graine": 29,
    "theme": "cote",
    "longueur": 3600,
    "sha256": "8fc4f2d8c8e7c91a3dae13364117fd1e61bb3f86d48873d49f91cc7e79ddf511",
    "sha256Darwin": "0bfa08d019661be2943c903783d0abd3117ff313abbd44b091f94379f7a3e85c",
    "sha256LinuxX64": "4b47d7dff7f9b649d58314895e6dd4b24a56013e322a6f8a42ee198f1f7c8135"
  },
  {
    "graine": 0,
    "theme": "cote",
    "longueur": 3600,
    "sha256": "2045959d71e1c6ef93108d4d24b46e38ccf37bb71144019b8daa41db55c85897",
    "sha256LinuxX64": "950f8d169bc5b4d6bdaebae10b1979d4f570abad580cc74a60c4bb9ebdf428f6"
  },
  {
    "graine": 96,
    "theme": "cote",
    "longueur": 3600,
    "sha256": "9caa3378123266e983a105369b2c5477bbd23ebf3d9689ba83272787b20189e9",
    "sha256LinuxX64": "8c6d28f30c1727df4623eb32ef76ef91796e27a13cd8b1e7306cfca20ecb0442"
  },
  {
    "graine": 47,
    "theme": "montagne",
    "longueur": 5200,
    "sha256": "f40ba8339f49256cd32f10f9892395f954dd88041d47ac49348ccbe9392867cd",
    "sha256Darwin": "27dc4846c09c4fd5ff776faa6cdd8a4734edcd1deb962b02ac3de91c33634a45",
    "sha256LinuxX64": "184794d2caeaa12116ec8bacb3153276283b059d8e46035564053bbbf2fb0bc3"
  },
  {
    "graine": 0,
    "theme": "montagne",
    "longueur": 5200,
    "sha256": "46930db97040bb1acd800c0a00e7689896cb249925663d91f4183784643dc2df",
    "sha256Darwin": "1f0cc32623faa03d2241fdd3ded1e514c02626a4a107ceb3e9d7cfccaf832915",
    "sha256LinuxX64": "60d536b5a8cb8c32499e383bf87af058be38e2603c182314d71c59110273f305"
  },
  {
    "graine": 96,
    "theme": "montagne",
    "longueur": 5200,
    "sha256": "886f243dc03d78b89b0c0f0e534e009ef8e36a03a77a5dcd7441fa3bff3abb61",
    "sha256Darwin": "0e33056b3ea37f11484c68bfbbba1a66036e9ac69aedef18efc446b7c614e985",
    "sha256LinuxX64": "9ed26752a12de33a6065e4588111fc0b009d95a63646151a4b9f58cf7736b768"
  }
];
// Le tunnel de montagne (16/11/2026) est vérifié à part (tunnel.test.mjs) : ici, la géométrie historique sans lui.
for (const reference of expected) {
  const { graine, theme, longueur } = reference, spec = { graine, theme, longueur };
  const c = B.circuit.creer(graine, { ...spec, tunnel: false });
  // Les cas sans empreinte Darwin distincte sont déjà identiques sur les deux références ARM.
  const ref = reference[champReference] ?? (champReference === 'sha256Darwin' ? reference.sha256 : undefined);
  // Oracle du décor historique, sans les recettes ni la végétation du biome pilote ajoutés ensuite.
  // Les empreintes restent celles des sources historiques ; vegetation.test.mjs et reperes-virages.test.mjs
  // contrôlent les ajouts actifs et les solides. Les nouveaux repères visuels ne font pas partie de cet oracle.
  assert.equal(digest(B.decor.construire(c, { matieres: false, vegetation: false, reperesVirages: false })), ref, `${environnement} : ${JSON.stringify(spec)}`);
}
console.log(`décor : 9 géométries de référence inchangées (${environnement})`);
