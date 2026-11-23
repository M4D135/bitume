/* BITUME — Autodrome des Alizés, sur la côte caribéenne. Toutes les cotes sont en mètres. */
(function (B) {
  'use strict';
  const theme = {
    atmosphere: { skyTop:[.10,.44,.74], skyBottom:[.78,.91,.93], fog:[.66,.84,.86],
      sunDirection:[-.38,.76,-.44], sunColor:[1.32,1.21,1.02], ambient:[.36,.40,.41],
      fogDensity:.0007, wind:.52, biome:'ovale' },
    herbe:[.23,.38,.16], herbeClaire:[.46,.57,.25], terre:[.44,.38,.22], sable:[.88,.80,.62], eau:-4, alizes:true,
    roche:[.42,.42,.40], relief:5, echelle:360, essence:null, densite:0, marge:680
  };
  const acier=[.14,.24,.25], corail=[.84,.34,.21], ivoire=[.90,.85,.67];
  const verre=[.22,.45,.52], toiture=[.13,.53,.52], beton=[.73,.72,.63];

  // Les extrémités suivent les limites latérales de la conduite, autour de
  // l’anneau. Un joint recouvert de 7 cm ferme les coins entre deux segments.
  function mur(milieu, longueur, rot, haut, droite, s) {
    function pose(h,d) { return milieu.map((v,k)=>v+haut[k]*h+droite[k]*d); }
    const corps = {shape:'box', p:pose(.49,.22), s:[longueur+.14,1.12,.44],
      r:rot, mat:22, color:beton, ovaleForges:'mur-exterieur'};
    B.decor.marquerSolide(corps,'glissiere');
    const bande = {shape:'box', p:pose(.82,-.008), s:[longueur+.04,.18,.018],
      r:rot, mat:24, color:Math.floor(s/24)%2 ? corail : ivoire};
    return [corps,bande];
  }

  // L'axe de la plage s'ouvre dans le prolongement de la grande ligne droite :
  // à l'approche du premier virage, l'horizon marin est devant le pilote.
  function littoral(c,niveau) {
    const a=c.cap[0]+.43, nx=Math.cos(a), nz=Math.sin(a), tx=nz, tz=-nx;
    let ring=-Infinity;
    for (let i=0;i<c.n;i++) ring=Math.max(ring,c.x[i]*nx+c.z[i]*nz);
    const rive=u=>ring+79+9*Math.sin(u/92)+4*Math.cos(u/43);
    const distance=(x,z)=>x*nx+z*nz-rive(x*tx+z*tz);
    function relief(x,z,h) {
      const d=distance(x,z);
      if (d<=-39) return h;
      const t=Math.min(1,(d+39)/26), raccord=t*t*(3-2*t);
      return h+(niveau-Math.min(11,d*.105)-h)*raccord;
    }
    function eau(nappe,sommet,finir) {
      // La même courbe définit l'altitude zéro de la plage et le front d'écume.
      // Chaque rangée porte son pigment interpolé et ses propres indices.
      const bandes=[[-12,[.57,.82,.74]],[-1.3,[.73,.89,.82]],[.8,[.83,.94,.87]],
        [3.7,[.33,.79,.69]],[11,[.17,.73,.65]],[42,[.07,.62,.65]],
        [110,[.035,.44,.56]],[350,[.027,.32,.50]],[3400,[.024,.27,.46]]];
      const u0=-(c.longueur+2200), u1=-u0, segments=Math.ceil((u1-u0)/33);
      const n=nappe((segments+1)*bandes.length);
      for (let j=0;j<=segments;j++) {
        const u=u0+(u1-u0)*j/segments;
        for (let k=0;k<bandes.length;k++) {
          const [v,col]=bandes[k], p=rive(u)+v;
          const i=sommet(n,[tx*u+nx*p,niveau,tz*u+nz*p],[0,1,0],12,col);
          if (j&&k) { const g=i-bandes.length; n.i.push(g-1,g,i,i,g-1+bandes.length,g-1); }
        }
      }
      const mesh=finir(n);
      mesh.vertexTint='smooth';
      Object.defineProperty(mesh,'surfaceType',{value:'eau'});
      return mesh;
    }
    return {distance,relief,eau,niveauEauA:(x,z)=>distance(x,z)>=0 ? niveau : undefined};
  }

  function planGradins(c) {
    const candidats=[], tribunes=[], nombre=Math.ceil(c.longueur/48), pas=c.longueur/nombre;
    for (let k=0;k<nombre;k++) {
      const i=Math.round((k+.5)*pas/c.pas)%c.n, f=B.decor.cadre(c,i);
      const courbe=Math.abs(f.k)>1/250, recul=(c.limiteD?.[i] || c.limite)+4.2;
      const t={s:f.s,x:f.x,z:f.z,y:B.decor.hauteurRoute(f,c.largeur/2,c.largeur/2)-.20,
        a:f.a,cote:1,recul,longueur:pas*(courbe ? .60 : .74),marches:courbe?4:6,profondeur:1.04,haut:.44,
        toitAlizes:k%3===0?corail:k%3===1?toiture:ivoire, couvertAlizes:k%3!==1};
      candidats.push({f,t,disponible:true}); tribunes.push(t);
    }
    return {candidats,gradins:{tribunes,stands:[],enceinte:{debut:0,fin:c.longueur}}};
  }

  function asseoir(gradins,terrain) {
    for (const t of gradins.tribunes) {
      const ca=Math.cos(t.a),sa=Math.sin(t.a);
      let bas=Infinity,haut=-Infinity;
      for (const u of [-t.longueur/2,0,t.longueur/2]) for (const d of [t.recul,t.recul+t.profondeur*t.marches]) {
        const y=terrain.sol(t.x+ca*u-sa*d,t.z+sa*u+ca*d);
        bas=Math.min(bas,y); haut=Math.max(haut,y);
      }
      t.y=haut+.04;
      t.socle=t.y-bas+.14;
    }
  }

  // Deux maillages partagés par tous les cocotiers. Les folioles utilisent de
  // vraies faces doubles et des teintes persistantes à toutes les saisons.
  function palmierFormes() {
    const R=globalThis.FRender;
    if (!R?.forme || R.shared?.shapes?.has('alizes-palmes')) return;
    function palmes(detail) {
      const faces=[];
      function triangle(a,b,c) {
        const ax=b[0]-a[0], ay=b[1]-a[1], az=b[2]-a[2];
        const bx=c[0]-a[0], by=c[1]-a[1], bz=c[2]-a[2];
        const n=[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx], m=Math.hypot(...n);
        if (!m) return;
        for(let i=0;i<3;i++) n[i]/=m;
        const dos=n.map(v=>-v);
        faces.push([a,b,c,n,n,n],[c,b,a,dos,dos,dos]);
      }
      for(let j=0;j<10;j++) {
        const a=j*2.39996, co=Math.cos(a), si=Math.sin(a), h=(j%3)*.07;
        function p(t,l,b=0) { const d=t*(.39+(j%3)*.024);
          return [d*co-l*si,.06+h+Math.sin(t*Math.PI)*.17-t*t*.39+b,d*si+l*co]; }
        const n=detail?7:4;
        for(let k=0;k<n;k++) {
          const t=k/n,u=(k+1)/n,w=.050*Math.sin(Math.PI*(t+.5/n));
          for(const sens of [-1,1]) {
            const feuille=p(Math.min(1,u+.025),sens*w,-w*.45);
            triangle(p(t,0),feuille,p(u,0));
            if(detail) triangle(p(t,0),p(t+.45/n,sens*w*.85,-w*.3),feuille);
          }
        }
      }
      return faces;
    }
    R.forme('alizes-palmes',palmes(true)); R.forme('alizes-palmes-loin',palmes(false));
  }
  palmierFormes();
  function poser(c, terrain, lim, interroger, ajouter, gradins) {
    const f=B.decor.cadre(c,0), rot=[0,-f.a,0], marqueurs=[];
    let cx=0, cz=0;
    for (let i=0; i<c.n; i++) { cx+=c.x[i]; cz+=c.z[i]; }
    cx/=c.n; cz/=c.n;
    const plan=(u,v)=>[cx+f.t[0]*u+f.r[0]*v,cz+f.t[2]*u+f.r[2]*v];

    // L’atelier et le poste partagent la pelouse intérieure avec les boxes centraux.
    // La vérification inclut toute l'emprise et toutes les branches du tour.
    function site(u,v,demiL,demiP,nom) {
      const [x,z]=plan(u,v), rayon=Math.hypot(demiL,demiP), garde=c.largeur/2+26+rayon;
      const axe=interroger(x,z,garde,true);
      if (axe.i>=0 && axe.d<=garde) return null;
      let bas=Infinity,haut=-Infinity;
      for (const a of [-demiL,demiL]) for (const b of [-demiP,demiP]) {
        const [px,pz]=plan(u+a,v+b), y=terrain.sol(px,pz);
        bas=Math.min(bas,y); haut=Math.max(haut,y);
      }
      const sol=haut+.12, objets=[], loin=[];
      function element(shape,a,h,b,taille,mat,color,distant=true,rotation=rot) {
        const [px,pz]=plan(u+a,v+b);
        const o={shape,p:[px,sol+h,pz],s:taille,r:rotation,mat,color};
        objets.push(o);
        if (distant) loin.push(o);
        return o;
      }
      const pied=bas-.28;
      element('box',0,(pied-sol)/2,0,[demiL*2,sol-pied,demiP*2],22,beton).masqueHerbier=true;
      return {element, terminer(h) {
        ajouter(objets,loin,x,z);
        marqueurs.push({nom,type:'batiment',x,y:sol+h,z,rayon:70,hauteur:25});
      }};
    }

    const atelier=site(-52,16,14,7,'Atelier des Alizés');
    if (atelier) {
      const mettre=atelier.element;
      mettre('box',0,2.1,0,[26,4.2,12],22,[.88,.72,.46]);
      // Enfilade de petits boxes de préparation, éclairés par des sheds en tôle turquoise.
      for (let i=0;i<3;i++) {
        const x=-8.7+i*8.7;
        mettre('wedge',x,4.96,0,[8.7,1.60,12.5],24,toiture);
        mettre('box',x-4.36,5.04,0,[.10,1.22,11.8],0,verre);
        for (const z of [-3,0,3]) mettre('box',x-4.43,5.04,z,[.09,1.23,.12],0,acier,false);
      }
      for (const x of [-7,6]) {
        mettre('box',x,1.67,-6.03,[5.6,3.32,.12],24,acier);
        mettre('box',x,2.55,-6.11,[5.1,.55,.09],0,verre,false);
      }
      atelier.terminer(5.3);
    }

    // Au dos du vrai box de service, deux auvents ouverts abritent les places
    // de préparation. Leur premier poteau reste 13 m derrière sa limite réservée.
    const S=c.stands;
    if (S && S.cote<0) {
      const sf=B.decor.cadre(c,Math.round(S.sBox/c.pas));
      const d=S.dFond-22, a=-sf.a;
      for (const u of [-22,22]) {
        const x=sf.x+sf.t[0]*u+sf.r[0]*d, z=sf.z+sf.t[2]*u+sf.r[2]*d;
        let y=-Infinity, bas=Infinity;
        for (const k of [-12,0,12]) for (const l of [-4,4]) {
          const sol=terrain.sol(x+sf.t[0]*k+sf.r[0]*l,z+sf.t[2]*k+sf.r[2]*l);
          bas=Math.min(bas,sol); y=Math.max(y,sol);
        }
        const objets=[],loin=[], r=[0,a,0];
        function pose(k,l,h,s,color,mat=24) {
          const objet={shape:'box',p:[x+sf.t[0]*k+sf.r[0]*l,y+h,z+sf.t[2]*k+sf.r[2]*l],r,s,mat,color,masqueHerbier:true};
          objets.push(objet); return objet;
        }
        loin.push(pose(0,0,(bas-y)/2,[24,y-bas+.22,8],beton,22));
        const toit=pose(0,0,4.65,[25,.26,9],u<0?toiture:corail); loin.push(toit);
        for (const k of [-10.8,0,10.8]) for (const l of [-3.6,3.6]) {
          const pied=pose(k,l,2.32,[.30,4.65,.30],ivoire);
          if(k) loin.push(pied);
        }
        ajouter(objets,loin,x,z);
      }
    }

    const poste=site(36,-4,4.4,3.6,'Poste de chronométrage');
    if (poste) {
      const mettre=poste.element;
      for (const x of [-2.9,2.9]) for (const z of [-2.1,2.1])
        mettre('box',x,2.8,z,[.42,5.6,.42],24,corail);
      mettre('box',0,5.65,0,[7.8,.45,6.1],0,acier);
      mettre('box',0,6.35,0,[6.8,1.1,5.3],24,ivoire);
      mettre('box',0,7.56,0,[6.6,1.4,5.1],0,verre);
      for (const x of [-3.35,0,3.35]) for (const z of [-2.6,2.6])
        mettre('box',x,7.53,z,[.14,1.48,.13],0,acier,false);
      mettre('box',0,8.43,0,[7.8,.34,6.1],24,corail);
      poste.terminer(7.5);
    }

    // Mâts de stade fixes. La tôle arrière et la rampe restent lisibles de loin,
    // les quatre réflecteurs proches n'ajoutent aucune source dynamique.
    for (const fraction of [.125,.338,.69,.89]) {
      const i=Math.round(c.n*fraction)%c.n, a=B.decor.cadre(c,i);
      if (c.stands && a.s>=c.stands.debut-15 && a.s<=c.stands.fin+15) continue;
      const d=lim.D[i]+18, x=a.x+a.r[0]*d, z=a.z+a.r[2]*d, y=terrain.sol(x,z);
      const r=[0,-a.a,0], pied={shape:'box',p:[x,y+.05,z],s:[1.8,.55,1.8],r,mat:22,color:beton};
      const mat={shape:'cylinder',p:[x,y+6.6,z],s:[.45,13.2,.45],r,mat:0,color:acier};
      const rampe={shape:'box',p:[x,y+13.3,z],s:[4.8,1.05,.44],r,mat:24,color:acier};
      const silhouettes=[pied,mat,rampe], objets=silhouettes.slice();
      for (let k=0;k<4;k++) {
        const u=(k-1.5)*1.13;
        objets.push({shape:'bevel',p:[x+a.t[0]*u-a.r[0]*.25,y+13.30,z+a.t[2]*u-a.r[2]*.25],
          s:[.92,.74,.12],r,mat:0,color:[.83,.82,.71]});
      }
      ajouter(objets,silhouettes,x,z);
    }
    for (let k=0;k<gradins.tribunes.length;k++) {
      const t=gradins.tribunes[k], cote=k%3===0?1:-1;
      const u=cote*(t.longueur/2+3.2), d=t.recul+(k%2?7.8:1.3);
      const ca=Math.cos(t.a),sa=Math.sin(t.a), x=t.x+ca*u-sa*d, z=t.z+sa*u+ca*d;
      const y=terrain.sol(x,z), h=7.6+(k%5)*.62, penche=.045+.024*(k%4);
      const vent=[Math.cos(t.a+.33)*penche,-Math.sin(t.a+.33)*penche];
      const p=[x+vent[0]*h*.5,y+h*.49,z+vent[1]*h*.5];
      const tronc={shape:'cylinder',p,s:[.38,h,.38],r:[vent[1],0,-vent[0]],mat:9,color:[.48,.37,.24]};
      const feuillage={shape:'alizes-palmes',p:[x+vent[0]*h,y+h-.12,z+vent[1]*h],s:[8.3,4.1,8.3],
        r:[0,k*2.39996,0],mat:11,color:[.16+(k%3)*.025,.36,.16]};
      ajouter([tronc,feuillage],[tronc,{...feuillage,shape:'alizes-palmes-loin'}],x,z);
    }
    return {marqueurs};
  }
  B.ovaleForgesDecor={theme,mur,poser,planGradins,asseoir,littoral};
})(globalThis.BITUME=globalThis.BITUME||{});
