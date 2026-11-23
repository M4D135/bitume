// Vérifications de la monoplace (src/voiture.js) : cotes de la 312 T5, roues, braquage, cadrage du cockpit.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
createRequire(import.meta.url)(path.join(ici, '..', 'src', 'carene.js'));
createRequire(import.meta.url)(path.join(ici, '..', 'src', 'main.js'));
createRequire(import.meta.url)(path.join(ici, '..', 'src', 'voiture.js'));
createRequire(import.meta.url)(path.join(ici, '..', 'src', 'circuit.js'));
createRequire(import.meta.url)(path.join(ici, '..', 'src', 'conduite.js'));
createRequire(import.meta.url)(path.join(ici, '..', 'src', 'course.js'));
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
    const pneu = mod.corps.find(p => p.roue !== undefined && V.ROUES[p.roue] === w && p.shape.startsWith('bitume-pneu'));
    assert.ok(Math.abs(pneu.o[1] - pneu.s[0] / 2) < 1e-9, 'pneu tangent au sol');
  }
});

verifier('pièces et version lointaine bien formées', () => {
  for (const p of mod.corps.concat(mod.simples)) {
    assert.ok(['box', 'bevel', 'sphere', 'cylinder', 'ring', 'wedge'].includes(p.shape) || Object.values(V.FORMES).some(f => f.nom === p.shape), p.shape);
    assert.ok(p.o.concat(p.s).every(Number.isFinite) && p.s.every(v => v > 0), JSON.stringify(p));
  }
  // 126 CK : 16 volumes au loin (assise et dossier gardés distincts pour le contrôle thorax/siège aux trois LOD).
  assert.equal(mod.simples.filter(p => p.feuStop).length, 1, 'un feu stop au loin');
  assert.ok(mod.simples.filter(p => !p.feuStop).length <= 16, 'seize volumes au plus pour la voiture lointaine hors feu stop');
});

// Pièces dessinées en vue extérieure, à l'arrêt : leur rang est celui des instances rendues par poser.
const vusDehors = mod.corps.filter(p => V.visible(p, false, 0));

verifier('roues : rotation propre = distance / rayon à 1 % près', () => {
  const ev = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0 };
  for (const roue of [0, 2]) {
    const k = vusDehors.findIndex(p => p.roue === roue && p.usureRoue === 1), r = V.ROUES[roue].r, origine = vusDehors[k].tourne;
    for (const d of [.05, .1, .14]) {
      const sortie = []; V.poser(mod, Object.assign({ roule: d }, ev), sortie);
      const m = V.euler(...sortie[k].r), orientation = Math.atan2(m[0][1], m[0][0]);
      const angle = Math.atan2(Math.sin(orientation - origine), Math.cos(orientation - origine));
      assert.ok(Math.abs(angle + d / r) <= .01 * d / r, `roue ${roue}, ${d} m : ${angle.toFixed(4)} au lieu de ${(-d / r).toFixed(4)}`);
      assert.ok(angle < 0 || d === 0, 'le haut de la roue part vers l’avant');
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

// Le cadrage dépend des yeux réels et de la projection de jeu.js ; ses scénarios paysage/portrait
// sont qualifiés dans camera-habitacle.test.mjs. Ici on vérifie les pièces métriques, sans cadrage fictif.
verifier('habitacle : géométrie indépendante de la caméra, volant au même ancrage monde', () => {
  const oeil = Array.from(V.OEIL), ev = { p: [0, 0, 0], cap: 0, pilote: { volant: 0, rapport: 3, passage: 1 } };
  const dehors = []; V.poser(mod, ev, dehors);
  const volant = mod.objetsRendu.pilote.variantes[0].pieces.find(p => p.role === 'volant').objet;
  const reference = Array.from(volant.p);
  V.OEIL[1] += .05;
  try {
    V.cockpit(mod, ev, [], { regime: 9000, volant: 0, rapport: 3, kmh: 180 });
    assert.deepEqual(Array.from(mod.objetsRendu.habitacle.jante.objet.p), reference);
  } finally { V.OEIL.forEach((_, i) => { V.OEIL[i] = oeil[i]; }); }
});

verifier('rétroviseurs : deux montages communs à la voiture et au cockpit', () => {
  const ev = { p: [0, 0, 0], cap: 0, pilote: { volant: 0, rapport: 3, passage: 1 } }, dehors = [];
  V.poser(mod, ev, dehors);
  const rig = mod.objetsRendu.pilote, H = mod.objetsRendu.habitacle;
  assert.equal(H.glaces.length, 2);
  for (let k = 0; k < 2; k++) for (const [role, source] of [['boitier', H.glaces[k].boitier], ['patte', H.glaces[k].patte], ['glace', H.glaces[k].vive]]) {
    const pc = rig.variantes[0].pieces.find(p => p.role === 'retro-' + role + '-' + k);
    assert.equal(pc.source, source);
    assert.ok(dehors.includes(pc.objet));
  }
});

verifier('cockpit : rotation du volant de 95° au plus', () => {
  assert.ok(deg(V.VOLANT.course) <= 95, `${deg(V.VOLANT.course).toFixed(1)}°`);
});

// Le segment [a, b] coupe-t-il le triangle (p0, p1, p2) ? (Möller et Trumbore)
function coupe(a, b, p0, p1, p2) {
  const d = b.map((v, i) => v - a[i]), e1 = p1.map((v, i) => v - p0[i]), e2 = p2.map((v, i) => v - p0[i]);
  const x = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], s = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const h = x(d, e2), det = s(e1, h);
  if (Math.abs(det) < 1e-12) return false;
  const q = a.map((v, i) => v - p0[i]), uu = s(q, h) / det, k = x(q, e1), vv = s(d, k) / det, t = s(e2, k) / det;
  return uu >= 0 && vv >= 0 && uu + vv <= 1 && t > 0 && t < 1;
}
const formeDe = nom => Object.values(V.FORMES).find(f => f.nom === nom);
// Sommets d'une instance de forme libre, à leur taille et à leur place.
function sommets(m) {
  const r = V.euler(...m.r), f = formeDe(m.shape), vus = [];
  for (const tri of f.tri) for (let k = 0; k < 3; k++) { const l = tri[k].map((v, i) => v * m.s[i]); vus.push([0, 1, 2].map(i => m.p[i] + r[0][i] * l[0] + r[1][i] * l[1] + r[2][i] * l[2])); }
  return vus;
}

verifier('cockpit : coque creuse, aucune pièce de carrosserie entre l’œil et le volant', () => {
  const sortie = [], ev = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0 };
  V.cockpit(mod, ev, sortie, { regime: 8000, volant: 0, rapport: 3, kmh: 180 });
  const carrosserie = sortie.slice(0, mod.corps.filter(p => V.visible(p, true, 0)).length);
  const fin = V.VOLANT.centre.map((v, i) => V.ORIGINE_HABITACLE[i] + V.K * v);
  for (const m of carrosserie) {
    if (m.fx) continue;
    const r = V.euler(...m.r), f = formeDe(m.shape);
    if (f) {
      // forme libre : chaque triangle, à sa taille et à sa place
      const monde = q => { const l = q.map((v, i) => v * m.s[i]); return [0, 1, 2].map(i => m.p[i] + r[0][i] * l[0] + r[1][i] * l[1] + r[2][i] * l[2]); };
      for (const t of f.tri) assert.ok(!coupe(V.OEIL, fin, monde(t[0]), monde(t[1]), monde(t[2])), `${m.shape} coupe la vue du volant`);
      continue;
    }
    const b = [0, 1, 2].map(i => { const d = [0, 1, 2].reduce((s, j) => s + Math.abs(r[j][i]) * m.s[j] / 2, 0); return [m.p[i] - d, m.p[i] + d]; });
    for (let k = 0; k <= 50; k++) {
      const q = V.OEIL.map((v, i) => v + (fin[i] - v) * k / 50);
      assert.ok(!q.every((v, i) => v > b[i][0] && v < b[i][1]), `${m.shape} en ${m.p.map(v => v.toFixed(2))} coupe la vue du volant`);
    }
  }
});

verifier('cockpit : seule la propre tête est masquée, coque et roues présentes', () => {
  const sortie = []; V.poser(mod, { p: [0, 0, 0], cap: 0 }, sortie, { cockpit: true, overlay: true });
  // Les sous-surfaces d'usure sont préallouées, mais un pneu neuf n'en dessine aucune.
  assert.equal(sortie.length, mod.corps.filter(p => !(p.tetePilote || p.vite || p.usureRoue > 1)).length);
  assert.ok(sortie.every(m => m.overlay) && sortie.some(m => m.shape.startsWith('bitume-pneu-av') && m.p[0] > 1.3));
});

// ---------------------------------------------------------------- détails de la voiture et cockpit vivant
const repos = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0 };
const bord = extra => { const sortie = []; V.cockpit(mod, Object.assign({ v: 40 }, repos), sortie, Object.assign({ regime: 9000, volant: 0, rapport: 3, kmh: 180 }, extra)); return sortie; };
const reel = v => v.map((x, i) => V.ORIGINE_HABITACLE[i] + V.K * x); // coordonnées de construction → mètres
const ecart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

