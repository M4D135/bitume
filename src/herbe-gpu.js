/* BITUME — prairie proche. Une maille décrit un pied, partagé par les feuilles de sa touffe.
   La surface découpée du décor fait autorité : même point d'échantillonnage sur CPU et GPU. */
(function (B) {
  'use strict';
  const N = 256, PAS = .45;
  function graine(x, z) {
    let h = Math.imul(x, 0x9e3779b1) ^ Math.imul(z, 0x85ebca77);
    h = Math.imul(h ^ h >>> 16, 0x7feb352d);
    return (h ^ h >>> 15) >>> 0;
  }

  // Rectangle valide en coordonnées monde, bornes supérieures exclues. À un cut on
  // repart près de l'œil ; le shader ne lit jamais les anciennes cases hors rectangle.
  function clipmap(decor, envoyer) {
    const rect = new Int32Array(4), tampon = new Float32Array(4096 * 8);
    const occupe = new Uint8Array(N*N), comptes = new Uint8Array(1024);
    const bas = new Float32Array(1024), haut = new Float32Array(1024);
    // L'eau littorale peut avoir une découpe supplémentaire hors des triangles :
    // dans ce cas garder la racine au point précisément interrogé.
    const sonde = decor.niveauEauA ? {} : {rayonPied:0}, habitat = {};
    let echantillons = 0;
    function remplir(x0, z0, x1, z1) {
      for (let x = x0; x < x1;) {
        const px = x & 255, w = Math.min(x1 - x, N - px);
        for (let z = z0; z < z1;) {
          const pz = z & 255, h = Math.min(z1 - z, N - pz, Math.floor(4096 / w));
          let i = 0;
          for (let b = z; b < z + h; b++) for (let a = x; a < x + w; a++, i += 8) {
            const g = graine(a, b);
            const X = (a + ((g & 255) + .5) / 256) * PAS, Z = (b + (((g >>> 8) & 255) + .5) / 256) * PAS;
            const s = decor.surfaceHerbe(X, Z, sonde);
            const cellule = (b&255)*256+(a&255), tuile=((b&255)>>3)*32+((a&255)>>3);
            comptes[tuile] -= occupe[cellule]; occupe[cellule] = 0;
            if (!s) { tampon[i + 7] = 0; continue; }
            tampon[i] = s.y; tampon[i + 1] = s.normal[0]; tampon[i + 2] = s.rayonPied || 0; tampon[i + 3] = s.normal[2];
            tampon[i + 4] = s.color[0]; tampon[i + 5] = s.color[1]; tampon[i + 6] = s.color[2];
            tampon[i + 7] = decor.ecologie ? decor.ecologie.echantillonner(X, Z, habitat).herbe : 1;
            if (tampon[i+7] > .001) {
              bas[tuile] = comptes[tuile] ? Math.min(bas[tuile],s.y) : s.y;
              haut[tuile] = comptes[tuile] ? Math.max(haut[tuile],s.y) : s.y;
              comptes[tuile]++; occupe[cellule]=1;
            }
          }
          envoyer(px, pz, w, h, tampon); echantillons += w * h; z += h;
        }
        x += w;
      }
    }
    function maj(x, z) {
      const cx = Math.floor(x / PAS), cz = Math.floor(z / PAS);
      const a = Math.max(rect[0], cx - 128), b = Math.max(rect[1], cz - 128);
      const c = Math.min(rect[2], cx + 128), d = Math.min(rect[3], cz + 128);
      echantillons = 0;
      if (cx < a || cz < b || cx >= c || cz >= d) {
        rect[0] = cx - 16; rect[1] = cz - 16; rect[2] = cx + 16; rect[3] = cz + 16;
        remplir(...rect);
      } else {
        const A = Math.max(cx - 128, a - 4), B = Math.max(cz - 128, b - 4);
        const C = Math.min(cx + 128, c + 4), D = Math.min(cz + 128, d + 4);
        remplir(A, B, C, b); remplir(A, d, C, D);
        remplir(A, b, a, d); remplir(c, b, C, d);
        rect[0] = A; rect[1] = B; rect[2] = C; rect[3] = D;
      }
      return rect;
    }
    // Un descripteur pour 64 pieds. L'enveloppe englobe aussi les pointes couchées ;
    // une ancienne altitude dans une tuile recyclée ne peut que la rendre plus conservative.
    function visibles(v, ultra, liste) {
      const m=v.vp, ex=v.oeil[0], ez=v.oeil[2];
      let n=0;
      for(let z=rect[1]>>3;z<=(rect[3]-1)>>3;z++) for(let x=rect[0]>>3;x<=(rect[2]-1)>>3;x++){
        const k=(z&31)*32+(x&31);
        if (!comptes[k]) continue;
        const X=(8*x+4)*PAS, Z=(8*z+4)*PAS, Y=(bas[k]+haut[k])*.5;
        const dx=Math.max(0,Math.abs(X-ex)-2.2), dz=Math.max(0,Math.abs(Z-ez)-2.2), d2=dx*dx+dz*dz;
        if(d2>(256*.215)**2) continue;
        const hy=(haut[k]-bas[k])*.5+.8;
        const w=m[3]*X+m[7]*Y+m[11]*Z+m[15];
        let visible=true;
        for(let j=0;j<3 && visible;j++){
          const p=m[j]*X+m[4+j]*Y+m[8+j]*Z+m[12+j], signe=p<0?-1:1;
          const rayon=2.6*(Math.abs(m[3]-signe*m[j])+Math.abs(m[11]-signe*m[8+j]))+hy*Math.abs(m[7]-signe*m[4+j]);
          visible=w+rayon>=Math.abs(p);
        }
        if(!visible) continue;
        // Les mêmes feuilles mondiales qu'en .334. Les bandes partagent leur portée
        // avec le fondu WGSL et non avec un seuil en pixels dépendant du rétroviseur.
        for(let f=0;f<(ultra?15:11);f++){
          const taille=f===0?256:f>=3&&f<=10?64:128;
          if(d2>(taille*.215)**2) continue;
          liste[n++]=x*8; liste[n++]=z*8; liste[n++]=f; liste[n++]=taille;
        }
      }
      return n;
    }
    return { maj, visibles, get echantillons() { return echantillons; } };
  }

  const shader = `
struct Source { pos:vec4f, flux:vec4f }
struct Vue {
  vp:mat4x4f, ombre:mat4x4f, oeil:vec4f, soleil:vec4f, direct:vec4f,
  ambiance:vec4f, brume:vec4f, rect:vec4f, vent:vec4f, ecran:vec4f, sources:array<Source,16>
}
@group(0) @binding(0) var<uniform> u:Vue;
@group(0) @binding(1) var sol:texture_2d<f32>;
@group(0) @binding(2) var atlas:texture_depth_2d;
@group(0) @binding(3) var<storage,read> tuiles:array<vec4i>;
struct V { @builtin(position) p:vec4f, @location(0) couleur:vec3f }
fn hash(c:vec2i)->u32 {
  var h = (u32(c.x)*0x9e3779b1u) ^ (u32(c.y)*0x85ebca77u);
  h = (h ^ (h >> 16u))*0x7feb352du; return h ^ (h >> 15u);
}
fn alea(h:u32)->vec2f { return (vec2f(f32(h&255u),f32((h>>8u)&255u))+.5)/256.; }
// Identité du centre de Voronoï le plus proche, en coordonnées monde.
fn colonie(p:vec2f)->vec2f {
  let q=p*.64; let cell=vec2i(floor(q)); var mieux=9.; var direction=vec2f(0.);
  for(var j=-1;j<=1;j++){for(var i=-1;i<=1;i++){
    let c=cell+vec2i(i,j); let h=hash(c);
    let delta=vec2f(c)+.12+.76*alea(h)-q; let d=dot(delta,delta);
    if(d<mieux){mieux=d; direction=delta*.6+alea(h>>16u)-.5;}
  }} return direction;
}
fn ombrage(r:vec3f)->f32 {
  if(u.soleil.w<.5){return 1.;}
  let s=u.ombre*vec4f(r+vec3f(0.,.018,0.),1.);
  let p=s.xyz/s.w*.5+.5;
  if(any(p<=vec3f(.001))||any(p>=vec3f(.999))){return 1.;}
  var uv=p.xy;
  if(u.direct.w<.5){uv=uv*.5+vec2f(.5,0.);}
  uv.y=1.-uv.y;
  let dim=vec2f(textureDimensions(atlas)); let tex=uv*dim-.5; let k=vec2i(floor(tex)); let f=fract(tex);
  let z=p.z-.0007;
  let a=step(z,textureLoad(atlas,k,0)); let b=step(z,textureLoad(atlas,k+vec2i(1,0),0));
  let c=step(z,textureLoad(atlas,k+vec2i(0,1),0)); let d=step(z,textureLoad(atlas,k+vec2i(1,1),0));
  return mix(.32,1.,mix(mix(a,b,f.x),mix(c,d,f.x),f.y));
}
@vertex fn vs(@builtin(vertex_index) vi:u32,@builtin(instance_index) id:u32)->V {
  // Même budget, distribué par importance : une feuille au loin, davantage de
  // feuilles fines dans les 28 puis 14 mètres. Les identités ne dépendent pas de l'œil.
  let tuile=tuiles[id>>8u]; let taille=tuile.w;
  let sousBrin=i32(id&3u); let cellIdx=(id>>2u)&63u;
  let feuille=i32(tuile.z)*4+sousBrin;
  let cell=tuile.xy+vec2i(i32(cellIdx&7u),i32(cellIdx>>3u));
  var v:V; v.p=vec4f(0.,0.,2.,1.); v.couleur=vec3f(0.);
  if(any(cell<vec2i(u.rect.xy))||any(cell>=vec2i(u.rect.zw))){return v;}
  let phys=(cell&vec2i(255))*vec2i(2,1);
  let teinte=textureLoad(sol,phys+vec2i(1,0),0);
  if(teinte.w<=.001){return v;}
  let rnd=alea(hash(cell+vec2i(feuille*139+17,43+sousBrin*67)));
  let tsol=textureLoad(sol,phys,0);
  let n=vec3f(tsol.y,sqrt(max(.01,1.-dot(tsol.yw,tsol.yw))),tsol.w);
  let sub=(vec2f(f32(sousBrin&1),f32(sousBrin>>1))*.5+alea(hash(cell+vec2i(71+feuille*53,29+feuille*97)))*.5-.5)*.44*tsol.z;
  let ecart=sub+(alea(hash(cell+vec2i(457,73+feuille*97)))-.5)*.38*tsol.z;
  let xz=(vec2f(cell)+vec2f(.5))*.45+ecart;
  let racine=vec3f(xz.x,tsol.x-dot(n.xz,ecart)/n.y,xz.y);
  let vers=u.oeil.xyz-racine; let dist=length(vers);
  let portee=f32(taille)*.215;
  let fade=(1.-smoothstep(.62*portee,portee,dist))*smoothstep(.0,.32,teinte.w);
  if(fade<.001){return v;}
  let proj=u.vp*vec4f(racine,1.);
  if(proj.w<-.7 || any(abs(proj.xy)>vec2f(proj.w+.85))){return v;}
  let groupe=colonie(xz); let angle=6.283185*rnd.x;
  let dir=vec2f(cos(angle),sin(angle)); let cote=vec2f(-dir.y,dir.x);
  let temps=u.oeil.w; let vent=u.vent.xy; let courant=vent/max(1.,length(vent));
  let onde=.5+.5*sin(dot(xz,vec2f(.24,.17))-temps*1.9+.7*sin(dot(xz,vec2f(-.11,.08))-temps*.7));
  var souffle=courant*(.09+.45*onde)*min(1.,length(vent)*.3); var couche=0.;
  for(var k=0u;k<u32(u.vent.z);k++){
    let s=u.sources[k]; let delta=xz-s.pos.xz;
    let arriere=-dot(delta,s.flux.xy); let d=length(delta+s.flux.xy*max(arriere,0.));
    let force=s.flux.w*(1.-smoothstep(.2,s.pos.w,d))*(1.-smoothstep(0.,s.flux.z,max(arriere,0.)))*
      (1.-smoothstep(1.,4.,abs(racine.y-s.pos.y)));
    souffle-=s.flux.xy*force; couche=max(couche,force);
  }
  let t=f32(vi>>1u)/2.;
  let largeur=(1.-.72*t*t)*(.027+.031*rnd.y)*fade;
  let hauteur=(.15+.27*rnd.y+.10*length(groupe))*(.62+.38*teinte.w)*fade;
  let pointe=groupe*.72+dir*.5+souffle;
  // Bézier quadratique : pied fixe, contrôle presque vertical, pointe libre.
  let centre=racine+n*hauteur*(t*(1.-.52*couche)-.22*t*t)+
    vec3f(pointe.x,0.,pointe.y)*hauteur*t*t;
  let bord=select(-largeur,largeur,(vi&1u)==1u);
  let monde=centre+vec3f(cote.x,0.,cote.y)*bord;
  v.p=u.vp*vec4f(monde,1.); v.p.z=(v.p.z+v.p.w)*.5;
  let sb=select(-1.,1.,(vi&1u)==1u);
  let normale=normalize(n+vec3f(dir.x,0.,dir.y)*(.20+.48*t)+vec3f(cote.x,0.,cote.y)*(sb*.22));
  let l=u.soleil.xyz; let ombre=ombrage(racine); let vue=vers/max(.01,dist);
  let transmission=pow(max(0.,dot(-vue,l)),3.)*(.25+.75*t)*.36;
  let pigment=mix(teinte.rgb*.88,teinte.rgb*vec3f(1.38,1.15,.70),t*(.35+.65*rnd.y));
  let eclairage=u.ambiance.rgb+ombre*u.direct.rgb*(max(.0,dot(normale,l))+vec3f(1.,.78,.41)*transmission);
  let lin=mix(pigment*eclairage*mix(.58,1.18,t),u.brume.rgb,min(.86,1.-exp(-dist*u.brume.w)));
  v.couleur=pow(max(lin/(lin+vec3f(.76)),vec3f(0.)),vec3f(.4545));
  return v;
}
@fragment fn fs(v:V)->@location(0) vec4f {
  let scr=v.p.xy*u.ecran.xy;
  let vig=pow(max(0.,16.*scr.x*scr.y*(1.-scr.x)*(1.-scr.y)),.13);
  return vec4f(v.couleur*mix(u.ecran.z,1.,vig),1.);
}
`;
  function creer(rendu, decor) {
    const {device, format, depthFormat} = rendu.gpu;
    const texture = device.createTexture({label:'Herbier toroïdal', size:[512,256], format:'rgba32float',
      usage:GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST});
    const vueSol = texture.createView(), u = new Float32Array(64 + 16 * 8);
    const uniform = device.createBuffer({size:u.byteLength, usage:GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
    // Carrés englobants des trois disques + une tuile de marge de chaque côté.
    const liste = new Int32Array(4*(34*34+6*18*18+8*10*10));
    // Second tableau préalloué : le tri par priorité (premier plan d'abord) se fait
    // sans aucune allocation par image, à coût d'enveloppe strictement constant.
    const listeTriee = new Int32Array(liste.length);
    const tuiles = device.createBuffer({size:liste.byteLength, usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
    const map = clipmap(decor, (x,z,w,h,t) => device.queue.writeTexture({texture, origin:[x*2,z]}, t,
      {bytesPerRow:w*32}, [w*2,h]));
    const module = device.createShaderModule({label:'Brins de prairie', code:shader});
    const layout = device.createBindGroupLayout({entries:[
      {binding:0,visibility:GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,buffer:{}},
      {binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:'unfilterable-float'}},
      {binding:2,visibility:GPUShaderStage.VERTEX,texture:{sampleType:'depth'}},
      {binding:3,visibility:GPUShaderStage.VERTEX,buffer:{type:'read-only-storage'}}
    ]});
    const desc = {label:'Prairie proche', layout:device.createPipelineLayout({bindGroupLayouts:[layout]}),
      vertex:{module,entryPoint:'vs'}, fragment:{module,entryPoint:'fs',targets:[{format}]},
      primitive:{topology:'triangle-strip',cullMode:'none'}, depthStencil:{format:depthFormat,depthCompare:'less-equal',depthWriteEnabled:true}};
    const pipelines = new Map();
    function pipeline(count) {
      if (!pipelines.has(count)) pipelines.set(count,device.createRenderPipeline({...desc,multisample:{count}}));
      return pipelines.get(count);
    }
    let publicFx, sources, meteo, parPied, ombre, groupe, regard, enCockpit;
    const compte = {}, mesure = {images:0,candidats:0,totalCandidats:0,picCandidats:0,echantillons:0};
    const fx = {
      gpuShadow(pass,v) { return publicFx?.gpuShadow?.(pass,v); },
      gpuColor(pass,v) {
        const publicVu = publicFx?.gpuColor?.(pass,v);
        const r = map.maj(v.oeil[0],v.oeil[2]);
        let mots=map.visibles(v,parPied===3,liste);
        // Rendu fovéal de la prairie : le tapis continu (f=0 à 55 m) habille symétriquement les deux rives,
        // tandis que la surdensité (f=1 à 27 m, f=3..4 à 14 m) se concentre dans le cône du regard du pilote.
        const maxTuiles=parPied===3?188:148;
        if (mots>0) {
          let ec=0;
          const ox=v.oeil[0], oz=v.oeil[2], avecRegard=!!regard;
          const gx=avecRegard?regard[0]:0, gz=avecRegard?regard[1]:-1;
          const dansCone=(i,seuilCos,distMin2)=>{
            if(!avecRegard)return true;
            const dx=(liste[i]+4)*PAS-ox, dz=(liste[i+1]+4)*PAS-oz, d2=dx*dx+dz*dz;
            if(d2<=distMin2)return true;
            const dotG=(dx*gx+dz*gz)/Math.sqrt(d2);
            return dotG>=seuilCos;
          };
          for(let i=0;i<mots && ec<maxTuiles;i+=4){if(liste[i+2]===0){listeTriee.set(liste.subarray(i,i+4),ec*4);ec++;}}
          for(let i=0;i<mots && ec<maxTuiles;i+=4){if(liste[i+2]===1 && dansCone(i,.48,144)){listeTriee.set(liste.subarray(i,i+4),ec*4);ec++;}}
          for(let i=0;i<mots && ec<maxTuiles;i+=4){if(liste[i+2]===3 && dansCone(i,enCockpit?.78:.70,49)){listeTriee.set(liste.subarray(i,i+4),ec*4);ec++;}}
          if(parPied===3){for(let i=0;i<mots && ec<maxTuiles;i+=4){if(liste[i+2]===4 && dansCone(i,enCockpit?.82:.74,36)){listeTriee.set(liste.subarray(i,i+4),ec*4);ec++;}}}
          liste.set(listeTriee.subarray(0,ec*4),0); mots=ec*4;
        }
        const k=mots*64;
        mesure.images++; mesure.candidats=k; mesure.totalCandidats+=k;
        mesure.picCandidats=Math.max(mesure.picCandidats,k); mesure.echantillons=map.echantillons;
        if (!mots) return publicVu;
        device.queue.writeBuffer(tuiles,0,liste,0,mots);
        u.set(v.vp); u.set(v.ombre.matrice,16); u.set(v.oeil,32); u[35]=v.temps;
        u.set(v.soleil,36); u[39]=+v.ombre.active; u.set(v.couleurSoleil,40); u[43]=+v.ombre.plein;
        u.set(v.ambiance,44); u.set(v.brouillard,48); u[51]=v.densiteBrouillard;
        u.set(r,52);
        u[56]=meteo?.ventX || 0; u[57]=meteo?.ventZ || 0;
        let n=0;
        for (const s of sources || []) {
          if (!s.strength || Math.abs(s.p[0]-v.oeil[0])>96 || Math.abs(s.p[2]-v.oeil[2])>96) continue;
          const vit=Math.hypot(s.velocity[0],s.velocity[2]); if (vit<.5) continue;
          const i=64+n*8; u.set(s.p,i); u[i+3]=s.radius; u[i+4]=s.velocity[0]/vit; u[i+5]=s.velocity[2]/vit;
          u[i+6]=s.wake; u[i+7]=Math.min(1,vit/55)*s.strength; if (++n===16) break;
        }
        u[58]=n;
        u[60]=1/Math.max(1,v.largeur); u[61]=1/Math.max(1,v.hauteur);
        u[62]=rendu.gpu.vignette ?? .59; u[63]=0;
        device.queue.writeBuffer(uniform,0,u);
        if (ombre!==v.ombre.textureView) {
          ombre=v.ombre.textureView;
          groupe=device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:uniform}},
            {binding:1,resource:vueSol},{binding:2,resource:ombre},{binding:3,resource:{buffer:tuiles}}]});
        }
        pass.setPipeline(pipeline(v.msaa || 1)); pass.setBindGroup(0,groupe);
        pass.draw(6,k);
        compte.appels=(publicVu?.appels || 0)+1; compte.triangles=(publicVu?.triangles || 0)+4*k;
        compte.instances=(publicVu?.instances || 0)+k; return compte;
      }
    };
    return {mesure, preparer(pub,s,m,q,reg,cockpit) { publicFx=pub; sources=s; meteo=m; parPied=q==='ultra'?3:2; regard=reg||null; enCockpit=!!cockpit; return fx; },
      liberer() { uniform.destroy(); texture.destroy(); tuiles.destroy(); pipelines.clear(); } };
  }
  B.herbeGPU = {creer,clipmap};
})(globalThis.BITUME = globalThis.BITUME || {});
