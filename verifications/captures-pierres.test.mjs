import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { optionsPierres, scenariosPierres, optionsScenarioPierres, pierreCible, preparerVariantePierres,
  viserPierres, empreintesPierres, verifierPixelPierres, observerAvecCoutPierres, verifierPierres, comparerPierres } from '../tools/captures-pierres.mjs';

test('la campagne A/B garde mêmes conditions et refuse les paliers ou variantes non prévus', () => {
  const args = ['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/pierres'];
  const o = optionsPierres(args), scenes = scenariosPierres(o);
  assert.equal(scenes.length, 12);
  assert.equal(scenes.length * 2, 24);
  for (let i = 0; i < scenes.length; i += 2) {
    const a = optionsScenarioPierres(scenes[i], o, '/tmp/a'), b = optionsScenarioPierres(scenes[i + 1], o, '/tmp/b');
    assert.deepEqual(a.referenceJeu, b.referenceJeu);
    assert.equal(a.referenceJeu.qualite, 'high'); assert.equal(a.referenceJeu.vitesse, 0); assert.equal(a.referenceJeu.retro, 'non');
    assert.deepEqual(scenes.slice(i, i + 2).map(s => s.variante), ['reference', 'procedurale']);
  }
  assert.equal(scenariosPierres(optionsPierres([...args, '--vues', 'route-des-cimes-pont', '--saisons', 'hiver'])).length, 2);
  assert.equal(scenariosPierres(optionsPierres([...args, '--vues', 'route-des-cimes-arche'])).length * 2, 8);
  for (const extra of [['--vues', 'inconnu'], ['--vues', 'route-des-cimes-refuge,route-des-cimes-refuge'], ['--saisons', 'ete,ete'],
    ['--saisons', 'printemps'], ['--qualite', 'low'], ['--variante', 'procedurale'], ['--taille', '0,0']]) assert.throws(() => optionsPierres([...args, ...extra]));
});