verifier('numéro en géométrie ; roues sans barrettes blanches, valves extérieures à toute vitesse', () => {
  const sans = V.modele(Object.assign({}, livree, { numero: undefined })), un = V.modele(Object.assign({}, livree, { numero: 1 }));
  assert.equal(un.corps.length - sans.corps.length, 3 * 2, 'trois « 1 » de deux segments, sans panneau');
  assert.equal(mod.corps.length - sans.corps.length, 3 * (5 + 3), '« 27 » : cinq et trois segments, trois fois');
  const segments = mod.corps.filter(p => p.shape === 'box' && p.s[2] === .003);
  assert.equal(segments.length, 24);
  assert.ok(segments.every(p => p.color[0] > .9 && p.color[1] > .9 && p.color[2] > .85), 'chiffres blancs, posés sur le rouge');
  // David (16/11) : les roues doivent se voir tourner à toute vitesse ; plus de bande floue qui les figeait
  const lent = [], vite = [];
  V.poser(mod, Object.assign({ v: 10 }, repos), lent); V.poser(mod, Object.assign({ v: 50 }, repos), vite);
  const reperes = mod.corps.filter(p => p.shape === 'bitume-valve-roue');
  assert.equal(reperes.length, 4, 'une valve, sans paire de bandes blanches, sur chaque roue');
  assert.ok(!mod.corps.some(p => p.roue !== undefined && p.shape === 'box'), 'aucun pavé rapporté sur les roues');
  assert.ok(reperes.every(p => Math.abs(p.decale[0]) < .165 && Math.sign(p.decale[1]) === Math.sign(V.ROUES[p.roue].z)), 'valves sur la jante extérieure');
  assert.ok(reperes.every(p => Math.max(...p.color) < .3), 'petites valves sombres, pas de repère blanc');
  assert.equal(new Set(reperes.map(p => p.tourne)).size, 4, 'orientations de montage distinctes');
  assert.ok(!mod.corps.some(p => p.lent || p.vite), 'aucune pièce réservée à une vitesse');
  const vus = mod.corps.filter(p => !p.dedans && !(p.usureRoue > 1)).length;
  const piloteActifs = mod.objetsRendu.pilote.variantes[0].pieces.filter(p => lent.includes(p.objet)).length;
  assert.equal(lent.length, vus + piloteActifs);
  assert.equal(vite.length, lent.length);
});

