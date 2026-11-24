/* BITUME — voitures et débris dans une même scène PhysX.
   PhysX intègre exclusivement les poses : Frenet sert à l'IA, au classement et au HUD.
   Les pneus calculent des forces ; quatre ressorts amortis prennent appui sur le sol dessiné.
   setPose est réservé au placement initial, au retour demandé et aux acteurs réseau distants. */
(function (B) {
  'use strict';
  const G = 9.81, DT = 1 / 120, SOL = 1, OBSTACLE = 2, VOITURE = 4, DEBRIS = 8;
  // Suspensions F1 raides (poussoirs courts, débattement compact) pour réactions vives et vrais sauts sur crêtes/tremplins.
  const PROFIL = Object.freeze({ masse: 600, empattement: 2.70, repartition: .44, hauteurCG: .33,
    inertie: Object.freeze([210, 1014, 980]), courseRepos: .08, courseLibre: .105, courseMax: .17,
    amortissement: .64, forceMaxRoue: 30000 });
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const angle = x => x - 2 * Math.PI * Math.round(x / (2 * Math.PI));
  const wrap = (x, L) => (x % L + L) % L;
  const delta = (a, b, L) => { let d = b - a; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d; };
  const vec = () => [0, 0, 0];
  const roues = () => B.pneus.ROUES;
  function tourner(q, v, out) {
    const x = v[0], y = v[1], z = v[2], qx = q[3], qy = q[4], qz = q[5], qw = q[6];
    const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
    out[0] = x + qw * tx + qy * tz - qz * ty; out[1] = y + qw * ty + qz * tx - qx * tz;
    out[2] = z + qw * tz + qx * ty - qy * tx; return out;
  }
  function monde(p, local, out) { tourner(p, local, out); out[0] += p[0]; out[1] += p[1]; out[2] += p[2]; return out; }
  function quaternion(cap, tangage, roulis) {
    // Ry(-cap) Rz(tangage) Rx(roulis), mêmes axes que voiture.attitude.
    const cy = Math.cos(cap / 2), sy = -Math.sin(cap / 2), cz = Math.cos(tangage / 2), sz = Math.sin(tangage / 2), cx = Math.cos(roulis / 2), sx = Math.sin(roulis / 2);
    return [cy * cz * sx + sy * sz * cx, sy * cz * cx + cy * sz * sx,
      cy * sz * cx - sy * cz * sx, cy * cz * cx - sy * sz * sx];
  }
  function projeter(c, x, z, s, out) {
    let best = Infinity, bestS = s, bestD = 0, centre = Math.floor(wrap(s, c.longueur) / c.pas);
    function cherche(radius) {
      for (let k = -radius; k <= radius; k++) {
        const i = c.ouvert ? centre + k : (centre + k + c.n) % c.n;
        if (c.ouvert && (i < 0 || i >= c.n - 1)) continue;
        const j = (i + 1) % c.n, dx = c.x[j] - c.x[i], dz = c.z[j] - c.z[i];
        const l2 = dx * dx + dz * dz, t = l2 > 0 ? clamp(((x - c.x[i]) * dx + (z - c.z[i]) * dz) / l2, 0, 1) : 0;
        const ex = x - c.x[i] - t * dx, ez = z - c.z[i] - t * dz, d2 = ex * ex + ez * ez;
        if (d2 < best) { best = d2; bestS = (i + t) * c.pas; bestD = l2 > 0 ? (ez * dx - ex * dz) / Math.sqrt(l2) : 0; }
      }
    }
    cherche(12);
    if (best > 100 * 100) { centre = Math.floor(c.n / 2); cherche(Math.ceil(c.n / 2) - 1); }
    out.s = wrap(bestS, c.longueur); out.d = bestD; return out;
  }
  function lecture(ph, progression = true, synchroniser = true) {
    const { world, id, e, c } = ph;
    world.readPose(id, ph.pose); world.readVelocity(id, ph.velocity); world.readAngularVelocity(id, ph.angular);
    tourner(ph.pose, [1, 0, 0], ph.forward); tourner(ph.pose, [0, 1, 0], ph.up); tourner(ph.pose, [0, 0, 1], ph.right);
    monde(ph.pose, ph.cgLocal, ph.cg);
    const vv = ph.velocity, av = ph.angular, f = ph.forward, r = ph.right, u = ph.up;
    ph.u = vv[0] * f[0] + vv[1] * f[1] + vv[2] * f[2]; ph.w = vv[0] * r[0] + vv[1] * r[1] + vv[2] * r[2];
    ph.cap = Math.atan2(f[2], f[0]); ph.x = ph.pose[0]; ph.y = ph.pose[1]; ph.z = ph.pose[2];
    if (!synchroniser) return;
    const ancien = e.s;
    projeter(c, ph.pose[0], ph.pose[2], e.s, ph.projection); e.s = ph.projection.s; e.d = ph.projection.d;
    if (progression) e.distance += Math.abs(delta(ancien, e.s, c.longueur));
    const q = B.circuit.echantillon(c, e.s, ph.echantillon), cap = ph.cap;
    const speed = Math.hypot(ph.u, ph.w), sign = ph.u < -.04 ? -1 : 1;
    e.v = sign * speed; e.beta = speed > .04 ? -Math.atan2(ph.w * sign, ph.u * sign) : 0;
    e.psi = angle(cap - q.cap - e.beta); e.omega = -(av[0] * u[0] + av[1] * u[1] + av[2] * u[2]);
    e.y = ph.pose[1]; e.tangage = Math.asin(clamp(f[1], -1, 1)); e.roulis = Math.atan2(-r[1], u[1]);
    ph.repositionnements = e.repositionnements || 0;
  }
  function poseDepart(ph) {
    const e = ph.e, q = B.circuit.echantillon(ph.c, e.s), cap = q.cap + e.psi + e.beta;
    const rel = cap - q.cap, pente = (q.pente || 0) * Math.cos(rel) - Math.tan(q.devers || 0) * Math.sin(rel);
    ph.cap = cap;
    let tangage = Math.atan(pente), bank = Math.atan((q.pente || 0) * Math.sin(rel) + Math.tan(q.devers || 0) * Math.cos(rel));
    const x = q.x - Math.sin(q.cap) * e.d, z = q.z + Math.cos(q.cap) * e.d;
    const demi = ph.c.largeur / 2;
    const dSol = ph.c.partition === 'ovale-des-forges' ? clamp(e.d, -demi, demi) : e.d;
    let baseY = q.y - dSol * Math.tan(q.devers || 0);
    // Prendre le plan de la face sous la caisse, y compris dans les raccords et les box.
    ph.from[0] = x; ph.from[1] = baseY + 5; ph.from[2] = z;
    const sol = ph.world.raycast(ph.from, [0, -1, 0], 18, { mask: SOL, staticOnly: true }, ph.hit);
    if (sol.hit && sol.ny > .65) {
      const co = Math.cos(cap), si = Math.sin(cap);
      tangage = Math.atan2(-(sol.nx * co + sol.nz * si), sol.ny);
      bank = Math.atan2((-sol.nx * si + sol.nz * co) * Math.cos(tangage), sol.ny);
      baseY = sol.y;
    }
    const p = [x, baseY, z, ...quaternion(cap, tangage, bank)];
    // Quatre sondes de placement, dans le même maillage que la suspension. Une seule correction au départ.
    let y = p[1];
    for (const roue of roues()) {
      monde(p, [roue.x, roue.r, roue.z], ph.tmp);
      ph.from[0] = ph.tmp[0]; ph.from[1] = ph.tmp[1] + 3; ph.from[2] = ph.tmp[2];
      const hit = ph.world.raycast(ph.from, [0, -1, 0], 10, { mask: SOL, staticOnly: true }, ph.hit);
      if (hit.hit) y = Math.max(y, hit.y + roue.r - (ph.tmp[1] - p[1]) + .025);
    }
    p[1] = y; return p;
  }
  function lancerSurSol(ph, pose, vitesse) {
    const avant = tourner(pose, [1, 0, 0], ph.tmp);
    const pente = avant[1] / Math.hypot(avant[0], avant[2]);
    const inv = 1 / Math.hypot(1, pente);
    const cap = ph.cap;
    ph.world.setVelocity(ph.id, [Math.cos(cap) * vitesse * inv, pente * vitesse * inv, Math.sin(cap) * vitesse * inv]);
  }
  function corps(ph, continuite) {
    // Garde au sol du fond plat (0,15 m) et faible frottement de glisse (0,15) : évite au coin avant
    // du boîtier d'accrocher une arête interne des triangles sur les rampes de dévers 40° ou bosses.
    const shapes = [{ type: 'box', half: [1.98, .20, .69], pose: [-.12, .35, 0, 0, 0, 0, 1], friction: .15, restitution: .04 }];
    // Les contacts latéraux des roues peuvent soulever la caisse ; le contact normal roulant vient des ressorts.
    for (const roue of roues()) {
      const vertices = [];
      for (const cote of [-1, 1]) for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8; vertices.push(roue.r * Math.cos(a), roue.r * Math.sin(a), cote * roue.l / 2);
      }
      shapes.push({ type: 'convex', vertices, pose: [roue.x, roue.r, roue.z, 0, 0, 0, 1], friction: .35, restitution: .06,
        group: VOITURE, mask: OBSTACLE | VOITURE | DEBRIS, queryGroup: VOITURE });
    }
    const p = continuite ? continuite.pose : poseDepart(ph), dynamique = !ph.v.distant;
    ph.id = ph.world.addCompound(p.slice(0, 3), shapes, { type: dynamique ? 'dynamic' : 'kinematic', quaternion: p.slice(3),
      mass: ph.mass, inertia: ph.inertia, centerOfMass: ph.cgLocal, ccd: dynamique, linearDamping: .005, angularDamping: .035,
      solverIterations: [8, 3], group: VOITURE, mask: SOL | OBSTACLE | VOITURE | DEBRIS, queryGroup: VOITURE });
    ph.distant = !!ph.v.distant;
    if (dynamique && continuite) {
      ph.world.setVelocity(ph.id, continuite.velocity); ph.world.setAngularVelocity(ph.id, continuite.angular);
    } else if (dynamique && Math.abs(ph.e.v) > .01) {
      lancerSurSol(ph, p, ph.e.v);
    }
    lecture(ph, false);
  }
  function installer(co, decor, options = {}) {
    const X = globalThis.FPhysX;
    if (!X || !X.isReady() || !B.solidesPhysX) throw new Error('PhysX et les solides doivent être prêts avant la course');
    if (co.physique) return co.physique;
    const world = X.createWorld({ fixedStep: DT, maxSubSteps: 8, ccdMaxPasses: 8, contacts: true, maxContactPoints: 512 });
    const p = { world, co, voitures: [], byId: new Map(), collisions: new Map(), envols: new Map(), impacts: new Map(), temps: 0,
      pas: 0, placements: 0, disposed: false, solids: null, backend: 'PhysX', version: X.status().version };
    try {
      p.solids = B.solidesPhysX.installer(world, co.c, decor);
      for (const v of co.voitures) {
        const mass = options.masses?.[v.id] || PROFIL.masse, front = PROFIL.repartition;
        const ph = { e: v.etat, v, c: co.c, world, course: p, mass, inertia: PROFIL.inertie.map(x => x * mass / PROFIL.masse),
          wheelbase: PROFIL.empattement, front, cgLocal: [PROFIL.empattement * (front - .5), PROFIL.hauteurCG, 0], cg: vec(),
          pose: [0, 0, 0, 0, 0, 0, 1], velocity: vec(), angular: vec(), beforeVelocity: vec(), forward: vec(), up: vec(), right: vec(),
          projection: {}, echantillon: {}, from: vec(), tmp: vec(), force: vec(), hit: {}, contacts: [], offsets: [0, 0, 0, 0],
          forces: { avant: [0, 0], arriere: [0, 0], resistance: [0, 0], appui: 0 }, retenue: false, controle: false,
          airborne: 0, groundCount: 0, surface: 'piste', repositionnements: v.etat.repositionnements || 0, cap: 0,
          remote: new Float64Array(11), hasRemote: false };
        roues().forEach((roue, i) => ph.contacts.push({ i, roue, hit: {}, anchor: vec(), point: vec(), normal: [0, 1, 0], tangent: vec(), right: vec(), velocity: vec(),
          shapePose: [roue.x, roue.r, roue.z, 0, 0, 0, 1], load: 0, capacity: 0, fx: 0, fy: 0, surface: 'herbe', distance: PROFIL.courseMax + roue.r, k: mass * G * (i < 2 ? front : 1 - front) / 2 / (PROFIL.courseLibre - PROFIL.courseRepos) }));
        corps(ph, options.continuite?.[v.id]); p.voitures.push(ph); p.byId.set(ph.id, ph);
        Object.defineProperty(v.etat, '_physx', { value: ph, configurable: true, writable: true });
      }
      co.physique = p; return p;
    } catch (err) {
      for (const ph of p.voitures) if (ph.e._physx === ph) delete ph.e._physx;
      p.voitures.length = 0; p.byId.clear();
      world.dispose(); throw err;
    }
  }
  function vitessePoint(ph, point, out) {
    const r0 = point[0] - ph.cg[0], r1 = point[1] - ph.cg[1], r2 = point[2] - ph.cg[2], w = ph.angular, v = ph.velocity;
    out[0] = v[0] + w[1] * r2 - w[2] * r1; out[1] = v[1] + w[2] * r0 - w[0] * r2; out[2] = v[2] + w[0] * r1 - w[1] * r0;
  }
  function suspensions(ph, dt) {
    let nb = 0, dominant = -1, surface = 'herbe';
    const dir = ph.tmp; dir[0] = -ph.up[0]; dir[1] = -ph.up[1]; dir[2] = -ph.up[2];
    for (const w of ph.contacts) {
      const roue = w.roue;
      monde(ph.pose, [roue.x, roue.r + PROFIL.courseRepos, roue.z], w.anchor);
      const hit = ph.world.raycast(w.anchor, dir, roue.r + PROFIL.courseMax, { mask: SOL, staticOnly: true }, w.hit);
      w.load = 0; w.capacity = 0; w.fx = 0; w.fy = 0; w.distance = hit.hit ? hit.distance : roue.r + PROFIL.courseMax;
      const incidence = hit.hit ? hit.nx * ph.up[0] + hit.ny * ph.up[1] + hit.nz * ph.up[2] : 1;
      const braquage = w.i < 2 ? ph.e.braquage || 0 : 0, cd = Math.cos(braquage), sd = Math.sin(braquage);
      const axial = hit.hit ? hit.nx * (ph.right[0] * cd - ph.forward[0] * sd)
        + hit.ny * (ph.right[1] * cd - ph.forward[1] * sd) + hit.nz * (ph.right[2] * cd - ph.forward[2] * sd) : 0;
      const support = roue.r * Math.sqrt(Math.max(0, 1 - axial * axial)) + roue.l * .5 * Math.abs(axial);
      const rayon = hit.hit && incidence > .35 ? support / incidence : roue.r;
      ph.offsets[w.i] = ph.distant && ph.hasRemote ? ph.remote[6 + w.i] : clamp(PROFIL.courseRepos - (w.distance - rayon), -.085, .075);
      if (ph.world.setShapePose) {
        w.shapePose[1] = roue.r + ph.offsets[w.i]; w.shapePose[4] = -Math.sin(braquage / 2); w.shapePose[6] = Math.cos(braquage / 2);
        ph.world.setShapePose(ph.id, w.i + 1, w.shapePose);
      }
      if (!hit.hit || incidence < .35 || ph.up[1] < .15 || hit.ny < .12 || ph.e.degats?.roues?.[w.i]) continue;
      const n = w.normal; n[0] = hit.nx; n[1] = hit.ny; n[2] = hit.nz;
      w.point[0] = hit.x; w.point[1] = hit.y; w.point[2] = hit.z;
      vitessePoint(ph, w.point, w.velocity);
      const vitesse = w.velocity[0] * n[0] + w.velocity[1] * n[1] + w.velocity[2] * n[2];
      const masseRoue = ph.mass * (w.i < 2 ? ph.front : 1 - ph.front) / 2;
      const amort = 2 * Math.sqrt(w.k * masseRoue) * PROFIL.amortissement;
      const compression = PROFIL.courseLibre - (hit.distance - rayon);
      w.load = compression > 0 ? clamp(w.k * compression - amort * vitesse, 0, PROFIL.forceMaxRoue * ph.mass / PROFIL.masse) : 0;
      if (w.load > 0) nb++;
      const type = B.solidesPhysX.surface?.(ph.course.solids, hit.body, hit.faceIndex);
      w.surface = typeof type === 'string' ? type : type?.type || 'herbe';
      if (w.load > dominant) { surface = w.surface; dominant = w.load; }
      const dot = ph.forward[0] * n[0] + ph.forward[1] * n[1] + ph.forward[2] * n[2];
      let len = 0; for (let j = 0; j < 3; j++) { w.tangent[j] = ph.forward[j] - n[j] * dot; len += w.tangent[j] ** 2; }
      len = Math.sqrt(len) || 1; for (let j = 0; j < 3; j++) w.tangent[j] /= len;
      const t = w.tangent; w.right[0] = t[1] * n[2] - t[2] * n[1]; w.right[1] = t[2] * n[0] - t[0] * n[2]; w.right[2] = t[0] * n[1] - t[1] * n[0];
    }
    ph.groundCount = nb; ph.surface = surface; ph.airborne = nb ? 0 : ph.airborne + dt;
    if (ph.e.saut?.physx) { ph.e.saut.t += dt; if (nb > 0 && ph.e.saut.t > .1) ph.e.saut = null; }
  }
  function avant(co, dt, retenue) {
    const p = co.physique; if (!p || p.disposed) return;
    p.temps = co.horloge;
    for (const ph of p.voitures) {
      if (ph.distant !== !!ph.v.distant) {
        // Un changement d'autorité conserve l'état réel, même pendant un saut ou une glissade.
        const continuite = { pose: ph.world.readPose(ph.id), velocity: ph.world.readVelocity(ph.id), angular: ph.world.readAngularVelocity(ph.id) };
        if (ph.distant && ph.hasRemote) {
          for (let i = 0; i < 3; i++) { continuite.velocity[i] = ph.remote[i]; continuite.angular[i] = ph.remote[3 + i]; }
        }
        p.byId.delete(ph.id); ph.world.remove(ph.id); corps(ph, continuite); p.byId.set(ph.id, ph);
        if (!ph.distant) ph.hasRemote = false;
      }
      if (ph.distant) continue;
      if ((ph.e.repositionnements || 0) !== ph.repositionnements) replacer(ph);
      lecture(ph, false); ph.beforeVelocity.splice(0, 3, ...ph.velocity); ph.retenue = retenue; ph.controle = false;
      ph.forces.avant.fill(0); ph.forces.arriere.fill(0); ph.forces.resistance.fill(0); ph.forces.appui = 0;
      suspensions(ph, dt);
    }
  }
  function replacer(ph) {
    const p = poseDepart(ph); ph.world.setPose(ph.id, p); ph.world.setVelocity(ph.id, [0, 0, 0]); ph.world.setAngularVelocity(ph.id, [0, 0, 0]);
    ph.course.placements++; lecture(ph, false);
  }
  function repositionner(co) {
    const p = co && co.physique; if (!p) return;
    for (const ph of p.voitures) {
      const pose = poseDepart(ph);
      ph.world.setPose(ph.id, pose);
      lancerSurSol(ph, pose, ph.e.v || 0);
      ph.world.setAngularVelocity(ph.id, [0, 0, 0]);
      lecture(ph, false);
    }
  }
  function appliquer(ph, dt) {
    const e = ph.e, F = ph.forces, world = ph.world, hold = ph.retenue || !!e.recuperation || (e.frein > .08 && Math.abs(e.v) < .45 && !e.gaz && e.rapport !== -1);
    const poids = ph.contacts.reduce((s, q) => s + q.load, 0);
    const chaussee = hold ? B.chaussee.lire(ph.c, e.s) : null;
    for (const w of ph.contacts) {
      const charge = w.load; e.roues[w.i].charge = charge;
      if (!(charge > 0)) continue;
      const essieu = w.i < 2 ? F.avant : F.arriere, total = ph.contacts[w.i & 2].capacity + ph.contacts[(w.i & 2) + 1].capacity;
      // Répartir suivant les capacités locales garde chaque pneu dans son ellipse sur un sol dissymétrique.
      let fx = essieu[0] * w.capacity / Math.max(total, 1), fy = essieu[1] * w.capacity / Math.max(total, 1);
      if (hold) {
        // Frein statique borné par l'adhérence : il compense la gravité tangentielle, sans verrou de position.
        const vp = w.velocity, t = w.tangent, r = w.right, masse = ph.mass * charge / Math.max(poids, 1);
        fx = -masse * (vp[0] * t[0] + vp[1] * t[1] + vp[2] * t[2]) / dt + masse * G * t[1];
        fy = -masse * (vp[0] * r[0] + vp[1] * r[1] + vp[2] * r[2]) / dt + masse * G * r[1];
        w.capacity = B.conduite.capaciteRoue(e, w, chaussee);
        const effort = Math.hypot(fx, fy), max = w.capacity;
        if (effort > max) { fx *= max / effort; fy *= max / effort; }
      }
      w.fx = fx; w.fy = fy;
      for (let j = 0; j < 3; j++) ph.force[j] = w.normal[j] * charge + w.tangent[j] * fx + w.right[j] * fy;
      world.force(ph.id, ph.force, w.point);
    }
    for (let j = 0; j < 3; j++) ph.force[j] = ph.forward[j] * F.resistance[0] + ph.right[j] * F.resistance[1];
    world.force(ph.id, ph.force);
    // Appui aérodynamique réel : l'effet de sol chute quand les roues décollent d'une crête/tremplin,
    // permettant à la F1 de décoller franchement au lieu de coller artificiellement à la route.
    if (F.appui > 0) {
      const effetSol = 0.24 + 0.76 * (ph.groundCount / 4);
      const appuiEffectif = F.appui * effetSol;
      for (const [x, part] of [[1.35, B.conduite.PARAMS.aeroAvant], [-1.35, 1 - B.conduite.PARAMS.aeroAvant]]) {
        monde(ph.pose, [x, .3, 0], ph.tmp); for (let j = 0; j < 3; j++) ph.force[j] = -ph.up[j] * appuiEffectif * part;
        world.force(ph.id, ph.force, ph.tmp);
      }
    }
  }
  const PA_ROUE = vec(), PB_ROUE = vec(), VEL_ENVOL = vec(), ANG_ENVOL = vec();
  // Contact pneu contre pneu (style Vroom / F1 roues découvertes) : l'engrenage des deux bandes de
  // roulement tournant en sens contraire soulève logiquement la roue avant (cabrage, roulis et saut
  // proportionnels à la vitesse), sans jamais se déclencher sur un simple frôlement de carrosserie.
  function envolPneuContrePneu(p, key, A, C, magnitude, impact, ev) {
    if (!A || !C) return;
    if (p.temps - (p.envols.get(key) ?? -Infinity) < .65) return;
    const vA = Math.hypot(A.velocity[0], A.velocity[2]), vC = Math.hypot(C.velocity[0], C.velocity[2]);
    const vMax = Math.max(vA, vC);
    if (vMax < 16 || magnitude < 180) return;
    const vitesseA=A.distant?A.velocity:A.beforeVelocity, vitesseC=C.distant?C.velocity:C.beforeVelocity;
    const deltaX = vitesseA[0] - vitesseC[0], deltaZ = vitesseA[2] - vitesseC[2];
    const vitesseRelative = Math.hypot(deltaX, deltaZ);
    if (vitesseRelative < 3) return;
    // À forte vitesse relative, un impact rasant peut fermer lentement l’écart entre les roues.
    const seuilFermeture = 3 - 2.5 * clamp((vitesseRelative - 16) / 24, 0, 1);
    const cx=impact.px/impact.poids,cz=impact.pz/impact.poids;
    const R = roues();
    let meilleur = null;
    for (let i = 0; i < 4; i++) {
      const rA = R[i];
      monde(A.pose, [rA.x, rA.r + (A.offsets[i] || 0), rA.z], PA_ROUE);
      for (let j = 0; j < 4; j++) {
        const rC = R[j];
        monde(C.pose, [rC.x, rC.r + (C.offsets[j] || 0), rC.z], PB_ROUE);
        const dx = PB_ROUE[0] - PA_ROUE[0], dy = PB_ROUE[1] - PA_ROUE[1], dz = PB_ROUE[2] - PA_ROUE[2];
        const distXZ = Math.hypot(dx, dz), seuil = (rA.r + rC.r) * .95 + (rA.l + rC.l) * .35 + .14;
        if (distXZ > seuil || Math.abs(dy) > rA.r + rC.r + .12) continue;
        // Le barycentre de contact doit être dans le voisinage des pneus concernés sur les deux châssis.
        // Un contact au centre de la boîte de vitesses ne devient pas un engrenage par proximité latérale.
        if(Math.hypot(cx-PA_ROUE[0],cz-PA_ROUE[2])>rA.r+rA.l*.5+.24 ||
           Math.hypot(cx-PB_ROUE[0],cz-PB_ROUE[2])>rC.r+rC.l*.5+.24)continue;
        const fermeture = (dx * deltaX + dz * deltaZ) / Math.max(.001, distXZ);
        if (fermeture < seuilFermeture) continue;
        // Priorité à l'engrenage roue avant sur roue arrière (vrai soulèvement open-wheel).
        const avantSurArriere = (i < 2 && j >= 2) ? 1 : (j < 2 && i >= 2) ? -1 : 0;
        const score = (avantSurArriere ? 2 : 1) / (distXZ + .05);
        if (!meilleur || score > meilleur.score) meilleur = { i, j, avantSurArriere, fermeture, score };
      }
    }
    if (!meilleur) return;
    if (!meilleur.avantSurArriere && (vMax < 24 || magnitude < 380)) return;
    // Qui grimpe : celui dont la roue avant engage la roue arrière adverse, sinon le plus rapide.
    const grimpeA = meilleur.avantSurArriere === 1 ? true : meilleur.avantSurArriere === -1 ? false : vA >= vC;
    const L = grimpeA ? A : C, cible = grimpeA ? C : A;
    if (L.distant || L.airborne > .22) return;
    const iRoue = grimpeA ? meilleur.i : meilleur.j, cote = Math.sign(R[iRoue].z) || 1;
    const u = clamp((vMax - 15) / 55, 0, 1);
    const estEngrenage = meilleur.avantSurArriere !== 0;
    const vy = Math.min(.48 * meilleur.fermeture, estEngrenage ? (3.2 + 6.2 * Math.pow(u, 1.12)) : (2.1 + 3.5 * u));
    const prise=clamp((meilleur.fermeture-3)/10,0,1);
    const cabrage = prise*(estEngrenage ? (1.5 + 2.7 * u) : (.7 + 1.0 * u));
    const roulis = -cote * prise * (estEngrenage ? (1.2 + 2.3 * u) : (1.0 + 1.7 * u));
    const lacet = cote * prise * (.55 + .95 * u);
    // Impulsion de vitesse verticale + léger freinage réaliste de l'accrochage.
    VEL_ENVOL[0] = L.velocity[0] * .93;
    VEL_ENVOL[1] = Math.max(L.velocity[1], 0) + vy;
    VEL_ENVOL[2] = L.velocity[2] * .93;
    // Rotation physique cohérente : cabrage nez vers le haut (+right), roulis autour de forward.
    for (let k = 0; k < 3; k++) {
      ANG_ENVOL[k] = clamp(L.angular[k] + L.right[k] * cabrage + L.forward[k] * roulis + L.up[k] * lacet, -7.5, 7.5);
    }
    p.world.setVelocity(L.id, VEL_ENVOL);
    p.world.setAngularVelocity(L.id, ANG_ENVOL);
    // Réaction logique et plus faible sur la voiture dont la roue est percutée.
    if (!cible.distant && cible.airborne < .2) {
      const iCible = grimpeA ? meilleur.j : meilleur.i, coteC = Math.sign(R[iCible].z) || 1;
      VEL_ENVOL[0] = cible.velocity[0] * .97 - cible.right[0] * coteC * (1.2 + 1.4 * u);
      VEL_ENVOL[1] = cible.velocity[1] + .55 + .7 * u;
      VEL_ENVOL[2] = cible.velocity[2] * .97 - cible.right[2] * coteC * (1.2 + 1.4 * u);
      p.world.setVelocity(cible.id, VEL_ENVOL);
    }
    p.envols.set(key, p.temps);
    ev.push({ type: 'envol', id: L.v.id, cible: cible.v.id, force: vy, roue: iRoue });
  }
  function zoneImpact(ph,imp) {
    // Centre de pression de la grappe PhysX. Les deux voitures lisent le même point dans leurs propres axes.
    const dx=imp.px/imp.poids-ph.pose[0], dy=imp.py/imp.poids-ph.pose[1], dz=imp.pz/imp.poids-ph.pose[2];
    const x=dx*ph.forward[0]+dy*ph.forward[1]+dz*ph.forward[2], z=dx*ph.right[0]+dy*ph.right[1]+dz*ph.right[2];
    const long=Math.abs(imp.nx*ph.forward[0]+imp.ny*ph.forward[1]+imp.nz*ph.forward[2]);
    const lat=Math.abs(imp.nx*ph.right[0]+imp.ny*ph.right[1]+imp.nz*ph.right[2]);
    const flanc=Math.abs(z)>.48 && (lat>long*1.35 || Math.abs(x)<.8);
    const zone=flanc?(z<0?'gauche':'droite'):(x>=0?'avant':'arriere');
    return {zone,front:x>=0,cote:Math.abs(z)>.08?Math.sign(z):0,oblique:Math.abs(z)>.10?clamp(z/.85,-1,1):0,
      roue:Math.abs(z)>.47?(x>=0?0:2)+(z>0?1:0):undefined};
  }
  function collisions(p, ev) {
    p.impacts.clear();
    const contacts = p.world.contacts;
    if (!contacts?.enabled) return;
    for (let i = 0; i < contacts.count; i++) {
      const c = contacts.points[i], A = p.byId.get(c.a), C = p.byId.get(c.b);
      if (!A && !C) continue;
      const key = c.a < c.b ? c.a + ':' + c.b : c.b + ':' + c.a;
      let imp = p.impacts.get(key); if (!imp) { imp = { A, C, a: c.a, b: c.b, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, poids: 0, nx: 0, ny: 0, nz: 0 }; p.impacts.set(key, imp); }
      const poids=Math.hypot(c.ix,c.iy,c.iz);
      imp.poids+=poids; imp.px+=c.x*poids; imp.py+=c.y*poids; imp.pz+=c.z*poids;
      imp.nx+=c.nx*poids; imp.ny+=c.ny*poids; imp.nz+=c.nz*poids;
      imp.x += c.ix; imp.y += c.iy; imp.z += c.iz;
    }
    for (const [key, imp] of p.impacts) {
      const magnitude = Math.hypot(imp.x, imp.y, imp.z), old = p.collisions.get(key) ?? -Infinity;
      if (imp.A && imp.C) envolPneuContrePneu(p, key, imp.A, imp.C, magnitude, imp, ev);
      let contactRival = null, impactAdmissible = false;
      for (const ph of [imp.A, imp.C]) {
        if (!ph || ph.distant) continue;
        const other = ph === imp.A ? imp.b : imp.a, solid = p.solids.acteurs.get(other);
        const force = magnitude / ph.mass;
        if (solid?.groupe === SOL && Math.abs(imp.ny) > .65 * imp.poids) continue;
        if (solid) {
          const mem = p.co._obstacleMemo || (p.co._obstacleMemo = []), map = mem[ph.v.id] || (mem[ph.v.id] = new Map()); map.set(other, p.temps);
          ph.e.auRail = /lisse|gliss|mur|rail|parapet/.test(solid.genre || '');
        }
        if (force < .35) continue;
        impactAdmissible = true;
        if (p.temps - old < .22) continue;
        const car = ph === imp.A ? imp.C : imp.A;
        if (!car) ev.push({ type: 'choc', id: ph.v.id, force, obstacle: solid?.genre || 'debris', obstacleId: other });
        else if (!contactRival) {
          contactRival = { type: 'contact', a: ph.v.id, b: car.v.id, force };
          ev.push(contactRival);
        } else contactRival.force = Math.max(contactRival.force, force);
        for (const x of B.conduite.subirChoc(ph.e, force, zoneImpact(ph,imp))) { x.id = ph.v.id; ev.push(x); }
        if (ph.v.joueur) {
          const annule = B.conduite.annulerDerive(ph.e, true); if (annule) { annule.id = ph.v.id; ev.push(annule); }
          B.conduite.couperTurbo(ph.e);
        }
        ph.e.choc = B.conduite.PARAMS.chocDuree;
      }
      // Seul un contact qualifié prolonge son épisode. Le même seuil en m/s
      // sert à annoncer le premier choc et à éviter de le rejouer à chaque pas.
      if (impactAdmissible) p.collisions.set(key, p.temps);
    }
    if (p.pas % 120 === 0) {
      for (const [key, t] of p.collisions) if (p.temps - t > 2) p.collisions.delete(key);
      for (const [key, t] of p.envols) if (p.temps - t > 2) p.envols.delete(key);
    }
  }
  function pas(co, dt, ev) {
    const p = co.physique; if (!p || p.disposed) return;
    for (const ph of p.voitures) {
      if (ph.distant) {
        const e = ph.e, s = B.circuit.echantillon(ph.c, e.s), cap = s.cap + e.psi + e.beta;
        p.world.setKinematicTarget(ph.id, [s.x - Math.sin(s.cap) * e.d, e.y, s.z + Math.cos(s.cap) * e.d, ...quaternion(cap, e.tangage, e.roulis)]);
      } else {
        if ((ph.e.repositionnements || 0) !== ph.repositionnements) replacer(ph);
        appliquer(ph, dt);
      }
    }
    p.world.step(dt); p.pas++;
    for (const ph of p.voitures) {
      if (ph.distant) {
        // Les sondes fournissent les vrais points aux effets, sans réintégrer le véhicule distant.
        lecture(ph, false, false);
        if (ph.hasRemote) for (let i = 0; i < 3; i++) { ph.velocity[i] = ph.remote[i]; ph.angular[i] = ph.remote[3 + i]; }
        suspensions(ph, dt); continue;
      }
      lecture(ph); ph.e.auRail = false;
      const mem = co._obstacleMemo?.[ph.v.id]; if (mem) for (const [id, t] of mem) if (p.temps - t > .12) mem.delete(id);
      if (ph.e.choc > 0) ph.e.choc = Math.max(0, ph.e.choc - dt);
      if (!Number.isFinite(ph.x + ph.y + ph.z)) throw new Error('Pose PhysX non finie');
      if (ph.up[1] < .1 && !ph.e.recuperation) B.conduite.declencherAccident(ph.e, { reception: true });
    }
    collisions(p, ev);
  }
  function liberer(co) {
    const p = co?.physique; if (!p || p.disposed) return;
    p.disposed = true; for (const ph of p.voitures) if (ph.e._physx === ph) delete ph.e._physx;
    p.world.dispose(); p.byId.clear(); p.collisions.clear(); p.impacts.clear();
    if (p.solids) { p.solids.ids.length = 0; p.solids.acteurs.clear(); p.solids.libere = true; }
    p.voitures.length = 0; co.physique = null;
  }
  function replacerVoiture(co, v) {
    const p = co && co.physique; if (!p || p.disposed) return;
    const ph = p.voitures.find(q => q.v === v || q.v.id === (v && v.id));
    if (ph && !ph.distant) replacer(ph);
  }
  B.physique = { PROFIL, GROUPES: Object.freeze({ SOL, OBSTACLE, VOITURE, DEBRIS }), installer, avant, pas, liberer, repositionner, replacerVoiture, quaternion, projeter };
})(globalThis.BITUME = globalThis.BITUME || {});
