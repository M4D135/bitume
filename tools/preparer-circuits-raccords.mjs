// Fabrication hors ligne des trois boucles du catalogue. Exécuter avec Node depuis n’importe quel répertoire.
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import '../src/circuit.js';

const C = globalThis.BITUME.circuit;
const src = fichier => new URL('../src/' + fichier, import.meta.url);
const catalogue = readFileSync(src('jeu.js'), 'utf8').match(/^\s*const CATALOGUE = (\[[\s\S]*?^\s*\]);/m);
if (!catalogue) throw new Error('CATALOGUE introuvable dans src/jeu.js');
const fusions = runInNewContext(catalogue[1]).filter(d => d.troncons);
const mod = (i, n) => (i % n + n) % n;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const champs = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'limiteG', 'limiteD', 'ligne', 'vitesse', 'vibreur'];

function sommet(c, i, sens = 1) {
  const lg = c.limiteG[i], ld = c.limiteD[i], masque = c.vibreur[i];
  return {x:c.x[i], y:c.y[i], z:c.z[i], largeurG:c.largeur / 2, largeurD:c.largeur / 2,
    devers:c.devers[i] * sens, limiteG:sens === 1 ? lg : ld, limiteD:sens === 1 ? ld : lg,
    masque:sens === 1 ? masque : ((masque & 1) << 1) | ((masque & 2) >> 1)};
}

function tangent(a, b) {
  const ds = distance(a, b);
  return {x:(b.x - a.x) / ds, y:(b.y - a.y) / ds, z:(b.z - a.z) / ds};
}

// Une coupe enlève uniquement le petit arc situé au-delà d'une droite d'appui du circuit.
// Les zones du départ et des stands du premier circuit restent intégralement sur le tracé.
function coupes(c, protegerGrille) {
  const propositions = [];
  for (let direction = 0; direction < 32; direction++) {
    const cap = direction * Math.PI / 16, ux = Math.cos(cap), uz = Math.sin(cap);
    const ext = Float64Array.from(c.x, (x, i) => x * ux + c.z[i] * uz);
    let centre = 0;
    for (let i = 1; i < c.n; i++) if (ext[i] > ext[centre]) centre = i;
    for (const profondeur of [32, 54, 80]) {
      const plan = ext[centre] - profondeur;
      let avant = centre, apres = centre;
      while (ext[avant] > plan) avant = mod(avant - 1, c.n);
      while (ext[apres] > plan) apres = mod(apres + 1, c.n);
      const longueur = mod(apres - avant, c.n) * c.pas;
      if (longueur < 110 || longueur > c.longueur * .19) continue;
      if (protegerGrille && (avant >= apres || avant * c.pas < c.ligneDroite.fin + 80 ||
          apres * c.pas > c.longueur + c.ligneDroite.debut - 80)) continue;
      const a = sommet(c, avant), b = sommet(c, apres);
      const ecart = (b.z - a.z) * ux - (b.x - a.x) * uz;
      if (Math.abs(ecart) < 100) continue;
      const entre = tangent(sommet(c, mod(avant - 1, c.n)), a);
      const sort = tangent(b, sommet(c, mod(apres + 1, c.n)));
      const ouverture = Math.min(ux * entre.x + uz * entre.z, -ux * sort.x - uz * sort.z);
      if (ouverture < .3) continue;
      propositions.push({avant, apres, cap, ux, uz, max:ext[centre], ecart, longueur, ouverture});
    }
  }
  return propositions;
}

