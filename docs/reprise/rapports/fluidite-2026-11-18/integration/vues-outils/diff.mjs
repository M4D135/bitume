// node diff.mjs a.png b.png [zones.json] [sortie-diff.png]
// Compare deux captures : écart moyen, part des pixels qui diffèrent (> 2 et > 16 niveaux sur un canal), boîte
// englobante des différences, par zone (toiles des glaces, scène) si le JSON de capture est donné.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { decoderPng } from '/Users/david/Projects/bitume/tools/visuel-images.mjs';

const [fa, fb, fz, fd] = process.argv.slice(2);
const A = decoderPng(readFileSync(fa)), Bi = decoderPng(readFileSync(fb));
if (A.width !== Bi.width || A.height !== Bi.height) { console.log(JSON.stringify({ erreur: 'tailles différentes' })); process.exit(1); }
const W = A.width, H = A.height, ca = A.canaux, cb = Bi.canaux;
const ecart = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x; let m = 0;
  for (let c = 0; c < 3; c++) { const d = Math.abs(A.pixels[i * ca + c] - Bi.pixels[i * cb + c]); if (d > m) m = d; }
  ecart[i] = m;
}
function mesurer(z) {
  const x0 = Math.max(0, Math.floor(z.x)), y0 = Math.max(0, Math.floor(z.y)), x1 = Math.min(W, Math.ceil(z.x + z.l)), y1 = Math.min(H, Math.ceil(z.y + z.h));
  let n = 0, s = 0, n2 = 0, n16 = 0, bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1, max = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const e = ecart[y * W + x]; n++; s += e; if (e > max) max = e;
    if (e > 2) { n2++; if (x < bx0) bx0 = x; if (y < by0) by0 = y; if (x > bx1) bx1 = x; if (y > by1) by1 = y; }
    if (e > 16) n16++;
  }
  return { pixels: n, moyen: +(s / Math.max(1, n)).toFixed(4), max, part2: +(n2 / Math.max(1, n)).toFixed(5), part16: +(n16 / Math.max(1, n)).toFixed(5), boite: bx1 < 0 ? null : [bx0, by0, bx1, by1] };
}
const res = { image: mesurer({ x: 0, y: 0, l: W, h: H }) };
if (fz) {
  const d = JSON.parse(readFileSync(fz, 'utf8'));
  for (const z of (d.valeur && d.valeur.glaces) || []) if (z && !z.cache && z.l > 1) res[z.id] = mesurer(z);
}
console.log(JSON.stringify(res));
if (fd) {
  // image des écarts : capture A assombrie, écarts en rouge vif (amplifiés)
  const brut = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    brut[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = y * (W * 3 + 1) + 1 + x * 3, e = ecart[i];
      const g = (A.pixels[i * ca] + A.pixels[i * ca + 1] + A.pixels[i * ca + 2]) / 9;
      if (e > 2) { brut[o] = 255; brut[o + 1] = Math.min(255, e * 4); brut[o + 2] = 0; } else { brut[o] = brut[o + 1] = brut[o + 2] = g; }
    }
  }
  const bloc = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const t = Buffer.from(type, 'ascii'); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0); return Buffer.concat([l, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(fd, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]));
}
