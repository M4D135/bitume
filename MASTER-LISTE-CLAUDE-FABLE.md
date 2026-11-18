# BITUME — master liste complète et passation Claude Fable

Date : **18 novembre 2026**. Document de reprise demandé par David pour poursuivre avec **Claude Fable**.

## 1. Mission et point de départ

Poursuivre **BITUME**, jeu de course de monoplaces procédural et autonome dans le navigateur, dépôt **[M4D135/bitume](https://github.com/M4D135/bitume)**, branche unique **`main`**. Avancer par petits lots, publier fréquemment et conserver un point de reprise court. Ce document rassemble le catalogue complet proposé et les travaux demandés ; les fiches détaillées portent les critères techniques.

| Élément | État vérifié à la préparation de cette passation |
|---|---|
| Jeu livré | **0.2.38**, commit **`baf4ddfc2b4ab670bc4809d5e0ae3fb8758b1902`**. |
| Premier plan publié | **`0b43a35104f8516c6ac1445a426f6ea219fbc88d`**, puis ajout Marseille dans la présente mise à jour ; lire le HEAD actuel. |
| Moteur BITUME | **FERRO 0.3.9**, 34 modules verrouillés. |
| Physique | **p9** dans `src/jeu.js` ; incrémenter depuis la valeur effective lors des changements de conduite. |
| Qualification de la base | 66/66 suites consignées, reconstruction déterministe ; rendu WebGL et performances matérielles encore à qualifier dans la reprise. |
| Site public | Build 0.2.38 vérifié identique le 18 novembre à 14 h 47 (Paris) ; recontrôler à la prochaine livraison. |
| Circuits jouables | **7**. |
| Nouveaux circuits explicitement demandés | **Russie, Monaco ultra fidèle, Spéciale Marseille issue d’EMPRISE avec relief**. |
| Autres demandes prioritaires | Roues rondes et réalistes, slicks lisses, sculptures pluie/neige, usure progressive visible. |
| Implémentation de ce nouveau programme | **Non commencée** ; la présente passation contient les plans. **Premier lot de code : 12A.** |

**Ordre de lecture :** `AGENTS.md` → `REPRISE.md` → `docs/reprise/ETAT.json` → cette master liste → uniquement les sections utiles du plan actif. Éviter de recharger les anciennes discussions, les archives et le HTML compilé en entier.

## 2. Catalogue complet : objectif 16 circuits

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
| 8 | **Baïkal — Russie** | Russie / Sibérie | Tracé original de rive et forêt, vrai changement de rythme, relief et saisons ; localisation Baïkal proposée. | Pays demandé ; thème proposé |
| 9 | **Monaco** | Principauté de Monaco | Parcours réel 2026, 3 337 m et 19 virages ; murs, tunnel, stands, port et architecture fidèles. | Demandé |
| 10 | **Spéciale Marseille** | France / Marseille | Carte **EMPRISE**, parcours de course défini sur ses rues, relief altimétrique, ville et collisions raccordées. | Demandé |
| 11 | **Fjord-d’Argent** | Norvège / Europe du Nord | Fjord encaissé, parois, ponts, rives dissymétriques et lumières nordiques ; tracé original. | Proposition |
| 12 | **Crêtes-des-Carpates** | Roumanie / Europe de l’Est | Vallées boisées, crêtes, villages et enchaînements de montagne ; tracé original. | Proposition |
| 13 | **Landes-d’Écosse** | Royaume-Uni / Écosse | Landes, pierres, lac et météo changeante ; routes rapides à relief progressif. | Proposition |
| 14 | **Sierra-Cuivrée** | Mexique | Relief minéral, ravins, plateau et végétation sèche ; circuit original distinct de Roche-Fauve. | Proposition |
| 15 | **Baie-du-Corail** | Australie | Baie, littoral rocheux et végétation côtière, grandes courbes et section technique. | Proposition |
| 16 | **Col-des-Andes** | Chili | Haut relief, vallées, belvédères et cols ; caractère original, altitude visuelle et conduite cohérentes. | Proposition |

**Comptage : 7 livrés + 3 ajouts demandés + 6 propositions = 16.** Les numéros sont ceux de cette liste humaine ; les indices techniques existants ne doivent jamais être réordonnés. Ajouter des IDs stables, figer les graines des tracés originaux et vérifier le catalogue courant avant chaque ajout.

Pour chacune des six propositions, utiliser le même cycle de petits lots : identité/tracé → relief et décor → IA/saisons → captures/performance → publication. Aucune longueur ni graine n’est encore fixée pour elles. Affiner ces propositions au moment de leur lot, après les demandes explicites.

## 3. Liste complète des travaux prioritaires

### A. Roues et pneus — lots 12A à 12F

- [ ] Catalogue commun `slicks`, `inter`, `pluie`, `neige` ; ordre des quatre roues **AVG, AVD, ARG, ARD** et libellés corrects.
- [ ] Pneus plus ronds, profil et flancs crédibles, épaules arrondies, jantes creuses, rayons/moyeux/disques mieux construits.
- [ ] Formes dédiées et niveaux de détail réels ; ne pas augmenter tous les cylindres génériques du moteur.
- [ ] Slick neuf lisse ; intermédiaire modérément sculpté ; pluie avec canaux ; neige avec pavés et lamelles. Motifs attachés aux roues.
- [ ] Rotation, marche arrière, braquage et suspension cohérents ; préserver les proportions de la monoplace.
- [ ] Usure distincte par roue, liée à distance, charge et glisse ; aspect neuf, rodé, usé et très usé avec transitions continues.
- [ ] Saleté réversible séparée de la gomme perdue ; pas d’usure en pause ou sans contact au sol ; hasard de traces indépendant de celui de la course.
- [ ] État de chaussée humide/enneigée explicite ; conditions saisonnières et flocons ne suffisent pas à définir l’adhérence.
- [ ] Physique des pneus et usure bornée, utile et progressive ; mêmes règles pour joueur et IA ; records/fantômes versionnés au bon moment.
- [ ] Choix par pilote, y compris deux humains sur la même machine, avec migration des préférences existantes.
- [ ] Service de pneus aux stands, distinct des réparations ; le changement de type renouvelle les quatre pneus.
- [ ] Réseau compact et versionné : état des pneus, service idempotent, rejet des paquets anciens, arrivée tardive, 2+2 et autorités conservées.
- [ ] Stratégie des rivaux pour les courses longues avant de rendre leurs changements de pneus indispensables ; aucun renouvellement caché.
- [ ] Captures comparables des quatre types et états d’usure, cockpit/poursuite/démo/rétros ; coût mesuré sur matériel réel.

Fiche détaillée : **[12 — plan maître roues, pneus, Russie et Monaco](docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md)**, sections 2 à 7.

### B. Russie — lots 13A et 13B

- [ ] Fixer l’identité du circuit russe, proposition Baïkal, sa graine et son tracé original.
- [ ] Lac, rives rocheuses, forêt irrégulière, clairières et relief ; une identité lisible qui enrichit le catalogue.
- [ ] Routes et obstacles praticables, douze voitures, grille et possibilités de dépassement.
- [ ] Quatre saisons, météo et neige cohérentes avec l’état de chaussée ; conditions de l’hôte conservées.
- [ ] Onze rivaux sur plusieurs tours, collisions réelles, stagnations/replacements contrôlés.
- [ ] Livraison complète : captures, coûts, régression et build qualifié.

Fiche détaillée : plan 12, section 8.

### C. Monaco ultra fidèle — lots 14A à 14F

- [ ] Figer les références officielles 2026, puis compléter coordonnées, largeurs, altitudes et incertitudes.
- [ ] Reconstituer le véritable parcours : 3 337 m, 19 virages, ordre, sens et secteurs corrects.
- [ ] Ajouter une voie de construction à tracé explicite ; préserver le générateur et les sept circuits existants.
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

- [ ] Reprendre les sources de **`M4D135/emprise`**, version examinée **0.6.8**, commit **`cc004826a506e6979eaaec217748fe85d5cd6ac5`**.
- [ ] Définir un vrai parcours de course dans les rues de la carte ; extraire corridor et horizon utiles.
- [ ] Préserver le Vieux-Port et les repères retenus, sans prétendre que toutes les façades sont des relevés exacts.
- [ ] Ajouter un **MNT mesuré** et sourcé au centre actuellement plat ; examiner RGE ALTI ou MNT LiDAR HD selon disponibilité et qualité.
- [ ] Conserver repère métrique, projection, datum vertical, provenance, précision et raccords de tuiles.
- [ ] Reposer chaussées, trottoirs, quais, bâtiments, objets et collisions sur un même relief cohérent.
- [ ] Préserver la géographie en plan ; traiter ponts, tunnels, rampes, superpositions et replacements avec une voie/couche identifiée.
- [ ] Raccorder les reliefs existants de la Bonne-Mère, de la côte et des îles à la nouvelle base, sans doubler les collines.
- [ ] Adapter les recettes de décor au FERRO BITUME **0.3.9** ; ne pas importer le verrou plus ancien d’EMPRISE.
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

1. **12A–12F : roues et pneus.** Livrer les corrections visuelles, puis l’usure, la surface, les stands et la synchronisation en étapes distinctes.
2. **13A–13B : Russie.** Ajouter un circuit original complet.
3. **14A–14F : Monaco.** Construire et qualifier les fonctions communes de tracé réel, largeurs variables, voies et stands.
4. **15A–15F : Marseille.** Réemployer ces fonctions, porter le corridor EMPRISE et son relief mesuré.
5. **16A–16F : six propositions restantes.** Affiner et livrer chacune en sous-lots, sans lancer six circuits à moitié faits.

Les lectures de références Monaco et EMPRISE peuvent se préparer indépendamment. Un responsable garde l’intégration ; des tâches de lecture ou des fichiers disjoints peuvent être délégués si l’outil le permet. Ne pas faire éditer simultanément les mêmes sources ni le même point de reprise.

**À chaque lot :** fiche courte → travail réel → contrôles utiles → checkpoint/push → qualification → sources/build → reçu → prochaine action. Les journaux détaillés restent dans les rapports du dépôt ; la conversation contient seulement les conclusions utiles. Changer de session à un checkpoint durable si nécessaire, sans dépendre d’une mémoire de chat.

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

> Reprends BITUME dans `M4D135/bitume`, branche `main`. Lis `AGENTS.md`, `REPRISE.md`, `docs/reprise/ETAT.json`, puis `MASTER-LISTE-CLAUDE-FABLE.md`. Le jeu livré est en 0.2.38 ; les nouvelles demandes sont planifiées, pas implémentées. Commence au premier sous-lot non terminé indiqué dans l’état courant, initialement 12A. Réalise les roues rondes et réalistes, les slicks/intermédiaires/pluie/neige et l’usure progressive, puis la Russie, Monaco fidèle et la Spéciale Marseille issue d’EMPRISE avec relief mesuré. Complète ensuite les six autres places proposées pour atteindre 16 circuits. Consulte les fiches techniques pour les sources et critères. Avance de façon autonome par petits lots, publie souvent le travail réel, conserve les preuves et une reprise courte, vérifie `main` après chaque publication. Ne surcharge pas le contexte et ne déclare jamais un rendu ou un déploiement validé sans l’avoir contrôlé.

Ce texte renvoie aux fichiers durables du dépôt ; il n’est pas nécessaire de recopier toute la conversation.
