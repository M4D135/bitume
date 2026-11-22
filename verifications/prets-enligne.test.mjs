// Fonctions réseau réelles de jeu.js ; seuls le transport, le DOM et l'horloge sont simulés.
// Argument facultatif : un ancien jeu.js, pour reproduire les régressions avant correction.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/circuit.js');
require('../src/conduite.js'); require('../src/meteo.js');
require('../src/ambiance.js');
require('../src/saisons.js');
require('../src/conditions-course.js');
require('../src/graphismes.js');
require('../src/pneus-reseau.js');
const B = globalThis.BITUME;
const source = readFileSync(process.argv[2] || new URL('../src/jeu.js', import.meta.url), 'utf8');
const debut = source.indexOf('  const EL = '), fin = source.indexOf('  function envoyerEtats(', debut);
assert.ok(debut >= 0 && fin > debut);
function fonction(nom) {
  const a = source.indexOf('  function ' + nom + '('), ligne = source.indexOf('\n', a);
  assert.ok(a >= 0, nom + ' présente dans jeu.js');
  if (source.slice(a, ligne).trimEnd().endsWith('}')) return source.slice(a, ligne);
  const z = source.indexOf('\n  }', a);
  assert.ok(z > a, nom + ' complète dans jeu.js');
  return source.slice(a, z + 4);
}
const changementDebut = source.indexOf("  document.addEventListener('change', e => {");
const changementFin = source.indexOf('\n  });', changementDebut) + 6;
assert.ok(changementDebut >= 0 && changementFin > changementDebut);
const catalogueDeclaration = source.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0];
const creer = new Function('B', `
  ${source.match(/  const PHYSIQUE = .*?;/)[0]}
  let session = null, ecran = 'enligne', modePrepa = 'course', retourReglages = 'titre', graineCourse = 100, maintenant = 0, numero = 0;
  let conditionsPreparation = null, conditionsPreparationCle = '';
  const temps = new Map(), messages = [], departs = [], elements = new Map(), sauvegardes = [], ecouteurs = new Map();
  const sauverReglages = () => sauvegardes.push(structuredClone(reglages));
  const setTimeout = (f, d) => { const id = ++numero; temps.set(id, { f, t: maintenant + d }); return id; };
  const clearTimeout = id => temps.delete(id);
  const $ = id => { if (!elements.has(id)) elements.set(id, { hidden: false, textContent: '', innerHTML: '', classList: { add() {}, remove() {} } }); return elements.get(id); };
  const document = { querySelector: $, querySelectorAll: () => [], addEventListener: (nom, f) => ecouteurs.set(nom, f) };
  const texte = (e, t) => { e.textContent = t; }, classe = () => {};
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  ${catalogueDeclaration}
  const NOMS_PNEUS = B.pneus.NOMS_PNEUS;
  const reglages = { circuit: 0, tours: 3, difficulte: 1, meteo: 'pluie', pneus: 'pluie', pneusPilotes: ['pluie', 'pluie'], pneusAutoPilotes: [false, false], boite: 'auto', vue: 'cockpit', joueursLocaux: 1 };
  // Comme aller() dans le jeu, revenir au salon réaffiche ses informations ; cela ne doit pas masquer un refus.
  const aller = s => { ecran = s; if (s === 'enligne') majSalon(); }, lancer = (type, i, cfg) => departs.push({ type, i, cfg });
  // préparation sous voile (jeu.js) : la séance part au bout de ses étapes (30 ms ici), si la liaison tient encore
  const preparerSeance = (type, i, enl, conditions, o = {}) => setTimeout(() => {
    if (o.verifier && !o.verifier()) return;
    lancer(type, i, enl, conditions); aller('course');
  }, 30);
  const message = () => {}, sousMessage = () => {}, finirClassement = () => {}, montrerResultats = () => {};
  ${['choixPneusLocaux', 'pneusAutomatiques', 'appliquerConseilPneus', 'choisirPneusPilote', 'majChoixPneus'].map(fonction).join('\n')}
  ${source.slice(debut, fin)}
  ${source.slice(changementDebut, changementFin)}
  return {
    EL, reglages, messages, departs, $, proposerCourse, basculerPret, diffuserPrets, quitterPrets, quitterEnLigne,
    recevoirCourse, surMessageEnLigne, surDepart, surFermeture, nouvelleLiaison, contratPiste,
    choisirPneusPilote, choixPneusLocaux, pneusAutomatiques, appliquerConseilPneus, sauvegardes,
    changer: (name, value) => ecouteurs.get('change')({ target: {name, value} }),
    screen: s => { ecran = s; }, retour: s => { retourReglages = s; },
    etat: () => ({ ecran, retourReglages }),
    retirerPret: () => typeof retirerPret === 'function' ? retirerPret() : undefined,
    avancer(d) {
      const cible = maintenant + d;
      for (;;) {
        const p = [...temps].sort((a, b) => a[1].t - b[1].t).find(x => x[1].t <= cible);
        if (!p) break;
        temps.delete(p[0]); maintenant = p[1].t; p[1].f();
      }
      maintenant = cible;
    },
    connecter(role = 'hote', joueurs = [1, 1]) {
      const callbacks = new Map(), id = role === 'hote' ? 0 : 1;
      const R = { id, etat: 'connecte', code: 'ABCD', pairs: new Map(),
        membres: joueurs.map((n, k) => ({ id: k, joueurs: n, nom: 'Pilote ' + k })),
        lies: new Set(joueurs.map((_, k) => k).filter(k => k !== id)),
        pretAvec(k) { return this.lies.has(k); }, horloge: () => maintenant,
        envoyer(m, a) { messages.push({ m: structuredClone(m), a }); },
        on(n, f) { callbacks.set(n, f); return this; }, emit(n, ...args) { callbacks.get(n)?.(...args); },
        fermer() { this.etat = 'ferme'; this.emit('ferme', 'local'); }
      };
      reglages.joueursLocaux = joueurs[id];
      EL.R = R; EL.role = role; return R;
    }
  };
`);
function hote(joueurs) { const a = creer(B); const R = a.connecter('hote', joueurs); a.proposerCourse(); return { a, R }; }
function choixMessage(a, id, pneus) {
  const nombre = a.EL.R.membres.find(m => m.id === id)?.joueurs === 2 ? 2 : 1;
  const pneusPilotes = Array.isArray(pneus) ? pneus : Array(nombre).fill(pneus);
  return { versionChoixPneus: 2, pneus: pneusPilotes[0], pneusPilotes };
}
function contrat(a, options = {}) {
  return { versionChoixPneus: 2, protocolePneus: 1, piste: a.contratPiste(options.i ?? 0), ...options };
}
function pret(a, id = 1, pneus = 'slicks') { a.surMessageEnLigne({ t: 'pret', oui: true, ...choixMessage(a, id, pneus) }, id); }
function tous(a, R) { a.basculerPret(); for (const m of R.membres) if (m.id !== R.id) pret(a, m.id); }
function compte(a) { return a.messages.filter(x => x.m.t === 'depart').length; }
function invite(joueurs = [1, 1]) {
  const a = creer(B); const R = a.connecter('invite', joueurs);
  a.surMessageEnLigne({ t: 'confirmer', course: contrat(a, { i: 1, tours: 5, difficulte: 2, meteo: 'pluie', eau: .8 }) }, 0);
  return { a, R };
}