verifier('valve : elle suit exactement la rotation de sa roue depuis son orientation de montage', () => {
  const w = V.ROUES[0], visibles = mod.corps.filter(p => V.visible(p, false, 5));
  const k = visibles.findIndex(p => p.roue === 0 && p.shape === 'bitume-valve-roue'), valve = visibles[k], rayon = valve.decale[0];
  for (const d of [0, .2, .7, 1.3]) {
    const sortie = []; V.poser(mod, Object.assign({ v: 5, roule: d }, repos), sortie);
    const q = sortie[k].p, a = valve.tourne - d / w.r;
    assert.ok(Math.abs(Math.hypot(q[0] - w.x, q[1] - w.r) - rayon) < 1e-9, 'rayon constant dans la jante');
    // la roue avance : son point avant descend
    assert.ok(Math.abs(q[0] - (w.x + rayon * Math.cos(a))) < 1e-9 && Math.abs(q[1] - (w.r + rayon * Math.sin(a))) < 1e-9, `après ${d} m : ${q.map(v => v.toFixed(3))}`);
  }
});

verifier('cockpit en carènes : habitacle sans boîte, jante d’un seul tube, pneus à épaules rondes', () => {
  const habitacle = mod.corps.filter(p => ['goutte', 'goutte-dedans', 'jonc', 'cuve'].some(n => p.shape === V.FORMES[n].nom));
  assert.ok(habitacle.length >= 4 && habitacle.every(p => p.shape.startsWith('bitume-')), habitacle.map(p => p.shape).join(' '));
  const sortie = bord({});
  assert.equal(sortie.filter(m => m.shape === 'bitume-jante').length, 1, 'une seule jante');
  assert.equal(sortie.filter(m => m.shape === 'bitume-planche' || m.shape === 'bitume-casquette').length, 2, 'planche et casquette arrondies');
  assert.equal(mod.corps.filter(p => p.shape.startsWith('bitume-pneu')).length, 4);
  assert.equal(new Set(sortie).size, sortie.length, 'aucune pièce dessinée deux fois');
});

verifier('cockpit : rien que des nombres finis, volant à fond et pendant un changement de rapport', () => {
  for (const volant of [-1, -.4, 0, .7, 1]) for (const passage of [0, .2, .45, .8, 1]) {
    const sortie = bord({ volant, passage, rapportAvant: 2, derriere: [{ x: -8, z: -1.5, couleur: [.1, .3, .8] }] });
    assert.ok(sortie.every(m => m.p.concat(m.s, m.r).every(Number.isFinite) && m.s.every(v => v > 0) && m.overlay), `volant ${volant}, passage ${passage}`);
  }
});

verifier('changement de rapport : la main droite va au pommeau, puis revient sur la jante', () => {
  const pommeau = t => bord({ passage: t, rapportAvant: 2 }).find(m => m.shape === 'sphere' && Math.abs(m.s[0] - .040 * V.K) < 1e-9).p;
  // sommets du gant droit, à leur place dans la voiture
  const gantDroit = t => sommets(bord({ passage: t, rapportAvant: 2 }).find(m => /^bitume-main-gant-d(-ouvert)?$/.test(m.shape)));
  const auPlusPres = (t, cible) => Math.min(...gantDroit(t).map(q => ecart(q, cible)));
  const tilt = V.VOLANT.inclinaison, a = V.VOLANT.prise;      // prise de la main droite, volant droit
  const prise = reel(V.VOLANT.centre.map((v, i) => v + V.VOLANT.rayon * ([Math.sin(tilt), Math.cos(tilt), 0][i] * Math.cos(a) + [0, 0, 1][i] * Math.sin(a))));
  assert.ok(auPlusPres(1, pommeau(1)) > .05, 'au repos, la main est loin du levier');
  const d0 = auPlusPres(.45, pommeau(.45));
  assert.ok(d0 > .040 * V.K / 2 && d0 < .040 * V.K / 2 + .025, `à mi-changement, la main est posée sur le pommeau sans s'enfoncer (${(d0 / V.K * 1000).toFixed(1)} mm du centre)`);
  assert.ok(auPlusPres(.45, prise) > .04 && auPlusPres(1, prise) < .02, 'elle a quitté la jante, puis y revient');
  // le pommeau passe de la position du 2e rapport (vers l'arrière) à celle du 3e (vers l'avant)
  assert.ok(pommeau(1)[0] - pommeau(0)[0] > .015, 'le levier avance de la 2e à la 3e');
});

// Inverse de la conversion de construction ; aucune transformation entre les vues.
const apparent = q => q.map((x, i) => (x - V.ORIGINE_HABITACLE[i]) / V.K);

verifier('mains : aucun sommet des gants dans les branches de 3 h et 9 h, volant droit ou tourné', () => {
  const { centre: C, rayon: R, inclinaison: tau, course } = V.VOLANT, e = R / .105;
  const wn = [-Math.cos(tau), Math.sin(tau), 0], wu = [Math.sin(tau), Math.cos(tau), 0], wr = [0, 0, 1];
  for (const volant of [0, .6, -1]) {
    const phi = volant * course, u = wu.map((v, k) => v * Math.cos(phi) + wr[k] * Math.sin(phi)), r = wu.map((v, k) => -v * Math.sin(phi) + wr[k] * Math.cos(phi));
    const axe = C.map((v, i) => v - .004 * wn[i]), sc = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const pieces = bord({ volant }).filter(m => m.shape.startsWith('bitume-main-'));
    assert.equal(pieces.length, 12, 'six pièces par main (avec dos de gant R4b)');
    for (const m of pieces) {
      const dir = m.shape.endsWith('-d') ? r : r.map(v => -v);
      const dedans = sommets(m).map(apparent).filter(p => {
        const q = p.map((v, i) => v - axe[i]), c = sc(q, dir);
        return c > .028 * e && c < .98 * R && Math.abs(sc(q, u)) < .0135 * e && Math.abs(sc(q, wn)) < .003;
      });
      assert.equal(dedans.length, 0, `${m.shape}, volant ${volant} : ${dedans.length} sommets dans la branche`);
    }
  }
});

verifier('les deux manches restent présentes : aucune suppression de géométrie pour le cadrage', () => {
  const sortie = bord({}), H = mod.objetsRendu.habitacle;
  for (const main of H.mains) {
    assert.equal(main.tubes.length, 6); assert.equal(main.boules.length, 6);
    for (const p of [...main.pieces, ...main.tubes, ...main.boules]) assert.ok(sortie.includes(p.objet));
  }
});

