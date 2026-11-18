// Maillage du jeu en ligne (src/reseau.js) sur un faux WebRTC en mémoire : admission par le code, maillage complet,
// relais par une troisième machine, départs et coupures, invitations à la main, compatibilité avec le salon.
import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { N, RAPIDE, attendre, dormir, reseauFactice, busFactice, machine, reunis, direct } from './outils-reseau.mjs';

const ouvertes = [];
const m = (reseau, nom, o) => { const x = machine(reseau, nom, o); ouvertes.push(x); return x; };
afterEach(async () => { for (const x of ouvertes.splice(0)) x.R.fermer(); await dormir(40); });
async function partie(reseau, noms, o = {}) {
  const [h, ...invites] = noms.map(n => m(reseau, n, o[n]));
  await h.R.creerSalon();
  for (const g of invites) { await g.R.rejoindreSalon(h.R.code); assert.ok(await attendre(() => g.R.etat === 'connecte' && g.R.membres.length >= 2), g.nom + ' admis'); }
  assert.ok(await attendre(() => reunis(h, ...invites)), 'tous réunis');
  return [h, ...invites];
}
function codeFaux() { const c = N.code.nouveau(), d = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; return c.slice(0, 9) + d[(d.indexOf(c[9]) + 1) % 32]; }

test('deux machines par le code : admission, messages, états, horloge', async () => {
  const reseau = reseauFactice(); busFactice();
  const h = m(reseau, 'Hote'), g = m(reseau, 'Invite');
  await h.R.creerSalon();
  assert.match(h.R.code, /^[0-9A-HJKMNP-TV-Z]{10}$/);
  assert.deepEqual(h.j.salon, [{ code: h.R.code, id: 0, role: 'hote' }]);
  await g.R.rejoindreSalon(N.code.afficher(h.R.code).toLowerCase());
  assert.ok(await attendre(() => reunis(h, g)));
  assert.equal(g.R.role, 'invite'); assert.equal(g.R.id, 1);
  assert.deepEqual(g.j.salon, [{ code: h.R.code, id: 1, role: 'invite' }]);
  assert.ok(direct(h, g) && direct(g, h));
  assert.deepEqual(h.j.pair, [{ id: 1, relais: false }]); assert.deepEqual(g.j.pair, [{ id: 0, relais: false }]);
  assert.deepEqual(g.R.membres.map(x => [x.id, x.nom, x.joueurs]), [[0, 'Hote', 1], [1, 'Invite', 1]]);
  h.R.envoyer({ t: 'course', i: 3 }); g.R.envoyer({ t: 'pret', oui: true }, 0);
  assert.ok(await attendre(() => g.j.messages.length && h.j.messages.length));
  assert.deepEqual(g.j.messages, [{ m: { t: 'course', i: 3 }, de: 0 }]); assert.deepEqual(h.j.messages, [{ m: { t: 'pret', oui: true }, de: 1 }]);
  g.R.envoyerEtat(N.emballer(1234.5, [{ id: 1, etat: { s: 12.5, d: -1, v: 40 } }]));
  assert.ok(await attendre(() => h.j.etats.length));
  assert.equal(h.j.etats[0].de, 1); assert.equal(h.j.etats[0].p.t, 1234.5); assert.equal(h.j.etats[0].p.voitures[0].s, 12.5);
  assert.ok(await attendre(() => g.R.synchro, 4000), 'horloge commune réglée');
  assert.ok(Math.abs(g.R.horloge() - h.R.horloge()) < 30);
  assert.ok(g.R.signalisation.journal.some(x => x.quoi === 'offre reçue' && /^bus/.test(x.voie)), 'l’offre de l’hôte est venue par le relais');
});

test('quatre machines en maillage complet ; la cinquième est refusée', async () => {
  const reseau = reseauFactice(); busFactice();
  const h = m(reseau, 'H');
  await h.R.creerSalon();
  const gs = ['A', 'B', 'C'].map(n => m(reseau, n));
  await Promise.all(gs.map(g => g.R.rejoindreSalon(h.R.code)));
  assert.ok(await attendre(() => reunis(h, ...gs)));
  // admis dès qu'un chemin existe ; les dernières liaisons directes suivent de peu
  const tous = [h, ...gs];
  assert.ok(await attendre(() => tous.every(a => tous.every(b => a === b || direct(a, b)))), 'maillage complet en direct');
  assert.deepEqual([h, ...gs].map(x => x.R.id).sort(), [0, 1, 2, 3]);
  for (const g of gs) assert.deepEqual(g.R.membres.map(x => x.pid), h.R.membres.map(x => x.pid), 'même liste partout');
  const e = m(reseau, 'E');
  await e.R.rejoindreSalon(h.R.code);
  assert.ok(await attendre(() => e.j.ferme.length));
  assert.deepEqual(e.j.ferme, ['refus']); assert.equal(e.R.statut, 'complet'); assert.deepEqual(e.j.erreurs, [N.TEXTES.complet]);
  assert.equal(h.R.membres.length, 4);
});

