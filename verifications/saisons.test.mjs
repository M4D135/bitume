import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
for (const n of ['circuit', 'carene', 'ecologie', 'saisons', 'vegetation', 'decor']) require('../src/' + n + '.js');
const B = globalThis.BITUME, S = B.saisons, mesures = [];
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const digest = objet => createHash('sha256').update(JSON.stringify(objet, (k, v) => k === 'color' ? undefined : v)).digest('hex');
function geometrieNappes(d) {
  const h = createHash('sha256');
  for (const n of d.nappes) {
    for (let k = 0; k < n.sommets.length; k += 13) h.update(Buffer.from(n.sommets.buffer, n.sommets.byteOffset + k * 4, 40));
    h.update(Buffer.from(n.indices.buffer, n.indices.byteOffset, n.indices.byteLength));
  }
  return h.digest('hex');
}
function masqueHerbe(n) {
  const masque = new Uint8Array(n.sommets.length / 13);
  for (const k of n.herbeTriangles || []) for (let j = 0; j < 3; j++) masque[n.indices[k + j]] = 1;
  if (n.surfaceType === 'accotement') for (let v = 0; v < masque.length; v++) if (Math.floor(n.sommets[v * 13 + 9]) === 8) masque[v] = 1;
  return masque;
}
function palettes(d) {
  const somme = [0, 0, 0]; let sommetsHerbe = 0, claires = 0, roses = 0, chaudes = 0;
  for (const n of d.nappes) {
    const masque = masqueHerbe(n);
    for (let v = 0; v < masque.length; v++) if (masque[v]) {
      sommetsHerbe++; for (let k = 0; k < 3; k++) somme[k] += n.sommets[v * 13 + 10 + k];
    }
  }
  for (const lot of d.lots) for (const o of lot.objets) if (o.shape === 'foliage') {
    const [r, g, b] = o.color;
    if (r > .65 && g > .60 && b > .55) claires++;
    if (r > .60 && r > g * 1.2 && b > g) roses++;
    if (r > .40 && r > g * 1.25 && g > b * 1.5) chaudes++;
  }
  return { sommetsHerbe, solHerbeMoyen: somme.map(v => v / sommetsHerbe), canopeesClaires: claires, canopeesRoses: roses, canopeesChaudes: chaudes };
}

