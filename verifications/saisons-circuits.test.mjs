import assert from 'node:assert/strict';
import { test } from 'node:test';
import { B, CATALOGUE_SAISONS, creerCircuitSaisons, objetsSaisons, observerSaisons } from '../tools/qualification/saisons-circuits.mjs';

assert.ok(CATALOGUE_SAISONS.some(k => k.id === 'larche') && CATALOGUE_SAISONS.some(k => k.id === 'marseille'));
assert.equal(new Set(CATALOGUE_SAISONS.map(k => k.id)).size, CATALOGUE_SAISONS.length);
for (const qualite of ['low', 'medium', 'high']) for (const definition of CATALOGUE_SAISONS) test(definition.id + ' / ' + qualite + ' : quatre saisons, essences et lots réellement dessinés cohérents', () => {
  const c = creerCircuitSaisons(definition), toutes = [], decors = {};
  for (const saison of B.saisons.IDS) {
    const d = B.decor.construire(c, { qualite, vegetation: false, arbres: 220, saison });
    const m = observerSaisons(d); toutes.push(m); decors[saison] = d;
    assert.equal(m.caducs + m.persistants, m.arbres, 'chaque arbre déclare sa vraie essence');
    assert.equal(m.sourcesFeuilles, saison === 'automne' ? m.caducs : 0, 'les feuilles viennent des seuls caducs présents');
    for (const source of d.sourcesFeuilles) assert(Number.isFinite(source.x + source.y + source.z + source.sol) && source.y > source.sol + 2, 'source de feuilles au-dessus de son vrai sol');
    assert.equal(m.branchesNues, saison === 'hiver' ? m.caducs : 0, 'un rameau permanent par arbre caduc en hiver');
    if (saison === 'hiver') assert.equal(m.couronnesCaduques, 0, 'aucune boule de feuilles blanchie sur les caducs');
    if (m.persistants) assert(m.couronnesPersistantes >= m.persistants, 'les aiguilles restent présentes');
    for (const o of objetsSaisons(d)) if (o.essenceArbre) {
      assert(o.p.concat(o.s, o.color).every(Number.isFinite));
      assert(o.color.every(v => v >= 0 && v <= 1));
      if (o.partieArbre === 'feuillage' && o.essenceArbre !== 'feuillu' && saison !== 'hiver')
        assert(o.color[1] > o.color[0], 'pin/séquoia/conifère non transformé en feuillu orange');
    }
    // L'herbier conserve l'ordre historique. Moyenne/Fine redistribuent les arbres en cases
    // pour le renderer : vérifier également ces vrais lots, dans leurs deux niveaux de détail.
    for (const distant of [false, true]) {
      const dessines = d.lots.flatMap(l => distant ? l.loin || [] : l.objets);
      const couronne = o => o.partieArbre === 'feuillage' || o.partieArbre === 'branches';
      const attendues = new Set(objetsSaisons(d, distant).filter(couronne));
      const presentes = new Set(dessines.filter(couronne));
      assert.equal(presentes.size, attendues.size, 'aucun houppier perdu ou ajouté dans les lots d’image');
      for (const o of attendues) assert(presentes.has(o), 'même couronne dans l’herbier et le rendu');
      assert.equal([...presentes].filter(o => o.partieArbre === 'branches').length,
        saison === 'hiver' ? m.caducs : 0, 'une silhouette nue par caduc à chaque LOD');
      if (saison === 'hiver') assert(![...presentes].some(o => o.partieArbre === 'feuillage' && o.essenceArbre === 'feuillu'));
      assert([...presentes].filter(o => o.partieArbre === 'feuillage' && o.essenceArbre !== 'feuillu').length >= m.persistants,
        'les persistants gardent leurs aiguilles dans le vrai rendu lointain');
      // Le fût allégé de la case n'est ni un second arbre, ni un houppier persistant.
      for (const o of dessines) if (o.shape === B.botanique.TRONC_LOINTAIN) {
        assert(!presentes.has(o)); assert.equal(o.mat, B.botanique.matiere('ecorce'));
      }
    }
  }
  const ete = toutes.find(m => m.saison === 'ete'), hiver = toutes.find(m => m.saison === 'hiver');
  for (const m of toutes) for (const cle of ['racinesSHA256', 'obstaclesSHA256', 'troncsSHA256', 'geometrieSolSHA256'])
    assert.equal(m[cle], ete[cle], cle + ' ne dépend pas de la saison');
  for (const saison of B.saisons.IDS) assert.deepEqual(decors[saison].nappes.filter(n => n.surfaceType === 'eau').map(n => n.sommets),
    decors.ete.nappes.filter(n => n.surfaceType === 'eau').map(n => n.sommets), 'eau non recolorée en neige');
  assert.equal(new Set(toutes.map(m => m.couleursSolSHA256)).size, 4, 'le terrain répond réellement aux quatre saisons');
  assert(hiver.lotsProches.instances <= ete.lotsProches.instances, 'aucun objet supplémentaire par branche');
  assert(hiver.lotsProches.triangles <= ete.lotsProches.triangles, 'aucun surcoût géométrique hivernal du décor proche');
  assert(hiver.lotsLointains.triangles <= ete.lotsLointains.triangles, 'aucun surcoût géométrique hivernal du décor lointain');
  if (definition.theme === 'montagne') {
    assert(ete.caducs > 0 && ete.persistants > 0, 'la forêt basse est mixte');
    assert.equal(ete.caducsAuDessus120, 0, 'la forêt haute garde ses conifères');
  }
  if (definition.id === 'route-des-cimes') {
    assert(ete.rochesHautes > 500, 'région rocheuse alpine effectivement échantillonnée');
    assert.equal(ete.rochesHautesBlanches, 0, 'pas de neige estivale inventée sous la limite permanente');
    assert.equal(hiver.rochesHautesBlanches, hiver.rochesHautes, 'les pentes rocheuses éligibles reçoivent la neige hivernale');
    for (let i = 0; i < decors.ete.nappes.length; i++) {
      const a = decors.ete.nappes[i], b = decors.hiver.nappes[i];
      if (a.surfaceType !== 'terrain') continue;
      for (let k = 0; k < a.sommets.length; k += 13) if (a.sommets[k + 4] <= .45)
        for (let couleur = 10; couleur < 13; couleur++) assert.equal(b.sommets[k + couleur], a.sommets[k + couleur], 'paroi abrupte non enneigée uniformément');
    }
  }
  if (definition.theme === 'cote') {
    assert.equal(hiver.caducs, 0); assert.equal(decors.hiver.saison.neige, false);
    for (const o of objetsSaisons(decors.hiver)) if (o.partieArbre === 'feuillage') assert(o.color[0] < .7, 'pins du Sud sans neige');
  }
  if (definition.theme === 'islande' || definition.theme === 'desert') assert.equal(ete.arbres, 0, 'pas de forêt inventée dans le biome minéral');
  if (definition.theme === 'pacifique') assert.equal(ete.caducs, 0, 'séquoias persistants');
});

