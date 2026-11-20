import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { optionsHabitacle, optionsScenarioHabitacle, SCENARIOS_HABITACLE, SCENARIOS_COCKPIT, verifierHabitacle, chaufferInstantCockpit } from '../tools/captures-habitacle.mjs';
import { horlogeCapture } from '../tools/controle-visuel.mjs';
import { SEUILS_COCKPIT, DISTANCES_ROUTE, BANDES_ROUTE, mesurerLisibiliteCockpit, installerObservationCockpit } from '../tools/qualification/cockpit-lisibilite.mjs';

test('inspection bornée à neuf scènes et deux images, vrais cockpits et LOD par distance', () => {
  const base = ['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/habitacle'];
  const o = optionsHabitacle(base);
  assert.equal(o.cas.length, 9);
  for (const s of SCENARIOS_HABITACLE) {
    const p = optionsScenarioHabitacle(s, o.url, '/tmp/' + s.id, o);
    assert.equal(p.images, 2); assert.equal(p.referenceJeu.vue, s.cockpit ? 'cockpit' : 'poursuite');
    assert.equal(p.referenceJeu.retro, s.cockpit ? 'oui' : 'non');
    assert.deepEqual(p.taille, s.taille ? [540, 960] : [960, 540]);
  }
  for (const ajout of [['--cas', 'face,face'], ['--cas', 'inconnu'], ['--taille', '2,2'], ['--forcing', 'simple'], ['--avant', 'https://example.com/a']])
    assert.throws(() => optionsHabitacle([...base, ...ajout]));
  assert.throws(() => optionsHabitacle([...base, '--url', 'file:///tmp/b.html']));
});

function rapport(s) {
  const cam = { pos: [1, 2, 3], yaw: .2, pitch: -.1, roll: 0, fov: 40 };
  const o = { type: s.duo ? 'duo' : 'course', ecran: 'course', vue: s.cockpit ? 'cockpit' : 'poursuite', vue2: s.duo ? 'cockpit' : null, cameraImposee: !s.cockpit,
    camera: cam, cameraPrescrite: s.cockpit ? null : structuredClone(cam), glErreur: 0, glPerdu: false,
    obstructionStatique: false, volant: s.volant || 0, rapport: 3, rapportAvant: s.passage ? 2 : 3, passage: .5,
    expression: { geste: s.geste || null, gesteIntensite: s.geste ? 1 : 0 },
    variantes: s.lod ? [{ indice: s.lod === 'moyen' ? 6 : 2, niveau: s.lod === 'moyen' ? 1 : 2, pieces: 30 }] : [],
    articulations: Array(18).fill(0), formes: { 'pilote-casque': [], 'pilote-visiere': [] },
    instruments: { plancheAttendue: 54, plancheRendue: 54, aiguillesRendues: 3, supportsRendus: 5, retrosRendus: 2 } };
  return { source: { commit: 'a'.repeat(40) }, build: { sha256: 'b'.repeat(64) },
    environnement: { webgl2: true, physx: { ready: true }, resolution: [...(s.taille ? s.taille.split(',').map(Number) : [960, 540]), 1] },
    initialisation: { entree: 'BITUME_JEU.reference', posesPrescrites: true,
      ...(s.qualification && s.cockpit ? { observation: { methode: 'copie passive des triangles opaques transmis au draw original' } } : {}) }, erreurs: [], avertissements: [],
    images: Array.from({ length: s.images }, () => ({ observation: structuredClone(o), etat: { zones: { scene: {}, ...(s.cockpit ? { 'glace-g': {}, 'glace-d': {} } : {}),
      ...(s.duo ? { scene2: {}, 'glace-g2': {}, 'glace-d2': {} } : {}) } },
      vues: { scene: { noir: .1, luminance: .5 }, ...(s.duo ? { scene2: { noir: .1, luminance: .5 } } : {}) } })) };
}

test('identité exacte, caméra finale et état WebGL sont nécessaires même pour la référence', () => {
  const s = SCENARIOS_HABITACLE[0], r = rapport(s);
  assert.deepEqual(verifierHabitacle(r, s), []);
  for (const changer of [
    r => { r.build.sha256 = ''; }, r => { r.source.commit = null; }, r => { r.environnement.physx.ready = false; },
    r => { r.images[0].observation.camera = null; }, r => { r.images[0].observation.camera.pos[0] += 1; },
    r => { r.images[0].observation.cameraPrescrite.pitch = NaN; }, r => { r.images[0].observation.obstructionStatique = true; },
    r => { r.images[0].observation.glErreur = 1282; }, r => { r.images[0].observation.cameraImposee = false; }
  ]) {
    const faux = structuredClone(r); changer(faux); assert(verifierHabitacle(faux, s, false).length);
  }
});

