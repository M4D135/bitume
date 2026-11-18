// Outils des essais du jeu en ligne : un faux WebRTC en mémoire et un faux relais public (« bus »), pour éprouver le
// maillage, les départs et les invitations sans navigateur ni Internet. Seuls les liaisons et le transport sont
// simulés : src/reseau.js est le vrai, avec son code de partie, ses clés et son chiffrement.
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
require('../src/reseau.js');
export const N = globalThis.BITUME.reseau;
export const dormir = ms => new Promise(r => setTimeout(r, ms));
export async function attendre(condition, ms = 6000, pas = 10) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (condition()) return true; await dormir(pas); }
  return !!condition();
}
// délais du réseau ramenés à quelques dizaines de millisecondes
export const RAPIDE = { ouverture: 2000, collecte: 40, apresSrflx: 8, collecteMain: 40, apresSrflxMain: 20, essai: 1200, coupure: 150, grace: 600, reordre: 200,
  helloInvite: 120, entrer: 80, sansRelais: 700, introuvable: 900, injoignable: 1500, invitation: 8000, reessai: 900, menage: 40,
  etranger: 2500, ls: 400, vus: 5000 };

const ALNUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const alnum = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => ALNUM[x % 62]).join('');
const hexa = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => x.toString(16).padStart(2, '0')).join('');

