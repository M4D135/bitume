# Programme autonome — améliorations prévues par Claude

## Demande et règle de progression

Le 19 novembre 2026, David demande de continuer en autonomie **toute la liste des améliorations prévues par Claude**.
Enchaîner les sous-lots réalisables sans attendre un nouveau « go ». Garder les publications et la reprise courtes,
préserver chaque travail utile et noter les limites réelles. Un lot livré ne redevient pas à faire parce qu'une
ancienne case n'a pas été cochée. Les demandes récentes de `AGENTS.md` priment sur les études anciennes.

Base historique publiée : **0.2.59 / p14 / FERRO 0.3.14**, huit circuits. La CI après fusion termine à **126/127** :
seules traces à signature héritée, cockpit/nature/décor réussis. Reçu `rapports/COCKPIT-PILOTES-2026-11-19/PUBLICATION-0259.json`.
La réserve de durée du décor est conservée. Les publications 0.2.57 et 0.2.59 sont closes ; ne pas les recommencer.

Union actuelle **0.2.60 / p14 / FERRO 0.3.15** : **137/137 suites réussies** dans la campagne complète, aucun échec dans ce passage. Des dépassements de construction restent observés dans les trois passages ciblés inchangés de l’optimisation : 188 ms sur Val-Brûlé, 154 et 167 ms sur Haut-Col, pour un seuil de 150 ms. Cette réserve ne disparaît pas avec un passage complet réussi.
Deux builds identiques, 60 scripts valides et verrou FERRO conforme ; publication distante à constater.

## Priorités ajoutées pendant la continuation

1. Bras et coudes naturels dans la cuve, modèle intérieur/extérieur commun et commandes sans intersection.
2. Pneus sans barres blanches, formes arrondies et usure irrégulière.
3. Matières fines du cockpit ; pluie, ruissellement et neige humide plus riches.
4. Bâtiments détaillés et garages/stands : service sur la voie existante, garages derrière le muret,
   sans nouveau trajet de conduite ni animation de mécaniciens.

Les variations restent procédurales et déterministes. Éviter cubes, carrés de texture et répétitions
symétriques artificielles. Les travaux Baïkal 13B, tracé explicite et acquisitions Monaco/Marseille sont
intégrés et qualifiés localement ; les paquets Monaco/Marseille n’ajoutent pas encore de course au catalogue.

## File complète réconciliée

