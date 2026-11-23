import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, unlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { creerCompteurVisites, creerRouteVisites, SESSION_MS, validerIdentifiants } from '../serveur/visites.mjs';

const dossier = await mkdtemp(path.join(tmpdir(), 'bitume-visites-'));
let controles = 0, heure = 1000000;
const options = nom => ({ fichier: path.join(dossier, nom + '.json'), maintenant: () => heure, journal: () => {} });
const verifier = async (nom, fn) => { await fn(); controles++; };
const paire = (visitorId = randomUUID()) => ({ visitorId, visitId: randomUUID() });
async function requete(route, body, { method = 'POST', headers = {}, socket = { remoteAddress: '127.0.0.1' } } = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]);
  req.method = method; req.socket = socket; req.headers = { host: 'bitume.estrasse.fr', 'content-type': 'application/json', origin: 'https://bitume.estrasse.fr', ...headers };
  const res = { status: null, headers: null, body: null, writeHead(s, h) { this.status = s; this.headers = h; }, end(s) { this.body = JSON.parse(s); this.writableEnded = true; } };
  await route(req, res); return res;
}
try {
  await verifier('une première visite est durable avant réponse', async () => {
    const o = options('premiere'), s = creerCompteurVisites(o), id = paire();
    assert.deepEqual(await s.lire(), { visites: 0, visiteursUniques: 0, reseauxUniques: 0 });
    assert.deepEqual(await s.enregistrer(id), { visites: 1, visiteursUniques: 1, reseauxUniques: 0 });
    const brut = await readFile(o.fichier, 'utf8'); assert.ok(!brut.includes(id.visitorId) && !brut.includes(id.visitId));
    assert.equal(await readFile(o.fichier + '.bak', 'utf8'), brut);
    assert.deepEqual(await creerCompteurVisites(o).lire(), { visites: 1, visiteursUniques: 1, reseauxUniques: 0 });
  });
  await verifier('réessais, casse et rechargements sont idempotents', async () => {
    const o = options('retry'), s = creerCompteurVisites(o), id = paire();
    await Promise.all(Array.from({ length: 12 }, () => s.enregistrer(id)));
    await creerCompteurVisites(o).enregistrer({ visitorId: id.visitorId.toUpperCase(), visitId: id.visitId.toUpperCase() });
    assert.deepEqual(await creerCompteurVisites(o).lire(), { visites: 1, visiteursUniques: 1, reseauxUniques: 0 });
  });
  await verifier('onglets concurrents fusionnés dans une session et nouveau navigateur distinct', async () => {
    const s = creerCompteurVisites(options('onglets')), visiteur = randomUUID();
    await Promise.all(Array.from({ length: 10 }, () => s.enregistrer(paire(visiteur))));
    assert.deepEqual(await s.lire(), { visites: 1, visiteursUniques: 1, reseauxUniques: 0 });
    assert.deepEqual(await s.enregistrer(paire()), { visites: 2, visiteursUniques: 2, reseauxUniques: 0 });
  });
  await verifier('session prolongée par activité puis nouvelle après 30 minutes', async () => {
    const s = creerCompteurVisites(options('session')), id = paire();
    await s.enregistrer(id); heure += 20 * 60000; await s.enregistrer(id);
    heure += 20 * 60000; await s.enregistrer(paire(id.visitorId));
    assert.deepEqual(await s.lire(), { visites: 1, visiteursUniques: 1, reseauxUniques: 0 });
    heure += SESSION_MS; await s.enregistrer(paire(id.visitorId));
    assert.deepEqual(await s.lire(), { visites: 2, visiteursUniques: 1, reseauxUniques: 0 });
    heure += SESSION_MS * 20; await s.enregistrer(id);
    assert.deepEqual(await s.lire(), { visites: 2, visiteursUniques: 1, reseauxUniques: 0 }, 'un ancien retry reste idempotent');
  });
  await verifier('même session avec autre visiteur refusée', async () => {
    const s = creerCompteurVisites(options('collision')), id = paire(); await s.enregistrer(id);
    await assert.rejects(s.enregistrer({ ...id, visitorId: randomUUID() }), e => e.status === 409);
    assert.deepEqual(await s.lire(), { visites: 1, visiteursUniques: 1, reseauxUniques: 0 });
  });
  await verifier('anciens retries ne prolongent pas artificiellement les sessions', async () => {
    const s = creerCompteurVisites(options('anciens-retries')), ancien = paire(); await s.enregistrer(ancien);
    heure += SESSION_MS + 1; const courant = paire(ancien.visitorId); await s.enregistrer(courant);
    heure += 20 * 60000; await s.enregistrer(ancien);
    heure += 11 * 60000; await s.enregistrer(paire(ancien.visitorId));
    assert.deepEqual(await s.lire(), { visites: 3, visiteursUniques: 1, reseauxUniques: 0 });
    heure += SESSION_MS + 1; await s.enregistrer(courant);
    heure += 1000; await s.enregistrer(paire(ancien.visitorId));
    assert.deepEqual(await s.lire(), { visites: 4, visiteursUniques: 1, reseauxUniques: 0 });
  });
  await verifier('alias d’onglets entretiennent seulement leur groupe actif', async () => {
    const s = creerCompteurVisites(options('alias-actifs')), id = paire(), alias = paire(id.visitorId);
    await s.enregistrer(id); await s.enregistrer(alias);
    for (let i = 0; i < 4; i++) { heure += 20 * 60000; await s.enregistrer(i % 2 ? id : alias); }
    assert.deepEqual(await s.lire(), { visites: 1, visiteursUniques: 1, reseauxUniques: 0 });
  });
  await verifier('restauration automatique de copie intacte sans baisse', async () => {
    const o = options('restauration'), s = creerCompteurVisites(o); await s.enregistrer(paire()); await s.enregistrer(paire());
    await writeFile(o.fichier, '{tronque');
    assert.deepEqual(await creerCompteurVisites(o).lire(), { visites: 2, visiteursUniques: 2, reseauxUniques: 0 });
    await unlink(o.fichier);
    assert.deepEqual(await creerCompteurVisites(o).lire(), { visites: 2, visiteursUniques: 2, reseauxUniques: 0 });
  });
  await verifier('écriture interrompue plus récente récupérée', async () => {
    const o = options('interruption'), s = creerCompteurVisites(o); await s.enregistrer(paire());
    const ancien = await readFile(o.fichier); await s.enregistrer(paire()); const nouveau = await readFile(o.fichier);
    await writeFile(o.fichier, ancien); await writeFile(o.fichier + '.bak', ancien); await writeFile(o.fichier + '.next', nouveau);
    assert.deepEqual(await creerCompteurVisites(o).lire(), { visites: 2, visiteursUniques: 2, reseauxUniques: 0 });
  });
  await verifier('aucune remise à zéro si les deux copies sont invalides', async () => {
    const o = options('corruption'); await writeFile(o.fichier, '{illisible'); await writeFile(o.fichier + '.bak', '[]');
    await assert.rejects(creerCompteurVisites(o).lire(), /Aucune copie valide/);
    assert.equal(await readFile(o.fichier, 'utf8'), '{illisible');
  });
  await verifier('échec de deuxième copie puis retry répare sans perdre ni doubler', async () => {
    const o = options('copie'), s = creerCompteurVisites(o), id = paire(); await s.lire(); await mkdir(o.fichier + '.bak.next');
    await assert.rejects(s.enregistrer(id)); await rm(o.fichier + '.bak.next', { recursive: true });
    assert.deepEqual(await s.enregistrer(id), { visites: 1, visiteursUniques: 1, reseauxUniques: 0 });
    assert.equal(await readFile(o.fichier, 'utf8'), await readFile(o.fichier + '.bak', 'utf8'));
    assert.deepEqual(await creerCompteurVisites(o).lire(), { visites: 1, visiteursUniques: 1, reseauxUniques: 0 });
  });
  await verifier('format futur ne revient pas sur une ancienne sauvegarde', async () => {
    const o = options('futur'), s = creerCompteurVisites(o); await s.enregistrer(paire());
    const brut = JSON.stringify({ format: 'bitume-visites', donnees: { version: 3, visites: 8 } }); await writeFile(o.fichier, brut);
    await assert.rejects(creerCompteurVisites(o).lire(), e => e.code === 'FORMAT_FUTUR');
    assert.equal(await readFile(o.fichier, 'utf8'), brut);
  });
  await verifier('migration conserve les totaux historiques', async () => {
    const o = options('migration'); await writeFile(o.fichier, JSON.stringify({ version: 0, visites: 120, visiteursUniques: 40 }));
    const s = creerCompteurVisites(o); assert.deepEqual(await s.lire(), { visites: 120, visiteursUniques: 40, reseauxUniques: 0 });
    await s.enregistrer(paire()); assert.deepEqual(await creerCompteurVisites(o).lire(), { visites: 121, visiteursUniques: 41, reseauxUniques: 0 });
  });
  await verifier('JSON et identifiants stricts', async () => {
    for (const x of [null, [], {}, { ...paire(), ip: '1.2.3.4' }, { ...paire(), visitId: 'abc' }, { ...paire(), visitorId: 2 }])
      assert.throws(() => validerIdentifiants(x), e => e.status === 400);
  });
  await verifier('route HTTP réelle sans socket : GET, POST et erreurs isolées', async () => {
    const route = creerRouteVisites(creerCompteurVisites(options('route')), { journal: () => {} });
    assert.equal((await requete(route, paire(), { socket: null })).status, 200);
    const get = await requete(route, undefined, { method: 'GET' });
    assert.deepEqual(get.body, { visites: 1, visiteursUniques: 1, reseauxUniques: 0 }); assert.equal(get.headers['cache-control'], 'no-store');
    assert.equal((await requete(route, '{')).status, 400);
    const doublon = paire();
    assert.equal((await requete(route, `{"visitorId":"${doublon.visitorId}","visitId":"${doublon.visitId}","visitId":"${randomUUID()}"}`)).status, 400);
    assert.equal((await requete(route, 'x'.repeat(257))).status, 413);
    assert.equal((await requete(route, paire(), { headers: { 'content-type': 'text/plain' } })).status, 415);
    assert.equal((await requete(route, paire(), { headers: { origin: 'https://autre.example' } })).status, 403);
    assert.equal((await requete(route, paire(), { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
    assert.equal((await requete(route, undefined, { method: 'DELETE' })).status, 405);
    assert.deepEqual((await requete(route, undefined, { method: 'GET' })).body, { visites: 1, visiteursUniques: 1, reseauxUniques: 0 });
  });
  await verifier('panne de stockage donne 503 sans faux compteur nul', async () => {
    const o = options('indisponible'); await writeFile(o.fichier, 'invalide');
    const route = creerRouteVisites(creerCompteurVisites(o), { journal: () => {} });
    const r = await requete(route, undefined, { method: 'GET' });
    assert.equal(r.status, 503); assert.ok(!Object.hasOwn(r.body, 'visites'));
  });
  await verifier('réseau : IP distinctes comptées, même IP dédupliquée, aucune IP brute persistée', async () => {
    const o = options('reseau'), s = creerCompteurVisites(o), id = paire();
    assert.deepEqual(await s.enregistrer(id, { ip: '203.0.113.7' }), { visites: 1, visiteursUniques: 1, reseauxUniques: 1 });
    assert.deepEqual(await s.enregistrer(id, { ip: '203.0.113.7' }), { visites: 1, visiteursUniques: 1, reseauxUniques: 1 });
    assert.deepEqual(await s.enregistrer(paire(), { ip: '203.0.113.7' }), { visites: 2, visiteursUniques: 2, reseauxUniques: 1 });
    assert.deepEqual(await s.enregistrer(paire(), { ip: '198.51.100.9' }), { visites: 3, visiteursUniques: 3, reseauxUniques: 2 });
    const brut = await readFile(o.fichier, 'utf8');
    assert.ok(!brut.includes('203.0.113.7') && !brut.includes('198.51.100.9'), 'l\'IP brute ne doit jamais être écrite');
    assert.equal(await readFile(o.fichier + '.bak', 'utf8'), brut);
  });
  await verifier('proxys de confiance : X-Forwarded-For lu seulement si la connexion directe est approuvée', async () => {
    const s = creerCompteurVisites({ ...options('proxy-ip'), proxies: ['10.0.0.0/8'] });
    assert.equal(s.ipClient({ socket: { remoteAddress: '10.0.0.1' }, headers: { 'x-forwarded-for': '203.0.113.42' } }), '203.0.113.42');
    assert.equal(s.ipClient({ socket: { remoteAddress: '198.51.100.5' }, headers: { 'x-forwarded-for': '8.8.8.8' } }), '198.51.100.5');
    assert.equal(s.ipClient({ socket: { remoteAddress: '10.0.0.1' }, headers: { 'x-forwarded-for': '203.0.113.42, 10.0.0.1' } }), '203.0.113.42');
    assert.equal(s.ipClient({ socket: { remoteAddress: '::ffff:10.0.0.1' }, headers: { 'x-forwarded-for': '203.0.113.42' } }), '203.0.113.42');
  });
  await verifier('route : IP client via proxy approuvé, XFF spoofé ignoré, aucune IP brute persistée', async () => {
    const o = options('route-reseau');
    const route = creerRouteVisites(creerCompteurVisites({ ...o, proxies: ['10.0.0.0/8'] }), { journal: () => {} });
    let r = await requete(route, paire(), { socket: { remoteAddress: '10.0.0.1' }, headers: { 'x-forwarded-for': '203.0.113.42' } });
    assert.equal(r.status, 200); assert.equal(r.body.reseauxUniques, 1);
    r = await requete(route, paire(), { socket: { remoteAddress: '10.0.0.1' }, headers: { 'x-forwarded-for': '198.51.100.9' } });
    assert.equal(r.status, 200); assert.equal(r.body.reseauxUniques, 2);
    r = await requete(route, paire(), { socket: { remoteAddress: '198.51.100.5' }, headers: { 'x-forwarded-for': '8.8.8.8' } });
    assert.equal(r.status, 200); assert.equal(r.body.reseauxUniques, 3);
    const brut = await readFile(o.fichier, 'utf8');
    assert.ok(!brut.includes('203.0.113.42') && !brut.includes('198.51.100.9') && !brut.includes('198.51.100.5') && !brut.includes('8.8.8.8'));
  });
  await verifier('migration v1 → v2 : données sans réseau conservées et reseauxUniques initialisé à 0', async () => {
    const o = options('migration-v1'), s1 = creerCompteurVisites(o);
    await s1.enregistrer(paire());
    const paquet = JSON.parse(await readFile(o.fichier, 'utf8'));
    paquet.donnees.version = 1; delete paquet.donnees.reseaux; delete paquet.donnees.reseauxUniques; delete paquet.donnees.baseReseaux;
    paquet.sha256 = createHash('sha256').update(JSON.stringify(paquet.donnees)).digest('hex');
    await writeFile(o.fichier, JSON.stringify(paquet) + '\n'); await writeFile(o.fichier + '.bak', JSON.stringify(paquet) + '\n');
    assert.deepEqual(await creerCompteurVisites(o).lire(), { visites: 1, visiteursUniques: 1, reseauxUniques: 0 });
  });
  console.log(`${controles} contrôles serveur des visites réussis.`);
} finally { await rm(dossier, { recursive: true, force: true }); }
