import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/conditions-course.js', import.meta.url), 'utf8');
const NOW = Date.UTC(2026, 10, 18, 12), HOUR = 3600000, DAY = 24 * HOUR;
function charger(globals = {}) {
  const context = vm.createContext({ Date, Intl, AbortController, setTimeout, clearTimeout, ...globals });
  vm.runInContext(source, context); return context.BITUME.conditionsCourse;
}
const clone = x => JSON.parse(JSON.stringify(x));
const geo = { latitude: '48.8566', longitude: '2.3522', timezone: 'Europe/Paris', city: 'Paris', country: 'France', ip: '203.0.113.10' };
function meteo(code = 63, now = NOW) { return { current: { time: now / 1000, interval: 900, weather_code: code, cloud_cover: 85,
  precipitation: .5, wind_speed_10m: 5, wind_direction_10m: 90, temperature_2m: 9 },
  daily: { sunrise: [(NOW - 4 * HOUR) / 1000, (NOW + 20 * HOUR) / 1000], sunset: [(NOW + 4 * HOUR) / 1000, (NOW + 28 * HOUR) / 1000] } }; }
function reseau(options = {}) {
  const calls = [], fetch = async (url, config) => {
    calls.push({ url, config });
    if (options.failure) throw new Error('offline');
    if (options.status) return { ok: false, status: options.status };
    return { ok: true, json: async () => clone(url.includes('geojs') ? options.geo || geo : options.meteo || meteo()) };
  };
  return { calls, fetch };
}
const reglages = { saison: 'ete', moment: 'jour', meteo: 'soleil', saisonMode: 'reel', momentMode: 'reel', meteoMode: 'reel' };
let controles = 0;
async function verifier(nom, f) { await f(); controles++; console.log('ok ' + nom); }

await verifier('normalisation et modes manuels : aucune requête, aucun tirage, aucune mutation', async () => {
  const C = charger(), prefs = Object.freeze({ saison: 'automne', moment: 'cycle', meteo: 'variable' });
  const result = await C.resoudre(prefs, { fetch() { throw Error('réseau interdit'); }, hasard() { throw Error('hasard interdit'); } });
  for (const k of ['saison', 'moment', 'meteo']) assert.equal(result[k], prefs[k]);
  assert.equal(result.mReelle, null); assert.equal(result.horlogeReelle, null);
  for (const x of [null, {}, 'reellement', '']) assert.equal(C.normaliserMode(x), 'manuel');
});

await verifier('aléatoire : un tirage par champ au départ, aucune résolution récurrente ou réseau', async () => {
  const C = charger(), valeurs = [.6, .4, .99]; let n = 0;
  const result = await C.resoudre({ saisonMode: 'aleatoire', momentMode: 'aleatoire', meteoMode: 'aleatoire' }, {
    hasard: () => valeurs[n++], fetch() { throw Error('réseau interdit'); }, date: NOW });
  assert.equal(n, 3); assert.equal(result.saison, 'automne'); assert.equal(result.moment, 'crepuscule'); assert.equal(result.meteo, 'variable');
  const partage = clone(result); assert.deepEqual(clone(result), partage); assert.equal(n, 3);
  assert.equal((await C.resoudre({ meteo: 'aleatoire' }, { hasard: () => .5 })).meteo, 'pluie');
});

await verifier('saisons calendaires inversées au sud et date selon le fuseau', () => {
  const C = charger();
  for (const [month, nord, sud] of [[0, 'hiver', 'ete'], [2, 'printemps', 'automne'], [5, 'ete', 'hiver'], [8, 'automne', 'printemps']]) {
    const date = Date.UTC(2024, month, 1, 12);
    assert.equal(C.saisonReelle(date, 48, 'UTC'), nord); assert.equal(C.saisonReelle(date, -34, 'UTC'), sud);
  }
  assert.equal(C.saisonReelle(Date.UTC(2026, 2, 1, 0, 30), 48, 'America/New_York'), 'hiver');
  assert.equal(C.saisonReelle(Date.UTC(2026, 2, 1, 0, 30), 48, 'Europe/Paris'), 'printemps');
  assert.throws(() => C.saisonReelle('date invalide'), /Date invalide/);
});