test('le moment choisi avant départ est annoncé et transmis aux pilotes', () => {
  const a=creer(B),R=a.connecter('hote');
  a.reglages.moment='nuit';a.proposerCourse();
  assert.equal(a.EL.course.moment,'nuit');
  tous(a,R);a.avancer(700);
  assert.ok(a.$('pr-course').textContent.includes('nuit'));
  const cfg=a.messages.find(x=>x.m.t==='depart').m.cfg;
  assert.equal(cfg.moment,'nuit');
  const b=creer(B);b.connecter('invite');b.reglages.moment='jour';
  b.surMessageEnLigne({t:'depart',cfg},0);b.avancer(5000);
  assert.equal(b.departs[0].cfg.moment,'nuit');
  assert.equal(b.reglages.moment,'jour','préférence personnelle préservée après la course imposée');
  assert.equal(b.recevoirCourse(contrat(b, {i:0,tours:3,meteo:'soleil',eau:0,moment:'invalide'})),true);
  assert.equal(b.EL.course.moment,'jour','messages anciens ou invalides reprennent le jour');
});
test('saison imposée par l’hôte, sans modifier les préférences des invités ; neige absente du Sud', () => {
  const a = creer(B), R = a.connecter('hote'); a.reglages.circuit = 2; a.reglages.saison = 'hiver'; a.proposerCourse();
  assert.equal(a.EL.course.saison, 'hiver'); tous(a, R); a.avancer(700);
  assert.match(a.$('pr-course').textContent, /hiver/); assert.match(a.$('pr-course').textContent, /neige/);
  const cfg = a.messages.find(x => x.m.t === 'depart').m.cfg;
  assert.equal(cfg.saison, 'hiver');
  const b = creer(B); b.connecter('invite'); b.reglages.saison = 'printemps'; b.surMessageEnLigne({t:'depart',cfg},0); b.avancer(5000);
  assert.equal(b.departs[0].cfg.saison, 'hiver'); assert.equal(b.reglages.saison, 'printemps');
  assert.equal(b.recevoirCourse(contrat(b, { i: 0, tours: 3, meteo: 'soleil', eau: 0, saison: 'inconnue' })), true);
  assert.equal(b.EL.course.saison, 'ete');
  a.reglages.circuit = 1; a.proposerCourse(); tous(a, R);
  assert.match(a.$('pr-course').textContent, /pluie/); assert.doesNotMatch(a.$('pr-course').textContent, /neige/);
});

