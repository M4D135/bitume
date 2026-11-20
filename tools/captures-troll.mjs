#!/usr/bin/env node
// Vrais événements clavier dans le HTML livré ; ni expressions, ni audio, ni renderer remplacés.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer, optionsCapture } from './controle-visuel.mjs';

export const CHOIX_TROLL = Object.freeze([{ geste: 'poing', klaxon: 'ancien' }, { geste: 'salut', klaxon: 'mariage' }].map(Object.freeze));
export const INSTANTS_TROLL = Object.freeze([
  { id: 'repos', t: 0 }, { id: 'j1-debut', t: .05, appui: 0 }, { id: 'j1-montee', t: .15 },
  { id: 'j2-debut', t: .20, appui: 1 }, { id: 'montees', t: .35 }, { id: 'plateau', t: .60, repeter: true },
  { id: 'plateau-fin', t: 1.05 }, { id: 'retour-j1', t: 1.30 }, { id: 'j1-termine', t: 1.55 },
  { id: 'retour-j2', t: 1.80 }, { id: 'repos-final', t: 2.15 },
  { id: 'maintien-apres-delai', t: 2.80, repeter: true }, { id: 'relachement', t: 2.85, relacher: true }
].map(Object.freeze));
export const SCENARIOS_TROLL = Object.freeze(['cockpit', 'poursuite'].map(vue => Object.freeze({ id: 'duo-' + vue, vue })));
const touches = [{ code: 'KeyG', key: 'g', windowsVirtualKeyCode: 71 },
  { code: 'NumpadDecimal', key: '.', windowsVirtualKeyCode: 110, isKeypad: true, location: 3 }];

export function optionsTroll(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url', 'sortie', 'chrome', 'cas', 'taille'].includes(k) ||
      o[k] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) throw Error('Option inconnue, répétée ou absente : ' + argv[i]);
    o[k] = argv[i + 1];
  }
  if (!o.url || !o.sortie || new URL(o.url).protocol !== 'file:') throw Error('--url file: et --sortie nécessaires');
  o.cas = o.cas ? o.cas.split(',') : SCENARIOS_TROLL.map(s => s.id);
  if (!o.cas.length || new Set(o.cas).size !== o.cas.length || o.cas.some(id => !SCENARIOS_TROLL.some(s => s.id === id))) throw Error('Scénario Troll inconnu ou dupliqué');
  o.taille ||= '1280,960';
  optionsScenarioTroll(SCENARIOS_TROLL[0], o.url, o.sortie, o);
  return o;
}

export function optionsScenarioTroll(s, url, sortie, o) {
  const args = ['--url', url, '--sortie', sortie, '--scenario', 'duo', '--images', String(INSTANTS_TROLL.length),
    '--chauffe', '0', '--pas', '.05', '--taille', o.taille, '--qualite', 'high', '--circuit', '0',
    '--meteo', 'sec', '--saison', 'ete', '--vitesse', '0', '--depart', '280', '--vue', s.vue, '--vue2', s.vue,
    '--partage', 'haut-bas', '--retro', s.vue === 'cockpit' ? 'oui' : 'non', '--attendre', '120000'];
  if (o.chrome) args.push('--chrome', o.chrome);
  return optionsCapture(args);
}

// Sérialisé dans la page. Les poses restent celles de reference() ; seule l'horloge progresse sans conduite.
export function preparerTroll(reference, choix) {
  const J = BITUME_JEU;
  Object.assign(J.reglages, { trollPilotes: choix, commandes: ['clavier', 'clavier'],
    touches: [{ troll: ['KeyG'] }, { troll: ['NumpadDecimal'] }], general: .8, effets: .9 });
  J.reference({ ...reference, pilote: false });
  const S = J.session;
  if (S.type !== 'duo' || S.locaux.length !== 2 || !S.expressions) throw Error('Deux pilotes du jeu assemblé requis');
  globalThis.__BITUME_REFERENCE = S;
  S.acc = -1; J.pauseAuto = false; J.camera = null;
  for (const v of S.course.voitures) { v.tPassage = -100; v.rapportAvant = v.etat.rapport; }
  const F = globalThis.__TROLL_CAPTURE = { origine: null, index: -1, avantAudio: null,
    entrees: [0, 1].map(() => ({ appuis: 0, repetitions: 0, relachements: 0, nonFiables: 0 })) };
  for (const type of ['keydown', 'keyup']) addEventListener(type, e => {
    const n = ['KeyG', 'NumpadDecimal'].indexOf(e.code); if (n < 0) return;
    const c = F.entrees[n]; if (!e.isTrusted) c.nonFiables++;
    c[type === 'keyup' ? 'relachements' : e.repeat ? 'repetitions' : 'appuis']++;
  });
  const avancer = __BITUME_CAPTURE.avancer;
  __BITUME_CAPTURE.avancer = ms => { S.course.horloge += ms / 1000; S.course.temps = S.course.horloge; return avancer(ms); };
  for (let k = 0; k < 4; k++) __BITUME_CAPTURE.avancer(50);
  return { entree: 'BITUME_JEU.reference', mode: S.type, locaux: [...S.locaux], choix: J.reglages.trollPilotes,
    entreeClavier: 'CDP Input.dispatchKeyEvent, événements isTrusted observés', simulationConduite: false,
    modulesRemplaces: false, cameraImposee: false };
}

