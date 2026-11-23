// Outils de contrôle des captures, hors du jeu. Code original : aucun traitement de Cat Garden n'est importé.
// PNG RGB/RGBA 8 bits non entrelacés (format des captures Chrome), sans dépendance Node tierce.
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

export function decoderPng(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    throw new Error('Capture PNG attendue');
  let width = 0, height = 0, canaux = 0; const blocs = [];
  for (let p = 8; p + 12 <= buffer.length;) {
    const n = buffer.readUInt32BE(p), type = buffer.toString('ascii', p + 4, p + 8);
    if (p + n + 12 > buffer.length) throw new Error('PNG tronqué');
    if (type === 'IHDR') {
      if (n !== 13) throw new Error('Entête PNG invalide');
      width = buffer.readUInt32BE(p + 8); height = buffer.readUInt32BE(p + 12);
      const profondeur = buffer[p + 16], couleur = buffer[p + 17];
      if (profondeur !== 8 || ![2, 6].includes(couleur) || buffer[p + 18] || buffer[p + 19] || buffer[p + 20])
        throw new Error('PNG attendu : RGB/RGBA 8 bits, sans entrelacement');
      canaux = couleur === 6 ? 4 : 3;
      if (!width || !height || width * height > 64 * 1024 * 1024) throw new Error('Dimensions PNG excessives ou vides');
    } else if (type === 'IDAT') blocs.push(buffer.subarray(p + 8, p + 8 + n));
    p += n + 12;
    if (type === 'IEND') break;
  }
  if (!canaux || !blocs.length) throw new Error('PNG sans image');
  const ligne = width * canaux, brut = inflateSync(Buffer.concat(blocs), { maxOutputLength: height * (ligne + 1) });
  if (brut.length !== height * (ligne + 1)) throw new Error('Taille des pixels PNG invalide');
  const pixels = Buffer.alloc(width * height * canaux);
  for (let y = 0; y < height; y++) {
    const f = brut[y * (ligne + 1)];
    if (f > 4) throw new Error('Filtre PNG inconnu');
    for (let x = 0; x < ligne; x++) {
      const i = y * ligne + x, a = x >= canaux ? pixels[i - canaux] : 0;
      const b = y ? pixels[i - ligne] : 0, c = y && x >= canaux ? pixels[i - ligne - canaux] : 0;
      let prediction = 0;
      if (f === 1) prediction = a;
      else if (f === 2) prediction = b;
      else if (f === 3) prediction = (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        prediction = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[i] = (brut[y * (ligne + 1) + x + 1] + prediction) & 255;
    }
  }
  return { width, height, canaux, pixels };
}

function rectangle(image, zone) {
  const x = Math.max(0, Math.min(image.width - 1, Math.floor(zone?.x || 0)));
  const y = Math.max(0, Math.min(image.height - 1, Math.floor(zone?.y || 0)));
  const width = Math.max(1, Math.min(image.width - x, Math.ceil(zone?.width || image.width)));
  const height = Math.max(1, Math.min(image.height - y, Math.ceil(zone?.height || image.height)));
  return { x, y, width, height };
}

// La luminance est un indicateur d'image encodée (0..1), pas une mesure photométrique de scène HDR.
export function mesurerImage(image, zone, colonnes = 12, lignes = 8) {
  const r = rectangle(image, zone), somme = new Float64Array(colonnes * lignes), compte = new Uint32Array(somme.length);
  const rgb = new Float64Array(somme.length * 3), empreinte = createHash('sha256');
  let total = 0, sombres = 0;
  for (let y = 0; y < r.height; y++) {
    const ligne = ((r.y + y) * image.width + r.x) * image.canaux;
    empreinte.update(image.pixels.subarray(ligne, ligne + r.width * image.canaux));
    for (let x = 0; x < r.width; x++) {
      const i = ligne + x * image.canaux, p = image.pixels;
      const l = (.2126 * p[i] + .7152 * p[i + 1] + .0722 * p[i + 2]) / 255;
      const b = Math.floor(y * lignes / r.height) * colonnes + Math.floor(x * colonnes / r.width);
      somme[b] += l; compte[b]++; total += l;
      if (l < .025) sombres++;
      for (let c = 0; c < 3; c++) rgb[3 * b + c] += p[i + c] / 255;
    }
  }
  return {
    rectangle: r, colonnes, lignes,
    empreinte: empreinte.digest('hex'), luminance: total / (r.width * r.height), noir: sombres / (r.width * r.height),
    blocs: Array.from(somme, (s, i) => s / Math.max(1, compte[i])),
    couleurs: Array.from(rgb, (s, i) => s / Math.max(1, compte[Math.floor(i / 3)]))
  };
}

export function difference(a, b) {
  if (!a || !b || a.length !== b.length || !a.length) return null;
  let somme = 0, max = 0;
  for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); somme += d; max = Math.max(max, d); }
  return { moyenne: somme / a.length, max };
}

