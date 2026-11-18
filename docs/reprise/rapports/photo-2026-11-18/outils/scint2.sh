#!/bin/zsh
# Vue extérieure fixe sur un feuillu de Val-Brûlé ; vue « poursuite » : le carré d'ombre suit la voiture du joueur qui
# roule, la caméra et le décor restent fixes. Vent figé (temps du rendu gelé) ou libre.
cd "$(dirname "$0")"
CAM='const [tx, tz] = d.arbres[457]; let best = Infinity, bi = 0; for (let j = 0; j < c.n; j++) { const q = (c.x[j] - tx) ** 2 + (c.z[j] - tz) ** 2; if (q < best) { best = q; bi = j; } } J.reference(Object.assign({}, REF, { depart: bi * 2 - 45 })); const vx = c.x[bi] - tx, vz = c.z[bi] - tz, l = Math.hypot(vx, vz); const pos = [tx + vx / l * 13, d.sol(tx + vx / l * 13, tz + vz / l * 13) + 1.7, tz + vz / l * 13]; const cible = [tx, d.sol(tx, tz) + 2.2, tz]; J.camera = () => viser(pos, cible, 60); info = { arbre: [tx, tz], distancePiste: Math.sqrt(best) };'
REG='[[0.2,0.15,0.9,0.7]]'
run() { python3 lancer.py scintillement.js "$1" "{\"__REF__\": {\"circuit\": 0, \"qualite\": \"high\", \"vue\": \"tele\", \"retro\": \"non\", \"ombres\": \"$2\"}, \"__CAM__\": $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$CAM"), \"__CHAUFFE__\": 30, \"__FIGER__\": $3, \"__OVERRIDE__\": {}, \"__REGIONS__\": $REG, \"__N__\": 80}" > /dev/null; }
run scint-tele-arbre-high-fige.json high true
run scint-tele-arbre-medium-fige.json medium true
run scint-tele-arbre-off-fige.json off true
run scint-tele-arbre-high-vent.json high false
run scint-tele-arbre-off-vent.json off false
