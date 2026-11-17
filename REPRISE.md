# BITUME : reprise par lots courts

## Lire ceci en premier

Ce fichier permet de reprendre dans une nouvelle discussion sans recopier les conversations précédentes. Les rôles ci-dessous sont des périmètres de travail, pas des agents déjà lancés. Une discussion exécute un seul lot borné ; les intégrations sont séquentielles.

1. Vérifier la branche par défaut et sa tête distante. Lire `AGENTS.md`, `docs/reprise/ETAT.json`, puis uniquement la fiche du lot choisi et ses sources utiles.
2. Prendre le premier lot prêt dans l'ordre ci-dessous. Si un blocage administratif empêche le lot 0, le documenter et avancer sur le lot 1 sans supprimer de travail.
3. Livrer un correctif cohérent, ses tests et son point de reprise avant de changer de discussion. Un gros lot peut être subdivisé sans étendre son périmètre.
4. Relire la tête distante avant le push. En cas d'avancement concurrent, récupérer et réconcilier, sans force-push. Ne jamais faire écrire deux discussions simultanément sur les fichiers partagés.
5. Mettre à jour la fiche et `ETAT.json` : base, commit livré, fichiers, tests réellement exécutés, résultats, limites et prochaine action. L'identifiant du commit de code peut être inscrit dans une mise à jour documentaire suivante ; ne pas inventer de SHA autoréférentiel.

## Chantier actif — qualité Cat Garden et profils graphiques

**Lire [les demandes et le plan de reprise](docs/reprise/06-QUALITE-CAT-GARDEN.md).** David demande de pousser le détail au maximum en High, un menu Low / Medium / High + Auto et des publications GitHub progressives. Le présent point enregistre les demandes ; les nouveaux sous-lots sont en cours d'intégration. La dernière version de jeu publiée est **0.2.26**, commit `552d3dfd6476a7678b8f7e958922b15ad1094b7c` : la signature de titre ajoutée en parallèle est conservée. La version de ce lot sera **0.2.27**.

Le moteur 0.3.5 est préparé et vérifié hors navigateur ; les profils géométriques et le menu BITUME sont en finalisation. Relire les têtes GitHub avant toute reprise : publication du moteur, puis du jeu dès les contrôles terminés. Le déploiement Mac/amiga et la validation visuelle restent à faire.

## Historique — préparation du 17 novembre 2026, soir

Base de cette reprise : **`main` à `d67506c6d023ad5efa5a3b1ac721811c53a323a2`, BITUME 0.2.24**. Le pilote **0.2.25** du lot 5 a été retrouvé dans la copie de travail de la discussion précédente, avec ses sources, son build et ses preuves. Il comprend les matières et végétaux de Val-Brûlé, les mesures corrigées, le moteur audio de J2, la qualité Auto et les corrections pause/HUD. **Cette préparation a ensuite été publiée sur main au commit `352814f6dca9fbfd837b15e5253bbf33ed30483b`, avec un arbre strictement identique au commit local `6c6a40e`.** Le lot 5 reste partiel : batching des monoplaces, LOD historique et qualification sur appareils réels restent ouverts.

**FERRO 0.3.4 est publié** sur `M4D135/FERRO:main`, commit `457a9671f4ea5c314a5c8e7b3337474ba031c78e`. Les 34 modules de la copie BITUME correspondent à `FERRO.lock.json`. Le candidat visuel initial et le build final ont des empreintes distinctes ; leur qualification et les actions de publication sont détaillées dans [le rapport du lot 5](docs/reprise/rapports/LOT5-2026-11-17.md).

Les archives annoncées introuvables lors du lot 0 ont aussi été **retrouvées dans les copies antérieures de l'environnement ChatGPT** : `BITUME-REPRISE-QWEN-SPARK.zip`, `BITUME-RELAIS-2026-11-17.zip`, le bundle `bitume-main-12dc097.bundle` et les cinq commits cités dans `ETAT.json`. Le constat antérieur concernait les disques Mac/Spark recherchés à ce moment-là ; il ne démontrait pas une perte définitive. Ces anciennes préparations 0.2.14–0.2.20 sont conservées comme historique, sans être fusionnées dans ce lot : la base distante 0.2.24 a poursuivi les travaux depuis.