function relier(p, q, depart, arrivee) {
  const d = distance(p, q), n = Math.ceil(d); // deux fois plus fin que la grille jouable des parcours sources
  const voie = [];
  for (let i = 1; i < n; i++) {
    const t = i / n, u = 1 - t, h = t*t*(3 - 2*t), m0 = t*u*u*d, m1 = -t*t*u*d;
    voie.push({x:p.x + (q.x-p.x)*h + m0*depart.x + m1*arrivee.x,
      y:p.y + (q.y-p.y)*h + m0*depart.y + m1*arrivee.y,
      z:p.z + (q.z-p.z)*h + m0*depart.z + m1*arrivee.z,
      largeurG:p.largeurG, largeurD:p.largeurD, devers:p.devers + (q.devers-p.devers)*h,
      limiteG:p.limiteG + (q.limiteG-p.limiteG)*h, limiteD:p.limiteD + (q.limiteD-p.limiteD)*h});
  }
  return voie;
}

function assembler(A, B, a, b, ecartement) {
  const theta = a.cap + Math.PI - b.cap, ca = Math.cos(theta), sa = Math.sin(theta);
  const sens = Math.sign(a.ecart * b.ecart);
  const debutB = sens === 1 ? b.apres : b.avant, finB = sens === 1 ? b.avant : b.apres;
  const p = i => sommet(A, mod(i, A.n));
  const avant = p(a.avant), apres = p(a.apres);
  const debut = sommet(B, debutB), fin = sommet(B, finB);
  // Dans l'axe U, B entier vient au-delà du plan d'appui de A plus une largeur de corridor.
  // Dans l'axe transversal et en altitude, aligner la moyenne des deux extrémités, sans incliner B.
  const du = a.max + ecartement + b.max;
  const mxB = (debut.x+fin.x)/2, mzB = (debut.z+fin.z)/2;
  const tx = (avant.x+apres.x)/2 - (ca*mxB - sa*mzB), tz = (avant.z+apres.z)/2 - (sa*mxB + ca*mzB);
  const dv = -a.uz*tx + a.ux*tz, dy = (avant.y+apres.y-debut.y-fin.y)/2;
  const dx = a.ux*du - a.uz*dv, dz = a.uz*du + a.ux*dv;
  function q(i) {
    const p = sommet(B, mod(i, B.n), sens), x = p.x;
    p.x = ca*x - sa*p.z + dx; p.z = sa*x + ca*p.z + dz; p.y += dy;
    return p;
  }
  const depart = q(debutB), finParcours = q(finB);
  const aller = relier(avant, depart, tangent(p(a.avant-1), avant), tangent(depart, q(debutB+sens)));
  const retour = relier(finParcours, apres, tangent(q(finB-sens), finParcours), tangent(apres, p(a.apres+1)));
  const points = [];
  for (let i = 0; i <= a.avant; i++) points.push(p(i));
  const sortieA = points.length - 1;
  points.push(...aller);
  const entreeB = points.length;
  for (let i = debutB;; i = mod(i + sens, B.n)) {
    points.push(q(i));
    if (i === finB) break;
  }
  const sortieB = points.length - 1;
  points.push(...retour);
  const entreeA = points.length;
  for (let i = a.apres; i < A.n; i++) points.push(p(i));
  points.push(points[0]);
  return {points, sortieA, entreeB, sortieB, entreeA, sensB:sens};
}

// Une grille de 64 m couvre les rives du ruban et les limites physiques jusqu’à 20 m de chaque côté.
// La distance entre deux points correspondants sur les cordes et sur leurs extrémités échantillonnées
// varie d'au plus 2 pas. On élargit la garde et la plage d'abscisses de cette même quantité.
function brasDegages(c) {
  const garde = 2*20 + 2 + 2*c.pas;
  const intervalle = 150 - 2*c.pas, grille = new Map();
  for (let j = 0; j < c.n; j++) {
    const x = c.x[j], z = c.z[j], gx = Math.floor(x/64), gz = Math.floor(z/64);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const indices = grille.get((gx+a) + ',' + (gz+b));
      if (!indices) continue;
      for (const i of indices) {
        const ds = (j-i) * c.pas;
        if (ds < intervalle || c.longueur-ds < intervalle) continue;
        const dx = c.x[i]-x, dz = c.z[i]-z;
        if (dx*dx + dz*dz < garde*garde) return false;
      }
    }
    const cle = gx + ',' + gz, liste = grille.get(cle);
    if (liste) liste.push(j); else grille.set(cle, [j]);
  }
  return true;
}

