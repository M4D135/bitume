// BITUME — fréquentation globale, distincte des salons multijoueurs.
// Les identifiants reçus sont aléatoires ; seuls leurs SHA-256 tronqués à 128 bits sont conservés.
// La déduplication réseau n'utilise JAMAIS l'IP brute : uniquement une empreinte HMAC-SHA-256
// (clé secrète persistée hors fichier de données), et l'IP n'est lue dans X-Forwarded-For que si
// la connexion directe vient d'un proxy de confiance déclaré (défaut : aucun proxy approuvé).
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SESSION_MS = 30 * 60 * 1000;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[A-Za-z0-9_-]{22}$/, MAX_BODY = 256, MAX_FILE = 32 * 1024 * 1024;
const empreinte = s => createHash('sha256').update(s).digest('hex');
const hacher = s => createHash('sha256').update(s.toLowerCase()).digest().subarray(0, 16).toString('base64url');
const entier = n => Number.isSafeInteger(n) && n >= 0;
const faute = (status, message) => Object.assign(new Error(message), { status });

// ——— Déduplication réseau : l'IP n'est JAMAIS persistée en clair, uniquement une empreinte HMAC.
function normaliserIp(brute) {
  if (typeof brute !== 'string') return null;
  let ip = brute.trim();
  const m = ip.match(/^::ffff:([0-9.]+)$/i); if (m) ip = m[1];   // IPv4 cartographié en IPv6
  if (/^[0-9]{1,3}(\.[0-9]{1,3}){3}$/.test(ip)) {
    const o = ip.split('.').map(Number);
    return o.every(x => x >= 0 && x <= 255) ? o.join('.') : null;
  }
  if (ip.includes(':') && /^[0-9a-f:]+$/.test(ip)) return ip.toLowerCase();
  return null;
}
const vers32 = s => { const o = s.split('.').map(Number); return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0; };
function enReseau(ip, cidr) {
  const [base, masque] = String(cidr).split('/');
  const b = normaliserIp(base); if (!b) return false;
  if (masque === undefined) return ip === b;
  if (!b.includes(':')) {
    const n = +masque; if (!Number.isInteger(n) || n < 0 || n > 32) return false;
    const mb = n === 0 ? 0 : (0xffffffff << (32 - n)) >>> 0;
    return (vers32(ip) & mb) >>> 0 === (vers32(b) & mb) >>> 0;
  }
  return false; // IPv6 : correspondance exacte seulement
}
function proxyConfiant(ip, proxies) { return !!ip && proxies.some(p => enReseau(ip, p)); }
// IP du client : X-Forwarded-For n'est lu que si la connexion directe vient d'un proxy approuvé ;
// sinon on prend la connexion directe (l'XFF d'un client quelconque est spoofable).
function ipClient(adresseDirecte, entetes, proxies) {
  const directe = normaliserIp(adresseDirecte);
  if (!proxyConfiant(directe, proxies)) return directe;
  const xff = entetes?.['x-forwarded-for'];
  const liste = (Array.isArray(xff) ? xff.join(',') : typeof xff === 'string' ? xff : '')
    .split(',').map(s => normaliserIp(s)).filter(Boolean);
  for (let i = liste.length - 1; i >= 0; i--) if (!proxyConfiant(liste[i], proxies)) return liste[i];
  return liste.length ? liste[0] : directe;
}

export function validerIdentifiants(x) {
  if (!x || Array.isArray(x) || Object.keys(x).length !== 2 || !Object.hasOwn(x, 'visitorId') || !Object.hasOwn(x, 'visitId') ||
      typeof x.visitorId !== 'string' || typeof x.visitId !== 'string' || !ID.test(x.visitorId) || !ID.test(x.visitId))
    throw faute(400, 'Identifiants de visite invalides.');
  return { visiteur: hacher(x.visitorId), session: hacher(x.visitId) };
}

