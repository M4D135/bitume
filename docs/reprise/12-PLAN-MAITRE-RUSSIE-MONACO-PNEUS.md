# BITUME — plan maître Russie, Monaco, Marseille, roues et pneus

Date du plan : **18 novembre 2026**. État au **19 novembre 2026** : **12A–12F1 publiés**, base **0.2.48 / p11 (`1df6f687`)**, suivi `9a421989`. **12F2 / 0.2.49 qualifié CPU, publié dans la revue PR n°3, fusion en attente** sur `codex/bitume-12f2-revue-20261119`, checkpoint `bd13f067`. Fiche [12F2](12F2-CHOIX-PNEUS-PAR-PILOTE.md). **12F3 réseau usure/services restant** ; WebGL et déploiement distincts.
Demande de David : ajouter un circuit en Russie et un Monaco « ultra fidèle », refaire les roues bien rondes et plus réalistes, différencier les sculptures pluie/neige et les slicks lisses, montrer les traces d’usure au fil de la course, puis publier ce plan avant de commencer.

Complément demandé dans la même reprise : **Spéciale Marseille à partir de la carte EMPRISE, avec ajout de relief**, et master liste complète pour Claude Fable. Entrée de passation : [MASTER-LISTE-CLAUDE-FABLE.md](../../MASTER-LISTE-CLAUDE-FABLE.md).

Base historique de l’étude : **BITUME 0.2.38**, livraison `baf4ddfc2b4ab670bc4809d5e0ae3fb8758b1902`, reprise `9f9f97ca7dee3154f8ec517adaba675e0ec81ea4`, **FERRO 0.3.9**, sept circuits. Base fonctionnelle publiée vérifiée à cette reprise : **0.2.48 (`1df6f687`)**, **FERRO 0.3.11**, 34 modules inchangés dans 12F2, toujours sept circuits. Ce plan fait autorité pour ce chantier ; les décisions plus anciennes restent applicables lorsqu’elles ne sont pas remplacées ici.

## 1. Résultat attendu et décisions de départ

| Demande ferme | Résultat attendu |
|---|---|
| Circuit en Russie | Un circuit supplémentaire complet, reconnaissable, roulant dans toutes les conditions prévues, avec sa propre identité. |
| Monaco ultra fidèle | Le véritable parcours de Monaco : géométrie, proportions, relief, murs, tunnel, stands et repères urbains reconnaissables depuis la piste. |
| Spéciale Marseille avec relief | Carte EMPRISE réutilisée pour un parcours de course, terrain altimétrique et raccord cohérent des routes, bâtiments et collisions. |
| Roues bien rondes | Silhouettes circulaires, flancs et épaules crédibles, jantes réellement creuses et détaillées, rotation et braquage cohérents. |
| Pneus différenciés | Slick lisse ; intermédiaire conservé ; pluie avec canaux d’évacuation ; neige avec pavés, rainures et lamelles. |
| Usure progressive | Chaque pneu commence neuf et acquiert ses propres traces selon la conduite ; le relief et la matière évoluent progressivement. |
| Petits lots publiés | Une étape active à la fois, preuves sur disque, sources réellement sauvegardées sur `main`, reprise courte après chaque livraison. |

**Choix de conception proposés pour avancer sans bloquer :**

- **Russie : « Baïkal »**, nom et identité de travail, avec un tracé original au bord d’un grand lac sibérien, forêts et relief rocheux. Le pays est demandé ; le Baïkal est une proposition de ce plan, pas une localisation imposée par David. Aucune prétention à reproduire un circuit réel autour du lac. Le cadre géographique est documenté par l’UNESCO [S5].
- **Monaco : tracé de référence 2026**, figé dans un dossier de sources. Conserver la monoplace de style 1980 du jeu ; la demande de fidélité concerne le circuit et son environnement, sans transformer la voiture en modèle contemporain.
- Le plan initial comptait Russie, Monaco et Spéciale Marseille dans **trois des neuf places restantes** de la cible de 16, puis six propositions distinctes des demandes explicites. David a depuis confirmé un **huitième circuit de montagne distinct de Haut-Col** : conserver cet ajout, les trois destinations demandées et les six propositions ; réconcilier le catalogue sans supprimer de demande pour tenir l’ancien compte.
- Réaliser d’abord les roues et pneus, puis la Russie, Monaco et Marseille. Les dossiers de références Monaco et EMPRISE peuvent être préparés indépendamment ; Marseille réemploie les fonctions de tracé explicite, largeurs et voies qualifiées pour Monaco.
- La livraison de ce document ne modifie ni le jeu ni son numéro de version. Les numéros suivants seront attribués par `construire.py` lors des changements effectifs de sources.

## 2. État réel du code et points à traiter

Constats historiques de lecture sur la base 0.2.38, conservés pour expliquer les choix du plan. Ils ne décrivent plus l’état courant des roues/pneus : 12A–12F1 sont publiés et 12F2 est qualifié en p11 sur la branche de revue. Pour reprendre ces lots, suivre leur fiche et leur reçu actuels, sans réimplémenter ce tableau :