verifier('lampe de régime : allumée au-dessus de 12 000 tr/min, sauf au dernier rapport', () => {
  const lampe = extra => { const sortie = bord(extra), objet = mod.objetsRendu.habitacle.lampe.objet;
    assert.ok(sortie.includes(objet), 'la vraie lampe est présente dans le rendu'); return objet; };
  assert.ok(!(lampe({ regime: 11000 }).emissive > 0), 'éteinte à 11 000');
  assert.ok(lampe({ regime: 12400 }).emissive >= 3, 'allumée à 12 400');
  assert.ok(!(lampe({ regime: 12400, rapport: 6 }).emissive > 0), 'éteinte en 6e');
});

verifier('rétroviseurs : une voiture derrière à gauche se voit dans la glace de gauche, à sa place', () => {
  const vide = bord({}), gauche = bord({ derriere: [{ x: -10, z: -3, couleur: [.1, .3, .8] }] }), loin = bord({ derriere: [{ x: -200, z: -3, couleur: [.1, .3, .8] }] });
  assert.equal(gauche.length - vide.length, 2, 'caisse et pneus');
  assert.equal(loin.length, vide.length, 'trop loin : rien');
  const reflet = gauche.find(m => m.color[2] === .8 && m.color[0] === .1);
  // glaces de la vue cockpit (David, 16/11 : rétroviseurs bien visibles) : voir V.RETRO
  const R = V.RETRO;
  assert.ok(Math.abs(reflet.p[2] + R.z) < R.l / 2 && Math.abs(reflet.p[1] - R.y) < R.h / 2, `reflet en ${reflet.p.map(v => v.toFixed(3))}`);
  // plus la voiture est à gauche, plus son reflet est à gauche ; plus elle est près, plus il est grand
  const z = zr => bord({ derriere: [{ x: -14, z: zr, couleur: [.1, .3, .8] }] }).find(m => m.color[2] === .8 && m.color[0] === .1);
  assert.ok(z(-5).p[2] < z(-2).p[2] - .01, 'ordre gauche-droite');
  const pres = bord({ derriere: [{ x: -5, z: -2, couleur: [.1, .3, .8] }] }).find(m => m.color[2] === .8 && m.color[0] === .1);
  assert.ok(pres.s[2] > z(-2).s[2] * 1.5, 'taille selon la distance');
  // droit derrière, à 12 m : visible dans les deux glaces
  assert.equal(bord({ derriere: [{ x: -12, z: 0, couleur: [.1, .3, .8] }] }).length - vide.length, 4);
});

verifier('silhouette : le flanc est fermé derrière la roue avant (voi-1)', () => {
  const sortie = [];
  V.poser(mod, { p: [0, 0, 0], cap: 0, v: 0 }, sortie);
  const tris = [];
  for (const m of sortie) {
    if (m.fx) continue;
    const nom = /^bitume-(.*)$/.exec(m.shape)?.[1];
    if (!nom) continue;
    const f = V.FORMES[nom], M = m.m || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const monde = v => [0, 1, 2].map(k => m.p[k] + M[0][k] * v[0] * f.taille[0] + M[1][k] * v[1] * f.taille[1] + M[2][k] * v[2] * f.taille[2]);
    for (const t of f.tri) tris.push([monde(t[0]), monde(t[1]), monde(t[2])]);
  }
  const touche = (x, y) => tris.some(([a, b, c]) => {
    const d1 = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    const d2 = (c[0] - b[0]) * (y - b[1]) - (c[1] - b[1]) * (x - b[0]);
    const d3 = (a[0] - c[0]) * (y - c[1]) - (a[1] - c[1]) * (x - c[0]);
    return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
  });
  let trous = 0;
  for (let y = .12; y <= .301; y += .02) for (let x = .60; x <= 1.001; x += .02) if (!touche(x, y)) trous++;
  assert.equal(trous, 0, `${trous} points percés à jour entre x 0,60 et 1,00, y 0,12 et 0,30`);
});

verifier('formes libres : chaque triangle est orienté vers l\'extérieur en vraie grandeur (garde rendu-1)', () => {
  let n = 0;
  for (const nom of Object.keys(V.FORMES)) {
    const f = V.FORMES[nom];
    for (let j = 0; j < f.tri.length; j++) {
      const t = f.tri[j], p = r => [0, 1, 2].map(k => t[r][k] * f.taille[k] + f.centre[k]);
      const [p0, p1, p2] = [p(0), p(1), p(2)];
      const a = [0, 1, 2].map(k => p1[k] - p0[k]), b = [0, 1, 2].map(k => p2[k] - p0[k]);
      const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const nn = [0, 1, 2].map(k => t[3][k] / f.taille[k]);
      assert.ok(c[0] * nn[0] + c[1] * nn[1] + c[2] * nn[2] > 0, `${nom}#${j} : normale géométrique opposée à n0`);
      n++;
    }
  }
  assert.ok(n > 5000, `${n} triangles contrôlés`);
});

verifier('numéros : encre lisible sur les douze livrées de course (voi-2)', () => {
  const lum = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  const contraste = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
  const COURSE = globalThis.BITUME.course;
  assert.ok(COURSE && COURSE.LIVREES, 'course.js expose ses livrées');
  for (const [i, lv] of COURSE.LIVREES.entries()) {
    const m = V.modele({ couleur: lv[0], seconde: lv[1], numero: 27 });
    const seg = m.corps.filter(p => p.shape === 'box' && p.s[2] === .003);
    assert.equal(seg.length, 24, `livrée ${i} : 24 segments`);
    const encre = seg[0].color;
    assert.ok(seg.every(p => p.color.join() === encre.join()), `livrée ${i} : une seule encre`);
    assert.ok(contraste(lv[0], encre) >= 3, `livrée ${i} : contraste ${contraste(lv[0], encre).toFixed(2)} < 3`);
  }
  // le rouge du joueur garde le blanc du plan maître
  const joueur = mod.corps.filter(p => p.shape === 'box' && p.s[2] === .003)[0].color;
  assert.ok(joueur[0] > .9 && joueur[1] > .9, 'blanc sur le rouge du joueur');
});

