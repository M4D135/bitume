# Lot 12 — arrière de la monoplace

## Demande et périmètre

18 novembre 2026 : remplacer le bloc carré gris derrière la voiture après examen de photos de la 312 T5 réelle.
Un seul sous-lot : arrière extérieur, sans changement de conduite ni du moteur FERRO. Publication demandée à chaque étape.

## Références consultées

- [Bonhams, châssis 046](https://carsd.bonhams.com/auction/23977/lot/45/1980-ferrari-312-t5-single-seater-formula-1-chassis-no-046-engine-no-066/) : vues arrière et mécanique découverte. Quatre sorties, deux hautes et deux basses ; carter moulé, platines ajourées, mât en plaque métallique et freins intérieurs. Cet exemplaire restauré a perdu ses conduits de refroidissement de freins arrière : leur absence n'est pas une règle historique.
- [Nigel Snowdon / Klemantaski, Monaco, 18 mai 1980](https://klemcoll.wordpress.com/2020/09/18/ferraris-312t5/) : photographie d'époque, silhouette basse, large et plate.
- [Ferraris Online, châssis 048](https://ferraris-online.com/cars/1980-ferrari-312-t5-048/) : moteur à douze cylindres à plat, boîte transversale placée avant l'essieu arrière.

Les photos servent uniquement à observer les formes. Aucun fichier photographique, logo ou commanditaire n'entre dans le jeu.
Les proportions ajoutées sont une interprétation procédurale, pas une reconstruction métrologique du châssis.

## Modification 0.2.36

`src/voiture.js` : carter arrondi et nervuré, boîte transversale, suspension tubulaire, cardans et freins intérieurs.
Quatre échappements avec peau intérieure et lèvres réellement ouvertes. Deux platines avec trous traversants.
Support d'aileron métallique profilé, joues rouges aux coins arrondis, capot raccourci pour dégager la mécanique.
Treize formes partagées construites une fois ; trois instances supplémentaires pour la voiture détaillée.
Les deux attaches intérieures initialement flottantes ont été rapprochées du carter lors de la revue.

## Qualification

Rapports dans `rapports/arriere-monoplace-2026-11-18/` :

- 64 suites réussies ; deux reconstructions identiques ; 34 modules FERRO 0.3.9 conformes.
- 12 contrôles par rayons : quatre bouches ouvertes, quatre lèvres présentes, deux trous traversants et matière autour.
- Aucun triangle dégénéré ni normale inversée dans les treize formes ajoutées.
- Modèle extérieur avec pilote : 135 → 138 instances ; 18 545 → 20 561 triangles (+2 016, soit 10,9 %).
- Modèle lointain : 11 instances. Aucun gain FPS annoncé.
- `avant-geometrie.png` et `apres-geometrie.png` : projections CPU des vrais triangles FERRO, éclairage approximatif.
  **Ce ne sont pas des captures du jeu.** WebGL, matériaux et performances restent à contrôler sur le Mac.
- Chromium ne démarre pas ici : `socket() failed: Operation not permitted (1)`.

## Publication et suite

Base vérifiée : `14fc9dcaa0e6ecfce1ddb98420adcfc2072fa2e3`, version 0.2.35.
Voir `REPRISE.md`, `ETAT.json` et le reçu de publication pour le dernier état vérifié.
Le site a été observé en 0.2.34 ; déploiement autorisé via `./deposer.sh` depuis le Mac/amiga, accès absent ici.
Après contrôle WebGL et déploiement, reprendre la fiche 11 par un seul circuit en Asie. Ne pas recharger tout l'historique.
