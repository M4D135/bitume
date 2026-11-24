// Lot B — Autodrome des Alizés : le dévers qualifié est celui des triangles réellement produits
// (dessinés puis transmis à PhysX par le vrai installeur), pas la valeur devers[] de configuration.
// Le plan issu de hauteurRoute incline la chaussée de atan(sin(devers)) tant que la hauteur
// emploie sin : ce contrôle exige l'angle demandé (~40°) au cœur des quatre gauches, plan sur
// toute la largeur (axe, traces de roues, bords), relevé vers l'extérieur, sans ressaut, et le
// contact PhysX identique au dessin.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'route-des-cimes', 'carene', 'botanique', 'ecologie', 'saisons', 'vegetation', 'bords', 'decor', 'obstacles', 'solides-physx']) require('../src/' + f + '.js');
const B = globalThis.BITUME, S = B.solidesPhysX;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok  ' + nom); };
const DEG = 180 / Math.PI;

const c = B.circuit.creer(347, { partition: 'ovale-des-forges' });
const decor = B.decor.construire(c, { qualite: 'low', matieres: false });

// — triangles de chaussée réellement transmis à PhysX (surface 1), via le vrai installeur.
const objets = new Map();
const monde = {
  next: 1,
  addTriangleMesh(vertices, indices, options) { const id = this.next++; objets.set(id, { vertices, indices, options }); return id; },
  addBox() { return this.next++; },
  remove() {},
};
const montage = S.installer(monde, c, decor);
const chaussée = [];
for (const [id, info] of montage.acteurs) {
  if (info.genre !== 'chaussee' || !info.surfaces) continue;
  const o = objets.get(id);
  for (let t = 0; t < info.surfaces.length; t++) {
    if (info.surfaces[t] !== 1) continue;
    const v = k => [o.vertices[k * 3], o.vertices[k * 3 + 1], o.vertices[k * 3 + 2]];
    chaussée.push([v(o.indices[t * 3]), v(o.indices[t * 3 + 1]), v(o.indices[t * 3 + 2])]);
  }
}
verifier('la chaussée PhysX existe et vient des triangles dessinés', () => {
  assert.ok(chaussée.length > 2000, 'trop peu de triangles de chaussée : ' + chaussée.length);
  assert.ok(montage.statistiques.trianglesSol > 0);
});

// — repères des quatre gauches : mêmes constantes que creerOvaleDesForges.
const droite = 400, courte = 120, virage = 140, avantLigne = 112;
const demiTour = droite + courte + 2 * virage;
const premier = droite - avantLigne, second = premier + virage + courte;
const debuts = [premier, second, premier + demiTour, second + demiTour];
const cœurs = debuts.map(d => d + virage / 2);
const w = c.largeur / 2;

function cadreS(s) {
  const e = B.circuit.echantillon(c, s), a = e.cap;
  return { x: e.x, y: e.y, z: e.z, a, r: [-Math.sin(a), 0, Math.cos(a)], k: e.courbure, devers: e.devers };
}
function trianglesAutour(s, demiFenetre) {
  // Fenêtre longitudinale prise dans le repère du cœur (sinon tout sommet est à sa station),
  // latérale comparée au repère de la station la plus proche (les sommets sont aux stations).
  const f0 = cadreS(s), res = [];
  for (const tri of chaussée) {
    const l = tri.map(p => {
      const dx0 = p[0] - f0.x, dz0 = p[2] - f0.z;
      const lon0 = dx0 * Math.cos(f0.a) + dz0 * Math.sin(f0.a);
      const lat0 = -dx0 * Math.sin(f0.a) + dz0 * Math.cos(f0.a);
      const i = Math.round((s + lon0) / c.pas);
      const f = cadreS(i * c.pas);
      const dx = p[0] - f.x, dz = p[2] - f.z;
      return { lon0, lat0, lateral: -dx * Math.sin(f.a) + dz * Math.cos(f.a), y: p[1], i };
    });
    if (l.some(p => Math.abs(p.lon0) > demiFenetre || Math.abs(p.lat0) > w + 0.1)) continue;
    res.push({ tri, l });
  }
  return res;
}
function normaleInclinee(tri) {
  const [a, b, cc] = tri;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const ln = Math.hypot(nx, ny, nz);
  if (ln < 1e-12) return null;
  if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
  return Math.acos(Math.min(1, ny / ln)) * DEG;
}
function ajustePlan(pts) {
  // y = a·lateral + b par moindres carrés ; renvoie pente, ordonnée et pire résidu.
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of pts) { sx += p.lateral; sy += p.y; sxx += p.lateral * p.lateral; sxy += p.lateral * p.y; }
  const N = pts.length, a = (N * sxy - sx * sy) / (N * sxx - sx * sx), b = (sy - a * sx) / N;
  let pire = 0;
  for (const p of pts) pire = Math.max(pire, Math.abs(p.y - (a * p.lateral + b)));
  return { pente: a, b, pire };
}
function angleProduit(s) {
  const f = cadreS(s), g = w - 0.4;
  return Math.atan((B.decor.hauteurRoute(f, g, w) - B.decor.hauteurRoute(f, -g, w)) / (2 * g)) * DEG;
}