| Élément | État observé en 0.2.38 | Conséquence initiale pour le chantier |
|---|---|---|
| `src/voiture.js::pneu()` | Profil à huit sections, **24 côtés** autour de la roue. | Créer des variantes de révolution plus fines et réellement simplifiées au loin. |
| Jantes / cylindres FERRO | Les cylindres génériques utilisent **16/8/6 côtés** selon le détail ; rayons de jante en boîtes. | Employer des formes dédiées aux roues ; augmenter tous les cylindres dégraderait aussi les décors. |
| Sculptures | `slicks/inter/pluie` ; rainures représentées par **8 ou 14 boîtes noires**. | Construire un dessin continu et crédible ; ajouter le type neige. |
| Traces de gomme | Marques fixes déjà présentes sur les pneus neufs. | Remplacer ces marques par une évolution liée à un état d’usure. |
| État par roue | `charge` et `glisse`, sans usure persistante. | Ajouter un petit état indépendant pour chacune des quatre roues. |
| Ordre des roues | Physique et dessin : **AVG, AVD, ARG, ARD** ; certains libellés de `degats.js` inversent gauche/droite. | Fixer un contrat commun et corriger les libellés sans permuter les données. |
| Version physique | `src/jeu.js::PHYSIQUE` vaut **`p9`** ; une ancienne consigne mentionnait `p8`. | Préserver `p9` pendant les modifications purement visuelles ; incrémenter depuis la valeur réelle à chaque rupture physique. |
| Générateur de circuit | Largeur 12 m, rayon minimal 24 m, séparation de portions 60 m, droite obligatoire 450 m, pente maximale 7 %. | Ces règles conviennent aux tracés originaux et ne doivent pas contraindre le vrai Monaco. |
| Échantillonnage | Pas de 2 m, lissage de courbure sur ±16 m, correction de fermeture répartie sur le tour. | Introduire un chemin explicite pour Monaco, sans déplacer ses virages pour fermer la boucle. |
| Terrain urbain | Grille de terrain de 24 m et sélection d’une portion proche en plan. | Créer des surfaces urbaines explicites pour les rues voisines et les différences de hauteur. |
| Stands | Bande latérale de la chaussée dans `course.js`, pas une voie urbaine indépendante. | Monaco demande une entrée, une voie et une sortie distinctes. |
| Réseau | Préparation fondée surtout sur l’indice du circuit ; paquet courant de 15 flottants par voiture, sans état d’usure. | Versionner les contrats de circuit et de pneus, en préservant les autorités actuelles. |

Les dimensions de la voiture restent la référence : pneus avant de rayon **0,29 m**, largeur **0,28 m** ; arrière **0,335 m**, largeur **0,46 m** ; jante de rayon **0,165 m** ; empattement **2,70 m**. Ce sont les cotes présentes dans le jeu, pas de nouvelles mesures historiques.

## 3. Lots d’exécution et points de publication

Les critères ci-dessous restent les conditions de clôture. **12A–12F1 publiés jusqu’à 0.2.48 / p11**. **12F2 / 0.2.49 qualifié CPU en revue** : 103 suites exécutées puis 13 revalidations ciblées, **102/103 réussies**, seul échec traces hérité identique. **20 scénarios / 1 300 empreintes p11** identiques, sans régénérer la fixture. Deux builds identiques, 34 modules FERRO inchangés. Rapport `rapports/12F2-2026-11-19/qualification-execution.json`. Le seuil décor réussit ce passage ; conserver la réserve de variabilité observée en 12E. WebGL, mesures matérielles et déploiement non validés. **12F3, stratégie de stands IA et circuits restent à réaliser.**

| Ordre / lot | Travail | Condition pour clôturer le lot |
|---|---|---|
| 12A | Contrat des quatre roues et catalogue unique des pneus. | Anciens réglages lisibles, indices cohérents, type neige défini ; comportement de conduite antérieur conservé. |
| 12B | Pneus ronds, profils, jantes et variantes de détail. | Comparaison visuelle proche/lointaine et mesure du coût ; dimensions, rotation et braquage conservés. |
| 12C | Sculptures distinctes et matière de caoutchouc. | Les quatre types se distinguent sans lire leur couleur ; slick neuf lisse ; motifs solidaires des roues. |
| 12D | État d’usure et évolution visuelle. | Évolution déterministe par roue, initialisation neuve, marques liées à la conduite, pause sans progression. |
| 12E | Chaussée enneigée, adhérence et usure physique. | Chaque pneu a un domaine utile ; joueur et IA emploient les mêmes règles ; records/physique versionnés. |
| 12F | Remplacement aux stands, menus et synchronisation. | Service réel, état restauré correctement, solo/duo/ligne cohérents ; protocole compatible ou incompatibilité explicitée. |
| 13A | Russie : tracé original et relief du Baïkal. | Tour praticable avec onze rivaux et collisions réelles ; identité géographique fixée. |
| 13B | Russie : décor, saisons et livraison. | Circuit complet, géométrie stable entre qualités, qualification visuelle et build reproductible. |
| 14A | Monaco : références, coordonnées et altitudes. | Référence 2026 figée, registre des mesures et incertitudes, repères identifiés et comparables. |
| 14B | Monaco : parcours explicite et profil métrique. | Longueur, séquence des 19 virages, fermeture, largeurs et relief contrôlés. |
| 14C | Monaco : murs, collisions, grille et IA. | Épingle et chicanes franchies avec les vrais volumes ; peloton viable sans secours masquant les blocages. |
| 14D | Monaco : tunnel et voie des stands. | Surfaces et passages raccordés, éclairage/exposition continus, aucun trajet à travers un mur. |
| 14E | Monaco : architecture, port et repères. | Captures comparables aux références ; environnement reconnaissable depuis les positions du pilote. |
| 14F | Qualification Monaco et livraison. | Rendu, conduite, réseau, performances et régressions documentés ; code/build puis reçu publiés. |
| 15A | Marseille : source EMPRISE et corridor de course. | Commit figé, données et dépendances identifiées, parcours continu sélectionné. |
| 15B | Marseille : terrain mesuré. | MNT sourcé, repère/datum contrôlés, profils et raccords vérifiés. |
| 15C | Marseille : ville sur le relief. | Routes, quais, bâtiments et collisions ancrés sur les surfaces cohérentes. |
| 15D | Marseille : course, stands et IA. | Peloton, pentes, voies, grille, service et replacements qualifiés. |
| 15E | Marseille : rendu et performances. | Captures/tour filmé, détails et ressources mesurés sur le corridor. |
| 15F | Marseille : livraison. | Sources/tests/build publiés, contrôle production séparé, reçu et reprise. |

