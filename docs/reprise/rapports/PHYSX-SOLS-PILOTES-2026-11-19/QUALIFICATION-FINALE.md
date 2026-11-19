# BITUME 0.2.56 / p14 — qualification locale consolidée

## Résultat et portée

**122 suites passantes sur 123 dans les preuves locales consolidées.** Après réconciliation des branches et installation officielle de **FERRO 0.3.14**, douze suites ciblées passent sur **234 fichiers de source et de test restés identiques** pendant leur exécution. Le seul échec de la consolidation est la signature historique de `traces.test.mjs`. La réserve de durée du décor reste documentée séparément. La publication GitHub et son résultat CI doivent être attestés dans leur propre reçu.

Ce bilan ne représente pas un balayage complet unique des 123 suites sur le commit final. Il conserve le passage initial, remplace les résultats concernés par leurs reprises, puis ajoute les cinq suites apparues depuis. Le [registre JSON](QUALIFICATION-FINALE.json) associe chaque suite à son journal et à l’empreinte de son test. Les [douze reprises 0.3.14](reconciliation-0314/reprises.json), les [empreintes finales](reconciliation-0314/empreintes-apres.json) et leur [notice](reconciliation-0314/README.md) fixent la portée de la validation courante.

| Étape | Résultat | Preuve |
|---|---|---|
| Balayage initial | 115/118 ; échecs autoconfig, déterminisme p14, traces | [Résultats complets](qualification-complete/resultats.json) |
| Corrections du checkpoint 62c9461 | Autoconfig et déterminisme repris ; quatre suites ajoutées, soit 121/122 consolidé | [Archive 0.2.55](checkpoints/62c9461/QUALIFICATION-FINALE.json) |
| Réconciliation avec b8f0507 et FERRO 0.3.14 | Une suite circuits ajoutée ; stands étendu de huit à onze contrôles ; douze reprises passantes | [Reprises 0.3.14](reconciliation-0314/reprises.json) |
| Sources pendant les douze reprises | 234 fichiers identiques avant/après ; aucun adaptateur PhysX de substitution | [Empreintes](reconciliation-0314/empreintes-apres.json) |
| Build 0.2.56 répété | Deux sorties identiques ; 34/34 modules FERRO ; 56/56 scripts valides | [Build](BUILD.json), [passage 1](build-1.log), [passage 2](build-2.log) |

Le HTML final pèse **14 162 317 octets**, **3 363 224 octets compressés**. SHA-256 : `d93139352b308a1b5c2b3e60b8a15a52803b254577030d470037fa0838ac2e65`. Les trois sources qui évoluaient pendant le premier balayage (`physique.js`, `jeu.js`, `reseau.js`) restent signalées dans son rapport original ; les reprises ultérieures ne réécrivent pas cet historique.

## Physique, contacts et stands

Les tests utilisent le véritable WASM **PhysX 5.12.0** installé par FERRO. Les [14 contrôles des voitures](reconciliation-0314/physique-voitures.log) couvrent les corps dynamiques de 600 kg, centre de masse et inerties, quatre ressorts, freinage en pente/dévers, accélération et marche arrière par forces, retombée sur une pente, barrière de 8 cm à haute vitesse, échange de quantité de mouvement, adhérence propre à chaque roue, traces sur le vrai contact, débris dans le monde partagé et transferts entre autorité locale et distante. Ils vérifient l’absence de réécriture continue des poses ou vitesses pour maintenir la voiture au sol.

Les [14 contrôles des circuits](reconciliation-0314/physx-circuits.log) ajoutent le roulage et les appuis sur les huit tracés, l’entrée et le sol intérieur du tunnel de Haut-Col, ses deux murs et sa voûte, puis la retombée du saut de Baïkal à 60 m/s. Les résultats détaillés conservent les mesures du repère du châssis et leurs limites dans le [rapport circuits](reconciliation-0314/circuits/physx-circuits.json) ; ils ne sont pas transformés en garantie universelle d’absence d’intersection visuelle.

La géométrie de scène conserve **42 contrôles passants**. La [reprise native des solides](reconciliation-0314/solides-physx-wasm.log) passe **23 contrôles**, dont **5 181 rayons** sur les huit circuits. La première qualification regroupée des solides, stands, sols et cycles comptait 141 contrôles ; l’addendum préchauffage la portait à **142**. Ces rapports de checkpoint restent intacts : [qualification initiale](QUALIFICATION-SOLIDES-STANDS-SOLS.json), [addendum](CHAUFFE-PHYSX.json).

