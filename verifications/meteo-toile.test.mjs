// Toile de pluie (#meteo) : au sec ni mise en page, ni effacement, ni composition ; plafond de 2 Mpx ;
// taille donnée par l'appelant ; budget par palier ; flou fidèle au temps reçu par une vue rendue à demi-cadence.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
await import(fileURLToPath(new URL('../src/meteo.js', import.meta.url)));
const M = globalThis.BITUME.meteo;
let controles = 0;
const check = (v, msg) => { assert.ok(v, msg); controles++; };

// Toile factice instrumentée : lectures de taille, effacements, transformations et traits par lot.
function surface(w = 1280, h = 720) {
  const etat = { w, h, lectures: 0, effacements: 0, transformations: 0, traits: [], lots: [] };
  const ctx = { lineWidth: 1, strokeStyle: '#000000', globalAlpha: 1, lineCap: 'butt', chemin: [],
    setTransform() { etat.transformations++; }, clearRect() { etat.effacements++; etat.traits.length = etat.lots.length = 0; },
    beginPath() { this.chemin = []; }, moveTo(x, y) { this.point = [x, y]; }, lineTo(x, y) { this.chemin.push([...this.point, x, y]); },
    stroke() { etat.lots.push({ largeur: this.lineWidth, couleur: this.strokeStyle, alpha: this.globalAlpha, bout: this.lineCap, n: this.chemin.length }); etat.traits.push(...this.chemin); } };
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx,
    get clientWidth() { etat.lectures++; return etat.w; }, get clientHeight() { etat.lectures++; return etat.h; } };
  return { canvas, ctx, etat };
}
const camera = () => ({ pos: [0, 1.2, 0], yaw: 0, pitch: -.02, roll: .01, fov: 60 });

// 1. Au sec : la toile neuve est masquée d'emblée, rien n'est lu, effacé ni transformé.
{
  const s = surface(), p = M.creerPluie(s.canvas), cam = camera();
  check(s.canvas.style.visibility === 'hidden' && p.stats.masquee, 'toile neuve masquée avant toute goutte');
  for (let i = 0; i < 300; i++) { cam.pos[2] -= .5; p.dessiner({ t: i / 60, pluie: 0 }, cam, 1 / 60, { cockpit: true, dpr: 1 }); }
  check(s.etat.lectures <= 2, 'au sec, une seule mesure de la toile en 300 images');
  check(s.etat.effacements === 0 && s.etat.transformations === 0 && s.etat.traits.length === 0, 'au sec, ni effacement ni transformation');
  // La pluie arrive : la toile réapparaît au premier trait, relit sa taille et s'efface ensuite à chaque image.
  const lectures = s.etat.lectures;
  for (let i = 0; i < 60; i++) { cam.pos[2] -= .5; p.dessiner({ t: 5 + i / 60, pluie: .8 }, cam, 1 / 60, { cockpit: true, dpr: 1 }); }
  check(s.canvas.style.visibility === '' && !p.stats.masquee && !p.stats.propre, 'toile montrée sous la pluie');
  check(s.etat.lectures === lectures + 120 && s.etat.effacements === 59, 'sans taille fournie, lecture à chaque image de pluie ; pas d’effacement de la toile déjà vide');
  check(s.etat.lots.length > 0 && s.etat.lots.length <= 3, 'au plus trois lots par image');
  check(s.etat.lots.every(l => l.couleur === 'rgb(190,210,225)' && l.bout === 'round' && l.alpha > 0 && l.alpha <= .28) && s.ctx.globalAlpha === 1,
    'couleur constante, opacité par globalAlpha, rétablie après le tracé');
  // Fin de l'averse : un seul effacement, puis plus rien.
  const effacements = s.etat.effacements;
  for (let i = 0; i < 120; i++) { cam.pos[2] -= .5; p.dessiner({ t: 7 + i / 60, pluie: 0 }, cam, 1 / 60, { cockpit: true, dpr: 1 }); }
  check(s.etat.effacements === effacements + 1 && s.etat.traits.length === 0, 'fin de pluie : un effacement unique');
  check(s.canvas.style.visibility === 'hidden' && p.stats.propre, 'fin de pluie : toile propre et masquée');
  // Un contexte réinitialisé (perte de contexte, redimensionnement) ne doit pas tracer en noir.
  s.ctx.strokeStyle = '#000000'; s.ctx.lineCap = 'butt';
  p.dessiner({ t: 9, pluie: 1 }, cam, 1 / 60, { cockpit: false, dpr: 1 });
  check(s.etat.lots.length && s.etat.lots.every(l => l.couleur === 'rgb(190,210,225)' && l.bout === 'round'), 'couleur et bouts reposés à chaque tracé');
}

// 2. Taille fournie par l'appelant : aucune lecture de mise en page, sous la pluie comme au sec.
{
  const s = surface(1000, 500), p = M.creerPluie(s.canvas), cam = camera();
  for (let i = 0; i < 400; i++) {
    cam.pos[2] -= .6;
    p.dessiner({ t: i / 60, pluie: i % 200 < 120 ? .9 : 0 }, cam, 1 / 60, { dpr: 1.25, largeur: 1000, hauteur: 500 });
  }
  check(s.etat.lectures === 0, 'taille de l’appelant : zéro lecture de clientWidth et clientHeight');
  check(s.canvas.width === 1250 && s.canvas.height === 625 && p.stats.pixels === 1250 * 625, 'définition sous le plafond inchangée');
}

