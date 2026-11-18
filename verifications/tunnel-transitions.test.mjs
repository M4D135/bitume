// Transitions du tunnel (lot 1B) : les lampes montent et descendent en continu selon la caméra, le plafond de huit
// n'est jamais atteint à la limite de l'éclairage, l'état temporel est propre à chaque caméra, et l'abri de la pluie
// comme l'adaptation de l'œil suivent la caméra, pas seulement la voiture. Les fonctions testées sont celles de
// src/jeu.js, extraites et exécutées avec le vrai circuit et le vrai décor de Haut-Col.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const req = createRequire(import.meta.url);
for (const f of ['carene', 'circuit', 'ferro/vehicle-dynamics', 'conduite', 'decor', 'graphismes']) req('../src/' + f + '.js');
const B = globalThis.BITUME;
const page = req('node:fs').readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');

function extraire(debutMarque, finMarque) {
  const a = page.indexOf(debutMarque), b = page.indexOf(finMarque, a);
  assert.ok(a >= 0 && b > a, 'extraction introuvable : ' + debutMarque);
  return page.slice(a, b);
}

const sourceTunnel = extraire('  const TUNNEL_PAS = 10', '  // ---------------------------------------------------------------- rétroviseurs');
// creationTardive : filet de jeu.js, qui compte ce qui naît dans le chemin d'une image au lieu de la préparation
const tunnelF = new Function('scene', 'B', 'creationTardive', sourceTunnel + '\nreturn { preparerTunnel, sousLaVoute, lampesTunnel, remettreLampes, LAMPE_RAYON, LAMPE_MAX, LAMPE_MIN, LAMPE_PUISSANCE };');
const sourceReflets = extraire('  const REFLET_PRISE =', '\n  // ---------------------------------------------------------------- tunnel : lampes');
const refletsF = new Function('gpuModeste', 'palier', sourceReflets + '\nreturn avecReflets;');

const c = B.circuit.creer(47, { theme: 'montagne', longueur: 5200, nom: 'Haut-Col' });
const decor = B.decor.construire(c);
const LT = decor.tunnelLampes;
const scene = { index: 7 };
const tardives = [];
const T = tunnelF(scene, B, (nom, valeur) => { tardives.push(nom); return valeur; });
const axe = s => { const e = B.circuit.echantillon(c, s); return { pos: [e.x, e.y + 1.2, e.z] }; };

test('le décor de Haut-Col fournit des lampes et le tunnel est droit', () => {
  assert.ok(Array.isArray(LT) && LT.length >= 20, LT && LT.length + ' lampes');
  assert.equal(c.tunnel.fin - c.tunnel.debut, 260);
});

// contribution stabilisée de la caméra (le lissage temporel est laissé converger)
function total(cam, cle, pas = 1 / 60, n = 30) {
  const porteur = {};
  let l = null;
  for (let i = 0; i < n; i++) l = T.lampesTunnel(porteur, cle, LT, cam, pas, scene.index);
  return { total: l ? l.reduce((a, o) => a + o.power, 0) : 0, n: l ? l.length : 0, porteur };
}

// sélection « huit lampes triées par distance, seuil à 70 m » : celle de la base 0.2.19, gardée ici comme référence
function anciennesLampes(cam) {
  const proches = [];
  for (const p of LT) { const d2 = (p[0] - cam.pos[0]) ** 2 + (p[2] - cam.pos[2]) ** 2; if (d2 < 4900) proches.push({ p, d2 }); }
  proches.sort((a, b) => a.d2 - b.d2);
  if (proches.length > 8) proches.length = 8;
  return proches.reduce((a, o) => a + 12, 0);
}

