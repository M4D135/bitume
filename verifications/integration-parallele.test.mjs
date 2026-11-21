// Intégration 00 : vérifie les sources actuellement assemblées, sans réappliquer un patch historique.
// Transport, DOM et horloge sont simulés ; les fonctions testées viennent du vrai jeu.js et des modules livrés.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = b => createHash('sha256').update(b).digest('hex');
const partageAvant = sha(readFileSync(path.join(racine, 'src/jeu.js')));
const source = readFileSync(path.join(racine, 'src/jeu.js'), 'utf8');
execFileSync(process.execPath, ['--check', path.join(racine, 'src/jeu.js')]);
const extraire = nom => {
  const debut = source.indexOf('  function ' + nom + '('); assert(debut >= 0, 'fonction proposée : ' + nom);
  const fin = source.indexOf('\n  }', debut); assert(fin > debut, 'fin de fonction : ' + nom);
  return source.slice(debut, fin + 4);
};
const creerExpression = source.match(/^\s+expressions: (.+),$/m)?.[1]; assert(creerExpression);
const allocationEvenement = source.match(/^\s+trollEvenement: (\{.+\}),$/m)?.[1]; assert(allocationEvenement);
const allocationAudio = source.match(/^\s+trollAudio: (\{.+\}),$/m)?.[1]; assert(allocationAudio);
const initLocaux = source.match(/    S\.locaux = [^\n]+\n    if \(joue && S\.expressions\) configurerTrollLocaux\(S\);/)?.[0]; assert(initLocaux);
const debutImage = source.indexOf('  function rendreImage(S, alpha, dtImage)');
const finDebutImage = source.indexOf('    if (B.sillage)', debutImage); assert(finDebutImage > debutImage);
const imageProposee = source.slice(debutImage, finDebutImage) + '\n  }';
const copie = v => JSON.parse(JSON.stringify(v));

function banc(type = 'duo', locaux = [3, 7], nombre = 8) {
  const contexte = vm.createContext({ console });
  Object.defineProperty(contexte, 'AudioContext', { get() { throw new Error('Le raccord crée un contexte audio'); } });
  Object.defineProperty(contexte, 'webkitAudioContext', { get() { throw new Error('Le raccord crée un contexte audio'); } });
  for (const nom of ['expressions-pilote.js', 'son.js'])
    vm.runInContext(readFileSync(path.join(racine, 'src', nom), 'utf8'), contexte, { filename: nom });
  vm.runInContext('var B = BITUME; var reglages = {}; var ecran = "course"; var son = null;', contexte);
  vm.runInContext(extraire('configurerTrollLocaux') + '\n' + extraire('consommerTroll') + '\n' + imageProposee, contexte);
  const X = contexte.BITUME.expressionsPilote, appels = [], ordre = [], buffers = [];
  const sortieSon = { evenement(nom, audio) { ordre.push('son'); appels.push({ nom, ...copie(audio) }); buffers.push(audio); return true; } };
  contexte.son = sortieSon; contexte.ecran = type === 'demo' ? 'demo' : 'course';
  const voitures = Array.from({ length: nombre }, (_, id) => ({ id, progression: 100 + id * 40,
    joueur: locaux.includes(id), humain: locaux.includes(id), fini: false, abandon: false, tPassage: -100,
    etat: { v: 30, rapport: 3, repositionnements: 0 } }));
  const co = { voitures, joueur: voitures[locaux[0]], phase: 'course', termine: false, horloge: 0 };
  const poses = voitures.map(v => ({ x: v.progression, y: 0, z: 0, cap: 0 }));
  contexte.course = co; contexte.graineCourse = 19; contexte.joue = ['course', 'chrono', 'duo'].includes(type);
  const S = { type, course: co, expressions: vm.runInContext(creerExpression, contexte), locaux: [...locaux], suivie: locaux[0],
    trollEvenement: vm.runInContext('(' + allocationEvenement + ')', contexte), trollAudio: vm.runInContext('(' + allocationAudio + ')', contexte),
    prec: poses, cour: poses };
  contexte.S = S; contexte.DT = 1 / 120; contexte.appliquerCarte = () => {};
  contexte.tampons = { poses: poses.map(p => ({ ...p })) };
  contexte.melange = (a, b, alpha, sortie) => Object.assign(sortie, b);
  contexte.creationTardive = () => { throw new Error('Allocation tardive dans le début d’image testé'); };
  const actualiser = X.actualiser, consommer = contexte.consommerTroll;
  X.actualiser = (...args) => { ordre.push('actualiser'); return actualiser(...args); };
  contexte.consommerTroll = (...args) => { ordre.push('consommer'); return consommer(...args); };
  const image = t => { co.horloge = t; contexte.rendreImage(S, 1, 1 / 60); };
  const demander = id => { X.demander(S.expressions, id, true); X.demander(S.expressions, id, false); };
  const configurer = choix => { contexte.reglages.trollPilotes = choix; vm.runInContext(initLocaux, contexte); };
  return { contexte, X, S, co, poses, appels, ordre, buffers, sortieSon, image, demander, configurer };
}