export function observerTroll() {
  const J = BITUME_JEU, S = J.session, F = __TROLL_CAPTURE, gl = J.rendu.gl;
  if (F.origine === null) F.origine = S.tRendu;
  const mains = H => (H?.mains || []).map(m => {
    // Empreinte de toutes les pièces locales du gant ; les coordonnées monde varient selon la dernière vue.
    const texte = JSON.stringify(m.pieces.map(p => [p.objet.shape, Array.from(p.o), Array.from(p.rep.m)]));
    let hash = 2166136261;
    for (let k = 0; k < texte.length; k++) hash = Math.imul(hash ^ texte.charCodeAt(k), 16777619);
    return { pieces: m.pieces.length, empreinteLocale: (hash >>> 0).toString(16).padStart(8, '0') };
  });
  return { index: F.index, t: S.tRendu - F.origine, tempsRendu: S.tRendu, ecran: J.ecran, type: S.type, vue: S.vue,
    vue2: S.vueJ2?.vue, cameraImposee: J.camera !== null, glErreur: gl.getError(), glPerdu: gl.isContextLost(),
    audio: { actif: J.son?.actif, ...J.son?.klaxons },
    entrees: F.entrees.map(x => ({ ...x })), evenement: { ...S.trollEvenement }, audioEvenement: { ...S.trollAudio },
    joueurs: S.locaux.map((id, n) => {
      const E = S.modeles[id]?.objetsRendu, H = E?.habitacle || E?.pilote?.habitacle;
      return { local: n, id, expression: { ...BITUME.expressionsPilote.lire(S.expressions, id) },
        articulations: H?.articulations ? Array.from(H.articulations) : null, mains: mains(H) };
    }), autresGestes: S.course.voitures.filter(v => !S.locaux.includes(v.id) && BITUME.expressionsPilote.lire(S.expressions, v.id).geste).map(v => v.id) };
}

