#!/usr/bin/env node
// Inventaire des vrais lots/nappes, sans navigateur ni modification des sources du jeu.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), racine = fileURLToPath(new URL('../../', import.meta.url));
export const MODULES_SAISONS = ['moteur/renderer', 'circuit', 'couverts', 'route-des-cimes', 'carene', 'botanique',
  'ecologie', 'saisons', 'bords', 'baikal', 'batiments', 'route-des-cimes-decor', 'chaussee', 'virages', 'decor'];
for (const nom of MODULES_SAISONS) require(path.join(racine, 'src', nom + '.js'));
export const B = globalThis.BITUME;
export const sha = v => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const jeu = fs.readFileSync(path.join(racine, 'src/jeu.js'), 'utf8');
const catalogue = jeu.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/);
if (!catalogue) throw new Error('Catalogue réel introuvable');
export const CATALOGUE_SAISONS = JSON.parse(JSON.stringify(vm.runInNewContext('(' + catalogue[1] + ')')));
export function creerCircuitSaisons(definition) {
  const c = definition.partition === 'route-des-cimes' ? B.routeDesCimes.creer() : B.circuit.creer(definition.graine, definition);
  B.bords.limites(c, B.bords.planifier(c)); return c;
}
export function objetsSaisons(d, loin = false) {
  return (d.lotsHerbier || d.lots).flatMap(l => loin ? l.loin || [] : l.objets);
}
export function observerSaisons(d) {
  const objets = objetsSaisons(d), troncs = objets.filter(o => o.collision === 'tronc');
  const arbre = o => o.essenceArbre || o.essenceBaikal || null;
  const caducs = troncs.filter(o => arbre(o) === 'feuillu'), persistants = troncs.filter(o => arbre(o) === 'pin' || arbre(o) === 'conifere');
  const geometrie = createHash('sha256'), couleurs = createHash('sha256');
  let rocheHaute = 0, rocheHauteBlanche = 0, sommets = 0, somme = [0, 0, 0];
  for (const n of d.nappes) {
    const p = new Float32Array(n.sommets.length / 13 * 6), col = new Float32Array(n.sommets.length / 13 * 3);
    for (let i = 0, a = 0, b = 0; i < n.sommets.length; i += 13) {
      for (let k = 0; k < 6; k++) p[a++] = n.sommets[i + k];
      for (let k = 0; k < 3; k++) { const v = n.sommets[i + 10 + k]; col[b++] = v; somme[k] += v; }
      sommets++;
      if (n.surfaceType === 'terrain' && n.sommets[i + 1] > 140 && n.sommets[i + 1] < 230 && n.sommets[i + 4] > .65 && n.sommets[i + 9] === 9) {
        rocheHaute++; if (col[b - 3] > .80 && col[b - 2] > .80 && col[b - 1] > .80) rocheHauteBlanche++;
      }
    }
    geometrie.update(Buffer.from(p.buffer)); geometrie.update(Buffer.from(n.indices.buffer, n.indices.byteOffset, n.indices.byteLength));
    couleurs.update(Buffer.from(col.buffer));
  }
  const rendu = globalThis.FRender.shared.geometry(false), cout = distant => {
    let instances = 0, triangles = 0;
    for (const l of d.lots) for (const o of (distant ? l.loin || [] : l.objets)) {
      const forme = rendu.ranges[o.shape]; if (!forme) throw new Error('Forme absente : ' + o.shape);
      instances++; triangles += forme.count / 3;
    }
    return { instances, triangles };
  };
  const feuillage = objets.filter(o => o.partieArbre === 'feuillage');
  return {
    saison: d.saison.id, arbres: troncs.length, caducs: caducs.length, persistants: persistants.length,
    caducsAuDessus120: caducs.filter(o => o.p[1] - o.s[1] / 2 + .2 >= 120).length,
    branchesNues: objets.filter(o => o.partieArbre === 'branches').length,
    couronnesCaduques: feuillage.filter(o => arbre(o) === 'feuillu').length,
    couronnesPersistantes: feuillage.filter(o => arbre(o) !== 'feuillu').length,
    sourcesFeuilles: d.sourcesFeuilles.length,
    racinesSHA256: sha(d.arbres), obstaclesSHA256: sha(d.obstacles),
    troncsSHA256: sha(troncs.map(o => ({ shape: o.shape, p: o.p, s: o.s, r: o.r }))),
    geometrieSolSHA256: geometrie.digest('hex'), couleursSolSHA256: couleurs.digest('hex'),
    feuillageSHA256: sha(feuillage.map(o => ({ shape: o.shape, p: o.p, s: o.s, color: o.color }))),
    paletteSolMoyenne: somme.map(v => v / sommets), rochesHautes: rocheHaute, rochesHautesBlanches: rocheHauteBlanche,
    lotsProches: cout(false), lotsLointains: cout(true),
  };
}
export function provenanceSaisons() {
  return Object.fromEntries(MODULES_SAISONS.map(n => [n + '.js', sha(fs.readFileSync(path.join(racine, 'src', n + '.js'), 'utf8'))]));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sortie = process.argv[2]; if (!sortie) throw new Error('Usage : node tools/qualification/saisons-circuits.mjs rapport.json');
  const rapport = { format: 'bitume-saisons-neuf-circuits-v1', sources: provenanceSaisons(),
    conditions: { qualite: 'low', vegetation: false, arbres: 220, saisons: Array.from(B.saisons.IDS) },
    limites: ['Inventaire de tous les lots : pas un nombre de triangles effectivement visibles dans une caméra ni une mesure FPS.',
      'Budget de 220 candidats arbres pour rendre les 36 constructions ciblées comparables ; les racines et solides sont conservés.'], circuits: [] };
  for (const def of CATALOGUE_SAISONS) {
    const c = creerCircuitSaisons(def), scenes = [];
    for (const saison of B.saisons.IDS) scenes.push(observerSaisons(B.decor.construire(c, { ...rapport.conditions, saison })));
    rapport.circuits.push({ id: def.id, theme: def.theme, scenes });
    fs.mkdirSync(path.dirname(path.resolve(sortie)), { recursive: true }); fs.writeFileSync(sortie, JSON.stringify(rapport, null, 2) + '\n');
    console.log(def.id + ' : quatre saisons inventoriées');
  }
}