Les [onze contrôles de stands repris sur 0.3.14](reconciliation-0314/physx-stands.log) couvrent le limiteur par commandes moteur/frein, le service immobile complet, l’interruption par impulsion, trois trajets complets vers le garage puis retour sur sec/pluie/neige et cinq variantes de file bloquée. Les pneus changent ensemble uniquement au terme du service. Les sorties de file testées ne produisent ni contact ni replacement. Les [cinq scénarios initiaux](physique-stands.json) conservent aussi la vraie approche bloquée : la stratégie existante attend jusqu’à 90 secondes avant renoncement ; les deux files déjà immobilisées se dégagent plus tôt. Les résultats des scénarios ne sont pas généralisés à toute situation possible.

La libération et les reprises après erreur sont couvertes par [deux contrôles de cycle de vie](reconciliation-0314/physx-cycle-vie.log), [quatre contrôles de séances/préchauffage](reconciliation-0314/physique-cycle-seances.log), [six contrôles du monde](reconciliation-0314/physx-monde.log) et [neuf contrôles de chargement](reconciliation-0314/chargement.log). La restauration graphique conserve le monde de la course et recrée les effets partagés ; le préchauffage possède son monde indépendant.

## Déterminisme, réseau et courses

La fixture p14 active provient de **deux processus indépendants** : Val-Brûlé sec, Port-Sable pluie et Baïkal neige, douze voitures par course pendant 18 secondes. Les **54 empreintes exactes** passent à nouveau après installation de FERRO 0.3.14, sans régénération de fixture. Une variation d’un ulp ou de −0/+0 est détectée ; les fixtures historiques p9 à p13 restent intactes. Voir [création](determinisme-p14-creation.log) et [reprise finale](reconciliation-0314/determinisme-simulation.log). Cette preuve est propre à l’environnement exécuté et ne démontre pas une identité sur toutes les architectures.

Le [codec réseau](reseau/qualification.json) reste inchangé : onze contrôles dédiés et trois suites historiques, soit 77 résultats Node dont un résultat de fichier regroupant dix-sept contrôles de pneus. L’extension transporte vitesses 3D, rotation et suspensions, avec rejet des données malformées et horizon borné. Les [deux sens du transfert d’autorité](reconciliation-0314/physx-autorite-reseau.log) sont repris sous 0.3.14. Aucune session réelle entre plusieurs machines n’est revendiquée.

Les [dix sondes de course de 200 secondes](COURSES-NATIVES.json) restent des observations du checkpoint FERRO 0.3.13 : douze voitures, huit circuits sur sec, puis Baïkal sous pluie et neige. Toutes les voitures terminent au moins un tour, sans exception ni perte de contact natif signalée. **Quatre replacements après accident sont observés à Haut-Col**, selon la récupération existante, aucun dans les neuf autres scénarios. Les reprises ciblées valident les raccords ultérieurs et conservent les 54 empreintes p14 ; les dix sondes n’ont pas été rejouées intégralement sous 0.3.14. Les temps mesurés sont des temps de processus sans rendu, pas des FPS.

Le [garde historique Russie](reconciliation-0314/russie.log) passe neuf contrôles, avec les trois courses de trois tours effectivement exécutées. Son en-tête et son rapport précisent qu’il utilise la voie de compatibilité **sans PhysX** : il valide la géométrie et cette ancienne voie, pas la physique native p14. Les contrôles natifs sont ceux cités ci-dessus.

## Sols et pilotes

Les [68 contrôles des sols](QUALIFICATION-SOLIDES-STANDS-SOLS.json) comprennent 64 comparaisons (huit circuits, quatre saisons, deux qualités), le comportement par défaut, la végétation et l’appel réel du jeu. La recette change le rendu procédural des nappes de terrain et d’accotement ; positions, indices, couleurs de base et géométrie des contacts restent identiques. Aucune image de texture n’est importée. Les shaders sont identiques entre FERRO 0.3.13 et 0.3.14 : les preuves visuelles précédentes gardent leur portée, sans nouveau rendu matériel annoncé.

