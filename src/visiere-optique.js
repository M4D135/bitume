/* BITUME — optique procédurale de la visière, hors des modules FERRO verrouillés.
 * L'eau dévie une copie bornée de la vue courante ; seule la surface mouillée est composée.
 * Les rétroviseurs et l'ATH, posés ensuite par le jeu, restent nets. Aucune image importée. */
(function (B) {
  'use strict';
  const PAS = 1 / 120, MAX_PIXELS = 2000000, MAX_SOURCE_PIXELS = 1048576;
  const QUALITES = Object.freeze({ low: 0, medium: 1, high: 2, ultra: 3 });
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const nombre = (v, defaut = 0) => Number.isFinite(Number(v)) && v != null ? Number(v) : defaut;
  const VERTEX = `#version 300 es
  precision highp float;
  out vec2 uv;
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    uv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;
  const FRAGMENT = `#version 300 es
  precision highp float;
  in vec2 uv;
  out vec4 couleur;
  uniform sampler2D uScene;
  uniform vec4 uMeteo;       // eau, neige accumulée, nuage de roues, film humide
  uniform vec4 uMouvement;   // temps, vitesse d'évacuation, vent X, vent Y
  uniform vec4 uVue;         // largeur CSS, hauteur CSS, graine, atténuation extérieure
  uniform vec2 uTexel;
  uniform int uQualite;
  uniform bool uAvecScene;
  float h21(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(.1031,.1030,.0973));
    q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z);
  }
  vec2 h22(vec2 p) { return vec2(h21(p), h21(p + vec2(41.7,93.4))); }
  float bruit(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+1.0),f.x),f.y);
  }
  float bords(float r, float largeur) { return 1.0 - smoothstep(1.0-largeur,1.0+largeur,r); }
  // Une couche de perles ancrées : le bruit déplace leur centre et varie rayon, durée et ménisque.
  // Les petites perles couvrent la vitre sans boucles par goutte, objets DOM ni allocation par image.
  vec4 perles(vec2 p, float cellule, float taille, float densite, float couche, float mobilite) {
    float t = uMouvement.x, air = uMouvement.y;
    vec2 q = p / cellule;
    vec2 id = floor(q), local = fract(q) - .5;
    vec2 alea = h22(id + couche*17.3 + uVue.z);
    float vie = fract(t * (.033 + alea.x*.022) + alea.y);
    float apparition = smoothstep(0.0,.09,vie) * (1.0-smoothstep(.84,1.0,vie));
    float presence = (1.0-smoothstep(densite-.08,densite+.025,h21(id+73.1+couche+uVue.z))) * clamp(densite*8.0,0.0,1.0);
    vec2 centre = (alea-.5)*.48;
    float coulee = pow(vie,3.0) * mobilite * (.10+air*.28);
    centre.y -= coulee;
    centre.x += sin(vie*7.0+alea.x*6.283)*coulee*.23 + uMouvement.z*coulee*.02;
    vec2 d = local-centre;
    float rayon = taille * (.48 + alea.x*alea.x*.94) / cellule;
    vec2 axes = vec2(rayon,rayon*(1.12+mobilite*(.5+air*1.5)));
    vec2 n = d/max(axes,vec2(.001));
    float asymetrie = 1.0 + sin(atan(n.y,n.x)*3.0+alea.y*6.283)*.10*taille/12.0;
    float r = length(n)*asymetrie;
    float aa = max(.018, .8/ max(taille,1.0));
    float masque = bords(r,aa) * presence * apparition;
    float longueur = rayon*1.5+mobilite*pow(vie,2.0)*.32;
    float tx = d.x-sin(d.y*25.0+alea.x*12.0)*rayon*.16;
    float trace = (1.0-smoothstep(rayon*.09,rayon*.31,abs(tx))) * smoothstep(rayon*.6,rayon*1.6,d.y);
    trace *= (1.0-smoothstep(longueur*.72,longueur,d.y))*mobilite*presence*apparition;
    float creux = sqrt(max(0.0,1.0-min(r*r,1.0)));
    vec2 normale = clamp(n,vec2(-1),vec2(1))*masque*creux;
    return vec4(normale+vec2(sign(tx)*trace*.12,0.0),max(masque,trace*.34),max(masque*(.5+.5*creux),trace*.2));
  }
  vec4 nappe(vec2 p, float densite) {
    vec2 q = mat2(.932,.362,-.362,.932)*p/vec2(157.0,191.0), id = floor(q), a = h22(id+103.0+uVue.z);
    vec2 d = (fract(q)-.5-(a-.5)*.36)*vec2(1.0,.84);
    float vie = fract(uMouvement.x*(.021+a.y*.017)+a.x);
    d.y += pow(vie,2.0)*(.08+uMouvement.y*.21);
    float rayon = .08+a.y*.095;
    float angle = atan(d.y,d.x);
    float r = length(d)/(rayon*(1.0+.18*sin(angle*3.0+a.x*15.0)+.09*sin(angle*5.0-a.y*9.0)));
    float present = 1.0-smoothstep(densite-.05,densite+.08,h21(id+vec2(31,81)+uVue.z));
    float fondu = smoothstep(0.0,.13,vie)*(1.0-smoothstep(.72,1.0,vie));
    float m = bords(r,.035)*present*fondu;
    return vec4(clamp(d/rayon,vec2(-1),vec2(1))*m*.65,m,m*(.5+.5*sqrt(max(0.0,1.0-min(r*r,1.0)))));
  }
  vec3 scene(vec2 p, float flou) {
    p = clamp(p,vec2(.002),vec2(.998));
    vec3 c = texture(uScene,p).rgb;
    if (uQualite > 1 && flou > .015) {
      vec2 d = uTexel*(1.0+flou*7.0);
      vec3 b = texture(uScene,p+vec2(d.x,d.y)).rgb + texture(uScene,p+vec2(-d.x,d.y)).rgb;
      b += texture(uScene,p+vec2(d.x,-d.y)).rgb + texture(uScene,p-d).rgb;
      c = mix(c,b*.25,min(.88,flou));
    }
    return c;
  }
  void main() {
    float eau=uMeteo.x, neige=uMeteo.y, embruns=uMeteo.z, film=uMeteo.w;
    if (max(max(eau,neige),max(embruns,film)) < .001) { couleur=vec4(0); return; }
    vec2 p=uv*uVue.xy;
    // Granulométrie : milliers de fines perles, dizaines de grosses gouttes et nappes rares.
    vec4 a=perles(p,18.0,1.45,clamp(eau*.94,0.0,.97),1.0,.04);
    vec4 b=perles(p,43.0,3.7,clamp(eau*.83,0.0,.93),2.0,.22);
    vec4 c=vec4(0),n=vec4(0);
    if (uQualite > 0) {
      c=perles(p,91.0,8.9,clamp(eau*.70,0.0,.85),3.0,.65);
      n=nappe(p,clamp((eau-.30)*.48+film*.32,0.0,.65));
    } else { a*=.6; }
    vec2 normale=a.xy*.23+b.xy*.47+c.xy*.8+n.xy;
    float goutte=clamp(a.z+b.z+c.z+n.z,0.0,1.0);
    float relief=clamp(a.w*.3+b.w*.5+c.w*.8+n.w,0.0,1.0);
    float menisque=clamp((a.z-a.w+b.z-b.w+c.z-c.w+n.z-n.w)*2.0,0.0,1.0);
    // Brouillard d'eau local dans l'axe : il monte puis retombe dans le modèle, pas d'aplat blanc instantané.
    float turbulent=.5;
    if (embruns>.001 || (uAvecScene && film>.001)) {
      turbulent=bruit(uv*vec2(9.0,7.0)+vec2(uMouvement.x*.38,-uMouvement.x*.54));
      turbulent=.67*turbulent+.33*bruit(uv*vec2(21.0,17.0)-uMouvement.x*.27);
    }
    vec2 centre=uv-vec2(.5,.57);
    float panache=exp(-dot(centre*vec2(1.8,1.45),centre*vec2(1.8,1.45))*2.1);
    float voile=clamp(embruns*panache*(.35+turbulent*.68),0.0,.88);
    // La neige humide s'agglomère irrégulièrement sur le pourtour, avec de petits amas au centre.
    float grain=0.0,blanc=0.0;
    if (neige>.001) {
      vec2 bord= min(uv,1.0-uv);
      float distanceBord=min(bord.x*1.32,bord.y);
      float dentelle=bruit(p/37.0+uVue.z)*.020 + bruit(p/11.0)*.007;
      float lobes=bruit(p/vec2(173.0,109.0)+uVue.z);
      float coin=exp(-length(bord*vec2(1.3,1.0))*11.0);
      float epaisseur=neige*((.021+.078*(1.0-uv.y))*(.35+1.15*lobes)+coin*.046+dentelle);
      float bourrelet=(1.0-smoothstep(epaisseur*.52,epaisseur+.022+lobes*.015,distanceBord))*neige;
      grain=bruit(p*.39+uVue.z)*.5+bruit(p*.13)*.5;
      vec4 amas=perles(p,64.0,4.4,clamp(neige*.53,0.0,.74),6.0,.08);
      blanc=clamp(bourrelet*(.75+.25*grain)+amas.z*neige*(.35+.65*grain),0.0,.96);
    }
    float brume=clamp(film*.065+neige*.04,0.0,.13);
    float alpha=clamp(max(goutte*.90,max(voile,blanc)) + brume,0.0,.98)*uVue.w;
    if (alpha<.002) { couleur=vec4(0); return; }
    vec3 image=vec3(.61,.69,.73);
    if (uAvecScene) {
      vec2 deviation=normale*vec2(10.0,12.0)/uVue.xy;
      deviation += (vec2(turbulent,bruit(uv*13.0+uMouvement.x*.2))-.5)*film*.002;
      image=scene(uv+deviation,clamp(relief*.45+voile*.88+blanc*.72,0.0,1.0));
      float ombre=smoothstep(.01,.24,dot(normale,normalize(vec2(.35,-.94))));
      float reflet=pow(smoothstep(.02,.33,dot(-normale,normalize(vec2(.35,-.94)))),2.0);
      image *= 1.0-ombre*(.08+menisque*.32)-menisque*.17;
      image += vec3(.72,.85,.94)*reflet*(.09+menisque*.43);
    } else {
      // Légère : ménisques contrastés sur fond transparent, aucune copie ni lecture de la scène.
      float lumiere=dot(-normale,normalize(vec2(.35,-.94)));
      image=mix(vec3(.08,.15,.19),vec3(.87,.94,.98),smoothstep(-.2,.5,lumiere));
      alpha*=.44;
    }
    image=mix(image,vec3(.72,.78,.80),voile*.63+brume);
    image=mix(image,vec3(.86,.91,.94)+grain*.055,blanc);
    couleur=vec4(clamp(image,0.0,1.0),alpha);
  }`;
  function creerEtat(options) {
    return { temps: 0, accumulateur: 0, eau: 0, neige: 0, embruns: 0, film: 0,
      precedent: new Float64Array(4), uniformes: new Float32Array(12), etapes: 0,
      graine: options && Number.isInteger(options.graine) ? options.graine : 0 };
  }
  function avancerEtat(e, dt, c) {
    if (c.pause || !Number.isFinite(dt) || dt <= 0) return;
    const intensite=clamp(nombre(c.intensite,1),0,2), vitesse=clamp(Math.abs(nombre(c.vitesse)),0,120);
    const air=Math.pow(clamp((vitesse-8)/100,0,1),1.65);
    const neige=c.abri ? 0 : clamp(nombre(c.neige),0,1);
    const pluie=c.abri || neige>.001 ? 0 : clamp(nombre(c.pluie),0,1);
    const spray=c.abri ? 0 : clamp(nombre(c.embruns),0,1);
    const eauCible=clamp((pluie*.95+spray*1.25)*intensite/(1+air*2.8),0,1.55);
    const neigeCible=clamp(neige*intensite/(1+air*7),0,1.25);
    e.accumulateur+=Math.min(.25,dt);
    while (e.accumulateur+1e-10>=PAS) {
      e.precedent[0]=e.eau; e.precedent[1]=e.neige; e.precedent[2]=e.embruns; e.precedent[3]=e.film;
      const fonte=e.neige*.18+Math.max(0,e.neige-neigeCible)*(.03+air*.10);
      e.eau+=(eauCible+fonte-e.eau)*(1-Math.exp(-PAS*(eauCible>e.eau ? .72 : .22+air*1.8)));
      e.neige+=(neigeCible-e.neige)*(1-Math.exp(-PAS*(neigeCible>e.neige ? .10 : .065+air*.6)));
      e.embruns+=(spray*intensite-e.embruns)*(1-Math.exp(-PAS*(spray>e.embruns ? 4 : 1.4)));
      const filmCible=(pluie*.35+spray*.55)*intensite/(1+air*4);
      e.film+=(filmCible-e.film)*(1-Math.exp(-PAS*(filmCible>e.film ? .5 : .3+air)));
      if(e.eau<.0005 && eauCible+fonte===0)e.eau=0;
      if(e.neige<.0005 && neigeCible===0)e.neige=0;
      if(e.embruns<.0005 && spray===0)e.embruns=0;
      if(e.film<.0005 && filmCible===0)e.film=0;
      e.temps+=PAS; e.etapes++; e.accumulateur-=PAS;
    }
    const k=clamp(e.accumulateur/PAS,0,1), u=e.uniformes;
    u[0]=e.precedent[0]*(1-k)+e.eau*k; u[1]=e.precedent[1]*(1-k)+e.neige*k;
    u[2]=e.precedent[2]*(1-k)+e.embruns*k; u[3]=e.precedent[3]*(1-k)+e.film*k;
    u[4]=Math.max(0,e.temps-PAS+e.accumulateur); u[5]=air;
    u[6]=clamp(nombre(c.ventX)*.2,-8,8); u[7]=clamp(nombre(c.ventZ)*.08,-8,8);
    u[8]=nombre(c.largeur,1); u[9]=nombre(c.hauteur,1); u[10]=e.graine*37.31;
    u[11]=(c.cockpit===false ? .36 : 1)*Math.min(1,intensite);
  }
  function montrer(e, oui) {
    if (e.masquee===!oui) return;
    e.masquee=!oui; if(e.canvas.style) e.canvas.style.visibility=oui ? '' : 'hidden';
  }
  function shader(gl,type,code) {
    const s=gl.createShader(type); gl.shaderSource(s,code); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) {
      const message=gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(message);
    }
    return s;
  }
  function initialiser(e) {
    const gl=e.gl, vs=shader(gl,gl.VERTEX_SHADER,VERTEX), fs=shader(gl,gl.FRAGMENT_SHADER,FRAGMENT);
    const programme=gl.createProgram(); gl.attachShader(programme,vs); gl.attachShader(programme,fs); gl.linkProgram(programme);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if(!gl.getProgramParameter(programme,gl.LINK_STATUS)) {
      const message=gl.getProgramInfoLog(programme); gl.deleteProgram(programme); throw new Error(message);
    }
    e.programme=programme; e.vao=gl.createVertexArray(); e.texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,e.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    e.lieux={}; for(const nom of ['uScene','uMeteo','uMouvement','uVue','uTexel','uQualite','uAvecScene']) e.lieux[nom]=gl.getUniformLocation(programme,nom);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.clearColor(0,0,0,0);
    e.pret=true; e.perdu=false; e.stats.pret=true; e.stats.perdu=false;e.stats.erreur=null;
  }
  function creer(canvas,options) {
    // Les doubles de Canvas Node et les anciens navigateurs passent au repli Canvas2D de vitre.js.
    if(!canvas || typeof canvas.addEventListener!=='function' || !canvas.ownerDocument || typeof canvas.getBoundingClientRect!=='function') return null;
    let gl; try { gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false}); } catch (_) { return null; }
    if(!gl) return null;
    const copie=canvas.ownerDocument.createElement('canvas'); copie.width=1; copie.height=1;
    const e={canvas,gl,contexte:gl,simulation:creerEtat(options),source:copie,sourceContexte:copie.getContext('2d',{alpha:false}),
      masquee:false,propre:true,perdu:false,libere:false,pret:false,dprPalier:null,largeur:1,hauteur:1,dpr:1,
      stats:{backend:'webgl2',pret:false,perdu:false,erreur:null,copiesScene:0,dessins:0,etapes:0,pixels:0,pixelsSource:0,
        largeur:0,hauteur:0,dpr:1,eau:0,accumulationNeige:0,embruns:0,gouttes:0,neige:0}};
    e.uMeteo=e.simulation.uniformes.subarray(0,4);e.uMouvement=e.simulation.uniformes.subarray(4,8);e.uVue=e.simulation.uniformes.subarray(8,12);
    e.perte=event=>{event.preventDefault(); e.perdu=true; e.pret=false; e.stats.perdu=true; e.stats.pret=false; montrer(e,false);};
    e.restauration=()=>{if(e.libere)return; try{initialiser(e);}catch(err){e.stats.erreur=String(err.message||err);montrer(e,false);}};
    canvas.addEventListener('webglcontextlost',e.perte,false); canvas.addEventListener('webglcontextrestored',e.restauration,false);
    try{initialiser(e);}catch(err){e.stats.erreur=String(err.message||err);montrer(e,false);}
    montrer(e,false); return e;
  }
  function dimensionner(e,c,niveau) {
    const palier=niveau>2 ? 1.5 : niveau>1 ? 1.25 : 1;
    e.dprPalier=e.dprPalier===null ? palier : Math.min(e.dprPalier,palier);
    const largeur=Math.max(1,nombre(c.largeur,e.canvas.clientWidth||1)),hauteur=Math.max(1,nombre(c.hauteur,e.canvas.clientHeight||1));
    const dpr=Math.min(e.dprPalier,Math.max(.25,nombre(c.dpr,globalThis.devicePixelRatio||1)),Math.sqrt(MAX_PIXELS/(largeur*hauteur)));
    const w=Math.max(1,Math.floor(largeur*dpr)),h=Math.max(1,Math.floor(hauteur*dpr));
    if(e.canvas.width!==w || e.canvas.height!==h){e.canvas.width=w;e.canvas.height=h;e.propre=true;}
    e.largeur=largeur;e.hauteur=hauteur;e.dpr=dpr;
    e.stats.largeur=w;e.stats.hauteur=h;e.stats.dpr=dpr;e.stats.pixels=w*h;
    const plafond=niveau>1 ? MAX_SOURCE_PIXELS : MAX_SOURCE_PIXELS/2;
    const rapport=Math.min(1,Math.sqrt(plafond/(largeur*hauteur)));
    const sw=Math.max(1,Math.floor(largeur*rapport)),sh=Math.max(1,Math.floor(hauteur*rapport));
    if(e.source.width!==sw || e.source.height!==sh){e.source.width=sw;e.source.height=sh;}
    e.stats.pixelsSource=sw*sh;
  }
  function dessiner(e,c,niveau,chauffe) {
    const gl=e.gl,u=e.simulation.uniformes;
    gl.viewport(0,0,e.canvas.width,e.canvas.height); gl.useProgram(e.programme); gl.bindVertexArray(e.vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,e.texture);
    let avecScene=false;
    if(niveau>0 && e.sourceContexte && c.sourceScene && c.sourceScene.width>0 && c.sourceScene.height>0) {
      try {
        e.sourceContexte.drawImage(c.sourceScene,0,0,e.source.width,e.source.height);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,e.source);
        e.stats.copiesScene++;e.stats.erreur=null;avecScene=true;
      }catch(err){e.stats.erreur='copie scène : '+String(err.message||err);}
    }
    u[8]=e.largeur;u[9]=e.hauteur;
    gl.uniform1i(e.lieux.uScene,0);gl.uniform4fv(e.lieux.uMeteo,e.uMeteo);
    gl.uniform4fv(e.lieux.uMouvement,e.uMouvement);gl.uniform4fv(e.lieux.uVue,e.uVue);
    gl.uniform2f(e.lieux.uTexel,1/e.source.width,1/e.source.height);gl.uniform1i(e.lieux.uQualite,niveau);gl.uniform1i(e.lieux.uAvecScene,avecScene);
    gl.drawArrays(gl.TRIANGLES,0,3);e.stats.dessins++;e.propre=!!chauffe;montrer(e,!chauffe);
  }
  function effacer(e) {
    if(!e || e.libere)return;
    if(!e.propre && e.pret && !e.perdu){e.gl.clear(e.gl.COLOR_BUFFER_BIT);e.propre=true;}
    const s=e.simulation;s.eau=s.neige=s.embruns=s.film=s.accumulateur=0;s.precedent.fill(0);s.uniformes.fill(0);
    e.stats.eau=e.stats.accumulationNeige=e.stats.embruns=0;e.dprPalier=null;montrer(e,false);
  }
  function mettreAJour(e,dt,c) {
    if(!e || e.libere)return e ? e.stats : null;
    c=c||{};
    if(c.actif===false || c.retro===true || c.qualite==='off' || clamp(nombre(c.intensite,1),0,2)===0){effacer(e);return e.stats;}
    if(c.pause || !e.pret || e.perdu || !Number.isFinite(dt) || dt<=0)return e.stats;
    const niveau=QUALITES[c.qualite]??2, s=e.simulation;
    avancerEtat(s,dt,c);
    e.stats.eau=s.eau;e.stats.accumulationNeige=s.neige;e.stats.embruns=s.embruns;e.stats.etapes=s.etapes;
    if(Math.max(s.eau,s.neige,s.embruns,s.film)<.001){if(!e.propre){e.gl.clear(e.gl.COLOR_BUFFER_BIT);e.propre=true;}montrer(e,false);return e.stats;}
    dimensionner(e,c,niveau);dessiner(e,c,niveau,false);return e.stats;
  }
  function prechauffer(e,c) {
    if(!e || e.libere || !e.pret || e.perdu)return false;c=c||{};
    if(c.actif===false || c.retro || c.qualite==='off' || c.intensite===0)return false;
    const niveau=QUALITES[c.qualite]??2;dimensionner(e,c,niveau);
    const u=e.simulation.uniformes;u[0]=.02;u[1]=.02;u[10]=e.simulation.graine*37.31;u[11]=.01;
    dessiner(e,c,niveau,true);u.fill(0);e.gl.clear(e.gl.COLOR_BUFFER_BIT);e.propre=true;montrer(e,false);return true;
  }
  function liberer(e) {
    if(!e || e.libere)return;effacer(e);
    e.canvas.removeEventListener('webglcontextlost',e.perte);e.canvas.removeEventListener('webglcontextrestored',e.restauration);
    if(!e.perdu){e.gl.deleteTexture(e.texture);e.gl.deleteVertexArray(e.vao);e.gl.deleteProgram(e.programme);}
    e.libere=true;e.canvas=null;e.contexte=null;e.source=null;e.sourceContexte=null;e.gl=null;
  }
  B.visiereOptique={creer,creerEtat,avancerEtat,mettreAJour,prechauffer,effacer,liberer,MAX_PIXELS,MAX_SOURCE_PIXELS,QUALITES};
})(globalThis.BITUME=globalThis.BITUME||{});
