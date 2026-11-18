#!/bin/sh
# Lot 28A-28C — mesures alternées avant/après du gel au choix du circuit et au changement de saison, Chrome sans
# interface (vraie carte graphique, aucune fenêtre visible) :
#   sh prototypes/calcul/serie-saison.sh <sortie> <page avant> <page après> <circuits> <cpus> <répétitions>
# Les deux pages sont des copies instrumentées (page-instrumentee.py). Chaque essai est un Chrome neuf ; la charge de
# la machine est notée avant chaque essai ; l'ordre avant/après s'inverse d'une répétition à l'autre.
set -eu
ici=$(cd "$(dirname "$0")/../.." && pwd)
sortie=$1; avant=$2; apres=$3; circuits=$4; cpus=$5; reps=$6
mkdir -p "$sortie"
r=0
while [ "$r" -lt "$reps" ]; do
  for cpu in $(echo "$cpus" | tr ',' ' '); do
    for c in $(echo "$circuits" | tr ',' ' '); do
      sed -e "s/__CIRCUIT__/$c/" "$ici/prototypes/calcul/scenario-saison.js" > "$sortie/saison-$c.js"
      if [ $((r % 2)) -eq 0 ]; then ordre="avant apres"; else ordre="apres avant"; fi
      for v in $ordre; do
        if [ "$v" = avant ]; then page=$avant; else page=$apres; fi
        charge=$(sysctl -n vm.loadavg | awk '{print $2}')
        node "$ici/prototypes/calcul/page-mesure.mjs" --page "$page" --script "$sortie/saison-$c.js" --cpu "$cpu" --court 0 \
          --sortie "$sortie/saison-$v-c$c-cpu$cpu-r$r.json" > /dev/null || echo "échec $v c$c cpu$cpu r$r"
        echo "$v c$c cpu$cpu r$r charge $charge"
      done
    done
  done
  r=$((r + 1))
done
