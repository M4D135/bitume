#!/usr/bin/env node
/* BITUME — lot 22F : plans et profils des tracés proposés (outil d'étude, aucune source du jeu n'est touchée).

   node tools/lieux-plans.mjs [--sortie dossier] [--ids route-des-cimes,cap-sequoia] [--esquisse] [--sans-png]

   Pour chaque partition de tools/lieux-partitions.mjs : construit le tracé (tools/lieux-trace.mjs), écrit
   <id>-plan.svg (tracé coloré par la pente, passages couverts, ponts, bords dangereux, lieux numérotés),
   <id>-profil.svg (altitude, pente, vitesse de référence p9 / p10, charge verticale) et <id>.json (mesures), puis
   les rend en PNG par Chrome sans interface dans un profil jetable. --esquisse trace le tour sans fermeture.
   Palette : surface claire, encres primaire / secondaire / discrète ; pente en divergent bleu (descente) ↔ rouge
   (montée) autour d'un gris neutre ; une seule échelle par panneau. */
import { writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TRACE } from './lieux-trace.mjs';
import { PARTITIONS } from './lieux-partitions.mjs';

const T = {
  surface: '#fcfcfb', encre: '#0b0b0b', secondaire: '#52514e', discret: '#898781', grille: '#e1e0d9', axe: '#c3c2b7',
  bande: '#f0efec', bande2: '#e7e5df', serie1: '#2a78d6', serie2: '#eb6834',
};
// pente (%) : 7 classes, bleu = descente, rouge = montée, gris = à plat
const CLASSES = [
  { max: -12, couleur: '#104281', nom: '≤ −12 %' }, { max: -6, couleur: '#2a78d6', nom: '−12 à −6 %' }, { max: -2, couleur: '#86b6ef', nom: '−6 à −2 %' },
  { max: 2, couleur: '#a9a8a0', nom: '−2 à 2 %' },
  { max: 6, couleur: '#f2a19c', nom: '2 à 6 %' }, { max: 12, couleur: '#e34948', nom: '6 à 12 %' }, { max: Infinity, couleur: '#8f1f1e', nom: '≥ 12 %' },
];
const classe = p => CLASSES.findIndex(k => p * 100 <= k.max);
const fr = (v, d = 0) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, ' ');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const texte = (x, y, t, o = {}) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.taille || 13}" fill="${o.couleur || T.encre}"${o.ancre ? ` text-anchor="${o.ancre}"` : ''}${o.gras ? ' font-weight="600"' : ''}>${esc(t)}</text>`;
const enveloppe = (W, H, corps) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif">\n<rect width="${W}" height="${H}" fill="${T.surface}"/>\n${corps}\n</svg>\n`;

function graduations(a, b, n = 5) {
  const brut = (b - a) / n, p = Math.pow(10, Math.floor(Math.log10(brut))), f = brut / p;
  const pas = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, out = [];
  for (let v = Math.ceil(a / pas) * pas; v <= b + 1e-9; v += pas) out.push(Math.abs(v) < 1e-9 ? 0 : v);
  return out;
}
// coupe un texte en lignes d'au plus n caractères
function lignes(t, n) {
  const mots = t.split(' '), out = [];
  let l = '';
  for (const m of mots) { if ((l + ' ' + m).trim().length > n) { out.push(l.trim()); l = m; } else l += ' ' + m; }
  if (l.trim()) out.push(l.trim());
  return out;
}

