// Production preparation/network functions; only DOM, transport, clocks and the async service are mocked.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const file of ['conduite', 'meteo', 'ambiance', 'saisons', 'conditions-course', 'championnat', 'navigation-menu', 'menu-arcade']) require('../src/' + file + '.js');
const production = globalThis.BITUME, source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const NOW = Date.UTC(2026, 10, 18, 12);
function extrait(debut, fin, apres = 0) {
  const a = source.indexOf(debut, apres), b = source.indexOf(fin, a + debut.length);
  assert(a >= 0 && b > a, 'extrait de production présent : ' + debut); return source.slice(a, b);
}
const reseau = extrait('  const EL = ', '  function envoyerEtats(');
const preparation = extrait('  function annulerConditions()', "  $('p-actualiser-conditions').addEventListener");
// Le bilan des conditions et les transitions utilisent maintenant les vrais raccords du menu arcade.
const ecrans = extrait('  const menuArcade = ', "  document.addEventListener('click'");
const retour = extrait('  function retour()', "  $('r-retour').addEventListener");
const pneus = extrait('  function initialiserChoixPneus(', '  function majPreparation()');
const demarrer = extrait('  function demarrerSeance(', '  function basculerPause(');
const departBouton = extrait("  $('b-depart').addEventListener", '  function demarrerSeance(');
const etatConditions = extrait('  let conditionsPreparation = ', '  function lancer(');
const fabriquer = new Function('B', 'options', `
  ${source.match(/  const PHYSIQUE = .*?;/)[0]}
  let session = null, ecran = 'preparation', modePrepa = 'course', retourReglages = 'titre', graineCourse = 100;
  let maintenant = 0, serial = 0, dernierGeste = 0;
  const Date = { now: () => (options.epoque || ${NOW}) + maintenant };
  const elements = new Map(), timers = new Map(), messages = [], departs = [], resolutions = [];
  const setTimeout = (f, d) => { const id = ++serial; timers.set(id, { f, t: maintenant + d }); return id; };
  const clearTimeout = id => timers.delete(id);
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { ownerDocument: document, hidden: false, disabled: false, textContent: '', innerHTML: '', dataset: {},
      classList: { add() {}, remove() {} }, handlers: {}, attributes: {},
      addEventListener(n, f) { this.handlers[n] = f; }, removeEventListener() {},
      setAttribute(n, v) { this.attributes[n] = v; }, querySelector() { return null; }, querySelectorAll: () => [] });
    return elements.get(id);
  };
  const document = { querySelector: $, getElementById: $, querySelectorAll: () => [], activeElement: null,
    addEventListener() {}, removeEventListener() {}, defaultView: { addEventListener() {}, removeEventListener() {}, performance } };
  const texte = (e, t) => { e.textContent = t; }, classe = () => {}, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ECRANS = ['titre','enligne','prets','preparation','reglages','pause','resultats'];
  const CATALOGUE = [{ id: 'val-brule', nom: 'Forêt', theme: 'foret' }, { id: 'port-sable', nom: 'Port-Sable', theme: 'cote' }, { id: 'haut-col', nom: 'Haut-Col', theme: 'montagne' }];
  const NOMS_PNEUS = B.pneus.NOMS_PNEUS;
  const reglages = { circuit: 0, tours: 3, difficulte: 1, saison: 'ete', moment: 'jour', meteo: 'soleil',
    saisonMode: 'manuel', momentMode: 'manuel', meteoMode: 'manuel', pneus: 'slicks', pneusPilotes: ['slicks', 'slicks'], pneusAutoPilotes: [true, true], boite: 'auto', vue: 'cockpit', joueursLocaux: 1 };
  const son = null, palier = {}, pad2 = null, hud2 = $('hud2'), jeu = $('jeu'), estTactile = true, compteurVisites = null;
  const aDeux = () => false, arreterManettes = () => {}, tactile = () => {}, appliquerVolumes = () => {}, viderStock = () => {}, suspendreAnnoncesVirages = () => {};
  const remplirReglages = () => {}, message = () => {}, sousMessage = () => {}, finirClassement = () => {}, montrerResultats = () => {};
  const remplirPreparation = () => { actualiserConditions(); };
  const lancer = (type, i, cfg, conditions) => {
    departs.push({ type, i, cfg, conditions });
    if (type === 'vitrine') session = { type, i, nature: { saison: B.saisons.profil((conditions || conditionsDuDepart()).saison, CATALOGUE[i].theme) } };
  };
  // Préparation sous voile (jeu.js) : ses étapes cèdent des images ; ici, la séance part au bout de 30 ms, si sa
  // condition (même écran, même liaison) tient encore, puis vient l'écran de course.
  const lancerVitrine = (i, k) => lancer('vitrine', i, null, k);
  const preparerSeance = (type, i, enl, conditions, o = {}) => setTimeout(() => {
    if (o.verifier && !o.verifier()) return;
    lancer(type, i, enl, conditions); aller(type === 'demo' ? 'demo' : 'course'); if (o.apres) o.apres();
  }, 30);
  B.conditionsCourse.resoudre = (regles, opts) => {
    const row = { regles: structuredClone(regles), options: opts }; resolutions.push(row);
    if (options.resoudre) return options.resoudre(regles, opts, resolutions.length);
    return new Promise((resolve, reject) => { row.resolve = resolve; row.reject = reject; });
  };
  ${etatConditions}
  ${reseau}
  ${preparation}
  ${pneus}
  ${retour}
  ${ecrans}
  ${demarrer}
  ${departBouton}
  return { $, EL, reglages, resolutions, messages, departs, actualiserConditions, annulerConditions, conditionsDuDepart,
    conditionsCommunes, horlogePartagee, nomMeteoCourse, meteoPourConditions, aller, departEnLigne, recevoirCourse, surMessageEnLigne, contratPiste,
    etat: () => ({ ecran, conditionsPreparation, conditionsPreparationCle, conditionsEnCours, session }),
    mode: mode => { modePrepa = mode; }, session: s => { session = s; },
    mettreConditions: value => { conditionsPreparation = value; conditionsPreparationCle = cleConditions(); },
    cliquerDepart: () => $('b-depart').handlers.click(),
    avancer(d) { const cible = maintenant + d; for (;;) {
      const p = [...timers].sort((a,b) => a[1].t-b[1].t).find(x => x[1].t <= cible); if (!p) break;
      timers.delete(p[0]); maintenant = p[1].t; p[1].f(); } maintenant = cible;
    },
    connecter(role = 'hote') {
      const id = role === 'hote' ? 0 : 1;
      EL.role = role; EL.R = { id, etat: 'connecte', pairs: new Map(), membres: [{id:0,nom:'Hôte',joueurs:1},{id:1,nom:'Invité',joueurs:1}],
        pretAvec: () => true, horloge: () => maintenant, envoyer(m, a) { messages.push({ m: structuredClone(m), a }); }, fermer() {} };
      return EL.R;
    }
  };
`);
function fixture(options = {}) {
  const B = { ...production, qualite: { avancer() {} }, conditionsCourse: { ...production.conditionsCourse } };
  return fabriquer(B, options);
}
function snapshot(overrides = {}) {
  return { saison: 'hiver', moment: 'nuit', meteo: 'pluie',
    mReelle: { reel: true, neige: true, phase: 'pluie', pluie: .4, nuage: .8, mouille: .7, ventX: -3, ventZ: 2 },
    horlogeReelle: { type: 'soleil', fuseau: 'Europe/Paris', jours: [{ midi: NOW, lever: NOW - 4 * 3600000, coucher: NOW + 4 * 3600000, polaire: 0 }] },
    meta: { lieu: 'Lieu privé', ip: '203.0.113.10', latitude: 48.9, longitude: 2.4, message: 'Conditions de test' }, ...overrides };
}

