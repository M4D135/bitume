#!/bin/zsh
# Scènes de fond du prototype : vraies images du jeu (0.2.38, construit dans ce dépôt : dist/bitume.html), prises
# sans affichage ni couches 2D de pluie (#meteo, #vitre), puisque la visière les remplace. Puis, pour scenes.js :
#   capturer-scenes.sh dist/bitume.html <dossier>   (PNG 1280 × 720, et JPEG qualité 86 à côté)
#   python3 fabriquer-scenes.py <dossier>
# Outil : tools/page-essai.mjs du dépôt (Chrome sans interface, page chargée depuis le disque, sans réseau).
PAGE=${1:A}; OUT=${2:A}; mkdir -p $OUT
ICI=${0:A:h}
OUTIL=${ICI:h:h:h:h}/tools/page-essai.mjs
prendre() { # nom, options de BITUME_JEU.reference (objet JS), écart à la voiture de devant (m, 0 = aucune), images
  local nom=$1 ref=$2 suivre=${3:-0} n=${4:-50}
  cat > $OUT/_essai.js <<JS
(async () => {
  const J = BITUME_JEU, B = BITUME, image = () => new Promise(r => requestAnimationFrame(r));
  const style = document.createElement('style');
  style.textContent = '#hud,#demo,#tactile,#meteo,#meteo2,#vitre,#vitre2{display:none!important}';
  document.head.appendChild(style);
  J.reference($ref);
  const co = J.session.course, c = co.c, j = co.joueur;
  let devant = null;
  // Nuage d'eau : on place le joueur à quelques mètres derrière la voiture la plus proche devant lui.
  if ($suivre > 0) {
    let ecart = 1e9;
    for (const v of co.voitures) { if (v === j) continue; const e = B.circuit.ecart(c, j.etat.s, v.etat.s); if (e > 3 && e < ecart) { ecart = e; devant = v; } }
    const et = j.etat; et.s = devant.etat.s - $suivre; et.d = devant.etat.d; et.v = devant.etat.v;
    const e = B.circuit.echantillon(c, et.s); et.y = e.y - et.d * Math.sin(e.devers);
    co.sAvant[j.id] = et.s;
  }
  for (let i = 0; i < $n; i++) await image();
  const s = J.rendu.stats;
  return { toile: [s.width, s.height], joueur: { s: j.etat.s, d: j.etat.d, v: j.etat.v }, devant: devant ? { id: devant.id, s: devant.etat.s, d: devant.etat.d } : null };
})()
JS
  node $OUTIL $PAGE $OUT/_essai.js --capture $OUT/$nom.png --taille 1280,720 > $OUT/$nom.json 2>&1
  sips -s format jpeg -s formatOptions 86 $OUT/$nom.png --out $OUT/$nom.jpg > /dev/null 2>&1
  [[ -s $OUT/$nom.jpg ]] && echo "$nom ok" || echo "$nom ECHEC (voir $OUT/$nom.json)"
}
prendre pluie-course "{ circuit: 2, qualite: 'high', depart: 800, vue: 'cockpit', meteo: 'pluie' }"
prendre pluie-grille "{ circuit: 2, qualite: 'high', depart: 800, vue: 'cockpit', meteo: 'pluie', vitesse: 0 }"
prendre pluie-suivi "{ circuit: 2, qualite: 'high', depart: 800, vue: 'cockpit', meteo: 'pluie' }" 11 8
prendre pluie-poursuite "{ circuit: 2, qualite: 'high', depart: 800, vue: 'poursuite', meteo: 'pluie' }"
prendre hiver-neige "{ circuit: 0, qualite: 'high', depart: 800, vue: 'cockpit', saison: 'hiver', meteo: 'pluie', vitesse: 14 }"
prendre sec-cockpit "{ circuit: 0, qualite: 'high', depart: 800, vue: 'cockpit' }"
rm -f $OUT/_essai.js
