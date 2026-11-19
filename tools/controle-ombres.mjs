#!/usr/bin/env node
// Contrôle des ombres (lot 21, étape 1, O5) : indice de scintillement sur décor immobile et journal du gouverneur Auto.
//   node tools/controle-ombres.mjs dist/bitume.html [--sortie rapport.json] [--seul arbre-fine,cockpit-droit,journal]
// Chrome sans fenêtre (tools/page-essai.mjs). Boucle du jeu menée image par image à 1/60 s, hasard réamorcé : deux
// passes d'une même scène voient les mêmes poses, seule l'image change. Après chaque image, lecture de régions de
// l'image finale ; pour chaque pixel (un sur quatre), la luminance d'une image à l'autre :
//   d1 = variation moyenne entre deux images (sur 255) ;
//   d2 = écart à la droite des deux voisines (une dérive lente s'annule, un aller-retour reste) ;
//   allers-retours = part (pour mille) des pixels qui montent puis redescendent d'au moins 4 niveaux en deux images.
// Règles (21-PHOTOREALISME.md, O5) :
//   - décor immobile (vent figé), caméra fixe, carré d'ombre et tuile qui suivent la voiture qui roule : d1 < 0,01,
//     en Fine et en Moyenne ;
//   - habitacle immobile à l'écran (caméra liée à la caisse, voiture sans pilote en ligne droite) : la tuile n'ajoute
//     ni scintillement ni dents qui rampent (écart à la même passe sans tuile sous les seuils SEUIL_COCKPIT) ; une
//     tuile de 1024² le rate sous la casquette de la planche (+0,11 en d2), celle de 512² le tient (+0,02). Avec les
//     rivaux (cockpit-droit), l'ombre du bras sur la portière est seulement relevée : les ombres des voitures qui
//     passent y tombent ; sans rivaux (cockpit-seul : rivaux à une demi-longueur du circuit), elle est contrôlée ;
//   - vue poursuite, rivaux écartés (poursuite-ombre) : l'ombre nette que la tuile donne à la voiture filmée tombe
//     dans la région mesurée ; même contrôle contre la même passe sans tuile.
// Le journal du gouverneur (BITUME.ombres.journal()) est relevé après 10 s de course en qualité Auto, cadence réelle.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const page = args[0];
if (!page || page.startsWith('--')) { console.error('usage : node tools/controle-ombres.mjs <page.html> [--sortie rapport.json] [--seul a,b]'); process.exit(2); }
const seul = opt('seul') ? new Set(opt('seul').split(',')) : null;

const SEUIL_D1 = .01;
const SEUIL_COCKPIT = { d2: .05, allersRetours: 1 };   // écart toléré avec la passe sans tuile (sur 255 ; pour mille)

// Caméra fixe à 13 m d'un feuillu de Val-Brûlé (arbre 457, à 33 m de la piste), entre la piste et l'arbre ; départ
// 45 m avant lui : la voiture passe derrière la caméra, son carré d'ombre et sa tuile avancent de 0,9 m par image.
const CAM_ARBRE = `{ const [tx, tz] = d.arbres[457]; let best = Infinity, bi = 0;
  for (let j = 0; j < c.n; j++) { const q = (c.x[j] - tx) ** 2 + (c.z[j] - tz) ** 2; if (q < best) { best = q; bi = j; } }
  J.reference(Object.assign({}, REF, { depart: bi * 2 - 45 }));
  const vx = c.x[bi] - tx, vz = c.z[bi] - tz, l = Math.hypot(vx, vz);
  const pos = [tx + vx / l * 13, d.sol(tx + vx / l * 13, tz + vz / l * 13) + 1.7, tz + vz / l * 13], cible = [tx, d.sol(tx, tz) + 2.2, tz];
  const v = viser(pos, cible, 60); J.camera = () => v; info = { arbre: [+tx.toFixed(1), +tz.toFixed(1)], distancePiste: +Math.sqrt(best).toFixed(1) }; }`;
const ARBRE = [[.2, .15, .9, .7]];
// Habitacle : caméra liée à la caisse (œil du pilote, sans tête vivante ni champ qui s'ouvre avec la vitesse, ni le
// lissage de 15 % du tangage et du roulis de la vue cockpit) : l'habitacle reste immobile à l'écran.
const CAM_CAISSE = `{ let champ = null; J.camera = (p, cam) => { const M = B.voiture.attitude(p.cap, p.tangage, p.roulis), o = B.voiture.mul(M, B.voiture.OEIL);
  if (champ === null) champ = cam.fov;
  return { pos: [p.x + o[0], p.y + o[1], p.z + o[2]], yaw: p.cap + Math.PI / 2, pitch: p.tangage, roll: -p.roulis, fov: champ, near: cam.near, far: cam.far }; }; }`;