// ------------------------------------------------------------------ plan
// Couches du tracé pour une projection donnée (carte entière ou médaillon) : gaine, âme colorée par la pente
// (pointillée sous couvert), ponts, hachures des bords dangereux, et la branche haute des croisements redessinée
// par-dessus, comme un pont.
function couches(c, X, Z, e, largeur = 1) {
  const out = [], L = v => (v * largeur).toFixed(1);
  const pt = i => `${X(c.x[i]).toFixed(1)},${Z(c.z[i]).toFixed(1)}`;
  const dans = (liste, s) => liste.find(t => s >= t.debut && s < t.fin);
  const ame = (i0, i1) => {
    let debut = i0;
    for (let i = i0 + 1; i <= i1; i++) {
      const a = i - 1, ca = classe(c.pente[a % c.n]), cb = i < i1 ? classe(c.pente[i % c.n]) : -1;
      const ta = !!dans(c.couverts, (a % c.n) * c.pasReel), tb = i < i1 ? !!dans(c.couverts, (i % c.n) * c.pasReel) : !ta;
      if (cb !== ca || tb !== ta || i === i1) {
        const pts = []; for (let j = debut; j <= i; j++) pts.push(pt(((j % c.n) + c.n) % c.n));
        out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${CLASSES[ca].couleur}" stroke-width="${L(6)}" stroke-linejoin="round"${ta ? ' stroke-dasharray="7 5"' : ' stroke-linecap="round"'}/>`);
        debut = i;
      }
    }
  };
  const tout = []; for (let i = 0; i <= c.n; i++) tout.push(pt(i % c.n));
  out.push(`<polyline points="${tout.join(' ')}" fill="none" stroke="${T.secondaire}" stroke-width="${L(10)}" stroke-linejoin="round" stroke-linecap="round"/>`);
  ame(0, c.n);
  // sous couvert : la gaine en encre pleine, pour que le pointillé se lise comme un passage sous la roche
  for (const t of c.couverts) {
    const pts = []; for (let s = t.debut; s <= t.fin; s += c.pasReel) pts.push(pt(Math.round(s / c.pasReel) % c.n));
    out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${T.encre}" stroke-width="${L(11)}" stroke-opacity=".9" stroke-linejoin="round"/>`);
    const ca = classe(c.pente[Math.round(t.debut / c.pasReel) % c.n]);
    out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${CLASSES[ca].couleur}" stroke-width="${L(5)}" stroke-dasharray="7 5" stroke-linejoin="round"/>`);
  }
  const traitsPont = (debut, fin) => {
    for (const cote of [-1, 1]) {
      const pts = [];
      for (let s = debut; s <= fin; s += c.pasReel) {
        const i = ((Math.round(s / c.pasReel) % c.n) + c.n) % c.n, rx = -Math.sin(c.cap[i]), rz = Math.cos(c.cap[i]);
        pts.push(`${(X(c.x[i]) + rx * cote * 9 * largeur).toFixed(1)},${(Z(c.z[i]) + rz * cote * 9 * largeur).toFixed(1)}`);
      }
      out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${T.encre}" stroke-width="2"/>`);
    }
  };
  for (const b of c.ponts) traitsPont(b.debut - 6, b.fin + 6);
  // croisements : la branche haute passe par-dessus (gaine, âme, traits de pont)
  for (const k of c.croisements) {
    const haut = c.y[Math.round(k.s1 / c.pasReel) % c.n] > c.y[Math.round(k.s2 / c.pasReel) % c.n] ? k.s1 : k.s2;
    const i0 = Math.round((haut - 70) / c.pasReel), i1 = Math.round((haut + 70) / c.pasReel), pts = [];
    for (let i = i0; i <= i1; i++) pts.push(pt(((i % c.n) + c.n) % c.n));
    out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${T.surface}" stroke-width="${L(18)}"/>`);
    out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${T.secondaire}" stroke-width="${L(10)}" stroke-linejoin="round"/>`);
    ame(i0, i1);
    traitsPont(haut - 30, haut + 30);
  }
  // bords dangereux : hachures du côté concerné
  for (const b of c.bords) {
    const cote = b.cote === 'G' ? -1 : 1;
    for (let s = b.debut + 6; s < b.fin; s += Math.max(14, 10 / e)) {
      const i = Math.round(s / c.pasReel) % c.n, rx = -Math.sin(c.cap[i]), rz = Math.cos(c.cap[i]);
      const ax = X(c.x[i]) + rx * cote * 8 * largeur, az = Z(c.z[i]) + rz * cote * 8 * largeur;
      out.push(`<line x1="${ax.toFixed(1)}" y1="${az.toFixed(1)}" x2="${(ax + rx * cote * 7).toFixed(1)}" y2="${(az + rz * cote * 7).toFixed(1)}" stroke="${T.encre}" stroke-width="1.6"/>`);
    }
  }
  return out;
}

