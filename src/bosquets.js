// Une instance opaque réunit cinq houppiers. Les modèles proche et lointain
// partagent les mêmes pieds, hauteurs et directions, y compris dans les glaces.
(function (B) {
  'use strict';
  const especes = {
    foret:             ['rond', 7.2, [.075,.175,.052]],
    cote:              ['rond', 5.4, [.105,.185,.068]],
    montagne:          ['sapin', 7.4, [.068,.155,.075]],
    marseille:         ['rond', 4.6, [.115,.185,.075]],
    corail:            ['rond', 5.2, [.075,.215,.082]],
    pacifique:         ['sapin', 13.5, [.062,.152,.082]],
    fjord:             ['sapin', 7.6, [.078,.168,.095]],
    'route-des-cimes': ['sapin', 7.8, [.068,.152,.078]],
    larche:            ['sapin', 8.6, [.064,.148,.075]],
    islande:           ['lande', .95, [.17,.20,.10]],
    sierra:            ['lande', 1.45, [.20,.21,.10]],
    desert:            ['lande', 1.15, [.22,.20,.11]],
    asie:              ['rond', 5.8, [.078,.195,.092]],
    baikal:            ['sapin', 8.2, [.072,.162,.098]],
    ovale:             ['rond', 5.6, [.095,.195,.070]],
  };
  // x, z, hauteur et rayon dans l'enveloppe normalisée, identique pour les deux LOD.
  const sujets = [[-.27,-.14,.72,.125],[.01,-.25,.84,.12],[.26,-.04,.62,.135],
    [-.15,.20,.96,.145],[.13,.22,.74,.13]];
  const VARIANTES = 16;
  function forme(espece, loin, variante) {
    const triangles = [];
    // Normales organiques lissées (sortantes + légèrement vers le ciel) autour du centre de chaque houppier :
    // supprime totalement l'aspect « cristal / diamant facetté » en gardant 5 arbres par instance GPU.
    function normaleDouce(p, cx, cy, cz, biaisHaut = .42) {
      let nx = p[0] - cx, ny = (p[1] - cy) * .7 + biaisHaut, nz = p[2] - cz;
      const l = Math.hypot(nx, ny, nz) || 1;
      return [nx / l, ny / l, nz / l];
    }
    function faceDouce(a, b, c, cx, cy, cz, biaisHaut) {
      triangles.push([a, b, c,
        normaleDouce(a, cx, cy, cz, biaisHaut),
        normaleDouce(b, cx, cy, cz, biaisHaut),
        normaleDouce(c, cx, cy, cz, biaisHaut)]);
    }
    function anneauIrregulier(x, z, y, r, pans, orientation, sel, irreg) {
      return Array.from({ length: pans }, (_, i) => {
        const a = i * 2 * Math.PI / pans + orientation;
        const m = 1 + (bruit(variante * 31 + sel, i * 17 + 3, 91) - .5) * irreg;
        const dy = (bruit(variante * 19 + sel, i * 23 + 7, 53) - .5) * r * .28;
        return [x + r * m * Math.cos(a), y + dy, z + r * m * Math.sin(a)];
      });
    }
    function lobe(cx, cy, cz, rx, ry, rz, pans, orientation, sel) {
      const bas = [cx, cy - ry * .78, cz];
      const haut = [cx + rx * .06 * Math.cos(orientation), cy + ry, cz + rz * .06 * Math.sin(orientation)];
      const eq = anneauIrregulier(cx, cz, cy - ry * .05, (rx + rz) * .5, pans, orientation, sel, .34);
      for (let i = 0; i < pans; i++) {
        const j = (i + 1) % pans;
        if (!loin) faceDouce(bas, eq[j], eq[i], cx, cy, cz, .22);
        faceDouce(eq[i], eq[j], haut, cx, cy, cz, .55);
      }
    }
    for (let sujet = 0; sujet < sujets.length; sujet++) {
      const [x, z, hauteur, rayonBase] = sujets[sujet];
      const orientation = bruit(variante, sujet, 17) * 2 * Math.PI;
      const echelle = .82 + .22 * bruit(variante, sujet, 63);
      const h = Math.min(.98, hauteur * echelle), rayon = rayonBase * echelle;
      if (espece === 'sapin') {
        // Conifère multi-étages léger (60 FPS) : 3 couronnes étagées proches / 2 au loin, normales douces.
        const etages = loin
          ? [[.18, .66, 1.05], [.52, .98, .62]]
          : [[.14, .48, 1.12], [.40, .74, .86], [.66, .99, .54]];
        const pans = loin ? 4 : 5;
        for (let e = 0; e < etages.length; e++) {
          const [y0, y1, fR] = etages[e];
          const rE = rayon * fR, yb = h * y0 - .5, yt = h * y1 - .5, ym = (yb + yt) * .5;
          const bord = anneauIrregulier(x, z, yb + (yt - yb) * .16, rE, pans, orientation + e * .78, sujet * 13 + e, .34);
          const sommet = [x + rE * .07 * Math.cos(orientation + e), yt, z + rE * .07 * Math.sin(orientation + e)];
          for (let i = 0; i < pans; i++) {
            const j = (i + 1) % pans;
            faceDouce(bord[i], sommet, bord[j], x, ym, z, .48);
          }
        }
      } else {
        // Feuillu / pin parasol léger : 2 lobes feuillus asymétriques (1 au loin), normales douces.
        const pans = loin ? 5 : 6;
        lobe(x, h * .56 - .5, z, rayon * 1.12, h * .38, rayon * 1.05, pans, orientation, sujet * 19 + 1);
        if (!loin) {
          const a1 = orientation + 1.4;
          lobe(x + Math.cos(a1) * rayon * .38, h * .64 - .5, z + Math.sin(a1) * rayon * .38,
            rayon * .80, h * .30, rayon * .76, 5, a1, sujet * 19 + 5);
        }
      }
    }
    return triangles;
  }
  // La lande utilise les variantes rondes, aplaties par la taille de l'instance.
  // Les formes sont disponibles au chargement pour la course et les rétroviseurs.
  const rendu = globalThis.FRender;
  if (rendu?.forme) for (const e of ['sapin','rond']) {
    for (let variante=0; variante<VARIANTES; variante++) for (const loin of [false,true]) {
      rendu.forme('bosquet-'+e+'-'+variante+(loin?'-loin':''),forme(e,loin,variante));
    }
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
  const coordonneesPose = new DataView(new ArrayBuffer(16));
  function bruitPose(graine, sel) {
    const fraction = bruit(coordonneesPose.getInt32(4),coordonneesPose.getInt32(12),graine^sel);
    return bruit(coordonneesPose.getInt32(0),coordonneesPose.getInt32(8),fraction*4294967296);
  }
  function instance(site, loin, p, largeur, h, axes, color, t, mat = 27) {
    const x=Math.floor(p[0]*100), z=Math.floor(p[2]*100);
    const variante=Math.floor(bruit(x,z,t*4294967296)*VARIANTES);
    const shape=site.forme+'-'+variante+(loin?'-loin':'');
    // Utiliser les deux mots de chaque coordonnée, y compris pour des centres très proches.
    coordonneesPose.setFloat64(0,p[0]);
    coordonneesPose.setFloat64(8,p[2]);
    const angle=bruitPose(site.graine,0x9e3779b9)*2*Math.PI;
    const echelle=.84+.16*bruitPose(site.graine,0x85ebca6b);
    const cos=Math.cos(angle), sin=Math.sin(angle);
    const [axeX,axeY,axeZ]=axes;
    const tourneX=axeX.map((v,i)=>v*cos+axeZ[i]*sin);
    const tourneZ=axeZ.map((v,i)=>v*cos-axeX[i]*sin);
    const largeurLocale=largeur*echelle;
    const profondeur=largeurLocale*(.78+.22*t);
    return {shape,p,r:B.decor.angles(tourneX,axeY,tourneZ),s:[largeurLocale,h,profondeur],color,mat};
  }
  function ajouterInstance(lot, site, leger, x, z, t, p, largeur, h, axes, loinSeul = false) {
    const teinte=site.couleur.map(v=>v*(.74+.42*t));
    const color=site.saison ? B.saisons.teinte(site.saison,site.genre==='lande'?'herbe':'feuillage-persistant',teinte,x,z) : teinte;
    const o=instance(site,leger||loinSeul,p,largeur,h,axes,color,t,leger?11:27);
    if (loinSeul) { lot.loin.push(o); return; }
    lot.objets.push(o);
    // En Légère, le modèle unique est déjà le lointain.
    if (!leger) lot.loin.push({...o,shape:o.shape+'-loin'});
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
    const lot={objets:[],loin:[],centre:[0,0,0],rayon:0,portee:Infinity,bascule:75,
      lodReferenceFov:60,lodReferenceHeight:1080,arbres:true,bosquets:true};
    const groupe={lot,semis:progressif?[]:null,largeurs:progressif?null:[]};
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
      const palette={ genre,couleur,graine:c.graine | 0,forme:'bosquet-'+(genre==='lande'?'rond':genre),
        saison:theme===c.theme || !saison ? saison : B.saisons.profil(saison.id,theme) };
      return {genre,hauteur,palette,indice:palettes.push(palette)-1,
        ecologie:theme===c.theme ? ecologie : B.ecologie?.creer(c.graine,theme)};
    }
    const principal=milieu(c.id,c.theme);
    const troncons=(c.tronconsThemes || []).map(t=>({debut:t.debut,fin:t.fin,milieu:milieu(t.id,t.theme)}));
    if (!principal && !troncons.some(t=>t.milieu)) return [];
    const leger=qualite==='low', dense=qualite==='ultra';
    // Lot H : forêts et lisières denses multi-échelles (1 instance = 5 houppiers -> coût GPU tenu à 60 FPS).
    const pas=leger?39:qualite==='medium'?7:dense?3:4;
    const cinema=options&&options.decorCinema===true;
    const quota=cinema?Math.max(2,Math.ceil((leger?2:qualite==='medium'?16:dense?42:28)*.55)):(leger?2:qualite==='medium'?16:dense?42:28);
    const porteeAxe=cinema?95:(leger?240:360);
    const margeRoute=leger?27:22;
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
        const q=interroger.dansRayon ? interroger.dansRayon(x,z,porteeAxe,voisin) : interroger(x,z,porteeAxe,true);
        if(q.i<0 || q.d<c.largeur/2+margeRoute || q.d>porteeAxe) continue;
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
        const rayon=Math.min(genre==='lande'?3.8:9.2,Math.abs(det)/(2.5*Math.max(Math.hypot(ux,uz),Math.hypot(vx,vz),Math.hypot(vx-ux,vz-uz))));
        if (!(rayon>1.3) || q.d<c.largeur/2+margeRoute+rayon || occupe(x,z,rayon)) continue;
        if(Math.abs(B.circuit.ecart(c,0,s))<(leger?320:185) && q.d<(leger?100:34)) continue;
        if(c.id==='marseille') {
          const cote=-(x-c.x[q.i])*Math.sin(c.cap[q.i])+(z-c.z[q.i])*Math.cos(c.cap[q.i]);
          // Les quais et les plages restent dégagés. La garrigue et les pins habillent le flanc terrestre.
          if(s<180 || cote>-22 || y<4) continue;
        }
        if (foret && genre==='lande' && t>couvert*.56) continue;
        if (!foret) {
          const richesse=site.ecologie?.echantillonner(x,z,habitat).boisement;
          const seuilR=leger?.09:.03;
          const prob=leger ? richesse*(genre==='lande'?.56:1) : Math.min(.92, richesse*(genre==='lande'?.85:1.55) + .22);
          if (!(richesse>seuilR) || t>prob) continue;
        }
        const uy=V[b+1]-V[a+1],vy=V[d+1]-V[a+1];
        const dx=(uy*vz-vy*uz)/det,dz=(ux*vy-vx*uy)/det;
        const penteMax = leger ? (genre==='lande' ? .34 : .24) : (genre==='lande' ? .58 : .54);
        if(Math.hypot(dx,dz)>penteMax) continue;
        const cap=bruit(ix,iz,c.graine+17)*Math.PI*2,cos=Math.cos(cap),sin=Math.sin(cap);
        const h=hauteur*(.68+.62*bruit(ix,iz,c.graine+63));
        // Inclure le déport horizontal du sommet lorsque le groupe suit la pente.
        const largeur=Math.min(Math.max(2.6, (rayon-h*Math.hypot(dx,dz)*.45)*2.15),genre==='lande'?5.6:18);
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
        } else {
          ajouterInstance(lot,site.palette,leger,x,z,t,p,largeur,h,axes);
          groupe.largeurs.push(largeur);
        }
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
        // Garder l’enveloppe du semis progressif avant la variation d’échelle.
        for (let k=0;k<n;k++) {
          const o=l.objets[k], largeur=groupe.largeurs[k];
          l.rayon=Math.max(l.rayon,Math.hypot(o.p[0]-l.centre[0],o.p[1]-l.centre[1],o.p[2]-l.centre[2])+Math.hypot(largeur,o.s[1],largeur)/2);
        }
      }
      resultat.push(l);
    }
    return resultat;
  }
  B.bosquets={construire};
})(globalThis.BITUME=globalThis.BITUME||{});
