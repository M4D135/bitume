# BITUME 0.2.55 / p14 — qualification du checkpoint 62c9461

## Résultat et portée

**Statut : publication en attente de réconciliation.** Un nouveau checkpoint concurrent `b8f050745c68e2c7a9e482611cfdc980efe1ada3` a été signalé après la consolidation. Ce rapport conserve les preuves du checkpoint `62c9461` avec FERRO 0.3.13 ; il n’inclut pas les changements annoncés du canon 0.3.14 ni leur requalification. Ses totaux sont ceux de notre inventaire local, indépendamment des résultats de la branche concurrente.

**121 suites passantes sur 122 dans les preuves locales consolidées.** Le seul échec restant est la signature historique de `traces.test.mjs`, déjà présente avant ce lot. Il n’y a pas eu de balayage complet unique de la dernière révision : le premier passage couvre 118 suites, puis des reprises ciblées couvrent les corrections et les quatre nouvelles suites. La CI distante de publication doit être lue séparément. Le [registre JSON](QUALIFICATION-FINALE.json) associe chaque suite à son journal et à l’empreinte de son test.

Le checkpoint de code qualifié est `62c94613461ab2fb5750b39f97d6049062e341c1`. Il précède la fusion documentaire avec la branche concurrente ; ce n’est pas un identifiant de publication distante.

| Étape | Résultat | Preuve |
|---|---|---|
| Balayage initial | 115/118 ; échecs autoconfig, déterminisme p14, traces | [Résultats complets](qualification-complete/resultats.json) |
| Reprise autoconfig | 22/22 contrôles ; le harnais prépare PhysX et vérifie aussi son indisponibilité | [Journal final](autoconfig-integration-final.log) |
| Reprise déterminisme | 54/54 empreintes exactes sur trois courses PhysX | [Création indépendante](determinisme-p14-creation.log), [garde final](determinisme-p14-final.log) |
| Quatre suites ajoutées après le balayage | Codec réseau 11/11, autorité réseau 2/2, cycle de vie 2/2, stands 8/8 | [Codec](reseau/physx-reseau.log), [autorité](physx-autorite-reseau.log), [cycle](physx-cycle-vie.log), [stands](physx-stands-concurrent.log) |
| Deux suites déjà passantes, étendues ensuite | Voitures PhysX 14/14 ; séances/préchauffage 4/4 | [Voitures](physique-voitures-final.log), [addendum préchauffage](CHAUFFE-PHYSX.json) |
| Build répété | Deux sorties identiques, 14 160 335 octets ; 34/34 modules FERRO et 56/56 scripts valides | [Build](BUILD.json), [passage 1](build-1.log), [passage 2](build-2.log) |

L’empreinte SHA-256 du HTML est `8f3bba41c8255f72da2c828d153225eb13649c733142f9e216162928b37bbb98` (3 362 682 octets compressés). Les sources modifiées pendant le balayage initial étaient `physique.js`, `jeu.js` et `reseau.js`. Le registre original conserve cette information ; les reprises ne l’effacent pas.

## Physique, contacts et stands

Les contrôles utilisent le véritable WASM PhysX 5.12.0 installé par FERRO 0.3.13. Les [14 contrôles des voitures](physique-voitures-final.log) couvrent les corps de 600 kg, centre de masse et inerties, quatre ressorts, freinage en pente/dévers, accélération et marche arrière par forces, retombée sur une pente, barrière de 8 cm à haute vitesse, échange de quantité de mouvement, adhérence propre à chaque roue, traces sur le vrai contact, débris dans le monde partagé, puis passage entre autorité locale et distante. Ils vérifient notamment l’absence de réécriture continue des poses ou vitesses pour maintenir la voiture au sol.

La scène compte **42 contrôles de géométrie et 23 contrôles natifs**, dont **5 181 rayons** sur les huit circuits. La première qualification des solides, stands, sols et cycles comptait 141 contrôles ; le contrôle de préchauffage ajouté porte cet ensemble à **142** sans réécrire son rapport initial. Voir [qualification de scène](QUALIFICATION-SOLIDES-STANDS-SOLS.json) et [addendum](CHAUFFE-PHYSX.json).

Les [cinq scénarios de stands initiaux](physique-stands.json) vérifient la sortie derrière un joueur garé, une vraie approche bloquée et les trajets sous pluie/neige : aucun contact, replacement, ni pose/vitesse forcée après préparation. Les pneus ne changent qu’après le service complet. L’approche bloquée conserve le délai de renoncement de 90 secondes de la stratégie existante ; les deux files déjà immobilisées se dégagent plus tôt. Les [huit contrôles complémentaires](physx-stands-concurrent.json) couvrent le limiteur par commandes moteur/frein, l’interruption du service par impulsion et cinq variantes de file sur sec, pluie, neige et Haut-Col. Le service de 2,5 secondes est observé à 2,5083 secondes au pas fixe.

Les mondes sont libérés après erreur de création, fin de séance et préchauffage ; une restauration graphique conserve le monde de la course et recrée les effets partagés. Les preuves sont dans [cycles des séances](physique-cycle-seances-chauffe.json) et [cycle de vie complémentaire](physx-cycle-vie.log).