// Médaillon : un lieu agrandi dans un coin libre de la carte (épingles, spirale), avec son échelle.
function medaillon(c, z, carte, Xg, Zg, id) {
  const l = c.lieux.find(k => k.n === z.lieu), out = [];
  const i0 = Math.round(l.debut / c.pasReel), i1 = Math.round(l.fin / c.pasReel);
  let cx = 0, cz = 0, n = 0;
  for (let i = i0; i <= i1; i++) { cx += c.x[i % c.n]; cz += c.z[i % c.n]; n++; }
  cx /= n; cz /= n;
  const taille = z.taille || 330, r = z.rayon || 260, e = taille / (2 * r);
  // la place de la carte que le tracé encombre le moins (puis la plus proche du lieu agrandi), hors de l'échelle
  let meilleur = null;
  const lx = Xg(cx), lz = Zg(cz), demi = r * (Xg(1) - Xg(0));
  for (let qx = carte.x + 6; qx <= carte.x + carte.w - taille - 6; qx += 24) for (let qz = carte.y + 6; qz <= carte.y + carte.h - taille - 50; qz += 24) {
    let gene = 0;
    for (let i = 0; i < c.n; i += 3) { const x = Xg(c.x[i]), y = Zg(c.z[i]); if (x > qx - 24 && x < qx + taille + 24 && y > qz - 24 && y < qz + taille + 24) gene++; }
    // ni sur le cadre du lieu agrandi : on doit voir les deux
    const ox = Math.max(0, Math.min(qx + taille + 12, lx + demi) - Math.max(qx - 12, lx - demi)), oz = Math.max(0, Math.min(qz + taille + 12, lz + demi) - Math.max(qz - 12, lz - demi));
    gene += ox * oz / 400;
    const d = Math.hypot(qx + taille / 2 - lx, qz + taille / 2 - lz);
    if (!meilleur || gene < meilleur.gene || (gene === meilleur.gene && d < meilleur.d)) meilleur = { qx, qz, gene, d };
  }
  const { qx, qz } = meilleur, X = x => qx + taille / 2 + (x - cx) * e, Z = v => qz + taille / 2 + (v - cz) * e;
  out.push(`<rect x="${(Xg(cx) - r * (Xg(1) - Xg(0))).toFixed(1)}" y="${(Zg(cz) - r * (Xg(1) - Xg(0))).toFixed(1)}" width="${(2 * r * (Xg(1) - Xg(0))).toFixed(1)}" height="${(2 * r * (Xg(1) - Xg(0))).toFixed(1)}" fill="none" stroke="${T.discret}" stroke-width="1"/>`);
  out.push(`<clipPath id="m${id}"><rect x="${qx}" y="${qz}" width="${taille}" height="${taille}"/></clipPath>`);
  out.push(`<rect x="${qx}" y="${qz}" width="${taille}" height="${taille}" fill="${T.surface}" stroke="${T.axe}" stroke-width="1"/>`);
  out.push(`<g clip-path="url(#m${id})">${couches(c, X, Z, e, Math.min(2.2, Math.max(1, e * 2))).join('')}</g>`);
  const m = r > 400 ? 200 : 100;
  out.push(`<line x1="${qx + 12}" y1="${qz + taille - 12}" x2="${(qx + 12 + m * e).toFixed(1)}" y2="${qz + taille - 12}" stroke="${T.encre}" stroke-width="2"/>`);
  out.push(texte(qx + 12 + m * e / 2, qz + taille - 18, m + ' m', { taille: 11, couleur: T.secondaire, ancre: 'middle' }));
  out.push(texte(qx + 10, qz + 18, `${l.n} · ${l.nom} (agrandi)`, { taille: 12, gras: true }));
  return out;
}

