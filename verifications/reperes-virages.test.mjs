// Repères routiers : géométrie lisible, mêmes symboles en Légère/au loin, aucune incidence physique.
// Oracle indépendant : sources de 0.2.53 au commit 510e6d43ae83f21334237310b2972b13ba68f228,
// capturées par git show avant modification de decor.js. La fixture conserve cette seule source, comprimée.
// La comparaison stricte se fait sur la même machine (Mac/ARM compris), sans historique Git nécessaire en CI.
// Le contrat 0.2.53 exclut l'architecture et le paysage 13B ajoutés ensuite. Leur version actuelle
// est contrôlée séparément avec/sans repères, sans remplacer aucune référence historique.
// Les empreintes supplémentaires ci-dessous proviennent de Linux x64, Node 24.22.3 ; elles ne sont pas régénérées.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'chaussee', 'carene', 'botanique', 'ecologie', 'saisons', 'vegetation', 'bords',
  'virages', 'baikal', 'batiments', 'decor']) require('../src/' + f + '.js');
const B = globalThis.BITUME;
const sourceReference = gunzipSync(readFileSync(new URL('./fixtures/decor-0253.js.gz', import.meta.url)));
const sourceSha256 = 'f53449f4326d03a2e6385e8067ad2abc54cbe33d9bc39da86a098129b7651e41';
assert.equal(createHash('sha256').update(sourceReference).digest('hex'), sourceSha256, 'fixture 0.2.53 altérée');
// En 0.2.53, Baïkal n'avait pas de biome enregistré dans ecologie.js : il prenait la graine forêt
// et l'ouverture générique des biomes inconnus. Le nom réservé ci-dessous retrouve ce comportement
// sans retirer le biome 13B de production ; les huit empreintes anciennes restent l'oracle indépendant.
const ecologieHistorique = { creer(graine, biome) {
  const champ = B.ecologie.creer(graine, biome === 'baikal' ? 'baikal-avant-13b' : biome);
  return Object.freeze({ ...champ, biome });
} };
const contexteHistorique = () => ({ BITUME: { ...B, ecologie: ecologieHistorique }, console, performance });
const decorReference = vm.runInNewContext(sourceReference.toString('utf8') + '\nBITUME.decor;', contexteHistorique(), { filename: 'decor-0253.js' });
const sourceActuelle = readFileSync(new URL('../src/decor.js', import.meta.url), 'utf8');
const decorContratHistorique = vm.runInNewContext(sourceActuelle + '\nBITUME.decor;',
  contexteHistorique(), { filename: 'decor-contrat-0253.js' });