test('assemblage réel : un raccord unique avant J2/J1 et instruments communs', () => {
  assert.equal((source.match(/consommerTroll\(S, poses\);/g) || []).length, 1);
  const actualiser = source.indexOf('B.expressionsPilote.actualiser(', debutImage);
  const consommation = source.indexOf('consommerTroll(S, poses);', debutImage);
  const j2 = source.indexOf('rendreVue(S.vueJ2', debutImage);
  assert(actualiser < consommation && consommation < j2);
  assert(!extraire('provoquer').includes('son'));
  // Le cadrage réel et le champ sont couverts par cockpit-visibilite.test.mjs et
  // options-image.test.mjs ; le raccord Troll n'impose pas une inclinaison historique.
  assert(source.includes('pilote.regime = etatPilote.regime; pilote.kmh = B.conduite.kmh(etatPilote);'));
  assert.equal(sha(readFileSync(path.join(racine, 'src/jeu.js'))), partageAvant);
});

test('création : IA activée seulement pour les séances jouées ; sorties préallouées', () => {
  for (const type of ['course', 'chrono', 'duo', 'demo', 'vitrine']) {
    const b = banc(type);
    assert.equal(b.S.expressions.ia, ['course', 'chrono', 'duo'].includes(type));
    assert.deepEqual(Object.keys(b.S.trollEvenement), ['sequence', 'pilote', 'geste', 'klaxon', 'instant', 'cote']);
    assert.deepEqual(Object.keys(b.S.trollAudio), ['klaxon', 'gain', 'pan']);
  }
});

test('les choix J1/J2 sont copiés aux vrais ID locaux, puis prennent le helper 03 quand disponible', () => {
  const b = banc(), choix = Object.freeze([Object.freeze({ geste: 'salut', klaxon: 'ancien' }), Object.freeze({ geste: 'poing', klaxon: 'mariage' })]);
  b.configurer(choix); assert.deepEqual(Array.from(b.S.locaux), [3, 7]);
  assert.equal(b.S.expressions.pilotes[3].choixGeste, b.X.GESTES.indexOf('salut'));
  assert.equal(b.S.expressions.pilotes[7].choixKlaxon, b.X.KLAXONS.indexOf('mariage'));
  assert.equal(b.S.expressions.pilotes[0].choixGeste, -1, 'aucun choix humain copié au rival ID 0');
  let lectures = 0;
  b.contexte.choixTrollLocaux = () => { lectures++; return [{ geste: 'poing', klaxon: 'classique' }, { geste: 'salut', klaxon: 'ancien' }]; };
  b.configurer(choix); assert.equal(lectures, 1);
  assert.equal(b.S.expressions.pilotes[3].choixGeste, b.X.GESTES.indexOf('poing'));
  assert.equal(b.S.expressions.pilotes[7].choixKlaxon, b.X.KLAXONS.indexOf('ancien'));
  delete b.contexte.choixTrollLocaux; b.configurer([{ geste: '__proto__', klaxon: 42 }, null]);
  for (const id of [3, 7]) { assert.equal(b.S.expressions.pilotes[id].choixGeste, 0); assert.equal(b.S.expressions.pilotes[id].choixKlaxon, 0); }
});

