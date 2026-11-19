#!/bin/sh
# Captures du lot 20 : appliquer integration.patch, construire la page (python3 construire.py), puis
#   sh docs/reprise/rapports/echappement-2026-11-18/captures.sh
# Chaque capture relance Chrome (tools/page-essai.mjs, ou OUTIL) sur la course de référence (circuit 0,
# graine 17017, départ à 40 m/s) et écrit capture-<nom>.png et mesures-<nom>.json.
ici=$(cd "$(dirname "$0")" && pwd)
racine=$(cd "$ici/../../../.." && pwd)
outil=${OUTIL:-$racine/tools/page-essai.mjs}
capture() {
  nom=$1; params=$2
  sed "s|PARAMS|$params|" "$ici/capture-echappement.js" > "$ici/.essai-$nom.js"
  node "$outil" "$racine/dist/bitume.html" "$ici/.essai-$nom.js" --capture "$ici/capture-$nom.png" --taille 1280,720 > "$ici/mesures-$nom.json"
  rm -f "$ici/.essai-$nom.js"
  echo "$nom"
}
capture jour-passage "{ moment: 'jour', cas: 'passage', circuit: 0, graine: 17017 }"
capture jour-gros-plan "{ moment: 'jour', cas: 'gros-plan', circuit: 0, graine: 17017 }"
capture jour-lever "{ moment: 'jour', cas: 'lever', circuit: 0, graine: 17017 }"
capture jour-rival "{ moment: 'jour', cas: 'rival', circuit: 0, graine: 17017 }"
capture jour-retro "{ moment: 'jour', cas: 'retro', circuit: 0, graine: 17017 }"
capture nuit-passage "{ moment: 'nuit', cas: 'passage', circuit: 0, graine: 17017 }"
capture nuit-lever "{ moment: 'nuit', cas: 'lever', circuit: 0, graine: 17017 }"
capture nuit-rival "{ moment: 'nuit', cas: 'rival', circuit: 0, graine: 17017 }"
capture legere-passage "{ moment: 'jour', cas: 'passage', circuit: 0, graine: 17017, qualite: 'low' }"