function vide() { return { version: 2, revision: 0, visites: 0, visiteursUniques: 0, reseauxUniques: 0, baseVisites: 0, baseUniques: 0, baseReseaux: 0, visiteurs: [], sessions: [], reseaux: [] }; }
function decoder(texte) {
  const paquet = JSON.parse(texte);
  if ((paquet?.format === 'bitume-visites' && paquet.donnees?.version > 2) || paquet?.version > 2)
    throw Object.assign(new Error('Version des visites plus récente que ce serveur'), { code: 'FORMAT_FUTUR' });
  // Format initial sans identifiants : les totaux historiques deviennent un socle, jamais remis à zéro.
  if (paquet?.version === 0 && Object.keys(paquet).length === 3 && ['visites', 'visiteursUniques'].every(k => Object.hasOwn(paquet, k)) &&
      entier(paquet.visites) && entier(paquet.visiteursUniques) && paquet.visiteursUniques <= paquet.visites)
    return { ...vide(), revision: 1, visites: paquet.visites, visiteursUniques: paquet.visiteursUniques,
      baseVisites: paquet.visites, baseUniques: paquet.visiteursUniques };
  if (paquet?.format !== 'bitume-visites' || empreinte(JSON.stringify(paquet.donnees)) !== paquet.sha256) throw new Error('Empreinte des visites invalide');
  const d = paquet.donnees;
  if (![1, 2].includes(d?.version) || !['revision', 'visites', 'visiteursUniques', 'baseVisites', 'baseUniques'].every(k => entier(d[k])) ||
      !Array.isArray(d.visiteurs) || !Array.isArray(d.sessions) || d.baseUniques > d.baseVisites) throw new Error('Format des visites invalide');
  const visiteurs = new Set(), sessions = new Map(); let comptes = 0;
  for (const v of d.visiteurs) {
    if (!Array.isArray(v) || v.length !== 3 || !HASH.test(v[0]) || !entier(v[1]) || !HASH.test(v[2]) || visiteurs.has(v[0])) throw new Error('Index visiteurs invalide');
    visiteurs.add(v[0]);
  }
  for (const s of d.sessions) {
    if (!Array.isArray(s) || s.length !== 3 || !HASH.test(s[0]) || !visiteurs.has(s[1]) || s[2] !== null && !HASH.test(s[2]) || sessions.has(s[0])) throw new Error('Index sessions invalide');
    sessions.set(s[0], s); comptes += s[2] === null ? 1 : 0;
  }
  for (const s of d.sessions) if (s[2] !== null && (sessions.get(s[2])?.[1] !== s[1] || sessions.get(s[2])?.[2] !== null)) throw new Error('Alias de session invalide');
  for (const v of d.visiteurs) if (sessions.get(v[2])?.[1] !== v[0] || sessions.get(v[2])?.[2] !== null) throw new Error('Session courante invalide');
  if (d.visites !== d.baseVisites + comptes || d.visiteursUniques !== d.baseUniques + visiteurs.size || d.visiteursUniques > d.visites)
    throw new Error('Totaux des visites incohérents');
  // Réseau : absent en v1 (socle nul, ensemble vide — migration sans perte), validé en v2.
  if (d.version === 2) {
    if (!entier(d.reseauxUniques) || !entier(d.baseReseaux) || !Array.isArray(d.reseaux) || d.baseReseaux > d.baseVisites)
      throw new Error('Format réseau invalide');
    const vus = new Set();
    for (const r of d.reseaux) { if (typeof r !== 'string' || !HASH.test(r) || vus.has(r)) throw new Error('Index réseaux invalide'); vus.add(r); }
    if (d.reseauxUniques !== d.baseReseaux + vus.size || d.reseauxUniques > d.visiteursUniques)
      throw new Error('Totaux des réseaux incohérents');
  } else { d.reseaux = []; d.reseauxUniques = 0; d.baseReseaux = 0; }
  d.version = 2;
  return d;
}
const encoder = d => JSON.stringify({ format: 'bitume-visites', donnees: d, sha256: empreinte(JSON.stringify(d)) }) + '\n';

