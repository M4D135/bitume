/* BITUME — rameaux de sapin et de mélèze pour la vallée de la Stura. */
(function (B) {
  'use strict';
  const especes = ['sapin', 'meleze'];
  const nom = (espece, detail) => 'arbre-alpin-' + espece + '-' + detail;
  const unite = v => { const l = Math.hypot(...v); return v.map(x => x / l); };

  function normale(a, b, c) {
    const x = b[0] - a[0], y = b[1] - a[1], z = b[2] - a[2];
    const u = c[0] - a[0], v = c[1] - a[1], w = c[2] - a[2];
    return unite([y*w-z*v, z*u-x*w, x*v-y*u]);
  }

  // Quatre faces sur chaque côté d'une courte ramille. Les arêtes courbes
  // captent la lumière sans déposer de carte transparente dans le feuillage.
  function ramille(tri, a, b, droite, gauche, dessus, dessous, simple) {
    if (simple) {
      for (const [u, v, w] of [[a, droite, b], [a, b, gauche], [a, gauche, droite], [b, droite, gauche]]) {
        const n = normale(u, v, w);
        tri.push([u, v, w, n, n, n]);
      }
      return;
    }
    const bord = [a, droite, b, gauche];
    for (const [axe, sens] of [[dessus, 1], [dessous, -1]]) {
      const faces = bord.map((p, i) => normale(axe, sens > 0 ? p : bord[(i + 1) % 4], sens > 0 ? bord[(i + 1) % 4] : p));
      const sommet = unite(faces.reduce((s, n) => s.map((x, k) => x + n[k]), [0, 0, 0]));
      const contour = faces.map((n, i) => unite(n.map((x, k) => x + faces[(i + 3) % 4][k])));
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4, u = sens > 0 ? i : j, v = sens > 0 ? j : i;
        tri.push([axe, bord[u], bord[v], sommet, contour[u], contour[v]]);
      }
    }
  }

  function rameau(tri, point, amplitude, tombant, detail) {
    // Axe étroit, prolongé par une pointe relevée. Les pousses secondaires
    // partent de l'axe et retombent de chaque côté, en laissant paraître le ciel.
    const rayon = detail === 'loin' ? amplitude * .75 : amplitude * .30;
    ramille(tri, point(0,0,0), point(1,0,0), point(.45,rayon,-tombant*.49),
      point(.57,-rayon,-tombant*.44), point(.38,0,tombant*.25), point(.50,0,-tombant*.75), detail !== 'proche');
    if (detail === 'loin') return;
    const rangs = detail === 'proche' ? [.14,.39,.62] : [.26];
    for (const t of rangs) for (const cote of [-1,1]) {
      if (t === .62 && cote < 0) continue;
      const u = cote > 0 ? t : t+.065;
      const bout = Math.min(1, u+.35), portee = amplitude * (1.12-.78*u), creux = tombant * (1.05-.62*u);
      const milieu = (u+bout)*.5, centre = cote*portee*.48;
      const l = amplitude*(.23-.12*u);
      ramille(tri, point(u,0,0), point(bout,cote*portee,-creux),
        point(milieu,centre+l,-creux*.51), point(milieu+.07,centre-l,-creux*.62),
        point(milieu,centre,-creux*.21), point(milieu,centre,-creux*.85), detail !== 'proche');
    }
  }

  // Les aiguilles de l'intérieur masquent une partie du tronc, en touffes
  // imbriquées. Le contour extérieur reste formé de rameaux séparés.
  function coeur(tri, meleze, detail) {
    let bas;
    const n = detail === 'proche' ? 9 : 6, couches = detail === 'proche' ? 11 : 6;
    for (let i = 0; i <= couches; i++) {
      const t = i/couches, y = -.44 + .93*t;
      const r = (meleze ? .19 : .25) * Math.pow(1-t, .82) * (i === 0 ? .42 : 1);
      const haut = Array.from({ length:n }, (_,j) => {
        const a = 2*Math.PI*j/n + .12*Math.sin(i*1.6+j*.4);
        const rayon = r*(.8+.2*Math.sin(i*2.7+j*3.1));
        return [rayon*Math.cos(a), y+(i && i<couches ? .03*Math.sin(i+j*2) : 0), rayon*Math.sin(a)];
      });
      if (bas) for (let j=0;j<n;j++) {
        const k=(j+1)%n, a=bas[j], b=bas[k], c=haut[j], d=haut[k];
        const no=normale(a,c,b);
        tri.push([a,c,b,no,no,no]);
        if (i<couches) { const nn=normale(c,d,b); tri.push([c,d,b,nn,nn,nn]); }
      }
      bas=haut;
    }
  }

  // Fût et branches nues sont des prismes effilés ; leur faible diamètre est
  // donné en fraction de hauteur. Ils restent reliés jusqu’à la pointe en hiver.
  function bois(tri, a, b, r0, r1, faces) {
    const axe = unite(b.map((v,k) => v-a[k]));
    const i = Math.abs(axe[1]) > .95 ? [1,0,0] : unite([-axe[2],0,axe[0]]);
    const j = unite([axe[1]*i[2]-axe[2]*i[1],axe[2]*i[0]-axe[0]*i[2],axe[0]*i[1]-axe[1]*i[0]]);
    const n = Array.from({length:faces}, (_,k) => {
      const t=k*2*Math.PI/faces;
      return i.map((x,m)=>x*Math.cos(t)+j[m]*Math.sin(t));
    });
    const bas = n.map(dir=>a.map((x,m)=>x+r0*dir[m])), haut = n.map(dir=>b.map((x,m)=>x+r1*dir[m]));
    for (let k=0;k<faces;k++) {
      const l=(k+1)%faces;
      if (r1 === 0) {
        // La pointe éloignée d’un rameau nu fait moins d’un pixel. Chaque
        // face atteint son extrémité exacte, sans second anneau ni face cachée.
        const pointe = unite(n[k].map((x,m)=>x+n[l][m]));
        tri.push([bas[k],bas[l],b,n[k],n[l],pointe]);
      } else {
        tri.push([bas[k],bas[l],haut[k],n[k],n[l],n[k]], [haut[k],bas[l],haut[l],n[k],n[l],n[l]]);
      }
    }
  }

  function construire(espece, detail) {
    const loin = detail === 'loin';
    const nu = espece === 'meleze-nu', meleze = espece !== 'sapin', tri = [];
    let etat = meleze ? 51541 : 62851;
    const hasard = () => { etat = (Math.imul(etat,1664525)+1013904223)>>>0; return etat/4294967296; };
    const etages = meleze ? 10 : 9;
    bois(tri, [0,-.5,0], [0,.5,0], nu ? .019 : .012, .001, loin ? 4 : 6);
    if (!nu) coeur(tri, meleze, detail);
    let angle = hasard()*Math.PI;
    for (let etage=0; etage<etages; etage++) {
      const t=etage/(etages-1), nb=(meleze?6:7)-Math.round(t*3);
      angle += 2.4 + (hasard()-.5)*.8;
      for (let b=0;b<nb;b++) {
        const az=angle+2*Math.PI*(b+(hasard()-.5)*.32)/nb;
        const along=Math.cos(az), across=Math.sin(az);
        const y=(meleze?-.34:-.33)+t*(meleze?.80:.79)+(hasard()-.5)*.055*(1-t);
        const longueur=(.055+.42*Math.pow(1-t, .76))*(.82+.18*hasard());
        const pente=longueur*((meleze?-.05:-.16)+t*.28+(hasard()-.5)*.20);
        const vrille=(hasard()-.5)*.24*longueur;
        const largeur=longueur*(meleze?.25:.41)*(.82+.23*hasard());
        const chute=longueur*(meleze?.16:.23)*(.83+.25*hasard());
        const point=(u,v,h) => {
          const tangente=v+vrille*u*u;
          return [along*longueur*u-across*tangente, y+pente*u - .26*longueur*u*(1-u)+h, across*longueur*u+along*tangente];
        };
        if (nu) {
          bois(tri, point(0,0,0), point(1,0,.019), .0045*(1-t)+.001, loin ? 0 : .0007, 3);
          if (detail === 'proche') for (const signe of [-1,1]) {
            bois(tri, point(.48,0,.008), point(.83,signe*largeur,-chute*.55), .0021, .0004, 3);
          }
        } else rameau(tri, point, largeur, chute, detail);
      }
    }
    return tri;
  }

  // Prototype commun à toute la vallée. On enregistre avant FRender.create(), une seule fois.
  const rendu = globalThis.FRender;
  if (rendu) for (const espece of [...especes, 'meleze-nu']) for (const detail of ['proche','leger','loin']) {
    rendu.forme(nom(espece, detail), construire(espece, detail));
  }
  B.coniferesAlpins = { nom, construire };
})(globalThis.BITUME = globalThis.BITUME || {});
