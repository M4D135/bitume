#!/usr/bin/env node
// Le vrai montage de démo rend ces scènes. Seuls les états de départ et l'horloge sont prescrits ;
// aucun remplacement de BITUME_JEU.camera, aucun code de caméra ou de shader injecté dans la page.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer, optionsCapture } from './controle-visuel.mjs';

export const SCENARIOS = Object.freeze([
  { id: 'faune-ete', circuit: 2, vue: 'faune', attendu: 'faune', faune: true, saison: 'ete' },
  { id: 'faune-hiver', circuit: 2, vue: 'faune', attendu: 'faune', faune: true, saison: 'hiver' },
  { id: 'tele-montagne', circuit: 2, depart: 1685, vue: 'tele', attendu: 'poursuite', vitesse: 40, refus: true },
  { id: 'helico-montagne', circuit: 2, depart: 2070, vue: 'helico', attendu: 'poursuite', vitesse: 40, refus: true },
  { id: 'volant-gauche', vue: 'pilote', attendu: 'pilote', volant: -.7, pilote: true },
  { id: 'volant-droite', vue: 'pilote', attendu: 'pilote', volant: .7, pilote: true },
  { id: 'geste-majeur', vue: 'pilote', attendu: 'pilote', geste: 'majeur', pilote: true },
  { id: 'geste-poing', vue: 'pilote', attendu: 'pilote', geste: 'poing', pilote: true },
  { id: 'geste-salut-realisateur', vue: 'tele', attendu: 'pilote', geste: 'salut', pilote: true, realisation: true },
  { id: 'pluie-cockpit', vue: 'cockpit', attendu: 'cockpit', pluie: true, spray: true, chauffe: 90, vitesse: 235 / 3.6 },
  { id: 'pluie-poursuite-sillage', vue: 'poursuite', attendu: 'poursuite', pluie: true, spray: true, chauffe: 90, vitesse: 235 / 3.6 },
  { id: 'pluie-aerien', circuit: 7, vue: 'helico', attendu: 'helico', pluie: true, aerien: true, chauffe: 90, vitesse: 235 / 3.6 }
].map(s => Object.freeze({ circuit: 0, depart: 280, vitesse: 30, saison: 'ete', chauffe: 4, images: 3, ...s })));
const AVANT = new Set(['faune-ete', 'faune-hiver', 'tele-montagne', 'helico-montagne']);

export function optionsDemo(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const cle = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url','avant','sortie','chrome','cas','taille'].includes(cle) || !argv[i + 1] || argv[i + 1].startsWith('--'))
      throw new Error('Option inconnue ou valeur absente : ' + argv[i]);
    if (o[cle] !== undefined) throw new Error('Option dupliquée : ' + cle);
    o[cle] = argv[i + 1];
  }
  if (!o.url || !o.sortie) throw new Error('--url et --sortie nécessaires');
  for (const cle of ['url','avant']) if (o[cle] && !['file:', 'http:', 'https:'].includes(new URL(o[cle]).protocol)) throw new Error('URL file/http/https attendue');
  o.cas = o.cas ? o.cas.split(',') : SCENARIOS.map(s => s.id);
  if (!o.cas.length || new Set(o.cas).size !== o.cas.length || o.cas.some(id => !SCENARIOS.some(s => s.id === id))) throw new Error('Cas de démo inconnu ou dupliqué');
  o.taille ||= '960,540';
  const taille = o.taille.split(',').map(Number);
  if (taille.length !== 2 || taille.some(n => !Number.isInteger(n) || n < 240 || n > 1920)) throw new Error('Taille attendue : largeur,hauteur (240..1920)');
  return o;
}

