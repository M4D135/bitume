// Clients des relais publics de src/reseau.js face à de faux serveurs en mémoire, derrière un faux WebSocket : un
// courtier MQTT 3.1.1, un traqueur WebTorrent et un relais Nostr qui vérifie les signatures. On éprouve la diffusion
// et les messages adressés de chaque nature, le dédoublonnage quand tout passe partout, la reprise après une coupure,
// le repli après un refus, la pause d'un relais qui limite le débit, les trames étrangères écartées, et deux machines
// qui se joignent par le code sur ces trois natures. Les vrais relais sont éprouvés par tools/essai-enligne.mjs.
import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import crypto from 'node:crypto';
import { N, RAPIDE, attendre, dormir, reseauFactice, machine, reunis, direct, verifierBip340 } from './outils-reseau.mjs';

const I = N.interne;
const ALNUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const pidNeuf = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), x => ALNUM[x % 62]).join('');

// ------------------------------------------------ faux WebSocket : une adresse, un serveur en mémoire
function monde({ latence = 1 } = {}) {
  const serveurs = new Map(), sockets = [];
  const copie = d => typeof d === 'string' ? d : Uint8Array.from(d instanceof ArrayBuffer ? new Uint8Array(d) : d);
  class Connexion {
    constructor(ws, s) { Object.assign(this, { ws, s, ouverte: true, surMessage: null, surFermeture: null }); }
    envoyer(d) {   // du serveur vers le client : texte, ou ArrayBuffer comme un navigateur réglé sur « arraybuffer »
      if (!this.ouverte) return;
      const ws = this.ws, u = copie(d), data = typeof u === 'string' ? u : u.buffer;
      setTimeout(() => { if (ws.readyState === 1 && ws.onmessage) ws.onmessage({ data }); }, latence);
    }
    fermer() {   // coupure côté serveur
      if (!this.ouverte) return;
      this.ouverte = false; this.s.connexions.delete(this);
      if (this.surFermeture) this.surFermeture();
      setTimeout(() => this.ws.coupe(), latence);
    }
  }
  class FauxWS {
    constructor(url, protocoles) {
      Object.assign(this, { url, readyState: 0, binaryType: 'blob', protocol: '', onopen: null, onmessage: null, onclose: null, onerror: null, conn: null });
      sockets.push(this);
      const s = serveurs.get(url), liste = [].concat(protocoles || []);
      setTimeout(() => {
        if (this.readyState !== 0) return;
        if (!s || s.hors) { this.readyState = 3; if (this.onerror) this.onerror({}); if (this.onclose) this.onclose({ code: 1006 }); return; }
        this.conn = new Connexion(this, s);
        s.connexions.add(this.conn); s.ouvertures++;
        this.readyState = 1; this.protocol = liste[0] || '';
        s.accueil(this.conn, liste);
        if (this.onopen) this.onopen({});
      }, latence);
    }
    send(d) {
      if (this.readyState === 0) throw new Error('InvalidStateError');
      if (this.readyState !== 1) return;
      const c = this.conn, u = copie(d);
      setTimeout(() => { if (c.ouverte && c.surMessage) c.surMessage(u); }, latence);
    }
    close() {
      if (this.readyState >= 2) return;
      this.readyState = 2;
      const c = this.conn;
      if (c && c.ouverte) { c.ouverte = false; c.s.connexions.delete(c); if (c.surFermeture) c.surFermeture(); }
      setTimeout(() => this.coupe(), latence);
    }
    coupe() { if (this.readyState === 3) return; this.readyState = 3; if (this.onclose) this.onclose({ code: 1006 }); }
  }
  return {
    WS: FauxWS, serveurs, sockets,
    serveur(url, accueil) {
      const s = { url, accueil, connexions: new Set(), ouvertures: 0, hors: false, couper() { for (const c of [...s.connexions]) c.fermer(); } };
      serveurs.set(url, s);
      return s;
    }
  };
}

