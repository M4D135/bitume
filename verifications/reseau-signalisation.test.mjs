// Briques de la signalisation sans serveur (src/reseau.js) : code de partie, clés tirées du code, enveloppe chiffrée,
// description de session compacte, invitation, QR code, signature BIP-340 des événements Nostr.
// Les références viennent d'ailleurs : PBKDF2 et HKDF de Node, ECDH secp256k1 de Node, vecteurs officiels BIP-340,
// et une vérification de signature écrite ici à part (arithmétique affine, rien de commun avec reseau.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import crypto from 'node:crypto';
import { N, verifierBip340 } from './outils-reseau.mjs';
const I = N.interne, CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

test('code de partie : dix caractères, toute faute de frappe sur un caractère se voit', () => {
  for (let i = 0; i < 300; i++) {
    const c = N.code.nouveau();
    assert.match(c, /^[0-9A-HJKMNP-TV-Z]{10}$/);
    assert.equal(N.code.normaliser(c), c);
    assert.equal(N.code.normaliser(' ' + N.code.afficher(c).toLowerCase() + ' '), c);
    for (let p = 0; p < 10; p++) for (const x of CROCKFORD) if (x !== c[p]) assert.equal(N.code.normaliser(c.slice(0, p) + x + c.slice(p + 1)), null);
  }
  const c = N.code.nouveau().replace(/0/g, '1');
  const valide = N.code.normaliser(c) ? c : null;
  if (valide) assert.equal(N.code.normaliser(valide.replace(/1/g, 'l')), valide, 'L se lit 1');
  assert.equal(N.code.afficher('ABCDE12345'), 'ABCDE-12345');
  for (const faux of ['', 'ABCD', 'ABCDE-1234', 'ABCDE-123456', 'ABCDE-1234U', null]) assert.equal(N.code.normaliser(faux), null);
  const o = (() => { for (;;) { const k = N.code.nouveau(); if (k.includes('0')) return k; } })();
  assert.equal(N.code.normaliser(o.replace(/0/g, 'o')), o, 'O se lit 0');
});

test('clés tirées du code : conformes à PBKDF2 et HKDF de Node, la salle ne révèle pas le code', async () => {
  const code = N.code.nouveau(), s = await I.deriverSalle(code);
  const ikm = crypto.pbkdf2Sync('bitume/code/' + code, 'bitume/signal/1', 600000, 32, 'sha256');
  const id = Buffer.from(crypto.hkdfSync('sha256', ikm, Buffer.alloc(0), 'bitume/salle/1', 36));
  assert.equal(s.salle, id.subarray(0, 16).toString('hex'));
  assert.match(s.hash, /^[0-9A-Za-z]{20}$/);
  assert.ok(s.genre >= 20000 && s.genre < 30000);
  assert.ok(!s.salle.includes(code.toLowerCase()) && !s.hash.includes(code));
  const t = await I.deriverSalle(N.code.nouveau());
  assert.notEqual(t.salle, s.salle);
  assert.equal((await I.deriverSalle(code)).salle, s.salle, 'même code, même salle');
});

test('enveloppe : chiffrée, authentifiée, liée à la salle, protocole lisible', async () => {
  const a = await I.deriverSalle(N.code.nouveau()), b = await I.deriverSalle(N.code.nouveau());
  const env = await I.sceller(a.cle, a.salle, { t: 'sig', s: { e: 'x' } });
  assert.equal(env[0], 1); assert.equal(env[1], N.PROTOCOLE);
  assert.ok(!Buffer.from(env).toString('latin1').includes('sig'), 'rien en clair');
  assert.deepEqual(await I.ouvrirEnveloppe(a.cle, a.salle, env), { p: N.PROTOCOLE, m: { t: 'sig', s: { e: 'x' } } });
  for (let i = 0; i < env.length; i += 7) { const x = env.slice(); x[i] ^= 4; assert.equal(await I.ouvrirEnveloppe(a.cle, a.salle, x), null, 'octet ' + i + ' altéré'); }
  assert.equal(await I.ouvrirEnveloppe(b.cle, b.salle, env), null, 'autre code');
  assert.equal(await I.ouvrirEnveloppe(a.cle, b.salle, env), null, 'autre salle');
  assert.equal(await I.ouvrirEnveloppe(a.cle, a.salle, env.slice(0, 20)), null);
  const v3 = await I.sceller(a.cle, a.salle, { t: 'hello' }, 3);
  assert.equal((await I.ouvrirEnveloppe(a.cle, a.salle, v3)).p, 3, 'une autre version reste reconnaissable');
});

