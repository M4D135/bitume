// Lot 4 : santé de la voiture et arrêts aux stands.
// La jauge, les pénalités et la réparation se lisent dans le même état (B.degats) ; le stand est la seule voie de la
// réparation complète ; les rivaux n'y sont servis qu'après décision ; un distant ne se répare pas sur ordre d'un pair.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));
for (const f of ['circuit.js', 'conduite.js', 'degats.js', 'contacts.js', 'course.js']) charger(f);
const B = globalThis.BITUME, DG = B.degats, dt = 1 / 120;

let nbOk = 0;
function verifier(nom, f) {
  try { f(); nbOk++; console.log('ok  ' + nom); }
  catch (e) { console.error('KO  ' + nom); console.error(e); process.exit(1); }
}

const NEUTRE = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
const PLEIN = { ...NEUTRE, gaz: 1 };
const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
const S0 = c.stands;

function rouler(course, cmd, secondes) {
  const ev = [];
  for (let k = 0; k < Math.round(secondes / dt); k++) ev.push(...B.course.pas(course, cmd, dt));
  return ev;
}
function courseToutePrête(mode = 'course', o = {}) {
  const course = B.course.creer(c, { mode, graine: 42, placeJoueur: 1, ...o });
  let t = 0;
  while (t < 12 && !course.feux.vert) { B.course.pas(course, PLEIN, dt); t += dt; }
  assert.ok(course.feux.vert, 'les feux sont au vert');
  rouler(course, NEUTRE, 6);                       // la course a 6 s : un arrêt devient possible
  return course;
}
// amène la voiture du joueur dans la voie des stands, à la vitesse et à l'abscisse voulues
function placer(v, s, d, v0) {
  const e = v.etat, q = B.circuit.echantillon(c, s);
  e.s = s; e.d = d; e.v = v0; e.psi = 0; e.beta = 0; e.omega = 0; e.y = q.y;
  e.accident = null; e.recuperation = null; e.saut = null;
}
// vide les abords de la scène : sans cela, un rival arrêté là par un accident du hasard fausse le scénario
function degager(course, v) {
  for (const o of course.voitures) if (o !== v && !o.distant) {
    placer(o, v.etat.s - 700, 0, 0);
    o.etat.v = 0; o.etat.accident = null; o.etat.recuperation = null; o.etat.saut = null;
  }
}
function abimer(d, nbRoues = 2) {
  for (let k = 0; k < nbRoues; k++) d.roues[k] = true;
  for (let k = 0; k < 12; k++) DG.choc(d, 18, { cote: 1, avant: k % 2 === 0 });   // sous le seuil : pas de roue qui part d'elle-même
}

// ------------------------------------------------------------------ géométrie
verifier('la voie des stands existe, est a droite et tient dans la ligne droite', () => {
  for (const g of [11, 111, 4242, 999983]) {
    const cc = B.circuit.creer(g, { theme: 'foret', longueur: 4200 }), S = cc.stands;
    assert.ok(S, 'des stands pour la graine ' + g);
    assert.equal(S.cote, 1, 'cote droit, sous le batiment que dessine decor.js');
    assert.ok(S.debut < S.garage0 && S.garage0 < S.garage1 && S.garage1 < S.fin, 'voie puis garage puis sortie');
    assert.ok(S.debut > 0, 'la voie commence apres la ligne : la grille est derriere');
    assert.ok(S.d > 0 && S.d + S.demi <= B.circuit.bordStands(cc, (S.garage0+S.garage1)/2, 1) + .1, 'la voie reste sur la chaussee, pas derriere une glissiere');
    assert.ok(S.vitesse > 5 && S.vitesse < 20, 'vitesse de voie plausible');
    if (cc.tunnel) {
      const T = cc.tunnel;
      assert.ok(S.fin < T.debut - 40 || S.debut > T.fin + 40, 'les stands ne sont pas dans le tunnel');
    }
  }
});

