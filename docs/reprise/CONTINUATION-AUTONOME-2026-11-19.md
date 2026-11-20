# Programme autonome — améliorations prévues par Claude

## Demande et règle de progression

Le 19 novembre 2026, David demande de continuer en autonomie **toute la liste des améliorations prévues par Claude**.
Enchaîner les sous-lots réalisables sans attendre un nouveau « go ». Garder les publications et la reprise courtes,
préserver chaque travail utile et noter les limites réelles. Un lot livré ne redevient pas à faire parce qu'une
ancienne case n'a pas été cochée. Les demandes récentes de `AGENTS.md` priment sur les études anciennes.

Base historique publiée : **0.2.59 / p14 / FERRO 0.3.14**, huit circuits. La CI après fusion termine à **126/127** :
seules traces à signature héritée, cockpit/nature/décor réussis. Reçu `rapports/COCKPIT-PILOTES-2026-11-19/PUBLICATION-0259.json`.
La réserve de durée du décor est conservée. Les publications 0.2.57 et 0.2.59 sont closes ; ne pas les recommencer.

Base actuelle **0.2.62 / p15 / FERRO 0.3.15** : PR **#31** fusionnée (`27bdf08de3a712e6658b71d428d2a7d1af3fece5`), **147/147 suites** et **41 PNG** vérifiés, puis complément natif de dégagement PR **#32** fusionné (`3fc9421eb87c9bfdc296673e48220c0667626058`), **148/148 suites**. Ces deux qualifications sont distinctes ; le complément ne modifie ni le runtime ni le HTML. L'aspiration bénéficie au suiveur, le souffle et les projections à 300 km/h sont qualifiés sur leur banc. Cette publication ne clôt pas tous les choix du lot 17 ni tous les travaux visuels.
Audit des branches historiques et du travail réellement livré : [BRANCHES-ET-LOTS-2026-11-20.md](BRANCHES-ET-LOTS-2026-11-20.md). Les références de commits anciens ne prouvent pas que leurs objets et prototypes ont été récupérés. Partir de p15 pour toute réconciliation.
La publication 0.2.60 est close : PR #20, reçu `rapports/REALISME-2026-11-19/PUBLICATION-0260.json`. Clôture 0.2.61 : `rapports/HAUT-COL-METEO-2026-11-20/PUBLICATION-0261.json`. Les dépassements historiques restent ouverts : 188 ms Val-Brûlé, 154/167 ms Haut-Col, seuil inchangé de 150 ms. Les captures SwiftShader ne qualifient pas les FPS matériels.

## Priorités ajoutées pendant la continuation

**Prochain sous-lot :** réconcilier les corrections préparées séparément des caméras de démo et des sols,
du volant, du regard et des gestes du pilote, puis des gouttes qui se déplacent, fusionnent et s'évacuent
avec la vitesse. Les comparer au runtime p15 publié avant construction et qualification. Les améliorations
déjà livrées ci-dessous restent acquises ; les défauts récents signalés ne sont pas déclarés corrigés par ce bilan.

1. Bras et coudes naturels dans la cuve, modèle intérieur/extérieur commun et commandes sans intersection.
2. Pneus sans barres blanches, formes arrondies et usure irrégulière.
3. Matières fines du cockpit ; pluie, ruissellement et neige humide plus riches.
4. Bâtiments détaillés et garages/stands : service sur la voie existante, garages derrière le muret,
   sans nouveau trajet de conduite ni animation de mécaniciens.

Les variations restent procédurales et déterministes. Éviter cubes, carrés de texture et répétitions
symétriques artificielles. Les travaux Baïkal 13B, tracé explicite et acquisitions Monaco/Marseille sont
intégrés et qualifiés localement ; les paquets Monaco/Marseille n’ajoutent pas encore de course au catalogue.

## File complète réconciliée

