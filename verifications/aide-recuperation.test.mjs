import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const jeu = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const fonctions = ['annoncerRecuperation', 'traiter', 'suivreJoueur', 'aideRetour', 'afficherAideRetour'];
function banc(type = 'duo') {
  const pilote = id => ({ id, etat: { gaz: 0, frein: 0, psi: 0, v: 0, d: 0, rapport: 1 }, progression: 0, tours: 0 });
  const j = pilote(4), j2 = pilote(7), hist = [];
  const co = { c: { longueur: 1000, largeur: 12 }, phase: 'course', mode: 'course', joueur: j, voitures: [j, j2] };
  const S = { type, course: co, locaux: [4, 7], vueJ2: type === 'duo' ? {} : null, profil: [], bloque: 0, contresens: 0, horsPiste: 0 };
  const el = { className: 'sous-message', textContent: '', classList: { contains: cls => el.className.split(' ').includes(cls) } };
  const b = createContext({ S, j, j2, hist, el, DT: 1/120, pas: 0, ecran: 'course', son: null, H: { 'sous-message': el },
    messagesEnAttente: new Map(), mode: 'auto', pad: {}, doigt: {}, souris: {}, ACTIONS: ['gaz'], touches: [], noms: {} });
  b.toucheDe = () => b.touches; b.nomTouche = code => b.noms[code] || code; b.commande = () => b.mode;
  b.message = (texte, ton, court, qui) => hist.push({ texte, qui, pas: b.pas });
  b.replacer = () => hist.push({ texte: 'replacement', qui: j.id, pas: b.pas });
  for (const nom of fonctions) {
    const corps = jeu.match(new RegExp('^  function ' + nom + '\\([^]*?^  }$', 'm'))[0];
    runInContext(corps, b);
  }
  return b;
}

test('mêmes remises en piste à 120 Hz, invite réservée au blocage du pilote suivi', () => {
  const cas = [
    ['arrêt volontaire', {}, {}, null, ''],
    ['à l’arrêt en sens inverse', { psi: Math.PI }, {}, 361, ''],
    ['dans les stands en sens inverse', { psi: Math.PI, stands: {} }, {}, 361, ''],
    ['garé hors chaussée', { d: 12 }, {}, 265, ''],
    ['J1 bloqué, gaz maintenus', { gaz: .8, v: .2 }, {}, 361, 'Bloqué · retour automatique'],
    ['contresens seul', { psi: Math.PI, v: 8 }, {}, null, ''],
    ['J2 bloqué, J1 roule', { v: 12 }, { gaz: .8, v: .2 }, null, ''],
    ['J1 en contresens, J2 roule', { psi: Math.PI, v: 8 }, { v: 12 }, null, ''],
    ['roule aux stands en sens inverse', { psi: Math.PI, v: 8, stands: {} }, {}, null, ''],
    ['sortie au ralenti, gaz maintenus', { d: 12, gaz: .8 }, {}, 265, 'Hors piste · retour automatique']
  ];
  for (const [nom, etat, etat2, replacement, invite] of cas) {
    const b = banc(); Object.assign(b.j.etat, etat); Object.assign(b.j2.etat, etat2);
    let indication = '';
    for (b.pas = 1; b.pas <= 480; b.pas++) {
      b.suivreJoueur(b.S);
      indication ||= b.aideRetour(b.S);
      if (b.hist.some(e => e.texte === 'replacement')) break;
    }
    assert.equal(b.hist.find(e => e.texte === 'replacement')?.pas ?? null, replacement, nom);
    assert.equal(indication, invite, nom);
    if (etat.stands && etat.v === 8) assert.deepEqual(b.hist, [], nom);
    else if (etat.v === 8) assert.deepEqual(b.hist, [{ texte: 'Contresens', qui: 0, pas: 145 }], nom);
  }
});

test('la commande indiquée existe sur le périphérique qui accélère', () => {
  const b = banc('chrono'); b.S.bloque = 1; b.j.etat.gaz = 1;
  const suite = () => b.aideRetour(b.S).split(' · ')[1];
  assert.equal(suite(), 'R pour se replacer');
  b.touches = ['KeyR']; assert.equal(suite(), 'Échap → Se replacer');
  b.touches = ['KeyP']; b.noms.KeyP = 'R'; assert.equal(suite(), 'Échap → Se replacer');
  b.pad.gaz = 1;
  for (const [id, mapping, action] of [
    ['Xbox', 'standard', 'Menu'], ['Wireless Controller 054c', 'standard', 'Options'],
    ['Nintendo 057e', 'standard', '+'], ['inconnue', '', 'Bouton 10']
  ]) {
    b.pad.manette = { id, mapping, buttons: Array(10).fill({}) };
    assert.equal(suite(), action + ' → Se replacer');
  }
  b.pad.manette.buttons = []; assert.equal(suite(), 'retour automatique');
  b.pad.gaz = 0; b.souris.gaz = b.souris.active = true; assert.equal(suite(), 'retour automatique');
  b.doigt.gaz = true; assert.equal(suite(), 'Pause → Se replacer');
  b.S.type = 'duo'; assert.equal(suite(), 'retour automatique');
});

test('l’invite disparaît au premier rendu de la reprise, au frein ou sous le menu', () => {
  const b = banc(); b.S.bloque = 1; b.j.etat.gaz = .8;
  const affiche = () => { b.afficherAideRetour(b.aideRetour(b.S)); return b.el.textContent; };
  for (const [objet, cle, valeur] of [[b.j.etat,'v',1.5], [b.j.etat,'gaz',0], [b.j.etat,'frein',1],
    [b.j.etat,'rapport',-1], [b.j.etat,'stands',{}], [b.j.etat,'recuperation',{}], [b.j,'fini',true],
    [b.j,'abandon',true], [b,'ecran','pause'], [b.S.course,'phase','arrivee']]) {
    assert.match(affiche(), /Bloqué/); const avant = objet[cle]; objet[cle] = valeur;
    assert.equal(affiche(), ''); objet[cle] = avant;
  }
  assert.match(affiche(), /Bloqué/);
  b.el.className = 'sous-message visible'; b.el.textContent = 'Drapeau à damier';
  b.j.etat.v = 7; assert.equal(affiche(), 'Drapeau à damier');
  assert.match(jeu, /if \(x === HUD1\) afficherAideRetour\(aideRetour\(S\)\)/);
});

test('casse, roue, tonneau et retour affichés exclusivement sur le HUD du pilote touché', () => {
  const b = banc();
  for (const [id, qui] of [[4, 0], [7, 1], [3, null]]) {
    b.hist.length = 0;
    for (const type of ['casse', 'roue', 'tonneau', 'retour']) b.traiter(b.S,[{ type, id, repositionnement: true }]);
    assert.deepEqual(b.hist.map(e => [e.texte, e.qui]), qui === null ? [] : [
      ['Retour en piste',qui], ['Retour en piste',qui], ['Retour en piste',qui], ['Replacé',qui]]);
  }
});