// Val-Brûlé en 1280 × 720, ligne droite (s = 2300, cap constant sur 100 m), voiture sans pilote : volant et mains
// immobiles, soleil presque fixe par rapport à la caisse (seuls le tangage et le roulis bougent). Régions : haut de la
// planche sous la casquette et branches du volant, à l'abri des ombres du dehors (contrôlées) ; ombre du bras sur la
// portière (relevée seulement : les ombres des voitures qui passent y tombent, avec ou sans tuile).
const HABITACLE = [[.34, .665, .66, .75], [.37, .82, .60, 1], [.67, .82, .79, 1]];
// Poursuite, même ligne droite : ombre portée de la roue arrière droite et de l'aileron sur la piste, à droite de la
// voiture (pixels 736 à 806 sur 482 à 533 en 1280 × 720), hors de la carrosserie. Nette avec la tuile, floue sans.
const POURSUITE = [[.575, .67, .63, .74]];
// Paires de passes, avec et sans tuile (mêmes poses, même hasard) ; seul : rivaux écartés (voir MODELE).
const PAIRES = [
  { nom: 'cockpit-droit', vue: 'cockpit', cam: CAM_CAISSE, depart: 2300, pilote: false, regions: HABITACLE, controlees: [0, 1] },
  { nom: 'cockpit-seul', vue: 'cockpit', cam: CAM_CAISSE, depart: 2300, pilote: false, seul: true, regions: HABITACLE, controlees: [0, 1, 2] },
  { nom: 'poursuite-ombre', vue: 'poursuite', cam: '', depart: 2300, pilote: false, seul: true, regions: POURSUITE, controlees: [0] },
];

const SCENES = [
  { nom: 'arbre-fine', ref: { circuit: 0, qualite: 'high', vue: 'tele', retro: 'non' }, cam: CAM_ARBRE, regions: ARBRE, figer: true, chauffe: 30, n: 80 },
  { nom: 'arbre-moyenne', ref: { circuit: 0, qualite: 'medium', vue: 'tele', retro: 'non' }, cam: CAM_ARBRE, regions: ARBRE, figer: true, chauffe: 30, n: 80 },
  { nom: 'arbre-sans-ombres', ref: { circuit: 0, qualite: 'high', vue: 'tele', retro: 'non', ombres: 'off' }, cam: CAM_ARBRE, regions: ARBRE, figer: true, chauffe: 30, n: 80, temoin: true },
  ...PAIRES.flatMap(k => [
    { nom: k.nom, ref: { circuit: 0, qualite: 'high', vue: k.vue, retro: 'non', depart: k.depart, vitesse: 60, pilote: k.pilote }, cam: k.cam, seul: k.seul, regions: k.regions, figer: true, chauffe: 30, n: 90 },
    { nom: k.nom + '-sans-tuile', ref: { circuit: 0, qualite: 'high', vue: k.vue, retro: 'non', depart: k.depart, vitesse: 60, pilote: k.pilote }, cam: k.cam, seul: k.seul, regions: k.regions, figer: true, chauffe: 30, n: 90,
      retouche: { ombreProche: null }, temoin: true },
  ]),
];

