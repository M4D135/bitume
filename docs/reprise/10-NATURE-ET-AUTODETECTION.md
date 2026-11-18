# Lot 10 — nature irrégulière, herbe allégée et détection graphique

## Demande — 18 novembre 2026

Base : BITUME 0.2.32 (`5292baf`), FERRO 0.3.8 (`ef722c0`). Le décor, l’herbe et les insectes restent jugés trop symétriques et réguliers. L’utilisateur demande des endroits riches et d’autres vides sur la même carte, davantage de fluidité, puis insiste sur l’optimisation du rendu de l’herbe. Il précise ensuite que l’herbe lointaine doit être simplifiée jusqu’à devenir une zone colorée, pour économiser beaucoup de ressources. Il demande aussi un petit benchmark avant l’écran titre, relançable dans les options et appliquant à nouveau les bons réglages même après modification manuelle.

## Travail borné

1. **Écologie/prairie/décor** : champ déterministe à plusieurs échelles, clairières et poches, aucune symétrie des côtés ; fortes densités dans les zones riches, suppression réelle des instances vides ; sol/route/tunnel et obstacles cohérents. La couverture uniforme du lot09 n’est plus une cible.
2. **Faune** : habitats regroupés et zones vides, quantité/rythme/trajectoires irréguliers ; champ partagé avec la prairie et les fleurs ; pools et désactivation conservés, lucioles seulement à Haut-Col la nuit.
3. **FERRO et illusion lointaine** : brins détaillés près de la voiture, sous-ensemble grossier au milieu, puis seulement des poches colorées sur les nappes déjà présentes. Fondu progressif ; aucune géométrie de brin au loin. Optimisation mesurable des formes et lots d’herbe, moins de travail réellement soumis au moteur ; proximité détaillée et transitions continues ; sources canoniques, qualification puis publication avant installation.
4. **Détection** : mesure courte de scènes du jeu avec vraie cadence de rendu et chronométrage GPU quand disponible. Plusieurs niveaux testés progressivement. Avant le titre si aucun résultat valide n’existe pour cette configuration ; cache local pour conserver ensuite les choix manuels. Bouton « Détecter et appliquer » dans les options, qui remplace seulement les réglages graphiques. Progression, annulation, contexte perdu et onglet masqué gérés ; pas de record, fantôme ou conduite modifiés.
5. **Intégration** : tests utiles des décisions et de l’orchestration, mesures avant/après contre0.2.32, construction reproductible, publication surmain sansforce et reçu court.

## Contrat écologique partagé

`B.ecologie.creer(graine, biome)` expose `echantillonner(x,z,sortie)` ; champs0..1 `herbe`, `fleurs`, `insectes`, `boisement`, sans allocation quand `sortie` est fournie. `decor.ecologie` l’expose sans énumération. Aucune boucle temporelle par brin.

## Limites connues

Le contrôle CUA des fichiers locaux a été refusé explicitement ; aucun contournement navigateur. Mesures Node/instrumentation/EGL à qualifier pour ce qu’elles mesurent, jamais comme FPS de portable ou RTX5090. Accès Mac/amiga absent pour le déploiement, déjà autorisé. Le lien m4d135 Enregistrer et les choix de moment avant départ sont à préserver.

Travail en cours. Détection implémentée et contrôles ciblés passés (10 décisions, 6 intégrations hôte, scène réelle avec frontière de rendu simulée). Portées nominales des brins réduites à45/80/110/150m selon qualité ; les relevés finaux restent à produire après installation moteur. Ne pas confondre ces tests avec un benchmark matériel.

## Précisions ajoutées pendant le lot

- Saisons avant course uniquement : printemps fleuri blanc/rose, été à soleil intense et végétation sèche, automne orange avec feuilles tombantes, hiver enneigé sauf Port-Sable.
- Sources indépendantes Manuel / Aléatoire / Réel pour saison, moment et météo ; date/heure réelles et météo de la localisation approximative IP. Réseau seulement en réel, pas de coordonnées persistées. En ligne : l’hôte impose les mêmes conditions à tous.
- Pluie ruisselant sur la vitre, neige dans l’air et flocons sur la vitre ; budgets adaptés à la qualité, effets propres à chaque moitié en écran partagé.
- Préparation en Circuit / Conditions / Pilotes ; réglages en Image / Pilotage / Son / Commandes. Manette : groupes, stick/croix, maintien, A/B et LB/RB.
- FERRO 0.3.9 publié puis installé (34 modules) : `89c784163b8671676b11f3d4114fab22f6200a7e`.
- Demande suivante isolée en lot11 : 16 circuits mondiaux très différents, examiner les sources Vroom officiel et Vroom Unreal personnel, Islande avec aurores. Ne pas mélanger cette expansion à la qualification courante.

## Gel et reprise de publication — 18 novembre 2026

La copie isolée a repassé les 61 suites, deux builds identiques au build préparé, et les 34 empreintes FERRO 0.3.9. Preuve : `rapports/nature-conditions-menus-2026-11-18/validation-reprise-publication.json`. La revue confirme les conditions communes de l’hôte et l’absence d’accès réseau météo en Manuel/Aléatoire. Les menus se parcourent à la manette ; les champs nom/code du salon nécessitent une saisie clavier ou tactile.

Le contrôle visuel et les FPS matériels restent non mesurés. La publication GitHub est autorisée ; le déploiement `bitume.estrasse.fr` reste à lancer depuis le Mac disposant de l’accès `amiga`. Aucun accès SSH correspondant n’est présent dans la session de reprise.
