#!/usr/bin/env node
/** Marseille 15A/15B : conservation et inventaire hors réseau, sans module de jeu. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const DOSSIER = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/references/marseille-2026');
const lire = p => JSON.parse(readFileSync(p, 'utf8'));
export const sha256 = data => createHash('sha256').update(data).digest('hex');
export const blobGit = data => createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
const arrondi = (x, n = 6) => Number(x.toFixed(n));
const effectifs = valeurs => Object.fromEntries([...new Set(valeurs)].sort().map(k => [k, valeurs.filter(v => v === k).length]));
// Une ligne par enregistrement dans les grandes collections : diff lisible, nombres inchangés.
function encoder(value, niveau = 0) {
  const pad = '  '.repeat(niveau), suite = pad + '  ';
  if (Array.isArray(value)) {
    if (value.every(v => v === null || typeof v !== 'object')) return JSON.stringify(value);
    return '[\n' + value.map(v => suite + JSON.stringify(v)).join(',\n') + '\n' + pad + ']';
  }
  if (value && typeof value === 'object') return '{\n' + Object.entries(value).map(([k, v]) => suite + JSON.stringify(k) + ': ' + encoder(v, niveau + 1)).join(',\n') + '\n' + pad + '}';
  return JSON.stringify(value);
}
const json = obj => encoder(obj) + '\n';

export function verifierSources(dossier = DOSSIER) {
  const manifeste = lire(join(dossier, 'sources.json'));
  for (const s of manifeste.fichiers) {
    const data = readFileSync(join(dossier, s.fichier));
    assert.equal(data.length, s.octets, `Taille source altérée : ${s.fichier}`);
    assert.equal(sha256(data), s.sha256, `Empreinte source altérée : ${s.fichier}`);
    if (s.git_blob) assert.equal(blobGit(data), s.git_blob, `Blob Git source altéré : ${s.fichier}`);
  }
  return manifeste;
}

export function decoderCoeur(texte) {
  // Source exacte vérifiée avant exécution. Le contexte n'expose ni réseau, ni disque, ni require.
  const contexte = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(texte, contexte, { timeout: 10000 });
  const plan = contexte.PDR.plans.marseille;
  // JSON.stringify conserve les valeurs Float32 exactes, sans nouvel arrondi au décimètre.
  return JSON.parse(JSON.stringify(plan, (_, valeur) => ArrayBuffer.isView(valeur) ? Array.from(valeur) : valeur));
}

/** Repère horizontal linéaire WGS84, origine et axes déclarés par la source EMPRISE. */
export function projection(origine) {
  const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), rad = Math.PI / 180;
  const phi = origine.lat * rad, w = Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const N = a / w, M = a * (1 - e2) / w ** 3;
  const kx = rad * N * Math.cos(phi), kz = rad * M;
  return {
    origine, kx, kz,
    convertir: (lon, lat) => ({ x: (lon - origine.lon) * kx, z: -(lat - origine.lat) * kz }),
    inverse: (x, z) => ({ lon: origine.lon + x / kx, lat: origine.lat - z / kz }),
  };
}

export function verifierGrille(grille, requete, acquisition) {
  const { width, height, lon0, lon1, lat0, lat1 } = acquisition.requested_grid;
  const points = grille.elevations, lon = requete.lon.split('|').map(Number), lat = requete.lat.split('|').map(Number);
  assert.equal(requete.resource, acquisition.resource, 'Ressource de la requête');
  assert.ok(requete.measures === false || requete.measures === 'false', 'Requête sans détail des mesures');
  assert.ok(requete.zonly === false || requete.zonly === 'false', 'Réponse étendue');
  assert.equal(points.length, width * height, 'Dimensions de la grille');
  assert.equal(lon.length, points.length);
  assert.equal(lat.length, points.length);
  for (let i = 0; i < points.length; i++) {
    const p = points[i], c = i % width, r = Math.floor(i / width);
    assert.ok([p.lon, p.lat, p.z].every(Number.isFinite), `Valeur non finie au point ${i}`);
    // L'API peut arrondir les coordonnées décimales ; tolérance angulaire < 0,00002 m ici.
    assert.ok(Math.abs(p.lon - lon[i]) < 1e-10 && Math.abs(p.lat - lat[i]) < 1e-10, `Correspondance requête ${i}`);
    assert.ok(Math.abs(p.lon - (lon0 + c * (lon1 - lon0) / (width - 1))) < 1e-10, `Colonne ${i}`);
    assert.ok(Math.abs(p.lat - (lat0 + r * (lat1 - lat0) / (height - 1))) < 1e-10, `Ligne ${i}`);
  }
  return points;
}

function bornes(points) {
  const x = [], z = [];
  for (let i = 0; i < points.length; i += 2) { x.push(points[i]); z.push(points[i + 1]); }
  return { x0: Math.min(...x), z0: Math.min(...z), x1: Math.max(...x), z1: Math.max(...z) };
}
function longueur(points) {
  let l = 0;
  for (let i = 2; i < points.length; i += 2) l += Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]);
  return l;
}
const reference = (type, i) => ({ id: `coeur:${type}:${String(i).padStart(4, '0')}`, source: `coeur.json#/donnees/${type}/${i}` });

