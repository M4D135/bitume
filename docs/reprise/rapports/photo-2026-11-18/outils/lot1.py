import json
BORD = "J.camera = () => { const e = ech(880); return { pos: [e.x + Math.sin(e.cap) * 9, e.y + 2.4, e.z - Math.cos(e.cap) * 9], yaw: e.cap + Math.PI / 2 + .12, pitch: -.03, fov: 52 }; };"
HAUT = "J.camera = () => { const e = ech(700); return { pos: [e.x, e.y + 38, e.z], yaw: e.cap + Math.PI / 2, pitch: -.38, fov: 60 }; };"
L = []
for i in range(7):
    L.append({"nom": f"c{i}-cockpit", "ref": {"circuit": i, "qualite": "high", "depart": 800, "vue": "cockpit"}, "n": 45})
    L.append({"nom": f"c{i}-bord", "ref": {"circuit": i, "qualite": "high", "depart": 800, "vue": "poursuite"}, "cam": BORD, "n": 45})
    L.append({"nom": f"c{i}-haut", "ref": {"circuit": i, "qualite": "high", "depart": 800, "vue": "poursuite"}, "cam": HAUT, "n": 45})
json.dump(L, open('lot1.json', 'w'), indent=1)