// Configuration de cette copie isolée seulement : le thème de production garde son lac et ses hameaux.
decorContratHistorique.THEMES.baikal = structuredClone(decorReference.THEMES.baikal);
const linuxX64 = process.platform === 'linux' && process.arch === 'x64';
const CATALOGUE = vm.runInNewContext(readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8').match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
const HISTORIQUE = {
  'val-brule': [1763, '2c36862f9bab2f820d521e1f82a2fe23e9703e051428a7a83d13ec1298e33bb2'],
  'port-sable': [1019, '60a08656a16b460a208cf58b95782412ec645c5acbc949f86d96a23a0bd7b194'],
  'haut-col': [1193, '6767747e577bfd9586d4fafd019f0d15da7ca38c996c211d27a22ddc9c8dc583'],
  'lande-noire': [1005, '36ec6e98a486858cc7faf9a37453a462cb28496830b569fb61646330f68ac9e2'],
  'roche-fauve': [998, 'e9a19c49e360da330da4731dbe3852002fa380ee19ccd1e828b2c1e453e4c112'],
  'brume-de-jade': [830, '74e9a3d8798a94f78e3ba03629a3a5f5e388d862b39dd7d8d88587afe78bb9a0'],
  'cap-sequoia': [981, '2c607a500d8ce71340add87951504650dc6a6e6ab502169aa697b55549041544'],
  'baikal': [1134, '956d8a320316b5e8159712fd136056945c6de70d3263558792a11da83f0e8bff']
};
const OPTIONS = { qualite: 'high', saison: 'ete', matieres: true, vegetation: true, vegetationQualite: 'high' };
const OPTIONS_HISTORIQUES = { ...OPTIONS, batiments: false };
const empreinte = valeur => createHash('sha256').update(JSON.stringify(valeur)).digest('hex');
const tableaux = c => Object.fromEntries(Object.entries(c).filter(([, v]) => ArrayBuffer.isView(v))
  .map(([k, v]) => [k, createHash('sha256').update(Buffer.from(v.buffer, v.byteOffset, v.byteLength)).digest('hex')]));
const objets = d => d.lots.flatMap(l => l.objets).filter(o => o.repereVirage);
const panneaux = d => objets(d).filter(o => o.symboleVirage === 'panneau');
const signature = d => objets(d).map(o => JSON.stringify(o)).sort();
const distance = (c, a, b) => ((b - a) % c.longueur + c.longueur) % c.longueur;
const proche = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok  ' + nom); };
const rapport = [];

// Axes de Rz·Ry·Rx, calculés indépendamment du constructeur des panneaux.
function axes(o) {
  const [x, y, z] = o.r || [0, 0, 0], cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  return [[cy * cz, cy * sz, -sy], [sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy],
    [cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy]];
}
const produit = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
function dehors(c, d, p) {
  // Tous les segments sont examinés, pas seulement le point d'axe choisi lors de la pose.
  // Une route voisine et sa limite latérale doivent aussi rester entièrement libres.
  for (let i = 0; i < c.n; i++) {
    const j = (i + 1) % c.n, dx = c.x[j] - c.x[i], dz = c.z[j] - c.z[i], l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((p[0] - c.x[i]) * dx + (p[2] - c.z[i]) * dz) / l2));
    const ex = p[0] - c.x[i] - t * dx, ez = p[2] - c.z[i] - t * dz;
    const droite = -Math.sin(c.cap[i]) * ex + Math.cos(c.cap[i]) * ez;
    const limites = droite < 0 ? d.limites.G : d.limites.D, limite = limites[i] + t * (limites[j] - limites[i]);
    assert.ok(Math.hypot(ex, ez) > limite + .35, 'panneau dans une limite latérale ou sur un bras voisin');
  }
}

verifier('les huit références indépendantes couvrent le catalogue complet', () => {
  assert.deepEqual(Array.from(CATALOGUE, k => k.id).sort(), Object.keys(HISTORIQUE).sort());
});