// ------------------------------------------------ faux courtier MQTT 3.1.1
const longueurMqtt = n => { const r = []; do { let b = n % 128; n = Math.floor(n / 128); if (n) b |= 128; r.push(b); } while (n); return Buffer.from(r); };
const trameMqtt = (tete, corps) => Buffer.concat([Buffer.from([tete]), longueurMqtt(corps.length), corps]);
const chaineMqtt = t => { const b = Buffer.from(t); return Buffer.concat([Buffer.from([b.length >> 8, b.length & 255]), b]); };
const lireChaine = (u, p) => { const n = u[p] << 8 | u[p + 1]; return [Buffer.from(u.subarray(p + 2, p + 2 + n)).toString(), p + 2 + n]; };
// o.morceaux : trames rendues en morceaux de n octets ; o.qos1 : livraison en QoS 1 (accusé attendu) ; o.identifiants ;
// o.refuser : connexion refusée ; o.refuserAbonnement ; o.muet : jamais de réponse à la connexion
function courtier(M, url, o = {}) {
  const abonnes = new Map();
  const s = M.serveur(url, (conn, protocoles) => {
    if (!protocoles.includes('mqtt')) { conn.fermer(); return; }
    let tampon = Buffer.alloc(0), file = [], prevu = false, idPaquet = 0;
    const sujets = new Set();
    // les trames d'un même tour partent collées dans un seul message WebSocket, ou coupées en morceaux
    const vider = () => {
      prevu = false;
      const tout = Buffer.concat(file.splice(0));
      if (o.morceaux) for (let i = 0; i < tout.length; i += o.morceaux) conn.envoyer(tout.subarray(i, i + o.morceaux));
      else conn.envoyer(tout);
    };
    conn.pousser = t => { file.push(t); if (!prevu) { prevu = true; setTimeout(vider, 0); } };
    conn.livrer = (sujet, charge) => {
      if (!o.qos1) { conn.pousser(trameMqtt(0x30, Buffer.concat([chaineMqtt(sujet), charge]))); return; }
      idPaquet = idPaquet % 65535 + 1; s.attendus++;
      conn.pousser(trameMqtt(0x32, Buffer.concat([chaineMqtt(sujet), Buffer.from([idPaquet >> 8, idPaquet & 255]), charge])));
    };
    conn.surFermeture = () => { for (const t of sujets) if (abonnes.has(t)) abonnes.get(t).delete(conn); };
    const traiter = (tete, corps) => {
      const type = tete >> 4;
      if (type === 1) {   // CONNECT
        let [nom, p] = lireChaine(corps, 0), id, util = null, mdp = null;
        const niveau = corps[p], drapeaux = corps[p + 1];
        [id, p] = lireChaine(corps, p + 4);
        if (drapeaux & 0x80) [util, p] = lireChaine(corps, p);
        if (drapeaux & 0x40) [mdp, p] = lireChaine(corps, p);
        s.connexionsMqtt.push({ nom, niveau, drapeaux, id, util, mdp });
        if (o.muet) return;
        const rc = nom !== 'MQTT' || niveau !== 4 ? 1 : o.identifiants && (util !== o.identifiants[0] || mdp !== o.identifiants[1]) ? 4 : o.refuser ? 5 : 0;
        conn.pousser(Buffer.from([0x20, 2, 0, rc]));
        if (rc) setTimeout(() => conn.fermer(), 5);
      } else if (type === 8) {   // SUBSCRIBE
        const codes = [];
        for (let p = 2; p < corps.length;) {
          let t;
          [t, p] = lireChaine(corps, p); p++;
          if (o.refuserAbonnement) { codes.push(0x80); continue; }
          if (!abonnes.has(t)) abonnes.set(t, new Set());
          abonnes.get(t).add(conn); sujets.add(t); codes.push(0);
        }
    conn.pousser(Buffer.concat([Buffer.from([0x90, 2 + codes.length]), Buffer.from(corps.subarray(0, 2)), Buffer.from(codes)]));
    if (o.demesure) conn.pousser(Buffer.from([0x30, 0x80, 0x80, 0x40]));
  } else if (type === 3) {   // PUBLISH (QoS 0 côté client), rendu à tous les abonnés du sujet, l'auteur compris
        const [t, p] = lireChaine(corps, 0), charge = Buffer.from(corps.subarray(p));
        s.publications++;
        for (const c of abonnes.get(t) || []) c.livrer(t, charge);
      } else if (type === 4) s.accuses++;
      else if (type === 12) conn.pousser(Buffer.from([0xD0, 0]));
      else if (type === 14) conn.fermer();
    };
    conn.surMessage = d => {
      tampon = Buffer.concat([tampon, Buffer.from(d)]);
      for (;;) {
        if (tampon.length < 2) return;
        let lng = 0, mult = 1, i = 1, b = 128;
        while (i < tampon.length && b & 128) { b = tampon[i++]; lng += (b & 127) * mult; mult *= 128; }
        if (b & 128 || tampon.length < i + lng) return;
        const tete = tampon[0], corps = tampon.subarray(i, i + lng);
        tampon = tampon.subarray(i + lng);
        traiter(tete, corps);
      }
    };
  });
  return Object.assign(s, { publications: 0, accuses: 0, attendus: 0, connexionsMqtt: [], abonnes,
    injecter(sujet, charge) { for (const c of abonnes.get(sujet) || []) c.livrer(sujet, Buffer.from(charge)); } });
}