test('le vrai début de rendreImage appelle actualiser/consommer une fois et ne sonne pas sur demander/lire', () => {
  const b = banc(); b.configurer([{ geste: 'salut', klaxon: 'ancien' }, { geste: 'poing', klaxon: 'mariage' }]);
  b.image(0); b.ordre.length = 0; b.demander(3); b.demander(7);
  b.X.lire(b.S.expressions, 7); b.X.lire(b.S.expressions, 3); assert.equal(b.appels.length, 0);
  b.contexte.consommerTroll(b.S, b.poses); assert.equal(b.appels.length, 0, 'demande sans démarrage : aucun son');
  b.ordre.length = 0; b.image(.1);
  assert.deepEqual(b.ordre, ['actualiser', 'consommer', 'son', 'son']);
  assert.deepEqual(b.appels.map(a => [a.nom, a.klaxon]), [['troll', 'ancien'], ['troll', 'mariage']]);
  assert(b.buffers.every(p => p === b.S.trollAudio), 'un seul buffer audio réutilisé');
  const evenement = b.S.trollEvenement;
  b.X.lire(b.S.expressions, 7); b.X.lire(b.S.expressions, 3); b.image(.1); b.image(.12);
  assert.equal(b.appels.length, 2, 'ni relecture J2/J1 ni nouvel affichage ne rejoue le son');
  assert.equal(b.S.trollEvenement, evenement);
});

test('une demande différée par la boîte reste silencieuse jusqu’au départ effectif', () => {
  const b = banc('course', [3]); b.configurer([{ geste: 'poing', klaxon: 'mariage' }]); b.image(0);
  b.co.voitures[3].etat.rapport = 4; b.co.voitures[3].tPassage = .1; b.demander(3); b.image(.1);
  assert.equal(b.appels.length, 0); assert.equal(b.X.lire(b.S.expressions, 3).geste, null);
  b.image(.3); assert.equal(b.appels.length, 0); b.image(.5);
  assert.equal(b.appels.length, 1); assert.equal(b.appels[0].klaxon, 'mariage');
  assert.equal(b.S.trollEvenement.instant, b.S.expressions.pilotes[3].gesteA);
});

test('menu, pause et vitrine drainent la file sans son ni reprise tardive', () => {
  for (const [type, ecran] of [['course', 'titre'], ['duo', 'reglages'], ['course', 'pause'], ['vitrine', 'course'], ['demo', 'titre']]) {
    const b = banc(type); b.image(0); b.contexte.ecran = ecran; b.demander(3); b.image(.1);
    assert.equal(b.appels.length, 0, type + '/' + ecran);
    assert.equal(b.X.consommerEvenement(b.S.expressions, {}), false, 'file réellement vidée');
    b.contexte.ecran = type === 'demo' ? 'demo' : 'course'; b.image(.1); assert.equal(b.appels.length, 0, 'aucun rejeu au retour');
  }
});

test('audio absent, non initialisé ou muet : l’événement est consommé une seule fois', () => {
  for (const mode of ['absent', 'refuse']) {
    const b = banc(); b.image(0);
    let essais = 0; b.contexte.son = mode === 'absent' ? null : { evenement() { essais++; return false; } };
    b.demander(3); b.image(.1); assert.equal(essais, mode === 'absent' ? 0 : 1);
    assert.equal(b.X.consommerEvenement(b.S.expressions, {}), false);
    b.contexte.son = b.sortieSon; b.image(.1); b.image(.12); assert.equal(b.appels.length, 0);
  }
});