// Examiner le ruban continu jusqu'à un mètre au-delà de chaque rail. Chaque cellule indexe
// les quadrilatères entiers : deux sections qui se coupent partagent nécessairement une cellule.
function railsSansCroisement(c) {
  function section(i) {
    const x = c.x[i], z = c.z[i], sx = -Math.sin(c.cap[i]), sz = Math.cos(c.cap[i]);
    return [-(c.limiteG[i]+1), c.limiteD[i]+1].map(d => ({x:x+d*sx, z:z+d*sz}));
  }
  const orientation = (a,b,p) => (b.x-a.x)*(p.z-a.z) - (b.z-a.z)*(p.x-a.x);
  // Pour deux polygones convexes disjoints, une arête sépare nécessairement les deux polygones.
  function areteSepare(a,b) {
    return a.some((p,i) => b.every(q => orientation(p,a[(i+1)%4],q) < -1e-8));
  }
  const cellules = new Map(), ruban = [], vus = new Int32Array(c.n).fill(-1);
  let bord = section(0);
  for (let i=0; i<c.n; i++) {
    const suivant = section((i+1)%c.n);
    const quad = [bord[0],suivant[0],suivant[1],bord[1]];
    if (quad.some((p,k) => orientation(p,quad[(k+1)%4],quad[(k+2)%4]) <= 1e-8)) return false;
    const gx = quad.map(p => Math.floor(p.x/32)), gz = quad.map(p => Math.floor(p.z/32));
    const x0 = Math.min(...gx), x1 = Math.max(...gx), z0 = Math.min(...gz), z1 = Math.max(...gz);
    for (let x=x0; x<=x1; x++) for (let z=z0; z<=z1; z++) {
      const cle = x+','+z;
      let indices = cellules.get(cle);
      if (!indices) { indices=[]; cellules.set(cle,indices); }
      for (const j of indices) {
        if (j === i-1 || (j === 0 && i === c.n-1) || vus[j] === i) continue;
        vus[j] = i;
        if (!areteSepare(quad,ruban[j]) && !areteSepare(ruban[j],quad)) return false;
      }
      indices.push(i);
    }
    ruban.push(quad);
    bord = suivant;
  }
  return true;
}

function fabriquer(def) {
  const [A,B] = def.troncons.map(t => C.creer(t.graine, {...t, differerTrajectoire:true}));
  const paires = [];
  for (const a of coupes(A,true)) for (const b of coupes(B,false)) {
    const score = Math.abs(Math.abs(a.ecart)-Math.abs(b.ecart)) + .3*(a.longueur+b.longueur)
      + 140*(2-a.ouverture-b.ouverture);
    paires.push({a,b,score});
  }
  paires.sort((p,q) => p.score - q.score);
  for (const {a,b} of paires) for (const ecartement of [180,300,480,750]) {
    const r = assembler(A,B,a,b,ecartement);
    const c = C.creerDepuisTrace({unite:'m', nom:def.nom, points:r.points, pasMax:2});
    const courbure = c.courbure.reduce((m,v) => Math.max(m,Math.abs(v)), 0);
    const pente = c.pente.reduce((m,v) => Math.max(m,Math.abs(v)), 0);
    if (courbure > 1/23.5 || pente > .07 || !brasDegages(c) || !railsSansCroisement(c)) continue;
    const s = c.abscissesSource;
    const corridors = [{debut:s[r.sortieA],fin:s[r.entreeB]}, {debut:s[r.sortieB],fin:s[r.entreeA]}];
    const tronconsThemes = def.troncons.map((t,i) => ({id:t.id, theme:t.theme,
      debut:i ? corridors[0].fin : corridors[1].fin, fin:i ? corridors[1].debut : corridors[0].debut}));
    c.vibreur = new Uint8Array(c.n);
    let k = 0;
    for (let i = 0; i < c.n; i++) {
      const abscisse = i*c.pas;
      while (k+1 < s.length && abscisse > (s[k]+s[k+1])/2) k++;
      c.vibreur[i] = r.points[k].masque ?? (Math.abs(c.courbure[i]) > 1/140 ? 3 : 0);
    }
    C.preparerParcours(c);
    const meta = {longueur:c.longueur,n:c.n,pas:c.pas,largeur:c.largeur,limite:A.limite,depart:0,
      ligneDroite:A.ligneDroite, stands:A.stands, secteurs:[c.longueur/3,c.longueur*2/3].map(x => Math.round(x/c.pas)*c.pas),
      corridors, tronconsThemes, sources:def.troncons.map(t => [t.id,t.theme,t.graine,t.longueur])};
    const rapport = {id:def.id,longueur:c.longueur,rayonMin:1/courbure,penteMax:pente,
      conservation:[1-a.longueur/A.longueur,1-b.longueur/B.longueur],sensB:r.sensB,
      ecartement, ecartMinimalBrasDistants:42, margeExterieureGlissieres:1, tronconsDeRubanSansIntersection:c.n, corridors, tronconsThemes};
    return {c, meta, rapport};
  }
  throw new Error('Aucun raccord respectant le gabarit pour '+def.id);
}

