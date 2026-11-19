// Résultats observables de la vitre : surfaces réunies, traces, fonte, dégagement et limites de rendu.
// Le Canvas de frontière journalise les vraies commandes ; aucune formule de déplacement n'est recopiée.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/vitre.js');
const V = globalThis.BITUME.vitre, PAS = 1 / V.FREQUENCE;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
function toile(w = 1000, h = 600) {
  const image = []; let chemin = [];
  const ctx = { globalAlpha: 1, setTransform() {}, clearRect() { image.length = 0; }, beginPath() { chemin = []; },
    moveTo(...p) { chemin.push(['M', ...p]); }, lineTo(...p) { chemin.push(['L', ...p]); },
    quadraticCurveTo(...p) { chemin.push(['Q', ...p]); }, ellipse(...p) { chemin.push(['E', ...p]); },
    fill() { image.push({ alpha: this.globalAlpha, style: this.fillStyle, chemin: chemin.slice() }); },
    stroke() { image.push({ alpha: this.globalAlpha, style: this.strokeStyle, largeur: this.lineWidth, chemin: chemin.slice() }); } };
  return { width: w, height: h, clientWidth: w, clientHeight: h, style: {}, image, ctx, getContext: () => ctx };
}
const contexte = (extra = {}) => ({ qualite: 'ultra', actif: true, pluie: 0, neige: 0, vitesse: 0, intensite: 1, ...extra });
const avancer = (e, c, s, hz = 60) => { for (let i = 0; i < Math.round(s * hz); i++) V.mettreAJour(e, 1 / hz, c); };
const vivants = e => [...e.gouttes, ...e.neige].filter(p => p.vivant);
const surface = e => vivants(e).reduce((s, p) => s + p.taille ** 2, 0);
const etat = e => JSON.stringify([e.gouttes, e.neige, e.temps, e.sequence, e.creditEau, e.creditNeige]);
function depot(e, neige, index, x, y, r, extra = {}) {
  const p = (neige ? e.neige : e.gouttes)[index];
  Object.assign(p, { vivant: true, x, y, px: x, py: y, taille: r, pr: r, age: 1, pa: 1, duree: 30,
    vitesse: 0, glisse: .04, poids: 1, pp: 1, phase: 0, frequence: .5, cos: 1, sin: 0, fondu: false, fonte: 0, traceAge: 0 }, extra);
  p.traceX.fill(x); p.traceY.fill(y); e.stats[neige ? 'neige' : 'gouttes']++; return p;
}

