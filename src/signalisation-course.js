/* BITUME — rubans de virage et bandeaux des portiques. Les géométries restent visuelles. */
(function (B) {
  'use strict';
  const LED_COUNT = 12, MAILLE = 128, PORTEE = 355, HAUTEUR = 2.85;
  const COLONNES = 19, LIGNES = 11;
  const FORME = 'bitume-ruban-chevron';
  const modulo = (x, longueur) => ((x % longueur) + longueur) % longueur;
  const cleCase = (x, z) => x * 65536 + z;

  // Flèche monobloc fermée. Son X local indique toujours le sens de circulation.
  function formeChevron() {
    const contour = [[-.5,-.5],[-.12,-.5],[.5,0],[-.12,.5],[-.5,.5],[.12,0]];
    const triangles = [];
    for (const z of [-.5,.5]) {
      const points = contour.map(([x,y]) => [x,y,z]), n = [0,0,Math.sign(z)];
      for (const [a,b,c] of [[0,1,5],[1,2,5],[5,2,3],[5,3,4]])
        triangles.push(z > 0 ? [points[a],points[b],points[c],n,n,n] : [points[c],points[b],points[a],n,n,n]);
    }
    for (let i=0; i<contour.length; i++) {
      const [x,y]=contour[i], [u,v]=contour[(i+1)%contour.length], l=Math.hypot(u-x,v-y);
      const n=[(v-y)/l,(x-u)/l,0], a=[x,y,-.5], b=[u,v,-.5], c=[u,v,.5], d=[x,y,.5];
      triangles.push([a,b,c,n,n,n],[a,c,d,n,n,n]);
    }
    return triangles;
  }
  // Un même atlas de triangles pour tous les rubans. Les LED éteintes appartiennent à
  // la dalle, les LED chaudes à la flèche. Aucune diode ne devient un objet de la scène.
  function formeMatrice(phase) {
    const allumee = phase >= 0;
    const triangles = [];
    function face(x, y, largeur, hauteur, z, normale) {
      const a = [x-largeur/2,y-hauteur/2,z], b = [x+largeur/2,y-hauteur/2,z];
      const c = [x+largeur/2,y+hauteur/2,z], d = [x-largeur/2,y+hauteur/2,z];
      const n = normale;
      if (z > 0) triangles.push([a,b,c,n,n,n],[a,c,d,n,n,n]);
      else triangles.push([c,b,a,n,n,n],[d,c,a,n,n,n]);
    }
    for (const cote of [-1,1]) {
      const normale = [0,0,cote];
      if (!allumee) face(0,0,1.025,1,cote*.40,normale);
      // Le ruban possède un dos opaque ; seules les LED tournées vers la voie sont visibles.
      if (cote < 0) continue;
      for (let j=0; j<LIGNES; j++) for (let i=0; i<COLONNES; i++) {
        const x=(i+.5)/COLONNES-.5, y=(j+.5)/LIGNES-.5;
        // La pointe et les deux bras d'un chevron à l'intérieur de la grille entière.
        const pointe=.47-1.10*Math.abs(y);
        const colonne = modulo(i-phase, COLONNES);
        const motif = (colonne+.5)/COLONNES-.5;
        if (allumee && (Math.abs(y)>.46 || motif>pointe || motif<pointe-.37)) continue;
        face(x,y,.76/COLONNES,.75/LIGNES,cote*.49,allumee ? normale : [0,.83,cote*.56]);
      }
    }
    return triangles;
  }
  const phasesLED = Array.from({length: COLONNES}, (_, i) => 'bitume-ruban-led-'+i);
  const renderer = globalThis.FRender || globalThis.window?.FRender;
  if (renderer?.forme) {
    renderer.forme(FORME, formeChevron());
    phasesLED.forEach((nom, i) => renderer.forme(nom, formeMatrice(i)));
    renderer.forme('bitume-ruban-grille', formeMatrice(-1));
  }

  function planGeometrique(c) {
    // Le profil de conduite lisse la courbure. Sur une trace GPS, un virage doux peut
    // donc commencer quelques échantillons avant son annonce. Relire les deux cordes.
    const courbure = new Float32Array(c.n);
    for (let i = c.ouvert ? 1 : 0; i < c.n - (c.ouvert ? 1 : 0); i++) {
      const a = (i+c.n-1)%c.n, b = (i+1)%c.n;
      const ux=c.x[i]-c.x[a], uz=c.z[i]-c.z[a], vx=c.x[b]-c.x[i], vz=c.z[b]-c.z[i];
      const longueur=(Math.hypot(ux,uz)+Math.hypot(vx,vz))*.5;
      if (longueur>.001) courbure[i]=Math.atan2(ux*vz-uz*vx,ux*vx+uz*vz)/longueur;
    }
    return B.virages.planifier({ ...c, courbure });
  }

  function viragesDuRuban(c) {
    const finCourse = c.ouvert ? (c.arrivee || c.longueur) : c.longueur;
    const n = Math.min(c.ouvert ? c.n-1 : c.n, Math.ceil(finCourse/c.pas));
    const sens = new Int8Array(n), niveaux = new Uint8Array(n);
    // Inclure les courbes douces qui changent réellement le cap mais n'exigent pas d'annonce de freinage.
    for (let i=0; i<n; i++) if (Math.abs(c.courbure[i]) > 1/3000) sens[i] = Math.sign(c.courbure[i]);
    const plans = B.virages ? [...planGeometrique(c), ...B.virages.planifier(c)] : [];
    for (const v of plans) {
      const debut = Math.round(v.debut/c.pas), fin = Math.ceil((v.debut+v.longueur)/c.pas-1e-8);
      for (let j=debut; j<fin; j++) { const i=j%n; sens[i]=v.sens; niveaux[i]=v.difficulte; }
    }
    let depart = 0;
    if (!c.ouvert && n) {
      // Dérouler depuis un vrai changement de signe, même si le virage coupe la ligne de départ.
      while (depart<n && sens[depart]===sens[(depart+n-1)%n]) depart++;
      if (depart===n) depart=0;
    }
    const rubans = [];
    for (let j=depart; j<depart+n;) {
      const premier=j, signe=sens[j%n]; let angle=0, difficulte=0;
      do { const i=j%n; angle+=Math.abs(c.courbure[i])*c.pas; difficulte=Math.max(difficulte,niveaux[i]);j++; }
      while (j<depart+n && sens[j%n]===signe);
      const s0=(premier%n)*c.pas, s1=c.ouvert?Math.min(j*c.pas,finCourse):s0+(j-premier)*c.pas;
      if (signe && (difficulte || (s1-s0>=8 && angle>=.04))) {
        rubans.push({debut:s0,fin:s1,longueur:s1-s0,sens:signe,difficulte:difficulte||1,points:[]});
      }
    }
    return rubans;
  }

  function ancre(c, decor, limites, s, sens) {
    const q=B.circuit.echantillon(c,s), i=Math.min(c.n-1,Math.floor(modulo(s,c.longueur)/c.pas));
    const j=c.ouvert?Math.min(c.n-1,i+1):(i+1)%c.n, f=modulo(s,c.longueur)/c.pas-i;
    const ext=-sens, bords=ext<0?limites?.G:limites?.D;
    const largeur=B.circuit.largeurA(c,s,ext), rail=bords?bords[i]+(bords[j]-bords[i])*f:largeur+3;
    const ouvrage=B.couverts?.segment(c,s) || null;
    const latMur=ouvrage && Number.isFinite(ouvrage.mur) ? ouvrage.mur-.68 : null;
    const lat=ext*(latMur===null?Math.max(largeur+.9,rail+.85):Math.max(largeur+.3,latMur));
    const x=q.x-Math.sin(q.cap)*lat, z=q.z+Math.cos(q.cap)*lat;
    const route=q.y-Math.sin(q.devers||0)*ext*largeur;
    const sol=latMur===null && typeof decor?.sol==='function'?decor.sol(x,z):route;
    const y=Math.max(route+1.08,Number.isFinite(sol)?sol+.14:route+1.08)+HAUTEUR/2;
    return {s,x,y,z,lat};
  }

  function objet(shape, mat, couleur) {
    return {shape,p:[0,0,0],s:[1,1,1],r:[0,0,0],mat,color:couleur,emissive:0};
  }

  function creer(circuit, decor) {
    const rubans = [], cases = new Map(), bandeaux = [], objets = [], panneaux = [];
    const etat={rubans,cases,panneaux,chevrons:panneaux,bandeaux,portique:bandeaux,objets};
    if (!circuit?.n) return etat;
    const limites=B.decor?.limites(circuit);
    let places=0;
    for (const v of viragesDuRuban(circuit)) {
      const index=rubans.push(v)-1;
      // Un module d'environ 5 m épouse l'épingle et reste lisible de l'autre côté d'une longue courbe.
      const nombre=Math.max(2,Math.ceil(v.longueur/5.05));
      for (let i=0;i<=nombre;i++) v.points.push(ancre(circuit,decor,limites,v.debut+v.longueur*i/nombre,v.sens));
      for (let i=0;i<nombre;i++) {
        const a=v.points[i], b=v.points[i+1], dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
        const horizontal=Math.hypot(dx,dz), longueur=Math.hypot(horizontal,dy);
        if (horizontal<.01) continue;
        const x=(a.x+b.x)/2, z=(a.z+b.z)/2;
        const axes=B.decor.base([dx,dy,dz],[0,1,0]);
        const r = B.decor.angles(...axes);
        const face = v.sens>0 ? r : [r[0]+Math.PI,r[1],r[2]];
        const module={a,dx,dy,dz,x,z,longueur,r,face,index,i,nombre,
          faceX:-v.sens*dz/horizontal,faceZ:v.sens*dx/horizontal};
        const rayon=PORTEE+horizontal/2;
        for (let cx=Math.floor((x-rayon)/MAILLE);cx<=Math.floor((x+rayon)/MAILLE);cx++)
          for (let cz=Math.floor((z-rayon)/MAILLE);cz<=Math.floor((z+rayon)/MAILLE);cz++) {
            const distanceX=Math.max(cx*MAILLE-x, 0, x-(cx+1)*MAILLE);
            const distanceZ=Math.max(cz*MAILLE-z, 0, z-(cz+1)*MAILLE);
            if (distanceX*distanceX+distanceZ*distanceZ > rayon*rayon) continue;
            const cle=cleCase(cx,cz); let cellule=cases.get(cle);
            if (!cellule) { cellule=[];cases.set(cle,cellule); }
            cellule.push(module);places=Math.max(places,cellule.length);
          }
      }
    }
    // Réserver seulement la plus grande fenêtre spatiale, indépendamment de la longueur totale.
    for (let i=0;i<places;i++) {
      const fond=objet('box',16,[.027,.058,.081]), fleche=objet(FORME,16,[1,.68,.13]);
      panneaux.push({fond,fleche});objets.push(fond,fleche);
    }
    const portiquesS = [0];
    if (circuit.ouvert && Number.isFinite(circuit.arrivee) && circuit.arrivee > 100) {
      portiquesS.push(circuit.arrivee);
    }

    for (let pIdx = 0; pIdx < portiquesS.length; pIdx++) {
      const s = portiquesS[pIdx];
      const idx = Math.max(0, Math.min(circuit.n - 1, Math.round(s / (circuit.pas || 2))));
      const cap = circuit.cap[idx];
      const cx = circuit.x[idx], cy = circuit.y[idx], cz = circuit.z[idx];
      const rx = -Math.sin(cap), rz = Math.cos(cap);
      const tx = Math.cos(cap), tz = Math.sin(cap);
      const largeurBandeau = Math.min(13.2, (circuit.largeur || 12) + 0.8);

      for (let faceIdx = 0; faceIdx < 2; faceIdx++) {
        const face = faceIdx === 0 ? -1 : 1;
        const modules = [];
        for (let m = 0; m < LED_COUNT; m++) {
          const lat = -largeurBandeau / 2 + (m + 0.5) * (largeurBandeau / LED_COUNT);
          const obj = {
            shape: 'box',
            p: [cx + rx * lat + tx * face * 0.34, cy + 5.72, cz + rz * lat + tz * face * 0.34],
            s: [0.10, 0.24, largeurBandeau / LED_COUNT * 0.82],
            r: [0, -cap, 0],
            mat: 16,
            color: [0.10, 0.90, 0.30],
            emissive: 0.75
          };
          modules.push(obj);
          objets.push(obj);
        }
        bandeaux.push({ s, modules });
      }
    }

    return etat;
  }

  function dessinerRubans(etat, temps, contexte, camera, sortie) {
    if (!sortie || !camera) return;
    const modules=etat.cases.get(cleCase(Math.floor(camera[0]/MAILLE),Math.floor(camera[2]/MAILLE)));
    if (!modules) return;
    const reduit=!!contexte?.mouvementReduit, portee=contexte?.qualite==='low'?265:PORTEE;
    const avance= reduit ? .5 : modulo(temps/.62,1);
    const motif=phasesLED[reduit ? 0 : Math.floor(avance*COLONNES)];
    const distanceLED=contexte?.qualite==='low'?42:60;
    const luminosite=(1+.16*(contexte?.pluie||0))*(1-.18*(contexte?.nuit||0));
    let utilise=0;
    for (let k=0;k<modules.length;k++) {
      const m=modules[k], dx=m.x-camera[0], dz=m.z-camera[2];
      const distance2=dx*dx+dz*dz;
      if (distance2>portee*portee) continue;
      // Une seule matrice précompilée par phase, commune à toutes les dalles proches.
      // Au loin la silhouette pleine évite le moiré et les triangles sous-pixel.
      const matrice=distance2<distanceLED*distanceLED;
      const phase=matrice ? .5 : avance;
      const {fond,fleche}=etat.panneaux[utilise++], a=m.a;
      fond.shape=matrice?'bitume-ruban-grille':'box';
      fleche.shape=matrice?motif:FORME;
      fond.r=fleche.r=matrice?m.face:m.r;
      fond.p[0]=m.x; fond.p[1]=a.y+m.dy*.5; fond.p[2]=m.z;
      fond.s[0]=m.longueur+(matrice?0:.14); fond.s[1]=HAUTEUR; fond.s[2]=.18;
      fond.emissive=.10;
      fleche.p[0]=a.x+m.dx*phase+m.faceX*.17;
      fleche.p[1]=a.y+m.dy*phase;
      fleche.p[2]=a.z+m.dz*phase+m.faceZ*.17;
      // Les flèches entrent et sortent du ruban à ses extrémités, avec position et phase
      // continues aux jonctions. Au milieu, la silhouette complète reste allumée.
      const bord=Math.min(m.i+phase, m.nombre-m.i-phase);
      fleche.s[0]=m.longueur*Math.min(matrice?1:.87, Math.max(.012,2*bord));
      fleche.s[1]=HAUTEUR*(matrice?1:.88);fleche.s[2]=.075;
      const eclat = reduit ? .65 : .5+.5*Math.cos((m.i+avance-temps*4.2)*Math.PI/2);
      fleche.color[1]=.44+.43*eclat; fleche.color[2]=.045+.28*eclat;
      fleche.emissive=(.81+1.43*eclat)*luminosite*(matrice?1.12:.9);
      sortie.push(fond,fleche);
    }
  }

  function animer(etat, t, contexte, sortie) {
    if (!etat) return;
    const camPos = contexte && (contexte.cameraPos || contexte.camPos);
    const phaseCourse = (contexte && contexte.phase) || 'vert';
    const feuxAllumes = (contexte && (contexte.feux ?? contexte.feuxAllumes)) || 0;
    const pluie = (contexte && contexte.pluie) || 0;
    const nuit = (contexte && contexte.nuit) || 0;
    const temps = Number.isFinite(t) ? t : 0;
    const boostNuit = 1 + 1.6 * nuit;

    dessinerRubans(etat, temps, contexte, camPos, sortie);

    const bandeaux = etat.bandeaux;
    if (bandeaux) {
      for (let b = 0; b < bandeaux.length; b++) {
        const mods = bandeaux[b].modules;
        for (let m = 0; m < mods.length; m++) {
          const o = mods[m];

          if (phaseCourse === 'depart' || phaseCourse === 'feux') {
            const seuil = Math.round(feuxAllumes * LED_COUNT / 5);
            const allume = m < seuil;
            o.color[0] = allume ? 0.96 : 0.20;
            o.color[1] = allume ? 0.10 : 0.04;
            o.color[2] = allume ? 0.06 : 0.04;
            o.emissive = (allume ? 1.15 : 0.05) * boostNuit;
          } else if (phaseCourse === 'damier' || phaseCourse === 'fini' || phaseCourse === 'arrivee') {
            const damier = ((m + Math.floor(temps * 5)) & 1) === 0;
            o.color[0] = damier ? 0.96 : 0.08;
            o.color[1] = damier ? 0.96 : 0.08;
            o.color[2] = damier ? 0.96 : 0.08;
            o.emissive = (damier ? 1.1 : 0.06) * boostNuit;
          } else if (phaseCourse === 'pluie' || pluie > 0.35) {
            let phase = (temps * 0.7 - m * 0.08) % 1;
            if (phase < 0) phase += 1;
            const vague = phase < 0.5 ? phase * 2 : 2 - phase * 2;
            o.color[0] = 0.12;
            o.color[1] = 0.62;
            o.color[2] = 0.98;
            o.emissive = (0.35 + 0.65 * vague) * boostNuit;
          } else if (phaseCourse === 'dernier-tour') {
            let phase = (temps * 1.0 - m * 0.09) % 1;
            if (phase < 0) phase += 1;
            const vague = phase < 0.5 ? phase * 2 : 2 - phase * 2;
            o.color[0] = 0.96;
            o.color[1] = 0.72;
            o.color[2] = 0.08;
            o.emissive = (0.35 + 0.75 * vague) * boostNuit;
          } else {
            let phase = (temps * 0.45 - m * 0.075) % 1;
            if (phase < 0) phase += 1;
            const vague = phase < 0.5 ? phase * 2 : 2 - phase * 2;
            o.color[0] = 0.08;
            o.color[1] = 0.86;
            o.color[2] = 0.28;
            o.emissive = (0.35 + 0.55 * vague) * boostNuit;
          }

          if (sortie) sortie.push(o);
        }
      }
    }
  }

  function mettreAJour(etat, t, contexte, sortie) {
    animer(etat, t, contexte, sortie);
  }

  function objets(etat) {
    return etat && etat.objets ? etat.objets : [];
  }

  B.signalisationCourse = { creer, animer, mettreAJour, objets };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.signalisationCourse;
