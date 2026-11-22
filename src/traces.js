/* BITUME — traces de pneus, fumée et étincelles, dessinées par la passe transparente du moteur (objets « fx »).
   - Traces : au plus 512 bandes de gomme posées sous les roues qui glissent. Une bande s'allonge tant que la roue
     file droit (3° d'écart, 6 m au plus), pâlit, puis disparaît en 24 s ; la plus ancienne cède sa place.
   - Fumée : au plus 48 bouffées, des roues qui glissent fort ; poussière derrière les roues arrière dans l'herbe.
   - Étincelles : au plus 48, contre la glissière et aux contacts entre voitures.
   Mise à jour à 30 Hz sur le temps de la course ; seules les voitures proches de celle que l'on regarde en laissent.
   Le dessin prolonge chaque effet le long de sa vitesse jusqu'à l'instant dessiné, que l'appelant peut donner en
   continu (B.traces.extrapolation) : rien ne se fige entre deux pas de simulation, à 144 Hz comme à 30 Hz.
   Ni le dessin ni la passe à 30 Hz n'allouent une fois le code optimisé (seules les lectures de pose PhysX rendent
   des tableaux neufs, voir vieillir) : chaque effet garde son objet de rendu, les orientations se calculent terme à
   terme et les fonctions de la passe n'échangent que des objets et des indices (voir « nombres de travail »).
   Les pièces détachées partagent la scène PhysX de la course, son sol et les contacts avec les voitures.
   Les outils isolés gardent leur monde préchauffé ; les effets ont leur propre graine. */