verifier('deux perles de rayons 3 et 4 donnent une seule lentille de rayon 5, sans perdre de surface', () => {
  const e = V.creer(toile()); depot(e, false, 0, .4, .4, 3); depot(e, false, 1, .402, .4, 4);
  V.mettreAJour(e, PAS, contexte());
  assert.equal(e.stats.gouttes, 1); assert.equal(e.stats.fusionsEau, 1);
  const p = e.gouttes.find(p => p.vivant); assert.equal(p.taille, 5);
  assert(Math.abs(p.x - .40128) < 1e-12, 'centre de surface des deux impacts');
  assert.equal(surface(e), 25); assert.equal(e.stats.eauEvacuee, 0);
});
verifier('fusion bornée : le surplus quitte le dépôt, eau et neige ne forment pas une tache géante', () => {
  for (const neige of [false, true]) {
    const e = V.creer(toile()), r = neige ? 18 : 10, maximum = neige ? 19 : 12;
    depot(e, neige, 0, .5, .5, r); depot(e, neige, 1, .5, .5, r);
    V.mettreAJour(e, PAS, contexte());
    assert.equal(vivants(e).length, 1); assert.equal(vivants(e)[0].taille, maximum);
    assert.equal(surface(e) + e.stats.eauEvacuee, r * r * 2);
  }
});
verifier('une coulure rapide ramasse une perle traversée entre deux positions du pas', () => {
  const e = V.creer(toile());
  depot(e, false, 0, .5, .3, 3, { vitesse: 200, glisse: 1 });
  depot(e, false, 1, .5, .34, 4);
  V.mettreAJour(e, PAS, contexte({ vitesse: 120 }));
  assert.equal(e.stats.gouttes, 1); assert.equal(e.stats.fusionsEau, 1); assert.equal(surface(e), 25);
});
verifier('les coulures suivent leur trajet courbe et leurs bords encadrent une lentille translucide', () => {
  const t = toile(), e = V.creer(t);
  depot(e, false, 0, .4, .4, 5, { vitesse: 2, glisse: 1 });
  avancer(e, contexte({ vitesse: 40, ventX: 25 }), 1);
  const traces = t.image.filter(x => x.chemin.some(p => p[0] === 'Q'));
  assert.equal(traces.length, 2, 'bord clair et film sombre');
  for (const trace of traces) {
    const debut = trace.chemin[0], fin = trace.chemin.at(-1);
    assert(fin[1] > debut[1] && fin[2] > debut[2], 'trajet réel incliné par le vent');
    assert(trace.chemin.filter(p => p[0] === 'Q').length >= 3);
  }
  assert.equal(t.image.flatMap(x => x.chemin).filter(p => p[0] === 'E').length, 4);
  assert(t.image.every(x => x.alpha > 0 && x.alpha <= 1 && /rgba\(/.test(x.style)));
});
verifier('la neige perd progressivement son cœur blanc et laisse de l’eau sur une empreinte humide', () => {
  const t = toile(), e = V.creer(t), p = depot(e, true, 0, .5, .4, 10, { age: .15, pa: .15, duree: 5 });
  const c = contexte(); avancer(e, c, .4);
  const blanc = () => t.image.find(x => x.style === 'rgba(239,247,251,0.72)');
  const jeune = blanc(), rayonJeune = jeune.chemin[0][3];
  avancer(e, c, 1.8);
  const humide = blanc(); assert(humide && humide.alpha < jeune.alpha * .65);
  assert(humide.chemin[0][3] < rayonJeune * .7);
  assert(p.fondu && e.stats.fonte >= 1 && e.stats.gouttes > 0);
  assert(t.image.some(x => x.style === 'rgba(71,103,117,0.14)'), 'empreinte translucide conservée');
  avancer(e, c, 1); assert.equal(e.stats.fonte, 2, 'deux écoulements de fonte');
  avancer(e, c, 30); assert.equal(vivants(e).length, 0); assert(e.propre);
});
verifier('des amas se rejoignent sans redevenir secs', () => {
  const e = V.creer(toile());
  depot(e, true, 0, .5, .4, 6, { fonte: 1, fondu: true, age: 15 });
  depot(e, true, 1, .508, .4, 8, { fonte: 1, fondu: true, age: 15 });
  V.mettreAJour(e, PAS, contexte());
  const p = e.neige.find(p => p.vivant);
  assert.equal(e.stats.neige, 1); assert.equal(e.stats.fusionsNeige, 1); assert.equal(p.taille, 10);
  assert(p.fondu && p.age / p.duree >= .5);
});
verifier('la vitesse dégage pluie et neige existantes, sans commande d’essuyage', () => {
  for (const neige of [false, true]) {
    const lent = V.creer(toile()), rapide = V.creer(toile());
    for (const e of [lent, rapide]) for (let i = 0; i < 10; i++) depot(e, neige, i, .1 + i * .085, .2 + (i % 3) * .2, 5, { duree: 18, glisse: 1 });
    avancer(lent, contexte({ abri: true }), 4); avancer(rapide, contexte({ abri: true, vitesse: 120 }), 4);
    assert(vivants(rapide).length < vivants(lent).length / 2);
    assert(rapide.stats.expulses > 0);
  }
});
verifier('intensité : faible, normale, forte ; zéro efface même sans nouveau pas', () => {
  const mesures = [];
  for (const intensite of [.3, 1, 2]) {
    const e = V.creer(toile()); avancer(e, contexte({ pluie: 1, vitesse: 35, intensite }), 3);
    mesures.push(e.stats.gouttes);
  }
  assert(mesures[0] < mesures[1] && mesures[1] < mesures[2], mesures.join('/'));
  const e = V.creer(toile()); avancer(e, contexte({ neige: 1 }), 4);
  V.mettreAJour(e, 0, contexte({ intensite: 0, pause: true }));
  assert(e.propre && e.masquee && !vivants(e).length);
  assert.equal(V.prechauffer(e, { intensite: 0 }), false);
});
verifier('sous une averse continue, la vitesse réduit aussi la quantité qui reste collée', () => {
  for (const meteo of [{ pluie: 1 }, { neige: 1 }]) {
    const lent = V.creer(toile(640,360)), rapide = V.creer(toile(640,360));
    avancer(lent, contexte({ ...meteo, vitesse: 10, intensite: 2 }), 16);
    avancer(rapide, contexte({ ...meteo, vitesse: 85, intensite: 2 }), 16);
    assert(vivants(rapide).length < vivants(lent).length * .8);
  }
});
verifier('les caméras extérieures atténuent les dépôts et leur opacité ; les rétros restent propres', () => {
  const a = V.creer(toile()), b = V.creer(toile());
  avancer(a, contexte({ pluie: 1, vitesse: 35 }), 4);
  avancer(b, contexte({ pluie: 1, vitesse: 35, cockpit: false }), 4);
  assert(b.stats.gouttes < a.stats.gouttes * .65); assert(b.opacite < a.opacite * .6);
  V.mettreAJour(a, 0, contexte({ retro: true })); assert.equal(vivants(a).length, 0); assert(a.masquee);
});
verifier('pause : aucune avance, aucun pixel redessiné, aucun rattrapage à la reprise', () => {
  const e = V.creer(toile()), c = contexte({ pluie: 1, vitesse: 40 }); avancer(e, c, 4);
  const avant = etat(e), stats = { ...e.stats }, accumulateur = e.accumulateur;
  avancer(e, { ...c, pause: true }, 10, 144);
  assert.equal(etat(e), avant); assert.deepEqual(e.stats, stats); assert.equal(e.accumulateur, accumulateur);
  V.mettreAJour(e, PAS, c); assert.equal(e.stats.etapes, stats.etapes + 1);
});
verifier('J1/J2 : graines distinctes, distribution non copiée, mais résultat reproductible', () => {
  const a = V.creer(toile()), b = V.creer(toile(), { graine: 2 }), copie = V.creer(toile(), { graine: 2 });
  const c = contexte({ pluie: 1, vitesse: 40 });
  for (const e of [a, b, copie]) avancer(e, c, 8);
  assert.notEqual(etat(a), etat(b)); assert.equal(etat(b), etat(copie));
  const avant = etat(a); avancer(b, c, 2); assert.equal(etat(a), avant);
});
verifier('fusions, fonte et trajets restent identiques à 30, 60, 120 et 144 Hz', () => {
  let reference;
  for (const hz of [30, 60, 120, 144]) {
    const e = V.creer(toile(480, 320), { graine: 2 });
    avancer(e, contexte({ pluie: 1, intensite: 2, vitesse: 40 }), 8, hz);
    avancer(e, contexte({ neige: 1, intensite: 2, vitesse: 20 }), 16, hz);
    assert(e.stats.fusionsEau > 0 && e.stats.fusionsNeige > 0 && e.stats.fonte > 0);
    const resultat = [etat(e), e.stats.fusionsEau, e.stats.fusionsNeige, e.stats.fonte];
    if (reference) assert.deepEqual(resultat, reference); else reference = resultat;
  }
});
verifier('surface, dépôts, interactions et commandes de dessin ont des plafonds fixes', () => {
  const t = toile(320, 180), e = V.creer(t), c = contexte({ neige: 1, pluie: 1, intensite: 2, dpr: 8 });
  const identites = [...e.gouttes, ...e.neige].map(p => [p, p.traceX, p.traceY]);
  for (let i = 0; i < 1800; i++) {
    V.mettreAJour(e, PAS, c);
    assert(e.stats.gouttes <= 112 && e.stats.neige <= 36 && e.stats.paires <= 6846);
    assert(e.stats.pixels <= V.MAX_PIXELS);
    assert(t.image.flatMap(x => x.chemin).filter(p => p[0] === 'E').length <= 700);
    assert(t.image.every(x => x.alpha >= 0 && x.alpha <= 1 && x.chemin.every(p => p.slice(1).every(Number.isFinite))));
  }
  [...e.gouttes, ...e.neige].forEach((p, i) => assert(p === identites[i][0] && p.traceX === identites[i][1] && p.traceY === identites[i][2]));
});
verifier('contextes anciens, incomplets ou invalides restent utilisables', () => {
  for (const intensite of [undefined, null, NaN, 'invalide']) {
    const e = V.creer(toile()); avancer(e, contexte({ pluie: 1, intensite }), 2); assert(e.stats.gouttes > 0);
  }
  const e = V.creer(toile()); assert.doesNotThrow(() => V.mettreAJour(e, PAS));
  assert.equal(V.mettreAJour(V.creer(null), PAS).gouttes, 0);
});
console.log('vitre météo : ' + controles + ' contrôles passés');