test('l’annonce ouvre la confirmation sans lancer la course', () => {
  const { a } = hote(); assert.equal(a.etat().ecran, 'prets'); a.avancer(1000); assert.equal(compte(a), 0);
  assert.ok(a.messages.some(x => x.m.t === 'confirmer'));
});
for (const [id, nom, index] of [['lande-noire', 'Lande-Noire', 7], ['fjord', 'Fjord-d’Argent', 4], ['brume-de-jade', 'Brume-de-Jade', 9], ['cap-sequoia', 'Cap-Séquoia', 3]]) test(nom + ' conserve le circuit et les conditions de l’hôte jusqu’au départ invité', () => {
  const catalogue = new Function(catalogueDeclaration + '; return CATALOGUE;')();
  assert.deepEqual(catalogue.slice(0, 3).map(k => k.id), ['val-brule', 'marseille', 'corail']);
  const i = catalogue.findIndex(k => k.id === id);
  assert.equal(i, index, 'identifiants et indices des circuits préservés');
  const a = creer(B), R = a.connecter('hote');
  Object.assign(a.reglages, { circuit: i, saison: 'hiver', moment: 'nuit', meteo: 'pluie' });
  a.proposerCourse(); tous(a, R); a.avancer(700);
  const cfg = a.messages.find(x => x.m.t === 'depart').m.cfg;
  assert.equal(cfg.i, i); assert.equal(cfg.saison, 'hiver'); assert.equal(cfg.moment, 'nuit');
  assert.ok(a.$('pr-course').textContent.includes(nom)); assert.match(a.$('pr-course').textContent, /neige/);
  const b = creer(B); b.connecter('invite');
  Object.assign(b.reglages, { circuit: 0, saison: 'printemps', moment: 'jour' });
  assert.equal(b.recevoirCourse({ ...cfg, eau: .8 }), true);
  b.surMessageEnLigne({ t: 'depart', cfg }, 0); b.avancer(5000);
  assert.equal(b.departs.length, 1); assert.equal(b.departs[0].i, i);
  assert.equal(b.departs[0].cfg.saison, 'hiver'); assert.equal(b.departs[0].cfg.moment, 'nuit');
  assert.equal(b.reglages.circuit, i); assert.equal(b.reglages.saison, 'printemps');
});
for (const joueurs of [[1, 1], [2, 1], [1, 2], [2, 2], [1, 1, 1, 1]]) test('départ unique avec ' + joueurs.join('+') + ' pilotes', () => {
  const { a, R } = hote(joueurs); tous(a, R); a.avancer(699); assert.equal(compte(a), 0);
  a.avancer(1); assert.equal(compte(a), 1); a.avancer(1000); assert.equal(a.departs.length, 1);
  const cfg = a.departs[0].cfg; assert.equal(cfg.humains.length, joueurs.reduce((s, n) => s + n, 0));
  assert.deepEqual(cfg.pneus, cfg.humains.map(h => h.machine === 0 ? 'pluie' : 'slicks'));
});
test('cinq pilotes ne peuvent pas confirmer le départ', () => {
  const { a, R } = hote([2, 2, 1]); tous(a, R); a.avancer(1500); assert.equal(compte(a), 0);
});
test('un pilote peut retirer son accord pendant les 700 ms', () => {
  const { a, R } = hote(); tous(a, R); a.avancer(300); a.surMessageEnLigne({ t: 'pret', oui: false }, 1);
  a.avancer(1000); assert.equal(compte(a), 0); pret(a); a.avancer(730); assert.equal(a.departs.length, 1);
});
test('retour de l’hôte au salon annule le départ différé', () => {
  const { a, R } = hote(); tous(a, R); a.quitterPrets(); a.avancer(1000);
  assert.equal(compte(a), 0); assert.equal(a.etat().ecran, 'enligne');
});
test('quitter puis rejoindre une autre partie ne lance pas l’ancienne course', () => {
  const { a, R } = hote(); tous(a, R); a.quitterEnLigne(); a.connecter(); a.avancer(1000);
  assert.equal(compte(a), 0); assert.equal(a.EL.confirmation, null);
});
test('une nouvelle proposition remplace le compte à rebours précédent', () => {
  const { a, R } = hote(); tous(a, R); a.proposerCourse(); a.avancer(1000); assert.equal(compte(a), 0);
  tous(a, R); a.avancer(730); assert.equal(a.departs.length, 1);
});
test('un membre en cours de connexion n’est pas oublié', () => {
  const { a, R } = hote([1, 1, 1]); R.lies.delete(2); a.basculerPret(); pret(a, 1); a.avancer(1000);
  assert.equal(compte(a), 0); assert.match(a.$('pr-pilotes').innerHTML, /Pilote 2/);
  R.lies.add(2); pret(a, 2); a.avancer(730); assert.equal(a.departs.length, 1);
});
test('une arrivée pendant le compte à rebours impose sa confirmation', () => {
  const { a, R } = hote(); tous(a, R); R.membres.push({ id: 2, nom: 'Nouveau', joueurs: 1 });
  a.avancer(1000); assert.equal(compte(a), 0); R.lies.add(2); pret(a, 2); a.avancer(730); assert.equal(a.departs.length, 1);
});
test('perdre une liaison pendant le compte à rebours ne lance pas une course incomplète', () => {
  const { a, R } = hote(); tous(a, R); R.lies.delete(1); a.avancer(1000); assert.equal(compte(a), 0);
});
test('départ d’un membre nettoie ses pneus et permet aux autres de continuer', () => {
  const { a, R } = hote([1, 1, 1]); a.basculerPret(); pret(a, 1); a.EL.pneusDe.set(2, ['inter']);
  R.membres = R.membres.filter(m => m.id !== 2); R.lies.delete(2); a.surDepart(2); a.avancer(730);
  assert.equal(a.departs.length, 1); assert.equal(a.EL.pneusDe.has(2), false);
});
test('les accords répétés ne programment qu’un départ', () => {
  const { a, R } = hote(); tous(a, R); for (let i = 0; i < 10; i++) pret(a); a.avancer(1000);
  assert.equal(compte(a), 1); assert.equal(a.departs.length, 1);
});
test('ouvrir les réglages retire l’accord local', () => {
  const { a, R } = hote(); tous(a, R); a.retirerPret(); a.avancer(1000); assert.equal(compte(a), 0);
});
test('un inconnu ne peut se dire prêt ni imposer des pneus', () => {
  const { a } = hote(); pret(a, 99); a.surMessageEnLigne({ t: 'pneus', pneus: 'pluie' }, 98);
  assert.equal(a.EL.confirmation.prets.has(99), false); assert.equal(a.EL.pneusDe.has(99), false); assert.equal(a.EL.pneusDe.has(98), false);
});
test('l’invité choisit ses pneus sans modifier sa boîte ni sa vue', () => {
  const { a } = invite(); a.choisirPneusPilote(0, 'inter'); a.reglages.boite = 'manuelle'; a.reglages.vue = 'poursuite'; a.basculerPret();
  assert.deepEqual(a.messages.at(-1), { m: { t: 'pret', oui: true, versionChoixPneus: 2, pneus: 'inter', pneusPilotes: ['inter'] }, a: 0 });
  assert.equal(a.reglages.boite, 'manuelle'); assert.equal(a.reglages.vue, 'poursuite');
});
test('annulation par l’hôte depuis les réglages retourne au salon', () => {
  const { a } = invite(); a.screen('reglages'); a.retour('prets'); a.surMessageEnLigne({ t: 'annuler' }, 0);
  assert.equal(a.EL.confirmation, null); assert.equal(a.etat().retourReglages, 'enligne');
});
test('fermeture du salon efface la confirmation et quitte son écran', () => {
  const { a, R } = invite(); R.etat = 'ferme'; a.surFermeture('parti');
  assert.equal(a.EL.confirmation, null); assert.equal(a.EL.course, null); assert.equal(a.etat().ecran, 'enligne');
});
test('confirmation invalide ignorée sans écran vide', () => {
  const a = creer(B); a.connecter('invite'); a.surMessageEnLigne({ t: 'confirmer', course: { i: 99 } }, 0);
  assert.ok(!a.EL.confirmation); assert.equal(a.etat().ecran, 'enligne');
});
test('messages nuls ignorés sans interrompre le jeu', () => {
  const { a } = hote(); assert.doesNotThrow(() => a.surMessageEnLigne(null, 1));
});
test('quitter pendant les 30 ms de chargement annule le lancement', () => {
  const { a, R } = hote(); tous(a, R); a.avancer(700); assert.equal(compte(a), 1);
  a.quitterEnLigne(); a.avancer(1000); assert.equal(a.departs.length, 0); assert.equal(a.etat().ecran, 'titre');
});