export function verifierTroll(r, s) {
  const fautes = [], manque = texte => fautes.push(texte), fini = a => Array.isArray(a) && a.length === 18 && a.every(Number.isFinite);
  if (r.fatal) manque(r.fatal.split('\n')[0]);
  for (const e of r.erreurs || []) manque('Erreur page : ' + e);
  for (const e of r.avertissements || []) if (/GL_INVALID|shader.*(error|failed)|GLSL|context lost/i.test(e)) manque('Erreur graphique : ' + e);
  if (!/^[a-f0-9]{64}$/.test(r.build?.sha256 || '') || !/^[a-f0-9]{40}$/.test(r.source?.commit || '')) manque('Identité du build ou des outils absente');
  if (r.environnement?.webgl2 !== true || r.environnement?.physx?.ready !== true) manque('WebGL2 ou PhysX réel absent');
  if (r.initialisation?.entree !== 'BITUME_JEU.reference' || r.initialisation.mode !== 'duo' ||
      r.initialisation.modulesRemplaces !== false || r.initialisation.cameraImposee !== false ||
      JSON.stringify(r.initialisation.choix) !== JSON.stringify(CHOIX_TROLL)) manque('Vraie séance duo ou choix distincts absents');
  if (r.images?.length !== INSTANTS_TROLL.length) manque('Séquence temporelle incomplète');
  const avant = r.images?.[0]?.observation, baseAudio = avant?.audio;
  if (!baseAudio?.actif || baseAudio.voix !== 5 || baseAudio.budget !== 5) manque('Audio réel non initialisé ou budget inattendu');
  for (let i = 0; i < INSTANTS_TROLL.length; i++) {
    const instant = INSTANTS_TROLL[i], image = r.images?.[i], o = image?.observation;
    if (!o) { manque('Observation absente : ' + instant.id); continue; }
    if (o.index !== i || !Number.isFinite(o.t) || Math.abs(o.t - instant.t) > 1e-5) manque('Horloge/ordre incorrect : ' + instant.id);
    if (o.type !== 'duo' || o.ecran !== 'course' || o.vue !== s.vue || o.vue2 !== s.vue || o.cameraImposee) manque('Vues réelles incorrectes : ' + instant.id);
    if (o.glErreur || o.glPerdu) manque('Erreur WebGL : ' + instant.id);
    const zones = ['scene', 'scene2', ...(s.vue === 'cockpit' ? ['glace-g', 'glace-d', 'glace-g2', 'glace-d2'] : [])];
    for (const nom of zones) if (!image.etat?.zones?.[nom]) manque('Vue/rétroviseur absent : ' + nom);
    for (const nom of ['scene', 'scene2']) if (!image.vues?.[nom] || image.vues[nom].noir > .97 && image.vues[nom].luminance < .025) manque('Vue noire/absente : ' + nom);
    const attendus = i === 0 ? 0 : i < 3 ? 1 : 2;
    if (!o.audio?.actif || o.audio.joues - baseAudio?.joues !== attendus || o.audio.ignores !== baseAudio?.ignores) manque('Klaxon absent, refusé ou répété : ' + instant.id);
    if (o.autresGestes?.length !== 0) manque('Un autre pilote parasite la preuve');
    if (o.joueurs?.length !== 2 || o.joueurs[0].id === o.joueurs[1].id) manque('J1/J2 non distincts');
    for (let n = 0; n < 2; n++) {
      const j = o.joueurs?.[n], e = j?.expression, initial = avant?.joueurs?.[n], debut = n ? .20 : .05, duree = n ? 1.8 : 1.4;
      const age = instant.t - debut, actif = age >= -1e-5 && age < duree - 1e-5;
      if (!j || j.local !== n || j.id !== initial?.id || !fini(j.articulations) || j.mains?.length !== 2 || j.mains.some(m => !m.pieces || !/^[0-9a-f]{8}$/.test(m.empreinteLocale))) manque('Modèle articulé absent : J' + (n + 1));
      if (!e || e.geste !== (actif ? CHOIX_TROLL[n].geste : null) || !Number.isFinite(e.gesteIntensite) || e.gesteIntensite < 0 || e.gesteIntensite > 1) manque('Geste incorrect : ' + instant.id + '/J' + (n + 1));
      if (actif && age > .25 && age < duree - .37 && e?.gesteIntensite < .99) manque('Plateau non atteint : J' + (n + 1));
      if (!actif && (e?.gesteIntensite !== 0 || fini(j?.articulations) && fini(initial?.articulations) && j.articulations.some((x, k) => Math.abs(x - initial.articulations[k]) > 1e-9) || JSON.stringify(j?.mains) !== JSON.stringify(initial?.mains))) manque('Main pas revenue au volant : ' + instant.id + '/J' + (n + 1));
      const input = o.entrees?.[n], appuis = instant.t + 1e-5 >= debut ? 1 : 0;
      if (!input || input.nonFiables || input.appuis !== appuis || input.repetitions !== (i >= 11 ? 2 : i >= 5 ? 1 : 0) || input.relachements !== (i === 12 ? 1 : 0)) manque('Vrais appuis/maintien non exercés : ' + instant.id + '/J' + (n + 1));
    }
  }
  for (const [i, n] of [[1, 0], [3, 1]]) {
    const o = r.images?.[i]?.observation, e = o?.evenement, choix = CHOIX_TROLL[n];
    if (e?.pilote !== o?.joueurs?.[n]?.id || e?.sequence !== n + 1 || e?.geste !== choix.geste || e?.klaxon !== choix.klaxon ||
      !Number.isFinite(e?.instant) || !Number.isFinite(o?.tempsRendu) || Math.abs(e.instant - o.tempsRendu) > 1e-8 ||
      o?.audioEvenement?.klaxon !== choix.klaxon || o?.joueurs?.[n]?.expression?.gesteIntensite > 1e-5)
      manque('Départ commun geste/son non prouvé : J' + (n + 1));
  }
  for (const [i, n] of [[2, 0], [4, 1], [7, 0], [9, 1]]) {
    const o = r.images?.[i]?.observation?.joueurs?.[n], neutral = avant?.joueurs?.[n], intensite = o?.expression?.gesteIntensite;
    if (!(intensite > .05 && intensite < .95) || !fini(o?.articulations) || !fini(neutral?.articulations) || !o.articulations.some((x, k) => Math.abs(x - neutral.articulations[k]) > .001)) manque('Mouvement intermédiaire non observé : ' + INSTANTS_TROLL[i].id);
  }
  return [...new Set(fautes)];
}

