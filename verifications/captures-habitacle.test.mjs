import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { optionsHabitacle, optionsScenarioHabitacle, SCENARIOS_HABITACLE, SCENARIOS_COCKPIT, verifierHabitacle, chaufferInstantCockpit } from '../tools/captures-habitacle.mjs';
import { horlogeCapture } from '../tools/controle-visuel.mjs';
import { SEUILS_COCKPIT, DISTANCES_ROUTE, BANDES_ROUTE, mesurerLisibiliteCockpit, mesurerSuperpositionsHud, installerObservationCockpit, observerLisibiliteCockpit } from '../tools/qualification/cockpit-lisibilite.mjs';

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

test('référence seule : option explicite et exclusive du couple avant/après', () => {
  const base = ['--url', 'file:///tmp/reference.html', '--sortie', '/tmp/reference', '--cas', 'cockpit-paysage'];
  const o = optionsHabitacle([...base, '--reference-seule', 'oui']);
  assert.equal(o['reference-seule'], 'oui');
  assert.deepEqual(o.cas, ['cockpit-paysage']); assert.equal(o.url, 'file:///tmp/reference.html'); assert.equal(o.avant, undefined);
  for (const valeur of ['non', 'true', '1']) assert.throws(() => optionsHabitacle([...base, '--reference-seule', valeur]));
  assert.throws(() => optionsHabitacle([...base, '--reference-seule', 'oui', '--avant', 'file:///tmp/autre.html']));
});