test('les rameaux nus gardent leur repère et toutes leurs attaches ; budgets proches/lointains bornés', () => {
  const A = B.botanique;
  for (const q of A.QUALITES) {
    const reference = A.forme('feuillu', false, q), nus = A.formeNue(false, q), loin = A.formeNue(true, q);
    assert.equal(A.formeNue(false, q), nus, 'forme préconstruite et partagée');
    assert(nus.length <= reference.length && loin.length <= A.forme('feuillu', true, q).length);
    for (const t of nus.concat(loin)) for (const p of t.slice(0, 3)) assert(p.every(x => Number.isFinite(x) && Math.abs(x) <= .50000001));
    const pied = forme => Math.min(...forme.flatMap(t => t.slice(0, 3).map(p => p[1])));
    assert.equal(pied(nus), pied(reference), 'pas de recentrage du squelette lorsque les feuilles tombent');
    assert.equal(pied(loin), pied(reference), 'pied identique à la bascule');
    if (q === 'low') assert.equal(nus.length, 72, 'le budget de la couronne lointaine historique');
    else assert.deepEqual(nus, reference.slice(0, nus.length), 'chaque triangle du bois détaillé conserve ses sommets et normales d’été');
  }
});

test('Fine : un seul houppier ou rameau par caduc, même repère entre été/hiver et aucun feuillage nu au loin', () => {
  const c = creerCircuitSaisons(CATALOGUE_SAISONS.find(k => k.id === 'route-des-cimes'));
  const ete = B.decor.construire(c, { qualite: 'high', vegetation: false, arbres: 220, saison: 'ete' });
  const hiver = B.decor.construire(c, { qualite: 'high', vegetation: false, arbres: 220, saison: 'hiver' });
  for (const distant of [false, true]) {
    const a = objetsSaisons(ete, distant).filter(o => o.essenceArbre === 'feuillu' && o.partieArbre === 'feuillage');
    const b = objetsSaisons(hiver, distant).filter(o => o.partieArbre === 'branches');
    assert(a.length > 0); assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
      assert.deepEqual(b[i].p, a[i].p); assert.deepEqual(b[i].s, a[i].s); assert.deepEqual(b[i].r, a[i].r);
      assert.equal(b[i].mat, B.botanique.matiere('ecorce')); assert(b[i].shape.includes('-nu-'));
    }
  }
});