function svgPlan(c, p) {
  const W = 1500, H = 1000, carte = { x: 30, y: 30, w: 1000, h: 940 };
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < c.n; i++) { x0 = Math.min(x0, c.x[i]); x1 = Math.max(x1, c.x[i]); z0 = Math.min(z0, c.z[i]); z1 = Math.max(z1, c.z[i]); }
  const marge = 120, e = Math.min(carte.w / (x1 - x0 + 2 * marge), carte.h / (z1 - z0 + 2 * marge));
  const ox = carte.x + (carte.w - (x1 - x0) * e) / 2 - x0 * e, oz = carte.y + (carte.h - (z1 - z0) * e) / 2 - z0 * e;
  const X = x => ox + x * e, Z = z => oz + z * e;
  const out = [...couches(c, X, Z, e)];
  // départ : barre perpendiculaire et flèche du sens de marche
  {
    const rx = -Math.sin(c.cap[0]), rz = Math.cos(c.cap[0]);
    out.push(`<line x1="${(X(c.x[0]) - rx * 14).toFixed(1)}" y1="${(Z(c.z[0]) - rz * 14).toFixed(1)}" x2="${(X(c.x[0]) + rx * 14).toFixed(1)}" y2="${(Z(c.z[0]) + rz * 14).toFixed(1)}" stroke="${T.encre}" stroke-width="4"/>`);
    const i = Math.round(Math.min(160, c.sequences[0].fin * .6) / c.pasReel), tx = Math.cos(c.cap[i]), tz = Math.sin(c.cap[i]);
    const cx = X(c.x[i]) - Math.sin(c.cap[i]) * -26, cz = Z(c.z[i]) + Math.cos(c.cap[i]) * -26;
    out.push(`<polygon points="${(cx + tx * 12).toFixed(1)},${(cz + tz * 12).toFixed(1)} ${(cx - tx * 6 - tz * 7).toFixed(1)},${(cz - tz * 6 + tx * 7).toFixed(1)} ${(cx - tx * 6 + tz * 7).toFixed(1)},${(cz - tz * 6 - tx * 7).toFixed(1)}" fill="${T.encre}"/>`);
    out.push(texte(X(c.x[0]) + rx * 24, Z(c.z[0]) + rz * 24 + 4, 'départ', { taille: 12, couleur: T.secondaire, ancre: 'middle' }));
  }
  // lieux : pastilles numérotées, écartées vers l'extérieur de la boucle
  let gx = 0, gz = 0; for (let i = 0; i < c.n; i++) { gx += c.x[i]; gz += c.z[i]; } gx /= c.n; gz /= c.n;
  for (const l of c.lieux) {
    const i = Math.round((l.debut + l.fin) / 2 / c.pasReel) % c.n, rx = -Math.sin(c.cap[i]), rz = Math.cos(c.cap[i]);
    const vers = ((c.x[i] - gx) * rx + (c.z[i] - gz) * rz) > 0 ? 1 : -1, ecart = l.ecart || 46;
    // la pastille reste dans le cadre de la carte même quand le lieu en touche le bord
    const px = Math.min(Math.max(X(c.x[i]) + rx * vers * ecart, carte.x + 14), carte.x + carte.w - 14);
    const pz = Math.min(Math.max(Z(c.z[i]) + rz * vers * ecart, carte.y + 14), carte.y + carte.h - 14);
    out.push(`<line x1="${(X(c.x[i]) + rx * vers * 10).toFixed(1)}" y1="${(Z(c.z[i]) + rz * vers * 10).toFixed(1)}" x2="${px.toFixed(1)}" y2="${pz.toFixed(1)}" stroke="${T.secondaire}" stroke-width="1"/>`);
    out.push(`<circle cx="${px.toFixed(1)}" cy="${pz.toFixed(1)}" r="12" fill="${T.surface}" stroke="${T.encre}" stroke-width="1.5"/>`);
    out.push(texte(px, pz + 4.5, l.n, { taille: 13, gras: true, ancre: 'middle' }));
  }
  // échelle
  const metres = (x1 - x0) > 2500 ? 1000 : 500, sx = carte.x + 10, sy = carte.y + carte.h - 10;
  out.push(`<line x1="${sx}" y1="${sy}" x2="${(sx + metres * e).toFixed(1)}" y2="${sy}" stroke="${T.encre}" stroke-width="2"/>`);
  for (const v of [0, metres]) out.push(`<line x1="${(sx + v * e).toFixed(1)}" y1="${sy - 5}" x2="${(sx + v * e).toFixed(1)}" y2="${sy + 1}" stroke="${T.encre}" stroke-width="2"/>`);
  out.push(texte(sx + metres * e / 2, sy - 9, fr(metres) + ' m', { taille: 12, couleur: T.secondaire, ancre: 'middle' }));
  (p.zoom || []).forEach((z, k) => out.push(...medaillon(c, z, carte, X, Z, k)));
  // colonne de droite : titre, mesures, légende, lieux
  const M = c.mesures, lx = 1060;
  let y = 52;
  out.push(texte(lx, y, c.nom + ' — tracé proposé (lot 22F)', { taille: 22, gras: true })); y += 26;
  out.push(texte(lx, y, `${fr(M.longueur / 1000, 2)} km · dénivelé ${fr(M.denivele)} m · pente ${fr(M.penteMin, 1)} à +${fr(M.penteMax, 1)} %`, { taille: 13, couleur: T.secondaire })); y += 19;
  out.push(texte(lx, y, `rayon mini ${fr(M.rayonMin)} m · ${M.virages} virages · ${fr(M.partDroite * 100)} % de droites (R > 900 m)`, { taille: 13, couleur: T.secondaire })); y += 19;
  out.push(texte(lx, y, `tour de référence ${fr(M.tourP9, 1)} s (p9, à plat) · ${fr(M.tourP10, 1)} s (p10, pente)`, { taille: 13, couleur: T.secondaire })); y += 32;
  out.push(texte(lx, y, 'Pente dans le sens de marche', { taille: 13, gras: true })); y += 8;
  CLASSES.forEach((k, j) => {
    const yy = y + 12 + j * 19;
    out.push(`<line x1="${lx}" y1="${yy}" x2="${lx + 30}" y2="${yy}" stroke="${T.secondaire}" stroke-width="9" stroke-linecap="round"/><line x1="${lx}" y1="${yy}" x2="${lx + 30}" y2="${yy}" stroke="${k.couleur}" stroke-width="5" stroke-linecap="round"/>`);
    out.push(texte(lx + 42, yy + 4.5, k.nom, { taille: 12, couleur: T.secondaire }));
  });
  y += 12 + CLASSES.length * 19 + 10;
  const sym = [
    [`<line x1="${lx}" y1="Y" x2="${lx + 30}" y2="Y" stroke="${T.encre}" stroke-width="10"/><line x1="${lx}" y1="Y" x2="${lx + 30}" y2="Y" stroke="#e34948" stroke-width="5" stroke-dasharray="7 5"/>`, 'passage couvert (tunnel, galerie, voûte)'],
    [`<line x1="${lx}" y1="Y" x2="${lx + 30}" y2="Y" stroke="${T.secondaire}" stroke-width="9"/><line x1="${lx}" y1="Y-7" x2="${lx + 30}" y2="Y-7" stroke="${T.encre}" stroke-width="2"/><line x1="${lx}" y1="Y+7" x2="${lx + 30}" y2="Y+7" stroke="${T.encre}" stroke-width="2"/>`, 'pont'],
    [`<line x1="${lx}" y1="Y" x2="${lx + 30}" y2="Y" stroke="${T.secondaire}" stroke-width="9"/>${[4, 12, 20, 28].map(d => `<line x1="${lx + d}" y1="Y-6" x2="${lx + d}" y2="Y-13" stroke="${T.encre}" stroke-width="1.6"/>`).join('')}`, 'bord dangereux (côté hachuré)'],
  ];
  if (c.croisements.length) sym.push([`<circle cx="${lx + 15}" cy="Y" r="10" fill="none" stroke="${T.encre}" stroke-width="1.5"/>`, 'croisement par pont']);
  for (const [s, t] of sym) { y += 30; out.push(s.replace(/Y([+-]\d+)?/g, (m, d) => String(y + (d ? +d : 0)))); out.push(texte(lx + 42, y + 4.5, t, { taille: 12, couleur: T.secondaire })); }
  y += 36;
  out.push(texte(lx, y, 'Lieux', { taille: 13, gras: true })); y += 6;
  for (const l of c.lieux) {
    y += 22;
    out.push(`<circle cx="${lx + 11}" cy="${y - 4}" r="10" fill="${T.surface}" stroke="${T.encre}" stroke-width="1.3"/>`);
    out.push(texte(lx + 11, y + .5, l.n, { taille: 12, gras: true, ancre: 'middle' }));
    out.push(texte(lx + 30, y, `${l.nom} — km ${fr(l.debut / 1000, 1)}`, { taille: 13, gras: true }));
    for (const ligne of lignes(l.court, 52)) { y += 17; out.push(texte(lx + 30, y, ligne, { taille: 12, couleur: T.secondaire })); }
  }
  if (c.couverts.length) {
    y += 30; out.push(texte(lx, y, 'Passages couverts', { taille: 13, gras: true }));
    for (const t of c.couverts) { y += 18; out.push(texte(lx, y, `${t.nom} (${t.type}) : ${fr(t.fin - t.debut)} m, km ${fr(t.debut / 1000, 1)}`, { taille: 12, couleur: T.secondaire })); }
  }
  return enveloppe(W, H, out.join('\n'));
}

