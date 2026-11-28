// Pistes fluides et sauts voulus (chantier 4, David 28/11 : « rend les plus fluides à emprunter avec une f1, ajoute
// quelque petit endroits propices aux sauts »). Chaque circuit du catalogue est construit comme jeu.js : adoucirRelief,
// puis poserSauts selon le catalogue. Hors sauts et hors stands, à la consigne de l'IA, aucune crête n'allège plus de
// 0,4 g ni aucun creux ne comprime plus de 0,8 g (règle du 18/11). Chaque saut est posé sur une droite rapide, loin de
// la ligne, des stands, des ponts, des tunnels et des bords dangereux, à plat latéralement à la réception, annoncé par
// quatre panneaux, et la F1 y décolle réellement sous PhysX, sans accident ni replacement. La Route sans fin tire de
// même, par tronçon, une crête occasionnelle sur les longues droites de plaine et de montagne, que les stations-service
// évitent et que chaque fenêtre porte à l'abscisse exacte. Enfin, l'enrobé ne se plie plus en diagonale là où le
// dévers tourne (anneau à 40° des Alizés) : pli de 1 cm au plus entre deux rangées.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'route-des-cimes', 'larche-vinadio-data', 'larche-vinadio', 'larche-vinadio-decor', 'marseille',
  'marseille-decor', 'circuit-raccords-data', 'circuit-raccords', 'conduite', 'degats', 'contacts', 'obstacles', 'botanique', 'ecologie',
  'saisons', 'vegetation', 'bords', 'carene', 'decor', 'meteo', 'strategie-stands', 'course', 'solides-physx', 'physique', 'route-sans-fin',
  'route-sans-fin-fenetre']) require('../src/' + f + '.js');
const B = globalThis.BITUME, G = 9.81;
const JEU = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const CATALOGUE = vm.runInNewContext('(' + JEU.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1] + ')');
const reglage = k => typeof k.sauts === 'number' ? { nombre: k.sauts } : k.sauts || null;
function construire(k, { sauts = true } = {}) {
  const c = k.troncons ? B.raccords.creer(k) : k.id === 'larche' ? B.larche.creer(k.graine) : k.id === 'marseille' ? B.marseille.creer(k.graine)
    : B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom, partition: k.partition });
  c.nom = k.nom;
  c.reliefAdouci = B.circuit.adoucirRelief(c);
  if (sauts && k.sauts) B.circuit.poserSauts(c, reglage(k));
  return c;
}
const circuits = new Map(CATALOGUE.map(k => [k.id, construire(k)]));
const pasDe = c => c.longueur / (c.ouvert ? c.n - 1 : c.n);
const idx = (c, j) => c.ouvert ? Math.max(0, Math.min(c.n - 1, j)) : ((j % c.n) + c.n) % c.n;
const dansSaut = (c, s) => (c.sauts || []).some(z => s >= z.debut && s <= z.fin);
let controles = 0;

test('jeu.js adoucit chaque circuit, puis pose les sauts du catalogue avant les bords', () => {
  const corps = JEU.slice(JEU.indexOf('function circuit(i) {'), JEU.indexOf('function nombreVirages('));
  const a = corps.indexOf('B.circuit.adoucirRelief(circuits[i])');
  const p = corps.indexOf("B.circuit.poserSauts(circuits[i], typeof k.sauts === 'number' ? { nombre: k.sauts } : k.sauts)");
  const b = corps.indexOf('B.bords.limites(circuits[i]');
  assert.ok(a > 0 && p > a && b > p, 'ordre attendu : adoucirRelief, poserSauts, bords');
  assert.deepEqual(Object.fromEntries(CATALOGUE.filter(k => k.sauts).map(k => [k.id, reglage(k).nombre])),
    { 'forets-du-pacifique': 2, sierra: 1, 'nord-atlantique': 2, 'route-des-cimes': 1, larche: 3, baikal: 1 });
  controles++;
});

