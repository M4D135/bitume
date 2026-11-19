# 12A–12C — contrat et visuel des roues

État au **19 novembre 2026** : implémentation et qualification de code terminées ; **réserve visuelle WebGL**.
Build **0.2.45**, reproductible. Publication à vérifier dans le reçu ; aucun déploiement effectué.

## Bases et reprise

- Base : `e47fb220373e5824540beaccd02d8270492111c5`, jeu 0.2.44, FERRO 0.3.11, physique p9.
- Checkpoint publié : **8665af0**, conservation du travail réel 12A–12C et du brouillon 12D.
- Journal courant : `SUIVI-2026-11-19.md` ; résultats et publication : `ETAT.json` et `rapports/continuation-2026-11-19/`.
- Patch de récupération : `rapports/continuation-2026-11-19/recuperation-12ABC-et-brouillon-12D.patch`.
- Safari confirmé corrigé par David ; aucun chantier Safari dans ce lot.

## Périmètre du lot

| Partie | Implémentation qualifiée côté code |
|---|---|
| 12A — contrat | `src/pneus.js` centralise AVG, AVD, ARG, ARD, dimensions et catalogue des quatre types. Quatre états indépendants et graines déterministes par voiture ; libellés des avaries corrigés. |
| Compatibilité | Identifiants slicks/inter/pluie et coefficients p9 conservés ; aucun tirage ajouté au hasard partagé de la course. État des pneus préservé au replacement. |
| 12B — géométrie | Profils arrondis, jantes annulaires, moyeux/rayons/disques ; formes dédiées des roues sans augmenter les cylindres génériques de FERRO. |
| 12B — détail | Quatre variantes 96/64/32/16 segments ; sélection selon la taille projetée et la caméra, à contrôler également en rétroviseurs et écran partagé. |
| 12C — sculptures | Slick neuf lisse ; intermédiaire, pluie et neige différenciés par la géométrie de la bande de roulement ; motifs solidaires des roues. |
| Neige | Catalogue et visuel préparés. `disponible: false`, aucune nouvelle adhérence ; choix jouable fermé jusqu'à 12E. |

## Fichiers utiles seulement

- Contrat/branchement : `src/pneus.js`, `src/conduite.js`, `src/course.js`, `src/degats.js`, `construire.py`.
- Visuel/caméras : `src/voiture.js`, sections utiles de `src/jeu.js`.
- Contrôles : tests pneus, roues/voiture, conduite, contacts, stands et déterminisme de `verifications/`.
- Build : `dist/bitume.html`, `SIZE.json`, `VERSION.json`, produits par `construire.py`.

## Conditions de clôture

1. Chargeurs de tests compatibles avec la dépendance `pneus.js` ; tests ciblés et qualification finale consignés.
2. Comparaison physique à la base récupérée : séparer les nouvelles données de pneus de la signature p9 ; ne pas réécrire une fixture pour masquer un écart.
3. Géométrie, normales, dimensions, rotation/braquage, changements de détail et coût contrôlés ; distinguer aperçu CPU et validation WebGL.
4. Build reproductible, verrou FERRO conservé, publication sources/build vérifiée sur main.
5. Journal, état et reçu cohérents ; contrôle du site séparé, aucune annonce de déploiement sans preuve.

Les résultats détaillés restent dans les rapports. La clôture réelle est celle du dernier reçu et du suivi,
pas une déduction à partir de la présence de code dans le checkpoint.

## Sous-lot suivant : 12D — usure visible

Après la clôture 12A–12C, reprendre le brouillon usure conservé dans le patch, le relire et l'intégrer par étapes.
Évolution par roue liée au roulage, à la charge et à la glisse ; saleté réversible distincte de l'usure ; aucune
progression en pause ou sans contact au sol. Conserver le type et l'usure au replacement, sans modifier l'adhérence
avant 12E. Le service réel, les menus et la synchronisation des quatre états appartiennent à 12F.

Un seul intégrateur, fichiers disjoints pour les relectures, checkpoints fréquents sur main. Mac/Spark non accessibles
ici ; ne compter aucune branche locale distante comme récupérée ou livrée.

## Résultat de la reprise

88/90 suites : deux échecs hérités identiques, aucune nouvelle régression observée. Comparaison p9 directe : 19 scénarios, 1 259 empreintes identiques. Six suites ciblées rejouées après le correctif de type invalide. Build reproductible, 34 modules FERRO inchangés. Voir `rapports/continuation-2026-11-19/VALIDATION.md` et `qualification-finale.json`. Le reçu GitHub suit séparément ; le rendu WebGL et les performances matérielles restent à valider.
