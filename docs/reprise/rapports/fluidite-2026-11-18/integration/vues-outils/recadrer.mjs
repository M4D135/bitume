// node recadrer.mjs sortie.png x y l h echelle a.png [b.png ...] : vignettes côte à côte, agrandies au plus proche
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { decoderPng } from '/Users/david/Projects/bitume/tools/visuel-images.mjs';
const [sortie, xs, ys, ls, hs, es, ...fichiers] = process.argv.slice(2);
const x0 = +xs, y0 = +ys, L = +ls, H = +hs, E = +es, n = fichiers.length, ecart = 6;
const W = n * L * E + (n - 1) * ecart, HH = H * E;
const brut = Buffer.alloc((W * 3 + 1) * HH, 255);
fichiers.forEach((f, k) => {
  const im = decoderPng(readFileSync(f)), c = im.canaux;
  for (let y = 0; y < HH; y++) for (let x = 0; x < L * E; x++) {
    const sx = x0 + Math.floor(x / E), sy = y0 + Math.floor(y / E), i = (sy * im.width + sx) * c, o = y * (W * 3 + 1) + 1 + (k * (L * E + ecart) + x) * 3;
    brut[o] = im.pixels[i]; brut[o + 1] = im.pixels[i + 1]; brut[o + 2] = im.pixels[i + 2];
  }
});
for (let y = 0; y < HH; y++) brut[y * (W * 3 + 1)] = 0;
const bloc = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const t = Buffer.from(type, 'ascii'); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0); return Buffer.concat([l, t, data, cc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(HH, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(sortie, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]));