test('relief : hors sauts et stands, 0,4 g de crête et 0,8 g de creux au plus à la consigne de l’IA, sur les neuf circuits', () => {
  for (const [id, c] of circuits) {
    const ds = pasDe(c), S = c.stands;
    assert.ok(c.reliefAdouci && c.reliefAdouci.residu < 1e-6, id + ' : adoucissement inachevé ' + JSON.stringify(c.reliefAdouci));
    let pire = 0, vus = 0;
    for (let i = c.ouvert ? 1 : 0; i < (c.ouvert ? c.n - 1 : c.n); i++) {
      const s = i * ds;
      if (dansSaut(c, s) || (S && s >= S.debut - 21 && s <= S.fin + 21)) continue;
      const kv = (c.y[idx(c, i - 1)] - 2 * c.y[i] + c.y[idx(c, i + 1)]) / (ds * ds), v2 = Math.max(15, c.vitesse[i]) ** 2;
      pire = Math.max(pire, -.4 * G / v2 - kv, kv - .8 * G / v2); vus++;
    }
    assert.ok(pire < 2e-6, id + ' : courbure verticale hors règle de ' + pire);
    assert.ok(vus > c.n * .7, id + ' : trop peu d’échantillons contrôlés');   // l’Ovale garde 24 % de stands
  }
  controles++;
});

test('sauts : nombre voulu, droite rapide, loin des ouvrages, bosse exacte et dévers nul à la réception', () => {
  for (const k of CATALOGUE) {
    const c = circuits.get(k.id), voulu = k.sauts ? reglage(k).nombre : 0;
    assert.equal((c.sauts || []).length, voulu, k.id + ' : nombre de sauts');
    if (!voulu) continue;
    const ds = pasDe(c), base = construire(k, { sauts: false }), S = { ...B.circuit.SAUT, ...reglage(k) };
    const zones = [c.stands, c.tunnel, ...(c.couverts || []), ...(c.ponts || []), ...(c.bords || [])].filter(Boolean);
    for (const z of c.sauts) {
      const i0 = Math.round(z.sommet / ds);
      assert.ok(Math.abs(i0 * ds - z.sommet) < 1e-6, k.id + ' : sommet hors échantillon');
      for (let j = i0 - Math.ceil(S.droitAvant / ds); j <= i0 + Math.ceil(S.droitApres / ds); j++)
        assert.ok(Math.abs(c.courbure[idx(c, j)]) < 1 / S.rayonMin, k.id + ' : saut hors droite à ' + Math.round(j * ds));
      for (let j = i0 - Math.ceil(60 / ds); j <= i0 + Math.ceil(S.droitApres / ds); j++)
        assert.ok(c.vitesse[idx(c, j)] >= S.vitesseMin, k.id + ' : consigne IA trop lente à ' + Math.round(j * ds));
      for (const o of zones) assert.ok(z.fin + S.marge <= o.debut || z.debut - S.marge >= o.fin,
        k.id + ' : saut ' + Math.round(z.sommet) + ' trop près de ' + Math.round(o.debut) + '…' + Math.round(o.fin));
      if (!c.ouvert) {
        const ld = c.ligneDroite || { debut: -150, fin: 150 };
        assert.ok(z.debut - S.marge >= ld.fin && z.fin + S.marge <= c.longueur + ld.debut, k.id + ' : saut trop près de la ligne');
      } else assert.ok(z.debut >= 400 - 1e-6 && z.fin <= (c.arrivee ?? c.longueur) - 300 + 1e-6, k.id + ' : saut trop près d’un bout');
      // la bosse ajoutée est exactement bosseSaut, nulle hors de son emprise ; 2,96 m au sommet
      for (let j = i0 - Math.ceil((z.sommet - z.debut) / ds) - 3; j <= i0 + Math.ceil((z.fin - z.sommet) / ds) + 3; j++) {
        const q = idx(c, j), attendu = Math.abs((j - i0) * ds) <= S.rampe + S.creux ? B.circuit.bosseSaut((j - i0) * ds, S) : 0;
        assert.ok(Math.abs(c.y[q] - base.y[q] - attendu) < 1e-9, k.id + ' : bosse inattendue à ' + Math.round(j * ds));
      }
      assert.ok(Math.abs(z.hauteur - 2.96) < .01, k.id + ' : hauteur de bosse ' + z.hauteur);
      // crête franche : −0,012 m⁻¹ au sommet de la bosse (échantillonnée au pas du circuit), plus le fond adouci
      const kv = (c.y[idx(c, i0 - 1)] - 2 * c.y[i0] + c.y[idx(c, i0 + 1)]) / (ds * ds);
      assert.ok(kv < -.008 && kv > -.0135, k.id + ' : crête de ' + kv + ' m⁻¹');
      for (let j = i0 - Math.floor(40 / ds); j <= i0 + Math.floor(110 / ds); j++) assert.ok(c.devers[idx(c, j)] === 0, k.id + ' : dévers à la réception');
    }
  }
  controles++;
});