// ------------------------------------------------------------------ santé
verifier('sante : neuve a 1, baisse a chaque avarie, remonte a 1 apres reparation', () => {
  const d = DG.creer();
  assert.equal(DG.sante(d), 1, 'neuve');
  const valeurs = [DG.sante(d)];
  // force sous le seuil de roue qui part (20) : seules les roues posées à la main comptent, et l'adhérence
  // comme la traînée saturent au plus bas des critères
  for (let k = 0; k < 12; k++) DG.choc(d, 18, { cote: 1, avant: k % 2 === 0 });
  valeurs.push(DG.sante(d));
  d.roues[0] = true; valeurs.push(DG.sante(d));
  d.roues[1] = true; d.roues[2] = true; valeurs.push(DG.sante(d));
  d.roues[3] = true; valeurs.push(DG.sante(d));
  d.casse = true; valeurs.push(DG.sante(d));
  for (let k = 1; k < valeurs.length; k++) assert.ok(valeurs[k] < valeurs[k - 1], 'la sante ne remonte jamais seule, etape ' + k);
  assert.ok(valeurs[valeurs.length - 1] < .05, 'au plus bas des criteres, lu ' + valeurs[valeurs.length - 1]);
  for (const x of valeurs) assert.ok(x >= 0 && x <= 1, 'entre 0 et 1');
  DG.reparer(d);
  assert.equal(DG.sante(d), 1, 'reparee = neuve');
});

verifier('la jauge vient du meme etat que les penalites, pas d un compteur d affichage', () => {
  const d = DG.creer();
  DG.choc(d, 30, { cote: 1, avant: true });
  const a = DG.sante(d);
  assert.ok(a < 1, 'un choc se voit sur la jauge');
  d.adher = 1; d.trainee = 1;                                  // memes roues, meme teinte : plus rien ne penalise
  assert.ok(DG.sante(d) > a, 'lever les penalites remonte la jauge');
  const e = DG.creer(); e.roues[3] = true;
  assert.ok(DG.sante(e) < 1, 'une roue perdue se voit sur la jauge');
  assert.ok(DG.avaries(e).some(x => x.includes('roue')), 'et se nomme');
  assert.deepEqual(DG.avaries(DG.creer()), [], 'neuve = aucune avarie nommee');
});

verifier('le service se chiffre d apres l etat constate', () => {
  const propre = DG.creer(), deuxRoues = DG.creer(), casse = DG.creer();
  deuxRoues.roues[0] = deuxRoues.roues[1] = true;
  casse.roues[0] = casse.roues[1] = casse.roues[2] = casse.roues[3] = true; casse.casse = true;
  const a = DG.chiffrerService(propre), b = DG.chiffrerService(deuxRoues), e = DG.chiffrerService(casse);
  assert.ok(a > 0 && b > a && e > b, 'plus cest abime, plus le service est long');
  assert.ok(e < 20, 'mais cela reste un arret, pas une eternite');
  assert.equal(DG.chiffrerService(null), 0, 'rien a reparer, rien a payer');
});

// ------------------------------------------------------------------ entree
verifier('entrer dans la voie a basse vitesse ouvre un arret et invalide le tour', () => {
  const course = courseToutePrête(), v = course.joueur;
  abimer(v.degats, 0);
  placer(v, S0.sBox, S0.dBox, 8); degager(course, v);
  const ev = B.course.pas(course, NEUTRE, dt);
  assert.ok(v.etat.stands && v.etat.stands.phase === 'voie', 'la voiture est dans la voie');
  assert.equal(v.tourValide, false, 'le tour courant nest pas homologue');
  assert.ok(ev.some(e => e.type === 'stand' && e.phase === 'entree'), 'levenement sort');
});

verifier('on n entre pas en frolant le bord ni au depart ; un pilote rapide entre et subit le limiteur', () => {
  const course = courseToutePrête(), v = course.joueur;
  placer(v, S0.garage0 - 20, S0.d, 40);
  B.course.pas(course, NEUTRE, dt);
  assert.equal(v.etat.stands?.phase, 'voie', 'un pilote rapide qui s engage dans la voie est retenu');
  rouler(course, NEUTRE, 5);
  assert.ok(v.etat.v <= S0.vitesse + .01, 'et subit le limiteur de la voie');
  placer(v, S0.garage0 - 20, 0, 8);
  B.course.pas(course, NEUTRE, dt);
  assert.equal(v.etat.stands, null, 'au milieu de la piste, rien ne se declenche');
  placer(v, S0.garage0 - 20, S0.d + S0.demi - .1, 8);
  B.course.pas(course, NEUTRE, dt);
  assert.equal(v.etat.stands, null, 'une roue sur le bord de la voie ne suffit pas');
  const cours2 = B.course.creer(c, { mode: 'course', graine: 42, placeJoueur: 1 });
  placer(cours2.joueur, S0.sBox, S0.dBox, 8);
  B.course.pas(cours2, NEUTRE, dt);
  assert.equal(cours2.joueur.etat.stands, null, 'a l arret du depart, rien');
});

