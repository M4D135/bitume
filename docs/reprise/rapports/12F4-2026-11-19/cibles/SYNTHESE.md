# 12F4 — preuves ciblées, 19 novembre 2026

**79 contrôles réussis dans cinq reçus conservés ; 17 scénarios physiques finaux.** Ce dossier assemble des résultats existants. Aucun test n’a été relancé pour produire ce paquet. La qualification globale est distincte.

## Reçus

| Suite | Résultat | Provenance |
|---|---:|---|
| [strategie-stands-final.log](strategie-stands-final.log) | 17/17 | passage-04 |
| [stands-final.log](stands-final.log) | 18/18 | passage-02 |
| [stands-pneus-final.log](stands-pneus-final.log) | 30/30 | passage-02 |
| [decisions-final.log](decisions-final.log) | 6/6 | final-parent |
| [chaussee-preparation-final.log](chaussee-preparation-final.log) | 8/8 | final-parent |

Les reçus 18/18 et 30/30 précèdent le dernier correctif de stratégie. Ils restent identifiés comme passage 02. Les trois snapshots essentiels du passage 04 sont identiques aux fichiers gelés au conditionnement ; leurs empreintes figurent dans `SYNTHESE.json` et le manifeste de l’archive. Les reçus fournis par l’orchestrateur ne contiennent pas eux-mêmes d’empreinte de leurs sources.

## Sept circuits : trajet, immobilisation, service et sortie

Vraies fonctions `course.pas` et `conduite`, pas de 1/120 s, limites et solides du catalogue. Usure initiale 0,9 ; départ 350 m avant les stands, vitesse 25 m/s, horloge 30 s. Temps ci-dessous en secondes de simulation ; pose en mètres (`s ; d`).

| Circuit | Entrée / service / réparé / sortie | Pose pendant le service | Position finale s |
|---|---|---|---:|
| Brume-de-Jade | 45.758 / 53.617 / 56.125 / 70.375 | 92.014 ; 4.400 | 270.115 |
| Cap-Séquoia | 43.433 / 51.283 / 53.792 / 68.033 | 92.013 ; 4.399 | 280.079 |
| Haut-Col | 45.200 / 53.050 / 55.558 / 69.808 | 92.012 ; 4.400 | 270.157 |
| Lande-Noire | 45.717 / 53.567 / 56.075 / 70.317 | 92.010 ; 4.400 | 280.181 |
| Port-Sable | 43.425 / 51.275 / 53.783 / 67.383 | 92.012 ; 4.401 | 264.160 |
| Roche-Fauve | 44.967 / 52.817 / 55.325 / 69.575 | 92.010 ; 4.400 | 270.038 |
| Val-Brûlé | 43.458 / 51.308 / 53.817 / 68.058 | 92.013 ; 4.399 | 280.079 |

Les sept services ont une durée nominale de **2,5 s**. L’intervalle observé entre événements est **2.508 s** (301 pas, effet de discrétisation). Les poses échantillonnées restent fixes, vitesse nulle ; le test contrôle ces invariants à chaque pas. Les quatre pneus ne sont renouvelés qu’à `repare`, après le service complet. Les sept voitures ressortent et reprennent leur progression, sans replacement. Le verrou de sortie est effacé hors voie.

## Autres preuves finales

- **Neige** : slicks conservés jusqu’au service terminé ; monte neige à `repare` (58.792 s), sortie puis progression. Surface mesurée : eau 0, neige 0.8.
- **Pluie** : slicks conservés jusqu’au service terminé ; monte pluie à `repare` (55.733 s), sortie puis progression. Surface mesurée : eau 1, neige 0.
- **Trois IA** : services successifs J1 51.300–53.808 s, J2 63.775–66.283 s, J3 76.242–78.750 s ; chacune est servie une fois puis repart.
- **Second tour réel** : deux services, commencés à 51.275 s, 264.575 s. L’usure est renouvelée après la première sortie ; aucune nouvelle entrée pendant les 25 s suivantes ni au même passage, sans déplacement artificiel.
- **Garage durablement occupé** : humain immobile à s=100 m ; admission IA refusée, puis dégagement physique sans contact ni service IA. L’IA atteint **s=502.17 m** en 20 s et continue à 39.82 m/s ; aucun replacement.
- **Interruption** : déplacement de 0,20 m juste avant la fin ; événement `annule`, compteur de service nul, pneus conservés.
- **Autorité et reprise** : service physique du rival par l’hôte, réception par le distant sans second service local ; humain repris par l’IA conservant ses pneus avant son vrai arrêt.
- **Absence de décision** : pneus sains et cas inéligibles (distant, humain local, fini, abandonné, drapeau, fin proche).

Les journaux courts ne sérialisent pas les graines ni tous les compteurs. L’absence de remise à zéro des compteurs, la stabilité des objets et des graines avant réparation, puis le renouvellement final sont attestés par les assertions à chaque pas du script archivé et par son reçu 17/17.

## Contre-exemples conservés et provenance

L’archive conserve seulement deux échecs utiles : l’entrée avant la ligne, qui rendait un tour valable, et le blocage devant l’occupant (passage 03, IA à s=91,87 m et v=0). Le passage 04 réussit ces cas après correction. Pour le second échec, utiliser le dernier `points[]` ; le champ `final` du journal était antérieur à l’injection de l’occupant. Aucun snapshot source n’a été retrouvé pour le premier échec.

`preuves-brutes.tar.gz` contient les 17 journaux finaux inchangés, les cinq logs, ces deux contre-exemples, le reçu isolé p12 disponible et les sources/scripts disponibles dédupliqués par contenu. `MANIFESTE.json` relie chaque contexte aux objets archivés. `INDEX-MEMBRES.json` donne tailles et SHA-256 internes. `INDEX.json` et `SHA256SUMS` couvrent les fichiers livrés ; les index excluent leur propre empreinte.