test('déterminisme : deux constructions donnent le même relief, au bit près', () => {
  for (const k of CATALOGUE.filter(x => x.sauts)) {
    const a = construire(k), b = circuits.get(k.id);
    for (const champ of ['y', 'pente', 'devers'])
      assert.equal(Buffer.compare(Buffer.from(a[champ].buffer, a[champ].byteOffset, a[champ].byteLength),
        Buffer.from(b[champ].buffer, b[champ].byteOffset, b[champ].byteLength)), 0, k.id + ' : ' + champ + ' diffère');
    assert.deepEqual(a.sauts, b.sauts);
  }
  controles++;
});

test('Descente des Freins Chauds : hors sauts, aucune marche de pente ni contre-dévers ; ponts et bouts à plat ; Float64', () => {
  const c = circuits.get('larche'), ds = c.pas, D = B.larcheData;
  let marches = 0, contre = 0, kvMax = 0;
  for (let i = 1; i < c.n - 1; i++) {
    const s = i * ds;
    if (Math.abs(c.courbure[i]) > 1 / 300 && Math.abs(c.devers[i]) > .0175 && c.courbure[i] * c.devers[i] < 0) contre++;
    for (const ov of D.ouvrages) if (ov[0] === 'pont' && s >= ov[1] && s <= ov[2]) assert.ok(c.devers[i] === 0, 'dévers sur un pont à ' + Math.round(s));
    if (s < 80 || s > c.arrivee - 40) assert.ok(c.devers[i] === 0, 'dévers en bout de route à ' + Math.round(s));
    if (dansSaut(c, s - ds) || dansSaut(c, s + ds)) continue;
    const saut = Math.abs((c.y[i + 1] - c.y[i]) - (c.y[i] - c.y[i - 1])) / ds;
    if (saut > .02) marches++;
    kvMax = Math.max(kvMax, saut / ds);
  }
  assert.equal(marches, 0, 'marches de pente de plus de 2 %');
  assert.equal(contre, 0, 'contre-dévers de plus de 1°');
  assert.ok(kvMax < .006, 'courbure verticale ' + kvMax);
  for (const champ of ['x', 'z', 'cap', 'courbure', 'pente', 'devers']) assert.ok(c[champ] instanceof Float64Array, champ + ' en Float64Array');
  assert.deepEqual(B.larche.valider(c), []);
  controles++;
});

test('décor : quatre panneaux par saut, poteaux et panneaux solides, derrière les limites', () => {
  for (const id of ['sierra', 'baikal']) {
    const k = CATALOGUE.find(x => x.id === id), c = construire(k);
    B.bords.limites(c, B.bords.planifier(c));
    const d = B.decor.construire(c, { qualite: 'high', vegetation: false, saison: 'ete' });
    const signes = d.lots.flatMap(l => l.objets).filter(o => o.repereSaut);
    const annonces = new Set(signes.map(o => o.repereSaut.sommet + '/' + o.repereSaut.metres + '/' + o.repereSaut.cote));
    assert.equal(annonces.size, 4 * c.sauts.length, id + ' : annonces posées');
    for (const o of signes) {
      if (o.symboleSaut === 'poteau' || o.symboleSaut === 'panneau') assert.equal(o.solidePhysX?.genre, 'repere-saut');
      const r = o.repereSaut, f = B.circuit.echantillon(c, r.s), lateral = (o.p[0] - f.x) * -Math.sin(f.cap) + (o.p[2] - f.z) * Math.cos(f.cap);
      assert.ok(Math.abs(lateral) > c.largeur / 2 + 1, id + ' : panneau sur la chaussée');
    }
  }
  controles++;
});

// Pli d'un quad d'enrobé (deux triangles poussés à la suite : pa, pb, ib puis pa, ib, ia) : écart de sa diagonale à la
// surface réglée entre ses deux rangées, |h(pa) + h(ib) − h(pb) − h(ia)| / 4.
function plisEnrobe(decor) {
  let pire = 0, quads = 0;
  for (const nap of decor.nappes) {
    if (nap.surfaceType !== 'accotement') continue;
    const I = nap.indices, S = nap.sommets, h = v => S[13 * v + 1];
    for (let k = 0; k + 5 < I.length; k += 6) {
      if (nap.surfacesPhysX[k / 3] !== 1 || I[k] !== I[k + 3] || I[k + 2] !== I[k + 4]) continue;
      pire = Math.max(pire, Math.abs(h(I[k]) + h(I[k + 2]) - h(I[k + 1]) - h(I[k + 5])) / 4); quads++;
    }
  }
  return { pire, quads };
}

