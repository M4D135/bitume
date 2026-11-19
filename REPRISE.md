# BITUME — reprise courte

## Livraison close — 19 novembre 2026

**0.2.59 / p14 publiée sur main par la PR #17**, fusion `02e8bac6` ; arbre identique au candidat qualifié `d052f4c`.
PR #16 intégrée dans l'historique commun. La 0.2.57 (démos et regard arrière) est également publiée, PR #15, fusion `940eabb9`.
Lire `docs/reprise/ETAT.json`, puis seulement la fiche utile au lot suivant.

- Volant avancé de 10 cm ; levier recentré et fixé sur une console procédurale dans la cuve.
- Main et bras raccordés, saute-vent dégagé ; coque simplifiée ouverte et tige présente à tous les niveaux de détail.
- Joueur et concurrents couverts. Cadrage intérieur, animations, conduite p14, réseau et FERRO conservés.
- **6/6 suites ciblées : 71 contrôles cockpit/voitures et registre des formes ; 840 poses détaillées + 150 poses LOD réels.**
- **CI complète 0.2.59 : PR : 126/127 ; push : 125/127.** Traces à signature héritée ; Val-Brûlé : 166 ms / 150 ms sur push seulement.
- Aucune fixture ni seuil modifié. La réserve de durée reste ouverte, sans affirmer une absence de régression mesurée.
- Deux builds identiques, archive CI contrôlée : 14 186 762 octets, SHA-256
  `cb02e2250a2e4a7d06bd0fdea659fce641a016975e224bac2823574888439cd4`.

## Preuves et limites

Reçu : `docs/reprise/rapports/COCKPIT-PILOTES-2026-11-19/PUBLICATION-0259.json`.
Fiche : `docs/reprise/COCKPIT-PILOTES-2026-11-19.md`. Les deux candidats 0.2.58 et la limite du premier banc LOD restent consignés.
0.2.57 : CI correctives et après fusion : 125/126, seules traces héritées ; reçu `docs/reprise/rapports/DEMOS-CINEMA-2026-11-19/PUBLICATION-0257.json`.
La CI automatique après fusion 0.2.59 `44602433260` était encore en cours à la clôture ; son résultat reste distinct.
Géométrie inspectée dans trois vues par raster logiciel. Jeu complet en navigateur, manette physique et FPS matériels
restent à vérifier ; aucun déploiement du site effectué. Aucun nouveau journal local brut ni chemin interne publié.

## Prochaine action — 13B Baïkal

Reprendre `docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md` pour le lac, les berges, les lieux signature,
la végétation/faune propres et les saisons. Conserver les huit circuits actuels et la conduite p14.
Monaco fidèle, Marseille avec relief, grand circuit montagne distinct et les six propositions restent prévus.
Ne pas refaire les suites/builds clos ci-dessus sans changement de code ni risque nouveau.
Un sous-lot à la fois ; actualiser la reprise après publication ; aucun push forcé.