// Offre réelle de Chrome (adresses remplacées par des adresses de documentation)
const OFFRE = ['v=0', 'o=- 4611731400430051336 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=extmap-allow-mixed', 'a=msid-semantic: WMS',
  'm=application 50000 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 203.0.113.7',
  'a=candidate:3442447574 1 udp 2122260223 9a1c2b3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d.local 50000 typ host generation 0 network-id 1 network-cost 10',
  'a=candidate:1215948342 1 udp 2122194687 2001:db8:1f:d7b0::1:5 51000 typ host generation 0 network-id 2',
  'a=candidate:842163049 1 udp 1686052607 203.0.113.7 50000 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-id 1 network-cost 10',
  'a=candidate:2306467302 1 tcp 1518280447 9a1c2b3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d.local 9 typ host tcptype active generation 0',
  'a=ice-ufrag:Zx9q', 'a=ice-pwd:k3Jd8sLmQ2pR7tVwXyZaBcDe', 'a=ice-options:trickle',
  'a=fingerprint:sha-256 4F:1A:2B:3C:4D:5E:6F:70:81:92:A3:B4:C5:D6:E7:F8:09:1A:2B:3C:4D:5E:6F:70:81:92:A3:B4:C5:D6:E7:F8',
  'a=setup:actpass', 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144', ''].join('\r\n');

test('description compacte : tout ce qui compte pour la liaison, en une centaine d’octets', () => {
  const c = I.compacterSdp(OFFRE);
  assert.ok(c.length < 130, c.length + ' octets');
  const refaite = I.sdpDepuisCompact(I.lireCompact(c).sdp), a = I.lireSdp(OFFRE), b = I.lireSdp(refaite);
  for (const k of ['ufrag', 'pwd', 'empreinte', 'setup', 'mid', 'port']) assert.equal(b[k], a[k], k);
  assert.equal(b.candidats.length, 3, 'les candidats TCP sont laissés');
  assert.deepEqual(I.compacterSdp(refaite), c, 'refaite, elle se compacte à l’identique');
  assert.match(refaite, /a=end-of-candidates/);
  assert.match(refaite, /typ srflx raddr 0\.0\.0\.0 rport 0/);
  const autre = OFFRE.replace('a=setup:actpass', 'a=setup:active').replace('sctp-port:5000', 'sctp-port:5001').replace(/sha-256 [0-9A-F:]+/, 'sha-512 AB:CD');
  const b2 = I.lireSdp(I.sdpDepuisCompact(I.lireCompact(I.compacterSdp(autre)).sdp));
  assert.equal(b2.setup, 'active'); assert.equal(b2.port, 5001); assert.equal(b2.empreinte, 'sha-512 AB:CD');
  assert.throws(() => I.compacterSdp('v=0\r\n'), /sdp/);
});

test('invitation : lien, texte coupé, texte abîmé, autre version', () => {
  const code = N.code.nouveau(), charge = I.emballerInvitation(1, 4242, code, OFFRE), lien = N.lienInvitation(charge);
  assert.ok(charge.length < 200, charge.length + ' caractères');
  assert.equal(lien, 'https://bitume.estrasse.fr/#invitation=' + charge);
  for (const texte of [lien, charge, 'Rejoins-moi : ' + lien + ' !', charge.slice(0, 50) + '\n  ' + charge.slice(50)]) {
    const r = I.lireInvitation(texte);
    assert.equal(r.erreur, undefined); assert.equal(r.genre, 1); assert.equal(r.n, 4242); assert.equal(r.code, code);
    assert.equal(I.lireSdp(r.sdp).ufrag, 'Zx9q');
  }
  const sans = I.lireInvitation(I.emballerInvitation(2, 7, null, OFFRE));
  assert.equal(sans.genre, 2); assert.equal(sans.code, null);
  assert.ok(['illisible', 'incomplete'].includes(I.lireInvitation(charge.slice(0, -2)).erreur));
  const u = I.deB64url(charge); u[30] ^= 1;
  assert.equal(I.lireInvitation(I.b64url(u)).erreur, 'incomplete');
  const v = I.deB64url(charge); v[1] = 3;
  const f = I.fletcher(v.subarray(0, v.length - 2)); v[v.length - 2] = f >> 8; v[v.length - 1] = f & 255;
  assert.equal(I.lireInvitation(I.b64url(v)).erreur, 'version');
  assert.equal(I.lireInvitation('bonjour').erreur, 'illisible');
  assert.deepEqual(N.lirePartage('#invitation=' + charge), { invitation: charge });
  assert.deepEqual(N.lirePartage('#partie=' + N.code.afficher(code)), { code });
  assert.equal(N.lirePartage('#partie=ABCDE-ABCDE' + 'X'), null);
});

test('QR code : structure conforme, version au plus juste ; CoreImage et Chrome le lisent (tools/essai-enligne.mjs --qr)', () => {
  const texte = N.lienInvitation(I.emballerInvitation(1, 1, N.code.nouveau(), OFFRE)), q = N.qr(texte);
  assert.equal(q.niveau, 'M'); assert.ok(q.version >= 9 && q.version <= 11, 'version ' + q.version);
  // capacités en octets de la norme (niveau M) : 14, 26, 84, 213, 666 ; un octet de plus passe à la version suivante
  for (const [v, longueur] of [[1, 14], [2, 15], [2, 26], [5, 84], [6, 85], [10, 213], [20, 666]]) assert.equal(N.qr('x'.repeat(longueur), 'M').version, v, longueur + ' octets');
  assert.equal(N.qr('x'.repeat(106), 'L').version, 5);
  assert.equal(N.qr('x'.repeat(667), 'M'), null);
  assert.equal(N.qr('x'.repeat(858)).niveau, 'L');
  assert.equal(N.qr('x'.repeat(859)), null);
  for (const t of ['A', texte, 'x'.repeat(400)]) {
    const r = N.qr(t), n = r.taille, M = (x, y) => r.modules[y * n + x];
    assert.equal(n, r.version * 4 + 17);
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) for (let d = -3; d <= 3; d++) { assert.equal(M(cx + d, cy - 3), 1); assert.equal(M(cx - 3, cy + d), 1); assert.equal(M(cx, cy), 1); }
    for (let i = 8; i < n - 8; i++) { assert.equal(M(i, 6), i % 2 ? 0 : 1); assert.equal(M(6, i), i % 2 ? 0 : 1); }
    assert.equal(M(8, n - 8), 1, 'module toujours noir');
    let f = 0;
    const bits = [M(8, 0), M(8, 1), M(8, 2), M(8, 3), M(8, 4), M(8, 5), M(8, 7), M(8, 8), M(7, 8), M(5, 8), M(4, 8), M(3, 8), M(2, 8), M(1, 8), M(0, 8)];
    for (let i = 14; i >= 0; i--) f = f << 1 | bits[i];
    f ^= 0x5412;
    let reste = f >> 10;
    for (let i = 0; i < 10; i++) reste = (reste << 1) ^ ((reste >>> 9) * 0x537);
    assert.equal(f & 0x3FF, reste & 0x3FF, 'format protégé par son code BCH');
    assert.equal(f >> 13, r.niveau === 'L' ? 1 : 0); assert.equal(f >> 10 & 7, r.masque);
    assert.deepEqual(N.qr(t).modules, r.modules, 'même texte, même image');
  }
});

