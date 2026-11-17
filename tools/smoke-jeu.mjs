// Parcours fonctionnels courts exécutés par banc-navigateur.mjs, avec ses primitives CDP.
// Les sauts de simulation vérifient le jeu au pas fixe ; ils ne mesurent aucune performance temps réel.
import assert from 'node:assert/strict';

export async function controlerStand(evaluer, images, options = {}) {
  await evaluer(`BITUME_JEU.pilotageAuto = false; BITUME_JEU.reference(${JSON.stringify({ ...options, circuit: options.circuit ?? 0, mode: 'solo', pilote: false, vitesse: 0 })}); true`);
  const avant = await evaluer(`(() => {
    const S = BITUME_JEU.session, co = S.course, v = co.joueur, e = v.etat, St = co.c.stands, d = v.degats;
    for (let k = 0; k < 12; k++) BITUME.degats.choc(d, 18, { cote: 1, avant: k % 2 === 0 });
    const s = St.garage0 + 10, q = BITUME.circuit.echantillon(co.c, s);
    Object.assign(e, { s, d: St.d, v: 0, gaz: 0, frein: 0, psi: 0, beta: 0, omega: 0, y: q.y,
      accident: null, recuperation: null, saut: null });
    // Un rival arrêté par un ancien accident ne doit pas percuter la voiture du scénario au garage.
    for (const r of co.voitures) if (r !== v) { r.etat.s = (s + co.c.longueur / 2 + r.id * 8) % co.c.longueur; r.etat.v = 15; }
    return { sante: BITUME.degats.sante(d), avaries: BITUME.degats.avaries(d), dureeService: BITUME.degats.chiffrerService(d),
      stands: { garage0: St.garage0, garage1: St.garage1, d: St.d }, pilote: S.reference.pilote, reference: S.reference };
  })()`);
  assert.equal(avant.pilote, false, 'le stand doit recevoir les commandes du joueur, sans IA forcée');
  assert.ok(avant.sante < 1 && avant.dureeService > 0, 'la voiture doit avoir des avaries réparables');
  await evaluer('BITUME_JEU.avancer(.25, false); true');
  await images(2);
  const pendant = await evaluer(`(() => { const S = BITUME_JEU.session, e = S.course.joueur.etat; return {
    phase: e.stands?.phase, t: e.stands?.t, v: e.v, sante: BITUME.degats.sante(e.degats),
    affiche: document.getElementById('h-sante').textContent, phaseAffichee: document.getElementById('c-sante').dataset.phase
  }; })()`);
  assert.equal(pendant.phase, 'service', 'l’arrêt dans le garage doit ouvrir le service');
  assert.ok(Math.abs(pendant.v) < .35, 'la voiture reste immobilisée pendant le service');
  await evaluer(`BITUME_JEU.avancer(${avant.dureeService + .5}, false); true`);
  await images(2);
  const apres = await evaluer(`(() => { const S = BITUME_JEU.session, v = S.course.joueur, e = v.etat, d = v.degats; return {
    phase: e.stands?.phase, repare: !!e.stands?.repare, sante: BITUME.degats.sante(d), adher: d.adher, trainee: d.trainee,
    tourValide: v.tourValide, affiche: document.getElementById('h-sante').textContent,
    phaseAffichee: document.getElementById('c-sante').dataset.phase
  }; })()`);
  assert.equal(apres.repare, true, 'le service doit se terminer');
  assert.equal(apres.sante, 1); assert.equal(apres.adher, 1); assert.equal(apres.trainee, 1);
  assert.equal(apres.tourValide, false, 'le tour d’essai ne devient pas valide au garage');
  return { avant, pendant, apres, horloge: 'avancement explicite au pas fixe, sans qualification FPS' };
}