## Déterminisme, réseau et courses

La nouvelle fixture p14 a été créée après deux replays dans des processus indépendants : Val-Brûlé sec, Port-Sable pluie et Baïkal neige, douze voitures par course pendant 18 secondes. Les 54 états sont identiques numériquement, sans arrondi ; une variation d’un ulp ou de −0/+0 est détectée. Les fixtures historiques p9 à p13 restent intactes. Cette preuve est propre à l’environnement exécuté ; elle ne démontre pas une identité sur toutes les architectures. Voir [création](determinisme-p14-creation.log) et [vérification finale](determinisme-p14-final.log).

Le [raccord réseau](reseau/qualification.json) passe onze contrôles dédiés et les trois suites réseau historiques, soit 77 résultats Node dont un résultat de fichier regroupant dix-sept contrôles de pneus. L’extension transporte vitesses 3D, rotation et suspensions, avec rejet des données malformées et horizon borné. Les deux sens du transfert d’autorité sont couverts par les tests natifs. Aucune session réelle entre plusieurs machines n’est revendiquée.

Les [dix sondes de course](COURSES-NATIVES.json) font courir douze voitures pendant 200 secondes : les huit circuits sur sec, puis Baïkal sous pluie et neige. Toutes les voitures terminent au moins un tour ; aucune exception ni perte de contact natif signalée. **Quatre replacements après accident sont observés à Haut-Col**, selon la récupération existante, aucun dans les neuf autres scénarios. Ce résultat ne constitue donc pas une garantie générale de zéro accident. Les temps enregistrés sont des temps de simulation Node sans rendu, pas des FPS. Les corrections de raccord postérieures et leur couverture ciblée sont explicitées dans le rapport.

## Sols et pilotes

Les [68 contrôles des sols](QUALIFICATION-SOLIDES-STANDS-SOLS.json) comprennent 64 comparaisons (huit circuits, quatre saisons, deux qualités), le comportement par défaut, la végétation et l’appel réel du jeu. La recette de matière change uniquement le rendu procédural des nappes de terrain et d’accotement ; positions, indices, couleurs de base et géométrie des contacts restent identiques. Aucune image de texture n’est importée.

Les [pilotes extérieurs](pilote-exterieur/qualification.json) passent quatorze contrôles, dont 630 poses articulées, plus les contrôles historiques de voiture. La mesure d’encombrement porte sur 634 poses et 3 645 paires proches de capsules/triangles : aucune pénétration, marge minimale de 10,61 mm. Les [douze vues EGL](pilote-exterieur/pilote-poses-egl.png) montrent quatre phases aux trois niveaux de détail. Elles utilisent les vrais maillages et shaders FERRO ; elles restent des inspections techniques à caméra fixe, sans scène navigateur ni chaîne complète de post-traitement.

## Canon FERRO et limites

FERRO 0.3.13 est publié par la [PR n° 1](https://github.com/M4D135/FERRO/pull/1). Sa [qualification canonique](https://github.com/M4D135/FERRO/blob/b09a4e82252dbcb43a363a19b3e43c0a90e9a41b/docs/physx-sols-0313/qualification.json) compte **208 réussites, zéro échec, un TODO hérité** sur 209 tests, dont 23 contrôles du vrai WASM et 17 contrats sols/ombres. Le shader WGSL est compilé et validé ; aucune scène native WebGPU complète n’est revendiquée.

Le contrôle isolé d’EMPRISE donne 34 modules identiques, 88 fichiers JavaScript valides et 9/11 suites ciblées. Les deux échecs reproduisent les réserves antérieures : `webgpu-renderer` observe 128 au lieu de 0, et le harnais `renderer-overlay` ne définit pas `photoOverlay`. Le build complet n’est pas rejoué, car `src/city-data.js` (13 975 402 octets) est absent ; aucune substitution n’a été fabriquée. Voir [preuve EMPRISE](https://github.com/M4D135/FERRO/blob/b09a4e82252dbcb43a363a19b3e43c0a90e9a41b/docs/physx-sols-0313/emprise/qualification.json).

La [sonde du shader de sol](https://github.com/M4D135/FERRO/blob/b09a4e82252dbcb43a363a19b3e43c0a90e9a41b/docs/sols-proceduraux/README.md) utilise llvmpipe logiciel, un worker, 768 × 512 : médiane 23,19 → 26,55 ms, soit +14,5 % dans ce banc. Aucun gain FPS matériel n’est annoncé. Il reste à observer la partie dans un navigateur sur le matériel du joueur ; cette qualification n’établit ni FPS Mac, ni déploiement du site.

L’[échec de traces](qualification-complete/traces.test.log) conserve exactement l’empreinte actuelle `e6790758…` contre l’attendue `575fc91d…`, déjà visible dans les [preuves CI 0.2.54](../VIRAGES-REFLETS-2026-11-19/github/RECU-CI.json). La fixture n’a pas été réécrite pour masquer l’écart. La CI antérieure avait aussi relevé un dépassement temporel de `decor.test` ; ce test passe dans le balayage local présent. Le résultat distant de la livraison 0.2.55 reste à consigner séparément.
