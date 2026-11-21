// BITUME — salon du jeu en ligne : met de deux à quatre machines en relation (code de partie à quatre lettres), passe
// leurs messages de mise en relation WebRTC (offre, réponse, candidats) et relaie la partie entre deux machines dont la
// liaison directe échoue. Quatre pilotes au plus, une ou deux par machine (écran partagé). WebSocket écrit à la main
// (RFC 6455) : aucune dépendance. Node 18 ou plus.
//
//   PORT=8790 HOTE=127.0.0.1 node serveur/salon.mjs
//
// Derrière Caddy : `handle /salon* { reverse_proxy 127.0.0.1:8790 }` dans le vhost de bitume.estrasse.fr.
// Protocole (texte JSON) : { t: 'creer', nom, joueurs } → { t: 'salon', code, id: 0, role: 'hote' } ;
// { t: 'rejoindre', code, nom, joueurs } → { t: 'salon', code, id, role: 'invite' } ; à chaque arrivée ou départ, tous
// reçoivent { t: 'salle', membres: [{ id, nom, joueurs }] } ; { t: 'signal', a, … } et { t: 'relais', a?, m } vont à la
// machine a (relais sans a : à toutes), avec de = l'expéditeur. Message binaire : [destinataire (255 : toutes)] + état
// des voitures, relayé avec l'expéditeur à la place du destinataire. Au départ d'une machine : { t: 'parti', id } ; sans
// son hôte (id 0), la partie s'arrête ({ t: 'parti', id: 0, hote: true }).

import http from 'node:http';
import crypto from 'node:crypto';
import { creerCompteurVisites, creerRouteVisites } from './visites.mjs';

const PORT = +(process.env.PORT || 8790), HOTE = process.env.HOTE || '127.0.0.1';
const MAX_OCTETS = 64 * 1024, MAX_FRAGMENTS = 1024, LETTRES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
// Garde-fous d'un service public : 600 connexions au plus, 24 par adresse, 240 messages par seconde et par pilote
// (une partie en envoie environ 65) ; au-delà, les messages sont perdus, et un flot continu ferme la connexion.
const MAX_CLIENTS = 600, MAX_PAR_IP = 24, DEBIT = 240, RAFALE = 480;
const MAX_MACHINES = 4, MAX_PILOTES = 4;
const salons = new Map();   // code → { membres: Map(id → machine), prochain }
const parIp = new Map();
let clients = 0;
const utf8 = new TextDecoder('utf-8', { fatal: true });