export async function controlerJeu({ evaluer, envoyer, images, dormir, cible }, options = {}, rapport = { controles: [], limites: [] }) {
  const controles = rapport.controles;
  rapport.limites.push('La synthèse audio est contrôlée par son état ; aucune écoute ni manette physique n’est qualifiée.');
  const touche = async (key, code, virtualKeyCode) => {
    await envoyer('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKeyCode });
    await envoyer('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKeyCode });
  };
  const cliquer = async id => {
    const p = await evaluer(`(() => { const r = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 }; })()`);
    await envoyer('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount: 1 });
    await envoyer('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p, button: 'left', clickCount: 1 });
  };
  const reglages = await evaluer(`(() => {
    BITUME_JEU.pauseAuto = false;
    Object.assign(BITUME_JEU.reglages, { qualite:'low', vue:'poursuite', vue2:'poursuite', difficulte:2, tours:5, demo:'non' });
    BITUME_JEU.rendu.resize('low'); return { ...BITUME_JEU.reglages };
  })()`);
  rapport.audioAvant = await evaluer('BITUME_JEU.son');
  assert.equal(rapport.audioAvant.actif, false, 'aucun son avant geste');
  const stockAvant = await evaluer("localStorage.getItem('bitume.reglages')");
  await evaluer(`BITUME_JEU.reference(${JSON.stringify({ ...options, circuit: 0, mode: 'duo', qualite: 'high', partage: 'haut-bas', vue: 'cockpit', vue2: 'cockpit', retro: 'oui', pilote: true })}); true`);
  // La vraie touche C déclenche le geste audio et le chemin changerVue()/sauverReglages(). Une référence ne
  // doit pas faire fuiter sa qualité, sa météo ni ses tours temporaires vers le stockage du joueur.
  await touche('c', 'KeyC', 67); await images(1);
  assert.equal(await evaluer('BITUME_JEU.reglages.vue'), 'poursuite');
  const stockPendant = await evaluer("localStorage.getItem('bitume.reglages')");
  assert.equal(stockPendant, stockAvant, 'la touche de vue ne doit pas persister les réglages de référence');
  await touche('c', 'KeyC', 67);
  await images(3);
  assert.equal(await evaluer('BITUME_JEU.reglages.vue'), 'cockpit');
  rapport.stockage = { inchange: true, touche: 'KeyC', allerRetour: 'cockpit/poursuite/cockpit' };
  controles.push('changement de vue par vraie touche, stockage local inchangé');
  rapport.duo = await evaluer(`(() => { const S = BITUME_JEU.session; return {
    locaux:S.locaux, reference:S.reference, tailleJ2:[document.getElementById('scene2').width,document.getElementById('scene2').height],
    glaces:['glace-g','glace-d','glace-g2','glace-d2'].map(id => { const e=document.getElementById(id); return { id, visible:!e.hidden && getComputedStyle(e).visibility!=='hidden' }; })
  }; })()`);
  assert.equal(rapport.duo.locaux.length, 2);
  assert.ok(rapport.duo.tailleJ2.every(n => n > 0));
  assert.ok(rapport.duo.glaces.every(g => g.visible), 'les quatre glaces cockpit doivent être visibles');
  controles.push('duo cockpit et quatre rétroviseurs');
  // Input.dispatchKeyEvent produit un événement de navigateur avec activation utilisateur, contrairement à
  // dispatchEvent(new KeyboardEvent(...)) ou à un appel direct de son.demarrer().
  rapport.audioDuo = await evaluer('({ ...BITUME_JEU.son, geste:navigator.userActivation.hasBeenActive })');
  assert.equal(rapport.audioDuo.geste, true); assert.equal(rapport.audioDuo.actif, true);
  assert.equal(rapport.audioDuo.joueurs, 2); assert.ok(rapport.audioDuo.voix <= rapport.audioDuo.budget);
  assert.equal(rapport.audioDuo.musique, false);
  await evaluer(`(() => { const S=BITUME_JEU.session, e=S.course.voitures[S.locaux[1]].etat;
    e.s=(S.course.joueur.etat.s+S.c.longueur/2)%S.c.longueur; BITUME_JEU.avancer(.025,true); })()`);
  await images(2);
  rapport.audioEloigne = await evaluer('BITUME_JEU.son');
  assert.equal(rapport.audioEloigne.joueurs, 2); assert.ok(rapport.audioEloigne.voix <= 5);
  controles.push('geste audio, deux moteurs éloignés et budget de cinq voix');

  await touche('Escape', 'Escape', 27);
  assert.equal(await evaluer('BITUME_JEU.ecran'), 'pause');
  await cliquer('b-abandon'); await images(2);
  rapport.restauration = await evaluer('({ ecran:BITUME_JEU.ecran, reglages:{...BITUME_JEU.reglages}, ratio:BITUME_JEU.rendu.stats.pixelRatio, son:BITUME_JEU.son })');
  assert.equal(rapport.restauration.ecran, 'titre');
  assert.deepEqual(rapport.restauration.reglages, reglages);
  assert.equal(await evaluer("localStorage.getItem('bitume.reglages')"), stockAvant);
  assert.ok(Math.abs(rapport.restauration.ratio - .8) < .001, 'la résolution Légère doit être restaurée');
  assert.equal(rapport.restauration.son.musique, true);
  controles.push('retour au titre, réglages/résolution restaurés, musique au titre');

  rapport.stand = await controlerStand(evaluer, images, { ...options, qualite: 'low' });
  controles.push('service au stand, santé et pénalités réparées, tour invalide');
  await evaluer(`BITUME_JEU.reference(${JSON.stringify({ ...options, circuit: 0, qualite: 'low', mode: 'solo' })}); true`);
  await evaluer('window.FPhysX?.init ? FPhysX.init().then(() => true) : false');
  rapport.crash = await evaluer(`(() => { const S=BITUME_JEU.session, v=S.course.joueur;
    const ev=BITUME.conduite.subirChoc(v.etat,45,{cote:1,front:true}); for(const e of ev)e.id=v.id;
    BITUME.traces.pas(S.fx,S.course,S.cour,0,0,ev);
    return { evenements:ev.map(e=>e.type), debris:BITUME.traces.compter(S.fx).debris,
      pool:BITUME.traces.DEBRIS, corps:S.fx.monde?S.fx.monde._bodies.size:0, physx:window.FPhysX?.status() };
  })()`);
  assert.ok(rapport.crash.debris > 0 && rapport.crash.debris <= rapport.crash.pool);
  if (rapport.crash.physx?.ready) assert.ok(rapport.crash.corps > 0);
  await evaluer('BITUME_JEU.avancer(1.2,true); true'); await images(2);
  rapport.recuperation = await evaluer(`(() => { const v=BITUME_JEU.session.course.joueur,e=v.etat; return {
    accident:!!e.accident, recuperation:!!e.recuperation, sante:BITUME.degats.sante(v.degats), tourValide:v.tourValide,
    finite:[e.s,e.d,e.v,e.y].every(Number.isFinite) }; })()`);
  assert.equal(rapport.recuperation.finite, true); assert.equal(rapport.recuperation.accident, false);
  assert.equal(rapport.recuperation.recuperation, false); assert.equal(rapport.recuperation.tourValide, false);
  controles.push('crash, débris bornés, PhysX si prêt, récupération');

  // Un onglet auxiliaire vérifie la vraie visibilité quand le navigateur sans interface l'expose.
  let autre = null;
  try {
    await evaluer('BITUME_JEU.pauseAuto=true; true');
    autre = (await envoyer('Target.createTarget', { url: 'about:blank' })).targetId;
    await envoyer('Target.activateTarget', { targetId: autre }); await dormir(250);
    rapport.visibilite = await evaluer('({ masque:document.hidden, ecran:BITUME_JEU.ecran, palier:BITUME_JEU.palier })');
    await envoyer('Target.activateTarget', { targetId: cible }); await dormir(100);
  } catch (e) {
    rapport.limites.push('Visibilité native indisponible : ' + e.message);
  } finally {
    if (autre) await envoyer('Target.closeTarget', { targetId: autre });
    await evaluer('BITUME_JEU.pauseAuto=false; true');
  }
  if (rapport.visibilite?.masque) {
    assert.equal(rapport.visibilite.ecran, 'pause');
    controles.push('masquage réel de l’onglet et pause automatique');
  } else if (rapport.visibilite) rapport.limites.push('Ce navigateur sans interface garde la page visible : masquage réel non qualifié.');
  rapport.audioFinal = await evaluer('BITUME_JEU.son');
  assert.equal(rapport.audioFinal.musique, false);
  return rapport;
}