// ------------------------------------------------ faux traqueur WebTorrent (comme bittorrent-tracker)
// chaque offre d'une annonce va à un autre pair de l'essaim, au plus numwant ; o.refus : « failure reason »
function traqueur(M, url, o = {}) {
  const essaims = new Map(), journal = [];
  const s = M.serveur(url, conn => {
    const miens = new Set();
    conn.surFermeture = () => { for (const x of miens) { const [h, p] = x.split('\n'), e = essaims.get(h); if (e && e.get(p) === conn) e.delete(p); } };
    conn.surMessage = d => {
      let m;
      try { m = JSON.parse(typeof d === 'string' ? d : Buffer.from(d).toString()); } catch (e) { return; }
      if (!m || m.action !== 'announce') return;
      journal.push(m);
      if (o.refus) { conn.envoyer(JSON.stringify({ action: 'announce', 'failure reason': o.refus, info_hash: m.info_hash })); return; }
      if (!essaims.has(m.info_hash)) essaims.set(m.info_hash, new Map());
      const e = essaims.get(m.info_hash);
      e.set(m.peer_id, conn); miens.add(m.info_hash + '\n' + m.peer_id);
      conn.envoyer(JSON.stringify({ action: 'announce', interval: 120, info_hash: m.info_hash, complete: 0, incomplete: e.size }));
      if (!Array.isArray(m.offers)) return;
      const autres = [...e].filter(([p]) => p !== m.peer_id).sort(() => Math.random() - 0.5);
      m.offers.slice(0, Math.min(autres.length, m.numwant == null ? 50 : m.numwant)).forEach((x, i) => {
        s.offres++;
        autres[i][1].envoyer(JSON.stringify({ action: 'announce', info_hash: m.info_hash, peer_id: m.peer_id, offer_id: x.offer_id, offer: x.offer }));
      });
    };
  });
  return Object.assign(s, { offres: 0, journal, essaims,
    injecter(hash, texte) { for (const c of (essaims.get(hash) || new Map()).values()) c.envoyer(texte); } });
}

// ------------------------------------------------ faux relais Nostr (NIP-01) : identifiant et signature vérifiés
// Attente longue : la vérification des signatures Nostr par les faux relais coûte une soixantaine de ms chacune ; sur une
// machine très chargée (autres travaux en parallèle), ces essais ralentissent sans être faux. L'attente rend la main dès
// que la condition est vraie.
const LONG = 30000;
const verifies = new Map();   // une signature vérifiée une seule fois pour tous les relais (une soixantaine de ms)
const correspond = (f, ev) => (!f.kinds || f.kinds.includes(ev.kind)) && (!f.since || ev.created_at >= f.since) &&
  Object.keys(f).filter(k => k[0] === '#').every(k => ev.tags.some(t => t[0] === k.slice(1) && f[k].includes(t[1])));
// o.fermer : abonnement refusé (CLOSED) ; o.refus : tout événement refusé ; o.limite : débit limité au-delà de n
function relaisNostr(M, url, o = {}) {
  const abos = new Set(), deja = new Set(), recus = [];
  const s = M.serveur(url, conn => {
    conn.surFermeture = () => { for (const a of [...abos]) if (a.conn === conn) abos.delete(a); };
    conn.surMessage = d => {
      let m;
      try { m = JSON.parse(String(d)); } catch (e) { conn.envoyer(JSON.stringify(['NOTICE', 'invalid: not json'])); return; }
      if (!Array.isArray(m)) return;
      if (m[0] === 'REQ') {
        s.abonnements++;
        if (o.fermer) { conn.envoyer(JSON.stringify(['CLOSED', m[1], o.fermer])); return; }
        abos.add({ conn, sub: m[1], filtres: m.slice(2) });
        conn.envoyer(JSON.stringify(['EOSE', m[1]]));
      } else if (m[0] === 'CLOSE') {
        for (const a of [...abos]) if (a.conn === conn && a.sub === m[1]) abos.delete(a);
      } else if (m[0] === 'EVENT') {
        const ev = m[1], ok = (oui, raison = '') => conn.envoyer(JSON.stringify(['OK', ev && ev.id, oui, raison]));
        s.evenements++;
        const id = crypto.createHash('sha256').update(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content])).digest('hex');
        if (id !== ev.id) return ok(false, 'invalid: bad event id');
        if (!verifies.has(id)) verifies.set(id, verifierBip340(Buffer.from(ev.pubkey, 'hex'), Buffer.from(id, 'hex'), Buffer.from(ev.sig, 'hex')));
        if (!verifies.get(id)) return ok(false, 'invalid: bad signature');
        if (o.refus) return ok(false, o.refus);
        if (o.limite != null && s.acceptes >= o.limite) return ok(false, 'rate-limited: slow down');
        if (deja.has(id)) return ok(false, 'duplicate: already have this event');
        deja.add(id); s.acceptes++; recus.push(ev);
        ok(true);
        for (const a of abos) if (a.filtres.some(f => correspond(f, ev))) { s.livres++; a.conn.envoyer(JSON.stringify(['EVENT', a.sub, ev])); }
      }
    };
  });
  return Object.assign(s, { abonnements: 0, evenements: 0, acceptes: 0, livres: 0, recus, abos,
    injecter(texte) { for (const a of abos) a.conn.envoyer(typeof texte === 'function' ? texte(a.sub) : texte); } });
}

