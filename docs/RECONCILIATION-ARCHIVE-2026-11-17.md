# BITUME : réconciliation de l'archive, 17 novembre 2026

## Trois historiques, sans écrasement

- `main` à `7fab6b77fe37e42369e7a936935ed79c0d8cc5f2` : correctifs de commandes 0.2.13 et 0.2.14 du 17 novembre.
- `codex/bitume-reprise4-20261117` à `861c342bee6766f031202ecc7afa0d442d6914fa` : salon corrigé, tests TCP et qualification automatique.
- `archive/versions-0.2.15-0.2.18` à `247d4445e02129af3c28b242eab9783ca3fb010d` : onze commits supplémentaires, à partir de la base commune `d617bffa0bafe6af2170aa88e7b4540b8e969e60`.

L'archive fournie contient les travaux du **16 novembre**, autour de la préparation en ligne et de l'éclairage du tunnel. Ce n'est pas la série locale 0.2.15 à 0.2.18 annoncée le 17 novembre avec le commit `e074b55` et 48 suites. Cette série locale n'est toujours pas retrouvée. Les numéros identiques ne désignent pas les mêmes changements.

Les deux historiques récupérés sont conservés comme parents de la fusion. Aucune réécriture forcée, aucun remplacement de `main` par une ancienne copie. La branche d'archive reste disponible.

## Contenu récupéré et corrigé

L'écran « Avant le départ » annonce circuit, tours et météo. Chaque machine choisit ses pneus, sa boîte, sa vue et ses commandes avant de confirmer. Les pneus choisis sont transmis à l'hôte et affectés aux voitures correspondantes, y compris en écran partagé. Les confirmations sont renouvelées avant la revanche.

Le code d'archive supprimait la définition d'`avecHalo` tout en continuant à l'appeler dans le rendu : la fonction de qualité est rétablie. Les lampes du tunnel restent à puissance fixe, avec l'adaptation oculaire existante. Aucun changement local des modules FERRO n'est introduit.

La nouvelle préparation présentait aussi des courses différées qui pouvaient partir après une annulation. La fusion corrige ces chemins :

- Le délai de 700 ms reste annulable, attaché à la bonne connexion et à la bonne proposition.
- Un retrait d'accord, une nouvelle proposition, un retour au salon, une fermeture ou un changement de partie annule l'ancien départ.
- Une machine encore en connexion ou arrivée pendant le délai n'est plus oubliée. Tous les membres présents doivent être liés et prêts ; quatre pilotes au maximum.
- L'ouverture des réglages et les changements de pneus, boîte ou vue retirent l'accord local.
- Une fermeture depuis les réglages ne renvoie plus vers un écran de confirmation abandonné. Les pneus d'une machine partie sont effacés.
- Les messages nuls, confirmations sans circuit valide et accords provenant d'un membre inconnu sont ignorés.
- Les 30 ms de chargement vérifient encore la connexion avant de lancer la course : quitter entre-temps ne rouvre pas une course fantôme.

Le lien Git `.claude/worktrees/wf_654723d2-ff3-1` de l'archive est exclu : c'est un espace de travail local, pas une dépendance du jeu. Les fichiers HTML et de tailles conflictuels sont reconstruits depuis les sources fusionnées, jamais choisis arbitrairement d'un côté du conflit.

## Version unifiée

**0.2.19** identifie cette fusion, au-dessus des deux séries de numéros déjà utilisées. Cette montée explicite évite d'attribuer les changements récupérés à l'ancienne 0.2.18. `VERSION.json`, `SIZE.json` et `dist/bitume.html` sont synchronisés par `construire.py`.

La physique reste en `p8`. Les corrections récentes de commandes, de manettes, de pause à deux et de protocole du salon sont conservées. Aucun gain de fluidité GPU n'est déduit de cette fusion.

## Vérifications exécutées localement

Environnement : Linux x64, Node 22.16.0.

| Vérification | Résultat |
|---|---|
| Ensemble des suites Node | 34/34 |
| Commandes à deux existantes | 44/44 |
| Manettes existantes | 17/17 |
| Protocole du salon existant | 29/29 |
| Nouvelle suite de préparation en ligne | 23/23 ; 8/23 sur l'archive non corrigée |
| Nouvelle suite de halo et reflets | 6/6 ; 0/6 sur l'archive non corrigée |
| Modules de référence FERRO | 34/34 conformes |
| Syntaxe JavaScript | Valide |

Les nouvelles suites exécutent les fonctions extraites des vraies sources. La préparation simule seulement le DOM, le transport et l'horloge ; les calculs de pneus et météo viennent des modules du jeu. Les 21 échecs initiaux sont des contrôles, pas 21 bugs indépendants.

Commandes de reproduction :

```sh
python3 construire.py
for t in verifications/*.test.mjs; do node "$t" || exit 1; done

git show 247d4445e02129af3c28b242eab9783ca3fb010d:src/jeu.js > /tmp/jeu-archive.js
node verifications/prets-enligne.test.mjs /tmp/jeu-archive.js
node verifications/rendu-halo.test.mjs /tmp/jeu-archive.js
```

Les deux dernières commandes doivent échouer sur l'archive, respectivement avec 8/23 et 0/6 réussites. Les journaux de qualification du commit fusionné sont conservés dans GitHub Actions avec le build et les sources.

## Limites

Chromium démarre dans l'environnement local, mais n'obtient pas de contexte WebGL2, même avec le rendu logiciel demandé. Le rendu, la fluidité GPU et une course WebRTC sur plusieurs machines réelles ne sont donc pas qualifiés ici. La mesure de conduite S8 reste ouverte comme sur la base.

Aucune publication sur `bitume.estrasse.fr` : fusion GitHub et déploiement de production restent deux opérations distinctes.
