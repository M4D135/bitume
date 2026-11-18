#!/bin/sh
# Lot 28 « calcul » — série de l'essai Worker et cache (scenario-worker-cache.js) dans la vraie page en file://.
#   sh prototypes/calcul/serie-worker-cache.sh <dossier sortie> <circuits séparés par des virgules> <cpu> <répétitions> [palier]
# Lancer depuis la racine de l'arbre, après python3 construire.py (dist/bitume.html).
sortie=$1; circuits=$2; cpu=$3; reps=$4; palier=${5:-high}
mkdir -p "$sortie"
for c in $(echo "$circuits" | tr ',' ' '); do
  sed -e "s/__CIRCUIT__/$c/" -e "s/__PALIER__/$palier/" prototypes/calcul/scenario-worker-cache.js > "$sortie/wc-$c-$palier.js"
  r=0
  while [ "$r" -lt "$reps" ]; do
    charge=$(sysctl -n vm.loadavg | awk '{print $2}')
    node prototypes/calcul/page-mesure.mjs --page dist/bitume.html --script "$sortie/wc-$c-$palier.js" --cpu "$cpu" --court 200 \
      --sortie "$sortie/wc-c$c-$palier-cpu$cpu-r$r.json" > /dev/null 2>&1
    echo "c$c $palier cpu$cpu r$r charge $charge code $?"
    r=$((r + 1))
  done
done