test('le conseil suit la chaussée pour le mode automatique, le choix manuel reste personnel', () => {
  const { a } = invite();
  const catalogue = new Function(catalogueDeclaration + 'return CATALOGUE;')();
  const i = catalogue.findIndex(c => c.theme === 'foret');
  a.reglages.pneusAutoPilotes = [true, false];
  const annonce = contrat(a, { i, tours: 3, meteo: 'soleil', eau: 0, saison: 'ete' });
  a.recevoirCourse(annonce);
  assert.equal(a.reglages.pneus, 'slicks');
  a.recevoirCourse({ ...annonce, saison: 'hiver' });
  assert.equal(a.reglages.pneus, 'neige');
  a.choisirPneusPilote(0, 'inter');
  a.recevoirCourse({ ...annonce, saison: 'hiver' });
  assert.equal(a.reglages.pneus, 'inter', 'annonce identique : choix du pilote conservé');
  const sud = catalogue.findIndex(c => c.theme === 'cote');
  a.recevoirCourse(contrat(a, { ...annonce, i: sud, piste: a.contratPiste(sud), saison: 'hiver' }));
  assert.equal(a.reglages.pneus, 'inter', 'le choix manuel résiste au changement de circuit');
  assert.equal(a.reglages.pneusPilotes[1], 'pluie', 'le choix du second pilote reste indépendant');
});