const MODELE = `(async () => {
  const J = BITUME_JEU, B = globalThis.BITUME, R = J.rendu, gl = R.gl;
  if (window.FPhysX && FPhysX.init) { try { await FPhysX.init(); } catch (e) {} }
  const vraiRAF = window.requestAnimationFrame.bind(window), image = () => new Promise(r => vraiRAF(r));
  const file = [];
  window.requestAnimationFrame = cb => (cb.name === 'image') ? (file.push(cb), 0) : vraiRAF(cb);
  await image(); await image(); await image();
  let graine = 17017; Math.random = () => { graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0; return graine / 4294967296; };
  const REF = __REF__;
  J.reference(REF);
  const c = J.scene.c, d = J.scene.decor;
  // Rivaux écartés : posés à une demi-longueur du circuit, à l'arrêt, comme reference() pose les voitures ; aucune de
  // leurs ombres n'atteint la voiture filmée pendant la mesure.
  if (__SEUL__) for (const v of J.session.course.voitures) if (!v.joueur) {
    const et = v.etat; et.s = (et.s + c.longueur / 2) % c.longueur; et.v = 0;
    const e = B.circuit.echantillon(c, et.s); et.y = e.y - et.d * Math.sin(e.devers); et.tangage = Math.atan(e.pente || 0); et.roulis = e.devers || 0;
    v.roule = et.s; v.progression = ((et.s - (c.depart || 0)) % c.longueur + c.longueur) % c.longueur; J.session.course.sAvant[v.id] = et.s;
  }
  const viser = (pos, cible, fov) => { const dx = cible[0] - pos[0], dy = cible[1] - pos[1], dz = cible[2] - pos[2];
    return { pos, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), fov }; };
  let info = {};
  __CAM__
  for (const id of ['hud', 'h-fps', 'classement', 'zone-carte', 'message', 'sous-message', 'feux', 'jauge-derive', 'tactile', 'b-pause', 'aide-console', 'vignette']) {
    const el = document.getElementById(id); if (el) el.style.visibility = 'hidden';
  }
  const retouche = __RETOUCHE__, figer = __FIGER__, orig = R.draw; let t0 = null;
  R.draw = function (cam, sortie, fx) { if (t0 === null) t0 = fx.time; return orig.call(this, cam, sortie, Object.assign({}, fx, retouche, figer ? { time: t0 } : null)); };
  let t = 1000; const PAS = 1000 / 60;
  const pas = () => { t += PAS; for (const cb of file.splice(0)) cb(t); };
  for (let k = 0; k < __CHAUFFE__; k++) pas();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const regions = __REGIONS__.map(([x0, y0, x1, y1]) => {
    const x = Math.round(x0 * W), w = Math.round((x1 - x0) * W), h = Math.round((y1 - y0) * H), y = Math.round((1 - y1) * H);
    return { x, y, w, h, data: new Uint8Array(w * h * 4), seq: [] };
  });
  const S = J.session, s0 = S.course.joueur.etat.s;
  for (let k = 0; k < __N__; k++) {
    pas();
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    for (const g of regions) {
      gl.readPixels(g.x, g.y, g.w, g.h, gl.RGBA, gl.UNSIGNED_BYTE, g.data);
      const L = new Float32Array(Math.ceil(g.w / 2) * Math.ceil(g.h / 2));
      let j = 0;
      for (let yy = 0; yy < g.h; yy += 2) for (let xx = 0; xx < g.w; xx += 2) { const i = (yy * g.w + xx) * 4; L[j++] = .2126 * g.data[i] + .7152 * g.data[i + 1] + .0722 * g.data[i + 2]; }
      g.seq.push(L);
    }
  }
  R.draw = orig;
  const res = regions.map(g => {
    let d1 = 0, d2 = 0, n1 = 0, n2 = 0, flips = 0, moy = 0;
    const P = g.seq[0].length;
    for (let u = 1; u < g.seq.length; u++) for (let p = 0; p < P; p++) { d1 += Math.abs(g.seq[u][p] - g.seq[u - 1][p]); n1++; }
    for (let u = 1; u < g.seq.length - 1; u++) for (let p = 0; p < P; p++) {
      const a = g.seq[u - 1][p], b = g.seq[u][p], e = g.seq[u + 1][p];
      d2 += Math.abs(b - (a + e) / 2); n2++;
      const x = b - a, y = e - b; if (x * y < 0 && Math.min(Math.abs(x), Math.abs(y)) >= 4) flips++;
    }
    for (const L of g.seq) for (let p = 0; p < P; p++) moy += L[p];
    const serie = [];
    for (let u = 1; u < g.seq.length; u++) { let e = 0; for (let p = 0; p < P; p++) e += Math.abs(g.seq[u][p] - g.seq[u - 1][p]); serie.push(+(e / P).toFixed(3)); }
    return { region: [g.x, g.y, g.w, g.h], niveauMoyen: +(moy / (P * g.seq.length)).toFixed(1),
      d1: +(d1 / n1).toFixed(4), d2: +(d2 / n2).toFixed(4), allersRetours: +(1000 * flips / n2).toFixed(2), serie };
  });
  const st = R.stats;
  return { moteur: window.FERRO && FERRO.version, image: W + 'x' + H, ombres: st.shadows, atlas: st.shadowMapSize, photo: st.ombresPhoto ? Object.assign({}, st.ombresPhoto) : null,
    metres: +(S.course.joueur.etat.s - s0).toFixed(1), info, regions: res };
})()`;

// Journal du gouverneur : qualité Auto, cadence réelle de Chrome sans fenêtre, 600 images.
const JOURNAL = `(async () => {
  const J = BITUME_JEU, B = globalThis.BITUME;
  const images = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  J.reference({ circuit: 0, qualite: 'auto', vue: 'cockpit', retro: 'non', depart: 800, vitesse: 60 });
  await images(600);
  return { moteur: window.FERRO && FERRO.version, journal: B.ombres && B.ombres.journal ? B.ombres.journal() : null, photo: J.rendu.stats.ombresPhoto || null };
})()`;