// Sérialisée par le contrôleur. La séance provient de l'entrée publique de démo ; le réalisateur et les
// gardes de rendreVue restent actifs. La référence préparatoire sert uniquement à fixer qualité et saison.
export function preparerEtat(s) {
  const J = BITUME_JEU, B = BITUME, ancienne = J.session, reference = { ...ancienne.reference };
  ancienne.reglagesReference = { ...J.reglages }; ancienne.decorAvantReference = J.scene.enrichi;
  J.demo(s.circuit);
  const S = J.session, co = S.course, c = co.c;
  if (S.type !== 'demo' || !S.real || !S.cinema || J.camera !== null) throw new Error('La vraie démo sans caméra imposée est requise');
  globalThis.__BITUME_REFERENCE = S;
  S.reference = { ...reference, mode: 'demo', vue: s.vue, posesDisposees: true }; S.essai = true; S.acc = -1;
  J.pauseAuto = false; J.reglages.gouttes = 1; J.reglages.secousses = 0; J.reglages.faune = 'high';
  co.phase = 'course'; co.feux.vert = true; co.feux.allumes = 5; co.horloge = co.temps = 12; co.drapeau = null;
  Object.assign(S.meteo, { reel: true, fixe: true, pluie: s.pluie ? 1 : 0, nuage: s.pluie ? .9 : .12,
    phase: s.pluie ? 'pluie' : 'clair', mouille: s.pluie ? 1 : 0, neige: false, precipitationsNeige: false, eclair: 0 });
  const sujet = co.joueur.id, rival = co.voitures.find(v => v.id !== sujet).id;
  for (const v of co.voitures) {
    // Un seul véhicule devant la voiture suivie ; les autres restent à distance. La vue de poursuite
    // doit transmettre l'exposition réelle du pilote sans exiger un peloton artificiellement dense.
    const e = v.etat, ds = v.id === sujet ? 0 : s.spray && v.id === rival ? 18 : 120 + v.id * 12;
    const abscisse = (s.depart + ds) % c.longueur, p = B.circuit.echantillon(c, abscisse), d = s.spray && v.id === rival || v.id === sujet ? 0 : v.id % 2 ? 2.6 : -2.6;
    Object.assign(e, { s: abscisse, d, v: s.vitesse, psi: 0, beta: 0, volant: v.id === sujet ? (s.volant || 0) : 0,
      braquage: v.id === sujet ? (s.volant || 0) * .12 : 0, rapport: 4,
      y: p.y - d * Math.sin(p.devers || 0), tangage: Math.atan(p.pente || 0), roulis: p.devers || 0 });
    v.progression = 100 + ds; v.rapportAvant = 4; v.tPassage = -100;
    const pose = { x: p.x - Math.sin(p.cap) * d, y: e.y, z: p.z + Math.cos(p.cap) * d, cap: p.cap,
      tangage: e.tangage, roulis: e.roulis, braquage: e.braquage, roule: v.roule || 0, rebond: [0,0,0,0] };
    if (e._physx) {
      Object.assign(e._physx, { x: pose.x, y: pose.y, z: pose.z, cap: pose.cap, groundCount: 4 });
      const horizontal = s.vitesse * Math.cos(pose.tangage);
      e._physx.velocity[0] = Math.cos(p.cap) * horizontal; e._physx.velocity[1] = Math.sin(pose.tangage) * s.vitesse;
      e._physx.velocity[2] = Math.sin(p.cap) * horizontal;
    }
    for (const liste of [S.prec, S.cour]) Object.assign(liste[v.id], pose);
  }
  B.cinema.regler(S.cinema, { faune: 'high', nuit: 0, pluie: s.pluie ? 1 : 0 });
  const ancre = s.faune ? S.cinema.ancres.faune.find(a => a.label === 'Bouquetin des Alpes') : null;
  if (s.faune && !ancre) throw new Error('Ancre bouquetin absente');
  const plan = { vue: s.vue, sujet, debut: co.horloge - (s.realisation ? 1 : 0), fin: co.horloge + 30,
    motif: 'course', n: ++S.real.n, cote: -1, angle: 0, ...(ancre ? { ancre, nature: true, label: ancre.label } : {}) };
  S.real.plan = plan; S.real.vert = 0; S.real.ordre = co.classement.slice(); S.planVu = null; S.tele.alea = () => .5;
  let graineExpression = null;
  if (s.geste) {
    if (!B.expressionsPilote) throw new Error('Expressions du pilote absentes');
    for (let graine = 1; graine <= 128; graine++) {
      const E = B.expressionsPilote.creer(co.voitures.length, graine), t = co.horloge - 1 / 120;
      B.expressionsPilote.actualiser(E, co, S.cour, t - .01, true);
      B.expressionsPilote.demander(E, sujet, true); B.expressionsPilote.demander(E, sujet, false);
      B.expressionsPilote.actualiser(E, co, S.cour, t, true);
      if (B.expressionsPilote.lire(E, sujet).geste === s.geste) { S.expressions = E; graineExpression = graine; break; }
    }
    if (graineExpression === null) throw new Error('Graine du geste non trouvée');
  }
  const avancer = __BITUME_CAPTURE.avancer;
  __BITUME_CAPTURE.avancer = ms => {
    co.horloge += ms / 1000; co.temps = co.horloge;
    if (s.pluie && s.vitesse > 14) for (let i = 0; i < 3; i++) B.traces.pas(S.fx, co, S.cour, sujet, 1 / 30, null);
    return avancer(ms);
  };
  globalThis.__DEMO_FIXTURE = { scenario: s, sujet, rival, ancre, planInitial: plan, graineExpression };
  return { entree: 'BITUME_JEU.demo', type: S.type, cameraImposee: J.camera !== null, planDemande: s.vue,
    saison: J.scene.saison, graineExpression, posesDisposees: true, simulationConduite: false,
    sillage: s.spray ? { rival, decalageAbscisseM: 18, nombreRivauxProches: 1 } : null,
    description: 'Vraie démo et vrai réalisateur ; poses prescrites, horloge/effets rendus, aucun essai de conduite ou de FPS.' };
}

