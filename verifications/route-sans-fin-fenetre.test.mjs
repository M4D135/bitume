// Fenêtre glissante de la Route sans fin : suit les joueurs, mémoire bornée, déterministe,
// traduction absolue ↔ fenêtre cohérente, station active rendue dans le repère du circuit.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const req = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const m of ['circuit', 'route-sans-fin', 'route-sans-fin-fenetre']) req(path.join(ROOT, 'src', m + '.js'));
const B = globalThis.BITUME, F = B.routeSansFinFenetre;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok ' + nom); };
const GRAINE = 271828;

verifier('la fenêtre naît au départ et couvre la marge de tête', () => {
  const f = F.creer(GRAINE);
  assert.equal(f.k0, 0);
  assert.ok(f.c && f.c.ouvert, 'aucun circuit ouvert produit');
  assert.ok(f.longueur >= f.devant, 'fenêtre trop courte au départ : ' + f.longueur);
  assert.ok(f.k1 - f.k0 <= f.maxSegments, 'plus de tronçons que le plafond : ' + (f.k1 - f.k0));
});

verifier('la fenêtre suit le joueur et libère derrière lui', () => {
  const f = F.creer(GRAINE);
  let s = 0;
  for (let i = 0; i < 40; i++) {
    s += 250;
    F.avancer(f, [s]);
    assert.ok(s - f.sOrigine >= 0 && s - f.sOrigine <= f.longueur, 'joueur hors fenêtre à ' + s);
    assert.ok(f.k1 - f.k0 <= f.maxSegments, 'mémoire non bornée à ' + s + ' : ' + (f.k1 - f.k0) + ' tronçons');
    assert.ok(f.sOrigine <= s, 'origine passée devant le joueur');
  }
  assert.ok(f.k0 > 2, 'la fenêtre n’a jamais libéré de tronçon (k0 = ' + f.k0 + ')');
});

verifier('la fenêtre couvre le plus éloigné des quatre joueurs', () => {
  const f = F.creer(GRAINE, { maxSegments: 8 });
  F.avancer(f, [1200, 1500, 9000, 1700]);
  for (const s of [1200, 1500, 9000, 1700]) {
    const d = s - f.sOrigine;
    assert.ok(d >= -1e-6 && d <= f.longueur, 'joueur ' + s + ' hors fenêtre (' + d + ')');
  }
});

verifier('la traduction absolue ↔ fenêtre est cohérente avec le circuit', () => {
  const f = F.creer(GRAINE);
  F.avancer(f, [5200]);
  const q = B.circuit.echantillon(f.c, F.sFenetre(f, 5200));
  assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.cap));
  // le point de la fenêtre correspond à la même géométrie que la trace absolue
  const absolu = B.routeSansFin.creerTrace(0, 12, GRAINE).points;
  const i = Math.round(5200 / B.routeSansFin.PAS);
  const p = absolu.find(pt => Math.abs(pt.x - q.x) < 1 && Math.abs(pt.z - q.z) < 1);
  assert.ok(p, 'le point à 5 200 m absents de la trace absolue — repères incohérents');
});

verifier('deux fenêtres avec les mêmes positions donnent le même circuit', () => {
  const a = F.creer(GRAINE), b = F.creer(GRAINE);
  for (const s of [800, 2600, 5200, 7400]) F.avancer(a, [s]);
  F.avancer(b, [7400]);   // directement à la position finale, sans étapes intermédiaires
  assert.equal(a.k0, b.k0); assert.equal(a.k1, b.k1); assert.equal(a.sOrigine, b.sOrigine);
  assert.equal(JSON.stringify(a.c.x), JSON.stringify(b.c.x));
});

verifier('la station active est rendue dans le repère du circuit courant', () => {
  const f = F.creer(GRAINE, { maxSegments: 8 });
  F.avancer(f, [300]);
  const st = F.stationActive(f, 300);
  assert.ok(st, 'aucune station devant le joueur de départ');
  assert.ok(st.debut >= 0 && st.fin <= f.longueur + f.devant + 1, 'station hors de la fenêtre : ' + JSON.stringify(st));
  assert.ok(st.fin - st.debut >= B.routeSansFin.LONG_STATION - 1e-6);
});

console.log(n + ' contrôles de fenêtre sans fin passés');
