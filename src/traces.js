/* BITUME — traces de pneus, fumée et étincelles, dessinées par la passe transparente du moteur (objets « fx »).
   - Traces : au plus 512 bandes de gomme posées sous les roues qui glissent. Une bande s'allonge tant que la roue
     file droit (3° d'écart, 6 m au plus), pâlit, puis disparaît en 24 s ; la plus ancienne cède sa place.
   - Fumée : au plus 48 bouffées, des roues qui glissent fort ; poussière derrière les roues arrière dans l'herbe.
   - Étincelles : au plus 48, contre la glissière et aux contacts entre voitures.
   Mise à jour à 30 Hz sur le temps de la course ; seules les voitures proches de celle que l'on regarde en laissent.
   Le dessin prolonge fumée et étincelles le long de leur vitesse jusqu'à l'image et n'alloue rien : chaque effet garde
   son objet de rendu. Rien ici ne touche la simulation ; le tirage a sa propre graine. */
(function (B) {
  'use strict';

  const BANDES = 512, FUMEES = 48, ETINCELLES = 48, PAS = 1 / 30, VIE_TRACE = 24;
  const SEUIL_TRACE = .35, SEUIL_FUMEE = .6;     // glisse d'une roue (0 à 1) où naissent la gomme et la fumée
  const PORTEE = 160, VUE = 190;                  // m : voitures prises autour de celle que l'on regarde ; bandes dessinées
  const DROIT = Math.cos(3 * Math.PI / 180), LONGUEUR_MAX = 6, LEVEE = .018, EPAISSEUR = .004;
  const GOMME = [.02, .02, .022], FUMEE = [.82, .82, .8], POUSSIERE = [.58, .5, .38], ETINCELLE = [1, .6, .18];

  function creer(n, graine) {
    const bandes = [];
    for (let i = 0; i < BANDES; i++) {
      bandes.push({
        actif: false, age: 0, a0: 0, gen: 0, larg: .3, roulis: 0, x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0,
        objet: { shape: 'box', p: [0, 0, 0], s: [1, EPAISSEUR, .3], r: [0, 0, 0], fx: true, fxPriority: 'hazard', alpha: 0, color: GOMME }
      });
    }
    const particules = (k, forme, couleur, emissive) => Array.from({ length: k }, () => ({
      actif: false, age: 0, vie: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sol: 0, taille: 1, a0: 0,
      objet: { shape: forme, p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], fx: true, alpha: 0, color: couleur.slice(), emissive }
    }));
    return {
      bandes, prochaine: 0,
      fumees: particules(FUMEES, 'sphere', FUMEE, 0), prochaineFumee: 0,
      etincelles: particules(ETINCELLES, 'box', ETINCELLE, 2.4), prochaineEtincelle: 0,
      // par roue (voiture × 4 + roue) : bande ouverte, son numéro de pose, dernier point de contact et sa validité
      ouverte: new Int32Array(n * 4).fill(-1), genOuverte: new Int32Array(n * 4), valide: new Uint8Array(n * 4), dernier: new Float64Array(n * 12),
      acc: 0, alea: graine32(graine == null ? 1 : graine)
    };
  }

  // Avance les effets de dt secondes de course (à chaque pas de simulation) ; ne travaille qu'à 30 Hz.
  // poses : position et attitude de chaque voiture au dernier pas ; suivie : la voiture que l'on regarde ;
  // ev : les événements du pas (contacts entre voitures).
  function pas(fx, co, poses, suivie, dt, ev) {
    if (ev) for (const e of ev) if (e.type === 'contact') contact(fx, co, poses, e);
    fx.acc += dt;
    if (fx.acc < PAS * .999) return;
    fx.acc = Math.max(0, fx.acc - PAS);
    vieillir(fx, PAS);
    const V = co.voitures, L = co.c.longueur, ref = V[suivie] ? V[suivie].etat.s : 0, choc = B.conduite.PARAMS.chocDuree;
    for (let k = 0; k < V.length; k++) {
      const et = V[k].etat, p = poses[k];
      let ds = (et.s - ref) % L;
      if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      if (!p || (k !== suivie && Math.abs(ds) > PORTEE)) { lacher(fx, k); continue; }
      const M = B.voiture.attitude(p.cap, p.tangage || 0, p.roulis || 0);
      const cap = p.cap - (et.beta || 0), vx = Math.cos(cap) * et.v, vz = Math.sin(cap) * et.v;
      const auSol = !(et.bond > .03), herbe = et.surface === 'herbe';
      for (let w = 0; w < 4; w++) roue(fx, k, w, et, p, M, auSol, herbe, vx, vz);
      // glissière touchée pendant ce trentième de seconde
      if (et.choc > choc - PAS && et.v > 6) mur(fx, et, p, M, vx, vz);
    }
  }

  function lacher(fx, k) {
    for (let w = 0; w < 4; w++) { fx.valide[k * 4 + w] = 0; fx.ouverte[k * 4 + w] = -1; }
  }

  function roue(fx, k, w, et, p, M, auSol, herbe, vx, vz) {
    const i = k * 4 + w, j = i * 3, R = B.voiture.ROUES[w], g = et.roues ? et.roues[w].glisse : 0;
    const o = B.voiture.mul(M, [R.x, LEVEE, R.z]), X = p.x + o[0], Y = p.y + o[1], Z = p.z + o[2];
    const dx = X - fx.dernier[j], dz = Z - fx.dernier[j + 2];
    const suite = fx.valide[i] && dx * dx + dz * dz < 64;            // pas de bande à travers un replacement
    if (suite && auSol && !herbe && et.v > 2 && g > SEUIL_TRACE) poser(fx, i, fx.dernier[j], fx.dernier[j + 1], fx.dernier[j + 2], X, Y, Z, R.l * .8, g, p.roulis || 0);
    else fx.ouverte[i] = -1;
    fx.dernier[j] = X; fx.dernier[j + 1] = Y; fx.dernier[j + 2] = Z; fx.valide[i] = 1;
    if (!auSol || et.v < 4) return;
    const fort = herbe ? (w >= 2 ? .6 * Math.min(1, et.v / 30) : 0) : (g - SEUIL_FUMEE) / (1 - SEUIL_FUMEE);
    if (fort > 0 && fx.alea() < .08 + .22 * Math.min(1, fort)) fumer(fx, X, Y, Z, vx, vz, herbe ? POUSSIERE : FUMEE, Math.min(1, fort));
  }

  // Gomme de (x0, y0, z0) à (x1, y1, z1) : allonge la bande ouverte de la roue si elle file droit, sinon en ouvre une
  // autre, à la place de la plus ancienne.
  function poser(fx, i, x0, y0, z0, x1, y1, z1, larg, g, roulis) {
    const a0 = .62 * Math.min(1, .3 + (g - SEUIL_TRACE) / (1 - SEUIL_TRACE));
    let b = fx.ouverte[i] >= 0 ? fx.bandes[fx.ouverte[i]] : null;
    if (b && b.actif && b.gen === fx.genOuverte[i]) {
      const ux = b.x1 - b.x0, uz = b.z1 - b.z0, lx = x1 - b.x0, lz = z1 - b.z0, lu = Math.hypot(ux, uz), ll = Math.hypot(lx, lz);
      if (ll <= LONGUEUR_MAX && lu > 1e-3 && (ux * lx + uz * lz) >= DROIT * lu * ll) {
        b.x1 = x1; b.y1 = y1; b.z1 = z1; b.a0 = Math.max(b.a0, a0); b.age = 0;
        placer(b);
        return;
      }
    }
    const n = fx.prochaine;
    fx.prochaine = (n + 1) % BANDES;
    b = fx.bandes[n];
    b.actif = true; b.age = 0; b.a0 = a0; b.gen++; b.larg = larg; b.roulis = roulis;
    b.x0 = x0; b.y0 = y0; b.z0 = z0; b.x1 = x1; b.y1 = y1; b.z1 = z1;
    fx.ouverte[i] = n; fx.genOuverte[i] = b.gen;
    placer(b);
  }

  // Boîte plate couchée de l'un à l'autre bout, au dévers de la voiture qui l'a posée
  function placer(b) {
    const dx = b.x1 - b.x0, dy = b.y1 - b.y0, dz = b.z1 - b.z0, lh = Math.hypot(dx, dz), o = b.objet;
    o.p[0] = (b.x0 + b.x1) / 2; o.p[1] = (b.y0 + b.y1) / 2; o.p[2] = (b.z0 + b.z1) / 2;
    o.s[0] = Math.hypot(lh, dy) + b.larg * .5; o.s[2] = b.larg;
    orienter(o.r, Math.atan2(dz, dx), Math.atan2(dy, lh), b.roulis);
  }

  function orienter(r, cap, tangage, roulis) {
    const a = B.voiture.angles(B.voiture.attitude(cap, tangage, roulis));
    r[0] = a[0]; r[1] = a[1]; r[2] = a[2];
  }

  function fumer(fx, x, y, z, vx, vz, couleur, fort) {
    const f = fx.fumees[fx.prochaineFumee], a = fx.alea;
    fx.prochaineFumee = (fx.prochaineFumee + 1) % FUMEES;
    f.actif = true; f.age = 0; f.vie = 1.1 + .5 * a();
    f.x = x; f.y = y + .2; f.z = z;
    f.vx = vx * .3 + (a() - .5) * 1.6; f.vy = .4 + .5 * a(); f.vz = vz * .3 + (a() - .5) * 1.6;
    f.taille = .7 + .5 * fort; f.a0 = (.18 + .2 * fort) * (couleur === POUSSIERE ? 1.2 : 1);
    f.objet.color[0] = couleur[0]; f.objet.color[1] = couleur[1]; f.objet.color[2] = couleur[2];
  }

  function etinceler(fx, x, y, z, vx, vy, vz, sol, dispersion) {
    const e = fx.etincelles[fx.prochaineEtincelle], a = fx.alea;
    fx.prochaineEtincelle = (fx.prochaineEtincelle + 1) % ETINCELLES;
    e.actif = true; e.age = 0; e.vie = .25 + .3 * a();
    e.x = x; e.y = y; e.z = z; e.sol = sol;
    e.vx = vx + (a() - .5) * dispersion; e.vy = vy + a() * dispersion * .6; e.vz = vz + (a() - .5) * dispersion;
    orienterEtincelle(e);
  }
  function orienterEtincelle(e) {
    orienter(e.objet.r, Math.atan2(e.vz, e.vx), Math.atan2(e.vy, Math.hypot(e.vx, e.vz)), 0);
  }

  // Flanc qui frotte la glissière : des étincelles le long de la caisse, qui partent avec la voiture
  function mur(fx, et, p, M, vx, vz) {
    const cote = et.d < 0 ? -1 : 1;
    for (let n = 0; n < 3; n++) {
      const o = B.voiture.mul(M, [.6 - 2.2 * fx.alea(), .22, cote * 1.02]);
      etinceler(fx, p.x + o[0], p.y + o[1], p.z + o[2], vx * .75, 1.2, vz * .75, p.y, 5);
    }
  }

  // Contact entre deux voitures : une gerbe entre elles, à leur vitesse moyenne
  function contact(fx, co, poses, e) {
    const a = poses[e.a], b = poses[e.b];
    if (!a || !b) return;
    const ea = co.voitures[e.a].etat, eb = co.voitures[e.b].etat;
    const ca = a.cap - (ea.beta || 0), cb = b.cap - (eb.beta || 0);
    const vx = .4 * (Math.cos(ca) * ea.v + Math.cos(cb) * eb.v), vz = .4 * (Math.sin(ca) * ea.v + Math.sin(cb) * eb.v), sol = (a.y + b.y) / 2;
    for (let n = 0, m = 4 + Math.min(6, Math.max(0, Math.round(e.force || 0))); n < m; n++)
      etinceler(fx, (a.x + b.x) / 2, sol + .3, (a.z + b.z) / 2, vx, 1.5, vz, sol, 6);
  }

  function vieillir(fx, h) {
    for (const b of fx.bandes) if (b.actif && (b.age += h) >= VIE_TRACE) b.actif = false;
    const amorti = Math.exp(-h * 1.6);
    for (const f of fx.fumees) {
      if (!f.actif) continue;
      if ((f.age += h) >= f.vie) { f.actif = false; continue; }
      f.x += f.vx * h; f.y += f.vy * h; f.z += f.vz * h;
      f.vx *= amorti; f.vz *= amorti; f.vy = f.vy * amorti + .5 * h;
    }
    for (const e of fx.etincelles) {
      if (!e.actif) continue;
      if ((e.age += h) >= e.vie) { e.actif = false; continue; }
      e.x += e.vx * h; e.y += e.vy * h; e.z += e.vz * h; e.vy -= 9.81 * h;
      if (e.y < e.sol && e.vy < 0) { e.y = e.sol; e.vy *= -.35; e.vx *= .6; e.vz *= .6; }
      orienterEtincelle(e);
    }
  }

  // Pousse dans `sortie` les effets visibles depuis `oeil` ; h : temps de course écoulé depuis la dernière mise à jour.
  function dessiner(fx, sortie, oeil, h) {
    const vue2 = VUE * VUE;
    for (const b of fx.bandes) {
      if (!b.actif) continue;
      const o = b.objet, dx = o.p[0] - oeil[0], dz = o.p[2] - oeil[2];
      if (dx * dx + dz * dz > vue2) continue;
      o.alpha = b.a0 * Math.min(1, 1.6 * (1 - (b.age + h) / VIE_TRACE));
      if (o.alpha > .004) sortie.push(o);
    }
    for (const f of fx.fumees) {
      if (!f.actif) continue;
      const t = Math.min(1, (f.age + h) / f.vie), o = f.objet, d = f.taille * (.5 + 2.7 * (1 - (1 - t) * (1 - t)));
      o.p[0] = f.x + f.vx * h; o.p[1] = f.y + f.vy * h; o.p[2] = f.z + f.vz * h;
      o.s[0] = d; o.s[1] = d * .8; o.s[2] = d;
      o.alpha = f.a0 * Math.pow(1 - t, 1.6) * Math.min(1, t * 8);
      if (o.alpha > .004) sortie.push(o);
    }
    for (const e of fx.etincelles) {
      if (!e.actif) continue;
      const o = e.objet, v = Math.hypot(e.vx, e.vy, e.vz);
      o.p[0] = e.x + e.vx * h; o.p[1] = e.y + e.vy * h; o.p[2] = e.z + e.vz * h;
      o.s[0] = Math.max(.06, Math.min(.5, v * .02)); o.s[1] = .028; o.s[2] = .028;
      o.alpha = Math.max(0, 1 - (e.age + h) / e.vie);
      if (o.alpha > .004) sortie.push(o);
    }
  }

  // Effets vivants, pour les essais et le banc
  function compter(fx) {
    let bandes = 0, fumees = 0, etincelles = 0;
    for (const b of fx.bandes) if (b.actif) bandes++;
    for (const f of fx.fumees) if (f.actif) fumees++;
    for (const e of fx.etincelles) if (e.actif) etincelles++;
    return { bandes, fumees, etincelles };
  }

  function graine32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  B.traces = { creer, pas, dessiner, compter, BANDES, FUMEES, ETINCELLES, VIE_TRACE, PAS };
})(globalThis.BITUME = globalThis.BITUME || {});
