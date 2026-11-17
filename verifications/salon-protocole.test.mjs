// Tests TCP du vrai salon, sans navigateur ni dependance externe.
// Le chemin optionnel permet de rejouer exactement ces tests sur une ancienne version.
import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

let serveur, port;
const connexions = new Set();
const dormir = ms => new Promise(resolve => setTimeout(resolve, ms));
const DELAI = 1200;

function paquet(opcode, contenu = Buffer.alloc(0), { fin = true, masque = true, rsv = 0 } = {}) {
  const b = Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu);
  const n = b.length, taille = n < 126 ? 2 : n <= 65535 ? 4 : 10;
  const trame = Buffer.alloc(taille + (masque ? 4 : 0) + n);
  trame[0] = (fin ? 128 : 0) | rsv | opcode;
  trame[1] = (masque ? 128 : 0) | (n < 126 ? n : n <= 65535 ? 126 : 127);
  if (taille === 4) trame.writeUInt16BE(n, 2);
  if (taille === 10) trame.writeBigUInt64BE(BigInt(n), 2);
  const cle = Buffer.from([29, 173, 7, 61]);
  if (masque) cle.copy(trame, taille);
  for (let i = 0; i < n; i++) trame[taille + (masque ? 4 : 0) + i] = b[i] ^ (masque ? cle[i & 3] : 0);
  return trame;
}

class Client {
  constructor() {
    this.socket = net.connect({ host: '127.0.0.1', port });
    connexions.add(this);
    this.tampon = Buffer.alloc(0); this.messages = []; this.attentes = []; this.headers = null;
    this.socket.on('data', b => { this.tampon = Buffer.concat([this.tampon, b]); this.lire(); });
    this.socket.on('error', () => {});
  }
  lire() {
    if (!this.headers) {
      const fin = this.tampon.indexOf('\r\n\r\n');
      if (fin < 0) return;
      this.headers = this.tampon.subarray(0, fin).toString();
      this.tampon = this.tampon.subarray(fin + 4);
    }
    while (this.tampon.length >= 2) {
      const b = this.tampon; let n = b[1] & 127, o = 2;
      if (n === 126) { if (b.length < 4) break; n = b.readUInt16BE(2); o = 4; }
      else if (n === 127) { if (b.length < 10) break; n = Number(b.readBigUInt64BE(2)); o = 10; }
      if (b.length < o + n) break;
      const message = { opcode: b[0] & 15, donnees: Buffer.from(b.subarray(o, o + n)) };
      if (message.opcode === 1) { try { message.json = JSON.parse(message.donnees.toString()); } catch {} }
      if (message.opcode === 8) message.code = n >= 2 ? message.donnees.readUInt16BE(0) : null;
      this.messages.push(message); this.tampon = b.subarray(o + n);
    }
    this.reveiller();
  }
  reveiller() {
    for (const attente of [...this.attentes]) {
      const index = this.messages.findIndex(attente.predicat);
      if (index < 0) continue;
      this.attentes.splice(this.attentes.indexOf(attente), 1);
      clearTimeout(attente.minuteur);
      attente.resolve(this.messages.splice(index, 1)[0]);
    }
  }
  attendre(predicat) {
    return new Promise((resolve, reject) => {
      const attente = { predicat, resolve };
      attente.minuteur = setTimeout(() => {
        this.attentes.splice(this.attentes.indexOf(attente), 1);
        reject(new Error('Le salon ne repond pas comme attendu.'));
      }, DELAI);
      this.attentes.push(attente); this.reveiller();
    });
  }
  message(type) { return this.attendre(x => x.json?.t === type).then(x => x.json); }
  envoyer(m) { this.socket.write(paquet(1, JSON.stringify(m))); }
  detruire() { this.socket.destroy(); connexions.delete(this); }
}

async function ouvrir({ tete, version = '13', cle = 'dGhlIHNhbXBsZSBub25jZQ==', chemin = '/salon' } = {}) {
  const c = new Client();
  await once(c.socket, 'connect');
  const headers = Buffer.from(`GET ${chemin} HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: ${version}\r\nSec-WebSocket-Key: ${cle}\r\n\r\n`);
  c.socket.write(tete ? Buffer.concat([headers, tete]) : headers);
  for (let i = 0; i < 120 && !c.headers && !c.socket.destroyed; i++) await dormir(10);
  return c;
}
async function creer(joueurs = 1) {
  const c = await ouvrir();
  assert.match(c.headers, /^HTTP\/1\.1 101 /);
  c.envoyer({ t: 'creer', nom: 'Hote', joueurs });
  const salon = await c.message('salon');
  await c.message('salle');
  return { c, salon };
}
function sante() {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/salon/sante' }, res => {
      let s = ''; res.on('data', b => { s += b; }); res.on('end', () => resolve(s));
    });
    req.on('error', reject); req.setTimeout(DELAI, () => req.destroy(new Error('sante indisponible')));
  });
}

