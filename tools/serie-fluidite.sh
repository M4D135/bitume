#!/bin/zsh
# Série de mesures de fluidité : les mêmes scénarios, sur la page donnée, rangés dans le dossier donné.
#
#   tools/serie-fluidite.sh dist/bitume.html docs/reprise/rapports/<lot>/mesures [toutes|accrocs|logiciel|fenetre]
#
# accrocs  : chemin réel du joueur (titre, préparation, départ), processeur graphique réel, sans interface ;
# logiciel : rendu logiciel, qui amplifie les compilations paresseuses du pilote (accrocs de première utilisation) ;
# fenetre  : fenêtre visible, volet de mesures fermé : la cadence réellement affichée (une fenêtre Chrome s'ouvre).
# À lancer machine au calme et sur secteur. Résumé : python3 tools/resume-fluidite.py <dossier>/*.json
ICI=${0:A:h:h}
PAGE=${1:A}; SORTIE=${2:A}; QUOI=${3:-toutes}
[[ -f $PAGE && -n $2 ]] || { echo "usage : $0 <page.html> <dossier> [toutes|accrocs|logiciel|fenetre]"; exit 2; }
mkdir -p $SORTIE
lancer() { local nom=$1; shift; node $ICI/tools/profil-accrocs.mjs --url "file://$PAGE" --sortie "$SORTIE/$nom.json" "$@" > /dev/null 2> "$SORTIE/$nom.err"; echo "$nom rc=$?"; [[ -s $SORTIE/$nom.err ]] || rm -f "$SORTIE/$nom.err"; }
if [[ $QUOI == toutes || $QUOI == accrocs ]]; then
  lancer a1-depart-c0-fine --scenario depart --circuit 0 --duree 20 --qualite high
  lancer a2-depart-c0-fine-cpu4 --scenario depart --circuit 0 --duree 20 --qualite high --cpu 4
  lancer a3-depart-c2-pluie-fine --scenario depart --circuit 2 --duree 25 --qualite high --meteo pluie
  lancer a4-depart-c2-pluie-fine-cpu4 --scenario depart --circuit 2 --duree 25 --qualite high --meteo pluie --cpu 4
  lancer a5-depart-c6-fine --scenario depart --circuit 6 --duree 20 --qualite high
  lancer a6-depart-c0-duo --scenario depart --circuit 0 --duree 20 --qualite high --partie duo
  lancer a7-depart-c3-auto-cpu4 --scenario depart --circuit 3 --duree 25 --qualite auto --cpu 4
  lancer a8-depart-c0-moyenne-cpu6 --scenario depart --circuit 0 --duree 20 --qualite medium --cpu 6
fi
if [[ $QUOI == toutes || $QUOI == logiciel ]]; then
  lancer l1-logiciel-c0-legere --scenario depart --circuit 0 --duree 40 --qualite low --angle swiftshader --taille 640,360
  lancer l2-logiciel-c2-pluie-moyenne --scenario depart --circuit 2 --duree 40 --qualite medium --meteo pluie --angle swiftshader --taille 480,270
fi
if [[ $QUOI == toutes || $QUOI == fenetre ]]; then
  f() { local nom=$1; shift; lancer $nom --scenario reference --circuit 0 --duree 7 --trace non --mesures non --fenetre oui --taille 1440,900 "$@"; }
  f f1-fenetre-fine --qualite high
  f f2-fenetre-fine-retro-peints --qualite high --retro non
  f f3-fenetre-moyenne --qualite medium
  f f4-fenetre-fine-pluie --qualite high --meteo pluie
  f f5-fenetre-fine-duo --qualite high --partie duo
  f f6-fenetre-fine-poursuite --qualite high --vue poursuite
  f f7-fenetre-legere --qualite low
fi
echo FIN