export function preparer(dossier = DOSSIER) {
  const manifeste = verifierSources(dossier);
  const source = manifeste.fichiers.find(s => s.id === 'emprise-marseille');
  const coeur = decoderCoeur(readFileSync(join(dossier, source.fichier), 'utf8'));
  assert.equal(coeur.empreinte, manifeste.emprise.empreinte_fnv1a_decodeur);
  const grilleBrute = lire(join(dossier, 'sources/ign-grille.json'));
  const requete = lire(join(dossier, 'sources/ign-grille-requete.json'));
  const acquisition = lire(join(dossier, 'sources/ign-grille-acquisition.json'));
  assert.equal(sha256(readFileSync(join(dossier, 'sources/ign-grille.json'))), acquisition.sha256);
  const points = verifierGrille(grilleBrute, requete, acquisition);
  const ressource = lire(join(dossier, 'sources/ign-ressource.json'));
  const proj = projection(coeur.centre), cfg = acquisition.requested_grid;
  const echantillons = points.map((p, i) => {
    const { x, z } = proj.convertir(p.lon, p.lat);
    return { index: i, colonne: i % cfg.width, ligne: Math.floor(i / cfg.width), lon: p.lon, lat: p.lat,
      x: arrondi(x), z: arrondi(z), altitude_api_m: p.z === -99999 ? null : p.z, acc_api: p.acc };
  });
  const pas = { est_m: arrondi((cfg.lon1 - cfg.lon0) / (cfg.width - 1) * proj.kx), nord_m: arrondi((cfg.lat1 - cfg.lat0) / (cfg.height - 1) * proj.kz) };
  const min = proj.convertir(cfg.lon0, cfg.lat1), max = proj.convertir(cfg.lon1, cfg.lat0);
  const empriseGrille = { x0: arrondi(min.x), z0: arrondi(min.z), x1: arrondi(max.x), z1: arrondi(max.z) };
  const rues = coeur.rues.map((r, i) => ({ ...reference('rues', i), nom: r.nom, classe: r.classe, sousClasse: r.sousClasse,
    pont_source: r.pont, couche_source: r.niveau, sens_source: r.sens, sommets: r.points.length / 2,
    longueur_polyligne_m: arrondi(longueur(r.points)), bornes: bornes(r.points), largeur_mesuree_m: null,
    profil_altimetrique_m: null, devers_mesure: null, niveaux_et_connexions_valides: false }));
  const batiments = coeur.batiments.map((b, i) => ({ ...reference('batiments', i), bornes: bornes(b.points), sommets_exterieurs: b.points.length / 2,
    trous: b.trous.length, hauteur_fournisseur_m: b.hauteur, base_fournisseur_m: b.base, connue_source: b.connue,
    contour_source: b.contour, altitude_pied_m: null, hauteur_verifiee_sur_terrain_m: null, nom_source: null }));
  const reperes = coeur.reperes.map((r, i) => ({ ...reference('reperes', i), ...r, altitude_sol_m: null }));
  const lointains = coeur.lointain.reperes.map((r, i) => ({ id: `lointain:reperes:${String(i).padStart(4, '0')}`,
    source: `coeur.json#/donnees/lointain/reperes/${i}`, ...r, altitude_sol_m: null,
    couvert_par_grille: r.x >= min.x && r.x <= max.x && r.z >= min.z && r.z <= max.z }));
  const sommets = coeur.lointain.sommets.map((r, i) => ({ id: `lointain:sommets:${String(i).padStart(4, '0')}`,
    source: `coeur.json#/donnees/lointain/sommets/${i}`, nom: r.nom, x: r.x, z: r.z,
    altitude_annotee_source_m: r.altitude, datum_confirme: null, altitude_grille_m: null,
    interpretation: 'annotation cartographique source ; ne constitue pas une validation du MNT' }));
  const espacesNiveaux = coeur.espaces.flatMap((e, i) => ['quai', 'pont', 'jetee'].includes(e.sorte)
    ? [{ ...reference('espaces', i), sorte: e.sorte, nom: e.nom, bornes: bornes(e.points), altitude_surface_m: null, connexion_a_une_voie_validee: false }] : []);
  const noms = [...new Set(rues.map(r => r.nom).filter(Boolean))].sort();
  const ruesNommees = noms.map(nom => { const rs = rues.filter(r => r.nom === nom); return { nom, troncons: rs.map(r => r.id), longueur_cumulee_geometrie_m: arrondi(rs.reduce((s, r) => s + r.longueur_polyligne_m, 0)) }; });
  const valid = points.filter(p => p.z !== -99999), altitudes = valid.map(p => p.z);
  const horsBboxAnnoncee = points.filter(p => p.lon < ressource.bbox.west || p.lon > ressource.bbox.east || p.lat < ressource.bbox.south || p.lat > ressource.bbox.north).length;
  const qualification = {
    schema: 1, date: manifeste.date_qualification, statut: 'conservation_et_coherence_interne_sans_validation_de_course',
    sources_verifiees: manifeste.fichiers.map(s => ({ fichier: s.fichier, sha256: s.sha256, git_blob: s.git_blob ?? null })),
    urbain: {
      source_commit: source.commit, source_blob: source.git_blob, empreinte_fnv1a: coeur.empreinte,
      comptes_source: coeur.comptes, rues_nommees_distinctes: noms.length,
      rues_marquees_pont: rues.filter(r => r.pont_source).map(r => r.id), couches: effectifs(rues.map(r => r.couche_source)),
      espaces_niveaux: espacesNiveaux, emprise_m: coeur.etendue,
      largeurs_mesurees: 0, profils_altimetriques_mesures: 0, pieds_batiments_altitudes_connues: 0,
      note_hauteurs: `${batiments.filter(b => b.connue_source).length} indicateurs connue dans le cœur brut ; compléments core-heights.js exclus. Hauteur/base restent relatives, aucune altitude sol inventée.`,
    },
    altimetrie: {
      ressource: acquisition.resource, acquis_utc: acquisition.acquired_utc, dimensions: [cfg.width, cfg.height],
      points: points.length, nodata: points.length - valid.length, plage_altitudes_api_m: [Math.min(...altitudes), Math.max(...altitudes)],
      valeurs_negatives_conservees: valid.filter(p => p.z < 0).length, acc_api: effectifs(points.map(p => p.acc)),
      pas_echantillonnage_local: pas, pas_ressource_annonce_m: manifeste.ign.pas_ressource_annonce_m,
      emprise_m: empriseGrille, bbox_annoncee_ressource: ressource.bbox, points_hors_bbox_annoncee: horsBboxAnnoncee,
      datum_individuel_confirme: null, erreur_verticale_bornee_m: null, date_vol_connue: null,
      interpolation_ajoutee: false, altitude_route_deduite: false,
    },
    etat_lots: { '15A': 'sources inventoriées ; corridor, largeurs et continuité roulable à établir', '15B': 'reconnaissance MNT archivée ; références locales, densification et niveaux à qualifier' },
    reserves: manifeste.incertitudes,
  };
  const inventaire = { schema: 1, origine: coeur.centre, axes: manifeste.emprise.axes,
    identifiants: 'Indices de tableaux conservés ; ces identifiants ne sont pas des identifiants OSM.',
    mesures: 'Longueurs et bornes calculées sur les géométries source ; aucune précision de relevé ni praticabilité garantie.',
    batiments_note: 'Empreintes ou parties, non immeubles cadastraux uniques ; nom absent de cette source. connue ne signifie pas mesure terrain.',
    rues_nommees: ruesNommees, rues, batiments, reperes, reperes_lointains: lointains, sommets_annotes: sommets, espaces_a_niveau_distinct: espacesNiveaux };
  const grille = { schema: 1, source: 'sources/ign-grille.json', source_sha256: acquisition.sha256,
    ordre: 'lignes du sud vers le nord ; colonnes de l’ouest vers l’est', dimensions: [cfg.width, cfg.height],
    repere: { origine: coeur.centre, axes: 'x est, z sud ; altitude_api_m séparée de z',
      methode: 'projection linéaire locale WGS84 ; x=(lon-lon0)*kx, z=-(lat-lat0)*kz ; facteurs métriques au centre',
      kx_m_par_degre: proj.kx, kz_m_par_degre: proj.kz,
      limites: 'Axes et origine conformes à EMPRISE ; pas de calage sur des repères topographiques indépendants. Le repère local ne constitue pas un code EPSG projeté.' },
    pas_echantillonnage_local: pas, pas_ressource_annonce_m: manifeste.ign.pas_ressource_annonce_m,
    vertical: { unite: 'm', datum_attendu_produit: manifeste.ign.datum_attendu_produit_continental,
      datum_reponse_confirme: null, erreur_bornee_m: null, arrondi_api_m: 0.01, offset_ajoute_m: 0,
      interpolation_ajoutee: false, usage: 'reconnaissance du terrain ; ne détermine pas la chaussée ou les niveaux superposés' },
    emprise_m: empriseGrille, echantillons };
  return {
    'coeur.json': json({ schema: 1, provenance: { commit: source.commit, git_blob: source.git_blob, sha256: source.sha256 }, donnees: coeur }),
    'inventaire.json': json(inventaire), 'grille.json': json(grille), 'qualification.json': json(qualification),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--check'), 'Usage : node tools/preparer-marseille-15ab.mjs [--check]');
  const sorties = preparer();
  for (const [nom, contenu] of Object.entries(sorties)) {
    if (args.includes('--check')) assert.equal(readFileSync(join(DOSSIER, nom), 'utf8'), contenu, `Fichier à régénérer : ${nom}`);
    else writeFileSync(join(DOSSIER, nom), contenu);
  }
  console.log(`Marseille 15A/15B : ${Object.keys(sorties).length} fichiers ${args.includes('--check') ? 'identiques' : 'préparés'}, 9 sources vérifiées ; aucun accès réseau.`);
}
