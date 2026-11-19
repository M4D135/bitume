# CI finale 12F4 — PR #5

SHA de tête vérifié : `6a3fb86a51db46f2d3b2483bedb34d406ebff705`.

Les **deux workflows sont terminés avec la conclusion GitHub `failure`**, chacun à **106 suites réussies / 1 échec**. Le seul échec est `verifications/traces.test.mjs`, avec exactement la signature héritée fournie comme référence. Aucun autre échec n’apparaît dans les 107 résultats de suite de chaque log.

| Événement | Run | Job | Résultat |
|---|---|---|---|
| push | [44550520260](https://github.com/M4D135/bitume/actions/runs/44550520260) | 135652679851 | 106/107, traces uniquement |
| pull_request | [44550618625](https://github.com/M4D135/bitume/actions/runs/44550618625) | 135653025414 | 106/107, traces uniquement |

PR : [M4D135/bitume#5](https://github.com/M4D135/bitume/pull/5).

Signature dans chacun des deux logs :

- Obtenu : `e6790758bb9758f314e22491651b78ec119837a8dcfbc229c26ab85bb9c897cf`.
- Attendu : `575fc91df4958254d0404ab5e4d481b3d28394dd6b99c82713733fab06fb6bee`.

La conservation des artefacts a réussi pour les deux runs. Les métadonnées et digests des artefacts sont conservés dans les reçus ; les archives de 64 Mo n’ont pas été téléchargées. Le run PR a testé le checkout de fusion synthétique `c344f78598ac9c7bb0d9a219d128b7093ab2c8bf` associé à cette tête ; le run push a testé directement le SHA de tête.

`RECU-CI.json` contient les compteurs extraits, les signatures, les IDs et les empreintes des deux logs complets. Les métadonnées initiales/finales, détails des jobs et métadonnées des artefacts sont jointes. `SHA256SUMS` couvre tous les fichiers du reçu sauf lui-même.

Ces actions se limitent aux lectures GitHub et aux sauvegardes sous ce dossier externe. Aucun test ni workflow relancé ; aucune modification du dépôt, aucun commentaire publié, aucune fusion effectuée par cet agent. La fusion éventuelle relève de l’orchestrateur et n’est pas attestée par ce reçu CI.