// ------------------------------------------------ participants au rendez-vous
const ouverts = [];
afterEach(async () => { for (const x of ouverts.splice(0)) x.fermer(); await dormir(30); });
async function salle(code = N.code.nouveau()) { return Object.assign({ code }, await I.deriverSalle(code)); }
function participant(c, M, familles, delais = {}) {
  const sockets = [];
  const WS = class extends M.WS { constructor(...x) { super(...x); sockets.push(this); } };
  const ctx = Object.assign({}, c, { pid: pidNeuf(), WS, delais: Object.assign({}, I.DELAIS, delais), familles, pubNostr: null });
  ctx.cleNostr = () => ctx.cleNostr.p || (ctx.cleNostr.p = Promise.resolve().then(() => {
    const k = I.secp().cle(crypto.getRandomValues(new Uint8Array(32)));
    k.pub = I.hex(k.px); ctx.pubNostr = k.pub;
    return k;
  }));
  const recus = [], changes = [];
  const rv = I.rendezVous(ctx, {
    message: (m, p, L) => recus.push({ m, p, famille: L.famille, url: L.url }),
    change: L => changes.push({ famille: L.famille, url: L.url, pret: L.pret, refus: L.refus })
  });
  ouverts.push(rv);
  const prets = () => rv.etat().filter(l => l.pret);
  return { ctx, rv, recus, changes, sockets, pid: ctx.pid, prets, lien: url => rv.etat().find(l => l.url === url.split(' ')[0]) };
}
const tous = (ps, n) => attendre(() => ps.every(p => p.prets().length === n), LONG);
const textes = p => p.recus.map(x => x.m.t + (x.m.n == null ? '' : x.m.n));

test('MQTT : diffusion, message adressé, trames coupées ou collées, QoS 1, identifiants', async () => {
  const M = monde(), c = await salle();
  const m1 = courtier(M, 'wss://m1.test/mqtt', { morceaux: 7 }), m2 = courtier(M, 'wss://m2.test/mqtt', { qos1: true });
  const m3 = courtier(M, 'wss://m3.test/mqtt', { identifiants: ['public', 'public'] });
  const familles = { mqtt: ['wss://m1.test/mqtt', 'wss://m2.test/mqtt', 'wss://m3.test/mqtt public public'] };
  const [A, B, C] = [0, 1, 2].map(() => participant(c, M, familles));
  assert.ok(await tous([A, B, C], 3), 'trois courtiers prêts pour chacun');
  await A.rv.envoyer({ t: 'salut', n: 1 });
  await A.rv.envoyer({ t: 'prive', n: 2 }, B.pid);
  assert.ok(await attendre(() => B.rv.etat().every(l => l.recus >= 2) && C.rv.etat().every(l => l.recus >= 1)), 'chaque courtier a tout rendu');
  await dormir(30);
  assert.deepEqual(textes(B), ['salut1', 'prive2']);
  assert.deepEqual(textes(C), ['salut1'], 'le message adressé ne va pas sur le sujet des autres');
  assert.deepEqual(textes(A), [], 'l’écho de ses propres messages est écarté');
  assert.equal(B.recus[0].m.de, A.pid); assert.equal(B.recus[0].m.a, '*'); assert.equal(B.recus[1].m.a, B.pid);
  assert.equal(B.recus[0].p, N.PROTOCOLE);
  assert.ok(C.rv.etat().every(l => l.recus === 1), 'C ne reçoit même pas la trame adressée à B');
  assert.ok(m2.attendus > 0 && await attendre(() => m2.accuses === m2.attendus), 'chaque livraison en QoS 1 est accusée');
  assert.ok(m3.connexionsMqtt.every(x => x.util === 'public' && x.mdp === 'public' && x.drapeaux & 0x02), 'identifiants et session propre');
  assert.ok(m1.connexionsMqtt.every(x => x.nom === 'MQTT' && x.niveau === 4 && x.id.length === 20));
  assert.equal(m1.publications, 2, 'une publication par message et par courtier');
  assert.deepEqual([...m1.abonnes.keys()].sort(), [c.salle, c.salle + '/' + A.pid, c.salle + '/' + B.pid, c.salle + '/' + C.pid].sort());
  assert.ok(B.rv.etat().every(l => l.latence != null && l.ouvertures === 1 && l.echecs === 0));
});