| Lots | Travail | État après publication 0.2.62 | Suite concrète |
|---|---|---|---|
| 5B | Chargement, cadence, allocations, arbres et rétroviseurs | Socle livré en 0.2.40 | Conserver ; mesures matérielles séparées. |
| 12A–12F4 | Roues, quatre montes, usure, choix par pilote, service, réseau, stratégie des stands | Code livré jusqu'en 0.2.52 et adapté à p14 | Captures et mesures réelles encore ouvertes. |
| 13A | Tracé et relief Baïkal | Livré, ID `baikal`, indice 7, graine 179 | Préserver tracé, départ et stands. |
| **13B** | **Lac, berges rocheuses, promontoire, forêt boréale, clairières, hameau et saisons** | Publié avec le réalisme 0.2.60, PR #20 close | Conserver les contrôles de piste/faune et les réserves matérielles. |
| 14A | Sources Monaco 2026 | Boucle FIA/OSM conservée ; 830 observations terrain IGN et registre contrôlé sur 415 points, publiés ; CI 139/139 | Revue exhaustive qualifiée : 32 écarts, 33 points tunnel, 49 points avec les pentes ; 35 contrôles ciblés. Sonde BD TOPO Louis-II candidate (7 objets). Chaussée/largeurs/dévers inconnus ; revue publiée par PR #26, CI 144/144. Voir `MONACO-REVUE-2026-11-20.md`. Complément carte/profils et provenance temporelle publié par PR #29, CI 145/145, 8 nouveaux contrôles ; périodes de dalle distinctes des dates individuelles inconnues. Voir `MONACO-CARTE-REVUE-2026-11-20.md`. Suite : acquisition BD TOPO ciblée et qualification des niveaux/dates/limites. |
| 14B | Construction depuis un tracé explicite | Fondation intégrée et qualifiée ; 34 contrôles dédiés | Fournir les données du site, IA/grille/stands et qualifier la course avant catalogue. |
| 14C | Murs, épingle, grille, IA et collisions Monaco | À réaliser après données/tracé | Enveloppes réelles de la voiture et séparation des rues voisines. |
| 14D | Tunnel et voie des stands Monaco | À réaliser | Voies/couches explicites, progression et service corrects, météo/lumière. |
| 14E–14F | Port, ville, architecture, rendu et qualification Monaco | À réaliser | Repères reconnaissables et rapport d'écarts ; ne pas déclarer ultra fidèle des cotes estimées. |
| 15A | Extraction du corridor Marseille depuis EMPRISE | Paquet source reproductible : 1 177 polylignes de voies, 5 274 empreintes ou parties bâties, 119 repères | Choisir le corridor roulable et qualifier ses raccords ; voir `docs/references/marseille-2026/README.md`. |
| 15B | Relief mesuré Marseille | Grille de reconnaissance IGN archivée : 65×65, pas voisin de 19 m ; couverture non entièrement qualifiée | Résoudre la contradiction de bbox, identifier dalles/dates/datum, densifier le corridor et distinguer quais, tabliers et terrain. |
| 15C–15F | Route, ville, collisions, IA et livraison Marseille | À réaliser après 14B et 15B | Reposer tous les éléments sur un relief cohérent ; gérer les superpositions. |
| 22A Haut-Col | Rampes supérieures à 10 %, corniche du grand virage et second tunnel | Non clos : relief encore limité à 6,8 %, un tunnel de 260 m | Garder son identifiant, sa graine et son tracé en plan ; qualifier les pentes et les rivaux depuis p15. |
| 22F montagne | Route-des-Cimes distinct de Haut-Col | Prototype historique référencé, absent du catalogue courant ; Baïkal occupe déjà la huitième place | Récupérer et relire les travaux, puis réconcilier le tracé, le Mur, les passages couverts, le pont et les châssis p15, sans remplacer un circuit. |
| 16A–16F | Six destinations originales supplémentaires | Conception à préciser puis réalisation | Fjord-d'Argent, Crêtes-des-Carpates, Landes-d'Écosse, Sierra-Cuivrée, Baie-du-Corail, Col-des-Andes. |
| 17 | Conduite et aides | Châssis PhysX et aspiration p15 livrés ; Légère appliquée par défaut, autres choix encore partiels ou absents | Repartir de p15, sans importer directement l'ancien modèle p9 ; calibrer 521 ch, différencier l’ABS et revoir la dérive active/le guidage clavier. |
| 18 | Public humain animé | Livré depuis 0.2.41 | Préserver les spectateurs/rétroviseurs ; anciennes fiches non mises à jour. |
| 19 | Pluie et neige sur la vitre, effet plus riche | Optique 0.2.61 publiée, projections du rival renforcées en 0.2.62 ; corpus final PR31 de 41 PNG comprenant pluie/tunnel, neige et sillage | Réconcilier les évolutions de gouttes préparées séparément ; inspection sur matériel et coût réel ouverts, réglage 0–2 et absence de geste d’essuyage conservés. |
| 20 | Flammes, détonations et sons d'échappement | Livré depuis 0.2.41 | Préserver joueur/concurrents et rendu des rétros. |
| 21 | Ombres, éclairage, eau, reflets, grain | Ombres, flaques et sols partiellement livrés ; lignes diagonales héritées sur les pentes claires, cause à diagnostiquer | Reflets voiture/personnages, tunnels, palier Photo, courbe conservant les teintes et nuit sombre ; diagnostiquer le terrain sans présumer la cause, correction moteur dans FERRO canonique. |
| 22B–22D | Lieux caractéristiques, vrais vides/gorges, ponts, niveaux superposés et 1–2 passages couverts par circuit | Jets préparés, intégration restante | Adapter à la géométrie réellement utilisée par PhysX ; vérifier éclairage, météo et absence de traversée dans chaque vue et les rétros. |
| 23/25 | Matières cockpit/voiture, métal/peinture, freins, chaleur et salissures | Programme partiellement restant | Réutiliser roues/échappement et conserver la silhouette et les ancrages corrigés du lot réalisme. Cuir/tissu fins intégrés et qualifiés localement ; freins/chaleur/salissures restent ouverts. |
| 24 | Vibrations par manette | Livré depuis 0.2.40 | Essai matériel restant ; quatre sorties et J1/J2 conservés. |
| 26 | Animaux propres aux biomes | Livré depuis 0.2.41 ; caméra Haut-Col corrigée en 0.2.61, appuis contrôlés et plans été/hiver inspectés | Étendre aux nouveaux biomes ; aucun animal ne traverse la piste. |
| 27 | Invitations sans serveur dédié à gérer | Prototype historique non intégré ; jeu courant encore relié au salon | Aucune IP à fournir par David. Récupérer et adapter le prototype à p15, qualifier signalisation, replis et réseaux distincts ; conserver le salon jusqu'à validation du remplacement. |
| 28A/28C | Herbier et saisons moins coûteux | Livrés en 0.2.40 | Conserver. |
| 28B/28D | Précréation du catalogue et installation progressive | Partiel/à vérifier | Mesurer les tâches restantes au chargement, puis répartir le travail utile. |
| 28E | Cache IndexedDB | Historique Spark : quatre fiches et trois commits après `b1ed8e4`, non relus ; aucun cache IndexedDB de niveau dans le runtime inspecté | Récupérer les commits avant attribution d'un gain ; vérifier invalidation/version, erreurs/quota, autonomie et intégrité des données. |
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

