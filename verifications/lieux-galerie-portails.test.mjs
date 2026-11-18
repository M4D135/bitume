import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/lieux.js';

const B = globalThis.BITUME;

function circuitSynthetique() {
  const longueur = 9700;
  const pas = 1;
  const largeur = 12;
  const graine = 7;
  const n = Math.ceil(longueur / pas);
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  const alea = B.lieux.alea(graine);
  let cap = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    x[i] = cx;
    z[i] = cz;
    const courbure = (B.lieux.hache(i, 0, graine) - 0.5) * 0.003;
    cap += courbure;
    cx += Math.cos(cap) * pas;
    cz += Math.sin(cap) * pas;
  }
  return { x, z, pas, longueur, largeur, graine };
}

test('piliersGalerie : structure et géométrie', () => {
  const circuit = circuitSynthetique();
  const lots = B.lieux.piliersGalerie(circuit);
  assert.equal(lots.length, 20, 'Nombre de piliers');
  for (const lot of lots) {
    assert.equal(lot.type, 'pilier');
    assert.equal(lot.meta.cote, -1);
    const nappe = lot.nappes[0];
    const hauteur = nappe.max[1] - nappe.min[1];
    assert.ok(hauteur >= 4.5 && hauteur <= 5.5, 'Hauteur hors bornes: ' + hauteur);
  }
});

test('portailsTunnels : structure et géométrie', () => {
  const circuit = circuitSynthetique();
  const lots = B.lieux.portailsTunnels(circuit);
  assert.equal(lots.length, 4, 'Nombre de portails');
  const tunnels_attendus = ['rocher', 'echelles'];
  const faces_attendues = ['entree', 'sortie'];
  for (const lot of lots) {
    assert.equal(lot.type, 'portail');
    assert.ok(tunnels_attendus.includes(lot.meta.tunnel), 'Tunnel inconnu: ' + lot.meta.tunnel);
    assert.ok(faces_attendues.includes(lot.meta.face), 'Face inconnue: ' + lot.meta.face);
    const piste = B.lieux.echantillonPiste(circuit, lot.meta.s);
    const r2 = piste.r2;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const v of lot.nappes[0].s) {
      const lat = v.p[0] * r2[0] + v.p[2] * r2[2];
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const largeur_reelle = maxLat - minLat;
    const attendu = circuit.largeur + 2;
    assert.ok(Math.abs(largeur_reelle - attendu) <= 0.5, 'Largeur hors bornes: ' + largeur_reelle);
  }
});