verifier('numéro de flanc : calé entre la bande basse et le filet (voi-3)', () => {
  const seg = mod.corps.filter(p => p.shape === 'box' && p.s[2] === .003 && Math.abs(p.o[2]) > .6);
  assert.equal(seg.length, 16, `${seg.length} segments de flanc`);
  const bas = Math.min(...seg.map(p => p.o[1] - p.s[1] / 2)), haut = Math.max(...seg.map(p => p.o[1] + p.s[1] / 2));
  assert.ok(bas > .17, `bas du numéro à ${bas.toFixed(4)} : sous la bande (0,17)`);
  assert.ok(haut < .357, `haut du numéro à ${haut.toFixed(4)} : sous le filet (0,357)`);
});

verifier('jonc de l\'ouverture : suit le bord, ne bombe pas hors de l\'ouverture (voi-4)', () => {
  // Un seul maillage regroupe le jonc du cockpit et le joint de la bulle.
  // Les îlots de triangles soudés sont distincts même lorsque leurs abscisses se recouvrent.
  const f = V.FORMES.jonc, voisins = new Map(), abscisses = new Map();
  for (const t of f.tri) {
    const points = t.slice(0, 3).map(p => {
      const cle = p.map(x => Math.round(x * 1e6)).join(',');
      if (!voisins.has(cle)) voisins.set(cle, new Set());
      abscisses.set(cle, p[0] * f.taille[0] + f.centre[0]); return cle;
    });
    for (const a of points) for (const b of points) voisins.get(a).add(b);
  }
  const bornes = [];
  for (const cle of abscisses.keys()) {
    if (!voisins.has(cle)) continue;
    const sommets = [cle];
    let min = Infinity, max = -Infinity;
    while (sommets.length) {
      const a = sommets.pop(), adjacents = voisins.get(a);
      if (!adjacents) continue;
      voisins.delete(a);
      min = Math.min(min, abscisses.get(a)); max = Math.max(max, abscisses.get(a));
      for (const b of adjacents) if (voisins.has(b)) sommets.push(b);
    }
    bornes.push([min, max]);
  }
  bornes.sort((a, b) => a[0] - b[0]);
  assert.equal(bornes.length, 2, 'deux joints continus, ouverture et embase du saute-vent');
  const [[xMin, xMax], [embaseMin, embaseMax]] = bornes;
  const bulle = V.FORMES.bulle, avant = bulle.centre[0] + bulle.taille[0] / 2, arriere = bulle.centre[0] - bulle.taille[0] / 2;
  assert(Math.abs(embaseMin - arriere) < .006 && Math.abs(embaseMax - avant) < .006, 'joint de 4,5 mm au pied de la bulle');
  assert.ok(xMax < 1.33, `jonc bombe à x ${xMax.toFixed(4)} au-delà du bord avant 126 CK (1,30)`);
  assert.ok(xMin > .39, `jonc bombe à x ${xMin.toFixed(4)} au-delà du bord arrière 126 CK (0,44)`);
});

verifier('suspension avant : les attaches intérieures touchent la peau de la quille ou de la cuve (voi-7)', () => {
  const sous = (a, b) => a.map((v, k) => v - b[k]);
  const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const scal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // 126 CK : la coque avancée (cuve) atteint x = 1,54 ; l'attache avant repose sur la quille et l'arrière sur la cuve.
  const tris = ['quille', 'cuve'].flatMap(nom => {
    const f = V.FORMES[nom];
    return f.tri.map(t => [0, 1, 2].map(r => [0, 1, 2].map(k => t[r][k] * f.taille[k] + f.centre[k])));
  });
  const frappe = (o, d) => {
    let best = Infinity;
    for (const [a, b, c] of tris) {
      const e1 = sous(b, a), e2 = sous(c, a), tvec = sous(o, a), p = croix(d, e2), q = croix(tvec, e1);
      const det = scal(e1, p); if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det, u = scal(tvec, p) * inv; if (u < -1e-9 || u > 1 + 1e-9) continue;
      const v = scal(d, q) * inv; if (v < -1e-9 || u + v > 1 + 1e-9) continue;
      const t = scal(e2, q) * inv; if (t > 1e-9 && t < best) best = t;
    }
    return best;
  };
  const g = V.FORMES['triangles'];
  const pts = g.tri.flatMap(t => [0, 1, 2].map(r => [0, 1, 2].map(k => t[r][k] * g.taille[k] + g.centre[k])));
  const touche = (x, y) => { const anneau = [...new Set(pts.filter(p => Math.abs(p[0] - x) < .012 && Math.abs(p[1] - y) < .012 && p[2] > 0)
    .map(p => p.map(v => v.toFixed(6)).join()))].map(s => s.split(',').map(Number));
    assert.ok(anneau.length >= 6, `pas d'attache à x ${x}`);
    return Math.min(...anneau.map(p => Math.min(frappe(p, [0, 0, 1]), frappe(p, [0, 0, -1])))); };
  // le tube d'attache (r 0,011) doit toucher la peau de la quille, sinon il flotte dans l'air
  assert.ok(touche(1.52, .15) <= .011 + 1e-6, 'attache avant détachée de la quille');
  assert.ok(touche(1.18, .15) <= .011 + 1e-6, 'attache arrière détachée de la quille');
});

