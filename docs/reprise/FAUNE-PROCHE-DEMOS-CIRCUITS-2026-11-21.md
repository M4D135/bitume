# BITUME — faune proche et démos des circuits

Date : 21 novembre 2026. **État : F1/F2 et D1/D2 préparés ; candidat 0.2.87 en réception.**
Base observée sur `main` : **0.2.85**, commit `0e7273c0361996b9c217e6f1051a9ef9a54b18c7`.
Demandes publiées dans `7fb5dcc`, implémentation initiale dans `815158c` / 0.2.86.
Les 81 captures des neuf circuits ont été inspectées : route, tracé et lieux cadrés,
sans caméra dans le terrain ni sujet de nature autonome. La revue a détecté une coupure
brusque des animaux à la portée. **0.2.87 ajoute un fondu réel avant cette limite**, avec
réserve du flux transparent dès le chargement. CI complète et images de ce nouveau
build restent à recevoir avant livraison. Les deux bancs hérités de .86 sont repris
dans la branche locale `codex/bitume-faune-demos-validation-20261121` : Baïkal vérifie
le dégagement réel et une population effectivement animée ; le cycle PhysX charge
la dépendance des champs de vue. Le runtime et son empreinte .87 sont conservés.
Le candidat autorisé est publié sous `dbda6a7`, arbre identique à `4200e03`.
La CI et les démos exactes sont en réception. Le premier banc faune proche a refusé
son propre placement : états de conduite déplacés, corps PhysX restés sur la grille.
Le complément demande le replacement natif avant chauffe et vérifie la pose réelle.
Les images de la transition opaque/FX restent requises avant main.
[Réception distante .87](rapports/FAUNE-DEMOS-2026-11-21/RECEPTION-DISTANTE-0287.json).
[Preuve du candidat](rapports/FAUNE-DEMOS-2026-11-21/CANDIDAT-0287.json).
[Réception locale .87](rapports/FAUNE-DEMOS-2026-11-21/RECEPTION-LOCALE-0287.json) : **203/203 suites Node et 8/8 contrôles Python** reçus, sans seuil assoupli. Les dix premiers échecs de fixtures absentes restent consignés ; leurs reprises réussissent après restauration des 82 fichiers exacts. La transition opaque/FX à 144 m en Légère et 288 m en Fine reste à examiner dans le rendu réel de jour et de nuit.

## Demandes de David et priorité

- Placer les animaux **près du circuit**, là où le joueur peut les voir depuis la route.
- Ne pas gérer une population d’animaux inutile hors champ.
- **Refaire les démos avec les circuits actuels** et leurs nouveaux lieux emblématiques.
- Montrer uniquement **la route, le circuit et son point d’intérêt** : aucun plan consacré
  à l’herbe, aux animaux, à la flore ou à un autre sujet détaché du circuit.
- Pousser ces demandes sur Git pour suivre leur progression.

Cette décision remplace les consignes historiques du 19 novembre demandant des plans
de nature/faune/flore. Elle remplace aussi le choix ancien de silhouettes animales
lointaines en qualité Légère et la distance uniforme de 34 m depuis l’axe lorsqu’elle
empêche une présence proche et lisible. Les animaux restent **hors de la chaussée** :
le rapprochement ne demande ni traversée de piste ni nouveau danger de collision.

## État constaté dans les sources 0.2.85

- `src/animaux.js` conserve des habitats jusqu’à 420 m de l’axe et une recherche
  d’habitat jusqu’à 440 m. La simulation parcourt les groupes avant le rejet au dessin.
  Le profil `low` écarte les groupes à moins de 150 m de l’axe et les animaux à moins
  de 120 m de la caméra : ces exclusions proches sont à remplacer.
- `src/realisateur.js` sélectionne encore des séquences `flore` et `faune`.
  `src/cinema.js` prépare leurs ancres et ne compose pas encore les plans à partir
  des nouveaux marqueurs `decor.lieux.marqueurs` fournis par `src/lieux.js`.
- Le catalogue courant compte neuf circuits. Larche → Vinadio dispose du socle
  de parcours ouvert L2, mais son intégration jouable L3/L4 reste à poursuivre.

## F — animaux utiles à proximité de la route

1. Définir une bande d’habitat proche à partir des **bords réels de la chaussée**,
   de la taille de l’animal et du terrain ; mesurer et consigner sa largeur par biome.
   Garder les animaux sur un support cohérent, hors chaussée, tunnels, murs et stands.
   Les espèces marines restent dans l’eau proche visible depuis le circuit.
2. Réduire la population aux secteurs utiles et visibles depuis les vues de conduite.
   Les animaux lointains sans intérêt pour la course ne doivent pas consommer de budget.
   En Légère, privilégier quelques animaux proches avec un modèle simple.
3. Sélectionner les groupes utiles **avant** simulation, animation et construction des poses.
   Hors des vues utiles : sommeil sans cerveau, articulation, sondage terrain détaillé
   ni préparation de rendu. Seule une sélection spatiale légère et bornée est nécessaire.
4. Calculer la visibilité pour J1, J2 et les rétroviseurs effectivement actifs.
   Une ombre ou un reflet réellement visible peut justifier une contribution limitée ;
   cela ne doit pas réactiver largement toute la population derrière la caméra.