Les correctifs de réalisme 0.2.61, l'aspiration/sillage 0.2.62 et 13B sont publiés. Réconcilier d'abord les
corrections récentes de démo/sols/volant/pilote/gouttes, puis poursuivre Monaco et ses fonctions communes,
Marseille, la montagne distincte et les six destinations. Les acquisitions de sources et les fonctions indépendantes peuvent être préparées en parallèle.
Les améliorations transversales s'intègrent par lots séparés selon leurs dépendances, avec une seule tête livrée.

## État réel de la conduite p15, avant la suite du lot 17

La migration PhysX ne clôt pas à elle seule les choix validés. Lecture des chemins réellement appelés dans
`src/jeu.js`, `src/course.js`, `src/conduite.js` et `src/physique.js`, sans modification de la conduite :

| Choix | Constat | Travail restant |
|---|---|---|
| 521 ch | La propulsion reste une poussée empirique par rapport, avec `coeffMoteur = 13`. | Calibrer la puissance et qualifier accélération, régimes et vitesse avant toute nouvelle version physique. |
| Dérive issue de la glisse | La charge lit le β réel, mais le bouton, la courbure de piste, la loi du pneu arrière et un tirage avant actif interviennent encore. | Définir et qualifier la transition vers la glisse réelle, avec le ressenti arcade demandé. |
| Aide Légère par défaut | Valeur 0,35 transmise à J1/J2, choix mémorisé respecté, contre-braquage effectivement appliqué. | Préserver ; vérifier séparément le guidage clavier/tactile de 0,15 qui agit indépendamment de l’aide. |
| ABS selon aide | Freinage et indicateur de blocage ne lisent pas le niveau d’aide. | Ajouter et qualifier les niveaux léger et complet ; Aucune reste sans ABS. |