verifier('profils figés, été par défaut et aucune neige sur Port-Sable', () => {
  for (const valeur of [undefined, null, '', 'inconnu', {}, 4]) assert.equal(S.normaliser(valeur), 'ete');
  for (const id of S.IDS) for (const theme of ['foret', 'cote', 'montagne']) {
    assert.equal(S.normaliser(id), id);
    const p = S.profil(id, theme); assert.equal(p.id, id); assert.ok(Object.isFrozen(p));
    assert.equal(p.neige, id === 'hiver' && theme !== 'cote');
    assert.equal(p.feuilles, id === 'automne' && (theme === 'foret' || theme === 'montagne'));
    assert.ok(p.faune >= 0 && p.faune <= 1);
    if (p.neige) assert.equal(p.faune, 0, 'aucun habitat animal à initialiser sur la neige');
    const sortie = [0, 0, 0], base = [.20, .35, .13];
    assert.strictEqual(S.teinte(p, 'herbe', base, 17, 92, null, sortie), sortie);
    assert.deepEqual(base, [.20, .35, .13]);
    assert.ok(sortie.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
    if (theme === 'cote') assert.ok(sortie.some(v => v < .7), 'aucune teinte de neige ajoutée au Sud');
  }
});

verifier('douze scènes : recoloration seulement, chaussée hivernale lisible, collisions et tracés identiques', () => {
  for (const [graine, theme, longueur] of [[11, 'foret', 4200], [29, 'cote', 3600], [47, 'montagne', 5200]]) {
    const c = B.circuit.creer(graine, { theme, longueur }), trace = digest([c.x, c.y, c.z, c.cap, c.devers]);
    const ete = B.decor.construire(c, { qualite: 'high', vegetation: false, saison: 'ete' });
    const geo = geometrieNappes(ete), lots = digest(ete.lots), physiques = digest(ete.obstacles);
    let printemps = null;
    for (const id of S.IDS) {
      const d = id === 'ete' ? ete : B.decor.construire(c, { qualite: 'high', vegetation: false, saison: id });
      assert.equal(d.saison, S.profil(id, theme)); assert.equal(Object.keys(d).includes('saison'), false);
      assert.equal(Object.keys(d).includes('sourcesFeuilles'), false);
      assert.equal(geometrieNappes(d), geo); assert.equal(digest(d.lots), lots); assert.equal(digest(d.obstacles), physiques);
      assert.deepEqual(d.arbres, ete.arbres);
      for (let i = 0; i < d.nappes.length; i++) {
        const n = d.nappes[i], reference = ete.nappes[i], masque = masqueHerbe(n);
        for (let v = 0; v < masque.length; v++) for (let k = 0; k < 3; k++) {
          const couleur = n.sommets[v * 13 + 10 + k];
          const mat = reference.sommets[v * 13 + 9];
          const asphalte = n.surfaceType === 'accotement' && (Math.floor(mat) === 14 || Math.floor(mat) === 21)
            && reference.sommets[v * 13 + 10] < .3
            && reference.sommets[v * 13 + 10] === reference.sommets[v * 13 + 11];
          const neigeRocher = d.saison.neige && theme === 'montagne' && n.surfaceType === 'terrain' && n.sommets[v * 13 + 4] > .45;
          assert.ok(couleur >= 0 && couleur <= 1);
          if (!masque[v] && !(d.saison.neige && asphalte) && !neigeRocher) assert.equal(couleur, reference.sommets[v * 13 + 10 + k], 'marquages, sable, eau, parois abruptes et asphalte hors hiver inchangés');
          else if (d.saison.neige && asphalte) assert.ok(couleur >= reference.sommets[v * 13 + 10 + k], 'asphalte enneigé plus clair, ou sec sous abri');
          else if (d.saison.neige) assert.ok(couleur > .80, 'les vrais accotements et terrains herbeux sont enneigés');
        }
      }
      const p = palettes(d);
      if (theme === 'foret' && id === 'printemps') {
        assert.ok(p.canopeesClaires > 40 && p.canopeesRoses > 40, 'bouquets blancs et roses présents'); printemps = p;
      }
      if (theme === 'foret' && id === 'automne') {
        assert.ok(p.canopeesChaudes > 500);
        assert.equal(d.sourcesFeuilles.length, d.arbres.length);
        for (const source of d.sourcesFeuilles) {
          assert.ok(Number.isFinite(source.x + source.y + source.z + source.rayon + source.sol));
          assert.ok(source.y > source.sol + 2 && source.rayon > 1);
          assert.ok(Math.abs(source.sol - d.sol(source.x, source.z)) < 1e-8, 'altitude de chute conforme au sol du décor');
        }
      } else assert.equal(d.sourcesFeuilles.length, 0);
      if (d.saison.neige) assert.ok(p.canopeesClaires > 100);
      if (theme === 'cote' && id === 'hiver') assert.equal(p.canopeesClaires, 0);
      mesures.push({ biome: theme, saison: id, ...p, sourcesFeuilles: d.sourcesFeuilles.length, soleil: d.atmosphere.sunColor,
        nappes: d.nappes.length, objets: d.lots.reduce((n, l) => n + l.objets.length, 0), solides: d.obstacles.length });
    }
    if (printemps) assert.ok(palettes(ete).solHerbeMoyen[0] / palettes(ete).solHerbeMoyen[1] > printemps.solHerbeMoyen[0] / printemps.solHerbeMoyen[1]);
    assert.equal(digest([c.x, c.y, c.z, c.cap, c.devers]), trace);
    const soleilEte = mesures.find(m => m.biome === theme && m.saison === 'ete').soleil;
    for (const id of ['printemps', 'automne', 'hiver']) assert.ok(soleilEte[0] > mesures.find(m => m.biome === theme && m.saison === id).soleil[0]);
  }
});

verifier('prairie 3D : mêmes brins, matrices et LOD, cache de sol propre à la saison active', () => {
  const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 }), paletteAvant = JSON.stringify(B.vegetation.BIOMES);
  const ete = B.decor.construire(c, { qualite: 'high', vegetationQualite: 'high', saison: 'ete' });
  const p = ete.herbier.triangles.find(t => t.type === 'accotement').points;
  const x = (p[0][0] + p[1][0] + p[2][0]) / 3, z = (p[0][2] + p[1][2] + p[2][2]) / 3;
  const couleurEte = ete.surfaceHerbe(x, z).color.slice();
  const hiver = B.decor.construire(c, { qualite: 'high', vegetationQualite: 'high', saison: 'hiver' });
  assert.deepEqual(hiver.vegetation, ete.vegetation);
  const plantes = d => d.lots.filter(l => l.vegetation);
  assert.equal(digest(plantes(hiver)), digest(plantes(ete)), 'aucune géométrie, instance ou matrice supplémentaire');
  assert.ok(hiver.surfaceHerbe(x, z).color[0] > couleurEte[0] + .3);
  assert.deepEqual(ete.surfaceHerbe(x, z).color, couleurEte, 'une scène encore vivante conserve sa palette de sol');
  for (const l of plantes(hiver)) for (let i = 0; i < l.objets.length; i++) {
    assert.deepEqual(l.objets[i].color, l.loin[i].color);
  }
  assert.equal(JSON.stringify(B.vegetation.BIOMES), paletteAvant, 'les palettes partagées du générateur ne sont pas modifiées');
});

console.log(JSON.stringify({ controles, mesures }, null, 2));