for (const joueurs of [[2, 2], [2, 1], [1, 2]]) test('12F2 : montes personnelles conservées au départ ' + joueurs.join('+'), () => {
  const { a, R } = hote(joueurs);
  a.choisirPneusPilote(0, 'slicks'); a.choisirPneusPilote(1, 'neige');
  const distant = joueurs[1] === 2 ? ['inter', 'pluie'] : ['inter'];
  a.basculerPret(); pret(a, 1, distant); a.avancer(730);
  assert.equal(a.departs.length, 1);
  const cfg = a.departs[0].cfg;
  assert.equal(cfg.versionChoixPneus, 2);
  assert.deepEqual(cfg.pneus, [...['slicks', 'neige'].slice(0, joueurs[0]), ...distant]);
  assert.deepEqual(cfg.humains.map(h => [h.machine, h.local]), joueurs.flatMap((n, m) => Array.from({length: n}, (_, k) => [m, k])));
  const b = creer(B); b.connecter('invite', joueurs);
  b.surMessageEnLigne({ t: 'depart', cfg }, 0); b.avancer(5000);
  assert.equal(b.departs.length, 1);
  assert.deepEqual(b.departs[0].cfg.pneus, cfg.pneus);
  assert.deepEqual(b.departs[0].cfg.locaux, Array.from({length: joueurs[1]}, (_, k) => joueurs[0] + k));
});

test('12F2 : l’invité transmet les deux montes, sans partager leur tableau mutable', () => {
  const { a } = invite([2, 2]);
  a.choisirPneusPilote(0, 'neige'); a.choisirPneusPilote(1, 'inter'); a.basculerPret();
  const m = a.messages.at(-1).m;
  assert.equal(m.versionChoixPneus, 2); assert.deepEqual(m.pneusPilotes, ['neige', 'inter']);
  assert.equal(m.pneus, 'neige', 'alias historique réservé au premier pilote');
  a.reglages.pneusPilotes[1] = 'pluie';
  assert.deepEqual(m.pneusPilotes, ['neige', 'inter']);
});

test('12F2 : changer la deuxième monte distante retire son accord et annule le départ différé', () => {
  const { a, R } = hote([2, 2]); a.basculerPret(); pret(a, 1, ['inter', 'pluie']);
  a.avancer(300);
  const m = { t: 'pneus', ...choixMessage(a, 1, ['inter', 'neige']) };
  a.surMessageEnLigne(m, 1); a.avancer(1000);
  assert.equal(a.EL.confirmation.prets.has(1), false); assert.equal(compte(a), 0);
  m.pneusPilotes[1] = 'slicks';
  assert.deepEqual(a.EL.pneusDe.get(1), ['inter', 'neige'], 'le message reçu ne garde pas un tableau modifiable de l’extérieur');
  pret(a, 1, ['inter', 'neige']); a.avancer(730);
  assert.equal(a.departs.length, 1); assert.deepEqual(a.departs[0].cfg.pneus.slice(2), ['inter', 'neige']);
});

test('12F2 : répétition identique des pneus ne retire pas un accord valide', () => {
  const { a } = hote([2, 2]); a.basculerPret(); pret(a, 1, ['pluie', 'neige']);
  a.surMessageEnLigne({ t: 'pneus', ...choixMessage(a, 1, ['pluie', 'neige']) }, 1);
  a.avancer(730); assert.equal(a.departs.length, 1);
});

