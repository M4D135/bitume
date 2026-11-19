// Le vrai modèle procédural, les sorties envoyées au moteur et les vues successives.
// Aucun temps de simulation ne doit être avancé par ces appels de rendu.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const f of ['carene', 'humain-donnees', 'humain-corps', 'main', 'circuit', 'conduite', 'voiture']) require('../src/' + f + '.js');
const V = globalThis.BITUME.voiture;
const LIVREE = { couleur: [.86, .1, .08], seconde: [.95, .93, .88], casque: [.95, .93, .88], combinaison: [.95, .93, .88], numero: 27 };
const DETAILS = ['complet', 'moyen', 'simple'];
const VARIANTE = { complet: 0, moyen: 6, simple: 2 };
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const copie = o => ({ shape: o.shape, p: [...o.p], s: [...o.s], r: [...o.r], color: [...o.color], overlay: !!o.overlay });
const valeurs = objets => objets.map(copie);
const pose = (extra = {}) => ({ p: [12, 3, -7], cap: .41, tangage: .08, roulis: -.06, roule: 0, v: 0,
  pilote: { volant: 0, rapport: 3, rapportAvant: 2, passage: 1 }, ...extra });
const pilote = (extra = {}) => ({ volant: 0, rapport: 3, rapportAvant: 2, passage: 1, ...extra });
const mod = V.modele(LIVREE);
function dessiner(etat = pilote(), detail = 'complet', modele = mod, extra = {}) {
  const ev = pose({ pilote: etat, ...extra }), objets = [];
  V.poser(modele, ev, objets, { detail });
  const pieces = modele.objetsRendu.pilote.variantes[VARIANTE[detail]].pieces;
  const roles = Object.fromEntries(pieces.map(p => [p.role, copie(p.objet)]));
  return { ev, objets, roles, valeurs: valeurs(objets), joints: [...modele.objetsRendu.pilote.articulations],
    tete: copie(objets.find(o => o.shape === 'bitume-pilote-casque') || objets.find(o => o.shape === 'sphere' && o.s[0] === .27)) };
}
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok  ' + nom); }

verifier('les deux mains, les bras, le volant et le casque suivent le braquage', () => {
  for (const detail of DETAILS) {
    const gauche = dessiner(pilote({ volant: -.7 }), detail), droite = dessiner(pilote({ volant: .7 }), detail);
    for (const role of ['gant-0-0', 'gant-1-0', 'bras-0', 'bras-1', 'avant-bras-0', 'avant-bras-1'])
      assert(distance(gauche.roles[role].p, droite.roles[role].p) > .015, detail + ' : ' + role + ' reste figé');
    assert(distance(gauche.roles.volant.r, droite.roles.volant.r) > .3, detail + ' : volant figé');
    assert(distance(gauche.tete.r, droite.tete.r) > .15, detail + ' : tête figée');
    const neutral = dessiner(pilote(), detail);
    assert(distance(gauche.tete.p, neutral.tete.p) < .1 && distance(droite.tete.p, neutral.tete.p) < .1,
      detail + ' : casque détaché de son cou');
  }
});

verifier('le passage quitte la jante, atteint le levier et revient, sans déplacer la main gauche', () => {
  for (const detail of DETAILS) {
    const debut = dessiner(pilote({ passage: 0 }), detail), prise = dessiner(pilote({ passage: .45 }), detail);
    const fin = dessiner(pilote({ passage: 1 }), detail);
    assert(distance(debut.roles['gant-1-0'].p, prise.roles['gant-1-0'].p) > .1, detail + ' : main droite figée');
    assert.deepEqual(debut.roles['gant-0-0'], prise.roles['gant-0-0'], detail + ' : main gauche quitte le volant');
    assert.deepEqual(debut.roles['gant-1-0'], fin.roles['gant-1-0'], detail + ' : main droite ne revient pas à sa prise');
    assert(distance(debut.roles.pommeau.p, fin.roles.pommeau.p) > .02, detail + ' : le levier ne change pas de rapport');
    assert(distance(debut.tete.r, prise.tete.r) > .05, detail + ' : regard figé pendant le passage');
    assert.deepEqual(debut.tete, fin.tete, detail + ' : le casque ne revient pas au repos');
  }
});

verifier('les bras gardent leurs longueurs dans 375 poses, avec des transformations finies', () => {
  for (const detail of DETAILS) for (const volant of [-1, -.7, 0, .7, 1])
    for (const rapport of [-1, 0, 1, 3, 6]) for (const passage of [0, .2, .45, .8, 1]) {
      const dessin = dessiner(pilote({ volant, rapport, rapportAvant: rapport === 6 ? 5 : 2, passage }), detail);
      assert(dessin.objets.every(o => [...o.p, ...o.r, ...o.s].every(Number.isFinite) && o.s.every(v => v > 0)),
        `${detail}, volant=${volant}, rapport=${rapport}, passage=${passage}`);
      for (const main of [0, 1]) {
        const j = main * 9, a = dessin.joints;
        assert(Math.abs(distance(a.slice(j, j + 3), a.slice(j + 3, j + 6)) - .22) < 1e-12, 'bras étiré');
        assert(Math.abs(distance(a.slice(j + 3, j + 6), a.slice(j + 6, j + 9)) - .23) < 1e-12, 'avant-bras étiré');
      }
    }
});