test('même choix en cours et prêt : une résolution, aucun nouveau tirage avant le départ', async () => {
  const f = fixture(); f.reglages.momentMode = 'aleatoire';
  const a = f.actualiserConditions(), b = f.actualiserConditions();
  assert.strictEqual(a, b); assert.equal(f.resolutions.length, 1); assert.equal(f.$('b-depart').disabled, true);
  const k = snapshot(); f.resolutions[0].resolve(k); assert.strictEqual(await a, k);
  for (let i = 0; i < 5; i++) assert.strictEqual(await f.actualiserConditions(), k);
  assert.equal(f.resolutions.length, 1); assert.strictEqual(f.conditionsDuDepart(), k); assert.equal(f.$('b-depart').disabled, false);
  await f.cliquerDepart(); f.avancer(30);
  assert.strictEqual(f.departs.find(d => d.type === 'course').conditions, k); assert.equal(f.resolutions.length, 1);
});

test('changement de choix annule la recherche et une réponse tardive ne remplace pas le nouveau résultat', async () => {
  const f = fixture(), a = f.actualiserConditions(); f.reglages.saison = 'automne'; const b = f.actualiserConditions();
  assert(f.resolutions[0].options.signal.aborted); assert.equal(f.resolutions.length, 2);
  f.resolutions[0].resolve(snapshot()); assert.equal(await a, null); assert.equal(f.$('b-depart').disabled, true);
  const k = snapshot({ saison: 'automne' }); f.resolutions[1].resolve(k); assert.strictEqual(await b, k);
  assert.strictEqual(f.conditionsDuDepart(), k); assert.equal(f.$('b-depart').disabled, false);
});

