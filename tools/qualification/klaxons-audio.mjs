#!/usr/bin/env node
// Export des vrais tampons du jeu pour écoute ; aucun son importé ni navigateur nécessaire.
// node tools/qualification/klaxons-audio.mjs --sortie /chemin/qualification-audio
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--sortie', '--frequence'].includes(args[i]) || !args[i + 1] || options[args[i]] !== undefined)
    throw new Error('Usage : klaxons-audio.mjs --sortie DOSSIER [--frequence 48000]');
  options[args[i]] = args[i + 1];
}
if (!options['--sortie']) throw new Error('--sortie DOSSIER requis');
const sortie = path.resolve(options['--sortie']), sr = Number(options['--frequence'] || 48000);
const source = fileURLToPath(new URL('../../src/son.js', import.meta.url));
const empreinte = b => createHash('sha256').update(b).digest('hex');
const sourceAvant = readFileSync(source);
await import(source);
const S = globalThis.BITUME.son, tampons = S.synthKlaxons(sr);
if (empreinte(readFileSync(source)) !== empreinte(sourceAvant)) throw new Error('Source modifiée pendant l’export');

function wav(d) {
  const b = Buffer.alloc(44 + d.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(d.length * 2, 40);
  for (let i = 0; i < d.length; i++) {
    const v = d[i];
    if (!Number.isFinite(v) || Math.abs(v) > 1) throw new Error('Échantillon audio invalide');
    b.writeInt16LE(Math.round(v * (v < 0 ? 32768 : 32767)), 44 + i * 2);
  }
  return b;
}

mkdirSync(sortie, { recursive: true });
const sons = [];
for (const type of S.KLAXONS) {
  const d = tampons[type], fichier = type + '.wav', b = wav(d);
  let crete = 0, energie = 0;
  for (const x of d) { crete = Math.max(crete, Math.abs(x)); energie += x * x; }
  writeFileSync(path.join(sortie, fichier), b);
  sons.push({ type, fichier, duree_s: d.length / sr, echantillons: d.length, crete, rms: Math.sqrt(energie / d.length),
    sha256: empreinte(b), tampon_float32_sha256: empreinte(Buffer.from(d.buffer, d.byteOffset, d.byteLength)) });
}
const rapport = { schema: 1, source: 'src/son.js', source_sha256: empreinte(sourceAvant), frequence_hz: sr,
  format: 'WAV PCM 16 bits mono', appel: 'BITUME.son.synthKlaxons(frequence_hz)',
  ecoute_effectuee: false, gain_lecture_jeu: S.NIVEAU_KLAXON,
  limites: ['Tampons seuls avant gain, spatialisation et mixage du jeu ; écoute à effectuer.',
    'Les mesures de crête et de spectre ne prouvent pas le réalisme perçu.'], sons };
writeFileSync(path.join(sortie, 'rapport.json'), JSON.stringify(rapport, null, 2) + '\n');
const titres = { classique: 'Avertisseur classique à deux trompes', ancien: 'Klaxon mécanique ancien', mariage: 'Trompes de mariage' };
writeFileSync(path.join(sortie, 'index.html'), `<!doctype html><html lang="fr"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>BITUME — écoute des klaxons</title>
<style>body{font:18px system-ui;max-width:48rem;margin:3rem auto;padding:0 1rem;color:#eee;background:#182029}section{margin:2rem 0}audio{width:100%}small{color:#b8c6d3}</style>
<h1>Écoute des klaxons BITUME</h1><p>Les trois sons sont générés par le code du jeu. Lancez chaque lecteur pour comparer leurs timbres.</p>
<p><small>Tampons seuls avant le volume et la spatialisation de la course. Aucune lecture automatique.</small></p>
${sons.map(s => `<section><h2>${titres[s.type]}</h2><audio controls preload="none" src="${s.fichier}"></audio><p><a href="${s.fichier}">Télécharger le WAV</a> · ${s.duree_s.toFixed(2)} s</p></section>`).join('\n')}
<p><a href="rapport.json">Provenance et mesures</a></p></html>\n`);
console.log(JSON.stringify({ sortie, source_sha256: rapport.source_sha256, sons: sons.map(({ type, fichier, duree_s }) => ({ type, fichier, duree_s })), ecoute_effectuee: false }));
