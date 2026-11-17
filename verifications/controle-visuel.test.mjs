import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import vm from 'node:vm';
import { decoderPng, mesurerImage, analyserSequence, comparerSequences, difference } from '../tools/visuel-images.mjs';
import { optionsCapture, horlogeCapture } from '../tools/controle-visuel.mjs';

function crc32(b) {
  let c = 0xffffffff;
  for (const octet of b) { c ^= octet; for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return (c ^ 0xffffffff) >>> 0;
}
function bloc(nom, data) {
  const t = Buffer.from(nom), taille = Buffer.alloc(4), crc = Buffer.alloc(4);
  taille.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([taille, t, data, crc]);
}
function png(width, height, canaux, pixels, filtres = [0]) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = canaux === 4 ? 6 : 2;
  const ligne = width * canaux, brut = Buffer.alloc(height * (ligne + 1));
  for (let y = 0; y < height; y++) {
    const f = filtres[y % filtres.length]; brut[y * (ligne + 1)] = f;
    for (let x = 0; x < ligne; x++) {
      const i = y * ligne + x, a = x >= canaux ? pixels[i - canaux] : 0, b = y ? pixels[i - ligne] : 0;
      const c = y && x >= canaux ? pixels[i - ligne - canaux] : 0;
      let prediction = 0;
      if (f === 1) prediction = a; else if (f === 2) prediction = b; else if (f === 3) prediction = Math.floor((a + b) / 2);
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        prediction = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      brut[y * (ligne + 1) + x + 1] = (pixels[i] - prediction) & 255;
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]);
}
function imageGrise(n, width = 24, height = 16) {
  return { width, height, canaux: 3, pixels: Buffer.alloc(width * height * 3, n) };
}
function capture(n) { return { temps: 1, etat: { joueurs: [{ id: 0, s: 300, d: 0, v: 75 }] }, vues: { scene: mesurerImage(imageGrise(n)) } }; }
function rapport(images) {
  return { scenario: 'tunnel', parametres: { graine: 17, pas: .1 }, horloge: { mode: 'raf-commande' },
    environnement: { navigateur: 'Chrome test', gpu: 'GPU test', resolution: [24, 16, 1] }, images };
}

test('décodage des PNG RGB et RGBA avec les cinq filtres', () => {
  for (const canaux of [3, 4]) {
    const pixels = Buffer.from(Array.from({ length: 7 * 5 * canaux }, (_, i) => (i * 131 + i % 11) & 255));
    const resultat = decoderPng(png(7, 5, canaux, pixels, [0, 1, 2, 3, 4]));
    assert.equal(resultat.width, 7); assert.equal(resultat.height, 5); assert.equal(resultat.canaux, canaux);
    assert.deepEqual(resultat.pixels, pixels);
  }
});

test('captures tronquées ou formats inconnus refusés', () => {
  assert.throws(() => decoderPng(Buffer.from('pas un PNG')), /PNG/);
  const valide = png(2, 2, 3, Buffer.alloc(12));
  assert.throws(() => decoderPng(valide.subarray(0, 48)), /tronqué|sans image/);
  const profondeur = Buffer.from(valide); profondeur[24] = 16;
  assert.throws(() => decoderPng(profondeur), /8 bits/);
});

test('les mesures portent sur la zone demandée, sans le reste de la page', () => {
  const im = imageGrise(255, 4, 2);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) im.pixels.fill(0, (y * 4 + x) * 3, (y * 4 + x) * 3 + 3);
  const gauche = mesurerImage(im, { x: 0, y: 0, width: 2, height: 2 }, 2, 2);
  const droite = mesurerImage(im, { x: 2, y: 0, width: 2, height: 2 }, 2, 2);
  assert.equal(gauche.noir, 1); assert.equal(gauche.luminance, 0);
  assert.equal(droite.noir, 0); assert.ok(Math.abs(droite.luminance - 1) < 1e-9);
  assert.notEqual(gauche.empreinte, droite.empreinte);
});