Les [pilotes extérieurs](pilote-exterieur/qualification.json) passent quatorze contrôles, dont 630 poses articulées, plus les contrôles historiques de voiture. La mesure d’encombrement porte sur 634 poses et 3 645 paires proches de capsules/triangles : aucune pénétration, marge minimale de 10,61 mm. Les [douze vues EGL](pilote-exterieur/pilote-poses-egl.png) montrent quatre phases aux trois niveaux de détail. Elles utilisent les vrais maillages et shaders, à caméra fixe ; elles ne constituent pas une partie dans le navigateur avec post-traitement complet. Le code du pilote et le shader qualifiés restent identiques.

## Canon FERRO 0.3.14

Le canon est publié par la [PR n° 2](https://github.com/M4D135/FERRO/pull/2), au commit `85ba941709bb304cbc34f8beb7baab0639321919`. Le [reçu vérifié](PUBLICATION-FERRO-0314.json) et l’[audit indépendant](ferro-0314/AUDIT.json) fixent sa provenance. L’installation officielle vérifie **34 modules**. Deux changent depuis 0.3.13 : `physx.js` libère les wrappers WebIDL empruntés et suit leurs propriétaires ; `engine.js` porte le nouveau numéro. Les **32 autres modules**, le solveur, ses paramètres mécaniques et les shaders restent identiques.

Les [journaux canoniques](ferro-0314/tests-canonical.log) comptent **210 réussites, zéro échec, un TODO historique** sur 211 tests. Les [contrôles PhysX](ferro-0314/tests-physx.log) passent **25/25**, avec 72 cycles de création/libération et des mondes simultanés. Ces preuves portent sur le suivi des wrappers JavaScript et leur durée de vie ; aucune mesure de heap natif n’est revendiquée. L’audit a relu les journaux publiés, sans prétendre les avoir réexécutés. Les reprises du jeu, elles, ont été exécutées avec l’adaptateur installé.

La [qualification EMPRISE](ferro-0314/qualification.json) conserve **10/12 contrôles ciblés** sur la base 0.3.13 et sur le candidat 0.3.14, 89 fichiers hôtes contrôlés inchangés, et les mêmes deux journaux de réserve : `webgpu-renderer` observe 128 au lieu de 0 ; le harnais `renderer-overlay` ne définit pas `photoOverlay`. Le build complet reste indisponible faute de `src/city-data.js`, sans substitution. Les programmes GLSL/WGSL étant inchangés, les preuves EGL et de compilation WGSL du canon 0.3.13 sont réutilisées ; aucune scène native WebGPU complète n’est ajoutée.

La [sonde logicielle du sol](https://github.com/M4D135/FERRO/blob/b09a4e82252dbcb43a363a19b3e43c0a90e9a41b/docs/sols-proceduraux/README.md) utilise llvmpipe, un worker, 768 × 512 : médiane 23,19 → 26,55 ms, soit +14,5 % dans ce banc. Aucun gain FPS matériel n’est annoncé.

## Archives concurrentes et réserves

Les dossiers `livraison/` et `final/` appartiennent au checkpoint concurrent `b8f0507` et à ses précurseurs. Leur [qualification 117/119](livraison/qualification-finale.json), leur build 0.2.55 `c9e0c3d9…` de 14 153 917 octets, leur déterminisme de **141 empreintes sur huit scénarios**, et leurs courses de **120 secondes** ne sont pas les résultats du regroupement 0.2.56. Ils sont conservés sans réécriture. Les sources de ce protocole et la fixture de son autre format restent disponibles dans l’[archive de provenance](concurrent-b8f0507/README.md). La fixture p14 active conserve nos 54 empreintes.

La [signature d’échec des traces](qualification-complete/traces.test.log) est exactement celle de la [CI 0.2.54](../VIRAGES-REFLETS-2026-11-19/github/RECU-CI.json) : actuelle `e6790758…`, attendue `575fc91d…`. La fixture n’a pas été réécrite. `decor.test` passe dans notre balayage initial ; la branche concurrente relève [486 ms pour un budget de 150 ms](livraison/tests/decor.test.mjs.log), après des dépassements antérieurs de 152/161/166 ms. Ces mesures ne sont pas une comparaison contrôlée dans le même environnement : **la réserve de durée n’est pas déclarée résolue**, et le seuil reste inchangé.

Le [smoke Chromium de la branche concurrente](livraison/navigateur/smoke-physx.json) a échoué au lancement du navigateur avant tout contrôle de page ; il ne valide aucun rendu. Il reste à observer la partie dans un navigateur sur le matériel du joueur. Ce bilan n’établit ni FPS Mac, ni jeu en réseau entre machines, ni déploiement du site. Le résultat de la CI distante de publication doit être consigné séparément.
