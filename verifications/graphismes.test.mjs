// Les trois paliers du menu Image doivent réellement différer, tenir dans les bornes du moteur FERRO, et ne
// jamais décider à la place du gouverneur de src/qualite.js ni introduire une coupure à distance.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

createRequire(import.meta.url)('../src/graphismes.js');
const G = globalThis.BITUME.graphismes;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

const RANG = { low: 0, medium: 1, high: 2 };
const QUALITES = ['low', 'medium', 'high', 'auto'];
const NIVEAUX = [0, 1, 2, 3, 4];
// Même décomposition que budgets() du module, réécrite ici pour ne pas tester une fonction par elle-même.
function cout(m) {
  const ratio = typeof m.rendu.resolution === 'number' ? m.rendu.resolution : 1.5;
  const texels = m.effets.ombres ? Math.pow(512 * m.rendu.shadowMapScale, 2) / 1e6 : 0;
  return ratio * ratio * Math.max(1, m.rendu.msaa) + texels + (m.effets.halo ? 1 : 0) + (m.effets.reflets ? 2 : 0)
    + m.secondaires.retroviseurs.glaces * m.secondaires.retroviseurs.hz / 30 + m.secondaires.partage.hz / 60
    + (m.decor.matieres ? .5 : 0) + (m.decor.vegetation ? 2 : 0);
}
function figeEnProfondeur(o, chemin) {
  if (o === null || typeof o !== 'object') return;
  assert.ok(Object.isFrozen(o), 'gelé : ' + chemin);
  for (const k of Object.keys(o)) figeEnProfondeur(o[k], chemin + '.' + k);
}
const COUPURES = ['portee', 'porteeCulling', 'distance', 'culling', 'lointain', 'far', 'planLointain'];
function sansCoupure(o, chemin) {
  if (o === null || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    assert.ok(COUPURES.indexOf(k) < 0, 'aucune clé de coupure à distance : ' + chemin + '.' + k);
    sansCoupure(o[k], chemin + '.' + k);
  }
}

verifier('les listes exposées sont figées et exactes', () => {
  assert.deepEqual(G.PALIERS.slice(), ['low', 'medium', 'high']);
  assert.deepEqual(G.QUALITES.slice(), ['low', 'medium', 'high', 'auto']);
  assert.ok(Object.isFrozen(G.PALIERS) && Object.isFrozen(G.QUALITES));
});

verifier('normalisation : valeurs inconnues, anciennes et casse tolérées', () => {
  assert.equal(G.normaliser('medium'), 'medium');
  for (const v of ['low', 'medium', 'high', 'auto', 'LOW', ' Auto ', 'HIGH']) assert.equal(G.normaliser(v), v.trim().toLowerCase());
  // valeurs enregistrées par les versions précédentes du menu (Légère / Auto / Fine)
  assert.equal(G.normaliser('Légère'), 'low'); assert.equal(G.normaliser('legere'), 'low');
  assert.equal(G.normaliser('Fine'), 'high'); assert.equal(G.normaliser('max'), 'high');
  assert.equal(G.normaliser('Moyenne'), 'medium'); assert.equal(G.normaliser('MED'), 'medium');
  for (const v of [undefined, null, 3, {}, [], '', 'ultra-violet', 'faux', true, 'auto2']) assert.equal(G.normaliser(v), 'auto', 'inconnu → auto : ' + v);
});

verifier('estPalier ne reconnaît que les trois paliers effectifs', () => {
  for (const v of G.PALIERS) assert.equal(G.estPalier(v), true);
  for (const v of ['auto', 'medium ', 'Medium', undefined, null, 1, {}]) assert.equal(G.estPalier(v), false, String(v));
});

