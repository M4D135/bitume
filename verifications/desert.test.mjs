// Roche-Fauve : route praticable, relief minéral et solides stables selon saison/qualité.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const n of ['circuit', 'conduite', 'course', 'carene', 'ecologie', 'saisons', 'vegetation', 'decor']) require('../src/' + n + '.js');
const B = globalThis.BITUME, options = { theme: 'desert', longueur: 4800, nom: 'Roche-Fauve' };
const c = B.circuit.creer(107, options), ete = B.decor.construire(c, { qualite: 'high', saison: 'ete' });
const mesures = { longueur: c.longueur, denivelePiste: Math.max(...c.y) - Math.min(...c.y),
  penteMax: Math.max(...Array.from(c.pente, Math.abs)), arbres: ete.arbres.length,
  trianglesNappes: ete.nappes.reduce((n, v) => n + v.indices.length / 3, 0),
  objets: ete.lots.reduce((n, l) => n + l.objets.length, 0), lots: ete.lots.length };
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
function empreinte(objet) {
  const h = createHash('sha256');
  function visiter(v) {
    if (ArrayBuffer.isView(v)) { h.update(v.constructor.name); h.update(Buffer.from(v.buffer, v.byteOffset, v.byteLength)); }
    else if (v && typeof v === 'object') {
      h.update(Array.isArray(v) ? '[' : '{');
      for (const k of Object.keys(v)) { h.update(k); visiter(v[k]); }
      h.update('}');
    } else if (typeof v !== 'function') h.update(typeof v + ':' + String(v));
  }
  visiter(objet); return h.digest('hex');
}
function palette(d) {
  let total = 0, ocre = 0, plats = 0, neige = 0, min = Infinity, max = -Infinity;
  const couleurs = new Set();
  for (const n of d.nappes) if (n.surfaceType === 'terrain') for (let k = 0; k < n.sommets.length; k += 13) {
    const v = n.sommets; total++; min = Math.min(min, v[k + 1]); max = Math.max(max, v[k + 1]);
    if (v[k + 10] > v[k + 11] * 1.25 && v[k + 11] > v[k + 12] * 1.4) ocre++;
    couleurs.add([10, 11, 12].map(j => Math.round(v[k + j] * 32)).join(','));
    if (v[k + 4] > .7) { plats++; if (v[k + 10] > .8 && v[k + 11] > .8 && v[k + 12] > .8) neige++; }
  }
  return { ocre: ocre / total, neige: neige / plats, nuances: couleurs.size, relief: [min, max] };
}
function memeGeometrie(a, b) {
  assert.equal(a.nappes.length, b.nappes.length);
  for (let i = 0; i < a.nappes.length; i++) {
    assert.deepEqual(a.nappes[i].indices, b.nappes[i].indices);
    assert.equal(a.nappes[i].sommets.length, b.nappes[i].sommets.length);
    for (let k = 0; k < a.nappes[i].sommets.length; k += 13) {
      for (let j = 0; j < 6; j++) assert.equal(a.nappes[i].sommets[k + j], b.nappes[i].sommets[k + j]);
    }
  }
  assert.equal(empreinte(a.obstacles), empreinte(b.obstacles));
}

