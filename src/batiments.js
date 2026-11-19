/* BITUME — architecture procédurale : garages, maisons et postes de commissaires.
   Primitives FERRO existantes seulement. Hasard propre aux bâtiments ; aucun tirage consommé dans le décor. */
(function (B) {
  'use strict';
  const gris = [.45, .48, .49], acier = [.34, .38, .40], vitre = [.12, .23, .27], noir = [.075, .08, .085];
  const MURET = Object.freeze({ recul: 6.2, epaisseur: .5, epaisseurLisse: .54 });
  function hache(n) { n = Math.imul(n ^ n >>> 16, 0x45d9f3b); n = Math.imul(n ^ n >>> 16, 0x45d9f3b); return ((n ^ n >>> 16) >>> 0) / 4294967296; }
  function chantier(site, genre, detail) {
    const proche = [], loin = [], a = site.a || 0, cos = Math.cos(a), sin = Math.sin(a);
    const graine = (site.graine | 0) ^ Math.imul(Math.round(site.x * 4), 374761393) ^ Math.imul(Math.round(site.z * 4), 668265263);
    const hasard = i => hache(graine ^ Math.imul(i + 1, 1274126177));
    const point = (x, y, z) => [site.x + cos * x - sin * z, site.sol + y, site.z + sin * x + cos * z];
    const teinte = (c, i, amplitude = .18) => c.map((v, k) => Math.max(.015, Math.min(1, v * (1 + (hasard(i + k) - .5) * amplitude))));
    function objet(shape, x, y, z, s, color, mat, partie, solide = null, distant = false, r = [0, -a, 0]) {
      const o = { shape, p: point(x, y, z), s, r, color, mat, architecture: genre, partie };
      if (solide) {
        if(shape==='box'||shape==='cylinder'&&!r[0]&&!r[2])o.collision=solide;
        else Object.defineProperty(o,'solidePhysX',{value:Object.freeze({genre:solide,groupe:2,surface:null})});
      }
      proche.push(o); if (distant) loin.push(o); return o;
    }
    const boite = (x,y,z,s,c,mat,partie,solide,distant,r) => objet('box',x,y,z,s,c,mat,partie,solide,distant,r);
    const biseau = (x,y,z,s,c,mat,partie,solide,distant,r) => objet('bevel',x,y,z,s,c,mat,partie,solide,distant,r);
    function tube(p, q, diametre, color, mat, partie, solide = null, distant = false) {
      const u = point(...p), v = point(...q), dx = v[0] - u[0], dy = v[1] - u[1], dz = v[2] - u[2], l = Math.hypot(dx,dy,dz);
      const o = { shape: 'cylinder', p: u.map((x,i) => (x+v[i])/2), s: [diametre,l,diametre],
        r: [Math.acos(Math.max(-1,Math.min(1,dy/l))),Math.atan2(dx,dz),0], color, mat, architecture: genre, partie };
      if (solide) o.collision = solide; proche.push(o); if (distant) loin.push(o); return o;
    }
    function auvent(x,y,z,l,profondeur,couleur,solide = null) {
      // Six pans suivent une courbe douce. Leurs rotations sont aussi celles des collisions : aucune
      // boîte invisible ne rebouche une ouverture. La rive est ronde et ne demande pas de forme moteur.
      for (let j=0;j<6;j++) {
        const z0=(j/6-.5)*profondeur,z1=((j+1)/6-.5)*profondeur;
        const y0=.34*Math.cos((j/6-.5)*Math.PI),y1=.34*Math.cos(((j+1)/6-.5)*Math.PI);
        boite(x,y+(y0+y1)/2,z+(z0+z1)/2,[l,.09,Math.hypot(z1-z0,y1-y0)+.025],couleur,24,'auvent',solide,true,[-Math.atan2(y1-y0,z1-z0),-a,0]);
      }
      tube([x-l/2,y,z-profondeur/2],[x+l/2,y,z-profondeur/2],.11,acier,0,'cheneau',null,true);
    }
    const SEGMENTS = ['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
    function numero(n,x,y,z,taille=.75) {
      const positions={a:[0,.45,1,.14],b:[.43,.23,.14,.45],c:[.43,-.23,.14,.45],d:[0,-.45,1,.14],e:[-.43,-.23,.14,.45],f:[-.43,.23,.14,.45],g:[0,0,1,.14]};
      for (const segment of SEGMENTS[n%10]) {
        const [dx,dy,w,h]=positions[segment]; biseau(x+dx*taille,y+dy*taille,z,[w*taille,h*taille,.045],[.94,.91,.78],16,'numero');
      }
    }
    function fenetre(x,y,z,l,h,cadre,volets = false) {
      biseau(x,y,z,[l+.22,h+.24,.16],cadre,10,'cadre-fenetre');
      boite(x,y,z-.10,[l,h,.045],vitre,7,'vitrage');
      boite(x,y,z-.13,[.065,h,.06],cadre,10,'meneau');
      boite(x,y,z-.13,[l,.065,.06],cadre,10,'traverse');
      biseau(x,y-h/2-.16,z-.13,[l+.38,.14,.32],cadre,3,'appui');
      if (volets) for(const cote of [-1,1]) {
        const ouverture=(.12+hasard(Math.round(x*41)+cote+81)*.35)*cote;
        biseau(x+cote*(l*.66+.12),y,z-.08,[l*.31,h+.12,.11],cadre,10,'volet',null,false,[0,-a+ouverture,0]);
      }
    }
    function pneus(x,z,n) {
      if(!detail)return;
      for(let k=0;k<n;k++)objet('ring',x,.26+k*.25,z,[.84,1.6,.84],noir,7,'pneus');
    }
    return {proche,loin,point,hasard,teinte,objet,boite,biseau,tube,auvent,numero,fenetre,pneus};
  }

  function stands(site, options = {}) {
    const t=chantier(site,'stands',options.detail!==false), {boite,biseau,tube,objet,auvent,numero,hasard,teinte}=t;
    const l=site.longueur||60,w=site.demiRoute,front=w+13,fond=front+12,n=6,pas=l/n,detail=options.detail!==false;
    const mur=teinte([.82,.80,.73],3), beton=[.57,.58,.56], equipe=[[.66,.12,.08],[.14,.32,.46],[.25,.40,.23],[.63,.46,.12]];
    // Une enveloppe faite de parois, planchers et séparations. Le rayon à hauteur de voiture entre
    // effectivement dans une baie ouverte ; le grand volume plein de l'ancien bâtiment n'existe plus.
    boite(0,4,fond-.18,[l,8,.36],mur,13.2,'mur-arriere','batiment',true);
    for(const cote of [-1,1])boite(cote*(l/2-.20),4,front+6,[.4,8,12],mur,13.2,'mur-lateral','batiment',true);
    boite(0,.11,front+6,[l,.22,12],beton,3,'dalle','batiment',true);
    boite(0,4.35,front+6,[l,.26,12],beton,3,'plancher-etage','batiment',true);
    boite(0,8.12,front+6,[l+1,.24,13],acier,24,'toiture','toit',true);
    boite(0,4.85,front-.04,[l,.72,.30],mur,13.2,'allege','batiment',true);
    boite(0,7.78,front-.04,[l,.40,.30],mur,13.2,'corniche','batiment',true);
    for(let j=0;j<=n;j++) {
      const x=-l/2+j*pas;
      if(j>0&&j<n)boite(x,2.1,front+6,[.22,4.2,11.65],beton,3,'separation','batiment',true);
      biseau(x,2.1,front,[.52,4.2,.48],beton,3,'pilastre','batiment',true);
      boite(x,6.35,front-.02,[.25,2.55,.38],mur,3,'pilier-etage','batiment',true);
      tube([x,.08,front-2.1],[x,3.69,front-2.1],.16,acier,0,'poteau-auvent','pilier',true);
      tube([x,3.68,front-2.1],[x,4.06,front+.3],.09,acier,0,'console-auvent');
    }
    for(let j=0;j<n;j++) {
      const x=-l/2+(j+.5)*pas, couleur=teinte(equipe[Math.floor(hasard(j+21)*equipe.length)],j+32), ouvert=hasard(j+51)>.28;
      boite(x,6.35,front-.025,[pas-.4,2.4,.18],vitre,7,'baie-etage','batiment',true);
      for(const dx of [-pas*.25,0,pas*.25])boite(x+dx,6.35,front-.15,[.09,2.4,.10],acier,0,'meneau');
      boite(x,6.35,front-.15,[pas-.4,.09,.10],acier,0,'traverse');
      auvent(x,3.7,front-1,pas-.08,2.8,teinte([.75,.76,.72],j+80),'toit');
      boite(x,4.05,front-.14,[pas-.48,.43,.20],couleur,24,'enseigne',null,true);
      // Un rideau relevé laisse une profondeur de douze mètres, limitée au fond par le mur réel.
      const hauteur=ouvert?.58:3.35,y=ouvert?3.5:1.78;
      boite(x,y,front-.06,[pas-.75,hauteur,.13],teinte([.35,.38,.39],j+11),24,'rideau','batiment',true);
      tube([x-pas*.44,3.84,front+.05],[x+pas*.44,3.84,front+.05],.25,acier,0,'tambour');
      if(detail) {
        numero(j+1,x,4.07,front-.27,.29);
        for(let k=0;k<(ouvert?2:8);k++)boite(x,y-hauteur/2+.12+k*(hauteur-.2)/(ouvert?2:8),front-.135,[pas-.9,.025,.026],[.17,.19,.20],0,'lame-rideau');
        if(ouvert) {
          const mobilierX=x+(hasard(j+121)-.5)*2, meubleZ=fond-2.1;
          biseau(mobilierX,.59,meubleZ,[2.15,1.12,.72],couleur,24,'servante');
          for(let k=0;k<3;k++)boite(mobilierX,.37+k*.26,meubleZ-.38,[1.82,.035,.05],acier,0,'tiroir');
          for(const cote of [-1,1])tube([mobilierX+cote*.8,.16,meubleZ-.3],[mobilierX+cote*.8,.16,meubleZ+.3],.23,noir,7,'roulettes');
          t.pneus(x-pas*.33,front+2.4,2+Math.floor(hasard(j+131)*3));
          objet('cylinder',x+pas*.29,.6,front+3.2,[.6,1.2,.6],couleur,24,'bidon');
          biseau(x+pas*.18,.10,front+1.1,[1.8,.12,2.6],[.18,.21,.22],7,'tapis');
          // Lampe d'atelier sous l'auvent, sans nouveau point lumineux ni coût par image.
          boite(x,3.58,front+.6,[2.7,.08,.18],[.83,.85,.72],16,'reglette');
        }
      }
    }
    // Chéneaux et descentes arrondis, ventilation décentrée : pas de motif copié en miroir.
    for(const z of [front-.38,fond+.38])tube([-l/2,8.08,z],[l/2,8.08,z],.16,acier,0,'cheneau',null,true);
    for(const x of [-l/2+.4,l/2-.4])tube([x,.3,front+.2],[x,7.94,front+.2],.13,acier,0,'descente',null,true);
    for(let k=0;k<3;k++) {
      const x=-l*.3+hasard(k+170)*l*.6,z=front+3+hasard(k+177)*5;
      biseau(x,8.58,z,[1.4,.65,1.15],acier,24,'extracteur',null,true);
      tube([x,8.7,z],[x,9.03,z],.55,acier,0,'ventilation',null,true);
    }
    // Même muret, même passage : la nouvelle architecture ne transforme pas l'espace derrière le mur
    // en seconde voie de service. Le pilote s'arrête toujours dans c.stands, sur le bord de la chaussée.
    boite(0,.55,w+MURET.recul,[l+30,1.1,MURET.epaisseur],[.82,.82,.8],3,'muret','muret',true);
    boite(0,1.2,w+MURET.recul,[l+30,.2,MURET.epaisseurLisse],[.86,.12,.08],16,'lisse-muret','muret',true);
    return { objets:t.proche, loin:t.loin };
  }

  function maison(site, options = {}) {
    const t=chantier(site,site.cabane?'commissaires':'maison',options.detail!==false), {boite,biseau,tube,objet,auvent,fenetre,hasard,teinte}=t;
    const l=site.l,w=site.w,h=site.h, a=site.a||0, detail=options.detail!==false;
    const bois=teinte(site.theme==='montagne'||site.theme==='baikal'?[.38,.25,.16]:[.58,.65,.58],14);
    if(!site.cabane) {
      // Les pignons ferment l'espace sous les deux pans existants, avec de vrais triangles.
      const base=site.baikal?.02+.55*Math.tan(.53):0,montee=site.baikal?w*.5*Math.tan(.53):w*.27;
      const teintePignon=site.baikal?[[.36,.24,.15],[.46,.31,.18],[.32,.30,.23]][site.variante||0]:site.enduit||[.8,.75,.66];
      if(base)boite(0,h+base/2,0,[l-.06,base,w],teintePignon,10,'haut-mur','batiment',true);
      for(const cote of [-1,1])objet('wedge',0,h+base+montee/2,cote*w*.25,[w*.5,montee,l-.06],teintePignon,site.baikal?10:13.2,'pignon','batiment',true,[0,-a-cote*Math.PI/2,0]);
    }
    for(const cote of [-1,1]) {
      const z=cote*(w*.5+.19);
      tube([-l*.5-.25,h+.02,z],[l*.5+.25,h+.02,z],.12,acier,0,'cheneau',null,true);
      if(detail)tube([l*.5-.15,.15,z],[l*.5-.15,h,z],.09,acier,0,'descente');
    }
    if(site.baikal) {
      biseau(-l*.22,6.45,0,[.85,.14,.95],[.29,.30,.29],3,'chapeau-cheminee',null,true);
    } else if(!site.cabane) {
      const x=l*(.12+hasard(31)*.22),z=(hasard(32)-.5)*w*.45;
      biseau(x,h+w*.16+.65,z,[.55,1.45,.7],[.39,.35,.29],3,'cheminee','batiment',true);
      biseau(x,h+w*.16+1.42,z,[.78,.14,.90],[.29,.30,.29],3,'chapeau-cheminee',null,true);
    }
    const porteX=site.cabane?l*.3:(hasard(48)-.5)*l*.26;
    if(detail) {
      if(!site.baikal)for(const x of (site.cabane?[-l*.22]:[-l*.29,l*.28]))fenetre(x,h*.57,-w/2-.07,site.cabane?.7:1.35,site.cabane?.8:1.5,bois,!site.cabane);
      // Porte décalée, imposte et poignée : aucune façade strictement dupliquée de sa voisine.
      const x=porteX,porte=site.cabane?.65:1.05,haut=Math.min(2.2,h*.86);
      biseau(x,haut/2,-w/2-.065,[porte+.2,haut+.18,.13],bois,10,'encadrement-porte');
      biseau(x,haut/2,-w/2-.15,[porte,haut,.075],[.19,.17,.13],10,'porte');
      tube([x+porte*.3,haut*.48,-w/2-.21],[x+porte*.3,haut*.59,-w/2-.21],.045,[.54,.47,.28],0,'poignee');
    }
    // Les volumes physiques ne dépendent jamais du palier de détail.
    if(!site.cabane) {
      const profondeur=1.55+hasard(52)*.35;
      const bas=Number.isFinite(site.bas)?Math.min(-.24,site.bas-site.sol):-.24;
      biseau(porteX,(bas+.18)/2,-w/2-.34,[2.4,.18-bas,.72],[.44,.43,.38],3,'perron','batiment');
      const marches=Math.max(1,Math.min(8,Math.ceil((.18-bas)/.28)));
      for(let k=0;k<marches;k++) {
        const haut=bas+(k+1)*(.18-bas)/marches;
        boite(porteX,(bas+haut)/2,-w/2-.68-(marches-1-k+.5)*.32,[2.15,haut-bas,.33],[.44,.43,.38],3,'marche','batiment');
      }
      for(const cote of [-1,1])tube([porteX+cote*1.02,bas,-w/2-1.35],[porteX+cote*1.02,2.5,-w/2-1.35],.14,bois,10,'poteau-porche','pilier');
      auvent(porteX,2.48,-w/2-.65,2.6,profondeur,options.neige?[.84,.87,.89]:bois,'toit');
    }
    return {objets:t.proche,loin:t.loin};
  }

  function voieService(c) {
    const S=c.stands; if(!S)return {objets:[],loin:[]};
    const objets=[],loin=[],couleur=[.95,.75,.20];
    function marque(s,d,longueur,largeur,partie) {
      const q=B.circuit.echantillon(c,s),a=q.cap;
      const o={shape:'box',p:[q.x-Math.sin(a)*d,q.y-d*Math.sin(q.devers)+.018,q.z+Math.cos(a)*d],
        s:[longueur,.018,largeur],r:[q.devers,-a,0],mat:16,color:couleur,architecture:'voie-service',partie};
      objets.push(o);loin.push(o);
    }
    // Jalons discontinus du côté intérieur, ouverts aux deux bouts. Aucun plot ne coupe la trajectoire.
    for(let s=S.debut+2;s<S.fin-3;s+=8)marque(s,S.d-S.demi+.14,3,.12,'ligne-voie');
    for(const s of [S.garage0,S.garage1])marque(s,S.d,.15,2*S.demi-.34,'limite-service');
    for(let s=S.garage0+4;s<S.garage1-3;s+=12) {
      marque(s,S.d,.16,Math.min(1.9,S.demi*1.4),'arret');
      marque(s-1.2,S.d-S.demi+.34,2.3,.12,'guide-arret');
      marque(s-1.2,S.d+S.demi-.34,2.3,.12,'guide-arret');
    }
    // Prévenir avant l'entrée, sans planter le poteau dans le dégagement que partage la voie avec la
    // chaussée. Toute la largeur du panneau reste derrière la face extérieure du muret, avec 20 cm de jeu.
    const q=B.circuit.echantillon(c,S.debut-8),w=c.largeur/2,largeurPanneau=1.3;
    const recul=Math.max(w,S.d+S.demi)+MURET.recul+MURET.epaisseurLisse/2+largeurPanneau/2+.2;
    const t=chantier({x:q.x-Math.sin(q.cap)*recul,z:q.z+Math.cos(q.cap)*recul,sol:q.y-w*Math.sin(q.devers),a:q.cap-Math.PI/2,graine:c.graine},'voie-service',true);
    t.tube([0,0,0],[0,2.4,0],.10,acier,0,'poteau-panneau','pilier',true);
    t.biseau(0,2.05,0,[largeurPanneau,1.25,.13],[.18,.25,.27],16,'panneau',null,true);
    // 40 km/h, arrondi du plafond de voie existant (11 m/s) ; aucun nouveau règlement.
    const kmh=Math.round(S.vitesse*3.6);t.numero(Math.floor(kmh/10),-.31,2.05,-.1,.42);t.numero(kmh%10,.31,2.05,-.1,.42);
    objets.push(...t.proche);loin.push(...t.loin);
    return {objets,loin};
  }
  B.batiments={stands,maison,voieService};
})(globalThis.BITUME=globalThis.BITUME||{});
