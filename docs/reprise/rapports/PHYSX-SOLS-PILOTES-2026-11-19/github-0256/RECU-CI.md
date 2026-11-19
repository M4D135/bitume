# CI du code BITUME 0.2.56

Tête de code : `edf660e5e2cfe2894382460aee0cbec48fa3a748`, arbre `24299b302d894db340b7e8cbadd440047cccdc00`.
La CI de PR utilise le commit de fusion `d40a4b818ca52960709a6137cfc33764af45e6a9`, dont l’arbre a été contrôlé identique.

| Exécution | Résultat | Réserves |
|---|---|---|
| Push [44590341323](https://github.com/M4D135/bitume/actions/runs/44590341323) | 122/123 | Signature historique des traces |
| PR [44590352977](https://github.com/M4D135/bitume/actions/runs/44590352977) | 121/123 | Même signature des traces ; décor Val-Brûlé 152 ms pour seuil 150 ms |

Aucun autre échec. Aucun seuil ni oracle modifié, aucune relance demandée. Les journaux complets accompagnent ce reçu.
Les deux passages reconstruisent le même HTML 0.2.56 de 14 162 317 octets (3 363 224 compressés), avec les 34 modules FERRO 0.3.14 conformes. Le contrôle Git du build reconstruit ne relève aucune différence.

SHA-256 du build : `d93139352b308a1b5c2b3e60b8a15a52803b254577030d470037fa0838ac2e65`.

La signature obtenue des traces est `e6790758bb9758f314e22491651b78ec119837a8dcfbc229c26ab85bb9c897cf`, contre `575fc91df4958254d0404ab5e4d481b3d28394dd6b99c82713733fab06fb6bee` attendue. Elle est identique à la réserve antérieure. Le dépassement de durée du décor reste une réserve de performance ; un succès dans l’autre passage ne prouve pas sa résolution.

Ces CI sont terminées en échec pour les réserves indiquées. Elles ne sont pas présentées comme entièrement vertes et ne remplacent pas une validation du rendu sur le matériel du joueur.
