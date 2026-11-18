#!/bin/sh
# Lot 28 — profil des calculs par image : sh prototypes/calcul/serie-banc.sh <sortie> <cpu> '<options JSON>' <nom>
set -eu
ici=$(cd "$(dirname "$0")/../.." && pwd)
sortie=$1; cpu=$2; options=$3; nom=$4
mkdir -p "$sortie"
avant=$(echo "$options" | sed 's/"duree": *[0-9]*/"duree": 2/')
printf '(async () => { await BITUME_JEU.banc(%s); return true; })()' "$avant" > "$sortie/avant-$nom.js"
sed "s|__OPTIONS__|$options|" "$ici/prototypes/calcul/scenario-banc.js" > "$sortie/banc-$nom.js"
charge=$(sysctl -n vm.loadavg | awk '{print $2}')
node "$ici/prototypes/calcul/page-mesure.mjs" --page "$ici/dist/bitume.html" --avant "$sortie/avant-$nom.js" --script "$sortie/banc-$nom.js" \
  --cpu "$cpu" --profil oui --court 0 --sortie "$sortie/banc-$nom-cpu$cpu.json" > /dev/null || echo "échec $nom"
echo "$nom cpu$cpu charge $charge"