test('préparation hivernale : vitrine cachée intacte, nouvelles conditions et chaussée cohérentes au départ', async () => {
  for (const [i, theme] of [[0, 'foret'], [1, 'cote'], [2, 'montagne']]) {
    for (const mReelle of [null, { reel: true, neige: true, phase: 'pluie', pluie: .4, mouille: 0 }]) {
      const f = fixture(), profil = production.saisons.profil('hiver', theme);
      Object.assign(f.reglages, { circuit: i, saison: 'hiver', meteo: 'pluie' });
      const vitrine = { type: 'vitrine', i, nature: { saison: profil },
        meteo: production.chaussee.preparer(production.meteo.pour('soleil'), profil) };
      f.session(vitrine);
      const avant = vitrine.meteo, attente = f.actualiserConditions(true), k = snapshot({ mReelle });
      f.resolutions.at(-1).resolve(k);
      assert.strictEqual(await attente, k);
      assert.strictEqual(f.etat().session, vitrine);
      assert.equal(f.departs.length, 0, 'aucune séance cachée reconstruite dans le menu');
      assert.strictEqual(vitrine.meteo, avant, 'la vitrine cachée conserve sa météo jusqu’au départ');
      await f.cliquerDepart(); f.avancer(30);
      const depart = f.departs.find(d => d.type === 'course');
      assert(depart, 'la course est préparée au départ');
      assert.strictEqual(depart.conditions, k, 'le départ consomme les nouvelles observations');
      // Le constructeur 3D est hors banc ; sa préparation météo reste la vraie fonction de jeu.js.
      const seance = { meteo: f.meteoPourConditions(depart.conditions, depart.i, 100) };
      assert.notEqual(seance.meteo, avant, 'les nouvelles observations produisent la météo de course');
      assert.equal(seance.meteo.neigeSol, theme === 'cote' ? 0 : .75);
      assert.equal(seance.meteo.precipitationsNeige, theme !== 'cote');
      for (let pas = 0; pas < 60; pas++) production.meteo.avancer(seance, .1);
      const surface = production.chaussee.lire(null, 0, seance.meteo);
      if (theme === 'cote') {
        assert.equal(surface.neige, 0);
        assert.ok(surface.eau > 0, 'les précipitations restent liquides au Sud');
      } else {
        assert.equal(surface.neige, .75);
        assert.equal(surface.eau, 0, 'les flocons ne créent pas d’eau après actualisation');
        assert.equal(f.reglages.pneus, 'neige');
      }
    }
  }
});

test('retour depuis la préparation annule sans départ ou réactivation par une réponse tardive', async () => {
  const f = fixture(), attente = f.actualiserConditions(); f.aller('titre');
  assert(f.resolutions[0].options.signal.aborted); f.resolutions[0].resolve(snapshot()); assert.equal(await attente, null);
  assert.equal(f.etat().ecran, 'titre'); assert.equal(f.etat().conditionsPreparation, null);
  assert(!f.departs.some(d => d.type === 'course')); assert.equal(f.$('b-depart').disabled, false);
});

