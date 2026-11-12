// Vérifications de la monoplace (src/voiture.js) : cotes de la 312 T5, roues, braquage, cadrage du cockpit.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
createRequire(import.meta.url)(path.join(ici, '..', 'src', 'voiture.js'));
const V = globalThis.BITUME.voiture;

let compte = 0;
function verifier(nom, f) {
  try { f(); compte++; console.log(`ok  ${nom}`); } catch (e) { console.error(`FAIL ${nom}: ${e.message}`); process.exit(1); }
}

const livree = { couleur: [.86, .1, .08], seconde: [.95, .93, .88], casque: [.95, .93, .88], combinaison: [.95, .93, .88] };
const mod = V.modele(livree);
const deg = r => r * 180 / Math.PI;

// Boîte englobante d'une pièce dans le repère de la voiture (rotation comprise).
function boite(pc) {
  const m = pc.m || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  return [0, 1, 2].map(i => { const d = [0, 1, 2].reduce((s, j) => s + Math.abs(m[j][i]) * pc.s[j] / 2, 0); return [pc.o[i] - d, pc.o[i] + d]; });
}

verifier('cotes de la 312 T5 : longueur 4,53 m, largeur 2,12 m, hauteur 1,02 m', () => {
  const b = mod.corps.filter(p => !p.fx).map(boite);
  const mini = i => Math.min(...b.map(x => x[i][0])), maxi = i => Math.max(...b.map(x => x[i][1]));
  assert.ok(Math.abs(maxi(0) - mini(0) - 4.53) < .05, `longueur ${(maxi(0) - mini(0)).toFixed(3)}`);
  assert.ok(Math.abs(maxi(2) - mini(2) - 2.12) < .07, `largeur ${(maxi(2) - mini(2)).toFixed(3)}`);
  assert.ok(Math.abs(maxi(1) - 1.02) < .03, `hauteur ${maxi(1).toFixed(3)}`);
  assert.ok(mini(1) > -1e-9, 'rien sous le sol');
});

verifier('empattement 2,70 m, voies 1,70 et 1,615 m, roues posées au sol', () => {
  const [ag, ad, rg, rd] = V.ROUES;
  assert.ok(Math.abs(ag.x - rg.x - 2.70) < 1e-9 && Math.abs(ad.z - ag.z - 1.70) < 1e-9 && Math.abs(rd.z - rg.z - 1.615) < 1e-9);
  for (const w of V.ROUES) {
    const pneu = mod.corps.find(p => p.roue !== undefined && V.ROUES[p.roue] === w && p.shape === 'cylinder');
    assert.ok(Math.abs(pneu.o[1] - pneu.s[0] / 2) < 1e-9, 'pneu tangent au sol');
  }
});

verifier('pièces et version lointaine bien formées', () => {
  for (const p of mod.corps.concat(mod.simples)) {
    assert.ok(['box', 'bevel', 'sphere', 'cylinder', 'ring', 'wedge'].includes(p.shape), p.shape);
    assert.ok(p.o.concat(p.s).every(Number.isFinite) && p.s.every(v => v > 0), JSON.stringify(p));
  }
  assert.ok(mod.simples.length <= 12, `${mod.simples.length} volumes au loin`);
});

verifier('roues : rotation propre = distance / rayon à 1 % près', () => {
  const ev = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0 };
  for (const roue of [0, 2]) {
    const k = mod.corps.findIndex(p => p.roue === roue && p.tourne === 0), r = V.ROUES[roue].r;
    for (const d of [.05, .1, .14]) {
      const sortie = []; V.poser(mod, Object.assign({ roule: d }, ev), sortie);
      const m = V.euler(...sortie[k].r), angle = Math.atan2(m[0][1], m[0][0]);
      assert.ok(Math.abs(angle + d / r) <= .01 * d / r, `roue ${roue}, ${d} m : ${angle.toFixed(4)} au lieu de ${(-d / r).toFixed(4)}`);
      assert.ok(m[0][1] < 0 || d === 0, 'le haut de la roue part vers l’avant');
    }
  }
});

verifier('braquage d’Ackermann : roue intérieure plus braquée, centre commun', () => {
  for (const d of [.05, .2, .45]) {
    const [g, dr] = V.braquages(d);
    assert.ok(dr > g && g > 0, `virage à droite ${d} : ${g}, ${dr}`);
    assert.ok(Math.abs(1 / Math.tan(g) - 1 / Math.tan(dr) - 2 * .85 / V.EMPATTEMENT) < 1e-9, 'axes concourants');
    const [g2, d2] = V.braquages(-d);
    assert.ok(Math.abs(g2 + dr) < 1e-12 && Math.abs(d2 + g) < 1e-12, 'symétrie à gauche');
  }
});