// ------------------------------------------------------------------ profil
function svgProfil(c) {
  const W = 1500, H = 1235, gx = 90, gw = W - gx - 40, km = c.longueur / 1000;
  const X = s => gx + s / c.longueur * gw;
  const panneaux = [
    { titre: 'Altitude (m)', h: 300, v: i => c.y[i] - c.mesures.altitudeMin, aire: true },
    { titre: 'Pente dans le sens de marche (%)', h: 230, v: i => c.pente[i] * 100, reperes: [-30, -20, -10, 10, 20, 30] },
    { titre: 'Vitesse de référence (km/h)', h: 250, series: [{ nom: 'p9 : jeu actuel, à plat', v: i => c.vitesseP9[i] * 3.6, couleur: T.serie2 }, { nom: 'p10 proposée : pente, dévers, crêtes', v: i => c.vitesseP10[i] * 3.6, couleur: T.serie1 }] },
    { titre: 'Charge verticale à la vitesse p10 (g, sans appui)', h: 170, v: i => 1 / Math.sqrt(1 + c.pente[i] ** 2) + c.vitesseP10[i] ** 2 * c.kv[i] / 9.81, reperes: [.6, 1.7] },
  ];
  const out = [];
  let y = 70;
  out.push(texte(gx, 34, c.nom + ' — profil en long du tracé proposé', { taille: 22, gras: true }));
  out.push(texte(gx, 56, `${fr(km, 2)} km · dénivelé ${fr(c.mesures.denivele)} m · ${fr(c.mesures.longueurAu10)} m au-delà de 10 %, ${fr(c.mesures.longueurAu20)} m au-delà de 20 %`, { taille: 13, couleur: T.secondaire }));
  for (const [k, P] of panneaux.entries()) {
    y += 34;
    const h = P.h, top = y, bas = y + h;
    out.push(texte(gx, top - 10, P.titre, { taille: 14, gras: true }));
    // bandes des lieux (fond), passages couverts (barre basse)
    for (const l of c.lieux) {
      out.push(`<rect x="${X(l.debut).toFixed(1)}" y="${top}" width="${(X(l.fin) - X(l.debut)).toFixed(1)}" height="${h}" fill="${l.n % 2 ? T.bande : T.bande2}"/>`);
      if (k === 0) out.push(texte((X(l.debut) + X(l.fin)) / 2, top + 16, l.n, { taille: 13, gras: true, ancre: 'middle' }));
    }
    const valeurs = []; const series = P.series || [{ v: P.v, couleur: T.serie1 }];
    let vmin = Infinity, vmax = -Infinity;
    for (const S of series) for (let i = 0; i < c.n; i++) { const v = S.v(i); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); }
    if (P.reperes) for (const r of P.reperes) if (r > vmin - 12 && r < vmax + 12) { vmin = Math.min(vmin, r); vmax = Math.max(vmax, r); }
    if (k === 0 || k === 2) vmin = Math.min(0, vmin);
    const pad = (vmax - vmin) * .08 || 1, a = vmin - (k === 0 || k === 2 ? 0 : pad), b = vmax + pad;
    const Y = v => bas - (v - a) / (b - a) * h;
    for (const g of graduations(a, b, 5)) {
      out.push(`<line x1="${gx}" y1="${Y(g).toFixed(1)}" x2="${gx + gw}" y2="${Y(g).toFixed(1)}" stroke="${g === 0 ? T.axe : T.grille}" stroke-width="1"/>`);
      out.push(texte(gx - 8, Y(g) + 4, fr(g, Math.abs(b - a) < 3 ? 1 : 0), { taille: 11, couleur: T.discret, ancre: 'end' }));
    }
    if (P.reperes) for (const r of P.reperes) if (r >= a && r <= b) {
      out.push(`<line x1="${gx}" y1="${Y(r).toFixed(1)}" x2="${gx + gw}" y2="${Y(r).toFixed(1)}" stroke="${T.axe}" stroke-width="1"/>`);
    }
    for (const S of series) {
      const pts = []; for (let i = 0; i < c.n; i += 2) pts.push(`${X(i * c.pasReel).toFixed(1)},${Y(S.v(i)).toFixed(1)}`);
      pts.push(`${X(c.longueur).toFixed(1)},${Y(S.v(0)).toFixed(1)}`);
      if (P.aire) out.push(`<polygon points="${X(0)},${Y(a)} ${pts.join(' ')} ${X(c.longueur)},${Y(a)}" fill="${S.couleur}" fill-opacity=".1"/>`);
      out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${S.couleur}" stroke-width="2" stroke-linejoin="round"/>`);
      valeurs.push(S);
    }
    if (k === 0) {
      for (const t of c.couverts) {
        out.push(`<rect x="${X(t.debut).toFixed(1)}" y="${bas - 10}" width="${Math.max(2, X(t.fin) - X(t.debut)).toFixed(1)}" height="10" fill="${T.encre}"/>`);
        out.push(texte((X(t.debut) + X(t.fin)) / 2, bas - 15, t.type === 'tunnel' ? 'tunnel' : t.type, { taille: 11, couleur: T.secondaire, ancre: 'middle' }));
      }
      for (const p of c.ponts) {
        const yy = Y(c.y[Math.round((p.debut + p.fin) / 2 / c.pasReel) % c.n] - c.mesures.altitudeMin);
        out.push(`<line x1="${X(p.debut).toFixed(1)}" y1="${(yy + 9).toFixed(1)}" x2="${X(p.fin).toFixed(1)}" y2="${(yy + 9).toFixed(1)}" stroke="${T.encre}" stroke-width="2"/>`);
        out.push(texte((X(p.debut) + X(p.fin)) / 2, yy + 24, 'pont', { taille: 11, couleur: T.secondaire, ancre: 'middle' }));
      }
    }
    if (P.series) {
      let lx = gx + gw - 560;
      for (const S of P.series) {
        out.push(`<line x1="${lx}" y1="${top - 14}" x2="${lx + 24}" y2="${top - 14}" stroke="${S.couleur}" stroke-width="3"/>`);
        out.push(texte(lx + 30, top - 10, S.nom, { taille: 12, couleur: T.secondaire }));
        lx += 280;
      }
    }
    out.push(`<line x1="${gx}" y1="${bas}" x2="${gx + gw}" y2="${bas}" stroke="${T.axe}" stroke-width="1"/>`);
    y = bas;
  }
  for (const g of graduations(0, km, 10)) out.push(texte(X(g * 1000), y + 18, fr(g, g % 1 ? 1 : 0) + ' km', { taille: 11, couleur: T.discret, ancre: 'middle' }));
  return enveloppe(W, H, out.join('\n'));
}