test('spatialisation : auditeur J2 le plus proche, puis sujet de démo ; gain/pan bornés', () => {
  for (const type of ['duo', 'demo']) {
    const b = banc(type); b.S.suivie = 7;
    Object.assign(b.poses[3], { x: 0, y: 0, z: 0, cap: 0 });
    Object.assign(b.poses[7], { x: 100, y: 0, z: 0, cap: 0 });
    Object.assign(b.poses[2], { x: 100, y: 0, z: 7, cap: Math.PI });
    b.image(0); b.demander(2); b.image(.1); assert.equal(b.appels.length, 1);
    assert.equal(b.appels[0].gain, b.contexte.BITUME.son.gainDistance(7));
    assert(Math.abs(b.appels[0].pan - 1) < 1e-12, 'cap de l’auditeur, non celui de l’émetteur');
    assert(b.appels[0].gain > 0 && b.appels[0].gain <= 1); assert(Math.abs(b.appels[0].pan) <= 1);
  }
  const b = banc(); b.image(0); b.demander(7); b.image(.1);
  assert.equal(b.appels[0].gain, 1); assert.equal(b.appels[0].pan, 0, 'son du pilote J2 centré sur lui');
});

test('la capacité maximale de 64 événements est drainée hors écran sans appel audio', () => {
  const b = banc('course', [3, 7], 64); b.contexte.ecran = 'titre'; b.image(0);
  for (let i = 0; i < 64; i++) b.demander(i);
  b.image(.1); assert.equal(b.S.expressions.evenementsN, 64); assert.equal(b.S.expressions.evenementsLu, 64);
  assert.equal(b.appels.length, 0); assert.equal(b.X.consommerEvenement(b.S.expressions, {}), false);
});

test('le départ en ligne fige les choix négociés aux vrais ID locaux', () => {
  const b = banc(), pilotes = Array.from({ length: 8 }, () => ({ geste: 'majeur', klaxon: 'classique' }));
  pilotes[3] = { geste: 'salut', klaxon: 'ancien' }; pilotes[7] = { geste: 'poing', klaxon: 'mariage' };
  b.S.enLigne = { troll: { schema: 1, pilotes } };
  b.configurer([{ geste: 'majeur', klaxon: 'classique' }, { geste: 'majeur', klaxon: 'classique' }]);
  pilotes[3].geste = 'majeur'; pilotes[7].klaxon = 'ancien';
  b.image(0); b.demander(3); b.demander(7); b.image(.1);
  assert.equal(b.X.lire(b.S.expressions, 3).geste, 'salut');
  assert.equal(b.X.lire(b.S.expressions, 7).geste, 'poing');
  assert.deepEqual(b.appels.map(e => e.klaxon), ['ancien', 'mariage']);
});

test('menu assemblé : persistance J1/J2, retour, démo automatique, arrêt caché et fronts manette', () => {
  const log = execFileSync(process.execPath, [path.join(racine, 'docs/reprise/PARALLELE-2026-11-20/raccordements/03-raccord.test.mjs'), racine],
    { cwd: racine, encoding: 'utf8', timeout: 30000 });
  assert.match(log, /"tests": 14/); assert.match(log, /"passes": 14/);
  const construction = readFileSync(path.join(racine, 'construire.py'), 'utf8');
  assert(construction.indexOf("'navigation-menu.js'") < construction.indexOf("'menu-arcade.js'"));
  assert(construction.indexOf("'menu-arcade.js'") < construction.indexOf("'jeu.js'"));
  assert.equal((source.match(/const menuArcade = B\.menuArcade\.installer/g) || []).length, 1);
});