Le correctif p15 d'aspiration ne modifie pas ces choix de puissance, de freinage ou d'aide. L'étude et les
jets Spark écrits pour p9 restent des références à réévaluer ; leur copie directe remplacerait des chemins
désormais exécutés par PhysX. La suite du lot 17 repart du vrai code p15, avec changement explicite de
version physique, contrôles de conduite et migration des records au jalon approprié.

## Réseau : lever l'ambiguïté sur les adresses IP

La note du 18 novembre demandait un choix sur la visibilité de l'adresse réseau par les relais publics,
pas une saisie des adresses IP de David ou des joueurs. Aucune réponse explicite à cette question précise
n'est attestée ici ; ne pas en inventer. La récupération, l'adaptation et les essais du prototype peuvent
continuer dans le cadre de la demande autonome. Le code ou l'invitation échange la signalisation ; WebRTC
cherche les chemins réseau. Certains NAT ou pare-feux nécessitent un relais de trafic : ce point et
l'essai entre deux réseaux restent à qualifier. Détails et références :
[audit du lot 27](BRANCHES-ET-LOTS-2026-11-20.md#lot-27--ce-que-signifiait-la-question-sur-les-ip).

## Accès et niveaux de preuve

Le lanceur Spark prévu par le projet et la configuration SSH vers le Mac ne sont pas présents dans cet
environnement. Le développement continue ici ; ne pas prétendre à un calcul délégué au Spark ou à un déploiement.
Le démarrage local de Chromium a été bloqué par la création d'une socket (`Operation not permitted`).
Les captures WebGL2 finales ont été réalisées en Actions sous SwiftShader et inspectées : elles montrent
des états disposés à poses figées, sans qualification d'une course complète ni des FPS sur matériel.
L'accès GitHub fonctionne et les qualifications BITUME PR31/PR32 sont réussies. Les anciens constats de
blocage de facturation des Actions FERRO ne décrivent pas automatiquement leur état actuel.
Conserver séparément les preuves locales, les CI candidates et l'observation des fusions ; ne pas
revendiquer une nouvelle campagne après fusion. La réserve facultative S8 reste **1 031 °/s² pour une
cible de 300**, avec **46/46 critères obligatoires** réussis. Publier le travail qualifié et consigner les
limites sans demander une confirmation déjà couverte par la demande autonome. Ne pas changer de seuil
ou d'oracle pour masquer un échec.

Chaque livraison conserve sources, tests utiles, build reproductible, résumé des résultats et reçu vérifié.
Ne pas ajouter de journaux bruts ni de chemins internes aux nouveaux rapports publiés.