verifier('rétroviseurs : le proche s\'enfonce plus que le lointain, reflet contenu dans la glace (cockpit-1/5)', () => {
  // repère de chaque glace de la vue cockpit (V.cadreGlace) : profondeur vers le pilote, position le long de la glace
  const R = V.RETRO, local = m => { const g = V.cadreGlace(Math.sign(m.p[2])), d = m.p.map((v, i) => v - g.c[i]);
    return { vers: d[0] * g.n[0] + d[2] * g.n[2], u: d[0] * g.w[0] + d[2] * g.w[2], v: d[1] }; };
  const deux = bord({ derriere: [{ x: -10, z: -3, couleur: [.9, .1, .1] }, { x: -20, z: -6, couleur: [.1, .1, .9] }] });
  const pres = deux.find(m => m.color && m.color.join() === [.9, .1, .1].join());
  const loin = deux.find(m => m.color && m.color.join() === [.1, .1, .9].join());
  assert.ok(pres && loin, 'les deux suiveurs ont un reflet');
  assert.ok(local(pres).vers > local(loin).vers + 1e-9, `proche à ${local(pres).vers.toFixed(5)}, lointain à ${local(loin).vers.toFixed(5)} vers le pilote : le proche doit être devant`);
  const pneu = deux.find(m => m.mat === 7 && m.color.join() === [.03, .03, .035].join() && Math.abs(local(m).u - local(pres).u) < 1e-9 && m.p[1] < pres.p[1]);
  assert.ok(pneu && local(pneu).vers > local(pres).vers + 1e-9, 'la bande de pneus est devant la caisse, vue du pilote');
  // reflet contenu : suiveurs proches et décalés, des deux côtés
  const pres2 = bord({ derriere: [{ x: -2.5, z: 1.5, couleur: [.9, .1, .1] }, { x: -5, z: -1.5, couleur: [.1, .1, .9] }] });
  const reflets = pres2.filter(m => (m.mat === 16 && (m.color.join() === [.9, .1, .1].join() || m.color.join() === [.1, .1, .9].join()) || m.mat === 7 && m.color.join() === [.03, .03, .035].join()) && Math.abs(local(m).vers) < .02);
  assert.equal(reflets.length, 4, `${reflets.length} reflets (2 caisses, 2 pneus)`);
  for (const m of reflets) {
    const q = local(m);
    assert.ok(Math.abs(q.v) + m.s[1] / 2 <= R.h / 2 + 1e-9, `reflet hors glace en hauteur : ${q.v.toFixed(4)} ± ${(m.s[1] / 2).toFixed(4)}`);
    assert.ok(Math.abs(q.u) + m.s[2] / 2 <= R.l / 2 + 1e-9, `reflet hors glace en largeur : ${q.u.toFixed(4)} ± ${(m.s[2] / 2).toFixed(4)}`);
  }
});

verifier('témoin rouge : s\'allume au ralenti comme au surrégime (cockpit-8)', () => {
  const auRalenti = bord({ regime: 4000 }).find(m => m.shape === 'sphere' && m.mat === 5 && Math.abs(m.s[0] - .009 * V.K) < 1e-9 && m.color[0] > .9);
  assert.ok(auRalenti && auRalenti.emissive >= 1, 'allumé au ralenti (4 000 tr/min)');
  const calme = bord({ regime: 8000 }).find(m => m.shape === 'sphere' && m.mat === 5 && Math.abs(m.s[0] - .009 * V.K) < 1e-9 && m.color[0] > .9);
  assert.ok(!calme, 'éteint à mi-régime');
});

verifier('goutte : par l\'ouverture, on ne voit pas l\'envers de la peau au-delà des bords (carene-2)', () => {
  const sous = (a, b) => a.map((v, k) => v - b[k]);
  const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const scal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const monde = nom => { const f = V.FORMES[nom]; return f.tri.map(t => [0, 1, 2].map(r => [0, 1, 2].map(k => t[r][k] * f.taille[k] + f.centre[k]))); };
  const frappe = (o, d, tris) => {
    let best = Infinity;
    for (const [a, b, c] of tris) {
      const e1 = sous(b, a), e2 = sous(c, a), tvec = sous(o, a), p = croix(d, e2), q = croix(tvec, e1);
      const det = scal(e1, p); if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det, u = scal(tvec, p) * inv; if (u < -1e-9 || u > 1 + 1e-9) continue;
      const v = scal(d, q) * inv; if (v < -1e-9 || u + v > 1 + 1e-9) continue;
      const t = scal(e2, q) * inv; if (t > 1e-9 && t < best) best = t;
    }
    return best;
  };
  const peau = monde('goutte'), doublure = monde('goutte-dedans');
  let testes = 0, perce = 0;
  for (const o of [[.1, .45, 0], [-.1, .45, .1]]) {
    for (const t of peau) {
      const g = [0, 1, 2].map(k => (t[0][k] + t[1][k] + t[2][k]) / 3);
      const n = croix(sous(t[1], t[0]), sous(t[2], t[0]));
      const d = sous(g, o), ld = Math.hypot(...d); if (ld < .05) continue;
      if (scal(n, d) < 0) continue; // seul l'envers de la peau, vu de la cavité, doit être doublé
      testes++;
      const dir = d.map(v => v / ld);
      if (frappe(o, dir, doublure) > frappe(o, dir, peau) + 1e-3) perce++;
    }
  }
  assert.ok(testes > 100, `${testes} faces d'envers testées`);
  assert.equal(perce, 0, `${perce}/${testes} faces d'envers vues à travers l'ouverture`);
});