function svgEsquisse(p) {
  const E = TRACE.esquisse(p), P = E.P, W = 1100, H = 1000;
  let x0 = 0, x1 = 0, z0 = 0, z1 = 0;
  for (let j = 0; j <= P.nf; j++) { x0 = Math.min(x0, P.X[j]); x1 = Math.max(x1, P.X[j]); z0 = Math.min(z0, P.Z[j]); z1 = Math.max(z1, P.Z[j]); }
  const e = Math.min((W - 80) / (x1 - x0 + 1), (H - 80) / (z1 - z0 + 1)), X = x => 40 + (x - x0) * e, Z = z => 40 + (z - z0) * e;
  const pts = []; for (let j = 0; j <= P.nf; j += 4) pts.push(`${X(P.X[j]).toFixed(1)},${Z(P.Z[j]).toFixed(1)}`);
  const out = [`<polyline points="${pts.join(' ')}" fill="none" stroke="${T.serie1}" stroke-width="3"/>`];
  for (const d of E.departs) out.push(`<circle cx="${X(d.x).toFixed(1)}" cy="${Z(d.z).toFixed(1)}" r="3" fill="${T.encre}"/>` + texte(X(d.x) + 5, Z(d.z) - 4, d.k, { taille: 10, couleur: T.secondaire }));
  out.push(`<circle cx="${X(E.fin[0]).toFixed(1)}" cy="${Z(E.fin[1]).toFixed(1)}" r="7" fill="none" stroke="${T.serie2}" stroke-width="2"/>`);
  out.push(texte(40, 24, `${p.nom} — esquisse sans fermeture : ${fr(E.longueur)} m, fin à (${fr(E.fin[0])}, ${fr(E.fin[1])}), cap ${fr(E.capFin, 1)}°`, { taille: 14, gras: true }));
  return enveloppe(W, H, out.join('\n'));
}