function trame(opcode, donnees) {
  const n = donnees.length, entete = n < 126 ? Buffer.from([0x80 | opcode, n]) : n < 65536
    ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x80 | opcode, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
  return Buffer.concat([entete, donnees]);
}
function envoyer(c, x) {
  if (!c || c.ferme) return;
  try { c.socket.write(Buffer.isBuffer(x) ? trame(2, x) : trame(1, Buffer.from(JSON.stringify(x)))); } catch (e) { /* fermé */ }
}
const propre = (t, n) => String(t || '').replace(/[<>&"'`\\]/g, '').trim().slice(0, n);
const pilotes = s => { let n = 0; for (const m of s.membres.values()) n += m.joueurs; return n; };
function diffuser(s, x, sauf) { for (const m of s.membres.values()) if (m !== sauf) envoyer(m, x); }
function salle(s) { diffuser(s, { t: 'salle', membres: [...s.membres.values()].map(m => ({ id: m.id, nom: m.nom, joueurs: m.joueurs })) }); }
function fermer(c, code = 1000) {
  if (c.ferme) return;
  c.ferme = true;
  clearInterval(c.veille);
  c.tampon = Buffer.alloc(0); c.fragments = []; c.opFragment = 0; c.octetsFragments = 0;
  // Un pair qui n'acquitte jamais la fermeture ne doit pas conserver sa place indéfiniment.
  const motif = Buffer.alloc(2); motif.writeUInt16BE(code);
  try { c.socket.end(trame(8, motif)); } catch (e) { /* déjà fermé */ }
  c.finFermeture = setTimeout(() => c.socket.destroy(), 1000);
  c.finFermeture.unref();
  const s = c.code && salons.get(c.code);
  if (!s || s.membres.get(c.id) !== c) return;
  s.membres.delete(c.id);
  if (c.id === 0 || !s.membres.size) { diffuser(s, { t: 'parti', id: c.id, hote: c.id === 0 }); salons.delete(c.code); }
  else { diffuser(s, { t: 'parti', id: c.id }); salle(s); }
}
function nouveauCode() {
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i++) code += LETTRES[crypto.randomInt(LETTRES.length)];
    if (!salons.has(code)) return code;
  }
}
function recevoir(c, opcode, donnees) {
  if (c.ferme) return;
  if (opcode === 8) {
    if (donnees.length === 1) return fermer(c, 1002);
    if (donnees.length >= 2) {
      const code = donnees.readUInt16BE(0);
      if (!((code >= 1000 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999)))
        return fermer(c, 1002);
      try { utf8.decode(donnees.subarray(2)); } catch { return fermer(c, 1007); }
    }
    return fermer(c);
  }
  if (opcode === 9) { try { c.socket.write(trame(10, donnees)); } catch (e) { /* fermé */ } return; }
  if (opcode === 10) { c.vivant = true; return; }
  const t = Date.now();
  c.jetons = Math.min(RAFALE, c.jetons + (t - c.tJetons) * DEBIT / 1000); c.tJetons = t;
  if (c.jetons < 1) { if (++c.exces > 5 * DEBIT) { fermer(c); c.socket.destroy(); } return; }
  c.jetons--; c.exces = 0;
  const candidat = c.code && salons.get(c.code);
  const s = candidat && candidat.membres.get(c.id) === c ? candidat : null;
  if (opcode === 2) {   // état des voitures : le premier octet passe du destinataire à l'expéditeur
    if (!s || donnees.length < 2) return;
    const a = donnees[0]; donnees[0] = c.id;
    for (const m of s.membres.values()) if (m !== c && (a === 255 || m.id === a)) envoyer(m, donnees);
    return;
  }
  if (opcode !== 1) return;
  let texte;
  try { texte = utf8.decode(donnees); } catch { return fermer(c, 1007); }
  let m; try { m = JSON.parse(texte); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  const nom = propre(m.nom, 16), joueurs = m.joueurs === 2 ? 2 : 1;
  if (m.t === 'creer' && !c.code) {
    c.code = nouveauCode(); c.id = 0; c.role = 'hote'; c.nom = nom || 'Pilote 1'; c.joueurs = joueurs;
    const nv = { membres: new Map([[0, c]]), prochain: 1 };
    salons.set(c.code, nv);
    envoyer(c, { t: 'salon', code: c.code, id: 0, role: 'hote' });
    salle(nv);
  } else if (m.t === 'rejoindre' && !c.code) {
    const code = String(m.code || '').toUpperCase(), s2 = salons.get(code);
    if (!s2) return envoyer(c, { t: 'erreur', message: 'Aucune partie avec ce code.' });
    if (s2.membres.size >= MAX_MACHINES || pilotes(s2) + joueurs > MAX_PILOTES) return envoyer(c, { t: 'erreur', message: 'Cette partie est complète : quatre pilotes au plus.' });
    c.code = code; c.id = s2.prochain++; c.role = 'invite'; c.nom = nom || 'Pilote ' + (s2.membres.size + 1); c.joueurs = joueurs;
    s2.membres.set(c.id, c);
    envoyer(c, { t: 'salon', code, id: c.id, role: 'invite' });
    salle(s2);
  } else if (m.t === 'profil' && s) {
    if (nom) c.nom = nom;
    if (pilotes(s) - c.joueurs + joueurs <= MAX_PILOTES) c.joueurs = joueurs;
    salle(s);
  } else if ((m.t === 'signal' || m.t === 'relais') && s) {
    const x = Object.assign({}, m, { de: c.id });
    if (m.a === undefined || m.a === null) { if (m.t === 'relais') diffuser(s, x, c); }
    else { const cible = s.membres.get(m.a); if (cible && cible !== c) envoyer(cible, x); }
  }
}

const repondreVisites = creerRouteVisites(creerCompteurVisites());
const serveur = http.createServer((req, res) => {
  if (req.url === '/salon/visites') { void repondreVisites(req, res); return; }
  res.writeHead(req.url === '/salon/sante' ? 200 : 404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end(req.url === '/salon/sante' ? `salon BITUME : ${salons.size} partie(s), ${clients} machine(s)\n` : 'introuvable\n');
});
serveur.on('upgrade', (req, socket, tete) => {
  const cle = req.headers['sec-websocket-key'];
  const chemin = (req.url || '').split('?')[0];
  if (req.method !== 'GET' || !['/salon', '/salon/'].includes(chemin) ||
      String(req.headers.upgrade || '').toLowerCase() !== 'websocket' ||
      req.headers['sec-websocket-version'] !== '13' || typeof cle !== 'string' ||
      !/^[A-Za-z0-9+/]{22}==$/.test(cle) || Buffer.from(cle, 'base64').length !== 16 ||
      Buffer.from(cle, 'base64').toString('base64') !== cle) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    return;
  }
  // derrière Caddy (le salon n'écoute que 127.0.0.1), l'adresse du pilote est la première de X-Forwarded-For
  const ip = String(req.headers['x-forwarded-for'] || socket.remoteAddress || '').split(',')[0].trim();
  if (clients >= MAX_CLIENTS || (parIp.get(ip) || 0) >= MAX_PAR_IP) { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); return; }
  clients++; parIp.set(ip, (parIp.get(ip) || 0) + 1);
  let libere = false;
  const liberer = () => { if (libere) return; libere = true; clients--; const n = (parIp.get(ip) || 1) - 1; if (n > 0) parIp.set(ip, n); else parIp.delete(ip); };
  const accepte = crypto.createHash('sha1').update(cle + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accepte + '\r\n\r\n');
  socket.setNoDelay(true);
  const c = { socket, code: null, role: null, nom: '', ferme: false, vivant: true, tampon: Buffer.alloc(0),
    fragments: [], opFragment: 0, octetsFragments: 0, nbFragments: 0,
    jetons: RAFALE, tJetons: Date.now(), exces: 0, veille: null, finFermeture: null };
  const protocole = code => fermer(c, code);
  function lire(morceau) {
    if (c.ferme) return;
    c.tampon = c.tampon.length ? Buffer.concat([c.tampon, morceau]) : morceau;
    while (!c.ferme) {
      const b = c.tampon;
      if (b.length < 2) return;
      const fin = !!(b[0] & 0x80), opcode = b[0] & 15, masque = b[1] & 0x80;
      if ((b[0] & 0x70) || ![0, 1, 2, 8, 9, 10].includes(opcode) || !masque) return protocole(1002);
      const controle = opcode >= 8;
      let n = b[1] & 127, o = 2;
      if (controle && (!fin || n > 125)) return protocole(1002);
      if (n === 126) {
        if (b.length < 4) return;
        n = b.readUInt16BE(2); o = 4;
        if (n < 126) return protocole(1002);
      } else if (n === 127) {
        if (b.length < 10) return;
        const taille = b.readBigUInt64BE(2);
        if (taille < 65536n || taille >= 0x8000000000000000n) return protocole(1002);
        if (taille > BigInt(MAX_OCTETS)) return protocole(1009);
        n = Number(taille); o = 10;
      }
      if (n > MAX_OCTETS) return protocole(1009);
      if (!controle) {
        // Une seule séquence fragmentée peut être ouverte ; les contrôles s'y intercalent sans la modifier.
        if ((opcode === 0 && !c.opFragment) || (opcode !== 0 && c.opFragment)) return protocole(1002);
        if (opcode === 0 && (c.octetsFragments + n > MAX_OCTETS || c.nbFragments >= MAX_FRAGMENTS))
          return protocole(1009);
      }
      if (b.length < o + 4 + n) return;
      const masqueOctets = b.subarray(o, o + 4), donnees = Buffer.from(b.subarray(o + 4, o + 4 + n));
      for (let i = 0; i < n; i++) donnees[i] ^= masqueOctets[i & 3];
      c.tampon = b.subarray(o + 4 + n);
      if (opcode === 0) {
        c.nbFragments++; c.octetsFragments += n;
        if (n) c.fragments.push(donnees);
        if (fin) {
          const op = c.opFragment, message = Buffer.concat(c.fragments, c.octetsFragments);
          c.fragments = []; c.opFragment = 0; c.octetsFragments = 0; c.nbFragments = 0;
          recevoir(c, op, message);
        }
      } else if (!fin && !controle) {
        c.opFragment = opcode; c.fragments = n ? [donnees] : []; c.octetsFragments = n; c.nbFragments = 1;
      } else recevoir(c, opcode, donnees);
    }
  }
  socket.on('data', lire);
  // Les sockets HTTP promues restent en semi-ouverture : un simple FIN TCP doit aussi libérer le salon.
  socket.on('end', () => { fermer(c); socket.destroy(); });
  socket.on('close', () => { fermer(c); clearTimeout(c.finFermeture); liberer(); });
  socket.on('error', () => { fermer(c); socket.destroy(); liberer(); });
  c.veille = setInterval(() => {
    if (c.ferme) return;
    if (!c.vivant) { fermer(c); socket.destroy(); return; }
    c.vivant = false;
    try { socket.write(trame(9, Buffer.alloc(0))); } catch (e) { fermer(c); socket.destroy(); }
  }, 20000);
  // Node peut avoir déjà lu la première trame en même temps que les en-têtes HTTP.
  if (tete && tete.length) lire(tete);
});
serveur.listen(PORT, HOTE, () => console.log(`salon BITUME à l'écoute sur ${HOTE}:${PORT}`));
