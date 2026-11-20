# BITUME — reprise courte

## Lot actif : qualifier et publier la 0.2.66

Base vérifiée sur `main` : **0.2.62 / p15 / FERRO 0.3.15**, huit circuits.
Le candidat **0.2.66** est sauvegardé en [PR #38](https://github.com/M4D135/bitume/pull/38),
tête `1c1ac0c9e190368a02101263ddceb6be0b77240d`, arbre `1f05e9b399e4584b814c4050bad9f5652261b097`.
Sa campagne complète réussit **159/159 suites**, avec **3 405 sources** conformes en contenu
et mode, et le build exact. Ses 48 images de démo sont inspectées (7/7 groupes réussis).
Les captures météo/couverts sont encore en cours. La CI **0.2.65 155/159** reste
conservée avec ses quatre échecs : cinéma, géométrie, allocation des effets et glaces cockpit.

La **0.2.66** corrige ces quatre échecs. Seul changement runtime : parcours indexé
des couverts, **379 764 retours identiques**, allocation des traces ramenée à zéro
dans le contrôle ciblé. Les tests distinguent désormais le neuvième circuit, le vide
latéral du pont et les raccords de chaussée ; la chauffe du banc des glaces est bornée.
Aucun seuil relevé. Les géométries, la conduite p15 et le moteur restent identiques.

Deux builds identiques : **14 370 823 octets**, SHA-256
`18b15fd06d758cc5cb760a6ad90697a860d0b7a03b819c92a2891033e95adf3b`.
Terminer **CI complète et inspection des images de ce candidat** avant fusion.
Suivi exact : `docs/reprise/rapports/COUVERTS-CIMES-2026-11-20/SUIVI-PUBLICATION-0266.json`.
Fiche : `docs/reprise/COUVERTS-CIMES-INTEGRATION-2026-11-20.md`.
Reçu : `docs/reprise/rapports/COUVERTS-CIMES-2026-11-20/CANDIDAT-0266.json`.

## Preuves acquises, à ne pas refaire

- Roulage Cimes : **12 voitures**, un tour + 500 m chacune, sec/pluie/neige ;
  **80 256 sondes**, zéro replacement et zéro pose/vitesse imposée.
- Six portails : **882 rayons** ; joints courbes : **6 864 rayons**. Géométrie inchangée en 0.2.66.
- Allocation pilote : **1,0612 octet/pose**, seuil 4 ; 216 poses identiques.
- Images 0.2.65 : **48 démos + 41 météo + 5 Tunnel du Rocher inspectées**.
  Elles restent attribuées à leur ancien build ; elles ne qualifient pas à elles seules la 0.2.66.
- Régressions ciblées : cinéma 20, géométrie 49, allocations effets 3, couverts 8, voiture 12 contrôles.
  La CI complète 0.2.65 et ses quatre échecs ne sont pas remplacés par ces reprises ciblées.

## Suite et réserves conservées

Neuf circuits dans le candidat ; huit livrés. Sept lieux complets de Cimes, lac/cascade
et programme des **17 destinations** restent dans `docs/reprise/FILE-TRAVAIL.json`.
La pluie extérieure visible depuis un abri reste à corriger : prototype spatial retrouvé,
mais coût CPU et compositing non qualifiés. Le bandeau de démo masque parfois un geste
ou un animal ; la neige reste claire avec un grain discret.
FPS matériels, manettes, écoute, réseau entre machines et déploiement non qualifiés ici.
Durées historiques 188 ms Val-Brûlé et 154/167 ms Haut-Col pour 150 ms ; S8 facultatif
1 031 °/s² pour 300. Monaco : mesures de chaussée non qualifiées, `readyForRuntime=false`.

Objectifs : `docs/reprise/OBJECTIFS-EXECUTION-2026-11-20.md`.
Journal : `docs/reprise/JOURNAL-AUTONOME-2026-11-20.md`.