test('retour des réglages conserve le tirage ; nouvelle préparation après le titre et forcer le renouvellent', async () => {
  const f = fixture(), a = f.actualiserConditions(), k = snapshot(); f.resolutions[0].resolve(k); await a;
  f.aller('reglages'); f.aller('preparation'); assert.equal(f.resolutions.length, 1); assert.strictEqual(f.conditionsDuDepart(), k);
  const force = f.actualiserConditions(true); assert.equal(f.resolutions.length, 2); assert.equal(f.resolutions[1].options.forcer, true);
  const nouveau = snapshot({ saison: 'printemps' }); f.resolutions[1].resolve(nouveau); await force;
  assert.strictEqual(f.conditionsDuDepart(), nouveau);
  f.aller('titre'); f.aller('preparation'); assert.equal(f.resolutions.length, 3); assert.equal(f.etat().conditionsPreparation, null);
  f.resolutions[2].resolve(snapshot({ saison: 'ete' })); await f.etat().conditionsEnCours;
});

test('erreur inattendue : repli manuel utilisable, annulation explicite sans résultat', async () => {
  const f = fixture(), attente = f.actualiserConditions(); f.resolutions[0].reject(new Error('service'));
  const k = await attente; assert.equal(k.meta.statut, 'repli'); assert.equal(k.saison, 'ete'); assert.equal(k.mReelle, null); assert.equal(f.$('b-depart').disabled, false);
  const b = f.actualiserConditions(true), e = new Error('cancel'); e.name = 'AbortError'; f.resolutions[1].reject(e);
  assert.equal(await b, null); assert.equal(f.etat().conditionsPreparation, null); assert.equal(f.$('b-depart').disabled, false);
});

test('invité en ligne : aucun appel de résolution, préférences saison/moment/météo préservées', async () => {
  const f = fixture(); f.connecter('invite'); f.mode('enligne');
  Object.assign(f.reglages, { saison: 'ete', moment: 'jour', meteo: 'soleil', saisonMode: 'reel', momentMode: 'reel', meteoMode: 'reel' });
  assert.equal(await f.actualiserConditions(), null); assert.equal(await f.actualiserConditions(true), null); assert.equal(f.resolutions.length, 0);
  const prefs = { saison: f.reglages.saison, moment: f.reglages.moment, meteo: f.reglages.meteo };
  assert(f.recevoirCourse({ versionChoixPneus: 2, protocolePneus: 1, piste: f.contratPiste(2), ...snapshot(), i: 2, tours: 3, difficulte: 1, eau: .7 }));
  for (const [k, v] of Object.entries(prefs)) assert.equal(f.reglages[k], v);
  assert.equal(f.EL.course.saison, 'hiver'); assert(f.EL.course.mReelle.neige); assert.equal(f.resolutions.length, 0);
});

test('conditionsCommunes filtre lieu/IP/coordonnées et détache les observations et horaires', () => {
  const f = fixture(), k = snapshot(); k.horlogeReelle.latitude = 48.9; k.horlogeReelle.jours[0].ip = '203.0.113.10'; k.mReelle.longitude = 2.4;
  const commun = f.conditionsCommunes(k), texte = JSON.stringify(commun);
  assert.deepEqual(Object.keys(commun).sort(), ['forcePluie', 'horlogeReelle', 'mReelle', 'meteo', 'moment', 'saison']);
  for (const mot of ['Lieu privé', '203.0.113.10', 'latitude', 'longitude', 'meta', 'ip']) assert(!texte.includes(mot));
  k.mReelle.pluie = 0; k.horlogeReelle.jours[0].lever = 0;
  assert.equal(commun.mReelle.pluie, .4); assert.notEqual(commun.horlogeReelle.jours[0].lever, 0);
  assert.equal(f.horlogePartagee({ type: 'soleil', jours: [null, {}, { midi: NOW, lever: 2, coucher: 1 }] }), null);
  assert.deepEqual(f.horlogePartagee({ type: 'locale', fuseau: 'pas-un-fuseau', ip: 'x' }), { type: 'locale', fuseau: 'UTC' });
});

