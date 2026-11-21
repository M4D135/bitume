# 06 — Pluie extérieure depuis les abris

## Périmètre indépendant

Reprise demandée pendant que la discussion 00 termine les bancs CI et le
candidat 0.2.70. Le module `src/meteo.js` n'est attribué à aucun des rôles
01–05 du registre. Cette discussion prend ce module, ses nouveaux bancs,
son outil de captures et son workflow dédiés. Le raccord `jeu.js` est fourni
dans `raccordements/06-jeu.patch` pour 00, sans modifier le fichier partagé.

Base de travail publiée : `7a8a53ed27a91fdfecc0acfe3d10a9d27a27d2c9`.
Branche : `codex/bitume-p06-pluie-abris-20261120`.
Main observé : `fee69c521eccc0e64cc29f762a6d2244b5ade759`.
Ne pas fusionner le candidat ni modifier les versions/builds, les rétros,
le pilote, le menu, le verrou FERRO ou les états des autres discussions.

## Préparation conservée

Prototype `d3bd240a1bfa02ac1e0dbcc8f5c4cdb3b7176531`, archivé dans
`docs/reprise/preparations/pluie-abris/`. Son module et son banc sont repris
séparément ; le raccord historique est réconcilié avec le jeu assemblé.
Conserver cette provenance et les précédentes preuves d'eau 0.2.68.

## Comportement recherché

- Depuis un tunnel ou une galerie, voir les précipitations réellement dehors.
- Ne rien dessiner sous les plafonds ni à travers les parois et piliers.
- Garder la visière sèche à l'abri, avec séchage des dépôts antérieurs.
- Respecter pluie/neige, pauses, J1/J2, paliers et budgets de pixels/traits.
- Ne lancer aucune requête PhysX loin des couverts ni lorsque la pluie est coupée.
- Préserver graines, climat, géométrie, conduite p15 et FERRO 0.3.15.

## Qualification du sous-lot

Le prototype n'est pas une preuve : mesurer ses raycasts et temps CPU,
vérifier les segments réellement dessinés et le compositing raster. Les
contrôles utilisent le vrai PhysX WASM et le vrai HTML raccordé dans une
copie de qualification. Le HTML de livraison reste à 00.

L'outil Spark requis par le dépôt a été recherché : `kbza` n'est pas dans
PATH et `~/bin/kbza` n'existe pas dans cet environnement. Travail local et
revue séparée ; aucune mesure Xbox/Intel ne sera déduite du banc CPU.

Reprise courte : `etat/06.json`. Contrat : `raccordements/06.md`.
