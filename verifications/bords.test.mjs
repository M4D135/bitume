// Bords de route du lot 22F (David, 18/11/2026 : « un peu plus de panneaux de publicité au bord de la route aussi,
// quelques bords de routes dangereux »). src/bords.js n'est pas encore branché sur le décor (integration.patch du
// rapport docs/reprise/rapports/lieux-2026-11-18) : on vérifie ici le module seul, sur les sept circuits du catalogue.
// Graine propre (jamais Math.random, jamais le hasard du décor ni de la course), publicités hors des stands, du
// tunnel et des bords dangereux, deux à quatre bords dangereux par circuit, limites resserrées en entonnoir, mêmes
// solides en Légère et en Fine, aucun solide sur la chaussée.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { TRACE } from '../tools/lieux-trace.mjs';
import { PARTITION } from '../tools/lieux-partitions.mjs';
const require = createRequire(import.meta.url);
for (const f of ['carene', 'circuit', 'decor', 'bords']) require('../src/' + f + '.js');
const B = globalThis.BITUME;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok  ' + nom); };
const CATALOGUE = [[11, 'foret', 4200, 'Val-Brûlé'], [29, 'cote', 3600, 'Port-Sable'], [47, 'montagne', 5200, 'Haut-Col'], [83, 'islande', 4600, 'Lande-Noire'],
  [107, 'desert', 4800, 'Roche-Fauve'], [131, 'asie', 5000, 'Brume-de-Jade'], [157, 'pacifique', 5200, 'Cap-Séquoia']];
const creer = ([graine, theme, longueur, nom]) => B.circuit.creer(graine, { theme, longueur, nom });
const ramener = (c, s) => ((s % c.longueur) + c.longueur) % c.longueur;
const ecart = (c, a, b) => { const d = Math.abs(ramener(c, a) - ramener(c, b)); return Math.min(d, c.longueur - d); };
const TYPES = { foret: ['arbres', 'fosse'], cote: ['vide', 'muret', 'fosse'], montagne: ['vide', 'rochers', 'muret'], islande: ['rochers', 'vide', 'fosse', 'muret'],
  desert: ['rochers', 'fosse'], asie: ['muret', 'vide', 'arbres'], pacifique: ['vide', 'arbres', 'muret'] };
const circuits = CATALOGUE.map(k => { const c = creer(k); return { c, plan: B.bords.planifier(c) }; });
const poserTout = (c, plan, qualite) => {
  const objets = [];
  const stats = B.bords.poser(c, plan, { qualite, ajouter: (liste, loin, x, z) => { assert.ok(Number.isFinite(x) && Number.isFinite(z)); for (const o of loin) assert.ok(liste.includes(o) || o.shape, 'objet lointain inconnu'); objets.push(...liste); } });
  return { objets, stats };
};

verifier('le plan ne dépend que du circuit, tiré sans Math.random et sans toucher au tracé', () => {
  const aleatoire = Math.random;
  Math.random = () => { throw new Error('Math.random appelé'); };
  try {
    for (const k of CATALOGUE) {
      const a = creer(k), avant = [a.x.slice(), a.y.slice(), a.limiteG.slice(), a.limiteD.slice()];
      const p1 = B.bords.planifier(a), p2 = B.bords.planifier(creer(k));
      assert.equal(B.bords.planifier(a), p1, 'plan mis en cache sur le circuit');
      assert.deepEqual(JSON.parse(JSON.stringify(p1)), JSON.parse(JSON.stringify(p2)));
      assert.ok(!Object.keys(a).includes('_bords'), 'le cache ne doit pas apparaître parmi les champs du circuit');
      assert.deepEqual([a.x, a.y, a.limiteG, a.limiteD], avant, 'planifier ne modifie pas le circuit');
      poserTout(a, p1, 'high');
    }
  } finally { Math.random = aleatoire; }
});

