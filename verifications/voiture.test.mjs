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

const livree = { couleur: [.86, .1, .08], seconde: [.95, .93, .88], casque: [.95, .93, .88], combinaison: [.95, .93, .88], numero: 27 };
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

verifier('cockpit : centre du volant entre 14 et 18° sous l’axe de visée', () => {
  const c = V.VOLANT.centre, a = deg(Math.atan2(-c[1], Math.hypot(c[0], c[2])));
  assert.ok(a >= 14 && a <= 18, `${a.toFixed(1)}°`);
});

// Cadrage de vroom-unreal 0.35 : volant gros et bas, dont le bas de la jante sort de l'image ; les mains, elles, y sont.
verifier('cockpit : haut de la jante, prises des mains, planche, pneus avant et rétroviseurs dans le cadre en 16:9', () => {
  const { centre: C, rayon: R, inclinaison: t, prise } = V.VOLANT, tube = .012 * R / .105;
  const wu = [Math.sin(t), Math.cos(t), 0], wr = [0, 0, 1], jante = (a, e) => C.map((v, i) => v + e * (wu[i] * Math.cos(a) + wr[i] * Math.sin(a)));
  for (let a = -prise - .15; a <= prise + .15; a += .1) dansLeCadre(jante(a, R + tube), 'jante');
  for (const s of [-1, 1]) dansLeCadre(jante(s * prise, R + .03), 'gant');
  const bas = projeter(jante(Math.PI, R));
  assert.ok(bas[1] < -1 && bas[1] > -1.25, `le bas de la jante sort de l'image, de peu : ${bas[1].toFixed(2)}`);
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
  const carrosserie = sortie.slice(0, mod.corps.filter(p => V.visible(p, true, 0)).length + 4); // la caisse, puis capot bas et saute-vent
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

verifier('cockpit : pilote, arrière, capot et glaces de la vue extérieure absents, roues avant présentes', () => {
  const sortie = []; V.poser(mod, { p: [0, 0, 0], cap: 0 }, sortie, { cockpit: true, overlay: true });
  assert.equal(sortie.length, mod.corps.filter(p => !(p.pilote || p.arriere || p.exterieur || p.glace || p.vite)).length);
  assert.ok(sortie.every(m => m.overlay) && sortie.some(m => m.shape === 'cylinder' && m.p[0] > 1.3));
});

// ---------------------------------------------------------------- détails de la voiture et cockpit vivant
const repos = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0 };
const bord = extra => { const sortie = []; V.cockpit(mod, Object.assign({ v: 40 }, repos), sortie, Object.assign({ regime: 9000, volant: 0, rapport: 3, kmh: 180 }, extra)); return sortie; };
const reel = v => v.map((x, i) => V.OEIL[i] + V.K * x);      // position dans la voiture d'un point composé vu de l'œil
const ecart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

verifier('numéro en géométrie sur le nez et les pontons ; repères des pneus à basse vitesse, bande floue au-delà', () => {
  const sans = V.modele(Object.assign({}, livree, { numero: undefined })), un = V.modele(Object.assign({}, livree, { numero: 1 }));
  assert.equal(un.corps.length - sans.corps.length, 1 + 3 * 2, 'un panneau et trois « 1 » de deux segments');
  assert.equal(mod.corps.length - sans.corps.length, 1 + 3 * (5 + 3), '« 27 » : cinq et trois segments, trois fois');
  const lent = [], vite = [];
  V.poser(mod, Object.assign({ v: 10 }, repos), lent); V.poser(mod, Object.assign({ v: 50 }, repos), vite);
  const marques = mod.corps.filter(p => p.lent).length, flous = mod.corps.filter(p => p.vite).length;
  assert.ok(marques === 16 && flous === 4, `${marques} repères, ${flous} bandes`);
  assert.equal(lent.length, mod.corps.length - flous);
  assert.equal(vite.length, mod.corps.length - marques);
});

verifier('repère de pneu : il tourne autour de l’axe de la roue, à mi-flanc', () => {
  const k = mod.corps.findIndex(p => p.lent && p.roue === 0 && p.tourne === 0), w = V.ROUES[0], flanc = (.165 + w.r) / 2;
  for (const d of [0, .2, .7, 1.3]) {
    const sortie = []; V.poser(mod, Object.assign({ v: 5, roule: d }, repos), sortie);
    const q = sortie[k].p, a = -d / w.r;
    assert.ok(Math.abs(Math.hypot(q[0] - w.x, q[1] - w.r) - flanc) < 1e-9, 'à mi-flanc');
    // la roue avance : son point avant descend
    assert.ok(Math.abs(q[0] - (w.x + flanc * Math.cos(a))) < 1e-9 && Math.abs(q[1] - (w.r + flanc * Math.sin(a))) < 1e-9, `après ${d} m : ${q.map(v => v.toFixed(3))}`);
  }
});

verifier('cockpit : rien que des nombres finis, volant à fond et pendant un changement de rapport', () => {
  for (const volant of [-1, -.4, 0, .7, 1]) for (const passage of [0, .2, .45, .8, 1]) {
    const sortie = bord({ volant, passage, rapportAvant: 2, derriere: [{ x: -8, z: -1.5, couleur: [.1, .3, .8] }] });
    assert.ok(sortie.every(m => m.p.concat(m.s, m.r).every(Number.isFinite) && m.s.every(v => v > 0) && m.overlay), `volant ${volant}, passage ${passage}`);
  }
});

verifier('changement de rapport : la main droite va au pommeau, puis revient sur la jante', () => {
  const pommeau = t => bord({ passage: t, rapportAvant: 2 }).find(m => m.shape === 'sphere' && Math.abs(m.s[0] - .040 * V.K) < 1e-9).p;
  const mainDroite = t => bord({ passage: t, rapportAvant: 2 }).filter(m => m.mat === 18 && m.p[2] > .02 && m.color[0] > .5); // tissu clair : gant et manche de droite, sans la jante
  const auPlusPres = (t, cible) => Math.min(...mainDroite(t).map(m => ecart(m.p, cible)));
  const tilt = V.VOLANT.inclinaison, a = V.VOLANT.prise;      // prise de la main droite, volant droit
  const prise = reel(V.VOLANT.centre.map((v, i) => v + V.VOLANT.rayon * ([Math.sin(tilt), Math.cos(tilt), 0][i] * Math.cos(a) + [0, 0, 1][i] * Math.sin(a))));
  assert.ok(auPlusPres(1, pommeau(1)) > .05, 'au repos, la main est loin du levier');
  assert.ok(auPlusPres(.45, pommeau(.45)) < .012, `à mi-changement, la main tient le pommeau (${auPlusPres(.45, pommeau(.45)).toFixed(3)} m)`);
  assert.ok(auPlusPres(.45, prise) > .04 && auPlusPres(1, prise) < .02, 'elle a quitté la jante, puis y revient');
  // le pommeau passe de la position du 2e rapport (vers l'arrière) à celle du 3e (vers l'avant)
  assert.ok(pommeau(1)[0] - pommeau(0)[0] > .015, 'le levier avance de la 2e à la 3e');
});

verifier('lampe de régime : allumée au-dessus de 12 000 tr/min, sauf au dernier rapport', () => {
  const lampe = extra => bord(extra).find(m => m.shape === 'sphere' && m.mat === 5 && Math.abs(m.s[0] - .024 * V.K) < 1e-9);
  assert.ok(!(lampe({ regime: 11000 }).emissive > 0), 'éteinte à 11 000');
  assert.ok(lampe({ regime: 12400 }).emissive >= 3, 'allumée à 12 400');
  assert.ok(!(lampe({ regime: 12400, rapport: 6 }).emissive > 0), 'éteinte en 6e');
});

verifier('rétroviseurs : une voiture derrière à gauche se voit dans la glace de gauche, à sa place', () => {
  const vide = bord({}), gauche = bord({ derriere: [{ x: -10, z: -3, couleur: [.1, .3, .8] }] }), loin = bord({ derriere: [{ x: -200, z: -3, couleur: [.1, .3, .8] }] });
  assert.equal(gauche.length - vide.length, 2, 'caisse et pneus');
  assert.equal(loin.length, vide.length, 'trop loin : rien');
  const reflet = gauche.find(m => m.color[2] === .8 && m.color[0] === .1);
  assert.ok(reflet.p[2] < -.47 + .066 && reflet.p[2] > -.47 - .066 && Math.abs(reflet.p[1] - .565) < .024, `reflet en ${reflet.p.map(v => v.toFixed(3))}`);
  // plus la voiture est à gauche, plus son reflet est à gauche ; plus elle est près, plus il est grand
  const z = zr => bord({ derriere: [{ x: -14, z: zr, couleur: [.1, .3, .8] }] }).find(m => m.color[2] === .8 && m.color[0] === .1);
  assert.ok(z(-5).p[2] < z(-2).p[2] - .01, 'ordre gauche-droite');
  const pres = bord({ derriere: [{ x: -5, z: -2, couleur: [.1, .3, .8] }] }).find(m => m.color[2] === .8 && m.color[0] === .1);
  assert.ok(pres.s[2] > z(-2).s[2] * 1.5, 'taille selon la distance');
  // droit derrière, à 12 m : visible dans les deux glaces
  assert.equal(bord({ derriere: [{ x: -12, z: 0, couleur: [.1, .3, .8] }] }).length - vide.length, 4);
});

console.log(`${compte} vérifications réussies`);
