# Démos, pilotes et météo — 0.2.64

## Résultat candidat

Les branches démos/pilotes et météo sont réunies sur la base publiée p15. Les caméras vérifient le terrain, les solides et les coins de l’objectif ; la poursuite se raccourcit et les plans impossibles changent réellement de support. Les plans de bord de piste réagissent au passage des voitures. Le grain du terrain reste procédural.

Le volant possède son support dans le cockpit ; mains et bras partagent les ancrages des commandes. Le pilote suit les rivaux du regard et réalise des gestes contextualisés, disponibles par commande et montrés par la réalisation. Les gestes ne modifient pas le hasard de la course.

Les dépôts de pluie bougent, fusionnent en conservant leur aire et quittent la visière avec la vitesse. Leur trajectoire alimente la réfraction ; les embruns restent présents à grande vitesse en cockpit et en poursuite. Neige humide et grain d’eau sont procéduraux. Les vues aériennes, la pause et les états des deux joueurs restent séparés.

## Qualification

Reçu : `rapports/DEMOS-PILOTES-METEO-2026-11-20/QUALIFICATION-0264.json`.
Campagne locale récupérée : 150/152 suites. Le test regard arrière a été adapté à la nouvelle interface caméra ; ses 13 contrôles passent. Le test décor passe à la reprise ; le premier dépassement de 165 ms à Val-Brûlé est conservé, cible inchangée de 150 ms. Les deux suites de captures passent aussi.

Le build est reproduit à l’identique ; les 34 modules FERRO 0.3.15 sont conformes au verrou. Les 11 scènes du shader natif correspondent à la source intégrée. La CI complète et les captures du jeu assemblé restent à terminer avant fusion. Conduite p15 conservée.

Le checkpoint 0.2.63 est sauvegardé sur la branche. La revue a ensuite corrigé le retour des gestes lors d’un changement de rapport : 810 poses du rig sans traversée, saut initial du poignet ramené de 29,5 cm à 0,001 mm. La séquence visuelle ramène la main au volant avant le levier ; la boîte physique ne change pas. Reçu : `rapports/DEMOS-PILOTES-METEO-2026-11-20/TRANSITION-GESTE-RAPPORT.json`.

## Suite

Terminer les captures et la publication, puis raccorder les passages couverts et Route-des-Cimes dans un lot distinct. Le reste du programme demeure dans `FILE-TRAVAIL.json`.