verifier('pouce du gant : aucune face enfouie dans son propre volume (carene-4)', () => {
  const sous = (a, b) => a.map((v, k) => v - b[k]);
  const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const scal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const M = globalThis.BITUME.main, C = globalThis.BITUME.carene, deg = Math.PI / 180;
  const a = M.AXE, bz = [0, 1, 0], Y = croix(bz, a);
  const K = M.AUTOUR(0, 95 * deg, .034), W = K.map((v, k) => v + a[k] * .088);
  const eminence = M.POUCE.eminence.map(([x, y, z]) => {
    const u = W.map((v, k) => v - a[k] * x), p = u.map((v, k) => v + bz[k] * y - Y[k] * z); return p;
  });
  const tour = M.POUCE.tour.map(([s, t], i) => M.AUTOUR(s / M.JANTE.R, t * deg, M.JANTE.r + M.POUCE.r[i + 2] + 4 * M.JEU));
  const mesh = C.tube([...eminence, ...tour], M.POUCE.r, { cotes: 12, pas: 4, bouts: true });
  const dedans = p => {
    let n = 0;
    for (const [A, B, Cc] of mesh) {
      const e1 = sous(B, A), e2 = sous(Cc, A), tvec = sous(p, A), pv = croix([0, 0, 1], e2), q = croix(tvec, e1);
      const det = scal(e1, pv); if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det, u = scal(tvec, pv) * inv; if (u < -1e-9 || u > 1 + 1e-9) continue;
      const v = scal([0, 0, 1], q) * inv; if (v < -1e-9 || u + v > 1 + 1e-9) continue;
      const t = scal(e2, q) * inv; if (t > 1e-9) n++;
    }
    return n % 2 === 1;
  };
  let enfouies = 0;
  for (const t of mesh) {
    const g = [0, 1, 2].map(k => (t[0][k] + t[1][k] + t[2][k]) / 3);
    const n = croix(sous(t[1], t[0]), sous(t[2], t[0])), l = Math.hypot(...n);
    assert.ok(l > 1e-12, 'face dégénérée dans le pouce');
    if (dedans(g.map((v, k) => v + n[k] / l * 3e-4))) enfouies++;
  }
  assert.equal(enfouies, 0, `${enfouies} faces du pouce sous sa propre peau (coude trop serré)`);
});

verifier('habitacle vu du haut : par l\'ouverture on voit la cuve sombre, pas le dessus rouge des pontons (voi-5)', () => {
  const sous = (a, b) => a.map((v, k) => v - b[k]);
  const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const scal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const rouge = c => c && c[0] > .4 && c[1] < .25 && c[2] < .25;
  const vus = [];
  for (const p of mod.corps) {
    const f = V.FORMES[String(p.shape).replace(/^bitume-/, '')];
    if (!f) continue;
    for (const t of f.tri) vus.push({ c: [0, 1, 2].map(r => [0, 1, 2].map(k => t[r][k] * p.s[k] + p.o[k])), p });
  }
  const cam = [-4, 6, 0];
  let rouges = 0, total = 0;
  // Ouverture 126 CK : x ∈ [0,44 ; 1,30]. On sonde le fond visible hors silhouette du pilote.
  for (let x = .55; x <= 1.251; x += .025) for (let z = -.12; z <= .121; z += .02) {
    const cible = [x, .30, z], d0 = sous(cible, cam), l0 = Math.hypot(...d0), d = d0.map(v => v / l0);
    let best = Infinity, piece = null, pt = null;
    for (const { c, p } of vus) {
      const [a, b, cc] = c, e1 = sous(b, a), e2 = sous(cc, a), tvec = sous(cam, a), pv = croix(d, e2), q = croix(tvec, e1);
      const det = scal(e1, pv); if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det, u = scal(tvec, pv) * inv; if (u < -1e-9 || u > 1 + 1e-9) continue;
      const v = scal(d, q) * inv; if (v < -1e-9 || u + v > 1 + 1e-9) continue;
      const t = scal(e2, q) * inv; if (t > 1e-9 && t < best) { best = t; piece = p; pt = cam.map((vv, k) => vv + d[k] * t); }
    }
    assert.ok(piece, `rayon vers (${x.toFixed(2)} ; ${z.toFixed(2)}) ne voit rien`);
    if (piece.pilote) continue; // le pilote meuble l'habitacle, il n'est pas un défaut
    if (pt[0] < .44 || pt[0] > 1.30 || Math.abs(pt[2]) > .2 || pt[1] > .55) continue; // hors du volume d'habitacle : carrosserie normale
    total++;
    if (rouge(piece.color)) rouges++;
  }
  assert.ok(total > 40, `${total} rayons juges hors pilote`);
  assert.equal(rouges, 0, `${rouges}/${total} rayons voient la carrosserie rouge à travers l'ouverture`);
});

verifier('bande des pontons : une peau décalée de 4 mm, pas un caisson à flancs droits (voi-6)', () => {
  const sous = (a, b) => a.map((v, k) => v - b[k]);
  const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const scal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const monde = f => f.tri.map(t => [0, 1, 2].map(r => [0, 1, 2].map(k => t[r][k] * f.taille[k] + f.centre[k])));
  const B = monde(V.FORMES['bande']), P = monde(V.FORMES['pontons']);
  const distTri = (p, [a, b, c]) => {
    const e1 = sous(b, a), e2 = sous(c, a), ap = sous(p, a);
    const d1 = scal(e1, e1), d2 = scal(e1, e2), d3 = scal(e1, ap), d4 = scal(e2, e2), d5 = scal(e2, ap);
    const den = d1 * d4 - d2 * d2;
    let u = den > 1e-12 ? Math.max(0, Math.min(1, (d4 * d3 - d2 * d5) / den)) : 0;
    let v = den > 1e-12 ? Math.max(0, Math.min(1 - u, (d1 * d5 - d2 * d3) / den)) : 0;
    return Math.hypot(...sous(p, a.map((x, k) => x + e1[k] * u + e2[k] * v)));
  };
  let pires = 0;
  for (const t of B) {
    const g = [0, 1, 2].map(k => (t[0][k] + t[1][k] + t[2][k]) / 3);
    let d = Infinity;
    for (const p of P) d = Math.min(d, distTri(g, p));
    assert.ok(d >= .002 && d <= .008, `face de bande à ${(g[0]).toFixed(2)} ; ${g[1].toFixed(3)} ; ${g[2].toFixed(2)} : ${d.toFixed(3)} m de la peau du ponton, attendu 4 mm`);
    pires = Math.max(pires, d);
  }
  assert.ok(B.length > 100, `${B.length} faces de bande`);
});