**Lot actif : traiter la revue publiée 12F2 / 0.2.49 (PR n°3)**, puis fusion autorisée ; fiche [12F2](12F2-CHOIX-PNEUS-PAR-PILOTE.md). Ensuite **12F3**, transmission usure/type/services. Le choix d’une autre monte au stand est actif en solo/duo ; en ligne les stands renouvellent la monte de départ jusqu’à 12F3. Ne pas reprendre 12A–12F1 ni Safari. Le refus automatique main est documenté dans la reprise.

## 4. Roues : géométrie, matière et rotation

### 4.1 Formes dédiées

- Générer un pneu par révolution d’un profil : bande de roulement, épaules arrondies, flancs légèrement bombés, raccord propre à la jante. Conserver la différence de largeur avant/arrière.
- Construire la jante comme un volume creux : lèvre extérieure, fût intérieur, rayons aux sections crédibles, moyeu, écrou et disque visible derrière. Aligner les pièces dans le même repère de roue.
- Soigner les normales, les raccords de secteurs et la couture angulaire : aucune ligne sombre fixe, étoile au centre ni cassure de réflexion.
- Précalculer des variantes partagées, point de départ **96/64/32/16 segments**, avec 128 seulement si un gros plan le justifie. Choisir le détail par taille projetée et caméra, avec hystérésis.
- Objectif de silhouette : erreur de corde **≤ 0,5 pixel en gros plan High**, **≤ 1 pixel Medium** dans les cadrages de référence. Calculer le besoin avec `erreur = rayon_pixels × (1 − cos(π / segments))` ; ce critère évite de choisir un nombre arbitraire pour toutes les distances.
- Conserver les mêmes dimensions et positions entre les variantes. La déformation éventuelle au contact du sol doit être bornée et rester distincte d’un défaut de rondeur.

### 4.2 Apparence

Caoutchouc sombre à rugosité crédible, micrograin discret et variations progressives ; métal de jante plus réfléchissant. Utiliser les matériaux disponibles lorsque suffisants. Si une recette de caoutchouc, des coordonnées locales ou des paramètres par instance manquent, réaliser un ajout **opt-in dans FERRO canonique**, le qualifier, puis propager son verrou. Le canal `uEffects.z` est déjà affecté aux dégâts globaux et ne doit pas porter une seconde signification.

Les photos servent à examiner les proportions et les matières. Géométrie, motifs et matériaux restent générés par le code, avec les graphismes propres à BITUME.

### 4.3 Mouvement

- Rotation liée au déplacement et au rayon ; braquage d’Ackermann, suspension et axe de moyeu cohérents.
- Rainures, traces et marques tournent dans le repère local ; aucun motif projeté dans le monde ou glissant sur le pneu.
- Contrôler le sens de rotation à faible vitesse, en marche arrière et au braquage maximal, puis la lecture du mouvement à vitesse élevée. Les traitements visuels contre le stroboscope ne modifient pas la simulation.
- Vérifier les roues du joueur, des rivaux, des débris, de la démo et des rétroviseurs ; aucune ancienne roue grossière ne doit réapparaître à une transition de caméra.

## 5. Dessin des pneus

Les familles slick/intermédiaire/pluie sont documentées par le fabricant [S3]. Le dessin neige s’appuie sur les principes observables d’un pneu de compétition hivernal [S4] et devient une **création BITUME pour les courses enneigées** ; il n’est pas présenté comme un pneumatique officiel de Formule 1.

| Type | Pneu neuf | Évolution visible | Usage dans le jeu |
|---|---|---|---|
| `slicks` | Bande continue lisse, sans canaux ni pavés ; micrograin léger. | Bande polie, abrasion et gomme localisée selon les sollicitations. | Chaussée sèche. |
| `inter` | Sculpture modérée, canaux espacés et épaules encore largement continues. | Arêtes adoucies, sculpture progressivement moins profonde. | Chaussée humide ou en séchage. |
| `pluie` | Canaux longitudinaux et passages transversaux d’évacuation, creux réellement lisibles de près. | Pavés arrondis, gomme arrachée localement, rainures atténuées. | Forte humidité de chaussée. |
| `neige` | Pavés séparés, rainures plus ouvertes et lamelles fines. | Arêtes des pavés usées, lamelles moins visibles, salissures temporaires distinctes. | Chaussée effectivement enneigée. |

Le choix doit être lisible par la sculpture, même sans la bague de couleur. Conserver les identifiants existants et ajouter `neige` sans transformer une ancienne préférence en un autre pneu. La présélection avant course peut conseiller ; le changement réel reste une action de préparation ou de stands.

**Rendu selon la distance :** relief géométrique proche, détail de matière au milieu lorsque le moteur le permet, silhouette et réponse lumineuse cohérentes au loin. Partager les formes par type, essieu et niveau de détail. Les petites rainures ne doivent pas produire des centaines de pièces indépendantes ou du scintillement à distance.

## 6. Usure : état, causes et affichage

### 6.1 Contrat de données

Conserver `etat.pneus` comme identifiant du type monté pour limiter les ruptures. Ajouter un tableau `etat.etatPneus[4]` dans l’ordre **AVG, AVD, ARG, ARD**. État minimal prévu :

| Champ proposé | Rôle |
|---|---|
| `usure` dans [0, 1] | Quantité cumulée de gomme perdue ; persiste jusqu’au remplacement. |
| `salete` dans [0, 1] | Dépôt réversible : poussière, herbe, neige ; se nettoie au roulage. |
| `grainage` dans [0, 1] | Irrégularité visuelle liée aux sollicitations, avec transitions continues. |
| `distance` / cumul de sollicitation | Grandeurs utiles à la simulation et au diagnostic, maintenues dans des bornes maîtrisées. |
| Graine de motif stable | Distribution des traces reproductible, différente entre les roues. |

Déduire la graine de motif des identifiants séance/voiture/roue et employer un générateur indépendant. Ne consommer aucun tirage supplémentaire du générateur partagé de la course : grille, rivaux et répétabilité doivent rester inchangés.

