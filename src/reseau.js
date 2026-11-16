(function (B) {
  'use strict';
  // BITUME — jeu en ligne à deux (David, 16/11/2026 : « gros chantier, le multijoueur en ligne, deux pour commencer » ;
  // « netcode précis et léger, pas de lag ; jeu de course, précision absolue nécessaire »).
  //
  // Principe :
  // - chaque pilote conduit SA voiture sur sa machine, sans attendre le réseau : aucun retard à la commande ;
  // - liaison directe WebRTC entre les deux machines (canal « état » sans reprise ni ordre, canal « fiable »
  //   ordonné) ; le salon (serveur/salon.mjs) ne sert qu'à se trouver, et relaie la partie si la liaison directe
  //   échoue ;
  // - horloge commune : l'invité mesure son décalage sur l'hôte (aller-retours, on garde le plus court) ; la course
  //   part au même instant T0 des deux côtés et la simulation suit cette horloge pas à pas ;
  // - l'état d'une voiture (15 nombres, horodatés) part 60 fois par seconde ; la voiture distante est prolongée
  //   jusqu'à l'instant du pas par la même cinématique que la conduite, et l'écart à chaque nouvel état se résorbe
  //   en 0,12 s au lieu de sauter ;
  // - l'hôte fait courir les rivaux et envoie leur état 30 fois par seconde ;
  // - les temps officiels (tours, arrivée) passent par le canal fiable : chacun chronomètre sa propre voiture.
  //
  //   const R = B.reseau.creer({ url, nom });  R.on('pret' | 'message' | 'etat' | 'ferme' | 'salon' | 'erreur', f)
  //   R.creerSalon() ; R.rejoindreSalon(code) ; R.envoyer(objet) ; R.envoyerEtat(tampon) ; R.horloge() (ms, hôte)

  // STUN publics de deux fournisseurs (si l'un est bloqué, l'autre répond) : chaque machine apprend son adresse vue
  // d'Internet et les deux percent leur routeur l'une vers l'autre, sans port ouvert à la main
  const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
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

  // ---------------------------------------------------------------- liaison
  function creer(options = {}) {
    const ecoute = {}, R = { etat: 'ferme', role: null, code: null, autre: null, rtt: 0, decalage: 0, relais: false, nom: options.nom || '' };
    const emettre = (nom, x) => { for (const f of ecoute[nom] || []) f(x); };
    R.on = (nom, f) => { (ecoute[nom] || (ecoute[nom] = [])).push(f); return R; };
    let ws = null, pc = null, canal = null, fiable = null, minuteurRelais = null, minuteurPing = null, minuteurCoupure = null;
    const echantillons = [];
    const maintenant = () => performance.now();
    R.horloge = () => maintenant() + (R.role === 'invite' ? R.decalage : 0);

    function versSalon(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
    function ouvrir() {
      return new Promise((ok, ko) => {
        try { ws = new WebSocket(options.url); } catch (e) { ko(e); return; }
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => { R.etat = 'salon'; ok(); };
        ws.onerror = () => { if (R.etat === 'ferme') ko(new Error('salon injoignable')); };
        ws.onclose = () => { if (R.etat !== 'ferme' && (R.relais || R.etat !== 'connecte')) terminer('salon'); };
        ws.onmessage = ev => {
          if (typeof ev.data !== 'string') { recevoirEtat(ev.data); return; }
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (m.t === 'salon') { R.code = m.code; R.role = m.role; R.autre = m.autre || null; emettre('salon', m); if (m.role === 'invite') attendreLiaison(); }
          else if (m.t === 'arrivee') { R.autre = m.nom; emettre('arrivee', m); lier(); }
          else if (m.t === 'signal') signal(m);
          else if (m.t === 'relais') recevoirFiable(m.m);
          else if (m.t === 'parti') terminer('parti');
          else if (m.t === 'erreur') emettre('erreur', m.message);
        };
      });
    }
    R.creerSalon = async () => { await ouvrir(); versSalon({ t: 'creer', nom: R.nom }); };
    R.rejoindreSalon = async code => { await ouvrir(); versSalon({ t: 'rejoindre', code: String(code || '').trim().toUpperCase(), nom: R.nom }); };

    // WebRTC : l'hôte offre, l'invité répond ; candidats échangés par le salon
    function nouvellePaire() {
      pc = new RTCPeerConnection({ iceServers: options.iceServers || STUN });
      pc.onicecandidate = ev => { if (ev.candidate) versSalon({ t: 'signal', ice: ev.candidate }); };
      pc.ondatachannel = ev => brancher(ev.channel);
      const p = pc;
      pc.onconnectionstatechange = () => {
        if (p !== pc) return;
        const etat = pc.connectionState;
        if (etat === 'failed' || etat === 'closed') perdreDirect();
        else if (etat === 'disconnected') {   // souvent passager (changement de réseau) : 2,5 s pour revenir
          clearTimeout(minuteurCoupure);
          minuteurCoupure = setTimeout(() => { if (p === pc && pc.connectionState !== 'connected') perdreDirect(); }, 2500);
        }
      };
    }
    async function lier() {
      attendreLiaison();
      try {
        nouvellePaire();
        brancher(pc.createDataChannel('etat', { ordered: false, maxRetransmits: 0 }));
        brancher(pc.createDataChannel('fiable', { ordered: true }));
        const offre = await pc.createOffer();
        await pc.setLocalDescription(offre);
        versSalon({ t: 'signal', sdp: pc.localDescription });
      } catch (e) { /* pas de WebRTC sur cette machine : au bout de 7 s, la partie passe par le salon */ }
    }
    async function signal(m) {
      try {
        if (m.sdp) {
          if (!pc) nouvellePaire();
          await pc.setRemoteDescription(m.sdp);
          if (m.sdp.type === 'offer') { const reponse = await pc.createAnswer(); await pc.setLocalDescription(reponse); versSalon({ t: 'signal', sdp: pc.localDescription }); }
        } else if (m.ice && pc) await pc.addIceCandidate(m.ice);
      } catch (e) { /* candidat tardif ou liaison abandonnée : le relais prendra le relais */ }
    }
    function brancher(ch) {
      ch.binaryType = 'arraybuffer';
      if (ch.label === 'etat') { canal = ch; ch.onmessage = ev => recevoirEtat(ev.data); }
      else { fiable = ch; ch.onmessage = ev => { try { recevoirFiable(JSON.parse(ev.data)); } catch (e) { /* message illisible */ } }; }
      ch.onopen = () => { if (canal && fiable && canal.readyState === 'open' && fiable.readyState === 'open') connecte(false); };
      ch.onclose = () => perdreDirect();
    }
    // sans liaison directe au bout de 7 s, la partie passe par le salon
    function attendreLiaison() {
      clearTimeout(minuteurRelais);
      minuteurRelais = setTimeout(() => { if (R.etat !== 'connecte') connecte(true); }, 7000);
    }
    function connecte(relais) {
      if (R.etat === 'connecte') return;
      clearTimeout(minuteurRelais);
      R.relais = relais; R.etat = 'connecte';
      if (relais) passerRelais(true);
      // horloge commune : l'invité interroge l'hôte, vite au début puis toutes les secondes
      if (R.role === 'invite') { let n = 0; const ping = () => { R.envoyer({ t: 'ping', a: maintenant() }); minuteurPing = setTimeout(ping, ++n < 12 ? 120 : 1000); }; ping(); }
      emettre('pret', { relais });
    }
    // l'un passe par le salon : l'autre le suit, même s'il croyait la liaison directe établie
    function passerRelais(prevenir) {
      R.relais = true;
      clearTimeout(minuteurCoupure);
      if (prevenir) versSalon({ t: 'relais', m: { t: 'passer-relais' } });
      const p = pc; pc = null;
      if (p) { try { p.close(); } catch (e) { /* déjà fermée */ } }
      if (R.etat === 'connecte') emettre('relais');
    }
    // Liaison directe impossible (pare-feu, routeur d'opérateur mobile) ou perdue en pleine course : la partie passe
    // par le salon, sur la même connexion que la page (port 443), sans attendre ni s'arrêter.
    function perdreDirect() {
      if (R.relais || R.etat === 'ferme') return;
      if (!ws || ws.readyState !== 1) { if (R.etat === 'connecte') terminer('liaison'); return; }
      if (R.etat === 'connecte') passerRelais(true); else connecte(true);
    }
    function recevoirFiable(m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'passer-relais') { if (!R.relais) { passerRelais(false); if (R.etat !== 'connecte') connecte(true); } return; }
      if (m.t === 'ping') { R.envoyer({ t: 'pong', a: m.a, b: maintenant() }); return; }
      if (m.t === 'pong') {
        const rtt = maintenant() - m.a;
        echantillons.push({ rtt, decalage: m.b + rtt / 2 - maintenant() });
        if (echantillons.length > 16) echantillons.shift();
        let meilleur = echantillons[0];
        for (const x of echantillons) if (x.rtt < meilleur.rtt) meilleur = x;
        R.rtt = meilleur.rtt; R.decalage = meilleur.decalage; R.synchro = echantillons.length >= 6;
        return;
      }
      if (m.t === 'bye') { terminer('parti'); return; }
      emettre('message', m);
    }
    function recevoirEtat(buf) { const p = deballer(buf); if (p) emettre('etat', p); }

    R.envoyer = m => {
      if (fiable && fiable.readyState === 'open' && !R.relais) fiable.send(JSON.stringify(m));
      else versSalon({ t: 'relais', m });
    };
    R.envoyerEtat = buf => {
      if (canal && canal.readyState === 'open' && !R.relais) { if (canal.bufferedAmount < 64 * 1024) canal.send(buf); }
      else if (ws && ws.readyState === 1 && ws.bufferedAmount < 64 * 1024) ws.send(buf);
    };
    function terminer(raison) {
      if (R.etat === 'ferme') return;
      R.etat = 'ferme';
      clearTimeout(minuteurRelais); clearTimeout(minuteurPing); clearTimeout(minuteurCoupure);
      try { if (pc) pc.close(); } catch (e) { /* déjà fermée */ }
      try { if (ws) ws.close(); } catch (e) { /* déjà fermé */ }
      pc = canal = fiable = ws = null;
      emettre('ferme', raison);
    }
    R.fermer = () => { try { R.envoyer({ t: 'bye' }); } catch (e) { /* liaison déjà coupée */ } terminer('local'); };
    return R;
  }

  // Adresse du salon : ?salon=ws://… pour les essais, le même hôte en local (localhost), sinon le salon de
  // bitume.estrasse.fr, d'où que vienne la page (fichier ouvert sur le disque, copie hébergée ailleurs).
  function adresseSalon() {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('salon') : null;
    if (q) return q;
    if (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return 'ws://' + location.host + '/salon';
    return 'wss://bitume.estrasse.fr/salon';
  }

  B.reseau = { creer, emballer, deballer, prolonger, adresseSalon, CHAMPS };
})(globalThis.BITUME = globalThis.BITUME || {});