test('quatre pilotes au plus : deux plus deux, puis un de trop', async () => {
  const reseau = reseauFactice(); busFactice();
  const [h, g] = await partie(reseau, ['H', 'G'], { H: { joueurs: 2 }, G: { joueurs: 2 } });
  const t = m(reseau, 'T');
  await t.R.rejoindreSalon(h.R.code);
  assert.ok(await attendre(() => t.j.ferme.length));
  assert.equal(t.R.statut, 'complet');
  assert.deepEqual(h.R.membres.map(x => x.joueurs), [2, 2]); assert.ok(reunis(h, g));
});

test('deux invités sans liaison directe passent par l’hôte', async () => {
  const reseau = reseauFactice(); busFactice();
  reseau.bloquer('A', 'B');
  const [h, a, b] = await partie(reseau, ['H', 'A', 'B']);
  const p = a.R.pairs.get(b.R.id);
  assert.equal(p.relais, true); assert.equal(p.via, 'H');
  assert.ok(direct(a, h) && direct(b, h) && !direct(a, b));
  assert.equal(a.R.relais, true);
  a.R.envoyer({ t: 'arrivee', id: 1, temps: 61.2 }, b.R.id);
  a.R.envoyerEtat(N.emballer(50, [{ id: 1, etat: { s: 3 } }]));
  assert.ok(await attendre(() => b.j.messages.length && b.j.etats.some(e => e.de === a.R.id)));
  assert.deepEqual(b.j.messages, [{ m: { t: 'arrivee', id: 1, temps: 61.2 }, de: a.R.id }]);
  assert.equal(b.j.etats.find(e => e.de === a.R.id).p.voitures[0].s, 3);
  assert.equal(h.j.messages.length, 0, 'l’hôte relaie sans lire');
});

test('un invité qui ne joint pas l’hôte entre par un autre invité', async () => {
  const reseau = reseauFactice(); busFactice();
  const [h, a] = await partie(reseau, ['H', 'A']);
  reseau.bloquer('N', 'H');
  const n = m(reseau, 'N');
  await n.R.rejoindreSalon(h.R.code);
  assert.ok(await attendre(() => reunis(h, a, n)));
  assert.equal(h.R.pairs.get(n.R.id).relais, true); assert.equal(h.R.pairs.get(n.R.id).via, 'A');
  assert.ok(n.j.pair.some(x => x.id === 0 && x.relais), 'le nouveau venu voit l’hôte par A');
  assert.ok(direct(n, a));
});

test('départ propre d’un invité, puis de l’hôte', async () => {
  const reseau = reseauFactice(); busFactice();
  const [h, a, b] = await partie(reseau, ['H', 'A', 'B']);
  const id = a.R.id, t0 = Date.now();
  a.R.fermer();
  assert.ok(await attendre(() => h.j.parti.length && b.j.parti.length));
  assert.ok(Date.now() - t0 < RAPIDE.grace, 'au revoir reçu bien avant le délai de grâce');
  assert.deepEqual(h.j.parti, [id]); assert.deepEqual(b.j.parti, [id]); assert.deepEqual(a.j.ferme, ['local']);
  assert.equal(h.R.membres.length, 2); assert.ok(reunis(h, b));
  h.R.fermer();
  assert.ok(await attendre(() => b.j.ferme.length));
  assert.deepEqual(b.j.ferme, ['parti']);
});

test('machine coupée sans au revoir : partie pour les autres, liaison coupée pour elle', async () => {
  const reseau = reseauFactice(); busFactice();
  const [h, a, b] = await partie(reseau, ['H', 'A', 'B']);
  const id = a.R.id;
  reseau.couper('A');
  assert.ok(await attendre(() => h.j.parti.includes(id) && b.j.parti.includes(id)));
  assert.ok(await attendre(() => a.j.ferme.length));
  assert.deepEqual(a.j.ferme, ['coupure']);
  assert.ok(reunis(h, b));
});

