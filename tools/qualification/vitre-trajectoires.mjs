// Trajectoires observées de gouttes identifiées : aucune formule de transport recopiée.
// --attendu ancien conserve les échecs du nouveau contrat sans faire échouer la collecte.
// --attendu nouveau exige le contrat et rend un code de sortie non nul si un contrôle échoue.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const OUTIL = fileURLToPath(import.meta.url), RACINE = resolve(dirname(OUTIL), '../..');
const DT = 1 / 120, LARGEUR = 1280, HAUTEUR = 720, INSTANTS = [0, .25, .5, 1, 2, 4];
const QUADRANTS = [
  { nom: 'haut-gauche', x: .25, y: .20 }, { nom: 'haut-droite', x: .75, y: .20 },
  { nom: 'bas-gauche', x: .25, y: .80 }, { nom: 'bas-droite', x: .75, y: .80 }
];
const hash = contenu => createHash('sha256').update(contenu).digest('hex');
const arrondi = x => Math.round(x * 1e9) / 1e9;
const git = (racine, ...args) => execFileSync('git', ['-C', racine, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function scenarios() {
  const cas = [];
  for (const vue of ['cockpit', 'poursuite']) {
    for (const kmh of [0, 30, 100, 200, 300]) for (const point of QUADRANTS) {
      cas.push({ id: `${vue}-${kmh}-${point.nom}`, vue, kmh, point, type: 'quadrant', entree: {} });
    }
    const milieu = { nom: 'centre', x: .5, y: .5 };
    cas.push(
      { id: `${vue}-vent-droite`, vue, kmh: 0, point: milieu, type: 'vent', signeX: 1, entree: { ventX: 25 } },
      { id: `${vue}-vent-gauche`, vue, kmh: 0, point: milieu, type: 'vent', signeX: -1, entree: { ventX: -25 } },
      { id: `${vue}-avant-vent`, vue, kmh: 300, point: milieu, type: 'regard', signeX: 1, entree: { ventX: 25 } },
      { id: `${vue}-arriere-vent`, vue, kmh: 300, point: milieu, type: 'regard', signeX: -1, entree: { ventX: 25, cameraYaw: Math.PI } },
      { id: `${vue}-regard-droite`, vue, kmh: 300, point: milieu, type: 'regard', signeX: 1, entree: { cameraYaw: Math.PI / 2 } },
      { id: `${vue}-regard-gauche`, vue, kmh: 300, point: milieu, type: 'regard', signeX: -1, entree: { cameraYaw: -Math.PI / 2 } },
      { id: `${vue}-roulis-90`, vue, kmh: 0, point: milieu, type: 'roulis', signeX: -1, entree: { cameraRoll: Math.PI / 2 } },
      { id: `${vue}-roulis-moins90`, vue, kmh: 0, point: milieu, type: 'roulis', signeX: 1, entree: { cameraRoll: -Math.PI / 2 } }
    );
  }
  return cas;
}

function mesurerCas(V, cas) {
  const e = V.creerSimulation({ graine: 193 }), p = e.gouttes[0];
  // Un dépôt initial connu, sans nouvelle pluie, sans fusion et avec une vie assez longue
  // pour distinguer la sortie du bord du vieillissement. Le moteur décide seul des positions.
  Object.assign(p, { vivant: true, fusion: false, x: cas.point.x, y: cas.point.y,
    px: cas.point.x, py: cas.point.y, age: 0, pa: 0, duree: 1000, taille: 6, pr: 6,
    vitesse: 1, glisse: 1, poids: 1, pp: 1, phase: 0, frequence: 0, cos: 1, sin: 0,
    fondu: false, fonte: 0, traceAge: 0 });
  p.traceX.fill(p.x); p.traceY.fill(p.y); e.stats.gouttes = 1;
  const c = { actif: true, qualite: 'high', intensite: 1, pluie: 0, neige: 0, embruns: 0,
    abri: false, pause: false, cockpit: cas.vue === 'cockpit', largeur: LARGEUR, hauteur: HAUTEUR,
    vitesse: cas.kmh / 3.6, vitesseX: 0, vitesseY: 0, vitesseZ: -cas.kmh / 3.6,
    ventX: 0, ventY: 0, ventZ: 0, cameraYaw: 0, cameraPitch: 0, cameraRoll: 0, ...cas.entree };
  let premiereSortieEcran = null, desactivation = null, precedenteVivante = true;
  const points = [], etapesDemandes = new Set(INSTANTS.map(t => Math.round(t / DT)));
  const snapshot = t => ({ t, tempsSimulation: arrondi(e.temps), positionUV: [arrondi(p.x), arrondi(p.y)],
    deplacementPx: [arrondi((p.x - cas.point.x) * LARGEUR), arrondi((p.y - cas.point.y) * HAUTEUR)],
    vivante: p.vivant, age: arrondi(p.age) });
  points.push(snapshot(0));
  for (let i = 1; i <= INSTANTS.at(-1) / DT; i++) {
    V.avancerSimulation(e, DT, c);
    assert([p.x, p.y, p.age].every(Number.isFinite), `${cas.id} : état non fini`);
    if (!premiereSortieEcran && (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) {
      premiereSortieEcran = { t: arrondi(e.temps), positionUV: [arrondi(p.x), arrondi(p.y)],
        bords: [p.x < 0 ? 'gauche' : p.x > 1 ? 'droite' : null, p.y < 0 ? 'haut' : p.y > 1 ? 'bas' : null].filter(Boolean) };
    }
    if (precedenteVivante && !p.vivant) desactivation = { t: arrondi(e.temps),
      cause: e.stats.expulses ? 'expulsion' : e.stats.seches ? 'sechage' : 'autre',
      positionUV: [arrondi(p.x), arrondi(p.y)] };
    precedenteVivante = p.vivant;
    if (etapesDemandes.has(i)) points.push(snapshot(arrondi(i * DT)));
  }
  return { id: cas.id, vue: cas.vue, vitesseKmh: cas.kmh, type: cas.type, quadrant: cas.point.nom,
    contexte: c, depotInitial: { id: 0, positionUV: [cas.point.x, cas.point.y], rayonPx: 6, glisse: 1, duree: 1000 },
    points, premiereSortieEcran, desactivation,
    bilan: { initiaux: 1, nouveauxDepots: e.stats.depotsEau, fusions: e.stats.fusionsEau,
      expulses: e.stats.expulses, surfaceExpulseeRayonCarrePx2: e.stats.surfaceExpulsee,
      seches: e.stats.seches, residuels: Number(p.vivant) },
    traceFinaleUV: Array.from(p.traceX, (x, i) => [arrondi(x), arrondi(p.traceY[i])]) };
}

// Oracles observables : signes écran, sortie effective et comparaison de cas identiques.
// Ils ne calculent ni coefficients d'air, ni centre de stagnation, ni loi d'intégration.
function verifierContrat(cas, mesures) {
  const controles = [];
  const ajouter = (id, conforme, observations) => controles.push({ id, conforme: !!conforme, observations });
  for (let i = 0; i < cas.length; i++) {
    const c = cas[i], m = mesures[i], uneSeconde = m.points.find(p => p.t === 1);
    const [dx, dy] = uneSeconde.deplacementPx;
    ajouter(`${c.id}/isolation`, m.bilan.nouveauxDepots === 0 && m.bilan.fusions === 0 && m.bilan.seches === 0,
      { nouveauxDepots: m.bilan.nouveauxDepots, fusions: m.bilan.fusions, seches: m.bilan.seches });
    if (c.type === 'quadrant' && c.kmh === 0) {
      ajouter(`${c.id}/gravite`, dy > 1 && Math.abs(dx) < 1e-6 && m.bilan.residuels === 1,
        { deplacement1sPx: [dx, dy], residuels4s: m.bilan.residuels });
    }
    if (c.type === 'quadrant' && c.kmh >= 200) {
      const sx = c.point.x < .5 ? -1 : 1, sy = c.point.y < .5 ? -1 : 1;
      const trajectoire = m.points.filter(p => p.t > 0 && p.t <= 1);
      ajouter(`${c.id}/direction`, trajectoire.every(p => p.deplacementPx[0] * sx > 0 && p.deplacementPx[1] * sy > 0),
        { deplacement1sPx: [dx, dy], instantsControles: trajectoire.map(p => p.t), signesAttendus: [sx, sy] });
      if (c.kmh === 300) ajouter(`${c.id}/evacuation`, !!m.premiereSortieEcran && m.bilan.expulses === 1 && m.bilan.seches === 0,
        { sortieEcran: m.premiereSortieEcran?.t ?? null, desactivation: m.desactivation, bilan: m.bilan });
    }
    if (c.type === 'vent' || c.type === 'regard' || c.type === 'roulis') {
      ajouter(`${c.id}/projection`, dx * c.signeX > 1 && (c.type !== 'roulis' || Math.abs(dy) < 1e-6),
        { deplacement1sPx: [dx, dy], signeHorizontalAttendu: c.signeX, verticaleNulleAttendue: c.type === 'roulis' });
    }
  }
  for (const vue of ['cockpit', 'poursuite']) for (const q of QUADRANTS) {
    const ids = [0, 30, 100, 200, 300].map(kmh => `${vue}-${kmh}-${q.nom}`);
    const deplacements = ids.map(id => mesures.find(m => m.id === id).points.find(p => p.t === 1).deplacementPx);
    ajouter(`${vue}-${q.nom}/ecartement-progressif`, deplacements.every((d, i) => i === 0 || Math.abs(d[0]) > Math.abs(deplacements[i - 1][0])),
      { vitessesKmh: [0, 30, 100, 200, 300], deplacementsHorizontaux1sPx: deplacements.map(d => d[0]) });
  }
  return controles;
}

export function mesurerTrajectoires({ racine = RACINE, attendu = 'mesure' } = {}) {
  assert(['ancien', 'nouveau', 'mesure'].includes(attendu), '--attendu doit être ancien, nouveau ou mesure');
  racine = resolve(racine);
  const fichier = resolve(racine, 'src/vitre.js'), source = readFileSync(fichier, 'utf8');
  const V = runInNewContext(source + '\nBITUME.vitre;', {}, { filename: 'src/vitre.js' });
  assert.equal(typeof V.creerSimulation, 'function'); assert.equal(typeof V.avancerSimulation, 'function');
  const commit = git(racine, 'rev-parse', 'HEAD');
  // Garder les octets et le saut de ligne final pour comparer exactement la source au commit.
  const sourceCommitExacte = execFileSync('git', ['-C', racine, 'show', 'HEAD:src/vitre.js']);
  const cas = scenarios(), mesures = cas.map(c => mesurerCas(V, c)), controles = verifierContrat(cas, mesures);
  const echecs = controles.filter(c => !c.conforme).map(c => c.id);
  assert.equal(hash(readFileSync(fichier)), hash(source), 'src/vitre.js a changé pendant la mesure');
  return { format: 'bitume-vitre-trajectoires-1', date: new Date().toISOString(), node: process.version,
    provenance: { commit, arbreCommit: git(racine, 'rev-parse', 'HEAD^{tree}'),
      version: JSON.parse(readFileSync(resolve(racine, 'VERSION.json'), 'utf8')),
      sources: { 'src/vitre.js': hash(source) }, sourceIdentiqueAuCommit: hash(sourceCommitExacte) === hash(source),
      outil: { chemin: 'tools/qualification/vitre-trajectoires.mjs', sha256: hash(readFileSync(OUTIL)) } },
    protocole: { dt: DT, frequenceSimulation: V.FREQUENCE, dimensionsCSS: [LARGEUR, HAUTEUR],
      observationsSecondes: INSTANTS, positionsArrondiesADecimales: 9,
      etatObserve: 'État réel après les pas fixes achevés ; tempsSimulation explicite, aucune interpolation ni formule de mouvement recopiée.',
      mouvement: 'Vecteur du support imposé au contexte, avant monde -Z ; vent et angles caméra explicites, aucune dérivée de caméra.',
      entree: 'Une goutte initiale isolée de rayon 6 px, glisse 1, durée 1000 s ; ni pluie ni embruns nouveaux.',
      sortie: 'Premier centre franchissant le cadre [0,1], puis désactivation et compteur réel d’expulsion, séparés du séchage. Le compteur de surface conserve les unités rayon² du moteur, sans facteur π.',
      limites: 'Ce banc mesure les dépôts CPU réels. Il ne valide pas le shader, la scène en jeu, le rendu matériel ni les apports continus du sillage.' },
    attendu, statut: echecs.length ? (attendu === 'ancien' ? 'reference_non_conforme_au_nouveau_contrat' : 'non_conforme') : 'contrat_observe_conforme',
    synthese: { scenarios: mesures.length, controles: controles.length, conformes: controles.length - echecs.length,
      echecs: echecs.length, identifiantsEchecs: echecs, sourceStablePendantMesure: true },
    controles, mesures };
}

function cli() {
  const options = { racine: RACINE, attendu: 'mesure' }; let sortie = null;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    assert(['--racine', '--sortie', '--attendu'].includes(arg), `Option inconnue : ${arg}`);
    assert(process.argv[i + 1] && !process.argv[i + 1].startsWith('--'), `Valeur manquante : ${arg}`);
    const valeur = process.argv[++i];
    if (arg === '--sortie') sortie = resolve(valeur); else options[arg.slice(2)] = valeur;
  }
  assert(sortie, '--sortie est obligatoire');
  const rapport = mesurerTrajectoires(options);
  mkdirSync(dirname(sortie), { recursive: true }); writeFileSync(sortie, JSON.stringify(rapport, null, 2) + '\n');
  console.log(JSON.stringify({ sortie, statut: rapport.statut, ...rapport.synthese }));
  if (options.attendu === 'nouveau' && rapport.synthese.echecs) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === OUTIL) cli();