test('qualification ciblée : douze PNG, cinq dispositions, deux vrais cockpits dans les deux partages', () => {
  assert.equal(SCENARIOS_COCKPIT.reduce((n, s) => n + s.images, 0), 12);
  const cas = SCENARIOS_COCKPIT.map(s => s.id).join(','), o = optionsHabitacle(['--url', 'file:///tmp/b.html', '--sortie', '/tmp/c', '--cas', cas]);
  assert.equal(o.cas.length, 7);
  for (const s of SCENARIOS_COCKPIT) {
    const p = optionsScenarioHabitacle(s, o.url, '/tmp/' + s.id, o);
    assert.deepEqual(p.taille, s.taille.split(',').map(Number)); assert.equal(p.images, s.images);
    assert.equal(p.referenceJeu.mode, s.duo ? 'duo' : 'solo');
    if (s.duo) { assert.equal(p.referenceJeu.vue, 'cockpit'); assert.equal(p.referenceJeu.vue2, 'cockpit'); assert.equal(p.referenceJeu.partage, s.partage); }
  }
  assert.deepEqual(SEUILS_COCKPIT, { routeCadreeMin: .9, routeOcculteeMax: .05, routeCentraleOcculteeMax: 0,
    largeurGlaceMax: .18, erreurDomMaxPx: 2, recouvrementMaxPx2: 1 });
});

function contexteChauffe() {
  const S = { locaux: [0, 1], course: { voitures: [0, 1].map(() => ({ etat: { v: 35, volant: .2, braquage: .024 } })) },
    prec: [0, 1].map(x => ({ x, y: 2, z: 3, braquage: .024 })), cour: [0, 1].map(x => ({ x, y: 2, z: 3, braquage: .024 })),
    tete: { y: 1 }, vueJ2: { tete: { y: 2 } } };
  const contexte = vm.createContext({ BITUME_JEU: { session: S }, __HABITACLE_CAPTURE: { sujet: 0, relever: true, releves: { ancien: true } } });
  vm.runInContext('globalThis.window = globalThis', contexte);
  vm.runInContext(horlogeCapture(17017), contexte);
  vm.runInContext(`globalThis.frames = [];
    function image(t) {
      const F = __HABITACLE_CAPTURE;
      frames.push({ t, relever: F.relever, instant: F.instant });
      if (F.relever) F.releves.derniereFrame = frames.length;
      requestAnimationFrame(image);
    }
    requestAnimationFrame(image);`, contexte);
  let enCours = false;
  const evaluer = async expression => {
    assert.equal(enCours, false, 'les commandes CDP doivent rester séquentielles'); enCours = true;
    try {
      await new Promise(resolve => setImmediate(resolve));
      const avant = contexte.frames.length, r = vm.runInContext(expression, contexte);
      assert(contexte.frames.length - avant <= 1, 'une commande CDP ne doit pas concentrer plusieurs rendus');
      return r;
    } finally { enCours = false; }
  };
  return { contexte, S, evaluer };
}

test('chauffe cockpit : 24 rappels réels séparés, mêmes poses duo, relevé uniquement sur la frame suivante', async () => {
  for (const i of [0, 1]) {
    const { contexte, S, evaluer } = contexteChauffe(), rapport = { scenario: 'temoin-duo' };
    await chaufferInstantCockpit({ evaluer, rapport, i });
    assert.equal(contexte.frames.length, 24); assert(contexte.frames.every(f => !f.relever));
    assert(Math.abs(contexte.frames.at(-1).t - 1400) < 1e-8, 'les 24 pas de 1/60 s restent identiques');
    assert.deepEqual(Object.keys(contexte.__HABITACLE_CAPTURE.releves), []);
    assert.equal(S.tete, null); assert.equal(S.vueJ2.tete, null);
    for (let j = 0; j < 2; j++) {
      const e = S.course.voitures[j].etat, volant = i ? j ? -.65 : .65 : 0;
      assert.equal(e.v, i ? 80 : 0); assert.equal(e.volant, volant); assert.equal(e.braquage, volant * .12);
      for (const poses of [S.prec, S.cour]) assert.deepEqual(poses[j], { x: j, y: 2, z: 3, braquage: volant * .12 });
    }
    assert.equal(rapport.phasesHabitacle.at(-1).etat, 'attendus', 'une chauffe terminée ne prouve pas que le PNG existe');
    await evaluer('__BITUME_CAPTURE.avancer(1000 / 60)'); // frame que le capturer rend avant son PNG
    assert.equal(contexte.__HABITACLE_CAPTURE.releves.derniereFrame, 25);
    assert.equal(contexte.frames.at(-1).instant, i ? 'vitesse-braquage' : 'neutre');
  }
});