export async function campagneTroll(o) {
  mkdirSync(o.sortie, { recursive: true });
  const r = { format: 'bitume-captures-troll-v1', date: new Date().toISOString(), demandes: o.cas, passages: [], echecs: 0,
    limites: ['Horloge de rendu commandée et voitures immobiles ; aucun essai de conduite ni FPS matériel.',
      'WebAudio réel et compteur de sources ; aucune écoute humaine ni vérification du périphérique sonore.',
      'Clavier automatisé CDP ; aucune manette physique ni synchronisation réseau.',
      'Les captures et articulations échantillonnent le geste ; inspection des PNG requise pour son naturel visuel.'] };
  for (const id of o.cas) {
    const s = SCENARIOS_TROLL.find(s => s.id === id), sortie = path.join(o.sortie, id), p = optionsScenarioTroll(s, o.url, sortie, o);
    p.initialiser = async ({ evaluer, envoyer }) => {
      const initialisation = await evaluer(`(${preparerTroll.toString()})(${JSON.stringify(p.referenceJeu)},${JSON.stringify(CHOIX_TROLL)})`);
      await envoyer('Input.dispatchKeyEvent', { type: 'keyDown', key: 'l', code: 'KeyL', windowsVirtualKeyCode: 76 });
      await envoyer('Input.dispatchKeyEvent', { type: 'keyUp', key: 'l', code: 'KeyL', windowsVirtualKeyCode: 76 });
      await evaluer('new Promise(resolve => setTimeout(resolve, 100))');
      initialisation.audio = await evaluer('BITUME_JEU.son');
      return initialisation;
    };
    p.avantImage = async ({ evaluer, envoyer, i }) => {
      const instant = INSTANTS_TROLL[i];
      await evaluer(`(() => { const F = __TROLL_CAPTURE; F.index = ${i}; if (F.origine === null) return;
        const cible = F.origine + ${instant.t} - .05;
        for (let k = 0; k < 80 && BITUME_JEU.session.tRendu < cible - 1e-7; k++)
          __BITUME_CAPTURE.avancer(Math.min(50, (cible - BITUME_JEU.session.tRendu) * 1000));
        if (Math.abs(BITUME_JEU.session.tRendu - cible) > 1e-5) throw Error('Horloge de rendu non atteinte');
      })()`);
      if (instant.appui !== undefined) await envoyer('Input.dispatchKeyEvent', { type: 'keyDown', ...touches[instant.appui] });
      if (instant.repeter || instant.relacher) for (const touche of touches)
        await envoyer('Input.dispatchKeyEvent', { type: instant.relacher ? 'keyUp' : 'keyDown', ...touche, autoRepeat: !instant.relacher });
    };
    p.observer = ({ evaluer }) => evaluer(`(${observerTroll.toString()})()`);
    const resultat = await capturer(p), erreurs = verifierTroll(resultat, s);
    const sha = createHash('sha256').update(readFileSync(fileURLToPath(o.url))).digest('hex');
    if (sha !== resultat.build?.sha256) erreurs.push('HTML modifié pendant la capture');
    const empreintes = resultat.images.map(im => { const png = readFileSync(path.join(sortie, im.fichier));
      return { fichier: im.fichier, octets: png.length, sha256: createHash('sha256').update(png).digest('hex') }; });
    r.passages.push({ scenario: id, dossier: id, images: resultat.images.length, build: resultat.build, source: resultat.source, empreintes, erreurs });
    r.echecs += erreurs.length ? 1 : 0;
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(r, null, 2) + '\n');
    process.stderr.write(`${id} : ${resultat.images.length} images, ${erreurs.length} erreurs\n`);
    if (resultat.fatal && !resultat.images.length) break;
  }
  return r;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = await campagneTroll(optionsTroll(process.argv.slice(2))); console.log(JSON.stringify(r, null, 2)); process.exitCode = r.echecs ? 1 : 0; }
  catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}