export function creerCompteurVisites({ fichier = process.env.BITUME_VISITES_FICHIER || fileURLToPath(new URL('../donnees/visites.json', import.meta.url)), maintenant = Date.now, journal = console.error,
  proxies = (process.env.BITUME_VISITES_PROXIES || '').split(',').map(s => s.trim()).filter(Boolean), selFichier = fichier + '.sel' } = {}) {
  fichier = path.resolve(fichier); selFichier = path.resolve(selFichier);
  let etat, visiteurs, sessions, reseaux, file = Promise.resolve(), ouverture, copieComplete = true, secret = null;
  const totaux = () => ({ visites: etat.visites, visiteursUniques: etat.visiteursUniques, reseauxUniques: etat.reseauxUniques });
  const installer = d => { etat = d; visiteurs = new Map(d.visiteurs.map(v => [v[0], v])); sessions = new Map(d.sessions.map(s => [s[0], s])); reseaux = new Set(d.reseaux); };
  // Empreinte HMAC de l'IP (clé secrète persistée hors des données, jamais l'IP elle-même).
  const hacherReseau = ip => ip ? createHmac('sha256', secret).update(ip).digest().subarray(0, 16).toString('base64url') : null;
  async function chargerSecret() {
    try { secret = await readFile(selFichier); if (secret.length < 16) throw Object.assign(new Error('clé trop courte'), { code: 'SEL_COURT' }); }
    catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'SEL_COURT') throw e;
      secret = randomBytes(32); await mkdir(path.dirname(selFichier), { recursive: true, mode: 0o700 }); await atomique(selFichier, secret);
    }
  }
  async function atomique(destination, texte) {
    const temporaire = destination + '.next', f = await open(temporaire, 'w', 0o600);
    try { await f.writeFile(texte, 'utf8'); await f.sync(); } finally { await f.close(); }
    await rename(temporaire, destination);
    const dossier = await open(path.dirname(destination), 'r');
    try { await dossier.sync(); } finally { await dossier.close(); }
  }
  async function sauver(d) {
    await mkdir(path.dirname(fichier), { recursive: true, mode: 0o700 });
    const texte = encoder(d);
    if (Buffer.byteLength(texte) > MAX_FILE) throw new Error('Fichier de visites plein ; agrandir la limite après contrôle, données conservées');
    await atomique(fichier, texte);
    // Le fichier principal est déjà durable : conserver son état même si la deuxième copie échoue.
    installer(d); copieComplete = false;
    await atomique(fichier + '.bak', texte);
    copieComplete = true;
  }
  async function charger() {
    await chargerSecret();
    const candidats = []; let presents = 0, erreursLecture = 0;
    for (const nom of [fichier, fichier + '.bak', fichier + '.next', fichier + '.bak.next']) {
      try {
        const info = await stat(nom); presents++;
        if (info.size > MAX_FILE) throw Object.assign(new Error('Fichier de visites trop grand'), { code: 'FICHIER_PLEIN' });
        candidats.push({ nom, d: decoder(await readFile(nom, 'utf8')) });
      } catch (e) {
        if (['FORMAT_FUTUR', 'FICHIER_PLEIN', 'EACCES', 'EPERM'].includes(e.code)) throw e;
        if (e.code !== 'ENOENT') { erreursLecture++; journal('Compteur BITUME : copie illisible détectée (' + path.basename(nom) + ').'); }
      }
    }
    if (!candidats.length) {
      if (presents || erreursLecture) throw new Error('Aucune copie valide des visites ; restauration nécessaire, aucun compteur réinitialisé');
      installer(vide()); return;
    }
    candidats.sort((a, b) => b.d.revision - a.d.revision);
    const choisi = candidats[0]; installer(choisi.d);
    if (candidats.some(c => c.d.revision === choisi.d.revision && encoder(c.d) !== encoder(choisi.d)))
      throw new Error('Deux copies de visites contradictoires ; restauration nécessaire');
    if (candidats.some(c => c.d.visites > choisi.d.visites || c.d.visiteursUniques > choisi.d.visiteursUniques))
      throw new Error('Copies de visites non monotones ; restauration nécessaire');
    // Répare une copie manquante/ancienne et finalise une écriture interrompue, sans réduire les totaux.
    const principales = candidats.filter(c => [fichier, fichier + '.bak'].includes(c.nom));
    if (principales.length < 2 || principales.some(c => c.d.revision !== choisi.d.revision) || choisi.nom.endsWith('.next')) await sauver(choisi.d);
  }
  const pret = () => ouverture ||= charger();
  const serialiser = operation => {
    const tache = file.then(async () => { await pret(); return operation(); });
    file = tache.catch(() => {}); return tache;
  };
  const lire = () => serialiser(async () => { if (!copieComplete) await sauver(etat); return totaux(); });
  const enregistrer = (identifiants, contexte = {}) => {
    const ids = validerIdentifiants(identifiants);
    return serialiser(async () => {
      const reseau = hacherReseau(normaliserIp(contexte.ip));
      const t = Math.max(0, Math.floor(maintenant())), proprietaire = sessions.get(ids.session), precedent = visiteurs.get(ids.visiteur);
      if (proprietaire && proprietaire[1] !== ids.visiteur) throw faute(409, 'Identifiant de visite déjà attribué.');
      // Même identifiant : réessai, rechargement ou onglet. Un nouvel ID proche du précédent est un alias de session.
      // Le réseau est compté par empreinte HMAC (jamais l'IP brute) : premier navigateur vu sur ce réseau.
      const inconnu = precedent === undefined;
      const nouvelle = !proprietaire && (inconnu || t - precedent[1] >= SESSION_MS);
      const groupe = proprietaire ? (proprietaire[2] || proprietaire[0]) : nouvelle ? ids.session : precedent[2];
      // Un retry historique ne prolonge ni une autre session ni une session déjà expirée.
      if (proprietaire && (groupe !== precedent[2] || t - precedent[1] >= SESSION_MS || t - precedent[1] < 30000)) {
        if (!copieComplete) await sauver(etat); return totaux();
      }
      // Réseau : un réseau (empreinte HMAC de l'IP) n'est compté qu'à sa première apparition,
      // portée par un nouveau navigateur — jamais l'IP elle-même, et pas de somme de quotidiens.
      const nouveauReseau = inconnu && reseau && !reseaux.has(reseau);
      const d = { ...etat, revision: etat.revision + 1, visites: etat.visites + (nouvelle ? 1 : 0),
        visiteursUniques: etat.visiteursUniques + (inconnu ? 1 : 0),
        reseauxUniques: etat.reseauxUniques + (nouveauReseau ? 1 : 0),
        visiteurs: etat.visiteurs.filter(v => v[0] !== ids.visiteur).concat([[ids.visiteur, Math.max(t, precedent?.[1] || 0), groupe]]),
        sessions: proprietaire ? etat.sessions : etat.sessions.concat([[ids.session, ids.visiteur, nouvelle ? null : groupe]]),
        reseaux: nouveauReseau ? etat.reseaux.concat([reseau]) : etat.reseaux };
      if (![d.revision, d.visites, d.visiteursUniques, d.reseauxUniques].every(entier)) throw new Error('Compteur maximal atteint ; données conservées');
      await sauver(d); return totaux();
    });
  };
  return { lire, enregistrer, fichier, ipClient: req => ipClient(req?.socket?.remoteAddress, req?.headers, proxies) };
}

