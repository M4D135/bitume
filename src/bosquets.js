// Une instance opaque réunit cinq houppiers. Les modèles proche et lointain
// partagent les mêmes pieds, hauteurs et directions, y compris dans les glaces.
(function (B) {
  'use strict';
  const especes = {
    foret:       ['rond', 5.6, [.14,.27,.11]],
    marseille:         ['rond', 2.8, [.22,.30,.15]],
    corail:            ['rond', 4.2, [.13,.34,.15]],
    pacifique:     ['sapin', 11, [.12,.25,.17]],
    fjord:             ['sapin', 6.4, [.16,.28,.20]],
    'route-des-cimes': ['sapin', 6.5, [.14,.25,.16]],
    larche:            ['sapin', 7.8, [.12,.24,.15]],
    islande:     ['lande', .72, [.30,.34,.20]],
    sierra:            ['lande', 1.15, [.35,.35,.21]],
    asie:   ['rond', 4.7, [.15,.31,.16]],
    baikal:            ['sapin', 7.4, [.14,.27,.20]],
  };
  // x, z, hauteur et rayon dans l'enveloppe normalisée, identique pour les deux LOD.
  const sujets = [[-.27,-.14,.72,.125],[.01,-.25,.84,.12],[.26,-.04,.62,.135],
    [-.15,.20,.96,.145],[.13,.22,.74,.13]];
  function forme(espece, loin) {
    const triangles = [], pans = loin ? 4 : 6;
    function face(a,b,c) {
      const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
      const vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
      const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
      const l=Math.hypot(...n), normale=n.map(v=>v/l);
      triangles.push([a,b,c,normale,normale,normale]);
    }
    for (const [x,z,h,rayon] of sujets) {
      const col = espece === 'sapin' ? .24 : .42;
      const anneau = (y,r) => Array.from({length:pans}, (_,i) => {
        const a = i * 2 * Math.PI / pans + x * 4;
        return [x+r*Math.cos(a), h*y-.5, z+r*Math.sin(a)];
      });
      const base = anneau(0,rayon*.22), large = anneau(col,rayon);
      const flanc = (bas,haut) => {
        for (let i=0;i<pans;i++) {
          const j=(i+1)%pans;
          face(bas[i],haut[i],haut[j]); face(bas[i],haut[j],bas[j]);
        }
      };
      if (loin) {
        const pied=[x,-.5,z];
        for(let i=0;i<pans;i++) face(pied,large[i],large[(i+1)%pans]);
      } else flanc(base,large);
      let sommet=large;
      if (!loin) {
        sommet=anneau(.71,rayon*(espece==='sapin' ? .48 : .86));
        flanc(large,sommet);
      }
      const pointe=[x+rayon*.07,h-.5,z-rayon*.12];
      for (let i=0;i<pans;i++) face(sommet[i],pointe,sommet[(i+1)%pans]);
    }
    return triangles;
  }
  // La silhouette de la lande utilise le houppier rond, aplati par la taille
  // de l'instance. Les quatre formes communes sont inscrites au chargement du
  // module, avant la création des moteurs de la course et des rétroviseurs.
  const rendu = globalThis.FRender;
  if (rendu?.forme) for (const e of ['sapin','rond']) for (const loin of [false,true]) {
    rendu.forme('bosquet-'+e+(loin?'-loin':''),forme(e,loin));
  }

  const MAILLE = 16, cle = (i,j) => (i+1048576)*2097152+j+1048576;
  const MATIERES_PROTEGEES = new Set([9,12,13,22,23]);
  function zonesProtegees(lots,terrain) {
    const cases = new Set();
    function masquer(x0,z0,x1,z1) {
      for (let i=Math.floor(x0/MAILLE);i<=Math.floor(x1/MAILLE);i++)
        for (let j=Math.floor(z0/MAILLE);j<=Math.floor(z1/MAILLE);j++) cases.add(cle(i,j));
    }
    for (const l of lots) for (const o of l.objets) {
      const mat=Math.floor(o.mat || 0);
      if (o.trianglesMasque) {
        // Un îlot peut réunir plusieurs bâtiments. Seules leurs emprises
        // ferment les clairières et les jardins entre les façades.
        for(const [a,b,c] of o.trianglesMasque) masquer(Math.min(a[0],b[0],c[0])-4,Math.min(a[2],b[2],c[2])-4,
          Math.max(a[0],b[0],c[0])+4,Math.max(a[2],b[2],c[2])+4);
        continue;
      }
      if (o.collision==='tronc' || o.partieArbre) continue;
      if (!o.collision && !o.solidePhysX && !o.masqueHerbier && !MATIERES_PROTEGEES.has(mat)) continue;
      // Comprend aussi les auvents, les quartiers et objets d'eau sans solide.
      const [x,,z]=o.p, rayon=Math.hypot(...(o.s || [1,1,1]))/2+4;
      masquer(x-rayon,z-rayon,x+rayon,z+rayon);
    }
    // La mer et les grands lacs plans sont déjà bornés par niveauEau. La Stura
    // et la Maddalena ont leurs propres contours, sans plan d'eau global.
    for (const n of terrain.liste) {
      if (n.surfaceType!=='eau' || (Number.isFinite(terrain.niveauEau) && n !== terrain.lagon?.eau)) continue;
      const V=n.sommets,I=n.indices;
      for (let k=0;k<I.length;k+=3) {
        const a=I[k]*13,b=I[k+1]*13,c=I[k+2]*13;
        masquer(Math.min(V[a],V[b],V[c]),Math.min(V[a+2],V[b+2],V[c+2]),
          Math.max(V[a],V[b],V[c]),Math.max(V[a+2],V[b+2],V[c+2]));
      }
    }
    return (x,z,r) => {
      for(let i=Math.floor((x-r)/MAILLE);i<=Math.floor((x+r)/MAILLE);i++)
        for(let j=Math.floor((z-r)/MAILLE);j<=Math.floor((z+r)/MAILLE);j++) if(cases.has(cle(i,j))) return true;
      return false;
    };
  }

  // Graine spatiale indépendante des bâtiments, des obstacles et de la course.
  function bruit(x,z,g) {
    let v=Math.imul(x,73856093)^Math.imul(z,19349663)^g;
    v=Math.imul(v^(v>>>15),2246822519);
    return ((v^(v>>>13))>>>0)/4294967296;
  }
  function foretStura() {
    const d=B.larcheData?.reliefVallee?.couverture;
    if (!d) return () => 0;
    const fractions=B.larcheRelief?.fractionsCouverture?.(d)
      || Uint8Array.from(atob(d.fractionsU8),b=>b.charCodeAt(0));
    // Proportions mesurées ESA 2021 dans les coordonnées locales du terrain.
    return (x,z) => {
      const u=(x-d.x0)/d.pas,v=(z-d.z0)/d.pas,i=Math.floor(u),j=Math.floor(v);
      if(i<0 || j<0 || i+1>=d.nx || j+1>=d.nz) return 0;
      const a=u-i,b=v-j,k=3*(j*d.nx+i),ligne=3*d.nx;
      return ((1-b)*((1-a)*fractions[k]+a*fractions[k+3])+
        b*((1-a)*fractions[k+ligne]+a*fractions[k+ligne+3]))/255;
    };
  }
  function instance(site, loin, p, largeur, h, axes, color, t) {
    const profondeur=largeur*(.78+.22*t);
    return {shape:loin?site.forme+'-loin':site.forme,p,r:B.decor.angles(...axes),s:[largeur,h,profondeur],color,mat:11};
  }
  function ajouterInstance(lot, site, leger, x, z, t, p, largeur, h, axes, loinSeul = false) {
    const teinte=site.couleur.map(v=>v*(.83+.28*t));
    const color=site.saison ? B.saisons.teinte(site.saison,site.genre==='lande'?'herbe':'feuillage-persistant',teinte,x,z) : teinte;
    const o=instance(site,leger||loinSeul,p,largeur,h,axes,color,t);
    if (loinSeul) { lot.loin.push(o); return; }
    lot.objets.push(o);
    // En Légère, le modèle unique est déjà le lointain.
    if (!leger) lot.loin.push({...o,shape:site.forme+'-loin'});
  }

  // Une graine conserve le centre exact et les bases numériques. Le terrain,
  // les triangles et l'index d'axe ne sont pas retenus par la préparation d'une case.
  // Centre XYZ, largeur, hauteur, site XZ, nuance, indice de palette, puis les trois axes XYZ.
  const PAS_SEMIS = 18;
  function lireSemis(semis, palettes, leger, lot, ombres, loinSeul = false) {
    const axes=[[0,0,0],[0,0,0],[0,0,0]];
    for (let k=0; k<semis.length; k+=PAS_SEMIS) {
      for (let j=0; j<3; j++) {
        const a=k+9+j*3;
        axes[j][0]=semis[a]; axes[j][1]=semis[a+1]; axes[j][2]=semis[a+2];
      }
      const p=[semis[k],semis[k+1],semis[k+2]], site=palettes[semis[k+8]];
      if (ombres) ombres.push(instance(site,true,p,semis[k+3],semis[k+4],axes,site.couleur,semis[k+7]));
      else ajouterInstance(lot,site,leger,semis[k+5],semis[k+6],semis[k+7],p,semis[k+3],semis[k+4],axes,loinSeul);
    }
  }
  function nouveauGroupe(progressif, leger, palettes) {
    const lot={objets:[],loin:[],centre:[0,0,0],rayon:0,portee:Infinity,bascule:90,
      lodReferenceFov:60,lodReferenceHeight:1080,arbres:true,bosquets:true};
    const groupe={lot,semis:progressif?[]:null};
    if (progressif) {
      lot.detailLointain=!leger;
      // Une copie superficielle de ce descripteur garde ces deux tableaux et
      // la même préparation. Chaque contexte reste propriétaire de son tampon GPU.
      lot.preparerLoin = () => {
        if (!leger && groupe.semis) {
          try { lireSemis(groupe.semis,palettes,false,lot,null,true); }
          catch (e) { lot.loin.length=0; throw e; }
          groupe.semis=null;
        }
        return lot.loin;
      };
      lot.preparerDetail = () => {
        if (lot.objets.length) return lot;
        if (lot.loin.length) {
          // Les deux LOD partagent le même semis, la même pose et la même palette.
          for (const o of lot.loin) lot.objets.push({...o,shape:o.shape.slice(0,-'-loin'.length)});
        } else if (groupe.semis) {
          try { lireSemis(groupe.semis,palettes,leger,lot,null); }
          catch (e) { lot.objets.length=lot.loin.length=0; throw e; }
          groupe.semis=null;
        }
        return lot;
      };
      // La carte d'ombre en photo n'utilise que la silhouette opaque lointaine.
      // Aucune rotation ni palette complète n'est conservée après cette passe.
      lot.objetsOmbreLointaine = () => {
        if (lot.loin.length || !groupe.semis) return leger ? lot.objets : lot.loin;
        const ombres=[];
        lireSemis(groupe.semis,palettes,leger,null,ombres);
        return ombres;
      };
    }
    return groupe;
  }

  function construire(c, terrain, lots, interroger, ecologie, saison, qualite, options) {
    if (qualite==='off') return [];
    const progressif=options?.progressif===true, palettes=[];
    function milieu(id,theme) {
      const espece=especes[id] || especes[theme];
      if (!espece) return null;
      const [genre,hauteur,couleur]=espece;
      const palette={ genre,couleur,forme:'bosquet-'+(genre==='lande'?'rond':genre),
        saison:theme===c.theme || !saison ? saison : B.saisons.profil(saison.id,theme) };
      return {genre,hauteur,palette,indice:palettes.push(palette)-1,
        ecologie:theme===c.theme ? ecologie : B.ecologie?.creer(c.graine,theme)};
    }
    const principal=milieu(c.id,c.theme);
    const troncons=(c.tronconsThemes || []).map(t=>({debut:t.debut,fin:t.fin,milieu:milieu(t.id,t.theme)}));
    if (!principal && !troncons.some(t=>t.milieu)) return [];
    const leger=qualite==='low', dense=qualite==='ultra';
    const pas=leger?39:qualite==='medium'?19:dense?7:11;
    const quota=leger?2:qualite==='medium'?5:dense?14:9;
    const secteurs=new Uint8Array(Math.ceil(c.longueur/100)+1), groupes=new Map();
    const occupe=zonesProtegees(lots,terrain), foret=c.id==='larche'?foretStura():null;
    const habitat={}, normal=[0,1,0], voisin={i:-1,d:Infinity};
    for (const n of terrain.liste) {
      const herbe=n.herbeTriangles;
      if(n.surfaceType!=='terrain' || !herbe?.length) continue;
      const V=n.sommets,I=n.indices;
      // Dans une nappe petite ou isolée, examiner au moins un triangle disponible.
      const premier=Math.floor(bruit(Math.round(n.centre[0]),Math.round(n.centre[2]),c.graine)*Math.min(pas,herbe.length));
      for(let k=premier;k<herbe.length;k+=pas) {
        const offset=herbe[k],a=I[offset]*13,b=I[offset+1]*13,d=I[offset+2]*13;
        const x=(V[a]+V[b]+V[d])/3, y=(V[a+1]+V[b+1]+V[d+1])/3, z=(V[a+2]+V[b+2]+V[d+2])/3;
        const ix=Math.floor(x),iz=Math.floor(z),t=bruit(ix,iz,c.graine);
        if (Number.isFinite(terrain.niveauEau) && y<terrain.niveauEau+3) continue;
        // À Larche la couverture forestière provient de la carte ESA, indépendamment
        // de l'axe et de la pente. Ces refus n'ont besoin d'aucune recherche routière.
        const couvert=foret ? foret(x,z) : 0;
        if (foret && (!(couvert>.29) || t>couvert)) continue;
        const q=interroger.dansRayon ? interroger.dansRayon(x,z,240,voisin) : interroger(x,z,240,true);
        if(q.i<0 || q.d<c.largeur/2+27 || q.d>240) continue;
        const s=q.i*c.pas, secteur=Math.floor(s/100);
        if(secteurs[secteur]>=quota || B.circuit.dansCouvert?.(c,s,24)) continue;
        // Au raccord, la borne de début appartient au nouveau thème. Un domaine
        // qui traverse la ligne accepte les abscisses des deux côtés de zéro.
        const section=troncons.length && troncons.find(t=>t.debut<=t.fin ? s>=t.debut && s<t.fin : s>=t.debut || s<t.fin);
        const site=section ? section.milieu : principal;
        if(!site) continue;
        const {genre,hauteur}=site;
        // Le disque de tous les houppiers tient dans le triangle de terrain.
        const ux=V[b]-V[a], uz=V[b+2]-V[a+2], vx=V[d]-V[a], vz=V[d+2]-V[a+2];
        const det=ux*vz-uz*vx;
        const rayon=Math.min(genre==='lande'?3.2:7.8,Math.abs(det)/(3*Math.max(Math.hypot(ux,uz),Math.hypot(vx,vz),Math.hypot(vx-ux,vz-uz))));
        if (!(rayon>1.3) || q.d<c.largeur/2+27+rayon || occupe(x,z,rayon)) continue;
        if(Math.abs(B.circuit.ecart(c,0,s))<320 && q.d<100) continue;
        if(c.id==='marseille') {
          const cote=-(x-c.x[q.i])*Math.sin(c.cap[q.i])+(z-c.z[q.i])*Math.cos(c.cap[q.i]);
          // Les quais et les plages restent dégagés. La garrigue commence sur
          // le flanc terrestre, derrière la première ligne bâtie de la Corniche.
          if(s<1250 || cote>-70 || y<8) continue;
        }
        if (foret && genre==='lande' && t>couvert*.56) continue;
        if (!foret) {
          const richesse=site.ecologie?.echantillonner(x,z,habitat).boisement;
          if (!(richesse>.09) || t>richesse*(genre==='lande' ? .56 : 1)) continue;
        }
        const uy=V[b+1]-V[a+1],vy=V[d+1]-V[a+1];
        const dx=(uy*vz-vy*uz)/det,dz=(ux*vy-vx*uy)/det;
        if(Math.hypot(dx,dz)>(genre==='lande' ? .34 : .24)) continue;
        const cap=bruit(ix,iz,c.graine+17)*Math.PI*2,cos=Math.cos(cap),sin=Math.sin(cap);
        const h=hauteur*(.77+.39*bruit(ix,iz,c.graine+63));
        // Inclure le déport horizontal du sommet lorsque le groupe suit la pente.
        const largeur=Math.min((rayon-h*Math.hypot(dx,dz))*1.95,genre==='lande'?4.8:15);
        if(largeur<2.1) continue;
        normal[0]=-dx; normal[2]=-dz;
        const axes=B.decor.base([cos,dx*cos+dz*sin,sin],normal);
        const p=[x+axes[1][0]*h*.5,y+axes[1][1]*h*.5-.08,z+axes[1][2]*h*.5];
        const i=Math.floor(x/100), j=Math.floor(z/100), key=cle(i,j);
        let groupe=groupes.get(key);
        if(!groupe) groupes.set(key,groupe=nouveauGroupe(progressif,leger,palettes));
        const lot=groupe.lot;
        if (progressif) {
          groupe.semis.push(p[0],p[1],p[2],largeur,h,x,z,t,site.indice);
          for (const axe of axes) groupe.semis.push(axe[0],axe[1],axe[2]);
        } else ajouterInstance(lot,site.palette,leger,x,z,t,p,largeur,h,axes);
        for(let axe=0;axe<3;axe++) lot.centre[axe]+=p[axe];
        secteurs[secteur]++;
      }
    }
    const resultat=[];
    for (const groupe of groupes.values()) {
      const l=groupe.lot;
      // Même moyenne et même sphère dans le même ordre : la distance de bascule
      // reste exacte même si la première vue à atteindre le lot est une glace.
      const n=progressif ? groupe.semis.length/PAS_SEMIS : l.objets.length;
      for (let k=0;k<3;k++) l.centre[k]/=n;
      if (progressif) {
        const g=groupe.semis=Float64Array.from(groupe.semis);
        for (let k=0;k<g.length;k+=PAS_SEMIS)
          l.rayon=Math.max(l.rayon,Math.hypot(g[k]-l.centre[0],g[k+1]-l.centre[1],g[k+2]-l.centre[2])+Math.hypot(g[k+3],g[k+4],g[k+3])/2);
      } else {
        // Garder l’enveloppe maximale employée par le semis progressif.
        for (const o of l.objets) l.rayon=Math.max(l.rayon,Math.hypot(o.p[0]-l.centre[0],o.p[1]-l.centre[1],o.p[2]-l.centre[2])+Math.hypot(o.s[0],o.s[1],o.s[0])/2);
      }
      resultat.push(l);
    }
    return resultat;
  }
  B.bosquets={construire};
})(globalThis.BITUME=globalThis.BITUME||{});
