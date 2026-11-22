import { definitionHistorique, historiques } from './helpers/catalogue-historique.mjs';
// Brume-de-Jade : circuit original, relief en pics/terrasses, bosquets et saisons stables.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
for (const n of ['circuit', 'conduite', 'course', 'carene', 'ecologie', 'saisons', 'vegetation', 'decor']) require('../src/' + n + '.js');
const B = globalThis.BITUME, options = { theme: 'asie', longueur: 5000, nom: 'Brume-de-Jade' };
const c = B.circuit.creer(131, options), ete = B.decor.construire(c, { qualite: 'high', saison: 'ete' });
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
  let total = 0, jade = 0, plats = 0, neige = 0, min = Infinity, max = -Infinity;
  const couleurs = new Set();
  for (const n of d.nappes) if (n.surfaceType === 'terrain') for (let k = 0; k < n.sommets.length; k += 13) {
    const v = n.sommets; total++; min = Math.min(min, v[k + 1]); max = Math.max(max, v[k + 1]);
    if (v[k + 11] > v[k + 10] * 1.08 && v[k + 11] > v[k + 12] * 1.08) jade++;
    couleurs.add([10, 11, 12].map(j => Math.round(v[k + j] * 32)).join(','));
    if (v[k + 4] > .7) { plats++; if (v[k + 10] > .8 && v[k + 11] > .8 && v[k + 12] > .8) neige++; }
  }
  return { jade: jade / total, neige: neige / plats, nuances: couleurs.size, relief: [min, max] };
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
  assert.deepEqual(a.arbres, b.arbres);
  assert.equal(empreinte(a.obstacles), empreinte(b.obstacles));
}