export function observerEtat() {
  const J = BITUME_JEU, B = BITUME, S = J.session, F = __DEMO_FIXTURE, cam = S.camera, gl = J.rendu.gl, p = S.cour[S.suivie];
  const cible = cam?.cible || (p && [p.x, p.y + .65, p.z]);
  let obstruction = null, faune = null;
  if (cam && cible) {
    const dir = cible.map((v, i) => v - cam.pos[i]), d = Math.hypot(...dir);
    const h = d > .2 ? S.course.physique.world.raycast(cam.pos, dir, d - .17, { mask: 3, staticOnly: true }) : { hit: false };
    obstruction = { hit: h.hit, distance: h.hit ? h.distance : null };
  }
  if (F.ancre && cam) {
    const a = B.animaux.poseAnimal(S.animaux, F.ancre.indice, S.tRendu), sol = B.animaux.solExact(S.animaux.G.T, a.x, a.z);
    const d = Math.hypot(...cam.pos.map((v, i) => v - cam.cible[i])), taille = F.ancre.taille * a.echelle;
    faune = { indice: F.ancre.indice, y: a.y, sol, distance: d, taille, fractionHauteur: taille / (2 * d * Math.tan(cam.fov * Math.PI / 360)) };
  }
  const pilote = S.expressions && B.expressionsPilote ? { ...B.expressionsPilote.lire(S.expressions, F.sujet) } : null;
  const q = S.cour[F.sujet], volants = S.sortie.filter(o => o.shape === B.voiture.FORMES.jante.nom && !o.overlay && Math.hypot(o.p[0] - q.x, o.p[1] - q.y, o.p[2] - q.z) < 2.5)
    .map(o => ({ p: Array.from(o.p), r: Array.from(o.r), s: Array.from(o.s) }));
  let sillage = null;
  if (F.scenario.spray && B.sillage && cam) {
    const casque = [q.x, q.y + .95, q.z], eau = Math.max(S.meteo.mouille || 0, S.meteo.pluie || 0);
    const sources = (S.sillage?.sources || []).map(source => ({ id: source.id,
      exposition: B.sillage.exposition({ sources: [source] }, casque, eau, F.sujet) })).filter(s => s.exposition > 1e-6);
    sillage = { rival: F.rival, sources, casque: B.sillage.exposition(S.sillage, casque, eau, F.sujet),
      lentille: B.sillage.exposition(S.sillage, cam.pos, eau, F.sujet) };
  }
  const vitre = document.getElementById('vitre'), style = vitre ? getComputedStyle(vitre) : null;
  const vitrage = S.vitreContexte ? Object.fromEntries(['actif','pluie','neige','vitesse','cockpit','intensite','embruns','pause'].map(k => [k, S.vitreContexte[k]])) : null;
  return { type: S.type, ecran: J.ecran, cameraImposee: J.camera !== null, gardeDisponible: typeof B.cinema.valider === 'function',
    vue: S.vue, plan: S.planVu ? { vue: S.planVu.vue, sujet: S.planVu.sujet, motif: S.planVu.motif, n: S.planVu.n, cote: S.planVu.cote } : null,
    camera: cam ? { pos: cam.pos, cible, yaw: cam.yaw, pitch: cam.pitch, roll: cam.roll, fov: cam.fov, near: cam.near, secours: !!cam.secours } : null,
    obstruction, faune, pilote, volant: S.course.voitures[F.sujet].etat.volant, volants, sillage,
    vitrage, vitres: J.vitres, vitreVisible: !!vitre && !vitre.hidden && style.display !== 'none' && style.visibility !== 'hidden',
    saison: J.scene.saison, temps: S.tRendu, glErreur: gl.getError(), glPerdu: gl.isContextLost() };
}