for (const mauvais of [
  { pneusPilotes: ['slicks'] }, { pneusPilotes: ['slicks', 'inter', 'pluie'] },
  { pneusPilotes: ['slicks', '__proto__'] }, { pneusPilotes: ['constructor', 'pluie'] },
  { pneusPilotes: ['slicks', null] }, { pneusPilotes: 'pluie' },
  { versionChoixPneus: 0 }, { versionChoixPneus: 1 }, { versionChoixPneus: '2' },
  { versionChoixPneus: undefined, pneusPilotes: undefined }
]) test('12F2 : accord pneus invalide refusé ' + JSON.stringify(mauvais), () => {
  const { a } = hote([2, 2]); a.basculerPret(); pret(a, 1, ['inter', 'pluie']);
  a.avancer(300);
  a.surMessageEnLigne({ t: 'pret', oui: true, ...choixMessage(a, 1, ['inter', 'pluie']), ...mauvais }, 1);
  a.avancer(1000);
  assert.equal(compte(a), 0, 'un ancien accord ne peut autoriser ce choix incompatible');
  assert.equal(a.EL.confirmation.prets.has(1), false);
});

test('12F2 : un message pneus ancien ou malformé retire aussi un accord devenu douteux', () => {
  for (const m of [{ t: 'pneus', pneus: 'neige' }, { t: 'pneus', versionChoixPneus: 2, pneusPilotes: ['pluie'] }]) {
    const { a } = hote([2, 2]); a.basculerPret(); pret(a, 1, ['inter', 'pluie']);
    a.surMessageEnLigne(m, 1); a.avancer(1000);
    assert.equal(compte(a), 0); assert.equal(a.EL.confirmation.prets.has(1), false);
  }
});

test('12F2 : un inconnu et un pair non lié ne modifient ni les choix ni les accords', () => {
  const { a, R } = hote([2, 2]);
  a.surMessageEnLigne({ t: 'pret', oui: true, versionChoixPneus: 2, pneusPilotes: ['neige', 'pluie'] }, 77);
  R.lies.delete(1);
  a.surMessageEnLigne({ t: 'pneus', ...choixMessage(a, 1, ['inter', 'neige']) }, 1);
  assert.equal(a.EL.pneusDe.size, 0); assert.equal(a.EL.confirmation.prets.size, 0);
});

test('12F2 : une annonce sans contrat reconnu ne prépare pas un invité', () => {
  for (const versionChoixPneus of [undefined, 0, 1, '2']) {
    const a = creer(B); a.connecter('invite');
    a.surMessageEnLigne({ t: 'confirmer', course: contrat(a, { versionChoixPneus, i: 0, tours: 3, meteo: 'soleil', eau: 0 }) }, 0);
    assert.ok(!a.EL.confirmation); assert.equal(a.departs.length, 0);
    assert.match(a.$('l-etat').textContent, /version/i, 'le refus est lisible dans le salon');
  }
});

test('12F2 : un départ incompatible ou incomplet est refusé avant tout chargement', () => {
  const { a, R } = hote([2, 2]); tous(a, R); a.avancer(730);
  const cfg = a.departs[0].cfg;
  for (const patch of [{ versionChoixPneus: undefined }, { versionChoixPneus: 8 }, { pneus: ['slicks'] }, { pneus: ['slicks', 'inter', 'pluie', 'constructor'] }]) {
    const b = creer(B); b.connecter('invite', [2, 2]);
    b.surMessageEnLigne({ t: 'depart', cfg: { ...cfg, ...patch } }, 0); b.avancer(5000);
    assert.equal(b.departs.length, 0);
    assert.match(b.$('l-etat').textContent, /version|pneus/i);
  }
});


test('12F2 : le vrai contrôle du second pilote retire l’accord local avant de mémoriser son choix', () => {
  const { a, R } = hote([2, 2]); tous(a, R); a.avancer(300);
  a.changer('pneusPret2', 'neige'); a.avancer(1000);
  assert.equal(compte(a), 0); assert.equal(a.EL.pretIci, false);
  assert.equal(a.EL.confirmation.prets.has(0), false);
  assert.deepEqual(a.reglages.pneusPilotes, ['pluie', 'neige']);
  assert.deepEqual(a.sauvegardes.at(-1).pneusPilotes, ['pluie', 'neige']);
});

test('12F2 : le vrai contrôle invité déconfirme avant d’envoyer les deux montes', () => {
  const { a } = invite([2, 2]); a.basculerPret();
  a.changer('pneusPret2', 'neige');
  assert.equal(a.EL.pretIci, false);
  const derniers = a.messages.slice(-2).map(x => x.m);
  assert.deepEqual(derniers.map(m => [m.t, m.oui]), [['pret', false], ['pneus', undefined]]);
  assert.deepEqual(derniers[1].pneusPilotes, ['pluie', 'neige']);
});

