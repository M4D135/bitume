import json
def ref(i, vue='poursuite', **k):
    r = {"circuit": i, "qualite": "high", "depart": 800, "vue": vue}; r.update(k); return r
# caméra posée par rapport à la piste, hauteur prise sur la piste (tunnel)
PISTE = "const surPiste = (s, lat, h, lacet, tangage, fov) => { const e = ech(s), ca = Math.cos(e.cap), sa = Math.sin(e.cap); return { pos: [e.x - sa * lat, e.y + h, e.z + ca * lat], yaw: e.cap + Math.PI / 2 + lacet, pitch: tangage, fov }; };"
# eau : premier point d'eau du côté donné
EAU = """const eauA = (s, cote) => { const e = ech(s), ca = Math.cos(e.cap), sa = Math.sin(e.cap); for (let l = 10; l < 700; l += 2) { const x = e.x - sa * l * cote, z = e.z + ca * l * cote; if (d.sol(x, z) < d.niveauEau) return { x, z, l, e }; } return null; };"""
SOLEIL = "const sol0 = J.scene.decor.atmosphere.sunDirection, sh = Math.hypot(sol0[0], sol0[2]), sx = sol0[0] / sh, sz = sol0[2] / sh;"
L = []
# --- eau, Port-Sable (c1) : rivage à droite vers s = 800
L.append({"nom": "c1-eau-rivage", "ref": ref(1), "n": 45, "cam": EAU + """
const w = eauA(800, 1), ca = Math.cos(w.e.cap), sa = Math.sin(w.e.cap);
const pos = [w.x + sa * 25, d.niveauEau + 5, w.z - ca * 25];
J.camera = () => viser(pos, [w.x - sa * 60, d.niveauEau, w.z + ca * 60], 60); info = { eau: w.l, niveau: d.niveauEau };"""})
L.append({"nom": "c1-eau-haut", "ref": ref(1), "n": 45, "cam": EAU + """
const w = eauA(800, 1), ca = Math.cos(w.e.cap), sa = Math.sin(w.e.cap);
const pos = [w.x + sa * 20, d.niveauEau + 28, w.z - ca * 20];
J.camera = () => viser(pos, [w.x - sa * 25, d.niveauEau, w.z + ca * 25], 60);"""})
L.append({"nom": "c1-eau-contre-jour", "ref": ref(1), "n": 45, "cam": EAU + SOLEIL + """
const w = eauA(800, 1), ca = Math.cos(w.e.cap), sa = Math.sin(w.e.cap);
const P = [w.x - sa * 60, d.niveauEau, w.z + ca * 60];
const pos = [P[0] - sx * 70, d.niveauEau + 3.5, P[2] - sz * 70];
J.camera = () => viser(pos, [P[0] + sx * 200, d.niveauEau + 6, P[2] + sz * 200], 60);"""})
L.append({"nom": "c1-eau-rivage-pluie", "ref": ref(1, meteo='pluie'), "n": 60, "cam": EAU + """
const w = eauA(800, 1), ca = Math.cos(w.e.cap), sa = Math.sin(w.e.cap);
const pos = [w.x + sa * 25, d.niveauEau + 5, w.z - ca * 25];
J.camera = () => viser(pos, [w.x - sa * 60, d.niveauEau, w.z + ca * 60], 60);"""})
L.append({"nom": "c1-eau-rivage-nuit", "ref": ref(1, moment='nuit'), "n": 45, "cam": EAU + """
const w = eauA(800, 1), ca = Math.cos(w.e.cap), sa = Math.sin(w.e.cap);
const pos = [w.x + sa * 25, d.niveauEau + 5, w.z - ca * 25];
J.camera = () => viser(pos, [w.x - sa * 60, d.niveauEau, w.z + ca * 60], 60);"""})
# --- eau, Cap-Séquoia (c6) : falaises à gauche vers s = 350
L.append({"nom": "c6-falaise-haut", "ref": ref(6, depart=350), "n": 45, "cam": EAU + """
const w = eauA(350, -1), ca = Math.cos(w.e.cap), sa = Math.sin(w.e.cap);
const pos = [w.x + sa * 12, d.sol(w.x + sa * 12, w.z - ca * 12) + 3, w.z - ca * 12];
J.camera = () => viser(pos, [w.x + sa * 80, d.niveauEau, w.z - ca * 80], 62); info = { eau: w.l, niveau: d.niveauEau, piste: w.e.y };"""})
L.append({"nom": "c6-falaise-mer", "ref": ref(6, depart=350), "n": 45, "cam": EAU + """
const w = eauA(350, -1), ca = Math.cos(w.e.cap), sa = Math.sin(w.e.cap);
const pos = [w.x + sa * 120, d.niveauEau + 6, w.z - ca * 120];
J.camera = () => viser(pos, [w.x, d.niveauEau + 25, w.z], 60);"""})
L.append({"nom": "c6-falaise-contre-jour", "ref": ref(6, depart=350), "n": 45, "cam": EAU + SOLEIL + """
const w = eauA(350, -1), ca = Math.cos(w.e.cap), sa = Math.sin(w.e.cap);
const P = [w.x + sa * 150, d.niveauEau, w.z - ca * 150];
const pos = [P[0] - sx * 60, d.niveauEau + 4, P[2] - sz * 60];
J.camera = () => viser(pos, [P[0] + sx * 200, d.niveauEau + 8, P[2] + sz * 200], 60);"""})
# --- ombres : arbre proche de la piste (Val-Brûlé), voiture, portique
TROUVER_ARBRE = """
const [tx, tz] = d.arbres[__K__]; let best = Infinity, bi = 0;
for (let j = 0; j < c.n; j++) { const q = (c.x[j] - tx) ** 2 + (c.z[j] - tz) ** 2; if (q < best) { best = q; bi = j; } }
J.reference(Object.assign({}, REF, { depart: bi * 2 - 20, vitesse: 8 }));
const vx = c.x[bi] - tx, vz = c.z[bi] - tz, l = Math.hypot(vx, vz);
const pos = [tx + vx / l * __D__, d.sol(tx + vx / l * __D__, tz + vz / l * __D__) + 1.7, tz + vz / l * __D__];
const cible = [tx, d.sol(tx, tz) + __Y__, tz];
J.camera = () => viser(pos, cible, __F__); info = { arbre: [tx, tz], distancePiste: Math.sqrt(best) };"""
L.append({"nom": "c0-ombre-arbre", "ref": ref(0), "n": 45, "cam": TROUVER_ARBRE.replace('__K__', '457').replace('__D__', '13').replace('__Y__', '2.2').replace('__F__', '60')})
L.append({"nom": "c0-ombre-arbre-loin", "ref": ref(0), "n": 45, "cam": TROUVER_ARBRE.replace('__K__', '651').replace('__D__', '26').replace('__Y__', '3').replace('__F__', '60')})
L.append({"nom": "c5-ombre-arbre", "ref": ref(5), "n": 45, "cam": "" })
VOITURE_34 = "J.camera = (p) => { const ca = Math.cos(p.cap), sa = Math.sin(p.cap); const pos = [p.x + ca * 3.4 + sa * 2.6, p.y + 1.15, p.z + sa * 3.4 - ca * 2.6]; return viser(pos, [p.x + ca * .2, p.y + .35, p.z + sa * .2], 38); };"
VOITURE_HAUT = "J.camera = (p) => { const ca = Math.cos(p.cap), sa = Math.sin(p.cap); const pos = [p.x - ca * 1.5 + sa * 3.2, p.y + 4.2, p.z - sa * 1.5 - ca * 3.2]; return viser(pos, [p.x + ca * .6, p.y + .1, p.z + sa * .6], 45); };"
VOITURE_ARR = "J.camera = (p) => { const ca = Math.cos(p.cap), sa = Math.sin(p.cap); const pos = [p.x - ca * 4.5 - sa * 1.6, p.y + .55, p.z - sa * 4.5 + ca * 1.6]; return viser(pos, [p.x + ca * .5, p.y + .3, p.z + sa * .5], 40); };"
L.append({"nom": "c0-voiture-34", "ref": ref(0, vitesse=20), "n": 45, "cam": VOITURE_34})
L.append({"nom": "c0-voiture-haut", "ref": ref(0, vitesse=20), "n": 45, "cam": VOITURE_HAUT})
L.append({"nom": "c4-voiture-34", "ref": ref(4, vitesse=20), "n": 45, "cam": VOITURE_34})
L.append({"nom": "c0-voiture-arriere-pluie", "ref": ref(0, vitesse=20, meteo='pluie'), "n": 60, "cam": VOITURE_ARR})
L.append({"nom": "c0-voiture-34-crepuscule", "ref": ref(0, vitesse=20, moment='crepuscule'), "n": 45, "cam": VOITURE_34})
PORTIQUE = """
J.reference(Object.assign({}, REF, { depart: 25, vitesse: 6 }));
const f = d.portique.feux[2], e0 = ech(0), ca = Math.cos(e0.cap), sa = Math.sin(e0.cap);
const pos = [e0.x - ca * 26 + sa * 12, e0.y + 2.2, e0.z - sa * 26 - ca * 12];
J.camera = () => viser(pos, [f[0] + ca * 6, f[1] - 4.5, f[2] + sa * 6], 62);"""
for i in (0, 4, 6):
    L.append({"nom": f"c{i}-portique", "ref": ref(i), "n": 45, "cam": PORTIQUE})