test('alertes d’image noire, identique et de blocs fugitifs', () => {
  const images = [capture(180), capture(0), capture(180), capture(180)];
  const alertes = analyserSequence(images);
  assert.ok(alertes.some(a => a.image === 1 && a.type === 'noire'));
  assert.ok(alertes.some(a => a.image === 1 && a.type === 'blocs-fugitifs' && a.blocs.length));
  assert.ok(alertes.some(a => a.image === 3 && a.type === 'identique'));
  assert.equal(analyserSequence([capture(50), capture(80), capture(110)]).length, 0, 'éclaircissement progressif légitime');
});

test('comparaison avant/après : différences conservées, dérive des paramètres refusée', () => {
  const a = rapport([capture(80)]), b = rapport([capture(100)]);
  const r = comparerSequences(a, b);
  assert.equal(r.comparable, true); assert.equal(r.differences[0].identique, false);
  assert.ok(r.differences[0].luminance.moyenne > 0);
  b.parametres.graine++;
  assert.deepEqual(comparerSequences(a, b).ecarts, ['parametres']);
});

test('changement de GPU, de trajectoire ou disparition de J2 invalide la comparaison', () => {
  const a = rapport([capture(80)]), b = structuredClone(a);
  b.environnement.gpu = 'autre'; assert.equal(comparerSequences(a, b).comparable, false);
  b.environnement.gpu = a.environnement.gpu; b.images[0].etat.joueurs[0].s += 1;
  assert.ok(comparerSequences(a, b).ecarts.includes('image-0.trajectoire'));
  b.images[0].etat.joueurs[0].s -= 1; a.images[0].vues.scene2 = a.images[0].vues.scene;
  assert.ok(comparerSequences(a, b).ecarts.includes('image-0.vues'));
  assert.equal(difference([1], [1, 2]), null);
});

test('les réglages effectifs et PhysX doivent correspondre, seul le décor peut varier', () => {
  const a = rapport([capture(80)]), b = structuredClone(a);
  a.referenceJeu = { graine: 17017, difficulte: 1, tours: 3, decor: 'reference' };
  b.referenceJeu = { ...a.referenceJeu, decor: 'enrichi' };
  a.environnement.physx = { disponible: true, ready: true, version: '5' };
  b.environnement.physx = { ...a.environnement.physx };
  assert.equal(comparerSequences(a, b).comparable, true);
  b.referenceJeu.difficulte = 2;
  assert.deepEqual(comparerSequences(a, b).ecarts, ['referenceJeu']);
  b.referenceJeu.difficulte = 1; b.environnement.physx.ready = false;
  assert.deepEqual(comparerSequences(a, b).ecarts, ['environnement.physx']);
});

test('les paramètres de capture fixent taille, graine, qualité et budget de pas', () => {
  const o = optionsCapture(['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/qa', '--scenario', 'duo', '--taille', '800x600', '--images', '3']);
  assert.deepEqual(o.taille, [800, 600]); assert.equal(o.referenceJeu.mode, 'duo'); assert.equal(o.images, 3);
  assert.equal(o.referenceJeu.graine, 17017); assert.equal(o.referenceJeu.qualite, 'high');
  assert.throws(() => optionsCapture(['--url', 'file:///a', '--sortie', '/tmp/a', '--pas', '.5']), /pas/);
  assert.throws(() => optionsCapture(['--url', 'file:///a', '--sortie', '/tmp/a', '--qualite', 'auto']), /qualite/);
  assert.throws(() => optionsCapture(['--inconnue', 'oui']), /inconnue/);
});

test('l’horloge de capture contrôle chaque rAF sans falsifier performance.now', () => {
  const ctx = vm.createContext({ performance: { now: () => 12345 } });
  vm.runInContext('window = globalThis', ctx);
  vm.runInContext(horlogeCapture(17017), ctx);
  vm.runInContext(`resultats = []; const annule = requestAnimationFrame(() => resultats.push('annulé')); cancelAnimationFrame(annule);
    requestAnimationFrame(t => { resultats.push(t); requestAnimationFrame(t2 => resultats.push(t2)); });`, ctx);
  ctx.__BITUME_CAPTURE.avancer(100); ctx.__BITUME_CAPTURE.avancer(100);
  assert.deepEqual(Array.from(ctx.resultats), [1100, 1200]);
  assert.equal(vm.runInContext('performance.now()', ctx), 12345);
  assert.equal(vm.runInContext('Date.now()', ctx), 1700000000000 + 17017 * 128);
});
