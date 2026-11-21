import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { creerCompteurVisites, SESSION_MS } from '../serveur/visites.mjs';

const contexte = vm.createContext({});
vm.runInContext(readFileSync(new URL('../src/visites.js', import.meta.url), 'utf8'), contexte);
const creer = contexte.BITUME.visites.creer, dossier = await mkdtemp(path.join(tmpdir(), 'bitume-visites-client-'));
let controles = 0, sequence = 0;
const verifier = async (nom, fn) => { await fn(); controles++; };
function environnement({ stockage = new Map(), serveur, temps, locks, protocole = 'https:', panne = false, sansStockage = false } = {}) {
  const nodes = Object.fromEntries(['compteur-visites', 'compteur-total', 'compteur-uniques'].map(id => [id, { textContent: '', dataset: {} }]));
  const appels = [], timers = new Map(), evenements = new Map(); let n = 0;
  const env = { document: { hidden: false, getElementById: id => nodes[id], addEventListener: (nom, fn) => evenements.set(nom, fn), removeEventListener: nom => evenements.delete(nom) },
    localStorage: { getItem: k => { if (sansStockage) throw new Error('Stockage bloqué'); return stockage.get(k) ?? null; },
      setItem: (k, v) => { if (sansStockage) throw new Error('Stockage bloqué'); stockage.set(k, v); } },
    Date: { now: () => temps.t }, crypto: { randomUUID }, navigator: { locks }, location: { protocol: protocole }, AbortController,
    setTimeout: (fn, ms) => { const id = ++n; if (ms === 40) queueMicrotask(fn); else timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => {
      appels.push({ url, options });
      if (panne) throw new Error('Réseau indisponible');
      const d = options.method === 'POST' ? await serveur.enregistrer(JSON.parse(options.body)) : await serveur.lire();
      return { ok: true, json: async () => d };
    } };
  return { env, appels, nodes, timers, evenements, stockage };
}
function fixture() {
  const temps = { t: 1000000 }, stockage = new Map(); let attente = Promise.resolve();
  const locks = { request: (nom, fn) => { const p = attente.then(fn); attente = p.catch(() => {}); return p; } };
  const serveur = creerCompteurVisites({ fichier: path.join(dossier, (++sequence) + '.json'), maintenant: () => temps.t, journal: () => {} });
  const nouveau = extra => environnement({ temps, stockage, locks, serveur, ...extra });
  return { temps, stockage, locks, serveur, nouveau };
}
try {
  await verifier('aucun réseau avant le titre, puis vrais totaux du serveur', async () => {
    const f = fixture(), n = f.nouveau(), c = creer(n.env); c.activite(); await c.actualiser(); assert.equal(n.appels.length, 0);
    c.titre(true); await c.actualiser(); assert.equal(n.appels.length, 1); assert.equal(n.appels[0].options.method, 'POST');
    assert.equal(n.nodes['compteur-total'].textContent, '1'); assert.equal(n.nodes['compteur-uniques'].textContent, '1');
    for (let i = 0; i < 40; i++) { c.titre(false); c.titre(true); await c.actualiser(); }
    assert.equal(n.appels.length, 1, 'retours au titre sans nouvelle visite ni rafale réseau'); c.detruire();
  });
  await verifier('rechargement et deux onglets partagent la même identité/session', async () => {
    const f = fixture(), a = f.nouveau(), b = f.nouveau(), ca = creer(a.env), cb = creer(b.env);
    ca.titre(true); cb.titre(true); await Promise.all([ca.actualiser(), cb.actualiser()]);
    assert.deepEqual(JSON.parse(a.appels[0].options.body), JSON.parse(b.appels[0].options.body));
    const recharge = creer(f.nouveau().env); recharge.titre(true); await recharge.actualiser();
    assert.deepEqual(await f.serveur.lire(), { visites: 1, visiteursUniques: 1 }); ca.detruire(); cb.detruire(); recharge.detruire();
  });
  await verifier('nouvelle session après inactivité et même visiteur unique', async () => {
    const f = fixture(), n = f.nouveau(), c = creer(n.env); c.titre(true); await c.actualiser();
    f.temps.t += SESSION_MS + 1; c.activite(); await c.actualiser();
    assert.deepEqual(await f.serveur.lire(), { visites: 2, visiteursUniques: 1 });
    assert.notEqual(JSON.parse(n.appels[0].options.body).visitId, JSON.parse(n.appels[1].options.body).visitId); c.detruire();
  });
  await verifier('activité en course conserve la session au-delà de 30 minutes', async () => {
    const f = fixture(), n = f.nouveau(), c = creer(n.env); c.titre(true); await c.actualiser(); c.titre(false);
    for (let i = 0; i < 12; i++) { f.temps.t += 4 * 60000; c.activite(); await c.actualiser(); }
    assert.deepEqual(await f.serveur.lire(), { visites: 1, visiteursUniques: 1 });
    assert.ok(n.appels.length <= 7, 'rappel d’activité borné à cinq minutes'); c.detruire();
  });
  await verifier('titre laissé inactif ne génère pas de nouvelles visites', async () => {
    const f = fixture(), n = f.nouveau(), c = creer(n.env); c.titre(true); await c.actualiser();
    f.temps.t += 60 * 60000; await c.actualiser();
    assert.equal(n.appels.at(-1).options.method, 'GET'); assert.deepEqual(await f.serveur.lire(), { visites: 1, visiteursUniques: 1 }); c.detruire();
  });
  await verifier('onglet inactif ne remplace pas la session récente d’un autre', async () => {
    const f = fixture(), a = creer(f.nouveau().env), b = creer(f.nouveau().env);
    a.titre(true); await a.actualiser(); b.titre(true); await b.actualiser();
    f.temps.t += 40 * 60000; b.activite(); await b.actualiser();
    const avant = JSON.parse(f.stockage.get('bitume.visite.v1')); await a.actualiser();
    assert.deepEqual(JSON.parse(f.stockage.get('bitume.visite.v1')), avant);
    assert.deepEqual(await f.serveur.lire(), { visites: 2, visiteursUniques: 1 }); a.detruire(); b.detruire();
  });
  await verifier('stockage bloqué garde le jeu et les vrais totaux, sans fausses identités', async () => {
    const f = fixture(); await f.serveur.enregistrer({ visitorId: randomUUID(), visitId: randomUUID() });
    const n = f.nouveau({ sansStockage: true }), c = creer(n.env); c.titre(true); await c.actualiser();
    assert.equal(n.appels[0].options.method, 'GET'); assert.equal(n.nodes['compteur-total'].textContent, '1');
    assert.deepEqual(await f.serveur.lire(), { visites: 1, visiteursUniques: 1 }); c.detruire();
  });
  await verifier('copie locale et panne ne montrent jamais un faux zéro', async () => {
    const f = fixture();
    for (const extra of [{ protocole: 'file:' }, { panne: true }]) {
      const n = f.nouveau(extra), c = creer(n.env); c.titre(true); await c.actualiser();
      assert.equal(n.nodes['compteur-total'].textContent, '—'); assert.equal(n.nodes['compteur-uniques'].textContent, '—');
      if (extra.protocole) assert.equal(n.appels.length, 0); c.detruire();
    }
  });
  await verifier('réponse perdue puis réessai garde une seule visite', async () => {
    const f = fixture(), n = f.nouveau(), fetch = n.env.fetch; let premiere = true;
    n.env.fetch = async (...args) => { const r = await fetch(...args); if (premiere) { premiere = false; throw new Error('Réponse perdue'); } return r; };
    const c = creer(n.env); c.titre(true); await c.actualiser(); assert.equal(n.nodes['compteur-total'].textContent, '—');
    f.temps.t += 31000; await c.actualiser(); assert.equal(n.nodes['compteur-total'].textContent, '1');
    assert.deepEqual(await f.serveur.lire(), { visites: 1, visiteursUniques: 1 }); c.detruire();
  });
  await verifier('manette ou événements fréquents n’appellent pas le réseau en frame', async () => {
    const f = fixture(), n = f.nouveau(), c = creer(n.env); c.titre(true); await c.actualiser(); c.titre(false);
    for (let i = 0; i < 10000; i++) c.activite();
    assert.equal(n.appels.length, 1); assert.ok(n.timers.size <= 1); c.detruire(); assert.equal(n.evenements.size, 0);
  });
  await verifier('Web Locks absent reste fonctionnel', async () => {
    const f = fixture(), n = f.nouveau({ locks: undefined }), c = creer(n.env); c.titre(true); await c.actualiser();
    assert.deepEqual(await f.serveur.lire(), { visites: 1, visiteursUniques: 1 }); c.detruire();
  });
  await verifier('compteurs intégrés seulement dans le titre et module chargé avant jeu', async () => {
    const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8'), debut = html.indexOf('<section id="titre"'), fin = html.indexOf('</section>', debut);
    for (const id of ['compteur-visites', 'compteur-total', 'compteur-uniques']) {
      const i = html.indexOf('id="' + id + '"'); assert.ok(i > debut && i < fin); assert.equal(html.match(new RegExp('id="' + id + '"', 'g')).length, 1);
    }
    const build = readFileSync(new URL('../construire.py', import.meta.url), 'utf8'); assert.ok(build.indexOf("'visites.js'") < build.indexOf("'jeu.js'"));
  });
  console.log(`${controles} contrôles navigateur des visites réussis.`);
} finally { await rm(dossier, { recursive: true, force: true }); }
