// Cap-Séquoia : la côte, ses grands arbres et les saisons gardent une route praticable.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
const require = createRequire(import.meta.url);
// La comparaison avec/sans botanique doit porter sur le même décor. Ces dépendances de decor.js
// sont automatiques en CommonJS, mais pas dans le contexte navigateur simulé par la VM.
const MODULES_DECOR = ['carene', 'ecologie', 'saisons', 'vegetation',
  'chaussee', 'virages', 'baikal', 'batiments', 'decor'];
for (const n of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course', ...MODULES_DECOR]) require('../src/' + n + '.js');
const B = globalThis.BITUME, options = { theme: 'pacifique', longueur: 5200, nom: 'Cap-Séquoia' };
const c = B.circuit.creer(157, options), ete = B.decor.construire(c, { qualite: 'high', saison: 'ete' });
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
function terrain(d) {
  let total = 0, immerges = 0, plats = 0, neige = 0, min = Infinity, max = -Infinity;
  const couleurs = new Set();
  for (const n of d.nappes) if (n.surfaceType === 'terrain') for (let k = 0; k < n.sommets.length; k += 13) {
    const v = n.sommets; total++; min = Math.min(min, v[k + 1]); max = Math.max(max, v[k + 1]);
    if (v[k + 1] < d.niveauEau) immerges++;
    couleurs.add([10, 11, 12].map(j => Math.round(v[k + j] * 32)).join(','));
    if (v[k + 4] > .7 && v[k + 1] > d.niveauEau) {
      plats++; if (v[k + 10] > .8 && v[k + 11] > .8 && v[k + 12] > .8) neige++;
    }
  }
  return { partImmergee: immerges / total, neige: neige / plats, nuances: couleurs.size, relief: [min, max] };
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
  assert.equal(a.niveauEau, b.niveauEau);
}
function verifierTroncsLointains(d) {
  const cle = o => o.p.join(','), proches = new Map(), lointains = new Map();
  for (const lot of d.lots) {
    const pres = lot.objets.filter(o => o.collision === 'tronc'), loin = lot.loin.filter(o => o.collision === 'tronc');
    assert.equal(pres.length, loin.length, 'chaque lot garde ses troncs au changement de détail');
    for (const [liste, index] of [[pres, proches], [loin, lointains]]) for (const o of liste) {
      assert.ok(!index.has(cle(o)), 'un seul tronc par arbre et par niveau de détail');
      index.set(cle(o), o);
    }
  }
  assert.equal(proches.size, d.arbres.length); assert.equal(lointains.size, d.arbres.length);
  const solides = d.obstacles.filter(o => o.genre === 'tronc');
  assert.equal(solides.length, proches.size, 'le tronc lointain ne crée pas une seconde collision');
  const collisions = new Set(solides.map(o => o.p ? o.p.join(',') : [o.x, (o.ymin + o.ymax) / 2, o.z].join(',')));
  assert.equal(collisions.size, proches.size, 'une seule collision à chaque position de tronc');
  for (const [position, proche] of proches) {
    const loin = lointains.get(position);
    assert.ok(loin && collisions.has(position), 'tronc proche, lointain et solide au même endroit');
    assert.equal(loin.shape, proche.shape);
    assert.deepEqual(loin.p, proche.p); assert.deepEqual(loin.s, proche.s); assert.deepEqual(loin.r, proche.r);
    assert.ok(proche.s[1] <= 50, 'le tronc partagé ne doit pas être agrandi deux fois');
  }
  return { proches: proches.size, lointains: lointains.size, collisions: collisions.size };
}

verifier('septième circuit, sans déplacer les identifiants et graines des six précédents', () => {
  const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
  const declaration = source.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0];
  const catalogue = new Function(declaration + '; return CATALOGUE;')();
  assert.deepEqual(catalogue.slice(0, 6).map(k => [k.id, k.graine, k.longueur]), [
    ['val-brule', 11, 4200], ['port-sable', 29, 3600], ['haut-col', 47, 5200],
    ['lande-noire', 83, 4600], ['roche-fauve', 107, 4800], ['brume-de-jade', 131, 5000]
  ]);
  assert.equal(catalogue.findIndex(k => k.id === 'cap-sequoia'), 6);
  assert.deepEqual([catalogue[6].nom, catalogue[6].theme, catalogue[6].graine, catalogue[6].longueur],
    [options.nom, options.theme, 157, options.longueur]);
});
verifier('boucle fermée et trajectoire praticable, départ en ligne droite', () => {
  assert.deepEqual(B.circuit.valider(c), []);
  assert.ok(c.longueur >= 5000 && c.longueur <= 5500);
  assert.ok(Math.hypot(c.x[0] - c.x[c.n - 1], c.z[0] - c.z[c.n - 1]) < 2.5);
  assert.ok(mesures.penteMax <= .068001);
  for (let s = -120; s <= 80; s += 2) assert.ok(Math.abs(B.circuit.echantillon(c, s).courbure) < 1 / 900);
  for (let i = 0; i < c.n; i++) {
    assert.ok(Number.isFinite(c.vitesse[i]) && c.vitesse[i] > 15 && c.vitesse[i] <= 86);
    assert.ok(Math.abs(c.ligne[i]) <= c.largeur / 2 - 1.4);
  }
});
verifier('océan visible, route émergée et falaises asymétriques', () => {
  assert.ok(Number.isFinite(ete.niveauEau), 'niveau marin présent');
  const eau = ete.nappes.filter(n => n.sommets.length && n.sommets[9] === 12);
  assert.ok(eau.length > 0, 'plan marin dessiné');
  for (let i = 0; i < c.n; i++) {
    const bordBas = c.y[i] - c.largeur / 2 * Math.abs(Math.sin(c.devers[i]));
    assert.ok(bordBas > ete.niveauEau + 1, 'chaussée au-dessus de la mer');
  }
  mesures.ete = terrain(ete);
  assert.ok(mesures.ete.partImmergee > .03 && mesures.ete.partImmergee < .85, 'côte séparant terre et mer');
  assert.ok(mesures.ete.relief[1] - mesures.ete.relief[0] > 60, 'falaises distinctes du littoral plat');
  assert.ok(mesures.ete.nuances > 25, 'clairières et roche ne forment pas un aplat unique');
  const x0 = Math.min(...c.x), x1 = Math.max(...c.x), z0 = Math.min(...c.z), z1 = Math.max(...c.z);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  let asymetrie = 0, echantillons = 0;
  for (let x = x0 - 800; x < x1 + 800; x += 160) for (let z = z0 - 800; z < z1 + 800; z += 160) {
    asymetrie += Math.abs(ete.sol(x, z) - ete.sol(2 * cx - x, 2 * cz - z)); echantillons++;
  }
  mesures.asymetrie = asymetrie / echantillons; assert.ok(mesures.asymetrie > 10);
});
verifier('grands conifères bornés, géométrie finie et absence de brins supplémentaires', () => {
  assert.ok(ete.arbres.length > 10 && ete.arbres.length < 500, 'bosquets présents et bornés');
  assert.equal(ete.vegetation.brins, 0);
  const troncs = ete.lots.flatMap(l => l.objets).filter(o => o.collision === 'tronc');
  assert.equal(troncs.length, ete.arbres.length);
  mesures.hauteurTroncMax = Math.max(...troncs.map(o => o.s[1]));
  assert.ok(mesures.hauteurTroncMax > 20, 'silhouette de grands arbres');
  assert.ok(mesures.trianglesNappes < 200000, 'relief borné aux nappes statiques');
  for (const n of ete.nappes) {
    assert.ok(n.sommets.every(Number.isFinite));
    assert.ok(n.indices.every(i => i >= 0 && i < n.sommets.length / 13));
  }
  for (const l of ete.lots) for (const o of l.objets) {
    assert.ok(o.p.every(Number.isFinite) && o.s.every(v => Number.isFinite(v) && v > 0));
  }
});
verifier('chaque grand tronc reste visible au loin avec une seule collision', () => {
  mesures.troncsLod = verifierTroncsLointains(ete);
});
verifier('la vraie botanique garde aussi les troncs proches et lointains identiques', () => {
  // Contexte séparé : activer les couronnes de production ne change pas les autres contrôles de cette suite.
  const contexte = createContext({});
  for (const module of ['circuit', ...MODULES_DECOR, 'botanique']) {
    runInContext(readFileSync(new URL('../src/' + module + '.js', import.meta.url), 'utf8'), contexte, { filename: module + '.js' });
  }
  const prod = contexte.BITUME, circuit = prod.circuit.creer(157, options);
  const decor = prod.decor.construire(circuit, { qualite: 'high', saison: 'ete' });
  assert.ok(prod.baikal && prod.batiments && decor.architecture, 'mêmes modules de décor dans Node et la VM');
  assert.equal(JSON.stringify(decor.architecture), JSON.stringify(ete.architecture), 'mêmes sites architecturaux avec/sans botanique');
  const pres = prod.botanique.nomForme('conifere', false, 'high'), loin = prod.botanique.nomForme('conifere', true, 'high');
  assert.equal(decor.lots.reduce((n, l) => n + l.objets.filter(o => o.shape === pres).length, 0), decor.arbres.length);
  assert.equal(decor.lots.reduce((n, l) => n + l.loin.filter(o => o.shape === loin).length, 0), decor.arbres.length);
  mesures.troncsLodBotanique = verifierTroncsLointains(decor);
  assert.equal(empreinte(decor.obstacles), empreinte(ete.obstacles), 'la botanique ne change ni la taille ni les collisions');
});
verifier('solides réels acceptés et grands troncs dégagés de toutes les portions de chaussée', () => {
  const solides = B.obstacles.creer(ete.obstacles).objets;
  assert.equal(solides.length, ete.obstacles.length, 'aucun solide rejeté silencieusement');
  const naturels = solides.filter(o => o.genre === 'tronc' || o.genre === 'roche');
  mesures.rochers = naturels.filter(o => o.genre === 'roche').length;
  let margeArbres = Infinity, margeRochers = Infinity;
  for (const o of naturels) {
    // Le rayon conservateur du prisme comprend l'inclinaison et toute la hauteur du tronc.
    const rayon = o.type === 'prism' ? Math.max(...o.sommets.map(v => Math.hypot(v[0], v[2])))
      : o.type === 'circle' ? o.r : Math.hypot(o.hx, o.hz);
    let proche = Infinity;
    for (let i = 0; i < c.n; i++) proche = Math.min(proche, Math.hypot(o.x - c.x[i], o.z - c.z[i]));
    const libre = proche - rayon - c.largeur / 2;
    assert.ok(libre > 8, o.genre + ' trop près de la piste : ' + libre);
    if (o.genre === 'tronc') margeArbres = Math.min(margeArbres, libre);
    else margeRochers = Math.min(margeRochers, libre);
  }
  mesures.margeArbres = margeArbres; mesures.margeRochers = margeRochers;
});
verifier('quatre saisons gardent route, mer, arbres et collisions ; hiver enneigé', () => {
  const palettes = new Set([empreinte(ete.nappes.map(n => n.sommets))]);
  for (const saison of ['printemps', 'automne', 'hiver']) {
    const d = B.decor.construire(c, { qualite: 'high', saison });
    assert.equal(d.saison.theme, 'pacifique'); assert.equal(d.saison.neige, saison === 'hiver');
    memeGeometrie(ete, d); palettes.add(empreinte(d.nappes.map(n => n.sommets)));
    if (saison === 'hiver') { mesures.hiver = terrain(d); assert.ok(mesures.hiver.neige > .85, 'neige sur terre émergée peu inclinée'); }
  }
  assert.equal(palettes.size, 4, 'les quatre saisons changent les couleurs du terrain');
  assert.equal(B.saisons.profil('hiver', 'cote').neige, false, 'exception Port-Sable conservée');
});
verifier('Low conserve relief, arbres et collisions de High', () => {
  const d = B.decor.construire(c, { qualite: 'low', saison: 'ete' });
  memeGeometrie(ete, d); assert.equal(d.vegetation.brins, 0); verifierTroncsLointains(d);
});
verifier('reconstruction déterministe du tracé et du décor', () => {
  const copie = B.circuit.creer(157, options);
  assert.equal(empreinte(copie), empreinte(c));
  assert.equal(empreinte(B.decor.construire(copie, { qualite: 'high', saison: 'ete' })), empreinte(ete));
});
verifier('onze rivaux font un tour avec les contacts et solides réels du décor', () => {
  c.obstacles = B.obstacles.creer(ete.obstacles);
  const course = B.course.creer(c, { mode: 'course', tours: 1, difficulte: 1, rivaux: 11, graine: 42, placeJoueur: 12 });
  const commande = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  let temps = 0;
  while (temps < 360 && !course.termine) { B.course.pas(course, commande, 1 / 120); temps += 1 / 120; }
  const rivaux = course.voitures.filter(v => !v.joueur);
  assert.equal(rivaux.length, 11); assert.ok(rivaux.every(v => v.fini && v.tempsTours.length === 1));
  mesures.course = { rivauxArrives: rivaux.length, duree: temps, solidesActifs: c.obstacles.objets.length };
});
console.log(JSON.stringify({ controles, mesures }));
