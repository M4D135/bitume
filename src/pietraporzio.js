/* BITUME · empreintes régionales de Pietraporzio. Les pans et les ouvertures sont procéduraux. */
(function (B) {
  'use strict';
  if (!B.pietraporzioData && typeof require === 'function') require('./pietraporzio-data.js');

  function face(triangles,a,b,c) {
    const u=b.map((v,i)=>v-a[i]), v=c.map((n,i)=>n-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const l=Math.hypot(...n);
    if(l<1e-10)return;
    for(let i=0;i<3;i++)n[i]/=l;
    triangles.push([a,b,c,n,n,n]);
  }
  function cadreToit(poly) {
    let aire=Infinity, cadre;
    for(let i=0;i<poly.length;i++) {
      const a=poly[i], b=poly[(i+1)%poly.length], dx=b[0]-a[0], dz=b[1]-a[1], l=Math.hypot(dx,dz);
      if(!l)continue;
      const u=[dx/l,dz/l], v=[-u[1],u[0]];
      const proj=(n)=>poly.map(p=>p[0]*n[0]+p[1]*n[1]);
      const pu=proj(u), pv=proj(v), du=Math.max(...pu)-Math.min(...pu), dv=Math.max(...pv)-Math.min(...pv);
      if(du*dv>=aire)continue;
      aire=du*dv;
      const p=du>dv?pv:pu, n=du>dv?v:u;
      cadre={n,milieu:(Math.max(...p)+Math.min(...p))*.5,demi:Math.min(du,dv)*.5};
    }
    return cadre;
  }
  function construire(f) {
    const poly=f.cm.map(([x,z])=>[x/100,z/100]), largeur=Math.max(...poly.map(p=>Math.abs(p[0])))*2;
    const profondeur=Math.max(...poly.map(p=>Math.abs(p[1])))*2;
    const cadre=cadreToit(poly), coupe=p=>p[0]*cadre.n[0]+p[1]*cadre.n[1]-cadre.milieu;
    const toit=p=>Math.max(0,1-Math.abs(coupe(p))/cadre.demi);
    const sommet=(p,y)=>[p[0]/largeur,y,p[1]/profondeur];
    const interp=(a,b)=>{const u=coupe(a)/(coupe(a)-coupe(b));return [a[0]+u*(b[0]-a[0]),a[1]+u*(b[1]-a[1])];};
    const murs=[],pans=[],pignons=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i], b=poly[(i+1)%poly.length];
      face(murs,sommet(a,-.5),sommet(a,.5),sommet(b,.5));
      face(murs,sommet(a,-.5),sommet(b,.5),sommet(b,-.5));
      const bord=coupe(a)*coupe(b)<0?[a,interp(a,b),b]:[a,b];
      for(let j=1;j<bord.length;j++) {
        const u=bord[j-1],v=bord[j];
        face(pignons,sommet(u,-.5),sommet(u,toit(u)-.5),sommet(v,toit(v)-.5));
        face(pignons,sommet(u,-.5),sommet(v,toit(v)-.5),sommet(v,-.5));
      }
    }
    for(const indices of f.tri) for(const cote of [-1,1]){
      const decoupe=[];
      for(let i=0;i<3;i++) {
        const a=poly[indices[i]], b=poly[indices[(i+1)%3]], da=coupe(a)*cote, db=coupe(b)*cote;
        if(da>=0)decoupe.push(a);
        if(da*db<0)decoupe.push(interp(a,b));
      }
      const p=decoupe.map(q=>sommet(q,toit(q)-.5));
      for(let i=2;i<p.length;i++)face(pans,p[0],p[i],p[i-1]);
    }
    const formes={};
    for(const [partie,triangles] of Object.entries({mur:murs,toit:pans,pignons})) {
      const nom='pietraporzio-'+f.id+'-'+partie;
      globalThis.FRender?.forme?.(nom,triangles);
      const vertices=new Float32Array(triangles.flatMap(t=>t.slice(0,3).flat()));
      formes[partie]={nom,maillage:{vertices,indices:Uint32Array.from({length:vertices.length/3},(_,i)=>i)}};
    }
    return {f,poly,largeur,profondeur,formes,montee:Math.min(f.h*.28,cadre.demi*.40)};
  }

  const modeles=B.pietraporzioData.map(construire);
  // Cercle de la couronne ou du bloc contre le polygone cadastral, y compris ses décrochements.
  function recouvre(x,z,rayon) {
    for(const {f,poly,largeur,profondeur} of modeles) {
      const px=x-f.x,pz=z-f.z;
      if(Math.abs(px)>largeur/2+rayon || Math.abs(pz)>profondeur/2+rayon)continue;
      let dedans=false;
      for(let i=0;i<poly.length;i++) {
        const a=poly[i],b=poly[(i+1)%poly.length], dx=b[0]-a[0],dz=b[1]-a[1];
        const t=Math.max(0,Math.min(1,((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz)));
        if(Math.hypot(px-a[0]-t*dx,pz-a[1]-t*dz)<=rayon)return true;
        if((a[1]>pz)!==(b[1]>pz) && px<a[0]+(pz-a[1])*dx/dz)dedans=!dedans;
      }
      if(dedans)return true;
    }
    return false;
  }
  function poser(terrain,position,neige,detail,ajouter) {
    for(const {f,poly,largeur,profondeur,formes,montee} of modeles) {
      const proche=[], loin=[], route=position(f.s);
      const sol=(x,z)=>terrain?terrain.sol(f.x+x,f.z+z):route.y;
      const hauteurs=poly.map(p=>sol(...p)).sort((a,b)=>a-b);
      const seuil=(hauteurs[Math.floor((hauteurs.length-1)/2)]+hauteurs[Math.floor(hauteurs.length/2)])*.5;
      const base=hauteurs[0]-.45, rive=seuil+f.h-montee;
      // Sur les plus fortes pentes, le soubassement descend jusqu'au terrain de chaque façade.
      const enduit=f.usage==='municipio'?[.75,.65,.51]:f.h>7?[.68,.64,.56]:[.63,.65,.58];
      const bois=[.29,.24,.18], vitre=[.16,.22,.24];
      function objet(partie,shape,p,s,mat,color,angle=0) {
        const o={shape,p,s,r:[0,angle,0],mat,color,architecture:'pietraporzio-bdtre',batiment:f.id,partie};
        proche.push(o);return o;
      }
      for(const [partie,forme] of Object.entries(formes)) {
        const mur=partie==='mur', couverture=partie==='toit';
        const haut=mur?rive-base:montee, milieu=mur?base+haut/2:rive+haut/2;
        const o=objet(partie,forme.nom,[f.x,milieu,f.z],[largeur,haut,profondeur],
          couverture?(neige?25:24):22,couverture?(neige?[.86,.89,.90]:[.37,.37,.35]):enduit);
        if(B.decor?.marquerSolide)B.decor.marquerSolide(o,'bati-bdtre',2,null,forme.maillage);
        if(mur)o.trianglesMasque=f.tri.map(t=>t.map(i=>[f.x+poly[i][0],0,f.z+poly[i][1]]));
        loin.push(o);
      }
      const facades=[];
      for(let i=0;i<poly.length;i++) {
        const a=poly[i], b=poly[(i+1)%poly.length], dx=b[0]-a[0], dz=b[1]-a[1], l=Math.hypot(dx,dz);
        if(l<3.5)continue;
        const nx=dz/l, nz=-dx/l, x=route.x-f.x-(a[0]+b[0])*.5, z=route.z-f.z-(a[1]+b[1])*.5;
        const rue=(nx*x+nz*z)/Math.hypot(x,z), amont=-nx*Math.cos(route.cap)-nz*Math.sin(route.cap);
        facades.push({a,dx,dz,l,nx,nz,rue,amont});
      }
      // Depuis la route, le pignon d'approche se lit avant la façade latérale.
      const principale=facades.sort((a,b)=>b.rue*b.l-a.rue*a.l)[0];
      const approche=facades.filter(b=>b!==principale && b.amont>.30 && b.nx*principale.nx+b.nz*principale.nz<.80)
        .sort((a,b)=>b.amont*b.l-a.amont*a.l)[0];
      for(const [index,bord] of [principale,approche].filter(Boolean).entries()) {
        const {a,dx,dz,l,nx,nz}=bord, yaw=Math.atan2(nx,nz);
        const applique=(partie,shape,u,y,saillie,s,mat,couleur)=>objet(partie,shape,
          [f.x+a[0]+u*dx+nx*saillie,y,f.z+a[1]+u*dz+nz*saillie],s,mat,couleur,yaw);
        const colonnes=Math.max(2,Math.min(detail?5:3,Math.floor(l/3)));
        const etages=Math.max(1,Math.min(3,Math.round((rive-seuil)/3)));
        for(let col=0;col<colonnes;col++){
          const u=(col+.5)/colonnes, solLocal=sol(a[0]+u*dx,a[1]+u*dz);
          for(let et=0;et<etages;et++){
            if(!et && !index && col===0) {
              if(solLocal+2.10<rive)applique('porte','box',u,solLocal+1.04,.045,[1.12,2.08,.09],10,bois);
              continue;
            }
            const y=rive-1.10-3.0*(etages-et-1);
            if(y-.62<solLocal+.12)continue;
            applique('vitrage','box',u,y,.035,[1.04,1.22,.07],19.1,vitre);
            if(detail)applique('menuiserie','stura-cadre',u,y,.09,[1.11,1.30,.10],10,bois);
            if(detail && (f.usage==='abitativa'||f.usage==='residenziale') && l/colonnes>=2.15){
              for(const cote of [-1,1])applique('volet','box',u+cote*.73/l,y,.065,[.31,1.16,.09],10,[.36,.40,.34]);
            }
          }
        }
      }
      ajouter(proche,loin,f.x,f.z);
    }
  }
  B.pietraporzio={poser,recouvre};
})(globalThis.BITUME=globalThis.BITUME||{});
