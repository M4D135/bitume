# BITUME — reprise courte

## Priorité — modèle 126 CK demandé par David

Les cockpits **.75 et .76 sont refusés**. La référence actuelle est la
**126 CK RenderBlade**, avec toutes ses images récupérées :
[40 vues détaillées + couverture](docs/references/ferrari-126ck-renderblade-2026-11-21/README.md).
La 312 T5 reste historique, elle n'est plus l'objectif de forme.
**Références publiées sur main**, PR 53, commit `eb10c539` ;
[reçu et vérification des 41 originaux](docs/references/ferrari-126ck-renderblade-2026-11-21/PUBLICATION.json).

Lire la [fiche active](docs/reprise/OBJECTIF-126CK-2026-11-21.md), puis seulement
`etat_courant` dans `docs/reprise/ETAT.json`. Prochaine action : reconstruire
fidèlement le poste et la voiture depuis ces vues. FOV demandé : **70°**.
Une galerie publiée ne vaut pas modèle corrigé ou validé.

## État réel

Main livre encore **0.2.75 / p15 / FERRO 0.3.15**, PR 51. Les preuves de publication
sont conservées, mais elles n'approuvent plus la forme du cockpit.
Le candidat [PR 52 (.76)](https://github.com/M4D135/bitume/pull/52) est clos sans fusion :
volant/tableau refusés, reflets des miroirs vers le sol/pneu, CI générales en échec.
Une inclinaison mécanique des glaces est en préparation isolée, sans nouveau build.
Pluie/neige calmes dos au vent, trois nouveaux klaxons et FOV 70° restent préparés
sur la branche .76 ; aucune de ces corrections n'est annoncée livrée sur main.

## Autres travaux conservés

[Huit idées issues de satyam-fp/race](docs/reprise/REFERENCE-RACE-2026-11-21.md)
sont raccordées aux lots existants : décor, matières, coût de rendu et retour de conduite.
PR 43, M1, états propriétaires et sources Monaco/Marseille préservés.
Décor en pause : comparaison 82/117 cas, aucun gain CPU prouvé, réserve <150 ms ouverte.
FPS matériels, manettes, écoute et réseau réel non qualifiés. Aucun déploiement.

[FILE-TRAVAIL](docs/reprise/FILE-TRAVAIL.json) · [Journal](docs/reprise/JOURNAL-AUTONOME-2026-11-20.md), entrée **040**.