class Canal {
  constructor(pc, label, id) { Object.assign(this, { pc, label, id, readyState: 'connecting', bufferedAmount: 0, binaryType: 'blob', onopen: null, onclose: null, onmessage: null }); }
  send(d) {
    if (this.readyState !== 'open') throw new Error('InvalidStateError');
    const pc = this.pc, pair = pc.pair;
    pc.net.envois++;
    if (!pair || pc.coupe) return;   // perdu en route
    const autre = pair.canaux.get(this.id);
    const copie = typeof d === 'string' ? d : d instanceof ArrayBuffer ? d.slice(0) : d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
    setTimeout(() => { if (autre && autre.readyState === 'open' && autre.onmessage && !pc.coupe) autre.onmessage({ data: copie }); }, pc.net.latence);
  }
  close() { this.fermer(); }
  ouvrir() { if (this.readyState === 'connecting') { this.readyState = 'open'; if (this.onopen) this.onopen(); } }
  fermer() { if (this.readyState !== 'closed') { this.readyState = 'closed'; if (this.onclose) this.onclose(); } }
}
class PC {
  constructor(cfg, machine, net) {
    Object.assign(this, { cfg, machine, net, canaux: new Map(), pair: null, ufrag: alnum(4), pwd: alnum(24),
      empreinte: hexa(32).toUpperCase().match(/../g).join(':'), type: null, ufragDistant: null, candidats: [], coupe: false,
      localDescription: null, remoteDescription: null, connectionState: 'new', iceConnectionState: 'new', iceGatheringState: 'new',
      onicecandidate: null, onicegatheringstatechange: null, onconnectionstatechange: null, oniceconnectionstatechange: null });
    net.pcs.add(this);
  }
  createDataChannel(label, o = {}) { const c = new Canal(this, label, o.id); this.canaux.set(o.id, c); return c; }
  sdp(type) {
    const l = ['v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0'];
    for (const c of this.candidats) l.push('a=' + c);
    l.push('a=ice-ufrag:' + this.ufrag, 'a=ice-pwd:' + this.pwd, 'a=ice-options:trickle', 'a=fingerprint:sha-256 ' + this.empreinte,
      'a=setup:' + (type === 'offer' ? 'actpass' : 'active'), 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144');
    return l.join('\r\n') + '\r\n';
  }
  async createOffer() { return { type: 'offer', sdp: this.sdp('offer') }; }
  async createAnswer() { if (!this.remoteDescription) throw new Error('InvalidStateError'); return { type: 'answer', sdp: this.sdp('answer') }; }
  async setLocalDescription(d) {
    if (this.connectionState === 'closed') throw new Error('InvalidStateError');
    this.type = d.type;
    this.localDescription = { type: d.type, sdp: this.sdp(d.type) };
    this.collecter();
    this.essayer();
  }
  async setRemoteDescription(d) {
    if (this.connectionState === 'closed') throw new Error('InvalidStateError');
    const m = /a=ice-ufrag:(\S+)/.exec(d && d.sdp || '');
    if (!m) throw new Error('OperationError');
    this.remoteDescription = d; this.ufragDistant = m[1];
    this.essayer();
  }
  async addIceCandidate() {}
  collecter() {
    if (this.iceGatheringState !== 'new') return;
    this.iceGatheringState = 'gathering';
    const n = 2 + (crypto.getRandomValues(new Uint8Array(1))[0] % 250), port = 50000 + n;
    const uuid = hexa(4) + '-' + hexa(2) + '-' + hexa(2) + '-' + hexa(2) + '-' + hexa(6);
    const liste = ['candidate:1 1 udp 2113937151 ' + uuid + '.local ' + port + ' typ host generation 0',
      'candidate:2 1 udp 1677729535 198.51.100.' + n + ' ' + port + ' typ srflx raddr 0.0.0.0 rport 0 generation 0'];
    liste.forEach((c, i) => setTimeout(() => {
      if (this.connectionState === 'closed') return;
      this.candidats.push(c);
      this.localDescription = { type: this.type, sdp: this.sdp(this.type) };
      if (this.onicecandidate) this.onicecandidate({ candidate: { candidate: c, sdpMid: '0', sdpMLineIndex: 0 } });
      if (i === liste.length - 1) setTimeout(() => {
        if (this.connectionState === 'closed') return;
        this.iceGatheringState = 'complete';
        if (this.onicecandidate) this.onicecandidate({ candidate: null });
        if (this.onicegatheringstatechange) this.onicegatheringstatechange();
      }, 2);
    }, 2 + 3 * i));
  }
  etat(e) {
    if (this.connectionState === e || this.connectionState === 'closed') return;
    this.connectionState = e;
    this.iceConnectionState = e === 'connecting' ? 'checking' : e;
    if (this.oniceconnectionstatechange) this.oniceconnectionstatechange();
    if (this.onconnectionstatechange) this.onconnectionstatechange();
  }
  essayer() {
    if (this.pair || !this.localDescription || !this.remoteDescription || this.connectionState === 'closed') return;
    const autre = [...this.net.pcs].find(p => p !== this && !p.pair && p.connectionState !== 'closed' && p.localDescription && p.remoteDescription &&
      p.ufrag === this.ufragDistant && p.ufragDistant === this.ufrag);
    if (!autre) return;
    this.etat('connecting'); autre.etat('connecting');
    if (!this.net.passe(this.machine, autre.machine)) return;   // aucun chemin ICE : la tentative s'éteint d'elle-même
    this.pair = autre; autre.pair = this;
    setTimeout(() => {
      for (const pc of [this, autre]) pc.etat('connected');
      for (const pc of [this, autre]) if (pc.connectionState === 'connected') for (const c of pc.canaux.values()) c.ouvrir();
    }, this.net.latence * 3);
  }
  chemin(passe) {
    if (this.connectionState === 'closed') return;
    if (!passe && !this.coupe) { this.coupe = true; this.etat('disconnected'); }
    else if (passe && this.coupe) { this.coupe = false; this.etat('connected'); }
  }
  close() {
    if (this.connectionState === 'closed') return;
    const pair = this.pair;
    this.connectionState = 'closed'; this.iceConnectionState = 'closed'; this.pair = null;
    for (const c of this.canaux.values()) c.readyState = 'closed';
    this.net.pcs.delete(this);
    if (pair) setTimeout(() => { if (pair.pair === this) pair.pair = null; for (const c of pair.canaux.values()) c.fermer(); }, this.net.latence);
  }
}
export function reseauFactice({ latence = 2 } = {}) {
  const pcs = new Set(), bloques = new Set(), coupees = new Set();
  const cle = (a, b) => [a, b].sort().join('|');
  const net = {
    latence, pcs, envois: 0,
    passe: (a, b) => !coupees.has(a) && !coupees.has(b) && !bloques.has(cle(a, b)),
    // une liaison établie dont le chemin ne passe plus devient « disconnected », et revient quand il repasse
    revoir() { for (const pc of pcs) if (pc.pair) pc.chemin(net.passe(pc.machine, pc.pair.machine)); },
    bloquer(a, b) { bloques.add(cle(a, b)); net.revoir(); },
    debloquer(a, b) { bloques.delete(cle(a, b)); net.revoir(); },
    couper(m) { coupees.add(m); net.revoir(); },
    retablir(m) { coupees.delete(m); net.revoir(); },
    classe(machine) { return class extends PC { constructor(cfg) { super(cfg, machine, net); } }; }
  };
  return net;
}
// Faux relais public : une salle par adresse, livraison à toute la salle ou au seul destinataire.
export function busFactice() {
  const salles = new Map(), pannes = new Set();
  const bus = {
    pannes, messages: 0,
    famille: {
      preparer: (octets, a) => ({ octets, a }),
      ouvrir(url, ctx, r) {
        if (pannes.has(url)) { const m = setTimeout(() => r.ferme(), 5); return { envoyerBrut() {}, fermer() { clearTimeout(m); } }; }
        const k = url + '|' + ctx.salle, moi = { pid: ctx.pid, r };
        if (!salles.has(k)) salles.set(k, new Set());
        const s = salles.get(k);
        s.add(moi);
        setTimeout(() => r.pret(), 2);
        return {
          envoyerBrut(t) { bus.messages++; for (const x of s) if (x !== moi && (!t.a || t.a === x.pid)) setTimeout(() => x.r.recu(t.octets), 3); },
          fermer() { s.delete(moi); }
        };
      }
    }
  };
  N.interne.FAMILLES.bus = bus.famille;
  return bus;
}
// Une machine : le vrai réseau de BITUME sur le faux WebRTC, et le journal de ses événements.
export function machine(net, nom, options = {}) {
  const R = N.creer(Object.assign({ nom, joueurs: 1, RTCPeerConnection: net.classe(nom), relais: { bus: ['bus://un'] }, delais: RAPIDE }, options));
  const j = { salon: [], salle: 0, pair: [], relais: [], parti: [], messages: [], etats: [], ferme: [], statuts: [], erreurs: [] };
  R.on('salon', m => j.salon.push(m)).on('salle', () => j.salle++).on('pair', (id, r) => j.pair.push({ id, relais: r })).on('relais', id => j.relais.push(id))
    .on('parti', id => j.parti.push(id)).on('message', (m, de) => j.messages.push({ m, de })).on('etat', (p, de) => j.etats.push({ p, de }))
    .on('ferme', r => j.ferme.push(r)).on('statut', s => j.statuts.push(s)).on('erreur', e => j.erreurs.push(e));
  return { R, j, nom };
}
// vrai : chaque machine voit toutes les autres prêtes, et autant de membres
export const reunis = (...ms) => ms.every(a => a.R.membres.length === ms.length && a.R.etat === 'connecte' &&
  ms.every(b => b === a || a.R.pretAvec(b.R.id)));
export const direct = (a, b) => { const p = a.R.pairs.get(b.R.id); return !!(p && p.pret && !p.relais); };

// vérification BIP-340 indépendante (arithmétique affine, BigInt)
const P = 2n ** 256n - 2n ** 32n - 977n, NN = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const G = [0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n, 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n];
const md = (a, m = P) => ((a % m) + m) % m;
const puiss = (b, e, m) => { let r = 1n; b = md(b, m); while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
const plus = (p, q) => {
  if (!p) return q; if (!q) return p;
  if (p[0] === q[0] && md(p[1] + q[1]) === 0n) return null;
  const l = p[0] === q[0] ? md(3n * p[0] * p[0] * puiss(2n * p[1], P - 2n, P)) : md((q[1] - p[1]) * puiss(q[0] - p[0], P - 2n, P));
  const x = md(l * l - p[0] - q[0]);
  return [x, md(l * (p[0] - x) - p[1])];
};
const fois = (k, p) => { let r = null; for (; k > 0n; k >>= 1n) { if (k & 1n) r = plus(r, p); p = plus(p, p); } return r; };
const nombre = u => BigInt('0x' + Buffer.from(u).toString('hex'));
const balise = (tag, ...x) => { const t = crypto.createHash('sha256').update(tag).digest(); return crypto.createHash('sha256').update(Buffer.concat([t, t, ...x.map(b => Buffer.from(b))])).digest(); };
export function verifierBip340(pk, message, sig) {
  const x = nombre(pk), c = md(x ** 3n + 7n), y = puiss(c, (P + 1n) / 4n, P);
  if (md(y * y) !== c) return false;
  const point = [x, y % 2n === 0n ? y : P - y], r = nombre(sig.subarray(0, 32)), s = nombre(sig.subarray(32));
  if (r >= P || s >= NN) return false;
  const e = md(nombre(balise('BIP0340/challenge', sig.subarray(0, 32), pk, message)), NN);
  const R = plus(fois(s, G), fois(NN - e, point));
  return !!R && R[1] % 2n === 0n && R[0] === r;
}
