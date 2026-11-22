/* BITUME — garage ouvert, équipe de douze et intervention au point d'arrêt réel. */
(function (B) {
  'use strict';
  if(!B.mouvementsStand&&typeof module!=='undefined'&&module.exports)require('./mouvements-stand.js');

  const PI = Math.PI, TAU = 2 * PI;
  const acier = [.37,.42,.45], anthracite = [.085,.10,.12], gomme = [.075,.077,.081];
  const ivoire = [.85,.85,.77], atelier = [.045,.20,.24], orange = [.94,.35,.095], laiton = [.52,.43,.27];
  const rouge = [.96,.075,.045], vert = [.12,.97,.35], ambre = [1,.62,.12];
  const rougeEteint=[.18,.025,.02],vertEteint=[.025,.12,.045];
  const TENUES = [[.09,.24,.28],[.15,.28,.31],[.12,.21,.25],[.18,.27,.28]];
  const RETARD = [0,.012,.025,.038], DEPOSE = .38, REPOSE = .625;
  const clamp = x => Math.max(0, Math.min(1,x));
  const lisse = (a,b,x) => { const u=clamp((x-a)/(b-a)); return u*u*(3-2*u); };
  const lerp = (a,b,u) => a+(b-a)*u;
  const vec = () => [0,0,0];
  function xyz(p,x,y,z) { p[0]=x; p[1]=y; p[2]=z; return p; }
  function melanger(p,a,b,u) { return xyz(p,lerp(a[0],b[0],u),lerp(a[1],b[1],u),lerp(a[2],b[2],u)); }
  function copie(p,a) { return xyz(p,a[0],a[1],a[2]); }
  function virer(a,b,t){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;}
  function emettre(out,o){out[out.compte++]=o;}

  // Profils de combinaison et de chaussure. La section [hauteur, déport avant,
  // demi-profondeur, demi-largeur] permet un thorax à épaules larges, un pantalon
  // resserré à la cheville et une semelle plate. L'axe longitudinal est Y comme pour les os.
  function profil(nom,sections) {
    const R=globalThis.FRender||globalThis.window?.FRender;
    if(!R?.forme)return 'bevel';
    const n=10,faces=[],rings=sections.map((s,i)=>{
      const lo=sections[Math.max(0,i-1)],hi=sections[Math.min(sections.length-1,i+1)],dy=hi[0]-lo[0];
      return Array.from({length:n},(_,j)=>{
        const c=Math.cos(TAU*j/n),b=Math.sin(TAU*j/n);
        const dx=hi[1]-lo[1]+(hi[2]-lo[2])*c,dz=(hi[3]-lo[3])*b;
        const nx=dy*s[3]*c,ny=-dx*s[3]*c-dz*s[2]*b,nz=dy*s[2]*b,l=Math.hypot(nx,ny,nz)||1;
        return {p:[s[1]+s[2]*c,s[0],s[3]*b],n:[nx/l,ny/l,nz/l]};
      });
    });
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++){
      const k=(j+1)%n,a=rings[i][j],b=rings[i+1][j],c=rings[i+1][k],d=rings[i][k];
      faces.push([a.p,b.p,c.p,a.n,b.n,c.n],[a.p,c.p,d.p,a.n,c.n,d.n]);
    }
    for(const i of [0,rings.length-1])for(let j=0;j<n;j++){
      const k=(j+1)%n,s=sections[i],normal=[0,i?1:-1,0];
      faces.push([[s[1],s[0],0],rings[i][i?k:j].p,rings[i][i?j:k].p,normal,normal,normal]);
    }
    R.forme(nom,faces);return nom;
  }
  const formeTorse=profil('bitume-stand-combinaison',[[-.5,0,.39,.39],[-.23,0,.47,.40],[.12,.025,.49,.48],[.34,0,.44,.51],[.45,-.04,.34,.43],[.50,-.04,.26,.23]]);
  const formeBassin=profil('bitume-stand-bassin',[[-.5,0,.38,.35],[-.23,-.025,.49,.46],[.13,0,.48,.50],[.5,0,.40,.42]]);
  const formeCuisse=profil('bitume-stand-cuisse',[[-.5,0,.37,.38],[-.22,-.02,.41,.42],[.18,.02,.50,.49],[.5,0,.45,.44]]);
  const formeManche=profil('bitume-stand-manche',[[-.5,0,.34,.37],[-.31,0,.39,.42],[.1,0,.48,.48],[.39,0,.50,.49],[.5,0,.43,.43]]);
  const formeBotte=profil('bitume-stand-bottine',[[-.5,.015,.485,.48],[-.28,.015,.49,.49],[.02,-.04,.43,.45],[.32,-.17,.29,.39],[.5,-.21,.23,.38]]);
  function ancrage(c,s,d) {
    const f=B.circuit.echantillon(c,s), tx=Math.cos(f.cap), tz=Math.sin(f.cap);
    const largeur=c.largeur/2;
    return { x:f.x-tz*d,y:f.y-Math.max(-largeur,Math.min(largeur,d))*Math.sin(f.devers||0),z:f.z+tx*d,
      cap:f.cap,tx,tz,pente:f.pente||0 };
  }
  function centre(c) {
    const S=c.stands;
    return { s:Number.isFinite(S.sBox)?S.sBox:(S.garage0+S.garage1)/2,d:Number.isFinite(S.dBox)?S.dBox:S.d };
  }
  function voie(c,s) {
    const d=B.circuit.axeStands?.(c,s);
    return Number.isFinite(d)?d:c.stands.d;
  }
  function segment(o,a,b) {
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],h=Math.hypot(dx,dz);
    xyz(o.p,(a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5);
    o.s[1]=Math.max(.001,Math.hypot(h,dy)); xyz(o.r,Math.atan2(h,dy),Math.atan2(dx,dz),0);
  }
  function piece(shape,s,mat,color) {
    return {shape,p:vec(),s:s.slice(),r:vec(),mat,color,surface:'object'};
  }
  function construireDecors(c,terrain,ajouter) {
    if(!c||!c.stands||!ajouter)return null;
    const S=c.stands, cote=S.cote||1, box=centre(c), objets=[],loin=[], f=ancrage(c,box.s,box.d);
    // Chaque station prend l'altitude réelle de la chaussée à sa propre abscisse,
    // notamment les portiques, indépendants du plat du box.
    function bloc(s,d,y,shape,sx,sy,sz,col,mat,lointain=false,partie='atelier') {
      const rep=ancrage(c,s,d),o=piece(shape,[sx,sy,sz],mat,col);
      xyz(o.p,rep.x,rep.y+y,rep.z); o.r[1]=-rep.cap; o.architecture='box-service'; o.partie=partie;
      objets.push(o); if(lointain)loin.push(o); return o;
    }
    function garage(x,z,y,shape,sx,sy,sz,col,mat,loin=false,partie) {
      return bloc(box.s+x,box.d+cote*z,y,shape,sx,sy,sz,col,mat,loin,partie);
    }
    function livrer(x,z) {
      if(objets.length)ajouter(objets.slice(),loin.slice(),x,z);
      inventaire.push(...objets); objets.length=loin.length=0;
    }
    const inventaire=[];
    // Seul le bras haut passe au-dessus de la voie ; les pieds sont plantés à l'extérieur de l'enrobé.
    for(const entree of [true,false]){
      const s=entree?S.debut+2:S.fin-2,d=voie(c,s),bord=B.circuit.bordStands?.(c,s,cote);
      const pied=cote*(Math.max(d*cote+S.demi,Number.isFinite(bord)?bord:c.largeur/2)+.95),rep=ancrage(c,s,pied);
      bloc(s,pied,2.38,'box',.26,4.76,.29,acier,0,true,'pied-portique');
      bloc(s,pied,.23,'bevel',.56,.46,.56,anthracite,22,true);
      bloc(s,(pied+d)/2,4.53,'box',.25,.25,Math.abs(pied-d)+.27,acier,0,true);
      bloc(s,d,4.27,'bevel',.32,.68,2.4,anthracite,24,true,'panneau-voie');
      const couleur=entree?ambre:vert,texte=entree?'PIT IN':'PIT OUT';
      // Même alphabet que les portiques de course, devant le support et face à l'arrivée.
      if(B.signalisationCourse&&(globalThis.FRender||globalThis.window?.FRender)?.forme){
        for(let i=0;i<texte.length;i++)if(texte[i]!==' '){
          const signe=bloc(s-.19,d+(i-(texte.length-1)/2)*.29,4.33,'bitume-portique-'+texte[i],.04,.35,.235,ivoire,16,true,'inscription');
          signe.emissive=.6;
        }
      }
      bloc(s-.17,d,4.035,'box',.025,.042,1.84,couleur,16,true);
      livrer(rep.x,rep.z);
    }
    // Atelier ouvert vers le box. La poutre de rive est en porte-à-faux : aucune colonne entre l'équipe et la roue.
    let bas=-.16;
    if(terrain?.sol)for(const x of [-7,0,7])for(const z of [3.2,6.45,9.9]){
      const pied=ancrage(c,box.s+x,box.d+cote*z),sol=terrain.sol(pied.x,pied.z);
      if(Number.isFinite(sol))bas=Math.min(bas,sol-pied.y-.05);
    }
    const dalle=garage(0,6.54,(bas+.018)*.5,'box',14.4,.018-bas,6.82,[.32,.34,.34],22,true,'socle-atelier');
    const pente=Math.atan(f.pente),sy=Math.sin(-f.cap),cy=Math.cos(f.cap),sp=Math.sin(pente),cp=Math.cos(pente);
    xyz(dalle.r,Math.atan2(sy*sp,cy),Math.asin(sy*cp),Math.atan2(sp,cy*cp));
    garage(0,6.45,3.54,'box',14.6,.24,7.0,atelier,24,true,'couverture');
    garage(0,3.02,3.54,'box',14.65,.32,.16,ivoire,24,true,'rive');
    garage(0,3.0,3.37,'box',14.64,.075,.17,orange,24,true);
    garage(0,9.78,1.74,'box',14.35,3.48,.18,anthracite,24,true,'fond');
    for(const x of [-7,7]){
      garage(x,8.52,1.7,'box',.18,3.4,2.62,atelier,24,true,'retour');
      for(const z of [3.65,9.5])garage(x,z,1.73,'box',.18,3.46,.18,acier,0,true,'poteau');
    }
    for(const x of [-4.7,0,4.7]){
      garage(x,6.45,3.32,'box',.10,.19,6.55,acier,0,true);
      const lampe=garage(x,4.35,3.34,'box',2.4,.04,.12,ivoire,16); lampe.emissive=.75;
    }
    // Contraste à distance : un seul numéro de box, formé de deux traits, et une baie de matériel à sa droite.
    garage(4.9,2.90,3.53,'box',1.45,.42,.06,atelier,24,true,'enseigne');
    for(const x of [4.70,5.08])garage(x,2.856,3.54,'box',.075,.28,.025,ivoire,16,true);
    garage(.45,8.7,.58,'bevel',4.35,1.12,.92,atelier,24,true,'etabli');
    garage(.45,8.7,1.17,'box',4.5,.1,1.04,acier,0);
    for(const x of [-.65,.85]){
      garage(x,8.94,1.71,'box',1.25,.74,.15,anthracite,0);
      garage(x,8.85,1.71,'box',1.10,.58,.035,[.075,.32,.34],16);
      for(let n=0;n<3;n++)garage(x-.2,8.826,1.55+n*.11,'box',.36+n*.15,.021,.015,ivoire,16);
    }
    for(const x of [-4.65,4.4]){
      garage(x,7.55,.58,'bevel',1.5,.9,.72,orange,24,true,'servante');
      for(let j=0;j<3;j++)garage(x,7.17,.38+.22*j,'box',1.23,.035,.04,acier,0);
      for(const h of [-.53,.53])garage(x+h,7.50,.14,'bevel',.16,.22,.46,anthracite,7);
    }
    for(const x of [-5.7,-4.7])for(let n=0;n<3;n++)
      garage(x,8.86,.16+n*.29,'cylinder',.76,.28,.76,gomme,7,n===2,'stock-pneus');
    // Tourelle incendie, enrouleur et alimentation par le haut : aucune conduite en travers de la voie rapide.
    for(const x of [-2.4,-1.96]){
      garage(x,8.05,.48,'cylinder',.29,.89,.29,rouge,24,false,'extincteur');
      garage(x,8.05,.98,'bevel',.21,.12,.15,acier,0);
    }
    garage(-.85,4.0,2.1,'box',.22,4.2,.22,acier,0,true,'colonne-flexible');
    garage(-.85,2.75,4.05,'box',.2,.22,2.70,acier,0,true,'fleche-flexible');
    garage(-.85,1.53,3.89,'sphere',.42,.42,.42,orange,24);
    for(const x of [-2.65,2.65])garage(x,0,.022,'box',.13,.027,2.58,ivoire,24,false,'repere-arret');
    for(const z of [-1.23,1.23])garage(0,z,.022,'box',5.18,.027,.10,orange,24,false,'repere-arret');
    livrer(f.x,f.z);
    return {objets:inventaire,sBox:box.s};
  }

  // Abscisse d'attente et déport derrière la rive ouverte. Les postes à gauche
  // contournent chacun leur extrémité de la voiture pour accéder à la roue.
  const POSTES=[
    ['pistolet',0,4.15,3.8],['pistolet',1,1.8,3.85],['pistolet',2,-4.05,3.85],['pistolet',3,-1.85,3.85],
    ['pneu',0,5.25,4.75],['pneu',1,2.95,4.75],['pneu',2,-5.15,4.73],['pneu',3,-3.0,4.76],
    ['cric',0,5.9,3.85],['cric',2,-5.85,3.85],['essence',1,-.30,4.63],['chef',1,.83,3.80]
  ];
  const rouesDefaut=[{x:1.35,z:-.85,r:.29,l:.28},{x:1.35,z:.85,r:.29,l:.28},{x:-1.35,z:-.8075,r:.335,l:.46},{x:-1.35,z:.8075,r:.335,l:.46}];
  function progression(st) { return st && st.phase==='service' && st.duree>0 ? clamp(st.t/st.duree) : -1; }
  function hauteurCric(st) {
    const u=progression(st);
    return .11*lisse(.27,.34,u)*(1-lisse(.69,.75,u));
  }
  function rouesDeposees(st,out,perdues) {
    const u=progression(st);
    for(let i=0;i<4;i++){
      const p=u-RETARD[i];
      out[i]=p<REPOSE&&(p>=DEPOSE||!!perdues?.[i]);
    }
    return out;
  }
  function creer(c,decor) {
    if(!c||!c.stands)return {actif:false,objets:[]};
    const cote=c.stands.cote||1,box=centre(c),f=ancrage(c,box.s,box.d),mecs=POSTES.map(([role,coin,x,z],i)=>({
      role,coin,i,parc:ancrage(c,box.s+x,box.d+cote*z),pieces:null
    }));
    return {actif:true,c,cote,box,fBox:f,mecs,objets:[],points:Array.from({length:10},vec),angles:new Float32Array(8),
      squat:new Float32Array(8),appuis:new Float32Array(2),car:{},moyeux:Array.from({length:4},vec),
      arrivee:ancrage(c,box.s-.85,box.d+cote*1.53),lampes:null};
  }
  function pneuPorte(m,neuf,roue) {
    const liste=[],essieu=roue.x>0?'av':'ar', J=B.voiture?.JANTES_FORMES?.[essieu];
    function relever(shape,s,col,mat,cle) {
      const o=piece(shape,s,mat,col); liste.push(o); o.cle=cle; return o;
    }
    const enveloppe=relever('cylinder',[2*roue.r,roue.l,2*roue.r],gomme,7,'pneu');
    relever('cylinder',[.34,roue.l+.008,.34],laiton,0,'fut');
    if(J)relever('box',[1,1,1],laiton,0,'rayons');
    const flanc=relever('ring',[roue.r*1.72,.045,roue.r*1.72],ivoire,7,'bague');
    if(neuf){m.flanc=flanc;m.roue=enveloppe;}
    return {liste,essieu,neuf,type:null,niveau:-1};
  }
  function habiller(m,roue) {
    const parts=[],tissu=TENUES[m.i%TENUES.length],cuir=[.12,.115,.105];
    function p(shape,s,col,mat=24,detail=0) {
      const o=piece(shape,s,mat,col); o.detailStand=detail; parts.push(o); return o;
    }
    m.pieces=parts;
    // Le bassin, la cage thoracique et les membres ont des volumes indépendants ;
    // genoux et coudes conservent une silhouette continue dans la pose basse.
    m.bassin=p(formeBassin,[.25,.25,.365],tissu);
    m.torse=p(formeTorse,[.275,.53,.45],tissu);
    m.plastron=p('bevel',[.045,.22,.30],m.role==='chef'?orange:ivoire,24,1);
    m.ceinture=p('bevel',[.244,.066,.366],anthracite,7,1);
    m.casquette=p('sphere',[.27,.315,.27],m.role==='essence'?orange:m.role==='chef'?rouge:ivoire);
    m.visiere=p('bevel',[.13,.098,.25],[.055,.083,.09],0,1);
    m.lisere=p('bevel',[.035,.035,.23],orange,24,1);
    const F=B.voiture?.FORMES;
    if(F?.['pilote-casque']&&F['pilote-visiere']&&F['pilote-bande']){
      m.casques=[[m.casquette,F['pilote-casque']],[m.visiere,F['pilote-visiere']],[m.lisere,F['pilote-bande']]];
      for(const [o] of m.casques){o.alternative=o.shape;o.tailleSimple=o.s.slice();}
    }
    m.membres=[];
    for(const signe of [-1,1])m.membres.push({
      signe,cuisse:p(formeCuisse,[.186,.44,.173],tissu),tibia:p(formeManche,[.142,.43,.139],tissu),
      botte:p(formeBotte,[.265,.17,.138],cuir),bras:p(formeManche,[.135,.30,.143],tissu),
      avantBras:p(formeManche,[.105,.27,.113],tissu),gant:p('bevel',[.093,.132,.093],ivoire,24,1)
    });
    if(m.role==='pistolet'){
      m.pistolet=p('bevel',[.25,.12,.118],anthracite,0); m.douille=p('cylinder',[.061,.12,.061],acier,0,1);
      m.poignee=p('bevel',[.076,.12,.07],orange,7,1);
    }else if(m.role==='pneu'){
      m.neuf=pneuPorte(m,true,roue); m.use=pneuPorte(m,false,roue);
    }else if(m.role==='cric'){
      m.patin=p('bevel',[.55,.09,.40],orange,0); m.manche=p('cylinder',[.048,1,.048],acier,0);
      m.galets=[p('sphere',[.115,.115,.095],gomme,7,1),p('sphere',[.115,.115,.095],gomme,7,1)];
    }else if(m.role==='essence'){
      m.buse=p('cylinder',[.11,.25,.11],acier,0); m.collier=p('bevel',[.15,.13,.18],orange,7);
      m.tuyau=Array.from({length:4},()=>p('cylinder',[.082,1,.082],anthracite,7));
      for(const o of [m.buse,m.collier,...m.tuyau])o.ravitaillement=true;
    }else{
      m.perche=p('cylinder',[.04,1,.04],acier,0); m.disque=p('cylinder',[.45,.055,.45],rouge.slice(),16);
      m.barre=p('bevel',[.021,.045,.29],ivoire,16,1);
    }
  }
  function cadrerCar(eq,v,pose) {
    const c=eq.car,f=eq.fBox,e=v?.etat,st=e?.stands;
    let x=f.x,y=f.y,z=f.z,cap=f.cap,pitch=Math.atan(f.pente),roll=0;
    if(v && st.phase==='service'){
      if(pose&&Number.isFinite(pose.x)){
        x=pose.x;y=pose.y;z=pose.z;cap=pose.cap;pitch=pose.tangage||0;roll=pose.roulis||0;
      }else{
        // La géométrie des emplacements est fixe ; ce chemin sert aussi aux hôtes sans pose interpolée.
        if(eq.service!==st||eq.serviceS!==st.sService||eq.serviceD!==st.dService){
          eq.service=st;eq.serviceS=st.sService;eq.serviceD=st.dService;
          eq.arret=ancrage(eq.c,Number.isFinite(st.sService)?st.sService:eq.box.s,Number.isFinite(st.dService)?st.dService:eq.box.d);
        }
        const a=eq.arret,ph=e._physx;
        x=ph?.x??a.x;y=(ph?.y??(Number.isFinite(e.y)?e.y:a.y))+hauteurCric(st);z=ph?.z??a.z;
        cap=ph?.cap??(a.cap+(e.psi||0)+(e.beta||0));pitch=e.tangage||0;roll=e.roulis||0;
      }
    }
    c.x=x;c.y=y;c.z=z;c.tx=Math.cos(cap);c.tz=Math.sin(cap);c.cp=Math.cos(pitch);c.sp=Math.sin(pitch);c.cr=Math.cos(roll);c.sr=Math.sin(roll);
    c.rebond=pose?.rebond||e?._physx?.offsets;
  }
  function surCar(p,c,x,y,z) {
    const h=y*c.cr-z*c.sr,l=y*c.sr+z*c.cr,a=x*c.cp-h*c.sp;
    return xyz(p,c.x+c.tx*a-c.tz*l,c.y+x*c.sp+h*c.cp,c.z+c.tz*a+c.tx*l);
  }
  function rouesMobiles(jeu,type,detail) {
    const niveau=detail?1:3;
    if(jeu.type===type&&jeu.niveau===niveau)return;
    const roues=B.voiture?.ROUES_FORMES?.[jeu.essieu],jantes=B.voiture?.JANTES_FORMES?.[jeu.essieu];
    const couleur=B.pneus?.lire(type).cercle||ivoire;
    for(const o of jeu.liste){
      const f=o.cle==='pneu'?roues?.[type]?.[niveau]:jantes?.[o.cle]?.[niveau];
      if(f){o.shape=f.nom;copie(o.s,f.taille);o.centre=f.centre;}
      if(o.cle==='bague')o.color=couleur;
    }
    jeu.type=type;jeu.niveau=niveau;
  }
  function poserPneu(jeu,p,c,type,detail,out) {
    rouesMobiles(jeu,type,detail);
    for(const o of jeu.liste){
      if(!detail&&(o.cle==='bague'||o.cle==='rayons'))continue;
      // Axe Y des roues enregistrées orienté sur l'essieu ; le centre de normalisation
      // de chaque sous-pièce accompagne la roue et non la main du porteur.
      const k=o.centre,dx=k?k[0]:0,dy=k?k[1]:0,dz=k?k[2]:0;
      xyz(o.p,p[0]+c.tx*dx-c.tz*dy,p[1]-dz,p[2]+c.tz*dx+c.tx*dy);
      xyz(o.r,PI/2,-Math.atan2(c.tz,c.tx),0);emettre(out,o);
    }
  }
  // Résolution de deux segments sur un plan déterminé par le pôle du coude/genou.
  function articulation(joint,a,b,px,py,pz,L1,L2) {
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],dist=Math.hypot(dx,dy,dz)||.001;
    const ux=dx/dist,uy=dy/dist,uz=dz/dist,k=px*ux+py*uy+pz*uz;
    let vx=px-ux*k,vy=py-uy*k,vz=pz-uz*k;
    const len=Math.hypot(vx,vy,vz)||1;vx/=len;vy/=len;vz/=len;
    const d=Math.min(L1+L2,Math.max(Math.abs(L1-L2)+.0001,dist));
    const tang=(L1*L1-L2*L2+d*d)/(2*d),h=Math.sqrt(Math.max(0,L1*L1-tang*tang));
    xyz(joint,a[0]+ux*tang+vx*h,a[1]+uy*tang+vy*h,a[2]+uz*tang+vz*h);
  }
  function corps(p,m,a,y,z) {
    return xyz(p,m.x+m.fx*a-m.fz*z,m.y+y,m.z+m.fz*a+m.fx*z);
  }
  function orienter(o,p,m) { copie(o.p,p);xyz(o.r,0,-Math.atan2(m.fz,m.fx),0); }
  function placerCorps(o,m,a,y,z) { corps(o.p,m,a,y,z);o.r[1]=-Math.atan2(m.fz,m.fx); }
  function parcours(m,eq,u) {
    const c=eq.car,roue=(B.pneus?.ROUES||rouesDefaut)[m.coin],side=Math.sign(roue.z),bout=Math.sign(roue.x);
    const ax=(m.parc.x-c.x)*c.tx+(m.parc.z-c.z)*c.tz,az=-(m.parc.x-c.x)*c.tz+(m.parc.z-c.z)*c.tx;
    const cric=m.role==='cric',carburant=m.role==='essence',chef=m.role==='chef',porteur=m.role==='pneu';
    const bx=cric?bout*3.25:chef?2.45:carburant?-.64:roue.x+(porteur?bout*.60:0);
    const bz=cric?.05:chef?eq.cote*2.65:carburant?1.19:roue.z+side*(porteur?.88:.65);
    const retard=carburant||chef||cric?0:RETARD[m.coin];
    const arrive=lisse(.005+retard,.276+retard,u),retour=lisse(.73+retard,.988,u);
    const av=arrive*(1-retour);
    // Un couloir devant le nez ou derrière la boîte de vitesses dessert le côté opposé.
    // Les intervenants proches du garage ont leur propre trajet direct. Longueurs réelles
    // de chaque tronçon pour piloter la foulée, y compris au retour.
    const contour=carburant ? eq.cote<0 : !chef&&!cric&&side*eq.cote<0;
    const couloir=carburant?-3.3:bout*(porteur?3.58:3.06),lx=contour?couloir:bx,lz=contour?bz:az;
    const d1=Math.hypot(lx-ax,lz-az),d2=Math.hypot(bx-lx,bz-lz);
    // Sur le côté opposé, garder l'abscisse extrême pendant toute la traversée.
    const d0=contour?Math.abs(couloir-ax):0;
    const etape1=contour?Math.abs(bz-az):d1,total=Math.max(.001,d0+etape1+d2),distance=av*total;
    let x,z,dx,dz;
    if(contour&&distance<d0){dx=Math.sign(couloir-ax);dz=0;x=ax+dx*distance;z=az;}
    else if(distance<d0+etape1){
      const vx=contour?0:lx-ax,vz=contour?bz-az:lz-az,part=(distance-d0)/Math.max(.001,etape1);
      x=(contour?couloir:ax)+vx*part;z=az+vz*part;dx=vx;dz=vz;
    }else{
      const k=clamp((distance-d0-etape1)/Math.max(.001,d2));
      x=lerp(lx,bx,k);z=lerp(lz,bz,k);dx=bx-lx;dz=bz-lz;
    }
    const depart=(arrive>0&&arrive<1)||(retour>0&&retour<1);
    m.marche=depart?Math.min(lisse(0,.12,av),1-lisse(.88,1,av)):0;
    m.distance=retour>0?(2-av)*total:distance;
    // Regarder l'écrou, la vanne ou le pilote au poste ; pendant la marche, tourner vers le trajet.
    const cibleX=chef?-1:cric?-bout:carburant?.16:roue.x-bx,cibleZ=chef?-.45*eq.cote:cric?0:carburant?-1:roue.z-bz;
    const f=eq.fBox,delta=retour>0?-1:1,capTravail=Math.atan2(cibleZ,cibleX),capPas=Math.atan2(dz*delta,dx*delta);
    m.veille=1-lisse(0,.15,av);
    const versTravail=lisse(.80,1,av),regardEntree=-2.68+m.i*.035;
    const accueil=eq.entree?regardEntree:m.role==='chef'?-2.65:m.role==='essence'?-.62:-1.6+Math.sin(m.i*2.7)*1.02;
    const direction=virer(virer(accueil*eq.cote,capPas,lisse(0,.18,av)),capTravail,versTravail);
    const cs=Math.cos(direction),sn=Math.sin(direction);
    m.fx=c.tx*cs-c.tz*sn; m.fz=c.tz*cs+c.tx*sn;
    m.x=c.x+c.tx*x-c.tz*z; m.z=c.z+c.tz*x+c.tx*z;
    const pente=(m.x-f.x)*f.tx+(m.z-f.z)*f.tz;
    m.y=lerp(m.parc.y,f.y+f.pente*pente,av);
    return lisse(.245+retard,.365+retard,u)*(1-lisse(.69+retard,.81+retard,u));
  }
  function mecanicien(eq,m,t,pli,detail,main) {
    const pt=eq.points,A=eq.angles,Q=eq.squat,appuis=eq.appuis,clips=B.mouvementsStand;
    // Dans le garage un servant bas inspecte sa roue, un autre vérifie le pistolet.
    // À l'annonce d'une voiture ils se redressent sans avancer sur la voie.
    const veilleBasse=(m.i===2?.62:m.i===6?.45:0)*m.veille*(eq.entree?.34:1);
    const posture=Math.max(pli,veilleBasse);
    const phase=clips?m.distance*clips.periodeMarche/clips.longueurFoulee+m.i*.062:m.distance*.73+m.i*.062;
    if(clips){
      clips.lireMarche(phase,A);clips.lireAppuis(phase,appuis);clips.lireAccroupissement(posture,Q);
    }else{
      for(let j=0;j<2;j++){const v=Math.sin(phase*TAU+j*PI);A[j*2]=v*.43;A[j*2+1]=Math.max(0,-v)*.64;
        A[4+j*2]=-v*.30;A[5+j*2]=.34;appuis[j]=v<0?1:0;Q[j*2]=pli*.84;Q[j*2+1]=pli*1.52;}
    }
    const roue=m.role==='pneu'||m.role==='pistolet',tablier=m.role==='essence';
    const besoin=roue?1:m.role==='cric'?.59:tablier?.45:.06;
    const flex=posture*besoin,taille=1+Math.sin(m.i*11.44)*.03,rythme=Math.sin(t*1.5+m.i*1.9);
    const genouMoyen=(Math.abs(Q[1])+Math.abs(Q[3]))*.5,hancheMoyenne=(Math.abs(Q[0])+Math.abs(Q[2]))*.5;
    const hautHanche=taille*(.92-flex*(.18+.63*(1-Math.cos(genouMoyen*.5))))-m.marche*.025;
    const penche=.055+flex*(.12+.14*Math.sin(hancheMoyenne));
    placerCorps(m.bassin,m,-.085*flex,hautHanche,0);
    placerCorps(m.torse,m,penche*.48,hautHanche+.245*taille-flex*.055,0);
    // La coque se penche dans le plan sagittal, même si le mécanicien travaille face à la caméra.
    const p0=pt[0],p1=pt[1];
    // Orienter le thorax avec la largeur suivant les épaules (rotation de Rodrigues locale Y puis cap).
    const lean=Math.atan2(penche+.085*flex,.525*taille-flex*.11),yaw=m.torse.r[1];
    const sp=Math.sin(lean),cp=Math.cos(lean),sy=Math.sin(yaw),cy=Math.cos(yaw);
    xyz(m.torse.r,Math.atan2(-sy*sp,cy),Math.asin(Math.max(-1,Math.min(1,sy*cp))),Math.atan2(-sp,cy*cp));
    if(detail){
      placerCorps(m.plastron,m,penche*.54+.122,hautHanche+.32*taille-flex*.06,0);
      copie(m.plastron.r,m.torse.r);placerCorps(m.ceinture,m,-.025*flex,hautHanche+.055,0);
    }
    const tete=hautHanche+.66*taille-flex*.128+.007*rythme;
    if(m.casques&&detail){
      const regard=m.veille*(.14*Math.sin(t*.61+m.i*2.2)+.18*Math.sin(t*.31+m.i));
      const cg=Math.cos(regard),sg=Math.sin(regard),fx=m.fx*cg-m.fz*sg,fz=m.fz*cg+m.fx*sg;
      const bx=m.x+m.fx*(penche+.035),bz=m.z+m.fz*(penche+.035);
      for(const [o,forme] of m.casques){
        o.shape=forme.nom;copie(o.s,forme.taille);
        const x=forme.centre[0]-.018,z=forme.centre[2];
        xyz(o.p,bx+fx*x-fz*z,m.y+tete+forme.centre[1]-.914,bz+fz*x+fx*z);
        o.r[1]=-Math.atan2(fz,fx);
      }
    }else{
      if(m.casques){m.casquette.shape=m.casquette.alternative;copie(m.casquette.s,m.casquette.tailleSimple);}
      placerCorps(m.casquette,m,penche+.035,tete,0);
      if(detail){placerCorps(m.visiere,m,penche+.130,tete+.014,0);placerCorps(m.lisere,m,penche+.190,tete+.066,0);}
    }
    for(let j=0;j<2;j++){
      const l=m.membres[j],s=l.signe,mv=m.marche,hanche=A[2*j],genou=A[2*j+1];
      // Hanche et flexion du genou donnent la position du pied de la capture. L'appui
      // mesuré le maintient au sol ; les mêmes chaussures terminent sur place au poste.
      const avance=(.43*Math.sin(hanche)+.42*Math.sin(hanche-genou))*mv;
      const souleve=(1-appuis[j])*(.055+.080*Math.max(0,Math.sin(genou)))*mv;
      const repos=s*(.038+flex*.075);
      corps(p0,m,-.085*flex,hautHanche,.115*s);
      corps(p1,m,repos+avance,.12+souleve,s*(.142+flex*.078));
      const pole=.72+Math.max(0,Q[2*j])*flex;
      articulation(pt[2],p0,p1,m.fx*pole-m.fz*s*.12,-.12,m.fz*pole+m.fx*s*.12,.43*taille,.44*taille);
      segment(l.cuisse,pt[2],p0);segment(l.tibia,p1,pt[2]);
      placerCorps(l.botte,m,repos+avance+.052,.086+souleve,s*(.142+flex*.078));
      corps(p0,m,penche,hautHanche+.46*taille-flex*.10,s*.182);
      const bras=A[4+2*j],coude=A[5+2*j],bal=(.29*Math.sin(bras)+.26*Math.sin(bras+coude))*mv;
      const service=!!main,portage=m.role==='pneu'||m.role==='essence';
      corps(p1,m,(portage?.29:.12)+bal,hautHanche+(portage?.03:-.16)+.035*rythme,s*(portage?.22:.24));
      if(service){
        const ecarte=m.role==='pneu'?.19:m.role==='chef'?.06:.083;
        const prise=pt[3];
        xyz(prise,main[0]-m.fz*s*ecarte,main[1]+(s<0?.035:-.035),main[2]+m.fx*s*ecarte);
        melanger(p1,p1,prise,portage||m.role==='chef'?1:Math.max(.20,pli));
      }
      articulation(pt[2],p0,p1,-m.fx*.52-m.fz*s,-.65,-m.fz*.52+m.fx*s,.305*taille,.285*taille);
      segment(l.bras,pt[2],p0);segment(l.avantBras,p1,pt[2]);
      if(detail){orienter(l.gant,p1,m);l.gant.r[0]=.27;}
    }
  }
  function outils(eq,m,st,u,t,pli,detail,out,typeAvant,typeApres) {
    const c=eq.car,pt=eq.points,w=(B.pneus?.ROUES||rouesDefaut)[m.coin],side=Math.sign(w.z),bout=Math.sign(w.x);
    const hub=eq.moyeux[m.coin],main=pt[9],a=pt[4],b=pt[5],d=pt[6],e=pt[7];
    const v=u-RETARD[m.coin],sortie=st?.phase==='sortie';
    if(m.role==='pistolet'){
      corps(main,m,.34,.92,0);
      // L'outil à choc est posé sur l'écrou pendant les deux serrages. Pas d'étincelles de meuleuse.
      xyz(a,hub[0]-c.tz*side*(w.l*.5+.13),hub[1]+.045,hub[2]+c.tx*side*(w.l*.5+.13));
      const choc=((v>.30&&v<DEPOSE)||(v>REPOSE&&v<.71))?Math.sin(83*t+m.i)*.004:0;
      a[1]+=choc; melanger(main,main,a,pli);
      orienter(m.pistolet,main,m);
      if(detail){
        xyz(a,main[0]+m.fx*.09,main[1]+.023,main[2]+m.fz*.09);
        xyz(b,a[0]+m.fx*.135,a[1],a[2]+m.fz*.135);segment(m.douille,a,b);
        xyz(m.poignee.p,main[0]-m.fx*.045,main[1]-.085,main[2]-m.fz*.045);m.poignee.r[1]=m.pistolet.r[1];
      }
    }else if(m.role==='pneu'){
      const deployee=st?.phase==='service',apres=deployee&&v>=REPOSE;
      corps(a,m,.30,.70-pli*.27,0); // l'enveloppe sur l'avant du corps
      melanger(b,a,hub,deployee?lisse(.483,REPOSE,v):0);
      const monte=lisse(DEPOSE,.495,v),repris=lisse(.64,.74,v);
      // L'ancien train est d'abord posé debout au côté de la caisse. La main libérée
      // reprend ensuite cette roue pour rentrer ; la nouvelle disparaît au point exact de montage.
      xyz(d,hub[0]+c.tx*bout*.47-c.tz*side*.77,m.y+w.r,hub[2]+c.tz*bout*.47+c.tx*side*.77);
      melanger(e,hub,d,monte);melanger(e,e,a,repris);
      if(!apres&&!sortie)poserPneu(m.neuf,b,c,typeApres,detail,out);
      if(!m.perdue&&(deployee&&v>=DEPOSE||sortie))poserPneu(m.use,sortie?a:e,c,typeAvant,detail,out);
      const tientAncien=!m.perdue&&deployee&&v>=DEPOSE&&(v<.485||apres);
      copie(main,sortie?a:tientAncien?e:b);
      main[1]+=.14;
    }else if(m.role==='cric'){
      const levage=lisse(.27,.34,u)*(1-lisse(.69,.75,u));
      corps(a,m,.60,.075,0);surCar(b,c,bout*(bout>0?2.45:2.37),.075,0);
      melanger(a,a,b,pli);orienter(m.patin,a,m);
      corps(main,m,.22,1.02-pli*.16-levage*.26,0);
      segment(m.manche,a,main);
      if(detail)for(let k=0;k<2;k++){
        const s=(k-.5)*.32;xyz(m.galets[k].p,a[0]-m.fx*.11-m.fz*s,a[1]-.012,a[2]-m.fz*.11+m.fx*s);
      }
    }else if(m.role==='essence'){
      if(!m.ravitaille)return null;
      const debut=B.course?.STANDS?.branchement??.27,fin=B.course?.STANDS?.debranchement??.72;
      const branche=lisse(.16,debut,u)*(1-lisse(fin,.80,u));
      corps(main,m,.29,1.02,0);surCar(a,c,-.63,.66,.54);melanger(main,main,a,branche);
      xyz(a,main[0]+m.fx*.13,main[1],main[2]+m.fz*.13);
      xyz(b,main[0]-m.fx*.14,main[1]+.045,main[2]-m.fz*.14);segment(m.buse,a,b);
      orienter(m.collier,b,m);
      const source=eq.arrivee;xyz(a,source.x,source.y+3.89,source.z);
      // Alimentation suspendue : extrémité fixe sur l'enrouleur et courbe libre sur le dernier mètre.
      for(let j=0;j<4;j++){
        const k=(j+1)/4;
        xyz(d,lerp(source.x,b[0],k),lerp(source.y+3.89,b[1],k)-Math.sin(k*PI)*.57,lerp(source.z,b[2],k));
        segment(m.tuyau[j],a,d);copie(a,d);
      }
    }else{
      const lever=sortie?1:0;
      corps(main,m,.24,1.14+lever*.32,0);corps(a,m,lerp(.75,.38,lever),lerp(1.34,2.38,lever),0);
      segment(m.perche,main,a);copie(m.disque.p,a);xyz(m.disque.r,PI/2,Math.atan2(c.tx,c.tz),0);
      m.disque.color=sortie?vert:st?.phase==='service'?rouge:ambre;
      m.disque.emissive=sortie||st?.phase==='service'?1.5:.36;
      if(detail){
        xyz(m.barre.p,a[0]-c.tx*.035,a[1],a[2]-c.tz*.035);xyz(m.barre.r,0,-Math.atan2(c.tz,c.tx),0);
        // Une barre horizontale pour l'arrêt, verticale pour la libération, également lisible sans couleur.
        if(sortie){m.barre.s[1]=.29;m.barre.s[2]=.045;}else{m.barre.s[1]=.045;m.barre.s[2]=.29;}
      }
    }
    return main;
  }
  function cibleService(course) {
    let v=null,meilleur=0;
    if(!course?.voitures)return null;
    for(const voiture of course.voitures){
      const et=voiture.etat,st=et?.stands;
      if(!st||voiture.fini||voiture.abandon)continue;
      let rang=st.phase==='sortie'?2:1;
      if(st.phase==='service'){
        if(!Number.isFinite(et.v)||Math.abs(et.v)>=(B.course?.STANDS?.arret??.35)||st.interrompu)continue;
        rang=3;
      }
      if(rang>meilleur){meilleur=rang;v=voiture;if(rang===3)break;}
    }
    return v;
  }
  function animer(eq,t,ctx,sortie) {
    if(!eq?.actif)return;
    const f=eq.fBox,oeil=ctx?.cameraPos,out=eq.objets;
    const d2=oeil?(oeil[0]-f.x)**2+(oeil[1]-f.y)**2+(oeil[2]-f.z)**2:0;
    if(d2>190*190||ctx?.visible&&!ctx.visible(f.x,f.y+1.6,f.z,14)){out.length=0;eq.imageLointaine=null;return;}
    const v=cibleService(ctx?.course),st=v?.etat.stands,u=progression(st),roues=B.pneus?.ROUES||rouesDefaut;
    const detail=d2<62*62||(st?.phase==='service'&&d2<98*98);
    const ancien=st?.pneusAvant||v?.etat.pneus||'slicks',nouveau=st?.pneus||v?.etat.pneusProchainArret||ancien;
    const reposLointain=d2>98*98&&(!st||st.phase==='voie'),imageLointaine=reposLointain?Math.floor(t*8):null;
    const entree=st?.phase==='voie';
    if(reposLointain&&eq.imageLointaine===imageLointaine&&eq.entree===entree&&eq.monteAttente===nouveau){
      if(sortie)for(const o of out)sortie.push(o);
      return;
    }
    eq.imageLointaine=imageLointaine;eq.entree=entree;eq.monteAttente=nouveau;
    cadrerCar(eq,v,ctx?.poses?.[v?.id]);
    for(let i=0;i<4;i++){const w=roues[i];surCar(eq.moyeux[i],eq.car,w.x,w.r+(eq.car.rebond?.[i]||0),w.z);}
    out.compte=0;
    const ravitaille=Number.isFinite(st?.carburantAvant)&&st.carburantAvant<(B.course?.STANDS?.reservoir??72)-.001;
    for(const m of eq.mecs){
      if(!m.pieces)habiller(m,roues[m.coin]);
      m.ravitaille=ravitaille;
      m.perdue=!!v?.degats?.roues?.[m.coin];
      const pli=parcours(m,eq,m.role==='essence'&&!m.ravitaille?-1:u);
      const main=outils(eq,m,st,u,t,pli,detail,out,ancien,nouveau);
      mecanicien(eq,m,t,pli,detail,main);
      for(const o of m.pieces)if((detail||!o.detailStand)&&(!o.ravitaillement||m.ravitaille))emettre(out,o);
    }
    if(!eq.lampes){
      const pied=ancrage(eq.c,eq.box.s+3.35,eq.box.d+eq.cote*2.42);
      eq.lampes=[piece('bevel',[.19,.53,.26],0,anthracite),piece('sphere',[.10,.14,.14],16,rouge),piece('sphere',[.10,.14,.14],16,vert),
        piece('cylinder',[.065,1.72,.065],0,acier)];
      eq.lampes.forEach((o,j)=>{
        const dep=j===1||j===2?-.10:0;
        xyz(o.p,pied.x+pied.tx*dep,pied.y+[1.95,2.08,1.83,.88][j],pied.z+pied.tz*dep);o.r[1]=-pied.cap;
      });
    }
    const stop=st?.phase==='service',go=st?.phase==='sortie';
    eq.lampes[1].color=stop?rouge:rougeEteint;eq.lampes[1].emissive=stop?2:0;
    eq.lampes[2].color=go?vert:vertEteint;eq.lampes[2].emissive=go?2:0;
    for(const o of eq.lampes)emettre(out,o);
    out.length=out.compte;
    if(sortie)for(const o of out)sortie.push(o);
  }
  B.equipeStands={construireDecors,creer,animer,rouesDeposees,hauteurCric};
})(globalThis.BITUME=globalThis.BITUME||{});
if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.BITUME.equipeStands;
