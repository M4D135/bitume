/* BITUME — balises de virage et bandeaux des portiques. Les géométries restent visuelles. */
(function (B) {
  'use strict';
  const LED_COUNT = 12, MAILLE = 128, PORTEE = 355;
  const HAUTEUR = .09, GARDE = .01, EPAISSEUR = .045;
  const FLECHES = 6, PAS_MOTIF = 16, LIGNES = 5, PHASES = 8;
  const cleCase = (x, z) => x * 65536 + z;
  const formesRuban = [[],[]];

  // Chaque tronçon possède six chevrons. Le défilement recommence sur le tronçon
  // suivant. Au moins cinq chevrons entiers subsistent même à cheval sur le raccord.
  function formeRuban(phase, grille) {
    const metal=[], lumiere=[], avant=[0,0,1];
    function quad(lot,a,b,c,d,n) { lot.push([a,b,c,n,n,n],[a,c,d,n,n,n]); }
    function rectangle(lot,x0,x1,y0,y1) {
      quad(lot,[x0,y0,.5],[x1,y0,.5],[x1,y1,.5],[x0,y1,.5],avant);
    }
    const contour=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5]];
    const normales=[[0,-1,0],[1,0,0],[0,1,0],[-1,0,0]];
    quad(metal,contour[3],contour[2],contour[1],contour[0],[0,0,-1]);
    for (let i=0;i<4;i++) {
      const p=contour[i], q=contour[(i+1)%4];
      quad(metal,p,q,[q[0],q[1],.5],[p[0],p[1],.5],normales[i]);
    }
    const colonnes=FLECHES*PAS_MOTIF, x=i=>i/colonnes-.5;
    rectangle(metal,-.5,.5,-.5,-.43); rectangle(metal,-.5,.5,.43,.5);
    for (let j=0;j<LIGNES;j++) {
      const pointe=7-Math.abs(j-2), bas=-.43+.86*j/LIGNES, haut=-.43+.86*(j+1)/LIGNES;
      const allumee=i=>{const col=(i+PAS_MOTIF-phase*2)%PAS_MOTIF;return col>=pointe-1 && col<=pointe;};
      const y0=bas+(grille ? .012 : 0), y1=haut-(grille ? .012 : 0);
      if (grille) { rectangle(metal,-.5,.5,bas,y0); rectangle(metal,-.5,.5,y1,haut); }
      for (let i=0;i<colonnes;) {
        const premier=i, actif=allumee(i);
        do { i++; } while (i<colonnes && allumee(i)===actif);
        if (!actif || !grille) { rectangle(actif?lumiere:metal,x(premier),x(i),y0,y1); continue; }
        for (let k=premier;k<i;k++) {
          rectangle(metal,x(k),x(k+.12),y0,y1); rectangle(lumiere,x(k+.12),x(k+.88),y0,y1);
          rectangle(metal,x(k+.88),x(k+1),y0,y1);
        }
      }
    }
    return {metal,lumiere};
  }
  // Chaque rangée encode les trois colonnes d'une lettre du portique, de gauche à droite.
  const glyphes = {
    A:[2,5,7,5,5], B:[6,5,6,5,6], C:[3,4,4,4,3], D:[6,5,5,5,6], E:[7,4,6,4,7],
    F:[7,4,6,4,4], G:[3,4,5,5,3], H:[5,5,7,5,5], I:[7,2,2,2,7], J:[1,1,1,5,2],
    L:[4,4,4,4,7], M:[5,7,7,5,5], N:[5,7,7,7,5], O:[2,5,5,5,2], P:[6,5,6,4,4],
    R:[6,5,6,5,5], S:[3,4,2,1,6], T:[7,2,2,2,2], U:[5,5,5,5,7], V:[5,5,5,5,2],
    0:[7,5,5,5,7], 1:[2,6,2,2,7], 2:[6,1,2,4,7], 3:[6,1,2,1,6], 4:[5,5,7,1,1],
    5:[7,4,6,1,6], 6:[3,4,7,5,7], 7:[7,1,2,2,2], 8:[7,5,7,5,7], 9:[7,5,7,1,6],
  };
  const nomsGlyphes = {};
  function formeLettre(lignes) {
    const triangles = [], normale = [-1,0,0];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) {
      if (!(lignes[j] & (4 >> i))) continue;
      const z = (i + .5) / 3 - .5, y = .4 - j / 5;
      const a = [0,y-.09,z-.15], b = [0,y-.09,z+.15];
      const c = [0,y+.09,z+.15], d = [0,y+.09,z-.15];
      triangles.push([a,b,c,normale,normale,normale], [a,c,d,normale,normale,normale]);
    }
    return triangles;
  }
  const renderer = globalThis.FRender || globalThis.window?.FRender;
  if (renderer?.forme) {
    for (let grille=0;grille<=1;grille++) for (let phase=0;phase<PHASES;phase++) {
      const forme=formeRuban(phase,grille), nom='bitume-rail-'+grille+'-'+phase;
      renderer.forme(nom,forme.metal); renderer.forme(nom+'-led',forme.lumiere);
      formesRuban[grille].push([nom,nom+'-led']);
    }
    for (const [lettre, lignes] of Object.entries(glyphes)) {
      nomsGlyphes[lettre] = 'bitume-portique-' + lettre;
      renderer.forme(nomsGlyphes[lettre], formeLettre(lignes));
    }
  }

  function bandeauSurRail(troncon) {
    const {rail,haut,s,cote,longueur}=troncon;
    // Le contrôle des dix centimètres est vertical, y compris sur une glissière en pente.
    const h=HAUTEUR*haut[1], offset=(rail.s[1]+h)/2;
    const pos=rail.p.map((p,i)=>p+haut[i]*offset+(i===1?GARDE:0));
    const taille=[longueur,h,EPAISSEUR], r=rail.r;
    const rotation=cote<0?r:[r[0]+Math.PI,r[1],r[2]];
    const fond=objet('box',17,[.10,.12,.13]), fleche=objet('box',16,[1,.68,.14]);
    fond.p=fleche.p=pos; fond.s=fleche.s=taille; fond.r=fleche.r=rotation;
    return {s,x:pos[0],z:pos[2],fond,fleche};
  }

  function objet(shape, mat, couleur) {
    return {shape,p:[0,0,0],s:[1,1,1],r:[0,0,0],mat,color:couleur,emissive:0};
  }

  function creer(circuit, decor) {
    const cases=new Map(), panneaux=[], bandeaux=[], objets=[];
    const etat={cases,panneaux,chevrons:panneaux,bandeaux,portique:bandeaux,objets};
    if (!circuit?.n) return etat;
    // Stocker un tronçon dans une seule case ; parcourir les cases de la caméra en course.
    for (const rail of decor?.railsVirages || []) {
      const p=bandeauSurRail(rail);
      panneaux.push(p); objets.push(p.fond,p.fleche);
      const cle=cleCase(Math.floor(p.x/MAILLE),Math.floor(p.z/MAILLE));
      let cellule=cases.get(cle);
      if (!cellule) { cellule=[];cases.set(cle,cellule); }
      cellule.push(p);
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
        // Les deux textes se lisent de gauche à droite depuis leur propre côté de la ligne.
        const lettres = [], rotation = [0, -cap + (face > 0 ? Math.PI : 0), 0];
        const support = objet('box', 7, [.027,.035,.043]);
        support.p = [cx + tx * face * .32, cy + 6.10, cz + tz * face * .32];
        support.s = [.12,.94,largeurBandeau];
        support.r = rotation;
        for (let m = 0; m < LED_COUNT; m++) {
          const lat = (m + .5 - LED_COUNT / 2) * Math.min(.60, largeurBandeau / LED_COUNT) * -face;
          const o = objet('box', 16, [1,.93,.70]);
          o.p = [cx + rx * lat + tx * face * .40, cy + 6.14, cz + rz * lat + tz * face * .40];
          o.s = [.04,.64,Math.min(.46, largeurBandeau / LED_COUNT * .8)];
          o.r = rotation;
          lettres.push(o);
        }
        // La rangée de témoins est située en saillie sous le texte.
        for (const o of modules) {
          o.p[0] += tx * face * .07; o.p[2] += tz * face * .07;
        }
        bandeaux.push({ s, modules, lettres, support, texte: '', visibles: [] });
      }
    }

    return etat;
  }

  function dessinerBalises(etat, temps, contexte, camera, sortie) {
    if (!sortie || !camera) return;
    const bas=contexte?.qualite==='low', portee=bas?265:PORTEE;
    const phase=contexte?.mouvementReduit?0:Math.floor(temps*9)%PHASES;
    const eclat=.86+.18*(contexte?.pluie||0)-.12*(contexte?.nuit||0);
    for (let x=Math.floor((camera[0]-portee)/MAILLE);x<=Math.floor((camera[0]+portee)/MAILLE);x++)
      for (let z=Math.floor((camera[2]-portee)/MAILLE);z<=Math.floor((camera[2]+portee)/MAILLE);z++) {
        const proches=etat.cases.get(cleCase(x,z)); if (!proches) continue;
        for (const p of proches) {
          const d2=(p.x-camera[0])**2+(p.z-camera[2])**2;
          if (d2>portee**2) continue;
          const noms=formesRuban[d2<12**2?1:0][phase]; if (!noms) continue;
          p.fond.shape=noms[0]; p.fleche.shape=noms[1]; p.fleche.emissive=eclat;
          sortie.push(p.fond,p.fleche);
        }
      }
  }

  const MESSAGES_TOUR = Array.from({length: 100}, (_, i) => 'TOUR ' + i);
  const MESSAGES_SECTEUR = ['TETE S1','TETE S2','TETE S3'];
  function messagePortique(co, bandeau, temps, pluie, phase) {
    if (phase === 'depart' || phase === 'feux') return 'DEPART';
    if (phase === 'damier' || phase === 'fini' || phase === 'arrivee') return 'ARRIVEE';
    let stands = false;
    if (co) for (const v of co.voitures) {
      const e = v.etat;
      let distance = Math.abs(e.s - bandeau.s);
      if (!co.c.ouvert) distance = Math.min(distance, co.c.longueur - distance);
      if ((e.accident || e.recuperation) && distance < 180) return 'DANGER';
      if (e.stands) stands = true;
    }
    if (phase === 'dernier-tour') return 'DERNIER TOUR';
    // Un tour d'affichage dure douze secondes. Les informations restent fixes à la lecture.
    const page = Math.floor(temps / 4) % 3;
    if (pluie > .35 && (page === 0 || !co)) return 'PLUIE';
    if (!co) return 'COURSE';
    if (page === 1 && stands && co.c.stands) return 'STANDS';
    const tete = co.voitures[co.classement[0]];
    if (page === 2 && tete && co.c.secteurs?.length === 2) {
      const s = tete.etat.s, limites = co.c.secteurs;
      return MESSAGES_SECTEUR[s < limites[0] ? 0 : s < limites[1] ? 1 : 2];
    }
    if (co.mode === 'chrono') return 'CHRONO';
    if (co.c.ouvert) return 'SPECIALE';
    return MESSAGES_TOUR[Math.min(99, (tete?.tours || 0) + 1)];
  }
  function lettresPortique(bandeau, message, nuit, sortie) {
    if (message !== bandeau.texte) {
      bandeau.texte = message;
      bandeau.visibles.length = 0;
      const debut = Math.floor((LED_COUNT - message.length) / 2);
      for (let i = 0; i < message.length; i++) {
        const forme = nomsGlyphes[message[i]];
        if (!forme) continue;
        const o = bandeau.lettres[debut + i];
        o.shape = forme;
        bandeau.visibles.push(o);
      }
    }
    sortie.push(bandeau.support);
    for (const o of bandeau.visibles) {
      o.emissive = 1.15 - .40 * nuit;
      sortie.push(o);
    }
  }

  function animer(etat, t, contexte, sortie) {
    if (!etat) return;
    const camPos = contexte && (contexte.cameraPos || contexte.camPos);
    const co = contexte?.course;
    const tete = co?.voitures[co.classement[0]];
    let phaseCourse = contexte?.phase || 'vert';
    if (co) {
      if (co.phase === 'grille' || co.phase === 'feux') phaseCourse = 'depart';
      else if (co.drapeau != null || co.phase === 'arrivee') phaseCourse = 'damier';
      else if (!co.c.ouvert && co.toursTotal > 1 && tete?.tours + 1 >= co.toursTotal) phaseCourse = 'dernier-tour';
    }
    const feuxAllumes = co?.feux.allumes ?? contexte?.feux ?? contexte?.feuxAllumes ?? 0;
    const pluie = (contexte && contexte.pluie) || 0;
    const nuit = (contexte && contexte.nuit) || 0;
    const temps = Number.isFinite(t) ? t : 0;
    const boostNuit = 1 + 1.6 * nuit;

    dessinerBalises(etat, temps, contexte, camPos, sortie);

    const bandeaux = etat.bandeaux;
    if (bandeaux) {
      for (let b = 0; b < bandeaux.length; b++) {
        const bandeau = bandeaux[b], mods = bandeau.modules;
        const p = bandeau.support.p;
        if (sortie && (!camPos || (p[0]-camPos[0])**2 + (p[2]-camPos[2])**2 < PORTEE**2)) {
          lettresPortique(bandeau, messagePortique(co, bandeau, temps, pluie, phaseCourse), nuit, sortie);
        }
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
          } else if (phaseCourse === 'pluie' || pluie > 0.35 && phaseCourse !== 'dernier-tour') {
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