**Contrôle final avant publication : 43/43 suites Node réussies**, FERRO **34/34** conforme et build 0.2.25 strictement reproductible, SHA256 `9180313f5b33a735a1eb02a7ff1aa3a22646c3baaad9c218e239247d92a83ce5`. Les preuves sont dans [publication-final/](docs/reprise/rapports/lot5-2026-11-17/publication-final/) : `tests.json`, `logs.zip`, `runtime-probe.json`, `browser-audit.json`. Le précédent passage à **42/43**, suivi des 18 contrôles de `decor.test.mjs` réussis isolément, reste conservé dans `reprise-final/` ; aucun seuil n'a été assoupli. **Le nouveau navigateur reste bloqué avant le jeu** : Chromium 156 échoue sur sa socket avant DevTools, y compris sur `about:blank`. Aucun nouveau smoke du HTML final ni banc instrumenté n'est acquis. Les preuves navigateur précédentes restent limitées à leur candidat et à leurs contrôles ciblés.

**Action immédiate :** publier BITUME sur `main` avec les preuves acquises et ces limites explicites ; le reçu du commit sera ajouté après vérification. Le déploiement est déjà autorisé mais **bloqué ici par l'absence d'accès SSH au Mac/amiga et de workflow de déploiement utilisable** ; le site public vérifié sert encore la 0.2.24. La prochaine reprise depuis le Mac devra exécuter `./deposer.sh`, vérifier le site servi, puis mesurer le jeu sur le GPU réel. Ces opérations ne sont pas lancées automatiquement entre deux messages. Les sections suivantes conservent l'historique daté des lots 0 à 4 ; leurs « prochains lots » décrivent leur état d'alors.

## Historique du 17 novembre 2026 (lot 0 terminé)

Base distante : `main`, `b9d8c6db3e4eff55b9f1dd05e8e74de45f2d5507`, client **0.2.19** à cette tête. PR #1 et #2 fermées, aucune PR ouverte, branche par défaut `main`.

Qualification réellement exécutée sur le Spark (`spark-5fc3`, Linux arm64, Node 24.18.0) : **34 suites Node réussies**, `python3 tools/check-ferro-lock.py` conforme (**FERRO 0.3.3, 34/34 modules**), build reproductible identique aux fichiers versionnés (`dist/bitume.html` 12 843 946 octets, gzip 2 945 485, sha256 `c8ac999b71b1944f50cf3d25c42635f2b6db3b72741be9a0def66793ed9ef76e`). Ces résultats ne valident PAS les changements postérieurs.

**Constat du lot 0, avant la récupération du soir :** `BITUME-REPRISE-QWEN-SPARK.zip`, son bundle `bitume-main-12dc097.bundle`, le relais `BITUME-RELAIS-2026-11-17.zip` et les commits `12dc097`, `827c307`, `74352fe`, `a690e92`, `e074b55` n'avaient pas été trouvés sur GitHub ni sur les disques Mac/Spark recherchés. Le lot 0 a donc été construit depuis `main` et sa version 0.2.20 est distincte de la préparation locale retrouvée ensuite. Le rapport historique `docs/reprise/00-DEPOT.md` décrit cette recherche initiale ; son appréciation « non récupérable » est corrigée par la reprise du soir ci-dessus.

`opencode/titre-zip-signature-20261116` (`9e23cc1`) n'était pas fusionnée : son unique apport propre, la signature `m4d135` de l'écran titre, a été réintégré proprement (sans la fermeture `</span>` excédentaire, sans le lien ZIP retiré par le second commit) et couvert par `verifications/titre-signature.test.mjs`. Les six autres branches sont des ancêtres de `main`. Sauvegarde vérifiée avant tout nettoyage : `bitume-toutes-refs-2026-11-17.bundle`, sha256 `4a733d1faf1dec986d89e5bf0969a804f95f6a24463e618fd8897abbaf4fb1ef`.

**Le lot 0 organise le dépôt et réintègre la signature. Les corrections tunnel/crashs/IA/stands/performance des lots 1 à 5 restent à réaliser.**


## Répartition des discussions

| Lot | Fiche | Résultat attendu | Dépendance | Statut |
|---|---|---|---|---|
| 0 | [Dépôt unique](docs/reprise/00-DEPOT.md) | Travail conservé, une seule branche principale | Aucune | **terminé** |
| 1 | [Tunnel et mesures](docs/reprise/01-TUNNEL.md) | Reflets sans apparition brutale, référence de performance et overlay | Base vérifiée | **terminé** |
| 2 | [Crashs et PhysX](docs/reprise/02-CRASHS.md) | Accidents lisibles, pièces détachées bornées, récupération rapide | Lot 1 intégré | **terminé** |
| 3 | [Rivaux agressifs](docs/reprise/03-RIVAUX.md) | Manœuvres offensives contre joueur et autres IA | Lot 2 intégré | **terminé** |
| 4 | [Santé et stands](docs/reprise/04-STANDS.md) | Dégâts persistants visibles et réparations aux stands | Lots 2 et 3 intégrés | **terminé** |
| 5 | [Optimisation et qualification](docs/reprise/05-PERFORMANCE.md) | Gains mesurés, modes et plateformes contrôlés | Lots 1 à 4 intégrés | **pilote local qualifié, publication en attente ; lot partiel** |