const FENETRE = 5; // le palier plein de 40° court sur 12 m au centre de chaque gauche
verifier('dévers produit ≈ 40° au cœur des quatre gauches, mesuré sur les triangles PhysX', () => {
  for (const s of cœurs) {
    const t = trianglesAutour(s, FENETRE);
    assert.ok(t.length >= 4, 'trop peu de triangles au cœur de s=' + s.toFixed(0) + ' : ' + t.length);
    const angles = t.map(x => normaleInclinee(x.tri)).filter(v => v !== null).sort((x, y) => x - y);
    const angle = angles[Math.floor(angles.length / 2)];
    assert.ok(angle >= 39 && angle <= 41,
      `cœur à s=${s.toFixed(0)} : inclinaison réellement produite ${angle.toFixed(2)}° hors de [39, 41]`);
  }
});

verifier('sens du relevage : bord droit haut, bord gauche bas dans les gauches', () => {
  for (const s of cœurs) {
    const f = cadreS(s);
    assert.ok(f.k < 0, `cœur à s=${s.toFixed(0)} n’est pas à gauche (courbure ${f.k})`);
    const plan = ajustePlan(trianglesAutour(s, FENETRE).flatMap(x => x.l));
    assert.ok(plan.pente > 0.7, `cœur à s=${s.toFixed(0)} : pente transversale ${plan.pente.toFixed(3)} doit être positive (droit haut)`);
  }
});

verifier('plan sur toute la largeur : résidus ≤ 2 cm, axe, traces de roues et bords sur le même plan', () => {
  for (const s of cœurs) {
    const f = cadreS(s);
    const pts = trianglesAutour(s, FENETRE).flatMap(x => x.l);
    const plan = ajustePlan(pts);
    assert.ok(plan.pire <= 0.02, `cœur à s=${s.toFixed(0)} : écart au plan de ${(plan.pire * 100).toFixed(1)} cm`);
    // Les quads de chaussée sont plans : le plan des sommets bord à bord régit toute la largeur.
    // Les hauteurs produites à l'axe, aux traces de roues et aux bords doivent y tomber.
    let couverts = 0;
    for (const d of [0, -3.4, 3.4, -(w - 0.4), w - 0.4]) {
      const y = B.decor.hauteurRoute(f, d, w);
      assert.ok(Math.abs(y - (plan.pente * d + plan.b)) <= 0.02,
        `cœur à s=${s.toFixed(0)} : hauteur produite à d=${d} hors du plan des triangles`);
      couverts++;
    }
    assert.equal(couverts, 5);
  }
});

verifier('transitions douces : pas de ressaut de dévers produit, petites droites plates', () => {
  let ressaut = 0, precedent = angleProduit(0);
  for (let s = 1; s < c.longueur; s += 1) {
    const a = angleProduit(s);
    if (Math.abs(a - precedent) > ressaut) ressaut = Math.abs(a - precedent);
    precedent = a;
  }
  assert.ok(ressaut <= 1.2, `variation produite de ${ressaut.toFixed(2)}° par mètre : ressaut détecté`);
  const petiteDroite = second + virage + courte / 2;
  assert.ok(Math.abs(angleProduit(petiteDroite)) < 0.05, `petite droite à s=${petiteDroite} non plate`);
});

verifier('les triangles de contact reproduisent la hauteur produite (garde ≤ 2 cm)', () => {
  for (const s of cœurs) {
    let pire = 0;
    for (const p of trianglesAutour(s, FENETRE).flatMap(x => x.l)) {
      pire = Math.max(pire, Math.abs(p.y - B.decor.hauteurRoute(cadreS(p.i * c.pas), p.lateral, w)));
    }
    assert.ok(pire <= 0.02, `cœur à s=${s.toFixed(0)} : écart contact/production de ${(pire * 100).toFixed(1)} cm`);
  }
});

console.log(`${n} contrôles — dévers Alizés`);