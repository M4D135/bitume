// BITUME — salon du jeu en ligne : met deux pilotes en relation (code de partie à quatre lettres), passe les messages
// de mise en relation WebRTC (offre, réponse, candidats) et relaie la partie quand la liaison directe échoue.
// WebSocket écrit à la main (RFC 6455) : aucune dépendance. Node 18 ou plus.
//
//   PORT=8790 HOTE=127.0.0.1 node serveur/salon.mjs
//
// Derrière Caddy : `handle /salon* { reverse_proxy 127.0.0.1:8790 }` dans le vhost de bitume.estrasse.fr.
// Protocole (texte JSON) : { t: 'creer', nom } → { t: 'salon', code, role: 'hote' } ; { t: 'rejoindre', code, nom } →
// { t: 'salon', code, role: 'invite', autre } à l'invité et { t: 'arrivee', nom } à l'hôte ; { t: 'signal' | 'relais',
// … } passent tels quels à l'autre ; un message binaire (état des voitures) est relayé tel quel ; à la fermeture,
// l'autre reçoit { t: 'parti' }. Une partie a deux places et disparaît avec son dernier pilote.

import http from 'node:http';
import crypto from 'node:crypto';

const PORT = +(process.env.PORT || 8790), HOTE = process.env.HOTE || '127.0.0.1';
const MAX_OCTETS = 64 * 1024, LETTRES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
// Garde-fous d'un service public : 600 connexions au plus, 24 par adresse, 240 messages par seconde et par pilote
// (une partie en envoie environ 65) ; au-delà, les messages sont perdus, et un flot continu ferme la connexion.
const MAX_CLIENTS = 600, MAX_PAR_IP = 24, DEBIT = 240, RAFALE = 480;
const salons = new Map();   // code → [hôte, invité]
const parIp = new Map();
let clients = 0;

function trame(opcode, donnees) {
  const n = donnees.length, entete = n < 126 ? Buffer.from([0x80 | opcode, n]) : n < 65536
    ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x80 | opcode, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
  return Buffer.concat([entete, donnees]);
}
function envoyer(c, x) {
  if (!c || c.ferme) return;
  try { c.socket.write(Buffer.isBuffer(x) ? trame(2, x) : trame(1, Buffer.from(JSON.stringify(x)))); } catch (e) { /* fermé */ }
}
function fermer(c) {
  if (c.ferme) return;
  c.ferme = true;
  try { c.socket.end(trame(8, Buffer.alloc(0))); } catch (e) { /* déjà fermé */ }
  const s = c.code && salons.get(c.code);
  if (s) {
    const autre = s.find(x => x && x !== c);
    if (autre) envoyer(autre, { t: 'parti' });
    const reste = s.filter(x => x && x !== c && !x.ferme);
    if (reste.length) salons.set(c.code, [reste[0]]); else salons.delete(c.code);
    if (reste.length) reste[0].role = 'hote';
  }
}
function nouveauCode() {
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i++) code += LETTRES[crypto.randomInt(LETTRES.length)];
    if (!salons.has(code)) return code;
  }
}
function recevoir(c, opcode, donnees) {
  if (opcode === 8) return fermer(c);
  if (opcode === 9) { try { c.socket.write(trame(10, donnees)); } catch (e) { /* fermé */ } return; }
  if (opcode === 10) { c.vivant = true; return; }
  const t = Date.now();
  c.jetons = Math.min(RAFALE, c.jetons + (t - c.tJetons) * DEBIT / 1000); c.tJetons = t;
  if (c.jetons < 1) { if (++c.exces > 5 * DEBIT) { fermer(c); c.socket.destroy(); } return; }
  c.jetons--; c.exces = 0;
  const autre = c.code && (salons.get(c.code) || []).find(x => x && x !== c);
  if (opcode === 2) { if (autre) envoyer(autre, donnees); return; }       // état des voitures, relayé
  if (opcode !== 1) return;
  let m; try { m = JSON.parse(donnees.toString('utf8')); } catch (e) { return; }
  const nom = String(m.nom || '').slice(0, 24);
  if (m.t === 'creer' && !c.code) {
    c.code = nouveauCode(); c.role = 'hote'; c.nom = nom || 'Pilote 1';
    salons.set(c.code, [c]);
    envoyer(c, { t: 'salon', code: c.code, role: 'hote' });
  } else if (m.t === 'rejoindre' && !c.code) {
    const code = String(m.code || '').toUpperCase(), s = salons.get(code);
    if (!s) return envoyer(c, { t: 'erreur', message: 'Aucune partie avec ce code.' });
    if (s.length >= 2) return envoyer(c, { t: 'erreur', message: 'Cette partie est déjà complète.' });
    c.code = code; c.role = 'invite'; c.nom = nom || 'Pilote 2'; s.push(c);
    envoyer(c, { t: 'salon', code, role: 'invite', autre: s[0].nom });
    envoyer(s[0], { t: 'arrivee', nom: c.nom });
  } else if ((m.t === 'signal' || m.t === 'relais') && autre) envoyer(autre, m);
}