## État vérifié le 17 novembre 2026 (lot 1 terminé)

Base de départ : `main` à `fae244f` (lot 0). Livré : commit de code `856dd363150892e74494f045aa8ca94c8e6bbc1d`, client
**0.2.21**, `dist/bitume.html` 12 863 555 octets, gzip 2 951 929, sha256 `40e8a9d50c3dfafb77a4ff117a3e463759a85d9bc9175f155887297ae081fd58`.
Qualification exécutée sur le Spark : **37 suites Node**, FERRO **34/34**, page réellement rendue dans Chrome 151 sans
interface (WebGL2, **aucune erreur de console**), GPU mesuré par les requêtes asynchrones du moteur. Détail et journaux
dans `docs/reprise/rapports/LOT1-2026-11-17.md`.

Un navigateur avec WebGL2 **est** disponible sur le Spark (Chrome sans interface, rendu logiciel ANGLE/SwiftShader) :
la limite « aucun navigateur WebGL2 sur le Spark » inscrite au lot 0 est corrigée ici. Ce navigateur prouve le rendu
WebGL2, l'absence d'erreur et le coût réel des passes ; il ne qualifie **aucun GPU réel** (la carte GB10 n'est pas
exposée aux conteneurs) et ne remplace pas l'avis humain sur une capture. Les mesures de performance restent à prendre
sur le Mac. `verifications/decor.test.mjs` échoue sous concurrence CPU parasite et passe machine calme : ne pas mesurer
pendant un rendu logiciel en arrière-plan.

**Le prochain lot prêt est le lot 2 (crashs et PhysX).**

## État vérifié le 17 novembre 2026 (lot 2 terminé)

Base de départ : `main` à `2a66129` (lot 1). Livré : commit de code `2766f01e2b7a8469ce61056b0ddbd2d652b8fe46`, client
**0.2.22**, `dist/bitume.html` 12 870 767 octets, gzip 2 954 414, sha256 `021d24e8cf51234b240624007523069916b4ebce67311819f1a299d413771761`. **38 suites Node**,
FERRO **34/34**, build reproductible, navigateur réel sans erreur de console. Détail dans
`docs/reprise/rapports/LOT2-2026-11-17.md`.

**Découverte à retenir** : `FPhysX.init()` n'était appelé par personne. Les pièces détachées n'ont jamais été des
corps rigides en navigateur, et les 12 Mo de runtime PhysX de la page ne servaient à rien. C'est corrigé et vérifié
dans Chrome (PhysX 5.12.0 prêt, 6 corps et 5 dalles sur un vrai choc). Le budget est de six pièces par voiture, pool
global de 96, corps supprimés au repos, monde détruit quand la séance meurt.

**Deux points pour David** : (1) le remplacement après accident n'est plus une remise à neuf — la voiture repart
conduisible mais garde traînée, teinte et historique de chocs, la réparation complète étant réservée aux stands du
lot 4 ; (2) la physique changeant, records et fantômes sont versionnés **p9**, les chronos `p8` ne sont plus
comparables.

**Le prochain lot prêt est le lot 3 (rivaux agressifs).**

## État vérifié le 17 novembre 2026 (lot 3 terminé)

Base de départ : `main` à `0c06fa9` (lot 2). Livré : commit de code `7b09e84f35eb38ed9c918ff0325944d9ffea4a50`, client
**0.2.23**, `dist/bitume.html` 12 875 639 octets, gzip 2 955 917, sha256 `eddde8603c57af8962fc2bcfa6cf88edfb67b60809be2bde628f67dc6f8cdd9d`. **39 suites Node**, FERRO
**34/34**, build reproductible, navigateur réel sans erreur de console. Détail dans
`docs/reprise/rapports/LOT3-2026-11-17.md`.

Les rivaux s'engagent désormais sur une cible **atteignable**, avec un **délai de 2,5 s** entre deux attaques, ne
s'acharnent plus sur une voiture **hors service** (tout en la contournant, ce qui avait cassé l'évitement à 80 m/s
dans une première version), et peuvent **tenir leur ligne** au lieu de se rabattre sous le nez d'un poursuivant.
`course.statsIa` compte attaques, abandons, blocages, contacts et temps de décision : en démo réelle, 14 engagements,
12 abandons, 29 blocages, 13 contacts, 0,91 s de temps de décision moyen.

