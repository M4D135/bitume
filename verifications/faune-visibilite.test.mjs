import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/faune.js');
const F = globalThis.BITUME.faune;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const c = { theme: 'montagne', graine: 47, n: 151, pas: 2, longueur: 300, largeur: 10,
  x: Float64Array.from({ length: 151 }, (_, i) => i * 2 - 150), z: new Float64Array(151), cap: new Float64Array(151) };
let sondes = 0;
const decor = { lots: [], ecologie: { echantillonner(x, z, out) { out.herbe = out.fleurs = out.insectes = 1; return out; } },
  surfaceHerbe(x, z, out) { sondes++; if (Math.abs(z) <= 9) return null; out.y = 0; out.normal[1] = 1; return out; } };
const contexte = (yaw = 0) => ({ qualite: 'high', vue: 0, nuit: 1, pluie: 0, camera: { pos: [0, 1.5, 0], yaw, pitch: 0, fov: 70 }, aspect: 16 / 9, hauteur: 720 });
const stabiliser = (e, ctx, debut = 0) => { const out = []; for (let i = 0; i <= 120; i++) { out.length = 0; F.dessiner(e, debut + i / 60, ctx, out); } return out; };

verifier('habitats des insectes limités aux vrais abords, sans prairies lointaines', () => {
  const e = F.creer(c, decor);
  assert(e.habitats.length > 10);
  assert(e.habitats.every(h => Math.abs(h.z) > 9 && Math.abs(h.z) < c.largeur / 2 + 37));
});

verifier('hors champ : pas de trajectoire ni objet détaillé ; retour visible stable', () => {
  const e = F.creer(c, decor), ctx = contexte(), out = stabiliser(e, ctx);
  assert(out.length > 0); assert(out.every(o => o.p[2] < 4));
  const objets = e.vues[0].lucioles.slots.flatMap(s => s.objets), avant = objets.map(o => o.p.slice());
  ctx.camera.pos[0] = 100000; ctx.camera.pos[2] = 100000;
  sondes = 0;
  for (let i = 0; i < 120; i++) { out.length = 0; F.dessiner(e, 3 + i / 60, ctx, out); assert.equal(out.length, 0); }
  assert.equal(sondes, 0); objets.forEach((o, i) => assert.deepEqual(o.p, avant[i]));
  ctx.camera.pos[0] = ctx.camera.pos[2] = 0;
  const retour = stabiliser(e, ctx, 5); assert(retour.length > 0);
  assert(retour.every(o => o.p.every(Number.isFinite)));
});

verifier('rotation seule, regard vers le ciel et glaces réelles changent les habitats utiles', () => {
  const e = F.creer(c, decor), ctx = contexte();
  const devant = stabiliser(e, ctx); assert(devant.length > 0 && devant.every(o => o.p[2] < 4));
  ctx.camera.yaw = Math.PI;
  const derriere = stabiliser(e, ctx, 3); assert(derriere.length > 0 && derriere.every(o => o.p[2] > -4));
  ctx.camera.pitch = Math.PI / 2;
  const ciel = stabiliser(e, ctx, 6); assert.equal(ciel.length, 0);
  const miroir = contexte(0); ctx.vuesSecondaires = [miroir];
  const reflet = stabiliser(e, ctx, 9); assert(reflet.length > 0);
  miroir.qualite = 'off'; assert.equal(stabiliser(e, ctx, 12).length, 0);
});

verifier('J1/J2 utilisent des pools distincts, Off ne sélectionne rien', () => {
  const e = F.creer(c, decor), a = contexte(), b = contexte(Math.PI); b.vue = 1;
  const oa = stabiliser(e, a), ob = stabiliser(e, b);
  assert(oa.length && ob.length); assert(oa.every(o => !ob.includes(o)));
  assert(oa.every(o => o.p[2] < 4) && ob.every(o => o.p[2] > -4));
  a.qualite = 'off'; const requetes = e.vues[0].stats.requetes;
  assert.equal(stabiliser(e, a, 3).length, 0); assert.equal(e.vues[0].stats.requetes, requetes);
});
console.log(controles + ' contrôles faune visibilité');