5. Réveiller progressivement les animaux devenant visibles, sans saut de pose, apparition
   brutale ni rafale de pas à rattraper. Conserver le déterminisme et les pools bornés.
6. Préserver le choix **Faune désactivée**, son court-circuit de création de population,
   de simulation et de rendu, et les réglages prudents Xbox/mobile. Aucun benchmark
   automatique au démarrage ou lors d’un changement de réglage.

Fichiers à traiter : `src/animaux.js`, `src/faune.js`, raccord des vues dans `src/jeu.js`.
La petite faune suit la même règle de visibilité utile. Les modèles 3D livrés en .85
servent de base ; le besoin porte sur placement, activité et coût.

## D — nouvelle réalisation des démos

1. Retirer la **sélection et la préparation** des plans flore/faune ; supprimer aussi
   les gros plans autonomes qui quittent les trois sujets autorisés. Les animaux et
   la végétation peuvent rester dans le décor de fond, sans devenir le sujet du plan.
2. Recomposer les séquences de chacun des neuf circuits à partir de son tracé actuel,
   de ses virages, reliefs, ouvrages et marqueurs de lieux réels. Ne pas simplement
   renommer les anciens panoramas génériques.
3. Alterner des plans lisibles de route/course, une présentation du tracé et le point
   d’intérêt principal. Un suivi de voiture reste orienté vers la route et le circuit.
4. Cadrer le point d’intérêt avec son contexte routier lorsque possible. S’il est masqué
   ou mal cadré, revenir à un plan de route validé, jamais à un plan d’herbe ou d’animal.
5. Vérifier toute la trajectoire de caméra et ses transitions : au-dessus du terrain,
   sans traversée de montagne, paroi, tunnel ou ouvrage ; sujet visible et bandeau lisible.
6. Conserver la démo continue, la sortie sur geste et les commandes, les réglages météo,
   les qualités et l’accessibilité. La musique reste limitée à l’écran titre.

### Couverture des circuits

Les points ci-dessous proviennent des marqueurs .85. Les 81 images .86 ont été reçues ;
la réception du build .87 reste à faire pour chaque circuit.

| Circuit | Point d’intérêt proposé depuis les lieux existants | Réception |
|---|---|---|
| Val-Brûlé | Viaduc des Chênes | .86 reçue ; .87 à recevoir |
| Port-Sable | Grand Phare du Cap | .86 reçue ; .87 à recevoir |
| Haut-Col | Galerie Paravalanche et route en montagne | .86 reçue ; .87 à recevoir |
| Lande-Noire | Pont-Arche Noir | .86 reçue ; .87 à recevoir |
| Roche-Fauve | Nécropole des Pyramides | .86 reçue ; .87 à recevoir |
| Brume-de-Jade | Grand Portail Torii Vermillon | .86 reçue ; .87 à recevoir |
| Cap-Séquoia | Grand Pont Suspendu Vermillon | .86 reçue ; .87 à recevoir |
| Baïkal | Chapelle aux Bulbes Dorés | .86 reçue ; .87 à recevoir |
| Route-des-Cimes | Arche du Col des Cimes | .86 reçue ; .87 à recevoir |

**Extension prévue :** ajouter la démo du **sommet du col de Larche → Vinadio**
lorsque le parcours entre réellement au catalogue. Respecter le sens de descente,
l’arrivée définitive et l’absence de rebouclage ; ne pas l’annoncer jouable avant réception.

Fichiers à traiter : `src/realisateur.js`, `src/cinema.js`, raccord dans `src/jeu.js`.
Réutiliser les métadonnées de `src/lieux.js` et `src/decor.js`.

## Progression et critères de clôture

| Lot | Travail | État | Preuve attendue |
|---|---|---|---|
| F1 | Replacer la population aux abords proches | Préparé, contrôles numériques reçus | Distances au bord de route, captures depuis les vues de conduite |
| F2 | Endormir les groupes hors des vues utiles | Préparé, contrôles numériques reçus | Compteurs de groupes simulés/poses préparées nuls pour les groupes invisibles ; réveil stable |
| D1 | Remplacer le choix et la préparation des plans | Préparé, contrôles numériques reçus | Aucun plan flore/faune ou autre sujet autonome dans un cycle complet |
| D2 | Recomposer les neuf circuits et leurs lieux | Préparé, contrôles numériques reçus | Séquences et captures identifiées par circuit, début/milieu/fin de plan et transitions |
| Q | Qualifier puis publier le runtime | En cours | Build reproductible, contrôles ciblés, réception visuelle et mesures avant/après |

Comparer à scène et qualité identiques : groupes créés/actifs, animaux dessinés,
coûts CPU, allocations et temps d’image. Vérifier champ avant/arrière, changement de vue,
J1/J2, rétros activés/désactivés, Faune désactivée et qualités basse/moyenne/haute.
Les neuf circuits doivent être couverts par la réception des démos ; inspecter les
passages en relief et sous ouvrages, sans réintroduire de benchmark chez le joueur.
Les FPS Xbox/iOS ne sont validés que par un essai physique ; aucune valeur inventée.

Les traces historiques restent consultables. Ce nouveau périmètre gouverne les prochains
lots faune/démo ; les autres travaux, notamment Larche L3/L4 et les essais matériels, restent suivis.