test('une commande de chauffe interrompue reste un échec tracé et n’arme pas une observation incomplète', async () => {
  const { contexte, evaluer } = contexteChauffe(), rapport = { scenario: 'temoin-interruption' };
  await assert.rejects(chaufferInstantCockpit({ i: 1, rapport, evaluer: expression => {
    if (contexte.frames.length === 5) throw new Error('CDP interrompu au sixième pas');
    return evaluer(expression);
  } }), /CDP interrompu/);
  assert.equal(contexte.frames.length, 5); assert.equal(contexte.__HABITACLE_CAPTURE.relever, false);
  assert.deepEqual(Object.keys(contexte.__HABITACLE_CAPTURE.releves), []);
  const derniere = rapport.phasesHabitacle.at(-1);
  assert.equal(derniere.phase, 'chauffe-6/24'); assert.equal(derniere.etat, 'echec');
  assert.match(derniere.erreur, /CDP interrompu/);
});

// Géométrie indépendante, construite depuis un plan image connu ; les rayons visent le sol y=0.
function sceneMesure(roll = 0) {
  const camera = { pos: [0, 1, 0], yaw: 0, pitch: 0, roll, fov: 60, near: .1 };
  const viewport = { x: 0, y: 0, width: 1000, height: 600 }, tan = Math.tan(Math.PI / 6);
  const monde = ([x, y], profondeur = 2) => { const u = (2 * x - 1) * profondeur * tan * 1000 / 600, v = (1 - 2 * y) * profondeur * tan;
    return [u * Math.cos(roll) - v * Math.sin(roll), 1 + u * Math.sin(roll) + v * Math.cos(roll), -profondeur]; };
  const triangle = (role, points, profondeur) => ({ role, shape: 'triangle-temoin', points: points.map(p => monde(p, profondeur)) });
  const glace = (id, cx, cy, largeur = .12) => {
    const quad = [[cx - largeur / 2, cy - .03], [cx + largeur / 2, cy - .03], [cx + largeur / 2, cy + .03], [cx - largeur / 2, cy + .03]];
    return { id, visible: true, monde: quad.map(p => monde(p)), dom: quad.map(p => [p[0] * 1000, p[1] * 600]) };
  };
  const d = { camera, viewport,
    triangles: [triangle('volant', [[.4, .84], [.6, .84], [.5, .65]]), triangle('gant-0', [[.31, .78], [.36, .78], [.335, .70]]),
      triangle('gant-1', [[.64, .78], [.69, .78], [.665, .70]])],
    route: DISTANCES_ROUTE.flatMap(distance => BANDES_ROUTE.map(bande => ({ distance, bande, point: [bande * 4, 0, -distance] }))),
    glaces: [glace('g', .2, .6), glace('d', .8, .6)] };
  return { d, triangle, glace };
}

test('chaussée : vrai sol, faces opaques, plan proche et roulis, sans faux masque par les faces arrière', () => {
  for (const roll of [0, .15, -.15]) {
    const { d, triangle } = sceneMesure(roll);
    assert.deepEqual(mesurerLisibiliteCockpit(d, SEUILS_COCKPIT).erreurs, []);
    const obstacle = triangle('carrosserie', [[.3, .6], [.7, .6], [.5, .45]]);
    for (const t of [{ ...obstacle, points: [...obstacle.points].reverse() },
      triangle('carrosserie', [[.3, .6], [.7, .6], [.5, .45]], .01), triangle('carrosserie', [[.3, .6], [.7, .6], [.5, .45]], 100)]) {
      assert.deepEqual(mesurerLisibiliteCockpit({ ...d, triangles: [...d.triangles, t] }, SEUILS_COCKPIT).erreurs, []);
    }
  }
});

test('contrôles négatifs : ancien œil trop bas et obstacle réel devant une chaussée pourtant projetée', () => {
  const { d, triangle } = sceneMesure();
  const ancien = structuredClone(d); ancien.camera.pos[1] = .45;
  const r = mesurerLisibiliteCockpit(ancien, SEUILS_COCKPIT);
  assert.equal(r.route.cadree, 1); assert(r.route.centreOcculte > 0); assert(r.erreurs.includes('Chaussée utile occultée par le cockpit'));
  const obstacle = triangle('carrosserie', [[.3, .6], [.7, .6], [.5, .45]]);
  const bloque = mesurerLisibiliteCockpit({ ...d, triangles: [...d.triangles, obstacle] }, SEUILS_COCKPIT);
  assert.equal(bloque.route.cadree, 1); assert.equal(bloque.route.centreOcculte, 1);
  assert(bloque.route.points.some(p => p.touche?.shape === 'triangle-temoin'));
  assert(bloque.erreurs.includes('Chaussée utile occultée par le cockpit'));
});