(function (B) {
  'use strict';

  const BANDES = 512, FUMEES = 48, ETINCELLES = 48, PAS = 1 / 30, VIE_TRACE = 24;
  const SEUIL_TRACE = .35, SEUIL_FUMEE = .6;     // glisse d'une roue (0 à 1) où naissent la gomme et la fumée
  const PORTEE = 160, VUE = 190;                  // m : voitures prises autour de celle que l'on regarde ; bandes dessinées
  const DROIT = Math.cos(3 * Math.PI / 180), LONGUEUR_MAX = 6, LEVEE = .018, EPAISSEUR = .004;
  // BITUME — lot 2 : budget de pièces par voiture (fiche : quatre à six), plafond global tenu avec douze voitures.
  // Quatre roues et deux panneaux par casse, six au plus ; le pool n'est jamais agrandi et une place se reprend à la
  // pièce la plus proche de sa fin de vie, jamais au hasard sur une pièce encore en vol.
  const DEBRIS = 96, VIE_DEBRIS = 12, PIECES_PAR_VOITURE = 6, REPOS_V = .08, REPOS_ATTENTE = .4;
  // Embruns (David, 16/11 : « améliore le rendu, particules ») : sous la pluie, chaque voiture lancée soulève derrière
  // ses roues arrière une gerbe d'eau, plus haute avec la vitesse ; pas sous la voûte du tunnel.
  const EMBRUNS = 160, EMBRUN = [.80, .84, .88];
  // Panneaux de carrosserie réellement dessinés par voiture.js (nez, ailerons, pontons, capot), repérés par leur
  // avant et leur flanc pour que la pièce qui part corresponde au côté du choc.
  const PANNEAUX = [[2.11,.2,0,.38,.06,1.62],[-2.05,.9,0,.34,.06,1.1],
    [1.6,.3,0,.9,.12,.5],[.8,.4,0,.8,.1,1.1],[-.6,.4,-.65,1.1,.3,.16],[-.6,.4,.65,1.1,.3,.16],
    [-1.1,.6,0,.8,.25,.6],[-2,.65,0,.25,.4,.1]].map(d => ({ d, avant: d[0] > 0, cote: d[2] > .2 ? 1 : d[2] < -.2 ? -1 : 0 }));
  const GOMME = [.02, .02, .022], FUMEE = [.82, .82, .8], POUSSIERE = [.58, .5, .38], ETINCELLE = [1, .6, .18];
  const FUMEE_CASSE = [.22, .23, .24], CAOUTCHOUC = [.035, .035, .04];
  // Un effet dont le centre passe derrière le plan de la caméra de plus que sa taille (bande de 6 m, bouffée de
  // fumée, panneau) ne peut pas paraître à l'écran.
  const MARGE_ARRIERE = 4;
  // Rotation des pièces PhysX : au-delà d'un quart de tour par trentième de seconde, la vitesse de rotation déduite
  // de deux poses n'est plus sûre (repliement) ; la pièce garde alors sa dernière pose jusqu'à la suivante.
  const ROTATION_SURE = Math.PI / 2;

  // ---------------------------------------------------------------- nombres de travail
  // V8 met en boîte (alloue) tout nombre à virgule passé en argument à une fonction qu'il n'a pas incorporée à
  // l'appelant, ou rendu par elle. Les fonctions de la passe et du dessin reçoivent donc des objets et des indices ;
  // leurs nombres passent par ces tableaux, écrits juste avant l'appel et lus aussitôt.
  // MV : attitude de la voiture en cours, colonnes à la suite (images de x, y, z). O : vecteur que tourner remplace
  // par MV·O. VC : vitesse au sol de la voiture en cours (x, z) et eau sur la piste. DEP : départ d'une bouffée ou
  // d'une étincelle (position 0 à 2, vitesse 3 à 5, sol 6, force 7), nouveau bout d'une bande (0 à 2). ANG : cap,
  // tangage, roulis que traduit orienter. Q : quaternion (x, y, z, w) que traduit anglesQuaternion. TIR : tirages.
  const MV = new Float64Array(9), O = new Float64Array(3), VC = new Float64Array(3), DEP = new Float64Array(8);
  const ANG = new Float64Array(3), Q = new Float64Array(4), TIR = new Float64Array(8);

  // Champs numériques mis dès la création dans leur représentation définitive, le nombre à virgule. Un champ ou un
  // tableau créé avec des entiers se convertit à sa première écriture d'un nombre à virgule : il alloue alors, et le
  // code optimisé qui le lisait est jeté (désoptimisation), au moment où la place sert pour la première fois, en
  // pleine course (pièce de la première casse, bande ou bouffée neuve).
  const NOMBRES_BANDE = ['age', 'a0', 'larg', 'roulis', 'x0', 'y0', 'z0', 'x1', 'y1', 'z1', 'nx', 'ny', 'nz'];
  const NOMBRES_PARTICULE = ['age', 'vie', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'sol', 'taille', 'a0'];
  const NOMBRES_PIECE = ['age', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'sol', 'spin', 'rx', 'ry', 'rz', 'repos', 'qx', 'qy', 'qz', 'qw', 'wx', 'wy', 'wz'];
  function former(o, champs) {
    for (let i = 0; i < champs.length; i++) { const k = champs[i], v = o[k]; o[k] = .5; o[k] = v; }
    const r = o.objet;
    if (r) {
      const v = r.alpha; r.alpha = .5; r.alpha = v;
      for (const t of [r.p, r.s, r.r, r.color]) for (let k = 0; k < 3; k++) { const x = t[k]; t[k] = .5; t[k] = x; }
    }
    return o;
  }

  function creer(n, graine, mondePartage) {
    const bandes = [];
    for (let i = 0; i < BANDES; i++) {
      bandes.push(former({
        actif: false, age: 0, a0: 0, gen: 0, larg: .3, roulis: 0, x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0,
        contact: false, nx: 0, ny: 1, nz: 0,
        objet: { shape: 'box', p: [0, 0, 0], s: [1, EPAISSEUR, .3], r: [0, 0, 0], fx: true, fxPriority: 'hazard', alpha: 0, color: GOMME }
      }, NOMBRES_BANDE));
    }
    const particules = (k, forme, couleur, emissive) => Array.from({ length: k }, () => former({
      actif: false, age: 0, vie: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sol: 0, taille: 1, a0: 0,
      objet: { shape: forme, p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], fx: true, alpha: 0, color: couleur.slice(), emissive }
    }, NOMBRES_PARTICULE));
    const fx = {
      bandes, prochaine: 0,
      // Pièce détachée : corps, son identifiant PhysX (0 sans corps) ; rx, ry, rz, sa rotation quand elle suit une
      // parabole ; qx … qw, la dernière pose lue dans PhysX, et wx, wy, wz, la vitesse de rotation déduite des deux
      // dernières (pose : nombre de lectures, 0, 1 ou 2 et plus). Tous les champs existent dès la création : les
      // boucles de la passe et du dessin ne voient qu'une forme d'objet.
      debris: Array.from({ length: DEBRIS }, () => former({ actif: false, age: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sol: 0, spin: 0,
        rx: 0, ry: 0, rz: 0, corps: 0, repos: 0, pose: 0, ecrite: false, qx: 0, qy: 0, qz: 0, qw: 1, wx: 0, wy: 0, wz: 0,
        objet: { shape: 'box', p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], color: [0, 0, 0], mat: 7, fx: true, fxPriority: 'hazard', alpha: 1 } }, NOMBRES_PIECE)), prochainDebris: 0,
      fumees: particules(FUMEES, 'sphere', FUMEE, 0), prochaineFumee: 0,
      etincelles: particules(ETINCELLES, 'box', ETINCELLE, 2.4), prochaineEtincelle: 0,
      embruns: particules(EMBRUNS, 'sphere', EMBRUN, 0), prochainEmbrun: 0,
      // PhysX (FERRO) : les pièces détachées deviennent des corps rigides qui roulent et rebondissent sur le sol
      monde: mondePartage || null, partage: !!mondePartage, sols: [], libere: false, pieces: new Int16Array(n),
      // par roue (voiture × 4 + roue) : bande ouverte, son numéro de pose, dernier point de contact et sa validité
      ouverte: new Int32Array(n * 4).fill(-1), genOuverte: new Int32Array(n * 4), valide: new Uint8Array(n * 4), dernier: new Float64Array(n * 12),
      // état du tirage (même suite qu'avant pour une graine donnée) ; alea() en rend le nombre suivant
      graine: Int32Array.of(graine == null ? 1 : graine), acc: 0, alea: null
    };
    fx.alea = () => { tirer(fx, 1); return TIR[0]; };
    former(fx, ['acc']);
    ECHEC = null;            // une séance neuve retente une fois la création du monde (voir pageDe)
    if (!fx.partage) attendrePhysX(fx);
    return fx;
  }

  // Les n tirages suivants de la séance, dans l'ordre, dans TIR[0 … n − 1] (mulberry32 ; n ≤ 8).
  function tirer(fx, n) {
    const g = fx.graine;
    let a = g[0];
    for (let k = 0; k < n; k++) {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      TIR[k] = ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    g[0] = a;
  }

  // ---------------------------------------------------------------- attitude sans tableau
  // Mêmes formules que B.voiture.attitude (Ry(−cap)·Rz(tangage)·Rx(roulis)) et B.voiture.angles, développées terme à
  // terme, dans le même ordre d'opérations : la passe à 30 Hz en tirait une vingtaine de tableaux par voiture, par
  // bande allongée et par étincelle.
  function attitude(m, p) {
    const cap = p.cap, tangage = p.tangage || 0, roulis = p.roulis || 0;
    const ch = Math.cos(cap), sh = Math.sin(cap), cp = Math.cos(tangage), sp = Math.sin(tangage), cq = Math.cos(roulis), sq = Math.sin(roulis);
    m[0] = cp * ch; m[1] = sp; m[2] = cp * sh;
    m[3] = -sp * cq * ch - sq * sh; m[4] = cp * cq; m[5] = -sp * cq * sh + sq * ch;
    m[6] = sp * sq * ch - cq * sh; m[7] = -cp * sq; m[8] = sp * sq * sh + cq * ch;
  }
  function tourner(m) {
    const x = O[0], y = O[1], z = O[2];
    O[0] = m[0] * x + m[3] * y + m[6] * z; O[1] = m[1] * x + m[4] * y + m[7] * z; O[2] = m[2] * x + m[5] * y + m[8] * z;
  }
  // Angles du moteur (Rz·Ry·Rx) de l'attitude ANG (cap, tangage, roulis), écrits dans r : B.voiture.angles(attitude(…)).
  function orienter(r) {
    const ch = Math.cos(ANG[0]), sh = Math.sin(ANG[0]), cp = Math.cos(ANG[1]), sp = Math.sin(ANG[1]), cq = Math.cos(ANG[2]), sq = Math.sin(ANG[2]);
    r[0] = Math.atan2(-sp * cq * sh + sq * ch, sp * sq * sh + cq * ch);
    r[1] = -Math.asin(Math.max(-1, Math.min(1, cp * sh)));
    r[2] = Math.atan2(sp, cp * ch);
  }
  // Quaternion Q → angles du moteur, par les termes de sa matrice de rotation (colonnes : images des axes).
  function anglesQuaternion(r) {
    const x = Q[0], y = Q[1], z = Q[2], w = Q[3];
    r[0] = Math.atan2(2 * (y * z + x * w), 1 - 2 * (x * x + y * y));
    r[1] = -Math.asin(Math.max(-1, Math.min(1, 2 * (x * z - y * w))));
    r[2] = Math.atan2(2 * (x * y + z * w), 1 - 2 * (y * y + z * z));
  }

  // Avance les effets de dt secondes de course (à chaque pas de simulation) ; ne travaille qu'à 30 Hz.
  // poses : position et attitude de chaque voiture au dernier pas ; suivie : la voiture que l'on regarde ;
  // ev : les événements du pas (contacts entre voitures).
  function pas(fx, co, poses, suivie, dt, ev) {
    if (!fx || fx.libere) return;
    if (ev) for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.type === 'contact') contact(fx, co, poses, e);
      else if (e.type === 'roue' || e.type === 'casse' || e.type === 'panneau') detacher(fx, co, poses, e);
      if (e.repositionnement) lacher(fx, e.id);
    }
    fx.acc += dt;
    if (fx.acc < PAS * .999) {
      // Un arrêt entre deux mises à jour des traces coupe la bande avant la reprise.
      const V = co.voitures;
      for (let k = 0; k < V.length; k++) {
        if (V[k].etat.v === 0) lacher(fx, k, false);
      }
      return;
    }
    fx.acc = Math.max(0, fx.acc - PAS);
    vieillir(fx, PAS);
    const V = co.voitures, L = co.c.longueur, ref = V[suivie] ? V[suivie].etat.s : 0, choc = B.conduite.PARAMS.chocDuree;
    const eau = B.conduite.eauSurPiste ? B.conduite.eauSurPiste() : 0;
    for (let k = 0; k < V.length; k++) {
      const et = V[k].etat, p = poses[k];
      let ds = (et.s - ref) % L;
      if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      if (!p || (k !== suivie && Math.abs(ds) > PORTEE)) { lacher(fx, k); continue; }
      if (et.v === 0) { lacher(fx, k, false); continue; }
      attitude(MV, p);
      const cap = p.cap - (et.beta || 0);
      VC[0] = Math.cos(cap) * et.v; VC[1] = Math.sin(cap) * et.v; VC[2] = eau;
      const auSol = et._physx ? et._physx.groundCount > 0 : !(et.bond > .03), herbe = et.surface === 'herbe';
      for (let w = 0; w < 4; w++) roue(fx, k, w, et, p, auSol, herbe);
      if (eau > .12 && et.v > 14 && auSol && !(B.circuit.dansCouvert && B.circuit.dansCouvert(co.c, et.s))) embrun(fx, et, p);
      // glissière touchée pendant ce trentième de seconde
      if (et.choc > choc - PAS && et.v > 6) mur(fx, et, p);
    }
  }

  // gerbe d'eau derrière les roues arrière : une à trois gouttes de brume par trentième de seconde, selon la vitesse
  function embrun(fx, et, p) {
    const eau = VC[2];
    tirer(fx, 1);
    const n = Math.min(3, Math.floor(et.v / 22 * eau * 2 + TIR[0]));
    for (let k = 0; k < n; k++) {
      tirer(fx, 8);
      const cote = TIR[0] < .5 ? -1 : 1;
      O[0] = -1.55 - TIR[1] * .4; O[1] = .25; O[2] = cote * (.62 + TIR[2] * .25); tourner(MV);
      const f = fx.embruns[fx.prochainEmbrun]; fx.prochainEmbrun = (fx.prochainEmbrun + 1) % EMBRUNS;
      f.actif = true; f.age = 0; f.vie = .55 + TIR[3] * .5; f.x = p.x + O[0]; f.y = p.y + O[1]; f.z = p.z + O[2]; f.sol = p.y;
      f.vx = VC[0] * .55 + (TIR[4] - .5) * 3; f.vz = VC[1] * .55 + (TIR[5] - .5) * 3; f.vy = 1.2 + TIR[6] * 1.8 * Math.min(1, et.v / 60);
      f.taille = .55 + TIR[7] * .4; f.a0 = .16 + .14 * eau;
    }
  }

  function lacher(fx, k, reinitialiserPieces = true) {
    for (let w = 0; w < 4; w++) { fx.valide[k * 4 + w] = 0; fx.ouverte[k * 4 + w] = -1; }
    if (reinitialiserPieces && fx.pieces) fx.pieces[k] = 0;
  }

  function roue(fx, k, w, et, p, auSol, herbe) {
    if (et.degats && et.degats.roues[w]) { fx.valide[k * 4 + w] = 0; fx.ouverte[k * 4 + w] = -1; return; }
    const i = k * 4 + w, j = i * 3, R = B.voiture.ROUES[w], g = et.roues ? et.roues[w].glisse : 0;
    const appui = et._physx?.contacts[w];
    let X, Y, Z;
    if (appui) {
      auSol = appui.load > 0 && appui.hit.hit; herbe = appui.surface === 'herbe';
      if (!auSol) { fx.valide[i] = 0; fx.ouverte[i] = -1; return; }
      X = appui.point[0] + appui.normal[0] * LEVEE;
      Y = appui.point[1] + appui.normal[1] * LEVEE;
      Z = appui.point[2] + appui.normal[2] * LEVEE;
    } else {
      O[0] = R.x; O[1] = LEVEE; O[2] = R.z; tourner(MV);
      X = p.x + O[0]; Y = p.y + O[1]; Z = p.z + O[2];
    }
    const dx = X - fx.dernier[j], dz = Z - fx.dernier[j + 2];
    const suite = fx.valide[i] && dx * dx + dz * dz < 64;            // pas de bande à travers un replacement
    DEP[0] = X; DEP[1] = Y; DEP[2] = Z;
    if (suite && auSol && !herbe && et.v > 2 && g > SEUIL_TRACE) poser(fx, i, j, w, et, p);
    else fx.ouverte[i] = -1;
    fx.dernier[j] = X; fx.dernier[j + 1] = Y; fx.dernier[j + 2] = Z; fx.valide[i] = 1;
    if (!auSol || et.v < 4) return;
    const fort = herbe ? (w >= 2 ? .6 * Math.min(1, et.v / 30) : 0) : (g - SEUIL_FUMEE) / (1 - SEUIL_FUMEE);
    if (!(fort > 0)) return;
    tirer(fx, 1);
    if (TIR[0] < .08 + .22 * Math.min(1, fort)) {
      DEP[0] = X; DEP[1] = Y; DEP[2] = Z; DEP[3] = VC[0]; DEP[5] = VC[1]; DEP[7] = Math.min(1, fort);
      fumer(fx, herbe ? POUSSIERE : FUMEE);
    }
  }

  // Gomme du dernier contact de la roue (dernier[j …]) au nouveau (DEP[0 … 2]) : allonge la bande ouverte de la roue
  // si elle file droit, sinon en ouvre une autre, à la place de la plus ancienne.
  function poser(fx, i, j, w, et, p) {
    const x0 = fx.dernier[j], y0 = fx.dernier[j + 1], z0 = fx.dernier[j + 2], x1 = DEP[0], y1 = DEP[1], z1 = DEP[2];
    const g = et.roues[w].glisse, a0 = .62 * Math.min(1, .3 + (g - SEUIL_TRACE) / (1 - SEUIL_TRACE));
    const appui = et._physx?.contacts[w];
    let b = fx.ouverte[i] >= 0 ? fx.bandes[fx.ouverte[i]] : null;
    if (b && b.actif && b.gen === fx.genOuverte[i]) {
      // Math.hypot passe par un appel générique qui rend un nombre en boîte : les racines s'écrivent à la main
      const ux = b.x1 - b.x0, uz = b.z1 - b.z0, lx = x1 - b.x0, lz = z1 - b.z0, lu = Math.sqrt(ux * ux + uz * uz), ll = Math.sqrt(lx * lx + lz * lz);
      if (ll <= LONGUEUR_MAX && lu > 1e-3 && (ux * lx + uz * lz) >= DROIT * lu * ll) {
        b.x1 = x1; b.y1 = y1; b.z1 = z1; b.a0 = Math.max(b.a0, a0); b.age = 0;
        if (appui) {
          b.contact = true;
          b.nx = appui.normal[0]; b.ny = appui.normal[1]; b.nz = appui.normal[2];
        }
        placer(b);
        return;
      }
    }
    const n = fx.prochaine;
    fx.prochaine = (n + 1) % BANDES;
    b = fx.bandes[n];
    b.actif = true; b.age = 0; b.a0 = a0; b.gen++; b.larg = B.voiture.ROUES[w].l * .8; b.roulis = p.roulis || 0;
    b.contact = !!appui;
    if (appui) { b.nx = appui.normal[0]; b.ny = appui.normal[1]; b.nz = appui.normal[2]; }
    b.x0 = x0; b.y0 = y0; b.z0 = z0; b.x1 = x1; b.y1 = y1; b.z1 = z1;
    fx.ouverte[i] = n; fx.genOuverte[i] = b.gen;
    placer(b);
  }

  // Boîte plate couchée de l'un à l'autre bout, au dévers du contact ou de la voiture
  function placer(b) {
    const dx = b.x1 - b.x0, dy = b.y1 - b.y0, dz = b.z1 - b.z0, lh = Math.sqrt(dx * dx + dz * dz), o = b.objet;
    const longueur = Math.sqrt(lh * lh + dy * dy);
    o.p[0] = (b.x0 + b.x1) / 2; o.p[1] = (b.y0 + b.y1) / 2; o.p[2] = (b.z0 + b.z1) / 2;
    o.s[0] = longueur + b.larg * .5; o.s[2] = b.larg;
    ANG[0] = Math.atan2(dz, dx); ANG[1] = Math.atan2(dy, lh); ANG[2] = b.roulis;
    if (b.contact && lh > 1e-6) {
      // Composantes de la normale sur les axes locaux Z et Y avant roulis.
      const normaleLaterale = (-b.nx * dz + b.nz * dx) / lh;
      const normaleLongitudinale = (b.nx * dx + b.nz * dz) / lh;
      const normaleHaute = (b.ny * lh - normaleLongitudinale * dy) / longueur;
      ANG[2] = Math.atan2(normaleLaterale, normaleHaute);
    }
    orienter(o.r);
  }

  // Bouffée partant de DEP (position 0 à 2, vitesse au sol 3 et 5, force 7)
  function fumer(fx, couleur) {
    const f = fx.fumees[fx.prochaineFumee], fort = DEP[7];
    fx.prochaineFumee = (fx.prochaineFumee + 1) % FUMEES;
    tirer(fx, 4);
    f.actif = true; f.age = 0; f.vie = 1.1 + .5 * TIR[0];
    f.x = DEP[0]; f.y = DEP[1] + .2; f.z = DEP[2];
    f.vx = DEP[3] * .3 + (TIR[1] - .5) * 1.6; f.vy = .4 + .5 * TIR[2]; f.vz = DEP[5] * .3 + (TIR[3] - .5) * 1.6;
    f.taille = .7 + .5 * fort; f.a0 = (.18 + .2 * fort) * (couleur === POUSSIERE ? 1.2 : 1);
    f.objet.color[0] = couleur[0]; f.objet.color[1] = couleur[1]; f.objet.color[2] = couleur[2];
  }

  // Étincelle partant de DEP (position 0 à 2, vitesse 3 à 5, sol 6), dispersée au hasard
  function etinceler(fx, dispersion) {
    const e = fx.etincelles[fx.prochaineEtincelle];
    fx.prochaineEtincelle = (fx.prochaineEtincelle + 1) % ETINCELLES;
    tirer(fx, 4);
    e.actif = true; e.age = 0; e.vie = .25 + .3 * TIR[0];
    e.x = DEP[0]; e.y = DEP[1]; e.z = DEP[2]; e.sol = DEP[6];
    e.vx = DEP[3] + (TIR[1] - .5) * dispersion; e.vy = DEP[4] + TIR[2] * dispersion * .6; e.vz = DEP[5] + (TIR[3] - .5) * dispersion;
    orienterEtincelle(e);
  }
  function orienterEtincelle(e) {
    ANG[0] = Math.atan2(e.vz, e.vx); ANG[1] = Math.atan2(e.vy, Math.sqrt(e.vx * e.vx + e.vz * e.vz)); ANG[2] = 0;
    orienter(e.objet.r);
  }

  // Flanc qui frotte la glissière : des étincelles le long de la caisse, qui partent avec la voiture
  function mur(fx, et, p) {
    const cote = et.d < 0 ? -1 : 1;
    for (let n = 0; n < 6; n++) {
      tirer(fx, 1);
      O[0] = .6 - 2.2 * TIR[0]; O[1] = .22; O[2] = cote * 1.02; tourner(MV);
      DEP[0] = p.x + O[0]; DEP[1] = p.y + O[1]; DEP[2] = p.z + O[2];
      DEP[3] = VC[0] * .75; DEP[4] = 1.2; DEP[5] = VC[1] * .75; DEP[6] = p.y;
      etinceler(fx, 5);
    }
  }

  // Contact entre deux voitures : une gerbe entre elles, à leur vitesse moyenne
  function contact(fx, co, poses, e) {
    const a = poses[e.a], b = poses[e.b];
    if (!a || !b) return;
    const ea = co.voitures[e.a].etat, eb = co.voitures[e.b].etat;
    const ca = a.cap - (ea.beta || 0), cb = b.cap - (eb.beta || 0);
    const vx = .4 * (Math.cos(ca) * ea.v + Math.cos(cb) * eb.v), vz = .4 * (Math.sin(ca) * ea.v + Math.sin(cb) * eb.v), sol = (a.y + b.y) / 2;
    for (let n = 0, m = 10 + Math.min(12, Math.max(0, Math.round(e.force || 0))); n < m; n++) {
      DEP[0] = (a.x + b.x) / 2; DEP[1] = sol + .3; DEP[2] = (a.z + b.z) / 2; DEP[3] = vx; DEP[4] = 1.5; DEP[5] = vz; DEP[6] = sol;
      etinceler(fx, 8);
    }
    // un choc déjà violent perd un panneau, du côté de la normale : l'impact se lit sans attendre la casse
    const seuil = B.degats && B.degats.PARAMS.chocRoue;
    if (seuil !== undefined && (e.force || 0) >= seuil) {
      const cote = (b.x - a.x) * -Math.sin(a.cap) + (b.z - a.z) * Math.cos(a.cap) >= 0 ? 1 : -1;
      for (const [v, et] of [[co.voitures[e.a], ea], [co.voitures[e.b], eb]]) if (et) detacher(fx, co, poses, { type: 'panneau', id: v.id, cote, avant: Math.cos(a.cap - (et.beta || 0)) >= 0 });
    }
  }

  // Place du pool : une libre de préférence, sinon la pièce la plus proche de sa fin de vie cède la sienne. Le plafond
  // global est ainsi tenu sans écraser au hasard une pièce encore en vol.
  function place(fx) {
    let pire = 0, reste = Infinity;
    for (let i = 0; i < DEBRIS; i++) {
      const d = fx.debris[i];
      if (!d.actif) return d;
      const r = VIE_DEBRIS - d.age;
      if (r < reste) { reste = r; pire = i; }
    }
    return fx.debris[pire];
  }

  function detacher(fx, co, poses, e) {
    const p = poses[e.id], v = co.voitures[e.id];
    if (!p || !v || !fx.pieces || fx.pieces[e.id] >= PIECES_PAR_VOITURE) return;
    const ca = Math.cos(p.cap), sa = Math.sin(p.cap), a = fx.alea;
    const lancer = (x, y, z, sx, sy, sz, roue, couleur, formeRoue) => {
      const d = place(fx), o = d.objet;
      if (d.corps && fx.monde) { try { fx.monde.remove(d.corps); } catch (err) { /* monde déjà perdu */ } }
      d.corps = 0;
      d.actif = true; d.age = 0; d.x = p.x + ca*x-sa*z; d.y = p.y+y; d.z = p.z+sa*x+ca*z; d.sol = p.y + Math.min(sx,sy,sz)*.5;
      d.vx = ca*(3+a()*5) - sa*(z*4+(a()-.5)*6); d.vz = sa*(3+a()*5) + ca*(z*4+(a()-.5)*6);
      d.vy = 3+a()*5; d.spin = (a()-.5)*12; d.repos = 0;
      o.shape = roue ? formeRoue ? formeRoue.nom : 'cylinder' : 'box'; o.s[0]=sx; o.s[1]=sy; o.s[2]=sz;
      d.rx = 0; d.ry = -p.cap; d.rz = roue ? Math.PI/2 : 0;
      o.r[0]=d.rx; o.r[1]=d.ry; o.r[2]=d.rz; o.alpha=1;
      for (let k=0;k<3;k++) o.color[k]=couleur[k];
      d.pose = 0; d.ecrite = false; d.wx = d.wy = d.wz = 0;
      d.corps = physique(fx, d, [sx / 2, sy / 2, sz / 2], roue ? 11 : 4, co, v.etat && v.etat.s);   // la boîte épouse la pièce dessinée
      fx.pieces[e.id]++;
    };
    if (e.type === 'roue') {
      const w = B.voiture.ROUES[e.roue];
      if (w) {
        // Même pneu que sur la voiture, en 64 segments partagés : une casse ne fait pas réapparaître un cylindre
        // grossier. La forme de collision, les dimensions, la masse et les tirages aléatoires restent identiques.
        const formes = B.voiture.ROUES_FORMES && B.voiture.ROUES_FORMES[w.avant ? 'av' : 'ar'];
        const type = v.etat && v.etat.pneus, variantes = formes && (formes[type] || formes.slicks);
        lancer(w.x,w.r,w.z,w.r*2,w.l,w.r*2,true,CAOUTCHOUC,variantes && variantes[1]);
      }
      return;
    }
    // panneaux : du côté du choc d'abord, dans la limite du budget restant de la voiture
    const couleur = v.couleur || [.7,.1,.08];
    const notes = PANNEAUX.map(q => ({ q, n: (q.cote && q.cote === e.cote ? 2 : 0) + (q.avant === !!e.avant ? 1 : 0) }));
    notes.sort((u, w) => w.n - u.n || PANNEAUX.indexOf(u.q) - PANNEAUX.indexOf(w.q));
    const n = e.type === 'panneau' ? 1 : PIECES_PAR_VOITURE - fx.pieces[e.id];
    for (let k = 0; k < n && k < notes.length; k++) { const d = notes[k].q.d; lancer(d[0],d[1],d[2],d[3],d[4],d[5],false,couleur); }
    if (e.type === 'casse') {
      for (let k=0;k<8;k++) { DEP[0]=p.x; DEP[1]=p.y+.3; DEP[2]=p.z; DEP[3]=(a()-.5)*6; DEP[5]=(a()-.5)*6; DEP[7]=1; fumer(fx,FUMEE_CASSE); }
      for (let k=0;k<12;k++) { DEP[0]=p.x; DEP[1]=p.y+.4; DEP[2]=p.z; DEP[3]=0; DEP[4]=2; DEP[5]=0; DEP[6]=p.y; etinceler(fx,12); }
    }
  }

  // ---------------------------------------------------------------- monde PhysX de la page
  // Un seul monde pour toute la page : la démo enchaîne les courses sans fin, et un monde par séance faisait payer à
  // chaque course sa naissance (scène, répartiteur, filtre) au premier débris, au moment du choc. Une séance s'y
  // attache à sa création, ou dès que le module PhysX est prêt (son décodage se fait en tâche de fond au démarrage) ;
  // elle en ressort à sa mort avec ses corps et ses dalles, et le monde attend la suivante.
  // PAGE : { X (module FPhysX), monde, seance, chaud }. ECHEC : module dont la création du monde a échoué pendant la
  // séance en cours ; la séance n'insiste pas à chaque débris, mais la suivante retente une fois (creer l'oublie) :
  // une panne passagère ne condamne pas toutes les courses de la page à la parabole.
  let PAGE = null, ECHEC = null;
  function pageDe(X) {
    if (PAGE && PAGE.X === X) return PAGE;
    if (ECHEC === X) return null;
    if (PAGE) abandonnerPage();       // un autre module PhysX (essais) : l'ancien monde ne sert plus
    let monde = null;
    try { monde = X.createWorld({ fixedStep: 1 / 60, maxSubSteps: 4 }); } catch (e) { monde = null; }
    if (!monde) { ECHEC = X; return null; }
    PAGE = { X, monde, seance: null, chaud: false };
    return PAGE;
  }
  function abandonnerPage() {
    const page = PAGE;
    PAGE = null;
    if (!page) return;
    if (page.seance) quitterMonde(page.seance);
    try { page.monde.dispose(); } catch (e) { /* monde déjà perdu */ }
  }
  // Rattache la séance au monde de la page ; le premier rattachement le chauffe (voir chauffer), sauf au premier
  // débris : un monde encore froid à ce moment-là paie son premier pas une fois, chauffe ou pas.
  function attacher(fx, chauffe) {
    if (!fx || fx.libere) return null;
    if (fx.monde) return fx.monde;
    const X = globalThis.FPhysX;
    if (!X || !X.isReady || !X.isReady()) return null;
    const page = pageDe(X);
    if (!page) return null;
    if (page.seance && page.seance !== fx) quitterMonde(page.seance);   // une séance à la fois dans le monde
    page.seance = fx; fx.monde = page.monde;
    if (chauffe && !page.chaud) page.chaud = chauffer(page.monde, null);
    return fx.monde;
  }
  function attendrePhysX(fx) {
    const X = globalThis.FPhysX;
    if (!X || !X.isReady) return;
    if (X.isReady()) { attacher(fx, true); return; }
    if (typeof X.init !== 'function') return;
    let attente;
    try { attente = Promise.resolve(X.init()); } catch (e) { return; }
    attente.then(() => { if (globalThis.FPhysX === X) attacher(fx, true); }, () => { /* pièces en parabole */ });
  }
  // La séance rend le monde : ses corps en sortent, ses dalles aussi ; une pièce encore en vol s'arrête où elle est.
  function quitterMonde(fx) {
    const monde = fx.monde;
    fx.monde = null;
    if (PAGE && PAGE.seance === fx) PAGE.seance = null;
    for (let i = 0; i < fx.debris.length; i++) {
      const d = fx.debris[i];
      if (!d.corps) continue;
      if (monde) { try { monde.remove(d.corps); } catch (e) { /* monde déjà perdu */ } }
      figer(d);
    }
    if (monde && !fx.partage) { try { monde.setStatics([]); } catch (e) { /* idem */ } }
    fx.sols.length = 0;
  }
  // Un appel PhysX a échoué en plein pas : le monde n'est plus sûr. La séance le quitte et la page en refera un neuf
  // au prochain débris.
  function perdreMonde(fx) {
    if (PAGE && PAGE.monde === fx.monde) abandonnerPage();
    if (fx.monde) quitterMonde(fx);
  }
  function figer(d) {
    d.corps = 0; d.vx = d.vy = d.vz = 0; d.spin = 0; d.sol = d.y;
    d.wx = d.wy = d.wz = 0; if (d.pose) { d.pose = 1; d.ecrite = false; }
  }
  function corpsEnVol(fx) {
    for (let i = 0; i < fx.debris.length; i++) if (fx.debris[i].corps) return true;
    return false;
  }
  const boites = fx => fx.sols.reduce((a, q) => a.concat(q.boites), []);

  // Préchauffage : une dalle, une boîte lancée dessus assez vite pour la détection continue des chocs, une dizaine de
  // pas, une lecture de pose, retrait. Tout se passe 5 km sous le circuit ; ni pièce ni tirage de la séance. Ce qui en
  // reste : le code WebAssembly, compilé à sa première exécution, et les tampons de la scène, que le premier choc
  // n'aura plus à payer. Les dalles de la séance sont remises telles quelles. Des pas de 1/60 s laissent le reliquat
  // de temps du monde à zéro, comme les pas de 1/30 s des séances.
  const CHAUFFE_DALLE = [{ center: [0, -5000, 0], half: [4, .5, 4] }], CHAUFFE_POS = [0, -4998.6, 0], CHAUFFE_DEMI = [.3, .12, .5],
    CHAUFFE_VITESSE = [2.5, -14, 1.5], CHAUFFE_CORPS = { mass: 4, friction: .75, restitution: .28, ccd: true };
  function chauffer(monde, statiques) {
    let id = 0, ok = false;
    try {
      monde.setStatics(CHAUFFE_DALLE);
      id = monde.addBox(CHAUFFE_POS, CHAUFFE_DEMI, CHAUFFE_CORPS);
      monde.setVelocity(id, CHAUFFE_VITESSE);
      for (let k = 0; k < 10; k++) monde.step(1 / 60);
      monde.readPose(id); monde.readVelocity(id);
      ok = true;
    } catch (e) { ok = false; }
    if (id) { try { monde.remove(id); } catch (e) { ok = false; } }
    try { monde.setStatics(statiques || []); } catch (e) { ok = false; }
    return ok;
  }
  // Préchauffage demandé (sous le voile d'un chargement, par exemple), sans effet sur la séance : rendu faux si PhysX
  // n'est pas prêt, ou si une pièce de la séance vit dans le monde (les pas de chauffe la feraient avancer).
  function prechauffer(fx) {
    if (fx && fx.partage) return !!fx.monde; // la course possède déjà sol et corps ; ne pas avancer sa scène ici
    let monde = null, seance = null;
    if (fx) { monde = attacher(fx, false); seance = fx; }
    else {
      const X = globalThis.FPhysX, page = X && X.isReady && X.isReady() ? pageDe(X) : null;
      if (page) { monde = page.monde; seance = page.seance; }
    }
    if (!monde || (seance && corpsEnVol(seance))) return false;
    const ok = chauffer(monde, seance && seance.sols.length ? boites(seance) : null);
    if (ok && PAGE && PAGE.monde === monde) PAGE.chaud = true;
    return ok;
  }
  // Monde PhysX de la page (essais, banc) : null tant que le module n'est pas prêt.
  function mondePage() { return PAGE && PAGE.X === globalThis.FPhysX ? PAGE.monde : null; }

  // Sol de l'accident : une seule dalle horizontale de 80 m traverserait dévers et pente. Autant de dalles courtes
  // que nécessaire le long de l'axe autour de l'accident, chacune à l'altitude réelle du tracé. Quatre accidents
  // récents au plus gardent les leurs. Un échantillon non fini est sauté (FERRO refuserait toute la liste), et une
  // liste refusée n'est pas gardée : elle ne doit pas condamner les accidents suivants de la séance.
  const PAS_DALLE = 12, DEMI_DALLE = 11;
  function dalles(fx, monde, co, s) {
    if (s == null || !Number.isFinite(s)) return;
    const cle = Math.round(s / (PAS_DALLE * 2));
    if (fx.sols.some(g => g.cle === cle)) return;
    const c = co && co.c, g = { cle, boites: [] };
    for (let k = -2; k <= 2; k++) {
      let q;
      try { q = c ? B.circuit.echantillon(c, s + k * PAS_DALLE) : null; } catch (e) { q = null; }
      if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.y) || !Number.isFinite(q.z) || !Number.isFinite(q.cap)) continue;
      const ca = Math.abs(Math.cos(q.cap)), sa = Math.abs(Math.sin(q.cap));
      g.boites.push({ center: [q.x, q.y - .6, q.z], half: [ca * PAS_DALLE / 2 + sa * DEMI_DALLE, 1.2, sa * PAS_DALLE / 2 + ca * DEMI_DALLE] });
    }
    if (!g.boites.length) return;
    const avant = fx.sols.slice();
    fx.sols.push(g);
    while (fx.sols.length > 4) fx.sols.shift();
    try { monde.setStatics(boites(fx)); } catch (e) { fx.sols.length = 0; fx.sols.push(...avant); throw e; }
  }

  // Corps rigide PhysX d'une pièce détachée (navigateur seulement : dans Node, la pièce garde sa parabole). Un argument
  // refusé (TypeError, RangeError : valeur non finie, par exemple) laisse la pièce en parabole sans condamner le monde ;
  // toute autre erreur (monde détruit, mémoire du module) le rend : la page en refera un neuf au débris suivant. Le nom
  // de l'erreur, pas sa classe : un module chargé dans un autre contexte (essais) a ses propres TypeError.
  const REFUS = ['TypeError', 'RangeError'];
  function physique(fx, d, demi, masse, co, s) {
    const monde = attacher(fx, false);
    if (!monde) return 0;
    let id = 0;
    try {
      if (!fx.partage) dalles(fx, monde, co, s);
      id = monde.addBox([d.x, d.y, d.z], demi, { mass: masse, friction: .75, restitution: .28, ccd: true,
        group: fx.partage ? 8 : 0xFFFFFFFF, mask: 0xFFFFFFFF, queryGroup: fx.partage ? 8 : 0xFFFFFFFF });
      monde.setVelocity(id, [d.vx, d.vy, d.vz]);
      return id;
    } catch (e) {
      if (id) { try { monde.remove(id); } catch (e2) { /* monde déjà perdu */ } }
      if (!(e && REFUS.includes(e.name))) perdreMonde(fx);
      return 0;
    }
  }

  // Libération sûre : la séance qui meurt (nouvelle course, perte de contexte) rend ses corps et ses dalles au monde
  // de la page, qui reste vide pour la suivante ; ses effets s'éteignent. La démo enchaîne les courses sans fin : ni
  // monde ni corps ne doit survivre d'une séance à l'autre.
  function liberer(fx) {
    if (!fx || fx.libere) return;
    fx.libere = true;
    quitterMonde(fx);
    for (const d of fx.debris) { d.corps = 0; d.actif = false; d.pose = 0; d.repos = 0; }
    for (const b of fx.bandes) b.actif = false;
    for (const f of fx.fumees) f.actif = false;
    for (const e of fx.etincelles) e.actif = false;
    for (const f of fx.embruns) f.actif = false;
    if (fx.pieces) fx.pieces.fill(0);
    fx.acc = 0;
  }

  // Nouvelle pose q lue dans PhysX (position 0 à 2, quaternion 3 à 6), h secondes après la précédente : la rotation de
  // l'intervalle, Δ = q·q̄₀ (plus court chemin), donne la vitesse de rotation qui prolonge l'orientation au dessin,
  // comme la vitesse prolonge la position.
  function nouvellePose(d, q, h) {
    const x = q[3], y = q[4], z = q[5], w = q[6];
    if (d.pose >= 1 && h > 0) {
      const ox = d.qx, oy = d.qy, oz = d.qz, ow = d.qw;
      let dx = ow * x - w * ox - (y * oz - z * oy), dy = ow * y - w * oy - (z * ox - x * oz), dz = ow * z - w * oz - (x * oy - y * ox);
      let dw = w * ow + x * ox + y * oy + z * oz;
      if (dw < 0) { dx = -dx; dy = -dy; dz = -dz; dw = -dw; }
      const s = Math.sqrt(dx * dx + dy * dy + dz * dz), angle = 2 * Math.atan2(s, dw);
      if (s > 1e-9 && angle < ROTATION_SURE) { const k = angle / (s * h); d.wx = dx * k; d.wy = dy * k; d.wz = dz * k; }
      else d.wx = d.wy = d.wz = 0;
      d.pose = 2;
    } else { d.wx = d.wy = d.wz = 0; d.pose = 1; }
    d.qx = x; d.qy = y; d.qz = z; d.qw = w; d.ecrite = false;
  }

  function vieillir(fx, h) {
    const BD = fx.bandes;
    for (let i = 0; i < BD.length; i++) { const b = BD[i]; if (b.actif && (b.age += h) >= VIE_TRACE) b.actif = false; }
    // sans pièce dans le monde, un pas ne ferait rien : la scène vide n'est pas simulée
    if (fx.monde && !fx.partage && corpsEnVol(fx)) { try { fx.monde.step(h); } catch (e) { perdreMonde(fx); } }
    const monde = fx.monde, D = fx.debris;
    for (let i = 0; i < D.length; i++) {
      const d = D[i];
      if (!d.actif) continue;
      if ((d.age += h) >= VIE_DEBRIS) {
        d.actif = false;
        if (d.corps && monde) { try { monde.remove(d.corps); } catch (e) { /* monde déjà perdu */ } }
        d.corps = 0; continue;
      }
      if (d.corps && monde) {
        // FERRO rend chaque pose et chaque vitesse dans un tableau neuf : deux petits tableaux par pièce en vol, le
        // seul reste d'allocation de la passe, le temps que les pièces roulent (une douzaine de secondes au plus)
        let q = null, v = null;
        try { q = monde.readPose(d.corps); v = monde.readVelocity(d.corps); } catch (e) { perdreMonde(fx); }
        if (!fx.monde) { figer(d); continue; }
        if (q) { d.x = q[0]; d.y = q[1]; d.z = q[2]; nouvellePose(d, q, h); }
        if (v) { d.vx = v[0]; d.vy = v[1]; d.vz = v[2]; }
        d.sol = -1e9;
        // la pièce est-elle posée ? une vitesse quasi nulle tenue un instant (un sommet de rebond ne dure pas) : on la
        // sort de la simulation, elle reste dessinée là où elle s'est arrêtée sans coûter de corps actif
        if (q && v && Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) < REPOS_V) {
          d.repos += h;
          if (d.repos > REPOS_ATTENTE && !fx.partage) {
            try { monde.remove(d.corps); } catch (e) { /* monde déjà perdu */ }
            figer(d);   // posée à la hauteur lue (d.y), dans sa dernière orientation
          }
        } else d.repos = 0;
        continue;
      }
      d.x+=d.vx*h; d.y+=d.vy*h; d.z+=d.vz*h; d.vy-=9.81*h;
      if (d.y<d.sol && d.vy<0) { d.y=d.sol; d.vy=Math.abs(d.vy)>.8 ? -d.vy*.3 : 0; d.vx*=.65; d.vz*=.65; d.spin*=.7; }
      d.rx+=d.spin*h; d.rz+=d.spin*.7*h;
    }
    const amortiE = Math.exp(-h * 2.4), E = fx.embruns;
    for (let i = 0; i < E.length; i++) {
      const f = E[i];
      if (!f.actif) continue;
      if ((f.age += h) >= f.vie) { f.actif = false; continue; }
      f.x += f.vx * h; f.y += f.vy * h; f.z += f.vz * h;
      f.vx *= amortiE; f.vz *= amortiE; f.vy = f.vy * amortiE - 1.5 * h;
      if (f.y < f.sol + .1) { f.y = f.sol + .1; f.vy = 0; }
    }
    const amorti = Math.exp(-h * 1.6), F = fx.fumees;
    for (let i = 0; i < F.length; i++) {
      const f = F[i];
      if (!f.actif) continue;
      if ((f.age += h) >= f.vie) { f.actif = false; continue; }
      f.x += f.vx * h; f.y += f.vy * h; f.z += f.vz * h;
      f.vx *= amorti; f.vz *= amorti; f.vy = f.vy * amorti + .5 * h;
    }
    const ET = fx.etincelles;
    for (let i = 0; i < ET.length; i++) {
      const e = ET[i];
      if (!e.actif) continue;
      if ((e.age += h) >= e.vie) { e.actif = false; continue; }
      e.x += e.vx * h; e.y += e.vy * h; e.z += e.vz * h; e.vy -= 9.81 * h;
      if (e.y < e.sol && e.vy < 0) { e.y = e.sol; e.vy *= -.35; e.vx *= .6; e.vz *= .6; }
      orienterEtincelle(e);
    }
  }

  // Instant du dessin, en temps de course compté depuis la dernière mise à jour des effets. fx.acc n'avance qu'aux pas
  // de 1/120 s : à 144 Hz une image sur six n'en voit aucun, et des effets prolongés de fx.acc s'y figeraient. Les
  // voitures sont dessinées entre leurs deux dernières poses ; retard = (1 − alpha) × DT, la durée dont l'image
  // précède le dernier pas, met les effets au même instant qu'elles. Le résultat suit le temps réel sans à-coup, y
  // compris à la mise à jour (fx.acc y perd 1/30 s quand l'état des effets en gagne autant).
  function extrapolation(fx, retard) {
    return fx ? fx.acc - (Number.isFinite(retard) ? retard : 0) : 0;
  }

  function creerReflet() {
    return { objets: new Array(EMBRUNS + DEBRIS + BANDES + FUMEES + ETINCELLES),
      debutBandes: 0, finBandes: 0, nombre: 0 };
  }
  // Les objets déjà extrapolés restent valables jusqu'au prochain pas ou dessin de la vue principale.
  // Seules la distance des bandes et la coupe arrière dépendent du rétroviseur.
  function dessinerReflet(reflet, sortie, oeil, axe) {
    const ox=oeil[0], oy=oeil[1], oz=oeil[2], ax=axe[0], ay=axe[1], az=axe[2];
    for (let i=0; i<reflet.nombre; i++) {
      const o=reflet.objets[i], p=o.p, dx=p[0]-ox, dz=p[2]-oz;
      if (i>=reflet.debutBandes && i<reflet.finBandes && dx*dx+dz*dz>VUE*VUE) continue;
      if (dx*ax+(p[1]-oy)*ay+dz*az>=-MARGE_ARRIERE) sortie.push(o);
    }
  }
  // Pousse dans `sortie` les effets visibles depuis `oeil`. h : temps de course écoulé depuis la dernière mise à jour
  // des effets jusqu'à l'instant dessiné (fx.acc par défaut ; continu avec B.traces.extrapolation) ; un effet né
  // après cet instant n'est pas encore là. axe (facultatif) : direction du regard, vecteur unité ; un effet plus loin
  // derrière le plan de la caméra que `arriere` mètres (0 par défaut ; une soixantaine quand les rétroviseurs
  // reprennent la liste) n'est pas émis. Sans axe, rien n'est écarté. Aucune allocation.
  function dessiner(fx, sortie, oeil, temps, axe, arriere, reflet, glaces) {
    const candidats=reflet && reflet.objets;
    let nombre=0;
    // `+temps` : les deux branches restent des nombres à virgule ; mêlé tel quel au paramètre (qui peut manquer),
    // fx.acc serait mis en boîte à chaque image
    const h = Number.isFinite(temps) ? +temps : fx.acc;
    const ox = oeil[0], oy = oeil[1], oz = oeil[2], tri = !!axe;
    let ax = 0, ay = 0, az = 0, limite = 0;
    if (tri) { ax = axe[0]; ay = axe[1]; az = axe[2]; limite = -MARGE_ARRIERE - (arriere > 0 ? arriere : 0); }
    const E = fx.embruns;
    for (let i = 0; i < E.length; i++) {
      const f = E[i];
      if (!f.actif) continue;
      const o = f.objet, p = o.p, t = (f.age + h) / f.vie, k = f.taille * (1 + 2.6 * t);
      p[0] = f.x + f.vx * h; p[1] = f.y + f.vy * h; p[2] = f.z + f.vz * h; o.s[0] = o.s[1] = o.s[2] = k;
      o.alpha = f.a0 * (1 - t) * Math.min(1, t * 6);
      if (o.alpha > .004) {
        if (candidats) candidats[nombre++] = o;
        if (!tri || (p[0] - ox) * ax + (p[1] - oy) * ay + (p[2] - oz) * az >= limite) sortie.push(o);
      }
    }
    const D = fx.debris;
    for (let i = 0; i < D.length; i++) {
      const d = D[i];
      if (!d.actif) continue;
      const o = d.objet, p = o.p, r = o.r;
      p[0] = d.x + d.vx * h; p[1] = Math.max(d.sol, d.y + d.vy * h); p[2] = d.z + d.vz * h;
      // orientation : prolongée par la vitesse de rotation lue dans PhysX (rotation de |ω|·h autour de ω, dans le
      // repère du monde) ; figée sur une pièce posée (écrite une fois) ; sur une parabole, prolongée par sa rotation
      // propre. Un corps PhysX dont aucune pose n'est encore lue garde l'orientation de son départ.
      if (d.pose >= 2) {
        const wx = d.wx, wy = d.wy, wz = d.wz, w2 = wx * wx + wy * wy + wz * wz, qx = d.qx, qy = d.qy, qz = d.qz, qw = d.qw;
        if (w2 > 1e-12) {
          const w = Math.sqrt(w2), demi = w * h * .5, s = Math.sin(demi) / w, px = wx * s, py = wy * s, pz = wz * s, pw = Math.cos(demi);
          Q[0] = pw * qx + qw * px + (py * qz - pz * qy); Q[1] = pw * qy + qw * py + (pz * qx - px * qz);
          Q[2] = pw * qz + qw * pz + (px * qy - py * qx); Q[3] = pw * qw - (px * qx + py * qy + pz * qz);
        } else { Q[0] = qx; Q[1] = qy; Q[2] = qz; Q[3] = qw; }
        anglesQuaternion(r);
      } else if (d.pose === 1) {
        if (!d.ecrite) { Q[0] = d.qx; Q[1] = d.qy; Q[2] = d.qz; Q[3] = d.qw; anglesQuaternion(r); d.ecrite = true; }
      } else { const w = d.corps ? 0 : d.spin * h; r[0] = d.rx + w; r[1] = d.ry; r[2] = d.rz + w * .7; }
      o.alpha = Math.min(1, Math.max(0, (VIE_DEBRIS - d.age - h) / 2));
      if (o.alpha > .004) {
        if (candidats) candidats[nombre++] = o;
        if (!tri || (p[0] - ox) * ax + (p[1] - oy) * ay + (p[2] - oz) * az >= limite) sortie.push(o);
      }
    }
    // bandes : immobiles une fois posées (leur boîte se calcule à la pose), seule leur pâleur suit le temps
    if (reflet) reflet.debutBandes = nombre;
    // Un rejet commun aux deux disques de 190 m épargne les anciennes traces laissées loin derrière.
    let xmin=-Infinity, xmax=Infinity, zmin=-Infinity, zmax=Infinity;
    if (candidats && glaces) {
      const g=glaces[0].centre, d=glaces[1].centre;
      const marge = VUE + .01;
      xmin=Math.min(g[0],d[0])-marge; xmax=Math.max(g[0],d[0])+marge;
      zmin=Math.min(g[2],d[2])-marge; zmax=Math.max(g[2],d[2])+marge;
    }
    const vue2 = VUE * VUE, BD = fx.bandes;
    for (let i = 0; i < BD.length; i++) {
      const b = BD[i];
      if (!b.actif) continue;
      const o = b.objet, p = o.p, dx = p[0] - ox, dz = p[2] - oz;
      const dansVue = dx * dx + dz * dz <= vue2 && (!tri || dx * ax + (p[1] - oy) * ay + dz * az >= limite);
      const dansReflets = candidats && p[0]>=xmin && p[0]<=xmax && p[2]>=zmin && p[2]<=zmax;
      if (!dansVue && !dansReflets) continue;
      o.alpha = b.a0 * Math.min(1, 1.6 * (1 - (b.age + h) / VIE_TRACE));
      if (o.alpha > .004) {
        if (dansReflets) candidats[nombre++] = o;
        if (dansVue) sortie.push(o);
      }
    }
    if (reflet) reflet.finBandes = nombre;
    const F = fx.fumees;
    for (let i = 0; i < F.length; i++) {
      const f = F[i];
      if (!f.actif) continue;
      const t = Math.min(1, (f.age + h) / f.vie), o = f.objet, p = o.p, d = f.taille * (.5 + 2.7 * (1 - (1 - t) * (1 - t)));
      p[0] = f.x + f.vx * h; p[1] = f.y + f.vy * h; p[2] = f.z + f.vz * h;
      o.s[0] = d; o.s[1] = d * .8; o.s[2] = d;
      o.alpha = f.a0 * Math.pow(1 - t, 1.6) * Math.min(1, t * 8);
      if (o.alpha > .004) {
        if (candidats) candidats[nombre++] = o;
        if (!tri || (p[0] - ox) * ax + (p[1] - oy) * ay + (p[2] - oz) * az >= limite) sortie.push(o);
      }
    }
    const ET = fx.etincelles;
    for (let i = 0; i < ET.length; i++) {
      const e = ET[i];
      if (!e.actif) continue;
      const o = e.objet, p = o.p, v = Math.sqrt(e.vx * e.vx + e.vy * e.vy + e.vz * e.vz), age = e.age + h;
      p[0] = e.x + e.vx * h; p[1] = e.y + e.vy * h; p[2] = e.z + e.vz * h;
      o.s[0] = Math.max(.06, Math.min(.5, v * .02)); o.s[1] = .028; o.s[2] = .028;
      // une étincelle née après l'instant dessiné (h négatif, juste après une mise à jour) n'est pas encore là
      o.alpha = age < 0 ? 0 : Math.max(0, 1 - age / e.vie);
      if (o.alpha > .004) {
        if (candidats) candidats[nombre++] = o;
        if (!tri || (p[0] - ox) * ax + (p[1] - oy) * ay + (p[2] - oz) * az >= limite) sortie.push(o);
      }
    }
    if (reflet) reflet.nombre = nombre;
  }

  // Effets vivants, pour les essais et le banc ; `sortie` (facultatif) est rempli et rendu, sans objet neuf.
  // corps : pièces de la séance simulées par PhysX ; dalles : sols statiques qu'elle a posés dans le monde.
  function compter(fx, sortie) {
    let bandes = 0, fumees = 0, etincelles = 0, debris = 0, embruns = 0, corps = 0, dalles = 0;
    for (let i = 0; i < fx.bandes.length; i++) if (fx.bandes[i].actif) bandes++;
    for (let i = 0; i < fx.fumees.length; i++) if (fx.fumees[i].actif) fumees++;
    for (let i = 0; i < fx.etincelles.length; i++) if (fx.etincelles[i].actif) etincelles++;
    for (let i = 0; i < fx.debris.length; i++) { const d = fx.debris[i]; if (d.actif) debris++; if (d.corps) corps++; }
    for (let i = 0; i < fx.embruns.length; i++) if (fx.embruns[i].actif) embruns++;
    for (let i = 0; i < fx.sols.length; i++) dalles += fx.sols[i].boites.length;
    const c = sortie || {};
    c.bandes = bandes; c.fumees = fumees; c.etincelles = etincelles; c.debris = debris; c.embruns = embruns; c.corps = corps; c.dalles = dalles;
    return c;
  }

  B.traces = { creer, pas, dessiner, creerReflet, dessinerReflet, extrapolation, compter, liberer, prechauffer, mondePage, BANDES, FUMEES, ETINCELLES, VIE_TRACE, PAS, DEBRIS, VIE_DEBRIS, PIECES_PAR_VOITURE };
})(globalThis.BITUME = globalThis.BITUME || {});