verifier('deux à quatre bords dangereux par circuit, à 500 m au moins l\'un de l\'autre, ni aux stands ni sous le tunnel', () => {
  for (const { c, plan } of circuits) {
    const D = plan.dangers;
    assert.ok(D.length >= 2 && D.length <= 4, `${c.nom} : ${D.length} bords dangereux`);
    for (const d of D) {
      assert.ok(TYPES[c.theme].includes(d.type), `${c.nom} : type ${d.type}`);
      assert.ok(d.fin - d.debut >= 120 && d.fin - d.debut <= 260, `${c.nom} : portion de ${d.fin - d.debut} m`);
      for (let s = d.debut; s <= d.fin; s += 10) {
        const x = ramener(c, s);
        assert.ok(x > c.ligneDroite.fin + 40 && x < c.longueur + c.ligneDroite.debut - 40, `${c.nom} : ${d.type} sur la ligne des stands (${s})`);
        if (c.tunnel) assert.ok(x < c.tunnel.debut - 40 || x > c.tunnel.fin + 40, `${c.nom} : ${d.type} au tunnel`);
      }
      // le vide est à l'extérieur d'une courbe rapide (rayon de 100 à 600 m)
      if (d.type === 'vide') {
        let k = 0; for (let s = d.debut + 50; s <= d.fin - 30; s += 2) k = Math.max(k, Math.abs(B.circuit.echantillon(c, s).courbure));
        assert.ok(k >= 1 / 600 && k <= 1 / 100 + 1e-9, `${c.nom} : vide hors d'une courbe rapide (k ${k})`);
        const sens = Math.sign(B.circuit.echantillon(c, (d.debut + d.fin) / 2).courbure);
        assert.equal(d.cote, -sens, `${c.nom} : le vide doit être à l'extérieur`);
      }
    }
    for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++) assert.ok(ecart(c, D[i].debut, D[j].debut) >= 500, `${c.nom} : bords trop proches`);
  }
});

verifier('publicités : séries de 3 à 6 bandeaux, hors des stands, du tunnel, des bords dangereux et des panneaux historiques', () => {
  for (const { c, plan } of circuits) {
    const bandeaux = plan.bandeaux;
    assert.ok(bandeaux.length >= 40 && bandeaux.length <= 160, `${c.nom} : ${bandeaux.length} bandeaux`);
    const series = []; let prec = null;
    for (const b of bandeaux) {
      const s = b.i * c.pas, x = ramener(c, s);
      assert.equal(b.i % 4, 0, 'un bandeau par segment de glissière de 8 m');
      assert.notEqual((b.i / 4) % 9, 4, 'jamais sur le segment du panneau historique');
      assert.ok(Math.abs(c.courbure[b.i]) <= 1 / 300, `${c.nom} : bandeau en virage serré`);
      assert.ok(x > c.ligneDroite.fin + 40 && x < c.longueur + c.ligneDroite.debut - 40, `${c.nom} : bandeau aux stands`);
      if (c.tunnel) assert.ok(x < c.tunnel.debut - 40 || x > c.tunnel.fin + 40, `${c.nom} : bandeau dans le tunnel`);
      for (const d of plan.dangers) if (d.cote === b.cote) assert.ok(ramener(c, s - d.debut + 40) >= d.fin - d.debut + 80, `${c.nom} : bandeau sur un bord dangereux`);
      assert.ok(plan.marques.includes(b.marque));
      // une série continue enjambe au plus le segment du panneau historique
      const suite = prec && prec.cote === b.cote && prec.marque === b.marque && (b.i === prec.i + 4 || (b.i === prec.i + 8 && ((prec.i + 4) / 4) % 9 === 4));
      if (!suite) series.push(1); else series[series.length - 1]++;
      prec = b;
    }
    assert.ok(Math.max(...series) <= 6 && Math.min(...series) >= 3, `${c.nom} : séries de ${Math.min(...series)} à ${Math.max(...series)}`);
    assert.ok(plan.affiches.length >= 2 && plan.passerelles.length === 1, `${c.nom} : ${plan.affiches.length} grands panneaux, ${plan.passerelles.length} passerelle`);
    assert.ok(plan.marques.length >= 8 && plan.marques.length <= 12 && new Set(plan.marques).size === plan.marques.length);
  }
});

verifier('marques imaginaires : 24 noms distincts, identité visuelle stable et lisible', () => {
  const noms = B.bords.MARQUES.map(m => m.nom);
  assert.equal(noms.length, 24); assert.equal(new Set(noms).size, 24);
  for (const nom of noms) {
    const a = B.bords.identite(nom), b = B.bords.identite(nom);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.fond, a.accent, nom + ' : fond et bande de même teinte');
    for (const v of [...a.fond, ...a.accent, ...a.texte]) assert.ok(v >= 0 && v <= 1);
    assert.ok(a.lettres.length >= 4 && a.lettres.every(l => l > 0 && l < .4));
  }
});