beforeEach(async () => {
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const fichier = process.argv[2] || fileURLToPath(new URL('../serveur/salon.mjs', import.meta.url));
  serveur = spawn(process.execPath, [fichier], { env: { ...process.env, PORT: String(port), HOTE: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = '';
  serveur.stdout.on('data', b => { journal += b; }); serveur.stderr.on('data', b => { journal += b; });
  for (let i = 0; i < 200 && !journal.includes("à l'écoute"); i++) {
    if (serveur.exitCode !== null) throw new Error(journal);
    await dormir(10);
  }
  assert.ok(journal.includes("à l'écoute"), journal || 'Le salon ne demarre pas.');
});
afterEach(async () => {
  for (const c of connexions) c.detruire();
  if (serveur && serveur.exitCode === null) { const fin = once(serveur, 'exit'); serveur.kill(); await fin; }
});

test('creation, capacite de quatre pilotes et depart de l’hote', async () => {
  const { c: hote, salon } = await creer(2);
  const invite = await ouvrir(); invite.envoyer({ t: 'rejoindre', code: salon.code, nom: 'Invite', joueurs: 2 });
  assert.equal((await invite.message('salon')).id, 1);
  const plein = await ouvrir(); plein.envoyer({ t: 'rejoindre', code: salon.code });
  assert.match((await plein.message('erreur')).message, /complète/);
  hote.detruire();
  assert.equal((await invite.message('parti')).hote, true);
});

test('premiere trame recue dans le meme paquet TCP que la requete HTTP', async () => {
  const c = await ouvrir({ tete: paquet(1, '{"t":"creer","nom":"Premiere"}') });
  assert.equal((await c.message('salon')).id, 0);
});

test('JSON fragmente, ping intercale et caractere UTF-8 coupe entre fragments', async () => {
  const c = await ouvrir();
  const b = Buffer.from('{"t":"creer","nom":"Pilote 🚗"}');
  const coupe = b.indexOf(Buffer.from('🚗')) + 2;
  c.socket.write(Buffer.concat([paquet(1, b.subarray(0, coupe), { fin: false }), paquet(9, 'echo'), paquet(0, b.subarray(coupe))]));
  assert.equal((await c.attendre(x => x.opcode === 10)).donnees.toString(), 'echo');
  await c.message('salon');
  assert.equal((await c.message('salle')).membres[0].nom, 'Pilote 🚗');
});

test('relais binaire fragmente conserve tous les octets et l’expediteur', async () => {
  const { c: hote, salon } = await creer();
  const invite = await ouvrir(); invite.envoyer({ t: 'rejoindre', code: salon.code });
  const id = (await invite.message('salon')).id;
  const b = Buffer.from([0, 17, 255, 0, 99]);
  invite.socket.write(Buffer.concat([paquet(2, b.subarray(0, 2), { fin: false }), paquet(0, b.subarray(2))]));
  assert.deepEqual((await hote.attendre(x => x.opcode === 2)).donnees, Buffer.from([id, 17, 255, 0, 99]));
});

test('trame distribuee entre plusieurs lectures TCP', async () => {
  const c = await ouvrir(); const b = paquet(1, '{"t":"creer"}');
  for (let i = 0; i < b.length; i++) { c.socket.write(b.subarray(i, i + 1)); await dormir(1); }
  assert.equal((await c.message('salon')).id, 0);
});

test('deux messages distincts dans une meme lecture TCP', async () => {
  const c = await ouvrir();
  c.socket.write(Buffer.concat([paquet(1, '{"t":"creer","nom":"Avant"}'), paquet(1, '{"t":"profil","nom":"Apres"}')]));
  await c.message('salon'); await c.message('salle');
  assert.equal((await c.message('salle')).membres[0].nom, 'Apres');
});

for (const fragmente of [false, true]) test(`message de 64 Kio accepte, fragmentation=${fragmente}`, async () => {
  const c = await ouvrir();
  const debut = '{"t":"creer","nom":"Limite","bourrage":"', fin = '"}';
  const b = Buffer.from(debut + 'x'.repeat(65536 - Buffer.byteLength(debut + fin)) + fin);
  c.socket.write(fragmente ? Buffer.concat([paquet(1, b.subarray(0, 32000), { fin: false }), paquet(0, b.subarray(32000))]) : paquet(1, b));
  assert.equal((await c.message('salon')).id, 0);
});

const casInvalides = [
  ['continuation sans debut', paquet(0, '{}'), 1002],
  ['nouveau message avant la fin du precedent', Buffer.concat([paquet(1, '{', { fin: false }), paquet(1, '{}')]), 1002],
  ['opcode reserve', paquet(3, '{}'), 1002],
  ['bits RSV sans extension negociee', paquet(1, '{}', { rsv: 64 }), 1002],
  ['message non masque', paquet(1, '{}', { masque: false }), 1002],
  ['ping fragmente', paquet(9, 'x', { fin: false }), 1002],
  ['ping superieur a 125 octets', paquet(9, Buffer.alloc(126)), 1002],
  ['message UTF-8 invalide', paquet(1, Buffer.concat([Buffer.from('{"t":"creer","nom":"'), Buffer.from([0xc0, 0xaf]), Buffer.from('"}')])), 1007],
  ['fermeture avec un seul octet', paquet(8, Buffer.from([1])), 1002],
  ['code de fermeture interdit', paquet(8, Buffer.from([3, 237])), 1002],
  ['raison de fermeture UTF-8 invalide', paquet(8, Buffer.from([3, 232, 0xff])), 1007],
  ['limite cumulee de fragments', Buffer.concat([paquet(1, Buffer.alloc(40000, 32), { fin: false }), paquet(0, Buffer.alloc(30000, 32))]), 1009],
  ['limite d’une trame', paquet(1, Buffer.alloc(65537, 32)), 1009],
];
for (const [nom, octets, code] of casInvalides) test(nom, async () => {
  const c = await ouvrir(); c.socket.write(octets);
  assert.equal((await c.attendre(x => x.opcode === 8)).code, code);
});

test('aucune creation fantome apres une fermeture dans le meme paquet TCP', async () => {
  const avant = await sante();
  const c = await ouvrir(); c.socket.write(Buffer.concat([paquet(8), paquet(1, '{"t":"creer"}')]));
  await c.attendre(x => x.opcode === 8); c.detruire();
  for (let i = 0; i < 100 && !(await sante()).includes('0 machine(s)'); i++) await dormir(10);
  assert.equal(await sante(), avant);
});

for (const options of [{ version: '12' }, { cle: 'incorrecte' }, { chemin: '/salon-inexistant' }]) test('negociation invalide refusee : ' + JSON.stringify(options), async () => {
  const c = await ouvrir(options);
  assert.ok(!c.headers?.startsWith('HTTP/1.1 101 '), 'La negociation invalide a ete acceptee.');
});

test('fragmentation terminee ne laisse pas de continuation ouverte', async () => {
  const c = await ouvrir();
  c.socket.write(Buffer.concat([paquet(1, '{"t":', { fin: false }), paquet(0, '"creer"}')]));
  await c.message('salon');
  c.socket.write(paquet(0, '{}'));
  assert.equal((await c.attendre(x => x.opcode === 8)).code, 1002);
});

test('nombre de fragments vides borne sans allocation infinie', async () => {
  const c = await ouvrir();
  c.socket.write(Buffer.concat([paquet(1, '', { fin: false }), ...Array.from({ length: 1024 }, () => paquet(0, '', { fin: false }))]));
  assert.equal((await c.attendre(x => x.opcode === 8)).code, 1009);
});

test('FIN TCP sans message WebSocket libere immediatement la connexion', async () => {
  const { c } = await creer();
  c.socket.end();
  for (let i = 0; i < 100; i++) {
    if ((await sante()).includes('0 partie(s), 0 machine(s)')) return;
    await dormir(10);
  }
  assert.fail('Le client parti conserve une connexion et un salon.');
});

test('une erreur de protocole bloque aussi les messages TCP suivants', async () => {
  const c = await ouvrir();
  c.socket.write(Buffer.concat([paquet(3, '{}'), paquet(1, '{"t":"creer"}')]));
  assert.equal((await c.attendre(x => x.opcode === 8)).code, 1002);
  assert.match(await sante(), /0 partie\(s\)/);
});
