(async () => {
  // Contrôle du HUD (étape 4) : écritures par seconde des chiffres, dessins du plan, lignes du classement, relance
  // des messages et de l'éclat sans offsetWidth. Horloge rAF commandée, simulation qui tourne (pilote automatique).
  const J = BITUME_JEU;
  const attendre = ms => new Promise(r => setTimeout(r, ms));
  let h = 12345; Math.random = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  const file = []; window.requestAnimationFrame = fn => { file.push(fn); return file.length; };
  await attendre(150);
  let t = performance.now();
  async function tourner(n, ms) {
    for (let i = 0; i < n; i++) { t += ms; const f = file.splice(0); for (const cb of f) cb(t); await attendre(0); }
  }
  // lectures de géométrie forcées : offsetWidth compté pendant les rappels
  let lecturesGeometrie = 0;
  const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { get() { lecturesGeometrie++; return desc.get.call(this); }, configurable: true });
  J.chronoGPU = false;
  J.reference({ circuit: 0, qualite: 'low', vue: 'poursuite', depart: 800 });
  await tourner(30, 1000 / 60);
  const $ = id => document.getElementById(id);
  const sortie = { phase: J.session.course.phase, mode: J.session.course.mode };
  // 1. écritures par seconde à 60 et 144 Hz
  async function compter(hz, secondes) {
    const ecr = { actuel: 0, vitesse: 0, delta: 0, classementLignes: 0, classementCellules: 0 };
    const mo = new MutationObserver(l => {
      for (const m of l) {
        if (m.target === $('h-actuel')) ecr.actuel++;
        else if (m.target === $('h-vitesse')) ecr.vitesse++;
        else if (m.target === $('h-delta')) ecr.delta++;
        else if (m.target === $('classement')) ecr.classementLignes++;
        else if ($('classement').contains(m.target)) ecr.classementCellules++;
      }
    });
    for (const id of ['h-actuel', 'h-vitesse', 'h-delta']) mo.observe($(id), { childList: true, characterData: true });
    mo.observe($('classement'), { childList: true, subtree: true, characterData: true, attributes: true });
    const ctx = $('carte').getContext('2d'), di = ctx.drawImage; let plans = 0;
    ctx.drawImage = function () { plans++; return di.apply(this, arguments); };
    const l0 = lecturesGeometrie;
    await tourner(Math.round(hz * secondes), 1000 / hz);
    await attendre(0);
    mo.disconnect(); ctx.drawImage = di;
    const r = {}; for (const k in ecr) r[k] = +(ecr[k] / secondes).toFixed(1);
    r.plans = +(plans / secondes).toFixed(1); r.lecturesGeometrie = lecturesGeometrie - l0;
    return r;
  }
  sortie.a60 = await compter(60, 2);
  sortie.a144 = await compter(144, 2);
  const carteAvant = J.reglages.carte; J.reglages.carte = 'non';
  sortie.carteMasquee60 = await compter(60, 1);
  J.reglages.carte = carteAvant;
  sortie.carteRevenue60 = await compter(60, 1);
  sortie.lignesClassement = Array.from($('classement').children).map(li => (li.hidden ? '·' : '') + li.className + ':' + li.textContent.replace(/\s+/g, ' ')).join(' | ');
  // 2. messages : rien avant le rappel suivant, relance par alternance de nom, une seule bascule par rappel
  const msg = $('message');
  const anim = el => { const a = el.getAnimations(); return a.length ? { nom: a[0].animationName, t: Math.round(a[0].currentTime) } : null; };
  const touche = () => dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM' }));
  touche();
  const avantRappel = { classe: msg.className, texte: msg.textContent };
  await tourner(1, 1000 / 60);
  const apres1 = { classe: msg.className, texte: msg.textContent, anim: anim(msg) };
  await attendre(400); await tourner(1, 1000 / 60);
  const vieilli = anim(msg);
  touche(); await tourner(1, 1000 / 60);
  const apres2 = { classe: msg.className, texte: msg.textContent, anim: anim(msg) };
  await attendre(400);
  touche(); touche(); await tourner(1, 1000 / 60);   // deux messages avant le même rappel : le dernier, relancé une fois
  const apres3 = { classe: msg.className, texte: msg.textContent, anim: anim(msg) };
  sortie.messages = { avantRappel, apres1, vieilli, apres2, apres3 };
  // 3. éclat de la position (place gagnée)
  const cp = $('c-position');
  J.session.acc = -1;   // simulation figée : aucune place gagnée d'elle-même pendant ce contrôle
  await tourner(2, 1000 / 60);
  const e0 = { classe: cp.className, position: J.session.course.joueur.position };
  J.session.positionPrec = 99; await tourner(1, 1000 / 60);
  const e1 = { classe: cp.className, anim: anim(cp) };
  await attendre(300); await tourner(1, 1000 / 60);
  const e1b = anim(cp);
  J.session.positionPrec = 99; await tourner(1, 1000 / 60);
  const e2 = { classe: cp.className, anim: anim(cp) };
  sortie.eclat = { e0, e1, e1b, e2, position: J.session.course.joueur.position };
  sortie.lecturesGeometrieTotal = lecturesGeometrie;
  return sortie;
})()
