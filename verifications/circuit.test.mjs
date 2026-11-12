import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));

charger('circuit.js');
const B = globalThis.BITUME;

function verifier(nom, f) {
  try {
    f();
    console.log(`ok  ${nom}`);
  } catch (e) {
    console.error(`FAIL ${nom}: ${e.message}`);
    process.exit(1);
  }
}

const graines = [11, 29, 47];
const themes = ['foret', 'cote', 'montagne'];
const longueurs = [4200, 3600, 5200];

for (let i = 0; i < graines.length; i++) {
  const graine = graines[i];
  const theme = themes[i];
  const longueur = longueurs[i];
  
  verifier(`Création circuit ${graine} (${theme})`, () => {
    const c = B.circuit.creer(graine, { theme, longueur });
    assert.ok(c);
    assert.equal(c.theme, theme);
  });
  
  verifier(`Validation circuit ${graine}`, () => {
    const c = B.circuit.creer(graine, { theme, longueur });
    const msgs = B.circuit.valider(c);
    assert.deepEqual(msgs, [], `Erreurs de validation: ${msgs.join(', ')}`);
  });
  
  verifier(`Longueur circuit ${graine}`, () => {
    const c = B.circuit.creer(graine, { theme, longueur });
    assert.equal(c.longueur % 2, 0);
    assert.ok(Math.abs(c.longueur - longueur) <= longueur * 0.08, `Longueur ${c.longueur} hors plage`);
  });
  
  verifier(`Déterminisme circuit ${graine}`, () => {
    const c1 = B.circuit.creer(graine, { theme, longueur });
    const c2 = B.circuit.creer(graine, { theme, longueur });
    assert.deepEqual(c1.x, c2.x);
    assert.deepEqual(c1.z, c2.z);
    assert.deepEqual(c1.cap, c2.cap);
  });
  
  verifier(`Fermeture circuit ${graine}`, () => {
    const c = B.circuit.creer(graine, { theme, longueur });
    const dx = c.x[c.n - 1] - c.x[0];
    const dz = c.z[c.n - 1] - c.z[0];
    const dist = Math.sqrt(dx * dx + dz * dz);
    assert.ok(dist < 2.5, `Distance de fermeture ${dist}`);
  });
  
  verifier(`Echantillonnage circuit ${graine}`, () => {
    const c = B.circuit.creer(graine, { theme, longueur });
    const s = 100;
    const i = Math.floor(s / c.pas);
    const e = B.circuit.echantillon(c, s);
    assert.equal(e.x, c.x[i]);
    assert.equal(e.z, c.z[i]);
    assert.equal(e.cap, c.cap[i]);
  });
  
  verifier(`Point circuit ${graine}`, () => {
    const c = B.circuit.creer(graine, { theme, longueur });
    const s = 100;
    const p = B.circuit.point(c, s, 0);
    const i = Math.floor(s / c.pas);
    assert.equal(p[0], c.x[i]);
    assert.equal(p[2], c.z[i]);
  });
  
  verifier(`Repère orthonormé circuit ${graine}`, () => {
    const c = B.circuit.creer(graine, { theme, longueur });
    const s = 100;
    const r = B.circuit.repere(c, s);
    
    const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    const norm = (a) => Math.sqrt(dot(a, a));
    
    assert.ok(Math.abs(norm(r.t) - 1) < 1e-6, 't non unitaire');
    assert.ok(Math.abs(norm(r.r) - 1) < 1e-6, 'r non unitaire');
    assert.ok(Math.abs(norm(r.n) - 1) < 1e-6, 'n non unitaire');
    
    assert.ok(Math.abs(dot(r.t, r.r)) < 1e-6, 't.r != 0');
    assert.ok(Math.abs(dot(r.t, r.n)) < 1e-6, 't.n != 0');
    assert.ok(Math.abs(dot(r.r, r.n)) < 1e-6, 'r.n != 0');
  });
  
  verifier(`Ligne droite départ circuit ${graine}`, () => {
    const c = B.circuit.creer(graine, { theme, longueur });
    // Vérifier la courbure autour du départ (s=0)
    for (let s = -120; s <= 80; s += 2) {
      const e = B.circuit.echantillon(c, s);
      assert.ok(Math.abs(e.courbure) < 1/900, `Courbure trop élevée à s=${s}: ${e.courbure}`);
    }
  });
  
  verifier(`Vitesse circuit ${graine}`, () => {
    const c = B.circuit.creer(graine, { theme, longueur });
    let minV = Infinity;
    let maxV = 0;
    let minS = 0;
    
    for (let i = 0; i < c.n; i++) {
      const v = c.vitesse[i];
      assert.ok(v <= 86, `Vitesse > 86: ${v}`);
      assert.ok(v > 15, `Vitesse <= 15: ${v}`);
      if (v < minV) {
        minV = v;
        minS = i * c.pas;
      }
      if (v > maxV) maxV = v;
    }
    
    // Vérifier que la vitesse minimale est dans un virage serré
    const e = B.circuit.echantillon(c, minS);
    assert.ok(Math.abs(e.courbure) > 1/70, `Vitesse min hors virage serré`);
  });
  
  verifier(`Ligne idéale circuit ${graine}`, () => {
    const c = B.circuit.creer(graine, { theme, longueur });
    const maxD = c.largeur / 2 - 1.4;
    for (let i = 0; i < c.n; i++) {
      assert.ok(Math.abs(c.ligne[i]) <= maxD, `Ligne hors bornes: ${c.ligne[i]}`);
    }
  });
  
  verifier(`Ecart circuit ${graine}`, () => {
    const c = B.circuit.creer(graine, { theme, longueur });
    const d = B.circuit.ecart(c, c.longueur - 10, 10);
    assert.equal(d, 20);
  });
}

process.exit(0);