test('les vues et la fixture M1 passent sur les vrais décors et le monde PhysX, sans mutation géométrique', async () => {
  const { B, CATALOGUE_SAISONS, creerCircuitSaisons } = await import('../tools/qualification/saisons-circuits.mjs');
  const { chargerPhysX } = await import('./helpers/physx-runtime.mjs');
  const require = createRequire(import.meta.url);
  for (const n of ['lieux', 'cinema', 'obstacles', 'solides-physx']) require('../src/' + n + '.js');
  const X = await chargerPhysX();
  try {
    const o = optionsPierres(['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/pierres']);
    for (const s of scenariosPierres(o).filter(s => s.variante === 'reference')) {
      const c = creerCircuitSaisons(CATALOGUE_SAISONS[s.circuit]);
      const d = B.decor.construire(c, { qualite: 'high', saison: s.saison, vegetation: false, organique: true, solsProceduraux: true, pierresProcedurales: true });
      const objets = d.lots.flatMap(l => l.objets), cibles = objets.filter(pierreCible);
      assert(cibles.length === 177); assert(cibles.every(o => o.mat === 23));
      const rochersSculptes = objets.filter(o => o.solidePhysX?.genre === 'roche-tunnel' && o.shape.startsWith('bitume-lieu-'));
      assert(rochersSculptes.length > 250 && rochersSculptes.every(o => o.mat === 23 && !pierreCible(o)));
      const eau = objets.filter(o => o.mat === 9 && !pierreCible(o));
      assert(eau.length > 0, 'matière 9 hors des pierres ciblées réellement présente');
      const avant = await empreintesPierres(d), unique = new Set(d.lots.flatMap(l => [...l.objets, ...(l.loin || [])]).filter(pierreCible));
      const selection = preparerVariantePierres(d, 'reference');
      assert.equal(selection.uniques, unique.size);
      assert.equal(selection.matiereInitiale, 23);
      assert([...unique].every(o => o.mat === 9)); assert(eau.every(o => o.mat === 9));
      assert.deepEqual(await empreintesPierres(d), avant, 'identité de scène entière, hors recette M1');
      assert.equal(preparerVariantePierres(d, 'reference').matiereInitiale, 9, 'la recette initiale est toujours explicite');
      assert.equal(pierreCible({ mat: 9, collision: 'roche' }), false);
      assert.equal(pierreCible({ mat: 9, solidePhysX: { genre: 'refuge-cimes' }, partie: 'mur-refuge' }), false);
      assert.equal(pierreCible({ mat: 3, solidePhysX: { genre: 'portail-tunnel' } }), false);
      c.obstacles = B.obstacles.creer(d.obstacles);
      const world = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 1, contacts: true }); let solids;
      try {
        solids = B.solidesPhysX.installer(world, c, d);
        const cam = B.cinema.viser(s.position, s.cible, s.fov), r = viserPierres(world, solids, cam, s, d.sol);
        assert(r.cibleDistance > 4);
        if (r.touchePierre) assert(s.genres.includes(r.genre));
        assert.throws(() => viserPierres(world, solids, { ...cam, pos: [cam.pos[0], d.sol(cam.pos[0], cam.pos[2]) - 1, cam.pos[2]] }, s, d.sol), /terrain/);
      } finally { if (solids) B.solidesPhysX.liberer(solids); world.dispose(); }
      if (s.id === 'route-des-cimes-refuge' && s.saison === 'ete') {
        const defaut = B.decor.construire(c, { qualite: 'high', saison: 'ete', vegetation: false, organique: true, solsProceduraux: true });
        const ciblesDefaut = new Set(defaut.lots.flatMap(l => [...l.objets, ...(l.loin || [])]).filter(pierreCible));
        assert(ciblesDefaut.size === 177); assert([...ciblesDefaut].every(o => o.mat === 9), 'le vrai défaut ne doit pas activer M1');
        const avantDefaut = await empreintesPierres(defaut), active = preparerVariantePierres(defaut, 'procedurale');
        assert.equal(active.matiereInitiale, 9); assert.equal(active.matiere, 23);
        assert([...ciblesDefaut].every(o => o.mat === 23));
        assert.deepEqual(await empreintesPierres(defaut), avantDefaut);
        ciblesDefaut.values().next().value.mat = 9;
        const melange = [...ciblesDefaut].map(o => o.mat);
        assert.throws(() => preparerVariantePierres(defaut, 'reference'), /mélange/);
        assert.deepEqual([...ciblesDefaut].map(o => o.mat), melange, 'refus avant toute mutation partielle');
      }
    }
  } finally { X.dispose(); }
});

test('le témoin laissé intact, un pixel vide ou une répétition instable ne prouvent pas le dessin', () => {
  const pixel = [76, 81, 68, 255];
  assert.equal(verifierPixelPierres(pixel), true);
  assert.equal(verifierPixelPierres(pixel, pixel), true);
  for (const vide of [[0, 0, 0, 0], [0, 0, 0, 255], [12, 14, 15, 0], [300, 2, 3, 255], [3, 4, 5]])
    assert.throws(() => verifierPixelPierres(vide), /vide ou invalide/);
  assert.throws(() => verifierPixelPierres([255, 0, 255, 255]), /témoin/);
  assert.throws(() => verifierPixelPierres([77, 81, 68, 255], pixel), /instable/);
});

