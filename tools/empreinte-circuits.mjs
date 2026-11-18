/*
  node tools/empreinte-circuits.mjs [--src DOSSIER] [--circuits id1,id2] [--qualites high,medium,low] [--sortie FICHIER.json]
  node tools/empreinte-circuits.mjs --comparer A.json B.json
*/
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

// Catalogue écrit en dur (le même que src/jeu.js, sans route-des-cimes)
const CATALOGUE = [
  { id: 'val-brule', nom: 'Val-Brûlé', lieu: 'Forêt', theme: 'foret', graine: 11, longueur: 4200 },
  { id: 'port-sable', nom: 'Port-Sable', lieu: 'Bord de mer', theme: 'cote', graine: 29, longueur: 3600 },
  { id: 'haut-col', nom: 'Haut-Col', lieu: 'Montagne', theme: 'montagne', graine: 47, longueur: 5200 },
  { id: 'lande-noire', nom: 'Lande-Noire', lieu: 'Islande · plateau volcanique', theme: 'islande', graine: 83, longueur: 4600 },
  { id: 'roche-fauve', nom: 'Roche-Fauve', lieu: 'Afrique · hauts plateaux d’ocre', theme: 'desert', graine: 107, longueur: 4800 },
  { id: 'brume-de-jade', nom: 'Brume-de-Jade', lieu: 'Asie · pics calcaires et terrasses', theme: 'asie', graine: 131, longueur: 5000 },
  { id: 'cap-sequoia', nom: 'Cap-Séquoia', lieu: 'États-Unis · falaises du Pacifique', theme: 'pacifique', graine: 157, longueur: 5200 }
];

function parseArgs(argv) {
  const args = { src: null, circuits: null, qualites: null, sortie: null, comparer: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--src' && i + 1 < argv.length) args.src = argv[++i];
    else if (arg === '--circuits' && i + 1 < argv.length) args.circuits = argv[++i];
    else if (arg === '--qualites' && i + 1 < argv.length) args.qualites = argv[++i];
    else if (arg === '--sortie' && i + 1 < argv.length) args.sortie = argv[++i];
    else if (arg === '--comparer' && i + 2 < argv.length) args.comparer = [argv[++i], argv[++i]];
  }
  return args;
}

function chargerSources(src) {
  const fichiers = ['circuit.js', 'partitions.js', 'botanique.js', 'ecologie.js', 'saisons.js', 'vegetation.js', 'carene.js', 'decor.js'];
  for (const nom of fichiers) {
    const chemin = path.join(src, nom);
    if (existsSync(chemin)) require(chemin);
  }
  return globalThis.BITUME;
}

function empreinte(objet) {
  const h = createHash('sha256');
  function visiter(v) {
    if (ArrayBuffer.isView(v)) {
      h.update(v.constructor.name);
      h.update(Buffer.from(v.buffer, v.byteOffset, v.byteLength));
    } else if (v && typeof v === 'object') {
      h.update(Array.isArray(v) ? '[' : '{');
      for (const k of Object.keys(v)) {
        h.update(k);
        visiter(v[k]);
      }
      h.update('}');
    } else if (typeof v !== 'function') {
      h.update(typeof v + ':' + String(v));
    }
  }
  visiter(objet);
  return h.digest('hex');
}