// Les vrais gestionnaires de réception/départ ; seules les liaisons et le chargement sont remplacés.
const require = createRequire(import.meta.url);
for (const nom of ['circuit', 'conduite', 'meteo', 'ambiance', 'saisons', 'conditions-course', 'graphismes', 'pneus-reseau']) require('../src/' + nom + '.js');
const BN = globalThis.BITUME;
const debutReseau = source.indexOf('  const EL = '), finReseau = source.indexOf('  function envoyerEtats(', debutReseau);
const creerReseau = new Function('B', `
  let session=null,ecran='enligne',modePrepa='enligne',retourReglages='titre',graineCourse=10;
  let conditionsPreparation=null,conditionsPreparationCle='';
  const messages=[],departs=[],elements=new Map(),temporisations=new Map();let numero=0;
  const setTimeout=(f,ms)=>{const id=++numero;temporisations.set(id,{f,ms});return id;},clearTimeout=id=>temporisations.delete(id);
  const $=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',innerHTML:'',classList:{add(){},remove(){}}});return elements.get(id);};
  const document={querySelector:$,querySelectorAll:()=>[]},texte=(e,t)=>e.textContent=t,classe=()=>{};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  ${source.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0]}
  const NOMS_PNEUS=B.pneus.NOMS_PNEUS;
  const reglages={circuit:0,tours:3,difficulte:1,meteo:'soleil',saison:'ete',moment:'jour',boite:'auto',vue:'cockpit',
    joueursLocaux:1,pneusPilotes:['slicks','pluie'],trollPilotes:[{geste:'majeur',klaxon:'classique'},{geste:'majeur',klaxon:'classique'}]};
  const choixPneusLocaux=()=>reglages.pneusPilotes.slice(),appliquerConseilPneus=()=>{},majChoixPneus=()=>{};
  const aller=s=>ecran=s,preparerSeance=(type,i,cfg)=>{departs.push({type,i,cfg});ecran='course';};
  const message=()=>{},sousMessage=()=>{},finirClassement=()=>{},montrerResultats=()=>{};
  ${source.slice(debutReseau, finReseau)}
  return {EL,reglages,$,messages,departs,temporisations,proposerCourse,basculerPret,departEnLigne,surMessageEnLigne,
    messageChoixPneus,lireChoixTrollMessage,trollDepart,statutTrollEnLigne,surDepart,quitterEnLigne,
    connecter(role='hote',id=0,membres=[{id:0,joueurs:2},{id:7,joueurs:2}]) {
      const R={id,etat:'connecte',pairs:new Map(),membres:membres.map(m=>({...m,nom:'Pilote '+m.id})),
        pretAvec:autre=>membres.some(m=>m.id===autre&&autre!==id),horloge:()=>1000,
        envoyer:(m,a)=>messages.push({m:structuredClone(m),a}),fermer(){this.etat='ferme';}};
      EL.R=R;EL.role=role;reglages.joueursLocaux=membres.find(m=>m.id===id).joueurs;return R;
    }};
`);
const couple = () => {
  const h = creerReseau(BN), i = creerReseau(BN);
  h.connecter(); i.connecter('invite', 7);
  h.reglages.trollPilotes = [{ geste: 'majeur', klaxon: 'mariage' }, { geste: 'salut', klaxon: 'ancien' }];
  i.reglages.trollPilotes = [{ geste: 'poing', klaxon: 'ancien' }, { geste: 'salut', klaxon: 'mariage' }];
  h.proposerCourse(); i.surMessageEnLigne({ t: 'confirmer', course: h.EL.course }, 0);
  return { h, i };
};

test('préférences réseau : deux machines/deux pilotes, identité non contiguë, enveloppe distincte et copies', () => {
  const { h, i } = couple();
  i.basculerPret(); const annonce = i.messages.findLast(x => x.m.t === 'pret').m;
  assert.deepEqual(annonce.troll, { schema: 1, pilotes: i.reglages.trollPilotes });
  assert.deepEqual(annonce.pneusPilotes, ['slicks', 'pluie']);
  h.surMessageEnLigne(annonce, 7); h.basculerPret(); h.departEnLigne();
  const depart = h.messages.findLast(x => x.m.t === 'depart').m;
  assert.deepEqual(depart.cfg.troll.pilotes.map(p => [p.machine, p.local, p.geste, p.klaxon]),
    [[0, 0, 'majeur', 'mariage'], [0, 1, 'salut', 'ancien'], [7, 0, 'poing', 'ancien'], [7, 1, 'salut', 'mariage']]);
  i.surMessageEnLigne(depart, 0);
  assert.deepEqual(i.departs[0].cfg.locaux, [2, 3]);
  assert.deepEqual(i.departs[0].cfg.troll, depart.cfg.troll);
  depart.cfg.troll.pilotes[2].geste = 'majeur'; annonce.troll.pilotes[1].klaxon = 'classique';
  assert.equal(i.departs[0].cfg.troll.pilotes[2].geste, 'poing');
  assert.equal(h.EL.trollDe.get(7).pilotes[1].klaxon, 'mariage');
  assert.match(i.$('pr-troll-etat').textContent, /ne sont pas encore partagés en ligne/);
});