for (const k of CATALOGUE) {
  const c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom });
  B.bords.limites(c, B.bords.planifier(c));
  const avant = tableaux(c), d = B.decor.construire(c, OPTIONS);
  const sansReperes = B.decor.construire(c, { ...OPTIONS, reperesVirages: false });
  const compatible = decorContratHistorique.construire(c, OPTIONS_HISTORIQUES);
  const historique = decorReference.construire(c, OPTIONS);
  const obstaclesReference = structuredClone(historique.obstacles), plan = B.virages.planifier(c), signs = panneaux(d);
  verifier(k.nom + ' : configuration historique, solides strictement identiques à 0.2.53, même ordre', () => {
    assert.deepEqual(structuredClone(compatible.obstacles), obstaclesReference, 'solides différents de la source 0.2.53 sur cette machine');
    if (linuxX64) {
      assert.equal(compatible.obstacles.length, HISTORIQUE[k.id][0]);
      assert.equal(empreinte(compatible.obstacles), HISTORIQUE[k.id][1]);
    }
    assert.deepEqual(tableaux(c), avant, 'tracé, vibreurs, dévers, vitesse et limites modifiés');
    for (const o of objets(compatible)) assert.ok(!Object.hasOwn(o, 'collision'), 'un repère historique crée un solide');
  });
  verifier(k.nom + ' : décor actuel, mêmes solides avec/sans repères, même ordre', () => {
    assert.ok(d.architecture && sansReperes.architecture, 'architecture active dans les deux décors');
    if (k.id === 'baikal') assert.ok(d.baikal && sansReperes.baikal, 'paysage 13B actif dans les deux décors');
    assert.deepEqual(d.obstacles, sansReperes.obstacles, 'un repère modifie les solides actuels');
    assert.deepEqual(tableaux(c), avant, 'tracé actuel modifié');
    for (const o of objets(d)) assert.ok(!Object.hasOwn(o, 'collision'), 'un repère crée un solide');
  });
  verifier(k.nom + ' : distances et chevrons lisibles derrière les limites, hors stands/tunnels', () => {
    assert.ok(signs.some(o => o.repereVirage.type === 'freinage'), 'aucune distance de freinage');
    assert.ok(signs.some(o => o.repereVirage.type === 'chevrons'), 'aucun chevron');
    const difficiles = plan.filter(v => v.difficulte >= 2);
    for (const o of signs) {
      const r = o.repereVirage, v = difficiles.find(v => v.id === r.virage);
      assert.ok(v, 'panneau sur un virage non prioritaire');
      const s = B.circuit.ecart(c, 0, r.s);
      assert.ok(s < d.enceinte.debut - 10 || s > d.enceinte.fin + 10, 'panneau dans les stands');
      assert.ok(!B.circuit.dansTunnel(c, r.s, 10), 'panneau dans un tunnel');
      const a = axes(o), f = B.decor.cadre(c, Math.round(r.s / c.pas));
      proche(produit(a[0], f.t), 1); proche(produit(a[2], f.r), 1);
      // Les huit coins en plan : la profondeur de la planche compte aussi.
      for (const x of [-1, 1]) for (const z of [-1, 1]) dehors(c, d, o.p.map((v, i) => v + x * a[0][i] * o.s[0] / 2 + z * a[2][i] * o.s[2] / 2));
      const contenu = objets(d).filter(q => q.repereVirage === r);
      assert.ok(o.s[1] >= 1.8 && o.s[2] >= 3, 'panneau trop petit');
      if (r.type === 'freinage') {
        assert.ok([50, 100, 150, 200].includes(r.metres));
        assert.ok(Math.abs(distance(c, r.s, v.debut) - r.metres) <= c.pas / 2 + 1e-8, 'distance annoncée incorrecte');
        const chiffres = contenu.filter(q => q.symboleVirage === 'chiffre');
        assert.ok(chiffres.length >= 10, 'distance réduite à une planche vide');
        const hauteur = Math.max(...chiffres.map(q => q.p[1] + q.s[1] / 2)) - Math.min(...chiffres.map(q => q.p[1] - q.s[1] / 2));
        assert.ok(hauteur > 1.2, 'chiffres trop petits pour l’approche');
      } else {
        const fleches = contenu.filter(q => q.symboleVirage === 'chevron');
        assert.equal(fleches.length, 4, 'deux chevrons complets');
        for (const q of fleches) {
          const axe = axes(q)[0], bout = q.p.map((x, i) => x + axe[i] * q.s[0] / 2), queue = q.p.map((x, i) => x - axe[i] * q.s[0] / 2);
          const avanceDroite = produit(bout.map((x, i) => x - queue[i]), f.r);
          assert.ok(avanceDroite * v.sens > .8, 'le chevron montre le mauvais côté');
          proche(bout[1], o.p[1]);
          assert.ok(Math.abs(queue[1] - o.p[1]) > .45, 'chevron aplati');
        }
      }
    }
  });
  verifier(k.nom + ' : lisses extérieures peintes sans rétablir une glissière retirée', () => {
    const lisses = objets(d).filter(o => o.repereVirage.type === 'glissiere');
    assert.ok(lisses.length > 0);
    for (const o of lisses) {
      const r = o.repereVirage, enCours = plan.find(v => v.difficulte >= 2 && distance(c, v.debut, r.s) <= v.longueur);
      assert.ok(!B.bords.sansGlissiere(c, Math.round(r.s / c.pas), r.cote));
      if (enCours) assert.equal(r.cote, -enCours.sens, 'lisse peinte à l’intérieur du virage');
      else assert.ok(plan.some(v => v.difficulte >= 2 && r.cote === -v.sens && (distance(c, r.s, v.debut) <= 120 || distance(c, v.fin, r.s) <= 24)));
    }
    assert.ok(lisses.some(o => o.color[0] > .95) && lisses.some(o => o.color[1] < .03), 'alternance rouge/blanc absente');
  });
  verifier(k.nom + ' : les versions lointaines conservent les chiffres et les flèches', () => {
    for (const lot of d.lots) for (const o of lot.objets) if (o.repereVirage) {
      assert.ok(lot.loin.includes(o), 'symbole perdu à la bascule de distance');
      assert.equal(lot.portee, Infinity);
    }
  });
  verifier(k.nom + ' : les vibreurs ne changent que de couleur, les décors aléatoires restent identiques', () => {
    for (const [avec, sans] of [[compatible, historique], [d, sansReperes]]) {
      assert.deepEqual(structuredClone(avec.arbres), structuredClone(sans.arbres), 'consommation aléatoire déplacée');
      assert.deepEqual(structuredClone(avec.obstacles), structuredClone(sans.obstacles));
      assert.equal(avec.nappes.length, sans.nappes.length);
      let couleurs = 0;
      for (let j = 0; j < avec.nappes.length; j++) {
        const a = avec.nappes[j], b = sans.nappes[j];
        assert.deepEqual(new Uint32Array(a.indices), new Uint32Array(b.indices));
        assert.equal(a.sommets.length, b.sommets.length);
        for (let i = 0; i < a.sommets.length; i += 13) {
          for (let q = 0; q < 10; q++) assert.equal(a.sommets[i + q], b.sommets[i + q], 'géométrie ou matière de nappe modifiée');
          if ([10, 11, 12].some(q => a.sommets[i + q] !== b.sommets[i + q])) {
            assert.equal(a.surfaceType, 'accotement'); assert.equal(a.sommets[i + 9], 14);
            assert.ok(Math.abs(b.sommets[i + 10] - .74) < 1e-6 || Math.abs(b.sommets[i + 10] - .90) < 1e-6, 'couleur hors vibreur');
            couleurs++;
          }
        }
      }
      assert.ok(couleurs > 0, 'aucun vibreur renforcé');
      // Les petits panneaux historiques de ces mêmes virages ont cédé leur place aux grandes distances.
      const anciens = x => x.lots.flatMap(l => l.objets).filter(o => o.shape === 'box' && o.s[0] === .08 && o.s[1] === 1.5 && o.s[2] === 1.2).length;
      assert.ok(anciens(avec) < anciens(sans), 'double signalisation de freinage');
    }
  });
  const leger = B.decor.construire(c, { ...OPTIONS, qualite: 'low', vegetationQualite: 'low' });
  const legerHistorique = decorContratHistorique.construire(c, { ...OPTIONS_HISTORIQUES, qualite: 'low', vegetationQualite: 'low' });
  verifier(k.nom + ' : Légère conserve les positions, couleurs et symboles, ainsi que les solides', () => {
    assert.deepEqual(signature(leger), signature(d));
    assert.deepEqual(leger.obstacles, d.obstacles);
    assert.deepEqual(Array.from(signature(legerHistorique)), Array.from(signature(compatible)));
    assert.deepEqual(structuredClone(legerHistorique.obstacles), obstaclesReference);
    if (linuxX64) assert.equal(empreinte(legerHistorique.obstacles), HISTORIQUE[k.id][1]);
    assert.deepEqual(tableaux(c), avant);
  });
  if (k.id === 'baikal') verifier('Baïkal enneigé : mêmes repères complets et aucune incidence physique', () => {
    const hiver = B.decor.construire(c, { ...OPTIONS, qualite: 'low', vegetationQualite: 'low', saison: 'hiver' });
    const hiverHistorique = decorContratHistorique.construire(c, { ...OPTIONS_HISTORIQUES, qualite: 'low', vegetationQualite: 'low', saison: 'hiver' });
    assert.deepEqual(signature(hiver), signature(d));
    assert.deepEqual(hiver.obstacles, d.obstacles);
    assert.deepEqual(Array.from(signature(hiverHistorique)), Array.from(signature(compatible)));
    assert.deepEqual(structuredClone(hiverHistorique.obstacles), obstaclesReference);
    if (linuxX64) assert.equal(empreinte(hiverHistorique.obstacles), HISTORIQUE[k.id][1]);
  });
  rapport.push({ circuit: k.id, virages: plan.filter(v => v.difficulte >= 2).length, panneaux: signs.length, solides: d.obstacles.length });
}
console.log(JSON.stringify({ controles: n, oracle: sourceSha256, environnement: process.platform + '/' + process.arch, rapport }));
