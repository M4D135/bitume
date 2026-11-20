# Reprises existantes — inventaire du 20 novembre 2026

## Disponible sur GitHub

[Checkpoint habitacle H1+B2](../preparations/habitacle-commun-2026-11-20/README.md), publié avant cette répartition. Base de son patch : 7c93854e56fc5bc9c1676a6ecb70c727a674db07 ; arbre 35ff18611d787e2a3425ef4de153d6eadd92698a. Il préserve géométrie commune, cuve, siège/yeux/thorax et outils. Contacts extrêmes et continuité du coude restent ouverts ; checkpoint non intégré et non qualifié.

## Travaux plus récents observés localement

| Travail | Branche locale et HEAD | Particularité |
|---|---|---|
| Habitacle | codex/bitume-habitacle-0269-20261120 — 89e4cc35896483fa53d6e586ffe73c9ee261d56b | 16 fichiers utiles, propres ; contient un raccord jeu.js à réserver à 00 |
| Arcade | codex/bitume-arcade-20261120 — f7ef92c9efee9539cb36302665dfac819c43711d | 4 fichiers suivis modifiés, plus menu-arcade.js non suivi ; HEAD seul incomplet |
| Saisons | feat/bitume-saisons-20261120 — 91973c61901f532f04128ce02f5b14a5b578125e | 11 fichiers saisons/outils/tests ; audio ajouté après le commit à séparer |
| Audio Troll | même dossier saisons, même HEAD | son.js et son.test.mjs non commités : trois klaxons synthétisés |
| Worktree Troll | feat/bitume-troll-0270-20261120 — ed086db9c7d9b31d6042e57696ff3f4a8abfad8c | Diff utile identique à l'habitacle, pas de code Troll distinct au relevé |

L'arbre local de référence ef72dddd8db992e424267436a2efc9f3f78f36ca était exactement l'arbre distant d8f02ca, malgré des SHA de commits différents.

Des patches ont été calculés à partir de l'arbre distant vérifié, avec deux lectures identiques par capture. Leurs fichiers n'ont pas pu être transférés avant indisponibilité de l'environnement. **Ces patches ne sont pas fournis ici et ne sont pas déclarés sauvegardés sur GitHub.** Les empreintes ci-dessous permettent d'identifier les captures si elles sont retrouvées, pas de reconstruire leur contenu.

| Capture locale | Octets | SHA256 |
|---|---:|---|
| Habitacle | 195693 | 058fa1793435a220071eec9cc3dab7eb669016535d70064f61c78a0aaafd721b |
| Arcade | 59813 | 65b33f89e91d761525230ff0b05486481e33cd50deee30dff48e922838e4297d |
| Saisons | 54562 | 43403458bcfc466c3cd6759f078e22b8570f86612ccf1c784d9bbad51afcc2d7 |
| Audio Troll | 10958 | b48d3fcc8707d7ef789e1af3450f119334458e40cee5b2d802165bb8d15e8cd9 |

## Reprendre sans perte

Vérifier d'abord les nouvelles branches/PR et les worktrees disponibles. Ne pas réinitialiser leurs fichiers. Récupérer les modifications non commitées et fichiers non suivis utiles avec provenance, puis les qualifier. Les fichiers jeu.js/construire.py restent des raccords pour 00.

Si les brouillons plus récents restent indisponibles, 01 dispose du checkpoint publié ; 03/04/01-audio disposent de leurs contrats et constats. Continuer utilement à partir de ces sources en notant le manque, sans prétendre avoir restauré les fichiers ni leurs validations.

Un remplacement réalisé depuis les spécifications doit être identifié comme une nouvelle implémentation ; il ne clôt pas la récupération de l'ancien travail et ne reprend pas ses preuves de validation.
