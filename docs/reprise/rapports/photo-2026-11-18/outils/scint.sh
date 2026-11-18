#!/bin/zsh
# Indice de scintillement : cockpit (régions de carrosserie fixes à l'écran) et vue extérieure fixe (centre d'ombre qui suit la voiture)
cd "$(dirname "$0")"
COCK='[[0.02,0.83,0.30,0.97],[0.78,0.81,0.98,0.93]]'
for q in high medium off; do
  python3 lancer.py scintillement.js scint-cockpit-$q.json "{\"__REF__\": {\"circuit\": 0, \"qualite\": \"high\", \"vue\": \"cockpit\", \"retro\": \"non\", \"ombres\": \"$q\"}, \"__CAM__\": \"\", \"__CHAUFFE__\": 60, \"__FIGER__\": false, \"__OVERRIDE__\": {}, \"__REGIONS__\": $COCK, \"__N__\": 90}" > /dev/null
done