// 3. Plafond de 2 Mpx : la géométrie reste en pixels CSS, seule la définition de la toile baisse.
{
  const grand = surface(2560, 1440), p = M.creerPluie(grand.canvas), cam = camera();
  p.dessiner({ t: 3, pluie: 1 }, cam, 1 / 60, { dpr: 1.5 });
  check(grand.canvas.width * grand.canvas.height <= M.MAX_PIXELS && grand.canvas.width * grand.canvas.height > .99 * M.MAX_PIXELS, '2560 × 1440 à 1,5 : toile plafonnée à 2 Mpx');
  check(Math.abs(grand.canvas.width / grand.canvas.height - 2560 / 1440) < .002, 'proportions gardées');
  const petit = surface(390, 844), q = M.creerPluie(petit.canvas);
  q.dessiner({ t: 3, pluie: 1 }, camera(), 1 / 60, { dpr: 3 });
  check(petit.canvas.width === 585 && petit.canvas.height === 1266, 'petite fenêtre : dpr borné à 1,5 comme avant');
}

// 4. Budget par palier : un palier bas garde une partie des mêmes gouttes ; sans palier, les 840.
{
  const traitsDe = palier => {
    const s = surface(), p = M.creerPluie(s.canvas), cam = camera();
    for (let i = 0; i <= 30; i++) { cam.pos[2] -= .7; p.dessiner({ t: 2 + i / 60, pluie: .9 }, cam, 1 / 60, { dpr: 1, palier }); }
    return { stats: { ...p.stats }, traits: s.etat.traits.map(t => t.join()) };
  };
  const sans = traitsDe(undefined), haut = traitsDe('high'), moyen = traitsDe('medium'), bas = traitsDe('low');
  check(sans.stats.candidats === Math.round(840 * .9) && haut.stats.candidats === sans.stats.candidats, 'sans palier ou en Fine : 840 gouttes');
  check(moyen.stats.candidats === Math.round(630 * .9) && bas.stats.candidats === Math.round(420 * .9), 'paliers Moyenne et Légère : 630 et 420 gouttes');
  const tous = new Set(haut.traits);
  check(bas.traits.length > 0 && bas.traits.length < haut.traits.length && bas.traits.every(t => tous.has(t)), 'palier bas : sous-ensemble des mêmes traits');
  check(JSON.stringify(sans.traits) === JSON.stringify(haut.traits), 'sans palier, mêmes traits qu’en Fine');
}

// 5. Vue rendue une image sur deux : avec le temps cumulé des images sautées, mêmes traits qu'à pleine cadence.
{
  const pleine = surface(), demi = surface(), fausse = surface();
  const pp = M.creerPluie(pleine.canvas), pd = M.creerPluie(demi.canvas), pf = M.creerPluie(fausse.canvas);
  const cp = camera(), cd = camera(), cf = camera();
  let egales = 0, differentes = 0;
  for (let n = 1; n <= 240; n++) {
    const t = 4 + n / 120, z = -n * 45 / 120;   // 45 m/s, 120 Hz
    cp.pos[2] = z; pp.dessiner({ t, pluie: 1 }, cp, 1 / 120, { cockpit: true, dpr: 1 });
    if (n % 2) continue;
    cd.pos[2] = z; pd.dessiner({ t, pluie: 1 }, cd, 2 / 120, { cockpit: true, dpr: 1 });
    cf.pos[2] = z; pf.dessiner({ t, pluie: 1 }, cf, 1 / 120, { cockpit: true, dpr: 1 });
    if (n < 8) continue;
    if (JSON.stringify(pleine.etat.traits) === JSON.stringify(demi.etat.traits)) egales++;
    if (JSON.stringify(pleine.etat.traits) !== JSON.stringify(fausse.etat.traits)) differentes++;
  }
  check(egales === 117, 'demi-cadence avec temps cumulé : traits identiques à la pleine cadence');
  check(differentes === 117, 'le flou suit le temps reçu : un dt d’une seule image double la vitesse apparente');
}

// 6. Préchauffage sous le voile : un trait presque transparent, composé une fois, effacé au premier appel sec.
{
  const s = surface(), p = M.creerPluie(s.canvas);
  check(p.prechauffer({ dpr: 1, largeur: 1280, hauteur: 720 }) === true, 'préchauffage accepté');
  check(s.etat.lots.length === 1 && s.etat.lots[0].alpha === 1 / 255 && s.canvas.style.visibility === '' && s.etat.lectures === 0, 'un trait à 1/255, toile montrée, sans lecture');
  p.dessiner({ t: 0, pluie: 0 }, camera(), 1 / 60, { dpr: 1, largeur: 1280, hauteur: 720 });
  check(s.etat.effacements === 1 && s.etat.traits.length === 0 && s.canvas.style.visibility === 'hidden', 'premier appel sec : effacé et masqué');
  check(M.creerPluie(null).prechauffer() === false, 'sans toile, préchauffage refusé sans erreur');
}
console.log(`toile de pluie : ${controles} contrôles passés`);