Un méplat pourra être ajouté lorsque le blocage effectif d’une roue est représenté ; une pression sur le frein seule ne constitue pas une mesure de blocage. La température détaillée constitue une extension ultérieure si nécessaire, pas une condition pour livrer les traces d’usure demandées.

### 6.2 Évolution

- Mise à jour au pas fixe de simulation, à partir de la distance parcourue, de la charge et de la glisse ; abrasion accrue lors d’un patinage ou d’un freinage réellement glissant.
- Abrasion nulle pour une roue sans contact au sol, notamment pendant un saut ou une récupération ; ne pas réutiliser les anciennes valeurs de charge/glisse conservées par un état suspendu.
- Coefficients documentés et réglables par type et surface. Les valeurs sont des réglages de jeu à qualifier, sans prétendre à une simulation thermomécanique exhaustive.
- À conduite identique, obtenir la même usure quel que soit le nombre d’images par seconde. Une pause ne fait rien progresser ; un véhicule immobile sans patinage ne perd pas de gomme de roulage.
- Le contact extérieur d’un virage peut user davantage certaines roues. Ne pas synchroniser artificiellement quatre valeurs toujours identiques.
- Séparer évolution visuelle (lot 12D) et effet sur l’adhérence (12E), pour comparer et diagnostiquer chaque changement.
- Un replacement après accident conserve l’usure. Une réparation de carrosserie et un changement de pneus sont des événements distincts ; le service pneus terminé renouvelle les quatre pneus ensemble. Le type reste unique par voiture : une usure différente par roue ne crée pas de monte mixte implicite.

### 6.3 Traduction visuelle

Neuf : surface propre ; rodé : bande de contact légèrement polie ; usé : abrasion, irrégularités et diminution des sculptures ; très usé : traces plus marquées. Ces états servent aux captures de contrôle, mais la transition en jeu reste continue.

L’usure d’un slick ne doit pas inventer des rainures de pneu pluie. La profondeur des sculptures tend vers une valeur minimale bornée ; aucun changement brutal de maillage, de couleur ou de diamètre. La saleté doit pouvoir disparaître sans restaurer la gomme perdue.

### 6.4 Critères comportementaux

- Un parcours agressif use plus qu’un parcours propre comparable ; une route enneigée n’use pas comme une chaussée sèche avec le même pneu.
- Douze tours ne donnent pas nécessairement la même usure à tous les pilotes : les efforts réellement simulés comptent.
- Les quatre états restent finis et bornés pendant une longue démo ; aucune allocation non bornée de traces.
- Avant/après service : l’adhérence et l’apparence retrouvent le même état neuf, sans remise à neuf cachée lors d’un chargement de caméra.

## 7. Neige, adhérence, stands et réseau

### 7.1 Surface et physique

Définir une lecture commune de l’état de chaussée : humidité, couverture neigeuse et abri, avec une variation par portion si disponible. **L’hiver, des flocons à l’écran et une route enneigée sont des états distincts.** Une portion couverte ne reçoit pas automatiquement la même précipitation qu’une portion découverte.

Faire dépendre la recommandation de pneus de cette surface prévue. Équilibrer les quatre familles pour que chacune ait un usage utile : slick au sec, intermédiaire sur humide, pluie sur très mouillé, neige sur couverture neigeuse. L’usure dégrade progressivement et de façon bornée la réponse du pneu.

Le joueur et `course.js::commandesIA` utilisent les mêmes calculs. Dès qu’un changement affecte l’adhérence, le braquage ou les temps, incrémenter la **version physique réellement présente** et isoler records/fantômes incompatibles. Les lots de géométrie seule préservent leurs résultats de simulation.

### 7.2 Stands et interface

- Intégrer les quatre types dans la préparation, les réglages par joueur et les confirmations réseau ; fonctionnement complet à la manette, au clavier et au tactile.
- Migrer le choix actuellement unique par machine (`reglages.pneus`, `EL.pneusDe`) vers un choix par identifiant de pilote humain, y compris pour les deux joueurs d’une même machine. Au premier chargement, recopier l’ancienne préférence sur chacun, puis mémoriser leurs choix séparément.
- Montrer sobrement le type monté et l’état des pneus dans l’interface existante ; privilégier un petit indicateur ou une vue détaillée à la demande, en gardant le cockpit lisible.
- Le changement aux stands intervient à la fin du service, pas au simple passage de la ligne. Gérer interruption, sortie anticipée et double déclenchement.
- Les rivaux ne vont actuellement pas aux stands. Livrer une usure assez progressive pour les courses prévues ; avant de rendre des courses longues dépendantes de changements de pneus, ajouter et qualifier leur stratégie de service. Aucune restauration cachée d’usure pour compenser.

### 7.3 Synchronisation

Préserver les autorités existantes : chaque machine conduit ses humains, l’hôte gère les rivaux et les conditions. Ajouter un message compact et versionné de type/usure et un événement fiable de remplacement. Mesurer d’abord l’usage réel des messages existants ; ne pas élargir aveuglément chaque paquet de position à 60 Hz.

Point de départ à qualifier : état quantifié des quatre pneus, diffusé à faible fréquence et lors des changements significatifs ; les voitures distantes reçoivent cet état et l’interpolent visuellement. Elles ne recalculent pas une seconde usure concurrente. L’arrivée tardive d’un pair reçoit type, état et numéro de service courant.

Chaque message identifie la séance, le pilote, un numéro monotone de service et l’ordre des instantanés. Rejeter les états d’une séance ancienne, les paquets d’usure antérieurs à un changement de pneus et les instantanés dépassés. Le traitement d’un service reçu deux fois doit être idempotent.