await verifier('heure réelle locale : vraie horloge, fuseau/DST et minuit continus', async () => {
  const C = charger(), clock = { type: 'locale', fuseau: 'UTC' };
  assert.equal(C.nuitReelle(NOW, clock), 0); assert.equal(C.nuitReelle(NOW + 12 * HOUR, clock), 1);
  assert.equal(C.nuitReelle(NOW - 6 * HOUR, clock), .5);
  assert.equal(C.nuitReelle(NOW + 12 * HOUR - 1, clock), C.nuitReelle(NOW + 12 * HOUR + 1, clock));
  assert.equal(C.nuitReelle(Date.UTC(2026, 5, 1, 4), { type: 'locale', fuseau: 'Europe/Paris' }), .5);
  assert.equal(C.nuitReelle(Date.UTC(2026, 11, 1, 5), { type: 'locale', fuseau: 'Europe/Paris' }), .5);
  const r = await C.resoudre({ momentMode: 'reel' }, { date: NOW, fetch: null });
  assert.equal(r.horlogeReelle.type, 'locale'); assert.equal(r.meta.statut, 'repli'); assert.match(r.meta.message, /Heure locale/);
});

await verifier('soleil calculé sans météo : équinoxe, pôles et prolongation au-delà de minuit', async () => {
  const C = charger(), date = Date.UTC(2026, 2, 20, 12);
  const r = await C.resoudre({ momentMode: 'reel' }, { date, fetch: null, localisation: { latitude: 0, longitude: 0, timezone: 'UTC' } });
  const h = r.horlogeReelle, jour = h.jours.find(j => Math.abs(j.midi - date) < HOUR);
  assert.equal(h.jours.length, 9); assert(Math.abs((jour.coucher - jour.lever) / HOUR - 12) < .4);
  assert.equal(C.nuitReelle(jour.lever, h), .5); assert.equal(C.nuitReelle(jour.coucher, h), .5);
  assert.equal(C.nuitReelle(date, h), 0); assert.equal(C.nuitReelle(date + 12 * HOUR, h), 1);
  assert.equal(C.nuitReelle(date + 12 * HOUR - 1000, h), C.nuitReelle(date + 12 * HOUR + 1000, h));
  assert.equal(C.nuitReelle(date + 25 * DAY, h), 0); assert.equal(C.nuitReelle(date + 25.5 * DAY, h), 1);
  for (const [month, expected] of [[5, 0], [11, 1]]) {
    const d = Date.UTC(2026, month, 21, 12), p = await C.resoudre({ momentMode: 'reel' }, { date: d, fetch: null, localisation: { latitude: 89, longitude: 0, timezone: 'UTC' } });
    assert.equal(C.nuitReelle(d, p.horlogeReelle), expected);
  }
});

await verifier('tous les codes WMO reconnus, neige/orage et vent de provenance', () => {
  const C = charger(), secs = [0, 1, 2, 3, 45, 48], neige = [71, 73, 75, 77, 85, 86];
  for (const code of [...secs, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, ...neige, 80, 81, 82, 95, 96, 97, 99]) {
    const m = C.meteoWMO(meteo(code).current); assert.equal(m.mReelle.neige, neige.includes(code));
    assert.equal(m.meteo, secs.includes(code) ? 'soleil' : 'pluie'); assert.equal(m.mReelle.reel, true); assert.equal(m.mReelle.fixe, true);
    assert(m.mReelle.pluie >= 0 && m.mReelle.pluie <= 1); assert.equal(m.mReelle.nuage, .85);
    assert(Math.abs(m.mReelle.ventX + 5) < 1e-10); assert(Math.abs(m.mReelle.ventZ) < 1e-10);
    if (code >= 95) assert.equal(m.mReelle.phase, 'orage');
  }
  for (const code of [null, '63', NaN, 12, 100]) assert.throws(() => C.meteoWMO({ weather_code: code }), /inconnues/);
});

