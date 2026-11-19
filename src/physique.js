/* BITUME — voitures et débris dans une même scène PhysX.
   PhysX intègre exclusivement les poses : Frenet sert à l'IA, au classement et au HUD.
   Les pneus calculent des forces ; quatre ressorts amortis prennent appui sur le sol dessiné.
   setPose est réservé au placement initial, au retour demandé et aux acteurs réseau distants. */
(function (B) {
  'use strict';
  const G = 9.81, DT = 1 / 120, SOL = 1, OBSTACLE = 2, VOITURE = 4, DEBRIS = 8;
  const PROFIL = Object.freeze({ masse: 600, empattement: 2.70, repartition: .44, hauteurCG: .33,
    inertie: Object.freeze([210, 1014, 980]), courseRepos: .14, courseLibre: .18, courseMax: .32,
    amortissement: .82, forceMaxRoue: 26000 });
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
        const i = (centre + k + c.n) % c.n, j = (i + 1) % c.n, dx = c.x[j] - c.x[i], dz = c.z[j] - c.z[i];
        const l2 = dx * dx + dz * dz, t = l2 > 0 ? clamp(((x - c.x[i]) * dx + (z - c.z[i]) * dz) / l2, 0, 1) : 0;
        const ex = x - c.x[i] - t * dx, ez = z - c.z[i] - t * dz, d2 = ex * ex + ez * ez;
        if (d2 < best) { best = d2; bestS = (i + t) * c.pas; bestD = l2 > 0 ? (ez * dx - ex * dz) / Math.sqrt(l2) : 0; }
      }
    }
    cherche(12);
    if (best > 100 * 100) { centre = Math.floor(c.n / 2); cherche(Math.ceil(c.n / 2) - 1); }
    out.s = wrap(bestS, c.longueur); out.d = bestD; return out;
  }
  function lecture(ph, progression = true) {
    const { world, id, e, c } = ph;
    world.readPose(id, ph.pose); world.readVelocity(id, ph.velocity); world.readAngularVelocity(id, ph.angular);
    tourner(ph.pose, [1, 0, 0], ph.forward); tourner(ph.pose, [0, 1, 0], ph.up); tourner(ph.pose, [0, 0, 1], ph.right);
    monde(ph.pose, ph.cgLocal, ph.cg);
    const vv = ph.velocity, av = ph.angular, f = ph.forward, r = ph.right, u = ph.up;
    ph.u = vv[0] * f[0] + vv[1] * f[1] + vv[2] * f[2]; ph.w = vv[0] * r[0] + vv[1] * r[1] + vv[2] * r[2];
    const ancien = e.s;
    projeter(c, ph.pose[0], ph.pose[2], e.s, ph.projection); e.s = ph.projection.s; e.d = ph.projection.d;
    if (progression) e.distance += Math.abs(delta(ancien, e.s, c.longueur));
    const q = B.circuit.echantillon(c, e.s, ph.echantillon), cap = Math.atan2(f[2], f[0]);
    const speed = Math.hypot(ph.u, ph.w), sign = ph.u < -.04 ? -1 : 1;
    e.v = sign * speed; e.beta = speed > .04 ? -Math.atan2(ph.w * sign, ph.u * sign) : 0;
    e.psi = angle(cap - q.cap - e.beta); e.omega = -(av[0] * u[0] + av[1] * u[1] + av[2] * u[2]);
    e.y = ph.pose[1]; e.tangage = Math.asin(clamp(f[1], -1, 1)); e.roulis = Math.atan2(-r[1], u[1]);
    ph.cap = cap; ph.x = ph.pose[0]; ph.y = ph.pose[1]; ph.z = ph.pose[2];
    ph.repositionnements = e.repositionnements || 0;
  }
  function poseDepart(ph) {
    const e = ph.e, q = B.circuit.echantillon(ph.c, e.s), cap = q.cap + e.psi + e.beta;
    const rel = cap - q.cap, pente = (q.pente || 0) * Math.cos(rel) - Math.sin(q.devers || 0) * Math.sin(rel);
    ph.cap = cap;
    const bank = Math.atan((q.pente || 0) * Math.sin(rel) + Math.sin(q.devers || 0) * Math.cos(rel));
    const rot = quaternion(cap, Math.atan(pente), bank), x = q.x - Math.sin(q.cap) * e.d, z = q.z + Math.cos(q.cap) * e.d;
    const p = [x, q.y - e.d * Math.sin(q.devers || 0), z, ...rot];
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
  function corps(ph) {
    const shapes = [{ type: 'box', half: [1.98, .23, .69], pose: [-.12, .31, 0, 0, 0, 0, 1], friction: .55, restitution: .08 }];
    // Les contacts latéraux des roues peuvent soulever la caisse ; le contact normal roulant vient des ressorts.
    for (const roue of roues()) {
      const vertices = [];
      for (const cote of [-1, 1]) for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8; vertices.push(roue.r * Math.cos(a), roue.r * Math.sin(a), cote * roue.l / 2);
      }
      shapes.push({ type: 'convex', vertices, pose: [roue.x, roue.r, roue.z, 0, 0, 0, 1], friction: .35, restitution: .06,
        group: VOITURE, mask: OBSTACLE | VOITURE | DEBRIS, queryGroup: VOITURE });
    }
    const p = poseDepart(ph), dynamique = !ph.v.distant;
    ph.id = ph.world.addCompound(p.slice(0, 3), shapes, { type: dynamique ? 'dynamic' : 'kinematic', quaternion: p.slice(3),
      mass: ph.mass, inertia: ph.inertia, centerOfMass: ph.cgLocal, ccd: dynamique, linearDamping: .005, angularDamping: .035,
      solverIterations: [8, 3], group: VOITURE, mask: SOL | OBSTACLE | VOITURE | DEBRIS, queryGroup: VOITURE });
    ph.distant = !!ph.v.distant;
    if (dynamique && Math.abs(ph.e.v) > .01) ph.world.setVelocity(ph.id, [Math.cos(ph.cap || 0) * ph.e.v, 0, Math.sin(ph.cap || 0) * ph.e.v]);
    lecture(ph, false);
  }
  function installer(co, decor, options = {}) {
    const X = globalThis.FPhysX;
    if (!X || !X.isReady() || !B.solidesPhysX) throw new Error('PhysX et les solides doivent être prêts avant la course');
    if (co.physique) return co.physique;
    const world = X.createWorld({ fixedStep: DT, maxSubSteps: 8, ccdMaxPasses: 8, contacts: true, maxContactPoints: 512 });
    const p = { world, co, voitures: [], byId: new Map(), collisions: new Map(), impacts: new Map(), temps: 0,
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
          airborne: 0, groundCount: 0, surface: 'piste', repositionnements: v.etat.repositionnements || 0, cap: 0 };
        roues().forEach((roue, i) => ph.contacts.push({ i, roue, hit: {}, anchor: vec(), point: vec(), normal: [0, 1, 0], tangent: vec(), right: vec(), velocity: vec(),
          shapePose: [roue.x, roue.r, roue.z, 0, 0, 0, 1], load: 0, surface: 'herbe', distance: PROFIL.courseMax + roue.r, k: mass * G * (i < 2 ? front : 1 - front) / 2 / (PROFIL.courseLibre - PROFIL.courseRepos) }));
        corps(ph); p.voitures.push(ph); p.byId.set(ph.id, ph);
        Object.defineProperty(v.etat, '_physx', { value: ph, configurable: true, writable: true });
      }
      co.physique = p; return p;
    } catch (err) { world.dispose(); throw err; }
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
      w.load = 0; w.distance = hit.hit ? hit.distance : roue.r + PROFIL.courseMax;
      const incidence = hit.hit ? hit.nx * ph.up[0] + hit.ny * ph.up[1] + hit.nz * ph.up[2] : 1;
      const axial = hit.hit ? hit.nx * ph.right[0] + hit.ny * ph.right[1] + hit.nz * ph.right[2] : 0;
      const support = roue.r * Math.sqrt(Math.max(0, 1 - axial * axial)) + roue.l * .5 * Math.abs(axial);
      const rayon = hit.hit && incidence > .35 ? support / incidence : roue.r;
      ph.offsets[w.i] = clamp(PROFIL.courseRepos - (w.distance - rayon), -.18, .14);
      if (ph.world.setShapePose) {
        const braquage = w.i < 2 ? ph.e.braquage || 0 : 0;
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
      w.load = clamp(w.k * (PROFIL.courseLibre - (hit.distance - rayon)) - amort * vitesse, 0, PROFIL.forceMaxRoue * ph.mass / PROFIL.masse);
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
      if (ph.distant !== !!ph.v.distant) { p.byId.delete(ph.id); ph.world.remove(ph.id); corps(ph); p.byId.set(ph.id, ph); }
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
  function appliquer(ph, dt) {
    const e = ph.e, F = ph.forces, world = ph.world, hold = ph.retenue || !!e.recuperation || (e.frein > .08 && Math.abs(e.v) < .45 && !e.gaz && e.rapport !== -1);
    for (const w of ph.contacts) {
      const charge = w.load; e.roues[w.i].charge = charge;
      if (!(charge > 0)) continue;
      const essieu = w.i < 2 ? F.avant : F.arriere, total = ph.contacts[w.i & 2].load + ph.contacts[(w.i & 2) + 1].load;
      let fx = essieu[0] * charge / Math.max(total, 1), fy = essieu[1] * charge / Math.max(total, 1);
      if (hold) {
        // Frein statique borné par l'adhérence : il compense la gravité tangentielle, sans verrou de position.
        const vp = w.velocity, t = w.tangent, r = w.right, masse = ph.mass * charge / Math.max(ph.contacts.reduce((s, q) => s + q.load, 0), 1);
        fx = -masse * (vp[0] * t[0] + vp[1] * t[1] + vp[2] * t[2]) / dt + masse * G * t[1];
        fy = -masse * (vp[0] * r[0] + vp[1] * r[1] + vp[2] * r[2]) / dt + masse * G * r[1];
        const mu = w.surface === 'herbe' ? .8 : B.conduite.PARAMS.muPiste * B.conduite.adherencePneus(e.pneus, B.chaussee.lire(ph.c, e.s));
        const effort = Math.hypot(fx, fy), max = charge * mu;
        if (effort > max) { fx *= max / effort; fy *= max / effort; }
      }
      for (let j = 0; j < 3; j++) ph.force[j] = w.normal[j] * charge + w.tangent[j] * fx + w.right[j] * fy;
      world.force(ph.id, ph.force, w.point);
    }
    for (let j = 0; j < 3; j++) ph.force[j] = ph.forward[j] * F.resistance[0] + ph.right[j] * F.resistance[1];
    world.force(ph.id, ph.force);
    // Appui aérodynamique réel : chargé par les ressorts au pas suivant, y compris sur les crêtes.
    if (F.appui > 0) {
      for (const [x, part] of [[1.35, B.conduite.PARAMS.aeroAvant], [-1.35, 1 - B.conduite.PARAMS.aeroAvant]]) {
        monde(ph.pose, [x, .3, 0], ph.tmp); for (let j = 0; j < 3; j++) ph.force[j] = -ph.up[j] * F.appui * part;
        world.force(ph.id, ph.force, ph.tmp);
      }
    }
  }
  function collisions(p, ev) {
    p.impacts.clear();
    const contacts = p.world.contacts;
    if (!contacts?.enabled) return;
    for (let i = 0; i < contacts.count; i++) {
      const c = contacts.points[i], A = p.byId.get(c.a), C = p.byId.get(c.b);
      if (!A && !C) continue;
      const key = c.a < c.b ? c.a + ':' + c.b : c.b + ':' + c.a;
      let imp = p.impacts.get(key); if (!imp) { imp = { A, C, a: c.a, b: c.b, x: 0, y: 0, z: 0, ny: c.ny }; p.impacts.set(key, imp); }
      imp.x += c.ix; imp.y += c.iy; imp.z += c.iz;
    }
    for (const [key, imp] of p.impacts) {
      const magnitude = Math.hypot(imp.x, imp.y, imp.z), old = p.collisions.get(key) ?? -Infinity;
      for (const ph of [imp.A, imp.C]) {
        if (!ph || ph.distant) continue;
        const other = ph === imp.A ? imp.b : imp.a, solid = p.solids.acteurs.get(other);
        const force = magnitude / ph.mass;
        if (solid?.groupe === SOL && Math.abs(imp.ny) > .65) continue;
        if (solid) {
          const mem = p.co._obstacleMemo || (p.co._obstacleMemo = []), map = mem[ph.v.id] || (mem[ph.v.id] = new Map()); map.set(other, p.temps);
          ph.e.auRail = /lisse|gliss|mur|rail|parapet/.test(solid.genre || '');
        }
        if (force < .35 || p.temps - old < .22) continue;
        const car = ph === imp.A ? imp.C : imp.A;
        if (!car) ev.push({ type: 'choc', id: ph.v.id, force, obstacle: solid?.genre || 'debris', obstacleId: other });
        else if (ph === imp.A || imp.A?.distant) ev.push({ type: 'contact', a: ph.v.id, b: car.v.id, force });
        for (const x of B.conduite.subirChoc(ph.e, force)) { x.id = ph.v.id; ev.push(x); }
        if (ph.v.joueur) {
          const annule = B.conduite.annulerDerive(ph.e, true); if (annule) { annule.id = ph.v.id; ev.push(annule); }
          B.conduite.couperTurbo(ph.e);
        }
        ph.e.choc = B.conduite.PARAMS.chocDuree;
      }
      if (magnitude > 200) p.collisions.set(key, p.temps);
    }
    if (p.pas % 120 === 0) for (const [key, t] of p.collisions) if (p.temps - t > 2) p.collisions.delete(key);
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
      if (ph.distant) continue;
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
    p.world.dispose(); p.byId.clear(); co.physique = null;
  }
  B.physique = { PROFIL, GROUPES: Object.freeze({ SOL, OBSTACLE, VOITURE, DEBRIS }), installer, avant, pas, liberer, quaternion, projeter };
})(globalThis.BITUME = globalThis.BITUME || {});