verifier('profils : figés en profondeur et complets dans les bornes du moteur', () => {
  for (const p of G.PALIERS) {
    const f = G.profil(p);
    figeEnProfondeur(f, p);
    assert.equal(f.palier, p);
    assert.equal(typeof f.libelle, 'string'); assert.ok(f.libelle.length > 1);
    assert.deepEqual(Object.keys(f.rendu).sort(), ['bloomThreshold', 'msaa', 'resolution', 'shadowMapScale', 'vignette']);
    assert.deepEqual(Object.keys(f.effets).sort(), ['halo', 'ombres', 'reflets', 'retroImages']);
    assert.deepEqual(Object.keys(f.decor).sort(), ['matieres', 'vegetation']);
    assert.deepEqual(Object.keys(f.lod), ['bascule']);
    for (const k of ['ombres', 'halo', 'reflets', 'retroImages', 'matieres', 'vegetation']) assert.equal(typeof f[k === 'matieres' || k === 'vegetation' ? 'decor' : 'effets'][k], 'boolean');
    // ce que le moteur accepte réellement (renderer.js:2057-2059 et 2467-2470)
    assert.ok([0, 4].indexOf(f.rendu.msaa) >= 0, 'msaa 0 ou 4');
    assert.ok([1, 2].indexOf(f.rendu.shadowMapScale) >= 0, 'atlas 1 ou 2');
    assert.ok(f.rendu.vignette >= 0 && f.rendu.vignette <= 1, 'vignette 0 à 1');
    assert.equal(f.rendu.bloomThreshold.length, 2);
    assert.ok(f.rendu.bloomThreshold[1] > f.rendu.bloomThreshold[0], 'rampe de bloom croissante');
    for (const v of f.rendu.bloomThreshold) assert.ok(v >= 0 && v <= 1);
    assert.ok(f.rendu.resolution === 'auto' || (typeof f.rendu.resolution === 'number' && f.rendu.resolution >= .5 && f.rendu.resolution <= 2), 'résolution auto ou nombre borné');
    assert.ok(Number.isFinite(f.lod.bascule) && f.lod.bascule > 0, 'bascule finie et positive');
    assert.equal(typeof f.secondaires.retroviseurs.glaces, 'number');
    assert.equal(typeof f.secondaires.retroviseurs.hz, 'number');
    assert.equal(typeof f.secondaires.partage.hz, 'number');
    sansCoupure(f, p);
    assert.throws(() => { f.rendu.msaa = 4; }, 'profil figé');
  }
  assert.throws(() => G.profil('auto'), /palier inconnu/);
  assert.throws(() => G.profil('ultra'), /palier inconnu/);
});

verifier('les trois paliers réellement distincts sur au moins trois interrupteurs', () => {
  const [lo, me, hi] = G.PALIERS.map(p => G.profil(p));
  // un interrupteur compte quand il n'est pas constant et que Low et Fine s'opposent dessus
  const interrupteurs = ['ombres', 'halo', 'reflets', 'retroImages'];
  let differents = 0;
  for (const k of interrupteurs) {
    const v = [lo.effets[k], me.effets[k], hi.effets[k]];
    assert.notEqual(lo.effets[k], hi.effets[k], k + ' : Low et Fine diffèrent');
    if (new Set(v).size > 1) differents++;
  }
  assert.ok(differents >= 3, 'au moins trois interrupteurs à trois niveaux, trouvé ' + differents);
  // chaque paire de paliers doit différer sur au moins trois réglages comparables
  const plats = p => { const o = {}, f = (x, c) => { for (const k of Object.keys(x)) { const v = x[k]; if (v && typeof v === 'object') f(v, c + k + '.'); else o[c + k] = v; } }; f(p, ''); delete o.palier; delete o.libelle; return o; };
  const [a, b, c] = [lo, me, hi].map(plats);
  const ecarts = (x, y) => Object.keys(x).filter(k => x[k] !== y[k]);
  assert.ok(ecarts(a, b).length >= 3, 'Low et Moyenne : ' + ecarts(a, b).join(','));
  assert.ok(ecarts(b, c).length >= 3, 'Moyenne et Fine : ' + ecarts(b, c).join(','));
  assert.ok(ecarts(a, c).length >= 3, 'Low et Fine : ' + ecarts(a, c).join(','));
  assert.notEqual(lo.decor.vegetation, hi.decor.vegetation);
  assert.notEqual(lo.rendu.msaa, hi.rendu.msaa);
  assert.notEqual(lo.rendu.shadowMapScale, hi.rendu.shadowMapScale);
  assert.ok(lo.lod.bascule < me.lod.bascule && me.lod.bascule < hi.lod.bascule, 'bascule Low < Medium < High');
  const budget = G.budgets();
  assert.ok(budget.low.score < budget.medium.score && budget.medium.score < budget.high.score, 'coûts strictement séparés');
  assert.ok(budget.medium.score / budget.low.score > 2 && budget.high.score / budget.medium.score > 1.5, 'écarts réels');
});