| Lots | Travail | État après qualification locale 0.2.60 | Suite concrète |
|---|---|---|---|
| 5B | Chargement, cadence, allocations, arbres et rétroviseurs | Socle livré en 0.2.40 | Conserver ; mesures matérielles séparées. |
| 12A–12F4 | Roues, quatre montes, usure, choix par pilote, service, réseau, stratégie des stands | Code livré jusqu'en 0.2.52 et adapté à p14 | Captures et mesures réelles encore ouvertes. |
| 13A | Tracé et relief Baïkal | Livré, ID `baikal`, indice 7, graine 179 | Préserver tracé, départ et stands. |
| **13B** | **Lac, berges rocheuses, promontoire, forêt boréale, clairières, hameau et saisons** | Intégré et qualifié localement avec le réalisme | Publier ; conserver les contrôles de piste/faune et les réserves matérielles. |
| 14A | Sources Monaco 2026 | Boucle FIA/OSM conservée ; 830 observations terrain IGN et registre contrôlé sur 415 points, publiés ; CI 139/139 | Chaussée non qualifiée ; 32 écarts >1 m entre produits, tunnels et niveaux à examiner. Largeurs/dévers inconnus. Voir `MONACO-MESURES-2026-11-20.md`. |
| 14B | Construction depuis un tracé explicite | Fondation intégrée et qualifiée ; 34 contrôles dédiés | Fournir les données du site, IA/grille/stands et qualifier la course avant catalogue. |
| 14C | Murs, épingle, grille, IA et collisions Monaco | À réaliser après données/tracé | Enveloppes réelles de la voiture et séparation des rues voisines. |
| 14D | Tunnel et voie des stands Monaco | À réaliser | Voies/couches explicites, progression et service corrects, météo/lumière. |
| 14E–14F | Port, ville, architecture, rendu et qualification Monaco | À réaliser | Repères reconnaissables et rapport d'écarts ; ne pas déclarer ultra fidèle des cotes estimées. |
| 15A | Extraction du corridor Marseille depuis EMPRISE | Paquet source reproductible : 1 177 polylignes de voies, 5 274 empreintes ou parties bâties, 119 repères | Choisir le corridor roulable et qualifier ses raccords ; voir `docs/references/marseille-2026/README.md`. |
| 15B | Relief mesuré Marseille | Grille de reconnaissance IGN archivée : 65×65, pas voisin de 19 m ; couverture non entièrement qualifiée | Résoudre la contradiction de bbox, identifier dalles/dates/datum, densifier le corridor et distinguer quais, tabliers et terrain. |
| 15C–15F | Route, ville, collisions, IA et livraison Marseille | À réaliser après 14B et 15B | Reposer tous les éléments sur un relief cohérent ; gérer les superpositions. |
| 22A Haut-Col | Rampes supérieures à 10 %, corniche du grand virage et second tunnel | Non clos : le générateur actuel limite encore le relief à 6,8 % | Garder son identifiant, sa graine et son tracé en plan ; qualifier les pentes et les rivaux avec p14. |
| 22F montagne | Route-des-Cimes distinct de Haut-Col | Prototype historique préparé, absent du catalogue courant | Réconcilier le tracé, le Mur, les passages couverts, le pont et p14. |
| 16A–16F | Six destinations originales supplémentaires | Conception à préciser puis réalisation | Fjord-d'Argent, Crêtes-des-Carpates, Landes-d'Écosse, Sierra-Cuivrée, Baie-du-Corail, Col-des-Andes. |
| 17 | Conduite et aides | p14 livré ; Légère appliquée par défaut, autres choix encore partiels ou absents | Calibrer 521 ch, différencier l’ABS et revoir la dérive active/le guidage clavier ; détails du constat ci-dessous. |
| 18 | Public humain animé | Livré depuis 0.2.41 | Préserver les spectateurs/rétroviseurs ; anciennes fiches non mises à jour. |
| 19 | Pluie et neige sur la vitre, effet plus riche | Fusion, ruissellement, fonte, vitesse et réglage intégrés et qualifiés localement | Inspection en jeu sur matériel ; aucun geste d’essuyage ajouté. |
| 20 | Flammes, détonations et sons d'échappement | Livré depuis 0.2.41 | Préserver joueur/concurrents et rendu des rétros. |
| 21 | Ombres, éclairage, eau, reflets, grain | Ombres, flaques et sols partiellement livrés | Reflets voiture/personnages, tunnels, palier Photo, courbe conservant les teintes et nuit sombre ; moteur dans FERRO canonique. |
| 22B–22D | Lieux caractéristiques, vrais vides/gorges, ponts, niveaux superposés et 1–2 passages couverts par circuit | Jets préparés, intégration restante | Adapter à la géométrie réellement utilisée par PhysX ; vérifier éclairage, météo et absence de traversée dans chaque vue et les rétros. |
| 23/25 | Matières cockpit/voiture, métal/peinture, freins, chaleur et salissures | Programme partiellement restant | Réutiliser roues/échappement et conserver la silhouette et les ancrages corrigés du lot réalisme. Cuir/tissu fins intégrés et qualifiés localement ; freins/chaleur/salissures restent ouverts. |
| 24 | Vibrations par manette | Livré depuis 0.2.40 | Essai matériel restant ; quatre sorties et J1/J2 conservés. |
| 26 | Animaux propres aux biomes | Livré depuis 0.2.41 | Étendre aux nouveaux biomes ; aucun animal ne traverse la piste. |
| 27 | Invitations sans serveur dédié à gérer | Prototype non intégré | Réconcilier signalisation par code/invitation et replis, puis essai entre réseaux. |
| 28A/28C | Herbier et saisons moins coûteux | Livrés en 0.2.40 | Conserver. |
| 28B/28D | Précréation du catalogue et installation progressive | Partiel/à vérifier | Mesurer les tâches restantes au chargement, puis répartir le travail utile. |
| 28E | Cache IndexedDB | Jet historique non intégré | Vérifier invalidation/version, erreurs/quota, autonomie et intégrité des données. |
| 28F–28H | C/WASM, Worker, banc WebGPU | Conditionnels à une mesure | Appliquer seulement à un calcul identifié et conserver le repli compatible. |
| Historique | Records par circuit/mode/boîte et historique | Stockage actuel plus simple | Migration compatible, identité physique/piste et isolation des essais. |
| Historique | Championnat de plusieurs courses | Non livré | Progression, résultats et reprise ; distinct des saisons météo. |

