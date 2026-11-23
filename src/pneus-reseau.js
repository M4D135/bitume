/* BITUME — protocole des pneus, sans transport, minuterie, DOM ni simulation supplémentaire.
   creer({ seance, machine, humains, nombre }) : contexte propre à une seule course, ou null.
   encoder(ctx, voitures, type?) : instantané JSON des seules voitures autorisées et conduites ici.
   recevoir(ctx, message, expéditeur, voitures) : IDs appliqués aux voitures distantes, après validation.
   reprendre(ctx, machine) : réservé à l'hôte ; IDs transférés, sans toucher aux pneus ni à leur service.
   Ligne (29 nombres) : id, service, séquence, epoch, type, puis quatre fois
   usure/saleté/grainage sur 16 bits, distance/sollicitation au centième, graine uint32.
   Séquences monotones par voiture et epoch ; epoch 1 désigne la reprise définitive par l'hôte.
   Les paquets hôte portent toujours la liste cumulative des machines reprises. Dans le chemin normal,
   l'hôte valide les états invités avant leur relais aux pairs, donc sa copie ne peut être en retard sur eux.
   Hors de ce chemin, une régression à la reprise reste refusée et marque ctx.resynchronisations. */
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.pneus) require('./pneus.js');
(function (B) {
  'use strict';
  const P = B.pneus, VERSION = 1, QUANTIFICATION = 65535, TAILLE_LIGNE = 29;
  const TYPES = ['slicks', 'inter', 'pluie', 'neige'], TYPES_MESSAGE = ['pneus-etat', 'pneus-service'];
  const possede = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const objet = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const entier = (n, max, min = 0) => Number.isSafeInteger(n) && n >= min && n <= max;
  const reel = (n, max) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  function dense(a, n) {
    if (!Array.isArray(a) || (n !== undefined && a.length !== n)) return false;
    for (let i = 0; i < a.length; i++) if (!possede(a, i)) return false;
    return true;
  }
  function creer(o) {
    if (!objet(o) || typeof o.seance !== 'string' || !o.seance.length || o.seance.length > 128 ||
      !entier(o.machine, 255) || !entier(o.nombre, 256, 1) || !dense(o.humains) ||
      o.humains.length < 1 || o.humains.length > Math.min(4, o.nombre)) return null;
    const machines = new Set(), nombres = new Map(), origines = new Array(o.nombre).fill(0);
    for (let i = 0; i < o.humains.length; i++) {
      const h = o.humains[i];
      if (!objet(h) || !possede(h, 'machine') || !entier(h.machine, 255)) return null;
      const n = (nombres.get(h.machine) || 0) + 1;
      if (n > 2) return null;
      nombres.set(h.machine, n); machines.add(h.machine); origines[i] = h.machine;
    }
    if (!machines.has(0) || !machines.has(o.machine)) return null;
    return { seance: o.seance, machine: o.machine, nombre: o.nombre, origines,
      autorites: origines.slice(), epochs: new Array(o.nombre).fill(0), machines,
      reprises: new Set(), resynchronisations: new Set(),
      sequencesEnvoi: new Array(o.nombre).fill(0), sequencesRecues: new Array(o.nombre).fill(0) };
  }
  function etatValide(e) {
    if (!objet(e) || e.versionPneus !== P.VERSION_ETAT || !P.estJouable(e.pneus) ||
      !entier(e.servicePneus, P.SERVICE_MAX) || !dense(e.etatPneus, 4)) return false;
    for (const r of e.etatPneus) if (!objet(r) || !reel(r.usure, 1) || !reel(r.salete, 1) ||
      !reel(r.grainage, 1) || !reel(r.distance, P.DISTANCE_MAX) ||
      !reel(r.sollicitation, P.SOLLICITATION_MAX) || !entier(r.graine, P.SERVICE_MAX)) return false;
    return true;
  }
  function encoder(ctx, voitures, type = 'pneus-etat') {
    if (!ctx || !TYPES_MESSAGE.includes(type) || !dense(voitures) || voitures.length > ctx.nombre) return null;
    const lignes = [], vus = new Set();
    for (const v of voitures) {
      if (!objet(v) || !entier(v.id, ctx.nombre - 1) || vus.has(v.id)) return null;
      vus.add(v.id);
      if (v.distant || ctx.autorites[v.id] !== ctx.machine) continue;
      const e = v.etat, q = ctx.sequencesEnvoi[v.id] + 1;
      if (!etatValide(e) || !entier(q, Number.MAX_SAFE_INTEGER, 1)) return null;
      const ligne = [v.id, e.servicePneus, q, ctx.epochs[v.id], TYPES.indexOf(e.pneus)];
      for (const r of e.etatPneus) ligne.push(Math.round(r.usure * QUANTIFICATION), Math.round(r.salete * QUANTIFICATION),
        Math.round(r.grainage * QUANTIFICATION), Math.round(r.distance * 100), Math.round(r.sollicitation * 100), r.graine);
      lignes.push(ligne);
    }
    if (!lignes.length) return null;
    const message = { t: type, version: VERSION, seance: ctx.seance, voitures: lignes };
    if (ctx.machine === 0) message.reprises = [...ctx.reprises].sort((a, b) => a - b);
    for (const l of lignes) ctx.sequencesEnvoi[l[0]] = l[2];
    return message;
  }
  function ligneValide(l, nombre) {
    if (!dense(l, TAILLE_LIGNE) || !entier(l[0], nombre - 1) || !entier(l[1], P.SERVICE_MAX) ||
      !entier(l[2], Number.MAX_SAFE_INTEGER, 1) || !entier(l[3], 1) || !entier(l[4], TYPES.length - 1)) return false;
    for (let i = 5; i < TAILLE_LIGNE; i += 6) {
      if (!entier(l[i], QUANTIFICATION) || !entier(l[i + 1], QUANTIFICATION) || !entier(l[i + 2], QUANTIFICATION) ||
        !entier(l[i + 3], P.DISTANCE_MAX * 100) || !entier(l[i + 4], P.SOLLICITATION_MAX * 100) ||
        !entier(l[i + 5], P.SERVICE_MAX)) return false;
    }
    return true;
  }
  function transferer(ctx, machine) {
    if (ctx.reprises.has(machine)) return [];
    ctx.reprises.add(machine);
    const ids = [];
    for (let i = 0; i < ctx.nombre; i++) if (ctx.origines[i] === machine) {
      ctx.autorites[i] = 0; ctx.epochs[i] = 1;
      ctx.sequencesEnvoi[i] = 0; ctx.sequencesRecues[i] = 0; ids.push(i);
    }
    return ids;
  }
  function reprendre(ctx, machine) {
    if (!ctx || ctx.machine !== 0 || !entier(machine, 255, 1) || !ctx.machines.has(machine)) return [];
    return transferer(ctx, machine);
  }
  function recevoir(ctx, m, de, voitures) {
    if (!ctx || !entier(de, 255) || de === ctx.machine || !ctx.machines.has(de) || !objet(m) ||
      !['t', 'version', 'seance', 'voitures'].every(k => possede(m, k)) ||
      !TYPES_MESSAGE.includes(m.t) || m.version !== VERSION || m.seance !== ctx.seance ||
      !dense(m.voitures) || m.voitures.length > ctx.nombre || !dense(voitures) || voitures.length > ctx.nombre) return [];
    const repris = new Set(ctx.reprises), ids = new Set(), cibles = new Map();
    if (de === 0) {
      if (!possede(m, 'reprises') || !dense(m.reprises) || m.reprises.length > ctx.machines.size - 1) return [];
      const annonces = new Set();
      for (const machine of m.reprises) {
        if (!entier(machine, 255, 1) || !ctx.machines.has(machine) || annonces.has(machine)) return [];
        annonces.add(machine); repris.add(machine);
      }
    } else if (possede(m, 'reprises')) return [];
    for (const l of m.voitures) {
      if (!ligneValide(l, ctx.nombre) || ids.has(l[0])) return [];
      ids.add(l[0]);
    }
    for (const v of voitures) {
      if (!objet(v) || !entier(v.id, ctx.nombre - 1) || cibles.has(v.id)) return [];
      cibles.set(v.id, v);
    }
    // Toute la forme du message, y compris les annonces de reprise, est maintenant validée.
    // Une ligne bien formée mais périmée ou sans autorité est ignorée, sans bloquer les autres voitures.
    const acceptes = [], conflits = [], recues = [];
    for (const l of m.voitures) {
      const id = l[0], v = cibles.get(id), origine = ctx.origines[id], reprise = origine !== 0 && repris.has(origine);
      const autorite = reprise ? 0 : origine, epoch = reprise ? 1 : 0;
      const dernier = epoch === ctx.epochs[id] ? ctx.sequencesRecues[id] : 0;
      if (de !== autorite || l[3] !== epoch || l[2] <= dernier) continue;
      recues.push({ id, sequence: l[2] });
      if (!v || !v.distant || !etatValide(v.etat)) continue;
      const e = v.etat, service = l[1];
      let rejet = service < e.servicePneus, regression = rejet;
      if (service === e.servicePneus) {
        if (TYPES[l[4]] !== e.pneus) rejet = true;
        for (let i = 0; i < 4; i++) {
          const r = e.etatPneus[i], k = 5 + i * 6;
          if (l[k + 5] !== r.graine) rejet = true;
          if (l[k] < Math.round(r.usure * QUANTIFICATION) || l[k + 3] < Math.round(r.distance * 100) ||
            l[k + 4] < Math.round(r.sollicitation * 100)) { rejet = true; regression = true; }
        }
      }
      if (rejet) { if (epoch === 1 && regression) conflits.push(id); continue; }
      const roues = [];
      for (let i = 0; i < 4; i++) {
        const k = 5 + i * 6, avant = e.etatPneus[i], memeService = service === e.servicePneus;
        roues.push({ usure: Math.max(memeService ? avant.usure : 0, l[k] / QUANTIFICATION),
          salete: l[k + 1] / QUANTIFICATION, grainage: l[k + 2] / QUANTIFICATION,
          distance: Math.max(memeService ? avant.distance : 0, l[k + 3] / 100),
          sollicitation: Math.max(memeService ? avant.sollicitation : 0, l[k + 4] / 100), graine: l[k + 5] });
      }
      acceptes.push({ id, v, etat: { versionPneus: P.VERSION_ETAT,
        pneus: TYPES[l[4]], servicePneus: service, etatPneus: roues } });
    }
    for (const machine of repris) transferer(ctx, machine);
    for (const { id, sequence } of recues) ctx.sequencesRecues[id] = sequence;
    for (const id of conflits) ctx.resynchronisations.add(id);
    for (const a of acceptes) {
      Object.assign(a.v.etat, a.etat);
      if (objet(a.v.livree)) a.v.livree.pneus = a.etat.pneus;
      ctx.resynchronisations.delete(a.id);
    }
    return acceptes.map(a => a.id);
  }
  B.pneusReseau = Object.freeze({ VERSION, QUANTIFICATION, TAILLE_LIGNE, creer, encoder, recevoir, reprendre });
})(globalThis.BITUME = globalThis.BITUME || {});
