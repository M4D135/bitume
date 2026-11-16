// Tunnel de Haut-Col (David, 16/11/2026 : « dans le circuit Haut-Col, fais une partie dans un tunnel ») : 260 m de piste
// sous la roche, murs aux limites, voûte, lampes, pas de glissière ni d'arbre dedans, piste sèche sous la pluie.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
for (const f of ['carene', 'circuit', 'ferro/vehicle-dynamics', 'conduite', 'decor']) require('../src/' + f + '.js');
const B = globalThis.BITUME;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok  ' + nom); };
const c = B.circuit.creer(47, { theme: 'montagne', longueur: 5200, nom: 'Haut-Col' });
verifier('Haut-Col a un tunnel de 260 m, loin de la ligne des stands', () => {
  assert.ok(c.tunnel && c.tunnel.fin - c.tunnel.debut === 260, JSON.stringify(c.tunnel));
  assert.ok(c.tunnel.debut > .3 * c.longueur && c.tunnel.fin < .92 * c.longueur);
  for (const theme of ['foret', 'cote']) assert.equal(B.circuit.creer(theme === 'foret' ? 11 : 29, { theme, longueur: 4200 }).tunnel, null);
});
verifier('les murs du tunnel sont les limites de la piste', () => {
  for (let s = c.tunnel.debut; s < c.tunnel.fin; s += 10) for (const cote of [-1, 1]) assert.ok(Math.abs(B.conduite.limiteCote(c, s, cote) - c.tunnel.mur) < 1e-6, `s ${s}`);
  assert.ok(B.circuit.dansTunnel(c, c.tunnel.debut + 1) && !B.circuit.dansTunnel(c, c.tunnel.debut - 1) && B.circuit.dansTunnel(c, c.tunnel.debut - 1, 5));
});
verifier('voûte, murs, lampes et roche ; ni glissière ni arbre sous la roche', () => {
  const d = B.decor.construire(c), objets = d.lots.flatMap(l => l.objets);
  const lampes = objets.filter(o => o.emissive > 2 && o.mat === 5), voutes = objets.filter(o => o.shape === 'box' && o.s[1] === .7 && o.s[2] > 12);
  assert.ok(d.tunnelLampes && d.tunnelLampes.length === lampes.length, 'une lumière par lampe');
  assert.ok(objets.filter(o => o.outdoor === false).length > 300, 'intérieur éclairé dedans');
  assert.ok(lampes.length >= 20, `${lampes.length} lampes`);   // une tous les 12 m, d’un côté puis de l’autre
  assert.ok(voutes.length >= 40, `${voutes.length} morceaux de voûte`);   // un tous les 6 m
  const t = c.tunnel, milieu = B.circuit.echantillon(c, (t.debut + t.fin) / 2);
  const glissieres = objets.filter(o => o.shape === 'box' && Math.abs(o.s[1] - .34) < 1e-9 && Math.hypot(o.p[0] - milieu.x, o.p[2] - milieu.z) < 60);
  assert.equal(glissieres.length, 0, 'glissière au milieu du tunnel');
});
verifier('le tunnel est au milieu de la plus longue ligne droite, quel que soit le bruit des courbures', () => {
  const droit = s => Math.abs(B.circuit.echantillon(c, s).courbure) < 1 / 400;
  for (let s = c.tunnel.debut; s <= c.tunnel.fin; s += c.pas) assert.ok(droit(s), `courbe à s ${s}`);
  let avant = 0, apres = 0;
  while (droit(c.tunnel.debut - (avant + 1) * c.pas)) avant++;
  while (droit(c.tunnel.fin + (apres + 1) * c.pas)) apres++;
  assert.ok(avant >= 40 && Math.abs(avant - apres) <= 1, `ligne droite avant ${avant * c.pas} m, après ${apres * c.pas} m`);
  // des courbures de l'ordre de 1e-15 (elles changent d'un moteur JavaScript à l'autre) ne déplacent pas le tunnel
  const N = Math.round(260 / c.pas), i0 = B.circuit.choisirTunnel(c.courbure, c.n, N);
  assert.equal(i0 * c.pas, c.tunnel.debut);
  for (const graine of [1, 2, 3]) {
    const bruite = Float64Array.from(c.courbure, (k, i) => Math.abs(k) < 1e-9 ? (((i * 7 + graine) % 5) - 2) * 3e-15 : k * (1 + 1e-13 * graine));
    assert.equal(B.circuit.choisirTunnel(bruite, c.n, N), i0, `bruit ${graine}`);
  }
});
verifier('rien de la montagne ne dépasse dans le tunnel', () => {
  const d = B.decor.construire(c), t = c.tunnel, M = t.mur, H = t.hauteur, i0 = Math.round(t.debut / c.pas), i1 = Math.round(t.fin / c.pas);
  const roches = d.lots.flatMap(l => l.objets).filter(o => o.mat === 9);
  let vus = 0;
  for (const o of roches) {
    const [a, b, g] = o.r, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
    // colonnes de R = Rz(g)·Ry(b)·Rx(a) : images des axes locaux
    const X = [cg * cb, sg * cb, -sb], Y = [cg * sb * sa - sg * ca, sg * sb * sa + cg * ca, cb * sa], Z = [cg * sb * ca + sg * sa, sg * sb * ca - cg * sa, cb * ca];
    for (const u of [-.5, .5]) for (const v of [-.5, .5]) for (const w of [-.5, .5]) {
      const q = [0, 1, 2].map(k => o.p[k] + X[k] * u * o.s[0] + Y[k] * v * o.s[1] + Z[k] * w * o.s[2]);
      let best = null;
      for (let i = i0 - 5; i <= i1 + 5; i++) { const dx = q[0] - c.x[i], dz = q[2] - c.z[i], d2 = dx * dx + dz * dz; if (!best || d2 < best.d2) best = { i, d2, dx, dz }; }
      if (best.i <= i0 || best.i >= i1) continue;
      vus++;
      const lat = -Math.sin(c.cap[best.i]) * best.dx + Math.cos(c.cap[best.i]) * best.dz, haut = q[1] - c.y[best.i];
      assert.ok(!(Math.abs(lat) < M - .05 && haut > 0 && haut < H), `roche dans le tunnel : s ${best.i * c.pas}, d ${lat.toFixed(2)}, h ${haut.toFixed(2)}`);
    }
  }
  assert.ok(vus > 500, `${vus} coins de roche vérifiés`);
});
verifier('sous la voûte la piste reste sèche : les slicks y gardent toute leur adhérence', () => {
  assert.ok(B.conduite.adherencePneus('slicks', 0) === 1 && B.conduite.adherencePneus('slicks', 1) < .75);
});
console.log(`tunnel : ${n} vérifications passées`);