const dossier = mkdtempSync(path.join(tmpdir(), 'bitume-ombres-'));
function lancer(nom, js) {
  const f = path.join(dossier, nom + '.js');
  writeFileSync(f, js);
  const r = spawnSync('node', [path.join(ici, 'page-essai.mjs'), page, f, '--taille', '1280,720'], { encoding: 'utf8', timeout: 600000 });
  try { const v = JSON.parse(r.stdout); if (v.fatal) throw new Error(v.fatal); return Object.assign(v.valeur, v.erreurs && v.erreurs.length ? { erreurs: v.erreurs.slice(0, 3) } : {}); }
  catch (e) { return { echec: String(e.message || e).slice(0, 400), sortie: (r.stdout || '').slice(0, 400) + (r.stderr || '').slice(0, 400) }; }
}

const rapport = { page: path.resolve(page), date: new Date().toISOString(), seuils: { d1: SEUIL_D1, cockpit: SEUIL_COCKPIT }, scenes: {}, verdicts: [] };
let ko = 0;
try {
  for (const sc of SCENES) {
    if (seul && !seul.has(sc.nom)) continue;
    const js = MODELE.replace('__REF__', JSON.stringify(sc.ref)).replace('__CAM__', sc.cam || '').replace('__RETOUCHE__', JSON.stringify(sc.retouche || null))
      .replace('__SEUL__', String(!!sc.seul)).replace('__FIGER__', String(!!sc.figer)).replace('__CHAUFFE__', String(sc.chauffe)).replace('__REGIONS__', JSON.stringify(sc.regions)).replace('__N__', String(sc.n));
    const v = lancer(sc.nom, js);
    rapport.scenes[sc.nom] = v;
    if (v.echec) { ko++; rapport.verdicts.push(`KO ${sc.nom} : ${v.echec}`); continue; }
    console.log(`${sc.nom} : ${v.regions.map(g => `d1 ${g.d1} d2 ${g.d2} a/r ${g.allersRetours}‰ (niveau ${g.niveauMoyen})`).join(' | ')} ; ${v.metres} m ; ${JSON.stringify(v.photo)}`);
    if (sc.nom.startsWith('arbre-') && !sc.temoin) {
      const d1 = Math.max(...v.regions.map(g => g.d1)), ok = d1 < SEUIL_D1 && v.metres > 40;
      if (!ok) ko++;
      rapport.verdicts.push(`${ok ? 'ok' : 'KO'} ${sc.nom} : d1 ${d1} (seuil ${SEUIL_D1}), voiture avancée de ${v.metres} m`);
    }
  }
  for (const k of PAIRES) {
    const a = rapport.scenes[k.nom], b = rapport.scenes[k.nom + '-sans-tuile'];
    if (!a || !b || a.echec || b.echec) continue;
    a.regions.forEach((g, i) => {
      const h = b.regions[i], dd2 = +(g.d2 - h.d2).toFixed(4), dar = +(g.allersRetours - h.allersRetours).toFixed(2);
      const controlee = k.controlees.includes(i), ok = dd2 <= SEUIL_COCKPIT.d2 && dar <= SEUIL_COCKPIT.allersRetours;
      if (controlee && !ok) ko++;
      rapport.verdicts.push(`${controlee ? (ok ? 'ok' : 'KO') : 'relevé'} ${k.nom} (s ${k.depart}), région ${i + 1} : tuile − sans tuile, d2 ${dd2 >= 0 ? '+' : ''}${dd2}${controlee ? ` (seuil +${SEUIL_COCKPIT.d2})` : ''}, allers-retours ${dar >= 0 ? '+' : ''}${dar} ‰${controlee ? ` (seuil +${SEUIL_COCKPIT.allersRetours} ‰)` : ''}`);
    });
  }
  if (!seul || seul.has('journal')) {
    const j = lancer('journal', JOURNAL);
    rapport.journal = j;
    if (j.echec || !j.journal) { ko++; rapport.verdicts.push('KO journal du gouverneur illisible : ' + (j.echec || 'BITUME.ombres absent')); }
    else rapport.verdicts.push(`ok journal du gouverneur : ${j.journal.changements} changement(s) en 10 s de qualité Auto : ` +
      j.journal.lignes.map(l => `t ${l.t.toFixed(1)} s niveau ${l.niveau} ombres ${l.ombres ? 'oui' : 'non'}`).join(' ; '));
  }
} finally { rmSync(dossier, { recursive: true, force: true }); }
for (const v of rapport.verdicts) console.log(v);
if (opt('sortie')) writeFileSync(opt('sortie'), JSON.stringify(rapport, null, 1));
console.log(ko ? `${ko} contrôle(s) en échec` : 'contrôles des ombres : tous passés');
process.exit(ko ? 1 : 0);