verifier('catalogue actuel et définitions historiques de brume-de-jade', () => {
  const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
  const declaration = source.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0];
  const catalogue = new Function(declaration + '; return CATALOGUE;')();
  assert.deepEqual(historiques.slice(0, 5).map(h => definitionHistorique(catalogue, h.id)).map(k => [k.id, k.graine, k.longueur]), [
    ['val-brule', 11, 4200], ['port-sable', 29, 3600], ['haut-col', 47, 5200],
    ['lande-noire', 83, 4600], ['roche-fauve', 107, 4800]
  ]);
  const selection = catalogue.filter(k => k.id === 'brume-de-jade');
  assert.equal(selection.length, 1);
  const [k] = selection;
  assert.deepEqual([k.nom, k.theme, k.graine, k.longueur],
    [options.nom, options.theme, 131, options.longueur]);
});
verifier('boucle fermée, départ droit, pente et trajectoire praticables', () => {
  assert.deepEqual(B.circuit.valider(c), []);
  assert.ok(c.longueur >= 4800 && c.longueur <= 5300);
  assert.ok(Math.hypot(c.x[0] - c.x[c.n - 1], c.z[0] - c.z[c.n - 1]) < 2.5);
  assert.ok(mesures.penteMax <= .068001);
  for (let s = -120; s <= 80; s += 2) assert.ok(Math.abs(B.circuit.echantillon(c, s).courbure) < 1 / 900);
  for (let i = 0; i < c.n; i++) {
    assert.ok(Number.isFinite(c.vitesse[i]) && c.vitesse[i] > 15 && c.vitesse[i] <= 86);
    assert.ok(Math.abs(c.ligne[i]) <= c.largeur / 2 - 1.4);
  }
});
verifier('terrain jade varié et relief asymétrique, bosquets bornés', () => {
  assert.ok(ete.arbres.length > 0 && ete.arbres.length < 200, 'bosquets présents et coût borné');
  assert.equal(ete.vegetation.brins, 0, 'les terrasses sont dessinées dans les nappes');
  mesures.ete = palette(ete);
  assert.ok(mesures.ete.jade > .15, 'végétation jade présente dans les nappes');
  assert.ok(mesures.ete.nuances > 30);
  assert.ok(mesures.ete.relief[1] - mesures.ete.relief[0] > 150, 'pics visibles au-dessus de la vallée');
  const x0 = Math.min(...c.x), x1 = Math.max(...c.x), z0 = Math.min(...c.z), z1 = Math.max(...c.z);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  let asymetrie = 0, echantillons = 0;
  for (let x = x0 - 900; x < x1 + 900; x += 120) for (let z = z0 - 900; z < z1 + 900; z += 120) {
    asymetrie += Math.abs(ete.sol(x, z) - ete.sol(2 * cx - x, 2 * cz - z)); echantillons++;
  }
  mesures.asymetrie = asymetrie / echantillons; assert.ok(mesures.asymetrie > 10);
  for (const n of ete.nappes) {
    assert.ok(n.sommets.every(Number.isFinite));
    assert.ok(n.indices.every(i => i < n.sommets.length / 13));
  }
  for (const l of ete.lots) for (const o of l.objets) {
    assert.ok(o.p.every(Number.isFinite) && o.s.every(v => Number.isFinite(v) && v > 0));
  }
});
verifier('rochers et troncs hors de toutes les portions de chaussée', () => {
  const rochers = ete.obstacles.filter(o => o.genre === 'roche'), troncs = ete.obstacles.filter(o => o.genre === 'tronc');
  mesures.rochers = rochers.length; assert.ok(rochers.length > 0 && rochers.length < 300);
  assert.equal(troncs.length, ete.arbres.length, 'pas de tronc invisible résiduel');
  let margeRochers = Infinity, margeArbres = Infinity;
  for (const o of [...rochers, ...troncs]) {
    const x = o.type === 'prism' ? o.p[0] : o.x, z = o.type === 'prism' ? o.p[2] : o.z;
    const rayon = o.type === 'prism' ? Math.hypot(o.s[0], o.s[2]) / 2 : o.type === 'circle' ? o.r : Math.hypot(o.hx, o.hz);
    let proche = Infinity;
    for (let i = 0; i < c.n; i++) proche = Math.min(proche, Math.hypot(x - c.x[i], z - c.z[i]));
    const libre = proche - rayon - c.largeur / 2;
    if (o.genre === 'roche') { margeRochers = Math.min(margeRochers, libre); assert.ok(libre > 25, 'calcaire trop près de la piste'); }
    else { margeArbres = Math.min(margeArbres, libre); assert.ok(libre > 10, 'tronc trop près de la piste'); }
  }
  mesures.margeRochers = margeRochers; mesures.margeArbres = margeArbres;
});
verifier('quatre saisons sans déplacement de la route, des arbres ou des solides', () => {
  const couleurs = new Set([empreinte(ete.lots.map(l => l.objets.map(o => o.color)))]);
  for (const saison of ['printemps', 'automne', 'hiver']) {
    const d = B.decor.construire(c, { qualite: 'high', saison });
    assert.equal(d.saison.theme, 'asie'); assert.equal(d.saison.feuilles, saison === 'automne');
    assert.equal(d.saison.neige, saison === 'hiver'); memeGeometrie(ete, d);
    couleurs.add(empreinte(d.lots.map(l => l.objets.map(o => o.color))));
    if (saison === 'automne') assert.ok(d.sourcesFeuilles.length > 0 && d.sourcesFeuilles.length <= d.arbres.length);
    if (saison === 'hiver') { mesures.hiver = palette(d); assert.ok(mesures.hiver.neige > .9, 'neige sur les surfaces peu inclinées'); }
  }
  assert.equal(couleurs.size, 4, 'quatre palettes de feuillage distinctes');
  assert.equal(B.saisons.profil('hiver', 'cote').neige, false, 'exception Port-Sable conservée');
});
verifier('qualité basse conserve le terrain, les arbres et les collisions', () => {
  const d = B.decor.construire(c, { qualite: 'low', saison: 'ete' });
  memeGeometrie(ete, d); assert.equal(d.vegetation.brins, 0);
});
verifier('tracé et décor se reconstruisent sans dépendre du hasard global', () => {
  const copie = B.circuit.creer(131, options);
  assert.equal(empreinte(copie), empreinte(c));
  assert.equal(empreinte(B.decor.construire(copie, { qualite: 'high', saison: 'ete' })), empreinte(ete));
});
verifier('onze rivaux accomplissent un tour sans rester bloqués', () => {
  const course = B.course.creer(c, { mode: 'course', tours: 1, difficulte: 1, rivaux: 11, graine: 42, placeJoueur: 12 });
  const commande = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  let temps = 0;
  while (temps < 330 && !course.termine) { B.course.pas(course, commande, 1 / 120); temps += 1 / 120; }
  const rivaux = course.voitures.filter(v => !v.joueur);
  assert.equal(rivaux.length, 11); assert.ok(rivaux.every(v => v.fini && v.tempsTours.length === 1));
  mesures.course = { rivauxArrives: rivaux.length, duree: temps };
});
console.log(JSON.stringify({ controles, mesures }));