verifier('boucle fermée, départ droit, relief de piste maîtrisé', () => {
  assert.deepEqual(B.circuit.valider(c), []);
  assert.ok(Math.abs(c.longueur - 4800) < 4800 * .08);
  assert.ok(Math.hypot(c.x[0] - c.x[c.n - 1], c.z[0] - c.z[c.n - 1]) < 2.5);
  assert.ok(mesures.penteMax <= .068001);
  for (let s = -120; s <= 80; s += 2) assert.ok(Math.abs(B.circuit.echantillon(c, s).courbure) < 1 / 900);
  for (let i = 0; i < c.n; i++) {
    assert.ok(Number.isFinite(c.vitesse[i]) && c.vitesse[i] > 15 && c.vitesse[i] <= 86);
    assert.ok(Math.abs(c.ligne[i]) <= c.largeur / 2 - 1.4);
  }
});
verifier('terrain ocre varié, haut relief asymétrique, sans eau ni forêt', () => {
  assert.equal(ete.arbres.length, 0); assert.equal(ete.sourcesFeuilles.length, 0); assert.equal(ete.vegetation.brins, 0);
  assert.equal(ete.niveauEau, undefined);
  mesures.ete = palette(ete);
  assert.ok(mesures.ete.ocre > .85); assert.ok(mesures.ete.nuances > 30);
  assert.ok(mesures.ete.relief[1] - mesures.ete.relief[0] > 180);
  const x0 = Math.min(...c.x), x1 = Math.max(...c.x), z0 = Math.min(...c.z), z1 = Math.max(...c.z);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  let asymetrie = 0, echantillons = 0;
  for (let x = x0 - 900; x < x1 + 900; x += 120) for (let z = z0 - 900; z < z1 + 900; z += 120) {
    asymetrie += Math.abs(ete.sol(x, z) - ete.sol(2 * cx - x, 2 * cz - z)); echantillons++;
  }
  mesures.asymetrie = asymetrie / echantillons; assert.ok(mesures.asymetrie > 15);
  for (const n of ete.nappes) {
    assert.ok(n.sommets.every(Number.isFinite));
    assert.ok(n.indices.every(i => i < n.sommets.length / 13));
    for (let k = 9; k < n.sommets.length; k += 13) assert.notEqual(n.sommets[k], 12, 'aucune nappe d’eau');
  }
  for (const l of ete.lots) for (const o of l.objets) {
    assert.ok(o.p.every(Number.isFinite) && o.s.every(v => Number.isFinite(v) && v > 0));
    assert.ok(o.collision !== 'tronc' && o.shape !== 'foliage');
  }
});
verifier('rochers dégagés de toutes les portions de chaussée', () => {
  const rochers = ete.obstacles.filter(o => o.genre === 'roche'); mesures.rochers = rochers.length;
  assert.ok(rochers.length > 100 && rochers.length < 450);
  let distanceMin = Infinity;
  for (const o of rochers) {
    let proche = Infinity;
    for (let i = 0; i < c.n; i++) proche = Math.min(proche, Math.hypot(o.x - c.x[i], o.z - c.z[i]));
    const libre = proche - Math.hypot(o.hx, o.hz) - c.largeur / 2;
    distanceMin = Math.min(distanceMin, libre); assert.ok(libre > 25, 'grès trop près de la piste, y compris dans une épingle');
  }
  mesures.margeRochers = distanceMin;
});
verifier('saisons et qualité conservent géométrie et collisions', () => {
  for (const saison of ['printemps', 'automne', 'hiver']) {
    const d = B.decor.construire(c, { qualite: 'high', saison });
    assert.equal(d.saison.theme, 'desert'); assert.equal(d.saison.feuilles, false); assert.equal(d.saison.faune, 0);
    assert.equal(d.saison.neige, saison === 'hiver'); memeGeometrie(ete, d);
    if (saison === 'hiver') { mesures.hiver = palette(d); assert.ok(mesures.hiver.neige > .98); }
    else assert.ok(palette(d).ocre > .85, 'les hauts plateaux restent minéraux');
  }
  const bas = B.decor.construire(c, { qualite: 'low', saison: 'ete' });
  memeGeometrie(ete, bas); assert.equal(bas.arbres.length, 0); assert.equal(bas.vegetation.brins, 0);
  assert.equal(B.saisons.profil('hiver', 'cote').neige, false);
});
verifier('reconstruction déterministe du tracé et du décor', () => {
  const copie = B.circuit.creer(107, options);
  assert.equal(empreinte(copie), empreinte(c));
  assert.equal(empreinte(B.decor.construire(copie, { qualite: 'high', saison: 'ete' })), empreinte(ete));
});
verifier('onze rivaux accomplissent un tour sans rester bloqués', () => {
  const course = B.course.creer(c, { mode: 'course', tours: 1, difficulte: 1, rivaux: 11, graine: 42, placeJoueur: 12 });
  const commande = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  let temps = 0;
  while (temps < 300 && !course.termine) { B.course.pas(course, commande, 1 / 120); temps += 1 / 120; }
  const rivaux = course.voitures.filter(v => !v.joueur);
  assert.equal(rivaux.length, 11); assert.ok(rivaux.every(v => v.fini && v.tempsTours.length === 1));
  mesures.course = { rivauxArrives: rivaux.length, duree: temps };
});
console.log(JSON.stringify({ controles, mesures }));
