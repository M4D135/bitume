// Premier circuit mondial : plateau basaltique praticable, saisons et décor sans arbres.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const n of ['circuit', 'conduite', 'course', 'carene', 'ecologie', 'saisons', 'vegetation', 'decor']) require('../src/' + n + '.js');
const B = globalThis.BITUME;
const options = { theme: 'islande', longueur: 4600, nom: 'Lande-Noire' };
const c = B.circuit.creer(83, options);
const ete = B.decor.construire(c, { qualite: 'high', saison: 'ete' });
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
function palettes(decor) {
  let total = 0, sombre = 0, mousse = 0, plats = 0, neige = 0, min = Infinity, max = -Infinity;
  for (const n of decor.nappes) if (n.surfaceType === 'terrain') {
    const v = n.sommets;
    for (let k = 0; k < v.length; k += 13) {
      total++; min = Math.min(min, v[k + 1]); max = Math.max(max, v[k + 1]);
      if (v[k + 10] < .19 && v[k + 11] < .22) sombre++;
      if (v[k + 11] > v[k + 10] * 1.12 && v[k + 11] > v[k + 12] * 1.5) mousse++;
      if (v[k + 4] > .70) { plats++; if (v[k + 10] > .8 && v[k + 11] > .8 && v[k + 12] > .8) neige++; }
    }
  }
  return { sombre: sombre / total, mousse: mousse / total, neige: neige / plats, relief: [min, max] };
}

verifier('boucle fermée, départ droit et piste praticable', () => {
  assert.deepEqual(B.circuit.valider(c), []);
  assert.ok(Math.abs(c.longueur - 4600) < 4600 * .08);
  assert.ok(Math.hypot(c.x[0] - c.x[c.n - 1], c.z[0] - c.z[c.n - 1]) < 2.5);
  assert.ok(mesures.penteMax <= .068001);
  for (let s = -120; s <= 80; s += 2) assert.ok(Math.abs(B.circuit.echantillon(c, s).courbure) < 1 / 900);
  for (let i = 0; i < c.n; i++) {
    assert.ok(Number.isFinite(c.vitesse[i]) && c.vitesse[i] > 15 && c.vitesse[i] <= 86);
    assert.ok(Math.abs(c.ligne[i]) <= c.largeur / 2 - 1.4);
  }
});

verifier('reconstruction déterministe du tracé et du décor', () => {
  const copie = B.circuit.creer(83, options);
  assert.equal(empreinte(copie), empreinte(c));
  assert.equal(empreinte(B.decor.construire(copie, { qualite: 'high', saison: 'ete' })), empreinte(ete));
});

verifier('plateau sombre, mousse en poches et relief volcanique sans arbres', () => {
  assert.equal(ete.arbres.length, 0);
  assert.equal(ete.sourcesFeuilles.length, 0);
  assert.equal(ete.vegetation.brins, 0);
  for (const l of ete.lots) for (const o of l.objets) assert.ok(o.collision !== 'tronc' && o.shape !== 'foliage');
  mesures.ete = palettes(ete);
  assert.ok(mesures.ete.sombre > .5, 'le plateau reste majoritairement basaltique');
  assert.ok(mesures.ete.mousse > .05 && mesures.ete.mousse < .5, 'mousses présentes en poches');
  assert.ok(mesures.ete.relief[1] - mesures.ete.relief[0] > 100, 'silhouettes volcaniques visibles');
});

verifier('blocs de basalte et leurs solides restent hors de toute portion de piste', () => {
  const rochers = ete.obstacles.filter(o => o.genre === 'roche');
  mesures.rochers = rochers.length;
  assert.ok(rochers.length > 100 && rochers.length < 600);
  let distanceMin = Infinity;
  for (const o of rochers) {
    let proche = Infinity;
    for (let i = 0; i < c.n; i++) proche = Math.min(proche, Math.hypot(o.x - c.x[i], o.z - c.z[i]));
    const libre = proche - Math.hypot(o.hx, o.hz) - c.largeur / 2;
    distanceMin = Math.min(distanceMin, libre);
    assert.ok(libre > 20, 'basalte trop près de la chaussée, y compris dans une épingle');
  }
  mesures.margeRochers = distanceMin;
});

verifier('saisons sans déplacement des solides, neige sur les surfaces hivernales', () => {
  for (const saison of ['printemps', 'automne', 'hiver']) {
    const d = B.decor.construire(c, { qualite: 'high', saison });
    assert.equal(d.saison.theme, 'islande');
    assert.equal(d.saison.feuilles, false);
    assert.equal(d.saison.neige, saison === 'hiver');
    assert.equal(d.arbres.length, 0);
    assert.equal(empreinte(d.obstacles), empreinte(ete.obstacles));
    assert.equal(d.nappes.length, ete.nappes.length);
    for (let i = 0; i < d.nappes.length; i++) {
      assert.deepEqual(d.nappes[i].indices, ete.nappes[i].indices);
      for (let k = 0; k < d.nappes[i].sommets.length; k += 13) {
        for (let a = 0; a < 6; a++) assert.equal(d.nappes[i].sommets[k + a], ete.nappes[i].sommets[k + a]);
      }
    }
    if (saison === 'hiver') { mesures.hiver = palettes(d); assert.ok(mesures.hiver.neige > .98); }
  }
  assert.equal(B.saisons.profil('hiver', 'cote').neige, false, 'Port-Sable conserve son exception');
});

verifier('qualité basse conserve le même terrain et les mêmes obstacles', () => {
  const d = B.decor.construire(c, { qualite: 'low', saison: 'ete' });
  assert.equal(d.arbres.length, 0);
  assert.equal(empreinte(d.obstacles), empreinte(ete.obstacles));
  assert.equal(d.nappes.reduce((n, v) => n + v.indices.length, 0) / 3, mesures.trianglesNappes);
});

verifier('les onze rivaux accomplissent un tour du nouveau circuit', () => {
  const course = B.course.creer(c, { mode: 'course', tours: 1, difficulte: 1, rivaux: 11, graine: 42, placeJoueur: 12 });
  const commande = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  let temps = 0;
  while (temps < 300 && !course.termine) { B.course.pas(course, commande, 1 / 120); temps += 1 / 120; }
  const rivaux = course.voitures.filter(v => !v.joueur);
  assert.equal(rivaux.length, 11);
  assert.ok(rivaux.every(v => v.fini && v.tempsTours.length === 1), 'aucun rival bloqué sur le circuit');
  mesures.course = { rivauxArrives: rivaux.length, duree: temps };
});

console.log(JSON.stringify({ controles, mesures }));