export function verifierRapport(r, s, candidat = true) {
  const erreurs = [];
  if (r.fatal) erreurs.push(r.fatal.split('\n')[0]);
  for (const e of r.erreurs || []) erreurs.push('Erreur page : ' + e);
  for (const e of r.avertissements || []) if (/GL_INVALID|shader.*(error|failed)|GLSL|context lost/i.test(e)) erreurs.push('Erreur graphique : ' + e);
  if (r.images.length !== s.images) erreurs.push('Nombre de captures incomplet');
  if (!/swiftshader|llvmpipe|software/i.test(r.environnement.gpu || '')) erreurs.push('Raster logiciel non identifié');
  if (r.initialisation?.entree !== 'BITUME_JEU.demo' || r.initialisation.cameraImposee !== false) erreurs.push('Séance de démo réelle non prouvée');
  for (const im of r.images) {
    const o = im.observation;
    if (!o) { erreurs.push('Observation absente'); continue; }
    if (o.type !== 'demo' || o.ecran !== 'demo' || o.cameraImposee !== false) erreurs.push('Raccord démo contourné');
    if (o.glErreur || o.glPerdu) erreurs.push('Échec WebGL');
    if (im.vues?.scene?.noir > .97 && im.vues.scene.luminance < .025) erreurs.push('Vue rendue noire');
    if (!Array.isArray(o.camera?.pos) || o.camera.pos.length !== 3 || !o.camera.pos.every(Number.isFinite) || ![o.camera?.yaw, o.camera?.pitch, o.camera?.fov].every(Number.isFinite)) erreurs.push('Caméra finale invalide');
    if (o.saison !== s.saison) erreurs.push('Saison demandée non rendue');
    if (!candidat) continue;
    if (o.gardeDisponible !== true || o.vue !== s.attendu || o.plan?.vue !== s.attendu || o.camera?.secours) erreurs.push('Plan attendu absent ou repli non qualifié');
    if (o.obstruction?.hit !== false) erreurs.push('Visée finale masquée');
    if (s.refus && o.plan?.motif !== 'cadre') erreurs.push('Le plan dangereux n’a pas été explicitement coupé');
    if (s.faune && (!o.faune || ![o.faune.y, o.faune.sol, o.faune.fractionHauteur].every(Number.isFinite) || Math.abs(o.faune.y - o.faune.sol) > .08 || o.faune.fractionHauteur < .12 || o.faune.fractionHauteur > .20 || o.camera?.pitch < -.4)) erreurs.push('Faune hors appui ou cadrage illisible');
    if (s.pilote && !o.volants?.length) erreurs.push('Volant extérieur absent des objets rendus');
    if (s.volant !== undefined && o.volant !== s.volant) erreurs.push('Braquage demandé absent');
    if (s.geste && (o.pilote?.geste !== s.geste || !(o.pilote.gesteIntensite > .6))) erreurs.push('Geste réel absent ou déjà terminé');
    if (s.realisation && o.plan?.motif !== 'expression') erreurs.push('Le réalisateur n’a pas cadré le geste');
    if (s.pluie) {
      const v = o.vitres?.j1;
      if (!v || v.backend !== 'webgl2' || v.pret !== true || v.erreur || v.perdu || v.erreurs?.length || typeof v.erreurs === 'number' && v.erreurs > 0) erreurs.push('Diagnostic optique absent ou en erreur');
      if (!Number.isFinite(o.vitrage?.pluie) || !(o.vitrage.pluie > 0)) erreurs.push('Pluie demandée non exercée');
      if (s.aerien) {
        // Le diagnostic WebGL expose les dépôts ; propre/masquee appartiennent seulement à l'état
        // interne du repli Canvas. Vérifier les vrais pixels composés via la visibilité du DOM.
        if (o.vitrage?.actif !== false || o.vitreVisible !== false ||
            !['eau', 'accumulationNeige', 'embruns', 'gouttes', 'neige'].every(k => v?.[k] === 0)) erreurs.push('Overlay humide présent dans la vue aérienne');
      } else {
        const spray = o.sillage;
        if (!Number.isInteger(spray?.rival) || spray.rival === o.plan?.sujet || !Array.isArray(spray.sources) || spray.sources.length !== 1 ||
          spray.sources[0]?.id !== spray.rival || !Number.isFinite(spray.casque) || !(spray.casque > .6 && spray.casque <= 1) ||
          !Number.isFinite(spray.sources[0]?.exposition) || !(Math.abs(spray.sources[0].exposition - spray.casque) < 1e-6)) erreurs.push('Le sillage d’un seul rival n’est pas prouvé');
        if (!(o.vitrage?.actif === true && o.vitreVisible === true && Number.isFinite(o.vitrage.embruns) && o.vitrage.embruns > .6 && o.vitrage.embruns <= 1 &&
          ['eau','gouttes','depotsEmbruns','expulses'].every(k => Number.isFinite(v?.[k]) && v[k] > 0))) erreurs.push('Fort sillage ou évacuation des gouttes non exercés');
        // La poursuite actuelle reçoit un fort panache. Mesurer sa vraie lentille reste nécessaire :
        // les données du casque ne prouvent pas que les projections atteignent les pixels de cette vue.
        if (!(Number.isFinite(spray?.lentille) && spray.lentille > .6 && spray.lentille <= 1 &&
          Number.isFinite(o.vitrage?.embruns) && Math.abs(o.vitrage.embruns - spray.lentille) < 1e-6 &&
          Number.isFinite(v?.embruns) && Math.abs(v.embruns - spray.lentille) < 1e-6)) erreurs.push('Exposition réelle de la lentille incohérente');
      }
    }
  }
  return [...new Set(erreurs)];
}