test('changement Troll après confirmation retire prêt et annule le départ sans changer les pneus', () => {
  const { h, i } = couple(); i.basculerPret(); h.surMessageEnLigne(i.messages.findLast(x => x.m.t === 'pret').m, 7); h.basculerPret();
  assert(h.EL.confirmation.prets.has(7)); assert.equal(h.temporisations.size, 1);
  i.reglages.trollPilotes[1].geste = 'poing';
  h.surMessageEnLigne({ t: 'pneus', ...i.messageChoixPneus() }, 7);
  assert(!h.EL.confirmation.prets.has(7)); assert.equal(h.temporisations.size, 0);
  assert.deepEqual(h.EL.pneusDe.get(7), ['slicks', 'pluie']);
  assert.equal(h.EL.trollDe.get(7).pilotes[1].geste, 'poing');
});

test('messages Troll invalides : défauts explicites, aucun décalage de pilote, auteur inconnu refusé', () => {
  const { h, i } = couple();
  for (const troll of [undefined, { schema: 2, pilotes: i.reglages.trollPilotes }, { schema: 1, pilotes: [i.reglages.trollPilotes[0]] },
    { schema: 1, pilotes: [i.reglages.trollPilotes[0], { geste: '__proto__', klaxon: 'ancien' }] }, { schema: 1, pilotes: new Array(2) }]) {
    h.surMessageEnLigne({ t: 'pret', oui: true, ...i.messageChoixPneus(), troll }, 7);
    const recu = h.EL.trollDe.get(7); assert.equal(recu.compatible, false);
    assert.deepEqual(recu.pilotes, [{ geste: 'majeur', klaxon: 'classique' }, { geste: 'majeur', klaxon: 'classique' }]);
    assert.match(h.$('pr-troll-etat').textContent, /valeurs par défaut/);
  }
  h.surMessageEnLigne({ t: 'pret', oui: true, ...i.messageChoixPneus() }, 99);
  assert(!h.EL.trollDe.has(99)); assert.equal(h.lireChoixTrollMessage({}, 99), null);
});

test('départ : rejet des permutations/duplications de paires machine-place, indépendance des pneus', () => {
  const { h, i } = couple();
  h.surMessageEnLigne({ t: 'pret', oui: true, ...i.messageChoixPneus() }, 7); h.departEnLigne();
  const cfg = h.departs[0].cfg;
  for (const changer of [p => [p[2], p[1], p[0], p[3]], p => [p[0], p[1], p[2], p[2]],
    p => p.map((v, n) => n === 2 ? { ...v, machine: 99 } : v)]) {
    const t = h.trollDepart(cfg.humains, { schema: 1, pilotes: changer(cfg.troll.pilotes) });
    assert.equal(t.compatible, false);
    assert.deepEqual(t.pilotes.map(p => [p.machine, p.local]), [[0, 0], [0, 1], [7, 0], [7, 1]]);
    assert(t.pilotes.every(p => p.geste === 'majeur' && p.klaxon === 'classique'));
  }
  assert.deepEqual(cfg.pneus, ['slicks', 'pluie', 'slicks', 'pluie']);
});