// Faux reçus seulement pour exercer les refus du vérificateur, jamais pour simuler un renderer.
function recu() {
  const s = { circuitId: 'route-des-cimes', saison: 'ete', variante: 'reference' }, camera = { pos: [1, 2, 3], yaw: .1, pitch: .2, fov: 44 };
  const observation = { ...s, circuit: s.circuitId, camera, cameraPrescrite: structuredClone(camera), erreursGPU: [], gpuPerdu: false,
    matieres: { uniques: 278, genres: { 'roche-tunnel': 272, 'portail-tunnel': 6 }, matiereInitiale: 9, matiere: 9 },
    empreintes: Object.fromEntries(['lotsSansRecette', 'nappes', 'solides', 'obstacles', 'racines'].map(k => [k, 'a'.repeat(64)])),
    rendu: { drawCalls: 100, triangles: 1000, instances: 500 },
    cout: { methode: 'draw-meme-texture-WebGPU-copyTextureToBuffer-mapAsync', mesures: 16, echantillonsMs: Array(16).fill(20), p50Ms: 20, simulationInchangee: true,
      lecture: { pixel: [76, 81, 68, 255], pixelsMesures: Array.from({ length: 16 }, () => [76, 81, 68, 255]),
        stable: true, controlesRemplacement: 22, baliseSoumiseAvantChrono: true, marqueur: [255, 0, 255, 255],
        largeur: 960, hauteur: 540, tailleCanvas:[960, 540], format:'rgba8unorm',
        sortie:'GPUCanvasContext.getCurrentTexture', sampleCount:1, dimension:'2d', x: 480, y: 270 } } };
  return { s, r: { build: { sha256: 'b'.repeat(64) }, source: { commit: 'c'.repeat(40) },
    parametres: { qualite: 'high', saison: 'ete' }, environnement: { webgpu: true, physx: { ready: true } },
    initialisation: { modeleReel: true, methode: 'fixture-matiere-meme-build' }, images: [{ observation }, { observation }] } };
}
test('une caméra remplacée, une mesure absente ou une comparaison géométriquement différente échoue', () => {
  const { s, r } = recu(); assert.deepEqual(verifierPierres(r, s), []);
  const camera = structuredClone(r); camera.images[0].observation.camera.pos[0] += 1;
  assert(verifierPierres(camera, s).some(e => /Caméra/.test(e)));
  const temps = structuredClone(r); temps.images[1].observation.cout = null;
  assert(verifierPierres(temps, s).some(e => /Mesure/.test(e)));
  const ancien = structuredClone(r); ancien.images[1].observation.cout.methode = 'draw-identique-gl.finish-performance.now';
  assert(verifierPierres(ancien, s).some(e => /Achèvement/.test(e)));
  assert.equal(comparerPierres(ancien, r).rapportP50, null, 'aucun ratio de gain avec l’ancienne mesure');
  const temoin = structuredClone(r); temoin.images[1].observation.cout.lecture.pixelsMesures[3] = [255, 0, 255, 255];
  assert(verifierPierres(temoin, s).some(e => /témoin/.test(e)));
  assert.equal(comparerPierres(temoin, r).rapportP50, null);
  const fauxMarqueur = structuredClone(r); fauxMarqueur.images[1].observation.cout.lecture.marqueur = [0,0,0,255];
  assert(verifierPierres(fauxMarqueur, s).some(e => /Achèvement/.test(e)));
  assert.equal(comparerPierres(fauxMarqueur, r).rapportP50, null);
  const instable = structuredClone(r); instable.images[1].observation.cout.lecture.pixelsMesures[6][0]++;
  assert(verifierPierres(instable, s).some(e => /instable/.test(e)));
  const partiel = structuredClone(r); partiel.images[1].observation.cout.lecture.tailleCanvas[0] = 1;
  assert(verifierPierres(partiel, s).some(e => /partielle/.test(e)));
  const recette = structuredClone(r); recette.images[0].observation.matieres.matiere = 23;
  assert(verifierPierres(recette, s).some(e => /Recette/.test(e)));
  assert(verifierPierres({ images: [] }, s).length >= 3);
  const autre = structuredClone(r); assert.deepEqual(comparerPierres(r, autre).erreurs, []);
  autre.images[1].observation.empreintes.solides = 'd'.repeat(64);
  assert(comparerPierres(r, autre).erreurs.some(e => /empreintes/.test(e)));
  autre.images[0].observation.rendu.triangles++;
  assert(comparerPierres(r, autre).erreurs.some(e => /rendu/.test(e)));
  autre.build.sha256 = 'e'.repeat(64);
  assert(comparerPierres(r, autre).erreurs.some(e => /Builds/.test(e)));
});

