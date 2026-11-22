/* BITUME — contacts de monoplaces orientées dans le monde. Normale de contact commune aux dégâts,
   séparation et réponse ; les épaves restent des obstacles fixes. Les petits contacts de roues alignées
   gardent leurs bonds. Le balayage est borné par les déplacements du pas fixe, indépendant du rendu. */
(function(B){
  'use strict';
  const PARAMS=Object.freeze({LONGUEUR:4.95,LARGEUR:2.02,bondVMin:2.5,sautVMin:12,rearmSeparation:.35,rearmBond:1.25,rearmEvent:.30,lacetDecale:.025,lacetChoc:.9});
  const P=PARAMS, HL=P.LONGUEUR/2, HW=P.LARGEUR/2;
  const angle=a=>a-2*Math.PI*Math.round(a/(2*Math.PI));
  const ramener=(s,L)=>((s%L)+L)%L;
  // Objets de travail réutilisés à chaque pas (lectures du tracé, poses intermédiaires du balayage) : le pas teste
  // 66 paires de voitures, et chaque objet neuf y serait jeté aussitôt.
  const LU_POSE={}, LU_VITESSE={}, AA={x:0,z:0,h:0,y:0}, BB={x:0,z:0,h:0,y:0};
  // tester ne voit un contact qu'à moins de √(L² + l²) entre centres. Si les centres de fin de pas sont plus loin que
  // cette distance, plus le chemin des deux voitures dans le pas (majoré par |dx| + |dz|) et un mètre de marge pour
  // les arrondis, aucune pose du balayage (début, intermédiaires, fin) ne peut toucher : la paire est rendue sans
  // contact sans fabriquer ces poses. Une coordonnée infinie ou NaN rend la comparaison fausse : balayage complet.
  const PORTEE=Math.sqrt(P.LONGUEUR*P.LONGUEUR+P.LARGEUR*P.LARGEUR)+1;
  function loin(a,b,pa,pb){
    const dx=b.x-a.x,dz=b.z-a.z,r=PORTEE+Math.abs(a.x-pa.x)+Math.abs(a.z-pa.z)+Math.abs(b.x-pb.x)+Math.abs(b.z-pb.z);
    return dx*dx+dz*dz>r*r;
  }
  const bloquee=e=>e.accident&&!e.recuperation;
  function pose(c,e,p={}) {
    const q=B.circuit.echantillon(c,e.s,LU_POSE),ca=Math.cos(q.cap),sa=Math.sin(q.cap);
    p.x=q.x-sa*e.d; p.z=q.z+ca*e.d; p.h=q.cap+e.psi+e.beta; p.y=e.y;
    p.tx=ca; p.tz=sa; p.k=q.courbure;
    p.vx=e.v*Math.cos(q.cap+e.psi); p.vz=e.v*Math.sin(q.cap+e.psi);
    return p;
  }
  function avant(co){const a=co._contactAvant||(co._contactAvant=[]);co._contactAvantTemps=co.horloge;for(let i=0;i<co.voitures.length;i++){const e=co.voitures[i].etat,p=pose(co.c,e,a[i]||(a[i]={}));p.s=e.s;p.d=e.d;p.psi=e.psi;p.beta=e.beta;p.distance=e.distance;p.repositionnements=e.repositionnements||0;}}
  // SAT sur les quatre axes des rectangles. La normale va de a vers b.
  function tester(a,b){
    if(Math.abs(a.y-b.y)>1.1)return null;
    const dx=b.x-a.x,dz=b.z-a.z;if(dx*dx+dz*dz>(P.LONGUEUR*P.LONGUEUR+P.LARGEUR*P.LARGEUR))return null;
    const ax=Math.cos(a.h),az=Math.sin(a.h),bx=Math.cos(b.h),bz=Math.sin(b.h);let depth=Infinity,nx=0,nz=0;
    for(let k=0;k<4;k++){
      const x=k===0?ax:k===1?-az:k===2?bx:-bz,z=k===0?az:k===1?ax:k===2?bz:bx;
      const ra=HL*Math.abs(ax*x+az*z)+HW*Math.abs(-az*x+ax*z),rb=HL*Math.abs(bx*x+bz*z)+HW*Math.abs(-bz*x+bx*z),q=dx*x+dz*z;
      const overlap=ra+rb-Math.abs(q);if(overlap<=0)return null;
      if(overlap<depth){depth=overlap;const sign=q>=0?1:-1;nx=x*sign;nz=z*sign;}
    }
    return {nx,nz,depth};
  }
  function balayage(a,b,pa,pb){
    if(pa&&pb&&loin(a,b,pa,pb))return null;
    let hit=tester(a,b);
    if(!pa||!pb||tester(pa,pb))return hit?{...hit,t:1}:null;
    const travel=Math.hypot(a.x-pa.x,a.z-pa.z,a.y-pa.y)+Math.hypot(b.x-pb.x,b.z-pb.z,b.y-pb.y),n=Math.max(1,Math.min(64,Math.max(Math.ceil(travel/.4),Math.ceil(Math.max(Math.abs(angle(a.h-pa.h)),Math.abs(angle(b.h-pb.h)))/.06))));
    for(let k=1;k<n;k++){
      const t=k/n;
      AA.x=pa.x+(a.x-pa.x)*t;AA.z=pa.z+(a.z-pa.z)*t;AA.h=pa.h+angle(a.h-pa.h)*t;AA.y=pa.y+(a.y-pa.y)*t;
      BB.x=pb.x+(b.x-pb.x)*t;BB.z=pb.z+(b.z-pb.z)*t;BB.h=pb.h+angle(b.h-pb.h)*t;BB.y=pb.y+(b.y-pb.y)*t;
      hit=tester(AA,BB);if(hit)return {...hit,t};
    }
    hit=tester(a,b);return hit?{...hit,t:1}:null;
  }
  function deplacer(e,c,p,x,z){e.s=ramener(e.s+(x*p.tx+z*p.tz)/Math.max(.1,1-p.k*e.d),c.longueur);e.d+=-x*p.tz+z*p.tx;const side=e.d<0?-1:1,limit=B.conduite.limiteCote(c,e.s,side)-.1;e.d=side*Math.min(Math.abs(e.d),limit);}
  function vitesse(e,c,vx,vz,body){const theta=B.circuit.echantillon(c,e.s,LU_VITESSE).cap;const sg=e.v<0?-1:1;e.v=sg*Math.hypot(vx,vz);if(Math.abs(e.v)>.001){e.psi=angle(Math.atan2(vz,vx)-theta-(sg<0?Math.PI:0));e.beta=angle(body-theta-e.psi);}}
  function pas(co,ev){
    const V=co.voitures,c=co.c,n=V.length,t=co.horloge;co._paire ||= {};
    const poses=co._contactPoses||(co._contactPoses=[]);
    for(let k=0;k<n;k++)pose(c,V[k].etat,poses[k]||(poses[k]={}));
    // les poses du début du pas (avant) : les mêmes pour toutes les paires
    const old=co._contactAvantTemps===co.horloge?co._contactAvant:null;
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const va=V[i],vb=V[j],a=va.etat,b=vb.etat,key=i*n+j;
      const p=co._paire[key]||(co._paire[key]={tEvent:-9,tBond:-9,separe:true,tSeparation:0});
      const ia=a.recuperation||(a.degats&&a.degats.casse)?0:1,ib=b.recuperation||(b.degats&&b.degats.casse)?0:1;
      if(!ia&&!ib)continue;
      if(bloquee(a)||bloquee(b))continue;
      let A=poses[i],Bv=poses[j];
      const pa=old&&old[i]&&old[i].repositionnements===(a.repositionnements||0)?old[i]:null,pb=old&&old[j]&&old[j].repositionnements===(b.repositionnements||0)?old[j]:null,hit=balayage(A,Bv,pa,pb);
      if(!hit){if(!p.separe){p.separe=true;p.tSeparation=t;}continue;}
      // Corriger le chevauchement à chaque pas, même quand le son/dégât n'est pas réarmé.
      if(hit.t<1){for(const [e,o,inv] of [[a,pa,ia],[b,pb,ib]])if(inv){let ds=e.s-o.s;if(ds>c.longueur/2)ds-=c.longueur;else if(ds<-c.longueur/2)ds+=c.longueur;e.s=ramener(o.s+ds*hit.t,c.longueur);e.d=o.d+(e.d-o.d)*hit.t;e.psi=angle(o.psi+angle(e.psi-o.psi)*hit.t);e.beta=angle(o.beta+angle(e.beta-o.beta)*hit.t);e.y=o.y+(e.y-o.y)*hit.t;e.distance=o.distance+(e.distance-o.distance)*hit.t;}A=pose(c,a,poses[i]);Bv=pose(c,b,poses[j]);}
      const {nx,nz}=hit,inv=ia+ib,sep=hit.depth+.001;
      if(ia)deplacer(a,c,A,-nx*sep*ia/inv,-nz*sep*ia/inv);
      if(ib)deplacer(b,c,Bv,nx*sep*ib/inv,nz*sep*ib/inv);
      const closing=Math.max(0,(A.vx-Bv.vx)*nx+(A.vz-Bv.vz)*nz);
      const aligned=Math.cos(A.h-Bv.h)>.85;
      const lateral=aligned&&Math.abs(Math.cos(A.h)*nx+Math.sin(A.h)*nz)<.5&&Math.abs(Math.cos(Bv.h)*nx+Math.sin(Bv.h)*nz)<.5;
      // Impulsion normale dissipative ; pas de mouvement ajouté à une épave.
      if(closing>0){const impulse=closing*1.1/inv;if(ia)vitesse(a,c,A.vx-nx*impulse*ia,A.vz-nz*impulse*ia,A.h);if(ib)vitesse(b,c,Bv.vx+nx*impulse*ib,Bv.vz+nz*impulse*ib,Bv.h);}
      const violent=B.degats && closing>=B.degats.PARAMS.chocCasse;
      if(closing<=.1 || (!violent && ((!p.separe&&t-p.tSeparation<P.rearmSeparation)||t-p.tEvent<P.rearmEvent))) { pose(c,a,A);pose(c,b,Bv);continue; }
      p.separe=false;p.tEvent=t;
      const dx=Bv.x-A.x,dz=Bv.z-A.z,ds=dx*Math.cos(A.h)+dz*Math.sin(A.h),side=(-Math.sin(A.h)*nx+Math.cos(A.h)*nz)>=0?1:-1;
      if(lateral&&ia&&ib){
        if(!a.saut&&!b.saut&&a.v>=0&&b.v>=0&&closing>=P.bondVMin&&t-p.tBond>=P.rearmBond){const grand=closing>=P.sautVMin,victim=ds>=0?a:b;B.conduite.lancerSaut(victim,{grand,pouss:side,roulV:-side*(grand?2.4:.7),tangV:grand?-1.4:-.3,omega:victim.omega-side*.18});p.tBond=t;}
        if(Math.abs(ds)>.4){const kick=P.lacetDecale*(ds>=0?1:-1);a.psi-=kick;b.psi+=kick;}
        const loss=Math.min(.06,closing*.006);a.v*=1-loss;b.v*=1-loss;
      }else{const torque=P.lacetChoc*closing*(-Math.sin(A.h)*dx+Math.cos(A.h)*dz)*.05;if(ia)a.omega-=torque;if(ib)b.omega+=torque;}
      ev.push({type:'contact',a:va.id,b:vb.id,force:closing,lateral});
      for(const [v,invMass,normX,normZ,other,self] of [[va,ia,nx,nz,Bv,A],[vb,ib,-nx,-nz,A,Bv]]){
        if(!invMass)continue;
        const front=(other.x-self.x)*Math.cos(self.h)+(other.z-self.z)*Math.sin(self.h)>=0;
        const right=-Math.sin(self.h)*normX+Math.cos(self.h)*normZ>=0;
        const roue=lateral?(front?0:2)+(right?1:0):undefined;
        for(const e of B.conduite.subirChoc(v.etat,closing,{roue,cote:right?1:-1,front,zone:lateral?(right?'droite':'gauche'):(front?'avant':'arriere')})){e.id=v.id;ev.push(e);}
        if(v.joueur){const e=B.conduite.annulerDerive(v.etat,true);if(e){e.id=v.id;ev.push(e);}}
      }
      pose(c,a,A);pose(c,b,Bv);
    }
  }
  B.contacts={PARAMS,avant,pas,tester};
})(globalThis.BITUME=globalThis.BITUME||{});