test('départ réseau : hôte et invité reçoivent mêmes saison, météo, soleil et date UTC malgré une horloge locale différente', () => {
  const h = fixture({ epoque: NOW }), i = fixture({ epoque: NOW + 8 * 3600000 }); h.connecter('hote'); i.connecter('invite');
  h.EL.course = { ...snapshot(), i: 2, tours: 5, difficulte: 1, eau: .7 };
  h.departEnLigne(); const packet = h.messages.find(x => x.m.t === 'depart').m;
  assert.equal(packet.cfg.dateDepart, NOW + 4000); assert.equal(packet.cfg.T0, 4000); assert(!JSON.stringify(packet).includes('Lieu privé'));
  i.surMessageEnLigne(packet, 0); h.avancer(30); i.avancer(30);
  const host = h.departs.find(d => d.cfg && d.cfg.role === 'hote').cfg, invite = i.departs.find(d => d.cfg && d.cfg.role === 'invite').cfg;
  for (const key of ['saison', 'moment', 'meteo', 'forcePluie', 'mReelle', 'horlogeReelle', 'dateDepart', 'T0']) assert.deepEqual(invite[key], host[key], key);
  assert.equal(i.reglages.saison, 'ete'); assert.equal(i.reglages.moment, 'jour'); assert.equal(i.resolutions.length, 0);
});

test('quatre forces manuelles restent stables pendant la course et mouillent progressivement la chaussée', () => {
  const f = fixture(), eaux = [];
  for (const [forcePluie, valeur, nom] of [['fine', .2, 'fine'], ['moderee', .45, 'modérée'], ['forte', .75, 'forte'], ['tres_forte', 1, 'très forte']]) {
    const k = { saison: 'ete', moment: 'jour', meteo: 'pluie', forcePluie, mReelle: null, i: 0 };
    const S = { meteo: f.meteoPourConditions(k, 0, 10) };
    assert.equal(S.meteo.pluie, valeur); assert.equal(S.meteo.pluieFixe, valeur);
    assert.equal(f.nomMeteoCourse(k), 'pluie ' + nom);
    for (let n = 0; n < 200; n++) production.meteo.avancer(S, .1);
    assert.equal(S.meteo.pluie, valeur, forcePluie + ' ne revient pas vers 0,75');
    eaux.push(S.meteo.mouille);
    const neige = { meteo: f.meteoPourConditions({ ...k, saison: 'hiver' }, 0, 10) };
    for (let n = 0; n < 200; n++) production.meteo.avancer(neige, .1);
    assert.equal(neige.meteo.pluie, valeur); assert.equal(neige.meteo.mouille, 0);
  }
  assert(eaux[0] > 0 && eaux.every((v, i) => !i || v > eaux[i - 1]), 'plus de pluie apporte plus d’eau');
  assert.equal(f.meteoPourConditions({ saison: 'ete', meteo: 'pluie' }, 0, 1).pluie, .75, 'ancien réglage compatible');
  for (const forcePluie of ['fine', 'tres_forte']) {
    const S = { meteo: f.meteoPourConditions(snapshot({ saison: 'ete', forcePluie, mReelle: { reel: true, pluie: .4, neige: false } }), 0, 1) };
    for (let n = 0; n < 100; n++) production.meteo.avancer(S, .1);
    assert.equal(S.meteo.pluie, .4, 'la météo réelle conserve son observation');
    assert.equal(S.meteo.pluieFixe, undefined);
  }
});

test('changer de force renouvelle la préparation ; commande visible seulement pour les précipitations manuelles', async () => {
  const f = fixture(); Object.assign(f.reglages, { meteo: 'pluie', forcePluie: 'fine' });
  const premier = f.actualiserConditions();
  f.resolutions[0].resolve(snapshot({ saison: 'ete', forcePluie: 'fine', mReelle: null })); await premier;
  assert.equal(f.$('p-force-pluie').hidden, false); assert.equal(f.$('p-force-pluie-titre').textContent, 'Intensité de la pluie');
  f.reglages.forcePluie = 'tres_forte';
  const second = f.actualiserConditions(); assert.equal(f.resolutions.length, 2);
  f.resolutions[1].resolve(snapshot({ saison: 'hiver', forcePluie: 'tres_forte', mReelle: null })); await second;
  assert.equal(f.conditionsDuDepart().forcePluie, 'tres_forte');
  assert.equal(f.$('p-force-pluie-titre').textContent, 'Intensité de la neige');
  for (const mode of ['reel', 'aleatoire']) {
    f.reglages.meteoMode = mode; const pending = f.actualiserConditions();
    f.resolutions.at(-1).resolve(snapshot()); await pending;
    assert.equal(f.$('p-force-pluie').hidden, true, mode);
  }
});

