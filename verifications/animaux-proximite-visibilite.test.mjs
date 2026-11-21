import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const f of ['moteur/renderer', 'carene', 'route-des-cimes', 'circuit', 'ecologie', 'saisons', 'botanique', 'vegetation', 'decor', 'ambiance', 'animaux']) require('../src/' + f + '.js');
const B = globalThis.BITUME, A = B.animaux, NP = 17;
// Node n'a pas window : enregistrer les mêmes formes par l'API publique utilisée au chargement navigateur.
for (const forme of A.FORMES.values()) globalThis.FRender.forme(forme.nom, forme.tri);
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
const decor = B.decor.construire(c, { vegetation: false, vegetationQualite: 'off', qualite: 'low', saison: 'ete' });
const creer = () => A.creer(c, decor, { saison: 'ete' });
const vers = (etat, groupe, vue = 0) => ({ vue, qualite: 'high', camera: {
  pos: [groupe.hx + 40, A.solExact(etat.G.T, groupe.hx, groupe.hz) + 2, groupe.hz],
  yaw: -Math.PI / 2, pitch: 0, roll: 0, fov: 42,
}, aspect: 16 / 9, hauteur: 720 });
const vide = { qualite: 'high', camera: { pos: [100000, 100000, 100000], yaw: 0, fov: 60 }, aspect: 16 / 9, hauteur: 720 };

verifier('chaque biome du catalogue possède une bande proche finie', () => {
  for (const theme of Object.keys(A.BIOMES)) assert(Number.isFinite(A.BANDES_ABORDS[theme]) && A.BANDES_ABORDS[theme] <= 50, theme);
  for (const options of [{ theme: 'baikal', graine: 179, longueur: 5400 }, { theme: 'montagne', graine: 181, partition: 'route-des-cimes' }]) {
    const c = B.circuit.creer(options.graine, options), d = B.decor.construire(c, { vegetation: false, vegetationQualite: 'off', qualite: 'low' }), e = A.creer(c, d);
    assert(e.nAnimaux > 0);
    assert(e.cour.every(Number.isFinite));
    for (const g of e.groupes) assert(g.dAxe <= (c.largeur / 2 || 5) + A.BANDES_ABORDS[options.theme]);
  }
});

verifier('abords : chaque animal reste proche du vrai bord, hors du dégagement', () => {
  const etat = creer();
  for (let a = 0; a < etat.nAnimaux; a++) {
    const x = etat.cour[a * NP], z = etat.cour[a * NP + 1];
    let distance = Infinity, limite = 0;
    for (let i = 0; i < c.n; i++) {
      const d = Math.hypot(x - c.x[i], z - c.z[i]);
      if (d < distance) { distance = d; limite = Math.max(c.limiteG[i], c.limiteD[i]); }
    }
    assert(distance >= limite + A.GARDE_BORD, 'aucun animal dans le dégagement');
    assert(distance - c.largeur / 2 <= A.BANDES_ABORDS.foret + 3, 'aucun habitat lointain');
  }
  assert(etat.groupes.some(g => g.dAxe < 34), 'la garde historique de 34 m ne subsiste pas');
});

verifier('aucune vue au départ : cerveau et hasard restent immobiles', () => {
  const etat = creer(), positions = etat.cour.slice(), cerveau = etat.cer.slice(), graines = etat.graines.slice();
  for (let i = 0; i < 1200; i++) A.pas(etat, i / 120, []);
  assert.deepEqual(etat.cour, positions); assert.deepEqual(etat.cer, cerveau); assert.deepEqual(etat.graines, graines);
  assert.equal(A.stats(etat).activite.pasGroupes, 0);
  assert.equal(A.stats(etat).activite.groupesEndormis, etat.groupes.length);
});

verifier('sélection avant simulation : seuls les groupes du champ avancent', () => {
  const etat = creer(), ctx = vers(etat, etat.groupes[0]), initial = etat.cour.slice();
  const table = etat.visibilite.champs, horloges = etat.visibilite.horloges;
  A.selectionnerVues(etat, [ctx]);
  for (let i = 0; i <= 240; i++) A.pas(etat, i / 120, []);
  const actifs = A.stats(etat).activite.groupesActifs;
  assert(actifs > 0 && actifs < etat.groupes.length);
  etat.groupes.forEach((g, i) => {
    if (etat.visibilite.actifs[i]) assert(etat.visibilite.horloges[i] > 0);
    else { assert.equal(etat.visibilite.horloges[i], 0); assert.deepEqual(etat.cour.slice(g.debut * NP, (g.debut + g.n) * NP), initial.slice(g.debut * NP, (g.debut + g.n) * NP)); }
  });
  assert.strictEqual(etat.visibilite.champs, table); assert.strictEqual(etat.visibilite.horloges, horloges);
});

