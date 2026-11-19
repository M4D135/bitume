# 12E — qualification CPU de BITUME 0.2.47

**État : qualifié sur les contrôles CPU décrits ci-dessous, avec deux réserves ; publication en cours.**
Ce document vérifie les preuves récupérées de l’exécution du **19 novembre 2026, 11 h 22–11 h 29 (Paris)**.
Aucun test ni build n’a été relancé pendant cette reprise documentaire.

## Résultat exact

- **96/98 suites au premier passage final**, après le bornage des manœuvres de dégagement.
- `traces.test.mjs` : échec hérité, même empreinte observée `e6790758…` que sur la base 0.2.46,
  contre la référence `575fc91d…`. La cause exacte et l’impact visuel restent non établis.
- `decor.test.mjs` : **Haut-Col construit en 194 ms pour un seuil de 150 ms**. Réserve de performance non levée.
  Le suivi 006 mentionne un dépassement sur la base 0.2.46, mais `diagnostic-baseline.json` n’en contient pas
  de mesure. Nous ne pouvons donc pas exclure une régression de performance sur cette seule preuve.
- Déterminisme **p10 : 20 scénarios, 1 300 empreintes**, vérifiés par la suite puis une exécution indépendante.
  La fixture historique p9 est intacte ; les résultats p10 ne réécrivent pas son historique.
- **Neuf parcours**, trois circuits et trois climats : aucune anomalie de valeurs/usure et aucun stagnant
  sans accident ≥15 s mesuré. Trois replacements au total restent présents ; les courses s’arrêtent selon
  leur vraie règle de fin, sans forcer l’arrivée de chaque voiture.
- **Cinq contrôles de dégagement** : le rival au tronc recule et repart sans replacement ; la poche en U
  effectue deux essais puis un secours déjà existant. Aucun pneu n’est remis à neuf par ces manœuvres.

## Intégrité et construction

Les **196 empreintes de sources/tests/fixtures**, les **101 logs de commandes** et les trois fichiers
`VERSION.json`, `SIZE.json`, `dist/bitume.html` correspondent aux preuves récupérées.
Aucune source n’a changé pendant la qualification enregistrée.

Build **0.2.47**, **14 001 233 octets**, deux constructions identiques :

`90afbee41f4d080a7b464572ce5464a9c91c53a560be8458f748229f955135b7`

Les **51 scripts** du HTML ont une syntaxe valide. Les **34 modules FERRO 0.3.11** restent identiques au verrou.
Ces résultats ne constituent pas une validation du rendu WebGL.

## Limites et suite

**WebGL non validé, aucun gain matériel/FPS annoncé, aucun déploiement ni contrôle du site public.**
La tentative de référence avait échoué au démarrage de Chromium, avant l’exécution de la page.
La neige au sol est un état explicite statique ; accumulation/fonte et stratégie de pneus des rivaux restent hors 12E.

Publier puis vérifier le reçu GitHub `PUBLICATION-0247.json`. Le prochain sous-lot est **12F1 — service réel
aux stands et affichage**, préparé dans une autre copie ; la transmission réseau versionnée reste un sous-lot distinct.

Preuves finales : `qualification-finale.json`, `cloture/qualification-execution.json`, `cloture/suites.json`,
`cloture/hashes-apres-qualification.json`, `cloture/viabilite/rapport.json` et `cloture/build.json`.
Les rapports à la racine du dossier 12E antérieurs au bornage restent archivés ; ils ne qualifient pas le build final.