test('départ réseau conserve chaque force de pluie chez hôte et invité sans modifier les préférences invité', () => {
  for (const [forcePluie, valeur] of [['fine', .2], ['moderee', .45], ['forte', .75], ['tres_forte', 1]]) {
    const h = fixture(), i = fixture(); h.connecter('hote'); i.connecter('invite');
    i.reglages.forcePluie = 'moderee';
    h.EL.course = { ...snapshot({ saison: 'ete', mReelle: null, horlogeReelle: null, forcePluie }), i: 0, tours: 3, difficulte: 1 };
    h.departEnLigne(); const packet = h.messages.find(x => x.m.t === 'depart').m;
    i.surMessageEnLigne(packet, 0); h.avancer(30); i.avancer(30);
    const host = h.departs.find(d => d.cfg?.role === 'hote').cfg, invite = i.departs.find(d => d.cfg?.role === 'invite').cfg;
    assert.equal(host.forcePluie, forcePluie); assert.equal(invite.forcePluie, forcePluie);
    assert.equal(h.meteoPourConditions(host, 0, host.graine).pluie, valeur);
    assert.equal(i.meteoPourConditions(invite, 0, invite.graine).pluie, valeur);
    assert.equal(i.reglages.forcePluie, 'moderee'); assert.equal(i.resolutions.length, 0);
  }
});

test('neige observée est libellée neige hors côte, pluie à Port-Sable, indépendamment de la saison manuelle', () => {
  const f = fixture(), k = snapshot({ saison: 'ete' });
  assert.match(f.nomMeteoCourse({ ...k, i: 0 }), /neige/); assert.match(f.nomMeteoCourse({ ...k, i: 2 }), /neige/);
  assert.match(f.nomMeteoCourse({ ...k, i: 1 }), /pluie/); assert.doesNotMatch(f.nomMeteoCourse({ ...k, i: 1 }), /neige/);
});

const renduConditions = extrait('    if (S.nature) {', '    if (B.meteo) B.meteo.actuel', source.indexOf('    const meteo = majMeteo(S, dtImage)'));
const appliquer = new Function('B', 'S', 'rendu', 'reglages', 'Date', 'const co = S.course;\n' + renduConditions);
test('lumière réseau suit dateDepart + horloge de simulation de l’hôte, avec rafraîchissement borné', () => {
  const times = [], environments = [], B = { ...production, conditionsCourse: { ...production.conditionsCourse,
    nuitReelle(ms, clock) { times.push(ms); return production.conditionsCourse.nuitReelle(ms, clock); } } };
  const base = { skyTop: [.2,.3,.5], skyBottom: [.7,.8,.8], fog: [.5,.6,.6], sunColor: [1,1,1], ambient: [.3,.3,.3] };
  const S = { course: { horloge: 2 }, nature: { ambiance: B.ambiance.creer(base, false), horlogeReelle: snapshot().horlogeReelle, dateDepart: NOW + 4000, revisionRendu: -1 } };
  const renderer = { setEnvironment(e) { environments.push(e); } }, wrongClock = { now: () => NOW + 8 * 3600000 };
  appliquer(B, S, renderer, {}, wrongClock); assert.deepEqual(times, [NOW + 6000]);
  S.course.horloge = 2.5; appliquer(B, S, renderer, {}, wrongClock); assert.equal(times.length, 1);
  S.course.horloge = 3; appliquer(B, S, renderer, {}, wrongClock); assert.equal(times.at(-1), NOW + 7000);
  S.course.horloge = 0; appliquer(B, S, renderer, {}, wrongClock); assert.equal(times.at(-1), NOW + 4000);
  assert(environments.length > 0);
  S.nature.dateDepart = null; appliquer(B, S, renderer, {}, wrongClock); assert.equal(times.at(-1), wrongClock.now(), 'en solo, vraie horloge locale UTC');
});
