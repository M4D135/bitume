(function (B) {
  'use strict';
  // BITUME — jeu en ligne (David, 16/11/2026 : « le multijoueur en ligne », « netcode précis et léger, pas de lag » ;
  // « en ligne jusqu'à quatre, et deux en local contre deux en local, deux en local contre un seul »).
  //
  // Principe :
  // - de deux à quatre machines, une ou deux voitures humaines chacune (écran partagé), quatre pilotes au plus ;
  // - chaque machine conduit SES voitures sans attendre le réseau : aucun retard à la commande ;
  // - liaisons directes WebRTC entre toutes les machines (canal « état » sans reprise ni ordre, canal « fiable »
  //   ordonné) ; le salon (serveur/salon.mjs) sert à se trouver, et relaie entre deux machines sans liaison directe ;
  // - horloge commune, celle de l'hôte ; la course part au même instant T0 partout et la simulation suit cette horloge ;
  // - l'état d'une voiture (15 nombres, horodatés) part à chaque image ; une voiture distante est prolongée jusqu'à
  //   l'instant du pas par la même cinématique que la conduite, et l'écart à chaque nouvel état se résorbe en 0,12 s ;
  // - l'hôte fait courir les rivaux (et les voitures d'une machine partie) et annonce leurs temps officiels ; chaque
  //   machine annonce ceux de ses voitures.
  //
  //   const R = B.reseau.creer({ url, nom, joueurs });  R.on('salon' | 'salle' | 'pair' | 'relais' | 'parti' |
  //   'message' | 'etat' | 'erreur' | 'ferme', f) ; R.creerSalon() ; R.rejoindreSalon(code) ; R.envoyer(objet, machine?) ;
  //   R.envoyerEtat(tampon) ; R.horloge() (ms, celle de l'hôte)

  const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
  const CHAMPS = ['s', 'd', 'v', 'psi', 'beta', 'omega', 'y', 'tangage', 'roulis', 'regime', 'volant', 'rapport', 'gaz', 'frein', 'braquage'];
  const TAILLE_VOITURE = 1 + 4 * CHAMPS.length;
  const PHYSX_N = 11, PHYSX_TAILLE = 1 + 4 * PHYSX_N, PHYSX_TAMPONS = new WeakMap();
  const OFFSET_MIN = Math.fround(-.18), OFFSET_MAX = Math.fround(.14);

  // Extension facultative : vitesses monde en m/s et rad/s, quatre courses de roues en m, nombre d'appuis.
  // Les limites de course incluent exactement leur représentation float32 sur le fil.
  function valeurPhysx(p, i) {
    return i < 3 ? p.velocity[i] : i < 6 ? p.angular[i - 3] : i < 10 ? p.offsets[i - 6] : p.groundCount;
  }
  function physxValide(p, source = false) {
    if (!p || (source ? p.velocity?.length !== 3 || p.angular?.length !== 3 || p.offsets?.length !== 4
      : !(Array.isArray(p) || ArrayBuffer.isView(p)) || p.length !== PHYSX_N)) return false;
    for (let i = 0; i < PHYSX_N; i++) {
      const x = source ? valeurPhysx(p, i) : p[i];
      if (!Number.isFinite(x) || (i < 6 ? Math.abs(x) > (i < 3 ? 500 : 100)
        : i < 10 ? x < OFFSET_MIN || x > OFFSET_MAX : !Number.isInteger(x) || x < 0 || x > 4)) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- paquets d'état (fonctions pures)
  // [u8 type = 1][f64 t (ms, horloge commune)][u8 n] puis n fois [u8 id][15 × f32]
  // Queue optionnelle : [u8 0x50][u8 version=1][u8 m] puis m fois [u8 index voiture][11 × f32].
  // L'ancien lecteur ignore cette queue ; sans extension, le paquet reste identique octet pour octet.
  function emballer(t, voitures) {
    let physiques = 0;
    for (const v of voitures) if (physxValide(v.etat._physx, true)) physiques++;
    const buf = new ArrayBuffer(10 + voitures.length * TAILLE_VOITURE + (physiques ? 3 + physiques * PHYSX_TAILLE : 0)), dv = new DataView(buf);
    dv.setUint8(0, 1); dv.setFloat64(1, t, true); dv.setUint8(9, voitures.length);
    let o = 10;
    for (const v of voitures) {
      dv.setUint8(o++, v.id);
      const e = v.etat;
      for (const k of CHAMPS) { dv.setFloat32(o, Number.isFinite(e[k]) ? e[k] : 0, true); o += 4; }
    }
    if (physiques) {
      dv.setUint8(o++, 0x50); dv.setUint8(o++, 1); dv.setUint8(o++, physiques);
      for (let i = 0; i < voitures.length; i++) {
        const ph = voitures[i].etat._physx;
        if (!physxValide(ph, true)) continue;
        dv.setUint8(o++, i);
        for (let j = 0; j < PHYSX_N; j++) { dv.setFloat32(o, valeurPhysx(ph, j), true); o += 4; }
      }
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
    if (voitures.length === n && o + 3 <= dv.byteLength && dv.getUint8(o) === 0x50 && dv.getUint8(o + 1) === 1) {
      const m = dv.getUint8(o + 2), debut = o + 3;
      if (m <= n && debut + m * PHYSX_TAILLE === dv.byteLength) {
        const vus = new Uint8Array(n);
        for (let j = 0; j < m; j++) {
          const index = dv.getUint8(debut + j * PHYSX_TAILLE);
          if (index >= n || vus[index]) return { t, voitures }; // queue ambiguë : conserver seulement l'état historique
          vus[index] = 1;
        }
        o = debut;
        for (let j = 0; j < m; j++) {
          const index = dv.getUint8(o++), ph = new Float32Array(PHYSX_N);
          for (let k = 0; k < PHYSX_N; k++) { ph[k] = dv.getFloat32(o, true); o += 4; }
          if (physxValide(ph)) voitures[index].physx = ph;
        }
      }
    }
    return { t, voitures };
  }

  function prolongerPhysx(e, dt, c, r) {
    let ph = PHYSX_TAMPONS.get(r);
    if (!ph) { ph = new Float64Array(PHYSX_N); PHYSX_TAMPONS.set(r, ph); }
    for (let i = 0; i < PHYSX_N; i++) ph[i] = e.physx[i];
    r.physx = ph;
    const gravite = ph[10] === 0 ? 9.81 : 0;
    r.y = e.y + ph[1] * dt - .5 * gravite * dt * dt;
    ph[1] -= gravite * dt; // vitesse au temps prédit, notamment pour une reprise d'autorité pendant le saut
    const vitesse = Math.hypot(ph[3], ph[4], ph[5]);
    if (!dt || !vitesse) return;
    const cap = B.circuit.echantillon(c, e.s).cap + e.psi + e.beta;
    const ca = Math.cos(cap), sa = Math.sin(cap), ct = Math.cos(e.tangage), st = Math.sin(e.tangage), cr = Math.cos(e.roulis), sr = Math.sin(e.roulis);
    const wx = ph[3] / vitesse, wy = ph[4] / vitesse, wz = ph[5] / vitesse, co = Math.cos(vitesse * dt), si = Math.sin(vitesse * dt), un = 1 - co;
    // Projection verticale de la rotation monde (Rodrigues), appliquée aux trois axes Ry(-cap) Rz(tangage) Rx(roulis).
    // Pas de division par cos(tangage) : un véhicule presque vertical reste fini.
    const x = si * wz + un * wy * wx, y = co + un * wy * wy, z = -si * wx + un * wy * wz;
    const avantY = x * ca * ct + y * st + z * sa * ct;
    const droiteY = x * (ca * st * sr - sa * cr) - y * ct * sr + z * (sa * st * sr + ca * cr);
    const hautY = x * (-ca * st * cr - sa * sr) + y * ct * cr + z * (-sa * st * cr + ca * sr);
    r.tangage = Math.asin(Math.max(-1, Math.min(1, avantY))); r.roulis = Math.atan2(-droiteY, hautY);
  }

  // Prolonge un état (repère du circuit) de dt secondes, à vitesse et lacet constants : la cinématique de la conduite.
  // Un état un peu en avance sur le pas (dt < 0, l'autre machine a déjà fait ce pas) est ramené en arrière.
  function prolonger(e, dt, c, sortie) {
    const r = sortie || {};
    for (const k of CHAMPS) r[k] = e[k];
    r.physx = null;
    const pas = 1 / 120, L = c.longueur, sens = dt < 0 ? -1 : 1;
    let reste = Math.min(sens > 0 ? .35 : .1, Math.abs(dt) || 0);
    const horizon = sens * reste;
    while (reste > 1e-9) {
      const h = sens * Math.min(pas, reste), k = B.circuit.echantillon(c, r.s).courbure, den = Math.max(1 - k * r.d, .1);
      const ds = r.v * Math.cos(r.psi) / den;
      r.s = ((r.s + ds * h) % L + L) % L; r.d += r.v * Math.sin(r.psi) * h; r.psi += (r.omega - k * ds) * h;
      reste -= Math.abs(h);
    }
    if (physxValide(e.physx)) prolongerPhysx(e, horizon, c, r);
    return r;
  }

  // ---------------------------------------------------------------- liaison
  // Maillage : chaque machine a une liaison avec chacune des autres (trois au plus). La plus ancienne appelle la plus
  // récente ; une liaison directe qui n'aboutit pas en 7 s, ou qui se perd en course, passe par le salon. L'horloge
  // commune est celle de l'hôte (machine 0).
  function creer(options = {}) {
    const ecoute = {}, pairs = new Map();   // machine → { id, pc, canal, fiable, relais, pret, minuteur, coupure }
    const R = { etat: 'ferme', role: null, id: -1, code: null, membres: [], rtt: 0, decalage: 0, synchro: false, pairs,
      nom: options.nom || '', joueurs: options.joueurs === 2 ? 2 : 1 };
    Object.defineProperty(R, 'relais', { get: () => [...pairs.values()].some(p => p.relais) });
    const emettre = (nom, ...x) => { for (const f of ecoute[nom] || []) f(...x); };
    R.on = (nom, f) => { (ecoute[nom] || (ecoute[nom] = [])).push(f); return R; };
    R.pretAvec = id => { const p = pairs.get(id); return !!(p && p.pret); };
    let ws = null, minuteurPing = null;
    const echantillons = [];
    const maintenant = () => performance.now();
    R.horloge = () => maintenant() + (R.role === 'invite' ? R.decalage : 0);

    function versSalon(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
    function majEtat() { if (R.etat !== 'ferme') R.etat = [...pairs.values()].some(p => p.pret) ? 'connecte' : 'salon'; }
    function ouvrir() {
      return new Promise((ok, ko) => {
        try { ws = new WebSocket(options.url); } catch (e) { ko(e); return; }
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => { R.etat = 'salon'; ok(); };
        ws.onerror = () => { if (R.etat === 'ferme') ko(new Error('salon injoignable')); };
        // sans salon, plus de nouvelles liaisons ni de relais : la partie ne tient que si toutes ses liaisons sont directes
        ws.onclose = () => { if (R.etat !== 'ferme' && (!pairs.size || [...pairs.values()].some(p => p.relais || !p.pret))) terminer('salon'); };
        ws.onmessage = ev => {
          if (typeof ev.data !== 'string') { const u = new Uint8Array(ev.data); if (u.length > 1) recevoirEtat(ev.data.slice(1), u[0]); return; }
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (m.t === 'salon') { R.code = m.code; R.id = m.id; R.role = m.role; emettre('salon', m); }
          else if (m.t === 'salle') {
            R.membres = Array.isArray(m.membres) ? m.membres : [];
            for (const x of R.membres) if (x.id > R.id && !pairs.has(x.id)) lier(x.id);
            for (const id of [...pairs.keys()]) if (!R.membres.some(x => x.id === id)) fermerPair(id);
            emettre('salle', R.membres);
          }
          else if (m.t === 'signal') signal(m.de, m);
          else if (m.t === 'relais') recevoirFiable(m.m, m.de);
          else if (m.t === 'parti') { fermerPair(m.id); if (m.hote) terminer('parti'); else emettre('parti', m.id); }
          else if (m.t === 'erreur') emettre('erreur', m.message);
        };
      });
    }
    R.creerSalon = async () => { await ouvrir(); versSalon({ t: 'creer', nom: R.nom, joueurs: R.joueurs }); };
    R.rejoindreSalon = async code => { await ouvrir(); versSalon({ t: 'rejoindre', code: String(code || '').trim().toUpperCase(), nom: R.nom, joueurs: R.joueurs }); };
    R.profil = (nom, joueurs) => { R.nom = nom; R.joueurs = joueurs === 2 ? 2 : 1; versSalon({ t: 'profil', nom: R.nom, joueurs: R.joueurs }); };

    function nouveauPair(id) {
      let p = pairs.get(id);
      if (p) return p;
      p = { id, pc: null, canal: null, fiable: null, relais: false, pret: false, minuteur: null, coupure: null };
      pairs.set(id, p);
      try {
        const pc = p.pc = new RTCPeerConnection({ iceServers: options.iceServers || STUN });
        pc.onicecandidate = ev => { if (ev.candidate) versSalon({ t: 'signal', a: id, ice: ev.candidate }); };
        pc.ondatachannel = ev => brancher(p, ev.channel);
        pc.onconnectionstatechange = () => {
          if (p.pc !== pc) return;
          const e = pc.connectionState;
          if (e === 'failed' || e === 'closed') perdreDirect(p);
          else if (e === 'disconnected') {   // souvent passager (changement de réseau) : 2,5 s pour revenir
            clearTimeout(p.coupure);
            p.coupure = setTimeout(() => { if (p.pc === pc && pc.connectionState !== 'connected') perdreDirect(p); }, 2500);
          }
        };
      } catch (e) { p.pc = null; /* pas de WebRTC ici : le relais au bout de 7 s */ }
      p.minuteur = setTimeout(() => { if (!p.pret && pairs.get(id) === p) pairPret(p, true); }, 7000);
      return p;
    }
    async function lier(id) {
      const p = nouveauPair(id);
      if (!p.pc) return;
      try {
        brancher(p, p.pc.createDataChannel('etat', { ordered: false, maxRetransmits: 0 }));
        brancher(p, p.pc.createDataChannel('fiable', { ordered: true }));
        const offre = await p.pc.createOffer();
        await p.pc.setLocalDescription(offre);
        versSalon({ t: 'signal', a: id, sdp: p.pc.localDescription });
      } catch (e) { /* le relais prendra le relais */ }
    }
    async function signal(de, m) {
      const p = nouveauPair(de);
      try {
        if (!p.pc) return;
        if (m.sdp) {
          await p.pc.setRemoteDescription(m.sdp);
          if (m.sdp.type === 'offer') { const reponse = await p.pc.createAnswer(); await p.pc.setLocalDescription(reponse); versSalon({ t: 'signal', a: de, sdp: p.pc.localDescription }); }
        } else if (m.ice) await p.pc.addIceCandidate(m.ice);
      } catch (e) { /* candidat tardif ou liaison abandonnée */ }
    }
    function brancher(p, ch) {
      ch.binaryType = 'arraybuffer';
      if (ch.label === 'etat') { p.canal = ch; ch.onmessage = ev => recevoirEtat(ev.data, p.id); }
      else { p.fiable = ch; ch.onmessage = ev => { try { recevoirFiable(JSON.parse(ev.data), p.id); } catch (e) { /* message illisible */ } }; }
      ch.onopen = () => { if (p.canal && p.fiable && p.canal.readyState === 'open' && p.fiable.readyState === 'open') pairPret(p, false); };
      ch.onclose = () => perdreDirect(p);
    }
    function pairPret(p, relais) {
      if (p.pret && (!relais || p.relais)) return;
      clearTimeout(p.minuteur);
      const nouveau = !p.pret;
      p.pret = true;
      if (relais) passerRelais(p, true);
      majEtat();
      if (nouveau) {
        if (p.id === 0 && R.role === 'invite') demarrerPing();
        emettre('pair', p.id, p.relais);
      }
    }
    // l'un passe par le salon : l'autre le suit, même s'il croyait la liaison directe établie
    function passerRelais(p, prevenir) {
      p.relais = true;
      clearTimeout(p.coupure);
      if (prevenir) versSalon({ t: 'relais', a: p.id, m: { t: 'passer-relais' } });
      const pc = p.pc; p.pc = null; p.canal = p.fiable = null;
      if (pc) { try { pc.close(); } catch (e) { /* déjà fermée */ } }
      if (p.pret) emettre('relais', p.id);
    }
    // Liaison directe impossible (pare-feu, routeur d'opérateur mobile) ou perdue en pleine course : la partie passe
    // par le salon, sur la même connexion que la page (port 443), sans attendre ni s'arrêter.
    function perdreDirect(p) {
      if (p.relais || R.etat === 'ferme' || pairs.get(p.id) !== p) return;
      if (!ws || ws.readyState !== 1) { fermerPair(p.id); emettre('parti', p.id); return; }
      if (p.pret) passerRelais(p, true); else pairPret(p, true);
    }
    function fermerPair(id) {
      const p = pairs.get(id);
      if (!p) return;
      pairs.delete(id); clearTimeout(p.minuteur); clearTimeout(p.coupure);
      const pc = p.pc; p.pc = null;
      if (pc) { try { pc.close(); } catch (e) { /* déjà fermée */ } }
      majEtat();
    }
    // horloge commune : l'invité interroge l'hôte, vite au début puis toutes les secondes
    function demarrerPing() {
      if (minuteurPing) return;
      let n = 0;
      const ping = () => { R.envoyer({ t: 'ping', a: maintenant() }, 0); minuteurPing = setTimeout(ping, ++n < 12 ? 120 : 1000); };
      ping();
    }
    function recevoirFiable(m, de) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'passer-relais') { const p = pairs.get(de); if (p && !p.relais) { if (p.pret) passerRelais(p, false); else pairPret(p, true); } return; }
      if (m.t === 'ping') { R.envoyer({ t: 'pong', a: m.a, b: maintenant() }, de); return; }
      if (m.t === 'pong') {
        const rtt = maintenant() - m.a;
        echantillons.push({ rtt, decalage: m.b + rtt / 2 - maintenant() });
        if (echantillons.length > 16) echantillons.shift();
        let meilleur = echantillons[0];
        for (const x of echantillons) if (x.rtt < meilleur.rtt) meilleur = x;
        R.rtt = meilleur.rtt; R.decalage = meilleur.decalage; R.synchro = echantillons.length >= 6;
        return;
      }
      if (m.t === 'bye') { fermerPair(de); if (de === 0) terminer('parti'); else emettre('parti', de); return; }
      emettre('message', m, de);
    }
    function recevoirEtat(buf, de) { const p = deballer(buf); if (p) emettre('etat', p, de); }

    // message fiable à une machine (a) ou à toutes
    R.envoyer = (m, a) => {
      for (const p of pairs.values()) {
        if ((a !== undefined && p.id !== a) || !p.pret) continue;
        if (!p.relais && p.fiable && p.fiable.readyState === 'open') p.fiable.send(JSON.stringify(m));
        else versSalon({ t: 'relais', a: p.id, m });
      }
    };
    // état des voitures à toutes les machines : en direct, ou par le salon (le premier octet désigne la machine)
    R.envoyerEtat = buf => {
      let copie = null;
      for (const p of pairs.values()) {
        if (!p.pret) continue;
        if (!p.relais && p.canal && p.canal.readyState === 'open') { if (p.canal.bufferedAmount < 64 * 1024) p.canal.send(buf); }
        else if (ws && ws.readyState === 1 && ws.bufferedAmount < 64 * 1024) {
          if (!copie) { copie = new Uint8Array(buf.byteLength + 1); copie.set(new Uint8Array(buf), 1); }
          copie[0] = p.id; ws.send(copie);
        }
      }
    };
    function terminer(raison) {
      if (R.etat === 'ferme') return;
      R.etat = 'ferme';
      clearTimeout(minuteurPing);
      for (const id of [...pairs.keys()]) fermerPair(id);
      R.etat = 'ferme';
      try { if (ws) ws.close(); } catch (e) { /* déjà fermé */ }
      ws = null;
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