verifier('sommeil long puis réveil : aucun rattrapage, aucun saut de position', () => {
  const etat = creer(), ctx = vers(etat, etat.groupes[0]);
  A.selectionnerVues(etat, [ctx]); A.pas(etat, 0, []); A.pas(etat, .1, []);
  A.selectionnerVues(etat, []); A.pas(etat, .2, []);
  const cour = etat.cour.slice(), graines = etat.graines.slice(), horloges = etat.visibilite.horloges.slice();
  const avant = A.stats(etat).activite.pasGroupes;
  A.pas(etat, 100000, []);
  assert.deepEqual(etat.cour, cour); assert.deepEqual(etat.graines, graines); assert.deepEqual(etat.visibilite.horloges, horloges);
  A.selectionnerVues(etat, [ctx]); A.pas(etat, 100000.1, []);
  assert(A.stats(etat).activite.pasGroupes - avant <= etat.groupes.length);
  for (let i = 0; i < etat.nAnimaux; i++) assert(Math.hypot(etat.cour[i * NP] - cour[i * NP], etat.cour[i * NP + 1] - cour[i * NP + 1]) < 1.5);
  for (let i = 0; i < horloges.length; i++) assert(etat.visibilite.horloges[i] - horloges[i] <= A.PAS + 1e-8);
});

verifier('union J1/J2 et glaces : une vraie vue arrière compte, le booléen seul ne compte plus', () => {
  const etat = creer(), miroir = vers(etat, etat.groupes[0]), principale = { ...vide, vue: 0, arriere: true };
  A.selectionnerVues(etat, [vide, miroir]); A.pas(etat, 0, []); A.pas(etat, .1, []);
  assert(etat.visibilite.actifs[0]);
  const sortie = []; A.dessiner(etat, .1, principale, sortie); assert.equal(sortie.length, 0);
  const poses = A.stats(etat).activite.posesPreparees;
  principale.vuesSecondaires = [miroir]; A.dessiner(etat, .1, principale, sortie);
  assert(sortie.length > 0); assert(A.stats(etat).activite.posesPreparees > poses);
  miroir.qualite = 'off'; sortie.length = 0;
  A.selectionnerVues(etat, [vide, miroir]); A.pas(etat, .2, []); A.dessiner(etat, .2, principale, sortie);
  assert.equal(sortie.length, 0); assert.equal(A.stats(etat).activite.groupesActifs, 0);
});

verifier('frustum vertical et distance : aucune pose détaillée hors champ', () => {
  const etat = creer(), ctx = vers(etat, etat.groupes[0]), sortie = [];
  ctx.camera.pitch = Math.PI / 2;
  A.selectionnerVues(etat, [ctx]); A.pas(etat, 0, []); A.pas(etat, 1, []);
  const avant = A.stats(etat).activite.posesPreparees;
  A.dessiner(etat, 1, vide, sortie);
  assert.equal(sortie.length, 0); assert.equal(A.stats(etat).activite.posesPreparees, avant);
  assert.equal(etat.visibilite.actifs[0], 0);
});

verifier('Légère garde les animaux proches dans les budgets', () => {
  const etat = creer(), ctx = vers(etat, etat.groupes[0]), sortie = [];
  ctx.qualite = 'low'; A.dessiner(etat, 0, ctx, sortie);
  assert(sortie.length > 0 && sortie.length <= A.BUDGETS.low.objets);
  assert(sortie.every(o => /loin/.test(o.shape)));
  ctx.qualite = 'off'; sortie.length = 0; A.dessiner(etat, 0, ctx, sortie); assert.equal(sortie.length, 0);
});

function animalIsole() {
  const etat = creer(), pose = A.poseAnimal(etat, 0, 0);
  // Un vrai cerf, avec ses tableaux et son maillage de production, sans les autres
  // espèces qui brouilleraient le comptage autour de la frontière de portée.
  etat.nAnimaux = etat.nEntites = 1;
  const contexte = (distance, qualite, vue = 0) => ({ vue, qualite, camera: {
    pos: [pose.x + distance, pose.y + 1, pose.z], yaw: -Math.PI / 2, pitch: 0, fov: 70,
  }, aspect: 16 / 9, hauteur: 720 });
  return { etat, contexte };
}