Inclure un identifiant stable et une révision/empreinte de circuit dans la préparation. Refuser clairement le départ lorsque deux versions ne décrivent pas la même piste ou le même protocole. Couvrir solo, deux joueurs locaux, deux contre deux en ligne, départ d’un pair et reprise par l’IA.

## 8. Circuit russe : Baïkal, proposition de travail

**Identité proposée :** une route de compétition originale sur des rives rocheuses, un grand plan d’eau, une forêt boréale irrégulière et quelques constructions rurales. Ce choix donne une silhouette distincte du désert, des pics asiatiques et des grands séquoias déjà livrés.

### 8.1 Tracé

- Cible de conception **4,8 à 5,8 km**, longueur exacte mesurée après génération ; graine figée une fois la piste qualifiée.
- Enchaîner un secteur rapide dominant le lac, une partie technique en forêt, une montée vers un promontoire et un retour ouvert ; éviter les deux moitiés symétriques.
- Prévoir des possibilités de dépassement, un freinage important, des changements de rythme et une grille compatible avec les douze voitures.
- Employer le générateur original et ses marges de sécurité. L’adaptation à Monaco ne doit pas changer cette voie de génération.

### 8.2 Décor et saisons

- Former berges, affleurements et relief dans les nappes existantes ; privilégier leur silhouette aux accumulations d’objets.
- Bosquets de conifères et feuillus aux espacements irréguliers, clairières lisibles, herbe proche et couleurs de sol lointaines ; conserver les troncs et collisions entre qualités.
- Printemps : végétation renouvelée ; été : rive claire et forêt plus dense ; automne : feuillus colorés ; hiver : route et environs enneigés selon les conditions choisies. Une éventuelle surface gelée du lac relève du décor et ne devient pas une nouvelle voie roulable.
- Conserver jour/nuit, pluie/neige et conditions de l’hôte. Le mode réel utilise toujours la localisation IP du joueur/hôte déjà demandée, pas une requête météo du Baïkal ajoutée implicitement.

### 8.3 Livraison

Ajouter l’entrée au catalogue après les sept existantes : ID proposé `baikal`, indice attendu **7** si aucun autre circuit n’a été ajouté. Vérifier `main` avant d’attribuer l’indice ; l’ID reste la référence stable.

Onze rivaux doivent terminer plusieurs tours avec vrais obstacles, sous les conditions représentatives sec/pluie/neige. Compter contacts, replacements et durées de stagnation ; un secours automatique ne prouve pas la viabilité d’un tracé. Livrer les captures et mesures de coût avant de déclarer le rendu terminé.

## 9. Monaco : reconstruction fidèle

### 9.1 Référence et données établies

La référence officielle 2026 donne une longueur de **3 337 m** et **19 virages** [S1]. Le document FIA fournit le plan, les secteurs **1 051 m / 1 419 m / 867 m** et le dessin de la voie des stands [S2]. La somme des secteurs constitue un contrôle indépendant de cohérence avec la longueur annoncée.

Ces documents ne suffisent pas à connaître chaque largeur, rayon, cote de mur ou altitude. Le lot 14A doit acquérir des références géoréférencées et vues comparables, noter leur précision, puis distinguer mesures établies, estimations et points encore ouverts. Ne pas donner une précision supérieure aux sources disponibles.

Le dossier `docs/references/monaco-2026/` devra contenir :

- un manifeste de sources datées et leur usage ; les plans/photographies restent des références de travail, pas des textures embarquées ;
- des points de contrôle numérotés : ligne, apex/limites de virages, portails, entrée/sortie des stands et grands repères ;
- les coordonnées locales en mètres, l’altitude, la provenance et l’incertitude de chaque mesure ;
- des profils de largeur gauche/droite, altitude et dévers ;
- des vues de comparaison identifiées, le rapport d’écarts et la liste des approximations résiduelles.

Le relevé doit être constitué à partir de sources géographiques et visuelles vérifiables, en documentant la provenance des données réutilisées. Aucun tracé ni maillage d’un autre jeu ne sert de raccourci.

### 9.2 Architecture du tracé

Ajouter une voie de création explicite, par exemple `B.circuit.creerDepuisTrace(donnees)`, à côté du générateur à graine. Les coordonnées paramétriques embarquées et la génération des chaussées restent compatibles avec le jeu procédural et autonome.

- Convertir les données dans un repère local métrique ; ne pas utiliser des degrés de latitude comme distances du moteur.
- Utiliser une grille de simulation **uniforme**, avec `c.pas = longueur / nombre_de_points`, le nombre étant choisi pour résoudre la courbe la plus exigeante. Cette convention conserve les accès par `s / c.pas` et accepte une longueur de 3 337 m. Garder strictement le comportement historique de 2 m pour les anciens circuits.
- Raffiner séparément le maillage visuel de l’épingle, des chicanes, des portails et des ruptures de profil ; ne pas introduire subrepticement un tableau de simulation à pas variable. Éviter le lissage générique qui efface leurs caractéristiques.
- Fermer les raccords en conservant les repères mesurés. Une déformation globale destinée à forcer la fermeture ou la longueur ne remplace pas une géométrie correcte.
- Centraliser l’accès à la surface, aux bords et aux limites par abscisse. Chaussée dessinée, murs, collisions, IA, traces et caméras doivent lire les mêmes données.
- Identifier la portion et la couche de circulation lors des projections de hauteur, d’obstacles ou de replacement. Une recherche du segment le plus proche en plan sur la grille actuelle de 24 m ne doit pas envoyer une voiture sur une rue voisine, une surface de tunnel ou un autre niveau.
- Séparer validations universelles (valeurs finies, raccords, triangles non dégénérés, accès possibles) et contraintes propres au générateur de circuits originaux.

### 9.3 Zones à reproduire

Les numéros exacts et noms de chaque virage seront consignés dans le relevé 14A ; cette liste définit les ensembles visuels et fonctionnels à contrôler.

