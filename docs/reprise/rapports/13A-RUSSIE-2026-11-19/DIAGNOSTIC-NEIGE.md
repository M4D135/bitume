# Diagnostic neige et correction d’aménagement

Le premier passage du banc ne pouvait pas observer tous les rivaux : la course se ferme normalement huit secondes après le joueur. Le joueur autonome est donc réglé **avant le départ** à `hab=0.88`. Les commandes publiques, poses, règles de fin et onze vrais rivaux restent inchangés. Le diagnostic initial est conservé dans `russie.json` et `russie-premier-passage.log` ; ce n’est pas la qualification finale.

Le passage `banc-joueur-prudent/` a révélé un vrai accident sous neige : à 108,4417 s, un contact latéral de force 4,2082 entre les voitures 7 et 9 pousse J. Vanmeer à gauche d’une courbe descendante. À 109,8167 s, abscisse 4 709,2668 m, décalage −11,3151 m, il heurte le tronc 1111 à force 30,2292. Un replacement suit à 110,4667 s. La descente vaut −4,55 %, le rayon environ 135 m.

La trace d’observation et son script sont dans `diagnostic-neige/`. `trace.json.gz` conserve intégralement le JSON original ; `TRACE.json` contient ses empreintes avant et après compression. L’observation ne modifie aucune commande ni aucun état.

## Correction retenue

Uniquement pour Baïkal, les allées d’arbres proches sont implantées sur une droite dont toute la portion reste à 2,5 % de pente au plus. Elles ne se trouvent plus à l’extérieur d’une courbe en descente. Les troncs et leurs collisions restent actifs. La nouvelle allée couvre 3 203–3 403 m, côté droit ; ses bornes physiques arrondies à 8 m restent à moins de 1,32 % de pente. Aucun changement de conduite ni de physique p13.

## Validation ciblée après correction

`amenagement-corrige/russie.json` et `russie.log` : **9/9 contrôles**, sources stables, 84 tableaux historiques identiques. Douze voitures accomplissent trois tours dans chaque condition, sans accident, replacement, blocage ou service.

| Condition | Durée simulée | Événements de contact | Chocs | Temps cumulé au rail | Accidents / replacements |
|---|---:|---:|---:|---:|---:|
| Sec | 348,592 s | 94 | 0 | 0 s | 0 / 0 |
| Pluie | 357,383 s | 88 | 1 | 0,725 s | 0 / 0 |
| Neige | 383,808 s | 181 | 1 | 2,358 s | 0 / 0 |

1 134 solides actifs, dont 588 naturels ; marge minimale mesurée entre obstacles naturels et toutes les portions de chaussée : 0,5366 m. Les contacts et frottements sont mesurés ; aucune course sans contact n’est annoncée. La qualification complète et le build sont consignés séparément.
