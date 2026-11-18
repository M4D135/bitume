#!/usr/bin/env python3
"""Maquette du lot 21 (locale, jamais commitée) : quatre retouches de shader dans src/moteur/renderer.js du worktree
photo, pour juger sur image la direction proposée. La construction locale saute le contrôle du verrou FERRO (voir
README) ; remettre ensuite renderer.js, dist, VERSION.json et SIZE.json par git checkout. Chaque ancre doit exister une seule fois."""
import pathlib

F = pathlib.Path(__file__).resolve().parents[5] / 'src/moteur/renderer.js'
t = F.read_text()

TON = """  // BITUME (maquette lot 21) : même courbe que l'historique c/(c+.76), appliquée au canal le plus fort puis à toute la
  // couleur : un gris garde exactement sa valeur, une peinture rouge reste rouge au lieu de virer au saumon. Au-delà
  // de 2, la couleur rejoint peu à peu la courbe par canal pour que le soleil et les reflets blanchissent encore.
  vec3 tonFerro(vec3 c){
    c=max(c,vec3(0.));float m=max(max(c.r,c.g),c.b);
    vec3 parCanal=c/(c+vec3(.76));
    if(m<1e-5)return pow(parCanal,vec3(.4545));
    vec3 teinte=c*(m/(m+.76))/m;
    return pow(mix(teinte,parCanal,smoothstep(2.,8.,m)),vec3(.4545));
  }
"""

def remplacer(ancien, nouveau):
    global t
    n = t.count(ancien)
    assert n == 1, (n, ancien[:80])
    t = t.replace(ancien, nouveau)

# 1. courbe de tons : monde et ciel
remplacer("  float shadow(vec3 n,vec3 l,int slot) {", TON + "  float shadow(vec3 n,vec3 l,int slot) {")
remplacer("    color=color/(color+vec3(.76));\n    color=pow(max(color,vec3(0.)),vec3(.4545));", "    color=tonFerro(color);")
remplacer("  void main(){\n    vec2 uv=vUV*2.-1.;", TON + "  void main(){\n    vec2 uv=vUV*2.-1.;")
remplacer("    color=color/(color+vec3(.76));color=pow(max(color,vec3(0.)),vec3(.4545));", "    color=tonFerro(color);")

# 2. lumière du ciel en hémisphère : bleue d'en haut, renvoi chaud et plus faible d'en bas
remplacer("    light=mix(light,uAmbient*(.72+.28*max(n.y,0.)),outdoors);",
          """    // BITUME (maquette lot 21) : le ciel éclaire d'en haut avec sa couleur, le sol renvoie d'en bas une lumière
    // plus chaude et plus faible. Moyenne proche de l'ancien terme pour ne pas changer l'exposition générale.
    vec3 cielHaut=uAmbient*mix(vec3(1.),uSkyTop/max(max(uSkyTop.r,uSkyTop.g),max(uSkyTop.b,.001)),.30)*1.16;
    vec3 renvoiSol=uAmbient*vec3(1.05,.93,.78)*.56;
    float hemi=n.y*.5+.5;hemi=hemi*hemi*(3.-2.*hemi);
    light=mix(light,mix(renvoiSol,cielHaut,hemi),outdoors);""")

# 3. eau : diélectrique, couleur profonde, petites vagues animées (normales seulement), reflet sans gain
remplacer("      base=vec3(.035,.12,.15)*(.9+sin(uv.x*9.+uEffects.x)*sin(uv.y*7.-uEffects.x*.7)*.1);\n      roughness=.13;metalness=.35;",
          """      // BITUME (maquette lot 21) : eau profonde sombre ; ce qu'on voit vient surtout du reflet (Fresnel).
      base=vec3(.010,.040,.052);
      {
        vec2 q=vWorld.xz;float te=uEffects.x,dEau=length(uEye-vWorld),amp=.32*exp(-dEau/420.);
        #define HAUTEUR_EAU(p) (noise((p)*.18+vec2(te*.07,te*.05))+noise((p)*.55-vec2(te*.16,-te*.11))*.45+noise((p)*1.6+vec2(-te*.35,te*.29))*.18)
        float h0=HAUTEUR_EAU(q),hx=HAUTEUR_EAU(q+vec2(.25,0.)),hz=HAUTEUR_EAU(q+vec2(0.,.25));
        n=normalize(vec3(-(hx-h0)*4.*amp,1.,-(hz-h0)*4.*amp));
      }
      roughness=.07;metalness=0.;""")
remplacer("    vec3 reflected=reflect(-view,n);", "    bool eau=m>11.5&&m<12.5;\n    vec3 reflected=reflect(-view,n);")
remplacer("    color+=environmentReflection*environmentFresnel*(.18+1.3*(1.-roughness)*(1.-roughness))*(.5+metalness*2.5);",
          "    color+=environmentReflection*environmentFresnel*(eau?1.:(.18+1.3*(1.-roughness)*(1.-roughness))*(.5+metalness*2.5));")
remplacer("    if(uPhoto>.5){", "    if(uPhoto>.5&&!eau){")

# 4. brouillard éclairé par le soleil : plus clair et plus chaud dans sa direction
remplacer("    vec3 fogColor=mix(vec3(.009,.018,.024),uFogColor,outdoors);",
          """    // BITUME (maquette lot 21) : la brume diffuse le soleil vers l'avant (contre-jour lumineux, dos au soleil plus bleu).
    float versSoleil=pow(max(dot(-view,normalize(uSunDirection)),0.),6.);
    vec3 fogColor=mix(vec3(.009,.018,.024),mix(uFogColor*.92,uFogColor*.55+uSunColor*.42,versSoleil*.65),outdoors);""")

F.write_text(t)
print('maquette appliquée')