test('chaussée : aux Alizés, l’enrobé ne se plie plus en diagonale dans les rampes de dévers (1 cm au plus)', () => {
  const k = CATALOGUE.find(x => x.id === 'ovale-des-forges'), c = construire(k);
  const d = B.decor.construire(c, { qualite: 'high', vegetation: false, saison: 'ete' });
  const { pire, quads } = plisEnrobe(d);
  assert.ok(quads > c.n * 8, 'enrobé non découpé : ' + quads + ' quads pour ' + c.n + ' rangées');
  assert.ok(pire <= .0101, 'pli de ' + (pire * 100).toFixed(2) + ' cm');
  // dévers doux : une seule bande d'enrobé par rangée, comme avant (Second Écho)
  const sierra = construire(CATALOGUE.find(x => x.id === 'sierra'));
  const ds = B.decor.construire(sierra, { qualite: 'high', vegetation: false, saison: 'ete' }), ps = plisEnrobe(ds);
  assert.ok(ps.pire < .01 && ps.quads < sierra.n * 5, 'Second Écho : ' + JSON.stringify(ps));
  controles++;
});

// Route sans fin : trois graines, soixante tronçons chacune (≈ 260 km)
const R = B.routeSansFin, GRAINES = [1000, 8919, 16838], TRONCONS = 60;
const fenetre = (graine, k) => {
  const trace = R.creerTrace(Math.max(0, k - 1), k + 2, graine), c = B.circuit.creerDepuisTrace(trace, { topologie: 'ouvert' });
  B.circuit.preparerParcours(c);
  c.sauts = R.sautsFenetre(trace, c); c.graine = graine; c.theme = R.pointsSegment(k, graine).profil.theme;
  return { trace, c, z: c.sauts.find(u => u.sommet > (k > 0 ? R.pointsSegment(k - 1, graine).profil.L : 0) - 1) };
};

test('Route sans fin : crêtes occasionnelles sur les droites rapides de plaine et de montagne, loin des coutures et des stations', () => {
  const S = B.circuit.SAUT, P = R.PAS, e = Math.round((S.rampe + S.creux) / P), VMAX = 86;
  const parBiome = {};
  for (const graine of GRAINES) {
    let sAbs = 0;
    const absolus = [];
    for (let k = 0; k < TRONCONS; k++) {
      const seg = R.pointsSegment(k, graine), L = seg.profil.L, z = seg.saut, b = seg.profil.biome;
      parBiome[b] = (parBiome[b] || 0) + (z ? 1 : 0);
      if (z) {
        assert.notEqual(b, 'plage', 'saut sur une plage');
        const i0 = z.iSommet, y0 = j => seg.pts[j].y - (Math.abs(j - i0) <= e ? B.circuit.bosseSaut((j - i0) * P) : 0);
        assert.ok(seg.pts[i0].s === z.sommet && z.iDebut === i0 - e && z.iFin === i0 + e && z.debut === z.sommet - 150 && z.fin === z.sommet + 150);
        assert.ok(z.sommet >= 500 && z.fin <= L - 140, graine + ':' + k + ' : saut trop près d’un bout du tronçon');
        assert.ok(Math.abs(z.hauteur - 2.96) < .01);
        for (let j = i0 - Math.round(S.droitAvant / P) + 1; j <= i0 + Math.round(S.droitApres / P); j++)
          assert.ok(Math.abs(seg.pts[j].cap - seg.pts[j - 1].cap) / P < 1 / 500, graine + ':' + k + ' : saut hors droite');
        // relief de fond (bosse retirée) : pente ≤ 7 %, 0,4 g de crête et 0,8 g de creux au plus à 310 km/h, raccord lisse
        for (let j = i0 - e - 2; j <= i0 + e + 2; j++) {
          assert.ok(Math.abs(y0(j + 1) - y0(j)) / P <= S.penteMax + 1e-12, graine + ':' + k + ' : pente de fond');
          const kv = (y0(j - 1) - 2 * y0(j) + y0(j + 1)) / (P * P);
          assert.ok(kv >= -.4 * G / VMAX ** 2 - 1e-12 && kv <= .8 * G / VMAX ** 2 + 1e-12, graine + ':' + k + ' : relief de fond ' + kv);
        }
        absolus.push({ debut: sAbs + z.debut, fin: sAbs + z.fin });
      }
      sAbs += L;
    }
    const stations = R.stationsEntre(0, sAbs - 3600, graine);
    for (let j = 1; j < stations.length; j++) {
      const ecart = stations[j].debutAbs - stations[j - 1].debutAbs;
      assert.ok(ecart >= 1800 && ecart <= 3600, graine + ' : écart de stations ' + ecart);
    }
    for (const z of absolus) for (const st of stations)
      assert.ok(st.finAbs <= z.debut - R.MARGE_SAUT_STATION || st.debutAbs >= z.fin + R.MARGE_SAUT_STATION,
        graine + ' : station à ' + Math.round(st.debutAbs) + ' trop près du saut ' + Math.round(z.debut));
  }
  assert.equal(parBiome.plage, 0);
  assert.ok(parBiome.plaine >= 20 && parBiome['petite-montagne'] >= 5, 'sauts trop rares : ' + JSON.stringify(parBiome));
  assert.ok(parBiome.plaine + parBiome['petite-montagne'] + (parBiome['grande-montagne'] || 0) <= GRAINES.length * TRONCONS * .4, 'sauts trop fréquents');
  controles++;
});

