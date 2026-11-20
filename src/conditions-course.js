/* BITUME — résolution des conditions au départ ; aucun accès réseau hors modes réels.
 * resoudre(reglages, {date, hasard, fetch, signal, forcer, timeoutMs}) -> snapshot sérialisable.
 * nuitReelle(Date.now(), snapshot.horlogeReelle) -> 0..1, sans réseau ni cycle accéléré.
 * L'hôte partage les valeurs et les deux états réels ; les invités ne résolvent rien.
 * Sources : https://www.geojs.io/docs/v1/endpoints/geo/ ; https://open-meteo.com/en/docs
 * Soleil approché : https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 * Cache uniquement en mémoire. Aucune IP/coordonnée dans le résultat ou un stockage.
 */
(function (B) {
  'use strict';
  const MODES = Object.freeze(['manuel', 'aleatoire', 'reel']);
  const FORCES_PLUIE = Object.freeze({ fine: .2, moderee: .45, forte: .75, tres_forte: 1 });
  const SAISONS = ['printemps', 'ete', 'automne', 'hiver'], MOMENTS = ['jour', 'crepuscule', 'nuit', 'cycle'];
  const METEOS = ['soleil', 'pluie', 'variable'], JOUR = 86400000, CACHE = 12 * 60000, DELAI_MIN = 30000;
  const GEO = 'https://get.geojs.io/v1/ip/geo.json', METEO = 'https://api.open-meteo.com/v1/forecast';
  const CODES = new Set([0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 97, 99]);
  const NEIGE = new Set([71, 73, 75, 77, 85, 86]);
  let cacheGeo = null, cacheMeteo = null, dernierGeo = -Infinity, derniereMeteo = -Infinity, dernierFetch = null, active = null;
  const formats = new Map(), heures = new Map();
  const normaliserMode = id => MODES.includes(id) ? id : 'manuel';
  const normaliserForcePluie = id => Object.prototype.hasOwnProperty.call(FORCES_PLUIE, id) ? id : 'forte';
  const borne = (v, a, b) => Math.max(a, Math.min(b, v));
  const lisse = (a, b, x) => { const t = borne((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const propre = value => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 80) : '';
  function dateValide(value) {
    const d = new Date(value === undefined ? Date.now() : value);
    if (!Number.isFinite(d.getTime())) throw new TypeError('Date invalide');
    return d;
  }
  function fuseauValide(value) {
    if (typeof value !== 'string' || value.length > 80) return null;
    try { new Intl.DateTimeFormat('fr', { timeZone: value }).format(0); return value; } catch (_) { return null; }
  }
  function fuseauLocal() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (_) { return null; }
  }
  function parties(date, fuseau) {
    if (!fuseau) return { month: date.getMonth() + 1, hour: date.getHours(), minute: date.getMinutes() };
    let format = formats.get(fuseau);
    if (!format) {
      try { format = new Intl.DateTimeFormat('en-GB', { timeZone: fuseau, month: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }); }
      catch (_) { return parties(date, null); }
      if (formats.size >= 8) formats.clear(); formats.set(fuseau, format);
    }
    const result = {};
    for (const part of format.formatToParts(date)) if (part.type !== 'literal') result[part.type] = Number(part.value);
    result.hour %= 24; return result;
  }
  // Saisons météorologiques ; inversion explicite au sud. Sans latitude : nord annoncé dans meta.
  function saisonReelle(value, latitude = 45, fuseau = null) {
    const month = parties(dateValide(value), fuseau).month - 1, saison = Math.floor(((month + 1 + (latitude < 0 ? 6 : 0)) % 12) / 3);
    return ['hiver', 'printemps', 'ete', 'automne'][saison];
  }
  function localisation(data) {
    if (!data) return null;
    for (const value of [data.latitude, data.longitude])
      if (!['number', 'string'].includes(typeof value) || typeof value === 'string' && !value.trim()) return null;
    const lat = Number(data.latitude), lon = Number(data.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    // L'IP ne donne qu'une zone ; le service météo reçoit des coordonnées arrondies au dixième.
    return { latitude: Math.round(lat * 10) / 10, longitude: Math.round(lon * 10) / 10,
      fuseau: fuseauValide(data.timezone || data.fuseau), lieu: [propre(data.city), propre(data.country)].filter(Boolean).join(', ') || null };
  }
  function horlogeSolaire(date, lieu) {
    const origine = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()), jours = [], rad = Math.PI / 180;
    for (let i = -1; i <= 7; i++) {
      const base = origine + i * JOUR, d = new Date(base), an = d.getUTCFullYear(), debut = Date.UTC(an, 0, 1);
      const longueur = (Date.UTC(an + 1, 0, 1) - debut) / JOUR, gamma = 2 * Math.PI / longueur * ((base - debut) / JOUR);
      const eq = 229.18 * (.000075 + .001868 * Math.cos(gamma) - .032077 * Math.sin(gamma) - .014615 * Math.cos(2 * gamma) - .040849 * Math.sin(2 * gamma));
      const decl = .006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma) - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma) - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma);
      const lat = borne(lieu.latitude, -89.9999, 89.9999) * rad;
      const angle = (Math.cos(90.833 * rad) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
      const midi = base + (720 - 4 * lieu.longitude - eq) * 60000, polaire = angle < -1 ? 1 : angle > 1 ? -1 : 0;
      const demiJour = polaire ? 0 : Math.acos(borne(angle, -1, 1)) / rad * 4 * 60000;
      jours.push({ midi: Math.round(midi), lever: polaire ? null : Math.round(midi - demiJour), coucher: polaire ? null : Math.round(midi + demiJour), polaire });
    }
    return { type: 'soleil', source: 'calcul-solaire', fuseau: lieu.fuseau, jours };
  }
  function jourProche(ms, horloge) {
    let jour = null, ecart = Infinity;
    const jours = horloge && Array.isArray(horloge.jours) ? horloge.jours : [];
    for (let i = 0; i < Math.min(jours.length, 16); i++) { const candidat = jours[i];
      if (!candidat || !Number.isFinite(candidat.midi)) continue;
      const d = Math.abs(ms - candidat.midi); if (d < ecart) { jour = candidat; ecart = d; }
    }
    if (!jour) return null;
    // Une très longue course prolonge le dernier horaire sur de vrais jours de 24 h.
    const decalage = Math.abs(ms - jour.midi) > JOUR / 2 ? Math.round((ms - jour.midi) / JOUR) * JOUR : 0;
    return { lever: jour.lever === null ? null : jour.lever + decalage, coucher: jour.coucher === null ? null : jour.coucher + decalage, polaire: jour.polaire };
  }
  function nuitReelle(value, horloge) {
    const date = dateValide(value), ms = date.getTime();
    if (horloge && horloge.type === 'soleil') {
      const jour = jourProche(ms, horloge);
      if (jour) {
        if (jour.polaire === 1) return 0; if (jour.polaire === -1) return 1;
        if (Number.isFinite(jour.lever) && Number.isFinite(jour.coucher) && jour.coucher > jour.lever) {
          const crepuscule = 25 * 60000;
          return 1 - lisse(jour.lever - crepuscule, jour.lever + crepuscule, ms) * (1 - lisse(jour.coucher - crepuscule, jour.coucher + crepuscule, ms));
        }
      }
    }
    const fuseau = horloge && horloge.fuseau, minute = Math.floor(ms / 60000), cle = fuseau || 'locale';
    let heure = heures.get(cle);
    if (!heure || heure.minute !== minute) {
      const p = parties(date, fuseau), valeur = p.hour * 60 + p.minute;
      heure = { minute, valeur }; if (heures.size >= 8) heures.clear(); heures.set(cle, heure);
    }
    const h = (heure.valeur + (ms - minute * 60000) / 60000) / 60;
    // Repli transparent : heure civile, lever conventionnel 6 h / coucher 18 h.
    return 1 - lisse(5.5, 6.5, h) * (1 - lisse(17.5, 18.5, h));
  }
  function meteoWMO(current) {
    const code = current && current.weather_code;
    if (!Number.isInteger(code) || !CODES.has(code)) throw new Error('Données météo inconnues');
    const orage = code >= 95, neige = NEIGE.has(code), humide = code >= 51, couvert = code >= 2;
    const defaut = orage ? 1 : couvert ? code >= 45 ? .9 : code === 3 ? 1 : .5 : code ? .2 : .08;
    const nuage = Number.isFinite(current.cloud_cover) ? borne(current.cloud_cover / 100, 0, 1) : defaut;
    const intervalle = Number.isFinite(current.interval) && current.interval > 0 ? current.interval : 900;
    const mm = Number.isFinite(current.precipitation) ? Math.max(0, current.precipitation) * 3600 / intervalle : null;
    const pluie = humide ? mm === null ? (orage ? 1 : .55) : borne(1 - Math.exp(-mm / 2.2), .08, 1) : 0;
    const vitesse = Number.isFinite(current.wind_speed_10m) ? borne(current.wind_speed_10m, 0, 100) : 0;
    const direction = Number.isFinite(current.wind_direction_10m) ? current.wind_direction_10m * Math.PI / 180 : 0;
    const libelle = orage ? 'Orage' : neige ? 'Neige' : humide ? code < 60 ? 'Bruine' : 'Pluie' : code >= 45 ? 'Brouillard' : code === 3 ? 'Couvert' : code === 2 ? 'Nuages épars' : code ? 'Éclaircies' : 'Soleil';
    return { meteo: humide ? 'pluie' : 'soleil', code, libelle, neige,
      mReelle: { reel: true, fixe: true, neige, t: 0, tp: 0, phase: orage ? 'orage' : humide ? 'pluie' : couvert ? 'couvre' : 'clair',
        pluie, nuage, mouille: humide ? Math.max(.2, pluie * .75) : 0, eclair: 0, prochainEclair: orage ? 1.2 : 0,
        // Direction WMO = provenance ; axes visuels x est, z nord.
        ventX: -Math.sin(direction) * vitesse, ventZ: -Math.cos(direction) * vitesse } };
  }
  function annulation() { const e = new Error('Résolution annulée'); e.name = 'AbortError'; return e; }
  async function limiter(signal, timeoutMs, travail) {
    const controller = new AbortController(); let timer, retirer = () => {}, rejeter;
    const arret = new Promise((_, reject) => { rejeter = reject; });
    const op = { annuler() { rejeter(annulation()); controller.abort(); } }; active = op;
    if (signal) { signal.addEventListener('abort', op.annuler, { once: true }); retirer = () => signal.removeEventListener('abort', op.annuler); }
    timer = setTimeout(() => { const e = new Error('Délai dépassé'); e.name = 'TimeoutError'; rejeter(e); controller.abort(); }, timeoutMs);
    try { return await Promise.race([travail(controller.signal), arret]); }
    finally { clearTimeout(timer); retirer(); if (active === op) active = null; }
  }
  async function json(fetcher, url, signal) {
    if (signal.aborted) throw annulation();
    const response = await fetcher(url, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal });
    if (!response || !response.ok) throw new Error('Service indisponible');
    const data = await response.json(); if (signal.aborted) throw annulation(); return data;
  }
  const frais = (cache, maintenant) => !!cache && maintenant >= cache.quand && maintenant - cache.quand < CACHE;
  function choisir(liste, valeur, defaut, mode, hasard) {
    if (mode !== 'aleatoire') return liste.includes(valeur) ? valeur : defaut;
    const h = hasard(); return liste[Math.min(liste.length - 1, Math.floor(borne(Number.isFinite(h) ? h : 0, 0, 1) * liste.length))];
  }
  async function resoudre(reglages = {}, options = {}) {
    if (active) active.annuler();
    if (options.signal && options.signal.aborted) throw annulation();
    const date = dateValide(options.date), hasard = typeof options.hasard === 'function' ? options.hasard : Math.random;
    const saisonMode = normaliserMode(reglages.saisonMode), momentMode = normaliserMode(reglages.momentMode);
    const meteoMode = reglages.meteo === 'aleatoire' && !reglages.meteoMode ? 'aleatoire' : normaliserMode(reglages.meteoMode);
    const sources = { saison: saisonMode, moment: momentMode, meteo: meteoMode };
    const resultat = { saisonMode, momentMode, meteoMode,
      saison: choisir(SAISONS, reglages.saison, 'ete', saisonMode, hasard), moment: choisir(MOMENTS, reglages.moment, 'jour', momentMode, hasard),
      meteo: choisir(METEOS, reglages.meteo, 'soleil', meteoMode, hasard), forcePluie: normaliserForcePluie(reglages.forcePluie), mReelle: null, horlogeReelle: null,
      meta: { statut: 'ok', sources, lieu: null, message: '', cache: false, limite: false, releve: null, lever: null, coucher: null } };
    if (![saisonMode, momentMode, meteoMode].includes('reel')) return resultat;
    const maintenant = Number.isFinite(options.maintenant) ? options.maintenant : Date.now();
    const fetcher = Object.prototype.hasOwnProperty.call(options, 'fetch') ? options.fetch
      : typeof window !== 'undefined' && typeof globalThis.fetch === 'function' ? globalThis.fetch : null;
    if (fetcher !== dernierFetch) { cacheGeo = cacheMeteo = null; dernierGeo = derniereMeteo = -Infinity; dernierFetch = fetcher; }
    let lieu = localisation(options.localisation) || (frais(cacheGeo, maintenant) ? cacheGeo.valeur : null), observation = null, erreur = null;
    const cleLieu = () => lieu ? lieu.latitude + ',' + lieu.longitude : '';
    const cacheValide = () => frais(cacheMeteo, maintenant) && cacheMeteo.cle === cleLieu();
    const besoinMeteo = meteoMode === 'reel', force = options.forcer === true;
    const geoRecent = maintenant >= dernierGeo && maintenant - dernierGeo < DELAI_MIN;
    const meteoRecente = maintenant >= derniereMeteo && maintenant - derniereMeteo < DELAI_MIN;
    if (besoinMeteo && cacheValide() && (!force || meteoRecente)) { observation = cacheMeteo.valeur; resultat.meta.cache = true; }
    const limite = !lieu && geoRecent || besoinMeteo && !observation && meteoRecente;
    if ((!lieu || besoinMeteo && !observation) && typeof fetcher === 'function' && !limite) {
      try {
        await limiter(options.signal, borne(Number.isFinite(options.timeoutMs) ? options.timeoutMs : 4000, 1, 4000), async signal => {
          if (!lieu) {
            dernierGeo = maintenant;
            lieu = localisation(await json(fetcher, GEO, signal)); if (!lieu) throw new Error('Localisation indisponible');
            cacheGeo = { quand: maintenant, valeur: lieu };
          }
          if (besoinMeteo) {
            derniereMeteo = maintenant;
            const url = METEO + '?latitude=' + lieu.latitude + '&longitude=' + lieu.longitude + '&current=weather_code,cloud_cover,precipitation,wind_speed_10m,wind_direction_10m,temperature_2m&daily=sunrise,sunset&timezone=auto&timeformat=unixtime&forecast_days=2&wind_speed_unit=ms';
            const data = await json(fetcher, url, signal), traduit = meteoWMO(data.current);
            const releve = data.current.time * 1000;
            if (!Number.isFinite(releve) || Math.abs(date.getTime() - releve) > 3 * 3600000) throw new Error('Données météo périmées');
            observation = { ...traduit, releve, daily: data.daily, temperature: Number.isFinite(data.current.temperature_2m) ? data.current.temperature_2m : null };
            cacheMeteo = { quand: maintenant, cle: cleLieu(), valeur: observation };
          }
        });
      } catch (e) { if (e.name === 'AbortError') throw e; erreur = e.name === 'TimeoutError' ? 'délai dépassé' : 'service indisponible'; }
    } else if ((!lieu || besoinMeteo && !observation) && limite) { resultat.meta.limite = true; erreur = 'nouvel essai possible après 30 secondes'; }
    else if ((!lieu || besoinMeteo && !observation) && typeof fetcher !== 'function') erreur = 'réseau indisponible';
    if (force && besoinMeteo && meteoRecente) resultat.meta.limite = true;
    const messages = []; resultat.meta.lieu = lieu && lieu.lieu;
    if (saisonMode === 'reel') {
      resultat.saison = saisonReelle(date, lieu ? lieu.latitude : 45, lieu ? lieu.fuseau : null); sources.saison = lieu ? 'date-locale' : 'calendrier-nord';
      if (!lieu) messages.push('Saison selon le calendrier de l’hémisphère nord.');
    }
    if (momentMode === 'reel') {
      const horloge = lieu ? horlogeSolaire(date, lieu) : { type: 'locale', source: 'heure-locale', fuseau: fuseauLocal() };
      if (lieu && observation && observation.daily) {
        const daily = observation.daily;
        for (let i = 0; i < Math.min(3, daily.sunrise && daily.sunrise.length || 0); i++) {
          const lever = daily.sunrise[i] * 1000, coucher = daily.sunset && daily.sunset[i] * 1000;
          if (!(Number.isFinite(lever) && Number.isFinite(coucher) && coucher > lever && coucher - lever < JOUR && Math.abs(lever - date.getTime()) < 4 * JOUR)) continue;
          let proche = horloge.jours[0]; for (const jour of horloge.jours) if (Math.abs(jour.midi - (lever + coucher) / 2) < Math.abs(proche.midi - (lever + coucher) / 2)) proche = jour;
          Object.assign(proche, { midi: (lever + coucher) / 2, lever, coucher, polaire: 0 }); horloge.source = 'open-meteo-et-calcul-solaire';
        }
      }
      resultat.horlogeReelle = horloge; sources.moment = horloge.source;
      const nuit = nuitReelle(date, horloge); resultat.moment = nuit < .15 ? 'jour' : nuit > .85 ? 'nuit' : 'crepuscule';
      const jour = jourProche(date.getTime(), horloge); if (jour) { resultat.meta.lever = jour.lever; resultat.meta.coucher = jour.coucher; }
      if (!lieu) messages.push('Heure locale utilisée sans position solaire.');
    }
    if (besoinMeteo) {
      if (observation) {
        resultat.meteo = observation.meteo; resultat.mReelle = { ...observation.mReelle }; sources.meteo = 'open-meteo';
        Object.assign(resultat.meta, { releve: observation.releve, codeMeteo: observation.code, libelleMeteo: observation.libelle, temperature: observation.temperature });
      } else { sources.meteo = 'repli-manuel'; messages.push('Météo réelle indisponible (' + (erreur || 'données absentes') + ') : réglage manuel conservé.'); }
    }
    const repli = !lieu || besoinMeteo && !observation;
    resultat.meta.statut = repli ? 'repli' : resultat.meta.cache ? 'cache' : 'ok';
    resultat.meta.message = messages.join(' ') || (resultat.meta.lieu ? 'Conditions locales : ' + resultat.meta.lieu + '.' : 'Conditions réelles disponibles.');
    return resultat;
  }
  B.conditionsCourse = { MODES, FORCES_PLUIE, normaliserMode, normaliserForcePluie, resoudre, nuitReelle, saisonReelle, meteoWMO };
})(globalThis.BITUME = globalThis.BITUME || {});