test('12F2 : un faux choix UI ne modifie ni l’accord ni les préférences', () => {
  const { a, R } = hote([2, 2]); tous(a, R);
  const avant = structuredClone(a.reglages);
  a.changer('pneusPret2', 'constructor');
  assert.deepEqual(a.reglages, avant); assert.equal(a.EL.pretIci, true);
  a.avancer(730); assert.equal(a.departs.length, 1);
});

test('12F2 : le refus de version reste visible après le retour réel au salon depuis la confirmation', () => {
  const { a } = invite(); assert.equal(a.etat().ecran, 'prets');
  a.surMessageEnLigne({ t: 'confirmer', course: contrat(a, { versionChoixPneus: 0, i: 0, tours: 3, meteo: 'soleil', eau: 0 }) }, 0);
  assert.equal(a.etat().ecran, 'enligne'); assert.equal(a.EL.confirmation, null);
  assert.match(a.$('l-etat').textContent, /versions? incompatibles/i);
  assert.match(a.$('l-etat').textContent, /rechargez/i);
});

test('12F2 : humains invalides ou hors capacité refusés sans exception avant chargement', () => {
  const { a, R } = hote([2, 2]); tous(a, R); a.avancer(730);
  const cfg = a.departs[0].cfg, h = cfg.humains;
  const cas = [
    ['élément nul', [null, ...h.slice(1)]],
    ['tableau clairsemé', Array(4)],
    ['quatre pilotes sur la même machine', h.map(x => ({...x, machine: 1}))],
    ['trois pilotes sur une machine', [h[0], h[2], h[3], {...h[3], local: 2}]],
    ['machine inconnue', [h[0], h[1], h[2], {...h[3], machine: 99}]],
    ['identifiant de machine converti implicitement', [h[0], h[1], h[2], {...h[3], machine: '1'}]]
  ];
  for (const [nom, humains] of cas) {
    const b = creer(B); b.connecter('invite', [2, 2]);
    assert.doesNotThrow(() => b.surMessageEnLigne({ t: 'depart', cfg: {...cfg, humains} }, 0), nom);
    b.avancer(5000); assert.equal(b.departs.length, 0, nom);
    assert.match(b.$('l-etat').textContent, /versions? incompatibles/i, nom);
  }
  const seul = creer(B); seul.connecter('invite', [2, 1]);
  assert.doesNotThrow(() => seul.surMessageEnLigne({t: 'depart', cfg}, 0));
  seul.avancer(5000); assert.equal(seul.departs.length, 0, 'deux pilotes ne sont pas acceptés sur une machine déclarée à un seul');
});

test('12F2 : arrivée tardive valide, cette machine attend la suivante sans invalider la course annoncée', () => {
  const { a, R } = hote([1, 1]); tous(a, R); a.avancer(730);
  const cfg = a.departs[0].cfg;
  const b = creer(B), RB = b.connecter('invite', [1, 1, 1]);
  RB.id = 2; RB.lies = new Set([0, 1]);
  b.surMessageEnLigne({t: 'depart', cfg}, 0); b.avancer(5000);
  assert.equal(b.departs.length, 0);
  assert.match(b.$('l-etat').textContent, /attendez la suivante/i);
  assert.doesNotMatch(b.$('l-etat').textContent, /incompatible/i);
});

test('12F3 : annonce et départ portent le protocole de pneus et l’identité exacte du circuit', () => {
  const { a, R } = hote([2, 2]); tous(a, R); a.avancer(730);
  const annonce = a.messages.find(x => x.m.t === 'course').m, cfg = a.departs[0].cfg;
  for (const m of [annonce, cfg]) {
    assert.equal(m.versionChoixPneus, 2); assert.equal(m.protocolePneus, 1);
    assert.deepEqual(m.piste, a.contratPiste(m.i));
    assert.equal(m.piste.physique, 'p16'); assert.equal(typeof m.piste.id, 'string'); assert.equal(typeof m.piste.revision, 'string');
    assert.ok(m.piste.revision.length > 0);
  }
  assert.equal(typeof cfg.seance, 'string'); assert.ok(cfg.seance.length > 0);
});

