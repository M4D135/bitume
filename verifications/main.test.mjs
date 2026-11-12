// Vérifications de la main gantée (src/main.js) : pièces fermées, taille réelle, doigts serrés autour de la jante sans
// la traverser ni toucher la branche de 3 h, pouce couché sur la jante, dos tourné vers le dehors, poignet vers le pilote.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url)), req = createRequire(import.meta.url);
req(path.join(ici, '..', 'src', 'carene.js'));
req(path.join(ici, '..', 'src', 'main.js'));
const H = globalThis.BITUME.main, M = H.construire(), { R, r } = H.JANTE, BR = H.BRANCHE;

let compte = 0;
function verifier(nom, f) {
  try { f(); compte++; console.log(`ok  ${nom}`); } catch (e) { console.error(`FAIL ${nom}: ${e.message}`); process.exit(1); }
}

const PIECES = ['gant', 'paume', 'garde', 'poignet', 'sangle'];
const sous = (a, b) => a.map((v, k) => v - b[k]);
const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Distance à la surface du tube de la jante : tore de rayon R autour du moyeu (0, 0, R), section de rayon r.
const tore = p => Math.hypot(p[0], Math.hypot(p[1], p[2] - R) - R) - r;
const sommets = t => t.flatMap(tri => tri.slice(0, 3));
function boite(t) {
  const lo = [1, 1, 1], hi = [-1, -1, -1];
  for (const p of sommets(t)) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  return { lo, hi };
}

verifier('cinq pièces non vides, normales unitaires du côté de leur face', () => {
  for (const k of PIECES) {
    assert.ok(Array.isArray(M[k]) && M[k].length >= 60, `${k} : ${M[k] && M[k].length} triangles`);
    for (const tri of M[k]) {
      const nf = croix(sous(tri[1], tri[0]), sous(tri[2], tri[0]));
      for (let i = 3; i < 6; i++) {
        assert.ok(Math.abs(Math.hypot(...tri[i]) - 1) < 1e-9, `${k} : normale non unitaire`);
        assert.ok(scal(tri[i], nf) >= 0, `${k} : normale à l'envers`);
      }
    }
  }
});

verifier('taille réelle : 8 à 13 cm le long de la jante, 12 à 24 cm des doigts au bout de la manchette', () => {
  const { lo, hi } = boite(M.gant.concat(M.poignet));
  const large = hi[1] - lo[1], long = Math.hypot(hi[0] - lo[0], hi[2] - lo[2]);
  assert.ok(large > .08 && large < .13, `largeur le long de la jante ${large.toFixed(3)}`);
  assert.ok(long > .12 && long < .24, `longueur ${long.toFixed(3)}`);
});

verifier('aucune pièce ne traverse la jante de plus de 2 mm', () => {
  for (const k of PIECES) {
    const pire = Math.min(...sommets(M[k]).map(tore));
    assert.ok(pire > -.002, `${k} entre de ${(-pire * 1000).toFixed(1)} mm dans la jante`);
  }
});

verifier('aucune pièce dans la branche de 3 h', () => {
  for (const k of PIECES) {
    const dedans = sommets(M[k]).filter(p => Math.abs(p[1]) < BR.demi && p[0] > BR.dos && p[0] < BR.face && p[2] > 0);
    assert.equal(dedans.length, 0, `${k} : ${dedans.length} sommets dans la branche`);
  }
});

verifier('quatre doigts serrés, enroulés autour du tube par la planche, chaque point au contact (jeu de 1 mm au plus)', () => {
  assert.equal(M.points.doigts.length, 4);
  M.points.doigts.forEach((pts, i) => {
    const d = H.DOIGTS[i], autour = pts.slice(2);
    autour.forEach((p, j) => {
      const jeu = tore(p) - d.r * H.EFFILE[j + 2];
      assert.ok(jeu >= 0 && jeu < .001, `${d.nom}, point ${j} : jeu ${(jeu * 1000).toFixed(1)} mm`);
    });
    // rayon qui s'affine de la base au bout, sans renflement aux articulations
    for (let j = 1; j < H.EFFILE.length; j++) assert.ok(H.EFFILE[j] <= H.EFFILE[j - 1]);
    assert.ok(autour.some(p => p[0] < -r * .5), `${d.nom} : ne passe pas par la planche`);
    const bout = autour[autour.length - 1], rb = d.r * H.EFFILE[H.EFFILE.length - 1];
    if (Math.abs(d.s) > BR.demi) assert.ok(bout[2] > r * .5, `${d.nom} : le bout ne revient pas côté moyeu`);
    else assert.ok(bout[0] + rb < BR.dos, `${d.nom} : le bout touche la branche`);
  });
  // rangés le long de la jante, de l'index à l'auriculaire : entraxe de 1,9 à 2,2 cm, jour de 2 mm au plus
  for (let i = 1; i < 4; i++) {
    const a = H.DOIGTS[i - 1], b = H.DOIGTS[i], entraxe = a.s - b.s, jour = entraxe - a.r - b.r;
    assert.ok(entraxe > .019 && entraxe < .022 && jour >= 0 && jour < .002, `${a.nom} et ${b.nom} : entraxe ${entraxe.toFixed(4)}, jour ${jour.toFixed(4)}`);
  }
});

verifier('pouce couché sur la face de la jante tournée vers le pilote, devant la branche, qui remonte la jante', () => {
  const p = M.points.pouce, n = H.POUCE.eminence.length, rayons = H.POUCE.r;
  for (let j = n; j < p.length; j++) {
    const jeu = tore(p[j]) - rayons[j];
    assert.ok(jeu > 0 && jeu < .002, `pouce, point ${j} : jeu ${(jeu * 1000).toFixed(1)} mm`);
    assert.ok(p[j][0] > 0, `pouce, point ${j} : derrière la jante`);
    if (Math.abs(p[j][1]) < BR.demi + rayons[j]) assert.ok(p[j][0] - rayons[j] > BR.face, `pouce, point ${j} : dans la branche`);
    assert.ok(p[j][1] > p[j - 1][1], `pouce, point ${j} : ne remonte pas la jante`);
  }
  // jamais dressé : tout le pouce reste à moins de 3 cm de la surface du tube
  const loin = Math.max(...p.slice(n).map(tore));
  assert.ok(loin < .03, `pouce dressé à ${(loin * 100).toFixed(1)} cm de la jante`);
});

verifier('dos de la main tourné vers le dehors, poignet du côté du pilote, dans l’axe de la main', () => {
  // normale moyenne des faces du dos (les plus éloignées de la jante) : vers le dehors (−z), un peu vers le pilote
  const loin = M.gant.filter(tri => tore(tri[0]) > .018 && tri[0][0] > .02 && tri[0][0] < .08);
  const n = [0, 0, 0];
  for (const tri of loin) if (scal(tri[3], M.points.dos) > .5) for (let k = 0; k < 3; k++) n[k] += tri[3][k];
  assert.ok(n[2] < 0 && n[0] > 0 && -n[2] > 3 * n[0], `normale du dos ${n.map(v => v.toFixed(1))}`);
  assert.ok(M.points.poignet[0] > .06, `poignet à ${M.points.poignet[0].toFixed(3)} m du plan de la jante`);
  assert.ok(Math.abs(Math.hypot(...M.points.axe) - 1) < 1e-9 && M.points.axe[0] > .95, 'axe de la main vers le pilote');
});

console.log(`main : ${compte} vérifications passées`);