verifier('ressortir de la voie sans s arreter annule l arret, sans rien reparer', () => {
  const course = courseToutePrête(), v = course.joueur;
  abimer(v.degats, 0);
  const avant = DG.sante(v.degats), adher = v.degats.adher, tra = v.degats.trainee;
  placer(v, S0.sBox, S0.dBox, 8); degager(course, v);
  B.course.pas(course, NEUTRE, dt);
  assert.ok(v.etat.stands, 'entree');
  v.etat.d = 0;
  const ev = rouler(course, { ...NEUTRE, gaz: .5 }, .5);
  assert.equal(v.etat.stands, null, 'l arret est annule');
  assert.ok(ev.some(e => e.type === 'stand' && e.phase === 'annule'), 'et cela se dit');
  assert.equal(DG.sante(v.degats), avant, 'rien na ete repare');
  assert.equal(v.degats.adher, adher, 'les penalites tiennent');
  assert.equal(v.degats.trainee, tra, 'la carrosserie aussi');
});

// ------------------------------------------------------------------ service
verifier('l arret au garage rend la reparation complete, a la duree chiffree', () => {
  const course = courseToutePrête(), v = course.joueur;
  abimer(v.degats, 0);                                        // des chocs, pas de roue perdue : la voiture roule
  assert.ok(v.degats.trainee > 1.05, 'la carrosserie est abimee');
  assert.ok(DG.chiffrerService(v.degats) > 2.5, 'les degats se chiffrent');
  placer(v, S0.sBox, S0.dBox, 6); degager(course, v);
  const ev = [];
  let t = 0, debutService = null, dureeAnnoncee = null, tRepare = null;
  while (t < 40 && tRepare === null) {
    ev.push(...B.course.pas(course, { ...NEUTRE, frein: 1 }, dt)); t += dt;
    if (v.etat.stands && v.etat.stands.phase === 'service' && debutService === null) debutService = t;
    for (const e of ev) if (e.type === 'stand' && e.phase === 'service' && dureeAnnoncee === null) dureeAnnoncee = e.duree;
    if (ev.some(e => e.type === 'stand' && e.phase === 'repare')) tRepare = t;
  }
  assert.ok(debutService !== null, 'le service a commence');
  assert.ok(dureeAnnoncee !== null, 'et s annonce');
  assert.ok(tRepare !== null, 'la reparation est rendue');
  assert.ok(Math.abs((tRepare - debutService) - dureeAnnoncee) < .3,
    'le service dure la duree annoncee, attendu ' + dureeAnnoncee.toFixed(2) + ', fait ' + (tRepare - debutService).toFixed(2));
  assert.equal(DG.sante(v.degats), 1, 'la voiture est neuve');
  assert.equal(v.degats.adher, 1); assert.equal(v.degats.trainee, 1);
  assert.equal(v.degats.roues.some(Boolean), false); assert.equal(v.degats.casse, false);
  assert.equal(v.etat.stands.phase, 'sortie', 'reste a repartir');
  // rester immobiliser le long du garage ne relance pas un second service : il faut d'abord sortir de la voie
  const services = ev.filter(e => e.type === 'stand' && e.phase === 'service').length;
  rouler(course, NEUTRE, 6);
  assert.equal(ev.filter(e => e.type === 'stand' && e.phase === 'service').length, services,
    'pas de second service sans etre sorti de la voie');
  assert.equal(DG.sante(v.degats), 1, 'et la voiture reste neuve');
  v.etat.d = 0; rouler(course, { ...NEUTRE, gaz: .5 }, 2);
  assert.equal(v.etat.stands, null, 'sortie');
  assert.equal(v.etat.standsSortie, false, 'la sortie est franche : un autre arrêt redevient possible');
});