await verifier('résolution réelle : HTTPS/CORS sans cookies, coordonnées arrondies et état constant', async () => {
  const C = charger(), net = reseau(), r = await C.resoudre(reglages, { date: NOW, maintenant: NOW, fetch: net.fetch });
  assert.equal(net.calls.length, 2); assert.equal(r.saison, 'automne'); assert.equal(r.moment, 'jour'); assert.equal(r.meteo, 'pluie');
  assert.equal(r.meta.statut, 'ok'); assert.equal(r.meta.lieu, 'Paris, France'); assert.equal(r.meta.sources.meteo, 'open-meteo');
  assert.equal(r.meta.lever, NOW - 4 * HOUR); assert.equal(r.meta.coucher, NOW + 4 * HOUR); assert.equal(r.meta.releve, NOW);
  assert.equal(C.nuitReelle(NOW - 4 * HOUR, r.horlogeReelle), .5);
  const query = new URL(net.calls[1].url); assert.equal(query.searchParams.get('latitude'), '48.9'); assert.equal(query.searchParams.get('longitude'), '2.4');
  assert.equal(query.searchParams.get('timeformat'), 'unixtime'); assert.equal(query.searchParams.get('wind_speed_unit'), 'ms');
  for (const call of net.calls) { assert.match(call.url, /^https:\/\//); assert.equal(call.config.mode, 'cors'); assert.equal(call.config.credentials, 'omit'); assert.equal(call.config.referrerPolicy, 'no-referrer'); }
  assert.equal(r.mReelle.phase, 'pluie'); assert.equal(r.mReelle.t, 0); assert.equal(r.mReelle.fixe, true);
});

await verifier('aucune IP/coordonnée dans le résultat, aucun stockage, snapshot réseau détachable', async () => {
  const C = charger(), net = reseau(), r = await C.resoudre(reglages, { date: NOW, maintenant: NOW, fetch: net.fetch });
  const forbidden = new Set(['ip', 'latitude', 'longitude', 'asn', 'organization']);
  function verifierObjet(o) { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { assert(!forbidden.has(k)); verifierObjet(v); } }
  verifierObjet(r); assert(!JSON.stringify(r).includes(geo.ip)); assert(!/localStorage|sessionStorage|navigator\.geolocation/.test(source));
  const snapshot = clone({ saison: r.saison, moment: r.moment, meteo: r.meteo, mReelle: r.mReelle, horlogeReelle: r.horlogeReelle });
  const invite = charger({ window: {}, fetch() { throw Error('invité ne résout pas'); } });
  assert.equal(invite.nuitReelle(NOW, snapshot.horlogeReelle), C.nuitReelle(NOW, r.horlogeReelle));
});

await verifier('cache volatil12min, forcer limité30s, copies indépendantes et pas de requête manuelle après réel', async () => {
  const C = charger(), net = reseau(), options = { date: NOW, maintenant: NOW, fetch: net.fetch };
  const a = await C.resoudre(reglages, options); a.mReelle.pluie = 0;
  const b = await C.resoudre(reglages, { ...options, maintenant: NOW + 1000 });
  assert.equal(net.calls.length, 2); assert.equal(b.meta.statut, 'cache'); assert(b.mReelle.pluie > 0);
  const c = await C.resoudre(reglages, { ...options, maintenant: NOW + 2000, forcer: true });
  assert.equal(net.calls.length, 2); assert.equal(c.meta.limite, true);
  await C.resoudre(reglages, { ...options, maintenant: NOW + 31000, forcer: true }); assert.equal(net.calls.length, 3);
  await C.resoudre({ saisonMode: 'manuel', momentMode: 'aleatoire', meteoMode: 'manuel' }, { ...options, hasard: () => 0 }); assert.equal(net.calls.length, 3);
  await C.resoudre(reglages, { ...options, maintenant: NOW + 13 * 60000 }); assert.equal(net.calls.length, 5);
});

await verifier('modes indépendants : la localisation saisonnière ne bloque pas une météo réelle ensuite', async () => {
  const C = charger(), net = reseau({ geo: { ...geo, latitude: '-33.9', longitude: '151.2', timezone: 'Australia/Sydney', city: 'Sydney', country: 'Australia' } });
  const options = { date: NOW, maintenant: NOW, fetch: net.fetch };
  const a = await C.resoudre({ saisonMode: 'reel', moment: 'cycle', meteo: 'variable' }, options);
  assert.equal(a.saison, 'printemps'); assert.equal(a.moment, 'cycle'); assert.equal(a.meteo, 'variable'); assert.equal(net.calls.length, 1);
  const b = await C.resoudre({ meteoMode: 'reel', saison: 'hiver', moment: 'nuit' }, { ...options, maintenant: NOW + 1 });
  assert.equal(net.calls.length, 2); assert.equal(b.saison, 'hiver'); assert.equal(b.moment, 'nuit'); assert.equal(b.meteo, 'pluie');
});

await verifier('réseau absent, HTTP en erreur et JSON invalide : repli lisible sans promesse météo', async () => {
  for (const net of [reseau({ failure: true }), reseau({ status: 503 }), ...[null, false, [], ' '].map(latitude => reseau({ geo: { latitude, longitude: 3 } }))]) {
    const C = charger(), r = await C.resoudre({ ...reglages, meteo: 'variable' }, { date: NOW, maintenant: NOW, fetch: net.fetch });
    assert.equal(r.meta.statut, 'repli'); assert.equal(r.meteo, 'variable'); assert.equal(r.mReelle, null); assert.equal(r.horlogeReelle.type, 'locale');
    assert.equal(r.saison, 'automne'); assert.match(r.meta.message, /réglage manuel conservé/); assert.equal(net.calls.length, 1);
  }
});

await verifier('météo périmée/code inconnu : soleil/localisation conservés, manuel pour la météo', async () => {
  for (const observation of [meteo(63, NOW - 4 * HOUR), meteo(999)]) {
    const C = charger(), net = reseau({ meteo: observation }), r = await C.resoudre(reglages, { date: NOW, maintenant: NOW, fetch: net.fetch });
    assert.equal(r.meta.statut, 'repli'); assert.equal(r.mReelle, null); assert.equal(r.meteo, 'soleil'); assert.equal(r.horlogeReelle.type, 'soleil'); assert.equal(r.saison, 'automne');
  }
});

await verifier('timeout global borne même un fetch qui ignore AbortSignal', async () => {
  const C = charger(); let signal, calls = 0;
  const r = await C.resoudre(reglages, { date: NOW, maintenant: NOW, timeoutMs: 12, fetch(_url, config) { calls++; signal = config.signal; return new Promise(() => {}); } });
  assert.equal(calls, 1); assert.equal(signal.aborted, true); assert.equal(r.meta.statut, 'repli'); assert.match(r.meta.message, /délai dépassé/);
});

await verifier('annulation utilisateur et nouveau choix : aucune réponse tardive ni seconde requête', async () => {
  const C = charger(), control = new AbortController(); let signal, calls = 0, finish;
  const fetch = (_url, config) => { calls++; signal = config.signal; return new Promise(resolve => { finish = resolve; }); };
  const pending = C.resoudre(reglages, { date: NOW, maintenant: NOW, fetch, signal: control.signal });
  const rejected = assert.rejects(pending, e => e.name === 'AbortError'); control.abort(); await rejected; assert.equal(signal.aborted, true);
  finish({ ok: true, json: async () => geo }); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(calls, 1);
  const second = C.resoudre(reglages, { date: NOW, maintenant: NOW + 31000, fetch });
  const replaced = assert.rejects(second, e => e.name === 'AbortError'); const manual = await C.resoudre({ meteo: 'soleil' }); await replaced;
  assert.equal(manual.mReelle, null); assert.equal(calls, 2); assert.equal(signal.aborted, true);
  const aborted = new AbortController(); aborted.abort(); await assert.rejects(C.resoudre(reglages, { signal: aborted.signal, fetch }), e => e.name === 'AbortError'); assert.equal(calls, 2);
});

console.log(`${controles} contrôles conditions de course réussis.`);