test('ancien hôte : message historique conservé et absence de négociation annoncée au joueur', () => {
  const { h, i } = couple();
  const ancienne = { ...h.EL.course }; delete ancienne.schemaTroll;
  i.surMessageEnLigne({ t: 'confirmer', course: ancienne }, 0);
  assert(!Object.hasOwn(i.messageChoixPneus(), 'troll'));
  assert.match(i.$('pr-troll-etat').textContent, /L’hôte ne négocie pas/);
  assert.match(i.$('pr-troll-etat').textContent, /valeurs par défaut/);
  i.surMessageEnLigne({ t: 'course', ...h.EL.course }, 0);
  assert(i.messageChoixPneus().troll); assert.equal(i.messages.findLast(x => x.m.t === 'pneus').m.troll.schema, 1);
});

test('nettoyage des préférences à la sortie : aucune machine supprimée conservée', () => {
  const { h, i } = couple(); h.surMessageEnLigne({ t: 'pneus', ...i.messageChoixPneus() }, 7);
  assert.equal(h.EL.trollDe.size, 1); h.surDepart(7); assert.equal(h.EL.trollDe.size, 0);
  h.surMessageEnLigne({ t: 'pneus', ...i.messageChoixPneus() }, 7); h.quitterEnLigne(); assert.equal(h.EL.trollDe.size, 0);
});