// Les seuils choisissent des passages à inspecter. Un flash, une ombre ou une plante proche peuvent être légitimes.
export function analyserSequence(images) {
  const alertes = [];
  for (let i = 0; i < images.length; i++) {
    const courante = images[i], precedente = images[i - 1], suivante = images[i + 1];
    for (const [vue, m] of Object.entries(courante.vues || {})) {
      const a = precedente?.vues?.[vue], b = suivante?.vues?.[vue];
      if (m.noir > .97 && m.luminance < .025) alertes.push({ image: i, vue, type: 'noire', valeur: m.noir });
      if (a?.empreinte === m.empreinte) alertes.push({ image: i, vue, type: 'identique', valeur: 0 });
      if (!a || !b || a.blocs.length !== m.blocs.length || b.blocs.length !== m.blocs.length) continue;
      const suspects = [];
      for (let k = 0; k < m.blocs.length; k++) {
        const voisin = (a.blocs[k] + b.blocs[k]) / 2;
        if (Math.abs(a.blocs[k] - b.blocs[k]) < .04 && Math.abs(m.blocs[k] - voisin) > .18)
          suspects.push({ x: k % m.colonnes, y: Math.floor(k / m.colonnes), ecart: +(m.blocs[k] - voisin).toFixed(4) });
      }
      if (suspects.length) alertes.push({ image: i, vue, type: 'blocs-fugitifs', blocs: suspects });
    }
  }
  return alertes;
}

export function comparerSequences(reference, candidate) {
  const differences = [], ecarts = [];
  // La signature exclut commit/build pour permettre avant/après, mais inclut tous les paramètres de capture.
  for (const k of ['scenario', 'parametres', 'horloge'])
    if (JSON.stringify(reference[k]) !== JSON.stringify(candidate[k])) ecarts.push(k);
  const reglagesEffectifs = r => {
    if (!r.referenceJeu) return null;
    const { decor, ...reglages } = r.referenceJeu;
    return reglages;
  };
  if (JSON.stringify(reglagesEffectifs(reference)) !== JSON.stringify(reglagesEffectifs(candidate))) ecarts.push('referenceJeu');
  for (const k of ['navigateur', 'gpu', 'resolution', 'webgpu', 'backend', 'gpuModeste', 'physx'])
    if (JSON.stringify(reference.environnement?.[k]) !== JSON.stringify(candidate.environnement?.[k])) ecarts.push('environnement.' + k);
  if (reference.images?.length !== candidate.images?.length) ecarts.push('nombre-images');
  if (ecarts.length) return { comparable: false, ecarts, differences };
  for (let i = 0; i < candidate.images.length; i++) {
    const avant = reference.images[i], apres = candidate.images[i];
    if (JSON.stringify(Object.keys(avant.vues || {}).sort()) !== JSON.stringify(Object.keys(apres.vues || {}).sort()))
      ecarts.push(`image-${i}.vues`);
    if (avant.temps !== apres.temps) ecarts.push(`image-${i}.temps`);
    const pilotesAvant = avant.etat?.joueurs || [], pilotesApres = apres.etat?.joueurs || [];
    if (pilotesAvant.length !== pilotesApres.length || pilotesAvant.some((v, k) =>
      ['id', 's', 'd', 'v'].some(n => Math.abs((v[n] ?? 0) - (pilotesApres[k]?.[n] ?? 0)) > 1e-5)))
      ecarts.push(`image-${i}.trajectoire`);
    for (const [vue, m] of Object.entries(candidate.images[i].vues || {})) {
      const ancien = reference.images[i].vues?.[vue];
      if (!ancien || JSON.stringify(ancien.rectangle) !== JSON.stringify(m.rectangle)) {
        ecarts.push(`image-${i}.${vue}.rectangle`); continue;
      }
      differences.push({ image: i, vue, identique: m.empreinte === ancien.empreinte,
        luminance: difference(ancien.blocs, m.blocs), couleur: difference(ancien.couleurs, m.couleurs) });
    }
  }
  return { comparable: !ecarts.length, ecarts, differences };
}