function rapport(s) {
  const cam = { pos: [1, 2, 3], yaw: .2, pitch: -.1, roll: 0, fov: 40 };
  const o = { type: s.duo ? 'duo' : 'course', ecran: 'course', vue: s.cockpit ? 'cockpit' : 'poursuite', vue2: s.duo ? 'cockpit' : null, cameraImposee: !s.cockpit,
    reglagesHud: { carte: 'oui', cartePosition: s.cartePosition || 'droite', carteTaille: s.carteTaille || 'normale', tableau: s.tableau || 'reduit', annoncesVirages: 'ecran' }, rivalDistance: s.rival || null,
    camera: cam, cameraPrescrite: s.cockpit ? null : structuredClone(cam), glErreur: 0, glPerdu: false,
    obstructionStatique: false, volant: s.volant || 0, rapport: 3, rapportAvant: s.passage ? 2 : 3, passage: .5,
    expression: { geste: s.geste || null, gesteIntensite: s.geste ? 1 : 0 },
    variantes: s.lod ? [{ indice: s.lod === 'moyen' ? 6 : 2, niveau: s.lod === 'moyen' ? 1 : 2, pieces: 30 }] : [],
    articulations: Array(18).fill(0), formes: { 'pilote-casque': [], 'pilote-visiere': [] },
    instruments: { plancheAttendue: 54, plancheRendue: 54, aiguillesRendues: 3, supportsRendus: 5, retrosRendus: 2 } };
  return { source: { commit: 'a'.repeat(40) }, build: { sha256: 'b'.repeat(64) },
    environnement: { webgl2: true, physx: { ready: true }, resolution: [...(s.taille ? s.taille.split(',').map(Number) : [960, 540]), 1] },
    initialisation: { entree: 'BITUME_JEU.reference', posesPrescrites: true, reglagesHud: structuredClone(o.reglagesHud),
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

test('qualification ciblée : vingt-deux PNG, cas historiques conservés, braquages stabilisés symétriques et duo compact distincts', () => {
  assert.equal(SCENARIOS_COCKPIT.reduce((n, s) => n + s.images, 0), 22);
  const cas = SCENARIOS_COCKPIT.map(s => s.id).join(','), o = optionsHabitacle(['--url', 'file:///tmp/b.html', '--sortie', '/tmp/c', '--cas', cas]);
  assert.equal(o.cas.length, 12);
  for (const id of ['cockpit-compact', 'cockpit-carte-gauche']) {
    const s = SCENARIOS_COCKPIT.find(s => s.id === id);
    assert(s?.cockpit); assert.equal(s.taille, '960,540'); assert.equal(s.images, 2);
    assert.equal(s.chauffe, 24); assert.equal(s.pas, 1 / 60);
    assert.equal(s.chauffeInstant, 24); assert.equal(s.volantVitesse, .65);
    assert.equal(s.rival, 18);
    assert.deepEqual([s.cartePosition, s.carteTaille, s.tableau], id === 'cockpit-compact' ? ['droite', 'normale', 'reduit'] : ['gauche', 'grande', 'complet']);
  }
  for (const [id, volant, cote] of [['cockpit-carte-gauche-stabilise', -.35, 'gauche'], ['cockpit-carte-droite-stabilise', .35, 'droite']]) {
    const s = SCENARIOS_COCKPIT.find(s => s.id === id), ancien = SCENARIOS_COCKPIT.find(s => s.id === 'cockpit-carte-gauche');
    assert.equal(s.volantVitesse, volant); assert.equal(s.chauffeInstant, 120); assert.equal(s.pas, 1 / 60);
    assert.equal(s.cartePosition, cote);
    for (const cle of ['cockpit', 'taille', 'rival', 'carteTaille', 'tableau', 'images', 'chauffe']) assert.equal(s[cle], ancien[cle], cle);
  }
  const compact = SCENARIOS_COCKPIT.find(s => s.id === 'cockpit-duo-compact');
  assert.deepEqual([compact.taille, compact.duo, compact.partage, compact.volantVitesse, compact.chauffeInstant], ['960,540', true, 'haut-bas', .65, 24]);
  for (const s of SCENARIOS_COCKPIT) {
    const p = optionsScenarioHabitacle(s, o.url, '/tmp/' + s.id, o);
    assert.deepEqual(p.taille, s.taille.split(',').map(Number)); assert.equal(p.images, s.images);
    assert.equal(p.referenceJeu.mode, s.duo ? 'duo' : 'solo');
    if (s.duo) { assert.equal(p.referenceJeu.vue, 'cockpit'); assert.equal(p.referenceJeu.vue2, 'cockpit'); assert.equal(p.referenceJeu.partage, s.partage); }
  }
  assert.deepEqual(SEUILS_COCKPIT, { routeCadreeMin: .9, routeOcculteeMax: .05, routeCentraleOcculteeMax: 0,
    largeurGlaceMax: .18, erreurDomMaxPx: 2, recouvrementMaxPx2: 1 });
});

function contexteChauffe(scenario = {}) {
  const S = { locaux: [0, 1], course: { voitures: [0, 1].map(() => ({ etat: { v: 35, volant: .2, braquage: .024 } })) },
    prec: [0, 1].map(x => ({ x, y: 2, z: 3, braquage: .024 })), cour: [0, 1].map(x => ({ x, y: 2, z: 3, braquage: .024 })),
    tete: { y: 1 }, vueJ2: { tete: { y: 2 } } };
  const contexte = vm.createContext({ BITUME_JEU: { session: S }, __HABITACLE_CAPTURE: { scenario, sujet: 0, relever: true, releves: { ancien: true } } });
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

test('braquages stabilisés : 120 rappels réels de 1/60 s, signes prescrits et relevé après la chauffe', async () => {
  for (const s of SCENARIOS_COCKPIT.filter(s => s.chauffeInstant === 120)) for (const i of [0, 1]) {
    const { contexte, S, evaluer } = contexteChauffe(s), rapport = { scenarioHabitacle: s.id };
    await chaufferInstantCockpit({ evaluer, rapport, i }, s);
    assert.equal(contexte.frames.length, 120); assert(contexte.frames.every(f => !f.relever));
    assert(Math.abs(contexte.frames.at(-1).t - 3000) < 1e-8, 'deux secondes commandées en 120 pas');
    const phases = rapport.phasesHabitacle.filter(e => e.phase.startsWith('chauffe-'));
    assert.equal(phases.length, 120); assert.equal(phases.at(-1).phase, 'chauffe-120/120');
    for (let j = 0; j < 2; j++) {
      const volant = i ? j ? -s.volantVitesse : s.volantVitesse : 0;
      assert.equal(S.course.voitures[j].etat.volant, volant);
      assert.equal(S.course.voitures[j].etat.v, i ? 80 : 0);
      for (const poses of [S.prec, S.cour]) assert.equal(poses[j].braquage, volant * .12);
    }
    await evaluer('__BITUME_CAPTURE.avancer(1000 / 60)');
    assert.equal(contexte.__HABITACLE_CAPTURE.releves.derniereFrame, 121);
  }
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
  const d = { joueur: 1, camera, viewport,
    hud: { observe: true, racine: 'hud', joueur: 1, rectangles: [{ id: 'hud:compteur', x: 20, y: 10, width: 120, height: 35 }] },
    triangles: [triangle('volant', [[.4, .84], [.6, .84], [.5, .65]]), triangle('gant-0', [[.31, .78], [.36, .78], [.335, .70]]),
      triangle('gant-1', [[.64, .78], [.69, .78], [.665, .70]])],
    route: DISTANCES_ROUTE.flatMap(distance => BANDES_ROUTE.map(bande => ({ distance, bande, point: [bande * 4, 0, -distance] }))),
    glaces: [glace('g', .2, .6), glace('d', .8, .6)] };
  return { d, triangle, glace };
}

function rapportCockpit(s, masqueHud = false) {
  const r = rapport(s);
  if (s.chauffeInstant === 120) r.phasesHabitacle = [0, 1].flatMap(image => Array.from({ length: 120 }, (_, n) => ({
    image, phase: `chauffe-${n + 1}/120`, etat: 'terminee', horloge: { temps: 1000 + (image * 121 + n + 1) * 1000 / 60, callbacks: 1, attente: 1 } })));
  if (s.cockpit) for (const [i, im] of r.images.entries()) {
    const o = im.observation, volantVitesse = s.volantVitesse ?? .65;
    o.instant = i ? 'vitesse-braquage' : 'neutre'; o.volant = i ? volantVitesse : 0;
    o.lisibilite = Array.from({ length: s.duo ? 2 : 1 }, (_, j) => {
      const { d } = sceneMesure(); d.joueur = j + 1; d.hud.joueur = j + 1; d.hud.racine = j ? 'hud2' : 'hud';
      d.hud.rectangles.forEach(h => { h.id = d.hud.racine + ':compteur'; });
      d.hud.rectangles.push({ id: d.hud.racine + ':carte:0', x: s.cartePosition === 'gauche' ? 300 : 600, y: 10, width: 100, height: 100 });
      if (i) d.hud.rectangles.push({ id: d.hud.racine + ':h-virage:0', x: 20, y: 170, width: 140, height: 40 });
      if (s.tableau === 'complet') d.hud.rectangles.push(
        { id: d.hud.racine + ':vitesse:0', x: 900, y: 480, width: 80, height: 40 },
        { id: d.hud.racine + ':h-regime:0', x: 900, y: 530, width: 80, height: 30 });
      if (masqueHud) d.hud.rectangles.push({ id: d.hud.racine + ':classement:ligne0', x: 170, y: 350, width: 40, height: 20 });
      return { joueur: j + 1, sujet: j, vitesse: i ? 80 : 0, volant: i ? j ? -volantVitesse : volantVitesse : 0, ...mesurerLisibiliteCockpit(d, SEUILS_COCKPIT) };
    });
  }
  return r;
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

test('HUD : une glace, un point central de chaussée ou une commande masqués échouent aux seuils inchangés', () => {
  const { d } = sceneMesure(), libre = mesurerLisibiliteCockpit(d, SEUILS_COCKPIT);
  assert.deepEqual(libre.erreurs, []);
  const rect = (x, y, width, height) => ({ id: 'hud:obstacle', x, y, width, height });
  const mesurer = r => mesurerLisibiliteCockpit({ ...d, hud: { ...d.hud, rectangles: [r] } }, SEUILS_COCKPIT);
  const glace = mesurer(rect(170, 350, 40, 20));
  assert.equal(glace.glaces[0].recouvrementPx2, 0, 'le modèle seul ne masque pas la glace');
  assert(glace.glaces[0].hudRecouvrementPx2 > SEUILS_COCKPIT.recouvrementMaxPx2);
  assert(glace.erreurs.includes('HUD superposé à la glace : g'));
  const point = libre.route.points.find(p => p.bande === 0).ecran;
  const route = mesurer(rect(point[0] - 2, point[1] - 2, 4, 4));
  assert.equal(route.route.cadree, 1); assert.equal(route.route.centreOcculte, .25);
  assert(route.route.points.some(p => p.bande === 0 && p.hud.includes('hud:obstacle')));
  assert(route.erreurs.some(e => /Chaussée utile occultée/.test(e)));
  for (const [r, role] of [[rect(325, 434, 20, 20), 'gant-0'], [rect(490, 430, 20, 20), 'volant']]) {
    const commande = mesurer(r);
    assert(commande.hud.commandes.find(c => c.role === role).recouvrementPx2 > SEUILS_COCKPIT.recouvrementMaxPx2);
    assert(commande.erreurs.includes('HUD superposé à la commande : ' + role));
  }
  assert.deepEqual(mesurer(rect(410, 405, 10, 10)).erreurs, [], 'un HUD dans la boîte du volant mais hors de ses triangles reste admis');
});

test('HUD : données absentes, incomplètes, invalides ou empruntées à l’autre joueur refusées', () => {
  for (const changer of [d => { delete d.hud; }, d => { d.hud.observe = false; }, d => { d.hud.rectangles = []; },
    d => { d.hud.rectangles[0] = null; }, d => { d.hud.rectangles[0].width = NaN; }, d => { d.hud.rectangles[0].height = -1; }, d => { d.hud.joueur = 2; }]) {
    const { d } = sceneMesure(); changer(d);
    assert(mesurerLisibiliteCockpit(d, SEUILS_COCKPIT).erreurs.some(e => /HUD/.test(e)));
  }
});

test('HUD interne : annonce sur POSITION/TOUR, carte et FPS sont détectés au seuil de 1 px²', () => {
  for (const id of ['h-virage', 'carte', 'h-fps']) {
    const rectangles = [{ id: 'hud:' + id + ':0', x: 16, y: 45, width: 160, height: 32 },
      { id: 'hud:grand:1', compteur: 'c-position', x: 24, y: 35, width: 60, height: 26 },
      { id: 'hud:grand:2', compteur: 'c-tour', x: 124, y: 35, width: 50, height: 26 }];
    const r = mesurerSuperpositionsHud(rectangles, SEUILS_COCKPIT);
    assert.equal(r.recouvrements.length, 2); assert.equal(r.erreurs.length, 2);
    for (const compteur of ['c-position', 'c-tour']) assert(r.erreurs.some(e => e.includes(compteur)), compteur);
    assert(r.recouvrements.every(p => p.airePx2 > 1 && p.source === rectangles[0].id));
    rectangles[1] = { ...rectangles[1], x: 175, y: 76, width: 20, height: 20 }; rectangles.pop();
    assert.deepEqual(mesurerSuperpositionsHud(rectangles, SEUILS_COCKPIT).erreurs, [], 'un pixel carré reste toléré');
    rectangles[1].x -= .01;
    assert.equal(mesurerSuperpositionsHud(rectangles, SEUILS_COCKPIT).erreurs.length, 1, 'au-delà du même seuil le conflit échoue');
  }
  const { d } = sceneMesure();
  d.hud.rectangles.push({ id: 'hud:h-virage:0', x: 20, y: 10, width: 120, height: 35 });
  const r = vm.runInNewContext(`(${mesurerLisibiliteCockpit.toString()})(d, seuils, ${mesurerSuperpositionsHud.toString()})`, { d, seuils: SEUILS_COCKPIT });
  assert(r.erreurs.some(e => /Éléments HUD superposés/.test(e)), 'le diagnostic sérialisé dans la page appelle le même oracle');
  assert.equal(r.hud.superpositions.length, 1);
});

test('HUD interne : propre rectangle, parent/enfant et autre joueur exclus ; frères distincts conservés', () => {
  const annonce = { id: 'hud:h-virage:0', element: 'hud:element-1', ancetres: ['hud:element-0'], x: 20, y: 20, width: 100, height: 40 };
  const rectangles = [annonce, { ...annonce }, { ...annonce, id: 'hud:h-virage:fragment' },
    { ...annonce, id: 'hud:annonce-texte:1', element: 'hud:element-2', ancetres: ['hud:element-1', 'hud:element-0'] },
    { ...annonce, id: 'hud:conteneur:2', element: 'hud:element-0', ancetres: [] },
    { ...annonce, id: 'hud2:h-fps:0', element: 'hud2:element-1', ancetres: [] }];
  assert.deepEqual(mesurerSuperpositionsHud(rectangles, SEUILS_COCKPIT).erreurs, []);
  rectangles.push({ ...annonce, id: 'hud:grand:3', element: 'hud:element-3', compteur: 'c-position' });
  assert(mesurerSuperpositionsHud(rectangles, SEUILS_COCKPIT).erreurs.some(e => /c-position/.test(e)), 'un ancêtre commun ne doit pas supprimer un conflit entre frères');
  const paire = [annonce, { ...annonce, id: 'hud:carte:4', element: 'hud:element-4' }];
  assert.equal(mesurerSuperpositionsHud(paire, SEUILS_COCKPIT).recouvrements.length, 1, 'un conflit entre deux blocs surveillés est compté une fois');
});

test('HUD DOM : rectangles transformés propres à J1/J2, clipping et visibilité réelle sans conteneurs vides', () => {
  const style = { display: 'block', visibility: 'visible', opacity: '1', overflowX: 'visible', overflowY: 'visible',
    borderTopWidth: '0px', borderRightWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px', backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none' };
  const element = (id, selecteur, rectangle, extra = {}) => ({ id, selecteur, hidden: false, textContent: 'visible',
    parentElement: null, style: { ...style }, clientWidth: rectangle.width / .6, clientHeight: rectangle.height / .6,
    getClientRects: () => [rectangle], getBoundingClientRect: () => rectangle, ...extra });
  const racines = [0, 1].map(j => element(j ? 'hud2' : 'hud', '', { x: j * 720, y: 0, width: 720, height: 900 }));
  const noeuds = racines.map((racine, j) => {
    const x = j * 720;
    const liste = [element('h-pos', '.compteurs > .case > *', { x: x + 12, y: 18, width: 60, height: 24 }),
      element('c-position', '.compteurs > .case', { x: x + 12, y: 16, width: 60, height: 28 },
        { style: { ...style, borderTopWidth: '2px', borderTopStyle: 'solid', borderTopColor: 'rgb(0, 200, 0)' } }),
      element('carte', '#carte', { x: x + 700, y: 80, width: 60, height: 70 }),
      element('transparent', '.hud-haut', { x, y: 0, width: 720, height: 900 }),
      element('h-virage', '#h-virage', { x: x + 200, y: 60, width: 160, height: 40 }, { hidden: true }),
      element('h-regime', '.tableau .regime', { x: x + 500, y: 700, width: 80, height: 40 }, { style: { ...style, display: 'none' } }),
      element('b-pause', '#b-pause', { x: x + 650, y: 700, width: 40, height: 40 }, { style: { ...style, visibility: 'hidden' } }),
      element('message', '#message', { x: x + 180, y: 200, width: 360, height: 50 }, { textContent: '' }),
      element('sous-message', '#sous-message', { x: x + 180, y: 260, width: 360, height: 50 }, { style: { ...style, opacity: '0' } }),
      element('h-fps', '#h-fps', { x: x + 20, y: 890, width: 60, height: 22 })];
    for (const e of liste) e.parentElement = racine;
    liste[0].parentElement = liste[1];
    racine.querySelectorAll = selecteurs => liste.filter(e => selecteurs.split(',').map(s => s.trim()).includes(e.selecteur));
    return liste;
  });
  const contexte = vm.createContext({ document: { getElementById: id => racines.find(r => r.id === id) }, getComputedStyle: e => e.style,
    __HABITACLE_CAPTURE: { relever: true, releves: Object.fromEntries(racines.map((r, j) => [j, {
      joueur: j + 1, sujet: j, viewport: { x: j * 720, y: 0, width: 720, height: 900 }, glaces: [] }])) } });
  const observer = () => JSON.parse(JSON.stringify(vm.runInContext(`(${observerLisibiliteCockpit.toString()})(d => ({ hud: d.hud }), {})`, contexte)));
  const avant = JSON.stringify(noeuds.map(l => l.map(e => ({ id: e.id, hidden: e.hidden, style: e.style, rect: e.getClientRects() }))));
  const r = observer();
  assert.equal(contexte.__HABITACLE_CAPTURE.relever, false);
  for (let j = 0; j < 2; j++) {
    assert.equal(r[j].hud.observe, true); assert.equal(r[j].hud.racine, racines[j].id); assert.equal(r[j].hud.joueur, j + 1);
    const rectangles = r[j].hud.rectangles;
    assert.equal(rectangles.length, 4, 'seuls compteur, filet peint, carte et FPS sont visibles');
    const compteur = rectangles.find(e => e.id.includes('h-pos'));
    assert.deepEqual([compteur.x, compteur.y, compteur.width, compteur.height], [j * 720 + 12, 18, 60, 24], 'rectangles écran après transformation, sans appliquer une seconde fois le scale duo');
    const carte = rectangles.find(e => e.id.includes('carte'));
    assert.deepEqual([carte.x, carte.width], [j * 720 + 700, 20], 'clip au bord du viewport du joueur');
    assert.equal(rectangles.find(e => e.id.includes('h-fps')).height, 10);
    const filet = rectangles.find(e => e.id.includes('bordure-Top'));
    assert.equal(compteur.compteur, 'c-position'); assert(compteur.ancetres.includes(filet.element));
    assert.notEqual(compteur.element, filet.element, 'la parenté DOM ne se déduit pas d’une classe partagée');
    assert(Math.abs(filet.height - 1.2) < 1e-8, 'une bordure verte finissant par zéro dans rgb reste peinte et suit le scale');
    assert(rectangles.every(e => e.id.startsWith(racines[j].id + ':')));
  }
  assert.equal(JSON.stringify(noeuds.map(l => l.map(e => ({ id: e.id, hidden: e.hidden, style: e.style, rect: e.getClientRects() })))), avant, 'aucune mutation de style ou disposition');
  racines[1].style.overflowX = 'hidden'; racines[1].getBoundingClientRect().width = 715;
  assert.equal(observer()[1].hud.rectangles.find(e => e.id.includes('carte')).width, 15, 'le clipping d’un ancêtre est respecté après transformation');
  racines[1].style.opacity = '0';
  assert.equal(observer()[1].hud.rectangles.length, 0, 'un parent transparent cache ses descendants');
  racines[1].style.opacity = '1';
  racines[1].style.display = 'none';
  assert.equal(observer()[1].hud.rectangles.length, 0, 'un parent display:none cache ses descendants');
  racines[1].style.display = 'block'; racines[1].hidden = true;
  assert.equal(observer()[1].hud.rectangles.length, 0, 'hidden sur le HUD parent doit être respecté');
  racines.pop();
  assert.equal(observer()[1].hud, null, 'une racine absente reste une donnée absente');
});

test('le rapport exige les deux états, les deux joueurs et les erreurs réelles de géométrie', () => {
  for (const s of SCENARIOS_COCKPIT) {
    const r = rapportCockpit(s);
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
    if (s.rival) for (const changer of [o => { o.rivalDistance += 1; }, o => { delete o.rivalDistance; },
      o => { o.reglagesHud.carte = 'non'; }, o => { o.reglagesHud.cartePosition = 'absente'; },
      o => { o.reglagesHud.carteTaille = 'absente'; }, o => { o.reglagesHud.tableau = 'absent'; }]) {
      const faux = structuredClone(r); changer(faux.images[0].observation);
      assert(verifierHabitacle(faux, s).length, 'préférences/rival du compact réellement prescrits');
    }
  }
});

test('les cas stabilisés refusent une chauffe de 24 pas, interrompue, sans rappel ou à cadence différente', () => {
  for (const s of SCENARIOS_COCKPIT.filter(s => s.chauffeInstant === 120)) {
    const r = rapportCockpit(s); assert.deepEqual(verifierHabitacle(r, s), []);
    for (const changer of [
      x => { delete x.phasesHabitacle; },
      x => { x.phasesHabitacle = x.phasesHabitacle.filter(e => Number(e.phase.match(/\d+/)[0]) <= 24); },
      x => { x.phasesHabitacle[119].etat = 'en-cours'; },
      x => { x.phasesHabitacle[119].horloge.callbacks = 0; },
      x => { x.phasesHabitacle[119].horloge.temps += 1; },
      x => { x.phasesHabitacle[120].phase = 'chauffe-1/24'; }
    ]) {
      const faux = structuredClone(r); changer(faux);
      assert(verifierHabitacle(faux, s).some(e => /Stabilisation cockpit incomplète/.test(e)), changer.toString());
    }
    const mauvais = structuredClone(r); mauvais.images[1].observation.volant = .65;
    mauvais.images[1].observation.lisibilite[0].volant = .65;
    assert(verifierHabitacle(mauvais, s).some(e => /Braquage non exercé|Vitesse\/braquage/.test(e)), 'les anciennes poses ne remplacent pas le braquage intermédiaire prescrit');
  }
});

test('relecture JSON : le chevauchement annonce/compteur ne passe pas avec un ancien tableau d’erreurs vide', () => {
  const s = SCENARIOS_COCKPIT.find(s => s.id === 'cockpit-duo-compact');
  for (let j = 0; j < 2; j++) {
    const r = JSON.parse(JSON.stringify(rapportCockpit(s))), q = r.images[1].observation.lisibilite[j];
    const annonce = q.hud.rectangles.find(h => h.id.includes(':h-virage:'));
    const compteur = q.hud.rectangles[0];
    Object.assign(annonce, { x: compteur.x, y: compteur.y, width: compteur.width, height: compteur.height });
    compteur.compteur = 'c-position'; q.erreurs = [];
    assert(verifierHabitacle(r, s).some(e => e.startsWith('J' + (j + 1)) && /Éléments HUD superposés.*c-position/.test(e)));
  }
});

test('les rapports JSON exigent la carte visible aux deux poses et pour chaque joueur', () => {
  for (const s of SCENARIOS_COCKPIT.filter(s => s.cockpit)) {
    const r = JSON.parse(JSON.stringify(rapportCockpit(s)));
    assert.deepEqual(verifierHabitacle(r, s), [], 'les champs déjà capturés suffisent, sans DOM ni navigateur');
    for (const [i, im] of r.images.entries()) for (let j = 0; j < im.observation.lisibilite.length; j++) {
      for (const changer of [
        (q, carte) => { q.hud.rectangles = q.hud.rectangles.filter(h => h !== carte); },
        (q, carte) => { carte.id = carte.id.replace(':carte:', ':carte-fausse:'); },
        (q, carte) => { carte.width = 0; },
        (q, carte) => { carte.x = q.viewport.x + q.viewport.width; },
        (q, carte) => { q.hud.rectangles.push({ ...carte, id: carte.id + '-bis' }); }
      ]) {
        const faux = structuredClone(r), q = faux.images[i].observation.lisibilite[j];
        changer(q, q.hud.rectangles.find(h => h.id.includes(':carte:')));
        assert(verifierHabitacle(faux, s).some(e => /Carte demandée absente/.test(e)), s.id + '/image' + i + '/J' + (j + 1));
      }
    }
    const masquee = structuredClone(r); masquee.images[0].observation.reglagesHud.carte = 'non';
    assert(verifierHabitacle(masquee, s).some(e => /Carte demandée absente/.test(e)), 'le scénario exige toujours une carte');
  }
});

test('l’annonce doit être visible en vitesse-braquage et absente au neutre, pour J1 et J2', () => {
  for (const s of SCENARIOS_COCKPIT.filter(s => s.cockpit)) {
    const r = rapportCockpit(s);
    for (const changer of [
      r => { r.images[1].observation.reglagesHud.annoncesVirages = 'non'; },
      r => { delete r.images[1].observation.reglagesHud.annoncesVirages; },
      r => { r.initialisation.reglagesHud.annoncesVirages = 'non'; }
    ]) {
      const faux = structuredClone(r); changer(faux);
      assert(verifierHabitacle(faux, s).some(e => /réglage Écran prescrit non exercé/.test(e)), 'un réglage incohérent ne doit pas valider une annonce résiduelle');
    }
    const defautNon = structuredClone(r);
    defautNon.initialisation.reglagesHud.annoncesVirages = 'non';
    for (const im of defautNon.images) {
      im.observation.reglagesHud.annoncesVirages = 'non';
      for (const q of im.observation.lisibilite) q.hud.rectangles = q.hud.rectangles.filter(h => !h.id.includes(':h-virage:'));
    }
    for (let j = 0; j < r.images[1].observation.lisibilite.length; j++)
      assert(verifierHabitacle(defautNon, s).some(e => e === 'Annonce de virage absente en vitesse-braquage : J' + (j + 1)), 'le nouveau défaut Non ne contourne pas le garde J' + (j + 1));
    for (let j = 0; j < r.images[1].observation.lisibilite.length; j++) {
      for (const changer of [
        (q, annonce) => { q.hud.rectangles = q.hud.rectangles.filter(h => h !== annonce); },
        (q, annonce) => { annonce.id = annonce.id.replace(':h-virage:', ':h-virage-annonce:'); },
        (q, annonce) => { annonce.height = 0; },
        (q, annonce) => { annonce.y = q.viewport.y + q.viewport.height; }
      ]) {
        const faux = structuredClone(r), q = faux.images[1].observation.lisibilite[j];
        changer(q, q.hud.rectangles.find(h => h.id.includes(':h-virage:')));
        assert(verifierHabitacle(faux, s).some(e => /Annonce de virage absente en vitesse-braquage/.test(e)), s.id + '/J' + (j + 1));
      }
      const faux = structuredClone(r), annonce = faux.images[1].observation.lisibilite[j].hud.rectangles.find(h => h.id.includes(':h-virage:'));
      faux.images[0].observation.lisibilite[j].hud.rectangles.push(structuredClone(annonce));
      assert(verifierHabitacle(faux, s).some(e => /Annonce de virage visible au neutre/.test(e)), s.id + '/J' + (j + 1));
    }
  }
});

test('tableau complet : vitesse et régime visibles une seule fois, dans chaque vue et aux deux poses', () => {
  for (const scenario of SCENARIOS_COCKPIT.filter(s => s.cockpit)) {
    const s = { ...scenario, tableau: 'complet' }, r = rapportCockpit(s);
    assert.deepEqual(verifierHabitacle(JSON.parse(JSON.stringify(r)), s), []);
    for (const [i, im] of r.images.entries()) for (let j = 0; j < im.observation.lisibilite.length; j++) {
      for (const id of ['vitesse', 'h-regime']) for (const changer of [
        (q, compteur) => { q.hud.rectangles = q.hud.rectangles.filter(h => h !== compteur); },
        (q, compteur) => { compteur.id = compteur.id.replace(':' + id + ':', ':' + id + '-faux:'); },
        (q, compteur) => { compteur.width = 0; },
        (q, compteur) => { compteur.x = q.viewport.x + q.viewport.width; },
        (q, compteur) => { q.hud.rectangles.push({ ...compteur, id: compteur.id + '-bis' }); }
      ]) {
        const faux = structuredClone(r), q = faux.images[i].observation.lisibilite[j];
        changer(q, q.hud.rectangles.find(h => h.id.includes(':' + id + ':')));
        for (const candidat of [true, false]) assert(verifierHabitacle(faux, s, candidat).some(e =>
          e.includes('Compteur du tableau complet absent du HUD visible : ' + id + ', J' + (j + 1) + ', image ' + i)),
        s.id + '/' + id + '/image' + i + '/J' + (j + 1));
      }
    }
    const reduit = structuredClone(r); reduit.images[0].observation.reglagesHud.tableau = 'reduit';
    assert(verifierHabitacle(reduit, s).some(e => /Tableau complet prescrit non exercé/.test(e)));
  }
});

test('planche seule : aucun compteur supplémentaire ne redevient visible, pour J1/J2 aux deux poses', () => {
  for (const scenario of SCENARIOS_COCKPIT.filter(s => s.cockpit)) {
    const s = { ...scenario, tableau: 'reduit' }, r = rapportCockpit(s);
    assert.deepEqual(verifierHabitacle(JSON.parse(JSON.stringify(r)), s), []);
    for (const [i, im] of r.images.entries()) for (let j = 0; j < im.observation.lisibilite.length; j++) {
      for (const id of ['vitesse', 'h-regime']) {
        const faux = structuredClone(r), q = faux.images[i].observation.lisibilite[j];
        q.hud.rectangles.push({ id: q.hud.racine + ':' + id + ':intempestif', x: 900, y: 480, width: 80, height: 30 });
        for (const candidat of [true, false]) assert(verifierHabitacle(faux, s, candidat).some(e =>
          e.includes('Compteur supplémentaire visible malgré la planche seule : ' + id + ', J' + (j + 1) + ', image ' + i)),
        s.id + '/' + id + '/image' + i + '/J' + (j + 1));
      }
    }
  }
});

test('les cas compacts exigent le côté réel de la carte, même avec les bons réglages déclarés', () => {
  for (const s of SCENARIOS_COCKPIT.filter(s => s.cartePosition)) {
    const r = rapportCockpit(s);
    for (let i = 0; i < 2; i++) for (const position of ['inverse', 'a-cheval']) {
      const faux = structuredClone(r), q = faux.images[i].observation.lisibilite[0];
      const carte = q.hud.rectangles.find(h => h.id.includes(':carte:')), milieu = q.viewport.x + q.viewport.width / 2;
      carte.x = position === 'a-cheval' ? milieu - carte.width / 2 : s.cartePosition === 'gauche' ? milieu + 20 : milieu - carte.width - 20;
      assert(verifierHabitacle(faux, s).some(e => /Carte visible du mauvais côté/.test(e)), s.id + '/image' + i + '/' + position);
    }
    const deplace = structuredClone(r);
    for (const im of deplace.images) for (const q of im.observation.lisibilite) {
      q.viewport.x += 700; for (const rectangle of q.hud.rectangles) rectangle.x += 700;
    }
    assert.deepEqual(verifierHabitacle(deplace, s), [], 'le côté est relatif au viewport, pas à l’origine globale');
  }
});

test('la référence négative exige aussi sa carte et l’annonce dans les bons états', () => {
  const s = SCENARIOS_COCKPIT.find(s => s.id === 'cockpit-paysage'), r = rapportCockpit(s, true);
  assert.deepEqual(verifierHabitacle(JSON.parse(JSON.stringify(r)), s, false), []);
  for (const [i, id, attendu] of [[0, 'carte', /Carte demandée absente/], [1, 'carte', /Carte demandée absente/],
    [1, 'h-virage', /Annonce de virage absente en vitesse-braquage/]]) {
    const faux = structuredClone(r), q = faux.images[i].observation.lisibilite[0];
    q.hud.rectangles = q.hud.rectangles.filter(h => !h.id.includes(':' + id + ':'));
    assert(verifierHabitacle(faux, s, false).some(e => attendu.test(e)), 'le masque de glace connu ne remplace pas le témoin ' + id);
  }
  const faux = structuredClone(r);
  faux.images[0].observation.lisibilite[0].hud.rectangles.push({ id: 'hud:h-virage:temoin', x: 20, y: 170, width: 140, height: 40 });
  assert(verifierHabitacle(faux, s, false).some(e => /Annonce de virage visible au neutre/.test(e)));
});

test('HUD de référence : les preuves absentes ou invalides restent des échecs structurels', () => {
  const s = SCENARIOS_COCKPIT.find(s => s.id === 'cockpit-paysage'), r = rapportCockpit(s, true);
  assert.deepEqual(verifierHabitacle(r, s, false), []);
  for (const changer of [q => { delete q.hud; }, q => { q.hud.observe = false; }, q => { q.hud.racine = 'hud2'; },
    q => { q.hud.joueur = 2; }, q => { q.hud.rectangles = []; }, q => { q.hud.rectangles[0].x = NaN; },
    q => { q.hud.rectangles[0].height = 0; }, q => { q.hud.commandes.pop(); },
    q => { q.hud.commandes[0].recouvrementPx2 = NaN; }, q => { delete q.glaces[0].hudRecouvrementPx2; },
    q => { q.glaces[0].hudRecouvrements = null; }, q => { delete q.route.points[0].hud; },
    q => { q.erreurs.push('Rectangle HUD invalide : hud:autre'); }, q => { q.erreurs.push('Données HUD absentes ou incomplètes'); }]) {
    const faux = structuredClone(r); changer(faux.images[0].observation.lisibilite[0]);
    for (const candidat of [false, true]) assert(verifierHabitacle(faux, s, candidat).some(e => /Données HUD/.test(e)), changer.toString());
  }
});

test('référence paysage : intersection de glace réelle, supérieure au seuil et explicitement constatée aux deux poses', () => {
  const s = SCENARIOS_COCKPIT.find(s => s.id === 'cockpit-paysage'), r = rapportCockpit(s, true), libre = rapportCockpit(s);
  assert.deepEqual(verifierHabitacle(r, s, false), []);
  assert(verifierHabitacle(libre, s, false).some(e => /masque HUD connu/.test(e)));
  for (const changer of [
    q => { q.erreurs = ['Données HUD absentes ou incomplètes']; },
    q => { q.erreurs = ['Rectangle HUD invalide : hud:compteur']; },
    q => { q.erreurs = ['HUD superposé à la glace : glace-inexistante']; },
    q => { q.glaces[0].hudRecouvrementPx2 = SEUILS_COCKPIT.recouvrementMaxPx2; q.glaces[0].hudRecouvrements[0].airePx2 = SEUILS_COCKPIT.recouvrementMaxPx2; },
    q => { q.glaces[0].hudRecouvrementPx2 = 0; q.glaces[0].hudRecouvrements = []; }
  ]) {
    const faux = structuredClone(r); changer(faux.images[0].observation.lisibilite[0]);
    assert(verifierHabitacle(faux, s, false).length, changer.toString());
  }
  const uneSeulePose = structuredClone(r); uneSeulePose.images[1] = libre.images[1];
  assert(verifierHabitacle(uneSeulePose, s, false).some(e => /masque HUD connu/.test(e)));
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
