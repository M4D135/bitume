import json
BORD = "J.camera = () => { const e = ech(880); return { pos: [e.x + Math.sin(e.cap) * 9, e.y + 2.4, e.z - Math.cos(e.cap) * 9], yaw: e.cap + Math.PI / 2 + .12, pitch: -.03, fov: 52 }; };"
HAUT = "J.camera = () => { const e = ech(700); return { pos: [e.x, e.y + 38, e.z], yaw: e.cap + Math.PI / 2, pitch: -.38, fov: 60 }; };"
def ref(i, vue='poursuite', **k):
    r = {"circuit": i, "qualite": "high", "depart": 800, "vue": vue}; r.update(k); return r
L = []
# moments
for i in (0, 1, 2, 6):
    for m in ('crepuscule', 'nuit'):
        L.append({"nom": f"c{i}-cockpit-{m}", "ref": ref(i, 'cockpit', moment=m), "n": 45})
        L.append({"nom": f"c{i}-bord-{m}", "ref": ref(i, moment=m), "cam": BORD, "n": 45})
L.append({"nom": "c6-haut-crepuscule", "ref": ref(6, moment='crepuscule'), "cam": HAUT, "n": 45})
# pluie
for i in (0, 1, 2):
    L.append({"nom": f"c{i}-cockpit-pluie", "ref": ref(i, 'cockpit', meteo='pluie'), "n": 60})
    L.append({"nom": f"c{i}-bord-pluie", "ref": ref(i, meteo='pluie'), "cam": BORD, "n": 60})
L.append({"nom": "c0-poursuite-pluie", "ref": ref(0, meteo='pluie'), "n": 60})
L.append({"nom": "c0-poursuite", "ref": ref(0), "n": 60})
L.append({"nom": "c0-poursuite-nuit-pluie", "ref": ref(0, meteo='pluie', moment='nuit'), "n": 60})
# saisons
for sa in ('printemps', 'automne', 'hiver'):
    L.append({"nom": f"c0-bord-{sa}", "ref": ref(0, saison=sa), "cam": BORD, "n": 45})
L.append({"nom": "c0-cockpit-hiver", "ref": ref(0, 'cockpit', saison='hiver'), "n": 45})
L.append({"nom": "c3-bord-hiver", "ref": ref(3, saison='hiver'), "cam": BORD, "n": 45})
L.append({"nom": "c5-bord-automne", "ref": ref(5, saison='automne'), "cam": BORD, "n": 45})
json.dump(L, open('lot2.json', 'w'), indent=1)
print(len(L))