test('traqueur WebTorrent : tout part à la salle, seul le destinataire garde le message adressé', async () => {
  const M = monde(), c = await salle();
  const t1 = traqueur(M, 'wss://t1.test'), t2 = traqueur(M, 'wss://t2.test/announce');
  const familles = { torrent: ['wss://t1.test', 'wss://t2.test/announce'] };
  const [A, B, C] = [0, 1, 2].map(() => participant(c, M, familles));
  assert.ok(await tous([A, B, C], 2));
  await A.rv.envoyer({ t: 'salut', n: 1 });
  await A.rv.envoyer({ t: 'prive', n: 2 }, B.pid);
  assert.ok(await attendre(() => B.rv.etat().every(l => l.recus >= 2) && C.rv.etat().every(l => l.recus >= 2)));
  await dormir(30);
  assert.deepEqual(textes(B), ['salut1', 'prive2']);
  assert.deepEqual(textes(C), ['salut1'], 'C a reçu la trame adressée à B mais l’a écartée');
  assert.deepEqual(textes(A), []);
  const annonces = t1.journal.filter(m => m.peer_id === A.pid);
  assert.equal(annonces[0].event, 'started'); assert.equal(annonces[0].numwant, 0);
  const offres = annonces.filter(m => m.offers);
  assert.equal(offres.length, 2);
  for (const m of offres) {
    assert.equal(m.info_hash, c.hash); assert.equal(m.numwant, 5); assert.equal(m.offers.length, 5);
    assert.equal(new Set(m.offers.map(x => x.offer_id)).size, 5); assert.ok(m.offers.every(x => x.offer_id.length === 20 && x.offer.type === 'offer'));
  }
  assert.equal(t1.offres, 4, 'deux messages, chacun remis aux deux autres pairs');
  assert.equal(t2.offres, 4);
  assert.match(c.hash, /^[0-9A-Za-z]{20}$/, 'empreinte de 20 caractères, sans rien du code');
});

test('Nostr : événements éphémères signés, étiquette de salle, échos de soi écartés', async () => {
  const M = monde(), c = await salle();
  const r1 = relaisNostr(M, 'wss://n1.test'), r2 = relaisNostr(M, 'wss://n2.test');
  const familles = { nostr: ['wss://n1.test', 'wss://n2.test'] };
  const [A, B, C] = [0, 1, 2].map(() => participant(c, M, familles));
  assert.ok(await tous([A, B, C], 2));
  await A.rv.envoyer({ t: 'salut', n: 1 });
  await A.rv.envoyer({ t: 'prive', n: 2 }, C.pid);
  await B.rv.envoyer({ t: 'retour', n: 3 }, A.pid);
  assert.ok(await attendre(() => C.rv.etat().every(l => l.recus >= 2) && A.rv.etat().every(l => l.recus >= 1), LONG));
  await dormir(30);
  assert.deepEqual(textes(B), ['salut1']);
  assert.deepEqual(textes(C), ['salut1', 'prive2']);
  assert.deepEqual(textes(A), ['retour3']);
  assert.equal(r1.acceptes, 3, 'les trois événements acceptés : identifiant et signature BIP-340 valides');
  for (const ev of r1.recus) {
    assert.equal(ev.kind, c.genre); assert.ok(ev.kind >= 20000 && ev.kind < 30000, 'genre éphémère, jamais conservé');
    assert.equal(ev.tags.length, 1); assert.equal(ev.tags[0][0], 'x');
    assert.ok(Math.abs(ev.created_at - Date.now() / 1000) < 5);
  }
  const parTag = Object.fromEntries(r1.recus.map(ev => [ev.tags[0][1], ev.pubkey]));
  assert.deepEqual(Object.keys(parTag).sort(), [c.salle, c.salle + '.' + C.pid, c.salle + '.' + A.pid].sort());
  assert.equal(parTag[c.salle], parTag[c.salle + '.' + C.pid], 'une clé par session');
  assert.notEqual(parTag[c.salle], parTag[c.salle + '.' + A.pid]);
  // le relais rend à A son propre événement (son abonnement à la salle correspond) ; le client l'écarte sans le lire
  assert.ok(r1.livres >= 4);
  assert.ok(B.rv.etat().every(l => l.recus === 1), 'B ne reçoit pas les événements adressés aux autres');
});