| Zone | Fidélité recherchée |
|---|---|
| Ligne droite / Sainte-Dévote | Grille, largeur réelle, rails, visibilité au premier freinage et départ de la montée. |
| Beau-Rivage / Massenet / Casino | Montée, ligne de regard, raccords de pente, place et masses bâties caractéristiques. |
| Mirabeau / épingle du Fairmont | Descente, épingle très serrée, dénivelé, rayon et enveloppe des voitures au braquage. |
| Portier | Proximité des façades, enchaînement des virages et arrivée au portail du tunnel. |
| Tunnel | Parcours courbe, portails, section intérieure, rythme des lumières, ouvertures et réadaptation à la lumière. |
| Nouvelle Chicane / Tabac | Sortie du tunnel, freinage, bords et vibreurs, silhouette du port et lignes de vue. |
| Piscine | Deux changements de direction, protections, bassins et tribunes dans les bonnes proportions. |
| Rascasse / Anthony Noghès | Derniers virages, bâtiments proches, raccord avec la ligne et séparation des stands. |
| Port et ville visibles | Bassins, quais, bateaux, façades, balcons et relief urbain placés selon les références. |

L’architecture est générée à partir de volumes et détails propres au jeu. De près, soigner proportions, ouvertures, garde-corps et alignements ; au loin, conserver les silhouettes et repères en simplifiant le détail.

### 9.4 Murs, grille et conduite

La piste ne sera pas élargie automatiquement pour satisfaire le générateur ou faire passer l’IA. Tester l’enveloppe complète de la voiture dans l’épingle et chaque passage étroit. Si le braquage à basse vitesse est insuffisant, apporter une adaptation explicite et qualifiée, avec la version physique appropriée.

Les limites ne doivent pas être recalculées différemment dans `decor.js` et `conduite.js`. Poser les segments de murs selon les bords réels, supprimer les trous aux raccords et empêcher le passage d’une rue à une portion voisine simplement parce qu’elles se rapprochent dans le plan.

Définir la grille par positions contrôlées, à la place d’un décalage universel de ±2,4 m. Adapter les corridors et vitesses de l’IA à chaque portion : freinage de l’épingle, changements de direction, file unique lorsque nécessaire, dépassement seulement si l’enveloppe est disponible.

Mesurer les blocages, sorties et replacements. Pour les scénarios de qualification de trajectoire sans accident provoqué, viser **zéro replacement de secours** ; pour les courses avec collisions, analyser chaque répétition au même endroit. Un véhicule remis en piste toutes les quinze secondes n’a pas validé un tour.

Faire terminer plusieurs tours aux **onze rivaux**, aux trois difficultés, sur sec/pluie et neige si celle-ci est autorisée par la politique retenue pour Monaco. Enregistrer les stagnations et replacements pour chaque scénario ; séparer l’échec de trajectoire de l’accident provoqué par un adversaire.

### 9.5 Tunnel et stands

Monaco décrit son tunnel explicitement ; le tunnel automatique montagnard de Haut-Col reste inchangé. Qualifier les transitions entre extérieur et intérieur : météo abritée, humidité de chaussée, exposition, reflets, rétroviseurs et caméras. Préserver le contexte visible depuis chaque portail.

Créer une vraie voie des stands : entrée, trajectoire séparée, limites, emplacements de service et sortie. Les déplacements suivent cette géométrie et ne coupent pas les murs. L’état de course, le compte-tours, les secteurs et le remplacement des pneus restent cohérents lors du passage dans cette voie.

Prévoir un identifiant de voie et une abscisse propre à cette voie, avec correspondance explicite vers la progression du tour. Le seul couple `s,d` de la piste principale ne suffit pas. Collisions, chronométrage/secteurs, replacement et messages réseau doivent comprendre la voie courante et ses raccords.

La politique saisonnière doit être explicitement documentée au lot 14A. Préserver l’exception actuelle de Port-Sable sans lui attribuer automatiquement de nouveaux circuits. Les conditions réelles restent celles du joueur/hôte ; la fidélité du parcours ne doit pas être confondue avec une météo réelle de Monaco non demandée.

### 9.6 Critères de fidélité

Ces chiffres sont **des cibles de validation**, pas des mesures prétendument déjà acquises :

| Contrôle | Cible et preuve |
|---|---|
| Longueur | 3 337 m avec écart calculé ≤ 1 m ; consigner aussi la convention de mesure. |
| Séquence | 19 virages dans le bon ordre et sens ; positions des secteurs cohérentes avec [S2]. |
| Points de contrôle | Viser ≤ 1 m en plan lorsque la source permet ce niveau ; publier les écarts et incertitudes, sans précision fictive. |
| Largeurs / murs | Comparer chaque zone critique à un relevé exploitable ; viser ≤ 0,25 m lorsque sa précision le permet. |
| Altitude | Reproduire profil et raccords mesurés ; viser ≤ 0,5 m sur les points fiables, signaler les autres. |
| Repères visibles | Comparaisons du cockpit et de caméras fixes aux vues sources ; pas de validation par la seule carte vue du dessus. |
| Parcours complet | Tour filmé continu, tunnel et stands compris, sans rupture de sol, de collision ou d’éclairage. |

Une longueur correcte seule ne suffit pas : le placement et l’enchaînement des lieux doivent également correspondre. Si les références nécessaires manquent, le lot reste « fidélité partielle, mesures à compléter » au lieu d’être déclaré ultra fidèle.

## 9 bis. Spéciale Marseille : extension explicite de la demande

Source vérifiée : **M4D135/emprise 0.6.8**, commit `cc004826a506e6979eaaec217748fe85d5cd6ac5`. Son centre du Vieux-Port est plat ; les reliefs de la Bonne-Mère, des îles et des Calanques sont synthétiques. Les compléments IGN de hauteur des bâtiments ne sont pas un MNT continu.

