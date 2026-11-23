/* BITUME — bassin de la Baie-du-Corail sur le parcours Karst et Lagon. */
(function (B) {
  'use strict';
  const borner = (x, a, b) => Math.max(a, Math.min(b, x));
  const lisse = (a,b,x) => { const t=borner((x-a)/(b-a),0,1); return t*t*(3-2*t); };
  const LONG = 230, LARGE = 99;

  function choisirSite(c, secteurs, interroger) {
    let meilleur = null, scoreMax = -Infinity;
    const pas = Math.max(1, Math.round(95 / c.pas));
    for (let i=0; i<c.n; i+=pas) {
      const plage = secteurs.plages[secteurs.indices[i]], s = i*c.pas;
      if (plage.theme !== 'corail' || Math.min(s-plage.debut,plage.fin-s) < LONG+50) continue;
      const cap = c.cap[i], tx = Math.cos(cap), tz = Math.sin(cap);
      for (const cote of [-1,1]) {
        const x = c.x[i]-tz*cote*119, z = c.z[i]+tx*cote*119;
        // Réserver le long du tracé une véritable étendue libre, y compris si une autre boucle s'en approche.
        let score = Infinity;
        for (const along of [-150,0,150]) for (const travers of [-38,38]) {
          const q = interroger(x+along*tx-travers*tz,z+along*tz+travers*tx,235,true);
          if (q.i >= 0 && secteurs.plages[secteurs.indices[q.i]].theme !== 'corail') { score = -Infinity; continue; }
          score = Math.min(score,q.i < 0 ? 235 : q.d);
        }
        // À dégagement égal, préférer une vue dégagée depuis un axe peu incliné.
        score -= Math.abs(c.pente?.[i] || 0)*100;
        if (score > scoreMax) { scoreMax=score; meilleur={x,z,s,cap,tx,tz,niveau:c.y[i]-3.2}; }
      }
    }
    return meilleur;
  }

  function construire(c, secteurs, interroger, grille, outils) {
    if (!secteurs?.plages.some(p => p.theme === 'corail')) return null;
    const site = choisirSite(c,secteurs,interroger);
    if (!site) return null;
    const {x0,z0,nx,nz,pas,H,D,poidsSol,alterne} = grille;
    let emprise = c.largeur / 2 || 6;
    for (let i=0; i<c.n; i++)
      emprise = Math.max(emprise, c.limiteG?.[i] || 0, c.limiteD?.[i] || 0, c.largeurG?.[i] || 0, c.largeurD?.[i] || 0);
    // Inclure le diamètre d'un triangle et un pas de l'axe : aucun triangle modifié ne peut atteindre
    // le dégagement d'une route, même entre deux sommets de la grille ou entre deux échantillons de piste.
    const garde = emprise + Math.SQRT2*pas + c.pas + 4;
    const rx = 1.27*(Math.abs(site.tx)*LONG+Math.abs(site.tz)*LARGE);
    const rz = 1.27*(Math.abs(site.tz)*LONG+Math.abs(site.tx)*LARGE);
    const i0 = borner(Math.floor((site.x-rx-x0)/pas),0,nx-2), i1 = borner(Math.ceil((site.x+rx-x0)/pas),i0+1,nx-1);
    const j0 = borner(Math.floor((site.z-rz-z0)/pas),0,nz-2), j1 = borner(Math.ceil((site.z+rz-z0)/pas),j0+1,nz-1);
    const largeur = i1-i0+1, taille = largeur*(j1-j0+1);
    const signe = new Float32Array(taille), sable = new Uint8Array(taille), ancien = new Float32Array(taille);
    let rive = null, mouillage = null, scoreRive = Infinity, scoreMouillage = Infinity;
    for (let j=j0; j<=j1; j++) for (let i=i0; i<=i1; i++) {
      const k=j*nx+i, q=(j-j0)*largeur+i-i0, dx=x0+i*pas-site.x, dz=z0+j*pas-site.z;
      const u=(dx*site.tx+dz*site.tz)/LONG, v=(-dx*site.tz+dz*site.tx)/LARGE;
      const rayon = Math.hypot(u,v)*(1+.045*Math.sin(u*5+v*3));
      ancien[q] = H[k];
      const acces = lisse(garde,garde+23,D[k])*lisse(.58,.94,poidsSol[k]/255);
      const poids = acces*(1-lisse(1.09,1.25,rayon));
      if (poids>0) {
        const fond=site.niveau-17*(1-lisse(.38,1,rayon))+3.4*lisse(1,1.13,rayon);
        H[k] += (fond-H[k])*poids;
        sable[q]=Math.round(255*poids*lisse(.61,.91,rayon));
      }
      signe[q] = Math.min(site.niveau-H[k], (1.055-rayon)*LARGE, D[k]-garde, (poidsSol[k]/255-.62)*LARGE);
      if (signe[q]>5 && D[k]<153) {
        const score=Math.hypot(dx,dz);
        if (score<scoreMouillage) {
          scoreMouillage=score; mouillage={x:x0+i*pas,y:site.niveau,z:z0+j*pas,cap:site.cap};
        }
      }
    }
    const masque = (i,j) => (j-j0)*largeur+i-i0;
    const dans = (i,j) => i>=i0 && i<i1 && j>=j0 && j<j1;
    // Le même champ linéaire par triangle décide où dessiner l'eau et où un oiseau peut y vivre.
    function niveauEauA(x,z) {
      const fi=(x-x0)/pas, fj=(z-z0)/pas, i=Math.floor(fi), j=Math.floor(fj);
      if (!dans(i,j)) return NaN;
      const u=fi-i, v=fj-j, k=masque(i,j), a=signe[k], b=signe[k+1], d=signe[k+largeur], cc=signe[k+largeur+1];
      let f;
      if (alterne && ((i+j)&1))
        f = u+v<=1 ? a+(b-a)*u+(d-a)*v : cc+(d-cc)*(1-u)+(b-cc)*(1-v);
      else f = u>=v ? a+(b-a)*u+(cc-b)*v : a+(cc-d)*u+(d-a)*v;
      return f>0 ? site.niveau : NaN;
    }
    const nappe = outils.nappe(12*taille), normale=[0,1,0];
    const point = (i,j) => ({x:x0+i*pas,z:z0+j*pas,d:signe[masque(i,j)],fond:site.niveau-H[j*nx+i]});
    function triangle(a,b,c) {
      if (a.d<=0 && b.d<=0 && c.d<=0) return;
      const polygone=[], points=[a,b,c];
      for (let i=0; i<3; i++) {
        const p=points[i], q=points[(i+1)%3];
        if (p.d>0) polygone.push(p);
        if ((p.d>0)!==(q.d>0)) {
          const u=p.d/(p.d-q.d);
          polygone.push({x:p.x+(q.x-p.x)*u,z:p.z+(q.z-p.z)*u,fond:p.fond+(q.fond-p.fond)*u});
        }
      }
      const indices=[];
      for (const p of polygone) {
        const d=lisse(0,14,p.fond);
        indices.push(outils.sommet(nappe,[p.x,site.niveau,p.z],normale,12,[.27-.23*d,.70-.32*d,.62-.15*d]));
      }
      for (let i=2; i<indices.length; i++) nappe.i.push(indices[0],indices[i-1],indices[i]);
    }
    for (let j=j0; j<j1; j++) for (let i=i0; i<i1; i++) {
      const a=point(i,j),b=point(i+1,j),cc=point(i+1,j+1),d=point(i,j+1);
      if (alterne && ((i+j)&1)) { triangle(a,d,b); triangle(b,d,cc); }
      else { triangle(a,cc,b); triangle(a,d,cc); }
    }
    if (!nappe.i.length) {
      for (let j=j0; j<=j1; j++) for (let i=i0; i<=i1; i++) H[j*nx+i]=ancien[masque(i,j)];
      return null;
    }
    const voisinsCardinaux = [[-1,0],[1,0],[0,-1],[0,1]];
    const voisinsDiagonaux = [[-1,-1],[1,1]];
    const voisinsAlternes = [[-1,-1],[1,1],[-1,1],[1,-1]];
    function voisinsDuSommet(i,j) {
      const diagonaux = alterne ? (((i+j)&1) ? [] : voisinsAlternes) : voisinsDiagonaux;
      return voisinsCardinaux.concat(diagonaux).filter(([di,dj]) =>
        i+di>=i0 && i+di<=i1 && j+dj>=j0 && j+dj<=j1);
    }
    // Pour le phare, prendre un sommet émergé directement voisin d'un triangle humide.
    // Un relief bas au-delà de la baie ne peut pas recevoir le repère ni sa faune littorale.
    for (let j=j0; j<=j1; j++) for (let i=i0; i<=i1; i++) {
      const k=masque(i,j), y=H[j*nx+i], haut=y-site.niveau;
      if (haut<.25 || haut>6 || signe[k]>0 || D[j*nx+i]<garde+8) continue;
      let distanceRive = Infinity, denivele = 0;
      for (const [di,dj] of voisinsDuSommet(i,j)) {
        const longueur = di && dj ? Math.SQRT2 : 1;
        const signeVoisin = signe[masque(i+di,j+dj)];
        if (signeVoisin>0)
          distanceRive = Math.min(distanceRive,pas*longueur*(-signe[k])/(signeVoisin-signe[k]));
        denivele = Math.max(denivele,Math.abs(H[(j+dj)*nx+i+di]-y)/longueur);
      }
      if (!Number.isFinite(distanceRive)) continue;
      const x=x0+i*pas, z=z0+j*pas, score=distanceRive+denivele+Math.abs(haut-1.6)*8;
      if (score<scoreRive) { scoreRive=score; rive={x,y,z,cap:site.cap}; }
    }
    function niveauHabitatA(x,z) {
      if (Number.isFinite(niveauEauA(x,z))) return site.niveau;
      const i=Math.round((x-x0)/pas), j=Math.round((z-z0)/pas);
      if (i<i0 || i>i1 || j<j0 || j>j1) return NaN;
      return voisinsDuSommet(i,j).some(([di,dj]) => signe[masque(i+di,j+dj)]>0)
        ? site.niveau : NaN;
    }
    const eau=outils.finir(nappe);
    Object.defineProperty(eau,'surfaceType',{value:'eau'});
    return { ...site, rive, mouillage, eau, niveauEauA, niveauHabitatA, contientCellule: dans,
      sable(i,j) { return i>=i0 && i<=i1 && j>=j0 && j<=j1 ? sable[masque(i,j)]/255 : 0; } };
  }
  B.lagon = { construire };
})(globalThis.BITUME = globalThis.BITUME || {});
