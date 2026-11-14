// Géométrie et placement de la version précédant l'optimisation de l'index d'axe.
// Empreintes calculées sur la version non optimisée, pas sur le code à vérifier.
// Source de référence : decor.js 9623f7816466f0062535a478ef03dbe40647bb03dec436c9ae7fdd0f448806b1.
// Node 24.18.0 ARM64 Linux et macOS : quelques flottants du décor diffèrent déjà
// sur la référence historique selon la plateforme. Chaque référence reste exacte.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
for(const f of ['carene','circuit','decor'])require('../src/'+f+'.js');
const B=globalThis.BITUME;
function digest(value){const hash=createHash('sha256');function visit(x){if(typeof x==='function')return; if(ArrayBuffer.isView(x)){hash.update(x.constructor.name);hash.update(Buffer.from(x.buffer,x.byteOffset,x.byteLength));return;}if(x&&typeof x==='object'){hash.update(Array.isArray(x)?'[':'{');for(const k of Object.keys(x)){if(typeof x[k]==='function')continue;hash.update(k+'=');visit(x[k]);}hash.update('}');}else hash.update(typeof x+':'+String(x)+';');}visit(value);return hash.digest('hex');}
const expected=[
  {
    "graine": 11,
    "theme": "foret",
    "longueur": 4200,
    "sha256": "d13f5fc5f4d199aa4eb2d22ca5fd32a55990814ba8a6e7c8462d0b2e94953648",
    "sha256Darwin": "22ec2174f368c3f75b0e466ce820c7b3c767f67d3d09401382776aa7ffc1a7b9"
  },
  {
    "graine": 0,
    "theme": "foret",
    "longueur": 4200,
    "sha256": "a564643a418de3ebb0dfa738ec36e006bdde660f9df833571753221637070fb4"
  },
  {
    "graine": 96,
    "theme": "foret",
    "longueur": 4200,
    "sha256": "3c73c4e9f9ced6f01eb7e629d08464dc8801c3e02d9c9fa2b0601dc83cffe9ed",
    "sha256Darwin": "b88cc72b2edb2e60678ff62e18a5b45048a6431c05113b27a783269aabee60f0"
  },
  {
    "graine": 29,
    "theme": "cote",
    "longueur": 3600,
    "sha256": "8fc4f2d8c8e7c91a3dae13364117fd1e61bb3f86d48873d49f91cc7e79ddf511",
    "sha256Darwin": "0bfa08d019661be2943c903783d0abd3117ff313abbd44b091f94379f7a3e85c"
  },
  {
    "graine": 0,
    "theme": "cote",
    "longueur": 3600,
    "sha256": "2045959d71e1c6ef93108d4d24b46e38ccf37bb71144019b8daa41db55c85897"
  },
  {
    "graine": 96,
    "theme": "cote",
    "longueur": 3600,
    "sha256": "9caa3378123266e983a105369b2c5477bbd23ebf3d9689ba83272787b20189e9"
  },
  {
    "graine": 47,
    "theme": "montagne",
    "longueur": 5200,
    "sha256": "f40ba8339f49256cd32f10f9892395f954dd88041d47ac49348ccbe9392867cd",
    "sha256Darwin": "27dc4846c09c4fd5ff776faa6cdd8a4734edcd1deb962b02ac3de91c33634a45"
  },
  {
    "graine": 0,
    "theme": "montagne",
    "longueur": 5200,
    "sha256": "46930db97040bb1acd800c0a00e7689896cb249925663d91f4183784643dc2df",
    "sha256Darwin": "1f0cc32623faa03d2241fdd3ded1e514c02626a4a107ceb3e9d7cfccaf832915"
  },
  {
    "graine": 96,
    "theme": "montagne",
    "longueur": 5200,
    "sha256": "886f243dc03d78b89b0c0f0e534e009ef8e36a03a77a5dcd7441fa3bff3abb61",
    "sha256Darwin": "0e33056b3ea37f11484c68bfbbba1a66036e9ac69aedef18efc446b7c614e985"
  }
];
for(const {sha256,sha256Darwin,...spec} of expected){const c=B.circuit.creer(spec.graine,spec);const ref=process.platform==='darwin'?(sha256Darwin||sha256):sha256;assert.equal(digest(B.decor.construire(c)),ref,JSON.stringify(spec));}
console.log('décor : 9 géométries de référence inchangées');