La demande est donc un **portage de la carte avec relief jouable ajouté** : sélectionner un parcours réel dans les rues, préparer un terrain altimétrique sourcé, puis raccorder chaussées, quais, fondations, objets, collisions et replacements. Extraire le corridor et l’horizon utiles, préserver les repères et attributions, et adapter les générateurs au FERRO de BITUME sans remplacer son verrou par celui d’EMPRISE.

La fiche **[15-SPECIALE-MARSEILLE-RELIEF.md](15-SPECIALE-MARSEILLE-RELIEF.md)** contient les chemins exacts, l’état des données, les six sous-lots 15A–15F et les contrôles. La master liste inclut Marseille comme dixième destination prévue et six propositions pour atteindre seize.

## 10. Intégration dans le jeu et performances

### 10.1 Catalogue et compatibilité

Conserver les sept IDs/graines existants : `val-brule`, `port-sable`, `haut-col`, `lande-noire`, `roche-fauve`, `brume-de-jade`, `cap-sequoia`. Ajouter `baikal`, `monaco`, puis `speciale-marseille` après qualification, sans réordonner les indices déjà utilisés. Mettre à jour menus, carte, démo, records, choix avant course et préparation réseau.

Les quatre pneus doivent fonctionner sur les anciens circuits comme sur les nouveaux. Conserver les conditions de l’hôte, les FPS de démo, le libellé Faune, les menus manette et le lien de téléchargement **m4d135 → BITUME.html**.

### 10.2 Coût de rendu

- Construire formes et motifs une fois ; partager les ressources entre les voitures. Aucun maillage ou texture régénéré chaque image.
- Simuler quatre petits états par voiture au pas fixe ; regrouper les mises à jour visuelles et borner les pools.
- Choisir le détail par caméra, y compris écran partagé et rétroviseurs. Les formes personnalisées ont besoin de variantes véritablement moins complexes.
- Conserver parcours, collisions et grands repères dans Low/Medium/High. Réduire les détails de matière et de façade en premier, avec transitions sans apparition brutale.
- Mesurer appels de rendu, triangles, mémoire, temps CPU/GPU disponibles, p50/p95 et pire image sur la même machine, résolution et scène.
- Garder le banc matériel déjà défini par le projet : Mac en 1390 × 1295, p95 visé ≤ 16,7 ms et pire ≤ 29 ms. Les résultats restent des mesures à faire, pas une promesse sur tous les appareils.

Ne pas accepter un surcoût non expliqué en disant que la roue « devrait être optimisée ». Documenter l’écart par rapport à la base et ajuster tessellation, motifs et détail distant après mesure.

## 11. Qualification utile, sans tests répétitifs

| Domaine | Vérifications pertinentes |
|---|---|
| Géométrie des roues | Cotes, tangence au sol, rondeur projetée, normales, absence de couture, rotation et Ackermann. |
| Pneus et usure | Neuf/milieu/usé pour quatre types ; slick lisse ; progression déterministe ; repos sans patinage ; saleté réversible ; replacement et service. |
| Physique | Scénarios comparables sec/humide/très mouillé/neige ; avantages relatifs cohérents ; joueur et IA ; absence de valeurs invalides. |
| Russie | Tracé, plusieurs tours des onze rivaux, saisons, obstacles stables et identité visuelle. |
| Monaco | Géométrie comparée aux sources, épingle, largeur locale, portails, chicanes, murs proches, grille et voie des stands. |
| Marseille | Carte source, corridor réel, MNT, pentes, raccords, fondations, couches de voie, collisions et placements. |
| Réseau | Type/usure, remplacement, reconnexion, arrivée tardive, incompatibilité de circuit, 2+2, autorité des conditions. |
| Régression | Empreintes des sept anciens circuits et de leurs 28 variantes saisonnières ; comparer aux scénarios de conduite avant chaque changement physique. |
| Livraison | Verrou FERRO, tests concernés puis suite globale au bon jalon, double build déterministe, sources/build distants et reçu. |

Adapter les suites existantes (`voiture`, `conduite`, `circuit`, `stands`, pré-départ réseau) et créer un test seulement pour un risque comportemental réellement nouveau. Une simple mise à jour de documentation ne justifie pas de relancer les 66 suites.

**Matrice visuelle minimale :** quatre pneus × neuf/milieu/usé, cockpit/poursuite/démo/rétros, High/Medium/Low, paysage et portrait ; vues déterministes des principaux lieux de Russie, Monaco et Marseille, jour/nuit et conditions représentatives. Faire des captures comparables, puis un tour réel : un aperçu CPU ne constitue pas une validation WebGL.

À la date du plan, Chromium ne démarre pas dans l’environnement de reprise (`socket(): Operation not permitted`). Conserver cette limite dans les reçus jusqu’à une validation sur machine réelle ; le travail peut être sauvegardé, mais les lots visuels ne sont pas clôturés sur la seule réussite des tests.

## 12. Publication, reprise et garde-fous techniques

1. Lire `REPRISE.md`, `ETAT.json`, puis uniquement le sous-lot actif. Relever le HEAD distant avant toute écriture.
2. Publier les premiers changements utiles comme checkpoint clairement identifié. Conserver un build jouable qualifié tant que les nouvelles sources ne le sont pas ; ne pas annoncer le checkpoint comme nouvelle livraison.
3. Au jalon de livraison, vérifier les sources, construire, contrôler la reproductibilité, puis publier sources/tests/build sur `main` sans force.
4. Vérifier le SHA distant et l’arbre. Si Git classique manque d’identifiants, le connecteur GitHub peut publier le même arbre, avec mise à jour conditionnelle de `main` et relecture ensuite.
5. En cas de travail concurrent, relire le nouveau HEAD et intégrer proprement ; ne pas écraser la contribution d’une autre session.
6. Écrire un reçu court : commit, version, fichiers concernés, résultats, captures/mesures effectuées, limites et prochaine action. Actualiser `REPRISE.md` et `ETAT.json`.
7. Pour une mise en ligne autorisée, comparer séparément le fichier servi au build qualifié. L’existence du commit GitHub ne prouve pas le déploiement.

