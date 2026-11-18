#!/bin/zsh
# Captures du prototype dans Chrome sans interface (processeur graphique du Mac), 1280 × 720.
#   capturer.sh <dossier de sortie> [nom 'paramètres d URL' ...]
# Sans liste, prend les états du rapport (ETATS ci-dessous).
ICI=${0:A:h}; OUT=${1:A}; shift; mkdir -p $OUT
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
prendre() { # nom, paramètres
  # Le code de sortie ne dit rien : Chrome écrit l'image puis, parfois, dépasse son délai de fermeture. Seule
  # l'image écrite compte.
  rm -f $OUT/$1.png
  "$CHROME" --headless=new --hide-scrollbars --screenshot=$OUT/$1.png --window-size=1280,720 --virtual-time-budget=4000 \
    "file://$ICI/prototype.html?$2" > /dev/null 2>&1
  [[ -s $OUT/$1.png ]] && echo "$1 ok" || echo "$1 ECHEC"
}
# Contrôle : la page compile ses shaders et va au bout, sinon on s'arrête (le journal dit pourquoi).
if "$CHROME" --headless=new --dump-dom --window-size=1280,720 --virtual-time-budget=4000 "file://$ICI/prototype.html?pluie=1&neige=1&embruns=1&froid=1&humidite=1&vitesse=40" 2>/dev/null | grep -q '<pre id="journal">ERREUR'; then
  "$CHROME" --headless=new --dump-dom --window-size=1280,720 --virtual-time-budget=4000 "file://$ICI/prototype.html?pluie=1" 2>/dev/null | grep -A6 'id="journal"'; exit 1
fi
if (( $# >= 2 )); then while (( $# >= 2 )); do prendre $1 $2; shift 2; done; exit; fi
prendre 01-bruine-250 'scene=pluie-course&pluie=.22&vitesse=250&legende=Bruine, 250 km/h'
prendre 02-forte-pluie-250 'scene=pluie-course&pluie=1&vitesse=250&legende=Forte pluie, 250 km/h'
prendre 03-forte-pluie-grille 'scene=pluie-grille&pluie=1&vitesse=0&legende=Forte pluie, arrêt sur la grille'
prendre 04-nuage-voiture 'scene=pluie-suivi&pluie=.7&vitesse=235&embruns=.95&legende=Dans le nuage d eau d une voiture, 235 km/h'
prendre 05-pluie-exterieure 'scene=pluie-poursuite&pluie=.8&vitesse=220&vue=exterieur&embruns=.35&legende=Pluie, vue extérieure'
prendre 06-neige-legere 'scene=hiver-neige&pluie=0&neige=.3&vitesse=160&froid=.9&humidite=.5&histoire=40&legende=Neige légère, 160 km/h'
prendre 07-forte-neige-lente 'scene=hiver-neige&pluie=0&neige=1&vitesse=45&froid=1&humidite=.7&histoire=120&legende=Forte neige, 45 km/h, accumulation'
prendre 08-sec 'scene=sec-cockpit&pluie=0&vitesse=180&legende=Sec'
# Paliers plus légers et buée, pour comparaison
prendre 09-grille-moyenne 'scene=pluie-grille&pluie=1&vitesse=0&palier=moyenne&legende=Forte pluie, arrêt, palier Moyenne'
prendre 10-grille-legere 'scene=pluie-grille&pluie=1&vitesse=0&palier=legere&legende=Forte pluie, arrêt, palier Légère'
prendre 11-nuage-legere 'scene=pluie-suivi&pluie=.7&vitesse=235&embruns=.95&palier=legere&legende=Nuage d eau, palier Légère'
prendre 12-buee 'scene=pluie-grille&pluie=.25&vitesse=0&froid=.85&humidite=.9&histoire=30&legende=Buée : froid humide, arrêt'
prendre 14-grille-legere-demi 'scene=pluie-grille&pluie=1&vitesse=0&palier=legere&demi=1&legende=Forte pluie, arrêt, Légère à mi-résolution'
# Une autre graine : même temps, autre arrangement des gouttes
prendre 13-grille-graine-7 'scene=pluie-grille&pluie=1&vitesse=0&graine=7&legende=Forte pluie, arrêt, graine 7'
