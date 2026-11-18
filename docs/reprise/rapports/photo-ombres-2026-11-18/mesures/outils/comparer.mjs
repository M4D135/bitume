// Compare deux PNG de même taille (8 bits, RGB ou RGBA, non entrelacés) :
// node comparer.mjs avant.png apres.png [diff.png] [x0,y0,x1,y1]
// Écart de luminance (apres - avant) ; image de différence 128 + 8 × écart (noir : après plus sombre).
import fs from 'node:fs';
import zlib from 'node:zlib';

function lire(f) {
  const b = fs.readFileSync(f);
  let p = 8, w = 0, h = 0, ct = 0, bd = 0, il = 0;
  const idat = [];
  while (p < b.length) {
    const n = b.readUInt32BE(p), t = b.toString('latin1', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; il = d[12]; }
    else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    p += 12 + n;
  }
  if (bd !== 8 || il !== 0 || (ct !== 2 && ct !== 6)) throw new Error(f + ' : format non pris en charge ' + [bd, ct, il]);
  const c = ct === 6 ? 4 : 3, brut = zlib.inflateSync(Buffer.concat(idat)), ligne = w * c, out = new Uint8Array(w * h * 3);
  let prec = new Uint8Array(ligne), cour = new Uint8Array(ligne);
  for (let y = 0; y < h; y++) {
    const f0 = brut[y * (ligne + 1)], src = brut.subarray(y * (ligne + 1) + 1, (y + 1) * (ligne + 1));
    for (let i = 0; i < ligne; i++) {
      const a = i >= c ? cour[i - c] : 0, up = prec[i], ul = i >= c ? prec[i - c] : 0;
      let v = src[i];
      if (f0 === 1) v += a; else if (f0 === 2) v += up; else if (f0 === 3) v += (a + up) >> 1;
      else if (f0 === 4) { const pp = a + up - ul, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - ul); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? up : ul); }
      cour[i] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) out[(y * w + x) * 3 + k] = cour[x * c + k];
    const t = prec; prec = cour; cour = t;
  }
  return { w, h, px: out };
}

function ecrire(f, w, h, gris) {
  const brut = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { brut[y * (w + 1)] = 0; for (let x = 0; x < w; x++) brut[y * (w + 1) + 1 + x] = gris[y * w + x]; }
  const crc = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return buf => { let c = 0xffffffff; for (const x of buf) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
  const morceau = (type, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(f, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), morceau('IHDR', ihdr), morceau('IDAT', zlib.deflateSync(brut)), morceau('IEND', Buffer.alloc(0))]));
}

const [fa, fb, fd, boite] = process.argv.slice(2);
const A = lire(fa), Bi = lire(fb);
if (A.w !== Bi.w || A.h !== Bi.h) throw new Error('tailles différentes');
const { w, h } = A, gris = new Uint8Array(w * h);
let [bx0, by0, bx1, by1] = boite ? boite.split(',').map(Number) : [0, 0, w, h];
let n = 0, sombre = 0, somme = 0, max = 0, x0 = w, y0 = h, x1 = -1, y1 = -1, total = 0;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = (y * w + x) * 3, la = (A.px[i] + A.px[i + 1] + A.px[i + 2]) / 3, lb = (Bi.px[i] + Bi.px[i + 1] + Bi.px[i + 2]) / 3, d = lb - la;
  gris[y * w + x] = Math.min(255, Math.max(0, Math.round(128 + d * 8)));
  if (x < bx0 || x >= bx1 || y < by0 || y >= by1) continue;
  total++;
  if (Math.abs(d) > 1.5) { n++; somme += d; if (d < 0) sombre++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (Math.abs(d) > Math.abs(max)) max = d;
}
if (fd && fd !== '-') ecrire(fd, w, h, gris);
console.log(JSON.stringify({ image: w + 'x' + h, zone: [bx0, by0, bx1, by1], changes: n, part: +(n / total).toFixed(4), partSombre: n ? +(sombre / n).toFixed(3) : 0, moyenne: n ? +(somme / n).toFixed(2) : 0, max: +max.toFixed(1), boite: [x0, y0, x1, y1] }));