const serveur = http.createServer((req, res) => {
  res.writeHead(req.url === '/salon/sante' ? 200 : 404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end(req.url === '/salon/sante' ? `salon BITUME : ${salons.size} partie(s), ${clients} pilote(s)\n` : 'introuvable\n');
});
serveur.on('upgrade', (req, socket) => {
  const cle = req.headers['sec-websocket-key'];
  if (!req.url.startsWith('/salon') || !cle) { socket.destroy(); return; }
  // derrière Caddy (le salon n'écoute que 127.0.0.1), l'adresse du pilote est la première de X-Forwarded-For
  const ip = String(req.headers['x-forwarded-for'] || socket.remoteAddress || '').split(',')[0].trim();
  if (clients >= MAX_CLIENTS || (parIp.get(ip) || 0) >= MAX_PAR_IP) { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); return; }
  clients++; parIp.set(ip, (parIp.get(ip) || 0) + 1);
  let libere = false;
  const liberer = () => { if (libere) return; libere = true; clients--; const n = (parIp.get(ip) || 1) - 1; if (n > 0) parIp.set(ip, n); else parIp.delete(ip); };
  const accepte = crypto.createHash('sha1').update(cle + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accepte + '\r\n\r\n');
  socket.setNoDelay(true);
  const c = { socket, code: null, role: null, nom: '', ferme: false, vivant: true, tampon: Buffer.alloc(0), fragments: [], opFragment: 0, jetons: RAFALE, tJetons: Date.now(), exces: 0 };
  socket.on('data', morceau => {
    c.tampon = Buffer.concat([c.tampon, morceau]);
    for (;;) {
      const b = c.tampon;
      if (b.length < 2) return;
      const fin = b[0] & 0x80, opcode = b[0] & 15, masque = b[1] & 0x80;
      let n = b[1] & 127, o = 2;
      if (n === 126) { if (b.length < 4) return; n = b.readUInt16BE(2); o = 4; }
      else if (n === 127) { if (b.length < 10) return; n = Number(b.readBigUInt64BE(2)); o = 10; }
      if (n > MAX_OCTETS) { fermer(c); socket.destroy(); return; }
      if (!masque) { fermer(c); return; }                 // un client masque toujours ses trames
      if (b.length < o + 4 + n) return;
      const m = b.subarray(o, o + 4), donnees = Buffer.from(b.subarray(o + 4, o + 4 + n));
      for (let i = 0; i < n; i++) donnees[i] ^= m[i & 3];
      c.tampon = b.subarray(o + 4 + n);
      if (opcode === 0) { c.fragments.push(donnees); if (fin) { recevoir(c, c.opFragment, Buffer.concat(c.fragments)); c.fragments = []; } }
      else if (!fin && opcode < 8) { c.opFragment = opcode; c.fragments = [donnees]; }
      else recevoir(c, opcode, donnees);
    }
  });
  socket.on('close', () => { fermer(c); liberer(); });
  socket.on('error', () => { fermer(c); liberer(); });
  const veille = setInterval(() => {
    if (c.ferme) { clearInterval(veille); return; }
    if (!c.vivant) { fermer(c); socket.destroy(); clearInterval(veille); return; }
    c.vivant = false;
    try { socket.write(trame(9, Buffer.alloc(0))); } catch (e) { /* fermé */ }
  }, 20000);
});
serveur.listen(PORT, HOTE, () => console.log(`salon BITUME à l'écoute sur ${HOTE}:${PORT}`));
