# Validation 12F2 — BITUME 0.2.49

## Résultat

**102 suites validées sur 103**. Le passage général a exécuté les 103 suites ; après relecture,
13 suites concernées par les corrections ont été rejouées avec succès. Les résultats initiaux, logs,
commandes, durées et empreintes restent conservés dans ce dossier. L'unique échec restant, `traces.test.mjs`,
est identique à celui de 0.2.48 après exclusion de la durée CPU instrumentée ; voir `reserve-traces.json`.

- Physique **p11**, **20 scénarios et 1 300 empreintes** identiques à la fixture publiée.
- Fixtures p9, p10 et p11 conservées ; aucune génération de nouvelle référence dans ce lot.
- Build **14 024 804 octets** ; deux constructions identiques.
- SHA-256 : `72b18fa2bc3aad3f0735296b5f56b98c67dcb75bcfc77cd3059d1404eb495c9c`.
- **51 scripts** du bundle syntaxiquement valides ; **34 modules FERRO 0.3.11** identiques au verrou.

## Comportements contrôlés

Migration au démarrage, stockage et relecture des choix, Conseillés indépendant et choix manuels persistants.
Le vrai gestionnaire de changement des menus est exécuté, avec DOM et transport bornés. Départs 2+2, 2+1 et 1+2,
retrait de l'accord, messages malformés, versions incompatibles et arrivée tardive sont couverts.

Le choix du prochain arrêt ne modifie ni monte active, ni usure, ni graines. L'interruption conserve les pneus ;
le service complet applique le choix figé une seule fois. Les voitures distantes/IA ne reçoivent aucun service
implicite. En ligne, changer de monte pendant la séance reste désactivé jusqu'à 12F3.

Le rendu CPU des montes après service est comparé aux modèles natifs : quatre niveaux de détail, neuf vues,
roues neuves/usées, cockpit, glaces et épave. Les tables, listes et objets permanents gardent leur identité ;
aucune reconstruction de modèle au changement. Ces tests ne constituent pas une capture WebGL.

## Corrections après le premier passage

Trois harnais ne chargeaient pas encore les nouveaux helpers ou employaient l'ancien format réseau.
Leurs dépendances ont été raccordées au vrai code ; leurs assertions de comportement sont conservées.
Une affectation de livrée ajoutait un champ lors d'un service sans changement de monte : comparaison bit à bit
sur les 75 secondes du scénario, puis correction limitée au changement effectif de type. Les 1 300 empreintes
publiées correspondent à nouveau, sans réécriture de fixture.

La réception du départ vérifie les humains et les capacités de chaque machine avant le traitement.
Le message d'incompatibilité est écrit après le retour au salon pour rester visible.

## Limites

Rendu WebGL et FPS matériels non validés dans cet environnement. Seuil de construction du décor réussi lors
de ce passage, sans lever la réserve de variabilité historique de 12E. Aucun déploiement ni contrôle du site public.
Le transport d'usure/type/services en ligne et la stratégie de stands IA restent hors de 12F2.

## Reproduction

Depuis la racine du dépôt : `python3 docs/reprise/rapports/12F2-2026-11-19/qualifier.py --tests`, puis
`--build` après vérification du manifeste. Le script ne régénère jamais la fixture p11. `requalifier.py`
conserve et explique les corrections du passage initial ; `corrections.json` énumère les fichiers concernés.
Le rapport principal est `qualification-execution.json`.

## Publication vérifiée

Sources, build et preuves publiés au commit `ba9f54bd7a5e5c8d17ec37889c2d414c76831989`, tree identique au snapshot
qualifié. [PR n°3](https://github.com/M4D135/bitume/pull/3) ouverte en brouillon ; aucun changement main ni déploiement
par cette session. Reçu : `PUBLICATION-0249.json`. La fusion reste en attente d'autorisation après refus automatique.
