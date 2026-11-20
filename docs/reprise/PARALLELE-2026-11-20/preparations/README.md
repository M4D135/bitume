# Préparations portables — non qualifiées

Ces quatre patches sauvegardent les travaux locaux retrouvés pendant la répartition. **Ils ne sont pas appliqués aux sources de main.** Le runtime livré reste 0.2.68.

Base de comparaison : arbre 859b95aa2389da28eb7fb2f96088ca6fa1b46f97, commit distant d8f02ca. Chaque capture a été lue deux fois à contenu et HEAD identiques. Les fichiers non suivis utiles ont été inclus explicitement. Le [MANIFESTE.json](MANIFESTE.json) conserve branches/HEAD locaux, fichiers, tailles et SHA256.

| Patch | Repreneur | Contenu |
|---|---|---|
| [habitacle.patch](habitacle.patch) | 01 ; raccord caméra par 00 | 16 fichiers : modèle commun, cuve/assise, contrôles et outils |
| [arcade.patch](arcade.patch) | 03 ; inclusion du module par 00 | 5 fichiers : écrans/focus/style et nouveau menu-arcade.js |
| [saisons.patch](saisons.patch) | 04 | 11 fichiers : code et vérification des saisons |
| [audio-troll.patch](audio-troll.patch) | 01 | 2 fichiers : trois klaxons et tests son, séparés des saisons |

Le worktree Troll avait le même diff que l'habitacle : un seul patch est conservé. Dist, VERSION/SIZE, images et anciens rapports ne sont pas recopiés.

## Résultat de contrôle

Les quatre patches passent chacun git apply --cached --check sur l'index correspondant à l'arbre de base. Leurs SHA256 ont été relus. **Ce contrôle prouve leur applicabilité individuelle à la base, pas leur compatibilité sur un main plus récent ni la validation du jeu.**

## Reprise

1. Vérifier d'abord les nouvelles branches/PR ; ne pas remplacer un correctif plus récent par le checkpoint.
2. Utiliser un checkout isolé. Lire les chemins du patch et sélectionner ceux du rôle. Un main plus récent peut nécessiter une réconciliation manuelle ; garder le patch original.
3. Confier les hunks de src/jeu.js et construire.py à 00 par raccordements/NN.md. Leur présence historique ne permet pas des écritures concurrentes.
4. Tester la reprise puis commit/push de la branche avec son état. La validation isolée, le raccordement et la qualification du build restent trois étapes distinctes.

Les versions locales candidates ne réservent pas le prochain numéro : 00 construit l'assemblage qualifié avec l'outil du dépôt.