test('contrôles négatifs : glace sur le volant, sur un gant, trop grande ou DOM désolidarisé', () => {
  for (const [x, y, role] of [[.5, .75, 'volant'], [.335, .74, 'gant-0'], [.665, .74, 'gant-1']]) {
    const { d, glace } = sceneMesure(); d.glaces[0] = glace('g', x, y, .06);
    const r = mesurerLisibiliteCockpit(d, SEUILS_COCKPIT);
    assert(r.glaces[0].erreurDomPx < 1e-8); assert(r.glaces[0].recouvrements.find(t => t.role === role).airePx2 > 1);
    assert(r.erreurs.includes('Glace superposée au volant/gant : g'));
  }
  const { d, glace } = sceneMesure();
  const grand = structuredClone(d); grand.glaces[0] = glace('g', .2, .6, .25);
  assert(mesurerLisibiliteCockpit(grand, SEUILS_COCKPIT).erreurs.includes('Glace trop large : g'));
  d.glaces[0].dom.forEach(p => { p[0] += 20; });
  assert(mesurerLisibiliteCockpit(d, SEUILS_COCKPIT).erreurs.includes('Glace DOM désolidarisée du boîtier : g'));
});

test('les quadrilatères/triangles importent, pas leur seule boîte, et les données absentes échouent', () => {
  const { d, glace } = sceneMesure();
  d.glaces[0] = glace('g', .41, .68, .015); // dans la boîte du volant, hors de sa surface triangulaire
  assert.deepEqual(mesurerLisibiliteCockpit(d, SEUILS_COCKPIT).erreurs, []);
  for (const changer of [x => { x.route.pop(); }, x => { x.triangles = []; }, x => { x.triangles[0].points[0][0] = NaN; },
    x => { x.glaces[0].visible = false; }, x => { x.glaces[0].dom = []; }, x => { x.glaces.pop(); }, x => { x.camera.near = NaN; }]) {
    const faux = structuredClone(d); changer(faux); assert(mesurerLisibiliteCockpit(faux, SEUILS_COCKPIT).erreurs.length);
  }
});

test('le rapport exige les deux états, les deux joueurs et les erreurs réelles de géométrie', () => {
  for (const s of SCENARIOS_COCKPIT) {
    const r = rapport(s);
    if (s.cockpit) for (const [i, im] of r.images.entries()) {
      const o = im.observation; o.instant = i ? 'vitesse-braquage' : 'neutre'; o.volant = i ? .65 : 0;
      o.lisibilite = Array.from({ length: s.duo ? 2 : 1 }, (_, j) => ({ joueur: j + 1, sujet: j,
        vitesse: i ? 80 : 0, volant: i ? j ? -.65 : .65 : 0, ...mesurerLisibiliteCockpit(sceneMesure().d, SEUILS_COCKPIT) }));
    }
    assert.deepEqual(verifierHabitacle(r, s), [], s.id);
    if (!s.cockpit) continue;
    for (const changer of [x => { x.images[1].observation.instant = 'neutre'; },
      x => { delete x.initialisation.observation; },
      x => { x.images[1].observation.lisibilite[0].vitesse = 0; }, x => { x.images[0].observation.lisibilite.pop(); },
      x => { x.images[0].observation.lisibilite[0].erreurs.push('Chaussée utile occultée par le cockpit'); }]) {
      const faux = structuredClone(r); changer(faux); assert(verifierHabitacle(faux, s).length, s.id);
    }
    if (s.duo) {
      const faux = structuredClone(r); faux.images[0].observation.lisibilite[1].joueur = 1;
      assert(verifierHabitacle(faux, s).length);
    }
  }
});

