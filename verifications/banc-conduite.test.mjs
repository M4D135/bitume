// Banc de conduite (tools/banc-conduite.mjs). Ses comparaisons avant/après ne prouvent quelque chose que s'il reste
// déterministe, plausible, sensible au modèle et fidèle aux chaînes de commande du jeu : c'est ce qui est vérifié ici,
// sur le sous-ensemble rapide (--court).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executer, charger, essais, CONDITIONS, ENTREES } from '../tools/banc-conduite.mjs';

const ici = path.dirname(fileURLToPath(import.meta.url));
let nbOk = 0;
function verifier(nom, f) {
  try { f(); console.log('ok  ' + nom); nbOk++; }
  catch (e) { console.error('FAIL ' + nom + ' : ' + e.message); process.exit(1); }
}

const base = executer({ court: true }), R = base.resultats;

verifier('deux passages rendent les mêmes nombres au bit près', () => {
  const encore = executer({ court: true });
  assert.equal(encore.empreinte, base.empreinte);
  assert.equal(encore.empreinteSources, base.empreinteSources);
});

verifier('ordres de grandeur d’une monoplace', () => {
  const d = R.ligneDroite.depart.sec, f = R.ligneDroite.freinages['200-0'].sec, v = R.virages.etablis['120'];
  assert(d.t_kmh['100'] > 2 && d.t_kmh['100'] < 3.5, '0-100 km/h en ' + d.t_kmh['100'] + ' s');
  assert(f.distance_m > 50 && f.distance_m < 120, '200-0 km/h en ' + f.distance_m + ' m');
  assert(v.ayLimite_g > 1.5 && v.ayLimite_g < 3.2, 'R 120 tenu à ' + v.ayLimite_g + ' g');
  const e = R.echelon['100']['physique mi'];
  assert(e.lacetT90_ms > 40 && e.lacetT90_ms < 400, 'lacet à 90 % en ' + e.lacetT90_ms + ' ms');
  const dr = R.derive.tenue['120'].manette;
  assert(dr.turbo && dr.turbo.niveau === 3 && !dr.teteAQueue, 'dérive R 120 à la manette : ' + JSON.stringify(dr.turbo));
  assert(R.herbe['100'].sec.physique.tempsPerdu_s >= 0, 'l’herbe ne fait pas gagner de temps');
});

verifier('plein gaz : clavier, manette et voiture seule donnent le même départ', () => {
  const ctx = charger(), t = en => essais.depart(ctx, CONDITIONS.sec, { entree: en, duree: 4 }).t_kmh['100'];
  assert.equal(t('clavier'), t('manette'));
  assert.equal(t('clavier'), t('physique'));
});

verifier('le banc voit une variante du modèle (freinMax 0,92 → 0,80)', () => {
  const v = executer({ court: true, reglages: { freinMax: 0.8 } });
  assert.notEqual(v.empreinteSources, base.empreinteSources);
  assert.notEqual(v.empreinte, base.empreinte);
  const avant = R.ligneDroite.freinages['200-0'].sec.distance_m, apres = v.resultats.ligneDroite.freinages['200-0'].sec.distance_m;
  assert(apres > avant + 2, `200-0 km/h : ${avant} m puis ${apres} m`);
});

verifier('les chaînes de commande du banc suivent src/jeu.js', () => {
  // si ces lignes changent dans le jeu, ENTREES (tools/banc-conduite.mjs) doit changer avec elles
  const jeu = readFileSync(path.join(ici, '..', 'src', 'jeu.js'), 'utf8');
  assert.match(jeu, /guidage: analogique \? 0 : \.15/, 'guidage : 0,15 au clavier, nul dès qu’un appareil analogique sert');
  assert.equal(ENTREES.clavier.guidage, .15);
  for (const e of ['manette', 'souris']) assert.equal(ENTREES[e].guidage, 0);
  const aide = /const DEFAUT = \{[^}]*\baide: ([\d.]+)/.exec(jeu);
  assert(aide, 'aide par défaut introuvable');
  for (const e of ['manette', 'clavier', 'souris']) assert.equal(ENTREES[e].aide, +aide[1]);
  assert.match(jeu, /if \(appuieSur\(0, 'gaz'\)\) gaz = 1;/, 'gaz du clavier tout ou rien');
  assert.match(jeu, /gaz = Math\.max\(gaz, doigt\.gaz \? 1 : 0\)/, 'gaz du doigt tout ou rien');
  assert.match(jeu, /pad\.gaz = b\(7\); pad\.frein = b\(6\)/, 'gâchettes progressives');
  assert.equal(ENTREES.clavier.pedales, 'touches'); assert.equal(ENTREES.souris.pedales, 'touches'); assert.equal(ENTREES.manette.pedales, 'continu');
});

console.log(nbOk + ' vérifications réussies');
process.exit(0);