verifier('resoudre : Auto décroît avec le gouverneur, de 0 à 4', () => {
  const paliers = NIVEAUX.map(n => G.resoudre('auto', n));
  assert.deepEqual(paliers, ['high', 'high', 'medium', 'medium', 'low']);
  for (let i = 1; i < paliers.length; i++) assert.ok(RANG[paliers[i]] <= RANG[paliers[i - 1]], 'palier non croissant à ' + i);
  const couts = NIVEAUX.map(n => cout(G.melange('auto', n)));
  for (let i = 1; i < couts.length; i++) assert.ok(couts[i] <= couts[i - 1], 'coût non croissant à ' + i + ' : ' + couts.join(' '));
  assert.ok(couts[0] > couts[4] * 4, 'l\'Auto au dernier palier coûte au quart du premier');
  // les interrupteurs coupés par le gouverneur le sont dans l'ordre annoncé par jeu.js
  assert.equal(G.melange('auto', 0).effets.retroImages, true);
  assert.equal(G.melange('auto', 1).effets.retroImages, false, 'palier 1 : images de rétroviseurs coupées');
  assert.equal(G.melange('auto', 1).effets.ombres, true);
  assert.equal(G.melange('auto', 2).effets.ombres, false, 'palier 2 : ombres en moins');
  assert.equal(G.melange('auto', 2).effets.halo, true);
  assert.equal(G.melange('auto', 3).effets.halo, false, 'palier 3 : halo en moins');
  assert.equal(G.melange('auto', 3).effets.reflets, false, 'palier 3 : reflets en moins');
  assert.equal(G.melange('auto', 4).rendu.resolution, .75, 'palier 4 : résolution baissée');
  assert.equal(G.melange('auto', 3).rendu.resolution, 'auto');
});

verifier('resoudre accepte un niveau hors bornes sans décider à la place du gouverneur', () => {
  assert.equal(G.resoudre('auto', -3), 'high');
  assert.equal(G.resoudre('auto', 9), 'low');
  assert.equal(G.resoudre('auto', 2.7), 'medium', 'niveau arrondi à l\'entier inférieur');
  for (const v of [undefined, null, NaN, 'deux']) assert.equal(G.resoudre('auto', v), 'high', 'gouverneur au repos : ' + v);
});

verifier('resoudre d\'une qualité explicite ignore le gouverneur', () => {
  for (const q of ['low', 'medium', 'high']) for (const n of NIVEAUX.concat([-1, 99, undefined])) {
    assert.equal(G.resoudre(q, n), q, q + ' à ' + n);
    assert.deepEqual(G.melange(q, n), G.melange(q, 0), 'mélange de ' + q + ' indépendant du palier ' + n);
  }
  assert.equal(G.resoudre('inconnu', 4), 'low', 'qualité inconnue vaut Auto');
});

verifier('melange n\'ouvre jamais un effet que le moteur n\'a pas ouvert', () => {
  const fermees = { msaa: false, shadowMapScale: 1, reflets: false, ombres: false, halo: false, retroviseurs: false, gpuModeste: true, pixelRatio: 1 };
  for (const q of QUALITES) for (const n of NIVEAUX) {
    const m = G.melange(q, n, fermees);
    assert.equal(m.rendu.msaa, 0, 'msaa fermé');
    assert.equal(m.rendu.shadowMapScale, 1, 'atlas non doublé');
    assert.equal(m.effets.ombres, false); assert.equal(m.effets.halo, false);
    assert.equal(m.effets.reflets, false); assert.equal(m.effets.retroImages, false);
    assert.equal(m.secondaires.retroviseurs.glaces, 0);
    assert.equal(m.secondaires.retroviseurs.hz, 0);
    assert.ok(m.rendu.resolution === 'auto' || m.rendu.resolution <= 1, 'jamais plus de pixels que l\'écran');
    sansCoupure(m, q + n);
  }
  // le moteur ne monte la cible MSAA qu'avec le bloom, et les reflets d'écran aussi (renderer.js:2215-2216)
  for (const q of QUALITES) for (const n of NIVEAUX) {
    const m = G.melange(q, n, { halo: false });
    assert.equal(m.rendu.msaa, 0, 'sans halo, pas de MSAA : ' + q + n);
    assert.equal(m.effets.reflets, false, 'sans halo, pas de reflets : ' + q + n);
  }
  // un GPU modeste refuse les reflets même en Fine (règle tenue par jeu.js:1320)
  assert.equal(G.melange('high', 0, { gpuModeste: true }).effets.reflets, false);
  assert.equal(G.melange('high', 0, { reflets: false }).effets.reflets, false);
  assert.equal(G.melange('high', 0, { msaa: false }).rendu.msaa, 0);
  assert.equal(G.melange('high', 0, { shadowMapScale: 1 }).rendu.shadowMapScale, 1);
  // forme longue : un objet de capacités produit le même garde-fou
  const cap = G.capacites({ msaa: 0, shadowMapScale: 1, reflections: false }, true, 1);
  assert.equal(cap.msaa, false); assert.equal(cap.reflets, false); assert.equal(cap.gpuModeste, true); assert.equal(cap.pixelRatio, 1);
  assert.deepEqual(G.melange('high', 0, { capacites: cap }), G.melange('high', 0, { msaa: false, shadowMapScale: 1, reflets: false, gpuModeste: true, pixelRatio: 1 }));
  // tout ouvert : Fine garde ses quatre échantillons par pixel et son atlas doublé
  const plein = G.melange('high', 0);
  assert.equal(plein.rendu.msaa, 4); assert.equal(plein.rendu.shadowMapScale, 2);
  assert.equal(plein.effets.ombres && plein.effets.halo && plein.effets.reflets && plein.effets.retroImages, true);
  assert.equal(plein.secondaires.retroviseurs.glaces, 2);
  figeEnProfondeur(plein, 'melange');
});