test('12F3 : mauvaise révision de piste, circuit déplacé et ancien protocole refusés avant préparation', () => {
  const { a, R } = hote(); tous(a, R); a.avancer(730); const cfg = a.departs[0].cfg;
  for (const patch of [
    {protocolePneus: undefined}, {protocolePneus: 0}, {protocolePneus: 2},
    {piste: undefined}, {piste: null}, {piste: {...cfg.piste, id: 'circuit-absent'}},
    {piste: {...cfg.piste, physique: 'p15'}}, {piste: {...cfg.piste, physique: undefined}}, {piste: {...cfg.piste, revision: 'ancienne-revision'}}, {i: cfg.i + 1},
    {seance: undefined}, {seance: ''}
  ]) {
    const b = creer(B); b.connecter('invite');
    assert.doesNotThrow(() => b.surMessageEnLigne({t: 'depart', cfg: {...cfg, ...patch}}, 0));
    b.avancer(5000); assert.equal(b.departs.length, 0, JSON.stringify(patch));
    assert.match(b.$('l-etat').textContent, /version|pneu|circuit|séance|seance|incompatib/i);
  }
  for (const patch of [{protocolePneus: 0}, {piste: {...cfg.piste, physique: 'p15'}}, {piste: {...cfg.piste, physique: undefined}}, {piste: {...cfg.piste, revision: 'ancienne-revision'}}]) {
    const b = creer(B); b.connecter('invite');
    b.surMessageEnLigne({t: 'confirmer', course: {...cfg, ...patch}}, 0);
    assert.equal(b.EL.confirmation, null); assert.equal(b.departs.length, 0);
  }
});

test('12F3 : départ répété avant et après le chargement ne recrée pas la séance, ancien départ refusé après la suivante', () => {
  const { a, R } = hote(); tous(a, R); a.avancer(730); const premier = a.departs[0].cfg;
  a.proposerCourse(); tous(a, R); a.avancer(730); const second = a.departs[1].cfg;
  assert.notEqual(second.seance, premier.seance, 'chaque course dispose d’une identité propre');
  const b = creer(B); b.connecter('invite');
  b.surMessageEnLigne({t: 'depart', cfg: premier}, 0);
  b.surMessageEnLigne({t: 'depart', cfg: premier}, 0); b.avancer(40);
  assert.equal(b.departs.length, 1);
  b.surMessageEnLigne({t: 'depart', cfg: premier}, 0); b.avancer(40);
  assert.equal(b.departs.length, 1);
  b.surMessageEnLigne({t: 'depart', cfg: second}, 0); b.avancer(40);
  b.surMessageEnLigne({t: 'depart', cfg: premier}, 0); b.avancer(40);
  assert.equal(b.departs.length, 2); assert.equal(b.departs[1].cfg.seance, second.seance);
});

test('12F3 : une nouvelle séance reçue pendant le chargement invalide le départ précédent', () => {
  const { a, R } = hote(); tous(a, R); a.avancer(730); const premier = a.departs[0].cfg;
  a.proposerCourse(); tous(a, R); a.avancer(730); const second = a.departs[1].cfg;
  const b = creer(B); b.connecter('invite');
  b.surMessageEnLigne({t: 'depart', cfg: premier}, 0); b.avancer(10);
  b.surMessageEnLigne({t: 'depart', cfg: second}, 0); b.avancer(50);
  assert.equal(b.departs.length, 1); assert.equal(b.departs[0].cfg.seance, second.seance);
});

test('12F3 : annulation de l’hôte pendant les 30 ms de chargement empêche le départ accepté', () => {
  const { a, R } = hote(); tous(a, R); a.avancer(730); const cfg = a.departs[0].cfg;
  const { a: b } = invite();
  b.surMessageEnLigne({t: 'depart', cfg}, 0); b.avancer(10);
  assert.equal(b.EL.seanceAcceptee, cfg.seance); assert.equal(b.departs.length, 0);
  b.surMessageEnLigne({t: 'annuler'}, 0); b.avancer(1000);
  assert.equal(b.departs.length, 0); assert.equal(b.EL.seanceAcceptee, null);
  assert.equal(b.etat().ecran, 'enligne'); assert.match(b.$('l-etat').textContent, /annulé/i);
});

test('12F3 : refus de version pendant les 30 ms de chargement invalide aussi le départ accepté', () => {
  const { a, R } = hote(); tous(a, R); a.avancer(730); const cfg = a.departs[0].cfg;
  const { a: b } = invite();
  b.surMessageEnLigne({t: 'depart', cfg}, 0); b.avancer(10);
  assert.equal(b.EL.seanceAcceptee, cfg.seance); assert.equal(b.departs.length, 0);
  b.surMessageEnLigne({t: 'confirmer', course: {...cfg, versionChoixPneus: 1}}, 0); b.avancer(1000);
  assert.equal(b.departs.length, 0); assert.equal(b.EL.seanceAcceptee, null);
  assert.equal(b.etat().ecran, 'enligne'); assert.match(b.$('l-etat').textContent, /versions? incompatibles/i);
});
