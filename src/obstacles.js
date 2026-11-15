/* BITUME — solides fixes issus du décor dessiné. Grille16m, caisses orientées et balayage à pas bornés.
   Les glissières et les autres voitures restent dans leurs modules. Aucun effet sur une course sans solides.
   Un déplacement exceptionnel >25m en un pas est refusé, sans dégâts : c'est une téléportation, pas un choc. */
(function (B) {
  'use strict';
  const CELLULE = 16, LONG = 2.475, LARGE = 1.01, HAUT = 1.1, EPS = .002;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angle = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
  const wrap = (s, L) => ((s % L) + L) % L;
  const ecart = (a, b, L) => { let d = b - a; if (d > L / 2) d -= L; else if (d < -L / 2) d += L; return d; };

  // Prisme du cylindre WebGL FERRO : 16 côtés, mêmes sommets et rotation Rz·Ry·Rx.
  // Les sommets centrés, axes de faces et directions d'arêtes sont calculés une seule fois.
  function prisme(source) {
    if (!['p','s','r'].every(k => Array.isArray(source[k]) && source[k].length===3 && source[k].every(Number.isFinite)) ||
        source.s.some(v=>v<=0) || source.sides!==16) return null;
    const [rx,ry,rz]=source.r, cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
    const tourner=(x,y,z)=>{const y1=cx*y-sx*z,z1=sx*y+cx*z,x2=cy*x+sy*z1,z2=-sy*x+cy*z1;return[cz*x2-sz*y1,sz*x2+cz*y1,z2];};
    const sommets=[], axes=[tourner(0,1,0)], aretes=[tourner(0,1,0)], [dx,dy,dz]=source.s;
    let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity,zmin=Infinity,zmax=-Infinity;
    for(let i=0;i<16;i++) {
      const a=i*Math.PI/8,b=(i+1)*Math.PI/8,m=(a+b)/2;
      const edge=tourner((Math.cos(b)-Math.cos(a))*dx,0,(Math.sin(b)-Math.sin(a))*dz);
      aretes.push(edge); axes.push(tourner(Math.cos(m)/dx,0,Math.sin(m)/dz));
      // Arête du prisme croisée avec la verticale de la voiture (indépendante de son cap).
      axes.push([-edge[2],0,edge[0]]);
      for(const sign of [-1,1]) {
        const v=tourner(Math.cos(a)*dx/2,sign*dy/2,Math.sin(a)*dz/2);sommets.push(v);
        xmin=Math.min(xmin,v[0]);xmax=Math.max(xmax,v[0]);ymin=Math.min(ymin,v[1]);ymax=Math.max(ymax,v[1]);zmin=Math.min(zmin,v[2]);zmax=Math.max(zmax,v[2]);
      }
    }
    const up=aretes[0];axes.push([-up[2],0,up[0]]);
    if(!axes.concat(aretes).every(v=>v.every(Number.isFinite)))return null;
    return Object.assign({},source,{x:source.p[0],y:source.p[1],z:source.p[2],xmin:xmin+source.p[0],xmax:xmax+source.p[0],ymin:ymin+source.p[1],ymax:ymax+source.p[1],zmin:zmin+source.p[2],zmax:zmax+source.p[2],sommets,axes,aretes});
  }
  function testerPrisme(a,o) {
    if(!o || a.ymax<=o.ymin || a.ymin>=o.ymax)return null;
    const ca=Math.cos(a.angle),sa=Math.sin(a.angle),rx=Math.abs(ca)*a.hx+Math.abs(sa)*a.hz,rz=Math.abs(sa)*a.hx+Math.abs(ca)*a.hz;
    if(a.x+rx<=o.xmin || a.x-rx>=o.xmax || a.z+rz<=o.zmin || a.z-rz>=o.zmax)return null;
    const dx=a.x-o.x,dy=(a.ymin+a.ymax)/2-o.y,dz=a.z-o.z,hy=(a.ymax-a.ymin)/2;
    let depth=Infinity,nx=0,nz=0;
    function axe(x,y,z) {
      if(x*x+y*y+z*z<1e-24)return true; // arêtes parallèles
      const ra=a.hx*Math.abs(ca*x+sa*z)+a.hz*Math.abs(-sa*x+ca*z)+hy*Math.abs(y);
      let rb=0;for(const v of o.sommets)rb=Math.max(rb,Math.abs(v[0]*x+v[1]*y+v[2]*z));
      const q=dx*x+dy*y+dz*z,overlap=ra+rb-Math.abs(q);
      if(overlap<=1e-10)return false;
      // Une translation horizontale doit fermer toute la projection sur cet axe 3D.
      const horizontal=Math.hypot(x,z),d=horizontal>1e-12?overlap/horizontal:Infinity;
      if(d<depth){depth=d;const sign=q>=0?1:-1;nx=sign*x/horizontal;nz=sign*z/horizontal;}
      return true;
    }
    if(!axe(ca,0,sa)||!axe(-sa,0,ca)||!axe(0,1,0))return null;
    for(const v of o.axes)if(!axe(...v))return null;
    // Produits croisés de chaque direction d'arête avec les deux axes horizontaux de la caisse.
    for(const [x,y,z] of o.aretes)if(!axe(y*sa,z*ca-x*sa,-y*ca)||!axe(y*ca,-z*sa-x*ca,y*sa))return null;
    return {nx,nz,depth};
  }

  function creer(liste) {
    const objets = [], grille = new Map();
    for (const source of liste || []) {
      if (!source || !['box','circle','prism'].includes(source.type)) continue;
      let o, xmin,xmax,zmin,zmax;
      if(source.type==='prism') {
        o=prisme(source);if(!o)continue;
        ({xmin,xmax,zmin,zmax}=o);
      } else {
        const champs=['x','z','ymin','ymax',...(source.type==='box'?['angle','hx','hz']:['r'])];
        if(!champs.every(k=>Number.isFinite(source[k])) || source.ymax<=source.ymin)continue;
        if(source.type==='box'?source.hx<=0||source.hz<=0:source.r<=0)continue;
        o=Object.assign({},source);const ca=Math.cos(o.angle||0),sa=Math.sin(o.angle||0);
        const rx=o.type==='circle'?o.r:Math.abs(ca)*o.hx+Math.abs(sa)*o.hz;
        const rz=o.type==='circle'?o.r:Math.abs(sa)*o.hx+Math.abs(ca)*o.hz;
        xmin=o.x-rx;xmax=o.x+rx;zmin=o.z-rz;zmax=o.z+rz;
      }
      if(![xmin,xmax,zmin,zmax,o.ymin,o.ymax].every(Number.isFinite))continue;
      const x0=Math.floor(xmin/CELLULE),x1=Math.floor(xmax/CELLULE),z0=Math.floor(zmin/CELLULE),z1=Math.floor(zmax/CELLULE);
      if (![x0,x1,z0,z1].every(Number.isSafeInteger) || (x1-x0+1)*(z1-z0+1) > 4096) continue; // descripteur hors échelle, jamais une boucle géante
      o.id = objets.length; objets.push(o);
      for (let x=x0; x<=x1; x++) for (let z=z0; z<=z1; z++) {
        const key=x+','+z; let cell=grille.get(key); if (!cell) grille.set(key, cell=[]); cell.push(o.id);
      }
    }
    return { objets, grille, vus:new Uint32Array(objets.length), generation:0, voisins:[] };
  }

  // Normale obstacle -> voiture. Test pur ; le calcul de profondeur couvre aussi un rectangle contenu.
  function tester(a, o) {
    if(o.type==='prism')return testerPrisme(a,o.sommets?o:prisme(o));
    if (a.ymax <= o.ymin || a.ymin >= o.ymax) return null;
    const ca=Math.cos(a.angle), sa=Math.sin(a.angle), dx=o.x-a.x, dz=o.z-a.z;
    if (o.type === 'circle') {
      const x=dx*ca+dz*sa, z=-dx*sa+dz*ca;
      let nx=clamp(x,-a.hx,a.hx)-x, nz=clamp(z,-a.hz,a.hz)-z;
      const d=Math.hypot(nx,nz); if (d>=o.r) return null;
      let depth;
      if (d>1e-10) { nx/=d; nz/=d; depth=o.r-d; }
      else if (a.hx-Math.abs(x)<a.hz-Math.abs(z)) { nx=x>=0?-1:1; nz=0; depth=o.r+a.hx-Math.abs(x); }
      else { nx=0; nz=z>=0?-1:1; depth=o.r+a.hz-Math.abs(z); }
      return {nx:ca*nx-sa*nz, nz:sa*nx+ca*nz, depth};
    }
    const cb=Math.cos(o.angle), sb=Math.sin(o.angle); let depth=Infinity,nx=0,nz=0;
    for (let k=0;k<4;k++) {
      const x=k===0?ca:k===1?-sa:k===2?cb:-sb, z=k===0?sa:k===1?ca:k===2?sb:cb;
      const ra=a.hx*Math.abs(ca*x+sa*z)+a.hz*Math.abs(-sa*x+ca*z);
      const rb=o.hx*Math.abs(cb*x+sb*z)+o.hz*Math.abs(-sb*x+cb*z), q=-(dx*x+dz*z);
      const overlap=ra+rb-Math.abs(q); if (overlap<=0) return null;
      if (overlap<depth) { depth=overlap; const sign=q>=0?1:-1; nx=x*sign; nz=z*sign; }
    }
    return {nx,nz,depth};
  }

  function sauver(e, o) {
    for (const k of ['s','d','y','psi','beta','v','distance']) o[k]=e[k];
    return o;
  }
  function avant(co) {
    if (!co.c.obstacles || !co.c.obstacles.objets.length) return;
    const poses=co._obstacleAvant||(co._obstacleAvant=[]);
    for (let i=0;i<co.voitures.length;i++) sauver(co.voitures[i].etat, poses[i]||(poses[i]={}));
    co._obstacleAvantTemps=co.horloge;
  }
  function interpoler(c, a, b, t, out) {
    out.s=wrap(a.s+ecart(a.s,b.s,c.longueur)*t,c.longueur);
    for (const k of ['d','y','v','distance']) out[k]=a[k]+(b[k]-a[k])*t;
    out.psi=angle(a.psi+angle(b.psi-a.psi)*t); out.beta=angle(a.beta+angle(b.beta-a.beta)*t);
    return out;
  }
  function monde(c, e, out) {
    const q=B.circuit.echantillon(c,e.s), ca=Math.cos(q.cap),sa=Math.sin(q.cap);
    out.x=q.x-sa*e.d; out.z=q.z+ca*e.d; out.angle=q.cap+e.psi+e.beta;
    out.hx=LONG;out.hz=LARGE;out.ymin=e.y;out.ymax=e.y+HAUT;
    out.tx=ca;out.tz=sa;out.k=q.courbure;out.cap=q.cap;
    return out;
  }
  function voisins(index, bounds) {
    const radius=Math.hypot(LONG,LARGE)+.5, ids=index.voisins; ids.length=0;
    index.generation=(index.generation+1)>>>0; if (!index.generation) {index.vus.fill(0);index.generation=1;}
    const x0=Math.floor((bounds.minx-radius)/CELLULE),x1=Math.floor((bounds.maxx+radius)/CELLULE);
    const z0=Math.floor((bounds.minz-radius)/CELLULE),z1=Math.floor((bounds.maxz+radius)/CELLULE);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const id of index.grille.get(x+','+z)||[]) {
      if(index.vus[id]===index.generation)continue;index.vus[id]=index.generation;ids.push(id);
    }
    ids.sort((a,b)=>a-b);return ids;
  }
  function deplacer(c,e,p,nx,nz,d) {
    e.s=wrap(e.s+(nx*p.tx+nz*p.tz)*d/Math.max(.1,1-p.k*e.d),c.longueur);
    e.d+=(-nx*p.tz+nz*p.tx)*d;
  }
  function pas(co, ev) {
    const index=co.c.obstacles, c=co.c;
    if (!index || !index.objets.length) return;
    const mem=co._obstacleMemo||(co._obstacleMemo=[]), prev=co._obstacleAvantTemps===co.horloge?co._obstacleAvant:null;
    for(let i=0;i<co.voitures.length;i++) {
      const voiture=co.voitures[i],e=voiture.etat;if(e.degats&&e.degats.casse)continue;
      const memory=mem[i]||(mem[i]=new Map()), start=prev&&prev[i] || sauver(e,{});
      const end=sauver(e,{}), pa=monde(c,start,{}), pb=monde(c,end,{});
      // Hors contrat du pas fixe : refuser un grand saut spatial au lieu de passer au travers d'un obstacle.
      if(Math.abs(ecart(start.s,end.s,c.longueur))+Math.abs(end.d-start.d)+Math.abs(end.y-start.y)>25) {
        sauver(start,e);e.v=0;co._obstacleTeleports=(co._obstacleTeleports||0)+1;continue;
      }
      const probe={}, state={}, bounds={minx:pa.x,maxx:pa.x,minz:pa.z,maxz:pa.z};
      const trajet=Math.abs(ecart(start.s,end.s,c.longueur))+Math.abs(end.d-start.d)+Math.abs(end.y-start.y);
      const samples=Math.max(1,Math.ceil(trajet/.4),Math.ceil(Math.abs(angle(pb.angle-pa.angle))/.06));
      // Un arc peut sortir de l'AABB de ses extrémités : inclure le chemin réellement parcouru.
      for(let k=1;k<=samples;k++) {
        monde(c,interpoler(c,start,end,k/samples,state),probe);
        bounds.minx=Math.min(bounds.minx,probe.x);bounds.maxx=Math.max(bounds.maxx,probe.x);
        bounds.minz=Math.min(bounds.minz,probe.z);bounds.maxz=Math.max(bounds.maxz,probe.z);
      }
      const ids=voisins(index,bounds);
      for(let iteration=0;iteration<4;iteration++) {
        sauver(e,end);monde(c,end,pb);
        const distance=Math.abs(ecart(start.s,end.s,c.longueur))+Math.abs(end.d-start.d)+Math.abs(end.y-start.y);
        const rotation=Math.abs(angle(pb.angle-pa.angle));
        const n=Math.max(1,Math.ceil(distance/.4),Math.ceil(rotation/.06));
        let first=null;
        for(const id of ids) {
          const o=index.objets[id];let hit=tester(pa,o),lo=0,hi=0;
          if(!hit) for(let k=1;k<=n;k++) {
            const t=k/n;monde(c,interpoler(c,start,end,t,state),probe);hit=tester(probe,o);
            if(hit){lo=(k-1)/n;hi=t;break;}
          }
          if(!hit)continue;
          if(hi>0) for(let k=0;k<10;k++) {
            const mid=(lo+hi)/2;monde(c,interpoler(c,start,end,mid,state),probe);const h=tester(probe,o);
            if(h){hi=mid;hit=h;}else lo=mid;
          }
          if(!first || hi<first.hi || (hi===first.hi && hit.depth>first.hit.depth)) first={id,o,hit,lo,hi};
        }
        if(!first)break;
        const {id,o,hit,lo,hi}=first;
        const vitesseFin=e.v;
        if(hi>0) { interpoler(c,start,end,lo,e); e.v=vitesseFin; }
        else deplacer(c,e,monde(c,e,probe),hit.nx,hit.nz,hit.depth+EPS);
        const p=monde(c,e,probe), speed=e.v, vx=Math.cos(p.cap+e.psi)*speed,vz=Math.sin(p.cap+e.psi)*speed;
        const force=Math.max(0,-(vx*hit.nx+vz*hit.nz));
        if(force>0) {
          const rx=vx+hit.nx*force*1.05,rz=vz+hit.nz*force*1.05;
          const body=e.psi+e.beta;e.v=Math.min(speed,Math.hypot(rx,rz));if(e.v>.001){e.psi=angle(Math.atan2(rz,rx)-p.cap);e.beta=angle(body-e.psi);}
        }
        const seen=memory.has(id),violent=B.degats&&force>=B.degats.PARAMS.chocCasse;
        memory.set(id,true);
        if(force>.1 && (!seen||violent)) {
          ev.push({type:'choc',id:voiture.id,force,obstacle:o.genre,obstacleId:id});
          for(const x of B.conduite.subirChoc(e,force)){x.id=voiture.id;ev.push(x);}
          e.choc=B.conduite.PARAMS.chocDuree;
        }
        if(force>.1) {
          const cancelled=B.conduite.annulerDerive(e,true);if(cancelled){cancelled.id=voiture.id;ev.push(cancelled);}
        }
        if(e.degats&&e.degats.casse)break;
        // Les prochains obstacles sont testés sur le trajet déjà raccourci/résolu.
        sauver(e,start);monde(c,start,pa);
      }
      monde(c,e,probe);probe.hx+=.35;probe.hz+=.35;
      for(const id of memory.keys()) if(!tester(probe,index.objets[id]))memory.delete(id);
    }
  }
  B.obstacles={creer,avant,pas,tester};
})(globalThis.BITUME=globalThis.BITUME||{});