verifier('aucun palier n\'introduit de coupure à distance brutale', () => {
  for (const p of G.PALIERS) {
    const b = G.profil(p).lod.bascule;
    assert.ok(Number.isFinite(b) && b > 0 && b < 2000, 'bascule finie et raisonnable : ' + b);
    sansCoupure(G.profil(p), p);
  }
  for (const q of QUALITES) for (const n of NIVEAUX) {
    const m = G.melange(q, n);
    assert.ok(Number.isFinite(m.lod.bascule) && m.lod.bascule > 0);
    assert.deepEqual(Object.keys(m.lod), ['bascule'], 'le module ne borne aucune portée');
    sansCoupure(m, q + n);
  }
  // Medium garde la bascule historique du jeu (decor.js:674) : rien ne disparaît plus tôt qu'aujourd'hui
  assert.equal(G.profil('medium').lod.bascule, 520);
  assert.ok(G.profil('low').lod.bascule >= 300, 'Low ne resserre pas jusqu\'à faire disparaître le proche');
});

verifier('résolution : jamais un nombre hors des bornes du moteur, jamais plus que l\'écran', () => {
  for (const q of QUALITES) for (const n of NIVEAUX) {
    const r = G.melange(q, n).rendu.resolution;
    assert.ok(r === 'auto' || (typeof r === 'number' && r >= .5 && r <= 2), 'résolution recevable par resize() : ' + r);
  }
  assert.equal(G.melange('high', 0, { pixelRatio: 1 }).rendu.resolution, 1, 'un écran 1× ne rend pas 4 fois les pixels');
  assert.equal(G.melange('high', 0, { pixelRatio: 3 }).rendu.resolution, 2, 'plafond du moteur à 2');
  assert.equal(G.melange('auto', 0).rendu.resolution, 'auto', 'l\'Auto garde le gouverneur de résolution du moteur');
  assert.equal(G.melange('auto', 4).rendu.resolution, .75);
});

verifier('l\'ancre de décor empêche l\'Auto de rebâtir le terrain', () => {
  const sans = G.melange('auto', 4);
  assert.equal(sans.decor.vegetation, false, 'sans ancre, Low ferme la végétation');
  const ancre = G.melange('auto', 4, { decor: 'high' });
  assert.equal(ancre.decor.matieres, true); assert.equal(ancre.decor.vegetation, true, 'le gouverneur ne touche pas au décor');
  assert.equal(ancre.effets.ombres, false, 'les effets, eux, suivent bien le gouverneur');
  assert.equal(ancre.rendu.resolution, .75);
  assert.equal(G.melange('auto', 4, { decor: 'inconnu' }).decor.vegetation, false, 'ancre invalide ignorée');
});

verifier('budgets : un décompte comparable et figé pour les trois paliers', () => {
  const b = G.budgets();
  figeEnProfondeur(b, 'budgets');
  assert.deepEqual(Object.keys(b).sort(), ['high', 'low', 'medium']);
  for (const p of G.PALIERS) {
    assert.equal(b[p].palier, p);
    for (const k of ['score', 'echantillonsParPixelCss', 'texelsOmbres', 'vuesSecondairesHz']) assert.equal(typeof b[p][k], 'number');
    assert.deepEqual(Object.keys(b[p].effets).sort(), ['halo', 'ombres', 'reflets', 'retroImages']);
  }
  assert.ok(b.low.echantillonsParPixelCss < b.medium.echantillonsParPixelCss && b.medium.echantillonsParPixelCss < b.high.echantillonsParPixelCss);
  assert.ok(b.low.texelsOmbres === 0 && b.medium.texelsOmbres < b.high.texelsOmbres);
  assert.ok(b.low.vuesSecondairesHz < b.high.vuesSecondairesHz);
});