// Caméra de l’assemblage et sommets réels du modèle commun, sans modifier les sources.
{
const fs = { readFileSync };
// Projection de la géométrie réellement envoyée à FERRO depuis la caméra du jeu.
// Aucune correction d'échelle ou de position n'est appliquée aux pièces pour réussir le cadrage.

const contexte = vm.createContext({ console });
vm.runInContext('globalThis.window = globalThis;', contexte);
for (const f of ['moteur/renderer.js', 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'voiture.js']) {
  vm.runInContext(fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8'), contexte, { filename: f });
}
const B = contexte.BITUME, V = B.voiture;
const source = fs.readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
function extraire(nom) {
  const debut = source.indexOf(`  function ${nom}(`); assert(debut >= 0, nom);
  let fin = source.indexOf('{', debut), niveau = 1;
  for (fin++; niveau && fin < source.length; fin++) {
    if (source[fin] === '{') niveau++;
    else if (source[fin] === '}') niveau--;
  }
  assert.equal(niveau, 0); return source.slice(debut, fin);
}
const inclinaison = source.match(/^  const INCLINAISON_COCKPIT = [^\n]+;/m); assert(inclinaison);
const fabrique = new Function('B', 'canvas', 'reglages', 'estTactile', `
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), PORTEE_VUE = 6000;
  ${inclinaison[0]}
  ${extraire('champCockpit')}
  ${extraire('cameraCockpit')}
  return cameraCockpit;
`);
const mod = V.modele({ couleur: [.8, .12, .1], numero: 27 });
const ev = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, v: 0,
  pilote: { volant: 0, rapportAvant: 3, rapport: 3, passage: 1, regime: 3000, kmh: 0 } };
const et = { alat: 0, along: 0, volant: 0, v: 0, surface: 'route' };
const geometrie = contexte.FRender.shared.geometry(false);
function sommets(objet) {
  const r = geometrie.ranges[objet.shape], M = V.euler(...objet.r), uniques = new Set(), resultat = [];
  assert(r, objet.shape);
  for (let j = r.offset / 4; j < r.offset / 4 + r.count; j++) {
    const n = geometrie.indices[j]; if (uniques.has(n)) continue; uniques.add(n);
    const i = n * 6, x = geometrie.vertices[i] * objet.s[0], y = geometrie.vertices[i + 1] * objet.s[1], z = geometrie.vertices[i + 2] * objet.s[2];
    resultat.push(objet.p.map((v, k) => v + M[0][k] * x + M[1][k] * y + M[2][k] * z));
  }
  return resultat;
}
function projeter(q, cam, aspect) {
  const x = q[0] - cam.pos[0], y = q[1] - cam.pos[1], z = q[2] - cam.pos[2];
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const profondeur = x * sy * cp + y * sp - z * cy * cp;
  const droite = x * cy + z * sy, haut = -x * sy * sp + y * cp + z * cy * sp;
  const t = Math.tan(cam.fov * Math.PI / 360);
  return [(1 + droite / (profondeur * t * aspect)) / 2, (1 - haut / (profondeur * t)) / 2, profondeur];
}
const dans = p => p.every(Number.isFinite) && p[2] > .1 && p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1;

test('caméra du jeu : mêmes yeux dans le monde, indépendants du format et du champ mémorisé', () => {
  for (const [largeur, hauteur, tactile] of [[1280, 720, false], [540, 960, true], [960, 270, false], [480, 540, false]]) {
    for (const champ of [60, 80, 105]) {
      const reglages = { champ, secousses: 0 }, camera = fabrique(B, { clientWidth: largeur, clientHeight: hauteur }, reglages, tactile);
      for (const [cap, tangage, roulis] of [[0, 0, 0], [.8, .17, -.08], [-1.4, -.2, .12]]) {
        const pose = { x: 17, y: 3, z: -12, cap, tangage, roulis }, c = camera({}, pose, et, 0, 1 / 60);
        const oeil = V.mul(V.attitude(cap, tangage, roulis), V.OEIL);
        for (let k = 0; k < 3; k++) assert(Math.abs(c.pos[k] - [pose.x, pose.y, pose.z][k] - oeil[k]) < 1e-12);
        assert(c.fov >= 10 && c.fov <= 110); assert.equal(reglages.champ, champ);
      }
    }
  }
});

// Présence dans le cadre seulement. L'occultation de la chaussée et le recouvrement
// des rétros sont contrôlés sur les triangles réels dans cockpit-visibilite.test.mjs.
test('projection : horizon, mains, haut de jante et deux glaces en paysage, portrait et partage', () => {
  const sortie = [];
  V.cockpit(mod, ev, sortie, { ...ev.pilote, glaceVive: true });
  const H = mod.objetsRendu.habitacle, glaces = V.glacesCockpit(ev), pieces = H.mains.map(m => m.pieces[0]);
  const empreinte = JSON.stringify({ jante: H.jante.o, taille: H.jante.objet.s, glaces });
  let cadres = 0;
  for (const [largeur, hauteur, tactile] of [[1280, 720, false], [540, 960, true], [960, 270, false], [480, 540, false]]) {
    for (const vitesse of [0, 300 / 3.6]) {
      const camera = fabrique(B, { clientWidth: largeur, clientHeight: hauteur }, { champ: 60, secousses: 0 }, tactile);
      const cam = camera({}, { x: 0, y: 0, z: 0, cap: 0, tangage: 0, roulis: 0 }, { ...et, v: vitesse }, 0, 1 / 60);
      const projection = q => projeter(q, cam, largeur / hauteur), horizon = projection([1000, cam.pos[1], 0]);
      // Regard baissé de 10° avec les commandes abaissées : horizon à 23 % en 16:9,
      // au lieu de 42 % avec l'ancien volant qui masquait la route. Les yeux et le champ restent inchangés.
      assert(horizon[1] >= .20 && horizon[1] <= .55, `horizon projeté ${largeur}x${hauteur}: ${horizon}`);
      // 126 CK : rétroviseurs latéraux au montage réel, sans auto-élargissement du champ 60° / portrait.
      for (const g of glaces) for (const q of g.coins) {
        const p = projection(q);
        assert(p.every(Number.isFinite) && p[2] > .1, `glace devant cam.near ${largeur}x${hauteur}: ${p}`);
      }
      const jante = sommets(H.jante.objet).map(projection), haut = Math.min(...jante.map(p => p[1]));
      assert(haut > .45 && haut < .75, `haut de jante ${largeur}x${hauteur}: ${haut}`);
      for (const main of pieces) {
        const points = sommets(main.objet).map(projection), visibles = points.filter(dans).length / points.length;
        assert(visibles >= .72, `gant visible ${largeur}x${hauteur}: ${visibles}`);
      }
      assert.equal(JSON.stringify({ jante: H.jante.o, taille: H.jante.objet.s, glaces }), empreinte, 'aucune adaptation géométrique au cadrage');
      cadres++;
    }
  }
  assert.equal(cadres, 8);
});
}