// Grouper les huit octets de même poids : sur une portion voisine, les différences XOR sont souvent
// nulles, notamment pour l'exposant, les limites et les vibreurs. 0…127 = littéraux, 128…255 = zéros.
function encoder(octets, taille) {
  const n = octets.length / taille, plans = new Uint8Array(octets.length);
  for (let b=0; b<taille; b++) {
    let precedent = 0;
    for (let i=0; i<n; i++) {
      const v = octets[i*taille+b];
      plans[b*n+i] = v ^ precedent;
      precedent = v;
    }
  }
  const flux = [];
  function ecrireLitteraux(debut,fin) {
    for (let i=debut; i<fin; i+=128) {
      const longueur = Math.min(128,fin-i);
      flux.push(longueur-1,...plans.subarray(i,i+longueur));
    }
  }
  let debut = 0, i = 0;
  while (i < plans.length) {
    if (plans[i] || plans[i+1] !== 0 || plans[i+2] !== 0) { i++; continue; }
    ecrireLitteraux(debut,i);
    let fin = i+3;
    while (fin < plans.length && plans[fin] === 0) fin++;
    while (i<fin) { const longueur=Math.min(128,fin-i); flux.push(127+longueur); i+=longueur; }
    debut = fin;
  }
  ecrireLitteraux(debut,plans.length);
  return Buffer.from(flux).toString('base64');
}

const recettes = {}, rapports = [];
for (const def of fusions) {
  const {c,meta,rapport} = fabriquer(def);
  const donnees = {};
  for (const nom of champs) {
    const valeurs = c[nom];
    // Écrire chaque mot en little endian, ordre indépendant de la plate-forme de fabrication.
    const octets = Buffer.alloc(valeurs.length * (nom === 'vibreur' ? 1 : 8));
    for (let i = 0; i < valeurs.length; i++) {
      if (nom === 'vibreur') octets[i] = valeurs[i]; else octets.writeDoubleLE(valeurs[i],8*i);
    }
    donnees[nom] = encoder(octets,nom === 'vibreur' ? 1 : 8);
  }
  recettes[def.id] = {meta,donnees};
  rapports.push(rapport);
}
writeFileSync(src('circuit-raccords-data.js'), '// Généré par tools/preparer-circuits-raccords.mjs.\n(globalThis.BITUME ||= {}).recettesRaccords = '+JSON.stringify(recettes)+';\n');
console.log(JSON.stringify(rapports,null,2));