Les modifications de FERRO restent dans son dépôt canonique, puis sont propagées avec le verrou ; aucune édition locale des modules verrouillés. Le jeu reste autonome avec contenu graphique et audio procédural. Les appels réseau restent ceux déjà prévus pour le mode en ligne et les conditions réelles, sans téléchargement de décors ou de modèles pendant la course.

## 13. Incertitudes à résoudre au bon lot

| Point ouvert | Résolution prévue |
|---|---|
| Identité russe précise | Baïkal retenu comme proposition de travail ; fixer nom final, graine et longueur en 13A. |
| Relevé métrique Monaco | Compléter coordonnées, largeurs et altitudes en 14A ; le plan FIA seul ne les fournit pas. |
| Neige à Monaco | Documenter la règle de saison/surface et son articulation avec les modes Manuel/Aléatoire/Réel en 14A. |
| Marseille : parcours et relief | Choisir le corridor EMPRISE et le MNT adapté en 15A–15B ; ne pas confondre hauteurs de bâti et terrain. |
| Paramètres de caoutchouc FERRO | Audit en 12C ; évolution opt-in canonique uniquement si les capacités existantes sont insuffisantes. |
| Intensité d’usure / courses longues | Calibrer en 12D–12F et intégrer la stratégie de stands IA avant de rendre ces arrêts nécessaires aux rivaux. |
| Braquage dans l’épingle | Mesurer l’enveloppe en 14C ; adapter explicitement si nécessaire et versionner la physique. |
| Validation visuelle et FPS | Exécuter sur un navigateur et du matériel réels ; garder la réserve tant que la mesure n’existe pas. |

## 14. Références et traçabilité

Sources externes consultées le **18 novembre 2026**. Les objectifs de performance, les tolérances et l’architecture décrits ci-dessus sont des décisions de conception du plan ; les liens suivants ne sont pas des preuves que ces objectifs sont déjà atteints.

- **[S1] Formula 1 — guide officiel du circuit de Monaco 2026** : longueur 3,337 km, 19 virages et contexte du parcours. <https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-the-circuit-de-monaco.vFsmfGHr6RWyLFtxi58wi>
- **[S2] FIA — Monaco 2026, Circuit Map / Pit Lane Drawing / Emergency Exits / Red Zone**, document daté du 4 juin 2026 ; page 2 du PDF : tracé et secteurs ; page 3 : stands. <https://www.fia.com/system/files/decision-document/2026_monaco_grand_prix_-_competition_notes_-_circuit_map_pit_lane_drawing_emergency_exits_map_and_red_zone.pdf>
- **[S3] Pirelli — familles de pneus de Formule 1**, référence générale slick/intermédiaire/pluie. <https://www.pirelli.com/tyres/en-gb/motorsport/car/formula-1>
- **[S4] Pirelli — Sottozero Snow S**, référence de principes visuels pour les pavés et rainures d’un pneu neige de compétition. <https://www.pirelli.com/tires/en-us/motorsport/car/rally/catalog/sottozero-snow-s>
- **[S5] UNESCO — Lake Baikal**, cadre géographique de l’identité russe proposée. <https://whc.unesco.org/en/list/754/>

- **[S6] EMPRISE — WORLD.md**, source de la carte Marseille et limites du relief actuel : <https://github.com/M4D135/emprise/blob/cc004826a506e6979eaaec217748fe85d5cd6ac5/docs/WORLD.md>.

Sources internes : `src/voiture.js`, `src/carene.js`, `src/conduite.js`, `src/degats.js`, `src/circuit.js`, `src/decor.js`, `src/course.js`, `src/jeu.js`, `src/reseau.js`, `FERRO.lock.json`, tests de `verifications/` et reçu `docs/reprise/rapports/cap-sequoia-2026-11-18/publication.json`, à la base 0.2.38 précisée en tête.

## 15. Checklist de progression

- [x] Exigences, état du code et premières références examinés.
- [x] Plan et critères d’acceptation rédigés avant implémentation.
- [x] 12A — contrat roues et catalogue de pneus : publié en 0.2.45.
- [x] 12B — rondeur, profils et jantes : publié en 0.2.45, aperçu CPU inspecté ; réserve WebGL.
- [x] 12C — sculptures et matériaux : publié en 0.2.45 ; réserve WebGL, choix neige raccordé dans le chantier 12E.
- [x] 12D — usure visible progressive et saleté réversible : publié en 0.2.46 ; réserve WebGL.
- [x] 12E — neige, adhérence et usure physique p10 : qualifié CPU avec réserves en 0.2.47 après bornage du recul ; 96/98 suites, traces hérité et réserve performance décor. WebGL non validé.
- [x] Publication 12E — sources, tests, build 0.2.47 et preuves contrôlés sur main (`c55cde2`) ; déploiement séparé.
- [ ] 12F — 12F1 publié en 0.2.48 ; 12F2 qualifié en revue 0.2.49 ; 12F3 usure/services réseau et stratégie IA restent à livrer.
- [ ] 13A — Russie, tracé et relief.
- [ ] 13B — Russie, décor et livraison.
- [ ] 14A — Monaco, dossier de référence métrique.
- [ ] 14B — Monaco, tracé explicite.
- [ ] 14C — Monaco, murs, grille et IA.
- [ ] 14D — Monaco, tunnel et stands.
- [ ] 14E — Monaco, architecture et port.
- [ ] 14F — qualification complète, publication et reçu.
- [ ] 15A — Marseille, source EMPRISE et corridor.
- [ ] 15B — Marseille, terrain altimétrique mesuré.
- [ ] 15C — Marseille, routes, ville et collisions sur le relief.
- [ ] 15D — Marseille, course, stands et IA.
- [ ] 15E — Marseille, visuel et performances.
- [ ] 15F — Marseille, publication et reçu.
