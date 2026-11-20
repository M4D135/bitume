# Démos, pilotes et météo — candidat 0.2.65

## Résultat candidat

Les branches démos/pilotes et météo sont réunies sur la base publiée p15. Les caméras vérifient le terrain, les solides et les coins de l’objectif ; la poursuite se raccourcit et les plans impossibles changent réellement de support. Les plans de bord de piste réagissent au passage des voitures. Le grain du terrain reste procédural.

Le volant possède son support dans le cockpit ; mains et bras partagent les ancrages des commandes. Le pilote suit les rivaux du regard et réalise des gestes contextualisés, disponibles par commande et montrés par la réalisation. Les gestes ne modifient pas le hasard de la course.

Les dépôts de pluie bougent, fusionnent en conservant leur aire et quittent la visière avec la vitesse. Leur trajectoire alimente la réfraction ; les embruns restent présents à grande vitesse en cockpit et en poursuite. Neige humide et grain d’eau sont procéduraux. Les vues aériennes, la pause et les états des deux joueurs restent séparés.

## Qualification

Reçu : `rapports/DEMOS-PILOTES-METEO-2026-11-20/QUALIFICATION-0264.json`.
Campagne locale récupérée : 150/152 suites. Le test regard arrière a été adapté à la nouvelle interface caméra ; ses 13 contrôles passent. Le test décor passe à la reprise ; le premier dépassement de 165 ms à Val-Brûlé est conservé, cible inchangée de 150 ms. Les deux suites de captures passent aussi.

Le build est reproduit à l’identique ; les 34 modules FERRO 0.3.15 sont conformes au verrou. Les 11 scènes du shader natif correspondent à la source intégrée. La CI complète et les captures du jeu assemblé restent à terminer avant fusion. Conduite p15 conservée.

Le checkpoint 0.2.63 est sauvegardé sur la branche. La revue a ensuite corrigé le retour des gestes lors d’un changement de rapport : 810 poses du rig sans traversée, saut initial du poignet ramené de 29,5 cm à 0,001 mm. La séquence visuelle ramène la main au volant avant le levier ; la boîte physique ne change pas. Reçu : `rapports/DEMOS-PILOTES-METEO-2026-11-20/TRANSITION-GESTE-RAPPORT.json`.

## Reprise de qualification — 0.2.65

La CI de la tête `80aa1e2` termine à **151/152 suites**. Les **3 366 sources** de son archive ont été comparées à l’arbre Git : contenus et modes exacts. L’allocation du pilote est reproduite localement puis corrigée sans changer les seuils : **0,6845 octet/pose** contre **16,3099**, avec **864 comparaisons de poses strictement identiques**. Le build monte en 0.2.65.

Deux contrôles de captures étaient incohérents avec le contrat public : l’aérien attendait deux champs privés non exposés ; la poursuite confondait l’exposition du casque avec celle de la caméra située hors du panache. Les contrôles corrigés rejettent respectivement **29 et 48 mutations du rapport réel**, tandis que le cockpit garde ses seuils forts. Les rapports et erreurs initiaux sont conservés. Ce résultat ne qualifie pas de fortes projections sur la lentille de poursuite.

Les reçus de revue couvrent **58 PNG inspectés individuellement** de la 0.2.64, avec leurs empreintes. La nouvelle tête doit encore passer sa CI et ses captures avant fusion. Réserves visuelles : sol clair et répétitif, facettage du relief, bandeau masquant certains détails, gestes majeur/poing peu distincts à 960×540. La séquence tunnel initiale reste à pose fixe et ne prouve pas le passage aux portails ; cette preuve appartient au lot couverts.

## Suite

Terminer les captures et la publication, puis raccorder les passages couverts et Route-des-Cimes dans un lot distinct. Le reste du programme demeure dans `FILE-TRAVAIL.json`.