test('signature BIP-340 : vecteurs officiels, clé conforme à Node, vérifiée à part', async () => {
  const S = I.secp(), h = x => I.deHex(x.toLowerCase());
  const vecteurs = [
    ['0000000000000000000000000000000000000000000000000000000000000003', 'F9308A019258C31049344F85F89D5229B531C845836F99B08601F113BCE036F9', '0'.repeat(64), '0'.repeat(64),
      'E907831F80848D1069A5371B402410364BDF1C5F8307B0084C55F1CE2DCA821525F66A4A85EA8B71E482A74F382D2CE5EBEEE8FDB2172F477DF4900D310536C0'],
    ['B7E151628AED2A6ABF7158809CF4F3C762E7160F38B4DA56A784D9045190CFEF', 'DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659', '0'.repeat(63) + '1',
      '243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89',
      '6896BD60EEAE296DB48A229FF71DFE071BDE413E6D43F917DC8DCF8C78DE33418906D11AC976ABCCB20B091292BFF4EA897EFCB639EA871CFA95F6DE339E4B0A'],
    ['C90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B14E5C9', 'DD308AFEC5777E13121FA72B9CC1B7CC0139715309B086C960E18FD969774EB8',
      'C87AA53824B4D7AE2EB035A2B5BBBCCC080E76CDC6D1692C4B0B62D798E6D906', '7E2D58D8B3BCDF1ABADEC7829054F90DDA9805AAB56C77333024B9D0A508B75C',
      '5831AAEED7B44BB74E5EAB94BA9D4294C49BCF2A60728D8B4C200F50DD313C1BAB745879A5AD954A72C45A91C3A51D3C7ADEA98D82F8481E0E1E03674A6F3FB7']];
  for (const [sk, pk, aux, msg, sig] of vecteurs) {
    const k = S.cle(h(sk)), s = await S.signer(k, h(msg), h(aux));
    assert.equal(I.hex(k.px).toUpperCase(), pk); assert.equal(I.hex(s).toUpperCase(), sig);
    assert.ok(verifierBip340(k.px, h(msg), s));
  }
  for (let i = 0; i < 5; i++) {
    const e = crypto.createECDH('secp256k1'); e.generateKeys();
    const k = S.cle(new Uint8Array(e.getPrivateKey())), msg = crypto.randomBytes(32), s = await S.signer(k, msg, crypto.randomBytes(32));
    assert.equal(I.hex(k.px), e.getPublicKey().subarray(1, 33).toString('hex'));
    assert.ok(verifierBip340(k.px, msg, s));
    const faux = Buffer.from(s); faux[40] ^= 1;
    assert.equal(verifierBip340(k.px, msg, faux), false);
  }
  assert.throws(() => S.cle(new Uint8Array(32)), /clé/);
});

test('événement Nostr : identifiant et signature conformes à NIP-01', async () => {
  const cles = await I.deriverSalle(N.code.nouveau());
  let cle = null;
  const ctx = Object.assign({}, cles, { pid: 'p'.repeat(20), cleNostr: async () => cle || (cle = Object.assign(I.secp().cle(crypto.randomBytes(32)), {})) });
  const k = await ctx.cleNostr(); k.pub = I.hex(k.px);
  const trame = JSON.parse(await I.FAMILLES.nostr.preparer(Uint8Array.of(1, 2, 3), 'q'.repeat(20), ctx));
  assert.equal(trame[0], 'EVENT');
  const ev = trame[1];
  assert.equal(ev.kind, cles.genre); assert.deepEqual(ev.tags, [['x', cles.salle + '.' + 'q'.repeat(20)]]); assert.equal(ev.content, 'AQID');
  const id = crypto.createHash('sha256').update(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content])).digest();
  assert.equal(ev.id, id.toString('hex'));
  assert.ok(verifierBip340(Buffer.from(ev.pubkey, 'hex'), id, Buffer.from(ev.sig, 'hex')));
});