verifier('les niveaux de détail gardent les mêmes poignets, coudes, bras, levier et direction du casque', () => {
  for (const volant of [-1, 0, 1]) for (const passage of [0, .45, 1]) {
    const etat = pilote({ volant, passage }), reference = dessiner(etat);
    for (const detail of ['moyen', 'simple']) {
      const dessin = dessiner(etat, detail);
      assert.deepEqual(dessin.joints, reference.joints, detail + ' : articulation changée');
      for (const role of ['gant-0-0', 'gant-1-0', 'coude-0', 'coude-1', 'bras-0', 'bras-1', 'avant-bras-0', 'avant-bras-1', 'pommeau']) {
        assert.deepEqual(dessin.roles[role].p, reference.roles[role].p, detail + ' : position ' + role);
        assert.deepEqual(dessin.roles[role].r, reference.roles[role].r, detail + ' : rotation ' + role);
      }
      assert.deepEqual(dessin.tete.r, reference.tete.r, detail + ' : direction de la tête');
    }
  }
});

verifier('un retour au cockpit puis à la vue extérieure retrouve exactement la même pose', () => {
  const etat = pilote({ volant: -.55, passage: .45 }), reference = dessiner(etat);
  const figes = reference.valeurs, sortieCockpit = [];
  V.cockpit(mod, pose(), sortieCockpit, { regime: 7000, kmh: 130, volant: .8, rapport: 6, rapportAvant: 5, passage: .8 });
  assert.deepEqual(valeurs(reference.objets), figes, 'le cockpit réécrit les objets de la vue extérieure');
  assert.deepEqual(dessiner(etat).valeurs, figes, 'pose extérieure différente après le cockpit');
  const ev = pose({ pilote: etat }), neutral = [];
  V.cockpit(mod, ev, neutral, { regime: 7000, kmh: 130, ...etat });
  assert(!neutral.some(o => /bitume-pilote-/.test(o.shape)), 'tête du pilote dessinée devant ses propres yeux');
});

verifier('les vues, rétroviseurs et autres voitures ne partagent pas les objets animés', () => {
  const etat = pilote({ volant: .3, passage: .2 }), premiere = dessiner(etat), autre = V.modele({ ...LIVREE, numero: 2 });
  dessiner(pilote({ volant: -1, passage: .7 }), 'complet', autre, { p: [500, -10, 90] });
  dessiner(pilote({ volant: -.5, passage: .5 }), 'moyen');
  V.poserRetro(mod, pose({ pilote: pilote({ volant: -.9, passage: .8 }), roulis: Math.PI }), []);
  assert.deepEqual(valeurs(premiere.objets), premiere.valeurs, 'un autre rendu a changé la première vue');
  assert.deepEqual(dessiner(etat).valeurs, premiere.valeurs, 'le retour à la pose de référence diverge');
});

verifier('le rendu lit un état gelé, sans horloge cachée ni écriture dans le modèle de simulation', () => {
  const etat = Object.freeze(pilote({ volant: .4, passage: .45 }));
  const ev = Object.freeze(pose({ p: Object.freeze([12, 3, -7]), pilote: etat })), depart = JSON.stringify(mod);
  let reference;
  for (let i = 0; i < 60; i++) {
    const objets = []; V.poser(mod, ev, objets);
    if (!i) reference = valeurs(objets); else assert.deepEqual(valeurs(objets), reference);
  }
  assert.equal(JSON.stringify(mod), depart, 'le dessin modifie la géométrie ou la livrée');
});

verifier('les objets, positions, tailles et rotations des animations sont réutilisés à chaque image', () => {
  for (const detail of DETAILS) {
    const etat = pilote(), ev = pose({ pilote: etat }), premier = [];
    V.poser(mod, ev, premier, { detail });
    const refs = premier.map(o => ({ o, p: o.p, s: o.s, r: o.r }));
    for (let i = 0; i < 120; i++) {
      etat.volant = Math.sin(i * .1); etat.passage = (i % 37) / 36; ev.p[0] += .3;
      const courant = []; V.poser(mod, ev, courant, { detail });
      assert.equal(courant.length, refs.length, detail + ' : nombre d’objets instable');
      for (let k = 0; k < refs.length; k++) {
        const a = refs[k], b = courant[k];
        assert.equal(b, a.o); assert.equal(b.p, a.p); assert.equal(b.r, a.r);
        // Les pneus peuvent sélectionner un tableau de forme déjà préchargé ; les pièces ajoutées du pilote
        // possèdent en revanche chacune une taille permanente, indépendante de celle du cockpit.
        if (mod.objetsRendu.pilote.variantes[VARIANTE[detail]].pieces.some(p => p.objet === b)) assert.equal(b.s, a.s);
      }
    }
  }
});

console.log(`${controles} contrôles pilote extérieur réussis (375 poses, trois niveaux de détail, cockpit et rétroviseurs)`);