# --- piste mouillée, caméra basse
L.append({"nom": "c0-piste-mouillee", "ref": ref(0, meteo='pluie', vitesse=12), "n": 70, "cam": PISTE + "J.camera = () => surPiste(780, 2.5, .75, 0, -.03, 50);"})
L.append({"nom": "c0-piste-mouillee-soleil", "ref": ref(0, meteo='pluie', vitesse=12), "n": 70, "cam": PISTE + SOLEIL + "const yawS = Math.atan2(sx, -sz); J.camera = () => { const q = surPiste(790, 0, .9, 0, -.05, 55); q.yaw = yawS; return q; };"})
L.append({"nom": "c0-piste-seche-soleil", "ref": ref(0, vitesse=12), "n": 70, "cam": PISTE + SOLEIL + "const yawS = Math.atan2(sx, -sz); J.camera = () => { const q = surPiste(790, 0, .9, 0, -.05, 55); q.yaw = yawS; return q; };"})
L.append({"nom": "c2-piste-mouillee-nuit", "ref": ref(0, meteo='pluie', moment='nuit', vitesse=12), "n": 70, "cam": PISTE + "J.camera = () => surPiste(780, 2.5, .75, 0, -.03, 50);"})
# --- tunnel (Haut-Col)
L.append({"nom": "c2-tunnel-entree", "ref": ref(2, 'cockpit', depart='tunnel'), "n": 40})
L.append({"nom": "c2-tunnel-dedans", "ref": ref(2, 'cockpit', depart='tunnel'), "n": 150})
L.append({"nom": "c2-tunnel-libre", "ref": ref(2, depart='tunnel'), "n": 150, "cam": PISTE + "J.camera = () => surPiste(c.tunnel.debut + 90, -3.5, 1.4, .05, .02, 60);"})
L.append({"nom": "c2-tunnel-sortie", "ref": ref(2, depart='tunnel'), "n": 150, "cam": PISTE + "J.camera = () => surPiste(c.tunnel.fin - 70, 2.5, 1.2, 0, .0, 60);"})
L.append({"nom": "c2-tunnel-nuit", "ref": ref(2, 'cockpit', depart='tunnel', moment='nuit'), "n": 150})
L = [x for x in L if x.get('cam', None) != '']
json.dump(L, open('lot3.json', 'w'), indent=1)
print(len(L))