test('la lumière monte et descend sans saut le long de la piste', () => {
  const e = c.tunnel.debut, f = c.tunnel.fin;
  const serie = (pas, a, b) => { const v = []; for (let s = a; s <= b; s += pas) v.push(total(axe(s), 'cam').total); return v; };
  const plusGrand = v => { let m = 0, k = 0; for (let i = 1; i < v.length; i++) { const d = Math.abs(v[i] - v[i - 1]); if (d > m) { m = d; k = i; } } return { m, k }; };
  // une fonction continue voit son plus grand saut décroître quand on rapproche les relevés ; une fonction qui
  // bascule garde le même saut, quel que soit le pas. C est ce critère qui distingue le fondu du clignotement.
  const grossier = serie(.5, e - 60, f + 60);
  const pic = Math.max(...grossier);
  assert.ok(pic > T.LAMPE_PUISSANCE, 'aucune lumière dans le tunnel : ' + pic);
  const g = plusGrand(grossier), centre = e - 60 + g.k * .5;
  const fin = plusGrand(serie(.0625, centre - 1, centre + 1));
  assert.ok(fin.m < g.m / 4, 'le saut ne décroît pas avec le pas (' + g.m.toFixed(2) + ' puis ' + fin.m.toFixed(2) + ' W autour de s=' + centre.toFixed(0) + ') : la lumière bascule encore');
  assert.ok(fin.m < T.LAMPE_PUISSANCE * .1, 'saut résiduel de ' + fin.m.toFixed(2) + ' W à un soixantième de mètre');
  // l ancienne sélection, relevée quatre fois plus serré autour de son propre pire endroit, gardait son saut de
  // douze watts : c est exactement ce qui est corrigé
  const ancien = pas => { const v = []; for (let s = e - 60; s <= f + 60; s += pas) v.push(anciennesLampes(axe(s))); return v; };
  const ga = plusGrand(ancien(.5)), ca = e - 60 + ga.k * .5;
  const fa = plusGrand((() => { const v = []; for (let s = ca - 1; s <= ca + 1; s += .0625) v.push(anciennesLampes(axe(s))); return v; })());
  assert.ok(fa.m > T.LAMPE_PUISSANCE * .8,
    'l ancienne sélection ne basculait pas (saut ' + fa.m.toFixed(2) + ' W) : le test ne prouverait rien');
});

test('hors de portée, plus aucune lampe ; sous la voûte, la piste est éclairée', () => {
  assert.equal(total(axe(c.tunnel.debut - T.LAMPE_RAYON - 12), 'loin').total, 0);
  assert.equal(total(axe(c.tunnel.fin + T.LAMPE_RAYON + 12), 'loin2').total, 0);
  assert.ok(total(axe((c.tunnel.debut + c.tunnel.fin) / 2), 'dedans').total > 0);
});

test('le plafond de huit n est jamais ce qui éteint une lampe', () => {
  const e = c.tunnel.debut, f = c.tunnel.fin;
  for (let s = e - 40; s <= f + 40; s += 3) {
    const r = total(axe(s), 'plafond');
    assert.ok(r.n <= T.LAMPE_MAX, r.n + ' lampes retenues');
    if (r.n === T.LAMPE_MAX) assert.fail('la sélection est bornée par huit à s=' + s.toFixed(0) + ' : une lampe basculerait');
  }
});

test('chaque caméra garde son propre état temporel', () => {
  const dedans = axe((c.tunnel.debut + c.tunnel.fin) / 2), dehors = axe(c.tunnel.fin + T.LAMPE_RAYON + 30);
  const J1 = {}, J2 = {}, glace = {};
  for (let i = 0; i < 40; i++) { T.lampesTunnel(J1, 'vue', LT, dedans, 1 / 60, scene.index); T.lampesTunnel(J2, 'vue', LT, dehors, 1 / 60, scene.index); }
  const p1 = J1.vue.p.reduce((a, v) => a + v, 0), p2 = J2.vue.p.reduce((a, v) => a + v, 0);
  assert.ok(p1 > 0 && p2 === 0, 'les deux vues partagent leur état : ' + p1 + ' / ' + p2);
  for (let i = 0; i < 40; i++) T.lampesTunnel(glace, 'lampes0', LT, dedans, 1 / 60, scene.index);
  assert.ok(glace.lampes0 && glace.lampes0.p.reduce((a, v) => a + v, 0) > 0, 'la glace n a pas sa propre lumière');
  assert.notEqual(J1.vue, glace.lampes0);
});

test('l état est repris quand la scène change', () => {
  const porteur = {};
  for (let i = 0; i < 40; i++) T.lampesTunnel(porteur, 'vue', LT, axe((c.tunnel.debut + c.tunnel.fin) / 2), 1 / 60, 7);
  const avant = porteur.vue.p.reduce((a, v) => a + v, 0);
  T.lampesTunnel(porteur, 'vue', LT, axe((c.tunnel.debut + c.tunnel.fin) / 2), 1 / 60, 8);
  assert.equal(porteur.vue.rev, 8);
  assert.ok(porteur.vue.p.reduce((a, v) => a + v, 0) < avant, 'la lampe a survécu au changement de scène');
});

