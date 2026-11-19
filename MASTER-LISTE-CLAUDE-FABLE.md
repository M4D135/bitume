# BITUME — master liste complète et passation Claude Fable

Plan du **18 novembre 2026**, état de reprise actualisé le **19 novembre 2026**. Document demandé par David pour poursuivre avec **Claude Fable**.

## 1. Mission et point de départ

Poursuivre **BITUME**, jeu de course procédural de monoplaces, dépôt [M4D135/bitume](https://github.com/M4D135/bitume), branche de livraison `main`.
**Demande du 19 novembre : continuer en autonomie toute cette liste.** Le programme réconcilié, incluant les
lots transversaux 17 à 28 et les restes historiques, est dans
[CONTINUATION-AUTONOME-2026-11-19.md](docs/reprise/CONTINUATION-AUTONOME-2026-11-19.md).

| Élément | État après qualification locale de 0.2.60 |
|---|---|
| Base publiée | **0.2.59 / p14**, cockpit réuni et démos livrés ; main `f350dd7` après clôture documentaire PR #19. |
| Moteur | **FERRO 0.3.15**, publié par PR #4 ; 34 copies canoniques verrouillées conformes. |
| Qualification 0.2.60 | **137/137 suites** dans la campagne locale complète ; rapport et réserve de durée ciblée conservée dans `QUALIFICATION-0260.json`. Résultats 0.2.59 conservés séparément. |
| Circuits | **8 jouables** : sept historiques et Baïkal, dont le tracé/relief 13A est livré. |
| Lot actif | **Réalisme visuel demandé le 19 novembre** : bras communs, pneus, matières, météo, bâtiments et stands ; 13B réuni et qualifié localement. Publication distante à constater. |
| Pneus/stands | **12A–12F4 livrés**, compléments de dégagement livrés et raccordement à p14 conservé. |
| Déjà intégrés | Public, échappements, animaux, vibrations, socle chargement, virages/annonces, démos/regard arrière et cockpit extérieur. |
| Programme conservé | Monaco fidèle, Marseille avec relief mesuré, montagne distincte et six propositions : **17 destinations** au total. |
| Limites ouvertes | Rendu et FPS matériels, manettes, essais entre réseaux et déploiement ; aucune validation matérielle inventée. |

**Ordre de lecture :** `AGENTS.md` → `REPRISE.md` → dernière entrée de `docs/reprise/SUIVI-2026-11-19.md` et `docs/reprise/ETAT.json` → fiche du lot actif. Cette master liste sert à choisir la suite. Éviter de recharger les anciennes discussions, les archives et le HTML compilé en entier.

## 2. Catalogue initial de 16 et ajout montagne confirmé

Les sept premières entrées existent. Les trois suivantes répondent à la demande de David. **Les six dernières sont des propositions de conception pour remplir les places restantes** ; leurs noms, tracés et destinations ne sont pas présentés comme des décisions antérieures de David. Baïkal est également le thème proposé du circuit russe demandé.

| N° | Circuit | Région / cadre | Identité et travail prévu | Statut |
|---|---|---|---|---|
| 1 | **Val-Brûlé** | Forêt | Circuit historique, végétation et clairières ; conserver ID `val-brule`. | Livré |
| 2 | **Port-Sable** | Côte du Sud | Circuit historique littoral ; conserver `port-sable` et son exception sans neige. | Livré |
| 3 | **Haut-Col** | Montagne | Circuit historique avec tunnel ; conserver `haut-col` et ses effets intérieurs. | Livré |
| 4 | **Lande-Noire** | Islande | Basalte, relief volcanique et aurores nocturnes. | Livré |
| 5 | **Roche-Fauve** | Afrique | Plateaux ocres, ravine et strates minérales. | Livré |
| 6 | **Brume-de-Jade** | Asie | Pics calcaires, vallées et terrasses. | Livré |
| 7 | **Cap-Séquoia** | États-Unis, Pacifique | Falaises, anses, océan et grands conifères. | Livré en 0.2.38 |
| 8 | **Baïkal — Russie** | Russie / Sibérie | Tracé original de 5 424 m, 62,95 m de dénivelé ; Baïkal choisi en 13A, graine 179. | 13A livré en 0.2.53 ; 13B réuni et qualifié localement en 0.2.60 |
| 9 | **Monaco** | Principauté de Monaco | Parcours réel 2026, 3 337 m et 19 virages ; murs, tunnel, stands, port et architecture fidèles. | Demandé |
| 10 | **Spéciale Marseille** | France / Marseille | Carte **EMPRISE**, parcours de course défini sur ses rues, relief altimétrique, ville et collisions raccordées. | Demandé |
| 11 | **Fjord-d’Argent** | Norvège / Europe du Nord | Fjord encaissé, parois, ponts, rives dissymétriques et lumières nordiques ; tracé original. | Proposition |
| 12 | **Crêtes-des-Carpates** | Roumanie / Europe de l’Est | Vallées boisées, crêtes, villages et enchaînements de montagne ; tracé original. | Proposition |
| 13 | **Landes-d’Écosse** | Royaume-Uni / Écosse | Landes, pierres, lac et météo changeante ; routes rapides à relief progressif. | Proposition |
| 14 | **Sierra-Cuivrée** | Mexique | Relief minéral, ravins, plateau et végétation sèche ; circuit original distinct de Roche-Fauve. | Proposition |
| 15 | **Baie-du-Corail** | Australie | Baie, littoral rocheux et végétation côtière, grandes courbes et section technique. | Proposition |
| 16 | **Col-des-Andes** | Chili | Haut relief, vallées, belvédères et cols ; caractère original, altitude visuelle et conduite cohérentes. | Proposition |

**Comptage du plan initial : 7 livrés + 3 ajouts demandés + 6 propositions = 16.** David a depuis confirmé un **huitième circuit de montagne distinct de Haut-Col**, Route-des-Cimes (nom de travail), avec long parcours, fortes pentes, forêt et tunnels. Il s’ajoute aux trois demandes Russie/Monaco/Marseille. Les six propositions ci-dessus restent conservées : réconcilier le catalogue à leur intégration, sans effacer le circuit de montagne pour tenir l’ancien compte. Les numéros sont ceux de cette liste humaine ; les indices techniques existants ne doivent jamais être réordonnés. Ajouter des IDs stables, figer les graines des tracés originaux et vérifier le catalogue courant avant chaque ajout.

Pour chacune des six propositions, utiliser le même cycle de petits lots : identité/tracé → relief et décor → IA/saisons → captures/performance → publication. Aucune longueur ni graine n’est encore fixée pour elles. Affiner ces propositions au moment de leur lot, après les demandes explicites.

## 3. Liste complète des travaux prioritaires

### A. Roues et pneus — lots 12A à 12F

**12F4 et sortie de file livrés sur main en 0.2.52 / p13 (`b5b4c0c6`), PR n°6 fusionnée.** Sources/build/preuves vérifiés ; base p12 et clôture `db3e8da1` préservées. Reçu : `docs/reprise/rapports/12F4-SORTIE-FILE-2026-11-19/PUBLICATION-0252.json`. Le tracé/relief 13A est également livré ; le décor 13B est désormais réuni au lot réalisme 0.2.60. **107/108 suites**, seul échec traces hérité identique ; **22 scénarios / 1 415 empreintes p13**, deux builds identiques de **14 060 666 octets**, 53 scripts valides et 34 modules FERRO inchangés. Rapport : `docs/reprise/rapports/12F4-SORTIE-FILE-2026-11-19/qualification-execution.json`. Fiche du complément : `docs/reprise/12F4-SORTIE-FILE.md`. WebGL, matériel, multi-navigateur réel et déploiement non validés.

- [x] Catalogue commun `slicks`, `inter`, `pluie`, `neige` ; ordre des quatre roues **AVG, AVD, ARG, ARD** et libellés corrects.
- [x] Pneus plus ronds, profil et flancs crédibles, épaules arrondies, jantes creuses, rayons/moyeux/disques mieux construits.
- [x] Formes dédiées et niveaux de détail réels ; ne pas augmenter tous les cylindres génériques du moteur.
- [x] Slick neuf lisse ; intermédiaire modérément sculpté ; pluie avec canaux ; neige avec pavés et lamelles. Motifs attachés aux roues.
- [x] Rotation, marche arrière, braquage et suspension cohérents ; préserver les proportions de la monoplace.
- [x] Usure distincte par roue, liée à distance, charge et glisse ; aspect neuf, rodé, usé et très usé avec transitions continues — 12D publié, réserve WebGL.
- [x] Saleté réversible séparée de la gomme perdue ; pas d’usure en pause ou sans contact au sol ; hasard de traces indépendant de celui de la course — contrôles 12D/12E acquis.
- [x] État de chaussée humide/enneigée explicite ; conditions saisonnières et flocons ne suffisent pas à définir l’adhérence — contrôles CPU acquis ; qualification CPU 12E avec réserves achevée ; publié en 0.2.47.
- [x] Physique des pneus et usure bornée, utile et progressive ; mêmes règles pour joueur et IA ; records/fantômes isolés en p11 depuis 12F1 — contrôles CPU acquis ; qualification CPU 12E avec réserves achevée ; publié en 0.2.47, puis service 12F1 en 0.2.48.
- [x] Choix par pilote, y compris deux humains sur une machine, migration et Conseillés indépendant : 12F2 fusionné sur main en 0.2.49.
- [x] Service réel et quatre pneus renouvelés : 12F1 publié ; choix solo/duo livré en 12F2 et choix en ligne livré en 12F3 / 0.2.51.
- [x] Réseau compact et versionné qualifié CPU en 12F3 : pneus à 2 Hz, service idempotent, paquets anciens rejetés, liaison tardive, 2+2 et autorités conservées ; relais hôte avant reprise. Nouveaux joueurs hors grille reportés à la prochaine course.
- [x] Stratégie des rivaux et reprises IA qualifiée CPU : vrai service, file, sortie, recul bref si nécessaire, reprise ordinaire quand le joueur repart ; aucun renouvellement anticipé. Livraison 0.2.52 vérifiée sur main.
- [ ] Captures comparables des quatre types et états d’usure, cockpit/poursuite/démo/rétros ; coût mesuré sur matériel réel.

Fiche détaillée : **[12 — plan maître roues, pneus, Russie et Monaco](docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md)**, sections 2 à 7.

### B. Russie — lots 13A et 13B

- [x] Identité et tracé Baïkal fixés en 13A : ID `baikal`, indice 7, graine 179, 5 424 m.
- [x] Lac, rives rocheuses, forêt irrégulière, clairières et relief intégrés en 13B ; qualification locale de l’union 0.2.60.
- [x] Tracé, départ, stands et douze voitures qualifiés en 13A, puis châssis dynamique p14 livré ; conserver ces propriétés en 13B.
- [x] Quatre saisons, météo et neige raccordées en 13B ; conditions de l’hôte conservées, vérifications locales réussies.
- [x] Onze rivaux sur plusieurs tours, collisions et replacements contrôlés localement en sec/pluie/neige ; panneau gênant corrigé.
- [ ] Inspection navigateur et coûts matériels de 13B ; régression locale et build reproductible 0.2.60 acquis.

Fiche détaillée : plan 12, section 8.

### C. Monaco ultra fidèle — lots 14A à 14F

- [ ] Figer les références officielles 2026, puis compléter coordonnées, largeurs, altitudes et incertitudes.
- [ ] Reconstituer le véritable parcours : 3 337 m, 19 virages, ordre, sens et secteurs corrects.
- [ ] Finaliser la voie de construction à tracé explicite : fondation métrique qualifiée localement dans le lot réalisme, anciens générateurs identiques ; IA, grille, stands et données du site restent à fournir avant la course.
- [ ] Échantillonnage uniforme propre au circuit, maillage visuel raffiné séparément, courbes et raccords sans déformation globale.
- [ ] Limites et largeurs variables communes au rendu, à l’IA et aux collisions ; murs et rues voisines correctement séparés.
- [ ] Sainte-Dévote, Beau-Rivage, Casino, Mirabeau/Fairmont, Portier, tunnel, Nouvelle Chicane, Tabac, Piscine, Rascasse et Anthony Noghès reconnaissables.
- [ ] Épingle franchissable par la vraie enveloppe de la voiture ; adaptation explicite du braquage si nécessaire, puis version physique appropriée.
- [ ] Grille explicite, vitesses/corridors IA et dépassements adaptés aux portions étroites.
- [ ] Tunnel urbain réel et transitions de lumière/météo ; rétroviseurs et caméras cohérents.
- [ ] Voie des stands distincte, progression de course et service corrects, réseau conscient de la voie courante.
- [ ] Port, quais, bateaux, tribunes, façades et silhouettes de ville placés d’après les références, générés en code.
- [ ] Rapports d’écarts, captures au niveau de la piste, tour filmé, performances et IA validés ; fidélité partielle explicitée si des mesures manquent.

Fiche détaillée : plan 12, section 9 ; sources Formula 1/FIA déjà liées dans ce document.

### D. Spéciale Marseille et relief — lots 15A à 15F

- [x] Sources de **`M4D135/emprise` 0.6.8**, commit **`cc004826a506e6979eaaec217748fe85d5cd6ac5`**, acquises et reproduites hors réseau dans `docs/references/marseille-2026` ; choix du corridor restant.
- [ ] Définir un vrai parcours de course dans les rues de la carte ; extraire corridor et horizon utiles.
- [ ] Préserver le Vieux-Port et les repères retenus, sans prétendre que toutes les façades sont des relevés exacts.
- [ ] Ajouter un **MNT mesuré** et sourcé au centre actuellement plat ; examiner RGE ALTI ou MNT LiDAR HD selon disponibilité et qualité.
- [ ] Conserver repère métrique, projection, datum vertical, provenance, précision et raccords de tuiles.
- [ ] Reposer chaussées, trottoirs, quais, bâtiments, objets et collisions sur un même relief cohérent.
- [ ] Préserver la géographie en plan ; traiter ponts, tunnels, rampes, superpositions et replacements avec une voie/couche identifiée.
- [ ] Raccorder les reliefs existants de la Bonne-Mère, de la côte et des îles à la nouvelle base, sans doubler les collines.
- [ ] Adapter les recettes de décor au FERRO BITUME verrouillé courant (**0.3.15** dans le candidat réalisme) ; ne pas importer le verrou plus ancien d’EMPRISE.
- [ ] Qualifier pentes, crêtes, compressions, fondations, murs, onze rivaux, écran partagé, météo, rétros et réseau.
- [ ] Conserver les attributions OSM/OpenFreeMap/OpenMapTiles, IGN et Earcut applicables aux éléments repris.
- [ ] Comparaisons au niveau de la chaussée et mesures de performance ; publication avec un reçu.

Fiche détaillée : **[15 — Spéciale Marseille, carte EMPRISE et relief](docs/reprise/15-SPECIALE-MARSEILLE-RELIEF.md)**. Elle contient les chemins source exacts, les dépendances et le constat du terrain plat.

### E. Compléter les six autres places

- [ ] 16A — Fjord-d’Argent : définir puis livrer le circuit original nordique.
- [ ] 16B — Crêtes-des-Carpates : définir puis livrer le circuit original d’Europe de l’Est.
- [ ] 16C — Landes-d’Écosse : définir puis livrer le circuit original de landes.
- [ ] 16D — Sierra-Cuivrée : définir puis livrer le circuit original mexicain.
- [ ] 16E — Baie-du-Corail : définir puis livrer le circuit original australien.
- [ ] 16F — Col-des-Andes : définir puis livrer le circuit original andin.

Pour chaque proposition : fixer les choix dans sa fiche, valider géométrie/IA, appliquer saisons et conditions, mesurer le coût, vérifier les anciens circuits, publier. Les environnements sont des projets originaux ; la carte, le modèle ou les constantes d’un autre jeu ne servent pas de base cachée.

## 4. Fondations existantes à préserver et validations encore ouvertes

| Domaine | À conserver / vérifier |
|---|---|
| Voiture et conduite | Silhouette de monoplace 1980, correction de l’arrière 0.2.36, cockpit et FOV, dérive/turbo, marche arrière, récupération rapide après accident. |
| Courses | Onze rivaux, tours, chrono, fantômes, contacts, dégâts, stands et démo continue. |
| Conditions | Saison/moment/météo avant course, modes Manuel/Aléatoire/Réel ; état de l’hôte en ligne ; neige et pluie sur la vitre. |
| Nature | Poches denses et clairières irrégulières, herbe proche simplifiée au loin, saisons, faune, silhouettes et collisions stables. |
| Réglages | Qualités graphiques, ombres, anticrénelage, végétation, autoconfiguration, manette et deux joueurs locaux. |
| Affichage | FPS en démo, deux rétroviseurs, carte et HUD mobiles, libellé Faune, téléchargement m4d135 → BITUME.html. |
| Audio | Thème à l’écran titre uniquement ; moteurs, effets et ambiances selon les règles du projet. |
| Moteur | WebGL2, modules FERRO verrouillés, sources canoniques pour toute modification moteur, page autonome. |
| Performance ouverte | Qualification sur Mac, téléphone et autres appareils cibles ; coût réel des rétros/duo et frame times. Aucun gain annoncé sans mesure. |
| Réseau ouvert | Essais WebRTC multi-machines et manettes physiques ; compatibilité des nouveaux circuits et états de pneus. |
| Rendu ouvert | Contrôle visuel matériel : les aperçus CPU et la suite de tests ne prouvent pas le rendu final. |

Les vieux tableaux d’avancement de novembre 12–17 restent historiques. Ne pas refaire un lot livré parce qu’une case ancienne n’a pas été mise à jour ; vérifier le code et les reçus actuels. Les sujets hors de ce programme ne doivent pas absorber le premier lot.

## 5. Ordre conseillé et méthode de travail

1. **12A–12F : roues et pneus.** Livraison 0.2.52 vérifiée ; chantier code clos, réserves WebGL/matériel distinctes.
2. **Réalisme et 13B : Russie.** Code, saisons et build 0.2.60 réunis et qualifiés localement ; publier, conserver les réserves matérielles.
3. **14A–14F : Monaco.** Construire et qualifier les fonctions communes de tracé réel, largeurs variables, voies et stands.
4. **15A–15F : Marseille.** Réemployer ces fonctions, porter le corridor EMPRISE et son relief mesuré.
5. **Montagne distincte, puis 16A–16F : six propositions restantes.** Réconcilier Route-des-Cimes, puis affiner et livrer chaque destination en sous-lots.
6. **Lots transversaux et restes historiques.** Suivre la file réconciliée de la continuation autonome ; ne pas confondre une vieille étude avec l’état du code livré.

Les lectures de références Monaco et EMPRISE peuvent se préparer indépendamment. Un responsable garde l’intégration ; des tâches de lecture ou des fichiers disjoints peuvent être délégués si l’outil le permet. Ne pas faire éditer simultanément les mêmes sources ni le même point de reprise.

**À chaque lot :** fiche courte → travail réel → contrôles utiles → checkpoint/push → qualification → sources/build → reçu → prochaine action. Les journaux détaillés restent locaux ; le dépôt reçoit les rapports synthétiques, empreintes et réserves utiles, sans chemins internes. Changer de session à un checkpoint durable si nécessaire, sans dépendre d’une mémoire de chat.

## 6. Commandes et règles de publication

Avant d’écrire, lire le dépôt effectif et son statut :

```bash
git status --short
git fetch origin main
git log -5 --oneline --decorate
```

Préserver les modifications utiles d’une autre session et intégrer les changements distants proprement. **Pas de push forcé, pas de branche concurrente créée par défaut.** Les commits portent seulement sur le lot traité.

Construction et verrou moteur :

```bash
python3 tools/check-ferro-lock.py
python3 construire.py
```

Lire les options des outils et les tests concernés avant de les lancer. La suite globale sert au jalon de qualification ; les modifications documentaires seules ne demandent pas de reconstruire le jeu. Vérifier deux builds identiques pour une livraison de sources et conserver les mesures de taille.

Pour les changements moteur : modifier **[M4D135/FERRO](https://github.com/M4D135/FERRO)**, qualifier et publier la référence, puis propager la version et son verrou dans BITUME. Les sources EMPRISE servent au portage de carte, sans remplacer le moteur BITUME par une ancienne copie.

Le déploiement prévu par le dépôt est `./deposer.sh` depuis le Mac, vers l’alias `amiga`. L’autorisation de livrer est déjà présente dans le contexte de projet ; vérifier les consignes et l’accès effectif. Si l’accès manque, publier GitHub, enregistrer ce blocage précisément et ne pas prétendre avoir déployé. Vérifier séparément la version et l’empreinte réellement servies sur <https://bitume.estrasse.fr/>.

## 7. Critères de fin à appliquer à chaque livraison

- [ ] Exigence du lot effectivement réalisée et vérifiable dans les sources.
- [ ] Aucun changement involontaire des circuits, réglages ou comportements à conserver.
- [ ] Tests ciblés et, au jalon approprié, suite globale, avec résultats conservés.
- [ ] Images/vidéo de comparaison pour les changements visuels ; mesures pour toute affirmation de performance.
- [ ] Build reproductible, version cohérente, verrou FERRO valide.
- [ ] Sources/tests/build publiés et relus sur le vrai `main` distant.
- [ ] Réception de la page publique vérifiée si déploiement effectué ; sinon statut explicite.
- [ ] `REPRISE.md`, `ETAT.json`, fiche et reçu actualisés, avec un seul prochain sous-lot.

## 8. Texte de reprise pour Claude Fable

> Reprends BITUME dans `M4D135/bitume`. Lis `AGENTS.md`, `REPRISE.md`, `docs/reprise/ETAT.json` et la dernière entrée du suivi. La base 0.2.59/p14 et les lots pneus, démos et cockpit sont clos. Poursuis en autonomie la file complète de `docs/reprise/CONTINUATION-AUTONOME-2026-11-19.md`, à partir du prochain sous-lot indiqué par ETAT. Conserve les huit circuits et toutes les demandes Monaco, Marseille, montagne et six destinations. Ne refais pas les lots livrés ni Safari sans défaut nouveau. Publie et actualise la reprise à chaque lot qualifié ; distingue toujours CPU, raster logiciel et validation matérielle.

Ce texte renvoie aux fichiers durables du dépôt ; il n’est pas nécessaire de recopier toute la conversation.