test('un coût expiré conserve les deux observations et traite le rejet tardif de l’évaluateur', async () => {
  const { s, r } = recu(), bases = r.images.map(im => ({ ...structuredClone(im.observation), cout: null }));
  let appels = 0, rejeter;
  const evaluer = () => {
    appels++;
    if (appels <= 2) return Promise.resolve(bases[appels - 1]);
    return new Promise((_resolve, reject) => { rejeter = reject; });
  };
  const images = [];
  for (let i = 0; i < 2; i++) images.push({ fichier: '000' + i + '.png', observation: await observerAvecCoutPierres({ evaluer, i }, 5) });
  assert.equal(appels, 3); assert.equal(images.length, 2);
  assert.deepEqual(images[0].observation, bases[0]);
  const { cout, ...conserve } = images[1].observation, { cout: _cout, ...base } = bases[1];
  assert.deepEqual(conserve, base);
  assert.equal(cout.statut, 'non_qualifie'); assert.equal(cout.motif, 'delai_mesure_depasse');
  assert.equal(cout.objectif, 16); assert.equal(cout.mesures, null);
  r.images = images;
  assert(verifierPierres(r, s).some(e => /Mesure/.test(e)), 'le coût incomplet garde la qualification en échec');
  assert.equal(comparerPierres(r, recu().r).rapportP50, null);
  rejeter(new Error('Chrome fermé après expiration'));
  await new Promise(resolve => setImmediate(resolve)); // Le runner refuserait une rejection non traitée.
});

test('une mesure terminée complète seulement le coût ; une erreur ne détruit pas l’observation', async () => {
  const { r } = recu(), base = { ...structuredClone(r.images[0].observation), cout: null }, resultat = r.images[1].observation;
  let appels = 0;
  const termine = await observerAvecCoutPierres({ i: 1, evaluer: async () => ++appels === 1 ? base : resultat }, 50);
  assert.deepEqual(termine, { ...base, cout: resultat.cout });
  appels = 0;
  const echoue = await observerAvecCoutPierres({ i: 1, evaluer: async () => {
    if (++appels === 1) return base;
    throw new Error('Lecture impossible');
  } }, 50);
  assert.deepEqual({ ...echoue, cout: null }, base);
  assert.equal(echoue.cout.statut, 'non_qualifie'); assert.equal(echoue.cout.motif, 'evaluation_cout_echouee');
  assert.equal(echoue.cout.mesures, null); assert.match(echoue.cout.erreur, /Lecture impossible/);
});

test('les régions WebGPU lisent les bonnes coordonnées, retirent le padding et décodent BGRA', async t => {
  const { lireRegionsPresentation } = await import('../tools/lecture-presentation-gpu.mjs');
  const sauvegardes = new Map();
  for (const [k,v] of Object.entries({ GPUTextureUsage:{COPY_SRC:1}, GPUBufferUsage:{MAP_READ:1,COPY_DST:2}, GPUMapMode:{READ:1} })) {
    sauvegardes.set(k, Object.getOwnPropertyDescriptor(globalThis,k));
    Object.defineProperty(globalThis,k,{configurable:true,value:v});
  }
  t.after(() => { for(const [k,d] of sauvegardes) { if(d)Object.defineProperty(globalThis,k,d); else delete globalThis[k]; } });
  let libere = false;
  const device = {
    createBuffer({size}) {
      const storage=new ArrayBuffer(size);
      return {storage, mapAsync:async()=>{},getMappedRange:()=>storage,unmap(){},destroy(){libere=true;}};
    },
    createCommandEncoder() {
      const copies=[];
      return {copyTextureToBuffer(src,dst,size){copies.push({src,dst,size});},finish:()=>copies};
    },
    queue:{submit([copies]){
      for (const {src,dst,size} of copies) {
        assert.equal(dst.bytesPerRow%256,0); assert.equal(dst.offset%256,0);
        const [w,h]=size,[x0,y0]=src.origin, bytes=new Uint8Array(dst.buffer.storage);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)bytes.set([x+x0,91,y+y0,255],dst.offset+y*dst.bytesPerRow+x*4);
      }
    }}
  };
  const gpu={device}, texture={format:'bgra8unorm',width:8,height:8,usage:1};
  const [a,b]=await lireRegionsPresentation(gpu,texture,[{x:3,y:0,w:1,h:2},{x:0,y:6,w:2,h:1}]);
  assert.deepEqual([...a],[0,91,3,255,1,91,3,255]);assert.deepEqual([...b],[6,91,0,255,6,91,1,255]);
  assert(libere);await assert.rejects(lireRegionsPresentation(gpu,texture,[{x:8,y:0,w:1,h:1}]),/hors de la présentation/);
});