// Cadrage : 41,6° verticaux et 68° horizontaux en 16:9 au repos. Les angles se lisent depuis l'œil ; l'homothétie
// de rapport K les conserve, on projette donc les positions apparentes.
const tv = Math.tan(41.6 * Math.PI / 360), th = tv * 16 / 9;
const projeter = q => [(q[2] / q[0]) / th, (q[1] / q[0]) / tv];
const dansLeCadre = (q, nom) => { const [x, y] = projeter(q); assert.ok(q[0] > 0 && Math.abs(x) <= 1 && Math.abs(y) <= 1, `${nom} hors du cadre : ${x.toFixed(2)}, ${y.toFixed(2)}`); };
const dehors = p => p.map((v, i) => v - V.OEIL[i]);

verifier('cockpit : centre du volant entre 12 et 20° sous l’axe de visée', () => {
  const c = V.VOLANT.centre, a = deg(Math.atan2(-c[1], Math.hypot(c[0], c[2])));
  assert.ok(a >= 12 && a <= 20, `${a.toFixed(1)}°`);
});

verifier('cockpit : volant entier, gants, planche, pneus avant et rétroviseurs dans le cadre en 16:9', () => {
  const { centre: C, rayon: R, inclinaison: t } = V.VOLANT, tube = .065 * R / .435;
  const wu = [Math.sin(t), Math.cos(t), 0], wr = [0, 0, 1];
  for (let k = 0; k < 24; k++) {
    const a = k * Math.PI / 12, e = R + tube;
    dansLeCadre(C.map((v, i) => v + e * (wu[i] * Math.cos(a) + wr[i] * Math.sin(a))), 'jante');
  }
  for (const s of [-1, 1]) dansLeCadre(C.map((v, i) => v + R * wr[i] * s), 'gant');
  for (const a of [-1, 1]) for (const b of [-1, 1]) dansLeCadre(V.PLANCHE.map((v, i) => v + a * .055 * wu[i] + b * .19 * wr[i]), 'planche');
  for (const s of [-1, 1]) {
    dansLeCadre(dehors([1.35, .58, s * .75]), 'pneu avant');
    const retro = mod.corps.find(p => p.shape === 'bevel' && p.o[2] * s > .3 && p.o[1] > .5 && p.o[1] < .7 && p.o[0] > 0 && p.o[0] < 1);
    dansLeCadre(dehors(retro.o), 'rétroviseur');
  }
});

verifier('cockpit : rotation du volant de 95° au plus', () => {
  assert.ok(deg(V.VOLANT.course) <= 95, `${deg(V.VOLANT.course).toFixed(1)}°`);
});

verifier('cockpit : coque creuse, aucune pièce de carrosserie entre l’œil et le volant', () => {
  const sortie = [], ev = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0 };
  V.cockpit(mod, ev, sortie, { regime: 8000, volant: 0, rapport: 3, kmh: 180 });
  const carrosserie = sortie.slice(0, mod.corps.filter(p => !(p.pilote || p.arriere || p.exterieur)).length + 3);
  const fin = V.VOLANT.centre.map((v, i) => V.OEIL[i] + V.K * v);
  for (const m of carrosserie) {
    if (m.fx) continue;
    const r = V.euler(...m.r), b = [0, 1, 2].map(i => { const d = [0, 1, 2].reduce((s, j) => s + Math.abs(r[j][i]) * m.s[j] / 2, 0); return [m.p[i] - d, m.p[i] + d]; });
    for (let k = 0; k <= 50; k++) {
      const q = V.OEIL.map((v, i) => v + (fin[i] - v) * k / 50);
      assert.ok(!q.every((v, i) => v > b[i][0] && v < b[i][1]), `${m.shape} en ${m.p.map(v => v.toFixed(2))} coupe la vue du volant`);
    }
  }
});

verifier('cockpit : pilote, arrière et capot extérieur absents de la vue, roues avant présentes', () => {
  const sortie = []; V.poser(mod, { p: [0, 0, 0], cap: 0 }, sortie, { cockpit: true, overlay: true });
  assert.equal(sortie.length, mod.corps.filter(p => !(p.pilote || p.arriere || p.exterieur)).length);
  assert.ok(sortie.every(m => m.overlay) && sortie.some(m => m.shape === 'cylinder' && m.p[0] > 1.3));
});

console.log(`${compte} vérifications réussies`);