test('une liaison perdue passe par la troisième machine, sans départ, puis redevient directe', async () => {
  const reseau = reseauFactice(); busFactice();
  const [h, a] = await partie(reseau, ['H', 'A', 'B']);
  const id = a.R.id;
  reseau.bloquer('H', 'A');
  assert.ok(await attendre(() => h.R.pairs.get(id).relais && a.R.pairs.get(0).relais));
  assert.equal(h.R.pairs.get(id).via, 'B');
  assert.ok(h.j.relais.includes(id) && a.j.relais.includes(0), 'événement « relais » des deux côtés');
  h.R.envoyer({ t: 'apres' }, id);
  a.R.envoyerEtat(N.emballer(7, [{ id: 1, etat: { s: 9 } }]));
  assert.ok(await attendre(() => a.j.messages.some(x => x.m.t === 'apres') && h.j.etats.some(e => e.de === id && e.p.t === 7)));
  await dormir(RAPIDE.grace * 2);
  assert.deepEqual(h.j.parti, [], 'personne n’est parti');
  reseau.debloquer('H', 'A');
  assert.ok(await attendre(() => direct(h, a) && direct(a, h), 8000), 'liaison directe retrouvée');
});

// Cas vu une fois sous forte charge (18/11) : la liaison directe tombe avant que la troisième machine ait elle-même
// joint la machine perdue ; un instant sans aucun chemin, puis un chemin relayé : c'est bien un « relais ».
test('liaison directe perdue, un instant sans chemin, puis relayée : « relais » est signalé', async () => {
  const reseau = reseauFactice(); busFactice();
  const o = { delais: Object.assign({}, RAPIDE, { grace: 5000 }) };
  const h = m(reseau, 'H', o), a = m(reseau, 'A', o), b = m(reseau, 'B', o);
  a.R.essai.sansDirect.add(b.R.pid); b.R.essai.sansDirect.add(a.R.pid);   // A ↔ B par l'hôte au départ
  await h.R.creerSalon();
  await a.R.rejoindreSalon(h.R.code); assert.ok(await attendre(() => reunis(h, a)));
  await b.R.rejoindreSalon(h.R.code); assert.ok(await attendre(() => reunis(h, a, b)));
  assert.ok(direct(h, a) && !direct(a, b));
  reseau.bloquer('H', 'A');
  assert.ok(await attendre(() => !h.R.pretAvec(1)), 'plus aucun chemin vers A');
  assert.deepEqual(h.j.relais, []);
  a.R.essai.sansDirect.clear(); b.R.essai.sansDirect.clear();
  assert.ok(await attendre(() => h.R.pretAvec(1) && h.R.pairs.get(1).relais), 'A joint par B');
  assert.equal(h.R.pairs.get(1).via, 'B');
  assert.ok(await attendre(() => h.j.relais.includes(1)), 'événement « relais » chez l’hôte');
  assert.deepEqual(h.j.parti, [], 'personne n’est parti');
});

// Vu le 18/11 sous forte charge : une négociation plus longue que D.etranger faisait couper la liaison dès son
// ouverture, avant la demande d'entrée, et ainsi de suite à chaque appel. Le délai court depuis l'ouverture.
test('négociation plus lente que le délai des inconnus : l’invité entre quand même', async () => {
  const reseau = reseauFactice({ latence: 300 }); busFactice();
  const delais = Object.assign({}, RAPIDE, { etranger: 800, essai: 4000, coupure: 2000, grace: 5000, injoignable: 8000 });
  const h = m(reseau, 'H', { delais }), g = m(reseau, 'G', { delais });
  await h.R.creerSalon();
  await g.R.rejoindreSalon(h.R.code);
  assert.ok(await attendre(() => reunis(h, g), 8000), 'admis malgré une négociation d’environ une seconde');
  assert.ok(!h.R.signalisation.journal.some(x => x.quoi === 'liaison fermée' && x.raison === 'jamais admise'), 'aucune liaison coupée à l’ouverture');
});

test('les messages d’une machine restent dans l’ordre quand leur chemin change', async () => {
  const reseau = reseauFactice(); busFactice();
  const [h, a] = await partie(reseau, ['H', 'A', 'B']);
  for (let i = 0; i < 40; i++) {
    h.R.envoyer({ t: 'n', i }, a.R.id);
    if (i === 15) reseau.bloquer('H', 'A');
    await dormir(3);
  }
  assert.ok(await attendre(() => a.j.messages.some(x => x.m.i === 39), 4000));
  const recus = a.j.messages.map(x => x.m.i);
  assert.deepEqual(recus, [...recus].sort((x, y) => x - y), 'ordre gardé');
  assert.ok(recus.length >= 30, recus.length + ' messages reçus sur 40');
});

