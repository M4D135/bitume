(function (B) {
  'use strict';
  // BITUME — jeu en ligne (David, 16/11/2026 : « le multijoueur en ligne », « netcode précis et léger, pas de lag » ;
  // « en ligne jusqu'à quatre, et deux en local contre deux en local, deux en local contre un seul » ; 18/11 : « fais le
  // plus optimal et le plus fiable mais je veux pas avoir de gestion de serveur pour ce jeu peer to peer »).
  //
  // Principe :
  // - de deux à quatre machines, une ou deux voitures humaines chacune (écran partagé), quatre pilotes au plus ;
  // - chaque machine conduit SES voitures sans attendre le réseau : aucun retard à la commande ;
  // - liaisons directes WebRTC entre toutes les machines (canal « état » sans reprise ni ordre, canal « fiable »
  //   ordonné) ; deux machines sans liaison directe passent par une troisième machine de la partie ;
  // - se trouver ne demande aucun serveur à nous : le code de la partie donne un nom de salle et une clé ; les
  //   messages de mise en relation, chiffrés et authentifiés par cette clé, partent en même temps sur des relais
  //   publics de trois natures (courtiers MQTT, traqueurs WebTorrent, relais Nostr) et le premier arrivé gagne ; sans
  //   Internet, une invitation à la main (texte ou QR code) suffit ; le salon de David (serveur/salon.mjs) reste un
  //   transport possible pour les essais (?salon=…) ;
  // - horloge commune, celle de l'hôte ; la course part au même instant T0 partout et la simulation suit cette horloge ;
  // - l'état d'une voiture (15 nombres, horodatés) part à chaque image ; une voiture distante est prolongée jusqu'à
  //   l'instant du pas par la même cinématique que la conduite, et l'écart à chaque nouvel état se résorbe en 0,12 s ;
  // - l'hôte fait courir les rivaux (et les voitures d'une machine partie) et annonce leurs temps officiels ; chaque
  //   machine annonce ceux de ses voitures.
  //
  //   const R = B.reseau.creer({ nom, joueurs, relais?, salon? });  R.on('salon' | 'salle' | 'pair' | 'relais' |
  //   'liens' | 'statut' | 'signalisation' | 'invitation' | 'parti' | 'message' | 'etat' | 'erreur' | 'ferme', f) ;
  //   R.creerSalon() ;
  //   R.rejoindreSalon(code) ; R.inviter() ; R.accepterInvitation(texte) ; R.accepterReponse(texte) ;
  //   R.envoyer(objet, machine?) ; R.envoyerEtat(tampon) ; R.horloge() (ms, celle de l'hôte)

  const PROTOCOLE = 2;
  const ADRESSE_JEU = 'https://bitume.estrasse.fr/';
  // STUN publics de quatre exploitants (l'adresse publique vue d'Internet). Pas de TURN : aucun n'est gratuit et ouvert
  // sans clé secrète ; deux machines sans liaison directe passent par une troisième machine de la partie.
  const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }, { urls: 'stun:stun.nextcloud.com:443' },
    { urls: 'stun:global.stun.twilio.com:3478' }];
  // Relais publics de signalisation essayés le 18/11/2026 (docs/reprise/27-EN-LIGNE-SANS-SERVEUR.md). Trois par nature
  // en service, dans cet ordre : les deux machines prennent les mêmes. Un relais qui refuse, ou ne s'ouvre pas trois
  // fois de suite, cède sa place au suivant pour deux minutes. N'importe lequel peut disparaître : la liste se corrige ici.
  const RELAIS = {
    mqtt: ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081/mqtt',
      'wss://public.cloud.shiftr.io public public', 'wss://mqtt-dashboard.com:8884/mqtt', 'wss://broker-cn.emqx.io:8084/mqtt'],
    torrent: ['wss://tracker.openwebtorrent.com', 'wss://tracker.webtorrent.dev', 'wss://tracker.files.fm:7073/announce', 'wss://open.ftorrent.com'],
    nostr: ['wss://relay.primal.net', 'wss://nostr.mom', 'wss://relay.nostr.net', 'wss://relay.guggero.org', 'wss://nostrelay.circum.space',
      'wss://relay.nostrhub.fr', 'wss://relay.mostro.network', 'wss://nostr.azzamo.net', 'wss://soloco.nl', 'wss://relay.angor.io',
      'wss://offchain.pub', 'wss://relay.wavlake.com', 'wss://nos.lol', 'wss://yabu.me']
  };
  const ACTIFS = 3, MAX_MACHINES = 4, MAX_PILOTES = 4, TTL = 4;
  const DELAIS = {
    ouverture: 8000,      // une connexion à un relais public qui ne s'ouvre pas en 8 s est un échec
    collecte: 2500,       // candidats ICE réunis au plus 2,5 s avant d'envoyer l'offre, la suite part au fil de l'eau
    apresSrflx: 350,      // … ou 0,35 s après la première adresse publique
    collecteMain: 3000,   // invitation à la main : rien ne peut suivre le texte, on attend un peu plus…
    apresSrflxMain: 1200, // … mais pas plus de 1,2 s après la première adresse publique : les autres serveurs STUN
                          // répondent dans le même aller-retour, et Chrome laisse souvent la collecte ouverte bien
                          // au-delà (serveur muet en IPv6) : l'invitation était prête en 3 s, elle l'est en 1,3 s
    essai: 14000,         // une tentative de liaison qui n'aboutit pas
    coupure: 4000,        // liaison « déconnectée » qui ne revient pas : perdue
    grace: 10000,         // membre injoignable par tout chemin : parti
    reordre: 1500,        // trou dans un flux fiable relayé
    helloInvite: 3000,    // le nouveau venu se signale sur les relais tant qu'il n'est pas admis
    entrer: 2000,
    sansRelais: 9000,
    introuvable: 20000,
    injoignable: 30000,
    invitation: 600000,   // une invitation à la main reste valable dix minutes
    reessai: 60000,       // trois tentatives ratées : une minute avant de recommencer
    menage: 1000,
    etranger: 30000,      // liaison avec une machine jamais admise
    ls: 10000,            // état des liaisons rediffusé
    vus: 120000           // mémoire des messages déjà reçus (copies arrivées par d'autres relais)
  };
  const TEXTES = {
    codeInvalide: 'Ce code n’est pas valide : dix caractères, vérifiez-le.',
    complet: 'Cette partie est complète : quatre pilotes au plus.',
    version: 'L’autre machine a une autre version de BITUME : mettez les deux à jour.',
    webrtc: 'Ce navigateur ne permet pas le jeu en ligne (WebRTC absent).',
    securise: 'Le jeu en ligne par code demande une page sécurisée (https, ou le fichier ouvert sur la machine) : l’invitation à la main reste possible.',
    recherche: 'Recherche de la partie…',
    introuvable: 'Partie introuvable pour l’instant. Vérifiez le code ; l’hôte doit garder la partie ouverte.',
    sansRelais: 'Aucun relais public ne répond. Vérifiez la connexion, ou demandez une invitation à la main.',
    sansRelaisHote: 'Aucun relais public ne répond : le code ne sert pas pour l’instant. Invitez à la main, ou vérifiez la connexion.',
    attente: 'Partie créée. Donnez ce code aux autres pilotes : quatre pilotes au plus.',
    liaison: 'Hôte trouvé : liaison en cours…',
    injoignable: 'L’hôte est trouvé mais aucune liaison ne passe depuis ce réseau (pare-feu, réseau d’opérateur mobile). Essayez un autre réseau, ou l’invitation à la main.',
    illisible: 'Ce texte n’est pas une invitation BITUME : recopiez-le en entier.',
    incomplete: 'Ce texte est incomplet ou abîmé : recopiez-le en entier.',
    perimee: 'Cette réponse ne correspond à aucune invitation en cours : refaites une invitation.',
    pasReponse: 'Collez ici la réponse de l’invité, pas l’invitation.',
    pasInvitation: 'Collez ici l’invitation de l’hôte, pas une réponse.',
    invitationEchec: 'La liaison n’a pas pu s’établir avec cette invitation : les deux réseaux ne se voient pas. Essayez le code, ou un autre réseau.',
    invitationExpiree: 'Invitation expirée (dix minutes) : refaites-en une.'
  };

  const CHAMPS = ['s', 'd', 'v', 'psi', 'beta', 'omega', 'y', 'tangage', 'roulis', 'regime', 'volant', 'rapport', 'gaz', 'frein', 'braquage'];
  const TAILLE_VOITURE = 1 + 4 * CHAMPS.length;

  // ---------------------------------------------------------------- paquets d'état (fonctions pures)
  // [u8 type = 1][f64 t (ms, horloge commune)][u8 n] puis n fois [u8 id][15 × f32]
  function emballer(t, voitures) {
    const buf = new ArrayBuffer(10 + voitures.length * TAILLE_VOITURE), dv = new DataView(buf);
    dv.setUint8(0, 1); dv.setFloat64(1, t, true); dv.setUint8(9, voitures.length);
    let o = 10;
    for (const v of voitures) {
      dv.setUint8(o++, v.id);
      const e = v.etat;
      for (const k of CHAMPS) { dv.setFloat32(o, Number.isFinite(e[k]) ? e[k] : 0, true); o += 4; }
    }
    return buf;
  }
  function deballer(buf) {
    const dv = new DataView(buf);
    if (dv.byteLength < 10 || dv.getUint8(0) !== 1) return null;
    const t = dv.getFloat64(1, true), n = dv.getUint8(9), voitures = [];
    let o = 10;
    for (let i = 0; i < n && o + TAILLE_VOITURE <= dv.byteLength; i++) {
      const etat = { id: dv.getUint8(o++) };
      for (const k of CHAMPS) { etat[k] = dv.getFloat32(o, true); o += 4; }
      voitures.push(etat);
    }
    return { t, voitures };
  }

  // Prolonge un état (repère du circuit) de dt secondes, à vitesse et lacet constants : la cinématique de la conduite.
  // Un état un peu en avance sur le pas (dt < 0, l'autre machine a déjà fait ce pas) est ramené en arrière.
  function prolonger(e, dt, c, sortie) {
    const r = sortie || {};
    for (const k of CHAMPS) r[k] = e[k];
    const pas = 1 / 120, L = c.longueur, sens = dt < 0 ? -1 : 1;
    let reste = Math.min(sens > 0 ? .35 : .1, Math.abs(dt) || 0);
    while (reste > 1e-9) {
      const h = sens * Math.min(pas, reste), k = B.circuit.echantillon(c, r.s).courbure, den = Math.max(1 - k * r.d, .1);
      const ds = r.v * Math.cos(r.psi) / den;
      r.s = ((r.s + ds * h) % L + L) % L; r.d += r.v * Math.sin(r.psi) * h; r.psi += (r.omega - k * ds) * h;
      reste -= Math.abs(h);
    }
    return r;
  }

  // ---------------------------------------------------------------- outils
  const ALPHA62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const encodeur = typeof TextEncoder === 'function' ? new TextEncoder() : null;
  const decodeur = typeof TextDecoder === 'function' ? new TextDecoder() : null;
  const enOctets = s => encodeur.encode(s);
  const enTexte = u => decodeur.decode(u);
  const subtil = () => (globalThis.crypto && globalThis.crypto.subtle) || null;
  const maintenant = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const VIDE = new Uint8Array(0);
  function aleatoire(n) { const u = new Uint8Array(n); globalThis.crypto.getRandomValues(u); return u; }
  function jeton(n) { let s = ''; for (const x of aleatoire(n)) s += ALPHA62[x % 62]; return s; }
  function concat(...parts) {
    let n = 0; for (const p of parts) n += p.length;
    const r = new Uint8Array(n); let o = 0;
    for (const p of parts) { r.set(p, o); o += p.length; }
    return r;
  }
  function b64(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  function deB64(s) { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; }
  const b64url = u => b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const deB64url = s => deB64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const hex = u => Array.from(u, x => x.toString(16).padStart(2, '0')).join('');
  function deHex(s) { const u = new Uint8Array(s.length >> 1); for (let i = 0; i < u.length; i++) u[i] = parseInt(s.substr(2 * i, 2), 16); return u; }
  const propre = t => String(t == null ? '' : t).replace(/[<>&"'`\\\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);
  async function sha256(u) { return new Uint8Array(await subtil().digest('SHA-256', u)); }

  // ---------------------------------------------------------------- code de partie
  // Neuf caractères tirés au hasard (base 32 de Crockford : 45 bits) et un caractère de contrôle (Luhn modulo 32), lu
  // XXXXX-XXXXX. La saisie ignore tirets, espaces et minuscules, et lit O pour 0, I et L pour 1 ; une faute de frappe
  // sur un caractère se voit toujours, avant toute recherche.
  function sommeLuhn(valeurs, facteur) {
    let somme = 0;
    for (let i = valeurs.length - 1; i >= 0; i--) {
      const a = valeurs[i] * facteur;
      somme += Math.floor(a / 32) + a % 32;
      facteur = facteur === 2 ? 1 : 2;
    }
    return somme % 32;
  }
  function nouveauCode() {
    const v = Array.from(aleatoire(9), x => x & 31);
    v.push((32 - sommeLuhn(v, 2)) % 32);
    return v.map(x => CROCKFORD[x]).join('');
  }
  function normaliserCode(texte) {
    const s = String(texte == null ? '' : texte).toUpperCase().replace(/[\s\-_.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    if (!/^[0-9A-HJKMNP-TV-Z]{10}$/.test(s)) return null;
    return sommeLuhn([...s].map(c => CROCKFORD.indexOf(c)), 1) === 0 ? s : null;
  }
  const afficherCode = c => c && c.length === 10 ? c.slice(0, 5) + '-' + c.slice(5) : c || '';

  // ---------------------------------------------------------------- clés tirées du code
  // Le nom public de la salle sur les relais (qui ne révèle pas le code) et la clé AES-GCM qui chiffre et authentifie
  // chaque message. PBKDF2 à 600 000 tours : retrouver un code de 45 bits depuis un nom de salle observé sur un relais
  // demanderait des dizaines d'années de calcul sur une carte graphique.
  async function deriverSalle(code) {
    const S = subtil();
    const base = await S.importKey('raw', enOctets('bitume/code/' + code), 'PBKDF2', false, ['deriveBits']);
    const ikm = await S.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enOctets('bitume/signal/1'), iterations: 600000 }, base, 256);
    const hk = await S.importKey('raw', ikm, 'HKDF', false, ['deriveBits', 'deriveKey']);
    const id = new Uint8Array(await S.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: VIDE, info: enOctets('bitume/salle/1') }, hk, 36 * 8));
    const cle = await S.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: VIDE, info: enOctets('bitume/cle/1') }, hk,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    let hash = '';
    for (let i = 16; i < 36; i++) hash += ALPHA62[id[i] % 62];
    return { salle: hex(id.subarray(0, 16)), hash, genre: 20000 + ((id[0] << 8 | id[1]) % 10000), cle };
  }
  // Enveloppe : [1][protocole][iv 12][AES-GCM(JSON)], données associées « bitume|salle|protocole ». Le numéro de
  // protocole reste lisible : une machine d'une autre version est reconnue et prévenue au lieu d'être ignorée.
  async function sceller(cle, salle, objet, protocole = PROTOCOLE) {
    const iv = aleatoire(12);
    const ct = new Uint8Array(await subtil().encrypt({ name: 'AES-GCM', iv, additionalData: enOctets('bitume|' + salle + '|' + protocole) }, cle, enOctets(JSON.stringify(objet))));
    return concat(Uint8Array.of(1, protocole), iv, ct);
  }
  async function ouvrirEnveloppe(cle, salle, octets) {
    if (!(octets instanceof Uint8Array) || octets.length < 31 || octets[0] !== 1) return null;
    try {
      const p = octets[1];
      const clair = await subtil().decrypt({ name: 'AES-GCM', iv: octets.subarray(2, 14), additionalData: enOctets('bitume|' + salle + '|' + p) }, cle, octets.subarray(14));
      const m = JSON.parse(enTexte(new Uint8Array(clair)));
      return m && typeof m === 'object' && !Array.isArray(m) ? { p, m } : null;
    } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- description de session compacte (invitations)
  // Une offre WebRTC de 800 caractères tient en une centaine d'octets : identifiants ICE, empreinte DTLS, et les
  // candidats UDP (IPv4, IPv6, ou nom mDNS « …local » que Chrome donne à la place de l'adresse locale).
  const SETUPS = ['actpass', 'active', 'passive'];
  const TYPES_CAND = ['host', 'srflx', 'prflx', 'relay'];
  function lireSdp(sdp) {
    const r = { ufrag: '', pwd: '', empreinte: '', setup: 'actpass', mid: '0', port: 5000, candidats: [] };
    for (const ligne of String(sdp).split(/\r?\n/)) {
      let m;
      if ((m = /^a=ice-ufrag:(\S+)/.exec(ligne))) r.ufrag = m[1];
      else if ((m = /^a=ice-pwd:(\S+)/.exec(ligne))) r.pwd = m[1];
      else if ((m = /^a=fingerprint:(.+)$/.exec(ligne))) r.empreinte = m[1].trim();
      else if ((m = /^a=setup:(\w+)/.exec(ligne))) r.setup = m[1];
      else if ((m = /^a=mid:(\S+)/.exec(ligne))) r.mid = m[1];
      else if ((m = /^a=sctp-port:(\d+)/.exec(ligne))) r.port = +m[1];
      else if ((m = /^a=candidate:\S+ (\d+) (\S+) \d+ (\S+) (\d+) typ (\w+)/.exec(ligne))) {
        const type = TYPES_CAND.indexOf(m[5]);
        if (m[1] !== '1' || m[2].toLowerCase() !== 'udp' || type < 0 || r.candidats.length >= 12) continue;
        if (!r.candidats.some(c => c.adresse === m[3] && c.port === +m[4])) r.candidats.push({ adresse: m[3], port: +m[4], type });
      }
    }
    return r;
  }
  function octetsIPv4(s) {
    const p = s.split('.');
    return p.length === 4 && p.every(x => /^\d{1,3}$/.test(x) && +x < 256) ? Uint8Array.from(p.map(Number)) : null;
  }
  function octetsIPv6(s) {
    if (!/^[0-9a-fA-F:]+$/.test(s) || s.indexOf(':') < 0) return null;
    const moities = s.split('::');
    if (moities.length > 2) return null;
    const groupes = x => x ? x.split(':') : [];
    const a = groupes(moities[0]), b = moities.length === 2 ? groupes(moities[1]) : [], manque = 8 - a.length - b.length;
    if (moities.length === 1 ? a.length !== 8 : manque < 1) return null;
    const mots = a.concat(new Array(moities.length === 2 ? manque : 0).fill('0'), b);
    if (!mots.every(w => /^[0-9a-fA-F]{1,4}$/.test(w))) return null;
    const u = new Uint8Array(16);
    mots.forEach((w, i) => { const v = parseInt(w, 16); u[2 * i] = v >> 8; u[2 * i + 1] = v & 255; });
    return u;
  }
  function octetsMdns(s) {
    const m = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i.exec(s);
    return m ? deHex((m[1] + m[2] + m[3] + m[4] + m[5]).toLowerCase()) : null;
  }
  // [drapeaux : setup sur 2 bits, 4 = port SCTP ≠ 5000, 8 = empreinte autre que sha-256][ufrag][pwd][empreinte 32 o]
  // [mid][port ?][n][n × (type | forme << 2, adresse, port)] ; forme 0 IPv4, 1 IPv6, 2 nom mDNS, 3 texte.
  function compacterSdp(sdp) {
    const s = lireSdp(sdp), out = [];
    const octet = x => out.push(x & 255), u16 = x => out.push(x >> 8 & 255, x & 255);
    const chaine = t => { const u = enOctets(t); if (u.length > 255) throw new Error('sdp'); octet(u.length); for (const x of u) out.push(x); };
    const empreinte = /^sha-256 ((?:[0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2})$/.exec(s.empreinte);
    if (!s.ufrag || !s.pwd || !s.empreinte) throw new Error('sdp');
    const drapeaux = Math.max(0, SETUPS.indexOf(s.setup)) | (s.port !== 5000 ? 4 : 0) | (empreinte ? 0 : 8);
    octet(drapeaux); chaine(s.ufrag); chaine(s.pwd);
    if (empreinte) for (const x of deHex(empreinte[1].replace(/:/g, ''))) out.push(x); else chaine(s.empreinte);
    chaine(s.mid);
    if (drapeaux & 4) u16(s.port);
    octet(s.candidats.length);
    for (const c of s.candidats) {
      let forme = 0, a = octetsIPv4(c.adresse);
      if (!a) { forme = 1; a = octetsIPv6(c.adresse); }
      if (!a) { forme = 2; a = octetsMdns(c.adresse); }
      if (!a) forme = 3;
      octet(c.type | forme << 2);
      if (forme === 3) chaine(c.adresse); else for (const x of a) out.push(x);
      u16(c.port);
    }
    return Uint8Array.from(out);
  }
  function lireCompact(u, o = 0) {
    const octet = () => { if (o >= u.length) throw new Error('court'); return u[o++]; };
    const u16 = () => octet() << 8 | octet();
    const octets = n => { if (o + n > u.length) throw new Error('court'); const r = u.subarray(o, o + n); o += n; return r; };
    const chaine = () => enTexte(octets(octet()));
    const d = octet();
    const r = { setup: SETUPS[d & 3] || 'actpass', ufrag: chaine(), pwd: chaine() };
    r.empreinte = d & 8 ? chaine() : 'sha-256 ' + hex(octets(32)).toUpperCase().match(/../g).join(':');
    r.mid = chaine();
    r.port = d & 4 ? u16() : 5000;
    const n = octet();
    r.candidats = [];
    for (let i = 0; i < n; i++) {
      const k = octet(), forme = k >> 2 & 3, type = k & 3;
      let adresse;
      if (forme === 0) adresse = Array.from(octets(4)).join('.');
      else if (forme === 1) { const b = octets(16), w = []; for (let j = 0; j < 16; j += 2) w.push((b[j] << 8 | b[j + 1]).toString(16)); adresse = w.join(':'); }
      else if (forme === 2) { const h = hex(octets(16)); adresse = h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20) + '.local'; }
      else adresse = chaine();
      r.candidats.push({ type, adresse, port: u16() });
    }
    return { sdp: r, fin: o };
  }
  function sdpDepuisCompact(r) {
    const l = ['v=0', 'o=- ' + (1 + Math.floor(Math.random() * 9e14)) + ' 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE ' + r.mid,
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0'];
    r.candidats.forEach((c, k) => l.push('a=candidate:' + (k + 1) + ' 1 udp ' + ([126, 100, 110, 0][c.type] * 16777216 + (65535 - k) * 256 + 255) + ' ' +
      c.adresse + ' ' + c.port + ' typ ' + TYPES_CAND[c.type] + (c.type ? ' raddr 0.0.0.0 rport 0' : '') + ' generation 0'));
    l.push('a=end-of-candidates', 'a=ice-ufrag:' + r.ufrag, 'a=ice-pwd:' + r.pwd, 'a=ice-options:trickle', 'a=fingerprint:' + r.empreinte,
      'a=setup:' + r.setup, 'a=mid:' + r.mid, 'a=sctp-port:' + r.port, 'a=max-message-size:262144');
    return l.join('\r\n') + '\r\n';
  }
  // Invitation : [0xB7][protocole][genre 1 invitation, 2 réponse][n° u16][drapeaux, 1 = code][code, 7 octets]
  // [description compacte][Fletcher-16], en base64url : 150 à 250 caractères, un QR code de version 10 environ.
  function fletcher(u) { let a = 0, b = 0; for (const x of u) { a = (a + x) % 255; b = (b + a) % 255; } return b << 8 | a; }
  function emballerCode(code) {
    const bits = [];
    for (const c of code) { const v = CROCKFORD.indexOf(c); for (let b = 4; b >= 0; b--) bits.push(v >> b & 1); }
    while (bits.length < 56) bits.push(0);
    const u = new Uint8Array(7);
    for (let i = 0; i < 56; i++) u[i >> 3] |= bits[i] << (7 - (i & 7));
    return u;
  }
  function deballerCode(u) {
    let s = '';
    for (let k = 0; k < 10; k++) { let v = 0; for (let b = 0; b < 5; b++) { const i = k * 5 + b; v = v << 1 | (u[i >> 3] >> (7 - (i & 7)) & 1); } s += CROCKFORD[v]; }
    return normaliserCode(s);
  }
  function emballerInvitation(genre, n, code, sdp) {
    const tete = [0xB7, PROTOCOLE, genre, n >> 8 & 255, n & 255, code ? 1 : 0];
    const tout = concat(Uint8Array.from(tete), code ? emballerCode(code) : VIDE, compacterSdp(sdp)), f = fletcher(tout);
    return b64url(concat(tout, Uint8Array.of(f >> 8, f & 255)));
  }
  // Accepte le lien complet, « …invitation=… » ou le texte seul, même coupé de retours à la ligne par une messagerie.
  function lireInvitation(texte) {
    let s = String(texte == null ? '' : texte).trim();
    const m = /invitation=([A-Za-z0-9_\-\s]+)/.exec(s);
    if (m) s = m[1];
    s = s.replace(/[^A-Za-z0-9_-]/g, '');
    let u;
    try { u = deB64url(s); } catch (e) { return { erreur: 'illisible' }; }
    if (u.length < 12 || u[0] !== 0xB7) return { erreur: 'illisible' };
    if ((u[u.length - 2] << 8 | u[u.length - 1]) !== fletcher(u.subarray(0, u.length - 2))) return { erreur: 'incomplete' };
    if (u[1] !== PROTOCOLE) return { erreur: 'version' };
    const genre = u[2], n = u[3] << 8 | u[4];
    let o = 6, code = null;
    if (u[5] & 1) { code = deballerCode(u.subarray(6, 13)); o = 13; }
    try {
      const { sdp, fin } = lireCompact(u.subarray(0, u.length - 2), o);
      if (fin !== u.length - 2) return { erreur: 'illisible' };
      return { genre, n, code, sdp: sdpDepuisCompact(sdp), compact: sdp };
    } catch (e) { return { erreur: 'illisible' }; }
  }

  // ---------------------------------------------------------------- QR code (mode octets, versions 1 à 20)
  // Pour montrer une invitation à un téléphone ou la photographier : niveau de correction M (15 %), L si le texte est
  // trop long, masque choisi par les pénalités de la norme. Rend { taille, version, niveau, modules } (1 = noir).
  const QR_EC = { L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28],
    M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26] };
  const QR_BLOCS = { L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8],
    M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16] };
  function qrModulesUtiles(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function qrAlignements(v) {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2, pas = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2, r = [6];
    for (let p = v * 4 + 10; r.length < n; p -= pas) r.splice(1, 0, p);
    return r;
  }
  function gfMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function rsDiviseur(degre) {
    const r = new Array(degre).fill(0);
    r[degre - 1] = 1;
    let racine = 1;
    for (let i = 0; i < degre; i++) {
      for (let j = 0; j < degre; j++) { r[j] = gfMul(r[j], racine); if (j + 1 < degre) r[j] ^= r[j + 1]; }
      racine = gfMul(racine, 2);
    }
    return r;
  }
  function rsReste(donnees, diviseur) {
    const r = diviseur.map(() => 0);
    for (const b of donnees) { const f = b ^ r.shift(); r.push(0); diviseur.forEach((c, i) => { r[i] ^= gfMul(c, f); }); }
    return r;
  }
  function masqueQr(m, x, y) {
    switch (m) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return x * y % 2 + x * y % 3 === 0;
      case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
      default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
    }
  }
  function penaliteQr(C, n) {
    let p = 0, noirs = 0;
    const M1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], M2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let sens = 0; sens < 2; sens++) for (let a = 0; a < n; a++) {
      let suite = 0, prec = -1;
      const lu = b => sens ? C[b * n + a] : C[a * n + b];
      for (let b = 0; b < n; b++) {
        const c = lu(b);
        if (c === prec) { suite++; if (suite === 5) p += 3; else if (suite > 5) p++; } else { suite = 1; prec = c; }
        if (b <= n - 11) {
          let un = true, deux = true;
          for (let k = 0; k < 11 && (un || deux); k++) { const x = lu(b + k); if (x !== M1[k]) un = false; if (x !== M2[k]) deux = false; }
          if (un) p += 40; if (deux) p += 40;
        }
      }
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = C[y * n + x]; noirs += c;
      if (x < n - 1 && y < n - 1 && c === C[y * n + x + 1] && c === C[(y + 1) * n + x] && c === C[(y + 1) * n + x + 1]) p += 3;
    }
    return p + (Math.ceil(Math.abs(noirs * 20 - n * n * 10) / (n * n)) - 1) * 10;
  }
  function qr(texte, niveauImpose) {
    const donnees = enOctets(String(texte));
    for (const niveau of niveauImpose ? [niveauImpose] : ['M', 'L']) for (let v = 1; v <= 20; v++) {
      const ec = QR_EC[niveau][v - 1], nb = QR_BLOCS[niveau][v - 1], capacite = Math.floor(qrModulesUtiles(v) / 8) - ec * nb;
      if (4 + (v < 10 ? 8 : 16) + donnees.length * 8 <= capacite * 8) return qrDessiner(v, niveau, donnees, capacite, ec, nb);
    }
    return null;
  }
  function qrDessiner(v, niveau, donnees, capacite, ec, nb) {
    const bits = [], pousser = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push(val >>> i & 1); };
    pousser(4, 4); pousser(donnees.length, v < 10 ? 8 : 16);
    for (const b of donnees) pousser(b, 8);
    pousser(0, Math.min(4, capacite * 8 - bits.length));
    pousser(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < capacite * 8; pad ^= 0xEC ^ 0x11) pousser(pad, 8);
    const mots = [];
    for (let i = 0; i < bits.length; i += 8) { let x = 0; for (let j = 0; j < 8; j++) x = x << 1 | bits[i + j]; mots.push(x); }
    const total = Math.floor(qrModulesUtiles(v) / 8), courts = nb - total % nb, longCourt = Math.floor(total / nb), div = rsDiviseur(ec), blocs = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const d = mots.slice(k, k + longCourt - ec + (i < courts ? 0 : 1));
      k += d.length;
      const e = rsReste(d, div);
      if (i < courts) d.push(0);
      blocs.push(d.concat(e));
    }
    const flux = [];
    for (let i = 0; i < blocs[0].length; i++) for (let j = 0; j < nb; j++) if (i !== longCourt - ec || j >= courts) flux.push(blocs[j][i]);
    const n = v * 4 + 17, M = new Uint8Array(n * n), F = new Uint8Array(n * n);
    const fixe = (x, y, noir) => { M[y * n + x] = noir ? 1 : 0; F[y * n + x] = 1; };
    for (let i = 0; i < n; i++) { fixe(6, i, i % 2 === 0); fixe(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < n && y >= 0 && y < n) fixe(x, y, d !== 2 && d !== 4);
    }
    const pos = qrAlignements(v), np = pos.length;
    for (let i = 0; i < np; i++) for (let j = 0; j < np; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === np - 1) || (i === np - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fixe(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const format = (C, masque, reserver) => {
      const d = (niveau === 'L' ? 1 : 0) << 3 | masque;
      let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = (d << 10 | r) ^ 0x5412, bit = i => b >>> i & 1;
      const pose = (x, y, val) => { C[y * n + x] = val; if (reserver) F[y * n + x] = 1; };
      for (let i = 0; i <= 5; i++) pose(8, i, bit(i));
      pose(8, 7, bit(6)); pose(8, 8, bit(7)); pose(7, 8, bit(8));
      for (let i = 9; i < 15; i++) pose(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) pose(n - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) pose(8, n - 15 + i, bit(i));
      pose(8, n - 8, 1);
    };
    format(M, 0, true);
    if (v >= 7) {
      let r = v;
      for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const b = v << 12 | r;
      for (let i = 0; i < 18; i++) { const val = b >>> i & 1, a = n - 11 + i % 3, c = Math.floor(i / 3); fixe(a, c, val); fixe(c, a, val); }
    }
    let i = 0;
    for (let droite = n - 1; droite >= 1; droite -= 2) {
      if (droite === 6) droite = 5;
      for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
        const x = droite - j, y = ((droite + 1) & 2) === 0 ? n - 1 - vert : vert;
        if (!F[y * n + x] && i < flux.length * 8) { M[y * n + x] = flux[i >>> 3] >>> (7 - (i & 7)) & 1; i++; }
      }
    }
    let meilleur = null, score = Infinity, choisi = 0;
    for (let m = 0; m < 8; m++) {
      const C = M.slice();
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!F[y * n + x] && masqueQr(m, x, y)) C[y * n + x] ^= 1;
      format(C, m, false);
      const p = penaliteQr(C, n);
      if (p < score) { score = p; meilleur = C; choisi = m; }
    }
    return { taille: n, version: v, niveau, masque: choisi, modules: meilleur };
  }

  // ---------------------------------------------------------------- Nostr : signature BIP-340 (secp256k1)
  // Les relais Nostr n'acceptent que des événements signés : une clé jetable par session, sans bibliothèque. Écrit
  // avec BigInt() et jamais de littéral « 1n » : un navigateur sans BigInt garde le jeu, seul Nostr y renonce.
  let SECP = null;
  function secp() {
    if (SECP) return SECP;
    const I = x => BigInt(x), Z = I(0), U = I(1), D = I(2), T = I(3), H = I(8);
    const P = I('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
    const N = I('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    const G = [I('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'), I('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8'), U];
    const md = (a, m) => { const r = a % m; return r < Z ? r + m : r; };
    const inv = (a, m) => { let r0 = md(a, m), r1 = m, s0 = U, s1 = Z; while (r1 !== Z) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; } return md(s0, m); };
    const INF = [Z, U, Z];
    // coordonnées jacobiennes (X / Z², Y / Z³), a = 0
    const dbl = ([X, Y, Zc]) => {
      if (Zc === Z || Y === Z) return INF;
      const A = md(X * X, P), Bq = md(Y * Y, P), C = md(Bq * Bq, P);
      const Dd = md(D * (md((X + Bq) * (X + Bq), P) - A - C), P), E = md(T * A, P), F = md(E * E, P);
      const X3 = md(F - D * Dd, P);
      return [X3, md(E * (Dd - X3) - H * C, P), md(D * Y * Zc, P)];
    };
    const add = (p1, p2) => {
      if (p1[2] === Z) return p2;
      if (p2[2] === Z) return p1;
      const [X1, Y1, Z1] = p1, [X2, Y2, Z2] = p2, Z1Z1 = md(Z1 * Z1, P), Z2Z2 = md(Z2 * Z2, P);
      const U1 = md(X1 * Z2Z2, P), U2 = md(X2 * Z1Z1, P), S1 = md(Y1 * Z2 * Z2Z2, P), S2 = md(Y2 * Z1 * Z1Z1, P);
      if (U1 === U2) return S1 === S2 ? dbl(p1) : INF;
      const Hh = md(U2 - U1, P), R = md(S2 - S1, P), HH = md(Hh * Hh, P), HHH = md(Hh * HH, P), V = md(U1 * HH, P);
      const X3 = md(R * R - HHH - D * V, P);
      return [X3, md(R * (V - X3) - S1 * HHH, P), md(Z1 * Z2 * Hh, P)];
    };
    const mul = (k, pt) => { let r = INF; const b = k.toString(2); for (let j = 0; j < b.length; j++) { r = dbl(r); if (b[j] === '1') r = add(r, pt); } return r; };
    const affine = ([X, Y, Zc]) => { const zi = inv(Zc, P), zi2 = md(zi * zi, P); return [md(X * zi2, P), md(Y * zi2 * zi, P)]; };
    const versOctets = x => deHex(x.toString(16).padStart(64, '0'));
    const versNombre = u => BigInt('0x' + (hex(u) || '0'));
    const xor = (a, b) => a.map((x, i) => x ^ b[i]);
    async function balise(tag, ...parts) { const t = await sha256(enOctets(tag)); return sha256(concat(t, t, ...parts)); }
    function cle(secret) {
      const d0 = versNombre(secret);
      if (d0 === Z || d0 >= N) throw new Error('clé');
      const [x, y] = affine(mul(d0, G));
      return { d: y % D === Z ? d0 : N - d0, px: versOctets(x) };
    }
    async function signer(k, message, aux) {
      const t = xor(versOctets(k.d), await balise('BIP0340/aux', aux));
      const k0 = md(versNombre(await balise('BIP0340/nonce', t, k.px, message)), N);
      if (k0 === Z) throw new Error('nonce');
      const [rx, ry] = affine(mul(k0, G)), kk = ry % D === Z ? k0 : N - k0, rb = versOctets(rx);
      const e = md(versNombre(await balise('BIP0340/challenge', rb, k.px, message)), N);
      return concat(rb, versOctets(md(kk + e * k.d, N)));
    }
    SECP = { cle, signer };
    return SECP;
  }

  // ---------------------------------------------------------------- relais publics : clients minimaux
  // Chaque nature : preparer(octets, destinataire?) → trame commune à tous ses relais ; ouvrir(url, ctx, r) → client,
  // où r.pret(), r.recu(octets), r.refus(raison), r.ferme(), r.pause(ms). Un destinataire est l'identité de session
  // (pid) d'une machine ; sans destinataire, le message va à toute la salle.
  function mqttLongueur(n) { const r = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; r.push(b); } while (n > 0); return Uint8Array.from(r); }
  const mqttPaquet = (tete, corps) => concat(Uint8Array.of(tete), mqttLongueur(corps.length), corps);
  const mqttChaine = s => { const u = enOctets(s); return concat(Uint8Array.of(u.length >> 8, u.length & 255), u); };
  const MQTT = {
    // MQTT 3.1.1 sur WebSocket : un sujet pour la salle, un par machine pour les messages adressés.
    preparer: (octets, a, ctx) => mqttPaquet(0x30, concat(mqttChaine(a ? ctx.salle + '/' + a : ctx.salle), octets)),
    ouvrir(adresse, ctx, r) {
      const [url, utilisateur, motDePasse] = adresse.split(' ');
      const ws = new ctx.WS(url, ['mqtt']);
      ws.binaryType = 'arraybuffer';
      let tampon = VIDE, vu = maintenant(), ping = null, pret = false;
      const envoyer = t => { if (ws.readyState === 1) ws.send(t); };
      ws.onopen = () => {
        const drapeaux = 0x02 | (utilisateur ? 0x80 : 0) | (motDePasse ? 0x40 : 0);
        envoyer(mqttPaquet(0x10, concat(mqttChaine('MQTT'), Uint8Array.of(4, drapeaux, 0, 60), mqttChaine('b' + jeton(19)),
          utilisateur ? mqttChaine(utilisateur) : VIDE, motDePasse ? mqttChaine(motDePasse) : VIDE)));
        ping = setInterval(() => { if (maintenant() - vu > 70000) { try { ws.close(); } catch (e) { /* déjà fermé */ } } else envoyer(Uint8Array.of(0xC0, 0)); }, 25000);
      };
      const traiter = (tete, corps) => {
        const t = tete >> 4;
        if (t === 2) {
          if (corps[1] !== 0) r.refus('connexion refusée (' + corps[1] + ')');
          else envoyer(mqttPaquet(0x82, concat(Uint8Array.of(0, 1), mqttChaine(ctx.salle), Uint8Array.of(0), mqttChaine(ctx.salle + '/' + ctx.pid), Uint8Array.of(0))));
        } else if (t === 9) {
          if (Array.from(corps.subarray(2)).some(x => x === 0x80)) r.refus('abonnement refusé');
          else if (!pret) { pret = true; r.pret(); }
        } else if (t === 3) {
          const qos = tete >> 1 & 3;
          let o = 2 + (corps[0] << 8 | corps[1]);
          if (qos) { if (qos === 1) envoyer(concat(Uint8Array.of(0x40, 2), corps.subarray(o, o + 2))); o += 2; }
          if (o <= corps.length) r.recu(corps.slice(o));
        }
      };
      ws.onmessage = ev => {
        vu = maintenant();
        tampon = concat(tampon, new Uint8Array(ev.data));
        for (;;) {
          if (tampon.length < 2) return;
          let lng = 0, mult = 1, i = 1, fin = false;
          while (i < tampon.length && i <= 4) { const b = tampon[i++]; lng += (b & 127) * mult; mult *= 128; if (!(b & 128)) { fin = true; break; } }
          if (!fin) { if (i > 4) ws.close(); return; }
          if (tampon.length < i + lng) return;
          const tete = tampon[0], corps = tampon.slice(i, i + lng);
          tampon = tampon.slice(i + lng);
          traiter(tete, corps);
        }
      };
      ws.onclose = () => { clearInterval(ping); r.ferme(); };
      return { envoyerBrut: envoyer, fermer() { clearInterval(ping); try { envoyer(Uint8Array.of(0xE0, 0)); ws.close(); } catch (e) { /* déjà fermé */ } } };
    }
  };
  const TORRENT = {
    // Traqueur WebTorrent : diffuser, c'est annoncer des « offres » que le traqueur remet chacune à une autre machine de
    // l'essaim (cinq copies : toute la salle, et de la marge pour un pair disparu que le traqueur garderait). Trois
    // traqueurs sur quatre refusent une « réponse » adressée sans offre d'origine (essai du 18/11) : tout part donc à la
    // salle, et le destinataire inscrit dans l'enveloppe chiffrée est seul à la garder. Le traqueur ne lit jamais la
    // description de session : elle porte notre enveloppe.
    preparer(octets, a, ctx) {
      const sdp = b64(octets);
      return JSON.stringify({ action: 'announce', info_hash: ctx.hash, peer_id: ctx.pid, numwant: 5,
        offers: [0, 1, 2, 3, 4].map(() => ({ offer_id: jeton(20), offer: { type: 'offer', sdp } })) });
    },
    ouvrir(url, ctx, r) {
      const ws = new ctx.WS(url);
      let pret = false, minuteur = null;
      const envoyer = t => { if (ws.readyState === 1) ws.send(t); };
      const annoncer = () => envoyer(JSON.stringify(Object.assign({ action: 'announce', info_hash: ctx.hash, peer_id: ctx.pid, numwant: 0 }, pret ? {} : { event: 'started' })));
      ws.onopen = () => { annoncer(); minuteur = setInterval(annoncer, 50000); };
      ws.onmessage = ev => {
        let m;
        try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : enTexte(new Uint8Array(ev.data))); } catch (e) { return; }
        if (!m || typeof m !== 'object') return;
        if (m['failure reason']) { if (!pret) r.refus(String(m['failure reason'])); return; }   // après coup : pair introuvable, sans gravité
        if (m.info_hash !== ctx.hash) return;
        const charge = (m.offer && m.offer.sdp) || (m.answer && m.answer.sdp);
        if (typeof charge === 'string') { try { r.recu(deB64(charge)); } catch (e) { /* charge illisible */ } return; }
        if (!pret && m.action === 'announce') { pret = true; r.pret(); }
      };
      ws.onclose = () => { clearInterval(minuteur); r.ferme(); };
      return { envoyerBrut: envoyer, fermer() { clearInterval(minuteur); try { ws.close(); } catch (e) { /* déjà fermé */ } } };
    }
  };
  const NOSTR = {
    // Nostr : événements éphémères (genre 20000 à 29999, jamais conservés), étiquette « x » = salle ou salle.pid.
    async preparer(octets, a, ctx) {
      const k = await ctx.cleNostr();
      const ev = { pubkey: k.pub, created_at: Math.floor(Date.now() / 1000), kind: ctx.genre, tags: [['x', a ? ctx.salle + '.' + a : ctx.salle]], content: b64(octets) };
      const id = await sha256(enOctets(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content])));
      ev.id = hex(id);
      ev.sig = hex(await secp().signer(k, id, aleatoire(32)));
      return JSON.stringify(['EVENT', ev]);
    },
    ouvrir(url, ctx, r) {
      const ws = new ctx.WS(url), sub = 'b' + jeton(11);
      let pret = false;
      const envoyer = t => { if (ws.readyState === 1) ws.send(t); };
      ws.onopen = () => envoyer(JSON.stringify(['REQ', sub, { kinds: [ctx.genre], '#x': [ctx.salle, ctx.salle + '.' + ctx.pid], since: Math.floor(Date.now() / 1000) - 30 }]));
      ws.onmessage = ev => {
        let m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (!Array.isArray(m)) return;
        if (m[0] === 'EOSE' && m[1] === sub) { if (!pret) { pret = true; r.pret(); } }
        else if (m[0] === 'EVENT' && m[1] === sub && m[2] && typeof m[2].content === 'string') {
          if (m[2].pubkey === ctx.pubNostr || m[2].kind !== ctx.genre) return;
          try { r.recu(deB64(m[2].content)); } catch (e) { /* contenu illisible */ }
        } else if (m[0] === 'OK' && m[2] === false) {
          const raison = String(m[3] || '');
          if (/^duplicate:/.test(raison)) return;
          if (/^rate-limited:/.test(raison)) r.pause(5000); else r.refus(raison || 'refusé');
        } else if (m[0] === 'CLOSED' && m[1] === sub) r.refus(String(m[2] || 'abonnement fermé'));
      };
      ws.onclose = () => r.ferme();
      return { envoyerBrut: envoyer, fermer() { try { envoyer(JSON.stringify(['CLOSE', sub])); ws.close(); } catch (e) { /* déjà fermé */ } } };
    }
  };
  const SALON = {
    // Le salon de David (serveur/salon.mjs) comme simple boîte aux lettres : tout part à la salle, chiffré comme ailleurs.
    preparer: octets => JSON.stringify({ t: 'relais', m: { o: b64(octets) } }),
    ouvrir(url, ctx, r) {
      const ws = ctx.salonWs;
      if (!ws || ws.readyState !== 1) { setTimeout(() => r.ferme(), 0); return { envoyerBrut() {}, fermer() {} }; }
      ws.onmessage = ev => {
        if (typeof ev.data !== 'string') return;
        let m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'relais' && m.m && typeof m.m.o === 'string') { try { r.recu(deB64(m.m.o)); } catch (e) { /* illisible */ } }
      };
      ws.onclose = () => r.ferme();
      setTimeout(() => r.pret(), 0);
      return { envoyerBrut: t => { if (ws.readyState === 1) ws.send(t); }, fermer() { try { ws.close(); } catch (e) { /* déjà fermé */ } } };
    }
  };
  const FAMILLES = { mqtt: MQTT, torrent: TORRENT, nostr: NOSTR, salon: SALON };

  // ---------------------------------------------------------------- rendez-vous : la signalisation par les relais
  // Chaque message part sur tous les relais prêts (trois par nature) ; un relais qui devient prêt reçoit les messages
  // des dix dernières secondes ; à l'arrivée, la première copie passe, les autres sont écartées par leur identifiant.
  function rendezVous(ctx, rappels) {
    const D = ctx.delais || DELAIS, liens = [], morts = new Map(), vus = new Map(), recents = [], premiers = {};
    let ferme = false;
    const nettoyer = adresse => adresse.split(' ')[0];
    function entretenir() {
      if (ferme) return;
      for (const famille of Object.keys(ctx.familles)) {
        const quota = famille === 'salon' ? 1 : ACTIFS;
        let actifs = liens.filter(L => L.famille === famille).length;
        for (const url of ctx.familles[famille]) {
          if (actifs >= quota) break;
          if (liens.some(L => L.famille === famille && L.url === url) || (morts.get(famille + url) || 0) > maintenant()) continue;
          ouvrirLien(famille, url);
          actifs++;
        }
      }
    }
    function ouvrirLien(famille, url) {
      const L = { famille, url, pret: false, echecs: 0, envoyes: 0, recus: 0, premiers: 0, latence: null, ouvertures: 0, refus: null, client: null, minuteur: null, pause: 0, depuis: 0 };
      liens.push(L);
      const essayer = () => {
        if (ferme || !liens.includes(L)) return;
        const debut = maintenant();
        let ok = false, fini = false;
        const fin = refus => {
          if (fini) return;
          fini = true;
          clearTimeout(L.minuteur);
          const client = L.client, etaitPret = L.pret;
          L.client = null; L.pret = false;
          try { if (client) client.fermer(); } catch (e) { /* déjà fermé */ }
          if (ferme) return;
          if (etaitPret) rappels.change(L);
          if (refus) L.refus = refus;
          if (!ok || maintenant() - L.depuis < 10000) L.echecs++; else L.echecs = 0;
          if (refus || L.echecs >= 3 || famille === 'salon') {
            liens.splice(liens.indexOf(L), 1);
            morts.set(famille + url, maintenant() + 120000);
            rappels.change(L);
            entretenir();
            return;
          }
          L.minuteur = setTimeout(essayer, 1000 * Math.pow(2, L.echecs));
        };
        try {
          L.client = FAMILLES[famille].ouvrir(url, ctx, {
            pret: () => {
              if (fini || ok) return;
              ok = true; L.pret = true; L.depuis = maintenant(); L.ouvertures++;
              if (L.latence == null) L.latence = Math.round(maintenant() - debut);
              clearTimeout(L.minuteur);
              rappels.change(L);
              for (const m of recents) if (maintenant() - m.t < 10000) diffuser(m.octets, m.a, [L]);
            },
            recu: octets => { if (!fini) recevoir(octets, L); },
            refus: raison => fin(String(raison || 'refus')),
            ferme: () => fin(null),
            pause: ms => { L.pause = maintenant() + ms; }
          });
        } catch (e) { fin(null); return; }
        L.minuteur = setTimeout(() => { if (!ok) fin(null); }, D.ouverture);
      };
      essayer();
    }
    async function recevoir(octets, L) {
      L.recus++;
      const r = await ouvrirEnveloppe(ctx.cle, ctx.salle, octets);
      if (!r || ferme) return;
      const m = r.m;
      if (typeof m.k !== 'string' || typeof m.de !== 'string' || m.de === ctx.pid) return;
      if (m.a && m.a !== '*' && m.a !== ctx.pid) return;
      if (vus.has(m.k)) return;
      vus.set(m.k, maintenant());
      L.premiers++;
      premiers[L.famille] = (premiers[L.famille] || 0) + 1;
      rappels.message(m, r.p, L);
    }
    function diffuser(octets, a, cibles) {
      const trames = new Map();
      for (const L of cibles) {
        if (!L.pret || L.pause > maintenant()) continue;
        let t = trames.get(L.famille);
        if (!t) { t = Promise.resolve().then(() => FAMILLES[L.famille].preparer(octets, a, ctx)); trames.set(L.famille, t); }
        t.then(trame => { if (L.pret && L.client) { L.client.envoyerBrut(trame); L.envoyes++; } }, () => {});
      }
    }
    const minuteur = setInterval(() => {
      for (const [k, t] of vus) if (maintenant() - t > D.vus) vus.delete(k);
      entretenir();
    }, 5000);
    entretenir();
    return {
      async envoyer(objet, a) {
        if (ferme) return;
        const m = Object.assign({}, objet, { k: jeton(12), de: ctx.pid, a: a || '*' });
        vus.set(m.k, maintenant());
        const octets = await sceller(ctx.cle, ctx.salle, m, objet.p || PROTOCOLE);
        recents.push({ octets, a: a || null, t: maintenant() });
        while (recents.length && maintenant() - recents[0].t > 10000) recents.shift();
        diffuser(octets, a || null, liens);
      },
      pret: () => liens.some(L => L.pret),
      etat: () => liens.map(L => ({ famille: L.famille, url: nettoyer(L.url), pret: L.pret, latence: L.latence, ouvertures: L.ouvertures,
        envoyes: L.envoyes, recus: L.recus, premiers: L.premiers, echecs: L.echecs, refus: L.refus })),
      premiers,
      fermer() {
        ferme = true;
        clearInterval(minuteur);
        for (const L of liens.splice(0)) { clearTimeout(L.minuteur); try { if (L.client) L.client.fermer(); } catch (e) { /* déjà fermé */ } }
      }
    };
  }

  // ---------------------------------------------------------------- liaison
  // Maillage : chaque machine tente une liaison directe avec chacune des autres (trois au plus) : l'hôte appelle, sinon
  // la machine admise la première, et tout membre appelle un nouveau venu qui se signale. Chaque machine diffuse la
  // liste de ses voisins directs ; un message pour une machine sans liaison directe passe par le plus court chemin
  // (une troisième machine). L'hôte (machine 0) admet les machines et tient la liste ; l'horloge commune est la sienne.
  function creer(options = {}) {
    const RTC = options.RTCPeerConnection || globalThis.RTCPeerConnection;
    const WS = options.WebSocket || globalThis.WebSocket;
    const D = Object.assign({}, DELAIS, options.delais || {});
    const salonUrl = options.salon || options.url || null;
    const familles = choisirFamilles(options.relais);
    const ecoute = {}, pairs = new Map(), liens = new Map(), connus = new Map(), ls = new Map(), sorties = new Map(), entrees = new Map();
    const invitations = new Map(), essais = new Map(), echantillons = [];
    const pid = jeton(20), debut = maintenant();
    let routes = new Map(), rv = null, minuteurMenage = null, minuteurPing = null, monSeq = 0, prochainId = 1, termine = false;
    let hoteConnu = null, dernierEntrer = -1e9, prochainHello = 0, dernierLs = 0, debutRecherche = 0, premierRelais = 0, premiereOffre = 0;
    let cleNostr = null, quitter = null;
    const R = { etat: 'ferme', role: null, id: -1, code: null, pid, membres: [], rtt: 0, decalage: 0, synchro: false, pairs, statut: null,
      nom: propre(options.nom), joueurs: options.joueurs === 2 ? 2 : 1, essai: { sansDirect: new Set() },
      signalisation: { mode: salonUrl ? 'salon' : Object.keys(familles).length ? 'relais' : 'main', premiers: {}, journal: [], transports: [] } };
    Object.defineProperty(R, 'relais', { get: () => [...pairs.values()].some(p => p.pret && p.relais) });
    Object.defineProperty(R.signalisation, 'transports', { get: () => rv ? rv.etat() : [] });
    const emettre = (nom, ...x) => { for (const f of ecoute[nom] || []) { try { f(...x); } catch (e) { console.error(e); } } };
    R.on = (nom, f) => { (ecoute[nom] || (ecoute[nom] = [])).push(f); return R; };
    R.pretAvec = id => { const p = pairs.get(id); return !!(p && p.pret); };
    R.horloge = () => maintenant() + (R.role === 'invite' ? R.decalage : 0);
    const noter = (quoi, x) => { const j = R.signalisation.journal; j.push(Object.assign({ t: Math.round(maintenant() - debut), quoi }, x || {})); if (j.length > 300) j.shift(); };
    const court = p => String(p || '').slice(0, 6);
    function statut(code) {
      if (R.statut === code || termine) return;
      R.statut = code; noter('statut', { code });
      emettre('statut', code, TEXTES[code] || '');
    }
    const moiMembre = () => R.id >= 0;
    const membreParPid = p => R.membres.find(m => m.pid === p);
    const membreParId = id => R.membres.find(m => m.id === id);
    const hotePid = () => { const h = membreParId(0); return h ? h.pid : hoteConnu; };
    const bloque = autre => { const m = membreParPid(autre), s = R.essai.sansDirect; return s.has(autre) || !!(m && s.has(m.id)); };

    // ------------------------------------------------ transports de signalisation
    // clé Nostr de la session, tirée une fois (une multiplication sur la courbe, quelques millisecondes)
    cleNostr = () => cleNostr.p || (cleNostr.p = Promise.resolve().then(() => { const k = secp().cle(aleatoire(32)); k.pub = hex(k.px); return k; }));
    async function lancerRendezVous(code, salonWs) {
      if (!subtil()) { statut('securise'); throw new Error('securise'); }
      const c = await deriverSalle(code);
      if (termine) return;
      const ctx = Object.assign({}, c, { pid, WS, delais: D, salonWs, cleNostr, pubNostr: null, familles: salonWs ? { salon: [salonUrl] } : familles });
      if (ctx.familles.nostr) cleNostr().then(k => { ctx.pubNostr = k.pub; }, () => {});
      rv = rendezVous(ctx, { message: surRendezVous, change: surTransport });
      debutRecherche = maintenant();
      noter('salle', { familles: Object.keys(ctx.familles) });
      // le premier « hello » est gardé dix secondes et repart sur chaque relais à mesure qu'il devient prêt
      if (R.role === 'invite' && !moiMembre()) hello();
    }
    function surTransport(L) {
      if (termine) return;
      noter(L.pret ? 'relais prêt' : 'relais perdu', { famille: L.famille, url: L.url.split(' ')[0], latence: L.latence, refus: L.refus || undefined });
      if (L.pret && !premierRelais) premierRelais = maintenant();
      if (L.pret && R.role === 'hote' && R.statut === 'sansRelaisHote') statut('attente');
      emettre('signalisation', R.relaisEtat());
    }
    function hello() {
      if (!rv || moiMembre() || termine) return;
      prochainHello = maintenant() + D.helloInvite;
      rv.envoyer({ t: 'hello', p: PROTOCOLE });
    }
    function surRendezVous(m, proto, L) {
      if (termine) return;
      if (proto !== PROTOCOLE) {
        if (m.t === 'hello' && moiMembre()) rv.envoyer({ t: 'version', p: PROTOCOLE }, m.de);
        else if (!moiMembre()) statut('version');
        return;
      }
      if (m.t === 'hello') surHello(m.de);
      else if (m.t === 'sig') recevoirSignal(m.de, m.s, L.famille + ' ' + L.url.split(' ')[0]);
      else if (m.t === 'version' && !moiMembre()) statut('version');
    }
    function surHello(autre) {
      if (!moiMembre() || typeof autre !== 'string' || autre.length < 8) return;
      if (liens.get(autre)) return;
      if (membreParPid(autre)) { if (doitAppeler(autre)) appeler(autre); return; }
      if (R.role !== 'hote' && R.membres.length >= MAX_MACHINES) return;   // partie complète : seul l'hôte répond, pour refuser
      appeler(autre);
    }

    // ------------------------------------------------ liaisons WebRTC
    function doitAppeler(autre) {
      if (!moiMembre()) return false;
      if (R.role === 'hote') return true;
      const m = membreParPid(autre);
      if (!m) return true;   // un membre appelle un nouveau venu
      return m.id !== 0 && R.id < m.id;
    }
    function signaler(autre, s) {
      if (!autre || termine) return;
      if (routes.has(autre)) versFlux(autre, 's', s);
      else if (rv) rv.envoyer({ t: 'sig', s }, autre);
    }
    function nouveauLien(cle, o) {
      if (!RTC) { statut('webrtc'); return null; }
      let pc;
      try { pc = new RTC({ iceServers: options.iceServers || STUN }); } catch (e) { statut('webrtc'); return null; }
      const L = { cle, pid: cle[0] === '?' ? null : cle, pc, essai: o.essai, appelant: !!o.appelant, main: !!o.main, invitation: o.invitation,
        ouvert: false, direct: false, moi: false, ferme: false, debut: maintenant(), attente: [], envoye: false, distante: false,
        reponse: false, collecteFinie: false, srflx: false, minuteur: null, coupure: null, canal: null, fiable: null };
      const ancien = liens.get(cle);
      if (ancien && ancien !== L) fermerLien(ancien, 'remplacé');
      liens.set(cle, L);
      try {
        L.canal = pc.createDataChannel('etat', { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 });
        L.fiable = pc.createDataChannel('fiable', { negotiated: true, id: 1, ordered: true });
      } catch (e) { fermerLien(L, 'canaux'); statut('webrtc'); return null; }
      for (const ch of [L.canal, L.fiable]) {
        ch.binaryType = 'arraybuffer';
        ch.onopen = () => canalOuvert(L);
        ch.onclose = () => perdre(L, 'canal fermé');
      }
      L.canal.onmessage = ev => recevoirEtatBrut(L, ev.data);
      L.fiable.onmessage = ev => recevoirTrame(L, ev.data);
      const finCollecte = () => { L.collecteFinie = true; if (L.surCollecte) L.surCollecte(); };
      pc.onicecandidate = ev => {
        if (L.ferme) return;
        if (!ev.candidate || !ev.candidate.candidate) { finCollecte(); return; }
        if (!L.srflx && / typ srflx /.test(ev.candidate.candidate)) { L.srflx = true; if (L.surSrflx) L.surSrflx(); }
        if (L.main || !L.envoye) return;   // déjà dans la description envoyée, ou invitation à la main : tout part dans le texte
        signaler(L.pid, { e: L.essai, ice: { candidate: ev.candidate.candidate, sdpMid: ev.candidate.sdpMid, sdpMLineIndex: ev.candidate.sdpMLineIndex } });
      };
      pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') finCollecte(); };
      pc.onconnectionstatechange = () => surEtatConnexion(L);
      pc.oniceconnectionstatechange = () => surEtatConnexion(L);
      L.minuteur = setTimeout(() => { if (!L.ouvert) perdre(L, 'délai'); }, o.main ? D.invitation : D.essai);
      return L;
    }
    // Candidats réunis avant d'envoyer la description : tous, ou au plus « max » ms, ou peu après la première adresse
    // publique (relais publics : la suite part au fil de l'eau ; à la main, rien ne suit le texte : un peu plus tard).
    function collecter(L, max, tout) {
      return new Promise(ok => {
        if (L.collecteFinie || L.pc.iceGatheringState === 'complete') { ok(); return; }
        let fini = false, m2 = null;
        const fin = () => { if (!fini) { fini = true; clearTimeout(m1); clearTimeout(m2); L.surCollecte = L.surSrflx = null; ok(); } };
        const m1 = setTimeout(fin, max);
        L.surCollecte = fin;
        L.surSrflx = () => { if (!m2) m2 = setTimeout(fin, tout ? D.apresSrflxMain : D.apresSrflx); };
        if (L.srflx) L.surSrflx();
      });
    }
    function appeler(autre) {
      if (termine || !autre || autre === pid || bloque(autre)) return;
      const ancien = liens.get(autre);
      if (ancien && !ancien.ferme) return;
      const e = essais.get(autre);
      if (e && maintenant() < e.apres) return;
      const L = nouveauLien(autre, { appelant: true, essai: jeton(8) });
      if (!L) return;
      noter('appel', { a: court(autre), voie: routes.has(autre) ? 'maillage' : 'relais' });
      (async () => {
        try {
          await L.pc.setLocalDescription(await L.pc.createOffer());
          await collecter(L, D.collecte, false);
          if (L.ferme) return;
          L.envoye = true;
          signaler(autre, { e: L.essai, sdp: { type: 'offer', sdp: L.pc.localDescription.sdp } });
        } catch (err) { perdre(L, 'offre'); }
      })();
    }
    async function accepterOffre(autre, s) {
      let L = liens.get(autre);
      if (L && L.essai === s.e) return;   // copie d'une offre déjà traitée
      if (L && !L.ferme) {
        if (L.appelant && !L.ouvert && pid < autre) return;   // appels croisés : la plus petite identité garde le sien
        fermerLien(L, 'nouvelle offre');   // l'autre machine repart de zéro : on la suit
      }
      if (bloque(autre)) return;
      L = nouveauLien(autre, { appelant: false, essai: s.e });
      if (!L) return;
      try {
        await L.pc.setRemoteDescription(s.sdp);
        L.distante = true;
        for (const c of L.attente.splice(0)) L.pc.addIceCandidate(c).catch(() => {});
        await L.pc.setLocalDescription(await L.pc.createAnswer());
        await collecter(L, D.collecte, false);
        if (L.ferme) return;
        L.envoye = true;
        signaler(autre, { e: L.essai, sdp: { type: 'answer', sdp: L.pc.localDescription.sdp } });
      } catch (err) { perdre(L, 'réponse'); }
    }
    function recevoirSignal(autre, s, voie) {
      if (termine || typeof autre !== 'string' || autre === pid || !s || typeof s !== 'object' || typeof s.e !== 'string') return;
      const L = liens.get(autre);
      if (s.sdp && s.sdp.type === 'offer' && typeof s.sdp.sdp === 'string') {
        noter('offre reçue', { de: court(autre), voie });
        if (!moiMembre() && !premiereOffre) { premiereOffre = maintenant(); statut('liaison'); }
        accepterOffre(autre, s);
      } else if (s.sdp && s.sdp.type === 'answer' && typeof s.sdp.sdp === 'string') {
        if (!L || L.ferme || !L.appelant || L.essai !== s.e || L.reponse) return;
        L.reponse = true;
        noter('réponse reçue', { de: court(autre), voie });
        L.pc.setRemoteDescription(s.sdp).then(() => {
          L.distante = true;
          for (const c of L.attente.splice(0)) L.pc.addIceCandidate(c).catch(() => {});
        }, () => perdre(L, 'réponse illisible'));
      } else if (s.ice && L && !L.ferme && L.essai === s.e) {
        if (L.distante) L.pc.addIceCandidate(s.ice).catch(() => {}); else L.attente.push(s.ice);
      }
    }
    // connectionState, ou l'état ICE pour un navigateur qui ne donne que lui
    const etatPc = pc => pc.connectionState || ({ completed: 'connected', checking: 'connecting' })[pc.iceConnectionState] || pc.iceConnectionState;
    function surEtatConnexion(L) {
      if (L.ferme) return;
      const e = etatPc(L.pc);
      if (e === 'connected') {
        clearTimeout(L.coupure); L.coupure = null;
        if (L.ouvert && !L.direct) { L.direct = true; noter('liaison revenue', { a: court(L.pid) }); majVoisins(); }
      } else if (e === 'disconnected') {
        if (L.ouvert && L.direct) { L.direct = false; noter('liaison déconnectée', { a: court(L.pid) }); majVoisins(); }
        if (!L.coupure) L.coupure = setTimeout(() => { L.coupure = null; if (!L.ferme && etatPc(L.pc) !== 'connected') perdre(L, 'coupure'); }, D.coupure);
      } else if (e === 'failed' || e === 'closed') perdre(L, e);
    }
    function canalOuvert(L) {
      if (L.ferme || L.ouvert || L.canal.readyState !== 'open' || L.fiable.readyState !== 'open') return;
      L.ouvert = true; L.direct = true; L.ouverteA = maintenant();
      clearTimeout(L.minuteur);
      noter('canaux ouverts', { a: court(L.pid || L.cle), ms: Math.round(maintenant() - L.debut), main: L.main || undefined });
      envoyerTrame(L, ['moi', pid, R.role, R.id, PROTOCOLE, hotePid() || '', R.nom, R.joueurs]);
      if (L.invitation != null) emettre('invitation', L.invitation, 'ouverte');
    }
    function fermerLien(L, raison) {
      if (L.ferme) return;
      L.ferme = true;
      clearTimeout(L.minuteur); clearTimeout(L.coupure);
      if (liens.get(L.cle) === L) liens.delete(L.cle);
      if (L.invitation != null && invitations.get(L.invitation) === L) invitations.delete(L.invitation);
      try { L.pc.close(); } catch (e) { /* déjà fermée */ }
      noter('liaison fermée', { a: court(L.pid || L.cle), raison });
      // invitation à la main qui n'a pas abouti (chemin introuvable, dix minutes passées) : l'interface le dit
      if (L.invitation != null && !L.ouvert && !termine && !/^(annulée|admis par ailleurs|remplacé)$/.test(raison)) emettre('invitation', L.invitation, 'echec', raison);
      if (L.moi) majVoisins();
    }
    function perdre(L, raison) {
      if (L.ferme) return;
      const etaitOuvert = L.ouvert, autre = L.pid;
      fermerLien(L, raison);
      if (termine || !autre) return;
      const e = essais.get(autre) || { n: 0, apres: 0 };
      if (etaitOuvert) { e.n = 0; e.apres = maintenant() + 500; }
      else if (L.appelant) { e.n++; e.apres = maintenant() + (e.n < 3 ? 1500 : D.reessai); if (e.n >= 3) e.n = 0; }
      essais.set(autre, e);
    }
    function envoyerTrame(L, t) {
      if (L.ferme || !L.fiable || L.fiable.readyState !== 'open') return false;
      try { L.fiable.send(JSON.stringify(t)); return true; } catch (e) { return false; }
    }

    // ------------------------------------------------ voisins, chemins et flux fiables
    function voisinsDirects() {
      const s = new Set();
      for (const L of liens.values()) if (L.ouvert && L.moi && L.direct && L.pid) s.add(L.pid);
      return s;
    }
    const lienDirect = p => { const L = liens.get(p); return L && L.ouvert && L.moi && L.direct && !L.ferme ? L : null; };
    const prochain = p => { const h = routes.get(p); return h ? lienDirect(h) : null; };
    function majVoisins(rediffuser) {
      if (termine) return;
      const v = voisinsDirects(), e = ls.get(pid);
      if (!rediffuser && e && e.voisins.size === v.size && [...v].every(x => e.voisins.has(x))) { calculerRoutes(); return; }
      ls.set(pid, { seq: ++monSeq, voisins: v, t: maintenant() });
      dernierLs = maintenant();
      const t = ['ls', pid, monSeq, [...v]];
      for (const p of v) envoyerTrame(liens.get(p), t);
      calculerRoutes();
    }
    function recevoirLs(L, t) {
      const [, origine, seq, voisins] = t;
      if (typeof origine !== 'string' || origine === pid || !Number.isInteger(seq) || !Array.isArray(voisins)) return;
      const e = ls.get(origine);
      if (e && e.seq >= seq) return;
      ls.set(origine, { seq, voisins: new Set(voisins.filter(x => typeof x === 'string').slice(0, 8)), t: maintenant() });
      for (const p of voisinsDirects()) if (p !== L.pid) envoyerTrame(liens.get(p), t);
      calculerRoutes();
    }
    // plus courts chemins : une arête entre deux autres machines compte quand chacune l'annonce
    function calculerRoutes() {
      const directs = voisinsDirects(), voisinsDe = p => p === pid ? directs : (ls.get(p) || { voisins: new Set() }).voisins;
      const nouvelles = new Map(), file = [];
      for (const v of directs) { nouvelles.set(v, v); file.push(v); }
      while (file.length) {
        const u = file.shift();
        for (const w of voisinsDe(u)) {
          if (w === pid || nouvelles.has(w) || !voisinsDe(w).has(u)) continue;
          nouvelles.set(w, nouvelles.get(u));
          file.push(w);
        }
      }
      routes = nouvelles;
      majPairs();
      envoyerEntrer();
    }
    function versFlux(dest, genre, charge) {
      const L = prochain(dest);
      if (!L) return false;
      const s = (sorties.get(dest) || 0) + 1;
      if (!envoyerTrame(L, ['m', pid, dest, TTL, s, genre, charge])) return false;
      sorties.set(dest, s);
      return true;
    }
    const controle = (dest, c) => dest && versFlux(dest, 'c', c);
    function recevoirTrame(L, data) {
      if (termine || typeof data !== 'string') return;
      let t;
      try { t = JSON.parse(data); } catch (e) { return; }
      if (!Array.isArray(t)) return;
      if (t[0] === 'moi') recevoirMoi(L, t);
      else if (!L.moi) return;
      else if (t[0] === 'ls') recevoirLs(L, t);
      else if (t[0] === 'm') recevoirFlux(L, t);
    }
    function recevoirMoi(L, t) {
      const [, autre, role, id, proto, hote, nom, joueurs] = t;
      if (typeof autre !== 'string' || autre.length < 8 || autre === pid) { fermerLien(L, 'identité'); return; }
      if (proto !== PROTOCOLE) { fermerLien(L, 'version'); statut('version'); return; }
      if (L.pid && L.pid !== autre) { fermerLien(L, 'identité'); return; }
      if (!L.pid) {   // invitation à la main : la liaison prend l'identité annoncée ; une liaison déjà ouverte avec elle l'emporte
        const autreLien = liens.get(autre);
        if (autreLien && autreLien !== L && autreLien.ouvert && !autreLien.ferme) { fermerLien(L, 'double'); return; }
        if (autreLien && autreLien !== L) fermerLien(autreLien, 'double');
        if (liens.get(L.cle) === L) liens.delete(L.cle);
        if (L.invitation != null) invitations.delete(L.invitation);
        L.cle = L.pid = autre;
        liens.set(autre, L);
      }
      L.moi = true;
      connus.set(autre, { role, id, nom, joueurs });
      if (role === 'hote') hoteConnu = autre;
      else if (typeof hote === 'string' && hote.length >= 8 && !hoteConnu) hoteConnu = hote;
      const e = essais.get(autre); if (e) e.n = 0;
      noter('liaison établie', { a: court(autre), role, ms: Math.round(maintenant() - L.debut) });
      for (const [o, x] of ls) envoyerTrame(L, ['ls', o, x.seq, [...x.voisins]]);
      majVoisins(true);
    }
    function recevoirFlux(L, t) {
      const [, de, a, ttl, seq, genre, charge] = t;
      if (typeof de !== 'string' || typeof a !== 'string' || !Number.isInteger(seq) || seq < 1) return;
      if (a !== pid) {
        if (ttl > 1) { const S = prochain(a); if (S && S !== L) envoyerTrame(S, ['m', de, a, ttl - 1, seq, genre, charge]); }
        return;
      }
      let E = entrees.get(de);
      if (!E) entrees.set(de, E = { attendu: 1, tampon: new Map(), minuteur: null });
      if (seq < E.attendu || E.tampon.has(seq)) return;
      E.tampon.set(seq, [genre, charge]);
      vider(de, E);
    }
    // les messages d'une machine arrivent dans l'ordre, même quand leur chemin change ; un trou attend 1,5 s au plus
    function vider(de, E) {
      while (E.tampon.has(E.attendu) && !termine) {
        const [g, c] = E.tampon.get(E.attendu);
        E.tampon.delete(E.attendu);
        E.attendu++;
        livrer(de, g, c);
      }
      clearTimeout(E.minuteur); E.minuteur = null;
      if (E.tampon.size && !termine) E.minuteur = setTimeout(() => { E.attendu = Math.min(...E.tampon.keys()); vider(de, E); }, D.reordre);
    }
    function livrer(de, genre, c) {
      if (genre === 's') recevoirSignal(de, c, 'maillage');
      else if (genre === 'c') { if (c && typeof c === 'object') recevoirControle(de, c); }
      else if (genre === 'a') { const m = membreParPid(de); if (m && moiMembre()) emettre('message', c, m.id); }
    }

    // ------------------------------------------------ partie : admission, liste, départs
    function envoyerEntrer() {
      if (moiMembre() || termine || R.role !== 'invite' || !hoteConnu || !routes.has(hoteConnu)) return;
      if (maintenant() - dernierEntrer < D.entrer) return;
      dernierEntrer = maintenant();
      noter('entrer', { hote: court(hoteConnu) });
      controle(hoteConnu, { t: 'entrer', nom: R.nom, joueurs: R.joueurs });
    }
    function diffuserSalle() {
      const membres = R.membres.map(m => ({ id: m.id, pid: m.pid, nom: m.nom, joueurs: m.joueurs }));
      for (const m of R.membres) if (m.pid !== pid) controle(m.pid, { t: 'salle', membres });
      emettre('salle', R.membres);
    }
    function recevoirControle(de, c) {
      if (c.t === 'entrer') surEntrer(de, c);
      else if (c.t === 'bienvenue') surBienvenue(de, c);
      else if (c.t === 'refus') {
        if (moiMembre() || de !== hoteConnu) return;
        const code = c.raison === 'version' ? 'version' : 'complet';
        statut(code); emettre('erreur', TEXTES[code]); terminer('refus');
      } else if (c.t === 'salle') surSalle(de, c);
      else if (c.t === 'profil') surProfil(de, c);
      else if (c.t === 'bye') surBye(de);
      else if (c.t === 'ping') controle(de, { t: 'pong', a: c.a, b: maintenant() });
      else if (c.t === 'pong' && Number.isFinite(c.a) && Number.isFinite(c.b)) {
        const rtt = maintenant() - c.a;
        echantillons.push({ rtt, decalage: c.b + rtt / 2 - maintenant() });
        if (echantillons.length > 16) echantillons.shift();
        let meilleur = echantillons[0];
        for (const x of echantillons) if (x.rtt < meilleur.rtt) meilleur = x;
        R.rtt = meilleur.rtt; R.decalage = meilleur.decalage; R.synchro = echantillons.length >= 6;
      }
    }
    function surEntrer(autre, c) {
      if (R.role !== 'hote' || !moiMembre()) return;
      let m = membreParPid(autre);
      if (!m) {
        const joueurs = c.joueurs === 2 ? 2 : 1, pilotes = R.membres.reduce((s, x) => s + x.joueurs, 0);
        if (R.membres.length >= MAX_MACHINES || pilotes + joueurs > MAX_PILOTES) { noter('refus', { a: court(autre) }); controle(autre, { t: 'refus', raison: 'complet' }); return; }
        if (prochainId > 250) { prochainId = 1; while (membreParId(prochainId)) prochainId++; }
        m = { id: prochainId++, pid: autre, nom: propre(c.nom) || 'Pilote ' + (R.membres.length + 1), joueurs };
        R.membres.push(m);
        noter('admis', { a: court(autre), id: m.id });
      }
      controle(autre, { t: 'bienvenue', id: m.id, code: R.code });
      diffuserSalle();
      majPairs();
    }
    function surBienvenue(autre, c) {
      if (moiMembre() || autre !== hoteConnu || !Number.isInteger(c.id) || c.id < 1 || c.id > 255) return;
      R.id = c.id;
      if (!R.code && typeof c.code === 'string') R.code = c.code.slice(0, 16);
      noter('bienvenue', { id: c.id });
      statut('admis');
      for (const L of [...liens.values()]) if (L.main && !L.ouvert) fermerLien(L, 'admis par ailleurs');
      emettre('salon', { code: R.code, id: R.id, role: 'invite' });
    }
    function surSalle(autre, c) {
      if (autre !== hotePid() || !Array.isArray(c.membres) || !moiMembre() || R.role === 'hote') return;
      const liste = [], ids = new Set();
      for (const x of c.membres.slice(0, MAX_MACHINES)) {
        if (!x || !Number.isInteger(x.id) || x.id < 0 || x.id > 255 || ids.has(x.id) || typeof x.pid !== 'string') continue;
        ids.add(x.id);
        liste.push({ id: x.id, pid: x.pid, nom: propre(x.nom) || 'Pilote', joueurs: x.joueurs === 2 ? 2 : 1 });
      }
      if (!liste.some(x => x.pid === pid)) { terminer('coupure'); return; }   // l'hôte nous a perdus
      const avant = R.membres;
      R.membres = liste;
      const moi = liste.find(x => x.pid === pid);
      R.id = moi.id;
      for (const x of avant) if (x.pid !== pid && !liste.some(y => y.pid === x.pid)) { pairs.delete(x.id); const L = liens.get(x.pid); if (L) fermerLien(L, 'parti'); emettre('parti', x.id); }
      emettre('salle', R.membres);
      majPairs();
      relier();
    }
    function surProfil(autre, c) {
      if (R.role !== 'hote') return;
      const m = membreParPid(autre);
      if (!m || m.id === 0) return;
      m.nom = propre(c.nom) || m.nom;
      const joueurs = c.joueurs === 2 ? 2 : 1, autres = R.membres.reduce((s, x) => s + (x === m ? 0 : x.joueurs), 0);
      if (autres + joueurs <= MAX_PILOTES) m.joueurs = joueurs;
      diffuserSalle();
    }
    function surBye(autre) {
      const m = membreParPid(autre);
      noter('au revoir', { de: court(autre) });
      if (m && m.id === 0 && R.role !== 'hote') { terminer('parti'); return; }
      if (R.role === 'hote') { retirerMembre(autre, 'au revoir'); return; }
      const L = liens.get(autre);
      if (L) fermerLien(L, 'au revoir');
    }
    function retirerMembre(autre, raison) {
      const i = R.membres.findIndex(m => m.pid === autre);
      if (i < 0 || R.membres[i].id === 0) return;
      const m = R.membres[i];
      R.membres.splice(i, 1);
      pairs.delete(m.id);
      const L = liens.get(autre);
      if (L) fermerLien(L, raison);
      noter('retiré', { id: m.id, raison });
      diffuserSalle();
      emettre('parti', m.id);
      majPairs();
    }
    // chaque membre appelle ceux qu'il doit appeler et qui n'ont pas de liaison directe avec lui
    function relier() {
      if (!moiMembre() || termine) return;
      for (const m of R.membres) {
        if (m.pid === pid || !doitAppeler(m.pid)) continue;
        const L = liens.get(m.pid);
        if (!L || L.ferme) appeler(m.pid);
      }
    }
    function majPairs() {
      if (termine) return;
      const nouvelles = [], relayees = [];
      let change = false;
      for (const m of R.membres) {
        if (m.pid === pid) continue;
        const h = routes.get(m.pid), pret = !!h && moiMembre(), relais = pret && h !== m.pid;
        const via = relais ? (membreParPid(h) || connus.get(h) || {}).nom || '' : '';
        let p = pairs.get(m.id);
        if (!p) { p = { id: m.id, pid: m.pid, pret: false, relais: false, via: '', vu: maintenant(), dernier: null }; pairs.set(m.id, p); change = true; }
        if (pret) p.vu = maintenant();
        if (p.pret === pret && p.relais === relais && p.via === via) continue;
        if (pret && !p.pret) nouvelles.push(m.id);
        // « relais » : la dernière liaison prête était directe, celle-ci passe par une autre machine, même après un
        // instant sans chemin (la liste des voisins de la troisième machine arrivée un peu après la perte)
        if (pret && relais && p.dernier === 'direct' && !(p.pret && p.relais)) relayees.push(m.id);
        p.pret = pret; p.relais = relais; p.via = via;
        if (pret) p.dernier = relais ? 'relais' : 'direct';
        change = true;
      }
      for (const id of [...pairs.keys()]) if (!membreParId(id)) { pairs.delete(id); change = true; }
      R.etat = [...pairs.values()].some(p => p.pret) ? 'connecte' : 'salon';
      if (nouvelles.length || relayees.length) noter('chemins', { prets: nouvelles, relayes: relayees });
      if (R.role === 'invite' && R.pretAvec(0)) demarrerPing();
      for (const id of nouvelles) emettre('pair', id, pairs.get(id).relais);
      for (const id of relayees) emettre('relais', id);
      if (change) emettre('liens');
    }
    function demarrerPing() {
      if (minuteurPing || R.role === 'hote') return;
      let n = 0;
      const ping = () => {
        if (termine) return;
        const h = hotePid();
        if (h) controle(h, { t: 'ping', a: maintenant() });
        minuteurPing = setTimeout(ping, ++n < 12 ? 120 : 1000);
      };
      ping();
    }

    // ------------------------------------------------ entretien, toutes les secondes
    function menage() {
      if (termine) return;
      const t = maintenant();
      if (t - dernierLs > D.ls) majVoisins(true);
      for (const [o, e] of ls) if (o !== pid && t - e.t > D.ls * 3.5) { ls.delete(o); calculerRoutes(); }
      // membres injoignables par tout chemin : partis
      for (const m of [...R.membres]) {
        if (m.pid === pid || !moiMembre()) continue;
        const p = pairs.get(m.id);
        if (!p || p.pret || t - p.vu <= D.grace) continue;
        if (R.role === 'hote') retirerMembre(m.pid, 'injoignable');
        else if (m.id === 0) { terminer('coupure'); return; }
      }
      relier();
      // liaisons ouvertes avec des machines jamais admises. Le délai court depuis l'ouverture des canaux, pas depuis
      // l'appel : une négociation lente (relais chargés) ne doit pas faire couper la liaison à peine ouverte, avant
      // que l'autre ait pu demander l'entrée (vu le 18/11 sous forte charge : appel, ouverture, coupure, en boucle).
      // Une liaison qui ne s'ouvre pas tombe d'elle-même au bout de D.essai.
      if (moiMembre()) for (const L of [...liens.values()]) {
        if (!L.pid || L.main || !L.ouvert || membreParPid(L.pid) || L.pid === hoteConnu) continue;
        if (t - L.ouverteA > D.etranger) fermerLien(L, 'jamais admise');
      }
      // nouveau venu : se signaler, demander l'entrée, dire où en est la recherche
      if (!moiMembre() && R.role === 'invite') {
        if (rv && t >= prochainHello) hello();
        envoyerEntrer();
        const ouverte = [...liens.values()].some(L => L.ouvert);
        if (rv && !rv.pret() && t - debutRecherche > D.sansRelais && !ouverte) statut('sansRelais');
        else if (premiereOffre && !ouverte && t - premiereOffre > D.injoignable) statut('injoignable');
        else if (rv && rv.pret() && !premiereOffre && premierRelais && t - premierRelais > D.introuvable) statut('introuvable');
      }
      if (R.role === 'hote' && rv && !rv.pret() && t - debutRecherche > D.sansRelais && R.statut !== 'sansRelaisHote') statut('sansRelaisHote');
    }
    function demarrer() {
      if (R.etat === 'ferme') R.etat = 'salon';
      if (!minuteurMenage) minuteurMenage = setInterval(menage, D.menage);
      if (!quitter && typeof addEventListener === 'function') { quitter = () => R.fermer(); addEventListener('pagehide', quitter); }
    }
    function terminer(raison) {
      if (termine) return;
      termine = true;
      R.etat = 'ferme';
      clearInterval(minuteurMenage); clearTimeout(minuteurPing);
      for (const E of entrees.values()) clearTimeout(E.minuteur);
      for (const L of [...liens.values()]) fermerLien(L, 'fin');
      if (rv) rv.fermer();
      if (quitter && typeof removeEventListener === 'function') removeEventListener('pagehide', quitter);
      noter('fin', { raison });
      emettre('ferme', raison);
    }

    // ------------------------------------------------ salon de David (essais)
    function ouvrirSalon(url, entree) {
      return new Promise((ok, ko) => {
        let ws, fini = false;
        try { ws = new WS(url); } catch (e) { ko(e); return; }
        const finir = f => { if (!fini) { fini = true; clearTimeout(m); f(); } };
        const m = setTimeout(() => finir(() => { try { ws.close(); } catch (e) { /* déjà fermé */ } ko(new Error('salon muet')); }), D.ouverture);
        ws.onopen = () => ws.send(JSON.stringify(entree));
        ws.onerror = () => finir(() => ko(new Error('salon injoignable')));
        ws.onclose = () => finir(() => ko(new Error('salon fermé')));
        ws.onmessage = ev => {
          let r;
          try { r = JSON.parse(ev.data); } catch (e) { return; }
          if (r.t === 'salon') finir(() => ok({ ws, code: r.code }));
          else if (r.t === 'erreur') finir(() => { emettre('erreur', r.message); try { ws.close(); } catch (e) { /* déjà fermé */ } ok(null); });
        };
      });
    }

    // ------------------------------------------------ interface
    R.creerSalon = async () => {
      if (R.role) throw new Error('partie déjà commencée');
      R.role = 'hote'; R.id = 0; hoteConnu = pid;
      R.membres = [{ id: 0, pid, nom: R.nom || 'Pilote 1', joueurs: R.joueurs }];
      demarrer();
      if (salonUrl) {
        let s;
        try { s = await ouvrirSalon(salonUrl, { t: 'creer', nom: R.nom, joueurs: R.joueurs }); }
        catch (e) { termine = true; R.etat = 'ferme'; clearInterval(minuteurMenage); throw e; }
        if (!s) return;
        R.code = s.code;
        emettre('salon', { code: R.code, id: 0, role: 'hote' }); emettre('salle', R.membres);
        await lancerRendezVous(R.code, s.ws);
        return;
      }
      R.code = subtil() && Object.keys(familles).length ? nouveauCode() : null;
      emettre('salon', { code: R.code, id: 0, role: 'hote' }); emettre('salle', R.membres);
      if (!RTC) statut('webrtc');
      else if (!subtil() && Object.keys(familles).length) statut('securise');
      else statut('attente');
      if (R.code) await lancerRendezVous(R.code);
    };
    R.rejoindreSalon = async code => {
      if (R.role === 'hote' || moiMembre()) throw new Error('partie déjà commencée');
      if (salonUrl) {
        const c = String(code || '').trim().toUpperCase();
        R.role = 'invite'; demarrer();
        let s;
        try { s = await ouvrirSalon(salonUrl, { t: 'rejoindre', code: c, nom: R.nom, joueurs: R.joueurs }); }
        catch (e) { termine = true; R.etat = 'ferme'; clearInterval(minuteurMenage); throw e; }
        if (!s) return;
        R.code = c;
        await lancerRendezVous(c, s.ws);
        return;
      }
      const c = normaliserCode(code);
      if (!c) { emettre('erreur', TEXTES.codeInvalide); throw new Error('code'); }
      if (!RTC) { statut('webrtc'); emettre('erreur', TEXTES.webrtc); throw new Error('webrtc'); }
      R.role = 'invite'; R.code = c; demarrer();
      if (!Object.keys(familles).length) { statut('sansRelais'); return; }
      statut('recherche');
      await lancerRendezVous(c);
    };
    // Invitation à la main (hôte) : une liaison en attente par invité, valable dix minutes.
    R.inviter = async () => {
      if (R.role !== 'hote') throw new Error('hôte seulement');
      let n;
      do { const u = aleatoire(2); n = 1 + ((u[0] << 8 | u[1]) % 65535); } while (invitations.has(n) || liens.has('?' + n));
      const L = nouveauLien('?' + n, { appelant: true, main: true, essai: 'i' + n, invitation: n });
      if (!L) throw new Error('webrtc');
      invitations.set(n, L);
      await L.pc.setLocalDescription(await L.pc.createOffer());
      await collecter(L, D.collecteMain, true);
      if (L.ferme) throw new Error('fermée');
      const charge = emballerInvitation(1, n, R.code, L.pc.localDescription.sdp);
      noter('invitation', { n, octets: Math.round(charge.length * 3 / 4) });
      return { n, charge, texte: lienInvitation(charge) };
    };
    R.accepterReponse = async texte => {
      const r = lireInvitation(texte);
      if (r.erreur) throw new Error(r.erreur);
      if (r.genre !== 2) throw new Error('pasReponse');
      const L = invitations.get(r.n);
      if (!L || L.ferme) throw new Error('perimee');
      if (L.reponse) return true;
      L.reponse = true;
      await L.pc.setRemoteDescription({ type: 'answer', sdp: r.sdp });
      L.distante = true;
      noter('réponse collée', { n: r.n });
      return true;
    };
    // Invitation à la main (invité) : rend la réponse à renvoyer. Si l'invitation porte le code et que les relais
    // répondent, la machine cherche aussi la partie par le code : la première liaison établie l'emporte.
    R.accepterInvitation = async texte => {
      const r = lireInvitation(texte);
      if (r.erreur) throw new Error(r.erreur);
      if (r.genre !== 1) throw new Error('pasInvitation');
      if (R.role === 'hote' || moiMembre()) throw new Error('partie déjà commencée');
      R.role = 'invite'; demarrer();
      if (r.code && !R.code && !salonUrl && subtil() && Object.keys(familles).length) {
        R.code = r.code;
        lancerRendezVous(r.code).catch(() => {});
      }
      const L = nouveauLien('?' + r.n, { appelant: false, main: true, essai: 'i' + r.n, invitation: r.n });
      if (!L) throw new Error('webrtc');
      await L.pc.setRemoteDescription({ type: 'offer', sdp: r.sdp });
      L.distante = true;
      await L.pc.setLocalDescription(await L.pc.createAnswer());
      await collecter(L, D.collecteMain, true);
      if (L.ferme) throw new Error('fermée');
      const charge = emballerInvitation(2, r.n, null, L.pc.localDescription.sdp);
      noter('réponse prête', { n: r.n });
      return { n: r.n, charge, texte: charge };
    };
    R.annulerInvitation = n => { const L = invitations.get(n); if (L) fermerLien(L, 'annulée'); };
    R.profil = (nom, joueurs) => {
      R.nom = propre(nom) || R.nom; R.joueurs = joueurs === 2 ? 2 : 1;
      if (!moiMembre()) return;
      if (R.role === 'hote') {
        const m = membreParId(0), autres = R.membres.reduce((s, x) => s + (x.id ? x.joueurs : 0), 0);
        m.nom = R.nom || m.nom;
        if (autres + R.joueurs <= MAX_PILOTES) m.joueurs = R.joueurs;
        diffuserSalle();
      } else controle(hotePid(), { t: 'profil', nom: R.nom, joueurs: R.joueurs });
    };
    // message fiable à une machine (a) ou à toutes : en direct, ou par le plus court chemin
    R.envoyer = (m, a) => {
      if (!moiMembre() || termine) return;
      for (const x of R.membres) if (x.pid !== pid && (a === undefined || x.id === a)) versFlux(x.pid, 'a', m);
    };
    // état des voitures à toutes les machines : en direct, ou par une troisième machine [2][ttl][de][à] + paquet
    R.envoyerEtat = buf => {
      if (!moiMembre() || termine) return;
      for (const m of R.membres) {
        if (m.pid === pid) continue;
        const h = routes.get(m.pid), S = h && lienDirect(h);
        if (!S || S.canal.readyState !== 'open' || S.canal.bufferedAmount >= 65536) continue;
        try {
          if (h === m.pid) S.canal.send(buf);
          else { const c = new Uint8Array(buf.byteLength + 4); c.set(new Uint8Array(buf), 4); c[0] = 2; c[1] = TTL; c[2] = R.id; c[3] = m.id; S.canal.send(c.buffer); }
        } catch (e) { /* canal en train de se fermer */ }
      }
    };
    function recevoirEtatBrut(L, data) {
      if (termine || !(data instanceof ArrayBuffer) || data.byteLength < 2 || !L.pid || !moiMembre()) return;
      const u = new Uint8Array(data);
      if (u[0] === 1) {
        const m = membreParPid(L.pid), p = m && deballer(data);
        if (p) emettre('etat', p, m.id);
      } else if (u[0] === 2 && u.length > 14) {
        const ttl = u[1], de = u[2], a = u[3];
        if (a === R.id) { const p = membreParId(de) && deballer(data.slice(4)); if (p) emettre('etat', p, de); return; }
        const dest = membreParId(a), S = ttl > 1 && dest && prochain(dest.pid);
        if (S && S !== L && S.canal.readyState === 'open' && S.canal.bufferedAmount < 65536) { const c = u.slice(); c[1] = ttl - 1; try { S.canal.send(c.buffer); } catch (e) { /* fermé */ } }
      }
    }
    R.relaisEtat = () => {
      const t = rv ? rv.etat() : [], familles = {};
      for (const x of t) if (x.pret) familles[x.famille] = (familles[x.famille] || 0) + 1;
      // enEchec : relais qui ont déjà échoué et réessaient (pas de réseau, ou relais tombés)
      return { mode: R.signalisation.mode, prets: t.filter(x => x.pret).length, total: t.length, enEchec: t.filter(x => !x.pret && x.echecs > 0).length, familles };
    };
    R.fermer = () => {
      if (termine) return;
      // au revoir en direct à chaque voisin, puis par le maillage aux autres ; les liaisons se ferment un peu après
      const directs = voisinsDirects();
      for (const p of directs) envoyerTrame(liens.get(p), ['m', pid, p, 1, (sorties.get(p) || 0) + 1, 'c', { t: 'bye' }]);
      for (const m of R.membres) if (m.pid !== pid && !directs.has(m.pid)) controle(m.pid, { t: 'bye' });
      const restants = [...liens.values()];
      for (const L of restants) liens.delete(L.cle);
      terminer('local');
      setTimeout(() => { for (const L of restants) fermerLien(L, 'fin'); }, 250);
    };
    Object.defineProperty(R.signalisation, 'premiers', { get: () => rv ? Object.assign({}, rv.premiers) : {} });
    return R;
  }
  function choisirFamilles(relais) {
    const nostr = typeof BigInt === 'function';
    if (relais && typeof relais === 'object' && !Array.isArray(relais)) return Object.assign({}, relais);
    const noms = Array.isArray(relais) ? relais : Object.keys(RELAIS), r = {};
    for (const n of noms) if (RELAIS[n] && (n !== 'nostr' || nostr)) r[n] = RELAIS[n].slice();
    return r;
  }

  // Adresse du salon : ?salon=ws://… pour les essais, le même hôte en local (localhost), sinon le salon de
  // bitume.estrasse.fr. Gardée pour un jeu.js d'avant les relais publics, qui passe toujours par le salon.
  function adresseSalon() {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('salon') : null;
    if (q) return q;
    if (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return 'ws://' + location.host + '/salon';
    return 'wss://bitume.estrasse.fr/salon';
  }
  // Options de la page : relais publics par défaut ; ?salon=ws://… pour passer par le salon (essais) ;
  // ?relais=mqtt,torrent,nostr pour n'en garder que certains, ?relais=aucun pour l'invitation à la main seule.
  function optionsPage() {
    const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    if (q.get('salon')) return { salon: q.get('salon') };
    const r = q.get('relais');
    if (!r) return {};
    return { relais: r === 'aucun' ? [] : r.split(',').map(x => x.trim()).filter(x => RELAIS[x]) };
  }
  // Liens partagés : #partie=XXXXX-XXXXX ou #invitation=… ; le fragment ne part jamais vers un serveur.
  function adressePage() {
    if (typeof location !== 'undefined' && location.protocol === 'https:') return location.origin + location.pathname;
    return ADRESSE_JEU;
  }
  const lienInvitation = charge => adressePage() + '#invitation=' + charge;
  const lienPartie = code => adressePage() + '#partie=' + afficherCode(code);
  function lirePartage(h) {
    const s = String(h != null ? h : typeof location !== 'undefined' ? location.hash : '');
    let m = /[#&]partie=([0-9A-Za-z-]+)/.exec(s);
    if (m) { const code = normaliserCode(m[1]); return code ? { code } : null; }
    m = /[#&]invitation=([A-Za-z0-9_-]+)/.exec(s);
    return m ? { invitation: m[1] } : null;
  }

  B.reseau = { creer, emballer, deballer, prolonger, adresseSalon, optionsPage, lirePartage, lienInvitation, lienPartie, CHAMPS, PROTOCOLE,
    TEXTES, RELAIS, STUN, qr, code: { nouveau: nouveauCode, normaliser: normaliserCode, afficher: afficherCode },
    interne: { deriverSalle, sceller, ouvrirEnveloppe, lireSdp, compacterSdp, lireCompact, sdpDepuisCompact, emballerInvitation, lireInvitation,
      secp, rendezVous, FAMILLES, DELAIS, b64url, deB64url, b64, deB64, hex, deHex, fletcher, sha256 } };
})(globalThis.BITUME = globalThis.BITUME || {});