verifier('paume au pommeau : paume vers le bas quel que soit le braquage (cockpit-4)', () => {
  for (const volant of [-1, -.6, 0, .6, 1]) {
    const gant = bord({ volant, passage: .45, rapportAvant: 2 }).find(p => /^bitume-main-gant-d(-ouvert)?$/.test(p.shape));
    assert.ok(gant, 'gant droit dessiné au pommeau');
    const paume = V.euler(...gant.r)[2], l = Math.hypot(...paume);
    const angle = Math.acos(Math.max(-1, Math.min(1, -paume[1] / l))) * 180 / Math.PI;
    assert.ok(angle < 40, `volant ${volant} : paume à ${angle.toFixed(1)}° du bas, attendu l\'inclinaison du volant (~25°)`);
  }
});

verifier('trajet au pommeau : les doigts ne traversent ni la jante ni la branche de 3 h (cockpit-3)', () => {
  const { centre: C, rayon: R, inclinaison: tau, course } = V.VOLANT, e = R / .105;
  const wn = [-Math.cos(tau), Math.sin(tau), 0], wu = [Math.sin(tau), Math.cos(tau), 0], wr = [0, 0, 1];
  const rtube = .0225 * e / 2, sc = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const phi = 0, u = wu, r = wr, axe = C.map((v, i) => v - .004 * wn[i]);
  let dansTore = 0, pireTore = 0, dansBranche = 0, dansBoule = 0;
  for (let t = 0; t <= 1.0001; t += .01) {
    const sortie = bord({ volant: 0, passage: t, rapportAvant: 2 });
    const pieces = sortie.filter(m => /^bitume-main-.*-d(-ouvert|-prise-\d+)?$/.test(m.shape));
    assert.equal(pieces.length, 6, 'six pièces à la main droite (avec dos de gant R4b)');
    const cBoule = apparent(sortie.find(m => m.shape === 'sphere' && Math.abs(m.s[0] - .040 * V.K) < 1e-9).p);
    for (const m of pieces) for (const q0 of sommets(m)) {
      const q = apparent(q0);
      const v = q.map((x, i) => x - C[i]), h = sc(v, wn), rho = Math.hypot(...v.map((x, i) => x - h * wn[i]));
      const d = Math.hypot(rho - R, h);
      if (d < rtube) { dansTore++; pireTore = Math.max(pireTore, rtube - d); }
      const w = q.map((x, i) => x - axe[i]), c = sc(w, r);
      if (c > .028 * e && c < .98 * R && Math.abs(sc(w, u)) < .0135 * e && Math.abs(sc(w, wn)) < .003) dansBranche++;
      // Rayon réel de la boule : 0,040 / 2 = 0,020 en unités de construction (cf. ligne 226).
      if (Math.hypot(...q.map((x, i) => x - cBoule[i])) < .020) dansBoule++;
    }
  }
  assert.equal(dansTore, 0, `${dansTore} sommets dans le tore de la jante, jusqu\'à ${(pireTore * 1000).toFixed(1)} mm de pénétration`);
  assert.equal(dansBranche, 0, `${dansBranche} sommets dans la branche de 3 h pendant le trajet`);
  assert.equal(dansBoule, 0, `${dansBoule} sommets dans la boule du pommeau pendant le trajet`);
});

verifier('le joueur et les concurrents allument et relâchent indépendamment leur feu stop à tous les niveaux de détail', () => {
  const rival = V.modele({...livree, numero: 8});
  const lentille = V.FORMES['feu-stop-lentille'].nom;
  function dessiner(modele, detail, feuStop) {
    const sortie = [], pose = {p:[0,0,0],cap:0,tangage:0,roulis:0,braquage:0,roule:0,v:24,feuStop};
    V.poser(modele,pose,sortie,{detail});
    const lampes = sortie.filter(o => o.shape === lentille);
    assert.equal(lampes.length,1);
    return lampes[0];
  }
  for(const detail of ['complet','moyen','simple']) {
    const joueur = dessiner(mod,detail,true), concurrent = dessiner(rival,detail,false);
    assert(joueur.emissive >= 4 && joueur.color[0] > .9);
    assert.equal(concurrent.emissive,0); assert(concurrent.color[0] < .25);
    assert.strictEqual(dessiner(rival,detail,true),concurrent);
    assert.strictEqual(dessiner(mod,detail,false),joueur);
    assert.equal(joueur.emissive,0); assert(concurrent.emissive >= 4);
  }
});

verifier('le choc arrière garde le nez intact, le frontal le raccourcit et les deux chocs obliques le plient en sens opposés', () => {
  const pose={p:[0,0,0],cap:0,tangage:0,roulis:0,braquage:0,roule:0,v:24};
  const arriere={avant:0,arriere:.9,pli:0}, frontal={avant:.8,pli:0};
  const gauche={avant:.65,pli:.4}, droite={avant:.65,pli:-.4};
  function objets(detail,zonesDegats){
    const l=[];V.poser(mod,{...pose,zonesDegats},l,{detail});
    return l.map(o=>({shape:o.shape,p:[...o.p],s:[...o.s],r:o.r?Array.from(o.r):undefined}));
  }
  for(const detail of ['complet','moyen','simple']){
    const intact=objets(detail), apres=objets(detail,frontal);
    assert.deepEqual(objets(detail,arriere),intact);
    assert.equal(apres.length,intact.length);
    assert.ok(apres.some(o=>o.shape.includes('-plie-')));
    for(let i=0;i<intact.length;i++) if(!apres[i].shape.includes('-plie-') && intact[i].p[0]<.98)
      assert.deepEqual(apres[i],intact[i],intact[i].shape);
    assert.deepEqual(objets(detail),intact,'une pose réparée retrouve les pièces saines');
  }
  function pointe(zones){
    const p=[2.12,.235,0];
    return V.pointSurNez(V.FORMES.fleche.nom,V.profilImpact(zones),p);
  }
  assert.deepEqual(pointe(arriere),[2.12,.235,0]);
  assert.ok(pointe(frontal)[0]<1.9);assert.equal(pointe(frontal)[2],0);
  assert.ok(pointe(gauche)[2]>.1);assert.ok(pointe(droite)[2]<-.1);
});

console.log(`${compte} vérifications réussies`);