test('Route sans fin : la fenêtre porte chaque saut à l’abscisse exacte, l’IA y arrive lancée, quatre panneaux l’annoncent', () => {
  const flux = readFileSync(new URL('../src/route-sans-fin-flux.js', import.meta.url), 'utf8');
  assert.ok(/preparerParcours\(c\);\n\s*c\.sauts = R\.sautsFenetre\(trace, c\);/.test(flux), 'l’ouvrier pose les sauts de la fenêtre');
  const { trace, c, z } = fenetre(1000, 7), j = trace.sauts.find(u => c.abscissesSource[u.iSommet] === z.sommet).iSommet;
  // rééchantillonnée au pas de la fenêtre, la crête (0,012 m⁻¹ sur des sommets tous les 2 m) perd au plus 1,2 cm
  assert.ok(Math.abs(B.circuit.echantillon(c, z.sommet).y - trace.points[j].y) < .015, 'crête décalée dans la fenêtre');
  for (let s = z.sommet - 60; s <= z.sommet + 130; s += c.pas) {
    const v = c.vitesse[Math.round(s / c.pas)];
    assert.ok(v >= B.circuit.SAUT.vitesseMin && v >= c.vitesse[Math.round(z.sommet / c.pas)] - 1, 'l’IA freine ou traîne au saut, à ' + Math.round(s - z.sommet));
  }
  // la fenêtre du jeu (route-sans-fin-fenetre) porte les mêmes sauts que la reconstruction ci-dessus
  const f = B.routeSansFinFenetre.creer(1000);
  const attendu = R.sautsFenetre(R.creerTrace(f.k0, f.k1, 1000), f.c);
  assert.ok(attendu.length > 0 || f.c.sauts.length === 0);
  assert.deepEqual(f.c.sauts, attendu);
  const d = B.decor.construire(c, { qualite: 'high', vegetation: false, saison: 'ete' });
  const signes = d.lots.flatMap(l => l.objets).filter(o => o.repereSaut);
  assert.equal(new Set(signes.map(o => o.repereSaut.sommet + '/' + o.repereSaut.metres + '/' + o.repereSaut.cote)).size, 4 * c.sauts.length);
  controles++;
});