// ------------------------------------------------------------------ rendu
function rendrePng(svgChemin, pngChemin, largeur, hauteur) {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!existsSync(chrome)) return false;
  const profil = mkdtempSync(path.join(tmpdir(), 'bitume-lieux-'));
  try {
    const r = spawnSync(chrome, ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profil,
      '--force-device-scale-factor=1', '--window-size=' + largeur + ',' + hauteur, '--screenshot=' + path.resolve(pngChemin), 'file://' + path.resolve(svgChemin)], { timeout: 60000 });
    return r.status === 0 && existsSync(pngChemin);
  } finally { rmSync(profil, { recursive: true, force: true }); }
}
function ecrire(chemin, svg, png) {
  writeFileSync(chemin, svg);
  if (!png) return;
  const m = svg.match(/width="(\d+)" height="(\d+)"/);
  if (!rendrePng(chemin, chemin.replace(/\.svg$/, '.png'), +m[1], +m[2])) console.error('PNG non rendu : ' + chemin);
}

function resume(c, pb) {
  const M = c.mesures, arrondi = v => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
  return {
    // séparation infinie = aucune paire de points à moins de 60 m en plan (hors croisements déclarés)
    id: c.id, nom: c.nom, theme: c.theme, mesures: JSON.parse(JSON.stringify({ ...M, separation: Number.isFinite(M.separation) ? M.separation : 'au moins 60 m' }, (k, v) => arrondi(v))), problemes: pb,
    lieux: c.lieux.map(l => ({ n: l.n, nom: l.nom, debut: Math.round(l.debut), fin: Math.round(l.fin), court: l.court })),
    couverts: c.couverts.map(t => ({ nom: t.nom, type: t.type, debut: Math.round(t.debut), fin: Math.round(t.fin), longueur: Math.round(t.fin - t.debut) })),
    ponts: c.ponts.map(t => ({ nom: t.nom, type: t.type, debut: Math.round(t.debut), fin: Math.round(t.fin) })),
    bords: c.bords.map(t => ({ nom: t.nom, type: t.type, cote: t.cote, debut: Math.round(t.debut), fin: Math.round(t.fin) })),
    croisements: c.croisements.map(k => ({ nom: k.nom, ecartVertical: arrondi(k.ecartVertical), s1: Math.round(k.s1), s2: Math.round(k.s2) })),
    fermeture: { angleAjuste: arrondi(c.fermeture.angleAjuste), allongements: c.fermeture.allongements.map((v, i) => v ? [i, Math.round(v)] : null).filter(Boolean) },
    tunnelDuJeu: c.tunnel,
  };
}