**Le prochain lot prêt est le lot 4 (santé et stands).**

## État vérifié le 17 novembre 2026 (lot 4 terminé)

Base de départ : `main` à `18e69ce` (lot 3). Livré : commit de code `d330084f7bb4bf0a610cef4e8b527ea01c363f54`, client **0.2.24**,
`dist/bitume.html` 12 885 086 octets, gzip 2 959 105, sha256 `baee4977777f70510779b926988d15634a3297c67cdee7b0ddbaa64cbc32187f`.
**40 suites Node**, FERRO **34/34**, build reproductible, navigateur réel sans erreur de console. Détail dans
`docs/reprise/rapports/LOT4-2026-11-17.md`.

La jauge de santé se lit dans le **même état** que les pénalités et la réparation (`B.degats.sante` : adhérence,
traînée, roues, caisse) — rien n'est simulé pour le seul affichage. Les stands existent : voie de 3,2 m le long du bord
droit de la ligne droite, sous le bâtiment que dessine déjà `decor.js`, calculée avec le tracé (`c.stands`), entrée
délibérée à basse vitesse, bridage à 40 km/h, **service à l'arrêt seul**, durée chiffrée d'après l'état constaté. La
réparation complète ne se fait que là : le replacement après crash reste une remise en piste partielle. Entrer aux
stands invalide le tour, comme un replacement. Les rivaux n'y vont pas (règle écrite, tenue par un test) et un pair
distant ne peut pas faire réparer sa voiture. En navigateur : `Neuve` → `40 %` → `Service 3,7 s` → `Neuve`, adhérence
et traînée revenues à 1, teinte à 0.

**Le prochain lot prêt est le lot 5 (performance).**

`src/jeu.js`, `src/course.js`, `src/index.html`, `src/style.css`, `VERSION.json`, `SIZE.json` et `dist/bitume.html` sont des points de jonction : modifications et reconstructions séquentielles uniquement. Les analyses peuvent être indépendantes, pas les pushs concurrents sur la branche principale.

## Contraintes communes et décisions récentes

- Une seule page HTML autonome, hors ligne pour le jeu local, ressources visuelles et sonores procédurales. Préserver l'exception réseau nécessaire au mode en ligne.
- Respecter les empreintes de `FERRO.lock.json` (référence 0.3.3 à la base). Une correction moteur se fait dans le dépôt FERRO source, avec qualification puis propagation explicite, jamais en retouchant une copie verrouillée.
- Conserver la monoplace 1980, la dérive et le turbo, le cockpit détaillé, les commandes personnalisées, les deux joueurs locaux et les deux à quatre pilotes en ligne.
- La taille est mesurée, sans réintroduire l'ancien plafond de 1,4 Mo. `construire.py` gère normalement la version lorsque les sources changent.
- Les nouveaux crashs doivent être spectaculaires sans imposer une longue interruption : récupération en moins d'une seconde, débris pouvant poursuivre leur mouvement. Ne pas rendre la voiture totalement neuve à chaque replacement ; la réparation complète appartient aux stands.
- Aucun gain FPS inventé. Les mesures CPU, GPU et intervalle d'image sont distinctes ; une mesure indisponible reste N/D. Un test Node ne constitue pas une validation WebGL, PhysX navigateur, manette physique ou course WebRTC réelle.
- Cible mobile/Xbox Edge : 60 FPS, pas une garantie non mesurée. Ne pas supprimer du contenu au loin avec un seuil brutal pour atteindre cette cible.
- Pas de création de branches supplémentaires pour organiser les discussions. Publication : la mission du 17/11/2026 autorise explicitement commits, pushs via le Mac et déploiement sur `bitume.estrasse.fr` ; hors ce mandat, `./deposer.sh` reste sur demande de David.

## Fin de chaque lot

Mettre à jour le suivi puis répondre avec : ce qui est livré, commit et branche réels, tests passés/échoués/non exécutés, limite principale, prochain lot. Ne pas recopier l'audit complet ni les journaux dans le chat. Aucune tâche n'est supposée continuer entre deux messages.

## Message pour une nouvelle discussion

> Reprends BITUME dans le dépôt GitHub M4D135/bitume. Lis REPRISE.md et docs/reprise/ETAT.json sur la branche principale actuelle. Exécute uniquement le prochain lot prêt, conserve les contraintes et mets à jour le point de reprise. Ne recharge pas les anciennes discussions et ne crée pas de nouvelle branche.