verifier('stabiliser : l\'Auto filtre l\'oscillation sans décider à la place du gouverneur', () => {
  const e = G.etatStable();
  assert.equal(G.stabiliser(e, 'auto', 0, 0).palier, 'high');
  // une fluctuation de deux secondes aller-retour ne change rien d'appliqué
  assert.equal(G.stabiliser(e, 'auto', 4, 1).palier, 'high');
  assert.equal(G.stabiliser(e, 'auto', 4, 1.4).attente, true);
  assert.equal(G.stabiliser(e, 'auto', 0, 1.6).palier, 'high', 'la demande s\'efface avant la temporisation');
  assert.equal(G.stabiliser(e, 'auto', 4, 2).attente, true);
  assert.equal(G.stabiliser(e, 'auto', 0, 2.5).palier, 'high');
  // une décision tenue s'applique, et une seule fois
  const d = G.stabiliser(e, 'auto', 4, 3);
  assert.equal(d.palier, 'high');
  const a = G.stabiliser(e, 'auto', 4, 3.8);
  assert.equal(a.palier, 'low'); assert.equal(a.changement, true);
  assert.equal(G.stabiliser(e, 'auto', 4, 4).changement, false, 'pas de changement répété');
  // le décor suit le palier appliqué, mais jamais à moins de cinq secondes du dernier rebâtiment
  assert.equal(a.reconstruit, false, 'verrou de reconstruction à trois secondes');
  assert.equal(e.decor, 'high', 'le terrain reste bâti en Fine');
  const r = G.stabiliser(e, 'auto', 4, 8.1);
  assert.equal(r.reconstruit, true); assert.equal(e.decor, 'low');
  assert.equal(G.stabiliser(e, 'auto', 4, 9).reconstruit, false, 'une seule rebâtie par décision tenue');
});

verifier('stabiliser : un choix explicite du menu s\'applique à l\'image', () => {
  const e = G.etatStable();
  G.stabiliser(e, 'auto', 0, 0);
  const d = G.stabiliser(e, 'low', 0, .1);
  assert.equal(d.palier, 'low'); assert.equal(d.changement, true);
  assert.equal(d.reconstruit, true, 'le choix de l\'utilisateur rebâtit le décor');
  assert.equal(e.decor, 'low');
  // Low n'a ni matières ni végétation : y revenir depuis Moyenne demande une rebâtie
  const m = G.stabiliser(e, 'medium', 0, .2);
  assert.equal(m.palier, 'medium'); assert.equal(m.reconstruit, true); assert.equal(e.decor, 'medium');
  // Medium et Fine n'ont pas le même terrain : les comptes de plantes suivent le palier (276 herbes et aucune fleur
  // en Moyenne, 468 herbes et 237 fleurs en Fine — vérifié dans le décor réellement installé par le banc navigateur).
  // Changer de palier nommé rebâtit donc le décor ; le verrou RECONSTRUCTION en borne seul la cadence.
  const f = G.stabiliser(e, 'high', 0, .3);
  assert.equal(f.palier, 'high'); assert.equal(f.reconstruit, true, 'les comptes de plantes changent : le terrain suit');
  assert.equal(e.decor, 'high');
  // la même demande, dix fois, ne rebâtit qu'une fois : le verrou tient sous un choix nommé aussi
  assert.equal(G.stabiliser(e, 'high', 0, .4).reconstruit, false, 'plus rien à rebâtir tant que le palier ne bouge pas');
  assert.equal(G.stabiliser(e, 'medium', 4, .4).palier, 'medium', 'le gouverneur n\'a pas la main sur une qualité fixe');
});

verifier('le module se charge et décide sans DOM ni moteur', () => {
  const contexte = vm.createContext({ console });
  assert.equal(typeof contexte.document, 'undefined');
  assert.equal(typeof contexte.window, 'undefined');
  vm.runInContext(readFileSync(new URL('../src/graphismes.js', import.meta.url), 'utf8'), contexte);
  const g = contexte.BITUME.graphismes;
  assert.equal(g.resoudre('auto', 2), 'medium');
  assert.equal(g.melange('high', 0).rendu.msaa, 4);
  assert.ok(g.budgets().high.score > g.budgets().low.score);
});

console.log(`graphismes : ${controles} contrôles passés`);
