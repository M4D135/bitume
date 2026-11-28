// Alertes de la Route sans fin (src/alertes-route.js) : un sujet s'annonce quand il empire, une fois ; une annonce à
// la fois, la plus grave d'abord, au plus une toutes les 2,5 s ; les cinq dernières secondes bipent une par une.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const req = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
req(path.join(ROOT, 'src', 'alertes-route.js'));
const A = globalThis.BITUME.alertesRoute;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok ' + nom); };
const BON = Object.freeze({ restant: 60, distCp: 900, essence: 'ok', station: 1800, usure: .1, sante: 1, chauffe: 0, feu: 0 });
const etat = (diff = {}) => Object.assign({}, BON, diff);

verifier('tout va bien : rien à annoncer', () => {
  const m = A.creer();
  for (let t = 0; t < 30; t += .1) assert.equal(A.evaluer(m, etat(), t), null);
});

verifier('l’essence s’annonce quand elle empire, une seule fois par niveau', () => {
  const m = A.creer();
  let r = A.evaluer(m, etat({ essence: 'prochaine', station: 1430 }), 0);
  assert.equal(r.annonce.texte, 'Ravitaillez');
  assert.equal(r.annonce.sous, 'Prochaine station · 1,4 km');
  for (let t = .1; t < 10; t += .1) assert.equal(A.evaluer(m, etat({ essence: 'prochaine', station: 1430 }), t), null, 'annonce répétée');
  r = A.evaluer(m, etat({ essence: 'insuffisant', station: 2310 }), 10);
  assert.equal(r.annonce.texte, 'Réserve');
  assert.equal(r.annonce.sous, 'Station à 2,3 km · levez le pied');
  r = A.evaluer(m, etat({ essence: 'vide', station: 320 }), 13);
  assert.equal(r.annonce.texte, 'Plus d\'essence');
  assert.equal(r.annonce.sous, 'Roue libre jusqu\'à la station · 320 m');
  // le plein fait, puis une nouvelle station passée sans s'arrêter : l'annonce revient
  assert.equal(A.evaluer(m, etat(), 20), null);
  r = A.evaluer(m, etat({ essence: 'prochaine', station: 2000 }), 30);
  assert.equal(r && r.annonce.texte, 'Ravitaillez');
});

verifier('plusieurs alertes à la fois : la plus grave d’abord, puis les autres toutes les 2,5 s', () => {
  const m = A.creer();
  const e = etat({ usure: .9, sante: .5, essence: 'insuffisant' });
  const vues = [];
  for (let t = 0; t <= 8; t += .05) { const r = A.evaluer(m, e, t); if (r) vues.push([+t.toFixed(2), r.sujet, r.annonce.texte]); }
  assert.deepEqual(vues.map(v => v[1]), ['essence', 'pneus', 'sante'], JSON.stringify(vues));
  assert.ok(vues[1][0] - vues[0][0] >= A.ECART - 1e-9 && vues[2][0] - vues[1][0] >= A.ECART - 1e-9, 'annonces trop rapprochées');
  assert.equal(vues[1][2], 'Pneus à bout');
  assert.equal(vues[2][2], 'Voiture abîmée');
});

verifier('une alerte redevenue fausse avant son tour ne s’annonce pas', () => {
  const m = A.creer();
  assert.equal(A.evaluer(m, etat({ essence: 'insuffisant' }), 0).sujet, 'essence');
  assert.equal(A.evaluer(m, etat({ essence: 'insuffisant', usure: .7 }), .5), null);   // en file
  assert.equal(A.evaluer(m, etat({ essence: 'insuffisant', usure: .1 }), 1), null);   // pneus changés
  for (let t = 1; t < 8; t += .1) assert.equal(A.evaluer(m, etat({ essence: 'insuffisant', usure: .1 }), t), null);
});