async function lireCorps(req) {
  const taille = req.headers['content-length'];
  if (taille !== undefined && (!/^\d+$/.test(taille) || +taille > MAX_BODY)) { req.resume(); throw faute(413, 'Requête trop grande.'); }
  return new Promise((resolve, reject) => {
    const morceaux = []; let octets = 0, fini = false;
    const terminer = (e, valeur) => {
      if (fini) return; fini = true; clearTimeout(delai);
      req.removeListener('data', data); req.removeListener('end', fin); req.removeListener('aborted', abandon); req.removeListener('error', abandon);
      if (e) { req.resume(); reject(e); } else resolve(valeur);
    };
    const data = b => { octets += b.length; if (octets > MAX_BODY) terminer(faute(413, 'Requête trop grande.')); else morceaux.push(b); };
    const abandon = () => terminer(faute(400, 'Requête interrompue.'));
    const fin = () => {
      try {
        const texte = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(morceaux));
        // Deux champs littéraux seulement : rejette aussi les clés dupliquées, masquées par JSON.parse.
        const champ = '"(?:visitorId|visitId)"\\s*:\\s*"[0-9a-fA-F-]{36}"';
        if (!new RegExp('^\\s*\\{\\s*' + champ + '\\s*,\\s*' + champ + '\\s*\\}\\s*$').test(texte)) throw new Error('Schéma JSON');
        const valeur = JSON.parse(texte); validerIdentifiants(valeur); terminer(null, valeur);
      } catch { terminer(faute(400, 'JSON invalide.')); }
    };
    const delai = setTimeout(() => terminer(faute(408, 'Requête expirée.')), 5000); delai.unref?.();
    req.on('data', data); req.once('end', fin); req.once('aborted', abandon); req.once('error', abandon);
  });
}

export function creerRouteVisites(compteur, { journal = console.error } = {}) {
  let enCours = 0;
  return async function repondre(req, res) {
    const envoyer = (status, objet, extra = {}) => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra });
      res.end(JSON.stringify(objet));
    };
    if (enCours >= 32) { req.resume(); envoyer(429, { erreur: 'Compteur occupé.' }, { 'retry-after': '30' }); return; }
    enCours++;
    try {
      if (!['GET', 'POST'].includes(req.method)) { req.resume(); envoyer(405, { erreur: 'Méthode non autorisée.' }, { allow: 'GET, POST' }); return; }
      if (req.method === 'GET') { envoyer(200, await compteur.lire()); return; }
      const origine = req.headers.origin;
      let memeOrigine = !origine;
      if (origine) { try { const u = new URL(origine); memeOrigine = ['https:', 'http:'].includes(u.protocol) && u.host === req.headers.host; } catch {} }
      if (!memeOrigine || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) {
        req.resume(); envoyer(403, { erreur: 'Origine non autorisée.' }); return;
      }
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '') ||
          (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity')) {
        req.resume(); envoyer(415, { erreur: 'JSON UTF-8 attendu.' }); return;
      }
      envoyer(200, await compteur.enregistrer(await lireCorps(req), { ip: compteur.ipClient(req) }));
    } catch (e) {
      const status = e.status || 503;
      if (status === 503) journal('Compteur BITUME indisponible ; données conservées.');
      envoyer(status, { erreur: status === 503 ? 'Compteur temporairement indisponible.' : e.message });
    } finally { enCours--; }
  };
}