test('observation passive : même draw et mêmes arguments, copie distincte J2 puis J1 malgré la liste partagée', () => {
  const noms = ['BITUME_JEU', 'BITUME', 'FRender', '__HABITACLE_CAPTURE', 'document'], anciens = Object.fromEntries(noms.map(n => [n, globalThis[n]]));
  try {
    const objet = x => ({ shape: 'tri', p: [x, 0, 0], s: [1, 1, 1], r: [0, 0, 0], overlay: true });
    const modeles = [0, 10].map(x => { const jante = { objet: objet(x) }, mains = [0, 1].map(() => ({ pieces: [{ objet: objet(x) }] }));
      return { objetsRendu: { habitacle: { jante, volant: [jante], mains }, tables: [] } }; });
    const S = { locaux: [0, 1], modeles, cour: [0, 1].map(() => ({ x: 0, y: 0, z: 0, cap: 0, tangage: 0, roulis: 0 })),
      course: { c: { largeur: 10 }, voitures: [0, 1].map(() => ({ etat: { v: 0, volant: 0, s: 280 } })) } };
    const appels = [], retour = {};
    const rendu = { draw(...args) { appels.push({ instance: this, args }); return retour; } };
    globalThis.BITUME_JEU = { session: S, rendu }; globalThis.__HABITACLE_CAPTURE = { sujet: 0 };
    globalThis.FRender = { shared: { geometry: () => ({ vertices: new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1]), indices: [0, 1, 2], ranges: { tri: { offset: 0, count: 3 } } }) } };
    globalThis.BITUME = { voiture: { euler: () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]], glacesCockpit: () => sceneMesure().d.glaces.map(g => ({ coins: g.monde })) },
      circuit: { point: (c, s, d) => [s, 0, d] } };
    globalThis.document = { getElementById: () => ({ clientWidth: 720, clientHeight: 900, getBoundingClientRect: () => ({ x: 0, y: 0 }) }),
      querySelector: () => ({ getBoundingClientRect: () => ({ x: 720, y: 0 }) }) };
    installerObservationCockpit(); __HABITACLE_CAPTURE.relever = true;
    const liste = [], cam = sceneMesure().d.camera, fx = {};
    for (const j of [1, 0]) { const H = modeles[j].objetsRendu.habitacle; liste.splice(0, liste.length, H.jante.objet, ...H.mains.map(m => m.pieces[0].objet));
      assert.equal(rendu.draw(cam, liste, fx), retour); }
    assert.equal(appels.length, 2); assert(appels.every(a => a.instance === rendu && a.args[0] === cam && a.args[1] === liste && a.args[2] === fx));
    const q = __HABITACLE_CAPTURE.releves; assert.deepEqual(Object.keys(q), ['0', '1']);
    assert.equal(q[0].triangles[0].points[0][0], 0); assert.equal(q[1].triangles[0].points[0][0], 10);
    modeles[1].objetsRendu.habitacle.jante.objet.p[0] = 99; assert.equal(q[1].triangles[0].points[0][0], 10);
    assert.equal(q[1].viewport.x, 720);
  } finally { for (const n of noms) if (anciens[n] === undefined) delete globalThis[n]; else globalThis[n] = anciens[n]; }
});

test('les instruments réellement présents sont distincts du modèle disponible et des anciens manques', () => {
  const s = SCENARIOS_HABITACLE[0], r = rapport(s);
  for (const changer of [
    o => { o.instruments.aiguillesRendues = 0; }, o => { o.instruments.plancheRendue = 2; },
    o => { o.instruments.retrosRendus = 1; }, o => { o.instruments.supportsRendus = 0; },
    o => { o.articulations = null; }, o => { o.articulations[3] = NaN; }
  ]) {
    const faux = structuredClone(r); changer(faux.images[0].observation);
    assert(verifierHabitacle(faux, s, true).length); assert.deepEqual(verifierHabitacle(faux, s, false), []);
  }
});

test('cockpit, passage, geste, portrait et LOD refusent leurs faux positifs', () => {
  for (const s of SCENARIOS_HABITACLE) assert.deepEqual(verifierHabitacle(rapport(s), s), [], s.id);
  for (const [id, changer] of [
    ['cockpit', r => { r.images[0].observation.cameraImposee = true; }],
    ['cockpit', r => { delete r.images[0].etat.zones['glace-g']; }],
    ['cockpit', r => { r.images[0].observation.formes['pilote-casque'].push({}); }],
    ['cockpit-portrait', r => { r.environnement.resolution = [960, 540, 1]; }],
    ['braquage-passage', r => { r.images[0].observation.passage = 1; }],
    ['braquage-passage', r => { r.images[0].observation.volant = 0; }],
    ['geste-majeur', r => { r.images[0].observation.expression.gesteIntensite = .1; }],
    ['lod-moyen', r => { r.images[0].observation.variantes[0].niveau = 0; }],
    ['lod-simple', r => { r.images[0].observation.variantes = []; }]
  ]) {
    const s = SCENARIOS_HABITACLE.find(s => s.id === id), faux = rapport(s); changer(faux);
    assert(verifierHabitacle(faux, s).length, id);
  }
});
