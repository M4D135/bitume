// Appuis et obstacles réels du catalogue, interrogés par PhysX WASM après cuisson des triangles.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'route-des-cimes', 'carene', 'botanique', 'ecologie', 'saisons', 'vegetation', 'bords', 'decor', 'obstacles', 'solides-physx']) require('../src/' + f + '.js');
const B = globalThis.BITUME, S = B.solidesPhysX, X = await chargerPhysX();
const catalogue = vm.runInNewContext(readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8').match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
let nombre = 0;
function verifier(nom, f) { f(); nombre++; console.log('ok  ' + nom); }
function tourner(r, v) { const [x, y, z] = r || [0, 0, 0], [a, b, c] = v, b1 = Math.cos(x) * b - Math.sin(x) * c, c1 = Math.sin(x) * b + Math.cos(x) * c, a2 = Math.cos(y) * a + Math.sin(y) * c1, c2 = -Math.sin(y) * a + Math.cos(y) * c1; return [Math.cos(z) * a2 - Math.sin(z) * b1, Math.sin(z) * a2 + Math.cos(z) * b1, c2]; }
const rapports = [];
for (const k of catalogue) {
  const c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom, partition: k.partition }); B.bords.limites(c, B.bords.planifier(c));
  const decor = B.decor.construire(c, { qualite: 'low', vegetation: false, saison: 'ete' }); c.obstacles = B.obstacles.creer(decor.obstacles);
  const world = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 1, contacts: true }), montage = S.installer(world, c, decor);
  const marques = (decor.lotsHerbier || decor.lots).flatMap(l => l.objets).filter(o => o.solidePhysX && !o.collision);
  let rayons = 0;
  try {
    verifier(k.nom + ' : rayons de suspension sur chaussée, vibreurs et accotements', () => {
      const w = c.largeur / 2, hit = {};
      for (let i = 0; i < c.n; i += 19) for (const d of [-w - 2, -w + .5, 0, w - .5, w + 2]) {
        const s = i * c.pas + .37;
        // Sur un vrai pont, l’herbe au-delà du parapet n’est plus un sol de roulement.
        if (Math.abs(d) > w + 1 && c.ponts?.some(p => s > p.debut + 3 && s < p.fin - 3)) continue;
        const q = B.circuit.echantillon(c, s), x = q.x - Math.sin(q.cap) * d, z = q.z + Math.cos(q.cap) * d;
        const sol = q.y - Math.max(-w, Math.min(w, d)) * Math.sin(q.devers);
        world.raycast([x, sol + 2, z], [0, -1, 0], 3, { mask: 1, staticOnly: true }, hit); rayons++;
        assert.ok(hit.hit, `appui absent à s=${i * c.pas + .37}, d=${d}`);
        assert.ok(hit.y > sol - .3 && hit.ny > .6, 'appui incohérent avec les triangles visibles');
        assert.equal(montage.acteurs.get(hit.body)?.groupe, 1);
        assert.ok(['piste', 'vibreur', 'herbe'].includes(S.surface(montage, hit.body, hit.faceIndex)));
      }
      // Vérifie réellement le remappage des faces après cooking, pas seulement les métadonnées JavaScript.
      for (const type of ['piste', 'vibreur', 'herbe']) {
        let valide = false;
        for (const [id, meta] of montage.acteurs) if (meta.source === 'nappe' && meta.genre === 'chaussee') {
          const n = decor.nappes[meta.index], code = ['', 'piste', 'vibreur', 'herbe'].indexOf(type);
          for (let j = 0; j < meta.surfaces.length && !valide; j++) if (meta.surfaces[j] === code) {
            const p = [0, 0, 0]; for (let v = 0; v < 3; v++) for (let a = 0; a < 3; a++) p[a] += n.sommets[n.indices[j * 3 + v] * 13 + a] / 3;
            world.raycast([p[0], p[1] + .5, p[2]], [0, -1, 0], 1, { mask: 1, staticOnly: true }, hit); rayons++;
            if (hit.hit && hit.body === id && hit.faceIndex === j) { assert.equal(S.surface(montage, hit.body, hit.faceIndex), type); valide = true; }
          }
          if (valide) break;
        }
        assert.ok(valide, 'surface cuite non vérifiée : ' + type);
      }
    });
    verifier(k.nom + ' : vraies lisses solides, filtres de suspension séparés', () => {
      let controlees = 0;
      for (const [id, meta] of montage.acteurs) if (meta.genre === 'glissiere' && meta.source === 'primitive') {
        const o = marques[meta.index], n = tourner(o.r, [0, 0, 1]), depart = o.p.map((v, a) => v - n[a]);
        const hit = world.raycast(depart, n, 2, { mask: 2, staticOnly: true }); rayons++;
        assert.ok(hit.hit, 'lisse traversable');
        assert.ok(montage.acteurs.get(hit.body)?.groupe === 2);
        const appui = world.raycast(depart, n, 2, { mask: 1, staticOnly: true }); rayons++;
        assert.ok(!appui.hit || appui.body !== id, 'la suspension se porte sur une glissière');
        if (++controlees === 6) break;
      }
      assert.equal(controlees, 6);
    });
    const fosse = B.bords.planifier(c).dangers.find(d => d.type === 'fosse');
    if (fosse) verifier(k.nom + ' : aucun mur abstrait sur la limite du fossé', () => {
      const bornes = B.bords.bornes(c, fosse), s = (bornes.i0 + 2) * c.pas, q = B.circuit.echantillon(c, s), cote = fosse.cote;
      const lim = B.circuit.limiteA(c, s, cote), d = cote * (lim - .7), n = [-Math.sin(q.cap) * cote, 0, Math.cos(q.cap) * cote];
      const p = [q.x - Math.sin(q.cap) * d, q.y - cote * c.largeur / 2 * Math.sin(q.devers) + .45, q.z + Math.cos(q.cap) * d];
      const hit = world.raycast(p, n, 1.4, { mask: 2, staticOnly: true }); rayons++;
      assert.equal(hit.hit, false, 'un obstacle fictif a remplacé la limite de Frenet');
    });
    if (c.tunnel) verifier('Haut-Col : vrai revêtement intérieur, murs et voûte présents', () => {
      const s = (c.tunnel.debut + c.tunnel.fin) / 2, q = B.circuit.echantillon(c, s);
      const hit = world.raycast([q.x, q.y + 1, q.z], [0, -1, 0], 2, { mask: 1, staticOnly: true }); rayons++;
      assert.ok(hit.hit); assert.equal(montage.acteurs.get(hit.body)?.genre, 'sol-tunnel'); assert.equal(S.surface(montage, hit.body, hit.faceIndex), 'piste');
      assert.ok(hit.y > q.y + .025 && hit.y < q.y + .065, 'le dessus du revêtement à +4 cm manque');
      for (const cote of [-1, 1]) {
        const mur = world.raycast([q.x, q.y + 1, q.z], [-Math.sin(q.cap) * cote, 0, Math.cos(q.cap) * cote], c.tunnel.mur + 1, { mask: 2, staticOnly: true }); rayons++;
        assert.ok(mur.hit); assert.equal(montage.acteurs.get(mur.body)?.genre, 'mur-tunnel');
      }
      const toit = world.raycast([q.x, q.y + 1, q.z], [0, 1, 0], c.tunnel.hauteur + 1, { mask: 2, staticOnly: true }); rayons++;
      assert.ok(toit.hit); assert.equal(montage.acteurs.get(toit.body)?.genre, 'voute-tunnel');
    });
    if (k.id === 'val-brule') verifier('Val-Brûlé : une lisse réelle arrête aussi un débris dynamique avec CCD', () => {
      const axe = B.circuit.echantillon(c, 800), candidats = [...montage.acteurs].filter(([, a]) => a.genre === 'glissiere');
      candidats.sort((a, b) => { const pa = marques[a[1].index].p, pb = marques[b[1].index].p; return Math.hypot(pa[0] - axe.x, pa[2] - axe.z) - Math.hypot(pb[0] - axe.x, pb[2] - axe.z); });
      const [idRail, meta] = candidats[0], o = marques[meta.index], n = tourner(o.r, [0, 0, 1]), depart = o.p.map((v, a) => v - n[a] * 1.5);
      const id = world.addBox(depart, [.2, .2, .2], { type: 'dynamic', mass: 8, group: 8, mask: 15, ccd: true, restitution: 0 });
      world.setVelocity(id, n.map(v => v * 30)); let contact = false;
      for (let i = 0; i < 15; i++) { world.step(1 / 120); for (let j = 0; j < world.contacts.count; j++) { const p = world.contacts.points[j]; if ((p.a === id && p.b === idRail) || (p.b === id && p.a === idRail)) contact = true; } }
      const p = world.readPose(id), franchi = n.reduce((s, v, i) => s + v * (p[i] - o.p[i]), 0);
      assert.ok(contact, 'aucun contact natif avec la lisse'); assert.ok(franchi < .05, 'débris passé au travers de la lisse'); world.remove(id);
    });
    rapports.push({ circuit: k.id, acteurs: montage.ids.length, rayons });
  } finally { S.liberer(montage); assert.equal(world._bodies.size, 0); world.dispose(); }
}
verifier('les ' + catalogue.length + ' mondes libérés ne gardent aucun acteur ni monde natif', () => { assert.equal(X.status().worlds, 0); });
console.log(JSON.stringify({ controles: nombre, versionPhysX: X.status().version, rapports }));