verifier('rouler dans la voie ne repare rien : il faut l arret', () => {
  const course = courseToutePrête(), v = course.joueur;
  abimer(v.degats, 0);
  const avant = DG.sante(v.degats);
  placer(v, S0.garage0 - 20, S0.d, 10); degager(course, v);
  rouler(course, { ...NEUTRE, gaz: .25 }, 5);
  assert.ok(v.etat.stands, 'la voiture roule dans la voie');
  assert.notEqual(v.etat.stands.phase, 'service', 'sans arret, pas de service');
  assert.equal(DG.sante(v.degats), avant, 'les avaries sont toujours la');
});

verifier('la voie bride a la vitesse des stands', () => {
  const course = courseToutePrête(), v = course.joueur;
  placer(v, S0.garage0 - 20, S0.d, 14); degager(course, v);
  rouler(course, PLEIN, 2);
  assert.ok(v.etat.v <= S0.vitesse + .01, 'briee a ' + S0.vitesse + ' m/s, lu ' + v.etat.v.toFixed(2));
});

verifier('le replacement apres crash ne repare pas tout : les stands restent utiles', () => {
  const course = courseToutePrête(), v = course.joueur;
  abimer(v.degats, 0);
  const avant = DG.sante(v.degats);
  B.course.replacer(course, v);
  assert.ok(DG.sante(v.degats) > avant, 'le replacement rend conduisible');
  assert.ok(DG.sante(v.degats) < 1, 'mais ne remet pas neuf : la reparation complete est au garage');
});

verifier('une voiture arree au stand nest jamais tenue pour coincee', () => {
  const course = courseToutePrête();
  const ia = course.voitures.find(x => !x.humain);
  ia.etat.stands = { phase: 'service', t: 0, duree: 99, repare: false };
  ia.etat.v = 0;
  for (const o of course.voitures) if (o !== ia) placer(o, ia.etat.s - 700, 0, 0);
  const ev = rouler(course, NEUTRE, 25);
  assert.equal(ia.etat.accident, null, 'pas d accident au bout de 15 s d immobilisation');
  assert.equal(ia.etat.recuperation, null, 'pas de recuperation declenchee');
  assert.ok(!ev.some(e => e.type === 'accident' && e.id === ia.id), 'aucun evenement accident pour elle');
});

verifier('les rivaux finissent la course et ne recoivent aucun service sans decision ni immobilisation', () => {
  for (const g of [42, 7, 2024]) {
    const course = B.course.creer(c, { mode: 'course', graine: g, placeJoueur: 1, tours: 2 });
    let t = 0; const services = new Set();
    while (t < 260 && !course.termine) {
      const ev = B.course.pas(course, PLEIN, dt); t += dt;
      for (const v of course.voitures) if (!v.joueur && !v.humain && v.etat.stands)
        assert.equal(B.strategieStands.autorise(course, v), true, 'un rival dans les stands possède une décision active');
      for (const e of ev) if (e.type === 'stand' && !course.voitures[e.id].joueur) {
        if (e.phase === 'service') services.add(e.id);
        if (e.phase === 'repare') assert.ok(services.has(e.id), 'une immobilisation a précédé la réparation du rival');
        if (e.phase === 'sortie' || e.phase === 'annule') services.delete(e.id);
      }
    }
    assert.ok(course.finisseurs >= 8, 'la course finit normalement');
  }
});

verifier('un pair distant ne peut pas faire reparer sa voiture', () => {
  const course = courseToutePrête();
  const v = course.voitures[1];
  abimer(v.degats, 0);
  const avant = DG.sante(v.degats);
  placer(v, S0.sBox, S0.dBox, 0); degager(course, v);
  v.humain = true; v.distant = true;                       // etat d une voiture conduite chez un autre
  const ev = [];
  for (let k = 0; k < 60; k++) B.course.stands(course, v, dt, ev);
  assert.equal(v.etat.stands, null, 'rien ne se decrete pour une voiture distante');
  assert.equal(DG.sante(v.degats), avant, 'et ses degats ne bougent pas');
  v.distant = false;
  for (let k = 0; k < 60; k++) B.course.stands(course, v, dt, ev);
  assert.ok(v.etat.stands, 'la meme voiture, conduite ici, peut bien s arreter');
});