test('PhysX : au Second Écho, la F1 pilotée par l’IA décolle à la crête et se repose droite, sans accident ni replacement', async () => {
  globalThis.FPhysX = await chargerPhysX();
  const k = CATALOGUE.find(x => x.id === 'sierra'), c = construire(k);
  B.bords.limites(c, B.bords.planifier(c));
  const decor = B.decor.construire(c, { qualite: 'high', vegetation: false, saison: 'ete' });
  c.obstacles = B.obstacles.creer(decor.obstacles);
  const avant = B.meteo.actuel;
  B.meteo.actuel = B.chaussee.preparer({ pluie: 0, mouille: 0, neigeSol: 0, fixe: true }, B.saisons.profil('ete', c.theme));
  const z = c.sauts[0], co = B.course.creer(c, { mode: 'chrono', rivaux: 0, tours: 3, graine: 42 });
  co.phase = 'course'; co.joueur.ia.hab = .9;
  Object.assign(co.joueur.etat, { s: z.sommet - 320, d: 0, v: c.vitesse[Math.round((z.sommet - 320) / c.pas)] });
  try {
    const p = B.physique.installer(co, decor), e = co.joueur.etat, ph = e._physx, ev = [], cmd = {}, hit = {}, origine = [0, 0, 0];
    let vol = 0, enVol = 0, sousLeSol = 0, accident = false, dCrete = null, ecart = 0;
    for (let i = 0; i < 12 * 120 && e.s < z.sommet + 250; i++) {
      B.course.pas(co, B.course.commandesIA(co, co.joueur, cmd), 1 / 120, ev);
      origine[0] = ph.x; origine[1] = ph.y + 12; origine[2] = ph.z;
      p.world.raycast(origine, [0, -1, 0], 30, { mask: 1, staticOnly: true }, hit);
      if (hit.hit && ph.y - hit.y < -.15) sousLeSol++;
      if (dCrete === null && e.s >= z.sommet - 20) dCrete = e.d;
      if (dCrete !== null && e.s < z.sommet + 200) ecart = Math.max(ecart, Math.abs(e.d - dCrete));
      if (ph.groundCount === 0 && e.s > z.sommet - 40 && e.s < z.sommet + 120) { enVol++; vol = Math.max(vol, enVol / 120); } else enVol = 0;
      if (e.recuperation || e.accident) accident = true;
    }
    assert.ok(e.s >= z.sommet + 250, 'la voiture n’a pas fini la réception : s = ' + e.s);
    assert.ok(vol >= .3, 'vol trop court : ' + vol + ' s');
    assert.equal(accident, false, 'accident au saut');
    assert.equal(e.repositionnements || 0, 0, 'replacement au saut');
    assert.equal(sousLeSol, 0, 'caisse sous la chaussée');
    assert.ok(ecart < 1, 'réception de travers : ' + ecart + ' m');
  } finally { B.physique.liberer(co); B.meteo.actuel = avant; }
  controles++;
});

test('PhysX : sur la Route sans fin, la F1 lancée à 310 km/h vole à la crête et reste sur la chaussée, sans accident', async () => {
  globalThis.FPhysX = globalThis.FPhysX || await chargerPhysX();
  const { c, z } = fenetre(1000, 7);
  const decor = B.decor.construire(c, { qualite: 'high', vegetation: false, saison: 'ete' });
  c.obstacles = B.obstacles.creer(decor.obstacles);
  const avant = B.meteo.actuel;
  B.meteo.actuel = B.chaussee.preparer({ pluie: 0, mouille: 0, neigeSol: 0, fixe: true }, B.saisons.profil('ete', c.theme));
  const co = B.course.creer(c, { mode: 'chrono', rivaux: 0, tours: 3, graine: 42 });
  co.phase = 'course'; co.joueur.ia.hab = .9;
  Object.assign(co.joueur.etat, { s: z.sommet - 320, d: 0, v: c.vitesse[Math.round((z.sommet - 320) / c.pas)] });
  try {
    const p = B.physique.installer(co, decor), e = co.joueur.etat, ph = e._physx, ev = [], cmd = {}, hit = {}, origine = [0, 0, 0];
    let vol = 0, enVol = 0, sousLeSol = 0, accident = false, horsPiste = 0;
    for (let i = 0; i < 12 * 120 && e.s < z.sommet + 250; i++) {
      B.course.pas(co, B.course.commandesIA(co, co.joueur, cmd), 1 / 120, ev);
      origine[0] = ph.x; origine[1] = ph.y + 12; origine[2] = ph.z;
      p.world.raycast(origine, [0, -1, 0], 30, { mask: 1, staticOnly: true }, hit);
      if (hit.hit && ph.y - hit.y < -.15) sousLeSol++;
      if (e.s > z.sommet - 20 && Math.abs(e.d) > c.largeur / 2) horsPiste++;
      if (ph.groundCount === 0 && e.s > z.sommet - 40 && e.s < z.sommet + 120) { enVol++; vol = Math.max(vol, enVol / 120); } else enVol = 0;
      if (e.recuperation || e.accident) accident = true;
    }
    assert.ok(e.s >= z.sommet + 250, 'la voiture n’a pas fini la réception : s = ' + e.s);
    assert.ok(vol >= .3, 'vol trop court : ' + vol + ' s');
    assert.equal(accident, false, 'accident au saut');
    assert.equal(e.repositionnements || 0, 0, 'replacement au saut');
    assert.equal(sousLeSol, 0, 'caisse sous la chaussée');
    assert.equal(horsPiste, 0, 'sortie de la chaussée après le saut');
  } finally { B.physique.liberer(co); B.meteo.actuel = avant; }
  controles++;
  console.log(controles + ' contrôles des pistes fluides et des sauts réussis ; ' + [...circuits.values()].reduce((n, c) => n + (c.sauts || []).length, 0) + ' sauts sur six circuits.');
});