export function optionsScenario(s, url, sortie, o) {
  const args = ['--url', url, '--sortie', sortie, '--scenario', s.pluie ? 'pluie' : 'piste', '--images', String(s.images), '--chauffe', String(s.chauffe),
    '--taille', o.taille, '--pas', '.1', '--qualite', 'high', '--circuit', String(s.circuit), '--saison', s.saison, '--meteo', s.pluie ? 'pluie' : 'sec',
    '--vitesse', String(s.vitesse), '--depart', String(s.depart), '--retro', 'non', '--attendre', '120000'];
  if (o.chrome) args.push('--chrome', o.chrome);
  return optionsCapture(args);
}
export async function campagne(o) {
  mkdirSync(o.sortie, { recursive: true });
  const resultat = { format: 'bitume-captures-demo-v1', date: new Date().toISOString(), source: fileURLToPath(import.meta.url),
    limites: ['Raster logiciel : aucun FPS matériel qualifié.', 'Vraies caméras et réalisation du jeu, sur poses prescrites : aucun essai de conduite.',
      'Les captures nécessitent un examen visuel ; les contrôles numériques ne qualifient pas seuls la composition.'], passages: [], echecs: 0 };
  for (const [variante, url] of [...(o.avant ? [['avant', o.avant]] : []), ['apres', o.url]]) for (const id of o.cas) {
    if (variante === 'avant' && !AVANT.has(id)) continue;
    const s = SCENARIOS.find(s => s.id === id), sortie = path.join(o.sortie, variante, id), p = optionsScenario(s, url, sortie, o);
    p.ecrans = ['demo']; p.initialiser = ({ evaluer }) => evaluer(`(${preparerEtat.toString()})(${JSON.stringify(s)})`);
    p.observer = ({ evaluer }) => evaluer(`(${observerEtat.toString()})()`);
    const r = await capturer(p), erreurs = verifierRapport(r, s, variante === 'apres');
    resultat.passages.push({ variante, scenario: id, dossier: path.relative(o.sortie, sortie), images: r.images.length, erreurs });
    resultat.echecs += erreurs.length ? 1 : 0;
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(resultat, null, 2) + '\n');
    process.stderr.write(`${variante}/${id} : ${r.images.length} images, ${erreurs.length} erreurs\n`);
    if (r.fatal && r.images.length === 0) return resultat;
  }
  return resultat;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = await campagne(optionsDemo(process.argv.slice(2))); console.log(JSON.stringify(r, null, 2)); process.exitCode = r.echecs ? 1 : 0; }
  catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}
