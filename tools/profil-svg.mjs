/* BITUME — graphiques de l'étude 22 en SVG (profils en long, pentes, dévers, courbures, avant/après du relief),
   et leur rendu en PNG par Chrome sans interface. Aucune dépendance. Palette : surface claire, encre primaire et
   secondaire, séries bleue puis orange dans cet ordre fixe ; traits de 2 px, grille fine et discrète. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const TEINTES = {
  surface: '#fcfcfb', encre: '#0b0b0b', secondaire: '#52514e', discret: '#898781', grille: '#e1e0d9', axe: '#c3c2b7',
  serie1: '#2a78d6', serie2: '#eb6834', bande: '#f0efec', bande2: '#e7e5df'
};
const T = TEINTES;
const echap = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const nombreFr = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '–').replace('-', '−').replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// Graduations « rondes » entre a et b (environ `voulu` intervalles).
export function graduations(a, b, voulu = 5) {
  const brut = (b - a) / voulu, p = Math.pow(10, Math.floor(Math.log10(brut))), f = brut / p;
  const pas = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, liste = [];
  for (let v = Math.ceil(a / pas - 1e-9) * pas; v <= b + 1e-9; v += pas) liste.push(+v.toFixed(10));
  return { pas, liste };
}

function texte(x, y, t, { taille = 12, couleur = T.secondaire, ancre = 'start', poids = 400, base = 'alphabetic' } = {}) {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${taille}" fill="${couleur}" text-anchor="${ancre}" font-weight="${poids}" dominant-baseline="${base}">${echap(t)}</text>`;
}

// Un panneau : échelle x commune (abscisse s), échelle y propre, grille horizontale fine, ligne(s) et repères.
export function panneau({ x0, y0, largeur, hauteur, sMax, yMin, yMax, titre, unite, series, bandes = [], reperes = [], zero = false, lignesRef = [], decimales = 0, axeX = false }) {
  const sx = s => x0 + s / sMax * largeur, sy = v => y0 + hauteur - (v - yMin) / (yMax - yMin) * hauteur;
  const out = [];
  for (const b of bandes) {
    const a = sx(Math.max(0, b.debut)), z = sx(Math.min(sMax, b.fin));
    if (z > a) out.push(`<rect x="${a.toFixed(1)}" y="${y0}" width="${(z - a).toFixed(1)}" height="${hauteur}" fill="${b.couleur || T.bande}"/>`);
  }
  const g = graduations(yMin, yMax, 4);
  for (const v of g.liste) {
    const y = sy(v);
    out.push(`<line x1="${x0}" x2="${x0 + largeur}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${Math.abs(v) < 1e-9 && zero ? T.axe : T.grille}" stroke-width="1"/>`);
    out.push(texte(x0 - 8, y + 4, nombreFr(v, decimales), { ancre: 'end', couleur: T.discret, taille: 11 }));
  }
  for (const r of lignesRef) {
    const y = sy(r.valeur);
    out.push(`<line x1="${x0}" x2="${x0 + largeur}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${T.axe}" stroke-width="1"/>`);
    out.push(texte(x0 + largeur - 4, y - 4, r.texte, { ancre: 'end', couleur: T.discret, taille: 11 }));
  }
  out.push(texte(x0, y0 - 8, titre + (unite ? ' (' + unite + ')' : ''), { couleur: T.encre, taille: 13, poids: 600 }));
  for (const serie of series) {
    const pts = [];
    for (let k = 0; k < serie.s.length; k++) pts.push(sx(serie.s[k]).toFixed(1) + ',' + sy(Math.max(yMin, Math.min(yMax, serie.v[k]))).toFixed(1));
    out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${serie.couleur}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
  }
  for (const r of reperes) {
    const x = sx(r.s), y = sy(r.v), h = 6;
    const forme = r.forme === 'bas' ? `${x - h},${y - h + 1} ${x + h},${y - h + 1} ${x},${y + h - 1}` : `${x - h},${y + h - 1} ${x + h},${y + h - 1} ${x},${y - h + 1}`;
    out.push(`<polygon points="${forme}" fill="${r.couleur || T.encre}" stroke="${T.surface}" stroke-width="2"/>`);
    if (r.texte) out.push(texte(x, r.forme === 'bas' ? y + 20 : y - 11, r.texte, { ancre: 'middle', taille: 11, couleur: T.secondaire }));
  }
  if (axeX) {
    const gx = graduations(0, sMax, 10);
    for (const s of gx.liste) {
      const x = sx(s);
      out.push(`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y0 + hauteur}" y2="${y0 + hauteur + 5}" stroke="${T.axe}" stroke-width="1"/>`);
      out.push(texte(x, y0 + hauteur + 19, nombreFr(s) + (s === gx.liste[gx.liste.length - 1] ? ' m' : ''), { ancre: 'middle', couleur: T.discret, taille: 11 }));
    }
  }
  out.push(`<line x1="${x0}" x2="${x0 + largeur}" y1="${y0 + hauteur}" y2="${y0 + hauteur}" stroke="${T.axe}" stroke-width="1"/>`);
  return out.join('\n');
}

export function enveloppe(largeur, hauteur, contenu) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">\n` +
    `<rect width="${largeur}" height="${hauteur}" fill="${T.surface}"/>\n${contenu}\n</svg>\n`;
}

export function legende(x, y, entrees) {
  const out = []; let cx = x;
  for (const e of entrees) {
    out.push(`<line x1="${cx}" x2="${cx + 22}" y1="${y - 4}" y2="${y - 4}" stroke="${e.couleur}" stroke-width="2" stroke-linecap="round"/>`);
    out.push(texte(cx + 28, y, e.texte, { couleur: T.secondaire, taille: 12 }));
    cx += 40 + e.texte.length * 6.6;
  }
  return out.join('\n');
}

const pasEchantillons = (c, pasM) => {
  const k = Math.max(1, Math.round(pasM / c.pas)), s = [], i = [];
  for (let j = 0; j <= c.n; j += k) { s.push(j * c.pas); i.push(j % c.n); }
  return { s, i };
};
const borne = (tab, marge, minimum) => {
  let a = Infinity, b = -Infinity; for (const v of tab) { a = Math.min(a, v); b = Math.max(b, v); }
  const m = Math.max(minimum, (b - a) * marge); return [Math.min(a - m, -minimum), Math.max(b + m, minimum)];
};

// Profil d'un circuit : altitude, pente, dévers, courbure, sur une même abscisse.
export function svgProfil(c, m, { titre, sousTitre }) {
  const W = 1400, H = 900, x0 = 86, largeur = W - x0 - 40, L = c.longueur, { s, i } = pasEchantillons(c, 4);
  const bandes = [];
  if (c.ligneDroite) bandes.push({ debut: ((c.ligneDroite.debut % L) + L) % L, fin: L }, { debut: 0, fin: c.ligneDroite.fin });
  if (c.tunnel) bandes.push({ debut: c.tunnel.debut, fin: c.tunnel.fin, couleur: T.bande2 });
  const alt = i.map(k => c.y[k]), pente = i.map(k => c.pente[k] * 100), dev = i.map(k => c.devers[k] * 180 / Math.PI), courb = i.map(k => c.courbure[k] * 1000);
  const [aMin, aMax] = borne(alt, .12, 2);
  const reperes = [];
  const parRayon = [...m.relief.listeCretes, ...m.relief.listeCuvettes].sort((a, b) => a.rayonVertical - b.rayonVertical);
  const nommes = new Set(parRayon.slice(0, 3).map(e => e.s));
  for (const e of m.relief.listeCretes) reperes.push({ s: e.s, v: e.y, forme: 'haut', texte: nommes.has(e.s) ? 'R ' + nombreFr(e.rayonVertical) + ' m' : '' });
  for (const e of m.relief.listeCuvettes) reperes.push({ s: e.s, v: e.y, forme: 'bas', texte: nommes.has(e.s) ? 'R ' + nombreFr(e.rayonVertical) + ' m' : '' });
  const morceaux = [
    texte(x0, 34, titre, { couleur: T.encre, taille: 18, poids: 650 }),
    texte(x0, 56, sousTitre, { couleur: T.secondaire, taille: 13 }),
    panneau({ x0, y0: 100, largeur, hauteur: 250, sMax: L, yMin: aMin, yMax: aMax, titre: 'Altitude de l’axe', unite: 'm', series: [{ s, v: alt, couleur: T.serie1 }], bandes, reperes, zero: true }),
    panneau({ x0, y0: 400, largeur, hauteur: 130, sMax: L, yMin: -8, yMax: 8, titre: 'Pente dans le sens de la course', unite: '%', series: [{ s, v: pente, couleur: T.serie1 }], bandes, zero: true,
      lignesRef: [{ valeur: 6.8, texte: 'plafond actuel 6,8 %' }, { valeur: -6.8, texte: '' }] }),
    panneau({ x0, y0: 580, largeur, hauteur: 110, sMax: L, yMin: -3, yMax: 3, titre: 'Dévers (> 0 : côté droit plus bas)', unite: '°', series: [{ s, v: dev, couleur: T.serie1 }], bandes, zero: true }),
    panneau({ x0, y0: 740, largeur, hauteur: 110, sMax: L, yMin: -45, yMax: 45, titre: 'Courbure en plan (> 0 : virage à droite)', unite: '1/km', series: [{ s, v: courb, couleur: T.serie1 }], bandes, zero: true, axeX: true }),
  ];
  const notes = ['Fond gris : ligne droite des stands, tenue plate par le générateur' + (c.tunnel ? ' ; gris plus soutenu : tunnel' : '') + '.',
    'Triangles : crêtes et cuvettes de plus de 1 m ; R = rayon vertical, les trois plus serrés sont nommés.'];
  morceaux.push(texte(x0, H - 4, notes.join(' '), { couleur: T.discret, taille: 11 }));
  return enveloppe(W, H, morceaux.join('\n'));
}

// Petits multiples : l'altitude des circuits sur une échelle commune.
export function svgPetitsMultiples(liste, { titre, sousTitre }) {
  const W = 1400, ligne = 118, x0 = 290, largeur = W - x0 - 40, H = 110 + liste.length * ligne;
  let a = Infinity, b = -Infinity, Lmax = 0;
  for (const { c } of liste) { for (const v of c.y) { a = Math.min(a, v); b = Math.max(b, v); } Lmax = Math.max(Lmax, c.longueur); }
  const g = graduations(Math.floor(a), Math.ceil(b), 3), yMin = Math.min(a, g.liste[0]), yMax = Math.max(b, g.liste[g.liste.length - 1]);
  const out = [texte(40, 34, titre, { couleur: T.encre, taille: 18, poids: 650 }), texte(40, 56, sousTitre, { couleur: T.secondaire, taille: 13 })];
  liste.forEach(({ c, nom, ligneBas }, k) => {
    const y0 = 96 + k * ligne, hauteur = ligne - 40, { s, i } = pasEchantillons(c, 4);
    const bandes = [];
    if (c.ligneDroite) bandes.push({ debut: ((c.ligneDroite.debut % c.longueur) + c.longueur) % c.longueur, fin: c.longueur }, { debut: 0, fin: c.ligneDroite.fin });
    if (c.tunnel) bandes.push({ debut: c.tunnel.debut, fin: c.tunnel.fin, couleur: T.bande2 });
    const largeurC = largeur * c.longueur / Lmax;
    out.push(texte(40, y0 + 24, nom, { couleur: T.encre, taille: 14, poids: 600 }));
    [].concat(ligneBas).forEach((t, j) => out.push(texte(40, y0 + 44 + 17 * j, t, { couleur: T.secondaire, taille: 12 })));
    out.push(panneau({ x0, y0, largeur: largeurC, hauteur, sMax: c.longueur, yMin, yMax, titre: '', unite: '', series: [{ s, v: i.map(j => c.y[j]), couleur: T.serie1 }], bandes, zero: true,
      axeX: k === liste.length - 1 }));
  });
  out.push(texte(40, H - 8, 'Altitude de l’axe en mètres, même échelle pour les sept circuits ; abscisse en mètres depuis la ligne. Fond gris : ligne droite des stands ; gris soutenu : tunnel.', { couleur: T.discret, taille: 11 }));
  return enveloppe(W, H, out.join('\n'));
}

// Avant / après du relief (prototype 22A) : altitude, pente, charge verticale à la vitesse de référence.
export function svgAvantApres(c, avant, apres, { titre, sousTitre, chargeAvant, chargeApres, noteBas }) {
  const W = 1400, H = 930, x0 = 86, largeur = W - x0 - 40, L = c.longueur, { s, i } = pasEchantillons(c, 4);
  const bandes = [];
  if (c.ligneDroite) bandes.push({ debut: ((c.ligneDroite.debut % L) + L) % L, fin: L }, { debut: 0, fin: c.ligneDroite.fin });
  if (c.tunnel) bandes.push({ debut: c.tunnel.debut, fin: c.tunnel.fin, couleur: T.bande2 });
  const [aMin, aMax] = borne([...avant.y, ...apres.y], .1, 2);
  const pMax = Math.max(8, Math.ceil(Math.max(...Array.from(apres.pente, Math.abs)) * 100 + 1));
  const qMax = Math.max(1, Math.ceil(Math.max(...chargeApres.map(Math.abs), ...chargeAvant.map(Math.abs)) * 10 + 1) / 10);
  const out = [
    texte(x0, 34, titre, { couleur: T.encre, taille: 18, poids: 650 }),
    texte(x0, 56, sousTitre, { couleur: T.secondaire, taille: 13 }),
    legende(x0, 82, [{ couleur: T.serie1, texte: 'relief actuel' }, { couleur: T.serie2, texte: 'relief proposé (22A)' }]),
    panneau({ x0, y0: 122, largeur, hauteur: 300, sMax: L, yMin: aMin, yMax: aMax, titre: 'Altitude de l’axe', unite: 'm', bandes, zero: true,
      series: [{ s, v: i.map(k => avant.y[k]), couleur: T.serie1 }, { s, v: i.map(k => apres.y[k]), couleur: T.serie2 }] }),
    panneau({ x0, y0: 470, largeur, hauteur: 160, sMax: L, yMin: -pMax, yMax: pMax, titre: 'Pente dans le sens de la course', unite: '%', bandes, zero: true,
      series: [{ s, v: i.map(k => avant.pente[k] * 100), couleur: T.serie1 }, { s, v: i.map(k => apres.pente[k] * 100), couleur: T.serie2 }] }),
    panneau({ x0, y0: 680, largeur, hauteur: 190, sMax: L, yMin: -qMax, yMax: qMax, titre: 'Charge verticale ajoutée à la vitesse de référence (v²/R vertical ; < 0 : la voiture s’allège)', unite: 'g', bandes, zero: true, decimales: 1,
      series: [{ s, v: i.map(k => chargeAvant[k]), couleur: T.serie1 }, { s, v: i.map(k => chargeApres[k]), couleur: T.serie2 }], axeX: true }),
  ];
  if (noteBas) out.push(texte(x0, H - 6, noteBas, { couleur: T.discret, taille: 11 }));
  return enveloppe(W, H, out.join('\n'));
}

// Rendu PNG par Chrome sans interface, dans un profil jetable (le Chrome de l'utilisateur n'est pas touché).
export function rendrePng(svgChemin, pngChemin, largeur, hauteur) {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!existsSync(chrome)) return false;
  const profil = mkdtempSync(path.join(tmpdir(), 'bitume-svg-'));
  try {
    const r = spawnSync(chrome, ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profil,
      '--force-device-scale-factor=1', '--window-size=' + largeur + ',' + hauteur, '--screenshot=' + path.resolve(pngChemin), 'file://' + path.resolve(svgChemin)], { timeout: 60000 });
    return r.status === 0 && existsSync(pngChemin);
  } finally { rmSync(profil, { recursive: true, force: true }); }
}

export function ecrireSvgEtPng(chemin, svg) {
  writeFileSync(chemin, svg);
  const m = svg.match(/width="(\d+)" height="(\d+)"/);
  return rendrePng(chemin, chemin.replace(/\.svg$/, '.png'), +m[1], +m[2]);
}
