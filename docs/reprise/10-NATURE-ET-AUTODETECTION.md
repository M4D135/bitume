# Lot 10 — nature irrégulière, herbe allégée et détection graphique

## Demande — 18 novembre 2026

Base : BITUME 0.2.32 (`5292baf`), FERRO 0.3.8 (`ef722c0`). Le décor, l’herbe et les insectes restent jugés trop symétriques et réguliers. L’utilisateur demande des endroits riches et d’autres vides sur la même carte, davantage de fluidité, puis insiste sur l’optimisation du rendu de l’herbe. Il demande aussi un petit benchmark avant l’écran titre, relançable dans les options et appliquant à nouveau les bons réglages même après modification manuelle.

## Travail borné

1. **Écologie/prairie/décor** : champ déterministe à plusieurs échelles, clairières et poches, aucune symétrie des côtés ; fortes densités dans les zones riches, suppression réelle des instances vides ; sol/route/tunnel et obstacles cohérents. La couverture uniforme du lot09 n’est plus une cible.
2. **Faune** : habitats regroupés et zones vides, quantité/rythme/trajectoires irréguliers ; champ partagé avec la prairie et les fleurs ; pools et désactivation conservés, lucioles seulement à Haut-Col la nuit.
3. **FERRO** : optimisation mesurable des formes et lots d’herbe, moins de travail réellement soumis au moteur ; proximité détaillée et transitions continues ; sources canoniques, qualification puis publication avant installation.
4. **Détection** : mesure courte de scènes du jeu avec vraie cadence de rendu et chronométrage GPU quand disponible. Plusieurs niveaux testés progressivement. Avant le titre si aucun résultat valide n’existe pour cette configuration ; cache local pour conserver ensuite les choix manuels. Bouton « Détecter et appliquer » dans les options, qui remplace seulement les réglages graphiques. Progression, annulation, contexte perdu et onglet masqué gérés ; pas de record, fantôme ou conduite modifiés.
5. **Intégration** : tests utiles des décisions et de l’orchestration, mesures avant/après contre0.2.32, construction reproductible, publication surmain sansforce et reçu court.

## Contrat écologique partagé

`B.ecologie.creer(graine, biome)` expose `echantillonner(x,z,sortie)` ; champs0..1 `herbe`, `fleurs`, `insectes`, `boisement`, sans allocation quand `sortie` est fournie. `decor.ecologie` l’expose sans énumération. Aucune boucle temporelle par brin.

## Limites connues

Le contrôle CUA des fichiers locaux a été refusé explicitement ; aucun contournement navigateur. Mesures Node/instrumentation/EGL à qualifier pour ce qu’elles mesurent, jamais comme FPS de portable ou RTX5090. Accès Mac/amiga absent pour le déploiement, déjà autorisé. Le lien m4d135 Enregistrer et les choix de moment avant départ sont à préserver.

Travail en cours ; remplacer cette mention par les résultats exacts après qualification.