Les bords dangereux et publicités de `bords.js`, les repères de virages et leurs annonces, les démos cinéma,
le regard arrière, les animations des pilotes et les dégagements du cockpit sont déjà intégrés.
Safari a été corrigé : ne pas rouvrir ce chantier sans défaut nouveau établi.

## Catalogue conservé

Les sept circuits historiques et Baïkal restent aux mêmes indices. Ajouter Monaco, Marseille et la montagne
sans remplacer Haut-Col. Les six propositions restent dans le programme : **17 destinations** si elles sont
toutes réalisées, sans effacer une demande pour conserver l'ancien total de 16.

Priorité d'intégration : correctifs de réalisme ci-dessus, 13B, puis Monaco et ses fonctions communes, Marseille, montagne distincte et six
destinations. Les acquisitions de sources et les fonctions indépendantes peuvent être préparées en parallèle.
Les améliorations transversales s'intègrent par lots séparés selon leurs dépendances, avec une seule tête livrée.

## État réel de la conduite p14, avant le lot 17

La migration PhysX ne clôt pas à elle seule les choix validés. Lecture des chemins réellement appelés dans
`src/jeu.js`, `src/course.js`, `src/conduite.js` et `src/physique.js`, sans modification de la conduite :

| Choix | Constat | Travail restant |
|---|---|---|
| 521 ch | La propulsion reste une poussée empirique par rapport, avec `coeffMoteur = 13`. | Calibrer la puissance et qualifier accélération, régimes et vitesse avant toute nouvelle version physique. |
| Dérive issue de la glisse | La charge lit le β réel, mais le bouton, la courbure de piste, la loi du pneu arrière et un tirage avant actif interviennent encore. | Définir et qualifier la transition vers la glisse réelle, avec le ressenti arcade demandé. |
| Aide Légère par défaut | Valeur 0,35 transmise à J1/J2, choix mémorisé respecté, contre-braquage effectivement appliqué. | Préserver ; vérifier séparément le guidage clavier/tactile de 0,15 qui agit indépendamment de l’aide. |
| ABS selon aide | Freinage et indicateur de blocage ne lisent pas le niveau d’aide. | Ajouter et qualifier les niveaux léger et complet ; Aucune reste sans ABS. |

Ces écarts ne sont pas corrigés silencieusement dans la livraison visuelle. Le lot 17 repart du vrai code
p14, avec changement explicite de version physique, contrôles de conduite et migration des records au jalon approprié.

## Accès et niveaux de preuve

Le lanceur Spark prévu par le projet et la configuration SSH vers le Mac ne sont pas présents dans cet
environnement. Le développement continue ici ; ne pas prétendre à un calcul délégué au Spark ou à un déploiement.
Chromium échoue au démarrage sur la création d'une socket (`Operation not permitted`). Les contrôles CPU,
maillages et rasters logiciels sont possibles ; ils ne prouvent ni les shaders finaux ni les FPS matériels.
L'accès GitHub fonctionne. Les Actions FERRO sont actuellement bloquées avant démarrage par la facturation/plafond du compte ; consigner les suites locales séparément et ne pas inventer un succès CI. Publier le travail qualifié et consigner les limites sans demander une confirmation
déjà couverte par la demande autonome. Ne pas changer de seuil ou d'oracle pour masquer un échec.

Chaque livraison conserve sources, tests utiles, build reproductible, résumé des résultats et reçu vérifié.
Ne pas ajouter de journaux bruts ni de chemins internes aux nouveaux rapports publiés.
