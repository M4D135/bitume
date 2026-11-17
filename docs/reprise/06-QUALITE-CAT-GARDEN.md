# Qualité Cat Garden — demandes et plan de reprise

Date : 17 novembre 2026. Branche : `main`. Maître d’œuvre unique pour les commits et les fichiers de jonction.

## Demandes explicites de David

1. « je veux une qualité similaire à https://github.com/BubbleBrainBB/awesome-fable-5.2/tree/main/cat-garden, prend le max que tu peux d'asset etc et de techniques features, effets de ce projet pour notre moteur ferro sur bitume ».
2. « a fond on fera un menu low medium high graphics dans les options, pousse àfond les details ».
3. « pousse petit a petit sur github mes demandes le plan etc pour pouvoir continuer facilement si tu plante ».

Ces demandes autorisent la réalisation, les points de reprise, les commits et les pushes successifs. Le déploiement existant reste autorisé, mais requiert le Mac et son accès SSH `amiga`, absents de l'environnement de cette reprise. Garder `main`, ne pas forcer les mises à jour et préserver tout travail concurrent.

## Base réellement publiée

- BITUME **0.2.25** : `352814f6dca9fbfd837b15e5253bbf33ed30483b` ; même arbre que l'ancien commit local `6c6a40e`.
- FERRO **0.3.4** : `457a9671f4ea5c314a5c8e7b3337474ba031c78e`.
- Le commit contenant le présent plan est un **point de reprise documentaire**. Il n'annonce pas que le nouveau rendu est livré.

Une mise à jour concurrente de la signature de l’écran titre a été publiée pendant le chantier : **BITUME 0.2.26**, `552d3dfd6476a7678b8f7e958922b15ad1094b7c` (parent `a617a04`). Ses changements sont conservés. La version attendue pour ce lot devient **0.2.27**.

## Ce que fournit réellement Cat Garden

Référence examinée : `BubbleBrainBB/awesome-fable-5.2`, commit `e0933c7cfd2c26897cd64cc5e4eccc73ffbb3eab`, dossier `cat-garden`.

Le projet génère ses plantes, matériaux et sons avec du code C++/Metal. Il ne contient pas de pack de modèles, textures ou sons à importer ; les images présentes sont des résultats et planches de contrôle. Aucune licence de réutilisation n'a été identifiée. Les ajouts de cette reprise sont donc des implémentations originales de techniques générales, sans reprise de fichiers externes. Son film est rendu hors ligne (3,34 secondes par image en moyenne, selon son README) ; cette valeur n'est pas un objectif de temps d'image pour une course.

## Plan et état au point de reprise

| Étape | État | Contenu |
|---|---|---|
| 1. Référence et provenance | Terminé | Inventaire, techniques utiles, absence d'assets et licence non identifiée |
| 2. FERRO 0.3.5 | Code local stable, publication suivante | Sol organique 25, écorce 26, feuillage 27, transmission colorée, humidité, vent cohérent couleur/ombre, GLSL/WGSL |
| 3. Massifs et sols | En cours de finalisation | Forêt/côte/montagne, herbes/fougères/taillis/fleurs, vraies densités Low/Medium/High |
| 4. Canopées | Profil Medium vérifié, profils Low/High en cours | Trois essences, formes instanciées, masses identiques proche/loin dans chaque profil |
| 5. Options graphiques | En cours | Low/Medium/High/Auto, effets et géométrie effectifs, changement sans redémarrer la course, LOD Auto sans reconstruire le terrain |
| 6. Intégration BITUME 0.2.27 | À terminer | Build autonome, vérification des 34 modules, suite jeu complète, budget des 3 profils et 3 biomes |
| 7. Publications successives | En cours | Plan d'abord, FERRO stable ensuite, BITUME après contrôles ; vérifier les têtes distantes |
| 8. Rendu et matériel réels | Bloqué ici | Chromium échoue avant chargement ; le navigateur distant refuse les URL de fichiers locaux |
| 9. Déploiement | Bloqué ici | Depuis le Mac : mise à jour main puis procédure `./deposer.sh`, empreinte servie et salon à contrôler |

## Contrats techniques

- Modifier le moteur uniquement dans `M4D135/FERRO:src/ferro`, puis propager avec `tools/install-ferro.py`. Ne pas retoucher ses copies verrouillées dans BITUME.
- `FRender.materials.organicSoil = 25`, `fibrousBark = 26`, `botanicalFoliage = 27` ; couleurs et placement restent aux adaptateurs.
- `B.decor.construire(c, {qualite: 'low'|'medium'|'high', matieres, vegetation})` ; profil explicite dans la clé de cache de scène.
- `B.botanique.forme(essence, loin, qualite)` ; essences `feuillu`, `pin`, `conifere` ; module chargé avant le décor.
- `src/graphismes.js` porte les profils du jeu. Low réduit le coût, Medium équilibre, High pousse la géométrie et les effets. Auto garde le gouverneur existant et ajuste les LOD sans reconstruire la course à chaque palier.
- Aucun changement de tracé, solide, nombre d'arbres historique, hasard de simulation ou mécanique. Pas de disparition brusque des plantes en avançant.
- Les 3 profils doivent réellement produire des budgets différents. Mesurer appels et triangles avec les fonctions FERRO, sans présenter ces comptages statiques comme des FPS.

## Vérifications déjà acquises pour le nouveau moteur

FERRO : 122 tests réussis, 0 échec, 1 TODO physique historique ; 9 programmes / 18 stages GLSL→WGSL compilés et validés par Naga ; 34 modules conformes. EMPRISE :installation,construction et contrôlesNode passés après reconstruction du paquet installé. Aucun nouveau rendu navigateur n'est revendiqué.

Les contrôles du profil Medium initial valident les géométries, les empreintes historiques du décor, les collisions inchangées et les enveloppes de LOD. Ils devront être complétés sur les profils finaux. Les performances GPU et l'apparence réelle restent à vérifier, spécialement en High, avec rétroviseurs et écran partagé.

## Fichiers et répartition de travail

- Moteur : dépôt FERRO, `src/ferro/renderer.js`, shaders WGSL, recettes et bundles ; preuves `docs/botanical-035/`.
- Massifs/décor : `src/vegetation.js`, `src/decor.js`, `verifications/vegetation.test.mjs`, `tools/budget-decor.mjs`.
- Arbres : `src/botanique.js`, `verifications/botanique.test.mjs`.
- Menu/profils : `src/graphismes.js`, `src/jeu.js`, `src/index.html`, tests graphiques et outils de capture.
- Intégration : `construire.py`, `FERRO.lock.json`, `FERRO-REFERENCE.md`, `REPRISE.md`, `docs/reprise/ETAT.json`, rapport `docs/rapports/cat-garden-20261117/`.

## À faire immédiatement si la discussion s'interrompt

1. Lire ce plan, `REPRISE.md` et `docs/reprise/ETAT.json`, puis interroger les vrais `main` distants.
2. Retrouver le travail local avant de le réécrire : checkout BITUME `/workspace/scratch/b1c957053a1e/bitume`, FERRO `/workspace/scratch/fee880a8de7f/FERRO` ; qualification temporaire sous `/workspace/scratch/3a3466e63bc5/`.
3. Examiner `git status` et les derniers commits : la rédaction d'un plan ne prouve pas la publication de ses sources.
4. Achever les sous-lots en conservant les demandes High détaillé et menu à 3 niveaux + Auto. Qualifier puis publier par étapes sans forcer.
5. Après chaque publication, vérifier le SHA de `main`, le contenu/version et actualiser le suivi. Ne pas annoncer un déploiement sur la seule preuve du push.
