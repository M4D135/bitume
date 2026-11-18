#!/bin/sh
# Lot 28 — série de mesures du chemin réel (choix du circuit, préparation, départ) dans Chrome sans interface.
#   sh prototypes/calcul/serie-page.sh <dossier de sortie> <circuits> <cpu> <répétitions> [qualite]
# Chaque essai est un Chrome neuf (profil jetable) ; la charge de la machine est notée avant chaque essai.
set -eu
ici=$(cd "$(dirname "$0")/../.." && pwd)
sortie=$1; circuits=$2; cpu=$3; reps=$4; qualite=${5:-high}
page=/private/tmp/calcul-28/bitume-instrumente.html
mkdir -p "$sortie"
python3 "$ici/prototypes/calcul/page-instrumentee.py" "$ici/dist/bitume.html" "$page" > /dev/null
r=0
while [ "$r" -lt "$reps" ]; do
  for c in $(echo "$circuits" | tr ',' ' '); do
    script="$sortie/menu-$c-$qualite.js"
    sed -e "s/__CIRCUIT__/$c/" -e "s/__QUALITE__/$qualite/" "$ici/prototypes/calcul/scenario-menu.js" > "$script"
    charge=$(sysctl -n vm.loadavg | awk '{print $2}')
    node "$ici/prototypes/calcul/page-mesure.mjs" --page "$page" --script "$script" --cpu "$cpu" --court 0 \
      --sortie "$sortie/menu-c$c-$qualite-cpu$cpu-r$r.json" > /dev/null || echo "échec c$c r$r"
    echo "c$c cpu$cpu r$r charge $charge"
  done
  r=$((r + 1))
done