function calculerEmpreinte(src, idsCircuits, qualites) {
  const B = chargerSources(src);
  const circuits = {};
  let premierCircuit = true;

  for (const k of CATALOGUE) {
    if (!idsCircuits.includes(k.id)) continue;

    const c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom });
    const traceObjet = {
      x: c.x, y: c.y, z: c.z, cap: c.cap, courbure: c.courbure, pente: c.pente,
      devers: c.devers, ligne: c.ligne, vitesse: c.vitesse, limiteG: c.limiteG,
      limiteD: c.limiteD, vibreur: c.vibreur, longueur: c.longueur, n: c.n,
      depart: c.depart, ligneDroite: c.ligneDroite, secteurs: c.secteurs,
      tunnel: c.tunnel, stands: c.stands
    };
    const trace = empreinte(traceObjet);

    const decor = {};
    for (const q of qualites) {
      const d = B.decor.construire(c, { qualite: q, saison: 'ete' });

      const nappes = empreinte(d.nappes.map(n => [n.sommets, n.indices]));
      const lots = empreinte(d.lots.map(l => [l.objets, l.loin]));
      const obstacles = empreinte(d.obstacles);
      const arbres = empreinte(d.arbres);
      const autres = empreinte({
        atmosphere: d.atmosphere, portique: d.portique, tunnelLampes: d.tunnelLampes,
        niveauEau: d.niveauEau, enceinte: d.enceinte
      });

      const triangles = d.nappes.reduce((n, v) => n + v.indices.length / 3, 0);
      const objets = d.lots.reduce((n, l) => n + l.objets.length, 0);

      const comptes = {
        nappes: d.nappes.length,
        triangles: triangles,
        lots: d.lots.length,
        objets: objets,
        arbres: d.arbres.length,
        obstacles: d.obstacles.length
      };

      if (premierCircuit && q === qualites[0]) {
        const d2 = B.decor.construire(c, { qualite: q, saison: 'ete' });
        const nappes2 = empreinte(d2.nappes.map(n => [n.sommets, n.indices]));
        const lots2 = empreinte(d2.lots.map(l => [l.objets, l.loin]));
        if (nappes !== nappes2 || lots !== lots2) {
          console.error('décor non déterministe');
          process.exit(2);
        }
      }

      decor[q] = { nappes, lots, obstacles, arbres, autres, comptes };
    }

    premierCircuit = false;
    circuits[k.id] = { nom: k.nom, trace, decor };
  }

  return { src: path.resolve(src), qualites, circuits };
}

function comparer(fichierA, fichierB) {
  const A = JSON.parse(readFileSync(fichierA, 'utf8'));
  const B = JSON.parse(readFileSync(fichierB, 'utf8'));
  let diff = false;

  for (const id in A.circuits) {
    if (!B.circuits[id]) {
      console.log('DIFFÉRENT  ' + id + ' : manquant');
      diff = true;
      continue;
    }
    const ca = A.circuits[id];
    const cb = B.circuits[id];
    const diffs = [];

    if (ca.trace !== cb.trace) diffs.push('trace');

    for (const q in ca.decor) {
      if (!cb.decor[q]) {
        diffs.push(q + '.manquant');
        continue;
      }
      const da = ca.decor[q];
      const db = cb.decor[q];
      if (da.nappes !== db.nappes) diffs.push(q + '.nappes');
      if (da.lots !== db.lots) diffs.push(q + '.lots');
      if (da.obstacles !== db.obstacles) diffs.push(q + '.obstacles');
      if (da.arbres !== db.arbres) diffs.push(q + '.arbres');
      if (da.autres !== db.autres) diffs.push(q + '.autres');
    }

    if (diffs.length > 0) {
      console.log('DIFFÉRENT  ' + id + ' : ' + diffs.join(', '));
      diff = true;
    } else {
      console.log('identique  ' + id);
    }
  }

  process.exit(diff ? 1 : 0);
}

const args = parseArgs(process.argv.slice(2));

if (args.comparer) {
  comparer(args.comparer[0], args.comparer[1]);
} else {
  const src = args.src || path.resolve(fileURLToPath(new URL('../src/', import.meta.url)));
  const idsCircuits = args.circuits ? args.circuits.split(',') : CATALOGUE.map(c => c.id);
  const qualites = args.qualites ? args.qualites.split(',') : ['high', 'medium', 'low'];

  const resultat = calculerEmpreinte(src, idsCircuits, qualites);
  const json = JSON.stringify(resultat, null, 1);
  console.log(json);

  if (args.sortie) {
    writeFileSync(args.sortie, json + '\n');
  }
}