verifier('un arret ne donne ni tour gratuit ni meilleur temps en chrono', () => {
  const course = courseToutePrête('chrono'), v = course.joueur;
  placer(v, c.longueur - 8, 0, 30);
  rouler(course, PLEIN, 1);
  assert.ok(course.chronoParti, 'le chrono est parti');
  assert.equal(v.tourValide, true, 'le tour est homologue tant qu on ne s arrete pas');
  placer(v, S0.sBox, S0.dBox, 8);
  B.course.pas(course, NEUTRE, dt);
  assert.equal(v.tourValide, false, 'invalide des l entree au stand');
  const n = course.enreg.n;
  rouler(course, { ...NEUTRE, gaz: .2 }, 4);
  assert.equal(course.enreg.n, n, 'le fantome ne setoffe pas pendant l arret');
  placer(v, c.longueur - 8, 0, 30);
  rouler(course, PLEIN, 1);
  assert.equal(v.tours, 1, 'le tour compte pour la distance parcourue');
  assert.equal(v.meilleur, null, 'mais nest pas homologue : pas de tour gratuit');
});

verifier('deux joueurs ont chacun leur sante et leur arret', () => {
  const course = courseToutePrête('course', { humains: { noms: ['Vous', 'Invite'], duo: true } });
  const [a, b] = course.voitures.filter(v => v.humain);
  assert.equal(a, course.joueur, 'le joueur 1');
  abimer(a.degats, 0); abimer(b.degats, 0);                      // les deux sont abîmés, chacun pour soi
  placer(a, S0.sBox, S0.dBox, 4);
  placer(b, S0.debut - 60, 0, 0);
  for (const o of course.voitures) if (o !== a && o !== b) placer(o, S0.debut - 700, 0, 0);
  const santeB = DG.sante(b.degats);
  assert.ok(santeB < 1, 'le second est abîmé aussi');
  const ev = [];
  const frein = { ...NEUTRE, frein: 1 };
  for (let k = 0; k < 120 * 20; k++) ev.push(...B.course.pas(course, [frein, frein], dt));
  assert.ok(ev.some(e => e.type === 'stand' && e.id === a.id && e.phase === 'repare'), 'le premier est repare');
  assert.equal(DG.sante(a.degats), 1, 'le premier est neuf');
  assert.equal(b.etat.stands, null, 'le second ny est jamais alle');
  assert.equal(DG.sante(b.degats), santeB, 'et ses avaries restent les siennes : reparer l un ne repare pas l autre');
});

verifier('le meme arret, deux fois, donne le meme resultat', () => {
  const scenario = () => {
    const course = courseToutePrête(), v = course.joueur;
    abimer(v.degats, 0);
    placer(v, S0.sBox, S0.dBox, 5); degager(course, v);
    const ev = rouler(course, { ...NEUTRE, frein: 1 }, 12);
    return JSON.stringify(ev.filter(e => e.type === 'stand')) + '|' + DG.sante(v.degats);
  };
  assert.equal(scenario(), scenario(), 'deterministe au pas fixe');
});

verifier('une roue perdue immobilise avant d atteindre le garage : pas de service', () => {
  const course = courseToutePrête(), v = course.joueur;
  v.degats.roues[0] = true;
  placer(v, S0.sBox, S0.dBox, 6); degager(course, v);
  let reprise = false, arret = false;
  for (let k = 0; k < 120 * 2; k++) {
    B.course.pas(course, { ...NEUTRE, frein: 1 }, dt);
    if (v.etat.recuperation) reprise = true;
    if (v.etat.stands) arret = true;
  }
  assert.ok(reprise, 'la voiture est prise en charge des la premiere roue perdue');
  assert.equal(arret, false, 'et ne fait pas son arret au stand en chemin');
});

console.log('stands : ' + nbOk + ' verifications passees');
