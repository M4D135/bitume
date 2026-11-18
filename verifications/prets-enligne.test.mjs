// Fonctions réseau réelles de jeu.js ; seuls le transport, le DOM et l'horloge sont simulés.
// Argument facultatif : un ancien jeu.js, pour reproduire les régressions avant correction.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/conduite.js'); require('../src/meteo.js');
require('../src/ambiance.js');
require('../src/saisons.js');
const B = globalThis.BITUME;
const source = readFileSync(process.argv[2] || new URL('../src/jeu.js', import.meta.url), 'utf8');
const debut = source.indexOf('  const EL = '), fin = source.indexOf('  function envoyerEtats(', debut);
assert.ok(debut >= 0 && fin > debut);
const catalogueDeclaration = source.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0];
const creer = new Function('B', `
  let session = null, ecran = 'enligne', retourReglages = 'titre', graineCourse = 100, maintenant = 0, numero = 0;
  let conditionsPreparation = null, conditionsPreparationCle = '';
  const temps = new Map(), messages = [], departs = [], elements = new Map();
  const setTimeout = (f, d) => { const id = ++numero; temps.set(id, { f, t: maintenant + d }); return id; };
  const clearTimeout = id => temps.delete(id);
  const $ = id => { if (!elements.has(id)) elements.set(id, { hidden: false, textContent: '', innerHTML: '', classList: { add() {}, remove() {} } }); return elements.get(id); };
  const document = { querySelector: $, querySelectorAll: () => [] };
  const texte = (e, t) => { e.textContent = t; }, classe = () => {};
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  ${catalogueDeclaration}
  const NOMS_PNEUS = { slicks: 'Slicks', inter: 'Intermédiaires', pluie: 'Pluie' };
  const reglages = { circuit: 0, tours: 3, difficulte: 1, meteo: 'pluie', pneus: 'pluie', boite: 'auto', vue: 'cockpit', joueursLocaux: 1 };
  const aller = s => { ecran = s; }, lancer = (type, i, cfg) => departs.push({ type, i, cfg });
  const message = () => {}, sousMessage = () => {}, finirClassement = () => {}, montrerResultats = () => {};
  ${source.slice(debut, fin)}
  return {
    EL, reglages, messages, departs, $, proposerCourse, basculerPret, diffuserPrets, quitterPrets, quitterEnLigne,
    recevoirCourse, surMessageEnLigne, surDepart, surFermeture, nouvelleLiaison,
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
        on(n, f) { callbacks.set(n, f); return this; }, emit(n, m) { callbacks.get(n)?.(m); },
        fermer() { this.etat = 'ferme'; this.emit('ferme', 'local'); }
      };
      EL.R = R; EL.role = role; return R;
    }
  };
`);
function hote(joueurs) { const a = creer(B); const R = a.connecter('hote', joueurs); a.proposerCourse(); return { a, R }; }
function pret(a, id = 1, pneus = 'slicks') { a.surMessageEnLigne({ t: 'pret', oui: true, pneus }, id); }
function tous(a, R) { a.basculerPret(); for (const m of R.membres) if (m.id !== R.id) pret(a, m.id); }
function compte(a) { return a.messages.filter(x => x.m.t === 'depart').length; }
function invite() {
  const a = creer(B); const R = a.connecter('invite');
  a.surMessageEnLigne({ t: 'confirmer', course: { i: 1, tours: 5, difficulte: 2, meteo: 'pluie', eau: .8 } }, 0);
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
  assert.equal(b.recevoirCourse({i:0,tours:3,meteo:'soleil',eau:0,moment:'invalide'}),true);
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
  assert.equal(b.recevoirCourse({ i: 0, tours: 3, meteo: 'soleil', eau: 0, saison: 'inconnue' }), true);
  assert.equal(b.EL.course.saison, 'ete');
  a.reglages.circuit = 1; a.proposerCourse(); tous(a, R);
  assert.match(a.$('pr-course').textContent, /pluie/); assert.doesNotMatch(a.$('pr-course').textContent, /neige/);
});

test('l’annonce ouvre la confirmation sans lancer la course', () => {
  const { a } = hote(); assert.equal(a.etat().ecran, 'prets'); a.avancer(1000); assert.equal(compte(a), 0);
  assert.ok(a.messages.some(x => x.m.t === 'confirmer'));
});
for (const [id, nom, index] of [['lande-noire', 'Lande-Noire', 3], ['roche-fauve', 'Roche-Fauve', 4], ['brume-de-jade', 'Brume-de-Jade', 5], ['cap-sequoia', 'Cap-Séquoia', 6]]) test(nom + ' conserve le circuit et les conditions de l’hôte jusqu’au départ invité', () => {
  const catalogue = new Function(catalogueDeclaration + '; return CATALOGUE;')();
  assert.deepEqual(catalogue.slice(0, 3).map(k => k.id), ['val-brule', 'port-sable', 'haut-col']);
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
for (const joueurs of [[1, 1], [2, 1], [2, 2], [1, 1, 1, 1]]) test('départ unique avec ' + joueurs.join('+') + ' pilotes', () => {
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
  const { a, R } = hote([1, 1, 1]); a.basculerPret(); pret(a, 1); a.EL.pneusDe.set(2, 'inter');
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
  const { a } = invite(); a.reglages.pneus = 'inter'; a.reglages.boite = 'manuelle'; a.reglages.vue = 'poursuite'; a.basculerPret();
  assert.deepEqual(a.messages.at(-1), { m: { t: 'pret', oui: true, pneus: 'inter' }, a: 0 });
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