verifier('le temps qui reste : 20 s, 10 s (bip), puis un bip par seconde de 5 à 1', () => {
  const m = A.creer();
  const vues = [];
  for (let restant = 25, t = 0; restant > 0; restant -= .05, t += .05) {
    const r = A.evaluer(m, etat({ restant, distCp: 400 }), t);
    if (r) vues.push([r.annonce.texte, r.bip, r.annonce.sous]);
  }
  assert.deepEqual(vues.map(v => v[0]), ['Plus que 20 s', 'Plus que 10 s', '5', '4', '3', '2', '1'], JSON.stringify(vues));
  assert.deepEqual(vues.map(v => v[1]), [false, true, true, true, true, true, true]);
  assert.ok(vues.every(v => v[2] === 'Checkpoint à 400 m'));
});

verifier('un checkpoint qui rend du temps relance le décompte suivant', () => {
  const m = A.creer();
  const compte = [];
  let t = 0;
  const rouler = (de, a) => { for (let r = de; r > a; r -= .05, t += .05) { const x = A.evaluer(m, etat({ restant: r }), t); if (x && x.sujet === 'decompte') compte.push(x.annonce.texte); } };
  rouler(5.5, 3.5);
  A.evaluer(m, etat({ restant: 38 }), t);   // checkpoint passé
  t += 3;
  rouler(5.5, .2);
  assert.deepEqual(compte, ['5', '4', '5', '4', '3', '2', '1']);
});

verifier('le décompte passe avant les autres annonces', () => {
  const m = A.creer();
  const r0 = A.evaluer(m, etat({ restant: 4.2, essence: 'vide' }), 0);
  assert.equal(r0.annonce.texte, '5');
  assert.equal(r0.bip, true);
  // l'essence attend son tour, une seconde après le bip
  assert.equal(A.evaluer(m, etat({ restant: 4.1, essence: 'vide' }), .5), null);
  const r1 = A.evaluer(m, etat({ restant: 3.5, essence: 'vide' }), 1.05);
  assert.ok(r1 && (r1.sujet === 'essence' || r1.sujet === 'decompte'), 'ni essence ni décompte : ' + JSON.stringify(r1));
});

verifier('chauffe : moteur chaud, fumée, feu', () => {
  const m = A.creer();
  const vues = [];
  for (const [t, chauffe, feu] of [[0, .65, 0], [3, .85, 0], [6, 1, .1]]) { const r = A.evaluer(m, etat({ chauffe, feu, station: 1200 }), t); vues.push(r && r.annonce.texte); }
  assert.deepEqual(vues, ['Moteur chaud', 'Le moteur fume', 'Feu moteur !']);
});

verifier('gravité pour le clignotement : ambre pour prévenir, rouge pour le danger', () => {
  const m = A.creer();
  A.evaluer(m, etat({ restant: 18, essence: 'prochaine', usure: .82, sante: .55, chauffe: .9 }), 0);
  const g = s => A.gravite(s, m.niveaux[s]);
  assert.deepEqual([g('temps'), g('essence'), g('pneus'), g('sante'), g('chauffe')], [1, 1, 2, 1, 2]);
  A.evaluer(m, etat({ restant: 8, essence: 'vide', usure: .1, sante: 1, chauffe: 0 }), 1);
  assert.deepEqual([g('temps'), g('essence'), g('pneus'), g('sante'), g('chauffe')], [2, 2, 0, 0, 0]);
});

verifier('une alerte rouge bipe, une ambre non', () => {
  const m = A.creer();
  assert.equal(A.evaluer(m, etat({ essence: 'prochaine' }), 0).bip, false);
  assert.equal(A.evaluer(m, etat({ essence: 'insuffisant' }), 3).bip, true);
});

verifier('distances lisibles', () => {
  assert.equal(A.distance(0), 'ici');
  assert.equal(A.distance(-20), 'ici');
  assert.equal(A.distance(4), '10 m');
  assert.equal(A.distance(144), '140 m');
  assert.equal(A.distance(999), '1,0 km');
  assert.equal(A.distance(1430), '1,4 km');
});

console.log(n + ' contrôles d’alertes de la route passés');