verifier('portées low/high : la silhouette disparaît progressivement dans la vraie passe FX FERRO', () => {
  for (const [qualite, portee] of [['low', 180], ['high', 360]]) {
    const { etat, contexte } = animalIsole(), sortie = [], V = etat.vues[0];
    const opacites = V.opacites, objets = V.objets, taille = objets.length, pack = globalThis.FRender.shared.effectsPacker();
    let precedente = 1, silhouette;
    for (const fraction of [.7, .85, .9, .95, .99]) {
      sortie.length = 0; A.dessiner(etat, 0, contexte(portee * fraction, qualite), sortie);
      assert.equal(sortie.length, 1, qualite + ' : silhouette encore présente dans le fondu');
      const o = sortie[0]; silhouette ||= o;
      assert.strictEqual(o, silhouette, 'même objet réutilisé pendant toute l’approche');
      assert(o.alpha <= precedente && o.alpha > 0);
      if (fraction === .7) { assert.equal(o.alpha, 1); assert.equal(o.fx, false); }
      else {
        assert(o.alpha < precedente, 'opacité strictement décroissante'); assert.equal(o.fx, true);
        const lot = pack(sortie, null, contexte(portee * fraction, qualite).camera.pos);
        assert.equal(lot.length, 16, 'la forme animale entre dans la passe transparente');
        assert.equal(lot.groups[0].name, o.shape, 'le fondu conserve le maillage animal');
        assert.equal(lot.values[3], 16, 'silhouette entière, sans masque de fumée au bord');
        assert.equal(lot.values[15], o.alpha, 'alpha transmis au GPU par le vrai packer');
      }
      precedente = o.alpha;
    }
    assert(precedente < .01, 'silhouette quasi invisible avant la limite');
    const poses = A.stats(etat).activite.posesPreparees;
    for (const distance of [portee, portee + 3, portee + 5]) {
      sortie.length = 0; A.dessiner(etat, 0, contexte(distance, qualite), sortie); assert.equal(sortie.length, 0);
    }
    assert.equal(A.stats(etat).activite.posesPreparees, poses, 'aucune pose après extinction');
    sortie.length = 0; A.dessiner(etat, 0, contexte(portee * .7, qualite), sortie);
    assert.strictEqual(sortie[0], silhouette); assert.equal(silhouette.alpha, 1); assert.equal(silhouette.fx, false);
    assert.equal(silhouette.fxPriority, undefined, 'la réutilisation restaure le rendu opaque');
    assert.strictEqual(V.opacites, opacites); assert.strictEqual(V.objets, objets); assert.equal(objets.length, taille);
  }
});

verifier('fondu : une glace utile garde l’animal et les pools J1/J2 restent indépendants', () => {
  const { etat, contexte } = animalIsole(), principale = contexte(380, 'high'), miroir = contexte(162, 'low');
  principale.vuesSecondaires = [miroir];
  const j1 = [], j2 = [];
  A.dessiner(etat, 0, principale, j1);
  assert.equal(j1.length, 1); assert(j1[0].alpha > .49 && j1[0].alpha < .51, 'portée de la glace low respectée');
  const alphaJ1 = j1[0].alpha;
  A.dessiner(etat, 0, contexte(40, 'high', 1), j2);
  assert(j2.length > 0 && j2.every(o => o.alpha === 1 && !o.fx));
  assert(!j2.includes(j1[0])); assert.equal(j1[0].alpha, alphaJ1, 'J2 ne change pas l’opacité de J1');
  miroir.camera.pos[0] -= 40; j1.length = 0; A.dessiner(etat, 0, principale, j1);
  assert(j1.length > 0 && j1.every(o => o.alpha === 1 && !o.fx), 'le champ proche prime sur le champ lointain');
  miroir.qualite = 'off'; j1.length = 0;
  const poses = A.stats(etat).activite.posesPreparees;
  A.dessiner(etat, 0, principale, j1); assert.equal(j1.length, 0);
  assert.equal(A.stats(etat).activite.posesPreparees, poses, 'une glace coupée ne prépare plus de pose');
});

verifier('même séquence de vues : simulation déterministe à 30/60/120 images par seconde', () => {
  const sorties = [];
  for (const hz of [30, 60, 120]) {
    const etat = creer(), ctx = vers(etat, etat.groupes[0]);
    for (let pas = 0; pas <= 120 * 6; pas++) {
      if (pas % (120 / hz) === 0) A.selectionnerVues(etat, pas >= 240 && pas < 480 ? [] : [ctx]);
      A.pas(etat, pas / 120, []);
    }
    sorties.push([etat.cour, etat.cer, etat.graines, etat.visibilite.horloges]);
  }
  assert.deepEqual(sorties[1], sorties[0]); assert.deepEqual(sorties[2], sorties[0]);
});
console.log(controles + ' contrôles animaux proximité/visibilité');