test('invitation à la main, sans aucun relais', async () => {
  const reseau = reseauFactice();
  const h = m(reseau, 'H', { relais: [] }), g = m(reseau, 'G', { relais: [] });
  await h.R.creerSalon();
  assert.equal(h.R.code, null); assert.equal(h.R.signalisation.mode, 'main');
  const inv = await h.R.inviter();
  assert.match(inv.texte, /^https:\/\/bitume\.estrasse\.fr\/#invitation=[A-Za-z0-9_-]+$/);
  const vus = { h: [], g: [] };
  h.R.on('invitation', (n, quoi) => vus.h.push([n, quoi])); g.R.on('invitation', (n, quoi) => vus.g.push([n, quoi]));
  const rep = await g.R.accepterInvitation(inv.texte);
  assert.match(rep.texte, /^[A-Za-z0-9_-]{60,400}$/);
  await h.R.accepterReponse(rep.texte);
  assert.ok(await attendre(() => reunis(h, g)));
  assert.equal(g.R.id, 1); assert.ok(direct(h, g));
  assert.deepEqual(vus, { h: [[inv.n, 'ouverte']], g: [[inv.n, 'ouverte']] }, 'l’interface apprend que l’invitation a abouti');
});

test('invitation qui n’aboutit pas : l’échec est signalé des deux côtés, pas l’annulation', async () => {
  const reseau = reseauFactice(), delais = Object.assign({}, RAPIDE, { invitation: 500 });
  const h = m(reseau, 'H', { relais: [], delais }), g = m(reseau, 'G', { relais: [], delais });
  const vus = { h: [], g: [] };
  h.R.on('invitation', (n, quoi, raison) => vus.h.push([n, quoi, raison])); g.R.on('invitation', (n, quoi, raison) => vus.g.push([n, quoi, raison]));
  await h.R.creerSalon();
  reseau.bloquer('H', 'G');   // deux réseaux qui ne se voient pas
  const inv = await h.R.inviter();
  await h.R.accepterReponse((await g.R.accepterInvitation(inv.texte)).texte);
  assert.ok(await attendre(() => vus.h.length && vus.g.length, 3000));
  assert.deepEqual(vus, { h: [[inv.n, 'echec', 'délai']], g: [[inv.n, 'echec', 'délai']] });
  assert.equal(h.R.membres.length, 1); assert.equal(g.R.etat, 'salon');
  const autre = await h.R.inviter();
  h.R.annulerInvitation(autre.n);
  await dormir(600);
  assert.equal(vus.h.length, 1, 'une invitation annulée par l’hôte n’est pas un échec');
});

test('trois machines invitées à la main : l’hôte complète le maillage', async () => {
  const reseau = reseauFactice();
  const h = m(reseau, 'H', { relais: [] }), a = m(reseau, 'A', { relais: [] }), b = m(reseau, 'B', { relais: [] });
  await h.R.creerSalon();
  for (const g of [a, b]) { const inv = await h.R.inviter(); const rep = await g.R.accepterInvitation(inv.charge); await h.R.accepterReponse(rep.charge); }
  assert.ok(await attendre(() => reunis(h, a, b)));
  assert.ok(await attendre(() => direct(a, b) && direct(b, a)), 'liaison directe entre invités, négociée par l’hôte');
});

test('invitation portant le code : l’invité entre aussi par les relais, une seule liaison reste', async () => {
  const reseau = reseauFactice(); busFactice();
  const h = m(reseau, 'H'), g = m(reseau, 'G');
  await h.R.creerSalon();
  const inv = await h.R.inviter();
  const rep = await g.R.accepterInvitation(inv.texte);
  assert.ok(await attendre(() => reunis(h, g)), 'admis sans que l’hôte colle la réponse');
  await h.R.accepterReponse(rep.texte).catch(() => {});
  await dormir(200);
  assert.ok(reunis(h, g) && direct(h, g));
  assert.equal(h.R.membres.length, 2);
});

test('invitations : erreurs lisibles', async () => {
  const reseau = reseauFactice();
  const h = m(reseau, 'H', { relais: [] }), g = m(reseau, 'G', { relais: [] }), g2 = m(reseau, 'G2', { relais: [] });
  await h.R.creerSalon();
  const inv = await h.R.inviter();
  await assert.rejects(h.R.accepterReponse(inv.texte), /pasReponse/);
  await assert.rejects(h.R.accepterReponse('bonjour'), /illisible/);
  await assert.rejects(h.R.accepterReponse(inv.charge.slice(0, -4)), /illisible|incomplete/);
  const rep = await g.R.accepterInvitation(inv.texte);
  await assert.rejects(g2.R.accepterInvitation(rep.texte), /pasInvitation/);
  h.R.annulerInvitation(inv.n);
  await assert.rejects(h.R.accepterReponse(rep.texte), /perimee/);
});

test('code faux, partie introuvable, aucun relais : des états clairs', async () => {
  const reseau = reseauFactice(), bus = busFactice();
  const a = m(reseau, 'A');
  await assert.rejects(a.R.rejoindreSalon(codeFaux()), /code/);
  assert.deepEqual(a.j.erreurs, [N.TEXTES.codeInvalide]);
  const b = m(reseau, 'B');
  await b.R.rejoindreSalon(N.code.nouveau());
  assert.ok(await attendre(() => b.R.statut === 'introuvable', 3000));
  bus.pannes.add('bus://panne');
  const c = m(reseau, 'C', { relais: { bus: ['bus://panne'] } });
  await c.R.rejoindreSalon(N.code.nouveau());
  assert.ok(await attendre(() => c.R.statut === 'sansRelais', 3000));
  const h = m(reseau, 'H', { relais: { bus: ['bus://panne'] } });
  await h.R.creerSalon();
  assert.ok(await attendre(() => h.R.statut === 'sansRelaisHote', 3000));
  assert.equal(c.R.relaisEtat().prets, 0); assert.deepEqual(c.R.relaisEtat().familles, {});
});

test('une machine d’une autre version est reconnue et prévenue', async () => {
  const reseau = reseauFactice(); busFactice();
  const h = m(reseau, 'H');
  await h.R.creerSalon();
  const cles = await N.interne.deriverSalle(h.R.code), recus = [];
  const rv = N.interne.rendezVous(Object.assign({}, cles, { pid: 'V'.repeat(20), familles: { bus: ['bus://un'] }, delais: RAPIDE }),
    { message: (x, p) => recus.push({ x, p }), change: () => {} });
  await dormir(20);
  await rv.envoyer({ t: 'hello', p: 3 });
  assert.ok(await attendre(() => recus.some(r => r.x.t === 'version')), 'l’hôte répond « version »');
  const g = m(reseau, 'G');
  const code = N.code.nouveau(), cles2 = await N.interne.deriverSalle(code);
  const rv2 = N.interne.rendezVous(Object.assign({}, cles2, { pid: 'W'.repeat(20), familles: { bus: ['bus://un'] }, delais: RAPIDE }), { message() {}, change() {} });
  await g.R.rejoindreSalon(code);
  await dormir(20);
  await rv2.envoyer({ t: 'hello', p: 3 });
  assert.ok(await attendre(() => g.R.statut === 'version'), 'le nouveau venu voit une autre version');
  rv.fermer(); rv2.fermer();
});

test('ancien jeu.js : creer({ url }) passe par le vrai salon', async () => {
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(r => reservation.close(r));
  const serveur = spawn(process.execPath, [fileURLToPath(new URL('../serveur/salon.mjs', import.meta.url))], { env: { ...process.env, PORT: String(port), HOTE: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    await new Promise((ok, ko) => { serveur.stdout.on('data', b => { if (/écoute/.test(String(b))) ok(); }); serveur.on('exit', () => ko(new Error('salon arrêté'))); });
    const reseau = reseauFactice(), url = 'ws://127.0.0.1:' + port + '/salon';
    const h = m(reseau, 'H', { url }), g = m(reseau, 'G', { url });
    await h.R.creerSalon();
    assert.match(h.R.code, /^[A-Z]{4}$/); assert.equal(h.R.signalisation.mode, 'salon');
    assert.deepEqual(h.j.salon, [{ code: h.R.code, id: 0, role: 'hote' }]);
    await g.R.rejoindreSalon(h.R.code.toLowerCase());
    assert.ok(await attendre(() => reunis(h, g)));
    assert.deepEqual(g.j.salon.map(s => s.role), ['invite']);
    const x = m(reseau, 'X', { url });
    await x.R.rejoindreSalon('ZZZZ');
    assert.ok(await attendre(() => x.j.erreurs.length));
    assert.equal(x.j.erreurs[0], 'Aucune partie avec ce code.');
    const y = m(reseau, 'Y', { url: 'ws://127.0.0.1:1/salon' });
    await assert.rejects(y.R.creerSalon());
    assert.equal(y.R.etat, 'ferme');
  } finally { serveur.kill(); }
});