test('les trois natures ensemble : chaque message arrive une fois, la première copie compte', async () => {
  const M = monde(), c = await salle(), familles = { mqtt: [], torrent: [], nostr: [] };
  for (let i = 1; i <= 3; i++) {
    courtier(M, 'wss://m' + i + '.test/mqtt'); familles.mqtt.push('wss://m' + i + '.test/mqtt');
    traqueur(M, 'wss://t' + i + '.test'); familles.torrent.push('wss://t' + i + '.test');
    relaisNostr(M, 'wss://n' + i + '.test'); familles.nostr.push('wss://n' + i + '.test');
  }
  const A = participant(c, M, familles), B = participant(c, M, familles);
  assert.ok(await tous([A, B], 9), 'neuf relais prêts de chaque côté');
  for (let n = 0; n < 10; n++) await A.rv.envoyer({ t: 'm', n });
  for (let n = 0; n < 5; n++) await B.rv.envoyer({ t: 'r', n }, A.pid);
  assert.ok(await attendre(() => B.rv.etat().every(l => l.recus >= 10) && A.rv.etat().every(l => l.recus >= 5), LONG), 'toutes les copies sont arrivées');
  await dormir(50);
  assert.equal(B.recus.length, 10, 'dix messages, chacun une fois malgré neuf copies');
  assert.deepEqual(B.recus.map(x => x.m.n).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(A.recus.length, 5);
  const somme = o => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(somme(B.rv.premiers), 10); assert.equal(somme(A.rv.premiers), 5);
  assert.equal(B.rv.etat().reduce((a, l) => a + l.premiers, 0), 10);
  assert.ok(B.rv.etat().every(l => l.recus === 10), 'chaque relais a tout porté, une fois');
  assert.ok(A.rv.etat().every(l => l.envoyes >= 10));
});

test('liaison coupée par le relais : elle se rouvre seule et rejoue les messages récents', async () => {
  const M = monde(), c = await salle();
  courtier(M, 'wss://m1.test/mqtt');
  const familles = { mqtt: ['wss://m1.test/mqtt'] };
  const A = participant(c, M, familles), B = participant(c, M, familles);
  assert.ok(await tous([A, B], 1));
  await A.rv.envoyer({ t: 'avant' });
  assert.ok(await attendre(() => B.recus.length === 1));
  // le courtier coupe la seule connexion de A ; B reste abonnée
  const ws = A.sockets.find(x => x.readyState === 1);
  assert.ok(ws && A.sockets.length === 1, 'connexion de A trouvée');
  ws.conn.fermer();
  assert.ok(await attendre(() => !A.rv.pret()), 'A sait que son relais est tombé');
  await A.rv.envoyer({ t: 'pendant' });
  assert.ok(await attendre(() => A.lien('wss://m1.test/mqtt').ouvertures === 2, 5000), 'la liaison se rouvre');
  assert.ok(await attendre(() => B.recus.length === 2));
  await dormir(50);
  assert.deepEqual(B.recus.map(x => x.m.t), ['avant', 'pendant'], 'le message écrit pendant la coupure est rejoué, l’ancien n’est pas redonné');
  assert.ok(B.rv.etat()[0].recus >= 3, 'le message « avant » est revenu en double, écarté par son identifiant');
  assert.deepEqual(A.changes.map(x => x.pret), [true, false, true]);
  assert.equal(A.lien('wss://m1.test/mqtt').echecs, 1);
});

test('refus d’un relais : il est écarté et le suivant prend sa place', async () => {
  const M = monde(), c = await salle();
  courtier(M, 'wss://refus.test/mqtt', { refuser: true });
  courtier(M, 'wss://abo.test/mqtt', { refuserAbonnement: true });
  courtier(M, 'wss://m1.test/mqtt'); courtier(M, 'wss://m2.test/mqtt');
  traqueur(M, 'wss://tr.test', { refus: 'unsupported info_hash' }); traqueur(M, 'wss://t1.test');
  relaisNostr(M, 'wss://ferme.test', { fermer: 'restricted: members only' });
  relaisNostr(M, 'wss://bloque.test', { refus: 'blocked: not on the list' });
  relaisNostr(M, 'wss://n1.test');
  const familles = {
    mqtt: ['wss://refus.test/mqtt', 'wss://abo.test/mqtt', 'wss://m1.test/mqtt', 'wss://m2.test/mqtt'],
    torrent: ['wss://tr.test', 'wss://t1.test'],
    nostr: ['wss://ferme.test', 'wss://bloque.test', 'wss://n1.test']
  };
  const A = participant(c, M, familles), B = participant(c, M, familles);
  // le relais Nostr « bloque » accepte l'abonnement mais refuse le premier événement : il tombe à la publication
  assert.ok(await attendre(() => [A, B].every(p => p.prets().length === 5) && A.changes.filter(x => x.refus).length === 4, 4000));
  const urls = p => p.prets().map(l => l.url).sort();
  assert.deepEqual(urls(A), ['wss://bloque.test', 'wss://m1.test/mqtt', 'wss://m2.test/mqtt', 'wss://n1.test', 'wss://t1.test']);
  const raisons = A.changes.filter(x => x.refus).map(x => x.url + ' : ' + x.refus).sort();
  assert.deepEqual(raisons, ['wss://abo.test/mqtt : abonnement refusé', 'wss://ferme.test : restricted: members only',
    'wss://refus.test/mqtt : connexion refusée (5)', 'wss://tr.test : unsupported info_hash']);
  await A.rv.envoyer({ t: 'salut' });
  assert.ok(await attendre(() => B.recus.length === 1 && A.prets().length === 4));
  assert.ok(A.changes.some(x => x.url === 'wss://bloque.test' && x.refus === 'blocked: not on the list'));
  assert.ok(!A.rv.etat().some(l => l.url === 'wss://bloque.test'), 'écarté après son refus');
  await A.rv.envoyer({ t: 'encore' });
  assert.ok(await attendre(() => B.recus.length === 2));
  assert.deepEqual(B.recus.map(x => x.m.t), ['salut', 'encore']);
});

test('relais MQTT qui annonce un paquet démesuré : écarté et remplacé', async () => {
  const M = monde(), c = await salle();
  courtier(M, 'wss://gros.test/mqtt', { demesure: true });
  courtier(M, 'wss://m1.test/mqtt');
  traqueur(M, 'wss://t1.test');
  relaisNostr(M, 'wss://n1.test');
  const familles = {
    mqtt: ['wss://gros.test/mqtt', 'wss://m1.test/mqtt'],
    torrent: ['wss://t1.test'],
    nostr: ['wss://n1.test']
  };
  const A = participant(c, M, familles), B = participant(c, M, familles);
  assert.ok(await attendre(() => [A, B].every(p => p.prets().length === 3) && A.changes.some(x => x.refus === 'paquet démesuré'), 4000));
  assert.ok(A.changes.some(x => x.url === 'wss://gros.test/mqtt' && x.refus === 'paquet démesuré'));
  assert.ok(!A.rv.etat().some(l => l.url === 'wss://gros.test/mqtt'), 'écarté après paquet démesuré');
  await A.rv.envoyer({ t: 'salut' });
  assert.ok(await attendre(() => B.recus.length === 1));
  assert.deepEqual(B.recus.map(x => x.m.t), ['salut']);
});

test('relais Nostr qui limite le débit : mis en pause cinq secondes, pas écarté', async () => {
  const M = monde(), c = await salle();
  const r1 = relaisNostr(M, 'wss://n1.test', { limite: 1 }), r2 = relaisNostr(M, 'wss://n2.test');
  const familles = { nostr: ['wss://n1.test', 'wss://n2.test'] };
  const A = participant(c, M, familles), B = participant(c, M, familles);
  assert.ok(await tous([A, B], 2));
  await A.rv.envoyer({ t: 'm', n: 1 });
  await A.rv.envoyer({ t: 'm', n: 2 });
  assert.ok(await attendre(() => r1.evenements === 2 && B.recus.length === 2));
  await dormir(40);   // le refus « rate-limited » est revenu
  await A.rv.envoyer({ t: 'm', n: 3 });
  assert.ok(await attendre(() => B.recus.length === 3));
  await dormir(40);
  assert.equal(r1.evenements, 2, 'n1 n’est plus sollicité pendant la pause');
  assert.equal(r2.acceptes, 3);
  assert.deepEqual(textes(B), ['m1', 'm2', 'm3']);
  assert.ok(A.lien('wss://n1.test').pret && !A.lien('wss://n1.test').refus, 'le relais reste en place');
});

test('trames étrangères écartées : illisibles, autre salle, autre clé, de soi, pour un autre', async () => {
  const M = monde(), c = await salle(), autre = await salle();
  const m1 = courtier(M, 'wss://m1.test/mqtt'), t1 = traqueur(M, 'wss://t1.test'), n1 = relaisNostr(M, 'wss://n1.test');
  const A = participant(c, M, { mqtt: ['wss://m1.test/mqtt'], torrent: ['wss://t1.test'], nostr: ['wss://n1.test'] });
  const B = participant(c, M, { torrent: ['wss://t1.test'] });
  assert.ok(await tous([A], 3) && await tous([B], 1));
  const k = () => pidNeuf().slice(0, 12), de = pidNeuf();
  const enveloppes = [
    crypto.getRandomValues(new Uint8Array(48)),                                     // bruit
    Uint8Array.of(1, 2, 3),                                                          // trop court
    await I.sceller(autre.cle, c.salle, { t: 'x', k: k(), de, a: '*' }),             // autre clé
    await I.sceller(c.cle, autre.salle, { t: 'x', k: k(), de, a: '*' }),             // autre salle dans les données associées
    await I.sceller(c.cle, c.salle, { t: 'x', de, a: '*' }),                          // sans identifiant
    await I.sceller(c.cle, c.salle, { t: 'x', k: k(), de: A.pid, a: '*' }),          // de soi
    await I.sceller(c.cle, c.salle, { t: 'x', k: k(), de, a: pidNeuf() }),           // pour une autre machine
    await I.sceller(c.cle, c.salle, [1, 2, 3])                                       // pas un objet
  ];
  const bon = await I.sceller(c.cle, c.salle, { t: 'bon', k: k(), de, a: '*' });
  const futur = await I.sceller(c.cle, c.salle, { t: 'futur', k: k(), de, a: A.pid }, 9);
  for (const e of enveloppes) m1.injecter(c.salle, e);
  m1.injecter(c.salle, bon); m1.injecter(c.salle, bon);
  // traqueur : JSON cassé, autre empreinte, charge qui n'est pas du base64, puis une bonne trame
  const offre = (hash, sdp) => JSON.stringify({ action: 'announce', info_hash: hash, peer_id: de, offer_id: k(), offer: { type: 'offer', sdp } });
  t1.injecter(c.hash, '{cassé');
  t1.injecter(c.hash, offre(autre.hash, I.b64(bon)));
  t1.injecter(c.hash, offre(c.hash, '%%%'));
  for (const e of enveloppes) t1.injecter(c.hash, offre(c.hash, I.b64(e)));
  t1.injecter(c.hash, offre(c.hash, I.b64(futur)));
  t1.injecter(c.hash, offre(c.hash, I.b64(bon)));
  // Nostr : autre genre, contenu illisible, abonnement inconnu
  const ev = (contenu, genre = c.genre) => sub => JSON.stringify(['EVENT', sub, { id: '0'.repeat(64), pubkey: 'ab'.repeat(32), created_at: 1, kind: genre, tags: [['x', c.salle]], content: contenu, sig: '0'.repeat(128) }]);
  n1.injecter(ev(I.b64(bon), c.genre + 1)); n1.injecter(ev('***')); n1.injecter(JSON.stringify(['EVENT', 'inconnu', { kind: c.genre, content: I.b64(bon) }]));
  n1.injecter('pas du JSON'); n1.injecter(JSON.stringify({ objet: 1 }));
  for (const e of enveloppes) n1.injecter(ev(I.b64(e)));
  // chaque trame qui atteint le client est comptée ; JSON cassé, autre empreinte, autre genre et base64 illisible
  // s'arrêtent avant
  const n = enveloppes.length;
  assert.ok(await attendre(() => A.lien('wss://m1.test/mqtt').recus === n + 2 && A.lien('wss://t1.test').recus === n + 2 &&
    A.lien('wss://n1.test').recus === n && B.lien('wss://t1.test').recus === n + 2, LONG));
  await dormir(80);
  assert.deepEqual(A.recus.map(x => [x.m.t, x.p]).sort(), [['bon', 2], ['futur', 9]],
    'seules la bonne trame (une fois) et celle d’une autre version passent ; la version est remontée telle quelle');
  assert.equal(A.recus.find(x => x.m.t === 'futur').famille, 'torrent');
  // pour B, la trame « de soi » de A vient d'une autre machine : il la garde, et écarte celle adressée à A
  assert.deepEqual(B.recus.map(x => x.m.de === A.pid ? 'de A' : x.m.t).sort(), ['bon', 'de A']);
});

test('deux machines se joignent par le code sur les trois natures de faux relais, puis ferment tout', async () => {
  const reseau = reseauFactice(), M = monde(), relais = { mqtt: [], torrent: [], nostr: [] };
  for (let i = 1; i <= 2; i++) {
    courtier(M, 'wss://m' + i + '.test/mqtt'); relais.mqtt.push('wss://m' + i + '.test/mqtt');
    traqueur(M, 'wss://t' + i + '.test'); relais.torrent.push('wss://t' + i + '.test');
    relaisNostr(M, 'wss://n' + i + '.test'); relais.nostr.push('wss://n' + i + '.test');
  }
  const delais = Object.assign({}, RAPIDE, { ouverture: 8000, essai: 4000, helloInvite: 400, injoignable: 8000 });
  const h = machine(reseau, 'Hote', { WebSocket: M.WS, relais, delais }), g = machine(reseau, 'Invite', { WebSocket: M.WS, relais, delais });
  ouverts.push(h.R, g.R);
  await h.R.creerSalon();
  await g.R.rejoindreSalon(h.R.code);
  const ensemble = await attendre(() => reunis(h, g), LONG);
  assert.ok(ensemble, ensemble ? '' : 'réunis par les faux relais publics ; journal : ' +
    JSON.stringify({ hote: [h.R.statut, h.R.signalisation.journal.slice(-12)], invite: [g.R.statut, g.R.signalisation.journal.slice(-12)] }));
  assert.ok(direct(h, g));
  assert.deepEqual(h.R.relaisEtat(), { mode: 'relais', prets: 6, total: 6, enEchec: 0, familles: { mqtt: 2, torrent: 2, nostr: 2 } });
  const offre = g.R.signalisation.journal.find(x => x.quoi === 'offre reçue');
  assert.ok(offre && /^(mqtt|torrent|nostr) /.test(offre.voie), 'l’offre est venue par un relais : ' + (offre && offre.voie));
  assert.ok(Object.values(h.R.signalisation.premiers).reduce((a, b) => a + b, 0) >= 1);
  h.R.envoyer({ t: 'course' });
  assert.ok(await attendre(() => g.j.messages.length === 1));
  h.R.fermer(); g.R.fermer();
  assert.ok(await attendre(() => [...M.serveurs.values()].every(s => s.connexions.size === 0), 8000), 'plus aucune connexion ouverte aux relais');
  assert.ok(M.sockets.every(s => s.readyState === 3 || s.readyState === 2));
});