if (import.meta.url === 'file://' + process.argv[1] || process.argv[1]?.endsWith('lieux-plans.mjs')) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
  const sortie = arg('--sortie', 'docs/reprise/rapports/lieux-2026-11-18'), ids = arg('--ids', ''), png = !process.argv.includes('--sans-png');
  mkdirSync(sortie, { recursive: true });
  const choisies = PARTITIONS.filter(p => !ids || ids.split(',').includes(p.id));
  const bilan = [];
  for (const p of choisies) {
    if (process.argv.includes('--esquisse')) { ecrire(path.join(sortie, p.id + '-esquisse.svg'), svgEsquisse(p), png); continue; }
    const t0 = Date.now(), c = TRACE.construire(p), pb = TRACE.controler(c, p.attentes || {});
    ecrire(path.join(sortie, p.id + '-plan.svg'), svgPlan(c, p), png);
    ecrire(path.join(sortie, p.id + '-profil.svg'), svgProfil(c), png);
    const r = resume(c, pb);
    writeFileSync(path.join(sortie, p.id + '.json'), JSON.stringify(r, null, 1) + '\n');
    bilan.push(r);
    console.log(`${p.id} : ${fr(c.longueur)} m, dénivelé ${fr(c.mesures.denivele)} m, pente ${fr(c.mesures.penteMin, 1)} / ${fr(c.mesures.penteMax, 1)} %, séparation ${Number.isFinite(c.mesures.separation) ? fr(c.mesures.separation, 1) + ' m' : '≥ 60 m'}, charge ${fr(c.mesures.chargeMin, 2)}–${fr(c.mesures.chargeMax, 2)} g, tour p9 ${fr(c.mesures.tourP9, 1)} s / p10 ${fr(c.mesures.tourP10, 1)} s, ${Date.now() - t0} ms${pb.length ? ' — PROBLÈMES : ' + pb.join(' ; ') : ''}`);
  }
  if (bilan.length && !ids) writeFileSync(path.join(sortie, 'mesures.json'), JSON.stringify(bilan.map(r => ({ id: r.id, ...r.mesures, problemes: r.problemes })), null, 1) + '\n');
}

export { svgPlan, svgProfil, svgEsquisse, resume };
