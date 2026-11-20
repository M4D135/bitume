// Haut-Col : le centre du corps peut être visible alors que la crête masque le sol sous les sabots.
// Les sondes de vérification partent de la caméra, à l'inverse du contrôle de production.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit','conduite','carene','ecologie','saisons','botanique','vegetation','bords','decor','obstacles','solides-physx','ambiance','animaux','cinema']) require('../src/' + f + '.js');
const B = globalThis.BITUME, A = B.animaux, C = B.cinema, X = await chargerPhysX();
let controles = 0, postes = 0, sondes = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
function triangleSous(decor, x, z) {
  for (const n of decor.nappes) {
    if (n.surfaceType !== 'terrain') continue;
    const S = n.sommets, I = n.indices;
    for (let k = 0; k < I.length; k += 3) {
      const a = I[k] * 13, b = I[k + 1] * 13, c = I[k + 2] * 13;
      if (x < Math.min(S[a], S[b], S[c]) || x > Math.max(S[a], S[b], S[c]) || z < Math.min(S[a+2], S[b+2], S[c+2]) || z > Math.max(S[a+2], S[b+2], S[c+2])) continue;
      const det = (S[b+2]-S[c+2])*(S[a]-S[c])+(S[c]-S[b])*(S[a+2]-S[c+2]);
      const u = ((S[b+2]-S[c+2])*(x-S[c])+(S[c]-S[b])*(z-S[c+2]))/det;
      const v = ((S[c+2]-S[a+2])*(x-S[c])+(S[a]-S[c])*(z-S[c+2]))/det;
      if (u >= -1e-8 && v >= -1e-8 && u+v <= 1+1e-8) return u*S[a+1]+v*S[b+1]+(1-u-v)*S[c+1];
    }
  }
  return null;
}
for (const saison of ['ete', 'hiver']) {
  const c = B.circuit.creer(47, { theme: 'montagne', longueur: 5200 });
  B.bords.limites(c, B.bords.planifier(c));
  const decor = B.decor.construire(c, { qualite: 'high', vegetationQualite: 'high', saison });
  const animaux = A.creer(c, decor, { saison }), world = X.createWorld({ fixedStep: 1/120, maxSubSteps: 1 });
  const montage = B.solidesPhysX.installer(world, c, decor);
  try {
    const cin = C.preparer(c, decor, animaux, world), poses = [B.circuit.echantillon(c, 200)];
    C.regler(cin, { faune: 'high', nuit: 0, pluie: 0 });
    const ancres = cin.ancres.faune.filter(a => a.label === 'Bouquetin des Alpes');
    assert.equal(ancres.length, 4, 'les quatre groupes de Haut-Col restent présents');
    const avant = Array.from(animaux.cour);
    verifier(saison + ' : les bêtes restent sur les triangles dessinés, sans déplacement du sol', () => {
      for (const a of ancres) for (let i = a.groupe.debut; i < a.groupe.debut+a.groupe.n; i++) {
        const p = A.poseAnimal(animaux, i, 0), y = triangleSous(decor, p.x, p.z);
        assert.notEqual(y, null, 'triangle absent sous un bouquetin');
        assert(Math.abs(y-p.y) < .002, 'base animale décalée du terrain rendu');
      }
    });
    verifier(saison + ' : chaque poste faune montre le terrain autour des sabots', () => {
      for (const a of ancres) for (const cote of [-1, 1]) {
        const plan = { vue: 'faune', ancre: a, sujet: 0, debut: 0, fin: 5.6, cote, nature: true };
        let poste;
        for (const t of [0, 2.8, 5.5]) {
          const cam = C.camera(cin, plan, poses, {}, t);
          assert(cam, 'poste faune perdu : ' + a.indice + '/' + cote);
          if (poste) assert.deepEqual(cam.pos, poste, 'le poste ne saute pas pendant le plan');
          else poste = cam.pos;
          const animal = A.poseAnimal(animaux, a.indice, t);
          for (const [dx,dz] of [[0,0],[.25,0],[-.25,0],[0,.25],[0,-.25]]) {
            const x = animal.x+dx, z = animal.z+dz, sol = triangleSous(decor, x, z);
            assert.notEqual(sol, null);
            const direction = [x-cam.pos[0], sol+.06-cam.pos[1], z-cam.pos[2]], distance = Math.hypot(...direction);
            const hit = world.raycast(cam.pos, direction.map(v => v/distance), distance-.04, { mask: 3, staticOnly: true });
            assert(!hit.hit, 'une crête masque encore les appuis : ' + a.indice + '/' + cote);
            sondes++;
          }
        }
        postes++;
      }
      assert.deepEqual(Array.from(animaux.cour), avant, 'le cadrage ne déplace aucun animal');
    });
    verifier(saison + ' : perdre les appuis interrompt le plan sans déplacer le poste', () => {
      const a = ancres[0], plan = { vue: 'faune', ancre: a, sujet: 0, debut: 0, fin: 5.6, cote: 1, nature: true };
      const cam = C.camera(cin, plan, poses, {}, 0), p = A.poseAnimal(animaux, a.indice, 0);
      assert(cam);
      cin.monde = { raycast(origin, direction, distance, options, out) {
        if (origin[1] < p.y+.2 && Math.hypot(origin[0]-p.x, origin[2]-p.z) < 1) return { hit: true };
        return world.raycast(origin, direction, distance, options, out);
      } };
      assert.equal(C.camera(cin, plan, poses, {}, 1), null, 'masquage des pattes ignoré');
      assert.deepEqual(cin.plans.get(plan), cam.pos, 'pas de glissement ou de bond de caméra dans le même plan');
      cin.monde = world;
    });
  } finally { B.solidesPhysX.liberer(montage); world.dispose(); }
}
assert.equal(postes, 16); assert.equal(sondes, 240); assert.equal(X.status().worlds, 0);
console.log(controles + ' contrôles réussis, ' + postes + ' postes et ' + sondes + ' rayons vers le terrain');