test('un état né dans l image est compté ; pas nul et remise à zéro ne réallouent rien', () => {
  const porteur = {}, dedans = axe((c.tunnel.debut + c.tunnel.fin) / 2);
  const avant = tardives.filter(n => n === 'lampes').length;
  for (let i = 0; i < 40; i++) T.lampesTunnel(porteur, 'lampesTunnel', LT, dedans, 1 / 60, scene.index);
  assert.equal(tardives.filter(n => n === 'lampes').length, avant + 1, 'un seul état né pour cette caméra, et compté');
  const etat = porteur.lampesTunnel, figees = Array.from(etat.p);
  assert.ok(figees.some(v => v > 0), 'la caméra sous la voûte voit des lampes');
  // chauffe du code à dt nul : l'état temporel ne bouge pas, quelle que soit la caméra
  for (let i = 0; i < 20; i++) T.lampesTunnel(porteur, 'lampesTunnel', LT, axe(c.tunnel.fin + 200), 0, scene.index);
  assert.deepEqual(Array.from(etat.p), figees, 'un pas nul a changé le lissage des lampes');
  T.remettreLampes(porteur);
  assert.strictEqual(porteur.lampesTunnel, etat, 'la remise à zéro garde le même état');
  assert.ok(etat.p.every(v => v === 0), 'toutes les lampes éteintes, comme un état neuf');
  assert.equal(tardives.filter(n => n === 'lampes').length, avant + 1, 'aucune création de plus');
});

test('l abri de la pluie et l œil suivent la caméra, pas la voiture', () => {
  const milieu = (c.tunnel.debut + c.tunnel.fin) / 2;
  assert.equal(T.sousLaVoute(c, axe(milieu).pos), true, 'sous la voûte, la caméra devrait être à l abri');
  assert.equal(T.sousLaVoute(c, axe(c.tunnel.fin + 120).pos), false, 'hors du tunnel, la caméra devrait voir la pluie');
  // la voiture est sortie, la caméra est encore sous la voûte : c est la caméra qui décide
  assert.ok(!B.circuit.dansTunnel(c, c.tunnel.fin + 30, 0), 'la voiture doit être hors du tunnel');
  assert.equal(T.sousLaVoute(c, axe(milieu).pos), true, 'la caméra encore sous la voûte doit rester à l abri');
  // une caméra extérieure, même au droit du tunnel, n est pas à l abri (testé côté jeu par VUES_DEHORS)
  const hors = B.circuit.echantillon(c, milieu);
  assert.equal(T.sousLaVoute(c, [hors.x + c.tunnel.mur + 20, hors.y, hors.z]), false, 'hors des murs');
});

test('les reflets d écran ne clignotent plus au seuil d humidité', () => {
  const avecReflets = refletsF(false, { n: 0 });
  // ce que le moteur a ouvert à la création du rendu, puis le profil résolu par src/graphismes.js
  const garde = B.graphismes.capacites({ msaa: 4, shadowMapScale: 2, reflections: true }, false, 2);
  const modeste = B.graphismes.capacites({ msaa: 0, shadowMapScale: 1, reflections: false }, true, 1);
  const P = (q, n) => B.graphismes.melange(q, n, garde);
  const S = {};
  const eau = v => ({ mouille: v, pluie: 0 });
  assert.equal(avecReflets(S, P('high', 0), eau(.15)), false, 'sous le seuil de prise');
  assert.equal(avecReflets(S, P('high', 0), eau(.25)), true, 'au-dessus du seuil de prise');
  assert.equal(avecReflets(S, P('high', 0), eau(.15)), true, 'redescente : le rendu reste, sinon il clignote');
  assert.equal(avecReflets(S, P('high', 0), eau(.10)), false, 'sous le seuil de relâchement');
  assert.equal(avecReflets(S, P('high', 0), eau(.18)), false, 'remontée : il faut reprendre le seuil haut');
  assert.equal(avecReflets({}, P('low', 0), eau(.9)), false, 'qualité basse : pas de reflets');
  assert.equal(avecReflets({}, P('medium', 0), eau(.9)), false, 'qualité moyenne : pas de reflets');
  assert.equal(avecReflets({}, P('auto', 1), eau(.9)), false, 'auto au palier 1 : pas de reflets');
  assert.equal(avecReflets({}, P('auto', 0), eau(.9)), true, 'auto au premier palier : les reflets reviennent');
  assert.equal(avecReflets({}, B.graphismes.melange('high', 0, modeste), eau(.9)), false, 'GPU modeste : pas de reflets');
});
