# Passation 05 → 00/04 — suite des circuits

Audit lecture seule du checkout base `1c71bb341d20df4328e5178497503ee4ad26a131`. Aucun test de campagne relancé, aucun fichier du dépôt modifié.

## État actuel vérifié

Le catalogue de `src/jeu.js` contient neuf circuits dans cet ordre, avec graines :

| Index | ID | Graine |
|---|---|---|
| 0 | val-brule | 11 |
| 1 | port-sable | 29 |
| 2 | haut-col | 47 |
| 3 | lande-noire | 83 |
| 4 | roche-fauve | 107 |
| 5 | brume-de-jade | 131 |
| 6 | cap-sequoia | 157 |
| 7 | baikal | 179 |
| 8 | route-des-cimes | 181 |

- **Cimes** : socle livré en 0.2.66 / p15 / FERRO 0.3.15, PR #38, fusion `f3fb3eaa801494c4a2b0b9c0d22baf6eae2bd1a8`. `PUBLICATION-0266.json` atteste neuf circuits et distingue la publication GitHub du déploiement (absent). `src/route-des-cimes.js` est la reconstruction explicite actuelle : 9 697,52858032384 m dans le catalogue, trois couverts, pont ; l’étude historique de 9 618,689 m reste un témoin distinct. Ces valeurs sont des dimensions du jeu, pas des mesures du monde réel.
- **Cimes décor** : `src/route-des-cimes-decor.js` sculpte gorge/corniches et construit pont/refuge. Les sept lieux complets, lac/cascade et finition du relief restent ouverts dans `FILE-TRAVAIL.json` ; ne pas déclarer les lieux terminés parce que leurs noms existent.
- **Haut-Col** : ID/graine/plan conservés ; témoin p15 de 5 216 m, tunnel de 260 m. La suite rampes >10 %, corniche et second tunnel est encore prévue. La valeur 5 200 de `CATALOGUE` est une entrée du générateur, pas sa longueur échantillonnée réelle.
- **Baïkal** : huitième circuit, 13A puis décor 13B déjà publiés (PR #20 / 0.2.60). `src/baikal.js`, appels dans `src/decor.js` et `CONTINUATION-AUTONOME-2026-11-19.md` confirment le socle lac/berges/promontoire/forêt/clairières/hameau/saisons. Préserver ses acquis.

## Sept lieux de Cimes à finir par petits jalons

1. Le Bois Noir : forêt dense et esses.
2. Le Mur : lecture visuelle de la rampe/crête, sans modifier silencieusement le profil qualifié.
3. Les Lacets : murs et étagement.
4. Le Balcon du Cirque : paroi/corniche/vue dégagée.
5. Col de l’Aiglière : lac, refuge et galerie.
6. Pont de la Gorge : arche/gorge déjà présentes ; cascade à ajouter.
7. Virage du Vide : corniche/parapet/perspective vers vallée.

Ce sont des lieux fictifs conçus pour le jeu, pas des acquisitions altimétriques externes. Leurs paramètres futurs doivent être marqués comme choix de conception.

## Contrat proposé à 00/04

- 04 termine sa matrice quatre saisons/neuf circuits ; conserve la neige et les espèces selon le biome, ainsi que l’exception Port-Sable.
- 05 reste sources/outils/tests. Un transfert explicite de `src/route-des-cimes-decor.js`, `src/decor.js`, `src/bords.js` depuis 04 est nécessaire avant toute écriture de décor par 05. Toute reprise de `src/route-des-cimes.js` doit également recevoir un propriétaire explicite.
- 00 possède `src/circuit.js`, catalogue/jeu, raccords physique/caméras et builds. Les données suffisantes et les interfaces acceptées précèdent le runtime Monaco/Marseille ; aucune route réelle ne doit être remplie à partir d’un terrain pris pour la chaussée.
- Le prochain lot Cimes peut enrichir lac/cascade/relief visuel en lisant `c.lieux`, `c.couverts`, `c.ponts` sans modifier plan, limites, profils ni p15. Toute évolution de chaussée/relief conducteur de Haut-Col passe par un lot physique séparé et les contrôles 00.
- Contrôles futurs ciblés : empreintes des historiques, continuité terrain/ouvrages, portails/caméras/rétros, PhysX/IA sous les conditions touchées, lecture visuelle cockpit/poursuite/démo, coût par qualité. Ne pas recopier les anciennes réussites comme preuve d’un nouveau candidat.

## Programme des 17 destinations conservé

Neuf jouables + Monaco et Spéciale Marseille demandés + six propositions : Fjord-d’Argent, Crêtes-des-Carpates, Landes-d’Écosse, Sierra-Cuivrée, Baie-du-Corail, Col-des-Andes. Les six propositions n’ont encore ni graine ni longueur fixées. Ajouter les prochains IDs sans réordonner les neuf existants.

## Documents anciens à ne pas suivre littéralement

- `docs/reprise/ETAT.json` → `catalogue.jouables: 8` est historique ; la reprise courante et le reçu 0.2.66 font foi.
- `docs/reprise/CONTINUATION-AUTONOME-2026-11-19.md` → ligne montagne « absent du catalogue » est dépassée.
- `MASTER-LISTE-CLAUDE-FABLE.md` → huit jouables / 13B seulement qualifié localement est dépassé.
- `docs/reprise/22F-CIRCUITS-MEMORABLES.md` conserve son étude initiale ; son bandeau annule la question de remplacement de Haut-Col, déjà tranchée. La conduite de travail actuelle est p15, pas le p14 du bandeau.
- Les drapeaux historiques `qualificationCatalogue: false` et le commentaire « aucun ajout au catalogue » dans la provenance du constructeur Cimes ne décrivent pas l’intégration actuelle dans `src/jeu.js`.

La consolidation de ces documents globaux appartient à 00 ; aucune correction concurrente effectuée ici.

## Preuves ciblées

`src/jeu.js` (CATALOGUE) ; `src/route-des-cimes.js` (PROVENANCE, PARTITION) ; `src/route-des-cimes-decor.js` ; `src/baikal.js` ; `src/decor.js` ; `verifications/route-des-cimes.test.mjs` ; `verifications/fixtures/route-des-cimes-circuits-p15.json` ; `docs/reprise/rapports/COUVERTS-CIMES-2026-11-20/PUBLICATION-0266.json` ; `docs/reprise/FILE-TRAVAIL.json` ; `docs/reprise/PARALLELE-2026-11-20/REPARTITION.json`.