verifier('limites : parapet à w + 1,4, muret à w + 1, fossé à w + 2,5, en entonnoir de pente 0,35 au plus', () => {
  for (const k of CATALOGUE) {
    const c = creer(k), plan = B.bords.planifier(c), G0 = c.limiteG.slice(), D0 = c.limiteD.slice(), w = c.largeur / 2;
    const touches = B.bords.limites(c, plan);
    if (plan.dangers.some(d => d.type !== 'arbres' && d.type !== 'rochers')) assert.ok(touches > 0);
    for (const [L, L0] of [[c.limiteG, G0], [c.limiteD, D0]]) for (let i = 0; i < c.n; i++) {
      assert.ok(L[i] <= L0[i] + 1e-6, 'une limite ne recule jamais');
      const j = (i + 1) % c.n;
      if (L[i] !== L0[i] || L[j] !== L0[j]) assert.ok(Math.abs(L[j] - L[i]) <= Math.max(Math.abs(L0[j] - L0[i]), .35 * c.pas) + 1e-4, `${c.nom} : marche de limite en ${i}`);
    }
    for (const d of plan.dangers) {
      const marge = B.bords.LIMITE_BORD[d.type], L = d.cote < 0 ? c.limiteG : c.limiteD;
      const { i0, i1 } = B.bords.bornes(c, d);
      assert.ok(i0 % 4 === 0 && i1 % 4 === 0 && Math.abs(i0 * c.pas - d.debut) <= 4 && Math.abs(i1 * c.pas - d.fin) <= 4);
      for (let i = i0; i <= i1 + 4; i++) if (marge != null) assert.ok(L[i % c.n] <= w + marge + 1e-4, `${c.nom} : ${d.type} limite ${L[i % c.n]}`);
      // la glissière du décor (segments de 8 m aux multiples de 4) est retirée exactement là où le parapet, le muret ou
      // les balises du fossé sont posés ; celle d'en face reste
      for (let i = i0 - 8; i <= i1 + 8; i += 4) {
        assert.equal(B.bords.sansGlissiere(c, i, d.cote), i >= i0 && i <= i1 && (d.type === 'vide' || d.type === 'muret' || d.type === 'fosse'), `${c.nom} : glissière en ${i}`);
        assert.equal(B.bords.sansGlissiere(c, i, -d.cote), false, 'la glissière d\'en face reste');
      }
      assert.ok(B.circuit.limiteA(c, (d.debut + d.fin) / 2, d.cote) <= (marge != null ? w + marge + 1e-4 : c.limite));
    }
  }
});

verifier('pose : mêmes solides en Légère et en Fine, Légère plus légère, aucun solide sur la chaussée', () => {
  for (const k of CATALOGUE) {
    const c = creer(k), plan = B.bords.planifier(c);
    B.bords.limites(c, plan);
    const fin = poserTout(c, plan, 'high'), leger = poserTout(c, plan, 'low');
    const solides = l => l.objets.filter(o => o.collision).map(o => JSON.stringify([o.collision, o.shape, o.p, o.s, o.r]));
    assert.deepEqual(solides(leger), solides(fin), `${c.nom} : solides différents selon la qualité`);
    assert.ok(leger.objets.length < .7 * fin.objets.length, `${c.nom} : Légère ${leger.objets.length} / Fine ${fin.objets.length}`);
    assert.equal(fin.stats.bandeaux, plan.bandeaux.length); assert.equal(fin.stats.affiches, plan.affiches.length);
    for (const o of fin.objets) for (const v of [...o.p, ...(o.s || []), ...(o.r || [])]) assert.ok(Number.isFinite(v), `${c.nom} : valeur non finie (${o.shape})`);
    // un solide (tronc, rocher) est toujours au-delà du bord de la chaussée plus 2 m, quelle que soit la portion voisine
    const w = c.largeur / 2;
    for (const o of fin.objets.filter(q => q.collision)) {
      let d = Infinity; for (let i = 0; i < c.n; i++) d = Math.min(d, Math.hypot(c.x[i] - o.p[0], c.z[i] - o.p[2]));
      assert.ok(d >= w + 2, `${c.nom} : ${o.collision} à ${d.toFixed(2)} m de l'axe`);
    }
  }
});

verifier('un tracé de génération 3 déclare ses bords : ils sont repris tels quels (Route-des-Cimes)', () => {
  const c = TRACE.construire(PARTITION['route-des-cimes']), plan = B.bords.planifier(c);
  assert.equal(plan.dangers.length, c.bords.length);
  plan.dangers.forEach((d, k) => { const b = c.bords[k]; assert.deepEqual([d.type, d.cote, d.debut, d.fin, d.nom], [b.type, b.cote === 'G' ? -1 : 1, b.debut, b.fin, b.nom]); });
  for (const b of plan.bandeaux) for (const t of c.couverts) assert.ok(b.i * c.pas < t.debut - 40 || b.i * c.pas > t.fin + 40, 'bandeau sous un passage couvert');
  for (const b of plan.bandeaux) for (const t of c.ponts) assert.ok(b.i * c.pas < t.debut - 20 || b.i * c.pas > t.fin + 20, 'bandeau sur un pont');
});

console.log(`${n} vérifications des bords de route`);
